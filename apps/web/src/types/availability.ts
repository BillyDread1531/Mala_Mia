export type AvailabilityStatus = 'DISPONIBLE' | 'STOCK_BAJO' | 'AGOTADO';

export interface AvailabilityItem {
  productId: string;
  productName: string;
  productCode: string;
  categoryId: string;
  categoryName: string;
  sizeId: string;
  sizeName: string;
  colorId: string;
  colorName: string;
  quantity: number;
  salePrice: string | null;
  waistMeasurement: string | null;
  lengthMeasurement: string | null;
  status: AvailabilityStatus;
}

export interface AvailabilitySummary {
  products: number;
  available: number;
  lowStock: number;
  outOfStock: number;
}

export interface AvailabilityResponse {
  items: AvailabilityItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: AvailabilitySummary;
}

export interface AvailabilityVariantDetail {
  sizeId: string;
  sizeName: string;
  colorId: string;
  colorName: string;
  quantity: number;
  status: AvailabilityStatus;
}

export interface AvailabilityProductDetail {
  id: string;
  name: string;
  code: string;
  category: { id: string; name: string };
  description: string | null;
  salePrice: string | null;
  waistMeasurement: string | null;
  lengthMeasurement: string | null;
  variants: AvailabilityVariantDetail[];
}
