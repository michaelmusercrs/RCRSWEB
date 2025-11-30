export interface TeamMember {
  slug: string;
  name: string;
  company: string;
  category: 'In Loving Memory' | 'Leadership' | 'Regional Partner' | 'Office' | 'Production' | 'Partners & Advisors';
  position: string;
  phone: string;
  email: string;
  altEmail: string;
  displayOrder: number;
  bio: string;
  tagline?: string;
  region?: string;
  launchDate?: string;
  profileImage?: string;
  truckImage?: string;
  facebook?: string;
  instagram?: string;
  x?: string;
  tiktok?: string;
  linkedin?: string;
  keyStrengths?: string[];
  responsibilities?: string[];
  // Legacy fields for compatibility
  role?: string;
  specialties?: string[];
  experience?: string;
  certifications?: string[];
  aboutLong?: string[];
}

export const teamMembers: TeamMember[] = [
  {
    slug: 'chris-muse',
    name: 'Chris Muse',
    company: 'River City Roofing Solutions',
    category: 'Leadership',
    position: 'President',
    phone: '256-648-1224',
    email: 'chrismuse@rcrsal.com',
    altEmail: 'chrismuse@rcrsal.com',
    displayOrder: 1,
    profileImage: '/uploads/chris-muse.png',
    facebook: 'https://www.facebook.com/RiverCityRoofingSolutions',
    instagram: 'https://www.instagram.com/rivercityroofingsolutions/',
    tiktok: 'https://www.tiktok.com/@river.city.roofin',
    x: 'https://x.com/roofing_river',
    tagline: 'Drives the company forward with extensive industry experience and a passion for community.',
    bio: "Chris is a dedicated family man with a son, Brendon (who is also on the team), and two daughters, Katie Bell and Elizabeth. He has a long and deep history in construction, having worked every role from framing to roofing. He has done every part of the roofing process from installing, leading a crew, sales, and project managing. This comprehensive background gives him a unique understanding of the entire roofing process. Having personally handled thousands of insurance claims, he's an expert at navigating the system to ensure homeowners get the coverage they deserve. His favorite shingle is the IKO Royal Estate in Shadow Slate, a choice that reflects his eye for quality and durability. Outside of work, Chris is an avid golfer and enjoys watching Alabama football on Saturdays and cheering on the Atlanta Braves. He is very involved in youth basketball, coaching and managing the very successful 'River City Net Reepers' girls youth squad. Above all, he enjoys helping homeowners and takes great pride in watching the River City team grow and succeed.",
    keyStrengths: [
      'Comprehensive roofing industry knowledge from installation to management',
      'Expert insurance claims navigation with thousands of claims handled',
      'Strong leadership and team development abilities',
      'Deep community involvement and relationship building',
      'Strategic business vision and growth planning'
    ],
    responsibilities: [
      'Set company vision and strategic direction',
      'Oversee all business operations and growth initiatives',
      'Lead complex insurance claim negotiations',
      'Build and maintain key industry relationships',
      'Mentor and develop team leadership',
      'Ensure quality standards across all projects'
    ],
  },
  {
    slug: 'michael-muse',
    name: 'Michael Muse',
    company: 'River City Roofing Solutions',
    category: 'Leadership',
    position: 'Vice President',
    phone: '256-221-4290',
    email: 'michaelmuse@rcrsal.com',
    altEmail: 'michaelmuse@rcrsal.com',
    displayOrder: 2,
    profileImage: '/uploads/michael-muse.png',
    facebook: 'https://www.facebook.com/RiverCityRoofingSolutions',
    instagram: 'https://www.instagram.com/rivercityroofingsolutions/',
    tiktok: 'https://www.tiktok.com/@river.city.roofin',
    x: 'https://x.com/roofing_river',
    tagline: 'Leads sales and marketing with a focus on empowering the team and ensuring customer satisfaction.',
    bio: "Michael, much like his brother Chris, brings extensive experience to the roofing industry. He has worked in every aspect of the business, from hands-on installation to developing effective sales and marketing strategies. His preferred shingle is the IKO Nordic in Granite Black, a choice reflecting his appreciation for superior durability and hail resistance. Having assisted thousands of homeowners with roof replacements, Michael derives great satisfaction from seeing the River City team consistently meet and exceed customer expectations. He is passionate about empowering his team to continuously improve and deliver exceptional service. A dedicated family man, Michael has two sons, Michael Jr. and Boston, and two grandchildren, Skis and Wrenly. He enjoyed coaching his sons' football teams when they were younger.",
    keyStrengths: [
      'Sales strategy development and execution',
      'Marketing campaign planning and implementation',
      'Team training and empowerment',
      'Customer relationship management',
      'Process optimization and improvement'
    ],
    responsibilities: [
      'Lead all sales and marketing initiatives',
      'Develop and implement growth strategies',
      'Train and mentor sales team members',
      'Oversee customer satisfaction programs',
      'Monitor and improve sales processes',
      'Build strategic partnerships and referral networks'
    ],
  },
  {
    slug: 'hunter',
    name: 'Hunter',
    company: 'River City Roofing Solutions',
    category: 'Regional Partner',
    position: 'Regional Partner',
    phone: '256-221-0548',
    email: 'hunter@rcrsal.com',
    altEmail: 'hunter@rcrsal.com',
    displayOrder: 3,
    region: 'Birmingham',
    launchDate: 'Q4 2025',
    profileImage: '/uploads/hunter.png',
    tagline: 'A cornerstone of RCRS, building relationships through honesty and transparency.',
    bio: "A true cornerstone of River City Roofing Solutions, Hunter has been an indispensable part of our journey since day one. His unwavering dedication and deep-seated knowledge of the roofing industry have been instrumental in shaping our company's commitment to quality and customer satisfaction. As one of our original team members, Hunter embodies the spirit and work ethic that our reputation is built upon. As a Sales Inspector, Hunter is known for his meticulous and honest assessments. He believes in empowering homeowners with clear, straightforward information, ensuring they can make confident decisions about their property. His goal isn't just to make a sale, but to build lasting relationships based on trust and transparency. Outside of work, Hunter is a devoted family man, happily married to Mary Rivers. Together, they are raising their wonderful Jackson and their beloved dogs, Bandit and Birdie. He cherishes his off-time, enjoying well-deserved moments with his family.",
    keyStrengths: [
      'Meticulous roof inspection and damage assessment',
      'Honest and transparent customer communication',
      'Deep roofing industry knowledge',
      'Relationship building and trust development',
      'Regional market expertise for Birmingham expansion'
    ],
    responsibilities: [
      'Conduct thorough roof inspections',
      'Provide detailed assessment reports to homeowners',
      'Develop Birmingham regional operations',
      'Build and maintain customer relationships',
      'Educate homeowners on roofing options',
      'Coordinate with insurance adjusters'
    ],
  },
  {
    slug: 'aaron',
    name: 'Aaron',
    company: 'River City Roofing Solutions',
    category: 'Regional Partner',
    position: 'Regional Partner',
    phone: '256-656-7856',
    email: 'aaron@rcrsal.com',
    altEmail: 'aaron@rcrsal.com',
    displayOrder: 4,
    region: 'Nashville',
    launchDate: '2026',
    profileImage: '/uploads/aaron.jpg',
    tagline: 'Brings discipline and commitment from his Marine background to every inspection.',
    bio: "Aaron is a dedicated family man, married to his beautiful wife, Hannah, with whom he shares three wonderful children and three beloved dogs. His work as a Sales Inspector often rewards him with breathtaking views from rooftops across the region—a perk he enjoys almost as much as meeting friendly dogs on the job. His preferred shingle is the IKO Dynasty in the striking color Biscayne. His background is as impressive as his work ethic. Aaron proudly served in the Marines for 8 years, completing four tours in Afghanistan and Iraq. This experience instilled a deep sense of discipline and commitment that he brings to every inspection. Before joining us, he honed his expertise as an insurance adjuster for five years, giving him an invaluable perspective on the claims process. An avid traveler who has visited 18 countries, Aaron's leadership extends beyond his role at RCRS. He also serves as the President of his BNI chapter, demonstrating his commitment to professional growth and community networking. We are proud to have his experience, dedication, and positive energy on our team.",
    keyStrengths: [
      'Military discipline and attention to detail',
      '5 years insurance adjuster experience',
      'Expert understanding of claims process',
      'Strong leadership and networking abilities',
      'Regional market development expertise'
    ],
    responsibilities: [
      'Lead Nashville regional expansion',
      'Conduct professional roof inspections',
      'Navigate complex insurance claims',
      'Build BNI and community partnerships',
      'Train and mentor regional team members',
      'Develop Nashville market strategies'
    ],
  },
  {
    slug: 'sara-hill',
    name: 'Sara Hill',
    company: 'River City Roofing Solutions',
    category: 'Office',
    position: 'Office Manager',
    phone: '256-810-3594',
    email: 'sara@rcrsal.com',
    altEmail: 'sara@rcrsal.com',
    displayOrder: 6,
    profileImage: '/uploads/sara-hill.png',
    tagline: 'The organizational backbone of the office, ensuring smooth operations for our team.',
    bio: "As the dedicated Office Manager at River City Roofing Solutions, Sara brings a wealth of experience and a passion for excellence to every project. With a strong commitment to customer satisfaction, she plays a vital role in upholding our company's standards for quality and integrity. When not focused on delivering top-tier roofing solutions, Sara enjoys watching Alabama football and Braves baseball.",
    keyStrengths: [
      'Exceptional organizational and coordination skills',
      'Customer service excellence',
      'Office operations management',
      'Team communication and scheduling',
      'Quality control and standards maintenance'
    ],
    responsibilities: [
      'Oversee daily office operations',
      'Coordinate scheduling for inspections and installations',
      'Manage customer communications and inquiries',
      'Maintain project documentation and records',
      'Support sales and production teams',
      'Ensure quality standards are met'
    ],
  },
  {
    slug: 'tia',
    name: 'Tia',
    company: 'River City Roofing Solutions',
    category: 'Office',
    position: 'Admin',
    phone: '256-394-8396',
    email: 'tia@rcrsal.com',
    altEmail: 'tia@rcrsal.com',
    displayOrder: 7,
    profileImage: '/uploads/tia.png',
    tagline: 'Brings vibrant energy and a family-first attitude to our administrative team.',
    bio: "Tia brings a vibrant and positive energy to our team. She is a supermom to her adventurous 7-year-old, Mathias, and her resilient three-legged cat, Tipsy. Her family is a powerhouse of love and inspiration that shines through in her work. When asked what makes River City Roofing Solutions special, Tia says, 'It's the family vibe. Half of us might be family by blood, but here, it feels like we're all family.' This sentiment is at the core of our company culture. Her preferred roofing material is the IKO Dynasty in the Pacific Rim color, a choice as stylish and dependable as she is. Outside the office, Tia's greatest treasure is quality time with Mathias, whether they're exploring the wonders of nature or expressing their creativity with arts and crafts, especially painting. As an avid nature watcher and a die-hard Georgia Bulldogs fan, her enthusiasm is truly contagious.",
    keyStrengths: [
      'Positive attitude and team morale building',
      'Customer service and communication',
      'Administrative efficiency',
      'Family-oriented culture champion',
      'Multi-tasking and problem solving'
    ],
    responsibilities: [
      'Handle customer inquiries and support',
      'Process administrative paperwork',
      'Coordinate with team members on scheduling',
      'Maintain office organization',
      'Support project documentation',
      'Foster positive company culture'
    ],
  },
  {
    slug: 'boston',
    name: 'Boston',
    company: 'River City Roofing Solutions',
    category: 'Office',
    position: 'Marketing Director',
    phone: '256-555-0104',
    email: 'boston@rcrsal.com',
    altEmail: 'boston@rcrsal.com',
    displayOrder: 8,
    profileImage: '/uploads/boston.jpeg',
    tagline: 'Spreads the word about our quality work through networking and community engagement.',
    bio: "As Michael Muse's son, Boston proudly carries on the family tradition as a 3rd generation member of the roofing business. He serves as Marketing Director, bringing fresh energy and modern marketing strategies to River City Roofing Solutions. Boston is an active member of the Limestone Leaders BNI networking group, where he builds valuable business relationships throughout North Alabama. He thrives on networking and connecting with new people, passionately sharing the story of River City's commitment to quality craftsmanship. Outside of work, Boston is an animal lover with two rescue dogs—Stitch (named because he knocked Boston down when they first met at the animal shelter) and Juniper. When he's not working or spending time with his dogs, you'll find him fishing on local lakes or offroading through the Alabama countryside. His combination of family legacy, youthful enthusiasm, and genuine love for the community makes him an invaluable part of the River City team.",
    keyStrengths: [
      '3rd generation roofing industry knowledge',
      'BNI networking and relationship building',
      'Digital marketing and social media',
      'Brand development and promotion',
      'Community engagement and partnerships'
    ],
    responsibilities: [
      'Develop and execute marketing strategies',
      'Manage social media presence and campaigns',
      'Lead BNI networking initiatives',
      'Build community partnerships',
      'Create marketing content and materials',
      'Track and analyze marketing ROI'
    ],
  },
  {
    slug: 'destin',
    name: 'Destin',
    company: 'River City Roofing Solutions',
    category: 'Office',
    position: 'Admin',
    phone: '256-905-7738',
    email: 'destin@rcrsal.com',
    altEmail: 'destin@rcrsal.com',
    displayOrder: 9,
    profileImage: '/uploads/destin.png',
    tagline: 'Spreads positivity while managing administrative tasks and connecting with our team.',
    bio: "Destin is a proud mom to her two wonderful children, Paisley and Memphis, who are the light of her life. Her favorite shingles are the stylish and durable IKO Nordic in Granite Black. What Destin loves most about RCRS is the incredible work family she's a part of. She looks forward to connecting with her team and meeting new people every day. Outside of work, Destin is a coffee enthusiast with a passion for all genres of music. She believes in spreading positivity wherever she goes, and her dedicated and cheerful presence is a great asset to our team.",
    keyStrengths: [
      'Positive attitude and team motivation',
      'Customer communication and support',
      'Administrative organization',
      'Interpersonal connection building',
      'Detail-oriented task management'
    ],
    responsibilities: [
      'Manage administrative tasks and documentation',
      'Support customer service operations',
      'Coordinate team communications',
      'Maintain organized office systems',
      'Assist with scheduling and appointments',
      'Foster positive team environment'
    ],
  },
  {
    slug: 'john',
    name: 'John',
    company: 'River City Roofing Solutions',
    category: 'Production',
    position: 'Production Manager',
    phone: '256-654-0875',
    email: 'john@rcrsal.com',
    altEmail: 'john@rcrsal.com',
    displayOrder: 10,
    profileImage: '/uploads/john.png',
    tagline: 'A cornerstone of our operations, ensuring projects run smoothly and efficiently.',
    bio: "As our invaluable Project Manager, John brings a fantastic attitude, dedication, and a commitment to quality to every job site. He is a cornerstone of our operations, ensuring that projects run smoothly and efficiently. John's favorite part of the job is interacting with everyone involved, from our skilled crew to our valued customers, ensuring clear communication and a positive experience for all. His shingle of choice is the IKO Dynasty in Glacier—a testament to his eye for quality. A former Auburn Tiger, John is as comfortable in the great outdoors as he is on a roof. When he's not in the woods or on a roof, you might find him enjoying a good game of cards. We're incredibly lucky to have John's leadership and positive energy on the River City team.",
    keyStrengths: [
      'Project coordination and management',
      'Crew leadership and motivation',
      'Quality control and inspection',
      'Customer communication excellence',
      'Problem solving and efficiency optimization'
    ],
    responsibilities: [
      'Oversee all roofing installation projects',
      'Coordinate crew schedules and assignments',
      'Ensure quality standards on every job',
      'Communicate with customers throughout projects',
      'Manage materials and equipment logistics',
      'Train and mentor production team members'
    ],
  },
  {
    slug: 'brendon',
    name: 'Brendon',
    company: 'River City Roofing Solutions',
    category: 'Production',
    position: 'Sales Inspector',
    phone: '256-616-6174',
    email: 'brendon@rcrsal.com',
    altEmail: 'brendon@rcrsal.com',
    displayOrder: 11,
    profileImage: '/uploads/brendon.jpg',
    facebook: 'https://www.facebook.com/RiverCityRoofingSolutions',
    instagram: 'https://www.instagram.com/rivercityroofingsolutions/',
    tiktok: 'https://www.tiktok.com/@river.city.roofin',
    x: 'https://x.com/roofing_river',
    tagline: 'A third-generation roofer upholding the family legacy of trust and excellence.',
    bio: "As the son of owner Chris Muse, Brendon is proud to be the 3rd generation in the family business. He brings a deep-rooted passion for quality craftsmanship and customer service to his role as a Sales Inspector. When he's not on a roof, Brendon is a devoted husband to his beautiful wife, A'Lena Muse, and a passionate fan of Alabama football. He takes pride in upholding the family legacy of trust and excellence that River City Roofing Solutions is known for.",
    keyStrengths: [
      '3rd generation roofing expertise',
      'Family business values and tradition',
      'Thorough inspection techniques',
      'Customer education and trust building',
      'Quality craftsmanship focus'
    ],
    responsibilities: [
      'Conduct comprehensive roof inspections',
      'Assess storm and hail damage',
      'Provide detailed inspection reports',
      'Educate homeowners on roofing options',
      'Work with insurance adjusters',
      'Uphold family legacy of excellence'
    ],
  },
  {
    slug: 'bart',
    name: 'Bart',
    company: 'River City Roofing Solutions',
    category: 'Production',
    position: 'Insurance Claims Specialist',
    phone: '256-654-0747',
    email: 'bart@rcrsal.com',
    altEmail: 'bart@rcrsal.com',
    displayOrder: 12,
    profileImage: '/uploads/bart.png',
    tagline: "Helps ensure claims are handled accurately and in the homeowner's best interest.",
    bio: "As our Insurance Claims Specialist, Bart masterfully helps homeowners and our sales teams navigate the complexities of insurance claims, ensuring everyone receives the support they deserve. His favorite shingle is the stylish and durable IKO Dynasty in Granite Black. For Bart, the best part of working at RCRS is the family atmosphere. This sense of community extends to his own family—he loves spending time with his wife Carolyn, their son Andrew, and their adorable dog, Yoshi. When he's not on the job, Bart is a passionate Alabama Football fan (Roll Tide!), an avid hiker, and a dedicated father who enjoys watching his son play sports. His hard work and a positive attitude make him an invaluable asset to the River City family.",
    keyStrengths: [
      'Insurance claims expertise and navigation',
      'Negotiation with insurance adjusters',
      'Policy interpretation and coverage analysis',
      'Homeowner advocacy and support',
      'Documentation and claims processing'
    ],
    responsibilities: [
      'Guide homeowners through insurance claims process',
      'Negotiate with insurance adjusters',
      'Prepare detailed damage documentation',
      'Support sales team with claims expertise',
      'Ensure maximum coverage for homeowners',
      'Handle complex claim situations'
    ],
  },
  {
    slug: 'tae',
    name: 'Tae',
    company: 'River City Roofing Solutions',
    category: 'Production',
    position: 'Materials Manager',
    phone: '256-200-3467',
    email: 'tae@rcrsal.com',
    altEmail: 'tae@rcrsal.com',
    displayOrder: 13,
    profileImage: '/uploads/tae.jpg',
    tagline: 'Keeps projects running smoothly by managing supplies, deliveries, and on-site logistics.',
    bio: "As Materials Manager, Tae brings a remarkable spirit of hard work and dedication to the River City Roofing team. He is a driven individual, passionate about his work, and committed to getting every job done right by managing supplies, deliveries, and on-site logistics. His approach is built on honesty and transparency, ensuring fairness in all his interactions. His shingle of choice is the IKO Dynasty in the color Biscayne. For Tae, the best part of RCRS is the team itself, saying, 'Everyone here feels like family... we always get the job done together.' Happily married to his wife, Keyerra, Tae also loves to give back to the community by coaching and training kids in basketball. In his downtime, he enjoys traveling. We are incredibly fortunate to have Tae's passion and team spirit in our family.",
    keyStrengths: [
      'Materials inventory management',
      'Logistics coordination and scheduling',
      'Vendor relationships and ordering',
      'On-site delivery coordination',
      'Cost efficiency and waste reduction'
    ],
    responsibilities: [
      'Manage all roofing materials inventory',
      'Coordinate deliveries to job sites',
      'Maintain relationships with suppliers',
      'Track material costs and usage',
      'Ensure materials arrive on time',
      'Optimize materials ordering and storage'
    ],
  },
  {
    slug: 'greg',
    name: 'Greg',
    company: 'River City Roofing Solutions',
    category: 'Production',
    position: 'Sales Inspector',
    phone: '256-221-1809',
    email: 'greg@rcrsal.com',
    altEmail: 'greg@rcrsal.com',
    displayOrder: 15,
    profileImage: '/uploads/greg.png',
    tagline: 'Brings a positive attitude and a keen eye for detail to every property he visits.',
    bio: "As a Sales Inspector, Greg is one of the friendly faces you'll meet when you schedule a free inspection. He brings a positive attitude and a keen eye for detail to every property he visits. He's passionate about helping homeowners find the best solutions for their roofing needs, whether it's a minor repair or a full replacement. His favorite shingle is the IKO Dynasty in a stunning Pacific Rim color, a testament to his great taste. Greg loves the family atmosphere at River City Roofing Solutions, where everyone supports each other to provide the best service possible.",
    keyStrengths: [
      'Detailed roof inspection skills',
      'Positive customer interactions',
      'Problem identification and solutions',
      'Roofing system knowledge',
      'Customer education and guidance'
    ],
    responsibilities: [
      'Conduct free roof inspections',
      'Identify roof damage and issues',
      'Provide homeowners with assessment reports',
      'Recommend appropriate roofing solutions',
      'Answer customer questions',
      'Build trust through honest evaluations'
    ],
  },
  {
    slug: 'travis',
    name: 'Travis',
    company: 'River City Roofing Solutions',
    category: 'Production',
    position: 'Sales Inspector',
    phone: '256-555-0103',
    email: 'travis@rcrsal.com',
    altEmail: 'travis@rcrsal.com',
    displayOrder: 17,
    profileImage: '/uploads/travis.png',
    tagline: 'Dedicated to customer satisfaction with a deep connection to the local community.',
    bio: "As a dedicated Sales Inspector at River City Roofing Solutions, Travis brings a wealth of experience and a passion for excellence to every project. With a strong commitment to customer satisfaction, he plays a vital role in upholding our company's standards for quality and integrity. When not focused on delivering top-tier roofing solutions, Travis enjoys spending time with family, fishing on the Tennessee River, and volunteering in the local community. This connection to the community reinforces our company's identity as a trusted, local business.",
    keyStrengths: [
      'Community relationships and trust',
      'Thorough inspection techniques',
      'Customer satisfaction focus',
      'Local market knowledge',
      'Quality standards maintenance'
    ],
    responsibilities: [
      'Perform comprehensive roof inspections',
      'Provide detailed assessments to homeowners',
      'Build community relationships',
      'Represent company values in the field',
      'Support customer satisfaction initiatives',
      'Maintain inspection quality standards'
    ],
  },
  {
    slug: 'donnie-dotson',
    name: 'Donnie Dotson',
    company: 'River City Roofing Solutions',
    category: 'Partners & Advisors',
    position: 'Strategic Advisor',
    phone: '',
    email: '',
    altEmail: '',
    displayOrder: 18,
    profileImage: '/uploads/donnie-dotson.jpg',
    tagline: 'Guides our long-term vision with invaluable entrepreneurial experience.',
    bio: "Donnie has been part of River City Roofing Solutions since the very beginning, helping shape the company's direction and long-term vision. A successful entrepreneur with ventures across multiple industries, he brings valuable insight, experience, and perspective that strengthen our business decisions and help keep the company strong for years to come. When he isn't working, Donnie enjoys time at Smith Lake with his wife Lindsey and their three children, Nate, Luke, and Ruby. Whether it's teaching his kids water sports or relaxing with the family dogs, Donnie's greatest joy is found with family.",
    keyStrengths: [
      'Multi-industry entrepreneurial experience',
      'Strategic business planning',
      'Long-term vision development',
      'Business growth strategies',
      'Financial decision guidance'
    ],
    responsibilities: [
      'Provide strategic business guidance',
      'Advise on major company decisions',
      'Contribute to long-term planning',
      'Share multi-industry insights',
      'Support leadership team development',
      'Guide company growth initiatives'
    ],
  },
  {
    slug: 'danny-ray-muse',
    name: 'Danny Ray "Pops" Muse',
    company: 'River City Roofing Solutions',
    category: 'In Loving Memory',
    position: 'The Heart of the Family',
    phone: '',
    email: '',
    altEmail: '',
    displayOrder: 19,
    profileImage: '/uploads/danny-ray-muse.png',
    tagline: 'Forever in our hearts, his legacy of love and family guides us every day.',
    bio: "Danny Ray Muse, known to all as 'Pops,' was the beloved father of Greg, Chris, and Tia, but he treated everyone he met like family. He was a huge part of River City Roofing Solutions, teaching us so much about work, life, and kindness. His sudden passing in 2023 left a void that can never be filled. Pops was loved by everyone, and he loved everyone in return. He is greatly missed, and his legacy of love and family continues to guide us every day.",
  },
];

export function getTeamMember(slug: string): TeamMember | undefined {
  return teamMembers.find(member => member.slug === slug);
}

export function getAllTeamSlugs(): string[] {
  return teamMembers.map(member => member.slug);
}

export const teamCategories: readonly TeamMember['category'][] = [
  'Leadership',
  'Regional Partner',
  'Office',
  'Production',
  'Partners & Advisors',
  'In Loving Memory',
] as const;
