const { BrevoClient } = require('@getbrevo/brevo');

const DELIVERY_ERROR_MESSAGE =
  'Brevo could not send this email. Check the API key, verify the sender in Brevo, and review Brevo transactional email logs.';

function getBrevoConfig(env = process.env) {
  const apiKey =
    typeof env.BREVO_API_KEY === 'string' ? env.BREVO_API_KEY.trim() : '';
  return { apiKey };
}

function createBrevoClient(env = process.env) {
  const { apiKey } = getBrevoConfig(env);
  return apiKey ? new BrevoClient({ apiKey }) : null;
}

function validateBrevoConfig(env = process.env) {
  if (!getBrevoConfig(env).apiKey) {
    throw new Error('BREVO_API_KEY is required to send registration emails.');
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function createEmailDeliveryError(cause) {
  const error = new Error(DELIVERY_ERROR_MESSAGE);
  error.name = 'EmailDeliveryError';
  error.status = 502;
  error.expose = true;
  if (cause) error.cause = cause;
  return error;
}

async function sendRegistrationOtp(brevo, email, displayName, otp) {
  try {
    return await brevo.transactionalEmails.sendTransacEmail({
      subject: 'Your Life Builder Church verification code',
      textContent: `Hello ${displayName}, your verification code is ${otp}. It expires in 10 minutes.`,
      htmlContent: `
        <div style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
          <div style="max-width:520px;margin:0 auto;padding:32px;border-radius:20px;background:#ffffff">
            <p style="margin:0;color:#047857;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">The Life Builder Church</p>
            <h1 style="margin:16px 0 8px;font-size:24px">Verify your email</h1>
            <p style="margin:0 0 20px;color:#475569">Hello ${escapeHtml(displayName)}, use this one-time code to finish creating your account.</p>
            <div style="padding:18px;border-radius:14px;background:#ecfdf5;text-align:center;color:#064e3b;font-size:32px;font-weight:700;letter-spacing:8px">${otp}</div>
            <p style="margin:20px 0 0;color:#64748b;font-size:13px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
          </div>
        </div>`,
      sender: {
        name: 'The Life Builder Church',
        email: 'thelifebuilderchurch@gmail.com',
      },
      to: [{ email }],
    });
  } catch (error) {
    throw createEmailDeliveryError(error);
  }
}

module.exports = {
  createBrevoClient,
  getBrevoConfig,
  sendRegistrationOtp,
  validateBrevoConfig,
};
