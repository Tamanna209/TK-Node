import { Request, Response } from 'express';
import { auth as firebaseAuth } from '../config/firebase';
import {
    getAllSellerRequests,
    approveSellerRequest,
    rejectSellerRequest,
    getSellerRequest,
} from '../services/seller.service';
import { createUser, getUserById, updateUserRole, normalizePhone } from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response.util';

const phoneCandidates = (input: string): string[] => {
    const raw = (input || '').trim();
    const digits = raw.replace(/\D/g, '');
    const set = new Set<string>();
    const normalized = normalizePhone(raw);
    if (normalized) set.add(normalized);
    if (digits.length === 10) {
        set.add(`+91${digits}`);
    }
    if (digits.length > 10 && !digits.startsWith('91')) {
        set.add(`+${digits}`);
    }
    return Array.from(set);
};

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
 * POST /api/admin/bootstrap/create-admin
 * Create/promote an admin user by UID (bootstrap utility, key-gated in route).
 */
export const bootstrapCreateAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { uid } = req.body as { uid: string };
        const user = await getUserById(uid);

        if (!user) {
            sendError(res, 'User not found', 404);
            return;
        }

        await updateUserRole(uid, 'admin');
        sendSuccess(res, { uid, role: 'admin' }, 'Admin user created/promoted');
    } catch (error) {
        const err = error as Error;
        console.error('bootstrapCreateAdmin error:', err.message);
        sendError(res, 'Failed to create admin user', 500);
    }
};

/**
 * POST /api/admin/bootstrap/create-admin-by-phone
 * Create/promote admin by phone number.
 */
export const bootstrapCreateAdminByPhone = async (req: Request, res: Response): Promise<void> => {
    try {
        const { phoneNumber } = req.body as { phoneNumber: string };
        const candidates = phoneCandidates(phoneNumber);
        if (candidates.length === 0) {
            sendError(res, 'Invalid phone number', 400);
            return;
        }

        let authUser: { uid: string; phoneNumber?: string } | null = null;
        for (const candidate of candidates) {
            try {
                const found = await firebaseAuth.getUserByPhoneNumber(candidate);
                authUser = { uid: found.uid, phoneNumber: found.phoneNumber || candidate };
                break;
            } catch {
                // try next candidate
            }
        }

        if (!authUser) {
            sendError(
                res,
                `Firebase Auth user not found for phone ${phoneNumber}. Ask user to login once with OTP first.`,
                404
            );
            return;
        }

        let user = await getUserById(authUser.uid);
        if (!user) {
            user = await createUser({ uid: authUser.uid, phoneNumber: authUser.phoneNumber || phoneNumber });
        }

        await updateUserRole(user.uid, 'admin');
        sendSuccess(
            res,
            { uid: user.uid, phoneNumber: user.phoneNumber, phoneE164: normalizePhone(user.phoneNumber), role: 'admin' },
            'Admin user created/promoted by phone'
        );
    } catch (error) {
        const err = error as Error;
        console.error('bootstrapCreateAdminByPhone error:', err.message);
        sendError(res, 'Failed to create admin user by phone', 500);
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
 * Test-mode only: approve seller without admin auth.
 * Route-level guard enforces env + test key.
 */
export const approveSellerTestMode = async (req: Request, res: Response): Promise<void> => {
    try {
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

        await approveSellerRequest(uid, 'test-admin');
        sendSuccess(res, { uid, reviewedBy: 'test-admin' }, 'Seller request approved (test mode).');
    } catch (error) {
        const err = error as Error;
        console.error('approveSellerTestMode error:', err.message);
        sendError(res, 'Failed to approve seller request', 500);
    }
};

/**
 * Test-mode only: reject seller without admin auth.
 * Route-level guard enforces env + test key.
 */
export const rejectSellerTestMode = async (req: Request, res: Response): Promise<void> => {
    try {
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

        await rejectSellerRequest(uid, 'test-admin', reason);
        sendSuccess(res, { uid, reviewedBy: 'test-admin' }, 'Seller request rejected (test mode).');
    } catch (error) {
        const err = error as Error;
        console.error('rejectSellerTestMode error:', err.message);
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
