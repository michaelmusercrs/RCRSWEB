/**
 * RCRS Monday Meeting Notes Service
 *
 * Enables team members to submit personal notes for Monday meetings.
 * Each person can add text notes, upload images/documents, and include
 * timing/frequency information that auto-generates into meeting slides.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { TeamRole, TEAM_MEMBERS, TeamMember } from './team-roles';

// =============================================================================
// Schedule Types (used by MondaySubmissionWidget)
// =============================================================================

export type ScheduleType = 'this-week' | 'next-week' | 'recurring' | 'one-time' | 'for-x-weeks' | 'custom-range';

export interface NoteSchedule {
  type: ScheduleType;
  date?: string;
  startDate?: string;
  endDate?: string;
  weeksCount?: number;
  recurring?: boolean;
}

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  'this-week': 'This Monday',
  'next-week': 'Next Monday',
  'recurring': 'Every Week',
  'one-time': 'One Time',
  'for-x-weeks': 'For X Weeks',
  'custom-range': 'Custom Range',
};

// =============================================================================
// Types
// =============================================================================

export type NoteCategory =
  | 'delivery'      // Driver updates - deliveries, routes, issues
  | 'sales'         // Sales rep - leads, closes, pipeline
  | 'operations'    // PM/Operations - job status, scheduling
  | 'office'        // Office staff - admin updates, scheduling
  | 'general';      // General announcements

export interface MondayNoteAttachment {
  id: string;
  type: 'image' | 'document' | 'photo';
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  caption?: string;
  uploadedAt: string;
}

export interface TimingInfo {
  duration?: string;           // e.g., "2 hours", "30 minutes"
  frequency?: string;          // e.g., "daily", "3x per week"
  date?: string;               // Specific date if applicable
  timeSpent?: number;          // Minutes spent on activity
  occurrences?: number;        // Number of times something happened
  notes?: string;              // Additional timing context
}

export type AnnouncementType = 'early' | 'late';
export type DisplayDuration = '1-week' | '2-weeks' | '3-weeks' | '4-weeks' | 'monthly' | 'one-time';

export interface MondayNote {
  id: string;
  meetingDate: string;         // ISO date of the Monday meeting this is for
  userId: string;              // Team member ID
  userName: string;            // Team member name
  userRole: TeamRole;          // Team member role
  category: NoteCategory;

  // Content
  title: string;               // Brief title for the note/update
  content: string;             // Main note content (supports markdown)
  highlights?: string[];       // Key points to highlight in the slide

  // Attachments
  attachments: MondayNoteAttachment[];

  // Timing/metrics
  timing?: TimingInfo;
  metrics?: {
    label: string;
    value: string | number;
    change?: 'up' | 'down' | 'neutral';
  }[];

  // Announcement settings (for meeting presentation)
  announcementType?: AnnouncementType;  // early = before numbers, late = after numbers
  displayDuration?: DisplayDuration;     // how long to show in meetings
  displayStartDate?: string;             // ISO date when this announcement starts showing
  displayEndDate?: string;               // ISO date when this announcement stops (auto-calculated)

  // Schedule
  schedule?: NoteSchedule;     // When this note should appear

  // Slide generation
  includeInSlide: boolean;     // Whether to include in auto-generated slide
  slideOrder?: number;         // Order within the category slide

  // Metadata
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'submitted' | 'approved' | 'presented';
}

export interface MondayNotesWeek {
  meetingDate: string;
  notes: MondayNote[];
  submittedBy: string[];       // User IDs who have submitted
  totalNotes: number;
  categoryCounts: Record<NoteCategory, number>;
  status: 'collecting' | 'review' | 'ready' | 'presented';
}

export interface UserNotesSummary {
  userId: string;
  userName: string;
  userRole: TeamRole;
  totalNotes: number;
  thisWeekNotes: number;
  hasSubmittedThisWeek: boolean;
  lastSubmission?: string;
  categories: NoteCategory[];
}

// =============================================================================
// Role-Category Mapping
// =============================================================================

/**
 * Maps team roles to their primary note categories
 */
export const ROLE_CATEGORIES: Record<TeamRole, NoteCategory[]> = {
  owner: ['general', 'sales', 'operations', 'office'],
  admin: ['general', 'sales', 'operations', 'office'],
  manager: ['general', 'operations', 'sales'],
  sales: ['sales'],
  office: ['office', 'general'],
  project_manager: ['operations', 'delivery'],
  driver: ['delivery'],
  viewer: ['general'],
};

/**
 * Category display names and icons
 */
