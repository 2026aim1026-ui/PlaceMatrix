import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pageCount, total, pageSize, onPage }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-line px-3 py-2.5 text-xs text-ink-muted sm:flex-row">
      <span>Showing {from}–{to} of {total}</span>
      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`h-7 min-w-7 rounded-md px-2 text-xs font-semibold ${p === page ? 'bg-brand text-white' : 'text-ink-soft hover:bg-canvas'}`}
            >
              {p}
            </button>
          ))}
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
}
