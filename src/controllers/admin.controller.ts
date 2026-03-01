import { Request, Response } from 'express';
import {
    getAllSellerRequests,
    approveSellerRequest,
    rejectSellerRequest,
    getSellerRequest,
} from '../services/seller.service';
import { getUserById } from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response.util';

/**
 * GET /api/admin/seller-requests
 * List all seller requests (optionally filtered by status)
 * Query param: ?status=pending|approved|rejected
 */
export const listSellerRequests = async (req: Request, res: Response): Promise<void> => {
    try {
        const status = req.query['status'] as 'pending' | 'approved' | 'rejected' | undefined;
        const validStatuses = ['pending', 'approved', 'rejected'];

        if (status && !validStatuses.includes(status)) {
            sendError(res, 'Invalid status filter. Use: pending, approved, or rejected', 400);
            return;
        }

        const requests = await getAllSellerRequests(status);

        // Enrich with user info
        const enriched = await Promise.all(
            requests.map(async (r) => {
                const user = await getUserById(r.uid);
                return {
                    ...r,
                    user: user
                        ? { name: user.name, phoneNumber: user.phoneNumber, photoURL: user.photoURL }
                        : null,
                };
            })
        );

        sendSuccess(res, { requests: enriched, total: enriched.length }, 'Seller requests fetched');
    } catch (error) {
        const err = error as Error;
        console.error('listSellerRequests error:', err.message);
        sendError(res, 'Failed to fetch seller requests', 500);
    }
};

/**
 * GET /api/admin/seller-requests/:uid
 * Get details of a single seller request
 */
export const getSellerRequestDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = req.params['uid'] as string;

        const [request, user] = await Promise.all([getSellerRequest(uid), getUserById(uid)]);

        if (!request) {
            sendError(res, 'Seller request not found', 404);
            return;
        }

        sendSuccess(
            res,
            {
                request,
                user: user
                    ? { name: user.name, phoneNumber: user.phoneNumber, photoURL: user.photoURL }
                    : null,
            },
            'Seller request details fetched'
        );
    } catch (error) {
        const err = error as Error;
        console.error('getSellerRequestDetails error:', err.message);
        sendError(res, 'Failed to fetch seller request', 500);
    }
};

/**
 * PUT /api/admin/seller-requests/:uid/approve
 * Approve a seller request
 */
export const approveSeller = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const uid = req.params['uid'] as string;

        const request = await getSellerRequest(uid);
        if (!request) {
            sendError(res, 'Seller request not found', 404);
            return;
        }

        if (request.status !== 'pending') {
            sendError(res, `Cannot approve a request with status: ${request.status}`, 409);
            return;
        }

        await approveSellerRequest(uid, req.user.uid);

        sendSuccess(res, { uid }, 'Seller request approved. User is now a seller.');
    } catch (error) {
        const err = error as Error;
        console.error('approveSeller error:', err.message);
        sendError(res, 'Failed to approve seller request', 500);
    }
};

/**
 * PUT /api/admin/seller-requests/:uid/reject
 * Reject a seller request with an optional reason
 */
export const rejectSeller = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }

        const uid = req.params['uid'] as string;
        const { reason } = req.body as { reason: string };

        const request = await getSellerRequest(uid);
        if (!request) {
            sendError(res, 'Seller request not found', 404);
            return;
        }

        if (request.status !== 'pending') {
            sendError(res, `Cannot reject a request with status: ${request.status}`, 409);
            return;
        }

        await rejectSellerRequest(uid, req.user.uid, reason);

        sendSuccess(res, { uid }, 'Seller request rejected.');
    } catch (error) {
        const err = error as Error;
        console.error('rejectSeller error:', err.message);
        sendError(res, 'Failed to reject seller request', 500);
    }
};

/**
 * GET /api/admin/users/:uid
 * Get full user profile (admin can see all details)
 */
export const adminGetUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = req.params['uid'] as string;
        const user = await getUserById(uid);

        if (!user) {
            sendError(res, 'User not found', 404);
            return;
        }

        sendSuccess(res, { user }, 'User profile fetched');
    } catch (error) {
        const err = error as Error;
        console.error('adminGetUser error:', err.message);
        sendError(res, 'Failed to fetch user', 500);
    }
};
