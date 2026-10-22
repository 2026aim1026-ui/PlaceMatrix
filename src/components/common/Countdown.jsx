import { useNow } from '../../hooks/useNow';
import { formatCountdown, countdown } from '../../utils/dateUtils';

/** Live ticking countdown text. */
export default function Countdown({ to, className = '' }) {
  const now = useNow(1000);
  const c = countdown(to, now);
  const urgent = !c.expired && c.totalMs < 24 * 3600 * 1000;
  return (
    <span className={`mono tabular-nums ${urgent ? 'text-danger' : ''} ${className}`} aria-label={c.expired ? 'Closed' : `${c.days} days ${c.hours} hours ${c.minutes} minutes remaining`}>
      {formatCountdown(to, now)}
    </span>
  );
}
