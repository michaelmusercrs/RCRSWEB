/**
 * Catalog matching for parsed Material Order line items.
 *
 * Extracted from material-order-email-parser.ts so it can be unit-tested in
 * isolation (the parser module pulls in other deps). Pure — no imports.
 */

/** Convert a size token like "1 1/2", "1-1/2", "1/2", "1.5", "2" to a number. */
function sizeTokenToNumber(tok: string): number | null {
  const s = tok.trim().toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)/))) {
    return Number(m[1]) + Number(m[2]) / Number(m[3]);
  }
  if ((m = s.match(/^(\d+)\s*\/\s*(\d+)/))) {
    return Number(m[1]) / Number(m[2]);
  }
  if ((m = s.match(/^(\d+(?:\.\d+)?)/))) {
    return Number(m[1]);
  }
  return null;
}

/**
 * Parse a leading product size (e.g. boot/pipe diameters) from a name.
 *
 * Only counts when the name STARTS with a digit, so an incidental number
 * mid-name (e.g. "Ridge Vent 4LF" = 4 linear feet, not a size variant) is
 * ignored. Handles "1 1/2", "1-1/2", "1/2", "1.5", and plain "2"/"3"/"4".
 * Returns the size as a number, or null when the name isn't size-led.
 *
 * This matches the CATALOG side, whose boot SKUs are size-led
 * (e.g. `2" Black Bullet Boot`).
 */
export function parseLeadingSize(name: string): number | null {
  const trimmed = (name || '').trim();
  if (!/^\d/.test(trimmed)) return null;
  return sizeTokenToNumber(trimmed);
}

/**
 * Parse a boot diameter from anywhere in a boot description.
 *
 * The Material Order PDFs describe boots with the size in the MIDDLE of the
 * line, not at the start — e.g. `Bullet Boot New Roof 3 Black`,
 * `Bullet Boot New Roof 2 Black`, `Bullet Boot New Roof 1 1/2 Black`. Because
 * `parseLeadingSize` only reads a leading digit, every one of those returned
 * null and the size guard never engaged, so 2"/3"/4" boots all collapsed onto
 * the first bullet-boot SKU in the catalog (INV-0006, 1½"). This helper
 * recovers the size so the guard can do its job.
 *
 * Only fires for names containing "boot" so it never mis-reads a size out of a
 * non-boot description. Returns null for the Zipper Boot (no numeric diameter).
 */
export function parseBootSize(name: string): number | null {
  const raw = (name || '').trim();
  if (!/boot/i.test(raw)) return null;
  // Prefer a leading size when present (catalog SKUs are size-led).
  const leading = parseLeadingSize(raw);
  if (leading !== null) return leading;
  const s = raw.toLowerCase();
  // Size = the number (optionally a fraction) that precedes a color word.
  // Order lines read "...New Roof <size> Black" / "... Brown" / "... Weatherwood".
  let m = s.match(
    /(\d+(?:[\s-]+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+)\s*(?:"|inch|in\b)?\s*(?:black|brown|weatherwood|tan|gr[ae]y|white)/,
  );
  if (m) return sizeTokenToNumber(m[1]);
  // Fallback: any explicitly inch-marked number (e.g. `2"`, `3 inch`).
  m = s.match(/(\d+(?:[\s-]+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+)\s*(?:"|inch|in\b)/);
  if (m) return sizeTokenToNumber(m[1]);
  return null;
}

/** Best size signal for an item name — leading size, else boot mid-string size. */
function productSize(name: string): number | null {
  const leading = parseLeadingSize(name);
  if (leading !== null) return leading;
  return parseBootSize(name);
}

/**
 * Match a parsed item name to a catalog product. Uses substring + token
 * intersection scoring, with a hard size guard so products that differ only
 * by a leading size (e.g. 1½" / 2" / 3" / 4" Black Bullet Boot) never collapse
 * onto the wrong SKU. Returns the best match above a threshold or null.
 */
export function matchCatalogItem(
  parsedName: string,
  catalog: Array<{ productId: string; productName: string }>,
): string | null {
  if (!parsedName) return null;
  const target = parsedName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
  if (!target) return null;
  const targetTokens = new Set(target.split(/\s+/).filter(t => t.length > 1));
  const targetSize = productSize(parsedName);
  const targetIsBoot = /boot/i.test(parsedName);
  const targetIsZipper = /zipper/i.test(parsedName);

  let bestId: string | null = null;
  let bestScore = 0;
  for (const item of catalog) {
    const candidate = item.productName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
    if (!candidate) continue;

    const candidateIsBoot = /boot/i.test(item.productName);
    const candidateIsZipper = /zipper/i.test(item.productName);

    // Zipper guard: a Zipper Boot and a (numbered) Bullet Boot are different
    // SKUs at different prices. When matching against a boot candidate, the
    // zipper-ness must agree, so a zipper order never lands on a bullet boot
    // and a bullet order never lands on the zipper SKU.
    if (candidateIsBoot && targetIsBoot && targetIsZipper !== candidateIsZipper) {
      continue;
    }

    // Size guard: when both names carry a size, a different size disqualifies
    // this candidate outright. Mis-sizing corrupts both pricing and the stock
    // deduction, so a missed match (null) is safer than a wrong-size match.
    const candidateSize = productSize(item.productName);
    if (targetSize !== null && candidateSize !== null && targetSize !== candidateSize) {
      continue;
    }

    const candidateTokens = new Set(candidate.split(/\s+/).filter(t => t.length > 1));

    // Token intersection
    let overlap = 0;
    for (const t of targetTokens) if (candidateTokens.has(t)) overlap++;
    if (overlap === 0) continue;

    // Bonus for substring match in either direction
    const substringBonus =
      candidate.includes(target) || target.includes(candidate) ? 2 : 0;

    // Bonus for an exact size match so the right-sized SKU beats substring luck
    const sizeBonus =
      targetSize !== null && candidateSize !== null && targetSize === candidateSize ? 3 : 0;

    // Bonus for a zipper↔zipper agreement so "Zipper Boot" beats bullet-boot
    // token overlap ("boot") decisively.
    const zipperBonus = targetIsZipper && candidateIsZipper ? 3 : 0;

    const score = overlap + substringBonus + sizeBonus + zipperBonus;
    if (score > bestScore) {
      bestScore = score;
      bestId = item.productId;
    }
  }

  // Threshold: at least one token match
  return bestScore >= 1 ? bestId : null;
}
