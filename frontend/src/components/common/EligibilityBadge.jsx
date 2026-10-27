import StatusBadge from './StatusBadge';

/** Shows Eligible / Not eligible from an evaluateEligibility() result, with the first reason as tooltip. */
export default function EligibilityBadge({ result, className = '' }) {
  if (!result) return null;
  return (
    <span title={result.eligible ? 'All criteria met' : result.reasons.map((r) => r.message).join('\n')} className={className}>
      <StatusBadge status={result.eligible ? 'ELIGIBLE' : 'INELIGIBLE'} icon />
    </span>
  );
}
