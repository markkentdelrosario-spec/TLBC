const PublicEvent = require('../models/PublicEvent');
const { notifyUpcomingEvent } = require('./notifications');
const {
  getChurchAttendanceClock,
  getChurchAttendanceDate,
} = require('../utils/attendanceDate');

const REMINDER_MINUTE_OF_DAY = 9 * 60;
const REMINDER_LOCK_DURATION_MS = 5 * 60 * 1000;

function getEventsDueForReminder(now = new Date()) {
  if (getChurchAttendanceClock(now).minutes < REMINDER_MINUTE_OF_DAY) {
    return null;
  }
  const eventDate = getChurchAttendanceDate(now);
  eventDate.setUTCDate(eventDate.getUTCDate() + 1);
  return eventDate;
}

async function sendUpcomingEventReminders(now = new Date()) {
  const eventDate = getEventsDueForReminder(now);
  if (!eventDate) return 0;

  const dueEvents = await PublicEvent.find({
    status: 'published',
    eventDate,
    reminderSentAt: null,
    $or: [
      { reminderLockUntil: null },
      { reminderLockUntil: { $lte: now } },
    ],
  })
    .select('_id title eventDate startTime location createdBy')
    .limit(100)
    .lean();

  let sentCount = 0;
  for (const event of dueEvents) {
    const lockUntil = new Date(now.getTime() + REMINDER_LOCK_DURATION_MS);
    const claimedEvent = await PublicEvent.findOneAndUpdate(
      {
        _id: event._id,
        status: 'published',
        reminderSentAt: null,
        $or: [
          { reminderLockUntil: null },
          { reminderLockUntil: { $lte: now } },
        ],
      },
      { $set: { reminderLockUntil: lockUntil } },
      { new: true }
    );
    if (!claimedEvent) continue;

    try {
      await notifyUpcomingEvent(event);
      await PublicEvent.updateOne(
        { _id: event._id, reminderLockUntil: lockUntil },
        {
          $set: { reminderSentAt: now },
          $unset: { reminderLockUntil: '' },
        }
      );
      sentCount += 1;
    } catch (error) {
      await PublicEvent.updateOne(
        { _id: event._id, reminderLockUntil: lockUntil },
        { $set: { reminderLockUntil: null } }
      );
      throw error;
    }
  }
  return sentCount;
}

module.exports = { getEventsDueForReminder, sendUpcomingEventReminders };
