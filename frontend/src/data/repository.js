// API-backed repository. Keeps the same function names the pages used with the old mock store,
// but every mutation is now an HTTP call to the FastAPI backend (PostgreSQL is the source of truth).
//
// - `getState()` / `subscribe()` expose a role-scoped snapshot from GET /api/state (useSyncExternalStore).
// - Every mutation resolves to { ok: true, result } or { ok: false, error } after the snapshot is refreshed,
//   so the UI shows the new state immediately.
// - A light poll of GET /api/sync keeps every open browser in step (no stale drive status or deadlines).
// The `actor` argument is kept for compatibility; the server identifies the actor from the session token.

import { api, downloadFile, fetchObjectUrl, uploadWithProgress, readStoredSession, ApiError } from '../api/client';

const EMPTY = Object.freeze({
  version: 0,
  loaded: false,
  adminUsers: [],
  students: [],
  documents: [],
  companies: [],
  drives: [],
  applications: [],
  invitations: [],
  tickets: [],
  audit: [],
  notifications: [],
});

let state = EMPTY;
let config = { demoMode: false, demoAccounts: [], allowedDomain: 'iitrpr.ac.in', googleClientId: null, demoPassword: null };
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConfig() {
  return config;
}

export async function loadConfig() {
  try {
    config = { ...config, ...(await api.get('/api/config', { auth: false })) };
    emit();
  } catch {
    /* backend unreachable — login page shows the error on submit */
  }
  return config;
}

// ---------------------------------------------------------------------------
// Snapshot + live sync
// ---------------------------------------------------------------------------

let inflight = null;
let inflightToken = null;

/** Reload the role-scoped snapshot. Concurrent calls for the same session share one request. */
export function refresh() {
  const token = readStoredSession()?.token || null;
  if (!inflight || inflightToken !== token) {
    inflightToken = token;
    const p = api.get('/api/state')
      .then(({ version, data }) => {
        if (inflightToken === token) {
          state = { ...EMPTY, ...data, version, loaded: true };
          emit();
        }
        return state;
      })
      .finally(() => {
        if (inflight === p) inflight = null;
      });
    inflight = p;
  }
  return inflight;
}

export function clear() {
  state = EMPTY;
  emit();
}

let pollTimer = null;
const POLL_MS = 4000;

