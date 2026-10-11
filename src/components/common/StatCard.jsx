import { Link } from 'react-router-dom';

const ICON_TONES = {
  blue: 'bg-brand-50 text-brand',
  green: 'bg-success-50 text-success',
  amber: 'bg-warning-50 text-amber-600',
  red: 'bg-danger-50 text-danger',
  violet: 'bg-violet-50 text-violet-600',
  gray: 'bg-canvas text-ink-soft',
};

export default function StatCard({ icon: Icon, label, value, hint, tone = 'blue', to, onClick, active = false }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ICON_TONES[tone]}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1 text-right sm:text-left">
          <p className="truncate text-[11px] font-medium text-ink-muted">{label}</p>
          <p className="text-xl font-bold leading-tight text-ink">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 truncate text-[11px] text-ink-muted">{hint}</p>}
    </>
  );
  const cls = `card block p-3.5 text-left transition ${to || onClick ? 'hover:border-brand/40 hover:shadow-md' : ''} ${active ? 'border-brand ring-2 ring-brand/15' : ''}`;
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full`} aria-pressed={active}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
