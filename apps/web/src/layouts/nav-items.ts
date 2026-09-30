import type { ComponentType, SVGProps } from 'react';
import {
  ExpensesIcon,
  HomeIcon,
  InventoryIcon,
  MoreIcon,
  PurchasesIcon,
  ReportsIcon,
  SalesIcon,
} from '../components/icons';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const inicio: NavItem = { to: '/', label: 'Inicio', icon: HomeIcon };
const ventas: NavItem = { to: '/ventas', label: 'Ventas', icon: SalesIcon };
const inventario: NavItem = { to: '/inventario', label: 'Inventario', icon: InventoryIcon };
const compras: NavItem = { to: '/compras', label: 'Compras', icon: PurchasesIcon };
const gastos: NavItem = { to: '/gastos', label: 'Gastos', icon: ExpensesIcon };
const reportes: NavItem = { to: '/reportes', label: 'Reportes', icon: ReportsIcon };
const mas: NavItem = { to: '/mas', label: 'Más', icon: MoreIcon };

// Navegación conceptual definida en CONTEXT.md #4.
export const MOBILE_NAV: NavItem[] = [inicio, ventas, inventario, mas];
export const TABLET_NAV: NavItem[] = [inicio, ventas, inventario, compras, reportes, mas];
export const DESKTOP_NAV: NavItem[] = [inicio, ventas, inventario, compras, gastos, reportes];

export interface MoreEntry {
  label: string;
  description: string;
}

// Contenido futuro de "Más" (CONTEXT.md #4). Todavía sin páginas propias.
export const MORE_ENTRIES: MoreEntry[] = [
  { label: 'Proveedores', description: 'Contactos y compras por proveedor' },
  { label: 'Dinero', description: 'Movimientos financieros del negocio' },
  { label: 'Comprobantes', description: 'Historial de comprobantes de venta' },
  { label: 'Usuarios', description: 'Administración de accesos' },
  { label: 'Actividad', description: 'Auditoría de acciones del sistema' },
  { label: 'Configuración', description: 'Preferencias de MALA MÍA' },
];
