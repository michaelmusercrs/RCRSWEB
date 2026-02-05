# RCRS Command Center

The RCRS Command Center is a unified business dashboard for River City Roofing Solutions. It provides role-based access to sales data, inventory management, marketing tools, meetings, and phone system management.

## Table of Contents

- [Access](#access)
- [Environment Variables](#environment-variables)
- [Available Routes](#available-routes)
- [Role Permissions](#role-permissions)
- [Managing Team Members](#managing-team-members)
- [Updating Commission Data](#updating-commission-data)
- [Development](#development)

---

## Access

The Command Center is accessible at `/command-center` and requires authentication through the Team Portal.

**URL:** `https://your-domain.com/command-center`

Users must first log in through the Team Portal (`/portal`) with their email or PIN. Once authenticated, they can access the Command Center with permissions appropriate to their role.

---

## Environment Variables

The following environment variables are used by the Command Center:

### Required for Live Inventory (Google Sheets Integration)

```bash
# Google Service Account credentials
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Sheets ID for inventory data
INVENTORY_SHEETS_ID=your-google-sheets-id
```

**Note:** If these are not configured, the inventory system will use mock/demo data.

### Optional

```bash
# JobNimbus API integration (for sales data sync)
JOBNIMBUS_API_KEY=your-jobnimbus-api-key
```

---

## Available Routes

### Main Dashboard
| Route | Description |
|-------|-------------|
| `/command-center` | Main dashboard with KPIs and quick stats |

### Sales Module
| Route | Description |
|-------|-------------|
| `/command-center/sales` | Sales leaderboard and team performance |
| `/command-center/sales/[rep]` | Individual sales rep statistics |
| `/command-center/sales/achievements` | Team achievements and badges |

### Inventory Module
| Route | Description |
|-------|-------------|
| `/command-center/inventory` | Inventory listing with search and filters |
| `/command-center/inventory/[sku]` | Individual item detail page |

### Marketing Module
| Route | Description |
|-------|-------------|
| `/command-center/marketing` | Marketing hub overview |
| `/command-center/marketing/ads` | Ad campaign management |
| `/command-center/marketing/calendar` | Marketing calendar |
| `/command-center/marketing/emails` | Email campaigns |

### Meetings Module
| Route | Description |
|-------|-------------|
| `/command-center/meetings` | Monday meeting dashboard |
| `/command-center/meetings/prep` | Meeting preparation tools |
| `/command-center/meetings/archives` | Past meeting archives |

### Phone Module
| Route | Description |
|-------|-------------|
| `/command-center/phone` | Phone system dashboard |
| `/command-center/phone/[extension]` | Extension details |

---

## Role Permissions

The Command Center uses a role-based access control (RBAC) system with six roles:

### Role Hierarchy (Highest to Lowest)
1. **Owner** - Full system access
2. **Admin** - Full access (except some financial details)
3. **Manager** - Operations, team oversight, inventory management
4. **Office** - Billing, schedule, customer management
5. **Sales** - Leaderboard, own stats, inventory quantities only
6. **Driver** - Deliveries, inventory for assigned jobs only

### Permission Matrix

| Feature | Owner | Admin | Manager | Office | Sales | Driver |
|---------|-------|-------|---------|--------|-------|--------|
| Dashboard (Full) | Yes | Yes | Yes | Yes | - | - |
| Dashboard (Own) | Yes | Yes | Yes | Yes | Yes | Yes |
| Sales View All | Yes | Yes | Yes | Yes | - | - |
| Sales View Own | Yes | Yes | Yes | Yes | Yes | - |
| Sales Commissions | Yes | Yes | - | - | - | - |
| Inventory View | Yes | Yes | Yes | Yes | Yes | Yes |
| Inventory View Costs | Yes | Yes | Yes | - | - | - |
| Inventory Edit | Yes | Yes | Yes | - | - | - |
| Inventory Delete | Yes | Yes | - | - | - | - |
| Marketing View | Yes | Yes | Yes | - | - | - |
| Marketing Edit | Yes | Yes | Yes | - | - | - |
| Phone View All | Yes | Yes | Yes | Yes | - | - |
| Phone Manage | Yes | Yes | - | - | - | - |
| Team View | Yes | Yes | Yes | Yes | Yes | Yes |
| Team Edit | Yes | Yes | - | - | - | - |
| Billing View | Yes | Yes | Yes | Yes | - | - |
| Billing Edit | Yes | Yes | Yes | Yes | - | - |

---

## Managing Team Members

Team members are defined in `lib/team-roles.ts`. To add a new team member:

1. Open `lib/team-roles.ts`
2. Add a new entry to the `TEAM_MEMBERS` array:

```typescript
{
  id: 'RVR-XXX',           // Unique ID
  name: 'New Member',       // Full name
  slug: 'new-member',       // URL-friendly slug
  email: 'member@rcrsal.com',
  phone: '256-XXX-XXXX',    // Optional
  role: 'driver',           // One of: owner, admin, office, project_manager, driver, viewer
  pin: '1234',              // 4-digit PIN for login
  isActive: true,
  permissions: [            // Array of specific permissions
    'view_dashboard',
    'view_schedule'
  ],
  createdAt: '2024-XX-XX'
}
```

3. Save the file and redeploy

### Role to TeamRole Mapping

The Command Center maps `TeamRole` (from `lib/team-roles.ts`) to `Role` (from `types/roles.ts`):

| TeamRole | Maps To |
|----------|---------|
| `owner` | `Owner` |
| `admin` | `Admin` |
| `office` | `Office` |
| `project_manager` | `Manager` |
| `driver` | `Driver` |
| `viewer` | `Sales` |

---

## Updating Commission Data

Commission data is stored in `data/commissions.json`. To update:

1. Export your commission data from your CRM or spreadsheet
2. Format it as JSON following this structure:

```json
{
  "lastUpdated": "2024-01-15T00:00:00.000Z",
  "period": "January 2024",
  "salesReps": [
    {
      "id": "rep-id",
      "name": "Rep Name",
      "deals": 10,
      "revenue": 50000,
      "commission": 5000,
      "closeRate": 0.35
    }
  ]
}
```

3. Replace `data/commissions.json` with your new data
4. Redeploy the application

**Note:** Commission data is also displayed on individual rep pages at `/command-center/sales/[rep]`

---

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

### Project Structure

```
app/command-center/
  layout.tsx          # Root layout with auth/training providers
  page.tsx            # Main dashboard
  loading.tsx         # Loading state
  error.tsx           # Error boundary
  not-found.tsx       # 404 page
  inventory/          # Inventory module
  marketing/          # Marketing module
  meetings/           # Meetings module
  phone/              # Phone module
  sales/              # Sales module

components/command-center/
  CommandCenterLayout.tsx   # Main layout with sidebar
  DataTable.tsx             # Reusable data table
  InventoryCard.tsx         # Inventory item card
  PermissionGate.tsx        # Permission-based rendering
  RoleBadge.tsx             # Role badge component
  SearchInput.tsx           # Search input with debounce
  StatCard.tsx              # Statistics card
  StockAdjustModal.tsx      # Stock adjustment modal

lib/
  auth-context.tsx    # Authentication context
  permissions.ts      # Permission checking utilities
  team-roles.ts       # Team member definitions
  training-context.tsx # Training feature context

types/
  roles.ts            # Role and permission type definitions
```

---

## Support

For technical issues, contact: support@rcrsal.com

---

*Last Updated: February 2026*
