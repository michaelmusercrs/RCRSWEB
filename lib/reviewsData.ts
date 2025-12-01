export interface Review {
  id: string;
  name: string;
  date: string;
  rating: number;
  text: string;
  salesRep?: string;
  source?: string;
}

// General 5-star reviews (for team members without specific reviews)
export const generalReviews: Review[] = [
  {
    id: 'gen-1',
    name: 'John Peterson',
    date: '2021-02-27',
    rating: 5,
    text: 'River City Roofing have been excellent to work with! They got in touch with us quickly after initially contacting them, got out and got us an estimate very quickly and completed the job exactly when they said they would! The new roof looks and works great! The team was very professional.',
    source: 'Google'
  },
  {
    id: 'gen-2',
    name: 'Curt Campbell',
    date: '2021-01-22',
    rating: 5,
    text: "I can't say enough good things about this company. They did an excellent job with my roof and treated me well. I would strongly recommend them for anyone needing roof repair or even a new roof like I got.",
    source: 'Google'
  },
  {
    id: 'gen-3',
    name: 'Mark Weber',
    date: '2021-01-20',
    rating: 5,
    text: 'This company did a great job, had a new roof in about 1 day. They cleaned up very well. No nails or trash anywhere. They did everything they said they would do. I would use them again.',
    source: 'Google'
  },
  {
    id: 'gen-4',
    name: 'Regina Randel',
    date: '2019-11-20',
    rating: 5,
    text: "Professional from start to finish! The owner came out within days of our phone call, gave us an estimate, and started on the job right away. We were out of town when the job was done so when we got home we wanted something changed. They came out, changed it, didn't charge us anything extra.",
    source: 'Google'
  },
  {
    id: 'gen-5',
    name: 'Stuart Clark',
    date: '2018-12-07',
    rating: 5,
    text: 'Highly recommended for river city roofing solutions to be your first call for any roofing repair. They came to our house right away after I called to inspect. Outstanding knowledge on roofing. They are fast and Professional. They have done a much better job than the other roofers.',
    source: 'Google'
  },
];

