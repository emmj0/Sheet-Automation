/**
 * Email Automation — Google Apps Script
 * ──────────────────────────────────────────────────────────────────────────
 * Watches column A ("Send Email") checkboxes. When an admin checks a box
 * (FALSE → TRUE), this script:
 *   1. Reads the email from column B of the same row.
 *   2. Writes "Processing" to column C.
 *   3. POSTs { email, rowNumber } to the backend with a Bearer API key.
 *   4. Writes "Done" or "Failed" to column C based on the response.
 *
 * IMPORTANT: onEdit must run as an INSTALLABLE trigger, not the simple
 * onEdit(e) trigger. Simple triggers cannot call external URLs (UrlFetchApp).
 * See docs/04-apps-script.md for the one-time trigger setup, and run
 * `setupConfig()` once to store your secrets in Script Properties.
 */

/* ── Configuration ────────────────────────────────────────────────────── */

// Sheet/column layout. Adjust SHEET_NAME if your tab isn't "Sheet1".
const SHEET_NAME = 'Sheet1';
const COL_SEND_EMAIL = 1; // A
const COL_EMAIL = 2; // B
const COL_STATUS = 3; // C
const HEADER_ROWS = 1; // row 1 is the header

/**
 * Run ONCE from the Apps Script editor to store secrets securely in Script
 * Properties (so they aren't hard-coded in the file). Edit the two values
 * below, run setupConfig, then delete the values again if you like.
 */
function setupConfig() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    BACKEND_URL: 'https://yourdomain.com/api/send-email',
    API_KEY: 'paste-the-same-API_KEY-as-the-backend-.env',
  });
  Logger.log('Config saved. Stored keys: ' + props.getKeys().join(', '));
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const backendUrl = props.getProperty('BACKEND_URL');
  const apiKey = props.getProperty('API_KEY');
  if (!backendUrl || !apiKey) {
    throw new Error(
      'Missing config. Run setupConfig() once to set BACKEND_URL and API_KEY.'
    );
  }
  return { backendUrl: backendUrl, apiKey: apiKey };
}

/* ── Trigger handler ──────────────────────────────────────────────────── */

/**
 * Installable onEdit handler. Bind this function to an "On edit" trigger
 * via Triggers ▸ Add Trigger (see docs/04-apps-script.md).
 */
function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;

    const sheet = e.range.getSheet();
    if (sheet.getName() !== SHEET_NAME) return;

    // Only react to single-cell edits in the checkbox column, below the header.
    const row = e.range.getRow();
    const col = e.range.getColumn();
    if (col !== COL_SEND_EMAIL) return;
    if (row <= HEADER_ROWS) return;

    // Only react on FALSE → TRUE. e.value is "TRUE"/"FALSE" for checkboxes.
    const becameChecked =
      e.value === true || String(e.value).toUpperCase() === 'TRUE';
    if (!becameChecked) return;

    processRow_(sheet, row);
  } catch (err) {
    Logger.log('onEditInstallable error: ' + err);
  }
}

/* ── Core logic ───────────────────────────────────────────────────────── */

function processRow_(sheet, row) {
  const email = String(sheet.getRange(row, COL_EMAIL).getValue()).trim();
  const statusCell = sheet.getRange(row, COL_STATUS);

  if (!email) {
    statusCell.setValue('Failed');
    Logger.log('Row ' + row + ': no email address found.');
    return;
  }

  // Mark Processing immediately so the admin sees progress.
  statusCell.setValue('Processing');
  SpreadsheetApp.flush();

  const result = callBackend_(email, row);

  if (result.ok) {
    statusCell.setValue('Done');
    Logger.log('Row ' + row + ': email sent to ' + email);
  } else {
    statusCell.setValue('Failed');
    Logger.log('Row ' + row + ': FAILED for ' + email + ' — ' + result.error);
  }
}

function callBackend_(email, rowNumber) {
  var cfg;
  try {
    cfg = getConfig_();
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + cfg.apiKey },
    payload: JSON.stringify({ email: email, rowNumber: rowNumber }),
    muteHttpExceptions: true, // we inspect the status code ourselves
  };

  try {
    const response = UrlFetchApp.fetch(cfg.backendUrl, options);
    const status = response.getResponseCode();
    const body = response.getContentText();

    if (status >= 200 && status < 300) {
      return { ok: true };
    }
    return { ok: false, error: 'HTTP ' + status + ': ' + body };
  } catch (err) {
    // Network error / timeout.
    return { ok: false, error: String(err) };
  }
}

/* ── Optional helpers ─────────────────────────────────────────────────── */

/**
 * Manual test: send to whatever row is currently selected.
 * Select any cell in the target row, then run this from the editor.
 */
function testSelectedRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveRange().getRow();
  processRow_(sheet, row);
}
