import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useCurrentUser } from './useCurrentUser';
import { evaluateEligibility } from '../utils/eligibility';
import { DOC_TYPES } from '../constants';

/** Everything the student portal needs about the signed-in student, derived from live data. */
export function useStudentData() {
  const { db, companyById } = useData();
  const me = useCurrentUser();
  const student = me.student;

  return useMemo(() => {
    if (!student) return { student: null };
    const documents = db.documents.filter((d) => d.studentId === student.id);
    const resumes = documents.filter((d) => d.type === 'RESUME');
    const applications = db.applications.filter((a) => a.studentId === student.id);
    const appByDrive = new Map(applications.filter((a) => a.stage !== 'WITHDRAWN').map((a) => [a.driveId, a]));

    // Students never see draft drives.
    const drives = db.drives
      .filter((d) => d.status !== 'DRAFT' && companyById.get(d.companyId)?.status === 'APPROVED')
      .map((d) => ({
        ...d,
        company: companyById.get(d.companyId),
        eligibility: evaluateEligibility(student, d),
        application: appByDrive.get(d.id) || null,
      }));

    const tickets = db.tickets.filter((t) => t.studentId === student.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Profile completion: academic fields, contact, required documents, verification.
    const parts = [
      ['cgpa', 'class10', 'class12', 'branch', 'degree'].every((k) => student[k] !== '' && student[k] !== null && student[k] !== undefined),
      Boolean(student.phone),
      ['GRADE_CARD', 'CLASS10', 'CLASS12'].every((t) => documents.some((d) => d.type === t)),
      resumes.length > 0,
      student.verification === 'VERIFIED',
    ];
    const completion = Math.round((parts.filter(Boolean).length / parts.length) * 100);

    const requiredDocs = Object.entries(DOC_TYPES).filter(([, m]) => m.required).map(([t]) => t);
    const missingDocs = requiredDocs.filter((t) => !documents.some((d) => d.type === t));

    return { student, documents, resumes, applications, drives, tickets, completion, missingDocs };
  }, [db, companyById, student]);
}
