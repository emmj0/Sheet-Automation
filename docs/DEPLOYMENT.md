# Email Automation — Full Specification & Deployment Guide

This is the **authoritative** end-to-end document: what the system is, how it
works, every environment variable, how to configure all external services, how
to run it locally, and how to deploy it to **Render (backend) + Vercel
(frontend)**.

> Where this doc and the older `docs/01–06` files disagree, **this file wins.**
> The biggest change: "Continue with Microsoft" is now the single **connection**
> (login + email sending merged), and the Microsoft token is stored **durably in
> a hidden tab of the Google Sheet** (no database, survives redeploys).

---

## Table of contents
1. [What it does](#1-what-it-does)
2. [Architecture & data flow](#2-architecture--data-flow)
3. [Repository layout](#3-repository-layout)
4. [Accounts & prerequisites](#4-accounts--prerequisites)
5. [Environment variables (complete)](#5-environment-variables-complete)
6. [External service setup](#6-external-service-setup)
7. [Run locally](#7-run-locally)
8. [Deploy: backend on Render](#8-deploy-backend-on-render)
9. [Deploy: frontend on Vercel](#9-deploy-frontend-on-vercel)
10. [Connect / disconnect (operations)](#10-connect--disconnect-operations)
11. [API reference](#11-api-reference)
12. [How the durable token store works](#12-how-the-durable-token-store-works)
13. [Security model](#13-security-model)
14. [Email deliverability (spam)](#14-email-deliverability-spam)
15. [Troubleshooting](#15-troubleshooting)
16. [End-to-end test checklist](#16-end-to-end-test-checklist)

---

## 1. What it does

1. An admin opens the site and signs in at a simple gate (`hng@admin` /
   `hng@4747`).
2. They click **Continue with Microsoft** and sign in with a Microsoft account.
   This **connects** the account: its OAuth token is saved durably, and its
   email is written to a Google Sheet row (`☐ | email | Pending`).
3. The admin can see **connection status** and **Disconnect** (which removes the
   saved Microsoft token).
4. In the Google Sheet, ticking the **checkbox** on a row triggers Google Apps
   Script, which calls the backend, which sends a "Welcome" email **from the
   connected Microsoft account** via Microsoft Graph. The row's status updates
   `Processing → Done` (or `Failed`).

No database. No SMTP (personal outlook.com blocks it — we use Microsoft Graph
OAuth2). No third-party automation tools.

---

## 2. Architecture & data flow

| Component        | Tech                                   | Responsibility |
| ---------------- | -------------------------------------- | -------------- |
| Frontend         | React + TypeScript + Vite (Vercel)     | Gate + admin panel (status/connect/disconnect) |
| Backend          | Node + Express + TypeScript (Render)   | OAuth, sheet writes, Graph email, admin API |
| Auth + Email     | Microsoft (Azure AD) via MSAL + Graph  | Login *and* sending (one connected account) |
| Spreadsheet      | Google Sheets API (service account)    | User rows + checkbox + status + token store |
| Trigger          | Google Apps Script (installable onEdit)| Detects checkbox → calls backend |
| Token store      | Hidden `_system` tab in the Sheet      | Durable, encrypted Microsoft token (no DB) |

**Connect (login):**
```
Browser → /auth/microsoft → Microsoft consent (User.Read + Mail.Send + offline_access)
        → /auth/microsoft/callback → token saved (encrypted) to _system tab
        → email written to Sheet row → redirect to frontend /success
```

**Send (checkbox):**
```
Admin ticks checkbox → Apps Script onEdit → sets "Processing"
   → POST /api/send-email (Bearer API_KEY) { email, rowNumber }
   → backend reads token from _system tab → Graph /me/sendMail
   → 202 → Apps Script sets "Done" (or "Failed")
```

**Disconnect:**
```
Admin panel → POST /admin/disconnect (x-admin-secret)
   → token + account cleared from _system tab → sending disabled until reconnect
```

---

## 3. Repository layout

```
backend/
  src/
    config/env.ts                  validated env config
    controllers/
      auth.controller.ts           /auth/microsoft (connect) + callback
      email.controller.ts          /api/send-email
      admin.controller.ts          /admin/status, /admin/disconnect
    middlewares/
      apiKey.middleware.ts         Bearer API key (Apps Script)
      admin.middleware.ts          x-admin-secret (admin panel)
      requestLogger.ts, errorHandler.ts
    services/
      microsoftAuth.service.ts     MSAL connect/status/disconnect/token
      tokenStore.ts                durable encrypted store in _system tab
      sheets.service.ts            addUser/findUserByEmail/appendRow/updateStatus
      googleSheetsAuth.service.ts  service-account auth
      email.service.ts             Microsoft Graph sendMail
    routes/                        auth, email, admin, index
    utils/                         logger, asyncHandler
    index.ts                       bootstrap
frontend/
  src/
    pages/Login.tsx                gate + admin panel
    pages/Success.tsx, Error.tsx
    components/MicrosoftButton.tsx
    config.ts                      backend URL + admin creds
  vercel.json                      SPA rewrite
apps-script/Code.gs                installable onEdit trigger
render.yaml                        Render blueprint (optional)
docs/                              setup guides (this file is authoritative)
```

---

## 4. Accounts & prerequisites

- **Node 18+** (tested on 22; Render uses 24 — all fine).
- A **Google account** for the Google Cloud project + the Google Sheet.
- A **Microsoft account** with a real Outlook mailbox (e.g. `@outlook.com`) — this
  is the account that will connect and send. (A Microsoft account whose sign-in
  is a *gmail* address is fine **only if** it also has an Outlook.com mailbox.)
- A **GitHub** repo (Render and Vercel deploy from it).
- A **Render** account and a **Vercel** account.

---

## 5. Environment variables (complete)

### Backend (`backend/.env` locally; Render → Environment in prod)

| Variable | Required | Example / default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `4000` | Listen port (Render sets its own; code reads `PORT`). |
| `NODE_ENV` | no | `production` | Mode. |
| `BACKEND_URL` | yes | `https://sheet-automation-9br8.onrender.com` | Public URL of this backend; used to build the OAuth redirect if not set. No trailing slash. |
| `FRONTEND_URL` | yes | `https://your-app.vercel.app` | Where the OAuth callback redirects the browser; also the CORS origin. No trailing slash. |
| `MS_CLIENT_ID` | yes | `e40000fc-…` | Azure app Application (client) ID. |
| `MS_CLIENT_SECRET` | yes | `abc~…` | Azure client secret **Value**. |
| `MS_TENANT` | no | `common` | `common` (personal+work), `consumers` (personal only), or a tenant id. |
| `MS_LOGIN_REDIRECT_URI` | no | `${BACKEND_URL}/auth/microsoft/callback` | Must match an Azure redirect URI exactly. |
| `GOOGLE_SHEET_ID` | yes | `1nIBio…` | The id in the Sheet URL. |
| `GOOGLE_SHEET_NAME` | no | `Sheet1` | The **tab** name holding the data. |
| `SYSTEM_SHEET_NAME` | no | `_system` | Hidden tab used as the token store. |
| `SERVICE_ACCOUNT_KEY_BASE64` | prod | base64 of the JSON | Service-account key for hosts without a file. **Takes precedence** over the path. |
| `SERVICE_ACCOUNT_KEY_PATH` | local | `./service-account.json` | Path to the key file (local dev). |
| `API_KEY` | yes | long random string | Shared secret with Apps Script (Bearer). |
| `TOKEN_ENC_KEY` | no | (defaults to `API_KEY`) | AES key for encrypting the stored token. |
| `ADMIN_USER` | no | `hng@admin` | Admin gate username (server-validated). |
| `ADMIN_PASS` | no | `hng@4747` | Admin gate password; sent as `x-admin-secret`. |
| `MAIL_SUBJECT` | no | `Your registration is confirmed` | Welcome email subject. |
| `MAIL_APP_NAME` | no | `Email Automation` | Product name in the email body. |

> `MAIL_SENDER` / `MS_MAIL_REDIRECT_URI` from earlier versions are **no longer
> used** (the separate mail-setup flow was merged into login). Safe to remove.

### Frontend (`frontend/.env` locally; Vercel → Environment in prod)

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `VITE_BACKEND_URL` | yes | `https://sheet-automation-9br8.onrender.com` | Backend base URL (baked in at build time). |
| `VITE_ADMIN_USER` | no | `hng@admin` | Gate username shown/checked client-side. |
| `VITE_ADMIN_PASS` | no | `hng@4747` | Gate password (also sent as `x-admin-secret`). |

> `VITE_*` values are compiled into the static bundle — they are **not secret**.
> The real protection is server-side (`ADMIN_PASS`, `API_KEY`).

---

## 6. External service setup

### 6.1 Google Cloud + service account (Sheets access)
1. <https://console.cloud.google.com> → **New Project** `Email Automation`.
2. **APIs & Services → Library** → enable **Google Sheets API** and **Google
   Drive API**.
3. **Credentials → Create credentials → Service account** → name `sheets-writer`
   → Done.
4. Open it → **Keys → Add key → JSON** → download. Save as
   `backend/service-account.json` (git-ignored).
5. Copy the service-account email (`…@…iam.gserviceaccount.com`).

### 6.2 Google Sheet
1. Create a sheet named **Email Automation**. Note the **tab** name (`Sheet1`).
2. Headers in row 1: `Send Email | Email Address | Status`.
3. Select **A2 downward** → **Insert → Checkbox**.
4. **Share** the sheet with the service-account email as **Editor**.
5. Copy the **Sheet ID** from the URL → `GOOGLE_SHEET_ID`.

> The backend auto-creates the hidden `_system` tab on first run — don't create
> it manually, and don't delete it (it holds the encrypted token).

### 6.3 Azure app registration (Microsoft login + Graph email)
1. <https://portal.azure.com> → **App registrations → New registration**.
   - **Supported account types**: *Accounts in any organizational directory and
     personal Microsoft accounts* (→ `MS_TENANT=common`).
   - **Redirect URI (Web)**: `http://localhost:4000/auth/microsoft/callback`.
2. Copy **Application (client) ID** → `MS_CLIENT_ID`.
3. **Authentication → Web → Add URI**, add the production callback too:
   - `https://sheet-automation-9br8.onrender.com/auth/microsoft/callback`
   (Only the **callback** URI is needed now — the old mail-callback is gone.)
4. **Certificates & secrets → New client secret** → copy the **Value** →
   `MS_CLIENT_SECRET`.
5. **API permissions → Microsoft Graph → Delegated** → add `User.Read`,
   `Mail.Send`, `offline_access`. (No admin consent needed for personal accounts.)

### 6.4 Google Apps Script (the checkbox trigger)
1. Open the Sheet → **Extensions → Apps Script**.
2. Paste all of [`apps-script/Code.gs`](../apps-script/Code.gs).
3. Edit `setupConfig()`:
   ```js
   BACKEND_URL: 'https://sheet-automation-9br8.onrender.com/api/send-email', // include the path!
   API_KEY:     'the-same-API_KEY-as-the-backend',
   ```
   Run `setupConfig` once; approve the permission prompt.
4. **Triggers (⏰) → Add Trigger**: function `onEditInstallable`, source
   *From spreadsheet*, event *On edit*. Save & approve.
   > Must be the **installable** trigger — the simple `onEdit` can't call your
   > backend.

---

## 7. Run locally

```bash
# Backend
cd backend
npm install
cp .env.example .env          # fill it in; put service-account.json here
npm run dev                   # http://localhost:4000

# Frontend (second terminal)
cd frontend
npm install
cp .env.example .env          # VITE_BACKEND_URL=http://localhost:4000
npm run dev                   # http://localhost:5173
```

For local connect to work, set `BACKEND_URL=http://localhost:4000`,
`FRONTEND_URL=http://localhost:5173`, and
`MS_LOGIN_REDIRECT_URI=http://localhost:4000/auth/microsoft/callback` (and ensure
that exact URI is registered in Azure). For Apps Script to reach a local
backend, expose it with `ngrok http 4000` and use that HTTPS URL as the Apps
Script `BACKEND_URL`.

---

## 8. Deploy: backend on Render

1. **New → Web Service** → connect the GitHub repo.
2. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/index.js`
   - **Health Check Path**: `/health`
3. **Environment** — add every backend variable from §5. Key points:
   - `SERVICE_ACCOUNT_KEY_BASE64` ← base64 of the JSON (the file isn't on GitHub):
     ```powershell
     [Convert]::ToBase64String([IO.File]::ReadAllBytes("backend\service-account.json")) | Set-Clipboard
     ```
     Paste into the **value** of a variable named **exactly** `SERVICE_ACCOUNT_KEY_BASE64`.
     (Do **not** put it in `SERVICE_ACCOUNT_KEY_PATH`.)
   - `BACKEND_URL` = your `https://<service>.onrender.com`
   - `FRONTEND_URL` = your Vercel URL (set after §9)
   - `MS_LOGIN_REDIRECT_URI` = `https://<service>.onrender.com/auth/microsoft/callback`
   - `API_KEY`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `GOOGLE_SHEET_ID`, etc.
4. Deploy. Confirm `GET https://<service>.onrender.com/health` → `{"status":"ok"}`.

**Build-dependency note:** `typescript` and the `@types/*` packages are in
`dependencies` (not `devDependencies`) on purpose, because Render runs
`npm install` with `NODE_ENV=production` which would otherwise skip them.

**Free tier caveats:**
- The instance **sleeps** after inactivity; the first request wakes it (~50s).
- The filesystem is **ephemeral**. This used to wipe the Microsoft token on every
  deploy — that's why the token is now stored in the Google Sheet (§12), which
  **survives redeploys**. No Render disk required.

---

## 9. Deploy: frontend on Vercel

1. **Add New → Project** → import the repo.
2. **Root Directory**: `frontend` (Vite is auto-detected; `vercel.json` adds the
   SPA rewrite so `/success` and `/error` work on refresh).
3. **Environment Variables**:
   - `VITE_BACKEND_URL` = `https://<service>.onrender.com`
   - (optional) `VITE_ADMIN_USER`, `VITE_ADMIN_PASS`
4. Deploy → copy the URL (e.g. `https://your-app.vercel.app`).
5. **Back to Render** → set `FRONTEND_URL` to that URL → save (redeploys).
6. **Azure** → ensure the production `…/auth/microsoft/callback` is in the
   redirect URIs.

---

## 10. Connect / disconnect (operations)

1. Open the Vercel site → enter `hng@admin` / `hng@4747`.
2. The admin panel shows **Microsoft connection** status:
   - **Not connected** → click **Continue with Microsoft**, sign in, Accept. The
     token is saved (encrypted) to the `_system` tab and the account's email is
     added to the sheet.
   - **Connected as <email>** → a **Disconnect** button appears.
3. **Disconnect** removes the saved token/account from the `_system` tab.
   Sending stops working until you reconnect. It does **not** touch user rows.

Because the token is in the sheet, you **connect once** and it keeps working
across Render redeploys — no more re-authorizing after every deploy.

---

## 11. API reference

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | none | Health check. |
| GET | `/auth/microsoft` | none¹ | Start connect/login. |
| GET | `/auth/microsoft/callback` | none | OAuth callback: save token + add row. |
| GET | `/admin/status` | `x-admin-secret` | `{ connected, email, connectedAt }`. |
| POST | `/admin/disconnect` | `x-admin-secret` | Remove the saved Microsoft token. |
| POST | `/api/send-email` | `Bearer API_KEY` | Send email (called by Apps Script). |

¹ `/auth/microsoft` is public (the frontend gate is in front of it). Whoever
completes it becomes the connected sending account, so don't share the raw URL.

`POST /api/send-email`
```http
POST /api/send-email
Authorization: Bearer <API_KEY>
Content-Type: application/json

{ "email": "user@example.com", "rowNumber": 5 }
```
Responses: `{ "success": true, "messageId": "..." }` or
`{ "success": false, "error": "...", "code": "INVALID_EMAIL | INVALID_API_KEY | MAIL_SEND_FAILURE" }`.

---

## 12. How the durable token store works

- On connect, MSAL caches the refresh token. A cache plugin serializes it,
  **AES-256-GCM encrypts** it (key = `TOKEN_ENC_KEY`, default `API_KEY`), and
  writes it to cell **A1** of the hidden **`_system`** tab. The connected account
  (`homeAccountId`, `username`, `connectedAt`) goes to **A2** (also encrypted).
- On send, the backend reads `_system`, decrypts, and calls
  `acquireTokenSilent` to get a fresh Graph access token (MSAL rotates the
  refresh token and the plugin re-saves it).
- On disconnect, `_system!A1:A2` is cleared.
- This is why redeploys no longer break email: the token lives in the Sheet, not
  on Render's disk. There is **no database**.

Security trade-off: the encrypted blob sits in a tab of your spreadsheet. It's
**hidden** and **encrypted**, but anyone with edit access to the Sheet *and* the
`TOKEN_ENC_KEY` could decrypt it. Keep `API_KEY`/`TOKEN_ENC_KEY` secret and limit
sheet sharing.

---

## 13. Security model

- **Apps Script → backend**: `Authorization: Bearer <API_KEY>` (constant-time
  compare). Reject everything else.
- **Admin panel → backend**: `x-admin-secret: <ADMIN_PASS>` (constant-time).
- **Token at rest**: AES-256-GCM encrypted in the `_system` tab.
- **Secrets never in git**: `.env`, `service-account.json` are git-ignored; on
  Render use env vars + `SERVICE_ACCOUNT_KEY_BASE64`.
- **Known limitation**: the admin gate password is also in the frontend bundle
  (it's a light gate). For real protection, move to a backend-issued session
  token. The sending capability itself is protected server-side.
- If a secret leaks (it's appeared in logs/chat before): **rotate it** — new
  Azure client secret, new service-account key, new `API_KEY`.

---

## 14. Email deliverability (spam)

Sends from a brand-new **personal outlook.com** account often land in **spam** —
that's sender *reputation*, not a bug (the API returns 202 = accepted). Levers:
- Recipients click **Not junk / Not spam** and add the sender to contacts (most
  effective; trains the filter fast).
- The email is already tuned (specific subject, personalization, "why you got
  this" footer) to reduce spam scoring.
- For **reliable inbox** delivery, switch sending to a transactional provider
  (Resend/Brevo/SendGrid) with a verified domain (SPF/DKIM/DMARC). That's the
  professional fix; a personal mailbox never fully guarantees inbox.

---

## 15. Troubleshooting

| Symptom | Cause → Fix |
| --- | --- |
| `TS5107 moduleResolution=node10 deprecated` | TS 5.9 build error → `tsconfig` uses `"module"/"moduleResolution": "Node16"` (already set). |
| `Cannot find name 'process'` / `Could not find declaration file for 'express'` on Render | Prod install skipped devDeps → `typescript` + `@types/*` are in `dependencies` (already moved). |
| `Service account key not found at …<base64>…` | Base64 pasted into `SERVICE_ACCOUNT_KEY_PATH` → put it in `SERVICE_ACCOUNT_KEY_BASE64` instead. |
| Login → `/error?reason=oauth_failed`; log says key not found | `SERVICE_ACCOUNT_KEY_BASE64` missing on Render → add it. |
| `redirect_uri … is not valid` on Microsoft page | The callback URL isn't registered → add the exact `…/auth/microsoft/callback` under Azure **Web** redirect URIs. |
| `account does not exist in tenant` | App registered single-tenant → set Supported account types to multitenant+personal, or `signInAudience: AzureADandPersonalMicrosoftAccount`. |
| New row lands at row ~1001 | Old append behavior with full-column checkboxes → fixed: rows now placed after the last email in column B. |
| Column A shows `TRUE/FALSE` text, not boxes | Apply checkbox data-validation to `A2:A1000` (a checkbox *is* a TRUE/FALSE value, just displayed as a box). |
| Emails go to spam | Reputation — see §14. |
| Checkbox does nothing | Trigger not installed / simple trigger used → create the **installable** `onEditInstallable` trigger. |
| Status `Failed` | Wrong `API_KEY` in Apps Script, `BACKEND_URL` missing `/api/send-email`, backend asleep, or **not connected** (reconnect in the admin panel). |
| `403 caller does not have permission` | Share the Sheet (Editor) with the service-account email. |

---

## 16. End-to-end test checklist

- [ ] `GET /health` returns ok.
- [ ] Azure has the production `…/auth/microsoft/callback` redirect URI.
- [ ] Render has `SERVICE_ACCOUNT_KEY_BASE64`, `BACKEND_URL`, `FRONTEND_URL`,
      `MS_*`, `API_KEY`, `GOOGLE_SHEET_ID`.
- [ ] Vercel has `VITE_BACKEND_URL` pointing at Render.
- [ ] Sheet shared (Editor) with the service account.
- [ ] Apps Script `setupConfig` points at `…/api/send-email` with the right
      `API_KEY`; installable `onEditInstallable` trigger exists.
- [ ] Admin panel: sign in → **Continue with Microsoft** → status shows
      **Connected as <email>**, and a row appears at the top of the sheet.
- [ ] Tick that row's checkbox → status `Processing → Done` → email arrives
      (check spam).
- [ ] Admin panel **Disconnect** → status flips to **Not connected**; ticking a
      box now yields `Failed` until you reconnect.
