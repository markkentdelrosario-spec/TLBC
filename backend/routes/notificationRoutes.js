const express = require('express');
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser } = require('../realtime/realtime');

const router = express.Router();
const NOTIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000;

router.get('/', authenticate, async (req, res, next) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 10;
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({ message: 'page and limit must be positive; limit cannot exceed 100.' });
  }
  try {
    const filter = {
      user: req.user._id,
      createdAt: { $gte: new Date(Date.now() - NOTIFICATION_RETENTION_MS) },
    };
    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'displayName')
        .lean(),
      Notification.countDocuments({ ...filter, readAt: null }),
      Notification.countDocuments(filter),
    ]);
    return res.json({
      notifications,
      unreadCount,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await Notification.updateMany(
      {
        user: req.user._id,
        readAt: null,
        createdAt: { $gte: new Date(Date.now() - NOTIFICATION_RETENTION_MS) },
      },
      { $set: { readAt: new Date() } }
    );
    emitToUser(req.user._id, 'notifications:read', { all: true, unreadCount: 0 });
    return res.json({ unreadCount: 0 });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:notificationId/read', authenticate, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.notificationId)) {
    return res.status(400).json({ message: 'notificationId must be a valid ID.' });
  }
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.notificationId,
        user: req.user._id,
        readAt: null,
        createdAt: { $gte: new Date(Date.now() - NOTIFICATION_RETENTION_MS) },
      },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      const exists = await Notification.exists({
        _id: req.params.notificationId,
        user: req.user._id,
        createdAt: { $gte: new Date(Date.now() - NOTIFICATION_RETENTION_MS) },
      });
      if (!exists) return res.status(404).json({ message: 'Notification not found.' });
    }
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      readAt: null,
      createdAt: { $gte: new Date(Date.now() - NOTIFICATION_RETENTION_MS) },
    });
    emitToUser(req.user._id, 'notifications:read', {
      notificationId: req.params.notificationId,
      unreadCount,
    });
    return res.json({ unreadCount });
  } catch (error) {
    return next(error);
  }
});

router.post('/push-token', authenticate, async (req, res, next) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token || token.length > 4096) {
    return res.status(400).json({ message: 'A valid push token is required.' });
  }
  try {
    await User.updateOne({ _id: req.user._id }, { $addToSet: { pushTokens: token } });
    return res.json({ registered: true });
  } catch (error) {
    return next(error);
  }
});

router.delete('/push-token', authenticate, async (req, res, next) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token || token.length > 4096) {
    return res.status(400).json({ message: 'A valid push token is required.' });
  }
  try {
    await User.updateOne({ _id: req.user._id }, { $pull: { pushTokens: token } });
    return res.json({ registered: false });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
