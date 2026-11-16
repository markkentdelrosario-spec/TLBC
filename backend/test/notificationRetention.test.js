const test = require('node:test');
const assert = require('node:assert/strict');

const Notification = require('../models/Notification');

test('notifications expire 24 hours after creation', () => {
  const index = Notification.schema
    .indexes()
    .find(([keys]) => keys.createdAt === 1);
  assert.ok(index);
  assert.deepEqual(index[0], { createdAt: 1 });
  assert.equal(index[1].expireAfterSeconds, 24 * 60 * 60);
});
