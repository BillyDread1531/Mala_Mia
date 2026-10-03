import { Prisma } from '@prisma/client';

export interface FinanceBreakdown {
  ventas: Prisma.Decimal;
  devoluciones: Prisma.Decimal;
  cancelaciones: Prisma.Decimal;
  correcciones: Prisma.Decimal;
  cambios: Prisma.Decimal;
  compras: Prisma.Decimal;
  gastos: Prisma.Decimal;
  ingresoManual: Prisma.Decimal;
}

export interface FinanceDistribution {
  hasProfit: boolean;
  realProfit: Prisma.Decimal;
  personalPercentage: Prisma.Decimal;
  reinvestmentPercentage: Prisma.Decimal;
  reservePercentage: Prisma.Decimal;
  personalAmount: Prisma.Decimal;
  reinvestmentAmount: Prisma.Decimal;
  reserveAmount: Prisma.Decimal;
}

export interface FinanceSummary {
  period: { from: Date; to: Date; label: string };
  ingresos: Prisma.Decimal;
  salidas: Prisma.Decimal;
  disponible: Prisma.Decimal;
  /** Ventas netas del periodo (venta - devoluciones - cancelaciones +/-
   * correcciones y cambios), misma lógica que alimenta la utilidad real. */
  netSales: Prisma.Decimal;
  /** Costo de la mercadería realmente vendida en el periodo (COGS). */
  cogs: Prisma.Decimal;
  breakdown: FinanceBreakdown;
  distribution: FinanceDistribution;
}

export type MovementWithRelations = Prisma.financial_movementsGetPayload<{
  include: { payment_methods: true; users: true };
}>;

export interface FinanceMovementView {
  id: bigint;
  movementType: string;
  direction: 'IN' | 'OUT';
  amount: Prisma.Decimal;
  paymentMethod: { id: bigint; name: string } | null;
  referenceType: string | null;
  referenceId: bigint | null;
  description: string;
  movementDate: Date;
  createdByName: string;
}

export function toMovementView(
  movement: MovementWithRelations,
): FinanceMovementView {
  return {
    id: movement.id,
    movementType: movement.movement_type,
    direction: movement.direction as 'IN' | 'OUT',
    amount: movement.amount,
    paymentMethod: movement.payment_methods
      ? { id: movement.payment_methods.id, name: movement.payment_methods.name }
      : null,
    referenceType: movement.reference_type,
    referenceId: movement.reference_id,
    description: movement.description,
    movementDate: movement.movement_date,
    createdByName: movement.users.full_name,
  };
}

export interface DistributionSettingsView {
  personalPercentage: Prisma.Decimal;
  reinvestmentPercentage: Prisma.Decimal;
  reservePercentage: Prisma.Decimal;
  updatedAt: Date;
}
