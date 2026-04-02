// import { Request, Response } from 'express';
// import * as productService from '../services/product.service';
// import { sendSuccess, sendError } from '../utils/response.util';
// import { Product, CreateProductDTO, UpdateProductDTO } from '../types/product.types';

// /**
//  * POST /api/products
//  * Create a new product (seller must be authenticated & approved)
//  */
// export const createProduct = async (req: Request, res: Response): Promise<void> => {
//     try {
//         if (!req.user) {
//             sendError(res, 'Unauthorized', 401);
//             return;
//         }
//         const sellerUid = req.user.uid;
//         const data = req.body as CreateProductDTO;
//         const product = await productService.createProduct(sellerUid, data);
//         sendSuccess(res, { product }, 'Product created', 201);
//     } catch (error) {
//         const err = error as Error;
//         console.error('createProduct error:', err.message);
//         sendError(res, err.message || 'Failed to create product', 500);
//     }
// };

// /**
//  * PUT /api/products/:id
//  * Update a product (seller owns it)
//  */
// export const updateProduct = async (req: Request, res: Response): Promise<void> => {
//     try {
//         if (!req.user) {
//             sendError(res, 'Unauthorized', 401);
//             return;
//         }
//         const sellerUid = req.user.uid;
//         const id = req.params['id'] as string;
//         const data = req.body as UpdateProductDTO;
//         const updated = await productService.updateProduct(id, sellerUid, data);
//         sendSuccess(res, { product: updated }, 'Product updated');
//     } catch (error) {
//         const err = error as Error;
//         console.error('updateProduct error:', err.message);
//         sendError(res, err.message || 'Failed to update product', 500);
//     }
// };

// /**
//  * DELETE /api/products/:id
//  * Remove a product
//  */
// export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
//     try {
//         if (!req.user) {
//             sendError(res, 'Unauthorized', 401);
//             return;
//         }
//         const sellerUid = req.user.uid;
//         const id = req.params['id'] as string;
//         await productService.deleteProduct(id, sellerUid);
//         sendSuccess(res, { id }, 'Product deleted');
//     } catch (error) {
//         const err = error as Error;
//         console.error('deleteProduct error:', err.message);
//         sendError(res, err.message || 'Failed to delete product', 500);
//     }
// };

// /**
//  * GET /api/products
//  * List public (active) products
//  */
// export const listProducts = async (_req: Request, res: Response): Promise<void> => {
//     try {
//         const products = await productService.listPublicProducts();
//         sendSuccess(res, { products, total: products.length }, 'Products fetched');
//     } catch (error) {
//         const err = error as Error;
//         console.error('listProducts error:', err.message);
//         sendError(res, 'Failed to fetch products', 500);
//     }
// };

// /**
//  * GET /api/products/:id
//  * Get details of a single product (active or owner)
//  */
// export const getProduct = async (req: Request, res: Response): Promise<void> => {
//     try {
//         const identifier = req.params['id'] as string;
//         // try slug first, then id
//         let product = await productService.getProductBySlug(identifier);
//         if (!product) {
//             product = await productService.getProductById(identifier);
//         }
//         if (!product || product.status !== 'active') {
//             sendError(res, 'Product not found', 404);
//             return;
//         }
//         sendSuccess(res, { product }, 'Product fetched');
//     } catch (error) {
//         const err = error as Error;
//         console.error('getProduct error:', err.message);
//         sendError(res, 'Failed to fetch product', 500);
//     }
// };

// /**
//  * GET /api/products/seller/me
//  * Get all products belonging to current seller
//  */
// export const listMyProducts = async (req: Request, res: Response): Promise<void> => {
//     try {
//         if (!req.user) {
//             sendError(res, 'Unauthorized', 401);
//             return;
//         }
//         const sellerUid = req.user.uid;
//         const products = await productService.listProductsBySeller(sellerUid);
//         sendSuccess(res, { products, total: products.length }, 'Seller products fetched');
//     } catch (error) {
//         const err = error as Error;
//         console.error('listMyProducts error:', err.message);
//         sendError(res, 'Failed to fetch seller products', 500);
//     }
// };


// //product by fetch
// const fetchBySlug=async(req :Request, res:Response)=>{
// console.log("Products by slug")
// }

import { Request, Response } from 'express';
import * as productService from '../services/product.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { bucket } from '../config/firebase';

/**
 * 🔥 Upload Image
 */
