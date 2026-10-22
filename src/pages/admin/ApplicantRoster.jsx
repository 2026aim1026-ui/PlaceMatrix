import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, Star, ClipboardList, Trophy, Download, ListChecks, Lock, Briefcase } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import EmptyState from '../../components/common/EmptyState';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import Countdown from '../../components/common/Countdown';
import DataTable from '../../components/tables/DataTable';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ROLES, STAGES, STAGE_LABELS, BRANCH_CODES } from '../../constants';
import { checkTransition } from '../../utils/bulkParser';
import { downloadCsv } from '../../utils/csvExport';
import { formatCtc, formatCgpa } from '../../utils/format';
import { formatFull } from '../../utils/dateUtils';

export const ROSTER_CSV_COLUMNS = [
  { header: 'Roll Number', value: (r) => r.student.roll },
  { header: 'Name', value: (r) => r.student.name },
  { header: 'Degree', value: (r) => r.student.degree },
  { header: 'Branch', value: (r) => r.student.branch },
  { header: 'CGPA', value: (r) => formatCgpa(r.student.cgpa) },
  { header: '10th %', value: (r) => r.student.class10 },
  { header: '12th %', value: (r) => r.student.class12 },
  { header: 'Backlogs', value: (r) => r.student.backlogs },
  { header: 'Email', value: (r) => r.student.email },
  { header: 'Phone', value: (r) => r.student.phone },
  { header: 'Resume file', value: (r) => r.resume?.fileName || '' },
  { header: 'Stage', value: (r) => STAGE_LABELS[r.stage] },
  { header: 'Applied At', value: (r) => formatFull(r.appliedAt) },
];

/** Drives the current user may manage, plus the selected one (kept in ?drive=). */
export function useManagedDrive() {
  const { db, companyById } = useData();
  const me = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const drives = useMemo(() => db.drives
    .filter((d) => (me.role === ROLES.SPOC ? companyById.get(d.companyId)?.spocId === me.admin?.id : true))
    .sort((a, b) => (companyById.get(a.companyId)?.name || '').localeCompare(companyById.get(b.companyId)?.name || '') || a.role.localeCompare(b.role)),
  [db.drives, companyById, me.role, me.admin]);
  const requested = params.get('drive');
  const drive = drives.find((d) => d.id === requested) || drives.find((d) => d.status === 'OPEN') || drives[0] || null;
  const setDrive = (id) => setParams({ drive: id }, { replace: true });
  const options = drives.map((d) => ({ value: d.id, label: `${companyById.get(d.companyId)?.name} — ${d.role}${d.status === 'DRAFT' ? ' (draft)' : ''}` }));
  return { drives, drive, setDrive, options, company: drive ? companyById.get(drive.companyId) : null };
}

