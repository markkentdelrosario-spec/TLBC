const express = require('express');
const mongoose = require('mongoose');
const {
  authenticate,
  authorizeSecondaryDesignation,
} = require('../middleware/authMiddleware');
const Beneficiary = require('../models/Beneficiary');
const DesignationTeam = require('../models/DesignationTeam');
const {
  getDesignations,
  getDesignationTeamKey,
} = require('../utils/designations');
const User = require('../models/User');
const { ensureDesignationTeamMemberships } = require('../services/designationTeams');

const router = express.Router();

router.get('/my-teams', authenticate, async (req, res, next) => {
  const designations = getDesignations(req.user);
  const leadershipDesignations = designations.filter((designation) =>
    designation.endsWith('Leader')
  );
  if (req.user.role !== 'member' || designations.length === 0) {
    return res.status(403).json({
      message: 'A secondary designation is required for team tools.',
    });
  }

  try {
    await ensureDesignationTeamMemberships(req.user);
    const teamKeys = [...new Set(designations.map(getDesignationTeamKey))];
    const ledTeamKeys = new Set(leadershipDesignations.map(getDesignationTeamKey));
    const [teams, users] = await Promise.all([
      DesignationTeam.find({ key: { $in: teamKeys } })
        .populate('members', 'displayName email secondaryDesignations profilePicture isActive')
        .sort({ name: 1 })
        .lean(),
      User.find({ role: 'member', isActive: true })
        .select('displayName email secondaryDesignations')
        .sort({ displayName: 1 })
        .lean(),
    ]);

    return res.json({
      teams: teams.map((team) => ({
        id: team._id,
        designations: designations.filter(
          (designation) => getDesignationTeamKey(designation) === team.key
        ),
        canManage: ledTeamKeys.has(team.key),
        name: team.name,
        members: team.members
          .filter((member) => member.isActive)
          .map((member) => ({
            id: member._id,
            name: member.displayName,
            email: member.email,
            secondaryDesignations: member.secondaryDesignations || [],
            profilePicture: member.profilePicture || null,
          })),
      })),
      availableMembers: users.map((user) => ({
        id: user._id,
        name: user.displayName,
        email: user.email,
        secondaryDesignations: user.secondaryDesignations || [],
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/team-members',
  authenticate,
  authorizeSecondaryDesignation,
  async (req, res, next) => {
    const { teamId, userId } = req.body || {};
    if (!mongoose.isValidObjectId(teamId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        message: 'teamId and userId must be valid IDs.',
      });
    }

    try {
      const team = await DesignationTeam.findById(teamId);
      if (!team) {
        return res.status(404).json({ message: 'Team not found.' });
      }
      const ledTeamKeys = getDesignations(req.user)
        .filter((designation) => designation.endsWith('Leader'))
        .map(getDesignationTeamKey);
      if (!ledTeamKeys.includes(team.key)) {
        return res.status(403).json({
          message: 'You can only manage teams for your leadership designations.',
        });
      }

      const user = await User.findOne({
        _id: userId,
        role: 'member',
        isActive: true,
      }).select('_id displayName email secondaryDesignations');
      if (!user) {
        return res.status(404).json({
          message: 'No active member account was found.',
        });
      }
      const membershipUpdate = await DesignationTeam.updateOne(
        { _id: team._id, members: { $ne: user._id } },
        { $addToSet: { members: user._id } }
      );
      if (!membershipUpdate.matchedCount) {
        return res.status(404).json({ message: 'Team not found.' });
      }
      if (!membershipUpdate.modifiedCount) {
        return res.status(409).json({
          message: 'This member is already in the team.',
        });
      }

      return res.status(201).json({
        message: `${user.displayName} was added to the ${team.name} team.`,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  '/team-members/:teamId/:userId',
  authenticate,
  authorizeSecondaryDesignation,
  async (req, res, next) => {
    const { teamId, userId } = req.params;
    if (!mongoose.isValidObjectId(teamId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        message: 'teamId and userId must be valid IDs.',
      });
    }
    if (req.user._id.equals(userId)) {
      return res.status(409).json({
        message: 'You cannot remove yourself from a team you lead.',
      });
    }

    try {
      const team = await DesignationTeam.findById(teamId);
      if (!team) {
        return res.status(404).json({ message: 'Team not found.' });
      }
      const ledTeamKeys = getDesignations(req.user)
        .filter((designation) => designation.endsWith('Leader'))
        .map(getDesignationTeamKey);
      if (!ledTeamKeys.includes(team.key)) {
        return res.status(403).json({
          message: 'You can only manage teams for your leadership designations.',
        });
      }

      const result = await DesignationTeam.updateOne(
        { _id: team._id, members: userId },
        { $pull: { members: userId } }
      );
      if (!result.modifiedCount) {
        return res.status(404).json({
          message: 'This member is not assigned to the team.',
        });
      }

      const user = await User.findById(userId).select('displayName');
      return res.json({
        message: `${user?.displayName || 'Member'} was removed from the ${team.name} team.`,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get('/my-group', authenticate, async (req, res, next) => {
  if (req.user.role !== 'member' || getDesignations(req.user).length === 0) {
    return res.status(403).json({
      message: 'A secondary designation is required for group leadership tools.',
    });
  }
  try {
    const memberProfile = await Beneficiary.findOne({
      user: req.user._id,
      isActive: true,
    })
      .select('group')
      .populate('group', 'groupNumber name');
    if (!memberProfile?.group) {
      return res.status(404).json({
        message: 'Assign this leader to an active group to use group tools.',
      });
    }

    const roster = await Beneficiary.find({
      group: memberProfile.group._id,
      isActive: true,
    })
      .populate('user', 'displayName secondaryDesignations profilePicture isActive')
      .sort({ createdAt: 1 })
      .lean();
    return res.json({
      group: memberProfile.group,
      members: roster
        .filter((member) => member.user?.isActive)
        .map((member) => ({
          id: member.user._id,
          name: member.user.displayName,
          secondaryDesignations: member.user.secondaryDesignations || [],
          secondaryDesignation: member.user.secondaryDesignations || [],
          profilePicture: member.user.profilePicture || null,
        })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/members', authenticate, authorizeSecondaryDesignation, async (req, res, next) => {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254) {
    return res.status(400).json({
      message: 'Enter a valid email address for the member to add.',
    });
  }

  try {
    const leaderMembership = await Beneficiary.findOne({
      user: req.user._id,
      isActive: true,
    }).populate('group', 'groupNumber name isActive');
    if (!leaderMembership?.group?.isActive) {
      return res.status(403).json({
        message: 'You must be assigned to an active group to add members.',
      });
    }

    const user = await User.findOne({
      email,
      role: 'member',
      isActive: true,
    }).select('_id displayName secondaryDesignations');
    if (!user) {
      return res.status(404).json({
        message: 'No active member account was found for that email address.',
      });
    }

    let membership = await Beneficiary.findOne({ user: user._id });
    if (membership) {
      if (!membership.group.equals(leaderMembership.group._id)) {
        return res.status(409).json({
          message: 'This member is already assigned to another group.',
        });
      }
      if (membership.isActive) {
        return res.status(409).json({
          message: 'This member is already in your group.',
        });
      }
      membership.isActive = true;
      await membership.save();
    } else {
      membership = await Beneficiary.create({
        user: user._id,
        group: leaderMembership.group._id,
      });
    }

    return res.status(201).json({
      message: `${user.displayName} was added to ${leaderMembership.group.name}.`,
      member: {
        id: user._id,
        name: user.displayName,
        secondaryDesignations: user.secondaryDesignations || [],
        secondaryDesignation: user.secondaryDesignations || [],
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This member is already assigned to a group.',
      });
    }
    return next(error);
  }
});

router.delete(
  '/members/:userId',
  authenticate,
  authorizeSecondaryDesignation,
  async (req, res, next) => {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'userId must be a valid ID.' });
    }
    if (req.user._id.equals(userId)) {
      return res.status(409).json({
        message: 'You cannot remove yourself from your assigned group.',
      });
    }

    try {
      const leaderMembership = await Beneficiary.findOne({
        user: req.user._id,
        isActive: true,
      }).populate('group', 'groupNumber name isActive');
      if (!leaderMembership?.group?.isActive) {
        return res.status(403).json({
          message: 'You must be assigned to an active group to manage its members.',
        });
      }

      const memberProfile = await Beneficiary.findOne({
        user: userId,
        group: leaderMembership.group._id,
        isActive: true,
      })
        .populate('user', 'displayName')
        .select('_id user');
      if (!memberProfile) {
        return res.status(404).json({
          message: 'Active member not found in your group.',
        });
      }

      const result = await Beneficiary.deleteOne({
        _id: memberProfile._id,
        group: leaderMembership.group._id,
        isActive: true,
      });
      if (!result.deletedCount) {
        return res.status(404).json({
          message: 'Active member not found in your group.',
        });
      }

      return res.json({
        message: `${memberProfile.user?.displayName || 'Member'} was removed from ${leaderMembership.group.name}. Their account remains active.`,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
