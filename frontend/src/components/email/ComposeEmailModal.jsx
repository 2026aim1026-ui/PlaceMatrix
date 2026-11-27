import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Mail, CheckCircle2, XCircle, AlertTriangle, Users, Eye } from 'lucide-react';
import Modal from '../common/Modal';
import SearchInput from '../common/SearchInput';
import StatusBadge from '../common/StatusBadge';
import FormField from '../forms/FormField';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { BRANCHES } from '../../constants';
import { formatCtc } from '../../utils/format';

const TEMPLATES = {
  INVITATION: {
    subject: 'Invitation to apply: {company} — {role}',
    body: 'Dear {first_name},\n\nYou are invited to apply for the {role} role at {company} ({ctc}) through PlaceMatrix.\nApplications close on {deadline}.\n\nView the drive and apply here: {link}\n\nRegards,\n{sender}\nCDPC, IIT Ropar',
  },
  CUSTOM: {
    subject: '',
    body: 'Dear {first_name},\n\n\n\nRegards,\n{sender}\nCDPC, IIT Ropar',
  },
};
const PLACEHOLDERS = ['first_name', 'name', 'roll', 'branch', 'company', 'role', 'ctc', 'deadline', 'link', 'sender'];

function fill(text, values) {
  return PLACEHOLDERS.reduce((out, k) => out.split(`{${k}}`).join(values[k] ?? ''), text);
}

/**
 * Compose and send an email (placement invitation or custom message) to students through SMTP.
 * Recipients come from GET /api/email/recipients, which the server limits to what the signed-in user may
 * email (CDPC: everyone; SPOC: applicants of / students eligible for their own recruitments).
 */
