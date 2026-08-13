const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lucky-portal-test-'));
process.env.JWT_SECRET = 'test-secret';

const app = require('../server/index');

let server;
let baseUrl;
const jar = [];

function cookieHeader() {
  return jar.join('; ');
}

async function call(method, url, body) {
  const response = await fetch(baseUrl + url, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader() },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  setCookie.forEach((c) => jar.push(c.split(';')[0]));
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function main() {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const signup = await call('POST', '/api/auth/signup', { email: 'Test@Example.com', password: 'secret123' });
  assert.strictEqual(signup.status, 200, JSON.stringify(signup.data));
  assert.ok(signup.data.devCode, 'dev OTP code should be returned when no provider is configured');

  const badCode = await call('POST', '/api/auth/otp/verify', { email: 'test@example.com', code: '000000' });
  assert.strictEqual(badCode.status, 400);

  const verified = await call('POST', '/api/auth/otp/verify', { email: 'test@example.com', code: signup.data.devCode });
  assert.strictEqual(verified.status, 200, JSON.stringify(verified.data));
  assert.strictEqual(verified.data.user.email, 'test@example.com');
  assert.strictEqual(verified.data.user.profileComplete, false);

  const me = await call('GET', '/api/me');
  assert.strictEqual(me.status, 200);

  const badProfile = await call('PUT', '/api/profile', { fullName: '' });
  assert.strictEqual(badProfile.status, 400);

  const profile = await call('PUT', '/api/profile', {
    fullName: 'Lucky Kumar', fatherName: 'Kumar', motherName: 'Lakshmi', dob: '2000-05-20', age: 25,
    qualification: 'Undergraduate', occupation: 'Student', maritalStatus: 'Single',
    instagram: '@lucky', hobbies: 'Cricket, Coding'
  });
  assert.strictEqual(profile.status, 200, JSON.stringify(profile.data));
  assert.strictEqual(profile.data.user.profileComplete, true);

  const score = await call('POST', '/api/scores', { game: 'Tic Tac Toe', score: 30 });
  assert.strictEqual(score.status, 200);
  const board = await call('GET', '/api/scores');
  assert.strictEqual(board.data.leaderboard[0].name, 'Lucky Kumar');

  const shortFeedback = await call('POST', '/api/feedback', { message: 'hi', rating: 5 });
  assert.strictEqual(shortFeedback.status, 400);
  const feedback = await call('POST', '/api/feedback', { message: 'Loved the arcade!', rating: 5, category: 'games' });
  assert.strictEqual(feedback.status, 200);
  const feed = await call('GET', '/api/feedback');
  assert.strictEqual(feed.data.feedback.length, 1);

  const google = await call('POST', '/api/auth/google', { mockEmail: 'friend@example.com' });
  assert.strictEqual(google.status, 200);
  assert.strictEqual(google.data.user.verified, true);

  const duplicate = await call('POST', '/api/auth/signup', { email: 'test@example.com', password: 'secret123' });
  assert.strictEqual(duplicate.status, 409);

  const wrongPassword = await call('POST', '/api/auth/signin', { email: 'test@example.com', password: 'nope' });
  assert.strictEqual(wrongPassword.status, 401);

  console.log('All smoke tests passed ✅');
  server.close();
}

main().catch((err) => {
  console.error(err);
  if (server) server.close();
  process.exit(1);
});
