const mongoose = require('mongoose');

const verseOfDaySchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true },
    reference: { type: String, required: true },
    reactions: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.VerseOfDay ||
  mongoose.model('VerseOfDay', verseOfDaySchema);
