import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

/** Six single-digit boxes with auto-advance, backspace-to-previous and paste support. */
export function OtpInput({
  value,
  onChange,
  invalid,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  length?: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const setAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').slice(0, length));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i]) {
      e.preventDefault();
      setAt(i - 1, '');
      focus(i - 1);
    } else if (e.key === 'ArrowLeft') focus(i - 1);
    else if (e.key === 'ArrowRight') focus(i + 1);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            setAt(i, v);
            if (v) focus(i + 1);
          }}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-14 w-full max-w-12 rounded-lg border bg-deck text-center font-mono text-xl font-semibold text-ink outline-none',
            'focus:border-plum focus:bg-canvas focus:ring-[3px] focus:ring-plum/25',
            invalid ? 'border-danger' : 'border-divider',
          )}
        />
      ))}
    </div>
  );
}
