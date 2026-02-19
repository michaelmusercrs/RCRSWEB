// Creates a test customer portal token by adding a row to Google Sheets
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const jwt = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, jwt);
await doc.loadInfo();

// Get or create Customer_Portal_Access sheet
let sheet = doc.sheetsByTitle['Customer_Portal_Access'];
if (!sheet) {
  sheet = await doc.addSheet({
    title: 'Customer_Portal_Access',
    headerValues: [
      'accessToken', 'customerId', 'customerName', 'customerEmail', 'customerPhone',
      'customerAddress', 'salesRepId', 'salesRepName', 'salesRepSlug', 'jobId',
      'createdAt', 'expiresAt', 'lastAccessedAt', 'isActive'
    ]
  });
}

const token = randomBytes(16).toString('hex');
const row = {
  accessToken: token,
  customerId: 'test-customer-001',
  customerName: 'Josh Sparkman',
  customerEmail: 'test@example.com',
  customerPhone: '2567582770',
  customerAddress: '123 Main St, Decatur, AL 35601',
  salesRepId: 'josh-sparkman',
  salesRepName: 'Josh Sparkman',
  salesRepSlug: 'josh-sparkman',
  jobId: '',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  lastAccessedAt: '',
  isActive: 'true',
};

await sheet.addRow(row);
console.log('Test token created:', token);
console.log('Portal URL: http://localhost:3002/my/' + token);
