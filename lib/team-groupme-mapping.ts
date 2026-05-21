/**
 * Team → GroupMe user_id mapping (sheet-backed)
 *
 * Records the GroupMe `user_id` for each `TeamMember` so portal-messaging
 * (rep-notify and DM paths) can resolve `slug → user_id` in O(1) instead
 * of walking every GroupMe group and matching nicknames every send.
 *
 * Why this exists: `lib/team-roles.ts` `TeamMember` records carry name,
 * slug, aliases — but not `groupme_user_id`, because GroupMe user_ids are
 * per-account opaque identifiers that aren't known until the bot has seen
 * the user in a group. The sweep/portal-messaging branch has a `[needs-
 * owner]` for this exact gap: today the rep-notify code walks all bot
 * groups and best-effort matches by nickname every send. This module is
 * the infrastructure to retire that walk.
 *
 * Tab: `Team_GroupMe_Mapping` on the master sheet. Lazy-created.
 *
 * Schema:
 *   slug              - TeamMember.slug (primary key, lower-case)
 *   name              - TeamMember.name (denormalized for the admin UI)
 *   groupme_user_id   - GroupMe user_id (opaque string)
 *   source_group_id   - which GroupMe group the match was found in
 *   source_nickname   - the matched nickname from that group
 *   matchConfidence   - 'exact' | 'firstname' | 'alias' | 'manual'
 *   manualOverride    - 'true' if set by hand in the admin UI; the
 *                       sync route will NEVER overwrite a manualOverride row
 *   mappedAt          - ISO timestamp of last write
 *
 * Read path: `lib/portal-messaging-service.ts` `resolveRepGroupMeUserId(slug)`
 * (on the sweep branch — not on main yet) should call `getMappingForSlug`
 * before falling back to the existing nickname-walk. This module exists on
 * main so the sweep branch can adopt it on rebase.
 */

import type { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

export const TEAM_GROUPME_MAPPING_TAB = 'Team_GroupMe_Mapping';

export const TEAM_GROUPME_MAPPING_HEADERS = [
  'slug',
  'name',
  'groupme_user_id',
  'source_group_id',
  'source_nickname',
  'matchConfidence',
  'manualOverride',
  'mappedAt',
] as const;

export type MatchConfidence = 'exact' | 'firstname' | 'alias' | 'manual';

export interface TeamGroupMeMapping {
  slug: string;
  name: string;
  groupme_user_id: string;
  source_group_id: string;
  source_nickname: string;
  matchConfidence: MatchConfidence;
  manualOverride: boolean;
  mappedAt: string;
}

/** Lazy-create the Team_GroupMe_Mapping tab and return the worksheet. */
export async function ensureTeamGroupMeMappingSheet(
  doc: GoogleSpreadsheet,
): Promise<GoogleSpreadsheetWorksheet> {
  let sheet = doc.sheetsByTitle[TEAM_GROUPME_MAPPING_TAB];
  if (!sheet) {
    sheet = await doc.addSheet({
      title: TEAM_GROUPME_MAPPING_TAB,
      headerValues: [...TEAM_GROUPME_MAPPING_HEADERS],
    });
  } else {
    await sheet.loadHeaderRow().catch(() => undefined);
  }
  return sheet;
}

/** Read all mapping rows (deserialized). Skips rows missing a slug. */
export async function listMappings(
  doc: GoogleSpreadsheet,
): Promise<TeamGroupMeMapping[]> {
  const sheet = await ensureTeamGroupMeMappingSheet(doc);
  const rows = await sheet.getRows();
  const out: TeamGroupMeMapping[] = [];
  for (const row of rows) {
    const slug = (row.get('slug') || '').trim().toLowerCase();
    if (!slug) continue;
    out.push({
      slug,
      name: row.get('name') || '',
      groupme_user_id: row.get('groupme_user_id') || '',
      source_group_id: row.get('source_group_id') || '',
      source_nickname: row.get('source_nickname') || '',
      matchConfidence: ((row.get('matchConfidence') || 'manual') as MatchConfidence),
      manualOverride: String(row.get('manualOverride') || '').toLowerCase() === 'true',
      mappedAt: row.get('mappedAt') || '',
    });
  }
  return out;
}

/** Fetch a single mapping by team slug; returns null when absent. */
export async function getMappingForSlug(
  doc: GoogleSpreadsheet,
  slug: string,
): Promise<TeamGroupMeMapping | null> {
  const target = (slug || '').trim().toLowerCase();
  if (!target) return null;
  const all = await listMappings(doc);
  return all.find(m => m.slug === target) || null;
}

/**
 * Upsert a mapping for a given slug. If a row with the same slug already
 * exists AND it has `manualOverride=true`, the upsert is a no-op (returns
 * `{ updated: false, skipped: 'manual-override' }`). Otherwise the row is
 * updated in place, or appended if missing.
 *
 * `manualOverride` flag on input: pass true only for explicit admin
 * edits from the UI; the sync route should always pass false.
 */
export async function upsertMapping(
  doc: GoogleSpreadsheet,
  entry: Omit<TeamGroupMeMapping, 'mappedAt'>,
): Promise<{ updated: boolean; skipped?: 'manual-override' }> {
  const sheet = await ensureTeamGroupMeMappingSheet(doc);
  const rows = await sheet.getRows();
  const targetSlug = entry.slug.trim().toLowerCase();
  const existing = rows.find(r => (r.get('slug') || '').trim().toLowerCase() === targetSlug);

  if (existing) {
    const isManual = String(existing.get('manualOverride') || '').toLowerCase() === 'true';
    if (isManual && !entry.manualOverride) {
      return { updated: false, skipped: 'manual-override' };
    }
    existing.set('name', entry.name);
    existing.set('groupme_user_id', entry.groupme_user_id);
    existing.set('source_group_id', entry.source_group_id);
    existing.set('source_nickname', entry.source_nickname);
    existing.set('matchConfidence', entry.matchConfidence);
    existing.set('manualOverride', String(entry.manualOverride));
    existing.set('mappedAt', new Date().toISOString());
    await existing.save();
    return { updated: true };
  }

  await sheet.addRow({
    slug: targetSlug,
    name: entry.name,
    groupme_user_id: entry.groupme_user_id,
    source_group_id: entry.source_group_id,
    source_nickname: entry.source_nickname,
    matchConfidence: entry.matchConfidence,
    manualOverride: String(entry.manualOverride),
    mappedAt: new Date().toISOString(),
  });
  return { updated: true };
}
