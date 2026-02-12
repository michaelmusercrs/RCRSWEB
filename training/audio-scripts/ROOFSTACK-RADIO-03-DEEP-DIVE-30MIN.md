# AUDIO SCRIPT 03: The RCRS Platform -- The Complete Deep Dive

**Type:** Deep-Dive Podcast-Style Narration
**Duration:** ~30 minutes (~4,500 words)
**Tone:** Professional, conversational podcast host with transitions and recaps
**Audience:** Full RCRS team

---

## SCRIPT

### Opening

Hey everyone. Welcome to the deep dive. Over the next thirty minutes, I am going to take you through the entire RCRS platform -- every section, every integration, every role, and how it all connects. If you listened to the two-minute overview or the ten-minute walkthrough, this is the full story. Grab a coffee, settle in, and let's go.

### Why This Platform Exists

Before I get into features, I want to talk about why we built this. River City Roofing Solutions has been around since 2010. Three generations of the Muse family. We have always been a company built on honest assessments, quality workmanship, and showing up when we say we will. But as the company grew -- more reps, more territories, more jobs -- we hit the wall that every growing business hits. Information was everywhere. Leads came in through phone calls, texts, walk-ins, referrals, and the website, and tracking them meant spreadsheets that got out of date the moment someone forgot to update a cell. Delivery schedules lived in people's heads. Commission tracking was a manual process that took hours. Nobody had a single source of truth.

So we built one. The RCRS platform is a fully custom web application that runs the entire business -- from the moment a homeowner lands on our website to the moment we collect payment and share their customer portal. Every team member, from Chris and Michael at the top to Richard on the delivery truck, logs into one system and sees exactly what they need to do their job. Nothing more, nothing less.

Here is the scale we are talking about. Three hundred sixty-seven pages. Over one hundred eighty API routes powering the backend. Eighty-five reusable components. Ninety-five library and service files. Seventeen team members with role-based access. And nine major sections that cover every corner of this business.

Let's walk through all nine.

### Section One: The Public Website

The public website at rivercityroofingsolutions.com is not a five-page brochure. It is over three hundred pages of SEO-optimized content designed to bring homeowners to us twenty-four hours a day, seven days a week.

The homepage has a video background hero section, service highlights, customer testimonials, a service area map, and an inline contact form. There is a floating contact button that follows you as you scroll and a promotional banner at the top for seasonal offers.

The blog is sixty-eight professionally written articles covering roofing materials, storm damage, insurance claims, maintenance tips, and local guides. Every single article has structured data -- that is JSON-LD markup -- which tells Google exactly what the article is about, who wrote it, and when it was published. Boston manages the content and analytics on this, and it is a major driver of organic search traffic.

We have seventeen team profile pages -- one for every member of the RCRS team. Each profile has a photo, position, tagline, full bio, key strengths, responsibilities, and contact info. Sales reps, those profile pages are live and shareable. When you are talking to a prospect, send them your page. It builds trust.

There are eleven service pages covering everything from residential roof replacement and repair to commercial roofing, storm and hail damage, chimney services, LeafX gutter protection, inspections, emergency services, gutter repair, attic ventilation, and roof coatings. Each page includes pricing ranges, timelines, what is included, and a call to action to schedule an inspection.

Location pages for Huntsville, Madison, and Decatur provide localized content with customer reviews and response time information. Service area pages cover those three markets plus Athens, Owens Crossroads, and North Alabama generally, with expansion pages for Birmingham -- where Hunter is our regional partner -- and Nashville, where Aaron is setting up operations for 2026.

Every public page has Google Analytics tracking under measurement ID G-Y8PB85BZC5, and analytics only fire after the user accepts our cookie consent banner, so we are compliant with privacy standards.

The contact form is straightforward. Name, email, phone, address, service needed, message. When someone submits it, the data goes to Google Sheets, a Google Apps Script sends an email notification to the team, a GroupMe notification goes to the group chat, and the user gets redirected to a thank-you page. We also have a referral rewards page with a rewards calculator and a BNI networking page for Business Network International partnerships.

