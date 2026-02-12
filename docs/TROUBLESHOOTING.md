# Troubleshooting Guide

## Overview

This guide covers common issues and their solutions for the River City Roofing Solutions platform.

---

## Authentication Issues

### Cannot Log In (Staff)

**Symptoms:**
- "Invalid email" error
- Login page keeps appearing
- Redirects back to login

**Solutions:**

1. **Verify email address:**
   - Use your @rcrsal.com email
   - Check for typos
   - Email is case-insensitive

2. **Check team member status:**
   - Ensure your account is active
   - Contact admin if deactivated

3. **Clear browser data:**
   ```
   1. Open browser settings
   2. Clear cookies and cache
   3. Try logging in again
   ```

4. **Try incognito/private mode**

---

### Cannot Log In (Driver PIN)

**Symptoms:**
- "Invalid PIN" error
- PIN not accepted

**Solutions:**

1. **Verify PIN:**
   - PINs are 4 digits
   - Check for correct PIN
   - Contact office for PIN reset

2. **Check role:**
   - PIN login is for drivers
   - Staff should use email login

---

### Cannot Log In (Customer)

**Symptoms:**
- "Account not found" error
- Access code rejected

**Solutions:**

1. **Verify information:**
   - Use email/phone from your project
   - Access codes are case-sensitive
   - Check for spaces in code

2. **Contact support:**
   - Call 256-274-8530
   - Request new access code

---

## Data Not Loading

### Dashboard Shows No Data

**Symptoms:**
- Empty dashboards
- Loading spinner never stops
- "No data" messages

**Solutions:**

1. **Check internet connection**

2. **Refresh the page:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

3. **Check browser console:**
   - Press F12 to open developer tools
   - Look for error messages in Console tab

4. **Verify API configuration:**
   ```
   Check these environment variables:
   - GOOGLE_SHEETS_ID
   - GOOGLE_SERVICE_ACCOUNT_EMAIL
   - GOOGLE_PRIVATE_KEY
   ```

---

### JobNimbus Data Not Syncing

**Symptoms:**
- Contacts/jobs not appearing
- "API key not configured" error
- Sync failures

**Solutions:**

1. **Verify API key:**
   ```env
   JOBNIMBUS_API_KEY=your_api_key
   ```

2. **Test connection:**
   - Go to `/admin/jobnimbus`
   - Click "Test Connection"
   - Review error message

3. **Check rate limits:**
   - JobNimbus limits API calls
   - Wait and retry if limited

4. **Verify API URL:**
   ```env
   JOBNIMBUS_API_URL=https://app.jobnimbus.com/api1
   ```

---

### Google Sheets Connection Failed

**Symptoms:**
- Inventory not loading
- Team members missing
- "Failed to initialize" errors

**Solutions:**

