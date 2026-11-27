import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Send, Server, CheckCircle2, XCircle, RefreshCcw, AlertTriangle, PenSquare } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/forms/FormField';
import ComposeEmailModal from '../../components/email/ComposeEmailModal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { formatDateTime } from '../../utils/dateUtils';

/** SMTP status, test email (CCPC), compose, and the log of every email sent through the portal. */
export default function EmailCenter() {
  const { db, repo, companyById, driveById } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const isCcpc = me.role === 'CCPC';
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [kind, setKind] = useState('');
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([repo.getEmailStatus(), repo.getEmailLogs()]);
    if (s.ok) setStatus(s.result);
    if (l.ok) { setLogs(l.result.logs); setError(''); } else setError(l.error);
  }, [repo]);

  useEffect(() => { load(); }, [load, db.version]);

  const sendTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await repo.sendTestEmail(testTo.trim() || null);
    setTesting(false);
    if (!res.ok) { toast.error('Test not sent', res.error); return; }
    setTestResult(res.result);
    if (res.result.status === 'SENT') toast.success('Test email sent', `Check the inbox of ${res.result.email}.`);
    else toast.error('Test email failed', res.result.error);
    load();
  };

  const rows = useMemo(() => (logs || []).filter((e) => {
    if (state && e.status !== state) return false;
    if (kind && e.kind !== kind) return false;
    const t = q.trim().toLowerCase();
    return !t || `${e.recipientName || ''} ${e.recipientEmail} ${e.recipientRoll || ''} ${e.subject} ${e.senderName}`.toLowerCase().includes(t);
  }), [logs, q, state, kind]);

  const columns = [
    { key: 'at', header: 'When', sortable: true, render: (e) => <span className="whitespace-nowrap text-xs">{formatDateTime(e.at)}</span> },
    { key: 'kind', header: 'Type', render: (e) => <StatusBadge status={e.kind} /> },
    { key: 'recipientEmail', header: 'To', sortable: true, render: (e) => (
      <span className="block"><span className="block text-[13px] font-medium">{e.recipientName || e.recipientEmail}</span><span className="mono block text-[11px] text-ink-muted">{e.recipientEmail}</span></span>
    ) },
    { key: 'subject', header: 'Subject', render: (e) => (
      <button type="button" className="max-w-[260px] truncate text-left text-[13px] hover:text-brand hover:underline" onClick={() => setOpen(e)} title={e.subject}>{e.subject}</button>
    ) },
    { key: 'scope', header: 'Recruitment', render: (e) => <span className="text-xs text-ink-soft">{companyById.get(e.companyId)?.name || '—'}{e.driveId && driveById.get(e.driveId) ? ` · ${driveById.get(e.driveId).role}` : ''}</span> },
    { key: 'senderName', header: 'Sent by', render: (e) => <span className="text-xs">{e.senderName}</span> },
    { key: 'status', header: 'Result', render: (e) => (e.status === 'SENT'
      ? <StatusBadge status="SENT" />
      : <span className="block max-w-[220px] text-[11px] text-danger" title={e.error}><StatusBadge status="FAILED" /> {e.error}</span>) },
  ];

  const all = logs || [];
  return (
    <>
      <PageHeader
        title="Email Center"
        description={isCcpc ? 'Emails sent through the SMTP server: invitations, custom messages, onboarding links and assignment notices.' : 'Emails about the recruitments assigned to you.'}
        actions={(
          <>
            <button type="button" className="btn btn-secondary" onClick={load}><RefreshCcw className="h-4 w-4" /> Refresh</button>
            <button type="button" className="btn btn-primary" onClick={() => setCompose(true)}><PenSquare className="h-4 w-4" /> Compose</button>
          </>
        )}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-1">
          <h2 className="card-title flex items-center gap-2"><Server className="h-4 w-4 text-ink-muted" /> SMTP server</h2>
          {!status ? <p className="mt-3 text-sm text-ink-muted">Checking…</p> : status.configured ? (
            <div className="mt-3 space-y-1.5 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Configured</p>
              {isCcpc && (
                <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-[12px]">
                  <dt className="text-ink-muted">Host</dt><dd className="mono">{status.host}:{status.port}</dd>
                  <dt className="text-ink-muted">Security</dt><dd className="mono">{status.security}</dd>
                  <dt className="text-ink-muted">From</dt><dd>{status.fromName} &lt;{status.fromEmail}&gt;</dd>
                  <dt className="text-ink-muted">Login</dt><dd className="mono">{status.username || '—'} · password {status.passwordSet ? 'set' : 'not set'}</dd>
                </dl>
              )}
            </div>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Not configured. {isCcpc ? <>Add SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD and SMTP_FROM_EMAIL to <code>backend/.env</code>, then restart the backend (see PLACEMATRIX_FEATURE_SETUP_GUIDE.txt).</> : 'Ask the CCPC office to configure it.'}</span>
            </p>
          )}
          {isCcpc && (
            <div className="mt-4 border-t border-line pt-3">
              <FormField label="Send a test email to" hint={`Leave empty to use ${me.admin?.email || 'your address'}`}>
                <div className="flex gap-2">
                  <input type="email" className="input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={me.admin?.email} />
                  <button type="button" className="btn btn-secondary shrink-0" onClick={sendTest} disabled={testing}><Send className="h-4 w-4" /> {testing ? 'Sending…' : 'Test'}</button>
                </div>
              </FormField>
              {testResult && (testResult.status === 'SENT'
                ? <p className="mt-2 text-xs text-success">Sent to {testResult.email}. Check the inbox (and spam folder).</p>
                : <p className="mt-2 text-xs text-danger" role="alert">{testResult.error}</p>)}
            </div>
          )}
        </section>
        <div className="grid grid-cols-2 content-start gap-3 lg:col-span-2 lg:grid-cols-2">
          <StatCard icon={Mail} label="Emails logged" value={all.length} tone="blue" onClick={() => setState('')} active={!state} />
          <StatCard icon={CheckCircle2} label="Delivered to SMTP" value={all.filter((e) => e.status === 'SENT').length} tone="green" onClick={() => setState('SENT')} active={state === 'SENT'} />
          <StatCard icon={XCircle} label="Failed" value={all.filter((e) => e.status === 'FAILED').length} tone="amber" onClick={() => setState('FAILED')} active={state === 'FAILED'} />
          <StatCard icon={Send} label="Invitations" value={all.filter((e) => e.kind === 'INVITATION').length} tone="violet" onClick={() => setKind('INVITATION')} active={kind === 'INVITATION'} />
        </div>
      </div>

      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search recipient, roll or subject" className="sm:w-80" />
          <FilterDropdown label="Result" value={state} onChange={setState} options={[{ value: 'SENT', label: 'Sent' }, { value: 'FAILED', label: 'Failed' }]} />
          <FilterDropdown label="Type" value={kind} onChange={setKind} options={['INVITATION', 'CUSTOM', 'ONBOARDING', 'ASSIGNMENT', 'TEST'].map((k) => ({ value: k, label: k.charAt(0) + k.slice(1).toLowerCase() }))} />
          <span className="text-xs text-ink-muted sm:ml-auto">{rows.length} email(s)</span>
        </div>
        {error ? <p className="p-4 text-sm text-danger">{error}</p> : (
          <DataTable columns={columns} rows={rows} initialSort={{ key: 'at', dir: 'desc' }} empty={{ title: logs ? 'No emails yet' : 'Loading…', description: 'Emails you send appear here with their delivery result.' }} />
        )}
      </section>

      <ComposeEmailModal open={compose} onClose={() => setCompose(false)} initialKind="CUSTOM" />

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.subject} size="lg" description={open ? `To ${open.recipientName || ''} <${open.recipientEmail}> · ${formatDateTime(open.at)}` : ''}
        footer={<button type="button" className="btn btn-primary" onClick={() => setOpen(null)}>Close</button>}>
        {open && (
          <>
            <p className="mb-2 flex flex-wrap items-center gap-2 text-xs"><StatusBadge status={open.kind} /><StatusBadge status={open.status} /> sent by {open.senderName}</p>
            {open.error && <p className="mb-2 rounded bg-danger-50 px-2 py-1 text-xs text-danger">{open.error}</p>}
            <p className="whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm text-ink-soft">{open.preview}{open.preview.length >= 280 ? '…' : ''}</p>
          </>
        )}
      </Modal>
    </>
  );
}
