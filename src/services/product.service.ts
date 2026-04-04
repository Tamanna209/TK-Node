// import * as admin from 'firebase-admin';
// import { db } from '../config/firebase';
// import { v4 as uuidv4 } from 'uuid';
// import {
//     Product,
//     CreateProductDTO,
//     UpdateProductDTO,
//     Variant,
//     ProductStatus,
// } from '../types/product.types';
// import { generateSlug } from '../utils/slug.util';

// const PRODUCTS_COLLECTION = 'products';


// /**
//  * Normalize variant data and ensure at least one valid variant exists.
//  * Enforces max 5 images per variant and required fields.
//  */
// const normalizeVariants = (data: Partial<Variant>[] | undefined): Variant[] => {
//     if (data && data.length > 0) {
//         return data.map((v, idx) => {
//             if (!v.sku) throw new Error(`Variant at index ${idx} missing SKU`);
//             if (!v.barcode) throw new Error(`Variant at index ${idx} missing barcode`);
//             if (!v.price || typeof v.price.base !== 'number') throw new Error(`Variant at index ${idx} missing base price`);
//             return {
//                 sku: v.sku,
//                 barcode: v.barcode,
//                 attributes: v.attributes || [],
//                 images: (v.images || []).slice(0, 5),
//                 price: {
//                     base: v.price.base,
//                     sale: v.price.sale ?? null,
//                     costPrice: v.price.costPrice ?? null,
//                     saleStartDate: v.price.saleStartDate ?? null,
//                     saleEndDate: v.price.saleEndDate ?? null,
//                 },
//                 inventory: {
//                     quantity: v.inventory?.quantity ?? 0,
//                     lowStockThreshold: v.inventory?.lowStockThreshold ?? 5,
//                     trackInventory: v.inventory?.trackInventory ?? true,
//                 },
//                 isActive: v.isActive ?? true,
//             };
//         });
//     }
//     // Default single variant if none provided
//     return [
//         {
//             sku: uuidv4(),
//             barcode: Math.floor(Math.random() * 1e12),
//             attributes: [],
//             images: [],
//             price: { base: 0 },
//             inventory: { quantity: 0, lowStockThreshold: 5, trackInventory: true },
//             isActive: true,
//         },
//     ];
// };

// /**
//  * Create a product document for a given seller
//  */

// export const createProduct = async (
//     sellerUid: string,
//     data: CreateProductDTO
// ): Promise<Product> => {
//     const now = new Date();
//     const slug = generateSlug(data.name);

//     const productData: Partial<Product> = {
//         sellerUid,
//         slug,
//         name: data.name,
//         title: data.title,
//         description: data.description || '',
//         brand: data.brand || 'Generic',
//         status: data.status || 'draft',
//         category: data.category,
//         shipping: data.shipping,
//         attributes: data.attributes || [],
//         variants: normalizeVariants(data.variants),
//         soldInfo: {
//             enabled: data.soldInfo?.enabled ?? false,
//             count: data.soldInfo?.count ?? 0
//         },
//         fomo: {
//             enabled: data.fomo?.enabled ?? false,
//             type: data.fomo?.type ?? 'viewing_now',
//             viewingNow: data.fomo?.viewingNow,
//             productLeft: data.fomo?.productLeft,
//             customMessage: data.fomo?.customMessage
//         },
//         isFeatured: data.isFeatured ?? false,
//         createdAt: now,
//         updatedAt: now,
//     };

//     const ref = await db.collection(PRODUCTS_COLLECTION).add(productData);
//     const snap = await ref.get();
//     return { id: ref.id, ...snap.data() } as Product;
// };

// /**
//  * Update an existing product (seller must own it)
//  */

// export const updateProduct = async (
//     productId: string,
//     sellerUid: string,
//     data: UpdateProductDTO
// ): Promise<Product> => {
//     const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
//     const existing = await docRef.get();
//     if (!existing.exists) {
//         throw new Error('Product not found');
//     }
//     const prod = existing.data() as Product;
//     if (prod.sellerUid !== sellerUid) {
//         throw new Error('Not authorized to modify this product');
//     }

//     const now = new Date();
//     const updateData: any = { ...data, updatedAt: now };
//     if (data.name && data.name !== prod.name) {
//         updateData.slug = generateSlug(data.name);
//     }
//     if (data.variants) {
//         updateData.variants = normalizeVariants(data.variants);
//     }
//     if (data.attributes) {
//         updateData.attributes = data.attributes;
//     }

