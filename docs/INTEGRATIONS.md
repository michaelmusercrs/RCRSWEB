# Integrations Guide

## Overview

River City Roofing Solutions integrates with several third-party services to provide a comprehensive business management platform. This document details each integration, its configuration, and usage.

---

## JobNimbus CRM

### Purpose
JobNimbus serves as the primary Customer Relationship Management (CRM) system, storing all customer contacts, jobs, estimates, and tasks.

### Configuration

**Environment Variables:**
```env
JOBNIMBUS_API_KEY=your_api_key
JOBNIMBUS_API_URL=https://app.jobnimbus.com/api1
```

**Getting API Key:**
1. Log into JobNimbus admin
2. Navigate to Settings > Integrations > API
3. Generate new API key
4. Copy and store securely

### Features

**Data Synced:**
- Contacts (customers)
- Jobs
- Estimates
- Tasks/Appointments
- Notes

**API Endpoints Used:**
| Endpoint | Purpose |
|----------|---------|
| `/contacts` | Customer records |
| `/jobs` | Project/job records |
| `/estimates` | Quotes and proposals |
| `/tasks` | Scheduled activities |
| `/notes` | Communication history |

### Integration Service

Location: `/lib/jobnimbus-service.ts`

**Key Methods:**
```typescript
// Get all contacts
jobNimbusService.getContacts({ limit: 100, offset: 0 })

// Get single contact
jobNimbusService.getContact(jnid)

// Search by email
jobNimbusService.searchContactByEmail(email)

// Get customer portal data
jobNimbusService.getCustomerPortalData(contactJnid)

// Test connection
jobNimbusService.testConnection()
```

### Status Mapping

JobNimbus statuses map to portal phases:

| JobNimbus Status | Portal Phase |
|------------------|--------------|
| Lead, New | lead |
| Contacted, Appointment Set | inspection |
| Inspected, Estimate Sent | estimate |
| Contract Signed | contract |
| Permit | permit |
| Material Ordered | materials |
| Scheduled | scheduled |
| In Progress | in_progress |
| Complete, Closed | complete |

### Error Handling

```typescript
try {
  const data = await jobNimbusService.getContacts();
} catch (error) {
  if (error instanceof JobNimbusConfigError) {
    // API key not configured
  } else if (error instanceof JobNimbusError) {
    // API call failed - check error.statusCode
  }
}
```

---

## Google Sheets

### Purpose
Google Sheets serves as a flexible data store for:
- Team member information
- Inventory data
- Commission tracking
- Customer records
- Order history

### Configuration

**Environment Variables:**
```env
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Setting Up:**
1. Create Google Cloud project
2. Enable Google Sheets API
3. Create service account
4. Download JSON key file
5. Share spreadsheet with service account email
6. Extract credentials to environment variables

### Sheet Structure

**Required Sheets:**
| Sheet Name | Purpose |
|------------|---------|
| team-members-import | Team member profiles |
| Inventory | Product inventory |
| InventoryLogs | Stock change history |
| Commissions | Sales commission records |
| Customers | Customer database |
| Orders | Material orders |

### Integration Service

Location: `/lib/google-sheets-service.ts`

**Key Methods:**
```typescript
// Team Members
googleSheetsService.getTeamMembers()
googleSheetsService.updateTeamMember(member)
googleSheetsService.deleteTeamMember(slug)

// Inventory
googleSheetsService.getInventory({ category, lowStock, search })
googleSheetsService.updateInventoryItem(item)
googleSheetsService.deleteInventoryItem(sku)

// Commissions
googleSheetsService.getCommissions({ salesRep, startDate, endDate })
googleSheetsService.getCommissionSummaries()
googleSheetsService.addCommissionEntry(entry)

// Customers
googleSheetsService.getCustomers({ salesRep, search })
googleSheetsService.updateCustomer(customer)

