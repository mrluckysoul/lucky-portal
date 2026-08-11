const STEPS = ['Basics', 'Education & work', 'Contact & social', 'Interests'];
const HOBBIES = ['Reading', 'Music', 'Cricket', 'Football', 'Gaming', 'Cooking', 'Travel', 'Drawing', 'Dance', 'Photography', 'Coding', 'Gardening'];
const FIELDS = ['fullName', 'fatherName', 'motherName', 'dob', 'age', 'gender', 'qualification', 'occupation',
  'institution', 'maritalStatus', 'city', 'phone', 'contactEmail', 'facebook', 'instagram', 'linkedin',
  'twitter', 'hobbies', 'extraCurricular', 'about'];

let step = 0;

function el(id) { return document.getElementById(id); }

function renderStepper() {
  el('stepper').innerHTML = STEPS.map((label, i) =>
    `<div class="step-pill ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}">${i + 1}. ${label}</div>`
  ).join('');
}

function showStep(next) {
  step = Math.min(STEPS.length - 1, Math.max(0, next));
  document.querySelectorAll('.step').forEach((node) => {
    node.classList.toggle('hidden', Number(node.dataset.step) !== step);
  });
  el('prevBtn').classList.toggle('hidden', step === 0);
  el('nextBtn').classList.toggle('hidden', step === STEPS.length - 1);
  el('saveBtn').classList.toggle('hidden', step !== STEPS.length - 1);
  renderStepper();
}

function validateStep() {
  const box = el('alertBox');
  if (step === 0) {
    if (!el('fullName').value.trim()) { box.className = 'alert error'; box.textContent = 'Full name is required.'; return false; }
    if (!el('dob').value) { box.className = 'alert error'; box.textContent = 'Date of birth is required.'; return false; }
  }
  box.className = 'alert hidden';
  return true;
}

function computeAge() {
  const value = el('dob').value;
  if (!value) return;
  const birth = new Date(value);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  el('age').value = age >= 0 ? age : '';
}

function renderHobbyChips() {
  el('hobbyChips').innerHTML = HOBBIES.map((h) => `<span class="chip" data-hobby="${h}">${h}</span>`).join('');
  el('hobbyChips').addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    chip.classList.toggle('selected');
    const picked = [...el('hobbyChips').querySelectorAll('.chip.selected')].map((c) => c.dataset.hobby);
    const manual = el('hobbies').value.split(',').map((s) => s.trim()).filter((s) => s && !HOBBIES.includes(s));
    el('hobbies').value = [...picked, ...manual].join(', ');
  });
}

function fillForm(profile) {
  if (!profile) return;
  FIELDS.forEach((field) => {
    if (el(field) && profile[field] !== undefined) el(field).value = profile[field];
  });
  const picked = String(profile.hobbies || '').split(',').map((s) => s.trim());
  el('hobbyChips').querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('selected', picked.includes(chip.dataset.hobby));
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initNav('profile');
  renderHobbyChips();
  showStep(0);

  const user = await requireSession({ needProfile: false });
  if (!user) return;
  if (!el('contactEmail').value) el('contactEmail').value = user.email;
  if (user.phone) el('phone').value = user.phone;
  fillForm(user.profile);
  computeAge();

  el('dob').addEventListener('change', computeAge);
  el('nextBtn').addEventListener('click', () => { if (validateStep()) showStep(step + 1); });
  el('prevBtn').addEventListener('click', () => showStep(step - 1));

  el('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateStep()) return;
    const payload = {};
    FIELDS.forEach((field) => { if (el(field)) payload[field] = el(field).value; });
    if (!payload.fullName.trim() || !payload.dob) {
      showStep(0);
      return validateStep();
    }
    try {
      await api.put('/api/profile', payload);
      toast('Profile saved 🎉');
      setTimeout(() => (location.href = '/welcome.html'), 700);
    } catch (err) {
      el('alertBox').className = 'alert error';
      el('alertBox').textContent = err.message;
    }
  });
});
