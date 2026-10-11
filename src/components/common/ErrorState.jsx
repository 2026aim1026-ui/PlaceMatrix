import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ErrorState({ title = 'Something went wrong', description, backTo, backLabel = 'Go back' }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center" role="alert">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-50 text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {backTo && <Link to={backTo} className="btn btn-secondary mt-5">{backLabel}</Link>}
    </div>
  );
}