// Orders
googleSheetsService.getOrders({ status, customerId })
googleSheetsService.updateOrder(order)
```

### Data Types

**Team Member:**
```typescript
interface TeamMember {
  slug: string;
  name: string;
  company: string;
  category: string;
  position: string;
  phone: string;
  email: string;
  displayOrder: number;
  bio: string;
  profileImage?: string;
  truckImage?: string;
  facebook?: string;
  instagram?: string;
}
```

**Inventory Item:**
```typescript
interface InventoryItem {
  sku: string;
  name: string;
  description: string;
  category: string;
  cost: number;
  price: number;
  quantity: number;
  minStock: number;
  maxStock: number;
  unit: string;
  supplier: string;
  location: string;
}
```

### Image URL Conversion

Google Drive share links are automatically converted to thumbnail URLs:
```
Input: https://drive.google.com/file/d/FILE_ID/view
Output: https://drive.google.com/thumbnail?id=FILE_ID&sz=w400
```

---

## GroupMe Notifications

### Purpose
GroupMe provides real-time team notifications for important business events.

### Configuration

**Environment Variables:**
```env
GROUPME_BOT_ID=your_bot_id
GROUPME_ACCESS_TOKEN=your_access_token  # Optional
GROUPME_ENABLED=true

# Notification toggles
GROUPME_NOTIFY_NEW_LEAD=true
GROUPME_NOTIFY_PROFILE_EDIT=true
GROUPME_NOTIFY_LOW_INVENTORY=true
GROUPME_NOTIFY_JOB_STATUS=true
GROUPME_NOTIFY_PORTAL_ACTIVITY=true
GROUPME_NOTIFY_DELIVERY=true
GROUPME_NOTIFY_SLA=true
```

**Creating a Bot:**
1. Log into GroupMe
2. Go to developers.groupme.com
3. Create new bot
4. Select target group
5. Copy Bot ID

### Integration Service

Location: `/lib/groupme-service.ts`

**Notification Types:**
- `new_lead` - New contact form submission
- `profile_edit_pending` - Team profile change awaiting approval
- `low_inventory` - Stock below threshold
- `job_status_change` - Job status updated
- `customer_portal_activity` - Customer accessed portal
- `delivery_update` - Delivery status changed
- `sla_alert` - SLA warning or violation
- `custom` - Custom notifications

**Sending Notifications:**
```typescript
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';

const config = getGroupMeConfigFromEnv();

// Create and send notification
const notification = groupMeService.createNewLeadNotification({
  name: 'John Doe',
  email: 'john@example.com',
  phone: '256-555-1234',
  source: 'Website Contact Form',
  message: 'I need a roof inspection'
});

await groupMeService.sendNotification(config, notification);
```

**Helper Methods:**
```typescript
// Pre-built notification creators
groupMeService.createNewLeadNotification(data)
groupMeService.createProfileEditNotification(data)
groupMeService.createLowInventoryNotification(data)
groupMeService.createJobStatusNotification(data)
groupMeService.createPortalActivityNotification(data)
groupMeService.createDeliveryUpdateNotification(data)
groupMeService.createSLAAlertNotification(data)

// Test connection
groupMeService.testConnection(botId)
```

### Message Format

Notifications are formatted with:
- Type prefix (e.g., `[NEW LEAD]`)
- Priority indicator for high/urgent
- Title
- Message body
- Details section
- `@all` mention for urgent items

---

## TeamUp Calendar

### Purpose
TeamUp provides calendar functionality for scheduling:
- Inspections
- Installations
- Deliveries
- Meetings

### Configuration

**Environment Variables:**
```env
TEAMUP_API_KEY=your_api_key
TEAMUP_CALENDAR_KEY=your_calendar_key

# Sub-calendars (optional)
TEAMUP_SUBCAL_INSPECTIONS=subcal_id
TEAMUP_SUBCAL_INSTALLATIONS=subcal_id
TEAMUP_SUBCAL_DELIVERIES=subcal_id
TEAMUP_SUBCAL_MEETINGS=subcal_id
TEAMUP_SUBCAL_GENERAL=subcal_id
```

**Getting API Key:**
1. Log into TeamUp
2. Navigate to Settings > API
3. Generate new API key
4. Get calendar key from calendar URL

### Integration Service

Location: `/lib/teamup-service.ts`

**Event Types:**
- `inspection`
- `installation`
- `repair`
- `delivery`
- `pickup`
- `meeting`
- `followup`
- `estimate`
- `other`

**Key Methods:**
```typescript
// Get events
teamupService.getEvents(startDate, endDate, subcalendarId?)

// Create events
teamupService.scheduleInspection({
  customerName: 'John Doe',
  customerPhone: '256-555-1234',
  address: '123 Main St',
  startTime: '2024-01-20T09:00:00',
  duration: 60,
  assignedTo: 'Hunter'
})