export function DriveHeader({ drive, company }) {
  const c = drive.criteria || {};
  const closed = new Date(drive.deadline).getTime() <= Date.now();
  return (
    <section className="card card-pad mb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow !text-brand">{company?.name}</p>
          <p className="mt-0.5 text-base font-semibold text-ink">{drive.role}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {formatCtc(drive.ctc)} · {c.branches?.length ? c.branches.join(' / ') : 'All branches'} · CGPA ≥ {formatCgpa(c.minCgpa)} · backlogs ≤ {c.maxBacklogs ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <StatusBadge status={drive.status} />
          {closed ? <span>closed</span> : <span>closes in <Countdown to={drive.deadline} className="font-semibold text-ink" /></span>}
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-amber-700">
        <Lock className="h-3 w-3" aria-hidden /> Workspace isolated to {company?.name}. Applicants of other drives are not visible to you.
      </p>
    </section>
  );
}

export function useDriveRows(drive) {
  const { db, studentById, docById } = useData();
  return useMemo(() => (drive ? db.applications
    .filter((a) => a.driveId === drive.id)
    .map((a) => ({ ...a, student: studentById.get(a.studentId), resume: docById.get(a.resumeId) }))
    .filter((r) => r.student) : []), [db.applications, drive, studentById, docById]);
}

export function exportRoster({ rows, drive, company, repo, actor, toast }) {
  if (!rows.length) {
    toast.warning('Nothing to export', 'This roster has no rows.');
    return;
  }
  const slug = (s) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  downloadCsv(`${slug(company.name)}_${slug(drive.role)}_roster.csv`, rows, ROSTER_CSV_COLUMNS);
  repo.logExport(actor, 'Application', `${company.name} — ${drive.role}: ${rows.length} applicant rows exported as CSV.`);
  toast.success('Roster exported', `${rows.length} row(s) downloaded as CSV.`);
}

const STAGE_OPTIONS = Object.values(STAGES);

export default function ApplicantRoster() {
  const { repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const { drive, setDrive, options, company } = useManagedDrive();
  const rows = useDriveRows(drive);
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [stage, setStage] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [bulkStage, setBulkStage] = useState('SHORTLISTED');
  const [pending, setPending] = useState(null); // { ids, stage, label }

  const filtered = rows.filter((r) => {
    if (branch && r.student.branch !== branch) return false;
    if (stage && r.stage !== stage) return false;
    const t = q.trim().toLowerCase();
    return !t || `${r.student.roll} ${r.student.name}`.toLowerCase().includes(t);
  });

  if (!drive) {
    return (
      <>
        <PageHeader title="Applicant Roster" description="Live applicants of your assigned drives." />
        <div className="card"><EmptyState icon={Briefcase} title="No drives assigned" description="Create a JAF from Assigned Companies to start receiving applicants." action={<Link to="/admin/spoc/companies" className="btn btn-primary btn-sm">Assigned Companies</Link>} /></div>
      </>
    );
  }

  const selectedIds = [...selected].filter((id) => rows.some((r) => r.id === id));
  const toggle = (id) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allVisibleSelected) filtered.forEach((r) => n.delete(r.id)); else filtered.forEach((r) => n.add(r.id));
    return n;
  });

  const confirmMove = () => {
    const res = repo.updateApplicationStages(me.actor, pending.ids, pending.stage);
    if (res.ok) {
      const { moved, skipped } = res.result;
      toast.success(`Moved ${moved.length} to ${STAGE_LABELS[pending.stage]}`, skipped.length ? `${skipped.length} skipped (transition not allowed).` : undefined);
      setSelected(new Set());
    } else {
      toast.error('Stage not changed', res.error);
    }
    setPending(null);
  };

  const columns = [
    {
      key: 'select',
      header: <input type="checkbox" className="h-4 w-4 rounded border-line text-brand" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all visible applicants" />,
      render: (r) => <input type="checkbox" className="h-4 w-4 rounded border-line text-brand" checked={selected.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${r.student.roll}`} />,
    },
    { key: 'roll', header: 'Roll Number', sortable: true, sortValue: (r) => r.student.roll, render: (r) => <span className="mono font-semibold">{r.student.roll}</span> },
    { key: 'name', header: 'Name', sortable: true, sortValue: (r) => r.student.name, render: (r) => <span className="whitespace-nowrap">{r.student.name}</span> },
    { key: 'degree', header: 'Degree', render: (r) => r.student.degree },
    { key: 'branch', header: 'Branch', sortable: true, sortValue: (r) => r.student.branch, render: (r) => r.student.branch },
    { key: 'cgpa', header: 'CGPA', sortable: true, sortValue: (r) => Number(r.student.cgpa), render: (r) => formatCgpa(r.student.cgpa) },
    { key: 'c10', header: '10th %', render: (r) => Number(r.student.class10).toFixed(2) },
    { key: 'c12', header: '12th %', render: (r) => Number(r.student.class12).toFixed(2) },
    { key: 'backlogs', header: 'Backlogs', render: (r) => r.student.backlogs },
    { key: 'resume', header: 'Resume', render: (r) => (r.resume ? <span title={r.resume.fileName}><StatusBadge status={r.resume.status} label={r.resume.status === 'APPROVED' ? 'Verified ✓' : undefined} /></span> : '—') },
    { key: 'stage', header: 'Stage', sortable: true, render: (r) => <StatusBadge status={r.stage} /> },
    {
      key: 'action',
      header: 'Move to',
      render: (r) => (
        <select
          className="input h-7 w-36 text-xs"
          value=""
          aria-label={`Move ${r.student.roll} to stage`}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => e.target.value && setPending({ ids: [r.id], stage: e.target.value, label: `${r.student.name} (${r.student.roll})` })}
        >
          <option value="">Change stage…</option>
          {STAGE_OPTIONS.map((s) => (
            <option key={s} value={s} disabled={!checkTransition(r.stage, s).ok}>{STAGE_LABELS[s]}</option>
          ))}
        </select>
      ),
    },
  ];

  const count = (pred) => rows.filter(pred).length;

  return (
    <>
      <PageHeader
        title="Applicant Roster"
        description="Live applicants of your assigned drive. Export the roster and email it to the recruiter."
        actions={(
          <FilterDropdown label="Drive" value={drive.id} onChange={setDrive} options={options} showAll={false} className="w-full sm:w-80" />
        )}
      />

      <DriveHeader drive={drive} company={company} />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Applicants" value={rows.length} tone="blue" />
        <StatCard icon={Star} label="Shortlisted" value={count((r) => r.stage === 'SHORTLISTED')} tone="amber" />
        <StatCard icon={ClipboardList} label="Assessment + interview" value={count((r) => r.stage === 'ASSESSMENT' || r.stage === 'INTERVIEW')} tone="violet" />
        <StatCard icon={Trophy} label="Offered" value={count((r) => r.stage === 'OFFERED')} tone="green" />
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="card-title">Live Applicant Roster</h2>
          <Link to={`/admin/spoc/bulk-shortlist?drive=${drive.id}`} className="btn btn-secondary btn-sm"><ListChecks className="h-3.5 w-3.5" /> Open shortlist parser</Link>
        </div>
        <div className="flex flex-col gap-2 border-b border-line p-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Filter by roll number or name" className="lg:flex-1" />
          <FilterDropdown label="Branch" value={branch} onChange={setBranch} options={BRANCH_CODES} allLabel="All branches" />
          <FilterDropdown label="Stage" value={stage} onChange={setStage} options={STAGE_OPTIONS.map((s) => ({ value: s, label: STAGE_LABELS[s] }))} allLabel="All stages" />
          <button type="button" className="btn btn-primary" onClick={() => exportRoster({ rows: filtered, drive, company, repo, actor: me.actor, toast })}>
            <Download className="h-4 w-4" /> Export Roster (CSV)
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-50/60 px-4 py-2.5 text-sm">
            <span className="font-semibold text-ink">{selectedIds.length} selected</span>
            <label htmlFor="bulk-stage" className="sr-only">Target stage</label>
            <select id="bulk-stage" className="input h-8 w-44 text-xs" value={bulkStage} onChange={(e) => setBulkStage(e.target.value)}>
              {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setPending({ ids: selectedIds, stage: bulkStage, label: `${selectedIds.length} selected applicant(s)` })}>
              Apply to {selectedIds.length} selected
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={filtered}
          pageSize={10}
          initialSort={{ key: 'roll', dir: 'asc' }}
          empty={{ title: rows.length ? 'No applicants match' : 'No applicants yet', description: rows.length ? 'Try a different search or filter.' : 'Applicants appear here as students apply.', icon: Users }}
        />
      </section>

      <ConfirmationDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={confirmMove}
        tone={pending?.stage === 'REJECTED' ? 'danger' : pending?.stage === 'OFFERED' ? 'success' : 'primary'}
        title={pending ? `Move to ${STAGE_LABELS[pending.stage]}?` : ''}
        confirmLabel="Confirm"
        message={pending ? (
          <>
            <p>{pending.label} will be moved to <strong>{STAGE_LABELS[pending.stage]}</strong>. Students are notified immediately. Invalid transitions are skipped.</p>
            {pending.stage === 'OFFERED' && (
              <p className="mt-2 rounded-md bg-warning-50 px-2.5 py-2 text-xs text-amber-800">This triggers the one-offer policy lock: the student is marked placed and all their other active applications are auto-withdrawn.</p>
            )}
          </>
        ) : ''}
      />
    </>
  );
}
