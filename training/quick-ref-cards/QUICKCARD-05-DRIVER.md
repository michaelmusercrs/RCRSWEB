# QUICK REFERENCE CARD: DRIVER
## River City Roofing Solutions Platform

**For:** Richard Geahr (Driver)
**Role:** `driver` -- Delivery routes, loading checklist, proof of delivery, route navigation
**Last Updated:** February 10, 2026

---

## LOGIN

| Field | Value |
|-------|-------|
| **URL** | https://www.rivercityroofingsolutions.com/portal |
| **Email** | richard@rivercityroofingsolutions.com |
| **PIN Location** | `lib/team-roles.ts` -- TEAM_MEMBERS array |
| **Login Method** | Email + 4-digit PIN |
| **Default Landing** | /portal/driver |

---

## TOP 5 BOOKMARKS

1. **My Deliveries** -- /portal/driver -- Today's assigned stops, route order, status tracking, navigation
2. **Loading Checklist** -- /portal/driver/loading -- Item-by-item verification before leaving warehouse
3. **Team Chat** -- /portal/chat -- GroupMe for messaging office, PM, and team
4. **Dashboard** -- /portal/dashboard -- 4 tiles: Monday Notes, Chat, My Profile, My Deliveries
5. **Inventory** -- /portal/inventory -- Stock levels reference when loading

---

## DAILY CHECKLIST

### Morning (Start of Shift -- At Warehouse)
- [ ] Open /portal/driver -- review ALL assigned stops for today
- [ ] Note any URGENT or RUSH priority deliveries (these go first)
- [ ] Read special instructions for EACH stop (gate codes, stacking locations, inspector needed)
- [ ] Open /portal/driver/loading -- start Loading Checklist
- [ ] For each delivery: pull listed materials, verify right product and right quantity
- [ ] Load truck in route order (last delivery on bottom, first on top)
- [ ] Take photo of loaded truck
- [ ] Complete safety checks and sign off on checklist
- [ ] Tap "Start Route" -- Google Maps opens with first stop

### At Each Delivery Stop
- [ ] Arrive -- tap "Start Delivery" on the stop card
- [ ] Unload materials to specified location (check special instructions)
- [ ] Take photo(s) of delivered materials at placement site
- [ ] Add delivery notes if needed ("Materials stacked by garage, per instructions")
- [ ] Tap "Complete Delivery" -- customer and office get automatic notification
- [ ] Move to next stop

### End of Day
- [ ] Verify ALL deliveries show "Completed" status
- [ ] Any undelivered stops? Message office with reason via GroupMe
- [ ] Return to warehouse
- [ ] Check tomorrow's route (if available)
- [ ] Report any vehicle issues in GroupMe

---

## WEEKLY CHECKLIST

- [ ] Review Monday Notes for weekly schedule and priorities
- [ ] Verify phone bookmarks are saved and up to date
- [ ] Report any recurring route issues or suggestions to office
- [ ] Check phone permissions (camera, location, notifications) are enabled

---

## KEY SHORTCUTS

| Action | How |
|--------|-----|
| **Navigate to stop** | Tap "Navigate" on any stop card -- Google Maps opens with directions |
| **See full route map** | Tap "Full Route" button -- Google Maps shows all stops in order |
| **Start a delivery** | Tap "Start Delivery" on the stop card when you arrive |
| **Take delivery photo** | Tap camera/Photos button on the stop card -- snap photo of materials |
| **Complete a delivery** | After unloading + photo + notes -> tap "Complete Delivery" |
| **Call customer** | Tap the phone number on the delivery card -- direct dial |
| **Message office** | /portal/chat -> DM Sara or post in main channel |

---

## COMMON TASKS

| Task | Steps |
|------|-------|
| **Check today's route** | Open /portal/driver -> see all stops in order with total distance, estimated time, and progress bar |
| **Complete loading checklist** | /portal/driver/loading -> check each item against order (right product, right quantity) -> take truck photo -> complete safety checks -> sign off |
| **Deliver materials** | Arrive -> tap "Start Delivery" -> unload to specified location -> take photo -> add notes -> tap "Complete Delivery" |
| **Handle wrong materials on truck** | DO NOT deliver wrong materials -> message office immediately via GroupMe -> call office at 256-274-8530 -> wait for instructions |
| **Customer not home** | Check special instructions for alternate directions -> call customer (tap phone # on card) -> if no answer, message office for guidance -> leave materials in designated spot if instructed, take photo |
| **Running late** | ETA auto-adjusts in the system -> if significantly late, message office and customer via GroupMe or phone |

---

## DELIVERY STATUS FLOW

```
Planned  -->  In Progress  -->  Delivered
```

| Status | What It Means |
|--------|---------------|
| **Planned** | Assigned to you, not yet started |
| **In Progress** | You tapped "Start Delivery" -- en route or unloading |
| **Delivered** | You tapped "Complete Delivery" -- done, photos uploaded |

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| **Can't see my route** | Refresh the page (pull down on mobile). If still blank, close browser and reopen /portal/driver. If still missing, message office -- deliveries may not be assigned yet. |
| **Wrong materials on the truck** | **STOP. DO NOT deliver wrong materials.** Call the office immediately at 256-274-8530. Wait for correction before proceeding. |
| **Customer not home** | Check special instructions. Call customer (tap phone #). If no answer, leave materials in designated spot, take photo, add note "Customer not home." Message office. |
| **Photo won't upload** | Check camera permissions in phone settings (Settings -> Browser -> Camera). Try again. If still failing, take photos with regular camera app and message office with details. |
| **App not loading** | Check internet connection (try switching between WiFi and cell data). Close and reopen browser. Clear browser cache if needed. |
| **Google Maps won't open** | Make sure Google Maps is installed on your phone. Try tapping the address text directly. If still failing, copy the address and paste into Google Maps manually. |
| **Loading checklist won't complete** | All items must be checked off. Verify you completed every line item and all safety checks. If an item is missing, DO NOT proceed -- call the office. |

---

## WHO TO CONTACT

| Person | Role | Phone |
|--------|------|-------|
| Sara Hill | Office Manager (scheduling, assignments) | 256-810-3594 |
| Tae Orr | Materials Manager (loading, stock questions) | 256-200-3467 |
| John Cordonis | Production Manager (job site questions) | 256-654-0875 |
| Michael Muse | VP / Tech (system issues) | 256-221-4290 |
| Office Main Line | General | 256-274-8530 |

**Rule #1: If in doubt about ANYTHING, call the office: 256-274-8530**
**Rule #2: Never deliver wrong materials -- always verify first!**

---

*RCRS Platform -- 367 pages, 180+ API routes, 85+ components*
*Office: 256-274-8530 | rcrs@rivercityroofingsolutions.com*
