import { useMemo, useState } from 'react';
import { UserPlus, ShieldCheck, ShieldOff, KeyRound, Power, Users as UsersIcon, Briefcase, Landmark } from 'lucide-react';
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
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { ROLE_LABELS } from '../../constants';
import { timeAgo } from '../../utils/dateUtils';

const STAFF_ROLES = ['VERIFIER', 'SPOC', 'CCPC'];

/** CCPC: staff accounts, roles and verification rights ("Manage users & verification permissions"). */
export default function Users() {
  const { db, repo, config } = useData();
  const me = useCurrentUser();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [toggle, setToggle] = useState(null);
  const [tempPw, setTempPw] = useState(null);

  const users = db.adminUsers;
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users.filter((u) => (!role || u.role === role) && (!t || `${u.name} ${u.email}`.toLowerCase().includes(t)));
  }, [users, q, role]);

  const companiesOf = (u) => db.companies.filter((c) => c.spocId === u.id);

  const setVerify = async (u, canVerify) => {
    await toast.result(repo.updateUser(u.email, { canVerify }), canVerify ? 'Verification rights granted' : 'Verification rights revoked', `${u.name}`);
  };

  const resetPassword = async (u) => {
    const res = await repo.resetUserPassword(u.email);
    if (res.ok) setTempPw({ user: u, password: res.result.temporaryPassword });
    else toast.error('Could not reset password', res.error);
  };

  const columns = [
    { key: 'name', header: 'Name', sortable: true, render: (u) => (
      <span className="whitespace-nowrap"><span className="block font-semibold">{u.name}</span><span className="mono text-[11px] text-ink-muted">{u.email}</span></span>
    ) },
    { key: 'role', header: 'Role', sortable: true, render: (u) => <span className="whitespace-nowrap text-[13px]">{ROLE_LABELS[u.role]}</span> },
    { key: 'title', header: 'Title', render: (u) => <span className="text-xs text-ink-soft">{u.title || '—'}</span> },
    { key: 'rights', header: 'Access', render: (u) => {
      if (u.role === 'VERIFIER') return u.canVerify ? <StatusBadge status="APPROVED" label="Can verify" /> : <StatusBadge status="PENDING" label="View only" />;
      if (u.role === 'SPOC') {
        const cs = companiesOf(u);
        return <span className="text-xs text-ink-soft">{cs.length ? cs.map((c) => c.name).join(', ') : 'No companies yet'}{u.linkedStudentId ? ` · student ${u.linkedStudentId}` : ''}</span>;
      }
      return <StatusBadge status="APPROVED" label="Full access" />;
    } },
    { key: 'isActive', header: 'Status', sortable: true, render: (u) => (u.isActive ? <StatusBadge status="OPEN" label="Active" /> : <StatusBadge status="INACTIVE" />) },
    { key: 'lastLoginAt', header: 'Last sign-in', sortable: true, render: (u) => <span className="whitespace-nowrap text-xs text-ink-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</span> },
    { key: 'actions', header: '', className: 'text-right', render: (u) => (
      <div className="flex justify-end gap-1">
        {u.role === 'VERIFIER' && (u.canVerify
          ? <button type="button" className="btn btn-ghost btn-xs" onClick={() => setVerify(u, false)}><ShieldOff className="h-3.5 w-3.5" /> Revoke rights</button>
          : <button type="button" className="btn btn-soft btn-xs" onClick={() => setVerify(u, true)}><ShieldCheck className="h-3.5 w-3.5" /> Grant rights</button>)}
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setEdit(u)}>Edit</button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => resetPassword(u)} title="Reset password"><KeyRound className="h-3.5 w-3.5" /></button>
        {u.id !== me.admin?.id && (
          <button type="button" className={`btn btn-xs ${u.isActive ? 'btn-danger-soft' : 'btn-secondary'}`} onClick={() => setToggle(u)} title={u.isActive ? 'Deactivate' : 'Activate'}><Power className="h-3.5 w-3.5" /></button>
        )}
      </div>
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Staff accounts, SPOC assignments and faculty/staff verification rights. Students join through onboarding invitations."
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}><UserPlus className="h-4 w-4" /> Add staff user</button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={UsersIcon} label="Staff accounts" value={users.length} tone="blue" onClick={() => setRole('')} active={!role} />
        <StatCard icon={ShieldCheck} label="Verifiers" value={users.filter((u) => u.role === 'VERIFIER').length} tone="green" hint={`${users.filter((u) => u.role === 'VERIFIER' && u.canVerify).length} with rights`} onClick={() => setRole('VERIFIER')} active={role === 'VERIFIER'} />
        <StatCard icon={Briefcase} label="SPOCs" value={users.filter((u) => u.role === 'SPOC').length} tone="violet" onClick={() => setRole('SPOC')} active={role === 'SPOC'} />
        <StatCard icon={Landmark} label="CCPC admins" value={users.filter((u) => u.role === 'CCPC').length} tone="amber" onClick={() => setRole('CCPC')} active={role === 'CCPC'} />
      </div>

      <section className="card">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search name or email" className="sm:w-72" />
          <FilterDropdown label="Role" value={role} onChange={setRole} options={STAFF_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        </div>
        <DataTable columns={columns} rows={rows} initialSort={{ key: 'role', dir: 'asc' }} empty={{ title: 'No staff users match', description: 'Try a different search or role.' }} />
      </section>

      <UserFormModal open={createOpen} onClose={() => setCreateOpen(false)} domain={config.allowedDomain} onCreated={(r) => r.temporaryPassword && setTempPw({ user: r.user, password: r.temporaryPassword })} />
      <UserFormModal open={Boolean(edit)} user={edit} onClose={() => setEdit(null)} domain={config.allowedDomain} />

      <ConfirmationDialog
        open={Boolean(toggle)}
        onClose={() => setToggle(null)}
        tone={toggle?.isActive ? 'danger' : 'primary'}
        title={toggle?.isActive ? `Deactivate ${toggle?.name}?` : `Activate ${toggle?.name}?`}
        confirmLabel={toggle?.isActive ? 'Deactivate' : 'Activate'}
        message={toggle?.isActive ? 'The user is signed out on their next request and can no longer sign in. Their history stays in the audit trail.' : 'The user can sign in again.'}
        onConfirm={async () => {
          await toast.result(repo.updateUser(toggle.email, { isActive: !toggle.isActive }), toggle.isActive ? 'User deactivated' : 'User activated');
          setToggle(null);
        }}
      />

      <Modal open={Boolean(tempPw)} onClose={() => setTempPw(null)} size="sm" title="Temporary password"
        footer={<button type="button" className="btn btn-primary" onClick={() => setTempPw(null)}>Done</button>}>
        {tempPw && (
          <div className="space-y-2 text-sm">
            <p>Share this password with <strong>{tempPw.user.name}</strong> ({tempPw.user.email}). They can change it from the account menu.</p>
            <p className="mono rounded-lg bg-canvas px-3 py-2 text-center text-base font-semibold">{tempPw.password}</p>
          </div>
        )}
      </Modal>
    </>
  );
}