### Section Two: Check My Address

Now let's talk about one of the most powerful tools on the platform. Check My Address lives at slash-check-my-address, and it is linked from the header, the footer, and the homepage.

Here is how it works. A homeowner enters their street address, city, state, and ZIP code, along with their name, email, and phone number. Behind the scenes, the system queries the National Weather Service for active weather alerts and pulls historical hail report data from Iowa State Mesonet within a configurable radius around that address. It also pulls wind event data. Then it runs a risk scoring algorithm that produces a score from zero to one hundred.

Zero to twenty-five is low risk. Twenty-six to fifty is moderate. Fifty-one to seventy-five is high. And seventy-six to one hundred is severe. The score goes up based on the number of hail reports in the area, how close the nearest hail event was, how large the hail was, how recent the events were, whether there are active weather alerts, and whether there were associated wind events.

The homeowner sees a color-coded risk level, a count of total hail reports, the distance to the closest hail event, the size of the largest hail, a timeline of individual hail events with dates and severity, wind events, active alerts, plain-English risk factors explaining the score, and a recommendation to schedule a free inspection.

But here is the part that matters for us -- it automatically creates a lead. The homeowner's name, email, phone, address, and the full storm report are all captured in the system and stored in Google Sheets, with optional sync to JobNimbus.

Sales reps, this is your door-knocking secret weapon. Pull up a homeowner's address on your phone, show them their personalized storm report, point to the specific hail events near their property, and offer a free inspection right there on the spot. That is a conversation starter that no competitor has.

### Section Three: The Command Center

Alright, let's move into the internal operations side. The Command Center is the executive dashboard -- the cockpit of the business. Owners and managers, this is your home base.

At the top of the dashboard, you have KPI cards showing Revenue Month-to-Date with month-over-month growth, Revenue Year-to-Date, Gross Margin percentage and gross profit, Pipeline Value, Net Cash Flow, and Accounts Receivable with overdue amounts highlighted. Below that is a twelve-month revenue trend chart so you can see exactly where we are compared to where we have been.

The team performance section shows per-rep stats -- sales count, revenue, close rate -- with a top performer highlight and alerts for underperforming reps. There is an auto-generated insights panel that flags unusual patterns, spikes, or drops in the data.

The sales leaderboard lives at slash-command-center-slash-sales. This is where we track all reps ranked by revenue, close rate, or transaction count. We have over two-point-six million dollars in tracked commissions across four thousand one hundred ninety-nine transactions in the system, going back to 2019. Each rep gets a profile with what we call Rep DNA -- a breakdown of their individual performance characteristics. There are achievement milestones and badges, and you can filter by month, quarter, or year.

Financial reports give you revenue breakdowns, gross margins by service type, cash flow analysis, invoice aging at thirty, sixty, and ninety-plus days, overdue alerts, and commission summaries by rep. Team reports offer cross-team comparisons and printable formats perfect for Monday meetings.

Lead management is a full company-wide lead dashboard. You can search and filter by status, source, assigned rep, or date range. Quick-assign lets you push a lead to a rep directly from the list. Source analytics tell you which channels -- website, referral, door knock, Check My Address -- are producing the best leads, and there is geographic mapping of lead locations.

The marketing hub has a campaign management system with ten ad variations across Facebook, Instagram, Google, and print. There are five pre-built email templates, a content calendar for planning posts, and an ads performance dashboard.

The meeting module is built for our Monday meetings. You prep at slash-command-center-slash-meetings-slash-prep, which auto-pulls the week's KPIs, leaderboard standings, lead pipeline, inventory alerts, and schedule. Then you present in a slides-style view, and after the meeting, notes and action items get archived.

And the phone system tracks eight extensions with call history, voicemail management, analytics on call volume and busiest hours, and extension configuration.

Let me do a quick recap before we move on. So far we have covered the public website with three hundred-plus pages of SEO content, Check My Address as our lead capture and door-knocking tool, and the Command Center as the executive dashboard with leaderboard, financials, leads, marketing, meetings, and phone system. Now let's get into the portals that the rest of the team uses every day.

### Section Four: The Sales Portal

Sales team, this one is yours. The Sales Portal is built mobile-first because you are in the field, not behind a desk. Everything is designed to work from your phone while you are standing on a roof or sitting in your truck.

Your dashboard opens with a personalized welcome and a hot streak indicator. There is a commission progress bar showing your real-time earnings against your goals. Quick stats show your active leads, deals closed, rank on the leaderboard, and commission earned. A team comparison card tells you whether you are above or below the team average.

Quick-action buttons let you make a call, schedule an inspection, send a quote, or upload inspection photos -- all in one tap. The priority leads section shows your hottest leads with inline buttons to call, text, send a customer portal link, or view full details without leaving the page. There is a recent activity timeline and a today's inspections section with map navigation for route planning. At the bottom, a persistent mobile nav bar keeps Dashboard, Leads, Quick Call, Stats, and Portal all within thumb reach.

Lead management tracks every lead through a clear workflow -- New, Contacted, Inspection Scheduled, Quote Sent, Won, or Lost. You can search by name or address, filter by status, and update a lead's status right from the list.

The customer CRM section is powered by JobNimbus with two-way sync. You get a customer list pulled directly from JobNimbus, and each customer has a six-tab detail view: Overview with contact info, Active Jobs, Job History, Documents like contracts and estimates, Messages with the full communication log, and Transactions for payments and invoices. Changes you make in the portal sync back to JobNimbus, and changes in JobNimbus sync to the portal.

Your performance dashboard tracks your personal KPIs -- close rate, average deal size, response time, inspections per week -- with comparisons to previous periods, individual targets set by management, and trend graphs over multiple weeks and months.

### Section Five: The Office Portal

Sara, Tia, Destin, John -- this is your workspace. The Office Portal is built around a four-tab dashboard.

Tab one is your overview with stats cards showing active delivery tickets, tickets completed today, pending invoices, and the total pending dollar amount. Tab two is delivery ticket management where you can search by job name, customer, or address, filter by status -- and there are twelve possible statuses from Created all the way through Completed -- assign or reassign drivers, and pull materials from inventory. Tab three is invoice management where you can filter by All, Pending, Sent, Paid, or Overdue, and mark invoices as paid with one click. Tab four is the order creation form.

That order form deserves special attention. You enter the job name and address, customer contact information, project manager details, the delivery date and time window, priority level, and any special instructions. Then you select materials from a product grid with a running total at the bottom. When you hit submit, it creates the order, generates a delivery ticket, updates inventory levels, and notifies the assigned driver -- all in one step.

The office also handles scheduling and calendar management, lead entry for walk-ins and phone calls, and phone operations across all eight extensions.

### Section Six: Delivery and Driver Portal

Richard, Tae, John -- this is your daily operations screen. The delivery hub has two views -- a list view and a map view -- showing all deliveries. Summary stats show total active, en route, completed today, and unassigned tickets. If tickets are unassigned, a prominent banner alerts you with quick-assign buttons.

The route management page gives each driver an ordered sequence of stops with total distance, estimated completion time, and a progress bar. Every stop has a one-tap Google Maps navigation button, status indicators, priority flags like Rush or Urgent, customer info with a clickable phone number, and action buttons to mark arrival, complete delivery, or capture proof.

Before leaving the warehouse, drivers go through the loading checklist. That means verifying every material item against the ticket, confirming quantities, taking photos of loaded materials, running a safety check, and signing off digitally. Once the checklist is complete, the ticket advances to Load Verified and the driver is clear to depart.

At each job site, proof of delivery is captured -- photos of delivered materials, delivery notes, customer signature if applicable, and an automatic timestamp. The ETA system recalculates arrival times based on stop number, total stops, and an average of thirty minutes per stop, and it sends customer notifications when the driver is en route.

### Section Seven: Inventory Management

Inventory tracks eleven roofing material products -- nails, bottom caps, synthetic felt, ice and water shield, ridge vent, bullet boots in four sizes, sealant, and zipper boots. Each product has a name, category, unit of measure, supplier, cost, price, current quantity, and minimum quantity threshold.

Everything syncs in real time with Google Sheets. When stock drops below the minimum quantity, a low-stock alert fires and shows up on the Command Center, the office portal, and the inventory pages. Every stock movement -- every addition, every subtraction -- is logged in the transaction history with who made the change, when they made it, and why. That is a full audit trail.

Here is an important detail about cost visibility. Owners and admins see the full dollar costs and prices. Managers see costs. Office staff see prices and quantities. Sales reps see quantities only. Drivers can adjust stock levels, but every change is logged with their ID. This way, everyone has the information they need for their job without seeing data that is not relevant to their role.

### Section Eight: Billing and Invoicing

Billing turns completed jobs into invoices and tracks every dollar from creation through payment. Invoices are generated from job data with pre-filled customer and job details. They follow a status workflow -- Created, Sent, Paid, or Overdue.

Customer aging reports group outstanding invoices by age -- zero to thirty days, thirty-one to sixty, sixty-one to ninety, and ninety-plus. Each bucket shows the count and total dollar amount, with overdue amounts highlighted. Commission calculations are tied to closed deals, so when an invoice moves to Paid, the rep's commission updates. Invoices can be exported as PDFs, and overdue alerts make sure nothing falls through the cracks.

Job breakdowns show the detailed cost analysis for each job -- materials cost, labor cost, overhead, and margin. This data lives in the Job Breakdowns Google Sheets tab and is accessible from the Command Center billing section.

### Section Nine: Training and Onboarding

The last section is Training, and it lives at slash-portal-slash-training with three learning paths.

Sales Training has seven modules: Company Overview, Products and Services, Insurance Claims, Sales Process, Objection Handling, Platform Tools, and Customer Communication. Each module has content sections with pro tips, followed by a quiz. You need seventy percent to pass, and you can retry if you do not make it. Complete all seven and you earn a certificate with your name, completion date, and scores.

Interface Onboarding walks you through eight sections of the platform -- Dashboard Overview, Team Management, Delivery System, Inventory, Calendar and Scheduling, Order Management, Reporting, and Admin Settings. Each section has step-by-step instructions with Try It links that take you directly to the relevant page so you learn by doing.

RCRS University is for ongoing professional development with extended learning modules.

All training progress is tracked in Google Sheets, and management can see who has completed what from the admin training view.

Alright, let me recap the nine sections. Public Website for SEO and lead generation. Check My Address for storm reports and lead capture. Command Center for executive visibility. Sales Portal for reps in the field. Office Portal for daily operations. Delivery Portal for drivers and routes. Inventory for material tracking. Billing for invoices and payments. And Training for onboarding and development. Now let's talk about how all of this connects.

### The Integrations

There are eight major integrations powering this platform, and understanding them helps you understand why everything works together so well.

First, Google Sheets. This is the primary database. We have seventeen-plus tabs managing team members, inventory, inventory logs, commissions, customers, orders, deliveries, geocoded contacts, lead distribution logs, rep availability, rep preferences, lead response logs, job breakdowns, team access overrides, agent directory, agent visits, training progress, storm reports, blog posts, images, settings, page views, and profile views. The platform reads from and writes to these tabs in real time through a Google service account. If the Sheets API is ever unavailable, the system falls back to local data so nothing breaks.

