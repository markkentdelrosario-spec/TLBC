const express = require('express');
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser } = require('../realtime/realtime');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('actor', 'displayName')
        .lean(),
      Notification.countDocuments({ user: req.user._id, readAt: null }),
    ]);
    return res.json({ notifications, unreadCount });
  } catch (error) {
    return next(error);
  }
});

router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, readAt: null },
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
      { _id: req.params.notificationId, user: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      const exists = await Notification.exists({
        _id: req.params.notificationId,
        user: req.user._id,
      });
      if (!exists) return res.status(404).json({ message: 'Notification not found.' });
    }
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      readAt: null,
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
