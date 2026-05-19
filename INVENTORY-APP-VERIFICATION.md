# Inventory App — E2E Verification Checklist

**Integration branch:** `inventory-final-integration`
**Vercel preview URL:** `https://rcrs-portal-git-inventory-final-integration-michaelmusercrs.vercel.app`
**Built on:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 cleanup

Use Chrome to walk this list. Items that pass get a ✅; anything that fails gets opened as a follow-up.

---

## 0. Pre-flight (Vercel env vars)

Confirm these are set on the `rcrs-portal` project (Vercel → Settings → Environment Variables):

- [ ] `GOOGLE_SHEETS_ID` / `DELIVERY_SHEETS_ID` — master sheet `1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s`
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`
- [ ] `JOBNIMBUS_API_KEY` — for stage transition notes pushed to JN
- [ ] `ANTHROPIC_API_KEY` — for vendor pricing PDF parser
- [ ] `NTFY_BASE_URL` (default `https://ntfy.sh` is fine; set if self-hosting later)
- [ ] `NTFY_TOPIC_OFFICE`, `_WAREHOUSE`, `_DRIVERS`, `_ADMIN`, `_BILLING` — defaults are `rcrs-office` etc. and work out of the box
- [ ] Email SMTP or Google Apps Script endpoint (`NEXT_PUBLIC_GOOGLE_SCRIPT_ENDPOINT`)
- [ ] Vercel cron registered for `/api/cron/predictive-stock` at `0 6 * * *` (added to `vercel.json` in Phase 5)

---

## 1. Stage 1 — ORDER_CREATED (PM creates a material order)

- [ ] Open `/portal/orders/new` as a PM. Pick a real JobNimbus job by ID. Add 2-3 line items (e.g., 1 bundle IKO Dynasty, 5 rolls felt). Submit.
- [ ] Order appears at `/portal/delivery/pipeline` with stage `ORDER_CREATED`.
- [ ] Office gets email notification (check `rcrs@rcrsal.com` inbox).
- [ ] ntfy push received on `rcrs-office` topic (subscribe in the ntfy app first).
- [ ] If the order is linked to a JN job, JN should NOT yet have a stage note (push starts at DRIVER_ASSIGNED).

## 2. Stage 3 — DRIVER_ASSIGNED

- [ ] Office advances the order from the pipeline page; assigns Rick or Travis.
- [ ] Driver receives email + ntfy push on `rcrs-drivers`.
- [ ] **JN job gets a new activity note**: `[RCRS Delivery] Stage 3: Driver Assigned ...`.

## 3. Stage 5 — MATERIALS_PULLED (warehouse pulls)

- [ ] Warehouse opens `/portal/warehouse` or `/portal/delivery/loading-assist`. Walks through TTS-guided pick.
- [ ] Photo upload required. Driver photo uploader compresses (<500KB), shows live thumbnail, progress bar.
- [ ] Drop airplane mode mid-upload → toast says "queued offline." Restore wifi → toast says "X items synced."

## 4. **🔑 Stage 6 — LOAD_VERIFIED (the critical business-rule stage)**

This is the load-bearing change from Phase 1. Verify the FULL chain:

- [ ] Driver opens delivery, taps "Load Verified" (or auto-triggered by geofence — see step 12).
- [ ] **Inventory `currentQty` decrements** in Google Sheets `Inventory_Products` tab. Open the sheet in another tab and confirm.
- [ ] **Customer invoice (PRICE ONLY) is created** in Sheets `PipelineInvoices` tab with status `draft`.
- [ ] **Internal invoice (purchase + final)** also created with `type='internal'`.
- [ ] Office receives email with the new invoice link.
- [ ] **JN job gets activity note**: `Stage 6: Load Verified ... Truck loaded with N item type(s). Total price: $X`.
- [ ] PDF invoice can be downloaded at `/api/portal/billing/payments/pdf?invoiceId=CINV-...&variant=customer` — confirm the PDF has NO cost numbers anywhere.

## 5. Stage 7-11 — En route → delivery confirmed

- [ ] Departure: driver taps confirm, GPS captured. JN note posted.
- [ ] En-route GPS pings update the route tracker (`/portal/delivery/route-tracker`).
- [ ] Geofence at the job site fires the arrival event (or driver taps manually).
- [ ] Delivery confirmed: driver photo + GPS. **Stock does NOT deduct again** (it deducted at Stage 6). Confirm `Inventory_Products.currentQty` is unchanged from after Stage 6.
- [ ] JN gets a delivery-confirmed activity note.

## 6. Stage 12-13 — Signature + QC photos

- [ ] Signature pad captures, uploads with GPS metadata.
- [ ] QC photos uploaded.

## 7. Stage 14-16 — Office Notified → Billing Review → Invoice Sent

- [ ] System auto-fires OFFICE_NOTIFIED. (Manual confirm visible in pipeline.)
- [ ] Office advances to BILLING_REVIEW. Invoices already exist from Stage 6 — confirm no duplicates created (the Phase 6 idempotency guard).
- [ ] Office advances to INVOICE_SENT. Customer receives email at `order.customerEmail` with:
  - Subject "Invoice for ... from River City Roofing"
  - Body links to a permanent Vercel Blob URL of the PDF
  - PDF attached (if Google Apps Script endpoint upgraded) OR linked
  - cc Michael, Chris, Sara
