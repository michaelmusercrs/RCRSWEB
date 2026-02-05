# Google Apps Script Setup for Contact Form

Follow these steps to set up the contact form backend:

## Step 1: Create a New Google Apps Script

1. Go to [Google Apps Script](https://script.google.com/)
2. Click **New Project**
3. Name it "River City Roofing Contact Form"

## Step 2: Copy This Code

Delete everything in the editor and paste this code:

```javascript
// Configuration
const NOTIFICATION_EMAIL = "rcs@rivercityroofingsolutions.com";
const SPREADSHEET_ID = "1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s"; // Your existing sheet
const CONTACT_SHEET_NAME = "Contact Submissions";
const REFERRAL_SHEET_NAME = "Referral Submissions";

function doPost(e) {
  try {
    const data = e.parameter;
    const timestamp = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"});

    // Check if this is a referral or contact form
    if (data.formType === "referral") {
      return handleReferral(data, timestamp);
    } else {
      return handleContact(data, timestamp);
    }
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({result: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// CONTACT FORM HANDLER
// ============================================
function handleContact(data, timestamp) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONTACT_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONTACT_SHEET_NAME);
    sheet.appendRow([
      "Timestamp",
      "Name",
      "Email",
      "Phone",
      "Subject",
      "Message",
      "Preferred Inspector",
      "Service Type",
      "Service Area",
      "Status"
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#39FF14");
  }

  sheet.appendRow([
    timestamp,
    data.name || "",
    data.email || "",
    data.phone || "",
    data.subject || "",
    data.message || "",
    data.preferredInspector || "First Available",
    data.serviceType || "",
    data.serviceArea || "",
    "New"
  ]);

  sendContactNotificationEmail(data, timestamp);
  sendContactConfirmationEmail(data);

  return ContentService
    .createTextOutput(JSON.stringify({result: "success", message: "Contact form submitted"}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// REFERRAL FORM HANDLER
// ============================================
function handleReferral(data, timestamp) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(REFERRAL_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(REFERRAL_SHEET_NAME);
    sheet.appendRow([
      "Timestamp",
      "Referrer Name",
      "Referrer Phone",
      "Referrer Email",
      "Referral Name",
      "Referral Phone",
      "Referral Email",
      "Referral Address",
      "Sales Rep",
      "Notes",
      "Status",
      "Reward Tier",
      "Reward Paid"
    ]);
    sheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#39FF14");
  }

  sheet.appendRow([
    timestamp,
    data.referrerName || "",
    data.referrerPhone || "",
    data.referrerEmail || "",
    data.referralName || "",
    data.referralPhone || "",
    data.referralEmail || "",
    data.referralAddress || "",
    data.salesRep || "",
    data.notes || "",
    "New",
    "",  // Reward Tier - to be filled later
    "No" // Reward Paid - to be updated when paid
  ]);

  sendReferralNotificationEmail(data, timestamp);
  sendReferralConfirmationEmail(data);

  return ContentService
    .createTextOutput(JSON.stringify({result: "success", message: "Referral submitted"}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// CONTACT EMAIL FUNCTIONS
// ============================================
function sendContactNotificationEmail(data, timestamp) {
  const subject = `🏠 New Lead: ${data.subject || "Contact Form Submission"}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; padding: 20px; text-align: center;">
        <h1 style="color: #39FF14; margin: 0;">New Contact Form Submission</h1>
      </div>

      <div style="padding: 20px; background: #f9f9f9;">
        <h2 style="color: #0066CC; border-bottom: 2px solid #39FF14; padding-bottom: 10px;">Contact Details</h2>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; font-weight: bold; width: 140px;">Name:</td>
            <td style="padding: 10px;">${data.name || "Not provided"}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; font-weight: bold;">Email:</td>
            <td style="padding: 10px;"><a href="mailto:${data.email}">${data.email || "Not provided"}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Phone:</td>
            <td style="padding: 10px;"><a href="tel:${data.phone}">${data.phone || "Not provided"}</a></td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; font-weight: bold;">Subject:</td>
            <td style="padding: 10px;">${data.subject || "Not provided"}</td>
          </tr>
        </table>

        <h2 style="color: #0066CC; border-bottom: 2px solid #39FF14; padding-bottom: 10px; margin-top: 20px;">Message</h2>
        <div style="background: #fff; padding: 15px; border-left: 4px solid #39FF14;">
          ${(data.message || "No message").replace(/\n/g, "<br>")}
        </div>

        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Submitted: ${timestamp}<br>
          Source: rivercityroofingsolutions.com
        </p>
      </div>

      <div style="background: #000; padding: 15px; text-align: center;">
        <p style="color: #39FF14; margin: 0; font-size: 14px;">River City Roofing Solutions</p>
        <p style="color: #fff; margin: 5px 0 0 0; font-size: 12px;">(256) 274-8530</p>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: subject,
    htmlBody: htmlBody,
    replyTo: data.email || NOTIFICATION_EMAIL
  });
}

