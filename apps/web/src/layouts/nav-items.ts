import type { ComponentType, SVGProps } from 'react';
import {
  ExpensesIcon,
  HomeIcon,
  InventoryIcon,
  MoreIcon,
  PurchasesIcon,
  ReportsIcon,
  SalesIcon,
  SearchIcon,
} from '../components/icons';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const inicio: NavItem = { to: '/', label: 'Inicio', icon: HomeIcon };
const ventas: NavItem = { to: '/ventas', label: 'Ventas', icon: SalesIcon };
const inventario: NavItem = { to: '/inventario', label: 'Inventario', icon: InventoryIcon };
const disponibilidad: NavItem = {
  to: '/disponibilidad',
  label: 'Disponible',
  icon: SearchIcon,
};
const compras: NavItem = { to: '/compras', label: 'Compras', icon: PurchasesIcon };
const finanzas: NavItem = { to: '/finanzas', label: 'Finanzas', icon: ExpensesIcon };
const reportes: NavItem = { to: '/finanzas/reportes', label: 'Reportes', icon: ReportsIcon };
const mas: NavItem = { to: '/mas', label: 'Más', icon: MoreIcon };

// Navegación conceptual definida en CONTEXT.md #4. "Disponibilidad" se agregó
// en Fase 9 como consulta rápida de stock, separada del módulo de Inventario.
// "Finanzas" (Fase 10) reemplaza el antiguo placeholder de "Gastos": es el
// centro económico completo (ingresos, salidas, gastos, distribución), no
// solo el registro de gastos. En móvil, donde la barra inferior ya está
// llena, se llega a Finanzas desde "Registrar gasto" en Inicio o desde "Más".
// "Inventario" vive en "Más" en vez de la barra inferior: con 5 accesos
// directos + el botón "+" quedaba 2 y 3 desbalanceado a cada lado; con 4
// queda 2 y 2 — Inventario es el que menos se usa "sobre la marcha" frente a
// Inicio/Ventas/Disponible.
export const MOBILE_NAV: NavItem[] = [inicio, ventas, disponibilidad, mas];
export const TABLET_NAV: NavItem[] = [
  inicio,
  ventas,
  disponibilidad,
  inventario,
  compras,
  finanzas,
  reportes,
  mas,
];
export const DESKTOP_NAV: NavItem[] = [
  inicio,
  ventas,
  disponibilidad,
  inventario,
  compras,
  finanzas,
  reportes,
];

export interface MoreEntry {
  label: string;
  description: string;
  /** Si se define, el ítem navega ahí en vez de mostrar "próximamente". */
  to?: string;
}

// Contenido de "Más" (CONTEXT.md #4). Desde la Fase 17 todos los ítems
// navegan a una pantalla real (Comprobantes y Actividad ya tienen la suya).
export const MORE_ENTRIES: MoreEntry[] = [
  {
    label: 'Inventario',
    description: 'Catálogo de productos y existencias por talla y color',
    to: '/inventario',
  },
  {
    label: 'Insumos',
    description: 'Bolsas y material de empaque — se descuentan solos con cada venta',
    to: '/insumos',
  },
  {
    label: 'Proveedores',
    description: 'Contactos y compras por proveedor',
    to: '/proveedores',
  },
  { label: 'Finanzas', description: 'Ingresos, gastos y distribución del dinero', to: '/finanzas' },
  {
    label: 'Reportes',
    description: 'Ventas, compras, inventario y utilidad por período',
    to: '/finanzas/reportes',
  },
  {
    label: 'Comprobantes',
    description: 'Encuentra y descarga el comprobante de cualquier venta',
    to: '/comprobantes',
  },
  {
    label: 'Actividad',
    description: 'Qué pasó, cuándo y quién lo hizo',
    to: '/actividad',
  },
  {
    label: 'Configuración',
    description: 'Negocio, catálogo, métodos de pago, gastos y usuarios',
    to: '/configuracion',
  },
];
