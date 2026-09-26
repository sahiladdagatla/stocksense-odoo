import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Label (13px medium) + control + hint or error. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
  labelAside,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  labelAside?: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-label font-medium text-ink">
          {label}
          {required && <span className="text-danger"> *</span>}
        </Label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
