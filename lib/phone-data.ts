// ⚠️ PLACEHOLDER DATA — This file contains mock/demo data and is not used in production.
// It is kept temporarily to avoid breaking any residual imports. Safe to remove once all
// references are cleaned up.

/**
 * RCRS Command Center - Phone System Data
 *
 * This module contains all phone system configuration data including:
 * - Extension directory with user assignments
 * - Ring groups configuration
 * - Feature codes for phone system operations
 * - Helper functions for extension lookup
 *
 * Data sourced from FreePBX configuration at:
 * C:\Users\Michael\projects\freepbx-setup\config\extensions.conf
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Extension status for real-time display
 */
export type ExtensionStatus = 'online' | 'busy' | 'offline' | 'dnd' | 'ringing';

/**
 * Role within the phone system (maps to company roles)
 */
export type PhoneRole = 'Owner' | 'Admin' | 'Manager' | 'User';

/**
 * Extension configuration
 */
export interface Extension {
  /** Extension number (e.g., "101") */
  extension: string;
  /** Full name of the user */
  name: string;
  /** Email address */
  email: string;
  /** Role in the company */
  role: PhoneRole;
  /** Whether voicemail is enabled */
  voicemailEnabled: boolean;
  /** Static default status - real-time status comes from the calls-service API */
  status: ExtensionStatus;
  /** User ID for linking to team member data */
  userId?: string;
  /** Department/team assignment */
  department?: string;
}

/**
 * Ring group member with ring delay
 */
export interface RingGroupMember {
  /** Extension number */
  extension: string;
  /** Delay before this extension rings (seconds) */
  ringDelay: number;
}

/**
 * Ring group configuration
 */
export interface RingGroup {
  /** Ring group number */
  groupNumber: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Ring strategy */
  strategy: 'ringall' | 'hunt' | 'memoryhunt' | 'firstunavailable' | 'random';
  /** Members with their ring delays */
  members: RingGroupMember[];
  /** Ring timeout (seconds) */
  ringTimeout: number;
  /** Destination if no answer */
  failoverDestination?: string;
}

/**
 * Feature code definition
 */
export interface FeatureCode {
  /** Feature code to dial */
  code: string;
  /** Display name */
  name: string;
  /** Description of what it does */
  description: string;
  /** Category for grouping */
  category: 'voicemail' | 'forwarding' | 'dnd' | 'recording' | 'transfer' | 'misc';
}

// =============================================================================
// EXTENSION DATA
// =============================================================================

/**
 * Complete extension directory
 * Source: C:\Users\Michael\projects\freepbx-setup\config\extensions.conf
 */
export const EXTENSIONS: Extension[] = [
  // Owners
  {
    extension: '101',
    name: 'Michael Muse',
    email: 'michaelmuse@rivercityroofingsolutions.com',
    role: 'Owner',
    voicemailEnabled: true,
    status: 'online',
    userId: 'michael-muse',
    department: 'Executive',
  },
  {
    extension: '102',
    name: 'Chris Muse',
    email: 'chrismuse@rivercityroofingsolutions.com',
    role: 'Owner',
    voicemailEnabled: true,
    status: 'online',
    userId: 'chris-muse',
    department: 'Executive',
  },
  // Admin
  {
    extension: '103',
    name: 'Sara Hill',
    email: 'sara@rivercityroofingsolutions.com',
    role: 'Admin',
    voicemailEnabled: true,
    status: 'online',
    userId: 'sara-hill',
    department: 'Administration',
  },
  // Users
  {
    extension: '104',
    name: 'Tia',
    email: 'tia@rivercityroofingsolutions.com',
    role: 'User',
    voicemailEnabled: true,
    status: 'online',
    userId: 'tia',
    department: 'Office',
  },
  // Manager
  {
    extension: '105',
    name: 'Destin',
    email: 'destin@rivercityroofingsolutions.com',
    role: 'Manager',
    voicemailEnabled: true,
    status: 'online',
    userId: 'destin',
    department: 'Operations',
  },
  // Users
  {
    extension: '106',
    name: 'John',
    email: 'john@rivercityroofingsolutions.com',
    role: 'User',
    voicemailEnabled: true,
    status: 'offline',
    userId: 'john',
    department: 'Office',
  },
  {
    extension: '107',
    name: 'Bart',
    email: 'bart@rivercityroofingsolutions.com',
    role: 'User',
    voicemailEnabled: true,
    status: 'offline',
    userId: 'bart',
    department: 'Office',
  },
  {
    extension: '108',
    name: 'Boston',
    email: 'boston@rivercityroofingsolutions.com',
    role: 'User',
    voicemailEnabled: true,
    status: 'offline',
    userId: 'boston',
    department: 'Office',
  },
];

