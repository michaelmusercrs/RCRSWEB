/**
 * RCRS Sales Training Content — CANONICAL REBUILD
 *
 * Every content sentence traces to the verified source extraction in
 * `CANONICAL-sales-training.md` (the recorded door-to-claim training session
 * + the original portal module/quiz JSON). Where the recording does not teach
 * something (estimate writing, pricing, the close/deposit, JobNimbus role
 * permissions, door-objection rebuttals beyond the playbook), the content
 * renders an honest-gap callout instead of inventing material.
 *
 * The verbatim field words live in `talkTracks` (speaker: 'field'). Transcription
 * artifacts are corrected per the canonical doc's artifact table (hail, cougar
 * paws, JobNimbus, Eagle View, HAAG, Drive, felt, galvalume, chimneys, Decatur
 * Daily, IKO Dynasty). The lightly-censored profanity is kept as the doc shows.
 *
 * This is a plain .ts data module — NO JSX, NO React. Icons are lucide-react
 * name strings; the page maps string -> component. QuizQuestion intentionally
 * has NO correctIndex: answers live server-side in sales-training-answers.ts.
 */

export interface TalkTrack {
  speaker: 'field';
  text: string;
  context?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  explanation: string;
  // NOTE: no correctIndex here by design (anti-cheat). See sales-training-answers.ts
}

export interface ContentSection {
  heading: string;
  content: string[];
  proTips?: string[];
  talkTracks?: TalkTrack[];
  image?: { src: string; alt: string; caption: string };
  media?: { kind: 'audio' | 'video'; src: string; title: string };
  callout?: { tone: 'warning' | 'info'; title: string; text: string };
  drillId?: string;
  sourceNote?: string;
}

export interface SalesModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  estimatedMinutes: number;
  passingScore: number;
  sections: ContentSection[];
  quiz: QuizQuestion[];
}

export interface SalesPart {
  title: string;
  moduleIds: string[];
}

// Footer used on Part 5 modules whose content comes from the portal training
// materials rather than the recorded session.
const JSON_SOURCE_NOTE =
  'Source: RCRS training materials (not from the recorded session).';

export const salesParts: SalesPart[] = [
  {
    title: 'Part 1 — Foundations: The Company & The Job',
    moduleIds: ['sales_s3', 'sales_c13', 'sales_s1', 'sales_p1'],
  },
  {
    title: 'Part 2 — The Door',
    moduleIds: ['sales_c1', 'sales_c2', 'sales_c3', 'sales_s2'],
  },
  {
    title: 'Part 3 — The Roof',
    moduleIds: ['sales_c4', 'sales_c5', 'sales_c6', 'sales_c7'],
  },
  {
    title: 'Part 4 — Measure & Estimate',
    moduleIds: ['sales_c14', 'sales_c15'],
  },
  {
    title: 'Part 5 — The Table',
    moduleIds: ['sales_c8', 'sales_c9', 'sales_r1', 'sales_r2'],
  },
  {
    title: 'Part 6 — The Claim',
    moduleIds: ['sales_c10', 'sales_c11', 'sales_c12'],
  },
  {
    title: 'Part 7 — The Build: Install to Referral',
    moduleIds: ['sales_r3', 'sales_r4', 'sales_r5'],
  },
  {
    title: 'Part 8 — Systems & Your Business',
    moduleIds: ['sales_s4', 'sales_b1'],
  },
];

