// Restock Workflow Service for River City Roofing Solutions
// Workflow: Stock Arrives → Rick Verifies → Destin Approves Pricing → Sara Notified
// Last Updated: December 2025

import { inventoryProducts, updateProductStock } from './inventoryData';
import { getUserByUid, getUsersByRole } from './portalUsers';

export type RestockStatus =
  | 'pending_arrival'
  | 'arrived'
  | 'verification_in_progress'
  | 'verified'
  | 'pricing_review'
  | 'approved'
  | 'completed'
  | 'rejected';

export interface RestockItem {
  productId: string;
  productName: string;
  expectedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  unitPrice: number;
  totalCost: number;
  verified: boolean;
  discrepancyNotes?: string;
}

export interface RestockPhoto {
  photoId: string;
  url: string;
  type: 'delivery_truck' | 'pallet' | 'item_closeup' | 'damage' | 'receipt';
  caption?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface RestockTicket {
  ticketId: string;
  status: RestockStatus;
  createdAt: string;
  updatedAt: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderNumber?: string;
  invoiceNumber?: string;
  items: RestockItem[];
  totalExpectedCost: number;
  totalReceivedCost: number;
  arrivedAt?: string;
  verificationStartedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  pricingReviewStartedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  pricingNotes?: string;
  completedAt?: string;
  notifiedSaraAt?: string;
  photos: RestockPhoto[];
  notes?: string;
  rejectionReason?: string;
  activityLog: RestockActivity[];
}

export interface RestockActivity {
  activityId: string;
  timestamp: string;
  action: string;
  performedBy: string;
  performedByName: string;
  details?: string;
}

export interface RestockNotification {
  notificationId: string;
  ticketId: string;
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  type: 'arrival' | 'verification_needed' | 'pricing_review' | 'approved' | 'completed' | 'weekly_reminder';
  title: string;
  message: string;
  sentAt: string;
  readAt?: string;
  priority: 'normal' | 'high' | 'urgent';
}

// Key Personnel IDs
const RICK_USER_ID = 'RVR-136';
const DESTIN_USER_ID = 'RVR-132';
const SARA_USER_ID = 'RVR-131';
const TAE_USER_ID = 'a8ad2e33';

const SUPPLIERS = [
  { id: 'vendor-001', name: 'ABC Supply', contactName: 'Regional Rep', phone: '256-555-0001' },
  { id: 'vendor-002', name: 'Beacon Roofing Supply', contactName: 'Sales Team', phone: '256-555-0002' },
  { id: 'vendor-003', name: 'Gulf Eagle Supply', contactName: 'Account Manager', phone: '256-555-0003' },
  { id: 'vendor-004', name: 'Littrell Lumber Mill', contactName: 'Operations', phone: '256-555-0004' },
  { id: 'vendor-005', name: 'Majestic Metals', contactName: 'Sales', phone: '256-555-0005' },
  { id: 'vendor-006', name: 'Advanced Building Products', contactName: 'Customer Service', phone: '256-555-0006' }
];

let restockTickets: RestockTicket[] = [];
let restockNotifications: RestockNotification[] = [];

function generateId(prefix: string): string {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

export function createRestockTicket(
  supplierId: string,
  items: Array<{ productId: string; expectedQuantity: number; unitCost: number }>,
  purchaseOrderNumber?: string
): RestockTicket {
  const supplier = SUPPLIERS.find(s => s.id === supplierId);

  const restockItems: RestockItem[] = items.map(item => {
    const product = inventoryProducts.find(p => p.productId === item.productId);
    return {
      productId: item.productId,
      productName: product?.productName || 'Unknown Product',
      expectedQuantity: item.expectedQuantity,
      receivedQuantity: 0,
      unitCost: item.unitCost,
      unitPrice: product?.price || item.unitCost * 1.35,
      totalCost: item.expectedQuantity * item.unitCost,
      verified: false
    };
  });

  const totalExpectedCost = restockItems.reduce((sum, item) => sum + item.totalCost, 0);

  const ticket: RestockTicket = {
    ticketId: generateId('RST'),
    status: 'pending_arrival',
    createdAt: now(),
    updatedAt: now(),
    supplierId,
    supplierName: supplier?.name || 'Unknown Supplier',
    purchaseOrderNumber,
    items: restockItems,
    totalExpectedCost,
    totalReceivedCost: 0,
    photos: [],
    activityLog: [{
      activityId: generateId('ACT'),
      timestamp: now(),
      action: 'Restock ticket created',
      performedBy: 'SYSTEM',
      performedByName: 'System',
      details: 'Expected ' + items.length + ' items totaling $' + totalExpectedCost.toFixed(2)
    }]
  };

  restockTickets.push(ticket);
  return ticket;
}

export function markStockArrived(ticketId: string): RestockTicket | null {
  const ticket = restockTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  ticket.status = 'arrived';
  ticket.arrivedAt = now();
  ticket.updatedAt = now();

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Stock arrived at warehouse',
    performedBy: 'SYSTEM',
    performedByName: 'System'
  });

