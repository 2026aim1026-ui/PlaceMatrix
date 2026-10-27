import { STAGE_LABELS, STAGE_ORDER } from '../../constants';
import { formatFull } from '../../utils/dateUtils';

/** Vertical timeline of an application's stage history plus upcoming stages. */
export default function ApplicationTimeline({ application }) {
  const history = application.history;
  const terminal = ['REJECTED', 'WITHDRAWN', 'OFFERED'].includes(application.stage);
  const reached = new Set(history.map((h) => h.stage));
  const upcoming = terminal ? [] : STAGE_ORDER.filter((s) => !reached.has(s) && STAGE_ORDER.indexOf(s) > STAGE_ORDER.indexOf(application.stage));

  return (
    <ol className="relative ml-2 border-l-2 border-line pl-5">
      {history.map((h, i) => {
        const bad = h.stage === 'REJECTED' || h.stage === 'WITHDRAWN';
        const last = i === history.length - 1;
        return (
          <li key={`${h.stage}-${i}`} className="relative pb-4">
            <span className={`absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full ring-4 ring-white ${bad ? 'bg-danger' : last ? 'bg-brand' : 'bg-success'}`} aria-hidden />
            <p className="text-sm font-semibold text-ink">{STAGE_LABELS[h.stage]}</p>
            <p className="text-[11.5px] text-ink-muted">{formatFull(h.at)} · {h.by}</p>
            {h.note && <p className="mt-0.5 text-xs text-ink-soft">{h.note}</p>}
          </li>
        );
      })}
      {upcoming.map((s) => (
        <li key={s} className="relative pb-4 opacity-60">
          <span className="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-line bg-white ring-4 ring-white" aria-hidden />
          <p className="text-sm font-medium text-ink-muted">{STAGE_LABELS[s]}</p>
          <p className="text-[11.5px] text-ink-muted">Upcoming</p>
        </li>
      ))}
    </ol>
  );
}