// Reviews by sales rep slug
export const reviewsByRep: Record<string, Review[]> = {
  'chris-muse': [
    {
      id: 'chris-1',
      name: 'Debbie Hill',
      date: '2019-09-06',
      rating: 5,
      text: "Chris at River City Roofing is the man to get the job started and finished! River City was recommended by a trusted home inspector and we are very pleased. Chris took the insurance claim and handled all scheduling, work and follow up. Kudos to all the men who worked in the blazing sun!",
      salesRep: 'Chris Muse',
      source: 'Google'
    },
    {
      id: 'chris-2',
      name: 'Sabrina Kempenich',
      date: '2019-03-11',
      rating: 5,
      text: "Very pleased with the work they did! They took care of everything, including dealing with the insurance company. GREAT communication! Walked us through every step of the process, and answered all questions we had. Chris made the whole process go smoothly.",
      salesRep: 'Chris Muse',
      source: 'Google'
    },
    {
      id: 'chris-3',
      name: 'Karen Beasley',
      date: '2019-10-09',
      rating: 5,
      text: "Chris Muse and his guys do a really great job removing old shingles and putting new back on. Excellent job of cleanup also! Very pleased with their work and professionalism!",
      salesRep: 'Chris Muse',
      source: 'Google'
    },
  ],
  'michael-muse': [
    {
      id: 'michael-1',
      name: 'Nick D8653',
      date: '2018-10-10',
      rating: 5,
      text: "Michael and his crews are awesome - very professional from start to finish - Michael helped navigate the entire insurance process all along the way. The installers were great, covered all our shrubs before they started and cleaned everything up once the roof was replaced.",
      salesRep: 'Michael Muse',
      source: 'Google'
    },
    {
      id: 'michael-2',
      name: 'Rebekah Brunton',
      date: '2019-02-02',
      rating: 5,
      text: "This company has integrity and good communication. Michael Muse had excellent communication skills with helping me with my insurance carrier and preparing to get the job done.",
      salesRep: 'Michael Muse',
      source: 'Google'
    },
    {
      id: 'michael-3',
      name: 'Lisa McNeal',
      date: '2019-04-29',
      rating: 5,
      text: "I wouldn't have anyone else on my roof! Michael Muse is the best. Not only can you trust him... he knows what he's talking about. Great Customer Service! Great Company!",
      salesRep: 'Michael Muse',
      source: 'Google'
    },
  ],
  'hunter': [
    {
      id: 'hunter-1',
      name: 'Terry Moore',
      date: '2022-01-18',
      rating: 5,
      text: "Hunter helped my husband and I with all aspects of replacing our roof. He was exceptional in his knowledge and was always willing to help us understand everything we needed to know about the process. We are very pleased with his assistance!",
      salesRep: 'Hunter Rivers',
      source: 'Google'
    },
    {
      id: 'hunter-2',
      name: 'David Howards',
      date: '2022-01-15',
      rating: 5,
      text: "I want to thank Hunter Rivers and River City Roofing for the awesome job installing our new roof. It looks awesome and they did the job perfectly.",
      salesRep: 'Hunter Rivers',
      source: 'Google'
    },
    {
      id: 'hunter-3',
      name: 'Tara Cooley',
      date: '2021-08-06',
      rating: 5,
      text: "Hunter was so kind and professional when he came to look at our roof. He didn't try to sell us on an entire new roof (when other companies have) and gave us so much helpful advice. Whenever we do need a new roof, we will definitely use River City!",
      salesRep: 'Hunter Rivers',
      source: 'Google'
    },
  ],
  'aaron': [
    {
      id: 'aaron-1',
      name: 'Misti Easter',
      date: '2022-01-28',
      rating: 5,
      text: "Aaron Lussi inspected my roof when I was concerned about a possible leak. He was very thorough and explained in detail what the issue was. He even crawled into the attic to check for moisture. He was friendly, professional & right on time. Highly recommend!",
      salesRep: 'Aaron Lussi',
      source: 'Google'
    },
    {
      id: 'aaron-2',
      name: 'David Holmes',
      date: '2022-01-17',
      rating: 5,
      text: "Aaron Lussi did an excellent job advising us on roofing options and assisting with submitting an insurance claim for our roof replacement. Crew arrived on time and worked over 10 hours straight the first day. Cleanup was excellent!",
      salesRep: 'Aaron Lussi',
      source: 'Google'
    },
    {
      id: 'aaron-3',
      name: 'Alison Crosby',
      date: '2024-03-01',
      rating: 5,
      text: "I am so glad we chose River City Roofing to replace our roof. Our contact person was Aaron Lussi. He was always professional, prompt, helpful and honest. Aaron is a delight to work with. Their crew was prompt and incredibly hard working.",
      salesRep: 'Aaron Lussi',
      source: 'Google'
    },
  ],
  'brendon': [
    {
      id: 'brendon-1',
      name: 'Inez Lewis',
      date: '2023-07-26',
      rating: 5,
      text: "Great experience with River City Roofing. Brenden Muse was very professional and provided very detailed and timely information regarding the job. Roofers were very respectful and did a great job with clean up.",
      salesRep: 'Brendon Muse',
      source: 'Google'
    },
    {
      id: 'brendon-2',
      name: 'Tonya Puckett',
      date: '2024-04-23',
      rating: 5,
      text: "River City Roofing Solutions, especially Brendon, did an amazing job! They were timely in the quote and work and what I liked most is they stayed in communication with me at every step. Highly recommend!",
      salesRep: 'Brendon Muse',
      source: 'Google'
    },
    {
      id: 'brendon-3',
      name: 'Cynthia Tucker',
      date: '2024-06-14',
      rating: 5,
      text: "Brendon Muse was great. He answered all my questions and was always a phone call away, even on his honeymoon!",
      salesRep: 'Brendon Muse',
      source: 'Google'
    },
    {
      id: 'brendon-4',
      name: 'Jerry Wilhelm',
      date: '2023-06-24',
      rating: 5,
      text: "Brendon Muse did the initial inspection and identified storm damage. He then became my representative in dealing with my insurance company. He supervised all aspects of roof replacement from beginning to end. He is knowledgeable, competent, courteous.",
      salesRep: 'Brendon Muse',
      source: 'Google'
    },
  ],
  'tia': [],
  'boston': [],
  'destin': [],
  'john': [],
  'bart': [
    {
      id: 'bart-1',
      name: 'Sam Mangham',
      date: '2024-12-13',
      rating: 5,
      text: "Fantastic team did a great job on my roof. Worked with Adam Rudell 'Rudy', who was exceptionally communicative and personally followed up on the job at each step. Helping deal with insurance was also a big plus! Quality was excellent!",
      salesRep: 'Bart (Insurance)',
      source: 'Google'
    },
  ],
  'tae': [],
  'greg': [
    {
      id: 'greg-1',
      name: 'Shelton West',
      date: '2024-07-27',
      rating: 5,
      text: "I worked with Greg, and the ease of which they made this whole experience was beyond reproach. These guys know what they're doing and do it at the highest level.",
      salesRep: 'Greg Muse',
      source: 'Google'
    },
    {
      id: 'greg-2',
      name: 'Robyn Griffin',
      date: '2024-05-02',
      rating: 5,
      text: "From start to finish Greg Muse made this process simple and fast! Very detailed on the process and answered all my questions and concerns. During roof install he was very attentive making sure everything went smooth. Install went fast and clean up was a 10!",
      salesRep: 'Greg Muse',
      source: 'Google'
    },
  ],
  'travis': [],
  'donnie-dotson': [],
  'danny-ray-muse': [],
  'sara-hill': [],
};

// Get reviews for a specific team member, fallback to general reviews
export function getReviewsForMember(slug: string, count: number = 3): Review[] {
  const memberReviews = reviewsByRep[slug] || [];
  if (memberReviews.length >= count) {
    return memberReviews.slice(0, count);
  }
  // If not enough member-specific reviews, fill with general ones
  const needed = count - memberReviews.length;
  return [...memberReviews, ...generalReviews.slice(0, needed)];
}

// Get featured reviews for home page
export function getFeaturedReviews(count: number = 6): Review[] {
  const featured: Review[] = [
    reviewsByRep['aaron']?.[0],
    reviewsByRep['brendon']?.[0],
    reviewsByRep['chris-muse']?.[0],
    reviewsByRep['hunter']?.[0],
    reviewsByRep['michael-muse']?.[0],
    reviewsByRep['greg']?.[0],
  ].filter(Boolean) as Review[];

  // Fill remaining with general reviews if needed
  while (featured.length < count) {
    const general = generalReviews[featured.length - 6] || generalReviews[0];
    if (general) featured.push(general);
    else break;
  }

  return featured.slice(0, count);
}
