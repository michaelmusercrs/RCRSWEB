// Return & Pickup Ticket Service for River City Roofing Solutions
// Handles material returns, job site pickups, and equipment retrieval
// Last Updated: December 2025

import { inventoryProducts, updateProductStock } from './inventoryData';
import { getUserByUid, getUsersByRole } from './portalUsers';
import { voiceService, pushNotificationService } from './voice-notification-service';

export type ReturnPickupType = 'return' | 'pickup' | 'equipment_retrieval';

export type ReturnPickupStatus =
  | 'requested'
  | 'approved'
  | 'scheduled'
  | 'assigned'
  | 'en_route'
  | 'arrived'
  | 'loading'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export type ReturnReason =
  | 'excess_material'
  | 'wrong_material'
  | 'damaged_material'
  | 'job_cancelled'
  | 'job_complete_leftover'
  | 'customer_refused'
  | 'weather_delay'
  | 'other';

export interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  condition: 'new' | 'good' | 'damaged' | 'unusable';
  originalTicketId?: string;
  returnToStock: boolean;
  restockValue?: number;
  notes?: string;
}

export interface ReturnPhoto {
  photoId: string;
  url: string;
  type: 'material_condition' | 'load_photo' | 'damage_photo' | 'signature';
  caption?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ReturnPickupTicket {
  ticketId: string;
  ticketType: ReturnPickupType;
  status: ReturnPickupStatus;
  createdAt: string;
  updatedAt: string;

  // Requester info
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;

  // Original job info
  originalJobId?: string;
  originalJobName?: string;
  originalTicketId?: string;

  // Pickup location
  pickupAddress: string;
  city: string;
  state: string;
  zip?: string;
  contactName?: string;
  contactPhone?: string;

  // Return reason
  returnReason: ReturnReason;
  reasonDetails?: string;

  // Materials
  items: ReturnItem[];
  estimatedValue: number;

  // Scheduling
  scheduledDate?: string;
  scheduledTime?: string;
  urgency: 'normal' | 'urgent' | 'flexible';

  // Assignment
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: string;

  // Approval workflow
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;

  // Completion
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
  actualItems?: ReturnItem[]; // What was actually picked up

  // Photos and notes
  photos: ReturnPhoto[];
  notes?: string;

  // Activity log
  activityLog: Array<{
    timestamp: string;
    action: string;
    performedBy: string;
    performedByName: string;
    details?: string;
  }>;
}

// In-memory storage
let returnPickupTickets: ReturnPickupTicket[] = [];

// Generate unique ID
function generateId(prefix: string): string {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

// Key personnel
const WAREHOUSE_MANAGER_ID = 'a8ad2e33'; // Tae
const MANAGER_IDS = ['RVR-132', 'RVR-133', 'RVR-134', 'RVR-137']; // Destin, Tia, Bart, John

// ============================================
// TICKET CREATION
// ============================================

export function createReturnRequest(
  requestedBy: string,
  ticketType: ReturnPickupType,
  pickupAddress: string,
  city: string,
  items: Array<{ productId: string; quantity: number; condition: ReturnItem['condition'] }>,
  returnReason: ReturnReason,
  options?: {
    originalJobId?: string;
    originalTicketId?: string;
    contactName?: string;
    contactPhone?: string;
    reasonDetails?: string;
    scheduledDate?: string;
    urgency?: 'normal' | 'urgent' | 'flexible';
    notes?: string;
  }
): ReturnPickupTicket {
  const user = getUserByUid(requestedBy);

  const returnItems: ReturnItem[] = items.map(item => {
    const product = inventoryProducts.find(p => p.productId === item.productId);
    const canRestock = item.condition === 'new' || item.condition === 'good';

    return {
      productId: item.productId,
      productName: product?.productName || 'Unknown Product',
      quantity: item.quantity,
      unit: product?.unit || 'each',
      condition: item.condition,
      returnToStock: canRestock,
      restockValue: canRestock ? (product?.cost || 0) * item.quantity : 0
    };
  });

  const estimatedValue = returnItems.reduce((sum, item) => sum + (item.restockValue || 0), 0);

  const ticket: ReturnPickupTicket = {
    ticketId: generateId(ticketType === 'return' ? 'RTN' : 'PKP'),
    ticketType,
    status: 'requested',
    createdAt: now(),
    updatedAt: now(),
    requestedBy,
    requestedByName: user?.userName || 'Unknown',
    requestedByRole: user?.role || 'USER',
    originalJobId: options?.originalJobId,
    originalJobName: options?.originalJobId ? 'Job ' + options.originalJobId : undefined,
    originalTicketId: options?.originalTicketId,
    pickupAddress,
    city,
    state: 'AL',
    contactName: options?.contactName,
    contactPhone: options?.contactPhone,
    returnReason,
    reasonDetails: options?.reasonDetails,
    items: returnItems,
    estimatedValue,
    scheduledDate: options?.scheduledDate,
    urgency: options?.urgency || 'normal',
    notes: options?.notes,
    photos: [],
    activityLog: [{
      timestamp: now(),
      action: ticketType === 'return' ? 'Return request created' : 'Pickup request created',
      performedBy: requestedBy,
      performedByName: user?.userName || 'Unknown',
      details: returnItems.length + ' items, estimated value: $' + estimatedValue.toFixed(2)
    }]
  };

  returnPickupTickets.push(ticket);

  // Notify warehouse manager
  notifyWarehouseOfRequest(ticket);

  return ticket;
}

// ============================================
// NOTIFICATIONS
// ============================================

function notifyWarehouseOfRequest(ticket: ReturnPickupTicket): void {
  const tae = getUserByUid(WAREHOUSE_MANAGER_ID);
  if (!tae) return;

  const typeLabel = ticket.ticketType === 'return' ? 'Return' : 'Pickup';

  pushNotificationService.notify(
    'New ' + typeLabel + ' Request',
    typeLabel + ' from ' + ticket.city + '. ' + ticket.items.length + ' items. Reason: ' + formatReason(ticket.returnReason),
    { priority: ticket.urgency === 'urgent' ? 'urgent' : 'normal' }
  );

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Warehouse notified',
    performedBy: 'SYSTEM',
    performedByName: 'System',
    details: 'Sent to: ' + tae.email
  });
}

