# Contact Form Setup Documentation

Complete documentation for setting up Google Sheets + Email integration for your River City Roofing contact form.

---

## 📚 Documentation Files

### 🚀 **QUICK_START.md** - Start Here!
**Read this first** - 30-minute guided setup with checklists.

Perfect for: Getting the form working ASAP.

### 📖 **FORM_SETUP_GUIDE.md** - Complete Reference
Full detailed guide with troubleshooting, customization, and best practices.

Perfect for: Understanding how everything works, troubleshooting issues.

### 💻 **google-apps-script.js** - Ready-to-Deploy Code
Copy-paste ready Google Apps Script code with inline documentation.

Perfect for: Deploying to script.google.com.

---

## 🎯 What This Setup Does

When a customer submits your contact form:

1. **Form Validation** - Your Next.js app validates the data
2. **Forward to Google** - Data sent to Google Apps Script endpoint
3. **Save to Sheet** - Automatically saved to Google Sheet for tracking
4. **Email Customer** - Sends professional confirmation email
5. **Email Company** - Notifies office@rcrsal.com with lead details
6. **Redirect** - Customer sees thank you page

All automatic. No manual work required.

---

## ⚡ Quick Setup Path

**Just want it working?** Follow this:

1. Read `QUICK_START.md`
2. Create Google Sheet (5 min)
3. Deploy `google-apps-script.js` (10 min)
4. Add environment variable (3 min)
5. Test (2 min)
6. Done! ✅

**Total time: 20-30 minutes**

---

## 📋 What You Need

Before starting:

- [ ] Google account (free)
- [ ] Access to this River City Roofing project
- [ ] Access to Vercel (if deployed)
- [ ] 30 minutes of focused time

No coding required. Just copy-paste and configure.

---

## 🗂️ Files Included

### In This Directory (`docs/setup/`)

```
docs/setup/
├── README.md                    ← You are here
├── QUICK_START.md              ← Start here
├── FORM_SETUP_GUIDE.md         ← Complete reference
└── google-apps-script.js       ← Script to deploy
```

### In Project Root

```
.env.local.example              ← Template for environment variables
.env.local                      ← Your actual config (create this)
```

### Modified Files

```
app/api/contact/route.ts        ← Updated to forward to Google Script
```

---

## 🔑 Key Concepts

### Environment Variables

Your site needs to know where to send form data:

```bash
# In .env.local
NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT=https://script.google.com/macros/s/.../exec
```

This URL comes from deploying your Google Apps Script.

### Google Apps Script

A free service from Google that:
- Receives form submissions
- Saves to Google Sheets
- Sends emails via Gmail
- Runs in Google's cloud

No server to manage. No hosting costs.

### Google Sheet

Your lead database:
- Stores all form submissions
- Searchable and sortable
- Export to Excel anytime
- Share with team members

---

## 🎨 Customization Options

After basic setup works:

### Email Templates

Customize messages in `google-apps-script.js`:

**User Confirmation:**
- Add your branding
- Include next steps
- Add FAQs
- Link to resources

**Company Notification:**
- Change format
- Add priority flags
- Include assignment logic
- Add Slack webhooks

### Form Fields

To add/change form fields:
1. Update `components/ContactForm.tsx`
2. Update `app/api/contact/route.ts`
3. Update `google-apps-script.js`
4. Add columns to Google Sheet
5. Redeploy script

### Tracking Columns

Add to your Google Sheet:
- Status (New, Called, Scheduled, Complete)
- Date Called
- Inspector Assigned
- Quote Amount
- Notes
- Follow-up Date

---

## 🆘 Troubleshooting

**Quick Fixes:**

| Problem | Solution |
|---------|----------|
| Form not submitting | Check browser console (F12) |
| No emails | Check spam folder first! |
| Not in Google Sheet | Verify Sheet ID in script |
| "Authorization Required" | Redeploy script, select "Anyone" |

**Still stuck?**
See detailed troubleshooting in `FORM_SETUP_GUIDE.md`.

---

## 🔐 Security

Your setup is secure:

✅ **Data encrypted** - HTTPS for all transfers
✅ **Sheet is private** - Only you can access
✅ **No exposed credentials** - Environment variables
✅ **Validated inputs** - Form data checked before processing

