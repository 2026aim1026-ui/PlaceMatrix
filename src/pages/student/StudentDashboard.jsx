import { Link } from 'react-router-dom';
import { Briefcase, CheckSquare, FileText, Star, ShieldAlert, ArrowRight, UserCheck, FolderOpen, Search, Circle, Activity } from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import ProgressRing from '../../components/common/ProgressRing';
import Countdown from '../../components/common/Countdown';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import { useStudentData } from '../../hooks/useStudentData';
import { useNow } from '../../hooks/useNow';
import { useData } from '../../context/DataContext';
import { greeting, formatDateTime, timeAgo } from '../../utils/dateUtils';
import { formatCgpa, formatCtc } from '../../utils/format';
import { STAGE_LABELS } from '../../constants';

export default function StudentDashboard() {
  const { student, drives, applications, documents, completion, missingDocs } = useStudentData();
  const { db, driveById, companyById, docById } = useData();
  const now = useNow(60000);

  const openDrives = drives.filter((d) => d.status === 'OPEN' && new Date(d.deadline).getTime() > now);
  const eligibleOpen = openDrives.filter((d) => d.eligibility.eligible);
  const activeApps = applications.filter((a) => a.stage !== 'WITHDRAWN');
  const shortlisted = applications.filter((a) => ['SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFERED'].includes(a.stage));
  const pendingDocs = documents.filter((d) => d.status === 'PENDING' || d.status === 'REVISION');
  const upcoming = [...openDrives].sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 4);
  const nextEligible = upcoming.find((d) => d.eligibility.eligible && !d.application) || upcoming[0];
  const defaultResume = docById.get(student.defaultResumeId);

  // Recent activity: this student's application history + notifications.
  const activity = [
    ...applications.flatMap((a) => a.history.map((h) => {
      const d = driveById.get(a.driveId);
      return { at: h.at, text: `${companyById.get(d?.companyId)?.name} — ${d?.role}: ${STAGE_LABELS[h.stage]}`, stage: h.stage };
    })),
    ...db.notifications.filter((n) => n.userId === student.id).map((n) => ({ at: n.at, text: n.message })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  const steps = ['Profile Audit', 'Academic Documents', 'Resume', 'Faculty Verified'];
  const stepDone = [
    completion >= 40,
    !missingDocs.some((t) => ['GRADE_CARD', 'CLASS10', 'CLASS12'].includes(t)),
    !missingDocs.includes('RESUME'),
    student.verification === 'VERIFIED',
  ];

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="flex flex-col gap-4 rounded-xl bg-gradient-to-r from-navy to-navy-600 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">{greeting()}, {student.name.split(' ')[0]} <span aria-hidden>👋</span></h1>
          <p className="mt-1 text-[13px] text-white/65">Here&apos;s your placement journey at a glance.</p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-white/75">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-1">{stepDone[i] ? '✓' : '○'} {s}</li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing value={completion} />
          <p className="text-[11px] text-white/60">Profile<br />completion</p>
        </div>
      </section>

      {/* Profile summary */}
      <section className="card card-pad">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={student.name} size="lg" />
            <div>
              <p className="font-semibold text-ink">{student.name}</p>
              <p className="text-xs text-ink-muted">{student.degree} · {student.branch} · {student.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={student.verification} label={student.verification === 'VERIFIED' && student.locked ? 'Verified, locked' : undefined} icon />
            <StatusBadge status={student.placement} label={student.placedCompany ? `Placed · ${student.placedCompany}` : undefined} />
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          {[
            ['Roll number', <span key="r" className="mono font-semibold">{student.roll}</span>],
            ['CGPA', formatCgpa(student.cgpa)],
            ['Active backlogs', student.backlogs ?? '—'],
            ['Branch', student.branch],
            ['10th %', student.class10 !== '' ? Number(student.class10).toFixed(2) : '—'],
            ['12th %', student.class12 !== '' ? Number(student.class12).toFixed(2) : '—'],
            ['Verified by', student.verifiedBy || '—'],
            ['Default resume', <span key="d" className="mono text-xs">{defaultResume?.fileName || '—'}</span>],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] text-ink-muted">{k}</dt>
              <dd className="mt-0.5 truncate font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Briefcase} label="Open drives" value={openDrives.length} tone="amber" to="/student/opportunities" />
        <StatCard icon={CheckSquare} label="Eligible for" value={eligibleOpen.length} tone="green" to="/student/opportunities" />
        <StatCard icon={FileText} label="My applications" value={activeApps.length} tone="blue" to="/student/applications" />
        <StatCard icon={Star} label="Shortlisted +" value={shortlisted.length} tone="violet" to="/student/applications" />
        <StatCard icon={ShieldAlert} label="Docs pending review" value={pendingDocs.length} tone={pendingDocs.length ? 'red' : 'gray'} to="/student/documents" />
        <StatCard icon={Briefcase} label="Total opportunities" value={drives.length} tone="gray" to="/student/opportunities" />
      </section>

      {student.verification !== 'VERIFIED' && (
        <section className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-800">
            <strong>Your profile is not verified yet.</strong>{' '}
            {student.verification === 'PENDING' ? 'A faculty verifier is reviewing your documents.' : student.verification === 'REVISION' ? `Revision requested: ${student.revisionReason}` : 'Complete your Profile Audit and submit it for verification to start applying.'}
          </p>
          <Link to="/student/profile" className="btn btn-sm btn-primary shrink-0">Open Profile Audit</Link>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming deadlines */}
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="card-title">Upcoming deadlines</h2>
            <Link to="/student/opportunities" className="text-xs font-semibold text-brand hover:underline">All opportunities</Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState compact title="No open drives right now" description="New drives will appear here as soon as they are published." />
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((d) => (
                <li key={d.id}>
                  <Link to={`/student/opportunities/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas/60">
                    <Circle className={`h-3 w-3 shrink-0 ${d.eligibility.eligible ? 'fill-success/20 text-success' : 'text-ink-muted'}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{d.company.name} — {d.role}</p>
                      <p className="text-[11.5px] text-ink-muted">Closes {formatDateTime(d.deadline)} · {formatCtc(d.ctc)}</p>
                    </div>
                    <Countdown to={d.deadline} className="hidden text-xs text-ink-soft sm:inline" />
                    {d.application ? <StatusBadge status="APPLIED" /> : <StatusBadge status={d.eligibility.eligible ? 'ELIGIBLE' : 'INELIGIBLE'} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Countdown */}
        <section className="flex flex-col justify-between rounded-xl bg-navy p-5 text-center text-white">
          {nextEligible ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">Application window · {nextEligible.company.name}</p>
              <Countdown to={nextEligible.deadline} className="my-4 block text-3xl font-bold !text-white" />
              <p className="text-[11.5px] text-white/60">{nextEligible.role} · applications freeze automatically when the deadline is reached.</p>
              <Link to={`/student/opportunities/${nextEligible.id}`} className="btn btn-sm mx-auto mt-4 bg-white text-navy hover:bg-white/90">Open opportunity</Link>
            </>
          ) : (
            <p className="py-10 text-sm text-white/60">No upcoming deadlines.</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="card-title flex items-center gap-2"><Activity className="h-4 w-4 text-ink-muted" /> Recent activity</h2>
            <Link to="/student/applications" className="text-xs font-semibold text-brand hover:underline">My applications</Link>
          </div>
          {activity.length === 0 ? (
            <EmptyState compact title="No activity yet" description="Your application updates will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <p className="flex-1 text-[13px] text-ink">{a.text}</p>
                  <span className="shrink-0 text-[11px] text-ink-muted">{timeAgo(a.at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Quick actions */}
        <section className="card card-pad">
          <h2 className="card-title">Quick actions</h2>
          <div className="mt-3 space-y-2">
            {[
              { to: '/student/profile', icon: UserCheck, label: student.locked ? 'View verified profile' : 'Complete profile', hint: `${completion}% complete` },
              { to: '/student/documents', icon: FolderOpen, label: 'Review documents', hint: `${documents.length} files · ${pendingDocs.length} pending` },
              { to: '/student/opportunities', icon: Search, label: 'Explore jobs', hint: `${eligibleOpen.filter((d) => !d.application).length} eligible, not applied` },
            ].map(({ to, icon: Icon, label, hint }) => (
              <Link key={to} to={to} className="flex items-center gap-3 rounded-lg border border-line p-3 hover:border-brand/40 hover:bg-brand-50/40">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand"><Icon className="h-4 w-4" /></span>
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold text-ink">{label}</span>
                  <span className="block text-[11px] text-ink-muted">{hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-ink-muted" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
