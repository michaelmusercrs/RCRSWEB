import { GoogleSpreadsheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Sheet names
const SHEETS = {
  DELIVERY_TICKETS: 'Delivery Tickets',
  TICKET_PHOTOS: 'Ticket Photos',
  TICKET_CHECKLIST: 'Ticket Checklist',
  INVOICES: 'Invoices',
  INVOICE_ITEMS: 'Invoice Items',
  PRICE_SHEET: 'Price Sheet',
  JOB_LOG: 'Job Log',
  ACTIVITY_LOG: 'Activity Log',
  STOCK_ADJUSTMENTS: 'Stock Adjustments',
  DRIVER_NOTIFICATIONS: 'Driver Notifications',
};

// ============================================
// DELIVERY TICKET TYPES
// ============================================

export type TicketType = 'delivery' | 'pickup' | 'return';

export type TicketStatus =
  | 'created'           // PM uploaded order
  | 'assigned'          // Driver assigned
  | 'materials_pulled'  // Warehouse pulled materials
  | 'load_verified'     // Driver verified load
  | 'en_route'          // Driver departed
  | 'arrived'           // Driver at job site
  | 'delivered'         // Materials unloaded
  | 'picked_up'         // Materials picked up (for pickup/return tickets)
  | 'proof_captured'    // Delivery photos taken
  | 'qc_photos'         // Job QC photos taken
  | 'completed'         // Ticket closed
  | 'cancelled';

export type PhotoType =
  | 'load_verification'
  | 'delivery_proof'
  | 'pickup_proof'
  | 'return_proof'
  | 'job_site_before'
  | 'job_site_after'
  | 'qc_inspection'
  | 'damage_report'
  | 'signature';

// Activity Log Types
export interface ActivityLogEntry {
  activityId: string;
  timestamp: string;
  ticketId: string;
  ticketType: TicketType;
  action: string;
  actionType: 'status_change' | 'photo_upload' | 'note_added' | 'assignment' | 'stock_edit' | 'location_update' | 'signature' | 'other';
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  previousValue?: string;
  newValue?: string;
  gpsLocation?: string;
  notes?: string;
  metadata?: string;
}

// Stock Adjustment for driver edits
export interface StockAdjustment {
  adjustmentId: string;
  timestamp: string;
  productId: string;
  productName: string;
  previousQty: number;
  newQty: number;
  adjustmentQty: number;
  reason: string;
  adjustedBy: string;
  adjustedByName: string;
  adjustedByRole: string;
  ticketId?: string;
  approvedBy?: string;
  approvedAt?: string;
  status: 'pending_review' | 'approved' | 'rejected';
}

// Driver Notification
export interface DriverNotification {
  notificationId: string;
  driverId: string;
  driverName: string;
  ticketId: string;
  ticketType: TicketType;
  message: string;
  priority: 'normal' | 'high' | 'urgent';
  createdAt: string;
  readAt?: string;
  status: 'unread' | 'read' | 'dismissed';
}

export interface MaterialItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category: string;
  notes?: string;
}

export interface DeliveryTicket {
  ticketId: string;
  ticketType: TicketType;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  status: TicketStatus;

  // Job Info
  jobId: string;
  jobName: string;
  jobAddress: string;
  city: string;
  state: string;
  zip: string;

  // Customer Info
  customerName: string;
  customerPhone: string;
  customerEmail?: string;

  // Project Manager
  projectManager: string;
  pmPhone?: string;
  pmEmail?: string;

  // Materials
  materials: MaterialItem[];
  materialsSummary: string;
  totalMaterialCost: number;
  ourCost: number; // What we pay
  chargeAmount: number; // What we charge job (includes markup, delivery, handling)

  // Delivery Info
  requestedDate: string;
  requestedTime?: string;
  priority: 'normal' | 'rush' | 'urgent';
  specialInstructions?: string;

  // Assignment
  assignedDriver?: string;
  assignedDriverName?: string;
  assignedVehicle?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  assignedAt?: string;

  // Workflow Timestamps
  materialsPulledAt?: string;
  materialsPulledBy?: string;
  loadVerifiedAt?: string;
  loadVerifiedBy?: string;
  departedAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  pickedUpAt?: string; // For pickup/return tickets
  proofCapturedAt?: string;
  qcPhotosAt?: string;
  completedAt?: string;

  // Delivery Details
  deliveryNotes?: string;
  gpsLoadLocation?: string;
  gpsDeliveryLocation?: string;
  gpsPickupLocation?: string;
  customerSignature?: string;
  signedBy?: string;

  // Return/Pickup specific
  returnReason?: string;
  pickupReason?: string;
  relatedTicketId?: string; // Link to original delivery ticket for returns

  // Counts
  photoCount: number;
  checklistComplete: boolean;

  // Invoice
  invoiceId?: string;
  invoiceStatus?: 'pending' | 'generated' | 'sent' | 'paid';
}

export interface TicketPhoto {
  photoId: string;
  ticketId: string;
  jobId: string;
  photoType: PhotoType;
  photoUrl: string;
  thumbnailUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  gpsLocation?: string;
  description?: string;
  metadata?: string;
}

export interface ChecklistItem {
  checklistId: string;
  ticketId: string;
  step: string;
  description: string;
  required: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
}

export interface Invoice {
  invoiceId: string;
  ticketId: string;
  jobId: string;
  jobName: string;
  customerName: string;
  customerEmail?: string;

  // Dates
  createdAt: string;
  dueDate: string;
  paidAt?: string;

  // Amounts
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  deliveryFee: number;
  rushFee: number;
  total: number;

  // Status
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  // Payment
  paymentMethod?: string;
  paymentReference?: string;

  // Notes
  notes?: string;
  internalNotes?: string;
}

export interface PriceSheetItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  basePrice: number;
  retailPrice: number;
  contractorPrice: number;
  supplier: string;
  lastUpdated: string;
}

// ============================================
// DELIVERY WORKFLOW SERVICE
// ============================================

