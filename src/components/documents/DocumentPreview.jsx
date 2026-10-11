import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import { getFileData } from '../../data/mockRepository';
import MockDocument from './MockDocument';
import StatusBadge from '../common/StatusBadge';
import { DOC_TYPES } from '../../constants';

/**
 * Preview for a document record. Shows the real uploaded file when its contents are available in this
 * browser session (image or PDF), otherwise a generated mock rendering from the student's record.
 */
export default function DocumentPreview({ doc, student, zoomable = true, height = 'h-[560px]' }) {
  const [zoom, setZoom] = useState(1);
  if (!doc) return null;
  const data = getFileData(doc.id);
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
          {zoomable && (
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
        {data && !isImage ? (
          <iframe title={doc.fileName} src={data} className="h-full w-full rounded bg-white" style={{ minHeight: 480 }} />
        ) : (
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} className="transition-transform">
            {data && isImage ? (
              <img src={data} alt={doc.fileName} className="mx-auto max-w-full bg-white shadow-md" />
            ) : (
              <MockDocument doc={doc} student={student} />
            )}
          </div>
        )}
      </div>
      {!data && (
        <p className="flex items-center gap-1.5 border-t border-line px-3 py-1.5 text-[11px] text-ink-muted">
          <Info className="h-3 w-3" aria-hidden /> Demo preview generated from the record. Uploaded file contents are kept only in this browser.
        </p>
      )}
    </div>
  );
}
