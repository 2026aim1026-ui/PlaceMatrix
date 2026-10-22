import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';
import AppLayout from './AppLayout';
import { STUDENT_NAV } from '../../constants/navigation';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useAuth } from '../../context/AuthContext';
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

  return (
    <AppLayout
      nav={s ? STUDENT_NAV : INVITE_NAV}
      role="STUDENT"
      user={{ name: me.name, subtitle: me.subtitle }}
      statusLine={statusLine}
      notificationUserId={s?.id}
      titleFor={(p) => (p.includes('/confirmation') ? 'Application Confirmed' : p.startsWith('/student/opportunities/') ? 'Opportunity Details' : null)}
    />
  );
}
