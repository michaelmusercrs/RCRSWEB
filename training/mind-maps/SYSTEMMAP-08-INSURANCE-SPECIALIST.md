# MIND MAP: INSURANCE SPECIALIST

```
                                     INSURANCE SPECIALIST
                                    ========================
                                   |  Bart                    |
                                   |  Claims & Documentation  |
                                    ========================
                                              |
        +-----------+-----------+-----------+-+-----------+-----------+-----------+-----------+
        |           |           |           |             |           |           |           |
        v           v           v           v             v           v           v           v
   [CLAIM       [SUPPLEMENT [DOCUMENT   [JOBNIMBUS  [CUSTOMER    [APPROVAL   [PAYMENT    [COMPLIANCE
    TRACKING]   MANAGEMENT]  MANAGEMENT] INTEGRATION] COMMUNIC.]  WORKFLOW]   TRACKING]   & DOCS]
        |           |           |           |             |           |           |           |
   +----+      +----+     +----+      +----+        +----+      +----+      +----+      +----+
   |    |      |    |     |    |      |    |        |    |      |    |      |    |      |    |
   v    v      v    v     v    v      v    v        v    v      v    v      v    v      v    v
  MORE BELOW  MORE BELOW  ...  ...    ...  ...     ...  ...    ...  ...    ...  ...    ...  ...
```

---

## BRANCH 1: CLAIM TRACKING
```
CLAIM TRACKING
|
+---> CLAIM LIFECYCLE
|     |
|     +---> Homeowner Reports Damage ........ Initial damage report
|     +---> Sales Rep Inspects .............. Documents damage with photos
|     +---> Bart Assigned to Claim .......... Opens customer detail in portal
|     +---> Documentation Prepared .......... Photos + storm data + estimate
|     +---> Adjuster Meeting Scheduled ...... Via calendar with Google Calendar link
|     +---> Adjuster Inspects ............... Findings documented in record
|     +---> Claim Decision .................. Approved / Partial / Denied
|     +---> Job Proceeds or Appeal .......... Based on claim outcome
|
+---> STORM DATA RESEARCH
|     |
|     +---> Check My Address Report ......... Pull NWS hail/storm data for property
|     +---> Risk Score (0-100) .............. Color-coded assessment
|     +---> Hail Event Timeline ............. Dates, sizes, severity history
|     +---> Supporting Evidence ............. Documented proof for claim filing
|     +---> Share with Adjusters ............ Provide data package
|
+---> CUSTOMER RECORD ACCESS
|     |
|     +---> Customer Search ................. Find by name, address, or status
|     +---> Filter by Claim Status .......... Active / Pending / Resolved
|     +---> Full Customer Detail ............ 6-tab CRM view
|     +---> Insurance Company Info .......... Policy details and contacts
|
+---> CLAIM STATUS TRACKING
      |
      +---> New Claim ....................... Recently opened
      +---> Under Review .................... Documentation submitted
      +---> Adjuster Scheduled .............. Meeting set
      +---> Pending Decision ................ Awaiting insurance company
      +---> Approved ........................ Claim accepted, job proceeds
      +---> Supplement Filed ................ Additional work identified
      +---> Resolved ........................ Claim fully completed
```

---

## BRANCH 2: SUPPLEMENT MANAGEMENT
```
SUPPLEMENT MANAGEMENT
|
+---> SUPPLEMENT PROCESS
|     |
|     +---> Identify Additional Damage ...... Found during or after initial scope
|     +---> Document with Photos ............ Capture evidence of extra work needed
|     +---> Prepare Supplement Request ...... Detailed description + pricing
|     +---> Upload to Customer Record ....... Documents tab in CRM
|     +---> Submit to Insurance Company ..... File supplement claim
|
+---> SUPPLEMENT TRACKING
|     |
|     +---> Pending Review .................. Submitted, awaiting adjuster
|     +---> Adjuster Re-Inspection .......... Additional site visit scheduled
|     +---> Negotiation ..................... Discuss scope and pricing
|     +---> Approved Amount ................. Agreed supplement value
|     +---> Denied Items .................... Disputed or rejected line items
|
+---> NEGOTIATION TOOLS
|     |
|     +---> Storm Data Evidence ............. NWS reports support scope
|     +---> Photo Documentation ............. Before/during/after images
|     +---> Industry Standards .............. Reference manufacturer specs
|     +---> Historical Precedent ............ Similar claims approved
|
+---> SUPPLEMENT DOCUMENTATION
      |
      +---> Line Item Breakdown ............. Each additional item detailed
      +---> Cost Justification .............. Why each item is necessary
      +---> Supporting Photos ............... Visual evidence attached
      +---> Adjuster Correspondence ......... Communication log
```

