const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const PRESENT_CUTOFF_MINUTES = 8 * 60 + 30;
const ATTENDANCE_CUTOFF_MINUTES = 11 * 60;

function getAttendanceTimeZone() {
  return process.env.CHURCH_TIME_ZONE || 'Asia/Manila';
}

function getChurchAttendanceDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getAttendanceTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return new Date(
    `${values.year}-${values.month}-${values.day}T00:00:00.000Z`
  );
}

function getChurchAttendanceClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: getAttendanceTimeZone(),
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const hour = Number(values.hour);
  const minute = Number(values.minute);

  return {
    weekday: values.weekday,
    minutes: hour * 60 + minute,
  };
}

function isChurchAttendanceSunday(date = new Date()) {
  return getChurchAttendanceClock(date).weekday === 'Sun';
}

function getAttendanceStatus(date = new Date()) {
  const { minutes } = getChurchAttendanceClock(date);
  if (minutes < PRESENT_CUTOFF_MINUTES) return 'present';
  if (minutes < ATTENDANCE_CUTOFF_MINUTES) return 'late';
  return 'absent';
}

function hasAttendanceCutoffPassed(date = new Date()) {
  return getChurchAttendanceClock(date).minutes >= ATTENDANCE_CUTOFF_MINUTES;
}

function getChurchAttendanceSundayDate(date = new Date()) {
  const sunday = getChurchAttendanceDate(date);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return sunday;
}

function parseChurchCalendarDate(value, fieldName) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`${fieldName} is not a valid calendar date.`);
  }
  return date;
}

function buildAttendanceDateMatch(startDate, endDate) {
  const start = parseChurchCalendarDate(startDate, 'startDate');
  const end = parseChurchCalendarDate(endDate, 'endDate');

  if (start && end && start > end) {
    throw new RangeError('startDate cannot be after endDate.');
  }
  if (!start && !end) return undefined;

  const match = {};
  if (start) match.$gte = start;
  if (end) match.$lt = new Date(end.getTime() + DAY_IN_MILLISECONDS);
  return match;
}

module.exports = {
  buildAttendanceDateMatch,
  getAttendanceTimeZone,
  getAttendanceStatus,
  isChurchAttendanceSunday,
  getChurchAttendanceDate,
  getChurchAttendanceClock,
  getChurchAttendanceSundayDate,
  hasAttendanceCutoffPassed,
  parseChurchCalendarDate,
};
