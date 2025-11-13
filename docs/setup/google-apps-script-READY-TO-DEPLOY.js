/**
 * River City Roofing Solutions - Contact Form Handler
 * Google Apps Script for processing form submissions
 *
 * ✅ CUSTOMIZED FOR MICHAEL - READY TO DEPLOY!
 *
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Go to https://script.google.com
 * 2. Click "New project"
 * 3. Copy this ENTIRE file
 * 4. Paste into Code.gs (delete existing code first)
 * 5. Save (Ctrl+S)
 * 6. Deploy → New deployment → Web app
 *    - Execute as: Me (michaelmuse@rivercityroofingsolutions.com)
 *    - Who has access: Anyone
 * 7. Copy the deployment URL
 * 8. Add to .env.local (instructions below)
 *
 * Last updated: 2025-11-13
 */

// ========================================
// CONFIGURATION - ✅ ALREADY SET FOR YOU
// ========================================

// Your Google Sheet ID (already configured!)
const SHEET_ID = '1crBX4awO6Va5Fv2X7eN29mXvX3CKss16NxlRaf6jLe8';

// Email to receive notifications (already configured!)
const COMPANY_EMAIL = 'michaelmuse@rivercityroofingsolutions.com';

// Also notify office email
const OFFICE_EMAIL = 'office@rcrsal.com';

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
1. We'll review your request (usually within 1 hour during business hours)
2. We'll call you to schedule a convenient inspection time
3. Our professional inspector will visit your property
4. You'll receive a free, detailed roofing assessment

EMERGENCY ROOFING SERVICES
If you need immediate assistance, please call us at:
📞 (256) 274-8530 - Available 24/7 for emergencies

QUESTIONS?
Feel free to reach out anytime:
• Call: (256) 274-8530
• Email: office@rcrsal.com
• Visit: 3325 Central Pkwy SW, Decatur, AL 35603

We're looking forward to serving you!

Best regards,
The River City Roofing Solutions Team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
River City Roofing Solutions
Alabama's Trusted Roofing Experts Since [Year]

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
    const subject = `🔔 NEW LEAD: ${params.name} - ${params.subject}`;

    const body = `NEW INSPECTION REQUEST RECEIVED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Submitted: ${new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'full',
      timeStyle: 'short'
    })}

👤 CONTACT INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name:     ${params.name}
Email:    ${params.email}
Phone:    ${params.phone || 'Not provided'}

📋 REQUEST DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subject:            ${params.subject}
Preferred Inspector: ${params.preferredInspector || 'First Available'}

💬 MESSAGE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${params.message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ✅ Data automatically saved to Google Sheet
2. 📞 Call customer at: ${params.phone || params.email}
3. 📅 Schedule inspection with: ${params.preferredInspector || 'First Available'}
4. ✉️ Follow up within 24 hours for best conversion

🔗 QUICK ACTIONS:
• View Google Sheet: https://docs.google.com/spreadsheets/d/${SHEET_ID}
• Reply directly to customer: ${params.email}
${params.phone ? `• Call now: ${params.phone}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated notification from your website contact form.
River City Roofing Solutions - Lead Management System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // Send to Michael
    GmailApp.sendEmail(COMPANY_EMAIL, subject, body, {
      replyTo: params.email,
      name: 'River City Roofing - Lead System'
    });

    // Also send to office email
    GmailApp.sendEmail(OFFICE_EMAIL, subject, body, {
      replyTo: params.email,
      name: 'River City Roofing - Lead System'
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

/**
 * Test function to verify everything works
 * Run this from the script editor to test
 */
function testFormSubmission() {
  console.log('🧪 Testing form submission...');

  // Create test data
  const testEvent = {
    parameter: {
      name: 'Test Customer',
      email: 'michaelmuse@rivercityroofingsolutions.com', // Will send test to your email
      phone: '256-555-1234',
      subject: 'Test Inspection Request - DELETE THIS ROW',
      message: 'This is a test submission from Google Apps Script. If you see this in your Sheet and received emails, everything is working! You can delete this test row.',
      preferredInspector: 'First Available'
    }
  };

  // Run the form handler
  const result = doPost(testEvent);

  // Log result
  const resultContent = result.getContent();
  console.log('✅ Test result:', resultContent);

  // Instructions
  console.log('');
  console.log('📧 CHECK YOUR EMAIL:');
  console.log('   1. michaelmuse@rivercityroofingsolutions.com - Should have 2 emails (confirmation + notification)');
  console.log('   2. office@rcrsal.com - Should have notification');
  console.log('');
  console.log('📊 CHECK YOUR GOOGLE SHEET:');
  console.log('   Open: https://docs.google.com/spreadsheets/d/' + SHEET_ID);
  console.log('   Look for new row with test data');
  console.log('');
  console.log('✅ If you got emails and see sheet row - IT WORKS!');
  console.log('❌ If not, check the Executions tab for errors');
  console.log('');
  console.log('🚀 NEXT STEP: Deploy as web app!');
}

/**
 * Gets the current deployment URL
 * Run this after deploying to see your endpoint
 */
function getDeploymentInfo() {
  const scriptId = ScriptApp.getScriptId();
  console.log('');
  console.log('📋 DEPLOYMENT INFORMATION:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Script ID:', scriptId);
  console.log('');
  console.log('After deploying as web app, your URL will look like:');
  console.log('https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec');
  console.log('');
  console.log('Add this URL to your .env.local file:');
  console.log('NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT=YOUR_URL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('✅ Sheet ID configured: ' + SHEET_ID);
  console.log('✅ Company email: ' + COMPANY_EMAIL);
  console.log('✅ Office email: ' + OFFICE_EMAIL);
  console.log('✅ Ready to deploy!');
}

/**
 * Initializes the Google Sheet with proper headers
 * Run this once if your sheet doesn't have headers
 */
function initializeSheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
      console.log('✅ Created new sheet: ' + SHEET_NAME);
    }

    // Check if headers exist
    const firstRow = sheet.getRange(1, 1, 1, 7).getValues()[0];
    const hasHeaders = firstRow[0] && firstRow[0].toString().length > 0;

    if (!hasHeaders) {
      // Add headers
      const headers = ['Timestamp', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Preferred Inspector'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Format headers
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#4285F4')
        .setFontColor('#FFFFFF');

      // Freeze header row
      sheet.setFrozenRows(1);

      // Auto-resize columns
      for (let i = 1; i <= headers.length; i++) {
        sheet.autoResizeColumn(i);
      }

      console.log('✅ Headers added and formatted');
    } else {
      console.log('ℹ️ Headers already exist');
    }

    console.log('✅ Sheet initialization complete!');
    console.log('📊 View your sheet: https://docs.google.com/spreadsheets/d/' + SHEET_ID);

  } catch (error) {
    console.error('❌ Error initializing sheet:', error);
    console.log('');
    console.log('Make sure:');
    console.log('1. The Sheet ID is correct');
    console.log('2. You have edit access to the sheet');
    console.log('3. The sheet exists and is accessible');
  }
}
