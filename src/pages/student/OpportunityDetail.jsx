import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Building2, Globe, MapPin, Zap, CheckCircle2, Lock, Mail, CalendarClock } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import ErrorState from '../../components/common/ErrorState';
import Countdown from '../../components/common/Countdown';
import EligibilityChecklist from '../../components/student/EligibilityChecklist';
import { useApply } from '../../components/student/useApply';
import { useStudentData } from '../../hooks/useStudentData';
import { useNow } from '../../hooks/useNow';
import { canApply } from '../../utils/eligibility';
import { formatCtc } from '../../utils/format';
import { formatFull } from '../../utils/dateUtils';
import { useData } from '../../context/DataContext';
import { STAGE_LABELS } from '../../constants';

export default function OpportunityDetail() {
  const { id } = useParams();
  const { student, drives, resumes } = useStudentData();
  const { db } = useData();
  const apply = useApply();
  const now = useNow(30000);
  const drive = drives.find((d) => d.id === id);
  const approved = resumes.filter((r) => r.status === 'APPROVED');
  const [resumeId, setResumeId] = useState(student.defaultResumeId || approved[0]?.id || '');

  if (!drive) {
    return <ErrorState title="Opportunity not found" description="This drive does not exist or is not visible to students." backTo="/student/opportunities" backLabel="Back to Opportunities" />;
  }

  const check = canApply(student, drive, db.applications, now);
  const c = drive.criteria;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Opportunities', to: '/student/opportunities' }, { label: `${drive.company.name} — ${drive.role}` }]}
        title={drive.role}
        description={`${drive.company.name} · ${drive.category} · ${drive.location}`}
        actions={<StatusBadge status={drive.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card card-pad">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><p className="eyebrow">Package (CTC)</p><p className="mt-1 text-2xl font-bold">{formatCtc(drive.ctc)}</p></div>
              <div><p className="eyebrow">Deadline</p><p className="mt-1 text-sm font-semibold">{formatFull(drive.deadline)}</p><Countdown to={drive.deadline} className="text-xs text-ink-muted" /></div>
              <div><p className="eyebrow">Location</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold"><MapPin className="h-3.5 w-3.5 text-ink-muted" />{drive.location}</p></div>
            </div>
            <h2 className="mt-5 card-title">About the role</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{drive.description}</p>
            <h2 className="mt-5 card-title">Eligibility criteria</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between border-b border-line py-1.5"><dt className="text-ink-muted">Minimum CGPA</dt><dd className="font-medium">{c.minCgpa ? Number(c.minCgpa).toFixed(2) : 'None'}</dd></div>
              <div className="flex justify-between border-b border-line py-1.5"><dt className="text-ink-muted">Branches</dt><dd className="font-medium">{c.branches?.length ? c.branches.join(', ') : 'All branches'}</dd></div>
              <div className="flex justify-between border-b border-line py-1.5"><dt className="text-ink-muted">Max active backlogs</dt><dd className="font-medium">{c.maxBacklogs ?? 'No limit'}</dd></div>
              <div className="flex justify-between border-b border-line py-1.5"><dt className="text-ink-muted">Graduation year</dt><dd className="font-medium">{c.gradYears?.join(', ') || 'Any'}</dd></div>
              <div className="flex justify-between border-b border-line py-1.5"><dt className="text-ink-muted">Degree</dt><dd className="font-medium">{c.degrees?.length ? c.degrees.join(', ') : 'Any'}</dd></div>
              <div className="flex justify-between border-b border-line py-1.5"><dt className="text-ink-muted">Required skills</dt><dd className="font-medium">{c.skills?.length ? c.skills.join(', ') : 'None'}</dd></div>
            </dl>
          </section>

          <section className="card card-pad">
            <h2 className="card-title flex items-center gap-2"><Building2 className="h-4 w-4 text-ink-muted" /> {drive.company.name}</h2>
            <p className="mt-1.5 text-sm text-ink-soft">{drive.company.description}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-muted">
              <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{drive.company.website.replace(/^https?:\/\//, '')}</span>
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />Queries via your placement SPOC</span>
              <span>{drive.company.industry}</span>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card card-pad">
            <div className="flex items-center justify-between">
              <h2 className="card-title">Your eligibility</h2>
              <StatusBadge status={drive.eligibility.eligible ? 'ELIGIBLE' : 'INELIGIBLE'} icon />
            </div>
            <div className="mt-3"><EligibilityChecklist checks={drive.eligibility.checks} /></div>
          </section>

          <section className="card card-pad">
            {drive.application ? (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> You applied on {formatFull(drive.application.appliedAt)}</p>
                <p className="mt-1 text-xs text-ink-muted">Current stage: <strong className="text-ink">{STAGE_LABELS[drive.application.stage]}</strong></p>
                <Link to="/student/applications" className="btn btn-secondary mt-3 w-full">View my applications</Link>
              </>
            ) : check.ok ? (
              <>
                <label htmlFor="detail-resume" className="label">Resume to submit</label>
                <select id="detail-resume" className="input" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                  {approved.map((r) => <option key={r.id} value={r.id}>{r.label || r.fileName}{r.id === student.defaultResumeId ? ' (default)' : ''}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-ink-muted">Only verified resumes can be attached.</p>
                <button type="button" className="btn btn-primary mt-3 w-full" disabled={!resumeId} onClick={() => apply(drive.id, resumeId)}>
                  <Zap className="h-4 w-4" /> 1-Click Apply
                </button>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Lock className="h-4 w-4 text-ink-muted" /> Apply unavailable</p>
                <p className="mt-1 text-xs text-danger">{check.reason}</p>
              </>
            )}
            <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-[11px] text-ink-muted">
              <CalendarClock className="h-3.5 w-3.5" /> Applications freeze automatically when the deadline is reached.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
