// // INDUSTRY-LEVEL PRODUCT & VARIANT TYPES

// export interface Image {
//     url: string;
//     publicId: string;
//     altText?: string;
//     order?: number;
// }

// export interface VariantPrice {
//     base: number;
//     sale?: number | null;
//     costPrice?: number | null; // not exposed to client
//     saleStartDate?: Date | null;
//     saleEndDate?: Date | null;
// }

// export interface VariantInventory {
//     quantity: number;
//     lowStockThreshold?: number;
//     trackInventory?: boolean;
// }

// export interface VariantAttribute {
//     key: string;
//     value: string;
// }

// export interface Variant {
//     sku: string;
//     barcode: number;
//     attributes: VariantAttribute[];
//     images?: Image[];
//     price: VariantPrice;
//     inventory: VariantInventory;
//     isActive?: boolean;
//     // Virtuals (for reference):
//     // isSaleActive: boolean;
//     // finalPrice: number;
//     // discountPercentage: number;
// }

// export interface ProductShipping {
//     weight?: number;
//     dimensions?: {
//         length?: number;
//         width?: number;
//         height?: number;
//     };
// }

// export type ProductStatus = 'draft' | 'active' | 'archived';

// export interface Product {
//     id: string;
//     slug: string;
//     sellerUid: string;
//     name: string;
//     title: string;
//     description?: string;
//     brand?: string;
//     status: ProductStatus;
//     category: string;
//     shipping?: ProductShipping;
//     attributes?: VariantAttribute[];
//     variants: Variant[];
//     soldInfo?: {
//         enabled: boolean;
//         count: number;
//     };
//     fomo?: {
//         enabled: boolean;
//         type: 'viewing_now' | 'product_left' | 'custom';
//         viewingNow?: number;
//         productLeft?: number;
//         customMessage?: string;
//     };
//     isFeatured?: boolean;
//     createdAt: Date;
//     updatedAt: Date;
//     // Virtuals (for reference):
//     // minPrice: number;
//     // maxPrice: number;
//     // inStock: boolean;
//     // soldLabel: string;
//     // fomoLabel: string;
//     // maxDiscountPercentage: number;
// }

// // DTOs for create/update
// export interface CreateProductDTO {
//     name: string;
//     title: string;
//     description?: string;
//     brand?: string;
//     status?: ProductStatus;
//     category: string;
//     shipping?: ProductShipping;
//     attributes?: VariantAttribute[];
//     variants?: Partial<Variant>[];
//     soldInfo?: {
//         enabled?: boolean;
//         count?: number;
//     };
//     fomo?: {
//         enabled?: boolean;
//         type?: 'viewing_now' | 'product_left' | 'custom';
//         viewingNow?: number;
//         productLeft?: number;
//         customMessage?: string;
//     };
//     isFeatured?: boolean;
// }

// export interface UpdateProductDTO extends Partial<CreateProductDTO> {}


// ==============================
// PRODUCT + VARIANT FULL MODEL
// ==============================

// ---------- COMMON ----------


// ========================================
// 🔥 PRODUCT TYPES (FINAL VERSION)
// ========================================

export interface Image {
  url: string;
  publicId: string;
  altText?: string;
  order?: number;
}

export interface VariantAttribute {
  key: string;
  value: string;
}

// ---------- PRICE ----------
export interface VariantPrice {
  base: number;
  sale?: number | null;
  costPrice?: number | null;
  saleStartDate?: Date | null;
  saleEndDate?: Date | null;
}

// ---------- INVENTORY ----------
export interface VariantInventory {
  quantity: number;
  lowStockThreshold?: number;
  trackInventory: boolean;
  allowBackorder?: boolean;
}

// ---------- VARIANT ----------
export interface Variant {
  sku: string; // 🔥 AUTO GENERATED (NOT FROM CLIENT)

  barcode?: string;

  attributes: VariantAttribute[];
  images?: Image[];

  price: VariantPrice;

  inventory: VariantInventory;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;

  // ---------- COMPUTED ----------
  finalPrice?: number;
  discountPercentage?: number;
  isSaleActive?: boolean;
}

// ---------- SHIPPING ----------
export interface ProductShipping {
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
}

// ---------- PRODUCT ----------
export type ProductStatus = "draft" | "active" | "archived";

export interface Product {
  id: string;

  slug: string; // 🔥 AUTO GENERATED

  sellerUid: string; // 🔥 FROM AUTH

  // 🔥 OPTIONAL SNAPSHOT (PERFORMANCE)
  sellerSnapshot?: {
    name: string;
    storeName?: string;
    rating?: number;
  };

  name: string;
  title: string;
  description?: string;

  brand?: string;

  status: ProductStatus;

  categoryId: string;

  searchKeywords: string[];

  shipping?: ProductShipping;

  attributes?: VariantAttribute[];

  variants: Variant[];

  // ---------- SALES ----------
  soldInfo?: {
    enabled: boolean;
    count: number;
  };

  // ---------- FOMO ----------
  fomo?: {
    enabled: boolean;
    type: "viewing_now" | "product_left" | "custom";
    value?: number;
    customMessage?: string;
  };

  isFeatured?: boolean;

  /** Optional analytics — updated by jobs/events; used for feed + honest FOMO */
  metrics?: {
    views24h?: number;
    views7d?: number;
    sold7d?: number;
    sold30d?: number;
    inquiries7d?: number;
  };

  /**
   * Denormalized for indexed feed queries (Firestore orderBy) — no extra infra.
   * Kept in sync on create/update from metrics + seller rating.
   */
  feedSold7d?: number;
  feedSold30d?: number;
  sellerRatingForFeed?: number;

  createdAt: Date;
  updatedAt: Date;

  // ---------- COMPUTED ----------
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  maxDiscountPercentage?: number;
  fomoLabel?: string;
}

// ========================================
// 🔥 DTOs (IMPORTANT FOR API)
// ========================================

// ❌ CLIENT CANNOT SEND sku, createdAt etc.
export interface CreateProductDTO {
  name: string;
  title: string;

  description?: string;
  brand?: string;

  status?: ProductStatus;

  categoryId: string;

  shipping?: ProductShipping;

  attributes?: VariantAttribute[];

  variants: {
    barcode?: string;

    attributes?: VariantAttribute[];
    images?: Image[];

    price: VariantPrice;

    inventory: VariantInventory;

    isActive?: boolean;
  }[];

  soldInfo?: {
    enabled?: boolean;
    count?: number;
  };

  fomo?: {
    enabled?: boolean;
    type?: "viewing_now" | "product_left" | "custom";
    value?: number;
    customMessage?: string;
  };

  isFeatured?: boolean;

  metrics?: Product["metrics"];
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {}