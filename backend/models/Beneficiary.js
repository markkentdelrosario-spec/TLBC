const crypto = require('node:crypto');
const mongoose = require('mongoose');

const beneficiarySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LifeCoachGroup',
      required: true,
    },
    qrCodeId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => crypto.randomBytes(16).toString('hex'),
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Beneficiary ||
  mongoose.model('Beneficiary', beneficiarySchema);
