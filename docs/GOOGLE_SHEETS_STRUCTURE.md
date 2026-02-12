# Google Sheets Structure Document

## Overview

This document defines the required sheets and column structure for the RCRS Google Sheets integration. When the application connects to Google Sheets, it will automatically create these sheets if they don't exist.

---

## Sheet: `team-members-import`

Team member data for the public website and internal directory.

### Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| slug | string | Yes | URL-friendly identifier (e.g., "john-smith") |
| name | string | Yes | Full display name |
| company | string | No | Associated company name |
| category | string | Yes | Team category (e.g., "Sales", "Operations") |
| position | string | Yes | Job title |
| phone | string | No | Phone number |
| email | string | No | Email address |
| altEmail | string | No | Alternate email |
| displayOrder | number | Yes | Sort order for display (lower = first) |
| tagline | string | No | Short description/motto |
| bio | string | No | Full biography |
| region | string | No | Assigned region/territory |
| launchDate | string | No | Start date with company |
| profileImage | string | No | Google Drive URL or direct image URL |
| truckImage | string | No | Google Drive URL or direct image URL |
| facebook | string | No | Facebook profile URL |
| instagram | string | No | Instagram profile URL |
| x | string | No | X/Twitter profile URL |

### Example Data

```
slug,name,company,category,position,displayOrder
john-smith,John Smith,RCRS,Sales,Senior Sales Rep,1
jane-doe,Jane Doe,RCRS,Operations,Operations Manager,2
```

---

## Sheet: `Inventory`

Product inventory management.

### Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| sku | string | Yes | Unique product identifier |
| name | string | Yes | Product name |
| description | string | No | Product description |
| category | string | Yes | Product category |
| cost | number | Yes | Cost price (wholesale) |
| price | number | Yes | Selling price (retail) |
| quantity | number | Yes | Current stock quantity |
| minStock | number | No | Minimum stock level (default: 10) |
| maxStock | number | No | Maximum stock level (default: 100) |
| unit | string | No | Unit of measure (default: "each") |
| supplier | string | No | Supplier name |
| location | string | No | Warehouse location |
| imageUrl | string | No | Product image URL |
| lastUpdated | string | Auto | ISO timestamp of last update |
| updatedBy | string | Auto | User who made last update |

### Categories

Standard categories for roofing inventory:
- Fasteners
- Underlayment
- Flashing
- Ventilation
- Accessories
- Sealants
- Tools
- Safety Equipment
- Shingles

### Example Data

```
sku,name,category,cost,price,quantity,unit,location
NAIL-125-EG,1 1/4" EG Nails,Fasteners,27.50,64.90,50,box,Warehouse A
FELT-SYN-10,RCRS Syn Felt,Underlayment,66.00,79.86,25,roll,Warehouse B
```

---

## Sheet: `InventoryLogs`

Audit trail for inventory changes.

### Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| logId | string | Auto | Unique log entry ID |
| sku | string | Yes | Product SKU |
| itemName | string | Yes | Product name |
| previousQty | number | Yes | Quantity before change |
| newQty | number | Yes | Quantity after change |
| adjustment | number | Yes | Change amount (+/-) |
| reason | string | Yes | Reason for adjustment |
| userId | string | Yes | User ID who made change |
| userName | string | Yes | User name who made change |
| timestamp | string | Auto | ISO timestamp |

---

## Sheet: `Commissions`

Sales commission tracking.

### Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| salesRep | string | Yes | Sales rep full name |
| date | string | Yes | Commission date (MM/DD/YYYY or YYYY-MM-DD) |
| amount | number | Yes | Commission amount |
| balance | number | No | Running balance |
| jobId | string | No | Associated job ID |
| jobName | string | No | Job/customer name |
| description | string | No | Description of commission |
| status | string | No | Status (pending, approved, paid) |

### Example Data

```
salesRep,date,amount,balance,jobId,description,status
Aaron Lussi,02/21/2020,30.00,30.00,JOB-001,Initial commission,paid
Aaron Lussi,02/28/2020,306.52,336.52,JOB-002,Roof replacement,paid
```

---

## Sheet: `Customers`

Customer database.

### Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| customerId | string | Auto | Unique customer ID |
| name | string | Yes | Customer full name |
| email | string | No | Email address |
| phone | string | No | Phone number |
| address | string | No | Street address |
| city | string | No | City |
| state | string | No | State |
| zip | string | No | ZIP code |
| jobCount | number | No | Total jobs completed |
| totalSpent | number | No | Total revenue from customer |
| lastJobDate | string | No | Date of last job |
| notes | string | No | Internal notes |
| source | string | No | Lead source (referral, web, etc.) |
| salesRep | string | No | Assigned sales rep |
| createdAt | string | Auto | Created timestamp |
| updatedAt | string | Auto | Last updated timestamp |

