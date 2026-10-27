import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { RefreshCcw, ServerCrash } from 'lucide-react';
import * as repo from '../data/repository';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

function FullPage({ children }) {
  return <div className="flex min-h-screen items-center justify-center bg-canvas px-4">{children}</div>;
}

/**
 * Loads the role-scoped snapshot from the API for the signed-in user, keeps it in sync, and exposes
 * lookup maps. Routes render only once the snapshot for the current session has arrived.
 */
export function DataProvider({ children }) {
  const { session, logout } = useAuth();
  const db = useSyncExternalStore(repo.subscribe, repo.getState);
  const config = useSyncExternalStore(repo.subscribe, repo.getConfig);
  const [readyToken, setReadyToken] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const token = session?.token || null;

  useEffect(() => {
    repo.loadConfig();
  }, []);

  useEffect(() => {
    if (!token) {
      repo.stopSync();
      repo.clear();
      setReadyToken(null);
      return undefined;
    }
    let cancelled = false;
    setLoadError('');
    repo.refresh()
      .then(() => {
        if (cancelled) return;
        setReadyToken(token);
        repo.startSync();
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => { cancelled = true; };
  }, [token, attempt]);

  // Lookup maps rebuilt only when the dataset changes.
  const indexes = useMemo(() => ({
    studentById: new Map(db.students.map((s) => [s.id, s])),
    driveById: new Map(db.drives.map((d) => [d.id, d])),
    companyById: new Map(db.companies.map((c) => [c.id, c])),
    docById: new Map(db.documents.map((d) => [d.id, d])),
    adminById: new Map(db.adminUsers.map((u) => [u.id, u])),
  }), [db]);

  const value = useMemo(() => ({ db, ...indexes, repo, config }), [db, indexes, config]);

  if (token && readyToken !== token) {
    return (
      <FullPage>
        {loadError ? (
          <div className="card max-w-md p-6 text-center" role="alert">
            <ServerCrash className="mx-auto mb-3 h-8 w-8 text-danger" aria-hidden />
            <p className="font-semibold text-ink">Could not load PlaceMatrix data</p>
            <p className="mt-1 text-sm text-ink-muted">{loadError}</p>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}><RefreshCcw className="h-4 w-4" /> Retry</button>
              <button type="button" className="btn btn-secondary" onClick={logout}>Sign out</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-ink-muted" role="status">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand/25 border-t-brand" aria-hidden />
            Loading your workspace…
          </div>
        )}
      </FullPage>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
