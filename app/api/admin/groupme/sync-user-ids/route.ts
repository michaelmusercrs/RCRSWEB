/**
 * Admin: GroupMe user_id sync (READ-ONLY against GroupMe — DOES NOT SEND)
 *
 * POST /api/admin/groupme/sync-user-ids
 *
 * What it does:
 *   1. Walks every GroupMe group the bot account is in (paginated).
 *   2. For each `TeamMember` in `lib/team-roles.ts`, finds the most likely
 *      GroupMe `user_id` by matching nicknames (exact full-name, alias,
 *      first-name) against members of every group.
 *   3. Upserts the resulting `slug → user_id` mappings into the master
 *      sheet's `Team_GroupMe_Mapping` tab (lazy-created).
 *   4. Returns a summary: matched / unmatched / ambiguous reps.
 *
 * IMPORTANT — KILL-SWITCH SAFE:
 *   This route NEVER sends a GroupMe message. It uses only the GroupMe
 *   GET endpoints (`/groups`, `/groups/:id`) which are read-only and are
 *   intentionally not gated by `checkOwnerGroupMeGuard()`. The owner's
 *   GroupMe kill-switch (GROUPME_OWNER_GUARD_OFF unset / quiet hours)
 *   only blocks the four send paths (sendBotMessage, sendMessage,
 *   sendDirectMessage, river-bot raw fetch). Reading group membership is
 *   always allowed.
 *
 * Auth: requireAdmin() — admin or owner role only.
 *
 * Manual overrides: rows in `Team_GroupMe_Mapping` with
 * `manualOverride=true` (set via the admin UI) are NEVER overwritten by
 * this route. The sync auto-confirms only auto-discovered rows.
 *
 * Matching algorithm (per team member, descending confidence):
 *   exact:       nickname.lower() == member.name.lower()
 *   alias:       nickname.lower() in member.aliases.lower()
 *   firstname:   nickname.lower().startsWith(firstName.lower() + ' ')
 *                OR nickname.lower() == firstName.lower()
 *
 *   - Inactive team members are skipped.
 *   - If multiple distinct user_ids match the same team member, the row
 *     is recorded as ambiguous and NOT auto-written. Owner can resolve in
 *     the admin UI.
 *   - First confidence tier with a unique hit wins.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { groupMeService } from '@/lib/groupme-service';
import type { GroupMeGroup, GroupMeMember } from '@/lib/groupme-service';
import { TEAM_MEMBERS, type TeamMember } from '@/lib/team-roles';
import {
  ensureTeamGroupMeMappingSheet,
  upsertMapping,
  listMappings,
  type MatchConfidence,
} from '@/lib/team-groupme-mapping';

interface SyncMatch {
  slug: string;
  name: string;
  status: 'matched' | 'unmatched' | 'ambiguous' | 'skipped-manual-override';
  groupme_user_id?: string;
  source_group_id?: string;
  source_group_name?: string;
  source_nickname?: string;
  matchConfidence?: MatchConfidence;
  candidateUserIds?: string[];
  reason?: string;
}

interface GroupCandidate {
  groupId: string;
  groupName: string;
  member: GroupMeMember;
  confidence: MatchConfidence;
}

function normalize(s: string | undefined | null): string {
  return (s || '').toLowerCase().trim();
}

function firstNameOf(fullName: string): string {
  return normalize(fullName).split(/\s+/)[0] || '';
}

/**
 * Score a single GroupMe member against a TeamMember. Returns the best
 * matching confidence tier, or null if no match.
 */
function matchTier(member: TeamMember, gm: GroupMeMember): MatchConfidence | null {
  const memberFull = normalize(member.name);
  const gmNick = normalize(gm.nickname);
  const gmRealName = normalize(gm.name);
  if (!gmNick && !gmRealName) return null;

  // exact full-name match (against either GroupMe `nickname` or `name`)
  if (memberFull && (gmNick === memberFull || gmRealName === memberFull)) {
    return 'exact';
  }

  // alias match (e.g., "Rick" for "Richard Geahr")
  if (member.aliases?.length) {
    for (const alias of member.aliases) {
      const aliasNorm = normalize(alias);
      if (!aliasNorm) continue;
      if (gmNick === aliasNorm || gmRealName === aliasNorm) return 'alias';
    }
  }

  // first-name match: "Sara" matches "Sara H." but only if first token equals
  const first = firstNameOf(member.name);
  if (first) {
    const gmFirst = gmNick.split(/\s+/)[0] || '';
    const gmRealFirst = gmRealName.split(/\s+/)[0] || '';
    if (gmFirst === first || gmRealFirst === first) return 'firstname';
  }

  return null;
}

