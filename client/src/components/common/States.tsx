import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-plum-tint text-plum">
        <Icon className="size-7" aria-hidden />
      </div>
      <h3 className="font-display text-headline-sm font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <AlertTriangle className="mb-3 size-8 text-danger" aria-hidden />
      <p className="font-medium text-ink">Couldn’t load this data</p>
      <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-plum" aria-label="Loading" />
    </div>
  );
}