  notifyRickOfArrival(ticket);
  return ticket;
}

function notifyRickOfArrival(ticket: RestockTicket): void {
  const rick = getUserByUid(RICK_USER_ID);
  if (!rick) return;

  const notification: RestockNotification = {
    notificationId: generateId('NOT'),
    ticketId: ticket.ticketId,
    recipientId: RICK_USER_ID,
    recipientName: rick.userName,
    recipientEmail: rick.email,
    type: 'arrival',
    title: 'Stock Arrived - Verification Needed',
    message: 'Shipment from ' + ticket.supplierName + ' has arrived. ' + ticket.items.length + ' items totaling $' + ticket.totalExpectedCost.toFixed(2) + ' need verification. PO: ' + (ticket.purchaseOrderNumber || 'N/A'),
    sentAt: now(),
    priority: 'high'
  };

  restockNotifications.push(notification);

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Notification sent to Rick for verification',
    performedBy: 'SYSTEM',
    performedByName: 'System',
    details: 'Email: ' + rick.email
  });
}

export function startVerification(ticketId: string, userId: string): RestockTicket | null {
  const ticket = restockTickets.find(t => t.ticketId === ticketId);
  if (!ticket || ticket.status !== 'arrived') return null;

  const user = getUserByUid(userId);

  ticket.status = 'verification_in_progress';
  ticket.verificationStartedAt = now();
  ticket.updatedAt = now();

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Verification started',
    performedBy: userId,
    performedByName: user?.userName || 'Unknown'
  });

  return ticket;
}

export function addVerificationPhoto(
  ticketId: string,
  photoUrl: string,
  photoType: RestockPhoto['type'],
  caption: string,
  uploadedBy: string
): RestockTicket | null {
  const ticket = restockTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  const user = getUserByUid(uploadedBy);

  const photo: RestockPhoto = {
    photoId: generateId('PHO'),
    url: photoUrl,
    type: photoType,
    caption,
    uploadedBy,
    uploadedAt: now()
  };

  ticket.photos.push(photo);
  ticket.updatedAt = now();

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Photo uploaded: ' + photoType,
    performedBy: uploadedBy,
    performedByName: user?.userName || 'Unknown',
    details: caption
  });

  return ticket;
}

export function verifyItem(
  ticketId: string,
  productId: string,
  receivedQuantity: number,
  verifiedBy: string,
  discrepancyNotes?: string
): RestockTicket | null {
  const ticket = restockTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  const item = ticket.items.find(i => i.productId === productId);
  if (!item) return null;

  const user = getUserByUid(verifiedBy);

  item.receivedQuantity = receivedQuantity;
  item.verified = true;
  item.discrepancyNotes = discrepancyNotes;
  item.totalCost = receivedQuantity * item.unitCost;

  ticket.updatedAt = now();

  const status = receivedQuantity === item.expectedQuantity
    ? 'matches expected'
    : 'discrepancy: expected ' + item.expectedQuantity + ', received ' + receivedQuantity;

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Item verified: ' + item.productName,
    performedBy: verifiedBy,
    performedByName: user?.userName || 'Unknown',
    details: status + (discrepancyNotes ? ' - Note: ' + discrepancyNotes : '')
  });

  return ticket;
}

