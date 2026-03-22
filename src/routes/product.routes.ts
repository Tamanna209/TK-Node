// import { Router } from 'express';
// import * as productController from '../controllers/product.controller';

// import { authenticate } from '../middlewares/auth.middleware';
// import { requireApprovedSeller } from '../middlewares/role.middleware';
// import { uploadAny } from '../middlewares/upload.middleware';

// import {
//     validate,
//     uidParamSchema,
//     createProductSchema,
//     updateProductSchema,
// } from '../middlewares/validate.middleware';

// const router = Router();

// /**
//  * 🔥 PUBLIC
//  */
// router.get('/', productController.listProducts);

// router.get(
//     '/:id',
//     validate(uidParamSchema, 'params'),
//     productController.getProduct
// );

// /**
//  * 🔥 SELLER PRODUCT
//  */
// router.post(
//     '/',
//     authenticate,
//     requireApprovedSeller,
//     uploadAny(),
//     validate(createProductSchema),
//     productController.createProduct
// );

// router.put(
//     '/:id',
//     authenticate,
//     requireApprovedSeller,
//     uploadAny(),
//     validate(uidParamSchema, 'params'),
//     validate(updateProductSchema),
//     productController.updateProduct
// );

// /**
//  * 🔥 VARIANT ROUTES (VERY IMPORTANT 🔥)
//  */

// // ➕ Add Variant
// router.post(
//     '/:id/variant',
//     authenticate,
//     requireApprovedSeller,
//     uploadAny(),
//     productController.addVariant
// );

// // ✏️ Update Variant
// router.put(
//     '/:id/variant/:sku',
//     authenticate,
//     requireApprovedSeller,
//     uploadAny(),
//     productController.updateVariant
// );

// // ❌ Delete Variant
// router.delete(
//     '/:id/variant/:sku',
//     authenticate,
//     requireApprovedSeller,
//     productController.deleteVariant
// );

// // // 🔍 Get Single Variant
// // router.get(
// //     '/:id/variant/:sku',
// //     productController.getVariant
// // );

// /**
//  * 🔥 SOFT DELETE / RESTORE
//  */
// router.patch(
//     '/:id/archive',
//     authenticate,
//     requireApprovedSeller,
//     productController.archiveProduct
// );

// router.patch(
//     '/:id/restore',
//     authenticate,
//     requireApprovedSeller,
//     productController.restoreProduct
// );

// /**
//  * 🔥 HARD DELETE
//  */
// router.delete(
//     '/:id',
//     authenticate,
//     requireApprovedSeller,
//     validate(uidParamSchema, 'params'),
//     productController.deleteProduct
// );

// /**
//  * 🔥 SELLER PRODUCTS
//  */
// router.get(
//     '/seller/me',
//     authenticate,
//     requireApprovedSeller,
//     productController.listMyProducts
// );

// export default router;





import { Router } from 'express';
import * as productController from '../controllers/product.controller';

import { authenticate } from '../middlewares/auth.middleware';
import { requireApprovedSeller } from '../middlewares/role.middleware';
import { uploadAny } from '../middlewares/upload.middleware';

import {
    validate,
    idParamSchema,        // ✅ naya
    createProductSchema,
    updateProductSchema,
} from '../middlewares/validate.middleware';

const router = Router();

// ─────────────────────────────────────────
// 🔥 PUBLIC
// ─────────────────────────────────────────

router.get('/', productController.listProducts);

// ─────────────────────────────────────────
// 🔥 SELLER ROUTES
// ⚠️ /seller/me MUST be before /:id
// ─────────────────────────────────────────

router.get(
    '/seller/me',
    authenticate,
    requireApprovedSeller,
    productController.listMyProducts
);

// ─────────────────────────────────────────
// 🔥 PRODUCT CRUD
// ─────────────────────────────────────────

router.get(
    '/:id',
    validate(idParamSchema, 'params'),   // ✅ idParamSchema
    productController.getProduct
);

router.post(
    '/',
    authenticate,
    requireApprovedSeller,
    uploadAny(),
    validate(createProductSchema),
    productController.createProduct
);

router.put(
    '/:id',
    authenticate,
    requireApprovedSeller,
    uploadAny(),
    validate(idParamSchema, 'params'),   // ✅ idParamSchema
    validate(updateProductSchema),
    productController.updateProduct
);

router.delete(
    '/:id',
    authenticate,
    requireApprovedSeller,
    validate(idParamSchema, 'params'),   // ✅ idParamSchema
    productController.deleteProduct
);

// ─────────────────────────────────────────
// 🔥 VARIANT ROUTES
// ─────────────────────────────────────────

router.post(
    '/:id/variant',
    authenticate,
    requireApprovedSeller,
    uploadAny(),
    productController.addVariant
);

router.put(
    '/:id/variant/:sku',
    authenticate,
    requireApprovedSeller,
    uploadAny(),
    productController.updateVariant
);

router.delete(
    '/:id/variant/:sku',
    authenticate,
    requireApprovedSeller,
    productController.deleteVariant
);

// ─────────────────────────────────────────
// 🔥 ARCHIVE / RESTORE
// ─────────────────────────────────────────

router.patch(
    '/:id/archive',
    authenticate,
    requireApprovedSeller,
    productController.archiveProduct
);

router.patch(
    '/:id/restore',
    authenticate,
    requireApprovedSeller,
    productController.restoreProduct
);

export default router;