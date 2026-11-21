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
const DEFAULT_ANNOUNCEMENT_PAGE_SIZE = 4;
const MAX_ANNOUNCEMENT_PAGE_SIZE = 20;
const MAX_ANNOUNCEMENT_IMAGES = 10;

function isAnnouncementImage(image) {
  return (
    image &&
    typeof image.url === 'string' &&
    typeof image.publicId === 'string' &&
    /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(image.url) &&
    image.publicId.startsWith('tlbc/announcement-banners/')
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/', authenticate, async (req, res, next) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || DEFAULT_ANNOUNCEMENT_PAGE_SIZE;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (page < 1 || limit < 1 || limit > MAX_ANNOUNCEMENT_PAGE_SIZE) {
    return res.status(400).json({
      message: `page and limit must be positive; limit cannot exceed ${MAX_ANNOUNCEMENT_PAGE_SIZE}.`,
    });
  }
  if (search.length > 100) {
    return res.status(400).json({ message: 'search must be 100 characters or fewer.' });
  }
  const filter = { status: 'published' };
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: pattern }, { body: pattern }];
  }

  try {
    const [announcements, total] = await Promise.all([
      Announcement.aggregate([
        { $match: filter },
        { $sort: { publishedAt: -1, createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            title: 1,
            body: 1,
            banner: 1,
            images: 1,
            author: 1,
            status: 1,
            publishedAt: 1,
            createdAt: 1,
            reactions: 1,
            commentCount: {
              $size: { $ifNull: ['$comments', []] },
            },
            comments: {
              $slice: [{ $ifNull: ['$comments', []] }, -2],
            },
          },
        },
      ]).then((rows) =>
        Announcement.populate(rows, [
          { path: 'author', select: 'displayName' },
          { path: 'reactions.user', select: '_id' },
          { path: 'comments.user', select: 'displayName' },
          { path: 'comments.reactions', select: '_id' },
        ])
      ),
      Announcement.countDocuments(filter),
    ]);
    return res.json({
      announcements,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
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
    const images = body.images;

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
      !isAnnouncementImage(banner)
    ) {
      return res.status(400).json({
        message: 'banner must be an uploaded Cloudinary announcement image.',
      });
    }
    if (
      images !== undefined &&
      (!Array.isArray(images) ||
        images.length > MAX_ANNOUNCEMENT_IMAGES ||
        images.some((image) => !isAnnouncementImage(image)))
    ) {
      return res.status(400).json({
        message: `images must contain no more than ${MAX_ANNOUNCEMENT_IMAGES} uploaded Cloudinary announcement images.`,
      });
    }

    try {
      const announcement = await Announcement.create({
        title,
        body: announcementBody,
        ...(banner ? { banner } : {}),
        ...(images ? { images } : {}),
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

router.delete(
  '/:announcementId',
  authenticate,
  authorizeRoles('admin'),
  async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.announcementId)) {
      return res.status(400).json({ message: 'announcementId must be a valid ID.' });
    }
    try {
      const announcement = await Announcement.findByIdAndDelete(
        req.params.announcementId
      );
      if (!announcement) {
        return res.status(404).json({ message: 'Announcement not found.' });
      }
      emitToAll('announcement:deleted', {
        announcementId: String(announcement._id),
      });
      return res.json({ message: 'Announcement deleted.' });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
