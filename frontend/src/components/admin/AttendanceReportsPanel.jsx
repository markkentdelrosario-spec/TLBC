import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';
import { downloadCsv } from '../../utils/downloadCsv';
import '../../styles/print.css';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function AttendanceReportsPanel({ getIdToken, apiBaseUrl }) {
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest(
        `/analytics/monthly-sundays?month=${encodeURIComponent(month)}`,
        { getIdToken, apiBaseUrl }
      );
      setReport(result);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getIdToken, month]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function exportCsv() {
    if (!report) return;
    const rows = [
      ['Date', 'Member', 'Secondary designation', 'Attendance status'],
      ...(report.rows || []).map((row) => [
        row.date,
        row.memberName,
        row.secondaryDesignation,
        row.status.charAt(0).toUpperCase() + row.status.slice(1),
      ]),
    ];
    downloadCsv(`tlbc-attendance-${month}.csv`, rows);
  }

  return (
    <section id="reports" className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg sm:p-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="no-print flex flex-col gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-700">Analytics</p>
          <h2 className="mt-1 text-xl font-bold">Attendance reports</h2>
          <p className="mt-1 text-sm text-slate-500">Download a spreadsheet or print / save a PDF.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="text-xs font-semibold text-slate-600">
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
            />
          </label>
          <button type="button" onClick={exportCsv} disabled={!report || loading} className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50">
            Download CSV
          </button>
          <button type="button" onClick={() => window.print()} disabled={!report || loading} className="min-h-11 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50">
            Print / Save PDF
          </button>
        </div>
      </div>
      {error && <p role="alert" className="no-print mt-4 text-sm text-red-700">{error}</p>}
      <div className="print-report mt-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Sunday attendance · {month}</h3>
        <p className="mt-1 text-sm text-slate-500">Total check-ins: {loading ? '…' : report?.totalAttendance ?? 0}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
              <tr>
                <th className="px-3 py-2">Sunday</th>
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2">Secondary designation</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(report?.rows || []).map((row) => (
                <tr key={`${row.date}-${row.memberId}`} className="text-slate-700 dark:text-slate-200">
                  <td className="whitespace-nowrap px-3 py-2">
                    {new Date(`${row.date}T00:00:00`).toLocaleDateString()}
                  </td>
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {row.memberName}
                  </th>
                  <td className="px-3 py-2">{row.secondaryDesignation || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                      row.status === 'present'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                        : row.status === 'late'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                    }`}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
              {report && !report.rows.length && (
                <tr><td colSpan="4" className="px-3 py-6 text-center text-slate-500">No active members or Sunday services found in this month.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
