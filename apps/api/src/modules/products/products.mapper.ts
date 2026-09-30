import { Prisma } from '@prisma/client';

export type ProductWithRelations = Prisma.productsGetPayload<{
  include: {
    categories: true;
    product_variants: { include: { sizes: true; colors: true } };
  };
}>;

export interface ProductVariantView {
  sizeId: bigint;
  sizeName: string;
  colorId: bigint;
  colorName: string;
}

export interface ProductView {
  id: bigint;
  code: string;
  name: string;
  description: string | null;
  category: { id: bigint; name: string };
  cost: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  recommendedPrice: Prisma.Decimal | null;
  isAvailableForSale: boolean;
  variants: ProductVariantView[];
  variantCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const RECOMMENDED_PRICE_DECIMALS = 2;

/**
 * precio recomendado = costo / (1 - margen/100), usando Prisma.Decimal
 * (decimal.js) para no representar dinero con floats.
 * Devuelve null cuando el resultado no tiene sentido de negocio: sin costo,
 * costo negativo, o margen fuera de [0, 100).
 */
export function calculateRecommendedPrice(
  cost: Prisma.Decimal | null | undefined,
  marginPercent: number,
): Prisma.Decimal | null {
  if (cost === null || cost === undefined) return null;
  if (cost.isNegative()) return null;
  if (
    !Number.isFinite(marginPercent) ||
    marginPercent < 0 ||
    marginPercent >= 100
  ) {
    return null;
  }

  const divisor = new Prisma.Decimal(1).minus(
    new Prisma.Decimal(marginPercent).dividedBy(100),
  );
  if (divisor.lessThanOrEqualTo(0)) return null;

  return cost.dividedBy(divisor).toDecimalPlaces(RECOMMENDED_PRICE_DECIMALS);
}

export function toProductView(
  product: ProductWithRelations,
  marginPercent: number,
): ProductView {
  const activeVariants = product.product_variants.filter(
    (variant) => variant.is_active,
  );

  return {
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    category: { id: product.categories.id, name: product.categories.name },
    cost: product.cost,
    salePrice: product.sale_price,
    recommendedPrice: calculateRecommendedPrice(product.cost, marginPercent),
    isAvailableForSale: product.is_available_for_sale,
    variantCount: activeVariants.length,
    variants: activeVariants.map((variant) => ({
      sizeId: variant.size_id,
      sizeName: variant.sizes.name,
      colorId: variant.color_id,
      colorName: variant.colors.name,
    })),
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}
