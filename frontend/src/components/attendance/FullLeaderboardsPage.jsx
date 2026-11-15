import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import ChurchDashboardShell from '../layout/ChurchDashboardShell';
import PaginationControls from '../shared/PaginationControls';

export default function FullLeaderboardsPage({
  getIdToken,
  apiBaseUrl = '/api',
  embedded = false,
  resetKey = 0,
}) {
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async (requestedPage = 1) => {
    const result = await apiRequest(
      `/analytics/leaderboard?page=${requestedPage}&limit=10`,
      { getIdToken, apiBaseUrl }
    );
    setMembers(result.members || []);
    setPage(result.page || requestedPage);
    setTotalPages(result.totalPages || 1);
  }, [apiBaseUrl, getIdToken]);

  useEffect(() => {
    let active = true;
    loadLeaderboard()
      .catch((error) => {
        if (active) showToast(getErrorMessage(error), 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadLeaderboard, resetKey, showToast]);

  useEffect(() => {
    let active = true;
    async function refreshLeaderboard() {
      try {
        if (active) await loadLeaderboard(page);
      } catch (error) {
        if (active) showToast(getErrorMessage(error), 'error');
      }
    }
    window.addEventListener('tlbc:attendance-recorded', refreshLeaderboard);
    return () => {
      active = false;
      window.removeEventListener('tlbc:attendance-recorded', refreshLeaderboard);
    };
  }, [loadLeaderboard, page, showToast]);

  const content = (
      <section id={embedded ? 'full-leaderboards' : undefined} className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">Church attendance</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Full Leaderboards</h1>
        <p className="mt-1 text-sm text-slate-500">Members ranked by Present attendance, highest to least.</p>
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-slate-500">Loading member rankings…</p>
        ) : members.length ? (
          <>
            <ol className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((member, index) => {
                const rank = (page - 1) * 10 + index + 1;
                return (
                  <li key={member.memberId} className="flex min-h-14 items-center gap-3 py-2">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      rank === 1
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                        : rank === 2
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100'
                          : rank === 3
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200'
                            : 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200'
                    }`}>
                      {rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {member.memberName}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {member.presentCount} Present
                    </span>
                  </li>
                );
              })}
            </ol>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              onPageChange={(nextPage) => loadLeaderboard(nextPage).catch((error) => showToast(getErrorMessage(error), 'error'))}
              label="Leaderboard pages"
            />
          </>
        ) : (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">
            No active members are available for the leaderboard.
          </p>
        )}
      </section>
  );

  if (embedded) return content;
  return (
    <ChurchDashboardShell getIdToken={getIdToken} apiBaseUrl={apiBaseUrl}>
      {content}
    </ChurchDashboardShell>
  );
}
