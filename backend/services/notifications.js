const { getMessaging } = require('firebase-admin/messaging');
const firebaseApp = require('../config/firebaseAdmin');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToAll, emitToUser } = require('../realtime/realtime');

function pushPayload(notification) {
  return {
    notification: {
      title: notification.title,
      body: notification.message,
    },
    data: {
      notificationId: String(notification._id),
      type: notification.type,
      scope: notification.scope || 'announcement',
      entityId: notification.entityId ? String(notification.entityId) : '',
      url: notification.scope === 'birthday' ? '/#birthday-celebrants' : '/#announcements',
    },
    ...(process.env.PUBLIC_APP_URL
      ? {
          webpush: {
            fcmOptions: {
              link: `${process.env.PUBLIC_APP_URL.replace(/\/$/, '')}/#${
                notification.scope === 'birthday' ? 'birthday-celebrants' : 'announcements'
              }`,
            },
          },
        }
      : {}),
  };
}

async function deliverPush(user, notification) {
  if (!user.pushTokens?.length) return;
  try {
    const result = await getMessaging(firebaseApp).sendEachForMulticast({
      tokens: user.pushTokens,
      ...pushPayload(notification),
    });
    const invalidTokens = result.responses.flatMap((response, index) =>
      !response.success &&
      [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
      ].includes(response.error?.code)
        ? [user.pushTokens[index]]
        : []
    );
    if (invalidTokens.length) {
      await User.updateOne(
        { _id: user._id },
        { $pull: { pushTokens: { $in: invalidTokens } } }
      );
    }
  } catch (error) {
    console.error('Unable to deliver a push notification.', error);
  }
}

async function createNotification({
  userId,
  actorId = null,
  type,
  title,
  message,
  entityId = null,
  scope = 'announcement',
}) {
  if (String(userId) === String(actorId)) return null;
  const [notification, user] = await Promise.all([
    Notification.create({ user: userId, actor: actorId, type, scope, title, message, entityId }),
    User.findById(userId).select('pushTokens'),
  ]);
  const payload = {
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    entityId: notification.entityId,
    scope: notification.scope,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
  emitToUser(userId, 'notification:new', payload);
  if (user) void deliverPush(user, notification);
  return notification;
}

async function notifyAnnouncementPublished(announcement) {
  const recipients = await User.find({ isActive: true })
    .select('_id pushTokens')
    .lean();
  if (!recipients.length) return;

  const createdAt = new Date();
  const documents = recipients.map((user) => ({
    user: user._id,
    actor: announcement.author,
    type: 'announcement',
    title: announcement.title,
    message: announcement.body.slice(0, 280),
    entityId: announcement._id,
    createdAt,
  }));
  const notifications = await Notification.insertMany(documents, { ordered: true });

  notifications.forEach((notification) => {
    emitToUser(notification.user, 'notification:new', {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityId: notification.entityId,
      scope: notification.scope,
      readAt: null,
      createdAt: notification.createdAt,
    });
  });
  emitToAll('announcement:published', { announcementId: announcement._id });

  const notificationByUser = new Map(
    notifications.map((notification) => [String(notification.user), notification])
  );
  recipients.forEach((user) => {
    const notification = notificationByUser.get(String(user._id));
    if (notification) void deliverPush(user, notification);
  });
}

module.exports = { createNotification, notifyAnnouncementPublished };
