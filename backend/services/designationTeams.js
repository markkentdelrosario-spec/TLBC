const DesignationTeam = require('../models/DesignationTeam');
const {
  getDesignations,
  getDesignationTeamName,
  getDesignationTeamKey,
} = require('../utils/designations');

async function ensureDesignationTeamMemberships(user) {
  const designations = getDesignations(user);

  for (const designation of designations) {
    try {
      await DesignationTeam.findOneAndUpdate(
        { key: getDesignationTeamKey(designation) },
        {
          $setOnInsert: {
            key: getDesignationTeamKey(designation),
            name: getDesignationTeamName(designation),
          },
          $addToSet: { members: user._id },
        },
        { upsert: true, runValidators: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      await DesignationTeam.updateOne(
        { key: getDesignationTeamKey(designation) },
        { $addToSet: { members: user._id } }
      );
    }
  }
}

module.exports = { ensureDesignationTeamMemberships };
