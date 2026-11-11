const { getAuth } = require('firebase-admin/auth');
const firebaseApp = require('../config/firebaseAdmin');
const User = require('../models/User');
const {
  getDesignations,
  hasDesignation,
  hasLeadershipDesignation,
} = require('../utils/designations');

const SYSTEM_ROLES = new Set(['admin', 'pastor', 'member']);
const LEGACY_MEMBER_ROLES = new Set(['life_coach', 'beneficiary']);
const SCANNER_DESIGNATION = 'KSP Leader';

async function verifyFirebaseToken(req) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error = new Error('A Firebase ID token is required.');
    error.status = 401;
    throw error;
  }

  return getAuth(firebaseApp).verifyIdToken(match[1], true);
}

function isInvalidFirebaseToken(error) {
  return new Set([
    'auth/argument-error',
    'auth/id-token-expired',
    'auth/id-token-revoked',
    'auth/invalid-id-token',
    'auth/user-disabled',
  ]).has(error.code);
}

async function verifyFirebaseIdToken(req, res, next) {
  try {
    req.firebaseUser = await verifyFirebaseToken(req);
    return next();
  } catch (error) {
    if (error.status === 401 || isInvalidFirebaseToken(error)) {
      return res.status(401).json({
        message:
          error.status === 401
            ? error.message
            : 'The Firebase ID token is invalid, expired, or revoked.',
      });
    }
    return next(error);
  }
}

async function authenticate(req, res, next) {
  let decodedToken;
  try {
    decodedToken = await verifyFirebaseToken(req);
  } catch (error) {
    if (error.status === 401 || isInvalidFirebaseToken(error)) {
      return res.status(401).json({
        message:
          error.status === 401
            ? error.message
            : 'The Firebase ID token is invalid, expired, or revoked.',
      });
    }
    return next(error);
  }

  try {
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!user || !user.isVerified) {
      return res.status(403).json({
        message: 'Verify your email address before activating your account.',
      });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'This account is not authorized.' });
    }

    if (LEGACY_MEMBER_ROLES.has(user.role)) {
      if (user.role === 'life_coach') {
        user.secondaryDesignations = [SCANNER_DESIGNATION];
      } else {
        user.secondaryDesignations = [];
      }
      user.role = 'member';
      await user.save();
    }
    if (!Array.isArray(user.secondaryDesignations)) {
      user.secondaryDesignations = getDesignations(user);
      await user.save();
    }
    if (!SYSTEM_ROLES.has(user.role)) {
      return res.status(403).json({ message: 'This account has an unsupported system role.' });
    }

    req.user = user;
    req.auth = {
      firebaseUid: decodedToken.uid,
      userId: user._id.toString(),
      role: user.role,
    };
    req.firebaseUser = decodedToken;
    return next();
  } catch (error) {
    return next(error);
  }
}

function authorizeRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.map((role) => String(role).toLowerCase());
  if (normalizedRoles.some((role) => !SYSTEM_ROLES.has(role))) {
    throw new TypeError('authorizeRoles received an unsupported role.');
  }

  return (req, res, next) => {
    if (!req.user || !normalizedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

function authorizeKspLeader(req, res, next) {
  if (req.user?.role === 'member' && hasDesignation(req.user, SCANNER_DESIGNATION)) {
    return next();
  }
  return res
    .status(403)
    .json({ message: 'Only KSP Leaders can use this feature.' });
}

function authorizeSecondaryDesignation(req, res, next) {
  if (req.user?.role === 'member' && hasLeadershipDesignation(req.user)) {
    return next();
  }
  return res.status(403).json({
    message: 'A leadership designation is required to manage group members.',
  });
}

function authorizeReportAccess(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({
    message: 'Reports are available to administrators only.',
  });
}

function authorizeAttendanceStatusManagement(req, res, next) {
  if (
    req.user?.role === 'admin' ||
    (req.user?.role === 'member' && hasDesignation(req.user, 'KSP Leader'))
  ) {
    return next();
  }
  return res.status(403).json({
    message: 'Only KSP Leaders and admins can update attendance statuses.',
  });
}

module.exports = {
  authenticate,
  authorizeRoles,
  authorizeKspLeader,
  authorizeSecondaryDesignation,
  authorizeAttendanceStatusManagement,
  authorizeReportAccess,
  verifyFirebaseIdToken,
};