//     await docRef.update(updateData);
//     const updatedSnap = await docRef.get();
//     return { id: updatedSnap.id, ...updatedSnap.data() } as Product;
// };

// /**
//  * Delete a product (seller must own it)
//  */
// export const deleteProduct = async (productId: string, sellerUid: string): Promise<void> => {
//     const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
//     const existing = await docRef.get();
//     if (!existing.exists) {
//         throw new Error('Product not found');
//     }
//     const prod = existing.data() as Product;
//     if (prod.sellerUid !== sellerUid) {
//         throw new Error('Not authorized to delete this product');
//     }

//     await docRef.delete();
// };

// /**
//  * Fetch a single product by id (optionally only active)
//  */
// export const getProductById = async (productId: string): Promise<Product | null> => {
//     const doc = await db.collection(PRODUCTS_COLLECTION).doc(productId).get();
//     if (!doc.exists) return null;
//     return { id: doc.id, ...doc.data() } as Product;
// };

// /**
//  * Fetch a product by slug
//  */
// export const getProductBySlug = async (slug: string): Promise<Product | null> => {
//     const snapshot = await db
//         .collection(PRODUCTS_COLLECTION)
//         .where('slug', '==', slug)
//         .limit(1)
//         .get();
//     if (snapshot.empty) return null;
//     const doc = snapshot.docs[0];
//     return { id: doc.id, ...doc.data() } as Product;
// };


// /**
//  * List public products (active only)
//  */
// export const listPublicProducts = async (): Promise<Product[]> => {
//     const snapshot = await db
//         .collection(PRODUCTS_COLLECTION)
//         .where('status', '==', 'active')
//         .get();
//     return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
// };

// /**
//  * List products belonging to a seller (any status)
//  */
// export const listProductsBySeller = async (sellerUid: string): Promise<Product[]> => {
//     const snapshot = await db
//         .collection(PRODUCTS_COLLECTION)
//         .where('sellerUid', '==', sellerUid)
//         .get();
//     return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
// };

import type { Query } from 'firebase-admin/firestore';
import { db } from '../config/firebase';
import {
    Product,
    CreateProductDTO,
    UpdateProductDTO,
    Variant,
} from '../types/product.types';

import { generateSlug, generateSearchKeywords } from '../utils/slug.util';
import { UserProfile } from '../types/user.types';

const PRODUCTS_COLLECTION = 'products';
const USERS_COLLECTION = 'users';
const CATEGORY_COLLECTION = 'categories';

/**
 * 🔥 SKU GENERATOR
 */
