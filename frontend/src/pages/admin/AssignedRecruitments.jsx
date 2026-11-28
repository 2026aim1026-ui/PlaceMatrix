import { useMemo, useState } from 'react';
import { Briefcase, Eye, FileArchive, Users, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import EmptyState from '../../components/common/EmptyState';
import DataTable from '../../components/tables/DataTable';
import SubmittedResumeModal from '../../components/documents/SubmittedResumeModal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { STAGES, STAGE_LABELS } from '../../constants';
import { formatCgpa, formatCtc } from '../../utils/format';
import { formatDateTime } from '../../utils/dateUtils';

/**
 * Verifier: recruitments CDPC assigned to me, their applicants and the exact resumes they submitted.
 * The list follows the live assignment — if CDPC reassigns a recruitment, it leaves this page (and the
 * server stops serving its resumes to me) on the next sync.
 */
export default function AssignedRecruitments() {
  const { db, repo, studentById, adminById } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [driveId, setDriveId] = useState('');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [view, setView] = useState(null);

  const companies = db.companies.filter((c) => c.verifierId === me.admin?.id);
  const companyIds = new Set(companies.map((c) => c.id));
  const drives = db.drives.filter((d) => companyIds.has(d.companyId));
  const drive = drives.find((d) => d.id === driveId) || drives.find((d) => d.status === 'OPEN') || drives[0] || null;
  const company = drive ? companies.find((c) => c.id === drive.companyId) : null;

  const rows = useMemo(() => (drive ? db.applications
    .filter((a) => a.driveId === drive.id && a.stage !== 'WITHDRAWN')
    .map((a) => ({ ...a, student: studentById.get(a.studentId) }))
    .filter((r) => r.student)
    .filter((r) => (!stage || r.stage === stage) && (!q.trim() || `${r.student.roll} ${r.student.name}`.toLowerCase().includes(q.trim().toLowerCase()))) : []),
  [db.applications, drive, studentById, q, stage]);

  if (!companies.length) {
    return (
      <>
        <PageHeader title="Assigned Recruitments" description="Recruitments where CDPC made you the verifier." />
        <div className="card"><EmptyState icon={ShieldCheck} title="No recruitments assigned to you" description="When CDPC assigns you as the verifier of a recruitment, its applicants and their submitted resumes appear here." /></div>
      </>
    );
  }

  const downloadZip = async () => {
    const res = await repo.downloadDriveResumes(drive.id, stage);
    if (res.ok) toast.success('Resumes downloaded', res.result.name);
    else toast.error('Download failed', res.error);
  };

  const columns = [
    { key: 'roll', header: 'Roll Number', sortable: true, sortValue: (r) => r.student.roll, render: (r) => <span className="mono font-semibold">{r.student.roll}</span> },
    { key: 'name', header: 'Name', sortable: true, sortValue: (r) => r.student.name, render: (r) => r.student.name },
    { key: 'branch', header: 'Branch', render: (r) => `${r.student.branch} · ${r.student.degree}` },
    { key: 'cgpa', header: 'CGPA', sortable: true, sortValue: (r) => Number(r.student.cgpa), render: (r) => formatCgpa(r.student.cgpa) },
    { key: 'profile', header: 'Profile', render: (r) => <StatusBadge status={r.student.verification} /> },
    { key: 'stage', header: 'Stage', sortable: true, render: (r) => <StatusBadge status={r.stage} /> },
    { key: 'resume', header: 'Submitted resume', render: (r) => (r.resume ? (
      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setView(r)} disabled={!r.resume.available}><Eye className="h-3.5 w-3.5" /> {r.resume.label}</button>
    ) : '—') },
    { key: 'appliedAt', header: 'Applied', sortable: true, render: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.appliedAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Assigned Recruitments"
        description="Recruitments where CDPC made you the verifier: review each applicant's verified profile and the exact resume they submitted."
        actions={<FilterDropdown label="Drive" value={drive?.id || ''} onChange={setDriveId} showAll={false} className="w-full sm:w-80"
          options={drives.map((d) => ({ value: d.id, label: `${companies.find((c) => c.id === d.companyId)?.name} — ${d.role}` }))} />}
      />
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={ShieldCheck} label="Recruitments assigned" value={companies.length} tone="blue" />
        <StatCard icon={Briefcase} label="Drives" value={drives.length} tone="violet" />
        <StatCard icon={Users} label="Applicants in this drive" value={rows.length} tone="green" />
      </section>
      {drive && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <p className="eyebrow !text-brand">{company?.name}</p>
              <p className="text-sm font-semibold">{drive.role} · {formatCtc(drive.ctc)} <StatusBadge status={drive.status} /></p>
              <p className="text-[11px] text-ink-muted">SPOC: {adminById.get(company?.spocId)?.name || 'Unassigned'}</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={downloadZip} disabled={!rows.length}><FileArchive className="h-3.5 w-3.5" /> Resumes (ZIP)</button>
          </div>
          <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row">
            <SearchInput value={q} onChange={setQ} placeholder="Search roll or name" className="sm:w-72" />
            <FilterDropdown label="Stage" value={stage} onChange={setStage} options={Object.values(STAGES).filter((s) => s !== 'WITHDRAWN').map((s) => ({ value: s, label: STAGE_LABELS[s] }))} allLabel="All stages" />
          </div>
          <DataTable columns={columns} rows={rows} initialSort={{ key: 'roll', dir: 'asc' }} empty={{ title: 'No applicants yet', description: 'Applicants appear here as students apply.' }} />
        </section>
      )}
      <SubmittedResumeModal application={view} studentName={view ? `${view.student.name} (${view.student.roll})` : ''} onClose={() => setView(null)} />
    </>
  );
}
