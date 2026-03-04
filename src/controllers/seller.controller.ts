import { Request, Response } from 'express';
import {
    createSellerRequest,
    getSellerRequest,
    getSellerProfile,
    updateSellerProfile,
    getPublicSellerProfile,
} from '../services/seller.service';
import { uploadFile, extractStoragePath, deleteFile } from '../services/storage.service';
import { generateAndSaveSellerQR } from '../utils/qr.util';
import { sendSuccess, sendError } from '../utils/response.util';

/**
 * POST /api/sellers/request
 * Request to become a seller (authenticated buyer)
 */
export const requestSellerAccount = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const request = await createSellerRequest(req.user.uid);
        sendSuccess(res, { request }, 'Seller request submitted. Admin will review shortly.', 201);
    } catch (error) {
        const err = error as Error;
        if (err.message.includes('pending') || err.message.includes('approved')) {
            sendError(res, err.message, 409);
        } else {
            console.error('requestSellerAccount error:', err.message);
            sendError(res, 'Failed to submit seller request', 500);
        }
    }
};

/**
 * GET /api/sellers/me/request
 * Get the current user's seller request status
 */
export const getMySellerRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const request = await getSellerRequest(req.user.uid);

        if (!request) {
            sendError(res, 'No seller request found', 404);
            return;
        }

        sendSuccess(res, { request }, 'Seller request fetched');
    } catch (error) {
        const err = error as Error;
        console.error('getMySellerRequest error:', err.message);
        sendError(res, 'Failed to fetch seller request', 500);
    }
};

/**
 * GET /api/sellers/me
 * Get the authenticated seller's own store profile
 */
export const getMySellerProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const profile = await getSellerProfile(req.user.uid);

        if (!profile) {
            sendError(res, 'Seller profile not found', 404);
            return;
        }

        sendSuccess(res, { profile }, 'Seller profile fetched');
    } catch (error) {
        const err = error as Error;
        console.error('getMySellerProfile error:', err.message);
        sendError(res, 'Failed to fetch seller profile', 500);
    }
};

/**
 * PUT /api/sellers/me
 * Update store info (name, description, address)
 */
export const updateMySellerProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const { storeName, storeDescription, storeAddress } = req.body as {
            storeName?: string;
            storeDescription?: string;
            storeAddress?: string;
        };

        const updated = await updateSellerProfile(req.user.uid, {
            storeName,
            storeDescription,
            storeAddress,
        });

        sendSuccess(res, { profile: updated }, 'Seller profile updated');
    } catch (error) {
        const err = error as Error;
        console.error('updateMySellerProfile error:', err.message);
        sendError(res, 'Failed to update seller profile', 500);
    }
};

/**
 * PUT /api/sellers/me/photo
 * Upload or replace store photo
 */
export const updateStorePhoto = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        if (!req.file) {
            sendError(res, 'No photo file provided', 400);
            return;
        }

        const uid = req.user.uid;

        // Delete old store photo if exists
        const existingProfile = await getSellerProfile(uid);
        if (existingProfile?.storePhotoURL) {
            const oldPath = extractStoragePath(existingProfile.storePhotoURL);
            if (oldPath) await deleteFile(oldPath);
        }

        // Upload new store photo
        const ext = req.file.mimetype.split('/')[1] ?? 'jpg';
        const storagePath = `sellers/${uid}/store.${ext}`;
        const storePhotoURL = await uploadFile(req.file.buffer, req.file.mimetype, storagePath);

        const updated = await updateSellerProfile(uid, { storePhotoURL });

        sendSuccess(res, { profile: updated, storePhotoURL }, 'Store photo updated');
    } catch (error) {
        const err = error as Error;
        console.error('updateStorePhoto error:', err.message);
        sendError(res, 'Failed to upload store photo', 500);
    }
};

/**
 * GET /api/sellers/:uid
 * Public seller profile (accessible without auth — for QR scan)
 */
export const getPublicSeller = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = req.params['uid'] as string;

        const profile = await getPublicSellerProfile(uid);

        if (!profile) {
            sendError(res, 'Seller not found', 404);
            return;
        }

        sendSuccess(res, { profile }, 'Seller profile fetched');
    } catch (error) {
        const err = error as Error;
        console.error('getPublicSeller error:', err.message);
        sendError(res, 'Failed to fetch seller profile', 500);
    }
};

/**
 * GET /api/sellers/:uid/qr
 * Get or generate QR code for a seller's profile
 */
export const getSellerQR = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = req.params['uid'] as string;

        const profile = await getSellerProfile(uid);

        if (!profile) {
            sendError(res, 'Seller not found', 404);
            return;
        }

        // Return existing QR if already generated
        if (profile.qrCodeURL) {
            sendSuccess(res, { qrCodeURL: profile.qrCodeURL }, 'QR code fetched');
            return;
        }

        // Generate and save new QR code
        const qrCodeURL = await generateAndSaveSellerQR(uid);
        sendSuccess(res, { qrCodeURL }, 'QR code generated', 201);
    } catch (error) {
        const err = error as Error;
        console.error('getSellerQR error:', err.message);
        sendError(res, 'Failed to get QR code', 500);
    }
};

/**
 * POST /api/sellers/me/qr/regenerate
 * Force regenerate QR code for a seller
 */
export const regenerateSellerQR = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const uid = req.user.uid;
        const qrCodeURL = await generateAndSaveSellerQR(uid);
        sendSuccess(res, { qrCodeURL }, 'QR code regenerated');
    } catch (error) {
        const err = error as Error;
        console.error('regenerateSellerQR error:', err.message);
        sendError(res, 'Failed to regenerate QR code', 500);
    }
};
