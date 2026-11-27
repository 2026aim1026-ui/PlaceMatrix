import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useData } from '../../context/DataContext';
import { ROLE_HOME } from '../../constants/permissions';
import { EMAIL_PATTERN } from '../../utils/validation';
import FormField from '../../components/forms/FormField';
import { Logo } from '../../components/layout/Sidebar';

/** Google Identity Services button, rendered only when the server has GOOGLE_CLIENT_ID configured. */
function GoogleButton({ clientId, domain, onCredential }) {
  const ref = useRef(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google?.accounts?.id || !ref.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => callback.current(r.credential), hd: domain });
      window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', width: 400, text: 'continue_with', shape: 'rectangular', logo_alignment: 'left' });
    };
    if (window.google?.accounts?.id) render();
    else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [clientId, domain]);
  return <div ref={ref} className="flex justify-center" />;
}

/** Shown only while GOOGLE_CLIENT_ID is not configured on the server (development). */
function GoogleFallback({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-secondary h-11 w-full justify-center gap-3">
      <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.4-4.8 7.1l7.6 5.9c4.4-4.1 7-10.1 7-17.5z"/>
        <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
      </svg>
      Continue with Google
    </button>
  );
}

export default function LoginPage() {
  const { session, login, loginWithGoogle } = useAuth();
  const { config } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw] = useState(false);
  const [authError, setAuthError] = useState('');
  const domain = config.allowedDomain || 'iitrpr.ac.in';

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
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
    toast.success('Signed in', `Welcome to PlaceMatrix, ${res.session.name?.split(' ')[0] || ''}.`);
    navigate(target, { replace: true });
  };

  const onSubmit = async (values) => {
    setAuthError('');
    finish(await login(values.email, values.password, values.remember));
  };

  const onGoogle = async (credential) => {
    setAuthError('');
    finish(await loginWithGoogle(credential, true));
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      {/* Brand panel */}
      <section className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <Logo />
        <div className="relative z-10 max-w-md">
          <p className="eyebrow !text-white/50">CDPC · IIT Ropar</p>
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
        <p className="relative z-10 text-[11px] text-white/40">© 2026 CDPC · IIT Ropar</p>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/25 blur-3xl" aria-hidden />
      </section>

      {/* Form */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo dark={false} /></div>
          <h2 className="text-2xl font-bold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-muted">Use your <strong>@{domain}</strong> Google account to access the placement portal.</p>

          <div className="mt-6">
            {config.googleClientId ? (
              <GoogleButton clientId={config.googleClientId} domain={domain} onCredential={onGoogle} />
            ) : (
              <GoogleFallback onClick={() => setAuthError('Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID in backend/.env and restart the backend.')} />
            )}
          </div>

          <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="eyebrow">or sign in with email</span><span className="h-px flex-1 bg-line" /></div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <FormField label="College email" required error={errors.email?.message}>
              <input
                type="email"
                autoComplete="username"
                placeholder={`name@${domain}`}
                className="input h-10"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
                  validate: (v) => v.trim().toLowerCase().endsWith(`@${domain}`) || `Only @${domain} accounts can sign in`,
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
            </div>

            {authError && (
              <p className="rounded-lg border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger" role="alert">{authError}</p>
            )}

            <button type="submit" className="btn btn-primary h-10 w-full" disabled={isSubmitting}>
              <LogIn className="h-4 w-4" /> {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-ink-muted">
            Access is limited to accounts added or invited by CCPC. New students: use the activation link from your invitation.
          </p>
        </div>
      </section>

    </div>
  );
}