The Google Script URL is public (it must be), but:
- It only accepts form submissions
- No sensitive data in URL
- Rate limited by Google
- Monitored in Executions tab

---

## 📊 Lead Management

**Daily:**
- Check Google Sheet for new leads
- Call within 24 hours (7x higher conversion)
- Update status column

**Weekly:**
- Follow up on pending
- Review conversion rates
- Export data for reporting

**Monthly:**
- Backup Google Sheet
- Review email templates
- Update form if needed

---

## 🔄 Maintenance

### Updating Email Templates

1. Edit `google-apps-script.js`
2. Save changes
3. Deploy → Manage deployments → Edit → New version
4. Test with form submission

### Changing Google Sheet

1. Create new sheet
2. Update Sheet ID in script
3. Redeploy
4. Test

### Adding Features

Want to add:
- SMS notifications? → Add Twilio
- Slack alerts? → Add webhook
- CRM integration? → Add Zapier
- Auto-responses? → Edit script

All possible with Google Apps Script!

---

## 📈 Analytics

Track these metrics:

**Form Performance:**
- Submissions per day/week/month
- Completion rate
- Error rate
- Peak times

**Lead Quality:**
- Conversion rate (lead → customer)
- Time to first contact
- Inspector preferences
- Service type distribution

**Response Times:**
- Average time to contact
- Time to schedule
- Time to close

Add formulas in Google Sheet for automatic calculations.

---

## 🎓 Learning Resources

**Google Apps Script:**
- Official Docs: https://developers.google.com/apps-script
- Examples: https://github.com/googleworkspace/apps-script-samples

**Google Sheets:**
- Function List: https://support.google.com/docs/table/25273
- Templates: https://docs.google.com/spreadsheets/u/0/

**Next.js API Routes:**
- Docs: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

---

## 🚀 Deployment Checklist

Before going live:

### Development
- [ ] Local form submits successfully
- [ ] Emails arrive in inbox
- [ ] Data appears in Google Sheet
- [ ] Thank you page redirects work
- [ ] Error handling tested

### Production
- [ ] Environment variables set in Vercel
- [ ] Domain configured correctly
- [ ] SSL certificate active
- [ ] Forms tested on live site
- [ ] Mobile tested

### Post-Launch
- [ ] Team trained on Google Sheet
- [ ] Notification emails forwarded correctly
- [ ] Lead response process documented
- [ ] Backup schedule established
- [ ] Analytics tracking configured

---

## 📞 Support Workflow

**When something breaks:**

1. **Check browser console** (F12)
   - Look for red errors
   - Note exact error message

2. **Check Apps Script Executions**
   - Go to script.google.com
   - Click Executions tab
   - Find failed execution
   - Read error details

3. **Check environment variables**
   - Verify URL is set
   - Check for typos
   - Restart server

4. **Read troubleshooting guide**
   - See `FORM_SETUP_GUIDE.md`
   - Search for your error
   - Follow solutions

5. **Test in isolation**
   - Run Apps Script test function
   - Submit form locally
   - Check each step

---

## ✨ Success Criteria

You know it's working when:

✅ Form submits without errors
✅ User receives confirmation email within 1 minute
✅ Company receives notification immediately
✅ Data appears in Google Sheet correctly
✅ Thank you page displays
✅ All fields transfer accurately
✅ Mobile works perfectly
✅ Production matches localhost

---

## 🎉 You're Ready!

Everything you need is in this directory.

**Start with:** `QUICK_START.md`

**Questions?** Check `FORM_SETUP_GUIDE.md`

**Need code?** Use `google-apps-script.js`

---

**Let's collect some leads! 🚀**

---

## 📝 Version History

- **v1.0** (2025-11-13) - Initial setup documentation
  - Google Sheets integration
  - Email notifications
  - Complete troubleshooting guide
  - Quick start checklist

---

## 📧 Questions?

Read the guides first - 90% of questions are answered there!

Still stuck? Check:
1. Browser console errors
2. Apps Script execution logs
3. Environment variable values
4. Troubleshooting section

---

**Happy form collecting! 🎊**
