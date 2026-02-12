# MODULE 4: Production Manager Training
## River City Roofing Solutions Platform

| Field | Detail |
|---|---|
| **Target Audience** | John — Production Manager |
| **Role Summary** | Oversees installations, crew scheduling, quality control, and material coordination |
| **Estimated Completion** | 45–60 minutes |
| **Prerequisites** | Active portal credentials (john@rcrsal.com), Google Calendar connected |

---

## Table of Contents

1. [System Features & Functions](#section-1-system-features--functions)
2. [Your Use Cases — A Production Manager's Day](#section-2-your-use-cases--a-production-managers-day)
3. [Settings & Configuration](#section-3-settings--configuration)
4. [Hands-On Practice](#section-4-hands-on-practice)
5. [Process Flowcharts](#process-flowcharts)
6. [NotebookLM Generation Prompts](#notebooklm-generation-prompts)

---

## SECTION 1: SYSTEM FEATURES & FUNCTIONS

Everything below is available to you in the portal. Your role gives you access to order creation, inventory visibility, scheduling, delivery tracking, task management, and team communication.

---

### PM Order Portal (`/portal/pm`)

This is your primary workspace. From here you can:

- **Create material orders** for upcoming jobs — each order auto-generates a delivery ticket for the office and driver.
- **Full order form** covers every detail the office and driver need: job info, customer contact, delivery logistics, and a material selection grid.
- **Track order status** through its full lifecycle (Submitted → Confirmed → Loaded → In Transit → Delivered).
- **Coordinate with the office** for delivery scheduling — the office sees your orders in real time and assigns a driver.

**Key point:** Every order you submit flows directly into the delivery system. You do not need to call or email the office separately. The portal handles the handoff.

---

### Dashboard (`/portal/dashboard`)

Your dashboard is the first screen you see after login. It provides:

- **Quick-access tiles:**
  - **Monday Notes** — weekly priorities and planning notes from leadership
  - **Chat** — opens GroupMe team chat
  - **Profile** — your account settings and contact info
  - **Create Orders** — shortcut to the PM order form
  - **Schedule** — calendar view of jobs and deliveries
  - **New Lead** — submit a lead if a neighbor or customer asks about work
- **Recent activity feed** — shows the latest orders, deliveries, and schedule changes relevant to your jobs.
- **Key production stats** — jobs scheduled this week, orders pending, deliveries in progress.

---

### Material Order Creation — Detailed Walkthrough

When you click **Create Orders** from the dashboard or navigate to `/portal/pm`, you see the full order form. Here is every section:

#### 1. Job Information
| Field | What to Enter |
|---|---|
| **Job Name** | Customer last name + job type (e.g., "Smith Residence - Roof Replacement") |
| **Job Number** | The JobNimbus job number if available; leave blank if not yet assigned |
| **Job Address** | Full street address of the job site where materials will be delivered |

#### 2. Customer Contact
| Field | What to Enter |
|---|---|
| **Customer Name** | Homeowner's full name |
| **Phone** | Primary contact number for delivery-day coordination |
| **Email** | Optional — used for delivery confirmation notifications |

#### 3. PM Info
This section **auto-fills** with your name, phone, and email based on your login. Verify it is correct. If another PM is handling a job, you can override these fields.

#### 4. Delivery Details
| Field | What to Enter |
|---|---|
| **Preferred Date** | The date you need materials on site — typically the day BEFORE installation |
| **Preferred Time** | When the driver should arrive (e.g., 8:00 AM) |
| **Priority** | **Normal** = standard 2–3 day lead time; **Rush** = next business day; **Urgent** = same day (crew waiting) |
| **Special Instructions** | Free-text field for anything the driver needs to know |

**Special Instructions — what to include:**
- Crew access notes ("Gate code is 1234", "Enter from back alley")
- Stacking location ("Left side of driveway", "Backyard near fence")
- Fragile or special-handling items ("Skylights — do not stack heavy items on top")
- Contact on site if different from customer ("Crew lead Mike will be there, 256-555-9876")
- Any HOA or neighborhood restrictions ("No deliveries before 8 AM per HOA rules")

#### 5. Material Selection Grid

The grid lists all 11 stocked products. Use the quantity selectors (+/- buttons or type a number) to specify how many of each item you need:

| # | Product | Unit |
|---|---|---|
| 1 | Shingles (bundles) | per bundle |
| 2 | Underlayment (rolls) | per roll |
| 3 | Ridge Cap (boxes) | per box |
| 4 | Drip Edge (rolls) | per roll |
| 5 | Pipe Boots | each |
| 6 | Ice & Water Shield (rolls) | per roll |
| 7 | Starter Strip (boxes) | per box |
| 8 | Roofing Nails (boxes) | per box |
| 9 | Flashing (rolls) | per roll |
| 10 | Ventilation (units) | each |
| 11 | Plywood/OSB (sheets) | per sheet |

#### 6. Running Total
As you select quantities, the form displays a **running total** at the bottom — this shows the total item count (not dollar cost). Use this to double-check you have not missed anything before submitting.

#### 7. Submit
- Click **Submit Order**.
- The system auto-creates a **delivery ticket** visible to the office and driver.
- You receive a confirmation with an order number.
- The office is notified immediately and will assign a driver.

---

### Inventory Visibility

Navigate to `/portal/inventory` (or use the Inventory tile if available on your dashboard).

**What you can see:**
- Current stock levels for all 11 products (quantity on hand).
- **Low stock alerts** — items highlighted in red or with a warning badge when quantities drop below the reorder threshold.
- Product availability status.

**What you cannot see:**
- Unit costs or pricing (that is admin/owner level).
- Supplier information.

**How to use this:**
- Before creating an order, check inventory to confirm the materials you need are in stock.
- If something is low or out of stock, flag it to the office via GroupMe or a note in your order's special instructions.
- Plan your orders around availability — if underlayment is low, submit your order early so the office can restock before your job.

---

### Schedule & Calendar

Navigate to `/portal/schedule` for the full calendar view.

**Views available:**
- **Day view** — detailed look at a single day's jobs and deliveries.
- **Week view** — overview of the full work week.
- **Month view** — long-range planning perspective.

**What shows on the calendar:**
- Scheduled installations (your jobs).
- Delivery dates for your material orders.
- Team events and meetings.

**Google Calendar sync:**
- Your portal calendar syncs with Google Calendar.
- Events created in the portal generate Google Calendar links.
- Enable conflict detection to get alerts when two jobs overlap or a delivery conflicts with an installation.

**Coordination tip:** Schedule material deliveries for the day BEFORE the installation. This gives the driver flexibility and ensures materials are on site when the crew arrives in the morning.

---

### Delivery Tracking

Once you submit a material order, you can track its progress:

| Status | Meaning |
|---|---|
| **Submitted** | Order received by the system, awaiting office confirmation |
| **Confirmed** | Office has reviewed and approved; driver assigned |
| **Loaded** | Driver has loaded the materials onto the truck |
| **In Transit** | Driver is en route to the job site |
| **Delivered** | Materials are on site — verify the delivery |

**ETA tracking:** When the driver is in transit, the system provides an estimated time of arrival. Use this to coordinate crew timing.

**Verification:** After delivery, check that the materials delivered match what you ordered. If anything is missing or damaged, report it immediately through the portal or GroupMe.

---

### Task Management

Your personal task list is accessible from the dashboard.

- **Create tasks** for yourself (e.g., "Confirm crew for Thursday Smith job").
- **Priority flags** — mark tasks as high, medium, or low priority.
- **Due dates** — set deadlines so nothing slips.
- Use this to stay on top of follow-ups that are not tied to a specific order or job.

---

### Communication

#### GroupMe Team Chat (`/portal/chat`)
- Main team channel for real-time coordination.
- **@mention** office staff when you need an urgent change (e.g., "@Sarah need to reschedule Smith delivery to Thursday").
- **@mention** drivers for delivery coordination.
- Accessible from your phone via the GroupMe app as well.

#### Direct Messages
- Private one-on-one messages with any team member.
- Use for sensitive information or individual coordination.

#### Monday Notes
- Weekly planning document from leadership.
- Review every Monday morning (or Sunday evening) for the week's priorities, schedule changes, and announcements.

---

## SECTION 2: YOUR USE CASES — A PRODUCTION MANAGER'S DAY

This section walks through a typical day so you can see how each feature fits into your real workflow.

---

### Morning Planning (6:30–7:00 AM)

This is your most important 30 minutes. Set up the day before you leave for the job site.

1. **Open portal dashboard** at rivercityroofingsolutions.com/portal
   - Check the schedule tile: What jobs are on today? Where are they? What time do crews arrive?

2. **Review material orders** — any deliveries happening today?
   - Check delivery status: Are they confirmed? Loaded? Already in transit?
   - Note the ETA for any in-transit deliveries.

3. **Check inventory levels** — enough materials for today's AND tomorrow's jobs?
   - If inventory is low on something you need tomorrow, create an order now (do not wait until end of day).

4. **GroupMe check** — any overnight messages from crews?
   - Crew leads sometimes report issues the night before (flat tire, sick crew member, weather concerns).
   - Respond to anything urgent before heading out.

5. **Review Monday Notes** — what are this week's priorities from leadership?
   - Any special jobs, VIP customers, or schedule constraints to be aware of?

---

### Pre-Job Material Orders (As Needed — 2–3 Days Before Installation)

**Rule of thumb:** Create material orders at least 2–3 business days before the installation date. This gives the office time to confirm, the warehouse time to pull, and the driver time to deliver.

**Step by step:**

1. Identify the upcoming job on your schedule (e.g., Thursday installation).
2. Navigate to **PM Portal** → **Create Order**.
3. Fill in **Job Information:**
   - Job Name: "Smith Residence - Roof Replacement"
   - Job Number: JN-2026-0412 (from JobNimbus)
   - Address: 123 Oak Street, Huntsville, AL 35801
4. Fill in **Customer Contact:**
   - Name, phone, email for the homeowner.
5. Verify **PM Info** auto-filled correctly (your name, phone, email).
6. Set **Delivery Details:**
   - Date: Wednesday (day before Thursday installation).
   - Time: 8:00 AM.
   - Priority: Normal.
   - Special Instructions: "Stack in driveway, left side of garage. Gate code: 4521."
7. Select **ALL materials needed** using the grid:
   - Go through each product systematically — do not skip any.
   - Double-check quantities against the job scope.
8. Review the **running total** — does the item count look right for this job size?
9. **Submit** the order.
10. Verify the confirmation screen shows your order number and that a delivery ticket was created.

---

### Job Day Coordination (Throughout the Day)

1. **Verify materials arrived at job site:**
   - Check delivery status in the portal. Status should show "Delivered."
   - If you are on site, physically verify: correct materials, correct quantities, no damage.

2. **If materials are short or wrong:**
   - Create an **urgent order** through the portal immediately.
   - Set priority to **Urgent** and add instructions: "SAME DAY — crew waiting on site at [address]."
   - Also message the office in GroupMe for fastest response.

3. **Coordinate crew timing with delivery ETA:**
   - If a delivery is still in transit when the crew arrives, check the ETA.
   - Communicate timing to the crew lead so they can start other prep work while waiting.

4. **Update job status as work progresses:**
   - Mark milestones (tear-off complete, install started, install complete, cleanup done).

5. **Chat with office for scheduling changes:**
   - Weather delay? Crew issue? Homeowner not available?
   - Use GroupMe for real-time changes. The office monitors the chat throughout the day.

6. **Report quality issues or material defects:**
   - Damaged shingles, wrong color delivered, defective pipe boots — report immediately.
   - Document with photos if possible and share in GroupMe.

---

### Schedule Management

1. **View upcoming jobs** on the calendar — switch to week or month view for planning.
2. **Coordinate delivery timing** with crew schedules:
   - Deliveries should land the day before installation.
   - If the crew needs materials mid-job (multi-day project), schedule a second delivery.
3. **Flag conflicts:**
   - Two jobs on the same day that both need your oversight? Flag it to the office.
   - Material unavailable for a scheduled job? Flag it early so procurement can act.
4. **Communicate schedule changes** to all affected team members:
   - Use GroupMe for broad announcements ("Thursday Smith job moved to Friday").
   - DM specific people for individual changes.

---

### End of Day (4:00–5:00 PM)

1. **Update status on completed jobs** — mark today's jobs as complete.
2. **Create material orders** for jobs coming up in 2–3 days.
3. **Check inventory** — if you noticed anything running low today, flag it now.
4. **Report any issues** in GroupMe or Monday Notes:
   - Material quality problems.
   - Crew performance notes.
   - Customer feedback (positive or negative).
   - Anything the office needs to follow up on.

---

## SECTION 3: SETTINGS & CONFIGURATION

---

### First-Time Login

1. Open your browser and go to: **rivercityroofingsolutions.com/portal**
2. Enter your credentials:
   - **Email:** john@rcrsal.com
   - **PIN:** (provided to you separately — do not share)
3. The dashboard loads with your PM-specific tiles.
4. If you cannot log in, contact the office for a PIN reset.

---

### Profile Setup

After your first login, go to **Profile** (tile on dashboard or top-right menu):

- **Photo:** Upload a professional headshot. This shows on your orders and in the team directory.
- **Bio:** Brief description of your role (auto-populated, editable).
- **Phone number:** Verify this is correct — crews and the office rely on this to reach you.
- **Email:** Should be john@rcrsal.com. Do not change without office approval.
- **Notification preferences:** Choose how you want to be alerted (email, in-app, both).

---

### Calendar Sync

1. Go to **Schedule** → **Settings** (gear icon).
2. Click **Connect Google Calendar**.
3. Authorize with your john@rcrsal.com Google account.
4. Set your **working hours** (e.g., 6:30 AM – 5:00 PM, Monday–Saturday).
5. Enable **conflict detection** — this warns you when a new job overlaps with an existing commitment.

Once connected, portal events appear on your Google Calendar and vice versa.

---

### Key Bookmarks

Save these in your browser for fast access:

| Page | URL |
|---|---|
| **PM Order Portal** | rivercityroofingsolutions.com/portal/pm |
| **Schedule** | rivercityroofingsolutions.com/portal/schedule |
| **Team Chat** | rivercityroofingsolutions.com/portal/chat |
| **Inventory** | rivercityroofingsolutions.com/portal/inventory |
| **Dashboard** | rivercityroofingsolutions.com/portal/dashboard |
| **Monday Notes** | rivercityroofingsolutions.com/portal/monday-notes |

**Phone access:** All of these work on your phone browser. Bookmark them on your home screen for one-tap access from the job site.

---

## SECTION 4: HANDS-ON PRACTICE

Complete these exercises to confirm you can use every feature you need. Do them in order.

---

### Exercise 1: Create a Material Order (10 minutes)

**Goal:** Submit a complete material order and verify the delivery ticket is auto-created.

1. Navigate to `/portal/pm`.
2. Click **Create New Order** (or equivalent button).
3. Fill in Job Information:
   - Job Name: **Smith Residence - Roof Replacement**
   - Job Number: (leave blank if you do not have one)
   - Address: **456 Maple Drive, Huntsville, AL 35802**
4. Fill in Customer Contact:
   - Name: **John Smith**
   - Phone: **256-555-1234**
   - Email: **jsmith@email.com**
5. Verify PM Info auto-filled with your details.
6. Fill in Delivery Details:
   - Date: **2 days from today**
   - Time: **8:00 AM**
   - Priority: **Normal**
   - Special Instructions: **"Stack materials on left side of driveway. Crew arrives at 7:30 AM day after delivery."**
7. Select Materials:
   - Shingles: **30 bundles**
   - Underlayment: **4 rolls**
   - Ridge Cap: **2 boxes**
   - Drip Edge: **1 roll**
   - Pipe Boots: **10**
   - (Leave all others at 0)
8. Review the **running total** — should show 47 total items.
9. Click **Submit Order**.
10. On the confirmation screen, note your **order number**.
11. Navigate to delivery tracking and verify a new delivery ticket exists for this order.

**Checkpoint:** If you see your order with status "Submitted" and a delivery ticket was created, this exercise is complete.

---

### Exercise 2: Check Inventory (5 minutes)

**Goal:** Verify you can read inventory levels and identify low-stock items.

1. Navigate to `/portal/inventory`.
2. Find the current stock quantity for:
   - Shingles: _____ bundles
   - Underlayment: _____ rolls
   - Pipe Boots: _____ units
3. Look for any items with a **low stock** warning or red highlight.
4. Write down any low-stock items: _____________________________
5. Consider: Based on the order you just created (30 bundles shingles, 4 rolls underlayment, 10 pipe boots), do you have enough remaining stock for another job of similar size?
   - Shingles remaining after order: _____
   - Underlayment remaining after order: _____
   - Pipe Boots remaining after order: _____

**Checkpoint:** You should be able to answer whether you need to alert the office about restocking any items.

---

### Exercise 3: Schedule Review (5 minutes)

**Goal:** Navigate the calendar and identify scheduling information.

1. Go to `/portal/schedule`.
2. Switch to **Week view**.
3. Identify all jobs scheduled this week:
   - Job 1: _________________________ (date, address)
   - Job 2: _________________________ (date, address)
   - Job 3: _________________________ (date, address)
4. Check for **scheduling conflicts** — any two jobs on the same day?
5. Find the **delivery dates** on the calendar — do they align with the day before each installation?

**Checkpoint:** You should be able to see a clear picture of your week, including when materials arrive and when installations happen.

---

### Exercise 4: Team Communication (3 minutes)

**Goal:** Verify you can send messages to the team and access weekly notes.

1. Open **GroupMe chat** at `/portal/chat`.
2. In the main team channel, post: **"Testing — materials confirmed for tomorrow's job at [pick any address from your schedule]."**
3. Open **Direct Messages** and send Richard (the driver) a test message: **"Training exercise — confirming delivery for [date]. Thanks!"**
4. Navigate to **Monday Notes** and read this week's priorities. Note the top 3:
   - Priority 1: _____________________________
   - Priority 2: _____________________________
   - Priority 3: _____________________________

**Checkpoint:** You should be comfortable posting in the main channel, sending DMs, and finding the weekly notes.

---

## PROCESS FLOWCHARTS

### Job Preparation Flow

```
Job scheduled (3–5 days out)
  |
  v
PM reviews scope
  - What materials are needed?
  - What quantity of each?
  - How big is the crew?
  |
  v
PM checks inventory (/portal/inventory)
  - Enough stock for this job?
  |
  +--> YES --> Create material order (/portal/pm)
  |              - Fill all fields
  |              - Set delivery for day BEFORE installation
  |              - Submit order
  |              |
  |              v
  |            Order submitted
  |              - Auto-creates delivery ticket
  |              - Office notified immediately
  |              |
  |              v
  |            Office assigns driver
  |              |
  |              v
  |            Driver loads materials
  |              |
  |              v
  |            Materials delivered to job site
  |              |
  |              v
  |            PM verifies delivery
  |              - Correct materials?
  |              - Correct quantities?
  |              - No damage?
  |              |
  |              v
  |            Installation day
  |              - Crew arrives
  |              - Materials ready on site
  |              - Work begins
  |
  +--> NO --> Flag to office for rush procurement
                - Message in GroupMe: "@office [product] is low/out"
                - Office orders from supplier
                - May delay job — communicate to customer
```

### Urgent Material Need (Same-Day)

```
On job site --> discover missing/additional material needed
  |
  v
Open portal on phone --> /portal/pm --> Create Order
  |
  v
Fill in job details (can be abbreviated for urgent)
  |
  v
Set priority: URGENT
  |
  v
Special Instructions: "SAME DAY - crew waiting on site at [address]"
  |
  v
Select only the materials needed urgently
  |
  v
Submit order
  |
  v
Also message in GroupMe: "@office URGENT order submitted - crew waiting"
  |
  v
Office sees urgent flag --> assigns driver immediately
  |
  v
Driver loads and departs
  |
  v
PM monitors ETA in delivery tracking
  |
  v
Driver arrives --> PM verifies materials
  |
  v
Crew continues work
```

### Quality Issue Reporting Flow

```
Issue discovered on site (damaged materials, wrong product, defect)
  |
  v
Document with photos (phone camera)
  |
  v
Report in GroupMe with photos:
  "@office Quality issue at [address] - [description]"
  |
  v
If work can continue --> continue with available materials
If work is blocked --> create URGENT order for replacement
  |
  v
Office logs issue for supplier follow-up
  |
  v
End of day: note issue in job completion report
```

---

## QUICK REFERENCE CARD

Cut this out or screenshot it for your phone:

```
+--------------------------------------------------+
|   PRODUCTION MANAGER QUICK REFERENCE             |
+--------------------------------------------------+
|                                                  |
|  PM Portal:    /portal/pm                        |
|  Schedule:     /portal/schedule                  |
|  Inventory:    /portal/inventory                 |
|  Chat:         /portal/chat                      |
|  Dashboard:    /portal/dashboard                 |
|                                                  |
|  ORDER PRIORITIES:                               |
|    Normal  = 2-3 day lead time                   |
|    Rush    = Next business day                   |
|    Urgent  = Same day (crew waiting)             |
|                                                  |
|  MATERIAL ORDER CHECKLIST:                       |
|    [ ] Job name, number, address                 |
|    [ ] Customer name + phone                     |
|    [ ] Delivery date (day BEFORE install)        |
|    [ ] Delivery time                             |
|    [ ] Priority level                            |
|    [ ] Special instructions                      |
|    [ ] All materials selected with quantities    |
|    [ ] Running total reviewed                    |
|    [ ] Submitted + confirmation received         |
|                                                  |
|  EMERGENCY CONTACTS:                             |
|    Office:  (256) 274-8530                       |
|    Email:   rcrs@rivercityroofingsolutions.com   |
|    Chat:    GroupMe @office                      |
|                                                  |
+--------------------------------------------------+
```

---

## NOTEBOOKLM GENERATION PROMPTS

Use the following prompts with NotebookLM to create supplementary training content:

1. **Mind Map:**
   "Create a mind map of Production Manager features: Order Creation, Inventory View, Schedule, Delivery Tracking, Task Management, Communication. For each feature, list the key actions, the URL path, and when during the day a PM typically uses it."

2. **Material Order Lifecycle Flowchart:**
   "Create a flowchart: Material Order Lifecycle — from PM creating order to materials arriving at job site. Show every step and who is responsible at each step (PM, Office, Driver). Include the status changes: Submitted, Confirmed, Loaded, In Transit, Delivered."

3. **Video Script:**
   "Write a 5-minute video script: 'Production Manager Portal — Ordering Materials and Coordinating Deliveries.' The audience is a new Production Manager at a roofing company. Walk through creating an order, checking inventory, tracking delivery, and handling an urgent same-day need. Keep the tone practical and conversational."

4. **Quick-Reference Card:**
   "Create a printable quick-reference card (fits on one page) for Production Managers at River City Roofing Solutions. Include: key portal URLs, step-by-step order creation (abbreviated), the 11 material products list, order priority definitions, morning checklist, end-of-day checklist, and emergency contact information."

---

## COMPLETION CHECKLIST

Before marking this module complete, verify you can do all of the following:

- [ ] Log in to the portal and navigate to your dashboard
- [ ] Create a complete material order with all fields filled
- [ ] Check inventory levels and identify low-stock items
- [ ] View your schedule in day, week, and month views
- [ ] Track a delivery from Submitted through Delivered
- [ ] Send a message in GroupMe (main channel and DM)
- [ ] Find and read the Monday Notes
- [ ] Create an urgent same-day order from your phone
- [ ] Sync your portal calendar with Google Calendar

**When all boxes are checked, you are ready for production. Welcome aboard, John.**
