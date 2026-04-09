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

// Job and restock tickets are loaded from real sources at runtime. The
// hardcoded sample arrays below are intentionally empty per the no-fake-data
// rule. Previously these contained "Robert Johnson", "Smith Properties LLC",
// "Sarah Williams" placeholders which were leaking into the dashboard.
export const jobTickets: Ticket[] = [];
export const restockTickets: Ticket[] = [];

// All tickets combined — pulls from real generated tickets only
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
