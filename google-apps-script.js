// River City Roofing Solutions - Form Handler
// COPY THIS ENTIRE FILE TO YOUR GOOGLE APPS SCRIPT

const COMPANY_EMAIL = 'rivercityroofingsolutions@gmail.com';

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({status: 'ok', message: 'RCRS Form Handler Active'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = e.parameter;
    var formType = data.formType || 'contact';
    var sourcePage = data.sourcePage || 'Website';

    if (formType === 'referral') {
      sendReferralEmail(data, sourcePage);
    } else {
      sendContactEmail(data, sourcePage);
    }

    return ContentService.createTextOutput(JSON.stringify({result: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({result: 'error', message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendContactEmail(data, sourcePage) {
  var subject = '[' + sourcePage + '] New Lead: ' + (data.subject || 'Contact');
  var body = 'NEW CONTACT FORM SUBMISSION\n' +
    '============================\n' +
    'Source: ' + sourcePage + '\n' +
    'Time: ' + new Date().toLocaleString() + '\n\n' +
    'CONTACT INFO\n' +
    '------------\n' +
    'Name: ' + data.name + '\n' +
    'Email: ' + data.email + '\n' +
    'Phone: ' + (data.phone || 'Not provided') + '\n\n' +
    'REQUEST\n' +
    '-------\n' +
    'Subject: ' + data.subject + '\n' +
    'Message: ' + data.message + '\n\n' +
    'DETAILS\n' +
    '-------\n' +
    'Preferred Inspector: ' + (data.preferredInspector || 'First Available') + '\n' +
    'Service Type: ' + (data.serviceType || 'Not specified') + '\n' +
    'Service Area: ' + (data.serviceArea || 'Not specified') + '\n';

  GmailApp.sendEmail(COMPANY_EMAIL, subject, body, {
    name: 'RCRS Website',
    replyTo: data.email
  });

  Logger.log('Contact email sent to ' + COMPANY_EMAIL);
}

function sendReferralEmail(data, sourcePage) {
  var subject = '[REFERRAL] New Referral from ' + data.referrerName;
  var body = 'NEW REFERRAL\n' +
    '============\n' +
    'Source: ' + sourcePage + '\n' +
    'Time: ' + new Date().toLocaleString() + '\n\n' +
    'REFERRER (Your Customer)\n' +
    '------------------------\n' +
    'Name: ' + data.referrerName + '\n' +
    'Phone: ' + data.referrerPhone + '\n' +
    'Email: ' + (data.referrerEmail || 'Not provided') + '\n\n' +
    'NEW LEAD\n' +
    '--------\n' +
    'Name: ' + data.referralName + '\n' +
    'Phone: ' + data.referralPhone + '\n' +
    'Email: ' + (data.referralEmail || 'Not provided') + '\n' +
    'Address: ' + data.referralAddress + '\n\n' +
    'Sales Rep: ' + (data.salesRep || 'Not specified') + '\n' +
    'Notes: ' + (data.notes || 'None') + '\n';

  GmailApp.sendEmail(COMPANY_EMAIL, subject, body, {
    name: 'RCRS Website'
  });

  Logger.log('Referral email sent to ' + COMPANY_EMAIL);
}

// TEST FUNCTION - Run this in Google Apps Script to test
function testContactForm() {
  var mockEvent = {
    parameter: {
      formType: 'contact',
      sourcePage: 'Test',
      name: 'Test User',
      email: 'test@test.com',
      phone: '256-555-1234',
      subject: 'Test Message',
      message: 'This is a test from Google Apps Script'
    }
  };
  doPost(mockEvent);
  Logger.log('Test complete - check ' + COMPANY_EMAIL + ' for email');
}
