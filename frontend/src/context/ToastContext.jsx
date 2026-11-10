import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message, type }].slice(-4));
    timers.current.set(id, window.setTimeout(() => dismissToast(id), 4500));
    return id;
  }, [dismissToast]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions removals"
        className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:top-5"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${
              toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
            }`}
          >
            <span aria-hidden="true" className="text-base">
              {toast.type === 'error' ? '!' : '✓'}
            </span>
            <p className="min-w-0 flex-1 leading-5">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider.');
  return context;
}