- [ ] JN gets an INVOICE_SENT note.

## 8. Stage 17 — PAYMENT_RECEIVED

- [ ] Office opens `/portal/billing/payments`. Sees the sent invoice.
- [ ] Clicks "Mark Paid". Modal fills with amount, date, method (check/card/ACH/cash), reference #.
- [ ] On submit: pipeline advances to PAYMENT_RECEIVED → then JOB_CLOSED.
- [ ] Customer receives receipt PDF (with rotated "PAID" stamp).
- [ ] JN gets a "Payment received: $X" note.
- [ ] Job marked closed.

## 9. Returns flow

- [ ] Open `/portal/delivery/returns`. Create a Return-to-Stock for an item from a delivered order.
- [ ] Driver flow (photo at job site + GPS + photo at warehouse) walks through.
- [ ] On confirmed: `unifiedInventoryService.addStock()` runs, qty increases. Credit memo appears on the job breakdown.
- [ ] Create a Return-to-Distributor. No inventory bump (we don't own it yet). Log entry confirmed.

## 10. Inventory features (Phase 4)

- [ ] `/portal/inventory/low-stock` — items below reorder point listed. Click "Create PO" → draft restock PO appears in `/portal/inventory/restock`.
- [ ] `/portal/inventory/vendors` — 6 distributors seeded. Edit/save works.
- [ ] `/portal/inventory/count` — three tabs: Full, Cycle, Item. Cycle picks 5-10 random items.
- [ ] `/portal/admin/audit` — audit log filters by date/actor/action. Search works.
- [ ] `/portal/settings/notifications/push` — test push fires to each role topic.

## 11. Forecast + vendor pricing (Phase 5)

- [ ] `/portal/inventory/forecast` — pulls JN signed jobs in next 14d, shows projected consumption per material with storm-buffer indicator if NWS reports a hail/wind alert.
- [ ] Trigger the cron manually: `GET /api/cron/predictive-stock?secret=<CRON_SECRET>` — should return JSON with `shortfalls`, `pushed`, `emailsSent`.
- [ ] `/portal/inventory/vendors/pricing` — upload a real Beacon/Gold Eagle price sheet PDF. Confirm Claude Haiku parses to a list of {product, unit, price}. Match score colors (green ≥70% / yellow ≥40%). Apply → `unitCost` updates on matched products.

## 12. Geofence auto-LOAD_VERIFIED (Phase 5)

- [ ] Open `/portal/admin/warehouse-settings`. Set lat/lng (use "use my current GPS" while at warehouse) + 100m radius.
- [ ] In a driver session, drive out past the geofence with an active MATERIALS_PULLED order. The `/api/warehouse/gps-ping` endpoint should fire `advanceStage(orderId, 'LOAD_VERIFIED', ...)` automatically.
- [ ] Driver UI shows the courtesy banner "Looks like you're leaving the warehouse — auto-verified".

## 13. Mobile path (the most important check)

Pull these up on your phone in Chrome (or use Chrome devtools mobile emulator):

- [ ] `/portal/driver` loads, login works.
- [ ] `/portal/delivery/driver` — delivery list scrollable, buttons touch-friendly (≥48px).
- [ ] Photo upload — camera opens, capture, compress, upload progress visible.
- [ ] Offline mode — toggle airplane mode, take action, see "queued offline" toast.
- [ ] QR scan at `/portal/inventory/scan/[productId]` — camera opens, scans rack QR.

## 14. Tech-debt sanity (Phase 6)

- [ ] No "double deduction" — search Google Sheets `InventoryTransactions` for any duplicate `pipeline_delivery` + `legacy_loading` entries on the same orderId.
- [ ] `lib/inventoryData.ts` `lib/inventoryTransactions.ts` `lib/inventory-sheets-sync.ts` have @deprecated banners.
- [ ] 16 remaining read-only callers of `inventoryData` still work (no runtime crashes).

---

## When the checklist is green

1. Open a PR from `inventory-final-integration` → `main` at `https://github.com/michaelmusercrs/RCRSWEB/pull/new/inventory-final-integration`
2. Merge to main.
3. Vercel deploys production. Verify production at `https://rcrsal.com`.
4. Run the checklist one more time against production.
5. Close out master plan.

---

## Known not-tested-by-Claude

These I built but couldn't run end-to-end without your live env:

- Real JN API calls (depends on JOBNIMBUS_API_KEY being live)
- Real ntfy push delivery (depends on you subscribing on your phone)
- Real email send (depends on SMTP or GAS endpoint)
- PDF rendering in Vercel serverless (depends on @react-pdf working at runtime — type-check + build are clean but PDF gen runs on cold lambda)
- Predictive cron pulling NWS data live
- Vendor pricing parser hitting Anthropic API
- Geofence GPS path on a real moving phone

All have graceful fallbacks (log + continue) so failures don't break the pipeline, but you'll want to confirm each one in the wild.
