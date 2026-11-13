const express = require('express');
const mongoose = require('mongoose');
const {
  authenticate,
  authorizeKspLeader,
} = require('../middleware/authMiddleware');
const Beneficiary = require('../models/Beneficiary');
const CustomEvent = require('../models/CustomEvent');
const CustomEventAttendanceScan = require('../models/CustomEventAttendanceScan');
const User = require('../models/User');

const router = express.Router();
const eventCategories = new Set(['KSP Gathering', 'Seminars', 'Other']);

router.use(authenticate, authorizeKspLeader);

router.get('/', async (req, res, next) => {
  try {
    const events = await CustomEvent.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ events });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  const category =
    typeof req.body?.category === 'string' ? req.body.category.trim() : '';
  const customName =
    typeof req.body?.customName === 'string' ? req.body.customName.trim() : '';

  if (!eventCategories.has(category)) {
    return res.status(400).json({
      message: 'Choose KSP Gathering, Seminars, or Other.',
    });
  }
  if (category === 'Other' && (customName.length < 2 || customName.length > 100)) {
    return res.status(400).json({
      message: 'Enter a custom event name between 2 and 100 characters.',
    });
  }

  try {
    const event = await CustomEvent.create({
      category,
      name: category === 'Other' ? customName : category,
      createdBy: req.user._id,
    });
    return res.status(201).json({ event });
  } catch (error) {
    return next(error);
  }
});

router.post('/:eventId/scans', async (req, res, next) => {
  const { eventId } = req.params;
  const qrToken =
    typeof req.body?.qrToken === 'string' ? req.body.qrToken.trim() : '';

  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'eventId must be a valid ID.' });
  }
  if (!qrToken || qrToken.length > 128) {
    return res.status(400).json({ message: 'A valid QR code is required.' });
  }

  try {
    const event = await CustomEvent.findOne({ _id: eventId, isActive: true })
      .select('_id name')
      .lean();
    if (!event) return res.status(404).json({ message: 'Custom event not found.' });

    let user;
    let beneficiary;
    if (mongoose.isObjectIdOrHexString(qrToken)) {
      user = await User.findOne({
        _id: qrToken,
        role: 'member',
        isActive: true,
      }).select('_id displayName');
      if (user) {
        beneficiary = await Beneficiary.findOne({
          user: user._id,
          isActive: true,
        }).select('_id');
      }
    } else {
      beneficiary = await Beneficiary.findOne({
        qrCodeId: qrToken,
        isActive: true,
      }).select('_id user');
      if (beneficiary) {
        user = await User.findOne({
          _id: beneficiary.user,
          role: 'member',
          isActive: true,
        }).select('_id displayName');
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Active member not found for this QR code.' });
    }

    const scan = await CustomEventAttendanceScan.create({
      event: event._id,
      user: user._id,
      beneficiary: beneficiary?._id,
      scannedBy: req.user._id,
    });
    return res.status(201).json({
      message: `Attendance recorded for ${user.displayName}.`,
      event: { id: event._id, name: event.name },
      scan,
      member: { id: user._id, name: user.displayName },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This member has already been scanned for this event.',
      });
    }
    return next(error);
  }
});

module.exports = router;
