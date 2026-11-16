const mongoose = require('mongoose');

const bibleReadingPlanProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: { type: String, required: true, trim: true },
    completedDayNumbers: { type: [Number], default: [] },
    startedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bibleReadingPlanProgressSchema.index({ user: 1, planId: 1 }, { unique: true });

module.exports =
  mongoose.models.BibleReadingPlanProgress ||
  mongoose.model('BibleReadingPlanProgress', bibleReadingPlanProgressSchema);
