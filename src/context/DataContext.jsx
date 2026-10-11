import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import * as repo from '../data/mockRepository';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const db = useSyncExternalStore(repo.subscribe, repo.getState);

  // Lookup maps rebuilt only when the dataset changes.
  const indexes = useMemo(() => ({
    studentById: new Map(db.students.map((s) => [s.id, s])),
    driveById: new Map(db.drives.map((d) => [d.id, d])),
    companyById: new Map(db.companies.map((c) => [c.id, c])),
    docById: new Map(db.documents.map((d) => [d.id, d])),
    adminById: new Map(db.adminUsers.map((u) => [u.id, u])),
  }), [db]);

  const value = useMemo(() => ({ db, ...indexes, repo }), [db, indexes]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
