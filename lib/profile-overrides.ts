// Profile Overrides Helper
// Merges approved profile changes with the static teamData

import { promises as fs } from 'fs';
import path from 'path';
import { TeamMember } from './teamData';

const OVERRIDES_FILE = path.join(process.cwd(), 'data', 'profile-overrides.json');

// Get all profile overrides
export async function getProfileOverrides(): Promise<Record<string, Partial<TeamMember>>> {
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

  return {
    ...member,
    ...override,
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
    return applyOverride(member, override);
  });
}
