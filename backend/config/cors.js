function getAllowedOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_ORIGIN,
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return [
    ...new Set([
      'http://localhost:5173',
      'https://tlbc-frontend.onrender.com',
      ...configuredOrigins,
    ]),
  ];
}

module.exports = { getAllowedOrigins };
