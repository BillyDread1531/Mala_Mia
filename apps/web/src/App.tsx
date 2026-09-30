import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { NotificationProvider } from './notifications/NotificationContext';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { MorePage } from './pages/MorePage';

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
                <Route path="/inventario" element={<ComingSoonPage title="Inventario" />} />
                <Route path="/compras" element={<ComingSoonPage title="Compras" />} />
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
