import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import AppLayout from './AppLayout';
import { ADMIN_NAV } from '../../constants/navigation';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ROLE_LABELS, ROLES } from '../../constants';

export default function AdminLayout() {
  const me = useCurrentUser();
  const { db, studentById } = useData();
  const { switchToStudent } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const badges = useMemo(() => ({
    pendingCompanies: db.companies.filter((c) => c.status === 'PENDING_APPROVAL' || !c.spocId).length,
    pendingVerifications: db.students.filter((s) => s.verification === 'PENDING').length
      + db.documents.filter((d) => d.type === 'RESUME' && d.status === 'PENDING' && studentById.get(d.studentId)?.verification === 'VERIFIED').length,
    notInvited: db.invitations.filter((i) => i.status === 'NOT_INVITED').length,
    openTickets: db.tickets.filter((t) => t.status === 'OPEN').length,
    spocCompanies: db.companies.filter((c) => c.spocId === me.admin?.id && c.active).length,
  }), [db, studentById, me.admin]);

  const linked = me.admin?.linkedStudentId ? studentById.get(me.admin.linkedStudentId) : null;
  const sidebarExtra = me.role === ROLES.SPOC && linked ? (
    <button
      type="button"
      onClick={async () => {
        const res = await switchToStudent();
        if (res.ok) {
          navigate('/student/opportunities');
          toast.info('Switched to candidate feed', `You are now browsing as ${linked.name} (${linked.roll}).`);
        } else {
          toast.error('Could not switch', res.error);
        }
      }}
      className="mx-1 mt-2 flex w-[calc(100%-0.5rem)] items-start gap-2 rounded-lg border border-white/10 px-2.5 py-2 text-left text-[12px] font-medium text-white/70 hover:bg-white/[0.07] hover:text-white"
    >
      <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden /> Switch to My Candidate Feed
    </button>
  ) : null;

  const statusLine = me.role === ROLES.SPOC
    ? `Student SPOC · ${db.companies.filter((c) => c.spocId === me.admin?.id).map((c) => c.name.split(' ')[0]).slice(0, 2).join(', ')}`
    : ROLE_LABELS[me.role];

  return (
    <AppLayout
      nav={ADMIN_NAV[me.role] || []}
      badges={badges}
      role={me.role}
      user={{ name: me.name, subtitle: me.subtitle }}
      statusLine={statusLine}
      adminFeed
      sidebarExtra={sidebarExtra}
      titleFor={(p) => (p.startsWith('/admin/document-review') ? 'Document Review' : null)}
    />
  );
}