---

## BRANCH 3: DOCUMENT MANAGEMENT
```
DOCUMENT MANAGEMENT
|
+---> CLAIM DOCUMENTS
|     |
|     +---> Adjuster Reports ................ Insurance company assessments
|     +---> Supplement Requests ............. Additional scope documentation
|     +---> Inspection Photos ............... Damage documentation images
|     +---> Estimates ....................... Job scope and pricing
|     +---> Contracts ....................... Signed agreements
|     +---> Insurance Correspondence ........ Letters and emails
|
+---> UPLOAD & ORGANIZE
|     |
|     +---> Upload to Customer Record ....... Attach to Documents tab
|     +---> Organize by Type ................ Claims / Photos / Estimates / etc.
|     +---> PDF and Image Support ........... All common file formats
|     +---> Vercel Blob Storage ............. Secure cloud hosting
|
+---> SHARE WITH CUSTOMERS
|     |
|     +---> Customer Portal Access .......... Documents visible in portal
|     +---> Selective Sharing ............... Choose what customer sees
|     +---> Download Available .............. Customer can save documents
|     +---> Transparency Builds Trust ....... Customer sees progress
|
+---> SHARE WITH ADJUSTERS
|     |
|     +---> Documentation Package ........... Photos + storm data + estimate
|     +---> Professional Presentation ....... Organized and complete
|     +---> Easy Reference .................. All docs in one customer record
|
+---> HISTORICAL ACCESS
      |
      +---> Past Customer Documents ......... Access for repeat customers
      +---> Prior Claim Records ............. Reference previous work
      +---> Document Search ................. Find across all records
```

---

## BRANCH 4: JOBNIMBUS INTEGRATION
```
JOBNIMBUS INTEGRATION
|
+---> CUSTOMER RECORDS (/portal/sales/customers)
|     |
|     +---> 6-Tab Customer Detail View
|     |     +---> Tab 1: Overview ........... Contact, address, insurance info
|     |     +---> Tab 2: Active Jobs ........ Current projects with status
|     |     +---> Tab 3: Job History ........ Past completed work
|     |     +---> Tab 4: Documents .......... All claim-related files
|     |     +---> Tab 5: Messages ........... Full communication log
|     |     +---> Tab 6: Transactions ....... Payments and insurance payouts
|     |
|     +---> Policy Details .................. Insurance company and policy number
|     +---> Claim Number .................... Insurance claim reference
|
+---> TWO-WAY SYNC
|     |
|     +---> Portal Updates to JN ............ Changes flow to CRM automatically
|     +---> JN Updates to Portal ............ CRM changes appear in portal
|     +---> Status Sync ..................... Job status syncs both directions
|     +---> Real-Time Webhooks .............. Instant sync on any change
|
+---> JOB STATUS MANAGEMENT
|     |
|     +---> Update Claim Status ............. Progress through stages
|     +---> Add Notes ....................... Activity logged to timeline
|     +---> Assign Team Members ............. Coordinate with sales reps
|     +---> Link Documents .................. Attach to job record
|
+---> CUSTOMER SEARCH
      |
      +---> Search by Name .................. Customer lookup
      +---> Search by Address ............... Property lookup
      +---> Filter by Status ................ Active claims vs. completed
      +---> Filter by Insurance Company ..... Group by insurer
```

