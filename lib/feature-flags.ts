/**
 * Feature Flags System
 *
 * Provides environment-aware feature toggles, maintenance mode control,
 * and production lock capabilities.
 */

// Environment modes
export type EnvironmentMode = 'development' | 'staging' | 'production';

// Feature flag definitions
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  requiresApproval: boolean;
  category: 'core' | 'admin' | 'api' | 'experimental';
  rolloutPercentage?: number;
  enabledEnvironments: EnvironmentMode[];
}

// System configuration interface
export interface SystemConfig {
  environment: EnvironmentMode;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceEndTime?: string;
  allowedIPs?: string[];
  features: Record<string, FeatureFlag>;
  apiKeys: ApiKeyConfig[];
  auditLogEnabled: boolean;
  lastUpdated: string;
  lastUpdatedBy: string;
}

// API Key configuration
export interface ApiKeyConfig {
  id: string;
  name: string;
  keyHash: string;
  lastFourChars: string;
  permissions: string[];
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  userId: string;
  userEmail?: string;
  ipAddress?: string;
  details: Record<string, unknown>;
  environment: EnvironmentMode;
}

// Default feature flags
export const DEFAULT_FEATURES: Record<string, FeatureFlag> = {
  'customer-portal': {
    id: 'customer-portal',
    name: 'Customer Portal',
    description: 'Customer-facing portal for viewing project status and documents',
    enabled: true,
    requiresApproval: false,
    category: 'core',
    enabledEnvironments: ['development', 'staging', 'production'],
  },
  'team-portal': {
    id: 'team-portal',
    name: 'Team Portal',
    description: 'Internal team portal for employees',
    enabled: true,
    requiresApproval: false,
    category: 'core',
    enabledEnvironments: ['development', 'staging', 'production'],
  },
  'command-center': {
    id: 'command-center',
    name: 'Command Center',
    description: 'Centralized operations dashboard',
    enabled: true,
    requiresApproval: false,
    category: 'admin',
    enabledEnvironments: ['development', 'staging', 'production'],
  },
  'jobnimbus-sync': {
    id: 'jobnimbus-sync',
    name: 'JobNimbus Sync',
    description: 'Real-time synchronization with JobNimbus CRM',
    enabled: true,
    requiresApproval: true,
    category: 'api',
    enabledEnvironments: ['development', 'staging', 'production'],
  },
  'inventory-management': {
    id: 'inventory-management',
    name: 'Inventory Management',
    description: 'Material and inventory tracking system',
    enabled: true,
    requiresApproval: false,
    category: 'core',
    enabledEnvironments: ['development', 'staging', 'production'],
  },
  'commissions-tracking': {
    id: 'commissions-tracking',
    name: 'Commissions Tracking',
    description: 'Sales commissions calculation and tracking',
    enabled: true,
    requiresApproval: true,
    category: 'core',
    enabledEnvironments: ['development', 'staging', 'production'],
  },
  'marketing-dashboard': {
    id: 'marketing-dashboard',
    name: 'Marketing Dashboard',
    description: 'Marketing campaign and lead tracking',
    enabled: true,
    requiresApproval: false,
    category: 'admin',
    enabledEnvironments: ['development', 'staging', 'production'],
  },
  'blog-management': {
    id: 'blog-management',
    name: 'Blog Management',
    description: 'Blog post creation and editing',
    enabled: true,
    requiresApproval: false,
    category: 'admin',
    enabledEnvironments: ['development', 'staging', 'production'],
  },
  'profile-approval': {
    id: 'profile-approval',
    name: 'Profile Approval Workflow',
    description: 'Team member profile change approval system',
    enabled: true,
    requiresApproval: true,
    category: 'admin',
    enabledEnvironments: ['development', 'staging', 'production'],
  },
  'route-optimization': {
    id: 'route-optimization',
    name: 'Route Optimization',
    description: 'Delivery and service route optimization',
    enabled: true,
    requiresApproval: false,
    category: 'experimental',
    enabledEnvironments: ['development', 'staging'],
  },
  'voice-notifications': {
    id: 'voice-notifications',
    name: 'Voice Notifications',
    description: 'Automated voice call notifications',
    enabled: false,
    requiresApproval: true,
    category: 'experimental',
    enabledEnvironments: ['development'],
  },
  'ai-chat-support': {
    id: 'ai-chat-support',
    name: 'AI Chat Support',
    description: 'AI-powered customer chat support',
    enabled: false,
    requiresApproval: true,
    category: 'experimental',
    enabledEnvironments: ['development'],
  },
};

