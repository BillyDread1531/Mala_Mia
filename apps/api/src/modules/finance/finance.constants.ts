/**
 * Tipos de movimiento del libro unificado `financial_movements`. La columna
 * es un VARCHAR libre (sin CHECK en BD), así que esta lista es la única
 * fuente de verdad de los valores válidos a nivel de aplicación.
 */
export const MOVEMENT_TYPES = {
  SALE: 'SALE',
  SALE_RETURN: 'SALE_RETURN',
  SALE_CANCELLATION: 'SALE_CANCELLATION',
  SALE_CORRECTION: 'SALE_CORRECTION',
  EXCHANGE_DIFFERENCE: 'EXCHANGE_DIFFERENCE',
  PURCHASE: 'PURCHASE',
  EXPENSE: 'EXPENSE',
  EXPENSE_VOID: 'EXPENSE_VOID',
  /** Ingreso manual (ej. inyección de capital) sin venta de por medio —
   * cuenta para "Ingresos"/"Disponible" pero NUNCA para `netSales`, así que
   * no se reparte como utilidad en "Mi dinero vs. reinversión". */
  MANUAL_INCOME: 'MANUAL_INCOME',
} as const;

export type MovementType = (typeof MOVEMENT_TYPES)[keyof typeof MOVEMENT_TYPES];

/** Todo lo que compone el ciclo de vida económico de una venta (venta,
 * devolución, cancelación, corrección, diferencia de cambio). Se usa para
 * calcular el ingreso neto real de ventas en un periodo, sin mezclarlo con
 * compras o gastos. */
export const SALE_LIFECYCLE_MOVEMENT_TYPES: MovementType[] = [
  MOVEMENT_TYPES.SALE,
  MOVEMENT_TYPES.SALE_RETURN,
  MOVEMENT_TYPES.SALE_CANCELLATION,
  MOVEMENT_TYPES.SALE_CORRECTION,
  MOVEMENT_TYPES.EXCHANGE_DIFFERENCE,
];

export const EXPENSE_MOVEMENT_TYPES: MovementType[] = [
  MOVEMENT_TYPES.EXPENSE,
  MOVEMENT_TYPES.EXPENSE_VOID,
];

/**
 * `reference_type` de `inventory_movements` que corresponden al ciclo de
 * vida de una venta (y por tanto representan costo de mercadería vendida).
 * Deliberadamente EXCLUYE 'purchase' (compra de mercadería, no es costo de
 * lo vendido) y 'adjustment' (ajuste manual, no es una venta).
 */
export const COGS_REFERENCE_TYPES = [
  'sale',
  'return',
  'exchange',
  'cancellation',
  'correction',
];
