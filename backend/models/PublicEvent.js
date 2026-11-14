const mongoose = require('mongoose');

const publicEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    eventDate: { type: Date, required: true },
    startTime: { type: String, trim: true, default: '' },
    endTime: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, maxlength: 240, default: '' },
    category: {
      type: String,
      enum: ['Church', 'Worship', 'Youth', 'Small Groups', 'Outreach', 'Other'],
      default: 'Church',
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reminderSentAt: { type: Date, default: null },
    reminderLockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

publicEventSchema.index({ status: 1, eventDate: 1 });

module.exports =
  mongoose.models.PublicEvent ||
  mongoose.model('PublicEvent', publicEventSchema);
