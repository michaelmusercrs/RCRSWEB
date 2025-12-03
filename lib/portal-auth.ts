import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ============================================
// ROLE DEFINITIONS
// ============================================

export type UserRole = 'owner' | 'manager' | 'project_manager' | 'driver' | 'viewer';

export interface RolePermissions {
  // Inventory permissions
  canViewInventory: boolean;
  canEditInventory: boolean;
  canEditStockQty: boolean; // Driver can edit stock with logging
  canSubmitCounts: boolean;
  canApproveCounts: boolean;
  canCreateRestockRequests: boolean;
  canApproveRestocks: boolean;
  canManageProducts: boolean;

  // Order/Delivery permissions
  canViewOrders: boolean;
  canCreateOrders: boolean;
  canCreateDeliveryTickets: boolean;
  canCreateReturnTickets: boolean;
  canAssignDeliveries: boolean;
  canViewAllDeliveries: boolean;
  canViewOwnDeliveries: boolean;

  // User management
  canManageUsers: boolean;
  canViewAuditLog: boolean;
  canViewAllLogs: boolean; // Owner only

  // Admin permissions
  canAccessAdminPortal: boolean;
  canManageSettings: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  owner: {
    canViewInventory: true,
    canEditInventory: true,
    canEditStockQty: true,
    canSubmitCounts: true,
    canApproveCounts: true,
    canCreateRestockRequests: true,
    canApproveRestocks: true,
    canManageProducts: true,
    canViewOrders: true,
    canCreateOrders: true,
    canCreateDeliveryTickets: true,
    canCreateReturnTickets: true,
    canAssignDeliveries: true,
    canViewAllDeliveries: true,
    canViewOwnDeliveries: true,
    canManageUsers: true,
    canViewAuditLog: true,
    canViewAllLogs: true,
    canAccessAdminPortal: true,
    canManageSettings: true,
  },
  manager: {
    canViewInventory: true,
    canEditInventory: true,
    canEditStockQty: true,
    canSubmitCounts: true,
    canApproveCounts: true,
    canCreateRestockRequests: true,
    canApproveRestocks: true,
    canManageProducts: false,
    canViewOrders: true,
    canCreateOrders: true,
    canCreateDeliveryTickets: true,
    canCreateReturnTickets: true,
    canAssignDeliveries: true,
    canViewAllDeliveries: true,
    canViewOwnDeliveries: true,
    canManageUsers: false,
    canViewAuditLog: true,
    canViewAllLogs: false,
    canAccessAdminPortal: false,
    canManageSettings: false,
  },
  project_manager: {
    canViewInventory: true,
    canEditInventory: false,
    canEditStockQty: false,
    canSubmitCounts: false,
    canApproveCounts: false,
    canCreateRestockRequests: true,
    canApproveRestocks: false,
    canManageProducts: false,
    canViewOrders: true,
    canCreateOrders: true,
    canCreateDeliveryTickets: true,
    canCreateReturnTickets: true,
    canAssignDeliveries: false,
    canViewAllDeliveries: false,
    canViewOwnDeliveries: true,
    canManageUsers: false,
    canViewAuditLog: false,
    canViewAllLogs: false,
    canAccessAdminPortal: false,
    canManageSettings: false,
  },
  driver: {
    canViewInventory: true,
    canEditInventory: false,
    canEditStockQty: true, // Can edit with logging for owner to see
    canSubmitCounts: false,
    canApproveCounts: false,
    canCreateRestockRequests: false,
    canApproveRestocks: false,
    canManageProducts: false,
    canViewOrders: true,
    canCreateOrders: false,
    canCreateDeliveryTickets: false,
    canCreateReturnTickets: true, // Driver can create return/pickup tickets
    canAssignDeliveries: false,
    canViewAllDeliveries: false,
    canViewOwnDeliveries: true,
    canManageUsers: false,
    canViewAuditLog: false,
    canViewAllLogs: false,
    canAccessAdminPortal: false,
    canManageSettings: false,
  },
  viewer: {
    canViewInventory: true,
    canEditInventory: false,
    canEditStockQty: false,
    canSubmitCounts: false,
    canApproveCounts: false,
    canCreateRestockRequests: false,
    canApproveRestocks: false,
    canManageProducts: false,
    canViewOrders: true,
    canCreateOrders: false,
    canCreateDeliveryTickets: false,
    canCreateReturnTickets: false,
    canAssignDeliveries: false,
    canViewAllDeliveries: false,
    canViewOwnDeliveries: false,
    canManageUsers: false,
    canViewAuditLog: false,
    canViewAllLogs: false,
    canAccessAdminPortal: false,
    canManageSettings: false,
  },
};

