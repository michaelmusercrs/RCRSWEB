# API Reference

## Overview

River City Roofing Solutions uses Next.js API Routes for backend functionality. All endpoints are located under `/api/` and return JSON responses.

---

## Authentication

### Portal Authentication

**Endpoint:** `POST /api/portal/auth`

Handles team member authentication via PIN or email.

**Request Body:**
```json
{
  "action": "login-pin",
  "pin": "1234"
}
```

Or:
```json
{
  "action": "login-passcode",
  "email": "user@rcrsal.com",
  "passcode": "ABC123"
}
```

Or:
```json
{
  "action": "check-permission",
  "userId": "RVR-135",
  "permission": "view_dashboard"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": {
    "userId": "RVR-135",
    "name": "John Doe",
    "email": "john@rcrsal.com",
    "role": "driver",
    "permissions": ["view_assigned_tickets", "update_delivery_status"]
  }
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Invalid PIN"
}
```

---

### Customer Authentication

**Endpoint:** `POST /api/customer/auth`

Authenticates customers via email, phone, or access code.

**Request Body:**
```json
{
  "method": "email",
  "email": "customer@example.com"
}
```

Or:
```json
{
  "method": "phone",
  "phone": "256-555-1234"
}
```

Or:
```json
{
  "method": "code",
  "accessCode": "ABC123XYZ"
}
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": "JN-12345",
    "name": "Customer Name",
    "email": "customer@example.com"
  }
}
```

---

## JobNimbus Integration

### Get JobNimbus Data

**Endpoint:** `GET /api/admin/jobnimbus`

