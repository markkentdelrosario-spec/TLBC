const express = require('express');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { getAuth } = require('firebase-admin/auth');
const firebaseApp = require('../config/firebaseAdmin');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const Beneficiary = require('../models/Beneficiary');
const LeaderboardState = require('../models/LeaderboardState');
const LifeCoachGroup = require('../models/LifeCoachGroup');
const User = require('../models/User');
const { createBrevoClient, sendRegistrationOtp } = require('../services/email');
const { ensureDesignationTeamMemberships } = require('../services/designationTeams');
const {
  SECONDARY_DESIGNATIONS,
  getDesignations,
} = require('../utils/designations');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('admin')];
const SYSTEM_ROLES = ['admin', 'pastor', 'member'];
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_HASH_ROUNDS = 10;
function validObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/users', ...adminOnly, async (req, res, next) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({ message: 'page and limit must be positive; limit cannot exceed 100.' });
  }
  if (!['all', 'active', 'deactivated', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'status must be all, active, deactivated, or pending.' });
  }
  if (search.length > 100) {
    return res.status(400).json({ message: 'search must be 100 characters or fewer.' });
  }
  try {
    const legacyUsers = await User.collection
      .find({
        $or: [
          { secondaryDesignation: { $exists: true } },
          { secondaryDesignations: { $type: 'string' } },
          { secondaryDesignations: { $in: ['KSP Leader', 'KSP leader', 'Life Coach'] } },
          { role: { $in: ['life_coach', 'beneficiary'] } },
        ],
      })
      .project({ role: 1, secondaryDesignation: 1, secondaryDesignations: 1 })
      .toArray();
    if (legacyUsers.length) {
      await User.collection.bulkWrite(
        legacyUsers.map((legacyUser) => {
          const existingDesignations = [
            ...(Array.isArray(legacyUser.secondaryDesignations)
              ? legacyUser.secondaryDesignations
              : legacyUser.secondaryDesignations
                ? [legacyUser.secondaryDesignations]
                : []),
            ...(Array.isArray(legacyUser.secondaryDesignation)
              ? legacyUser.secondaryDesignation
              : legacyUser.secondaryDesignation
                ? [legacyUser.secondaryDesignation]
                : []),
          ];
          const secondaryDesignations = getDesignations(existingDesignations);
          if (legacyUser.role === 'life_coach' && !secondaryDesignations.includes('LIFE COACH')) {
            secondaryDesignations.push('LIFE COACH');
          }
          return {
            updateOne: {
              filter: { _id: legacyUser._id },
              update: {
                $set: {
                  role: ['life_coach', 'beneficiary'].includes(legacyUser.role)
                    ? 'member'
                    : legacyUser.role,
                  secondaryDesignations,
                },
                $unset: { secondaryDesignation: '' },
              },
            },
          };
        })
      );
    }

    const legacyCoachGroups = await LifeCoachGroup.collection
      .find({ lifeCoach: { $exists: true, $ne: null } })
      .toArray();
    const legacyCoachUserIds = [
      ...new Set(legacyCoachGroups.map((group) => String(group.lifeCoach))),
    ];
    const existingCoachUsers = await User.find({
      _id: { $in: legacyCoachUserIds },
    })
      .select('_id')
      .lean();
    const existingCoachUserIds = new Set(
      existingCoachUsers.map((user) => String(user._id))
    );
    await Promise.all(
      legacyCoachGroups
        .filter((group) => existingCoachUserIds.has(String(group.lifeCoach)))
        .map((group) =>
          Beneficiary.updateOne(
            { user: group.lifeCoach },
            {
              $setOnInsert: {
                user: group.lifeCoach,
                group: group._id,
                isActive: true,
              },
            },
            { upsert: true, setDefaultsOnInsert: true }
          )
        )
      );

    const filter = {};
    if (status === 'active') Object.assign(filter, { isVerified: true, isActive: true });
    if (status === 'deactivated') Object.assign(filter, { isVerified: true, isActive: false });
    if (status === 'pending') filter.isVerified = false;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { displayName: pattern },
        { email: pattern },
        { phoneNumber: pattern },
      ];
    }
    const [users, total, activeCount, deactivatedCount, pendingCount] = await Promise.all([
      User.find(filter)
        .select(
          'displayName email phoneNumber role secondaryDesignations profilePicture profilePhoto birthDate isActive isVerified'
        )
        .sort({ displayName: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
      User.countDocuments({ isVerified: true, isActive: true }),
      User.countDocuments({ isVerified: true, isActive: false }),
      User.countDocuments({ isVerified: false }),
    ]);
    const memberProfiles = await Beneficiary.find({
      isActive: true,
      user: { $in: users.map((user) => user._id) },
    })
      .populate('group', 'groupNumber name')
      .lean();

    const profileByUser = new Map(
      memberProfiles.map((profile) => [
        String(profile.user),
        { _id: profile._id, group: profile.group, qrCodeId: profile.qrCodeId },
      ])
    );

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      counts: {
        active: activeCount,
        deactivated: deactivatedCount,
        pending: pendingCount,
      },
      users: users.map((user) => ({
        ...user,
        role:
          user.role === 'life_coach' || user.role === 'beneficiary'
            ? 'member'
            : user.role,
        secondaryDesignations: getDesignations(user),
        secondaryDesignation: getDesignations(user),
        beneficiary: profileByUser.get(String(user._id)) || null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/users', ...adminOnly, async (req, res, next) => {
  const body = req.body || {};
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
  const parsedBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate)
    ? new Date(`${birthDate}T00:00:00.000Z`)
    : null;

  if (!displayName || displayName.length > 120) {
    return res.status(400).json({ message: 'Full name is required and must be 120 characters or fewer.' });
  }
  if (!/^[^\s@]+@gmail\.com$/.test(email)) {
    return res.status(400).json({ message: 'Use a valid Gmail address ending in @gmail.com.' });
  }
  if (!parsedBirthDate || parsedBirthDate.toISOString().slice(0, 10) !== birthDate) {
    return res.status(400).json({ message: 'A valid birthday is required in YYYY-MM-DD format.' });
  }
  if (phoneNumber.length > 32) {
    return res.status(400).json({ message: 'Phone number must be 32 characters or fewer.' });
  }
  const brevo = createBrevoClient();
  if (!brevo) {
    return res.status(503).json({ message: 'Email registration is not configured. Set BREVO_API_KEY.' });
  }

  try {
    if (await User.exists({ email })) {
      return res.status(409).json({ message: 'An account or registration already exists for this Gmail address.' });
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const pendingUser = await User.create({
      email,
      displayName,
      phoneNumber: phoneNumber || undefined,
      birthDate: parsedBirthDate,
      role: 'member',
      isActive: false,
      isVerified: false,
      otp: await bcrypt.hash(otp, OTP_HASH_ROUNDS),
      otpExpires: new Date(Date.now() + OTP_TTL_MS),
      otpAttempts: 0,
      otpLastSentAt: new Date(),
    });
    try {
      await sendRegistrationOtp(brevo, email, displayName, otp);
    } catch (error) {
      await User.deleteOne({ _id: pendingUser._id });
      return next(error);
    }
    return res.status(202).json({
      message: `A verification code was sent to ${email}.`,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account or registration already exists for this Gmail address.' });
    }
    return next(error);
  }
});

router.patch('/users/:userId/status', ...adminOnly, async (req, res, next) => {
  const { userId } = req.params;
  const { isActive } = req.body || {};
  if (!validObjectId(userId)) {
    return res.status(400).json({ message: 'userId must be a valid user ID.' });
  }
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ message: 'isActive must be a boolean.' });
  }
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!user.isVerified) {
      return res.status(409).json({
        message: 'Accounts must complete email verification before their status can be changed.',
      });
    }
    if (!user.firebaseUid) {
      return res.status(409).json({
        message: 'This account is not linked to Firebase and its sign-in status cannot be changed.',
      });
    }

    const auth = getAuth(firebaseApp);
    const firebaseUser = await auth.getUser(user.firebaseUid);
    let firebaseStatusUpdated = false;
    try {
      await auth.updateUser(user.firebaseUid, { disabled: !isActive });
      firebaseStatusUpdated = true;
      user.isActive = isActive;
      await user.save();
    } catch (error) {
      if (firebaseStatusUpdated) {
        try {
          await auth.updateUser(user.firebaseUid, { disabled: firebaseUser.disabled });
        } catch (rollbackError) {
          console.error('Unable to restore Firebase account status after a failed user update.', rollbackError);
        }
      }
      return next(error);
    }

    return res.json({
      message: `User account ${isActive ? 'activated' : 'deactivated'}.`,
      user: { id: user._id, isActive: user.isActive },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/leaderboard/reset', ...adminOnly, async (req, res, next) => {
  try {
    const resetAt = new Date();
    await LeaderboardState.findOneAndUpdate(
      { _id: 'attendance' },
      { $set: { resetAt } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({
      message: 'Leaderboard reset. New attendance will count toward the rankings.',
      resetAt,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/groups', ...adminOnly, async (req, res, next) => {
  try {
    const groups = await LifeCoachGroup.find({ isActive: true })
      .select('groupNumber name')
      .sort({ groupNumber: 1 })
      .lean();
    return res.json({ groups });
  } catch (error) {
    return next(error);
  }
});

router.patch('/users/:userId/role', ...adminOnly, async (req, res, next) => {
  const { userId } = req.params;
  const role =
    typeof (req.body || {}).role === 'string'
      ? req.body.role.trim().toLowerCase()
      : '';

  if (!validObjectId(userId)) {
    return res.status(400).json({ message: 'userId must be a valid user ID.' });
  }
  if (!SYSTEM_ROLES.includes(role)) {
    return res.status(400).json({
      message: `role must be one of: ${SYSTEM_ROLES.join(', ')}.`,
    });
  }
  if (req.user._id.equals(userId)) {
    return res.status(409).json({ message: 'You cannot change your own role.' });
  }

  try {
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const wasLegacyLifeCoach = targetUser.role === 'life_coach';
    targetUser.role = role;
    if (role === 'member' && wasLegacyLifeCoach) {
      targetUser.secondaryDesignations = ['LIFE COACH'];
    }
    if (role === 'pastor') {
      targetUser.secondaryDesignations = [];
    }
    if (role !== 'member') {
      await Beneficiary.deleteOne({ user: targetUser._id });
    }
    await targetUser.save();
    await ensureDesignationTeamMemberships(targetUser);
    return res.json({
      message: 'User role updated.',
      user: {
        id: targetUser._id,
        displayName: targetUser.displayName,
        email: targetUser.email,
        role: targetUser.role,
        secondaryDesignations: targetUser.secondaryDesignations,
        secondaryDesignation: targetUser.secondaryDesignations,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch(
  '/users/:userId/secondary-designation',
  ...adminOnly,
  async (req, res, next) => {
    const { userId } = req.params;
    const rawDesignations = (req.body || {}).secondaryDesignations ??
      (req.body || {}).secondaryDesignation;
    const secondaryDesignations = rawDesignations === null
      ? []
      : Array.isArray(rawDesignations)
        ? rawDesignations.map((designation) =>
            typeof designation === 'string' ? designation.trim() : ''
          )
        : typeof rawDesignations === 'string'
          ? rawDesignations.trim() ? [rawDesignations.trim()] : []
          : undefined;

    if (!validObjectId(userId)) {
      return res.status(400).json({ message: 'userId must be a valid user ID.' });
    }
    if (secondaryDesignations === undefined) {
      return res.status(400).json({
        message: 'secondaryDesignations must be an array of designation strings.',
      });
    }
    if (new Set(secondaryDesignations).size !== secondaryDesignations.length) {
      return res.status(400).json({ message: 'Duplicate secondary designations are not allowed.' });
    }
    if (secondaryDesignations.some((designation) => !SECONDARY_DESIGNATIONS.includes(designation))) {
      return res.status(400).json({
        message: `secondaryDesignations must be one of: ${SECONDARY_DESIGNATIONS.join(', ')}.`,
      });
    }

    try {
      const currentUser = await User.findById(userId).select('_id role');
      if (!currentUser) {
        return res.status(404).json({ message: 'User not found.' });
      }
      if (!['member', 'admin'].includes(currentUser.role) && secondaryDesignations.length > 0) {
        return res.status(409).json({
          message: 'Secondary designations can only be assigned to members or admins.',
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { secondaryDesignations } },
        { new: true, runValidators: true }
      )
        .select('_id displayName email role secondaryDesignations profilePicture profilePhoto phoneNumber birthDate');
      await ensureDesignationTeamMemberships(user);
      return res.json({
        message: 'Secondary designation updated.',
        user: {
          id: user._id,
          _id: user._id,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          secondaryDesignations: getDesignations(user),
          secondaryDesignation: getDesignations(user),
          profilePicture: user.profilePicture || user.profilePhoto?.url || null,
          phoneNumber: user.phoneNumber || null,
          birthDate: user.birthDate || null,
        },
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
      }
      return next(error);
    }
  }
);

router.patch(
  '/members/:userId/group',
  ...adminOnly,
  async (req, res, next) => {
    const { userId } = req.params;
    const { groupId } = req.body || {};
    if (!validObjectId(userId) || (groupId !== null && !validObjectId(groupId))) {
      return res.status(400).json({
        message: 'userId must be a valid ID and groupId must be a valid ID or null.',
      });
    }

    try {
      const user = await User.findOne({
        _id: userId,
        role: 'member',
        isActive: true,
      });
      if (!user) {
        return res.status(404).json({ message: 'Active member not found.' });
      }
      if (groupId === null) {
        await Beneficiary.deleteOne({ user: user._id });
        return res.json({ message: 'Member group assignment removed.' });
      }

      const group = await LifeCoachGroup.findOne({ _id: groupId, isActive: true });
      if (!group) {
        return res.status(404).json({ message: 'Active group not found.' });
      }

      const memberProfile = await Beneficiary.findOneAndUpdate(
        { user: user._id },
        { $set: { group: group._id, isActive: true } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
      return res.json({
        message: 'Member group assignment updated.',
        member: memberProfile,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch('/users/:userId/birth-date', ...adminOnly, async (req, res, next) => {
  const { userId } = req.params;
  const rawBirthDate = (req.body || {}).birthDate;
  if (!validObjectId(userId)) {
    return res.status(400).json({ message: 'userId must be a valid user ID.' });
  }
  if (
    rawBirthDate !== null &&
    (typeof rawBirthDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(rawBirthDate) ||
      Number.isNaN(Date.parse(`${rawBirthDate}T00:00:00.000Z`)) ||
      new Date(`${rawBirthDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== rawBirthDate)
  ) {
    return res.status(400).json({
      message: 'birthDate must be a valid YYYY-MM-DD date or null.',
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.birthDate = rawBirthDate ? new Date(`${rawBirthDate}T00:00:00.000Z`) : null;
    await user.save();
    return res.json({ message: 'Member birth date updated.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
