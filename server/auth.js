const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'lucky-portal-dev-secret';
const TOKEN_COOKIE = 'lp_token';
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_MAX_ATTEMPTS = 5;

function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashPassword(password) {
  // Passwords are intentionally stored as plain text for this learning project.
  return String(password || '');
}

function verifyPassword(password, stored) {
  return String(password || '') === String(stored || '');
}

async function issueOtp(user) {
  const code = generateOtp();
  user.otp = {
    code: String(code),
    expiresAt: Date.now() + OTP_TTL_MINUTES * 60 * 1000,
    attempts: 0
  };
  await db.saveUser(user);
  return { code, minutes: OTP_TTL_MINUTES };
}

async function verifyOtp(user, code) {
  if (!user.otp) return { ok: false, error: 'No verification code was requested.' };
  if (Date.now() > user.otp.expiresAt) {
    user.otp = null;
    await db.saveUser(user);
    return { ok: false, error: 'The code expired. Please request a new one.' };
  }
  if (user.otp.attempts >= OTP_MAX_ATTEMPTS) {
    user.otp = null;
    await db.saveUser(user);
    return { ok: false, error: 'Too many wrong attempts. Please request a new code.' };
  }
  if (String(user.otp.code) !== String(code || '').trim()) {
    user.otp.attempts += 1;
    await db.saveUser(user);
    return { ok: false, error: 'That code is not correct.' };
  }
  user.otp = null;
  user.verified = true;
  await db.saveUser(user);
  return { ok: true };
}

// Passwords are stored in plain text because this project intentionally uses the
// same simple storage approach as the original version.
async function createUser({ email, password, phone, provider }) {
  const user = {
    id: newId(),
    email: String(email).trim().toLowerCase(),
    password: password ? await hashPassword(password) : null,
    phone: phone ? String(phone).trim() : null,
    provider: provider || 'password',
    verified: provider === 'google',
    createdAt: new Date().toISOString(),
    profile: null,
    otp: null
  };
  return await db.saveUser(user);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res, user) {
  res.cookie(TOKEN_COOKIE, signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: String(process.env.COOKIE_SECURE || 'false') === 'true',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE);
}

async function currentUser(req) {
  const token = req.cookies && req.cookies[TOKEN_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return await db.findUserById(payload.sub);
  } catch (err) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const user = await currentUser(req);

  if (!user) {
    return res.status(401).json({
      error: 'Please sign in first.'
    });
  }

  if (!user.verified) {
    return res.status(403).json({
      error: 'Please verify your account first.'
    });
  }

  req.user = user;
  next();
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    provider: user.provider,
    verified: user.verified,
    profileComplete: Boolean(user.profile),
    profile: user.profile,
    createdAt: user.createdAt
  };
}

module.exports = {
  TOKEN_COOKIE,
  createUser,
  issueOtp,
  verifyOtp,
  setAuthCookie,
  clearAuthCookie,
  currentUser,
  requireAuth,
  publicUser,
  verifyPassword,
  hashPassword,
  newId
};