function formatReason(reason: ReturnReason): string {
  const labels: Record<ReturnReason, string> = {
    'excess_material': 'Excess Material',
    'wrong_material': 'Wrong Material',
    'damaged_material': 'Damaged Material',
    'job_cancelled': 'Job Cancelled',
    'job_complete_leftover': 'Job Complete Leftover',
    'customer_refused': 'Customer Refused',
    'weather_delay': 'Weather Delay',
    'other': 'Other'
  };
  return labels[reason] || reason;
}

// ============================================
// APPROVAL WORKFLOW
// ============================================

export function approveRequest(ticketId: string, approvedBy: string): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket || ticket.status !== 'requested') return null;

  const user = getUserByUid(approvedBy);

  ticket.status = 'approved';
  ticket.approvedBy = approvedBy;
  ticket.approvedByName = user?.userName || 'Unknown';
  ticket.approvedAt = now();
  ticket.updatedAt = now();

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Request approved',
    performedBy: approvedBy,
    performedByName: user?.userName || 'Unknown'
  });

  // Notify requester
  const requester = getUserByUid(ticket.requestedBy);
  if (requester) {
    pushNotificationService.notify(
      'Request Approved',
      'Your ' + ticket.ticketType + ' request ' + ticket.ticketId + ' has been approved.',
      { priority: 'normal' }
    );
  }

  return ticket;
}

export function rejectRequest(ticketId: string, rejectedBy: string, reason: string): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket || ticket.status !== 'requested') return null;

  const user = getUserByUid(rejectedBy);

  ticket.status = 'rejected';
  ticket.rejectedBy = rejectedBy;
  ticket.rejectedReason = reason;
  ticket.updatedAt = now();

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Request rejected',
    performedBy: rejectedBy,
    performedByName: user?.userName || 'Unknown',
    details: reason
  });

  return ticket;
}

// ============================================
// SCHEDULING & ASSIGNMENT
// ============================================

export function schedulePickup(
  ticketId: string,
  scheduledDate: string,
  scheduledTime: string,
  scheduledBy: string
): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket || (ticket.status !== 'approved' && ticket.status !== 'requested')) return null;

  const user = getUserByUid(scheduledBy);

  ticket.status = 'scheduled';
  ticket.scheduledDate = scheduledDate;
  ticket.scheduledTime = scheduledTime;
  ticket.updatedAt = now();

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Pickup scheduled',
    performedBy: scheduledBy,
    performedByName: user?.userName || 'Unknown',
    details: 'Date: ' + scheduledDate + ' at ' + scheduledTime
  });

  return ticket;
}

