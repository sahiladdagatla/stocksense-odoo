import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/providers/auth';

// Interim shell; the full dashboard (KPIs, chart, reorder panel) is built in Phase 10.
export function DashboardPage() {
  const { user } = useAuth();
  return <PageHeader title="Dashboard" subtitle={`Signed in as ${user?.name ?? ''}`} />;
}
