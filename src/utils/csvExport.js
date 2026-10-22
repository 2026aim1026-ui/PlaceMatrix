function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build CSV text from rows and [{ key, header, value? }] columns. */
export function toCsv(rows, columns) {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value ? c.value(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename, rows, columns) {
  const csv = '﻿' + toCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
