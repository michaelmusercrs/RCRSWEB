/**
 * RCRS Stock Inbox -> Material Order Webhook Forwarder
 * ===================================================
 *
 * Runs inside the stock@rcrsal.com Gmail account. Every minute, scans the
 * inbox for Material Order emails and POSTs them to the RCRS webhook so
 * each one becomes a ticket in the Tickets sheet.
 *
 * SETUP (one time):
 *   1. Open https://script.google.com under stock@rcrsal.com
 *   2. Paste this file as Code.gs
 *   3. Project Settings (gear) -> Script Properties:
 *        WEBHOOK_URL    = https://rcrsal.com/api/webhooks/material-order-email
 *        WEBHOOK_SECRET = (value of MATERIAL_ORDER_WEBHOOK_SECRET in Vercel)
 *   4. Triggers (clock) -> Add Trigger:
 *        Function: forwardNewMaterialOrders
 *        Event: Time-driven, Minutes timer, every minute
 *   5. Authorize the script when prompted
 */

const FORWARDED_LABEL_NAME = 'RCRS-Forwarded';
const ERROR_LABEL_NAME = 'RCRS-Error';
const Q = String.fromCharCode(34);
// Subjects look like "R10997 RCRS Stock - Greg is salesman..." or
// "R10923 RCRS stock Corrected - ...". Match the RCRS Stock phrase and
// require a Material Order PDF attachment (has:attachment) so test/junk
// threads don't get picked up. No time window — idempotency comes from
// the label exclusion alone, so the initial run picks up the historical
// backlog and subsequent runs only see new arrivals.
const SEARCH_QUERY = 'subject:' + Q + 'RCRS Stock' + Q + ' has:attachment -label:RCRS-Forwarded -label:RCRS-Error';
const MAX_THREADS_PER_RUN = 25;

function forwardNewMaterialOrders() {
  const props = PropertiesService.getScriptProperties();
  const webhookUrl = props.getProperty('WEBHOOK_URL');
  const webhookSecret = props.getProperty('WEBHOOK_SECRET');

  if (!webhookUrl || !webhookSecret) {
    throw new Error('Script Properties WEBHOOK_URL and WEBHOOK_SECRET must be set.');
  }

  const forwardedLabel = getOrCreateLabel(FORWARDED_LABEL_NAME);
  const errorLabel = getOrCreateLabel(ERROR_LABEL_NAME);

  const threads = GmailApp.search(SEARCH_QUERY, 0, MAX_THREADS_PER_RUN);
  Logger.log('Found ' + threads.length + ' material order threads to forward');

  let forwarded = 0;
  let errored = 0;

  for (const thread of threads) {
    const messages = thread.getMessages();
    let threadHadError = false;

    for (const msg of messages) {
      try {
        const result = forwardMessage(msg, webhookUrl, webhookSecret);
        if (result.ok) {
          forwarded++;
        } else {
          errored++;
          threadHadError = true;
          Logger.log('Webhook error for ' + msg.getSubject() + ': ' + result.error);
        }
      } catch (err) {
        errored++;
        threadHadError = true;
        Logger.log('Exception forwarding ' + msg.getSubject() + ': ' + err);
      }
    }

    if (threadHadError) {
      thread.addLabel(errorLabel);
    } else {
      thread.addLabel(forwardedLabel);
      thread.markRead();
    }
  }

  Logger.log('Done. Forwarded: ' + forwarded + ', Errors: ' + errored);
  return { forwarded: forwarded, errored: errored, total: threads.length };
}

function forwardMessage(msg, webhookUrl, webhookSecret) {
  // JobNimbus emails have a sparse body — all the order data lives in the
  // attached PDF. Extract the PDF text via Drive's Doc conversion and prefer
  // that over the email body. Falls back to the email body if no PDF.
  let body = '';
  const attachments = msg.getAttachments();
  for (const att of attachments) {
    if (att.getContentType() === 'application/pdf') {
      try {
        body = extractPdfText(att);
        Logger.log('Extracted ' + body.length + ' chars from PDF: ' + att.getName());
        break;
      } catch (err) {
        Logger.log('PDF extract failed for ' + att.getName() + ': ' + err);
      }
    }
  }
  if (!body) {
    body = msg.getPlainBody() || msg.getBody();
  }

  const payload = {
    subject: msg.getSubject(),
    from: msg.getFrom(),
    receivedAt: msg.getDate().toISOString(),
    body: body,
    attachments: attachments.map(function (att) {
      return {
        name: att.getName(),
        contentType: att.getContentType(),
        size: att.getSize(),
      };
    }),
  };

  const response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Webhook-Secret': webhookSecret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    followRedirects: true,
  });

  const code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    return { ok: true };
  }
  return {
    ok: false,
    error: 'HTTP ' + code + ': ' + response.getContentText().substring(0, 500),
  };
}

