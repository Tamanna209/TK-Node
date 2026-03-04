import { Router } from 'express';
import {
    createProduct,
    updateProduct,
    deleteProduct,
    listProducts,
    getProduct,
    listMyProducts,
} from '../controllers/product.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireApprovedSeller } from '../middlewares/role.middleware';
import { validate, uidParamSchema, createProductSchema, updateProductSchema } from '../middlewares/validate.middleware';

const router = Router();

// Public endpoints
router.get('/', listProducts); // list active products
router.get('/:id', validate(uidParamSchema, 'params'), getProduct);

// Seller-protected endpoints
router.post(
    '/',
    authenticate,
    requireApprovedSeller,
    validate(createProductSchema),
    createProduct
);
router.put(
    '/:id',
    authenticate,
    requireApprovedSeller,
    validate(uidParamSchema, 'params'),
    validate(updateProductSchema),
    updateProduct
);
router.delete(
    '/:id',
    authenticate,
    requireApprovedSeller,
    validate(uidParamSchema, 'params'),
    deleteProduct
);

// list seller products
router.get('/seller/me', authenticate, requireApprovedSeller, listMyProducts);

export default router;
