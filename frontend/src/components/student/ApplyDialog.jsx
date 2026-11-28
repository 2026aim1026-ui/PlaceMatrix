import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, FileText, Send, Star, Lock } from 'lucide-react';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import DocumentPreview from '../documents/DocumentPreview';
import { formatBytes } from '../../utils/format';
import { formatDate } from '../../utils/dateUtils';
import { formatCtc } from '../../utils/format';

/**
 * Step 2 of applying: the student picks which of their resumes to submit for THIS drive, then confirms.
 * Only verified resumes can be submitted; others are listed with their status so nothing is hidden.
 */
export default function ApplyDialog({ drive, resumes, defaultResumeId, student, onClose, onSubmit }) {
  const open = Boolean(drive);
  const approved = resumes.filter((r) => r.status === 'APPROVED');
  const [selected, setSelected] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setBusy(false);
    setSelected(approved.some((r) => r.id === defaultResumeId) ? defaultResumeId : approved[0]?.id || '');
  }, [open, drive?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = resumes.find((r) => r.id === selected);
  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    const ok = await onSubmit(drive.id, selected);
    if (!ok) setBusy(false);
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="lg"
      title={drive ? `Apply to ${drive.company?.name} — ${drive.role}` : ''}
      description={drive ? `${formatCtc(drive.ctc)} · ${drive.location || drive.category || ''}` : undefined}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={!selected || busy}>
            <Send className="h-4 w-4" /> {busy ? 'Submitting…' : chosen ? `Submit with "${chosen.label || chosen.fileName}"` : 'Submit application'}
          </button>
        </>
      )}
    >
      <fieldset>
        <legend className="label mb-2">Choose the resume to submit for this application</legend>
        {resumes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-muted">
            You have no resumes yet. <Link to="/student/documents" className="font-semibold text-brand hover:underline">Upload one</Link> — it must be verified before you can apply.
          </p>
        ) : (
          <ul className="space-y-2" role="radiogroup">
            {resumes.map((r) => {
              const usable = r.status === 'APPROVED';
              const active = selected === r.id;
              return (
                <li key={r.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${active ? 'border-brand bg-brand-50/50 ring-1 ring-brand/30' : 'border-line hover:border-brand/40'} ${usable ? '' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <input
                      type="radio"
                      name="apply-resume"
                      className="mt-1 h-4 w-4 text-brand focus:ring-brand"
                      value={r.id}
                      checked={active}
                      disabled={!usable}
                      onChange={() => setSelected(r.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{r.label || 'Resume'}</span>
                        {r.version > 1 && <span className="chip">v{r.version}</span>}
                        {r.id === defaultResumeId && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand"><Star className="h-3 w-3" /> Default</span>}
                        <StatusBadge status={r.status} />
                      </span>
                      <span className="mono mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-soft"><FileText className="h-3.5 w-3.5 shrink-0" />{r.fileName}</span>
                      <span className="text-[11px] text-ink-muted">{formatBytes(r.size)} · updated {formatDate(r.uploadedAt)}{!usable ? ' · not verified yet — cannot be submitted' : ''}</span>
                    </span>
                    <button type="button" className="btn btn-ghost btn-xs shrink-0" onClick={(e) => { e.preventDefault(); setPreview(preview?.id === r.id ? null : r); }}>
                      <Eye className="h-3.5 w-3.5" /> {preview?.id === r.id ? 'Hide' : 'Preview'}
                    </button>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {preview && (
        <div className="mt-3 overflow-hidden rounded-lg border border-line">
          <DocumentPreview doc={preview} student={student} zoomable={false} height="h-[42vh]" />
        </div>
      )}

      {approved.length === 0 && resumes.length > 0 && (
        <p className="mt-3 rounded-md bg-warning-50 px-3 py-2 text-xs text-amber-800">None of your resumes is verified yet. A verifier must approve a resume before it can be submitted.</p>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-[12px] text-ink-muted">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        The selected resume is attached to this application only. A copy is stored with it, so editing or deleting resumes later will not change what {drive?.company?.name || 'the recruiter'} receives.
      </p>
      {chosen && <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Submitting: {chosen.label || chosen.fileName}</p>}
    </Modal>
  );
}
