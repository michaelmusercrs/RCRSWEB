/**
 * Service Page Enhancement Data
 * -----------------------------------------------------------------------------
 * Per-slug, SEO-deepening content modules consumed by the dynamic service page
 * at `app/(site)/services/[slug]/page.tsx`. Only the 5 highest-value service
 * pages have entries here; pages without an entry fall back to the default
 * dynamic render (no process / includes-not-included / related / county blocks).
 *
 * What lives here:
 *   - `process`     — How the service actually flows at RCRS, with real timing
 *                     ranges. Used to render the "How it works" section and a
 *                     HowTo JSON-LD addendum.
 *   - `includes`    — Concrete deliverables. Two-column "What's Included" list.
 *   - `notIncluded` — Honest exclusions (structural work, abatement, etc).
 *   - `related`     — 2-3 related service slugs + 1-sentence teases for the
 *                     topic-cluster cross-link section.
 *   - `counties`    — Per-county callout copy. Slugs match
 *                     `app/(site)/roofing-contractor/[county]` (madison /
 *                     morgan / marshall / limestone / cullman).
 *
 * Factual ground rules (per memory):
 *   - IKO ROOFPRO Craftsman Premier is the PRIMARY manufacturer cert; list it
 *     first when referenced. Owens Corning Preferred + Boral are secondary.
 *   - No fabricated stats, testimonials, or prizes.
 *   - "[needs-owner verification]" placeholder anywhere a fact isn't already
 *     captured in `lib/servicesData.ts` or `lib/seo.ts`.
 */

export interface ProcessStep {
  /** Short step title, e.g. "Free inspection". */
  title: string;
  /** Real timing estimate (e.g. "1-2 days", "Same-day"). */
  timing: string;
  /** One- or two-sentence description of what happens in this step. */
  description: string;
}

export interface RelatedService {
  /** Slug of the target service page (must exist in `servicesData.ts`). */
  slug: string;
  /** Title rendered in the link. */
  title: string;
  /** One-sentence tease describing why it's relevant. */
  tease: string;
}

export interface CountyCallout {
  /** County slug — must match `app/(site)/roofing-contractor/[county]` route. */
  slug: 'madison' | 'morgan' | 'marshall' | 'limestone' | 'cullman';
  /** Display name (without "County"). */
  name: string;
  /** Short callout — 1 sentence covering this service in this county. */
  copy: string;
}

export interface ServiceEnhancement {
  /** Headline above the process section. */
  processHeadline: string;
  /** Lead-in sentence under the process headline. */
  processIntro: string;
  /** 4-6 sequential steps. */
  process: ProcessStep[];
  /** Explicit list of what the service delivers. */
  includes: string[];
  /** Explicit list of what is NOT included — be honest. */
  notIncluded: string[];
  /** Topic-cluster cross-links — 2-3 other services. */
  related: RelatedService[];
}

// -----------------------------------------------------------------------------
// Counties — same callouts on every enhanced page so the topic cluster gets
// uniform link equity. Slug values match the live `/roofing-contractor/<slug>`
// routes (madison / morgan / marshall / limestone / cullman).
// -----------------------------------------------------------------------------
export const COUNTY_CALLOUTS: CountyCallout[] = [
  {
    slug: 'madison',
    name: 'Madison',
    copy: 'Huntsville, Madison, Meridianville, Hazel Green & Owens Cross Roads — North Alabama\'s largest metro and a tornado-alley hot spot for hail and wind events.',
  },
  {
    slug: 'morgan',
    name: 'Morgan',
    copy: 'Decatur (our headquarters), Hartselle, Priceville, Somerville & Trinity — fastest response times in our service area thanks to proximity to our materials yard.',
  },
  {
    slug: 'marshall',
    name: 'Marshall',
    copy: 'Albertville, Guntersville, Arab & Boaz — lakefront and elevated terrain with higher wind exposure; impact-resistant shingles strongly recommended.',
  },
  {
    slug: 'limestone',
    name: 'Limestone',
    copy: 'Athens, Ardmore & East Limestone — diverse housing stock from historic Athens homes to new builds; same-day to 2-day response.',
  },
  {
    slug: 'cullman',
    name: 'Cullman',
    copy: 'Cullman, Hanceville, Good Hope & Holly Pond — squarely in tornado alley with frequent spring storm and hail damage claims.',
  },
];

