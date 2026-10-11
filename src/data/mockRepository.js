// Centralized mock repository backed by localStorage.
// Every mutation goes through `commit`, which persists the whole dataset, appends audit events
// and notifies subscribers (React re-renders through useSyncExternalStore in DataContext).
// This is a single-browser demo store — changes are not shared across browsers or devices.

import { buildSeed } from './seedData';
import { STORAGE_KEYS, VERIFICATION, DOC_STATUS, DOC_TYPES, STAGE_LABELS, TERMINAL_STAGES, DRIVE_STATUS } from '../constants';
import { checkTransition } from '../utils/bulkParser';
import { canApply } from '../utils/eligibility';
import { formatDateTime } from '../utils/dateUtils';
import { formatCtc, uid } from '../utils/format';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

let state = load();
const listeners = new Set();

// Uploaded file contents that are too large for localStorage live here for the session only.
const fileCache = new Map();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DB);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && Array.isArray(parsed.students)) return parsed;
    }
  } catch {
    /* corrupted or unavailable storage — fall through to a fresh seed */
  }
  const seed = buildSeed();
  persist(seed);
  return seed;
}

function persist(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

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

// Keep tabs in sync when another tab of the same browser changes the data.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEYS.DB && e.newValue) {
      try {
        state = JSON.parse(e.newValue);
        emit();
      } catch {
        /* ignore */
      }
    }
  });
}

class RepoError extends Error {}
const fail = (msg) => {
  throw new RepoError(msg);
};

/**
 * Apply a mutation to a draft copy of the state. The mutator may push audit entries via `log`.
 * Returns { ok: true, result } or { ok: false, error }.
 */
function commit(actor, mutator) {
  const draft = structuredClone(state);
  const events = [];
  const log = (entity, action, description) => {
    events.push({
      id: uid('ev'),
      at: new Date().toISOString(),
      actorName: actor?.name || 'System Engine',
      actorRole: actor?.role || 'SYSTEM',
      entity,
      action,
      description,
    });
  };
  try {
    const result = mutator(draft, log);
    draft.audit = [...draft.audit, ...events]; // append-only
    if (!persist(draft)) {
      // Most likely quota exceeded because of an embedded file; strip embedded data and retry.
      draft.documents.forEach((d) => {
        if (d.dataUrl) {
          fileCache.set(d.id, d.dataUrl);
          delete d.dataUrl;
        }
      });
      persist(draft);
    }
    state = draft;
    emit();
    return { ok: true, result };
  } catch (err) {
    if (err instanceof RepoError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: 'Unexpected error — the change was not saved.' };
  }
}

const find = (list, id, label) => list.find((x) => x.id === id) || fail(`${label} not found`);
const now = () => new Date().toISOString();

function notify(draft, userId, message, link) {
  draft.notifications.unshift({ id: uid('n'), userId, message, at: now(), read: false, link });
}

const companyOf = (draft, drive) => draft.companies.find((c) => c.id === drive.companyId);
const driveName = (draft, drive) => `${companyOf(draft, drive)?.name || 'Company'} — ${drive.role}`;

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

export function resetDemoData() {
  fileCache.clear();
  state = buildSeed();
  persist(state);
  emit();
  return { ok: true };
}

