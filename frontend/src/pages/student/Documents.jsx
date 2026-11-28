import { useState } from 'react';
import { Plus, Lock, FileText, Eye, Trash2, Star, Upload, RefreshCw, FolderOpen, Pencil, History } from 'lucide-react';
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

export default function Documents() {
  const { student, documents, resumes, applications } = useStudentData();
  const me = useCurrentUser();
  const { repo, config } = useData();
  const toast = useToast();
  const [upload, setUpload] = useState(null); // { type } or { versionOf: doc }
  const [preview, setPreview] = useState(null);
  const [remove, setRemove] = useState(null);
  const [rename, setRename] = useState(null);
  const maxResumes = config.maxResumes || 10;
  const usedIn = (r) => applications.filter((a) => a.resumeId === r.id).length;

  const academicLocked = student.locked || student.verification === 'PENDING';
  const otherDocs = documents.filter((d) => OTHER.includes(d.type));

  const setDefault = (doc) => toast.result(repo.setDefaultResume(me.actor, student.id, doc.id), 'Default resume updated', `${doc.label || doc.fileName} will be used for 1-click apply.`);
  const doRemove = async () => {
    await toast.result(repo.removeDocument(me.actor, remove.id), 'Document removed');
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
          <h2 className="card-title">2 · Resume Repository <span className="ml-1 text-xs font-normal text-ink-muted">{resumes.length} / {maxResumes}</span></h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setUpload({ type: 'RESUME' })} disabled={resumes.length >= maxResumes}><Plus className="h-3.5 w-3.5" /> Add resume</button>
        </div>
        {resumes.length === 0 ? (
          <EmptyState compact icon={FileText} title="No resumes yet" description="Upload at least one resume. It must be verified before it can be attached to an application." action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setUpload({ type: 'RESUME' })}>Upload resume</button>} />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {resumes.map((r) => (
              <article key={r.id} className={`rounded-lg border p-3 ${r.isDefault ? 'border-brand/40 bg-brand-50/30' : 'border-line'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="eyebrow !text-ink">{r.label || 'Resume'} {r.version > 1 && <span className="ml-1 rounded bg-canvas px-1 py-px text-[10px] font-semibold text-ink-soft">v{r.version}</span>}</p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mono mt-1.5 truncate text-ink-soft">{r.fileName}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">{formatBytes(r.size)} · {fileExt(r.fileName)} · {formatDate(r.uploadedAt)}{usedIn(r) ? ` · used in ${usedIn(r)} application(s)` : ''}</p>
                {r.remarks && <p className="mt-1.5 text-[11px] text-danger">{r.remarks}</p>}
                {r.isDefault && <span className="mt-2 inline-flex items-center gap-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white"><Star className="h-3 w-3" /> Pre-selected when you apply</span>}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setPreview(r)}><Eye className="h-3.5 w-3.5" /> View</button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setRename(r)}><Pencil className="h-3.5 w-3.5" /> Rename</button>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setUpload({ versionOf: r })}><History className="h-3.5 w-3.5" /> New version</button>
                  {!r.isDefault && r.status === 'APPROVED' && <button type="button" className="btn btn-ghost btn-xs" onClick={() => setDefault(r)}>Set as default</button>}
                  <button type="button" className="btn btn-danger-soft btn-xs" onClick={() => setRemove(r)}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="border-t border-line px-4 py-2 text-[11px] text-ink-muted">PDF only, up to {maxResumes} resumes. New resumes and new versions go to the verifier queue; only verified resumes can be submitted. You choose the resume each time you apply, and every application keeps its own copy — renaming, replacing or deleting a resume here never changes an application already submitted.</p>
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

      <UploadModal open={Boolean(upload)} initialType={upload?.type} versionOf={upload?.versionOf} onClose={() => setUpload(null)} academicLocked={academicLocked} />
      <RenameModal doc={rename} onClose={() => setRename(null)} />

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
        message={remove ? (
          <>Delete <strong>{remove.label || remove.fileName}</strong>? This cannot be undone.
            {remove.type === 'RESUME' && usedIn(remove) > 0 && <> Your {usedIn(remove)} application(s) that used it keep their submitted copy.</>}
            {remove.isDefault && <> Another verified resume becomes your default.</>}</>
        ) : ''}
      />
    </>
  );
}

function RenameModal({ doc, onClose }) {
  const { repo } = useData();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState(null);
  if ((doc?.id || null) !== lastId) {
    setLastId(doc?.id || null);
    setLabel(doc?.label || '');
    setError('');
  }
  const save = async () => {
    if (!label.trim()) { setError('Enter a name.'); return; }
    setBusy(true);
    const res = await repo.renameDocument(doc.id, label.trim());
    setBusy(false);
    if (res.ok) { toast.success('Renamed', label.trim()); onClose(); } else setError(res.error);
  };
  return (
    <Modal open={Boolean(doc)} onClose={onClose} size="sm" title="Rename resume"
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Save</button></>}>
      <FormField label="Name" required hint="Shown when you choose a resume to apply with">
        <input className="input" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </FormField>
      {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
    </Modal>
  );
}

function UploadModal({ open, initialType, versionOf = null, onClose, academicLocked }) {
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
    if (versionOf) {
      setError('');
      setProgress(0);
      const res = await repo.uploadResumeVersion(versionOf.id, file, setProgress);
      setProgress(null);
      if (res.ok) {
        toast.success(`Version ${res.result.version} uploaded`, 'It is pending verification. Applications already submitted keep their copy.');
        onClose();
      } else setError(res.error);
      return;
    }
    if (needsLabel && !label.trim()) { setError('Give this document a name, e.g. "Data Resume"'); return; }
    if (DOC_TYPES[type].academic && academicLocked) { setError('Academic documents are locked.'); return; }
    setError('');
    // Real upload to the backend; progress comes from XHR upload events.
    setProgress(0);
    const res = await repo.addDocument(me.actor, student.id, { type, label: needsLabel ? label.trim() : null, file }, setProgress);
    setProgress(null);
    if (res.ok) {
      toast.success('Document uploaded', 'It is now pending verification.');
      onClose();
    } else {
      setError(res.error);
    }
  };

  return (
    <Modal
      open={open}
      onClose={progress ? () => {} : onClose}
      title={versionOf ? `New version of "${versionOf.label || versionOf.fileName}"` : 'Upload document'}
      description={versionOf ? `Replaces v${versionOf.version || 1} in your library (PDF, up to 5 MB). It goes back to the verifier queue.` : type === 'RESUME' ? 'Resumes must be PDF files, up to 5 MB.' : 'Uploaded securely to the PlaceMatrix server. PDF, PNG or JPG up to 5 MB.'}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={progress !== null}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={progress !== null}><Upload className="h-4 w-4" /> {progress !== null ? 'Uploading…' : 'Upload'}</button>
        </>
      )}
    >
      <div className="space-y-3">
        {!versionOf && (
          <FormField label="Document type" required>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {types.map(([t, m]) => <option key={t} value={t}>{m.label}</option>)}
            </select>
          </FormField>
        )}
        {needsLabel && !versionOf && (
          <FormField label="Name" required hint={type === 'RESUME' ? 'Shown when choosing a resume to apply with' : undefined}>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={type === 'RESUME' ? 'e.g. Data Resume' : 'e.g. AWS Cloud Practitioner'} />
          </FormField>
        )}
        {!versionOf && DOC_TYPES[type].academic && <p className="rounded-md bg-warning-50 px-3 py-2 text-xs text-amber-800">Uploading a new {DOC_TYPES[type].label.toLowerCase()} replaces the existing one and requires re-verification.</p>}
        <FileUpload key={versionOf ? 'v' : type} pdfOnly={Boolean(versionOf) || type === 'RESUME'} file={file} onSelect={(f) => { setFile(f); setError(''); }} onClear={() => setFile(null)} />
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
