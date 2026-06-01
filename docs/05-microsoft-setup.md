# Step 5 — Microsoft Setup (Login + Outlook Email)

This single Azure app registration powers **both**:

1. **End-user login** — "Continue with Microsoft" → we read the user's email.
2. **Sending email** — via **Microsoft Graph** `/me/sendMail` (OAuth2).

> **Why not SMTP?** Microsoft disabled SMTP **basic-auth and app passwords** for
> personal **outlook.com / hotmail / live** accounts (Sept 2024). The supported
> way to send programmatically is OAuth2 — which is exactly what Graph uses.

---

## 5.1 Register the Azure application

1. Go to the **Microsoft Entra admin center**:
   <https://entra.microsoft.com> → **Identity → Applications → App registrations**
   (or the Azure portal → **Azure Active Directory → App registrations**).
   *(Any free personal Microsoft account can create one app registration.)*
2. **+ New registration**.
   - **Name**: `Email Automation`
   - **Supported account types**:
     **"Accounts in any organizational directory and personal Microsoft accounts"**
     (this matches `MS_TENANT=common`). For personal-only, pick
     "Personal Microsoft accounts only" and set `MS_TENANT=consumers`.
   - **Redirect URI**: platform **Web**, value:
     `http://localhost:4000/auth/microsoft/callback`
   - **Register**.
3. Copy the **Application (client) ID** → this is `MS_CLIENT_ID`.

## 5.2 Add the second redirect URI

The sender-mailbox authorization uses a different callback.

1. Open the app → **Authentication**.
2. Under **Web → Redirect URIs**, click **Add URI** and add:
   - `http://localhost:4000/auth/microsoft/mail-callback`
3. For production, also add the HTTPS equivalents:
   - `https://yourdomain.com/auth/microsoft/callback`
   - `https://yourdomain.com/auth/microsoft/mail-callback`
4. **Save**.

## 5.3 Create a client secret

1. App → **Certificates & secrets → + New client secret**.
2. Description `backend`, expiry e.g. 24 months → **Add**.
3. **Copy the secret VALUE immediately** (not the Secret ID) → this is
   `MS_CLIENT_SECRET`. You cannot see it again after leaving the page.

## 5.4 Add API permissions

1. App → **API permissions → + Add a permission → Microsoft Graph →
   Delegated permissions**.
2. Add these delegated permissions:
   - `User.Read`   — read the signed-in user's profile (login).
   - `Mail.Send`   — send mail as the signed-in user (the sender mailbox).
   - `offline_access` — issue refresh tokens (so the backend can send later).
   - `openid`, `profile`, `email` — usually present by default.
3. **Add permissions**.
   > For personal accounts you do **not** need an admin to grant consent — the
   > user consents during sign-in. (For a work/school tenant, an admin may need
   > to click **Grant admin consent**.)

## 5.5 Fill in the backend `.env`

```env
MS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MS_CLIENT_SECRET=the-secret-VALUE-you-copied
MS_TENANT=common
MS_LOGIN_REDIRECT_URI=http://localhost:4000/auth/microsoft/callback
MS_MAIL_REDIRECT_URI=http://localhost:4000/auth/microsoft/mail-callback
MAIL_SENDER=youraddress@outlook.com
```

## 5.6 Authorize the SENDER mailbox (ONE TIME)

This is what lets the backend send email autonomously later (when Apps Script
triggers it). You sign in **once** as the account that will send.

1. Start the backend (`npm run dev` in `backend/`).
2. In a browser, visit:
   ```
   http://localhost:4000/auth/microsoft/mail-setup
   ```
3. Sign in with the **sender outlook.com account** (`MAIL_SENDER`) and click
   **Accept** on the consent screen (it asks for "Send mail as you" + "Maintain
   access to data you have given it access to").
4. You'll see **"✅ Sender mailbox authorized"**. The backend has now saved a
   refresh token to `backend/.mail-token-cache.json` and the account id to
   `backend/.mail-account.json` (both git-ignored).

From now on the backend acquires fresh access tokens silently — no further
sign-in needed unless those files are deleted or the refresh token is revoked.

> **End users** signing in via "Continue with Microsoft" only grant `User.Read`
> — they never grant `Mail.Send`. Only the sender mailbox grants sending rights,
> via the `mail-setup` flow above.

## 5.7 Verify

- On startup the backend logs `Outlook (Microsoft Graph) mail transport ready`
  once the sender is authorized. If not, it logs a reminder pointing at the
  `mail-setup` URL.
- Quick manual send test (replace the placeholders):
  ```bash
  curl -X POST http://localhost:4000/api/send-email \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"you@example.com\",\"rowNumber\":2}"
  ```
  Expect `{"success":true,...}` and an email in the recipient's inbox.

✅ **Done.** Next: [Step 12 — Deployment](06-deployment.md).
