import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { NotificationProvider } from './notifications/NotificationContext';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { MorePage } from './pages/MorePage';
import { ProductsListPage } from './pages/products/ProductsListPage';
import { ProductFormPage } from './pages/products/ProductFormPage';
import { PurchasesListPage } from './pages/purchases/PurchasesListPage';
import { PurchaseFormPage } from './pages/purchases/PurchaseFormPage';
import { PurchaseDetailPage } from './pages/purchases/PurchaseDetailPage';

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
                <Route path="/ventas" element={<ComingSoonPage title="Ventas" />} />
                <Route path="/inventario" element={<ProductsListPage />} />
                <Route path="/inventario/nuevo" element={<ProductFormPage />} />
                <Route path="/inventario/:id" element={<ProductFormPage />} />
                <Route path="/compras" element={<PurchasesListPage />} />
                <Route path="/compras/nueva" element={<PurchaseFormPage />} />
                <Route path="/compras/:id" element={<PurchaseDetailPage />} />
                <Route path="/gastos" element={<ComingSoonPage title="Gastos" />} />
                <Route path="/reportes" element={<ComingSoonPage title="Reportes" />} />
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
