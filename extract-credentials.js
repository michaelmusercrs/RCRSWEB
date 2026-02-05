// extract-credentials.js
// Run this after the setup script: node extract-credentials.js

const fs = require('fs');

try {
  const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
  
  const envContent = `GOOGLE_SHEETS_ID=1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s
GOOGLE_SERVICE_ACCOUNT_EMAIL=${credentials.client_email}
GOOGLE_PRIVATE_KEY="${credentials.private_key}"`;

  fs.writeFileSync('.env.local', envContent);
  
  console.log('✅ .env.local file created successfully!');
  console.log('');
  console.log('🎯 SHARE YOUR GOOGLE SHEET WITH THIS EMAIL:');
  console.log(credentials.client_email);
  console.log('');
  console.log('Steps:');
  console.log('1. Open your Google Sheet');
  console.log('2. Click the Share button');
  console.log('3. Paste the email above');
  console.log('4. Give it "Editor" access');
  console.log('5. Click Send');
  console.log('');
  console.log('Then your website will read from the Google Sheet!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('Make sure credentials.json exists in this folder');
}
