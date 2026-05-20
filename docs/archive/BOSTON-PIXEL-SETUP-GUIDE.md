# Google & Facebook Pixel Setup Guide
**For: Boston | RCRS Website | March 2026**

The website code is ALREADY SET UP to use these pixels. You just need to create the accounts, get the IDs, and add them to Vercel. Follow each step exactly.

---

## PART 1: Facebook Pixel Setup

### Step 1: Access Facebook Business Manager
1. Go to **https://business.facebook.com**
2. Log in with the RCRS Facebook account (or Michael's account that manages the RCRS Facebook page)
3. If you don't have a Business Manager account yet:
   - Click **"Create Account"**
   - Business name: `River City Roofing Solutions`
   - Your name and business email: `rcrs@rivercityroofingsolutions.com`
   - Click **Create**

### Step 2: Create the Facebook Pixel
1. In Business Manager, click the **hamburger menu** (☰) top-left
2. Go to **Events Manager** (under "Data Sources")
3. Click the green **"+ Connect Data Sources"** button
4. Select **"Web"**
5. Select **"Facebook Pixel"** (NOT Conversions API for now)
6. Click **"Connect"**
7. Pixel name: `RCRS Website Pixel`
8. Enter website URL: `https://www.rivercityroofingsolutions.com`
9. Click **"Continue"**
10. Select **"Install code manually"** (we already have it in the code)
11. **COPY THE PIXEL ID** - it will be a long number like `123456789012345`
12. Click **"Continue"** then **"Done"**

### Step 3: Set Up Conversion Events
1. Still in Events Manager, click your new pixel
2. Click **"Settings"** tab
3. Scroll to **"Event Setup Tool"**
4. Set up these standard events:
   - **Lead** → Fire when someone submits the contact form
   - **Contact** → Fire when someone calls the phone number
   - **ViewContent** → Fire on service pages
   - **Schedule** → Fire when someone requests an inspection
5. Don't worry about this step too much - the code already fires `fbq('track', 'Lead')` on form submissions automatically

### Step 4: Write Down the Pixel ID
- **Your Facebook Pixel ID:** `___________________________`
- You'll add this to Vercel in Part 3 below

---

## PART 2: Google Ads Conversion Tracking Setup

### Step 1: Access Google Ads
1. Go to **https://ads.google.com**
2. Log in with the RCRS Google Workspace account (`michael@rcrsal.com` or whoever manages ads)
3. If no Google Ads account exists:
   - Click **"Start Now"**
   - Choose **"Switch to Expert Mode"** (bottom of the page, small link)
   - Click **"Create an account without a campaign"**
   - Confirm business info: US, Eastern Time, USD
   - Click **Submit**

### Step 2: Get Your Google Ads ID
1. Once in Google Ads, look at the **top right corner** of the screen
2. You'll see your Google Ads ID - it looks like: `AW-123456789`
3. **Write it down:** `___________________________`

### Step 3: Create Conversion Actions
1. Click **Tools & Settings** (wrench icon, top menu)
2. Under "Measurement" click **"Conversions"**
3. Click **"+ New conversion action"**
4. Select **"Website"**
5. Enter URL: `https://www.rivercityroofingsolutions.com` → Click **Scan**
6. Click **"+ Add a conversion action manually"**

**Create these 3 conversion actions:**

**A) Form Submission (Lead)**
- Category: **Submit lead form**
- Conversion name: `RCRS Form Submission`
- Value: Select **"Use the same value for each conversion"** → Enter `50`
- Count: **One** (per click)
- Click-through window: 30 days
- View-through window: 1 day
- Attribution: Data-driven
- Click **Done**

**B) Phone Call from Website**
- Category: **Phone call lead**
- Conversion name: `RCRS Phone Call`
- Value: `100`
- Count: **One**
- Click **Done**

**C) Quote Request**
- Category: **Request quote**
- Conversion name: `RCRS Quote Request`
- Value: `75`
- Count: **One**
- Click **Done**

7. Click **Save and Continue**

### Step 4: Get Conversion IDs
1. After saving, you'll see a screen with **Tag setup**
2. Select **"Use Google Tag Manager"** or **"Install tag yourself"**
3. For each conversion, you'll see a **Conversion ID** and **Conversion Label**
4. The Conversion ID looks like: `AW-123456789/AbCdEfGhIjKl`
5. Write down ALL THREE:

