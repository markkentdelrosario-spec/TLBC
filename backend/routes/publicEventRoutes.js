const express = require('express');
const mongoose = require('mongoose');
const {
  authenticate,
  authorizeRoles,
} = require('../middleware/authMiddleware');
const PublicEvent = require('../models/PublicEvent');
const {
  getChurchAttendanceDate,
  parseChurchCalendarDate,
} = require('../utils/attendanceDate');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('admin')];
const allowedCategories = new Set([
  'Church',
  'Worship',
  'Youth',
  'Small Groups',
  'Outreach',
  'Other',
]);
const allowedStatuses = new Set(['draft', 'published']);

function isTime(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function readEventInput(body = {}) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description =
    typeof body.description === 'string' ? body.description.trim() : '';
  const eventDate =
    typeof body.eventDate === 'string' ? body.eventDate.trim() : '';
  const startTime =
    typeof body.startTime === 'string' ? body.startTime.trim() : '';
  const endTime = typeof body.endTime === 'string' ? body.endTime.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : '';

  if (!title || title.length > 120) {
    return { error: 'title is required and must be 120 characters or fewer.' };
  }
  if (description.length > 3000) {
    return { error: 'description must be 3,000 characters or fewer.' };
  }
  if (location.length > 240) {
    return { error: 'location must be 240 characters or fewer.' };
  }
  if (!allowedCategories.has(category)) {
    return { error: 'Choose a valid event category.' };
  }
  if (!allowedStatuses.has(status)) {
    return { error: 'status must be draft or published.' };
  }
  if (!isTime(startTime) || !isTime(endTime)) {
    return { error: 'Event times must use 24-hour HH:mm format.' };
  }
  if (startTime && endTime && endTime <= startTime) {
    return { error: 'endTime must be later than startTime.' };
  }

  let parsedDate;
  try {
    parsedDate = parseChurchCalendarDate(eventDate, 'eventDate');
  } catch (error) {
    return { error: error.message };
  }
  if (!parsedDate) return { error: 'eventDate is required.' };

  return {
    value: {
      title,
      description,
      eventDate: parsedDate,
      startTime,
      endTime,
      location,
      category,
      status,
    },
  };
}

router.get('/', async (req, res, next) => {
  try {
    const events = await PublicEvent.find({
      status: 'published',
      eventDate: { $gte: getChurchAttendanceDate() },
    })
      .select('-createdBy -reminderLockUntil -reminderSentAt')
      .sort({ eventDate: 1, startTime: 1 })
      .limit(100)
      .lean();
    return res.json({ events });
  } catch (error) {
    return next(error);
  }
});

router.get('/admin', ...adminOnly, async (req, res, next) => {
  try {
    const events = await PublicEvent.find({})
      .sort({ eventDate: 1, startTime: 1, createdAt: -1 })
      .limit(250)
      .lean();
    return res.json({ events });
  } catch (error) {
    return next(error);
  }
});

router.post('/', ...adminOnly, async (req, res, next) => {
  const { value, error } = readEventInput(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const event = await PublicEvent.create({ ...value, createdBy: req.user._id });
    return res.status(201).json({ event });
  } catch (createError) {
    return next(createError);
  }
});

router.patch('/:eventId', ...adminOnly, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.eventId)) {
    return res.status(400).json({ message: 'eventId must be a valid ID.' });
  }
  const { value, error } = readEventInput(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    const current = await PublicEvent.findById(req.params.eventId);
    if (!current) return res.status(404).json({ message: 'Event not found.' });

    const reminderNeedsReset =
      current.eventDate.getTime() !== value.eventDate.getTime() ||
      current.startTime !== value.startTime ||
      (current.status !== 'published' && value.status === 'published');
    Object.assign(current, value);
    if (reminderNeedsReset) {
      current.reminderSentAt = null;
      current.reminderLockUntil = null;
    }
    await current.save();
    return res.json({ event: current });
  } catch (updateError) {
    return next(updateError);
  }
});

router.delete('/:eventId', ...adminOnly, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.eventId)) {
    return res.status(400).json({ message: 'eventId must be a valid ID.' });
  }
  try {
    const event = await PublicEvent.findByIdAndUpdate(
      req.params.eventId,
      { $set: { status: 'archived', reminderLockUntil: null } },
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found.' });
    return res.json({ message: 'Event archived.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
