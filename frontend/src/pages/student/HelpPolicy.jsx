import { ShieldCheck, Lock, Ticket, Scale, Clock, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';

const POLICIES = [
  [ShieldCheck, 'Verified record', 'Eligibility is computed only from your faculty-verified academic record. Claimed values are compared with uploaded proofs before approval.'],
  [Lock, 'Auto-lock', 'Once verified, your academic record locks. Changes need a correction or unfreeze ticket approved by CCPC, followed by re-verification.'],
  [Scale, 'One-offer policy', 'When you receive an offer, your other active applications are automatically withdrawn and further drives become unavailable.'],
  [Clock, 'Deadlines', 'Applications freeze automatically at the drive deadline. Only CCPC can extend a deadline; you will be notified when it happens.'],
  [Ticket, 'Tickets', 'You can have one open ticket at a time. Include a clear justification and reference the supporting document.'],
];

const FAQ = [
  ['Why can’t I apply to a drive?', 'Open the drive and check the eligibility checklist — each failed rule shows your value and the requirement. Your profile must also be verified.'],
  ['Which resume is sent?', 'The resume you pick on the card (your default by default). Only verified resumes can be attached.'],
  ['Can I withdraw?', 'Yes, from My Applications, until the application reaches a final stage (Offered or Rejected).'],
  ['Where are my files stored?', 'On the institute-hosted PlaceMatrix server. Only you, authorised verifiers and the CCPC office can open your documents.'],
];

export default function HelpPolicy() {
  return (
    <>
      <PageHeader title="Help & Policy" description="How placement governance works on PlaceMatrix." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="card-title mb-3">Placement policies</h2>
          <ul className="space-y-3">
            {POLICIES.map(([Icon, t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><Icon className="h-4 w-4" /></span>
                <span><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-ink-muted">{d}</span></span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card card-pad">
          <h2 className="card-title mb-3 flex items-center gap-2"><HelpCircle className="h-4 w-4 text-ink-muted" /> Frequently asked</h2>
          <div className="divide-y divide-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-2.5">
                <summary className="cursor-pointer list-none text-sm font-medium text-ink marker:hidden group-open:text-brand">{q}</summary>
                <p className="mt-1.5 text-xs text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-canvas p-3 text-xs text-ink-soft">
            Need a correction? Raise it from <Link to="/student/profile" className="font-semibold text-brand underline">Profile Audit</Link>. For drive-specific questions contact the SPOC assigned to that company.
          </p>
        </section>
      </div>
    </>
  );
}
