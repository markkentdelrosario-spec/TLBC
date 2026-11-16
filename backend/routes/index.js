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
const publicEventRoutes = require('./publicEventRoutes');
const churchMinistryRoutes = require('./churchMinistryRoutes');
const bibleLibraryRoutes = require('./bibleLibraryRoutes');
const mongoose = require('mongoose');
const { getReadiness } = require('../utils/healthStatus');

const router = express.Router();

router.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});
router.get('/health/live', (req, res) => {
  return res.json({ status: 'ok' });
});
router.get('/health/ready', (req, res) => {
  const readiness = getReadiness(mongoose.connection.readyState);
  return res.status(readiness.statusCode).json(readiness.body);
});
router.use('/auth', authRoutes);
router.use('/upload', uploadRoutes);
router.use('/slideshows', slideshowRoutes);
router.use('/events', publicEventRoutes);
router.use('/ministries', churchMinistryRoutes);
router.use('/bible-library', bibleLibraryRoutes);
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
