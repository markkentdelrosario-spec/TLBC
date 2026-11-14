const express = require('express');
const {
  authenticate,
  authorizeReportAccess,
  authorizeRoles,
} = require('../middleware/authMiddleware');
const AttendanceLog = require('../models/AttendanceLog');
const Beneficiary = require('../models/Beneficiary');
const LeaderboardState = require('../models/LeaderboardState');
const LifeCoachGroup = require('../models/LifeCoachGroup');
const User = require('../models/User');
const {
  buildAttendanceDateMatch,
  getAttendanceTimeZone,
  getChurchAttendanceDate,
} = require('../utils/attendanceDate');
const { getDesignations } = require('../utils/designations');

const router = express.Router();
const reportAccess = [authenticate, authorizeReportAccess];
const leaderboardAccess = [authenticate, authorizeRoles('admin', 'member')];

function getDateMatch(req, res) {
  try {
    return buildAttendanceDateMatch(req.query.startDate, req.query.endDate);
  } catch (error) {
    res.status(400).json({ message: error.message });
    return null;
  }
}

function parseSundayDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('date must use YYYY-MM-DD format.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new RangeError('date is not a valid calendar date.');
  }
  if (date.getUTCDay() !== 0) {
    throw new RangeError('date must be a Sunday.');
  }
  return date;
}

function parseMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    throw new RangeError('month must use YYYY-MM format.');
  }
  const [year, month] = value.split('-').map(Number);
  if (month < 1 || month > 12) {
    throw new RangeError('month must be a valid calendar month.');
  }
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

function formatCheckInTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date);
}

