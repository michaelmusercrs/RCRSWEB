# RCRS Platform & Tools Onboarding Guide

## Platform Overview

The RCRS platform is a custom-built web application that connects all aspects of the business: sales, operations, customer service, and administration. Everything runs through a central portal accessible from any device with a web browser.

- **Website**: www.rivercityroofingsolutions.com
- **Portal**: /portal (requires authentication)
- **Command Center**: /command-center (admin dashboard)
- **Customer Portal**: /customer-portal (customer-facing)

## Portal Navigation

### Main Portal Sections
- **Sales Portal** (`/portal/sales`): Lead management, pipeline view, commissions, quick-assign
- **Delivery Portal** (`/portal/delivery`): Material orders, delivery tracking, driver assignments
- **Inventory** (`/portal/inventory`): Stock levels, transaction history, material orders
- **Calendar** (`/portal/calendar`): TeamUp integration, inspections, deliveries, meetings
- **Training** (`/portal/training`): Sales training, onboarding, training library
- **Chat** (`/portal/chat`): GroupMe integration, team messaging, DMs

### Admin Sections
- **Command Center** (`/command-center`): KPIs, leaderboard, team overview
- **Admin Dashboard** (`/portal/admin`): User management, system settings
- **Reports** (`/command-center/reports`): Team performance, trends, insights

## Google Sheets Backend

Google Sheets is the primary data store. Understanding the tab structure is essential:

### Key Tabs
- **Contacts**: Customer information (name, phone, email, address)
- **Jobs**: Active and completed job records with statuses
- **Leads**: Incoming leads with source tracking and assignment
- **Inventory**: Material stock levels and SKUs
- **Commissions**: Rep commission calculations and payouts
- **Deliveries**: Delivery tickets and status tracking
- **Training**: Training progress and quiz scores

### Important Notes
- Data syncs between the portal and Sheets via API routes
- Never edit Sheets directly unless instructed -- use the portal interface
- Sheets data is the source of truth for reporting
- Contact your admin if you notice data discrepancies

## JobNimbus CRM

JobNimbus is the CRM for managing customer relationships and job lifecycle:

- **Contacts**: All customer records with contact history
- **Jobs**: Linked to contacts, with full pipeline tracking
- **Notes**: Activity log for each contact/job
- **Statuses**: Pipeline stages that sync with the RCRS portal
- **Mobile app**: Available for field use during inspections

### JN Sync with Portal
- Changes in JN automatically sync to the RCRS portal
- Changes in the portal push back to JN
- Keep both systems updated to avoid conflicts
- The sync engine runs on API routes in the background

## TeamUp Calendar

TeamUp is the shared team calendar:

- **Access**: Through the RCRS portal calendar page or directly via TeamUp
- **Event types**: Inspections, deliveries, installations, meetings, training
- **Color coding**: Different colors for different event types and team members
- **Syncing**: Bidirectional sync with the RCRS portal calendar
- **Google Calendar**: Events include Google Calendar links for personal calendar adds

### Creating Events
1. Navigate to `/portal/calendar`
2. Click on a date or time slot
3. Fill in event details (title, type, participants, notes)
4. The event syncs to TeamUp and appears for all team members

## GroupMe Messaging

GroupMe provides team communication:

- **Group chats**: Company-wide, department-specific, and project channels
- **Direct messages**: Private 1-on-1 conversations
- **@mentions**: Tag specific team members to get their attention
- **Chat widget**: Floating chat button available on all portal pages
- **Portal integration**: Full chat interface at `/portal/chat`

### Best Practices
- Use @mentions for urgent items needing specific attention
- Keep messages professional and relevant
- Use the appropriate channel (don't put delivery questions in the sales chat)
- Respond to direct messages within 2 hours during business hours

## Inventory Management

The inventory system tracks all roofing materials:

- **Stock levels**: Current quantities of each material
- **Orders**: Place new material orders linked to specific jobs
- **Transactions**: Full history of receiving, pulling, and returning materials
- **Alerts**: Low-stock notifications when materials drop below minimum levels

### Placing a Material Order
1. Go to `/portal/inventory`
2. Click "New Order"
3. Select the job number and materials needed
4. Specify quantities and preferred delivery date
5. Submit -- this automatically creates a delivery ticket

## Delivery System

The delivery portal manages the full material delivery lifecycle:

### Delivery Workflow
1. **Ordered**: Material order placed through inventory portal
2. **Staged**: Materials pulled and ready at the warehouse
3. **In Transit**: Driver has departed with the load
4. **Delivered**: Materials arrived at the jobsite

### Loading Checklist
Before every delivery, the driver completes the loading checklist:
- Verify materials match the delivery ticket
- Confirm quantities are correct
- Photograph the loaded truck
- Verify the delivery address
- Check for special instructions

### Delivery Reminders
- Customers receive automatic notifications with ETA
- Office staff see delivery status in real time
- Drivers update status through the portal

## Billing & Admin

For managers and admin staff:

- **Invoice management**: Create and track invoices at `/portal/admin/billing`
- **Commission tracking**: Review and approve commission calculations
- **User management**: Add/remove portal users, set roles and permissions
- **Reports**: Access team performance reports, trends, and insights
- **System settings**: Configure notification preferences, integrations, and defaults
