const nodemailer = require('nodemailer');

let cachedTransport = null;

function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport() {
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return cachedTransport;
}

function otpEmailHtml(code, minutes) {
  return `<div style="font-family:Segoe UI,Arial,sans-serif;background:#0f0c29;padding:32px">
  <div style="max-width:480px;margin:auto;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:18px;padding:32px;color:#fff">
    <h2 style="margin:0 0 8px">Lucky Portal verification</h2>
    <p style="color:#cfd3ff;margin:0 0 24px">Use this one time password to finish signing in.</p>
    <div style="font-size:38px;letter-spacing:12px;font-weight:700;text-align:center;background:rgba(255,255,255,.12);border-radius:14px;padding:18px">${code}</div>
    <p style="color:#cfd3ff;margin:24px 0 0">The code expires in ${minutes} minutes. If you did not request it, ignore this email.</p>
  </div>
</div>`;
}

async function sendEmailOtp(to, code, minutes) {
  if (!emailConfigured()) {
    console.log(`[dev-email] OTP for ${to}: ${code}`);
    return { delivered: false, channel: 'email', reason: 'smtp-not-configured' };
  }
  await transport().sendMail({
    from: process.env.MAIL_FROM || `Lucky Portal <${process.env.SMTP_USER}>`,
    to,
    subject: `${code} is your Lucky Portal verification code`,
    text: `Your Lucky Portal verification code is ${code}. It expires in ${minutes} minutes.`,
    html: otpEmailHtml(code, minutes)
  });
  return { delivered: true, channel: 'email' };
}

function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );
}

async function sendSmsOtp(phone, code, minutes) {
  if (!phone) return { delivered: false, channel: 'sms', reason: 'no-phone' };
  if (!smsConfigured()) {
    console.log(`[dev-sms] OTP for ${phone}: ${code}`);
    return { delivered: false, channel: 'sms', reason: 'twilio-not-configured' };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const body = new URLSearchParams({
    To: phone,
    Body: `${code} is your Lucky Portal verification code. It expires in ${minutes} minutes.`
  });
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    body.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    body.set('From', process.env.TWILIO_FROM_NUMBER);
  }
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Twilio error ${response.status}: ${detail}`);
  }
  return { delivered: true, channel: 'sms' };
}

module.exports = { sendEmailOtp, sendSmsOtp, emailConfigured, smsConfigured };
