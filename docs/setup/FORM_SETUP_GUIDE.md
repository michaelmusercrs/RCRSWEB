# Contact Form Setup Guide
## Google Sheets + Email Integration for River City Roofing

**Time Required:** 30 minutes
**Difficulty:** Easy
**What You'll Get:**
- Form submissions saved to Google Sheet
- Automatic confirmation emails to customers
- Instant notifications to office@rcrsal.com
- Complete lead tracking system

---

## 📋 Overview

When a customer submits your contact form:

```
Website Form
    ↓
Your Next.js API validates data
    ↓
Forwards to Google Apps Script
    ↓
Google Apps Script:
  • Saves to Google Sheet
  • Emails confirmation to customer
  • Emails notification to company
    ↓
Customer sees "Thank You" page
```

---

## 🚀 Quick Start (30 Minutes)

### Step 1: Create Google Sheet (5 min)

1. **Go to Google Sheets:**
   - Visit: https://sheets.google.com
   - Click "Blank" to create new spreadsheet

2. **Name your sheet:**
   - Click "Untitled spreadsheet" at top
   - Rename to: `River City Roofing - Inspection Requests`

3. **Add column headers in Row 1:**
   ```
   A1: Timestamp
   B1: Name
   C1: Email
   D1: Phone
   E1: Subject
   F1: Message
   G1: Preferred Inspector
   ```

4. **Format the header row (optional but nice):**
   - Select row 1
   - Make it bold (Ctrl+B)
   - Add background color (gray or blue)
   - Freeze it: View → Freeze → 1 row

5. **Rename the sheet tab:**
   - At bottom, double-click "Sheet1"
   - Rename to: `Responses`
   - ⚠️ **Important:** Must be exactly "Responses"

6. **Get your Sheet ID:**
   - Look at the URL in your browser
   - Format: `https://docs.google.com/spreadsheets/d/XXXXX/edit`
   - Copy the `XXXXX` part (the long random string)
   - Save this - you'll need it in Step 2

---

### Step 2: Create Google Apps Script (10 min)

1. **Open Apps Script Editor:**
   - Visit: https://script.google.com
   - Click **"New project"**

2. **Name your project:**
   - Click "Untitled project" at top
   - Rename to: `River City Roofing - Form Processor`

3. **Copy the script code:**
   - In your project, open: `docs/setup/google-apps-script.js`
   - Copy ALL the code
   - Back in Apps Script, delete everything in `Code.gs`
   - Paste the copied code

4. **Update the Sheet ID:**
   - Find line 19: `const SHEET_ID = 'YOUR_SHEET_ID_HERE';`
   - Replace `YOUR_SHEET_ID_HERE` with your Sheet ID from Step 1
   - Example: `const SHEET_ID = '1abc_defGHI-JKLmnoPQRstUVWxyz123456789';`

5. **Verify company email (optional):**
   - Find line 22: `const COMPANY_EMAIL = 'office@rcrsal.com';`
   - Change if you want notifications sent elsewhere

6. **Save the script:**
   - Click disk icon or press Ctrl+S
   - Project is now saved

---

### Step 3: Test the Script (5 min)

Before deploying, let's test it works:

1. **Update test email:**
   - Scroll to bottom of script
   - Find the `testFormSubmission` function
   - Change `'your-email@example.com'` to YOUR email address

2. **Run the test:**
   - At top, select function dropdown
   - Choose `testFormSubmission`
   - Click ▶ Run button

3. **Authorize the script:**
   - First time: Google asks for permissions
   - Click "Review permissions"
   - Choose your Google account
   - Click "Advanced" → "Go to River City Roofing - Form Processor (unsafe)"
   - Click "Allow"
   - ⚠️ This is safe - you're authorizing your own script

4. **Check results:**
   - ✅ Check your email - should have confirmation
   - ✅ Check office@rcrsal.com - should have notification
   - ✅ Check your Google Sheet - should have new row
   - ✅ Check Executions tab - should show "Completed"

If all worked, continue to Step 4!

---

### Step 4: Deploy as Web App (5 min)

1. **Start deployment:**
   - Click **"Deploy"** button (top right)
   - Select **"New deployment"**

2. **Configure deployment:**
   - Click gear icon next to "Select type"
   - Choose **"Web app"**

3. **Set permissions:**
   - **Description:** `Production endpoint`
   - **Execute as:** Me (your email)
   - **Who has access:** **Anyone**
   - ⚠️ **Must select "Anyone"** or your website can't access it

4. **Deploy:**
   - Click **"Deploy"**
   - Wait for processing

5. **Copy your Web App URL:**
   - You'll see: `Web app URL: https://script.google.com/macros/s/AEnB2Uq.../exec`
   - Click **"Copy"** button
   - Save this URL - you need it in Step 5

Example URL format:
```
https://script.google.com/macros/s/AEnB2UqrjhQw1234567890abcdefgh_xyz123/exec
```

