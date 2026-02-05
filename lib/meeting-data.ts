/**
 * RCRS Command Center - Meeting System Data & Utilities
 *
 * Constants and helper functions for the Monday Meeting System integration.
 * Provides slide definitions, bible verses, meeting date calculations,
 * and default agenda configurations.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

// =============================================================================
// Types
// =============================================================================

export interface Slide {
  id: number;
  name: string;
  description: string;
  duration: number; // Duration in seconds
  category: 'opener' | 'business' | 'team' | 'closer';
  icon: string;
}

export interface BibleVerse {
  reference: string;
  text: string;
  theme: string;
}

export interface MeetingPrepData {
  id: string;
  meetingDate: string;
  bibleVerse: BibleVerse | null;
  useRandomVerse: boolean;
  announcements: {
    part1: string[];
    part2: string[];
  };
  employeeOfMonth: {
    name: string;
    department: string;
    reason: string;
  } | null;
  trainingTopic: string;
  departmentNotes: {
    sales: string;
    operations: string;
    office: string;
    drivers: string;
  };
  specialNotes: string;
  preparedBy: string;
  preparedAt: string;
  status: 'draft' | 'ready' | 'presented';
}

export interface MeetingConfig {
  nextMeetingDate: string;
  daysUntilMeeting: number;
  weeksPresented: number;
  lastMeetingDate: string | null;
  currentPrepStatus: 'not-started' | 'in-progress' | 'ready';
  meetingTime: string;
  timezone: string;
}

// =============================================================================
// Slide Definitions (18 slides from rcrs-meeting-system)
// =============================================================================

export const SLIDES: readonly Slide[] = [
  {
    id: 1,
    name: 'Pre-Meeting Loop',
    description: 'Background visuals and music while team gathers',
    duration: 300, // 5 minutes
    category: 'opener',
    icon: 'Play',
  },
  {
    id: 2,
    name: 'Bible Verse',
    description: 'Weekly inspirational verse to start the meeting',
    duration: 60,
    category: 'opener',
    icon: 'BookOpen',
  },
  {
    id: 3,
    name: 'Weather Forecast',
    description: 'Local weather for the week - plan installations accordingly',
    duration: 45,
    category: 'opener',
    icon: 'Cloud',
  },
  {
    id: 4,
    name: 'Install Schedule',
    description: 'This week\'s installation schedule and crew assignments',
    duration: 120,
    category: 'business',
    icon: 'Calendar',
  },
  {
    id: 5,
    name: 'Announcements Part 1',
    description: 'Company-wide announcements and updates',
    duration: 90,
    category: 'business',
    icon: 'Megaphone',
  },
  {
    id: 6,
    name: 'Rep Numbers',
    description: 'Individual sales rep performance numbers',
    duration: 60,
    category: 'business',
    icon: 'User',
  },
  {
    id: 7,
    name: 'Weekly Summary',
    description: 'Summary of last week\'s accomplishments',
    duration: 60,
    category: 'business',
    icon: 'BarChart3',
  },
  {
    id: 8,
    name: 'Sales Overview',
    description: 'Total sales figures and pipeline status',
    duration: 90,
    category: 'business',
    icon: 'DollarSign',
  },
  {
    id: 9,
    name: 'Commissions Overview',
    description: 'Commission standings and payouts',
    duration: 60,
    category: 'business',
    icon: 'Wallet',
  },
  {
    id: 10,
    name: 'Leaders & Stats',
    description: 'Top performers and key statistics',
    duration: 90,
    category: 'team',
    icon: 'Trophy',
  },
  {
    id: 11,
    name: 'Employee of Month',
    description: 'Recognition for outstanding team member',
    duration: 120,
    category: 'team',
    icon: 'Award',
  },
  {
    id: 12,
    name: 'Goal Progress',
    description: 'Progress toward monthly and quarterly goals',
    duration: 60,
    category: 'business',
    icon: 'Target',
  },
  {
    id: 13,
    name: 'Announcements Part 2',
    description: 'Additional announcements and reminders',
    duration: 60,
    category: 'business',
    icon: 'Bell',
  },
  {
    id: 14,
    name: 'Training Module',
    description: 'Weekly training topic or skill development',
    duration: 180,
    category: 'team',
    icon: 'GraduationCap',
  },
  {
    id: 15,
    name: 'Motivational Quote',
    description: 'Inspirational quote to energize the team',
    duration: 30,
    category: 'closer',
    icon: 'Quote',
  },
  {
    id: 16,
    name: 'Q&A',
    description: 'Open floor for questions and discussion',
    duration: 300, // 5 minutes
    category: 'closer',
    icon: 'MessageCircle',
  },
  {
    id: 17,
    name: 'Sarge\'s Moment',
    description: 'Special segment - team building or closing thoughts',
    duration: 120,
    category: 'closer',
    icon: 'Star',
  },
  {
    id: 18,
    name: 'Post-Meeting Loop',
    description: 'Background visuals as team disperses',
    duration: 180, // 3 minutes
    category: 'closer',
    icon: 'PlayCircle',
  },
] as const;

// =============================================================================
// Bible Verses for Rotation
// =============================================================================

export const BIBLE_VERSES: readonly BibleVerse[] = [
  {
    reference: 'Proverbs 16:3',
    text: 'Commit to the LORD whatever you do, and he will establish your plans.',
    theme: 'Work Ethic',
  },
  {
    reference: 'Colossians 3:23',
    text: 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.',
    theme: 'Excellence',
  },
  {
    reference: 'Philippians 4:13',
    text: 'I can do all things through Christ who strengthens me.',
    theme: 'Strength',
  },
  {
    reference: 'Proverbs 22:29',
    text: 'Do you see someone skilled in their work? They will serve before kings; they will not serve before officials of low rank.',
    theme: 'Skill',
  },
  {
    reference: 'Ecclesiastes 9:10',
    text: 'Whatever your hand finds to do, do it with all your might.',
    theme: 'Dedication',
  },
  {
    reference: 'Joshua 1:9',
    text: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go.',
    theme: 'Courage',
  },
  {
    reference: 'Proverbs 12:24',
    text: 'Diligent hands will rule, but laziness ends in forced labor.',
    theme: 'Diligence',
  },
  {
    reference: 'Isaiah 40:31',
    text: 'But those who hope in the LORD will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.',
    theme: 'Endurance',
  },
  {
    reference: '1 Corinthians 15:58',
    text: 'Therefore, my dear brothers and sisters, stand firm. Let nothing move you. Always give yourselves fully to the work of the Lord, because you know that your labor in the Lord is not in vain.',
    theme: 'Perseverance',
  },
  {
    reference: 'Jeremiah 29:11',
    text: 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.',
    theme: 'Hope',
  },
  {
    reference: 'Matthew 5:16',
    text: 'In the same way, let your light shine before others, that they may see your good deeds and glorify your Father in heaven.',
    theme: 'Testimony',
  },
  {
    reference: 'Galatians 6:9',
    text: 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.',
    theme: 'Persistence',
  },
  {
    reference: 'Proverbs 27:17',
    text: 'As iron sharpens iron, so one person sharpens another.',
    theme: 'Teamwork',
  },
  {
    reference: 'Romans 12:11',
    text: 'Never be lacking in zeal, but keep your spiritual fervor, serving the Lord.',
    theme: 'Enthusiasm',
  },
  {
    reference: 'Psalm 90:17',
    text: 'May the favor of the Lord our God rest on us; establish the work of our hands for us - yes, establish the work of our hands.',
    theme: 'Blessing',
  },
] as const;

// =============================================================================
// Default Meeting Agenda
// =============================================================================

export const DEFAULT_AGENDA: MeetingPrepData = {
  id: '',
  meetingDate: '',
  bibleVerse: null,
  useRandomVerse: true,
  announcements: {
    part1: [],
    part2: [],
  },
  employeeOfMonth: null,
  trainingTopic: '',
  departmentNotes: {
    sales: '',
    operations: '',
    office: '',
    drivers: '',
  },
  specialNotes: '',
  preparedBy: '',
  preparedAt: '',
  status: 'draft',
};

// =============================================================================
// Date Calculation Functions
// =============================================================================

/**
 * Calculates the next Monday meeting date at 10:00 AM Central Time.
 * If today is Monday before 10 AM, returns today.
 * Otherwise, returns the next Monday.
 *
 * @returns Date object for the next meeting
 */
