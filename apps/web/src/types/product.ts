export interface ProductCategory {
  id: string;
  name: string;
}

export interface ProductVariant {
  sizeId: string;
  sizeName: string;
  colorId: string;
  colorName: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  cost: string | null;
  salePrice: string | null;
  recommendedPrice: string | null;
  isAvailableForSale: boolean;
  variantCount: number;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VariantInput {
  sizeId: number;
  colorId: number;
}

export interface ProductFormInput {
  name: string;
  categoryId: number;
  code?: string;
  description?: string;
  cost?: number;
  salePrice?: number;
  variants: VariantInput[];
}