---

### Step 5: Configure Your Website (5 min)

Now connect your website to Google Apps Script:

1. **Create environment file:**
   ```bash
   # In your project root
   touch .env.local
   ```

2. **Add your Google Script URL:**
   ```bash
   # Open .env.local and add:
   NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
   Replace `YOUR_DEPLOYMENT_ID` with your actual URL from Step 4

3. **Restart your development server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

4. **Configure Vercel (if deployed):**
   - Go to: https://vercel.com/dashboard
   - Select your project
   - Go to: **Settings** → **Environment Variables**
   - Click **"Add New"**
   - Name: `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT`
   - Value: Your Google Script URL
   - Environments: Check all three (Production, Preview, Development)
   - Click **"Save"**
   - Redeploy: **Deployments** → Find latest → **"Redeploy"**

---

### Step 6: Test Everything (5 min)

**Test locally:**

1. Open http://localhost:3000/contact
2. Fill out the form:
   - Name: Your name
   - Email: Your email
   - Phone: 256-555-1234
   - Subject: Test Submission
   - Message: Testing the contact form
   - Inspector: First Available
3. Click "Submit Request"
4. Should redirect to thank you page

**Verify:**
- ✅ Check your email inbox (and spam) for confirmation
- ✅ Check office@rcrsal.com for notification
- ✅ Check Google Sheet for new row
- ✅ All data should match what you entered

**Test on production:**
1. Go to your live site: yourdomain.com/contact
2. Submit another test
3. Verify same checks pass

---

## ✅ Verification Checklist

Before considering setup complete:

- [ ] Google Sheet created with "Responses" tab
- [ ] Sheet has 7 column headers (Timestamp through Preferred Inspector)
- [ ] Google Apps Script created and code copied
- [ ] Sheet ID updated in script
- [ ] Test function ran successfully
- [ ] Script deployed as web app with "Anyone" access
- [ ] Web app URL copied
- [ ] .env.local created with NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT
- [ ] Local dev server restarted
- [ ] Vercel environment variable added (if using Vercel)
- [ ] Local test form submitted successfully
- [ ] Emails received (both confirmation and notification)
- [ ] Data appeared in Google Sheet
- [ ] Production test (if deployed) works

---

## 🎨 Customizing Email Templates

### User Confirmation Email

In `google-apps-script.js`, find the `sendUserConfirmation` function:

```javascript
const body = `Hi ${params.name},

Thank you for requesting a free roofing inspection...
```

Customize as needed. Ideas:
- Add inspection checklist
- Include what to expect
- Add team member bios
- Include recent project photos
- Add FAQ section

### Company Notification Email

In `sendCompanyNotification` function:

```javascript
const subject = `🔔 New Inspection Request from ${params.name}`;
```

Customize:
- Change emoji
- Add priority flags
- Include automated assignment logic
- Add Slack/SMS integration

After editing, **redeploy the script**:
1. Deploy → Manage deployments
2. Click ✏️ Edit icon
3. Version: New version
4. Deploy

---

## 🆘 Troubleshooting

### Problem: Form submits but nothing happens

**Symptoms:** Form disappears, no redirect, no emails

**Solutions:**
1. Open browser console (F12 → Console tab)
2. Look for error messages
3. Common issues:
   - ❌ Environment variable not set → Check .env.local
   - ❌ Wrong Google Script URL → Verify URL format
   - ❌ Dev server not restarted → Run `npm run dev` again
   - ❌ CORS issue → Check Apps Script has "Anyone" access

### Problem: Emails not arriving

**Symptoms:** Form works, but no emails

