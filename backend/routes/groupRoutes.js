const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const Beneficiary = require('../models/Beneficiary');
const { getDesignations } = require('../utils/designations');

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

module.exports = router;
