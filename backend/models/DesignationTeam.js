const mongoose = require('mongoose');

const designationTeamSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.DesignationTeam ||
  mongoose.model('DesignationTeam', designationTeamSchema);
