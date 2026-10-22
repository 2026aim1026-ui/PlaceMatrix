import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { STORAGE_KEYS, ROLES, ROLE_LABELS } from '../constants';
import { DEMO_PASSWORD } from '../data/seedData';
import { getState } from '../data/mockRepository';

const AuthContext = createContext(null);

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION) || sessionStorage.getItem(STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session, remember) {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION);
    if (session) (remember ? localStorage : sessionStorage).setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  } catch {
    /* storage unavailable: session lives in memory only */
  }
}

/**
 * Resolve an email to a session. Mock authentication only — every demo account uses the same password.
 * Students, admin users and invited (not yet registered) students can sign in.
 */
function resolveAccount(email) {
  const db = getState();
  const e = email.trim().toLowerCase();
  const admin = db.adminUsers.find((u) => u.email.toLowerCase() === e);
  if (admin) return { role: admin.role, userId: admin.id };
  const student = db.students.find((s) => s.email.toLowerCase() === e);
  if (student) return { role: ROLES.STUDENT, userId: student.id };
  const invite = db.invitations.find((i) => i.email.toLowerCase() === e);
  if (invite?.status === 'INVITED') return { role: ROLES.STUDENT, userId: null, inviteId: invite.id };
  if (invite?.status === 'DECLINED') return { error: 'This invitation was declined. Ask CCPC to re-invite you.' };
  if (invite?.status === 'NOT_INVITED') return { error: 'You have not been invited yet. Placement invitations are sent by CCPC.' };
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  const start = useCallback((next, remember = true) => {
    const s = { ...next, remember, startedAt: new Date().toISOString() };
    writeSession(s, remember);
    setSession(s);
    return s;
  }, []);

  const login = useCallback((email, password, remember) => {
    const account = resolveAccount(email);
    if (!account) return { ok: false, error: 'No account found for this college email.' };
    if (account.error) return { ok: false, error: account.error };
    if (password !== DEMO_PASSWORD) return { ok: false, error: 'Incorrect password. Demo accounts use "demo123".' };
    return { ok: true, session: start(account, remember) };
  }, [start]);

  const loginAs = useCallback((email) => {
    const account = resolveAccount(email);
    if (!account || account.error) return { ok: false, error: account?.error || 'Account not found' };
    return { ok: true, session: start(account, session?.remember ?? true) };
  }, [start, session]);

  const updateSession = useCallback((patch) => {
    setSession((prev) => {
      const next = { ...prev, ...patch };
      writeSession(next, prev?.remember ?? true);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    writeSession(null);
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, login, loginAs, logout, updateSession }), [session, login, loginAs, logout, updateSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { ROLE_LABELS };
