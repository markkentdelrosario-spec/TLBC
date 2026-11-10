require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');
const AttendanceLog = require('./models/AttendanceLog');
const User = require('./models/User');
const { verifySmtpConnection } = require('./routes/authRoutes');
const { initializeRealtime } = require('./realtime/realtime');

const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error('MONGODB_URI is required to start the API server.');
}

async function startServer() {
  User.schema.set('autoIndex', false);
  await mongoose.connect(mongoUri);
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
    await verifySmtpConnection();
    console.log('SMTP connection verified successfully.');
  } catch (error) {
    console.error('SMTP connection verification failed:', error.message);
  }

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`The Life Builder Church API is listening on http://127.0.0.1:${port}`);
  });
  initializeRealtime(server);

  const shutdown = async () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error('Unable to start The Life Builder Church API.', error);
  process.exitCode = 1;
});
