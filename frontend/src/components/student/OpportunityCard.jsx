import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Lock, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import Countdown from '../common/Countdown';
import { formatCtc } from '../../utils/format';
import { formatDateTime } from '../../utils/dateUtils';
import { criteriaChips } from '../../utils/eligibility';
import { STAGE_LABELS } from '../../constants';

/**
 * Drive card for the student feed. Eligible + open drives allow a 1-click apply with the chosen resume;
 * ineligible drives show the first failed rule and a "Why?" link.
 */
export default function OpportunityCard({ drive, resumes, defaultResumeId, onApply, onWhy, now }) {
  const approved = resumes.filter((r) => r.status === 'APPROVED');
  const [resumeId, setResumeId] = useState(defaultResumeId && approved.some((r) => r.id === defaultResumeId) ? defaultResumeId : approved[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const { eligibility: elig, application: app } = drive;
  const closed = new Date(drive.deadline).getTime() <= now || drive.status === 'CLOSED';
  const frozen = drive.status === 'FROZEN';

  let badge;
  if (app) badge = <StatusBadge status="APPLIED" label={app.stage === 'APPLIED' ? 'Applied' : STAGE_LABELS[app.stage]} tone={app.stage === 'REJECTED' ? 'red' : 'blue'} />;
  else if (frozen) badge = <StatusBadge status="FROZEN" />;
  else if (closed) badge = <StatusBadge status="CLOSED" />;
  else badge = <StatusBadge status={elig.eligible ? 'ELIGIBLE' : 'INELIGIBLE'} icon={elig.eligible} />;

  const apply = () => {
    setBusy(true);
    const ok = onApply(drive.id, resumeId);
    if (!ok) setBusy(false);
  };

  return (
    <article className="card flex flex-col p-4 transition hover:border-brand/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow !text-brand">{drive.company.name}</p>
          <h3 className="mt-0.5 truncate text-[15px] font-semibold text-ink">
            <Link to={`/student/opportunities/${drive.id}`} className="hover:text-brand hover:underline">{drive.role}</Link>
          </h3>
        </div>
        {badge}
      </div>
      <p className="mt-2 text-xl font-bold text-ink">{formatCtc(drive.ctc)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {criteriaChips(drive).map((c) => <span key={c} className="chip">{c}</span>)}
        <span className="chip">{drive.category}</span>
      </div>

      {!app && !elig.eligible && !closed && (
        <p className="mt-3 flex items-start gap-1.5 rounded-md bg-danger-50 px-2.5 py-1.5 text-[12px] font-medium text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{elig.reasons[0].message}{elig.reasons.length > 1 ? ` (+${elig.reasons.length - 1} more)` : ''}</span>
        </p>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {closed ? `Closed ${formatDateTime(drive.deadline)}` : <>Closes {formatDateTime(drive.deadline)} · <Countdown to={drive.deadline} className="font-semibold text-ink" /></>}
        {frozen && <span className="font-semibold text-brand">· Frozen by CCPC</span>}
      </p>

      <div className="mt-auto pt-3">
        {app ? (
          <Link to="/student/applications" className="btn btn-secondary w-full">
            <CheckCircle2 className="h-4 w-4 text-success" /> Applied ✓ — view pipeline
          </Link>
        ) : elig.eligible && !closed && !frozen ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[12px] text-ink-muted">
              <span className="shrink-0">Resume:</span>
              <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} className="input h-8 text-xs" aria-label={`Resume for ${drive.company.name} ${drive.role}`}>
                {approved.length === 0 && <option value="">No verified resume</option>}
                {approved.map((r) => <option key={r.id} value={r.id}>{r.label || r.fileName}{r.id === defaultResumeId ? ' (default)' : ''}</option>)}
              </select>
            </label>
            <button type="button" className="btn btn-primary w-full" onClick={apply} disabled={!resumeId || busy}>
              <Zap className="h-4 w-4" /> {busy ? 'Applying…' : '1-Click Apply Now'}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary flex-1" disabled>
              <Lock className="h-3.5 w-3.5" /> {closed ? 'Applications closed' : frozen ? 'Drive frozen' : '1-Click Apply Locked'}
            </button>
            {!elig.eligible && <button type="button" className="btn btn-soft" onClick={() => onWhy(drive)}>Why?</button>}
          </div>
        )}
      </div>
    </article>
  );
}
