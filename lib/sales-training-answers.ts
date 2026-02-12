/**
 * Sales Training Quiz Answer Key
 *
 * Server-side answer validation for sales training quizzes.
 * This prevents users from cheating by editing localStorage or
 * inspecting client-side code to find correct answers.
 *
 * Maps: questionId -> correctIndex
 */

export const SALES_QUIZ_ANSWERS: Record<string, number> = {
  // Module 1: Company Overview
  q1_1: 2, // Huntsville, AL
  q1_2: 1, // Lowest Price Guarantee (not a core value)
  q1_3: 2, // Bart
  q1_4: 2, // Hunter
  q1_5: 2, // Overseeing installation projects and crew coordination

  // Module 2: Roofing Products & Materials
  q2_1: 1, // Architectural
  q2_2: 2, // IKO Dynasty
  q2_3: 1, // Self-adhesive waterproof membrane
  q2_4: 1, // Improper or deteriorated flashing
  q2_5: 2, // Extends roof life and maintains warranties
  q2_6: 2, // Standing Seam
  q2_7: 1, // GAF
  q2_8: 2, // Homeowner pays the upgrade difference

  // Module 3: Insurance Claim Process
  q3_1: 1, // Waive or pay it for them
  q3_2: 2, // Point out damage and ensure thorough assessment
  q3_3: 1, // Additional request for missed/underpriced items
  q3_4: 2, // Bart
  q3_5: 2, // 4-12 weeks
  q3_6: 1, // Chalk circle technique

  // Module 4: The Sales Process
  q4_1: 2,  // Within 5 minutes
  q4_2: 1,  // Be honest, leave card
  q4_3: 2,  // Encourage it and tell them what to look for
  q4_4: 2,  // Immediately
  q4_5: 1,  // Send a thank-you text
  q4_6: 1,  // Ladder, camera/phone, measuring tool, chalk, business cards
  q4_7: 1,  // Speed of response
  q4_8: 1,  // 30-day post-installation check-in
  q4_9: 2,  // 14 days
  q4_10: 1, // Sit down and walk through each line item

  // Module 5: Using JobNimbus CRM
  q5_1: 2, // JobNimbus CRM
  q5_2: 2, // The moment something changes
  q5_3: 1, // Your task list
  q5_4: 0, // While still at the property
  q5_5: 2, // Jobs

  // Module 6: Measurement & Estimation
  q6_1: 2, // 100 sq ft
  q6_2: 1, // Rises 6 inches per 12 inches horizontal
  q6_3: 1, // 10-15%
  q6_4: 2, // Above 8/12
  q6_5: 2, // 3 bundles
  q6_6: 1, // EagleView
  q6_7: 2, // 35 squares

  // Module 7: Customer Communication
  q7_1: 1, // 4 business hours
  q7_2: 1, // Listen
  q7_3: 2, // 30 days after installation
  q7_4: 2, // Text before 8 AM or after 8 PM
  q7_5: 1, // Mismanaged expectations
};

/**
 * Module passing scores (percentage)
 */
export const SALES_MODULE_PASSING_SCORES: Record<string, number> = {
  sales_m1: 70,
  sales_m2: 70,
  sales_m3: 70,
  sales_m4: 70,
  sales_m5: 70,
  sales_m6: 70,
  sales_m7: 70,
};

/**
 * Maps moduleId to an array of question IDs for that module
 */
export const SALES_MODULE_QUESTIONS: Record<string, string[]> = {
  sales_m1: ['q1_1', 'q1_2', 'q1_3', 'q1_4', 'q1_5'],
  sales_m2: ['q2_1', 'q2_2', 'q2_3', 'q2_4', 'q2_5', 'q2_6', 'q2_7', 'q2_8'],
  sales_m3: ['q3_1', 'q3_2', 'q3_3', 'q3_4', 'q3_5', 'q3_6'],
  sales_m4: ['q4_1', 'q4_2', 'q4_3', 'q4_4', 'q4_5', 'q4_6', 'q4_7', 'q4_8', 'q4_9', 'q4_10'],
  sales_m5: ['q5_1', 'q5_2', 'q5_3', 'q5_4', 'q5_5'],
  sales_m6: ['q6_1', 'q6_2', 'q6_3', 'q6_4', 'q6_5', 'q6_6', 'q6_7'],
  sales_m7: ['q7_1', 'q7_2', 'q7_3', 'q7_4', 'q7_5'],
};

/**
 * Server-side quiz grading function.
 * Takes a moduleId and an object of { questionId: selectedAnswerIndex }
 * Returns the score percentage and whether the user passed.
 */
export function gradeQuiz(
  moduleId: string,
  answers: Record<string, number>
): { score: number; passed: boolean; correct: number; total: number } {
  const questionIds = SALES_MODULE_QUESTIONS[moduleId];
  if (!questionIds) {
    return { score: 0, passed: false, correct: 0, total: 0 };
  }

  const passingScore = SALES_MODULE_PASSING_SCORES[moduleId] ?? 70;
  let correct = 0;

  for (const qId of questionIds) {
    if (answers[qId] === SALES_QUIZ_ANSWERS[qId]) {
      correct++;
    }
  }

  const score = Math.round((correct / questionIds.length) * 100);
  const passed = score >= passingScore;

  return { score, passed, correct, total: questionIds.length };
}
