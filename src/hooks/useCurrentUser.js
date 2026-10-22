import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ROLES, ROLE_LABELS } from '../constants';

/**
 * The signed-in actor, resolved against live data.
 * `actor` is the { id, name, role } object passed to repository calls for the audit log.
 */
export function useCurrentUser() {
  const { session } = useAuth();
  const { db, studentById, adminById } = useData();

  return useMemo(() => {
    if (!session) return { session: null };
    if (session.role === ROLES.STUDENT) {
      const student = session.userId ? studentById.get(session.userId) : null;
      const invite = session.inviteId ? db.invitations.find((i) => i.id === session.inviteId) : null;
      const name = student?.name || invite?.name || 'Student';
      return {
        session,
        role: ROLES.STUDENT,
        student,
        invite,
        name,
        subtitle: student ? `${student.roll} · Student` : `${invite?.entryNo || ''} · Invited`,
        actor: { id: student?.id || invite?.id, name, role: ROLES.STUDENT },
      };
    }
    const admin = adminById.get(session.userId);
    return {
      session,
      role: session.role,
      admin,
      name: admin?.name || ROLE_LABELS[session.role],
      subtitle: admin?.title || ROLE_LABELS[session.role],
      actor: { id: admin?.id, name: admin?.name || ROLE_LABELS[session.role], role: session.role },
    };
  }, [session, db, studentById, adminById]);
}
