export function getDesignations(userOrValue) {
  const value =
    userOrValue?.secondaryDesignations ??
    userOrValue?.secondaryDesignation ??
    userOrValue;
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : [];
  const legacyValues = {
    'KSP leader': 'KSP Leader',
    'Life Coach': 'KSP Leader',
    'Music Team Leader': 'Worship Leader',
    'Tech Team Leader': 'Media Team Leader',
    'Creatives Leader': 'Media Team Leader',
    'Worship Ministry Member': 'Worship Team Member',
  };
  return [...new Set(rawValues
    .filter((designation) => typeof designation === 'string' && designation.trim())
    .map((designation) => legacyValues[designation.trim()] || designation.trim()))];
}

export function hasDesignation(userOrValue, designation) {
  return getDesignations(userOrValue).some(
    (value) => value.trim().toLowerCase() === designation.trim().toLowerCase()
  );
}

export function hasLeadershipDesignation(userOrValue) {
  return getDesignations(userOrValue).some((designation) =>
    designation.endsWith('Leader')
  );
}
