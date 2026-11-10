const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function getChurchAttendanceDate(date = new Date()) {
  const timeZone = process.env.CHURCH_TIME_ZONE || 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return new Date(
    `${values.year}-${values.month}-${values.day}T00:00:00.000Z`
  );
}

function getChurchAttendanceSundayDate(date = new Date()) {
  const sunday = getChurchAttendanceDate(date);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  return sunday;
}

function parseDate(value, fieldName) {
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
  const start = parseDate(startDate, 'startDate');
  const end = parseDate(endDate, 'endDate');

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
  getChurchAttendanceDate,
  getChurchAttendanceSundayDate,
};
