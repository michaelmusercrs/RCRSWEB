import type { Metadata } from 'next';

/**
 * Helper to generate metadata for Command Center pages.
 * All CC pages are internal (behind auth) so they are noindexed.
 * The parent layout uses a title template: "%s | RoofStack Command Center"
 */
export function ccMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description: description || `RCRS ${title} management`,
    robots: { index: false, follow: false },
  };
}
