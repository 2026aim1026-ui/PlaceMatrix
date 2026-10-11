import { ROLL_REGEX, STAGE_ORDER, TERMINAL_STAGES, STAGE_LABELS } from '../constants';

/**
 * Parse free text pasted from a recruiter email into roll numbers and classify every token.
 * Tokens are split on commas, whitespace, semicolons and newlines.
 *
 * Result rows have a `status` of:
 *   READY        valid applicant whose stage can move to `targetStage`
 *   SKIPPED      valid applicant but the transition is not allowed (already there, terminal, backwards)
 *   NOT_APPLICANT valid roll number that did not apply to this drive (or unknown student)
 *   DUPLICATE    repeated roll number
 *   INVALID      token that does not match the roll-number format
 */
export function parseRollNumbers(text, { applications, students, targetStage }) {
  const tokens = (text || '')
    .split(/[\s,;|]+/)
    .map((t) => t.trim().replace(/^[("'[]+|[)"'\].]+$/g, ''))
    .filter(Boolean);

  const seen = new Set();
  const rows = [];
  const studentByRoll = new Map(students.map((s) => [s.roll.toUpperCase(), s]));

  tokens.forEach((raw, index) => {
    const roll = raw.toUpperCase();
    if (!ROLL_REGEX.test(roll)) {
      rows.push({ index, raw, roll, status: 'INVALID', message: 'Bad format — expected e.g. 2026CSB1028' });
      return;
    }
    if (seen.has(roll)) {
      rows.push({ index, raw, roll, status: 'DUPLICATE', message: 'Duplicate entry — counted once' });
      return;
    }
    seen.add(roll);

    const student = studentByRoll.get(roll);
    const app = student && applications.find((a) => a.studentId === student.id);
    if (!student || !app) {
      rows.push({
        index, raw, roll, student, status: 'NOT_APPLICANT',
        message: student ? `${student.name} has not applied to this drive` : 'Roll number not found in student records',
      });
      return;
    }

    const check = checkTransition(app.stage, targetStage);
    rows.push({
      index, raw, roll, student, application: app,
      status: check.ok ? 'READY' : 'SKIPPED',
      message: check.ok ? `${STAGE_LABELS[app.stage]} → ${STAGE_LABELS[targetStage]}` : check.reason,
    });
  });

  const count = (s) => rows.filter((r) => r.status === s).length;
  return {
    rows,
    stats: {
      total: tokens.length,
      ready: count('READY'),
      skipped: count('SKIPPED'),
      notApplicants: count('NOT_APPLICANT'),
      duplicates: count('DUPLICATE'),
      invalid: count('INVALID'),
      valid: rows.filter((r) => ['READY', 'SKIPPED', 'NOT_APPLICANT'].includes(r.status)).length,
    },
  };
}

/** Forward-only pipeline; REJECTED allowed from any non-terminal stage. */
export function checkTransition(from, to) {
  if (from === to) return { ok: false, reason: `Already ${STAGE_LABELS[from]}` };
  if (TERMINAL_STAGES.includes(from)) return { ok: false, reason: `Locked — application is ${STAGE_LABELS[from]}` };
  if (to === 'REJECTED' || to === 'WITHDRAWN') return { ok: true };
  const fi = STAGE_ORDER.indexOf(from);
  const ti = STAGE_ORDER.indexOf(to);
  if (ti < fi) return { ok: false, reason: `Cannot move back from ${STAGE_LABELS[from]}` };
  return { ok: true };
}
