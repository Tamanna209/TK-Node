

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

type ValidateTarget = 'body' | 'params' | 'query';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// export const validate = (schema: z.ZodTypeAny, target: ValidateTarget = 'body') => {
//     return (req: Request, res: Response, next: NextFunction): void => {
//         const result = schema.safeParse(req[target]);

//         if (!result.success) {
//             const rawIssues =
//                 result.error.issues ??
//                 (result.error as unknown as { errors: z.ZodIssue[] }).errors ??
//                 [];

//             const errors = rawIssues.map((e: z.ZodIssue) => ({
//                 field: e.path.join('.'),
//                 message: e.message,
//             }));

//             res.status(400).json({
//                 success: false,
//                 message: 'Validation failed',
//                 errors,
//             });
//             return;
//         }

//         req[target] = result.data;
//         next();
//     };
// };
export const validate = (schema: z.ZodTypeAny, target: ValidateTarget = 'body') => {
    return (req: Request, res: Response, next: NextFunction): void => {

        // 🔥 ADD THIS BLOCK HERE (VERY IMPORTANT)
        const tryParseJSON = (value: any) => {
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            }
            return value;
        };

        // 🔥 APPLY ONLY FOR BODY
        if (target === 'body') {
            const fieldsToParse = ['variants', 'shipping', 'attributes', 'soldInfo', 'fomo'];

            for (const field of fieldsToParse) {
                if (req.body[field]) {
                    req.body[field] = tryParseJSON(req.body[field]);
                }
            }
        }

        // ✅ NOW VALIDATE (AFTER PARSE)
        const result = schema.safeParse(req[target]);

        if (!result.success) {
            const rawIssues =
                result.error.issues ??
                (result.error as unknown as { errors: z.ZodIssue[] }).errors ??
                [];

            const errors = rawIssues.map((e: z.ZodIssue) => ({
                field: e.path.join('.'),
                message: e.message,
            }));

            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors,
            });
            return;
        }

        req[target] = result.data;
        next();
    };
};

// ─── USER SCHEMAS ─────────────────────────────────────────

export const updateUserSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50).optional(),
    email: z.string().email('Invalid email address').optional(),
});

export const updateSellerSchema = z.object({
    storeName: z.string().min(2).max(100).optional(),
    storeDescription: z.string().max(500).optional(),
    storeAddress: z.string().max(300).optional(),
});

export const rejectSellerSchema = z.object({
    reason: z.string().min(5, 'Rejection reason must be at least 5 characters').max(300),
});

export const createAdminSchema = z.object({
    uid: z.string().min(1, 'UID is required'),
});

export const createAdminByPhoneSchema = z.object({
    phoneNumber: z.string().min(7, 'Phone number is required'),
});

export const uidParamSchema = z.object({
    uid: z.string().min(1, 'UID is required'),
});

export const idParamSchema = z.object({
    id: z.string().min(1, 'Product ID is required'),
});
// ─── PRODUCT SCHEMAS (FIXED) ─────────────────────────────

// 🔹 Common
const attributeSchema = z.object({
    key: z.string().min(1),
    value: z.string().min(1),
});

const imageSchema = z.object({
    url: z.string().url(),
    publicId: z.string().min(1),
    altText: z.string().optional(),
    order: z.number().optional(),
});

// 🔹 Price
const priceSchema = z.object({
    base: z.number().nonnegative(),

    sale: z.number().nonnegative().nullable().optional(),
    costPrice: z.number().nonnegative().nullable().optional(),

    // ✅ auto convert string → Date
    saleStartDate: z.coerce.date().nullable().optional(),
    saleEndDate: z.coerce.date().nullable().optional(),
});

// 🔹 Inventory
const inventorySchema = z.object({
    quantity: z.number().nonnegative(),

    lowStockThreshold: z.number().nonnegative().optional(),
    trackInventory: z.boolean().default(true),
    allowBackorder: z.boolean().optional(),
});

// 🔹 Variant (🔥 FIXED)
const variantSchema = z.object({
    // ❌ SKU removed (auto-generated in service)

    // ✅ optional
    barcode: z.string().optional(),

    attributes: z.array(attributeSchema).default([]),

    images: z.array(imageSchema).max(5).optional(),

    price: priceSchema,

    inventory: inventorySchema,

    isActive: z.boolean().optional(),
});

// 🔹 Shipping
const shippingSchema = z
    .object({
        weight: z.number().nonnegative().optional(),
        dimensions: z
            .object({
                length: z.number().nonnegative().optional(),
                width: z.number().nonnegative().optional(),
                height: z.number().nonnegative().optional(),
            })
            .optional(),
    })
    .optional();

// 🔥 CREATE PRODUCT (FINAL FIXED)
export const createProductSchema = z.object({
    name: z.string().min(1, 'Product name is required'),
    title: z.string().min(1, 'Product title is required'),

    description: z.string().optional(),
    brand: z.string().optional(),

    status: z.enum(['draft', 'active', 'archived']).optional(),

    // ✅ FIXED (IMPORTANT)
    categoryId: z.string().min(1, 'Category is required'),

    shipping: shippingSchema,

    attributes: z.array(attributeSchema).optional(),

    // ✅ REQUIRED
    variants: z.array(variantSchema).min(1, 'At least one variant required'),

    soldInfo: z
        .object({
            enabled: z.boolean().optional(),
            count: z.number().nonnegative().optional(),
        })
        .optional(),

    // ✅ FIXED FOMO
    fomo: z
        .object({
            enabled: z.boolean().optional(),
            type: z.enum(['viewing_now', 'product_left', 'custom']).optional(),
            value: z.number().optional(),
            customMessage: z.string().optional(),
        })
        .optional(),

    isFeatured: z.boolean().optional(),
});

// 🔹 UPDATE PRODUCT
export const updateProductSchema = createProductSchema.partial();

// ─── CATEGORY ────────────────────────────────────────────

export const createCategorySchema = z.object({
    name: z.string().min(1, 'Category name is required'),
});

export const updateCategorySchema = createCategorySchema.partial();