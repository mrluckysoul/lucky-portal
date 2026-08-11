require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');
const notify = require('./notify');
const auth = require('./auth');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function deliverOtp(user, code, minutes) {
  const results = [];
  results.push(await notify.sendEmailOtp(user.email, code, minutes).catch((err) => ({
    delivered: false,
    channel: 'email',
    reason: err.message
  })));
  if (user.phone) {
    results.push(await notify.sendSmsOtp(user.phone, code, minutes).catch((err) => ({
      delivered: false,
      channel: 'sms',
      reason: err.message
    })));
  }
  const channels = results.filter((r) => r.delivered).map((r) => r.channel);
  const payload = { channels, expiresInMinutes: minutes };
  // In dev (no provider configured) the code is echoed so the flow stays testable.
  if (channels.length === 0) payload.devCode = code;
  return payload;
}

app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    emailConfigured: notify.emailConfigured(),
    smsConfigured: notify.smsConfigured()
  });
});

app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const { email, password, phone } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (phone && !/^\+[1-9]\d{7,14}$/.test(String(phone).trim())) {
    return res.status(400).json({ error: 'Phone must be in international format, e.g. +919876543210.' });
  }
  const existing = await db.findUserByEmail(email);
  if (existing && existing.verified) return res.status(409).json({ error: 'That email is already registered. Please sign in.' });

  const user = existing || await auth.createUser({ email, password, phone });
  if (existing) {
    existing.password = String(password);
    existing.phone = phone ? String(phone).trim() : existing.phone;
    await db.saveUser(existing);
  }
  const { code, minutes } = await auth.issueOtp(user);
  const delivery = await deliverOtp(user, code, minutes);
  res.json({ email: user.email, needsVerification: true, ...delivery });
}));

app.post('/api/auth/signin', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  const user = await db.findUserByEmail(email);
  if (!user || !(await auth.verifyPassword(password, user.password))) {
    return res.status(401).json({ error: 'Email or password is not correct.' });
  }
  if (!user.verified) {
    const { code, minutes } = await auth.issueOtp(user);
    const delivery = await deliverOtp(user, code, minutes);
    return res.json({ email: user.email, needsVerification: true, ...delivery });
  }
  auth.setAuthCookie(res, user);
  res.json({ user: auth.publicUser(user), needsVerification: false });
}));

app.post('/api/auth/otp/resend', asyncRoute(async (req, res) => {
  const user = await db.findUserByEmail(req.body && req.body.email);
  if (!user) return res.status(404).json({ error: 'No account found for that email.' });
  const { code, minutes } = await auth.issueOtp(user);
  const delivery = await deliverOtp(user, code, minutes);
  res.json({ email: user.email, ...delivery });
}));

app.post('/api/auth/otp/verify', asyncRoute(async (req, res) => {
  const { email, code } = req.body || {};
  const user = await db.findUserByEmail(email);
  if (!user) return res.status(404).json({ error: 'No account found for that email.' });
  const result = await auth.verifyOtp(user, code);
  if (!result.ok) return res.status(400).json({ error: result.error });
  auth.setAuthCookie(res, user);
  res.json({ user: auth.publicUser(user) });
}));

app.post('/api/auth/google', asyncRoute(async (req, res) => {
  const { credential, mockEmail } = req.body || {};
  let email = null;
  if (credential && process.env.GOOGLE_CLIENT_ID) {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!response.ok) return res.status(401).json({ error: 'Google sign-in could not be verified.' });
    const info = await response.json();
    if (info.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Google sign-in was issued for a different app.' });
    }
    if (info.email_verified !== 'true' && info.email_verified !== true) {
      return res.status(401).json({ error: 'Your Google email is not verified.' });
    }
    email = info.email;
  } else if (mockEmail && isEmail(mockEmail)) {
    // Demo mode: no Google client id configured, trust the supplied email.
    email = mockEmail;
  }
  if (!email) return res.status(400).json({ error: 'Google sign-in needs a valid account.' });

  let user = await db.findUserByEmail(email);
  if (!user) user = await auth.createUser({ email, provider: 'google' });
  user.verified = true;
  user.provider = 'google';
  await db.saveUser(user);
  auth.setAuthCookie(res, user);
  res.json({ user: auth.publicUser(user) });
}));

app.post('/api/auth/logout', (req, res) => {
  auth.clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', asyncRoute(async (req, res) => {
  const user = await auth.currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: auth.publicUser(user) });
}));

const PROFILE_FIELDS = [
  'fullName', 'fatherName', 'motherName', 'dob', 'age', 'gender', 'phone', 'city',
  'qualification', 'occupation', 'institution', 'maritalStatus', 'contactEmail',
  'facebook', 'instagram', 'linkedin', 'twitter', 'hobbies', 'extraCurricular', 'about'
];

app.put('/api/profile', auth.requireAuth, async (req, res) => {
  const body = req.body || {};
  if (!body.fullName || !String(body.fullName).trim()) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (!body.dob) return res.status(400).json({ error: 'Date of birth is required.' });

  const profile = {};
  for (const field of PROFILE_FIELDS) {
    const value = body[field];
    profile[field] = Array.isArray(value) ? value : value === undefined || value === null ? '' : String(value).trim();
  }
  profile.updatedAt = new Date().toISOString();
  req.user.profile = profile;
  if (profile.phone) req.user.phone = profile.phone;
  await db.saveUser(req.user);
  res.json({ user: auth.publicUser(req.user) });
});

app.post('/api/scores', auth.requireAuth, async (req, res) => {
  const { game, score } = req.body || {};
  if (!game) return res.status(400).json({ error: 'Game is required.' });
  const entry = {
    id: auth.newId(),
    userId: req.user.id,
    name: (req.user.profile && req.user.profile.fullName) || req.user.email,
    game: String(game),
    score: Number(score) || 0,
    createdAt: new Date().toISOString()
  };
  await db.addScore(entry);
  res.json({ entry });
});

app.get('/api/scores', asyncRoute(async (req, res) => {
  const scores = (await db.read()).scores;
  const best = new Map();
  for (const entry of scores) {
    const key = `${entry.game}::${entry.userId}`;
    if (!best.has(key) || best.get(key).score < entry.score) best.set(key, entry);
  }
  const leaderboard = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 20);
  res.json({ leaderboard });
}));

app.post('/api/feedback', asyncRoute(async (req, res) => {
  const { rating, message, category } = req.body || {};
  if (!message || String(message).trim().length < 5) {
    return res.status(400).json({ error: 'Please write at least a few words.' });
  }
  const user = await auth.currentUser(req);
  const entry = {
    id: auth.newId(),
    userId: user ? user.id : null,
    name: (user && user.profile && user.profile.fullName) || (user && user.email) || 'Guest',
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    category: category ? String(category) : 'general',
    message: String(message).trim().slice(0, 2000),
    createdAt: new Date().toISOString()
  };
  await db.addFeedback(entry);
  res.json({ entry });
}));

app.get('/api/feedback', asyncRoute(async (req, res) => {
  res.json({ feedback: (await db.read()).feedback.slice(0, 30) });
}));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  next();
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => console.log(`Lucky Portal running on http://localhost:${PORT}`));
}

module.exports = app;
