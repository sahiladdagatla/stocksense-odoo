import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { errorMessage } from '@/lib/api';
import { emailRule, nameRule, passwordRule } from '@/lib/validation';
import { useAuth } from '@/providers/auth';
import { AuthHeading, AuthLayout } from './AuthLayout';

const schema = z
  .object({ name: nameRule, email: emailRule, password: passwordRule, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });
type Values = z.infer<typeof schema>;

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  });

  const onSubmit = async (v: Values) => {
    try {
      await signup(v.name, v.email, v.password);
      toast.success('Account created');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <AuthLayout>
      <AuthHeading
        title="Create your account"
        subtitle="New accounts start with Staff access. A manager can grant more later."
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormField label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="Work email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </FormField>
        <FormField
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="8+ characters with at least one letter and one number"
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            aria-invalid={!!errors.confirm}
            {...register('confirm')}
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Create account <ArrowRight />
        </Button>
      </form>
      <p className="mt-6 border-t border-divider pt-5 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-link hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
