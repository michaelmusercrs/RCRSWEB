// Configuration - UPDATE THIS TO YOUR SHEET
var NOTIFICATION_EMAIL = "rcs@rivercityroofingsolutions.com";
var SPREADSHEET_ID = "1GP_p06Mw7LBXQ_lYZLEL6llsFWNdoNZQXzgFjH3EP6I";
var CONTACT_SHEET_NAME = "Contact Submissions";
var REFERRAL_SHEET_NAME = "Referral Submissions";

function doPost(e) {
  try {
    var data = e.parameter;
    var timestamp = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"});
    if (data.formType === "referral") {
      return handleReferral(data, timestamp);
    } else {
      return handleContact(data, timestamp);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({result: "error", message: error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// CONTACT FORM HANDLER
// ============================================
function handleContact(data, timestamp) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONTACT_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONTACT_SHEET_NAME);
    sheet.appendRow([
      "Timestamp",
      "Name",
      "Email",
      "Phone",
      "Subject",
      "Message",
      "Status",
      "Assigned To",
      "Follow Up Date",
      "Notes"
    ]);
    // Format header
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#39FF14").setFontColor("#000000");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150); // Timestamp
    sheet.setColumnWidth(2, 150); // Name
    sheet.setColumnWidth(3, 200); // Email
    sheet.setColumnWidth(4, 120); // Phone
    sheet.setColumnWidth(5, 150); // Subject
    sheet.setColumnWidth(6, 300); // Message
    sheet.setColumnWidth(7, 100); // Status
    sheet.setColumnWidth(8, 120); // Assigned To
    sheet.setColumnWidth(9, 120); // Follow Up
    sheet.setColumnWidth(10, 200); // Notes
  }

  sheet.appendRow([
    timestamp,
    data.name || "",
    data.email || "",
    data.phone || "",
    data.subject || "",
    data.message || "",
    "New",
    "",
    "",
    ""
  ]);

  // Send notification email
  var emailBody = "<div style='font-family: Arial, sans-serif; max-width: 600px;'>";
  emailBody += "<div style='background: #000; padding: 20px; text-align: center;'>";
  emailBody += "<h1 style='color: #39FF14; margin: 0;'>New Contact Form Submission</h1>";
  emailBody += "</div>";
  emailBody += "<div style='padding: 20px; background: #f5f5f5;'>";
  emailBody += "<table style='width: 100%; border-collapse: collapse;'>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold; background: #fff;'>Name:</td><td style='padding: 10px; background: #fff;'>" + (data.name || "Not provided") + "</td></tr>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold;'>Email:</td><td style='padding: 10px;'><a href='mailto:" + data.email + "'>" + (data.email || "Not provided") + "</a></td></tr>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold; background: #fff;'>Phone:</td><td style='padding: 10px; background: #fff;'><a href='tel:" + data.phone + "'>" + (data.phone || "Not provided") + "</a></td></tr>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold;'>Subject:</td><td style='padding: 10px;'>" + (data.subject || "Not provided") + "</td></tr>";
  emailBody += "</table>";
  emailBody += "<h3 style='color: #0066CC; margin-top: 20px;'>Message:</h3>";
  emailBody += "<div style='background: #fff; padding: 15px; border-left: 4px solid #39FF14;'>" + (data.message || "No message").replace(/\n/g, "<br>") + "</div>";
  emailBody += "<p style='color: #666; font-size: 12px; margin-top: 20px;'>Submitted: " + timestamp + "</p>";
  emailBody += "</div>";
  emailBody += "<div style='background: #000; padding: 15px; text-align: center;'>";
  emailBody += "<p style='color: #39FF14; margin: 0;'>River City Roofing Solutions</p>";
  emailBody += "</div></div>";

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: "New Lead: " + (data.subject || "Contact Form"),
    htmlBody: emailBody,
    replyTo: data.email || NOTIFICATION_EMAIL
  });

  // Send confirmation to customer
  if (data.email) {
    var confirmBody = "<div style='font-family: Arial, sans-serif; max-width: 600px;'>";
    confirmBody += "<div style='background: #000; padding: 20px; text-align: center;'>";
    confirmBody += "<h1 style='color: #39FF14; margin: 0;'>Thank You!</h1>";
    confirmBody += "</div>";
    confirmBody += "<div style='padding: 20px;'>";
    confirmBody += "<p>Hi " + (data.name || "there") + ",</p>";
    confirmBody += "<p>Thank you for reaching out to River City Roofing Solutions! We've received your message and one of our team members will get back to you within 24 hours.</p>";
    confirmBody += "<p style='text-align: center; margin: 30px 0;'>";
    confirmBody += "<a href='tel:256-274-8530' style='background: #39FF14; color: #000; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 5px;'>Call Us: (256) 274-8530</a>";
    confirmBody += "</p>";
    confirmBody += "<p>Best regards,<br><strong>The River City Roofing Team</strong></p>";
    confirmBody += "</div>";
    confirmBody += "<div style='background: #000; padding: 15px; text-align: center;'>";
    confirmBody += "<p style='color: #39FF14; margin: 0;'>River City Roofing Solutions</p>";
    confirmBody += "<p style='color: #fff; margin: 5px 0 0 0; font-size: 12px;'>(256) 274-8530 | rivercityroofingsolutions.com</p>";
    confirmBody += "</div></div>";

    MailApp.sendEmail({
      to: data.email,
      subject: "Thank You for Contacting River City Roofing Solutions!",
      htmlBody: confirmBody,
      name: "River City Roofing Solutions",
      replyTo: NOTIFICATION_EMAIL
    });
  }

  return ContentService.createTextOutput(JSON.stringify({result: "success"})).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// REFERRAL FORM HANDLER
// ============================================
function handleReferral(data, timestamp) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(REFERRAL_SHEET_NAME);

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
      "Referral #",
      "Reward Tier",
      "Reward Amount",
      "Reward Paid",
      "Date Paid"
    ]);
    // Format header
    sheet.getRange(1, 1, 1, 16).setFontWeight("bold").setBackground("#39FF14").setFontColor("#000000");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150);  // Timestamp
    sheet.setColumnWidth(2, 150);  // Referrer Name
    sheet.setColumnWidth(3, 120);  // Referrer Phone
    sheet.setColumnWidth(4, 180);  // Referrer Email
    sheet.setColumnWidth(5, 150);  // Referral Name
    sheet.setColumnWidth(6, 120);  // Referral Phone
    sheet.setColumnWidth(7, 180);  // Referral Email
    sheet.setColumnWidth(8, 250);  // Referral Address
    sheet.setColumnWidth(9, 120);  // Sales Rep
    sheet.setColumnWidth(10, 200); // Notes
    sheet.setColumnWidth(11, 100); // Status
    sheet.setColumnWidth(12, 80);  // Referral #
    sheet.setColumnWidth(13, 100); // Reward Tier
    sheet.setColumnWidth(14, 100); // Reward Amount
    sheet.setColumnWidth(15, 100); // Reward Paid
    sheet.setColumnWidth(16, 100); // Date Paid
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
    "",      // Referral # - fill in manually
    "",      // Reward Tier
    "",      // Reward Amount
    "No",    // Reward Paid
    ""       // Date Paid
  ]);

  // Send notification email
  var emailBody = "<div style='font-family: Arial, sans-serif; max-width: 600px;'>";
  emailBody += "<div style='background: #000; padding: 20px; text-align: center;'>";
  emailBody += "<h1 style='color: #39FF14; margin: 0;'>New Referral Submitted!</h1>";
  emailBody += "</div>";
  emailBody += "<div style='padding: 20px; background: #f5f5f5;'>";

  emailBody += "<h2 style='color: #0066CC; border-bottom: 2px solid #39FF14; padding-bottom: 10px;'>Referring Customer</h2>";
  emailBody += "<table style='width: 100%; border-collapse: collapse;'>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold; background: #fff;'>Name:</td><td style='padding: 10px; background: #fff;'>" + (data.referrerName || "") + "</td></tr>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold;'>Phone:</td><td style='padding: 10px;'><a href='tel:" + data.referrerPhone + "'>" + (data.referrerPhone || "") + "</a></td></tr>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold; background: #fff;'>Email:</td><td style='padding: 10px; background: #fff;'><a href='mailto:" + data.referrerEmail + "'>" + (data.referrerEmail || "Not provided") + "</a></td></tr>";
  emailBody += "</table>";

  emailBody += "<h2 style='color: #0066CC; border-bottom: 2px solid #39FF14; padding-bottom: 10px; margin-top: 20px;'>New Lead (Referral)</h2>";
  emailBody += "<table style='width: 100%; border-collapse: collapse;'>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold; background: #fff;'>Name:</td><td style='padding: 10px; background: #fff; font-size: 16px;'><strong>" + (data.referralName || "") + "</strong></td></tr>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold;'>Phone:</td><td style='padding: 10px;'><a href='tel:" + data.referralPhone + "' style='font-size: 18px; font-weight: bold;'>" + (data.referralPhone || "") + "</a></td></tr>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold; background: #fff;'>Email:</td><td style='padding: 10px; background: #fff;'><a href='mailto:" + data.referralEmail + "'>" + (data.referralEmail || "Not provided") + "</a></td></tr>";
  emailBody += "<tr><td style='padding: 10px; font-weight: bold;'>Address:</td><td style='padding: 10px;'><strong>" + (data.referralAddress || "") + "</strong></td></tr>";
  emailBody += "</table>";

  if (data.salesRep) {
    emailBody += "<h3 style='color: #0066CC; margin-top: 20px;'>Sales Rep:</h3>";
    emailBody += "<p style='background: #fff; padding: 10px;'>" + data.salesRep + "</p>";
  }

  if (data.notes) {
    emailBody += "<h3 style='color: #0066CC; margin-top: 20px;'>Notes:</h3>";
    emailBody += "<div style='background: #fff; padding: 15px; border-left: 4px solid #39FF14;'>" + data.notes.replace(/\n/g, "<br>") + "</div>";
  }

  emailBody += "<p style='color: #666; font-size: 12px; margin-top: 20px;'>Submitted: " + timestamp + "</p>";
  emailBody += "</div>";
  emailBody += "<div style='background: #000; padding: 15px; text-align: center;'>";
  emailBody += "<p style='color: #39FF14; margin: 0;'>River City Roofing Solutions - Referral Program</p>";
  emailBody += "</div></div>";

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: "New Referral from " + (data.referrerName || "Customer"),
    htmlBody: emailBody
  });

  // Send confirmation to referrer
  if (data.referrerEmail) {
    var confirmBody = "<div style='font-family: Arial, sans-serif; max-width: 600px;'>";
    confirmBody += "<div style='background: #000; padding: 20px; text-align: center;'>";
    confirmBody += "<h1 style='color: #39FF14; margin: 0;'>Thank You for Your Referral!</h1>";
    confirmBody += "</div>";
    confirmBody += "<div style='padding: 20px;'>";
    confirmBody += "<p>Hi " + (data.referrerName || "there") + ",</p>";
    confirmBody += "<p>Thank you for referring <strong>" + (data.referralName || "your friend") + "</strong> to River City Roofing Solutions! We truly appreciate your trust in our services.</p>";

    confirmBody += "<div style='background: #f5f5f5; padding: 20px; border-left: 4px solid #39FF14; margin: 20px 0;'>";
    confirmBody += "<h3 style='margin: 0 0 10px 0; color: #0066CC;'>What happens next?</h3>";
    confirmBody += "<ol style='margin: 0; padding-left: 20px; color: #666;'>";
    confirmBody += "<li style='margin-bottom: 8px;'>We'll reach out to " + (data.referralName ? data.referralName.split(' ')[0] : "them") + " within 24-48 hours</li>";
    confirmBody += "<li style='margin-bottom: 8px;'>If they schedule and complete a roof replacement, you'll earn your reward!</li>";
    confirmBody += "<li style='margin-bottom: 8px;'>We'll keep you updated on the status</li>";
    confirmBody += "</ol></div>";

    confirmBody += "<div style='background: #000; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;'>";
    confirmBody += "<p style='color: #39FF14; font-size: 20px; font-weight: bold; margin: 0;'>Reward Tiers</p>";
    confirmBody += "<p style='color: #fff; margin: 10px 0;'>1st: $100 | 2nd: $250 | 3rd: $500 | 4th+: $1,000 each</p>";
    confirmBody += "<p style='color: #39FF14; font-size: 14px; margin: 0;'>Earn up to $7,850 with 10 referrals!</p>";
    confirmBody += "</div>";

    confirmBody += "<p style='text-align: center;'>";
    confirmBody += "<a href='https://rivercityroofingsolutions.com/referral-rewards' style='background: #39FF14; color: #000; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;'>Submit Another Referral</a>";
    confirmBody += "</p>";

    confirmBody += "<p>Thank you for being a valued customer!</p>";
    confirmBody += "<p>Best regards,<br><strong>The River City Roofing Team</strong></p>";
    confirmBody += "</div>";
    confirmBody += "<div style='background: #000; padding: 15px; text-align: center;'>";
    confirmBody += "<p style='color: #39FF14; margin: 0;'>River City Roofing Solutions</p>";
    confirmBody += "<p style='color: #fff; margin: 5px 0 0 0; font-size: 12px;'>(256) 274-8530 | rivercityroofingsolutions.com</p>";
    confirmBody += "</div></div>";

    MailApp.sendEmail({
      to: data.referrerEmail,
      subject: "Thank You for Your Referral!",
      htmlBody: confirmBody,
      name: "River City Roofing Solutions",
      replyTo: NOTIFICATION_EMAIL
    });
  }

  return ContentService.createTextOutput(JSON.stringify({result: "success"})).setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// UTILITY: Setup sheets with formatting
