import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/permissions';

export default function NotFound({ inline = false }) {
  const { session } = useAuth();
  const home = session ? ROLE_HOME[session.role] : '/login';
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${inline ? 'py-20' : 'min-h-screen bg-canvas'}`}>
      <p className="text-5xl font-extrabold text-brand">404</p>
      <p className="mt-3 text-lg font-semibold text-ink">Page not found</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">The page you are looking for does not exist or has moved.</p>
      <Link to={home} className="btn btn-primary mt-6">Go to my dashboard</Link>
    </div>
  );
}
