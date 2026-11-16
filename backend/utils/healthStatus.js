function getReadiness(databaseReadyState) {
  const isDatabaseConnected = databaseReadyState === 1;
  return {
    statusCode: isDatabaseConnected ? 200 : 503,
    body: {
      status: isDatabaseConnected ? 'ready' : 'not_ready',
      database: isDatabaseConnected ? 'connected' : 'disconnected',
    },
  };
}

module.exports = { getReadiness };
