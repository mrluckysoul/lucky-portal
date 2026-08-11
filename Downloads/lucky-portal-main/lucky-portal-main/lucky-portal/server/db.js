const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

function ensureConfig() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be configured.');
  }
}

async function request(path, options = {}) {
  ensureConfig();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }
  return data;
}

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    phone: row.phone,
    provider: row.provider,
    verified: row.verified,
    createdAt: row.created_at,
    profile: row.profile,
    otp: row.otp
  };
}

function userToRow(user) {
  return {
    id: user.id,
    email: user.email,
    password: user.password ?? null,
    phone: user.phone ?? null,
    provider: user.provider || 'password',
    verified: Boolean(user.verified),
    created_at: user.createdAt || new Date().toISOString(),
    profile: user.profile ?? null,
    otp: user.otp ?? null
  };
}

async function read() {
  const [users, feedback, scores] = await Promise.all([
    request('users?select=*'),
    request('feedback?select=*&order=created_at.desc'),
    request('scores?select=*&order=created_at.desc')
  ]);
  return {
    users: users.map(userFromRow),
    feedback: feedback.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      rating: row.rating,
      category: row.category,
      message: row.message,
      createdAt: row.created_at
    })),
    scores: scores.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      game: row.game,
      score: row.score,
      createdAt: row.created_at
    }))
  };
}

async function findUser(predicate) {
  const data = await read();
  return data.users.find(predicate) || null;
}

async function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const rows = await request(`users?select=*&email=eq.${encodeURIComponent(normalized)}&limit=1`);
  return userFromRow(rows[0]);
}

async function findUserById(id) {
  const rows = await request(`users?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return userFromRow(rows[0]);
}

async function saveUser(user) {
  const rows = await request('users?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(userToRow(user))
  });
  return userFromRow(rows[0]);
}

async function addScore(entry) {
  const rows = await request('scores', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: entry.id,
      user_id: entry.userId,
      name: entry.name,
      game: entry.game,
      score: entry.score,
      created_at: entry.createdAt
    })
  });
  return rows[0];
}

async function addFeedback(entry) {
  const rows = await request('feedback', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: entry.id,
      user_id: entry.userId,
      name: entry.name,
      rating: entry.rating,
      category: entry.category,
      message: entry.message,
      created_at: entry.createdAt
    })
  });
  return rows[0];
}

module.exports = { read, findUser, findUserByEmail, findUserById, saveUser, addScore, addFeedback };
