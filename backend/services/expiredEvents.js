const CustomEvent = require('../models/CustomEvent');
const { getChurchAttendanceDate } = require('../utils/attendanceDate');

function getExpiredSpecialEventFilter(now = new Date()) {
  return {
    isActive: { $ne: false },
    createdAt: { $lt: getChurchAttendanceDate(now) },
  };
}

async function deactivateExpiredSpecialEvents(now = new Date()) {
  const result = await CustomEvent.updateMany(
    getExpiredSpecialEventFilter(now),
    { $set: { isActive: false } }
  );
  return result.modifiedCount;
}

module.exports = {
  deactivateExpiredSpecialEvents,
  getExpiredSpecialEventFilter,
};
