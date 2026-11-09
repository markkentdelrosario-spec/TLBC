import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, getErrorMessage } from '../../services/api';
import ChurchDashboardShell from '../layout/ChurchDashboardShell';

export default function BeneficiaryDashboard({
  getIdToken,
  apiBaseUrl = '/api',
}) {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest('/attendance/my-summary', { getIdToken, apiBaseUrl })
      .then((result) => {
        if (active) setAttendance(result);
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
  }, [apiBaseUrl, getIdToken]);

  return (
    <ChurchDashboardShell getIdToken={getIdToken} apiBaseUrl={apiBaseUrl}>
      <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">Your journey</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Personal attendance</h2>
            <p className="mt-1 text-sm text-slate-500">
              {user?.groupName || 'Your group assignment will appear here when available.'}
            </p>
          </div>
          <div className="rounded-xl bg-violet-50 px-5 py-3 text-center">
            <p className="text-2xl font-bold text-violet-700">
              {loading ? '—' : attendance?.attendanceCount ?? 0}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Visits recorded</p>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Attendance is currently unavailable: {error}
          </p>
        )}
        {attendance?.recentAttendance?.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Service</th>
                  <th className="py-2 font-semibold">Group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {attendance.recentAttendance.map((visit) => (
                  <tr key={`${visit.date}-${visit.checkedInAt}`}>
                    <td className="py-3 pr-4 text-slate-700">
                      {new Date(`${visit.date}T00:00:00`).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{visit.serviceName}</td>
                    <td className="py-3 text-slate-600">{visit.groupName || 'Church service'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading && !error ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Your service attendance will show here after your first check-in.
          </p>
        ) : null}
      </section>
    </ChurchDashboardShell>
  );
}