async function poll() {
  if (document.visibilityState === 'hidden') return;
  try {
    const { version } = await api.get('/api/sync');
    if (version !== state.version) await refresh();
  } catch {
    /* transient network error — try again on the next tick */
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') poll();
}

export function startSync() {
  stopSync();
  pollTimer = setInterval(poll, POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', poll);
}

export function stopSync() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('focus', poll);
}

/** Run an API call, refresh the snapshot, and normalise the outcome to { ok, result | error }. */
async function run(fn, { refreshAfter = true } = {}) {
  try {
    const result = await fn();
    if (refreshAfter) {
      try { await refresh(); } catch { /* the action succeeded; the poll will catch up */ }
    }
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Unexpected error — the change was not saved.' };
  }
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

export function resetDemoData() {
  return run(() => api.post('/api/demo/reset', undefined, { auth: false }), { refreshAfter: false });
}

// ---------------------------------------------------------------------------
// Applications & shortlisting
// ---------------------------------------------------------------------------

export const applyToDrive = (_actor, _studentId, driveId, resumeId) => run(() => api.post('/api/applications/apply', { driveId, resumeId }));

export const withdrawApplication = (_actor, applicationId) => run(() => api.post(`/api/applications/${applicationId}/withdraw`));

export const updateApplicationStages = (_actor, applicationIds, stage, { note = '' } = {}) =>
  run(() => api.post('/api/applications/stages', { applicationIds, stage, note }));

/** Server-side parse of pasted roll numbers (no changes made). */
export const previewShortlist = (driveId, text, targetStage) =>
  run(() => api.post('/api/spoc/bulk-shortlist/preview', { driveId, text, targetStage }), { refreshAfter: false });

/** Parse again on the server and move every READY applicant atomically. */
export const executeShortlist = (driveId, text, targetStage) =>
  run(() => api.post('/api/spoc/bulk-shortlist', { driveId, text, targetStage }));

/** UTF-8 CSV roster generated by the server (quoted cells, formula-injection safe, audited). */
export function exportRosterCsv(driveId, { q = '', branch = '', stage = '' } = {}) {
  const params = new URLSearchParams({ q, branch, stage });
  return run(() => downloadFile(`/api/drives/${driveId}/roster.csv?${params}`, 'roster.csv'));
}

// ---------------------------------------------------------------------------
// Student profile, documents & tickets
// ---------------------------------------------------------------------------

export const updateStudentProfile = (_actor, studentId, patch) => run(() => api.patch(`/api/students/${studentId}/profile`, { patch }));

export const submitForVerification = (_actor, studentId) => run(() => api.post(`/api/students/${studentId}/submit`));

export function addDocument(_actor, _studentId, { type, label, file }, onProgress) {
  const form = new FormData();
  form.append('type', type);
  if (label) form.append('label', label);
  form.append('file', file, file.name);
  return run(() => uploadWithProgress('/api/documents', form, onProgress));
}

export const removeDocument = (_actor, docId) => run(() => api.del(`/api/documents/${docId}`));

export const setDefaultResume = (_actor, _studentId, docId) => run(() => api.post(`/api/documents/${docId}/default`));

export const reviewDocument = (_actor, docId, status, remarks = '') => run(() => api.post(`/api/documents/${docId}/review`, { status, remarks }));

/** Object URL for an uploaded file (PDF / image). The caller revokes it. */
export const getFileUrl = (docId) => fetchObjectUrl(`/api/documents/${docId}/file`);

export const createTicket = (_actor, _studentId, { type, field, requestedValue, justification }) =>
  run(() => api.post('/api/tickets', { type, field, requestedValue, justification }));

export const resolveTicket = (_actor, ticketId, decision, resolution) =>
  run(() => api.post(`/api/tickets/${ticketId}/resolve`, { decision, resolution }));

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export const setProofValues = (_actor, studentId, values) => run(() => api.put(`/api/verification/${studentId}/proof`, { values }));

export const approveProfile = (_actor, studentId, remarks = '') => run(() => api.post(`/api/verification/${studentId}/approve`, { remarks }));

export const requestRevision = (_actor, studentId, reason, docIds = []) =>
  run(() => api.post(`/api/verification/${studentId}/revision`, { reason, docIds }));

export const rejectProfile = (_actor, studentId, reason) => run(() => api.post(`/api/verification/${studentId}/reject`, { reason }));

// ---------------------------------------------------------------------------
// Companies & drives
// ---------------------------------------------------------------------------

export const saveCompany = (_actor, data) => run(() => api.post('/api/companies', data));

export const approveCompany = (_actor, companyId) => run(() => api.post(`/api/companies/${companyId}/approve`));

export const assignSpoc = (_actor, companyId, spocId) => run(() => api.post(`/api/companies/${companyId}/assign-spoc`, { spocId }));

export const setCompanyActive = (_actor, companyId, active) => run(() => api.post(`/api/companies/${companyId}/active`, { active }));

export const saveDrive = (_actor, data) => run(() => api.post('/api/drives', data));

export const setDriveStatus = (_actor, driveId, status) => run(() => api.post(`/api/drives/${driveId}/status`, { status }));

export const extendDeadline = (_actor, driveId, deadline, reason) => run(() => api.post(`/api/drives/${driveId}/extend`, { deadline, reason }));

export const logExport = (_actor, entity, description) => run(() => api.post('/api/audit/export-log', { entity, description }));

export const exportAuditCsv = () => run(() => downloadFile('/api/audit/export.csv', 'placematrix_audit_trail.csv'), { refreshAfter: true });

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export const addInvitees = (_actor, rows) => run(() => api.post('/api/invitations/import', { rows }));

export const sendInvitations = (_actor, ids) => run(() => api.post('/api/invitations/send', { ids }));

export const regenerateInviteLink = (inviteId) => run(() => api.post(`/api/invitations/${inviteId}/link`));

export const acceptInvitation = (inviteId) => run(() => api.post(`/api/invitations/${inviteId}/accept`));

export const declineInvitation = (inviteId) => run(() => api.post(`/api/invitations/${inviteId}/decline`));

// ---------------------------------------------------------------------------
// Users, analytics, notifications
// ---------------------------------------------------------------------------

export const createUser = (data) => run(() => api.post('/api/users', data));

export const updateUser = (email, patch) => run(() => api.put(`/api/users/${encodeURIComponent(email)}`, patch));

export const resetUserPassword = (email) => run(() => api.post(`/api/users/${encodeURIComponent(email)}/reset-password`));

export const fetchAnalytics = () => run(() => api.get('/api/analytics/summary'), { refreshAfter: false });

export async function markNotificationsRead() {
  try {
    await api.post('/api/notifications/read-all');
    await refresh();
  } catch {
    /* not critical */
  }
}
