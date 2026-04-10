'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Home,
  Command,
  BookOpen,
  CheckCircle2,
  XCircle,
  Lock,
  ChevronDown,
  ChevronRight,
  Award,
  Target,
  RotateCcw,
  Building2,
  Package,
  FileText,
  Handshake,
  Monitor,
  Ruler,
  MessageSquare,
  Lightbulb,
  AlertTriangle,
  Trophy,
  GraduationCap,
  Printer,
} from 'lucide-react';
import SettingsMenu from '@/components/SettingsMenu';
import { useAuth } from '@/lib/auth-context';

// ============================================================================
// TYPES
// ============================================================================

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface ContentSection {
  heading: string;
  content: string[];
  proTips?: string[];
}

interface SalesModule {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  estimatedMinutes: number;
  sections: ContentSection[];
  quiz: QuizQuestion[];
  passingScore: number; // percentage needed to pass (e.g. 70)
}

interface ModuleProgress {
  score: number;
  passed: boolean;
  completedAt: string;
}

// ============================================================================
// MODULE DATA
// ============================================================================

const salesModules: SalesModule[] = [
  // -------------------------------------------------------------------------
  // MODULE 1: Company Overview
  // -------------------------------------------------------------------------
  {
    id: 'sales_m1',
    title: 'Company Overview',
    description: 'RCRS history, mission, values, service areas, and team structure.',
    icon: Building2,
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'About River City Roofing Solutions',
        content: [
          'River City Roofing Solutions (RCRS) is a family-owned roofing company built on a foundation of integrity, quality, and community. Founded by the Muse family, the company has grown from a small local operation into a multi-region roofing contractor serving homeowners across the Southeast.',
          'Our name reflects our roots along the Tennessee River in Huntsville, Alabama, and our commitment to serving the communities where we live and work.',
        ],
      },
      {
        heading: 'Mission & Values',
        content: [
          'MISSION: To protect every home we touch with honest assessments, quality craftsmanship, and an unwavering commitment to doing right by the homeowner.',
          'CORE VALUES:',
          '- Integrity First: We tell every homeowner the truth about their roof, even if it means we do not make the sale.',
          '- Family Culture: Our team operates like a family. We support each other and hold each other accountable.',
          '- Quality Over Shortcuts: We use premium materials and proven installation practices on every job.',
          '- Customer Education: An informed homeowner makes better decisions. We take time to explain the process.',
          '- Community Involvement: We give back through sponsorships, coaching, volunteering, and local partnerships.',
        ],
        proTips: [
          'Homeowners can tell when you genuinely care versus when you are just selling. Lead with the values and the sales follow.',
        ],
      },
      {
        heading: 'Service Areas',
        content: [
          'RCRS operates across multiple regions in the Southeast:',
          '- Huntsville, Alabama (HQ) - Our home market and largest presence.',
          '- Birmingham, Alabama - Regional expansion led by Hunter.',
          '- Nashville, Tennessee - Regional expansion led by Aaron.',
          '- Chattanooga, Tennessee - Growing market.',
          '- Memphis, Tennessee - Growing market.',
          'Each region has a Regional Partner who leads local operations, sales, and customer relationships. As the company grows, new regions may be added.',
        ],
      },
      {
        heading: 'Team Structure',
        content: [
          'LEADERSHIP:',
          '- Chris Muse, President - Oversees all operations, expert insurance negotiator, thousands of claims handled.',
          '- Michael Muse, Vice President - Leads sales & marketing strategy, team training.',
          '',
          'REGIONAL PARTNERS (Sales Inspectors):',
          '- Hunter (Birmingham), Aaron (Nashville), Greg, Brendon, Travis',
          '',
          'OFFICE TEAM:',
          '- Sara Hill (Office Manager), Tia (Admin), Boston (Marketing Director), Destin (Admin)',
          '',
          'PRODUCTION TEAM:',
          '- John (Production Manager), Bart (Insurance Claims Specialist), Tae (Materials Manager), Richard (Driver)',
          '',
          'ADVISORS:',
          '- Donnie Dotson (Strategic Advisor)',
          '',
          'As a new sales hire, you will work closely with the leadership team and other sales inspectors. Your direct support comes from the office team for scheduling and Bart for insurance claim guidance.',
        ],
        proTips: [
          'Learn everyone\'s name and role quickly. Knowing who to call for what saves you time and makes you more effective.',
          'Chris and Michael have done every role in roofing. Do not hesitate to ask them questions -- they have been where you are.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q1_1',
        question: 'Where is RCRS headquartered?',
        options: ['Nashville, TN', 'Birmingham, AL', 'Huntsville, AL', 'Memphis, TN'],
        correctIndex: 2,
        explanation: 'RCRS is headquartered in Huntsville, Alabama, along the Tennessee River.',
      },
      {
        id: 'q1_2',
        question: 'Which of the following is NOT one of RCRS\'s core values?',
        options: ['Integrity First', 'Lowest Price Guarantee', 'Quality Over Shortcuts', 'Customer Education'],
        correctIndex: 1,
        explanation: 'RCRS does not compete on being the cheapest. Our values focus on integrity, quality, family culture, customer education, and community.',
      },
      {
        id: 'q1_3',
        question: 'Who is the Insurance Claims Specialist at RCRS?',
        options: ['Hunter', 'John', 'Bart', 'Tae'],
        correctIndex: 2,
        explanation: 'Bart is the Insurance Claims Specialist who helps homeowners and the sales team navigate insurance claims.',
      },
      {
        id: 'q1_4',
        question: 'Who leads the Birmingham regional expansion?',
        options: ['Aaron', 'Greg', 'Hunter', 'Travis'],
        correctIndex: 2,
        explanation: 'Hunter is the Regional Partner leading the Birmingham expansion.',
      },
      {
        id: 'q1_5',
        question: 'What is the primary role of the Production Manager?',
        options: [
          'Selling roofs to homeowners',
          'Managing marketing campaigns',
          'Overseeing installation projects and crew coordination',
          'Processing insurance claims',
        ],
        correctIndex: 2,
        explanation: 'John, the Production Manager, oversees all roofing installation projects and coordinates crew schedules.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MODULE 2: Roofing Products & Materials
  // -------------------------------------------------------------------------
  {
    id: 'sales_m2',
    title: 'Roofing Products & Materials',
    description: 'Shingle types, brands, underlayment, flashing, ventilation, and metal roofing.',
    icon: Package,
    estimatedMinutes: 25,
    passingScore: 80,
    sections: [
      {
        heading: 'Shingle Types',
        content: [
          'Understanding shingle types is critical. You need to identify what a homeowner currently has and recommend the right upgrade.',
          '',
          '3-TAB SHINGLES:',
          '- Flat, uniform appearance with three "tabs" per strip.',
          '- Least expensive option. Thinner and lighter weight.',
          '- Typical warranty: 20-25 years.',
          '- Being phased out of the market. Most manufacturers are discontinuing them.',
          '- If a homeowner has 3-tab, they will likely upgrade to architectural.',
          '',
          'ARCHITECTURAL (DIMENSIONAL) SHINGLES:',
          '- Multi-layered, textured appearance with depth and shadow lines.',
          '- Industry standard for residential roofing today.',
          '- Heavier and more durable than 3-tab.',
          '- Typical warranty: 30 years to Lifetime.',
          '- Better wind resistance (up to 130 mph for premium lines).',
          '- This is what most homeowners will get.',
          '',
          'DESIGNER / LUXURY SHINGLES:',
          '- Premium shingles that mimic slate, cedar shake, or tile.',
          '- Heaviest and most durable asphalt option.',
          '- Highest cost but dramatic curb appeal improvement.',
          '- Lifetime warranties with enhanced coverage.',
          '- Examples: IKO Royal Estate, GAF Grand Canyon, Owens Corning Berkshire.',
        ],
        proTips: [
          'On every inspection, identify the current shingle type and age. This helps set expectations for what insurance will cover.',
          'Architectural shingles are the sweet spot of value -- push these as the standard recommendation.',
        ],
      },
      {
        heading: 'Major Brands We Work With',
        content: [
          'IKO:',
          '- Our most commonly used brand.',
          '- IKO Dynasty: Impact-resistant, Class 4 hail rating, excellent wind resistance.',
          '- IKO Nordic: Heavy-duty architectural with premium look.',
          '- IKO Cambridge: Solid mid-range architectural shingle.',
          '- IKO Royal Estate: Designer line, mimics natural slate.',
          '',
          'GAF:',
          '- Largest shingle manufacturer in North America.',
          '- Timberline HDZ: Industry-leading architectural shingle.',
          '- Grand Canyon: Designer layered shingle with incredible depth.',
          '- GAF offers strong contractor certification programs.',
          '',
          'OWENS CORNING:',
          '- Known for the pink panther branding.',
          '- Duration series: Patented SureNail technology for wind resistance.',
          '- Berkshire: Premium designer shingle.',
          '- Strong warranty programs.',
          '',
          'CERTAINTEED:',
          '- Landmark series: Reliable architectural shingle.',
          '- Grand Manor: Ultra-premium designer line.',
          '- Known for excellent color options.',
        ],
        proTips: [
          'Know Chris\'s favorite: IKO Royal Estate in Shadow Slate. Know Michael\'s favorite: IKO Nordic in Granite Black. These come up in conversation.',
          'Most insurance claims will cover standard architectural shingles. If the homeowner wants designer, they pay the upgrade difference.',
        ],
      },
      {
        heading: 'Underlayment, Flashing & Ventilation',
        content: [
          'UNDERLAYMENT:',
          '- The waterproof barrier installed directly on the roof deck before shingles.',
          '- Synthetic underlayment is the modern standard (replaces felt paper).',
          '- Ice & water shield: Self-adhesive membrane for valleys, edges, and penetrations.',
          '- Building code requires ice & water shield in vulnerable areas.',
          '',
          'FLASHING:',
          '- Metal strips/pieces installed where the roof meets a wall, chimney, pipe, skylight, or valley.',
          '- Prevents water from seeping into joints and transitions.',
          '- Common types: step flashing (walls), chimney flashing, pipe boots, valley flashing.',
          '- Old or improperly installed flashing is a top cause of leaks.',
          '',
          'VENTILATION:',
          '- Proper attic ventilation extends roof life and prevents ice dams.',
          '- Ridge vents: Run along the peak of the roof. Preferred modern method.',
          '- Soffit vents: Intake vents at the eave/overhang.',
          '- The system works together: air enters at soffits, exits at ridge.',
          '- Inadequate ventilation voids many shingle warranties.',
        ],
        proTips: [
          'Always mention ventilation during your inspection. Many homeowners have no idea it affects their roof warranty.',
          'Flashing issues are the number one thing homeowners miss. Point these out on every inspection.',
        ],
      },
      {
        heading: 'Metal Roofing Options',
        content: [
          'Metal roofing is a growing segment of the residential market.',
          '',
          'STANDING SEAM:',
          '- Premium metal roof with concealed fasteners.',
          '- 40-70 year lifespan. Extremely durable.',
          '- Higher upfront cost (2-3x asphalt) but lower lifetime cost.',
          '- Excellent for modern and farmhouse aesthetics.',
          '',
          'METAL SHINGLES:',
          '- Metal panels stamped to look like traditional shingles, slate, or wood shake.',
          '- Lighter than standing seam, easier to install.',
          '- Good option for homeowners who want metal durability with a traditional look.',
          '',
          'CORRUGATED / R-PANEL:',
          '- Exposed fastener metal roofing.',
          '- Most affordable metal option.',
          '- Commonly used on agricultural, commercial, and utility buildings.',
          '- Less common for residential but gaining popularity for covered porches and outbuildings.',
          '',
          'Note: Insurance typically does not cover metal roof upgrades. The homeowner pays the difference between their approved claim amount and the metal roof cost.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q2_1',
        question: 'What is the industry standard shingle type for residential roofing today?',
        options: ['3-Tab', 'Architectural', 'Designer/Luxury', 'Metal'],
        correctIndex: 1,
        explanation: 'Architectural (dimensional) shingles are the current industry standard for residential roofing.',
      },
      {
        id: 'q2_2',
        question: 'Which IKO shingle has a Class 4 hail impact rating?',
        options: ['IKO Cambridge', 'IKO Royal Estate', 'IKO Dynasty', 'IKO Nordic'],
        correctIndex: 2,
        explanation: 'IKO Dynasty has a Class 4 hail impact rating, the highest available.',
      },
      {
        id: 'q2_3',
        question: 'What is the purpose of ice & water shield underlayment?',
        options: [
          'To add visual appeal to the roof',
          'To provide a self-adhesive waterproof membrane in vulnerable areas',
          'To replace the need for shingles',
          'To improve attic insulation',
        ],
        correctIndex: 1,
        explanation: 'Ice & water shield is a self-adhesive waterproof membrane installed in valleys, edges, and around penetrations.',
      },
      {
        id: 'q2_4',
        question: 'What is the most common cause of roof leaks?',
        options: [
          'Old shingles',
          'Improper or deteriorated flashing',
          'Missing ridge cap',
          'Tree damage',
        ],
        correctIndex: 1,
        explanation: 'Old or improperly installed flashing at joints, walls, chimneys, and penetrations is the top cause of leaks.',
      },
      {
        id: 'q2_5',
        question: 'Why is proper attic ventilation important?',
        options: [
          'It makes the roof look better',
          'It is only required in cold climates',
          'It extends roof life and is required to maintain shingle warranties',
          'It only matters for metal roofs',
        ],
        correctIndex: 2,
        explanation: 'Proper ventilation extends roof life, prevents ice dams, and is required by most shingle manufacturers to maintain warranty coverage.',
      },
      {
        id: 'q2_6',
        question: 'Which metal roofing type has concealed fasteners and a 40-70 year lifespan?',
        options: ['Corrugated', 'R-Panel', 'Standing Seam', 'Metal Shingles'],
        correctIndex: 2,
        explanation: 'Standing seam metal roofing features concealed fasteners and an extremely long lifespan of 40-70 years.',
      },
      {
        id: 'q2_7',
        question: 'Which shingle brand is the largest manufacturer in North America?',
        options: ['IKO', 'GAF', 'CertainTeed', 'Owens Corning'],
        correctIndex: 1,
        explanation: 'GAF is the largest shingle manufacturer in North America.',
      },
      {
        id: 'q2_8',
        question: 'If a homeowner wants to upgrade from architectural to designer shingles on an insurance claim, who pays the difference?',
        options: [
          'The insurance company covers the full upgrade',
          'RCRS absorbs the cost',
          'The homeowner pays the upgrade difference',
          'The contractor splits it with the homeowner',
        ],
        correctIndex: 2,
        explanation: 'Insurance covers replacement with like-kind materials. Any upgrade to designer or premium products is an out-of-pocket cost for the homeowner.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MODULE 3: Insurance Claim Process
  // -------------------------------------------------------------------------
  {
    id: 'sales_m3',
    title: 'Insurance Claim Process',
    description: 'How storm damage claims work, documentation, adjusters, supplements, and timelines.',
    icon: FileText,
    estimatedMinutes: 20,
    passingScore: 80,
    sections: [
      {
        heading: 'How Storm Damage Claims Work',
        content: [
          'The majority of residential roof replacements in our market are insurance claims from storm damage (hail, wind, fallen trees). Understanding this process is essential to your success.',
          '',
          'THE BASIC FLOW:',
          '1. A storm damages the roof (hail, wind, etc.).',
          '2. The homeowner contacts us (or we reach out after a storm event).',
          '3. We perform a FREE roof inspection to assess damage.',
          '4. If damage is found, we help the homeowner file a claim with their insurance company.',
          '5. The insurance company sends an adjuster to inspect the roof.',
          '6. The adjuster writes an estimate of what the insurance company will pay.',
          '7. We review the adjuster\'s estimate and negotiate if items are missing (supplement process).',
          '8. Once approved, the homeowner pays their deductible and RCRS does the work.',
          '9. The insurance company pays RCRS directly (minus the homeowner\'s deductible).',
          '',
          'IMPORTANT: We NEVER waive the homeowner\'s deductible. This is insurance fraud and is illegal. The homeowner is always responsible for their deductible.',
        ],
        proTips: [
          'Frame the inspection as "free and no obligation." Many homeowners are afraid they will owe something.',
          'Explain that filing a claim does not raise their rates for storm damage in most states. This is a common fear.',
        ],
      },
      {
        heading: 'Documenting Damage',
        content: [
          'Thorough documentation is what wins claims. Weak documentation means denied claims or lowball payouts.',
          '',
          'PHOTO REQUIREMENTS:',
          '- Wide shots of the entire roof from the ground (all sides).',
          '- Close-up shots of each area of damage (hail hits, cracked shingles, missing shingles).',
          '- Photos of flashing damage, vent damage, gutter damage.',
          '- Ground-level photos showing granule loss, debris, fallen branches.',
          '- Include a reference object for scale (coin, chalk circle) next to hail hits.',
          '- Photograph the address/house number for file identification.',
          '',
          'MEASUREMENT REQUIREMENTS:',
          '- Roof dimensions and slope/pitch.',
          '- Count of damaged areas by roof facet.',
          '- Linear feet of affected ridge, hip, and valley.',
          '- Note satellite dish locations, skylights, chimneys, and other penetrations.',
          '',
          'WRITTEN NOTES:',
          '- Date of inspection and weather conditions at time of inspection.',
          '- Approximate age of existing roof.',
          '- Type and brand of existing shingles if identifiable.',
          '- Description of damage patterns (directional hail, wind uplift areas).',
          '- Any interior damage reported by homeowner (water stains, leaks).',
        ],
        proTips: [
          'Take MORE photos than you think you need. You can never have too many. Adjusters love thorough documentation.',
          'Use a hail impact chalk circle technique: circle each hail hit with chalk and photograph it. It makes damage undeniable.',
        ],
      },
      {
        heading: 'Working with Adjusters',
        content: [
          'The insurance adjuster is not your enemy. They are a professional doing their job. Build a relationship.',
          '',
          'BEST PRACTICES:',
          '- Always be present for the adjuster\'s inspection. NEVER let the adjuster inspect alone.',
          '- Arrive early, dressed professionally. First impressions matter.',
          '- Bring your documentation and photos. Walk the roof with them.',
          '- Point out damage calmly and factually. Do not argue or be aggressive.',
          '- If you disagree with their findings, document your position professionally.',
          '- Ask questions: "I noticed this area -- could you take a look at this as well?"',
          '- Be respectful of their time and process.',
          '',
          'COMMON ADJUSTER TACTICS:',
          '- Partial approval (approving some facets but not all) -- respond with supplement.',
          '- Repair instead of replace -- provide evidence that repair is not code-compliant or practical.',
          '- Low material pricing -- supplement with current local pricing.',
          '- Omitting line items (no ice & water shield, no drip edge, etc.) -- supplement each missing item.',
        ],
        proTips: [
          'Aaron has 5 years of experience as an insurance adjuster. If you have a tough claim, ask him for advice on how the adjuster is likely thinking.',
          'Never badmouth the adjuster to the homeowner. Stay professional and let the supplement process handle disputes.',
        ],
      },
      {
        heading: 'The Supplement Process',
        content: [
          'Supplements are additional requests sent to insurance after the initial estimate if items were missed or underpriced.',
          '',
          'WHEN TO SUPPLEMENT:',
          '- Missing line items (drip edge, ice & water shield, starter strip, ridge cap).',
          '- Underpriced materials or labor.',
          '- Code upgrades required by local building codes.',
          '- Additional damage found during tear-off that was not visible during inspection.',
          '- Steep slope charges if applicable.',
          '',
          'HOW THE PROCESS WORKS:',
          '1. RCRS reviews the adjuster\'s scope/estimate line by line.',
          '2. We document missing or underpriced items with photos, measurements, and code references.',
          '3. We submit a supplement to the insurance company.',
          '4. The insurance company reviews and either approves, partially approves, or denies.',
          '5. We negotiate until we reach a fair agreement.',
          '',
          'Bart, our Insurance Claims Specialist, handles most supplement negotiations. Work closely with him on complex claims.',
        ],
      },
      {
        heading: 'Timeline Expectations',
        content: [
          'Set realistic timelines with the homeowner upfront. Nothing destroys trust faster than missed expectations.',
          '',
          'TYPICAL TIMELINE:',
          '- Inspection to claim filed: Same day or within 48 hours.',
          '- Claim filed to adjuster visit: 1-3 weeks (can be longer after major storms).',
          '- Adjuster visit to initial approval: 1-2 weeks.',
          '- Supplement process (if needed): 2-6 weeks additional.',
          '- Approval to installation: 1-3 weeks depending on schedule and material availability.',
          '- Installation (typical residential): 1-2 days.',
          '',
          'TOTAL: 4-12 weeks from inspection to completed roof, depending on claim complexity.',
          '',
          'After major storm events, all timelines stretch because adjusters are overwhelmed. Communicate this proactively.',
        ],
        proTips: [
          'Always underpromise and overdeliver on timelines. Say "4-8 weeks" and deliver in 5. The homeowner will be thrilled.',
          'Keep the homeowner updated weekly, even if there is no new info. A quick text saying "still waiting on the adjuster" goes a long way.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q3_1',
        question: 'What should you NEVER do regarding a homeowner\'s insurance deductible?',
        options: [
          'Explain what it is',
          'Waive or pay it for them',
          'Help them understand the amount',
          'Include it in the contract',
        ],
        correctIndex: 1,
        explanation: 'Waiving the homeowner\'s deductible is insurance fraud and is illegal. The homeowner is always responsible for their deductible.',
      },
      {
        id: 'q3_2',
        question: 'Why should you always be present when the insurance adjuster inspects the roof?',
        options: [
          'To argue with the adjuster',
          'It is legally required',
          'To point out damage and ensure a thorough assessment',
          'The homeowner expects you to be there for safety',
        ],
        correctIndex: 2,
        explanation: 'Being present allows you to walk the roof with the adjuster, point out damage, and ensure nothing is missed.',
      },
      {
        id: 'q3_3',
        question: 'What is a supplement in the insurance claim process?',
        options: [
          'A discount given to the homeowner',
          'An additional request for items missed or underpriced in the adjuster\'s estimate',
          'A type of shingle upgrade',
          'A second opinion from another contractor',
        ],
        correctIndex: 1,
        explanation: 'Supplements are additional requests sent to insurance to cover items that were missed, underpriced, or required by code.',
      },
      {
        id: 'q3_4',
        question: 'Who at RCRS handles most supplement negotiations?',
        options: ['Chris Muse', 'John', 'Bart', 'Sara Hill'],
        correctIndex: 2,
        explanation: 'Bart, the Insurance Claims Specialist, handles most supplement negotiations.',
      },
      {
        id: 'q3_5',
        question: 'What is the typical total timeline from inspection to completed roof?',
        options: ['1-2 days', '1-2 weeks', '4-12 weeks', '3-6 months'],
        correctIndex: 2,
        explanation: 'The typical timeline is 4-12 weeks depending on claim complexity, adjuster availability, and material scheduling.',
      },
      {
        id: 'q3_6',
        question: 'When documenting hail damage, what technique helps make damage undeniable in photos?',
        options: [
          'Using a ruler for scale',
          'Circling each hail hit with chalk and photographing it',
          'Only taking wide-angle shots',
          'Using filters on your phone camera',
        ],
        correctIndex: 1,
        explanation: 'The hail impact chalk circle technique -- circling each hit with chalk and photographing it -- makes damage clearly visible and undeniable.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MODULE 4: The Sales Process
  // -------------------------------------------------------------------------
  {
    id: 'sales_m4',
    title: 'The Sales Process',
    description: 'Lead response, contact scripts, inspections, estimates, objection handling, and closing.',
    icon: Handshake,
    estimatedMinutes: 30,
    passingScore: 80,
    sections: [
      {
        heading: 'Speed to Lead',
        content: [
          'The single most important factor in converting a lead is SPEED. The first contractor to respond wins the job 78% of the time.',
          '',
          'RESPONSE TIME TARGETS:',
          '- Phone leads: Answer or return call within 5 minutes.',
          '- Web form leads: Call within 15 minutes during business hours.',
          '- After-hours leads: Text within 30 minutes, call first thing next morning.',
          '- Referral leads: Call within 1 hour.',
          '',
          'SPEED TO LEAD IS YOUR #1 COMPETITIVE ADVANTAGE.',
          '',
          'When a homeowner requests an inspection, they are often contacting 2-3 companies. The first person who calls back professionally, sets the appointment, and shows up gets the trust.',
        ],
        proTips: [
          'Set up lead notifications on your phone so you never miss one. Every minute counts.',
          'Even if you cannot talk, a quick text saying "Hi [name], this is [you] from River City Roofing. Got your request! When is a good time to chat?" buys you time.',
        ],
      },
      {
        heading: 'Initial Customer Contact',
        content: [
          'PHONE SCRIPT FRAMEWORK:',
          '',
          '"Hi [name], this is [your name] with River City Roofing Solutions. I\'m calling about your roof inspection request. How are you today?"',
          '',
          '[Let them respond -- show genuine interest]',
          '',
          '"Great! So I understand you\'re interested in having your roof looked at. Can I ask a few quick questions?"',
          '',
          'KEY QUESTIONS TO ASK:',
          '1. "Have you noticed any specific issues -- leaks, missing shingles, storm damage?"',
          '2. "Do you know approximately how old your roof is?"',
          '3. "Are you thinking about filing an insurance claim, or looking for a repair/replacement quote?"',
          '4. "When would be a good time for one of our inspectors to come by? We offer free inspections."',
          '',
          'ALWAYS CONFIRM:',
          '- Full name and property address.',
          '- Best phone number and email.',
          '- Preferred day/time for the inspection.',
          '- Whether they need to be home (recommended for insurance work).',
          '',
          'END WITH:',
          '"Perfect, I\'ve got you scheduled for [day/time]. You\'ll be meeting with [inspector name]. We\'ll do a thorough inspection and go over everything with you -- no pressure, no obligation. Sound good?"',
        ],
        proTips: [
          'Smile when you talk on the phone. It sounds silly, but people can hear it in your voice.',
          'Never rush the call. The homeowner should feel like the most important person in the world during those 3-5 minutes.',
        ],
      },
      {
        heading: 'The On-Site Inspection',
        content: [
          'The inspection is where you build trust and demonstrate expertise. This is NOT a sales pitch -- it is a professional assessment.',
          '',
          'ARRIVAL:',
          '- Show up 5 minutes early. Never be late.',
          '- Park in the street or driveway, not on the lawn.',
          '- Wear RCRS branded shirt and clean, professional appearance.',
          '- Bring: ladder, camera/phone, measuring tool, chalk, business cards.',
          '',
          'GROUND-LEVEL WALKTHROUGH:',
          '- Start by walking the property with the homeowner.',
          '- Point out visible damage from the ground (missing shingles, gutter issues, etc.).',
          '- Explain what you will be looking for on the roof.',
          '',
          'ROOF INSPECTION:',
          '- Safely access the roof using proper ladder placement.',
          '- Systematically inspect every facet, starting from the highest point.',
          '- Document damage as described in Module 3.',
          '- Check all flashing points, ridge cap, vents, boots, and valleys.',
          '- Note the shingle type, approximate age, and number of layers.',
          '',
          'REPORTING BACK:',
          '- Come down and review findings with the homeowner.',
          '- Show photos on your phone/tablet.',
          '- Be honest: if there is no damage, say so. This builds enormous trust.',
          '- If there IS damage, explain the claim process clearly.',
          '- Do not use fear tactics. Present facts calmly.',
        ],
        proTips: [
          'If you find no damage, leave your card and say "I\'m glad your roof is in good shape. Keep my card in case anything changes." These people become your biggest referral sources.',
          'Take a before photo of the driveway before you set up your ladder. Some homeowners will claim you damaged their driveway.',
        ],
      },
      {
        heading: 'Presenting the Estimate',
        content: [
          'After the inspection (or after insurance approval), you will present an estimate to the homeowner.',
          '',
          'THE PRESENTATION:',
          '- Sit down with the homeowner. Kitchen table or living room.',
          '- Walk them through the scope of work line by line.',
          '- Explain what each item is and why it is needed.',
          '- Show material options and let them choose shingle style/color.',
          '- Discuss timeline expectations.',
          '',
          'PRICING STRUCTURE:',
          '- Insurance claims: The price is what insurance approves. Homeowner pays their deductible.',
          '- Retail (non-insurance): Provide a written estimate with all line items.',
          '- Upgrades: Clearly separate the base cost from any optional upgrades.',
          '',
          'ALWAYS PRESENT IN WRITING. A verbal quote has no credibility.',
        ],
      },
      {
        heading: 'Handling Objections',
        content: [
          'Objections are a GOOD sign -- they mean the homeowner is engaged and thinking. Here are the most common ones:',
          '',
          'OBJECTION: "Your price is too high."',
          'RESPONSE: "I understand price is important. Let me walk you through exactly what\'s included so you can compare apples to apples. Many lower quotes cut corners on materials like underlayment, ice & water shield, or starter strip. We include everything your roof needs to perform for decades."',
          '',
          'OBJECTION: "I need to get more quotes."',
          'RESPONSE: "Absolutely, I\'d encourage that. Here is what to look for when comparing: make sure they include ice & water shield, synthetic underlayment, proper flashing, and a manufacturer warranty. Also check their Google reviews and ask for references. We are confident we will stand up to any comparison."',
          '',
          'OBJECTION: "I\'m not sure I trust roofing companies."',
          'RESPONSE: "I get that -- there are some bad actors in this industry. That\'s exactly why we operate differently. We show you everything, explain every step, and our reviews speak for themselves. We\'re a family business that lives in this community. Our reputation is everything."',
          '',
          'OBJECTION: "I want to wait / not sure about the timing."',
          'RESPONSE: "I understand. The important thing to know is that storm damage claims have a time limit with most insurance companies -- usually 1-2 years. The longer you wait, the more risk of additional damage and the harder it is to get the claim approved. Would it help if I handle the paperwork so you don\'t have to worry about the deadline?"',
          '',
          'OBJECTION: "My roof looks fine to me."',
          'RESPONSE: "It can look fine from the ground and still have significant damage. Hail damage often is not visible without getting up close. Here, let me show you the photos I took. [Show close-up damage photos.] This is the kind of damage that leads to leaks 1-2 years from now if not addressed."',
        ],
        proTips: [
          'Never argue. Acknowledge, empathize, then educate.',
          'The best objection handlers are the best listeners. Let the homeowner finish their concern completely before responding.',
        ],
      },
      {
        heading: 'Closing the Deal',
        content: [
          'If you have done everything right up to this point, closing should feel natural -- not pushy.',
          '',
          'SOFT CLOSE TECHNIQUES:',
          '- "Based on everything we\'ve discussed, would you like to move forward with getting this taken care of?"',
          '- "I can have the paperwork ready for you today. Shall I go ahead and get the process started?"',
          '- "The next step is just signing the authorization so we can work with your insurance. There\'s no cost to you until the claim is approved. Ready to get started?"',
          '',
          'IF THEY NEED TIME:',
          '- "No problem at all. I\'ll leave you with everything in writing. When would be a good time for me to follow up?"',
          '- Set a specific follow-up date/time. Never leave it open-ended.',
          '',
          'AFTER THE CLOSE:',
          '- Thank them for their trust.',
          '- Set expectations for next steps and timeline.',
          '- Enter everything into JobNimbus immediately.',
          '- Send a follow-up text or email confirming the agreement.',
        ],
      },
      {
        heading: 'Follow-Up Schedule',
        content: [
          'Consistent follow-up is what separates good salespeople from great ones.',
          '',
          'IF THEY DID NOT SIGN:',
          '- Day 1 (same day): Send a thank-you text with your contact info.',
          '- Day 3: Follow-up call. "Just checking in -- do you have any questions about what we discussed?"',
          '- Day 7: Second follow-up. Add value (share a relevant blog post, provide additional info).',
          '- Day 14: Final follow-up. "I wanted to circle back one more time. I am here if you need anything."',
          '- After 14 days: Move to long-term nurture (monthly check-in).',
          '',
          'IF THEY SIGNED (claim in progress):',
          '- Weekly update texts even if there is no new news.',
          '- Call after every milestone (adjuster scheduled, estimate received, approval, etc.).',
          '- Post-installation follow-up within 48 hours.',
          '- 30-day post-installation check-in.',
          '- Ask for review at 30-day check-in.',
        ],
        proTips: [
          'Use JobNimbus tasks to schedule your follow-ups. Never rely on memory.',
          'The fortune is in the follow-up. Most sales happen between touch 5 and touch 12. Do not give up after one call.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q4_1',
        question: 'What is the target response time for a new phone lead?',
        options: ['Within 1 hour', 'Within 30 minutes', 'Within 5 minutes', 'Same business day'],
        correctIndex: 2,
        explanation: 'Phone leads should be answered or returned within 5 minutes. Speed to lead is the #1 competitive advantage.',
      },
      {
        id: 'q4_2',
        question: 'What should you do if an inspection reveals NO damage?',
        options: [
          'Exaggerate minor wear as damage',
          'Be honest, leave your card, and tell them their roof looks good',
          'Suggest they file a claim anyway',
          'Offer a discount to replace the roof',
        ],
        correctIndex: 1,
        explanation: 'Always be honest. If there is no damage, say so. Honest inspectors become trusted referral sources.',
      },
      {
        id: 'q4_3',
        question: 'What is the best response to "I need to get more quotes"?',
        options: [
          'Offer a discount to sign today',
          'Discourage them from shopping around',
          'Encourage it and tell them what to look for when comparing',
          'Refuse to leave your estimate with them',
        ],
        correctIndex: 2,
        explanation: 'Encourage them to compare and arm them with knowledge about what to look for. Confidence in your product beats pressure tactics.',
      },
      {
        id: 'q4_4',
        question: 'How soon after a customer signs should you enter their information into JobNimbus?',
        options: ['End of the week', 'Within 24 hours', 'Immediately', 'When you get back to the office'],
        correctIndex: 2,
        explanation: 'Enter everything into JobNimbus immediately after the close to avoid lost information and ensure timely follow-up.',
      },
      {
        id: 'q4_5',
        question: 'When following up with a homeowner who did NOT sign, what should you do on Day 1?',
        options: [
          'Call them to ask why they did not sign',
          'Send a thank-you text with your contact info',
          'Show up at their house unannounced',
          'Wait a week before reaching out',
        ],
        correctIndex: 1,
        explanation: 'Same day: Send a thank-you text with your contact info. Keep it friendly and no-pressure.',
      },
      {
        id: 'q4_6',
        question: 'What should you bring to every on-site inspection?',
        options: [
          'Just your phone',
          'Ladder, camera/phone, measuring tool, chalk, business cards',
          'Shingle samples and pricing sheets',
          'A contract and pen',
        ],
        correctIndex: 1,
        explanation: 'Always bring your ladder, camera/phone, measuring tool, chalk, and business cards to every inspection.',
      },
      {
        id: 'q4_7',
        question: 'What is the MOST important factor in converting a new lead?',
        options: [
          'Having the lowest price',
          'Speed of response',
          'Having the best website',
          'Offering the most shingle options',
        ],
        correctIndex: 1,
        explanation: 'Speed to lead is the #1 factor. The first contractor to respond professionally wins the job 78% of the time.',
      },
      {
        id: 'q4_8',
        question: 'When should you ask a customer for a review?',
        options: [
          'Before the roof is installed',
          'At the 30-day post-installation check-in',
          'Never, it is unprofessional',
          'Only if they bring it up first',
        ],
        correctIndex: 1,
        explanation: 'The 30-day post-installation check-in is the ideal time to ask for a review once the customer has had time to appreciate the work.',
      },
      {
        id: 'q4_9',
        question: 'After how many days should you make your "final" follow-up with a non-signing prospect?',
        options: ['3 days', '7 days', '14 days', '30 days'],
        correctIndex: 2,
        explanation: 'Day 14 is the final active follow-up. After that, move them to a monthly long-term nurture cadence.',
      },
      {
        id: 'q4_10',
        question: 'What should you do before presenting an estimate?',
        options: [
          'Email it without explanation',
          'Sit down with the homeowner and walk through each line item',
          'Leave it on the door and call later',
          'Just tell them the total cost verbally',
        ],
        correctIndex: 1,
        explanation: 'Always sit down with the homeowner and walk through the estimate line by line. Explain each item and why it is needed.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MODULE 5: Using JobNimbus CRM
  // -------------------------------------------------------------------------
  {
    id: 'sales_m5',
    title: 'Using JobNimbus CRM',
    description: 'Creating contacts, job workflow, notes, photos, and task scheduling in JobNimbus.',
    icon: Monitor,
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'What is JobNimbus?',
        content: [
          'JobNimbus is our Customer Relationship Management (CRM) system. It is where ALL customer and job information lives. If it is not in JobNimbus, it does not exist.',
          '',
          'KEY FUNCTIONS:',
          '- Store all customer contacts and property information.',
          '- Track every job through our workflow pipeline.',
          '- Log communications, notes, and photos.',
          '- Schedule tasks and follow-ups.',
          '- Generate estimates and invoices.',
          '- Coordinate between sales, production, and office teams.',
          '',
          'ACCESS:',
          '- Web: app.jobnimbus.com',
          '- Mobile app: Available on iOS and Android (download it immediately).',
          '- You should have the mobile app on your phone at all times.',
        ],
        proTips: [
          'The mobile app is your best friend in the field. Get comfortable with it before your first inspection.',
          'Enter information while you are still at the property. Your memory fades fast.',
        ],
      },
      {
        heading: 'Creating Contacts and Jobs',
        content: [
          'CREATING A CONTACT:',
          '1. Tap "+" or "New Contact".',
          '2. Enter: First name, last name, phone, email, address.',
          '3. Add any notes about how they found us (referral, web, door knock, etc.).',
          '4. Save the contact.',
          '',
          'CREATING A JOB:',
          '1. From the contact, tap "New Job" or "Add Job".',
          '2. Select job type (Roof Replacement, Repair, Inspection, etc.).',
          '3. Set the initial status to "New Lead" or "Inspection Scheduled".',
          '4. Add the property address (may auto-fill from contact).',
          '5. Save the job.',
          '',
          'Every customer interaction should be connected to a CONTACT and a JOB. A contact can have multiple jobs over time.',
        ],
      },
      {
        heading: 'Status Workflow',
        content: [
          'Jobs move through a defined pipeline of statuses. Always keep the status current.',
          '',
          'TYPICAL STATUS PIPELINE:',
          '1. New Lead - Just came in, not yet contacted.',
          '2. Contacted - Initial call/text made.',
          '3. Inspection Scheduled - Appointment set.',
          '4. Inspected - Inspection completed.',
          '5. Claim Filed - Insurance claim submitted.',
          '6. Adjuster Scheduled - Adjuster appointment set.',
          '7. Adjuster Complete - Adjuster has inspected.',
          '8. Approved - Insurance has approved the claim.',
          '9. Supplement - Additional items submitted to insurance.',
          '10. Work Scheduled - Installation date set.',
          '11. In Progress - Crew is on site.',
          '12. Complete - Job finished.',
          '13. Invoice Sent - Final invoice sent.',
          '14. Paid - Payment received.',
          '',
          'STATUS CHANGES ARE CRITICAL. The office team, production team, and management all rely on accurate statuses to do their jobs.',
        ],
        proTips: [
          'Update the status the moment something changes, not at the end of the day. Real-time data keeps the whole team aligned.',
        ],
      },
      {
        heading: 'Notes, Photos, and Tasks',
        content: [
          'ADDING NOTES:',
          '- Every phone call, text, or in-person interaction should be logged as a note.',
          '- Include date, what was discussed, and any next steps.',
          '- Keep notes factual and professional -- homeowners can request their records.',
          '',
          'UPLOADING PHOTOS:',
          '- Upload all inspection photos to the job record.',
          '- Organize by: damage photos, property photos, documents.',
          '- Label photos clearly (e.g., "North facet hail damage", "Chimney flashing").',
          '',
          'SCHEDULING TASKS:',
          '- Use tasks for every follow-up and action item.',
          '- Set a due date and assign it to yourself.',
          '- Common tasks: "Follow-up call", "Send estimate", "Meet adjuster", "Order materials".',
          '- Check your task list FIRST every morning.',
        ],
        proTips: [
          'The top performers have ZERO overdue tasks. If something changes, reschedule the task -- do not just ignore it.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q5_1',
        question: 'Where should ALL customer and job information be stored?',
        options: ['Your phone contacts', 'A personal notebook', 'JobNimbus CRM', 'Email only'],
        correctIndex: 2,
        explanation: 'JobNimbus is the single source of truth. If it is not in JobNimbus, it does not exist for the rest of the team.',
      },
      {
        id: 'q5_2',
        question: 'When should you update a job\'s status in JobNimbus?',
        options: [
          'At the end of each day',
          'At the weekly sales meeting',
          'The moment something changes',
          'When the office asks for an update',
        ],
        correctIndex: 2,
        explanation: 'Update the status immediately when something changes. Real-time data keeps the whole team aligned.',
      },
      {
        id: 'q5_3',
        question: 'What is the first thing you should check every morning in JobNimbus?',
        options: ['New leads', 'Your task list', 'Revenue numbers', 'Photo uploads'],
        correctIndex: 1,
        explanation: 'Check your task list first every morning to see what follow-ups and actions are due.',
      },
      {
        id: 'q5_4',
        question: 'When should you enter information into JobNimbus after an inspection?',
        options: [
          'While still at the property',
          'When you get home that evening',
          'Before the weekly meeting',
          'After the job is complete',
        ],
        correctIndex: 0,
        explanation: 'Enter information while still at the property. Your memory fades fast and details get lost.',
      },
      {
        id: 'q5_5',
        question: 'A customer can have multiple _____ over time in JobNimbus.',
        options: ['Contacts', 'Emails', 'Jobs', 'Addresses'],
        correctIndex: 2,
        explanation: 'A single contact can have multiple jobs over time (e.g., a roof replacement, then later a repair or another property).',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MODULE 6: Measurement & Estimation
  // -------------------------------------------------------------------------
  {
    id: 'sales_m6',
    title: 'Measurement & Estimation',
    description: 'Roof measurement basics, tools, creating estimates, and material/labor calculations.',
    icon: Ruler,
    estimatedMinutes: 20,
    passingScore: 80,
    sections: [
      {
        heading: 'Roof Measurement Basics',
        content: [
          'SQUARES:',
          '- A "square" = 100 square feet of roof area.',
          '- A typical residential roof is 20-40 squares.',
          '- This is the primary unit for roofing measurement.',
          '',
          'PITCH / SLOPE:',
          '- Pitch is expressed as rise over run. Example: 6/12 means the roof rises 6 inches for every 12 inches of horizontal run.',
          '- Common residential pitches: 4/12 to 8/12.',
          '- Steeper pitches = more material + more labor cost + safety considerations.',
          '- Pitches above 8/12 typically require special equipment and carry steep charges.',
          '',
          'WASTE FACTOR:',
          '- You always order more material than the measured area.',
          '- Standard waste factor: 10-15% for a simple roof.',
          '- Complex roofs (many hips, valleys, dormers): 15-20% waste factor.',
          '- Always round UP when calculating material orders.',
        ],
        proTips: [
          'When in doubt, add 10% more waste. Running short on a job day costs far more than having a few extra bundles.',
        ],
      },
      {
        heading: 'Measurement Tools and Apps',
        content: [
          'MANUAL MEASUREMENT:',
          '- Tape measure (at least 25 feet).',
          '- Pitch gauge or speed square for measuring slope.',
          '- Pen and graph paper for sketching the roof.',
          '',
          'DIGITAL TOOLS:',
          '- EagleView: Satellite-based measurement report. Order online, receive in 24-48 hours.',
          '- RoofSnap: App for creating measurements from aerial imagery.',
          '- Google Earth Pro: Free tool for preliminary estimates.',
          '- Hover: 3D modeling app using smartphone photos.',
          '',
          'BEST PRACTICE:',
          '- For insurance claims, an EagleView or similar report is standard.',
          '- Always verify satellite measurements with on-site observations.',
          '- Satellite reports can miss layers, pitch changes, and additions.',
        ],
      },
      {
        heading: 'Creating Accurate Estimates',
        content: [
          'An estimate should include every material and labor line item needed to complete the job.',
          '',
          'STANDARD LINE ITEMS:',
          '- Tear-off and disposal of existing shingles.',
          '- Decking repair/replacement (if needed, per square foot).',
          '- Synthetic underlayment (full roof coverage).',
          '- Ice & water shield (valleys, eaves, penetrations).',
          '- Drip edge (all eaves and rakes).',
          '- Starter strip.',
          '- Shingles (by square, specify type and color).',
          '- Ridge cap.',
          '- Flashing (chimney, wall, pipe boots, vent flashing).',
          '- Ventilation (ridge vent, box vents, soffit vents).',
          '- Cleanup and haul-off.',
          '',
          'OPTIONAL/CONDITIONAL:',
          '- Steep slope charges (pitches over 8/12).',
          '- Second layer tear-off (if existing roof has 2 layers).',
          '- Skylight flashing or replacement.',
          '- Gutter repair/replacement.',
          '- Satellite dish removal and reinstallation.',
        ],
      },
      {
        heading: 'Material and Labor Calculation',
        content: [
          'MATERIAL CALCULATION EXAMPLE (30 square roof, 6/12 pitch):',
          '',
          'Shingles: 30 squares + 15% waste = 34.5 squares -> order 35 squares.',
          '  At 3 bundles per square = 105 bundles.',
          '',
          'Underlayment: 30 squares at 1 roll per 4 squares = 7.5 -> order 8 rolls.',
          '',
          'Ice & Water Shield: Measure valleys + eaves + penetrations in linear feet. Convert to rolls.',
          '',
          'Drip Edge: Measure all eaves + rakes in linear feet. Standard comes in 10-foot strips.',
          '',
          'Starter Strip: Measure all eaves in linear feet.',
          '',
          'Ridge Cap: Measure all ridges + hips in linear feet. Typically 3 bundles per 100 LF.',
          '',
          'LABOR ESTIMATION:',
          '- Standard crew (4-5 workers) typically installs 25-35 squares per day.',
          '- Factor in complexity: steep pitch, multiple layers, many penetrations add time.',
          '- Material delivery should be scheduled 1-2 days before installation.',
        ],
        proTips: [
          'Double-check your math before submitting any estimate. An error on material calculation can cost the company hundreds to thousands of dollars.',
          'When in doubt, ask John (Production Manager) or Tae (Materials Manager) to review your material list.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q6_1',
        question: 'How many square feet are in one "square" of roofing?',
        options: ['10 sq ft', '50 sq ft', '100 sq ft', '200 sq ft'],
        correctIndex: 2,
        explanation: 'One "square" equals 100 square feet of roof area.',
      },
      {
        id: 'q6_2',
        question: 'What does a 6/12 pitch mean?',
        options: [
          'The roof is 6 feet high and 12 feet wide',
          'The roof rises 6 inches for every 12 inches of horizontal run',
          'There are 6 ridges and 12 valleys',
          'The roof needs 6 squares per 12 feet',
        ],
        correctIndex: 1,
        explanation: 'A 6/12 pitch means the roof rises 6 inches for every 12 inches of horizontal run.',
      },
      {
        id: 'q6_3',
        question: 'What is a standard waste factor for a simple residential roof?',
        options: ['5%', '10-15%', '25-30%', '50%'],
        correctIndex: 1,
        explanation: 'A standard waste factor for a simple roof is 10-15%. Complex roofs with many hips and valleys may require 15-20%.',
      },
      {
        id: 'q6_4',
        question: 'At what pitch do steep slope charges typically apply?',
        options: ['Above 4/12', 'Above 6/12', 'Above 8/12', 'Above 12/12'],
        correctIndex: 2,
        explanation: 'Pitches above 8/12 typically require special equipment and carry steep slope surcharges.',
      },
      {
        id: 'q6_5',
        question: 'How many bundles of shingles are typically in one square?',
        options: ['1 bundle', '2 bundles', '3 bundles', '5 bundles'],
        correctIndex: 2,
        explanation: 'Most architectural shingles come 3 bundles per square.',
      },
      {
        id: 'q6_6',
        question: 'What tool provides satellite-based roof measurement reports?',
        options: ['Google Maps', 'EagleView', 'Measuring tape', 'Level app'],
        correctIndex: 1,
        explanation: 'EagleView provides satellite-based measurement reports delivered in 24-48 hours.',
      },
      {
        id: 'q6_7',
        question: 'For a 30-square roof with 15% waste, how many squares should you order?',
        options: ['30 squares', '33 squares', '35 squares', '40 squares'],
        correctIndex: 2,
        explanation: '30 squares + 15% waste = 34.5 squares, rounded up to 35 squares.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MODULE 7: Customer Communication
  // -------------------------------------------------------------------------
  {
    id: 'sales_m7',
    title: 'Customer Communication',
    description: 'Professional standards, templates, expectations, complaints, and review requests.',
    icon: MessageSquare,
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'Professional Communication Standards',
        content: [
          'Your communication represents the entire company. Every text, call, and email should reflect RCRS values.',
          '',
          'GENERAL RULES:',
          '- Always use proper grammar and complete sentences in written communication.',
          '- No slang, abbreviations, or excessive emojis in professional messages.',
          '- Respond to all communications within 4 business hours maximum.',
          '- If you cannot answer a question, say "Let me find out and get back to you" -- then actually do it.',
          '- Never make promises you cannot keep.',
          '- Address customers by name. "Mr./Mrs. [Last Name]" until they invite first names.',
          '',
          'PHONE ETIQUETTE:',
          '- Answer with: "River City Roofing Solutions, this is [your name]. How can I help you?"',
          '- Speak clearly and at a moderate pace.',
          '- Never eat, drive recklessly, or have loud background noise during calls.',
          '- If you miss a call, return it within 30 minutes during business hours.',
          '',
          'TEXT MESSAGE GUIDELINES:',
          '- Keep texts professional but conversational.',
          '- Always identify yourself: "Hi [name], this is [you] from River City Roofing."',
          '- Do not text before 8 AM or after 8 PM unless the customer has indicated it is okay.',
          '- Use texts for quick updates. Use phone calls for complex discussions.',
        ],
      },
      {
        heading: 'Text and Email Templates',
        content: [
          'APPOINTMENT CONFIRMATION TEXT:',
          '"Hi [name], this is [your name] from River City Roofing Solutions. Just confirming your free roof inspection for [day] at [time]. I will be the one meeting you. See you then!"',
          '',
          'POST-INSPECTION FOLLOW-UP TEXT:',
          '"Hi [name], thank you for your time today! Based on the inspection, [summary - e.g., I found storm damage that qualifies for an insurance claim / your roof looks great and no action is needed]. I will be in touch with next steps. Do not hesitate to reach out with any questions!"',
          '',
          'CLAIM STATUS UPDATE EMAIL:',
          'Subject: Roof Claim Update - [Address]',
          '"Hi [name], I wanted to give you a quick update on your roof claim. [Update details]. The next step is [next step]. Please let me know if you have any questions. Best, [your name] | River City Roofing Solutions | [phone]"',
          '',
          'INSTALLATION SCHEDULING TEXT:',
          '"Great news, [name]! Your roof has been approved and we are ready to schedule installation. Our crew is available [dates]. Which works best for you? The installation typically takes [1-2 days] and we will handle everything."',
          '',
          'POST-INSTALLATION CHECK-IN:',
          '"Hi [name], just checking in! It has been about a month since we finished your new roof. How is everything looking? If you have any questions or concerns, I am just a call away. Also, if you have been happy with our work, a Google review would mean the world to us: [review link]"',
        ],
      },
      {
        heading: 'Setting and Managing Expectations',
        content: [
          'Mismanaged expectations are the #1 source of customer complaints in roofing. Prevent them with clear communication.',
          '',
          'AT THE INSPECTION:',
          '- Explain the full timeline (see Module 3).',
          '- Clarify that you cannot guarantee insurance approval.',
          '- Explain that the homeowner IS responsible for their deductible.',
          '- Set communication expectations: "I will keep you updated weekly."',
          '',
          'DURING THE CLAIM PROCESS:',
          '- If there are delays, communicate proactively. Do not wait for them to call you.',
          '- Explain each step before it happens, not after.',
          '- If timelines change, let them know immediately with a revised estimate.',
          '',
          'BEFORE INSTALLATION:',
          '- Explain what to expect: noise, debris, timeline, crew size.',
          '- Ask them to move vehicles from the driveway.',
          '- Ask about pets, sprinkler systems, landscape concerns.',
          '- Provide a start time and estimated completion time.',
        ],
        proTips: [
          'The golden rule of expectations: Tell them what will happen BEFORE it happens. Surprises create complaints. Preparation creates confidence.',
        ],
      },
      {
        heading: 'Handling Complaints',
        content: [
          'Complaints will happen. How you handle them determines whether you keep or lose the customer.',
          '',
          'THE L.A.S.T. METHOD:',
          '- L - LISTEN: Let them vent. Do not interrupt. Show you care.',
          '- A - ACKNOWLEDGE: "I understand why that is frustrating. I would feel the same way."',
          '- S - SOLVE: "Here is what I am going to do to make this right..."',
          '- T - THANK: "Thank you for bringing this to my attention. Your feedback helps us improve."',
          '',
          'ESCALATION:',
          '- If you cannot solve the issue yourself, escalate to Chris or Michael immediately.',
          '- Never argue with a customer. Never get defensive.',
          '- Document every complaint and resolution in JobNimbus.',
          '- Follow up within 24 hours to confirm the issue is resolved.',
        ],
        proTips: [
          'A complaint handled well creates a MORE loyal customer than if the problem never happened. This is called the "service recovery paradox."',
        ],
      },
      {
        heading: 'Review and Referral Requests',
        content: [
          'Reviews and referrals are the lifeblood of our business. But you have to ask for them.',
          '',
          'WHEN TO ASK FOR A REVIEW:',
          '- 30 days after installation is the ideal time.',
          '- The customer should be settled and happy with the work.',
          '- Send the request via text with a direct link to your Google Business profile.',
          '',
          'HOW TO ASK:',
          '"Hi [name], hope you are enjoying the new roof! If you have a minute, it would mean a lot to us if you could share your experience on Google. It really helps other homeowners in the area find a roofing company they can trust. Here is the link: [link]"',
          '',
          'REFERRALS:',
          '- After every positive interaction, plant the seed: "If you know anyone else who needs a roof, we would love to help them too."',
          '- RCRS has a referral program. Make sure you know the current incentive structure.',
          '- A personal introduction from the customer to their friend/neighbor is 10x more valuable than a cold lead.',
          '',
          'Track all reviews and referrals in JobNimbus.',
        ],
        proTips: [
          'Set a personal goal: get at least one review or referral from every completed job. It compounds over time and your pipeline fills itself.',
        ],
      },
    ],
    quiz: [
      {
        id: 'q7_1',
        question: 'What is the maximum response time for any customer communication?',
        options: ['1 hour', '4 business hours', '24 hours', '48 hours'],
        correctIndex: 1,
        explanation: 'All customer communications should receive a response within 4 business hours maximum.',
      },
      {
        id: 'q7_2',
        question: 'What does the "L" stand for in the L.A.S.T. complaint handling method?',
        options: ['Lead', 'Listen', 'Learn', 'Leverage'],
        correctIndex: 1,
        explanation: 'L stands for LISTEN -- let the customer vent without interrupting.',
      },
      {
        id: 'q7_3',
        question: 'When is the ideal time to ask a customer for a Google review?',
        options: [
          'Immediately after signing the contract',
          'During the installation',
          '30 days after installation',
          '6 months after installation',
        ],
        correctIndex: 2,
        explanation: '30 days after installation is ideal -- the customer is settled, happy, and the experience is still fresh.',
      },
      {
        id: 'q7_4',
        question: 'What should you NOT do when texting a customer?',
        options: [
          'Identify yourself by name and company',
          'Keep the message professional',
          'Text before 8 AM or after 8 PM without permission',
          'Include relevant details about their project',
        ],
        correctIndex: 2,
        explanation: 'Do not text before 8 AM or after 8 PM unless the customer has indicated it is okay.',
      },
      {
        id: 'q7_5',
        question: 'What is the #1 source of customer complaints in roofing?',
        options: [
          'Poor installation quality',
          'Mismanaged expectations',
          'High prices',
          'Rude workers',
        ],
        correctIndex: 1,
        explanation: 'Mismanaged expectations are the #1 source of complaints. Clear, proactive communication prevents most issues.',
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const STORAGE_KEY = 'rcrs-sales-training-progress';
const USER_SETTINGS_KEY = 'rcrs-user-settings';

function getUserIdentity(): { userId: string; userName: string } {
  if (typeof window === 'undefined') return { userId: 'anonymous', userName: 'Sales Trainee' };
  try {
    const raw = localStorage.getItem(USER_SETTINGS_KEY);
    if (raw) {
      const settings = JSON.parse(raw);
      return {
        userId: settings.email || settings.userId || 'anonymous',
        userName: settings.displayName || settings.name || 'Sales Trainee',
      };
    }
  } catch { /* ignore */ }
  return { userId: 'anonymous', userName: 'Sales Trainee' };
}

function loadProgress(): Record<string, ModuleProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: Record<string, ModuleProgress>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function SalesTrainingPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'content' | 'quiz'>('content');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [syncError, setSyncError] = useState(false);

  // Load progress on mount
  useEffect(() => {
    const loaded = loadProgress();
    setProgress(loaded);

    // Also try to load from server
    fetchServerProgress(loaded);
  }, []);

  const fetchServerProgress = useCallback(async (localProgress: Record<string, ModuleProgress>) => {
    try {
      const res = await fetch('/api/portal/training/sales');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.moduleScores) {
        const merged = { ...localProgress };
        for (const [moduleId, info] of Object.entries(data.moduleScores)) {
          const serverInfo = info as { score: number; passed: boolean; completedAt: string };
          const existing = merged[moduleId];
          if (!existing || serverInfo.score > existing.score) {
            merged[moduleId] = {
              score: serverInfo.score,
              passed: serverInfo.passed,
              completedAt: serverInfo.completedAt,
            };
          }
        }
        setProgress(merged);
        saveProgress(merged);
      }
    } catch {
      // Server not available, use local only
    }
  }, []);

  const activeModule = salesModules.find(m => m.id === activeModuleId) || null;

  const completedCount = salesModules.filter(m => progress[m.id]?.passed).length;
  const overallProgress = Math.round((completedCount / salesModules.length) * 100);
  const allComplete = completedCount === salesModules.length;

  // Module unlocking logic: sequential
  const isModuleUnlocked = (index: number): boolean => {
    if (index === 0) return true;
    const prevModule = salesModules[index - 1];
    return !!progress[prevModule.id]?.passed;
  };

  const getModuleStatus = (index: number): 'locked' | 'available' | 'in-progress' | 'completed' => {
    const mod = salesModules[index];
    if (progress[mod.id]?.passed) return 'completed';
    if (!isModuleUnlocked(index)) return 'locked';
    if (progress[mod.id]) return 'in-progress';
    return 'available';
  };

  // Toggle section expansion
  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Open a module
  const openModule = (moduleId: string, index: number) => {
    if (!isModuleUnlocked(index)) return;
    setActiveModuleId(moduleId);
    setActiveView('content');
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setExpandedSections(new Set([0]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit quiz - sends answers to server for grading
  const submitQuiz = async () => {
    if (!activeModule) return;

    // Build answers map: { questionId: selectedIndex }
    const answersMap: Record<string, number> = {};
    for (const q of activeModule.quiz) {
      if (quizAnswers[q.id] !== undefined) {
        answersMap[q.id] = quizAnswers[q.id];
      }
    }

    // Compute client-side score for immediate display (server is authoritative)
    let clientCorrect = 0;
    for (const q of activeModule.quiz) {
      if (quizAnswers[q.id] === q.correctIndex) clientCorrect++;
    }
    const clientScore = Math.round((clientCorrect / activeModule.quiz.length) * 100);
    const clientPassed = clientScore >= activeModule.passingScore;

    // Show immediate feedback
    setQuizScore(clientScore);
    setQuizSubmitted(true);

    // Submit to server for authoritative grading
    try {
      const res = await fetch('/api/portal/training/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.userId || 'unknown',
          userName: user?.name || 'Unknown',
          moduleId: activeModule.id,
          moduleName: activeModule.title,
          answers: answersMap,
          completedAt: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Use server-validated score as authoritative
        const serverScore = typeof data.score === 'number' ? data.score : clientScore;
        const serverPassed = typeof data.passed === 'boolean' ? data.passed : clientPassed;

        setQuizScore(serverScore);

        // Save locally using server-validated result
        const existingBest = progress[activeModule.id];
        if (!existingBest || serverScore > existingBest.score) {
          const newProgress = {
            ...progress,
            [activeModule.id]: {
              score: serverScore,
              passed: serverPassed,
              completedAt: new Date().toISOString(),
            },
          };
          setProgress(newProgress);
          saveProgress(newProgress);
        }
        setSyncError(false);
      } else {
        // Server error - fall back to client score
        const existingBest = progress[activeModule.id];
        if (!existingBest || clientScore > existingBest.score) {
          const newProgress = {
            ...progress,
            [activeModule.id]: {
              score: clientScore,
              passed: clientPassed,
              completedAt: new Date().toISOString(),
            },
          };
          setProgress(newProgress);
          saveProgress(newProgress);
        }
        setSyncError(true);
        setTimeout(() => setSyncError(false), 5000);
      }
    } catch {
      // Network error - save locally with client score
      const existingBest = progress[activeModule.id];
      if (!existingBest || clientScore > existingBest.score) {
        const newProgress = {
          ...progress,
          [activeModule.id]: {
            score: clientScore,
            passed: clientPassed,
            completedAt: new Date().toISOString(),
          },
        };
        setProgress(newProgress);
        saveProgress(newProgress);
      }
      setSyncError(true);
      setTimeout(() => setSyncError(false), 5000);
    }
  };

  // Retake quiz
  const retakeQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  };

  // Back to module list
  const backToList = () => {
    setActiveModuleId(null);
    setActiveView('content');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // RENDER: Module Detail View
  // =========================================================================
  if (activeModule) {
    const allQuestionsAnswered = activeModule.quiz.every(q => quizAnswers[q.id] !== undefined);

    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="fixed inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)', backgroundSize: '50px 50px' }} />
        </div>
        <div className="relative z-10">
          {/* Sync error banner */}
          {syncError && (
            <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium shadow-lg backdrop-blur-xl">
                <AlertTriangle size={14} />
                Progress saved locally. Server sync will retry later.
              </div>
            </div>
          )}
          <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
            <div className="max-w-4xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={backToList} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                    <ArrowLeft size={18} className="text-neutral-400" />
                  </button>
                  <div>
                    <h1 className="text-lg font-bold text-white">{activeModule.title}</h1>
                    <p className="text-xs text-neutral-400">{activeModule.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('content')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'content' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Content
                  </button>
                  <button
                    onClick={() => setActiveView('quiz')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'quiz' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Quiz ({activeModule.quiz.length} questions)
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-6 py-8">
            {/* CONTENT VIEW */}
            {activeView === 'content' && (
              <div className="space-y-4">
                {activeModule.sections.map((section, idx) => {
                  const isExpanded = expandedSections.has(idx);
                  const panelId = `section-panel-${activeModule.id}-${idx}`;
                  const buttonId = `section-btn-${activeModule.id}-${idx}`;
                  return (
                    <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                      <button
                        id={buttonId}
                        onClick={() => toggleSection(idx)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green text-sm font-bold">
                            {idx + 1}
                          </div>
                          <span className="text-white font-medium text-left">{section.heading}</span>
                        </div>
                        {isExpanded ? <ChevronDown size={18} className="text-neutral-400" /> : <ChevronRight size={18} className="text-neutral-400" />}
                      </button>
                      {isExpanded && (
                        <div id={panelId} role="region" aria-labelledby={buttonId} className="px-6 pb-5 border-t border-white/5">
                          <div className="mt-4 space-y-2">
                            {section.content.map((line, i) => {
                              if (line === '') return <div key={i} className="h-3" />;
                              if (line.startsWith('- ')) return <p key={i} className="text-sm text-neutral-300 pl-4 before:content-['\2022'] before:mr-2 before:text-brand-green">{line.slice(2)}</p>;
                              if (line.match(/^\d+\./)) return <p key={i} className="text-sm text-neutral-300 pl-4">{line}</p>;
                              if (line === line.toUpperCase() && line.length > 3 && !line.startsWith('"')) return <p key={i} className="text-sm font-semibold text-white mt-3">{line}</p>;
                              return <p key={i} className="text-sm text-neutral-300">{line}</p>;
                            })}
                          </div>
                          {section.proTips && section.proTips.length > 0 && (
                            <div className="mt-4 rounded-lg bg-brand-green/5 border border-brand-green/20 p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Lightbulb size={16} className="text-brand-green" />
                                <span className="text-sm font-semibold text-brand-green">Pro Tips</span>
                              </div>
                              {section.proTips.map((tip, i) => (
                                <p key={i} className="text-sm text-neutral-300 mt-1">{tip}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Study Materials link */}
                {(() => {
                  const libraryMap: Record<string, string> = {
                    sales_m1: 'sales-performance',
                    sales_m2: 'sales-mastery',
                    sales_m3: 'platform-onboarding',
                    sales_m4: 'customer-service',
                    sales_m5: 'field-operations',
                    sales_m6: 'customer-service',
                    sales_m7: 'sales-performance',
                  };
                  const libraryId = libraryMap[activeModule.id];
                  return libraryId ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GraduationCap size={18} className="text-purple-400" />
                          <div>
                            <p className="text-sm font-medium text-white">Study Materials</p>
                            <p className="text-xs text-neutral-400">Flashcards, quizzes, and study guides in the Training Library</p>
                          </div>
                        </div>
                        <Link
                          href={`/portal/training/library#${libraryId}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
                        >
                          Open Library
                          <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Continue to Quiz button */}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => { setActiveView('quiz'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-green text-black font-semibold hover:bg-brand-green/90 transition-colors"
                  >
                    Take the Quiz
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* QUIZ VIEW */}
            {activeView === 'quiz' && (
              <div className="space-y-6">
                {/* Quiz Header */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <h2 className="text-xl font-bold text-white mb-1">{activeModule.title} Quiz</h2>
                  <p className="text-sm text-neutral-400">
                    Answer all {activeModule.quiz.length} questions. You need {activeModule.passingScore}% to pass.
                    {progress[activeModule.id] && ` Best score: ${progress[activeModule.id].score}%`}
                  </p>
                </div>

                {/* Questions */}
                {activeModule.quiz.map((q, qIdx) => {
                  const selected = quizAnswers[q.id];
                  const isCorrect = selected === q.correctIndex;
                  return (
                    <div key={q.id} className={`rounded-xl border p-6 ${quizSubmitted ? (isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5') : 'border-white/5 bg-white/[0.02]'}`}>
                      <p className="text-white font-medium mb-4">
                        <span className="text-brand-green mr-2">{qIdx + 1}.</span>
                        {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt, oIdx) => {
                          const isSelected = selected === oIdx;
                          const showCorrect = quizSubmitted && oIdx === q.correctIndex;
                          const showWrong = quizSubmitted && isSelected && oIdx !== q.correctIndex;

                          return (
                            <button
                              key={oIdx}
                              onClick={() => {
                                if (quizSubmitted) return;
                                setQuizAnswers(prev => ({ ...prev, [q.id]: oIdx }));
                              }}
                              disabled={quizSubmitted}
                              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors border ${
                                showCorrect
                                  ? 'border-green-500/50 bg-green-500/10 text-green-300'
                                  : showWrong
                                    ? 'border-red-500/50 bg-red-500/10 text-red-300'
                                    : isSelected
                                      ? 'border-brand-green/50 bg-brand-green/10 text-white'
                                      : 'border-white/5 bg-white/[0.02] text-neutral-300 hover:bg-white/[0.05]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                  showCorrect ? 'border-green-500 bg-green-500' :
                                  showWrong ? 'border-red-500 bg-red-500' :
                                  isSelected ? 'border-brand-green bg-brand-green' :
                                  'border-neutral-600'
                                }`}>
                                  {showCorrect && <CheckCircle2 size={14} className="text-white" />}
                                  {showWrong && <XCircle size={14} className="text-white" />}
                                  {isSelected && !quizSubmitted && <div className="w-2 h-2 rounded-full bg-black" />}
                                </div>
                                <span>{opt}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {quizSubmitted && (
                        <p className="mt-3 text-sm text-neutral-400 pl-9">{q.explanation}</p>
                      )}
                    </div>
                  );
                })}

                {/* Quiz Actions */}
                <div className="flex items-center justify-between pt-4">
                  {!quizSubmitted ? (
                    <>
                      <button
                        onClick={() => { setActiveView('content'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="text-neutral-400 hover:text-white text-sm transition-colors"
                      >
                        Back to Content
                      </button>
                      <button
                        onClick={submitQuiz}
                        disabled={!allQuestionsAnswered}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors ${allQuestionsAnswered ? 'bg-brand-green text-black hover:bg-brand-green/90' : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'}`}
                      >
                        Submit Quiz
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Score Display */}
                      <div className="flex items-center gap-4">
                        {quizScore !== null && quizScore >= activeModule.passingScore ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle2 size={20} />
                            <span className="font-semibold">Passed! {quizScore}%</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-400">
                            <XCircle size={20} />
                            <span className="font-semibold">Score: {quizScore}% (Need {activeModule.passingScore}%)</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {quizScore !== null && quizScore < activeModule.passingScore && (
                          <button
                            onClick={retakeQuiz}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-neutral-300 hover:bg-white/5 transition-colors"
                          >
                            <RotateCcw size={16} />
                            Retake Quiz
                          </button>
                        )}
                        {quizScore !== null && quizScore >= activeModule.passingScore && (
                          <button
                            onClick={backToList}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-green text-black font-semibold hover:bg-brand-green/90 transition-colors"
                          >
                            Continue
                            <ArrowRight size={18} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Module List View
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)', backgroundSize: '50px 50px' }} />
      </div>
      <div className="relative z-10">
        {/* Sync error banner */}
        {syncError && (
          <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium shadow-lg backdrop-blur-xl">
              <AlertTriangle size={14} />
              Progress saved locally. Server sync will retry later.
            </div>
          </div>
        )}

        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/portal/training" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Sales Training</h1>
                  <p className="text-sm text-neutral-400">New Hire Roofing Sales Program</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/command-center" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green/20 to-emerald-500/20 hover:from-brand-green/30 hover:to-emerald-500/30 border border-brand-green/30 text-brand-green text-sm font-medium transition-all">
                  <Command size={16} />
                  RoofStack HQ
                </Link>
                <Link href="/" target="_blank" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors">
                  <Home size={16} />
                  View Site
                </Link>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          {/* Overall Progress */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Your Progress</h2>
                <p className="text-sm text-neutral-400">{completedCount} of {salesModules.length} modules completed</p>
              </div>
              {allComplete && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                  <Trophy size={18} className="text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">Training Complete!</span>
                </div>
              )}
            </div>
            <div
              className="w-full h-3 rounded-full bg-neutral-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Sales training progress: ${overallProgress}%`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-green to-emerald-500 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-right text-xs text-neutral-500 mt-1">{overallProgress}%</p>
          </div>

          {/* Certificate Banner */}
          {allComplete && (
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6 mb-8 text-center print:border-amber-600 print:bg-white print:text-black">
              <Award size={48} className="mx-auto text-amber-400 mb-3 print:text-amber-600" />
              <h3 className="text-xl font-bold text-white mb-2 print:text-black">RCRS Sales Training Certificate</h3>
              <p className="text-neutral-300 mb-1 print:text-neutral-300">
                This certifies that <strong className="text-white print:text-black">{getUserIdentity().userName}</strong> has completed the RCRS Sales Training Program.
              </p>
              <p className="text-sm text-neutral-400 print:text-neutral-500 mb-1">All 7 modules passed.</p>
              <div className="text-xs text-neutral-500 print:text-neutral-500 mb-4 space-y-0.5">
                {salesModules.map(mod => {
                  const mp = progress[mod.id];
                  return mp ? (
                    <span key={mod.id} className="inline-block mx-2">{mod.title}: {mp.score}%</span>
                  ) : null;
                })}
              </div>
              <p className="text-xs text-neutral-500 print:text-neutral-500 mb-4">
                Certificate ID: RCRS-SALES-{getUserIdentity().userId.slice(0, 8).toUpperCase()}-{new Date().getFullYear()}
              </p>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors print:hidden"
              >
                <Printer size={16} />
                Print Certificate
              </button>
            </div>
          )}

          {/* Module List */}
          <div className="space-y-3">
            {salesModules.map((mod, idx) => {
              const status = getModuleStatus(idx);
              const Icon = mod.icon;
              const modProgress = progress[mod.id];

              return (
                <button
                  key={mod.id}
                  onClick={() => openModule(mod.id, idx)}
                  disabled={status === 'locked'}
                  className={`w-full text-left rounded-xl border p-5 transition-all ${
                    status === 'completed'
                      ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                      : status === 'locked'
                        ? 'border-white/5 bg-white/[0.01] opacity-50 cursor-not-allowed'
                        : status === 'in-progress'
                          ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      status === 'completed' ? 'bg-green-500/20' :
                      status === 'locked' ? 'bg-neutral-800' :
                      status === 'in-progress' ? 'bg-amber-500/20' :
                      'bg-brand-green/10'
                    }`}>
                      {status === 'completed' ? (
                        <CheckCircle2 size={24} className="text-green-400" />
                      ) : status === 'locked' ? (
                        <Lock size={24} className="text-neutral-600" />
                      ) : (
                        <Icon size={24} className={status === 'in-progress' ? 'text-amber-400' : 'text-brand-green'} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 font-medium">MODULE {idx + 1}</span>
                        {status === 'completed' && modProgress && (
                          <span className="text-xs text-green-400 font-medium">Score: {modProgress.score}%</span>
                        )}
                        {status === 'in-progress' && modProgress && (
                          <span className="text-xs text-amber-400 font-medium">Score: {modProgress.score}% (retake needed)</span>
                        )}
                      </div>
                      <h3 className="text-white font-semibold">{mod.title}</h3>
                      <p className="text-sm text-neutral-400 truncate">{mod.description}</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2 text-neutral-500">
                      <BookOpen size={14} />
                      <span className="text-xs">{mod.estimatedMinutes} min</span>
                      {status !== 'locked' && (
                        <ArrowRight size={16} className="ml-2" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Continue Learning - Cross Navigation */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Continue Learning</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/portal/training/onboarding" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors group">
                <Monitor size={20} className="text-blue-400 mb-2" />
                <h4 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">Platform Onboarding</h4>
                <p className="text-xs text-neutral-500 mt-1">Learn the RCRS interface and tools</p>
              </Link>
              <Link href="/portal/training/library" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors group">
                <GraduationCap size={20} className="text-purple-400 mb-2" />
                <h4 className="text-sm font-semibold text-white group-hover:text-purple-400 transition-colors">Training Library</h4>
                <p className="text-xs text-neutral-500 mt-1">Audio, video, quizzes, and flashcards</p>
              </Link>
              <Link href="/portal/training" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors group">
                <BookOpen size={20} className="text-brand-green mb-2" />
                <h4 className="text-sm font-semibold text-white group-hover:text-brand-green transition-colors">Training Hub</h4>
                <p className="text-xs text-neutral-500 mt-1">All training paths in one place</p>
              </Link>
            </div>
          </div>

          {/* Info Footer */}
          <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Important Notes</p>
                <ul className="text-xs text-neutral-400 mt-1 space-y-1">
                  <li>- Modules must be completed in order. Each module unlocks after passing the previous quiz.</li>
                  <li>- You need 80% or higher to pass each quiz.</li>
                  <li>- You can retake quizzes as many times as needed.</li>
                  <li>- Your progress is saved automatically.</li>
                  <li>- Complete all 7 modules to earn your Sales Training Certificate.</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

