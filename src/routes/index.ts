import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import sellerRoutes from './seller.routes';
import adminRoutes from './admin.routes';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import chatRoutes from './chat.routes';

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
router.use('/products', productRoutes); // public + seller managed
router.use('/categories', categoryRoutes); // public read, admin manage
router.use('/admin', adminRoutes);
router.use('/chats', chatRoutes);

export default router;
