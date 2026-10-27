import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ROLE_LABELS } from '../constants';
import { api, onUnauthorized, readStoredSession, writeStoredSession } from '../api/client';
import * as repo from '../data/repository';

const AuthContext = createContext(null);

/**
 * Session = { token, role, userId, inviteId, email, name, title, canVerify, linkedStudentId, backTo, remember }.
 * Issued by the FastAPI backend (JWT). Only @iitrpr.ac.in accounts can sign in.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  const start = useCallback((next, remember = true) => {
    const s = { ...next, remember, startedAt: new Date().toISOString() };
    writeStoredSession(s);
    setSession(s);
    return s;
  }, []);

  const attempt = useCallback(async (fn, remember) => {
    try {
      const s = await fn();
      return { ok: true, session: start(s, remember) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }, [start]);

  const login = useCallback((email, password, remember = true) => attempt(
    () => api.post('/api/auth/login', { email: email.trim(), password }, { auth: false }), remember,
  ), [attempt]);

  /** Password-less switch used by the demo account menu (server allows it only in DEMO_MODE). */
  const loginAs = useCallback((email) => attempt(
    () => api.post('/api/auth/demo-login', { email }, { auth: false }), session?.remember ?? true,
  ), [attempt, session]);

  const loginWithGoogle = useCallback((credential, remember = true) => attempt(
    () => api.post('/api/auth/google', { credential }, { auth: false }), remember,
  ), [attempt]);

  const activate = useCallback((token, password) => attempt(
    () => api.post('/api/auth/activate', { token, password }, { auth: false }), true,
  ), [attempt]);

  /** A SPOC jumps to their own candidate feed (and back). */
  const switchToStudent = useCallback(() => attempt(() => api.post('/api/auth/switch-to-student'), session?.remember ?? true), [attempt, session]);
  const switchBack = useCallback(() => attempt(() => api.post('/api/auth/switch-back'), session?.remember ?? true), [attempt, session]);

  /** Re-read the session from the server (e.g. after accepting an invitation creates the profile). */
  const refreshSession = useCallback(async () => {
    const current = readStoredSession();
    if (!current?.token) return null;
    const me = await api.get('/api/auth/me');
    return start({ ...me, token: current.token }, current.remember ?? true);
  }, [start]);

  const updateSession = useCallback((patch) => {
    setSession((prev) => {
      const next = { ...prev, ...patch };
      writeStoredSession(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    writeStoredSession(null);
    setSession(null);
    repo.stopSync();
    repo.clear();
  }, []);

  useEffect(() => {
    onUnauthorized(() => logout());
  }, [logout]);

  const value = useMemo(() => ({
    session, login, loginAs, loginWithGoogle, activate, switchToStudent, switchBack, refreshSession, logout, updateSession,
  }), [session, login, loginAs, loginWithGoogle, activate, switchToStudent, switchBack, refreshSession, logout, updateSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { ROLE_LABELS };
