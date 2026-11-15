const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getDesignations,
  getDesignationTeamKey,
  getDesignationTeamName,
  hasLeadershipDesignation,
} = require('../utils/designations');

test('designation names map to their ministry teams', () => {
  assert.equal(getDesignationTeamName('LIFE COACH'), 'KSP');
  assert.equal(getDesignationTeamName('Youth Leader'), 'Youth');
  assert.equal(getDesignationTeamName('Admin Team Leader'), 'Admin Team');
  assert.equal(getDesignationTeamName('Worship Leader'), 'Worship Team');
  assert.equal(getDesignationTeamName('Worship Team Member'), 'Worship Team');
  assert.equal(getDesignationTeamName('Media Team Member'), 'Media Team');
});

test('legacy KSP Leader designations normalize to LIFE COACH', () => {
  assert.deepEqual(getDesignations(['KSP Leader', 'Life Coach']), ['LIFE COACH']);
  assert.equal(hasLeadershipDesignation({ secondaryDesignations: ['KSP Leader'] }), true);
});

test('leader and member designations share a stable team key', () => {
  assert.equal(
    getDesignationTeamKey('Worship Leader'),
    getDesignationTeamKey('Worship Team Member')
  );
});
