import { Router } from 'express';
import {
    listSellerRequests,
    getSellerRequestDetails,
    approveSeller,
    rejectSeller,
    adminGetUser,
} from '../controllers/admin.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate, rejectSellerSchema, uidParamSchema } from '../middlewares/validate.middleware';

const router = Router();

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