export function submitVerification(ticketId: string, verifiedBy: string, notes?: string): RestockTicket | null {
  const ticket = restockTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  const allVerified = ticket.items.every(item => item.verified);
  if (!allVerified) {
    console.error('Cannot submit: Not all items have been verified');
    return null;
  }

  const hasDeliveryPhoto = ticket.photos.some(p => p.type === 'delivery_truck' || p.type === 'pallet');
  const hasItemPhoto = ticket.photos.some(p => p.type === 'item_closeup' || p.type === 'receipt');

  if (!hasDeliveryPhoto || !hasItemPhoto) {
    console.error('Cannot submit: Missing required photos');
    return null;
  }

  const user = getUserByUid(verifiedBy);

  ticket.status = 'verified';
  ticket.verifiedAt = now();
  ticket.verifiedBy = verifiedBy;
  ticket.verifiedByName = user?.userName || 'Unknown';
  ticket.notes = notes;
  ticket.totalReceivedCost = ticket.items.reduce((sum, item) => sum + item.totalCost, 0);
  ticket.updatedAt = now();

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Verification submitted',
    performedBy: verifiedBy,
    performedByName: user?.userName || 'Unknown',
    details: 'Total received: $' + ticket.totalReceivedCost.toFixed(2) + (notes ? ' - Notes: ' + notes : '')
  });

  notifyDestinForPricing(ticket);
  return ticket;
}

function notifyDestinForPricing(ticket: RestockTicket): void {
  const destin = getUserByUid(DESTIN_USER_ID);
  if (!destin) return;

  ticket.status = 'pricing_review';
  ticket.pricingReviewStartedAt = now();
  ticket.updatedAt = now();

  const hasDiscrepancies = ticket.items.some(item => item.receivedQuantity !== item.expectedQuantity);

  const notification: RestockNotification = {
    notificationId: generateId('NOT'),
    ticketId: ticket.ticketId,
    recipientId: DESTIN_USER_ID,
    recipientName: destin.userName,
    recipientEmail: destin.email,
    type: 'pricing_review',
    title: hasDiscrepancies ? 'Pricing Review Needed - DISCREPANCIES FOUND' : 'Pricing Review Needed',
    message: 'Restock from ' + ticket.supplierName + ' verified by ' + ticket.verifiedByName + '. Total: $' + ticket.totalReceivedCost.toFixed(2) + '. ' + ticket.items.length + ' items need pricing confirmation.' + (hasDiscrepancies ? ' WARNING: Quantity discrepancies detected.' : ''),
    sentAt: now(),
    priority: hasDiscrepancies ? 'urgent' : 'high'
  };

  restockNotifications.push(notification);

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Notification sent to Destin for pricing review',
    performedBy: 'SYSTEM',
    performedByName: 'System',
    details: 'Email: ' + destin.email
  });
}

export function updateItemPricing(
  ticketId: string,
  productId: string,
  newUnitCost: number,
  newUnitPrice: number,
  updatedBy: string
): RestockTicket | null {
  const ticket = restockTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  const item = ticket.items.find(i => i.productId === productId);
  if (!item) return null;

  const user = getUserByUid(updatedBy);
  const oldCost = item.unitCost;
  const oldPrice = item.unitPrice;

  item.unitCost = newUnitCost;
  item.unitPrice = newUnitPrice;
  item.totalCost = item.receivedQuantity * newUnitCost;

  ticket.totalReceivedCost = ticket.items.reduce((sum, i) => sum + i.totalCost, 0);
  ticket.updatedAt = now();

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Pricing updated: ' + item.productName,
    performedBy: updatedBy,
    performedByName: user?.userName || 'Unknown',
    details: 'Cost: $' + oldCost.toFixed(2) + ' -> $' + newUnitCost.toFixed(2) + ', Price: $' + oldPrice.toFixed(2) + ' -> $' + newUnitPrice.toFixed(2)
  });

  return ticket;
}

export function approvePricing(ticketId: string, approvedBy: string, pricingNotes?: string): RestockTicket | null {
  const ticket = restockTickets.find(t => t.ticketId === ticketId);
  if (!ticket || ticket.status !== 'pricing_review') return null;

  const user = getUserByUid(approvedBy);

  ticket.status = 'approved';
  ticket.approvedAt = now();
  ticket.approvedBy = approvedBy;
  ticket.approvedByName = user?.userName || 'Unknown';
  ticket.pricingNotes = pricingNotes;
  ticket.updatedAt = now();

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Pricing approved',
    performedBy: approvedBy,
    performedByName: user?.userName || 'Unknown',
    details: pricingNotes || 'No additional notes'
  });

  notifySaraAndComplete(ticket);
  return ticket;
}

