import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/States';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you’re looking for doesn’t exist or was moved."
      action={
        <Button asChild>
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
