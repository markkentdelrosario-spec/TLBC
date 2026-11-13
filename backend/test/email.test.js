const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBrevoConfig,
  createBrevoClient,
  sendRegistrationOtp,
  validateBrevoConfig,
} = require('../services/email');

test('Brevo config trims the API key', () => {
  assert.deepEqual(
    getBrevoConfig({ BREVO_API_KEY: '  brevo_test  ' }),
    { apiKey: 'brevo_test' }
  );
});

test('Brevo client is disabled without an API key', () => {
  assert.equal(createBrevoClient({ BREVO_API_KEY: ' ' }), null);
});

test('Brevo config rejects a missing API key', () => {
  assert.throws(
    () => validateBrevoConfig({ BREVO_API_KEY: ' ' }),
    /BREVO_API_KEY is required/
  );
});

test('registration email uses Brevo and escapes the display name', async () => {
  let sentEmail;
  const brevo = {
    transactionalEmails: {
      async sendTransacEmail(email) {
        sentEmail = email;
        return { messageId: 'email_test_id' };
      },
    },
  };

  await sendRegistrationOtp(
    brevo,
    'member@gmail.com',
    '<Member>',
    '012345'
  );

  assert.deepEqual(sentEmail.sender, {
    name: 'The Life Builder Church',
    email: 'delrosariomarkkent@gmail.com',
  });
  assert.deepEqual(sentEmail.to, [{ email: 'member@gmail.com' }]);
  assert.match(sentEmail.htmlContent, /&lt;Member&gt;/);
  assert.doesNotMatch(sentEmail.htmlContent, /Hello <Member>/);
  assert.match(sentEmail.textContent, /012345/);
});

test('registration email request avoids long retries and has a bounded timeout', async () => {
  let requestOptions;
  const brevo = {
    transactionalEmails: {
      async sendTransacEmail(_email, options) {
        requestOptions = options;
      },
    },
  };

  await sendRegistrationOtp(brevo, 'member@gmail.com', 'Member', '012345');

  assert.deepEqual(requestOptions, { timeoutInSeconds: 30, maxRetries: 0 });
});

test('registration email reports a Brevo API rejection', async () => {
  const brevo = {
    transactionalEmails: {
      async sendTransacEmail() {
        throw new Error('Invalid sender.');
      },
    },
  };

  await assert.rejects(
    sendRegistrationOtp(brevo, 'member@gmail.com', 'Member', '012345'),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.expose, true);
      assert.match(error.message, /verify the sender in Brevo/);
      return true;
    }
  );
});

test('registration email converts Brevo transport failures to an exposed delivery error', async () => {
  const brevo = {
    transactionalEmails: {
      async sendTransacEmail() {
        throw new Error('Request timed out.');
      },
    },
  };

  await assert.rejects(
    sendRegistrationOtp(brevo, 'member@gmail.com', 'Member', '012345'),
    (error) => {
      assert.equal(error.status, 502);
      assert.match(error.message, /review Brevo transactional email logs/);
      return true;
    }
  );
});
