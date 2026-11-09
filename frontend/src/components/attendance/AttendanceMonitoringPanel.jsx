import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';

const statusStyles = {
  present: 'attendance-status-present bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  late: 'attendance-status-late bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  absent: 'attendance-status-absent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AttendanceMonitoringPanel({
  getIdToken,
  apiBaseUrl = '/api',
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/attendance/group-summary', {
        getIdToken,
        apiBaseUrl,
      });
      setSummary(result);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getIdToken]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function updateStatus(member, status) {
    const previous = summary;
    setError('');
    setNotice('');
    setSavingId(String(member.userId));
    setSummary((current) => ({
      ...current,
      members: current.members.map((item) =>
        String(item.userId) === String(member.userId) ? { ...item, status } : item
      ),
    }));
    try {
      await apiRequest(`/attendance/status/${member.userId}`, {
        getIdToken,
        apiBaseUrl,
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(`Updated ${member.name} to ${status}.`);
    } catch (saveError) {
      setSummary(previous);
      setError(getErrorMessage(saveError));
    } finally {
      setSavingId('');
    }
  }

  const members = summary?.members || [];

  return (
    <section
      id="attendance-monitoring"
      className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">KSP Leader tools</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">Attendance monitoring</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            {summary?.group?.name || 'Your assigned group'} · {summary?.date || 'Today'}
          </p>
        </div>
        <button
          type="button"
          onClick={loadSummary}
          disabled={loading}
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Present: {members.filter((member) => member.status === 'present').length}
        </span>
        <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-200">
          Late: {members.filter((member) => member.status === 'late').length}
        </span>
        <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
          Absent: {members.filter((member) => member.status === 'absent').length}
        </span>
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p>}
      {loading ? (
        <p role="status" className="py-6 text-center text-sm text-slate-500">Loading attendance…</p>
      ) : error && !summary ? null : members.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          No active members are assigned to this group.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-3 py-3 font-semibold">Member</th>
                <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                <th scope="col" className="px-3 py-3 font-semibold">Check-in</th>
                <th scope="col" className="px-3 py-3 font-semibold">Update status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {members.map((member) => (
                <tr key={member.userId}>
                  <th scope="row" className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-100">
                    <span className="block max-w-[14rem] truncate">{member.name}</span>
                    {member.secondaryDesignation && (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-300">
                        {member.secondaryDesignation}
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-3">
                    <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold capitalize ${statusStyles[member.status] || statusStyles.absent}`}>
                      {member.status}
                    </span>
                    {member.method === 'qr' && member.status === 'present' && (
                      <span className="ml-2 whitespace-nowrap text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">QR scan</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 dark:text-slate-300">
                    {member.method === 'qr' ? formatTime(member.checkedInAt) : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <label className="sr-only" htmlFor={`attendance-status-${member.userId}`}>
                      Update {member.name} attendance status
                    </label>
                    <select
                      id={`attendance-status-${member.userId}`}
                      value={member.status}
                      disabled={savingId === String(member.userId)}
                      onChange={(event) => updateStatus(member, event.target.value)}
                      className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700 outline-none focus:border-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:w-32"
                    >
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
