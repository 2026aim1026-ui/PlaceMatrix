import { useRef, useState } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { validateFile } from '../../utils/validation';
import { formatBytes } from '../../utils/format';

/** Drag-and-drop / click file picker with validation. Calls onSelect(file) or shows an error. */
export default function FileUpload({ file, onSelect, onClear, accept = '.pdf,.png,.jpg,.jpeg', hint = 'PDF, PNG or JPG · max 5 MB' }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');

  const handle = (f) => {
    const err = validateFile(f);
    setError(err || '');
    if (!err) onSelect(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas/60 p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand"><FileText className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
          <p className="text-xs text-ink-muted">{formatBytes(file.size)} · {file.type.split('/')[1]?.toUpperCase()}</p>
        </div>
        <button type="button" onClick={() => { onClear(); if (inputRef.current) inputRef.current.value = ''; }} className="rounded p-1 text-ink-muted hover:bg-white hover:text-ink" aria-label="Remove selected file">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
        className={`flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors ${drag ? 'border-brand bg-brand-50' : error ? 'border-danger/50 bg-danger-50/40' : 'border-line hover:border-brand/50 hover:bg-canvas'}`}
      >
        <UploadCloud className="mb-2 h-6 w-6 text-brand" aria-hidden />
        <span className="text-sm font-medium text-ink">Drop a file here or <span className="text-brand underline">browse</span></span>
        <span className="mt-0.5 text-xs text-ink-muted">{hint}</span>
      </button>
      <input ref={inputRef} type="file" accept={accept} className="sr-only" aria-label="Choose file" onChange={(e) => handle(e.target.files?.[0])} />
      {error && <p className="mt-1.5 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}
