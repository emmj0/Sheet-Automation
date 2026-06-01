# Step 1 — Google Cloud Project (for Google Sheets)

> **Login & email now use Microsoft**, not Google — see
> [Step 5 — Microsoft Setup](05-microsoft-setup.md). Google Cloud is still
> needed for **one** thing: the **service account** that lets the backend
> read/write the Google Sheet.

This step just creates the project and enables the APIs. The service account
itself is created in [Step 2](02-service-account.md).

---

## 1.1 Create a Google Cloud Project

1. Go to <https://console.cloud.google.com/>.
2. Click the project dropdown (top bar) → **New Project**.
3. Name it `Email Automation` → **Create**.
4. Make sure the new project is selected in the top bar before continuing.

## 1.2 Enable the required APIs

Go to **APIs & Services → Library** and enable each of these (search, click, **Enable**):

- **Google Sheets API** — read/write the spreadsheet.
- **Google Drive API** — required for the Sheets API to resolve the file by ID.

> You do **not** need to configure the OAuth consent screen or an OAuth client
> here anymore — end-user login is handled by Microsoft. The service account
> (Step 2) authenticates without any consent screen.

✅ **Done.** Next: [Step 2 — Service Account](02-service-account.md).
