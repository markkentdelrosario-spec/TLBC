const express = require('express');
const adminRoutes = require('./adminRoutes');
const announcementRoutes = require('./announcementRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const authRoutes = require('./authRoutes');
const birthdayRoutes = require('./birthdayRoutes');
const customEventRoutes = require('./customEventRoutes');
const groupRoutes = require('./groupRoutes');
const notificationRoutes = require('./notificationRoutes');
const verseRoutes = require('./verseRoutes');
const uploadRoutes = require('./uploadRoutes');
const slideshowRoutes = require('./slideshowRoutes');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});
router.use('/auth', authRoutes);
router.use('/upload', uploadRoutes);
router.use('/slideshows', slideshowRoutes);
router.use('/admin', adminRoutes);
router.use('/announcements', announcementRoutes);
router.use('/birthdays', birthdayRoutes);
router.use('/custom-events', customEventRoutes);
router.use('/notifications', notificationRoutes);
router.use('/groups', groupRoutes);
router.use('/', verseRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
