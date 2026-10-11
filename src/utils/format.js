export const formatCtc = (lpa) => `₹${Number(lpa).toLocaleString('en-IN', { maximumFractionDigits: 1 })} LPA`;

export const formatCgpa = (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toFixed(2));

export const formatPct = (v) => (v === null || v === undefined || v === '' ? '—' : `${Number(v).toFixed(2)} %`);

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function fileExt(name = '') {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toUpperCase() : 'FILE';
}
