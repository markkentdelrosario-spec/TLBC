const mongoose = require('mongoose');

const welcomeSlideSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    caption: { type: String, trim: true, maxlength: 500, default: '' },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    publicId: { type: String, required: true, trim: true, maxlength: 255 },
    position: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

welcomeSlideSchema.index({ position: 1, createdAt: 1 });

module.exports =
  mongoose.models.WelcomeSlide ||
  mongoose.model('WelcomeSlide', welcomeSlideSchema);
