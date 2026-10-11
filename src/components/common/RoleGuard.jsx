import { Outlet } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { can, ROLE_HOME } from '../../constants/permissions';
import { ROLE_LABELS } from '../../constants';
import ErrorState from './ErrorState';

/** Renders child routes only when the current role holds `permission`. */
export default function RoleGuard({ permission, children }) {
  const { session } = useAuth();
  if (!can(session?.role, permission)) {
    return (
      <ErrorState
        title="Not available for your role"
        description={`The ${ROLE_LABELS[session?.role] || 'current'} view does not include this page. Switch accounts from the profile menu to explore other roles.`}
        backTo={ROLE_HOME[session?.role] || '/login'}
        backLabel="Back to my desk"
        icon={ShieldOff}
      />
    );
  }
  return children || <Outlet />;
}
