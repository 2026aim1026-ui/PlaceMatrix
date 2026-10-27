import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Eye } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import StudentDetailModal from '../../components/admin/StudentDetailModal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { BRANCH_CODES, DEGREES } from '../../constants';
import { formatCgpa } from '../../utils/format';
import { downloadCsv } from '../../utils/csvExport';

const VERIFICATION_OPTS = [
  { value: 'VERIFIED', label: 'Verified' }, { value: 'PENDING', label: 'Pending' },
  { value: 'REVISION', label: 'Revision' }, { value: 'REJECTED', label: 'Rejected' }, { value: 'NOT_SUBMITTED', label: 'Not submitted' },
];

export default function StudentDirectory() {
  const { db, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [degree, setDegree] = useState('');
  const [verification, setVerification] = useState(me.role === 'VERIFIER' ? '' : '');
  const [placement, setPlacement] = useState('');
  const [minCgpa, setMinCgpa] = useState('');
  const [maxCgpa, setMaxCgpa] = useState('');
  const openId = params.get('open');

  const rows = db.students.map((s) => ({
    ...s,
    profileStatus: s.locked ? 'LOCKED' : 'UNLOCKED',
    applications: db.applications.filter((a) => a.studentId === s.id && a.stage !== 'WITHDRAWN').length,
  })).filter((s) => {
    if (branch && s.branch !== branch) return false;
    if (degree && s.degree !== degree) return false;
    if (verification && s.verification !== verification) return false;
    if (placement && s.placement !== placement) return false;
    if (minCgpa !== '' && !(Number(s.cgpa) >= Number(minCgpa))) return false;
    if (maxCgpa !== '' && !(Number(s.cgpa) <= Number(maxCgpa))) return false;
    const t = q.trim().toLowerCase();
    return !t || `${s.name} ${s.roll} ${s.email}`.toLowerCase().includes(t);
  });

  const open = (id) => setParams({ open: id });

  const columns = [
    { key: 'roll', header: 'Roll number', sortable: true, render: (s) => <span className="mono font-semibold">{s.roll}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (s) => <span className="whitespace-nowrap font-medium">{s.name}</span> },
    { key: 'branch', header: 'Branch', sortable: true },
    { key: 'degree', header: 'Degree', sortable: true },
    { key: 'cgpa', header: 'CGPA', sortable: true, sortValue: (s) => Number(s.cgpa) || 0, render: (s) => formatCgpa(s.cgpa) },
    { key: 'backlogs', header: 'Backlogs', sortable: true, className: 'text-center' },
    { key: 'verification', header: 'Verification', sortable: true, render: (s) => <StatusBadge status={s.verification} /> },
    { key: 'profileStatus', header: 'Profile', render: (s) => <StatusBadge status={s.profileStatus} icon /> },
    { key: 'placement', header: 'Placement', sortable: true, render: (s) => <StatusBadge status={s.placement} label={s.placedCompany ? `Placed · ${s.placedCompany}` : undefined} /> },
    { key: 'applications', header: 'Apps', sortable: true, className: 'text-center' },
    { key: 'act', header: '', className: 'text-right', render: (s) => <button type="button" className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); open(s.id); }}><Eye className="h-3.5 w-3.5" /> Open</button> },
  ];

  const exportCsv = () => {
    downloadCsv('placematrix_student_records.csv', rows, [
      { header: 'Roll Number', key: 'roll' }, { header: 'Name', key: 'name' }, { header: 'Email', key: 'email' },
      { header: 'Degree', key: 'degree' }, { header: 'Branch', key: 'branch' }, { header: 'CGPA', key: 'cgpa' },
      { header: 'Class 10 %', key: 'class10' }, { header: 'Class 12 %', key: 'class12' }, { header: 'Backlogs', key: 'backlogs' },
      { header: 'Verification', key: 'verification' }, { header: 'Locked', value: (r) => (r.locked ? 'Yes' : 'No') },
      { header: 'Placement', key: 'placement' }, { header: 'Placed Company', key: 'placedCompany' },
    ]);
    repo.logExport(me.actor, 'Profile', `Student records exported as CSV (${rows.length} rows).`);
    toast.success('CSV exported', `${rows.length} student rows downloaded.`);
  };

  const clear = () => { setQ(''); setBranch(''); setDegree(''); setVerification(''); setPlacement(''); setMinCgpa(''); setMaxCgpa(''); };
  const active = q || branch || degree || verification || placement || minCgpa || maxCgpa;

  return (
    <>
      <PageHeader
        title={me.role === 'VERIFIER' ? 'Verified Records' : 'Student Records'}
        description="Every registered student with their verified academic record, profile lock and placement status."
        actions={<button type="button" className="btn btn-secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</button>}
      />
      <section className="card">
        <div className="flex flex-col flex-wrap gap-2 border-b border-line p-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Name, roll number or email" className="lg:w-64" />
          <FilterDropdown label="Branch" value={branch} onChange={setBranch} options={BRANCH_CODES} />
          <FilterDropdown label="Degree" value={degree} onChange={setDegree} options={DEGREES} />
          <FilterDropdown label="Verification" value={verification} onChange={setVerification} options={VERIFICATION_OPTS} />
          <FilterDropdown label="Placement" value={placement} onChange={setPlacement} options={[{ value: 'PLACED', label: 'Placed' }, { value: 'UNPLACED', label: 'Unplaced' }]} />
          <div className="flex items-center gap-1.5">
            <label htmlFor="cg-min" className="text-xs text-ink-muted">CGPA</label>
            <input id="cg-min" type="number" step="0.1" min="0" max="10" placeholder="min" value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} className="input h-9 w-20 text-[13px]" />
            <span className="text-ink-muted">–</span>
            <label htmlFor="cg-max" className="sr-only">Maximum CGPA</label>
            <input id="cg-max" type="number" step="0.1" min="0" max="10" placeholder="max" value={maxCgpa} onChange={(e) => setMaxCgpa(e.target.value)} className="input h-9 w-20 text-[13px]" />
          </div>
          {active && <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>}
          <span className="text-xs text-ink-muted lg:ml-auto">{rows.length} of {db.students.length}</span>
        </div>
        <DataTable columns={columns} rows={rows} onRowClick={(s) => open(s.id)} initialSort={{ key: 'roll', dir: 'asc' }} />
      </section>
      {openId && <StudentDetailModal studentId={openId} onClose={() => setParams({})} />}
    </>
  );
}
