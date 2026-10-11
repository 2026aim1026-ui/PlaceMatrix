import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Send, Plus, UserCheck, Hourglass, Wallet, XCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmationDialog from '../../components/common/ConfirmationDialog';
import FormField from '../../components/forms/FormField';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { INVITE_STATUS, ROLL_REGEX, BRANCH_CODES } from '../../constants';
import { formatDateTime } from '../../utils/dateUtils';

const ROLL_BRANCH = { CS: 'CSE', AI: 'AI', MC: 'MNC', EE: 'EE', EC: 'ECE', ME: 'ME', CE: 'CE' };
const STATUS_LABELS = { NOT_INVITED: 'Not invited', INVITED: 'Invited', REGISTERED: 'Registered', DECLINED: 'Declined' };

/** Parse "ENTRYNO, Name, Branch" lines into rows + per-line errors. */
function parseLines(text, existing) {
  const rows = [];
  const errors = [];
  const seen = new Set();
  text.split('\n').forEach((line, i) => {
    const raw = line.trim();
    if (!raw) return;
    const [entryRaw = '', name = '', branchRaw = ''] = raw.split(',').map((p) => p.trim());
    const entryNo = entryRaw.toUpperCase();
    const m = entryNo.match(ROLL_REGEX);
    const n = i + 1;
    if (!m) { errors.push(`Line ${n}: "${entryRaw}" is not a valid entry number (e.g. 2026CSB1045)`); return; }
    if (!name) { errors.push(`Line ${n}: name is missing`); return; }
    const branch = (branchRaw || ROLL_BRANCH[m[2]]).toUpperCase();
    if (!BRANCH_CODES.includes(branch)) { errors.push(`Line ${n}: unknown branch "${branchRaw}"`); return; }
    if (seen.has(entryNo)) { errors.push(`Line ${n}: ${entryNo} is repeated`); return; }
    if (existing.has(entryNo)) { errors.push(`Line ${n}: ${entryNo} is already in the onboarding list`); return; }
    seen.add(entryNo);
    rows.push({ entryNo, name, branch, degree: m[3] === 'M' ? 'M.Tech' : 'B.Tech' });
  });
  return { rows, errors };
}

