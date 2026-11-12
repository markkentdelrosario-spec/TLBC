const cloudinary = require('cloudinary').v2;

const cloudinarySettings = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
};

cloudinary.config({
  ...cloudinarySettings,
  secure: true,
});

function isCloudinaryConfigured() {
  return Boolean(
    cloudinarySettings.cloud_name &&
      cloudinarySettings.api_key &&
      cloudinarySettings.api_secret
  );
}

function getMissingCloudinarySettings() {
  return [
    ['CLOUDINARY_CLOUD_NAME', cloudinarySettings.cloud_name],
    ['CLOUDINARY_API_KEY', cloudinarySettings.api_key],
    ['CLOUDINARY_API_SECRET', cloudinarySettings.api_secret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  getMissingCloudinarySettings,
};
