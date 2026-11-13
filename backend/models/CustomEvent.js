const mongoose = require('mongoose');

const customEventSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['KSP Gathering', 'Seminars', 'Other'],
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CustomEvent ||
  mongoose.model('CustomEvent', customEventSchema);
