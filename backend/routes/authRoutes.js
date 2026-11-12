const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { getAuth } = require('firebase-admin/auth');
const firebaseApp = require('../config/firebaseAdmin');
const { verifyFirebaseIdToken, authenticate } = require('../middleware/authMiddleware');
const Beneficiary = require('../models/Beneficiary');
const User = require('../models/User');
const {
  createResendClient,
  sendRegistrationOtp,
} = require('../services/email');

const router = express.Router();
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_HASH_ROUNDS = 10;

function normalizeGmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getRegistrationEmailError() {
  return 'Email registration is not configured. Set RESEND_API_KEY.';
}

async function registerManualAccount(req, res, next) {
  const body = req.body || {};
  const displayName = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeGmail(body.email);
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!displayName || displayName.length > 120) {
    return res.status(400).json({ message: 'Full name is required and must be 120 characters or fewer.' });
  }
  if (!/^[^\s@]+@gmail\.com$/.test(email)) {
    return res.status(400).json({ message: 'Use a valid Gmail address ending in @gmail.com.' });
  }
  if (phoneNumber.length > 32) {
    return res.status(400).json({ message: 'Phone number must be 32 characters or fewer.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
  }

  const resend = createResendClient();
  if (!resend) return res.status(503).json({ message: getRegistrationEmailError() });

  let pendingUser;
  try {
    const existingUser = await User.findOne({ email }).select('_id isVerified');
    if (existingUser) {
      return res.status(409).json({
        code: existingUser.isVerified ? 'ACCOUNT_ALREADY_EXISTS' : 'REGISTRATION_PENDING',
        message: existingUser.isVerified
          ? 'An account already exists for this Gmail address. Please sign in.'
          : 'A registration is already pending for this Gmail address. Use the same password you originally entered, then resend the verification code if you did not receive it.',
      });
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    pendingUser = await User.create({
      email,
      displayName,
      phoneNumber: phoneNumber || undefined,
      role: 'member',
      isActive: false,
      isVerified: false,
      passwordHash: await bcrypt.hash(password, OTP_HASH_ROUNDS),
      otp: await bcrypt.hash(otp, OTP_HASH_ROUNDS),
      otpExpires: new Date(Date.now() + OTP_TTL_MS),
      otpAttempts: 0,
      otpLastSentAt: new Date(),
    });

    try {
      await sendRegistrationOtp(resend, email, displayName, otp);
    } catch (error) {
      await User.deleteOne({ _id: pendingUser._id });
      return next(error);
    }

    return res.status(202).json({
      message: 'A 6-digit verification code was sent to your Gmail address.',
      email,
      expiresInSeconds: OTP_TTL_MS / 1000,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'An account or registration already exists for this Gmail address.',
      });
    }
    return next(error);
  }
}

router.post('/verify-otp', async (req, res, next) => {
  const email = normalizeGmail(req.body?.email);
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!/^[^\s@]+@gmail\.com$/.test(email)) {
    return res.status(400).json({ message: 'Use a valid Gmail address ending in @gmail.com.' });
  }
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ message: 'Enter the 6-digit verification code.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
  }

  try {
    const pendingUser = await User.findOne({ email, isVerified: false })
      .select('+otp +otpExpires +otpAttempts +passwordHash');
    if (!pendingUser?.otp || !pendingUser.passwordHash) {
      return res.status(400).json({
        message: 'No pending registration was found. Request a new verification code.',
      });
    }
    if (!pendingUser.otpExpires || pendingUser.otpExpires <= new Date()) {
      pendingUser.otp = undefined;
      pendingUser.otpExpires = null;
      await pendingUser.save();
      return res.status(410).json({
        message: 'Your verification code has expired. Request a new code to continue.',
      });
    }
    if (pendingUser.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        message: 'Too many incorrect codes. Request a new verification code.',
      });
    }

    const [validOtp, validPassword] = await Promise.all([
      bcrypt.compare(otp, pendingUser.otp),
      bcrypt.compare(password, pendingUser.passwordHash),
    ]);
    if (!validOtp) {
      pendingUser.otpAttempts += 1;
      await pendingUser.save();
      return res.status(400).json({
        message: 'That verification code is incorrect. Check the code and try again.',
      });
    }
    if (!validPassword) {
      return res.status(400).json({
        message: 'The password no longer matches this pending registration. Restart sign-up.',
      });
    }

    let firebaseUser;
    try {
      firebaseUser = await getAuth(firebaseApp).createUser({
        email,
        password,
        displayName: pendingUser.displayName,
        emailVerified: true,
        disabled: false,
      });
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        await User.deleteOne({ _id: pendingUser._id });
        return res.status(409).json({
          message: 'An account already exists for this Gmail address. Please sign in.',
        });
      }
      return next(error);
    }

    try {
      pendingUser.firebaseUid = firebaseUser.uid;
      pendingUser.isVerified = true;
      pendingUser.isActive = true;
      pendingUser.otp = undefined;
      pendingUser.otpExpires = null;
      pendingUser.otpAttempts = 0;
      pendingUser.passwordHash = undefined;
      await pendingUser.save();
    } catch (error) {
      await getAuth(firebaseApp).deleteUser(firebaseUser.uid).catch((deleteError) => {
        console.error('Unable to remove incomplete Firebase registration.', deleteError);
      });
      return next(error);
    }

    const customToken = await getAuth(firebaseApp).createCustomToken(firebaseUser.uid);
    return res.status(200).json({
      message: 'Your email is verified and your account is ready.',
      customToken,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/resend-otp', async (req, res, next) => {
  const email = normalizeGmail(req.body?.email);
  if (!/^[^\s@]+@gmail\.com$/.test(email)) {
    return res.status(400).json({ message: 'Use a valid Gmail address ending in @gmail.com.' });
  }

  const resend = createResendClient();
  if (!resend) return res.status(503).json({ message: getRegistrationEmailError() });

  try {
    const pendingUser = await User.findOne({ email, isVerified: false })
      .select('+otp +otpExpires +otpLastSentAt +passwordHash');
    if (!pendingUser?.passwordHash) {
      return res.status(400).json({
        message: 'No pending registration was found. Start sign-up again.',
      });
    }
    if (
      pendingUser.otpLastSentAt &&
      Date.now() - pendingUser.otpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      return res.status(429).json({
        message: 'A verification code was sent recently. Please wait before requesting another.',
      });
    }

    const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await sendRegistrationOtp(resend, email, pendingUser.displayName, otp);
    pendingUser.otp = await bcrypt.hash(otp, OTP_HASH_ROUNDS);
    pendingUser.otpExpires = new Date(Date.now() + OTP_TTL_MS);
    pendingUser.otpAttempts = 0;
    pendingUser.otpLastSentAt = new Date();
    await pendingUser.save();
    return res.status(202).json({
      message: 'A new verification code was sent to your Gmail address.',
      expiresInSeconds: OTP_TTL_MS / 1000,
    });
  } catch (error) {
    return next(error);
  }
});

