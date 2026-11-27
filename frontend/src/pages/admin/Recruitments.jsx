import { useMemo, useState } from 'react';
import { Briefcase, ShieldCheck, Mail, Send, History, Activity, UserX, Repeat } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import AssignmentModal from '../../components/admin/AssignmentModal';
import ComposeEmailModal from '../../components/email/ComposeEmailModal';
import { useData } from '../../context/DataContext';
import { formatDateTime, timeAgo } from '../../utils/dateUtils';
import { formatCtc } from '../../utils/format';

/**
 * CCPC recruitment desk: who runs and who verifies each recruitment — changeable at any time, even while
 * drives are running — plus invitations and emails to students, and the full assignment history.
 */
export default function Recruitments() {
  const { db, adminById } = useData();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [assign, setAssign] = useState(null); // { company, focus }
  const [compose, setCompose] = useState(null); // { companyId, kind, preselect }
  const [history, setHistory] = useState(null);

  const rows = useMemo(() => db.companies.filter((c) => c.status === 'APPROVED').map((c) => {
    const drives = db.drives.filter((d) => d.companyId === c.id);
    const running = drives.filter((d) => d.status === 'OPEN' || d.status === 'FROZEN');
    const driveIds = new Set(drives.map((d) => d.id));
    const apps = db.applications.filter((a) => driveIds.has(a.driveId) && a.stage !== 'WITHDRAWN');
    const changes = db.assignmentHistory.filter((h) => h.companyId === c.id);
    return {
      ...c, drives, running, apps,
      spoc: adminById.get(c.spocId), verifier: adminById.get(c.verifierId),
      lastChange: changes[0] || null, changes,
    };
  }).filter((c) => {
    if (filter === 'running' && !c.running.length) return false;
    if (filter === 'missing' && c.spocId && c.verifierId) return false;
    const t = q.trim().toLowerCase();
    return !t || `${c.name} ${c.spoc?.name || ''} ${c.verifier?.name || ''}`.toLowerCase().includes(t);
  }), [db, adminById, q, filter]);

  const all = db.companies.filter((c) => c.status === 'APPROVED');
  const monthAgo = Date.now() - 30 * 86400000;

  const person = (u, missing) => (u
    ? <span className="block"><span className="block text-[13px] font-medium">{u.name}</span><span className="block text-[11px] text-ink-muted">{u.email}{u.isActive === false ? ' · inactive' : ''}</span></span>
    : <StatusBadge status="PENDING" label={missing} />);

  const columns = [
    { key: 'name', header: 'Recruitment', sortable: true, render: (c) => (
      <span className="block min-w-[150px]"><span className="block font-semibold">{c.name}</span><span className="block text-[11px] text-ink-muted">{c.industry}</span></span>
    ) },
    { key: 'running', header: 'Drives', sortable: true, sortValue: (c) => c.running.length, render: (c) => (c.drives.length ? (
      <div className="space-y-1">
        {c.drives.filter((d) => d.status !== 'DRAFT').slice(0, 3).map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-medium">{d.role}</span><StatusBadge status={d.status} /><span className="text-ink-muted">{formatCtc(d.ctc)}</span>
          </div>
        ))}
        {c.drives.length > 3 && <span className="text-[11px] text-ink-muted">+{c.drives.length - 3} more</span>}
      </div>
    ) : <span className="text-xs text-ink-muted">No drives yet</span>) },
    { key: 'apps', header: 'Applicants', sortable: true, sortValue: (c) => c.apps.length, className: 'text-center', render: (c) => <span className="font-semibold">{c.apps.length}</span> },
    { key: 'spoc', header: 'SPOC', sortable: true, sortValue: (c) => c.spoc?.name || '', render: (c) => (
      <div className="flex items-start gap-2">
        {person(c.spoc, 'No SPOC')}
        <button type="button" className="btn btn-ghost btn-xs shrink-0" onClick={() => setAssign({ company: c, focus: 'SPOC' })} aria-label={`Change SPOC of ${c.name}`}>Change</button>
      </div>
    ) },
    { key: 'verifier', header: 'Verifier', sortable: true, sortValue: (c) => c.verifier?.name || '', render: (c) => (
      <div className="flex items-start gap-2">
        {person(c.verifier, 'No verifier')}
        <button type="button" className="btn btn-ghost btn-xs shrink-0" onClick={() => setAssign({ company: c, focus: 'VERIFIER' })} aria-label={`Change verifier of ${c.name}`}>Change</button>
      </div>
    ) },
    { key: 'lastChange', header: 'Last change', render: (c) => (c.lastChange ? (
      <button type="button" className="text-left text-[11px] text-ink-soft hover:text-brand" onClick={() => setHistory(c)}>
        {c.lastChange.role === 'SPOC' ? 'SPOC' : 'Verifier'} → {c.lastChange.newName || 'unassigned'}<br /><span className="text-ink-muted">{timeAgo(c.lastChange.at)}</span>
      </button>
    ) : <span className="text-[11px] text-ink-muted">—</span>) },
    { key: 'actions', header: '', className: 'text-right', render: (c) => (
      <div className="flex flex-wrap justify-end gap-1">
        <button type="button" className="btn btn-soft btn-xs" disabled={!c.drives.some((d) => d.status === 'OPEN')} title={c.drives.some((d) => d.status === 'OPEN') ? 'Invite students to an open drive' : 'No open drive'} onClick={() => setCompose({ companyId: c.id, kind: 'INVITATION', preselect: [] })}><Send className="h-3.5 w-3.5" /> Invite</button>
        <button type="button" className="btn btn-ghost btn-xs" disabled={!c.apps.length} onClick={() => setCompose({ companyId: c.id, kind: 'CUSTOM', preselect: [...new Set(c.apps.map((a) => a.studentId))] })}><Mail className="h-3.5 w-3.5" /> Email applicants</button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setHistory(c)} aria-label={`Assignment history of ${c.name}`}><History className="h-3.5 w-3.5" /></button>
      </div>
    ) },
  ];

  const hist = history ? db.assignmentHistory.filter((h) => h.companyId === history.id) : [];

  return (
    <>
      <PageHeader
        title="Recruitments"
        description="Assign or change the SPOC and verifier of every recruitment — also while its drives are running — and invite or email students. Changes are saved to the database and take effect immediately."
      />
      <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Activity} label="Running recruitments" value={all.filter((c) => db.drives.some((d) => d.companyId === c.id && (d.status === 'OPEN' || d.status === 'FROZEN'))).length} tone="blue" onClick={() => setFilter('running')} active={filter === 'running'} />
        <StatCard icon={Briefcase} label="Without SPOC" value={all.filter((c) => !c.spocId).length} tone="amber" onClick={() => setFilter('missing')} active={filter === 'missing'} />
        <StatCard icon={ShieldCheck} label="Without verifier" value={all.filter((c) => !c.verifierId).length} tone="amber" onClick={() => setFilter('missing')} active={filter === 'missing'} />
        <StatCard icon={Repeat} label="Reassignments (30 days)" value={db.assignmentHistory.filter((h) => new Date(h.at).getTime() > monthAgo).length} tone="violet" />
      </section>

      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search company, SPOC or verifier" className="sm:w-80" />
          <FilterDropdown label="Show" value={filter} onChange={setFilter} options={[{ value: 'running', label: 'Running only' }, { value: 'missing', label: 'Missing SPOC / verifier' }]} />
          <span className="text-xs text-ink-muted sm:ml-auto">{rows.length} recruitment(s)</span>
        </div>
        {rows.length === 0
          ? <EmptyState icon={UserX} title="No recruitments match" description="Change the search or filter." />
          : <DataTable columns={columns} rows={rows} initialSort={{ key: 'running', dir: 'desc' }} />}
      </section>

      <AssignmentModal company={assign?.company || null} focus={assign?.focus} onClose={() => setAssign(null)} />
      <ComposeEmailModal
        open={Boolean(compose)}
        onClose={() => setCompose(null)}
        companyId={compose?.companyId}
        initialKind={compose?.kind || 'INVITATION'}
        preselect={compose?.preselect || []}
      />

      <Modal open={Boolean(history)} onClose={() => setHistory(null)} title={`Assignment history — ${history?.name || ''}`} size="lg"
        footer={<button type="button" className="btn btn-primary" onClick={() => setHistory(null)}>Close</button>}>
        {hist.length === 0 ? <p className="text-sm text-ink-muted">No changes recorded yet.</p> : (
          <ol className="space-y-2">
            {hist.map((h) => (
              <li key={h.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                <p><StatusBadge status={h.role === 'SPOC' ? 'OPEN' : 'SHORTLISTED'} label={h.role === 'SPOC' ? 'SPOC' : 'Verifier'} />{' '}
                  <span className="text-ink-soft">{h.previousName || 'Unassigned'}</span> → <strong>{h.newName || 'Unassigned'}</strong></p>
                <p className="mt-0.5 text-[11px] text-ink-muted">{formatDateTime(h.at)} · by {h.changedBy}{h.reason ? ` · “${h.reason}”` : ''}</p>
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </>
  );
}