### Example Data

```
customerId,name,email,phone,city,state,salesRep
CUST-001,John Doe,john@email.com,555-1234,Hartselle,AL,Aaron Lussi
```

---

## Sheet: `Orders`

Material orders and deliveries.

### Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| orderId | string | Auto | Unique order ID |
| customerId | string | Yes | Associated customer ID |
| customerName | string | Yes | Customer name |
| jobId | string | No | Associated job ID |
| jobAddress | string | No | Delivery address |
| status | string | Yes | Order status |
| items | string | Yes | JSON array of order items |
| totalCost | number | Yes | Total cost |
| totalPrice | number | Yes | Total selling price |
| createdBy | string | Yes | User who created order |
| createdAt | string | Auto | Created timestamp |
| updatedAt | string | Auto | Last updated timestamp |
| notes | string | No | Order notes |
| deliveryDate | string | No | Scheduled delivery date |
| deliveredBy | string | No | Delivery driver name |

### Status Values

- `pending` - Order created, awaiting approval
- `approved` - Approved, awaiting fulfillment
- `in-progress` - Being prepared/loaded
- `delivered` - Delivered to job site
- `completed` - Fully completed
- `cancelled` - Order cancelled

### Items JSON Format

```json
[
  {
    "sku": "NAIL-125-EG",
    "name": "1 1/4\" EG Nails",
    "quantity": 5,
    "unit": "box",
    "unitCost": 27.50,
    "unitPrice": 64.90
  }
]
```

---

## Sheet: `employees` (Internal)

Internal employee data for the Command Center.

### Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| id | string | Yes | Unique employee ID |
| name | string | Yes | Full name |
| slug | string | Yes | URL-friendly identifier |
| email | string | Yes | Email address |
| phone | string | No | Phone number |
| role | string | Yes | System role (Owner, Admin, Manager, Sales, Driver, Office) |
| pin | string | No | PIN for authentication |
| isActive | boolean | Yes | Whether account is active |
| permissions | string | Yes | JSON array of permissions |
| createdAt | string | Auto | Created timestamp |

---

## Sheet: `transactions` (Internal)

Inventory transaction history.

### Columns

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| inventoryId | string | Yes | Transaction ID |
| itemId | string | Yes | Product ID |
| dateTime | string | Yes | Transaction timestamp |
| amount | number | Yes | Quantity changed |
| referenceNumber | string | No | Reference (job ID, PO, etc.) |
| price | number | Yes | Unit price |
| cost | number | Yes | Unit cost |
| type | string | Yes | Transaction type |
| status | string | Yes | Transaction status |
| deliveryPhoto | string | No | Delivery photo URL |
| notes | string | No | Transaction notes |

### Transaction Types

- `restock` - Items added to inventory
- `delivery` - Items delivered to job
- `return` - Items returned to inventory
- `adjustment` - Manual quantity adjustment
- `transfer` - Transfer between locations

---

## Data Validation Rules

### General Rules

1. All dates should be in ISO format (YYYY-MM-DD) or US format (MM/DD/YYYY)
2. Currency values should not include $ symbol - numbers only
3. Boolean values should be "TRUE" or "FALSE"
4. JSON fields must be valid JSON strings

### SKU Format

Product SKUs should follow the pattern:
- `CATEGORY-DESCRIPTION-SIZE`
- Example: `NAIL-125-EG` (Nail, 1.25 inch, Electro-Galvanized)

### Phone Numbers

Format: `###-###-####` or `(###) ###-####`

### Email Addresses

Standard email format validation applies.

---

## Backup and Recovery

### Recommended Backup Schedule

- **Daily**: Automatic Google Sheets version history
- **Weekly**: Export to CSV backup
- **Monthly**: Full spreadsheet download

### Version History

Google Sheets maintains version history automatically. Access via:
File > Version history > See version history

---

## Access Control

### Recommended Sharing Settings

| Role | Access Level |
|------|-------------|
| Service Account | Editor |
| Owners | Owner |
| Admins | Editor |
| Managers | Editor (specific sheets only) |
| Others | Viewer (if needed) |

### Protected Ranges

Consider protecting these columns from direct editing:
- `lastUpdated` - Auto-generated
- `updatedBy` - Auto-generated
- `createdAt` - Auto-generated
- `logId` - Auto-generated
- `customerId` - Auto-generated
- `orderId` - Auto-generated
