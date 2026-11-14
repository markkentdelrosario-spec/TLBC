const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type: {
      type: String,
      enum: ['announcement', 'comment_reaction', 'attendance_status', 'event_reminder'],
      required: true,
    },
    scope: {
      type: String,
      enum: ['announcement', 'birthday', 'attendance', 'event'],
      default: 'announcement',
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 300 },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    dedupeKey: { type: String, trim: true, sparse: true, unique: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model('Notification', notificationSchema);
