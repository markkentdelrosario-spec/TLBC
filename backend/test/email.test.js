const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getResendConfig,
  sendRegistrationOtp,
  validateResendConfig,
} = require('../services/email');

test('Resend config trims the API key and defaults to the testing sender', () => {
  assert.deepEqual(
    getResendConfig({ RESEND_API_KEY: '  re_test  ' }),
    {
      apiKey: 're_test',
      from: 'The Life Builder Church <onboarding@resend.dev>',
    }
  );
});

test('Resend config accepts a configured sender and rejects a missing API key', () => {
  assert.equal(
    getResendConfig({
      RESEND_API_KEY: 're_test',
      RESEND_FROM: 'Church <verify@example.com>',
    }).from,
    'Church <verify@example.com>'
  );
  assert.throws(
    () => validateResendConfig({ RESEND_API_KEY: ' ' }),
    /RESEND_API_KEY is required/
  );
});

test('registration email uses Resend and escapes the display name', async () => {
  let sentEmail;
  const resend = {
    emails: {
      async send(email) {
        sentEmail = email;
        return { data: { id: 'email_test_id' }, error: null };
      },
    },
  };

  await sendRegistrationOtp(
    resend,
    'member@gmail.com',
    '<Member>',
    '012345',
    { RESEND_API_KEY: 're_test', RESEND_FROM: 'Church <verify@example.com>' }
  );

  assert.equal(sentEmail.from, 'Church <verify@example.com>');
  assert.equal(sentEmail.to, 'member@gmail.com');
  assert.match(sentEmail.html, /&lt;Member&gt;/);
  assert.doesNotMatch(sentEmail.html, /Hello <Member>/);
  assert.match(sentEmail.text, /012345/);
});

test('registration email reports a Resend API rejection', async () => {
  const resend = {
    emails: {
      async send() {
        return { data: null, error: { message: 'Invalid sender.' } };
      },
    },
  };

  await assert.rejects(
    sendRegistrationOtp(
      resend,
      'member@gmail.com',
      'Member',
      '012345',
      { RESEND_API_KEY: 're_test' }
    ),
    /Resend rejected the verification email: Invalid sender/
  );
});
