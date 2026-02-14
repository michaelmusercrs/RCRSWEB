// Quiet Hours Enforcement for Team Chat
// HARD RULE: No messages sent between 8 PM and 7 AM CST

/**
 * Check if the current time is within quiet hours (8 PM - 7 AM CST).
 * Returns true if messages should be BLOCKED.
 */
export function isQuietHours(): boolean {
  // Get current time in CST (America/Chicago)
  const now = new Date();
  const cstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const hour = cstTime.getHours();

  // Quiet hours: 8 PM (20:00) to 7 AM (07:00)
  return hour >= 20 || hour < 7;
}

/**
 * Get info about quiet hours for UI display.
 */
export function getQuietHoursInfo(): {
  isQuiet: boolean;
  currentTimeCst: string;
  resumesAt: string;
} {
  const now = new Date();
  const cstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const hour = cstTime.getHours();
  const isQuiet = hour >= 20 || hour < 7;

  const currentTimeCst = cstTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  let resumesAt = '7:00 AM CST';
  if (hour >= 20) {
    // After 8 PM — resumes tomorrow at 7 AM
    resumesAt = 'tomorrow at 7:00 AM CST';
  } else if (hour < 7) {
    // Before 7 AM — resumes today at 7 AM
    resumesAt = 'today at 7:00 AM CST';
  }

  return { isQuiet, currentTimeCst, resumesAt };
}

/**
 * Error response for quiet hours violations.
 */
export const QUIET_HOURS_ERROR = {
  error: 'Messages cannot be sent during quiet hours (8 PM – 7 AM CST). Please try again after 7:00 AM.',
  code: 'QUIET_HOURS',
};
