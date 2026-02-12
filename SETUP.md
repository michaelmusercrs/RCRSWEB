# River City Roofing Solutions - Setup Guide

This guide walks you through setting up all the required services and environment variables for the RCRS website.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Variables Overview](#environment-variables-overview)
3. [JobNimbus Setup](#jobnimbus-setup)
4. [Google Services Setup](#google-services-setup)
5. [Google Apps Script Setup](#google-apps-script-setup)
6. [Vercel Deployment](#vercel-deployment)
7. [GroupMe Integration](#groupme-integration)
8. [TeamUp Calendar](#teamup-calendar)
9. [Twilio SMS (Optional)](#twilio-sms-optional)
10. [SendGrid Email (Optional)](#sendgrid-email-optional)
11. [Security Best Practices](#security-best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Quick Start

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required values (minimum needed to run):
   - `JOBNIMBUS_API_KEY`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_SHEETS_ID`
   - `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT`
   - `ADMIN_PASSWORD` (change from default!)
   - `JWT_SECRET`

3. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```

---

## Environment Variables Overview

### Required Variables

| Variable | Purpose | Exposed to Browser |
|----------|---------|-------------------|
| `JOBNIMBUS_API_KEY` | CRM integration | No |
| `JOBNIMBUS_API_URL` | CRM API endpoint | No |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Sheets access | No |
| `GOOGLE_PRIVATE_KEY` | Sheets authentication | No |
| `GOOGLE_SHEETS_ID` | Main data sheet | No |
| `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT` | Form submissions | Yes |
| `ADMIN_PASSWORD` | Admin panel access | No |
| `JWT_SECRET` | Session tokens | No |

### Optional Variables

| Variable | Purpose | Exposed to Browser |
|----------|---------|-------------------|
| `NEXT_PUBLIC_GA_ID` | Google Analytics | Yes |
| `GROUPME_BOT_ID` | Team notifications | No |
| `TEAMUP_API_KEY` | Calendar integration | No |
| `TWILIO_ACCOUNT_SID` | SMS notifications | No |
| `SENDGRID_API_KEY` | Email sending | No |

---

## JobNimbus Setup

JobNimbus is the primary CRM for customer and job management.

### Getting Your API Key

1. Log in to [JobNimbus](https://app.jobnimbus.com)
2. Go to **Settings** (gear icon)
3. Navigate to **Integrations** > **API**
4. Click **Generate API Key**
5. Copy the key and add to `.env.local`:
   ```
   JOBNIMBUS_API_KEY=your_api_key_here
   JOBNIMBUS_API_URL=https://app.jobnimbus.com/api1
   ```

### Webhook Configuration (Optional)

To receive real-time updates from JobNimbus:

1. In JobNimbus, go to **Settings** > **Integrations** > **Webhooks**
2. Add a new webhook with URL: `https://your-domain.com/api/webhooks/jobnimbus`
3. Generate a webhook secret and add to `.env.local`:
   ```
   JOBNIMBUS_WEBHOOK_SECRET=your_webhook_secret
   ```

---

## Google Services Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** > **New Project**
3. Name it (e.g., "RCRS Website")
4. Click **Create**

### Step 2: Enable Required APIs

1. In your project, go to **APIs & Services** > **Library**
2. Search for and enable:
   - **Google Sheets API**
   - **Google Drive API**

### Step 3: Create a Service Account

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Fill in:
   - Name: `sheets-access`
   - Description: `Access Google Sheets for RCRS website`
4. Click **Create and Continue**
5. Skip the optional steps and click **Done**

### Step 4: Generate Service Account Key

1. Click on your new service account
2. Go to **Keys** tab
3. Click **Add Key** > **Create new key**
4. Select **JSON** and click **Create**
5. Save the downloaded file securely

### Step 5: Extract Credentials

From the JSON file, copy these values to `.env.local`:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important:** The private key must be a single line with `\n` for line breaks.

### Step 6: Create and Share Google Sheet

1. Create a new Google Sheet
2. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID_HERE]/edit
   ```
3. Share the sheet with your service account email (give Editor access)
4. Add to `.env.local`:
   ```
   GOOGLE_SHEETS_ID=your_sheet_id
   ```

---

## Google Apps Script Setup

Google Apps Script handles contact form submissions and sends notification emails.

### Step 1: Create the Script

1. Go to [Google Apps Script](https://script.google.com/)
2. Click **New Project**
3. Name it "River City Roofing Contact Form"

### Step 2: Add the Code

1. Delete the default code
2. Copy the code from `GOOGLE-APPS-SCRIPT-SETUP.md` in this project
3. Update the `SPREADSHEET_ID` to match your sheet
4. Update `NOTIFICATION_EMAIL` to your email

### Step 3: Deploy as Web App

1. Click **Deploy** > **New deployment**
2. Click the gear icon and select **Web app**
3. Configure:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**
5. Authorize when prompted (click through security warnings)
6. Copy the Web App URL

### Step 4: Add to Environment

```
NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

### Updating the Script

When you make changes:
1. Click **Deploy** > **Manage deployments**
2. Click the pencil icon
3. Change version to **New version**
4. Click **Deploy**

---

## Vercel Deployment

### Initial Setup

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Link your project:
   ```bash
   vercel link
   ```

3. Pull environment variables (if already configured):
   ```bash
   vercel env pull
   ```

### Adding Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Go to **Settings** > **Environment Variables**
4. Add each variable from `.env.local`
5. Select appropriate environments (Production, Preview, Development)

### Vercel Blob Storage

Blob storage is auto-configured when you:
1. Link your project to Vercel
2. Add the Blob storage integration
3. The `BLOB_READ_WRITE_TOKEN` will be automatically set

---

## GroupMe Integration

GroupMe sends team notifications for new leads, job updates, and alerts.

### Step 1: Create a GroupMe Bot

1. Go to [GroupMe Developers](https://dev.groupme.com/)
2. Sign in with your GroupMe account
3. Click **Bots** > **Create Bot**
4. Select the group to post to
5. Fill in:
   - Name: `RCRS Bot`
   - Callback URL: (leave empty for now)
6. Click **Submit**
7. Copy the **Bot ID**

### Step 2: Get Access Token (Optional)

For advanced features:
1. Go to [GroupMe Developers](https://dev.groupme.com/)
2. Click **Access Token**
3. Copy the token

### Step 3: Configure Environment

```
GROUPME_BOT_ID=your_bot_id
GROUPME_ACCESS_TOKEN=your_access_token
GROUPME_ENABLED=true
```

### Notification Settings

Control which notifications are sent:
```
GROUPME_NOTIFY_NEW_LEAD=true
GROUPME_NOTIFY_PROFILE_EDIT=true
GROUPME_NOTIFY_LOW_INVENTORY=true
GROUPME_NOTIFY_JOB_STATUS=true
GROUPME_NOTIFY_PORTAL_ACTIVITY=true
GROUPME_NOTIFY_DELIVERY=true
GROUPME_NOTIFY_SLA=true
```

---

## TeamUp Calendar

TeamUp provides calendar functionality for scheduling.

### Step 1: Create TeamUp Account

1. Go to [TeamUp](https://teamup.com/)
2. Create a new calendar or use existing

### Step 2: Get API Credentials

1. Go to **Settings** > **Apps & Integrations**
2. Enable **API Access**
3. Copy:
   - **API Key**
   - **Calendar Key** (from calendar URL)

### Step 3: Configure Environment

```
TEAMUP_API_KEY=your_api_key
TEAMUP_CALENDAR_KEY=your_calendar_key
```

### Sub-calendars (Optional)

If using separate sub-calendars:
```
TEAMUP_SUBCAL_INSPECTIONS=subcal_id_1
TEAMUP_SUBCAL_INSTALLATIONS=subcal_id_2
TEAMUP_SUBCAL_DELIVERIES=subcal_id_3
TEAMUP_SUBCAL_MEETINGS=subcal_id_4
TEAMUP_SUBCAL_GENERAL=subcal_id_5
```

---

## Twilio SMS (Optional)

Send SMS notifications to customers.

### Step 1: Create Twilio Account

1. Go to [Twilio Console](https://console.twilio.com/)
2. Sign up for an account
3. Verify your phone number

### Step 2: Get Credentials

1. On the dashboard, find:
   - **Account SID**
   - **Auth Token**
2. Get a phone number:
   - Go to **Phone Numbers** > **Buy a Number**
   - Or use the trial number

### Step 3: Configure Environment

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## SendGrid Email (Optional)

Send transactional emails.

### Step 1: Create SendGrid Account

1. Go to [SendGrid](https://sendgrid.com/)
2. Sign up for an account

### Step 2: Create API Key

1. Go to **Settings** > **API Keys**
2. Click **Create API Key**
3. Select **Full Access** or restrict as needed
4. Copy the API key (shown only once!)

### Step 3: Verify Sender

1. Go to **Settings** > **Sender Authentication**
2. Verify your sending domain or email

### Step 4: Configure Environment

```
SENDGRID_API_KEY=your_api_key
FROM_EMAIL=noreply@rivercityroofingsolutions.com
```

---

## Security Best Practices

### 1. Never Expose Secrets

- **DO NOT** use `NEXT_PUBLIC_` prefix for sensitive data
- Admin passwords, API keys, and tokens should be server-side only

### 2. Use Strong Passwords

Generate secure values:
```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate API keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Rotate Credentials

- Change `ADMIN_PASSWORD` regularly
- Rotate API keys if compromised
- Regenerate JWT_SECRET if sessions need to be invalidated

### 4. Environment Separation

Use different credentials for:
- Development (local)
- Preview (staging)
- Production

### 5. Monitor Access

- Review JobNimbus API usage
- Check Google Sheets sharing settings
- Monitor authentication logs

---

## Troubleshooting

### "Google Sheets credentials not configured"

1. Verify all three values are set:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_SHEETS_ID`
2. Check the private key format (single line with `\n`)
3. Ensure the sheet is shared with the service account

### "JobNimbus API error"

1. Verify the API key is correct
2. Check if the key has expired
3. Ensure `JOBNIMBUS_API_URL` is set correctly

### "Form submission failed"

1. Check the Google Apps Script deployment
2. Verify `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT` is correct
3. Ensure the script is deployed as "Anyone" access

### "Admin login not working"

1. Verify `ADMIN_PASSWORD` is set (not `NEXT_PUBLIC_ADMIN_PASSWORD`)
2. Check that `JWT_SECRET` is set
3. Clear browser cookies and try again

### "GroupMe notifications not sending"

1. Verify `GROUPME_ENABLED=true`
2. Check the bot ID is correct
3. Ensure the bot is added to the correct group

### Development vs Production

If something works locally but not in production:
1. Check Vercel environment variables are set
2. Verify all required variables are added for Production
3. Redeploy after adding new variables

---

## Support

For additional help:
- Check existing documentation in `/docs`
- Review error logs in Vercel dashboard
- Contact the development team
