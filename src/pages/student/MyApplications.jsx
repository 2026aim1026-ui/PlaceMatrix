import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Eye, Undo2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import EligibilityBadge from '../../components/common/EligibilityBadge';
import ApplicationTimeline from '../../components/student/ApplicationTimeline';
import { useStudentData } from '../../hooks/useStudentData';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { evaluateEligibility } from '../../utils/eligibility';
import { formatCtc } from '../../utils/format';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { STAGE_LABELS, TERMINAL_STAGES } from '../../constants';

export default function MyApplications() {
  const { student, applications } = useStudentData();
  const { driveById, companyById, docById, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [selected, setSelected] = useState(null);
  const [withdraw, setWithdraw] = useState(null);

  const rows = useMemo(() => applications.map((a) => {
    const drive = driveById.get(a.driveId);
    const company = companyById.get(drive?.companyId);
    return { ...a, drive, company, eligibility: evaluateEligibility(student, drive), resume: docById.get(a.resumeId) };
  }), [applications, driveById, companyById, docById, student]);

  const filtered = rows.filter((r) => {
    if (stage && r.stage !== stage) return false;
    const t = q.trim().toLowerCase();
    return !t || `${r.company?.name} ${r.drive?.role}`.toLowerCase().includes(t);
  });

  const columns = [
    { key: 'company', header: 'Company', sortable: true, sortValue: (r) => r.company?.name, render: (r) => <span className="font-semibold">{r.company?.name}</span> },
    { key: 'role', header: 'Role', sortable: true, sortValue: (r) => r.drive?.role, render: (r) => r.drive?.role },
    { key: 'ctc', header: 'CTC', sortable: true, sortValue: (r) => r.drive?.ctc, render: (r) => <span className="whitespace-nowrap">{formatCtc(r.drive?.ctc)}</span> },
    { key: 'appliedAt', header: 'Applied', sortable: true, render: (r) => <span className="whitespace-nowrap text-xs text-ink-soft">{formatDate(r.appliedAt)}</span> },
    { key: 'elig', header: 'Eligibility', render: (r) => <EligibilityBadge result={r.eligibility} /> },
    { key: 'stage', header: 'Current stage', sortable: true, render: (r) => <StatusBadge status={r.stage} /> },
    { key: 'deadline', header: 'Deadline', sortable: true, sortValue: (r) => r.drive?.deadline, render: (r) => <span className="whitespace-nowrap text-xs text-ink-soft">{formatDateTime(r.drive?.deadline)}</span> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => (
      <button type="button" className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); setSelected(r); }}><Eye className="h-3.5 w-3.5" /> Details</button>
    ) },
  ];

  const sel = selected && rows.find((r) => r.id === selected.id);
  const active = rows.filter((r) => !TERMINAL_STAGES.includes(r.stage)).length;

  return (
    <>
      <PageHeader
        title="My Applications"
        description="Track every application from submission to offer. Stages are updated by the drive SPOC."
        actions={<Link to="/student/opportunities" className="btn btn-primary">Browse opportunities</Link>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total', rows.length], ['Active', active],
          ['Shortlisted +', rows.filter((r) => ['SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFERED'].includes(r.stage)).length],
          ['Offers', rows.filter((r) => r.stage === 'OFFERED').length],
        ].map(([k, v]) => (
          <div key={k} className="card p-3"><p className="text-[11px] text-ink-muted">{k}</p><p className="text-xl font-bold">{v}</p></div>
        ))}
      </div>
      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search company or role" className="sm:w-72" />
          <FilterDropdown label="Stage" value={stage} onChange={setStage} options={Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label }))} />
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          onRowClick={setSelected}
          initialSort={{ key: 'appliedAt', dir: 'desc' }}
          empty={{ title: rows.length ? 'No applications match' : 'No applications yet', description: rows.length ? 'Try a different search or stage.' : 'Apply to an eligible drive from Opportunities.', icon: FileText }}
        />
      </section>

      <Modal
        open={Boolean(sel)}
        onClose={() => setSelected(null)}
        title={sel ? `${sel.company?.name} — ${sel.drive?.role}` : ''}
        description={sel ? `${formatCtc(sel.drive?.ctc)} · applied ${formatDate(sel.appliedAt)}` : ''}
        size="lg"
        footer={sel && (
          <>
            {!TERMINAL_STAGES.includes(sel.stage) && <button type="button" className="btn btn-danger-soft mr-auto" onClick={() => setWithdraw(sel)}><Undo2 className="h-4 w-4" /> Withdraw</button>}
            <Link to={`/student/opportunities/${sel.driveId}`} className="btn btn-secondary">View drive</Link>
            <button type="button" className="btn btn-primary" onClick={() => setSelected(null)}>Close</button>
          </>
        )}
      >
        {sel && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-3">Timeline</p>
              <ApplicationTimeline application={sel} />
            </div>
            <dl className="space-y-2.5 text-sm">
              <div><dt className="eyebrow">Current status</dt><dd className="mt-1"><StatusBadge status={sel.stage} /></dd></div>
              <div><dt className="eyebrow">Resume submitted</dt><dd className="mono mt-1">{sel.resume?.fileName || '—'}</dd></div>
              <div><dt className="eyebrow">Eligibility at review</dt><dd className="mt-1"><EligibilityBadge result={sel.eligibility} /></dd></div>
              <div><dt className="eyebrow">Drive deadline</dt><dd className="mt-1">{formatDateTime(sel.drive?.deadline)}</dd></div>
              <div><dt className="eyebrow">Location</dt><dd className="mt-1">{sel.drive?.location}</dd></div>
              <div><dt className="eyebrow">Last update</dt><dd className="mt-1">{formatDateTime(sel.updatedAt)} · {STAGE_LABELS[sel.stage]}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        open={Boolean(withdraw)}
        onClose={() => setWithdraw(null)}
        tone="danger"
        title="Withdraw application?"
        confirmLabel="Withdraw"
        message={withdraw ? `You will be removed from the ${withdraw.company?.name} — ${withdraw.drive?.role} pipeline. You can re-apply only while the drive is open.` : ''}
        onConfirm={() => {
          toast.result(repo.withdrawApplication(me.actor, withdraw.id), 'Application withdrawn');
          setWithdraw(null);
        }}
      />
    </>
  );
}
