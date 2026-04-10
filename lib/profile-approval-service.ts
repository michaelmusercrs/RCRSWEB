// Profile Approval Workflow Service
// Manages pending profile edits that require admin approval before going live
//
// Persistence (2026-04-09): Migrated off the four local JSON files
//   - data/profile-updates.json
//   - data/pending-profile-changes.json
//   - data/pending-profile-edits.json
//   - data/profile-overrides.json
// onto ONE Google Sheet tab: SHEET_NAMES.PROFILE_UPDATES (`Profile_Updates`).
// The `status` column differentiates pending / approved / rejected / override
// rows. Profile notifications now live on SHEET_NAMES.PROFILE_NOTIFICATIONS
// (`Profile_Notifications`).
//
// Local data/*.json files remain in place as deprecated dev seeds.

import { emailService } from './email-service';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// Types
export interface ProfileEditRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userSlug: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'override';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  changes: ProfileChanges;
  originalData: ProfileChanges;
}

export interface ProfileChanges {
  bio?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  altEmail?: string;
  profileImage?: string;
  facebook?: string;
  instagram?: string;
  x?: string;
  tiktok?: string;
  linkedin?: string;
  keyStrengths?: string[];
  responsibilities?: string[];
}

export interface NotificationRecord {
  id: string;
  type: 'edit_submitted' | 'edit_approved' | 'edit_rejected';
  profileEditId: string;
  recipientEmail: string;
  recipientName: string;
  message: string;
  createdAt: string;
  sent: boolean;
}

// =============================================================================
// SHEET SCHEMA
// =============================================================================

const PROFILE_UPDATES_HEADERS: string[] = [
  'id',
  'userId',
  'userName',
  'userEmail',
  'userSlug',
  'submittedAt',
  'status',
  'reviewedBy',
  'reviewedAt',
  'rejectionReason',
  'changes',
  'originalData',
];

const PROFILE_NOTIFICATIONS_HEADERS: string[] = [
  'id',
  'type',
  'profileEditId',
  'recipientEmail',
  'recipientName',
  'message',
  'createdAt',
  'sent',
];

// =============================================================================
// PARSING HELPERS
// =============================================================================

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  return value === 'true' || value === 'TRUE' || value === '1';
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToEdit(row: Record<string, string>): ProfileEditRequest {
  const status = (row.status || 'pending') as ProfileEditRequest['status'];
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    userSlug: row.userSlug,
    submittedAt: row.submittedAt,
    status,
    reviewedBy: row.reviewedBy || undefined,
    reviewedAt: row.reviewedAt || undefined,
    rejectionReason: row.rejectionReason || undefined,
    changes: parseJson<ProfileChanges>(row.changes, {}),
    originalData: parseJson<ProfileChanges>(row.originalData, {}),
  };
}

function editToRow(edit: ProfileEditRequest): Record<string, unknown> {
  return {
    id: edit.id,
    userId: edit.userId,
    userName: edit.userName,
    userEmail: edit.userEmail,
    userSlug: edit.userSlug,
    submittedAt: edit.submittedAt,
    status: edit.status,
    reviewedBy: edit.reviewedBy ?? '',
    reviewedAt: edit.reviewedAt ?? '',
    rejectionReason: edit.rejectionReason ?? '',
    changes: JSON.stringify(edit.changes ?? {}),
    originalData: JSON.stringify(edit.originalData ?? {}),
  };
}

function rowToNotification(row: Record<string, string>): NotificationRecord {
  return {
    id: row.id,
    type: (row.type || 'edit_submitted') as NotificationRecord['type'],
    profileEditId: row.profileEditId,
    recipientEmail: row.recipientEmail,
    recipientName: row.recipientName,
    message: row.message,
    createdAt: row.createdAt,
    sent: parseBool(row.sent),
  };
}

function notificationToRow(n: NotificationRecord): Record<string, unknown> {
  return {
    id: n.id,
    type: n.type,
    profileEditId: n.profileEditId,
    recipientEmail: n.recipientEmail,
    recipientName: n.recipientName,
    message: n.message,
    createdAt: n.createdAt,
    sent: n.sent,
  };
}

// =============================================================================
// CACHED LOADERS
// =============================================================================

const CACHE_TTL_MS = 60_000;

let editsCache: ProfileEditRequest[] | null = null;
let editsCacheExpiresAt = 0;

let notificationsCache: NotificationRecord[] | null = null;
let notificationsCacheExpiresAt = 0;

function invalidateEditsCache(): void {
  editsCache = null;
  editsCacheExpiresAt = 0;
}

function invalidateNotificationsCache(): void {
  notificationsCache = null;
  notificationsCacheExpiresAt = 0;
}

