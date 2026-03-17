import type { Metadata } from 'next';

/**
 * Helper to generate metadata for Portal pages.
 * All portal pages are internal (behind auth) so they are noindexed.
 */
export function portalMetadata(title: string, description?: string): Metadata {
  return {
    title: `${title} | RoofStack Portal`,
    description: description || `RCRS ${title}`,
    robots: { index: false, follow: false },
  };
}
