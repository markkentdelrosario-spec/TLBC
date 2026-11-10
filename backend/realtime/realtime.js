const { Server } = require('socket.io');
const { getAuth } = require('firebase-admin/auth');
const firebaseApp = require('../config/firebaseAdmin');
const User = require('../models/User');
const { getAllowedOrigins } = require('../config/cors');

let io;

function initializeRealtime(server) {
  io = new Server(server, {
    cors: {
      origin: getAllowedOrigins(),
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) {
        return next(new Error('A Firebase ID token is required.'));
      }
      const decoded = await getAuth(firebaseApp).verifyIdToken(token, true);
      const user = await User.findOne({
        firebaseUid: decoded.uid,
        isActive: true,
      }).select('_id');
      if (!user) return next(new Error('This account is not authorized.'));
      socket.data.userId = user._id.toString();
      return next();
    } catch (error) {
      return next(new Error('The Firebase ID token is invalid or expired.'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  return io;
}

function emitToAll(event, payload) {
  io?.emit(event, payload);
}

function emitToUser(userId, event, payload) {
  io?.to(`user:${userId}`).emit(event, payload);
}

module.exports = { initializeRealtime, emitToAll, emitToUser };
