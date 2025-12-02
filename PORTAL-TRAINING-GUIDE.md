# River City Roofing - Delivery & Warehouse Portal Training Guide

## Table of Contents
1. [Portal Overview](#portal-overview)
2. [Accessing the Portal](#accessing-the-portal)
3. [Inventory Management](#inventory-management)
4. [Manager Dashboard](#manager-dashboard)
5. [Driver Portal](#driver-portal)
6. [Admin Portal](#admin-portal)
7. [Google Sheets Integration](#google-sheets-integration)

---

## Portal Overview

The Delivery & Warehouse Portal is accessed at: **yoursite.com/portal**

It includes four main sections:
- **Manager Dashboard** - Orders, deliveries, analytics
- **Inventory Count** - Weekly inventory counts & restock requests
- **Driver Portal** - Delivery tracking for drivers (PIN login required)
- **Admin Portal** - Blog, team, images management

---

## Accessing the Portal

### Main Portal Page
Navigate to `/portal` to see all options:

1. **Manager Dashboard** - Click to go directly (no login required)
2. **Inventory Count** - Click to go directly (no login required)
3. **Admin Portal** - Click to go directly (no login required)
4. **Driver Login** - Requires a 4-digit PIN

### Driver Login
Drivers use a 4-digit PIN to access their personal delivery dashboard:
1. Enter PIN using the number pad
2. Click "Login"
3. View today's assigned deliveries

---

## Inventory Management

### Location: `/portal/inventory`

### Three Main Tabs

#### 1. Inventory Tab
Shows all tracked products with:
- Product name and SKU
- Current quantity
- Min/Max stock levels
- Unit cost and supplier
- Category filter
- Search functionality

**Low Stock Alert**: Items below minimum quantity show a red "LOW" badge and red border.

**Request Restock**: Click the "Request Restock" button on any low-stock item to create a restock request.

#### 2. Weekly Count Tab
For performing weekly inventory counts:

1. Click **"Start Count"** to begin
2. For each product, enter the actual quantity you counted
   - Use +/- buttons or type directly
   - Shows variance (difference from expected)
3. Click **"Submit (X)"** to save all counts
4. Click **"Cancel"** to discard changes

**Best Practices:**
- Count at the same time each week
- Count by category/location for efficiency
- Investigate large variances immediately

#### 3. Restock Requests Tab
View all pending and processed restock requests:

**Request Statuses:**
- **Pending** (yellow) - Not yet reviewed
- **Approved** (blue) - Approved for ordering
- **Ordered** (purple) - Order placed with supplier
- **Received** (green) - Materials received and stocked

Each request shows:
- Product name
- Current quantity
- Requested quantity
- Supplier
- Priority (Normal, High, Urgent)
- Date requested and requested by

---

## Manager Dashboard

### Location: `/portal/manager`

### Overview Tab (Default)

**Stats Cards:**
1. **Today's Deliveries** - Total scheduled today + completed count
2. **Pending Orders** - Orders waiting to be scheduled
3. **Low Stock Items** - Links to inventory page
4. **Inventory Value** - Total $ value of inventory

**Quick Actions:**
- **Create Material Order** - Opens order form
- **Manage Inventory** - Links to inventory page

**Active Deliveries:**
Shows deliveries currently in progress (Loaded, En Route, Arrived)

**Driver Status:**
Shows all drivers and their current status:
- Green = Available
- Blue = On Delivery
- Gray = Off Duty

### Orders Tab

View all material orders with details:
- Job name and order ID
- Customer name
- Delivery date
- Materials list
- Priority (Normal, Rush, Urgent)
- Status

**Assigning Drivers:**
For pending orders, select a driver from the dropdown to schedule the delivery.

**Creating New Orders:**
Click "New Order" and fill in:
- Job name
- Job address
- Customer name & phone
- Project manager (optional)
- Materials needed
- Special instructions (gate codes, stacking location)
- Delivery date
- Priority level

### Deliveries Tab

View all deliveries with:
- Job name and delivery ID
- Driver assigned
- Scheduled date/time
- Address
- Current status
- Delivery confirmation time (when completed)

**Delivery Statuses:**
1. **Scheduled** (yellow) - Assigned to driver
2. **Loaded** (blue) - Driver confirmed materials loaded
3. **En Route** (purple) - Driver departed warehouse
4. **Arrived** (orange) - Driver at job site
5. **Delivered** (green) - Delivery completed

---

## Driver Portal

### Location: `/portal/driver` (requires PIN login from `/portal`)

### Today's Deliveries List

Shows all deliveries assigned for today:
- Job name and customer name
- Delivery address (truncated)
- Scheduled time
- Current status badge
- "Loaded" checkmark if materials confirmed

Tap any delivery to see details.

### Delivery Detail View

**Customer Info:**
- Name
- Phone (tap to call)

**Delivery Address:**
- Full address displayed
- "Open in Maps" button launches Google Maps navigation

**Materials:**
- Full list of materials for this delivery

**Timeline:**
- Scheduled time
- Load confirmed time
- Departed time
- Arrived time
- (each shows as completed)

### Driver Actions

**Step 1: Confirm Load**
Before leaving warehouse:
1. Verify all materials are on truck
2. Tap "Confirm Load"
3. Status changes to "Loaded"

**Step 2: Start Delivery**
When leaving warehouse:
1. Tap "Start Delivery"
2. Status changes to "En Route"
3. Use "Open in Maps" for navigation

**Step 3: Mark Arrived**
When at job site:
1. Tap "Mark Arrived"
2. Status changes to "Arrived"

**Step 4: Complete Delivery**
After unloading:
1. Take photos if needed ("Take Photo" button)
2. Tap "Complete Delivery"
3. Status changes to "Delivered"
4. Returns to delivery list

**Taking Photos:**
Tap "Take Photo" at any point to document:
- Material condition
- Delivery location
- Any issues or concerns

---

## Admin Portal

### Location: `/portal/admin`

### Blog Management (`/portal/admin/blog`)
- View all blog posts
- Edit existing posts
- Create new posts
- Posts sync with Google Sheets

### Team Management (`/portal/admin/team`)
- View all team members
- Edit member profiles
- Upload headshot photos
- Manage categories and order
- Members sync with Google Sheets

### Image Management (`/portal/admin/images`)
- View all uploaded images
- Upload new images
- Organize by category
- Images sync with Google Sheets

---

## Google Sheets Integration

All portal data syncs with Google Sheets for easy access and backup.

### Sheets Used:

**Inventory System:**
- `inventory` - Product list with quantities
- `inventory-counts` - Historical count records
- `restock-requests` - Restock request tracking

**Delivery System:**
- `material-orders` - All material orders
- `deliveries` - Delivery tracking
- `drivers` - Driver list with PINs

**CMS System:**
- `team-members` - Team profiles
- `blog-posts` - Blog content
- `images` - Image library

**Forms:**
- `contact-submissions` - Contact form submissions
- `referral-submissions` - Referral form submissions

### Accessing the Sheets

1. Go to Google Sheets
2. Open the shared spreadsheet (ID in env variables)
3. Each tab contains different data
4. **Important:** Don't manually edit while portal is in use to avoid conflicts

### Data Backup

All data is automatically saved to Google Sheets, providing:
- Automatic cloud backup
- Easy reporting and exports
- Access from any device
- Historical record keeping

---

## Troubleshooting

### Common Issues

**Portal won't load:**
- Check internet connection
- Clear browser cache
- Try refreshing the page

**Driver PIN not working:**
- Verify PIN in Google Sheet `drivers` tab
- Make sure status is not "Inactive"
- Contact manager to reset PIN

**Inventory counts not saving:**
- Check internet connection
- Make sure to click "Submit" button
- Try refreshing and re-entering

**Orders not showing:**
- Click refresh button
- Check filters/search
- Verify order exists in Google Sheet

### Getting Help

For technical issues:
- Contact your system administrator
- Check the Google Sheet for data
- Review browser console for errors

---

## Quick Reference

### URLs
| Page | URL |
|------|-----|
| Portal Home | `/portal` |
| Manager Dashboard | `/portal/manager` |
| Inventory | `/portal/inventory` |
| Driver Portal | `/portal/driver` |
| Admin Portal | `/portal/admin` |
| Blog Admin | `/portal/admin/blog` |
| Team Admin | `/portal/admin/team` |
| Images Admin | `/portal/admin/images` |

### Status Colors

**Delivery Status:**
- Yellow = Scheduled
- Blue = Loaded
- Purple = En Route
- Orange = Arrived
- Green = Delivered

**Driver Status:**
- Green = Available
- Blue = On Delivery
- Gray = Off Duty

**Restock Request:**
- Yellow = Pending
- Blue = Approved
- Purple = Ordered
- Green = Received

### Keyboard Shortcuts

None currently - all actions are click/tap based for mobile-friendly use.

---

*Last Updated: December 2024*
*River City Roofing Solutions*
