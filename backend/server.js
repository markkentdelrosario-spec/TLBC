const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const mongoose = require('mongoose');
const app = require('./app');
const AttendanceLog = require('./models/AttendanceLog');
const User = require('./models/User');
const { validateBrevoConfig } = require('./services/email');
const { initializeRealtime } = require('./realtime/realtime');
const { markAbsentMembersIfDue } = require('./services/attendanceAbsence');
const {
  getChurchAttendanceClock,
  getChurchAttendanceSundayDate,
} = require('./utils/attendanceDate');
const {
  getMissingCloudinarySettings,
} = require('./config/cloudinary');

const port = process.env.PORT ? Number(process.env.PORT) : 5000;
const mongoUri = process.env.MONGODB_URI?.trim();

if (!mongoUri) {
  throw new Error('MONGODB_URI is required to start the API server.');
}
if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
  throw new Error('MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string.');
}
if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

async function startServer() {
  User.schema.set('autoIndex', false);
  try {
    await mongoose.connect(mongoUri);
  } catch (error) {
    const startupError = new Error(
      'MongoDB connection failed. Check MONGODB_URI, Atlas network access, and database availability.'
    );
    startupError.name = error.name || 'MongoConnectionError';
    startupError.code = error.code;
    throw startupError;
  }
  const missingCloudinarySettings = getMissingCloudinarySettings();
  if (missingCloudinarySettings.length) {
    console.warn(
      `Cloudinary uploads are disabled; missing environment settings: ${missingCloudinarySettings.join(', ')}.`
    );
  }
  const collectionExists = await mongoose.connection.db
    .listCollections(
      { name: AttendanceLog.collection.name },
      { nameOnly: true }
    )
    .hasNext();
  const indexes = collectionExists
    ? await AttendanceLog.collection.indexes()
    : [];
  const obsoleteIndexNames = new Set([
    'beneficiary_1_attendanceDate_1_serviceName_1',
    'user_attendance_date_service_unique',
  ]);
  for (const index of indexes) {
    if (obsoleteIndexNames.has(index.name)) {
      await AttendanceLog.collection.dropIndex(index.name);
    }
  }
  await AttendanceLog.collection.createIndex(
    { user: 1, attendanceDate: 1 },
    {
      unique: true,
      partialFilterExpression: { user: { $type: 'objectId' } },
      name: 'user_attendance_date_unique',
    }
  );
  const userCollectionExists = await mongoose.connection.db
    .listCollections({ name: User.collection.name }, { nameOnly: true })
    .hasNext();
  const userIndexes = userCollectionExists
    ? await User.collection.indexes()
    : [];
  const firebaseUidIndex = userIndexes.find(
    (index) => index.key?.firebaseUid === 1
  );
  if (firebaseUidIndex && (!firebaseUidIndex.unique || !firebaseUidIndex.sparse)) {
    await User.collection.dropIndex(firebaseUidIndex.name);
  }
  await User.collection.createIndex(
    { firebaseUid: 1 },
    { unique: true, sparse: true, name: 'firebaseUid_1' }
  );
  await User.collection.createIndex(
    { email: 1 },
    { unique: true, name: 'email_1' }
  );

  try {
    validateBrevoConfig();
    console.log('Brevo email API key is configured.');
  } catch (error) {
    console.error('Brevo email configuration failed:', error.message);
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`The Life Builder Church API is listening on port ${port}`);
  });
  initializeRealtime(server);

  let completedAbsenceDate = '';
  let absenceEvaluationInProgress = false;
  const evaluateAttendanceAbsences = async () => {
    const now = new Date();
    const { weekday, minutes } = getChurchAttendanceClock(now);
    const sunday = getChurchAttendanceSundayDate(now).toISOString();
    if (
      weekday !== 'Sun' ||
      minutes < 11 * 60 ||
      completedAbsenceDate === sunday ||
      absenceEvaluationInProgress
    ) {
      return;
    }

    absenceEvaluationInProgress = true;
    try {
      await markAbsentMembersIfDue(now);
      completedAbsenceDate = sunday;
    } catch (error) {
      console.error('Unable to mark absent members for the current Sunday.', error);
    } finally {
      absenceEvaluationInProgress = false;
    }
  };
  evaluateAttendanceAbsences();
  const attendanceAbsenceTimer = setInterval(evaluateAttendanceAbsences, 30 * 1000);
  attendanceAbsenceTimer.unref();

  const shutdown = async () => {
    clearInterval(attendanceAbsenceTimer);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error('Unable to start The Life Builder Church API.', {
    name: error.name,
    code: error.code || null,
    message: error.message,
  });
  process.exitCode = 1;
});