router.get('/summary', ...reportAccess, async (req, res, next) => {
  const dateMatch = getDateMatch(req, res);
  if (dateMatch === null) return;

  const attendancePipeline = [
    {
      $match: {
        $expr: { $eq: ['$group', '$$groupId'] },
        status: { $ne: 'absent' },
      },
    },
    ...(dateMatch ? [{ $match: { attendanceDate: dateMatch } }] : []),
    { $count: 'attendanceCount' },
  ];

  try {
    const savedGroups = await LifeCoachGroup.aggregate([
      { $match: { groupNumber: { $in: [1, 2, 3] } } },
      {
        $lookup: {
          from: AttendanceLog.collection.name,
          let: { groupId: '$_id' },
          pipeline: attendancePipeline,
          as: 'attendance',
        },
      },
      {
        $project: {
          groupNumber: 1,
          name: 1,
          attendanceCount: {
            $ifNull: [{ $arrayElemAt: ['$attendance.attendanceCount', 0] }, 0],
          },
        },
      },
      { $sort: { groupNumber: 1 } },
    ]);
    const groupsByNumber = new Map(
      savedGroups.map((group) => [group.groupNumber, group])
    );
    const unassignedQuery = {
      $or: [{ group: { $exists: false } }, { group: null }],
      status: { $ne: 'absent' },
    };
    if (dateMatch) unassignedQuery.attendanceDate = dateMatch;
    const unassignedAttendance = await AttendanceLog.countDocuments(unassignedQuery);
    const groups = [1, 2, 3].map(
      (groupNumber) =>
        groupsByNumber.get(groupNumber) || {
          groupNumber,
          name: `Group ${groupNumber}`,
          attendanceCount: 0,
        }
    );

    return res.json({
      totalAttendance: groups.reduce(
        (total, group) => total + group.attendanceCount,
        unassignedAttendance
      ),
      unassignedAttendance,
      groups,
      filters: {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/sunday-report', ...reportAccess, async (req, res, next) => {
  let attendanceDate;
  try {
    attendanceDate = parseSundayDate(req.query.date);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const nextDate = new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000);
  const timeZone = getAttendanceTimeZone();

  try {
    const [groups, logs] = await Promise.all([
      LifeCoachGroup.find({ groupNumber: { $in: [1, 2, 3] } })
        .select('groupNumber name')
        .sort({ groupNumber: 1 })
        .lean(),
      AttendanceLog.find({
        attendanceDate: { $gte: attendanceDate, $lt: nextDate },
        status: { $ne: 'absent' },
      })
        .populate({
          path: 'beneficiary',
          select: 'user',
          populate: {
            path: 'user',
            select: 'displayName secondaryDesignations',
          },
        })
        .populate('user', 'displayName secondaryDesignations')
        .populate('group', 'groupNumber name')
        .sort({ checkedInAt: 1 })
        .lean(),
    ]);

    const groupsByNumber = new Map(
      groups.map((group) => [
        group.groupNumber,
        {
          groupNumber: group.groupNumber,
          name: group.name,
          attendanceCount: 0,
          attendees: [],
        },
      ])
    );

    const unassignedAttendees = [];
    for (const log of logs) {
      const groupNumber = log.group?.groupNumber;
      const attendeeUser = log.user || log.beneficiary?.user;
      if (![1, 2, 3].includes(groupNumber)) {
        unassignedAttendees.push({
          beneficiaryName: attendeeUser?.displayName || 'Unknown member',
          designation: getDesignations(attendeeUser).join(', ') || 'Member',
          status: log.status || 'present',
          checkedInAt: log.checkedInAt,
          checkedInAtFormatted: formatCheckInTime(log.checkedInAt, timeZone),
          serviceName: log.serviceName,
        });
        continue;
      }
      if (!groupsByNumber.has(groupNumber)) {
        groupsByNumber.set(groupNumber, {
          groupNumber,
          name: log.group.name || `Group ${groupNumber}`,
          attendanceCount: 0,
          attendees: [],
        });
      }

      const group = groupsByNumber.get(groupNumber);
      group.attendanceCount += 1;
      group.attendees.push({
        beneficiaryName: attendeeUser?.displayName || 'Unknown member',
        designation: getDesignations(attendeeUser).join(', ') || 'Member',
        status: log.status || 'present',
        checkedInAt: log.checkedInAt,
        checkedInAtFormatted: formatCheckInTime(
          log.checkedInAt,
          timeZone
        ),
        serviceName: log.serviceName,
      });
    }

    const reportGroups = [1, 2, 3].map(
      (groupNumber) =>
        groupsByNumber.get(groupNumber) || {
          groupNumber,
          name: `Group ${groupNumber}`,
          attendanceCount: 0,
          attendees: [],
        }
    );
    return res.json({
      date: req.query.date,
      timeZone,
      totalAttendance: reportGroups.reduce(
        (total, group) => total + group.attendanceCount,
        unassignedAttendees.length
      ),
      groups: reportGroups,
      unassignedAttendees,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/monthly-sundays', ...reportAccess, async (req, res, next) => {
  let monthRange;
  try {
    monthRange = parseMonth(req.query.month);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  try {
    const [members, logs] = await Promise.all([
      User.find({ role: 'member', isActive: true })
        .select('displayName secondaryDesignations')
        .sort({ displayName: 1 })
        .lean(),
      AttendanceLog.find({
        attendanceDate: { $gte: monthRange.start, $lt: monthRange.end },
      })
        .select('user beneficiary attendanceDate status')
        .populate({
          path: 'beneficiary',
          select: 'user',
          populate: { path: 'user', select: '_id' },
        })
        .lean(),
    ]);

    const membersById = new Map(members.map((member) => [String(member._id), member]));
    const statusesByDateAndMember = new Map();
    for (const log of logs) {
      const memberId = log.user || log.beneficiary?.user?._id;
      if (!memberId || !membersById.has(String(memberId))) continue;
      const date = log.attendanceDate.toISOString().slice(0, 10);
      if (!statusesByDateAndMember.has(date)) statusesByDateAndMember.set(date, new Map());
      statusesByDateAndMember.get(date).set(String(memberId), log.status || 'present');
    }

    const rows = [];
    const sundayDates = [];
    const today = getChurchAttendanceDate();
    for (
      let date = new Date(monthRange.start);
      date < monthRange.end;
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      if (date.getUTCDay() !== 0) continue;
      const dateString = date.toISOString().slice(0, 10);
      sundayDates.push(dateString);
      const statuses = statusesByDateAndMember.get(dateString) || new Map();
      for (const member of members) {
        rows.push({
          date: dateString,
          memberId: String(member._id),
          memberName: member.displayName,
          secondaryDesignation: getDesignations(member).join(', '),
          status: statuses.get(String(member._id)) ||
            (date > today ? 'upcoming' : 'absent'),
        });
      }
    }

    return res.json({
      month: req.query.month,
      totalAttendance: rows.filter((row) =>
        ['present', 'late'].includes(row.status)
      ).length,
      sundayDates,
      rows,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/leaderboard', ...leaderboardAccess, async (req, res, next) => {
  try {
    const leaderboardState = await LeaderboardState.findById('attendance')
      .select('resetAt')
      .lean();
    const members = await AttendanceLog.aggregate([
      {
        $match: {
          $or: [{ status: 'present' }, { status: { $exists: false } }],
          ...(leaderboardState?.resetAt
            ? { checkedInAt: { $gte: leaderboardState.resetAt } }
            : {}),
        },
      },
      {
        $lookup: {
          from: Beneficiary.collection.name,
          localField: 'beneficiary',
          foreignField: '_id',
          as: 'beneficiaryInfo',
        },
      },
      {
        $addFields: {
          memberId: {
            $ifNull: ['$user', { $arrayElemAt: ['$beneficiaryInfo.user', 0] }],
          },
        },
      },
      { $match: { memberId: { $exists: true, $ne: null } } },
      { $group: { _id: '$memberId', presentCount: { $sum: 1 } } },
      {
        $lookup: {
          from: User.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'member',
        },
      },
      { $unwind: '$member' },
      { $match: { 'member.role': 'member', 'member.isActive': true } },
      {
        $project: {
          _id: 0,
          memberId: '$_id',
          memberName: '$member.displayName',
          presentCount: 1,
        },
      },
      { $sort: { presentCount: -1, memberName: 1 } },
    ]);
    const rankedIds = new Set(members.map((member) => String(member.memberId)));
    const zeroAttendanceMembers = await User.find({
      role: 'member',
      isActive: true,
      _id: { $nin: [...rankedIds] },
    })
      .select('_id displayName')
      .lean();
    return res.json({
      members: [
        ...members,
        ...zeroAttendanceMembers.map((member) => ({
          memberId: member._id,
          memberName: member.displayName,
          presentCount: 0,
        })),
      ].sort(
        (left, right) =>
          right.presentCount - left.presentCount ||
          left.memberName.localeCompare(right.memberName)
      ),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/daily', ...reportAccess, async (req, res, next) => {
  const dateMatch = getDateMatch(req, res);
  if (dateMatch === null) return;

  const match = {
    ...(dateMatch ? { attendanceDate: dateMatch } : {}),
    status: { $ne: 'absent' },
  };
  try {
    const dailyAttendance = await AttendanceLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: { date: '$attendanceDate', group: '$group' },
          attendanceCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: LifeCoachGroup.collection.name,
          localField: '_id.group',
          foreignField: '_id',
          as: 'group',
        },
      },
      { $unwind: '$group' },
      {
        $project: {
          _id: 0,
          attendanceDate: '$_id.date',
          groupNumber: '$group.groupNumber',
          groupName: '$group.name',
          attendanceCount: 1,
        },
      },
      { $sort: { attendanceDate: 1, groupNumber: 1 } },
    ]);
    return res.json({ dailyAttendance });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
