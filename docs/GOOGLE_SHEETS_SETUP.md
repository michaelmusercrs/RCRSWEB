# Google Sheets Integration Setup Guide

## Overview

This document provides step-by-step instructions for setting up Google Sheets integration for the River City Roofing Solutions website. The integration enables two-way synchronization between the application and Google Sheets for:

- Team member data
- Inventory management
- Commission tracking
- Customer records
- Order tracking

## Prerequisites

- Google Cloud Platform account
- Access to Google Cloud Console
- Admin access to the RCRS Google Workspace (optional, for sharing)

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" in the top navigation bar
3. Click "New Project"
4. Enter project name: `RCRS-Website-Integration`
5. Click "Create"

---

## Step 2: Enable Google Sheets API

1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on "Google Sheets API"
4. Click "Enable"

---

## Step 3: Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Enter service account details:
   - **Name**: `rcrs-sheets-service`
   - **Description**: Service account for RCRS website Google Sheets integration
4. Click "Create and Continue"
5. Skip the optional steps (no roles needed for basic Sheets access)
6. Click "Done"

---

## Step 4: Generate Service Account Key

1. In the Credentials page, find your new service account
2. Click on the service account email
3. Go to the "Keys" tab
4. Click "Add Key" > "Create new key"
5. Select "JSON" format
6. Click "Create"
7. Save the downloaded JSON file securely (DO NOT commit to git)

The JSON file contains:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "rcrs-sheets-service@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

---

## Step 5: Create the Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it: `RCRS-Data-Integration`
4. Note the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```

---

## Step 6: Share Spreadsheet with Service Account

1. In your Google Spreadsheet, click the "Share" button
2. Add the service account email (from the JSON file's `client_email` field)
3. Grant "Editor" access
4. Uncheck "Notify people"
5. Click "Share"

---

## Step 7: Configure Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Google Sheets Integration
GOOGLE_SERVICE_ACCOUNT_EMAIL=rcrs-sheets-service@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_ID=your-spreadsheet-id-here

# Optional: Separate spreadsheet IDs for different purposes
INVENTORY_SHEETS_ID=your-inventory-spreadsheet-id
DELIVERY_SHEETS_ID=your-delivery-spreadsheet-id
```

### Important Notes on Private Key Formatting

The private key from the JSON file contains `\n` characters for line breaks. When setting the environment variable:

**Option 1: Keep as single line with escaped newlines**
```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

**Option 2: Use actual newlines (works in some environments)**
```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBg...
-----END PRIVATE KEY-----
"
```

---

## Step 8: Vercel Deployment Configuration

For Vercel deployment, add environment variables in the Vercel dashboard:

1. Go to your project in Vercel
2. Navigate to Settings > Environment Variables
3. Add each variable:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` (paste the entire key including BEGIN/END markers)
   - `GOOGLE_SHEETS_ID`

**Important**: For the private key in Vercel, paste it exactly as it appears in the JSON file, with `\n` characters intact.

---

## Step 9: Test the Integration

### Test Connection Status

```bash
curl http://localhost:3000/api/sheets/sync
```

Expected response:
```json
{
  "success": true,
  "message": "Connected to \"RCRS-Data-Integration\"",
  "status": {
    "configured": true,
    "connected": true,
    "sheetTitle": "RCRS-Data-Integration"
  },
  "timestamp": "2026-02-05T12:00:00.000Z"
}
```

### Trigger Manual Sync

```bash
curl -X POST http://localhost:3000/api/sheets/sync \
  -H "Content-Type: application/json" \
  -d '{"syncType": "full"}'
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sheets/sync` | GET | Get sync status |
| `/api/sheets/sync` | POST | Trigger manual sync |
| `/api/sheets/inventory` | GET | Get inventory from Sheets |
| `/api/sheets/inventory` | POST | Create/update inventory item |
| `/api/sheets/inventory` | DELETE | Delete inventory item |
| `/api/sheets/commissions` | GET | Get commission data |
| `/api/sheets/commissions` | POST | Add commission entry |
| `/api/sheets/customers` | GET | Get customer data |
| `/api/sheets/customers` | POST | Create/update customer |
| `/api/sheets/customers` | DELETE | Delete customer |

---

## Troubleshooting

### "Google Sheets not configured" Error

- Verify all three environment variables are set
- Check that the service account email is correct
- Ensure the private key is properly formatted

### "Permission denied" Error

- Verify the spreadsheet is shared with the service account email
- Ensure the service account has "Editor" access
- Check that the Sheets API is enabled in Google Cloud Console

### "Spreadsheet not found" Error

- Verify the GOOGLE_SHEETS_ID is correct
- Check that you're using the ID from the URL, not the full URL
- Ensure the spreadsheet exists and hasn't been deleted

### Private Key Errors

- Try different formats (escaped newlines vs actual newlines)
- Verify the key is enclosed in double quotes
- Ensure there are no extra spaces or characters

---

## Security Best Practices

1. **Never commit credentials to git** - Always use environment variables
2. **Restrict service account access** - Only share necessary spreadsheets
3. **Rotate keys periodically** - Generate new keys every 90 days
4. **Monitor usage** - Review Google Cloud Console for unusual activity
5. **Use separate spreadsheets** - Consider separate sheets for production vs development

---

## Data Flow

```
+-------------------+     +----------------------+     +------------------+
|   Next.js App     |<--->|  Google Sheets API   |<--->|  Google Sheets   |
+-------------------+     +----------------------+     +------------------+
       |                                                      |
       |  - Team Members                                      |
       |  - Inventory                                         |
       |  - Commissions                                       |
       |  - Customers                                         |
       |  - Orders                                            |
       +------------------------------------------------------+
```

### Two-Way Sync

1. **App to Sheets**: Changes made in the app automatically update Google Sheets
2. **Sheets to App**: Refresh data in the app to see Sheets changes

---

## Contact

For issues with the Google Sheets integration, contact the development team or refer to the [Google Sheets API documentation](https://developers.google.com/sheets/api).
