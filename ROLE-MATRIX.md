# River City Roofing Solutions - Portal Role Matrix

## Overview

This document defines the role-based access control (RBAC) system for the RCRS Portal. Each role has specific permissions that determine what features, data, and actions are available to users.

## Role Hierarchy

```
Owner (Level 100)
  |
Admin (Level 90)
  |
Manager (Level 80)
  |
Sales / Office / Project Manager (Level 50-60)
  |
Driver (Level 40)
  |
Customer (Level 10)
```

---

## Role Definitions

### 1. ADMIN (Michael, Sara)

**Description:** Full system access with approval authority.

**Assigned Users:**
- Michael Muse (owner role - inherits admin)
- Sara Hill (admin role)

**Permissions:**
| Category | View | Create | Edit | Delete | Approve |
|----------|:----:|:------:|:----:|:------:|:-------:|
| Dashboard | All | - | - | - | - |
| Users | All | Yes | Yes | Yes | Yes |
| Profile | All | - | Yes | - | Yes |
| Leads | All | Yes | All | Yes | Yes |
| Jobs | All | Yes | Yes | Yes | Yes |
| Inventory | All + Costs | Yes | Yes | Yes | Yes |
| Deliveries | All | Yes | Yes | - | Yes |
| Orders | All | Yes | Yes | Yes | Yes |
| Billing | All | Yes | Yes | Yes | Yes |
| Schedule | All | Yes | Yes | Yes | - |
| Reports | All + Financial | - | - | - | Export |
| Settings | All | - | Yes | - | - |
| Approvals | Queue | - | - | - | Yes |

**Dashboard Features:**
- Full system overview
- All team performance metrics
- Approval queue with badge count
- Low stock alerts
- Financial reports access
- User management quick link

---

### 2. MANAGER (Destin)

**Description:** Operations oversight with view-all access but limited edit capabilities.

**Assigned Users:**
- Destin McCury

**Permissions:**
| Category | View | Create | Edit | Delete | Approve |
|----------|:----:|:------:|:----:|:------:|:-------:|
| Dashboard | All | - | - | - | - |
| Users | All | No | No | No | No |
| Profile | All | - | Own | - | No |
| Leads | All | No | Own | No | No |
| Jobs | All | No | Schedule | No | No |
| Inventory | All + Costs | No | Restock | No | No |
| Deliveries | All | No | Assign | No | No |
| Orders | All | No | No | No | View Only |
| Billing | All | No | No | No | No |
| Schedule | All | Yes | Yes | No | - |
| Reports | All | - | - | - | Export |
| Settings | No | - | No | - | - |
| Approvals | View Only | - | - | - | No |

**Dashboard Features:**
- Team performance dashboards
- Delivery tracking overview
- Inventory oversight with cost visibility
- Schedule management
- Read-only approval queue access

---

### 3. SALES REP (John, Bart, Tia, Boston)

**Description:** Focused on own leads and jobs with personal stats tracking.

**Assigned Users:**
- John Cordonis*
- Bart Roberts*
- Tia Morris
- Boston (add to team)
- Hunter, Aaron, Greg, Brendon, Rick, Rudy, Adam

*Note: John and Bart also have Project Manager roles

**Permissions:**
| Category | View | Create | Edit | Delete | Approve |
|----------|:----:|:------:|:----:|:------:|:-------:|
| Dashboard | Own | - | - | - | - |
| Users | No | No | No | No | No |
| Profile | Own | - | Own (pending) | - | No |
| Leads | Own | Yes | Own | No | No |
| Jobs | Own | No | No | No | No |
| Inventory | Qty Only | No | No | No | No |
| Deliveries | Own | No | No | No | No |
| Orders | Own | Yes | No | No | No |
| Billing | Own | No | No | No | No |
| Schedule | Own | No | No | No | - |
| Reports | Own Stats | - | - | - | No |
| Settings | No | - | No | - | - |
| Approvals | No | - | - | - | No |