function UserFormModal({ open, user = null, onClose, onCreated, domain }) {
  const { db, repo } = useData();
  const toast = useToast();
  const blank = { email: '', name: '', role: 'VERIFIER', title: '', canVerify: true, linkedStudentId: '' };
  const [v, setV] = useState(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setV(user ? { email: user.email, name: user.name, role: user.role, title: user.title || '', canVerify: user.canVerify, linkedStudentId: user.linkedStudentId || '' } : blank);
      setError('');
    }
  }
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async () => {
    if (!v.name.trim()) { setError('Name is required.'); return; }
    if (!user && !v.email.trim().toLowerCase().endsWith(`@${domain}`)) { setError(`Use an @${domain} email address.`); return; }
    setBusy(true);
    const res = user
      ? await repo.updateUser(user.email, { name: v.name, title: v.title, role: v.role, canVerify: v.canVerify, linkedStudentId: v.role === 'SPOC' ? (v.linkedStudentId || null) : null })
      : await repo.createUser({ email: v.email.trim(), name: v.name.trim(), role: v.role, title: v.title.trim(), canVerify: v.canVerify, linkedStudentId: v.role === 'SPOC' ? (v.linkedStudentId || null) : null });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    toast.success(user ? 'User updated' : 'Staff user created', v.name);
    onCreated?.(res.result);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={user ? `Edit ${user.name}` : 'Add staff user'}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{user ? 'Save changes' : 'Create user'}</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="College email" required className="sm:col-span-2">
          <input className="input" type="email" value={v.email} onChange={set('email')} disabled={Boolean(user)} placeholder={`name@${domain}`} />
        </FormField>
        <FormField label="Full name" required><input className="input" value={v.name} onChange={set('name')} /></FormField>
        <FormField label="Role" required>
          <select className="input" value={v.role} onChange={set('role')}>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </FormField>
        <FormField label="Title" className="sm:col-span-2"><input className="input" value={v.title} onChange={set('title')} placeholder="e.g. Faculty Verifier, Department of CSE" /></FormField>
        {v.role === 'VERIFIER' && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded border-line text-brand" checked={v.canVerify} onChange={set('canVerify')} />
            Allowed to verify records and approve resumes
          </label>
        )}
        {v.role === 'SPOC' && (
          <FormField label="Linked student profile (dual context)" hint="The SPOC's own student record, for the 'My Candidate Feed' switch" className="sm:col-span-2">
            <select className="input" value={v.linkedStudentId} onChange={set('linkedStudentId')}>
              <option value="">None</option>
              {db.students.map((s) => <option key={s.id} value={s.id}>{s.roll} — {s.name}</option>)}
            </select>
          </FormField>
        )}
        {!user && <p className="text-[11px] text-ink-muted sm:col-span-2">A temporary password is generated and shown once after creation.</p>}
        {error && <p className="text-xs text-danger sm:col-span-2" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
