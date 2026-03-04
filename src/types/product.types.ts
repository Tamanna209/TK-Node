import { Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

export interface VariantInventory {
    quantity: number;
    lowThreshold: number;
}

export interface Variant {
    sku: string;
    attributes?: Record<string, string>;
    images?: string[];
    inventory: VariantInventory;
}

export interface ShippingDetails {
    height: number;
    length: number;
    breadth: number;
    weight: number;
}

export type ProductStatus = 'active' | 'inactive';

export interface Product {
    id: string;
    slug: string;
    sellerUid: string;
    name: string;
    title?: string;
    description?: string;
    brand: string;
    status: ProductStatus;
    category: string;
    shipping?: ShippingDetails;
    inventory: {
        quantity: number;
        lowThreshold: number;
    };
    attributes?: Record<string, string>; // common product attributes
    variants: Variant[];
    createdAt: Timestamp | admin.firestore.FieldValue;
    updatedAt: Timestamp | admin.firestore.FieldValue;
}

// DTOs used when creating/updating products
export interface CreateProductDTO {
    name: string;
    title?: string;
    description?: string;
    brand?: string;
    status?: ProductStatus;
    category: string;
    shipping?: ShippingDetails;
    inventory?: {
        quantity: number;
        lowThreshold?: number;
    };
    attributes?: Record<string, string>;
    variants?: Partial<Variant>[];
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {}
