// Pure profile rules used for instant UI feedback. The backend applies the same rules (app/rules.py)
// and is the authority — these only decide what the UI shows.

import { DOC_STATUS, DOC_TYPES } from '../constants';

/** Fields and documents still missing before a profile can be submitted for verification. */
export function missingForSubmission(db, s) {
  const missing = [];
  ['cgpa', 'class10', 'class12', 'branch', 'degree'].forEach((f) => {
    if (s[f] === null || s[f] === undefined || s[f] === '') missing.push(f);
  });
  const docs = db.documents.filter((d) => d.studentId === s.id);
  ['GRADE_CARD', 'CLASS10', 'CLASS12', 'RESUME'].forEach((t) => {
    if (!docs.some((d) => d.type === t && d.status !== DOC_STATUS.REJECTED)) missing.push(DOC_TYPES[t].label);
  });
  return missing;
}

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
