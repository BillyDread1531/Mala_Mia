import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { NotificationProvider } from './notifications/NotificationContext';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { MorePage } from './pages/MorePage';
import { ProductsListPage } from './pages/products/ProductsListPage';
import { ProductFormPage } from './pages/products/ProductFormPage';
import { PurchasesListPage } from './pages/purchases/PurchasesListPage';
import { PurchaseFormPage } from './pages/purchases/PurchaseFormPage';
import { PurchaseDetailPage } from './pages/purchases/PurchaseDetailPage';
import { InventoryListPage } from './pages/inventory/InventoryListPage';
import { InventoryDetailPage } from './pages/inventory/InventoryDetailPage';
import { ConsumablesPage } from './pages/consumables/ConsumablesPage';
import { SalesListPage } from './pages/sales/SalesListPage';
import { SaleFormPage } from './pages/sales/SaleFormPage';
import { SaleDetailPage } from './pages/sales/SaleDetailPage';
import { AvailabilityPage } from './pages/availability/AvailabilityPage';
import { AvailabilityDetailPage } from './pages/availability/AvailabilityDetailPage';
import { FinancePage } from './pages/finance/FinancePage';
import { FinanceMovementsPage } from './pages/finance/FinanceMovementsPage';
import { ExpenseFormPage } from './pages/finance/ExpenseFormPage';
import { IncomeFormPage } from './pages/finance/IncomeFormPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SuppliersListPage } from './pages/suppliers/SuppliersListPage';
import { SupplierDetailPage } from './pages/suppliers/SupplierDetailPage';
import { ReceiptsPage } from './pages/receipts/ReceiptsPage';
import { ActivityPage } from './pages/activity/ActivityPage';

function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/ventas" element={<SalesListPage />} />
                <Route path="/ventas/nueva" element={<SaleFormPage />} />
                <Route path="/ventas/:id" element={<SaleDetailPage />} />
                <Route path="/inventario" element={<ProductsListPage />} />
                <Route path="/inventario/nuevo" element={<ProductFormPage />} />
                <Route path="/inventario/stock" element={<InventoryListPage />} />
                <Route path="/inventario/stock/:id" element={<InventoryDetailPage />} />
                <Route path="/inventario/:id" element={<ProductFormPage />} />
                <Route path="/insumos" element={<ConsumablesPage />} />
                <Route path="/compras" element={<PurchasesListPage />} />
                <Route path="/compras/nueva" element={<PurchaseFormPage />} />
                <Route path="/compras/:id" element={<PurchaseDetailPage />} />
                <Route path="/proveedores" element={<SuppliersListPage />} />
                <Route path="/proveedores/:id" element={<SupplierDetailPage />} />
                <Route path="/comprobantes" element={<ReceiptsPage />} />
                <Route path="/actividad" element={<ActivityPage />} />
                <Route path="/disponibilidad" element={<AvailabilityPage />} />
                <Route path="/disponibilidad/:productId" element={<AvailabilityDetailPage />} />
                <Route path="/finanzas" element={<FinancePage />} />
                <Route path="/finanzas/movimientos" element={<FinanceMovementsPage />} />
                <Route path="/finanzas/gastos/nuevo" element={<ExpenseFormPage />} />
                <Route path="/finanzas/ingresos/nuevo" element={<IncomeFormPage />} />
                <Route path="/finanzas/reportes" element={<ReportsPage />} />
                <Route path="/configuracion" element={<SettingsPage />} />
                <Route path="/mas" element={<MorePage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
