import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Briefcase, GraduationCap, CheckCircle2, FileText, Lock, Ticket, ArrowRight, CalendarClock, ScrollText } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import Countdown from '../../components/common/Countdown';
import DataTable from '../../components/tables/DataTable';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import ExtendDeadlineModal from '../../components/admin/ExtendDeadlineModal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useNow } from '../../hooks/useNow';
import { formatCtc } from '../../utils/format';
import { formatDateTime, DAY } from '../../utils/dateUtils';

function FunnelTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop">
      <p className="font-semibold text-ink">{p.stage}</p>
      <p className="text-ink-soft">{p.count} application{p.count === 1 ? '' : 's'}{p.pct !== null ? ` · ${p.pct}% of total` : ''}</p>
    </div>
  );
}

export default function GovernanceDesk() {
  const { db, companyById, studentById, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow(60000);
  const [extend, setExtend] = useState(null);
  const [approve, setApprove] = useState(null);
  const [auditQ, setAuditQ] = useState('');
  const [auditEntity, setAuditEntity] = useState('');
  const [driveFilter, setDriveFilter] = useState('');

  const stats = useMemo(() => {
    const apps = db.applications.filter((a) => a.stage !== 'WITHDRAWN');
    const reached = (stages) => apps.filter((a) => a.history.some((h) => stages.includes(h.stage))).length;
    return {
      openDrives: db.drives.filter((d) => d.status === 'OPEN').length,
      students: db.students.length,
      verified: db.students.filter((s) => s.verification === 'VERIFIED').length,
      pendingVer: db.students.filter((s) => s.verification === 'PENDING').length,
      applications: apps.length,
      locked: db.students.filter((s) => s.locked).length,
      tickets: db.tickets.filter((t) => t.status === 'OPEN').length,
      funnel: [
        { stage: 'Applications', count: apps.length },
        { stage: 'Shortlisted', count: reached(['SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFERED']) },
        { stage: 'Assessment', count: reached(['ASSESSMENT', 'INTERVIEW', 'OFFERED']) },
        { stage: 'Interview', count: reached(['INTERVIEW', 'OFFERED']) },
        { stage: 'Offered', count: reached(['OFFERED']) },
      ].map((r, i, arr) => ({ ...r, pct: i === 0 || !arr[0].count ? null : Math.round((r.count / arr[0].count) * 100) })),
    };
  }, [db]);

  const pendingCompanies = db.companies.filter((c) => c.status === 'PENDING_APPROVAL');
  const noSpoc = db.companies.filter((c) => c.status === 'APPROVED' && !c.spocId);
  const notInvited = db.invitations.filter((i) => i.status === 'NOT_INVITED').length;
  const closingSoon = db.drives.filter((d) => d.status === 'OPEN' && new Date(d.deadline).getTime() - now < DAY && new Date(d.deadline).getTime() > now);
  const pendingResumes = db.documents.filter((d) => d.type === 'RESUME' && d.status === 'PENDING' && studentById.get(d.studentId)?.verification === 'VERIFIED').length;

  const attention = [
    ...pendingCompanies.map((c) => ({ key: `ac-${c.id}`, text: `Approve company: ${c.name}`, action: 'Approve', onClick: () => setApprove(c) })),
    ...noSpoc.map((c) => ({ key: `sp-${c.id}`, text: `Assign SPOC for ${c.name}`, action: 'Assign', onClick: () => navigate(`/admin/companies?q=${encodeURIComponent(c.name)}`) })),
    { key: 'ver', text: `${stats.pendingVer} profile audit(s) + ${pendingResumes} resume(s) pending verification`, action: 'Review', onClick: () => navigate('/admin/verification-queue'), hide: !stats.pendingVer && !pendingResumes },
    { key: 'tk', text: `${stats.tickets} unfreeze / correction ticket(s) to resolve`, action: 'Resolve', onClick: () => navigate('/admin/correction-requests'), hide: !stats.tickets },
    { key: 'inv', text: `${notInvited} fee-paid student(s) not invited yet`, action: 'Invite', onClick: () => navigate('/admin/invitations'), hide: !notInvited },
    { key: 'cl', text: `${closingSoon.length} drive(s) closing within 24h`, action: 'View', onClick: () => setDriveFilter('OPEN'), hide: !closingSoon.length },
  ].filter((a) => !a.hide);

  const driveRows = db.drives
    .filter((d) => d.status !== 'DRAFT')
    .filter((d) => !driveFilter || d.status === driveFilter)
    .map((d) => ({ ...d, company: companyById.get(d.companyId), applicants: db.applications.filter((a) => a.driveId === d.id && a.stage !== 'WITHDRAWN').length }));

  const driveColumns = [
    { key: 'company', header: 'Company', sortable: true, sortValue: (r) => r.company?.name, render: (r) => <span className="font-semibold">{r.company?.name}</span> },
    { key: 'role', header: 'Role', render: (r) => <span className="text-ink-soft">{r.role}</span> },
    { key: 'ctc', header: 'CTC', sortable: true, render: (r) => <span className="whitespace-nowrap">{formatCtc(r.ctc)}</span> },
    { key: 'applicants', header: 'Applicants', sortable: true, className: 'text-center' },
    { key: 'deadline', header: 'Deadline', sortable: true, sortValue: (r) => new Date(r.deadline).getTime(), render: (r) => (
      <div className="whitespace-nowrap text-xs"><p className="font-medium">{formatDateTime(r.deadline)}</p><Countdown to={r.deadline} className="text-ink-muted" /></div>
    ) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', className: 'text-right', render: (r) => (
      <button type="button" className="btn btn-soft btn-xs" onClick={() => setExtend(r)} disabled={r.status === 'FROZEN'} title={r.status === 'FROZEN' ? 'Unfreeze the drive before extending' : undefined}>
        <CalendarClock className="h-3.5 w-3.5" /> Extend Deadline
      </button>
    ) },
  ];

  const entities = [...new Set(db.audit.map((e) => e.entity))].sort();
  const auditRows = db.audit.filter((e) => {
    if (auditEntity && e.entity !== auditEntity) return false;
    const t = auditQ.trim().toLowerCase();
    return !t || `${e.actorName} ${e.description} ${e.action}`.toLowerCase().includes(t);
  });
  const auditColumns = [
    { key: 'at', header: 'Timestamp', sortable: true, render: (e) => <span className="mono whitespace-nowrap text-ink-soft">{formatDateTime(e.at)}</span> },
    { key: 'actorName', header: 'Actor', sortable: true, render: (e) => <span className="whitespace-nowrap text-[13px]">{e.actorName}</span> },
    { key: 'entity', header: 'Entity', sortable: true },
    { key: 'action', header: 'Action', render: (e) => <span className="mono whitespace-nowrap rounded bg-canvas px-1.5 py-0.5 text-[10.5px] text-ink-soft">{e.action}</span> },
    { key: 'description', header: 'Description', render: (e) => <span className="text-[13px] text-ink-soft">{e.description}</span> },
  ];

  return (
    <>
      <PageHeader title="Governance Desk" description="Placement Directorate — live view of drives, verification, applications and policy locks." />

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Briefcase} label="Open drives" value={stats.openDrives} tone="amber" to="/admin/drives" />
        <StatCard icon={GraduationCap} label="Students" value={stats.students} tone="blue" to="/admin/students" />
        <StatCard icon={CheckCircle2} label="Verified" value={stats.verified} tone="green" to="/admin/students" />
        <StatCard icon={FileText} label="Pending verification" value={stats.pendingVer} tone="violet" to="/admin/verification-queue" />
        <StatCard icon={Lock} label="Policy locked" value={stats.locked} tone="gray" hint={`${stats.applications} active applications`} />
        <StatCard icon={Ticket} label="Unfreeze tickets" value={stats.tickets} tone={stats.tickets ? 'red' : 'gray'} to="/admin/correction-requests" />
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        <section className="card card-pad lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Placement funnel</h2>
            <span className="text-[11px] text-ink-muted">All drives · excludes withdrawn</span>
          </div>
          <div className="mt-3 h-56" role="img" aria-label={`Placement funnel: ${stats.funnel.map((f) => `${f.stage} ${f.count}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.funnel} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }} barCategoryGap={10}>
                <CartesianGrid horizontal={false} stroke="#E4EAF3" strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#7A879E' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="stage" width={92} tick={{ fontSize: 12, fill: '#4A5672' }} axisLine={false} tickLine={false} />
                <Tooltip content={<FunnelTooltip />} cursor={{ fill: 'rgba(61,90,232,0.06)' }} />
                <Bar dataKey="count" fill="#3D5AE8" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 600, fill: '#14213D' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card lg:col-span-2">
          <div className="border-b border-line px-4 py-3"><h2 className="card-title">Needs attention</h2></div>
          {attention.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">All clear — no pending actions.</p>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((a) => (
                <li key={a.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-[13px] text-ink">{a.text}</span>
                  <button type="button" className="btn btn-secondary btn-xs shrink-0" onClick={a.onClick}>{a.action}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mb-4">
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="card-title">Active drives · deadlines synced from SPOC JAFs</h2>
          <div className="flex items-center gap-2">
            <FilterDropdown label="Status" value={driveFilter} onChange={setDriveFilter} options={['OPEN', 'FROZEN', 'CLOSED']} />
            <Link to="/admin/companies" className="btn btn-secondary btn-sm">Companies &amp; SPOCs</Link>
          </div>
        </div>
        <DataTable columns={driveColumns} rows={driveRows} pageSize={6} initialSort={{ key: 'deadline', dir: 'asc' }} />
      </section>

      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
          <h2 className="card-title flex items-center gap-2"><ScrollText className="h-4 w-4 text-ink-muted" /> Audit log <span className="text-[11px] font-normal text-ink-muted">append-only</span></h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={auditQ} onChange={setAuditQ} placeholder="Search actor or description" className="sm:w-64" />
            <FilterDropdown label="Entity" value={auditEntity} onChange={setAuditEntity} options={entities} />
            <Link to="/admin/audit-trail" className="btn btn-secondary btn-sm">Full trail <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
        <DataTable columns={auditColumns} rows={auditRows} pageSize={8} initialSort={{ key: 'at', dir: 'desc' }} />
      </section>

      {extend && <ExtendDeadlineModal drive={db.drives.find((d) => d.id === extend.id)} onClose={() => setExtend(null)} />}

      <ConfirmationDialog
        open={Boolean(approve)}
        onClose={() => setApprove(null)}
        tone="success"
        title={`Approve ${approve?.name}?`}
        confirmLabel="Approve company"
        message="The company joins this placement season. Assign a SPOC next so they can publish the JAF."
        onConfirm={() => {
          toast.result(repo.approveCompany(me.actor, approve.id), 'Company approved', 'Assign a SPOC from Companies & SPOCs.');
          setApprove(null);
        }}
      />
    </>
  );
}
