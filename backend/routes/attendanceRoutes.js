const express = require('express');
const mongoose = require('mongoose');
const {
  authenticate,
  authorizeLifeCoachScanner,
  authorizeAttendanceMonitoring,
  authorizeAttendanceStatusManagement,
} = require('../middleware/authMiddleware');
const AttendanceLog = require('../models/AttendanceLog');
const Beneficiary = require('../models/Beneficiary');
const LifeCoachGroup = require('../models/LifeCoachGroup');
const User = require('../models/User');
const {
  getChurchAttendanceDate,
  getChurchAttendanceSundayDate,
} = require('../utils/attendanceDate');
const { createNotification } = require('../services/notifications');
const { emitToAll } = require('../realtime/realtime');

const router = express.Router();
const sundayAttendanceMessages = {
  present: 'So glad you were with us this Sunday! Thank you for worshipping with us.',
  late: 'Glad you made it this Sunday! Hope to see you a little earlier next time.',
  absent: 'We missed you this Sunday! Praying for you and hoping to see you next week.',
};
const canCheckIn = [authenticate, authorizeLifeCoachScanner];
const canViewGroupAttendance = [authenticate, authorizeAttendanceMonitoring];
const canManageAttendanceStatus = [authenticate, authorizeAttendanceStatusManagement];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findMemberProfile(user) {
  if (user.role !== 'member') return null;
  return Beneficiary.findOne({ user: user._id, isActive: true })
    .select('group')
    .populate('group', 'groupNumber name isActive');
}

