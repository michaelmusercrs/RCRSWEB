# RCRS Delivery Operations Study Guide

## Delivery Lifecycle Overview

The RCRS delivery system manages every delivery through a **12-status lifecycle**. Every ticket flows through these statuses in order, with notifications triggered at key transition points.

The primary flow is:
`assigned` -> `materials_pulled` -> `loading` -> `loaded` -> `qc_passed` -> `en_route` -> `arrived` -> `unloading` -> `delivered` -> `completed`

Returns follow an alternate path:
`delivered` -> `return_pending` -> `returned` -> `completed`

- Tickets are created automatically when material orders are placed
- Each ticket has a unique ID in the format **DT-YYYY-XXXX**
- Priority levels determine loading order: **URGENT** first, then **RUSH**, then **NORMAL**
- Real-time status updates keep all stakeholders informed

## Status Definitions and Requirements

Each status has specific requirements that must be met before advancing:

- **`assigned`**: Ticket created, driver and vehicle assigned. No action needed from driver yet.
- **`materials_pulled`**: Warehouse has gathered all items. Triggers queue notification.
- **`loading`**: Driver taps "Start Loading" and selects a bay. Starts the loading timer.
- **`loaded`**: All materials checked off, load secured. Triggers QC inspection queue.
- **`qc_passed`**: QC inspector completes 12-point checklist. Truck is dispatch-ready.
- **`en_route`**: Driver leaving warehouse. **Sends customer ETA notification.**
- **`arrived`**: Driver at job site. Sends "driver arrived" notification.
- **`unloading`**: Materials being placed on-site. Optional for quick deliveries.
- **`delivered`**: Materials placed, customer confirmed receipt. **Requires delivery photo.**
- **`return_pending`**: Materials need to come back. Requires reason entry.
- **`returned`**: Return materials received and logged at warehouse.
- **`completed`**: All documentation finished. Ticket closed.

## Material Handling Guidelines

Materials at RCRS are classified into four handling categories:

- **HEAVY (Red)**: Shingles, plywood, TPO rolls. Lift with legs, use buddy system for items over 50 lbs (OSHA max for solo lifting). Shingle bundles weigh approximately 70 lbs each.
- **MEDIUM (Amber)**: Underlayment, ridge caps, starter strips. Standard handling. Protect from crushing. Store rolls upright.
- **LIGHT (Blue)**: Nails, flashing, edge metal, small hardware. Keep contained in boxes or bags. Secure loose items to prevent spilling.
- **FRAGILE (Purple)**: Skylights, pipe boots, sealant, caulk. Load last on top. Protect from impact. Temperature-sensitive items should stay in the cab.

### Key Material Notes
- Shingle bundles: Max stack height 15 bundles. In hot weather, they stick together. In cold, they become brittle.
- Plywood sheets: ~50 lbs each. Load flat, centered, and strapped. Never leave unsecured, even briefly.
- Gutter sections: Long and unwieldy. Flag overhangs past tailgate with a red flag.
- Roofing nails: Store in cab or locked toolbox. Loose nails on roads are a serious hazard.

## Loading Procedures

The loading process follows 8 steps every time, without exception:

1. **PPE Check**: Steel-toe boots, work gloves, safety glasses. Add hard hat if forklift is nearby.
2. **Review Ticket**: Read the full ticket including special instructions before touching materials.
3. **Pull Materials**: Gather all items from warehouse. Verify every item and quantity.
4. **Organize by Load Order**: Heavy items first (bottom, cab-side), fragile items last (top).
5. **Load Truck**: Place items methodically. Distribute weight evenly side to side.
6. **Secure Load**: Ratchet straps every 4 feet. Cross-strap shingle stacks in an X pattern.
7. **Verification Photos**: Full truck shot + ticket next to load + strap close-up.
8. **Confirm in System**: Mark load complete in the portal. Wait for QC pass.

### Loading Tips
- Always start loading from the cab end and work toward the tailgate
- Heavy items go on the bottom and as close to the cab as possible
- Never stack more than 15 shingle bundles high
- Use edge protectors on sharp materials to prevent strap damage
- DOT requires loads be secured to withstand **0.8g deceleration**

## Vehicle Capacity Limits

| Vehicle Type | Max Weight | Typical Use |
|---|---|---|
| Cargo Van | 3,000 lbs | Small repairs, gutter accessories |
| Pickup Truck | 4,000 lbs | Medium residential jobs |
| Flatbed Truck | 6,000 lbs | Full reroofs, multi-material loads |
| Box Truck | 10,000 lbs | Large residential or commercial |
| Trailer | 14,000 lbs | Major commercial projects |

