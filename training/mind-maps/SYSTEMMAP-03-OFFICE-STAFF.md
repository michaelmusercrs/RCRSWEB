# MIND MAP: OFFICE STAFF

```
                                       OFFICE STAFF
                                  ========================
                                 | Sara, Tia, Destin      |
                                 | Operations & Logistics  |
                                  ========================
                                            |
        +-----------+-----------+----------++-----------+-----------+-----------+-----------+
        |           |           |          |            |           |           |           |
        v           v           v          v            v           v           v           v
   [OFFICE     [MATERIAL   [DELIVERY  [INVOICE    [CUSTOMER   [CALENDAR  [LEAD       [TEAM
    PORTAL]     ORDERS]    SCHEDULING] MANAGEMENT] PORTAL]    SCHEDULING] PROCESSING] COORD.]
        |           |           |          |            |           |           |           |
   +----+      +----+     +----+     +----+       +----+      +----+      +----+      +----+
   |    |      |    |     |    |     |    |       |    |      |    |      |    |      |    |
   v    v      v    v     v    v     v    v       v    v      v    v      v    v      v    v
  MORE BELOW  MORE BELOW  ...  ...  ...  ...    ...  ...    ...  ...    ...  ...    ...  ...
```

---

## BRANCH 1: OFFICE PORTAL
```
OFFICE PORTAL (/portal/office)
|
+---> DASHBOARD TAB
|     |
|     +---> Active Deliveries .............. Count of in-progress deliveries
|     +---> Completed Today ................ Finished deliveries with check marks
|     +---> Pending Invoices ............... Count awaiting action
|     +---> Pending Amount $ ............... Total outstanding dollars
|     +---> Real-Time Refresh .............. Stats update automatically
|
+---> DELIVERY TICKETS TAB
|     |
|     +---> Full Table View ................ All delivery tickets listed
|     +---> Search Bar ..................... Find by job, customer, or address
|     +---> Status Filter .................. All / Planned / In Transit / Delivered / Cancelled
|     +---> Assign Driver Dropdown ......... Pick from available drivers
|     +---> Pull Materials Action .......... Initiate warehouse prep
|     +---> View Details Action ............ Full ticket information
|
+---> INVOICES TAB
|     |
|     +---> Full Table View ................ All invoices listed
|     +---> Search Bar ..................... Find by customer or invoice number
|     +---> Status Filter .................. All / Pending / Sent / Paid / Overdue
|     +---> Mark Paid Action ............... Record payment received
|     +---> Send/Resend Action ............. Email invoice to customer
|     +---> View Details Action ............ Full breakdown
|
+---> CREATE ORDER TAB
      |
      +---> Job Information ................ Job name, number, address
      +---> Customer Contact ............... Name, phone, email
      +---> Project Manager ................ Who oversees this job
      +---> Delivery Details ............... Date, time, priority, instructions
      +---> Material Selection Grid ........ All 11 products with quantity selectors
      +---> Running Total .................. Auto-calculated at bottom
      +---> Submit ......................... Creates order AND auto-generates delivery ticket
```

---

## BRANCH 2: MATERIAL ORDERS
```
MATERIAL ORDERS (Create Order Tab)
|
+---> JOB INFORMATION
|     |
|     +---> Job Name ....................... Reference title for the project
|     +---> Job Number ..................... System ID or JobNimbus number
|     +---> Job Address .................... Delivery destination
|     +---> Job Type ....................... Roofing / Gutters / Siding / Storm
|
+---> MATERIAL SELECTION GRID (11 Products)
|     |
|     +---> Shingles (bundles) ............. Primary material
|     +---> Underlayment (rolls) ........... Barrier layer
|     +---> Ridge Caps (boxes) ............. Peak finishing
|     +---> Drip Edge (rolls) .............. Water runoff
|     +---> Pipe Boots (each) .............. Flashing around pipes
|     +---> Ice & Water Shield (rolls) ..... Cold protection
|     +---> Starter Strips (boxes) ......... Edge starter
|     +---> Roofing Nails (boxes) .......... Fasteners
|     +---> Flashing (rolls) ............... Joint sealing
|     +---> Ventilation (units) ............ Attic airflow
|     +---> Plywood/OSB (sheets) ........... Decking material
|
+---> DELIVERY DETAILS
|     |
|     +---> Preferred Date ................. When materials needed on site
|     +---> Preferred Time ................. Morning / Afternoon / Specific
|     +---> Priority Level ................. Normal / Rush / Urgent
|     +---> Special Instructions ........... Gate codes, placement, access notes
|
+---> RUNNING TOTAL & SUBMIT
      |
      +---> Auto-Calculated Total .......... Sum updates as quantities change
      +---> Validation Check ............... Required fields verified
      +---> Auto-Creates Delivery Ticket ... Instant ticket for driver assignment
      +---> Notifies PM & Driver ........... Alerts sent automatically
```

---

