import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicSiteNav from '../components/layout/PublicSiteNav';
import { apiBaseUrl } from '../config/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getTodayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(dateKey, options = { weekday: 'long', month: 'long', day: 'numeric' }) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PH', {
    ...options,
    timeZone: 'Asia/Manila',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatTime(time) {
  if (!time) return '';
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function getMonthCells(year, month) {
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1;
    if (day < 1 || day > daysInMonth) return null;
    return getDateKey(year, month, day);
  });
}

function getSundaysInMonth(year, month) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => index + 1)
    .filter((day) => new Date(Date.UTC(year, month, day)).getUTCDay() === 0)
    .map((day) => getDateKey(year, month, day));
}

function createWorshipEvent(dateKey) {
  return {
    _id: `worship-${dateKey}`,
    eventDate: dateKey,
    title: 'Worship Celebration',
    category: 'Worship',
    startTime: '08:30',
    displayTime: '8:30 AM Onwards',
    description: '',
  };
}

function EventCard({ event, featured = false }) {
  const eventDate = String(event.eventDate).slice(0, 10);
  return (
    <article className={`group overflow-hidden rounded-2xl border shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
      featured
        ? 'border-emerald-200/30 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-900'
    }`}>
      <div className={`h-1.5 ${featured ? 'bg-gradient-to-r from-amber-200 via-emerald-300 to-cyan-300' : 'bg-gradient-to-r from-emerald-500 to-amber-300'}`} />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
            featured ? 'bg-white/10 text-amber-100' : 'bg-emerald-50 text-emerald-800'
          }`}>
            {event.category}
          </span>
          <span className={`text-right text-xs font-semibold ${featured ? 'text-emerald-100' : 'text-slate-500'}`}>
            {formatDate(eventDate, { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">{event.title}</h3>
        {event.description && (
          <p className={`mt-3 whitespace-pre-line text-sm leading-6 ${
            featured ? 'text-emerald-50/80' : 'text-slate-600'
          }`}>
            {event.description}
          </p>
        )}
        <div className={`mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-sm ${
          featured ? 'border-white/15 text-emerald-50/90' : 'border-slate-100 text-slate-600'
        }`}>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true">◷</span>
            {event.displayTime || (event.startTime
              ? `${formatTime(event.startTime)}${event.endTime ? ` – ${formatTime(event.endTime)}` : ''}`
              : 'Time to be announced')}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true">⌖</span>
              {event.location}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function PublicEventsPage() {
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const todayKey = getTodayKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [month, setMonth] = useState(() => {
    const [year, monthNumber] = todayKey.split('-').map(Number);
    return { year, month: monthNumber - 1 };
  });

  useEffect(() => {
    const controller = new AbortController();
    async function loadEvents() {
      try {
        const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/events`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || 'Unable to load upcoming events.');
        }
        setEvents(Array.isArray(payload.events) ? payload.events : []);
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError.message || 'Unable to load upcoming events.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadEvents();
    return () => controller.abort();
  }, []);

  const eventsByDate = useMemo(() => {
    const [currentYear, currentMonth] = todayKey.split('-').map(Number);
    const worshipDates = new Set(
      getSundaysInMonth(month.year, month.month)
    );
    for (let monthOffset = 0; monthOffset < 12; monthOffset += 1) {
      const monthDate = new Date(Date.UTC(currentYear, currentMonth - 1 + monthOffset, 1));
      getSundaysInMonth(monthDate.getUTCFullYear(), monthDate.getUTCMonth())
        .filter((dateKey) => dateKey >= todayKey)
        .forEach((dateKey) => worshipDates.add(dateKey));
    }
    const calendarEvents = [
      ...events,
      ...Array.from(worshipDates, createWorshipEvent),
    ].sort((first, second) =>
      String(first.eventDate).localeCompare(String(second.eventDate)) ||
      String(first.startTime || '').localeCompare(String(second.startTime || ''))
    );
    const grouped = new Map();
    for (const event of calendarEvents) {
      const dateKey = String(event.eventDate).slice(0, 10);
      grouped.set(dateKey, [...(grouped.get(dateKey) || []), event]);
    }
    return grouped;
  }, [events, month.month, month.year, todayKey]);
  const calendarEvents = useMemo(
    () => Array.from(eventsByDate.values()).flat(),
    [eventsByDate]
  );
  useEffect(() => {
    const eventId = new URLSearchParams(location.search).get('eventId');
    const event = events.find((item) => String(item._id) === eventId);
    if (!event) return;
    const eventDate = String(event.eventDate).slice(0, 10);
    const [year, monthNumber] = eventDate.split('-').map(Number);
    setSelectedDate(eventDate);
    setMonth({ year, month: monthNumber - 1 });
  }, [events, location.search]);
  const selectedEvents = eventsByDate.get(selectedDate) || [];
  const upcomingEvents = calendarEvents.filter(
    (event) => String(event.eventDate).slice(0, 10) >= todayKey
  );
  const nextEvent = upcomingEvents[0];
  const monthCells = getMonthCells(month.year, month.month);

  function moveMonth(direction) {
    const nextMonth = new Date(Date.UTC(month.year, month.month + direction, 1));
    setMonth({ year: nextMonth.getUTCFullYear(), month: nextMonth.getUTCMonth() });
    setSelectedDate(getDateKey(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 1));
  }

  return (
    <main className="public-site-page min-h-screen bg-[#f3f7f5] text-slate-900">
      <PublicSiteNav />
      <section className="relative isolate overflow-hidden bg-slate-950 px-4 py-14 text-white sm:px-8 sm:py-20">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,.28),transparent_52%),radial-gradient(ellipse_at_bottom_left,rgba(251,191,36,.13),transparent_45%)]" />
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">Life together</p>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Church events</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
                Gather with us for worship, fellowship, and the moments that help us grow together.
              </p>
            </div>
            <Link
              to="/#connect-with-us"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              Plan your visit <span aria-hidden="true" className="ml-2">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,.85fr)] lg:py-14">
        <section aria-labelledby="calendar-heading" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-emerald-950/5">
          <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 to-emerald-800 px-5 py-5 text-white sm:px-7">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">Church calendar</p>
              <h2 id="calendar-heading" className="mt-1 text-2xl font-bold">
                {MONTHS[month.month]} <span className="text-emerald-200">{month.year}</span>
              </h2>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-lg transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200">‹</button>
              <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-lg transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-200">›</button>
            </div>
          </div>
          <div className="p-3 sm:p-6">
            <div className="grid grid-cols-7 border-b border-slate-100 pb-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">
              {WEEKDAYS.map((day) => <span key={day} className="py-2">{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1 pt-2 sm:gap-2">
              {monthCells.map((dateKey, index) => {
                if (!dateKey) return <span key={`empty-${index}`} aria-hidden="true" className="min-h-12 sm:min-h-16" />;
                const day = Number(dateKey.slice(-2));
                const hasEvents = eventsByDate.has(dateKey);
                const isSelected = selectedDate === dateKey;
                const isToday = todayKey === dateKey;
                return (
                  <button
                    key={dateKey}
                    type="button"
                    aria-label={`${formatDate(dateKey)}${hasEvents ? `, ${eventsByDate.get(dateKey).length} event${eventsByDate.get(dateKey).length === 1 ? '' : 's'}` : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedDate(dateKey)}
                    className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-600 sm:min-h-16 sm:text-base ${
                      isSelected
                        ? 'bg-emerald-800 text-white shadow-md'
                        : isToday
                          ? 'bg-amber-50 text-emerald-900 ring-1 ring-amber-200 hover:bg-amber-100'
                          : 'text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    {day}
                    {hasEvents && (
                      <span aria-hidden="true" className={`mt-1 h-1.5 w-1.5 rounded-full ${
                        isSelected ? 'bg-amber-200' : 'bg-emerald-500'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
              A marked date has an upcoming event
            </p>
          </div>
        </section>

        <aside className="space-y-5">
          {nextEvent && (
            <section aria-label="Next upcoming event">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Coming up next</p>
              <EventCard event={nextEvent} featured />
            </section>
          )}
          <section aria-live="polite" aria-labelledby="selected-events-heading" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-end justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Selected date</p>
                <h2 id="selected-events-heading" className="mt-1 text-xl font-bold">
                  {formatDate(selectedDate)}
                </h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                {selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {loading ? (
                <p role="status" className="py-5 text-sm text-slate-500">Loading events…</p>
              ) : error ? (
                <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>
              ) : selectedEvents.length ? (
                selectedEvents.map((event) => <EventCard key={event._id} event={event} />)
              ) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  No event is scheduled for this date. Choose a marked day to explore what’s coming up.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-8 sm:pb-16">
        <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Save the date</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Upcoming schedule</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-600">
            Browse the upcoming gatherings and select any marked date above for its details.
          </p>
        </div>
        {loading ? (
          <p role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading the upcoming schedule…</p>
        ) : error ? (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</p>
        ) : upcomingEvents.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => <EventCard key={event._id} event={event} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-800">No upcoming events just yet</p>
            <p className="mt-2 text-sm text-slate-600">Please check back soon or join us for Sunday worship.</p>
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        <p>Need directions or have a question? <Link to="/#connect-with-us" className="font-semibold text-emerald-800 underline underline-offset-4">Connect with us</Link>.</p>
      </footer>
    </main>
  );
}