// =============================================================================
// RING GROUP DATA
// =============================================================================

/**
 * Ring groups configuration
 * Main line routes to Sara, Tia, Destin first, then others after 5 seconds
 */
export const RING_GROUPS: RingGroup[] = [
  {
    groupNumber: '600',
    name: 'Main Line',
    description: 'Primary incoming call ring group for main company number',
    strategy: 'ringall',
    members: [
      // Primary - rings immediately
      { extension: '103', ringDelay: 0 }, // Sara Hill (Admin)
      { extension: '104', ringDelay: 0 }, // Tia
      { extension: '105', ringDelay: 0 }, // Destin (Manager)
      // Secondary - rings after 5 seconds
      { extension: '106', ringDelay: 5 }, // John
      { extension: '102', ringDelay: 5 }, // Chris Muse
      { extension: '107', ringDelay: 5 }, // Bart
      { extension: '108', ringDelay: 5 }, // Boston
    ],
    ringTimeout: 30,
    failoverDestination: 'voicemail:103', // Falls to Sara's voicemail
  },
];

// =============================================================================
// FEATURE CODES
// =============================================================================

/**
 * Phone system feature codes for common operations
 */
export const FEATURE_CODES: FeatureCode[] = [
  // Voicemail
  {
    code: '*97',
    name: 'Check Voicemail',
    description: 'Access your voicemail box',
    category: 'voicemail',
  },
  {
    code: '*98',
    name: 'Check Voicemail (Any)',
    description: 'Access any voicemail box (requires PIN)',
    category: 'voicemail',
  },
  // Call Forwarding
  {
    code: '*72',
    name: 'Forward All Calls',
    description: 'Forward all incoming calls to another number',
    category: 'forwarding',
  },
  {
    code: '*73',
    name: 'Cancel Forward',
    description: 'Cancel call forwarding',
    category: 'forwarding',
  },
  {
    code: '*90',
    name: 'Forward Busy',
    description: 'Forward calls when busy',
    category: 'forwarding',
  },
  {
    code: '*91',
    name: 'Cancel Forward Busy',
    description: 'Cancel forward when busy',
    category: 'forwarding',
  },
  {
    code: '*92',
    name: 'Forward No Answer',
    description: 'Forward calls when no answer',
    category: 'forwarding',
  },
  {
    code: '*93',
    name: 'Cancel Forward No Answer',
    description: 'Cancel forward when no answer',
    category: 'forwarding',
  },
  // Do Not Disturb
  {
    code: '*78',
    name: 'Enable DND',
    description: 'Enable Do Not Disturb - sends calls to voicemail',
    category: 'dnd',
  },
  {
    code: '*79',
    name: 'Disable DND',
    description: 'Disable Do Not Disturb',
    category: 'dnd',
  },
  // Call Recording
  {
    code: '*1',
    name: 'Record Call',
    description: 'Start recording current call (in-call feature)',
    category: 'recording',
  },
  // Transfer
  {
    code: '*2',
    name: 'Blind Transfer',
    description: 'Transfer call without announcement',
    category: 'transfer',
  },
  {
    code: '##',
    name: 'Attended Transfer',
    description: 'Transfer with announcement to recipient',
    category: 'transfer',
  },
  // Misc
  {
    code: '*60',
    name: 'Blacklist Last Caller',
    description: 'Add last caller to blacklist',
    category: 'misc',
  },
  {
    code: '*69',
    name: 'Call Return',
    description: 'Call back the last incoming caller',
    category: 'misc',
  },
  {
    code: '*65',
    name: 'Speak My Extension',
    description: 'Hear your extension number spoken',
    category: 'misc',
  },
];