---

## BRANCH 5: CUSTOMER COMMUNICATION
```
CUSTOMER COMMUNICATION
|
+---> CUSTOMER PORTAL SHARING
|     |
|     +---> Generate Unique Portal Link ..... Token-based URL per customer
|     +---> Share via Text or Email ......... Send link to homeowner
|     +---> Customer Sees Claim Progress .... Job timeline and status updates
|     +---> Document Access ................. Customer views shared files
|     +---> No Password Required ............ Simple link-based access
|     +---> Builds Trust .................... Transparency during claims process
|
+---> MESSAGE TRACKING
|     |
|     +---> Communication Log ............... All messages in customer record
|     +---> Internal Notes .................. Team-only notes on claim
|     +---> Customer Messages ............... Outbound communication tracked
|     +---> Adjuster Communication .......... Documented in record
|
+---> GROUPME TEAM CHAT
|     |
|     +---> DM Sales Reps ................... About their customers' claims
|     +---> Coordinate with Office .......... Claim-related billing questions
|     +---> Team Updates .................... Claim status announcements
|     +---> File Sharing .................... Share photos and documents
|
+---> PROACTIVE UPDATES
      |
      +---> Claim Filed Notification ........ Let customer know process started
      +---> Adjuster Meeting Scheduled ...... Date and preparation info
      +---> Adjuster Findings ............... What the adjuster reported
      +---> Claim Approved Update ........... Good news delivery
      +---> Supplement Filed Notice ......... Additional scope explained
      +---> Job Progress Updates ............ Construction milestones
```

---

## BRANCH 6: APPROVAL WORKFLOW
```
APPROVAL WORKFLOW
|
+---> INITIAL CLAIM SUBMISSION
|     |
|     +---> Damage Documented ............... Photos and inspection report
|     +---> Storm Data Attached ............. Check My Address risk report
|     +---> Estimate Prepared ............... Scope of work and pricing
|     +---> Submitted to Insurance .......... Claim officially filed
|
+---> ADJUSTER COORDINATION
|     |
|     +---> Schedule Meeting ................ Via /portal/schedule
|     +---> Google Calendar Link ............ One-click calendar event
|     +---> Prepare Documentation Package ... Photos + storm data + estimate
|     +---> Meet at Property ................ Walk damage with adjuster
|     +---> Document Adjuster Findings ...... Record in customer notes
|
+---> CLAIM OUTCOMES
|     |
|     +---> APPROVED (Full) ................. Job proceeds as estimated
|     |     +---> Notify Customer ........... Good news via portal/call
|     |     +---> Schedule Job .............. Materials ordered, crew assigned
|     |     +---> Track to Completion ....... Monitor through install
|     |
|     +---> APPROVED (Partial) .............. Supplement needed for rest
|     |     +---> Document Additional Work .. Photo + scope differences
|     |     +---> File Supplement ........... Submit for remaining amount
|     |     +---> Negotiate ................. Work with adjuster on scope
|     |
|     +---> DENIED .......................... Appeal with additional evidence
|           +---> Review Denial Reason ...... Understand objection
|           +---> Gather Additional Proof ... More photos, data, docs
|           +---> Re-Submit with Evidence ... Stronger case for approval
|           +---> Request Re-Inspection ..... New adjuster visit
|
+---> FINAL APPROVAL TRACKING
      |
      +---> Total Approved Amount ........... Full claim value
      +---> Deductible Amount ............... Customer responsibility
      +---> Supplement Approved ............. Additional approved scope
      +---> Net to RCRS ..................... Revenue from claim
```

---

