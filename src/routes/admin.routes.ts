import { Router, Request, Response, NextFunction } from 'express';
import {
    listSellerRequests,
    getSellerRequestDetails,
    approveSeller,
    rejectSeller,
    adminGetUser,
    bootstrapCreateAdmin,
    bootstrapCreateAdminByPhone,
    approveSellerTestMode,
    rejectSellerTestMode,
} from '../controllers/admin.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
    validate,
    rejectSellerSchema,
    uidParamSchema,
    createAdminSchema,
    createAdminByPhoneSchema,
} from '../middlewares/validate.middleware';

const router = Router();

const requireBootstrapKey = (req: Request, res: Response, next: NextFunction) => {
    const enabled = process.env.ADMIN_BOOTSTRAP_ENABLED === 'true';
    const key = process.env.ADMIN_BOOTSTRAP_KEY;
    const provided = req.headers['x-admin-bootstrap-key'];
    if (!enabled) {
        res.status(403).json({ success: false, message: 'Admin bootstrap is disabled' });
        return;
    }
    if (!key || provided !== key) {
        res.status(401).json({ success: false, message: 'Invalid bootstrap key' });
        return;
    }
    next();
};

const requireTestMode = (req: Request, res: Response, next: NextFunction) => {
    const enabled = process.env.ADMIN_TEST_MODE === 'true';
    const key = process.env.ADMIN_TEST_KEY;
    const provided = req.headers['x-admin-test-key'];
    if (!enabled) {
        res.status(403).json({ success: false, message: 'Admin test mode is disabled' });
        return;
    }
    if (key && provided !== key) {
        res.status(401).json({ success: false, message: 'Invalid test key' });
        return;
    }
    next();
};

/** POST /api/admin/bootstrap/create-admin — bootstrap first/future admin */
router.post('/bootstrap/create-admin', requireBootstrapKey, validate(createAdminSchema), bootstrapCreateAdmin);
router.post(
    '/bootstrap/create-admin-by-phone',
    requireBootstrapKey,
    validate(createAdminByPhoneSchema),
    bootstrapCreateAdminByPhone
);

/**
 * TEST MODE ONLY (no admin auth). Must set ADMIN_TEST_MODE=true.
 * Optional key hardening: ADMIN_TEST_KEY + x-admin-test-key header.
 */
router.get('/test/seller-requests', requireTestMode, listSellerRequests);
router.put('/test/seller-requests/:uid/approve', requireTestMode, validate(uidParamSchema, 'params'), approveSellerTestMode);
router.put(
    '/test/seller-requests/:uid/reject',
    requireTestMode,
    validate(uidParamSchema, 'params'),
    validate(rejectSellerSchema),
    rejectSellerTestMode
);

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

/** GET /api/admin/seller-requests — List requests (filter: ?status=pending|approved|rejected) */
router.get('/seller-requests', listSellerRequests);

/** GET /api/admin/seller-requests/:uid — Full details of a single request */
router.get('/seller-requests/:uid', validate(uidParamSchema, 'params'), getSellerRequestDetails);

/** PUT /api/admin/seller-requests/:uid/approve — Approve seller */
router.put('/seller-requests/:uid/approve', validate(uidParamSchema, 'params'), approveSeller);

/** PUT /api/admin/seller-requests/:uid/reject — Reject with reason */
router.put(
    '/seller-requests/:uid/reject',
    validate(uidParamSchema, 'params'),
    validate(rejectSellerSchema),
    rejectSeller
);

/** GET /api/admin/users/:uid — Admin view of any user profile */
router.get('/users/:uid', validate(uidParamSchema, 'params'), adminGetUser);

export default router;
