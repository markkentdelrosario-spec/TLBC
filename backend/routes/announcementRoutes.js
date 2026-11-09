const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const Announcement = require('../models/Announcement');
const mongoose = require('mongoose');
const { emitToAll } = require('../realtime/realtime');
const {
  createNotification,
  notifyAnnouncementPublished,
} = require('../services/notifications');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const announcements = await Announcement.find({ status: 'published' })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate('author', 'displayName')
      .populate('reactions.user', '_id')
      .populate('comments.user', 'displayName')
      .populate('comments.reactions', '_id')
      .lean();
    return res.json({ announcements });
  } catch (error) {
    return next(error);
  }
});

router.post('/:announcementId/reactions', authenticate, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.announcementId)) {
    return res.status(400).json({ message: 'announcementId must be a valid ID.' });
  }
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.announcementId,
      status: 'published',
    });
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    const reacted = announcement.reactions.some((reaction) =>
      reaction.user.equals(req.user._id)
    );
    await Announcement.updateOne(
      {
        _id: announcement._id,
        ...(reacted
          ? { 'reactions.user': req.user._id }
          : { 'reactions.user': { $ne: req.user._id } }),
      },
      reacted
        ? { $pull: { reactions: { user: req.user._id } } }
        : { $addToSet: { reactions: { user: req.user._id, emoji: 'like' } } }
    );
    const updated = await Announcement.findById(announcement._id)
      .select('reactions')
      .lean();
    const userIds = updated.reactions.map((reaction) => String(reaction.user));
    emitToAll('announcement:reaction', {
      announcementId: String(announcement._id),
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

router.post('/:announcementId/comments', authenticate, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.announcementId)) {
    return res.status(400).json({ message: 'announcementId must be a valid ID.' });
  }
  const body = typeof (req.body || {}).body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 1000) {
    return res.status(400).json({
      message: 'Comment must be between 1 and 1,000 characters.',
    });
  }
  try {
    const announcement = await Announcement.findOne({
      _id: req.params.announcementId,
      status: 'published',
    });
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found.' });
    }
    announcement.comments.push({ user: req.user._id, body });
    await announcement.save();
    emitToAll('announcement:comment', {
      announcementId: String(announcement._id),
      commentCount: announcement.comments.length,
    });
    return res.status(201).json({
      comment: {
        _id: announcement.comments[announcement.comments.length - 1]._id,
        user: { _id: req.user._id, displayName: req.user.displayName },
        body,
        reactions: [],
        createdAt: new Date(),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/:announcementId/comments/:commentId/reactions',
  authenticate,
  async (req, res, next) => {
    const { announcementId, commentId } = req.params;
    if (
      !mongoose.isValidObjectId(announcementId) ||
      !mongoose.isValidObjectId(commentId)
    ) {
      return res.status(400).json({ message: 'Announcement and comment IDs must be valid.' });
    }

    try {
      const announcement = await Announcement.findOne({
        _id: announcementId,
        status: 'published',
      });
      if (!announcement) {
        return res.status(404).json({ message: 'Announcement not found.' });
      }
      const comment = announcement.comments.id(commentId);
      if (!comment) return res.status(404).json({ message: 'Comment not found.' });

      const reacted = (comment.reactions || []).some((id) => id.equals(req.user._id));
      const update = reacted
        ? { $pull: { 'comments.$[comment].reactions': req.user._id } }
        : { $addToSet: { 'comments.$[comment].reactions': req.user._id } };
      const updateResult = await Announcement.updateOne(
        {
          _id: announcement._id,
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

      const current = await Announcement.findOne({
        _id: announcement._id,
        'comments._id': comment._id,
      })
        .select('comments')
        .lean();
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
          scope: 'announcement',
          title: 'Someone reacted to your comment',
          message: `${req.user.displayName} liked your comment on "${announcement.title}".`.slice(0, 280),
          entityId: announcement._id,
        });
      }
      emitToAll('comment:reaction', {
        scope: 'announcement',
        announcementId: String(announcement._id),
        commentId: String(comment._id),
        reactionCount: userIds.length,
        userIds,
      });
      return res.json({ reacted: nowReacted, reactionCount: userIds.length });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/',
  authenticate,
  authorizeRoles('pastor', 'admin'),
  async (req, res, next) => {
    const body = req.body || {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const announcementBody =
      typeof body.body === 'string' ? body.body.trim() : '';
    const status = body.status || 'published';
    const banner = body.banner;

    if (!title || title.length > 160) {
      return res.status(400).json({
        message: 'title is required and must be 160 characters or fewer.',
      });
    }
    if (!announcementBody || announcementBody.length > 10000) {
      return res.status(400).json({
        message: 'body is required and must be 10,000 characters or fewer.',
      });
    }
    if (!['draft', 'published'].includes(status)) {
      return res.status(400).json({
        message: 'status must be draft or published.',
      });
    }
    if (
      banner !== undefined &&
      banner !== null &&
      (typeof banner.url !== 'string' ||
        typeof banner.publicId !== 'string' ||
        !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(banner.url) ||
        !banner.publicId.startsWith('tlbc/announcement-banners/'))
    ) {
      return res.status(400).json({
        message: 'banner must be an uploaded Cloudinary announcement image.',
      });
    }

    try {
      const announcement = await Announcement.create({
        title,
        body: announcementBody,
        ...(banner ? { banner } : {}),
        author: req.user._id,
        status,
        publishedAt: status === 'published' ? new Date() : null,
      });
      if (status === 'published') {
        await notifyAnnouncementPublished(announcement);
      }
      return res.status(201).json({
        message:
          status === 'published'
            ? 'Announcement published.'
            : 'Announcement saved as a draft.',
        announcement,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
