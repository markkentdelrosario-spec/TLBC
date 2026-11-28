import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';

const PAGE_SIZE = 100;
const TRANSITION_MS = 300;

export default function AttendanceLeaderboardModal({
  open,
  onClose,
  getIdToken,
  apiBaseUrl = '/api',
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    const firstPage = await apiRequest(
      `/analytics/leaderboard?page=1&limit=${PAGE_SIZE}`,
      { getIdToken, apiBaseUrl }
    );
    const pages = await Promise.all(
      Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
        apiRequest(
          `/analytics/leaderboard?page=${index + 2}&limit=${PAGE_SIZE}`,
          { getIdToken, apiBaseUrl }
        )
      )
    );
    return [
      ...(firstPage.members || []),
      ...pages.flatMap((page) => page.members || []),
    ];
  }, [apiBaseUrl, getIdToken]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    loadLeaderboard()
      .then((result) => {
        if (active) setMembers(result);
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadLeaderboard, open, reloadKey]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    if (!mounted) return undefined;
    const timeout = window.setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => window.clearTimeout(timeout);
  }, [mounted, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!mounted) return null;

  const maximumCount = Math.max(1, ...members.map((member) => member.presentCount || 0));

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm transition-opacity duration-300 ease-out motion-reduce:transition-none sm:p-6 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-leaderboard-title"
        className={`flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.98] opacity-0'
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 sm:p-5 dark:border-slate-700">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Church attendance</p>
            <h2 id="attendance-leaderboard-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              Attendance leaderboard
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Present attendances for all active members.</p>
          </div>
          <button
            type="button"
            aria-label="Close attendance leaderboard"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-xl text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <p role="status" className="py-12 text-center text-sm text-slate-500">Loading all member rankings…</p>
          ) : error ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                className="mt-3 rounded-lg bg-rose-700 px-3 py-2 font-semibold text-white transition hover:bg-rose-800"
              >
                Try again
              </button>
            </div>
          ) : members.length ? (
            <ol className="space-y-3">
              {members.map((member, index) => {
                const count = member.presentCount || 0;
                return (
                  <li
                    key={member.memberId}
                    className="grid grid-cols-[2rem_minmax(5rem,10rem)_minmax(4rem,1fr)_3.5rem] items-center gap-2 sm:grid-cols-[2.5rem_minmax(8rem,14rem)_minmax(4rem,1fr)_4.5rem] sm:gap-3"
                  >
                    <span className="text-right text-xs font-bold tabular-nums text-slate-400">{index + 1}</span>
                    <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100 sm:text-sm">
                      {member.memberName}
                    </span>
                    <span className="h-5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <span
                        className={`block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${
                          index === 0
                            ? 'bg-amber-400'
                            : index === 1
                              ? 'bg-violet-500'
                              : index === 2
                                ? 'bg-emerald-500'
                                : 'bg-sky-500'
                        }`}
                        style={{ width: `${(count / maximumCount) * 100}%` }}
                      />
                    </span>
                    <span className="text-right text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">
              No active members are available for the leaderboard.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
