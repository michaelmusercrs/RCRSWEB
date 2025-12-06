// Material Orders Data - Source: items for web.pdf (Page 4)
// Last Updated: December 2025

export interface MaterialOrderRequest {
  orderId: string;
  salesRep: string;
  jobNumber: string;
  jobName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: string;
  city: string;
  state: string;
  zipCode: string;
  orderDate: string;
  requestedDeliveryDate: string;
  materials: MaterialOrderItem[];
  totalCost: number;
  totalPrice: number;
  specialInstructions?: string;
  priority: 'Normal' | 'Rush' | 'Urgent';
  status: 'Draft' | 'Pending' | 'Approved' | 'Ordered' | 'Shipped' | 'Delivered' | 'Cancelled';
  createdBy: string;
  approvedBy?: string;
  approvedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
}

// Sample material orders based on PDF format
export const materialOrders: MaterialOrderRequest[] = [
  {
    orderId: 'MO-20251201-001',
    salesRep: 'Hunter',
    jobNumber: 'JOB-2024-1234',
    jobName: 'Johnson Residence Roof Replacement',
    customerName: 'Robert Johnson',
    customerPhone: '256-555-0101',
    customerEmail: 'rjohnson@email.com',
    shippingAddress: '123 Oak Street',
    city: 'Huntsville',
    state: 'AL',
    zipCode: '35801',
    orderDate: '2025-12-01',
    requestedDeliveryDate: '2025-12-03',
    materials: [
      { productId: 'item-125', productName: 'RCRS Syn Felt', quantity: 10, unitCost: 66.00, unitPrice: 79.86, totalCost: 660.00, totalPrice: 798.60 },
      { productId: 'item-126', productName: 'Ice & Water Shield', quantity: 5, unitCost: 62.70, unitPrice: 114.22, totalCost: 313.50, totalPrice: 571.10 },
      { productId: 'item-127', productName: 'Ridge Vent 4LF', quantity: 20, unitCost: 7.15, unitPrice: 10.20, totalCost: 143.00, totalPrice: 204.00 },
      { productId: 'item-132', productName: 'Sealant', quantity: 12, unitCost: 9.35, unitPrice: 10.00, totalCost: 112.20, totalPrice: 120.00 }
    ],
    totalCost: 1228.70,
    totalPrice: 1693.70,
    specialInstructions: 'Gate code: 1234. Place materials in driveway.',
    priority: 'Normal',
    status: 'Delivered',
    createdBy: 'hunter@rcrsal.com',
    approvedBy: 'sara@rcrsal.com',
    approvedDate: '2025-12-01T10:30:00Z',
    createdAt: '2025-12-01T08:00:00Z',
    updatedAt: '2025-12-03T14:00:00Z'
  },
  {
    orderId: 'MO-20251202-001',
    salesRep: 'Aaron',
    jobNumber: 'JOB-2024-1235',
    jobName: 'Smith Commercial Building',
    customerName: 'Smith Properties LLC',
    customerPhone: '256-555-0102',
    shippingAddress: '456 Industrial Blvd',
    city: 'Decatur',
    state: 'AL',
    zipCode: '35601',
    orderDate: '2025-12-02',
    requestedDeliveryDate: '2025-12-04',
    materials: [
      { productId: 'item-123', productName: '1 1/4 EG Nails', quantity: 3, unitCost: 27.50, unitPrice: 64.90, totalCost: 82.50, totalPrice: 194.70 },
      { productId: 'item-124', productName: 'Bottom Caps (plastic)', quantity: 10, unitCost: 16.50, unitPrice: 29.15, totalCost: 165.00, totalPrice: 291.50 },
      { productId: 'item-128', productName: '1 1/2" Black Bullet Boot', quantity: 7, unitCost: 16.67, unitPrice: 20.89, totalCost: 116.69, totalPrice: 146.23 },
      { productId: 'item-129', productName: '2" Black Bullet Boot', quantity: 5, unitCost: 17.77, unitPrice: 22.54, totalCost: 88.85, totalPrice: 112.70 }
    ],
    totalCost: 453.04,
    totalPrice: 745.13,
    priority: 'Rush',
    status: 'Shipped',
    createdBy: 'aaron@rcrsal.com',
    approvedBy: 'michaelmuse@rcrsal.com',
    approvedDate: '2025-12-02T09:00:00Z',
    createdAt: '2025-12-02T07:30:00Z',
    updatedAt: '2025-12-02T15:00:00Z'
  },
  {
    orderId: 'MO-20251202-002',
    salesRep: 'Brendon',
    jobNumber: 'JOB-2024-1236',
    jobName: 'Williams Home Repair',
    customerName: 'Sarah Williams',
    customerPhone: '256-555-0103',
    customerEmail: 'swilliams@email.com',
    shippingAddress: '789 Maple Lane',
    city: 'Madison',
    state: 'AL',
    zipCode: '35758',
    orderDate: '2025-12-02',
    requestedDeliveryDate: '2025-12-05',
    materials: [
      { productId: 'item-130', productName: '3" Black Bullet Boot', quantity: 4, unitCost: 20.19, unitPrice: 38.29, totalCost: 80.76, totalPrice: 153.16 },
      { productId: 'item-131', productName: '4" Black Bullet Boot', quantity: 3, unitCost: 37.48, unitPrice: 42.50, totalCost: 112.44, totalPrice: 127.50 },
      { productId: 'item-133', productName: 'Zipper Boot', quantity: 2, unitCost: 37.40, unitPrice: 48.00, totalCost: 74.80, totalPrice: 96.00 }
    ],
    totalCost: 268.00,
    totalPrice: 376.66,
    specialInstructions: 'Customer will be home. Call 30 minutes before arrival.',
    priority: 'Normal',
    status: 'Pending',
    createdBy: 'brendon@rcrsal.com',
    createdAt: '2025-12-02T11:00:00Z',
    updatedAt: '2025-12-02T11:00:00Z'
  }
];

// Helper functions
export function getOrderById(orderId: string): MaterialOrderRequest | undefined {
  return materialOrders.find(o => o.orderId === orderId);
}

export function getOrdersByStatus(status: MaterialOrderRequest['status']): MaterialOrderRequest[] {
  return materialOrders.filter(o => o.status === status);
}

export function getOrdersBySalesRep(salesRep: string): MaterialOrderRequest[] {
  return materialOrders.filter(o => o.salesRep.toLowerCase() === salesRep.toLowerCase());
}

export function getPendingOrders(): MaterialOrderRequest[] {
  return materialOrders.filter(o => ['Draft', 'Pending'].includes(o.status));
}

export function getRecentOrders(limit: number = 10): MaterialOrderRequest[] {
  return [...materialOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function calculateOrderTotals(materials: MaterialOrderItem[]): { totalCost: number; totalPrice: number; margin: number } {
  const totalCost = materials.reduce((sum, m) => sum + m.totalCost, 0);
  const totalPrice = materials.reduce((sum, m) => sum + m.totalPrice, 0);
  const margin = ((totalPrice - totalCost) / totalPrice) * 100;

  return { totalCost, totalPrice, margin };
}

export function generateOrderId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MO-${date}-${random}`;
}
