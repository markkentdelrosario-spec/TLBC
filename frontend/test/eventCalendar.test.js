import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEventCalendarContent,
  getEventCalendarFilename,
} from '../src/utils/eventCalendar.js';

test('calendar export converts church-local event times to UTC', () => {
  const calendar = createEventCalendarContent(
    {
      _id: 'community-day',
      title: 'Community Day',
      eventDate: '2026-11-16',
      startTime: '08:30',
      endTime: '10:00',
    },
    'Asia/Manila',
    new Date('2026-11-01T00:00:00.000Z')
  );

  assert.match(calendar, /DTSTART:20261116T003000Z/);
  assert.match(calendar, /DTEND:20261116T020000Z/);
});

test('all-day events use an exclusive next-day end and escape text', () => {
  const calendar = createEventCalendarContent(
    {
      title: 'Church, Family',
      eventDate: '2026-12-31',
      description: 'Bring food;\ninvite a friend.',
    },
    'Asia/Manila',
    new Date('2026-11-01T00:00:00.000Z')
  );

  assert.match(calendar, /DTSTART;VALUE=DATE:20261231/);
  assert.match(calendar, /DTEND;VALUE=DATE:20270101/);
  assert.match(calendar, /SUMMARY:Church\\, Family/);
  assert.ok(calendar.includes('DESCRIPTION:Bring food\\;\\ninvite a friend.'));
});

test('calendar export validates date keys and produces safe filenames', () => {
  assert.throws(
    () => createEventCalendarContent({ title: 'Bad date', eventDate: '2026-02-30' }),
    RangeError
  );
  assert.equal(getEventCalendarFilename('Community Day!'), 'community-day.ics');
  assert.equal(getEventCalendarFilename('!!!'), 'church-event.ics');
  assert.throws(
    () => createEventCalendarContent({
      title: 'Bad time',
      eventDate: '2026-11-16',
      startTime: '25:30',
    }),
    RangeError
  );
});