## BRANCH 3: DELIVERY SCHEDULING
```
DELIVERY SCHEDULING
|
+---> TICKET MANAGEMENT
|     |
|     +---> View All Tickets ............... Complete delivery ticket list
|     +---> Unassigned Tickets ............. Needs driver assignment
|     +---> Today's Deliveries ............. Current day active routes
|     +---> Upcoming Deliveries ............ Scheduled for future dates
|
+---> DRIVER ASSIGNMENT
|     |
|     +---> Available Drivers .............. Who is free today
|     +---> Current Load ................... Deliveries per driver
|     +---> Reassign ....................... Move ticket to different driver
|     +---> Auto-Suggest ................... Based on proximity and load
|
+---> STATUS TRACKING
|     |
|     +---> Planned ........................ Not yet started
|     +---> Loading ........................ Materials being prepared
|     +---> In Transit ..................... Driver en route
|     +---> Delivered ...................... Materials on site
|     +---> Problem ........................ Issue flagged
|
+---> ETA & NOTIFICATIONS
|     |
|     +---> Real-Time ETA .................. Updated dynamically
|     +---> Customer Notification .......... Automated delivery alerts
|     +---> Office Notification ............ Status change alerts
|     +---> PM Notification ................ Production manager updates
|
+---> DELIVERY VERIFICATION
      |
      +---> Proof of Delivery Photos ....... Driver captures at site
      +---> Delivery Notes ................. Placement details
      +---> Completion Timestamp ........... When delivery finished
      +---> Customer Confirmation .......... Sign-off if applicable
```

---

## BRANCH 4: INVOICE MANAGEMENT
```
INVOICE MANAGEMENT (/portal/office - Invoices Tab)
|
+---> GENERATE INVOICES
|     |
|     +---> From Completed Jobs ............ Pull data from JobNimbus
|     +---> Manual Entry ................... Custom invoice creation
|     +---> Line Items ..................... Materials + labor breakdown
|     +---> Auto-Calculate Totals .......... Sum of all line items
|
+---> INVOICE LIFECYCLE
|     |
|     +---> Pending ........................ Created, not yet sent
|     +---> Sent ........................... Emailed to customer
|     +---> Paid ........................... Payment received and recorded
|     +---> Overdue ........................ Past due date
|
+---> PAYMENT PROCESSING
|     |
|     +---> Mark as Paid ................... Record payment received
|     +---> Payment Date ................... When payment came in
|     +---> Payment Method ................. Check / card / insurance payout
|     +---> Partial Payments ............... Allow multiple installments
|
+---> OVERDUE MANAGEMENT
|     |
|     +---> 30-Day Warning ................. First follow-up trigger
|     +---> 60-Day Escalation .............. Second tier follow-up
|     +---> 90-Day Critical ................ Escalate to management
|     +---> Resend Invoice ................. Re-email as reminder
|
+---> REVENUE TRACKING
      |
      +---> Monthly Totals ................. Revenue by month
      +---> By Customer .................... Outstanding per customer
      +---> Aging Report ................... 0-30 / 31-60 / 61-90 / 90+ days
      +---> Total Outstanding .............. Sum of all unpaid invoices
```

---

## BRANCH 5: CUSTOMER PORTAL ACCESS
```
CUSTOMER PORTAL ACCESS
|
+---> VIEW ACTIVE PORTALS
|     |
|     +---> Customer Portal List ........... All active portal links
|     +---> Access Status .................. Active / Expired / Revoked
|     +---> Last Customer Visit ............ When customer last logged in
|     +---> Portal Activity ................ What customer viewed
|
+---> SHARE PORTAL LINKS
|     |
|     +---> Generate Link .................. Create unique token URL
|     +---> Send via Email ................. Email portal link to customer
|     +---> Send via Text .................. SMS portal link
|     +---> Copy to Clipboard .............. For manual sharing
|
+---> CUSTOMER VIEW INCLUDES
|     |
|     +---> Job Timeline ................... Step-by-step project progress
|     +---> Delivery Status ................ Material delivery tracking
|     +---> Documents ...................... Shared contracts and photos
|     +---> Messages ....................... Two-way communication
|     +---> Weather Updates ................ Local conditions
|     +---> Appointments ................... Upcoming scheduled visits
|
+---> DOCUMENT SHARING
      |
      +---> Upload Documents ............... Add files to customer portal
      +---> Organize by Type ............... Contracts / Photos / Estimates
      +---> Customer Downloads ............. Track what they accessed
      +---> Vercel Blob Storage ............ Secure file hosting
```

---

