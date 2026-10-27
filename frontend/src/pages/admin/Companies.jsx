import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, UserCog, Power, Globe, Mail, Phone, Eye, CheckCircle2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import FormField from '../../components/forms/FormField';
import Countdown from '../../components/common/Countdown';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { EMAIL_PATTERN, URL_PATTERN, PHONE_PATTERN } from '../../utils/validation';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { formatCtc } from '../../utils/format';

export default function Companies() {
  const { db, adminById, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(null); // { company } | { company: null }
  const [spocFor, setSpocFor] = useState(null);
  const [toggle, setToggle] = useState(null);
  const [detail, setDetail] = useState(null);
  const [approve, setApprove] = useState(null);

  useEffect(() => {
    const p = params.get('q');
    if (p !== null) setQ(p);
  }, [params]);

  const spocs = db.adminUsers.filter((u) => u.role === 'SPOC');

  const rows = db.companies.map((c) => {
    const drives = db.drives.filter((d) => d.companyId === c.id);
    const live = drives.filter((d) => d.status !== 'DRAFT').sort((a, b) => new Date(b.deadline) - new Date(a.deadline));
    return { ...c, drives, live, spoc: adminById.get(c.spocId), state: c.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : c.active ? 'APPROVED' : 'INACTIVE' };
  }).filter((c) => {
    if (status && c.state !== status) return false;
    const t = q.trim().toLowerCase();
    return !t || `${c.name} ${c.industry} ${c.recruiterEmail} ${c.spoc?.name || ''}`.toLowerCase().includes(t);
  });

  const columns = [
    { key: 'name', header: 'Company', sortable: true, render: (c) => (
      <button type="button" onClick={() => setDetail(c)} className="text-left">
        <span className="block font-semibold text-ink hover:text-brand hover:underline">{c.name}</span>
        <span className="block text-[11px] text-ink-muted">{c.industry}</span>
      </button>
    ) },
    { key: 'recruiterEmail', header: 'Recruiter contact', render: (c) => <span className="block max-w-[200px] truncate text-xs text-ink-soft" title={c.recruiterEmail}>{c.recruiterEmail}</span> },
    { key: 'approvedAt', header: 'Approved', sortable: true, render: (c) => <span className="whitespace-nowrap text-xs">{c.approvedAt ? formatDate(c.approvedAt) : '—'}</span> },
    { key: 'spoc', header: 'Assigned SPOC', sortable: true, sortValue: (c) => c.spoc?.name || '', render: (c) => (c.spoc
      ? <span className="text-[13px]">{c.spoc.name}</span>
      : <StatusBadge status="PENDING" label="Unassigned" />) },
    { key: 'jaf', header: 'JAF · Deadline', render: (c) => (c.live.length ? (
      <div className="space-y-1">
        {c.live.slice(0, 2).map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-medium">{d.role}</span><StatusBadge status={d.status} />
            <span className="text-ink-muted">{formatDateTime(d.deadline)}</span>
          </div>
        ))}
        {c.live.length > 2 && <span className="text-[11px] text-ink-muted">+{c.live.length - 2} more</span>}
      </div>
    ) : <span className="rounded bg-warning-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">Awaiting JAF from SPOC</span>) },
    { key: 'state', header: 'Status', render: (c) => <StatusBadge status={c.state} /> },
    { key: 'actions', header: '', className: 'text-right', render: (c) => (
      <div className="flex justify-end gap-1">
        {c.status === 'PENDING_APPROVAL' && <button type="button" className="btn btn-success btn-xs" onClick={() => setApprove(c)}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>}
        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setSpocFor(c)}><UserCog className="h-3.5 w-3.5" /> {c.spoc ? 'Change SPOC' : 'Assign SPOC'}</button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setForm({ company: c })} aria-label={`Edit ${c.name}`}><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" className={`btn btn-xs ${c.active ? 'btn-danger-soft' : 'btn-soft'}`} onClick={() => setToggle(c)} aria-label={c.active ? `Deactivate ${c.name}` : `Reactivate ${c.name}`} title={c.active ? 'Deactivate' : 'Reactivate'}><Power className="h-3.5 w-3.5" /></button>
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Companies & SPOC Assignment"
        description="When a recruiter's emailed form is approved, add the company here and assign one SPOC. That SPOC creates the JAF and its deadline."
        actions={<button type="button" className="btn btn-primary" onClick={() => setForm({ company: null })}><Plus className="h-4 w-4" /> Approve Company</button>}
      />
      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row">
          <SearchInput value={q} onChange={(v) => { setQ(v); if (params.get('q')) setParams({}); }} placeholder="Search company, recruiter or SPOC" className="sm:w-80" />
          <FilterDropdown label="Status" value={status} onChange={setStatus} options={[{ value: 'APPROVED', label: 'Active' }, { value: 'PENDING_APPROVAL', label: 'Awaiting approval' }, { value: 'INACTIVE', label: 'Inactive' }]} />
          <span className="text-xs text-ink-muted sm:ml-auto sm:self-center">{rows.length} companies</span>
        </div>
        <DataTable columns={columns} rows={rows} initialSort={{ key: 'name', dir: 'asc' }} />
      </section>

      <CompanyFormModal open={Boolean(form)} company={form?.company} spocs={spocs} onClose={() => setForm(null)} />

      <SpocModal company={spocFor} spocs={spocs} onClose={() => setSpocFor(null)} />

      <ConfirmationDialog
        open={Boolean(toggle)}
        onClose={() => setToggle(null)}
        tone={toggle?.active ? 'danger' : 'primary'}
        title={toggle?.active ? `Deactivate ${toggle?.name}?` : `Reactivate ${toggle?.name}?`}
        confirmLabel={toggle?.active ? 'Deactivate' : 'Reactivate'}
        message={toggle?.active ? 'Open drives for this company will be frozen and hidden from new applications. Existing applications are kept.' : 'The company becomes active again. Frozen drives stay frozen until reopened from Placement Drives.'}
        onConfirm={async () => {
          await toast.result(repo.setCompanyActive(me.actor, toggle.id, !toggle.active), toggle.active ? 'Company deactivated' : 'Company reactivated');
          setToggle(null);
        }}
      />

      <ConfirmationDialog
        open={Boolean(approve)}
        onClose={() => setApprove(null)}
        tone="success"
        title={`Approve ${approve?.name}?`}
        confirmLabel="Approve"
        message="The company joins the placement season. Assign a SPOC so they can publish the JAF."
        onConfirm={async () => { await toast.result(repo.approveCompany(me.actor, approve.id), 'Company approved'); setApprove(null); }}
      />

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name} description={detail?.industry} size="lg"
        footer={<><button type="button" className="btn btn-secondary" onClick={() => { setForm({ company: detail }); setDetail(null); }}><Pencil className="h-4 w-4" /> Edit</button><button type="button" className="btn btn-primary" onClick={() => setDetail(null)}>Close</button></>}
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <p className="text-ink-soft">{detail.description}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-ink-muted" />{detail.website}</p>
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-ink-muted" />{detail.recruiterEmail}</p>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-ink-muted" />{detail.phone || '—'}</p>
              <p className="flex items-center gap-2"><UserCog className="h-4 w-4 text-ink-muted" />Contact: {detail.contactName || '—'} · SPOC: {detail.spoc?.name || 'Unassigned'}</p>
            </div>
            <div>
              <p className="eyebrow mb-2">Drives ({detail.drives.length})</p>
              {detail.drives.length === 0 ? <p className="text-xs text-ink-muted">No drives yet.</p> : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {detail.drives.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span><span className="font-medium">{d.role}</span> <span className="text-xs text-ink-muted">· {formatCtc(d.ctc)}</span></span>
                      <span className="flex items-center gap-2 text-xs"><Countdown to={d.deadline} className="text-ink-muted" /><StatusBadge status={d.status} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function CompanyFormModal({ open, company, spocs, onClose }) {
  const { repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const blank = { name: '', industry: '', website: 'https://', description: '', contactName: '', recruiterEmail: '', phone: '', spocId: '' };
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: blank });

  useEffect(() => {
    if (open) reset(company ? { ...blank, ...company, spocId: company.spocId || '' } : blank);
  }, [open, company]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (v) => {
    const payload = {
      ...(company ? { id: company.id } : {}),
      name: v.name.trim(), industry: v.industry.trim(), website: v.website.trim(), description: v.description.trim(),
      contactName: v.contactName.trim(), recruiterEmail: v.recruiterEmail.trim(), phone: v.phone.trim(), spocId: v.spocId || null,
    };
    if (await toast.result(repo.saveCompany(me.actor, payload), company ? 'Company updated' : 'Company approved', company ? undefined : 'Students will see it once its SPOC publishes a JAF.')) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={company ? `Edit ${company.name}` : 'Approve a new company'}
      description="Details from the recruiter's approved form."
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" form="company-form" className="btn btn-primary">{company ? 'Save changes' : 'Approve company'}</button></>}
    >
      <form id="company-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-3 sm:grid-cols-2">
        <FormField label="Company name" required error={errors.name?.message}>
          <input className="input" {...register('name', { required: 'Company name is required', minLength: { value: 2, message: 'Too short' } })} />
        </FormField>
        <FormField label="Industry" required error={errors.industry?.message}>
          <input className="input" placeholder="e.g. Enterprise Software" {...register('industry', { required: 'Industry is required' })} />
        </FormField>
        <FormField label="Website" required error={errors.website?.message}>
          <input className="input" {...register('website', { required: 'Website is required', pattern: { value: URL_PATTERN, message: 'Enter a full URL starting with http(s)://' } })} />
        </FormField>
        <FormField label="Contact person" required error={errors.contactName?.message}>
          <input className="input" {...register('contactName', { required: 'Contact person is required' })} />
        </FormField>
        <FormField label="Recruiter email" required error={errors.recruiterEmail?.message}>
          <input type="email" className="input" {...register('recruiterEmail', { required: 'Recruiter email is required', pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email' } })} />
        </FormField>
        <FormField label="Phone" error={errors.phone?.message}>
          <input className="input" {...register('phone', { validate: (v) => !v || PHONE_PATTERN.test(v) || 'Enter a valid phone number' })} />
        </FormField>
        <FormField label="Assign SPOC" hint="One SPOC per company">
          <select className="input" {...register('spocId')}>
            <option value="">Assign later</option>
            {spocs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="Description" className="sm:col-span-2" error={errors.description?.message}>
          <textarea rows={2} className="input" {...register('description', { maxLength: { value: 300, message: 'Keep it under 300 characters' } })} />
        </FormField>
      </form>
    </Modal>
  );
}

function SpocModal({ company, spocs, onClose }) {
  const { db, repo } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [spocId, setSpocId] = useState('');
  useEffect(() => { setSpocId(company?.spocId || spocs[0]?.id || ''); }, [company, spocs]);
  if (!company) return null;
  return (
    <Modal open onClose={onClose} size="sm" title={`SPOC for ${company.name}`}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={!spocId || spocId === company.spocId} onClick={async () => { if (await toast.result(repo.assignSpoc(me.actor, company.id, spocId), 'SPOC assigned')) onClose(); }}>Assign</button></>}
    >
      <fieldset className="space-y-2">
        <legend className="label">Choose a SPOC</legend>
        {spocs.map((s) => {
          const load = db.companies.filter((c) => c.spocId === s.id).length;
          return (
            <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${spocId === s.id ? 'border-brand bg-brand-50/50' : 'border-line'}`}>
              <input type="radio" name="spoc" value={s.id} checked={spocId === s.id} onChange={() => setSpocId(s.id)} className="text-brand" />
              <span className="flex-1"><span className="block text-sm font-medium">{s.name}</span><span className="block text-[11px] text-ink-muted">{s.email} · {load} compan{load === 1 ? 'y' : 'ies'}</span></span>
              {company.spocId === s.id && <StatusBadge status="APPROVED" label="Current" />}
            </label>
          );
        })}
      </fieldset>
      <p className="mt-3 text-[11px] text-ink-muted"><Eye className="mr-1 inline h-3 w-3" />The SPOC sees only companies assigned to them.</p>
    </Modal>
  );
}
