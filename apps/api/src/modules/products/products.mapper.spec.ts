import { Prisma } from '@prisma/client';
import { calculateRecommendedPrice } from './products.mapper';

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

describe('calculateRecommendedPrice', () => {
  it('Q65 costo / 40% margen ≈ Q108.33', () => {
    const result = calculateRecommendedPrice(decimal(65), 40);
    expect(result?.toString()).toBe('108.33');
  });

  it('Q100 costo / 50% margen = Q200', () => {
    const result = calculateRecommendedPrice(decimal(100), 50);
    expect(result?.toString()).toBe('200');
  });

  it('costo 0 devuelve 0 (no es un error de negocio)', () => {
    const result = calculateRecommendedPrice(decimal(0), 35);
    expect(result?.toString()).toBe('0');
  });

  it('costo negativo devuelve null', () => {
    expect(calculateRecommendedPrice(decimal(-10), 35)).toBeNull();
  });

  it('sin costo (null) devuelve null', () => {
    expect(calculateRecommendedPrice(null, 35)).toBeNull();
  });

  it('margen 0% devuelve el mismo costo (sin margen)', () => {
    const result = calculateRecommendedPrice(decimal(80), 0);
    expect(result?.toString()).toBe('80');
  });

  it('margen cercano a 100% produce un valor grande pero válido', () => {
    const result = calculateRecommendedPrice(decimal(10), 99);
    expect(result?.toString()).toBe('1000');
  });

  it('margen exactamente 100% devuelve null (división por cero)', () => {
    expect(calculateRecommendedPrice(decimal(10), 100)).toBeNull();
  });

  it('margen inválido (>100) devuelve null', () => {
    expect(calculateRecommendedPrice(decimal(10), 150)).toBeNull();
  });

  it('margen inválido (negativo) devuelve null', () => {
    expect(calculateRecommendedPrice(decimal(10), -5)).toBeNull();
  });

  it('el precio de venta manual es independiente del recomendado', () => {
    // El cálculo nunca decide el precio de venta; solo informa.
    const recommended = calculateRecommendedPrice(decimal(65), 40);
    const manualSalePrice = decimal(125);
    expect(recommended?.toString()).not.toBe(manualSalePrice.toString());
  });
});
