const express = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { authenticate } = require('../middleware/authMiddleware');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const MinistryMedia = require('../models/MinistryMedia');
const { getDesignations } = require('../utils/designations');

const router = express.Router();
const uploadFolders = new Set([
  'profile-pictures',
  'announcement-banners',
  'branding',
]);
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      const error = new Error('Only JPEG, PNG, WebP, or GIF images are allowed.');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});
const mediaTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
]);
const ministryMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!mediaTypes.has(file.mimetype)) {
      const error = new Error('Upload an image, PDF, Word, PowerPoint, or CSV file.');
      error.status = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return finish(reject, error);
      return finish(resolve, result);
    });
    stream.on('error', (error) => finish(reject, error));
    stream.end(buffer);
  });
}

function uploadToCloudinary(file, folder) {
  return uploadBufferToCloudinary(file.buffer, {
    folder: `tlbc/${folder}`,
    public_id: randomUUID(),
    resource_type: 'image',
    overwrite: false,
  });
}

function uploadMinistryMedia(file) {
  const isImage = file.mimetype.startsWith('image/');
  const extension = path.extname(file.originalname).toLowerCase();
  const publicId = `tlbc/ministry-media/${randomUUID()}${isImage ? '' : extension}`;
  return uploadBufferToCloudinary(file.buffer, {
    public_id: publicId,
    resource_type: isImage ? 'image' : 'raw',
    overwrite: false,
  });
}

function respondToCloudinaryError(res, error, operation) {
  console.error(`Cloudinary ${operation} failed.`, {
    httpCode: error?.http_code || null,
    code: error?.code || null,
    requestId: error?.request_id || null,
    message: error?.message || 'No provider message was returned.',
  });
  return res.status(502).json({
    message: 'Image storage failed. Check the Cloudinary configuration and try again.',
  });
}

async function handleImageUpload(req, res, next) {
  const folder =
    typeof req.body?.folder === 'string' ? req.body.folder.trim() : '';
  if (!req.file) {
    return res.status(400).json({ message: 'An image file is required.' });
  }
  if (!uploadFolders.has(folder)) {
    return res.status(400).json({
      message: 'folder must be profile-pictures, announcement-banners, or branding.',
    });
  }
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      message: 'Cloudinary is not configured on the server.',
    });
  }

  let result;
  try {
    result = await uploadToCloudinary(req.file, folder);
  } catch (error) {
    return respondToCloudinaryError(res, error, 'image upload');
  }
  if (!result?.secure_url || !result?.public_id) {
    return next(new Error('Cloudinary completed the upload without returning an image URL.'));
  }
  return res.status(201).json({
    secure_url: result.secure_url,
    public_id: result.public_id,
  });
}

function handleMulterError(uploadError, res, next, fileLabel) {
  if (!uploadError) return false;
  if (uploadError instanceof multer.MulterError) {
    return res.status(400).json({
      message:
        uploadError.code === 'LIMIT_FILE_SIZE'
          ? `${fileLabel} must be 10 MB or smaller.`
          : 'Please upload one file at a time.',
    });
  }
  if (uploadError.status === 400) {
    return res.status(400).json({ message: uploadError.message });
  }
  next(uploadError);
  return true;
}

router.post('/', authenticate, (req, res, next) => {
  imageUpload.single('image')(req, res, (uploadError) => {
    if (handleMulterError(uploadError, res, next, 'Image')) return;
    handleImageUpload(req, res, next).catch(next);
  });
});

router.get('/ministry-media', authenticate, async (req, res, next) => {
  try {
    const media = await MinistryMedia.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('uploadedBy', 'displayName')
      .lean();
    return res.json({ media });
  } catch (error) {
    return next(error);
  }
});

async function handleMinistryMediaUpload(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ message: 'A media file is required.' });
  }
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({
      message: 'Cloudinary is not configured on the server.',
    });
  }

  let result;
  try {
    result = await uploadMinistryMedia(req.file);
  } catch (error) {
    return respondToCloudinaryError(res, error, 'ministry media upload');
  }
  if (!result?.secure_url || !result?.public_id) {
    return next(new Error('Cloudinary completed the upload without returning a media URL.'));
  }

  const media = await MinistryMedia.create({
    name: path.basename(req.file.originalname).slice(0, 255),
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: req.file.mimetype.startsWith('image/') ? 'image' : 'raw',
    mimeType: req.file.mimetype,
    uploadedBy: req.user._id,
  });
  return res.status(201).json({ media });
}

router.post('/ministry-media', authenticate, (req, res, next) => {
  if (req.user.role !== 'member' || getDesignations(req.user).length === 0) {
    return res.status(403).json({
      message: 'A secondary designation is required to upload ministry media.',
    });
  }
  ministryMediaUpload.single('file')(req, res, (uploadError) => {
    if (handleMulterError(uploadError, res, next, 'Media files')) return;
    handleMinistryMediaUpload(req, res, next).catch(next);
  });
});

module.exports = router;
