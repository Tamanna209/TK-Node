import { Request, Response } from 'express';
import * as productService from '../services/product.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { Product, CreateProductDTO, UpdateProductDTO } from '../types/product.types';

/**
 * POST /api/products
 * Create a new product (seller must be authenticated & approved)
 */
export const createProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const sellerUid = req.user.uid;
        const data = req.body as CreateProductDTO;
        const product = await productService.createProduct(sellerUid, data);
        sendSuccess(res, { product }, 'Product created', 201);
    } catch (error) {
        const err = error as Error;
        console.error('createProduct error:', err.message);
        sendError(res, err.message || 'Failed to create product', 500);
    }
};

/**
 * PUT /api/products/:id
 * Update a product (seller owns it)
 */
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const sellerUid = req.user.uid;
        const id = req.params['id'] as string;
        const data = req.body as UpdateProductDTO;
        const updated = await productService.updateProduct(id, sellerUid, data);
        sendSuccess(res, { product: updated }, 'Product updated');
    } catch (error) {
        const err = error as Error;
        console.error('updateProduct error:', err.message);
        sendError(res, err.message || 'Failed to update product', 500);
    }
};

/**
 * DELETE /api/products/:id
 * Remove a product
 */
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const sellerUid = req.user.uid;
        const id = req.params['id'] as string;
        await productService.deleteProduct(id, sellerUid);
        sendSuccess(res, { id }, 'Product deleted');
    } catch (error) {
        const err = error as Error;
        console.error('deleteProduct error:', err.message);
        sendError(res, err.message || 'Failed to delete product', 500);
    }
};

/**
 * GET /api/products
 * List public (active) products
 */
export const listProducts = async (_req: Request, res: Response): Promise<void> => {
    try {
        const products = await productService.listPublicProducts();
        sendSuccess(res, { products, total: products.length }, 'Products fetched');
    } catch (error) {
        const err = error as Error;
        console.error('listProducts error:', err.message);
        sendError(res, 'Failed to fetch products', 500);
    }
};

/**
 * GET /api/products/:id
 * Get details of a single product (active or owner)
 */
export const getProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const identifier = req.params['id'] as string;
        // try slug first, then id
        let product = await productService.getProductBySlug(identifier);
        if (!product) {
            product = await productService.getProductById(identifier);
        }
        if (!product || product.status !== 'active') {
            sendError(res, 'Product not found', 404);
            return;
        }
        sendSuccess(res, { product }, 'Product fetched');
    } catch (error) {
        const err = error as Error;
        console.error('getProduct error:', err.message);
        sendError(res, 'Failed to fetch product', 500);
    }
};

/**
 * GET /api/products/seller/me
 * Get all products belonging to current seller
 */
export const listMyProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 'Unauthorized', 401);
            return;
        }
        const sellerUid = req.user.uid;
        const products = await productService.listProductsBySeller(sellerUid);
        sendSuccess(res, { products, total: products.length }, 'Seller products fetched');
    } catch (error) {
        const err = error as Error;
        console.error('listMyProducts error:', err.message);
        sendError(res, 'Failed to fetch seller products', 500);
    }
};


//product by fetch
const fetchBySlug=async(req :Request, res:Response)=>{
console.log("Products by slug")
}