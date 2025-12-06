// Tickets Data - Historical delivery and restock tickets from PDF transactions
// Last Updated: December 2025

import { inventoryTransactions } from './inventoryTransactions';
import { inventoryProducts } from './inventoryData';

export type TicketType = 'delivery' | 'pickup' | 'return' | 'restock' | 'adjustment';

export type TicketStatus =
  | 'created'
  | 'assigned'
  | 'materials_pulled'
  | 'load_verified'
  | 'en_route'
  | 'arrived'
  | 'delivered'
  | 'picked_up'
  | 'completed'
  | 'cancelled';

export interface TicketMaterial {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  totalPrice: number;
}

export interface Ticket {
  ticketId: string;
  ticketType: TicketType;
  status: TicketStatus;
  createdAt: string;
  completedAt?: string;
  createdBy: string;
  createdByName: string;
  assignedTo?: string;
  assignedToName?: string;

  // Job Info (for deliveries)
  jobId?: string;
  jobName?: string;
  jobAddress?: string;
  city?: string;
  state?: string;

  // Customer Info
  customerName?: string;
  customerPhone?: string;

  // Materials
  materials: TicketMaterial[];
  totalCost: number;
  totalPrice: number;

  // Notes
  notes?: string;

  // Source transaction
  sourceTransactionId?: string;
}

