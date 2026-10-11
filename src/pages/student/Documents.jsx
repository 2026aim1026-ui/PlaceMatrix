import { useState } from 'react';
import { Plus, Lock, FileText, Eye, Trash2, Star, Upload, RefreshCw, FolderOpen } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import EmptyState from '../../components/common/EmptyState';
import FileUpload from '../../components/forms/FileUpload';
import FormField from '../../components/forms/FormField';
import DocumentPreview from '../../components/documents/DocumentPreview';
import { useStudentData } from '../../hooks/useStudentData';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { DOC_TYPES } from '../../constants';
import { formatBytes, fileExt } from '../../utils/format';
import { formatDate } from '../../utils/dateUtils';

const ACADEMIC = ['GRADE_CARD', 'CLASS10', 'CLASS12'];
const OTHER = ['ID_PROOF', 'PORTFOLIO', 'CERTIFICATE', 'OTHER'];

function readAsDataUrl(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}

export default function Documents() {
  const { student, documents, resumes } = useStudentData();
  const me = useCurrentUser();
  const { repo } = useData();
  const toast = useToast();
  const [upload, setUpload] = useState(null); // { type }
  const [preview, setPreview] = useState(null);
  const [remove, setRemove] = useState(null);

  const academicLocked = student.locked || student.verification === 'PENDING';
  const otherDocs = documents.filter((d) => OTHER.includes(d.type));

  const setDefault = (doc) => toast.result(repo.setDefaultResume(me.actor, student.id, doc.id), 'Default resume updated', `${doc.label || doc.fileName} will be used for 1-click apply.`);
  const doRemove = () => {
    toast.result(repo.removeDocument(me.actor, remove.id), 'Document removed');
    setRemove(null);
  };

  return (
    <>
      <PageHeader
        title="Documents"
        description="Two repositories: academic proofs that back your Profile Audit, and the resumes you attach to applications."
        actions={<button type="button" className="btn btn-primary" onClick={() => setUpload({ type: 'RESUME' })}><Plus className="h-4 w-4" /> Upload document</button>}
      />

      {/* 1 · Academic */}
      <section className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="card-title">1 · Academic Documents</h2>
          {student.locked && <span className="flex items-center gap-1 text-xs font-medium text-amber-700"><Lock className="h-3.5 w-3.5" /> Locked with your verified profile</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Document</th><th>Claimed value</th><th>File</th><th>Uploaded</th><th>Status</th><th>Verifier remarks</th><th className="text-right">Action</th></tr>
            </thead>
            <tbody>
              {ACADEMIC.map((type) => {
                const doc = documents.find((d) => d.type === type);
                return (
                  <tr key={type}>
                    <td className="font-semibold">{DOC_TYPES[type].label}</td>
                    <td className="whitespace-nowrap text-ink-soft">{doc?.claimedValue || '—'}</td>
                    <td>{doc ? <span className="mono flex items-center gap-1 text-ink-soft"><FileText className="h-3.5 w-3.5 shrink-0" />{doc.fileName}</span> : <span className="text-xs text-ink-muted">Not uploaded</span>}</td>
                    <td className="whitespace-nowrap text-xs text-ink-muted">{doc ? formatDate(doc.uploadedAt) : '—'}</td>
                    <td>{doc ? <StatusBadge status={doc.status} /> : <StatusBadge status="NOT_SUBMITTED" label="Missing" tone="red" />}</td>
                    <td className="max-w-[220px] text-xs text-ink-soft">{doc?.remarks || '—'}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        {doc && <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPreview(doc)}><Eye className="h-3.5 w-3.5" /> View</button>}
                        {!academicLocked && (
                          <button type="button" className="btn btn-soft btn-xs" onClick={() => setUpload({ type })}>
                            {doc ? <><RefreshCw className="h-3.5 w-3.5" /> Replace</> : <><Upload className="h-3.5 w-3.5" /> Upload</>}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2 · Resumes */}
      <section className="card mb-4">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="card-title">2 · Resume Repository</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setUpload({ type: 'RESUME' })}><Plus className="h-3.5 w-3.5" /> Add resume</button>
        </div>
        {resumes.length === 0 ? (
          <EmptyState compact icon={FileText} title="No resumes yet" description="Upload at least one resume. It must be verified before it can be attached to an application." action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setUpload({ type: 'RESUME' })}>Upload resume</button>} />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {resumes.map((r) => (
              <article key={r.id} className={`rounded-lg border p-3 ${r.isDefault ? 'border-brand/40 bg-brand-50/30' : 'border-line'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="eyebrow !text-ink">{r.label || 'Resume'}</p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mono mt-1.5 truncate text-ink-soft">{r.fileName}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">{formatBytes(r.size)} · {fileExt(r.fileName)} · {formatDate(r.uploadedAt)}</p>
                {r.remarks && <p className="mt-1.5 text-[11px] text-danger">{r.remarks}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {r.isDefault && <span className="inline-flex items-center gap-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white"><Star className="h-3 w-3" /> Default for 1-Click Apply</span>}
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPreview(r)}><Eye className="h-3.5 w-3.5" /> View</button>
                  {!r.isDefault && r.status === 'APPROVED' && <button type="button" className="btn btn-ghost btn-xs" onClick={() => setDefault(r)}>Set as default</button>}
                  {!r.isDefault && <button type="button" className="btn btn-danger-soft btn-xs" onClick={() => setRemove(r)}><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="border-t border-line px-4 py-2 text-[11px] text-ink-muted">A new resume goes to the verifier queue. Only verified resumes can be attached to an application.</p>
      </section>

      {/* 3 · Other */}
      <section className="card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="card-title">3 · Identity, Portfolio &amp; Certificates</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setUpload({ type: 'CERTIFICATE' })}><Plus className="h-3.5 w-3.5" /> Add</button>
        </div>
        {otherDocs.length === 0 ? (
          <EmptyState compact icon={FolderOpen} title="No supporting documents" description="Add an identity proof, portfolio or certificates to strengthen your profile." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Type</th><th>File</th><th>Format</th><th>Size</th><th>Uploaded</th><th>Status</th><th className="text-right">Action</th></tr></thead>
              <tbody>
                {otherDocs.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.label || DOC_TYPES[d.type].label}</td>
                    <td className="mono text-ink-soft">{d.fileName}</td>
                    <td className="text-xs">{fileExt(d.fileName)}</td>
                    <td className="text-xs text-ink-muted">{formatBytes(d.size)}</td>
                    <td className="whitespace-nowrap text-xs text-ink-muted">{formatDate(d.uploadedAt)}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPreview(d)}><Eye className="h-3.5 w-3.5" /> View</button>
                        <button type="button" className="btn btn-danger-soft btn-xs" onClick={() => setRemove(d)}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <UploadModal open={Boolean(upload)} initialType={upload?.type} onClose={() => setUpload(null)} academicLocked={academicLocked} />

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.label || (preview && DOC_TYPES[preview.type].label)} size="lg">
        {preview && <div className="-mx-5 -my-4"><DocumentPreview doc={preview} student={student} height="h-[65vh]" /></div>}
      </Modal>

      <ConfirmationDialog
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        onConfirm={doRemove}
        tone="danger"
        title="Remove document?"
        confirmLabel="Remove"
        message={remove ? <>Remove <strong>{remove.fileName}</strong>? This cannot be undone.</> : ''}
      />
    </>
  );
}

function UploadModal({ open, initialType, onClose, academicLocked }) {
  const { student } = useStudentData();
  const me = useCurrentUser();
  const { repo } = useData();
  const toast = useToast();
  const [type, setType] = useState(initialType || 'RESUME');
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [lastOpen, setLastOpen] = useState(false);

  // Reset when (re)opened.
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setType(initialType || 'RESUME');
      setLabel('');
      setFile(null);
      setProgress(null);
      setError('');
    }
  }

  const needsLabel = ['RESUME', 'CERTIFICATE', 'OTHER'].includes(type);
  const types = Object.entries(DOC_TYPES).filter(([t, m]) => !(m.academic && academicLocked) || t === type);

  const submit = async () => {
    if (!file) { setError('Choose a file to upload'); return; }
    if (needsLabel && !label.trim()) { setError('Give this document a name, e.g. "Data Resume"'); return; }
    if (DOC_TYPES[type].academic && academicLocked) { setError('Academic documents are locked.'); return; }
    setError('');
    // Simulated upload progress — files are stored in this browser only.
    setProgress(10);
    const dataUrl = await readAsDataUrl(file);
    for (const p of [45, 80, 100]) {
      await new Promise((r) => setTimeout(r, 180));
      setProgress(p);
    }
    const res = repo.addDocument(me.actor, student.id, { type, label: needsLabel ? label.trim() : null, file, dataUrl });
    setProgress(null);
    if (toast.result(res, 'Document uploaded', 'It is now pending verification.')) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={progress ? () => {} : onClose}
      title="Upload document"
      description="Stored locally in this browser for the demo — nothing is sent to a server."
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={progress !== null}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={progress !== null}><Upload className="h-4 w-4" /> {progress !== null ? 'Uploading…' : 'Upload'}</button>
        </>
      )}
    >
      <div className="space-y-3">
        <FormField label="Document type" required>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map(([t, m]) => <option key={t} value={t}>{m.label}</option>)}
          </select>
        </FormField>
        {needsLabel && (
          <FormField label="Name" required hint={type === 'RESUME' ? 'Shown when choosing a resume to apply with' : undefined}>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={type === 'RESUME' ? 'e.g. Data Resume' : 'e.g. AWS Cloud Practitioner'} />
          </FormField>
        )}
        {DOC_TYPES[type].academic && <p className="rounded-md bg-warning-50 px-3 py-2 text-xs text-amber-800">Uploading a new {DOC_TYPES[type].label.toLowerCase()} replaces the existing one and requires re-verification.</p>}
        <FileUpload file={file} onSelect={(f) => { setFile(f); setError(''); }} onClear={() => setFile(null)} />
        {progress !== null && (
          <div aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-1 text-xs text-ink-muted">Uploading… {progress}%</p>
          </div>
        )}
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
