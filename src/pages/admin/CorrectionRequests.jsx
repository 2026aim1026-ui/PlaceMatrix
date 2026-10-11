import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, CheckCircle2, XCircle, Timer, Eye, Unlock } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/forms/FormField';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { formatDateTime, formatFull, timeAgo, HOUR } from '../../utils/dateUtils';
import { formatCgpa } from '../../utils/format';

const STATUS_ORDER = { OPEN: 0, APPROVED: 1, REJECTED: 2 };

function TicketStatus({ status }) {
  if (status === 'OPEN') return <StatusBadge status="PENDING" label="Open" />;
  return <StatusBadge status={status} />;
}

function TypeBadge({ type }) {
  return <StatusBadge status={type} tone={type === 'UNFREEZE' ? 'violet' : 'blue'} label={type === 'UNFREEZE' ? 'Unfreeze' : 'Correction'} />;
}

export default function CorrectionRequests() {
  const { db, studentById } = useData();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const tickets = db.tickets;
  const resolved = tickets.filter((t) => t.resolvedAt);
  const avgHours = resolved.length
    ? Math.round(resolved.reduce((sum, t) => sum + (new Date(t.resolvedAt) - new Date(t.createdAt)), 0) / resolved.length / HOUR)
    : null;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tickets
      .map((t) => ({ ...t, student: studentById.get(t.studentId) }))
      .filter((t) => {
        if (status && t.status !== status) return false;
        if (type && t.type !== type) return false;
        return !term || `${t.student?.roll} ${t.student?.name} ${t.fieldLabel}`.toLowerCase().includes(term);
      })
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
  }, [tickets, studentById, q, status, type]);

  const count = (s) => tickets.filter((t) => t.status === s).length;

  const columns = [
    { key: 'createdAt', header: 'Raised', sortable: true, render: (r) => <span className="whitespace-nowrap text-xs text-ink-soft" title={formatDateTime(r.createdAt)}>{timeAgo(r.createdAt)}</span> },
    { key: 'student', header: 'Student', sortable: true, sortValue: (r) => r.student?.name, render: (r) => (
      <span className="whitespace-nowrap"><span className="block font-medium">{r.student?.name || '—'}</span><span className="mono text-[11px] text-ink-muted">{r.student?.roll}</span></span>
    ) },
    { key: 'type', header: 'Type', sortable: true, render: (r) => <TypeBadge type={r.type} /> },
    { key: 'fieldLabel', header: 'Field', sortable: true },
    { key: 'change', header: 'Current → Requested', render: (r) => (
      <span className="mono whitespace-nowrap text-ink-soft">{r.currentValue} → <strong className="text-ink">{r.requestedValue}</strong></span>
    ) },
    { key: 'justification', header: 'Justification', render: (r) => <span className="block max-w-[240px] truncate text-xs text-ink-soft" title={r.justification}>{r.justification}</span> },
    { key: 'status', header: 'Status', sortable: true, sortValue: (r) => STATUS_ORDER[r.status], render: (r) => <TicketStatus status={r.status} /> },
    { key: 'action', header: '', className: 'text-right', render: (r) => (
      r.status === 'OPEN'
        ? <button type="button" className="btn btn-primary btn-xs" onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }}>Review</button>
        : <button type="button" className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }}><Eye className="h-3.5 w-3.5" /> View</button>
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Unfreeze & Correction Tickets"
        description="Students raise tickets when a verified field needs to change. Approving unlocks the profile for correction and re-verification."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Ticket} label="Open" value={count('OPEN')} tone="amber" onClick={() => setStatus(status === 'OPEN' ? '' : 'OPEN')} active={status === 'OPEN'} />
        <StatCard icon={CheckCircle2} label="Approved" value={count('APPROVED')} tone="green" onClick={() => setStatus(status === 'APPROVED' ? '' : 'APPROVED')} active={status === 'APPROVED'} />
        <StatCard icon={XCircle} label="Rejected" value={count('REJECTED')} tone="red" onClick={() => setStatus(status === 'REJECTED' ? '' : 'REJECTED')} active={status === 'REJECTED'} />
        <StatCard icon={Timer} label="Avg. resolution time" value={avgHours === null ? '—' : `${avgHours}h`} tone="blue" />
      </div>

      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search roll, name or field" className="sm:w-72" />
          <FilterDropdown label="Status" value={status} onChange={setStatus} options={[{ value: 'OPEN', label: 'Open' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }]} />
          <FilterDropdown label="Type" value={type} onChange={setType} options={[{ value: 'CORRECTION', label: 'Correction' }, { value: 'UNFREEZE', label: 'Unfreeze' }]} />
        </div>
        <DataTable columns={columns} rows={rows} onRowClick={(r) => setSelectedId(r.id)} empty={{ title: 'No tickets match', description: 'Try a different search or filter.', icon: Ticket }} />
      </section>

      <TicketModal ticketId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}

