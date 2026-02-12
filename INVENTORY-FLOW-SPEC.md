# RCRS Inventory & Delivery Workflow Specification

## Document Status: DRAFT - Ready for Review
## Last Updated: 2026-02-06
## Source: Google Keep Document (1).docx + Codebase Audit

---

## Overview

18-stage material order lifecycle from PM creation through final job close. Each stage has an assigned role, required actions, time constraints, and notification targets.

---

## Stage Map

```
CREATION         PREPARATION              TRANSIT              DELIVERY             BILLING/CLOSE
─────────        ───────────              ───────              ────────             ─────────────
1.ORDER_CREATED  3.DRIVER_ASSIGNED        7.DEPARTURE_CONFIRMED 10.UNLOADING        14.OFFICE_NOTIFIED
  → 2.ORDER_     4.WAREHOUSE_NOTIFIED     8.EN_ROUTE            11.DELIVERY_        15.BILLING_CREATED
    REVIEWED     5.MATERIALS_PULLED       9.ARRIVED_AT_SITE       CONFIRMED         16.INVOICE_SENT
                 6.LOAD_VERIFIED                                12.SIGNATURE_        17.PAYMENT_RECEIVED
                                                                  CAPTURED           18.JOB_CLOSED
                                                                13.QC_PHOTOS
```

---

## Stage-by-Stage Specification

### Stage 1: ORDER_CREATED
| Field | Value |
|-------|-------|
| **Owner** | PM (Project Manager) |
| **Required** | Job details, material list, delivery date |
| **Optional** | Special instructions, priority flag |
| **Photo** | No |
| **GPS** | No |
| **Est. Time** | 5 min |
| **Max Time** | 60 min |
| **Notifies** | Office |
| **Auto-checks** | Check inventory availability |
| **JN Sync** | Pull job data (address, customer, PM) from JN by `jnid` |
| **Code Status** | BUILT - `order-workflow-service.ts:createOrder()`, `material-job-flow.ts` stage defined |

### Stage 2: ORDER_REVIEWED
| Field | Value |
|-------|-------|
| **Owner** | Office |
| **Required** | Verify pricing, check customer info, confirm availability |
| **Optional** | Adjust pricing, add notes |
| **Photo** | No |
| **GPS** | No |
| **Est. Time** | 15 min |
| **Max Time** | 120 min |
| **Notifies** | PM |
| **Auto-checks** | Validate pricing rules, check credit limit |
| **JN Sync** | Cross-check customer/job data; pull estimate amounts |
| **Code Status** | BUILT - `order-workflow-service.ts:approveOrder()`, status transition `submitted → approved` |

### Stage 3: DRIVER_ASSIGNED
| Field | Value |
|-------|-------|
| **Owner** | Office |
| **Required** | Select driver, set delivery time |
| **Optional** | Set route order, driver notes |
| **Photo** | No |
| **GPS** | No |
| **Est. Time** | 10 min |
| **Max Time** | 60 min |
| **Notifies** | Driver |
| **Auto-checks** | Check driver availability, optimize route |
| **JN Sync** | Push activity note to JN job record |
| **Code Status** | BUILT - `order-workflow-service.ts:scheduleDelivery()`, `delivery-portal-service.ts` driver assignment |

### Stage 4: WAREHOUSE_NOTIFIED
| Field | Value |
|-------|-------|
| **Owner** | System (automated) |
| **Required** | Send notification, generate pull sheet |
| **Optional** | — |
| **Photo** | No |
| **GPS** | No |
| **Est. Time** | 2 min |
| **Max Time** | 5 min |
| **Notifies** | Warehouse |
| **Auto-checks** | Print pull sheet, update inventory hold |
| **JN Sync** | None (internal only) |
| **Code Status** | PARTIAL - `delivery-workflow-service.ts` has notification types but no auto-trigger on status change |

### Stage 5: MATERIALS_PULLED
| Field | Value |
|-------|-------|
| **Owner** | Warehouse |
| **Required** | Pull all materials, stage at dock, mark complete |
| **Optional** | Note substitutions, report shortages |
| **Photo** | Yes |
| **GPS** | No |
| **Est. Time** | 30 min |
| **Max Time** | 120 min |
| **Notifies** | Driver, Office |
| **Auto-checks** | Update inventory counts, flag discrepancies |
| **JN Sync** | None (internal only) |
| **Code Status** | BUILT - `order-workflow-service.ts:createLoadingManifest()`, `updateManifestItem()` |

