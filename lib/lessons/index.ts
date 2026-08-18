/**
 * Lesson registry — slug → Lesson for the lesson player at
 * /portal/training/lesson/[slug].
 */
import type { Lesson } from './types';
import { rickWarehouseLesson } from './rick-warehouse';
import { saraOfficeLesson } from './sara-office';
import { saraInventoryLesson } from './sara-inventory';
import { saraUsersLesson } from './sara-users';
import { saraPhoneLesson } from './sara-phone';
import { johnPmLesson } from './john-pm';
import { chrisOwnerLesson } from './chris-owner';

export type { Lesson, LessonSection, LessonBlock, LessonQuizQuestion } from './types';

export const ALL_LESSONS: Lesson[] = [
  rickWarehouseLesson,
  saraOfficeLesson,
  saraInventoryLesson,
  saraUsersLesson,
  saraPhoneLesson,
  johnPmLesson,
  chrisOwnerLesson,
];

export function getLessonBySlug(slug: string): Lesson | undefined {
  return ALL_LESSONS.find(l => l.slug === slug);
}
