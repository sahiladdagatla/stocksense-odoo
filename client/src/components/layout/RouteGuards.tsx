import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageLoader } from '@/components/common/States';
import { useAuth } from '@/providers/auth';

/** Requires a signed-in user; remembers where they were going. */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Login/signup/reset pages: signed-in users go straight to the app. */
export function GuestRoute() {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
