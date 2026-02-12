# Call Recording Integration

## Overview

This document describes the call recording integration for River City Roofing Solutions website. The integration connects the Google Voice PBX system with the website to provide:

- Call logging and history
- Recording storage and playback
- Customer portal call display
- Admin call management dashboard
- JobNimbus contact linking

---

## Architecture

```
+-------------------+     +------------------+     +------------------+
|   Google Voice    |     |                  |     |                  |
|   PBX Bridge      |---->|   Webhook API    |---->|   calls.json     |
|   (Node.js)       |     |   /api/calls/    |     |   (data store)   |
+-------------------+     |   webhook        |     +------------------+
                          +------------------+             |
                                                           v
                          +------------------+     +------------------+
                          |  Customer Portal |<----|   Calls Service  |
                          |  /my/[token]     |     |   lib/calls-     |
                          +------------------+     |   service.ts     |
                                                   +------------------+
                          +------------------+             |
                          |  Command Center  |<------------+
                          |  /command-center |
                          |  /phone/calls    |
                          +------------------+
```

---

## API Endpoints

### 1. Webhook Endpoint

**POST /api/calls/webhook**

Receives call events from the PBX system.

**Headers:**
- `x-api-key` or `Authorization: Bearer <key>` - Required in production

**Request Body:**
```json
{
  "event": "call_start|call_end|call_missed|voicemail|recording_ready",
  "callUuid": "unique-call-id-from-pbx",
  "from": "2565551234",
  "to": "2565154245",
  "extension": "103",
  "direction": "inbound|outbound",
  "duration": 345,
  "recordingUrl": "https://recordings.example.com/call.mp3",
  "timestamp": "2026-02-04T10:30:00.000Z",
  "callerIdName": "John Smith"
}
```

**Response:**
```json
{
  "success": true,
  "event": "call_end",
  "callId": "CALL-1738600000000-A1B2C3",
  "status": "completed",
  "timestamp": "2026-02-04T10:35:45.000Z"
}
```

### 2. Get Calls

**GET /api/calls**

Retrieve calls with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| customerId | string | Filter by customer ID |
| customerPhone | string | Filter by phone number |
| repId | string | Filter by rep ID |
| repExtension | string | Filter by extension |
| direction | string | `inbound` or `outbound` |
| status | string | `completed`, `missed`, `voicemail` |
| startDate | string | ISO date (filter from) |
| endDate | string | ISO date (filter to) |
| search | string | Search name/phone/notes |
| tags | string | Comma-separated tags |
| limit | number | Max records (default 50) |
| offset | number | Pagination offset |
| analytics | boolean | Include analytics data |

**Response:**
```json
{
  "calls": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "stats": {
    "totalCalls": 150,
    "totalDuration": 45000,
    "inboundCalls": 120,
    "outboundCalls": 30,
    "missedCalls": 15,
    "completedCalls": 135,
    "averageDuration": 300
  },
  "analytics": {...}
}
```

### 3. Get Customer Calls

**GET /api/calls/customer/[customerId]**

Get calls for a specific customer (by ID or phone).

**Query Parameters:**
- `limit` - Max records (default 20)
- `includeRecordings` - Include recording URLs (requires permission)

**Response:**
```json
{
  "calls": [...],
  "summary": {
    "totalCalls": 5,
    "inboundCalls": 3,
    "outboundCalls": 2,
    "missedCalls": 0,
    "totalDuration": 1200,
    "averageDuration": 240,
    "lastCall": "2026-02-04T10:30:00.000Z",
    "mostFrequentRep": {
      "repId": "destin",
      "repName": "Destin",
      "count": 3
    }
  }
}
```

### 4. Update Call

**PATCH /api/calls/[callId]**

Update a call record (notes, tags, customer linking).

**Request Body:**
```json
{
  "notes": "Customer wants blue shingles",
  "tags": ["estimate", "residential"],
  "customerId": "CUST-123",
  "customerName": "John Smith",
  "jobNimbusContactId": "JN-456"
}
```

### 5. Analytics

**GET /api/calls/analytics**

Get detailed call analytics.

**Query Parameters:**
- `days` - Days to analyze (default 30)
- `repId` - Filter by rep

---

## Data Schema

### Call Record

| Field | Type | Description |
|-------|------|-------------|
| callId | string | Unique ID (CALL-timestamp-random) |
| customerId | string | Customer ID if known |
| customerName | string | Caller name |
| customerPhone | string | Phone number (digits only) |
| customerEmail | string | Email if known |
| repId | string | Rep/employee ID |
| repName | string | Rep name |
| repExtension | string | Extension number |
| direction | string | `inbound` or `outbound` |
| status | string | Call status |
| startTime | string | ISO timestamp |
| endTime | string | ISO timestamp |
| duration | number | Seconds |
| recordingUrl | string | Recording file URL |
| recordingAvailable | boolean | Has recording |
| notes | string | Call notes |
| tags | string[] | Categorization tags |
| jobNimbusContactId | string | JobNimbus link |
| createdAt | string | Record created |
| updatedAt | string | Last updated |