async function loadAllEditsFromSheet(): Promise<ProfileEditRequest[]> {
  const rows = await googleSheetsService.getGenericRows(
    SHEET_NAMES.PROFILE_UPDATES,
    PROFILE_UPDATES_HEADERS,
  );
  return rows.filter((r) => r.id).map(rowToEdit);
}

async function loadAllEdits(): Promise<ProfileEditRequest[]> {
  if (editsCache && Date.now() < editsCacheExpiresAt) return editsCache;
  editsCache = await loadAllEditsFromSheet();
  editsCacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return editsCache;
}

async function saveEdit(edit: ProfileEditRequest): Promise<void> {
  await googleSheetsService.upsertGenericRow(
    SHEET_NAMES.PROFILE_UPDATES,
    PROFILE_UPDATES_HEADERS,
    'id',
    editToRow(edit),
  );
  invalidateEditsCache();
}

async function deleteEditRow(id: string): Promise<void> {
  await googleSheetsService.deleteGenericRow(SHEET_NAMES.PROFILE_UPDATES, 'id', id);
  invalidateEditsCache();
}

async function loadAllNotificationsFromSheet(): Promise<NotificationRecord[]> {
  const rows = await googleSheetsService.getGenericRows(
    SHEET_NAMES.PROFILE_NOTIFICATIONS,
    PROFILE_NOTIFICATIONS_HEADERS,
  );
  return rows.filter((r) => r.id).map(rowToNotification);
}

async function loadAllNotifications(): Promise<NotificationRecord[]> {
  if (notificationsCache && Date.now() < notificationsCacheExpiresAt) {
    return notificationsCache;
  }
  notificationsCache = await loadAllNotificationsFromSheet();
  notificationsCacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return notificationsCache;
}

async function saveNotification(n: NotificationRecord): Promise<void> {
  await googleSheetsService.upsertGenericRow(
    SHEET_NAMES.PROFILE_NOTIFICATIONS,
    PROFILE_NOTIFICATIONS_HEADERS,
    'id',
    notificationToRow(n),
  );
  invalidateNotificationsCache();
}

// Generate unique ID
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `PROF-${timestamp}-${random}`.toUpperCase();
}

