const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    beneficiary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Beneficiary',
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LifeCoachGroup',
    },
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Store the church-local attendance date normalized to midnight.
    attendanceDate: { type: Date, required: true },
    serviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      default: 'Church Service',
    },
    checkedInAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['present', 'late', 'absent'],
      required: true,
      default: 'present',
    },
    statusUpdatedAt: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ['qr', 'manual', 'automatic'],
      required: true,
      default: 'qr',
    },
  },
  { timestamps: true, autoIndex: false }
);

attendanceLogSchema.index(
  { user: 1, attendanceDate: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: 'objectId' } },
    name: 'user_attendance_date_unique',
  }
);

module.exports =
  mongoose.models.AttendanceLog ||
  mongoose.model('AttendanceLog', attendanceLogSchema);
