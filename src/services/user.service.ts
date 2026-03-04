import * as admin from 'firebase-admin';
import { db } from '../config/firebase';
import { UserProfile, CreateUserDTO, UpdateUserDTO } from '../types/user.types';

const USERS_COLLECTION = 'users';

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

    const newUser = {
        phoneNumber: data.phoneNumber,
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
    const existing = await getUserById(uid);
    if (existing) return { user: existing, isNew: false };

    const user = await createUser({ uid, phoneNumber });
    return { user, isNew: true };
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
