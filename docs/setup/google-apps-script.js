/**
 * River City Roofing Solutions - Contact Form Handler
 * Google Apps Script for processing form submissions
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to script.google.com
 * 2. Click "New project"
 * 3. Copy this entire file into Code.gs
 * 4. Update SHEET_ID below with your Google Sheet ID
 * 5. Save and deploy as web app
 *
 * Last updated: 2025-11-13
 */

// ========================================
// CONFIGURATION - UPDATE THESE VALUES
// ========================================

// Your Google Sheet ID (get from Sheet URL)
// Format: https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
const SHEET_ID = 'YOUR_SHEET_ID_HERE';

// Company email to receive notifications
const COMPANY_EMAIL = 'office@rcrsal.com';

// Sheet name where data will be stored
const SHEET_NAME = 'Responses';

// ========================================
// MAIN FUNCTION - DO NOT MODIFY
// ========================================

/**
 * Handles POST requests from the contact form
 * This is triggered when the form is submitted
 */
function doPost(e) {
  try {
    // Parse incoming form data
    const params = e.parameter;

    // Log for debugging (viewable in Executions tab)
    console.log('Form submission received:', params);

    // Validate required fields
    if (!params.name || !params.email || !params.subject || !params.message) {
      return createErrorResponse('Missing required fields');
    }

    // Save to Google Sheet
    const saveResult = saveToSheet(params);
    if (!saveResult.success) {
      console.error('Failed to save to sheet:', saveResult.error);
      // Continue anyway - don't fail if sheet save fails
    }

    // Send confirmation email to user
    const userEmailResult = sendUserConfirmation(params);
    if (!userEmailResult.success) {
      console.error('Failed to send user email:', userEmailResult.error);
      // Continue anyway
    }

    // Send notification email to company
    const companyEmailResult = sendCompanyNotification(params);
    if (!companyEmailResult.success) {
      console.error('Failed to send company email:', companyEmailResult.error);
      // Continue anyway
    }

    // Return success response
    return createSuccessResponse({
      message: 'Form submitted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in doPost:', error);
    return createErrorResponse('An unexpected error occurred: ' + error.message);
  }
}

// ========================================
// GOOGLE SHEET FUNCTIONS
// ========================================

/**
 * Saves form data to Google Sheet
 */
function saveToSheet(params) {
  try {
    // Open the Google Sheet
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error('Sheet "' + SHEET_NAME + '" not found. Please create it.');
    }

    // Prepare row data
    const rowData = [
      new Date(),                                    // Timestamp
      params.name || '',                             // Name
      params.email || '',                            // Email
      params.phone || '',                            // Phone
      params.subject || '',                          // Subject
      params.message || '',                          // Message
      params.preferredInspector || 'First Available' // Inspector preference
    ];

    // Append row to sheet
    sheet.appendRow(rowData);

    return { success: true };

  } catch (error) {
    console.error('Error saving to sheet:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// EMAIL FUNCTIONS
// ========================================

/**
 * Sends confirmation email to the user
 */
function sendUserConfirmation(params) {
  try {
    const subject = 'Inspection Request Received - River City Roofing Solutions';

    const body = `Hi ${params.name},

Thank you for requesting a free roofing inspection from River City Roofing Solutions!

We've received your request and will contact you shortly at ${params.phone || params.email} to schedule your inspection.

YOUR REQUEST DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${params.name}
Email: ${params.email}
Phone: ${params.phone || 'Not provided'}
Subject: ${params.subject}
Preferred Inspector: ${params.preferredInspector || 'First Available'}

Message:
${params.message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT HAPPENS NEXT?
1. We'll review your request (usually within 1 hour)
2. We'll call you to schedule a convenient time
3. Our inspector will visit your property
4. You'll receive a free, no-obligation quote

QUESTIONS?
Feel free to call us anytime at (256) 274-8530 for immediate assistance.

Best regards,
River City Roofing Solutions Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
River City Roofing Solutions
3325 Central Pkwy SW
Decatur, AL 35603
Phone: (256) 274-8530
Email: office@rcrsal.com
Web: rivercityroofingsolutions.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // Send email
    GmailApp.sendEmail(params.email, subject, body);

    return { success: true };

  } catch (error) {
    console.error('Error sending user email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sends notification email to company
 */
function sendCompanyNotification(params) {
  try {
    const subject = `🔔 New Inspection Request from ${params.name}`;

    const body = `NEW INSPECTION REQUEST RECEIVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}

CONTACT INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:     ${params.name}
Email:    ${params.email}
Phone:    ${params.phone || 'Not provided'}

REQUEST DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subject:            ${params.subject}
Preferred Inspector: ${params.preferredInspector || 'First Available'}

MESSAGE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${params.message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:
• Call customer at: ${params.phone || params.email}
• Confirm inspection time
• Assign to inspector: ${params.preferredInspector || 'First Available'}

This data has been automatically saved to your Google Sheet.

---
This is an automated notification from your website contact form.
To view all submissions, open your Google Sheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

    // Send email
    GmailApp.sendEmail(COMPANY_EMAIL, subject, body, {
      replyTo: params.email
    });

    return { success: true };

  } catch (error) {
    console.error('Error sending company email:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// RESPONSE HELPERS
// ========================================

/**
 * Creates a success JSON response
 */
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({
      result: 'success',
      ...data
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Creates an error JSON response
 */
function createErrorResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({
      result: 'error',
      message: message
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// TESTING FUNCTION (OPTIONAL)
// ========================================

// Test function removed - test via the website contact form
// After deploying, submit a test through the live website

/**
 * Gets the current deployment URL
 * Run this to see your web app URL
 */
function getDeploymentInfo() {
  const scriptId = ScriptApp.getScriptId();
  console.log('Script ID:', scriptId);
  console.log('After deploying, your URL will be:');
  console.log('https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec');
}
