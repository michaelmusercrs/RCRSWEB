# 🚀 Michael's Quick Start Guide
## Contact Form Setup - Your Personalized Instructions

**Your Details:**
- ✅ Sheet ID: `1crBX4awO6Va5Fv2X7eN29mXvX3CKss16NxlRaf6jLe8`
- ✅ Email: `michaelmuse@rivercityroofingsolutions.com`
- ✅ Customized script: `google-apps-script-READY-TO-DEPLOY.js`

**Total Time: 20 minutes** (everything is pre-configured for you!)

---

## ⚡ Super Quick Setup (4 Steps)

### Step 1: Check Your Google Sheet (2 min)

1. **Open your Google Sheet:**
   ```
   https://docs.google.com/spreadsheets/d/1crBX4awO6Va5Fv2X7eN29mXvX3CKss16NxlRaf6jLe8/edit
   ```

2. **Make sure it has a tab called "Responses"**
   - Look at the bottom tabs
   - If you see "Sheet1" or something else, rename it to exactly: `Responses`

3. **Add column headers in Row 1 (if not already there):**
   ```
   A1: Timestamp
   B1: Name
   C1: Email
   D1: Phone
   E1: Subject
   F1: Message
   G1: Preferred Inspector
   ```

**Pro tip:** You can run the `initializeSheet()` function in the Apps Script to do this automatically (see Step 2).

---

### Step 2: Deploy Google Apps Script (10 min)

1. **Go to Apps Script:**
   ```
   https://script.google.com
   ```

2. **Click "New project"**

3. **Name it:** `River City Roofing - Form Handler`

4. **Copy the customized script:**
   - Open: `docs/setup/google-apps-script-READY-TO-DEPLOY.js`
   - Select ALL (Ctrl+A)
   - Copy (Ctrl+C)

5. **Paste into Apps Script:**
   - Delete everything in `Code.gs`
   - Paste your copied code (Ctrl+V)
   - Save (Ctrl+S or disk icon)

6. **✨ OPTIONAL: Initialize your sheet automatically**
   - In function dropdown (top), select: `initializeSheet`
   - Click ▶ Run
   - This will create headers and format your sheet!
   - (First time will ask for permissions - click Allow)

7. **Test it works:**
   - In function dropdown, select: `testFormSubmission`
   - Click ▶ Run
   - **First time only:** Click "Review permissions" → Choose your account → "Advanced" → "Go to River City Roofing" → "Allow"
   - Check results:
     - ✅ Check michaelmuse@rivercityroofingsolutions.com for 2 emails
     - ✅ Check office@rcrsal.com for 1 email
     - ✅ Check Google Sheet for new test row

8. **Deploy as Web App:**
   - Click **"Deploy"** button (top right)
   - Select **"New deployment"**
   - Click gear icon → Choose **"Web app"**
   - Settings:
     - **Execute as:** Me (michaelmuse@rivercityroofingsolutions.com)
     - **Who has access:** **Anyone** ⚠️ Must be "Anyone"!
   - Click **"Deploy"**

9. **Copy your deployment URL:**
   - You'll see: `Web app URL: https://script.google.com/macros/s/AEnB2Uq.../exec`
   - Click **"Copy"**
   - **Save this URL** - you need it in Step 3!

---

### Step 3: Add to Your Website (5 min)

**Local Development:**

1. **Create `.env.local` file in project root:**
   ```bash
   touch .env.local
   ```

2. **Add your Google Script URL:**
   ```bash
   # Open .env.local and add this line:
   NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT=YOUR_URL_FROM_STEP_2
   ```

   Replace `YOUR_URL_FROM_STEP_2` with the actual URL you copied.

   Example:
   ```bash
   NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT=https://script.google.com/macros/s/AEnB2UqrjhQw1234567890abcdefgh/exec
   ```

3. **Restart dev server:**
   ```bash
   npm run dev
   ```

**For Vercel (Production):**

1. **Go to Vercel dashboard:**
   ```
   https://vercel.com/dashboard
   ```

2. **Select your River City Roofing project**

3. **Go to:** Settings → Environment Variables

4. **Add new variable:**
   - Name: `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT`
   - Value: Your deployment URL from Step 2
   - Environments: ✅ Check all three (Production, Preview, Development)
   - Click "Save"

5. **Redeploy:**
   - Go to "Deployments" tab
   - Find latest deployment
   - Click "..." menu → "Redeploy"

---

### Step 4: Test Everything (3 min)

1. **Test locally:**
   ```
   http://localhost:3000/contact
   ```

2. **Fill out the form:**
   - Name: Michael Test
   - Email: michaelmuse@rivercityroofingsolutions.com
   - Phone: 256-555-1234
   - Subject: Testing Contact Form
   - Message: This is a test to verify everything works!
   - Inspector: First Available

3. **Click "Submit Request"**

4. **Verify:**
   - ✅ Redirected to thank you page?
   - ✅ Check your email (both personal and office@rcrsal.com)
   - ✅ Check Google Sheet for new row
   - ✅ All data matches what you entered?

5. **Test on production (if deployed):**
   - Go to your live site
   - Submit another test
   - Verify same checks pass

---

## ✅ Success Checklist

- [ ] Google Sheet has "Responses" tab with headers
- [ ] Apps Script code pasted and saved
- [ ] Test function ran successfully (emails + sheet row)
- [ ] Script deployed as web app with "Anyone" access
- [ ] Deployment URL copied
- [ ] `.env.local` created with URL
- [ ] Dev server restarted
- [ ] Local test form submitted successfully
- [ ] Emails received at both addresses
- [ ] Data in Google Sheet
- [ ] Vercel environment variable added (if using Vercel)
- [ ] Production test passed (if deployed)

