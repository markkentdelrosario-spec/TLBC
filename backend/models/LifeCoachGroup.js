const mongoose = require('mongoose');

const lifeCoachGroupSchema = new mongoose.Schema(
  {
    groupNumber: {
      type: Number,
      required: true,
      min: 1,
      unique: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.LifeCoachGroup ||
  mongoose.model('LifeCoachGroup', lifeCoachGroupSchema);