export function assignDriver(
  ticketId: string,
  driverId: string,
  assignedBy: string
): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  const driver = getUserByUid(driverId);
  const assigner = getUserByUid(assignedBy);

  ticket.status = 'assigned';
  ticket.assignedTo = driverId;
  ticket.assignedToName = driver?.userName || 'Unknown';
  ticket.assignedAt = now();
  ticket.updatedAt = now();

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Driver assigned',
    performedBy: assignedBy,
    performedByName: assigner?.userName || 'Unknown',
    details: 'Assigned to: ' + (driver?.userName || driverId)
  });

  // Notify driver
  if (driver) {
    const typeLabel = ticket.ticketType === 'return' ? 'Return' : 'Pickup';
    pushNotificationService.notify(
      typeLabel + ' Assigned',
      typeLabel + ' at ' + ticket.city + '. ' + ticket.items.length + ' items. ' +
      (ticket.scheduledDate ? 'Scheduled: ' + ticket.scheduledDate : 'Schedule TBD'),
      { priority: 'urgent' }
    );

    voiceService.speak(
      'New ' + typeLabel.toLowerCase() + ' assigned. ' +
      'Location: ' + ticket.pickupAddress + ', ' + ticket.city + '. ' +
      ticket.items.length + ' items to pick up.',
      'urgent'
    );
  }

  return ticket;
}

// ============================================
// STATUS UPDATES
// ============================================

export function markEnRoute(ticketId: string, driverId: string): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket || ticket.status !== 'assigned') return null;

  const driver = getUserByUid(driverId);

  ticket.status = 'en_route';
  ticket.updatedAt = now();

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Driver en route',
    performedBy: driverId,
    performedByName: driver?.userName || 'Unknown'
  });

  return ticket;
}

export function markArrived(ticketId: string, driverId: string): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket || ticket.status !== 'en_route') return null;

  const driver = getUserByUid(driverId);

  ticket.status = 'arrived';
  ticket.updatedAt = now();

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Arrived at location',
    performedBy: driverId,
    performedByName: driver?.userName || 'Unknown'
  });

  voiceService.speak(
    'Arrived at pickup location. ' +
    (ticket.contactName ? 'Contact: ' + ticket.contactName + '. ' : '') +
    ticket.items.length + ' items to load. Verify condition of each item.'
  );

  return ticket;
}

export function startLoading(ticketId: string, driverId: string): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket || ticket.status !== 'arrived') return null;

  const driver = getUserByUid(driverId);

  ticket.status = 'loading';
  ticket.updatedAt = now();

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Loading started',
    performedBy: driverId,
    performedByName: driver?.userName || 'Unknown'
  });

  return ticket;
}

// ============================================
// VERIFICATION & COMPLETION
// ============================================

export function verifyItem(
  ticketId: string,
  productId: string,
  actualQuantity: number,
  actualCondition: ReturnItem['condition'],
  verifiedBy: string,
  notes?: string
): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  // Initialize actualItems if needed
  if (!ticket.actualItems) {
    ticket.actualItems = [];
  }

  const expectedItem = ticket.items.find(i => i.productId === productId);
  if (!expectedItem) return null;

  const user = getUserByUid(verifiedBy);
  const product = inventoryProducts.find(p => p.productId === productId);

  const canRestock = actualCondition === 'new' || actualCondition === 'good';

  const actualItem: ReturnItem = {
    productId,
    productName: product?.productName || expectedItem.productName,
    quantity: actualQuantity,
    unit: product?.unit || expectedItem.unit,
    condition: actualCondition,
    returnToStock: canRestock,
    restockValue: canRestock ? (product?.cost || 0) * actualQuantity : 0,
    notes
  };

  // Update or add to actualItems
  const existingIndex = ticket.actualItems.findIndex(i => i.productId === productId);
  if (existingIndex >= 0) {
    ticket.actualItems[existingIndex] = actualItem;
  } else {
    ticket.actualItems.push(actualItem);
  }

  ticket.updatedAt = now();

  const discrepancy = actualQuantity !== expectedItem.quantity || actualCondition !== expectedItem.condition;

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Item verified: ' + actualItem.productName,
    performedBy: verifiedBy,
    performedByName: user?.userName || 'Unknown',
    details: 'Qty: ' + actualQuantity + ', Condition: ' + actualCondition +
      (discrepancy ? ' (DISCREPANCY)' : '') +
      (notes ? ', Notes: ' + notes : '')
  });

  return ticket;
}

export function addPhoto(
  ticketId: string,
  photoUrl: string,
  photoType: ReturnPhoto['type'],
  caption: string,
  uploadedBy: string
): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  const user = getUserByUid(uploadedBy);

  const photo: ReturnPhoto = {
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
    timestamp: now(),
    action: 'Photo uploaded: ' + photoType,
    performedBy: uploadedBy,
    performedByName: user?.userName || 'Unknown',
    details: caption
  });

  return ticket;
}

