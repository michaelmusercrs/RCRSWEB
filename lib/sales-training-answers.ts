/**
 * Sales Training Quiz Answer Key — CANONICAL REBUILD
 *
 * Server-side answer validation for the rebuilt sales-training quizzes.
 * Keeping correct answers here (never in the client bundle) prevents users
 * from cheating by editing localStorage or inspecting client-side code.
 *
 * Maps: questionId -> correctIndex (0-based). Every id here corresponds to a
 * QuizQuestion in lib/sales-training-content.ts (and vice-versa). Correct
 * answers trace to CANONICAL-sales-training.md (Section E for reused items;
 * module content for the rest).
 */

export const SALES_QUIZ_ANSWERS: Record<string, number> = {
  // --- sales_c1 The Door Knock ---
  c1_1: 1, // How long have you owned the home?
  c1_2: 1, // Who you are, where you are from, and why you are there
  c1_3: 1, // "Hope I'm not bothering you." (forbidden opener)
  c1_4: 1, // "Hey there."
  c1_5: 1, // Use a short adjective bridge and move immediately to the next question

  // --- sales_c2 Qualifying the Homeowner ---
  c2_1: 1, // They are disqualified; ask them to pass your card to the owner
  c2_2: 1, // They have not had their roof inspected since the storm date
  c2_3: 1, // Yes — a power of attorney qualifies, so you proceed to Q2
  c2_4: 1, // Only if the roof was recently inspected

  // --- sales_c3 The Folder & the "Oh By The Way" ---
  c3_1: 1, // Chris and Michael
  c3_2: 1, // BBB A+ rating and Decatur Daily Best of the Best
  c3_3: 2, // As you turn to walk to your truck — the casual "Oh By The Way"
  c3_4: 1, // To establish yourself as their personal point of contact

  // --- sales_c4 Ladder & Tools ---
  c4_1: 1, // On a rake — it is very uneven
  c4_2: 1, // Roughly 20–40° — a smooth angle
  c4_3: 1, // Use a drone or ask for help
  c4_4: 1, // Cougar paws, pitch hopper, phone/pitch gauge, chalk, pen and paper, tape measure

  // --- sales_c5 The Eave Inspection Before You Step On ---
  c5_1: 1, // Peel up at the eave and identify the shingle type
  c5_2: 1, // In case it cracks or tears when you lift it
  c5_3: 1, // Valley metal or ice-and-water shield
  c5_4: 1, // To check walkability/safety — loose granules mean put on your cougar paws

  // --- sales_c6 On-Roof Hail Identification ---
  c6_1: 1, // Collateral damage — vents, chimneys, and metals
  c6_2: 1, // Soft to the touch, irregular shape, a granule or two in the center, no exposed fiberglass
  c6_3: 1, // Straight fiberglass strands, perfect circle/linear, no granules, not soft or embedded
  c6_4: 1, // The certification company whose standard defines textbook hail damage
  c6_5: 1, // Both damage AND non-damage

  // --- sales_c7 JobNimbus on the Roof + Walk-Around Photos ---
  c7_1: 1, // While you are still on the roof
  c7_2: 1, // Their name, address, and insurance company
  c7_3: 1, // Four corner-to-corner shots — front, right, left, and back
  c7_4: 1, // To protect yourself — homeowner cannot later blame you for pre-existing damage

  // --- sales_c8 Kitchen Table & Insurance Goggles ---
  c8_1: 2, // 6–10 hits
  c8_2: 1, // No — adjust it by the specific adjuster, company, and storm ("space and time")
  c8_3: 1, // Roughly 50/50 — prep for a potential denial and the reinspection out the gate
  c8_4: 1, // It is you and the homeowner versus the insurance company — technical advisor on their behalf
  c8_5: 1, // Wherever the homeowner is comfortable — do not force the kitchen table

  // --- sales_c9 The Contingency ---
  c9_1: 1, // No claim approval, no obligation
  c9_2: 1, // No — it is not a binding contract
  c9_3: 1, // Speaking with insurance as a technical advisor, and doing the work if insurance approves everything
  c9_4: 1, // Sign it first yourself, slide it across, stay silent, and start dialing the insurance company
  c9_5: 1, // RCRS's contingency is $0, while some others charge a minimum of $500 — never name competitors

  // --- sales_c10 Filing the Claim on the Phone ---
  c10_1: 2, // Over an inch
  c10_2: 1, // The claim number — write it down, photograph it, and put it in JobNimbus
  c10_3: 1, // None of this damage is old — everything is framed as current
  c10_4: 1, // It is restricted access — extra money on the claim for wheelbarrow labor hours
  c10_5: 1, // A drone or ladder assist from the adjuster

  // --- sales_c11 The Insurance Process: Adjuster to Summary ---
  c11_1: 1, // A 7 to 11 page document (a denial is typically 1–3 pages)
  c11_2: 1, // Within 48 hours
  c11_3: 1, // Deductible + any rotted wood/decking + any chosen upgrades
  c11_4: 1, // File for a reinspection — the homeowner's right to a second opinion
  c11_5: 1, // Scan it to a PDF and upload it to Drive

  // --- sales_c12 Close-Out, Yard Sign & Your Numbers ---
  c12_1: 1, // Easier for the adjuster to find, and keeps other roofers from bothering the homeowner
  c12_2: 1, // Three to four
  c12_3: 1, // 3 per week
  c12_4: 1, // Set the sign in the garage and put it out 48 hours before the install date

  // --- sales_s1 Product Knowledge: The IKO Line ---
  s1_1: 1, // Dynasty
  s1_2: 3, // Class 4
  s1_3: 3, // 25 years
  s1_4: 2, // Craftsman Premier
  s1_5: 1, // Ice-and-water protection on the roof deck

  // --- sales_s2 Objection Handling ---
  s2_1: 1, // In Alabama, rates can't be raised for weather-related (act of God) claims
  s2_2: 1, // "That's actually common. Let me take a fresh look..."
  s2_3: 1, // Never argue — acknowledge their concern
  s2_4: 1, // The right to a reinspection — a second opinion from a different adjuster

  // --- sales_s3 Company Knowledge ---
  s3_1: 2, // Decatur, AL
  s3_2: 1, // A+
  s3_3: 1, // Birmingham and Nashville
  s3_4: 1, // Open 24/7
  s3_5: 1, // Documenting honestly — including when there IS no damage

  // --- sales_s4 The JobNimbus Pipeline ---
  s4_1: 3, // Paid & Closed
  s4_2: 1, // While you are still on the roof
  s4_3: 1, // $386,076 in revenue was recorded as "Source Not Captured"
  s4_4: 1, // The Customer Acceptance Form
  s4_5: 2, // Submit for Approval — the hand-off from rep to office/automations
};