---

## Integration with PBX

### Configuring the Bridge

In the Google Voice PBX bridge, configure webhook notifications:

```yaml
# config/config.yaml

webhooks:
  enabled: true
  url: "https://rivercityroofingsolutions.com/api/calls/webhook"
  api_key: "${CALLS_WEBHOOK_API_KEY}"
  events:
    - call_start
    - call_end
    - call_missed
    - voicemail
    - recording_ready
  retry:
    attempts: 3
    delay_ms: 1000
```

### Environment Variables

Add to `.env.local`:

```env
# Call Recording Integration
CALLS_WEBHOOK_API_KEY=your-secure-api-key-here
```

---

## UI Components

### CallHistory Component

Located at: `components/CallHistory.tsx`

Usage:
```tsx
import { CallHistory } from '@/components/CallHistory';

<CallHistory
  calls={calls}
  showRecordings={true}
  showRepInfo={true}
  showCustomerInfo={true}
  allowExpand={true}
  showFilters={true}
  onCallClick={(call) => console.log(call)}
/>
```

### CustomerCallHistory Component

Located at: `components/CustomerCallHistory.tsx`

Simplified version for customer portal:
```tsx
import { CustomerCallHistory } from '@/components/CustomerCallHistory';

<CustomerCallHistory
  customerId="CUST-123"
  allowRecordingPlayback={false}
  limit={10}
/>
```

---

## Pages

### Call Logs Dashboard

**URL:** `/command-center/phone/calls`

Features:
- All calls with filtering
- Search by name, phone, notes
- Filter by status, direction, date range, rep
- Call analytics sidebar
- Export functionality

### Phone System Page

**URL:** `/command-center/phone`

Updated with:
- Link to call logs
- Quick action for viewing call history

---

## Security

### Permissions

Call-related permissions in `lib/permissions.ts`:

- `phone.viewAll` - View all calls (admin/manager)
- `phone.viewRecordings` - Listen to call recordings
- `phone.manage` - Edit call notes/tags

### API Key Protection

The webhook endpoint requires API key authentication:

1. Set `CALLS_WEBHOOK_API_KEY` in environment
2. PBX sends key in header: `x-api-key: your-key`
3. In development, keys are optional for testing

---

## Files Created

| File | Purpose |
|------|---------|
| `data/calls.json` | Call data storage |
| `lib/calls-service.ts` | Core call management service |
| `types/calls.ts` | TypeScript type definitions |
| `app/api/calls/webhook/route.ts` | Webhook receiver |
| `app/api/calls/route.ts` | Main calls API |
| `app/api/calls/[callId]/route.ts` | Single call operations |
| `app/api/calls/customer/[customerId]/route.ts` | Customer calls |
| `app/api/calls/analytics/route.ts` | Call analytics |
| `app/api/command-center/calls/route.ts` | Dashboard data |
| `app/command-center/phone/calls/page.tsx` | Call logs page |
| `components/CallHistory.tsx` | Call list component |
| `components/CustomerCallHistory.tsx` | Customer portal component |

---

## Testing

### Test Webhook

```bash
curl -X POST http://localhost:3000/api/calls/webhook \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "event": "call_start",
    "callUuid": "test-123",
    "from": "2565551234",
    "to": "2565154245",
    "extension": "103",
    "direction": "inbound",
    "timestamp": "2026-02-05T10:00:00.000Z",
    "callerIdName": "Test Caller"
  }'
```

### Test Call End

```bash
curl -X POST http://localhost:3000/api/calls/webhook \
  -H "Content-Type: application/json" \
  -H "x-api-key: test-key" \
  -d '{
    "event": "call_end",
    "callUuid": "test-123",
    "from": "2565551234",
    "to": "2565154245",
    "extension": "103",
    "direction": "inbound",
    "duration": 180,
    "timestamp": "2026-02-05T10:03:00.000Z"
  }'
```

---

## Future Enhancements

1. **Real-time Updates** - WebSocket for live call status
2. **Recording Transcription** - AI-powered transcription
3. **Call Scoring** - Automatic call quality scoring
4. **CRM Sync** - Two-way JobNimbus integration
5. **SMS Follow-up** - Automatic missed call SMS
6. **Analytics Dashboard** - Advanced reporting

---

## Support

For issues or questions about the call recording integration:
- Check logs: `/data/calls.json`
- API errors: Check response status codes
- Webhook issues: Verify API key and PBX config
