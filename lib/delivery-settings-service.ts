// Delivery Settings Service for River City Roofing Solutions
// Centralized settings management for the entire delivery ecosystem:
// AI agent configuration, notifications, workflow rules, IoT, inventory, and access control.

// ============================================
// TYPES
// ============================================

export interface AIAgentSettings {
  agentName: string;
  agentPersonality: 'professional' | 'friendly' | 'concise';
  ttsEnabled: boolean;
  ttsVoice: string;
  ttsSpeed: number;
  autoGreeting: boolean;
  autoCoaching: boolean;
  autoReminders: boolean;
  reminderLeadTime: number;
  safetyTipsEnabled: boolean;
  conversationTopicsEnabled: boolean;
  maxQAConfidence: number;
  trainingInstructions: string;
  customQA: Array<{ question: string; answer: string }>;
}

export interface NotificationSettings {
  statusNotifications: Record<string, {
    notifyDriver: boolean;
    notifyCustomer: boolean;
    notifyOffice: boolean;
    notifyPM: boolean;
  }>;
  escalationEnabled: boolean;
  escalationTimeout: number;
  overdueAlertEnabled: boolean;
  overdueThreshold: number;
}

export interface WorkflowSettings {
  requirePhotoAtStatus: Record<string, boolean>;
  requireSignature: boolean;
  autoAdvanceStatus: boolean;
  allowSkipStatus: boolean;
  maxDeliveriesPerDriver: number;
  defaultPriority: 'normal' | 'rush' | 'urgent';
  weatherDelayAutomatic: boolean;
  weatherDelayThreshold: 'minor' | 'moderate' | 'severe';
}

export interface WarehouseIoTSettings {
  iotEnabled: boolean;
  haBaseUrl: string;
  lightsEnabled: boolean;
  doorsEnabled: boolean;
  displayEnabled: boolean;
  speakerEnabled: boolean;
  autoLightsOnStatus: boolean;
  autoAnnounce: boolean;
  dashboardRefreshInterval: number;
}

export interface InventorySettings {
  lowStockAlertEnabled: boolean;
  lowStockEmailRecipients: string[];
  autoRestockSuggestions: boolean;
  weeklyCountDay: string;
  weeklyCountReminder: boolean;
  pricingVerificationFrequency: 'daily' | 'weekly' | 'monthly';
}

export interface AccessControlSettings {
  roles: Record<string, string[]>;
}

export interface AllDeliverySettings {
  ai: AIAgentSettings;
  notifications: NotificationSettings;
  workflow: WorkflowSettings;
  warehouse: WarehouseIoTSettings;
  inventory: InventorySettings;
  access: AccessControlSettings;
}

export type SettingsCategory = keyof AllDeliverySettings;

