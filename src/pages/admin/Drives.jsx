import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, CalendarClock, Snowflake, Play, XCircle, Users } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import Countdown from '../../components/common/Countdown';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import DriveFormModal from '../../components/admin/DriveFormModal';
import ExtendDeadlineModal from '../../components/admin/ExtendDeadlineModal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { formatCtc } from '../../utils/format';
import { formatDateTime } from '../../utils/dateUtils';
import { criteriaChips } from '../../utils/eligibility';
import { JOB_CATEGORIES } from '../../constants';

const ACTIONS = {
  FROZEN: { label: 'Freeze', icon: Snowflake, tone: 'primary', msg: 'Students can still see the drive but cannot apply until it is reopened.' },
  OPEN: { label: 'Open', icon: Play, tone: 'success', msg: 'The drive becomes visible and accepts applications until its deadline.' },
  CLOSED: { label: 'Close', icon: XCircle, tone: 'danger', msg: 'Applications stop immediately. Existing applicants stay in the pipeline.' },
};

export default function Drives() {
  const { db, companyById, adminById, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [company, setCompany] = useState('');
  const [form, setForm] = useState(null);
  const [extend, setExtend] = useState(null);
  const [change, setChange] = useState(null); // { drive, status }

  useEffect(() => {
    if (params.get('q') !== null) setQ(params.get('q'));
  }, [params]);

  const all = db.drives.map((d) => {
    const c = companyById.get(d.companyId);
    return { ...d, company: c, spoc: adminById.get(c?.spocId), applicants: db.applications.filter((a) => a.driveId === d.id && a.stage !== 'WITHDRAWN').length };
  });
  const rows = all.filter((d) => {
    if (status && d.status !== status) return false;
    if (category && d.category !== category) return false;
    if (company && d.companyId !== company) return false;
    const t = q.trim().toLowerCase();
    return !t || `${d.company?.name} ${d.role} ${d.location}`.toLowerCase().includes(t);
  });

  const count = (s) => all.filter((d) => d.status === s).length;

  const columns = [
    { key: 'company', header: 'Company', sortable: true, sortValue: (d) => d.company?.name, render: (d) => <span className="font-semibold">{d.company?.name}</span> },
    { key: 'role', header: 'Role', sortable: true, render: (d) => <div><p className="font-medium">{d.role}</p><p className="text-[11px] text-ink-muted">{d.category} · {d.location}</p></div> },
    { key: 'ctc', header: 'CTC', sortable: true, render: (d) => <span className="whitespace-nowrap">{formatCtc(d.ctc)}</span> },
    { key: 'criteria', header: 'Eligibility', render: (d) => <div className="flex max-w-[240px] flex-wrap gap-1">{criteriaChips(d).slice(1).map((c) => <span key={c} className="chip">{c}</span>)}</div> },
    { key: 'spoc', header: 'SPOC', render: (d) => <span className="whitespace-nowrap text-xs">{d.spoc?.name || '—'}</span> },
    { key: 'applicants', header: 'Applicants', sortable: true, className: 'text-center', render: (d) => (
      <Link to={`/admin/spoc/roster?drive=${d.id}`} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><Users className="h-3.5 w-3.5" />{d.applicants}</Link>
    ) },
    { key: 'deadline', header: 'Deadline', sortable: true, sortValue: (d) => new Date(d.deadline).getTime(), render: (d) => (
      <div className="whitespace-nowrap text-xs"><p className="font-medium">{formatDateTime(d.deadline)}</p><Countdown to={d.deadline} className="text-ink-muted" /></div>
    ) },
    { key: 'status', header: 'Status', sortable: true, render: (d) => <StatusBadge status={d.status} /> },
    { key: 'actions', header: '', className: 'text-right', render: (d) => (
      <div className="flex justify-end gap-1">
        <button type="button" className="btn btn-soft btn-xs" onClick={() => setExtend(d)} disabled={d.status === 'FROZEN' || d.status === 'DRAFT'} title="Extend deadline"><CalendarClock className="h-3.5 w-3.5" /><span className="hidden xl:inline">Extend</span></button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setForm({ drive: d })} aria-label={`Edit ${d.role}`}><Pencil className="h-3.5 w-3.5" /></button>
        <label className="sr-only" htmlFor={`st-${d.id}`}>Change status</label>
        <select
          id={`st-${d.id}`}
          value=""
          onChange={(e) => e.target.value && setChange({ drive: d, status: e.target.value })}
          className="input h-7 w-24 px-2 text-xs"
        >
          <option value="">Status…</option>
          {Object.keys(ACTIONS).filter((s) => s !== d.status).map((s) => <option key={s} value={s}>{ACTIONS[s].label}</option>)}
        </select>
      </div>
    ) },
  ];

  const act = change && ACTIONS[change.status];

  return (
    <>
      <PageHeader
        title="Placement Drives"
        description="JAFs are created by SPOCs and land on the calendar. Only CCPC can extend a deadline, freeze or close a drive."
        actions={<button type="button" className="btn btn-primary" onClick={() => setForm({ drive: null })}><Plus className="h-4 w-4" /> Create drive</button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {['OPEN', 'FROZEN', 'CLOSED', 'DRAFT'].map((s) => (
          <StatCard key={s} label={`${s.charAt(0)}${s.slice(1).toLowerCase()} drives`} value={count(s)} onClick={() => setStatus(status === s ? '' : s)} active={status === s} tone={s === 'OPEN' ? 'green' : s === 'FROZEN' ? 'blue' : s === 'DRAFT' ? 'amber' : 'gray'} />
        ))}
      </div>
      <section className="card">
        <div className="flex flex-col flex-wrap gap-2 border-b border-line p-3 sm:flex-row">
          <SearchInput value={q} onChange={setQ} placeholder="Search company, role or location" className="sm:w-72" />
          <FilterDropdown label="Status" value={status} onChange={setStatus} options={['OPEN', 'FROZEN', 'CLOSED', 'DRAFT']} />
          <FilterDropdown label="Category" value={category} onChange={setCategory} options={JOB_CATEGORIES} />
          <FilterDropdown label="Company" value={company} onChange={setCompany} options={db.companies.map((c) => ({ value: c.id, label: c.name }))} />
        </div>
        <DataTable columns={columns} rows={rows} initialSort={{ key: 'deadline', dir: 'asc' }} />
      </section>

      <DriveFormModal open={Boolean(form)} drive={form?.drive || null} onClose={() => setForm(null)} lockCompany={Boolean(form?.drive)} />
      {extend && <ExtendDeadlineModal drive={db.drives.find((d) => d.id === extend.id)} onClose={() => setExtend(null)} />}

      <ConfirmationDialog
        open={Boolean(change)}
        onClose={() => setChange(null)}
        tone={act?.tone}
        title={change ? `${act.label} ${change.drive.company?.name} — ${change.drive.role}?` : ''}
        confirmLabel={act?.label}
        message={act?.msg}
        onConfirm={() => {
          toast.result(repo.setDriveStatus(me.actor, change.drive.id, change.status), `Drive ${change.status.toLowerCase()}`);
          setChange(null);
        }}
      />
    </>
  );
}