export const CATEGORY_INFO: Record<NoteCategory, {
  label: string;
  description: string;
  icon: string;
  color: string;
}> = {
  delivery: {
    label: 'Delivery Updates',
    description: 'Delivery status, route updates, issues encountered',
    icon: 'Truck',
    color: 'blue',
  },
  sales: {
    label: 'Sales Updates',
    description: 'New leads, closes, pipeline status, customer feedback',
    icon: 'TrendingUp',
    color: 'green',
  },
  operations: {
    label: 'Operations Updates',
    description: 'Job status, scheduling, crew assignments, material needs',
    icon: 'Settings',
    color: 'orange',
  },
  office: {
    label: 'Office Updates',
    description: 'Administrative updates, scheduling notes, vendor info',
    icon: 'Building',
    color: 'purple',
  },
  general: {
    label: 'General Announcements',
    description: 'Company-wide updates, reminders, recognition',
    icon: 'Megaphone',
    color: 'gray',
  },
};

// =============================================================================
// Prompt Templates for Note Sections
// =============================================================================

export const NOTE_PROMPTS: Record<TeamRole, string[]> = {
  driver: [
    'What deliveries did you complete this week?',
    'Any issues or delays encountered?',
    'Customer feedback or notable interactions?',
    'Route efficiency - anything that could be improved?',
    'Photos of completed deliveries or issues?',
  ],
  sales: [
    'New leads generated this week?',
    'Deals closed or contracts signed?',
    'Pipeline updates - what\'s moving forward?',
    'Customer success stories to share?',
    'Challenges or objections you\'re facing?',
  ],
  project_manager: [
    'Jobs scheduled or completed this week?',
    'Crew assignments and availability?',
    'Material orders needed?',
    'Delays or issues affecting timeline?',
    'Coordination with other departments?',
  ],
  office: [
    'Administrative updates for the team?',
    'Scheduling changes or reminders?',
    'Vendor or supplier updates?',
    'Process improvements implemented?',
    'Customer service highlights?',
  ],
  manager: [
    'Department performance highlights?',
    'Team recognition or shoutouts?',
    'Process improvements to discuss?',
    'Upcoming priorities or changes?',
    'Training needs identified?',
  ],
  owner: [
    'Company-wide announcements?',
    'Strategic updates or direction?',
    'Recognition for team members?',
    'Policy or process changes?',
    'Goals and achievements to celebrate?',
  ],
  admin: [
    'System or process updates?',
    'Training announcements?',
    'Administrative reminders?',
    'Policy updates?',
    'Team recognition?',
  ],
  viewer: [
    'General observations?',
    'Suggestions for improvement?',
  ],
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the next Monday meeting date
 */
export function getNextMondayDate(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;

  // If it's Monday after 10 AM, get next Monday
  if (dayOfWeek === 1 && now.getHours() >= 10) {
    now.setDate(now.getDate() + 7);
  } else {
    now.setDate(now.getDate() + daysUntilMonday);
  }

  return now.toISOString().split('T')[0];
}

/**
 * Get the previous Monday meeting date
 */
export function getPreviousMondayDate(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  now.setDate(now.getDate() - daysSinceMonday);

  // If it's Monday before 10 AM, get last Monday
  if (dayOfWeek === 1 && new Date().getHours() < 10) {
    now.setDate(now.getDate() - 7);
  }

  return now.toISOString().split('T')[0];
}

/**
 * Get days until next Monday meeting
 */
export function getDaysUntilMonday(): number {
  const now = new Date();
  const nextMonday = new Date(getNextMondayDate());
  const diff = nextMonday.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get the current time in Central Time (America/Chicago)
 */
export function getCentralTime(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

/**
 * Check if current time is within the Monday deadline lockout window (9:00 AM - 11:00 AM CT).
 * - Before Monday 9:00 AM CT: open (submissions allowed)
 * - Monday 9:00 AM - 10:59 AM CT: locked (deadline passed, meeting happening)
 * - Monday 11:00 AM+ CT: open (reset for next week)
 * - Tuesday-Sunday: open (for next week's submissions)
 */
export function isPastMondayDeadline(): boolean {
  const ct = getCentralTime();
  const day = ct.getDay(); // 0=Sun, 1=Mon

  if (day === 1) { // Monday
    const minutesSinceMidnight = ct.getHours() * 60 + ct.getMinutes();
    // Locked from 9:00 AM (540 min) to 10:59 AM (659 min) CT
    return minutesSinceMidnight >= 540 && minutesSinceMidnight < 660;
  }

  return false; // Other days: open for next week's submissions
}

/**
 * Check if submissions are still open (before Monday 9 AM CT)
 */
export function areSubmissionsOpen(): boolean {
  return !isPastMondayDeadline();
}

/**
 * Get the deadline status for UI display
 */
export function getDeadlineStatus(): {
  open: boolean;
  message: string;
  severity: 'ok' | 'warning' | 'locked';
} {
  const ct = getCentralTime();
  const day = ct.getDay();

  if (day === 1) {
    const minutesSinceMidnight = ct.getHours() * 60 + ct.getMinutes();

    if (minutesSinceMidnight >= 540 && minutesSinceMidnight < 660) {
      return {
        open: false,
        message: 'Deadline passed - submissions locked',
        severity: 'locked',
      };
    }

    if (minutesSinceMidnight < 540) {
      const hoursLeft = Math.floor((540 - minutesSinceMidnight) / 60);
      const minsLeft = (540 - minutesSinceMidnight) % 60;
      return {
        open: true,
        message: `Submit by Monday 9:00 AM CT (${hoursLeft}h ${minsLeft}m remaining)`,
        severity: hoursLeft < 2 ? 'warning' : 'ok',
      };
    }
  }

  return {
    open: true,
    message: 'Submit by Monday 9:00 AM CT',
    severity: 'ok',
  };
}

/**
 * Get the deadline for note submissions
 */
export function getSubmissionDeadline(): Date {
  const nextMonday = new Date(getNextMondayDate());
  nextMonday.setHours(9, 0, 0, 0);
  return nextMonday;
}

/**
 * Get categories available for a user's role
 */
export function getCategoriesForRole(role: TeamRole): NoteCategory[] {
  return ROLE_CATEGORIES[role] || ['general'];
}

/**
 * Get the primary category for a role
 */
export function getPrimaryCategoryForRole(role: TeamRole): NoteCategory {
  const categories = ROLE_CATEGORIES[role];
  return categories?.[0] || 'general';
}

/**
 * Get prompts for a user's role
 */
export function getPromptsForRole(role: TeamRole): string[] {
  return NOTE_PROMPTS[role] || NOTE_PROMPTS.viewer;
}

/**
 * Create a new empty note for a user
 */
export function createEmptyNote(user: { userId: string; name: string; role: TeamRole }): Omit<MondayNote, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    meetingDate: getNextMondayDate(),
    userId: user.userId,
    userName: user.name,
    userRole: user.role,
    category: getPrimaryCategoryForRole(user.role),
    title: '',
    content: '',
    highlights: [],
    attachments: [],
    timing: undefined,
    metrics: [],
    includeInSlide: true,
    status: 'draft',
  };
}

/**
 * Generate a unique note ID
 */
export function generateNoteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format timing info for display
 */
export function formatTimingInfo(timing: TimingInfo): string {
  const parts: string[] = [];

  if (timing.duration) {
    parts.push(`Duration: ${timing.duration}`);
  }
  if (timing.frequency) {
    parts.push(`Frequency: ${timing.frequency}`);
  }
  if (timing.occurrences) {
    parts.push(`${timing.occurrences}x`);
  }
  if (timing.timeSpent) {
    const hours = Math.floor(timing.timeSpent / 60);
    const mins = timing.timeSpent % 60;
    parts.push(`Time: ${hours > 0 ? `${hours}h ` : ''}${mins}m`);
  }

  return parts.join(' | ');
}

/**
 * Get team members who should submit notes
 */
export function getTeamMembersForNotes(): TeamMember[] {
  return TEAM_MEMBERS.filter(m =>
    m.isActive &&
    !['viewer'].includes(m.role) // Viewers typically don't submit notes
  );
}

/**
 * Group notes by category for slide generation
 */
export function groupNotesByCategory(notes: MondayNote[]): Record<NoteCategory, MondayNote[]> {
  const grouped: Record<NoteCategory, MondayNote[]> = {
    delivery: [],
    sales: [],
    operations: [],
    office: [],
    general: [],
  };

  notes.forEach(note => {
    if (note.includeInSlide) {
      grouped[note.category].push(note);
    }
  });

  // Sort each category by slideOrder then by userName
  Object.keys(grouped).forEach(category => {
    grouped[category as NoteCategory].sort((a, b) => {
      if (a.slideOrder !== undefined && b.slideOrder !== undefined) {
        return a.slideOrder - b.slideOrder;
      }
      return a.userName.localeCompare(b.userName);
    });
  });

  return grouped;
}

/**
 * Generate slide content from notes
 */
export function generateSlideContent(notes: MondayNote[], category: NoteCategory): {
  title: string;
  items: {
    userName: string;
    title: string;
    highlights: string[];
    hasImages: boolean;
    timing?: string;
  }[];
} {
  const categoryInfo = CATEGORY_INFO[category];
  const categoryNotes = notes.filter(n => n.category === category && n.includeInSlide);

  return {
    title: categoryInfo.label,
    items: categoryNotes.map(note => ({
      userName: note.userName,
      title: note.title,
      highlights: note.highlights || [note.content.substring(0, 100)],
      hasImages: note.attachments.some(a => a.type === 'image' || a.type === 'photo'),
      timing: note.timing ? formatTimingInfo(note.timing) : undefined,
    })),
  };
}

/**
 * Check if a user has submitted notes for the current week
 */
export function hasUserSubmittedThisWeek(notes: MondayNote[], userId: string): boolean {
  const nextMonday = getNextMondayDate();
  return notes.some(n =>
    n.userId === userId &&
    n.meetingDate === nextMonday &&
    n.status !== 'draft'
  );
}

/**
 * Get submission status summary for all team members
 */
export function getSubmissionStatus(notes: MondayNote[]): {
  submitted: string[];
  pending: string[];
  total: number;
} {
  const nextMonday = getNextMondayDate();
  const eligibleMembers = getTeamMembersForNotes();
  const submittedUserIds = new Set(
    notes
      .filter(n => n.meetingDate === nextMonday && n.status !== 'draft')
      .map(n => n.userId)
  );

  return {
    submitted: eligibleMembers.filter(m => submittedUserIds.has(m.id)).map(m => m.name),
    pending: eligibleMembers.filter(m => !submittedUserIds.has(m.id)).map(m => m.name),
    total: eligibleMembers.length,
  };
}

// =============================================================================
// Storage Keys (for localStorage/API)
// =============================================================================

/**
 * Calculate display end date based on duration
 */
export function calculateDisplayEndDate(startDate: string, duration: DisplayDuration): string | null {
  if (duration === 'one-time') return startDate;
  if (duration === 'monthly') return null; // recurring, no end

  const weeksMap: Record<string, number> = {
    '1-week': 1,
    '2-weeks': 2,
    '3-weeks': 3,
    '4-weeks': 4,
  };

  const weeks = weeksMap[duration];
  if (!weeks) return null;

  const start = new Date(startDate);
  start.setDate(start.getDate() + weeks * 7);
  return start.toISOString().split('T')[0];
}

/**
 * Check if an announcement is active for a given meeting date
 */
export function isAnnouncementActive(note: MondayNote, meetingDate: string): boolean {
  if (!note.announcementType) return false;
  if (note.status === 'draft') return false;

  const meeting = new Date(meetingDate);

  // One-time: only show for the original meeting date
  if (note.displayDuration === 'one-time') {
    return note.meetingDate === meetingDate;
  }

  // Monthly: always active
  if (note.displayDuration === 'monthly') {
    const start = new Date(note.displayStartDate || note.meetingDate);
    return meeting >= start;
  }

  // Duration-based: check date range
  const start = new Date(note.displayStartDate || note.meetingDate);
  const end = note.displayEndDate ? new Date(note.displayEndDate) : null;

  if (meeting < start) return false;
  if (end && meeting > end) return false;

  return true;
}

export const DISPLAY_DURATION_LABELS: Record<DisplayDuration, string> = {
  'one-time': 'This meeting only',
  '1-week': 'Run for 1 week',
  '2-weeks': 'Run for 2 weeks',
  '3-weeks': 'Run for 3 weeks',
  '4-weeks': 'Run for 4 weeks',
  'monthly': 'Every meeting (recurring)',
};

export const STORAGE_KEYS = {
  MONDAY_NOTES: 'rcrs_monday_notes',
  MONDAY_NOTES_DRAFT: 'rcrs_monday_notes_draft',
  LAST_SUBMISSION: 'rcrs_last_note_submission',
};

// =============================================================================
// Validation
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export function validateNote(note: Partial<MondayNote>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!note.title?.trim()) {
    errors.push({ field: 'title', message: 'Title is required' });
  }

  if (!note.content?.trim()) {
    errors.push({ field: 'content', message: 'Please add some content to your note' });
  }

  if (note.title && note.title.length > 100) {
    errors.push({ field: 'title', message: 'Title must be under 100 characters' });
  }

  if (note.content && note.content.length > 2000) {
    errors.push({ field: 'content', message: 'Content must be under 2000 characters' });
  }

  return errors;
}
