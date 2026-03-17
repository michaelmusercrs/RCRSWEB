export interface Service {
  id: number;
  slug: string;
  title: string;
  category: 'Primary' | 'Additional';
  description: string;
  icon: string;
  whatsIncluded?: string[];
  servicesIncluded?: string[];
  materialsAvailable?: string[];
  timeline?: string;
  idealFor?: string[];
  costRange?: string;
  keyBenefits?: string[];
  features?: string[];
  image?: string;
}

export interface ServiceArea {
  id: number;
  slug: string;
  name: string;
  status: 'Active' | 'Expansion';
  state: string;
  tagline?: string;
  population?: string;
  coverage: string;
  services: string;
  responseTime?: string;
  launchDate?: string;
  regionalPartner?: string;
  keyDetails?: string[];
  expansionTimeline?: string[];
  image?: string;
  altText?: string;
  description?: string;
  mapQuery?: string;
  customFAQs?: { question: string; answer: string }[];
}

export const services: Service[] = [
  {
    id: 1,
    slug: 'residential-roof-replacement',
    image: '/uploads/service-residential.png',
    title: 'Residential Roof Replacement',
    category: 'Primary',
    description: 'Complete residential roof replacement with high-quality materials from trusted manufacturers.',
    icon: 'Home',
    whatsIncluded: [
      'Free comprehensive inspection',
      'Material consultation and selection',
      'Shingle removal and disposal',
      'Roof deck inspection and repair',
      'Underlayment installation',
      'Flashing installation and sealing',
      'New shingle installation',
      'Ridge vent installation',
      'Gutter protection (if applicable)',
      'Complete site cleanup',
      '5-Year Workmanship Warranty'
    ],
    materialsAvailable: [
      'Asphalt Shingles (3-tab and architectural)',
      'IKO Dynasty (Class 3 & 4 impact resistant)',
      'IKO Nordic (Premium durability)',
      'Owens Corning premium lines',
      'Metal roofing options',
      'Architectural/Dimensional shingles'
    ],
    timeline: '1-3 days depending on roof size',
    idealFor: [
      'Roofs over 20 years old',
      'Storm-damaged roofs',
      'Leaking or failing roofs',
      'Homeowners wanting upgraded protection'
    ],
    costRange: '$5,000-$25,000+',
    keyBenefits: [
      'Immediate protection',
      'Increased home value',
      'Energy efficiency improvements',
      'Insurance compliance',
      'Peace of mind',
      'Modern material technology'
    ]
  },
  {
    id: 2,
    slug: 'residential-roof-repair',
    image: '/uploads/service-repair.jpg',
    title: 'Residential Roof Repair',
    category: 'Primary',
    description: 'Expert repairs for roofing issues ranging from minor to moderate damage.',
    icon: 'Wrench',
    servicesIncluded: [
      'Leak detection and repair',
      'Shingle repair or replacement',
      'Flashing repair and sealing',
      'Gutter repair and cleaning',
      'Vent repair',
      'Chimney flashing repair',
      'Ice dam treatment',
      'Storm damage assessment',
      'Emergency tarping'
    ],
    timeline: 'Same-day to 2 weeks depending on repair',
    idealFor: [
      'Recent storm damage',
      'Small to moderate damage',
      'Budget-conscious homeowners',
      'Extending roof life',
      'Addressing specific problem areas'
    ],
    costRange: '$300-$5,000',
    keyBenefits: [
      'Cost-effective solution',
      'Prevents larger damage',
      'Extends roof life',
      'Quick repair time',
      'Maintains home value'
    ]
  },
  {
    id: 3,
    slug: 'commercial-roofing',
    image: '/uploads/service-commercial.png',
    title: 'Commercial Roofing',
    category: 'Primary',
    description: 'Comprehensive commercial roofing solutions for flat and low-slope roofs.',
    icon: 'Building2',
    servicesIncluded: [
      'New roof installation',
      'Commercial roof replacement',
      'Preventive maintenance programs',
      'Commercial roof repair',
      'Flat roof maintenance',
      'Seam inspection and repair',
      'Ponding water solutions',
      'Debris removal',
      'Emergency repairs'
    ],
    materialsAvailable: [
      'TPO (Thermoplastic Olefin) Roofing',
      'EPDM (Rubber membrane) systems',
      'Modified Bitumen systems',
      'Metal roofing for commercial buildings'
    ],
    idealFor: [
      'Shopping centers',
      'Office buildings',
      'Industrial facilities',
      'Multi-unit buildings',
      'Restaurant and retail spaces'
    ],
    keyBenefits: [
      'Minimizes business disruption',
      'Extends roof lifespan',
      'Reduces emergency repairs',
      'Energy savings',
      'Comprehensive protection'
    ]
  },
  {
    id: 4,
    slug: 'storm-hail-damage-repair',
    image: '/uploads/service-storm.jpg',
    title: 'Storm & Hail Damage Repair',
    category: 'Primary',
    description: 'Rapid response to storm damage with insurance claim expertise.',
    icon: 'CloudRain',
    servicesIncluded: [
      'Emergency response team (24/7)',
      'Rapid damage assessment',
      'Emergency tarping',
      'Temporary roof protection',
      'Complete damage documentation',
      'Insurance claim support',
      'Professional photography',
      'Adjuster coordination',
      'Repair estimates',
      'Restoration services'
    ],
    timeline: 'Same-day tarping available for emergencies',
    keyBenefits: [
      'Quick response to prevent further damage',
      'Insurance coverage maximization',
      'Professional documentation',
      'Expert damage assessment',
      'Fair claim support',
      'Efficient restoration'
    ]
  },
  {
    id: 5,
    slug: 'chimney-services',
    image: '/uploads/service-chimney.png',
    title: 'Chimney Services',
    category: 'Primary',
    description: 'Professional chimney cap installation and replacement to protect from water and pests.',
    icon: 'Flame',
    servicesIncluded: [
      'Chimney cap installation',
      'Chimney cap replacement',
      'Damaged cap repair',
      'Chimney crown repair',
      'Flashing repair around chimney',
      'Chimney inspection',
      'Critter exclusion',
      'Chimney cleaning coordination'
    ],
    costRange: '$300-$800 per chimney',
    keyBenefits: [
      'Simple, cost-effective protection',
      'Prevents costly interior damage',
      'Protects structural integrity',
      'Keeps pests out',
      'Peace of mind'
    ]
  },
  {
    id: 6,
    slug: 'leafx-gutter-protection',
    image: '/uploads/service-leafx.png',
    title: 'LeafX® Gutter Protection',
    category: 'Primary',
    description: 'Professional gutter guard installation with lifetime clog-free guarantee.',
    icon: 'Shield',
    features: [
      '.024-gauge aluminum construction',
      'Slides under shingles',
      'Attaches to gutter lip',
      'No nailing into roof or fascia',
      'Lifetime Clog-Free Guarantee',
      '98% recycled aluminum',
      'Sustainable production',
      'Seamless integration'
    ],
    timeline: '1-2 day installation',
    costRange: '$1,500-$5,000+',
    keyBenefits: [
      'Eliminates gutter cleaning',
      'Prevents water damage to foundation',
      'No ice dam formation',
      'Eliminates pest nesting',
      'Safe alternative to ladder climbing',
      'Long-term investment'
    ]
  },
  {
    id: 7,
    slug: 'roof-inspections-maintenance',
    image: '/uploads/service-inspection.jpg',
    title: 'Roof Inspections & Maintenance',
    category: 'Primary',
    description: 'Comprehensive roof inspections and preventive maintenance programs.',
    icon: 'Search',
    servicesIncluded: [
      'Free initial inspection',
      'Annual maintenance inspections',
      'Pre-purchase inspections',
      'Insurance claim inspections',
      'Seasonal inspections',
      'Storm damage assessments',
      'Detailed written reports',
      'Photo documentation'
    ],
    costRange: '$150-$500 per inspection',
    keyBenefits: [
      'Cost-effective prevention',
      'Identifies issues early',
      'Extends roof life',
      'Prevents water damage',
      'Insurance documentation',
      'Planning capability'
    ]
  },
  {
    id: 8,
    slug: 'emergency-roof-services',
    image: '/uploads/service-storm.jpg',
    title: 'Emergency Roof Services',
    category: 'Primary',
    description: '24/7 emergency response for severe roof damage.',
    icon: 'AlertTriangle',
    servicesIncluded: [
      '24/7 availability',
      'Rapid response team',
      'Emergency tarping',
      'Temporary roof protection',
      'Water damage mitigation',
      'Damage assessment',
      'Documentation',
      'Insurance coordination'
    ],
    costRange: '$500-$5,000 (emergency services)',
    keyBenefits: [
      'Immediate damage control',
      'Prevents additional water damage',
      'Protects interior',
      'Insurance documentation',
      'Professional assessment',
      'Quick restoration planning'
    ]
  },
  {
    id: 9,
    slug: 'gutter-repair-replacement',
    image: '/uploads/service-leafx.png',
    title: 'Gutter Repair and Replacement',
    category: 'Additional',
    description: 'Professional gutter services for proper water drainage.',
    icon: 'Droplet',
    servicesIncluded: [
      'Gutter repair and patching',
      'Gutter replacement',
      'Gutter cleaning',
      'Downspout repair',
      'Seamless gutter installation',
      'Gutter attachment repair',
      'Water diversion solutions',
      'Gutter maintenance'
    ],
    costRange: '$400-$3,000+'
  },
  {
    id: 10,
    slug: 'attic-ventilation',
    image: '/uploads/service-ventilation.jpg',
    title: 'Attic Ventilation Solutions',
    category: 'Additional',
    description: 'Improve attic airflow and temperature control.',
    icon: 'Wind',
    servicesIncluded: [
      'Ventilation assessment',
      'Ridge vent installation',
      'Soffit vent repair',
      'Gable vent installation',
      'Proper ventilation calculation',
      'Moisture prevention',
      'Energy efficiency improvement'
    ],
    costRange: '$500-$2,000'
  },
  {
    id: 11,
    slug: 'roof-coating-treatment',
    image: '/uploads/service-residential.png',
    title: 'Roof Coating and Treatment',
    category: 'Additional',
    description: 'Protective coatings and treatments for roof extension.',
    icon: 'Paintbrush',
    servicesIncluded: [
      'Algae-resistant coatings',
      'UV protection treatments',
      'Waterproof sealants',
      'Reflective coatings',
      'Maintenance treatments'
    ],
    costRange: '$1-$3 per square foot'
  }
];

