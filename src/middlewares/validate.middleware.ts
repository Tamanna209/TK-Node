import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

type ValidateTarget = 'body' | 'params' | 'query';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validate = (schema: z.ZodTypeAny, target: ValidateTarget = 'body') => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req[target]);

        if (!result.success) {
            // Zod v4 uses .issues, Zod v3 uses .errors — support both
            const rawIssues = result.error.issues ?? (result.error as unknown as { errors: z.ZodIssue[] }).errors ?? [];
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

// ─── Reusable Zod Schemas ─────────────────────────────────────────────────────

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

export const uidParamSchema = z.object({
    uid: z.string().min(1, 'UID is required'),
});

// ─── Product/Category Validation Schemas ─────────────────────────────────────


// INDUSTRY-LEVEL PRODUCT VALIDATION
const attributeSchema = z.object({
    key: z.string().min(1),
    value: z.string().min(1)
});

const imageSchema = z.object({
    url: z.string().url(),
    publicId: z.string().min(1),
    altText: z.string().optional(),
    order: z.number().optional()
});

const priceSchema = z.object({
    base: z.number().nonnegative(),
    sale: z.number().nonnegative().nullable().optional(),
    costPrice: z.number().nonnegative().nullable().optional(),
    saleStartDate: z.coerce.date().nullable().optional(),
    saleEndDate: z.coerce.date().nullable().optional()
});

const inventorySchema = z.object({
    quantity: z.number().nonnegative(),
    lowStockThreshold: z.number().nonnegative().optional(),
    trackInventory: z.boolean().optional()
});

const variantSchema = z.object({
    sku: z.string().min(1, 'SKU is required'),
    barcode: z.number(),
    attributes: z.array(attributeSchema),
    images: z.array(imageSchema).max(5).optional(),
    price: priceSchema,
    inventory: inventorySchema,
    isActive: z.boolean().optional()
});

const shippingSchema = z.object({
    weight: z.number().nonnegative().optional(),
    dimensions: z.object({
        length: z.number().nonnegative().optional(),
        width: z.number().nonnegative().optional(),
        height: z.number().nonnegative().optional()
    }).optional()
}).optional();

export const createProductSchema = z.object({
    name: z.string().min(1, 'Product name is required'),
    title: z.string().min(1, 'Product title is required'),
    description: z.string().optional(),
    brand: z.string().optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    category: z.string().min(1, 'Category is required'),
    shipping: shippingSchema,
    attributes: z.array(attributeSchema).optional(),
    variants: z.array(variantSchema).optional(),
    soldInfo: z.object({
        enabled: z.boolean().optional(),
        count: z.number().nonnegative().optional()
    }).optional(),
    fomo: z.object({
        enabled: z.boolean().optional(),
        type: z.enum(['viewing_now', 'product_left', 'custom']).optional(),
        viewingNow: z.number().nonnegative().optional(),
        productLeft: z.number().nonnegative().optional(),
        customMessage: z.string().optional()
    }).optional(),
    isFeatured: z.boolean().optional()
});

export const updateProductSchema = createProductSchema.partial();

export const createCategorySchema = z.object({
    name: z.string().min(1, 'Category name is required'),
});

export const updateCategorySchema = createCategorySchema.partial();
