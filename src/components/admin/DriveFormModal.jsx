import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../common/Modal';
import FormField from '../forms/FormField';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { BRANCHES, DEGREES, GRAD_YEARS, JOB_CATEGORIES } from '../../constants';
import { toInputDateTime, fromInputDateTime, DAY } from '../../utils/dateUtils';
import { numberInRange } from '../../utils/validation';

/**
 * Create / edit a placement drive (a JAF). Used by CCPC on Placement Drives and by SPOCs on Assigned Companies.
 * Props: open, onClose, drive (existing record to edit) | null, companyId (preset), lockCompany, companies (choices)
 */
export default function DriveFormModal({ open, onClose, drive = null, companyId, lockCompany = false, companies }) {
  const { db, repo, companyById } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const choices = companies || db.companies.filter((c) => c.status === 'APPROVED' && c.active);

  const defaults = () => {
    const d = drive;
    return {
      companyId: d?.companyId || companyId || choices[0]?.id || '',
      role: d?.role || '',
      ctc: d?.ctc ?? '',
      location: d?.location || '',
      category: d?.category || JOB_CATEGORIES[0],
      description: d?.description || '',
      minCgpa: d?.criteria.minCgpa ?? 7.0,
      maxBacklogs: d?.criteria.maxBacklogs ?? 0,
      branches: d?.criteria.branches || ['CSE', 'AI'],
      degrees: d?.criteria.degrees || [],
      gradYears: (d?.criteria.gradYears || [2026]).map(String),
      skills: (d?.criteria.skills || []).join(', '),
      deadline: toInputDateTime(d?.deadline || new Date(Date.now() + 5 * DAY).toISOString()),
      status: d?.status || 'OPEN',
    };
  };

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({ defaultValues: defaults() });
  useEffect(() => {
    if (open) reset(defaults());
  }, [open, drive]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = watch('status');
  const company = companyById.get(watch('companyId'));

  const onSubmit = (v) => {
    const deadline = fromInputDateTime(v.deadline);
    const payload = {
      ...(drive ? { id: drive.id } : {}),
      companyId: v.companyId,
      role: v.role.trim(),
      ctc: Number(v.ctc),
      location: v.location.trim(),
      category: v.category,
      description: v.description.trim(),
      deadline,
      status: v.status,
      criteria: {
        minCgpa: Number(v.minCgpa),
        maxBacklogs: Number(v.maxBacklogs),
        branches: v.branches || [],
        degrees: v.degrees || [],
        gradYears: (v.gradYears || []).map(Number),
        skills: v.skills.split(',').map((s) => s.trim()).filter(Boolean),
      },
    };
    const res = repo.saveDrive(me.actor, payload);
    const title = drive ? 'Drive updated' : v.status === 'DRAFT' ? 'Draft saved' : 'JAF published';
    if (toast.result(res, title, v.status === 'OPEN' ? 'Students can now see this drive in Opportunities.' : undefined)) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={drive ? `Edit drive · ${company?.name || ''}` : `Create JAF${company ? ` · ${company.name}` : ''}`}
      description="Fill this from the recruiter's approved form. The deadline you set is the one students, CCPC and the calendar all see."
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="drive-form" className="btn btn-primary">{drive ? 'Save changes' : status === 'DRAFT' ? 'Save draft' : 'Publish JAF'}</button>
        </>
      )}
    >
      <form id="drive-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-3 sm:grid-cols-2">
        {lockCompany ? (
          <FormField label="Company">
            <input className="input" value={company?.name || ''} readOnly disabled />
          </FormField>
        ) : (
          <FormField label="Company" required error={errors.companyId?.message}>
            <select className="input" {...register('companyId', { required: 'Choose a company' })}>
              {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        )}
        {lockCompany && <input type="hidden" {...register('companyId')} />}
        <FormField label="Role title" required error={errors.role?.message}>
          <input className="input" placeholder="Software Engineer" {...register('role', { required: 'Role title is required', minLength: { value: 2, message: 'Too short' } })} />
        </FormField>
        <FormField label="CTC (LPA)" required error={errors.ctc?.message}>
          <input type="number" step="0.5" className="input" {...register('ctc', { validate: numberInRange(1, 200, 'CTC') })} />
        </FormField>
        <FormField label="Location" required error={errors.location?.message}>
          <input className="input" placeholder="Bengaluru" {...register('location', { required: 'Location is required' })} />
        </FormField>
        <FormField label="Job category">
          <select className="input" {...register('category')}>{JOB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </FormField>
        <FormField label="Status">
          <select className="input" {...register('status')}>
            <option value="OPEN">Open — visible to students</option>
            <option value="DRAFT">Draft — hidden from students</option>
            <option value="FROZEN">Frozen — visible, applications paused</option>
            <option value="CLOSED">Closed</option>
          </select>
        </FormField>
        <FormField label="Minimum CGPA" required error={errors.minCgpa?.message}>
          <input type="number" step="0.01" className="input" {...register('minCgpa', { validate: numberInRange(0, 10, 'Minimum CGPA') })} />
        </FormField>
        <FormField label="Max active backlogs" required error={errors.maxBacklogs?.message}>
          <input type="number" step="1" min="0" className="input" {...register('maxBacklogs', { validate: numberInRange(0, 10, 'Backlogs') })} />
        </FormField>
        <FormField label="Application deadline" required error={errors.deadline?.message} className="sm:col-span-2">
          <input type="datetime-local" className="input" {...register('deadline', {
            required: 'Deadline is required',
            validate: (v) => {
              const t = new Date(v).getTime();
              if (Number.isNaN(t)) return 'Enter a valid date';
              if (status === 'OPEN' && t <= Date.now()) return 'An open drive needs a future deadline';
              return true;
            },
          })} />
        </FormField>
        <fieldset className="sm:col-span-2">
          <legend className="label">Allowed branches <span className="text-ink-muted">(none selected = all branches)</span></legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {BRANCHES.map((b) => (
              <label key={b.code} className="flex items-center gap-1.5 text-sm"><input type="checkbox" value={b.code} className="h-4 w-4 rounded border-line text-brand" {...register('branches')} />{b.code}</label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Degree restriction</legend>
          <div className="flex gap-4">
            {DEGREES.map((d) => <label key={d} className="flex items-center gap-1.5 text-sm"><input type="checkbox" value={d} className="h-4 w-4 rounded border-line text-brand" {...register('degrees')} />{d}</label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Graduation year</legend>
          <div className="flex gap-4">
            {GRAD_YEARS.map((y) => <label key={y} className="flex items-center gap-1.5 text-sm"><input type="checkbox" value={String(y)} className="h-4 w-4 rounded border-line text-brand" {...register('gradYears', { validate: (v) => (v && v.length > 0) || 'Pick at least one year' })} />{y}</label>)}
          </div>
          {errors.gradYears && <p className="mt-1 text-xs text-danger">{errors.gradYears.message}</p>}
        </fieldset>
        <FormField label="Required skills (comma separated, optional)" className="sm:col-span-2">
          <input className="input" placeholder="Python, PyTorch" {...register('skills')} />
        </FormField>
        <FormField label="Short description" className="sm:col-span-2" error={errors.description?.message}>
          <textarea rows={2} className="input" placeholder="One line about the role and selection process" {...register('description', { maxLength: { value: 400, message: 'Keep it under 400 characters' } })} />
        </FormField>
      </form>
    </Modal>
  );
}
