import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderSearch, Paperclip, Lock, PencilLine, Eye, Check, X, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import DocumentPreview from '../../components/documents/DocumentPreview';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useNow } from '../../hooks/useNow';
import { compareClaims } from '../../data/mockRepository';
import { BRANCH_CODES } from '../../constants';
import { formatCgpa } from '../../utils/format';
import { waitingFor, timeAgo } from '../../utils/dateUtils';

export default function VerificationQueue() {
  const { db, studentById, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow(60000);
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [precheck, setPrecheck] = useState('');
  const [preview, setPreview] = useState(null);
  const [rejectDoc, setRejectDoc] = useState(null);

  const profiles = useMemo(() => db.students
    .filter((s) => s.verification === 'PENDING')
    .map((s) => {
      const cmp = compareClaims(s);
      const mismatches = cmp.filter((r) => !r.match);
      const docs = db.documents.filter((d) => d.studentId === s.id);
      return { ...s, mismatches, docs, waitingSince: s.submittedAt || s.createdAt };
    }), [db]);

  const resumes = db.documents
    .filter((d) => d.type === 'RESUME' && d.status === 'PENDING' && studentById.get(d.studentId)?.verification === 'VERIFIED')
    .map((d) => ({ ...d, student: studentById.get(d.studentId) }));

  const revision = db.students.filter((s) => s.verification === 'REVISION' || s.verification === 'REJECTED');

  const filtered = profiles.filter((s) => {
    if (branch && s.branch !== branch) return false;
    if (precheck === 'match' && s.mismatches.length) return false;
    if (precheck === 'mismatch' && !s.mismatches.length) return false;
    const t = q.trim().toLowerCase();
    return !t || `${s.name} ${s.roll}`.toLowerCase().includes(t);
  });

  const profileColumns = [
    { key: 'roll', header: 'Entry No', sortable: true, render: (s) => <span className="mono font-semibold">{s.roll}</span> },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'program', header: 'Program', render: (s) => <span className="whitespace-nowrap text-ink-soft">{s.degree} {s.branch}</span> },
    { key: 'item', header: 'Awaiting review', render: () => <span className="text-xs text-ink-soft">Profile audit</span> },
    { key: 'cgpa', header: 'Claimed CGPA', sortable: true, render: (s) => formatCgpa(s.cgpa) },
    { key: 'backlogs', header: 'Backlogs', sortable: true, className: 'text-center' },
    { key: 'docs', header: 'Documents', render: (s) => <span className="whitespace-nowrap text-xs text-ink-soft">{s.docs.length} files</span> },
    { key: 'precheck', header: 'Pre-check', sortable: true, sortValue: (s) => s.mismatches.length, render: (s) => (s.mismatches.length
      ? <StatusBadge status="MISMATCH" label={`${s.mismatches.length} mismatch`} />
      : <StatusBadge status="MATCH" />) },
    { key: 'waitingSince', header: 'Waiting', sortable: true, sortValue: (s) => -new Date(s.waitingSince).getTime(), render: (s) => <span className="whitespace-nowrap text-xs text-ink-muted">{waitingFor(s.waitingSince, now)}</span> },
    { key: 'action', header: '', className: 'text-right', render: (s) => (
      <Link to={`/admin/document-review/${s.id}`} onClick={(e) => e.stopPropagation()} className="btn btn-primary btn-xs whitespace-nowrap">Review &amp; view docs</Link>
    ) },
  ];

  const resumeColumns = [
    { key: 'roll', header: 'Entry No', render: (d) => <span className="mono font-semibold">{d.student.roll}</span> },
    { key: 'name', header: 'Name', render: (d) => d.student.name },
    { key: 'label', header: 'Resume', render: (d) => d.label || 'Resume' },
    { key: 'fileName', header: 'File', render: (d) => <span className="mono flex items-center gap-1 text-ink-soft"><Paperclip className="h-3 w-3" />{d.fileName}</span> },
    { key: 'uploadedAt', header: 'Waiting', sortable: true, render: (d) => <span className="text-xs text-ink-muted">{waitingFor(d.uploadedAt, now)}</span> },
    { key: 'action', header: '', className: 'text-right', render: (d) => (
      <div className="flex justify-end gap-1">
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPreview(d)}><Eye className="h-3.5 w-3.5" /> View PDF</button>
        <button type="button" className="btn btn-success btn-xs" onClick={() => toast.result(repo.reviewDocument(me.actor, d.id, 'APPROVED'), 'Resume approved', `${d.student.name} can now attach ${d.label || d.fileName}.`)}><Check className="h-3.5 w-3.5" /> Approve</button>
        <button type="button" className="btn btn-danger-soft btn-xs" onClick={() => setRejectDoc(d)}><X className="h-3.5 w-3.5" /> Reject</button>
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader title="Verification Queue" description="Compare each student's claimed academics against the uploaded PDFs, then approve or request a revision." />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={FolderSearch} label="Profiles awaiting audit" value={profiles.length} tone="blue" />
        <StatCard icon={Paperclip} label="Resumes awaiting approval" value={resumes.length} tone="violet" />
        <StatCard icon={Lock} label="Verified & locked" value={db.students.filter((s) => s.locked).length} tone="green" to="/admin/students" />
        <StatCard icon={PencilLine} label="Revision requested" value={revision.length} tone={revision.length ? 'amber' : 'gray'} />
      </section>

      <section className="card mb-4">
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="card-title">Profile audits</h2>
            <p className="text-[11px] text-ink-muted">Open a profile to read every uploaded PDF before approving.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={q} onChange={setQ} placeholder="Roll number or name" className="sm:w-56" />
            <FilterDropdown label="Branch" value={branch} onChange={setBranch} options={BRANCH_CODES} />
            <FilterDropdown label="Pre-check" value={precheck} onChange={setPrecheck} options={[{ value: 'match', label: 'Values match' }, { value: 'mismatch', label: 'Has mismatch' }]} />
          </div>
        </div>
        <DataTable
          columns={profileColumns}
          rows={filtered}
          onRowClick={(s) => navigate(`/admin/document-review/${s.id}`)}
          initialSort={{ key: 'waitingSince', dir: 'asc' }}
          empty={{ title: profiles.length ? 'No profiles match your filters' : 'Queue is clear', description: profiles.length ? 'Adjust search or filters.' : 'New submissions will appear here.', icon: ShieldCheck }}
        />
      </section>

      <section className="card mb-4">
        <div className="border-b border-line px-4 py-3">
          <h2 className="card-title">Resume approvals</h2>
          <p className="text-[11px] text-ink-muted">New resumes added by already-verified students.</p>
        </div>
        <DataTable columns={resumeColumns} rows={resumes} pageSize={5} empty={{ title: 'No resumes pending', description: 'Resumes uploaded after verification appear here.' }} />
      </section>

      <section className="card">
        <div className="border-b border-line px-4 py-3">
          <h2 className="card-title">Awaiting student revision</h2>
          <p className="text-[11px] text-ink-muted">These profiles return to the queue when the student resubmits.</p>
        </div>
        {revision.length === 0 ? <p className="px-4 py-6 text-center text-xs text-ink-muted">No profiles are waiting on students.</p> : (
          <ul className="divide-y divide-line">
            {revision.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <span className="mono w-28 shrink-0 font-semibold">{s.roll}</span>
                <span className="w-36 shrink-0 text-sm">{s.name}</span>
                <span className="flex-1 truncate text-xs text-ink-soft" title={s.revisionReason}>{s.revisionReason}</span>
                <StatusBadge status={s.verification} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview ? `${preview.student.name} · ${preview.label || 'Resume'}` : ''} size="lg"
        footer={preview && (
          <>
            <button type="button" className="btn btn-danger-soft" onClick={() => { setRejectDoc(preview); setPreview(null); }}>Reject</button>
            <button type="button" className="btn btn-success" onClick={() => { toast.result(repo.reviewDocument(me.actor, preview.id, 'APPROVED'), 'Resume approved'); setPreview(null); }}>Approve</button>
          </>
        )}
      >
        {preview && <div className="-mx-5 -my-4"><DocumentPreview doc={preview} student={preview.student} height="h-[60vh]" /></div>}
      </Modal>

      <ConfirmationDialog
        open={Boolean(rejectDoc)}
        onClose={() => setRejectDoc(null)}
        tone="danger"
        title="Reject resume?"
        confirmLabel="Reject resume"
        requireReason
        reasonLabel="Remark for the student"
        reasonPlaceholder="e.g. CGPA on the resume does not match the verified record"
        message={rejectDoc ? `${rejectDoc.student.name} uploaded ${rejectDoc.fileName} ${timeAgo(rejectDoc.uploadedAt, now)}.` : ''}
        onConfirm={(reason) => {
          toast.result(repo.reviewDocument(me.actor, rejectDoc.id, 'REJECTED', reason), 'Resume rejected', 'The student has been notified.');
          setRejectDoc(null);
        }}
      />
    </>
  );
}
