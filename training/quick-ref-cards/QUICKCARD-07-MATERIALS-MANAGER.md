# QUICK REFERENCE CARD: MATERIALS MANAGER
## River City Roofing Solutions Platform

**For:** Tae Orr (Materials Manager)
**Role:** `office` (inventory focused) -- Inventory tracking, order fulfillment, loading coordination, vendor management
**Last Updated:** February 10, 2026

---

## LOGIN

| Field | Value |
|-------|-------|
| **URL** | https://www.rivercityroofingsolutions.com/portal |
| **Email** | tae@rcrsal.com |
| **PIN Location** | `lib/team-roles.ts` -- TEAM_MEMBERS array |
| **Login Method** | Email + 4-digit PIN |
| **Default Landing** | /portal/inventory |

---

## TOP 5 BOOKMARKS

1. **Inventory Dashboard** -- /portal/inventory -- All 11 products, real-time stock levels, low stock alerts, transaction history
2. **Inventory Overview** -- /command-center/inventory -- SKU details, cost tracking, reorder thresholds, trends
3. **Delivery Tickets** -- /portal/office -- Delivery Tickets tab for order fulfillment and driver coordination
4. **Team Chat** -- /portal/chat -- GroupMe for coordinating with office, PM (John), and driver (Richard)
5. **Schedule** -- /portal/schedule -- Delivery dates, job timing, planning

---

## DAILY CHECKLIST

### Morning (7:00 AM)
- [ ] Open /portal/inventory -- scan all 11 product categories for stock levels
- [ ] Check low stock alerts -- any items at or below reorder threshold?
- [ ] Review incoming material orders -- what materials are needed today?
- [ ] Check /portal/office -> Delivery Tickets tab -- what deliveries are going out today?
- [ ] Coordinate with Richard on loading order and priorities
- [ ] Check GroupMe (/portal/chat) for overnight messages from PM or office

### Processing Orders (Throughout Day)
- [ ] New material order arrives -> check inventory for availability
- [ ] If stock sufficient: release materials for loading -> notify driver
- [ ] If stock short: flag shortage -> contact supplier -> notify office of delay
- [ ] Adjust stock levels in system as materials are pulled
- [ ] Update transaction history for audit trail
- [ ] Verify driver's loading checklist matches order quantities

### End of Day (4:00-5:00 PM)
- [ ] Review all transactions for the day -- verify accuracy
- [ ] Update any manual stock adjustments with reason notes
- [ ] Check tomorrow's orders -- ensure materials are available
- [ ] Flag any items needing urgent restock to office via GroupMe
- [ ] Report any discrepancies in GroupMe

---

## WEEKLY CHECKLIST

- [ ] Full inventory audit -- verify system quantities match physical counts
- [ ] Review usage trends -- which products are moving fastest?
- [ ] Contact vendors for restocking on items approaching reorder threshold
- [ ] Update reorder thresholds if usage patterns have changed
- [ ] Coordinate with John (PM) on upcoming job material needs for the week
- [ ] Review and reconcile delivery completion records with stock levels

---

## KEY SHORTCUTS

| Action | How |
|--------|-----|
| **Check stock level** | /portal/inventory -> find product -> view quantity on hand + status |
| **Adjust stock** | Select product -> make adjustment -> enter reason note -> save (logged in audit trail) |
| **View transaction history** | /portal/inventory -> select product -> view all movements (who, what, when, why) |
| **Check incoming orders** | /portal/office -> Delivery Tickets tab -> filter by status (Planned, In Transit, etc.) |
| **Flag low stock** | GroupMe: "@office [product] is low -- [X] units remaining, need reorder" |
| **View SKU detail** | /command-center/inventory/[sku] -> full detail page with cost, trend, history |

---

## COMMON TASKS