export function rejectPricing(ticketId: string, rejectedBy: string, reason: string): RestockTicket | null {
  const ticket = restockTickets.find(t => t.ticketId === ticketId);
  if (!ticket || ticket.status !== 'pricing_review') return null;

  const user = getUserByUid(rejectedBy);

  ticket.status = 'rejected';
  ticket.rejectionReason = reason;
  ticket.updatedAt = now();

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Pricing rejected',
    performedBy: rejectedBy,
    performedByName: user?.userName || 'Unknown',
    details: reason
  });

  notifyRickOfRejection(ticket, reason);
  return ticket;
}

function notifyRickOfRejection(ticket: RestockTicket, reason: string): void {
  const rick = getUserByUid(RICK_USER_ID);
  if (!rick) return;

  const notification: RestockNotification = {
    notificationId: generateId('NOT'),
    ticketId: ticket.ticketId,
    recipientId: RICK_USER_ID,
    recipientName: rick.userName,
    recipientEmail: rick.email,
    type: 'verification_needed',
    title: 'Restock Rejected - Re-verification Needed',
    message: 'Restock from ' + ticket.supplierName + ' was rejected. Reason: ' + reason + '. Please review and re-submit.',
    sentAt: now(),
    priority: 'urgent'
  };

  restockNotifications.push(notification);

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Rejection notification sent to Rick',
    performedBy: 'SYSTEM',
    performedByName: 'System',
    details: reason
  });
}

function notifySaraAndComplete(ticket: RestockTicket): void {
  const sara = getUserByUid(SARA_USER_ID);
  if (!sara) return;

  ticket.status = 'completed';
  ticket.completedAt = now();
  ticket.notifiedSaraAt = now();
  ticket.updatedAt = now();

  ticket.items.forEach(item => {
    updateProductStock(item.productId, item.receivedQuantity, 'add');
  });

  const notification: RestockNotification = {
    notificationId: generateId('NOT'),
    ticketId: ticket.ticketId,
    recipientId: SARA_USER_ID,
    recipientName: sara.userName,
    recipientEmail: sara.email,
    type: 'completed',
    title: 'Restock Completed',
    message: 'Restock from ' + ticket.supplierName + ' completed. ' + ticket.items.length + ' items added to inventory. Total: $' + ticket.totalReceivedCost.toFixed(2) + '. Verified by ' + ticket.verifiedByName + ', approved by ' + ticket.approvedByName + '.',
    sentAt: now(),
    priority: 'normal'
  };

  restockNotifications.push(notification);

  ticket.activityLog.push({
    activityId: generateId('ACT'),
    timestamp: now(),
    action: 'Restock completed - Sara notified',
    performedBy: 'SYSTEM',
    performedByName: 'System',
    details: 'Inventory updated. Email: ' + sara.email
  });

  notifyAdminsOfCompletion(ticket);
}

function notifyAdminsOfCompletion(ticket: RestockTicket): void {
  const admins = getUsersByRole('ADMIN');

  admins.forEach(admin => {
    if (admin.uid === SARA_USER_ID) return;

    const notification: RestockNotification = {
      notificationId: generateId('NOT'),
      ticketId: ticket.ticketId,
      recipientId: admin.uid,
      recipientName: admin.userName,
      recipientEmail: admin.email,
      type: 'completed',
      title: 'Restock Completed',
      message: 'Restock ' + ticket.ticketId + ' from ' + ticket.supplierName + ' completed. Total: $' + ticket.totalReceivedCost.toFixed(2) + '.',
      sentAt: now(),
      priority: 'normal'
    };

    restockNotifications.push(notification);
  });
}

