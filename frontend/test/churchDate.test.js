import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatChurchDate,
  getChurchDateKey,
  getMostRecentChurchSunday,
  isChurchSundayDateKey,
} from '../src/utils/churchDate.js';

test('church date keys use the configured time zone rather than the browser day', () => {
  assert.equal(
    getChurchDateKey(new Date('2026-11-15T16:30:00.000Z'), 'Asia/Manila'),
    '2026-11-16'
  );
});

test('most recent Sunday is computed from the church-local calendar date', () => {
  assert.equal(
    getMostRecentChurchSunday(new Date('2026-11-15T16:30:00.000Z'), 'Asia/Manila'),
    '2026-11-15'
  );
});

test('date-key validation and formatting do not shift by the viewer time zone', () => {
  assert.equal(isChurchSundayDateKey('2026-11-15'), true);
  assert.equal(isChurchSundayDateKey('2026-02-30'), false);
  assert.equal(isChurchSundayDateKey('2026-11-16'), false);
  assert.equal(
    formatChurchDate('2026-11-15', { month: 'short', day: 'numeric' }),
    'Nov 15'
  );
});
