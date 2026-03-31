import * as admin from 'firebase-admin';
import { db } from '../config/firebase';
import { UserProfile, CreateUserDTO, UpdateUserDTO } from '../types/user.types';

const USERS_COLLECTION = 'users';
const USER_PHONE_INDEX_COLLECTION = 'userPhoneIndex';

class PhoneConflictError extends Error {
    statusCode: number;

    constructor(message: string) {
        super(message);
        this.name = 'PhoneConflictError';
        this.statusCode = 409;
    }
}

export const normalizePhone = (phoneNumber: string): string => {
    const trimmed = (phoneNumber || '').trim();
    if (!trimmed) return '';

    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';

    return `${hasPlus ? '+' : '+'}${digits}`;
};

export const getUserByPhoneNumber = async (phoneNumber: string): Promise<UserProfile | null> => {
    const phoneE164 = normalizePhone(phoneNumber);
    if (!phoneE164) return null;

    const byNormalized = await db
        .collection(USERS_COLLECTION)
        .where('phoneE164', '==', phoneE164)
        .limit(1)
        .get();

    if (!byNormalized.empty) {
        const doc = byNormalized.docs[0];
        return { uid: doc.id, ...doc.data() } as UserProfile;
    }

    // Backward compatibility for older records without phoneE164
    const byRawPhone = await db
        .collection(USERS_COLLECTION)
        .where('phoneNumber', '==', phoneNumber)
        .limit(1)
        .get();

    if (byRawPhone.empty) return null;
    const doc = byRawPhone.docs[0];
    return { uid: doc.id, ...doc.data() } as UserProfile;
};

/**
 * Get a user by UID from Firestore
 */
export const getUserById = async (uid: string): Promise<UserProfile | null> => {
    const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
    if (!doc.exists) return null;
    return { uid: doc.id, ...doc.data() } as UserProfile;
};

/**
 * Create a new user in Firestore (called on first login)
 */
export const createUser = async (data: CreateUserDTO): Promise<UserProfile> => {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const normalizedPhone = normalizePhone(data.phoneNumber);

    const newUser = {
        phoneNumber: data.phoneNumber,
        phoneE164: normalizedPhone || null,
        name: data.name || '',
        photoURL: null,
        role: 'buyer',
        email: '',
        isActive: true,
        createdAt: now,
        updatedAt: now,
    };

    await db.collection(USERS_COLLECTION).doc(data.uid).set(newUser);

    // Immediately fetch to get server timestamps resolved
    const created = await db.collection(USERS_COLLECTION).doc(data.uid).get();
    return { uid: data.uid, ...created.data() } as UserProfile;
};

/**
 * Get or create user (used on every login — creates on first, returns existing on subsequent logins)
 */
export const getOrCreateUser = async (
    uid: string,
    phoneNumber: string
): Promise<{ user: UserProfile; isNew: boolean }> => {
    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) {
        throw new Error('Phone number is missing from auth token');
    }

    const userRef = db.collection(USERS_COLLECTION).doc(uid);
    const phoneRef = db.collection(USER_PHONE_INDEX_COLLECTION).doc(normalizedPhone);

    const result = await db.runTransaction(async (tx) => {
        const [userDoc, phoneDoc] = await Promise.all([tx.get(userRef), tx.get(phoneRef)]);
        const now = admin.firestore.FieldValue.serverTimestamp();

        if (userDoc.exists) {
            const existing = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
            const existingPhone = normalizePhone(existing.phoneE164 || existing.phoneNumber || '');

            // If this UID is linked to a different phone index owner, block to prevent dup identities.
            if (phoneDoc.exists && (phoneDoc.data()?.uid as string) !== uid) {
                throw new PhoneConflictError(
                    'This phone number is already linked to another account. Please contact support.'
                );
            }

            // Backfill phone index/user normalized field when missing on older records.
            tx.set(
                userRef,
                {
                    phoneE164: existingPhone || normalizedPhone,
                    updatedAt: now,
                },
                { merge: true }
            );
            tx.set(
                phoneRef,
                {
                    uid,
                    phoneNumber,
                    phoneE164: normalizedPhone,
                    updatedAt: now,
                    createdAt: phoneDoc.exists ? phoneDoc.data()?.createdAt ?? now : now,
                },
                { merge: true }
            );

            return { isNew: false };
        }

        if (phoneDoc.exists) {
            const linkedUid = phoneDoc.data()?.uid as string | undefined;
            if (linkedUid && linkedUid !== uid) {
                throw new PhoneConflictError(
                    'This phone number is already linked to another account. Please contact support.'
                );
            }
        }

        tx.set(userRef, {
            phoneNumber,
            phoneE164: normalizedPhone,
            name: '',
            photoURL: null,
            role: 'buyer',
            email: '',
            isActive: true,
            createdAt: now,
            updatedAt: now,
        });

        tx.set(
            phoneRef,
            {
                uid,
                phoneNumber,
                phoneE164: normalizedPhone,
                createdAt: now,
                updatedAt: now,
            },
            { merge: true }
        );

        return { isNew: true };
    });

    const user = await getUserById(uid);
    if (!user) {
        throw new Error('User not found after getOrCreate transaction');
    }

    return { user, isNew: result.isNew };
};

/**
 * Update user profile fields
 */
export const updateUser = async (uid: string, data: UpdateUserDTO): Promise<UserProfile> => {
    const updateData = {
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection(USERS_COLLECTION).doc(uid).update(updateData);
    const updated = await getUserById(uid);
    if (!updated) throw new Error('User not found after update');
    return updated;
};

/**
 * Get public-facing user profile (limited fields)
 */
export const getPublicProfile = async (uid: string) => {
    const user = await getUserById(uid);
    if (!user) return null;

    return {
        uid: user.uid,
        name: user.name,
        photoURL: user.photoURL,
        role: user.role,
    };
};

/**
 * Update user role (used when seller is approved)
 */
export const updateUserRole = async (
    uid: string,
    role: 'buyer' | 'seller' | 'admin'
): Promise<void> => {
    await db.collection(USERS_COLLECTION).doc(uid).update({
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};
