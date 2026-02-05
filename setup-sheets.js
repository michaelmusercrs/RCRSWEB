// setup-sheets.js
// Simple setup - no gcloud CLI needed

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Google Sheets Setup\n');
console.log('STEP 1: Get Google Cloud Credentials');
console.log('--------------------------------------');
console.log('1. Go to: https://console.cloud.google.com');
console.log('2. Create a new project or select existing');
console.log('3. Click "APIs & Services" → "Enable APIs & Services"');
console.log('4. Search for "Google Sheets API" and enable it');
console.log('5. Go to "APIs & Services" → "Credentials"');
console.log('6. Click "Create Credentials" → "Service Account"');
console.log('7. Name it "sheets-access" and create');
console.log('8. Click on the service account you just created');
console.log('9. Go to "Keys" tab → "Add Key" → "Create New Key" → JSON');
console.log('10. Download the JSON file\n');

rl.question('Have you downloaded the JSON file? (yes/no): ', (answer) => {
  if (answer.toLowerCase() !== 'yes') {
    console.log('\n❌ Please complete step 1 first, then run this script again.');
    rl.close();
    return;
  }

  rl.question('\nWhat is the name of the JSON file you downloaded? ', (filename) => {
    try {
      if (!fs.existsSync(filename)) {
        console.log(`\n❌ Cannot find ${filename}`);
        console.log('Make sure the file is in the same folder as this script.');
        rl.close();
        return;
      }

      const credentials = JSON.parse(fs.readFileSync(filename, 'utf8'));
      
      const envContent = `GOOGLE_SHEETS_ID=1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s
GOOGLE_SERVICE_ACCOUNT_EMAIL=${credentials.client_email}
GOOGLE_PRIVATE_KEY="${credentials.private_key}"`;

      fs.writeFileSync('.env.local', envContent);
      
      console.log('\n✅ SUCCESS! .env.local file created!\n');
      console.log('STEP 2: Share Your Google Sheet');
      console.log('--------------------------------');
      console.log('Copy this email address:\n');
      console.log('   ' + credentials.client_email + '\n');
      console.log('Then:');
      console.log('1. Open your Google Sheet');
      console.log('2. Click the "Share" button');
      console.log('3. Paste the email above');
      console.log('4. Change permission to "Editor"');
      console.log('5. Uncheck "Notify people"');
      console.log('6. Click "Send"\n');
      console.log('✅ DONE! Your website will now read from the Google Sheet!');
      
      rl.close();
    } catch (error) {
      console.log('\n❌ Error:', error.message);
      rl.close();
    }
  });
});
