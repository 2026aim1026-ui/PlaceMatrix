import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeftCircle } from 'lucide-react';
import AppLayout from './AppLayout';
import { STUDENT_NAV } from '../../constants/navigation';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { VERIFICATION } from '../../constants';

function EndStaleSession() {
  const { logout } = useAuth();
  useEffect(() => { logout(); }, [logout]);
  return null;
}

const INVITE_NAV = [{ section: 'Onboarding', items: [{ to: '/student/invitation', label: 'Placement Invitation', icon: Mail }] }];

export default function StudentLayout() {
  const me = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { session, switchBack } = useAuth();

  // Session points to a student that no longer exists (e.g. after a data reset).
  if (!me.student && !me.invite) return <EndStaleSession />;

  // Invited but not yet registered: only the invitation page is available.
  if (!me.student) {
    if (location.pathname !== '/student/invitation') return <Navigate to="/student/invitation" replace />;
  } else if (location.pathname === '/student/invitation') {
    return <Navigate to="/student/dashboard" replace />;
  }

  const s = me.student;
  const statusLine = s
    ? `Student · ${s.verification === VERIFICATION.VERIFIED ? 'Verified' : s.verification === VERIFICATION.PENDING ? 'Under audit' : 'Profile open'} / ${s.locked ? 'Locked' : 'Editable'}`
    : 'New student · Invited';

  // A student SPOC browsing their own candidate feed can jump back to the SPOC workspace.
  const sidebarExtra = session?.backTo ? (
    <button
      type="button"
      onClick={async () => {
        const res = await switchBack();
        if (res.ok) {
          navigate('/admin/spoc/companies');
          toast.info('Back to SPOC workspace');
        } else {
          toast.error('Could not switch back', res.error);
        }
      }}
      className="mx-1 mt-2 flex w-[calc(100%-0.5rem)] items-start gap-2 rounded-lg border border-white/10 px-2.5 py-2 text-left text-[12px] font-medium text-white/70 hover:bg-white/[0.07] hover:text-white"
    >
      <ArrowLeftCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden /> Back to SPOC workspace
    </button>
  ) : null;

  return (
    <AppLayout
      sidebarExtra={sidebarExtra}
      nav={s ? STUDENT_NAV : INVITE_NAV}
      role="STUDENT"
      user={{ name: me.name, subtitle: me.subtitle }}
      statusLine={statusLine}
      notificationUserId={s?.id}
      titleFor={(p) => (p.includes('/confirmation') ? 'Application Confirmed' : p.startsWith('/student/opportunities/') ? 'Opportunity Details' : null)}
    />
  );
}
