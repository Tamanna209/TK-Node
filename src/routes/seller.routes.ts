import { Router } from 'express';
import {
    requestSellerAccount,
    getMySellerRequest,
    getMySellerProfile,
    updateMySellerProfile,
    updateStorePhoto,
    getPublicSeller,
    getSellerQR,
    regenerateSellerQR,
} from '../controllers/seller.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireApprovedSeller } from '../middlewares/role.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import { validate, updateSellerSchema, uidParamSchema } from '../middlewares/validate.middleware';

const router = Router();

// ─── Protected Routes (require auth) ─────────────────────────────────────────

/** POST /api/sellers/request — Any authenticated user can request seller status */
router.post('/request', authenticate, requestSellerAccount);

/** GET /api/sellers/me/request — Check my seller request status */
router.get('/me/request', authenticate, getMySellerRequest);

/** GET /api/sellers/me — Get my seller store profile (must be approved seller) */
router.get('/me', authenticate, requireApprovedSeller, getMySellerProfile);

/** PUT /api/sellers/me — Update store info */
router.put('/me', authenticate, requireApprovedSeller, validate(updateSellerSchema), updateMySellerProfile);

/** PUT /api/sellers/me/photo — Upload store photo */
router.put('/me/photo', authenticate, requireApprovedSeller, uploadSingle('photo'), updateStorePhoto);

/** POST /api/sellers/me/qr/regenerate — Regenerate QR code */
router.post('/me/qr/regenerate', authenticate, requireApprovedSeller, regenerateSellerQR);

// ─── Public Routes ────────────────────────────────────────────────────────────

/** GET /api/sellers/:uid — Public seller profile (used when QR is scanned) */
router.get('/:uid', validate(uidParamSchema, 'params'), getPublicSeller);

/** GET /api/sellers/:uid/qr — Get/generate QR code for a seller */
router.get('/:uid/qr', validate(uidParamSchema, 'params'), getSellerQR);

export default router;