**Dashboard Features:**
- Personal leads list
- Active jobs counter
- Personal performance stats
- Leaderboard position
- Commission tracking
- Profile edit (requires approval)
- Quick contact for customers

**Data Filtering:**
- Only sees their own assigned leads and jobs
- Cannot see cost/pricing information
- Cannot see other reps' commission data

---

### 4. DELIVERY/DRIVER (Richard, Tae)

**Description:** Delivery-focused with route management and photo uploads.

**Assigned Users:**
- Richard Geahr
- Tae Orr

**Permissions:**
| Category | View | Create | Edit | Delete | Approve |
|----------|:----:|:------:|:----:|:------:|:-------:|
| Dashboard | Own | - | - | - | - |
| Users | No | No | No | No | No |
| Profile | Own | - | No | - | No |
| Leads | No | No | No | No | No |
| Jobs | Assigned | No | No | No | No |
| Inventory | For Jobs | No | Adjust Qty | No | No |
| Deliveries | Queue | No | Status | No | No |
| Orders | No | No | No | No | No |
| Billing | No | No | No | No | No |
| Schedule | Own | No | No | No | - |
| Reports | No | - | - | - | No |
| Settings | No | - | No | - | - |
| Approvals | No | - | - | - | No |

**Dashboard Features:**
- Today's delivery queue
- Route navigation integration
- Loading checklists
- Delivery status updates
- Photo upload for proof of delivery
- Signature capture
- GPS activity logging

**Workflow Steps:**
1. View assigned deliveries
2. Verify load (checklist)
3. Start delivery (GPS tracking)
4. Mark arrived
5. Complete delivery
6. Capture proof (signature + photo)
7. QC photos
8. Complete ticket

---

### 5. PROJECT MANAGER (Bart, John)

**Description:** Job scheduling and delivery coordination.

**Assigned Users:**
- Bart Roberts
- John Cordonis

**Permissions:**
| Category | View | Create | Edit | Delete | Approve |
|----------|:----:|:------:|:----:|:------:|:-------:|
| Dashboard | All | - | - | - | - |
| Users | No | No | No | No | No |
| Profile | Own | - | Own (pending) | - | No |
| Leads | All | No | No | No | No |
| Jobs | All | Yes | Yes | No | No |
| Inventory | All | No | Restock Req | No | No |
| Deliveries | All | Yes | No | No | No |
| Orders | All | Yes | Yes | No | No |
| Billing | No | No | No | No | No |
| Schedule | All | Yes | Yes | No | - |
| Reports | No | - | - | - | No |
| Settings | No | - | No | - | - |
| Approvals | No | - | - | - | No |

**Dashboard Features:**
- Active job list
- Material order creation
- Delivery scheduling
- JobNimbus data sync
- Inventory needs forecasting
- Driver coordination

---

### 6. CUSTOMER (External)

**Description:** Limited portal for job tracking and communication.

**Assigned Users:**
- Created dynamically per customer with access codes

**Permissions:**
| Category | View | Create | Edit | Delete | Approve |
|----------|:----:|:------:|:----:|:------:|:-------:|
| Job Status | Own | No | No | No | No |
| Weather | Alerts | No | No | No | No |
| Documents | Own | No | No | No | No |
| Images | Own | Upload | No | No | No |
| Rep Contact | Yes | Messages | No | No | No |

**Dashboard Features:**
- Project status timeline
- Weather/storm alerts
- Document viewing (contracts, estimates)
- Image upload capability
- Direct rep contact
- Next appointment display

---

## Implementation Files

### Core Files Created/Updated:

1. **`/types/portal-roles.ts`**
   - Role type definitions
   - Permission type definitions
   - Role hierarchy configuration
   - Role display configuration

2. **`/lib/portal-permissions.ts`**
   - Permission checking functions
   - Route access control
   - Navigation filtering
   - Data filtering by role
   - Resource ownership checking

