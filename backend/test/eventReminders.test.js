const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CHURCH_TIME_ZONE = 'Asia/Manila';

const { getEventsDueForReminder } = require('../services/eventReminders');

test('event reminders wait until 9 AM in the church timezone', () => {
  assert.equal(
    getEventsDueForReminder(new Date('2026-11-07T00:59:59.000Z')),
    null
  );
  assert.equal(
    getEventsDueForReminder(new Date('2026-11-07T01:00:00.000Z')).toISOString(),
    '2026-11-08T00:00:00.000Z'
  );
});

test('event reminder date advances by the church calendar day across midnight', () => {
  assert.equal(
    getEventsDueForReminder(new Date('2026-11-08T01:00:00.000Z')).toISOString(),
    '2026-11-09T00:00:00.000Z'
  );
});
