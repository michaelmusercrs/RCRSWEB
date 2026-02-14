/**
 * Onboarding Quiz Answer Key — Server-side validation
 *
 * Mirrors the quiz data in app/portal/training/onboarding/page.tsx
 * so the server can grade without trusting client scores.
 *
 * Maps: moduleId -> questionIndex -> correctIndex
 */

export const ONBOARDING_QUIZ_ANSWERS: Record<string, number[]> = {
  // Section 1: Dashboard Overview
  onboard_s1: [1, 1, 2], // Manager Dashboard, % orders on time, /command-center
  // Section 2: Lead Management
  onboard_s2: [2, 1, 2], // Social media DMs, Reassigned, Real time
  // Section 3: Customer Portal
  onboard_s3: [2, 2, 1], // Token-based link, Project status/timeline, 30 minutes
  // Section 4: Delivery System
  onboard_s4: [1, 2, 1], // Address+material+date+driver+instructions, Tae, Prove delivery
  // Section 5: Job Breakdowns & Invoicing
  onboard_s5: [1, 1, 1], // Breakdown must be approved, Outdated pricing costs thousands, Sent/Viewed/Paid
  // Section 6: Calendar & Scheduling
  onboard_s6: [3, 2, 1], // Red, Google Calendar URL links, 30 minutes
  // Section 7: Inventory Management
  onboard_s7: [2, 1, 1], // Below min needs reorder, Accountability/audit trail, Weekly or bi-weekly
  // Section 8: Reports & Analytics
  onboard_s8: [2, 0, 1], // Speed to lead, Earned/Pending/Paid, Monthly revenue + outstanding invoices
};

export const ONBOARDING_PASSING_SCORE = 60; // percentage

/**
 * Grade an onboarding quiz server-side.
 * @param sectionId - e.g. "onboard_s1"
 * @param answers - Record<questionIndex, selectedIndex>
 */
export function gradeOnboardingQuiz(
  sectionId: string,
  answers: Record<number, number>,
): { score: number; passed: boolean; correct: number; total: number } {
  const key = ONBOARDING_QUIZ_ANSWERS[sectionId];
  if (!key) {
    return { score: 0, passed: false, correct: 0, total: 0 };
  }

  let correct = 0;
  for (let i = 0; i < key.length; i++) {
    if (answers[i] === key[i]) correct++;
  }

  const score = Math.round((correct / key.length) * 100);
  return { score, passed: score >= ONBOARDING_PASSING_SCORE, correct, total: key.length };
}
