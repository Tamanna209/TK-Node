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
 * Helper to normalise variant data and ensure at least one variant exists.
 */
const normalizeVariants = (data: Partial<Variant>[] | undefined, inventory: { quantity: number; lowThreshold: number }) => {
    if (data && data.length > 0) {
        return data.map((v) => {
            return {
                sku: v.sku || uuidv4(),
                attributes: v.attributes || {},
                images: v.images || [],
                inventory: {
                    quantity: v.inventory?.quantity ?? inventory.quantity,
                    lowThreshold: v.inventory?.lowThreshold ?? inventory.lowThreshold,
                },
            } as Variant;
        });
    }

    // default single variant
    return [
        {
            sku: uuidv4(),
            attributes: {},
            images: [],
            inventory: {
                quantity: inventory.quantity,
                lowThreshold: inventory.lowThreshold,
            },
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
    const now = admin.firestore.FieldValue.serverTimestamp();

    const inventory = {
        quantity: data.inventory?.quantity ?? 0,
        lowThreshold: data.inventory?.lowThreshold ?? 5,
    };

    const slug = generateSlug(data.name);

    const productData: Partial<Product> = {
        sellerUid,
        slug,
        name: data.name,
        title: data.title || '',
        description: data.description || '',
        brand: data.brand || 'Generic',
        status: data.status || 'inactive',
        category: data.category,
        shipping: data.shipping,
        inventory,
        attributes: data.attributes || {},
        variants: normalizeVariants(data.variants, inventory),
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

    const now = admin.firestore.FieldValue.serverTimestamp();

    const updateData: any = { ...data, updatedAt: now };
    if (data.name && data.name !== prod.name) {
        updateData.slug = generateSlug(data.name);
    }

    // if inventory or variants changed we might want to normalise again
    if (data.inventory) {
        updateData.inventory = {
            quantity: data.inventory.quantity,
            lowThreshold: data.inventory.lowThreshold ?? prod.inventory.lowThreshold,
        };
    }
    if (data.variants) {
        updateData.variants = normalizeVariants(data.variants, {
            quantity: updateData.inventory?.quantity ?? prod.inventory.quantity,
            lowThreshold: updateData.inventory?.lowThreshold ?? prod.inventory.lowThreshold,
        });
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