function getDisplayName(firebaseUser) {
  const name = typeof firebaseUser.name === 'string' ? firebaseUser.name.trim() : '';
  if (name) return name.slice(0, 120);
  const emailName = firebaseUser.email?.split('@')[0]?.trim();
  return (emailName || 'Church Member').slice(0, 120);
}

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const beneficiary = await Beneficiary.findOne({
      user: req.user._id,
      isActive: true,
    })
      .select('group qrCodeId')
      .populate('group', 'groupNumber name')
      .lean();

    return res.json({
      _id: req.user._id,
      id: req.user._id,
      firebaseUid: req.user.firebaseUid,
      name: req.user.displayName,
      email: req.user.email,
      role: req.user.role,
      secondaryDesignations: req.user.secondaryDesignations || [],
      secondaryDesignation: req.user.secondaryDesignations || [],
      phoneNumber: req.user.phoneNumber || null,
      birthDate: req.user.birthDate || null,
      groupId: beneficiary?.group?._id || null,
      groupName: beneficiary?.group?.name || null,
      qrCodeId: beneficiary?.qrCodeId || null,
      profilePicture: req.user.profilePicture || req.user.profilePhoto?.url || null,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/profile-picture', authenticate, async (req, res, next) => {
  const { profilePicture, publicId } = req.body || {};
  if (
    typeof profilePicture !== 'string' ||
    typeof publicId !== 'string' ||
    !/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(profilePicture) ||
    !publicId.startsWith('tlbc/profile-pictures/')
  ) {
    return res.status(400).json({
      message: 'A valid uploaded Cloudinary profile image is required.',
    });
  }

  try {
    req.user.profilePicture = profilePicture;
    req.user.profilePhoto = { url: profilePicture, publicId };
    await req.user.save();
    return res.json({
      message: 'Profile picture updated.',
      profilePicture: req.user.profilePicture,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/profile', authenticate, async (req, res, next) => {
  const body = req.body || {};
  const displayName =
    typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const phoneNumber =
    typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
  const birthDate = body.birthDate;
  if (!displayName || displayName.length > 120) {
    return res.status(400).json({
      message: 'Full name is required and must be 120 characters or fewer.',
    });
  }
  if (phoneNumber.length > 32) {
    return res.status(400).json({
      message: 'Phone number must be 32 characters or fewer.',
    });
  }
  if (
    birthDate !== undefined &&
    birthDate !== null &&
    (typeof birthDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      Number.isNaN(Date.parse(`${birthDate}T00:00:00.000Z`)) ||
      new Date(`${birthDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== birthDate)
  ) {
    return res.status(400).json({
      message: 'Birth date must be a valid YYYY-MM-DD date or null.',
    });
  }
  try {
    req.user.displayName = displayName;
    req.user.phoneNumber = phoneNumber || undefined;
    if (birthDate !== undefined) {
      req.user.birthDate = birthDate
        ? new Date(`${birthDate}T00:00:00.000Z`)
        : null;
    }
    await req.user.save();
    return res.json({
      message: 'Profile updated.',
      profile: {
        name: req.user.displayName,
        phoneNumber: req.user.phoneNumber || null,
        birthDate: req.user.birthDate || null,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/set-password', authenticate, async (req, res, next) => {
  const password =
    typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({
      message: 'Password must be between 8 and 128 characters.',
    });
  }

  const signInProvider = req.firebaseUser?.firebase?.sign_in_provider;
  if (!['google.com', 'facebook.com', 'password'].includes(signInProvider)) {
    return res.status(403).json({
      message: 'Set a password after signing in with Google or Facebook.',
    });
  }
  const authTime = Number(req.firebaseUser.auth_time);
  const authAge = Date.now() / 1000 - authTime;
  if (!Number.isFinite(authTime) || authAge < 0 || authAge > 5 * 60) {
    return res.status(401).json({
      message: 'Sign in again before setting or changing your password.',
    });
  }

  try {
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'Account not found.' });
    }
    if (user.passwordHash && signInProvider !== 'password') {
      return res.status(409).json({
        message: 'A password is already set for this account.',
      });
    }

    await getAuth(firebaseApp).updateUser(user.firebaseUid, { password });
    user.passwordHash = await bcrypt.hash(password, OTP_HASH_ROUNDS);
    await user.save();
    return res.json({ message: 'Password set successfully.' });
  } catch (error) {
    return next(error);
  }
});

async function registerFirebaseAccount(req, res, next) {
  const firebaseUser = req.firebaseUser;
  if (!firebaseUser || typeof firebaseUser !== 'object') {
    return res.status(401).json({
      message: 'A valid Firebase ID token is required.',
    });
  }
  const email =
    typeof firebaseUser.email === 'string' ? firebaseUser.email.trim().toLowerCase() : '';

  if (!email) {
    return res.status(400).json({
      message: 'A Firebase account with an email address is required.',
    });
  }
  if (
    req.firebaseUser.firebase?.sign_in_provider === 'password' &&
    req.firebaseUser.email_verified !== true
  ) {
    return res.status(403).json({
      message: 'Verify your email address before activating your account.',
    });
  }

  const displayName = getDisplayName(firebaseUser);
  const profilePicture =
    typeof firebaseUser.picture === 'string' &&
    /^https:\/\//i.test(firebaseUser.picture)
      ? firebaseUser.picture.slice(0, 2048)
      : undefined;

  try {
    const existingUser = await User.findOne({ firebaseUid: firebaseUser.uid })
      .select('displayName profilePicture profilePhoto isVerified +passwordHash')
      .lean();
    if (existingUser?.passwordHash && !existingUser.isVerified) {
      return res.status(403).json({
        message: 'Verify your email with the code sent during registration before signing in.',
      });
    }
    const update = {
      $set: { email, isVerified: true },
      $setOnInsert: {
        firebaseUid: firebaseUser.uid,
        role: 'member',
      },
    };
    update.$setOnInsert.displayName = displayName;
    if (
      profilePicture &&
      !existingUser?.profilePicture &&
      !existingUser?.profilePhoto?.publicId
    ) {
      update.$setOnInsert.profilePicture = profilePicture;
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: firebaseUser.uid },
      update,
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account is not active.' });
    }

    return res.status(200).json({
      message: 'Account synchronized.',
      user: {
        id: user._id,
        name: user.displayName,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture || null,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'An account with this email is already linked to another Firebase user.',
      });
    }
    return next(error);
  }
}

router.post(
  '/register',
  (req, res, next) => {
    if (!req.get('authorization')) {
      return registerManualAccount(req, res, next);
    }
    return next();
  },
  verifyFirebaseIdToken,
  (req, res, next) => registerFirebaseAccount(req, res, next)
);

module.exports = router;
