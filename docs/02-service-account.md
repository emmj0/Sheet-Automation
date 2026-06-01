# Step 2 — Service Account (Google Sheets access)

The backend uses a **service account** (a robot Google identity) to read and
write the spreadsheet. This avoids any per-user consent for sheet access.

---

## 2.1 Create the service account

1. In the same project from [Step 1](01-google-cloud-setup.md), go to
   **APIs & Services → Credentials**.
2. **Create Credentials → Service account**.
3. **Service account name**: `sheets-writer` → **Create and continue**.
4. **Grant access**: you can skip the optional role assignment (the sheet is
   shared directly in 2.4) → **Continue → Done**.

## 2.2 Generate a JSON key

1. On the **Credentials** page, click your new service account.
2. **Keys** tab → **Add key → Create new key**.
3. Choose **JSON** → **Create**. A `*.json` file downloads.

## 2.3 Store the key

Rename the downloaded file to **`service-account.json`** and place it in the
`backend/` folder (next to `package.json`):

```
backend/service-account.json
```

It is already in `.gitignore`. **Never commit it.**

> Hosting on Railway/Render/etc. where you can't add files? Base64-encode it and
> set `SERVICE_ACCOUNT_KEY_BASE64` instead (see [Step 12 — Deployment](06-deployment.md)).
> On macOS/Linux: `base64 -w0 service-account.json`. On Windows PowerShell:
> `[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))`.

## 2.4 Share the Google Sheet with the service account

The service account has its own email address, e.g.
`sheets-writer@email-automation-123456.iam.gserviceaccount.com` — find it on the
Credentials page, or in the `client_email` field inside the JSON.

1. Open your Google Sheet (created in [Step 3](03-google-sheet.md)).
2. Click **Share**.
3. Paste the **service account email**.
4. Set role to **Editor** → untick "Notify people" → **Share**.

> If you skip this, every Sheets call fails with **403 / "The caller does not
> have permission"**. The backend prints the service account email on startup
> as a reminder.

## 2.5 Configure the backend

In `backend/.env`:

```env
GOOGLE_SHEET_ID=your-sheet-id          # from the sheet URL
GOOGLE_SHEET_NAME=Sheet1               # the TAB name
SERVICE_ACCOUNT_KEY_PATH=./service-account.json
```

✅ **Done.** Next: [Step 3 — Google Sheet Setup](03-google-sheet.md).
