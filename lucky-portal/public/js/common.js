const api = {
  async request(method, url, body) {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined
    });
    let data = {};
    try { data = await response.json(); } catch (err) { data = {}; }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); }
};

function toast(message, ms = 2600) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove('show'), ms);
}

function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  localStorage.setItem('lp_theme', theme);
  const btn = document.querySelector('[data-theme-toggle]');
  if (btn) btn.textContent = theme === 'light' ? 'Dark mode' : 'Light mode';
}

function initTheme() {
  applyTheme(localStorage.getItem('lp_theme') || 'dark');
  const btn = document.querySelector('[data-theme-toggle]');
  if (btn) {
    btn.addEventListener('click', () => {
      applyTheme(document.body.classList.contains('theme-light') ? 'dark' : 'light');
    });
  }
}

async function requireSession({ needProfile = true } = {}) {
  try {
    const { user } = await api.get('/api/me');
    if (needProfile && !user.profileComplete && !location.pathname.startsWith('/profile')) {
      location.href = '/profile.html';
      return null;
    }
    return user;
  } catch (err) {
    location.href = '/index.html';
    return null;
  }
}

function initNav(active) {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  nav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.nav === active) a.classList.add('active');
  });
  const logout = document.querySelector('[data-logout]');
  if (logout) {
    logout.addEventListener('click', async () => {
      await api.post('/api/auth/logout');
      location.href = '/index.html';
    });
  }
}

function initials(nameOrEmail) {
  const value = String(nameOrEmail || '?').trim();
  const parts = value.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

async function saveScore(game, score) {
  try {
    await api.post('/api/scores', { game, score });
  } catch (err) {
    console.warn('score not saved', err.message);
  }
}

document.addEventListener('DOMContentLoaded', initTheme);
