/**
 * Site Configuration — Public Feature Toggles
 *
 * Reads from admin settings (Vercel Blob / local file fallback).
 * Used by server components to conditionally render sections.
 */

export interface SiteConfig {
  showBeforeAfterGallery: boolean;
}

const DEFAULTS: SiteConfig = {
  showBeforeAfterGallery: false, // OFF by default per admin request
};

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: 'settings/site-settings.json' });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, {
        cache: 'no-store',
        next: { revalidate: 60 }, // Revalidate every 60 seconds
      });
      if (res.ok) {
        const data = await res.json();
        return {
          showBeforeAfterGallery: data.showBeforeAfterGallery ?? DEFAULTS.showBeforeAfterGallery,
        };
      }
    }
  } catch (e) {
    // Vercel Blob not available (local dev) — try local file
    try {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'data', 'site-settings.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return {
          showBeforeAfterGallery: data.showBeforeAfterGallery ?? DEFAULTS.showBeforeAfterGallery,
        };
      }
    } catch {}
  }

  return DEFAULTS;
}
