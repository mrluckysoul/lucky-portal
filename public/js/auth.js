const el = (id) => document.getElementById(id);
let pendingEmail = null;

function showAlert(box, message, kind = 'error') {
  box.textContent = message;
  box.className = `alert ${kind}`;
}

function hideAlert(box) {
  box.className = 'alert hidden';
}

function switchTab(target) {
  const signin = target === 'signin';
  el('tabSignin').classList.toggle('active', signin);
  el('tabSignup').classList.toggle('active', !signin);
  el('signinForm').classList.toggle('hidden', !signin);
  el('signupForm').classList.toggle('hidden', signin);
  hideAlert(el('alertBox'));
}

function showOtpPanel(email, info) {
  pendingEmail = email;
  el('authPanel').classList.add('hidden');
  el('otpPanel').classList.remove('hidden');
  el('otpTarget').textContent = email;
  const inputs = [...el('otpInputs').querySelectorAll('input')];
  inputs.forEach((i) => (i.value = ''));
  inputs[0].focus();
  describeDelivery(info);
}

function describeDelivery(info) {
  const box = el('otpAlert');
  if (!info) return hideAlert(box);
  if (info.devCode) {
    showAlert(box, `Dev mode: no email/SMS provider configured, your code is ${info.devCode}`, 'info');
  } else if (info.channels && info.channels.length) {
    const where = info.channels.map((c) => (c === 'sms' ? 'mobile' : 'email')).join(' and ');
    showAlert(box, `Code sent to your ${where}. It expires in ${info.expiresInMinutes} minutes.`, 'ok');
  } else {
    showAlert(box, `Check your email for the verification code. It expires in ${info.expiresInMinutes} minutes.`, 'ok');
  }
}

function waitForGoogle(maxMs = 8000) {
  return new Promise((resolve) => {
    if (window.google && google.accounts) return resolve(true);
    const start = Date.now();
    const tick = () => {
      if (window.google && google.accounts) return resolve(true);
      if (Date.now() - start > maxMs) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
}

function otpValue() {
  return [...el('otpInputs').querySelectorAll('input')].map((i) => i.value.trim()).join('');
}

async function afterLogin(user) {
  location.href = user.profileComplete ? '/welcome.html' : '/profile.html';
}

function bindOtpInputs() {
  const inputs = [...el('otpInputs').querySelectorAll('input')];
  inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
      if (input.value && index < inputs.length - 1) inputs[index + 1].focus();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && index > 0) inputs[index - 1].focus();
      if (event.key === 'Enter') el('verifyBtn').click();
    });
    input.addEventListener('paste', (event) => {
      const digits = (event.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (!digits) return;
      event.preventDefault();
      digits.split('').forEach((d, i) => (inputs[i].value = d));
      inputs[Math.min(digits.length, 5)].focus();
    });
  });
}

async function initGoogle() {
  const config = await api.get('/api/config').catch(() => ({}));
  if (!config.googleClientId) {
    el('mockGoogle').classList.remove('hidden');
    return;
  }
  const ready = await waitForGoogle();
  if (ready) {
    google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: async (response) => {
        try {
          const { user } = await api.post('/api/auth/google', { credential: response.credential });
          afterLogin(user);
        } catch (err) {
          showAlert(el('alertBox'), err.message);
        }
      }
    });
    google.accounts.id.renderButton(el('googleMount'), { theme: 'filled_blue', size: 'large', width: 340, text: 'continue_with' });
  } else {
    el('mockGoogle').classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindOtpInputs();
  el('tabSignin').addEventListener('click', () => switchTab('signin'));
  el('tabSignup').addEventListener('click', () => switchTab('signup'));

  el('signinForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(el('alertBox'));
    try {
      const data = await api.post('/api/auth/signin', {
        email: el('signinEmail').value,
        password: el('signinPassword').value
      });
      if (data.needsVerification) showOtpPanel(data.email, data);
      else afterLogin(data.user);
    } catch (err) {
      showAlert(el('alertBox'), err.message);
    }
  });

  el('signupForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert(el('alertBox'));
    if (el('signupPassword').value !== el('signupConfirm').value) {
      return showAlert(el('alertBox'), 'Both passwords must match.');
    }
    const btn = el('signupForm').querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const data = await api.post('/api/auth/signup', {
        email: el('signupEmail').value,
        password: el('signupPassword').value,
        phone: el('signupPhone').value.trim() || undefined
      });
      showOtpPanel(data.email, data);
    } catch (err) {
      showAlert(el('alertBox'), err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });

  el('verifyBtn').addEventListener('click', async () => {
    const code = otpValue();
    if (code.length !== 6) return showAlert(el('otpAlert'), 'Enter all 6 digits.');
    try {
      const { user } = await api.post('/api/auth/otp/verify', { email: pendingEmail, code });
      afterLogin(user);
    } catch (err) {
      showAlert(el('otpAlert'), err.message);
    }
  });

  el('resendBtn').addEventListener('click', async () => {
    try {
      const info = await api.post('/api/auth/otp/resend', { email: pendingEmail });
      describeDelivery(info);
    } catch (err) {
      showAlert(el('otpAlert'), err.message);
    }
  });

  el('backBtn').addEventListener('click', () => {
    el('otpPanel').classList.add('hidden');
    el('authPanel').classList.remove('hidden');
  });

  el('mockGoogle').addEventListener('click', async () => {
    const email = prompt('Demo Google sign-in — enter the Google email to use:');
    if (!email) return;
    try {
      const { user } = await api.post('/api/auth/google', { mockEmail: email });
      afterLogin(user);
    } catch (err) {
      showAlert(el('alertBox'), err.message);
    }
  });

  initGoogle();
});