- **Form Conversion:** `___________________________`
- **Phone Conversion:** `___________________________`
- **Quote Conversion:** `___________________________`

---

## PART 3: Add Everything to Vercel (THE IMPORTANT PART)

### Step 1: Log into Vercel
1. Go to **https://vercel.com/dashboard**
2. Log in (use the GitHub account: `michaelmusercrs`)
3. Click on the **river-city-roofing** project

### Step 2: Go to Environment Variables
1. Click **"Settings"** tab (top nav)
2. Click **"Environment Variables"** (left sidebar)

### Step 3: Add These Variables
Add each one by typing the name in "Key" and the value in "Value", then clicking **Add**:

| Key | Value | Example |
|-----|-------|---------|
| `NEXT_PUBLIC_FB_PIXEL_ID` | Your Facebook Pixel ID | `123456789012345` |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | Your Google Ads ID | `AW-123456789` |
| `NEXT_PUBLIC_GADS_FORM_CONVERSION` | Form conversion label | `AW-123456789/AbCdEf` |
| `NEXT_PUBLIC_GADS_PHONE_CONVERSION` | Phone conversion label | `AW-123456789/GhIjKl` |
| `NEXT_PUBLIC_GADS_QUOTE_CONVERSION` | Quote conversion label | `AW-123456789/MnOpQr` |

**For each variable:**
- Make sure **"Production"**, **"Preview"**, and **"Development"** are all checked
- Click **"Save"**

### Step 4: Redeploy
1. Go to the **"Deployments"** tab
2. Find the most recent deployment
3. Click the **three dots** (⋯) on the right
4. Click **"Redeploy"**
5. Check **"Use existing Build Cache"**
6. Click **"Redeploy"**
7. Wait 2-3 minutes for the build to complete

---

## PART 4: Verify Everything Works

### Test Facebook Pixel
1. Install the **Facebook Pixel Helper** Chrome extension:
   - Go to Chrome Web Store: search "Facebook Pixel Helper"
   - Install it (blue icon with `</>`)
2. Visit **https://www.rivercityroofingsolutions.com**
3. Click the Pixel Helper icon in your browser toolbar
4. You should see:
   - ✅ `PageView` event fired
   - Your Pixel ID listed
5. Go to the contact page and submit a test form
6. Check Pixel Helper again - you should see a `Lead` event

### Test Google Ads
1. Go to **Google Ads → Tools → Conversions**
2. Wait 24-48 hours after setup
3. Status should change from "Unverified" to "No recent conversions" or "Recording conversions"
4. You can also use **Google Tag Assistant** Chrome extension to verify:
   - Install "Tag Assistant Legacy" from Chrome Web Store
   - Visit the website
   - It should show your Google Ads tag as "green" (working)

### Test Google Analytics (already working)
1. Go to **https://analytics.google.com**
2. Select the RCRS property (ID: `G-Y8PB85BZC5`)
3. Click **"Realtime"** in the left menu
4. Open the website in another tab
5. You should see yourself as an active user

---

## SUMMARY - What Boston Needs to Give Michael

After completing all steps, send Michael these values:

```
Facebook Pixel ID: _______________
Google Ads ID: AW-_______________
Form Conversion: AW-_______________/_______________
Phone Conversion: AW-_______________/_______________
Quote Conversion: AW-_______________/_______________
```

**Or even better:** just add them to Vercel yourself (Part 3) and redeploy.

---

## TROUBLESHOOTING

**"I don't see the pixel firing"**
- Make sure you redeployed after adding the env vars
- Clear your browser cache or use incognito
- Check that the env var names are EXACTLY right (copy/paste from this doc)

**"Google Ads says unverified"**
- It takes 24-48 hours for Google to verify
- Make sure the Google Ads ID starts with `AW-`

**"I can't access Business Manager"**
- Ask Michael to add you as an admin on the RCRS Facebook Business Manager
- You need at least "Ads Manager" access

**"I can't access Google Ads"**
- Ask Michael to invite you via Google Ads → Tools → Access & Security → Add user
- Use your `@rcrsal.com` email

**"I don't have Vercel access"**
- Ask Michael to add you as a team member at vercel.com
- Or just send Michael the IDs and he'll add them

---

*Guide created March 16, 2026 for River City Roofing Solutions*
*Website: www.rivercityroofingsolutions.com | Portal: rcrsal.com*
