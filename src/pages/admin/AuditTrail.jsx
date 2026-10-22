import { useMemo, useState } from 'react';
import { Download, Lock, ScrollText, Clock, UserCheck, Briefcase } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { downloadCsv } from '../../utils/csvExport';
import { formatDateTime, formatFull, DAY } from '../../utils/dateUtils';

const ROLE_NAMES = { CCPC: 'CCPC Admin', VERIFIER: 'Verifier', SPOC: 'SPOC', STUDENT: 'Student', SYSTEM: 'System' };

export default function AuditTrail() {
  const { db } = useData();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [role, setRole] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const audit = db.audit;
  const actions = useMemo(() => [...new Set(audit.map((e) => e.action))].sort(), [audit]);
  const entities = useMemo(() => [...new Set(audit.map((e) => e.entity))].sort(), [audit]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
    return audit.filter((e) => {
      if (action && e.action !== action) return false;
      if (entity && e.entity !== entity) return false;
      if (role && e.actorRole !== role) return false;
      const at = new Date(e.at).getTime();
      if (fromMs !== null && at < fromMs) return false;
      if (toMs !== null && at > toMs) return false;
      return !t || `${e.actorName} ${e.description} ${e.entity} ${e.action}`.toLowerCase().includes(t);
    });
  }, [audit, q, action, entity, role, from, to]);

  const dayAgo = Date.now() - DAY;
  const stats = {
    total: audit.length,
    today: audit.filter((e) => new Date(e.at).getTime() >= dayAgo).length,
    profile: audit.filter((e) => e.entity === 'Profile').length,
    drive: audit.filter((e) => e.entity === 'Drive').length,
  };

  const exportCsv = () => {
    downloadCsv(`placematrix-audit-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: 'Timestamp', value: (r) => formatFull(r.at) },
      { header: 'Actor', key: 'actorName' },
      { header: 'Role', key: 'actorRole' },
      { header: 'Entity', key: 'entity' },
      { header: 'Action', key: 'action' },
      { header: 'Description', key: 'description' },
    ]);
    toast.success('Audit log exported', `${rows.length} event(s) downloaded as CSV.`);
  };

  const columns = [
    { key: 'at', header: 'Timestamp', sortable: true, render: (r) => (
      <span className="whitespace-nowrap"><span className="mono block">{formatDateTime(r.at)}</span><span className="text-[10.5px] text-ink-muted">{new Date(r.at).getFullYear()}</span></span>
    ) },
    { key: 'actorName', header: 'Actor', sortable: true, render: (r) => (
      <span className="whitespace-nowrap"><span className="block font-medium">{r.actorName}</span><span className="text-[11px] text-ink-muted">{ROLE_NAMES[r.actorRole] || r.actorRole}</span></span>
    ) },
    { key: 'entity', header: 'Entity', sortable: true },
    { key: 'action', header: 'Action Type', sortable: true, render: (r) => (
      <span className="mono whitespace-nowrap rounded bg-canvas px-1.5 py-0.5 text-[10.5px] uppercase text-ink-soft">{r.action}</span>
    ) },
    { key: 'description', header: 'Description', render: (r) => <span className="text-[13px] text-ink-soft">{r.description}</span> },
  ];

  const filtersActive = q || action || entity || role || from || to;

  return (
    <>
      <PageHeader title="Central Audit Trail" description="Append-only record of every significant action. Entries cannot be edited or deleted." />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={ScrollText} label="Total events" value={stats.total} tone="blue" />
        <StatCard icon={Clock} label="Last 24 hours" value={stats.today} tone="amber" />
        <StatCard icon={UserCheck} label="Profile actions" value={stats.profile} tone="green" onClick={() => setEntity(entity === 'Profile' ? '' : 'Profile')} active={entity === 'Profile'} />
        <StatCard icon={Briefcase} label="Drive actions" value={stats.drive} tone="violet" onClick={() => setEntity(entity === 'Drive' ? '' : 'Drive')} active={entity === 'Drive'} />
      </div>

      <p className="mb-4 flex items-start gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink-soft">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
        Append-only: this demo UI exposes no edit or delete controls. In a production system immutability would be enforced server-side.
      </p>

      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search actor, roll number, company…" className="lg:w-80" label="Search audit log" />
            <FilterDropdown label="Action type" value={action} onChange={setAction} options={actions} />
            <FilterDropdown label="Entity" value={entity} onChange={setEntity} options={entities} />
            <FilterDropdown label="Actor role" value={role} onChange={setRole} options={Object.entries(ROLE_NAMES).map(([value, label]) => ({ value, label }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">From
              <input type="date" className="input h-9 w-auto text-[13px]" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">To
              <input type="date" className="input h-9 w-auto text-[13px]" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
            {filtersActive && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setAction(''); setEntity(''); setRole(''); setFrom(''); setTo(''); }}>Clear filters</button>
            )}
            <span className="ml-auto text-xs text-ink-muted">{rows.length} of {audit.length} events</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /> Export (CSV)</button>
          </div>
        </div>
        <DataTable columns={columns} rows={rows} pageSize={15} initialSort={{ key: 'at', dir: 'desc' }} empty={{ title: 'No audit events match', description: 'Try a different search, filter or date range.', icon: ScrollText }} />
      </section>
    </>
  );
}
