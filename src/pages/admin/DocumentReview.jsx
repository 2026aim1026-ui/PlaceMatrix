import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, FileText, ShieldCheck, PencilLine, Ban, ChevronRight, Pencil, Save } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import ErrorState from '../../components/common/ErrorState';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import DocumentPreview from '../../components/documents/DocumentPreview';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { compareClaims } from '../../data/mockRepository';
import { DOC_TYPES } from '../../constants';
import { formatBytes, fileExt } from '../../utils/format';
import { formatFull, timeAgo } from '../../utils/dateUtils';

const ORDER = ['GRADE_CARD', 'CLASS10', 'CLASS12', 'RESUME', 'ID_PROOF', 'PORTFOLIO', 'CERTIFICATE', 'OTHER'];

export default function DocumentReview() {
  const { id } = useParams();
  const { db, studentById, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const navigate = useNavigate();
  const student = studentById.get(id);
  const docs = useMemo(
    () => db.documents.filter((d) => d.studentId === id).sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type)),
    [db, id],
  );
  const [selectedId, setSelectedId] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [remarksError, setRemarksError] = useState('');
  const [confirm, setConfirm] = useState(null); // 'approve' | 'reject'
  const [editProof, setEditProof] = useState(false);
  const [proofDraft, setProofDraft] = useState({});

  useEffect(() => {
    setSelectedId(docs[0]?.id || null);
    setRemarks('');
    setEditProof(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return <ErrorState title="Student not found" description="This profile does not exist." backTo="/admin/verification-queue" backLabel="Back to queue" />;

  const selected = docs.find((d) => d.id === selectedId) || docs[0];
  const rows = compareClaims(student);
  const mismatches = rows.filter((r) => r.mandatory && !r.match);
  const pending = student.verification === 'PENDING';
  const queue = db.students.filter((s) => s.verification === 'PENDING' && s.id !== student.id);
  const nextInQueue = queue[0];

  const goNext = () => navigate(nextInQueue ? `/admin/document-review/${nextInQueue.id}` : '/admin/verification-queue');

  const startEdit = () => {
    const p = student.proof || {};
    setProofDraft({ cgpa: p.cgpa ?? '', class10: p.class10 ?? '', class12: p.class12 ?? '', backlogs: p.backlogs ?? '', branch: p.branch || student.branch, degree: p.degree || student.degree });
    setEditProof(true);
  };
  const saveProof = () => {
    const values = {};
    for (const k of ['cgpa', 'class10', 'class12', 'backlogs']) {
      if (proofDraft[k] === '' || Number.isNaN(Number(proofDraft[k]))) { toast.error('Invalid value', `Enter a number for ${k}`); return; }
      values[k] = Number(proofDraft[k]);
    }
    values.branch = proofDraft.branch;
    values.degree = proofDraft.degree;
    if (toast.result(repo.setProofValues(me.actor, student.id, values), 'Proof values recorded')) setEditProof(false);
  };

  const approve = () => {
    const res = repo.approveProfile(me.actor, student.id, remarks.trim());
    setConfirm(null);
    if (toast.result(res, 'Approved & auto-locked', `${student.name}'s academic record is now verified and read-only.`)) goNext();
  };

  const requestRevision = () => {
    if (remarks.trim().length < 5) { setRemarksError('Verifier remarks are required to request a revision.'); return; }
    const flagged = docs.filter((d) => DOC_TYPES[d.type].academic && d.status === 'PENDING').map((d) => d.id);
    const res = repo.requestRevision(me.actor, student.id, remarks.trim(), flagged);
    if (toast.result(res, 'Revision requested', 'The student will see your remarks on their Profile Audit.')) goNext();
  };

  const reject = (reason) => {
    const res = repo.rejectProfile(me.actor, student.id, reason);
    setConfirm(null);
    if (toast.result(res, 'Profile rejected')) goNext();
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Verification Queue', to: '/admin/verification-queue' }, { label: `${student.roll} · ${student.name}` }]}
        title={`${student.name} · ${student.roll}`}
        description={`${student.degree} ${student.branch} · submitted ${student.submittedAt ? timeAgo(student.submittedAt) : '—'} · ${docs.length} attached documents`}
        actions={(
          <>
            <StatusBadge status={student.verification} icon />
            {student.locked && <StatusBadge status="LOCKED" icon />}
            {nextInQueue && <button type="button" className="btn btn-secondary btn-sm" onClick={goNext}>Next in queue <ChevronRight className="h-3.5 w-3.5" /></button>}
          </>
        )}
      />

      {!pending && (
        <div className="mb-4 rounded-xl border border-line bg-white p-3 text-sm text-ink-soft">
          This profile is <strong>{student.verification.replace('_', ' ').toLowerCase()}</strong>
          {student.verifiedBy && student.verification === 'VERIFIED' ? ` — verified by ${student.verifiedBy} on ${formatFull(student.verifiedAt)}` : ''}. Decisions are available only while a profile is awaiting verification.
          {' '}<Link to="/admin/verification-queue" className="font-semibold text-brand hover:underline">Back to queue</Link>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,1fr)_minmax(0,1.5fr)_260px]">
        {/* Left: claimed vs document */}
        <section className="card flex flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="card-title">Claimed vs. document</h2>
            {pending && !editProof && <button type="button" className="btn btn-ghost btn-xs" onClick={startEdit}><Pencil className="h-3 w-3" /> Edit proof values</button>}
            {editProof && <button type="button" className="btn btn-primary btn-xs" onClick={saveProof}><Save className="h-3 w-3" /> Save</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Field</th><th>Claimed</th><th>As per proof</th><th className="text-center">Match</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={r.match ? '' : 'bg-danger-50/50'}>
                    <td className="text-[13px] text-ink-soft">{r.label}</td>
                    <td className="font-semibold">{r.claimedText}</td>
                    <td className={r.match ? 'font-semibold' : 'font-semibold text-danger'}>
                      {editProof ? (
                        r.key === 'branch' ? (
                          <span className="flex gap-1">
                            <input aria-label="Proof branch" className="input h-7 w-16 px-1.5 text-xs" value={proofDraft.branch} onChange={(e) => setProofDraft({ ...proofDraft, branch: e.target.value.toUpperCase() })} />
                            <input aria-label="Proof degree" className="input h-7 w-16 px-1.5 text-xs" value={proofDraft.degree} onChange={(e) => setProofDraft({ ...proofDraft, degree: e.target.value })} />
                          </span>
                        ) : (
                          <input aria-label={`Proof ${r.label}`} type="number" step="0.01" className="input h-7 w-20 px-1.5 text-xs" value={proofDraft[r.key]} onChange={(e) => setProofDraft({ ...proofDraft, [r.key]: e.target.value })} />
                        )
                      ) : r.proofText}
                    </td>
                    <td className="text-center">
                      {r.match
                        ? <CheckCircle2 className="mx-auto h-4 w-4 text-success" aria-label="Matches" />
                        : <XCircle className="mx-auto h-4 w-4 text-danger" aria-label={r.hasProof ? 'Mismatch' : 'No proof value recorded'} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pt-2 text-[11px] text-ink-muted">Semester SGPA: {(student.semCgpa || []).join(' · ') || '—'}</p>
          <div className="px-4 py-3">
            {mismatches.length === 0 ? (
              <p className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-xs font-medium text-success"><CheckCircle2 className="h-4 w-4" /> All claimed values match the uploaded proofs.</p>
            ) : (
              <p className="flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{mismatches.length} mismatch{mismatches.length > 1 ? 'es' : ''} ({mismatches.map((m) => m.label).join(', ')}) — approval is blocked until resolved. Request a revision, or correct the proof value if you misread the document.</span>
              </p>
            )}
          </div>
          <div className="mt-auto border-t border-line px-4 py-3">
            <label htmlFor="remarks" className="label">Verifier remarks <span className="text-ink-muted">(required for revision)</span></label>
            <textarea
              id="remarks"
              rows={3}
              className={`input ${remarksError ? 'input-error' : ''}`}
              value={remarks}
              onChange={(e) => { setRemarks(e.target.value); setRemarksError(''); }}
              placeholder={mismatches[0] ? `e.g. ${mismatches[0].label} on the proof shows ${mismatches[0].proofText} — please correct the claimed value.` : 'Optional note recorded with the approval'}
              disabled={!pending}
            />
            {remarksError && <p className="mt-1 text-xs text-danger" role="alert">{remarksError}</p>}
          </div>
        </section>

        {/* Center: preview */}
        <section className="card overflow-hidden">
          {selected ? <DocumentPreview doc={selected} student={student} height="h-[620px]" /> : <p className="p-10 text-center text-sm text-ink-muted">No documents attached.</p>}
        </section>

        {/* Right: attachments */}
        <section className="card">
          <div className="border-b border-line px-4 py-3">
            <h2 className="card-title">Attached documents ({docs.length})</h2>
            <p className="text-[11px] text-ink-muted">Click to open</p>
          </div>
          <ul className="space-y-1 p-2">
            {docs.map((d) => {
              const active = d.id === selected?.id;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left ${active ? 'bg-navy text-white' : 'hover:bg-canvas'}`}
                  >
                    <FileText className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-ink-muted'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">{d.label || DOC_TYPES[d.type].label}</span>
                      <span className={`block truncate text-[11px] ${active ? 'text-white/70' : 'text-ink-muted'}`}>{fileExt(d.fileName)} · {formatBytes(d.size)}</span>
                    </span>
                    <StatusBadge status={d.status} className={active ? '!ring-white/30' : ''} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-col gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:px-6">
        <p className="flex-1 text-xs text-ink-muted">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
          Approving verifies the profile, locks the academic record in the student portal and writes to the audit log.
        </p>
        <button type="button" className="btn btn-danger-soft" onClick={() => setConfirm('reject')} disabled={!pending}><Ban className="h-4 w-4" /> Reject</button>
        <button type="button" className="btn btn-secondary text-danger" onClick={requestRevision} disabled={!pending}><PencilLine className="h-4 w-4" /> Request Revision</button>
        <button
          type="button"
          className="btn btn-success"
          onClick={() => setConfirm('approve')}
          disabled={!pending || mismatches.length > 0}
          title={mismatches.length ? 'Resolve mismatches before approving' : undefined}
        >
          <CheckCircle2 className="h-4 w-4" /> Approve &amp; Auto-Lock
        </button>
      </div>

      <ConfirmationDialog
        open={confirm === 'approve'}
        onClose={() => setConfirm(null)}
        onConfirm={approve}
        tone="success"
        title="Approve and auto-lock this profile?"
        confirmLabel="Approve & lock"
        message={`${student.name}'s academic record will be marked verified and locked. Any later change requires a CCPC-approved ticket.`}
      />
      <ConfirmationDialog
        open={confirm === 'reject'}
        onClose={() => setConfirm(null)}
        onConfirm={reject}
        tone="danger"
        title="Reject this profile?"
        confirmLabel="Reject profile"
        requireReason
        reasonLabel="Reason shown to the student"
        reasonPlaceholder="e.g. Documents belong to a different candidate"
        message="Use rejection for invalid or fraudulent submissions. For correctable issues, request a revision instead."
      />
    </>
  );
}