function sendContactConfirmationEmail(data) {
  if (!data.email) return;

  const subject = "Thank You for Contacting River City Roofing Solutions!";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; padding: 20px; text-align: center;">
        <h1 style="color: #39FF14; margin: 0;">Thank You!</h1>
      </div>

      <div style="padding: 20px;">
        <p>Hi ${data.name || "there"},</p>

        <p>Thank you for reaching out to River City Roofing Solutions! We've received your message and one of our team members will get back to you within 24 hours.</p>

        <p>In the meantime, feel free to give us a call if you have any urgent questions:</p>

        <p style="text-align: center; margin: 20px 0;">
          <a href="tel:256-274-8530" style="background: #39FF14; color: #000; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">(256) 274-8530</a>
        </p>

        <p>We look forward to helping you with your roofing needs!</p>

        <p>Best regards,<br>
        <strong>The River City Roofing Team</strong></p>
      </div>

      <div style="background: #000; padding: 15px; text-align: center;">
        <p style="color: #39FF14; margin: 0; font-size: 14px;">River City Roofing Solutions</p>
        <p style="color: #fff; margin: 5px 0 0 0; font-size: 12px;">(256) 274-8530 | rivercityroofingsolutions.com</p>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
    name: "River City Roofing Solutions",
    replyTo: NOTIFICATION_EMAIL
  });
}

// ============================================
// REFERRAL EMAIL FUNCTIONS
// ============================================
function sendReferralNotificationEmail(data, timestamp) {
  const subject = `🎁 New Referral from ${data.referrerName}!`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; padding: 20px; text-align: center;">
        <h1 style="color: #39FF14; margin: 0;">🎁 New Referral Submitted!</h1>
      </div>

      <div style="padding: 20px; background: #f9f9f9;">
        <h2 style="color: #0066CC; border-bottom: 2px solid #39FF14; padding-bottom: 10px;">Referring Customer</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; font-weight: bold; width: 140px;">Name:</td>
            <td style="padding: 10px;">${data.referrerName}</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; font-weight: bold;">Phone:</td>
            <td style="padding: 10px;"><a href="tel:${data.referrerPhone}">${data.referrerPhone}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Email:</td>
            <td style="padding: 10px;"><a href="mailto:${data.referrerEmail}">${data.referrerEmail || "Not provided"}</a></td>
          </tr>
        </table>

        <h2 style="color: #0066CC; border-bottom: 2px solid #39FF14; padding-bottom: 10px; margin-top: 20px;">New Lead (Referral)</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; font-weight: bold; width: 140px;">Name:</td>
            <td style="padding: 10px;"><strong>${data.referralName}</strong></td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; font-weight: bold;">Phone:</td>
            <td style="padding: 10px;"><a href="tel:${data.referralPhone}" style="font-size: 16px; font-weight: bold;">${data.referralPhone}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Email:</td>
            <td style="padding: 10px;"><a href="mailto:${data.referralEmail}">${data.referralEmail || "Not provided"}</a></td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px; font-weight: bold;">Address:</td>
            <td style="padding: 10px;"><strong>${data.referralAddress}</strong></td>
          </tr>
        </table>

        ${data.salesRep ? `
        <h2 style="color: #0066CC; border-bottom: 2px solid #39FF14; padding-bottom: 10px; margin-top: 20px;">Sales Rep</h2>
        <p style="padding: 10px; background: #fff;">${data.salesRep}</p>
        ` : ""}

        ${data.notes ? `
        <h2 style="color: #0066CC; border-bottom: 2px solid #39FF14; padding-bottom: 10px; margin-top: 20px;">Notes</h2>
        <div style="background: #fff; padding: 15px; border-left: 4px solid #39FF14;">
          ${data.notes.replace(/\n/g, "<br>")}
        </div>
        ` : ""}

        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Submitted: ${timestamp}<br>
          Source: Referral Rewards Program
        </p>
      </div>

      <div style="background: #000; padding: 15px; text-align: center;">
        <p style="color: #39FF14; margin: 0; font-size: 14px;">River City Roofing Solutions</p>
        <p style="color: #fff; margin: 5px 0 0 0; font-size: 12px;">(256) 274-8530</p>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: subject,
    htmlBody: htmlBody
  });
}