const uploadToFirebase = async (
    file: Express.Multer.File,
    productSlug: string,
    variantSku: string,
    index: number
) => {
    const ext = file.originalname.split('.').pop();

    const fileName = `products/${productSlug}/${variantSku}_${Date.now()}_${index}.${ext}`;
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(file.buffer, {
        metadata: { contentType: file.mimetype },
    });

    await fileUpload.makePublic();

    return {
        url: `https://storage.googleapis.com/${bucket.name}/${fileName}`,
        publicId: fileName,
    };
};

/**
 * 🔥 Delete Image
 */
const deleteFromFirebase = async (publicId: string) => {
    try {
        await bucket.file(publicId).delete();
    } catch {}
};

/**
 * 🔥 Parse variants + other JSON fields (IMPORTANT FIX)
 */
const parseBody = (data: any) => {
    const fields = ['variants', 'shipping', 'attributes', 'soldInfo', 'fomo', 'price', 'inventory'];

    for (const field of fields) {
        if (typeof data[field] === 'string') {
            try {
                data[field] = JSON.parse(data[field]);
            } catch {
                throw new Error(`Invalid JSON in ${field}`);
            }
        }
    }

    // ✅ Boolean fields manually convert karo
    if (data.isActive !== undefined) {
        data.isActive = data.isActive === 'true' || data.isActive === true;
    }
    if (data.isFeatured !== undefined) {
        data.isFeatured = data.isFeatured === 'true' || data.isFeatured === true;
    }

    return data;
};

/**
 * 🔥 Attach Images to Variants
 */
const attachImages = async (
    req: Request,
    productSlug: string,
    variants: any[]
) => {
    const files = (req.files || []) as Express.Multer.File[];

    return Promise.all(
        variants.map(async (variant, i) => {
            // ✅ case-insensitive match karo
            const variantFiles = files.filter((f) => 
                f.fieldname.toLowerCase() === `variantimages_${i}`
            );

            let images = [];
            for (let j = 0; j < Math.min(variantFiles.length, 5); j++) {
                const uploaded = await uploadToFirebase(
                    variantFiles[j],
                    productSlug,
                    variant.sku || `temp_${i}`,
                    j
                );
                images.push({ ...uploaded, order: j });
            }

            return {
                ...variant,
                images: images.length ? images : variant.images || [],
            };
        })
    );
};

//////////////////////////////////////////////////////////////
// 🔥 CREATE PRODUCT
//////////////////////////////////////////////////////////////
export const createProduct = async (req: Request, res: Response) => {
    try {
        if (!req.user) return sendError(res, 'Unauthorized', 401);

        let data: any = parseBody(req.body);

        // ✅ pehle product banao (actual slug yahan generate hoga)
        const product = await productService.createProduct(req.user.uid, data);

        // ✅ ab actual slug se images upload karo
        const files = (req.files || []) as Express.Multer.File[];
        if (files.length > 0) {
            const updatedVariants = await attachImages(
                req,
                product.slug,        // ✅ actual slug use ho raha hai ab
                product.variants
            );
            await productService.updateProduct(product.id, req.user.uid, {
                variants: updatedVariants,
            });
            product.variants = updatedVariants;
        }

        sendSuccess(res, { product }, 'Product created', 201);
    } catch (err) {
        sendError(res, (err as Error).message);
    }
};

//////////////////////////////////////////////////////////////
// 🔥 UPDATE PRODUCT + VARIANT IMAGE HANDLING
//////////////////////////////////////////////////////////////
export const updateProduct = async (req: Request, res: Response) => {
    try {
        if (!req.user) return sendError(res, 'Unauthorized', 401);

        const id = req.params.id as string;

        const existing = await productService.getProductById(id);
        if (!existing) return sendError(res, 'Not found', 404);

        let data: any = parseBody(req.body);

        if (data.variants) {
            const updatedVariants = await attachImages(
                req,
                existing.slug,
                data.variants
            );

            // 🔥 DELETE OLD IMAGES (only if replaced)
            for (const newVar of updatedVariants) {
                const oldVar = existing.variants.find(
                    (v) => v.sku === newVar.sku
                );

                if (oldVar && newVar.images?.length) {
                    for (const img of oldVar.images || []) {
                        await deleteFromFirebase(img.publicId);
                    }
                }
            }

            data.variants = updatedVariants;
        }

        const product = await productService.updateProduct(
            id,
            req.user.uid,
            data
        );

        sendSuccess(res, { product }, 'Product updated');
    } catch (err) {
        sendError(res, (err as Error).message);
    }
};

