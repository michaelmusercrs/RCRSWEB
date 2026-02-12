# QUICK REFERENCE CARD: OWNER / MANAGER
## River City Roofing Solutions Platform

**For:** Chris Muse (President) & Michael Muse (Vice President)
**Role:** `owner` -- Full system access with all permissions
**Last Updated:** February 10, 2026

---

## LOGIN

| Field | Value |
|-------|-------|
| **URL** | https://www.rivercityroofingsolutions.com/portal |
| **Email** | chrismuse@rcrsal.com / michaelmuse@rcrsal.com |
| **PIN Location** | `lib/team-roles.ts` -- TEAM_MEMBERS array |
| **Login Method** | Email + 4-digit PIN |
| **Default Landing** | /portal/dashboard |

---

## TOP 5 BOOKMARKS

1. **Command Center** -- /command-center -- Executive KPIs, trends, team overview
2. **Leads Dashboard** -- /command-center/leads -- All incoming leads, assignment, distribution
3. **Sales Leaderboard** -- /command-center/sales -- Rep performance, achievements, commissions
4. **Admin Panel** -- /portal/admin -- System settings, users, blog CMS, pricing, lead distro
5. **Reports** -- /command-center/reports -- Financial reports, team reports, printable summaries

---

## DAILY CHECKLIST

### Morning (8:00 AM)
- [ ] Open Command Center -- review overnight KPIs and alerts
- [ ] Check /command-center/leads -- review new leads from overnight/website
- [ ] Review lead distribution -- ensure reps are available and leads are assigned
- [ ] Scan /portal/inventory -- check any low-stock alerts

### Midday (12:00 PM)
- [ ] Check /command-center/sales -- review leaderboard and today's activity
- [ ] Review /portal/billing -- check outstanding invoices
- [ ] Monitor deliveries -- /portal/delivery -- verify routes are on track

### End of Day (5:00 PM)
- [ ] Review daily stats on Command Center dashboard
- [ ] Check /portal/chat -- respond to team messages
- [ ] Scan invoice status -- /command-center/billing/invoices
- [ ] Prepare notes for next day or Monday meeting

---

## KEY ACTIONS

### Assign a Lead (3 steps)
1. Go to /command-center/leads
2. Click on unassigned lead, select rep from dropdown
3. Click "Assign" -- rep gets notification

### Run a Report (2 steps)
1. Go to /command-center/reports (financial, team, or printable)
2. Select date range and click "Generate"

### Prep Monday Meeting (5 steps)
1. Go to /command-center/meetings
2. Review auto-generated agenda from weekly data
3. Click /command-center/meetings/prep for prep materials
4. Review each rep's stats in /command-center/sales
5. Present from /command-center/meetings/present

### Edit a Blog Post (4 steps)
1. Go to /portal/admin/blog
2. Find post and click "Edit"
3. Update title, content, SEO fields
4. Click "Save" to publish changes

### Configure Lead Distribution (3 steps)
1. Go to /portal/admin/lead-distro
2. Toggle rep availability on/off, adjust territory weights
3. Save -- round-robin and proximity algorithms auto-adjust

---

## EMERGENCY CONTACTS

| Person | Role | Phone |
|--------|------|-------|
| Michael Muse | VP / Tech | 256-221-4290 |
| Sara Hill | Office Manager / Admin | 256-810-3594 |
| Chris Muse | President | 256-648-1224 |
| Office Main Line | General | 256-274-8530 |

**Vercel Dashboard:** Log in via GitHub at vercel.com (project: prj_7s9kclvyqkMQhOHS4fHWpBJLEruG)
**Domain:** www.rivercityroofingsolutions.com

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| **Cannot log in to portal** | Verify ADMIN_PASSWORD env var is set in Vercel. Check that PIN matches team-roles.ts. Try clearing browser cache and cookies. |
| **Google Sheets not syncing** | Verify the service account email has edit access to the spreadsheet. Check GOOGLE_PRIVATE_KEY and GOOGLE_SHEETS_ID env vars in Vercel dashboard. |
| **Build failing on Vercel** | Run `npm run build` locally to see errors. Check that all env vars are set. Dynamic route warnings (304 pages) are normal -- not errors. |
| **Lead distribution not working** | Check /portal/admin/lead-distro -- ensure at least one rep is toggled "available." Verify Rep_Availability and Rep_Preferences sheets have data. |
| **Portal shows blank page** | Hard refresh (Ctrl+Shift+R). If persistent, check Vercel deployment status. AUTH_BYPASS_MODE=true allows testing without full auth. |

---

*RCRS Platform -- 367 pages, 180+ API routes, 85+ components*
*Office: 256-274-8530 | rcrs@rivercityroofingsolutions.com*
