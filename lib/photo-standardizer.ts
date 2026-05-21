/**
 * Photo standardizer — per stated rule (Michael 2026-05-21), all photos
 * submitted via the rep profile / customer portal pipeline get edited and
 * cropped to a consistent dark-grey-background format on approval.
 *
 * Pipeline (uses sharp — already a project dependency):
 *   1. Read the uploaded image
 *   2. Auto-orient (honor EXIF orientation)
 *   3. **Strip ALL EXIF metadata** (GPS, camera serial, etc.) — privacy
 *   4. Crop to a consistent aspect ratio per kind
 *      - headshot: 1:1 square, center crop
 *      - truck: 16:9 landscape, center crop
 *      - job-photo: 4:3 landscape, center crop
 *   5. Composite onto a dark-grey canvas with padding (consistent frame)
 *   6. Optionally watermark with customer first name (customer-portal photos)
 *   7. Output as WebP for size (or JPEG fallback)
 *
 * Returns the Buffer ready to upload to Vercel Blob.
 */
import sharp from 'sharp';

export type PhotoKind = 'headshot' | 'truck' | 'job-photo';

const DARK_GREY = '#1a1a1a';
const PADDING = 24; // px around the cropped subject

interface CanvasSpec {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
}

const CANVAS_BY_KIND: Record<PhotoKind, CanvasSpec> = {
  headshot: { width: 800,  height: 800,  innerWidth: 752,  innerHeight: 752  }, // 1:1
  truck:    { width: 1200, height: 675,  innerWidth: 1152, innerHeight: 627  }, // 16:9
  'job-photo': { width: 1200, height: 900, innerWidth: 1152, innerHeight: 852 }, // 4:3
};

export interface StandardizeOpts {
  kind: PhotoKind;
  watermarkText?: string; // e.g. customer first name; rendered as light overlay
}

export async function standardizePhoto(input: Buffer, opts: StandardizeOpts): Promise<{ buffer: Buffer; contentType: string }> {
  const spec = CANVAS_BY_KIND[opts.kind];

  // Step 1+2+3: read, auto-orient, strip EXIF (rotate() with no args applies
  // EXIF orientation then drops the metadata; .withMetadata() is NOT called
  // so output has no EXIF/GPS/camera data).
  const subject = await sharp(input)
    .rotate()
    .resize({
      width: spec.innerWidth,
      height: spec.innerHeight,
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false,
    })
    .toBuffer();

  // Build dark-grey canvas + composite the cropped subject in the center
  let canvas = sharp({
    create: {
      width: spec.width,
      height: spec.height,
      channels: 3,
      background: DARK_GREY,
    },
  })
    .composite([
      {
        input: subject,
        top: Math.floor((spec.height - spec.innerHeight) / 2),
        left: Math.floor((spec.width - spec.innerWidth) / 2),
      },
    ]);

  // Optional watermark — light translucent text in the bottom-right corner.
  // Used only for customer-portal photos (customer's first name) to discourage
  // screenshot sharing without being obnoxious.
  if (opts.watermarkText) {
    const wm = await renderWatermark(opts.watermarkText, spec.width);
    canvas = sharp(await canvas.toFormat('webp').toBuffer())
      .composite([{ input: wm, top: spec.height - 56, left: spec.width - 240 }]);
  }

  const buffer = await canvas.webp({ quality: 82 }).toBuffer();
  return { buffer, contentType: 'image/webp' };
}

/**
 * Render a small SVG watermark with the given text and rasterize via sharp.
 * Light grey, semi-transparent — visible but not insulting.
 */
async function renderWatermark(text: string, parentWidth: number): Promise<Buffer> {
  const safeText = text.replace(/[<>&"']/g, ''); // strip XML-unsafe chars
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="48" viewBox="0 0 220 48">
      <style>
        text { font-family: Arial, sans-serif; font-size: 14px; fill: rgba(255,255,255,0.45); }
      </style>
      <text x="0" y="22">River City Roofing · for ${safeText}</text>
    </svg>
  `;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
