const express = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const WelcomeSlide = require('../models/WelcomeSlide');

const router = express.Router();
const adminOnly = [authenticate, authorizeRoles('admin')];
const MAX_SLIDES_PER_UPLOAD = 20;
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_SLIDES_PER_UPLOAD },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      const error = new Error('Only JPEG, PNG, WebP, or GIF images are allowed.');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'tlbc/welcome-slideshow',
        public_id: randomUUID(),
        resource_type: 'image',
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

function parseText(value, field, maxLength, { required = false } = {}) {
  if (typeof value !== 'string') {
    return { error: required ? `${field} is required.` : `${field} must be text.` };
  }
  const text = value.trim();
  if (required && !text) return { error: `${field} is required.` };
  if (text.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer.` };
  }
  return { value: text };
}

function withImageUpload(req, res, next, field, maxFiles, handler) {
  imageUpload.array(field, maxFiles)(req, res, (error) => {
    if (error) {
      return res.status(error.status || 400).json({
        message:
          error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
            ? 'Image must be 5 MB or smaller.'
            : error instanceof multer.MulterError && error.code === 'LIMIT_UNEXPECTED_FILE'
              ? `Upload no more than ${maxFiles} image${maxFiles === 1 ? '' : 's'} at a time.`
            : error.message,
      });
    }
    return handler().catch(next);
  });
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const slides = await WelcomeSlide.find({ isActive: true })
      .sort({ position: 1, createdAt: 1 })
      .lean();
    return res.json({ slides });
  } catch (error) {
    return next(error);
  }
});

router.post('/', ...adminOnly, (req, res, next) =>
  withImageUpload(req, res, next, 'images', MAX_SLIDES_PER_UPLOAD, async () => {
    const captionResult = parseText(
      req.body?.caption === undefined ? '' : req.body.caption,
      'caption',
      500
    );
    if (captionResult.error) {
      return res.status(400).json({ message: captionResult.error });
    }
    if (!req.files?.length) {
      return res.status(400).json({ message: 'At least one image file is required.' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ message: 'Cloudinary is not configured on the server.' });
    }

    const uploads = [];
    try {
      for (const [index, file] of req.files.entries()) {
        const uploaded = await uploadToCloudinary(file);
        const originalName = file.originalname.replace(/\\/g, '/').split('/').pop();
        uploads.push({
          title: path.posix.basename(originalName, path.posix.extname(originalName))
            .replace(/[\u0000-\u001f]/g, '')
            .trim()
            .slice(0, 120) || `Welcome slide ${index + 1}`,
          caption: captionResult.value,
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
        });
      }

      const position = await WelcomeSlide.countDocuments({});
      const slides = await WelcomeSlide.insertMany(
        uploads.map((upload, index) => ({ ...upload, position: position + index })),
        { ordered: true }
      );
      return res.status(201).json({ slides });
    } catch (error) {
      try {
        await WelcomeSlide.deleteMany({
          publicId: { $in: uploads.map((upload) => upload.publicId) },
        });
      } catch (cleanupError) {
        console.error('Unable to remove partially saved welcome slides.', cleanupError);
      }
      await Promise.all(
        uploads.map(async (upload) => {
          try {
            await cloudinary.uploader.destroy(upload.publicId, { resource_type: 'image' });
          } catch (cleanupError) {
            console.error('Unable to remove an unclaimed welcome slide image.', cleanupError);
          }
        })
      );
      throw error;
    }
  })
);

router.patch('/:slideId', ...adminOnly, (req, res, next) =>
  withImageUpload(req, res, next, 'image', 1, async () => {
    if (!/^[a-f\d]{24}$/i.test(req.params.slideId)) {
      return res.status(400).json({ message: 'slideId must be a valid ID.' });
    }
    const title =
      req.body?.title === undefined
        ? undefined
        : parseText(req.body.title, 'title', 120, { required: true });
    const caption =
      req.body?.caption === undefined
        ? undefined
        : parseText(req.body.caption, 'caption', 500);
    if (title?.error || caption?.error) {
      return res.status(400).json({ message: title?.error || caption?.error });
    }
    if (
      title === undefined &&
      caption === undefined &&
      !(req.files?.length)
    ) {
      return res.status(400).json({ message: 'Provide a title, caption, or replacement image.' });
    }
    if (req.files?.length && !isCloudinaryConfigured()) {
      return res.status(503).json({ message: 'Cloudinary is not configured on the server.' });
    }

    const slide = await WelcomeSlide.findById(req.params.slideId);
    if (!slide) return res.status(404).json({ message: 'Welcome slide not found.' });

    const oldPublicId = slide.publicId;
    const uploaded = req.files?.[0] ? await uploadToCloudinary(req.files[0]) : null;
    if (title !== undefined) slide.title = title.value;
    if (caption !== undefined) slide.caption = caption.value;
    if (uploaded) {
      slide.url = uploaded.secure_url;
      slide.publicId = uploaded.public_id;
    }
    try {
      await slide.save();
    } catch (error) {
      if (uploaded) {
        try {
          await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: 'image' });
        } catch (cleanupError) {
          console.error('Unable to remove a replacement welcome slide image.', cleanupError);
        }
      }
      throw error;
    }
    if (uploaded) {
      await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' });
    }
    return res.json({ slide });
  })
);

router.patch('/reorder/list', ...adminOnly, async (req, res, next) => {
  const slideIds = req.body?.slideIds;
  if (
    !Array.isArray(slideIds) ||
    slideIds.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) ||
    new Set(slideIds).size !== slideIds.length
  ) {
    return res.status(400).json({ message: 'slideIds must be a unique list of valid IDs.' });
  }
  try {
    const slides = await WelcomeSlide.find({ isActive: true }).select('_id').lean();
    const actualIds = new Set(slides.map((slide) => String(slide._id)));
    if (
      actualIds.size !== slideIds.length ||
      slideIds.some((id) => !actualIds.has(id))
    ) {
      return res.status(409).json({ message: 'Refresh the slideshow before reordering.' });
    }
    if (slideIds.length === 0) return res.json({ slides: [] });
    await WelcomeSlide.bulkWrite(
      slideIds.map((id, position) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { position } },
        },
      }))
    );
    const orderedSlides = await WelcomeSlide.find({ isActive: true })
      .sort({ position: 1, createdAt: 1 })
      .lean();
    return res.json({ slides: orderedSlides });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:slideId', ...adminOnly, async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.slideId)) {
    return res.status(400).json({ message: 'slideId must be a valid ID.' });
  }
  try {
    const slide = await WelcomeSlide.findById(req.params.slideId);
    if (!slide) return res.status(404).json({ message: 'Welcome slide not found.' });
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ message: 'Cloudinary is not configured on the server.' });
    }
    await cloudinary.uploader.destroy(slide.publicId, { resource_type: 'image' });
    await slide.deleteOne();
    const remaining = await WelcomeSlide.find({ isActive: true }).sort({ position: 1, createdAt: 1 });
    await Promise.all(remaining.map((item, position) => {
      if (item.position === position) return null;
      item.position = position;
      return item.save();
    }));
    return res.json({ message: 'Welcome slide deleted.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
