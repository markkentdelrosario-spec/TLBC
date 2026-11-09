const mongoose = require('mongoose');

const ministryMediaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 255 },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    publicId: { type: String, required: true, trim: true, maxlength: 255 },
    resourceType: { type: String, enum: ['image', 'raw'], required: true },
    mimeType: { type: String, required: true, trim: true, maxlength: 100 },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.MinistryMedia ||
  mongoose.model('MinistryMedia', ministryMediaSchema);
