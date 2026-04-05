import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../utils/response.util';
import { getDateRange } from './analytics-date-range.util';
import type { AnalyticsDateRange } from './analytics-date-range.util';
import {
    getSellerSummary,
    getSellerProductAnalytics,
    getSellerFunnel,
    getSellerTrends,
    getSellerInventoryAnalytics,
    getMissingDemand,
    recordBuyerProductRequest,
} from './analytics.service';

function resolveQuery(val: unknown): string | undefined {
    if (typeof val === 'string') return val;
    if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
    return undefined;
}

function parseDateRangeOr400(req: Request, res: Response): AnalyticsDateRange | null {
    try {
        return getDateRange(
            resolveQuery(req.query['range']),
            resolveQuery(req.query['startDate']),
            resolveQuery(req.query['endDate'])
        );
    } catch (e) {
        sendError(res, (e as Error).message, 400);
        return null;
    }
}

function sellerUid(req: Request): string | null {
    return req.user?.uid ?? null;
}

export const getSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = sellerUid(req);
        if (!uid) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const dr = parseDateRangeOr400(req, res);
        if (!dr) return;
        const data = await getSellerSummary(uid, dr);
        sendSuccess(res, data, 'Seller analytics summary');
    } catch (error) {
        const err = error as Error;
        console.error('analytics.getSummary:', err.message);
        sendError(res, err.message || 'Failed to load summary', 500);
    }
};

export const getProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = sellerUid(req);
        if (!uid) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const dr = parseDateRangeOr400(req, res);
        if (!dr) return;
        const data = await getSellerProductAnalytics(uid, dr);
        sendSuccess(res, data, 'Product analytics');
    } catch (error) {
        const err = error as Error;
        console.error('analytics.getProducts:', err.message);
        sendError(res, err.message || 'Failed to load product analytics', 500);
    }
};

export const getFunnel = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = sellerUid(req);
        if (!uid) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const dr = parseDateRangeOr400(req, res);
        if (!dr) return;
        const funnel = await getSellerFunnel(uid, dr);
        sendSuccess(res, funnel, 'Conversion funnel');
    } catch (error) {
        const err = error as Error;
        console.error('analytics.getFunnel:', err.message);
        sendError(res, err.message || 'Failed to load funnel', 500);
    }
};

export const getTrends = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = sellerUid(req);
        if (!uid) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const dr = parseDateRangeOr400(req, res);
        if (!dr) return;
        const trends = await getSellerTrends(uid, dr);
        sendSuccess(res, trends, 'Activity trends');
    } catch (error) {
        const err = error as Error;
        console.error('analytics.getTrends:', err.message);
        sendError(res, err.message || 'Failed to load trends', 500);
    }
};

export const getInventory = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = sellerUid(req);
        if (!uid) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const dr = parseDateRangeOr400(req, res);
        if (!dr) return;
        const inventory = await getSellerInventoryAnalytics(uid, dr);
        sendSuccess(res, inventory, 'Inventory analytics');
    } catch (error) {
        const err = error as Error;
        console.error('analytics.getInventory:', err.message);
        sendError(res, err.message || 'Failed to load inventory analytics', 500);
    }
};

export const getMissingDemandHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = sellerUid(req);
        if (!uid) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const dr = parseDateRangeOr400(req, res);
        if (!dr) return;
        const data = await getMissingDemand(uid, dr);
        sendSuccess(res, data, 'Missing demand signals');
    } catch (error) {
        const err = error as Error;
        console.error('analytics.getMissingDemand:', err.message);
        sendError(res, err.message || 'Failed to load missing demand', 500);
    }
};

/** POST /api/analytics/events/product-request — buyer creates a product request (tracks request_created). */
export const postProductRequest = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const { productId, keywords, note } = req.body as {
            productId: string;
            keywords?: string[];
            note?: string;
        };
        await recordBuyerProductRequest(req.user.uid, { productId, keywords, note });
        sendSuccess(res, { ok: true }, 'Request recorded', 201);
    } catch (error) {
        const err = error as Error;
        if (err.message === 'Product not found') {
            sendError(res, err.message, 404);
            return;
        }
        if (err.message.includes('own product')) {
            sendError(res, err.message, 400);
            return;
        }
        console.error('analytics.postProductRequest:', err.message);
        sendError(res, err.message || 'Failed to record request', 500);
    }
};