## BRANCH 7: PAYMENT TRACKING
```
PAYMENT TRACKING
|
+---> INSURANCE PAYMENTS
|     |
|     +---> Initial Claim Payment ........... First insurance check
|     +---> Supplement Payment .............. Additional approved amount
|     +---> Depreciation Recovery ........... Recoverable depreciation check
|     +---> Payment Timeline ................ When each payment expected
|
+---> CUSTOMER PAYMENTS
|     |
|     +---> Deductible Collection ........... Customer's out-of-pocket
|     +---> Upgrade Charges ................. If customer chose premium options
|     +---> Payment Status .................. Pending / Received / Outstanding
|
+---> TRANSACTIONS TAB
|     |
|     +---> All Payments Listed ............. In customer detail Tab 6
|     +---> Payment Amount .................. Dollar value of each payment
|     +---> Payment Source .................. Insurance / Customer / Other
|     +---> Payment Date .................... When received
|     +---> Outstanding Balance ............. What remains unpaid
|
+---> INVOICE COORDINATION
      |
      +---> Invoice Generated ............... From completed job data
      +---> Sent to Customer ................ Via email
      +---> Insurance Payout Applied ........ Credit insurance payments
      +---> Balance Due ..................... Remaining customer responsibility
      +---> Coordinate with Office .......... Billing team processes payments
```

---

## BRANCH 8: COMPLIANCE & DOCUMENTATION
```
COMPLIANCE & DOCUMENTATION
|
+---> CLAIM FILE COMPLETENESS
|     |
|     +---> Inspection Report ............... Damage assessment documented
|     +---> Storm Data Report ............... NWS data for the property
|     +---> Photo Evidence .................. Before, during, after images
|     +---> Estimate / Scope ................ Detailed work specification
|     +---> Adjuster Report ................. Insurance company assessment
|     +---> Contract / Agreement ............ Signed customer authorization
|
+---> INSURANCE COMPLIANCE
|     |
|     +---> Proper Claim Procedures ......... Follow insurance company rules
|     +---> Timely Filing ................... Submit within required windows
|     +---> Accurate Documentation .......... No errors in claim files
|     +---> Supplement Procedures ........... Proper channels for additions
|
+---> RECORD KEEPING
|     |
|     +---> All Documents in CRM ............ Centralized in customer record
|     +---> Communication Log ............... Every interaction documented
|     +---> Status Change History ........... Full timeline of claim progression
|     +---> Financial Records ............... Payments tracked in Transactions tab
|
+---> CUSTOMER PROTECTION
|     |
|     +---> Transparent Process ............. Customer portal shows everything
|     +---> Written Agreements .............. Signed contracts on file
|     +---> Insurance Company Contact ....... Direct communication documented
|     +---> Dispute Resolution .............. Process for handling disagreements
|
+---> REGULATORY AWARENESS
      |
      +---> State Insurance Regulations ..... Alabama requirements
      +---> Contractor Licensing ............ RCRS licensing verified
      +---> Building Code Compliance ........ Work meets local codes
      +---> Warranty Documentation .......... Manufacturer and workmanship warranties
```

---

## FULL OVERVIEW MAP
```
                                    =============================
                                    |   INSURANCE SPECIALIST    |
                                    |          Bart             |
                                    =============================
                                               |
        +----------+----------+----------+-----+-----+----------+----------+----------+
        |          |          |          |           |          |          |          |
     CLAIM     SUPPLEMENT  DOCUMENT  JOBNIMBUS  CUSTOMER   APPROVAL   PAYMENT   COMPLIANCE
    TRACKING   MANAGEMENT  MANAGEMENT INTEGR.   COMMUNIC.  WORKFLOW   TRACKING   & DOCS
    4 areas     4 areas    5 areas    4 areas    4 areas    4 areas    4 areas    5 areas
        |          |          |          |           |          |          |          |
        +----------+----------+----------+-----+-----+----------+----------+----------+
                                               |
            CLAIM FLOW: Damage Report -> Storm Data -> Documentation -> Adjuster
                        -> Approval/Supplement -> Job Completion -> Payment
            KEY URL: rivercityroofingsolutions.com/portal/sales/customers
```

> **Total Access Points**: 34+ distinct features across 8 major branches
> **Role Summary**: Insurance claim management -- from initial filing through adjuster coordination, supplements, approval, and payment collection