// All available permissions in the system
export const ALL_PERMISSIONS = [
  'view_orders',
  'create_orders',
  'approve_orders',
  'assign_drivers',
  'manage_inventory',
  'manage_pricing',
  'view_reports',
  'manage_settings',
  'manage_iot',
  'manage_ai',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

// All available roles
export const ALL_ROLES = ['admin', 'manager', 'office', 'driver', 'warehouse'] as const;
export type Role = typeof ALL_ROLES[number];

// Delivery statuses used in notification and workflow matrices
export const DELIVERY_STATUSES = [
  'assigned',
  'materials_pulled',
  'load_verified',
  'en_route',
  'arrived',
  'delivered',
  'proof_captured',
  'qc_photos',
  'completed',
  'cancelled',
] as const;

// ============================================
// DEFAULT SETTINGS
// ============================================

const DEFAULT_AI_SETTINGS: AIAgentSettings = {
  agentName: 'RCRS Assistant',
  agentPersonality: 'professional',
  ttsEnabled: true,
  ttsVoice: 'en-US-Standard-D',
  ttsSpeed: 1.0,
  autoGreeting: true,
  autoCoaching: true,
  autoReminders: true,
  reminderLeadTime: 15,
  safetyTipsEnabled: true,
  conversationTopicsEnabled: true,
  maxQAConfidence: 0.5,
  trainingInstructions: '',
  customQA: [],
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  statusNotifications: {
    assigned: { notifyDriver: true, notifyCustomer: true, notifyOffice: true, notifyPM: true },
    materials_pulled: { notifyDriver: true, notifyCustomer: false, notifyOffice: true, notifyPM: false },
    load_verified: { notifyDriver: true, notifyCustomer: false, notifyOffice: true, notifyPM: false },
    en_route: { notifyDriver: true, notifyCustomer: true, notifyOffice: true, notifyPM: true },
    arrived: { notifyDriver: false, notifyCustomer: true, notifyOffice: true, notifyPM: true },
    delivered: { notifyDriver: true, notifyCustomer: true, notifyOffice: true, notifyPM: true },
    proof_captured: { notifyDriver: false, notifyCustomer: false, notifyOffice: true, notifyPM: true },
    qc_photos: { notifyDriver: false, notifyCustomer: false, notifyOffice: true, notifyPM: true },
    completed: { notifyDriver: true, notifyCustomer: false, notifyOffice: true, notifyPM: true },
    cancelled: { notifyDriver: true, notifyCustomer: true, notifyOffice: true, notifyPM: true },
  },
  escalationEnabled: true,
  escalationTimeout: 60,
  overdueAlertEnabled: true,
  overdueThreshold: 4,
};

const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  requirePhotoAtStatus: {
    assigned: false,
    materials_pulled: false,
    load_verified: true,
    en_route: false,
    arrived: false,
    delivered: true,
    proof_captured: true,
    qc_photos: true,
    completed: false,
    cancelled: false,
  },
  requireSignature: true,
  autoAdvanceStatus: false,
  allowSkipStatus: false,
  maxDeliveriesPerDriver: 8,
  defaultPriority: 'normal',
  weatherDelayAutomatic: false,
  weatherDelayThreshold: 'moderate',
};

const DEFAULT_WAREHOUSE_SETTINGS: WarehouseIoTSettings = {
  iotEnabled: true,
  haBaseUrl: 'http://192.168.86.102:8123',
  lightsEnabled: true,
  doorsEnabled: true,
  displayEnabled: true,
  speakerEnabled: true,
  autoLightsOnStatus: true,
  autoAnnounce: true,
  dashboardRefreshInterval: 30,
};

const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  lowStockAlertEnabled: true,
  lowStockEmailRecipients: ['rcrs@rivercityroofingsolutions.com'],
  autoRestockSuggestions: true,
  weeklyCountDay: 'Friday',
  weeklyCountReminder: true,
  pricingVerificationFrequency: 'weekly',
};

const DEFAULT_ACCESS_SETTINGS: AccessControlSettings = {
  roles: {
    admin: [
      'view_orders', 'create_orders', 'approve_orders', 'assign_drivers',
      'manage_inventory', 'manage_pricing', 'view_reports',
      'manage_settings', 'manage_iot', 'manage_ai',
    ],
    manager: [
      'view_orders', 'create_orders', 'approve_orders', 'assign_drivers',
      'manage_inventory', 'view_reports', 'manage_ai',
    ],
    office: [
      'view_orders', 'create_orders', 'assign_drivers',
      'manage_inventory', 'view_reports',
    ],
    driver: [
      'view_orders',
    ],
    warehouse: [
      'view_orders', 'manage_inventory',
    ],
  },
};

// ============================================
// SERVICE CLASS
// ============================================

export class DeliverySettingsService {
  private settings: AllDeliverySettings;

  constructor() {
    this.settings = this.getDefaults();
  }

  // ------------------------------------------
  // Get Settings
  // ------------------------------------------

