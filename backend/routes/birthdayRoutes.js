const express = require('express');
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/authMiddleware');
const BirthdayGreeting = require('../models/BirthdayGreeting');
const User = require('../models/User');
const { emitToAll } = require('../realtime/realtime');
const { createNotification } = require('../services/notifications');

const router = express.Router();

function isCurrentMonthCelebrant(user, month) {
  return user?.birthDate && new Date(user.birthDate).getUTCMonth() + 1 === month;
}

async function findCelebrant(userId, month) {
  if (!mongoose.isValidObjectId(userId)) return null;
  const user = await User.findOne({
    _id: userId,
    isActive: true,
    birthDate: { $ne: null },
  }).select('displayName profilePicture profilePhoto birthDate');
  return isCurrentMonthCelebrant(user, month) ? user : null;
}

router.get('/', authenticate, async (req, res, next) => {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  try {
    const celebrants = await User.find({
      isActive: true,
      birthDate: { $ne: null },
      $expr: { $eq: [{ $month: '$birthDate' }, month] },
    })
      .select('displayName profilePicture profilePhoto birthDate')
      .sort({ displayName: 1 })
      .lean();
    const interactions = await BirthdayGreeting.find({
      year: now.getUTCFullYear(),
      celebrant: { $in: celebrants.map((user) => user._id) },
    })
      .populate('reactions', '_id')
      .populate('comments.user', 'displayName')
    .populate('comments.reactions', '_id')
      .lean();
    const byCelebrant = new Map(
      interactions.map((item) => [String(item.celebrant), item])
    );
    return res.json({
      birthdays: celebrants.map((user) => {
        const interaction = byCelebrant.get(String(user._id));
        return {
          id: user._id,
          name: user.displayName,
          day: new Date(user.birthDate).getUTCDate(),
          profilePicture: user.profilePicture || user.profilePhoto?.url || null,
          reactions: interaction?.reactions || [],
          comments: interaction?.comments || [],
        };
      }).sort((left, right) => left.day - right.day || left.name.localeCompare(right.name)),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:userId/reactions', authenticate, async (req, res, next) => {
  const now = new Date();
  try {
    const celebrant = await findCelebrant(req.params.userId, now.getUTCMonth() + 1);
    if (!celebrant) {
      return res.status(404).json({ message: 'Current-month celebrant not found.' });
    }
    const greeting = await BirthdayGreeting.findOneAndUpdate(
      { celebrant: celebrant._id, year: now.getUTCFullYear() },
      {
        $setOnInsert: {
          celebrant: celebrant._id,
          year: now.getUTCFullYear(),
          reactions: [],
          comments: [],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const reacted = greeting.reactions.some((id) => id.equals(req.user._id));
    await BirthdayGreeting.updateOne(
      {
        _id: greeting._id,
        ...(reacted
          ? { reactions: req.user._id }
          : { reactions: { $ne: req.user._id } }),
      },
      reacted
        ? { $pull: { reactions: req.user._id } }
        : { $addToSet: { reactions: req.user._id } }
    );
    const updated = await BirthdayGreeting.findById(greeting._id).select('reactions').lean();
    const userIds = updated.reactions.map(String);
    emitToAll('birthday:reaction', {
      celebrantId: String(celebrant._id),
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

router.post('/:userId/comments', authenticate, async (req, res, next) => {
  const body = typeof (req.body || {}).body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 1000) {
    return res.status(400).json({
      message: 'Comment must be between 1 and 1,000 characters.',
    });
  }
  const now = new Date();
  try {
    const celebrant = await findCelebrant(req.params.userId, now.getUTCMonth() + 1);
    if (!celebrant) {
      return res.status(404).json({ message: 'Current-month celebrant not found.' });
    }
    const greeting = await BirthdayGreeting.findOneAndUpdate(
      { celebrant: celebrant._id, year: now.getUTCFullYear() },
      {
        $setOnInsert: { celebrant: celebrant._id, year: now.getUTCFullYear() },
        $push: {
          comments: { user: req.user._id, body, createdAt: now },
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    const comment = greeting.comments[greeting.comments.length - 1];
    emitToAll('birthday:comment', {
      celebrantId: String(celebrant._id),
      commentCount: greeting.comments.length,
    });
    return res.status(201).json({
      comment: {
        _id: comment._id,
        user: { _id: req.user._id, displayName: req.user.displayName },
        body,
        reactions: [],
        createdAt: now,
      },
      commentCount: greeting.comments.length,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:userId/comments/:commentId/reactions', authenticate, async (req, res, next) => {
  const { userId, commentId } = req.params;
  if (!mongoose.isValidObjectId(commentId)) {
    return res.status(400).json({ message: 'commentId must be a valid ID.' });
  }
  const now = new Date();
  try {
    const celebrant = await findCelebrant(userId, now.getUTCMonth() + 1);
    if (!celebrant) {
      return res.status(404).json({ message: 'Current-month celebrant not found.' });
    }
    const greeting = await BirthdayGreeting.findOne({
      celebrant: celebrant._id,
      year: now.getUTCFullYear(),
    });
    const comment = greeting?.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found.' });

    const reacted = (comment.reactions || []).some((id) => id.equals(req.user._id));
    const update = reacted
      ? { $pull: { 'comments.$[comment].reactions': req.user._id } }
      : { $addToSet: { 'comments.$[comment].reactions': req.user._id } };
    const updateResult = await BirthdayGreeting.updateOne(
      {
        _id: greeting._id,
        comments: {
          $elemMatch: {
            _id: comment._id,
            ...(reacted
              ? { reactions: req.user._id }
              : { reactions: { $ne: req.user._id } }),
          },
        },
      },
      update,
      { arrayFilters: [{ 'comment._id': comment._id }] }
    );
    const current = await BirthdayGreeting.findById(greeting._id).select('comments').lean();
    const updatedComment = current.comments.find(
      (item) => String(item._id) === String(comment._id)
    );
    const userIds = (updatedComment.reactions || []).map(String);
    const nowReacted = userIds.includes(String(req.user._id));

    if (
      updateResult.modifiedCount > 0 &&
      !reacted &&
      nowReacted &&
      !comment.user.equals(req.user._id)
    ) {
      await createNotification({
        userId: comment.user,
        actorId: req.user._id,
        type: 'comment_reaction',
        scope: 'birthday',
        title: 'Someone reacted to your comment',
        message: `${req.user.displayName} liked your birthday greeting.`.slice(0, 280),
        entityId: celebrant._id,
      });
    }
    emitToAll('comment:reaction', {
      scope: 'birthday',
      celebrantId: String(celebrant._id),
      commentId: String(comment._id),
      reactionCount: userIds.length,
      userIds,
    });
    return res.json({ reacted: nowReacted, reactionCount: userIds.length });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
