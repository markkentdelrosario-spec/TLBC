import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';
import '../../styles/print.css';
import ImageUpload from '../shared/ImageUpload';
import ChurchDashboardShell from '../layout/ChurchDashboardShell';
import { downloadCsv } from '../../utils/downloadCsv';

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentMonthString() {
  return todayString().slice(0, 7);
}

function mostRecentSunday() {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatReportDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PastorDashboard({
  getIdToken,
  apiBaseUrl = '/api',
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(todayString());
  const [summary, setSummary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString);
  const [monthlyAnalytics, setMonthlyAnalytics] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [reportDate, setReportDate] = useState(mostRecentSunday);
  const [sundayReport, setSundayReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [announcement, setAnnouncement] = useState({
    title: '',
    body: '',
    banner: null,
  });
  const canViewReports = false;

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const query = params.toString();
      const result = await apiRequest(
        `/analytics/summary${query ? `?${query}` : ''}`,
        { getIdToken, apiBaseUrl }
      );
      setSummary(result);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, endDate, getIdToken, startDate]);

  useEffect(() => {
    if (canViewReports) loadAnalytics();
  }, [loadAnalytics]);

  const loadMonthlyAnalytics = useCallback(async () => {
    setMonthlyLoading(true);
    setError('');
    try {
      const month = await apiRequest(
        `/analytics/monthly-sundays?month=${encodeURIComponent(selectedMonth)}`,
        { getIdToken, apiBaseUrl }
      );
      setMonthlyAnalytics(month);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setMonthlyLoading(false);
    }
  }, [apiBaseUrl, getIdToken, selectedMonth]);

  useEffect(() => {
    if (canViewReports) loadMonthlyAnalytics();
  }, [loadMonthlyAnalytics]);

  const groups = useMemo(() => {
    const savedGroups = summary?.groups || [];
    return [1, 2, 3].map(
      (groupNumber) =>
        savedGroups.find((group) => group.groupNumber === groupNumber) || {
          groupNumber,
          name: `Group ${groupNumber}`,
          attendanceCount: 0,
        }
    );
  }, [summary]);
  const maxAttendance = Math.max(1, ...groups.map((group) => group.attendanceCount));
  const maxSundayAttendance = Math.max(
    1,
    ...(monthlyAnalytics?.sundays || []).map((sunday) => sunday.totalAttendance)
  );

  async function loadSundayReport(event) {
    event.preventDefault();
    if (!canViewReports) return;
    if (new Date(`${reportDate}T00:00:00`).getDay() !== 0) {
      setError('Choose a Sunday for the printable attendance report.');
      return;
    }
    setReportLoading(true);
    setError('');
    setNotice('');
    setSundayReport(null);
    try {
      const result = await apiRequest(
        `/analytics/sunday-report?date=${encodeURIComponent(reportDate)}`,
        { getIdToken, apiBaseUrl }
      );
      setSundayReport(result);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setReportLoading(false);
    }
  }

  function printSundayReport() {
    if (!sundayReport) return;
    window.print();
  }

  function downloadMonthlyCsv() {
    if (!monthlyAnalytics) return;
    downloadCsv(`tlbc-attendance-${selectedMonth}.csv`, [
      ['Date', 'Group 1', 'Group 2', 'Group 3', 'Other', 'Total'],
      ...monthlyAnalytics.sundays.map((sunday) => [
        sunday.date,
        ...[1, 2, 3].map(
          (groupNumber) =>
            sunday.groups.find((group) => group.groupNumber === groupNumber)
              ?.attendanceCount || 0
        ),
        sunday.unassignedAttendance || 0,
        sunday.totalAttendance,
      ]),
      [
        'Monthly total',
        ...[1, 2, 3].map(
          (groupNumber) =>
            monthlyAnalytics.groupTotals.find(
              (group) => group.groupNumber === groupNumber
            )?.attendanceCount || 0
        ),
        monthlyAnalytics.unassignedTotal || 0,
        monthlyAnalytics.totalAttendance,
      ],
    ]);
  }

  function downloadSundayCsv() {
    if (!sundayReport) return;
    const groups = sundayReport.groups.flatMap((group) =>
      group.attendees.map((attendee) => [
        sundayReport.date,
        group.name,
        attendee.beneficiaryName,
        attendee.designation,
        attendee.checkedInAtFormatted,
        attendee.serviceName || '',
      ])
    );
    const otherAttendees = (sundayReport.unassignedAttendees || []).map(
      (attendee) => [
        sundayReport.date,
        'Other attendees',
        attendee.beneficiaryName,
        attendee.designation,
        attendee.checkedInAtFormatted,
        attendee.serviceName || '',
      ]
    );
    downloadCsv(`tlbc-sunday-report-${sundayReport.date}.csv`, [
      ['Date', 'Group', 'Member', 'Designation', 'Check-in time', 'Service'],
      ...groups,
      ...otherAttendees,
    ]);
  }

  async function createAnnouncement(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSavingAnnouncement(true);
    try {
      await apiRequest('/announcements', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
        body: JSON.stringify({
          title: announcement.title.trim(),
          body: announcement.body.trim(),
          ...(announcement.banner ? { banner: announcement.banner } : {}),
          status: 'published',
        }),
      });
      setAnnouncement({ title: '', body: '', banner: null });
      setNotice('Announcement published.');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingAnnouncement(false);
    }
  }

  return (
    <ChurchDashboardShell getIdToken={getIdToken} apiBaseUrl={apiBaseUrl}>
    <div className="min-h-screen px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            The Life Builder Church
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Pastor dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Church-wide attendance at a glance and a place to share announcements.
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {notice}
          </div>
        )}

        {canViewReports && (
        <>
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Attendance overview</h2>
              <p className="mt-1 text-sm text-slate-500">
                Recorded beneficiary check-ins across all three KSP groups.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <label className="text-xs font-semibold text-slate-600">
                From
                <input
                  type="date"
                  className={inputClass}
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                To
                <input
                  type="date"
                  className={inputClass}
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {groups.map((group) => {
              const percentage = Math.round(
                (group.attendanceCount / maxAttendance) * 100
              );
              return (
                <article
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                  key={group.groupNumber}
                >
                  <p className="text-sm font-semibold text-slate-600">
                    Group {group.groupNumber}
                  </p>
                  <h3 className="mt-1 truncate text-base font-bold">{group.name}</h3>
                  <p className="mt-5 text-3xl font-bold tabular-nums">
                    {loading ? '—' : group.attendanceCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">attendance check-ins</p>
                  <div
                    className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"
                    role="progressbar"
                    aria-label={`${group.name} attendance relative to the busiest group`}
                    aria-valuenow={percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              Total check-ins:{' '}
              <strong className="text-slate-900">
                {loading ? 'Loading…' : summary?.totalAttendance ?? 0}
              </strong>
            </p>
            <button
              className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              onClick={loadAnalytics}
              disabled={loading}
            >
              Refresh report
            </button>
          </div>
        </section>

        <section id="reports" className="no-print mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Monthly per-Sunday analytics</h2>
              <p className="mt-1 text-sm text-slate-500">
                Compare attendance at each Sunday service across all three groups.
              </p>
            </div>
            <label className="text-xs font-semibold text-slate-600 sm:w-48">
              Select month
              <input
                type="month"
                className={inputClass}
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="no-print inline-flex min-h-11 items-center justify-center rounded-lg border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
              onClick={downloadMonthlyCsv}
              disabled={!monthlyAnalytics || monthlyLoading}
            >
              Download CSV
            </button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-semibold">Sunday</th>
                  <th className="px-3 py-3 text-right font-semibold">Group 1</th>
                  <th className="px-3 py-3 text-right font-semibold">Group 2</th>
                  <th className="px-3 py-3 text-right font-semibold">Group 3</th>
                  <th className="px-3 py-3 text-right font-semibold">Other</th>
                  <th className="px-3 py-3 text-right font-semibold">Total</th>
                  <th className="w-40 px-3 py-3 font-semibold">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(monthlyAnalytics?.sundays || []).map((sunday) => (
                  <tr key={sunday.date}>
                    <th scope="row" className="whitespace-nowrap px-3 py-3 font-medium text-slate-800">
                      {formatReportDate(sunday.date)}
                    </th>
                    {[1, 2, 3].map((groupNumber) => {
                      const count = sunday.groups.find(
                        (group) => group.groupNumber === groupNumber
                      )?.attendanceCount || 0;
                      return (
                        <td key={groupNumber} className="px-3 py-3 text-right tabular-nums text-slate-700">
                          {count}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {sunday.unassignedAttendance || 0}
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">
                      {sunday.totalAttendance}
                    </td>
                    <td className="px-3 py-3">
                      <div
                        className="h-2 overflow-hidden rounded-full bg-slate-100"
                        role="img"
                        aria-label={`${sunday.totalAttendance} check-ins`}
                      >
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{
                            width: `${Math.round(
                              (sunday.totalAttendance / maxSundayAttendance) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {!monthlyLoading && (monthlyAnalytics?.sundays || []).length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                      No Sunday services found for this month.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <tr>
                  <th className="px-3 py-3">Monthly total</th>
                  {[1, 2, 3].map((groupNumber) => (
                    <td key={groupNumber} className="px-3 py-3 text-right tabular-nums">
                      {monthlyAnalytics?.groupTotals?.find(
                        (group) => group.groupNumber === groupNumber
                      )?.attendanceCount ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right tabular-nums">
                    {monthlyLoading ? '…' : monthlyAnalytics?.unassignedTotal ?? 0}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {monthlyLoading ? '…' : monthlyAnalytics?.totalAttendance ?? 0}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
            {monthlyLoading && (
              <p className="py-5 text-center text-sm text-slate-500">
                Loading monthly analytics…
              </p>
            )}
          </div>
        </section>

        <section className="no-print mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-xl font-bold">Printable Sunday attendance report</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a Sunday service date to load the attendee list for printing.
            </p>
          </div>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={loadSundayReport}
          >
            <label className="text-xs font-semibold text-slate-600 sm:w-64">
              Sunday service date
              <input
                type="date"
                className={inputClass}
                value={reportDate}
                onChange={(event) => {
                  setReportDate(event.target.value);
                  setSundayReport(null);
                }}
                required
              />
            </label>
            <button className={buttonClass} disabled={reportLoading}>
              {reportLoading ? 'Loading report…' : 'Load Sunday report'}
            </button>
            <button
              type="button"
              className="no-print inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={printSundayReport}
              disabled={!sundayReport}
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              className="no-print inline-flex min-h-11 items-center justify-center rounded-lg border border-violet-200 px-5 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={downloadSundayCsv}
              disabled={!sundayReport}
            >
              Download CSV
            </button>
          </form>
        </section>

        {sundayReport && (
          <section className="print-report mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <header className="mb-6 border-b border-slate-300 pb-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
                The Life Builder Church
              </p>
              <h2 className="mt-2 text-2xl font-bold text-black">
                Sunday Attendance Report
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                {formatReportDate(sundayReport.date)}
                {sundayReport.timeZone ? ` · ${sundayReport.timeZone}` : ''}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                Total attendance: {sundayReport.totalAttendance}
              </p>
            </header>

            <div className="space-y-6">
              {sundayReport.groups.map((group) => (
                <section key={group.groupNumber}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="text-base font-bold text-black">
                      Group {group.groupNumber}: {group.name}
                    </h3>
                    <p className="text-sm font-semibold text-slate-700">
                      {group.attendanceCount} attendee{group.attendanceCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Beneficiary name</th>
                        <th scope="col">Designation</th>
                        <th scope="col">Check-in time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.attendees.map((attendee, index) => (
                        <tr key={`${group.groupNumber}-${attendee.beneficiaryName}-${attendee.checkedInAt}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{attendee.beneficiaryName}</td>
                          <td>{attendee.designation}</td>
                          <td>{attendee.checkedInAtFormatted}</td>
                        </tr>
                      ))}
                      {group.attendees.length === 0 && (
                        <tr>
                          <td colSpan="4" className="text-center text-slate-600">
                            No attendance recorded for this group.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              ))}
              {sundayReport.unassignedAttendees?.length > 0 && (
                <section>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h3 className="text-base font-bold text-black">Other attendees</h3>
                    <p className="text-sm font-semibold text-slate-700">
                      {sundayReport.unassignedAttendees.length} attendee
                      {sundayReport.unassignedAttendees.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Member name</th>
                        <th scope="col">Designation</th>
                        <th scope="col">Check-in time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sundayReport.unassignedAttendees.map((attendee, index) => (
                        <tr key={`${attendee.beneficiaryName}-${attendee.checkedInAt}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{attendee.beneficiaryName}</td>
                          <td>{attendee.designation}</td>
                          <td>{attendee.checkedInAtFormatted}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </div>
            <footer className="mt-8 border-t border-slate-300 pt-3 text-xs text-slate-600">
              Generated from recorded church service check-ins.
            </footer>
          </section>
        )}
        </>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold">Create an announcement</h2>
            <p className="mt-1 text-sm text-slate-500">
              Share a church update with the congregation.
            </p>
            <form className="mt-5 space-y-4" onSubmit={createAnnouncement}>
              <label className="block text-sm font-semibold text-slate-700">
                Announcement title
                <input
                  className={inputClass}
                  required
                  maxLength={160}
                  value={announcement.title}
                  onChange={(event) =>
                    setAnnouncement((value) => ({ ...value, title: event.target.value }))
                  }
                  placeholder="e.g. Sunday service schedule"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Message
                <textarea
                  className={`${inputClass} min-h-36 resize-y`}
                  required
                  maxLength={10000}
                  value={announcement.body}
                  onChange={(event) =>
                    setAnnouncement((value) => ({ ...value, body: event.target.value }))
                  }
                  placeholder="Write the announcement for your church…"
                />
              </label>
              <ImageUpload
                getIdToken={getIdToken}
                apiBaseUrl={apiBaseUrl}
                folder="announcement-banners"
                label="Announcement banner (optional)"
                onUploaded={(image) =>
                  setAnnouncement((value) => ({
                    ...value,
                    banner: {
                      url: image.secure_url,
                      publicId: image.public_id,
                    },
                  }))
                }
              />
              {announcement.banner && (
                <div className="space-y-2">
                  <img
                    src={announcement.banner.url}
                    alt="Announcement banner preview"
                    className="max-h-56 w-full rounded-xl border border-slate-200 object-cover"
                  />
                  <button
                    type="button"
                    className="text-sm font-semibold text-red-700 underline"
                    onClick={() =>
                      setAnnouncement((value) => ({ ...value, banner: null }))
                    }
                  >
                    Remove banner
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Published announcements are visible to signed-in users.</span>
                <button className={buttonClass} disabled={savingAnnouncement}>
                  {savingAnnouncement ? 'Publishing…' : 'Publish announcement'}
                </button>
              </div>
            </form>
          </div>

          <aside className="rounded-2xl bg-emerald-950 p-6 text-white shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-200">
              Reporting note
            </p>
            <h2 className="mt-3 text-2xl font-bold">Attendance, made clear.</h2>
            <p className="mt-3 text-sm leading-6 text-emerald-100">
              Use the date range to focus reports on a service period. Counts represent recorded check-ins, not unique visitors across multiple dates.
            </p>
            <p className="mt-6 border-t border-emerald-800 pt-4 text-xs leading-5 text-emerald-200">
              This view is limited to church attendance analytics across the three KSP groups.
            </p>
          </aside>
        </section>
      </div>
    </div>
    </ChurchDashboardShell>
  );
}
