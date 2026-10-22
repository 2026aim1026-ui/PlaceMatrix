import { Search, X } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '', label = 'Search' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted hover:text-ink" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
