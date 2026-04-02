import { Timestamp } from 'firebase-admin/firestore';

export type UserRole = 'buyer' | 'seller' | 'admin';

export interface UserProfile {
    uid: string;
    phoneNumber: string;
    phoneE164?: string;
    name: string;
    photoURL: string | null;
    role: UserRole;
    email?: string;
    isActive: boolean;
    expoPushTokens?: string[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface CreateUserDTO {
    uid: string;
    phoneNumber: string;
    name?: string;
}

export interface UpdateUserDTO {
    name?: string;
    email?: string;
    photoURL?: string;
}

export interface PublicUserProfile {
    uid: string;
    name: string;
    photoURL: string | null;
    role: UserRole;
}