function TicketModal({ ticketId, onClose }) {
  const { db, studentById, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setNote('');
    setError('');
  }, [ticketId]);

  const t = ticketId && db.tickets.find((x) => x.id === ticketId);
  if (!t) return null;
  const s = studentById.get(t.studentId);
  const open = t.status === 'OPEN';

  const resolve = (decision) => {
    if (!note.trim()) { setError('A resolution note is required — it is shown to the student.'); return; }
    const res = repo.resolveTicket(me.actor, t.id, decision, note);
    const ok = toast.result(res, decision === 'APPROVED' ? 'Ticket approved' : 'Ticket rejected',
      decision === 'APPROVED' ? `${s?.name}'s profile is unlocked for correction and re-verification.` : 'The student has been notified.');
    if (ok) onClose();
    else setError(res.error);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${t.type === 'UNFREEZE' ? 'Unfreeze' : 'Correction'} ticket · ${s?.roll || ''}`}
      description={`Raised ${formatFull(t.createdAt)} by ${s?.name || 'student'}`}
      footer={open ? (
        <>
          <button type="button" className="btn btn-secondary mr-auto" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-danger-soft" onClick={() => resolve('REJECTED')}><XCircle className="h-4 w-4" /> Reject</button>
          <button type="button" className="btn btn-success" onClick={() => resolve('APPROVED')}><Unlock className="h-4 w-4" /> Approve &amp; unlock</button>
        </>
      ) : (
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
      )}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <section>
          <p className="eyebrow mb-2">Request</p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><dt className="text-ink-muted">Type</dt><dd><TypeBadge type={t.type} /></dd></div>
            <div className="flex items-center justify-between"><dt className="text-ink-muted">Status</dt><dd><TicketStatus status={t.status} /></dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Field</dt><dd className="font-medium">{t.fieldLabel}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Current value</dt><dd className="mono">{t.currentValue}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Requested value</dt><dd className="mono font-bold">{t.requestedValue}</dd></div>
          </dl>
          <p className="eyebrow mb-1 mt-4">Justification</p>
          <p className="rounded-md bg-canvas p-2.5 text-[13px] text-ink-soft">{t.justification}</p>
        </section>
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Current student record</p>
            {s && <Link to={`/admin/students?open=${s.id}`} className="text-xs font-semibold text-brand hover:underline" onClick={onClose}>Open student record</Link>}
          </div>
          {s ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ['Name', s.name], ['Branch', `${s.branch} · ${s.degree}`],
                ['CGPA', formatCgpa(s.cgpa)], ['Backlogs', s.backlogs],
                ['Class 10', s.class10 !== '' ? `${Number(s.class10).toFixed(2)} %` : '—'], ['Class 12', s.class12 !== '' ? `${Number(s.class12).toFixed(2)} %` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-line pb-1.5"><dt className="text-[11px] text-ink-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
              <div className="col-span-2 flex flex-wrap gap-1.5 pt-1">
                <StatusBadge status={s.verification} icon />
                <StatusBadge status={s.locked ? 'LOCKED' : 'UNLOCKED'} icon />
              </div>
            </dl>
          ) : <p className="text-xs text-ink-muted">Student record not found.</p>}
        </section>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        {open ? (
          <>
            <FormField label="Resolution note" required error={error} hint="Approving unlocks the profile; the student corrects the field and resubmits for verification.">
              <textarea rows={3} className="input" value={note} onChange={(e) => { setNote(e.target.value); setError(''); }} placeholder="e.g. Revised marksheet verified with the academic section" />
            </FormField>
          </>
        ) : (
          <div className="text-sm">
            <p className="eyebrow mb-1">Resolution</p>
            <p className="rounded-md bg-canvas p-2.5 text-[13px] text-ink-soft">{t.resolution || '—'}</p>
            <p className="mt-1.5 text-xs text-ink-muted">{t.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {t.resolvedBy} · {formatFull(t.resolvedAt)}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
