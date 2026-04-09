// Material Orders — type definitions and helpers.
//
// IMPORTANT: This file used to contain hardcoded sample data ("Sarah Williams",
// "Smith Properties LLC", "Robert Johnson") which violated the hard rule
// against fake data on the dashboard. The hardcoded array is now empty —
// real material orders should come from the Google Sheets `Orders` tab via
// google-sheets-service.ts → getOrders().

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

// Material orders are read from the Google Sheets `Orders` tab at request
// time. This array is intentionally empty — see the file header for why.
export const materialOrders: MaterialOrderRequest[] = [];

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