// ============================================
function setupSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Create Contact sheet
  var contactSheet = ss.getSheetByName(CONTACT_SHEET_NAME);
  if (!contactSheet) {
    contactSheet = ss.insertSheet(CONTACT_SHEET_NAME);
    contactSheet.appendRow(["Timestamp", "Name", "Email", "Phone", "Subject", "Message", "Status", "Assigned To", "Follow Up Date", "Notes"]);
    contactSheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#39FF14").setFontColor("#000000");
    contactSheet.setFrozenRows(1);
  }

  // Create Referral sheet
  var referralSheet = ss.getSheetByName(REFERRAL_SHEET_NAME);
  if (!referralSheet) {
    referralSheet = ss.insertSheet(REFERRAL_SHEET_NAME);
    referralSheet.appendRow(["Timestamp", "Referrer Name", "Referrer Phone", "Referrer Email", "Referral Name", "Referral Phone", "Referral Email", "Referral Address", "Sales Rep", "Notes", "Status", "Referral #", "Reward Tier", "Reward Amount", "Reward Paid", "Date Paid"]);
    referralSheet.getRange(1, 1, 1, 16).setFontWeight("bold").setBackground("#39FF14").setFontColor("#000000");
    referralSheet.setFrozenRows(1);
  }

  Logger.log("Sheets setup complete!");
}

// Test functions removed - test via the website forms