teamupService.scheduleInstallation({...})
teamupService.scheduleDelivery({...})
teamupService.scheduleMeeting({...})

// Update event
teamupService.updateEventStatus(eventId, 'completed', 'Notes')

// Get available slots
teamupService.getAvailableSlots(date, eventType, durationMinutes)
```

**Event Color Coding:**
| Event Type | Color |
|------------|-------|
| Inspection | Blue |
| Installation | Brand Green |
| Repair | Amber |
| Delivery | Purple |
| Meeting | Indigo |
| Followup | Teal |

### Demo Mode

When TeamUp is not configured, the service returns demo data for development.

---

## Weather APIs

### Purpose
Weather data helps with:
- Customer portal weather display
- Work scheduling decisions
- Hail storm tracking

### Services Used

**Open-Meteo (Free, No API Key):**
- Current conditions
- 7-day forecast
- Temperature, wind, precipitation

**National Weather Service:**
- Weather alerts
- Severe weather warnings

**Iowa State Mesonet:**
- Historical hail reports
- Storm data

### Integration Service

Location: `/lib/weather-service.ts`

**Key Methods:**
```typescript
// Get weather for address
const weather = await weatherService.getWeather('Huntsville, AL');
// Returns: current conditions, 7-day forecast, alerts

// Get hail reports
const hailReports = await weatherService.getHailReports(
  address,
  daysBack,  // default 30
  radiusMiles // default 50
);
```

### Weather Data Structure

```typescript
interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    condition: string;
    icon: string;
    isWorkable: boolean;
  };
  forecast: DayForecast[];
  alerts: WeatherAlert[];
  location: string;
  lastUpdated: string;
}
```

### Workability Logic

A day is considered "workable" for roofing when:
- Precipitation chance < 40%
- Wind speed < 25 mph
- No active rain/storm (weather code < 61)

### Supported Locations

Pre-configured coordinates for Alabama cities:
- Hartselle (HQ)
- Decatur
- Huntsville
- Madison
- Athens
- Cullman
- Birmingham
- Florence
- And more...

---

## Vercel Blob Storage

### Purpose
File storage for:
- Team member photos
- Project images
- Documents
- Blog post images

### Configuration

**Environment Variables:**
```env
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### Usage

```typescript
import { put } from '@vercel/blob';

const { url } = await put(filename, fileBuffer, {
  access: 'public',
});
```

---

## Integration Health Checks

### Checking Configuration

```typescript
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { isGoogleSheetsConfigured } from '@/lib/google-sheets-service';
import { teamupService } from '@/lib/teamup-service';

// Check each service
const jobNimbusOk = isJobNimbusConfigured();
const sheetsOk = isGoogleSheetsConfigured();
const teamupConfig = teamupService.checkConfiguration();
```

### Connection Testing

```typescript
// JobNimbus
const result = await jobNimbusService.testConnection();
// Returns: { success, message, contactCount }

// GroupMe
const result = await groupMeService.testConnection(botId);
// Returns: { success, error }
```

---

## Best Practices

### API Key Security

- Never commit API keys to version control
- Use environment variables
- Rotate keys periodically
- Use minimum required permissions

### Rate Limiting

- JobNimbus: Respect API limits
- Google Sheets: Batch operations when possible
- GroupMe: 202 responses indicate success
- Weather APIs: Cache responses (15 min)

### Error Handling

- Always catch API errors
- Provide fallback data when possible
- Log errors for debugging
- Show user-friendly messages

### Data Caching

- Cache weather data (15 minutes)
- Cache TeamUp events (5 minutes)
- Cache inventory data (1 minute)
- Invalidate cache on updates

---

## Troubleshooting

### JobNimbus Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check API key is valid |
| 429 Rate Limited | Reduce request frequency |
| 500 Server Error | Check JobNimbus status |
| Connection timeout | Check network, retry |

### Google Sheets Issues

| Issue | Solution |
|-------|----------|
| Permission denied | Share sheet with service account |
| Sheet not found | Check sheet name matches exactly |
| Invalid credentials | Verify private key format (\\n) |

### TeamUp Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check API key |
| Invalid calendar | Verify calendar key |
| Events not showing | Check date range |

### GroupMe Issues

| Issue | Solution |
|-------|----------|
| Messages not sending | Verify bot ID |
| Wrong group | Bot assigned to wrong group |
| Rate limited | Reduce notification frequency |
