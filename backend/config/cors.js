function getAllowedOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_ORIGIN,
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return [...new Set(['http://localhost:5173', ...configuredOrigins])];
}

module.exports = { getAllowedOrigins };
