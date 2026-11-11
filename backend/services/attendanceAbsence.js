const AttendanceLog = require('../models/AttendanceLog');
const Beneficiary = require('../models/Beneficiary');
const {
  getChurchAttendanceClock,
  getChurchAttendanceSundayDate,
} = require('../utils/attendanceDate');

async function markAbsentMembersIfDue(now = new Date()) {
  const { weekday, minutes } = getChurchAttendanceClock(now);
  if (weekday !== 'Sun' || minutes < 11 * 60) return 0;

  const attendanceDate = getChurchAttendanceSundayDate(now);
  const roster = await Beneficiary.find({ isActive: true })
    .select('user group')
    .populate({
      path: 'user',
      match: { isActive: true, role: 'member' },
      select: '_id',
    })
    .lean();

  let createdCount = 0;
  for (const beneficiary of roster) {
    if (!beneficiary.user) continue;

    try {
      const result = await AttendanceLog.updateOne(
        { user: beneficiary.user._id, attendanceDate },
        {
          $setOnInsert: {
            user: beneficiary.user._id,
            beneficiary: beneficiary._id,
            group: beneficiary.group,
            attendanceDate,
            serviceName: 'Church Service',
            checkedInAt: null,
            status: 'absent',
            statusUpdatedAt: now,
            method: 'automatic',
          },
        },
        { upsert: true }
      );
      createdCount += result.upsertedCount || 0;
    } catch (error) {
      if (error.code === 11000) continue;
      throw error;
    }
  }

  return createdCount;
}

module.exports = { markAbsentMembersIfDue };