const generateSKU = (productName: string, index: number): string => {
    const base = productName.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${base}-${Date.now()}-${index + 1}`;
};

/**
 * 🔥 VALIDATE CATEGORY
 */
const validateCategory = async (categoryId: string) => {
    const doc = await db.collection(CATEGORY_COLLECTION).doc(categoryId).get();
    if (!doc.exists) throw new Error('Invalid categoryId');
};

/**
 * 🔥 VALIDATE SELLER + SNAPSHOT
 */
const getSellerSnapshot = async (sellerUid: string) => {
    const userDoc = await db.collection(USERS_COLLECTION).doc(sellerUid).get();
    const sellerProfileDoc = await db.collection('sellerProfiles').doc(sellerUid).get();

    if (!userDoc.exists) {
        throw new Error('Seller not found');
    }

    const data = userDoc.data();

    if (!data) {
        throw new Error('User data missing');
    }

    const user: UserProfile = data as UserProfile;

    if (user.role !== 'seller') {
        throw new Error('User is not a seller');
    }

    const sp = sellerProfileDoc.exists ? sellerProfileDoc.data() : undefined;
    const rating =
        typeof sp?.rating === 'number'
            ? sp.rating
            : typeof (sp as { averageRating?: number })?.averageRating === 'number'
              ? (sp as { averageRating: number }).averageRating
              : undefined;

    return {
        name: user.name ?? 'Seller',
        storeName: (sp?.storeName as string | undefined) || undefined,
        rating,
    };
};

/**
 * 🔥 NORMALIZE VARIANTS
 */
const normalizeVariants = (
    data: Partial<Variant>[] | undefined,
    productName: string
): Variant[] => {
    if (!data || data.length === 0) {
        throw new Error('At least one variant is required');
    }

    return data.map((v, idx) => {
        if (!v.price || typeof v.price.base !== 'number') {
            throw new Error(`Variant ${idx} missing base price`);
        }

        if (v.price.sale && v.price.sale >= v.price.base) {
            throw new Error(`Sale price must be less than base price`);
        }

        if (!v.inventory || typeof v.inventory.quantity !== 'number') {
            throw new Error(`Variant ${idx} missing inventory`);
        }

        return {
            sku: generateSKU(productName, idx),

            barcode: v.barcode ? String(v.barcode) : undefined,

            attributes: v.attributes || [],
            images: (v.images || []).slice(0, 5),

            price: {
                base: v.price.base,
                sale: v.price.sale ?? null,
                costPrice: v.price.costPrice ?? null,
                saleStartDate: v.price.saleStartDate ? new Date(v.price.saleStartDate) : null,
                saleEndDate: v.price.saleEndDate ? new Date(v.price.saleEndDate) : null,
            },

            inventory: {
                quantity: v.inventory.quantity,
                lowStockThreshold: v.inventory.lowStockThreshold ?? 5,
                trackInventory: v.inventory.trackInventory ?? true,
                allowBackorder: v.inventory.allowBackorder ?? false,
            },

          isActive: typeof v.isActive === 'string'
    ? v.isActive === 'true'
    : v.isActive ?? true,

            createdAt: new Date(),
            updatedAt: new Date(),
        };
    });
};

/**
 * 🔥 CREATE PRODUCT (TRANSACTION SAFE)
 */
export const createProduct = async (
    sellerUid: string,
    data: CreateProductDTO
): Promise<Product> => {

    // ✅ VALIDATIONS
    await validateCategory(data.categoryId);
    const sellerSnapshot = await getSellerSnapshot(sellerUid);

    const now = new Date();

    const productRef = db.collection(PRODUCTS_COLLECTION).doc();

    const productData: Product = {
        id: productRef.id,

        sellerUid,
        sellerSnapshot,

        slug: generateSlug(data.name),

        name: data.name,
        title: data.title,
        description: data.description || '',
        brand: data.brand || 'Generic',

        status: data.status || 'draft',

        categoryId: data.categoryId,

        searchKeywords: generateSearchKeywords(`${data.name} ${data.title}`),

        shipping: data.shipping,
        attributes: data.attributes || [],

        variants: normalizeVariants(data.variants, data.name),

        soldInfo: {
            enabled: data.soldInfo?.enabled ?? false,
            count: data.soldInfo?.count ?? 0,
        },

        fomo: data.fomo?.enabled
            ? {
                  enabled: true,
                  type: data.fomo.type ?? 'viewing_now',
                  value: data.fomo.value,
                  customMessage: data.fomo.customMessage,
              }
            : undefined,

        isFeatured: data.isFeatured ?? false,

        metrics: data.metrics,
        feedSold7d: data.metrics?.sold7d ?? 0,
        feedSold30d: data.metrics?.sold30d ?? 0,
        sellerRatingForFeed: sellerSnapshot.rating ?? 0,

        createdAt: now,
        updatedAt: now,
    };

    await productRef.set(productData);
    invalidateProductFeedCache();

    return productData;
};

/**
 * 🔥 UPDATE PRODUCT
 */
export const updateProduct = async (
    productId: string,
    sellerUid: string,
    data: UpdateProductDTO
): Promise<Product> => {

    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    const existing = await docRef.get();

    if (!existing.exists) throw new Error('Product not found');

    const prod = existing.data() as Product;

    if (prod.sellerUid !== sellerUid) {
        throw new Error('Not authorized');
    }

    // ✅ CATEGORY VALIDATION (if changed)
    if (data.categoryId) {
        await validateCategory(data.categoryId);
    }

    const updateData: any = {
        ...data,
        updatedAt: new Date(),
    };

    delete updateData.sellerUid;
    delete updateData.createdAt;

    if (data.name && data.name !== prod.name) {
        updateData.slug = generateSlug(data.name);
    }

    if (data.name || data.title) {
        updateData.searchKeywords = generateSearchKeywords(
            `${data.name || prod.name} ${data.title || prod.title}`
        );
    }

    const mergedMetrics = { ...(prod.metrics || {}), ...(data.metrics || {}) };
    const freshSnap = await getSellerSnapshot(prod.sellerUid);
    updateData.sellerSnapshot = {
        name: freshSnap.name,
        storeName: freshSnap.storeName,
        rating: freshSnap.rating,
    };
    updateData.feedSold7d = mergedMetrics.sold7d ?? 0;
    updateData.feedSold30d = mergedMetrics.sold30d ?? 0;
    updateData.sellerRatingForFeed = freshSnap.rating ?? 0;
    if (Object.keys(mergedMetrics).length > 0) {
        updateData.metrics = mergedMetrics;
    }

    await docRef.update(updateData);
    invalidateProductFeedCache();

    const updatedSnap = await docRef.get();

    return { id: updatedSnap.id, ...updatedSnap.data() } as Product;
};



/**
 * 🔥 DELETE PRODUCT (HARD DELETE)
 */
export const deleteProduct = async (
    productId: string,
    sellerUid: string
): Promise<void> => {

    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    const existing = await docRef.get();

    if (!existing.exists) {
        throw new Error('Product not found');
    }

    const product = existing.data() as Product;

    // ✅ ownership check
    if (product.sellerUid !== sellerUid) {
        throw new Error('Unauthorized');
    }

    await docRef.delete();
    invalidateProductFeedCache();
};


export const addVariant = async (
    productId: string,
    sellerUid: string,
    variant: Partial<Variant>
): Promise<Product> => {

    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    const snap = await docRef.get();

    if (!snap.exists) throw new Error('Product not found');

    const product = snap.data() as Product;

    if (product.sellerUid !== sellerUid) throw new Error('Unauthorized');

    // ✅ Barcode uniqueness check
    if (variant.barcode) {
        const duplicate = product.variants.find(
            (v) => v.barcode && v.barcode === variant.barcode
        );
        if (duplicate) throw new Error(`Barcode ${variant.barcode} already exists in another variant`);
    }

    const newVariant = normalizeVariants([variant], product.name)[0];
    const updatedVariants = [...product.variants, newVariant];

    await docRef.update({ variants: updatedVariants, updatedAt: new Date() });
    invalidateProductFeedCache();

    return { ...product, variants: updatedVariants };
};

export const updateVariant = async (
    productId: string,
    sellerUid: string,
    sku: string,
    data: Partial<Variant>
): Promise<Product> => {

    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    const snap = await docRef.get();

    if (!snap.exists) throw new Error('Product not found');

    const product = snap.data() as Product;

    if (product.sellerUid !== sellerUid) throw new Error('Unauthorized');

    // ✅ Barcode uniqueness check (apne aap ko exclude karo)
    if (data.barcode) {
        const duplicate = product.variants.find(
            (v) => v.barcode === data.barcode && v.sku !== sku  // apna SKU exclude
        );
        if (duplicate) throw new Error(`Barcode ${data.barcode} already exists in another variant`);
    }

    const updatedVariants = product.variants.map((v) =>
        v.sku === sku
            ? {
                  ...v,
                  ...data,
                  price: { ...v.price, ...data.price },
                  inventory: { ...v.inventory, ...data.inventory },
                  updatedAt: new Date(),
              }
            : v
    );

    await docRef.update({ variants: updatedVariants, updatedAt: new Date() });
    invalidateProductFeedCache();

    return { ...product, variants: updatedVariants };
};


export const deleteVariant = async (
    productId: string,
    sellerUid: string,
    sku: string
): Promise<Product> => {

    const docRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    const snap = await docRef.get();

    if (!snap.exists) throw new Error('Product not found');

    const product = snap.data() as Product;

    if (product.sellerUid !== sellerUid) {
        throw new Error('Unauthorized');
    }

    const updatedVariants = product.variants.filter(v => v.sku !== sku);

    if (updatedVariants.length === 0) {
        throw new Error('At least one variant required');
    }

    await docRef.update({
        variants: updatedVariants,
        updatedAt: new Date(),
    });
    invalidateProductFeedCache();

    return { ...product, variants: updatedVariants };
};

export const getProductById = async (
    productId: string
): Promise<Product | null> => {

    const doc = await db.collection(PRODUCTS_COLLECTION).doc(productId).get();

    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() } as Product;
};

export const getProductBySlug = async (
    slug: string
): Promise<Product | null> => {

    const snapshot = await db
        .collection(PRODUCTS_COLLECTION)
        .where('slug', '==', slug)
        .limit(1)
        .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Product;
};

const enrichProductsWithStoreNames = async (products: Product[]): Promise<Product[]> => {
    if (products.length === 0) return [];
    const sellerIds = Array.from(new Set(products.map((p) => p.sellerUid)));
    const sellerProfiles = await Promise.all(
        sellerIds.map(async (uid) => {
            const doc = await db.collection('sellerProfiles').doc(uid).get();
            return { uid, storeName: (doc.data()?.storeName as string | undefined) || undefined };
        })
    );
    const storeMap = new Map(sellerProfiles.map((x) => [x.uid, x.storeName]));
    return products.map((p) => ({
        ...p,
        sellerSnapshot: {
            name: p.sellerSnapshot?.name || 'Seller',
            storeName: storeMap.get(p.sellerUid) || p.sellerSnapshot?.storeName,
            rating: p.sellerSnapshot?.rating,
        },
    }));
};

export const listPublicProducts = async (): Promise<Product[]> => {
    const snapshot = await db
        .collection(PRODUCTS_COLLECTION)
        .where('status', '==', 'active')
        .get();
    const products = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
    return enrichProductsWithStoreNames(products);
};

export const listProductsBySeller = async (
    sellerUid: string
): Promise<Product[]> => {

    const snapshot = await db
        .collection(PRODUCTS_COLLECTION)
        .where('sellerUid', '==', sellerUid)
        .get();

    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
};

export type FeedMode =
    | 'latest'
    | 'best_week'
    | 'best_month'
    | 'featured'
    | 'top_rated';

/**
 * In-memory feed cache (per Node process) — page 1 only.
 * Indexed queries read at most (limit+1) docs per request.
 */
const feedCache = new Map<
    string,
    { at: number; data: { products: Product[]; nextCursor: string | null } }
>();
const FEED_CACHE_TTL_MS = 45_000;

export const invalidateProductFeedCache = (): void => {
    feedCache.clear();
};

const tsMs = (v: unknown): number => {
    if (!v) return 0;
    const any = v as { toDate?: () => Date; seconds?: number };
    if (typeof any.toDate === 'function') return any.toDate().getTime();
    if (typeof any.seconds === 'number') return any.seconds * 1000;
    if (v instanceof Date) return v.getTime();
    return new Date(v as string).getTime();
};

const FEED_MAX = 200;

/** Indexed feed query — O(page) reads, not full catalog. */
const buildFeedBaseQuery = (mode: FeedMode): Query => {
    const col = db.collection(PRODUCTS_COLLECTION);
    switch (mode) {
        case 'latest':
            return col.where('status', '==', 'active').orderBy('updatedAt', 'desc');
        case 'featured':
            return col
                .where('status', '==', 'active')
                .where('isFeatured', '==', true)
                .orderBy('updatedAt', 'desc');
        case 'best_week':
            return col
                .where('status', '==', 'active')
                .orderBy('feedSold7d', 'desc')
                .orderBy('updatedAt', 'desc');
        case 'best_month':
            return col
                .where('status', '==', 'active')
                .orderBy('feedSold30d', 'desc')
                .orderBy('updatedAt', 'desc');
        case 'top_rated':
            return col
                .where('status', '==', 'active')
                .orderBy('sellerRatingForFeed', 'desc')
                .orderBy('updatedAt', 'desc');
        default:
            return col.where('status', '==', 'active').orderBy('updatedAt', 'desc');
    }
};

async function fetchFeedIndexed(
    mode: FeedMode,
    limit: number,
    cursorId?: string
): Promise<{ products: Product[]; nextCursor: string | null }> {
    const pageSize = Math.min(limit, FEED_MAX);
    const take = pageSize + 1;

    let q: Query = buildFeedBaseQuery(mode);
    if (cursorId) {
        const cur = await db.collection(PRODUCTS_COLLECTION).doc(cursorId).get();
        if (cur.exists) {
            q = q.startAfter(cur);
        }
    }
    q = q.limit(take);

    const snapshot = await q.get();
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    const products = pageDocs.map((d) => ({ id: d.id, ...d.data() } as Product));
    const enriched = await enrichProductsWithStoreNames(products);
    return { products: enriched, nextCursor };
}

/** Fallback when indexes are building or legacy docs lack sort fields (run local backfill script). */
async function listFeedProductsLegacy(mode: FeedMode, limit: number): Promise<Product[]> {
    const products = await listPublicProducts();
    const sellerFrequency = products.reduce<Record<string, number>>((acc, p) => {
        acc[p.sellerUid] = (acc[p.sellerUid] || 0) + 1;
        return acc;
    }, {});

    const ranked = [...products];
    const soldScore = (p: Product) =>
        (p.metrics?.sold7d ?? 0) * (mode === 'best_month' ? 0.4 : 1) +
        (p.metrics?.sold30d ?? 0) * (mode === 'best_month' ? 0.6 : 0.3);

    ranked.sort((a, b) => {
        if (mode === 'latest') return tsMs(b.updatedAt) - tsMs(a.updatedAt);
        if (mode === 'featured') {
            if (!!a.isFeatured !== !!b.isFeatured) return a.isFeatured ? -1 : 1;
            return (sellerFrequency[b.sellerUid] || 0) - (sellerFrequency[a.sellerUid] || 0);
        }
        if (mode === 'top_rated') {
            const ra = a.sellerSnapshot?.rating ?? a.sellerRatingForFeed ?? 0;
            const rb = b.sellerSnapshot?.rating ?? b.sellerRatingForFeed ?? 0;
            if (rb !== ra) return rb - ra;
            return soldScore(b) - soldScore(a);
        }
        if (mode === 'best_week' || mode === 'best_month') {
            const sa = soldScore(a);
            const sb = soldScore(b);
            if (sb !== sa) return sb - sa;
            const fa = sellerFrequency[a.sellerUid] || 1;
            const fb = sellerFrequency[b.sellerUid] || 1;
            return fb * 0.7 + tsMs(b.updatedAt) * 0.000000001 - (fa * 0.7 + tsMs(a.updatedAt) * 0.000000001);
        }
        return tsMs(b.updatedAt) - tsMs(a.updatedAt);
    });

    return ranked.slice(0, Math.min(limit, FEED_MAX));
}

export type FeedPageResult = {
    products: Product[];
    nextCursor: string | null;
};

/**
 * Public feed — indexed Firestore queries + cursor pagination (low read cost).
 * Page 1 cached ~45s. Falls back to legacy full scan if query fails (missing index / old docs).
 */
export const listFeedProducts = async (
    mode: FeedMode,
    limit = 60,
    cursorId?: string
): Promise<FeedPageResult> => {
    if (!cursorId) {
        const cacheKey = `${mode}:${limit}`;
        const hit = feedCache.get(cacheKey);
        if (hit && Date.now() - hit.at < FEED_CACHE_TTL_MS) {
            return hit.data;
        }
    }

    try {
        const result = await fetchFeedIndexed(mode, limit, cursorId);
        if (result.products.length === 0 && mode !== 'latest') {
            const legacy = await listFeedProductsLegacy(mode, limit);
            const page = { products: legacy, nextCursor: null as string | null };
            if (!cursorId) {
                feedCache.set(`${mode}:${limit}`, { at: Date.now(), data: page });
            }
            return page;
        }
        if (!cursorId) {
            feedCache.set(`${mode}:${limit}`, { at: Date.now(), data: result });
        }
        return result;
    } catch (e) {
        console.warn('[feed] indexed query failed, using legacy scan:', (e as Error).message);
        const legacy = await listFeedProductsLegacy(mode, limit);
        return { products: legacy, nextCursor: null };
    }
};

/**
 * Other active products from the same seller (e.g. product detail "more from store"), newest first.
 */
export const listRelatedProductsFromSeller = async (
    sellerUid: string,
    excludeProductId: string,
    limit = 8
): Promise<Product[]> => {
    const snapshot = await db
        .collection(PRODUCTS_COLLECTION)
        .where('sellerUid', '==', sellerUid)
        .where('status', '==', 'active')
        .get();

    let products = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as Product))
        .filter((p) => p.id !== excludeProductId);

    products.sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt));

    products = products.slice(0, Math.min(limit, 24));

    return enrichProductsWithStoreNames(products);
};