### Stage 6: LOAD_VERIFIED
| Field | Value |
|-------|-------|
| **Owner** | Driver |
| **Required** | Count items, check against manifest, confirm load |
| **Optional** | Take load photo, note issues |
| **Photo** | Yes |
| **GPS** | Yes |
| **Est. Time** | 15 min |
| **Max Time** | 45 min |
| **Notifies** | Office |
| **Auto-checks** | Validate quantities, check weight limits |
| **JN Sync** | None (internal only) |
| **Code Status** | BUILT - `order-workflow-service.ts:verifyLoad()`, transitions to `ready_for_delivery` |

### Stage 7: DEPARTURE_CONFIRMED
| Field | Value |
|-------|-------|
| **Owner** | Driver |
| **Required** | Confirm departure |
| **Optional** | Set ETA |
| **Photo** | No |
| **GPS** | Yes |
| **Est. Time** | 2 min |
| **Max Time** | 10 min |
| **Notifies** | PM, Office |
| **Auto-checks** | Log departure time, start GPS tracking |
| **JN Sync** | Push status update to JN job |
| **Code Status** | BUILT - `order-workflow-service.ts:updateOrderStatus('in_transit')` sets `departedAt` |

### Stage 8: EN_ROUTE
| Field | Value |
|-------|-------|
| **Owner** | Driver |
| **Required** | Navigate to site |
| **Optional** | Update ETA, report delays |
| **Photo** | No |
| **GPS** | Yes (continuous) |
| **Est. Time** | 45 min |
| **Max Time** | 180 min |
| **Notifies** | — (PM gets ETA updates if enabled) |
| **Auto-checks** | Track location, monitor for delays |
| **JN Sync** | None (internal tracking) |
| **Code Status** | PARTIAL - `voice-notification-service.ts` has GPS settings, `delivery-portal-service.ts` tracks location, but no real-time push to portal |

### Stage 9: ARRIVED_AT_SITE
| Field | Value |
|-------|-------|
| **Owner** | Driver |
| **Required** | Confirm arrival |
| **Optional** | Note site conditions, contact customer |
| **Photo** | Yes |
| **GPS** | Yes |
| **Est. Time** | 2 min |
| **Max Time** | 10 min |
| **Notifies** | PM |
| **Auto-checks** | Verify GPS matches job address |
| **JN Sync** | Push "driver arrived" activity to JN |
| **Code Status** | BUILT - `delivery-workflow-service.ts` status `arrived`, driver portal has arrival confirmation |

### Stage 10: UNLOADING
| Field | Value |
|-------|-------|
| **Owner** | Driver |
| **Required** | Unload all materials, place as instructed |
| **Optional** | Take placement photos |
| **Photo** | Yes |
| **GPS** | No |
| **Est. Time** | 20 min |
| **Max Time** | 60 min |
| **Notifies** | — |
| **Auto-checks** | — |
| **JN Sync** | None |
| **Code Status** | BUILT - `material-job-flow.ts` stage defined, `delivery-workflow-service.ts` status `delivered` covers this |

### Stage 11: DELIVERY_CONFIRMED
| Field | Value |
|-------|-------|
| **Owner** | Driver |
| **Required** | Confirm all items delivered, note issues |
| **Optional** | Add delivery notes |
| **Photo** | Yes |
| **GPS** | Yes |
| **Est. Time** | 5 min |
| **Max Time** | 15 min |
| **Notifies** | PM, Office |
| **Auto-checks** | Update delivered quantities |
| **JN Sync** | Push delivery confirmation + quantities to JN |
| **Code Status** | BUILT - `order-workflow-service.ts:updateOrderStatus('delivered')`, `delivery-workflow-service.ts` has proof_captured status |

### Stage 12: SIGNATURE_CAPTURED
| Field | Value |
|-------|-------|
| **Owner** | Driver |
| **Required** | Get customer/site rep signature, enter signer name |
| **Optional** | Photo with signer |
| **Photo** | No |
| **GPS** | Yes |
| **Est. Time** | 5 min |
| **Max Time** | 15 min |
| **Notifies** | Office |
| **Auto-checks** | Validate signature data |
| **JN Sync** | Attach signature image to JN job documents |
| **Code Status** | PARTIAL - `material-job-flow.ts` defines `signature_captured` stage, driver portal has signature pad UI, but no actual upload/storage pipeline confirmed working |

> **NOTE**: This stage was missing from the original Google Keep document (jumped from 11 to 13). It exists in the codebase as `signature_captured` in `material-job-flow.ts`.