//////////////////////////////////////////////////////////////
// 🔥 ADD VARIANT
//////////////////////////////////////////////////////////////
export const addVariant = async (req: Request, res: Response) => {
    try {
        if (!req.user) return sendError(res, 'Unauthorized', 401);

        const id = req.params.id as string;

        const product = await productService.getProductById(id);
        if (!product) return sendError(res, 'Not found', 404);

       let variant: any = parseBody(req.body);

const variantData: any = {};
if (variant.attributes !== undefined) variantData.attributes = variant.attributes;
if (variant.price !== undefined)      variantData.price = variant.price;
if (variant.inventory !== undefined)  variantData.inventory = variant.inventory;
if (variant.barcode !== undefined)    variantData.barcode = variant.barcode;
if (variant.isActive !== undefined)   variantData.isActive = variant.isActive === 'true' || variant.isActive === true;

const [newVariant] = await attachImages(req, product.slug, [variantData]);
        const updated = await productService.addVariant(
            id,
            req.user.uid,
            newVariant
        );

        sendSuccess(res, { product: updated }, 'Variant added');
    } catch (err) {
        sendError(res, (err as Error).message);
    }
};

//////////////////////////////////////////////////////////////
// 🔥 UPDATE VARIANT
//////////////////////////////////////////////////////////////
export const updateVariant = async (req: Request, res: Response) => {
    try {
        if (!req.user) return sendError(res, 'Unauthorized', 401);

        const id = req.params.id as string;
        const sku = req.params.sku as string;

        const product = await productService.getProductById(id);
        if (!product) return sendError(res, 'Not found', 404);

        let data: any = parseBody(req.body);

        // ✅ Sirf valid variant fields lo — baaki sab ignore
        const variantData: any = { sku };

        if (data.attributes !== undefined) variantData.attributes = data.attributes;
        if (data.price !== undefined)      variantData.price = data.price;
        if (data.inventory !== undefined)  variantData.inventory = data.inventory;
        if (data.barcode !== undefined)    variantData.barcode = data.barcode;
        if (data.isActive !== undefined)   variantData.isActive = data.isActive === 'true' || data.isActive === true;

        // ✅ Images attach karo
        const [updatedVariant] = await attachImages(
            req,
            product.slug,
            [variantData]
        );

       // 🔥 Delete old images only if new ones uploaded
const files = (req.files || []) as Express.Multer.File[];
const newFilesUploaded = files.some(
    (f) => f.fieldname.toLowerCase() === 'variantimages_0'
);

const old = product.variants.find((v) => v.sku === sku);
if (old && newFilesUploaded) {
    for (const img of old.images || []) {
        await deleteFromFirebase(img.publicId);
    }
}

        const updated = await productService.updateVariant(
            id,
            req.user.uid,
            sku,
            updatedVariant
        );

        sendSuccess(res, { product: updated }, 'Variant updated');
    } catch (err) {
        sendError(res, (err as Error).message);
    }
};

//////////////////////////////////////////////////////////////
// 🔥 DELETE VARIANT
//////////////////////////////////////////////////////////////
export const deleteVariant = async (req: Request, res: Response) => {
    try {
        if (!req.user) return sendError(res, 'Unauthorized', 401);

        const id = req.params.id as string;
        const sku = req.params.sku as string;

        const product = await productService.getProductById(id);
        if (!product) return sendError(res, 'Not found', 404);

        const variant = product.variants.find((v) => v.sku === sku);

        if (variant) {
            for (const img of variant.images || []) {
                await deleteFromFirebase(img.publicId);
            }
        }

        const updated = await productService.deleteVariant(
            id,
            req.user.uid,
            sku
        );

        sendSuccess(res, { product: updated }, 'Variant deleted');
    } catch (err) {
        sendError(res, (err as Error).message);
    }
};

//////////////////////////////////////////////////////////////
// 🔥 SOFT DELETE
//////////////////////////////////////////////////////////////
export const archiveProduct = async (req: Request, res: Response) => {
    try {
        if (!req.user) return sendError(res, 'Unauthorized', 401);

        const id = req.params.id as string;

        const product = await productService.updateProduct(
            id,
            req.user.uid,
            { status: 'archived' }
        );

        sendSuccess(res, { product }, 'Product archived');
    } catch (err) {
        sendError(res, (err as Error).message);
    }
};

