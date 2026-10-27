import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumbs({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
            {item.to ? (
              <Link to={item.to} className="hover:text-brand hover:underline">{item.label}</Link>
            ) : (
              <span aria-current="page" className="font-medium text-ink-soft">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