| Task | Steps |
|------|-------|
| **Process a material order** | View incoming order -> cross-reference requested items with /portal/inventory -> stock sufficient? Release for loading + notify driver. Stock short? Flag to office + contact supplier. |
| **Receive a vendor shipment** | Count incoming materials against purchase order -> update stock in /portal/inventory -> add transaction: "Received [X] units from [supplier]" with reason note -> verify audit trail logged |
| **Coordinate driver loading** | Review driver's loading checklist -> verify correct materials are staged for each delivery -> double-check quantities against order -> flag any substitutions or shortages -> sign off on accuracy |
| **Handle stock discrepancy** | Document the discrepancy -> make manual stock adjustment with detailed reason note -> report in GroupMe -> investigate cause (miscounted? damaged? lost?) |
| **Restock ordering** | Monitor reorder thresholds in /portal/inventory -> contact vendor for quotes/availability -> place order -> note expected delivery date -> receive and count -> update inventory system |
| **Low stock emergency response** | Find item near threshold -> review transaction log for recent usage rate -> estimate days until stockout -> contact vendor immediately -> notify office of timeline -> create restock plan |

---

## 11 PRODUCT CATEGORIES

| # | Product | Unit | Watch For |
|---|---------|------|-----------|
| 1 | Shingles | per bundle | Highest volume -- monitor daily |
| 2 | Underlayment | per roll | Heavy use in rainy season |
| 3 | Ridge Cap | per box | Moderate, steady demand |
| 4 | Drip Edge | per roll | Usually ordered with shingles |
| 5 | Pipe Boots | each | Small item, easy to miss in counts |
| 6 | Ice & Water Shield | per roll | Seasonal spike in winter |
| 7 | Starter Strip | per box | Pairs with shingle orders |
| 8 | Roofing Nails | per box | High volume -- keep well stocked |
| 9 | Flashing | per roll | Varies by job complexity |
| 10 | Ventilation | each | Lower volume, longer lead times from supplier |
| 11 | Plywood/OSB | per sheet | Bulky -- plan storage space, heavy to move |

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| **Cannot log in** | Verify tae@rcrsal.com and PIN. Clear browser cache. Contact Sara (256-810-3594) or Michael (256-221-4290) for PIN reset. |
| **Stock levels not updating after adjustment** | Check Google Sheets connection. The Inventory tab should reflect changes within seconds. If not, refresh the page. If still stuck, verify GOOGLE_SHEETS_ID env var with Michael. |
| **Low stock alert not triggering** | Verify reorder threshold is configured for that product. Check /command-center/inventory for threshold settings. Ask Michael if threshold needs adjustment in inventoryData.ts or Sheets. |
| **Transaction not logging** | Ensure you completed the adjustment with a reason note (required field). Refresh and check transaction history. All stock edits are logged with your name and timestamp. |
| **Material order doesn't match physical count** | Document the discrepancy with a photo. Take actual count. Message the office via /portal/chat with details. Cross-reference against the InventoryLogs audit trail. |
| **Loading checklist missing items** | Checklist is generated from the delivery order. If items are missing, the order may need updating. Contact PM (John) or office BEFORE proceeding with an incomplete load. |
| **Portal not loading** | Check internet connection. Hard refresh (Ctrl+Shift+R). Try a different browser. |

---

## WHO TO CONTACT

| Person | Role | Phone |
|--------|------|-------|
| Sara Hill | Office Manager (procurement, vendor orders) | 256-810-3594 |
| John Cordonis | Production Manager (upcoming job needs) | 256-654-0875 |
| Richard Geahr | Driver (loading coordination) | GroupMe DM |
| Michael Muse | VP / Tech (system issues) | 256-221-4290 |
| Office Main Line | General | 256-274-8530 |

**GroupMe:** @office for procurement requests | @john for job material planning | @richard for loading coordination
**Remember:** All stock changes are logged with your name and timestamp -- accuracy matters!

---

*RCRS Platform -- 367 pages, 180+ API routes, 85+ components*
*Office: 256-274-8530 | rcrs@rivercityroofingsolutions.com*
