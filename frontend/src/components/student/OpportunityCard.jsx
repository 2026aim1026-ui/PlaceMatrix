import { Link } from 'react-router-dom';
import { Zap, Lock, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import Countdown from '../common/Countdown';
import { formatCtc } from '../../utils/format';
import { formatDateTime } from '../../utils/dateUtils';
import { criteriaChips } from '../../utils/eligibility';
import { STAGE_LABELS } from '../../constants';

/**
 * Drive card for the student feed. Eligible + open drives open the apply dialog, where the student chooses
 * which resume to submit; ineligible drives show the first failed rule and a "Why?" link.
 */
export default function OpportunityCard({ drive, onApply, onWhy, now }) {
  const { eligibility: elig, application: app } = drive;
  const closed = new Date(drive.deadline).getTime() <= now || drive.status === 'CLOSED';
  const frozen = drive.status === 'FROZEN';

  let badge;
  if (app) badge = <StatusBadge status="APPLIED" label={app.stage === 'APPLIED' ? 'Applied' : STAGE_LABELS[app.stage]} tone={app.stage === 'REJECTED' ? 'red' : 'blue'} />;
  else if (frozen) badge = <StatusBadge status="FROZEN" />;
  else if (closed) badge = <StatusBadge status="CLOSED" />;
  else badge = <StatusBadge status={elig.eligible ? 'ELIGIBLE' : 'INELIGIBLE'} icon={elig.eligible} />;

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
        {frozen && <span className="font-semibold text-brand">· Frozen by CDPC</span>}
      </p>

      <div className="mt-auto pt-3">
        {app ? (
          <Link to="/student/applications" className="btn btn-secondary w-full">
            <CheckCircle2 className="h-4 w-4 text-success" /> Applied ✓ — view pipeline
          </Link>
        ) : elig.eligible && !closed && !frozen ? (
          <button type="button" className="btn btn-primary w-full" onClick={() => onApply(drive)}>
            <Zap className="h-4 w-4" /> Apply — choose resume
          </button>
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