// Get current environment
export function getEnvironment(): EnvironmentMode {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'staging';
  return 'development';
}

// Check if in production mode
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

// Check if in development mode
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

// Check if in staging mode
export function isStaging(): boolean {
  return getEnvironment() === 'staging';
}

// Get maintenance mode status from environment
export function isMaintenanceModeEnabled(): boolean {
  return process.env.MAINTENANCE_MODE === 'true';
}

// Parse feature flags from environment variable
export function parseFeatureFlagsFromEnv(): Partial<Record<string, boolean>> {
  const flagsEnv = process.env.FEATURE_FLAGS;
  if (!flagsEnv) return {};

  try {
    return JSON.parse(flagsEnv);
  } catch {
    console.error('Failed to parse FEATURE_FLAGS environment variable');
    return {};
  }
}

// Check if a feature is enabled
export function isFeatureEnabled(featureId: string): boolean {
  const environment = getEnvironment();

  // Check environment variable override first
  const envFlags = parseFeatureFlagsFromEnv();
  if (featureId in envFlags) {
    return envFlags[featureId] === true;
  }

  // Check default features
  const feature = DEFAULT_FEATURES[featureId];
  if (!feature) return false;

  // Check if enabled for current environment
  if (!feature.enabledEnvironments.includes(environment)) {
    return false;
  }

  return feature.enabled;
}

// Check if action requires approval in current environment
export function requiresApproval(featureId: string): boolean {
  const environment = getEnvironment();

  // Only require approval in production
  if (environment !== 'production') return false;

  const feature = DEFAULT_FEATURES[featureId];
  return feature?.requiresApproval ?? false;
}

// Get all features with their current status
export function getAllFeatures(): FeatureFlag[] {
  const environment = getEnvironment();
  const envFlags = parseFeatureFlagsFromEnv();

  return Object.values(DEFAULT_FEATURES).map(feature => ({
    ...feature,
    enabled: (feature.id in envFlags)
      ? envFlags[feature.id] === true
      : (feature.enabled && feature.enabledEnvironments.includes(environment)),
  }));
}

// Get features by category
export function getFeaturesByCategory(category: FeatureFlag['category']): FeatureFlag[] {
  return getAllFeatures().filter(f => f.category === category);
}

// Environment badge configuration
export interface EnvironmentBadge {
  mode: EnvironmentMode;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function getEnvironmentBadge(): EnvironmentBadge {
  const environment = getEnvironment();

  switch (environment) {
    case 'production':
      return {
        mode: 'production',
        label: 'PRODUCTION',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300',
      };
    case 'staging':
      return {
        mode: 'staging',
        label: 'STAGING',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-300',
      };
    default:
      return {
        mode: 'development',
        label: 'DEVELOPMENT',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-300',
      };
  }
}

// Generate a simple hash for API keys (for display purposes only)
export function hashApiKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// Create audit log entry
export function createAuditLogEntry(
  action: string,
  resource: string,
  userId: string,
  details: Record<string, unknown> = {},
  userEmail?: string,
  ipAddress?: string
): AuditLogEntry {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId,
    userEmail,
    ipAddress,
    details,
    environment: getEnvironment(),
  };
}

// Validate environment for destructive operations
export function canPerformDestructiveOperation(): boolean {
  const environment = getEnvironment();
  // Allow destructive operations only in development
  // Staging and production require additional confirmation
  return environment === 'development';
}

// Get system status summary
export interface SystemStatus {
  environment: EnvironmentMode;
  maintenanceMode: boolean;
  featuresEnabled: number;
  featuresTotal: number;
  apiKeysActive: number;
  lastDeployment?: string;
  version: string;
}

export function getSystemStatus(): SystemStatus {
  const features = getAllFeatures();
  const enabledFeatures = features.filter(f => isFeatureEnabled(f.id));

  return {
    environment: getEnvironment(),
    maintenanceMode: isMaintenanceModeEnabled(),
    featuresEnabled: enabledFeatures.length,
    featuresTotal: features.length,
    apiKeysActive: 0, // Will be populated from config
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  };
}
