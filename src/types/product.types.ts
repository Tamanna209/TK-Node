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
  sku: string; // AUTO GENERATED
  barcode?: string;

  attributes: VariantAttribute[];
  images?: Image[];

  price: VariantPrice;
  inventory: VariantInventory;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;

  // --------- COMPUTED ---------
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

  slug: string; // AUTO GENERATED
  sellerUid: string;

  sellerSnapshot?: {
    name: string;
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

  soldInfo?: {
    enabled: boolean;
    count: number;
  };

  fomo?: {
    enabled: boolean;
    type: "viewing_now" | "product_left" | "custom";
    value?: number;
    customMessage?: string;
  };

  isFeatured?: boolean;

  createdAt: Date;
  updatedAt: Date;

  // --------- COMPUTED ---------
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  maxDiscountPercentage?: number;
  fomoLabel?: string;
}

// ==============================
// DTOs (NO slug / SKU from user)
// ==============================

export interface CreateProductDTO {
  name: string;
  title: string;
  description?: string;
  brand?: string;

  status?: ProductStatus;

  categoryId: string;

  shipping?: ProductShipping;
  attributes?: VariantAttribute[];

  variants: Omit<
    Variant,
    "sku" | "createdAt" | "updatedAt" | "finalPrice" | "discountPercentage" | "isSaleActive"
  >[];

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
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {}

// ==============================
// 🔥 HELPERS (ALL LOGIC HERE)
// ==============================

// ---------- SLUG ----------
export const generateSlug = (name: string): string => {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, "-") +
    "-" +
    Date.now()
  );
};

// ---------- SKU ----------
export const generateSKU = (name: string, index: number): string => {
  const base = name
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return `${base}-${Date.now()}-${index + 1}`;
};

// ---------- SEARCH ----------
export const generateSearchKeywords = (text: string): string[] => {
  const words = text.toLowerCase().split(" ");
  const set = new Set<string>();

  words.forEach((word) => {
    for (let i = 1; i <= word.length; i++) {
      set.add(word.substring(0, i));
    }
  });

  return Array.from(set);
};

// ---------- VARIANT COMPUTE ----------
export const computeVariant = (variant: Variant): Variant => {
  const now = new Date();

  const isSaleActive =
    variant.price.sale &&
    (!variant.price.saleStartDate || variant.price.saleStartDate <= now) &&
    (!variant.price.saleEndDate || variant.price.saleEndDate >= now);

  const finalPrice = isSaleActive ? variant.price.sale! : variant.price.base;

  const discountPercentage =
    variant.price.sale && variant.price.base
      ? Math.round(
          ((variant.price.base - variant.price.sale) / variant.price.base) * 100
        )
      : 0;

  return {
    ...variant,
    isSaleActive: Boolean(isSaleActive),
    finalPrice,
    discountPercentage,
  };
};

// ---------- PRODUCT COMPUTE ----------
export const computeProduct = (product: Product): Product => {
  const variants = product.variants.map(computeVariant);

  const prices = variants.map((v) => v.finalPrice || v.price.base);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const inStock = variants.some(
    (v) => v.inventory.quantity > 0 || v.inventory.allowBackorder
  );

  const maxDiscountPercentage = Math.max(
    ...variants.map((v) => v.discountPercentage || 0)
  );

  // ---------- FOMO LABEL ----------
  let fomoLabel = "";

  if (product.fomo?.enabled) {
    switch (product.fomo.type) {
      case "viewing_now":
        fomoLabel = `${product.fomo.value || 0} people viewing this`;
        break;
      case "product_left":
        fomoLabel = `Only ${product.fomo.value || 0} left in stock`;
        break;
      case "custom":
        fomoLabel = product.fomo.customMessage || "";
        break;
    }
  }

  return {
    ...product,
    variants,
    minPrice,
    maxPrice,
    inStock,
    maxDiscountPercentage,
    fomoLabel,
  };
};

// ==============================
// ✅ VALIDATION
// ==============================

export const validateProduct = (dto: CreateProductDTO) => {
  if (!dto.variants || dto.variants.length === 0) {
    throw new Error("At least one variant is required");
  }

  dto.variants.forEach((v) => {
    if (v.price.sale && v.price.sale >= v.price.base) {
      throw new Error("Sale price must be less than base price");
    }

    if (v.images && v.images.length > 5) {
      throw new Error("Max 5 images allowed per variant");
    }
  });
};

// ==============================
// 🚀 BUILD PRODUCT (MAIN FUNCTION)
// ==============================

export const buildProduct = (
  dto: CreateProductDTO,
  sellerUid: string
): Product => {
  validateProduct(dto);

  const now = new Date();

  const variants: Variant[] = dto.variants.map((v, i) => ({
    ...v,
    sku: generateSKU(dto.name, i),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }));

  const product: Product = {
    id: crypto.randomUUID(),

    slug: generateSlug(dto.name),

    sellerUid,

    name: dto.name,
    title: dto.title,
    description: dto.description,
    brand: dto.brand,

    status: dto.status || "active",

    categoryId: dto.categoryId,

    searchKeywords: generateSearchKeywords(
      `${dto.name} ${dto.title}`
    ),

    shipping: dto.shipping,
    attributes: dto.attributes,

    variants,

    soldInfo: {
      enabled: dto.soldInfo?.enabled || false,
      count: dto.soldInfo?.count || 0,
    },

    fomo: dto.fomo
      ? {
          enabled: dto.fomo.enabled || false,
          type: dto.fomo.type || "viewing_now",
          value: dto.fomo.value,
          customMessage: dto.fomo.customMessage,
        }
      : undefined,

    isFeatured: dto.isFeatured || false,

    createdAt: now,
    updatedAt: now,
  };

  return computeProduct(product);
};