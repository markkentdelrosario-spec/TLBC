const mongoose = require('mongoose');

const leaderboardStateSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'attendance' },
    resetAt: { type: Date, default: null },
  },
  { versionKey: false }
);

module.exports =
  mongoose.models.LeaderboardState ||
  mongoose.model('LeaderboardState', leaderboardStateSchema);
