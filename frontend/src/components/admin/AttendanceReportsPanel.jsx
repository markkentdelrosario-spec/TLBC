import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import FilePreviewModal from '../shared/FilePreviewModal';
import '../../styles/print.css';

function currentMonth() {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );
  return `${values.year}-${values.month}`;
}

function currentSunday() {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map(({ type, value }) => [type, value])
  );
  const date = new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

function isSundayDate(value) {
  return new Date(`${value}T00:00:00.000Z`).getUTCDay() === 0;
}

function formatSundayDate(value) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function AttendanceReportsPanel({ getIdToken, apiBaseUrl }) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [reportType, setReportType] = useState('monthly');
  const [month, setMonth] = useState(currentMonth);
  const [sundayDate, setSundayDate] = useState(currentSunday);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const reportRequestVersion = useRef(0);

  const loadReport = useCallback(async () => {
    if (reportType === 'sunday' && !sundayDate) return;
    const requestVersion = ++reportRequestVersion.current;
    setLoading(true);
    setReport(null);
    try {
      const path = reportType === 'sunday'
        ? `/analytics/sunday-report?date=${encodeURIComponent(sundayDate)}`
        : `/analytics/monthly-sundays?month=${encodeURIComponent(month)}`;
      const result = await apiRequest(path, { getIdToken, apiBaseUrl });
      if (requestVersion === reportRequestVersion.current) setReport(result);
    } catch (requestError) {
      if (requestVersion === reportRequestVersion.current) {
        showToast(getErrorMessage(requestError), 'error');
      }
    } finally {
      if (requestVersion === reportRequestVersion.current) setLoading(false);
    }
  }, [apiBaseUrl, getIdToken, month, reportType, showToast, sundayDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    const refreshReport = () => {
      loadReport();
    };
    window.addEventListener('tlbc:attendance-recorded', refreshReport);
    return () =>
      window.removeEventListener('tlbc:attendance-recorded', refreshReport);
  }, [loadReport]);

  const sundayAttendees = useMemo(
    () => [
      ...(report?.groups || []).flatMap((group) =>
        (group.attendees || []).map((attendee) => ({
          ...attendee,
          groupName: group.name,
        }))
      ),
      ...(report?.unassignedAttendees || []).map((attendee) => ({
        ...attendee,
        groupName: 'Unassigned',
      })),
    ],
    [report]
  );

  const exportRows = useMemo(() => {
    if (reportType === 'sunday') {
      return [
        ['Date', 'Member', 'Group', 'Secondary designation', 'Attendance status', 'Check-in time', 'Service'],
        ...sundayAttendees.map((attendee) => [
          report?.date || sundayDate,
          attendee.beneficiaryName,
          attendee.groupName,
          attendee.designation,
          (attendee.status || 'present').charAt(0).toUpperCase() +
            (attendee.status || 'present').slice(1),
          attendee.checkedInAtFormatted || '',
          attendee.serviceName || '',
        ]),
      ];
    }

    return [
      ['Date', 'Member', 'Secondary designation', 'Attendance status'],
      ...((report?.rows) || []).map((row) => [
        row.date,
        row.memberName,
        row.secondaryDesignation,
        row.status.charAt(0).toUpperCase() + row.status.slice(1),
      ]),
    ];
  }, [report, reportType, sundayAttendees, sundayDate]);

  function openFilePreview(format) {
    if (!report) return;
    const reportTitle = reportType === 'sunday'
      ? `Sunday service attendance · ${formatSundayDate(sundayDate)}`
      : `Monthly Sunday attendance · ${month}`;
    const statuses = reportType === 'sunday'
      ? sundayAttendees.map((attendee) => attendee.status || 'present')
      : (report.rows || []).map((row) => row.status);
    setFilePreview({
      format,
      filename: reportType === 'sunday'
        ? `tlbc-sunday-attendance-${sundayDate}.${format}`
        : `tlbc-monthly-attendance-${month}.${format}`,
      title: reportTitle,
      rows: exportRows,
      metadata: {
        preparedBy: [user?.name || user?.displayName, user?.email].filter(Boolean).join(' · ') || 'Administrator',
        summary: [
          { label: 'Total check-ins', value: report.totalAttendance ?? statuses.length },
          { label: 'Present', value: statuses.filter((status) => status === 'present').length },
          { label: 'Late', value: statuses.filter((status) => status === 'late').length },
          { label: 'Absent', value: statuses.filter((status) => status === 'absent').length },
        ],
      },
    });
  }

  const sundays = useMemo(
    () => (report?.sundayDates || []).map((date) => {
      const rows = (report?.rows || []).filter((row) => row.date === date);
      return {
        date,
        upcoming: rows.some((row) => row.status === 'upcoming'),
        groups: {
          present: rows.filter((row) => row.status === 'present'),
          late: rows.filter((row) => row.status === 'late'),
          absent: rows.filter((row) => row.status === 'absent'),
        },
      };
    }),
    [report]
  );
  const statusPartitions = [
    { key: 'present', label: 'Present', style: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200' },
    { key: 'late', label: 'Late', style: 'bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200' },
    { key: 'absent', label: 'Absent', style: 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200' },
  ];

  return (
    <section id="reports" className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-lg sm:p-6 dark:border-slate-700 dark:bg-slate-900">
      <div className="no-print flex flex-col gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-700">Analytics</p>
          <h2 className="mt-1 text-xl font-bold">Attendance reports</h2>
          <p className="mt-1 text-sm text-slate-500">Preview the report before downloading it as a spreadsheet or PDF.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="text-xs font-semibold text-slate-600">
            Report type
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
            >
              <option value="sunday">Sunday service only</option>
              <option value="monthly">Monthly report</option>
            </select>
          </label>
          {reportType === 'sunday' ? (
            <label className="text-xs font-semibold text-slate-600">
              Sunday service date
              <input
                type="date"
                value={sundayDate}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value && !isSundayDate(value)) {
                    showToast('Choose a Sunday for the service report.', 'error');
                    return;
                  }
                  if (value) setSundayDate(value);
                }}
                className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
              />
            </label>
          ) : (
            <label className="text-xs font-semibold text-slate-600">
              Month
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:w-auto"
              />
            </label>
          )}
          <button type="button" onClick={() => openFilePreview('csv')} disabled={!report || loading} className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50">
            Preview CSV
          </button>
          <button type="button" onClick={() => openFilePreview('pdf')} disabled={!report || loading} className="min-h-11 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:opacity-50">
            Preview PDF
          </button>
        </div>
      </div>
      <div className="print-report mt-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {reportType === 'sunday'
            ? `Sunday service attendance · ${formatSundayDate(sundayDate)}`
            : `Monthly Sunday attendance · ${month}`}
        </h3>
        <p className="mt-1 text-sm text-slate-500">Total check-ins: {loading ? '…' : report?.totalAttendance ?? 0}</p>
        {loading && !report ? (
          <p role="status" className="mt-4 py-6 text-center text-sm text-slate-500">
            {reportType === 'sunday' ? 'Loading Sunday service attendance…' : 'Loading monthly attendance…'}
          </p>
        ) : reportType === 'sunday' && report && !sundayAttendees.length ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">No attendance has been recorded for this Sunday service.</p>
        ) : reportType === 'sunday' && report ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">Member</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Group</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Designation</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Check-in</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sundayAttendees.map((attendee, index) => (
                  <tr key={`${attendee.beneficiaryName}-${attendee.checkedInAt || index}`}>
                    <th scope="row" className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-100">{attendee.beneficiaryName}</th>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">{attendee.groupName}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">{attendee.designation}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 capitalize text-slate-600 dark:text-slate-300">{attendee.status || 'present'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">{attendee.checkedInAtFormatted || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">{attendee.serviceName || 'Church Service'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : report && !sundays.length ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">No Sundays are listed for this month.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {sundays.map((sunday) => (
              <section
                key={sunday.date}
                className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <header className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3 dark:bg-slate-800">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Sunday, {formatSundayDate(sunday.date)}
                  </h4>
                  {sunday.upcoming && (
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                      Upcoming
                    </span>
                  )}
                </header>
                <div className="grid gap-3 p-3 md:grid-cols-3">
                  {statusPartitions.map((partition) => {
                    const members = sunday.groups[partition.key];
                    return (
                      <section key={partition.key} className={`min-w-0 rounded-lg p-3 ${partition.style}`}>
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs font-bold">{partition.label}</h5>
                          <span className="text-xs font-bold tabular-nums">{members.length}</span>
                        </div>
                        {members.length ? (
                          <ul className="mt-2 space-y-1">
                            {members.map((member) => (
                              <li key={member.memberId} className="break-words text-xs">
                                <span className="font-semibold">{member.memberName}</span>
                                {member.secondaryDesignation && (
                                  <span className="ml-1 opacity-75">· {member.secondaryDesignation}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs opacity-70">
                            {sunday.upcoming ? 'Not recorded yet.' : 'No members.'}
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <FilePreviewModal
        open={Boolean(filePreview)}
        onClose={() => setFilePreview(null)}
        title={filePreview?.title || ''}
        filename={filePreview?.filename || ''}
        format={filePreview?.format}
        rows={filePreview?.rows || []}
        metadata={filePreview?.metadata}
        onDownload={() => showToast('Attendance report downloaded.', 'success')}
      />
    </section>
  );
}