export default function Invitations() {
  const { db, studentById, repo } = useData();
  const me = useCurrentUser();
  const { loginAs } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);

  const invs = db.invitations;
  const count = (s) => invs.filter((i) => i.status === s).length;
  const invitable = invs.filter((i) => i.status === 'NOT_INVITED' || i.status === 'DECLINED');
  const registered = count('REGISTERED');

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return invs.filter((i) => (!status || i.status === status) && (!t || `${i.entryNo} ${i.name}`.toLowerCase().includes(t)));
  }, [invs, q, status]);

  const send = (ids, title) => toast.result(repo.sendInvitations(me.actor, ids), title, 'The student can now sign in and accept the invitation.');

  const simulate = (email, to) => {
    const res = loginAs(email);
    if (!res.ok) { toast.error('Could not switch', res.error); return; }
    navigate(to);
    toast.info('Simulating student', `Now viewing as ${email}`);
  };

  const columns = [
    { key: 'entryNo', header: 'Entry No', sortable: true, render: (r) => <span className="mono font-semibold">{r.entryNo}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'branch', header: 'Branch', sortable: true },
    { key: 'fee', header: 'Placement Fee', render: () => <StatusBadge status="PAID" /> },
    { key: 'status', header: 'Invitation', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'updatedAt', header: 'Last update', sortable: true, render: (r) => <span className="whitespace-nowrap text-xs text-ink-soft">{r.updatedAt ? formatDateTime(r.updatedAt) : '—'}</span> },
    { key: 'profile', header: 'Profile', render: (r) => {
      const s = r.studentId && studentById.get(r.studentId);
      if (!s) return <span className="text-xs text-ink-muted">No profile yet</span>;
      const label = s.verification === 'VERIFIED' && s.locked ? 'Verified, locked' : undefined;
      return <StatusBadge status={s.verification} label={label} />;
    } },
    { key: 'action', header: 'Action', className: 'text-right', render: (r) => {
      const s = r.studentId && studentById.get(r.studentId);
      return (
        <div className="flex justify-end gap-1">
          {r.status === 'NOT_INVITED' && <button type="button" className="btn btn-primary btn-xs" onClick={() => send([r.id], 'Invitation sent')}><Send className="h-3 w-3" /> Send invitation</button>}
          {r.status === 'DECLINED' && <button type="button" className="btn btn-secondary btn-xs" onClick={() => send([r.id], 'Re-invitation sent')}>Re-invite</button>}
          {r.status === 'INVITED' && <button type="button" className="btn btn-soft btn-xs" onClick={() => simulate(r.email, '/student/invitation')}>Simulate this student</button>}
          {r.status === 'REGISTERED' && s && (
            <>
              <button type="button" className="btn btn-secondary btn-xs" onClick={() => navigate(`/admin/students?open=${s.id}`)}>View record</button>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => simulate(s.email, '/student/dashboard')}>Simulate this student</button>
            </>
          )}
        </div>
      );
    } },
  ];

  const existing = new Set(invs.map((i) => i.entryNo));
  const preview = () => setParsed(parseLines(text, existing));
  const submitAdd = () => {
    const p = parseLines(text, existing);
    setParsed(p);
    if (p.errors.length || !p.rows.length) return;
    if (toast.result(repo.addInvitees(me.actor, p.rows), 'Students added', `${p.rows.length} fee-paid student(s) added to the onboarding list.`)) {
      setAddOpen(false);
      setText('');
      setParsed(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Onboarding Invitations"
        description="The Academic Section shares the name and entry number of every student who paid the placement fee. Invite them to create their profile."
        actions={(
          <>
            <button type="button" className="btn btn-primary" disabled={!invitable.length} onClick={() => setConfirmBulk(true)}><Mail className="h-4 w-4" /> Send bulk invitation ({invitable.length})</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setAddOpen(true); setParsed(null); }}><Plus className="h-4 w-4" /> Add fee-paid students</button>
          </>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard icon={Wallet} label="Fee-paid records" value={invs.length} tone="blue" onClick={() => setStatus('')} active={!status} />
        <StatCard icon={Mail} label="Not invited" value={count('NOT_INVITED')} tone="gray" onClick={() => setStatus('NOT_INVITED')} active={status === 'NOT_INVITED'} />
        <StatCard icon={Hourglass} label="Invited · awaiting" value={count('INVITED')} tone="amber" onClick={() => setStatus('INVITED')} active={status === 'INVITED'} />
        <StatCard icon={UserCheck} label="Registered" value={registered} tone="green" onClick={() => setStatus('REGISTERED')} active={status === 'REGISTERED'} />
        <StatCard icon={XCircle} label="Declined" value={count('DECLINED')} tone="red" onClick={() => setStatus('DECLINED')} active={status === 'DECLINED'} />
      </div>

      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search entry number or name" className="sm:w-72" />
          <FilterDropdown label="Status" value={status} onChange={setStatus} options={Object.values(INVITE_STATUS).map((v) => ({ value: v, label: STATUS_LABELS[v] }))} />
        </div>
        <DataTable columns={columns} rows={rows} initialSort={{ key: 'status', dir: 'desc' }} empty={{ title: 'No invitation records', description: 'Try a different search or status.' }} />
        <p className="border-t border-line px-4 py-2 text-[11px] text-ink-muted">{registered} students have already registered and appear under Student Records.</p>
      </section>

      <ConfirmationDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        title="Send bulk invitation?"
        confirmLabel={`Invite ${invitable.length} student(s)`}
        message={<>Invitations will be sent to <strong>{invitable.length}</strong> fee-paid student(s) who are not invited or previously declined: {invitable.map((i) => i.entryNo).join(', ')}.</>}
        onConfirm={() => { send(invitable.map((i) => i.id), 'Bulk invitation sent'); setConfirmBulk(false); }}
      />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add fee-paid students"
        description="Paste the Academic Section list — one student per line as ENTRYNO, Name, Branch. Branch is optional and derived from the entry number."
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-secondary" onClick={preview} disabled={!text.trim()}>Validate</button>
            <button type="button" className="btn btn-primary" onClick={submitAdd} disabled={!text.trim()}>Add students</button>
          </>
        )}
      >
        <FormField label="Student list" required hint="e.g. 2026CSB1061, Aditi Verma, CSE">
          <textarea rows={7} className="input mono" value={text} onChange={(e) => { setText(e.target.value); setParsed(null); }} placeholder={'2026CSB1061, Aditi Verma, CSE\n2026EEB1052, Kabir Malhotra'} />
        </FormField>
        {parsed && (
          <div className="mt-3 space-y-2 text-xs">
            {parsed.rows.length > 0 && <p className="rounded-md bg-success-50 px-3 py-2 text-success">{parsed.rows.length} valid row(s): {parsed.rows.map((r) => `${r.entryNo} (${r.branch})`).join(', ')}</p>}
            {parsed.errors.length > 0 && (
              <ul className="space-y-1 rounded-md bg-danger-50 px-3 py-2 text-danger" role="alert">
                {parsed.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
            {!parsed.rows.length && !parsed.errors.length && <p className="text-ink-muted">No rows found.</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
