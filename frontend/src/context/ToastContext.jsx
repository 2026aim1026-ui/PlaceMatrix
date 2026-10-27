import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CheckCircle2, cls: 'text-success' },
  error: { icon: XCircle, cls: 'text-danger' },
  warning: { icon: AlertTriangle, cls: 'text-warning' },
  info: { icon: Info, cls: 'text-brand' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((type, title, message) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((t) => [...t.slice(-3), { id, type, title, message }]);
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : 4000);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (title, message) => push('success', title, message),
    error: (title, message) => push('error', title, message),
    warning: (title, message) => push('warning', title, message),
    info: (title, message) => push('info', title, message),
    /**
     * Show the outcome of a repository call and return whether it succeeded.
     * Accepts a result or a promise of one (API calls); returns a boolean or a promise of one.
     */
    result: (res, successTitle, successMessage) => {
      const show = (r) => {
        if (r.ok) push('success', successTitle, successMessage);
        else push('error', 'Action not completed', r.error);
        return r.ok;
      };
      return res && typeof res.then === 'function' ? res.then(show) : show(res);
    },
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end" aria-live="polite" role="status">
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLES[t.type];
          return (
            <div key={t.id} className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-white p-3 shadow-pop">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${cls}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-ink-soft">{t.message}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Dismiss notification">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
