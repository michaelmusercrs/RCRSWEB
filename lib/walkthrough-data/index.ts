import type { WalkthroughData } from './types';
import { chrisWalkthrough } from './chris';
import { saraWalkthrough } from './sara';
import { adminOpsWalkthrough } from './admin-ops';
import { bostonWalkthrough } from './boston';
import { driversWalkthrough } from './drivers';
import { salesWalkthrough } from './sales';
import { productionWalkthrough } from './production';
import { michaelWalkthrough } from './michael';

export type { WalkthroughData, WalkthroughSection, WalkthroughStep } from './types';

export const walkthroughs: WalkthroughData[] = [
  chrisWalkthrough,
  saraWalkthrough,
  adminOpsWalkthrough,
  bostonWalkthrough,
  driversWalkthrough,
  salesWalkthrough,
  productionWalkthrough,
  michaelWalkthrough,
];

export function getWalkthroughBySlug(slug: string): WalkthroughData | undefined {
  return walkthroughs.find((w) => w.slug === slug);
}

export function getAllSlugs(): string[] {
  return walkthroughs.map((w) => w.slug);
}
