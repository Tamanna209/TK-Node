import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireApprovedSeller } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
    getSummary,
    getProducts,
    getFunnel,
    getTrends,
    getInventory,
    getMissingDemandHandler,
    postProductRequest,
} from './analytics.controller';

const router = Router();

const productRequestBodySchema = z.object({
    productId: z.string().min(1),
    keywords: z.array(z.string()).optional(),
    note: z.string().max(2000).optional(),
});

/** Buyer-authenticated: records request + analytics (does not require seller role). */
router.post(
    '/events/product-request',
    authenticate,
    validate(productRequestBodySchema),
    postProductRequest
);

const sellerRouter = Router();
sellerRouter.use(authenticate, requireApprovedSeller);

sellerRouter.get('/summary', getSummary);
sellerRouter.get('/products', getProducts);
sellerRouter.get('/funnel', getFunnel);
sellerRouter.get('/trends', getTrends);
sellerRouter.get('/inventory', getInventory);
sellerRouter.get('/missing-demand', getMissingDemandHandler);

router.use('/seller', sellerRouter);

export default router;