### Stage 13: QC_PHOTOS
| Field | Value |
|-------|-------|
| **Owner** | Driver |
| **Required** | Photos of materials at site, site overview photo |
| **Optional** | Before/after photos |
| **Photo** | Yes (required) |
| **GPS** | Yes |
| **Est. Time** | 5 min |
| **Max Time** | 20 min |
| **Notifies** | Office |
| **Auto-checks** | Verify photos uploaded, tag with GPS |
| **JN Sync** | Upload QC photos to JN job file attachments |
| **Code Status** | BUILT - `delivery-workflow-service.ts` has `qc_photos` status + photo types, `material-job-flow.ts` stage defined |

### Stage 14: OFFICE_NOTIFIED
| Field | Value |
|-------|-------|
| **Owner** | System (automated) |
| **Required** | Send notification, update job status |
| **Optional** | — |
| **Photo** | No |
| **GPS** | No |
| **Est. Time** | 1 min |
| **Max Time** | 5 min |
| **Notifies** | Office, Billing |
| **Auto-checks** | Compile delivery report, queue for billing |
| **JN Sync** | Update JN job status to reflect delivery complete |
| **Code Status** | PARTIAL - `workflow-alerts.ts` has alert infrastructure, but no automatic trigger when QC photos complete |

### Stage 15: BILLING_CREATED
| Field | Value |
|-------|-------|
| **Owner** | Billing |
| **Required** | Review delivered materials, create billing record, apply pricing |
| **Optional** | Adjust quantities, add fees |
| **Photo** | No |
| **GPS** | No |
| **Est. Time** | 15 min |
| **Max Time** | 3 days (4320 min) |
| **Notifies** | Admin |
| **Auto-checks** | Validate pricing, check duplicates, flag high values |
| **JN Sync** | Create invoice record in JN |
| **Code Status** | BUILT - `order-workflow-service.ts:generateInvoice()`, `billing-workflow-service.ts` has full billing status machine |

### Stage 16: INVOICE_SENT
| Field | Value |
|-------|-------|
| **Owner** | Billing |
| **Required** | Generate invoice PDF, send to customer |
| **Optional** | Email PDF, add to job folder |
| **Photo** | No |
| **GPS** | No |
| **Est. Time** | 5 min |
| **Max Time** | 60 min |
| **Notifies** | PM |
| **Auto-checks** | Generate PDF, log in JobNimbus |
| **JN Sync** | Push invoice PDF + amount to JN, update JN financial record |
| **Code Status** | PARTIAL - Invoice generation exists but PDF generation and email send are not implemented |

### Stage 17: PAYMENT_RECEIVED
| Field | Value |
|-------|-------|
| **Owner** | Billing |
| **Required** | Record payment, update status |
| **Optional** | Send receipt |
| **Photo** | No |
| **GPS** | No |
| **Est. Time** | Variable |
| **Max Time** | 30 days (43200 min) |
| **Notifies** | Admin |
| **Auto-checks** | Update financials, send to accounting |
| **JN Sync** | Update JN payment status, mark paid |
| **Code Status** | STUB - Invoice status field exists (`paid`), but no payment recording workflow or JN push |

### Stage 18: JOB_CLOSED
| Field | Value |
|-------|-------|
| **Owner** | System (automated) |
| **Required** | Close job |
| **Optional** | Generate final report |
| **Photo** | No |
| **GPS** | No |
| **Est. Time** | 1 min |
| **Max Time** | 5 min |
| **Notifies** | PM, Office |
| **Auto-checks** | Archive documents, update metrics |
| **JN Sync** | Update JN job status to closed, push final material costs |
| **Code Status** | STUB - `material-job-flow.ts` defines stage, no auto-close logic implemented |

---

## Gap Analysis Summary

### What's BUILT (works or nearly works)
- Stage definitions in `material-job-flow.ts` (all 18 stages)
- Order CRUD in `order-workflow-service.ts`
- Loading manifest / material pull tracking
- Driver portal page with status progression UI
- Delivery ticket lifecycle in `delivery-workflow-service.ts`
- Photo type definitions and upload structure
- Quality checklist generation
- Invoice generation (amounts/line items)
- Delivery route creation with Google Maps links
- Return order processing
- SLA monitoring and bottleneck detection in `workflow-alerts.ts`
- Voice delivery controller for hands-free driver operation
- Restock workflow with personnel routing (Rick, Destin, Sara)
- Google Sheets sync for inventory data
- Job sync service with JN field mapping

