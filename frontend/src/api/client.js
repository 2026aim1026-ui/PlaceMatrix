// Thin HTTP client for the PlaceMatrix FastAPI backend.
// The session token lives in localStorage ("Remember me") or sessionStorage.

import { STORAGE_KEYS } from '../constants';

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let unauthorizedHandler = null;
/** Called when the server says the session is no longer valid (expired token, disabled account). */
export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

export function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION) || sessionStorage.getItem(STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(session) {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    if (session) (session.remember === false ? sessionStorage : localStorage).setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  } catch {
    /* storage unavailable: the session lives in memory only */
  }
}

function token() {
  return readStoredSession()?.token || null;
}

function messageFrom(body, status) {
  if (body && typeof body === 'object') {
    const d = body.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d.length) {
      const first = d[0];
      const field = Array.isArray(first.loc) ? first.loc.filter((x) => x !== 'body').join('.') : '';
      return `${field ? `${field}: ` : ''}${first.msg || 'Invalid value'}`;
    }
  }
  if (status === 0) return 'Cannot reach the PlaceMatrix server. Is the backend running?';
  return `Request failed (${status})`;
}

/**
 * request('GET', '/api/state') → parsed JSON. Throws ApiError with the server's message.
 * Options: { form: FormData, raw: true (return Response), auth: false }
 */
export async function request(method, path, body, { form, raw = false, auth = true } = {}) {
  const headers = {};
  const t = auth ? token() : null;
  if (t) headers.Authorization = `Bearer ${t}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(messageFrom(null, 0), 0);
  }
  if (res.status === 401 && t && unauthorizedHandler) unauthorizedHandler();
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* not JSON */ }
    throw new ApiError(messageFrom(data, res.status), res.status);
  }
  if (raw) return res;
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  return type.includes('application/json') ? res.json() : res.text();
}

export const api = {
  get: (p, o) => request('GET', p, undefined, o),
  post: (p, b, o) => request('POST', p, b, o),
  put: (p, b, o) => request('PUT', p, b, o),
  patch: (p, b, o) => request('PATCH', p, b, o),
  del: (p, o) => request('DELETE', p, undefined, o),
};

/** Upload with real progress events (fetch has no upload progress). */
export function uploadWithProgress(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    const t = token();
    if (t) xhr.setRequestHeader('Authorization', `Bearer ${t}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else {
        if (xhr.status === 401 && unauthorizedHandler) unauthorizedHandler();
        reject(new ApiError(messageFrom(data, xhr.status), xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError(messageFrom(null, 0), 0));
    xhr.send(form);
  });
}

/** Download an authenticated file (CSV export etc.) and save it with the server's filename. */
export async function downloadFile(path, fallbackName) {
  const res = await request('GET', path, undefined, { raw: true });
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename="?([^";]+)"?/i);
  const name = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { name, rows: Number(res.headers.get('x-row-count') || 0) };
}

/** Fetch an authenticated document as an object URL for previews. Caller must revoke it. */
export async function fetchObjectUrl(path) {
  const res = await request('GET', path, undefined, { raw: true });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
