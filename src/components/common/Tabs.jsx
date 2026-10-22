/** Pill tabs used for quick filters (All / Eligible / Ineligible / Applied). */
export default function Tabs({ tabs, value, onChange, label = 'Filter' }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${value === t.value ? 'bg-navy text-white' : 'text-ink-soft hover:bg-canvas'}`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`rounded px-1 text-[10px] ${value === t.value ? 'bg-white/20' : 'bg-canvas text-ink-muted'}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