  getSettings(): AllDeliverySettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  getSettingsByCategory<K extends SettingsCategory>(category: K): AllDeliverySettings[K] {
    return JSON.parse(JSON.stringify(this.settings[category]));
  }

  // ------------------------------------------
  // Update Settings
  // ------------------------------------------

  updateSettings<K extends SettingsCategory>(
    category: K,
    updates: Partial<AllDeliverySettings[K]>
  ): { success: boolean; errors: string[] } {
    const errors = this.validatePartialSettings(category, updates);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.settings as any)[category] = {
      ...(this.settings[category] as object),
      ...(updates as object),
    };

    return { success: true, errors: [] };
  }

  // ------------------------------------------
  // Reset to Defaults
  // ------------------------------------------

  resetToDefaults(category?: SettingsCategory): AllDeliverySettings {
    if (category) {
      const defaults = this.getDefaults();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.settings as any)[category] = defaults[category];
    } else {
      this.settings = this.getDefaults();
    }
    return this.getSettings();
  }

  // ------------------------------------------
  // Validate Settings
  // ------------------------------------------

  validateSettings(settings: Partial<AllDeliverySettings>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.ai) {
      errors.push(...this.validatePartialSettings('ai', settings.ai));
    }
    if (settings.notifications) {
      errors.push(...this.validatePartialSettings('notifications', settings.notifications));
    }
    if (settings.workflow) {
      errors.push(...this.validatePartialSettings('workflow', settings.workflow));
    }
    if (settings.warehouse) {
      errors.push(...this.validatePartialSettings('warehouse', settings.warehouse));
    }
    if (settings.inventory) {
      errors.push(...this.validatePartialSettings('inventory', settings.inventory));
    }
    if (settings.access) {
      errors.push(...this.validatePartialSettings('access', settings.access));
    }

    return { valid: errors.length === 0, errors };
  }

  private validatePartialSettings<K extends SettingsCategory>(
    category: K,
    updates: Partial<AllDeliverySettings[K]>
  ): string[] {
    const errors: string[] = [];

    if (category === 'ai') {
      const ai = updates as Partial<AIAgentSettings>;
      if (ai.agentName !== undefined && ai.agentName.trim().length === 0) {
        errors.push('Agent name cannot be empty.');
      }
      if (ai.agentPersonality !== undefined && !['professional', 'friendly', 'concise'].includes(ai.agentPersonality)) {
        errors.push('Invalid agent personality. Must be professional, friendly, or concise.');
      }
      if (ai.ttsSpeed !== undefined && (ai.ttsSpeed < 0.5 || ai.ttsSpeed > 2.0)) {
        errors.push('TTS speed must be between 0.5 and 2.0.');
      }
      if (ai.reminderLeadTime !== undefined && (ai.reminderLeadTime < 5 || ai.reminderLeadTime > 60)) {
        errors.push('Reminder lead time must be between 5 and 60 minutes.');
      }
      if (ai.maxQAConfidence !== undefined && (ai.maxQAConfidence < 0 || ai.maxQAConfidence > 1)) {
        errors.push('Q&A confidence threshold must be between 0 and 1.');
      }
    }

    if (category === 'notifications') {
      const notif = updates as Partial<NotificationSettings>;
      if (notif.escalationTimeout !== undefined && (notif.escalationTimeout < 5 || notif.escalationTimeout > 480)) {
        errors.push('Escalation timeout must be between 5 and 480 minutes.');
      }
      if (notif.overdueThreshold !== undefined && (notif.overdueThreshold < 1 || notif.overdueThreshold > 48)) {
        errors.push('Overdue threshold must be between 1 and 48 hours.');
      }
    }

    if (category === 'workflow') {
      const wf = updates as Partial<WorkflowSettings>;
      if (wf.maxDeliveriesPerDriver !== undefined && (wf.maxDeliveriesPerDriver < 1 || wf.maxDeliveriesPerDriver > 20)) {
        errors.push('Max deliveries per driver must be between 1 and 20.');
      }
      if (wf.defaultPriority !== undefined && !['normal', 'rush', 'urgent'].includes(wf.defaultPriority)) {
        errors.push('Invalid default priority.');
      }
      if (wf.weatherDelayThreshold !== undefined && !['minor', 'moderate', 'severe'].includes(wf.weatherDelayThreshold)) {
        errors.push('Invalid weather delay threshold.');
      }
    }

    if (category === 'warehouse') {
      const wh = updates as Partial<WarehouseIoTSettings>;
      if (wh.haBaseUrl !== undefined && wh.haBaseUrl.trim().length === 0) {
        errors.push('HA base URL cannot be empty when provided.');
      }
      if (wh.dashboardRefreshInterval !== undefined && (wh.dashboardRefreshInterval < 5 || wh.dashboardRefreshInterval > 300)) {
        errors.push('Dashboard refresh interval must be between 5 and 300 seconds.');
      }
    }

    if (category === 'inventory') {
      const inv = updates as Partial<InventorySettings>;
      if (inv.pricingVerificationFrequency !== undefined && !['daily', 'weekly', 'monthly'].includes(inv.pricingVerificationFrequency)) {
        errors.push('Invalid pricing verification frequency.');
      }
      if (inv.weeklyCountDay !== undefined) {
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        if (!validDays.includes(inv.weeklyCountDay)) {
          errors.push('Invalid weekly count day.');
        }
      }
    }

    return errors;
  }

  // ------------------------------------------
  // Access Control Helpers
  // ------------------------------------------

  getPermissions(role: string): string[] {
    return this.settings.access.roles[role] || [];
  }

  hasPermission(role: string, permission: string): boolean {
    const perms = this.getPermissions(role);
    return perms.includes(permission);
  }

  // ------------------------------------------
  // Export / Import
  // ------------------------------------------

  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  importSettings(json: string): { success: boolean; errors: string[] } {
    try {
      const parsed = JSON.parse(json) as Partial<AllDeliverySettings>;
      const validation = this.validateSettings(parsed);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      // Merge imported settings with defaults to ensure all fields exist
      const defaults = this.getDefaults();
      if (parsed.ai) this.settings.ai = { ...defaults.ai, ...parsed.ai };
      if (parsed.notifications) this.settings.notifications = { ...defaults.notifications, ...parsed.notifications };
      if (parsed.workflow) this.settings.workflow = { ...defaults.workflow, ...parsed.workflow };
      if (parsed.warehouse) this.settings.warehouse = { ...defaults.warehouse, ...parsed.warehouse };
      if (parsed.inventory) this.settings.inventory = { ...defaults.inventory, ...parsed.inventory };
      if (parsed.access) this.settings.access = { ...defaults.access, ...parsed.access };

      return { success: true, errors: [] };
    } catch {
      return { success: false, errors: ['Invalid JSON format.'] };
    }
  }

  // ------------------------------------------
  // Get Defaults
  // ------------------------------------------

  private getDefaults(): AllDeliverySettings {
    return {
      ai: { ...DEFAULT_AI_SETTINGS, customQA: [...DEFAULT_AI_SETTINGS.customQA] },
      notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        statusNotifications: JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS.statusNotifications)),
      },
      workflow: {
        ...DEFAULT_WORKFLOW_SETTINGS,
        requirePhotoAtStatus: { ...DEFAULT_WORKFLOW_SETTINGS.requirePhotoAtStatus },
      },
      warehouse: { ...DEFAULT_WAREHOUSE_SETTINGS },
      inventory: {
        ...DEFAULT_INVENTORY_SETTINGS,
        lowStockEmailRecipients: [...DEFAULT_INVENTORY_SETTINGS.lowStockEmailRecipients],
      },
      access: {
        roles: JSON.parse(JSON.stringify(DEFAULT_ACCESS_SETTINGS.roles)),
      },
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const deliverySettingsService = new DeliverySettingsService();