function sendReferralConfirmationEmail(data) {
  if (!data.referrerEmail) return;

  const subject = "Thank You for Your Referral! 🎁";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #000; padding: 20px; text-align: center;">
        <h1 style="color: #39FF14; margin: 0;">Thank You for Your Referral!</h1>
      </div>

      <div style="padding: 20px;">
        <p>Hi ${data.referrerName},</p>

        <p>Thank you for referring <strong>${data.referralName}</strong> to River City Roofing Solutions! We truly appreciate your trust in our services.</p>

        <div style="background: #f9f9f9; padding: 20px; border-left: 4px solid #39FF14; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #0066CC;">What happens next?</h3>
          <ol style="margin: 0; padding-left: 20px; color: #666;">
            <li style="margin-bottom: 8px;">We'll reach out to ${data.referralName.split(' ')[0]} within 24-48 hours</li>
            <li style="margin-bottom: 8px;">If they schedule and complete a roof replacement, you'll earn your reward!</li>
            <li style="margin-bottom: 8px;">We'll keep you updated on the status of your referral</li>
          </ol>
        </div>

        <div style="background: #000; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
          <p style="color: #39FF14; font-size: 24px; font-weight: bold; margin: 0;">Reward Tiers</p>
          <p style="color: #fff; margin: 10px 0;">1st: $100 | 2nd: $250 | 3rd: $500 | 4th+: $1,000 each</p>
          <p style="color: #39FF14; font-size: 14px; margin: 0;">Earn up to $7,850 with 10 referrals!</p>
        </div>

        <p>Have more friends or family who need roofing services? Keep those referrals coming!</p>

        <p style="text-align: center; margin: 20px 0;">
          <a href="https://rivercityroofingsolutions.com/referral-rewards" style="background: #39FF14; color: #000; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">Submit Another Referral</a>
        </p>

        <p>Thank you for being a valued customer!</p>

        <p>Best regards,<br>
        <strong>The River City Roofing Team</strong></p>
      </div>

      <div style="background: #000; padding: 15px; text-align: center;">
        <p style="color: #39FF14; margin: 0; font-size: 14px;">River City Roofing Solutions</p>
        <p style="color: #fff; margin: 5px 0 0 0; font-size: 12px;">(256) 274-8530 | rivercityroofingsolutions.com</p>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: data.referrerEmail,
    subject: subject,
    htmlBody: htmlBody,
    name: "River City Roofing Solutions",
    replyTo: NOTIFICATION_EMAIL
  });
}

// Test function - run this to verify setup
function testSetup() {
  const testData = {
    parameter: {
      name: "Test User",
      email: "test@example.com",
      phone: "(256) 555-1234",
      subject: "Test Submission",
      message: "This is a test message from the setup verification.",
      preferredInspector: "First Available"
    }
  };

  const result = doPost(testData);
  Logger.log(result.getContent());
}
```

## Step 3: Deploy as Web App

1. Click **Deploy** > **New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Set these options:
   - **Description**: Contact Form Handler
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**
5. **Authorize** when prompted (click through the "unsafe" warning - it's your own script)
6. **Copy the Web App URL** - it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

## Step 4: Add URL to Vercel

1. Go to your Vercel project dashboard
2. Go to **Settings** > **Environment Variables**
3. Add a new variable:
   - **Name**: `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT`
   - **Value**: (paste the Web App URL from Step 3)
4. Click **Save**
5. **Redeploy** your site for the changes to take effect

## Step 5: Test

1. Go to your contact page
2. Submit a test form
3. Check:
   - Email arrives at rcs@rivercityroofingsolutions.com
   - Entry appears in Google Sheet "Contact Submissions" tab
   - Confirmation email sent to the submitter

## Troubleshooting

- **"Authorization required"**: Re-authorize the script in Apps Script
- **No emails**: Check spam folder, verify email address in script
- **Sheet not updating**: Verify SPREADSHEET_ID matches your sheet
- **CORS errors**: Make sure deployment is set to "Anyone" access

## Updating the Script

If you need to make changes:
1. Edit the code in Apps Script
2. Click **Deploy** > **Manage deployments**
3. Click the pencil icon on your deployment
4. Change version to "New version"
5. Click **Deploy**
