import { CheckCircle2, Lock } from 'lucide-react';

const TONES = {
  green: 'bg-success-50 text-success ring-success/20',
  amber: 'bg-warning-50 text-amber-700 ring-warning/25',
  red: 'bg-danger-50 text-danger ring-danger/20',
  blue: 'bg-brand-50 text-brand ring-brand/20',
  navy: 'bg-navy text-white ring-navy',
  gray: 'bg-canvas text-ink-soft ring-line',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};

// Map known status codes to a tone + label. Unknown values fall back to gray.
const MAP = {
  // verification / documents
  VERIFIED: ['green', 'Verified'], APPROVED: ['green', 'Approved'], PENDING: ['amber', 'Pending'],
  REVISION: ['red', 'Revision'], REJECTED: ['red', 'Rejected'], NOT_SUBMITTED: ['gray', 'Not submitted'],
  LOCKED: ['navy', 'Locked'], UNLOCKED: ['gray', 'Editable'],
  // drives
  OPEN: ['green', 'Open'], FROZEN: ['blue', 'Frozen'], CLOSED: ['gray', 'Closed'], DRAFT: ['amber', 'Draft'],
  // application stages
  APPLIED: ['blue', 'Applied'], UNDER_REVIEW: ['amber', 'Under review'], SHORTLISTED: ['violet', 'Shortlisted'],
  ASSESSMENT: ['amber', 'Assessment'], INTERVIEW: ['amber', 'Interview'], OFFERED: ['green', 'Offered'],
  WITHDRAWN: ['gray', 'Withdrawn'],
  // eligibility
  ELIGIBLE: ['green', 'Eligible'], INELIGIBLE: ['red', 'Not eligible'],
  // placement
  PLACED: ['green', 'Placed'], UNPLACED: ['gray', 'Unplaced'],
  // invitations / companies / tickets
  INVITED: ['amber', 'Invited'], NOT_INVITED: ['gray', 'Not invited'], REGISTERED: ['green', 'Registered'],
  DECLINED: ['red', 'Declined'], PENDING_APPROVAL: ['amber', 'Awaiting approval'], INACTIVE: ['gray', 'Inactive'],
  // parser
  READY: ['green', 'Ready'], SKIPPED: ['amber', 'Skipped'], NOT_APPLICANT: ['red', 'Not applicant'],
  DUPLICATE: ['gray', 'Duplicate'], INVALID: ['red', 'Invalid'],
  // misc
  PAID: ['green', 'Paid'], MATCH: ['green', 'Values match'], MISMATCH: ['red', 'Mismatch'],
};

export default function StatusBadge({ status, label, tone, icon = false, className = '' }) {
  const [t, l] = MAP[status] || ['gray', status];
  const toneCls = TONES[tone || t];
  const showLock = icon && status === 'LOCKED';
  const showCheck = icon && ['VERIFIED', 'APPROVED', 'ELIGIBLE', 'MATCH'].includes(status);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ring-1 ring-inset ${toneCls} ${className}`}>
      {showLock && <Lock className="h-3 w-3" aria-hidden />}
      {showCheck && <CheckCircle2 className="h-3 w-3" aria-hidden />}
      {label || l}
    </span>
  );
}
