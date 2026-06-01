# Step 12 — Deployment

Apps Script (running on Google's servers) must reach your backend over **public
HTTPS**. Below are the env vars, build steps, and host-specific notes.

---

## 12.1 Environment variables (production)

Set these on your host (don't commit `.env`). Update every URL to your domain.

### Backend

```env
NODE_ENV=production
PORT=4000
BACKEND_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Microsoft
MS_CLIENT_ID=...
MS_CLIENT_SECRET=...
MS_TENANT=common
MS_LOGIN_REDIRECT_URI=https://api.yourdomain.com/auth/microsoft/callback
MS_MAIL_REDIRECT_URI=https://api.yourdomain.com/auth/microsoft/mail-callback
MAIL_SENDER=youraddress@outlook.com

# Google Sheets (service account)
GOOGLE_SHEET_ID=...
GOOGLE_SHEET_NAME=Sheet1
# Prefer base64 on PaaS hosts (no file to upload):
SERVICE_ACCOUNT_KEY_BASE64=eyJ0eXBl...

# Shared secret with Apps Script
API_KEY=long-random-string
```

> **Important:** every redirect URI above must also be added to the Azure app
> registration (**Authentication → Redirect URIs**), exactly. See
> [Step 5.2](05-microsoft-setup.md).

### Frontend

```env
VITE_BACKEND_URL=https://api.yourdomain.com
```

`VITE_*` vars are baked in at **build time**, so set it before `npm run build`.

## 12.2 Build & run

### Backend

```bash
cd backend
npm ci
npm run build          # tsc -> dist/
node dist/index.js     # or: npm start
```

Keep it alive with a process manager:

```bash
npm i -g pm2
pm2 start dist/index.js --name email-automation
pm2 save && pm2 startup
```

### Frontend

```bash
cd frontend
npm ci
npm run build          # -> dist/ (static files)
```

Serve `frontend/dist` from any static host (Nginx, Netlify, Vercel, Cloudflare
Pages, S3+CloudFront…).

## 12.3 The sender mailbox token cache (read this for PaaS)

The backend stores the sender's refresh token in
`backend/.mail-token-cache.json` + `.mail-account.json`. On hosts with an
**ephemeral filesystem** (Render free tier, Railway without a volume, most
containers), these files are **wiped on every redeploy**, so emailing stops
working until re-authorized.

Choose one:

- **Persistent disk/volume**: mount a volume and point
  `MS_TOKEN_CACHE_PATH` / `MS_MAIL_ACCOUNT_PATH` at a path on it.
- **Re-run `mail-setup`** after each deploy: visit
  `https://api.yourdomain.com/auth/microsoft/mail-setup` once (quick, but manual).
- A VPS/EC2 (Step 12.5) has a normal persistent disk, so nothing special needed.

## 12.4 HTTPS, domain & reverse proxy (Nginx on a VPS)

Point DNS:

- `yourdomain.com` → static frontend (or the same box)
- `api.yourdomain.com` → the backend box

Example Nginx for the API with TLS via Let's Encrypt:

```nginx
server {
  server_name api.yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo certbot --nginx -d api.yourdomain.com   # issues + auto-renews TLS
```

The app already calls `app.set('trust proxy', 1)` so client IPs log correctly
behind the proxy.

## 12.5 Platform notes

| Platform        | Frontend             | Backend                | Token cache              |
| --------------- | -------------------- | ---------------------- | ------------------------ |
| **VPS / EC2**   | Nginx static + certbot | pm2 + Nginx + certbot | persistent (disk) ✅      |
| **Render**      | Static Site          | Web Service            | add a **Disk**, or re-auth |
| **Railway**     | Static / Nginx       | Service                | add a **Volume**, or re-auth |
| **Vercel/Netlify** | great for frontend | not ideal (serverless)¹ | use a stateful host for API |

¹ Serverless functions can't keep the MSAL file cache warm and have short
timeouts; host the backend on a long-running service instead.

## 12.6 Post-deploy checklist

- [ ] Azure redirect URIs include the production `…/auth/microsoft/callback`
      **and** `…/auth/microsoft/mail-callback`.
- [ ] `GET https://api.yourdomain.com/health` returns `{"status":"ok"}`.
- [ ] Visited `…/auth/microsoft/mail-setup` once in production → "authorized".
- [ ] Google Sheet shared (Editor) with the service account email.
- [ ] Apps Script `setupConfig` points `BACKEND_URL` at
      `https://api.yourdomain.com/api/send-email` with the production `API_KEY`.
- [ ] Tick a checkbox → status goes `Processing → Done` and the email arrives.

✅ **Done.** Back to the [README](../README.md).
