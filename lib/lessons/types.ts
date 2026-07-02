/**
 * Interactive Lesson content types
 *
 * Lessons are structured content blocks (NOT markdown) rendered by
 * app/(tools)/portal/training/lesson/[slug]/page.tsx. Each section can carry
 * key points and inline quiz questions. Completion + quiz score are POSTed
 * to /api/portal/training (Training_Progress sheet tab) so the office can
 * audit who finished what.
 *
 * Content rule: every claim in a lesson must describe the system AS IT IS —
 * these were written 2026-07-02 against the verified production behavior.
 * When a workflow changes, update the lesson in the same PR (see
 * project_training_platform_updates memory).
 */

export type LessonBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'bullets'; items: string[] }
  | { type: 'callout'; tone: 'tip' | 'warn' | 'info'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

export interface LessonQuizQuestion {
  question: string;
  options: string[];
  /** index into options */
  correct: number;
  explanation: string;
}

export interface LessonSection {
  title: string;
  blocks: LessonBlock[];
  keyPoints?: string[];
  quiz?: LessonQuizQuestion[];
}

export interface Lesson {
  /** URL slug: /portal/training/lesson/<slug> */
  slug: string;
  /** moduleId recorded to Training_Progress on completion */
  moduleId: string;
  title: string;
  description: string;
  /** Who this is written for — shown under the title */
  audience: string;
  estimatedMinutes: number;
  sections: LessonSection[];
}
