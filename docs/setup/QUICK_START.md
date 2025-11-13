# 🚀 Quick Start: Contact Form Setup

**Total Time: 30 minutes**

Get your contact form working with Google Sheets + Email in 6 simple steps.

---

## ✅ Checklist

Follow these steps in order. Check off each one as you complete it.

### □ Step 1: Create Google Sheet (5 min)

1. Go to https://sheets.google.com
2. Create blank spreadsheet
3. Name it: `River City Roofing - Inspection Requests`
4. Add headers in row 1:
   - A1: Timestamp
   - B1: Name
   - C1: Email
   - D1: Phone
   - E1: Subject
   - F1: Message
   - G1: Preferred Inspector
5. Rename sheet tab to: `Responses`
6. Copy Sheet ID from URL (the long code between `/d/` and `/edit`)
7. **Save Sheet ID:** `_______________________________`

---

### □ Step 2: Create Google Apps Script (10 min)

1. Go to https://script.google.com
2. Click "New project"
3. Name it: `River City Roofing - Form Processor`
4. Open file: `docs/setup/google-apps-script.js` in your project
5. Copy ALL the code
6. Paste into Apps Script (delete existing code first)
7. Find line 19: `const SHEET_ID = 'YOUR_SHEET_ID_HERE';`
8. Replace `YOUR_SHEET_ID_HERE` with your Sheet ID from Step 1
9. Save (Ctrl+S)

---

### □ Step 3: Test the Script (5 min)

1. In Apps Script, find `testFormSubmission` function
2. Change email to your email address
3. Select `testFormSubmission` from dropdown
4. Click ▶ Run
5. Authorize when prompted (click "Allow")
6. Check results:
   - ✅ Email in your inbox?
   - ✅ Email at office@rcrsal.com?
   - ✅ New row in Google Sheet?

If all 3 work, continue!

---

### □ Step 4: Deploy as Web App (5 min)

1. Click "Deploy" → "New deployment"
2. Click gear icon → Select "Web app"
3. Configure:
   - Execute as: Me
   - Who has access: **Anyone** ⚠️ (important!)
4. Click "Deploy"
5. Copy Web App URL
6. **Save URL:** `_______________________________`

---

### □ Step 5: Add to Your Website (3 min)

**Local Development:**
```bash
# In your project root
touch .env.local
```

Open `.env.local` and add:
```
NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT=YOUR_URL_FROM_STEP_4
```

Restart dev server:
```bash
npm run dev
```

**On Vercel:**
1. Go to vercel.com → Your project
2. Settings → Environment Variables
3. Add new:
   - Name: `NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT`
   - Value: Your URL from Step 4
   - Check all 3 environments
4. Deployments → Redeploy

---

### □ Step 6: Test Everything (2 min)

1. Open http://localhost:3000/contact
2. Fill out form with your info
3. Submit
4. Check:
   - ✅ Redirected to thank you page?
   - ✅ Email received?
   - ✅ Office email received?
   - ✅ Data in Google Sheet?

---

## 🎉 Done!

If all checks passed, your form is working!

**What Happens Now:**

When customers submit the contact form:
1. ✅ Data saved to Google Sheet
2. ✅ Customer gets confirmation email
3. ✅ You get notification at office@rcrsal.com
4. ✅ Customer sees thank you page

---

## 🆘 Having Issues?

### Form not submitting?
- Check browser console (F12) for errors
- Verify environment variable is set
- Restart dev server

### No emails arriving?
- Check spam folder (seriously!)
- Verify email addresses are correct
- Check Apps Script → Executions tab for errors

### Not saving to Sheet?
- Verify Sheet ID is correct
- Check sheet tab is named "Responses"
- Run test function again

### Still stuck?
Read the full guide: `docs/setup/FORM_SETUP_GUIDE.md`

---

## 📁 Files You Created

- ✅ Google Sheet: https://sheets.google.com
- ✅ Google Apps Script: https://script.google.com
- ✅ Environment file: `.env.local`

## 🔧 Files We Modified

- ✅ API Route: `app/api/contact/route.ts` (now forwards to Google Script)

---

## 🎯 Next Steps

Now that forms work:

1. **Customize email templates**
   - Edit `google-apps-script.js`
   - Update user confirmation message
   - Add your branding

2. **Set up lead tracking**
   - Add "Status" column to Sheet
   - Track: New / Called / Scheduled / Complete
   - Add follow-up dates

3. **Test on mobile**
   - Submit form from phone
   - Verify emails display nicely
   - Check Sheet formatting

4. **Train your team**
   - Show them Google Sheet
   - Set up notification forwarding
   - Create follow-up process

---

## 📞 Support

**Documentation:**
- Full guide: `docs/setup/FORM_SETUP_GUIDE.md`
- Script file: `docs/setup/google-apps-script.js`

**Check Logs:**
```bash
# Local development
npm run dev
# Watch console for errors

# Google Apps Script
# Go to script.google.com → Executions tab
```

**Common Commands:**
```bash
# Restart server
npm run dev

# Check environment variables
cat .env.local

# Deploy to Vercel
git add .
git commit -m "Configure form submission"
git push
```

---

**Ready to collect leads! 🚀**
