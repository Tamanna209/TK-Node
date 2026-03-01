import { Router } from 'express';
import { verifyToken } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/**
 * POST /api/auth/verify-token
 * Mobile sends Firebase ID token after OTP verification
 * Backend verifies token → creates or fetches Firestore user
 */
router.post('/verify-token', authenticate, verifyToken);

export default router;
