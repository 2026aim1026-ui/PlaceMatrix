import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME } from '../../constants/permissions';
import { ROLES, ADMIN_ROLES } from '../../constants';

/** Requires a session; `portal` restricts to the student or admin experience. */
export default function ProtectedRoute({ portal }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (portal === 'student' && session.role !== ROLES.STUDENT) return <Navigate to={ROLE_HOME[session.role]} replace />;
  if (portal === 'admin' && !ADMIN_ROLES.includes(session.role)) return <Navigate to={ROLE_HOME.STUDENT} replace />;
  return <Outlet />;
}
