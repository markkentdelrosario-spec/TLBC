const mongoose = require('mongoose');

const customEventAttendanceScanSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CustomEvent',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    beneficiary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Beneficiary',
    },
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    scannedAt: { type: Date, default: Date.now, required: true },
    method: { type: String, enum: ['qr'], default: 'qr', required: true },
  },
  {
    timestamps: true,
    collection: 'custom_event_attendance_scans',
    autoIndex: false,
  }
);

customEventAttendanceScanSchema.index(
  { event: 1, user: 1 },
  { unique: true, name: 'custom_event_user_scan_unique' }
);

module.exports =
  mongoose.models.CustomEventAttendanceScan ||
  mongoose.model('CustomEventAttendanceScan', customEventAttendanceScanSchema);