1. **Check credentials format:**
   ```env
   # Private key must have \n for newlines
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

2. **Verify sheet is shared:**
   - Open Google Sheet
   - Click Share
   - Add service account email
   - Grant Editor access

3. **Check sheet names:**
   - Sheets must be named exactly:
     - `team-members-import`
     - `Inventory`
     - `Commissions`
     - `Customers`
     - `Orders`

---

## Upload Issues

### Images Not Uploading

**Symptoms:**
- Upload fails
- "Upload error" message
- Image doesn't appear

**Solutions:**

1. **Check file size:**
   - Maximum 10MB
   - Compress large images

2. **Check file format:**
   - Supported: JPEG, PNG, WebP
   - Not supported: HEIC, TIFF

3. **Verify Blob storage:**
   ```env
   BLOB_READ_WRITE_TOKEN=your_token
   ```

4. **Check network:**
   - Large files need stable connection
   - Retry on timeout

---

### Photos Not Saving (Driver)

**Symptoms:**
- Photo appears to capture but doesn't save
- Upload indicator fails

**Solutions:**

1. **Check connection:**
   - Photos upload immediately
   - Need internet connection

2. **Grant camera permissions:**
   - Allow browser camera access
   - Check device permissions

3. **Try again:**
   - Photos retry automatically
   - Manual retry if needed

4. **Storage space:**
   - Check device has storage
   - Clear old files if needed

---

## Calendar/Schedule Issues

### Events Not Showing

**Symptoms:**
- Calendar is empty
- Events not syncing from TeamUp

**Solutions:**

1. **Check TeamUp configuration:**
   ```env
   TEAMUP_API_KEY=your_api_key
   TEAMUP_CALENDAR_KEY=your_calendar_key
   ```

2. **Verify date range:**
   - Calendar may be showing wrong dates
   - Check date picker

3. **Check subcalendars:**
   - Events may be on different subcalendar
   - Verify subcalendar IDs match

---

### Cannot Create Appointments

**Symptoms:**
- Create button does nothing
- Error when scheduling

**Solutions:**

1. **Check permissions:**
   - Verify your role has scheduling permission
   - Contact admin if needed

2. **Validate input:**
   - All required fields filled
   - Valid date/time format

3. **Check API status:**
   - TeamUp may be temporarily unavailable
   - Try again later

---

## Notification Issues

### GroupMe Not Sending

**Symptoms:**
- No notifications in GroupMe
- Test message fails

**Solutions:**

1. **Verify configuration:**
   ```env
   GROUPME_BOT_ID=your_bot_id
   GROUPME_ENABLED=true
   ```

2. **Test the bot:**
   - Go to admin settings
   - Click "Test GroupMe"
   - Check for error message

3. **Verify bot group:**
   - Bot must be in correct group
   - Recreate bot if wrong group

4. **Check notification toggles:**
   ```env
   GROUPME_NOTIFY_NEW_LEAD=true
   GROUPME_NOTIFY_LOW_INVENTORY=true
   # etc.
   ```

---

## Performance Issues

### Pages Loading Slowly

**Solutions:**

1. **Clear browser cache:**
   - Settings > Clear browsing data
   - Select cached images and files

2. **Check network speed:**
   - Test internet connection
   - Try different network

3. **Reduce data load:**
   - Use filters to limit results
   - Don't load all data at once

4. **Update browser:**
   - Use latest Chrome, Firefox, or Edge
   - Avoid outdated browsers

---

### Mobile App Running Slow

**Solutions:**

1. **Close other tabs:**
   - Free up browser memory
   - Close background apps

2. **Restart browser:**
   - Close completely
   - Reopen fresh

3. **Clear cache:**
   - Browser settings
   - Clear site data

4. **Check device storage:**
   - Free up space
   - Remove unused apps

---

## Error Messages

### "Server Error (500)"

**Meaning:** Something went wrong on the server.

**Solutions:**
1. Refresh the page
2. Wait a few minutes and retry
3. Check if issue persists
4. Contact admin with details

---

### "Not Found (404)"

**Meaning:** Page or resource doesn't exist.

**Solutions:**
1. Check the URL is correct
2. You may not have access
3. Resource may have been deleted

---

### "Unauthorized (401)"

**Meaning:** You're not logged in or session expired.

**Solutions:**
1. Log in again
2. Clear cookies and retry
3. Check your permissions

---

### "Bad Request (400)"

**Meaning:** Invalid data submitted.

**Solutions:**
1. Check all required fields
2. Verify data format
3. Review validation messages

---

### "Rate Limit Exceeded (429)"

**Meaning:** Too many requests.

**Solutions:**
1. Wait before retrying
2. Reduce request frequency
3. Check for automated loops

---

## Browser-Specific Issues

### Chrome

**Issue:** Site not loading properly
- Clear cache: Settings > Privacy > Clear browsing data
- Disable extensions temporarily
- Check Chrome is updated

### Safari

**Issue:** Features not working
- Enable JavaScript
- Allow cookies
- Try Chrome instead

### Firefox

**Issue:** Login not persisting
- Enable cookies for site
- Check privacy settings
- Try standard browsing mode

### Edge

**Issue:** Display issues
- Update Edge
- Clear cache
- Check zoom level

---

## Mobile-Specific Issues

### Touch Not Responding

1. Clean screen
2. Remove screen protector temporarily
3. Restart browser
4. Try different browser

### GPS Not Working

1. Enable location services
2. Allow browser location access
3. Go outside for better signal
4. Refresh and allow when prompted

### Camera Not Working

1. Allow camera permission
2. Check other apps can use camera
3. Restart browser
4. Try different browser

---

## Recovery Procedures

### Lost Work

If you lose unsaved work:
1. Check autosave (if available)
2. Review recent activity
3. Recreate from memory
4. Contact support for database recovery

### Accidental Deletion

If you accidentally delete something:
1. Stop immediately
2. Contact admin
3. May be recoverable from Google Sheets history
4. Backups available for 30 days

### Password/PIN Reset

1. Contact office manager
2. Verify your identity
3. New credentials issued
4. Update immediately

---

## Contact Support

### For Technical Issues

**Admin Email:** admin@rcrsal.com

Include:
- Your name and role
- What you were doing
- Error message (screenshot if possible)
- Browser and device info

### For Urgent Issues

**Phone:** 256-274-8530

Call for:
- System completely down
- Security concerns
- Critical business impact

---

## Diagnostic Information

When reporting issues, gather:

1. **Browser info:**
   - Browser name and version
   - Operating system

2. **Error details:**
   - Exact error message
   - Screenshot if possible

3. **Steps to reproduce:**
   - What you clicked
   - What you entered

4. **Console errors:**
   - Press F12
   - Go to Console tab
   - Copy any red errors

---

## Known Limitations

### Current System Limitations

1. **Session timeout:** Sessions expire after browser close
2. **Single device:** Can't be logged in on multiple devices
3. **Offline mode:** Requires internet connection
4. **File size:** Max 10MB uploads
5. **Image formats:** JPEG, PNG, WebP only

### Planned Improvements

- Offline mode support
- Multi-device sessions
- Larger file uploads
- More file formats
