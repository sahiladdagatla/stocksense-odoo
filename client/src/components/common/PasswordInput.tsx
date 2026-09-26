import { forwardRef, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  function PasswordInput(props, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={show ? 'text' : 'password'} className="pr-11" {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-row-hover"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
