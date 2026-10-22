import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import Countdown from '../common/Countdown';
import FormField from '../forms/FormField';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { formatDateTime, toInputDateTime, fromInputDateTime, HOUR, DAY } from '../../utils/dateUtils';

/** CCPC-only deadline extension with quick presets and a mandatory audit reason. */
export default function ExtendDeadlineModal({ drive, onClose }) {
  const { repo, companyById } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (drive) {
      const base = Math.max(Date.now(), new Date(drive.deadline).getTime());
      setValue(toInputDateTime(new Date(base + DAY).toISOString()));
      setReason('');
      setError('');
    }
  }, [drive]);

  if (!drive) return null;
  const company = companyById.get(drive.companyId);
  const base = Math.max(Date.now(), new Date(drive.deadline).getTime());
  const preset = (ms) => setValue(toInputDateTime(new Date(base + ms).toISOString()));

  const submit = () => {
    const iso = fromInputDateTime(value);
    if (!iso) { setError('Choose a valid date and time'); return; }
    if (reason.trim().length < 5) { setError('Enter a reason (at least 5 characters) — it goes into the audit log'); return; }
    const res = repo.extendDeadline(me.actor, drive.id, iso, reason);
    if (toast.result(res, 'Deadline extended', `${company?.name} — ${drive.role} now closes ${formatDateTime(iso)}. Students and the SPOC were notified.`)) onClose();
    else setError(res.error);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Extend Deadline · ${company?.name}`}
      size="sm"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit}>Extend deadline</button>
        </>
      )}
    >
      <dl className="space-y-1.5 rounded-lg bg-canvas p-3 text-sm">
        <div className="flex justify-between"><dt className="text-ink-muted">Role</dt><dd className="font-semibold">{drive.role}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-muted">Current deadline</dt><dd className="font-semibold">{formatDateTime(drive.deadline)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-muted">Status</dt><dd><StatusBadge status={drive.status} /></dd></div>
        <div className="flex justify-between"><dt className="text-ink-muted">Time left</dt><dd><Countdown to={drive.deadline} className="font-semibold" /></dd></div>
      </dl>
      <div className="mt-4 space-y-3">
        <FormField label="New closing date & time" required>
          <input type="datetime-local" className="input" value={value} onChange={(e) => setValue(e.target.value)} />
        </FormField>
        <div className="flex gap-1.5">
          {[['+24h', DAY], ['+48h', 2 * DAY], ['+7 days', 7 * DAY], ['+6h', 6 * HOUR]].map(([l, ms]) => (
            <button key={l} type="button" className="btn btn-secondary btn-xs" onClick={() => preset(ms)}>{l}</button>
          ))}
        </div>
        <FormField label="Reason (goes into the audit log)" required>
          <textarea rows={2} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Recruiter requested more applicants" />
        </FormField>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
        <p className="text-[11px] text-ink-muted">This updates the live countdown everywhere, alerts all students and the SPOC, and writes an audit record. A closed drive reopens.</p>
      </div>
    </Modal>
  );
}
