const mongoose = require('mongoose');

const { SECONDARY_DESIGNATIONS } = require('../utils/designations');

const profilePhotoSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      unique: true,
      immutable: true,
      trim: true,
      sparse: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, select: false },
    otp: { type: String, select: false },
    otpExpires: { type: Date, default: null, select: false },
    otpAttempts: { type: Number, default: 0, min: 0, select: false },
    otpLastSentAt: { type: Date, default: null, select: false },
    isVerified: { type: Boolean, default: false },
    phoneNumber: { type: String, trim: true, maxlength: 32 },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'pastor', 'member'],
    },
    secondaryDesignations: {
      type: [{ type: String, enum: SECONDARY_DESIGNATIONS }],
      default: [],
    },
    birthDate: { type: Date, default: null },
    profilePhoto: { type: profilePhotoSchema, default: undefined },
    profilePicture: { type: String, trim: true, maxlength: 2048 },
    pushTokens: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.User || mongoose.model('User', userSchema);
