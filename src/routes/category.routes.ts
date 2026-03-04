import { Router } from 'express';
import {
    listCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
} from '../controllers/category.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { validate, uidParamSchema, createCategorySchema, updateCategorySchema } from '../middlewares/validate.middleware';

const router = Router();

// public read-only
router.get('/', listCategories);
router.get('/:id', validate(uidParamSchema, 'params'), getCategory);

// admin-only management
router.post('/', authenticate, requireRole('admin'), validate(createCategorySchema), createCategory);
router.put(
    '/:id',
    authenticate,
    requireRole('admin'),
    validate(uidParamSchema, 'params'),
    validate(updateCategorySchema),
    updateCategory
);
router.delete(
    '/:id',
    authenticate,
    requireRole('admin'),
    validate(uidParamSchema, 'params'),
    deleteCategory
);

export default router;