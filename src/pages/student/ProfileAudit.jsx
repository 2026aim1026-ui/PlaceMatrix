import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Lock, Send, Save, Unlock, FilePenLine, AlertTriangle, Ticket, Check, Clock, Building2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import FormField from '../../components/forms/FormField';
import Modal from '../../components/common/Modal';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import { useStudentData } from '../../hooks/useStudentData';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { missingForSubmission } from '../../data/mockRepository';
import { BRANCHES, DEGREES, GRAD_YEARS } from '../../constants';
import { numberInRange, PHONE_PATTERN } from '../../utils/validation';
import { formatFull, timeAgo } from '../../utils/dateUtils';

const STEPS = ['Invited', 'Profile Filled', 'Documents', 'Verified', 'Locked'];

const CORRECTABLE = [
  { field: 'cgpa', label: 'Overall CGPA' },
  { field: 'semCgpa', label: 'Semester SGPA' },
  { field: 'class10', label: 'Class 10 %' },
  { field: 'class12', label: 'Class 12 %' },
  { field: 'backlogs', label: 'Active backlogs' },
  { field: 'branch', label: 'Branch' },
  { field: 'degree', label: 'Degree' },
];

function LockedTag() {
  return <span className="inline-flex items-center gap-0.5 rounded bg-warning-50 px-1 text-[10px] font-semibold text-amber-700"><Lock className="h-2.5 w-2.5" />Locked</span>;
}

