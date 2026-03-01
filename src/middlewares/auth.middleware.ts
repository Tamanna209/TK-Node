import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';

// Extend Express Request to include user info from Firebase token
declare global {
    namespace Express {
        interface Request {
            user?: {
                uid: string;
                phoneNumber: string;
                email?: string;
            };
        }
    }
}

/**
 * Middleware: Verify Firebase ID Token
 * Reads "Authorization: Bearer <idToken>" header,
 * verifies with Firebase Admin SDK and attaches decoded user to req.user
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: No token provided',
            });
            return;
        }

        const idToken = authHeader.split('Bearer ')[1];

        if (!idToken) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Invalid token format',
            });
            return;
        }

        const decodedToken = await auth.verifyIdToken(idToken);

        req.user = {
            uid: decodedToken.uid,
            phoneNumber: decodedToken.phone_number || '',
            email: decodedToken.email,
        };

        next();
    } catch (error: unknown) {
        const err = error as Error;
        if (err.message?.includes('token') || err.message?.includes('expired')) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Token expired or invalid',
                error: err.message,
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Unauthorized: Authentication failed',
            });
        }
    }
};