function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

// Extract text from a PDF by uploading to Drive as a Google Doc, walking
// the body in document order, and serializing TABLE cells with tab
// separators so the parser can see the materials table as
// "<item> <unit> <qty> <cost>" rows. Plain getText() flattens columns
// and the parser can't recover the layout from that.
function extractPdfText(pdfAttachment) {
  const blob = pdfAttachment.copyBlob();
  const file = Drive.Files.create(
    { name: 'rcrs-mo-temp-' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
    blob
  );
  let text = '';
  try {
    text = serializeDocBody(DocumentApp.openById(file.id).getBody());
  } finally {
    DriveApp.getFileById(file.id).setTrashed(true);
  }
  return text;
}

// Walk body elements in order. Paragraphs become single lines; tables
// become one row per line with cell text joined by 2 spaces (matches the
// parser's split-on-double-space heuristic).
function serializeDocBody(body) {
  const lines = [];
  const n = body.getNumChildren();
  for (let i = 0; i < n; i++) {
    const child = body.getChild(i);
    const type = child.getType();
    if (type === DocumentApp.ElementType.PARAGRAPH) {
      const t = child.asParagraph().getText();
      if (t && t.trim()) lines.push(t);
    } else if (type === DocumentApp.ElementType.TABLE) {
      const tbl = child.asTable();
      const rows = tbl.getNumRows();
      for (let r = 0; r < rows; r++) {
        const row = tbl.getRow(r);
        const cells = [];
        const numCells = row.getNumCells();
        for (let c = 0; c < numCells; c++) {
          cells.push(row.getCell(c).getText().trim());
        }
        // Join with 2+ spaces so split(/\s{2,}|\t/) sees them as separate
        // columns. Also include a tab between key columns to be safe.
        lines.push(cells.join('\t'));
      }
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      const t = child.asListItem().getText();
      if (t && t.trim()) lines.push(t);
    }
  }
  return lines.join('\n');
}

function testWebhookOnLatestMaterialOrder() {
  const props = PropertiesService.getScriptProperties();
  const webhookUrl = props.getProperty('WEBHOOK_URL');
  const webhookSecret = props.getProperty('WEBHOOK_SECRET');

  const testQuery = 'subject:' + Q + 'RCRS Stock' + Q + ' has:attachment newer_than:30d';
  const threads = GmailApp.search(testQuery, 0, 1);
  if (threads.length === 0) {
    Logger.log('No material order threads found in the last 30 days');
    return;
  }
  const msg = threads[0].getMessages()[0];
  Logger.log('Testing with: ' + msg.getSubject());
  const result = forwardMessage(msg, webhookUrl, webhookSecret);
  Logger.log('Result: ' + JSON.stringify(result));
}

// Remove only the RCRS-Error label so the next forwardNewMaterialOrders
// run retries previously-errored threads (without re-processing the
// successful ones that have RCRS-Forwarded).
function retryErroredThreads() {
  const errorLabel = GmailApp.getUserLabelByName(ERROR_LABEL_NAME);
  if (!errorLabel) {
    Logger.log('No RCRS-Error label exists — nothing to retry.');
    return;
  }
  const threads = errorLabel.getThreads(0, 100);
  Logger.log('Clearing RCRS-Error from ' + threads.length + ' threads');
  for (const thread of threads) {
    thread.removeLabel(errorLabel);
  }
  Logger.log('Done. Re-run forwardNewMaterialOrders to retry them.');
}

function resetAllLabels() {
  const forwarded = getOrCreateLabel(FORWARDED_LABEL_NAME);
  const errored = getOrCreateLabel(ERROR_LABEL_NAME);
  forwarded.deleteLabel();
  errored.deleteLabel();
  Logger.log('Labels deleted. Next run will re-process all material order threads.');
}

function debugProperties() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const keys = Object.keys(props);
  Logger.log('All property keys: ' + JSON.stringify(keys));
  Logger.log('WEBHOOK_URL = ' + JSON.stringify(props['WEBHOOK_URL']));
  Logger.log('WEBHOOK_SECRET = ' + JSON.stringify(props['WEBHOOK_SECRET']));
}
