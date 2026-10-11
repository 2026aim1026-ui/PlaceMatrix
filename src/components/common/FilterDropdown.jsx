import { ChevronDown } from 'lucide-react';

/** Compact labelled <select>. options: [{ value, label }] or strings. */
export default function FilterDropdown({ label, value, onChange, options, allLabel = 'All', className = '', showAll = true }) {
  const id = `f-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input h-9 appearance-none pr-8 text-[13px]">
        {showAll && <option value="">{`${label}: ${allLabel}`}</option>}
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return <option key={opt.value} value={opt.value}>{showAll ? `${label}: ${opt.label}` : opt.label}</option>;
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
    </div>
  );
}
