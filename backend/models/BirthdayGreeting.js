const mongoose = require('mongoose');

const birthdayGreetingSchema = new mongoose.Schema(
  {
    celebrant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    year: { type: Number, required: true },
    reactions: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

birthdayGreetingSchema.index({ celebrant: 1, year: 1 }, { unique: true });

module.exports =
  mongoose.models.BirthdayGreeting ||
  mongoose.model('BirthdayGreeting', birthdayGreetingSchema);
