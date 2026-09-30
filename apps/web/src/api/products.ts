import type { Product, ProductFormInput, ProductListResponse } from '../types/product';
import { apiFetch } from './client';

export interface ListProductsParams {
  search?: string;
  categoryId?: number;
  page?: number;
  pageSize?: number;
}

function buildQuery(params: object): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function listProducts(params: ListProductsParams = {}): Promise<ProductListResponse> {
  return apiFetch<ProductListResponse>(`/products${buildQuery(params)}`);
}

export function getProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`);
}

export function checkDuplicates(q: string): Promise<Product[]> {
  return apiFetch<Product[]>(`/products/check-duplicates${buildQuery({ q })}`);
}

export function generateCode(categoryId: number): Promise<{ code: string }> {
  return apiFetch<{ code: string }>(`/products/generate-code${buildQuery({ categoryId })}`);
}

export function previewRecommendedPrice(cost: number): Promise<{ recommendedPrice: string | null }> {
  return apiFetch<{ recommendedPrice: string | null }>(
    `/products/recommended-price${buildQuery({ cost })}`,
  );
}

export function createProduct(input: ProductFormInput): Promise<Product> {
  return apiFetch<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: string, input: Partial<ProductFormInput>): Promise<Product> {
  return apiFetch<Product>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
