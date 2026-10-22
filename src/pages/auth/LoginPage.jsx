import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, ShieldCheck, Briefcase, Landmark, LogIn, RefreshCcw, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useData } from '../../context/DataContext';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../data/seedData';
import { ROLE_HOME } from '../../constants/permissions';
import { EMAIL_PATTERN } from '../../utils/validation';
import FormField from '../../components/forms/FormField';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { Logo } from '../../components/layout/Sidebar';

const ICONS = { student: GraduationCap, verifier: ShieldCheck, spoc: Briefcase, ccpc: Landmark };

export default function LoginPage() {
  const { session, login } = useAuth();
  const { repo } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw] = useState(false);
  const [authError, setAuthError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: '', password: '', remember: true },
  });

  if (session) return <Navigate to={ROLE_HOME[session.role]} replace />;

  const finish = (res) => {
    if (!res.ok) {
      setAuthError(res.error);
      return;
    }
    const from = location.state?.from;
    const home = ROLE_HOME[res.session.role];
    const target = from && from.startsWith(res.session.role === 'STUDENT' ? '/student' : '/admin') ? from : home;
    toast.success('Signed in', 'Welcome to PlaceMatrix.');
    navigate(target, { replace: true });
  };

  const onSubmit = (values) => {
    setAuthError('');
    finish(login(values.email, values.password, values.remember));
  };

  const quickLogin = (account) => {
    setValue('email', account.email);
    setValue('password', DEMO_PASSWORD);
    setAuthError('');
    finish(login(account.email, DEMO_PASSWORD, true));
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      {/* Brand panel */}
      <section className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <Logo />
        <div className="relative z-10 max-w-md">
          <p className="eyebrow !text-white/50">Campus Placement Management</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">One verified record. Every drive. Full audit trail.</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            Students apply with a faculty-verified profile, SPOCs run their drives, and CCPC governs deadlines,
            verification and policy locks from a single desk.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3 text-[13px]">
            {[
              ['Eligibility', 'Computed from verified records'],
              ['Verification', 'Claimed vs. proof, side by side'],
              ['Shortlisting', 'Paste roll numbers, apply in bulk'],
              ['Governance', 'Append-only audit log'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="font-semibold">{t}</p>
                <p className="mt-0.5 text-[11.5px] text-white/55">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-[11px] text-white/40">PlaceMatrix · CS509 PGSL · Frontend demonstration build</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/25 blur-3xl" aria-hidden />
      </section>

      {/* Form */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo dark={false} /></div>
          <h2 className="text-2xl font-bold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-muted">Use your college email to access the placement portal.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
            <FormField label="College email" required error={errors.email?.message}>
              <input
                type="email"
                autoComplete="username"
                placeholder="2026aim1028@placematrix.edu"
                className="input h-10"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
                })}
              />
            </FormField>

            <FormField label="Password" required error={errors.password?.message} htmlFor="login-password">
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`input h-10 pr-10 ${errors.password ? 'input-error' : ''}`}
                  aria-invalid={errors.password ? 'true' : undefined}
                  {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Password must be at least 6 characters' } })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" className="h-4 w-4 rounded border-line text-brand focus:ring-brand" {...register('remember')} />
                Remember me
              </label>
              <span className="text-xs text-ink-muted">Password for all demo accounts: <code className="mono font-semibold text-ink">{DEMO_PASSWORD}</code></span>
            </div>

            {authError && (
              <p className="rounded-lg border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger" role="alert">{authError}</p>
            )}

            <button type="submit" className="btn btn-primary h-10 w-full" disabled={isSubmitting}>
              <LogIn className="h-4 w-4" /> Sign in
            </button>
          </form>

          <div className="mt-8">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="eyebrow">Quick demo login</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {DEMO_ACCOUNTS.map((a) => {
                const Icon = ICONS[a.key];
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => quickLogin(a)}
                    className="group flex items-start gap-2.5 rounded-xl border border-line bg-white p-3 text-left transition hover:border-brand/50 hover:shadow-md"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand group-hover:bg-brand group-hover:text-white">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink">{a.label}</span>
                      <span className="block truncate text-[11px] text-ink-muted">{a.name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-lg bg-white p-3 text-[11.5px] text-ink-muted ring-1 ring-line">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
            <p>
              Mock authentication for demonstration only — not production security. Data is stored in this browser&apos;s localStorage.
              Any seeded student email (e.g. <code className="mono">2026csb1050@placematrix.edu</code>) also works.
              <button type="button" onClick={() => setConfirmReset(true)} className="ml-1 inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                <RefreshCcw className="h-3 w-3" /> Reset demo data
              </button>
            </p>
          </div>
        </div>
      </section>

      <ConfirmationDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { repo.resetDemoData(); setConfirmReset(false); toast.success('Demo data reset', 'The original dataset has been restored.'); }}
        tone="danger"
        title="Reset demo data?"
        confirmLabel="Reset data"
        message="All changes made in this browser will be replaced with the original seed dataset."
      />
    </div>
  );
}