---

## 🎉 What You Have Now

When customers submit your contact form:

1. ✅ **Saved to Google Sheet** - Automatic lead tracking
   - View: https://docs.google.com/spreadsheets/d/1crBX4awO6Va5Fv2X7eN29mXvX3CKss16NxlRaf6jLe8/edit

2. ✅ **Customer gets confirmation email**
   - Professional, branded message
   - What to expect next
   - Your contact info

3. ✅ **You get notified at 2 emails:**
   - michaelmuse@rivercityroofingsolutions.com
   - office@rcrsal.com

4. ✅ **Customer sees thank you page**
   - Confirms submission
   - Shows next steps

---

## 🛠️ What's Different About Your Setup

**Pre-configured for you:**
- ✅ Sheet ID already set: `1crBX4awO6Va5Fv2X7eN29mXvX3CKss16NxlRaf6jLe8`
- ✅ Email already set: `michaelmuse@rivercityroofingsolutions.com`
- ✅ Office email added: `office@rcrsal.com`
- ✅ Both emails get notifications
- ✅ Professional branded messages
- ✅ Helper functions included (initializeSheet, testFormSubmission)

**You just need to:**
1. Copy the script
2. Deploy it
3. Add URL to .env.local
4. Test

That's it!

---

## 🆘 Troubleshooting

### "Sheet not found" error

**Solution:**
1. Make sure sheet tab is named exactly: `Responses` (capital R)
2. Or run the `initializeSheet()` function to create it automatically

### No emails arriving

**Solution:**
1. Check spam folder (most common!)
2. Go to script.google.com → Executions tab
3. Find your submission → Look for errors
4. Make sure you authorized Gmail access

### Form submits but nothing happens

**Solution:**
1. Check browser console (F12 → Console)
2. Verify `.env.local` has the correct URL
3. Restart dev server: `npm run dev`
4. Check URL format has `/exec` at the end

### "Authorization Required"

**Solution:**
1. Run `testFormSubmission()` function
2. Click "Review permissions"
3. Choose michaelmuse@rivercityroofingsolutions.com account
4. Click "Advanced" → "Go to River City Roofing"
5. Click "Allow"

---

## 📧 Email Preview

**Customer receives:**
```
Hi [Name],

Thank you for requesting a free roofing inspection from River City Roofing Solutions!

We've received your request and will contact you shortly at [phone/email]...

[Their request details]

WHAT HAPPENS NEXT?
1. We'll review your request (usually within 1 hour)
2. We'll call you to schedule...
3. Our inspector will visit...
4. You'll receive a free assessment

[Contact info]
```

**You receive (at both emails):**
```
🔔 NEW LEAD: [Name] - [Subject]

NEW INSPECTION REQUEST RECEIVED
━━━━━━━━━━━━━━━━━━━━━━━━

📅 Submitted: [Date & Time]

👤 CONTACT INFORMATION:
Name:     [Name]
Email:    [Email]
Phone:    [Phone]

📋 REQUEST DETAILS:
Subject:  [Subject]
Inspector: [Preferred]

💬 MESSAGE:
[Their message]

⚡ NEXT STEPS:
1. ✅ Data saved to Sheet
2. 📞 Call customer
3. 📅 Schedule inspection
4. ✉️ Follow up within 24 hours

[Links to Sheet and quick actions]
```

---

## 🎨 Customization (Optional)

Want to customize the emails?

1. Open `google-apps-script-READY-TO-DEPLOY.js`
2. Find `sendUserConfirmation` function (line ~130)
3. Edit the email text
4. Find `sendCompanyNotification` function (line ~180)
5. Edit notification format
6. Save and redeploy:
   - Deploy → Manage deployments
   - Click ✏️ Edit
   - New version
   - Deploy

---

## 📊 Lead Management Tips

**Daily:**
- Check Google Sheet morning and evening
- Respond within 1 hour for 7x higher conversion
- Mark status (add column: New/Called/Scheduled/Complete)

**Weekly:**
- Follow up on pending leads
- Export data for reporting
- Review conversion rates

**Add tracking columns (optional):**
- H: Status
- I: Date Called
- J: Inspection Date
- K: Inspector Assigned
- L: Quote Amount
- M: Notes

---

## 🔗 Your Quick Links

**Google Sheet:**
```
https://docs.google.com/spreadsheets/d/1crBX4awO6Va5Fv2X7eN29mXvX3CKss16NxlRaf6jLe8/edit
```

**Apps Script:**
```
https://script.google.com
```

**Vercel Dashboard:**
```
https://vercel.com/dashboard
```

**Local Contact Form:**
```
http://localhost:3000/contact
```

---

## 📱 Next Steps

After setup works:

1. **Test from mobile device**
   - Submit form from phone
   - Check emails display well
   - Verify Sheet updates

2. **Train team**
   - Show them Google Sheet
   - Set up follow-up process
   - Define response time goals

3. **Monitor performance**
   - Track response times
   - Measure conversion rates
   - Optimize follow-up

4. **Optional enhancements**
   - Add SMS notifications (Twilio)
   - Connect to Slack
   - Set up automated follow-ups
   - Create dashboard

---

## ✨ You're All Set!

Everything is pre-configured for you. Just follow the 4 steps above and you'll be collecting leads in 20 minutes!

**Your customized file:** `google-apps-script-READY-TO-DEPLOY.js`

**Questions?** Check the full guide: `FORM_SETUP_GUIDE.md`

---

**Let's get those leads! 🚀**

_Last updated: 2025-11-13 for Michael Muse_
