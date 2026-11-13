import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Link } from 'react-router-dom';
import { apiRequest, getErrorMessage } from '../../services/api';

const eventCategories = ['KSP Gathering', 'Seminars', 'Other'];
const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const buttonClass =
  'inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-base font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';

export default function KspCustomEvents({ getIdToken, apiBaseUrl = '/api' }) {
  const scannerElementId = `ksp-event-qr-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [category, setCategory] = useState(eventCategories[0]);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scannerState, setScannerState] = useState('idle');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const loadEvents = useCallback(async () => {
    const result = await apiRequest('/custom-events', { getIdToken, apiBaseUrl });
    setEvents(result.events || []);
    setSelectedEventId((current) =>
      current && result.events?.some((event) => event._id === current)
        ? current
        : result.events?.[0]?._id || ''
    );
  }, [apiBaseUrl, getIdToken]);

  useEffect(() => {
    let active = true;
    loadEvents()
      .catch((loadError) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      const scanner = scannerRef.current;
      if (scanner?.isScanning) {
        scanner.stop().catch((stopError) => {
          console.error('Unable to stop custom event QR scanner during cleanup.', stopError);
        });
      }
    };
  }, [loadEvents]);

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (scanner?.isScanning) await scanner.stop();
    setScannerState('idle');
  }

  async function createEvent(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    setSaving(true);
    try {
      const result = await apiRequest('/custom-events', {
        getIdToken,
        apiBaseUrl,
        method: 'POST',
        body: JSON.stringify({
          category,
          ...(category === 'Other' ? { customName } : {}),
        }),
      });
      await loadEvents();
      setSelectedEventId(result.event._id);
      setCustomName('');
      setStatus(`${result.event.name} is ready for QR attendance scans.`);
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  async function recordScan(qrToken) {
    if (busyRef.current || !selectedEventId) return;
    busyRef.current = true;
    setError('');
    setStatus('');
    try {
      if (scannerRef.current?.isScanning) await stopScanner();
      const result = await apiRequest(
        `/custom-events/${encodeURIComponent(selectedEventId)}/scans`,
        {
          getIdToken,
          apiBaseUrl,
          method: 'POST',
          body: JSON.stringify({ qrToken }),
        }
      );
      setStatus(`${result.message} · ${result.event.name}`);
    } catch (scanError) {
      setError(getErrorMessage(scanError));
    } finally {
      busyRef.current = false;
    }
  }

  async function startScanner() {
    if (!selectedEventId) {
      setError('Create or select a custom event before scanning.');
      return;
    }
    setError('');
    setStatus('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not available. Open this page over HTTPS.');
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
        (decodedText) => recordScan(decodedText),
        () => {}
      );
      setScannerState('scanning');
    } catch (startError) {
      setScannerState('idle');
      setError(getErrorMessage(startError));
    }
  }

  const selectedEvent = events.find((event) => event._id === selectedEventId);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            The Life Builder Church · KSP Leader
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Custom event attendance</h1>
            <Link
              to="/scanner"
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Sunday scanner
            </Link>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Create a KSP gathering or seminar, then scan member QR IDs. These scans are stored separately from Sunday attendance.
          </p>
        </header>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {status && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{status}</p>}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Create an event</h2>
          <form className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={createEvent}>
            <label className="block text-sm font-semibold text-slate-700">
              Event type
              <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
                {eventCategories.map((eventCategory) => (
                  <option key={eventCategory} value={eventCategory}>{eventCategory}</option>
                ))}
              </select>
            </label>
            {category === 'Other' && (
              <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                Custom event name
                <input
                  className={inputClass}
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder="Enter event name"
                />
              </label>
            )}
            <button className={`${buttonClass} sm:col-start-2`} disabled={saving}>
              {saving ? 'Creating…' : 'Create event'}
            </button>
          </form>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
              Select event to scan
              <select
                className={inputClass}
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                disabled={loading || events.length === 0 || scannerState !== 'idle'}
              >
                {events.length === 0 && <option value="">No custom events yet</option>}
                {events.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.name} · {new Date(event.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
            {scannerState === 'scanning' ? (
              <button type="button" className={`${buttonClass} bg-slate-700 hover:bg-slate-800`} onClick={() => stopScanner().catch((stopError) => setError(getErrorMessage(stopError)))}>
                Stop camera
              </button>
            ) : (
              <button type="button" className={buttonClass} onClick={startScanner} disabled={!selectedEventId || loading || scannerState === 'starting'}>
                {scannerState === 'starting' ? 'Starting camera…' : 'Open event scanner'}
              </button>
            )}
          </div>
          {selectedEvent && <p className="mt-3 text-sm text-slate-600">Scanning for <strong>{selectedEvent.name}</strong>.</p>}
          <div id={scannerElementId} className="mx-auto mt-5 min-h-4 w-full max-w-md overflow-hidden rounded-xl bg-slate-950 [&_video]:rounded-xl" />
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">
            Each member can be scanned once per event. Allow camera access to continue.
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Recent events</h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading events…</p>
          ) : events.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {events.map((event) => (
                <li key={event._id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold">{event.name}</p>
                    <p className="text-xs text-slate-500">{event.category} · {new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEventId(event._id)}
                    className="min-h-10 rounded-lg border border-emerald-200 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    Select
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Create an event to enable event attendance scanning.</p>
          )}
        </section>
      </div>
    </main>
  );
}
