import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileText, ArrowLeft, ListChecks, Mail, CalendarClock, Users } from 'lucide-react';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import EligibilityChecklist from '../../components/student/EligibilityChecklist';
import { useData } from '../../context/DataContext';
import { useStudentData } from '../../hooks/useStudentData';
import { evaluateEligibility, criteriaChips } from '../../utils/eligibility';
import { formatCtc } from '../../utils/format';
import { formatFull } from '../../utils/dateUtils';
import { STAGE_LABELS } from '../../constants';

export default function ApplicationConfirmation() {
  const { id } = useParams();
  const { db, driveById, companyById, docById } = useData();
  const { student } = useStudentData();
  const app = db.applications.find((a) => a.id === id && a.studentId === student.id);

  if (!app) {
    return <ErrorState title="Application not found" description="This confirmation link does not match any of your applications." backTo="/student/applications" backLabel="View my applications" />;
  }

  const drive = driveById.get(app.driveId);
  const company = companyById.get(drive.companyId);
  const resume = docById.get(app.resumeId);
  const elig = evaluateEligibility(student, drive);

  return (
    <div className="mx-auto max-w-3xl">
      <section className="card overflow-hidden">
        <div className="flex flex-col items-center border-b border-line bg-gradient-to-b from-success-50 to-white px-6 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-md">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-bold text-ink">Application submitted successfully</h1>
          <p className="mt-1 text-sm text-ink-muted">Your application to <strong className="text-ink">{company.name}</strong> for <strong className="text-ink">{drive.role}</strong> has been recorded.</p>
          <p className="mono mt-2 text-xs text-ink-muted">Reference: {app.id.toUpperCase()}</p>
        </div>

        <dl className="grid gap-x-6 gap-y-4 px-6 py-5 text-sm sm:grid-cols-2">
          <div><dt className="eyebrow">Company</dt><dd className="mt-1 font-semibold">{company.name}</dd></div>
          <div><dt className="eyebrow">Role</dt><dd className="mt-1 font-semibold">{drive.role}</dd></div>
          <div><dt className="eyebrow">CTC / Package</dt><dd className="mt-1 text-lg font-bold">{formatCtc(drive.ctc)}</dd></div>
          <div><dt className="eyebrow">Status</dt><dd className="mt-1 flex items-center gap-2"><StatusBadge status={app.stage} /> <span className="text-xs text-ink-muted">{STAGE_LABELS[app.stage]}</span></dd></div>
          <div><dt className="eyebrow">Application date</dt><dd className="mt-1">{formatFull(app.appliedAt)}</dd></div>
          <div><dt className="eyebrow">Resume submitted</dt><dd className="mono mt-1 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-ink-muted" />{resume?.fileName}</dd></div>
          <div className="sm:col-span-2">
            <dt className="eyebrow">Eligibility criteria</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1">{criteriaChips(drive).map((c) => <span key={c} className="chip">{c}</span>)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="eyebrow mb-1.5">Checked against your verified record</dt>
            <dd><EligibilityChecklist checks={elig.checks} /></dd>
          </div>
        </dl>

        <div className="border-t border-line bg-[#FAFBFE] px-6 py-5">
          <h2 className="card-title">What happens next</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {[
              [CalendarClock, 'Applications freeze at the deadline', `The drive closes on ${formatFull(drive.deadline)}. You can withdraw until then from My Applications.`],
              [Users, 'SPOC shares the roster with the recruiter', 'Your verified profile and selected resume are exported to the company.'],
              [ListChecks, 'Shortlists are published round by round', 'Stage changes (Shortlisted, Assessment, Interview, Offered) appear in My Applications and your notifications.'],
              [Mail, 'Watch your institute email', 'Test links and interview schedules are sent by the recruiter or SPOC.'],
            ].map(([Icon, t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><Icon className="h-3.5 w-3.5" /></span>
                <span><span className="block font-medium text-ink">{t}</span><span className="block text-xs text-ink-muted">{d}</span></span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
          <Link to="/student/opportunities" className="btn btn-secondary"><ArrowLeft className="h-4 w-4" /> Back to Opportunities</Link>
          <Link to="/student/applications" className="btn btn-primary">View My Applications</Link>
        </div>
      </section>
    </div>
  );
}
