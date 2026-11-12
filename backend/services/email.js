const { Resend } = require('resend');

const DEFAULT_FROM = 'The Life Builder Church <onboarding@resend.dev>';

function getResendConfig(env = process.env) {
  const apiKey =
    typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  const configuredFrom =
    typeof env.RESEND_FROM === 'string' ? env.RESEND_FROM.trim() : '';

  return {
    apiKey,
    from: configuredFrom || DEFAULT_FROM,
  };
}

function createResendClient(env = process.env) {
  const { apiKey } = getResendConfig(env);
  return apiKey ? new Resend(apiKey) : null;
}

function validateResendConfig(env = process.env) {
  if (!getResendConfig(env).apiKey) {
    throw new Error('RESEND_API_KEY is required to send registration emails.');
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

async function sendRegistrationOtp(resend, email, displayName, otp, env = process.env) {
  const { from } = getResendConfig(env);
  const { data, error } = await resend.emails.send({
    from,
    to: email,
    subject: 'Your Life Builder Church verification code',
    text: `Hello ${displayName}, your verification code is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
        <div style="max-width:520px;margin:0 auto;padding:32px;border-radius:20px;background:#ffffff">
          <p style="margin:0;color:#047857;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">The Life Builder Church</p>
          <h1 style="margin:16px 0 8px;font-size:24px">Verify your email</h1>
          <p style="margin:0 0 20px;color:#475569">Hello ${escapeHtml(displayName)}, use this one-time code to finish creating your account.</p>
          <div style="padding:18px;border-radius:14px;background:#ecfdf5;text-align:center;color:#064e3b;font-size:32px;font-weight:700;letter-spacing:8px">${otp}</div>
          <p style="margin:20px 0 0;color:#64748b;font-size:13px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
        </div>
      </div>`,
  });

  if (error) {
    throw new Error(`Resend rejected the verification email: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error('Resend did not confirm acceptance of the verification email.');
  }

  return data;
}

module.exports = {
  createResendClient,
  getResendConfig,
  sendRegistrationOtp,
  validateResendConfig,
};
