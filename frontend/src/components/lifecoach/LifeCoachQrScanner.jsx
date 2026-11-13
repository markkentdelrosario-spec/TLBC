import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Link } from 'react-router-dom';
import { apiRequest, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const buttonClass =
  'inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-base font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const attendanceStatusStyles = {
  present: 'attendance-status-present bg-emerald-100 text-emerald-800',
  late: 'attendance-status-late bg-orange-100 text-orange-800',
  absent: 'attendance-status-absent bg-red-100 text-red-800',
  pending: 'bg-slate-100 text-slate-600',
};

function isChurchSunday() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
  }).format(new Date()) === 'Sun';
}

function getCurrentSundayLabel() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const date = new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function LifeCoachQrScanner({
  getIdToken,
  apiBaseUrl = '/api',
  serviceName = 'Church Service',
}) {
  const { showToast } = useToast();
  const reactId = useId();
  const scannerElementId = `ksp-qr-reader-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [scannerState, setScannerState] = useState('idle');
  const [isSunday, setIsSunday] = useState(isChurchSunday);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [checkingInId, setCheckingInId] = useState('');
  const [groupSummary, setGroupSummary] = useState(null);
  const [groupSummaryLoading, setGroupSummaryLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsSunday(isChurchSunday());
    }, 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadGroupSummary = useCallback(async () => {
    setGroupSummaryLoading(true);
    try {
      const result = await apiRequest('/attendance/group-summary', {
        getIdToken,
        apiBaseUrl,
      });
      if (mountedRef.current) setGroupSummary(result);
    } finally {
      if (mountedRef.current) setGroupSummaryLoading(false);
    }
  }, [apiBaseUrl, getIdToken]);

  useEffect(() => {
    let active = true;
    loadGroupSummary().catch((summaryError) => {
      if (active) setError(getErrorMessage(summaryError));
    });
    return () => {
      active = false;
    };
  }, [loadGroupSummary]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const scanner = scannerRef.current;
      if (scanner?.isScanning) {
        scanner.stop().catch((stopError) => {
          console.error('Unable to stop QR scanner during cleanup.', stopError);
        });
      }
    };
  }, []);

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (!scanner || !scanner.isScanning) return;
    try {
      await scanner.stop();
    } finally {
      if (mountedRef.current) setScannerState('idle');
    }
  }

  async function recordAttendance({ qrToken, beneficiaryId, methodKey }) {
    if (!isChurchSunday()) {
      setError('Attendance can only be recorded on Sunday (Philippine Time).');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setCheckingInId(methodKey || 'qr');
    setError('');
    setStatus('');
    try {
      if (scannerRef.current?.isScanning) await stopScanner();
      const result = await apiRequest('/attendance/check-in', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
        body: JSON.stringify({
          ...(qrToken ? { qrToken } : { beneficiaryId }),
          serviceName,
        }),
      });
      if (!mountedRef.current) return;
      const name = result.beneficiary?.displayName || 'Beneficiary';
      setStatus(`Attendance recorded for ${name}.`);
      showToast(`Attendance recorded for ${name}.`, 'success');
      setResults([]);
      loadGroupSummary().catch((summaryError) => {
        if (mountedRef.current) setError(getErrorMessage(summaryError));
      });
    } catch (checkInError) {
      if (mountedRef.current) setError(getErrorMessage(checkInError));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setCheckingInId('');
    }
  }

  async function startScanner() {
    setError('');
    setStatus('');
    if (!isChurchSunday()) {
      setError('The QR scanner is available for attendance check-in on Sunday (Philippine Time).');
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not available. Open this page over HTTPS or use manual search.');
      }
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(scannerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = scanner;
      }
      setScannerState('starting');
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        (decodedText) => {
          if (!busyRef.current) {
            recordAttendance({ qrToken: decodedText, methodKey: 'qr' });
          }
        },
        () => {}
      );
      if (mountedRef.current) setScannerState('scanning');
    } catch (startError) {
      if (mountedRef.current) {
        setScannerState('idle');
        setError(getErrorMessage(startError));
      }
    }
  }

  async function searchBeneficiaries(event) {
    event.preventDefault();
    const searchTerm = query.trim();
    if (searchTerm.length < 2) {
      setError('Enter at least 2 characters to search.');
      return;
    }

    setSearching(true);
    setError('');
    setStatus('');
    try {
      const response = await apiRequest(
        `/attendance/search?query=${encodeURIComponent(searchTerm)}`,
        { getIdToken, apiBaseUrl }
      );
      setResults(response.beneficiaries || []);
      if (!response.beneficiaries?.length) {
        setStatus('No matching beneficiary found in your assigned group.');
      }
    } catch (searchError) {
      setError(getErrorMessage(searchError));
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            The Life Builder Church · KSP Leader QR Scanner
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Record attendance</h1>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/scanner/custom-events"
                className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-emerald-200 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                Custom events
              </Link>
              <Link
                to="/profile"
                className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Scan a member’s QR ID card to record attendance for this Sunday, or find a member manually.
          </p>
        </header>

        {!isSunday && (
          <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Attendance check-in is available only on Sundays (Philippine Time). You can still search the group roster.
          </p>
        )}
        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
            {error}
          </div>
        )}
        {status && (
          <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-900">
            {status}
          </div>
        )}

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {groupSummary?.date || getCurrentSundayLabel()}
              </p>
              <h2 className="mt-1 text-lg font-bold">
                {groupSummary?.group?.name || 'Current Sunday attendance'}
              </h2>
            </div>
            <p className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900">
              {groupSummaryLoading
                ? 'Loading…'
                : `${groupSummary?.attendanceCount || 0} / ${groupSummary?.beneficiaryCount || 0} checked in`}
            </p>
          </div>
          {groupSummary?.members?.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-semibold">Member</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Check-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupSummary.members.map((member) => (
                    <tr key={member.userId}>
                      <th scope="row" className="px-3 py-3 font-medium">{member.name}</th>
                      <td className="px-3 py-3">
                        <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-bold capitalize ${attendanceStatusStyles[member.status] || attendanceStatusStyles.absent}`}>
                          {member.status}
                        </span>
                        {member.method === 'qr' && ['present', 'late'].includes(member.status) && (
                          <span className="ml-2 whitespace-nowrap text-[10px] font-semibold text-emerald-700">QR scan</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                        {member.method === 'qr' && member.checkedInAt
                          ? new Date(member.checkedInAt).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZone: 'Asia/Manila',
                          })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Scan a QR ID card</h2>
              <p className="mt-1 text-sm text-slate-500">Use the rear camera for the clearest scan.</p>
            </div>
            {scannerState === 'scanning' ? (
              <button
                className="min-h-12 rounded-xl border border-slate-300 px-5 py-3 text-base font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => stopScanner().catch((stopError) => setError(getErrorMessage(stopError)))}
              >
                Stop camera
              </button>
            ) : (
              <button
                className={buttonClass}
                onClick={startScanner}
                disabled={!isSunday || scannerState === 'starting' || checkingInId !== ''}
              >
                {scannerState === 'starting'
                  ? 'Starting camera…'
                  : isSunday ? 'Open camera' : 'Available on Sunday'}
              </button>
            )}
          </div>
          <div
            id={scannerElementId}
            className="mx-auto mt-5 min-h-4 w-full max-w-md overflow-hidden rounded-xl bg-slate-950 [&_video]:rounded-xl"
          />
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">
            Camera permission is required. If scanning is unavailable, use manual search below.
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div>
            <h2 className="text-lg font-bold">Find a beneficiary manually</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Search by name, email, or phone number.
            </p>
          </div>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={searchBeneficiaries}>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Beneficiary name, email, or phone</span>
              <input
                className={inputClass}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                minLength={2}
                maxLength={100}
                placeholder="Enter name, email, or phone"
              />
            </label>
            <button className={buttonClass} disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {results.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {results.map((beneficiary) => {
                const person = beneficiary.user || {};
                const id = beneficiary._id || beneficiary.id;
                return (
                  <li
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{person.displayName || 'Beneficiary'}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {[person.phoneNumber, person.email]
                          .filter(Boolean)
                          .join(' · ') || beneficiary.group?.name}
                      </p>
                    </div>
                    <button
                      className={`${buttonClass} w-full sm:w-auto`}
                      disabled={!isSunday || checkingInId !== ''}
                      onClick={() =>
                        recordAttendance({ beneficiaryId: id, methodKey: id })
                      }
                    >
                      {checkingInId === id
                        ? 'Recording…'
                        : isSunday ? 'Record attendance' : 'Available on Sunday'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          Each beneficiary can be checked in once per service on the same church-local date.
        </p>
      </div>
    </main>
  );
}
