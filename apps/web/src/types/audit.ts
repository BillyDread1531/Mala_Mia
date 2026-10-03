export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  userName: string;
  createdAt: string;
}

export interface ActivityListResponse {
  items: ActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** Cubre tanto las acciones ya registradas en `financial_movements` (Fase
 * 10) como las nuevas de `audit_logs` — ambas llegan combinadas desde
 * `/audit`, así que una sola tabla de etiquetas basta para mostrarlas. */
export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  SALE: 'Venta',
  SALE_RETURN: 'Devolución',
  SALE_CANCELLATION: 'Cancelación',
  SALE_CORRECTION: 'Corrección',
  EXCHANGE_DIFFERENCE: 'Cambio',
  PURCHASE: 'Compra',
  EXPENSE: 'Gasto',
  EXPENSE_VOID: 'Anulación de gasto',
  MANUAL_INCOME: 'Ingreso manual',
  LOGIN: 'Inicio de sesión',
  PASSWORD_CHANGED: 'Cambio de contraseña',
  SETTINGS_UPDATED: 'Configuración',
  SUPPLIER_UPDATED: 'Proveedor editado',
  SUPPLIER_ACTIVE_CHANGED: 'Proveedor activado/desactivado',
  USER_ACTIVE_CHANGED: 'Usuario activado/desactivado',
  INVENTORY_ADJUSTED: 'Ajuste de inventario',
  PRODUCT_ACTIVE_CHANGED: 'Producto activado/desactivado',
};
