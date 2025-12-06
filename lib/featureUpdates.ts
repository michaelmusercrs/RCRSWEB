// Feature Updates - Notify users of new features and changes
// Last Updated: December 2025

export interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  version: string;
  releaseDate: string;
  category: 'new' | 'improvement' | 'fix' | 'training';
  affectedRoles: ('owner' | 'admin' | 'office' | 'project_manager' | 'driver' | 'viewer')[];
  instructions?: string[];
  isHighPriority: boolean;
}

// Feature updates - newest first
export const featureUpdates: FeatureUpdate[] = [
  {
    id: 'FU-2025-012',
    title: 'New Inventory System',
    description: 'Complete inventory management with real pricing from supplier sheets. Track 11 products with accurate costs and prices.',
    version: '2.5.0',
    releaseDate: '2025-12-04',
    category: 'new',
    affectedRoles: ['owner', 'admin', 'office', 'driver'],
    instructions: [
      'Navigate to Portal > Inventory to view all products',
      'Each product shows Cost, Price, and Current Stock',
      'Use filters to find products by category',
      'Low stock alerts appear when quantity drops below minimum'
    ],
    isHighPriority: true
  },
  {
    id: 'FU-2025-011',
    title: 'Transaction History',
    description: 'View complete history of all inventory transactions including deliveries, restocks, returns, and adjustments.',
    version: '2.5.0',
    releaseDate: '2025-12-04',
    category: 'new',
    affectedRoles: ['owner', 'admin', 'office'],
    instructions: [
      'Go to Portal > Transactions to see all activity',
      'Filter by transaction type, item, or date range',
      'View profit margins on deliveries',
      'Export data for reporting'
    ],
    isHighPriority: false
  },
  {
    id: 'FU-2025-010',
    title: 'Material Orders System',
    description: 'Create and manage material orders directly from the portal. Add products, set quantities, and track order status.',
    version: '2.5.0',
    releaseDate: '2025-12-04',
    category: 'new',
    affectedRoles: ['owner', 'admin', 'office', 'project_manager'],
    instructions: [
      'Click Portal > Orders to access material orders',
      'Use "Create Order" to start a new order',
      'Select products from inventory with current pricing',
      'Set priority: Normal, Rush, or Urgent',
      'Track order status from Draft to Delivered'
    ],
    isHighPriority: true
  },
  {
    id: 'FU-2025-009',
    title: 'Scheduled Tasks',
    description: 'View and manage scheduled tasks including deliveries, inspections, installations, and follow-ups.',
    version: '2.5.0',
    releaseDate: '2025-12-04',
    category: 'new',
    affectedRoles: ['owner', 'admin', 'office', 'project_manager', 'driver'],
    instructions: [
      'Access Portal > Tasks to see all scheduled work',
      'Filter by status: Pending, In Progress, Completed',
      'Filter by type: Delivery, Inspection, Installation, etc.',
      'Click a task to see full details and update status'
    ],
    isHighPriority: false
  },
  {
    id: 'FU-2025-008',
    title: 'Location Tracking',
    description: 'View GPS logs and track team member locations. See activity history and travel routes.',
    version: '2.5.0',
    releaseDate: '2025-12-04',
    category: 'new',
    affectedRoles: ['owner', 'admin', 'office'],
    instructions: [
      'Navigate to Portal > Locations',
      'View "Active Users" tab for current locations',
      'View "Logs" tab for activity history',
      'Filter by user, date, or activity type'
    ],
    isHighPriority: false
  },
  {
    id: 'FU-2025-007',
    title: 'Billing & Pricing Calculator',
    description: 'Updated billing system with customer-type pricing. Automatic markups for commercial and insurance jobs.',
    version: '2.5.0',
    releaseDate: '2025-12-04',
    category: 'improvement',
    affectedRoles: ['owner', 'admin', 'office'],
    instructions: [
      'Pricing adjusts automatically by customer type:',
      '  - Residential: Standard pricing',
      '  - Commercial: +35% markup',
      '  - Contractor: -10% discount',
      '  - Insurance: +30% markup',
      'Volume discounts apply for bulk orders over $5,000'
    ],
    isHighPriority: true
  },
  {
    id: 'FU-2025-006',
    title: 'Employee Directory',
    description: 'Complete team directory with 21 employees. View contact info, roles, and department assignments.',
    version: '2.5.0',
    releaseDate: '2025-12-04',
    category: 'new',
    affectedRoles: ['owner', 'admin', 'office', 'project_manager', 'driver'],
    instructions: [
      'Access Portal > Directory',
      'Search by name or filter by role/department',
      'Click employee cards to see contact details',
      'Use phone/email links for quick contact'
    ],
    isHighPriority: false
  },
  {
    id: 'FU-2025-005',
    title: 'Driver PIN Login Updated',
    description: 'Driver PINs have been updated to match the official employee records.',
    version: '2.5.0',
    releaseDate: '2025-12-04',
    category: 'fix',
    affectedRoles: ['driver'],
    instructions: [
      'Use your assigned 4-digit PIN to login',
      'Richard: PIN 1136',
      'Tae: PIN 2033',
      'Contact admin if you need your PIN reset'
    ],
    isHighPriority: true
  }
];

// Get updates for a specific role
export function getUpdatesForRole(role: string): FeatureUpdate[] {
  return featureUpdates.filter(update =>
    update.affectedRoles.includes(role as any)
  );
}

// Get unread updates for a user (based on last seen version)
export function getUnreadUpdates(role: string, lastSeenVersion: string): FeatureUpdate[] {
  const roleUpdates = getUpdatesForRole(role);
  return roleUpdates.filter(update => update.version > lastSeenVersion);
}

// Get high priority updates
export function getHighPriorityUpdates(role: string): FeatureUpdate[] {
  return getUpdatesForRole(role).filter(update => update.isHighPriority);
}

// Get latest version number
export function getLatestVersion(): string {
  return featureUpdates[0]?.version || '1.0.0';
}

// Get updates by category
export function getUpdatesByCategory(category: FeatureUpdate['category']): FeatureUpdate[] {
  return featureUpdates.filter(update => update.category === category);
}