export function sendWeeklyInventoryReminder(): void {
  const rick = getUserByUid(RICK_USER_ID);
  const tae = getUserByUid(TAE_USER_ID);

  const lowStockItems = inventoryProducts.filter(p =>
    p.currentQty <= (p.minQty || 10)
  );

  const message = lowStockItems.length > 0
    ? 'Weekly inventory check reminder. ' + lowStockItems.length + ' items are low or need reorder: ' + lowStockItems.map(p => p.productName).join(', ')
    : 'Weekly inventory check reminder. All stock levels appear adequate.';

  if (rick) {
    const notification: RestockNotification = {
      notificationId: generateId('NOT'),
      ticketId: 'WEEKLY',
      recipientId: RICK_USER_ID,
      recipientName: rick.userName,
      recipientEmail: rick.email,
      type: 'weekly_reminder',
      title: 'Weekly Inventory Check',
      message,
      sentAt: now(),
      priority: lowStockItems.length > 0 ? 'high' : 'normal'
    };
    restockNotifications.push(notification);
  }

  if (tae) {
    const notification: RestockNotification = {
      notificationId: generateId('NOT'),
      ticketId: 'WEEKLY',
      recipientId: TAE_USER_ID,
      recipientName: tae.userName,
      recipientEmail: tae.email,
      type: 'weekly_reminder',
      title: 'Weekly Inventory Check',
      message,
      sentAt: now(),
      priority: lowStockItems.length > 0 ? 'high' : 'normal'
    };
    restockNotifications.push(notification);
  }

  if (lowStockItems.length > 0) {
    const admins = getUsersByRole('ADMIN');
    admins.forEach(admin => {
      const notification: RestockNotification = {
        notificationId: generateId('NOT'),
        ticketId: 'WEEKLY',
        recipientId: admin.uid,
        recipientName: admin.userName,
        recipientEmail: admin.email,
        type: 'weekly_reminder',
        title: 'Low Stock Alert',
        message: lowStockItems.length + ' items need reorder attention: ' + lowStockItems.map(p => p.productName + ' (' + p.currentQty + ' remaining)').join(', '),
        sentAt: now(),
        priority: 'high'
      };
      restockNotifications.push(notification);
    });
  }
}

export function getRestockTicketById(ticketId: string): RestockTicket | undefined {
  return restockTickets.find(t => t.ticketId === ticketId);
}

export function getRestockTicketsByStatus(status: RestockStatus): RestockTicket[] {
  return restockTickets.filter(t => t.status === status);
}

export function getPendingVerifications(): RestockTicket[] {
  return restockTickets.filter(t =>
    t.status === 'arrived' || t.status === 'verification_in_progress'
  );
}

export function getPendingPricingReviews(): RestockTicket[] {
  return restockTickets.filter(t => t.status === 'pricing_review');
}

export function getNotificationsByUser(userId: string): RestockNotification[] {
  return restockNotifications.filter(n => n.recipientId === userId);
}

export function getUnreadNotifications(userId: string): RestockNotification[] {
  return restockNotifications.filter(n => n.recipientId === userId && !n.readAt);
}

export function markNotificationRead(notificationId: string): void {
  const notification = restockNotifications.find(n => n.notificationId === notificationId);
  if (notification) {
    notification.readAt = now();
  }
}

export function getRestockStats() {
  return {
    total: restockTickets.length,
    pending: restockTickets.filter(t => t.status === 'pending_arrival' || t.status === 'arrived').length,
    inVerification: restockTickets.filter(t => t.status === 'verification_in_progress' || t.status === 'verified').length,
    inPricingReview: restockTickets.filter(t => t.status === 'pricing_review').length,
    completed: restockTickets.filter(t => t.status === 'completed').length,
    rejected: restockTickets.filter(t => t.status === 'rejected').length,
    totalValue: restockTickets
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.totalReceivedCost, 0)
  };
}

export function getSuppliers() {
  return SUPPLIERS;
}

export function getAllRestockTickets(): RestockTicket[] {
  return [...restockTickets].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getVerificationVoiceScript(ticket: RestockTicket): string {
  let script = 'Verification checklist for shipment from ' + ticket.supplierName + '. ';
  script += ticket.items.length + ' items to verify. ';

  ticket.items.forEach((item, index) => {
    script += 'Item ' + (index + 1) + ': ' + item.productName + '. Expected quantity: ' + item.expectedQuantity + '. ';
    if (item.verified) {
      script += 'Verified: ' + item.receivedQuantity + ' received. ';
    }
  });

  script += 'Take photos of delivery truck, pallets, and close-up of items. Confirm all quantities before submitting.';

  return script;
}