**Solutions:**
1. **Check spam folder** (90% of the time it's here!)
2. Check email address is correct in form
3. Go to Apps Script → Executions tab
4. Find your submission → Click to see errors
5. Common issues:
   - ❌ Gmail not authorized → Re-run test function
   - ❌ Email quota exceeded → Google limits to 100/day
   - ❌ Invalid email format → Check validation

### Problem: Data not in Google Sheet

**Symptoms:** Emails send, but no sheet row

**Solutions:**
1. Verify Sheet ID is correct in script
2. Verify sheet tab is named exactly "Responses"
3. Check Apps Script → Executions for errors
4. Try running test function manually
5. Check sheet permissions (you must be owner)

### Problem: "Authorization Required" error

**Symptoms:** Script shows red auth error

**Solutions:**
1. Go to script.google.com
2. Open your project
3. Deploy → Manage deployments
4. Click trash icon to delete deployment
5. Create new deployment (Step 4 again)
6. Make sure "Who has access" is "Anyone"
7. Copy new URL and update .env.local

### Problem: Can't find Sheet ID

**Symptoms:** URL doesn't look right

**Solutions:**
1. Open your Google Sheet
2. Look at URL in address bar
3. Format: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0`
4. Copy everything between `/d/` and `/edit`
5. That long random string is your Sheet ID

Example:
```
URL: https://docs.google.com/spreadsheets/d/1abc_xyz-123/edit
Sheet ID: 1abc_xyz-123
```

### Problem: Form works locally but not on Vercel

**Symptoms:** localhost works, production doesn't

**Solutions:**
1. Verify environment variable is set in Vercel
2. Go to Vercel → Settings → Environment Variables
3. Check variable name is exactly: `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT`
4. Check all environments are selected
5. Redeploy after adding variable
6. Wait 1-2 minutes for deployment to complete

---

## 📊 Lead Management

### Daily Workflow

**Every morning:**
1. Open your Google Sheet
2. Check for new leads (sorted by Timestamp)
3. Call each lead within 24 hours
4. Mark as contacted (add column if needed)

**Best practices:**
- Response within 1 hour = 7x higher conversion
- Follow up 3 times before giving up
- Track inspector assignments
- Add "Status" column for tracking

### Enhanced Tracking (Optional)

Add these columns after column G:

- **H: Status** (New / Called / Scheduled / Complete / No Answer)
- **I: Date Called**
- **J: Inspection Date**
- **K: Inspector Assigned**
- **L: Quote Amount**
- **M: Notes**

Then use formulas:
```
New Leads Today: =COUNTIF(A:A,">="&TODAY())
Total This Week: =COUNTIF(A:A,">="&TODAY()-7)
Conversion Rate: =COUNTIF(H:H,"Complete")/COUNTA(A:A)
```

### Backup Your Data

**Weekly backup:**
1. File → Download → Excel (.xlsx)
2. Save to backup folder
3. Name with date: `Leads_2025-11-13.xlsx`

**Monthly backup:**
1. Make a copy: File → Make a copy
2. Name: `River City Leads Archive - November 2025`
3. Move to archive folder

---

## 🔐 Security & Privacy

### What's Safe

✅ Google Script URL is public (must be for website to access)
✅ Form data is validated before processing
✅ Google Sheet is private to your account
✅ Emails sent through your Gmail account
✅ HTTPS encryption for all data transfer

### Best Practices

- Never share your Sheet ID publicly
- Don't commit .env.local to Git
- Keep Google account password secure
- Enable 2-factor authentication on Google
- Regularly review sheet permissions

### Data Retention

Customer data includes:
- Names, emails, phone numbers
- Messages and preferences
- Timestamps

Per privacy laws:
- Keep data only as long as needed
- Delete after customer relationship ends
- Respond to data deletion requests
- Have privacy policy on website

---

## 📈 Analytics & Reporting

### Track These Metrics

**Lead Volume:**
- Submissions per day/week/month
- Peak submission times
- Source tracking (add URL parameter)

**Response Metrics:**
- Time to first contact
- Conversion rate (lead → customer)
- Inspector preferences
- Service type distribution

**Performance:**
- Form completion rate
- Error rate
- Email delivery rate

### Export Reports

**Monthly report:**
```
1. Open Google Sheet
2. Select all data
3. File → Download → PDF
4. Share with team
```

**Data analysis:**
```
1. File → Download → Excel
2. Open in Excel or Google Sheets
3. Create pivot tables
4. Generate charts
```

---

## 🔄 Updating Your Setup

### Update Email Templates

1. Edit code in Apps Script
2. Save changes
3. Deploy → Manage deployments
4. Click ✏️ edit
5. New version
6. Deploy
7. Test with form submission

### Change Form Fields

If you add/remove form fields:

1. Update `ContactForm.tsx`
2. Update `route.ts` API handler
3. Update Google Apps Script code
4. Add/remove columns in Google Sheet
5. Test thoroughly

### Switch to Different Sheet

1. Create new sheet
2. Get new Sheet ID
3. Update in Apps Script
4. Redeploy
5. Test

---

## 🎉 You're Done!

Your contact form system is now:

✅ Saving every lead to Google Sheet
✅ Sending confirmation emails automatically
✅ Notifying your team instantly
✅ Ready for production use

**Next Steps:**
- Monitor first few submissions
- Customize email templates
- Set up lead tracking columns
- Train team on follow-up process

**Need Help?**
- Check browser console for errors
- Check Apps Script Executions tab
- Review this guide's troubleshooting section
- Test locally before blaming production

---

## 📞 Quick Reference

**Important URLs:**
- Google Sheet: https://sheets.google.com
- Apps Script: https://script.google.com
- Vercel Dashboard: https://vercel.com/dashboard

**Files to Know:**
- Form component: `components/ContactForm.tsx`
- API route: `app/api/contact/route.ts`
- Apps Script: `docs/setup/google-apps-script.js`
- Environment: `.env.local`

**Common Commands:**
```bash
# Restart dev server
npm run dev

# Check environment variables
cat .env.local

# Deploy to Vercel
git push

# View logs
vercel logs
```

---

**Setup Complete! 🎊**

Your form is now collecting leads and helping grow your business.