class DeliveryWorkflowService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.doc) {
      this.doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAccountAuth);
    }
    if (!this.initialized) {
      await this.doc.loadInfo();
      this.initialized = true;
    }
    return this.doc;
  }

  private async getOrCreateSheet(name: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[name];
    if (!sheet) {
      sheet = await doc.addSheet({ title: name, headerValues: headers });
    }
    return sheet;
  }

  private generateId(prefix: string): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${dateStr}-${random}`;
  }

  // ============================================
  // DELIVERY TICKETS
  // ============================================

  private getTicketHeaders() {
    return [
      'ticketId', 'ticketType', 'createdAt', 'createdBy', 'createdByName', 'createdByRole', 'status',
      'jobId', 'jobName', 'jobAddress', 'city', 'state', 'zip',
      'customerName', 'customerPhone', 'customerEmail',
      'projectManager', 'pmPhone', 'pmEmail',
      'materials', 'materialsSummary', 'totalMaterialCost', 'ourCost', 'chargeAmount',
      'requestedDate', 'requestedTime', 'priority', 'specialInstructions',
      'assignedDriver', 'assignedDriverName', 'assignedVehicle', 'scheduledDate', 'scheduledTime', 'assignedAt',
      'materialsPulledAt', 'materialsPulledBy', 'loadVerifiedAt', 'loadVerifiedBy',
      'departedAt', 'arrivedAt', 'deliveredAt', 'pickedUpAt', 'proofCapturedAt', 'qcPhotosAt', 'completedAt',
      'deliveryNotes', 'gpsLoadLocation', 'gpsDeliveryLocation', 'gpsPickupLocation', 'customerSignature', 'signedBy',
      'returnReason', 'pickupReason', 'relatedTicketId',
      'photoCount', 'checklistComplete', 'invoiceId', 'invoiceStatus'
    ];
  }

  async createTicket(data: {
    ticketType?: TicketType;
    createdBy: string;
    createdByName: string;
    createdByRole: string;
    jobId: string;
    jobName: string;
    jobAddress: string;
    city: string;
    state: string;
    zip: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    projectManager: string;
    pmPhone?: string;
    pmEmail?: string;
    materials: MaterialItem[];
    requestedDate: string;
    requestedTime?: string;
    priority?: 'normal' | 'rush' | 'urgent';
    specialInstructions?: string;
    returnReason?: string;
    pickupReason?: string;
    relatedTicketId?: string;
  }): Promise<DeliveryTicket> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERY_TICKETS, this.getTicketHeaders());

    const materialsSummary = data.materials.map(m =>
      `${m.quantity} ${m.unit} ${m.productName}`
    ).join(', ');

    const totalMaterialCost = data.materials.reduce((sum, m) => sum + m.totalPrice, 0);
    // Calculate our cost (base price) vs charge amount (with markup + delivery)
    const ourCost = data.materials.reduce((sum, m) => sum + (m.unitPrice * m.quantity * 0.7), 0); // ~30% markup assumed
    const deliveryHandling = 75; // Base delivery fee
    const rushFee = data.priority === 'urgent' ? 100 : data.priority === 'rush' ? 50 : 0;
    const chargeAmount = totalMaterialCost + deliveryHandling + rushFee;

    const ticketType = data.ticketType || 'delivery';
    const ticketPrefix = ticketType === 'delivery' ? 'DEL' : ticketType === 'pickup' ? 'PKP' : 'RTN';

    const ticket: DeliveryTicket = {
      ticketId: this.generateId(ticketPrefix),
      ticketType,
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      createdByRole: data.createdByRole,
      status: 'created',
      jobId: data.jobId,
      jobName: data.jobName,
      jobAddress: data.jobAddress,
      city: data.city,
      state: data.state,
      zip: data.zip,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      projectManager: data.projectManager,
      pmPhone: data.pmPhone,
      pmEmail: data.pmEmail,
      materials: data.materials,
      materialsSummary,
      totalMaterialCost,
      ourCost,
      chargeAmount,
      requestedDate: data.requestedDate,
      requestedTime: data.requestedTime,
      priority: data.priority || 'normal',
      specialInstructions: data.specialInstructions,
      returnReason: data.returnReason,
      pickupReason: data.pickupReason,
      relatedTicketId: data.relatedTicketId,
      photoCount: 0,
      checklistComplete: false,
    };

    await sheet.addRow({
      ...ticket,
      materials: JSON.stringify(ticket.materials),
      checklistComplete: 'No',
    } as unknown as Record<string, string | number | boolean>);

    // Create checklist for this ticket
    await this.createTicketChecklist(ticket.ticketId, ticketType);

    // Log activity
    await this.logActivity({
      ticketId: ticket.ticketId,
      ticketType: ticket.ticketType,
      action: `Created ${ticketType} ticket`,
      actionType: 'status_change',
      performedBy: data.createdBy,
      performedByName: data.createdByName,
      performedByRole: data.createdByRole,
      newValue: 'created',
    });

    return ticket;
  }

  private async getTicketRow(ticketId: string): Promise<GoogleSpreadsheetRow | null> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERY_TICKETS, this.getTicketHeaders());
    const rows = await sheet.getRows();
    return rows.find(r => r.get('ticketId') === ticketId) || null;
  }

  private rowToTicket(row: GoogleSpreadsheetRow): DeliveryTicket {
    let materials: MaterialItem[] = [];
    try {
      materials = JSON.parse(row.get('materials') || '[]');
    } catch {}

    return {
      ticketId: row.get('ticketId'),
      ticketType: (row.get('ticketType') as TicketType) || 'delivery',
      createdAt: row.get('createdAt'),
      createdBy: row.get('createdBy'),
      createdByName: row.get('createdByName') || '',
      createdByRole: row.get('createdByRole') || '',
      status: row.get('status') as TicketStatus,
      jobId: row.get('jobId'),
      jobName: row.get('jobName'),
      jobAddress: row.get('jobAddress'),
      city: row.get('city'),
      state: row.get('state'),
      zip: row.get('zip'),
      customerName: row.get('customerName'),
      customerPhone: row.get('customerPhone'),
      customerEmail: row.get('customerEmail'),
      projectManager: row.get('projectManager'),
      pmPhone: row.get('pmPhone'),
      pmEmail: row.get('pmEmail'),
      materials,
      materialsSummary: row.get('materialsSummary'),
      totalMaterialCost: parseFloat(row.get('totalMaterialCost')) || 0,
      ourCost: parseFloat(row.get('ourCost')) || 0,
      chargeAmount: parseFloat(row.get('chargeAmount')) || 0,
      requestedDate: row.get('requestedDate'),
      requestedTime: row.get('requestedTime'),
      priority: row.get('priority') as DeliveryTicket['priority'],
      specialInstructions: row.get('specialInstructions'),
      assignedDriver: row.get('assignedDriver'),
      assignedDriverName: row.get('assignedDriverName'),
      assignedVehicle: row.get('assignedVehicle'),
      scheduledDate: row.get('scheduledDate'),
      scheduledTime: row.get('scheduledTime'),
      assignedAt: row.get('assignedAt'),
      materialsPulledAt: row.get('materialsPulledAt'),
      materialsPulledBy: row.get('materialsPulledBy'),
      loadVerifiedAt: row.get('loadVerifiedAt'),
      loadVerifiedBy: row.get('loadVerifiedBy'),
      departedAt: row.get('departedAt'),
      arrivedAt: row.get('arrivedAt'),
      deliveredAt: row.get('deliveredAt'),
      pickedUpAt: row.get('pickedUpAt'),
      proofCapturedAt: row.get('proofCapturedAt'),
      qcPhotosAt: row.get('qcPhotosAt'),
      completedAt: row.get('completedAt'),
      deliveryNotes: row.get('deliveryNotes'),
      gpsLoadLocation: row.get('gpsLoadLocation'),
      gpsDeliveryLocation: row.get('gpsDeliveryLocation'),
      gpsPickupLocation: row.get('gpsPickupLocation'),
      customerSignature: row.get('customerSignature'),
      signedBy: row.get('signedBy'),
      returnReason: row.get('returnReason'),
      pickupReason: row.get('pickupReason'),
      relatedTicketId: row.get('relatedTicketId'),
      photoCount: parseInt(row.get('photoCount')) || 0,
      checklistComplete: row.get('checklistComplete') === 'Yes',
      invoiceId: row.get('invoiceId'),
      invoiceStatus: row.get('invoiceStatus') as DeliveryTicket['invoiceStatus'],
    };
  }

  async getTicketById(ticketId: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;
    return this.rowToTicket(row);
  }

  async getTickets(filters?: {
    status?: TicketStatus | TicketStatus[];
    ticketType?: TicketType | TicketType[];
    driverId?: string;
    projectManager?: string;
    date?: string;
    limit?: number;
  }): Promise<DeliveryTicket[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.DELIVERY_TICKETS, this.getTicketHeaders());
    const rows = await sheet.getRows();

    let tickets = rows.map(row => this.rowToTicket(row));

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      tickets = tickets.filter(t => statuses.includes(t.status));
    }
    if (filters?.ticketType) {
      const types = Array.isArray(filters.ticketType) ? filters.ticketType : [filters.ticketType];
      tickets = tickets.filter(t => types.includes(t.ticketType));
    }
    if (filters?.driverId) {
      tickets = tickets.filter(t => t.assignedDriver === filters.driverId);
    }
    if (filters?.projectManager) {
      tickets = tickets.filter(t => t.projectManager === filters.projectManager);
    }
    if (filters?.date) {
      tickets = tickets.filter(t => t.scheduledDate === filters.date || t.requestedDate === filters.date);
    }

    tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      tickets = tickets.slice(0, filters.limit);
    }

    return tickets;
  }

  // ============================================
  // WORKFLOW STEP HANDLERS
  // ============================================

  async assignDriver(ticketId: string, driverId: string, driverName: string, vehicle: string, scheduledDate: string, scheduledTime: string, assignedBy?: string, assignedByName?: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    const timestamp = new Date().toISOString();
    row.set('status', 'assigned');
    row.set('assignedDriver', driverId);
    row.set('assignedDriverName', driverName);
    row.set('assignedVehicle', vehicle);
    row.set('scheduledDate', scheduledDate);
    row.set('scheduledTime', scheduledTime);
    row.set('assignedAt', timestamp);
    await row.save();

    const ticket = this.rowToTicket(row);

    // Create notification for driver
    await this.createDriverNotification({
      driverId,
      driverName,
      ticketId,
      ticketType: ticket.ticketType,
      message: `New ${ticket.ticketType} assigned: ${ticket.jobName} at ${ticket.jobAddress}. Scheduled: ${scheduledDate} ${scheduledTime}`,
      priority: ticket.priority === 'urgent' ? 'urgent' : ticket.priority === 'rush' ? 'high' : 'normal',
    });

    // Log activity
    await this.logActivity({
      ticketId,
      ticketType: ticket.ticketType,
      action: `Assigned to driver ${driverName}`,
      actionType: 'assignment',
      performedBy: assignedBy || 'system',
      performedByName: assignedByName || 'System',
      performedByRole: 'manager',
      newValue: driverName,
    });

    return ticket;
  }

  async pullMaterials(ticketId: string, pulledBy: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    row.set('status', 'materials_pulled');
    row.set('materialsPulledAt', new Date().toISOString());
    row.set('materialsPulledBy', pulledBy);
    await row.save();

    // Deduct from inventory
    const ticket = this.rowToTicket(row);
    await this.deductInventory(ticket.materials);

    return ticket;
  }

  async verifyLoad(ticketId: string, verifiedBy: string, gpsLocation?: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    row.set('status', 'load_verified');
    row.set('loadVerifiedAt', new Date().toISOString());
    row.set('loadVerifiedBy', verifiedBy);
    if (gpsLocation) row.set('gpsLoadLocation', gpsLocation);
    await row.save();

    await this.updateChecklistStep(ticketId, 'verify_load', verifiedBy);

    return this.rowToTicket(row);
  }

  async startDelivery(ticketId: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    row.set('status', 'en_route');
    row.set('departedAt', new Date().toISOString());
    await row.save();

    await this.updateChecklistStep(ticketId, 'depart', row.get('assignedDriverName'));

    return this.rowToTicket(row);
  }

  async markArrived(ticketId: string, gpsLocation?: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    row.set('status', 'arrived');
    row.set('arrivedAt', new Date().toISOString());
    if (gpsLocation) row.set('gpsDeliveryLocation', gpsLocation);
    await row.save();

    await this.updateChecklistStep(ticketId, 'arrive', row.get('assignedDriverName'));

    return this.rowToTicket(row);
  }

  async completeDelivery(ticketId: string, notes?: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    row.set('status', 'delivered');
    row.set('deliveredAt', new Date().toISOString());
    if (notes) row.set('deliveryNotes', notes);
    await row.save();

    await this.updateChecklistStep(ticketId, 'unload', row.get('assignedDriverName'));

    return this.rowToTicket(row);
  }

  async captureProof(ticketId: string, signature?: string, signedBy?: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    row.set('status', 'proof_captured');
    row.set('proofCapturedAt', new Date().toISOString());
    if (signature) row.set('customerSignature', signature);
    if (signedBy) row.set('signedBy', signedBy);
    await row.save();

    await this.updateChecklistStep(ticketId, 'capture_proof', row.get('assignedDriverName'));

    return this.rowToTicket(row);
  }

  async uploadQCPhotos(ticketId: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    row.set('status', 'qc_photos');
    row.set('qcPhotosAt', new Date().toISOString());
    await row.save();

    await this.updateChecklistStep(ticketId, 'qc_photos', row.get('assignedDriverName'));

    return this.rowToTicket(row);
  }

  async completeTicket(ticketId: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    row.set('status', 'completed');
    row.set('completedAt', new Date().toISOString());
    row.set('checklistComplete', 'Yes');
    await row.save();

    // Generate invoice
    const ticket = this.rowToTicket(row);
    const invoice = await this.generateInvoice(ticket);

    row.set('invoiceId', invoice.invoiceId);
    row.set('invoiceStatus', 'generated');
    await row.save();

    return this.rowToTicket(row);
  }

  // ============================================
  // PHOTOS
  // ============================================

  private getPhotoHeaders() {
    return ['photoId', 'ticketId', 'jobId', 'photoType', 'photoUrl', 'thumbnailUrl',
            'uploadedBy', 'uploadedAt', 'gpsLocation', 'description', 'metadata'];
  }

  async addPhoto(data: Omit<TicketPhoto, 'photoId' | 'uploadedAt'>): Promise<TicketPhoto> {
    const sheet = await this.getOrCreateSheet(SHEETS.TICKET_PHOTOS, this.getPhotoHeaders());

    const photo: TicketPhoto = {
      ...data,
      photoId: this.generateId('PHT'),
      uploadedAt: new Date().toISOString(),
    };

    await sheet.addRow(photo as unknown as Record<string, string | number | boolean>);

    // Update photo count on ticket
    const ticketRow = await this.getTicketRow(data.ticketId);
    if (ticketRow) {
      const count = parseInt(ticketRow.get('photoCount')) || 0;
      ticketRow.set('photoCount', (count + 1).toString());
      await ticketRow.save();
    }

    return photo;
  }

  async getTicketPhotos(ticketId: string, photoType?: PhotoType): Promise<TicketPhoto[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.TICKET_PHOTOS, this.getPhotoHeaders());
    const rows = await sheet.getRows();

    let photos = rows
      .filter(row => row.get('ticketId') === ticketId)
      .map(row => ({
        photoId: row.get('photoId'),
        ticketId: row.get('ticketId'),
        jobId: row.get('jobId'),
        photoType: row.get('photoType') as PhotoType,
        photoUrl: row.get('photoUrl'),
        thumbnailUrl: row.get('thumbnailUrl'),
        uploadedBy: row.get('uploadedBy'),
        uploadedAt: row.get('uploadedAt'),
        gpsLocation: row.get('gpsLocation'),
        description: row.get('description'),
        metadata: row.get('metadata'),
      }));

    if (photoType) {
      photos = photos.filter(p => p.photoType === photoType);
    }

    return photos.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  // ============================================
  // CHECKLIST
  // ============================================

  private getChecklistHeaders() {
    return ['checklistId', 'ticketId', 'step', 'description', 'required', 'completedAt', 'completedBy', 'notes'];
  }

  private async createTicketChecklist(ticketId: string, ticketType: TicketType = 'delivery'): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.TICKET_CHECKLIST, this.getChecklistHeaders());

    // Different checklists based on ticket type
    const deliverySteps = [
      { step: 'assign_driver', description: 'Assign driver and schedule delivery', required: true },
      { step: 'pull_materials', description: 'Pull materials from inventory', required: true },
      { step: 'verify_load', description: 'Driver verifies load matches order', required: true },
      { step: 'take_load_photo', description: 'Take photo of loaded materials', required: true },
      { step: 'depart', description: 'Depart warehouse for delivery', required: true },
      { step: 'arrive', description: 'Arrive at job site', required: true },
      { step: 'unload', description: 'Unload materials at job site', required: true },
      { step: 'take_delivery_photo', description: 'Take photo of delivered materials', required: true },
      { step: 'capture_proof', description: 'Capture customer signature', required: true },
      { step: 'qc_photos', description: 'Take job site QC photos', required: false },
    ];

    const pickupSteps = [
      { step: 'assign_driver', description: 'Assign driver for pickup', required: true },
      { step: 'depart', description: 'Depart warehouse for pickup', required: true },
      { step: 'arrive', description: 'Arrive at pickup location', required: true },
      { step: 'verify_materials', description: 'Verify materials to pick up', required: true },
      { step: 'take_before_photo', description: 'Take photo before loading', required: true },
      { step: 'load_materials', description: 'Load materials onto truck', required: true },
      { step: 'take_loaded_photo', description: 'Take photo of loaded materials', required: true },
      { step: 'capture_proof', description: 'Get signature confirming pickup', required: true },
      { step: 'return_to_warehouse', description: 'Return materials to warehouse', required: true },
    ];

    const returnSteps = [
      { step: 'assign_driver', description: 'Assign driver for return pickup', required: true },
      { step: 'depart', description: 'Depart warehouse for return pickup', required: true },
      { step: 'arrive', description: 'Arrive at return location', required: true },
      { step: 'inspect_materials', description: 'Inspect materials for damage', required: true },
      { step: 'take_condition_photo', description: 'Take photos of material condition', required: true },
      { step: 'load_returns', description: 'Load return materials', required: true },
      { step: 'take_loaded_photo', description: 'Take photo of loaded returns', required: true },
      { step: 'capture_proof', description: 'Get signature confirming return', required: true },
      { step: 'process_at_warehouse', description: 'Process returns at warehouse', required: true },
      { step: 'update_inventory', description: 'Update inventory with returned items', required: true },
    ];

    const steps = ticketType === 'pickup' ? pickupSteps : ticketType === 'return' ? returnSteps : deliverySteps;

    for (const step of steps) {
      await sheet.addRow({
        checklistId: this.generateId('CHK'),
        ticketId,
        step: step.step,
        description: step.description,
        required: step.required ? 'Yes' : 'No',
        completedAt: '',
        completedBy: '',
        notes: '',
      });
    }
  }

  async getTicketChecklist(ticketId: string): Promise<ChecklistItem[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.TICKET_CHECKLIST, this.getChecklistHeaders());
    const rows = await sheet.getRows();

    return rows
      .filter(row => row.get('ticketId') === ticketId)
      .map(row => ({
        checklistId: row.get('checklistId'),
        ticketId: row.get('ticketId'),
        step: row.get('step'),
        description: row.get('description'),
        required: row.get('required') === 'Yes',
        completedAt: row.get('completedAt'),
        completedBy: row.get('completedBy'),
        notes: row.get('notes'),
      }));
  }

  async updateChecklistStep(ticketId: string, step: string, completedBy: string, notes?: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.TICKET_CHECKLIST, this.getChecklistHeaders());
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('ticketId') === ticketId && r.get('step') === step);

    if (row) {
      row.set('completedAt', new Date().toISOString());
      row.set('completedBy', completedBy);
      if (notes) row.set('notes', notes);
      await row.save();
    }
  }

  // ============================================
  // INVOICES
  // ============================================

  private getInvoiceHeaders() {
    return ['invoiceId', 'ticketId', 'jobId', 'jobName', 'customerName', 'customerEmail',
            'createdAt', 'dueDate', 'paidAt', 'subtotal', 'taxRate', 'taxAmount',
            'deliveryFee', 'rushFee', 'total', 'status', 'paymentMethod', 'paymentReference',
            'notes', 'internalNotes'];
  }

  async generateInvoice(ticket: DeliveryTicket): Promise<Invoice> {
    const sheet = await this.getOrCreateSheet(SHEETS.INVOICES, this.getInvoiceHeaders());

    const subtotal = ticket.totalMaterialCost;
    const taxRate = 0.09; // 9% Alabama sales tax
    const taxAmount = subtotal * taxRate;
    const deliveryFee = 75; // Base delivery fee
    const rushFee = ticket.priority === 'urgent' ? 100 : ticket.priority === 'rush' ? 50 : 0;
    const total = subtotal + taxAmount + deliveryFee + rushFee;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // Net 30

    const invoice: Invoice = {
      invoiceId: this.generateId('INV'),
      ticketId: ticket.ticketId,
      jobId: ticket.jobId,
      jobName: ticket.jobName,
      customerName: ticket.customerName,
      customerEmail: ticket.customerEmail,
      createdAt: new Date().toISOString(),
      dueDate: dueDate.toISOString().slice(0, 10),
      subtotal,
      taxRate,
      taxAmount,
      deliveryFee,
      rushFee,
      total,
      status: 'pending',
    };

    await sheet.addRow(invoice as unknown as Record<string, string | number | boolean>);

    // Add invoice line items
    await this.addInvoiceItems(invoice.invoiceId, ticket.materials, deliveryFee, rushFee, taxAmount);

    return invoice;
  }

  private async addInvoiceItems(invoiceId: string, materials: MaterialItem[], deliveryFee: number, rushFee: number, taxAmount: number): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.INVOICE_ITEMS, [
      'itemId', 'invoiceId', 'description', 'quantity', 'unit', 'unitPrice', 'total', 'type'
    ]);

    // Add material items
    for (const material of materials) {
      await sheet.addRow({
        itemId: this.generateId('ITM'),
        invoiceId,
        description: material.productName,
        quantity: material.quantity,
        unit: material.unit,
        unitPrice: material.unitPrice,
        total: material.totalPrice,
        type: 'material',
      });
    }

    // Add delivery fee
    await sheet.addRow({
      itemId: this.generateId('ITM'),
      invoiceId,
      description: 'Delivery Fee',
      quantity: 1,
      unit: 'ea',
      unitPrice: deliveryFee,
      total: deliveryFee,
      type: 'fee',
    });

    // Add rush fee if applicable
    if (rushFee > 0) {
      await sheet.addRow({
        itemId: this.generateId('ITM'),
        invoiceId,
        description: 'Rush Delivery Fee',
        quantity: 1,
        unit: 'ea',
        unitPrice: rushFee,
        total: rushFee,
        type: 'fee',
      });
    }

    // Add tax
    await sheet.addRow({
      itemId: this.generateId('ITM'),
      invoiceId,
      description: 'Sales Tax (9%)',
      quantity: 1,
      unit: 'ea',
      unitPrice: taxAmount,
      total: taxAmount,
      type: 'tax',
    });
  }

  async getInvoices(filters?: { status?: Invoice['status']; limit?: number }): Promise<Invoice[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.INVOICES, this.getInvoiceHeaders());
    const rows = await sheet.getRows();

    let invoices = rows.map(row => ({
      invoiceId: row.get('invoiceId'),
      ticketId: row.get('ticketId'),
      jobId: row.get('jobId'),
      jobName: row.get('jobName'),
      customerName: row.get('customerName'),
      customerEmail: row.get('customerEmail'),
      createdAt: row.get('createdAt'),
      dueDate: row.get('dueDate'),
      paidAt: row.get('paidAt'),
      subtotal: parseFloat(row.get('subtotal')) || 0,
      taxRate: parseFloat(row.get('taxRate')) || 0,
      taxAmount: parseFloat(row.get('taxAmount')) || 0,
      deliveryFee: parseFloat(row.get('deliveryFee')) || 0,
      rushFee: parseFloat(row.get('rushFee')) || 0,
      total: parseFloat(row.get('total')) || 0,
      status: row.get('status') as Invoice['status'],
      paymentMethod: row.get('paymentMethod'),
      paymentReference: row.get('paymentReference'),
      notes: row.get('notes'),
      internalNotes: row.get('internalNotes'),
    }));

    if (filters?.status) {
      invoices = invoices.filter(i => i.status === filters.status);
    }

    invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      invoices = invoices.slice(0, filters.limit);
    }

    return invoices;
  }

  async getInvoiceById(invoiceId: string): Promise<Invoice | null> {
    const invoices = await this.getInvoices();
    return invoices.find(i => i.invoiceId === invoiceId) || null;
  }

  async markInvoicePaid(invoiceId: string, paymentMethod: string, reference?: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.INVOICES, this.getInvoiceHeaders());
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('invoiceId') === invoiceId);

    if (row) {
      row.set('status', 'paid');
      row.set('paidAt', new Date().toISOString());
      row.set('paymentMethod', paymentMethod);
      if (reference) row.set('paymentReference', reference);
      await row.save();
    }
  }

  // ============================================
  // INVENTORY DEDUCTION
  // ============================================

  private async deductInventory(materials: MaterialItem[]): Promise<void> {
    const doc = await this.getDoc();
    const invSheet = doc.sheetsByTitle['Inventory'];
    if (!invSheet) return;

    const rows = await invSheet.getRows();

    for (const material of materials) {
      const row = rows.find(r => r.get('productId') === material.productId);
      if (row) {
        const currentQty = parseFloat(row.get('currentQty')) || 0;
        const newQty = Math.max(0, currentQty - material.quantity);
        const unitCost = parseFloat(row.get('unitCost')) || 0;

        row.set('currentQty', newQty.toString());
        row.set('totalValue', (newQty * unitCost).toFixed(2));
        await row.save();
      }
    }
  }

  // ============================================
  // PRICE SHEET
  // ============================================

  async getPriceSheet(): Promise<PriceSheetItem[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.PRICE_SHEET, [
      'productId', 'productName', 'sku', 'category', 'unit',
      'basePrice', 'retailPrice', 'contractorPrice', 'supplier', 'lastUpdated'
    ]);

    const rows = await sheet.getRows();
    return rows.map(row => ({
      productId: row.get('productId'),
      productName: row.get('productName'),
      sku: row.get('sku'),
      category: row.get('category'),
      unit: row.get('unit'),
      basePrice: parseFloat(row.get('basePrice')) || 0,
      retailPrice: parseFloat(row.get('retailPrice')) || 0,
      contractorPrice: parseFloat(row.get('contractorPrice')) || 0,
      supplier: row.get('supplier'),
      lastUpdated: row.get('lastUpdated'),
    }));
  }

  // ============================================
  // DASHBOARD STATS
  // ============================================

  async getWorkflowStats(): Promise<{
    tickets: {
      created: number;
      inProgress: number;
      completed: number;
      today: number;
    };
    invoices: {
      pending: number;
      pendingAmount: number;
      paid: number;
      paidAmount: number;
    };
  }> {
    const tickets = await this.getTickets();
    const invoices = await this.getInvoices();
    const today = new Date().toISOString().slice(0, 10);

    const activeStatuses: TicketStatus[] = ['created', 'materials_pulled', 'load_verified', 'en_route', 'arrived', 'delivered', 'proof_captured', 'qc_photos'];

    return {
      tickets: {
        created: tickets.filter(t => t.status === 'created').length,
        inProgress: tickets.filter(t => activeStatuses.includes(t.status) && t.status !== 'created').length,
        completed: tickets.filter(t => t.status === 'completed').length,
        today: tickets.filter(t => t.scheduledDate === today || t.createdAt.startsWith(today)).length,
      },
      invoices: {
        pending: invoices.filter(i => i.status === 'pending' || i.status === 'sent').length,
        pendingAmount: invoices.filter(i => i.status === 'pending' || i.status === 'sent').reduce((sum, i) => sum + i.total, 0),
        paid: invoices.filter(i => i.status === 'paid').length,
        paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
      },
    };
  }

  // ============================================
  // PICKUP/RETURN COMPLETION
  // ============================================

  async completePickup(ticketId: string, gpsLocation?: string, notes?: string): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    row.set('status', 'picked_up');
    row.set('pickedUpAt', new Date().toISOString());
    if (gpsLocation) row.set('gpsPickupLocation', gpsLocation);
    if (notes) row.set('deliveryNotes', notes);
    await row.save();

    const ticket = this.rowToTicket(row);

    await this.logActivity({
      ticketId,
      ticketType: ticket.ticketType,
      action: 'Materials picked up',
      actionType: 'status_change',
      performedBy: ticket.assignedDriver || 'unknown',
      performedByName: ticket.assignedDriverName || 'Unknown',
      performedByRole: 'driver',
      previousValue: 'arrived',
      newValue: 'picked_up',
      gpsLocation,
    });

    return ticket;
  }

  async processReturn(ticketId: string, returnedMaterials: MaterialItem[], condition: 'good' | 'damaged' | 'partial'): Promise<DeliveryTicket | null> {
    const row = await this.getTicketRow(ticketId);
    if (!row) return null;

    const ticket = this.rowToTicket(row);

    // Add returned materials back to inventory if in good condition
    if (condition === 'good') {
      await this.addToInventory(returnedMaterials);
    }

    await this.logActivity({
      ticketId,
      ticketType: ticket.ticketType,
      action: `Return processed - condition: ${condition}`,
      actionType: 'status_change',
      performedBy: ticket.assignedDriver || 'unknown',
      performedByName: ticket.assignedDriverName || 'Unknown',
      performedByRole: 'driver',
      notes: `${returnedMaterials.length} items returned`,
    });

    return ticket;
  }

  private async addToInventory(materials: MaterialItem[]): Promise<void> {
    const doc = await this.getDoc();
    const invSheet = doc.sheetsByTitle['Inventory'];
    if (!invSheet) return;

    const rows = await invSheet.getRows();

    for (const material of materials) {
      const row = rows.find(r => r.get('productId') === material.productId);
      if (row) {
        const currentQty = parseFloat(row.get('currentQty')) || 0;
        const newQty = currentQty + material.quantity;
        const unitCost = parseFloat(row.get('unitCost')) || 0;

        row.set('currentQty', newQty.toString());
        row.set('totalValue', (newQty * unitCost).toFixed(2));
        await row.save();
      }
    }
  }

  // ============================================
  // ACTIVITY LOGGING
  // ============================================

  private getActivityLogHeaders() {
    return [
      'activityId', 'timestamp', 'ticketId', 'ticketType', 'action', 'actionType',
      'performedBy', 'performedByName', 'performedByRole',
      'previousValue', 'newValue', 'gpsLocation', 'notes', 'metadata'
    ];
  }

  async logActivity(data: Omit<ActivityLogEntry, 'activityId' | 'timestamp'>): Promise<ActivityLogEntry> {
    const sheet = await this.getOrCreateSheet(SHEETS.ACTIVITY_LOG, this.getActivityLogHeaders());

    const entry: ActivityLogEntry = {
      ...data,
      activityId: this.generateId('ACT'),
      timestamp: new Date().toISOString(),
    };

    await sheet.addRow(entry as unknown as Record<string, string | number | boolean>);

    return entry;
  }

  async getActivityLog(filters?: {
    ticketId?: string;
    performedBy?: string;
    actionType?: ActivityLogEntry['actionType'];
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<ActivityLogEntry[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.ACTIVITY_LOG, this.getActivityLogHeaders());
    const rows = await sheet.getRows();

    let entries = rows.map(row => ({
      activityId: row.get('activityId'),
      timestamp: row.get('timestamp'),
      ticketId: row.get('ticketId'),
      ticketType: row.get('ticketType') as TicketType,
      action: row.get('action'),
      actionType: row.get('actionType') as ActivityLogEntry['actionType'],
      performedBy: row.get('performedBy'),
      performedByName: row.get('performedByName'),
      performedByRole: row.get('performedByRole'),
      previousValue: row.get('previousValue'),
      newValue: row.get('newValue'),
      gpsLocation: row.get('gpsLocation'),
      notes: row.get('notes'),
      metadata: row.get('metadata'),
    }));

    if (filters?.ticketId) {
      entries = entries.filter(e => e.ticketId === filters.ticketId);
    }
    if (filters?.performedBy) {
      entries = entries.filter(e => e.performedBy === filters.performedBy);
    }
    if (filters?.actionType) {
      entries = entries.filter(e => e.actionType === filters.actionType);
    }
    if (filters?.fromDate) {
      entries = entries.filter(e => e.timestamp >= filters.fromDate!);
    }
    if (filters?.toDate) {
      entries = entries.filter(e => e.timestamp <= filters.toDate!);
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      entries = entries.slice(0, filters.limit);
    }

    return entries;
  }

  // ============================================
  // DRIVER NOTIFICATIONS
  // ============================================

  private getNotificationHeaders() {
    return [
      'notificationId', 'driverId', 'driverName', 'ticketId', 'ticketType',
      'message', 'priority', 'createdAt', 'readAt', 'status'
    ];
  }

  async createDriverNotification(data: Omit<DriverNotification, 'notificationId' | 'createdAt' | 'status'>): Promise<DriverNotification> {
    const sheet = await this.getOrCreateSheet(SHEETS.DRIVER_NOTIFICATIONS, this.getNotificationHeaders());

    const notification: DriverNotification = {
      ...data,
      notificationId: this.generateId('NTF'),
      createdAt: new Date().toISOString(),
      status: 'unread',
    };

    await sheet.addRow(notification as unknown as Record<string, string | number | boolean>);

    return notification;
  }

  async getDriverNotifications(driverId: string, unreadOnly: boolean = false): Promise<DriverNotification[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.DRIVER_NOTIFICATIONS, this.getNotificationHeaders());
    const rows = await sheet.getRows();

    let notifications = rows
      .filter(row => row.get('driverId') === driverId)
      .map(row => ({
        notificationId: row.get('notificationId'),
        driverId: row.get('driverId'),
        driverName: row.get('driverName'),
        ticketId: row.get('ticketId'),
        ticketType: row.get('ticketType') as TicketType,
        message: row.get('message'),
        priority: row.get('priority') as DriverNotification['priority'],
        createdAt: row.get('createdAt'),
        readAt: row.get('readAt'),
        status: row.get('status') as DriverNotification['status'],
      }));

    if (unreadOnly) {
      notifications = notifications.filter(n => n.status === 'unread');
    }

    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.DRIVER_NOTIFICATIONS, this.getNotificationHeaders());
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('notificationId') === notificationId);

    if (row) {
      row.set('status', 'read');
      row.set('readAt', new Date().toISOString());
      await row.save();
    }
  }

  // ============================================
  // STOCK ADJUSTMENTS (Driver Edits)
  // ============================================

  private getStockAdjustmentHeaders() {
    return [
      'adjustmentId', 'timestamp', 'productId', 'productName',
      'previousQty', 'newQty', 'adjustmentQty', 'reason',
      'adjustedBy', 'adjustedByName', 'adjustedByRole',
      'ticketId', 'approvedBy', 'approvedAt', 'status'
    ];
  }

  async createStockAdjustment(data: {
    productId: string;
    productName: string;
    previousQty: number;
    newQty: number;
    reason: string;
    adjustedBy: string;
    adjustedByName: string;
    adjustedByRole: string;
    ticketId?: string;
  }): Promise<StockAdjustment> {
    const sheet = await this.getOrCreateSheet(SHEETS.STOCK_ADJUSTMENTS, this.getStockAdjustmentHeaders());

    const adjustment: StockAdjustment = {
      adjustmentId: this.generateId('ADJ'),
      timestamp: new Date().toISOString(),
      productId: data.productId,
      productName: data.productName,
      previousQty: data.previousQty,
      newQty: data.newQty,
      adjustmentQty: data.newQty - data.previousQty,
      reason: data.reason,
      adjustedBy: data.adjustedBy,
      adjustedByName: data.adjustedByName,
      adjustedByRole: data.adjustedByRole,
      ticketId: data.ticketId,
      status: 'pending_review',
    };

    await sheet.addRow(adjustment as unknown as Record<string, string | number | boolean>);

    // Actually update the inventory (driver edits take effect immediately but are logged for review)
    const doc = await this.getDoc();
    const invSheet = doc.sheetsByTitle['Inventory'];
    if (invSheet) {
      const rows = await invSheet.getRows();
      const row = rows.find(r => r.get('productId') === data.productId);
      if (row) {
        const unitCost = parseFloat(row.get('unitCost')) || 0;
        row.set('currentQty', data.newQty.toString());
        row.set('totalValue', (data.newQty * unitCost).toFixed(2));
        await row.save();
      }
    }

    // Log activity
    await this.logActivity({
      ticketId: data.ticketId || '',
      ticketType: 'delivery',
      action: `Stock adjustment: ${data.productName} ${data.previousQty} → ${data.newQty}`,
      actionType: 'stock_edit',
      performedBy: data.adjustedBy,
      performedByName: data.adjustedByName,
      performedByRole: data.adjustedByRole,
      previousValue: data.previousQty.toString(),
      newValue: data.newQty.toString(),
      notes: data.reason,
    });

    return adjustment;
  }

  async getStockAdjustments(filters?: {
    status?: StockAdjustment['status'];
    adjustedBy?: string;
    productId?: string;
    limit?: number;
  }): Promise<StockAdjustment[]> {
    const sheet = await this.getOrCreateSheet(SHEETS.STOCK_ADJUSTMENTS, this.getStockAdjustmentHeaders());
    const rows = await sheet.getRows();

    let adjustments = rows.map(row => ({
      adjustmentId: row.get('adjustmentId'),
      timestamp: row.get('timestamp'),
      productId: row.get('productId'),
      productName: row.get('productName'),
      previousQty: parseFloat(row.get('previousQty')) || 0,
      newQty: parseFloat(row.get('newQty')) || 0,
      adjustmentQty: parseFloat(row.get('adjustmentQty')) || 0,
      reason: row.get('reason'),
      adjustedBy: row.get('adjustedBy'),
      adjustedByName: row.get('adjustedByName'),
      adjustedByRole: row.get('adjustedByRole'),
      ticketId: row.get('ticketId'),
      approvedBy: row.get('approvedBy'),
      approvedAt: row.get('approvedAt'),
      status: row.get('status') as StockAdjustment['status'],
    }));

    if (filters?.status) {
      adjustments = adjustments.filter(a => a.status === filters.status);
    }
    if (filters?.adjustedBy) {
      adjustments = adjustments.filter(a => a.adjustedBy === filters.adjustedBy);
    }
    if (filters?.productId) {
      adjustments = adjustments.filter(a => a.productId === filters.productId);
    }

    adjustments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      adjustments = adjustments.slice(0, filters.limit);
    }

    return adjustments;
  }

  async approveStockAdjustment(adjustmentId: string, approvedBy: string): Promise<void> {
    const sheet = await this.getOrCreateSheet(SHEETS.STOCK_ADJUSTMENTS, this.getStockAdjustmentHeaders());
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('adjustmentId') === adjustmentId);

    if (row) {
      row.set('status', 'approved');
      row.set('approvedBy', approvedBy);
      row.set('approvedAt', new Date().toISOString());
      await row.save();
    }
  }

  // ============================================
  // AI VOICE ASSISTANCE
  // ============================================

  generateLoadingVoiceScript(ticket: DeliveryTicket): string {
    const materials = ticket.materials;
    const lines: string[] = [
      `Loading checklist for ticket ${ticket.ticketId}.`,
      `Delivery to ${ticket.jobName} at ${ticket.jobAddress}, ${ticket.city}.`,
      `${materials.length} items to load.`,
      '',
    ];

    materials.forEach((m, index) => {
      lines.push(`Item ${index + 1}: ${m.quantity} ${m.unit} of ${m.productName}.`);
    });

    lines.push('');
    lines.push('Please verify each item is loaded correctly.');

    if (ticket.specialInstructions) {
      lines.push(`Special instructions: ${ticket.specialInstructions}`);
    }

    if (ticket.priority === 'urgent') {
      lines.push('This is an urgent delivery. Please expedite.');
    } else if (ticket.priority === 'rush') {
      lines.push('This is a rush delivery.');
    }

    return lines.join(' ');
  }

  generateVerificationVoiceScript(ticket: DeliveryTicket, checklist: ChecklistItem[]): string {
    const completed = checklist.filter(c => c.completedAt).length;
    const total = checklist.length;
    const remaining = checklist.filter(c => !c.completedAt && c.required);

    const lines: string[] = [
      `Verification status for ticket ${ticket.ticketId}.`,
      `${completed} of ${total} steps complete.`,
    ];

    if (remaining.length > 0) {
      lines.push(`Remaining required steps: ${remaining.map(r => r.description).join(', ')}.`);
    } else {
      lines.push('All required steps complete. Ready for departure.');
    }

    return lines.join(' ');
  }

  generateDeliveryVoiceScript(ticket: DeliveryTicket): string {
    const lines: string[] = [
      `Delivery destination: ${ticket.jobAddress}, ${ticket.city}, ${ticket.state} ${ticket.zip}.`,
      `Customer: ${ticket.customerName}.`,
      `Contact: ${ticket.customerPhone}.`,
    ];

    if (ticket.specialInstructions) {
      lines.push(`Instructions: ${ticket.specialInstructions}`);
    }

    return lines.join(' ');
  }

  generateCompletionVoiceScript(ticket: DeliveryTicket): string {
    return `${ticket.ticketType === 'delivery' ? 'Delivery' : ticket.ticketType === 'pickup' ? 'Pickup' : 'Return'} complete for ${ticket.jobName}. Please capture signature and photos before departing.`;
  }
}

export const deliveryWorkflowService = new DeliveryWorkflowService();
