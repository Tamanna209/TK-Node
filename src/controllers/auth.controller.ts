import { Request, Response } from 'express';
import { getOrCreateUser } from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response.util';

/**
 * POST /api/auth/verify-token
 *
 * Mobile app sends the Firebase ID Token after the user completes OTP verification.
 * Backend verifies the token (via auth middleware), then creates or fetches the user.
 *
 * On first login: creates user in Firestore with role=buyer
 * On subsequent logins: returns existing user profile
 */
export const verifyToken = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const { uid, phoneNumber } = req.user;

        const { user, isNew } = await getOrCreateUser(uid, phoneNumber);

        sendSuccess(
            res,
            { user, isNew },
            isNew ? 'Account created successfully' : 'Login successful',
            isNew ? 201 : 200
        );
    } catch (error) {
        const err = error as Error & { statusCode?: number };
        console.error('verifyToken error:', err.message);
        if (err.statusCode === 409) {
            sendError(res, err.message, 409);
            return;
        }
        sendError(res, 'Authentication failed', 500, err.message);
    }
};
