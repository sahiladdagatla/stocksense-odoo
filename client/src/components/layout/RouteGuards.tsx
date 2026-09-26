import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, FullPageLoader } from '@/components/common/States';
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

/** Screens that only managers may use (the API enforces the same rule with 403). */
export function ManagerRoute() {
  const { isManager } = useAuth();
  if (isManager) return <Outlet />;
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Managers only"
      description="Your Staff account can view products and run operations, but creating or editing products needs a Manager."
      action={
        <Button asChild variant="outline">
          <Link to="/products">Back to products</Link>
        </Button>
      }
    />
  );
}