3. **`/lib/role-dashboards.ts`**
   - Role-specific dashboard configurations
   - Navigation items per role
   - Stat widgets per role
   - Feature flags per role

4. **`/lib/team-roles.ts`** (Updated)
   - Team member definitions
   - Role assignments
   - Permission arrays
   - Helper functions

---

## Usage Examples

### Checking Permission
```typescript
import { hasPortalPermission } from '@/lib/portal-permissions';

if (hasPortalPermission(user.role, 'inventory.view_costs')) {
  // Show cost column
}
```

### Filtering Data by Role
```typescript
import { filterDataByPortalRole } from '@/lib/portal-permissions';

const filteredInventory = filterDataByPortalRole(inventory, user.role);
// Cost fields automatically removed for non-admin roles
```

### Getting Dashboard Config
```typescript
import { getDashboardConfig } from '@/lib/role-dashboards';

const config = getDashboardConfig(user.role);
// Returns role-specific stats, navigation, and features
```

### Checking Route Access
```typescript
import { canAccessPortalRoute } from '@/lib/portal-permissions';

if (!canAccessPortalRoute(user.role, '/portal/admin')) {
  redirect(getDefaultRouteForRole(user.role));
}
```

---

## Data Visibility Matrix

| Data Type | Admin | Manager | Sales | PM | Driver | Customer |
|-----------|:-----:|:-------:|:-----:|:--:|:------:|:--------:|
| All Leads | Yes | Yes | No | Yes | No | No |
| Own Leads | Yes | Yes | Yes | No | No | No |
| Job Costs | Yes | Yes | No | No | No | No |
| Inventory Costs | Yes | Yes | No | No | No | No |
| Commissions | Yes | No | No | No | No | No |
| All Deliveries | Yes | Yes | No | Yes | No | No |
| Own Deliveries | Yes | Yes | No | No | Yes | No |
| Financial Reports | Yes | No | No | No | No | No |
| User Management | Yes | No | No | No | No | No |
| System Settings | Yes | No | No | No | No | No |

---

## Profile Edit Approval Workflow

For roles with `profileEditRequiresApproval: true`:

1. User submits profile edit
2. Changes saved as "pending"
3. Admin receives notification
4. Admin reviews changes
5. Admin approves or rejects
6. User notified of result
7. If approved, changes go live

**Roles requiring approval:**
- Manager
- Sales Rep
- Project Manager
- Driver

**Roles NOT requiring approval:**
- Admin (immediate)
- Customer (limited fields)

---

## Navigation Visibility

### Admin/Owner Sees:
- Command Center (featured)
- Operations Center
- Customer Portals
- Approval Queue
- All portal sections
- User Management
- Settings

### Manager Sees:
- Command Center
- Team Performance
- All Deliveries
- Inventory
- Schedule
- Reports

### Sales Rep Sees:
- My Leads
- My Jobs
- My Performance
- Edit My Profile
- Check Inventory
- My Schedule

### Driver Sees:
- My Deliveries (featured)
- View Route
- Check Inventory

### Project Manager Sees:
- Create Material Order (featured)
- My Jobs
- Track Deliveries
- Schedule
- Inventory
- JobNimbus Sync

### Customer Sees:
- Project Status (featured)
- Weather Updates
- My Documents
- Upload Images
- Contact My Rep

---

## Security Considerations

1. **Route Protection:** All portal routes check permissions before rendering
2. **API Protection:** API endpoints validate user role and permissions
3. **Data Filtering:** Sensitive fields automatically removed based on role
4. **Ownership Validation:** Users can only access their own resources unless they have view_all permission
5. **Session Management:** JWT tokens with role and permissions embedded
6. **Audit Logging:** All significant actions logged with user ID and role

---

## Version History

- **v2.0.0** (2026-02-05): Complete RBAC system implementation
  - Added portal-roles types
  - Added portal-permissions service
  - Added role-dashboards configuration
  - Updated team-roles with sales role
  - Created comprehensive documentation
