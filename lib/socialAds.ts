// Social Media Ad Content for River City Roofing Solutions
// Hartselle, AL | 256-274-8530
// Black & Lime Green Theme

export interface SocialAd {
  id: number;
  platform: 'facebook' | 'instagram' | 'all';
  type: 'image' | 'carousel' | 'video';
  headline: string;
  primaryText: string;
  callToAction: string;
  ctaButton: string;
  hashtags: string[];
  targetAudience: string;
  suggestedImage: string;
}

export const socialAds: SocialAd[] = [
  {
    id: 1,
    platform: 'all',
    type: 'image',
    headline: "Storm Damage? We've Got You Covered.",
    primaryText: `Did recent storms leave your roof damaged? Don't wait until a small problem becomes a big expense.

River City Roofing Solutions offers FREE storm damage inspections for Hartselle and North Alabama homeowners.

We work directly with your insurance company to make the process stress-free.

Family-owned. Locally trusted. Here when you need us.

Call 256-274-8530 today or visit our website for your free inspection.`,
    callToAction: "Get Your FREE Storm Damage Inspection",
    ctaButton: "Get Quote",
    hashtags: ["#HartselleRoofing", "#StormDamage", "#NorthAlabama", "#RoofRepair", "#FreeInspection", "#RiverCityRoofing"],
    targetAudience: "Homeowners in Hartselle, Decatur, Huntsville, Madison area who have experienced recent storms",
    suggestedImage: "Dark stormy sky clearing up, with a pristine new roof in foreground. Lime green accent on company logo overlay."
  },
  {
    id: 2,
    platform: 'facebook',
    type: 'image',
    headline: "Your Local Family-Owned Roofing Experts",
    primaryText: `Why trust a faceless corporation or out-of-state storm chaser with your home?

At River City Roofing Solutions, we're your neighbors. The Muse family has been protecting Hartselle homes for years.

What we promise:
Honest, upfront pricing
Quality materials from trusted brands
Crews who treat your home like their own
Warranties we'll actually honor (because we're not going anywhere)

When you call us, you talk to real people who live in your community.

Schedule your free roof consultation today.
256-274-8530`,
    callToAction: "Meet Your Local Roofing Family",
    ctaButton: "Learn More",
    hashtags: ["#FamilyOwned", "#LocalBusiness", "#HartselleAL", "#TrustedRoofer", "#SupportLocal", "#NorthAlabama"],
    targetAudience: "Homeowners aged 35-65 in Morgan County and surrounding areas who value local businesses",
    suggestedImage: "Warm photo of the Muse family team in front of completed roofing job, wearing company gear with lime green accents on black."
  },
  {
    id: 3,
    platform: 'instagram',
    type: 'carousel',
    headline: "Before & After: Another Hartselle Roof Transformation",
    primaryText: `Swipe to see the transformation!

This Hartselle homeowner came to us after years of putting off their roof replacement. Within days, we transformed their worn, aging roof into a beautiful, durable system that will protect their family for decades.

What they said: "We should have called River City years ago. The process was easy, the crew was professional, and our house looks brand new!"

Your roof could be next.

Free estimates | Financing available | Family-owned since day one

Tap the link in bio or call 256-274-8530`,
    callToAction: "See What We Can Do For Your Home",
    ctaButton: "Book Now",
    hashtags: ["#BeforeAndAfter", "#RoofTransformation", "#HartselleHomes", "#CurbAppeal", "#NewRoof", "#HomeImprovement", "#RiverCityRoofing"],
    targetAudience: "Homeowners in North Alabama interested in home improvement, particularly those with older homes",
    suggestedImage: "4-image carousel: 1) Damaged/old roof 2) Crew working 3) Close-up of new shingles 4) Completed beautiful roof with happy homeowner"
  },
  {
    id: 4,
    platform: 'all',
    type: 'image',
    headline: "Quality Roofing That Fits Your Budget",
    primaryText: `A new roof shouldn't drain your savings.

At River City Roofing Solutions, we offer flexible financing options to make quality roofing affordable for every Hartselle family.

Get the protection your home needs today—with payments that work for your budget.

Free estimates
Flexible payment plans
No high-pressure sales

Your family deserves a safe, beautiful roof. Let's make it happen.

Call 256-274-8530 for your free consultation.`,
    callToAction: "Affordable Roofing Solutions - Get Started Today",
    ctaButton: "Get Quote",
    hashtags: ["#AffordableRoofing", "#FinancingAvailable", "#HartselleRoofing", "#HomeProtection", "#QualityRoofing", "#PaymentPlans"],
    targetAudience: "Middle-income homeowners in North Alabama who may be hesitant about roofing costs",
    suggestedImage: "Beautiful home with new roof, family standing in front yard smiling. Overlay with financing callout in lime green."
  },
  {
    id: 5,
    platform: 'facebook',
    type: 'video',
    headline: "See Why Hartselle Trusts River City Roofing",
    primaryText: `Real customers. Real results. Real protection.

Watch what your neighbors are saying about working with River City Roofing Solutions.

"They showed up when they said they would, communicated every step of the way, and our new roof looks amazing."

"After the storm, they handled everything with our insurance. Couldn't have been easier."

"Finally, a contractor who does what they promise. Highly recommend!"

Join hundreds of satisfied Hartselle homeowners who chose the local family team.

Schedule your free inspection: 256-274-8530`,
    callToAction: "Hear From Your Neighbors - Watch Now",
    ctaButton: "Watch More",
    hashtags: ["#CustomerReviews", "#Testimonials", "#HartselleTrusted", "#5StarRoofing", "#RealResults", "#RiverCityRoofing"],
    targetAudience: "Homeowners researching roofing companies, particularly those who value reviews and social proof",
    suggestedImage: "Video thumbnail showing happy homeowner in front of new roof, with 5-star rating graphic and lime green play button"
  }
];

// Helper function to get ads by platform
export function getAdsByPlatform(platform: 'facebook' | 'instagram' | 'all'): SocialAd[] {
  return socialAds.filter(ad => ad.platform === platform || ad.platform === 'all');
}

// Get all hashtags across all ads (unique)
export function getAllHashtags(): string[] {
  const allTags = socialAds.flatMap(ad => ad.hashtags);
  return [...new Set(allTags)];
}

// Brand guidelines for social ads
export const brandGuidelines = {
  primaryColor: '#000000', // Black
  accentColor: '#39FF14', // Lime Green
  secondaryAccent: '#0066CC', // Blue (used sparingly)
  fonts: {
    headline: 'Inter Bold',
    body: 'Inter Regular',
  },
  tone: 'Professional yet approachable, emphasizing family values and local trust',
  companyInfo: {
    name: 'River City Roofing Solutions',
    phone: '256-274-8530',
    location: 'Hartselle, AL',
    tagline: 'Family-Owned. Locally Trusted.',
  },
};