// -----------------------------------------------------------------------------
// Per-slug enhancement data. Only enhanced services have entries — the dynamic
// page falls back to the default render for everything else.
// -----------------------------------------------------------------------------
export const SERVICE_ENHANCEMENTS: Record<string, ServiceEnhancement> = {
  // ---------------------------------------------------------------------------
  // 1. Residential Roof Replacement
  // ---------------------------------------------------------------------------
  'residential-roof-replacement': {
    processHeadline: 'How a Roof Replacement Works at RCRS',
    processIntro:
      'From the first phone call to final walkthrough, here is what the residential roof replacement process actually looks like. Timing depends on weather, material availability, and insurance coordination — these are the realistic ranges.',
    process: [
      {
        title: 'Free inspection & photo documentation',
        timing: 'Same day - 2 days',
        description:
          'A licensed inspector walks the roof, documents every slope with photos, checks the attic for ventilation and prior leaks, and provides a written condition report. No obligation, no pressure.',
      },
      {
        title: 'Estimate & material selection',
        timing: 'Same day after inspection',
        description:
          'We sit down with you (in person or by phone) to walk through the inspection findings, review shingle options — including IKO Dynasty Class 4 impact-resistant — and present an itemized written estimate.',
      },
      {
        title: 'Insurance coordination (if applicable)',
        timing: '1 - 4 weeks (carrier-driven)',
        description:
          'If the replacement is being filed as a storm claim, we meet the adjuster on-site, supply our photo documentation, and negotiate scope so you only pay your deductible. Timing depends on your carrier, not on us.',
      },
      {
        title: 'Material order & scheduling',
        timing: '3 - 7 business days',
        description:
          'Once you sign, we order shingles, underlayment, drip edge, and ventilation components, and lock in a tear-off date around your schedule and the weather forecast.',
      },
      {
        title: 'Tear-off, decking inspection & install',
        timing: '1 - 3 days on-site',
        description:
          'Crews tear off the old roof down to decking, replace any rotted or delaminated plywood, install ice & water shield in valleys and around penetrations, lay synthetic underlayment, then install your new shingle system with proper ridge ventilation.',
      },
      {
        title: 'Cleanup, magnetic sweep & final walkthrough',
        timing: 'Same day as install',
        description:
          'Every yard gets a tarp protected work zone, full debris haul-off, and a magnet sweep for nails. A project manager walks the roof with you, hands over warranty paperwork, and confirms the job is right before final invoice.',
      },
    ],
    includes: [
      'Complete tear-off of existing shingles and underlayment, with disposal',
      'Decking inspection and replacement of damaged sheathing (first 1 - 2 sheets included)',
      'Ice & water shield at valleys, eaves, and around all penetrations',
      'Synthetic underlayment across the full deck',
      'New drip edge on eaves and rakes',
      'IKO Dynasty (or selected) architectural shingles',
      'Step flashing and pipe boots replaced or re-sealed as needed',
      'Ridge vent installation for balanced attic ventilation',
      'Yard protection, full debris haul-off, magnetic nail sweep',
      'IKO Cambridge manufacturer warranty + 5-year RCRS workmanship warranty',
    ],
    notIncluded: [
      'Structural framing repairs (rafter replacement, truss work) — quoted separately if found',
      'Extensive decking replacement beyond the first 1 - 2 sheets — billed per sheet at the rate disclosed in your estimate',
      'Skylight replacement (skylight flashing and re-set is included; the skylight itself is not)',
      'Gutter replacement — see our gutter and LeafX services',
      'Lead paint, asbestos, or other abatement work',
      'Solar panel removal and re-install — coordinated separately with your solar provider',
      'Interior drywall, paint, or water damage repair',
    ],
    related: [
      {
        slug: 'storm-hail-damage-repair',
        title: 'Storm & Hail Damage Repair',
        tease:
          'If your replacement is driven by a recent storm, our team handles the insurance claim from inspection through final invoice.',
      },
      {
        slug: 'roof-inspections-maintenance',
        title: 'Roof Inspections & Maintenance',
        tease:
          'Not sure your roof needs replacement yet? Start with a free inspection — many roofs have several years of life left.',
      },
      {
        slug: 'leafx-gutter-protection',
        title: 'LeafX Gutter Protection',
        tease:
          'New roof, old gutters? Bundle LeafX gutter guards during the same scheduling window for a single trip and a single deductible.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 2. Storm / Hail Damage Repair
  // ---------------------------------------------------------------------------
  'storm-hail-damage-repair': {
    processHeadline: 'How an Insurance Storm Claim Works at RCRS',
    processIntro:
      'A storm claim is a different animal than a cash repair. Here is how RCRS handles a hail or wind event from the first call to a fully restored roof — including the insurance carrier choreography that most homeowners do not want to deal with alone.',
    process: [
      {
        title: 'Free storm damage inspection',
        timing: 'Same day - 48 hours after the storm',
        description:
          'A trained storm specialist inspects every slope, documents hail bruises, wind creases, and collateral damage with measured photos, and tells you honestly whether you have a claimable loss or not. No upsell.',
      },
      {
        title: 'Emergency tarping if needed',
        timing: 'Same day',
        description:
          'If your roof is actively leaking, a crew installs a tarp the same day to stop water damage from compounding. Tarp cost is typically covered by your insurance as mitigation.',
      },
      {
        title: 'Claim filing & adjuster meeting',
        timing: '3 - 14 days after filing',
        description:
          'You file the claim with your carrier; we supply our photo report and meet the field adjuster on the roof. Having a contractor on the ladder during the adjustment dramatically improves scope accuracy.',
      },
      {
        title: 'Scope negotiation & supplements',
        timing: '1 - 3 weeks (carrier-driven)',
        description:
          'If the adjuster missed items — code upgrades, ice & water shield, decking, ventilation — we file written supplements with photos and code citations. Our office does this on your behalf at no additional cost.',
      },
      {
        title: 'Restoration / replacement',
        timing: '1 - 3 days on-site',
        description:
          'Once the claim is approved and you have signed the scope, we order material, schedule around the weather, and complete the work. You pay only your deductible.',
      },
      {
        title: 'Final invoice, depreciation release & warranty',
        timing: '1 - 2 weeks after install',
        description:
          'We submit the final invoice to your carrier to release your recoverable depreciation, walk you through the warranty paperwork, and close the claim. You are done.',
      },
    ],
    includes: [
      'Free, same-day storm damage inspection with photo report',
      'Emergency tarping (24/7 dispatch for active leaks)',
      'Full claim documentation: hail map, photos, measurements, code citations',
      'Adjuster meeting on-site — our team is on the ladder with theirs',
      'Written supplement filings if scope is missed',
      'Complete restoration: replacement of all storm-damaged roofing and accessories',
      'IKO Dynasty Class 4 impact-resistant shingles available (often premium-discount eligible)',
      'Direct insurance billing — you pay only your deductible',
      'Final invoice and depreciation release submitted on your behalf',
      'IKO Cambridge manufacturer warranty + 5-year RCRS workmanship warranty',
    ],
    notIncluded: [
      'Your deductible — that is your portion of the claim, by carrier contract',
      'Pre-existing damage unrelated to the storm event (we will tell you up front if we see it)',
      'Interior water damage repair — handled by a restoration contractor your carrier assigns',
      'Code upgrades not adopted by your local AHJ (most North Alabama jurisdictions DO require code upgrade coverage; we cite the code in our supplement)',
      'Public adjuster fees — we do not act as a public adjuster and we do not recommend hiring one in most cases',
      'Claims on roofs already past the carrier\'s wear-and-tear threshold (we will tell you up front)',
    ],
    related: [
      {
        slug: 'emergency-roof-services',
        title: 'Emergency Roof Services',
        tease:
          '24/7 emergency dispatch for active leaks — tarps and temporary patches before the claim ever opens.',
      },
      {
        slug: 'residential-roof-replacement',
        title: 'Residential Roof Replacement',
        tease:
          'Most approved hail claims become full replacements with IKO Dynasty shingles — see exactly what that scope covers.',
      },
      {
        slug: 'roof-inspections-maintenance',
        title: 'Roof Inspections & Maintenance',
        tease:
          'Not sure if you have storm damage? A free inspection takes 30 - 45 minutes and gives you a clear answer either way.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 3. Residential Roof Repair
  // ---------------------------------------------------------------------------
  'residential-roof-repair': {
    processHeadline: 'How a Roof Repair Works at RCRS',
    processIntro:
      'Most repairs are a fraction of the cost of a replacement and a fraction of the disruption. Here is how RCRS handles a typical leak, missing-shingle, or flashing repair from first call to final invoice.',
    process: [
      {
        title: 'Phone triage & dispatch',
        timing: 'Same day',
        description:
          'You describe the symptom (active leak, missing shingles, stain on a ceiling). Our office decides whether a same-day tarp, a next-day repair visit, or a full inspection is the right next step.',
      },
      {
        title: 'On-site inspection & quote',
        timing: 'Same day - 2 business days',
        description:
          'A technician walks the roof, identifies the actual point of failure (it is rarely where the ceiling stain is), and gives you a written repair quote on the spot.',
      },
      {
        title: 'Repair scheduling',
        timing: '1 - 7 days (weather-permitting)',
        description:
          'Small repairs often happen the same day as the inspection. Larger repairs that need ordered material (matching shingles, flashing kit, pipe boot) are scheduled within a week.',
      },
      {
        title: 'Repair work',
        timing: '2 - 6 hours on-site (typical)',
        description:
          'Most residential repairs are completed in a single visit by a 2-person crew. Tarps come off, shingles or flashing get replaced, sealant gets re-applied at all penetrations in the affected zone.',
      },
      {
        title: 'Water test (when appropriate)',
        timing: 'Same day as repair',
        description:
          'For repairs driven by an active interior leak, we hose-test the repaired area before leaving so you know the leak is actually solved — not just relocated.',
      },
      {
        title: 'Cleanup & 1-year repair warranty',
        timing: 'Same day',
        description:
          'Magnetic nail sweep, debris haul-off, and a written 1-year warranty on the specific repair. If the leak comes back at the repair location, we come back at no charge.',
      },
    ],
    includes: [
      'Free phone triage and dispatch decision',
      'On-site inspection with photo documentation',
      'Replacement of damaged shingles (color-matched when possible)',
      'Flashing repair or replacement at chimneys, walls, valleys, and skylights',
      'Pipe boot replacement (the #1 source of mystery leaks in North Alabama)',
      'Sealant renewal at all visible penetrations in the affected zone',
      'Hose water-test for active-leak repairs',
      'Magnetic nail sweep and full cleanup',
      '1-year written warranty on the specific repair',
    ],
    notIncluded: [
      'Interior drywall, ceiling, or paint repair — typically a homeowners-insurance claim',
      'Full roof replacement (if the roof is past its useful life, we will say so — repairing a worn-out roof is throwing money away)',
      'Structural framing repairs revealed once we open the roof',
      'Repairs to a roof currently under another contractor\'s warranty (call them first)',
      'Repairs on rentals without owner authorization',
      'Gutter and downspout repairs — see our gutter services',
    ],
    related: [
      {
        slug: 'residential-roof-replacement',
        title: 'Residential Roof Replacement',
        tease:
          'When repair costs approach 30 - 50% of replacement cost, replacement is usually the smarter move — we will tell you honestly which side of that line you are on.',
      },
      {
        slug: 'emergency-roof-services',
        title: 'Emergency Roof Services',
        tease:
          'Active leak right now? Skip ahead to our 24/7 emergency dispatch for same-day tarping.',
      },
      {
        slug: 'roof-inspections-maintenance',
        title: 'Roof Inspections & Maintenance',
        tease:
          'A repair plus annual maintenance is the cheapest way to extend a roof\'s useful life — schedule a free inspection.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 4. Roof Inspections & Maintenance
  // ---------------------------------------------------------------------------
  'roof-inspections-maintenance': {
    processHeadline: 'How a Free Roof Inspection Works at RCRS',
    processIntro:
      'Inspections are the foundation of every honest roofing decision. Here is exactly what happens during one of our free inspections — no high-pressure pitch at the end, just a written report and a recommendation.',
    process: [
      {
        title: 'Schedule your inspection',
        timing: 'Same day - 3 business days',
        description:
          'Call or submit the contact form. We confirm an arrival window (typically a 2-hour window) and confirm there is safe ladder access. You do not need to be home, but it helps for the walkthrough.',
      },
      {
        title: 'Exterior roof walk',
        timing: '20 - 30 minutes on-site',
        description:
          'A licensed inspector walks every slope (when safely accessible), checking shingle granule loss, hail bruising, wind creases, nail pops, flashing condition, pipe boots, ridge ventilation, and gutter attachment.',
      },
      {
        title: 'Attic check',
        timing: '10 - 15 minutes',
        description:
          'We look in the attic for active leaks, prior leak stains, decking condition from underneath, daylight at penetrations, and ventilation balance (intake vs. exhaust). This is where most contractors skip — and where the truth lives.',
      },
      {
        title: 'Photo documentation',
        timing: 'During inspection',
        description:
          'Every slope, every finding, every penetration is photographed. You receive the full photo set with the written report — useful even if you do not hire us, especially for insurance.',
      },
      {
        title: 'Written report & recommendation',
        timing: '1 - 2 business days after inspection',
        description:
          'You get a written report with: estimated remaining roof life, any active issues, recommended repairs (if any), and whether a claim is worth filing. If your roof is fine, we tell you so and walk away.',
      },
      {
        title: 'Annual maintenance program (optional)',
        timing: 'Once per year',
        description:
          'For roofs we have installed or recently repaired, we offer an annual maintenance program — yearly inspection, sealant renewal at penetrations, and gutter check. Adds years to roof life and keeps your warranty current.',
      },
    ],
    includes: [
      'Free initial exterior inspection (no obligation)',
      'Attic check for leak signs, decking condition, and ventilation',
      'Photo documentation of every slope and finding',
      'Hail and wind damage assessment (storm claim eligibility)',
      'Written condition report with estimated remaining roof life',
      'Honest recommendation: repair, replace, or leave alone',
      'Optional pre-purchase inspection (paid, for real-estate transactions) [needs-owner verification on current price]',
      'Optional annual maintenance program for installed roofs',
    ],
    notIncluded: [
      'Interior moisture testing or mold inspection — those require a different specialist',
      'Engineer\'s structural certification — we are roofers, not structural engineers',
      'Insurance claim filing — you file with your carrier; we attend the adjuster meeting',
      'Repair work during the inspection itself (we do not pressure-sell on-site)',
      'Inspection of roofs that are visibly unsafe to walk — we will tell you and refund nothing because the inspection is free',
    ],
    related: [
      {
        slug: 'residential-roof-repair',
        title: 'Residential Roof Repair',
        tease:
          'If the inspection turns up a leak or a missing shingle, here is how the repair flow works.',
      },
      {
        slug: 'storm-hail-damage-repair',
        title: 'Storm & Hail Damage Repair',
        tease:
          'If the inspection finds claimable hail or wind damage, we walk the storm-claim process with you.',
      },
      {
        slug: 'residential-roof-replacement',
        title: 'Residential Roof Replacement',
        tease:
          'If the roof is past its useful life, here is what a replacement actually includes — and what it does not.',
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // 5. Emergency Roof Services
  // ---------------------------------------------------------------------------
  'emergency-roof-services': {
    processHeadline: 'How a Roof Emergency Works at RCRS',
    processIntro:
      'When water is coming through your ceiling at 11pm, you need a tarp on your roof, not a sales presentation. Here is the actual emergency-call flow — designed to stop damage first and sort out paperwork second.',
    process: [
      {
        title: 'Emergency call — answered 24/7',
        timing: 'Within 30 minutes',
        description:
          'Call (256) 274-8530. Our after-hours line routes to the on-call dispatcher. We confirm address, severity, and safe access, and dispatch the closest tarp crew. [needs-owner verification — confirm true 24/7 phone coverage vs. business-hours-only with an after-hours voicemail].',
      },
      {
        title: 'Tarp crew dispatch',
        timing: '1 - 4 hours (weather and distance permitting)',
        description:
          'A 2-person tarp crew arrives with synthetic tarp, furring strips, and roofing nails. We do not tarp in lightning, but if it is safe to climb, we go up.',
      },
      {
        title: 'Emergency tarp installation',
        timing: '45 - 90 minutes on-site',
        description:
          'Synthetic tarp gets stretched over the affected slope, anchored with furring strips into solid decking, and sealed at the ridge. This is a real temporary roof — not a blue tarp held down with bricks. It is rated to last 30 - 90 days while the claim or repair is sorted out.',
      },
      {
        title: 'Interior protection & damage documentation',
        timing: 'During tarp install',
        description:
          'Crew lays plastic over interior furnishings under the leak path, photographs the active leak and the tarp install for your insurance claim, and gives you written guidance on next steps.',
      },
      {
        title: 'Permanent repair scheduling',
        timing: '1 - 14 days',
        description:
          'Once the immediate emergency is contained, we schedule the permanent repair or replacement. If insurance is involved, we wait for adjuster approval before opening the tarp.',
      },
      {
        title: 'Tarp removal & permanent fix',
        timing: 'Same day as permanent repair',
        description:
          'When the permanent repair or replacement happens, the tarp comes off and goes back to our yard. No leftover blue tarps blowing around the neighborhood.',
      },
    ],
    includes: [
      'After-hours emergency phone line',
      'Same-day tarp dispatch (weather and safety permitting)',
      'Synthetic tarp anchored with furring strips — rated for 30 - 90 days',
      'Interior plastic protection at the leak path',
      'Photo documentation of damage and tarp install (for insurance)',
      'Coordination with permanent repair or replacement scheduling',
      'Tarp removal included with permanent repair',
    ],
    notIncluded: [
      'Active-storm climbs — we do not tarp in lightning, high wind, or ice',
      'Interior water extraction or drying — call a water-mitigation company (ServPro, etc.)',
      'Drywall, paint, or flooring repair — restoration contractor work',
      'Tree removal — call a tree service first if a tree is on your roof',
      'Permanent repair material costs (separate scope, separate quote)',
      'Emergency calls outside our 15-county footprint — we will refer you to a reputable contractor in your area',
    ],
    related: [
      {
        slug: 'storm-hail-damage-repair',
        title: 'Storm & Hail Damage Repair',
        tease:
          'Once the emergency is contained, this is the full storm-claim process — including direct insurance billing.',
      },
      {
        slug: 'residential-roof-repair',
        title: 'Residential Roof Repair',
        tease:
          'For repairs that are urgent but not a true emergency, here is the standard repair workflow.',
      },
      {
        slug: 'roof-inspections-maintenance',
        title: 'Roof Inspections & Maintenance',
        tease:
          'After the emergency is fully resolved, an annual maintenance inspection prevents the next one.',
      },
    ],
  },
};

/**
 * Convenience: list of slugs that have enhancements available. Used by the
 * dynamic service page to decide whether to render the new sections.
 */
export const ENHANCED_SERVICE_SLUGS: ReadonlyArray<string> = Object.keys(
  SERVICE_ENHANCEMENTS,
);

export function getServiceEnhancement(
  slug: string,
): ServiceEnhancement | undefined {
  return SERVICE_ENHANCEMENTS[slug];
}
