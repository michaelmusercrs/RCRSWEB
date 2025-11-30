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
  population?: string;
  coverage: string;
  services: string;
  responseTime?: string;
  launchDate?: string;
  regionalPartner?: string;
  keyDetails?: string[];
  expansionTimeline?: string[];
  image?: string;
  description?: string;
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
    image: '/uploads/service-residential.png',
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
    image: '/uploads/service-residential.png',
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
    image: '/uploads/service-residential.png',
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
    image: '/uploads/area-decatur.png',
    description: 'Our headquarters in Decatur provides same-day service and emergency response for residential and commercial roofing throughout Morgan County.',
    name: 'Decatur',
    status: 'Active',
    state: 'AL',
    coverage: 'City and surrounding areas',
    services: 'All residential and commercial',
    responseTime: 'Same-day available',
    keyDetails: [
      'Headquarters location: 3325 Central Pkwy SW, Decatur, AL 35603',
      'Full service center',
      'Parts and materials in stock',
      'Emergency response team based here'
    ]
  },
  {
    id: 2,
    slug: 'huntsville-al',
    image: '/uploads/area-huntsville.webp',
    description: 'Serving the Rocket City with expert roofing solutions for homes and businesses. Fast response times and metal roofing specialists.',
    name: 'Huntsville',
    status: 'Active',
    state: 'AL',
    population: '~215,000',
    coverage: 'City and Madison County area',
    services: 'All residential and commercial',
    responseTime: '1-2 days',
    keyDetails: [
      'High demand market',
      'Metal roofing popular',
      'Storm damage common',
      'Professional community'
    ]
  },
  {
    id: 3,
    slug: 'madison-al',
    image: '/uploads/area-madison.jpg',
    description: 'Madison growing community deserves quality roofing. We specialize in LeafX gutter guards and residential roof replacement.',
    name: 'Madison',
    status: 'Active',
    state: 'AL',
    population: '~42,000',
    coverage: 'City and surrounding suburbs',
    services: 'All residential services',
    responseTime: '1-2 days',
    keyDetails: [
      'Growing suburban market',
      'LeafX gutter guards popular',
      'Family-oriented community',
      'Mature trees (gutter guards effective)'
    ]
  },
  {
    id: 4,
    slug: 'athens-al',
    image: '/uploads/area-athens.jpg',
    description: 'Serving Athens and Limestone County with comprehensive roofing services. From college housing to historic homes.',
    name: 'Athens',
    status: 'Active',
    state: 'AL',
    population: '~24,000',
    coverage: 'City of Athens area',
    services: 'All residential and commercial',
    responseTime: '1-2 days',
    keyDetails: [
      'College town',
      'Diverse housing stock',
      'Growing market'
    ]
  },
  {
    id: 5,
    slug: 'owens-crossroads-al',
    image: '/uploads/area-owens-crossroads.jpg',
    description: 'Quality roofing services for the Owens Crossroads community. Personalized attention and strong local relationships.',
    name: 'Owens Crossroads',
    status: 'Active',
    state: 'AL',
    coverage: 'Community and surrounding areas',
    services: 'Residential and some commercial',
    responseTime: '1-2 days',
    keyDetails: [
      'Smaller community',
      'Picturesque area',
      'Residential focus',
      'Strong relationships'
    ]
  },
  {
    id: 6,
    slug: 'north-alabama',
    image: '/uploads/area-north-alabama.png',
    description: 'Proudly serving all of North Alabama with storm damage expertise and insurance claim support.',
    name: 'General North Alabama Territory',
    status: 'Active',
    state: 'AL',
    coverage: 'Northern Alabama communities',
    services: 'Selective based on location',
    responseTime: '2-3 days',
    keyDetails: [
      'Storm-prone region',
      'Hail damage common',
      'Insurance claim expertise valued',
      'Seasonal storm season critical'
    ]
  },
  {
    id: 7,
    slug: 'birmingham-al',
    image: '/uploads/service-commercial.png',
    description: 'Coming soon to Birmingham! Expanding our quality roofing services to Alabamas largest metro area.',
    name: 'Birmingham',
    status: 'Expansion',
    state: 'AL',
    population: '~200,000+',
    coverage: 'Birmingham metro area',
    services: 'All residential and commercial (planned)',
    launchDate: 'Q4 2025',
    regionalPartner: 'Hunter',
    expansionTimeline: [
      'Q3 2025: Market analysis and relationship building',
      'Q4 2025: Official launch with local team',
      'Regional office establishment',
      'Local crew hiring',
      'Supply chain setup',
      'Marketing campaign'
    ],
    keyDetails: [
      'Major metro area',
      'Significant market potential',
      'Commercial building demand',
      'Storm damage expertise needed'
    ]
  },
  {
    id: 8,
    slug: 'nashville-tn',
    image: '/uploads/service-commercial.png',
    description: 'Future expansion to Music City. Commercial and residential roofing services coming 2026.',
    name: 'Nashville',
    status: 'Expansion',
    state: 'TN',
    population: '~600,000+',
    coverage: 'Nashville metro area',
    services: 'All residential and commercial (planned)',
    launchDate: '2026',
    regionalPartner: 'Aaron',
    expansionTimeline: [
      'Q1 2025: Market research and analysis',
      'Q2-Q3 2025: Relationship building and networking (Aaron\'s BNI connections)',
      'Q4 2025: Pre-launch preparation',
      'Q1-Q2 2026: Official launch',
      'Local team and operations setup'
    ],
    keyDetails: [
      'Largest metro expansion',
      'Music City market growth',
      'Commercial building demand',
      'Regional hub potential',
      'Growth market potential'
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
