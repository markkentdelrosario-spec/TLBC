const { rateLimit } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;

function createRateLimiter(limit, message, windowMs = WINDOW_MS) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      return res.status(429).json({ message });
    },
  });
}

const manualRegistrationRateLimit = createRateLimiter(
  5,
  'Too many registration requests. Please wait 15 minutes and try again.'
);
const otpVerificationRateLimit = createRateLimiter(
  15,
  'Too many verification attempts. Please wait 15 minutes and try again.'
);
const otpResendRateLimit = createRateLimiter(
  5,
  'Too many code requests. Please wait 15 minutes and try again.'
);

module.exports = {
  createRateLimiter,
  manualRegistrationRateLimit,
  otpVerificationRateLimit,
  otpResendRateLimit,
};
