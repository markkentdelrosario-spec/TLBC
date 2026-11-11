const express = require('express');
const {
  authenticate,
  authorizeSecondaryDesignation,
} = require('../middleware/authMiddleware');
const Beneficiary = require('../models/Beneficiary');
const { getDesignations } = require('../utils/designations');
const User = require('../models/User');

const router = express.Router();

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

module.exports = router;
