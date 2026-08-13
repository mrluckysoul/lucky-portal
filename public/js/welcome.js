const LABELS = {
  fullName: 'Full name', fatherName: "Father's name", motherName: "Mother's name", dob: 'Date of birth',
  age: 'Age', gender: 'Gender', qualification: 'Qualification', occupation: 'Status',
  institution: 'College / company', maritalStatus: 'Marital status', city: 'City', phone: 'Mobile',
  contactEmail: 'Contact email', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn',
  twitter: 'X / Twitter', hobbies: 'Hobbies', extraCurricular: 'Extra curricular', about: 'About'
};

function greetingWord() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function renderDetails(user) {
  const profile = user.profile || {};
  const rows = Object.keys(LABELS)
    .filter((key) => String(profile[key] || '').trim())
    .map((key) => `<dt>${LABELS[key]}</dt><dd>${escapeHtml(profile[key])}</dd>`);
  rows.unshift(`<dt>Account email</dt><dd>${escapeHtml(user.email)}</dd>`);
  document.getElementById('details').innerHTML = rows.join('');

  const filled = Object.keys(LABELS).filter((key) => String(profile[key] || '').trim()).length;
  const pct = Math.round((filled / Object.keys(LABELS).length) * 100);
  document.getElementById('strengthBar').style.width = `${pct}%`;
  document.getElementById('strengthText').textContent =
    pct === 100 ? 'Perfect, your profile is complete! 🎉' : `${pct}% complete — add more details to reach 100%.`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderLeaderboard() {
  try {
    const { leaderboard } = await api.get('/api/scores');
    if (!leaderboard.length) return;
    document.getElementById('leaderboard').innerHTML = leaderboard
      .slice(0, 8)
      .map((e, i) => `<li><b>#${i + 1}</b> ${escapeHtml(e.name)} — ${escapeHtml(e.game)} <span class="muted">(${e.score} pts)</span></li>`)
      .join('');
  } catch (err) {
    /* leaderboard is optional */
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initNav('welcome');
  const user = await requireSession();
  if (!user) return;
  const name = (user.profile && user.profile.fullName) || user.email;
  document.getElementById('avatar').textContent = initials(name);
  document.getElementById('greeting').textContent = `${greetingWord()}, ${name.split(' ')[0]}! 🎉`;
  document.getElementById('subGreeting').textContent = 'Your profile is saved. Explore the arcade or leave feedback below.';
  renderDetails(user);
  renderLeaderboard();
});
