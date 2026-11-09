const {
  applicationDefault,
  getApps,
  initializeApp,
} = require('firebase-admin/app');

const existingApp = getApps().find((app) => app.name === '[DEFAULT]');
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firebaseApp =
  existingApp ||
  initializeApp({
    ...(!authEmulatorHost ? { credential: applicationDefault() } : {}),
    ...((process.env.FIREBASE_PROJECT_ID || (authEmulatorHost ? 'demo-tlbc' : ''))
      ? { projectId: process.env.FIREBASE_PROJECT_ID || 'demo-tlbc' }
      : {}),
  });

module.exports = firebaseApp;