export function calculateNextMeetingDate(): Date {
  const now = new Date();

  // Convert to Central Time (approximate - proper timezone handling would use a library)
  // For simplicity, we'll work with local time and assume server is in Central Time
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();

  let daysUntilMonday: number;

  if (dayOfWeek === 1) {
    // It's Monday
    if (currentHour < 10) {
      // Before 10 AM, meeting is today
      daysUntilMonday = 0;
    } else {
      // After 10 AM, meeting is next Monday
      daysUntilMonday = 7;
    }
  } else if (dayOfWeek === 0) {
    // It's Sunday, next Monday is tomorrow
    daysUntilMonday = 1;
  } else {
    // Tuesday through Saturday
    daysUntilMonday = (8 - dayOfWeek) % 7;
    if (daysUntilMonday === 0) daysUntilMonday = 7;
  }

  const nextMeeting = new Date(now);
  nextMeeting.setDate(now.getDate() + daysUntilMonday);
  nextMeeting.setHours(10, 0, 0, 0); // 10:00 AM

  return nextMeeting;
}

/**
 * Calculates the number of days until the next meeting.
 *
 * @returns Number of days (0 if meeting is today)
 */
export function getDaysUntilMeeting(): number {
  const now = new Date();
  const nextMeeting = calculateNextMeetingDate();

  // Reset time to start of day for accurate day calculation
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const meetingStart = new Date(nextMeeting.getFullYear(), nextMeeting.getMonth(), nextMeeting.getDate());

  const diffTime = meetingStart.getTime() - nowStart.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Formats a date for display.
 *
 * @param date - Date to format
 * @returns Formatted string like "Monday, January 15, 2024"
 */
export function formatMeetingDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats time for display.
 *
 * @param date - Date to format
 * @returns Formatted string like "10:00 AM"
 */
export function formatMeetingTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Gets the ISO string for a date (for API use).
 *
 * @param date - Date to convert
 * @returns ISO date string
 */
export function getISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculates the week number of the year.
 *
 * @param date - Date to calculate week for
 * @returns Week number (1-52)
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Gets the number of weeks presented this year (approximate based on weeks elapsed).
 *
 * @returns Number of Mondays passed this year
 */
export function getWeeksPresented(): number {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  // Find first Monday of the year
  const firstMonday = new Date(yearStart);
  while (firstMonday.getDay() !== 1) {
    firstMonday.setDate(firstMonday.getDate() + 1);
  }

  // Count Mondays that have passed
  let mondayCount = 0;
  const checkDate = new Date(firstMonday);

  while (checkDate <= now) {
    mondayCount++;
    checkDate.setDate(checkDate.getDate() + 7);
  }

  return mondayCount;
}

/**
 * Gets a random bible verse for the meeting.
 *
 * @returns A random BibleVerse object
 */
export function getRandomBibleVerse(): BibleVerse {
  const index = Math.floor(Math.random() * BIBLE_VERSES.length);
  return BIBLE_VERSES[index];
}

/**
 * Gets a bible verse by index (for rotation).
 *
 * @param weekNumber - Week number to use for rotation
 * @returns BibleVerse for that week
 */
export function getBibleVerseByWeek(weekNumber: number): BibleVerse {
  const index = (weekNumber - 1) % BIBLE_VERSES.length;
  return BIBLE_VERSES[index];
}

/**
 * Calculates total meeting duration in minutes.
 *
 * @returns Total duration in minutes
 */
export function getTotalMeetingDuration(): number {
  const totalSeconds = SLIDES.reduce((sum, slide) => sum + slide.duration, 0);
  return Math.round(totalSeconds / 60);
}

/**
 * Gets slides by category.
 *
 * @param category - Category to filter by
 * @returns Array of slides in that category
 */
export function getSlidesByCategory(category: Slide['category']): readonly Slide[] {
  return SLIDES.filter((slide) => slide.category === category);
}

// =============================================================================
// Meeting Config Helper
// =============================================================================

/**
 * Generates the current meeting configuration.
 *
 * @returns MeetingConfig object with calculated values
 */
export function getMeetingConfig(): MeetingConfig {
  const nextMeeting = calculateNextMeetingDate();
  const daysUntil = getDaysUntilMeeting();
  const weeksPresented = getWeeksPresented();

  // Calculate last meeting date (previous Monday)
  const lastMeeting = new Date(nextMeeting);
  lastMeeting.setDate(lastMeeting.getDate() - 7);

  return {
    nextMeetingDate: getISODate(nextMeeting),
    daysUntilMeeting: daysUntil,
    weeksPresented,
    lastMeetingDate: getISODate(lastMeeting),
    currentPrepStatus: 'not-started', // This would be fetched from storage in real implementation
    meetingTime: '10:00 AM',
    timezone: 'Central Time',
  };
}

/**
 * Gets the next Monday meeting date.
 * Alias for calculateNextMeetingDate for cleaner API.
 *
 * @returns Date object for the next Monday at 10 AM
 */
export function getNextMeetingDate(): Date {
  return calculateNextMeetingDate();
}

/**
 * Formats the meeting countdown into a human-readable string.
 *
 * @returns Formatted string like "3 days, 4 hours" or "Today at 10:00 AM"
 */
export function formatMeetingCountdown(): string {
  const nextMeeting = calculateNextMeetingDate();
  const now = new Date();
  const diff = nextMeeting.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Meeting in progress or completed';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days === 0 && hours === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  if (days === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  return `${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
}

/**
 * Gets hours until the next meeting.
 *
 * @returns Number of hours until meeting (can be fractional)
 */
export function getHoursUntilMeeting(): number {
  const nextMeeting = calculateNextMeetingDate();
  const now = new Date();
  const diff = nextMeeting.getTime() - now.getTime();
  return Math.max(0, diff / (1000 * 60 * 60));
}

/**
 * Gets minutes until the next meeting.
 *
 * @returns Number of minutes until meeting
 */
export function getMinutesUntilMeeting(): number {
  const nextMeeting = calculateNextMeetingDate();
  const now = new Date();
  const diff = nextMeeting.getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60)));
}

/**
 * Checks if today is meeting day (Monday).
 *
 * @returns true if today is Monday
 */
export function isMeetingDay(): boolean {
  return new Date().getDay() === 1;
}

/**
 * Checks if the meeting has started (it's Monday and past 10 AM).
 *
 * @returns true if meeting should be in progress
 */
export function isMeetingTime(): boolean {
  const now = new Date();
  return now.getDay() === 1 && now.getHours() >= 10;
}
