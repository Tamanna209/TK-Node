import * as admin from 'firebase-admin';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';
import {
    Product,
    CreateProductDTO,
    UpdateProductDTO,
    Variant,
    ProductStatus,
} from '../types/product.types';
import { generateSlug } from '../utils/slug.util';

const PRODUCTS_COLLECTION = 'products';


/**
 * Normalize variant data and ensure at least one valid variant exists.
 * Enforces max 5 images per variant and required fields.
 */
const normalizeVariants = (data: Partial<Variant>[] | undefined): Variant[] => {
    if (data && data.length > 0) {
        return data.map((v, idx) => {
            if (!v.sku) throw new Error(`Variant at index ${idx} missing SKU`);
            if (!v.barcode) throw new Error(`Variant at index ${idx} missing barcode`);
            if (!v.price || typeof v.price.base !== 'number') throw new Error(`Variant at index ${idx} missing base price`);
            return {
                sku: v.sku,
                barcode: v.barcode,
                attributes: v.attributes || [],
                images: (v.images || []).slice(0, 5),
                price: {
                    base: v.price.base,
                    sale: v.price.sale ?? null,
                    costPrice: v.price.costPrice ?? null,
                    saleStartDate: v.price.saleStartDate ?? null,
                    saleEndDate: v.price.saleEndDate ?? null,
                },
                inventory: {
                    quantity: v.inventory?.quantity ?? 0,
                    lowStockThreshold: v.inventory?.lowStockThreshold ?? 5,
                    trackInventory: v.inventory?.trackInventory ?? true,
                },
                isActive: v.isActive ?? true,
            };
        });
    }
    // Default single variant if none provided
    return [
        {
            sku: uuidv4(),
            barcode: Math.floor(Math.random() * 1e12),
            attributes: [],
            images: [],
            price: { base: 0 },
            inventory: { quantity: 0, lowStockThreshold: 5, trackInventory: true },
            isActive: true,
        },
    ];
};

/**
 * Create a product document for a given seller
 */

export const createProduct = async (
    sellerUid: string,
    data: CreateProductDTO
): Promise<Product> => {
    const now = new Date();
    const slug = generateSlug(data.name);

    const productData: Partial<Product> = {
        sellerUid,
        slug,
        name: data.name,
        title: data.title,
        description: data.description || '',
        brand: data.brand || 'Generic',
        status: data.status || 'draft',
        category: data.category,
        shipping: data.shipping,
        attributes: data.attributes || [],
        variants: normalizeVariants(data.variants),
        soldInfo: {
            enabled: data.soldInfo?.enabled ?? false,
            count: data.soldInfo?.count ?? 0
        },
        fomo: {
            enabled: data.fomo?.enabled ?? false,
            type: data.fomo?.type ?? 'viewing_now',
            viewingNow: data.fomo?.viewingNow,
            productLeft: data.fomo?.productLeft,
            customMessage: data.fomo?.customMessage
        },
        isFeatured: data.isFeatured ?? false,
        createdAt: now,
        updatedAt: now,
    };

    const ref = await db.collection(PRODUCTS_COLLECTION).add(productData);
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() } as Product;
};

/**
 * Update an existing product (seller must own it)
 */

export const updateProduct = async (
    productId: string,
    sellerUid: string,
    data: UpdateProductDTO
): Promise<Product> => {
    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    const existing = await docRef.get();
    if (!existing.exists) {
        throw new Error('Product not found');
    }
    const prod = existing.data() as Product;
    if (prod.sellerUid !== sellerUid) {
        throw new Error('Not authorized to modify this product');
    }

    const now = new Date();
    const updateData: any = { ...data, updatedAt: now };
    if (data.name && data.name !== prod.name) {
        updateData.slug = generateSlug(data.name);
    }
    if (data.variants) {
        updateData.variants = normalizeVariants(data.variants);
    }
    if (data.attributes) {
        updateData.attributes = data.attributes;
    }

    await docRef.update(updateData);
    const updatedSnap = await docRef.get();
    return { id: updatedSnap.id, ...updatedSnap.data() } as Product;
};

/**
 * Delete a product (seller must own it)
 */
export const deleteProduct = async (productId: string, sellerUid: string): Promise<void> => {
    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    const existing = await docRef.get();
    if (!existing.exists) {
        throw new Error('Product not found');
    }
    const prod = existing.data() as Product;
    if (prod.sellerUid !== sellerUid) {
        throw new Error('Not authorized to delete this product');
    }

    await docRef.delete();
};

/**
 * Fetch a single product by id (optionally only active)
 */
export const getProductById = async (productId: string): Promise<Product | null> => {
    const doc = await db.collection(PRODUCTS_COLLECTION).doc(productId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Product;
};

/**
 * Fetch a product by slug
 */
export const getProductBySlug = async (slug: string): Promise<Product | null> => {
    const snapshot = await db
        .collection(PRODUCTS_COLLECTION)
        .where('slug', '==', slug)
        .limit(1)
        .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Product;
};


/**
 * List public products (active only)
 */
export const listPublicProducts = async (): Promise<Product[]> => {
    const snapshot = await db
        .collection(PRODUCTS_COLLECTION)
        .where('status', '==', 'active')
        .get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
};

/**
 * List products belonging to a seller (any status)
 */
export const listProductsBySeller = async (sellerUid: string): Promise<Product[]> => {
    const snapshot = await db
        .collection(PRODUCTS_COLLECTION)
        .where('sellerUid', '==', sellerUid)
        .get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
};