export function getFileData(docId) {
  const doc = state.documents.find((d) => d.id === docId);
  return doc?.dataUrl || fileCache.get(docId) || null;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export function applyToDrive(actor, studentId, driveId, resumeId) {
  return commit(actor, (draft, log) => {
    const student = find(draft.students, studentId, 'Student');
    const drive = find(draft.drives, driveId, 'Drive');
    const check = canApply(student, drive, draft.applications);
    if (!check.ok) fail(check.reason);
    const resume = draft.documents.find((d) => d.id === resumeId && d.studentId === studentId && d.type === 'RESUME');
    if (!resume) fail('Select a resume to attach');
    if (resume.status !== DOC_STATUS.APPROVED) fail('Only verified resumes can be attached to an application');

    const at = now();
    const application = {
      id: uid('a'),
      studentId,
      driveId,
      resumeId,
      appliedAt: at,
      stage: 'APPLIED',
      updatedAt: at,
      history: [{ stage: 'APPLIED', at, by: 'Student', note: `Applied with ${resume.label || resume.fileName}` }],
    };
    draft.applications.push(application);
    log('Application', 'APPLICATION_SUBMITTED', `${student.roll} applied to ${driveName(draft, drive)} with ${resume.fileName}.`);
    return application;
  });
}

export function withdrawApplication(actor, applicationId) {
  return commit(actor, (draft, log) => {
    const app = find(draft.applications, applicationId, 'Application');
    if (TERMINAL_STAGES.includes(app.stage)) fail(`Application is already ${STAGE_LABELS[app.stage]}`);
    app.stage = 'WITHDRAWN';
    app.updatedAt = now();
    app.history.push({ stage: 'WITHDRAWN', at: app.updatedAt, by: 'Student', note: 'Withdrawn by student' });
    const student = find(draft.students, app.studentId, 'Student');
    const drive = find(draft.drives, app.driveId, 'Drive');
    log('Application', 'APPLICATION_WITHDRAWN', `${student.roll} withdrew from ${driveName(draft, drive)}.`);
  });
}

/**
 * Move one or more applications to a stage. Invalid transitions are skipped and reported.
 * Moving to OFFERED marks the student placed and auto-withdraws their other active applications (one-offer policy).
 */
export function updateApplicationStages(actor, applicationIds, stage, { note = '', source = 'manual' } = {}) {
  return commit(actor, (draft, log) => {
    const moved = [];
    const skipped = [];
    applicationIds.forEach((id) => {
      const app = find(draft.applications, id, 'Application');
      const check = checkTransition(app.stage, stage);
      if (!check.ok) {
        skipped.push({ id, reason: check.reason });
        return;
      }
      const from = app.stage;
      app.stage = stage;
      app.updatedAt = now();
      app.history.push({ stage, at: app.updatedAt, by: actor.name, note: note || (source === 'bulk' ? 'Bulk shortlist parser' : '') });
      const student = draft.students.find((s) => s.id === app.studentId);
      const drive = draft.drives.find((d) => d.id === app.driveId);
      moved.push(student.roll);
      notify(draft, student.id, `${driveName(draft, drive)}: your application moved to ${STAGE_LABELS[stage]}.`, '/student/applications');
      if (source !== 'bulk') {
        log('Application', 'STAGE_CHANGED', `${student.roll} · ${driveName(draft, drive)}: ${STAGE_LABELS[from]} → ${STAGE_LABELS[stage]}.`);
      }

      if (stage === 'OFFERED') {
        const company = companyOf(draft, drive);
        student.placement = 'PLACED';
        student.placedCompany = company?.name || null;
        const others = draft.applications.filter(
          (a) => a.studentId === student.id && a.id !== app.id && !TERMINAL_STAGES.includes(a.stage),
        );
        others.forEach((a) => {
          a.stage = 'WITHDRAWN';
          a.updatedAt = now();
          a.history.push({ stage: 'WITHDRAWN', at: a.updatedAt, by: 'System Engine', note: 'Auto-withdrawn: one-offer policy' });
        });
        log('Profile', 'POLICY_LOCK_TRIGGERED',
          `${student.roll} placed at ${company?.name} (${formatCtc(drive.ctc)}). ${others.length} concurrent application(s) auto-WITHDRAWN.`);
      }
    });
    if (moved.length && source === 'bulk') {
      const drive = draft.drives.find((d) => d.id === draft.applications.find((a) => a.id === applicationIds[0])?.driveId);
      log('Application', 'BATCH_SHORTLIST_EXECUTED',
        `${drive ? driveName(draft, drive) : 'Drive'}: ${moved.length} candidate(s) moved to ${stage} (${moved.join(', ')}).`);
    }
    if (!moved.length && skipped.length) fail(skipped[0].reason);
    return { moved, skipped };
  });
}

// ---------------------------------------------------------------------------
// Student profile & documents
// ---------------------------------------------------------------------------

const ACADEMIC_FIELDS = ['degree', 'branch', 'gradYear', 'cgpa', 'semCgpa', 'class10', 'class12', 'backlogs'];
const CONTACT_FIELDS = ['name', 'phone', 'skills'];

export function updateStudentProfile(actor, studentId, patch) {
  return commit(actor, (draft, log) => {
    const s = find(draft.students, studentId, 'Student');
    const touchesAcademic = Object.keys(patch).some((k) => ACADEMIC_FIELDS.includes(k));
    if (touchesAcademic && s.locked) fail('Academic record is locked. Raise a correction request instead.');
    if (touchesAcademic && s.verification === VERIFICATION.PENDING) fail('Profile is under verification and cannot be edited right now.');
    Object.entries(patch).forEach(([k, v]) => {
      if (ACADEMIC_FIELDS.includes(k) || CONTACT_FIELDS.includes(k)) s[k] = v;
    });
    // Keep academic document claimed values in sync with the profile.
    if (touchesAcademic) {
      draft.documents.filter((d) => d.studentId === s.id).forEach((d) => {
        if (d.type === 'GRADE_CARD') d.claimedValue = `CGPA ${Number(s.cgpa).toFixed(2)}`;
        if (d.type === 'CLASS10') d.claimedValue = `${Number(s.class10).toFixed(2)} %`;
        if (d.type === 'CLASS12') d.claimedValue = `${Number(s.class12).toFixed(2)} %`;
      });
    }
    log('Profile', touchesAcademic ? 'ACADEMIC_RECORD_UPDATED' : 'CONTACT_UPDATED', `${s.roll} updated ${Object.keys(patch).join(', ')}.`);
  });
}

export function missingForSubmission(draft, s) {
  const missing = [];
  ['cgpa', 'class10', 'class12', 'branch', 'degree'].forEach((f) => {
    if (s[f] === null || s[f] === undefined || s[f] === '') missing.push(f);
  });
  const docs = draft.documents.filter((d) => d.studentId === s.id);
  ['GRADE_CARD', 'CLASS10', 'CLASS12', 'RESUME'].forEach((t) => {
    if (!docs.some((d) => d.type === t && d.status !== DOC_STATUS.REJECTED)) missing.push(DOC_TYPES[t].label);
  });
  return missing;
}

export function submitForVerification(actor, studentId) {
  return commit(actor, (draft, log) => {
    const s = find(draft.students, studentId, 'Student');
    if (s.locked) fail('Profile is already verified and locked');
    if (s.verification === VERIFICATION.PENDING) fail('Profile is already awaiting verification');
    const missing = missingForSubmission(draft, s);
    if (missing.length) fail(`Complete these first: ${missing.join(', ')}`);
    s.verification = VERIFICATION.PENDING;
    s.submittedAt = now();
    draft.documents
      .filter((d) => d.studentId === s.id && d.status === DOC_STATUS.REVISION)
      .forEach((d) => {
        d.status = DOC_STATUS.PENDING;
      });
    log('Profile', 'PROFILE_SUBMITTED', `${s.roll} (${s.name}) submitted profile for verification.`);
  });
}

export function addDocument(actor, studentId, { type, label, file, dataUrl }) {
  return commit(actor, (draft, log) => {
    const s = find(draft.students, studentId, 'Student');
    const meta = DOC_TYPES[type] || fail('Unknown document type');
    if (meta.academic && s.locked) fail('Academic documents are locked with your verified profile.');
    const id = uid('doc');
    // Replace an existing academic proof of the same type rather than stacking duplicates.
    if (meta.academic) draft.documents = draft.documents.filter((d) => !(d.studentId === studentId && d.type === type));
    const claimed = type === 'GRADE_CARD' ? `CGPA ${Number(s.cgpa || 0).toFixed(2)}`
      : type === 'CLASS10' ? `${Number(s.class10 || 0).toFixed(2)} %`
      : type === 'CLASS12' ? `${Number(s.class12 || 0).toFixed(2)} %` : null;
    const doc = {
      id,
      studentId,
      type,
      label: label || null,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      uploadedAt: now(),
      status: DOC_STATUS.PENDING,
      remarks: '',
      claimedValue: claimed,
      isDefault: false,
    };
    if (dataUrl) {
      if (dataUrl.length < 400 * 1024) doc.dataUrl = dataUrl;
      else fileCache.set(id, dataUrl);
    }
    if (type === 'RESUME' && !draft.documents.some((d) => d.studentId === studentId && d.type === 'RESUME')) {
      doc.isDefault = true;
      s.defaultResumeId = id;
    }
    draft.documents.push(doc);
    log('Document', 'DOCUMENT_UPLOADED', `${s.roll} uploaded ${meta.label}${label ? ` (${label})` : ''}: ${file.name}.`);
    return doc;
  });
}

export function removeDocument(actor, docId) {
  return commit(actor, (draft, log) => {
    const doc = find(draft.documents, docId, 'Document');
    const s = find(draft.students, doc.studentId, 'Student');
    if (DOC_TYPES[doc.type]?.academic && s.locked) fail('Verified academic documents cannot be removed.');
    const usedBy = draft.applications.find((a) => a.resumeId === docId && !TERMINAL_STAGES.includes(a.stage));
    if (usedBy) fail('This resume is attached to an active application and cannot be removed.');
    draft.documents = draft.documents.filter((d) => d.id !== docId);
    fileCache.delete(docId);
    if (s.defaultResumeId === docId) {
      const next = draft.documents.find((d) => d.studentId === s.id && d.type === 'RESUME' && d.status === DOC_STATUS.APPROVED);
      s.defaultResumeId = next?.id || null;
      if (next) next.isDefault = true;
    }
    log('Document', 'DOCUMENT_REMOVED', `${s.roll} removed ${doc.fileName}.`);
  });
}

export function setDefaultResume(actor, studentId, docId) {
  return commit(actor, (draft, log) => {
    const s = find(draft.students, studentId, 'Student');
    const doc = find(draft.documents, docId, 'Document');
    if (doc.status !== DOC_STATUS.APPROVED) fail('Only verified resumes can be set as default.');
    draft.documents.filter((d) => d.studentId === studentId && d.type === 'RESUME').forEach((d) => {
      d.isDefault = d.id === docId;
    });
    s.defaultResumeId = docId;
    log('Document', 'DEFAULT_RESUME_SET', `${s.roll} set ${doc.fileName} as default resume.`);
  });
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/** Compare a student's claimed values with the values read from their proofs. */
export function compareClaims(student) {
  const p = student.proof || {};
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  const rows = [
    { key: 'cgpa', label: 'Overall CGPA', claimed: num(student.cgpa), proof: num(p.cgpa), numeric: true },
    { key: 'class10', label: 'Class 10 %', claimed: num(student.class10), proof: num(p.class10), numeric: true },
    { key: 'class12', label: 'Class 12 %', claimed: num(student.class12), proof: num(p.class12), numeric: true },
    { key: 'backlogs', label: 'Active backlogs', claimed: num(student.backlogs), proof: num(p.backlogs), numeric: true, integer: true },
    { key: 'branch', label: 'Branch / Degree', claimed: `${student.branch} · ${student.degree}`,
      proof: p.branch && p.degree ? `${p.branch} · ${p.degree}` : null, numeric: false },
  ];
  return rows.map((r) => {
    const hasProof = r.proof !== null && !(r.numeric && Number.isNaN(r.proof));
    const match = hasProof && r.claimed !== null && (r.numeric ? Math.abs(r.claimed - r.proof) < 0.005 : r.claimed === r.proof);
    const fmt = (v) => (v === null || v === undefined ? '—' : r.numeric ? (r.integer ? String(v) : Number(v).toFixed(2)) : v);
    return { ...r, mandatory: true, hasProof, match, claimedText: fmt(r.claimed), proofText: fmt(r.proof) };
  });
}

/** Verifier records the value read off the proof document (the "As per proof" column). */
export function setProofValues(actor, studentId, values) {
  return commit(actor, (draft, log) => {
    const s = find(draft.students, studentId, 'Student');
    s.proof = { ...(s.proof || {}), ...values };
    log('Verification', 'PROOF_VALUES_RECORDED', `${actor.name} recorded proof values for ${s.roll}: ${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(', ')}.`);
  });
}

export function approveProfile(actor, studentId, remarks = '') {
  return commit(actor, (draft, log) => {
    const s = find(draft.students, studentId, 'Student');
    if (s.verification !== VERIFICATION.PENDING) fail('Only profiles awaiting verification can be approved.');
    const mismatches = compareClaims(s).filter((r) => r.mandatory && !r.match);
    if (mismatches.length) fail(`Resolve mismatches first: ${mismatches.map((m) => m.label).join(', ')}`);
    s.verification = VERIFICATION.VERIFIED;
    s.locked = true;
    s.verifiedBy = actor.name;
    s.verifiedAt = now();
    s.revisionReason = null;
    draft.documents.filter((d) => d.studentId === s.id && d.status === DOC_STATUS.PENDING).forEach((d) => {
      d.status = DOC_STATUS.APPROVED;
      d.remarks = remarks;
    });
    if (!s.defaultResumeId) {
      const r = draft.documents.find((d) => d.studentId === s.id && d.type === 'RESUME');
      if (r) {
        r.isDefault = true;
        s.defaultResumeId = r.id;
      }
    }
    notify(draft, s.id, `Your profile was verified by ${actor.name} and is now locked. You can apply to eligible drives.`, '/student/profile');
    log('Profile', 'PROFILE_VERIFIED', `${s.roll} (${s.name}) verified${remarks ? ` — ${remarks}` : ''}.`);
    log('Profile', 'PROFILE_LOCKED', `${s.roll} academic record auto-locked after verification.`);
  });
}

export function requestRevision(actor, studentId, reason, docIds = []) {
  return commit(actor, (draft, log) => {
    if (!reason?.trim()) fail('A reason is required to request a revision.');
    const s = find(draft.students, studentId, 'Student');
    s.verification = VERIFICATION.REVISION;
    s.locked = false;
    s.revisionReason = reason.trim();
    const flagged = docIds.length
      ? draft.documents.filter((d) => docIds.includes(d.id))
      : draft.documents.filter((d) => d.studentId === s.id && DOC_TYPES[d.type]?.academic && d.status === DOC_STATUS.PENDING);
    flagged.forEach((d) => {
      d.status = DOC_STATUS.REVISION;
      d.remarks = reason.trim();
    });
    notify(draft, s.id, `Revision requested on your Profile Audit: ${reason.trim()}`, '/student/profile');
    log('Profile', 'REVISION_REQUESTED', `${s.roll} (${s.name}): ${reason.trim()}`);
  });
}

export function rejectProfile(actor, studentId, reason) {
  return commit(actor, (draft, log) => {
    if (!reason?.trim()) fail('A reason is required to reject a profile.');
    const s = find(draft.students, studentId, 'Student');
    s.verification = VERIFICATION.REJECTED;
    s.locked = false;
    s.revisionReason = reason.trim();
    draft.documents.filter((d) => d.studentId === s.id && d.status === DOC_STATUS.PENDING).forEach((d) => {
      d.status = DOC_STATUS.REJECTED;
      d.remarks = reason.trim();
    });
    notify(draft, s.id, `Your profile submission was rejected: ${reason.trim()}`, '/student/profile');
    log('Profile', 'PROFILE_REJECTED', `${s.roll} (${s.name}) rejected: ${reason.trim()}`);
  });
}

/** Approve or reject a single document (used for resumes added after verification). */
export function reviewDocument(actor, docId, status, remarks = '') {
  return commit(actor, (draft, log) => {
    const doc = find(draft.documents, docId, 'Document');
    if (status !== DOC_STATUS.APPROVED && !remarks.trim()) fail('Add a remark explaining the decision.');
    const s = find(draft.students, doc.studentId, 'Student');
    doc.status = status;
    doc.remarks = remarks;
    notify(draft, s.id, `${doc.label || DOC_TYPES[doc.type].label} (${doc.fileName}) was ${status.toLowerCase()}.`, '/student/documents');
    log('Document', status === DOC_STATUS.APPROVED ? 'DOCUMENT_APPROVED' : 'DOCUMENT_REJECTED', `${s.roll}: ${doc.fileName} ${status.toLowerCase()}${remarks ? ` — ${remarks}` : ''}.`);
  });
}

// ---------------------------------------------------------------------------
// Correction / unfreeze tickets
// ---------------------------------------------------------------------------

export function createTicket(actor, studentId, { type, field, fieldLabel, currentValue, requestedValue, justification }) {
  return commit(actor, (draft, log) => {
    const s = find(draft.students, studentId, 'Student');
    if (!justification || justification.trim().length < 20) fail('Justification must be at least 20 characters.');
    if (draft.tickets.some((t) => t.studentId === studentId && t.status === 'OPEN')) fail('You already have an open ticket. Wait for it to be resolved.');
    const ticket = {
      id: uid('t'),
      studentId,
      type,
      field,
      fieldLabel,
      currentValue: String(currentValue ?? ''),
      requestedValue: String(requestedValue ?? ''),
      justification: justification.trim(),
      status: 'OPEN',
      createdAt: now(),
      resolvedAt: null,
      resolvedBy: null,
      resolution: '',
    };
    draft.tickets.push(ticket);
    log('Ticket', type === 'UNFREEZE' ? 'UNFREEZE_REQUESTED' : 'CORRECTION_REQUESTED',
      `${s.roll} requested ${type === 'UNFREEZE' ? 'profile unfreeze' : 'a correction'} (${fieldLabel}).`);
    return ticket;
  });
}

/** Approving a ticket unlocks the profile so the student can correct it and resubmit for verification. */
export function resolveTicket(actor, ticketId, decision, resolution) {
  return commit(actor, (draft, log) => {
    const t = find(draft.tickets, ticketId, 'Ticket');
    if (t.status !== 'OPEN') fail('Ticket is already resolved.');
    if (!resolution?.trim()) fail('Add a resolution note.');
    const s = find(draft.students, t.studentId, 'Student');
    t.status = decision;
    t.resolvedAt = now();
    t.resolvedBy = actor.name;
    t.resolution = resolution.trim();
    if (decision === 'APPROVED') {
      s.locked = false;
      s.verification = VERIFICATION.REVISION;
      s.revisionReason = `Unfrozen for correction of ${t.fieldLabel}: ${resolution.trim()}`;
      notify(draft, s.id, `Your ticket was approved. Your profile is unlocked — update ${t.fieldLabel} and resubmit.`, '/student/profile');
      log('Ticket', 'TICKET_APPROVED', `Ticket for ${s.roll} (${t.fieldLabel}) approved; profile unfrozen.`);
      log('Profile', 'PROFILE_UNLOCKED', `${s.roll} academic record unlocked for correction.`);
    } else {
      notify(draft, s.id, `Your ticket for ${t.fieldLabel} was rejected: ${resolution.trim()}`, '/student/profile');
      log('Ticket', 'TICKET_REJECTED', `Ticket for ${s.roll} (${t.fieldLabel}) rejected.`);
    }
  });
}

// ---------------------------------------------------------------------------
// Companies & drives
// ---------------------------------------------------------------------------

export function saveCompany(actor, data) {
  return commit(actor, (draft, log) => {
    const name = data.name?.trim();
    if (!name) fail('Company name is required.');
    const dup = draft.companies.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== data.id);
    if (dup) fail('A company with this name already exists.');
    if (data.id) {
      const c = find(draft.companies, data.id, 'Company');
      const prevSpoc = c.spocId;
      Object.assign(c, { ...data, name });
      log('Company', 'COMPANY_UPDATED', `${name} details updated.`);
      if (prevSpoc !== c.spocId) {
        const spoc = draft.adminUsers.find((u) => u.id === c.spocId);
        log('Company', 'SPOC_ASSIGNED', `${name} assigned to SPOC ${spoc?.name || '—'}.`);
      }
      return c;
    }
    const c = {
      id: uid('c'),
      status: 'APPROVED',
      active: true,
      approvedAt: now(),
      ...data,
      name,
    };
    draft.companies.push(c);
    log('Company', 'COMPANY_APPROVED', `${name} approved and added to the season.`);
    if (c.spocId) {
      const spoc = draft.adminUsers.find((u) => u.id === c.spocId);
      log('Company', 'SPOC_ASSIGNED', `${name} assigned to SPOC ${spoc?.name}.`);
    }
    return c;
  });
}

export function approveCompany(actor, companyId) {
  return commit(actor, (draft, log) => {
    const c = find(draft.companies, companyId, 'Company');
    c.status = 'APPROVED';
    c.approvedAt = now();
    log('Company', 'COMPANY_APPROVED', `${c.name} approved by CCPC.`);
  });
}

export function assignSpoc(actor, companyId, spocId) {
  return commit(actor, (draft, log) => {
    const c = find(draft.companies, companyId, 'Company');
    const spoc = find(draft.adminUsers, spocId, 'SPOC');
    c.spocId = spocId;
    log('Company', 'SPOC_ASSIGNED', `${c.name} assigned to SPOC ${spoc.name}.`);
  });
}

export function setCompanyActive(actor, companyId, active) {
  return commit(actor, (draft, log) => {
    const c = find(draft.companies, companyId, 'Company');
    c.active = active;
    if (!active) {
      draft.drives.filter((d) => d.companyId === c.id && d.status === DRIVE_STATUS.OPEN).forEach((d) => {
        d.status = DRIVE_STATUS.FROZEN;
      });
    }
    log('Company', active ? 'COMPANY_REACTIVATED' : 'COMPANY_DEACTIVATED', `${c.name} ${active ? 'reactivated' : 'deactivated; open drives frozen'}.`);
  });
}

export function saveDrive(actor, data) {
  return commit(actor, (draft, log) => {
    const company = find(draft.companies, data.companyId, 'Company');
    if (!data.role?.trim()) fail('Role title is required.');
    if (!(Number(data.ctc) > 0)) fail('CTC must be greater than zero.');
    if (!data.deadline || Number.isNaN(new Date(data.deadline).getTime())) fail('A valid deadline is required.');
    if (actor.role === 'SPOC' && company.spocId !== actor.id) fail('You can only manage drives for companies assigned to you.');
    if (company.status !== 'APPROVED') fail('Company must be approved before a drive can be published.');
    const isNew = !data.id;
    if (data.status === DRIVE_STATUS.OPEN && new Date(data.deadline).getTime() <= Date.now()) fail('An open drive needs a deadline in the future.');
    if (isNew) {
      const d = { ...data, id: uid('d'), createdBy: actor.name, createdAt: now() };
      draft.drives.push(d);
      log('Drive', 'DRIVE_CREATED', `${company.name} — ${d.role} ${d.status === 'DRAFT' ? 'saved as draft' : 'published'} (${formatCtc(d.ctc)}, closes ${formatDateTime(d.deadline)}).`);
      if (d.status === DRIVE_STATUS.OPEN) {
        draft.students.forEach((s) => notify(draft, s.id, `New drive: ${company.name} — ${d.role} (${formatCtc(d.ctc)}).`, `/student/opportunities/${d.id}`));
      }
      return d;
    }
    const d = find(draft.drives, data.id, 'Drive');
    Object.assign(d, data);
    log('Drive', 'DRIVE_UPDATED', `${company.name} — ${d.role} updated.`);
    return d;
  });
}

export function setDriveStatus(actor, driveId, status) {
  return commit(actor, (draft, log) => {
    const d = find(draft.drives, driveId, 'Drive');
    if (status === DRIVE_STATUS.OPEN && new Date(d.deadline).getTime() <= Date.now()) fail('Extend the deadline before reopening this drive.');
    const company = companyOf(draft, d);
    if (status === DRIVE_STATUS.OPEN && company && !company.active) fail('Reactivate the company before opening its drive.');
    d.status = status;
    log('Drive', `DRIVE_${status}`, `${driveName(draft, d)} status set to ${status}.`);
  });
}

export function extendDeadline(actor, driveId, newDeadline, reason) {
  return commit(actor, (draft, log) => {
    if (actor.role !== 'CCPC') fail('Only CCPC can extend deadlines.');
    const d = find(draft.drives, driveId, 'Drive');
    const next = new Date(newDeadline).getTime();
    if (Number.isNaN(next)) fail('Choose a valid date and time.');
    if (next <= Date.now()) fail('New deadline must be in the future.');
    if (next <= new Date(d.deadline).getTime()) fail('New deadline must be later than the current deadline.');
    if (!reason?.trim()) fail('A reason is required — it is written to the audit log.');
    const prev = d.deadline;
    d.deadline = new Date(next).toISOString();
    if (d.status === DRIVE_STATUS.CLOSED) d.status = DRIVE_STATUS.OPEN;
    const name = driveName(draft, d);
    draft.students.forEach((s) => notify(draft, s.id, `Deadline extended: ${name} now closes ${formatDateTime(d.deadline)}.`, `/student/opportunities/${d.id}`));
    log('Drive', 'DEADLINE_EXTENDED', `${name}: ${formatDateTime(prev)} → ${formatDateTime(d.deadline)}. Reason: ${reason.trim()}`);
  });
}

export function logExport(actor, entity, description) {
  return commit(actor, (draft, log) => {
    log(entity, 'ROSTER_EXPORTED', description);
  });
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export function addInvitees(actor, rows) {
  return commit(actor, (draft, log) => {
    const added = [];
    rows.forEach((r) => {
      const entryNo = r.entryNo.toUpperCase();
      if (draft.invitations.some((i) => i.entryNo === entryNo)) return;
      added.push(entryNo);
      draft.invitations.push({
        id: uid('inv'),
        entryNo,
        name: r.name,
        email: r.email || `${entryNo.toLowerCase()}@placematrix.edu`,
        branch: r.branch,
        degree: r.degree || 'B.Tech',
        feePaid: true,
        status: 'NOT_INVITED',
        updatedAt: null,
        studentId: null,
      });
    });
    if (!added.length) fail('All entries already exist in the onboarding list.');
    log('Invitation', 'FEE_LIST_IMPORTED', `${added.length} fee-paid student(s) added from the Academic Section list.`);
    return added;
  });
}

export function sendInvitations(actor, inviteIds) {
  return commit(actor, (draft, log) => {
    const sent = [];
    inviteIds.forEach((id) => {
      const inv = find(draft.invitations, id, 'Invitation');
      if (inv.status === 'REGISTERED') return;
      inv.status = 'INVITED';
      inv.updatedAt = now();
      sent.push(inv.entryNo);
    });
    if (!sent.length) fail('No invitable students selected.');
    log('Invitation', 'INVITATION_SENT', sent.length === 1 ? `Invitation sent to ${sent[0]}.` : `Bulk onboarding invitation sent to ${sent.length} fee-paid student(s).`);
    return sent;
  });
}

export function acceptInvitation(inviteId) {
  return commit(null, (draft, log) => {
    const inv = find(draft.invitations, inviteId, 'Invitation');
    if (inv.status !== 'INVITED') fail('This invitation is no longer active.');
    const match = inv.entryNo.match(/^(\d{4})[A-Z]{2}([BM])/);
    const student = {
      id: uid('s'),
      roll: inv.entryNo,
      name: inv.name,
      email: inv.email,
      phone: '',
      degree: match?.[2] === 'M' ? 'M.Tech' : 'B.Tech',
      branch: inv.branch,
      gradYear: 2026,
      cgpa: '',
      semCgpa: [],
      class10: '',
      class12: '',
      backlogs: 0,
      skills: [],
      verification: VERIFICATION.NOT_SUBMITTED,
      locked: false,
      verifiedBy: null,
      verifiedAt: null,
      submittedAt: null,
      revisionReason: null,
      placement: 'UNPLACED',
      placedCompany: null,
      proof: {},
      defaultResumeId: null,
      createdAt: now(),
    };
    draft.students.push(student);
    inv.status = 'REGISTERED';
    inv.updatedAt = now();
    inv.studentId = student.id;
    log('Invitation', 'INVITATION_ACCEPTED', `${inv.entryNo} (${inv.name}) accepted the invitation and created a profile.`);
    return student;
  });
}

export function declineInvitation(inviteId) {
  return commit(null, (draft, log) => {
    const inv = find(draft.invitations, inviteId, 'Invitation');
    inv.status = 'DECLINED';
    inv.updatedAt = now();
    log('Invitation', 'INVITATION_DECLINED', `${inv.entryNo} (${inv.name}) declined the placement invitation.`);
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function markNotificationsRead(userId) {
  // Not audited — a per-user UI convenience.
  const draft = structuredClone(state);
  draft.notifications.forEach((n) => {
    if (n.userId === userId) n.read = true;
  });
  state = draft;
  persist(state);
  emit();
}
