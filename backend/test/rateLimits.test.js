const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createRateLimiter } = require('../middleware/rateLimits');

test('rate limiter rejects requests after the configured threshold', async (t) => {
  const app = express();
  app.get(
    '/',
    createRateLimiter(2, 'Too many requests.', 60_000),
    (req, res) => res.json({ ok: true })
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;

  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(url)).status, 200);
  const limitedResponse = await fetch(url);
  assert.equal(limitedResponse.status, 429);
  assert.deepEqual(await limitedResponse.json(), { message: 'Too many requests.' });
});
