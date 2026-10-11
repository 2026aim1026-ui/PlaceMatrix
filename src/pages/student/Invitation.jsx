import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Check, X } from 'lucide-react';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDateTime } from '../../utils/dateUtils';

const STEPS = ['Fee paid', 'CCPC invitation', 'Accept & create profile', 'Faculty verification', 'Apply to drives'];

export default function Invitation() {
  const me = useCurrentUser();
  const { repo } = useData();
  const { updateSession, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmDecline, setConfirmDecline] = useState(false);
  const inv = me.invite;
  if (!inv) return null;

  const accept = () => {
    const res = repo.acceptInvitation(inv.id);
    if (!res.ok) { toast.error('Could not accept', res.error); return; }
    updateSession({ userId: res.result.id, inviteId: null });
    toast.success('Profile created', 'Fill in your Profile Audit and upload your documents.');
    navigate('/student/profile');
  };

  const decline = () => {
    toast.result(repo.declineInvitation(inv.id), 'Invitation declined', 'CCPC has been notified.');
    setConfirmDecline(false);
  };

  const declined = inv.status === 'DECLINED';
  const current = declined ? 1 : 2;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="flex items-center justify-between rounded-xl bg-navy p-5 text-white">
        <div>
          <h1 className="text-xl font-bold">Welcome, {inv.name.split(' ')[0]} <span aria-hidden>👋</span></h1>
          <p className="mt-1 text-[13px] text-white/60">Entry No. {inv.entryNo} · Placement fee: PAID</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${declined ? 'bg-danger text-white' : 'bg-warning text-navy'}`}>{declined ? 'Declined' : 'Invited'}</span>
      </section>

      {declined ? (
        <section className="card card-pad text-sm">
          <p className="font-semibold text-ink">You declined the placement invitation.</p>
          <p className="mt-1 text-ink-muted">If this was a mistake, ask the CCPC office to re-invite you. You can then sign in again.</p>
          <button type="button" className="btn btn-secondary mt-4" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
        </section>
      ) : (
        <section className="card card-pad flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span><strong>CCPC has invited you to Placement Season 2026–27</strong>{inv.updatedAt && <span className="text-ink-muted"> · {formatDateTime(inv.updatedAt)}</span>}<br />
              <span className="text-xs text-ink-muted">Accept to create your PlaceMatrix profile. You can then fill your Profile Audit and upload documents.</span></span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn btn-success" onClick={accept}><Check className="h-4 w-4" /> Accept &amp; create profile</button>
            <button type="button" className="btn btn-danger-soft" onClick={() => setConfirmDecline(true)}><X className="h-4 w-4" /> Decline</button>
          </div>
        </section>
      )}

      <section className="card card-pad">
        <h2 className="card-title mb-5">How onboarding works</h2>
        <ol className="grid grid-cols-5 gap-1">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-col items-center text-center">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${i < current ? 'bg-success text-white' : i === current ? 'border-2 border-brand bg-white text-brand' : 'bg-line text-ink-muted'}`}>{i < current ? '✓' : i + 1}</span>
              <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <ConfirmationDialog
        open={confirmDecline}
        onClose={() => setConfirmDecline(false)}
        onConfirm={decline}
        tone="danger"
        title="Decline placement invitation?"
        confirmLabel="Decline"
        message="You will not be able to participate in campus placements unless CCPC re-invites you."
      />
    </div>
  );
}
