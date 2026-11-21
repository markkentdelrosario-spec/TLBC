const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CHURCH_TIME_ZONE = 'Asia/Manila';

const {
  getAttendanceStatus,
  getChurchAttendanceClock,
  getChurchAttendanceDate,
  getChurchAttendanceSundayDate,
  isChurchAttendanceSunday,
  hasAttendanceCutoffPassed,
  getDefaultSundayAttendanceStatus,
} = require('../utils/attendanceDate');

test('attendance status uses Philippine local time boundaries', () => {
  assert.equal(getAttendanceStatus(new Date('2026-11-08T00:29:00.000Z')), 'present');
  assert.equal(getAttendanceStatus(new Date('2026-11-08T00:30:00.000Z')), 'late');
  assert.equal(getAttendanceStatus(new Date('2026-11-08T02:59:00.000Z')), 'late');
  assert.equal(getAttendanceStatus(new Date('2026-11-08T03:00:00.000Z')), 'absent');
});

test('church attendance dates and absence cutoff use PHT', () => {
  const date = new Date('2026-11-07T16:30:00.000Z');
  assert.equal(getChurchAttendanceDate(date).toISOString(), '2026-11-08T00:00:00.000Z');
  assert.equal(getChurchAttendanceSundayDate(date).toISOString(), '2026-11-08T00:00:00.000Z');
  assert.deepEqual(getChurchAttendanceClock(date), { weekday: 'Sun', minutes: 30 });
  assert.equal(hasAttendanceCutoffPassed(new Date('2026-11-08T02:59:00.000Z')), false);
  assert.equal(hasAttendanceCutoffPassed(new Date('2026-11-08T03:00:00.000Z')), true);
});

test('Sunday check-in eligibility follows Philippine local midnight', () => {
  assert.equal(isChurchAttendanceSunday(new Date('2026-11-07T15:59:59.000Z')), false);
  assert.equal(isChurchAttendanceSunday(new Date('2026-11-07T16:00:00.000Z')), true);
  assert.equal(isChurchAttendanceSunday(new Date('2026-11-08T16:00:00.000Z')), false);
});

test('monthly Sunday defaults do not mark the current service absent before 11 AM PHT', () => {
  const sunday = new Date('2026-11-08T00:00:00.000Z');
  assert.equal(
    getDefaultSundayAttendanceStatus(sunday, new Date('2026-11-07T16:30:00.000Z')),
    'upcoming'
  );
  assert.equal(
    getDefaultSundayAttendanceStatus(sunday, new Date('2026-11-08T02:59:00.000Z')),
    'upcoming'
  );
  assert.equal(
    getDefaultSundayAttendanceStatus(sunday, new Date('2026-11-08T03:00:00.000Z')),
    'absent'
  );
});

test('monthly Sunday defaults keep past Sundays absent and future Sundays upcoming', () => {
  const now = new Date('2026-11-07T16:30:00.000Z');
  assert.equal(
    getDefaultSundayAttendanceStatus(new Date('2026-11-01T00:00:00.000Z'), now),
    'absent'
  );
  assert.equal(
    getDefaultSundayAttendanceStatus(new Date('2026-11-15T00:00:00.000Z'), now),
    'upcoming'
  );
});