const CONFIDENCE_RANK: Record<MatchConfidence, number> = {
  exact: 3,
  alias: 2,
  firstname: 1,
  manual: 4, // manual overrides always win — never auto-overwritten
};

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  // Bail early if GroupMe token isn't configured — better to 503 than
  // walk a noop and write empty rows.
  if (!process.env.GROUPME_ACCESS_TOKEN) {
    return NextResponse.json(
      { success: false, error: 'GROUPME_ACCESS_TOKEN not configured' },
      { status: 503 },
    );
  }

  // 1. Walk every group the bot is in (paginated).
  const allGroups: GroupMeGroup[] = [];
  let page = 1;
  const perPage = 50;
  // Hard cap on pages to avoid runaway loops if GroupMe's response shape
  // changes; 20 pages * 50 = 1000 groups, comfortably above any team.
  const MAX_PAGES = 20;
  while (page <= MAX_PAGES) {
    const res = await groupMeService.listGroups(page, perPage);
    if (!res.success || !res.data) {
      return NextResponse.json(
        { success: false, error: res.error || `listGroups failed at page ${page}` },
        { status: 502 },
      );
    }
    if (res.data.length === 0) break;
    allGroups.push(...res.data);
    if (res.data.length < perPage) break;
    page++;
  }

  // 2. listGroups returns the `omit=memberships` shape, so members[] is
  //    not populated. Re-fetch each group individually to get its full
  //    member roster.
  const groupsWithMembers: GroupMeGroup[] = [];
  for (const g of allGroups) {
    const id = g.group_id || g.id;
    if (!id) continue;
    const detail = await groupMeService.getGroup(id);
    if (detail.success && detail.data) {
      groupsWithMembers.push(detail.data);
    }
  }

  // 3. For each active team member, find candidates across all groups.
  const matches: SyncMatch[] = [];
  const activeMembers = TEAM_MEMBERS.filter(m => m.isActive);

  // Read existing manual-override rows once so we know what to skip.
  // The actual write happens via upsertMapping which double-checks too,
  // but reading once gives us a clean status to report back.
  let existingMappingsBySlug = new Map<string, boolean>();
  try {
    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const svcKey = process.env.GOOGLE_PRIVATE_KEY;
    if (sheetsId && svcEmail && svcKey) {
      const { GoogleSpreadsheet } = await import('google-spreadsheet');
      const { JWT } = await import('google-auth-library');
      const jwt = new JWT({
        email: svcEmail,
        key: svcKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const doc = new GoogleSpreadsheet(sheetsId, jwt);
      await doc.loadInfo();
      await ensureTeamGroupMeMappingSheet(doc);
      const existing = await listMappings(doc);
      existingMappingsBySlug = new Map(existing.map(m => [m.slug, m.manualOverride]));

      // 4. Walk team members, collect candidates, pick the best per member.
      for (const member of activeMembers) {
        // Skip if there's a manual override on file — never auto-overwrite.
        if (existingMappingsBySlug.get(member.slug.toLowerCase()) === true) {
          matches.push({
            slug: member.slug,
            name: member.name,
            status: 'skipped-manual-override',
            reason: 'Mapping row has manualOverride=true; sync will not touch',
          });
          continue;
        }

        const candidates: GroupCandidate[] = [];
        for (const grp of groupsWithMembers) {
          for (const gm of grp.members || []) {
            const tier = matchTier(member, gm);
            if (tier) {
              candidates.push({
                groupId: grp.group_id || grp.id,
                groupName: grp.name,
                member: gm,
                confidence: tier,
              });
            }
          }
        }

        if (candidates.length === 0) {
          matches.push({ slug: member.slug, name: member.name, status: 'unmatched' });
          continue;
        }

        // Take the highest-confidence tier we found at all.
        const bestTier = candidates.reduce<MatchConfidence>(
          (best, c) => (CONFIDENCE_RANK[c.confidence] > CONFIDENCE_RANK[best] ? c.confidence : best),
          'firstname',
        );
        const topTier = candidates.filter(c => c.confidence === bestTier);
        const uniqueUserIds = Array.from(new Set(topTier.map(c => c.member.user_id)));

        if (uniqueUserIds.length > 1) {
          // Same nickname-tier matched multiple distinct people — needs human.
          matches.push({
            slug: member.slug,
            name: member.name,
            status: 'ambiguous',
            candidateUserIds: uniqueUserIds,
            matchConfidence: bestTier,
            reason: `Multiple distinct GroupMe user_ids matched at confidence "${bestTier}"`,
          });
          continue;
        }

        const winner = topTier[0];
        const result = await upsertMapping(doc, {
          slug: member.slug.toLowerCase(),
          name: member.name,
          groupme_user_id: winner.member.user_id,
          source_group_id: winner.groupId,
          source_nickname: winner.member.nickname || winner.member.name,
          matchConfidence: bestTier,
          manualOverride: false,
        });

        if (result.skipped === 'manual-override') {
          matches.push({
            slug: member.slug,
            name: member.name,
            status: 'skipped-manual-override',
            reason: 'Existing row has manualOverride=true',
          });
        } else {
          matches.push({
            slug: member.slug,
            name: member.name,
            status: 'matched',
            groupme_user_id: winner.member.user_id,
            source_group_id: winner.groupId,
            source_group_name: winner.groupName,
            source_nickname: winner.member.nickname || winner.member.name,
            matchConfidence: bestTier,
          });
        }
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error:
            'Google Sheets credentials not configured (GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)',
        },
        { status: 503 },
      );
    }
  } catch (err) {
    console.error('[GROUPME SYNC] failed', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'sync failed' },
      { status: 500 },
    );
  }

  const summary = {
    groupsScanned: groupsWithMembers.length,
    teamMembersConsidered: activeMembers.length,
    matched: matches.filter(m => m.status === 'matched').length,
    unmatched: matches.filter(m => m.status === 'unmatched').length,
    ambiguous: matches.filter(m => m.status === 'ambiguous').length,
    skippedManual: matches.filter(m => m.status === 'skipped-manual-override').length,
  };

  return NextResponse.json({
    success: true,
    summary,
    matches,
    note: 'GroupMe READ-ONLY — no messages were sent.',
  });
}