// ============================================
// USER TYPES
// ============================================

export interface PortalUser {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  pin?: string;
  tempPasscode?: string;
  tempPasscodeExpiry?: string;
  status: 'active' | 'inactive' | 'locked';
  lastLogin?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  failedAttempts: number;
  lockoutUntil?: string;
}

export interface AuditLogEntry {
  logId: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type WorkflowType = 'restock' | 'count_approval' | 'order' | 'delivery';

export interface WorkflowStep {
  workflowId: string;
  stepId: string;
  workflowType: WorkflowType;
  resourceId: string;
  title: string;
  description?: string;
  stepOrder: number;
  stepName: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy: string;
  assignedTo?: string;
  assignedRole?: UserRole;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
  dueDate?: string;
  createdAt: string;
  data?: Record<string, unknown>;
}

// ============================================
// PORTAL AUTH SERVICE
// ============================================

class PortalAuthService {
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

  private generateTempPasscode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  async getUsers(): Promise<PortalUser[]> {
    const sheet = await this.getOrCreateSheet('Portal Users', [
      'userId', 'name', 'email', 'phone', 'role', 'pin', 'tempPasscode',
      'tempPasscodeExpiry', 'status', 'lastLogin', 'createdAt', 'createdBy',
      'updatedAt', 'failedAttempts', 'lockoutUntil'
    ]);

    const rows = await sheet.getRows();
    return rows.map(row => ({
      userId: row.get('userId'),
      name: row.get('name'),
      email: row.get('email'),
      phone: row.get('phone'),
      role: row.get('role') as UserRole,
      pin: row.get('pin'),
      tempPasscode: row.get('tempPasscode'),
      tempPasscodeExpiry: row.get('tempPasscodeExpiry'),
      status: row.get('status') as PortalUser['status'],
      lastLogin: row.get('lastLogin'),
      createdAt: row.get('createdAt'),
      createdBy: row.get('createdBy'),
      updatedAt: row.get('updatedAt'),
      failedAttempts: parseInt(row.get('failedAttempts')) || 0,
      lockoutUntil: row.get('lockoutUntil'),
    }));
  }

  async getUserById(userId: string): Promise<PortalUser | null> {
    const users = await this.getUsers();
    return users.find(u => u.userId === userId) || null;
  }

  async getUserByEmail(email: string): Promise<PortalUser | null> {
    const users = await this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async createUser(data: {
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    createdBy: string;
  }): Promise<{ user: PortalUser; tempPasscode: string }> {
    const sheet = await this.getOrCreateSheet('Portal Users', []);

    const tempPasscode = this.generateTempPasscode();
    const tempPasscodeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const user: PortalUser = {
      userId: this.generateId('USR'),
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      pin: this.generatePin(),
      tempPasscode,
      tempPasscodeExpiry,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy,
      failedAttempts: 0,
    };

    await sheet.addRow(user as unknown as Record<string, string | number | boolean>);

    await this.logAction({
      userId: data.createdBy,
      userName: 'System',
      action: 'CREATE_USER',
      resource: 'users',
      resourceId: user.userId,
      details: `Created user ${user.name} with role ${user.role}`,
    });

    return { user, tempPasscode };
  }

  async updateUser(userId: string, updates: Partial<PortalUser>, updatedBy: string): Promise<void> {
    const sheet = await this.getOrCreateSheet('Portal Users', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('userId') === userId);

    if (row) {
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          row.set(key, String(value));
        }
      });
      row.set('updatedAt', new Date().toISOString());
      await row.save();

