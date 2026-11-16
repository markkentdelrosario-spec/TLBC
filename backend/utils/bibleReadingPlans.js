const BIBLE_READING_PLANS = [
  {
    id: 'gospel-of-john',
    title: 'Seven Days in the Gospel of John',
    description: 'Read one chapter from John each day.',
    days: Array.from({ length: 7 }, (_, index) => ({
      dayNumber: index + 1,
      reference: `John ${index + 1}`,
    })),
  },
  {
    id: 'psalms-of-hope',
    title: 'Seven Psalms of Hope',
    description: 'A week of selected Psalms for reflection.',
    days: ['Psalm 23', 'Psalm 27', 'Psalm 46', 'Psalm 91', 'Psalm 121', 'Psalm 139', 'Psalm 145']
      .map((reference, index) => ({ dayNumber: index + 1, reference })),
  },
  {
    id: 'foundations-of-faith',
    title: 'Seven Days in Romans',
    description: 'Read the opening seven chapters of Romans.',
    days: Array.from({ length: 7 }, (_, index) => ({
      dayNumber: index + 1,
      reference: `Romans ${index + 1}`,
    })),
  },
];

function getBibleReadingPlan(planId) {
  return BIBLE_READING_PLANS.find((plan) => plan.id === planId);
}

module.exports = { BIBLE_READING_PLANS, getBibleReadingPlan };
