const mongoose = require('mongoose');

const lifeCoachGroupSchema = new mongoose.Schema(
  {
    groupNumber: {
      type: Number,
      required: true,
      enum: [1, 2, 3],
      unique: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.LifeCoachGroup ||
  mongoose.model('LifeCoachGroup', lifeCoachGroupSchema);
