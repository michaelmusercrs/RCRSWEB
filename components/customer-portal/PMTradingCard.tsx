'use client';

/**
 * PMTradingCard — Customer-facing "meet your Project Manager" card.
 *
 * Mounted on:
 *   - /customer/dashboard (above the rep info section)
 *   - /report/[id]       (storm/roof share page)
 *
 * Builds trust at the start of a job. Per research-portal-seo-design.md
 * Part 1 (ranked #2: "Crew/PM trading card on appointment reminders").
 *
 * Data sources:
 *   - lib/team-roles.ts holds role assignments (Bart, John = project_manager).
 *     This file confirms a slug actually belongs to a PM/team member.
 *   - lib/teamData.ts holds the rich profile fields (profileImage, bio,
 *     position, phone, email, tagline). team-roles.ts does not carry
 *     profileImage/bio, so the visual fields come from teamData.
 *
 * Certifications: per Michael's project rules, IKO ROOFPRO Craftsman
 * Premier is ALWAYS listed first; OC Preferred + Boral are secondary;
 * BBB A+ is a trust badge. These are org-level (RCRS-wide), not per-PM.
 *
 * Graceful failure: if pmSlug doesn't resolve to a real team member,
 * the component renders nothing.
 */

import NextImage from 'next/image';
import { Phone, Mail, MessageSquare, Award, Shield } from 'lucide-react';
import { teamMembers, type TeamMember } from '@/lib/teamData';
import { TEAM_MEMBERS } from '@/lib/team-roles';

export interface PMTradingCardProps {
  pmSlug: string;
  repName?: string;
}

// Company-wide certifications. IKO ROOFPRO Craftsman Premier ALWAYS first.
const RCRS_CERTIFICATIONS: string[] = [
  'IKO ROOFPRO Craftsman Premier',
  'Owens Corning Preferred',
  'Boral Certified',
  'BBB Accredited A+',
];

// RCRS founding year — used to compute "years with RCRS" when a team
// member doesn't have a launchDate of their own.
const RCRS_FOUNDED_YEAR = 2018;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function computeYearsWithRCRS(launchDate?: string): number {
  const startYear = launchDate
    ? new Date(launchDate).getFullYear()
    : RCRS_FOUNDED_YEAR;
  if (!Number.isFinite(startYear)) return 0;
  const years = new Date().getFullYear() - startYear;
  return Math.max(0, years);
}

/**
 * Resolves a PM slug to a profile. Tries teamData first (the rich source),
 * then falls back to team-roles.ts so we can still render something for
 * staff who only exist in the auth/role registry.
 */
function resolvePMProfile(pmSlug: string, repName?: string): TeamMember | null {
  if (!pmSlug) return null;
  const slug = pmSlug.trim().toLowerCase();

  const fromTeamData = teamMembers.find(m => m.slug.toLowerCase() === slug);
  if (fromTeamData) return fromTeamData;

  // Fall back to team-roles (auth registry). Build a minimal TeamMember-shaped
  // object so the rest of the component renders gracefully even without a
  // marketing profile.
  const fromRoles = TEAM_MEMBERS.find(m => m.slug.toLowerCase() === slug);
  if (fromRoles) {
    return {
      slug: fromRoles.slug,
      name: fromRoles.name,
      company: 'River City Roofing Solutions',
      category: 'Production',
      position: 'Project Manager',
      phone: fromRoles.phone || '',
      email: fromRoles.email,
      altEmail: fromRoles.email,
      displayOrder: 999,
      bio: '',
    };
  }

  // Last-ditch: caller passed a repName but slug didn't resolve. We still
  // refuse to render so we don't fabricate identity for a name we can't verify.
  void repName;
  return null;
}

export default function PMTradingCard({ pmSlug, repName }: PMTradingCardProps) {
  const profile = resolvePMProfile(pmSlug, repName);
  if (!profile) return null;

  const yearsWithRCRS = computeYearsWithRCRS(profile.launchDate);
  const phoneDigits = (profile.phone || '').replace(/[^0-9]/g, '');
  const hasPhoto = !!profile.profileImage;
  const accent = '#0066CC'; // RCRS brand accent

  return (
    <section
      className="pm-trading-card bg-white rounded-2xl border shadow-sm overflow-hidden"
      style={{ borderColor: `${accent}33` }}
      aria-label={`Your project manager: ${profile.name}`}
    >
      <div className="pm-trading-card__inner flex flex-col sm:flex-row gap-5 p-6">
        {/* Headshot / initials */}
        <div className="flex-shrink-0 mx-auto sm:mx-0">
          <div
            className="relative w-28 h-28 rounded-full overflow-hidden border-4 flex items-center justify-center bg-gray-100"
            style={{ borderColor: accent }}
          >
            {hasPhoto ? (
              <NextImage
                src={profile.profileImage as string}
                alt={`${profile.name}, ${profile.position}`}
                fill
                sizes="112px"
                className="object-cover"
              />
            ) : (
              <span
                className="text-2xl font-bold"
                style={{ color: accent }}
                aria-hidden="true"
              >
                {getInitials(profile.name)}
              </span>
            )}
          </div>
        </div>

        {/* Identity + meta */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: accent }}
          >
            Your Project Manager
          </p>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">
            {profile.name}
          </h2>
          <p className="text-sm text-gray-600">{profile.position}</p>

          {yearsWithRCRS > 0 && (
            <p className="text-xs text-gray-500 mt-1 flex items-center justify-center sm:justify-start gap-1">
              <Award className="w-3.5 h-3.5" aria-hidden="true" />
              {yearsWithRCRS} {yearsWithRCRS === 1 ? 'year' : 'years'} with River City Roofing
            </p>
          )}

          {/* Bio (short) */}
          {profile.bio && (
            <p className="text-sm text-gray-700 mt-3 leading-relaxed line-clamp-3">
              {profile.bio}
            </p>
          )}

          {/* Certifications — IKO ROOFPRO Craftsman Premier always first */}
          <ul className="mt-4 flex flex-wrap gap-1.5 justify-center sm:justify-start list-none p-0">
            {RCRS_CERTIFICATIONS.map((cert, idx) => (
              <li
                key={cert}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: idx === 0 ? `${accent}1A` : '#F3F4F6',
                  color: idx === 0 ? accent : '#374151',
                  border: idx === 0 ? `1px solid ${accent}66` : '1px solid #E5E7EB',
                }}
              >
                <Shield className="w-3 h-3" aria-hidden="true" />
                {cert}
              </li>
            ))}
          </ul>

          {/* Contact buttons */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {phoneDigits && (
              <a
                href={`tel:${phoneDigits}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: accent }}
                aria-label={`Call ${profile.name} at ${profile.phone}`}
              >
                <Phone className="w-4 h-4" />
                Call
              </a>
            )}
            {phoneDigits && (
              <a
                href={`sms:${phoneDigits}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border"
                style={{ color: accent, borderColor: `${accent}66`, backgroundColor: 'white' }}
                aria-label={`Text ${profile.name}`}
              >
                <MessageSquare className="w-4 h-4" />
                Text Me
              </a>
            )}
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-gray-100 text-gray-800 hover:bg-gray-200"
                aria-label={`Email ${profile.name} at ${profile.email}`}
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-stack tuning: <600px collapses headshot + content cleanly.
          Tailwind's sm: breakpoint is 640px, so add an explicit 600px
          override for the spec'd breakpoint. */}
      <style jsx>{`
        @media (max-width: 600px) {
          .pm-trading-card__inner {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}
