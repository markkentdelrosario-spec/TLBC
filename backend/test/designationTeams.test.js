const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getDesignationTeamKey,
  getDesignationTeamName,
} = require('../utils/designations');

test('designation names map to their ministry teams', () => {
  assert.equal(getDesignationTeamName('KSP Leader'), 'KSP');
  assert.equal(getDesignationTeamName('Youth Leader'), 'Youth');
  assert.equal(getDesignationTeamName('Admin Team Leader'), 'Admin Team');
  assert.equal(getDesignationTeamName('Worship Leader'), 'Worship Team');
  assert.equal(getDesignationTeamName('Worship Team Member'), 'Worship Team');
  assert.equal(getDesignationTeamName('Media Team Member'), 'Media Team');
});

test('leader and member designations share a stable team key', () => {
  assert.equal(
    getDesignationTeamKey('Worship Leader'),
    getDesignationTeamKey('Worship Team Member')
  );
});
