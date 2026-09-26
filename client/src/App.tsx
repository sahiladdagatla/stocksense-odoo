import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { GuestRoute, ProtectedRoute } from '@/components/layout/RouteGuards';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
