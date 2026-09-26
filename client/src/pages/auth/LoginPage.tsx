import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { errorMessage } from '@/lib/api';
import { emailRule } from '@/lib/validation';
import { useAuth } from '@/providers/auth';
import { AuthHeading, AuthLayout } from './AuthLayout';

const schema = z.object({
  email: emailRule,
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

const DEMO = [
  { label: 'Manager', email: 'manager@stocksense.dev', password: 'Manager@123' },
  { label: 'Staff', email: 'staff@stocksense.dev', password: 'Staff@123' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', remember: true },
  });

  const onSubmit = async (v: Values) => {
    try {
      const user = await login(v.email, v.password, v.remember);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <AuthLayout>
      <AuthHeading title="Sign in" subtitle="Access real-time stock balances and dispatch orders" />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Work email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <Checkbox
              checked={watch('remember')}
              onCheckedChange={(c) => setValue('remember', c === true)}
            />
            Remember me on this workstation
          </label>
          <Link to="/forgot-password" className="text-sm font-medium text-link hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Sign in <ArrowRight />
        </Button>
      </form>

      <p className="mt-6 border-t border-divider pt-5 text-center text-sm text-muted-foreground">
        New to StockSense?{' '}
        <Link to="/signup" className="font-medium text-link hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-5 rounded-lg bg-deck p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Demo accounts
        </p>
        <div className="flex gap-2">
          {DEMO.map((d) => (
            <Button
              key={d.label}
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setValue('email', d.email, { shouldValidate: true });
                setValue('password', d.password, { shouldValidate: true });
              }}
            >
              Use {d.label}
            </Button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