Retrieves contacts and jobs from JobNimbus CRM.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Data type: contacts, jobs, estimates, tasks |
| limit | number | Results per page (default: 100) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "contacts": [...],
  "jobs": [...],
  "stats": {
    "totalContacts": 150,
    "totalJobs": 75,
    "activeJobs": 25,
    "completedJobs": 50
  },
  "lastSync": "2024-01-15T10:30:00Z"
}
```

### Sync JobNimbus

**Endpoint:** `POST /api/admin/jobnimbus/sync`

Triggers a manual sync with JobNimbus.

**Response:**
```json
{
  "success": true,
  "synced": {
    "contacts": 150,
    "jobs": 75
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Team Members

### List Team Members

**Endpoint:** `GET /api/team-members`

Returns all team members for public display.

**Response:**
```json
[
  {
    "slug": "john-doe",
    "name": "John Doe",
    "position": "Project Manager",
    "phone": "256-555-1234",
    "email": "john@rcrsal.com",
    "bio": "...",
    "profileImage": "https://..."
  }
]
```

### Admin Team Members

**Endpoint:** `GET /api/admin/team-members`

Returns all team members with admin details.

**Endpoint:** `POST /api/admin/team-members`

Creates a new team member.

**Endpoint:** `PUT /api/admin/team-members/[slug]`

Updates a team member.

**Endpoint:** `DELETE /api/admin/team-members/[slug]`

Deletes a team member.

---

## Portal Endpoints

### Dashboard

**Endpoint:** `GET /api/portal/dashboard`

Returns dashboard statistics.

**Response:**
```json
{
  "deliveries": {
    "todayTotal": 5,
    "completedToday": 3,
    "pending": 2
  },
  "orders": {
    "pending": 8,
    "thisWeek": 15
  },
  "inventory": {
    "lowStockItems": 12,
    "totalValue": 125000,
    "totalProducts": 350
  }
}
```

### Tickets

**Endpoint:** `GET /api/portal/tickets`

Returns delivery tickets.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| driverId | string | Filter by driver |
| date | string | Filter by date (YYYY-MM-DD) |
| ticketId | string | Get specific ticket |

**Endpoint:** `POST /api/portal/tickets`

Updates ticket status or creates new ticket.

**Request Body:**
```json
{
  "action": "verify-load",
  "ticketId": "TKT-001",
  "verifiedBy": "John Doe",
  "gpsLocation": "34.4434,-86.9353"
}
```

**Actions Available:**
- `verify-load`
- `start-delivery`
- `mark-arrived`
- `complete-delivery`
- `capture-proof`
- `upload-qc`
- `complete-ticket`

### Ticket Checklist

**Endpoint:** `GET /api/portal/tickets/checklist`

Returns checklist items for a ticket.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| ticketId | string | Ticket ID |

### Ticket Photos

**Endpoint:** `GET /api/portal/tickets/photos`

Returns photos for a ticket.

**Endpoint:** `POST /api/portal/tickets/photos`

Uploads a photo for a ticket.

---

### Orders

**Endpoint:** `GET /api/portal/orders`

Returns material orders.

**Endpoint:** `POST /api/portal/orders`

Creates a new material order.

**Request Body:**
```json
{
  "jobName": "Smith Residence",
  "jobAddress": "123 Main St, Huntsville, AL 35801",
  "customerName": "John Smith",
  "customerPhone": "256-555-1234",
  "projectManager": "Bart Roberts",
  "materials": "30 bundles OC Duration (Onyx Black)",
  "specialInstructions": "Gate code: 1234",
  "requestedDeliveryDate": "2024-01-20",
  "priority": "Normal",
  "createdBy": "Manager Portal"
}
```

### Deliveries

**Endpoint:** `GET /api/portal/deliveries`

Returns all deliveries.

**Endpoint:** `POST /api/portal/deliveries`

Schedules a new delivery.

### Drivers

**Endpoint:** `GET /api/portal/drivers`

Returns all drivers with status.

**Response:**
```json
[
  {
    "id": "RVR-136",
    "name": "Richard Geahr",
    "status": "Available",
    "vehicle": "Truck 1"
  }
]
```

---

### Inventory

**Endpoint:** `GET /api/portal/inventory`

Returns inventory items.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category | string | Filter by category |
| lowStock | boolean | Only low stock items |
| search | string | Search term |

**Endpoint:** `POST /api/portal/inventory`

Updates inventory item.

### Pricing

**Endpoint:** `GET /api/portal/pricing`

Returns pricing data.

**Endpoint:** `POST /api/portal/pricing/verify`

Verifies pricing is correct.

**Endpoint:** `GET /api/portal/pricing/alerts`

Returns pricing alerts.

---

### Schedule

**Endpoint:** `GET /api/portal/schedule`

Returns scheduled events.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | string | Start date (YYYY-MM-DD) |
| endDate | string | End date (YYYY-MM-DD) |

---

### Billing

**Endpoint:** `GET /api/portal/billing`

Returns billing records.

**Endpoint:** `POST /api/portal/billing`

Creates billing record.

**Endpoint:** `GET /api/portal/billing/pdf`

Generates invoice PDF.

### Invoices

**Endpoint:** `GET /api/portal/invoices`

Returns invoices.

---

## Command Center

### Sales Data

**Endpoint:** `GET /api/command-center/sales`

Returns sales data for leaderboard.

**Response:**
```json
{
  "leaderboard": [
    {
      "name": "Hunter",
      "monthlySales": 45200,
      "yearlySales": 320000,
      "rank": 1
    }
  ],
  "totals": {
    "monthlyTotal": 125000,
    "yearlyTotal": 1500000
  }
}
```

### Team Data

**Endpoint:** `GET /api/command-center/team`

Returns team status and metrics.

### Inventory Overview

**Endpoint:** `GET /api/command-center/inventory`

Returns inventory summary for command center.

### Meetings

**Endpoint:** `GET /api/command-center/meetings`

Returns meeting data.

---

## Customer Portal

### Customer Dashboard

**Endpoint:** `GET /api/customer/dashboard`

Returns customer's project data.

**Response:**
```json
{
  "project": {
    "status": "in_progress",
    "phase": "Installation",
    "address": "123 Main St"
  },
  "weather": {
    "current": {...},
    "forecast": [...]
  },
  "appointments": [...],
  "messages": [...]
}
```

### Customer Messages

**Endpoint:** `GET /api/customer/messages`

Returns customer messages.

**Endpoint:** `POST /api/customer/messages`

Sends a new message.

### Customer Token Access

**Endpoint:** `GET /api/customer/[token]`

Token-based customer data access.

**Endpoint:** `POST /api/customer/[token]/upload`

Customer document upload.

---

## Forms

### Contact Form

**Endpoint:** `POST /api/contact`

Or: `POST /api/forms/contact`

Submits contact form.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "256-555-1234",
  "subject": "Roof Inspection Request",
  "message": "I need a roof inspection..."
}
```

### Referral Form

**Endpoint:** `POST /api/referral`

Or: `POST /api/forms/referral`

Submits referral.

---

## CMS

### Blog Posts

**Endpoint:** `GET /api/cms/blog`

Returns blog posts.

**Endpoint:** `POST /api/cms/blog`

Creates/updates blog post.

### Images

**Endpoint:** `GET /api/cms/images`

Returns uploaded images.

**Endpoint:** `POST /api/cms/images`

Uploads new image.

### Team (CMS)

**Endpoint:** `GET /api/cms/team`

Returns team data for CMS.

---

## Analytics

### Page Views

**Endpoint:** `POST /api/analytics/page-views`

Records page view.

### Profile Views

**Endpoint:** `POST /api/analytics/profile-views`

Records team member profile view.

---

## Webhooks

### JobNimbus Webhook

**Endpoint:** `POST /api/webhooks/jobnimbus`

Receives webhooks from JobNimbus.

---

## Upload

### Admin Upload

**Endpoint:** `POST /api/admin/upload`

Uploads file to Vercel Blob storage.

**Request:** `multipart/form-data`

**Response:**
```json
{
  "success": true,
  "url": "https://blob.vercel-storage.com/..."
}
```

---

## Error Responses

All endpoints return consistent error format:

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Missing required field: email"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Resource not found"
}
```

**500 Server Error:**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Rate Limiting

API endpoints implement rate limiting:
- General endpoints: 100 requests/minute
- Auth endpoints: 10 requests/minute
- Upload endpoints: 20 requests/minute

Exceeded limits return:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Environment Requirements

Required environment variables for API functionality:

```
# Required for JobNimbus
JOBNIMBUS_API_KEY=
JOBNIMBUS_API_URL=

# Required for Google Sheets
GOOGLE_SHEETS_ID=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=

# Required for TeamUp
TEAMUP_API_KEY=
TEAMUP_CALENDAR_KEY=

# Required for GroupMe
GROUPME_BOT_ID=
GROUPME_ENABLED=

# Required for file uploads
BLOB_READ_WRITE_TOKEN=
```
