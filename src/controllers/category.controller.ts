import { Request, Response } from 'express';
import * as categoryService from '../services/category.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { CreateCategoryDTO, UpdateCategoryDTO, Category } from '../types/category.types';
import { db } from '../config/firebase';

/**
 * GET /api/categories
 * Public list of categories
 */
export const listCategories = async (_req: Request, res: Response): Promise<void> => {
    try {
        const q = String(_req.query['q'] || '').trim();
        const limitRaw = Number(_req.query['limit'] || 20);
        const limit = Number.isFinite(limitRaw)
            ? Math.max(1, Math.min(50, Math.floor(limitRaw)))
            : 20;

        const categories = q
            ? await categoryService.searchCategories(q, limit)
            : await categoryService.listCategories();
        sendSuccess(res, { categories, total: categories.length }, 'Categories fetched');
    } catch (error) {
        const err = error as Error;
        console.error('listCategories error:', err.message);
        sendError(res, 'Failed to fetch categories', 500);
    }
};

/**
 * POST /api/categories
 * Admin-only create
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = req.body as CreateCategoryDTO;
        const category = await categoryService.createCategory(data);
        sendSuccess(res, { category }, 'Category created', 201);
    } catch (error) {
        const err = error as Error;
        console.error('createCategory error:', err.message);
        sendError(res, err.message || 'Failed to create category', 500);
    }
};

/**
 * PUT /api/categories/:id
 * Admin-only update
 */
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params['id'] as string;
        const data = req.body as UpdateCategoryDTO;
        const updated = await categoryService.updateCategory(id, data);
        sendSuccess(res, { category: updated }, 'Category updated');
    } catch (error) {
        const err = error as Error;
        console.error('updateCategory error:', err.message);
        sendError(res, err.message || 'Failed to update category', 500);
    }
};

/**
 * DELETE /api/categories/:id
 * Admin-only delete
 */
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params['id'] as string;
        await categoryService.deleteCategory(id);
        sendSuccess(res, { id }, 'Category deleted');
    } catch (error) {
        const err = error as Error;
        console.error('deleteCategory error:', err.message);
        sendError(res, err.message || 'Failed to delete category', 500);
    }
};

/**
 * GET /api/categories/:id_or_slug
 * Fetch a single category by ID or slug (public)
 */
export const getCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const identifier = req.params['id'] as string;
        let category = await categoryService.getCategoryBySlug(identifier);
        if (!category) {
            // treat as id
            const snap = await db.collection('categories').doc(identifier).get();
            if (snap.exists) {
                category = { id: snap.id, ...snap.data() } as any;
            }
        }
        if (!category) {
            sendError(res, 'Category not found', 404);
            return;
        }
        sendSuccess(res, { category }, 'Category fetched');
    } catch (error) {
        const err = error as Error;
        console.error('getCategory error:', err.message);
        sendError(res, 'Failed to fetch category', 500);
    }
};

