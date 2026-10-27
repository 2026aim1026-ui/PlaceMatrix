import { useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Info, Download } from 'lucide-react';
import * as repo from '../../data/repository';
import MockDocument from './MockDocument';
import StatusBadge from '../common/StatusBadge';
import { DOC_TYPES } from '../../constants';

/** Fetch the uploaded file through the authenticated API and expose it as an object URL. */
function useFileUrl(doc) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!doc?.hasFile) { setUrl(null); setError(''); return undefined; }
    let objectUrl = null;
    let cancelled = false;
    setLoading(true);
    setError('');
    repo.getFileUrl(doc.id)
      .then((u) => {
        objectUrl = u;
        if (cancelled) URL.revokeObjectURL(u);
        else setUrl(u);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [doc?.id, doc?.hasFile]);
  return { url, error, loading };
}

/**
 * Preview for a document record: the real uploaded PDF / image served by the backend.
 * Falls back to a rendering generated from the record if the file cannot be shown.
 */
export default function DocumentPreview({ doc, student, zoomable = true, height = 'h-[560px]' }) {
  const [zoom, setZoom] = useState(1);
  const { url, error, loading } = useFileUrl(doc);
  if (!doc) return null;
  const isImage = doc.fileType?.startsWith('image/');

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ink">{doc.fileName}</p>
          <p className="text-[11px] text-ink-muted">{doc.label || DOC_TYPES[doc.type]?.label}</p>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge status={doc.status} />
          {url && (
            <a href={url} download={doc.fileName} className="ml-1 rounded-md p-1.5 text-ink-soft ring-1 ring-line hover:bg-canvas" aria-label="Download file" title="Download">
              <Download className="h-3.5 w-3.5" />
            </a>
          )}
          {zoomable && (isImage || !url) && (
            <div className="ml-2 flex items-center rounded-md ring-1 ring-line">
              <button type="button" className="p-1.5 text-ink-soft hover:bg-canvas disabled:opacity-40" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} disabled={zoom <= 0.6} aria-label="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></button>
              <span className="w-10 text-center text-[11px] font-medium text-ink-soft">{Math.round(zoom * 100)}%</span>
              <button type="button" className="p-1.5 text-ink-soft hover:bg-canvas disabled:opacity-40" onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(1)))} disabled={zoom >= 2} aria-label="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></button>
              <button type="button" className="border-l border-line p-1.5 text-ink-soft hover:bg-canvas" onClick={() => setZoom(1)} aria-label="Reset zoom"><RotateCcw className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      </div>
      <div className={`relative overflow-auto bg-[#E9EDF5] p-4 ${height}`}>
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-muted" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/25 border-t-brand" aria-hidden /> Loading document…
          </div>
        ) : url && !isImage ? (
          <iframe title={doc.fileName} src={url} className="h-full w-full rounded bg-white" style={{ minHeight: 480 }} />
        ) : (
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} className="transition-transform">
            {url && isImage ? (
              <img src={url} alt={doc.fileName} className="mx-auto max-w-full bg-white shadow-md" />
            ) : (
              <MockDocument doc={doc} student={student} />
            )}
          </div>
        )}
      </div>
      {!loading && !url && (
        <p className="flex items-center gap-1.5 border-t border-line px-3 py-1.5 text-[11px] text-ink-muted">
          <Info className="h-3 w-3" aria-hidden /> {error ? `File could not be loaded (${error}). ` : 'No file stored for this record. '}Showing a preview generated from the record.
        </p>
      )}
    </div>
  );
}
