const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const VerseOfDay = require('../models/VerseOfDay');
const { emitToAll } = require('../realtime/realtime');

const router = express.Router();
const DAILY_VERSES = [
  'Psalm 23:1',
  'Philippians 4:13',
  'Jeremiah 29:11',
  'Romans 8:28',
  'Proverbs 3:5-6',
  'Isaiah 41:10',
  'John 3:16',
];

function getTodayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getTodayReference(now = new Date()) {
  const dayIndex = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), 0, 0)) /
      86400000
  );
  return DAILY_VERSES[dayIndex % DAILY_VERSES.length];
}

router.get('/verse-of-day', authenticate, async (req, res, next) => {
  const dateKey = getTodayKey();
  const reference = getTodayReference();
  try {
    const verse = await VerseOfDay.findOneAndUpdate(
      { dateKey },
      { $setOnInsert: { dateKey, reference, reactions: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({
      date: dateKey,
      reference: verse.reference,
      reactionCount: verse.reactions.length,
      reacted: verse.reactions.some((userId) => userId.equals(req.user._id)),
    });
  } catch (error) {
    if (error.code === 11000) {
      try {
        const verse = await VerseOfDay.findOne({ dateKey }).lean();
        return res.json({
          date: dateKey,
          reference: verse.reference,
          reactionCount: verse.reactions.length,
          reacted: verse.reactions.some((userId) => userId.equals(req.user._id)),
        });
      } catch (readError) {
        return next(readError);
      }
    }
    return next(error);
  }
});

router.post('/verse-of-day/reactions', authenticate, async (req, res, next) => {
  const dateKey = getTodayKey();
  const reference = getTodayReference();
  try {
    let verse = await VerseOfDay.findOneAndUpdate(
      { dateKey },
      { $setOnInsert: { dateKey, reference, reactions: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const currentReaction = verse.reactions.some((userId) =>
      userId.equals(req.user._id)
    );
    if (currentReaction) {
      verse = await VerseOfDay.findOneAndUpdate(
        { dateKey },
        { $pull: { reactions: req.user._id } },
        { new: true }
      );
    } else {
      verse = await VerseOfDay.findOneAndUpdate(
        { dateKey },
        { $addToSet: { reactions: req.user._id } },
        { new: true }
      );
    }
    const userIds = verse.reactions.map(String);
    emitToAll('verse:reaction', {
      dateKey,
      reactionCount: userIds.length,
      userIds,
    });
    return res.json({
      reacted: userIds.includes(String(req.user._id)),
      reactionCount: userIds.length,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
