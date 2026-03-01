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
