import * as React from 'react';
import { cn } from '@/lib/utils';

/** 42px input, 1px divider border, plum focus border + 3px ring (DESIGN.md). */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-[42px] w-full min-w-0 rounded-lg border border-divider bg-canvas px-3 text-sm text-ink transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-plum focus-visible:ring-[3px] focus-visible:ring-plum/25',
        'aria-invalid:border-danger aria-invalid:ring-danger/20',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
