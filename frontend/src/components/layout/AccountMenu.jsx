import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, RefreshCcw, Check, UserRound, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { ROLE_HOME } from '../../constants/permissions';
import { api } from '../../api/client';
import Avatar from '../common/Avatar';
import ConfirmationDialog from '../common/ConfirmationDialog';
import Modal from '../common/Modal';
import FormField from '../forms/FormField';

/** Account menu: switch demo accounts (demo mode), change password, reset demo data, log out. */
export default function AccountMenu({ user, statusLine, openSignal }) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const ref = useRef(null);
  const { loginAs, logout, session } = useAuth();
  const { repo, config } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const demo = Boolean(config.demoMode);

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const currentEmail = session?.email;

  const switchTo = async (account) => {
    setOpen(false);
    const res = await loginAs(account.email);
    if (res.ok) {
      navigate(ROLE_HOME[res.session.role]);
      toast.info('Switched account', `Now signed in as ${account.name}`);
    } else {
      toast.error('Could not switch', res.error);
    }
  };

  const doReset = async () => {
    const res = await repo.resetDemoData();
    setConfirmReset(false);
    setOpen(false);
    if (!res.ok) { toast.error('Reset failed', res.error); return; }
    try {
      await repo.refresh();
    } catch {
      logout();
      navigate('/login');
    }
    toast.success('Demo data reset', 'The original dataset has been restored in PostgreSQL.');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg py-1 pl-2 pr-1 hover:bg-canvas"
      >
        <div className="hidden text-right leading-tight md:block">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{demo ? 'Demo account ▾' : 'Signed in ▾'}</p>
          <p className="text-xs font-semibold text-ink">{user.name}</p>
          <p className="text-[10px] font-medium text-brand">{statusLine}</p>
        </div>
        <Avatar name={user.name} />
        <ChevronDown className="h-3.5 w-3.5 text-ink-muted md:hidden" aria-hidden />
      </button>

      {open && (
        <div role="menu" className="pop-in absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-line bg-white p-1.5 shadow-pop">
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="text-sm font-semibold text-ink">{user.name}</p>
            <p className="text-xs text-ink-muted">{user.subtitle}</p>
            <p className="mono truncate text-[11px] text-ink-muted">{currentEmail}</p>
          </div>
          {demo && config.demoAccounts?.length > 0 && (
            <>
              <p className="eyebrow px-2.5 pb-1 pt-2">Switch demo account</p>
              {config.demoAccounts.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  role="menuitem"
                  onClick={() => switchTo(a)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-canvas"
                >
                  <UserRound className="h-4 w-4 text-ink-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">{a.label} — {a.name}</span>
                    <span className="block text-[11px] text-ink-muted">{a.hint}</span>
                  </span>
                  {currentEmail === a.email && <Check className="h-4 w-4 text-brand" aria-label="Current account" />}
                </button>
              ))}
            </>
          )}
          <div className="my-1.5 border-t border-line" />
          <button type="button" role="menuitem" onClick={() => { setPwOpen(true); setOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-ink hover:bg-canvas">
            <KeyRound className="h-4 w-4 text-ink-muted" aria-hidden /> Change password
          </button>
          {demo && (
            <button type="button" role="menuitem" onClick={() => setConfirmReset(true)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-ink hover:bg-canvas">
              <RefreshCcw className="h-4 w-4 text-ink-muted" aria-hidden /> Reset demo data
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => { logout(); navigate('/login'); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-danger hover:bg-danger-50">
            <LogOut className="h-4 w-4" aria-hidden /> Log out
          </button>
        </div>
      )}

      <ConfirmationDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={doReset}
        tone="danger"
        title="Reset demo data?"
        confirmLabel="Reset data"
        message="All applications, verifications, tickets, uploads and audit entries in the database will be replaced with the original seed dataset — for every user."
      />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setCurrent(''); setNext(''); setError(''); } }, [open]);

  const submit = async () => {
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    setBusy(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword: current, newPassword: next });
      toast.success('Password changed');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Change password"
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>Save password</button></>}
    >
      <div className="space-y-3">
        <FormField label="Current password"><input type="password" autoComplete="current-password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} /></FormField>
        <FormField label="New password" hint="At least 8 characters"><input type="password" autoComplete="new-password" className="input" value={next} onChange={(e) => setNext(e.target.value)} /></FormField>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