export const serviceAreas: ServiceArea[] = [
  {
    id: 1,
    slug: 'decatur-al',
    mapQuery: 'Decatur,+AL',
    image: '/uploads/area-decatur.jpg',
    altText: 'Tennessee River bridge in Decatur Alabama - roofing services area',
    description: 'Our headquarters in Decatur provides same-day service and emergency response for residential and commercial roofing throughout Morgan County.',
    name: 'Decatur',
    tagline: 'Home of the Tennessee River Bridge',
    status: 'Active',
    state: 'AL',
    coverage: 'City and surrounding areas',
    services: 'All residential and commercial',
    responseTime: 'Same-day available',
    keyDetails: [
      'Headquarters location: 3325 Central Pkwy SW, Decatur, AL 35603',
      'Full service center with parts and materials in stock',
      'Emergency response team based here',
      'Free inspections — no obligation'
    ]
  },
  {
    id: 2,
    slug: 'huntsville-al',
    mapQuery: 'Huntsville,+AL',
    image: '/uploads/area-huntsville-rocket.jpg',
    altText: 'US Space and Rocket Center in Huntsville Alabama - roofing services area',
    description: 'Serving the Rocket City with expert roofing solutions for homes and businesses. Fast response times and metal roofing specialists.',
    name: 'Huntsville',
    tagline: 'The Rocket City',
    status: 'Active',
    state: 'AL',
    coverage: 'City and Madison County area',
    services: 'All residential and commercial',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'Metal roofing specialists for Huntsville homes',
      'Frequent storm and hail damage area',
      'IKO certified contractor',
      'Full insurance claim assistance'
    ]
  },
  {
    id: 3,
    slug: 'madison-al',
    mapQuery: 'Madison,+AL',
    image: '/uploads/area-madison.jpg',
    altText: 'Suburban neighborhood in Madison Alabama - roofing services area',
    description: 'Madison is one of North Alabama\'s fastest-growing cities, and we\'re proud to serve its homeowners with quality roofing. We specialize in LeafX gutter guards and residential roof replacement.',
    name: 'Madison',
    tagline: "North Alabama's Fastest Growing City",
    status: 'Active',
    state: 'AL',
    coverage: 'City and surrounding suburbs',
    services: 'All residential services',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'LeafX gutter guards popular for mature tree coverage',
      'New construction and existing home roofing',
      'Free inspections for Madison homeowners',
      'Tornado alley — storm damage expertise'
    ]
  },
  {
    id: 4,
    slug: 'athens-al',
    mapQuery: 'Athens,+AL',
    image: '/uploads/area-athens.jpg',
    altText: 'Limestone County Courthouse in Athens Alabama - roofing services area',
    description: 'Serving Athens and Limestone County with comprehensive roofing services. From college housing to historic homes.',
    name: 'Athens',
    tagline: 'Heart of Limestone County',
    status: 'Active',
    state: 'AL',
    coverage: 'City of Athens area',
    services: 'All residential and commercial',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'Diverse housing stock — historic homes to new builds',
      'Limestone County storm and hail damage repairs',
      'Free roof inspections available',
      'Insurance claim assistance for storm damage'
    ]
  },
  {
    id: 5,
    slug: 'owens-crossroads-al',
    mapQuery: 'Owens+Crossroads,+AL',
    image: '/uploads/area-owens-crossroads.jpg',
    altText: 'Mountain overlook near Hampton Cove and Owens Cross Roads Alabama - roofing services area',
    description: 'Expert roofing services for Owens Crossroads and the Hampton Cove area. Mountain and foothill homes require specialized storm protection.',
    name: 'Owens Crossroads',
    tagline: 'Gateway to Hampton Cove',
    status: 'Active',
    state: 'AL',
    coverage: 'Community and surrounding areas',
    services: 'Residential and some commercial',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'Adjacent to Hampton Cove — serving mountain and foothill homes',
      'High wind and storm exposure on elevated terrain',
      'Free inspections for Owens Crossroads homeowners',
      'IKO impact-resistant shingles recommended for the area'
    ]
  },
  {
    id: 9,
    slug: 'hartselle-al',
    mapQuery: 'Hartselle,+AL',
    image: '/uploads/area-hartselle.jpg',
    altText: 'Hartselle Alabama small town charm - roofing services area',
    description: 'Trusted roofing services in Hartselle, AL. Residential roof replacement, storm damage repair, and free inspections for Morgan County homeowners.',
    name: 'Hartselle',
    tagline: 'The City of Southern Hospitality',
    status: 'Active',
    state: 'AL',
    coverage: 'Hartselle and surrounding Morgan County',
    services: 'All residential and commercial',
    responseTime: 'Same-day available',
    keyDetails: [
      'Close proximity to our Decatur headquarters',
      'Spring storm and hail damage common',
      'Free inspections — same-day available',
      'Insurance claim support for Morgan County homeowners'
    ]
  },
  {
    id: 10,
    slug: 'cullman-al',
    mapQuery: 'Cullman,+AL',
    image: '/uploads/area-cullman.jpg',
    altText: 'Cullman Alabama roofing services area',
    description: 'Professional roofing contractor serving Cullman, AL. Expert roof replacement, repair, and storm damage restoration for Cullman County homes and businesses.',
    name: 'Cullman',
    tagline: 'Heart of Cullman County',
    status: 'Active',
    state: 'AL',
    coverage: 'Cullman and Cullman County',
    services: 'All residential and commercial',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'Tornado alley — storm damage expertise',
      'Residential and commercial coverage',
      'Insurance claim assistance available',
      'Free roof inspections for Cullman County'
    ]
  },
  {
    id: 11,
    slug: 'moulton-al',
    mapQuery: 'Moulton,+AL',
    image: '/uploads/area-moulton.jpg',
    altText: 'Moulton Alabama Lawrence County roofing services',
    description: 'Reliable roofing services for Moulton and Lawrence County, AL. Free roof inspections, storm damage repair, and quality roof replacement.',
    name: 'Moulton',
    tagline: "Lawrence County's County Seat",
    status: 'Active',
    state: 'AL',
    coverage: 'Moulton and Lawrence County',
    services: 'All residential services',
    responseTime: 'Next day - 2 days',
    keyDetails: [
      'Full Lawrence County coverage',
      'Storm season preparedness and emergency tarping',
      'Free inspections for Lawrence County homeowners',
      'Personalized service for rural and residential properties'
    ]
  },
  {
    id: 12,
    slug: 'florence-al',
    mapQuery: 'Florence,+AL',
    image: '/uploads/area-florence.jpg',
    altText: 'Florence Alabama Shoals area roofing services',
    description: 'Expert roofing services in Florence and the Shoals area. Roof replacement, repair, and storm damage restoration for Lauderdale County.',
    name: 'Florence',
    tagline: 'The Renaissance City of the Shoals',
    status: 'Active',
    state: 'AL',
    coverage: 'Florence, Muscle Shoals, Sheffield, Tuscumbia',
    services: 'All residential and commercial',
    responseTime: 'Next day - 3 days',
    keyDetails: [
      'Shoals area coverage — Florence, Muscle Shoals, Sheffield, Tuscumbia',
      'Historic homes and modern builds',
      'Full insurance claim support',
      'Free inspections across the Quad Cities'
    ]
  },
  {
    id: 13,
    slug: 'albertville-al',
    mapQuery: 'Albertville,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Albertville Alabama Marshall County roofing services',
    description: 'Professional roofing services in Albertville, the largest city in Marshall County. Serving over 34,000 residents with expert roof repair, replacement, and storm damage restoration.',
    name: 'Albertville',
    tagline: 'The Heart of Marshall County',
    status: 'Active',
    state: 'AL',
    coverage: 'Albertville and surrounding Marshall County',
    services: 'All residential and commercial',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'Largest city in Marshall County with 34,000+ residents',
      'Known as the poultry capital — strong local economy',
      'Spring severe weather and hail damage common',
      'Free roof inspections for Albertville homeowners'
    ],
    customFAQs: [
      { question: 'Do you serve all of Albertville and Marshall County?', answer: 'Yes! River City Roofing Solutions provides full roofing services across Albertville and all of Marshall County. As the largest city in the county with over 34,000 residents, Albertville is a key part of our service territory. We offer same-day to 2-day response times.' },
      { question: 'What types of storm damage are common in Albertville?', answer: 'Albertville and Marshall County are located in North Alabama\'s tornado alley, making them prone to severe thunderstorms, hail, and high winds — especially in spring. We specialize in storm damage assessment, emergency tarping, and full roof restoration with insurance claim support.' },
      { question: 'Do you offer financing for roof replacement in Albertville?', answer: 'We work with multiple financing options and, most importantly, we help Albertville homeowners navigate insurance claims for storm and hail damage. Many roof replacements are partially or fully covered by homeowners insurance after qualifying storm events.' },
    ]
  },
  {
    id: 14,
    slug: 'guntersville-al',
    mapQuery: 'Guntersville,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Lake Guntersville Alabama roofing services',
    description: 'Expert roofing contractor serving Guntersville on beautiful Lake Guntersville. Residential and commercial roofing, storm damage repair, and lakefront property expertise.',
    name: 'Guntersville',
    tagline: 'Jewel of Lake Guntersville',
    status: 'Active',
    state: 'AL',
    coverage: 'Guntersville and Lake Guntersville area',
    services: 'All residential and commercial',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'Lakefront and waterfront property roofing specialists',
      'High wind exposure near Lake Guntersville',
      'Marshall County storm damage expertise',
      'Free inspections for Guntersville homeowners'
    ],
    customFAQs: [
      { question: 'Do lakefront homes in Guntersville need special roofing?', answer: 'Absolutely. Homes along Lake Guntersville face higher wind exposure and moisture levels. We recommend impact-resistant shingles and proper ventilation systems to protect lakefront properties. Our team has extensive experience with waterfront roofing challenges in the area.' },
      { question: 'How often should I get my roof inspected in Guntersville?', answer: 'We recommend annual inspections for Guntersville homes, especially after spring storm season. Lake Guntersville area homes face additional wind and moisture exposure, making regular maintenance critical. We offer free inspections year-round.' },
      { question: 'Can you repair storm damage on my Guntersville vacation home?', answer: 'Yes! We service both primary residences and vacation properties around Lake Guntersville. We can coordinate inspections and repairs even if you\'re not on-site, and we handle all insurance claim documentation and communication on your behalf.' },
    ]
  },
  {
    id: 15,
    slug: 'arab-al',
    mapQuery: 'Arab,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Arab Alabama Marshall County roofing services',
    description: 'Trusted roofing services in Arab, AL. Roof replacement, storm damage repair, and free inspections for this growing Marshall County community near Lake Guntersville.',
    name: 'Arab',
    tagline: 'Growing Community Near Lake Guntersville',
    status: 'Active',
    state: 'AL',
    coverage: 'Arab and eastern Marshall County',
    services: 'All residential and commercial',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'Fast-growing community in Marshall County',
      'Near Lake Guntersville — wind and storm exposure',
      'Free inspections for Arab homeowners',
      'Full insurance claim support for storm damage'
    ],
    customFAQs: [
      { question: 'What areas near Arab do you also serve?', answer: 'In addition to Arab, we serve all of eastern Marshall County including nearby Guntersville, Albertville, Union Grove, and the surrounding rural communities. Our crews cover the entire region with same-day to 2-day response times.' },
      { question: 'Is Arab in a high-risk area for hail damage?', answer: 'Yes, Arab and the surrounding Marshall County area sit in North Alabama\'s severe weather corridor. Spring and summer hailstorms are common. We recommend annual roof inspections and offer free assessments after any major storm event.' },
      { question: 'Do you handle both residential and commercial roofing in Arab?', answer: 'Yes! We provide full residential and commercial roofing services in Arab. From single-family homes to commercial buildings, we handle roof replacement, repair, storm damage restoration, and insurance claims for all property types.' },
    ]
  },
  {
    id: 16,
    slug: 'scottsboro-al',
    mapQuery: 'Scottsboro,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Scottsboro Alabama Jackson County roofing services',
    description: 'Professional roofing contractor serving Scottsboro, the county seat of Jackson County. Expert roof replacement, repair, and storm damage restoration near the Tennessee River.',
    name: 'Scottsboro',
    tagline: 'Jackson County Seat on the Tennessee River',
    status: 'Active',
    state: 'AL',
    coverage: 'Scottsboro and Jackson County',
    services: 'All residential and commercial',
    responseTime: 'Next day - 2 days',
    keyDetails: [
      'Jackson County seat with 15,000+ residents',
      'Tennessee River valley storm and wind damage expertise',
      'Free roof inspections for Scottsboro homeowners',
      'Insurance claim assistance for Jackson County'
    ],
    customFAQs: [
      { question: 'How far is Scottsboro from your main office?', answer: 'Scottsboro is about 60 miles east of our Decatur headquarters. We have crews that regularly serve Jackson County with next-day to 2-day response times. For emergency storm damage, we can often respond same-day with tarping and temporary repairs.' },
      { question: 'What roofing challenges are unique to the Scottsboro area?', answer: 'Scottsboro sits in the Tennessee River valley, which funnels severe weather through the area. Jackson County frequently experiences strong thunderstorms, hail, and occasional tornado activity. We specialize in storm-resistant roofing systems and fast post-storm response.' },
      { question: 'Do you work with Jackson County insurance claims?', answer: 'Absolutely. We have extensive experience with insurance claims throughout Jackson County. We document all storm damage with photos and detailed reports, meet with adjusters on-site, and guide Scottsboro homeowners through every step of the claims process.' },
    ]
  },
  {
    id: 17,
    slug: 'fort-payne-al',
    mapQuery: 'Fort+Payne,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Fort Payne Alabama DeKalb County roofing services',
    description: 'Expert roofing services in Fort Payne, the county seat of DeKalb County. Known as the Sock Capital of the World, Fort Payne deserves top-quality roofing protection.',
    name: 'Fort Payne',
    tagline: 'Sock Capital of the World',
    status: 'Active',
    state: 'AL',
    coverage: 'Fort Payne and DeKalb County',
    services: 'All residential and commercial',
    responseTime: 'Next day - 2 days',
    keyDetails: [
      'DeKalb County seat with 15,000+ residents',
      'Near Lookout Mountain — elevated terrain wind exposure',
      'Free roof inspections for Fort Payne homeowners',
      'Insurance claim assistance for DeKalb County storms'
    ],
    customFAQs: [
      { question: 'Does the mountain terrain near Fort Payne affect roofing needs?', answer: 'Yes. Fort Payne sits at the foot of Lookout Mountain, and homes on elevated terrain face higher wind exposure. We recommend impact-resistant shingles and proper wind-rated installation methods for DeKalb County properties to withstand the stronger gusts common in the area.' },
      { question: 'Do you serve the entire DeKalb County area from Fort Payne?', answer: 'Yes! We serve all of DeKalb County including Fort Payne, Rainsville, Mentone, Valley Head, and surrounding communities. Our crews provide next-day to 2-day response times throughout the county.' },
      { question: 'Can you handle commercial roofing for Fort Payne businesses?', answer: 'Absolutely. Fort Payne has a strong manufacturing and industrial base, and we provide commercial roofing services including flat roof systems, TPO, metal roofing, and emergency repairs for businesses throughout DeKalb County.' },
    ]
  },
  {
    id: 18,
    slug: 'muscle-shoals-al',
    mapQuery: 'Muscle+Shoals,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Muscle Shoals Alabama Colbert County roofing services',
    description: 'Trusted roofing contractor serving Muscle Shoals, AL — home of legendary FAME Studios. Residential and commercial roofing, storm damage repair, and free inspections in Colbert County.',
    name: 'Muscle Shoals',
    tagline: 'Home of FAME Studios & Music History',
    status: 'Active',
    state: 'AL',
    coverage: 'Muscle Shoals and Colbert County',
    services: 'All residential and commercial',
    responseTime: 'Next day - 3 days',
    keyDetails: [
      'Part of the Quad Cities (Florence, Sheffield, Tuscumbia)',
      'Colbert County storm and hail damage repairs',
      'Free inspections for Muscle Shoals homeowners',
      'Full insurance claim support for Shoals area'
    ],
    customFAQs: [
      { question: 'Do you also serve Florence, Sheffield, and Tuscumbia?', answer: 'Yes! We serve all of the Quad Cities area — Muscle Shoals, Florence, Sheffield, and Tuscumbia. We also have a dedicated Florence service area page. Our crews provide comprehensive coverage across Colbert and Lauderdale Counties.' },
      { question: 'What makes Muscle Shoals homes vulnerable to storm damage?', answer: 'The Shoals area experiences severe thunderstorms and hail throughout spring and summer. Muscle Shoals and surrounding Colbert County sit in Alabama\'s tornado alley. We specialize in storm damage assessment, insurance claims, and installing weather-resistant roofing systems.' },
      { question: 'How do I schedule a free roof inspection in Muscle Shoals?', answer: 'Call us at (256) 274-8530 or fill out our online contact form. We typically schedule Muscle Shoals inspections within 1-3 business days. Our inspectors will provide a detailed photo report and honest assessment of your roof\'s condition at no cost.' },
    ]
  },
  {
    id: 19,
    slug: 'meridianville-al',
    mapQuery: 'Meridianville,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Meridianville Alabama Madison County roofing services',
    description: 'Professional roofing services in Meridianville, an unincorporated community in northern Madison County. Expert storm damage repair and roof replacement for this growing area.',
    name: 'Meridianville',
    tagline: 'Growing Community in North Madison County',
    status: 'Active',
    state: 'AL',
    coverage: 'Meridianville and northern Madison County',
    services: 'All residential services',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'Unincorporated community with 7,000+ residents',
      'Rapidly growing residential area in Madison County',
      'Free roof inspections for Meridianville homeowners',
      'Storm and hail damage expertise for North Madison County'
    ],
    customFAQs: [
      { question: 'Is Meridianville included in your Huntsville service area?', answer: 'Meridianville is close to Huntsville but we give it dedicated attention as its own service area. Located in northern Madison County, Meridianville residents enjoy same-day to 2-day response times from our team. We know the neighborhood well.' },
      { question: 'What roofing issues are common in Meridianville?', answer: 'Meridianville homes face the same severe weather threats as the rest of North Alabama — spring hailstorms, high winds, and occasional tornado activity. The area\'s rapid growth means many newer homes as well as established properties, each with their own maintenance needs.' },
      { question: 'Do you offer emergency storm repair in Meridianville?', answer: 'Yes! We provide 24/7 emergency response for storm damage in Meridianville and all of Madison County. We can typically have a crew on-site within hours for emergency tarping to prevent further water damage to your home.' },
    ]
  },
  {
    id: 20,
    slug: 'hazel-green-al',
    mapQuery: 'Hazel+Green,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Hazel Green Alabama Madison County roofing services',
    description: 'Expert roofing services for Hazel Green, an unincorporated community in northern Madison County. Free inspections, storm damage repair, and quality roof replacement.',
    name: 'Hazel Green',
    tagline: 'North Madison County Community',
    status: 'Active',
    state: 'AL',
    coverage: 'Hazel Green and northern Madison County',
    services: 'All residential services',
    responseTime: 'Same day - 2 days',
    keyDetails: [
      'Unincorporated community in northern Madison County',
      'Between Huntsville and the Tennessee border',
      'Free roof inspections for Hazel Green homeowners',
      'Insurance claim assistance for Madison County storms'
    ],
    customFAQs: [
      { question: 'Where exactly is Hazel Green in relation to Huntsville?', answer: 'Hazel Green is an unincorporated community in northern Madison County, located between Huntsville and the Alabama-Tennessee border along US-231. We serve all of Hazel Green and the surrounding northern Madison County area with same-day to 2-day response times.' },
      { question: 'Do you inspect roofs on older homes in Hazel Green?', answer: 'Absolutely. Hazel Green has a mix of established homes and newer construction. Our inspectors are experienced with all roof types and ages. We provide free, thorough inspections with photo documentation and honest recommendations — whether your roof needs minor repair or full replacement.' },
      { question: 'How do Hazel Green insurance claims typically work after a storm?', answer: 'After a storm in Hazel Green, call us for a free inspection. If we find damage, we document everything with photos and measurements, then help you file your insurance claim. We meet with your adjuster on-site, handle all paperwork, and ensure you get fair coverage for the repairs needed.' },
    ]
  },
  {
    id: 21,
    slug: 'priceville-al',
    mapQuery: 'Priceville,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Priceville Alabama Morgan County roofing services',
    description: 'Reliable roofing contractor serving Priceville, AL — just minutes from our Decatur headquarters. Fast response times for roof repair, replacement, and storm damage in Morgan County.',
    name: 'Priceville',
    tagline: 'Minutes from Our Decatur Headquarters',
    status: 'Active',
    state: 'AL',
    coverage: 'Priceville and surrounding Morgan County',
    services: 'All residential and commercial',
    responseTime: 'Same-day available',
    keyDetails: [
      'Adjacent to Decatur — fastest response times',
      'Morgan County storm damage expertise',
      'Free inspections for Priceville homeowners',
      'Close proximity to our materials and parts center'
    ],
    customFAQs: [
      { question: 'How close is Priceville to your headquarters?', answer: 'Priceville is right next to Decatur, where our headquarters is located at 3325 Central Pkwy SW. This means Priceville residents enjoy some of our fastest response times — often same-day service for inspections and emergency repairs.' },
      { question: 'What roofing services are most popular in Priceville?', answer: 'Priceville homeowners most commonly request roof replacements (often insurance-covered after storm damage), storm and hail damage repair, and free inspections. We also install LeafX gutter protection and provide chimney services for this area.' },
      { question: 'Is Priceville in a hail-prone area?', answer: 'Yes. Priceville and the greater Morgan County area sit squarely in North Alabama\'s severe weather corridor. Spring hailstorms are common and can cause significant roof damage. We recommend annual inspections and offer free assessments after every major storm event.' },
    ]
  },
  {
    id: 22,
    slug: 'somerville-al',
    mapQuery: 'Somerville,+AL',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Somerville Alabama Morgan County seat roofing services',
    description: 'Professional roofing services in Somerville, the historic county seat of Morgan County. Expert roof repair, replacement, and storm damage restoration for this charming community.',
    name: 'Somerville',
    tagline: 'Historic Morgan County Seat',
    status: 'Active',
    state: 'AL',
    coverage: 'Somerville and surrounding Morgan County',
    services: 'All residential services',
    responseTime: 'Same-day available',
    keyDetails: [
      'Historic Morgan County seat',
      'Near our Decatur headquarters — fast response',
      'Free inspections for Somerville homeowners',
      'Storm damage and insurance claim expertise'
    ],
    customFAQs: [
      { question: 'Do you have experience with historic homes in Somerville?', answer: 'Yes! As the historic county seat of Morgan County, Somerville has many older and historic properties. Our team has experience working with various roof types and architectural styles, ensuring repairs and replacements respect the character of older homes while providing modern protection.' },
      { question: 'How quickly can you get to Somerville for an emergency?', answer: 'Somerville is very close to our Decatur headquarters, so we can typically respond same-day for emergencies. For storm damage situations, we offer 24/7 emergency tarping to protect your home from further water damage until full repairs can be completed.' },
      { question: 'What is the typical cost of a roof replacement in Somerville?', answer: 'Roof replacement costs in Somerville typically range from $5,000 to $25,000+ depending on size, materials, and complexity. However, many Somerville homeowners qualify for insurance coverage after storm or hail damage events. We provide free detailed estimates so you know exactly what to expect.' },
    ]
  },
  {
    id: 6,
    slug: 'north-alabama',
    mapQuery: 'North+Alabama',
    image: '/uploads/area-north-alabama.jpg',
    altText: 'Scenic rolling hills and countryside in North Alabama - roofing services area',
    description: 'Proudly serving all of North Alabama with storm damage expertise and insurance claim support.',
    name: 'General North Alabama Territory',
    tagline: 'Covering All of North Alabama',
    status: 'Active',
    state: 'AL',
    coverage: 'Northern Alabama communities',
    services: 'Selective based on location',
    responseTime: 'Next day - 3 days',
    keyDetails: [
      'Storm-prone region — tornado alley location',
      'Hail damage common in spring and summer',
      'Insurance claim expertise for North AL homeowners',
      'Free inspections available territory-wide'
    ]
  },
  {
    id: 7,
    slug: 'birmingham-al',
    mapQuery: 'Birmingham,+AL',
    image: '/uploads/area-birmingham.jpg',
    altText: 'Birmingham Alabama city skyline - roofing services expansion area',
    description: 'Coming soon to Birmingham! Expanding our quality roofing services to Alabama\'s largest metro area.',
    name: 'Birmingham',
    tagline: "Alabama's Largest City",
    status: 'Expansion',
    state: 'AL',
    coverage: 'Birmingham metro area',
    services: 'All residential and commercial (planned)',
    launchDate: 'Coming 2026',
    expansionTimeline: [
      'Local team and office setup in progress',
      'Full residential and commercial services at launch',
      'Same quality and warranties as our North Alabama operations'
    ],
    keyDetails: [
      'Storm and hail damage expertise coming to Birmingham',
      'Full insurance claim assistance',
      'IKO certified contractor',
      'Free inspections at launch'
    ]
  },
  {
    id: 8,
    slug: 'nashville-tn',
    mapQuery: 'Nashville,+TN',
    image: '/uploads/area-nashville.webp',
    altText: 'Nashville Tennessee skyline - roofing services expansion area',
    description: 'Future expansion to Music City. Commercial and residential roofing services coming 2026.',
    name: 'Nashville',
    tagline: 'Music City',
    status: 'Expansion',
    state: 'TN',
    coverage: 'Nashville metro area',
    services: 'All residential and commercial (planned)',
    launchDate: 'Coming 2026',
    expansionTimeline: [
      'Market preparation underway',
      'Full residential and commercial services planned',
      'Same quality and warranties as our Alabama operations'
    ],
    keyDetails: [
      'Severe storm and hail damage common in Middle Tennessee',
      'Full insurance claim assistance',
      'Residential and commercial roofing services',
      'Free inspections at launch'
    ]
  }
];

export function getService(slug: string): Service | undefined {
  return services.find(service => service.slug === slug);
}

export function getAllServiceSlugs(): string[] {
  return services.map(service => service.slug);
}

export function getPrimaryServices(): Service[] {
  return services.filter(service => service.category === 'Primary');
}

export function getAdditionalServices(): Service[] {
  return services.filter(service => service.category === 'Additional');
}

export function getServiceArea(slug: string): ServiceArea | undefined {
  return serviceAreas.find(area => area.slug === slug);
}

export function getAllServiceAreaSlugs(): string[] {
  return serviceAreas.map(area => area.slug);
}

export function getActiveServiceAreas(): ServiceArea[] {
  return serviceAreas.filter(area => area.status === 'Active');
}

export function getExpansionServiceAreas(): ServiceArea[] {
  return serviceAreas.filter(area => area.status === 'Expansion');
}