Second, JobNimbus CRM. This is our customer relationship management system, and it runs a full two-way sync. Contacts, jobs, and notes sync bidirectionally between the portal and JobNimbus. When a job status changes in the portal, it updates in JobNimbus. When something changes in JobNimbus, webhooks trigger updates in the portal. Commission calculations pull job values directly from JobNimbus data. The sync engine paginates through up to one hundred pages of data and tracks sync state with timestamps, counts, and error logs.

Third, GroupMe. Team chat is built right into the portal. You get group channels for team-wide conversations, direct messages for one-on-one chats, at-mentions with autocomplete, image and file sharing, and a floating chat widget on every portal page. Messages poll every ten seconds for near-real-time updates. The system also sends automated notifications to GroupMe for new leads, low inventory alerts, job status changes, delivery updates, and more.

Fourth, Google Calendar. We use URL-based calendar links -- never ICS files -- for scheduling. When you schedule an inspection, the system generates a Google Calendar link with the event title, date, time, location, and attendee emails auto-resolved from the team roster at rcrsal.com. One click and it is on your calendar.

Fifth, TeamUp. This is our shared team calendar for crew scheduling and job site coordination. It syncs bidirectionally with the platform, so events created in either system appear in both.

Sixth, the National Weather Service. The NWS API provides storm and hail data for Check My Address, plus weather forecasts and alerts for the customer portal. No API key required -- it is public data.

Seventh, Google Analytics with measurement ID G-Y8PB85BZC5 tracks all visitor behavior on the public site. It respects cookie consent and only fires after the user opts in.

And eighth, Vercel Blob. This is our file storage for images, documents, delivery photos, and profile pictures. Files are uploaded through the admin interface and served from Vercel's global CDN for fast loading.

### The Eight Roles

Let's talk about who sees what. The platform has eight roles, and each one gets a tailored experience.

Owners -- that is Chris and Michael. They have wildcard access to everything. Full Command Center, all portals, all data, all settings. Level one hundred in the permission hierarchy.

Admins -- Sara Hill is the primary admin. She has full access with approval authority, managing day-to-day operations across every section.

Managers -- Destin McCury sits at level eighty. She has operations oversight with view-all access and manages the office workflow.

Sales -- Hunter, Aaron, Greg, Brendon, Rick, Rudy, and Adam. They see the Sales Portal with their own leads, their own commissions, their own performance stats, and the team leaderboard. They cannot see other reps' leads or financial reports.

Office -- Tia Morris handles billing, inventory, schedule management, and lead entry. She sees the Office Portal with delivery tickets, invoices, and the order creation form.

Project Managers -- John Cordonis and Bart Roberts. John handles production management, job scheduling, material orders, and delivery coordination. Bart specializes in insurance claims.

Drivers -- Richard Geahr and Tae Orr. They see the Driver Portal with their delivery queue, route navigation, loading checklists, photo uploads, and signature capture. Tae doubles as Materials Manager.

And Marketing -- Boston manages content, analytics, and the blog through the marketing hub in the Command Center.

Every role can access training, chat, and their own profile. Beyond that, the role-based access control system makes sure you see exactly what you need and nothing you do not.

### Security and Authentication

Security has three layers. First, admin authentication uses JWT tokens stored in httpOnly cookies. The admin password is an environment variable with no hardcoded fallbacks. Every admin API route runs through a requireAdmin middleware check.

Second, portal authentication uses email plus a four-digit PIN. Each team member has a unique PIN defined in the system. Login creates a JWT session with the user's role and permissions embedded. Route guards check the user's role against a mapping of which portals each role can access.

Third, customer portal authentication is token-based. Each customer gets a unique URL. No password required -- the token in the URL is the credential. Tokens are generated per customer and stored in Google Sheets.

On top of that, we have HMAC webhook signature validation to prevent spoofing from external systems, rate limiting on authentication endpoints, input validation on all API routes, auth checks on one hundred-plus routes, and no test credentials anywhere in production.

### The Complete Data Flow

