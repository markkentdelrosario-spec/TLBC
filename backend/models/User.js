const mongoose = require('mongoose');

const secondaryDesignations = [
  'KSP leader',
  'Youth Leader',
  'Music Team Leader',
  'Small Group Leader',
  'Tech Team Leader',
  'Creatives Leader',
  'Admin Team Leader',
  // Retained for existing members whose scanner access depends on this designation.
  'Life Coach',
  'Worship Ministry Member',
  'Media Team Member',
];

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
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    phoneNumber: { type: String, trim: true, maxlength: 32 },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'pastor', 'member'],
    },
    secondaryDesignation: {
      type: String,
      enum: secondaryDesignations,
      default: null,
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
