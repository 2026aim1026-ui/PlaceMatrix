import { CheckCircle2, XCircle } from 'lucide-react';

/** Per-rule pass/fail list from evaluateEligibility().checks */
export default function EligibilityChecklist({ checks }) {
  return (
    <ul className="space-y-1.5">
      {checks.map((c) => (
        <li key={c.rule} className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-[13px] ${c.pass ? 'bg-success-50/60' : 'bg-danger-50'}`}>
          {c.pass ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Passed" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Failed" />}
          <span>
            <span className="font-medium text-ink">{c.label}</span>
            {!c.pass && <span className="block text-xs text-danger">{c.message}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
