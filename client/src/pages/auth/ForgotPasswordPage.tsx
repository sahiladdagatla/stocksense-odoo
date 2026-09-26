import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock, Info, Loader2, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/common/FormField';
import { OtpInput } from '@/components/common/OtpInput';
import { PasswordInput } from '@/components/common/PasswordInput';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emailRule, passwordRule } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { AuthHeading, AuthLayout } from './AuthLayout';

const STEPS = ['Email', 'Verify code', 'New password'];
const RESEND_SECONDS = 60; // matches the server's resend cooldown

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex items-start">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i > 0 && (
              <span
                className={cn(
                  'absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2',
                  i <= step ? 'bg-plum-pipeline' : 'bg-divider',
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                'relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold',
                done && 'border-plum-pipeline bg-plum-pipeline text-white',
                active && 'border-plum-pipeline bg-canvas text-plum-pipeline',
                !done && !active && 'border-divider bg-canvas text-muted-foreground',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span
              className={cn(
                'text-xs',
                active ? 'font-semibold text-plum-pipeline' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    const parsed = emailRule.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid email');
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email: parsed.data });
      setEmail(parsed.data);
      setCooldown(RESEND_SECONDS);
      setStep(1);
      toast.success('If that account exists, a code is on its way.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const pw = passwordRule.safeParse(password);
    if (!pw.success) return setError(pw.error.issues[0]?.message ?? 'Invalid password');
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword: password });
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      // A wrong or expired code sends the user back to re-enter it.
      if (err instanceof ApiError && (err.code === 'INVALID_OTP' || err.code === 'OTP_LOCKED')) {
        setStep(1);
        setOtp('');
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (step === 0) void sendCode();
    else if (step === 1) {
      if (otp.length !== 6) return setError('Enter all 6 digits');
      setError(null);
      setStep(2);
    } else void resetPassword();
  }

  return (
    <AuthLayout>
      <AuthHeading
        title="Reset password"
        subtitle="Verify your identity to regain warehouse access."
      />
      <Stepper step={step} />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.16 }}
            className="space-y-4"
          >
            {step === 0 && (
              <FormField label="Work email" htmlFor="email" hint="We’ll email you a 6-digit code.">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
            )}
            {step === 1 && (
              <>
                <div className="flex items-start gap-3 rounded-lg border border-info-fg/15 bg-info-bg p-4 text-sm text-info-fg">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    We sent a 6-digit code to
                    <p className="truncate font-semibold">{email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    <Pencil className="size-3" /> Change
                  </button>
                </div>
                <FormField label="Enter authentication code">
                  <OtpInput value={otp} onChange={setOtp} invalid={!!error} />
                </FormField>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Didn’t receive the code?</span>
                  {cooldown > 0 ? (
                    <span className="flex items-center gap-1.5 font-mono text-xs">
                      <Clock className="size-3.5" /> Resend in 0:{String(cooldown).padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void sendCode()}
                      className="font-medium text-link hover:underline"
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <FormField
                  label="New password"
                  htmlFor="password"
                  hint="8+ characters with at least one letter and one number"
                >
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </FormField>
                <FormField label="Confirm new password" htmlFor="confirm">
                  <PasswordInput
                    id="confirm"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </FormField>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {step === 0 ? 'Send code' : step === 1 ? 'Verify & continue' : 'Update password'}
          <ArrowRight />
        </Button>
      </form>
      <Link
        to="/login"
        className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-link hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </AuthLayout>
  );
}
