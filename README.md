# 🍀 Lucky Portal

A full-stack learning project: glassmorphism sign-in / sign-up, **OTP verification by email *and* SMS**, Google sign-in, a multi-step personal information form, a **six game mini arcade** with a leaderboard, and a feedback wall.

Stack: plain HTML + CSS + JavaScript on the front end, Node.js + Express with a JSON file database on the back end. No build step.

> ⚠️ Passwords are stored in plain text on purpose — this is a learning sandbox, as requested. Do not reuse a real password here.

## Run locally

```bash
npm install
cp .env.example .env    # optional, see below
npm start               # http://localhost:3000
npm test                # API smoke tests
```

Without any provider keys the app runs in **dev OTP mode**: the 6 digit code is printed in the server console and shown on the verify screen, so you can test the whole flow offline.

## Real OTP delivery (email + mobile)

| Channel | Env vars | Where to get them |
| --- | --- | --- |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Gmail app password, Brevo, SendGrid, Mailgun, Zoho… |
| Mobile SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`) | https://console.twilio.com |

Both channels get the same code. If the user gave a mobile number at signup, the code goes to email **and** SMS; otherwise email only. Codes are SHA-256 hashed, expire after `OTP_TTL_MINUTES` (default 10) and lock after 5 wrong attempts.

Gmail note: enable 2-Step Verification, then create an *App password* at https://myaccount.google.com/apppasswords and use it as `SMTP_PASS`.

India / Twilio note: to send SMS to Indian numbers you must register a sender ID and template with TRAI DLT; until then use a Twilio trial number with a verified recipient, or rely on email OTP.

## Google sign-in

Set `GOOGLE_CLIENT_ID` to a Google OAuth **Web client** id (https://console.cloud.google.com/apis/credentials) and add your deployed origin to *Authorised JavaScript origins*. The real Google Identity Services button then appears and the id token is verified server side. With no client id configured, a clearly labelled demo Google button is shown instead.

## Deploy (not just localhost)

- **Render**: `render.yaml` is included. Create a Blueprint from the repo, then fill the SMTP/Twilio/Google values in the dashboard. The free plan has no persistent disk, so `data/db.json` is wiped on each deploy or restart — upgrade the plan and uncomment the `disk:` block plus `DATA_DIR=/var/data` in `render.yaml` to keep accounts between deploys.
- **Docker**: `docker build -t lucky-portal . && docker run -p 3000:3000 --env-file .env -v $PWD/data:/app/data lucky-portal`
- Any Node host (Railway, Fly.io, VPS) works: `npm ci && node server/index.js`.

Set `COOKIE_SECURE=true` and a strong `JWT_SECRET` in production.

## Pages

| Page | What it does |
| --- | --- |
| `/index.html` | Sign in / sign up tabs, Google button, 6-box OTP screen with resend |
| `/profile.html` | 4-step form: basics (name, father, mother, DOB, auto age, gender), education & work (qualification, student/working, marital status, city, mobile), contact & social (Facebook, Instagram, LinkedIn, X), interests (hobby chips, extra curricular, about) |
| `/welcome.html` | Personalised greeting, profile summary, profile-strength meter, leaderboard |
| `/games.html` | Tic Tac Toe (minimax AI), Guess the number, Memory match, Rock paper scissors, Whack a mole, Typing speed |
| `/feedback.html` | Star rating + category + message, live feedback wall |

Extras: dark/light theme toggle, score leaderboard, toast notifications, responsive layout, animated gradient background.

## API

`POST /api/auth/signup` · `POST /api/auth/signin` · `POST /api/auth/otp/verify` · `POST /api/auth/otp/resend` · `POST /api/auth/google` · `POST /api/auth/logout` · `GET /api/me` · `PUT /api/profile` · `GET|POST /api/scores` · `GET|POST /api/feedback` · `GET /api/config` · `GET /api/health`

Auth uses a signed JWT in an httpOnly cookie. Data lives in `data/db.json`.

## Supabase + Render deployment

This version stores users, feedback, and scores in Supabase instead of the local `data/db.json` file.

Set these server-side environment variables:

- `SUPABASE_URL` — your Supabase project URL.
- `SUPABASE_SECRET_KEY` — your Supabase Secret API key (`sb_secret_...`). Never put this in frontend code or GitHub.
- `JWT_SECRET` — a long random value.
- `COOKIE_SECURE=true` when deployed on HTTPS.

The Supabase Secret API key is used only by the Node.js backend and bypasses RLS. Keep it only in Render environment variables.