/**
 * Main company phone number
 */
export const MAIN_DID = '256-515-4245';

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Format based on length
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return phone;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get extension by user ID
 *
 * @param userId - The user ID to look up
 * @returns Extension or undefined if not found
 */
export function getExtensionByUser(userId: string): Extension | undefined {
  return EXTENSIONS.find((ext) => ext.userId === userId);
}

/**
 * Get extension by extension number
 *
 * @param extensionNumber - The extension number to look up (e.g., "101")
 * @returns Extension or undefined if not found
 */
export function getExtensionByNumber(extensionNumber: string): Extension | undefined {
  return EXTENSIONS.find((ext) => ext.extension === extensionNumber);
}

/**
 * Get extension by email address
 *
 * @param email - The email address to look up
 * @returns Extension or undefined if not found
 */
export function getExtensionByEmail(email: string): Extension | undefined {
  return EXTENSIONS.find((ext) => ext.email.toLowerCase() === email.toLowerCase());
}

/**
 * Get all extensions in a ring group
 *
 * @param groupNumber - The ring group number
 * @returns Array of extensions with their ring delays
 */
export function getRingGroupExtensions(
  groupNumber: string
): Array<{ extension: Extension; ringDelay: number }> {
  const group = RING_GROUPS.find((rg) => rg.groupNumber === groupNumber);
  if (!group) return [];

  return group.members
    .map((member) => {
      const extension = getExtensionByNumber(member.extension);
      if (!extension) return null;
      return { extension, ringDelay: member.ringDelay };
    })
    .filter((item): item is { extension: Extension; ringDelay: number } => item !== null);
}

/**
 * Get extensions by department
 *
 * @param department - Department name
 * @returns Array of extensions in that department
 */
export function getExtensionsByDepartment(department: string): Extension[] {
  return EXTENSIONS.filter((ext) => ext.department === department);
}

/**
 * Get extensions by role
 *
 * @param role - Phone role
 * @returns Array of extensions with that role
 */
export function getExtensionsByRole(role: PhoneRole): Extension[] {
  return EXTENSIONS.filter((ext) => ext.role === role);
}

/**
 * Get feature codes by category
 *
 * @param category - Feature code category
 * @returns Array of feature codes in that category
 */
export function getFeatureCodesByCategory(
  category: FeatureCode['category']
): FeatureCode[] {
  return FEATURE_CODES.filter((fc) => fc.category === category);
}

/**
 * Get primary ring group members (no delay)
 *
 * @param groupNumber - Ring group number
 * @returns Array of extensions that ring immediately
 */
export function getPrimaryRingGroupMembers(groupNumber: string): Extension[] {
  const group = RING_GROUPS.find((rg) => rg.groupNumber === groupNumber);
  if (!group) return [];

  return group.members
    .filter((m) => m.ringDelay === 0)
    .map((m) => getExtensionByNumber(m.extension))
    .filter((ext): ext is Extension => ext !== undefined);
}

/**
 * Get secondary ring group members (with delay)
 *
 * @param groupNumber - Ring group number
 * @returns Array of extensions that ring after a delay
 */
export function getSecondaryRingGroupMembers(groupNumber: string): Extension[] {
  const group = RING_GROUPS.find((rg) => rg.groupNumber === groupNumber);
  if (!group) return [];

  return group.members
    .filter((m) => m.ringDelay > 0)
    .map((m) => getExtensionByNumber(m.extension))
    .filter((ext): ext is Extension => ext !== undefined);
}

/**
 * Get count of online extensions
 */
export function getOnlineExtensionCount(): number {
  return EXTENSIONS.filter((ext) => ext.status === 'online').length;
}

/**
 * Get count of busy extensions
 */
export function getBusyExtensionCount(): number {
  return EXTENSIONS.filter((ext) => ext.status === 'busy').length;
}
