# Step 4 — Google Apps Script Setup

Apps Script watches the checkbox column and calls your backend when an admin
ticks a box. The code lives in [`apps-script/Code.gs`](../apps-script/Code.gs).

---

## 4.1 Open the script editor

1. Open your **Email Automation** Google Sheet.
2. **Extensions → Apps Script**. A new tab opens with `Code.gs`.

## 4.2 Paste the code

1. Delete the placeholder `function myFunction() {}`.
2. Copy the entire contents of [`apps-script/Code.gs`](../apps-script/Code.gs)
   and paste it in.
3. If your tab is **not** named `Sheet1`, edit the `SHEET_NAME` constant at the
   top to match.
4. **Save** (💾).

## 4.3 Store the backend URL + API key (run `setupConfig` once)

Secrets are kept in **Script Properties**, not hard-coded.

1. In `Code.gs`, edit the two values inside `setupConfig()`:
   ```js
   BACKEND_URL: 'https://yourdomain.com/api/send-email',
   API_KEY:     'the-same-API_KEY-as-backend-.env',
   ```
   > For local testing the backend isn't reachable from Google's servers unless
   > you expose it publicly (e.g. with `ngrok http 4000` → use that HTTPS URL).
2. Select **`setupConfig`** in the function dropdown → **Run**.
3. Approve the authorization prompt (first run only).
4. Check the execution log shows `Config saved`. You can now blank out the two
   literal values again if you prefer (the saved properties remain).

## 4.4 Create the INSTALLABLE onEdit trigger

> ⚠️ The simple `onEdit(e)` trigger **cannot** make external web requests
> (`UrlFetchApp`). You must create an **installable** trigger bound to
> `onEditInstallable`.

1. In the Apps Script editor, click the **Triggers** icon (⏰, left sidebar) —
   or **Project Settings → Triggers**.
2. **+ Add Trigger** (bottom-right).
3. Configure:
   - **Choose which function to run**: `onEditInstallable`
   - **Choose which deployment should run**: `Head`
   - **Select event source**: `From spreadsheet`
   - **Select event type**: `On edit`
4. **Save**. Approve the OAuth prompt:
   - "This app isn't verified" → **Advanced → Go to (project) (unsafe)** →
     **Allow**. (It's your own script; this is expected.)

## 4.5 How it runs

When an admin checks a box in column A:

1. `onEditInstallable(e)` fires; it ignores edits outside column A / the header
   row, and only proceeds on **FALSE → TRUE**.
2. Reads the email from column B of that row.
3. Sets column C = **Processing**.
4. `POST`s to your backend:
   ```json
   { "email": "user@outlook.com", "rowNumber": 5 }
   ```
   with header `Authorization: Bearer <API_KEY>`.
5. On HTTP 2xx → column C = **Done**; otherwise **Failed**.

## 4.6 Test it

- **From the editor:** select any cell in a data row, then run
  `testSelectedRow` (sends to that row's email immediately).
- **End to end:** tick a checkbox in column A and watch column C go
  `Processing → Done`. Check **Executions** (left sidebar) for logs if it stays
  on `Failed`.

> Common failure causes: backend not publicly reachable, wrong `API_KEY`,
> `BACKEND_URL` missing `/api/send-email`, or the sender mailbox not yet
> authorized (see [Step 5](05-microsoft-setup.md)).

✅ **Done.** Next: [Step 5 — Microsoft Setup](05-microsoft-setup.md).
