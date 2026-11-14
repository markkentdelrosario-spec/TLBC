const express = require('express');
const {
  authenticate,
  authorizeRoles,
} = require('../middleware/authMiddleware');
const ChurchMinistry = require('../models/ChurchMinistry');
const { CHURCH_MINISTRIES } = require('../utils/churchMinistries');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('admin')];

async function getMinistries() {
  const savedMinistries = await ChurchMinistry.find({})
    .sort({ order: 1 })
    .lean();
  const savedBySlug = new Map(
    savedMinistries.map((ministry) => [ministry.slug, ministry])
  );
  return CHURCH_MINISTRIES.map((ministry) => ({
    ...ministry,
    description: savedBySlug.get(ministry.slug)?.description || '',
    _id: savedBySlug.get(ministry.slug)?._id || null,
  }));
}

router.get('/', async (req, res, next) => {
  try {
    return res.json({ ministries: await getMinistries() });
  } catch (error) {
    return next(error);
  }
});

router.get('/admin', ...adminOnly, async (req, res, next) => {
  try {
    return res.json({ ministries: await getMinistries() });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:slug', ...adminOnly, async (req, res, next) => {
  const ministry = CHURCH_MINISTRIES.find(
    (item) => item.slug === req.params.slug
  );
  if (!ministry) {
    return res.status(404).json({ message: 'Church ministry not found.' });
  }
  const description =
    typeof req.body?.description === 'string'
      ? req.body.description.trim()
      : undefined;
  if (description === undefined || description.length > 1200) {
    return res.status(400).json({
      message: 'description is required and must be 1,200 characters or fewer.',
    });
  }

  try {
    await ChurchMinistry.findOneAndUpdate(
      { slug: ministry.slug },
      {
        $set: { description },
        $setOnInsert: {
          name: ministry.name,
          order: ministry.order,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return res.json({ ministries: await getMinistries() });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This ministry is being updated. Please refresh and try again.',
      });
    }
    return next(error);
  }
});

module.exports = router;