- **Yellow warning** appears at **80%** capacity
- **Red warning** appears at **95%** capacity
- Maximum load height: **13'6"** (DOT regulation)
- Always verify total weight before departure

## Safety Protocols

### Required PPE (Always)
- Steel-toe boots
- Work gloves (cut-resistant when handling flashing)
- Safety glasses

### Situational PPE
- Hard hat: When forklift is operating nearby
- High-vis vest: Near active roadways
- Hearing protection: When using power tools

### Emergency Procedures
- **Vehicle breakdown**: Pull over safely, call dispatch, set reflective triangles
- **Traffic accident**: Ensure safety, call 911, then call office. Do not admit fault.
- **Load shift/spill**: Pull over, re-secure if safe, photograph, call dispatch
- **Injury**: First aid if trained, call 911 for serious injury, report to manager
- **Severe weather**: Return to warehouse or shelter. Do not deliver during lightning, 40+ mph winds, or hail.

### Safety Contacts
- Emergency Line: (256) 274-8530 ext 9
- Warehouse Manager: (256) 274-8530 ext 3
- Keep emergency numbers saved in your phone and posted in the cab

## Customer Communication

### On Arrival
- Introduce yourself by name and company
- Confirm the delivery and the items being delivered
- Ask where materials should be staged (driveway, garage, backyard)
- Take before-photos of the property to document existing condition

### During Delivery
- Be professional, courteous, and responsive to questions
- Protect the driveway from staining (use boards under shingle stacks)
- Keep the job site clean as you unload

### Handling Complaints
- Listen fully without interrupting
- Acknowledge: "I understand, and I want to help resolve this."
- Fix it if you can on-site
- Escalate to dispatch if it requires office action
- Document everything in ticket notes
- **Never argue with a customer**

## Returns Workflow

1. Office or driver creates a return ticket with reason (over-order, wrong color, damage)
2. Ticket status set to `return_pending`
3. Driver picks up materials from job site
4. Materials inspected at warehouse for restock-ability
5. Warehouse logs returned items into inventory
6. Ticket updated to `returned`, then `completed`

### Return Reasons
- Over-order (extra materials not needed)
- Wrong color or specification
- Customer canceled job
- Damaged materials discovered on-site
- Weather delay causing project postponement

## Warehouse IoT System

The RCRS warehouse uses smart IoT devices that respond to delivery system status changes:

### Loading Bay Lights
- **Green**: Bay available, pull vehicle in
- **Amber (pulsing)**: Loading in progress
- **Red**: Blocked or maintenance
- **White (flashing)**: Loading complete, QC needed

### Automated Triggers
- `Start Loading` -> Bay light amber, door opens, display updates
- `Mark Load Complete` -> Bay light white (flashing), QC audio announcement
- `QC Passed` -> Bay light green, door opens for exit
- New URGENT ticket -> Speaker announces priority load incoming

### Warehouse Display
- Located above loading bays on main wall
- Shows loading queue, bay status, weather alerts
- Auto-updates every 30 seconds

## AI Assistant Usage

The Loading Assistant is an AI chat tool available during the loading process:

- Ask about **loading order** for specific materials
- Get **safety reminders** and PPE requirements
- Learn **material handling tips** for any product type
- Check **weight limits** and capacity info
- Get **weather preparation** advice (tarping, temperature concerns)
- Access **customer interaction** guidelines
- Troubleshoot **shortages and substitutions**

### How to Use
- Type questions in natural language
- Use the quick question buttons for common topics
- Be specific: "How do I load skylights?" works better than "help"
- The assistant supplements, but does not replace, human judgment and training

## Troubleshooting Common Issues

### Materials Short or Missing
- STOP loading immediately
- Notify the warehouse manager
- Do not substitute without approval
- Document the shortage with photos
- Office will contact the customer about delays

### Vehicle Capacity Exceeded
- Remove lower-priority items first
- Check if another vehicle is available
- Split the delivery into two trips if needed
- Never overload a vehicle to "make it work"

### Customer Not Home
- Call the customer's phone number on the ticket
- Wait 10 minutes, then call dispatch
- Do not leave materials unattended without customer approval
- Document the situation in ticket notes

### Weather Issues
- Check forecast before loading each morning
- If rain is expected: tarp all loads, even for short trips
- Severe weather: pause deliveries, secure warehouse doors
- Notify office and customers of any delays immediately

### Wrong Address or Locked Gate
- Verify address against ticket before departing
- Call the customer for gate codes or alternate access
- Never force entry through a locked gate
- If unreachable, contact dispatch for guidance
