const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BIBLE_READING_PLANS,
  getBibleReadingPlan,
} = require('../utils/bibleReadingPlans');

test('reading plans have unique IDs and complete numbered day references', () => {
  const planIds = BIBLE_READING_PLANS.map((plan) => plan.id);
  assert.equal(new Set(planIds).size, planIds.length);
  for (const plan of BIBLE_READING_PLANS) {
    assert.ok(plan.days.length > 0);
    assert.deepEqual(
      plan.days.map((day) => day.dayNumber),
      Array.from({ length: plan.days.length }, (_, index) => index + 1)
    );
    assert.ok(plan.days.every((day) => typeof day.reference === 'string'));
  }
});

test('plan lookup rejects unknown plan IDs', () => {
  assert.equal(getBibleReadingPlan('gospel-of-john'), BIBLE_READING_PLANS[0]);
  assert.equal(getBibleReadingPlan('unknown-plan'), undefined);
});