//////////////////////////////////////////////////////////////
// 🔥 RESTORE PRODUCT
//////////////////////////////////////////////////////////////
export const restoreProduct = async (req: Request, res: Response) => {
    try {
        if (!req.user) return sendError(res, 'Unauthorized', 401);

        const id = req.params.id as string;

        const product = await productService.updateProduct(
            id,
            req.user.uid,
            { status: 'active' }
        );

        sendSuccess(res, { product }, 'Product restored');
    } catch (err) {
        sendError(res, (err as Error).message);
    }
};

//////////////////////////////////////////////////////////////
// 🔥 HARD DELETE
//////////////////////////////////////////////////////////////
export const deleteProduct = async (req: Request, res: Response) => {
    try {
        if (!req.user) return sendError(res, 'Unauthorized', 401);

        const id = req.params.id as string;

        const product = await productService.getProductById(id);
        if (!product) return sendError(res, 'Not found', 404);

        for (const v of product.variants) {
            for (const img of v.images || []) {
                await deleteFromFirebase(img.publicId);
            }
        }

        await productService.deleteProduct(id, req.user.uid);

        sendSuccess(res, {}, 'Product permanently deleted');
    } catch {
        sendError(res, 'Delete failed');
    }
};

//////////////////////////////////////////////////////////////
// 🔥 GET PRODUCT
//////////////////////////////////////////////////////////////
export const getProduct = async (req: Request, res: Response) => {
    try {
        const identifier = req.params.id as string;

        let product = await productService.getProductBySlug(identifier);

        if (!product) {
            product = await productService.getProductById(identifier);
        }

        if (!product) return sendError(res, 'Not found', 404);

        if (product.status !== 'active' && product.sellerUid !== req.user?.uid) {
            return sendError(res, 'Not found', 404);
        }

        sendSuccess(res, { product });
    } catch {
        sendError(res, 'Error fetching product');
    }
};

//////////////////////////////////////////////////////////////
// 🔥 LIST PRODUCTS
//////////////////////////////////////////////////////////////
export const listProducts = async (_req: Request, res: Response) => {
    try {
        const products = await productService.listPublicProducts();
        sendSuccess(res, { products });
    } catch {
        sendError(res, 'Error');
    }
};

/** GET /api/products/feed?mode=latest|best_week|best_month|featured|top_rated&limit= */
export const getFeed = async (req: Request, res: Response) => {
    try {
        const raw = (req.query.mode as string) || 'latest';
        const allowed: productService.FeedMode[] = [
            'latest',
            'best_week',
            'best_month',
            'featured',
            'top_rated',
        ];
        const mode = (allowed.includes(raw as productService.FeedMode)
            ? raw
            : 'latest') as productService.FeedMode;
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '60'), 10) || 60, 1), 200);
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
        const { products, nextCursor } = await productService.listFeedProducts(mode, limit, cursor);
        // Page 1 only; cursor pages should not be cached long at CDN (different URLs).
        if (!cursor) {
            res.setHeader('Cache-Control', 'public, max-age=45, stale-while-revalidate=90');
        } else {
            res.setHeader('Cache-Control', 'private, max-age=0');
        }
        sendSuccess(res, { products, mode, nextCursor });
    } catch (err) {
        sendError(res, (err as Error).message || 'Failed to fetch feed');
    }
};

/** GET /api/products/seller/:sellerUid/related?exclude=&limit= */
export const listSellerRelated = async (req: Request, res: Response) => {
    try {
        const sellerUid = req.params.sellerUid as string;
        const exclude = (req.query.exclude as string) || '';
        const limit = Math.min(Math.max(parseInt(String(req.query.limit || '8'), 10) || 8, 1), 24);
        if (!sellerUid) {
            sendError(res, 'sellerUid required', 400);
            return;
        }
        const products = await productService.listRelatedProductsFromSeller(sellerUid, exclude, limit);
        sendSuccess(res, { products });
    } catch (err) {
        sendError(res, (err as Error).message || 'Failed to fetch related products');
    }
};

//////////////////////////////////////////////////////////////
// 🔥 SELLER PRODUCTS
//////////////////////////////////////////////////////////////
export const listMyProducts = async (req: Request, res: Response) => {
    try {
        if (!req.user) return sendError(res, 'Unauthorized', 401);

        const products = await productService.listProductsBySeller(
            req.user.uid
        );

        sendSuccess(res, { products });
    } catch {
        sendError(res, 'Error');
    }
};