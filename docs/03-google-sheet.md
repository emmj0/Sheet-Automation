# Step 3 — Google Sheet Setup

Create the spreadsheet the system reads and writes.

---

## 3.1 Create the sheet

1. Go to <https://sheets.google.com> → **Blank spreadsheet**.
2. Rename the file (top-left) to **`Email Automation`**.
3. Note the **tab name** at the bottom — a new sheet's tab is **`Sheet1`**.
   This is the value for `GOOGLE_SHEET_NAME` (it is the TAB name, not the file
   name).

## 3.2 Add the header row

In **row 1**, add these three column headers:

| A          | B             | C      |
| ---------- | ------------- | ------ |
| Send Email | Email Address | Status |

## 3.3 Make column A a checkbox

1. Select column **A** from **A2 downward** (click the `A` header, then
   Shift-click to exclude the header if you like — selecting the whole column is
   fine).
2. **Insert → Checkbox**.

Checkboxes store **TRUE / FALSE**. The backend writes `FALSE` when a new user
registers; the admin ticks the box to send.

## 3.4 (Optional) Status dropdown

To keep the Status column tidy you can add a dropdown:

1. Select column **C** (from C2 down).
2. **Data → Data validation → Add rule**.
3. **Criteria**: *Dropdown* with items: `Pending`, `Processing`, `Done`, `Failed`.
4. **Done**.

This is optional — the script writes these values regardless.

## 3.5 Example data

| Send Email | Email Address     | Status  |
| ---------- | ----------------- | ------- |
| ☐ (FALSE)  | john@outlook.com  | Pending |
| ☐ (FALSE)  | sara@hotmail.com  | Pending |

## 3.6 Get the Sheet ID

The ID is the long token in the URL:

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjK...XYZ/edit#gid=0
                                        └──────── this ────────┘
```

Put it in `backend/.env` as `GOOGLE_SHEET_ID`, and remember to **share the sheet
with the service account** (see [Step 2.4](02-service-account.md)).

✅ **Done.** Next: [Step 4 — Apps Script](04-apps-script.md).
