const express = require('express');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { getAuth } = require('firebase-admin/auth');
const firebaseApp = require('../config/firebaseAdmin');
const { verifyFirebaseIdToken, authenticate } = require('../middleware/authMiddleware');
const Beneficiary = require('../models/Beneficiary');
const RegistrationCode = require('../models/RegistrationCode');
const User = require('../models/User');

const router = express.Router();
const REGISTRATION_CODE_TTL_MS = 10 * 60 * 1000;
const REGISTRATION_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_REGISTRATION_CODE_ATTEMPTS = 5;

function normalizeGmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function registrationCodeHash(email, code) {
  const secret = process.env.REGISTRATION_CODE_SECRET;
  if (!secret) {
    throw new Error('REGISTRATION_CODE_SECRET is required for email registration.');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`${email}:${code}`)
    .digest('hex');
}

function createRegistrationMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    return null;
  }
  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

router.post('/registration-code', async (req, res, next) => {
  const body = req.body || {};
  if (!process.env.REGISTRATION_CODE_SECRET) {
    return res.status(503).json({
      message: 'Email registration is not configured. Set REGISTRATION_CODE_SECRET.',
    });
  }
  const displayName =
    typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeGmail(body.email);
  const phoneNumber =
    typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
  if (!displayName || displayName.length > 120) {
    return res.status(400).json({
      message: 'Full name is required and must be 120 characters or fewer.',
    });
  }
  if (!/^[^\s@]+@gmail\.com$/.test(email)) {
    return res.status(400).json({
      message: 'Use a valid Gmail address ending in @gmail.com.',
    });
  }
  if (phoneNumber.length > 32) {
    return res.status(400).json({
      message: 'Phone number must be 32 characters or fewer.',
    });
  }

  let mailer;
  try {
    mailer = createRegistrationMailer();
  } catch (error) {
    return next(error);
  }
  if (!mailer) {
    return res.status(503).json({
      message:
        'Email registration is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, and REGISTRATION_CODE_SECRET.',
    });
  }

  try {
    const existingUser = await User.findOne({ email }).select('_id').lean();
    if (existingUser) {
      return res.status(409).json({
        message: 'An account already exists for this Gmail address. Please sign in.',
      });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const now = new Date();
    const codeHash = registrationCodeHash(email, code);
    let reservation;
    try {
      reservation = await RegistrationCode.findOneAndUpdate(
        {
          email,
          $or: [
            {
              lastSentAt: {
                $lte: new Date(now.getTime() - REGISTRATION_RESEND_COOLDOWN_MS),
              },
            },
            { lastSentAt: { $exists: false } },
          ],
        },
        {
          $set: {
            email,
            displayName,
            phoneNumber,
            codeHash,
            expiresAt: new Date(now.getTime() + REGISTRATION_CODE_TTL_MS),
            attempts: 0,
            lastSentAt: now,
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code === 11000) {
        return res.status(429).json({
          message: 'A confirmation code was sent recently. Please wait before requesting another.',
        });
      }
      throw error;
    }

    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Your Life Builder Church confirmation code',
        text: `Your confirmation code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this message.`,
        html: `<p>Your confirmation code is <strong style="font-size:24px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 10 minutes. If you did not request this, you can ignore this message.</p>`,
      });
    } catch (error) {
      await RegistrationCode.deleteOne({
        _id: reservation._id,
        codeHash,
      });
      throw error;
    }
    return res.status(202).json({
      message: 'A confirmation code was sent to your Gmail address.',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/complete-registration', async (req, res, next) => {
  const body = req.body || {};
  const email = normalizeGmail(body.email);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@gmail\.com$/.test(email)) {
    return res.status(400).json({
      message: 'Use a valid Gmail address ending in @gmail.com.',
    });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: 'Enter the 6-digit confirmation code.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({
      message: 'Password must be between 8 and 128 characters.',
    });
  }

  try {
    const pending = await RegistrationCode.findOne({
      email,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_REGISTRATION_CODE_ATTEMPTS },
    });
    if (!pending) {
      return res.status(400).json({
        message: 'The confirmation code expired or is no longer valid. Request a new code.',
      });
    }

    const suppliedHash = Buffer.from(registrationCodeHash(email, code), 'hex');
    const savedHash = Buffer.from(pending.codeHash, 'hex');
    if (
      suppliedHash.length !== savedHash.length ||
      !crypto.timingSafeEqual(suppliedHash, savedHash)
    ) {
      await RegistrationCode.updateOne(
        { _id: pending._id },
        { $inc: { attempts: 1 } }
      );
      return res.status(400).json({
        message: 'That confirmation code is incorrect. Check the code and try again.',
      });
    }

    const claimedCode = await RegistrationCode.findOneAndDelete({
      _id: pending._id,
      codeHash: pending.codeHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_REGISTRATION_CODE_ATTEMPTS },
    });
    if (!claimedCode) {
      return res.status(409).json({
        message: 'This confirmation code has already been used. Request a new code.',
      });
    }

    const firebaseAuth = getAuth(firebaseApp);
    let firebaseUser;
    let profileCreated = false;
    try {
      firebaseUser = await firebaseAuth.createUser({
        email,
        password,
        displayName: claimedCode.displayName,
        emailVerified: true,
        disabled: false,
      });
      await User.create({
        firebaseUid: firebaseUser.uid,
        email,
        displayName: claimedCode.displayName,
        phoneNumber: claimedCode.phoneNumber || undefined,
        role: 'member',
        isActive: true,
      });
      profileCreated = true;
      const customToken = await firebaseAuth.createCustomToken(firebaseUser.uid);
      return res.status(201).json({
        message: 'Your email is confirmed and your account is ready.',
        customToken,
      });
    } catch (error) {
      if (profileCreated && firebaseUser) {
        await User.deleteOne({ firebaseUid: firebaseUser.uid }).catch(
          (deleteError) => {
            console.error('Unable to remove incomplete church registration.', deleteError);
          }
        );
      }
      if (firebaseUser) {
        await firebaseAuth.deleteUser(firebaseUser.uid).catch((deleteError) => {
          console.error('Unable to remove incomplete Firebase registration.', deleteError);
        });
      }
      if (error.code === 'auth/email-already-exists' || error.code === 11000) {
        return res.status(409).json({
          message: 'An account already exists for this Gmail address. Please sign in.',
        });
      }
      throw error;
    }
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
      secondaryDesignation: req.user.secondaryDesignation || null,
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

router.post('/register', verifyFirebaseIdToken, async (req, res, next) => {
  const firebaseUser = req.firebaseUser;
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

  const firebaseName =
    typeof firebaseUser.name === 'string' ? firebaseUser.name.trim() : '';
  const displayName = getDisplayName(firebaseUser);
  const profilePicture =
    typeof firebaseUser.picture === 'string' &&
    /^https:\/\//i.test(firebaseUser.picture)
      ? firebaseUser.picture.slice(0, 2048)
      : undefined;

  try {
    const existingUser = await User.findOne({ firebaseUid: firebaseUser.uid })
      .select('profilePhoto')
      .lean();
    const update = {
      $set: { email },
      $setOnInsert: {
        firebaseUid: firebaseUser.uid,
        role: 'member',
      },
    };
    if (firebaseName) {
      update.$set.displayName = displayName;
    } else {
      update.$setOnInsert.displayName = displayName;
    }
    if (profilePicture && !existingUser?.profilePhoto?.publicId) {
      if (existingUser) {
        update.$set.profilePicture = profilePicture;
      } else {
        update.$setOnInsert.profilePicture = profilePicture;
      }
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
});

module.exports = router;
