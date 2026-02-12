# MODULE 7: Materials Manager Training
## River City Roofing Solutions Platform

### Target Audience
Tae — Materials Manager

---

## SECTION 1: SYSTEM FEATURES & FUNCTIONS

### Inventory Management (/portal/inventory + /command-center/inventory)
- **11 Product Categories Tracked**: Shingles/bundles, underlayment, pipe boots, ridge caps, starter strips, drip edge, flashing, ice & water shield, ventilation, sealants, fasteners
- Real-time stock levels synced with Google Sheets
- Low stock alerts when items hit configurable reorder thresholds
- Transaction history for every stock movement (who, what, when, why)
- Stock adjustment with full audit trail
- Individual SKU detail pages (/command-center/inventory/[sku])

### Cost Visibility
- As Materials Manager, you can see full cost data
- Per-item costs, total inventory value
- Cost trends over time
- Vendor pricing comparison capability

### Order Fulfillment
- View incoming material orders from PMs and office staff
- Verify stock availability for each order
- Coordinate with the loading checklist process
- Track which orders have been fulfilled vs pending

### Delivery Coordination
- Monitor delivery tickets connected to material orders
- Coordinate with Richard (driver) on loading priorities
- Verify correct materials loaded for each delivery
- Track delivery completion and material usage

### Vendor/Supplier Management
- Track supplier contacts and relationships
- Monitor reorder needs
- Coordinate bulk purchases
- Manage return processing

### Office Portal Access
- View delivery tickets and their status
- See order creation for context
- Basic billing visibility for material-related invoices

### Communication
- GroupMe for real-time coordination with office, PM, and driver
- Chat with PM (John) about upcoming job material needs
- Chat with driver (Richard) about loading and delivery
- Chat with office about procurement needs

---

## SECTION 2: YOUR USE CASES

### Morning Inventory Check (7:00 AM)
1. Open inventory dashboard → scan all 11 product categories
2. Check low stock alerts → any critical items?
3. Review incoming orders → what materials are needed today?
4. Check delivery tickets → what's going out today?
5. Coordinate with Richard on loading order

### Processing Orders (Throughout Day)
1. New material order arrives (from PM or office)
2. Check inventory → do we have everything requested?
   - YES → release for loading → notify driver
   - NO → flag shortages → contact supplier → notify office of delay
3. Adjust stock levels as materials are pulled
4. Update transaction history

### Restocking Management
1. Monitor approaching reorder thresholds
2. Contact vendors for quotes/availability
3. Place restock orders with preferred suppliers
4. Update inventory when new stock arrives
5. Record transactions with supplier details

### Loading Coordination
1. Review driver's loading checklist
2. Verify correct materials are staged for each delivery
3. Double-check quantities against order
4. Flag any substitutions or shortages
5. Sign off on material accuracy

### End of Day
1. Review all transactions for the day
2. Update any manual stock adjustments
3. Check tomorrow's orders → ensure materials are available
4. Flag any items needing urgent restock
5. Report any discrepancies in GroupMe

---

## SECTION 3: SETTINGS & CONFIGURATION

### First-Time Setup
1. Login at rivercityroofingsolutions.com/portal
2. Enter tae@rcrsal.com + PIN
3. Navigate to inventory sections

### Inventory Settings
- Set reorder thresholds per product (low stock alert triggers)
- Configure preferred suppliers
- Set up notification preferences

### Key Bookmarks
- Inventory: rivercityroofingsolutions.com/portal/inventory
- Inventory Overview: rivercityroofingsolutions.com/command-center/inventory
- Delivery Tickets: rivercityroofingsolutions.com/portal/office (Delivery Tickets tab)
- Chat: rivercityroofingsolutions.com/portal/chat

---

## SECTION 4: HANDS-ON PRACTICE

### Exercise 1: Inventory Audit (5 min)
1. Open /portal/inventory
2. Review all 11 product categories
3. Note current stock levels for each
4. Identify any items at or below reorder threshold
5. Check transaction history for the busiest product

### Exercise 2: Process an Order (5 min)
1. View a pending material order
2. Cross-reference requested materials with current stock
3. Identify any shortages
4. Update stock levels after "pulling" materials
5. Verify the transaction was logged

### Exercise 3: Stock Adjustment (5 min)
1. Select a product
2. Make a manual stock adjustment (e.g., "Received 50 units from supplier")
3. Add a reason note
4. Verify the audit trail shows the change

### Exercise 4: Low Stock Response (5 min)
1. Find an item near its reorder threshold
2. Review its usage history (transaction log)
3. Estimate how quickly it will run out
4. Draft a restock message to share with the office

---

## PROCESS FLOWCHARTS

### Material Flow
```
Vendor delivers stock → Tae receives and counts → Stock updated in system
  → PM creates order for job → Tae verifies availability
  → Materials staged → Driver loads (checklist) → Tae verifies load
  → Driver delivers → Delivery confirmed → Stock auto-decremented
  → Tae monitors levels → Reorder threshold hit → Contact vendor → Repeat
```

---

## NOTEBOOKLM PROMPTS
1. "Create a mind map of Materials Manager responsibilities: Inventory Tracking, Order Fulfillment, Vendor Management, Loading Coordination, Stock Auditing"
2. "Create a flowchart: 'Material Lifecycle — From Vendor to Job Site' showing every step and Tae's role at each"
3. "Write a 5-minute video script: 'Inventory Management — Keeping RCRS Stocked and Ready'"
4. "Create a quick-reference card: Product list with typical reorder quantities and top suppliers"