/**
 * Maps moduleId to an ordered array of question IDs for that module.
 * MUST exactly match the quiz arrays in lib/sales-training-content.ts.
 */
export const SALES_MODULE_QUESTIONS: Record<string, string[]> = {
  sales_c1: ['c1_1', 'c1_2', 'c1_3', 'c1_4', 'c1_5'],
  sales_c2: ['c2_1', 'c2_2', 'c2_3', 'c2_4'],
  sales_c3: ['c3_1', 'c3_2', 'c3_3', 'c3_4'],
  sales_c4: ['c4_1', 'c4_2', 'c4_3', 'c4_4'],
  sales_c5: ['c5_1', 'c5_2', 'c5_3', 'c5_4'],
  sales_c6: ['c6_1', 'c6_2', 'c6_3', 'c6_4', 'c6_5'],
  sales_c7: ['c7_1', 'c7_2', 'c7_3', 'c7_4'],
  sales_c8: ['c8_1', 'c8_2', 'c8_3', 'c8_4', 'c8_5'],
  sales_c9: ['c9_1', 'c9_2', 'c9_3', 'c9_4', 'c9_5'],
  sales_c10: ['c10_1', 'c10_2', 'c10_3', 'c10_4', 'c10_5'],
  sales_c11: ['c11_1', 'c11_2', 'c11_3', 'c11_4', 'c11_5'],
  sales_c12: ['c12_1', 'c12_2', 'c12_3', 'c12_4'],
  sales_s1: ['s1_1', 's1_2', 's1_3', 's1_4', 's1_5'],
  sales_s2: ['s2_1', 's2_2', 's2_3', 's2_4'],
  sales_s3: ['s3_1', 's3_2', 's3_3', 's3_4', 's3_5'],
  sales_s4: ['s4_1', 's4_2', 's4_3', 's4_4', 's4_5'],
};

/**
 * Module passing scores (percentage). All 16 rebuilt modules pass at 80,
 * plus the five interactive drills (client-graded by design) at 80.
 */
export const SALES_MODULE_PASSING_SCORES: Record<string, number> = {
  sales_c1: 80,
  sales_c2: 80,
  sales_c3: 80,
  sales_c4: 80,
  sales_c5: 80,
  sales_c6: 80,
  sales_c7: 80,
  sales_c8: 80,
  sales_c9: 80,
  sales_c10: 80,
  sales_c11: 80,
  sales_c12: 80,
  sales_s1: 80,
  sales_s2: 80,
  sales_s3: 80,
  sales_s4: 80,
  // Drills (tracked, not required to unlock the next module)
  sales_d1: 80,
  sales_d2: 80,
  sales_d3: 80,
  sales_d4: 80,
  sales_d5: 80,
};

/**
 * Server-side quiz grading function.
 * Takes a moduleId and an object of { questionId: selectedAnswerIndex }.
 * Returns the score percentage, whether the user passed, the correct/total
 * counts, and — on a completed grade for a known module — the correctAnswers
 * map (questionId -> correctIndex) so the client can render right/wrong.
 */
export function gradeQuiz(
  moduleId: string,
  answers: Record<string, number>
): {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  correctAnswers?: Record<string, number>;
} {
  const questionIds = SALES_MODULE_QUESTIONS[moduleId];
  if (!questionIds) {
    return { score: 0, passed: false, correct: 0, total: 0 };
  }

  const passingScore = SALES_MODULE_PASSING_SCORES[moduleId] ?? 80;
  let correct = 0;
  const correctAnswers: Record<string, number> = {};

  for (const qId of questionIds) {
    correctAnswers[qId] = SALES_QUIZ_ANSWERS[qId];
    if (answers[qId] === SALES_QUIZ_ANSWERS[qId]) {
      correct++;
    }
  }

  const score = Math.round((correct / questionIds.length) * 100);
  const passed = score >= passingScore;

  return { score, passed, correct, total: questionIds.length, correctAnswers };
}
