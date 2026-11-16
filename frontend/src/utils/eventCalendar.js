import { CHURCH_TIME_ZONE } from './churchDate.js';

function assertDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) {
    throw new RangeError('eventDate must be a valid YYYY-MM-DD date.');
  }
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateKey) {
    throw new RangeError('eventDate must be a valid YYYY-MM-DD date.');
  }
}

function nextDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function assertTime(time, fieldName) {
  if (!/^\d{2}:\d{2}$/.test(time || '')) {
    throw new RangeError(`${fieldName} must use HH:mm format.`);
  }
  const [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) {
    throw new RangeError(`${fieldName} must use a valid 24-hour time.`);
  }
}

function toUtcDate(dateKey, time, timeZone) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desiredWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = desiredWallTime;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(timestamp))
        .map(({ type, value }) => [type, value])
    );
    const representedWallTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const difference = desiredWallTime - representedWallTime;
    timestamp += difference;
    if (difference === 0) break;
  }

  const finalParts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp))
      .map(({ type, value }) => [type, value])
  );
  if (
    finalParts.year !== String(year).padStart(4, '0') ||
    finalParts.month !== String(month).padStart(2, '0') ||
    finalParts.day !== String(day).padStart(2, '0') ||
    finalParts.hour !== String(hour).padStart(2, '0') ||
    finalParts.minute !== String(minute).padStart(2, '0')
  ) {
    throw new RangeError(`The event time does not exist in ${timeZone}.`);
  }

  return new Date(timestamp);
}

function formatUtcDateTime(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n?|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldLine(line) {
  const encoder = new TextEncoder();
  const lines = [];
  let current = '';
  let byteLength = 0;
  for (const character of line) {
    const characterLength = encoder.encode(character).length;
    if (byteLength + characterLength > 75) {
      lines.push(current);
      current = ` ${character}`;
      byteLength = 1 + characterLength;
    } else {
      current += character;
      byteLength += characterLength;
    }
  }
  lines.push(current);
  return lines.join('\r\n');
}

export function createEventCalendarContent(
  event,
  timeZone = CHURCH_TIME_ZONE,
  now = new Date()
) {
  const eventDate = String(event.eventDate || '').slice(0, 10);
  assertDateKey(eventDate);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Life Builder Church//Public Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeText(`${event._id || `${eventDate}-${event.title}`}@tlbc`)}`,
    `DTSTAMP:${formatUtcDateTime(now)}`,
  ];

  if (event.startTime) {
    assertTime(event.startTime, 'startTime');
    if (event.endTime) assertTime(event.endTime, 'endTime');
    const start = toUtcDate(eventDate, event.startTime, timeZone);
    const end = event.endTime
      ? toUtcDate(eventDate, event.endTime, timeZone)
      : new Date(start.getTime() + 60 * 60 * 1000);
    if (end <= start) throw new RangeError('endTime must be later than startTime.');
    lines.push(`DTSTART:${formatUtcDateTime(start)}`);
    lines.push(`DTEND:${formatUtcDateTime(end)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${eventDate.replace(/-/g, '')}`);
    lines.push(`DTEND;VALUE=DATE:${nextDateKey(eventDate).replace(/-/g, '')}`);
  }

  lines.push(
    `SUMMARY:${escapeText(event.title || 'Church event')}`,
    `DESCRIPTION:${escapeText(event.description || '')}`,
    `LOCATION:${escapeText(event.location || '')}`
  );
  if (event.url) lines.push(`URL:${escapeText(event.url)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

export function getEventCalendarFilename(title = 'church-event') {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'church-event'}.ics`;
}
