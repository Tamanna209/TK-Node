import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { UserRole } from '../types/user.types';

/**
 * Middleware factory: Require user to have one of the specified roles
 * Must be used AFTER authenticate middleware
 */
export const requireRole = (...roles: UserRole[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Unauthorized: Not authenticated',
                });
                return;
            }

            const userDoc = await db.collection('users').doc(req.user.uid).get();

            if (!userDoc.exists) {
                res.status(403).json({
                    success: false,
                    message: 'Forbidden: User not found',
                });
                return;
            }

            const userData = userDoc.data();
            const userRole = userData?.role as UserRole;

            if (!roles.includes(userRole)) {
                res.status(403).json({
                    success: false,
                    message: `Forbidden: Requires one of roles [${roles.join(', ')}]`,
                });
                return;
            }

            next();
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error checking permissions',
            });
        }
    };
};

/**
 * Middleware: Require seller account is approved
 * Must be used AFTER authenticate middleware
 */
export const requireApprovedSeller = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const userDoc = await db.collection('users').doc(req.user.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'seller') {
            res.status(403).json({
                success: false,
                message: 'Forbidden: Seller account required',
            });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error checking seller status' });
    }
};