// Profile Approval Service
export const profileApprovalService = {
  // Submit a new profile edit request
  async submitEdit(params: {
    userId: string;
    userName: string;
    userEmail: string;
    userSlug: string;
    changes: ProfileChanges;
    originalData: ProfileChanges;
  }): Promise<ProfileEditRequest> {
    const edits = await loadAllEdits();

    // Check if there's already a pending edit for this user
    const existingPending = edits.find(
      (e) => e.userId === params.userId && e.status === 'pending',
    );

    if (existingPending) {
      // Update existing pending edit instead of creating new one
      existingPending.changes = { ...existingPending.changes, ...params.changes };
      existingPending.submittedAt = new Date().toISOString();
      await saveEdit(existingPending);

      // Create notification for admins
      await this.createNotification({
        type: 'edit_submitted',
        profileEditId: existingPending.id,
        recipientEmail: 'admin@rcrsal.com', // Will be expanded to all admins
        recipientName: 'Admin',
        message: `${params.userName} updated their pending profile edit request.`,
      });

      return existingPending;
    }

    // Create new edit request
    const newEdit: ProfileEditRequest = {
      id: generateId(),
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      userSlug: params.userSlug,
      submittedAt: new Date().toISOString(),
      status: 'pending',
      changes: params.changes,
      originalData: params.originalData,
    };

    await saveEdit(newEdit);

    // Notify Michael and Sara directly for profile edit requests
    await Promise.all([
      this.createNotification({
        type: 'edit_submitted',
        profileEditId: newEdit.id,
        recipientEmail: 'michaelmuse@rcrsal.com',
        recipientName: 'Michael Muse',
        message: `${params.userName} submitted a profile edit request for review.`,
      }),
      this.createNotification({
        type: 'edit_submitted',
        profileEditId: newEdit.id,
        recipientEmail: 'sara@rcrsal.com',
        recipientName: 'Sara Hill',
        message: `${params.userName} submitted a profile edit request for review.`,
      }),
    ]);

    return newEdit;
  },

  // Get all pending edits (for admins)
  async getPendingEdits(): Promise<ProfileEditRequest[]> {
    const edits = await loadAllEdits();
    return edits
      .filter((e) => e.status === 'pending')
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  // Get all edits (for admin history view)
  async getAllEdits(): Promise<ProfileEditRequest[]> {
    const edits = await loadAllEdits();
    return [...edits].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  },

  // Get edits for a specific user
  async getUserEdits(userId: string): Promise<ProfileEditRequest[]> {
    const edits = await loadAllEdits();
    return edits
      .filter((e) => e.userId === userId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  // Get a single edit by ID
  async getEditById(editId: string): Promise<ProfileEditRequest | null> {
    const edits = await loadAllEdits();
    return edits.find((e) => e.id === editId) || null;
  },

  // Get pending edit for a user (if exists)
  async getPendingEditForUser(userId: string): Promise<ProfileEditRequest | null> {
    const edits = await loadAllEdits();
    return edits.find((e) => e.userId === userId && e.status === 'pending') || null;
  },

  // Approve an edit
  async approveEdit(
    editId: string,
    reviewerName: string,
    reviewerEmail?: string,
  ): Promise<{ success: boolean; error?: string; edit?: ProfileEditRequest }> {
    const edits = await loadAllEdits();
    const edit = edits.find((e) => e.id === editId);

    if (!edit) {
      return { success: false, error: 'Edit request not found' };
    }

    if (edit.status !== 'pending') {
      return { success: false, error: 'Edit has already been processed' };
    }

    // Prevent self-approval: the person who submitted cannot approve their own edit
    if (
      edit.userName.toLowerCase() === reviewerName.toLowerCase() ||
      (reviewerEmail && edit.userEmail.toLowerCase() === reviewerEmail.toLowerCase())
    ) {
      return {
        success: false,
        error: 'You cannot approve your own profile changes. Another admin must review.',
      };
    }

    // Update the edit status
    edit.status = 'approved';
    edit.reviewedBy = reviewerName;
    edit.reviewedAt = new Date().toISOString();

    await saveEdit(edit);

    // Create notification for the user
    await this.createNotification({
      type: 'edit_approved',
      profileEditId: edit.id,
      recipientEmail: edit.userEmail,
      recipientName: edit.userName,
      message: `Your profile edit has been approved by ${reviewerName}. Changes are now live!`,
    });

    return { success: true, edit };
  },

  // Reject an edit
  async rejectEdit(
    editId: string,
    reviewerName: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string; edit?: ProfileEditRequest }> {
    const edits = await loadAllEdits();
    const edit = edits.find((e) => e.id === editId);

    if (!edit) {
      return { success: false, error: 'Edit request not found' };
    }

    if (edit.status !== 'pending') {
      return { success: false, error: 'Edit has already been processed' };
    }

    // Update the edit status
    edit.status = 'rejected';
    edit.reviewedBy = reviewerName;
    edit.reviewedAt = new Date().toISOString();
    edit.rejectionReason = reason || 'No reason provided';

    await saveEdit(edit);

    // Create notification for the user
    await this.createNotification({
      type: 'edit_rejected',
      profileEditId: edit.id,
      recipientEmail: edit.userEmail,
      recipientName: edit.userName,
      message: `Your profile edit was not approved. Reason: ${
        reason || 'No reason provided'
      }. Please revise and resubmit.`,
    });

    return { success: true, edit };
  },

  // Cancel a pending edit (by the user who submitted it)
  async cancelEdit(
    editId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const edits = await loadAllEdits();
    const edit = edits.find((e) => e.id === editId && e.userId === userId);

    if (!edit) {
      return { success: false, error: 'Edit request not found or not authorized' };
    }

    if (edit.status !== 'pending') {
      return { success: false, error: 'Can only cancel pending edits' };
    }

    await deleteEditRow(edit.id);

    return { success: true };
  },

  // Create a notification
  async createNotification(
    params: Omit<NotificationRecord, 'id' | 'createdAt' | 'sent'>,
  ): Promise<NotificationRecord> {
    const notification: NotificationRecord = {
      id: `NOTIF-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase(),
      ...params,
      createdAt: new Date().toISOString(),
      sent: false,
    };

    await saveNotification(notification);

    // Send email notification (fire-and-forget)
    if (params.recipientEmail) {
      emailService
        .send({
          to: params.recipientEmail,
          subject: `RCRS Profile Update: ${params.type}`,
          body: `<p>${params.message}</p>`,
          fromName: 'RCRS Portal',
        })
        .then(() => {
          notification.sent = true;
          saveNotification(notification).catch(() => {
            /* non-critical */
          });
        })
        .catch(() => {
          /* email send is non-critical */
        });
    }

    return notification;
  },

  // Get unsent notifications (for email processing)
  async getUnsentNotifications(): Promise<NotificationRecord[]> {
    const notifications = await loadAllNotifications();
    return notifications.filter((n) => !n.sent);
  },

  // Mark notification as sent
  async markNotificationSent(notificationId: string): Promise<void> {
    const notifications = await loadAllNotifications();
    const notification = notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.sent = true;
      await saveNotification(notification);
    }
  },

  // Get count of pending edits (for dashboard badges)
  async getPendingCount(): Promise<number> {
    const edits = await loadAllEdits();
    return edits.filter((e) => e.status === 'pending').length;
  },
};

export default profileApprovalService;
