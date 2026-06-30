/**
 * Catalog matching for parsed Material Order line items.
 *
 * Extracted from material-order-email-parser.ts so it can be unit-tested in
 * isolation (the parser module pulls in other deps). Pure — no imports.
 */

/**
 * Parse a leading product size (e.g. boot/pipe diameters) from a name.
 *
 * Only counts when the name STARTS with a digit, so an incidental number
 * mid-name (e.g. "Ridge Vent 4LF" = 4 linear feet, not a size variant) is
 * ignored. Handles "1 1/2", "1-1/2", "1/2", "1.5", and plain "2"/"3"/"4".
 * Returns the size as a number, or null when the name isn't size-led.
 */
export function parseLeadingSize(name: string): number | null {
  const trimmed = (name || '').trim();
  if (!/^\d/.test(trimmed)) return null;
  const s = trimmed.toLowerCase();
  let m: RegExpMatchArray | null;
  // whole + fraction: "1 1/2", "1-1/2"
  if ((m = s.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)/))) {
    return Number(m[1]) + Number(m[2]) / Number(m[3]);
  }
  // bare fraction: "1/2"
  if ((m = s.match(/^(\d+)\s*\/\s*(\d+)/))) {
    return Number(m[1]) / Number(m[2]);
  }
  // decimal or integer: "1.5", "2"
  if ((m = s.match(/^(\d+(?:\.\d+)?)/))) {
    return Number(m[1]);
  }
  return null;
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
  const targetSize = parseLeadingSize(parsedName);

  let bestId: string | null = null;
  let bestScore = 0;
  for (const item of catalog) {
    const candidate = item.productName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
    if (!candidate) continue;

    // Size guard: when both names are size-led, a different size disqualifies
    // this candidate outright. Mis-sizing corrupts both pricing and the stock
    // deduction, so a missed match (null) is safer than a wrong-size match.
    const candidateSize = parseLeadingSize(item.productName);
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

    const score = overlap + substringBonus + sizeBonus;
    if (score > bestScore) {
      bestScore = score;
      bestId = item.productId;
    }
  }

  // Threshold: at least one token match
  return bestScore >= 1 ? bestId : null;
}
