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
// threads don't get picked up.
const SEARCH_QUERY = 'subject:' + Q + 'RCRS Stock' + Q + ' has:attachment -label:RCRS-Forwarded -label:RCRS-Error';
const MAX_THREADS_PER_RUN = 10;

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

// Extract text from a PDF blob by uploading it to Drive as a Google Doc
// (which auto-converts text-searchable PDFs to selectable text), reading
// the doc, then trashing the temp Doc. Requires the Drive advanced
// service to be enabled (Services + -> Drive API -> Add). Uses Drive v3
// — Drive.Files.create with target mimeType = google-apps.document
// triggers PDF -> Doc conversion server-side.
function extractPdfText(pdfAttachment) {
  const blob = pdfAttachment.copyBlob();
  const file = Drive.Files.create(
    { name: 'rcrs-mo-temp-' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
    blob
  );
  let text = '';
  try {
    text = DocumentApp.openById(file.id).getBody().getText();
  } finally {
    DriveApp.getFileById(file.id).setTrashed(true);
  }
  return text;
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
