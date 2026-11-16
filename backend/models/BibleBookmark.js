const mongoose = require('mongoose');

const bibleBookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reference: { type: String, required: true, trim: true, maxlength: 120 },
    translation: { type: String, required: true, trim: true, maxlength: 20 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

bibleBookmarkSchema.index(
  { user: 1, reference: 1, translation: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.BibleBookmark ||
  mongoose.model('BibleBookmark', bibleBookmarkSchema);
