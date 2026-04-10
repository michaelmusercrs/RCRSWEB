/**
 * RCRS Stock Inbox → Material Order Webhook Forwarder
 * ===================================================
 *
 * This Google Apps Script runs inside the stock@rcrsal.com Gmail account.
 * Every minute (or whenever a new email arrives), it scans the inbox for
 * Material Order emails, extracts the body, and POSTs them to the RCRS
 * portal's webhook so each one becomes a ticket in the Tickets sheet.
 *
 * SETUP (one time):
 * -----------------
 * 1. Sign in to stock@rcrsal.com
 * 2. Open https://script.google.com → New project
 * 3. Paste this entire file as Code.gs
 * 4. Click Project Settings (gear icon) → "Script Properties" → Add property:
 *      Property: WEBHOOK_SECRET
 *      Value:    <same value as MATERIAL_ORDER_WEBHOOK_SECRET in Vercel>
 * 5. Add another property:
 *      Property: WEBHOOK_URL
 *      Value:    https://rcrsal.com/api/webhooks/material-order-email
 * 6. Click Save
 * 7. Triggers (clock icon) → Add Trigger:
 *      - Function: forwardNewMaterialOrders
 *      - Event source: Time-driven
 *      - Type: Minutes timer
 *      - Interval: Every minute
 * 8. Authorize the script when prompted (one-time Google OAuth flow)
 *
 * After setup, every new email matching the search query becomes a ticket
 * within ~60 seconds of arrival.
 *
 * SAFETY:
 * - Each processed email gets the label "RCRS-Forwarded" so it never gets
 *   forwarded twice, even if the trigger overlaps itself.
 * - If the webhook returns an error, the email is labeled "RCRS-Error" and
 *   left unread for human review.
 * - Errors are logged to View → Executions in the Apps Script editor.
 */

// ─── Configuration ─────────────────────────────────────────────────────
//
// All sensitive values come from Script Properties so this file can live
// in source control without leaking secrets.

const FORWARDED_LABEL_NAME = 'RCRS-Forwarded';
const ERROR_LABEL_NAME = 'RCRS-Error';

// Gmail search query — anything matching this and not already labeled gets
// processed. Adjust if your senders use a different subject pattern.
const SEARCH_QUERY = 'subject:"Material Order" -label:RCRS-Forwarded -label:RCRS-Error newer_than:7d';

// Maximum threads to process per run. Keep this small so a single execution
// always finishes inside the 6-minute Apps Script time limit.
const MAX_THREADS_PER_RUN = 10;

// ─── Main entry point — call this from the time trigger ───────────────

function forwardNewMaterialOrders() {
  const props = PropertiesService.getScriptProperties();
  const webhookUrl = props.getProperty('WEBHOOK_URL');
  const webhookSecret = props.getProperty('WEBHOOK_SECRET');

  if (!webhookUrl || !webhookSecret) {
    throw new Error(
      'Script Properties WEBHOOK_URL and WEBHOOK_SECRET must be set. ' +
      'See setup instructions in the script header.'
    );
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
          Logger.log('Webhook error for "' + msg.getSubject() + '": ' + result.error);
        }
      } catch (err) {
        errored++;
        threadHadError = true;
        Logger.log('Exception forwarding "' + msg.getSubject() + '": ' + err);
      }
    }

    // Label the entire thread once. Apps Script labels are per-thread, not
    // per-message, so we apply after iterating all messages.
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

// ─── Forward a single Gmail message to the webhook ────────────────────

function forwardMessage(msg, webhookUrl, webhookSecret) {
  const body = msg.getPlainBody() || msg.getBody();

  const payload = {
    subject: msg.getSubject(),
    from: msg.getFrom(),
    receivedAt: msg.getDate().toISOString(),
    body: body,
    attachments: msg.getAttachments().map(function (att) {
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
    headers: {
      'X-Webhook-Secret': webhookSecret,
    },
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

// ─── Helpers ──────────────────────────────────────────────────────────

function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) {
    label = GmailApp.createLabel(name);
  }
  return label;
}

// ─── Manual test helpers (run from the Apps Script editor) ────────────

/**
 * Run this once after setup to verify everything works. It looks for ONE
 * recent material order, forwards it, then prints the result. Does NOT
 * label the thread, so you can re-test as many times as needed.
 */
function testWebhookOnLatestMaterialOrder() {
  const props = PropertiesService.getScriptProperties();
  const webhookUrl = props.getProperty('WEBHOOK_URL');
  const webhookSecret = props.getProperty('WEBHOOK_SECRET');

  const threads = GmailApp.search('subject:"Material Order" newer_than:30d', 0, 1);
  if (threads.length === 0) {
    Logger.log('No material order threads found in the last 30 days');
    return;
  }
  const msg = threads[0].getMessages()[0];
  Logger.log('Testing with: ' + msg.getSubject());
  const result = forwardMessage(msg, webhookUrl, webhookSecret);
  Logger.log('Result: ' + JSON.stringify(result));
}

/**
 * Strip both labels so the next scheduled run will re-process everything.
 * Use this if you change the parser and want to re-import existing emails.
 */
function resetAllLabels() {
  const forwarded = getOrCreateLabel(FORWARDED_LABEL_NAME);
  const errored = getOrCreateLabel(ERROR_LABEL_NAME);
  forwarded.deleteLabel();
  errored.deleteLabel();
  Logger.log('Labels deleted. Next run will re-process all material order threads.');
}
