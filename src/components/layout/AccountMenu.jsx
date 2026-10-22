import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, RefreshCcw, Check, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { DEMO_ACCOUNTS } from '../../data/seedData';
import { ROLE_HOME } from '../../constants/permissions';
import Avatar from '../common/Avatar';
import ConfirmationDialog from '../common/ConfirmationDialog';

/** "Simulated actor" menu: switch demo accounts, reset demo data, log out. */
export default function AccountMenu({ user, statusLine, openSignal }) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef(null);
  const { loginAs, logout, session } = useAuth();
  const { db, repo } = useData();
  const toast = useToast();
  const navigate = useNavigate();

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

  const currentEmail = session?.inviteId
    ? db.invitations.find((i) => i.id === session.inviteId)?.email
    : (db.adminUsers.find((u) => u.id === session?.userId) || db.students.find((s) => s.id === session?.userId))?.email;

  const switchTo = (email) => {
    const res = loginAs(email);
    setOpen(false);
    if (res.ok) {
      navigate(ROLE_HOME[res.session.role]);
      toast.info('Switched account', `Now viewing as ${DEMO_ACCOUNTS.find((a) => a.email === email)?.name}`);
    }
  };

  const doReset = () => {
    repo.resetDemoData();
    setConfirmReset(false);
    setOpen(false);
    const stillExists = session?.inviteId
      ? true
      : repo.getState().adminUsers.some((u) => u.id === session?.userId) || repo.getState().students.some((s) => s.id === session?.userId);
    if (!stillExists) {
      logout();
      navigate('/login');
    }
    toast.success('Demo data reset', 'The original dataset has been restored.');
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
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Simulated actor ▾</p>
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
          </div>
          <p className="eyebrow px-2.5 pb-1 pt-2">Switch demo account</p>
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              onClick={() => switchTo(a.email)}
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
          <div className="my-1.5 border-t border-line" />
          <button type="button" role="menuitem" onClick={() => setConfirmReset(true)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-ink hover:bg-canvas">
            <RefreshCcw className="h-4 w-4 text-ink-muted" aria-hidden /> Reset demo data
          </button>
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
        message="All applications, verifications, tickets, uploads and audit entries created in this browser will be replaced with the original seed dataset."
      />
    </div>
  );
}
