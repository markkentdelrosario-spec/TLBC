const express = require('express');
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/authMiddleware');
const BibleBookmark = require('../models/BibleBookmark');
const BibleReadingPlanProgress = require('../models/BibleReadingPlanProgress');
const {
  BIBLE_READING_PLANS,
  getBibleReadingPlan,
} = require('../utils/bibleReadingPlans');

const router = express.Router();
const allowedTranslations = new Set([
  'web',
  'kjv',
  'nkjv',
  'nlt',
  'niv',
  'asv',
  'bbe',
  'darby',
  'ylt',
  'oeb-us',
]);

router.get('/', authenticate, async (req, res, next) => {
  try {
    const [bookmarks, planProgress] = await Promise.all([
      BibleBookmark.find({ user: req.user._id }).sort({ createdAt: -1 }).lean(),
      BibleReadingPlanProgress.find({ user: req.user._id }).sort({ startedAt: -1 }).lean(),
    ]);
    return res.json({
      plans: BIBLE_READING_PLANS,
      bookmarks,
      planProgress,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/bookmarks', authenticate, async (req, res, next) => {
  const reference =
    typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';
  const translation =
    typeof req.body?.translation === 'string'
      ? req.body.translation.trim().toLowerCase()
      : '';
  if (!reference || reference.length > 120 || !/^[\p{L}\p{N} .:-]+$/u.test(reference)) {
    return res.status(400).json({
      message: 'reference must be a valid Bible passage of 120 characters or fewer.',
    });
  }
  if (!allowedTranslations.has(translation)) {
    return res.status(400).json({ message: 'Choose a supported Bible translation.' });
  }

  try {
    const bookmark = await BibleBookmark.create({
      user: req.user._id,
      reference,
      translation,
    });
    return res.status(201).json({ bookmark });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This passage is already bookmarked.' });
    }
    return next(error);
  }
});

router.delete('/bookmarks/:bookmarkId', authenticate, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.bookmarkId)) {
    return res.status(400).json({ message: 'bookmarkId must be a valid ID.' });
  }
  try {
    const result = await BibleBookmark.deleteOne({
      _id: req.params.bookmarkId,
      user: req.user._id,
    });
    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Bookmark not found.' });
    }
    return res.json({ message: 'Bookmark removed.' });
  } catch (error) {
    return next(error);
  }
});

router.put('/plans/:planId', authenticate, async (req, res, next) => {
  if (!getBibleReadingPlan(req.params.planId)) {
    return res.status(404).json({ message: 'Bible reading plan not found.' });
  }
  try {
    const progress = await BibleReadingPlanProgress.findOneAndUpdate(
      { user: req.user._id, planId: req.params.planId },
      {
        $setOnInsert: {
          user: req.user._id,
          planId: req.params.planId,
          completedDayNumbers: [],
          startedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ progress });
  } catch (error) {
    return next(error);
  }
});

router.patch(
  '/plans/:planId/days/:dayNumber',
  authenticate,
  async (req, res, next) => {
    const plan = getBibleReadingPlan(req.params.planId);
    const dayNumber = Number.parseInt(req.params.dayNumber, 10);
    if (!plan || !plan.days.some((day) => day.dayNumber === dayNumber)) {
      return res.status(400).json({ message: 'Choose a valid reading plan day.' });
    }
    try {
      const current = await BibleReadingPlanProgress.findOne({
        user: req.user._id,
        planId: plan.id,
      });
      if (!current) {
        return res.status(404).json({ message: 'Start this reading plan first.' });
      }
      const isComplete = current.completedDayNumbers.includes(dayNumber);
      const progress = await BibleReadingPlanProgress.findOneAndUpdate(
        { user: req.user._id, planId: plan.id },
        isComplete
          ? { $pull: { completedDayNumbers: dayNumber } }
          : { $addToSet: { completedDayNumbers: dayNumber } },
        { new: true }
      ).lean();
      return res.json({ progress });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete('/plans/:planId', authenticate, async (req, res, next) => {
  if (!getBibleReadingPlan(req.params.planId)) {
    return res.status(404).json({ message: 'Bible reading plan not found.' });
  }
  try {
    const result = await BibleReadingPlanProgress.deleteOne({
      user: req.user._id,
      planId: req.params.planId,
    });
    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Reading plan progress not found.' });
    }
    return res.json({ message: 'Reading plan removed.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
