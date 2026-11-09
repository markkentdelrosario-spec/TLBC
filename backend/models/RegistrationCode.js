const mongoose = require('mongoose');

const registrationCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    phoneNumber: { type: String, trim: true, maxlength: 32 },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

registrationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.RegistrationCode ||
  mongoose.model('RegistrationCode', registrationCodeSchema);