function Stepper({ done }) {
  return (
    <ol className="flex items-start">
      {STEPS.map((s, i) => {
        const complete = done[i];
        const current = !complete && (i === 0 || done[i - 1]);
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-3 h-0.5 w-full ${done[i] || current ? 'bg-success' : 'bg-line'}`} aria-hidden />}
            <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${complete ? 'bg-success text-white' : current ? 'bg-white text-brand ring-brand/20 border-2 border-brand' : 'bg-line text-ink-muted'}`}>
              {complete ? <Check className="h-3.5 w-3.5" aria-hidden /> : <span className="text-[10px] font-bold">{i + 1}</span>}
            </span>
            <span className={`mt-2 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px] ${complete ? 'text-ink' : 'text-ink-muted'}`}>{s}</span>
            <span className="sr-only">{complete ? 'completed' : current ? 'current step' : 'not started'}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function ProfileAudit() {
  const { student, documents, tickets } = useStudentData();
  const me = useCurrentUser();
  const { db, repo } = useData();
  const toast = useToast();
  const [ticketMode, setTicketMode] = useState(null); // 'CORRECTION' | 'UNFREEZE'
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const locked = student.locked;
  const pending = student.verification === 'PENDING';
  const academicDisabled = locked || pending;

  const toForm = (s) => ({
    degree: s.degree || '',
    branch: s.branch || '',
    gradYear: s.gradYear || 2026,
    cgpa: s.cgpa ?? '',
    semCgpa: (s.semCgpa || []).join(', '),
    class10: s.class10 ?? '',
    class12: s.class12 ?? '',
    backlogs: s.backlogs ?? 0,
  });

  const academic = useForm({ defaultValues: toForm(student) });
  const contact = useForm({ defaultValues: { phone: student.phone || '', skills: (student.skills || []).join(', ') } });

  // Re-sync when the record changes elsewhere (e.g. verifier approves, ticket unlocks).
  useEffect(() => {
    academic.reset(toForm(student));
  }, [student.locked, student.verification]); // eslint-disable-line react-hooks/exhaustive-deps

  const profileFilled = ['cgpa', 'class10', 'class12', 'branch', 'degree'].every((k) => student[k] !== '' && student[k] !== null && student[k] !== undefined);
  const docsDone = ['GRADE_CARD', 'CLASS10', 'CLASS12', 'RESUME'].every((t) => documents.some((d) => d.type === t));
  const verified = student.verification === 'VERIFIED';
  const done = [true, profileFilled, docsDone, verified, verified && locked];
  const missing = missingForSubmission(db, student);
  const openTicket = tickets.find((t) => t.status === 'OPEN');
  const lastTicket = tickets[0];

  const saveAcademic = (v) => {
    const sem = v.semCgpa.split(',').map((x) => x.trim()).filter(Boolean).map(Number);
    if (sem.some((n) => Number.isNaN(n) || n < 0 || n > 10)) {
      academic.setError('semCgpa', { message: 'Enter comma-separated SGPA values between 0 and 10' });
      return;
    }
    const res = repo.updateStudentProfile(me.actor, student.id, {
      degree: v.degree, branch: v.branch, gradYear: Number(v.gradYear), cgpa: Number(v.cgpa),
      semCgpa: sem, class10: Number(v.class10), class12: Number(v.class12), backlogs: Number(v.backlogs),
    });
    if (toast.result(res, 'Academic record saved', 'Submit for verification when your documents are uploaded.')) academic.reset(v);
  };

  const saveContact = (v) => {
    const res = repo.updateStudentProfile(me.actor, student.id, {
      phone: v.phone.trim(),
      skills: v.skills.split(',').map((s) => s.trim()).filter(Boolean),
    });
    if (toast.result(res, 'Contact details saved')) contact.reset(v);
  };

  const submit = () => {
    setConfirmSubmit(false);
    toast.result(repo.submitForVerification(me.actor, student.id), 'Submitted for verification', 'A faculty verifier will compare your claims with your documents.');
  };

  const placedApp = db.applications.find((a) => a.studentId === student.id && a.stage === 'OFFERED');
  const placedDrive = placedApp && db.drives.find((d) => d.id === placedApp.driveId);

  return (
    <>
      <PageHeader
        title="Profile Audit"
        description="Your academic record. It locks automatically once a faculty or staff verifier approves it."
        actions={locked ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setTicketMode('CORRECTION')} disabled={Boolean(openTicket)}><FilePenLine className="h-4 w-4" /> Request correction</button>
            <button type="button" className="btn btn-primary" onClick={() => setTicketMode('UNFREEZE')} disabled={Boolean(openTicket)}><Unlock className="h-4 w-4" /> Request unfreeze</button>
          </>
        ) : !pending ? (
          <button type="button" className="btn btn-primary" onClick={() => setConfirmSubmit(true)} disabled={missing.length > 0 || academic.formState.isDirty}>
            <Send className="h-4 w-4" /> Submit for verification
          </button>
        ) : null}
      />

      <section className="card card-pad mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="card-title">Audit status</h2>
          <StatusBadge status={student.verification} icon />
        </div>
        <Stepper done={done} />
      </section>

      {(student.verification === 'REVISION' || student.verification === 'REJECTED') && student.revisionReason && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-50 p-4" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-danger">{student.verification === 'REJECTED' ? 'Profile rejected' : 'Revision requested by verifier'}</p>
            <p className="mt-0.5 text-ink-soft">{student.revisionReason}</p>
            <p className="mt-1 text-xs text-ink-muted">Correct the values below or replace the flagged document in <Link to="/student/documents" className="font-semibold text-brand underline">Documents</Link>, then resubmit.</p>
          </div>
        </div>
      )}
      {pending && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-50 p-4 text-sm text-amber-800">
          <Clock className="h-5 w-5 shrink-0" aria-hidden /> Submitted {student.submittedAt ? timeAgo(student.submittedAt) : ''} — awaiting faculty verification. Editing is paused during review.
        </div>
      )}
      {!locked && !pending && missing.length > 0 && (
        <div className="mb-4 rounded-xl border border-line bg-white p-4 text-sm">
          <p className="font-semibold text-ink">Before you can submit:</p>
          <ul className="mt-1 list-inside list-disc text-ink-soft">{missing.map((m) => <li key={m}>{m === 'cgpa' ? 'Enter your CGPA' : m === 'class10' ? 'Enter Class 10 %' : m === 'class12' ? 'Enter Class 12 %' : `Upload ${m}`}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Academic record */}
        <section className="card card-pad lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="card-title">Academic Record</h2>
            {locked ? <StatusBadge status="LOCKED" label="Verified, locked" icon /> : <StatusBadge status="UNLOCKED" />}
          </div>
          <form onSubmit={academic.handleSubmit(saveAcademic)} noValidate>
            <fieldset disabled={academicDisabled} className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Academic record</legend>
              <FormField label="Roll number" badge={<LockedTag />}>
                <input className="input" value={student.roll} readOnly disabled />
              </FormField>
              <FormField label="Degree" required badge={locked && <LockedTag />} error={academic.formState.errors.degree?.message}>
                <select className="input" {...academic.register('degree', { required: 'Degree is required' })}>
                  <option value="">Select</option>
                  {DEGREES.map((d) => <option key={d}>{d}</option>)}
                </select>
              </FormField>
              <FormField label="Branch" required badge={locked && <LockedTag />} error={academic.formState.errors.branch?.message}>
                <select className="input" {...academic.register('branch', { required: 'Branch is required' })}>
                  <option value="">Select</option>
                  {BRANCHES.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
                </select>
              </FormField>
              <FormField label="Graduation year" badge={locked && <LockedTag />}>
                <select className="input" {...academic.register('gradYear')}>
                  {GRAD_YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </FormField>
              <FormField label="10th %" required badge={locked && <LockedTag />} error={academic.formState.errors.class10?.message}>
                <input type="number" step="0.01" className="input" {...academic.register('class10', { validate: numberInRange(33, 100, 'Class 10 %') })} />
              </FormField>
              <FormField label="12th %" required badge={locked && <LockedTag />} error={academic.formState.errors.class12?.message}>
                <input type="number" step="0.01" className="input" {...academic.register('class12', { validate: numberInRange(33, 100, 'Class 12 %') })} />
              </FormField>
              <FormField label="Semester SGPA (comma separated)" badge={locked && <LockedTag />} error={academic.formState.errors.semCgpa?.message} hint={!academicDisabled ? 'e.g. 8.24, 8.48, 8.54' : undefined}>
                <input className="input" {...academic.register('semCgpa')} />
              </FormField>
              <FormField label="Overall CGPA" required badge={locked && <LockedTag />} error={academic.formState.errors.cgpa?.message}>
                <input type="number" step="0.01" className="input" {...academic.register('cgpa', { validate: numberInRange(0, 10, 'CGPA') })} />
              </FormField>
              <FormField label="Active backlogs" required badge={locked && <LockedTag />} error={academic.formState.errors.backlogs?.message}>
                <input type="number" step="1" min="0" className="input" {...academic.register('backlogs', { validate: numberInRange(0, 20, 'Backlogs') })} />
              </FormField>
              <FormField label="Placement status">
                <input className="input" readOnly disabled value={student.placedCompany ? `Placed — ${student.placedCompany}` : 'Unplaced'} />
              </FormField>
            </fieldset>
            {!academicDisabled && (
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => academic.reset(toForm(student))} disabled={!academic.formState.isDirty}>Discard</button>
                <button type="submit" className="btn btn-primary" disabled={!academic.formState.isDirty}><Save className="h-4 w-4" /> Save academic record</button>
              </div>
            )}
          </form>
          {locked && (
            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-muted">Verified by <strong className="text-ink">{student.verifiedBy}</strong> on {formatFull(student.verifiedAt)}. Verified academic fields are read-only.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTicketMode('UNFREEZE')} disabled={Boolean(openTicket)}><Lock className="h-3.5 w-3.5" /> Request Unfreeze</button>
            </div>
          )}
          {placedDrive && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-xs text-success">
              <Building2 className="h-3.5 w-3.5" /> Placed at {student.placedCompany} — {placedDrive.role}. One-offer policy applies to further drives.
            </p>
          )}
        </section>

        <div className="space-y-4 lg:col-span-2">
          {/* Personal information */}
          <section className="card card-pad">
            <h2 className="card-title mb-4">Personal Information</h2>
            <form onSubmit={contact.handleSubmit(saveContact)} noValidate className="space-y-3">
              <FormField label="Full name"><input className="input" value={student.name} readOnly disabled /></FormField>
              <FormField label="Entry number"><input className="input" value={student.roll} readOnly disabled /></FormField>
              <FormField label="Institute email"><input className="input" value={student.email} readOnly disabled /></FormField>
              <FormField label="Phone" required error={contact.formState.errors.phone?.message}>
                <input className="input" {...contact.register('phone', { required: 'Phone is required', pattern: { value: PHONE_PATTERN, message: 'Enter a valid phone number' } })} />
              </FormField>
              <FormField label="Skills (comma separated)" hint="Used for drives with skill requirements">
                <input className="input" {...contact.register('skills')} />
              </FormField>
              <button type="submit" className="btn btn-secondary w-full" disabled={!contact.formState.isDirty}>Save contact details</button>
            </form>
          </section>

          {/* Tickets */}
          <section className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="card-title flex items-center gap-2"><Ticket className="h-4 w-4 text-ink-muted" /> Last ticket status</h2>
              {lastTicket && <StatusBadge status={lastTicket.status === 'OPEN' ? 'PENDING' : lastTicket.status} label={lastTicket.status === 'OPEN' ? 'Open' : undefined} />}
            </div>
            {lastTicket ? (
              <div className="text-sm">
                <p className="font-medium text-ink">{lastTicket.type === 'UNFREEZE' ? 'Unfreeze' : 'Correction'} · {lastTicket.fieldLabel}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{lastTicket.currentValue} → <strong className="text-ink">{lastTicket.requestedValue}</strong> · raised {timeAgo(lastTicket.createdAt)}</p>
                {lastTicket.resolution && <p className="mt-2 rounded-md bg-canvas px-2.5 py-1.5 text-xs text-ink-soft">“{lastTicket.resolution}” — {lastTicket.resolvedBy}</p>}
                {tickets.length > 1 && <p className="mt-2 text-[11px] text-ink-muted">{tickets.length - 1} earlier ticket(s)</p>}
              </div>
            ) : (
              <p className="text-xs text-ink-muted">No correction or unfreeze tickets raised.</p>
            )}
            {!locked && <p className="mt-3 text-[11px] text-ink-muted">Tickets are available once your profile is verified and locked.</p>}
          </section>
        </div>
      </div>

      <TicketModal mode={ticketMode} onClose={() => setTicketMode(null)} student={student} />

      <ConfirmationDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={submit}
        title="Submit profile for verification?"
        confirmLabel="Submit"
        message="Your academic record and documents will be sent to the verification queue. Editing is paused until the verifier responds. Once approved, the record locks automatically."
      />
    </>
  );
}

function TicketModal({ mode, onClose, student }) {
  const me = useCurrentUser();
  const { repo } = useData();
  const toast = useToast();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { field: 'cgpa', requestedValue: '', justification: '' },
  });
  useEffect(() => {
    if (mode) reset({ field: 'cgpa', requestedValue: '', justification: '' });
  }, [mode, reset]);

  const field = watch('field');
  const current = field === 'semCgpa' ? (student.semCgpa || []).join(', ') : String(student[field] ?? '');
  const label = CORRECTABLE.find((c) => c.field === field)?.label;

  const onSubmit = (v) => {
    const res = repo.createTicket(me.actor, student.id, {
      type: mode, field: v.field, fieldLabel: label, currentValue: current, requestedValue: v.requestedValue.trim(), justification: v.justification,
    });
    if (toast.result(res, 'Ticket raised', 'CCPC will review your request. You can track it under Last ticket status.')) onClose();
  };

  return (
    <Modal
      open={Boolean(mode)}
      onClose={onClose}
      title={mode === 'UNFREEZE' ? 'Request profile unfreeze' : 'Request a correction'}
      description="Verified fields cannot be edited directly. CCPC reviews the request; if approved your profile unlocks for correction and re-verification."
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="ticket-form" className="btn btn-primary"><Send className="h-4 w-4" /> Submit request</button>
        </>
      )}
    >
      <form id="ticket-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
        <FormField label="Field to correct" required>
          <select className="input" {...register('field')}>
            {CORRECTABLE.map((c) => <option key={c.field} value={c.field}>{c.label}</option>)}
          </select>
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Current verified value"><input className="input" value={current} readOnly disabled /></FormField>
          <FormField label="Requested value" required error={errors.requestedValue?.message}>
            <input className="input" {...register('requestedValue', {
              required: 'Enter the corrected value',
              validate: (v) => v.trim() !== current || 'Requested value must differ from the current value',
            })} />
          </FormField>
        </div>
        <FormField label="Justification" required error={errors.justification?.message} hint="Explain the reason and reference the supporting document (min. 20 characters).">
          <textarea rows={4} className="input" {...register('justification', { required: 'Justification is required', minLength: { value: 20, message: 'Please write at least 20 characters' } })} />
        </FormField>
      </form>
    </Modal>
  );
}
