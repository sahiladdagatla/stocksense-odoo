import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

/** Buttons per DESIGN.md: 44px regular / 34px compact, 8px radius, plum primary. */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-plum/25 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-plum text-primary-foreground hover:bg-plum-deep',
        teal: 'bg-teal text-white hover:bg-teal/90',
        outline: 'border border-divider bg-canvas text-ink hover:bg-deck',
        warning: 'border border-warning bg-transparent text-warning hover:bg-warning/10',
        destructive: 'bg-danger text-white hover:bg-danger/90',
        'ghost-danger': 'text-danger hover:bg-danger/10',
        ghost: 'text-ink hover:bg-row-hover',
        link: 'h-auto px-0 text-link underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-[34px] px-3 text-[13px]',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'size-11',
        'icon-sm': 'size-[34px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