Now let me walk you through how all of this connects in a real scenario. A lead comes in -- maybe someone fills out the contact form, maybe they use Check My Address, maybe a current customer submits a referral, or maybe Sara enters a phone call manually.

That lead hits the form service, which writes a record to Google Sheets, sends an email notification through Google Apps Script, and posts a notification to GroupMe. The lead distribution service scores and ranks all eligible reps based on proximity, availability, close rate, response time, and other factors, then assigns the lead to the best-fit rep. The assignment is logged, the rep is notified via GroupMe, and the contact is created in JobNimbus.

The rep opens their Sales Portal, sees the new lead in their priority list, and gets to work. They call, they schedule an inspection via Google Calendar, they show up, they send a quote. If the homeowner says yes, the lead status moves to Won and a job is created in JobNimbus.

Now the office takes over. A material order is created in the Office Portal, which auto-generates a delivery ticket and updates inventory. A driver is assigned. The driver opens the loading checklist, verifies every item, takes photos, signs off, and hits the road. The ETA system calculates arrival times and sends the customer a notification. At the job site, the driver captures proof of delivery -- photos, notes, signature -- and the ticket moves to Completed.

An invoice is generated from the job data, sent to the customer, and tracked through the billing system. When payment comes in, it is marked as paid, the rep's commission updates automatically, and the customer receives a portal link where they can track their job timeline, see weather alerts, access documents, and stay connected with us.

That entire lifecycle -- from a stranger landing on our website to a happy customer with their own portal -- runs through this one platform. No gaps, no lost information, no "I didn't get that message."

### Key Metrics We Track

Let me highlight the numbers that matter. Revenue month-to-date and year-to-date with growth percentages. Gross margin and gross profit. Pipeline value showing potential revenue in active leads and quotes. Cash flow. Accounts receivable with overdue amounts broken out by aging bucket. Over two-point-six million dollars in tracked commissions across four thousand one hundred ninety-nine transactions. Per-rep stats including sales count, revenue, close rate, average deal size, and response time. Lead source analytics showing which channels convert best. Inventory levels with low-stock alerts. Delivery completion rates. Training progress across the team. And website traffic and conversion data from Google Analytics.

All of this is visible in real time from the Command Center. No waiting for end-of-month reports. No guessing.

### What Is Coming Next

The platform is live and fully functional, but we are not done. Here is what is on the roadmap.

We are moving toward Redis-backed rate limiting for production-grade security on authentication endpoints. Twilio integration for SMS notifications -- think appointment reminders and delivery ETA texts directly to customer phones. SendGrid for more sophisticated email campaigns beyond what Google Apps Script handles today. Facebook Pixel and Google Ads conversion tracking for marketing attribution so Boston can see exactly which ads drive the most leads. And continued expansion of the CRM sync engine to handle higher volumes as we scale into Birmingham and Nashville.

We are also planning deeper AI-driven insights -- smarter lead scoring that learns from our close rate data, predictive inventory recommendations based on seasonal trends, and automated follow-up suggestions based on how long a lead has been sitting without contact. The goal is to make the platform not just a system of record but a system that actively helps you sell more and serve customers better.

### Wrapping Up

Here is the bottom line. The RCRS platform is one system that runs the entire business. It replaced scattered spreadsheets, forgotten texts, and manual processes with a unified application that works on any device. Every lead is captured. Every delivery is tracked. Every dollar is accounted for. Every team member knows exactly what to do and has the tools to do it.

Log in to your portal at rivercityroofingsolutions.com/portal. Training kicks off February seventeenth. Complete the Interface Onboarding by February twenty-first. Sales team, start Sales Training Module One by the end of the month. If you have questions, talk to Michael or Sara.

This platform is how we go from a good roofing company to a great one. Three generations of the Muse family built this business on hard work and integrity. Now we have the technology to match. Let's make it count.

---

*River City Roofing Solutions | (256) 274-8530 | rcrs@rivercityroofingsolutions.com*