      await this.logAction({
        userId: updatedBy,
        userName: 'System',
        action: 'UPDATE_USER',
        resource: 'users',
        resourceId: userId,
        details: `Updated fields: ${Object.keys(updates).join(', ')}`,
      });
    }
  }

  async generateNewTempPasscode(userId: string, generatedBy: string): Promise<string> {
    const tempPasscode = this.generateTempPasscode();
    const tempPasscodeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await this.updateUser(userId, { tempPasscode, tempPasscodeExpiry }, generatedBy);

    await this.logAction({
      userId: generatedBy,
      userName: 'System',
      action: 'GENERATE_TEMP_PASSCODE',
      resource: 'users',
      resourceId: userId,
      details: 'Generated new temporary passcode',
    });

    return tempPasscode;
  }

  async resetPin(userId: string, resetBy: string): Promise<string> {
    const newPin = this.generatePin();
    await this.updateUser(userId, { pin: newPin, failedAttempts: 0, lockoutUntil: '' }, resetBy);

    await this.logAction({
      userId: resetBy,
      userName: 'System',
      action: 'RESET_PIN',
      resource: 'users',
      resourceId: userId,
      details: 'PIN was reset',
    });

    return newPin;
  }

  // ============================================
  // AUTHENTICATION
  // ============================================

  async authenticateByPin(pin: string): Promise<{ success: boolean; user?: PortalUser; error?: string }> {
    const users = await this.getUsers();
    const user = users.find(u => u.pin === pin && u.status === 'active');

    if (!user) {
      return { success: false, error: 'Invalid PIN' };
    }

    // Check lockout
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      const remaining = Math.ceil((new Date(user.lockoutUntil).getTime() - Date.now()) / 60000);
      return { success: false, error: `Account locked. Try again in ${remaining} minutes.` };
    }

    // Update last login
    await this.updateUser(user.userId, {
      lastLogin: new Date().toISOString(),
      failedAttempts: 0,
      lockoutUntil: '',
    }, user.userId);

    await this.logAction({
      userId: user.userId,
      userName: user.name,
      action: 'LOGIN',
      resource: 'auth',
      details: 'Successful PIN login',
    });

    return { success: true, user };
  }

  async authenticateByTempPasscode(email: string, passcode: string): Promise<{ success: boolean; user?: PortalUser; error?: string }> {
    const user = await this.getUserByEmail(email);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.status !== 'active') {
      return { success: false, error: 'Account is not active' };
    }

    if (user.tempPasscode !== passcode) {
      // Increment failed attempts
      const failedAttempts = user.failedAttempts + 1;
      const updates: Partial<PortalUser> = { failedAttempts };

      if (failedAttempts >= 5) {
        updates.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min lockout
        updates.status = 'locked';
      }

      await this.updateUser(user.userId, updates, 'system');
      return { success: false, error: 'Invalid passcode' };
    }

    // Check expiry
    if (user.tempPasscodeExpiry && new Date(user.tempPasscodeExpiry) < new Date()) {
      return { success: false, error: 'Passcode has expired' };
    }

    // Clear temp passcode after use
    await this.updateUser(user.userId, {
      tempPasscode: '',
      tempPasscodeExpiry: '',
      lastLogin: new Date().toISOString(),
      failedAttempts: 0,
    }, user.userId);

    await this.logAction({
      userId: user.userId,
      userName: user.name,
      action: 'LOGIN',
      resource: 'auth',
      details: 'Successful temp passcode login',
    });

    return { success: true, user };
  }

  async recordFailedAttempt(identifier: string): Promise<void> {
    await this.logAction({
      userId: 'unknown',
      userName: 'Unknown',
      action: 'FAILED_LOGIN',
      resource: 'auth',
      details: `Failed login attempt for: ${identifier}`,
    });
  }

  // ============================================
  // AUTHORIZATION
  // ============================================

  getPermissions(role: UserRole): RolePermissions {
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
  }

  hasPermission(user: PortalUser, permission: keyof RolePermissions): boolean {
    const permissions = this.getPermissions(user.role);
    return permissions[permission] === true;
  }

  // ============================================
  // AUDIT LOG
  // ============================================

  async logAction(data: Omit<AuditLogEntry, 'logId' | 'timestamp'>): Promise<void> {
    const sheet = await this.getOrCreateSheet('Audit Log', [
      'logId', 'timestamp', 'userId', 'userName', 'action', 'resource',
      'resourceId', 'details', 'ipAddress', 'userAgent'
    ]);

    const entry: AuditLogEntry = {
      ...data,
      logId: this.generateId('LOG'),
      timestamp: new Date().toISOString(),
    };

    await sheet.addRow(entry as unknown as Record<string, string | number | boolean>);
  }

  async getAuditLog(filters?: {
    userId?: string;
    action?: string;
    resource?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    const sheet = await this.getOrCreateSheet('Audit Log', []);
    const rows = await sheet.getRows();

    let entries = rows.map(row => ({
      logId: row.get('logId'),
      timestamp: row.get('timestamp'),
      userId: row.get('userId'),
      userName: row.get('userName'),
      action: row.get('action'),
      resource: row.get('resource'),
      resourceId: row.get('resourceId'),
      details: row.get('details'),
      ipAddress: row.get('ipAddress'),
      userAgent: row.get('userAgent'),
    }));

    if (filters) {
      if (filters.userId) {
        entries = entries.filter(e => e.userId === filters.userId);
      }
      if (filters.action) {
        entries = entries.filter(e => e.action === filters.action);
      }
      if (filters.resource) {
        entries = entries.filter(e => e.resource === filters.resource);
      }
      if (filters.fromDate) {
        entries = entries.filter(e => e.timestamp >= filters.fromDate!);
      }
      if (filters.toDate) {
        entries = entries.filter(e => e.timestamp <= filters.toDate!);
      }
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      entries = entries.slice(0, filters.limit);
    }

    return entries;
  }

  // ============================================
  // WORKFLOW MANAGEMENT
  // ============================================

  private getWorkflowHeaders() {
    return [
      'workflowId', 'stepId', 'workflowType', 'resourceId', 'title', 'description',
      'stepOrder', 'stepName', 'status', 'requestedBy', 'assignedTo', 'assignedRole',
      'completedBy', 'completedAt', 'notes', 'dueDate', 'createdAt', 'data'
    ];
  }

  async createWorkflow(data: {
    type: WorkflowType;
    referenceId: string;
    title: string;
    description?: string;
    requestedBy: string;
    data?: Record<string, unknown>;
  }): Promise<WorkflowStep> {
    const sheet = await this.getOrCreateSheet('Workflows', this.getWorkflowHeaders());

    const workflowId = this.generateId('WF');

    // Determine approval role based on workflow type
    let assignedRole: UserRole = 'manager';
    if (data.type === 'restock') assignedRole = 'manager';
    if (data.type === 'count_approval') assignedRole = 'manager';
    if (data.type === 'order') assignedRole = 'owner';
    if (data.type === 'delivery') assignedRole = 'manager';

    const workflow: WorkflowStep = {
      workflowId,
      stepId: this.generateId('STEP'),
      workflowType: data.type,
      resourceId: data.referenceId,
      title: data.title,
      description: data.description,
      stepOrder: 1,
      stepName: 'Pending Approval',
      status: 'pending',
      requestedBy: data.requestedBy,
      assignedRole,
      createdAt: new Date().toISOString(),
      data: data.data,
    };

    await sheet.addRow({
      ...workflow,
      data: JSON.stringify(workflow.data || {}),
    } as unknown as Record<string, string | number | boolean>);

    await this.logAction({
      userId: data.requestedBy,
      userName: 'System',
      action: 'CREATE_WORKFLOW',
      resource: 'workflows',
      resourceId: workflowId,
      details: `Created ${data.type} workflow: ${data.title}`,
    });

    return workflow;
  }

  async getWorkflowById(workflowId: string): Promise<WorkflowStep | null> {
    const sheet = await this.getOrCreateSheet('Workflows', this.getWorkflowHeaders());
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('workflowId') === workflowId);

    if (!row) return null;

    return this.rowToWorkflow(row);
  }

  private rowToWorkflow(row: any): WorkflowStep {
    let data = {};
    try {
      data = JSON.parse(row.get('data') || '{}');
    } catch {}

    return {
      workflowId: row.get('workflowId'),
      stepId: row.get('stepId'),
      workflowType: row.get('workflowType') as WorkflowType,
      resourceId: row.get('resourceId'),
      title: row.get('title'),
      description: row.get('description'),
      stepOrder: parseInt(row.get('stepOrder')) || 1,
      stepName: row.get('stepName'),
      status: row.get('status') as WorkflowStep['status'],
      requestedBy: row.get('requestedBy'),
      assignedTo: row.get('assignedTo'),
      assignedRole: row.get('assignedRole') as UserRole,
      completedBy: row.get('completedBy'),
      completedAt: row.get('completedAt'),
      notes: row.get('notes'),
      dueDate: row.get('dueDate'),
      createdAt: row.get('createdAt'),
      data,
    };
  }

  async getWorkflowsByType(type: WorkflowType): Promise<WorkflowStep[]> {
    const sheet = await this.getOrCreateSheet('Workflows', this.getWorkflowHeaders());
    const rows = await sheet.getRows();

    return rows
      .filter(row => row.get('workflowType') === type)
      .map(row => this.rowToWorkflow(row))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getWorkflowSteps(resourceId: string): Promise<WorkflowStep[]> {
    const sheet = await this.getOrCreateSheet('Workflows', this.getWorkflowHeaders());
    const rows = await sheet.getRows();

    return rows
      .filter(row => row.get('resourceId') === resourceId)
      .map(row => this.rowToWorkflow(row))
      .sort((a, b) => a.stepOrder - b.stepOrder);
  }

  async completeWorkflowStep(
    workflowId: string,
    completedBy: string,
    status: 'approved' | 'rejected',
    notes?: string
  ): Promise<{ success: boolean; workflow?: WorkflowStep; error?: string }> {
    const sheet = await this.getOrCreateSheet('Workflows', this.getWorkflowHeaders());
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('workflowId') === workflowId);

    if (!row) {
      return { success: false, error: 'Workflow not found' };
    }

    if (row.get('status') !== 'pending') {
      return { success: false, error: 'Workflow is not pending' };
    }

    row.set('status', status);
    row.set('completedBy', completedBy);
    row.set('completedAt', new Date().toISOString());
    row.set('stepName', status === 'approved' ? 'Approved' : 'Rejected');
    if (notes) row.set('notes', notes);
    await row.save();

    await this.logAction({
      userId: completedBy,
      userName: 'System',
      action: status === 'approved' ? 'APPROVE_WORKFLOW' : 'REJECT_WORKFLOW',
      resource: 'workflows',
      resourceId: workflowId,
      details: notes || `Workflow ${status}`,
    });

    return { success: true, workflow: this.rowToWorkflow(row) };
  }

  async cancelWorkflow(
    workflowId: string,
    cancelledBy: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const sheet = await this.getOrCreateSheet('Workflows', this.getWorkflowHeaders());
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('workflowId') === workflowId);

    if (!row) {
      return { success: false, error: 'Workflow not found' };
    }

    if (row.get('status') !== 'pending') {
      return { success: false, error: 'Only pending workflows can be cancelled' };
    }

    row.set('status', 'cancelled');
    row.set('completedBy', cancelledBy);
    row.set('completedAt', new Date().toISOString());
    row.set('stepName', 'Cancelled');
    if (reason) row.set('notes', reason);
    await row.save();

    await this.logAction({
      userId: cancelledBy,
      userName: 'System',
      action: 'CANCEL_WORKFLOW',
      resource: 'workflows',
      resourceId: workflowId,
      details: reason || 'Workflow cancelled',
    });

    return { success: true };
  }

  async getPendingApprovals(role: UserRole): Promise<WorkflowStep[]> {
    const sheet = await this.getOrCreateSheet('Workflows', this.getWorkflowHeaders());
    const rows = await sheet.getRows();

    // Get role hierarchy for approval permissions
    const canApproveRoles: Record<UserRole, UserRole[]> = {
      owner: ['owner', 'manager', 'project_manager', 'driver', 'viewer'],
      manager: ['manager', 'project_manager'],
      project_manager: [],
      driver: [],
      viewer: [],
    };

    const approvableRoles = canApproveRoles[role] || [];

    return rows
      .filter(row => {
        if (row.get('status') !== 'pending') return false;
        const assignedRole = row.get('assignedRole') as UserRole;
        return approvableRoles.includes(assignedRole);
      })
      .map(row => this.rowToWorkflow(row))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllWorkflows(filters?: {
    status?: WorkflowStep['status'];
    type?: WorkflowType;
    limit?: number;
  }): Promise<WorkflowStep[]> {
    const sheet = await this.getOrCreateSheet('Workflows', this.getWorkflowHeaders());
    const rows = await sheet.getRows();

    let workflows = rows.map(row => this.rowToWorkflow(row));

    if (filters?.status) {
      workflows = workflows.filter(w => w.status === filters.status);
    }
    if (filters?.type) {
      workflows = workflows.filter(w => w.workflowType === filters.type);
    }

    workflows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.limit) {
      workflows = workflows.slice(0, filters.limit);
    }

    return workflows;
  }
}

export const portalAuthService = new PortalAuthService();