/**
 * Convenience GET that returns the current state of the mapping tab
 * without running the sync. Used by the admin UI table on page load.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!sheetsId || !svcEmail || !svcKey) {
    return NextResponse.json({ success: true, mappings: [], configured: false });
  }

  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');
    const jwt = new JWT({
      email: svcEmail,
      key: svcKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const doc = new GoogleSpreadsheet(sheetsId, jwt);
    await doc.loadInfo();
    const mappings = await listMappings(doc);
    return NextResponse.json({ success: true, mappings, configured: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'read failed' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/groupme/sync-user-ids
 *
 * Manual override / edit from the admin UI. Body:
 *   { slug: string, groupme_user_id: string }
 *
 * Writes a row with `manualOverride=true`; future sync runs will leave it
 * alone. Setting `groupme_user_id` to empty string clears the override.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  let body: { slug?: string; groupme_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const slug = (body.slug || '').trim().toLowerCase();
  const userId = (body.groupme_user_id || '').trim();
  if (!slug) {
    return NextResponse.json({ success: false, error: 'slug is required' }, { status: 400 });
  }

  const member = TEAM_MEMBERS.find(m => m.slug.toLowerCase() === slug);
  if (!member) {
    return NextResponse.json({ success: false, error: `Unknown team slug: ${slug}` }, { status: 404 });
  }

  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!sheetsId || !svcEmail || !svcKey) {
    return NextResponse.json(
      { success: false, error: 'Sheet credentials not configured' },
      { status: 503 },
    );
  }

  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');
    const jwt = new JWT({
      email: svcEmail,
      key: svcKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(sheetsId, jwt);
    await doc.loadInfo();

    const result = await upsertMapping(doc, {
      slug,
      name: member.name,
      groupme_user_id: userId,
      source_group_id: '',
      source_nickname: '',
      matchConfidence: 'manual',
      manualOverride: true,
    });

    return NextResponse.json({ success: true, updated: result.updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'patch failed' },
      { status: 500 },
    );
  }
}
