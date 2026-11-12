const express = require('express');
const mongoose = require('mongoose');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const Beneficiary = require('../models/Beneficiary');
const LifeCoachGroup = require('../models/LifeCoachGroup');
const User = require('../models/User');
const { ensureDesignationTeamMemberships } = require('../services/designationTeams');
const {
  SECONDARY_DESIGNATIONS,
  getDesignations,
} = require('../utils/designations');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('admin')];
const SYSTEM_ROLES = ['admin', 'pastor', 'member'];
function validObjectId(value) {
  return mongoose.isValidObjectId(value);
}

router.get('/users', ...adminOnly, async (req, res, next) => {
  try {
    const legacyUsers = await User.collection
      .find({
        $or: [
          { secondaryDesignation: { $exists: true } },
          { secondaryDesignations: { $type: 'string' } },
          { role: { $in: ['life_coach', 'beneficiary'] } },
        ],
      })
      .project({ role: 1, secondaryDesignation: 1, secondaryDesignations: 1 })
      .toArray();
    if (legacyUsers.length) {
      await User.collection.bulkWrite(
        legacyUsers.map((legacyUser) => {
          const existingDesignations = Array.isArray(legacyUser.secondaryDesignations)
            ? legacyUser.secondaryDesignations
            : legacyUser.secondaryDesignation;
          const secondaryDesignations = getDesignations(existingDesignations);
          if (legacyUser.role === 'life_coach' && !secondaryDesignations.includes('KSP Leader')) {
            secondaryDesignations.push('KSP Leader');
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

    const [users, memberProfiles] = await Promise.all([
      User.find({})
        .select(
          'displayName email phoneNumber role secondaryDesignations profilePicture profilePhoto birthDate isActive'
        )
        .sort({ displayName: 1 })
        .lean(),
      Beneficiary.find({ isActive: true })
        .populate('group', 'groupNumber name')
        .lean(),
    ]);

    const profileByUser = new Map(
      memberProfiles.map((profile) => [
        String(profile.user),
        { _id: profile._id, group: profile.group, qrCodeId: profile.qrCodeId },
      ])
    );

    return res.json({
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
      targetUser.secondaryDesignations = ['KSP Leader'];
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