### What's PARTIAL (scaffolded but not wired)
- **Stage 4 auto-trigger**: Warehouse notification doesn't fire automatically on driver assignment
- **Stage 8 real-time GPS**: GPS settings exist but no live location push to dashboard
- **Stage 12 signature pipeline**: UI exists, but upload → storage → JN attachment chain untested
- **Stage 14 auto-trigger**: No automatic office notification when QC photos complete
- **Stage 16 PDF + email**: Invoice data generates but no PDF rendering or email delivery
- **JN sync on status changes**: `job-sync-service.ts` can push to JN but isn't called from stage transitions
- **Notification delivery**: Alert types defined but no actual push notification, SMS, or email sending

### What's MISSING (not built)
- **Payment recording workflow** (Stage 17) - no UI or API for marking paid
- **Auto-close logic** (Stage 18) - no trigger when payment received → close job
- **Stage transition enforcement** - `isValidTransition()` exists but isn't called in any API route
- **SLA alert delivery** - alerts calculated but never sent anywhere
- **JN bi-directional sync** - can push to JN but doesn't pull status changes back
- **Photo storage backend** - photo types defined but actual Vercel Blob upload pipeline not connected to workflow stages
- **Inventory deduction on delivery** - inventory counts not reduced when materials leave warehouse
- **Overdue escalation** - `maxDuration` defined per stage but no cron/scheduled check

---

## JobNimbus Integration Points

| Stage | Direction | What Syncs |
|-------|-----------|------------|
| 1 | **JN → RCRS** | Pull job/customer data by jnid |
| 2 | **JN → RCRS** | Pull estimate amounts for pricing validation |
| 3 | **RCRS → JN** | Push "delivery scheduled" activity note |
| 7 | **RCRS → JN** | Push "driver departed" status |
| 9 | **RCRS → JN** | Push "driver arrived" activity |
| 11 | **RCRS → JN** | Push delivery confirmation + quantities |
| 12 | **RCRS → JN** | Attach signature to JN documents |
| 13 | **RCRS → JN** | Upload QC photos to JN file attachments |
| 14 | **RCRS → JN** | Update JN job status = delivered |
| 15 | **RCRS → JN** | Create/push invoice record |
| 16 | **RCRS → JN** | Push invoice PDF + amount |
| 17 | **RCRS → JN** | Update payment status |
| 18 | **RCRS → JN** | Close JN job, push final costs |

**Current JN integration**: `jobnimbus-service.ts` supports contacts, jobs, estimates, tasks, and activities via REST API. `job-sync-service.ts` maps local JobRecord ↔ JN fields. Neither is currently called from the delivery workflow stage transitions.

---

## Delegatable Task Breakdown

### TASK GROUP A: Wire Stage Transitions (Foundation)
> **Assign to**: Senior dev / yourself
> **Depends on**: Nothing

- [ ] **A1**: Add `transitionStage()` function to `order-workflow-service.ts` that enforces valid transitions using `isValidTransition()` from `material-job-flow.ts`
- [ ] **A2**: Add JN sync hooks inside `transitionStage()` - call `jobSyncService` methods at stages 3, 7, 9, 11, 14, 15, 17, 18
- [ ] **A3**: Add auto-trigger for Stage 4 (warehouse notification) when Stage 3 completes
- [ ] **A4**: Add auto-trigger for Stage 14 (office notification) when Stage 13 completes
- [ ] **A5**: Add auto-trigger for Stage 18 (job closed) when Stage 17 payment recorded

### TASK GROUP B: Notifications (Critical Path)
> **Assign to**: Backend dev
> **Depends on**: A1

- [ ] **B1**: Implement notification delivery (email via Google Apps Script, or direct SMTP)
- [ ] **B2**: Wire SLA alerts from `workflow-alerts.ts` to actually send (email to office/admin)
- [ ] **B3**: Add overdue stage checker - scheduled function that runs every 15 min, checks `maxDuration` per active order
- [ ] **B4**: Push notifications to driver portal (real-time or polling)

### TASK GROUP C: Driver Portal Hardening
> **Assign to**: Frontend dev
> **Depends on**: A1

- [ ] **C1**: Test full stage progression through driver portal UI (Stages 6-13)
- [ ] **C2**: Wire photo uploads to Vercel Blob storage with GPS metadata
- [ ] **C3**: Wire signature capture → upload → save reference on order
- [ ] **C4**: Add real-time GPS tracking display on office dashboard
- [ ] **C5**: Test voice delivery controller end-to-end

