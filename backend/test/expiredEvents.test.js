const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CHURCH_TIME_ZONE = 'Asia/Manila';

const CustomEvent = require('../models/CustomEvent');
const {
  deactivateExpiredSpecialEvents,
  getExpiredSpecialEventFilter,
} = require('../services/expiredEvents');

test('special events expire after their church-local creation date passes', () => {
  assert.deepEqual(
    getExpiredSpecialEventFilter(new Date('2026-11-16T16:00:00.000Z')),
    {
      isActive: { $ne: false },
      createdAt: { $lt: new Date('2026-11-17T00:00:00.000Z') },
    }
  );
});

test('expired special events are deactivated', async () => {
  const originalUpdateMany = CustomEvent.updateMany;
  let updateDocument;
  CustomEvent.updateMany = async (filter, update) => {
    updateDocument = update;
    return { modifiedCount: 2 };
  };

  try {
    const deactivatedCount = await deactivateExpiredSpecialEvents(
      new Date('2026-11-16T16:00:00.000Z')
    );
    assert.equal(deactivatedCount, 2);
    assert.deepEqual(updateDocument, { $set: { isActive: false } });
  } finally {
    CustomEvent.updateMany = originalUpdateMany;
  }
});