router.get('/my-summary', authenticate, async (req, res, next) => {
  if (req.user.role !== 'member') {
    return res.status(403).json({ message: 'This summary is available to members.' });
  }
  try {
    const [attendanceCount, recentAttendance] = await Promise.all([
      AttendanceLog.countDocuments({
        user: req.user._id,
        status: { $ne: 'absent' },
      }),
      AttendanceLog.find({
        user: req.user._id,
        status: { $ne: 'absent' },
      })
        .sort({ attendanceDate: -1, checkedInAt: -1 })
        .limit(5)
        .populate('group', 'groupNumber name')
        .select('attendanceDate checkedInAt serviceName group status')
        .lean(),
    ]);
    return res.json({
      attendanceCount,
      recentAttendance: recentAttendance.map((entry) => ({
        date: entry.attendanceDate.toISOString().slice(0, 10),
        checkedInAt: entry.checkedInAt,
        serviceName: entry.serviceName,
        groupName: entry.group?.name || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/group-summary', ...canViewGroupAttendance, async (req, res, next) => {
  const { groupId } = req.query;
  if (groupId && !mongoose.isValidObjectId(groupId)) {
    return res.status(400).json({ message: 'groupId must be a valid ID.' });
  }

  try {
    const memberProfile = await findMemberProfile(req.user);
    const memberGroup = memberProfile?.group;
    if (req.user.role === 'member' && !memberGroup) {
      return res.status(403).json({
        message: 'No active group is assigned to this member.',
      });
    }
    if (
      req.user.role === 'member' &&
      groupId &&
      !memberGroup._id.equals(groupId)
    ) {
      return res.status(403).json({
        message: 'Members can only view attendance in their assigned group.',
      });
    }

    const selectedGroupId = memberGroup?._id || groupId;
    if (!selectedGroupId) {
      return res.status(400).json({
        message: 'groupId is required for an admin attendance overview.',
      });
    }
    const group = await LifeCoachGroup.findOne({
      _id: selectedGroupId,
      isActive: true,
    })
      .select('groupNumber name')
      .lean();
    if (!group) {
      return res.status(404).json({ message: 'Active group not found.' });
    }

    const today = getChurchAttendanceDate();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const roster = await Beneficiary.find({ group: group._id, isActive: true })
      .populate('user', 'displayName email phoneNumber isActive secondaryDesignations')
      .sort({ createdAt: 1 })
      .lean();
    const activeRoster = roster.filter((beneficiary) => beneficiary.user?.isActive);
    const [attendance] = await Promise.all([
      AttendanceLog.find({
        attendanceDate: { $gte: today, $lt: tomorrow },
        $or: [
          { group: group._id },
          { beneficiary: { $in: activeRoster.map((beneficiary) => beneficiary._id) } },
        ],
      })
        .populate('user', 'displayName secondaryDesignations')
        .populate({
          path: 'beneficiary',
          select: 'user',
          populate: {
            path: 'user',
            select: 'displayName secondaryDesignations',
          },
        })
        .populate('scannedBy', 'displayName')
        .sort({ checkedInAt: 1 })
        .lean(),
    ]);

    const logsByUser = new Map(
      attendance.map((log) => {
        const userId =
          log.user?._id || log.beneficiary?.user?._id || log.beneficiary?.user;
        return [String(userId), log];
      })
    );
    const members = activeRoster.map((beneficiary) => {
      const log = logsByUser.get(String(beneficiary.user._id));
      return {
        userId: beneficiary.user._id,
        beneficiaryId: beneficiary._id,
        name: beneficiary.user.displayName || 'Unnamed member',
        secondaryDesignations: beneficiary.user.secondaryDesignations || [],
        secondaryDesignation: beneficiary.user.secondaryDesignations || [],
        status: log?.status || 'absent',
        checkedInAt: log?.checkedInAt || null,
        serviceName: log?.serviceName || null,
        method: log?.method || null,
        scannedBy: log?.scannedBy?.displayName || null,
      };
    });
    const checkedInCount = members.filter(
      (member) => member.status === 'present' || member.status === 'late'
    ).length;

    return res.json({
      date: today.toISOString().slice(0, 10),
      group,
      beneficiaryCount: activeRoster.length,
      attendanceCount: checkedInCount,
      members,
      attendance: attendance.map((log) => ({
        id: log._id,
        beneficiaryName:
          log.user?.displayName || log.beneficiary?.user?.displayName || 'Unknown beneficiary',
        secondaryDesignations:
          log.user?.secondaryDesignations || log.beneficiary?.user?.secondaryDesignations || [],
        secondaryDesignation:
          log.user?.secondaryDesignations || log.beneficiary?.user?.secondaryDesignations || [],
        status: log.status || 'present',
        checkedInAt: log.checkedInAt,
        serviceName: log.serviceName,
        scannedBy: log.scannedBy?.displayName || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/status/:userId', ...canManageAttendanceStatus, async (req, res, next) => {
  const { userId } = req.params;
  const rawStatus = typeof req.body?.status === 'string'
    ? req.body.status.trim().toLowerCase()
    : '';
  const serviceName =
    typeof req.body?.serviceName === 'string'
      ? req.body.serviceName.trim()
      : 'Church Service';
  const groupId =
    typeof req.body?.groupId === 'string' ? req.body.groupId.trim() : '';

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: 'userId must be a valid ID.' });
  }
  if (!['present', 'late', 'absent'].includes(rawStatus)) {
    return res.status(400).json({ message: 'status must be Present, Late, or Absent.' });
  }
  if (serviceName.length < 1 || serviceName.length > 100) {
    return res.status(400).json({ message: 'serviceName must be between 1 and 100 characters.' });
  }

  try {
    const memberProfile = await findMemberProfile(req.user);
    if (req.user.role === 'member' && !memberProfile?.group) {
      return res.status(403).json({ message: 'No active group is assigned to this KSP Leader.' });
    }
    if (req.user.role === 'admin' && !mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({ message: 'groupId is required for admin status updates.' });
    }
    const selectedGroupId = memberProfile?.group?._id || groupId;
    const group = await LifeCoachGroup.findOne({ _id: selectedGroupId, isActive: true })
      .select('_id')
      .lean();
    if (!group) return res.status(404).json({ message: 'Active group not found.' });

    const [targetUser, beneficiary] = await Promise.all([
      User.findOne({ _id: userId, role: 'member', isActive: true }).select('_id displayName'),
      Beneficiary.findOne({ user: userId, group: group._id, isActive: true }).select('_id'),
    ]);
    if (!targetUser || !beneficiary) {
      return res.status(404).json({ message: 'Active member not found in this group.' });
    }

    const now = new Date();
    const attendanceDate = getChurchAttendanceDate(now);
    const tomorrow = new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000);
    let attendanceLog = await AttendanceLog.findOne({
      attendanceDate: { $gte: attendanceDate, $lt: tomorrow },
      $or: [{ user: targetUser._id }, { beneficiary: beneficiary._id }],
    });

    if (!attendanceLog) {
      attendanceLog = new AttendanceLog({
        user: targetUser._id,
        beneficiary: beneficiary._id,
        group: group._id,
        scannedBy: req.user._id,
        attendanceDate,
        serviceName,
        checkedInAt: now,
        method: 'manual',
      });
    }
    const previousStatus = attendanceLog.isNew ? null : attendanceLog.status;
    attendanceLog.status = rawStatus;
    attendanceLog.statusUpdatedAt = now;
    attendanceLog.serviceName = serviceName;
    if (!attendanceLog.group) attendanceLog.group = group._id;
    if (!attendanceLog.beneficiary) attendanceLog.beneficiary = beneficiary._id;
    if (!attendanceLog.user) attendanceLog.user = targetUser._id;
    await attendanceLog.save();
    if (
      attendanceDate.getUTCDay() === 0 &&
      previousStatus !== rawStatus
    ) {
      await createNotification({
        userId: targetUser._id,
        type: 'attendance_status',
        scope: 'attendance',
        title: `Sunday attendance: ${rawStatus}`,
        message: sundayAttendanceMessages[rawStatus],
        entityId: attendanceLog._id,
      });
    }

    return res.json({
      message: `Attendance status updated to ${rawStatus}.`,
      status: attendanceLog.status,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Attendance status changed in another request. Refresh and retry.' });
    }
    return next(error);
  }
});

router.get('/search', ...canCheckIn, async (req, res, next) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  if (query.length < 2 || query.length > 100) {
    return res
      .status(400)
      .json({ message: 'query must be between 2 and 100 characters.' });
  }

  try {
    const memberProfile = await findMemberProfile(req.user);
    const memberGroup = memberProfile?.group;
    if (req.user.role === 'member' && !memberGroup) {
      return res
        .status(403)
        .json({ message: 'No active group is assigned to this member.' });
    }

    const pattern = new RegExp(escapeRegex(query), 'i');
    const users = await User.find({
      role: 'member',
      isActive: true,
      $or: [
        { displayName: pattern },
        { email: pattern },
        { phoneNumber: pattern },
      ],
    })
      .select('_id displayName email phoneNumber')
      .limit(50)
      .lean();

    if (users.length === 0) return res.json({ beneficiaries: [] });
    const beneficiaries = await Beneficiary.find({
      isActive: true,
      user: { $in: users.map((user) => user._id) },
      ...(memberGroup ? { group: memberGroup._id } : {}),
    })
      .populate('user', 'displayName email phoneNumber')
      .populate('group', 'groupNumber name')
      .limit(20)
      .lean();

    return res.json({ beneficiaries });
  } catch (error) {
    return next(error);
  }
});

router.post('/check-in', ...canCheckIn, async (req, res, next) => {
  const body = req.body || {};
  const qrToken =
    typeof body.qrToken === 'string' ? body.qrToken.trim() : '';
  const userId =
    typeof body.userId === 'string' ? body.userId.trim() : '';
  const beneficiaryId =
    typeof body.beneficiaryId === 'string'
      ? body.beneficiaryId.trim()
      : '';
  const serviceName =
    typeof body.serviceName === 'string'
      ? body.serviceName.trim()
      : 'Church Service';

  const identifiers = [qrToken, userId, beneficiaryId].filter(Boolean);
  if (identifiers.length !== 1) {
    return res.status(400).json({
      message: 'Provide exactly one of userId, qrToken, or beneficiaryId.',
    });
  }
  if (qrToken.length > 128) {
    return res.status(400).json({ message: 'qrToken is too long.' });
  }
  if (userId && !mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: 'userId must be a valid MongoDB user ID.' });
  }
  if (beneficiaryId && !mongoose.isValidObjectId(beneficiaryId)) {
    return res.status(400).json({ message: 'beneficiaryId must be a valid ID.' });
  }
  if (!serviceName || serviceName.length > 100) {
    return res
      .status(400)
      .json({ message: 'serviceName must be between 1 and 100 characters.' });
  }

  try {
    const memberProfile = await findMemberProfile(req.user);
    const memberGroup = memberProfile?.group;
    if (req.user.role === 'member' && !memberGroup) {
      return res
        .status(403)
        .json({ message: 'No active group is assigned to this member.' });
    }

    let targetUser;
    let beneficiary;
    const scannedUserId =
      userId || (qrToken && mongoose.isValidObjectId(qrToken) ? qrToken : null);

    if (beneficiaryId) {
      beneficiary = await Beneficiary.findOne({
        _id: beneficiaryId,
        isActive: true,
      })
        .populate('user', 'displayName email isActive role secondaryDesignations')
        .populate('group', 'groupNumber name isActive');
      targetUser = beneficiary?.user;
    } else if (scannedUserId) {
      targetUser = await User.findById(scannedUserId);
      if (targetUser) {
        beneficiary = await Beneficiary.findOne({
          user: targetUser._id,
          isActive: true,
        }).populate('group', 'groupNumber name isActive');
      }
    } else {
      beneficiary = await Beneficiary.findOne({
        qrCodeId: qrToken,
        isActive: true,
      })
        .populate('user', 'displayName email isActive role secondaryDesignations')
        .populate('group', 'groupNumber name isActive');
      targetUser = beneficiary?.user;
    }

    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ message: 'Active user not found.' });
    }
    if (
      beneficiary?.group?.isActive &&
      memberGroup &&
      !beneficiary.group._id.equals(memberGroup._id)
    ) {
      return res.status(403).json({
        message: 'Members can only check in beneficiaries from their assigned group.',
      });
    }

    const checkedInAt = new Date();
    const attendanceDate = getChurchAttendanceSundayDate(checkedInAt);
    const duplicateQuery = {
      attendanceDate,
      $or: [{ user: targetUser._id }],
    };
    if (beneficiary) duplicateQuery.$or.push({ beneficiary: beneficiary._id });
    const existingAttendance = await AttendanceLog.findOne(duplicateQuery);
    const isQrScan = Boolean(qrToken || userId);
    if (existingAttendance && (!isQrScan || existingAttendance.method === 'qr')) {
      return res.status(409).json({
        message: 'Attendance has already been recorded for this user, date, and service.',
      });
    }

    const attendanceLog = existingAttendance || new AttendanceLog();
    attendanceLog.user = targetUser._id;
    if (beneficiary) attendanceLog.beneficiary = beneficiary._id;
    if (beneficiary?.group?.isActive) attendanceLog.group = beneficiary.group._id;
    attendanceLog.scannedBy = req.user._id;
    attendanceLog.attendanceDate = attendanceDate;
    attendanceLog.serviceName = serviceName;
    attendanceLog.checkedInAt = checkedInAt;
    attendanceLog.method = isQrScan ? 'qr' : 'manual';
    attendanceLog.status = 'present';
    attendanceLog.statusUpdatedAt = checkedInAt;
    await attendanceLog.save();
    emitToAll('attendance:recorded', {
      attendanceDate: attendanceDate.toISOString().slice(0, 10),
      userId: String(targetUser._id),
      groupId: beneficiary?.group?._id ? String(beneficiary.group._id) : null,
      status: attendanceLog.status,
    });
    if (attendanceDate.getUTCDay() === 0) {
      await createNotification({
        userId: targetUser._id,
        type: 'attendance_status',
        scope: 'attendance',
        title: 'Sunday attendance: present',
        message: sundayAttendanceMessages.present,
        entityId: attendanceLog._id,
      });
    }

    return res.status(201).json({
      message: 'Attendance recorded.',
      attendanceLog,
      beneficiary: {
        id: beneficiary?._id || targetUser._id,
        displayName: targetUser.displayName,
        group: beneficiary?.group || null,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Attendance has already been recorded for this user on this date.',
      });
    }
    return next(error);
  }
});

module.exports = router;
