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

let sheet = doc.sheetsByTitle['Customer_Portal_Access'];
const token = randomBytes(16).toString('hex');
await sheet.addRow({
  accessToken: token,
  customerId: 'jn-test-001',
  customerName: 'Josh Sparkman',
  customerEmail: '',
  customerPhone: '2567582770',
  customerAddress: 'Decatur, AL',
  salesRepId: 'josh-sparkman',
  salesRepName: 'Josh Sparkman',
  salesRepSlug: 'josh-sparkman',
  jobId: '55471a84ed4348538bb30b5d29c1c694',
  jobNimbusContactId: 'mlp3ofpxy5zn8qq4jhifb5v',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  lastAccessedAt: '',
  isActive: 'true',
});

console.log('JN-linked test token:', token);
console.log('Portal URL: http://localhost:3002/my/' + token);
