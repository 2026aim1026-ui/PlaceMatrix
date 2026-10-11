import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Eye, ShieldCheck, Unlock } from 'lucide-react';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import ConfirmationDialog from '../common/ConfirmationDialog';
import DocumentPreview from '../documents/DocumentPreview';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { can } from '../../constants/permissions';
import { DOC_TYPES, STAGE_LABELS } from '../../constants';
import { formatCgpa, formatCtc } from '../../utils/format';
import { formatDate, formatFull } from '../../utils/dateUtils';

/** Admin view of a single student: record, documents, applications and workflow actions. */
export default function StudentDetailModal({ studentId, onClose }) {
  const { db, studentById, driveById, companyById, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [revision, setRevision] = useState(false);
  const s = studentById.get(studentId);
  if (!s) return null;

  const docs = db.documents.filter((d) => d.studentId === s.id);
  const apps = db.applications.filter((a) => a.studentId === s.id);
  const canVerify = can(me.role, 'profile.verify');

  return (
    <>
      <Modal
        open={!preview}
        onClose={onClose}
        size="xl"
        title={`${s.name} · ${s.roll}`}
        description={`${s.degree} · ${s.branch} · ${s.email}`}
        footer={(
          <>
            {canVerify && s.verification === 'VERIFIED' && can(me.role, 'student.unlock') && (
              <button type="button" className="btn btn-danger-soft mr-auto" onClick={() => setRevision(true)}><Unlock className="h-4 w-4" /> Unlock &amp; request revision</button>
            )}
            {canVerify && s.verification === 'PENDING' && (
              <Link to={`/admin/document-review/${s.id}`} className="btn btn-primary" onClick={onClose}><ShieldCheck className="h-4 w-4" /> Open verification workspace</Link>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          </>
        )}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <section>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <StatusBadge status={s.verification} icon />
              {s.locked && <StatusBadge status="LOCKED" icon />}
              <StatusBadge status={s.placement} label={s.placedCompany ? `Placed · ${s.placedCompany}` : undefined} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ['CGPA', formatCgpa(s.cgpa)], ['Backlogs', s.backlogs], ['Class 10', s.class10 ? `${Number(s.class10).toFixed(2)} %` : '—'],
                ['Class 12', s.class12 ? `${Number(s.class12).toFixed(2)} %` : '—'], ['Semester SGPA', (s.semCgpa || []).join(', ') || '—'],
                ['Graduation', s.gradYear], ['Phone', s.phone || '—'], ['Skills', (s.skills || []).join(', ') || '—'],
                ['Verified by', s.verifiedBy || '—'], ['Verified on', s.verifiedAt ? formatFull(s.verifiedAt) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-line pb-1.5"><dt className="text-[11px] text-ink-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            {s.revisionReason && <p className="mt-3 rounded-md bg-danger-50 p-2 text-xs text-danger">{s.revisionReason}</p>}
          </section>
          <section>
            <p className="eyebrow mb-2">Documents ({docs.length})</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {docs.length === 0 && <li className="p-3 text-xs text-ink-muted">No documents uploaded.</li>}
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-ink-muted" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{d.label || DOC_TYPES[d.type].label}</span><span className="mono block truncate text-[11px] text-ink-muted">{d.fileName}</span></span>
                  <StatusBadge status={d.status} />
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPreview(d)} aria-label={`View ${d.fileName}`}><Eye className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <p className="eyebrow mb-2 mt-4">Applications ({apps.length})</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {apps.length === 0 && <li className="p-3 text-xs text-ink-muted">No applications.</li>}
              {apps.map((a) => {
                const d = driveById.get(a.driveId);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                    <span className="min-w-0"><span className="block truncate font-medium">{companyById.get(d?.companyId)?.name} — {d?.role}</span><span className="block text-[11px] text-ink-muted">{formatCtc(d?.ctc)} · applied {formatDate(a.appliedAt)}</span></span>
                    <StatusBadge status={a.stage} label={STAGE_LABELS[a.stage]} />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </Modal>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.fileName} size="lg">
        {preview && <div className="-mx-5 -my-4"><DocumentPreview doc={preview} student={s} height="h-[65vh]" /></div>}
      </Modal>

      <ConfirmationDialog
        open={revision}
        onClose={() => setRevision(false)}
        tone="danger"
        title="Unlock profile and request revision?"
        confirmLabel="Unlock profile"
        requireReason
        reasonLabel="Reason shown to the student"
        reasonPlaceholder="e.g. Grade card re-issued by academic section — please re-upload"
        message={`${s.name}'s verified record will be unlocked. Eligibility for new drives is suspended until it is re-verified.`}
        onConfirm={(reason) => {
          toast.result(repo.requestRevision(me.actor, s.id, reason), 'Profile unlocked', 'The student has been asked to revise their record.');
          setRevision(false);
        }}
      />
    </>
  );
}
