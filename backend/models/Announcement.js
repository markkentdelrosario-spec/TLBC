const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
  },
  { _id: false }
);

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
    banner: { type: bannerSchema, default: undefined },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      required: true,
    },
    publishedAt: { type: Date, default: null },
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, enum: ['like'], default: 'like' },
      },
    ],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        body: { type: String, required: true, trim: true, maxlength: 1000 },
        reactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

announcementSchema.index({ status: 1, publishedAt: -1 });

module.exports =
  mongoose.models.Announcement ||
  mongoose.model('Announcement', announcementSchema);
