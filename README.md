# Email Automation — Microsoft Login + Google Sheets + Outlook (Graph) Email

A production-ready system where a user signs in with their **Microsoft account**,
their email is stored in a **Google Sheet**, and an admin can trigger a welcome
email by **ticking a checkbox** in the sheet. Email is sent through
**Microsoft Graph** (Outlook) — no SMTP, no Zapier/Make/n8n.

```
User → "Continue with Microsoft" → Microsoft OAuth → backend gets email
     → backend saves email to Google Sheet (FALSE | email | Pending)
Admin opens the Sheet → ticks the checkbox (FALSE → TRUE)
     → Apps Script onEdit fires → sets "Processing" → POST /api/send-email (Bearer API key)
     → backend sends email via Microsoft Graph /me/sendMail
     → Apps Script sets "Done" (or "Failed")
```

> **Why Microsoft Graph instead of SMTP?** This build targets a **personal
> outlook.com** sender, and Microsoft disabled SMTP basic-auth / app passwords
> for personal accounts. Graph + OAuth2 is the supported path. See
> [docs/05-microsoft-setup.md](docs/05-microsoft-setup.md).

---

## Architecture

| Concern              | Technology                                   |
| -------------------- | -------------------------------------------- |
| Frontend             | React + TypeScript + Vite + React Router     |
| Backend              | Node.js + Express + TypeScript               |
| **User login**       | Microsoft OAuth 2.0 (Azure AD) via **MSAL**  |
| **Email sending**    | Outlook via **Microsoft Graph** `/me/sendMail` (OAuth2) |
| Spreadsheet          | Google Sheets API via a **service account**  |
| Automation trigger   | Google Apps Script (installable `onEdit`)    |
| Logging              | winston (console + file)                     |

```
.
├── backend/        Express + TS API (login, sheets, mail)
├── frontend/       React + TS sign-in UI
├── apps-script/    Code.gs for the spreadsheet
├── docs/           Step-by-step setup guides
└── README.md       (this file)
```

---

## Setup guides (do these in order)

1. [Google Cloud project](docs/01-google-cloud-setup.md) — enable Sheets + Drive APIs
2. [Service account](docs/02-service-account.md) — JSON key + share the sheet
3. [Google Sheet](docs/03-google-sheet.md) — columns, checkbox, sheet ID
4. [Apps Script](docs/04-apps-script.md) — paste `Code.gs`, installable trigger
5. [Microsoft setup](docs/05-microsoft-setup.md) — Azure app, login + Graph mail, **authorize sender**
6. [Deployment](docs/06-deployment.md) — env vars, build, HTTPS, domain

---

## Quick start (local dev)

Prereqs: **Node 18+** (tested on Node 22). You'll need the values from the docs
above (Azure client id/secret, sheet id, service account JSON, API key).

### 1) Backend

```bash
cd backend
npm install
cp .env.example .env          # then fill it in (PowerShell: copy .env.example .env)
# place service-account.json in backend/
npm run dev                   # http://localhost:4000
```

Then authorize the sender mailbox **once**:
visit <http://localhost:4000/auth/microsoft/mail-setup> and sign in as your
sender outlook.com account (see [docs/05](docs/05-microsoft-setup.md#56-authorize-the-sender-mailbox-one-time)).

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_BACKEND_URL=http://localhost:4000
npm run dev                   # http://localhost:5173
```

Open <http://localhost:5173> → **Continue with Microsoft** → you land on the
success page and a new row appears in the sheet.

### 3) Apps Script

Follow [docs/04](docs/04-apps-script.md): paste `apps-script/Code.gs`, run
`setupConfig` (set `BACKEND_URL` + `API_KEY`), and add the installable `On edit`
trigger for `onEditInstallable`.

> For Google's servers to reach a **local** backend, expose it with
> `ngrok http 4000` and use that HTTPS URL as `BACKEND_URL`.

---

## API reference

| Method | Path                              | Auth        | Purpose                              |
| ------ | --------------------------------- | ----------- | ------------------------------------ |
| GET    | `/health`                         | none        | Health check                         |
| GET    | `/auth/microsoft`                 | none        | Start user login                     |
| GET    | `/auth/microsoft/callback`        | none        | OAuth callback → save email          |
| GET    | `/auth/microsoft/mail-setup`      | none¹       | One-time: authorize sender mailbox   |
| GET    | `/auth/microsoft/mail-callback`   | none¹       | Stores the sender refresh token      |
| POST   | `/api/send-email`                 | **Bearer**  | Send email (called by Apps Script)   |

¹ Protect the `mail-setup` routes in production (IP allow-list / temporary
enablement) — only the admin should authorize the sender mailbox.

`POST /api/send-email`

```http
POST /api/send-email
Authorization: Bearer <API_KEY>
Content-Type: application/json

{ "email": "user@outlook.com", "rowNumber": 5 }
```

```json
{ "success": true, "email": "user@outlook.com", "rowNumber": 5, "messageId": "..." }
```

Errors return `{ "success": false, "error": "...", "code": "..." }` with codes
like `INVALID_EMAIL`, `INVALID_API_KEY`, `MAIL_SEND_FAILURE`.

---

## How it works (key files)

- **Login** — [`microsoftAuth.service.ts`](backend/src/services/microsoftAuth.service.ts)
  builds the consent URL and exchanges the code via MSAL; the email comes from
  the ID token.
- **Sheet** — [`sheets.service.ts`](backend/src/services/sheets.service.ts):
  `addUser`, `findUserByEmail` (duplicate prevention), `appendRow`,
  `updateStatus`, `getRow`. New users are appended as `FALSE | email | Pending`.
- **Duplicate logic** — `addUser` checks `findUserByEmail` first; if present it
  returns `created: false` and the UI shows **"You are already registered."**
- **Email** — [`email.service.ts`](backend/src/services/email.service.ts) sends
  through Graph using a token from the cached sender refresh token.
- **Security** — [`apiKey.middleware.ts`](backend/src/middlewares/apiKey.middleware.ts)
  enforces `Authorization: Bearer <API_KEY>` (constant-time compare).
- **Logging** — [`logger.ts`](backend/src/utils/logger.ts) writes to console and
  `backend/logs/*.log` (logins, registrations, requests, sends, errors).
- **Errors** — [`errorHandler.ts`](backend/src/middlewares/errorHandler.ts)
  centralizes JSON error responses.

---

## Security notes

- Never commit `.env`, `service-account.json`, `.mail-token-cache.json`, or
  `.mail-account.json` (all git-ignored).
- `API_KEY` should be a long random string; rotate it on both backend `.env`
  and the Apps Script `setupConfig` if leaked.
- End users only ever grant `User.Read`; only the dedicated sender mailbox grants
  `Mail.Send` (via the one-time `mail-setup` flow).

---

## Troubleshooting

| Symptom                                   | Fix                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `403 The caller does not have permission` | Share the Sheet (Editor) with the service account email (Step 2.4). |
| Login fails / `access_denied`             | Account type mismatch — check `MS_TENANT` vs the app's "Supported account types". |
| Mail send `MAIL_SEND_FAILURE`             | Run `…/auth/microsoft/mail-setup` once; confirm `Mail.Send` permission. |
| Apps Script stays on `Failed`             | Backend not public, wrong `API_KEY`, or `BACKEND_URL` missing `/api/send-email`. |
| `UrlFetchApp` permission error in script  | You used the simple trigger — create the **installable** `onEdit` (Step 4.4). |
| Emails stop after a redeploy (PaaS)       | Ephemeral disk wiped the token cache — use a volume or re-auth (Step 12.3). |

---

## License

MIT.
