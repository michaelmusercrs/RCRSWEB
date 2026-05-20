/**
 * Team Profile Edits — Sheets-backed pending edit queue.
 *
 * Team members submit edits from the public-site /profile page; rows land here
 * with status='PENDING'. An admin reviews them in /portal/admin/profile-approvals
 * (existing page) and either approves (status -> 'APPROVED' and override applied
 * via the existing profile-overrides flow) or rejects.
 *
 * Edits are NEVER auto-applied — the owner explicitly required admin review on
 * every change.
 */

import crypto from 'crypto';
import { googleSheetsService } from './google-sheets-service';

export const TEAM_PROFILE_EDITS_TAB = 'Team_Profile_Edits';

export const TEAM_PROFILE_EDITS_HEADERS = [
  'id',
  'submittedAt',
  'userId',
  'userSlug',
  'userName',
  'userEmail',
  'status',
  'reviewedAt',
  'reviewedBy',
  'reviewNotes',
  'fieldChanges',
  'originalSnapshot',
] as const;

export type TeamProfileEditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface TeamProfileFieldChanges {
  name?: string;
  position?: string;
  phone?: string;
  bio?: string;
  tagline?: string;
  profileImage?: string;
  truckMake?: string;
  truckModel?: string;
  truckColor?: string;
  truckLicense?: string;
  publicVisibility?: boolean;
}

export interface TeamProfileEditRecord {
  id: string;
  submittedAt: string;
  userId: string;
  userSlug: string;
  userName: string;
  userEmail: string;
  status: TeamProfileEditStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  fieldChanges: TeamProfileFieldChanges;
  originalSnapshot: TeamProfileFieldChanges;
}

function generateId(): string {
  return `TPE-${crypto.randomBytes(6).toString('hex')}`;
}

export async function submitProfileEdit(
  input: Omit<TeamProfileEditRecord, 'id' | 'submittedAt' | 'status'>,
): Promise<TeamProfileEditRecord> {
  const record: TeamProfileEditRecord = {
    ...input,
    id: generateId(),
    submittedAt: new Date().toISOString(),
    status: 'PENDING',
  };

  await googleSheetsService.appendGenericRow(
    TEAM_PROFILE_EDITS_TAB,
    [...TEAM_PROFILE_EDITS_HEADERS],
    {
      id: record.id,
      submittedAt: record.submittedAt,
      userId: record.userId,
      userSlug: record.userSlug,
      userName: record.userName,
      userEmail: record.userEmail,
      status: record.status,
      reviewedAt: '',
      reviewedBy: '',
      reviewNotes: '',
      fieldChanges: JSON.stringify(record.fieldChanges),
      originalSnapshot: JSON.stringify(record.originalSnapshot),
    },
  );

  return record;
}

export async function listProfileEdits(filter?: {
  userSlug?: string;
  status?: TeamProfileEditStatus;
}): Promise<TeamProfileEditRecord[]> {
  const rows = await googleSheetsService.getGenericRows(
    TEAM_PROFILE_EDITS_TAB,
    [...TEAM_PROFILE_EDITS_HEADERS],
  );

  const records = rows.map((r): TeamProfileEditRecord => {
    let fieldChanges: TeamProfileFieldChanges = {};
    let originalSnapshot: TeamProfileFieldChanges = {};
    try { fieldChanges = r.fieldChanges ? JSON.parse(r.fieldChanges) : {}; } catch { /* ignore */ }
    try { originalSnapshot = r.originalSnapshot ? JSON.parse(r.originalSnapshot) : {}; } catch { /* ignore */ }

    return {
      id: r.id,
      submittedAt: r.submittedAt,
      userId: r.userId,
      userSlug: r.userSlug,
      userName: r.userName,
      userEmail: r.userEmail,
      status: (r.status as TeamProfileEditStatus) || 'PENDING',
      reviewedAt: r.reviewedAt || undefined,
      reviewedBy: r.reviewedBy || undefined,
      reviewNotes: r.reviewNotes || undefined,
      fieldChanges,
      originalSnapshot,
    };
  });

  return records.filter((rec) => {
    if (filter?.userSlug && rec.userSlug !== filter.userSlug) return false;
    if (filter?.status && rec.status !== filter.status) return false;
    return true;
  });
}

export async function markProfileEditReviewed(
  id: string,
  decision: { status: 'APPROVED' | 'REJECTED'; reviewedBy: string; reviewNotes?: string },
): Promise<boolean> {
  return googleSheetsService.updateGenericRow(
    TEAM_PROFILE_EDITS_TAB,
    [...TEAM_PROFILE_EDITS_HEADERS],
    'id',
    id,
    {
      status: decision.status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: decision.reviewedBy,
      reviewNotes: decision.reviewNotes || '',
    },
  );
}
