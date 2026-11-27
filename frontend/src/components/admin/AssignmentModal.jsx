import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Briefcase } from 'lucide-react';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import FormField from '../forms/FormField';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';

/**
 * CDPC: change the SPOC and/or verifier of a recruitment — also while its drives are running.
 * The server records the change in assignment_history and access moves to the new person immediately.
 * `focus` ('SPOC' | 'VERIFIER') only decides which picker is shown first.
 */
export default function AssignmentModal({ company, focus = 'SPOC', onClose }) {
  const { db, adminById, repo } = useData();
  const toast = useToast();
  const [spocId, setSpocId] = useState('');
  const [verifierId, setVerifierId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!company) return;
    setSpocId(company.spocId || '');
    setVerifierId(company.verifierId || '');
    setReason('');
    setError('');
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!company) return null;
  const spocs = db.adminUsers.filter((u) => u.role === 'SPOC');
  const verifiers = db.adminUsers.filter((u) => u.role === 'VERIFIER');
  const load = (u, key) => db.companies.filter((c) => c[key] === u.id).length;
  const drives = db.drives.filter((d) => d.companyId === company.id);
  const running = drives.filter((d) => d.status === 'OPEN' || d.status === 'FROZEN');
  const applicants = db.applications.filter((a) => drives.some((d) => d.id === a.driveId) && a.stage !== 'WITHDRAWN').length;
  const spocChanged = (spocId || null) !== (company.spocId || null);
  const verifierChanged = (verifierId || null) !== (company.verifierId || null);

  const save = async () => {
    const patch = {};
    if (spocChanged) patch.spocId = spocId || null;
    if (verifierChanged) patch.verifierId = verifierId || null;
    if (!Object.keys(patch).length) { onClose(); return; }
    patch.reason = reason.trim();
    setBusy(true);
    const res = await repo.updateAssignment(company.id, patch);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    const parts = [];
    if (spocChanged) parts.push(`SPOC → ${adminById.get(spocId)?.name || 'unassigned'}`);
    if (verifierChanged) parts.push(`Verifier → ${adminById.get(verifierId)?.name || 'unassigned'}`);
    toast.success('Assignment saved', `${company.name}: ${parts.join(', ')}`);
    onClose();
  };

  // Plain render helper (not a component) so the <select> keeps focus across re-renders.
  const picker = ({ label, icon: Icon, users, value, onChange, current, keyName }) => (
    <FormField label={<span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</span>}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Unassigned —</option>
        {users.map((u) => (
          <option key={u.id} value={u.id} disabled={!u.isActive && u.id !== current}>
            {u.name} · {load(u, keyName)} recruitment(s){u.id === current ? ' · current' : ''}{!u.isActive ? ' · inactive' : ''}{keyName === 'verifierId' && !u.canVerify ? ' · view-only' : ''}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-ink-muted">Currently: <strong className="text-ink">{adminById.get(current)?.name || 'Unassigned'}</strong></p>
    </FormField>
  );

  return (
    <Modal
      open={Boolean(company)}
      onClose={busy ? () => {} : onClose}
      title={`Recruitment team — ${company.name}`}
      description={`${drives.length} drive(s) · ${running.length} running · ${applicants} active applicant(s)`}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || (!spocChanged && !verifierChanged)}>{busy ? 'Saving…' : 'Save assignment'}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {focus === 'VERIFIER' ? (
          <>
            {picker({ label: "Recruitment verifier", icon: ShieldCheck, users: verifiers, value: verifierId, onChange: setVerifierId, current: company.verifierId, keyName: "verifierId" })}
            {picker({ label: "SPOC", icon: Briefcase, users: spocs, value: spocId, onChange: setSpocId, current: company.spocId, keyName: "spocId" })}
          </>
        ) : (
          <>
            {picker({ label: "SPOC", icon: Briefcase, users: spocs, value: spocId, onChange: setSpocId, current: company.spocId, keyName: "spocId" })}
            {picker({ label: "Recruitment verifier", icon: ShieldCheck, users: verifiers, value: verifierId, onChange: setVerifierId, current: company.verifierId, keyName: "verifierId" })}
          </>
        )}
        <FormField label="Reason (saved in the assignment history)">
          <input className="input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. SPOC on leave during interview week" />
        </FormField>
        {(spocChanged || verifierChanged) && running.length > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-warning-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{running.length} drive(s) are running. The change applies immediately: the previous person loses access to this recruitment's roster{verifierChanged ? ' and submitted resumes' : ''}, the new person gains it. Applications, stages and history are kept.</span>
          </p>
        )}
        <ul className="space-y-1 text-[11px] text-ink-muted">
          <li><StatusBadge status="OPEN" label="SPOC" /> manages drives, roster, shortlists and can email this recruitment's students.</li>
          <li><StatusBadge status="SHORTLISTED" label="Verifier" /> reviews the resumes submitted to this recruitment.</li>
        </ul>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
