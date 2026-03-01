import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import sellerRoutes from './seller.routes';
import adminRoutes from './admin.routes';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'TK App API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});

// Mount feature routers
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/sellers', sellerRoutes);
router.use('/admin', adminRoutes);

export default router;
