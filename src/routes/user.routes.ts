import { Router } from 'express';
import {
    getMyProfile,
    updateMyProfile,
    updateProfilePhoto,
    getPublicUserProfile,
    registerPushTokenController,
    unregisterPushTokenController,
} from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';
import { validate, updateUserSchema, uidParamSchema } from '../middlewares/validate.middleware';

const router = Router();

// ─── Protected Routes (require auth) ─────────────────────────────────────────

/** GET /api/users/me — Get own profile */
router.get('/me', authenticate, getMyProfile);

/** PUT /api/users/me — Update name / email */
router.put('/me', authenticate, validate(updateUserSchema), updateMyProfile);

/** PUT /api/users/me/photo — Upload profile photo */
router.put('/me/photo', authenticate, uploadSingle('photo'), updateProfilePhoto);

/** POST /api/users/me/push-token — Register Expo push token */
router.post('/me/push-token', authenticate, registerPushTokenController);

/** POST /api/users/me/push-token/unregister — Unregister Expo push token */
router.post('/me/push-token/unregister', authenticate, unregisterPushTokenController);

// ─── Public Routes ────────────────────────────────────────────────────────────

/** GET /api/users/:uid/public — Anyone can view public profile */
router.get('/:uid/public', validate(uidParamSchema, 'params'), getPublicUserProfile);

export default router;
