import * as admin from 'firebase-admin';
import { db } from '../config/firebase';
import { SellerProfile, SellerRequest, UpdateSellerProfileDTO } from '../types/seller.types';
import { getUserById, updateUserRole } from './user.service';

const SELLER_REQUESTS_COLLECTION = 'sellerRequests';
const SELLER_PROFILES_COLLECTION = 'sellerProfiles';

/**
 * Create a seller request for a user
 */
export const createSellerRequest = async (uid: string): Promise<SellerRequest> => {
    // Check if request already exists
    const existing = await db.collection(SELLER_REQUESTS_COLLECTION).doc(uid).get();

    if (existing.exists) {
        const data = existing.data() as SellerRequest;
        if (data.status === 'pending') {
            throw new Error('Seller request already pending');
        }
        if (data.status === 'approved') {
            throw new Error('Seller account already approved');
        }
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const requestData = {
        uid,
        status: 'pending',
        requestedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
    };

    await db.collection(SELLER_REQUESTS_COLLECTION).doc(uid).set(requestData);

    const created = await db.collection(SELLER_REQUESTS_COLLECTION).doc(uid).get();
    return { uid, ...created.data() } as SellerRequest;
};

/**
 * Get seller request by user UID
 */
export const getSellerRequest = async (uid: string): Promise<SellerRequest | null> => {
    const doc = await db.collection(SELLER_REQUESTS_COLLECTION).doc(uid).get();
    if (!doc.exists) return null;
    return { uid: doc.id, ...doc.data() } as SellerRequest;
};

/**
 * Get all seller requests (admin use)
 */
export const getAllSellerRequests = async (
    status?: 'pending' | 'approved' | 'rejected'
): Promise<SellerRequest[]> => {
    let query = db.collection(SELLER_REQUESTS_COLLECTION) as admin.firestore.Query;

    if (status) {
        query = query.where('status', '==', status);
    }

    query = query.orderBy('requestedAt', 'desc');

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() } as SellerRequest));
};

/**
 * Approve a seller request (admin action)
 * - Updates sellerRequests status to 'approved'
 * - Updates user role to 'seller'
 * - Creates a sellerProfiles document
 */
export const approveSellerRequest = async (
    uid: string,
    adminUid: string
): Promise<void> => {
    const now = admin.firestore.FieldValue.serverTimestamp();

    const user = await getUserById(uid);
    if (!user) throw new Error('User not found');

    const batch = db.batch();

    // Update seller request
    const requestRef = db.collection(SELLER_REQUESTS_COLLECTION).doc(uid);
    batch.update(requestRef, {
        status: 'approved',
        reviewedAt: now,
        reviewedBy: adminUid,
    });

    // Create seller profile document
    const profileRef = db.collection(SELLER_PROFILES_COLLECTION).doc(uid);
    const existingProfile = await profileRef.get();

    if (!existingProfile.exists) {
        batch.set(profileRef, {
            uid,
            storeName: `${user.name || 'My'}'s Store`,
            storeDescription: '',
            storePhotoURL: null,
            storeAddress: '',
            qrCodeURL: null,
            createdAt: now,
            updatedAt: now,
        });
    }

    await batch.commit();

    // Update user role to seller
    await updateUserRole(uid, 'seller');
};

/**
 * Reject a seller request (admin action)
 */
export const rejectSellerRequest = async (
    uid: string,
    adminUid: string,
    reason: string
): Promise<void> => {
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection(SELLER_REQUESTS_COLLECTION).doc(uid).update({
        status: 'rejected',
        reviewedAt: now,
        reviewedBy: adminUid,
        rejectionReason: reason,
    });
};

/**
 * Get seller profile by UID
 */
export const getSellerProfile = async (uid: string): Promise<SellerProfile | null> => {
    const doc = await db.collection(SELLER_PROFILES_COLLECTION).doc(uid).get();
    if (!doc.exists) return null;
    return { uid: doc.id, ...doc.data() } as SellerProfile;
};

/**
 * Update seller profile
 */
export const updateSellerProfile = async (
    uid: string,
    data: UpdateSellerProfileDTO
): Promise<SellerProfile> => {
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection(SELLER_PROFILES_COLLECTION).doc(uid).update({
        ...data,
        updatedAt: now,
    });

    const updated = await getSellerProfile(uid);
    if (!updated) throw new Error('Seller profile not found after update');
    return updated;
};

/**
 * Save QR code URL to seller profile
 */
export const saveQRCodeURL = async (uid: string, qrCodeURL: string): Promise<void> => {
    await db.collection(SELLER_PROFILES_COLLECTION).doc(uid).update({
        qrCodeURL,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

/**
 * Get public seller profile with owner user info merged
 */
export const getPublicSellerProfile = async (uid: string) => {
    const [sellerProfile, user] = await Promise.all([
        getSellerProfile(uid),
        getUserById(uid),
    ]);

    if (!sellerProfile || !user) return null;

    return {
        uid,
        storeName: sellerProfile.storeName,
        storeDescription: sellerProfile.storeDescription,
        storePhotoURL: sellerProfile.storePhotoURL,
        storeAddress: sellerProfile.storeAddress,
        qrCodeURL: sellerProfile.qrCodeURL,
        ownerName: user.name,
        ownerPhotoURL: user.photoURL,
    };
};
