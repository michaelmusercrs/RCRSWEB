// Profile Overrides Helper
// Merges approved profile changes with the static teamData

import { promises as fs } from 'fs';
import path from 'path';
import { TeamMember } from './teamData';

const BLOB_KEY = 'data/profile-overrides.json';
const OVERRIDES_FILE = path.join(process.cwd(), 'data', 'profile-overrides.json');

// Get all profile overrides (tries Vercel Blob first, then local file)
export async function getProfileOverrides(): Promise<Record<string, Partial<TeamMember>>> {
  // Try Vercel Blob first
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: BLOB_KEY });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch { /* blob not available */ }

  // Fall back to local file
  try {
    const data = await fs.readFile(OVERRIDES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Get override for a specific team member
export async function getProfileOverride(slug: string): Promise<Partial<TeamMember> | null> {
  const overrides = await getProfileOverrides();
  return overrides[slug] || null;
}

// Apply overrides to a team member
export function applyOverride(member: TeamMember, override: Partial<TeamMember> | null): TeamMember {
  if (!override) return member;

  // Filter out internal fields
  const { ...clean } = override;
  delete (clean as Record<string, unknown>)['_lastUpdated'];

  return {
    ...member,
    ...clean,
    // Ensure arrays are properly merged (replace, not concat)
    keyStrengths: override.keyStrengths || member.keyStrengths,
    responsibilities: override.responsibilities || member.responsibilities,
  };
}

// Get team member with overrides applied
export async function getTeamMemberWithOverrides(
  member: TeamMember
): Promise<TeamMember> {
  const override = await getProfileOverride(member.slug);
  return applyOverride(member, override);
}

// Get all team members with overrides applied
export async function getAllTeamMembersWithOverrides(
  members: TeamMember[]
): Promise<TeamMember[]> {
  const overrides = await getProfileOverrides();

  return members.map((member) => {
    const override = overrides[member.slug];
    return applyOverride(member, override || null);
  });
}
