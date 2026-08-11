let rating = 5;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderStars() {
  document.getElementById('stars').innerHTML = [1, 2, 3, 4, 5]
    .map((n) => `<span class="star ${n <= rating ? 'on' : ''}" data-n="${n}">★</span>`)
    .join('');
}

async function loadFeedback() {
  const list = document.getElementById('feedbackList');
  try {
    const { feedback } = await api.get('/api/feedback');
    list.innerHTML = feedback.length
      ? feedback
          .map((f) => `<li><b>${escapeHtml(f.name)}</b> <span class="muted">· ${escapeHtml(f.category)} · ${'★'.repeat(f.rating)}</span><br>${escapeHtml(f.message)}<div class="muted" style="font-size:12px;margin-top:6px">${new Date(f.createdAt).toLocaleString()}</div></li>`)
          .join('')
      : '<li class="muted">No feedback yet — be the first.</li>';
  } catch (err) {
    list.innerHTML = `<li class="muted">Could not load feedback: ${escapeHtml(err.message)}</li>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initNav('feedback');
  renderStars();
  await requireSession();
  loadFeedback();

  document.getElementById('stars').addEventListener('click', (event) => {
    const star = event.target.closest('.star');
    if (!star) return;
    rating = Number(star.dataset.n);
    renderStars();
  });

  document.getElementById('feedbackForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const box = document.getElementById('alertBox');
    try {
      await api.post('/api/feedback', {
        rating,
        category: document.getElementById('category').value,
        message: document.getElementById('message').value
      });
      box.className = 'alert ok';
      box.textContent = 'Thanks for the feedback! 🙏';
      document.getElementById('message').value = '';
      rating = 5;
      renderStars();
      loadFeedback();
    } catch (err) {
      box.className = 'alert error';
      box.textContent = err.message;
    }
  });
});
