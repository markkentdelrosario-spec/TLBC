const test = require('node:test');
const assert = require('node:assert/strict');
const { getReadiness } = require('../utils/healthStatus');

test('readiness requires an active MongoDB connection', () => {
  assert.deepEqual(getReadiness(1), {
    statusCode: 200,
    body: { status: 'ready', database: 'connected' },
  });
  assert.deepEqual(getReadiness(0), {
    statusCode: 503,
    body: { status: 'not_ready', database: 'disconnected' },
  });
});