export default function ComposeEmailModal({ open, onClose, companyId: fixedCompany = null, driveId: initialDrive = null, initialKind = 'INVITATION', preselect = [], title }) {
  const { db, repo, companyById } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [kind, setKind] = useState(initialKind);
  const [companyId, setCompanyId] = useState(fixedCompany || '');
  const [driveId, setDriveId] = useState(initialDrive || '');
  const [candidates, setCandidates] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [hideApplied, setHideApplied] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  // Reset each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const d = initialDrive ? db.drives.find((x) => x.id === initialDrive) : null;
    setKind(initialKind);
    setCompanyId(fixedCompany || d?.companyId || '');
    setDriveId(initialDrive || '');
    setSubject(TEMPLATES[initialKind].subject);
    setBody(TEMPLATES[initialKind].body);
    setSelected(new Set(preselect));
    setEligibleOnly(initialKind === 'INVITATION' && preselect.length === 0);
    setHideApplied(initialKind === 'INVITATION' && preselect.length === 0);
    setQ('');
    setBranch('');
    setResults(null);
    setError('');
    repo.getEmailStatus().then((r) => setStatus(r.ok ? r.result : { configured: false }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const companyDrives = useMemo(
    () => db.drives.filter((d) => d.companyId === companyId && d.status !== 'DRAFT'),
    [db.drives, companyId],
  );
  const drive = db.drives.find((d) => d.id === driveId) || null;
  const company = companyById.get(companyId) || null;

  // Load the students this user may email for the chosen recruitment.
  useEffect(() => {
    if (!open) return undefined;
    if (me.role === 'SPOC' && !companyId) { setCandidates([]); return undefined; }
    let cancelled = false;
    setCandidates(null);
    setLoadError('');
    repo.getEmailRecipients({ driveId: driveId || undefined, companyId: driveId ? undefined : companyId || undefined }).then((r) => {
      if (cancelled) return;
      if (r.ok) setCandidates(r.result.students);
      else { setLoadError(r.error); setCandidates([]); }
    });
    return () => { cancelled = true; };
  }, [open, driveId, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeKind = (k) => {
    setKind(k);
    if (subject === TEMPLATES[kind].subject) setSubject(TEMPLATES[k].subject);
    if (body === TEMPLATES[kind].body) setBody(TEMPLATES[k].body);
    if (k === 'INVITATION') { setEligibleOnly(true); }
  };

  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (candidates || []).filter((s) => (
      (!t || `${s.roll} ${s.name}`.toLowerCase().includes(t))
      && (!branch || s.branch === branch)
      && (!eligibleOnly || !drive || s.eligible || selected.has(s.roll))
      && (!hideApplied || !s.applied || selected.has(s.roll))
    ));
  }, [candidates, q, branch, eligibleOnly, hideApplied, drive, selected]);

  const toggle = (roll) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(roll)) next.delete(roll); else next.add(roll);
    return next;
  });
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.roll));
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    visible.forEach((s) => (allVisibleSelected ? next.delete(s.roll) : next.add(s.roll)));
    return next;
  });

  const firstRecipient = (candidates || []).find((s) => selected.has(s.roll));
  const previewValues = firstRecipient ? {
    name: firstRecipient.name,
    first_name: firstRecipient.name.split(' ')[0],
    roll: firstRecipient.roll,
    branch: firstRecipient.branch || '',
    company: company?.name || '',
    role: drive?.role || '',
    ctc: drive ? formatCtc(drive.ctc) : '',
    deadline: drive ? new Date(drive.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '',
    link: drive ? `${window.location.origin}/student/opportunities/${drive.id}` : `${window.location.origin}/login`,
    sender: me.name,
  } : null;

  const send = async () => {
    setError('');
    if (kind === 'INVITATION' && !driveId) { setError('Choose the drive you are inviting students to.'); return; }
    if (selected.size === 0) { setError('Select at least one student.'); return; }
    if (!subject.trim() || !body.trim()) { setError('Subject and message are required.'); return; }
    setSending(true);
    const res = await repo.sendEmail({
      recipients: [...selected], subject: subject.trim(), body, kind,
      driveId: driveId || null, companyId: companyId || null,
    });
    setSending(false);
    if (!res.ok) { setError(res.error); return; }
    setResults(res.result);
    if (res.result.failed === 0) toast.success(`${res.result.sent} email(s) sent`);
    else toast.warning(`${res.result.sent} sent, ${res.result.failed} failed`, 'See the per-recipient results.');
  };

  const notConfigured = status && !status.configured;
  const canPickCompany = !fixedCompany;
  const companies = me.role === 'SPOC' ? db.companies.filter((c) => c.spocId === me.admin?.id) : db.companies.filter((c) => c.status === 'APPROVED');

  return (
    <Modal
      open={open}
      onClose={sending ? () => {} : onClose}
      size="xl"
      title={title || (kind === 'INVITATION' ? 'Invite students to apply' : 'Email students')}
      description={company ? `${company.name}${drive ? ` — ${drive.role}` : ''}` : 'Emails are sent through the portal’s SMTP server to the addresses stored for each student.'}
      footer={results ? (
        <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
      ) : (
        <>
          <span className="mr-auto text-xs text-ink-muted">{selected.size} recipient(s) selected</span>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={sending}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={send} disabled={sending || notConfigured || selected.size === 0}>
            <Send className="h-4 w-4" /> {sending ? `Sending ${selected.size}…` : kind === 'INVITATION' ? `Send invitation (${selected.size})` : `Send email (${selected.size})`}
          </button>
        </>
      )}
    >
      {results ? (
        <div>
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> {results.sent} sent</span>
            {results.failed > 0 && <span className="flex items-center gap-1.5 font-semibold text-danger"><XCircle className="h-4 w-4" /> {results.failed} failed</span>}
            {kind === 'INVITATION' && <span className="text-ink-muted">Each student also received an in-app notification.</span>}
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-line">
            <table className="table-base">
              <thead><tr><th>Student</th><th>Email</th><th>Result</th></tr></thead>
              <tbody>
                {results.results.map((r) => (
                  <tr key={r.email}>
                    <td><span className="font-medium">{r.name}</span> <span className="mono text-[11px] text-ink-muted">{r.roll}</span></td>
                    <td className="mono text-[12px]">{r.email}</td>
                    <td>{r.status === 'SENT' ? <StatusBadge status="APPROVED" label="Sent" /> : <span className="text-xs text-danger">{r.error}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {notConfigured && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-50 px-3 py-2 text-sm text-amber-800" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Email is not configured on the server yet, so nothing can be sent. {me.role === 'CDPC' ? <>Set the SMTP values in <code>backend/.env</code> and restart the backend — see <Link to="/admin/emails" className="font-semibold underline">Email Center</Link>.</> : 'Ask the CDPC office to configure SMTP.'}</span>
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Type">
              <select className="input" value={kind} onChange={(e) => changeKind(e.target.value)}>
                <option value="INVITATION">Placement invitation</option>
                <option value="CUSTOM">Custom email</option>
              </select>
            </FormField>
            <FormField label="Company">
              <select className="input" value={companyId} disabled={!canPickCompany} onChange={(e) => { setCompanyId(e.target.value); setDriveId(''); }}>
                {me.role === 'CDPC' && <option value="">{kind === 'INVITATION' ? 'Choose a company' : 'No specific company'}</option>}
                {me.role === 'SPOC' && !companyId && <option value="">Choose one of your companies</option>}
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Drive" hint={kind === 'INVITATION' ? 'Required for invitations (open drives)' : 'Optional'}>
              <select className="input" value={driveId} onChange={(e) => setDriveId(e.target.value)} disabled={!companyId}>
                <option value="">{kind === 'INVITATION' ? 'Choose a drive' : 'Whole company'}</option>
                {companyDrives.map((d) => <option key={d.id} value={d.id} disabled={kind === 'INVITATION' && d.status !== 'OPEN'}>{d.role} · {d.status.toLowerCase()}</option>)}
              </select>
            </FormField>
          </div>

          <section className="rounded-lg border border-line">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-2.5">
              <Users className="h-4 w-4 text-ink-muted" aria-hidden />
              <SearchInput value={q} onChange={setQ} placeholder="Search roll or name" className="w-56" />
              <select className="input h-9 w-36" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
                <option value="">All branches</option>
                {BRANCHES.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
              </select>
              {drive && <label className="flex items-center gap-1.5 text-xs text-ink-soft"><input type="checkbox" className="h-4 w-4 rounded border-line text-brand" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} /> Eligible only</label>}
              {(drive || companyId) && <label className="flex items-center gap-1.5 text-xs text-ink-soft"><input type="checkbox" className="h-4 w-4 rounded border-line text-brand" checked={hideApplied} onChange={(e) => setHideApplied(e.target.checked)} /> Hide students who applied</label>}
              <span className="ml-auto text-xs text-ink-muted">{visible.length} shown</span>
            </div>
            <div className="max-h-60 overflow-auto">
              {candidates === null ? (
                <p className="p-4 text-sm text-ink-muted" role="status">Loading students…</p>
              ) : loadError ? (
                <p className="p-4 text-sm text-danger" role="alert">{loadError}</p>
              ) : me.role === 'SPOC' && !companyId ? (
                <p className="p-4 text-sm text-ink-muted">Choose one of your companies first.</p>
              ) : visible.length === 0 ? (
                <p className="p-4 text-sm text-ink-muted">No students match these filters.</p>
              ) : (
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="w-8"><input type="checkbox" className="h-4 w-4 rounded border-line text-brand" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all shown" /></th>
                      <th>Student</th><th>Branch</th><th>CGPA</th><th>Profile</th>{drive && <th>Eligibility</th>}<th>Application</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((s) => (
                      <tr key={s.roll} className="cursor-pointer" onClick={() => toggle(s.roll)}>
                        <td><input type="checkbox" className="h-4 w-4 rounded border-line text-brand" checked={selected.has(s.roll)} onChange={() => toggle(s.roll)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${s.name}`} /></td>
                        <td><span className="font-medium">{s.name}</span> <span className="mono text-[11px] text-ink-muted">{s.roll}</span></td>
                        <td className="text-xs">{s.branch} · {s.degree}</td>
                        <td className="text-xs">{s.cgpa?.toFixed(2) ?? '—'}</td>
                        <td><StatusBadge status={s.placement === 'PLACED' ? 'PLACED' : s.verification} /></td>
                        {drive && <td className="max-w-[200px] text-xs">{s.eligible ? <span className="font-medium text-success">Eligible</span> : <span className="text-danger">{s.reason}</span>}</td>}
                        <td className="text-xs">{s.applied ? s.stageLabel : <span className="text-ink-muted">Not applied</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <FormField label="Subject" required>
                <input className="input" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Pre-placement talk tomorrow at 10 AM" />
              </FormField>
              <FormField label="Message" required>
                <textarea className="input min-h-[190px] font-[inherit]" maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
              </FormField>
              <p className="text-[11px] text-ink-muted">
                Personalise with: {PLACEHOLDERS.map((p) => (
                  <button key={p} type="button" className="mono mx-0.5 rounded bg-canvas px-1 py-px text-[11px] text-brand hover:bg-brand-50" onClick={() => setBody((b) => `${b}{${p}}`)}>{`{${p}}`}</button>
                ))}
              </p>
            </div>
            <div>
              <p className="label mb-1.5 flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Preview{firstRecipient ? ` for ${firstRecipient.name}` : ''}</p>
              <div className="h-full max-h-[300px] min-h-[200px] overflow-auto rounded-lg border border-line bg-canvas/50 p-3 text-sm">
                {previewValues ? (
                  <>
                    <p className="font-semibold text-ink"><Mail className="mr-1 inline h-3.5 w-3.5 text-ink-muted" />{fill(subject, previewValues) || '(no subject)'}</p>
                    <p className="mt-2 whitespace-pre-wrap text-ink-soft">{fill(body, previewValues)}</p>
                  </>
                ) : <p className="text-ink-muted">Select a recipient to preview the personalised email.</p>}
              </div>
            </div>
          </div>
          {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
