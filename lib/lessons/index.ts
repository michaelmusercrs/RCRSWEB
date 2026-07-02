/**
 * Lesson registry — slug → Lesson for the lesson player at
 * /portal/training/lesson/[slug].
 */
import type { Lesson } from './types';
import { rickWarehouseLesson } from './rick-warehouse';
import { saraOfficeLesson } from './sara-office';
import { johnPmLesson } from './john-pm';
import { chrisOwnerLesson } from './chris-owner';

export type { Lesson, LessonSection, LessonBlock, LessonQuizQuestion } from './types';

export const ALL_LESSONS: Lesson[] = [
  rickWarehouseLesson,
  saraOfficeLesson,
  johnPmLesson,
  chrisOwnerLesson,
];

export function getLessonBySlug(slug: string): Lesson | undefined {
  return ALL_LESSONS.find(l => l.slug === slug);
}
