import { useEffect, useState } from 'react';
import { Download, Info, Lock } from 'lucide-react';
import Modal from '../common/Modal';
import * as repo from '../../data/repository';
import { formatBytes } from '../../utils/format';
import { formatFull } from '../../utils/dateUtils';

/**
 * Shows the exact resume submitted with an application (the frozen copy stored on the server).
 * Access is checked by the backend: the student who applied, CDPC, and the recruitment's current SPOC and verifier.
 */
export default function SubmittedResumeModal({ application, studentName, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const open = Boolean(application);
  const id = application?.id;

  useEffect(() => {
    // Always clear the previous preview: its object URL is revoked when the modal closes or switches application.
    setUrl(null);
    setError('');
    if (!id) return undefined;
    let objectUrl = null;
    let cancelled = false;
    repo.getSubmittedResumeUrl(id)
      .then((u) => { objectUrl = u; if (cancelled) URL.revokeObjectURL(u); else setUrl(u); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);

  const r = application?.resume;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Submitted resume${studentName ? ` — ${studentName}` : ''}`}
      description={r ? `${r.label || 'Resume'} · ${r.fileName}${r.version ? ` · v${r.version}` : ''}${r.size ? ` · ${formatBytes(r.size)}` : ''}` : undefined}
      footer={(
        <>
          {url && application && <a className="btn btn-secondary" href={url} download={`${application.studentId}_${r?.fileName || 'resume.pdf'}`}><Download className="h-4 w-4" /> Download</a>}
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </>
      )}
    >
      <p className="mb-3 flex items-start gap-1.5 rounded-md bg-canvas px-3 py-2 text-[12px] text-ink-soft">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
        Frozen copy stored with this application{r?.submittedAt ? ` on ${formatFull(r.submittedAt)}` : ''}. Later changes to the student's resume library do not affect it.
      </p>
      <div className="h-[62vh] overflow-hidden rounded-md bg-[#E9EDF5]">
        {error ? (
          <p className="flex h-full items-center justify-center gap-2 px-6 text-center text-sm text-danger" role="alert"><Info className="h-4 w-4 shrink-0" /> {error}</p>
        ) : url ? (
          <iframe title="Submitted resume" src={url} className="h-full w-full bg-white" />
        ) : (
          <p className="flex h-full items-center justify-center gap-2 text-sm text-ink-muted" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/25 border-t-brand" aria-hidden /> Loading resume…
          </p>
        )}
      </div>
    </Modal>
  );
}
