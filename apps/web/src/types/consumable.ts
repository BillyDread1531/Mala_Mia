export interface Consumable {
  id: string;
  name: string;
  quantity: number;
  lowStockThreshold: number;
  unitsPerSale: number;
  isActive: boolean;
  status: 'AGOTADO' | 'STOCK_BAJO' | 'DISPONIBLE';
  updatedAt: string;
}

export interface CreateConsumableInput {
  name: string;
  quantity?: number;
  lowStockThreshold?: number;
  unitsPerSale?: number;
  /** Costo total de la existencia inicial (opcional): si se manda, se
   * registra como gasto real — requiere `paymentMethodId`. */
  cost?: number;
  paymentMethodId?: number;
}

export interface UpdateConsumableInput {
  name?: string;
  lowStockThreshold?: number;
  unitsPerSale?: number;
}
