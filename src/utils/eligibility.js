import { VERIFICATION, PLACEMENT, DRIVE_STATUS } from '../constants';
import { formatCgpa } from './format';

/**
 * Evaluate a student against a drive's criteria.
 * Returns { eligible, reasons: [{ rule, message }], checks: [{ rule, label, pass }] }.
 * Every rule is computed from the student record and the drive's criteria — nothing is hardcoded per card.
 */
export function evaluateEligibility(student, drive) {
  const c = drive?.criteria || {};
  const checks = [];
  const add = (rule, label, pass, message) => checks.push({ rule, label, pass, message });

  if (!student) return { eligible: false, reasons: [{ rule: 'profile', message: 'No student profile' }], checks };

  if (c.minCgpa !== undefined && c.minCgpa !== null && c.minCgpa !== '') {
    const ok = Number(student.cgpa) >= Number(c.minCgpa);
    add('cgpa', `Min CGPA ${formatCgpa(c.minCgpa)}`, ok,
      `Minimum CGPA: ${formatCgpa(c.minCgpa)}; your CGPA: ${formatCgpa(student.cgpa)}`);
  }

  if (c.branches?.length) {
    const ok = c.branches.includes(student.branch);
    add('branch', `Branches: ${c.branches.join(' / ')}`, ok,
      `Branch not allowed — requires ${c.branches.join(' / ')}; your branch: ${student.branch || '—'}`);
  }

  if (c.maxBacklogs !== undefined && c.maxBacklogs !== null && c.maxBacklogs !== '') {
    const ok = Number(student.backlogs || 0) <= Number(c.maxBacklogs);
    const label = Number(c.maxBacklogs) === 0 ? 'No active backlogs' : `≤ ${c.maxBacklogs} backlog${c.maxBacklogs > 1 ? 's' : ''}`;
    add('backlogs', label, ok,
      `Maximum active backlogs: ${c.maxBacklogs}; you have: ${student.backlogs || 0}`);
  }

  if (c.gradYears?.length) {
    const ok = c.gradYears.includes(Number(student.gradYear));
    add('gradYear', `Batch ${c.gradYears.join(' / ')}`, ok,
      `Graduation year must be ${c.gradYears.join(' / ')}; yours: ${student.gradYear || '—'}`);
  }

  if (c.degrees?.length) {
    const ok = c.degrees.includes(student.degree);
    add('degree', `${c.degrees.join(' / ')} only`, ok,
      `Degree requirement: ${c.degrees.join(' / ')}; your degree: ${student.degree || '—'}`);
  }

  if (c.skills?.length) {
    const have = (student.skills || []).map((s) => s.toLowerCase());
    const missing = c.skills.filter((s) => !have.includes(s.toLowerCase()));
    add('skills', `Skills: ${c.skills.join(', ')}`, missing.length === 0,
      `Missing required skill${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
  }

  // Institutional policy rules.
  add('verified', 'Verified profile', student.verification === VERIFICATION.VERIFIED,
    'Profile not yet verified — complete your Profile Audit to apply');
  add('placement', 'One-offer policy', student.placement !== PLACEMENT.PLACED,
    `Already placed${student.placedCompany ? ` at ${student.placedCompany}` : ''} (one-offer policy)`);

  const reasons = checks.filter((x) => !x.pass).map(({ rule, message }) => ({ rule, message }));
  return { eligible: reasons.length === 0, reasons, checks };
}

/** Can a student apply right now? Wraps eligibility with drive state, deadline and duplicates. */
export function canApply(student, drive, applications = [], now = Date.now()) {
  const elig = evaluateEligibility(student, drive);
  const existing = applications.find((a) => a.studentId === student?.id && a.driveId === drive.id && a.stage !== 'WITHDRAWN');
  if (existing) return { ok: false, reason: 'You have already applied to this drive', elig, existing };
  if (drive.status !== DRIVE_STATUS.OPEN) return { ok: false, reason: `Drive is ${drive.status.toLowerCase()}`, elig };
  if (new Date(drive.deadline).getTime() <= now) return { ok: false, reason: 'Application deadline has passed', elig };
  if (!elig.eligible) return { ok: false, reason: elig.reasons[0].message, elig };
  return { ok: true, elig };
}

/** Short chip labels describing a drive's criteria (used on cards). */
export function criteriaChips(drive) {
  const c = drive.criteria || {};
  const chips = [];
  if (drive.location) chips.push(drive.location);
  if (c.branches?.length) chips.push(c.branches.join(' / '));
  if (c.minCgpa) chips.push(`Min CGPA ${formatCgpa(c.minCgpa)}`);
  if (c.maxBacklogs !== undefined && c.maxBacklogs !== '') chips.push(Number(c.maxBacklogs) === 0 ? 'No active backlogs' : `≤ ${c.maxBacklogs} backlog`);
  if (c.degrees?.length) chips.push(`${c.degrees.join('/')} only`);
  if (c.gradYears?.length) chips.push(`Batch ${c.gradYears.join('/')}`);
  return chips;
}
