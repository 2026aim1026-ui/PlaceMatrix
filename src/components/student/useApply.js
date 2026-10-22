import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';

/** Submit an application and route to its confirmation page. */
export function useApply() {
  const { repo } = useData();
  const toast = useToast();
  const me = useCurrentUser();
  const navigate = useNavigate();
  return (driveId, resumeId) => {
    const res = repo.applyToDrive(me.actor, me.student.id, driveId, resumeId);
    if (!res.ok) {
      toast.error('Could not apply', res.error);
      return false;
    }
    toast.success('Application submitted');
    navigate(`/student/applications/${res.result.id}/confirmation`);
    return true;
  };
}
