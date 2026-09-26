import type { ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ALL = '__all__';

/** Select with an "All …" option; `value` is undefined when nothing is filtered. */
export function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
  icon,
  className,
  ariaLabel,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  allLabel?: string;
  options: { value: string; label: ReactNode }[];
  icon?: ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn('h-10 min-w-40 rounded-lg border-divider bg-canvas', className)}
      >
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
