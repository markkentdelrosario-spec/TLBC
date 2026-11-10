require('dotenv').config();

const mongoose = require('mongoose');
const { getAuth } = require('firebase-admin/auth');
const firebaseApp = require('../config/firebaseAdmin');
const User = require('../models/User');

const TEST_EMAIL = 'admin.test@tlbc.local';
const TEST_PASSWORD = 'TLBC-Local-Admin-2026!';
const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
const emulatorHostname = emulatorHost.startsWith('[')
  ? emulatorHost.slice(1, emulatorHost.indexOf(']'))
  : emulatorHost.split(':')[0];

async function seedEmulatorAdmin() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The emulator admin seed cannot run in production.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(emulatorHostname)) {
    throw new Error(
      'Set FIREBASE_AUTH_EMULATOR_HOST to a local Firebase Auth Emulator before seeding.'
    );
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to seed the emulator admin.');
  }
  if (process.env.FIREBASE_PROJECT_ID !== 'demo-tlbc') {
    throw new Error('Set FIREBASE_PROJECT_ID to the local demo project ID demo-tlbc.');
  }
  let mongoUrl;
  try {
    mongoUrl = new URL(process.env.MONGODB_URI);
  } catch {
    throw new Error('MONGODB_URI must be a valid local MongoDB connection string.');
  }
  if (
    mongoUrl.protocol !== 'mongodb:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(mongoUrl.hostname)
  ) {
    throw new Error('The emulator admin seed only connects to a local MongoDB instance.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const auth = getAuth(firebaseApp);
  let firebaseUser;
  try {
    firebaseUser = await auth.getUserByEmail(TEST_EMAIL);
    firebaseUser = await auth.updateUser(firebaseUser.uid, {
      displayName: 'Local Test Admin',
      emailVerified: true,
      password: TEST_PASSWORD,
      disabled: false,
    });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    firebaseUser = await auth.createUser({
      email: TEST_EMAIL,
      emailVerified: true,
      password: TEST_PASSWORD,
      displayName: 'Local Test Admin',
      disabled: false,
    });
  }

  const existingEmail = await User.findOne({ email: TEST_EMAIL.toLowerCase() });
  if (existingEmail && existingEmail.firebaseUid !== firebaseUser.uid) {
    throw new Error(
      'This test email is linked to a different Firebase UID in MongoDB; refusing to replace it.'
    );
  }
  const user =
    existingEmail ||
    (await User.findOne({ firebaseUid: firebaseUser.uid })) ||
    new User({ firebaseUid: firebaseUser.uid, email: TEST_EMAIL });
  user.firebaseUid = firebaseUser.uid;
  user.email = TEST_EMAIL;
  user.displayName = 'Local Test Admin';
  user.role = 'admin';
  user.secondaryDesignations = [];
  user.isActive = true;
  user.isVerified = true;
  await user.save();

  console.log('Created the local Firebase Auth Emulator admin account.');
  console.log(`Email: ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD}`);
}

seedEmulatorAdmin()
  .catch((error) => {
    console.error('Unable to seed the local emulator admin.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
