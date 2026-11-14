const mongoose = require('mongoose');

const churchMinistrySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1200, default: '' },
    order: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ChurchMinistry ||
  mongoose.model('ChurchMinistry', churchMinistrySchema);
