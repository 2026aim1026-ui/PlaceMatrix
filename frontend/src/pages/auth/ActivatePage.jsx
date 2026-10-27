import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, MailCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import FormField from '../../components/forms/FormField';
import { Logo } from '../../components/layout/Sidebar';

/** One-time activation link from a CCPC invitation: the invited student sets a password. */
export default function ActivatePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { activate } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setLoadError('This activation link is incomplete.'); return; }
    api.get(`/api/auth/invite-info?token=${encodeURIComponent(token)}`, { auth: false })
      .then(setInfo)
      .catch(() => setLoadError('This activation link is invalid or has already been used. Sign in instead, or ask CCPC to resend your invitation.'));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Choose a password of at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    const res = await activate(token, password);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    toast.success('Account activated', 'Accept your placement invitation to create your profile.');
    navigate('/student/invitation', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6"><Logo dark={false} /></div>
        <section className="card card-pad">
          {loadError ? (
            <>
              <h1 className="text-lg font-bold text-ink">Activation link not valid</h1>
              <p className="mt-2 text-sm text-ink-muted">{loadError}</p>
              <Link to="/login" className="btn btn-primary mt-5">Go to sign in</Link>
            </>
          ) : !info ? (
            <p className="py-6 text-center text-sm text-ink-muted">Checking your invitation…</p>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand"><MailCheck className="h-5 w-5" /></span>
                <div>
                  <h1 className="text-lg font-bold text-ink">Welcome, {info.name.split(' ')[0]}</h1>
                  <p className="text-sm text-ink-muted">Entry No. {info.entryNo} · {info.email}</p>
                </div>
              </div>
              {info.expired && <p className="rounded-md bg-danger-50 px-3 py-2 text-xs text-danger">This link has expired. Ask CCPC to resend your invitation.</p>}
              <FormField label="Create a password" required hint="At least 8 characters">
                <input type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
              </FormField>
              <FormField label="Confirm password" required>
                <input type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </FormField>
              {error && <p className="rounded-lg border border-danger/20 bg-danger-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary w-full" disabled={busy || info.expired}><KeyRound className="h-4 w-4" /> {busy ? 'Activating…' : 'Activate account'}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
