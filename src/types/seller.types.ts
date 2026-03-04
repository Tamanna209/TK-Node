import { Timestamp } from 'firebase-admin/firestore';

export type SellerRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SellerRequest {
    uid: string;
    status: SellerRequestStatus;
    requestedAt: Timestamp;
    reviewedAt: Timestamp | null;
    reviewedBy: string | null;
    rejectionReason?: string;
}

export interface SellerProfile {
    uid: string;
    storeName: string;
    storeDescription: string;
    storePhotoURL: string | null;
    storeAddress: string;
    qrCodeURL: string | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface CreateSellerProfileDTO {
    storeName: string;
    storeDescription?: string;
    storeAddress?: string;
}

export interface UpdateSellerProfileDTO {
    storeName?: string;
    storeDescription?: string;
    storeAddress?: string;
    storePhotoURL?: string;
}

export interface PublicSellerProfile {
    uid: string;
    storeName: string;
    storeDescription: string;
    storePhotoURL: string | null;
    storeAddress: string;
    qrCodeURL: string | null;
    ownerName: string;
    ownerPhotoURL: string | null;
}
