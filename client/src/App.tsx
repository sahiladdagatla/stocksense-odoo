import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { GuestRoute, ManagerRoute, ProtectedRoute } from '@/components/layout/RouteGuards';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { ProductFormPage } from '@/pages/products/ProductFormPage';
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';
import { WarehousesPage } from '@/pages/settings/WarehousesPage';
import { OperationListPage } from '@/pages/operations/OperationListPage';
import { OperationFormPage } from '@/pages/operations/OperationFormPage';
import { AdjustmentsPage } from '@/pages/operations/AdjustmentsPage';
import { MovesPage } from '@/pages/MovesPage';
import { ScanPage } from '@/pages/ScanPage';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        {/* Scan Mode is full-screen and mobile-first, outside the app shell. */}
        <Route path="/scan" element={<ScanPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route element={<ManagerRoute />}>
            <Route path="/products/new" element={<ProductFormPage />} />
            <Route path="/products/:id/edit" element={<ProductFormPage />} />
          </Route>
          <Route path="/receipts" element={<OperationListPage key="RECEIPT" type="RECEIPT" />} />
          <Route
            path="/receipts/new"
            element={<OperationFormPage key="RECEIPT-new" type="RECEIPT" />}
          />
          <Route
            path="/receipts/:id"
            element={<OperationFormPage key="RECEIPT-edit" type="RECEIPT" />}
          />
          <Route
            path="/deliveries"
            element={<OperationListPage key="DELIVERY" type="DELIVERY" />}
          />
          <Route
            path="/deliveries/new"
            element={<OperationFormPage key="DELIVERY-new" type="DELIVERY" />}
          />
          <Route
            path="/deliveries/:id"
            element={<OperationFormPage key="DELIVERY-edit" type="DELIVERY" />}
          />
          <Route path="/transfers" element={<OperationListPage key="INTERNAL" type="INTERNAL" />} />
          <Route
            path="/transfers/new"
            element={<OperationFormPage key="INTERNAL-new" type="INTERNAL" />}
          />
          <Route
            path="/transfers/:id"
            element={<OperationFormPage key="INTERNAL-edit" type="INTERNAL" />}
          />
          <Route path="/adjustments" element={<AdjustmentsPage />} />
          <Route path="/moves" element={<MovesPage />} />
          <Route path="/settings/warehouses" element={<WarehousesPage />} />
          <Route path="/settings/locations" element={<WarehousesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
