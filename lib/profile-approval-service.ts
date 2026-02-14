// Profile Approval Workflow Service
// Manages pending profile edits that require admin approval before going live

import { promises as fs } from 'fs';
import path from 'path';

// Types
export interface ProfileEditRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userSlug: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
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

// Data file paths
const DATA_DIR = path.join(process.cwd(), 'data');
const PENDING_EDITS_FILE = path.join(DATA_DIR, 'pending-profile-edits.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'profile-notifications.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Read pending edits
async function readPendingEdits(): Promise<ProfileEditRequest[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(PENDING_EDITS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Write pending edits
async function writePendingEdits(edits: ProfileEditRequest[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(PENDING_EDITS_FILE, JSON.stringify(edits, null, 2));
}

// Read notifications
async function readNotifications(): Promise<NotificationRecord[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(NOTIFICATIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Write notifications
async function writeNotifications(notifications: NotificationRecord[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
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
    const edits = await readPendingEdits();

    // Check if there's already a pending edit for this user
    const existingPending = edits.find(
      e => e.userId === params.userId && e.status === 'pending'
    );

    if (existingPending) {
      // Update existing pending edit instead of creating new one
      existingPending.changes = { ...existingPending.changes, ...params.changes };
      existingPending.submittedAt = new Date().toISOString();
      await writePendingEdits(edits);

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

    edits.push(newEdit);
    await writePendingEdits(edits);

    // Create notification for admins
    await this.createNotification({
      type: 'edit_submitted',
      profileEditId: newEdit.id,
      recipientEmail: 'admin@rcrsal.com',
      recipientName: 'Admin',
      message: `${params.userName} submitted a profile edit request for review.`,
    });

    return newEdit;
  },

  // Get all pending edits (for admins)
  async getPendingEdits(): Promise<ProfileEditRequest[]> {
    const edits = await readPendingEdits();
    return edits.filter(e => e.status === 'pending')
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  // Get all edits (for admin history view)
  async getAllEdits(): Promise<ProfileEditRequest[]> {
    const edits = await readPendingEdits();
    return edits.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  // Get edits for a specific user
  async getUserEdits(userId: string): Promise<ProfileEditRequest[]> {
    const edits = await readPendingEdits();
    return edits.filter(e => e.userId === userId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  // Get a single edit by ID
  async getEditById(editId: string): Promise<ProfileEditRequest | null> {
    const edits = await readPendingEdits();
    return edits.find(e => e.id === editId) || null;
  },

  // Get pending edit for a user (if exists)
  async getPendingEditForUser(userId: string): Promise<ProfileEditRequest | null> {
    const edits = await readPendingEdits();
    return edits.find(e => e.userId === userId && e.status === 'pending') || null;
  },

  // Approve an edit
  async approveEdit(editId: string, reviewerName: string, reviewerEmail?: string): Promise<{ success: boolean; error?: string; edit?: ProfileEditRequest }> {
    const edits = await readPendingEdits();
    const editIndex = edits.findIndex(e => e.id === editId);

    if (editIndex === -1) {
      return { success: false, error: 'Edit request not found' };
    }

    const edit = edits[editIndex];

    if (edit.status !== 'pending') {
      return { success: false, error: 'Edit has already been processed' };
    }

    // Prevent self-approval: the person who submitted cannot approve their own edit
    if (
      edit.userName.toLowerCase() === reviewerName.toLowerCase() ||
      (reviewerEmail && edit.userEmail.toLowerCase() === reviewerEmail.toLowerCase())
    ) {
      return { success: false, error: 'You cannot approve your own profile changes. Another admin must review.' };
    }

    // Update the edit status
    edit.status = 'approved';
    edit.reviewedBy = reviewerName;
    edit.reviewedAt = new Date().toISOString();

    edits[editIndex] = edit;
    await writePendingEdits(edits);

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
  async rejectEdit(editId: string, reviewerName: string, reason?: string): Promise<{ success: boolean; error?: string; edit?: ProfileEditRequest }> {
    const edits = await readPendingEdits();
    const editIndex = edits.findIndex(e => e.id === editId);

    if (editIndex === -1) {
      return { success: false, error: 'Edit request not found' };
    }

    const edit = edits[editIndex];

    if (edit.status !== 'pending') {
      return { success: false, error: 'Edit has already been processed' };
    }

    // Update the edit status
    edit.status = 'rejected';
    edit.reviewedBy = reviewerName;
    edit.reviewedAt = new Date().toISOString();
    edit.rejectionReason = reason || 'No reason provided';

    edits[editIndex] = edit;
    await writePendingEdits(edits);

    // Create notification for the user
    await this.createNotification({
      type: 'edit_rejected',
      profileEditId: edit.id,
      recipientEmail: edit.userEmail,
      recipientName: edit.userName,
      message: `Your profile edit was not approved. Reason: ${reason || 'No reason provided'}. Please revise and resubmit.`,
    });

    return { success: true, edit };
  },

  // Cancel a pending edit (by the user who submitted it)
  async cancelEdit(editId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const edits = await readPendingEdits();
    const editIndex = edits.findIndex(e => e.id === editId && e.userId === userId);

    if (editIndex === -1) {
      return { success: false, error: 'Edit request not found or not authorized' };
    }

    const edit = edits[editIndex];

    if (edit.status !== 'pending') {
      return { success: false, error: 'Can only cancel pending edits' };
    }

    // Remove the edit
    edits.splice(editIndex, 1);
    await writePendingEdits(edits);

    return { success: true };
  },

  // Create a notification
  async createNotification(params: Omit<NotificationRecord, 'id' | 'createdAt' | 'sent'>): Promise<NotificationRecord> {
    const notifications = await readNotifications();

    const notification: NotificationRecord = {
      id: `NOTIF-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase(),
      ...params,
      createdAt: new Date().toISOString(),
      sent: false, // TODO: Integrate with actual email service
    };

    notifications.push(notification);
    await writeNotifications(notifications);

    // TODO: Send actual email notification
    // For now, log to console

    return notification;
  },

  // Get unsent notifications (for email processing)
  async getUnsentNotifications(): Promise<NotificationRecord[]> {
    const notifications = await readNotifications();
    return notifications.filter(n => !n.sent);
  },

  // Mark notification as sent
  async markNotificationSent(notificationId: string): Promise<void> {
    const notifications = await readNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.sent = true;
      await writeNotifications(notifications);
    }
  },

  // Get count of pending edits (for dashboard badges)
  async getPendingCount(): Promise<number> {
    const edits = await readPendingEdits();
    return edits.filter(e => e.status === 'pending').length;
  },
};

export default profileApprovalService;