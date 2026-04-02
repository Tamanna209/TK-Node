import { Request, Response } from 'express';
import {
    getUserById,
    updateUser,
    getPublicProfile,
} from '../services/user.service';
import { registerPushToken, unregisterPushToken } from '../services/push.service';
import { uploadFile, extractStoragePath, deleteFile } from '../services/storage.service';
import { sendSuccess, sendError } from '../utils/response.util';

/**
 * GET /api/users/me
 * Get the authenticated user's full profile
 */
export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const user = await getUserById(req.user.uid);

        if (!user) {
            sendError(res, 'User profile not found', 404);
            return;
        }

        sendSuccess(res, { user }, 'Profile fetched successfully');
    } catch (error) {
        const err = error as Error;
        console.error('getMyProfile error:', err.message);
        sendError(res, 'Failed to fetch profile', 500);
    }
};

/**
 * PUT /api/users/me
 * Update authenticated user's name and/or email
 */
export const updateMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const { name, email } = req.body as { name?: string; email?: string };

        const updated = await updateUser(req.user.uid, { name, email });

        sendSuccess(res, { user: updated }, 'Profile updated successfully');
    } catch (error) {
        const err = error as Error;
        console.error('updateMyProfile error:', err.message);
        sendError(res, 'Failed to update profile', 500);
    }
};

/**
 * PUT /api/users/me/photo
 * Upload or replace the user's profile photo
 * Expects multipart/form-data with field name "photo"
 */
export const updateProfilePhoto = async (req: Request, res: Response): Promise<void> => {
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

        // Delete old photo if it exists
        const existingUser = await getUserById(uid);
        if (existingUser?.photoURL) {
            const oldPath = extractStoragePath(existingUser.photoURL);
            if (oldPath) {
                await deleteFile(oldPath);
            }
        }

        // Upload new photo
        const ext = req.file.mimetype.split('/')[1] ?? 'jpg';
        const storagePath = `users/${uid}/profile.${ext}`;
        const photoURL = await uploadFile(req.file.buffer, req.file.mimetype, storagePath);

        const updated = await updateUser(uid, { photoURL });

        sendSuccess(res, { user: updated, photoURL }, 'Profile photo updated successfully');
    } catch (error) {
        const err = error as Error;
        console.error('updateProfilePhoto error:', err.message);
        sendError(res, 'Failed to upload photo', 500);
    }
};

/**
 * GET /api/users/:uid/public
 * Get any user's public profile (viewable by anyone)
 */
export const getPublicUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = req.params['uid'] as string;

        const profile = await getPublicProfile(uid);

        if (!profile) {
            sendError(res, 'User not found', 404);
            return;
        }

        sendSuccess(res, { profile }, 'Public profile fetched');
    } catch (error) {
        const err = error as Error;
        console.error('getPublicUserProfile error:', err.message);
        sendError(res, 'Failed to fetch profile', 500);
    }
};

/**
 * POST /api/users/me/push-token
 * Register an Expo push token for the authenticated user.
 */
export const registerPushTokenController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const { token } = req.body as { token?: string };
        if (!token || typeof token !== 'string') {
            sendError(res, 'Push token is required', 400);
            return;
        }

        await registerPushToken(req.user.uid, token);
        sendSuccess(res, null, 'Push token registered');
    } catch (error) {
        const err = error as Error;
        console.error('registerPushToken error:', err.message);
        sendError(res, err.message || 'Failed to register push token', 400);
    }
};

/**
 * POST /api/users/me/push-token/unregister
 * Unregister an Expo push token (e.g. on logout).
 */
export const unregisterPushTokenController = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const { token } = req.body as { token?: string };
        if (!token || typeof token !== 'string') {
            sendError(res, 'Push token is required', 400);
            return;
        }

        await unregisterPushToken(req.user.uid, token);
        sendSuccess(res, null, 'Push token unregistered');
    } catch (error) {
        const err = error as Error;
        console.error('unregisterPushToken error:', err.message);
        sendError(res, 'Failed to unregister push token', 500);
    }
};
