# QUICK REFERENCE CARD: OFFICE STAFF
## River City Roofing Solutions Platform

**For:** Sara Hill (Office Manager), Tia Morris (Admin), Destin McCury (Admin)
**Role:** `office` -- Delivery management, invoicing, order creation, lead entry, scheduling
**Last Updated:** February 10, 2026

---

## LOGIN

| Field | Value |
|-------|-------|
| **URL** | https://www.rivercityroofingsolutions.com/portal |
| **Email** | sara@rcrsal.com / tia@rcrsal.com / destin@rcrsal.com |
| **PIN Location** | `lib/team-roles.ts` -- TEAM_MEMBERS array |
| **Login Method** | Email + 4-digit PIN |
| **Default Landing** | /portal/office |

---

## TOP 5 BOOKMARKS

1. **Office Portal** -- /portal/office -- 4-tab hub: Dashboard, Delivery Tickets, Invoices, Create Order
2. **Schedule** -- /portal/schedule -- Month/week/day calendar, appointment creation, conflict detection
3. **Billing** -- /portal/billing -- Invoice management, payment tracking, revenue overview
4. **Team Chat** -- /portal/chat -- GroupMe team channel, DMs, @mentions
5. **Inventory** -- /portal/inventory -- Stock levels for all 11 products, low stock alerts

---

## DAILY CHECKLIST

### Morning (8:00 AM)
- [ ] Open /portal/office -> Dashboard tab -- check Active Deliveries, Completed Today, Pending Invoices, Pending Amount $
- [ ] Switch to **Delivery Tickets** tab -- check for unassigned tickets, assign drivers
- [ ] Switch to **Invoices** tab -- check for any new "Overdue" status invoices
- [ ] Check GroupMe (/portal/chat) for overnight messages
- [ ] Review /portal/schedule -- any appointments or deliveries today?
- [ ] Check /command-center/leads -- review new leads from overnight/website

### Midday (12:00 PM)
- [ ] Monitor **Delivery Tickets** for status changes (In Transit, Completed)
- [ ] Process any incoming material order requests (Create Order tab)
- [ ] Handle incoming phone calls -- create leads for new customer inquiries
- [ ] Send invoices for completed jobs
- [ ] Check GroupMe for team coordination messages

### End of Day (4:30-5:00 PM)
- [ ] Review dashboard stats -- all deliveries completed?
- [ ] Check for remaining unassigned tickets for tomorrow
- [ ] Note any overdue invoices needing morning follow-up
- [ ] Update Monday Notes with any important items
- [ ] Quick GroupMe check for end-of-day messages

---

## WEEKLY CHECKLIST

- [ ] Review all overdue invoices -- follow up on 30+ day outstanding
- [ ] Check inventory levels for low stock items -- coordinate restocking with Tae
- [ ] Prepare Monday Notes for team (Sara)
- [ ] Review lead entry log -- ensure all phone/walk-in leads were captured
- [ ] Reconcile completed deliveries with invoicing
- [ ] Check scheduling conflicts on calendar

---

## KEY SHORTCUTS

| Action | How |
|--------|-----|
| **Assign a driver** | Delivery Tickets tab -> driver dropdown on any ticket -> select driver -> save |
| **Create material order** | Create Order tab -> fill job info, customer, delivery details, materials -> Submit (auto-creates delivery ticket) |
| **Mark invoice paid** | Invoices tab -> find invoice -> click "Mark Paid" -> confirm |
| **Enter a new lead** | Navigate to lead entry -> fill name, phone, email, address, source -> Quick-assign to rep |
| **Schedule appointment** | /portal/schedule -> create event -> set date/time/title -> Google Calendar link auto-generated |
| **Send/resend invoice** | Invoices tab -> find invoice -> click "Send" or "Resend" to email customer |

---

## COMMON TASKS

| Task | Steps |
|------|-------|
| **Create a material order** | Create Order tab -> Job info (name, number, address) -> Customer contact (name, phone, email) -> PM assignment -> Delivery details (date, time, priority, instructions) -> Select materials from 11-product grid with quantities -> Review running total -> Submit |
| **Process incoming call to lead** | Take name, phone, email, address, service need, source ("phone call") -> Create lead in portal -> Quick-assign to available sales rep -> Rep gets notification |
| **Assign driver to delivery** | Delivery Tickets tab -> find unassigned ticket -> click driver dropdown -> select Richard or available driver -> save |
| **Generate and send invoice** | Invoices tab -> create invoice from completed job -> review line items -> click "Send" to email customer |
| **Handle delivery inquiry** | Customer calls about delivery -> check Delivery Tickets tab -> find their ticket -> report status and ETA |
| **Schedule an inspection** | /portal/schedule -> create new event -> set date/time/title -> Google Calendar link generated -> share with rep and customer |
| **Process a payment** | Invoices tab -> find invoice -> click "Mark Paid" -> status changes from Pending/Sent to Paid |

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| **Cannot log in** | Verify your @rcrsal.com email and PIN. Clear browser cache. Contact Michael (256-221-4290) for PIN reset. |
| **Delivery ticket not auto-created after order** | After submitting a material order, refresh the Delivery Tickets tab. If still missing, try resubmitting or contact Michael. |
| **Invoice won't send** | Verify customer email address is correct. Check internet connection. Try "Resend" if it was previously sent. |
| **Driver not showing in dropdown** | Driver must have isActive: true in team-roles.ts. Active drivers: Richard Geahr and Tae Orr. Contact Michael if driver account needs activation. |
| **Google Sheets not syncing** | Verify the service account email has edit access to the spreadsheet. Check GOOGLE_PRIVATE_KEY and GOOGLE_SHEETS_ID env vars. Contact Michael for credentials issues. |
| **Portal shows blank page** | Hard refresh (Ctrl+Shift+R). If persistent, check internet connection. Try a different browser. |
| **Cannot access admin pages (Tia/Destin)** | Only Sara has full admin role. Tia (office) and Destin (manager) have limited access. Admin pages (/portal/admin/*) require admin or owner role. |

---

## WHO TO CONTACT

| Person | Role | Phone |
|--------|------|-------|
| Michael Muse | VP / Tech (system issues) | 256-221-4290 |
| Chris Muse | President | 256-648-1224 |
| John Cordonis | Production Manager (job questions) | 256-654-0875 |
| Richard Geahr | Driver (delivery coordination) | GroupMe DM |
| Tae Orr | Materials Manager (stock questions) | 256-200-3467 |
| Office Main Line | General | 256-274-8530 |

**Sara-Specific Access:** Admin portal (/portal/admin), Monday Notes Admin, user management, lead distribution oversight, report generation, blog CMS

---

*RCRS Platform -- 367 pages, 180+ API routes, 85+ components*
*Office: 256-274-8530 | rcrs@rivercityroofingsolutions.com*
