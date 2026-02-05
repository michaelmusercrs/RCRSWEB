const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');

async function checkSheets() {
  try {
    // Read .env.local file
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        envVars[key.trim()] = valueParts.join('=').replace(/^"|"$/g, '');
      }
    });

    const serviceAccountAuth = new JWT({
      email: envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: envVars.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(envVars.GOOGLE_SHEETS_ID, serviceAccountAuth);
    await doc.loadInfo();

    console.log('\n✅ Successfully connected to Google Sheets!');
    console.log(`\nSpreadsheet title: ${doc.title}`);
    console.log(`\nAvailable sheets:`);

    doc.sheetsByIndex.forEach((sheet, index) => {
      console.log(`  ${index + 1}. "${sheet.title}" (${sheet.rowCount} rows, ${sheet.columnCount} columns)`);
    });

    console.log('\n❓ Looking for sheet named "team_members"...');
    const teamSheet = doc.sheetsByTitle['team_members'];

    if (teamSheet) {
      console.log('✅ Found "team_members" sheet!');
      const headers = teamSheet.headerValues;
      console.log(`\nHeaders: ${headers.join(', ')}`);
    } else {
      console.log('❌ Sheet "team_members" not found.');
      console.log('\n📝 Please either:');
      console.log('   1. Rename one of your existing sheets to "team_members", OR');
      console.log('   2. Create a new sheet named "team_members"');
      console.log('\nRequired columns:');
      console.log('   slug, name, company, category, position, phone, email, altEmail,');
      console.log('   displayOrder, tagline, bio, region, launchDate, profileImage,');
      console.log('   truckImage, facebook, instagram, x');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkSheets();