export const salesModules: SalesModule[] = [
  // ===================================================================
  // PART 1 — THE DOOR
  // ===================================================================

  // -------------------- sales_c1 --------------------
  {
    id: 'sales_c1',
    title: 'The Door Knock',
    description:
      "The verbatim door-knock intro, the Big Three, the three forbidden openers, the three qualifying questions in order, and the adjective bridge that keeps you moving.",
    icon: 'DoorOpen',
    estimatedMinutes: 18,
    passingScore: 80,
    sections: [
      {
        heading: 'The "Hey There" Opener & the Big Three',
        media: {
          kind: 'audio',
          src: '/training-media/advanced-sales-deep-dive.wav',
          title: 'From Hail to Home — the full door-to-claim process (deep-dive audio)',
        },
        content: [
          'Your opener is simply "Hey there." Not "How are you doing," not "Hope you\'re having a good day," not "Hope I\'m not bothering you." This intro is delivered verbatim, in a slightly higher pitch.',
          'Tell them who you are first, then who you are with, then why you are there. Once you have done that, your intro is complete — the homeowner now knows the three things everyone wants to know the moment they open the door.',
          'The assembled, verbatim intro line is: "Hey there, I am [name] with River City Roofing Solutions, and I am in your area inspecting wind and hail damage due to the storms that came through on [date]."',
          'You can tailor the storm reference — "from the April 10th storm" or "due to the storms that came through on [date]" — as long as it still hits the same main point: the storms that came through on a specific day.',
        ],
        proTips: [
          'Use a higher pitch on the intro — the script calls this out specifically.',
          'Say "hail damage" only if it was a hail date, or "wind damage" only if it was a wind date — otherwise say "wind and hail damage."',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "So, door knock is hey there, right? Not how are you doing, you know? Not hey, hope you're having a good day. Hope I'm not bothering you. Nope. All of that's opening up a can of worms. Hey there, I am [your name]... So, who are you? Tell them who you are first. Hey there. This is who I am. I am blank blank blank with — Who are you with? RCRS, River City Roofing Solutions. And I'm giving you guys this verbatim. The higher pitch. So, it's Hey there, I am blank blank with River City Roofing Solutions and I am in your area inspecting wind and hail damage due to the storms that came through on blank blank date.",
            context: 'The verbatim intro (recording, para 45, 60–61).',
          },
          {
            speaker: 'field',
            text: "And at that point, you're done with your intro. You've introduced yourself. They know who you are. They know where you're from. They know why you're there. That's the big three things everybody wants to know as soon as they open the door.",
            context: 'The "Big Three" (recording, para 61).',
          },
        ],
      },
      {
        heading: 'What NOT to Say',
        content: [
          "Casual or apologetic openers open up a can of worms. Avoid them entirely and stay crisp and professional.",
          '❌ "How are you doing?" — wastes time and sounds like a salesman.',
          '❌ "Hope I\'m not bothering you" — plants the idea that you ARE bothering them.',
          '❌ "Umm..." or any filler — kills confidence and sounds unprepared.',
        ],
        callout: {
          tone: 'info',
          title: 'Why it matters',
          text: 'You only get so much time at the door to make a connection. Filler and apologies spend that time against you.',
        },
      },
      {
        heading: 'The Three Qualifying Questions — In Order',
        content: [
          'Question 1: "How long have you owned the home?" This is first because you must confirm they are the owner — you need the owner\'s permission to get on the roof. It also screens for a caretaker (son/daughter/niece) or a power of attorney, which still qualifies.',
          'Question 2: "When was the last time your roof was inspected?" Homeowners often volunteer the whole story here.',
          'Question 3: "Was it a roofer or an insurance company? And what did they say?" This question deliberately packs two answers into one. It is a little open-ended, but this is your final qualifying question.',
          'Optional Question 4: "Do you know how old the roof is?" A great early-intel question — a beat-up roof that is "only 7 years old" signals heavy hail damage or no ventilation.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "So, first qualifying question is how long have you owned the home? Why is this the first question? Because we want to make sure that they're not a renter... we're qualifying the home and we want to make sure they own the home cuz we need the owner there to give us permission to get on the roof.",
            context: 'Question 1 (recording, para 63).',
          },
          {
            speaker: 'field',
            text: "The third qualifying question is was it a roofer or an insurance company? Was it a roofer or an insurance company? And what did they say?... Okay, put that all in that one question.",
            context: 'Question 3 (recording, para 74–79).',
          },
          {
            speaker: 'field',
            text: "Another great question is, okay, do you know how old the roof is? You can throw that one in there, too. I kind of like that one... maybe your roof looks really, really beat up as you walk up to it and they say it's only 7 years old. You're like, that means it's got a lot of hail damage or maybe there's no ventilation. You can start getting some early information right there, too.",
            context: 'Optional Question 4 (recording, para 86–88).',
          },
        ],
      },
      {
        heading: 'The Adjective Bridge',
        content: [
          'Between each qualifying question, respond to the homeowner with a short adjective and go immediately to the next question: "Great," "Awesome," "Wonderful," "Glad to hear it."',
          'What you do NOT want to do is stall — no "ums," no looking around, no long gaps, and no repeating back what the homeowner just said. Repeating their answer ("Seven years? Oh, that\'s great.") is a tell that you are stalling and wastes unnecessary time.',
          'Your final affirmation before you present the folder is the same kind of bridge: "Great. Awesome, or that\'s amazing. Here\'s my information."',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "You say, 'How long have you owned the home?' They say, 'Seven years.' You use some sort of adjective and go immediately to the next question. Great, awesome, wonderful, glad to hear it... What a lot of people do is repeating what the person said cuz that's a way that people know you're stalling for something. They'll say seven years and you'll go 'seven years. Oh, that's great.' That's unnecessary information... So, cut that out and get to the chase, right? You only got so much time at the door to make a connection with this homeowner.",
            context: 'The adjective / response technique (recording, para 70–73).',
          },
        ],
      },
      {
        heading: 'Practice: Script Builder Drill',
        content: [
          'Time to build the intro, order the qualifying questions, and pick the right adjective bridges yourself. Complete the Script Builder drill below.',
        ],
        drillId: 'sales_d1',
      },
    ],
    quiz: [
      {
        id: 'c1_1',
        question: 'What is the FIRST qualifying question you should ask?',
        options: [
          'Who is your insurance company?',
          'How long have you owned the home?',
          'When was your roof last replaced?',
          'Have you noticed any leaks?',
        ],
        explanation:
          'You ask "How long have you owned the home?" first because you need to confirm the owner is present — you need the owner\'s permission to get on the roof.',
      },
      {
        id: 'c1_2',
        question:
          'What are the "Big Three" things every homeowner wants to know the moment they open the door?',
        options: [
          'Your price, your timeline, and your warranty',
          'Who you are, where you are from, and why you are there',
          'Whether the inspection is free, how long it takes, and if it hurts their insurance',
          'Your name, your phone number, and your company website',
        ],
        explanation:
          'A complete intro tells them who you are, where you are from, and why you are there — the big three things everybody wants to know as soon as they open the door.',
      },
      {
        id: 'c1_3',
        question: 'Which of these is a FORBIDDEN opener at the door?',
        options: [
          '"Hey there, I am [name] with River City Roofing Solutions."',
          '"Hope I\'m not bothering you."',
          '"I am in your area inspecting wind and hail damage."',
          '"...due to the storms that came through on [date]."',
        ],
        explanation:
          '"Hope I\'m not bothering you" plants the idea that you ARE bothering them and opens up a can of worms. The script bans it along with "How are you doing?" and filler words.',
      },
      {
        id: 'c1_4',
        question: 'What is the mandated opener?',
        options: [
          '"How are you doing today?"',
          '"Hey there."',
          '"Good afternoon, sir."',
          '"Sorry to interrupt."',
        ],
        explanation:
          'The opener is simply "Hey there," delivered in a slightly higher pitch — never a casual or apologetic greeting.',
      },
      {
        id: 'c1_5',
        question:
          'Between qualifying questions, what should you do after the homeowner answers?',
        options: [
          'Repeat their answer back to confirm you heard it correctly',
          'Use a short adjective bridge ("Great," "Awesome") and move immediately to the next question',
          'Pause to write the answer down before continuing',
          'Ask a follow-up clarifying question about their answer',
        ],
        explanation:
          'Use a quick adjective — "Great, awesome, wonderful, glad to hear it" — and go straight to the next question. Repeating their answer signals stalling and wastes your limited time at the door.',
      },
    ],
  },

  // -------------------- sales_c2 --------------------
  {
    id: 'sales_c2',
    title: 'Qualifying the Homeowner',
    description:
      'The qualifying decision tree: the auto-qualify rule, the renter/power-of-attorney screen, and how a prior roofer or insurance visit changes the path.',
    icon: 'Users',
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'Q1 — "How long have you owned the home?"',
        content: [
          'This question qualifies the home, not just the person. If you are talking to a renter (or anyone with no authority over the property), they are DISQUALIFIED — you need the owner present to give permission to get on the roof.',
          'If you are talking to the owner — OR a son, daughter, or niece caretaker who is the power of attorney — they QUALIFY, and you proceed to Q2.',
          'If it is a renter, a clean exit is: "Great, could you pass my card to the owner?"',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "We're qualifying the home and we want to make sure they own the home cuz we need the owner there to give us permission to get on the roof.",
            context: 'Why Q1 is first (recording, para 63). A power of attorney still qualifies (para 67).',
          },
        ],
      },
      {
        heading: 'Q2 — "When was the last time your roof was inspected?" + The Auto-Qualify Rule',
        content: [
          'Homeowners often volunteer their whole story here: "We haven\'t really had it looked at," "A roofer came a week ago," or "Not since the home inspector when we bought the house."',
          'The auto-qualify rule: what qualifies a homeowner is whether they have had their roof inspected SINCE the storm date. If they have NOT been inspected since the storm date, they automatically qualify.',
          'If it has been a long time (e.g., "not since I bought the house"), they are qualified and you do not even have to ask Q3. If it was somewhat recently, you probably still want to ask Q3 — because maybe they were denied.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "What qualifies the homeowner is, have they had their roof inspected since this storm date? If they haven't had their roof inspected since the storm date, they automatically qualify... Or if it's been a long time, you don't really have to ask the third question... 'Oh, I haven't had it looked at since I bought the house.' — Okay, Greg, you're qualified. But if it's been somewhat recently, you probably still do want to ask because maybe they were denied.",
            context: 'The auto-qualify rule (recording, para 83–86).',
          },
        ],
      },
      {
        heading: 'Q3 — "Was it a roofer or an insurance company? And what did they say?"',
        content: [
          'Only needed if the roof was recently inspected. This question packs two answers into one.',
          'Roofer inspected it → find out what they said. A roofer\'s look does NOT use up the insurance claim. A prior "it\'s fine" is handled with a fresh-look reframe (things change with each storm).',
          'Insurance inspected it before the storm date (e.g., a routine check when they first got their policy) → still qualifies.',
          'Insurance inspected AND denied since the storm date → this is the retail-prep path. You can offer a reinspection (the homeowner\'s right to a second opinion) and/or go retail.',
          'Never inspected, not since purchase, or not since the storm → QUALIFIED; you can skip Q3.',
        ],
        callout: {
          tone: 'info',
          title: 'Decision summary (NotebookLM labels)',
          text: 'Not inspected since storm date = Qualified. Inspected a long time ago (e.g., since bought the house) = Qualified. If recently inspected, still ask whether it was a roofer or insurance — a denial is possible.',
        },
      },
      {
        heading: 'Practice: Qualifying Tree Drill',
        content: [
          'Work through real door scenarios and choose the right action: Qualified, Disqualified (leave a card), Ask Q3, or Retail/reinspection. Complete the Qualifying Tree drill below.',
        ],
        drillId: 'sales_d2',
      },
    ],
    quiz: [
      {
        id: 'c2_1',
        question:
          'The person at the door is a renter with no authority over the property. What do you do?',
        options: [
          'Get on the roof anyway — you only need someone at the home',
          'They are disqualified; ask them to pass your card to the owner',
          'File the claim under the renter\'s name',
          'Skip qualifying and go straight to the inspection',
        ],
        explanation:
          'A renter cannot give permission to get on the roof. They are disqualified — leave a clean exit: "Great, could you pass my card to the owner?"',
      },
      {
        id: 'c2_2',
        question: 'What automatically qualifies a homeowner?',
        options: [
          'They have owned the home for more than five years',
          'They have not had their roof inspected since the storm date',
          'They already have an open insurance claim',
          'Their neighbors have already signed up',
        ],
        explanation:
          'The auto-qualify rule: if they have not had the roof inspected since the storm date, they automatically qualify.',
      },
      {
        id: 'c2_3',
        question:
          'A daughter caretaker who is the power of attorney answers the door. Does she qualify?',
        options: [
          'No — only the deeded owner can qualify',
          'Yes — a power of attorney qualifies, so you proceed to Q2',
          'Only if the owner is also home',
          'Only for a retail (cash) job, never an insurance claim',
        ],
        explanation:
          'A son/daughter/niece caretaker who is the power of attorney still qualifies. You proceed to the next qualifying question.',
      },
      {
        id: 'c2_4',
        question:
          'When do you actually need to ask Q3 ("Was it a roofer or an insurance company?")?',
        options: [
          'Always, on every single door',
          'Only if the roof was recently inspected',
          'Only for renters',
          'Only after you are already on the roof',
        ],
        explanation:
          'If it has been a long time since any inspection, they auto-qualify and you can skip Q3. You only need Q3 when the roof was recently inspected — because a denial is possible.',
      },
    ],
  },

  // -------------------- sales_c3 --------------------
  {
    id: 'sales_c3',
    title: 'The Folder & the "Oh By The Way"',
    description:
      'The folder presentation sequence, why the homeowner must contact YOU not the office, the transition to the roof, the free-inspection line, and the casual walk-away insurance grab.',
    icon: 'FolderOpen',
    estimatedMinutes: 16,
    passingScore: 80,
    sections: [
      {
        heading: 'The Folder Presentation — Get Their Hands Involved',
        content: [
          'Open the folder and get the homeowner\'s hands physically involved. Hand them the folder, have them open it, and point with your pen or pencil as you flip through the pages.',
          'Walk them through, in order: the About Us section ("Chris and Michael own this company," ~15 years of experience each, or just "over 30 or 40 years of experience combined with the owners"); then point out the insurances and licenses; then BBB A+ rated; then Decatur Daily Best of the Best (emphasize this especially in Decatur, but still get it out in Huntsville, Madison, and Athens).',
          'Finally, point out your card and your information — and make sure they know to contact YOU, not the office, for anything they need.',
        ],
        // AWAITING PHOTO: folder-about-us.jpg — the physical RCRS folder open to the About Us / credentials page
        talkTracks: [
          {
            speaker: 'field',
            text: "You want to open up the folder... and you want to get their hands involved. Hand them a folder and get their hands physically involved. Have them open up the folder, show them, point with your pen or pencil or flip through the pages... here's the about us section. Chris and Michael own this company... over 30 or 40 years of experience with the owners and then point out our insurances and licenses... BBB. A plus rated. And for Decatur, Daily is best of the best... Decatur Daily's best of the best roofer... And then you want to point out your card, your information... make sure that they contact you and not the office for anything that they need.",
            context: 'The folder presentation (recording, para 91–116).',
          },
        ],
      },
      {
        heading: 'Why "You, Not the Office"',
        content: [
          'You are the guy who is going to handle them, take care of them, and help them. Establishing that connection here means they are not dealing with some faceless company they have never met.',
          'You have to be the guy. This is where that personal connection starts to be established.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "You're the guy that's going to handle them. You're the guy that's going to take care of them. You're here to help them. This right here is where that's kind of starting to be established... because now they're not dealing with some company who they've never met before... You have to be the guy. So you're establishing that connection.",
            context: 'Establishing yourself as the point of contact (recording, para 116).',
          },
        ],
      },
      {
        heading: 'Transition to the Roof',
        content: [
          'Hand off the folder and move them toward the kitchen table while you go up: "Why don\'t you look through that and clear off a spot inside on the kitchen table?"',
          'Then set expectations: "I\'ve got my ladder in the truck. I\'m going to get up on your roof and document everything that I see today... take about 10 minutes... get back down and show you the photos." You can reiterate: "We\'re going to get back down, sit at that kitchen table, and go over the photos so you know the condition of your roof" — or "the condition of your property" if the damage is extensive.',
          'Keep the phrasing flowing and professional ("get on your roof / get up there / hop up there" are interchangeable) — it is the big target words that matter.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Great. Why don't you look through that and clear off a spot inside on the kitchen table?... I've got my ladder in the truck. I'm going to get up on your roof and document everything that I see today. I have my ladder in the truck. I'm going to take about 10 minutes... get back down and show you the photos. Or you can even reiterate. We're going to get back down, sit at that kitchen table, and go over the photos so you know the condition of your roof.",
            context: 'Transition to the roof (recording, para 116–122).',
          },
        ],
      },
      {
        heading: 'The Free-Inspection Line & "I\'ll Be Right Back"',
        content: [
          'Mention the free inspection only if needed. The script often stays away from it — but if you start to turn and the homeowner asks "How much am I going to owe you?", you respond: "Whoa. Sorry. My inspections, consultations, and estimates are always free," then reiterate the plan.',
          'Your exit line is simply: "I\'ll be right back." Then you turn and walk away.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "You can also mention that the inspections are free if you feel like that's necessary, but a lot of times I feel like I stay away from it... But if I start to turn and they ask, 'Hey, well, how much am I going to owe you?' [I say] Whoa. Sorry. My inspections, consultations, and estimates are always free... I'm just going to hop up here real quick, document everything, get back down, and show you the photos.",
            context: 'The free-inspection line (recording, para 122).',
          },
        ],
      },
      {
        heading: 'The "Oh, By The Way" Insurance Question',
        content: [
          'If the homeowner has not already volunteered their insurance company, you grab it as you walk away — NOT face-to-face. Take a step or two, turn back, and casually ask: "Oh, by the way, who is your insurance company?"',
          'Sometimes you do not even turn all the way around — just a quick "Oh, hey, by the way, who is your insurance company?" and keep walking.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "As you turn and walk away... this is the time when you ask and this is how you ask. I turn, I walk away a little, take a step or two and then I turn back and I go 'oh by the way, who is your insurance company?'... but sometimes I don't even turn way around to him. I just quick — 'Oh, hey, by the way, who is your insurance company?'",
            context: 'The walk-away insurance grab (recording, para 124).',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'c3_1',
        question: 'In the folder\'s About Us section, who owns the company?',
        options: [
          'Two outside investors',
          'Chris and Michael',
          'A national franchise group',
          'The Decatur Daily',
        ],
        explanation:
          'The script teaches: "Chris and Michael own this company," with over 30 to 40 years of combined experience between the owners.',
      },
      {
        id: 'c3_2',
        question: 'Which credentials does the script tell you to point out in the folder?',
        options: [
          'A five-star Google rating and a Yelp badge',
          'BBB A+ rating and Decatur Daily Best of the Best',
          'A lowest-price guarantee and a lifetime labor warranty',
          'State licensing number and OSHA certification only',
        ],
        explanation:
          'Point out BBB A+ rated and Decatur Daily Best of the Best — especially the Decatur Daily award in Decatur, though you still use it in Huntsville, Madison, and Athens.',
      },
      {
        id: 'c3_3',
        question: 'When do you ask "Who is your insurance company?"',
        options: [
          'First thing at the door, before qualifying',
          'During the folder presentation, face-to-face',
          'As you turn to walk to your truck — the casual "Oh By The Way"',
          'Only after you come down from the roof',
        ],
        explanation:
          'You grab the insurance company casually as you walk away — "Oh, by the way, who is your insurance company?" — not face-to-face, unless they already volunteered it.',
      },
      {
        id: 'c3_4',
        question:
          'Why do you tell the homeowner to contact YOU and not the office?',
        options: [
          'The office phone is often busy',
          'To establish yourself as their personal point of contact — "you have to be the guy"',
          'Because the office charges a fee for phone support',
          'So the office does not find out about the job',
        ],
        explanation:
          'You are the one who handles them and takes care of them. Directing them to you (not a faceless company) is where that personal connection is established — "you have to be the guy."',
      },
    ],
  },

  // ===================================================================
  // PART 2 — THE ROOF
  // ===================================================================

  // -------------------- sales_c4 --------------------
  {
    id: 'sales_c4',
    title: 'Ladder & Tools',
    description:
      'Setting the ladder professionally (eave not rake, 20–40°, carried sideways), when to call for a drone or help, and the exact tools to bring up so you never climb down twice.',
    icon: 'Wrench',
    estimatedMinutes: 14,
    passingScore: 80,
    sections: [
      {
        heading: 'Assess First, Then Place the Ladder',
        image: {
          src: '/training/sales/handbook/hb-roof-slope-definitions.png',
          alt: 'Roof slope diagram: slope measured as rise over run, showing conventional, low-slope, and flat ranges.',
          caption: 'How roof slope is measured — conventional vs. low-slope vs. flat (RCRS handbook).',
        },
        content: [
          'Step back, take a quick look, and get a lay of the land before you do anything. Think about where you are going to put the ladder up.',
          'Place the ladder on an eave — NOT on a rake. A rake is very uneven. Put it on an eave close to a hip, a valley, or the eave of a low-pitched front or back porch where it is easily accessible.',
          'If you cannot reach the roof safely, then you need a drone or you ask for help. Do not force an unsafe setup.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Find an eve where you can put up your ladder. This is a very important note because you really don't want to put your ladder up on a rake. It's very uneven... put it on the eve that's close to a hip or a valley or a eve of a low pitched front or back porch where it's easily accessible... [if you can't reach safely] then you need a drone or ask for help.",
            context: 'Ladder placement (recording, para 139–158).',
          },
        ],
      },
      {
        heading: 'Look Professional — The Neighbors Are Watching',
        content: [
          'Your setup needs to look clean and simple. A neighbor may be driving by or watching, and a lot of homes have cameras. They may not say anything in the moment, but they will go back and watch the footage — and that is why they never call you back.',
          'Carry the ladder sideways against your hip. It is the cleanest way to carry it: cradle it to the side and let your body do some of the weight lifting for you.',
        ],
        callout: {
          tone: 'info',
          title: 'A repeated theme',
          text: 'You don\'t want to look like an idiot. Ladder handling, preparedness, and professionalism all get judged — often on camera.',
        },
      },
      {
        heading: 'The Ladder Angle',
        content: [
          'Set a smooth angle — roughly 20 to 40 degrees (note: 45 is probably too much). Too steep and it can kick over or make it hard to descend; too flat on concrete or wet grass and it slips out.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Like this angle, like almost like a 40, 45... Maybe 45 is too much. 20 to 40, 30... some smooth angle.",
            context: 'Ladder angle (recording, para 158).',
          },
        ],
      },
      {
        heading: 'Tools You Need on the Roof',
        content: [
          'Bring everything up the first time so you never have to climb down twice. Being prepared is what makes you look like a professional.',
          'Bring: cougar paws and the pitch hopper; your phone with a pitch gauge app (or a manual pitch gauge); chalk for the initial inspection; a pen and paper; and a tape measure.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Have your cougar paws on them and the pitch hopper... You want to have your phone and either a pitch gauge app on your phone or a manual pitch gauge. You want to have chalk for the initial inspection... You need to bring a pen and paper and a tape measure.",
            context: 'On-roof tools (recording, para 158).',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'c4_1',
        question: 'Where should you NOT place your ladder?',
        options: [
          'On an eave near a hip or valley',
          'On a rake — it is very uneven',
          'On the eave of a low-pitched porch',
          'Anywhere easily accessible',
        ],
        explanation:
          'Never set the ladder on a rake — it is very uneven. Place it on an eave near a hip, valley, or a low-pitched porch where it is easily accessible.',
      },
      {
        id: 'c4_2',
        question: 'What ladder angle does the script teach?',
        options: [
          'A steep 60–70° for a fast climb',
          'Roughly 20–40° — a smooth angle (45° is probably too much)',
          'As flat as possible for stability',
          'Exactly 45° every time',
        ],
        explanation:
          'Aim for a smooth 20–40°. Too steep can kick over or make descent hard; too flat on concrete or wet grass slips out.',
      },
      {
        id: 'c4_3',
        question: 'If you cannot reach the roof safely, what do you do?',
        options: [
          'Lean the ladder on a rake and climb carefully',
          'Use a drone or ask for help',
          'Skip the inspection and estimate from the ground',
          'Stand on the top rung to reach',
        ],
        explanation:
          'If you cannot reach the roof safely, you need a drone or you ask for help — never force an unsafe setup.',
      },
      {
        id: 'c4_4',
        question: 'Which set of tools should you carry up for the inspection?',
        options: [
          'Just your phone and business cards',
          'Cougar paws, pitch hopper, phone/pitch gauge, chalk, pen and paper, and a tape measure',
          'A drone and a ladder assist only',
          'A hammer, nails, and replacement shingles',
        ],
        explanation:
          'Bring cougar paws, the pitch hopper, your phone (with a pitch gauge app) or a manual pitch gauge, chalk, pen and paper, and a tape measure — so you never have to climb down twice.',
      },
    ],
  },

  // -------------------- sales_c5 --------------------
  {
    id: 'sales_c5',
    title: 'The Eave Inspection Before You Step On',
    description:
      'The very first thing you do at the top of the ladder: peel up at the eave to identify shingle type, starter, drip edge, felt, and decking — and spot the valley-metal / ice-and-water supplement play.',
    icon: 'Search',
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'Peel Up at the Eave',
        image: {
          src: '/training/sales/handbook/hb-roof-anatomy-labeled.png',
          alt: 'Labeled cutaway of a house roof: valley, ridge, hip, eave, fascia, soffit, flashing, rafter, gutter and more.',
          caption: 'Roof & house anatomy — know the name of every part you inspect (RCRS handbook).',
        },
        content: [
          'The first thing you do at the top of the ladder — before stepping onto the roof — is peel up at the eave and look at what type of shingle it is.',
          'Identify whether it is three-tab or dimensional. Look for a starter strip (or did they use three-tab as starter?). Look for drip edge. Look at what kind of felt paper it has.',
          'Photograph the shingle BEFORE you lift it, in case it cracks or tears — then lift it.',
        ],
        // AWAITING PHOTO: shingle-three-tab-vs-dimensional.jpg — side-by-side eave lift showing 3-tab vs dimensional
        talkTracks: [
          {
            speaker: 'field',
            text: "Peel up at the eve and look for what type of shingle it is... identify if it's three tab or dimensional. You're looking for starter strip — or did they use three tab as starter? You're going to look for drip edge. You're going to look for what kind of felt paper it has.",
            context: 'The eave inspection (recording, para 162–190).',
          },
        ],
      },
      {
        heading: 'Drip Edge & Decking',
        image: {
          src: '/training/sales/handbook/hb-underlayment-tougher.png',
          alt: 'Side-by-side comparison of intact synthetic underlayment vs. wrinkled, torn felt paper.',
          caption: 'Synthetic vs. felt underlayment — synthetics are far stronger and tear-resistant (RCRS handbook).',
        },
        content: [
          'Drip edge: either a physical piece OR a bent-out fascia lip counts. With no drip edge, you can see more of the decking easily.',
          'Decking: identify plywood, Luon board, or OSB. Is it rotted? Watch for gaps — for example, a 2-inch gap between the deck end and the fascia.',
        ],
      },
      {
        heading: 'The Valley Supplement Play (Big One)',
        content: [
          'In the valleys, look for valley metal or ice-and-water shield. This is a big thing you can get approved before you even do the job — typically a back-end supplement, and sometimes you can get the adjuster to pay for it that day.',
          'Open valley metal (exposed, with the "W"): the adjuster needs to be paying for that.',
          'Hidden valley metal (thin, rusted galvalume underneath): insurance pays for that.',
          'Ice-and-water shield: either way, they are going to pay for it — and RCRS puts ice-and-water shield back automatically, so it is already in your job cost. Getting them to pay for these items saves money.',
        ],
        // AWAITING PHOTO: valley-open-metal-w.jpg — exposed open valley metal showing the "W" profile
        talkTracks: [
          {
            speaker: 'field',
            text: "Look for if it has valley metal or ice and water shield in the valleys... that's a big thing that we can get approved before we even do the job... typically a backend supplement... maybe you can get the adjuster to pay for it that day.",
            context: 'The valley supplement play (recording, para 162–190).',
          },
        ],
      },
      {
        heading: 'Granule Swipe — Walkability & Safety',
        content: [
          'Check the granular loss and the condition of the roof for safe walking. Swipe your hand across the surface once — if the granules are loose, put on your cougar paws before you walk out onto the roof.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "You're looking at the granular loss. What kind of condition is it in as far as safety to walk onto... you swipe your hand one time — like them granules are loose, I'm going to go put my cougar paws on.",
            context: 'Granule swipe safety check (recording, para 162–190).',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'c5_1',
        question:
          'What is the very first thing you do at the top of the ladder, before stepping onto the roof?',
        options: [
          'Walk straight to the ridge to check for hits',
          'Peel up at the eave and identify the shingle type',
          'Set up your test squares',
          'Take the four ground corner photos',
        ],
        explanation:
          'Before stepping onto the roof, peel up at the eave and identify the shingle type (three-tab or dimensional), plus starter, drip edge, felt, and decking.',
      },
      {
        id: 'c5_2',
        question: 'Why do you photograph the eave shingle BEFORE lifting it?',
        options: [
          'To measure the exposure width',
          'In case it cracks or tears when you lift it',
          'To prove the color to insurance',
          'Because you cannot photograph it once lifted',
        ],
        explanation:
          'Photograph the shingle before lifting it in case it cracks or tears during the lift — then lift it to inspect underneath.',
      },
      {
        id: 'c5_3',
        question:
          'What commonly-approved supplement item do you look for in the valleys?',
        options: [
          'Ridge vent',
          'Valley metal or ice-and-water shield',
          'Gutter guards',
          'Solar attic fans',
        ],
        explanation:
          'Valley metal and ice-and-water shield in the valleys are a big supplement you can often get approved — and RCRS installs ice-and-water shield back automatically, so getting insurance to pay saves money.',
      },
      {
        id: 'c5_4',
        question: 'What is the purpose of swiping your hand across the granules?',
        options: [
          'To clean the shingle for a better photo',
          'To check walkability/safety — loose granules mean put on your cougar paws',
          'To test the shingle color',
          'To find the manufacturer stamp',
        ],
        explanation:
          'The granule swipe checks walkability and safety. If the granules are loose, put on your cougar paws before walking out onto the roof.',
      },
    ],
  },

  // -------------------- sales_c6 --------------------
  {
    id: 'sales_c6',
    title: 'On-Roof Hail Identification',
    description:
      'Collateral first, the four characteristics of a legitimate hail hit, telling hail apart from blisters and nail pops, the HAAG standard, and photographing damage AND non-damage.',
    icon: 'CloudHail',
    estimatedMinutes: 20,
    passingScore: 80,
    sections: [
      {
        heading: 'Collateral First',
        image: {
          src: '/training/sales/handbook/hb-chimney-cricket-flashing.png',
          alt: 'Diagram of a chimney cricket/saddle plus correct step and counter (reglet) flashing on shingles.',
          caption: 'Chimney cricket + step/counter-flashing done right — a top leak point to check (RCRS handbook).',
        },
        content: [
          'Start with collateral, not the field of the roof. First go look at gas vents, dryer vents, and mushroom vents; then chimneys and chimney caps; then any exposed valley metal or a metal porch — any of the metals on the roof.',
          'Look for a ding in the metal. Take chalk and rub it evenly on the surface to make dents and cracks show up.',
        ],
        // AWAITING PHOTO: collateral-chalk-on-vent.jpg — chalk rubbed on a soft-metal vent revealing hail dings
        talkTracks: [
          {
            speaker: 'field',
            text: "First go look at gas vents, drier vents, mushroom vents... chimneys, chimney caps. If they have the nice exposed valley metal or if they have a metal porch, any of the metals on the roof, you want to go look at it, see if you see a ding in it... take some chalk and rub it evenly on the surface... see if you see any cracks.",
            context: 'Collateral inspection first (recording, para 196–224).',
          },
        ],
      },
      {
        heading: 'The Four Characteristics of a Legitimate Hail Hit',
        content: [
          'A true hail hit on a shingle has four characteristics:',
          '1. Soft to the touch — like an apple.',
          '2. Somewhat irregular in shape — not a perfect circle.',
          '3. Usually just a granule or two left in the center.',
          '4. No fiberglass bulking through it.',
          'Optional microscope confirmation: when the matting is indented and the fiberglass is broken, that is true textbook hail damage.',
        ],
        // AWAITING PHOTO: hail-hit-shingle.jpg — close-up of a legitimate hail hit showing the four characteristics
        talkTracks: [
          {
            speaker: 'field',
            text: "Something soft to the touch... like an apple. Somewhat irregular in shape. Not a perfect circle. It's always got maybe just a granule or two left in the center... No fiberglass all bulking through it.",
            context: 'The four hail-hit characteristics (recording, para 196–224).',
          },
        ],
      },
      {
        heading: 'Distinguish Blisters and Nail Pops',
        content: [
          'A wood blister is NOT hail. Under a microscope the fiberglass is fine — you see straight strands of fiberglass, a perfect circle or linear pattern, and no granules anywhere inside. All you see is fiberglass. It is not soft and not embedded.',
          'Also note nail pops (where a nail is driving back up out of / lifting the shingle) and flashing problems (for example, a chimney with no cricket and bad flashing above a reported leak).',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Wood blisters — is the fiberglass going to be fine under a microscope... you'll have straight strands of fiberglass... a perfect circle or linear pattern and no granules anywhere inside... all you see is fiberglass... It's not soft. It's not embedded.",
            context: 'Blister vs. hail (recording, para 196–224).',
          },
        ],
      },
      {
        heading: 'Hips, Ridges & the HAAG Standard',
        content: [
          'Hips and ridges are a big one: hail hits on a hip or a ridge are a much better sign of true damage rather than just blistering.',
          'HAAG is the certification company whose standard defines textbook hail damage (matting indented + fiberglass broken). Most adjusters carry a HAAG certification.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Hips and ridges are a big one because if you have hail hits on a hip and a ridge, it's a much better sign that it's true damage and not just blistering.",
            context: 'Hips and ridges (recording, para 196–224). HAAG defined at para 200.',
          },
        ],
      },
      {
        heading: 'Storm Narrative & Photographing Both',
        content: [
          'Use the hail map to know which direction the storm came from; the damage should roughly align. Know it — but try to stay away from mentioning it once the adjuster arrives if the damage is on the "wrong" side.',
          'Photograph both damage AND non-damage. Also note every penetration (bullet boots, satellites, gas vents, chimneys, solar panels, skylights) — anywhere you will have to add flashing — plus extras like heavy sidewall or rusted flashing that need attention.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "You want to get some pictures of non-damage and damage.",
            context: 'Document both (recording, para 196–224).',
          },
        ],
        drillId: 'sales_d3',
      },
    ],
    quiz: [
      {
        id: 'c6_1',
        question: 'What should you inspect FIRST when you get on the roof?',
        options: [
          'The field shingles in the middle of the roof',
          'Collateral damage — vents, chimneys, and metals',
          'The ridge cap',
          'The gutters from above',
        ],
        explanation:
          'Start with collateral: gas/dryer/mushroom vents, chimneys and caps, and any exposed metals. Rub chalk on them to reveal dings and cracks.',
      },
      {
        id: 'c6_2',
        question:
          'What are the four characteristics of a legitimate hail hit on a shingle?',
        options: [
          'Hard, perfectly round, deep, and full of exposed fiberglass',
          'Soft to the touch, irregular shape, a granule or two in the center, and no exposed fiberglass',
          'Linear, dry, granule-free, and hard',
          'Raised, circular, soft, and full of fiberglass strands',
        ],
        explanation:
          'A true hail hit is soft (like an apple), irregular (not a perfect circle), has a granule or two left in the center, and shows no fiberglass bulking through.',
      },
      {
        id: 'c6_3',
        question: 'How do you tell a wood blister apart from a hail hit?',
        options: [
          'A blister is soft and irregular like a hail hit',
          'A blister shows straight fiberglass strands, a perfect circle or linear pattern, and no granules — and it is not soft or embedded',
          'A blister always has a granule or two left in the center',
          'You cannot tell them apart without insurance approval',
        ],
        explanation:
          'A blister is fiberglass-fine under a microscope: straight strands, a perfect circle or linear pattern, no granules inside, and it is not soft or embedded — the opposite of a hail hit.',
      },
      {
        id: 'c6_4',
        question: 'What is HAAG?',
        options: [
          'A shingle manufacturer',
          'The certification company whose standard defines textbook hail damage',
          'An insurance carrier',
          'A roofing measurement app',
        ],
        explanation:
          'HAAG is the certification company whose standard defines textbook hail damage (matting indented + fiberglass broken); most adjusters carry a HAAG certification.',
      },
      {
        id: 'c6_5',
        question: 'Which photos should you take on the roof?',
        options: [
          'Only the clearest damage shots',
          'Both damage AND non-damage',
          'Only collateral, never field shingles',
          'Only the test squares',
        ],
        explanation:
          'Photograph both damage and non-damage. Documenting non-damage honestly is part of the job and protects the claim.',
      },
    ],
  },

  // -------------------- sales_c7 --------------------
  {
    id: 'sales_c7',
    title: 'JobNimbus on the Roof + Walk-Around Photos',
    description:
      'Create the JobNimbus job while you are still on the roof, then the ground-level walk-around: four corner shots, pre-existing conditions, expensive features, drop-off location, and exterior collateral.',
    icon: 'Camera',
    estimatedMinutes: 16,
    passingScore: 80,
    sections: [
      {
        heading: 'Create the Job in JobNimbus WHILE ON THE ROOF',
        content: [
          'While you are standing on the roof is a great time to create the contact and the job in JobNimbus. At the very least you now know their name, their address, and their insurance company — and you already have your pictures uploaded.',
          'Do this now so you do not have to remember it later. You can literally walk to the neighbor\'s house and start the process over immediately.',
          'If you do not, you have to go back at night and try to remember which pictures went to what address — and you wind up in a mess. As put in the training: "Lost as hell."',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "It's a great time... to create a contact and a job while you're standing up there... At the very least, you should now know their name, their address, and their insurance company... already have your pictures and stuff uploaded... then you don't have to keep up and remember... you can literally walk to their neighbor's house and start the process over immediately.",
            context: 'Create the JobNimbus job on the roof (recording, para 214–217).',
          },
        ],
      },
      {
        heading: 'The Four Corner-to-Corner Ground Shots',
        content: [
          'From the ground, take four far-away corner-to-corner shots: front, right, left, and back. You want to see the far back-left corner and the far back-right corner of the roof in a single photo.',
          'If a tree is in the way, take two photos around the tree.',
        ],
        // AWAITING PHOTO: ground-four-corner-example.jpg — a far-away shot capturing both far corners of the roof
      },
      {
        heading: 'Protect Yourself: Pre-Existing Conditions & Expensive Features',
        content: [
          'Photograph pre-existing conditions to protect yourself: the gutter that was already broken on the left side, the oil stains already in the driveway. After the job, the homeowner cannot come back on those things.',
          'Document expensive features too — a pool, a train running through the backyard, a crazy flower bed. That is expensive, and you do not want it coming out of your check.',
          'The coaching one-liner: "We are paid to document stuff... You\'re paid to document, but you\'re not paid when you f*** something up."',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "We are paid to document stuff... You're paid to document, but you're not paid when you f*** something up.",
            context: 'The documentation ethic (recording, para 218–219).',
          },
        ],
      },
      {
        heading: 'Drop-Off Location & Exterior Collateral',
        content: [
          'Photograph where the material will potentially be dropped off, framed back to the road so the roofers and delivery people know how to find the place.',
          'Capture exterior collateral: AC vents (the fins), gutters and downspouts, specks on stained wood, a fence, and hail dings on fascia metal (when you have big hail like an inch and 3/4 or more). Take individual photos of each downspout so those line items go into the estimate.',
        ],
      },
    ],
    quiz: [
      {
        id: 'c7_1',
        question: 'When should you create the job in JobNimbus?',
        options: [
          'That evening, back at home',
          'While you are still on the roof',
          'After the adjuster approves the claim',
          'Only once the homeowner signs the contingency',
        ],
        explanation:
          'Create the contact and job in JobNimbus while you are still on the roof — you already have the name, address, insurance company, and photos, so you avoid ending up "lost as hell" later.',
      },
      {
        id: 'c7_2',
        question:
          'At a minimum, what information should you have before you leave the roof?',
        options: [
          'The homeowner\'s deductible and policy number',
          'Their name, address, and insurance company',
          'The adjuster\'s name and appointment time',
          'The exact square count and pitch',
        ],
        explanation:
          'At the very least you should now know their name, their address, and their insurance company — enough to create the JobNimbus job on the roof.',
      },
      {
        id: 'c7_3',
        question: 'How do you take the far-away ground shots of the roof?',
        options: [
          'One shot straight at the front only',
          'Four corner-to-corner shots — front, right, left, and back',
          'A single drone shot from directly overhead',
          'Close-ups of each shingle course',
        ],
        explanation:
          'Take four far-away corner-to-corner shots (front, right, left, back) so you capture the far corners of the roof; shoot around trees with two photos if needed.',
      },
      {
        id: 'c7_4',
        question: 'Why do you photograph pre-existing conditions?',
        options: [
          'To show the adjuster more damage',
          'To protect yourself — the homeowner cannot later blame you for damage that was already there',
          'To pad the photo count in JobNimbus',
          'Because insurance requires interior photos',
        ],
        explanation:
          'Documenting a gutter that was already broken or oil stains already in the driveway protects you: after the job the homeowner cannot come back on things that pre-existed.',
      },
    ],
  },

  // ===================================================================
  // PART 3 — THE TABLE
  // ===================================================================

  // -------------------- sales_c8 --------------------
  {
    id: 'sales_c8',
    title: 'Kitchen Table & Insurance Goggles',
    description:
      'Presenting the damage through the carrier\'s lens, carrier profiles, the 6–10 hits per test square target (with the space-and-time caveat), the retail pivot, and the "us vs. the insurance company" partnership frame.',
    icon: 'Table',
    estimatedMinutes: 18,
    passingScore: 80,
    sections: [
      {
        heading: 'Put On the Insurance "Goggles"',
        content: [
          'Before you walk back to the door, put on the "goggles" for the named insurance company. Based on who the carrier is, you present the damage through that lens.',
          'Get to the kitchen table if you can — but go where they are comfortable. Do not run a homeowner off trying to force the kitchen table; if they always sit in the sun room, the living room, or the back porch, that is fine. You want the homeowner comfortable.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Based on who the insurance company is, you put on them goggles.",
            context: 'The insurance goggles (recording, para 226).',
          },
        ],
      },
      {
        heading: 'Carrier Profiles',
        content: [
          'All State: on scheduling they love to set it up on the phone "because they never come to deny it" — but still prep for a possible denial/retail; the roof is often "shot."',
          'State Farm: roughly 50/50. Be prepared for a potential denial and prep them for the reinspection out the gate — you may have to go two times.',
          'USAA: generally fair/thorough (from the training materials).',
          'General rule: adjust the "6–10 hits per test square" number to what that specific adjuster, company, and storm is actually approving.',
        ],
      },
      {
        heading: 'Show the Damage & Create Urgency',
        content: [
          'Insurance route: "Here\'s the damage that I see. It\'s solid. It lines up with your neighbors in the area. I know this is what State Farm is looking for — typically six to 10 hits in every test square." Adjust the number by company/adjuster/storm.',
          'The space-and-time caveat: in one real case, an All State adjuster wanted "like 12 or 13," so for three weeks every homeowner in that neighborhood was told that number. It does not apply forever — "just in that storm, with that adjuster, on that date, in that neighborhood... space and time."',
          'Retail route (little/no damage): "Look, you don\'t really have any real damage... your roof\'s shot, it doesn\'t have a lot of life left in it... but we do have a storm date, so this is probably your last shot — we can try it. If they don\'t approve, we can work on getting you a cash job, a retail price, and we also have payment option plans."',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Typically this is what insurance is looking for because I know that they're looking for six to 10 hits in every test square.",
            context: 'The 6–10 hits target (recording, para 226–248).',
          },
        ],
      },
      {
        heading: 'Underpromise & the Partnership Frame',
        content: [
          'Do not overpromise and underdeliver. Always let the homeowner know there is still a chance this gets denied, and prep them for the reinspection process.',
          'Frame it as a partnership: "It\'s you and me, homeowner. It\'s us versus the insurance company. I\'m going to meet that adjuster for you on your behalf." It is almost like a roof lawyer — "not really, but we can\'t legally get away with saying that."',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "It's you and me, homeowner. It's us versus the insurance company. I'm going to meet that adjuster for you on your behalf... it's almost like a roof lawyer. Not really, but — we can't legally get away with saying that.",
            context: 'The partnership frame (recording, para 248).',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'c8_1',
        question: 'How many hail hits per test square is insurance typically looking for?',
        options: ['1–2 hits', '3–5 hits', '6–10 hits', '15–20 hits'],
        explanation:
          'Insurance is typically looking for six to 10 hits in every test square — the number the script uses when presenting the damage.',
      },
      {
        id: 'c8_2',
        question: 'Is the "6–10 hits per test square" number fixed?',
        options: [
          'Yes — it never changes',
          'No — adjust it by the specific adjuster, company, and storm ("space and time")',
          'Yes — but only for State Farm',
          'No — it should always be raised to 12–13',
        ],
        explanation:
          'The number flexes. In one real case, "12 or 13" was used for a specific All State adjuster for three weeks — it applies only to that storm, adjuster, date, and neighborhood ("space and time").',
      },
      {
        id: 'c8_3',
        question: 'What is the State Farm carrier profile the script describes?',
        options: [
          'Always approves on the first visit',
          'Roughly 50/50 — prep for a potential denial and the reinspection out the gate',
          'Never comes out to inspect',
          'Only covers retail (cash) jobs',
        ],
        explanation:
          'State Farm is roughly 50/50. Be prepared for a potential denial and prep the homeowner for the reinspection from the start — you may have to go two times.',
      },
      {
        id: 'c8_4',
        question: 'What is the "roof lawyer" / partnership frame?',
        options: [
          'You legally represent the homeowner in court',
          'It is you and the homeowner versus the insurance company — you meet the adjuster on their behalf as a technical advisor',
          'You guarantee the claim will be approved',
          'You work for the insurance company, not the homeowner',
        ],
        explanation:
          '"It\'s you and me, homeowner. It\'s us versus the insurance company." You meet the adjuster on their behalf — almost like a roof lawyer, though you cannot legally claim to be one.',
      },
      {
        id: 'c8_5',
        question: 'Where should you present the damage to the homeowner?',
        options: [
          'Always at the kitchen table, no exceptions',
          'Wherever the homeowner is comfortable — do not run them off forcing the kitchen table',
          'Outside, standing by your truck',
          'On the roof, before coming down',
        ],
        explanation:
          'Get to the kitchen table if you can, but go where they are comfortable — sun room, living room, or back porch. Do not run a homeowner off trying to force the kitchen table.',
      },
    ],
  },

  // -------------------- sales_c9 --------------------
  {
    id: 'sales_c9',
    title: 'The Contingency',
    description:
      'The "clutch time" of the whole process: "No claim approval, no obligation," the two things the contingency authorizes, $0 vs. competitors\' $500, and the dead-silent sign-first, slide, and dial sequence.',
    icon: 'FileSignature',
    estimatedMinutes: 18,
    passingScore: 80,
    sections: [
      {
        heading: 'Clutch Time',
        content: [
          'Going over the contingency inside is "clutch time." New reps get to the kitchen table, get to the contingency, cannot get it signed and cannot file the claim, and have to turn around and walk out. This part is really important.',
          'A contingency is not a binding contract. There is no reason a homeowner should be unwilling to sign one.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "The contingency is so simple. There's no reason that a homeowner shouldn't be willing to sign a contingency... A contingency is not a binding contract.",
            context: 'Clutch time (recording, para 256–262).',
          },
        ],
      },
      {
        heading: '"No Claim Approval, No Obligation"',
        content: [
          'At the top of the contingency it says: "No claim approval, no obligation." If they deny the claim, or only pay for a repair you cannot afford out of pocket, the homeowner is not obligated to do any work with you.',
          'It also protects them from you: "If I don\'t do what I tell you I\'m going to do, or I don\'t show up when I tell you I\'m going to show up, or I\'m not calling you back or being communicative... you\'re not obligated to do any business with me — cuz if you don\'t trust me it means I didn\'t do my job."',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "At the top of the contingency, it says no claim approval, no obligation... If I don't do what I tell you I'm going to do or I don't show up when I tell you I'm going to show up or I'm not calling you back or being communicative... you're not obligated to do any business with me — cuz if you don't trust me it means I didn't do my job.",
            context: 'The top line (recording, para 260).',
          },
        ],
      },
      {
        heading: 'The Two Things the Contingency Authorizes',
        content: [
          'Read the small text box aloud. The contingency does two things:',
          '1. It allows you to speak on the phone with the insurance company and act as a technical advisor on the claim.',
          '2. It allows you to do the work — as long as the insurance company approves everything and you do what you tell the homeowner you are going to do.',
        ],
      },
      {
        heading: 'The $0 Framing',
        content: [
          'This contingency is for $0. The homeowner owes nothing for your time today, for meeting the adjuster, or for writing the estimate — whether the claim is denied, partially approved for repair, or whatever happens.',
          'Some other companies in the area make this agreement for a minimum of $500. We do not believe in doing business that way — that is why there is no obligation and it is $0. Never bash other companies by name.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "As you can see, ma'am, this contingency we're agreeing to $0. So, you don't owe me anything for my time today or meeting the adjuster or writing the estimate whether the claim is denied or partially approved for repair or whatever... you may have heard or noticed some other companies in this area like to make this agreement for a minimum of $500... But I don't believe in doing business that way. That's why there's no obligation and it's $0.",
            context: 'The $0 framing (recording, para 263–264). Never name competitors.',
          },
        ],
      },
      {
        heading: 'The Dead-Silent Sign Sequence',
        content: [
          'When it is time to sign: you sign FIRST, where they can see you, and then you go dead silent. Say only "All right, I\'m going to sign right here," and sign. Then slide it across the table to them.',
          'It is even better on a tablet or paper because you can pull out your phone and dial the insurance company right then — let it start ringing before they even sign. Your signature is already on it and the call is already happening.',
          'You do not want to give a homeowner the chance to say no. You do all the thinking for them.',
          'If they don\'t sign, it means they don\'t trust you yet. At the very least, make sure you know when the adjuster is coming and that you are the one meeting the adjuster — another chance to build trust.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Now you sign the contingency where they see you silent and you shut the f***. You get dead f***ing silent. You just say, 'All right, I'm going to sign right here.' And then all you got to do is sign as well. Then we can put in the call to that claim... you pass it across to them. Slide it across the table... you can pull out your phone and dial the insurance company right then and there. Let it start ringing before they even sign it... because now your signature is already on it and the call is already happening... You don't want to give a homeowner the chance to say no... You do all the thinking for them.",
            context: 'The dead-silent sign sequence (recording, para 269–271).',
          },
        ],
        drillId: 'sales_d4',
      },
    ],
    quiz: [
      {
        id: 'c9_1',
        question: 'What does the top line of the contingency say?',
        options: [
          'Payment due on approval',
          'No claim approval, no obligation',
          'Minimum $500 service fee',
          'Binding two-year agreement',
        ],
        explanation:
          'At the top of the contingency it says "No claim approval, no obligation" — if the claim is denied or only a repair is approved, the homeowner is not obligated to do any work with you.',
      },
      {
        id: 'c9_2',
        question: 'Is a contingency a binding contract?',
        options: [
          'Yes — it locks the homeowner into the job',
          'No — it is not a binding contract',
          'Yes — but only after insurance approves',
          'Only if signed on a tablet',
        ],
        explanation:
          'A contingency is not a binding contract. That is exactly why there is no reason a homeowner should be unwilling to sign one.',
      },
      {
        id: 'c9_3',
        question: 'What two things does the contingency authorize?',
        options: [
          'A deposit and a start date',
          'Speaking with insurance as a technical advisor, and doing the work if insurance approves everything',
          'A credit check and a financing application',
          'A lien on the property and a payment schedule',
        ],
        explanation:
          'It lets you (1) speak with the insurance company as a technical advisor on the claim, and (2) do the work as long as insurance approves everything and you do what you said you would.',
      },
      {
        id: 'c9_4',
        question: 'What is the "dead silent" signing technique?',
        options: [
          'Ask the homeowner if they want a few days to think it over',
          'Sign it first yourself, slide it across the table, stay silent, and start dialing the insurance company',
          'Read every clause aloud before anyone signs',
          'Leave the contingency for them to mail back later',
        ],
        explanation:
          'You sign first, say "All right, I\'m going to sign right here," go dead silent, slide it across, and start dialing insurance — so the call is already happening and you never give them a chance to say no.',
      },
      {
        id: 'c9_5',
        question:
          'How does RCRS\'s contingency compare to some other companies in the area?',
        options: [
          'RCRS charges a minimum of $500, like everyone else',
          'RCRS\'s contingency is $0, while some others charge a minimum of $500 — and you never name those competitors',
          'RCRS charges more but guarantees approval',
          'RCRS requires a deposit up front',
        ],
        explanation:
          'The RCRS contingency is $0 — no charge for your time, meeting the adjuster, or writing the estimate. Some other companies make the agreement for a minimum of $500, but you never bash competitors by name.',
      },
    ],
  },

  // ===================================================================
  // PART 4 — THE CLAIM
  // ===================================================================

  // -------------------- sales_c10 --------------------
  {
    id: 'sales_c10',
    title: 'Filing the Claim on the Phone',
    description:
      'The on-the-spot claim call: the verbatim intro, the >1" damaging-hail rule, "same day, same time / none of this damage is old," restricted access, roof story/pitch, and capturing the claim number — the key to everything.',
    icon: 'Phone',
    estimatedMinutes: 20,
    passingScore: 80,
    sections: [
      {
        heading: 'Dial Codes & the Overseas Warning',
        content: [
          'Eventually you learn the dial codes for each carrier\'s phone menu — dial State Farm, punch the sequence, and it dials straight through, saving three minutes.',
          'Pre-warn the homeowner about overseas call centers: especially with an older homeowner at 6:30 or 7:00 at night, the 24-hour service may route you overseas and the rep can be hard to hear. Tell them: "I\'m going to put them on speaker phone and I\'ll try to help you."',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Especially if it's an older homeowner and it's 6:30, 7:00 at night... we may get sent to the overseas call center cuz they have 24-hour call service... you're not going to get an American on the phone. May be a little difficult to hear them. I'm going to put them on speaker phone and I'll try to help you.",
            context: 'Overseas call center warning (recording, para 268).',
          },
        ],
      },
      {
        heading: 'The Call Intro & Typical Questions',
        content: [
          'Call intro: "Hey, how are you doing? This is [name]. I\'m with River City Roofing Solutions. You\'re on speaker phone with the insured today. We\'re trying to file a new claim due to hail damage on their property."',
          'They verify the homeowner (policy info / SSN), then ask who you are and the address.',
          'Typical questions to answer: the date, the time, the size of the hail, where the damage was (roof, collateral, soft-metal vents), and whether it was wind or hail. Add other damage if relevant (fence, AC vents, garage door, busted windows).',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Hey, how are you doing? Hey, this is Brendan. I'm with River City Roofing Solutions. You're on speaker phone with the insured today. We're trying to file a new claim due to hail damage on their property.",
            context: 'The call intro (recording, para 275).',
          },
        ],
      },
      {
        heading: 'Framing the Damage: >1" and "Same Day, Same Time"',
        content: [
          'Hail size rule: over an inch is considered damaging hail.',
          'When you file, everything happens same day and same time — none of this damage is old.',
          'Listen for volunteered history. Insurance may reveal a prior claim ("Have you settled up that claim from two years ago on the water pipe burst?") or that they already paid for the roof a year ago and nothing was done — which preps the homeowner for retail ("you still have that check sitting somewhere").',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "When you're filing, everything happens same day and same time. None of this damage is old.",
            context: 'Same day, same time (recording, para 297). "Over an inch is considered damaging hail" (para 293–295).',
          },
        ],
      },
      {
        heading: 'The Claim Number Is the Key to Everything',
        content: [
          'Get the adjuster info if they will give it — day, time, name, phone number. (All State often sets it up on the phone "because they never come to deny it.") Write it down and make a task.',
          'Most important: get the claim number. Write it down, take a picture of it, and put it in JobNimbus or tag a note. The claim number is the key to everything going on with that homeowner\'s claim.',
          'Pre-empt the two standard questions: they had damage to the roof, gutters, and soft-metal vents; no, no personal property damage; and no, no one was injured.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "You got to get the claim number. So important. Write that down. Take a picture of it and put it in JobNimbus or tag a note... The claim number is the key to everything that's going on with that homeowner's claim.",
            context: 'The claim number (recording, para 305).',
          },
        ],
      },
      {
        heading: 'Restricted Access, Story/Pitch & Descriptiveness',
        content: [
          'Restricted access: an enclosed fence plus a pool is important to mention — it means extra money on the claim because they pay for the labor hours to wheelbarrow materials around.',
          'Roof story and pitch: is it one story or two, and is it steeper than the average staircase (about an 8 pitch)? A two-story steep roof is more likely to get a drone or ladder assist, so tell them.',
          'Match your descriptiveness to the hail size. Small hail (Decatur, ~1 inch flat) → be less descriptive ("I\'m not 100% sure of the size, I just know it came in on this date"). Big hail (Crossroads, 1.75–2.25 in) → be descriptive ("there\'s holes in the mailbox... please come immediately and pay for this roof").',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Letting them know if they have an enclosed fence and a pool is really important because that's restricted access... we can get a little bit extra money on the claim cuz they're paying for labor hours to use a wheelbarrow to bring stuff around.",
            context: 'Restricted access (recording, para 313).',
          },
        ],
        drillId: 'sales_d5',
      },
    ],
    quiz: [
      {
        id: 'c10_1',
        question: 'What hail size is considered damaging?',
        options: [
          'Anything over a quarter inch',
          'Anything over half an inch',
          'Over an inch',
          'Only two inches or larger',
        ],
        explanation:
          'Over an inch is considered damaging hail — the size threshold the script uses when filing.',
      },
      {
        id: 'c10_2',
        question: 'What is the single most important thing to capture on the claim call?',
        options: [
          'The adjuster\'s email address',
          'The claim number — write it down, photograph it, and put it in JobNimbus',
          'The homeowner\'s Social Security number',
          'The exact square footage of the roof',
        ],
        explanation:
          'The claim number is the key to everything on that claim. Write it down, take a picture, and put it in JobNimbus or tag a note.',
      },
      {
        id: 'c10_3',
        question: 'What does "same day, same time" mean when filing?',
        options: [
          'File within one business day of the storm',
          'None of this damage is old — everything is framed as current',
          'The adjuster comes the same day you file',
          'The homeowner must be home at the same time each day',
        ],
        explanation:
          'When you file, everything happens same day and same time — none of this damage is old.',
      },
      {
        id: 'c10_4',
        question: 'Why do you tell insurance about an enclosed fence and a pool?',
        options: [
          'It disqualifies the claim',
          'It is restricted access — extra money on the claim for the labor hours to wheelbarrow materials around',
          'It lowers the deductible',
          'It is required for the warranty',
        ],
        explanation:
          'An enclosed fence plus a pool is restricted access, which means extra money on the claim because insurance pays for the labor hours to move materials by wheelbarrow.',
      },
      {
        id: 'c10_5',
        question:
          'A two-story roof steeper than about an 8 pitch is more likely to get what?',
        options: [
          'An automatic denial',
          'A drone or ladder assist from the adjuster',
          'A lower deductible',
          'A same-day check',
        ],
        explanation:
          'A two-story, steep roof (steeper than the average staircase, ~8 pitch) is more likely to get a drone or ladder assist — so you tell insurance about it.',
      },
    ],
  },

  // -------------------- sales_c11 --------------------
  {
    id: 'sales_c11',
    title: 'The Insurance Process: Adjuster to Summary',
    description:
      'What happens after filing: the callback window, making them call YOU, meeting the adjuster as technical advisor, the 7–11 page summary, uploading it to Drive, and the 48-hour estimate promise.',
    icon: 'ClipboardCheck',
    estimatedMinutes: 18,
    passingScore: 80,
    sections: [
      {
        heading: 'The Callback Window & "Call Me"',
        content: [
          'Reiterate the callback window: like the insurance company said, they should call the homeowner back with the adjuster date within 24 to 48 hours, or a week, or whatever they said.',
          'Make them call YOU: "Once the adjuster comes out, or once you get that phone call back, I want you to call me and let me know when the adjuster\'s coming out" — so you can be there to help them as the technical advisor / roof lawyer.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Once the adjuster comes out or once you get that phone call back, I want you to call me and let me know when the adjuster's coming out... so you can come and help them. Technical advisor on the claim... roof lawyer.",
            context: 'Make them call you (recording, para 336–356).',
          },
        ],
      },
      {
        heading: 'Meeting the Adjuster & the Decision Timeline',
        media: {
          kind: 'audio',
          src: '/training-media/insurance-adjuster.mp3',
          title: 'From Hail to Home — the insurance claim, adjuster to summary (21 min)',
        },
        content: [
          'Set the expectation for meeting the adjuster: "I\'m going to meet your adjuster and we\'re going to take a look at the damage. After he leaves, I\'ll let you know how I\'m thinking or how it went." Communication builds trust.',
          'Decision timeline: once you meet with the adjuster, it typically takes about a week or two for them to come back with either an estimate or a denial.',
          'If denied, you can file for a reinspection — the homeowner\'s right to a second opinion; insurance has to send someone else out. Get the denial in writing with specific reasons.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Once I meet with the adjuster, it typically takes him about a week or two to get back with you with either an estimate or a denial.",
            context: 'Decision timeline (recording, para 336–356).',
          },
        ],
      },
      {
        heading: 'The Summary & the 48-Hour Estimate Promise',
        content: [
          'If approved, they mail or email an insurance summary — a 7 to 11 page document. A denial is typically a one-page document (maybe two or three) with some pictures explaining why. The first check may be mailed or electronically deposited.',
          'You need a copy of the summary. If it is on paper, the homeowner comes by to scan it into a document and upload the PDF to Drive.',
          'The 48-hour estimate promise: "Once I get your insurance summary, my goal is to turn it around into an estimate within 48 hours." And: "My goal is for your only out-of-pocket cost to be your deductible, any rotted decking the insurance may not cover, or upgrades that you choose."',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Once I get your insurance summary, my goal is to turn it around into an estimate within 48 hours... My goal is for your only out-of-pocket cost to be your deductible, any rotted decking that the insurance may not cover or upgrades that you choose.",
            context: 'The 48-hour promise (recording, para 336–356).',
          },
        ],
      },
      {
        heading: 'Deductible Financing & Upgrade Seeds',
        content: [
          'The deductible can be obtained during the filing call (they will tell the homeowner their wind-and-hail deductible). For a high deductible, offer payment-option plans — e.g., "Maybe they have a huge deductible of $6,487; we can finance that."',
          'Seed upgrades only if the homeowner is interested: a dimensional roof with hail damage can be upgraded to the Dynasty Impact shingle, and you can mention synthetic felt or bullet boots.',
        ],
      },
      {
        heading: '⚠ Honest Gap: The Recording Ends Before Estimating & the Close',
        content: [
          'This module intentionally stops here. The recorded session ends before the estimate-writing, pricing/upgrade, and close/deposit steps were taught.',
        ],
        callout: {
          tone: 'warning',
          title: 'Estimating, pricing & the close are taught live',
          text: 'Estimate writing, pricing/upgrades, and the close (deposit) are taught live by Michael and Chris in the next session — this recording ends before that content. Do not improvise it here.',
        },
      },
    ],
    quiz: [
      {
        id: 'c11_1',
        question: 'How long is an APPROVED insurance summary?',
        options: [
          'A single page',
          'A 7 to 11 page document (a denial is typically 1–3 pages)',
          'Exactly 5 pages',
          '20 or more pages',
        ],
        explanation:
          'An approved summary is a 7 to 11 page document; a denial is typically a one-page document (maybe two or three) with some pictures explaining why.',
      },
      {
        id: 'c11_2',
        question: 'What is the estimate turnaround goal after you receive the summary?',
        options: [
          'Same day',
          'Within 48 hours',
          'Within one week',
          'Within 30 days',
        ],
        explanation:
          '"Once I get your insurance summary, my goal is to turn it around into an estimate within 48 hours."',
      },
      {
        id: 'c11_3',
        question: 'What should the homeowner\'s out-of-pocket cost be on an approved claim?',
        options: [
          'The full cost of the roof',
          'Deductible + any rotted wood/decking + any chosen upgrades',
          'Nothing at all, ever',
          'Half of the total estimate',
        ],
        explanation:
          'The goal is for the only out-of-pocket cost to be the deductible, any rotted decking insurance may not cover, and any upgrades the homeowner chooses.',
      },
      {
        id: 'c11_4',
        question: 'If the claim is denied, what can you do?',
        options: [
          'Nothing — the decision is final',
          'File for a reinspection — the homeowner\'s right to a second opinion',
          'Immediately start the retail job without telling them',
          'Re-file the same claim the next day',
        ],
        explanation:
          'You can file for a reinspection, which is the homeowner\'s right to a second opinion; insurance has to send someone else out. Get the denial in writing with specific reasons.',
      },
      {
        id: 'c11_5',
        question: 'Where do you upload a copy of the insurance summary?',
        options: [
          'You email it to yourself',
          'You scan it to a PDF and upload it to Drive',
          'You keep only a paper copy',
          'You text a photo to the office',
        ],
        explanation:
          'You need a copy of the summary. If it is on paper, the homeowner comes by to scan it into a document and upload the PDF to Drive (Google Drive).',
      },
    ],
  },

  // -------------------- sales_c12 --------------------
  {
    id: 'sales_c12',
    title: 'Close-Out, Yard Sign & Your Numbers',
    description:
      'The yard-sign script and its two benefits, the HOA variant, and the volume goals: 3–4 full processes a day, a minimum of 3 signed contingencies a week — and why none are guaranteed.',
    icon: 'Flag',
    estimatedMinutes: 12,
    passingScore: 80,
    sections: [
      {
        heading: 'The Yard Sign',
        content: [
          'Before you leave, plant a yard sign and remind them to call you: "Whenever I leave today, I\'m going to go ahead and stick out a sign in your yard. Don\'t forget to call me when you hear back for the adjuster appointment."',
          'Two benefits of the yard sign: (1) it makes the house easier for the adjuster to find, and (2) it keeps other roofers from coming by and bothering the homeowner.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Whenever I leave today, I'm going to go ahead and stick out a sign in your yard. Don't forget to call me when you hear back for when the adjuster appointment... it'll keep other roofers from coming by and like bothering you.",
            context: 'The yard sign (recording, para 356–362).',
          },
        ],
      },
      {
        heading: 'The HOA Variant',
        content: [
          'In an HOA-strict neighborhood: "I\'m going to bring you a sign — just set it in your garage." In many HOAs you can only have a sign 48 hours before your install date.',
          'Put it out 48 hours before install so the material guy knows when to get on the roof.',
        ],
      },
      {
        heading: 'Your Volume Goals',
        content: [
          'Your goal is to be able to run this whole process three to four times a day if you can. Your minimum goal is three signed contingencies in a week.',
          'Even if only half get approved and two out of three sign, you are probably still going to make about four. But none of those are guaranteed — someone could come in underneath you and eat the deductible — so you constantly keep adding stuff into your phone.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Your goal is to be able to do this whole process three to four times a day if you can... Your minimum goal is three in a week... none of those are f***ing guaranteed... Someone could come in underneath you and eat the deductibles... So, you got to constantly be adding stuff into your phone.",
            context: 'Volume goals (recording, para 362–368).',
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'c12_1',
        question: 'What are the two benefits of planting a yard sign?',
        options: [
          'It advertises to the whole street and lowers the deductible',
          'It makes the house easier for the adjuster to find, and it keeps other roofers from bothering the homeowner',
          'It guarantees approval and speeds up the check',
          'It satisfies the HOA and pays for itself',
        ],
        explanation:
          'The yard sign makes the house easier for the adjuster to find and keeps other roofers from coming by and bothering the homeowner.',
      },
      {
        id: 'c12_2',
        question: 'How many full processes should you aim to run in a day?',
        options: ['One', 'Three to four', 'Ten', 'As many as possible with no target'],
        explanation:
          'Your goal is to run the whole process three to four times a day if you can.',
      },
      {
        id: 'c12_3',
        question: 'What is your minimum weekly goal for signed contingencies?',
        options: ['1 per week', '3 per week', '5 per week', '10 per week'],
        explanation:
          'Your minimum goal is three signed contingencies in a week.',
      },
      {
        id: 'c12_4',
        question: 'What is the yard-sign HOA variant?',
        options: [
          'Plant the sign anyway and pay the HOA fine',
          'Set the sign in the garage and put it out 48 hours before the install date',
          'Skip the yard sign entirely',
          'Put the sign in the neighbor\'s yard instead',
        ],
        explanation:
          'In HOA-strict neighborhoods, set the sign in the garage; many HOAs only allow a sign 48 hours before install, so put it out then — which also signals the material guy when to get on the roof.',
      },
    ],
  },

  // ===================================================================
  // PART 5 — FOUNDATIONS (JSON-sourced; footer where applicable)
  // ===================================================================

  // -------------------- sales_s1 --------------------
  {
    id: 'sales_s1',
    title: 'Product Knowledge: The IKO Line',
    description:
      'The IKO shingle lineup and warranty tiers, key accessories, and the Good/Better/Best estimate structure — the product facts a rep needs at the table.',
    icon: 'Package',
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'The IKO Shingle Lineup',
        media: {
          kind: 'video',
          src: '/training-media/iko-investigators-guide.mp4',
          title: 'IKO Shingles: An Investigator’s Guide',
        },
        content: [
          'Dynasty is the primary product — the shingle RCRS installs most often. It carries up to a 130 mph wind warranty.',
          'Nordic is the impact-resistant shingle — Class 4, the highest impact rating.',
          'Marathon Plus AR is the 3-tab entry option.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
      {
        heading: 'IKO Warranty Tiers',
        media: {
          kind: 'audio',
          src: '/training-media/iko-ironclad-deep-dive.wav',
          title: 'IKO Iron Clad warranty — deep-dive audio',
        },
        content: [
          'RCRS is IKO ROOFPRO Craftsman Premier — the highest IKO contractor tier.',
          'That tier unlocks the 25-year Iron Clad Protection warranty.',
          'Craftsman Premier requires a minimum annual purchase of 5,000 squares.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
      {
        heading: 'Accessories & Add-Ons',
        image: {
          src: '/training/sales/handbook/hb-bullet-boot-sheet-1.png',
          alt: 'The Bullet Boot product sheet: TPO pipe boot install photos, benefits, and the four sizes.',
          caption: 'The Bullet Boot — the TPO pipe boot that replaces the old lead boot (RCRS handbook).',
        },
        content: [
          'StormShield is used for ice-and-water protection on the roof deck.',
          'LeafX is the gutter-guard system RCRS installs; the best time to sell it is during a roof-replacement job.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
      {
        heading: 'Good / Better / Best Estimate Structure',
        content: [
          'RCRS presents estimates as Good / Better / Best. The resolved ladder is: Good = Cambridge, Better = Dynasty, Best = Nordic.',
          'Spend the most time on the Better option (Dynasty) — it is the primary product and the one most homeowners land on.',
          'Key selling point for upgrading Cambridge → Dynasty on an insurance job: insurance covers the base, so the out-of-pocket upgrade cost is small for much better protection.',
        ],
        // CONFIRM WITH MICHAEL: G/B/B ladder — resolved here as Good=Cambridge / Better=Dynasty / Best=Nordic to fix the
        // internal inconsistency in the original JSON (shingle-lineup section called Marathon Plus AR the "Good" 3-tab,
        // while the Good/Better/Best section listed Cambridge). Confirm the intended ladder before this is quizzed on the "Good" label.
        sourceNote: JSON_SOURCE_NOTE,
        callout: {
          tone: 'info',
          title: 'Financing',
          text: 'For high deductibles or retail jobs, say "payment option plans / deductible financing available." Do not name a specific financing partner until it is confirmed.',
        },
      },
      // CONFIRM WITH MICHAEL: financing partner — the original sales-rep-quiz.json is the ONLY source that names "Sunlight
      // Financial." It is deliberately NOT stated in content or quizzed here until confirmed. Use the generic "payment option
      // plans / deductible financing" language above.
    ],
    quiz: [
      {
        id: 's1_1',
        question: 'Which IKO shingle does RCRS install most often?',
        options: ['Marathon Plus AR', 'Dynasty', 'Nordic', 'Cambridge'],
        explanation:
          'Dynasty is the primary product — the shingle RCRS installs most often.',
      },
      {
        id: 's1_2',
        question: 'What is the impact class of the Nordic shingle?',
        options: ['Class 1', 'Class 2', 'Class 3', 'Class 4'],
        explanation:
          'Nordic is a Class 4 impact-resistant shingle — the highest impact rating.',
      },
      {
        id: 's1_3',
        question: 'How long is the Iron Clad Protection warranty?',
        options: ['10 years', '15 years', '20 years', '25 years'],
        explanation:
          'The Craftsman Premier tier unlocks the 25-year Iron Clad Protection warranty.',
      },
      {
        id: 's1_4',
        question: 'What is RCRS\'s IKO ROOFPRO contractor tier?',
        options: ['ProShield', 'Preferred', 'Craftsman Premier', 'Authorized Installer'],
        explanation:
          'RCRS is IKO ROOFPRO Craftsman Premier — the highest IKO contractor tier.',
      },
      {
        id: 's1_5',
        question: 'What is StormShield used for?',
        options: [
          'Ridge ventilation',
          'Ice-and-water protection on the roof deck',
          'A gutter-guard system',
          'A synthetic starter strip',
        ],
        explanation:
          'StormShield is used for ice-and-water protection on the roof deck.',
      },
    ],
  },

  // -------------------- sales_s2 --------------------
  {
    id: 'sales_s2',
    title: 'Objection Handling',
    description:
      'The RCRS objection-handling playbook — acknowledge, question, reframe, always leave a card — plus the specific door rebuttals. (Most objections are handled inside the qualifying questions.)',
    icon: 'MessageSquareWarning',
    estimatedMinutes: 14,
    passingScore: 80,
    sections: [
      {
        heading: 'Read This First',
        content: [
          'These rebuttals are from the RCRS playbook, not the recorded session. Most objections are handled inside the qualifying questions — master The Door Knock (c1) and Qualifying the Homeowner (c2) first.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
        callout: {
          tone: 'info',
          title: 'Source note',
          text: 'The scripts in this module come from the portal playbook, not the recorded training. The only real-time objection handling lives in the qualifying logic and the contingency talk-track.',
        },
      },
      {
        heading: 'Door Rebuttals',
        content: [
          '"I need to think about it" → "I completely understand. What specifically would you like to think about? The contingency means there\'s zero obligation if insurance doesn\'t approve your claim. All I\'m asking for is permission to advocate on your behalf."',
          '"I already have a roofer" → "That\'s great. Quick question — are they a Craftsman Premier contractor with IKO? That determines your warranty level. We\'re one of only a few in the area that can offer the 25-year Iron Clad Protection. Would it hurt to get a second opinion — especially since it\'s free?"',
          '"I don\'t think I have damage" → "A lot of our customers say the same thing before the inspection. Hail damage isn\'t always visible from the ground — that\'s why I bring my ladder. It\'s completely free, and if there\'s no damage, I\'ll tell you that honestly. I document non-damage too."',
          '"My insurance will go up if I file a claim" → "In Alabama, insurance companies cannot raise your rate for filing a weather-related claim. Storm damage is an act of God — you didn\'t cause it. Your rates are more affected by the overall claims in your ZIP code than your individual claim."',
          '"I already had someone look at my roof and they said it was fine." → "That\'s actually common. Let me take a fresh look — things change with each storm, and a second opinion never hurts." (Never trash-talk other contractors.)',
          '"Insurance will just deny it anyway." → "I completely understand that concern. We document everything with photos and have been through this thousands of times. Even if there\'s a chance of denial, the inspection is free and you\'ll know exactly where you stand." (Never guarantee approval — that\'s illegal/unethical.)',
          '"I was already denied by insurance" → "That happens more often than you\'d think. You have the right to a reinspection — a second opinion from a different adjuster. Would you like me to take a look at what they said no to?"',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
      {
        heading: 'The Golden Rules of Objection Handling',
        content: [
          '1. Never argue — acknowledge their concern.',
          '2. Ask questions — understand the real objection.',
          '3. Reframe — turn the objection into a reason to say yes.',
          '4. Always leave your card — even on a hard no.',
          '5. Follow up — today\'s no can become tomorrow\'s yes after the next storm.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
    ],
    quiz: [
      {
        id: 's2_1',
        question: '"My insurance will go up if I file a claim." What is the correct reframe?',
        options: [
          'Tell them rates always rise, but the new roof is worth it',
          'In Alabama, rates can\'t be raised for weather-related (act of God) claims',
          'Advise them not to file and pay cash instead',
          'Guarantee their rate will stay the same forever',
        ],
        explanation:
          'In Alabama, insurance companies cannot raise your rate for filing a weather-related claim — storm damage is an act of God you did not cause.',
      },
      {
        id: 's2_2',
        question:
          '"I already had someone look at my roof and they said it was fine." What is the best response?',
        options: [
          'Tell them the other roofer was probably incompetent',
          '"That\'s actually common. Let me take a fresh look — things change with each storm, and a second opinion never hurts."',
          'Walk away — the roof is already claimed',
          'Guarantee you will find damage they missed',
        ],
        explanation:
          'Offer a fresh look — things change with each storm and a second opinion never hurts. Never trash-talk other contractors.',
      },
      {
        id: 's2_3',
        question: 'Which is one of the Golden Rules of objection handling?',
        options: [
          'Argue until they agree with you',
          'Never argue — acknowledge their concern',
          'Never leave a card on a hard no',
          'Guarantee the claim will be approved',
        ],
        explanation:
          'Rule 1 is never argue — acknowledge their concern. The rules also include always leaving your card, even on a hard no.',
      },
      {
        id: 's2_4',
        question: '"I was already denied by insurance." What do you offer?',
        options: [
          'Nothing — a denial is final',
          'The right to a reinspection — a second opinion from a different adjuster',
          'A guaranteed approval on the second try',
          'A cash job at double the price',
        ],
        explanation:
          'A denial is not final — the homeowner has the right to a reinspection, a second opinion from a different adjuster.',
      },
    ],
  },

  // -------------------- sales_s3 --------------------
  {
    id: 'sales_s3',
    title: 'Company Knowledge',
    description:
      'The RCRS facts every rep must know cold: headquarters, service areas, expansion, credentials, ownership, hours, and what "integrity first" means in practice.',
    icon: 'Building2',
    estimatedMinutes: 12,
    passingScore: 80,
    sections: [
      {
        heading: 'Who We Are & Where We Work',
        media: {
          kind: 'video',
          src: '/training-media/company-overview.mp4',
          title: 'River City Roofing Solutions — company overview',
        },
        content: [
          'Headquarters: Decatur, AL — 3325 Central Pkwy SW, Decatur, AL 35603.',
          'Primary service areas: North Alabama — Huntsville, Madison, Decatur, Athens, and Owens Cross Roads.',
          'Expanding into: Birmingham and Nashville.',
          'RCRS is a family-owned business, open 24/7. Phone: (256) 274-8530.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
      {
        heading: 'Credentials & Ownership',
        content: [
          'BBB rating: A+.',
          'Decatur Daily Best of the Best.',
          'Owners Chris and Michael bring 30–40+ years of combined experience.',
          'IKO being family-owned matters because of shared values — quality, relationships, and long-term thinking.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
      {
        heading: 'Integrity First',
        content: [
          '"Integrity first" in practice means documenting honestly — including when there IS no damage.',
          '"Underpromise, overdeliver" means always prepping the homeowner for a potential denial.',
          'Services beyond roofing include gutter guards (LeafX) and related exterior services.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
    ],
    quiz: [
      {
        id: 's3_1',
        question: 'Where is RCRS headquartered?',
        options: ['Huntsville, AL', 'Birmingham, AL', 'Decatur, AL', 'Nashville, TN'],
        explanation:
          'RCRS is headquartered in Decatur, AL — 3325 Central Pkwy SW, Decatur, AL 35603.',
      },
      {
        id: 's3_2',
        question: 'What is RCRS\'s BBB rating?',
        options: ['A', 'A+', 'B+', 'Not rated'],
        explanation: 'RCRS is BBB A+ rated.',
      },
      {
        id: 's3_3',
        question: 'Which markets is RCRS expanding into?',
        options: [
          'Atlanta and Memphis',
          'Birmingham and Nashville',
          'Mobile and Montgomery',
          'Chattanooga and Knoxville',
        ],
        explanation: 'RCRS is expanding into Birmingham and Nashville.',
      },
      {
        id: 's3_4',
        question: 'What are RCRS\'s operating hours?',
        options: ['9–5 weekdays', 'Open 24/7', '8–6 Monday–Saturday', 'By appointment only'],
        explanation: 'RCRS is open 24/7.',
      },
      {
        id: 's3_5',
        question: 'What does "integrity first" look like in practice?',
        options: [
          'Always finding at least some damage to claim',
          'Documenting honestly — including when there IS no damage',
          'Guaranteeing every claim gets approved',
          'Offering the lowest price in the market',
        ],
        explanation:
          '"Integrity first" means documenting honestly, including when there is no damage — the same ethic taught on the roof.',
      },
    ],
  },

  // -------------------- sales_s4 --------------------
  {
    id: 'sales_s4',
    title: 'The JobNimbus Pipeline',
    description:
      'The pipeline stages a rep works, the five forms and when each fires, the data hygiene rules, and exactly who moves the job at each stage — rep vs. office.',
    icon: 'GitBranch',
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'The Pipeline Stages',
        content: [
          'JobNimbus organizes a job through seven high-level stages: Lead → Estimating → Sold → In Production → Accounts Receivable → Completed → Lost.',
          'Under those stages sit 26 detailed statuses; learn the stage level and the specific statuses reps actually touch.',
          'Paid & Closed is the status that triggers commission.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
      {
        heading: 'The Five Forms',
        content: [
          'Five forms move a job through its life: the Contingency, the Signed Contract, the Customer Acceptance Form, the Job Completion Form, and the Customer Survey.',
          'Each fires at its own point: the Contingency at the kitchen table; the Signed Contract once the estimate is agreed; the Customer Acceptance Form to confirm scope; the Job Completion Form at the end of the install; and the Customer Survey after completion.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
      {
        heading: 'Data Hygiene',
        content: [
          'Create the job in JobNimbus while you are still on the roof.',
          'Always log the lead source — $386,076 in revenue was recorded as "Source Not Captured."',
          'Update the pipeline stage after the kitchen table, and put the claim number into a note the moment you have it.',
        ],
        sourceNote: JSON_SOURCE_NOTE,
      },
      {
        heading: 'Who Moves the Job — Rep vs. Office',
        content: [
          'JobNimbus has a real hand-off built into the workflow. As the rep, you move the job through the Lead and Estimating statuses yourself: Lead → Aerial Measurements → Inspection → Estimate → Contingency Signed → Signed Contract → Deposit → and finally Submit for Approval.',
          'Submit for Approval is the hand-off line. The moment you submit, the job leaves your hands: the office, management, and JobNimbus automations move it through the next steps — approve or deny the job, then Materials Ordered/Scheduled and the rest of In Production.',
          'You still have work inside Production. Once the office puts the job in the status "CA & Completed Photos Needed," you upload the signed Customer Acceptance Form and the completed photos, then set the status to "CA & Photos Uploaded." That is what triggers John to review the photos and approve payouts.',
          'Accounts Receivable (Jobs to Cost → Invoiced → Payouts) and Completed (Paid & Closed) are office / production / automation controlled. Paid & Closed is the status that triggers your commission.',
          'One rep-side timing rule lives at the very top of the pipeline: a new lead is a task. If you have not contacted the homeowner and completed that task by hour 3, the lead is automatically reassigned.',
        ],
        callout: {
          tone: 'info',
          title: 'The hand-off line: Submit for Approval',
          text: 'You control everything up to Submit for Approval. From that status forward, the office, management, and automations own the job — approval, materials, invoicing, and payout. Your only Production job is uploading the Customer Acceptance Form + completed photos and marking "CA & Photos Uploaded" so John can approve the payout.',
        },
        sourceNote: JSON_SOURCE_NOTE,
      },
    ],
    quiz: [
      {
        id: 's4_1',
        question: 'Which pipeline status triggers commission?',
        options: ['Sold', 'In Production', 'Completed', 'Paid & Closed'],
        explanation: 'Paid & Closed is the status that triggers commission.',
      },
      {
        id: 's4_2',
        question: 'When should you create the job in JobNimbus?',
        options: [
          'After the claim is approved',
          'While you are still on the roof',
          'At the end of the week',
          'Only once the contract is signed',
        ],
        explanation:
          'Create the job in JobNimbus while you are still on the roof — the same data-hygiene rule taught on the roof.',
      },
      {
        id: 's4_3',
        question: 'Why is logging the lead source so important?',
        options: [
          'It is required to file the insurance claim',
          '$386,076 in revenue was recorded as "Source Not Captured"',
          'It sets the commission rate',
          'It determines the warranty tier',
        ],
        explanation:
          'Always log the lead source — $386,076 in revenue was untracked as "Source Not Captured," which is why this hygiene rule matters.',
      },
      {
        id: 's4_4',
        question: 'Which of these is one of the five JobNimbus forms?',
        options: [
          'The Insurance Summary',
          'The Customer Acceptance Form',
          'The Adjuster Report',
          'The HAAG Certification',
        ],
        explanation:
          'The five forms are the Contingency, Signed Contract, Customer Acceptance Form, Job Completion Form, and Customer Survey.',
      },
      {
        id: 's4_5',
        question:
          'At which status does the job leave the rep’s hands and pass to the office/automations?',
        options: [
          'Inspection',
          'Contingency Signed',
          'Submit for Approval',
          'Paid & Closed',
        ],
        explanation:
          'The rep moves the job through the Lead and Estimating statuses up to Submit for Approval. From there, the office, management, and automations take over — approval, materials, invoicing, and payout.',
      },
    ],
  },

  // ===================== UNIFIED CURRICULUM — 10 NEW MODULES (2026-08) =====================

  // -------------------- sales_c13 --------------------
  {
    id: 'sales_c13',
    title: 'Spark to Cash: The Full Job Workflow',
    description:
      'The seven-step lifecycle every job runs — Lead to Paid — the funnel from doors to closes, the clean rep → office → crew handoffs, and one job walked start to finish.',
    icon: 'Route',
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'The Seven Steps — Spark to Cash',
        content: [
          'Every RCRS job runs the same seven-step lifecycle. Learn it as the spine that everything else hangs on — keep asking yourself "where are we on the job?"',
          '1. LEAD — comes in from a storm response, a referral, or a door knock, and gets assigned to a rep.',
          '2. INSPECT & ESTIMATE — the rep inspects the roof, documents the damage with photos, and delivers an in-person estimate (best with both decision-makers home).',
          '3. SIGN — the customer signs. On insurance jobs, you head to the adjuster appointment, where the claim is approved or denied.',
          '4. MATERIAL — materials are ordered and staged at the warehouse; the driver loads and verifies the order before it leaves the yard.',
          '5. INSTALL — the crew protects the property, tears off the old roof, inspects the decking, installs the new roof, and cleans up with magnets and rakes.',
          "6. JOB BREAKDOWN — the job is totaled: overhead, profit, and the rep's 50% pay.",
          '7. PAID & FOLLOW-UP — the rep is paid (1099), and the customer gets a review request, a survey, and their warranty.',
        ],
        proTips: [
          'On insurance jobs, step 3 (Sign) includes the adjuster appointment — that is where the claim actually gets approved.',
          'The whole company works off what you enter — update your JobNimbus status in real time as each step happens.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "The Full Job Workflow (Spark to Cash)."',
      },
      {
        heading: 'The Funnel: Doors to Closes',
        media: {
          kind: 'audio',
          src: '/training-media/sales-funnel.mp3',
          title: 'Decoding the Funnel of Fire — how elite reps convert (14 min)',
        },
        content: [
          'A job is the end of a funnel that starts at the top with volume. You knock every door — 10 out of 10, nice house or not — because the doors at the top are what feed signed jobs at the bottom.',
          'Doors become conversations, conversations become inspections, inspections become in-person estimates, and estimates become closes. Each stage is narrower than the one above it, so the only way to grow the bottom is to feed the top.',
          'The numbers to hit: 8–10 inspections per week, with 40–50% conversion counted as a strong rate. Speed matters too — first contact on a new lead in under 5 minutes.',
          'Log every door-knock area in JobNimbus. It feeds your lead credit AND the routing that puts the next lead in your hands.',
        ],
        proTips: [
          'Conversion lives in the middle of the funnel — in-person delivery with both decision-makers home is what turns inspections into closes.',
          'Under-5-minute speed-to-lead is a funnel multiplier: the faster you reach the top, the more comes out the bottom.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Door Knocking" numbers-to-hit and the funnel audio; funnel framing generalized from the class.',
      },
      {
        heading: 'Clean Handoffs: Rep → Office → Crew',
        content: [
          'A job passes through three sets of hands, and the cleaner each handoff, the faster the job closes and everyone gets paid.',
          'Rep → Office: you hand off a signed contract, the claim number, and real-time JobNimbus status updates. Sloppy notes here mean the office is guessing.',
          'Office → Crew: the office orders and stages materials; the driver load-verifies the truck before it leaves the yard, which is what deducts stock and fires the invoice. Then the crew installs.',
          'Crew → Rep/Customer: once the roof is on, the job comes back around to the breakdown, the rep\'s pay, and the customer\'s follow-up. Nothing should fall in the gaps between hands.',
        ],
        callout: {
          tone: 'info',
          title: 'The whole company reads what you enter',
          text: 'JobNimbus is the single source of truth for contacts, jobs, and the pipeline. Update the status in real time — the office, the PM, and the crew are all working off what you put in.',
        },
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — workflow "Pro tip" on rep to office to crew handoffs and JN real-time updates; handoff detail generalized from the class.',
      },
      {
        heading: 'One Job, Spark to Cash (Worked Example)',
        content: [
          'Follow one job the whole way through: LEAD → SIGN → TICKET → DELIVER → BREAKDOWN → PAID.',
          'A hail lead comes in and is assigned to you. You inspect the roof, document every damage point with photos, and deliver the estimate in person with both spouses home. They sign, and on the adjuster appointment the claim gets approved.',
          'The office turns the approval into a material order; a warehouse ticket is created, the crew pulls it, and the driver load-verifies the truck — stock deducts and the invoice fires. The truck delivers, the crew tears off, inspects the decking, installs, and cleans up.',
          'The job breakdown totals overhead, profit, and your 50%. When QuickBooks pays the 1099, that cash is yours. The customer, meanwhile, gets a review request, a survey, and their warranty.',
          'Underneath all of it sit three data pillars: Google Sheets (the master store), JobNimbus/JN (live CRM + invoicing), and QuickBooks/QB (actual commission cash). Sheets + JN + QB.',
        ],
        proTips: [
          'Log it in real time, document everything, deliver in person — the three habits that carry a job cleanly from spark to cash.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "One Job, Spark to Cash" wrap-up; the Sheets + JN + QB mental model from the RCRS portal training materials.',
      },
    ],
    quiz: [
      {
        id: 'c13_1',
        question: 'What is the correct order of the seven-step job workflow?',
        options: [
          'Lead → Sign → Inspect & Estimate → Material → Install → Paid → Job Breakdown',
          'Lead → Inspect & Estimate → Sign → Material → Install → Job Breakdown → Paid & Follow-Up',
          'Inspect & Estimate → Lead → Material → Sign → Install → Job Breakdown → Paid',
          'Lead → Inspect & Estimate → Material → Sign → Job Breakdown → Install → Paid',
        ],
        explanation:
          'The lifecycle is Lead → Inspect & Estimate → Sign → Material → Install → Job Breakdown → Paid & Follow-Up. You inspect and estimate before the sign, order material after the sign, and the breakdown comes after the roof is installed.',
      },
      {
        id: 'c13_2',
        question: 'Before a job is signed, what does the rep do in step 2?',
        options: [
          'Order the materials and schedule the crew',
          'Run the job breakdown and calculate the rep pay',
          'Inspect and document the roof with photos, then deliver an in-person estimate',
          'Load-verify the truck at the warehouse',
        ],
        explanation:
          'Step 2 (Inspect & Estimate) is the rep inspecting the roof, documenting the damage with photos, and delivering an in-person estimate — best with both decision-makers home. Material, crew, and the breakdown all come later.',
      },
      {
        id: 'c13_3',
        question: 'Who loads and verifies the material before it leaves the yard?',
        options: [
          'The driver',
          'The sales rep',
          'The homeowner',
          'The insurance adjuster',
        ],
        explanation:
          'In the Material step, the driver loads and verifies the order before it leaves the warehouse. That load-verify is the moment stock deducts and the invoice fires.',
      },
      {
        id: 'c13_4',
        question: 'What does the Job Breakdown total?',
        options: [
          "The homeowner's deductible and any upgrades",
          'The number of squares and the waste factor',
          "The claim number and the adjuster's scope",
          "Overhead, profit, and the rep's 50% pay",
        ],
        explanation:
          "The Job Breakdown totals the job into overhead, profit, and the rep's 50% share. It is how the company knows the job made money and how the rep gets paid.",
      },
      {
        id: 'c13_5',
        question: 'At Paid & Follow-Up, what does the customer receive?',
        options: [
          'A second estimate and a new contingency',
          'A material order and a delivery ticket',
          'A review request, a survey, and their warranty',
          'A commission statement and a job breakdown',
        ],
        explanation:
          'After the install and pay, the customer gets a review request, a satisfaction survey, and their warranty — the follow-up that closes the loop on the job.',
      },
    ],
  },

  // -------------------- sales_c14 --------------------
  {
    id: 'sales_c14',
    title: 'Estimates & Measurements',
    description:
      'The measurement math (squares, pitch multiplier, waste factor), building the estimate in the portal from an EagleView report, the 48-hour insurance promise, and the honest out-of-pocket conversation.',
    icon: 'Calculator',
    estimatedMinutes: 20,
    passingScore: 80,
    sections: [
      {
        heading: 'Measurement Basics',
        content: [
          'A SQUARE is the roofing unit of area: 100 square feet. To get squares, take the total roof area and divide by 100.',
          "The PITCH MULTIPLIER converts the roof's flat footprint into its actual sloped area — a steeper roof has more real surface than its footprint suggests, so the multiplier scales the number up.",
          'The WASTE FACTOR accounts for cuts, starter, and overlaps. Standard is 10–15%, depending on how complex (cut-up) the roof is.',
          'Steeper pitch costs more two ways: it takes more material (more actual area), and the labor is harder, slower, and more expensive.',
        ],
        proTips: [
          'A cut-up roof with lots of hips, valleys, and penetrations sits at the high end of the 10–15% waste range.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Estimates: Measurement basics."',
      },
      {
        heading: 'Building the Estimate',
        content: [
          "Build the estimate in the RCRS portal / JobNimbus, working from an EagleView measurement report so the roof's real numbers drive it — not a guess from the ground.",
          'Cover the cost categories: materials, labor, disposal, permits, and overhead.',
          'An accurate address is what makes the measurement, hail lookup, and routing work — so the estimate is only as good as the job entry behind it.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Estimates: Building the estimate."',
      },
      {
        heading: 'Insurance Jobs: Summary → Estimate in 48 Hours',
        content: [
          'On an approved insurance job, get a copy of the insurance summary — the 7–11 page approval document the carrier issues.',
          'Turn that summary into an estimate within 48 hours. Fast turnaround keeps the job moving and the homeowner confident.',
          'Cross-ref: the adjuster appointment and how the claim gets approved are covered in the Insurance Process module — this module picks up once you have the summary in hand.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Estimates" (48-hour promise) and "The Adjuster Appointment" (7–11 page summary).',
      },
      {
        heading: 'The Out-of-Pocket Promise',
        content: [
          "On an approved insurance job, the homeowner's only out-of-pocket cost is their deductible — plus any rotted wood found on tear-off and any upgrades they choose (like an impact shingle or premium synthetic felt).",
          'Say it plainly and honestly: "Your out-of-pocket is your deductible, plus any rotted decking and any upgrades you decide you want." Nothing hidden, nothing inflated.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "On an approved claim, your only out-of-pocket is your deductible — plus any rotted wood we find once we tear off, and any upgrades you choose. That's it.",
            context: 'The out-of-pocket promise (Aug 13, 2026 class — Estimates).',
          },
        ],
        callout: {
          tone: 'warning',
          title: 'The deductible is NEVER waived',
          text: 'The homeowner is responsible for their deductible — it is never waived, discounted, absorbed, or "eaten" by RCRS. Offering to waive a deductible is insurance fraud. Payment plans exist for high deductibles, but the deductible itself is always owed.',
        },
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Estimates" (out-of-pocket). Deductible-never-waived stated per RCRS insurance-ethics rules.',
      },
      {
        heading: 'Before You Sign: See the Contingency Module',
        content: [
          'The contingency agreement is what lets you act as the homeowner\'s technical advisor with the insurance company. It is taught in full elsewhere.',
        ],
        callout: {
          tone: 'info',
          title: 'Cross-reference: The Contingency',
          text: 'The contingency agreement itself — what it is, why it protects both sides, and the signing technique — is covered in "The Contingency" module. This Estimates module does not re-teach it; head there for the agreement.',
        },
        sourceNote:
          'Cross-reference only — the contingency is taught in its own module.',
      },
    ],
    quiz: [
      {
        id: 'c14_1',
        question: 'What is a "square" in roofing?',
        options: [
          '100 square feet of roof area (total area ÷ 100)',
          'A single bundle of shingles',
          "10 feet by 10 feet of the roof's flat footprint only",
          'The area covered by one EagleView report',
        ],
        explanation:
          'A square is 100 square feet of roof area. You get the number of squares by dividing total roof area by 100.',
      },
      {
        id: 'c14_2',
        question: 'What is the standard waste factor on an estimate?',
        options: [
          '0–5%',
          '5–8%',
          '10–15%, depending on roof complexity',
          '20–25% on every roof',
        ],
        explanation:
          'Standard waste factor is 10–15%, with more cut-up (complex) roofs sitting toward the high end.',
      },
      {
        id: 'c14_3',
        question: 'On an insurance job, what is the 48-hour promise?',
        options: [
          'The adjuster must inspect within 48 hours',
          'The first insurance check arrives within 48 hours',
          'The homeowner must sign within 48 hours',
          'Turn the insurance summary into an estimate within 48 hours',
        ],
        explanation:
          'Once you have the 7–11 page insurance summary, the goal is to turn it into an estimate within 48 hours — fast turnaround keeps the job moving.',
      },
      {
        id: 'c14_4',
        question: "On an approved insurance job, what is the homeowner's only out-of-pocket cost?",
        options: [
          'The full retail price of the roof',
          'Their deductible (plus any rotted wood and upgrades they choose)',
          'Half of the total contract, split with insurance',
          'Nothing — RCRS covers the deductible',
        ],
        explanation:
          'The only out-of-pocket cost is the deductible, plus any rotted decking found on tear-off and any upgrades the homeowner chooses. The deductible is never waived by RCRS.',
      },
      {
        id: 'c14_5',
        question: 'Why does a steeper pitch cost more?',
        options: [
          'Steeper roofs need a bigger deductible',
          'Insurance always denies steep roofs',
          'It takes more material AND harder, more expensive labor',
          'The waste factor drops to zero on steep roofs',
        ],
        explanation:
          'A steeper pitch has more actual roof area than its footprint (more material) and the work is harder, slower, and pricier (more expensive labor).',
      },
    ],
  },

  // -------------------- sales_c15 --------------------
  {
    id: 'sales_c15',
    title: 'Special Roofs: Low Slope, Chimneys & Crickets',
    description:
      'The RCRS pitch cutoffs for when shingles stop and modified bitumen starts, what code and manufacturers require, when a chimney needs a cricket, and where Ice & Water Shield always goes.',
    icon: 'Layers',
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'The RCRS Cutoffs',
        media: {
          kind: 'audio',
          src: '/training-media/pitch-matching.mp3',
          title: 'Matching Roofing Material to Your Roof Pitch (5 min)',
        },
        content: [
          'Where the pitch drops, the rules change — put the wrong system on a low slope and it leaks. Know the RCRS cutoffs cold:',
          'Below 2/12 — NEVER shingle. Asphalt shingles do not belong on a slope under 2:12.',
          '2.9/12 pitch or less — the roof REQUIRES Modified Bitumen, not shingles.',
          '3/12 to 3.9/12 pitch — the roof REQUIRES Ice & Water Shield underlayment.',
          "The pitch decides the system — not the customer's budget. Low slopes drain slowly, which means water backup and ice-dam damage if you put the wrong material on.",
        ],
        proTips: [
          'Carry the three numbers as a ladder: under 2/12 = no shingles ever; 2.9/12 or less = Modified Bitumen; 3–3.9/12 = shingles but with Ice & Water Shield underlayment.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Flat & Low-Slope Roofs: RCRS Low-Slope Guidelines."',
      },
      {
        heading: 'What Code & Manufacturers Say',
        content: [
          'IRC R905.2.2: asphalt shingles are allowed only on slopes 2/12 and up. From 2/12 to 4/12, special underlayment is required (IRC R905.2.7).',
          'IKO (list first): never apply asphalt shingles to slopes less than 2:12.',
          'Owens Corning: shingles are OK on 2/12–4/12 only with special procedures, and never below 2/12.',
          'The RCRS cutoffs sit inside these code and manufacturer limits — they are the practical version of what the code and the manufacturers already require.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "What the codes & manufacturers say." IKO listed first per RCRS convention.',
      },
      {
        heading: 'Chimneys: Crickets & Flashing',
        image: {
          src: '/training/sales/handbook/hb-chimney-cricket-flashing.png',
          alt: 'Diagram of a chimney cricket/saddle plus correct step and counter (reglet) flashing on shingles.',
          caption: 'Chimney cricket + step/counter-flashing done right — the #1 leak point to check (RCRS handbook).',
        },
        content: [
          'A penetration is the #1 leak spot on a roof, and a chimney gets the full treatment.',
          'A cricket (saddle) is the peaked structure built behind the up-slope side of the chimney. It diverts water and debris around the chimney so nothing pools behind it.',
          'Code (IRC R1003.20): a cricket is required when the chimney is wider than 30 inches, measured across the slope.',
          'Flash it properly with step flashing plus counter flashing — never rely on caulk alone.',
        ],
        callout: {
          tone: 'info',
          title: 'The 30-inch rule',
          text: 'Chimney wider than 30" across the slope = a cricket, no exceptions (IRC R1003.20). Document it in your photos so the adjuster sees it belongs on the claim.',
        },
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Chimneys & Crickets: The rules."',
      },
      {
        heading: 'Where Ice & Water Shield Always Goes',
        content: [
          'Ice & Water Shield is the waterproofing membrane that goes at every vulnerable point on the roof.',
          'It always goes: around every chimney, in the valleys, under pipe boots, and at skylights (and flashings generally).',
          'On a low-slope 3/12–3.9/12 roof, Ice & Water Shield is required as the underlayment — see the RCRS cutoffs above.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Chimneys & Crickets" and "Flat & Low-Slope Roofs."',
      },
      {
        heading: 'Document It for the Adjuster',
        content: [
          'Special-roof items are money on the claim only if the adjuster sees them. Photograph the low-slope sections, the chimney and its width, the cricket (or the missing one), and every Ice & Water Shield location.',
          'When you walk the adjuster, point to each documented item so the low-slope material, the cricket, and the Ice & Water Shield all get scoped in. Missed detail = missed money for the homeowner and the job.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Do this: document it in your photos so the adjuster sees it," generalized to special-roof items.',
      },
    ],
    quiz: [
      {
        id: 'c15_1',
        question: 'Below what pitch can you NEVER use asphalt shingles?',
        options: [
          'Below 4/12',
          'Below 2/12',
          'Below 6/12',
          'Below 3/12',
        ],
        explanation:
          'Never shingle a slope under 2:12. Both the code (IRC R905.2.2) and the manufacturers (IKO, Owens Corning) draw the line at 2/12.',
      },
      {
        id: 'c15_2',
        question: 'What does RCRS require on a roof of 2.9/12 pitch or less?',
        options: [
          'Modified Bitumen (not shingles)',
          'Three-tab shingles with extra nails',
          'Ice & Water Shield under standard shingles',
          'A cricket behind every penetration',
        ],
        explanation:
          'At 2.9/12 or less, the RCRS rule is Modified Bitumen — shingles are not used on that low a slope.',
      },
      {
        id: 'c15_3',
        question: 'What does RCRS require on a 3/12–3.9/12 roof?',
        options: [
          'Modified Bitumen instead of shingles',
          'No underlayment at all',
          'A metal standing-seam system',
          'Ice & Water Shield underlayment',
        ],
        explanation:
          'On a 3/12–3.9/12 roof, shingles are allowed but RCRS requires Ice & Water Shield underlayment because the slope still drains slowly.',
      },
      {
        id: 'c15_4',
        question: 'Per code, when is a chimney cricket required?',
        options: [
          'On every chimney, regardless of size',
          'Only on two-story homes',
          'When the chimney is wider than 30 inches across the slope',
          'Only when the roof is steeper than 8/12',
        ],
        explanation:
          'IRC R1003.20 requires a cricket when the chimney is wider than 30 inches, measured across the slope.',
      },
      {
        id: 'c15_5',
        question: 'What does a cricket (saddle) do?',
        options: [
          'It seals the chimney flue against smoke',
          "It diverts water and debris around the up-slope side of the chimney so nothing pools behind it",
          'It replaces step and counter flashing',
          'It vents the attic through the chimney chase',
        ],
        explanation:
          "A cricket is the peaked structure behind the chimney's up-slope side that splits water and debris around the chimney so nothing pools and backs up behind it.",
      },
    ],
  },

  // -------------------- sales_b1 --------------------
  {
    id: 'sales_b1',
    title: 'Your Business: 1099, Rep LLCs & Getting Paid',
    description:
      'How pay works at RCRS: every rep is a 1099 contractor, rep LLCs are rep entities (not subcontractors), the 50% job-breakdown split, and keeping your credit clean in JobNimbus.',
    icon: 'Briefcase',
    estimatedMinutes: 12,
    passingScore: 80,
    sections: [
      {
        heading: 'All Reps Are 1099',
        content: [
          'Every RCRS sales rep is a 1099 independent contractor. You are in business for yourself, selling under the RCRS banner.',
          'QuickBooks (QB) is the source of truth for the actual 1099 commission cash paid to you — that is what shows on the Commission leaderboard.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "The LLC / Rep Entities"; QB commission-cash detail from RCRS portal training materials.',
      },
      {
        heading: 'Rep LLCs Are Rep Entities, NOT Subcontractors',
        content: [
          'Many reps operate under their own LLC. Examples: "BCM Contracting LLC" is Brendon Muse; Rudys and Roof Angel are also rep LLCs.',
          'KEY RULE: these LLCs are REP ENTITIES, not subcontractors. They are reps who happen to run their sales through an LLC — not outside crews hired to install.',
          'The LLC name is always credited back to the person behind it — "BCM Contracting LLC" credits to Brendon Muse — so the rep gets the right credit and commission. The system aliases the LLC to the person on the leaderboards.',
        ],
        callout: {
          tone: 'info',
          title: 'When you see an LLC on a job',
          text: 'It is a rep, not a subcontractor. Credit and commission flow to the person behind the LLC.',
        },
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "The LLC / Rep Entities"; leaderboard aliasing from RCRS portal training materials.',
      },
      {
        heading: 'The Job Breakdown & Your 50%',
        content: [
          'Every job is totaled in a Job Breakdown: material (at price), labor, overhead, and profit. Under the standard split, the rep earns 50% of the profit.',
          "You see your pay side — JobTotal, Overhead, JobCost, Deposit, Profit, RepPay, and the percentages. You do not see material cost or the company's internal splits; those are hidden by role.",
          'Cross-ref: the full seven-step flow that produces the breakdown is covered in "Spark to Cash: The Full Job Workflow."',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — workflow "rep\'s 50% pay"; breakdown line detail from RCRS portal training materials.',
      },
      {
        heading: 'Keeping Your Credit Clean in JobNimbus',
        content: [
          'Your credit is only as clean as your JobNimbus records. Log your door-knock activity so the lead credits YOU — and so routing puts the next lead in your area back in your hands.',
          'Create the contact and job while you are still on the roof, and update the pipeline status in real time as events happen. A job that is not entered, or entered late, is credit you may not get.',
          'Enter your weekly numbers accurately — that is how you show up on the board. Booked revenue (accrual) and cash paid (commission) are two different numbers; do not expect them to match.',
        ],
        sourceNote:
          'Source: RCRS Aug 13, 2026 weekly class — "Door Knocking" (log it so it credits YOU) and JN real-time updates; accrual-vs-commission from RCRS portal training materials.',
      },
    ],
    quiz: [
      {
        id: 'b1_1',
        question: 'Are rep LLCs (like BCM, Rudys, Roof Angel) subcontractors?',
        options: [
          'Yes — they are hired crews paid per job',
          'Yes — but only on insurance jobs',
          'It depends on the size of the job',
          'No — they are rep entities, not subcontractors',
        ],
        explanation:
          'Rep LLCs are REP ENTITIES, not subcontractors. They are reps running their sales through an LLC, and all reps are 1099.',
      },
      {
        id: 'b1_2',
        question: 'Who is "BCM Contracting LLC"?',
        options: [
          'An outside install subcontractor',
          'Brendon Muse',
          'A material vendor',
          'The company that owns RCRS',
        ],
        explanation:
          '"BCM Contracting LLC" is Brendon Muse — a rep operating under his own LLC, credited back to him personally.',
      },
      {
        id: 'b1_3',
        question: 'Why is the LLC name always credited back to the person?',
        options: [
          'So credit and commission flow to the rep behind the LLC',
          'So the LLC pays lower taxes',
          "So the office can hide the rep's numbers",
          'So the LLC ranks separately from the person on the leaderboard',
        ],
        explanation:
          'The LLC name is aliased back to the person so the credit and commission go to the right rep — the LLC and the person are the same for pay and ranking.',
      },
      {
        id: 'b1_4',
        question: 'What is the employment status of RCRS sales reps?',
        options: [
          'Salaried W-2 employees',
          'Hourly W-2 employees',
          'All reps are 1099 independent contractors',
          'Unpaid interns until their first close',
        ],
        explanation:
          'Every RCRS rep is a 1099 independent contractor, paid commission — with QuickBooks as the source of truth for the cash actually paid.',
      },
    ],
  },

  // -------------------- sales_p1 --------------------
  {
    id: 'sales_p1',
    title: 'The RCRS Portal',
    description:
      'A guided tour of the RCRS staff portal — a five-minute orientation, the full walkthrough, what lives in the portal vs. JobNimbus, and the daily habits that keep you on the board.',
    icon: 'MonitorSmartphone',
    estimatedMinutes: 20,
    passingScore: 80,
    sections: [
      {
        heading: 'Five-Minute Orientation',
        media: {
          kind: 'video',
          src: '/training-media/portal-short.mp4',
          title: 'RCRS Portal — 5-minute orientation',
        },
        content: [
          'The RCRS portal is the company command center — the private staff site at rcrsal.com. (The public site, rivercityroofingsolutions.com, is separate; never mix the two.)',
          'You sign in with your email and password, are forced to change your password on first login, and then take a short welcome tour tailored to your role — a rep sees sales tools, a driver sees the delivery board.',
          'Your home base as a rep is the sales cockpit: your assigned leads, your customers, your stats, the leaderboards, training, and your weekly numbers.',
          'A money rule baked into the portal: reps see inventory QUANTITIES only — never price or cost. The system redacts sensitive numbers by role automatically.',
        ],
        sourceNote:
          'Source: RCRS Portal Training Source — Modules 1 & 3, and the role-based access rules in Part 2.',
      },
      {
        heading: 'The Full Walkthrough',
        media: {
          kind: 'video',
          src: '/training-media/portal-walkthrough.mp4',
          title: 'RCRS Portal — full walkthrough',
        },
        content: [
          "The full walkthrough covers the pages you touch as a rep: your dashboard, your leads (work them top to bottom), each customer's file, your commission tracking (your numbers only), the leaderboards, your performance stats, and your weekly-numbers submission.",
          'Your weekly numbers use the language of the Monday meeting: Inspected, Damage, Signed, Repair, Gutter, $$$$$ (revenue accrual), Approved, Goal, Referrals, Agents, Present, and Home Show. What you enter flows straight into the Monday meeting deck.',
          'RCRS runs THREE separate leaderboards that measure different things and are never combined: Commission (real QuickBooks cash), Sales (the $$$$$ accrual you booked), and Weekly (what you self-reported). The same rep shows different numbers on each — and that is correct.',
          'Other portal areas you will meet: the customer welcome portal (built for each customer), reviews and referrals, training, and — for other roles — inventory, delivery, and the Command Center.',
        ],
        sourceNote:
          'Source: RCRS Portal Training Source — Modules 3 & 4 (sales cockpit, weekly numbers, the three leaderboards).',
      },
      {
        heading: 'Portal vs. JobNimbus — What Lives Where',
        content: [
          'JobNimbus (JN) is the live CRM and invoicing sync — it holds contacts, jobs, the pipeline, photos, notes, and estimates. It is where you enter and move the job itself.',
          'The RCRS portal is the command center layered on top — leaderboards, weekly numbers, training, the customer welcome portal, inventory and delivery, and analytics. It is where the job becomes tracked, coachable activity.',
          'Underneath both sit the three data pillars: Google Sheets (master store), JobNimbus (live CRM + invoicing), and QuickBooks (actual commission cash). Sheets + JN + QB.',
          'Estimates are built in the portal / JobNimbus from an EagleView measurement report — the roof-measure and estimate tools live in the portal, syncing with JN.',
        ],
        callout: {
          tone: 'info',
          title: 'Two systems, one job',
          text: 'Enter and move the job in JobNimbus; track your numbers, ranking, and training in the portal. Keep them in sync by updating JN in real time.',
        },
        sourceNote:
          'Source: RCRS Portal Training Source — Part 1 (Sheets + JN + QB) and Module 19 (estimates/roof-measure).',
      },
      {
        heading: 'Daily Habits: Check This Every Morning',
        content: [
          'First thing every morning, check your assigned leads (/portal/sales/leads) and work them top to bottom. Speed matters — first contact on a new lead in under 5 minutes.',
          'Glance at the leaderboards to see where you stand, and keep your customer files and JobNimbus statuses current so the office and crew are never guessing.',
          'End the week by logging your weekly numbers (accurately — that is how you land on the Monday board) and requesting reviews from recent customers.',
        ],
        proTips: [
          'Logging "Present = yes" and beating your Goal is how you open the Monday meeting deck as a top name — the numbers you enter are the numbers on the wall.',
        ],
        sourceNote:
          'Source: RCRS Portal Training Source — Module 3 and the "Sales Rep\'s Day" scenario in Part 5; morning-habit ordering generalized from the source.',
      },
    ],
    quiz: [
      {
        id: 'p1_1',
        question: 'Where are estimates built?',
        options: [
          'Only inside QuickBooks',
          'On the public rivercityroofingsolutions.com site',
          'In the RCRS portal / JobNimbus, from an EagleView measurement report',
          'In the customer welcome portal',
        ],
        explanation:
          'Estimates are built in the RCRS portal / JobNimbus, working from an EagleView measurement report — the roof-measure and estimate tools live in the portal and sync with JN.',
      },
      {
        id: 'p1_2',
        question: 'What is the difference between the portal and JobNimbus?',
        options: [
          'JobNimbus is the live CRM/invoicing (contacts, jobs, pipeline); the portal is the command center (leaderboards, weekly numbers, training, inventory)',
          'They are the same system with two names',
          'The portal holds contacts and jobs; JobNimbus only shows the leaderboards',
          'JobNimbus is the public website; the portal is QuickBooks',
        ],
        explanation:
          'JobNimbus is the live CRM and invoicing sync where the job itself lives; the RCRS portal is the command center on top — leaderboards, weekly numbers, training, the customer portal, inventory, and analytics.',
      },
      {
        id: 'p1_3',
        question: 'Where is your training progress tracked?',
        options: [
          'In JobNimbus notes',
          'On the Sales leaderboard',
          'In QuickBooks',
          "In the portal's Training Center",
        ],
        explanation:
          'Training — including this module — lives in the portal\'s Training Center, with role-specific lessons so you learn what your role needs.',
      },
      {
        id: 'p1_4',
        question: 'What is a good daily habit first thing every morning?',
        options: [
          'Rebuild every estimate from scratch',
          'Check your assigned leads and work them top to bottom (first contact under 5 minutes)',
          'Reset the three leaderboards',
          'Email the office for your commission total',
        ],
        explanation:
          'Start each morning by checking your assigned leads and working them top to bottom — with first contact on a new lead in under 5 minutes.',
      },
    ],
  },

  // -------------------- sales_r1 --------------------
  {
    id: 'sales_r1',
    title: 'The Closing Presentation: Proof Stack & the Retail Close',
    description:
      "The retail closing presentation — building the proof stack (IKO first), saying 'how we do the work' out loud, holding value ahead of price, running the retail close with Good/Better/Best and financing, and walking the folder page by page.",
    icon: 'Presentation',
    estimatedMinutes: 20,
    passingScore: 80,
    sections: [
      {
        heading: 'The Proof Stack',
        content: [
          "The close doesn't reveal the price — it earns it. Before a number ever comes up, you stack proof so the price lands on a foundation of trust. Build it in this order.",
          'IKO ROOFPRO Craftsman Premier certification FIRST — the highest IKO contractor tier and the warranty that outlives the job. This is the anchor of the whole stack; lead with it.',
          'Warranties — the manufacturer (IKO) warranty plus RCRS workmanship. Anchor the system to what stays covered long after the crew leaves.',
          'Licenses & insurance — you are licensed and insured; that protects the homeowner, not just you.',
          'Nearby jobs — recent roofs you have done in their area or neighborhood. Proximity beats a brochure.',
          'Reviews — Google and BBB (RCRS holds a BBB A+). Reviews are where a local company is most beatable, so put your best social proof in front of them here.',
          'About-me — a short, human line on who you are and why they can trust you on their roof. People buy the rep before they buy the roof.',
        ],
        proTips: [
          'Always name IKO first when certs or products come up — it is the strongest single credential you carry.',
          'Recap what you found with photos before anything else — re-live the problem on their roof, then show them the drone shots and report.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Here's who we are before we ever talk price — River City Roofing Solutions is an IKO ROOFPRO Craftsman Premier contractor, we're licensed and insured, and here are roofs we just finished right here in your neighborhood. Let me show you what your neighbors are saying.",
            context: 'Building the proof stack, IKO first (Close to Referral deck, slides 2 & 7; adapted).',
          },
        ],
        sourceNote:
          "The deck lists the closing order (recap → show roof → present system → anchor to IKO ROOFPRO Craftsman Premier warranty → investment → ask) and names IKO ROOFPRO, licenses/insurance, warranties, and Google reviews in the folder/close slides. 'About-me,' 'nearby jobs,' and BBB are standard proof-stack elements and the RCRS BBB A+ fact, added as field-practical structure rather than verbatim deck items.",
      },
      {
        heading: '"How We Do the Work" — Say It Out Loud',
        content: [
          "Homeowners can't see craftsmanship on a proposal — so name it. Walk them through exactly how RCRS does the job, out loud, before you talk price. This is proof you can describe.",
          'We haul debris on our own trailer — never a roll-off container dropped in your driveway for days.',
          'We tarp to protect the property — landscaping, AC unit, pool, and structures get covered before a shingle comes off.',
          'We do a full tear-off down to the deck, then inspect the decking — we never roof over old layers, and we catch rotted wood.',
          'We put Ice & Water Shield in the vulnerable spots — valleys, around chimneys, and at pipe boots.',
          'We use silicone bullet boots on the pipe penetrations — not the old lead boots that crack and leak.',
          'We clean up with magnets and rakes — magnet sweeps and hand-raking the whole yard, drive, and both sides of the fence for nails.',
        ],
        callout: {
          tone: 'info',
          title: 'Why say it out loud',
          text: "Every one of these is a reason your price is higher than the cheap quote. If you don't say it, the homeowner assumes every roofer does it — and you just became the expensive one for no reason.",
        },
        sourceNote:
          "The deck's install-day and walkaround slides reference tarps, full tear-off to the deck, deck inspection, ice-and-water dry-in, pipe boots, the trailer to haul, and the magnet sweep. 'No roll-off containers,' 'silicone bullet boots,' Ice & Water specifically in valleys/chimneys/boots, and 'rakes' are the RCRS how-we-work commitments, added here so the rep says all of them out loud.",
      },
      {
        heading: 'Value Before Price at the Kitchen Table',
        content: [
          "The close doesn't reveal the price — it earns it. Recap the problem, show them their roof, present the system (not just a shingle), and anchor to the IKO ROOFPRO Craftsman Premier warranty. Only then does the investment come out.",
          "By the time you say a number, they should already believe the roof is worth it — the price is a confirmation, not a reveal.",
          'For the full seating, insurance-goggles framing, and how to run the table, see the "Kitchen Table & Insurance Goggles" module — the same discipline of value before price applies whether the job is retail or insurance.',
        ],
        proTips: [
          'Present in person. The folder, photos, samples, and the handshake do not travel over email.',
          'All decision-makers present, every time — confirm it when you book the appointment and again the day before. "Let me talk to my wife" is a sit-down you never should have taken.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Present the whole system, not just a shingle — then anchor it to the Craftsman Premier warranty so they feel covered long after the job's done. The price comes after that, paired with the monthly payment, never before.",
            context: 'Value-before-price sequence (Close to Referral deck, slides 2–3; adapted).',
          },
        ],
      },
      {
        heading: 'The Retail Close — No Insurance Involved',
        content: [
          'On a retail job there is no adjuster and no claim — the homeowner is paying, so the close is about the system and the payment, not an approval.',
          'Present Good / Better / Best — give them a clear ladder of options and spend the most time on the middle (the primary IKO Dynasty system most homeowners land on).',
          'Pair the total with financing every time — "here\'s the investment, and here\'s the monthly payment." The monthly number is what makes a big total feel doable.',
          'Handle the three you will hear: "It\'s a lot of money" → cost-of-waiting plus the monthly payment; "We want other quotes" → compare the whole system and who holds the warranty, then hand them the folder; "We need to think about it" → "Is it the timing, the investment, or the roof itself?" then let silence work.',
          'Ask for the business with an assumptive close — then go quiet. The first person to talk owns the next move; let it be them.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "With our Craftsman Premier warranty you're covered long after the job's done, and we can start next week. Do you want the standard architectural, or the upgraded system I showed you?",
            context: 'Verbatim assumptive close (Close to Referral deck, slide 4).',
          },
        ],
        callout: {
          tone: 'info',
          title: 'What makes the retail close different',
          text: 'No insurance means no deductible and no adjuster gating the decision — the homeowner is buying outright. That is why financing and Good/Better/Best carry the retail close, where an approval carries the insurance path.',
        },
        sourceNote:
          "The Good/Better/Best ladder and IKO Dynasty as the primary/middle option come from the RCRS product structure (see 'Product Knowledge: The IKO Line'); the deck supplies the objections, the assumptive close, and the total-paired-with-financing move.",
      },
      {
        heading: 'The Folder, Page by Page',
        content: [
          "Don't hand the folder over and let them flip through it later — walk them through it, page by page, while you are sitting there.",
          'Signed agreement & scope — what they bought, in writing.',
          'Warranty & certification — IKO ROOFPRO plus RCRS workmanship.',
          'The roofing checklist — every quality step on their roof. This is the spine of the job: read it out loud WITH them so they hear each commitment. Same document used twice — expectation-setter at signing, inspection script at the walkaround.',
          'What-to-expect / prep sheet — noise, timeline, cars out.',
          'Care & maintenance plus contacts.',
          'Review & referral card — plant the seed now.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "At the end of install day, we'll walk this exact list together — before you pay a dime.",
            context: 'Pre-framing the walkaround off the folder checklist (Close to Referral deck, slide 8).',
          },
        ],
        callout: {
          tone: 'info',
          title: 'The folder principle',
          text: "Walking each page turns a stack of paper into a guided commitment — they hear every quality step in your voice, and the checklist becomes the script you'll both use at the walkaround.",
        },
      },
    ],
    quiz: [
      {
        id: 'r1_1',
        question: 'In the closing presentation, when should the price come out?',
        options: [
          'First, so the homeowner knows what they are dealing with up front',
          'After you recap the problem, show them the roof, present the system, and anchor to the warranty',
          'Only after they have gotten two competing quotes',
          'Right after the about-me, before anything else in the proof stack',
        ],
        explanation:
          "The close doesn't reveal the price — it earns it. You recap the problem, show them their roof, present the system, and anchor to the IKO ROOFPRO Craftsman Premier warranty, and only then present the investment paired with financing.",
      },
      {
        id: 'r1_2',
        question: 'Which credential should you lead with in the proof stack?',
        options: [
          'Your general liability insurance certificate',
          'The number of roofs you have done this month',
          'IKO ROOFPRO Craftsman Premier certification',
          'Your Google review count',
        ],
        explanation:
          'IKO is always named first when certs or products come up. IKO ROOFPRO Craftsman Premier is the highest IKO contractor tier and the anchor of the proof stack.',
      },
      {
        id: 'r1_3',
        question: 'How does RCRS haul debris off the job, and how should you say it out loud?',
        options: [
          'A roll-off dumpster dropped in the driveway for the duration of the job',
          'On our own trailer — never a roll-off container sitting in your driveway',
          'The crew bags it and the homeowner sets it out with the trash',
          'A subcontracted junk-removal service after the job closes',
        ],
        explanation:
          'RCRS hauls on its own trailer and uses no roll-off containers. Saying it out loud is part of the how-we-do-the-work proof — it is a reason your price is higher than the cheap quote.',
      },
      {
        id: 'r1_4',
        question: 'What makes the retail close different from the insurance path?',
        options: [
          'The homeowner is buying outright — no adjuster or deductible gates the decision, so financing and Good/Better/Best carry the close',
          'You can waive the deductible to win the job',
          'You skip the warranty because retail roofs are not covered',
          'You do not need all decision-makers present for a retail sale',
        ],
        explanation:
          'Retail has no insurance claim and no adjuster, so there is no approval or deductible driving it. The homeowner pays outright, which is why Good/Better/Best and financing carry the retail close. (The deductible is never waived on any path.)',
      },
      {
        id: 'r1_5',
        question: 'What is the right way to use the homeowner folder at the close?',
        options: [
          'Hand it over and let them read it after you leave',
          'Email a PDF of it so they have a copy on file',
          'Walk them through it page by page while you are sitting with them',
          'Give it to them only after they sign, so it does not distract from the price',
        ],
        explanation:
          "Don't hand it over — walk them through it page by page. Reading the roofing checklist out loud WITH them turns paper into a guided commitment and pre-frames the walkaround.",
      },
    ],
  },

  // -------------------- sales_r2 --------------------
  {
    id: 'sales_r2',
    title: 'Gutters, LeafX & Add-On Estimating',
    description:
      "Why a roof replacement is the best time to sell gutters and LeafX gutter guard, how to measure and estimate them on-site (linear feet, size, downspouts), the LeafX pitch, and how to add the upsell to the estimate and JobNimbus.",
    icon: 'Droplets',
    estimatedMinutes: 12,
    passingScore: 80,
    sections: [
      {
        heading: 'Why Roof Time Is Gutter Time',
        content: [
          'A new roof is the best time to sell gutters and gutter protection. New shingles draining into 20-year-old gutters is a callback waiting to happen.',
          'Bundle it — one trip, one crew, one invoice. That is cheaper and cleaner for the homeowner than calling a gutter company out separately later.',
          "The crew is already on site with ladders up and the roof torn off. This is the one moment when adding gutters and LeafX is cheap to do — and it protects the roof they just invested in.",
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "While the crew's already here, this is the one time it's cheap to do the gutters and put LeafX on them — and it protects the roof you just invested in.",
            context: 'Verbatim add-on tie-in (Close to Referral deck, slide 5).',
          },
        ],
      },
      {
        heading: 'Measuring & Estimating Gutters',
        content: [
          'Measure it right, on-site — never quote gutters or LeafX from memory.',
          'Total linear feet of gutter — walk the eaves or pull the aerial measurement.',
          'Gutter size — 5" vs 6" changes both the gutter price and the guard price.',
          'Downspouts — count them and note any two-story runs.',
          'Fascia / soffit rot — flag it now, not later as a change order.',
        ],
        callout: {
          tone: 'warning',
          title: 'Price from the sheet, not from memory',
          text: 'Pull the per-linear-foot numbers from the current price sheet for both gutter and LeafX. A wrong measurement or a guessed number comes straight out of your margin.',
        },
        sourceNote:
          "The deck says to price gutter and LeafX per LF from the current price sheet but does not print the actual numbers. Rep should always pull live per-LF pricing rather than any figure quoted here.",
      },
      {
        heading: 'The LeafX Pitch',
        content: [
          'LeafX is the gutter-guard upsell — the gutter protection RCRS installs. Sell the outcome, not the product: never clean your gutters again.',
          "LeafX is priced per linear foot and can be a subset of the total gutter run — for example, only the tree side of the house where leaves actually fall.",
          'Frame it as protecting the roof investment: clean, free-flowing gutters keep water moving away from the fascia, soffit, and foundation instead of backing up under the new roof edge.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "You don't ever want to be up on a ladder cleaning these out again — that's what LeafX does. And it keeps the water moving off the roof you just paid for instead of sitting in a clogged gutter.",
            context: 'The LeafX outcome pitch (Close to Referral deck, slides 5–6; adapted).',
          },
        ],
      },
      {
        heading: 'Adding It to the Estimate & JN',
        content: [
          'Add the gutter and LeafX line items to the same estimate as the roof — one invoice, not a separate quote the homeowner has to think about twice.',
          'Enter it into JobNimbus (JN) against the same job so the add-on is tracked with the roof, not floating loose.',
          'Because gutter and LeafX are priced per linear foot, the estimate is only as accurate as your on-site measurement — get the LF right and the numbers off the price sheet before it goes in.',
        ],
        sourceNote:
          "The deck covers measuring and pricing gutter/LeafX and bundling it into 'one invoice'; recording it in JobNimbus against the same job is the standard RCRS estimate workflow, added here for practice.",
      },
    ],
    quiz: [
      {
        id: 'r2_1',
        question: 'When is the best time to sell gutters and LeafX?',
        options: [
          'On a separate follow-up visit a few weeks after the roof is done',
          'During the roof replacement, while the crew is already on site',
          'Only if the homeowner brings up their gutters first',
          'After the first heavy rain, once they see the gutters overflow',
        ],
        explanation:
          "A new roof is the best time to sell gutters and protection. The crew is already there with ladders up, so it's cheap to do, it's one trip and one invoice, and it protects the roof they just bought.",
      },
      {
        id: 'r2_2',
        question: 'How are gutters and LeafX measured and priced?',
        options: [
          'By the number of downspouts alone',
          'A flat rate per house regardless of size',
          'By total linear feet, with gutter size (5" vs 6") also affecting the price',
          'By the square footage of the roof',
        ],
        explanation:
          'Gutters and LeafX are estimated by total linear feet, and the gutter size (5" vs 6") changes both gutter and guard pricing. Pull the per-LF numbers from the current price sheet, not from memory.',
      },
      {
        id: 'r2_3',
        question: 'What does LeafX do, and how should you pitch it?',
        options: [
          'It replaces the gutters entirely — pitch it as a cheaper gutter',
          'It is a gutter guard — sell the outcome: never clean your gutters again',
          'It is a roof underlayment — pitch it as leak protection under the shingles',
          'It seals the roof deck — pitch it as ice-and-water protection',
        ],
        explanation:
          'LeafX is the gutter-guard system. Sell the outcome, not the product — never clean your gutters again — and tie it to protecting the roof they just invested in. It is priced per linear foot and can cover just part of the run (e.g., the tree side).',
      },
      {
        id: 'r2_4',
        question: 'Where does the gutter/LeafX add-on go?',
        options: [
          'On a separate standalone quote handled by a gutter company',
          'On the same estimate and job in JobNimbus as the roof — one invoice',
          'It is a handshake add-on that does not need to be written down',
          'Billed later, only after the roof balance is collected',
        ],
        explanation:
          'Add the gutter and LeafX line items to the same estimate and enter them in JobNimbus against the same job — one crew, one trip, one invoice, tracked with the roof.',
      },
    ],
  },

  // -------------------- sales_r3 --------------------
  {
    id: 'sales_r3',
    title: 'Install Day: Be There at the Start',
    description:
      "Being on-site when the crew arrives — prepping the homeowner (cars out, pets, wall hangings), walking the protection plan (tarps, flower beds, AC), handling the rotted-decking conversation honestly, and staying reachable all day.",
    icon: 'HardHat',
    estimatedMinutes: 15,
    passingScore: 80,
    sections: [
      {
        heading: 'Pre-Install: Prepping the Homeowner',
        content: [
          'The homeowner bought YOU. Be there at the start of install day — this is where your sale becomes a real, well-run job in their eyes.',
          'Prep the homeowner before the crew starts: cars out of the driveway and garage so the crew can stage materials and haul debris.',
          'Furniture moved and pets secured inside — a tear-off is loud and the yard is a work zone.',
          'Wall hangings down — pictures and shelves can rattle off the wall from the pounding of a tear-off. Have them come down the night before or first thing.',
          'Kids clear of the work area, and set the expectation: "It\'ll be loud, that\'s normal, we\'ll be done in a day, and I\'ll be back to walk it with you."',
        ],
        proTips: [
          'Arrive at material drop / crew arrival so you can introduce the crew to the homeowner and confirm the scope in person.',
          'Set the noise-and-timeline expectation up front — a homeowner who was warned it would be loud is calm; one who was surprised is calling the office.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "It's going to be loud today — that's completely normal, it means they're working. We'll be done in a day, and I'll be back at the end to walk the whole roof with you before you pay anything.",
            context: 'Setting install-day expectations (Close to Referral deck, slide 9).',
          },
        ],
      },
      {
        heading: 'Morning Of: Meet the Crew, Walk the Protection Plan',
        content: [
          'Introduce the crew to the homeowner and confirm the scope out loud so everyone is working from the same job.',
          'Walk the protection plan with the homeowner so they see it, not just hear about it: tarps over landscaping and flower beds, the AC unit covered, and the pool covered.',
          'RCRS tarps to protect the property — that is a commitment you made at the close, so show it happening. Flower beds and shrubs get covered before the first shingle comes off.',
          'Point out where materials will be staged and where debris will land, so nothing surprises the homeowner mid-day.',
        ],
        callout: {
          tone: 'info',
          title: "Show the protection, don't just promise it",
          text: 'Watching their flower beds get tarped and their AC covered is the moment the homeowner relaxes. It is also proof of the how-we-do-the-work commitments you sold them.',
        },
      },
      {
        heading: 'Tear-Off & Decking: The Rotted-Wood Conversation',
        content: [
          'RCRS does a full tear-off down to the deck, then inspects the decking. When you take off old shingles, you sometimes find rotted or damaged wood underneath that has to be replaced.',
          'Decking is the honesty moment. Communicate bad decking AND the price BEFORE it is replaced — never let it show up as a surprise on the final invoice.',
          "Frame it plainly: the wood is bad, here is what it costs to make it right, and we don't put a new roof over rotten decking. Surprises on the invoice kill referrals.",
          'This is exactly why you set the expectation at the close and in the folder — so when it happens, it is a confirmation of your honesty, not a shock.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "We pulled the old shingles and there's some rotted decking right here — I want you to see it. We can't put a new roof over bad wood, so here's what it costs to replace it. I wanted to tell you before we did it, not put it on the invoice as a surprise.",
            context: 'The rotted-decking honesty moment (Close to Referral deck, slide 10; adapted).',
          },
        ],
        callout: {
          tone: 'warning',
          title: 'Price before replacement',
          text: 'Get the homeowner to agree to the decking cost BEFORE the crew replaces it. Bad decking discovered and communicated is trust earned; bad decking discovered on the invoice is a referral lost.',
        },
      },
      {
        heading: 'Staying Reachable All Day',
        content: [
          "You don't have to stand on the roof all day, but the homeowner needs to be able to reach you all day. You are their point of contact, not the crew.",
          'Check in through the day and be reachable by phone for any question that comes up — a homeowner who can reach you stays calm.',
          'Schedule your day so you can be back on-site as the job wraps for the end-of-day walkaround — while the crew is still there. (That walkaround is its own module: "The Walkaround, Reworks & Final Payment.")',
        ],
        sourceNote:
          "The deck emphasizes arriving at the start and being present to walk the job at the end; 'reachable all day as the homeowner's point of contact' is field-practical guidance filling the gap between those two on-site moments.",
      },
    ],
    quiz: [
      {
        id: 'r3_1',
        question: 'Why should the rep be on-site when the crew arrives on install day?',
        options: [
          'To supervise the crew because they cannot be trusted to work alone',
          'Because the homeowner bought YOU — being there turns the sale into a well-run job in their eyes',
          'Because RCRS requires two people to carry materials up the ladder',
          'Only to collect the final payment before work starts',
        ],
        explanation:
          'The homeowner bought the rep. Being there at the start lets you introduce the crew, confirm scope, walk the protection plan, and set expectations — it is where your sale becomes a real, trusted job.',
      },
      {
        id: 'r3_2',
        question: 'Which of these is a homeowner-prep item for install day?',
        options: [
          'Have the homeowner climb up and help tear off the old shingles',
          'Take wall hangings down so the pounding of the tear-off does not knock them off the wall',
          'Have the homeowner leave the property for the entire week',
          'Ask the homeowner to rent a dumpster in advance',
        ],
        explanation:
          'Prep includes cars out, pets secured, kids clear, and wall hangings down — a tear-off pounds hard enough to rattle pictures off the wall. (RCRS hauls on its own trailer, so no dumpster is needed.)',
      },
      {
        id: 'r3_3',
        question: 'When you find rotted decking during tear-off, what do you do?',
        options: [
          'Replace it quietly and add the cost to the final invoice',
          'Roof over it to keep the job on schedule',
          'Show the homeowner and get agreement on the price BEFORE it is replaced',
          'Leave it and note it in the warranty paperwork',
        ],
        explanation:
          'Decking is the honesty moment. RCRS never roofs over bad wood — communicate the rotted decking and its price before replacing it. Surprises on the invoice kill referrals.',
      },
      {
        id: 'r3_4',
        question: 'Which is a property-protection step you walk with the homeowner?',
        options: [
          'Tarping the landscaping and flower beds and covering the AC unit',
          "Moving the homeowner's car to a neighbor's driveway",
          'Shutting off the water to the house for the day',
          'Removing the gutters before the tear-off begins',
        ],
        explanation:
          'RCRS tarps to protect the property. Walk the protection plan with the homeowner — tarps over landscaping and flower beds, AC covered, pool covered — so they see the commitment happening, not just hear about it.',
      },
    ],
  },

  // -------------------- sales_r4 --------------------
  {
    id: 'sales_r4',
    title: 'The Walkaround, Reworks & Final Payment',
    description:
      "The end-of-day walkaround done while the crew is still on-site, turning a punch list into a same-day rework logged against the SAME JobNimbus job with dated notes and before/after photos, collecting final payment on the spot, and getting customer acceptance plus the review.",
    icon: 'ClipboardList',
    estimatedMinutes: 18,
    passingScore: 80,
    sections: [
      {
        heading: 'The End-of-Day Walkaround — While the Crew Is Still There',
        content: [
          'Do the walkaround while the roofers are STILL on the job. That is the whole lesson.',
          'Crew still on site = same-day fix. Crew gone = a second trip, a frustrated customer, and delayed payment. Schedule your day to be on-site as the job wraps.',
          'Walk it WITH the homeowner, checklist in hand — the same roofing checklist you read out loud at the close. Same document, used twice: expectation-setter at signing, inspection script now.',
          'Check the whole list: magnet sweep of the whole yard/drive/beds/both fence sides; gutters cleared of debris and granules; ground and roof clear with the trailer ready to haul; flashing, pipe boots, and valleys sealed; ridge vent/cap straight and complete; drip edge and lines straight from the ground; landscaping/AC/structures undamaged; and the homeowner has seen it and is happy.',
          'Point out quality as you walk, not just problems. Anything they spot — get the crew on it right now, while they are still there.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Before the guys pack up, let's walk the whole roof together off this same checklist we went through at the start. Anything you want a second look at, I'll have them fix it right now while they're still here.",
            context: 'Walking the job with the crew still on-site (Close to Referral deck, slides 11–12; adapted).',
          },
        ],
        callout: {
          tone: 'warning',
          title: 'Timing is the whole lesson',
          text: 'The single most important thing about the walkaround is WHEN it happens: while the crew is still on the job. A crew that is gone turns a five-minute fix into a second trip and a delayed check.',
        },
      },
      {
        heading: 'Punch List → Rework',
        content: [
          'Anything the walkaround turns up becomes a punch-list item — and every rework is logged against the SAME job in JobNimbus. Never open a new job for a fix on an existing roof.',
          'Log it with dated notes and before/after photos — what was wrong, when it was addressed, and proof it was made right.',
          'The best rework is the one the crew handles on the spot, before they leave. Log it anyway — the job record should show the fix even when it took five minutes.',
          "Untracked rework is a profit leak. A fix that never gets logged against the job still costs labor and material, but disappears from the job's numbers — so the breakdown looks more profitable than the job really was.",
        ],
        callout: {
          tone: 'warning',
          title: 'Same job, never a new one',
          text: 'A rework logged as its own job breaks the job breakdown — the original job looks cleaner than it was and the rework looks like new work. One job, dated notes, before/after photos.',
        },
        sourceNote:
          "The deck covers the walkaround and same-day fixes; logging every rework against the SAME JobNimbus job with dated notes and before/after photos — and the 'untracked rework = profit leak' rationale — is the RCRS job-breakdown/profit practice, added here as the operational rule.",
      },
      {
        heading: 'Collecting Final Payment on the Spot',
        content: [
          'Payment follows acceptance — collect the balance while you are standing there, after the homeowner has walked the roof and confirmed they are happy.',
          'Know their method before you arrive — check, card, or financing draw — so there is no fumbling at the end.',
          'Tie payment to the completion form — sign-off and settle in the same sit-down.',
          "Don't leave the job open — a finished roof with an uncollected balance is an unfinished job.",
          'Ask without flinching. You did the work, they are happy, and the balance is simply the next step.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Everything's done and you're happy — let's take care of the balance and I'll finalize your completion paperwork and warranty. Check today, or on the card?",
            context: 'Verbatim payment ask (Close to Referral deck, slide 13).',
          },
        ],
      },
      {
        heading: 'Customer Acceptance & the Review Request',
        content: [
          'Get the acceptance / completion form signed — it protects the customer, the company, and the warranty. Payment and acceptance happen together in the same sit-down.',
          "Then ask for the Google review out loud — reviews are where a local company is most beatable, and peak happiness is right now.",
          "Make it effortless: pull the review up on their phone for them right there. A review you make them find later is a review that never gets written.",
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "One thing that genuinely helps a local company — would you take 60 seconds for a Google review while it's fresh? Here, I'll pull it up right now.",
            context: 'Verbatim review ask (Close to Referral deck, slide 14).',
          },
        ],
        callout: {
          tone: 'info',
          title: 'Acceptance, then payment, then review',
          text: 'The sequence is one sit-down: sign the completion/acceptance form, settle the balance, and get the review while they are at peak happiness. (Referrals come next — see the "Referrals" module.)',
        },
      },
    ],
    quiz: [
      {
        id: 'r4_1',
        question: 'When should the end-of-day walkaround happen?',
        options: [
          'The next morning, after the homeowner has slept on it',
          'While the roofers are still on the job',
          'A week later, once the roof has settled',
          'Only if the homeowner requests one',
        ],
        explanation:
          'Do the walkaround while the crew is still on-site — that is the whole lesson. Crew still there means a same-day fix; crew gone means a second trip, a frustrated customer, and delayed payment.',
      },
      {
        id: 'r4_2',
        question: 'Where is a rework logged?',
        options: [
          'As a brand-new job in JobNimbus so it can be tracked separately',
          'Against the SAME job in JobNimbus — never a new one',
          'On a paper punch list that stays with the crew',
          'It does not need logging if the crew fixes it before leaving',
        ],
        explanation:
          'Every rework is logged against the same job in JobNimbus, never a new one. A rework opened as its own job breaks the job breakdown — the original looks cleaner than it was and the fix looks like new work.',
      },
      {
        id: 'r4_3',
        question: 'What does a logged rework need to include?',
        options: [
          'Just a note that a fix happened',
          'Dated notes and before/after photos',
          'A new invoice sent to the homeowner',
          'A separate warranty document',
        ],
        explanation:
          'Log every rework with dated notes and before/after photos — what was wrong, when it was addressed, and proof it was made right — all against the same job.',
      },
      {
        id: 'r4_4',
        question: 'Why must reworks be tracked?',
        options: [
          'To bill the homeowner for the extra visit',
          'Because untracked rework is a profit leak — the cost disappears from the job while still consuming labor and material',
          'Because JobNimbus deletes jobs with no recent activity',
          'To decide whether to fire the crew that did the work',
        ],
        explanation:
          "Untracked rework still costs labor and material but vanishes from the job's numbers, so the breakdown looks more profitable than the job really was. Tracking it against the same job keeps the profit picture honest.",
      },
      {
        id: 'r4_5',
        question: 'What is the relationship between customer acceptance and final payment?',
        options: [
          'Payment is collected up front, before the homeowner accepts the roof',
          'Payment follows acceptance — collect the balance after they walk the roof and confirm they are happy',
          'Payment and acceptance are handled on separate visits',
          'Acceptance is optional as long as payment clears',
        ],
        explanation:
          'Payment follows acceptance. The homeowner walks the roof, confirms they are happy, signs the completion/acceptance form, and settles the balance — all in the same sit-down. A finished roof with an uncollected balance is an unfinished job.',
      },
    ],
  },

  // -------------------- sales_r5 --------------------
  {
    id: 'sales_r5',
    title: 'Referrals: Peak Happiness Is Right Now',
    description:
      "Asking for referrals at the moment of peak happiness — the specific referral ask and script, handing over referral cards, recording referrals in JobNimbus, and how the yard sign and a fresh clean roof turn the neighborhood into leads.",
    icon: 'Share2',
    estimatedMinutes: 10,
    passingScore: 80,
    sections: [
      {
        heading: 'Why Now — Peak Happiness',
        content: [
          "Peak happiness is right now. The roof is done, it looks great, they just walked it and they are thrilled — that is the single best moment to ask for referrals, reviews, and the yard sign.",
          'The sale does not end at payment. It ends at the referral. Payment closes one job; a referral opens the next three.',
          'Wait a week and the glow fades, life moves on, and the ask gets awkward. Ask while the emotion is high and you are standing on a fresh, clean roof.',
        ],
        callout: {
          tone: 'info',
          title: 'The sale ends at the referral',
          text: "Collecting the check feels like the finish line, but the job is not fully worked until you have asked for the review, the referral, and the yard sign — all at peak happiness, in the same visit.",
        },
      },
      {
        heading: 'The Referral Ask',
        content: [
          'Be specific — a specific ask beats "know anyone who needs a roof?" Point at the neighborhood: "Which neighbor has an older roof, or lost shingles in that same storm?" Specific questions get specific names.',
          'Hand over referral cards — give them two or three so they have something physical to pass along.',
          'Reference the current referral program, but confirm it live with the office — never promise a number or reward you are not sure of.',
        ],
        talkTracks: [
          {
            speaker: 'field',
            text: "Now that yours is done and looks great — which of your neighbors has an older roof, or lost shingles in that same storm? Here are a couple of my cards, pass them along. And let me confirm our current referral program with the office so I give you the right details.",
            context: 'The specific referral ask (Close to Referral deck, slide 15; assembled from the slide bullets).',
          },
        ],
        proTips: [
          'Ask about a specific neighbor by house or direction ("the two-story on the corner") — it jogs a real name loose far better than a general question.',
          'Never quote a referral reward amount from memory — confirm the live program with the office first.',
        ],
      },
      {
        heading: 'Tracking Referrals in JN',
        content: [
          'A referral you do not write down is a referral you will lose. Record every name the homeowner gives you in JobNimbus (JN) so it becomes a real lead, not a note that dies in your phone.',
          'Capture who referred them along with the new contact, so the referral is traceable back to the customer — that is what lets the referral program actually pay out correctly.',
          'Follow up on referred leads like any other lead — a warm name from a happy customer is the best lead you will get all week.',
        ],
        sourceNote:
          "The deck covers asking for referrals and handing over cards; recording referrals in JobNimbus (with the referring customer captured) is the standard RCRS lead-tracking workflow, added here so the names become tracked leads.",
      },
      {
        heading: 'Yard Sign + Neighbors Synergy',
        content: [
          'Ask for the yard sign — a billboard on a fresh, clean roof. The neighbors are already looking at the new roof; the sign tells them who did it.',
          'The yard sign and the referral ask work together: the sign markets to the whole street passively while the referral names give you specific doors to knock.',
          'For the full yard-sign script, its two benefits, and the HOA variant, see the "Close-Out, Yard Sign & Your Numbers" module — the same play, applied here at the happy-customer end of a completed retail job.',
        ],
        callout: {
          tone: 'info',
          title: 'One fresh roof, a whole street of leads',
          text: 'A new roof plus a yard sign plus two or three referral cards turns one happy customer into passive advertising and a handful of warm neighbor leads — all set up in the same peak-happiness visit.',
        },
      },
    ],
    quiz: [
      {
        id: 'r5_1',
        question: 'When is the best moment to ask for referrals?',
        options: [
          'A week after the job, once the homeowner has had time to reflect',
          'Right now, at peak happiness — the roof is done, they just walked it and love it',
          'Before the roof is installed, so they are already thinking about it',
          'Only after the warranty registration is processed',
        ],
        explanation:
          'Peak happiness is right now. The roof is finished, it looks great, and they are thrilled — that is the single best moment to ask. Wait and the glow fades and the ask gets awkward.',
      },
      {
        id: 'r5_2',
        question: 'What makes an effective referral ask?',
        options: [
          '"Do you know anyone who might need a roof sometime?"',
          '"Which neighbor has an older roof, or lost shingles in that same storm?"',
          '"If you think of anybody, you have my number."',
          '"Would you mind mentioning us if it ever comes up?"',
        ],
        explanation:
          'Be specific. A pointed question about a particular neighbor jogs a real name loose, where a vague "know anyone?" gets a vague answer. Then hand over two or three referral cards.',
      },
      {
        id: 'r5_3',
        question: 'Where do referrals get recorded?',
        options: [
          'In your personal phone notes',
          'In JobNimbus (JN), with the referring customer captured, so each name becomes a tracked lead',
          'Nowhere — you just follow up from memory',
          'Only on the paper referral card the homeowner keeps',
        ],
        explanation:
          'Record every referral in JobNimbus with the referring customer attached, so it becomes a real, traceable lead and the referral program can pay out correctly. A name not written down is a name lost.',
      },
      {
        id: 'r5_4',
        question: 'How do referrals connect to the yard-sign play?',
        options: [
          'The yard sign replaces the need to ask for referrals',
          'They work together — the sign markets passively to the whole street while referral names give you specific doors to knock',
          'You only plant a yard sign if the homeowner gives no referrals',
          'The yard sign is for insurance jobs and referrals are for retail jobs',
        ],
        explanation:
          'The yard sign on a fresh, clean roof is a billboard to the whole street, and the specific referral names give you warm doors to knock. One happy customer becomes passive advertising plus a handful of warm neighbor leads. (See "Close-Out, Yard Sign & Your Numbers" for the full sign script.)',
      },
    ],
  },
];
