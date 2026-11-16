export const CHURCH_TIME_ZONE =
  import.meta.env?.VITE_CHURCH_TIME_ZONE?.trim() || 'Asia/Manila';

function getDateParts(date, timeZone = CHURCH_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function getChurchDateKey(date = new Date(), timeZone = CHURCH_TIME_ZONE) {
  const { year, month, day } = getDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function isChurchSundayDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return false;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === dateKey &&
    date.getUTCDay() === 0
  );
}

export function getMostRecentChurchSunday(date = new Date(), timeZone = CHURCH_TIME_ZONE) {
  const [year, month, day] = getChurchDateKey(date, timeZone).split('-').map(Number);
  const sunday = new Date(Date.UTC(year, month - 1, day));
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return sunday.toISOString().slice(0, 10);
}

export function formatChurchDate(
  dateKey,
  options = { weekday: 'long', month: 'long', day: 'numeric' }
) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    throw new RangeError('dateKey must be a valid YYYY-MM-DD date.');
  }
  return new Intl.DateTimeFormat('en-PH', {
    ...options,
    timeZone: 'UTC',
  }).format(date);
}
