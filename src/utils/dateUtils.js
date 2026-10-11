const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

export const HOUR = 3600 * 1000;
export const DAY = 24 * HOUR;

/** "08 Oct, 02:17" */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "08 Oct 2026" */
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "08 Oct 2026, 02:17" */
export function formatFull(iso) {
  if (!iso) return '—';
  return `${formatDate(iso)}, ${formatDateTime(iso).split(', ')[1]}`;
}

/** Value for <input type="datetime-local"> */
export function toInputDateTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromInputDateTime(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Countdown parts until `iso` relative to `now`. */
export function countdown(iso, now = Date.now()) {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: diff };
  const s = Math.floor(diff / 1000);
  return {
    expired: false,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    totalMs: diff,
  };
}

/** "2d 14 : 33 : 07" or "14 : 33 : 07" */
export function formatCountdown(iso, now = Date.now()) {
  const c = countdown(iso, now);
  if (c.expired) return 'Closed';
  const hms = `${pad(c.hours)} : ${pad(c.minutes)} : ${pad(c.seconds)}`;
  return c.days > 0 ? `${c.days}d ${hms}` : hms;
}

/** "3h ago", "2d ago" */
export function timeAgo(iso, now = Date.now()) {
  const diff = now - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** "Waiting 2d 4h" */
export function waitingFor(iso, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const h = Math.floor(diff / HOUR);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