## BRANCH 6: CALENDAR & SCHEDULING
```
CALENDAR & SCHEDULING (/portal/schedule)
|
+---> CALENDAR VIEWS
|     |
|     +---> Month View ..................... Full month grid
|     +---> Week View ...................... 7-day detail view
|     +---> Day View ....................... Hour-by-hour schedule
|
+---> APPOINTMENT CREATION
|     |
|     +---> Schedule Inspections ........... From incoming requests
|     +---> Coordinate Deliveries .......... Align with driver availability
|     +---> Book Meetings .................. Internal and external
|     +---> Google Calendar Link ........... Auto-generated event link
|
+---> GOOGLE CALENDAR SYNC
|     |
|     +---> Create Events .................. Via URL link format
|     +---> View All Appointments .......... From all reps and staff
|     +---> Bi-Directional ................. Changes flow both ways
|
+---> TEAMUP INTEGRATION
|     |
|     +---> Crew Scheduling ................ Shared team calendar
|     +---> Bi-Directional Sync ............ Events appear in both systems
|     +---> Color Coding ................... By team or event type
|
+---> CONFLICT DETECTION
      |
      +---> Double-Booking Alert ........... Same person at same time
      +---> Resource Overlap ............... Truck or crew conflicts
      +---> Visual Warning ................. Highlighted conflict indicators
```

---

## BRANCH 7: LEAD PROCESSING
```
LEAD PROCESSING
|
+---> INCOMING CALL WORKFLOW
|     |
|     +---> Answer Call .................... Customer inquiry comes in
|     +---> Capture Info ................... Name, phone, email, address
|     +---> Service Interest ............... What do they need?
|     +---> Source Tag ..................... "Phone Call" / "Walk-In" / "Referral"
|
+---> CREATE NEW LEAD
|     |
|     +---> Customer Name .................. First and last name
|     +---> Phone Number ................... Primary contact
|     +---> Email Address .................. For follow-up
|     +---> Property Address ............... Where the work is needed
|     +---> Service Type ................... Roofing / Gutters / Inspection / etc.
|
+---> QUICK-ASSIGN TO REP
|     |
|     +---> Select Rep ..................... Dropdown of active sales reps
|     +---> Round-Robin Suggest ............ Next in fair rotation
|     +---> Proximity Suggest .............. Closest available rep
|     +---> Auto-Notify Rep ................ Instant notification on assignment
|
+---> LEAD STATUS VIEW
|     |
|     +---> All Leads Dashboard ............ Company-wide pipeline
|     +---> Filter by Status ............... New / Contacted / Scheduled / etc.
|     +---> Filter by Rep .................. See individual rep pipelines
|     +---> Filter by Source ............... Website / Phone / Referral / etc.
|
+---> WEBSITE FORM LEADS
      |
      +---> Auto-Captured .................. From contact form submissions
      +---> Check My Address Leads ......... Hail report submissions
      +---> Referral Form Leads ............ Referral program entries
      +---> Google Sheets Logged ........... All form data tracked
```

---

## BRANCH 8: TEAM COORDINATION
```
TEAM COORDINATION
|
+---> GROUPME CHAT
|     |
|     +---> Team Channel ................... Company-wide communication
|     +---> Department Groups .............. Sales / Office / Field
|     +---> Direct Messages ................ Private one-on-one
|     +---> @Mentions ...................... Tag people for urgent items
|     +---> Floating Widget ................ Quick access from any portal page
|
+---> PHONE SYSTEM
|     |
|     +---> 8 Extensions ................... Individual staff lines
|     +---> Call Transfers .................. Blind or warm transfer
|     +---> Voicemail Management ........... Check any extension inbox
|     +---> Call History ................... Inbound / outbound / missed
|     +---> Extension Status ............... Available / Busy / Away
|
+---> MONDAY NOTES
|     |
|     +---> View Weekly Notes .............. Leadership announcements
|     +---> Contribute Updates ............. Add office department news
|     +---> Monday Notes Admin (Sara) ...... Create and broadcast to team
|     +---> Past Archives .................. Searchable history
|
+---> TEAM DIRECTORY
      |
      +---> 17 Team Members ................ All staff listed
      +---> Contact Info ................... Phone, email, extension
      +---> Roles & Departments ............ Quick reference
      +---> Quick Dial ..................... Tap to call any member
```

---

## FULL OVERVIEW MAP
```
                                    =============================
                                    |      OFFICE STAFF         |
                                    |   Sara, Tia, Destin       |
                                    =============================
                                               |
        +----------+----------+----------+-----+-----+----------+----------+----------+
        |          |          |          |           |          |          |          |
    OFFICE     MATERIAL   DELIVERY   INVOICE    CUSTOMER   CALENDAR    LEAD      TEAM
    PORTAL     ORDERS    SCHEDULING  MGMT       PORTAL    SCHEDULING  PROCESS   COORD.
    4 tabs     4 areas    5 areas   5 areas    4 areas    5 areas    5 areas   4 areas
        |          |          |          |           |          |          |          |
        +----------+----------+----------+-----+-----+----------+----------+----------+
                                               |
                          OPERATIONS HUB: Deliveries, invoices, leads, and team coordination
                          KEY URL: rivercityroofingsolutions.com/portal/office
```

> **Total Access Points**: 36+ distinct features across 8 major branches
> **Role Summary**: Central operations hub managing orders, deliveries, invoices, leads, and team coordination