export function completePickup(
  ticketId: string,
  completedBy: string,
  notes?: string
): ReturnPickupTicket | null {
  const ticket = returnPickupTickets.find(t => t.ticketId === ticketId);
  if (!ticket) return null;

  const user = getUserByUid(completedBy);

  // Check all items verified
  if (!ticket.actualItems || ticket.actualItems.length === 0) {
    console.error('Cannot complete: No items have been verified');
    return null;
  }

  // Check photos taken
  const hasLoadPhoto = ticket.photos.some(p => p.type === 'load_photo' || p.type === 'material_condition');
  if (!hasLoadPhoto) {
    console.error('Cannot complete: Missing required photos');
    return null;
  }

  ticket.status = 'completed';
  ticket.completedAt = now();
  ticket.completedBy = completedBy;
  ticket.completedByName = user?.userName || 'Unknown';
  ticket.notes = notes ? (ticket.notes ? ticket.notes + '\n' + notes : notes) : ticket.notes;
  ticket.updatedAt = now();

  // Update inventory for restockable items
  let restockedValue = 0;
  ticket.actualItems.forEach(item => {
    if (item.returnToStock && item.quantity > 0) {
      updateProductStock(item.productId, item.quantity, 'add');
      restockedValue += item.restockValue || 0;
    }
  });

  ticket.activityLog.push({
    timestamp: now(),
    action: 'Pickup completed',
    performedBy: completedBy,
    performedByName: user?.userName || 'Unknown',
    details: 'Items returned to stock: $' + restockedValue.toFixed(2) + ' value'
  });

  // Notify warehouse
  pushNotificationService.notify(
    'Pickup Completed',
    'Ticket ' + ticket.ticketId + ' completed. ' +
    (ticket.actualItems?.length || 0) + ' items returned. Value: $' + restockedValue.toFixed(2),
    { priority: 'normal' }
  );

  voiceService.speak('Pickup complete. Return to warehouse.');

  return ticket;
}

// ============================================
// QUERIES
// ============================================

export function getReturnPickupById(ticketId: string): ReturnPickupTicket | undefined {
  return returnPickupTickets.find(t => t.ticketId === ticketId);
}

export function getPendingRequests(): ReturnPickupTicket[] {
  return returnPickupTickets.filter(t => t.status === 'requested');
}

export function getScheduledPickups(): ReturnPickupTicket[] {
  return returnPickupTickets.filter(t =>
    t.status === 'approved' || t.status === 'scheduled' || t.status === 'assigned'
  );
}

export function getDriverPickups(driverId: string): ReturnPickupTicket[] {
  return returnPickupTickets.filter(t =>
    t.assignedTo === driverId &&
    t.status !== 'completed' &&
    t.status !== 'cancelled'
  );
}

export function getCompletedPickups(startDate?: string, endDate?: string): ReturnPickupTicket[] {
  let completed = returnPickupTickets.filter(t => t.status === 'completed');

  if (startDate) {
    completed = completed.filter(t => t.completedAt && t.completedAt >= startDate);
  }
  if (endDate) {
    completed = completed.filter(t => t.completedAt && t.completedAt <= endDate);
  }

  return completed;
}

export function getReturnPickupStats(): {
  pending: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  totalReturnedValue: number;
} {
  const completed = returnPickupTickets.filter(t => t.status === 'completed');
  const totalValue = completed.reduce((sum, t) => {
    const itemValue = (t.actualItems || []).reduce((s, i) => s + (i.restockValue || 0), 0);
    return sum + itemValue;
  }, 0);

  return {
    pending: returnPickupTickets.filter(t => t.status === 'requested').length,
    scheduled: returnPickupTickets.filter(t => t.status === 'scheduled' || t.status === 'assigned').length,
    inProgress: returnPickupTickets.filter(t =>
      t.status === 'en_route' || t.status === 'arrived' || t.status === 'loading'
    ).length,
    completed: completed.length,
    totalReturnedValue: Math.round(totalValue * 100) / 100
  };
}

// ============================================
// VOICE SCRIPTS
// ============================================

export function getPickupVoiceScript(ticket: ReturnPickupTicket): string {
  let script = ticket.ticketType === 'return' ? 'Return pickup' : 'Pickup';
  script += ' at ' + ticket.pickupAddress + ', ' + ticket.city + '. ';
  script += ticket.items.length + ' items to pick up. ';

  ticket.items.forEach((item, index) => {
    script += 'Item ' + (index + 1) + ': ' + item.quantity + ' ' + item.productName;
    script += ', condition: ' + item.condition + '. ';
  });

  script += 'Verify condition of each item. Take photos before loading.';

  return script;
}

// Export all tickets
export function getAllReturnPickups(): ReturnPickupTicket[] {
  return [...returnPickupTickets].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
