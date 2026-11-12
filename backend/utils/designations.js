const SECONDARY_DESIGNATIONS = [
  'KSP Leader',
  'Youth Leader',
  'Worship Leader',
  'Small Group Leader',
  'Audio Team Leader',
  'Media Team Leader',
  'Admin Team Leader',
  'Worship Team Member',
  'Media Team Member',
];

const LEGACY_DESIGNATION_MAP = new Map([
  ['KSP leader', 'KSP Leader'],
  ['Life Coach', 'KSP Leader'],
  ['Music Team Leader', 'Worship Leader'],
  ['Tech Team Leader', 'Media Team Leader'],
  ['Creatives Leader', 'Media Team Leader'],
  ['Worship Ministry Member', 'Worship Team Member'],
]);

function getDesignations(userOrValue) {
  const value =
    userOrValue?.secondaryDesignations ??
    userOrValue?.secondaryDesignation ??
    userOrValue;
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];
  return [...new Set(rawValues
    .filter((designation) => typeof designation === 'string' && designation.trim())
    .map((designation) => LEGACY_DESIGNATION_MAP.get(designation.trim()) || designation.trim())
    .filter((designation) => SECONDARY_DESIGNATIONS.includes(designation)))];
}

function hasDesignation(user, designation) {
  return getDesignations(user).some(
    (value) => value.trim().toLowerCase() === designation.trim().toLowerCase()
  );
}

function hasLeadershipDesignation(user) {
  return getDesignations(user).some((designation) => designation.endsWith('Leader'));
}

function getDesignationTeamName(designation) {
  const name = designation.replace(/ (?:Leader|Member)$/, '');
  return name === 'Worship' ? 'Worship Team' : name;
}

function getDesignationTeamKey(designation) {
  return getDesignationTeamName(designation).toLowerCase().replace(/\s+/g, '-');
}

module.exports = {
  SECONDARY_DESIGNATIONS,
  getDesignations,
  getDesignationTeamName,
  getDesignationTeamKey,
  hasDesignation,
  hasLeadershipDesignation,
};