### TASK GROUP D: Billing Pipeline
> **Assign to**: Backend/billing dev
> **Depends on**: A1, A2

- [ ] **D1**: Build payment recording UI + API (Stage 17)
- [ ] **D2**: Implement invoice PDF generation (html-to-pdf or similar)
- [ ] **D3**: Implement invoice email send to customer
- [ ] **D4**: Wire inventory deduction when materials confirmed delivered (Stage 11)
- [ ] **D5**: Wire JN invoice/payment sync (Stages 15-17)

### TASK GROUP E: JN Sync Integration
> **Assign to**: Backend dev with JN API access
> **Depends on**: A2

- [ ] **E1**: Test JN API connection with current key (verify not expired)
- [ ] **E2**: Implement `pushActivityToJob(jnid, message)` wrapper
- [ ] **E3**: Implement `pushFileToJob(jnid, file)` for photos/signatures
- [ ] **E4**: Implement `updateJobStatus(jnid, status)` for Stages 14, 18
- [ ] **E5**: Implement `pushInvoiceToJob(jnid, invoiceData)` for Stage 15-16
- [ ] **E6**: Add bi-directional sync: pull JN status changes back on dashboard load

### TASK GROUP F: Testing & QA
> **Assign to**: QA / yourself
> **Depends on**: A-E

- [ ] **F1**: Create test order, walk through all 18 stages manually
- [ ] **F2**: Verify each JN sync point pushes correct data
- [ ] **F3**: Verify SLA alerts fire on overdue stages
- [ ] **F4**: Test with rush/urgent priority orders
- [ ] **F5**: Test return order flow (pickup type tickets)
- [ ] **F6**: Verify inventory counts decrease after delivery
- [ ] **F7**: Load test: 10+ simultaneous active orders
- [ ] **F8**: Mobile test: driver portal on phone browsers

---

## Existing Files Reference

| File | Lines | Role |
|------|-------|------|
| `lib/material-job-flow.ts` | 523 | Stage definitions, transitions, health checks, visualization |
| `lib/order-workflow-service.ts` | 1365 | Order CRUD, manifests, invoices, routes, returns, QC |
| `lib/delivery-workflow-service.ts` | 1556 | Delivery tickets, photos, checklists, activity log |
| `lib/delivery-portal-service.ts` | 700 | Portal service for drivers, inventory, orders |
| `lib/restock-workflow-service.ts` | 700 | Stock arrival/verification with personnel routing |
| `lib/billing-workflow-service.ts` | 150+ | Billing status machine, vendor tracking |
| `lib/workflow-alerts.ts` | 508 | SLA monitoring, bottleneck detection |
| `lib/voice-delivery-controller.ts` | 690 | Voice commands for driver hands-free |
| `lib/voice-notification-service.ts` | 100+ | Voice synthesis, GPS tracking settings |
| `lib/inventory-sheets-sync.ts` | 453 | Google Sheets 2-way inventory sync |
| `lib/jobnimbus-service.ts` | 400+ | JN API client (contacts, jobs, estimates, tasks) |
| `lib/job-sync-service.ts` | 230+ | JobRecord ↔ JN field mapping + Sheets storage |
| `app/portal/driver/page.tsx` | 645 | Driver mobile interface |
| `app/api/portal/orders/route.ts` | 295 | Order API endpoints |
| `app/api/portal/delivery/route.ts` | 224 | Delivery API endpoints |

---

## Priority Order for Implementation

1. **Group A** (Wire transitions) - everything depends on this
2. **Group E1** (Test JN API key) - quick check, unblocks E2-E6
3. **Group C1-C3** (Driver portal test) - validates the most-used path
4. **Group B1-B2** (Notifications) - people need to know things happened
5. **Group D1-D3** (Billing pipeline) - completes the money flow
6. **Group F** (Full QA) - end-to-end validation

---

## Notes

- The original Google Keep document skipped Stage 12 (SIGNATURE_CAPTURED) in its numbering (went 11 → 13). The codebase has it as a defined stage. This spec includes it.
- Three separate service files handle overlapping delivery concerns (`order-workflow-service.ts`, `delivery-workflow-service.ts`, `delivery-portal-service.ts`). A future refactor should consolidate, but for now, `material-job-flow.ts` is the single source of truth for stage definitions.
- All data flows through Google Sheets (no traditional database). This means concurrent writes can race. The workflow should use row-level locking patterns (read-modify-save) and avoid parallel writes to the same order.
