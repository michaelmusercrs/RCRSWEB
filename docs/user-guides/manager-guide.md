# Manager Portal Guide

## Overview

The Manager Dashboard provides oversight of deliveries, inventory, and team operations. This guide covers the `/portal/manager` interface and related management functions in the Command Center.

---

## Accessing the Manager Dashboard

### Login

1. Navigate to `/portal`
2. Select "Staff Login"
3. Enter your email
4. You'll be redirected based on your role

### Role Requirements

Manager features require one of:
- `owner`
- `admin`
- `office`

---

## Manager Dashboard (`/portal/manager`)

### Overview Tab

The main dashboard displays key metrics:

**Today's Deliveries**
- Total scheduled for today
- Completed count
- Active deliveries status

**Pending Orders**
- Material orders awaiting scheduling
- This week's order count

**Low Stock Items**
- Items below minimum threshold
- Link to inventory details

**Inventory Value**
- Total current inventory value
- Product count

### Quick Actions

Two primary actions available:
1. **Create Material Order**: Start a new order
2. **Manage Inventory**: Go to inventory page

---

## Material Order Management

### Creating a Material Order

Click "Create Material Order" to open the form:

**Required Fields:**
- Job Name (e.g., "Smith Residence")
- Job Address (full address)
- Customer Name
- Customer Phone
- Delivery Date
- Materials Needed (list items)

**Optional Fields:**
- Project Manager
- Special Instructions (gate codes, stacking location, etc.)
- Priority (Normal, Rush, Urgent)

### Order Workflow

```
Pending --> Scheduled --> In Progress --> Delivered
```

**Pending**: Order created, awaiting scheduling
**Scheduled**: Driver assigned, date confirmed
**In Progress**: Driver en route or at site
**Delivered**: Materials delivered, awaiting confirmation

### Viewing Orders

The Orders tab shows all material orders:
- Job name and order ID
- Customer and delivery date
- Materials summary
- Current status
- Priority badges (Rush, Urgent)

### Assigning Drivers

For pending orders:
1. Click the "Assign Driver" dropdown
2. Select an available driver
3. Order status changes to "Scheduled"

---

## Delivery Management

### Viewing Deliveries

The Deliveries tab shows all deliveries:
- Job name and delivery ID
- Driver assignment
- Scheduled date/time
- Delivery address
- Current status

### Delivery Statuses

| Status | Meaning |
|--------|---------|
| Scheduled | Driver assigned, not started |
| Loaded | Materials on truck |
| En Route | Driving to location |
| Arrived | At job site |
| Delivered | Materials offloaded |

### Active Deliveries Widget

Real-time view of in-progress deliveries:
- Driver name
- Current status
- Quick status updates

---

## Driver Management

### Driver Status Overview

View all drivers and their current status:

| Status | Indicator | Meaning |
|--------|-----------|---------|
| Available | Green dot | Ready for assignment |
| On Delivery | Blue dot | Currently delivering |
| Off Duty | Gray dot | Not working |

### Assigning Deliveries

1. Go to pending orders
2. Select order
3. Choose available driver from dropdown
4. Delivery is scheduled

### Driver Performance

Track driver metrics:
- Deliveries completed
- On-time percentage
- Photo compliance
- Customer feedback

---

## Inventory Management (`/portal/inventory`)

### Inventory Dashboard

View complete inventory:
- All products listed
- Current quantities
- Category organization
- Low stock highlights

### Stock Alerts

Items below minimum threshold:
- Highlighted in red
- Listed in alerts widget
- Reorder recommendations

### Adjusting Stock

1. Find the item
2. Click to edit
3. Update quantity
4. Save changes
5. Transaction logged

### Adding New Items

1. Click "Add Item"
2. Enter SKU, name, description
3. Set category and pricing
4. Define min/max stock levels
5. Save item

---

## Command Center Access

### Sales Overview (`/command-center/sales`)

View sales team performance:
- Leaderboard rankings
- Monthly/yearly totals
- Individual rep details

### Schedule View (`/command-center/schedule`)

Calendar view of all activities:
- Inspections
- Deliveries
- Installations
- Meetings

### Reports (`/command-center/reports`)

Access business reports:
- Sales summaries
- Inventory reports
- Delivery metrics
- Team performance

---

## Notifications & Alerts

### GroupMe Integration

Automatic notifications sent for:
- New leads
- Low stock alerts
- Delivery status changes
- SLA warnings

### Alert Types

| Alert | Priority | Action |
|-------|----------|--------|
| Out of Stock | Urgent | Reorder immediately |
| Low Stock | High | Plan reorder |
| Delivery Delayed | Normal | Review and reschedule |
| New Lead | High | Follow up quickly |

---

## Daily Operations Workflow

### Morning Checklist

1. Review today's deliveries
2. Check driver availability
3. Review pending orders
4. Check low stock alerts
5. Assign any unassigned deliveries

### Throughout the Day

1. Monitor active deliveries
2. Address any delivery issues
3. Process new material orders
4. Handle customer inquiries
5. Update inventory as needed

### End of Day

1. Verify all deliveries completed
2. Review tomorrow's schedule
3. Address any open issues
4. Update order statuses

---

## Integration Points

### JobNimbus Sync

Data flows from JobNimbus:
- Customer information
- Job details
- Contact info
- Appointment updates

### Google Sheets

Data stored in Sheets:
- Inventory levels
- Team member info
- Commission data
- Order history

### TeamUp Calendar

Appointments synced:
- Inspections
- Deliveries
- Installations
- Meetings

---

## Reporting

### Available Reports

**Delivery Report**
- Completed deliveries
- On-time percentage
- Issues logged

**Inventory Report**
- Stock levels
- Value summary
- Movement history

**Order Report**
- Orders by status
- Priority distribution
- Completion times

### Exporting Data

Most reports can be:
- Viewed on screen
- Exported to CSV
- Printed

---

## Troubleshooting

### Orders Not Syncing

1. Check Google Sheets connection
2. Verify API credentials
3. Review error logs
4. Contact admin if persistent

### Driver Not Available

1. Check driver schedule
2. Verify driver is active
3. Review current assignments
4. Consider reassignment

### Inventory Discrepancy

1. Check recent transactions
2. Review adjustment history
3. Perform physical count
4. Update system accordingly

---

## Best Practices

### Order Management

- Process orders same day received
- Prioritize by urgency
- Communicate delays immediately
- Document special instructions

### Driver Assignments

- Balance workload across drivers
- Consider route optimization
- Account for drive times
- Plan for contingencies

### Inventory Maintenance

- Weekly physical counts
- Update system promptly
- Maintain safety stock
- Plan seasonal needs

---

## Quick Reference

### Status Flow - Orders

```
Pending --> Scheduled --> In Progress --> Delivered --> Complete
```

### Status Flow - Deliveries

```
Scheduled --> Loaded --> En Route --> Arrived --> Delivered --> Completed
```

### Key URLs

| Function | URL |
|----------|-----|
| Manager Dashboard | `/portal/manager` |
| Inventory | `/portal/inventory` |
| Schedule | `/command-center/schedule` |
| Reports | `/command-center/reports` |

---

## Related Guides

- [Driver Guide](./driver-guide.md) - Driver workflow details
- [Admin Guide](./admin-guide.md) - System administration
- [API Reference](../API-REFERENCE.md) - Technical documentation