// Generate tickets from historical transactions
function generateTicketsFromTransactions(): Ticket[] {
  const tickets: Ticket[] = [];

  // Group transactions by reference number to create tickets
  const transactionsByRef = new Map<string, typeof inventoryTransactions>();

  inventoryTransactions.forEach(transaction => {
    const ref = transaction.referenceNumber;
    if (!transactionsByRef.has(ref)) {
      transactionsByRef.set(ref, []);
    }
    transactionsByRef.get(ref)!.push(transaction);
  });

  transactionsByRef.forEach((transactions, refNumber) => {
    const firstTransaction = transactions[0];
    const materials: TicketMaterial[] = [];
    let totalCost = 0;
    let totalPrice = 0;

    transactions.forEach(transaction => {
      const product = inventoryProducts.find(p => p.productId === transaction.itemId);
      if (!product) return;

      const qty = Math.abs(transaction.amount);
      const material: TicketMaterial = {
        productId: transaction.itemId,
        productName: product.productName,
        quantity: qty,
        unitCost: transaction.cost,
        unitPrice: transaction.price,
        totalCost: transaction.cost * qty,
        totalPrice: transaction.price * qty
      };

      materials.push(material);
      totalCost += material.totalCost;
      totalPrice += material.totalPrice;
    });

    if (materials.length === 0) return;

    let ticketType: TicketType;
    switch (firstTransaction.type) {
      case 'delivery':
        ticketType = 'delivery';
        break;
      case 'restock':
        ticketType = 'restock';
        break;
      case 'return':
        ticketType = 'return';
        break;
      case 'adjustment':
        ticketType = 'adjustment';
        break;
      default:
        ticketType = 'delivery';
    }

    const ticket: Ticket = {
      ticketId: `TKT-${refNumber}`,
      ticketType,
      status: 'completed',
      createdAt: firstTransaction.dateTime,
      completedAt: firstTransaction.dateTime,
      createdBy: ticketType === 'restock' ? 'a8ad2e33' : 'RVR-134',
      createdByName: ticketType === 'restock' ? 'Tae Orr' : 'Bart Roberts',
      assignedTo: ticketType === 'delivery' ? 'RVR-136' : undefined,
      assignedToName: ticketType === 'delivery' ? 'Richard Geahr' : undefined,
      jobId: refNumber.startsWith('D-') ? `JOB-${refNumber}` : refNumber.startsWith('R-') ? `RESTOCK-${refNumber}` : undefined,
      jobName: ticketType === 'delivery' ? `Delivery ${refNumber}` : ticketType === 'restock' ? `Restock ${refNumber}` : `Transaction ${refNumber}`,
      city: 'Huntsville',
      state: 'AL',
      materials,
      totalCost: Math.round(totalCost * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      notes: firstTransaction.notes,
      sourceTransactionId: firstTransaction.inventoryId
    };

    tickets.push(ticket);
  });

  return tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Pre-generated tickets from transactions
export const tickets: Ticket[] = generateTicketsFromTransactions();

// Sample job tickets (specific completed jobs)
export const jobTickets: Ticket[] = [
  {
    ticketId: 'TKT-JOB-001',
    ticketType: 'delivery',
    status: 'completed',
    createdAt: '2025-11-28T08:00:00Z',
    completedAt: '2025-11-28T14:30:00Z',
    createdBy: 'RVR-134',
    createdByName: 'Bart Roberts',
    assignedTo: 'RVR-136',
    assignedToName: 'Richard Geahr',
    jobId: 'JOB-2024-1230',
    jobName: 'Johnson Residence Roof',
    jobAddress: '123 Oak Street',
    city: 'Huntsville',
    state: 'AL',
    customerName: 'Robert Johnson',
    customerPhone: '256-555-0101',
    materials: [
      { productId: 'item-125', productName: 'RCRS Syn Felt', quantity: 10, unitCost: 66.00, unitPrice: 79.86, totalCost: 660.00, totalPrice: 798.60 },
      { productId: 'item-126', productName: 'Ice & Water Shield', quantity: 5, unitCost: 62.70, unitPrice: 114.22, totalCost: 313.50, totalPrice: 571.10 },
      { productId: 'item-123', productName: '1 1/4 EG Nails', quantity: 3, unitCost: 27.50, unitPrice: 64.90, totalCost: 82.50, totalPrice: 194.70 }
    ],
    totalCost: 1056.00,
    totalPrice: 1564.40,
    notes: 'Full roof replacement - 30 squares'
  },
  {
    ticketId: 'TKT-JOB-002',
    ticketType: 'delivery',
    status: 'completed',
    createdAt: '2025-11-25T07:30:00Z',
    completedAt: '2025-11-25T12:00:00Z',
    createdBy: 'RVR-137',
    createdByName: 'John Cordonis',
    assignedTo: 'a8ad2e33',
    assignedToName: 'Tae Orr',
    jobId: 'JOB-2024-1228',
    jobName: 'Smith Commercial Building',
    jobAddress: '456 Industrial Blvd',
    city: 'Decatur',
    state: 'AL',
    customerName: 'Smith Properties LLC',
    customerPhone: '256-555-0102',
    materials: [
      { productId: 'item-127', productName: 'Ridge Vent 4LF', quantity: 50, unitCost: 7.15, unitPrice: 10.20, totalCost: 357.50, totalPrice: 510.00 },
      { productId: 'item-130', productName: 'Sealant', quantity: 20, unitCost: 9.35, unitPrice: 10.00, totalCost: 187.00, totalPrice: 200.00 }
    ],
    totalCost: 544.50,
    totalPrice: 710.00,
    notes: 'Commercial repair - ridge vent replacement'
  },
  {
    ticketId: 'TKT-JOB-003',
    ticketType: 'delivery',
    status: 'completed',
    createdAt: '2025-11-20T09:00:00Z',
    completedAt: '2025-11-20T15:45:00Z',
    createdBy: 'RVR-134',
    createdByName: 'Bart Roberts',
    assignedTo: 'RVR-136',
    assignedToName: 'Richard Geahr',
    jobId: 'JOB-2024-1225',
    jobName: 'Williams Residence',
    jobAddress: '789 Maple Lane',
    city: 'Madison',
    state: 'AL',
    customerName: 'Sarah Williams',
    customerPhone: '256-555-0103',
    materials: [
      { productId: 'item-128', productName: 'Bullet Boot 1.5"', quantity: 10, unitCost: 7.50, unitPrice: 9.00, totalCost: 75.00, totalPrice: 90.00 },
      { productId: 'item-129', productName: 'Bullet Boot 4"', quantity: 8, unitCost: 16.50, unitPrice: 21.00, totalCost: 132.00, totalPrice: 168.00 },
      { productId: 'item-131', productName: 'Zipper Boot', quantity: 4, unitCost: 37.40, unitPrice: 48.00, totalCost: 149.60, totalPrice: 192.00 }
    ],
    totalCost: 356.60,
    totalPrice: 450.00,
    notes: 'Pipe boot replacement and flashing repair'
  }
];

// Restock tickets
export const restockTickets: Ticket[] = [
  {
    ticketId: 'TKT-RST-001',
    ticketType: 'restock',
    status: 'completed',
    createdAt: '2025-12-01T06:00:00Z',
    completedAt: '2025-12-01T08:30:00Z',
    createdBy: 'a8ad2e33',
    createdByName: 'Tae Orr',
    jobId: 'RESTOCK-2025-12-001',
    jobName: 'Weekly Restock - ABC Supply',
    materials: [
      { productId: 'item-123', productName: '1 1/4 EG Nails', quantity: 50, unitCost: 27.50, unitPrice: 64.90, totalCost: 1375.00, totalPrice: 3245.00 },
      { productId: 'item-125', productName: 'RCRS Syn Felt', quantity: 30, unitCost: 66.00, unitPrice: 79.86, totalCost: 1980.00, totalPrice: 2395.80 }
    ],
    totalCost: 3355.00,
    totalPrice: 5640.80,
    notes: 'Regular weekly restock from ABC Supply'
  },
  {
    ticketId: 'TKT-RST-002',
    ticketType: 'restock',
    status: 'completed',
    createdAt: '2025-11-24T06:30:00Z',
    completedAt: '2025-11-24T09:00:00Z',
    createdBy: 'a8ad2e33',
    createdByName: 'Tae Orr',
    jobId: 'RESTOCK-2025-11-002',
    jobName: 'Emergency Restock - Ice & Water',
    materials: [
      { productId: 'item-126', productName: 'Ice & Water Shield', quantity: 25, unitCost: 62.70, unitPrice: 114.22, totalCost: 1567.50, totalPrice: 2855.50 }
    ],
    totalCost: 1567.50,
    totalPrice: 2855.50,
    notes: 'Emergency restock - low stock alert'
  },
  {
    ticketId: 'TKT-RST-003',
    ticketType: 'restock',
    status: 'completed',
    createdAt: '2025-11-17T07:00:00Z',
    completedAt: '2025-11-17T10:30:00Z',
    createdBy: 'a8ad2e33',
    createdByName: 'Tae Orr',
    jobId: 'RESTOCK-2025-11-001',
    jobName: 'Monthly Restock - Gulf Eagle',
    materials: [
      { productId: 'item-127', productName: 'Ridge Vent 4LF', quantity: 200, unitCost: 7.15, unitPrice: 10.20, totalCost: 1430.00, totalPrice: 2040.00 },
      { productId: 'item-128', productName: 'Bullet Boot 1.5"', quantity: 100, unitCost: 7.50, unitPrice: 9.00, totalCost: 750.00, totalPrice: 900.00 },
      { productId: 'item-129', productName: 'Bullet Boot 4"', quantity: 80, unitCost: 16.50, unitPrice: 21.00, totalCost: 1320.00, totalPrice: 1680.00 }
    ],
    totalCost: 3500.00,
    totalPrice: 4620.00,
    notes: 'Monthly restock from Gulf Eagle Supply'
  }
];

// All tickets combined
export const allTickets: Ticket[] = [...jobTickets, ...restockTickets, ...tickets.slice(0, 50)];

// Helper functions
export function getTicketById(ticketId: string): Ticket | undefined {
  return allTickets.find(t => t.ticketId === ticketId);
}

export function getTicketsByType(type: TicketType): Ticket[] {
  return allTickets.filter(t => t.ticketType === type);
}

export function getTicketsByStatus(status: TicketStatus): Ticket[] {
  return allTickets.filter(t => t.status === status);
}

export function getTicketsByJob(jobId: string): Ticket[] {
  return allTickets.filter(t => t.jobId === jobId);
}

export function getTicketsByDriver(driverId: string): Ticket[] {
  return allTickets.filter(t => t.assignedTo === driverId);
}

export function getTicketsByDateRange(startDate: string, endDate: string): Ticket[] {
  return allTickets.filter(t => {
    const ticketDate = new Date(t.createdAt);
    return ticketDate >= new Date(startDate) && ticketDate <= new Date(endDate);
  });
}

export function getRecentTickets(limit: number = 20): Ticket[] {
  return allTickets.slice(0, limit);
}

export function getCompletedTickets(): Ticket[] {
  return allTickets.filter(t => t.status === 'completed');
}

export function getTicketStats() {
  const deliveryTickets = getTicketsByType('delivery');
  const restockTicketsArr = getTicketsByType('restock');
  const completedTickets = getCompletedTickets();

  const totalRevenue = completedTickets
    .filter(t => t.ticketType === 'delivery')
    .reduce((sum, t) => sum + t.totalPrice, 0);

  const totalCost = completedTickets
    .reduce((sum, t) => sum + t.totalCost, 0);

  return {
    total: allTickets.length,
    deliveries: deliveryTickets.length,
    restocks: restockTicketsArr.length,
    completed: completedTickets.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    profit: Math.round((totalRevenue - totalCost) * 100) / 100
  };
}
