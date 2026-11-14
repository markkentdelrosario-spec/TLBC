import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const categories = ['Church', 'Worship', 'Youth', 'Small Groups', 'Outreach', 'Other'];
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-900';
const buttonClass = 'inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';
const emptyEvent = {
  title: '',
  description: '',
  eventDate: '',
  startTime: '',
  endTime: '',
  location: '',
  category: 'Church',
  status: 'published',
};

function dateValue(value) {
  return value ? String(value).slice(0, 10) : '';
}

function formatEventDate(value) {
  if (!value) return 'Date not set';
  const [year, month, day] = dateValue(value).split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export default function AdminPublicEvents({ getIdToken, apiBaseUrl = '/api' }) {
  const { showToast } = useToast();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(emptyEvent);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiRequest('/events/admin', { getIdToken, apiBaseUrl });
      setEvents(Array.isArray(result.events) ? result.events : []);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, getIdToken, showToast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEditing(event) {
    setEditingId(event._id);
    setForm({
      title: event.title || '',
      description: event.description || '',
      eventDate: dateValue(event.eventDate),
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      location: event.location || '',
      category: event.category || 'Church',
      status: event.status === 'published' ? 'published' : 'draft',
    });
    document.getElementById('public-events-editor')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function resetForm() {
    setForm(emptyEvent);
    setEditingId('');
  }

  async function saveEvent(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest(editingId ? `/events/${editingId}` : '/events', {
        getIdToken,
        apiBaseUrl,
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      showToast(editingId ? 'Event updated.' : 'Event created.', 'success');
      resetForm();
      await loadEvents();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function archiveEvent(eventId) {
    setArchivingId(eventId);
    try {
      await apiRequest(`/events/${eventId}`, {
        getIdToken,
        apiBaseUrl,
        method: 'DELETE',
      });
      showToast('Event archived and removed from the public calendar.', 'success');
      await loadEvents();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setArchivingId('');
    }
  }

  return (
    <section id="public-events-management" className="mt-8 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Public website</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">Events calendar</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-300">
          Create events for the public calendar. Published events appear at <code>/events</code>; active registered users receive an in-app reminder the day before at 9:00 AM, with push alerts on devices where they opted in.
        </p>
      </header>

      <form id="public-events-editor" onSubmit={saveEvent} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{editingId ? 'Edit event' : 'Create an event'}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Event date and reminders use the church timezone.</p>
          </div>
          {editingId && (
            <button type="button" onClick={resetForm} className="min-h-9 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">
              Cancel editing
            </button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Event title
            <input required maxLength={120} className={inputClass} value={form.title} onChange={(event) => updateForm('title', event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Category
            <select className={inputClass} value={form.category} onChange={(event) => updateForm('category', event.target.value)}>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Event date
            <input required type="date" className={inputClass} value={form.eventDate} onChange={(event) => updateForm('eventDate', event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Start time
              <input type="time" className={inputClass} value={form.startTime} onChange={(event) => updateForm('startTime', event.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              End time
              <input type="time" className={inputClass} value={form.endTime} onChange={(event) => updateForm('endTime', event.target.value)} />
            </label>
          </div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 md:col-span-2">
            Location
            <input maxLength={240} className={inputClass} placeholder="Church address or venue" value={form.location} onChange={(event) => updateForm('location', event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 md:col-span-2">
            Description
            <textarea maxLength={3000} rows={4} className={inputClass} placeholder="Share event details with visitors and members." value={form.description} onChange={(event) => updateForm('description', event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Visibility
            <select className={inputClass} value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
              <option value="published">Published</option>
              <option value="draft">Draft — not public</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" className={buttonClass} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create event'}
          </button>
          {!editingId && <button type="button" onClick={loadEvents} className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Refresh events</button>}
        </div>
      </form>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Managed events</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">{events.length} event{events.length === 1 ? '' : 's'}</span>
        </div>
        {loading ? (
          <p role="status" className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500 dark:bg-slate-800">No events yet. Create one above to add it to the public calendar.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {events.map((event) => (
              <article key={event._id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100">{event.title}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        event.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                          : event.status === 'draft'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      }`}>{event.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {formatEventDate(event.eventDate)}{event.startTime ? ` · ${event.startTime}` : ''}{event.location ? ` · ${event.location}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => startEditing(event)} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Edit</button>
                    {event.status !== 'archived' && (
                      <button
                        type="button"
                        disabled={archivingId === event._id}
                        onClick={() => {
                          if (window.confirm(`Archive “${event.title}”? It will no longer appear on the public calendar.`)) {
                            archiveEvent(event._id);
                          }
                        }}
                        className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
                      >
                        {archivingId === event._id ? 'Archiving…' : 'Archive'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
