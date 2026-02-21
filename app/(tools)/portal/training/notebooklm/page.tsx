'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Home,
  Command,
  Brain,
  FileText,
  MessageSquare,
  Headphones,
  StickyNote,
  Users,
  BarChart3,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Award,
  Lightbulb,
  BookOpen,
  Trophy,
} from 'lucide-react';
import SettingsMenu from '@/components/SettingsMenu';

// ============================================================================
// TYPES
// ============================================================================

interface GuideStep {
  heading: string;
  content: string[];
  tryItLink?: { href: string; label: string };
  tips?: string[];
}

interface GuideSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  steps: GuideStep[];
}

// ============================================================================
// SECTION DATA
// ============================================================================

const guideSections: GuideSection[] = [
  // -------------------------------------------------------------------------
  // Section 1: What is NotebookLM?
  // -------------------------------------------------------------------------
  {
    id: 'nlm_s1',
    title: 'What is NotebookLM?',
    description: 'Overview of NotebookLM, how RCRS uses it, and getting started.',
    icon: Brain,
    color: 'text-violet-400',
    steps: [
      {
        heading: 'What NotebookLM Does',
        content: [
          'NotebookLM is a free AI research tool from Google that lets you upload documents and have intelligent conversations about them.',
          '',
          'WHAT MAKES IT SPECIAL:',
          '- It only uses YOUR uploaded sources to answer questions -- no hallucinations from random internet data.',
          '- It can read PDFs, Google Docs, websites, YouTube videos, and more.',
          '- It generates Audio Overviews (AI podcast-style deep dives) from your sources.',
          '- Everything is organized into "notebooks" that you can share with your team.',
          '',
          'Think of it as having a personal research assistant that has read everything you give it and can answer any question about those documents instantly.',
        ],
      },
      {
        heading: 'How RCRS Uses NotebookLM',
        content: [
          'At River City Roofing Solutions, we use NotebookLM to power our training and sales preparation:',
          '',
          'TRAINING CONTENT:',
          '- Audio deep dives for each training module (listen while driving to appointments).',
          '- Quick-reference flashcards and quizzes generated from our training materials.',
          '- Study guides that summarize key information from multiple source documents.',
          '',
          'SALES PREPARATION:',
          '- Upload hail reports, weather data, and insurance info for a territory.',
          '- Ask questions like "What areas had the most hail damage in the last 6 months?"',
          '- Generate talking points for homeowner conversations based on local storm data.',
          '',
          'MEETING PREP:',
          '- Upload sales meeting numbers and rep performance data.',
          '- Ask for summaries, trends, and action items.',
          '- Generate briefings for team meetings.',
        ],
      },
      {
        heading: 'Getting Access',
        content: [
          'NotebookLM is free and available to anyone with a Google account.',
          '',
          'TO GET STARTED:',
          '1. Go to notebooklm.google.com',
          '2. Sign in with your Google account (use your @rcrsal.com account for work notebooks).',
          '3. Click "New Notebook" to create your first notebook.',
          '4. You are ready to start adding sources!',
          '',
          'NotebookLM works best in Google Chrome. It is a web-based tool -- there is no app to install.',
        ],
        tryItLink: { href: 'https://notebooklm.google.com', label: 'Open NotebookLM' },
        tips: [
          'Use your @rcrsal.com Google Workspace account so shared RCRS notebooks appear automatically.',
          'Bookmark notebooklm.google.com for quick access.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 2: Adding Sources
  // -------------------------------------------------------------------------
  {
    id: 'nlm_s2',
    title: 'Adding Sources',
    description: 'Supported source types, uploading steps, and source limits.',
    icon: FileText,
    color: 'text-blue-400',
    steps: [
      {
        heading: 'Supported Source Types',
        content: [
          'NotebookLM can read and analyze many types of content:',
          '',
          'DOCUMENT TYPES:',
          '- Google Docs (directly from your Google Drive).',
          '- PDFs (upload from your computer).',
          '- Plain text files (.txt).',
          '- Markdown files (.md).',
          '',
          'WEB CONTENT:',
          '- Website URLs (pastes the page content into a source).',
          '- YouTube videos (extracts the transcript).',
          '',
          'OTHER:',
          '- Google Slides presentations.',
          '- Copied/pasted text (you can paste raw text directly).',
          '',
          'NOT SUPPORTED: Excel/CSV files, images, audio files, or private/login-required pages. For spreadsheet data, copy the data and paste it as text.',
        ],
      },
      {
        heading: 'How to Add Sources',
        content: [
          'TO ADD A SOURCE TO YOUR NOTEBOOK:',
          '1. Open your notebook in NotebookLM.',
          '2. Click the "+" button in the Sources panel (left side).',
          '3. Choose the source type (Google Drive, Upload, Website, YouTube, or Paste Text).',
          '4. Select or enter your source.',
          '5. Wait for NotebookLM to process it (usually 10-30 seconds).',
          '',
          'Once added, a source summary will appear in the left panel. NotebookLM has read and indexed the entire document.',
          '',
          'TIPS FOR GOOD SOURCES:',
          '- Longer documents give better, more detailed answers.',
          '- Multiple sources on the same topic provide richer context.',
          '- Name your sources clearly so you can identify them later.',
        ],
        tips: [
          'You can add up to 50 sources per notebook. Each source can be up to 500,000 words.',
          'If a document is too large, split it into sections and add each as a separate source.',
        ],
      },
      {
        heading: 'Managing Your Sources',
        content: [
          'VIEWING SOURCES:',
          '- Click any source in the left panel to see its summary and contents.',
          '- NotebookLM automatically generates a brief summary of each source when added.',
          '',
          'REMOVING SOURCES:',
          '- Click the three-dot menu on a source and select "Remove".',
          '- This does not delete the original file, only removes it from the notebook.',
          '',
          'UPDATING SOURCES:',
          '- If a Google Doc is updated, you can re-sync it by removing and re-adding.',
          '- For uploaded files, you will need to re-upload the updated version.',
          '',
          'Think carefully about which sources to include. Better sources = better answers.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 3: Chatting with Your Notebook
  // -------------------------------------------------------------------------
  {
    id: 'nlm_s3',
    title: 'Chatting with Your Notebook',
    description: 'Asking questions, getting summaries, and understanding citations.',
    icon: MessageSquare,
    color: 'text-green-400',
    steps: [
      {
        heading: 'Asking Questions',
        content: [
          'The chat interface is where the magic happens. Ask questions in plain English and NotebookLM answers using ONLY your uploaded sources.',
          '',
          'GOOD QUESTIONS TO ASK:',
          '- "Summarize the key points from [source name]".',
          '- "What does the training manual say about handling insurance objections?".',
          '- "Compare the hail damage reports from January and February".',
          '- "List all the steps in the inspection process".',
          '- "What are the commission rates mentioned in the sales guide?".',
          '',
          'BAD QUESTIONS (will not work well):',
          '- Questions about topics NOT in your sources.',
          '- "What is the weather tomorrow?" (not a document analysis question).',
          '- Very vague questions like "Tell me everything".',
          '',
          'Be specific. The more focused your question, the better the answer.',
        ],
      },
      {
        heading: 'Understanding Citations',
        content: [
          'Every answer from NotebookLM includes numbered citations that link back to the exact source text.',
          '',
          'HOW CITATIONS WORK:',
          '- Answers include small numbered superscripts like [1], [2], etc.',
          '- Click a citation number to see the exact passage from the source.',
          '- This lets you verify any answer and see the original context.',
          '',
          'WHY THIS MATTERS:',
          '- You can trust answers because you can verify them.',
          '- You can find the original document quickly if you need more detail.',
          '- It prevents AI hallucinations because every claim is grounded in a source.',
          '',
          'If NotebookLM says "I could not find information about that in your sources," it means the answer is not in your uploaded documents.',
        ],
        tips: [
          'Always check citations for important information. It takes 2 seconds to click and verify.',
          'If an answer seems off, the citation will show you exactly what the AI was referencing.',
        ],
      },
      {
        heading: 'Getting Summaries and Briefs',
        content: [
          'NotebookLM excels at summarizing large amounts of information:',
          '',
          'QUICK SUMMARIES:',
          '- "Give me a one-paragraph summary of this report".',
          '- "What are the top 5 takeaways from the sales training manual?".',
          '',
          'COMPARISON BRIEFS:',
          '- "Compare Rep A performance vs Rep B based on these meeting notes".',
          '- "What changed between the Q1 and Q2 reports?".',
          '',
          'ACTION ITEMS:',
          '- "What action items were mentioned in the meeting notes?".',
          '- "What follow-ups are needed based on this inspection report?".',
          '',
          'FORMAT REQUESTS:',
          '- "Create a bullet-point list of...".',
          '- "Give me a table comparing...".',
          '- "Write this as an email to a homeowner...".',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 4: Audio Overviews
  // -------------------------------------------------------------------------
  {
    id: 'nlm_s4',
    title: 'Audio Overviews',
    description: 'Generating AI podcast-style deep dives, customizing, and sharing.',
    icon: Headphones,
    color: 'text-purple-400',
    steps: [
      {
        heading: 'What Audio Overviews Are',
        content: [
          'Audio Overviews are one of NotebookLM\'s most powerful features. They generate a realistic podcast-style conversation between two AI hosts who discuss your sources.',
          '',
          'WHAT YOU GET:',
          '- A 5-15 minute audio conversation covering key points from your sources.',
          '- Two AI voices that discuss, explain, and elaborate on the material.',
          '- Natural-sounding dialogue with examples and analogies.',
          '- Downloadable MP3 files you can listen to anywhere.',
          '',
          'PERFECT FOR:',
          '- Listening during your commute to appointments.',
          '- Reviewing training material while doing other tasks.',
          '- Getting a high-level overview before diving into the details.',
          '- Sharing with team members who prefer audio over reading.',
        ],
      },
      {
        heading: 'Generating an Audio Overview',
        content: [
          'TO GENERATE AN AUDIO OVERVIEW:',
          '1. Open your notebook with at least one source added.',
          '2. Click the "Audio Overview" button in the top right (looks like a play button).',
          '3. Optionally, add a custom prompt to guide what the hosts discuss.',
          '4. Click "Generate".',
          '5. Wait 2-5 minutes for the audio to be created.',
          '',
          'CUSTOMIZING THE OVERVIEW:',
          '- Add a prompt like: "Focus on the inspection process and common mistakes".',
          '- Or: "Explain this for someone new to roofing sales".',
          '- Or: "Cover the top 5 most important points only".',
          '',
          'The better your custom prompt, the more targeted the audio overview will be.',
        ],
        tips: [
          'Generate audio overviews for each training module so reps can listen while driving.',
          'Custom prompts like "explain this for a new hire" produce great onboarding content.',
        ],
      },
      {
        heading: 'Downloading and Sharing Audio',
        content: [
          'DOWNLOADING:',
          '- Once generated, click the download button on the Audio Overview player.',
          '- The file downloads as an MP3.',
          '- Play it in any music app, car stereo, or audio player.',
          '',
          'SHARING WITH YOUR TEAM:',
          '- Share the notebook with team members (they can play it directly in NotebookLM).',
          '- Download and upload to a shared Google Drive folder.',
          '- The RCRS Training Library hosts downloaded audio overviews for all training modules.',
          '',
          'RCRS TRAINING LIBRARY:',
          '- All NotebookLM-generated audio is available in the Training Library on this portal.',
          '- Go to Training > Training Library > select a module > Audio Deep Dives.',
        ],
        tryItLink: { href: '/portal/training/library', label: 'Open Training Library' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 5: Notes & Organization
  // -------------------------------------------------------------------------
  {
    id: 'nlm_s5',
    title: 'Notes & Organization',
    description: 'Creating notes, pinning key info, and converting chat to notes.',
    icon: StickyNote,
    color: 'text-amber-400',
    steps: [
      {
        heading: 'Creating Notes',
        content: [
          'Notes in NotebookLM let you save and organize important information you discover.',
          '',
          'TO CREATE A NOTE:',
          '1. Click the "Add Note" button in the Notes panel.',
          '2. Type your note or paste content from a chat response.',
          '3. Notes are automatically saved.',
          '',
          'WHAT TO USE NOTES FOR:',
          '- Key facts you want to remember.',
          '- Summaries you have generated that are worth keeping.',
          '- Action items or follow-ups discovered from your sources.',
          '- Quick-reference information you need frequently.',
          '',
          'Notes live inside the notebook alongside your sources and chat history.',
        ],
      },
      {
        heading: 'Converting Chat to Notes',
        content: [
          'When NotebookLM gives you a great answer, you can save it as a note:',
          '',
          'TO SAVE A CHAT RESPONSE:',
          '1. Find the answer you want to save in the chat.',
          '2. Click the "Pin" or "Save to Notes" icon on the response.',
          '3. The response is saved as a new note with citations preserved.',
          '',
          'WHY THIS MATTERS:',
          '- Chat history can get long. Notes are permanent and easy to find.',
          '- Pinned notes appear at the top of your Notes panel.',
          '- You can edit notes after saving to add your own context.',
          '',
          'ORGANIZING NOTES:',
          '- Pin the most important notes to keep them at the top.',
          '- Delete notes you no longer need.',
          '- Edit note titles to make them easy to scan.',
        ],
        tips: [
          'After a research session, pin the 3-5 most important findings. This saves you from re-reading the full chat later.',
        ],
      },
      {
        heading: 'Notebook Organization Best Practices',
        content: [
          'Keep your notebooks organized for maximum productivity:',
          '',
          'ONE TOPIC PER NOTEBOOK:',
          '- Create separate notebooks for different topics (e.g., "Sales Training", "North Alabama Hail Data", "Insurance Process").',
          '- This keeps sources focused and answers more relevant.',
          '',
          'NAMING CONVENTIONS:',
          '- Use clear, descriptive names: "RCRS Sales Training Q1 2026" not "notebook 1".',
          '- Include dates if the content is time-sensitive.',
          '',
          'REGULAR CLEANUP:',
          '- Remove outdated sources when data changes.',
          '- Archive notebooks you no longer actively use.',
          '- Keep active notebooks to 10-20 sources for best performance.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 6: Sharing & Collaboration
  // -------------------------------------------------------------------------
  {
    id: 'nlm_s6',
    title: 'Sharing & Collaboration',
    description: 'Viewer vs. Editor permissions and RCRS shared notebooks.',
    icon: Users,
    color: 'text-teal-400',
    steps: [
      {
        heading: 'Sharing a Notebook',
        content: [
          'You can share your notebooks with other team members:',
          '',
          'TO SHARE:',
          '1. Open the notebook you want to share.',
          '2. Click the "Share" button in the top right.',
          '3. Enter the email addresses of your team members.',
          '4. Choose their permission level (Viewer or Editor).',
          '5. Click "Share".',
          '',
          'PERMISSION LEVELS:',
          '- Viewer: Can read sources, chat with the notebook, and listen to Audio Overviews. Cannot add or remove sources.',
          '- Editor: Full access. Can add/remove sources, create notes, and generate Audio Overviews.',
          '',
          'Share notebooks with your team to multiply the value of your research.',
        ],
      },
      {
        heading: 'RCRS Shared Notebooks',
        content: [
          'The RCRS team maintains several shared notebooks that all team members can access:',
          '',
          'AVAILABLE SHARED NOTEBOOKS:',
          '- RCRS Sales Training: Complete sales methodology, scripts, and objection handling.',
          '- RCRS Operations Manual: Delivery procedures, inventory management, safety protocols.',
          '- Insurance Claims Guide: Insurance process, adjuster meetings, supplement procedures.',
          '- Territory Hail Data: Recent hail reports, storm data, and damage maps.',
          '- Meeting Notes Archive: Weekly meeting notes and action items.',
          '',
          'These are shared as Viewer with all team members. Managers have Editor access.',
          '',
          'If you need access to a shared notebook, ask your manager or the office team.',
        ],
      },
      {
        heading: 'Collaboration Tips',
        content: [
          'GET THE MOST OUT OF SHARED NOTEBOOKS:',
          '',
          '- Ask questions relevant to your role -- different people can get different insights from the same sources.',
          '- Share great Audio Overviews with team members who prefer listening over reading.',
          '- If you find important new information, ask a manager to add it as a source.',
          '',
          'CREATING TEAM NOTEBOOKS:',
          '- Sales teams can create shared notebooks for specific territories.',
          '- Office staff can share operations notebooks.',
          '- Any team member can create a notebook and share it with the team.',
          '',
          'The more people using NotebookLM, the more everyone benefits from shared knowledge.',
        ],
        tips: [
          'If you are preparing for a big appointment, create a temporary notebook with all relevant docs for that property and ask it to help you prepare.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 7: RCRS Sales Data Notebooks
  // -------------------------------------------------------------------------
  {
    id: 'nlm_s7',
    title: 'RCRS Sales Data Notebooks',
    description: 'The 5 available RCRS notebooks and how to analyze rep performance.',
    icon: BarChart3,
    color: 'text-pink-400',
    steps: [
      {
        heading: 'Available RCRS Notebooks',
        content: [
          'RCRS has 5 pre-built notebooks with company data for analysis:',
          '',
          '1. SALES TRAINING COMPLETE:',
          '- Full sales methodology, scripts, objection handling, insurance process.',
          '- Best for: New hires learning the ropes, experienced reps refreshing skills.',
          '',
          '2. OPERATIONS & FIELD OPS:',
          '- Delivery procedures, inventory, safety, quality control.',
          '- Best for: Drivers, warehouse staff, field supervisors.',
          '',
          '3. CUSTOMER SERVICE EXCELLENCE:',
          '- Customer communication templates, complaint handling, follow-up procedures.',
          '- Best for: Office staff, customer-facing roles.',
          '',
          '4. TERRITORY & STORM DATA:',
          '- Hail reports, wind data, storm patterns across North Alabama.',
          '- Best for: Sales reps planning canvassing routes and territory strategy.',
          '',
          '5. ADMIN & MANAGEMENT DEEP DIVE:',
          '- Platform usage, reporting, team management, financial overview.',
          '- Best for: Managers, owners, admin staff.',
        ],
      },
      {
        heading: 'Analyzing Sales Performance Data',
        content: [
          'When sales performance data is uploaded to a notebook, you can ask powerful questions:',
          '',
          'INDIVIDUAL PERFORMANCE:',
          '- "What is [Rep Name]\'s conversion rate this quarter?"',
          '- "How many inspections did I complete last month?"',
          '- "What is my average deal size compared to the team average?"',
          '',
          'TEAM COMPARISONS:',
          '- "Who has the highest inspection-to-close ratio?"',
          '- "Rank reps by total revenue this quarter."',
          '- "Which rep has improved the most month over month?"',
          '',
          'TREND ANALYSIS:',
          '- "Is our overall conversion rate trending up or down?"',
          '- "Which month had the highest number of inspections?"',
          '- "Are there seasonal patterns in our close rate?"',
        ],
        tips: [
          'Upload your latest meeting numbers (copy/paste from Google Sheets) before the weekly meeting to get instant analysis.',
        ],
      },
      {
        heading: 'Setting Up Your Own Performance Notebook',
        content: [
          'Create a personal performance tracking notebook:',
          '',
          'STEP-BY-STEP:',
          '1. Create a new notebook called "[Your Name] - Sales Performance".',
          '2. Add sources: copy/paste your weekly meeting numbers, goal sheets, and commission reports.',
          '3. Add any personal notes about deals, strategies, or lessons learned.',
          '4. Chat with it weekly to track your own progress.',
          '',
          'EXAMPLE QUESTIONS FOR YOUR PERSONAL NOTEBOOK:',
          '- "What was my best week and what did I do differently?"',
          '- "Am I on track to hit my quarterly goal?"',
          '- "What patterns do I see in the deals I lost vs. won?"',
          '',
          'This is like having a personal coach who knows your entire sales history.',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Section 8: Best Practices
  // -------------------------------------------------------------------------
  {
    id: 'nlm_s8',
    title: 'Best Practices',
    description: 'Tips for uploads, territory questions, pitch prep, and insurance claims.',
    icon: Sparkles,
    color: 'text-rose-400',
    steps: [
      {
        heading: 'What to Upload for Maximum Value',
        content: [
          'The quality of your sources determines the quality of your answers. Here is what to upload:',
          '',
          'HIGH VALUE SOURCES:',
          '- Sales meeting notes and performance data.',
          '- Hail and storm reports from NWS for your territory.',
          '- Insurance company guidelines and coverage information.',
          '- Product spec sheets (shingles, underlayment, accessories).',
          '- Customer testimonials and case studies.',
          '- Your own notes from successful deals.',
          '',
          'MEDIUM VALUE:',
          '- Industry articles and news.',
          '- Competitor pricing information.',
          '- Regional building codes and requirements.',
          '',
          'LOW VALUE:',
          '- Generic marketing material.',
          '- Information that changes daily (weather forecasts, stock prices).',
          '- Documents you have not read yourself (garbage in = garbage out).',
        ],
      },
      {
        heading: 'Territory Questions and Pitch Prep',
        content: [
          'Before going out to canvass or meet a homeowner, use NotebookLM to prepare:',
          '',
          'TERRITORY RESEARCH:',
          '- "What hail events hit [zip code/area] in the last 12 months?"',
          '- "What is the average hail size reported in [county]?"',
          '- "When was the last significant storm event in this neighborhood?"',
          '',
          'PITCH PREPARATION:',
          '- "Give me 5 talking points for a homeowner who has never filed an insurance claim."',
          '- "What are the most common objections about insurance claims and how should I respond?"',
          '- "Create a 30-second elevator pitch about RCRS\'s process."',
          '',
          'APPOINTMENT PREP:',
          '- Upload the property\'s inspection notes and ask for key points to discuss.',
          '- Upload the insurance policy details and ask about coverage specifics.',
          '- Generate a checklist of items to bring up during the meeting.',
        ],
        tips: [
          'Spend 5 minutes with NotebookLM before every appointment. Being the most prepared person in the room closes deals.',
        ],
      },
      {
        heading: 'Insurance Claims and Supplements',
        content: [
          'NotebookLM is excellent for insurance-related research:',
          '',
          'CLAIM PREPARATION:',
          '- Upload the insurance company\'s claims guidelines.',
          '- Ask: "What documentation does [insurance company] require for a hail claim?"',
          '- Ask: "What are the deadlines for filing a claim with [company]?"',
          '',
          'SUPPLEMENT RESEARCH:',
          '- Upload the original estimate and the actual scope of work.',
          '- Ask: "What line items are missing from this estimate?"',
          '- Ask: "What code requirements should be included that are not listed?"',
          '',
          'ADJUSTER MEETING PREP:',
          '- Upload the adjuster\'s preliminary report.',
          '- Ask: "What items did the adjuster miss or undervalue?"',
          '- Generate a list of talking points for the adjuster meeting.',
          '',
          'Having all this information at your fingertips gives you a significant advantage.',
        ],
      },
      {
        heading: 'Daily NotebookLM Habits',
        content: [
          'Build these habits to get the most from NotebookLM:',
          '',
          'MORNING ROUTINE (5 minutes):',
          '- Check shared RCRS notebooks for new updates or audio overviews.',
          '- Review your personal performance notebook before the day starts.',
          '',
          'BEFORE APPOINTMENTS (5 minutes):',
          '- Open the relevant territory notebook.',
          '- Ask about the specific area you are heading to.',
          '- Generate 3 talking points for the homeowner meeting.',
          '',
          'AFTER APPOINTMENTS (2 minutes):',
          '- Paste your notes from the appointment into your personal notebook.',
          '- This builds a searchable history of all your interactions.',
          '',
          'WEEKLY (15 minutes):',
          '- Update your performance notebook with this week\'s numbers.',
          '- Listen to any new Audio Overviews in the Training Library.',
          '- Review one shared notebook you have not checked recently.',
        ],
        tips: [
          'The reps who use NotebookLM for 10 minutes a day are consistently the most prepared, most knowledgeable, and most successful on the team.',
          'Start small -- just use it before one appointment today. The value will be obvious.',
        ],
      },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const STORAGE_KEY = 'rcrs-nlm-progress';

function loadCompletedSections(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCompletedSections(completed: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(completed)));
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function NotebookLMGuidePage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));

  // Load on mount
  useEffect(() => {
    const loaded = loadCompletedSections();
    setCompleted(loaded);
    syncWithServer(loaded);
  }, []);

  const syncWithServer = useCallback(async (localCompleted: Set<string>) => {
    try {
      const res = await fetch('/api/portal/training');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.completedModules)) {
        const nlmModules = (data.completedModules as string[]).filter((m: string) => m.startsWith('nlm_'));
        if (nlmModules.length > 0) {
          const merged = new Set([...localCompleted, ...nlmModules]);
          if (merged.size > localCompleted.size) {
            setCompleted(merged);
            saveCompletedSections(merged);
          }
        }
      }
    } catch {
      // Silent fail
    }
  }, []);

  const activeSection = guideSections.find(s => s.id === activeSectionId) || null;

  const completedCount = guideSections.filter(s => completed.has(s.id)).length;
  const overallProgress = Math.round((completedCount / guideSections.length) * 100);
  const allComplete = completedCount === guideSections.length;

  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const openSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setExpandedSteps(new Set([0]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const markComplete = async (sectionId: string) => {
    const newCompleted = new Set([...completed, sectionId]);
    setCompleted(newCompleted);
    saveCompletedSections(newCompleted);

    try {
      await fetch('/api/portal/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'current-user',
          userName: 'Team Member',
          moduleId: sectionId,
          moduleName: guideSections.find(s => s.id === sectionId)?.title || sectionId,
          score: '100',
          passed: true,
          completedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Fail silently
    }
  };

  const unmarkComplete = (sectionId: string) => {
    const newCompleted = new Set(completed);
    newCompleted.delete(sectionId);
    setCompleted(newCompleted);
    saveCompletedSections(newCompleted);
  };

  const backToList = () => {
    setActiveSectionId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // RENDER: Section Detail View
  // =========================================================================
  if (activeSection) {
    const isCompleted = completed.has(activeSection.id);
    const sectionIndex = guideSections.findIndex(s => s.id === activeSection.id);
    const nextSection = guideSections[sectionIndex + 1];

    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="fixed inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)', backgroundSize: '50px 50px' }} />
        </div>
        <div className="relative z-10">
          <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
            <div className="max-w-4xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={backToList} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                    <ArrowLeft size={18} className="text-neutral-400" />
                  </button>
                  <div>
                    <h1 className="text-lg font-bold text-white">{activeSection.title}</h1>
                    <p className="text-xs text-neutral-400">{activeSection.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <button
                      onClick={() => unmarkComplete(activeSection.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium"
                    >
                      <CheckCircle2 size={16} />
                      Completed
                    </button>
                  ) : (
                    <button
                      onClick={() => markComplete(activeSection.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-400 transition-colors"
                    >
                      <CheckCircle2 size={16} />
                      Mark as Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-6 py-8">
            <div className="space-y-4">
              {activeSection.steps.map((step, idx) => {
                const isExpanded = expandedSteps.has(idx);
                return (
                  <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                    <button
                      onClick={() => toggleStep(idx)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 text-sm font-bold">
                          {idx + 1}
                        </div>
                        <span className="text-white font-medium text-left">{step.heading}</span>
                      </div>
                      {isExpanded ? <ChevronDown size={18} className="text-neutral-400" /> : <ChevronRight size={18} className="text-neutral-400" />}
                    </button>
                    {isExpanded && (
                      <div className="px-6 pb-5 border-t border-white/5">
                        <div className="mt-4 space-y-2">
                          {step.content.map((line, i) => {
                            if (line === '') return <div key={i} className="h-3" />;
                            if (line.startsWith('- ')) return <p key={i} className="text-sm text-neutral-300 pl-4 before:content-['\2022'] before:mr-2 before:text-violet-400">{line.slice(2)}</p>;
                            if (line.match(/^\d+\./)) return <p key={i} className="text-sm text-neutral-300 pl-4">{line}</p>;
                            if (line === line.toUpperCase() && line.length > 3 && !line.startsWith('"') && !line.includes('/')) return <p key={i} className="text-sm font-semibold text-white mt-3">{line}</p>;
                            return <p key={i} className="text-sm text-neutral-300">{line}</p>;
                          })}
                        </div>

                        {step.tryItLink && (
                          <div className="mt-4">
                            <Link
                              href={step.tryItLink.href}
                              target={step.tryItLink.href.startsWith('http') ? '_blank' : undefined}
                              rel={step.tryItLink.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium hover:bg-violet-500/20 transition-colors"
                            >
                              <ExternalLink size={14} />
                              Try It: {step.tryItLink.label}
                            </Link>
                          </div>
                        )}

                        {step.tips && step.tips.length > 0 && (
                          <div className="mt-4 rounded-lg bg-violet-500/5 border border-violet-500/20 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb size={16} className="text-violet-400" />
                              <span className="text-sm font-semibold text-violet-400">Tips</span>
                            </div>
                            {step.tips.map((tip, i) => (
                              <p key={i} className="text-sm text-neutral-300 mt-1">{tip}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
              <button
                onClick={backToList}
                className="text-neutral-400 hover:text-white text-sm transition-colors"
              >
                Back to All Sections
              </button>
              <div className="flex items-center gap-3">
                {!isCompleted && (
                  <button
                    onClick={() => markComplete(activeSection.id)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-semibold text-sm hover:bg-violet-400 transition-colors"
                  >
                    <CheckCircle2 size={16} />
                    Mark as Complete
                  </button>
                )}
                {nextSection && (
                  <button
                    onClick={() => openSection(nextSection.id)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors"
                  >
                    Next: {nextSection.title}
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Section List View
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)', backgroundSize: '50px 50px' }} />
      </div>
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/portal/training" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">NotebookLM Guide</h1>
                  <p className="text-sm text-neutral-400">Learn to use Google NotebookLM for RCRS</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/command-center" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/20 hover:from-violet-500/30 hover:to-purple-500/30 border border-violet-500/30 text-violet-400 text-sm font-medium transition-all">
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
                <p className="text-sm text-neutral-400">{completedCount} of {guideSections.length} sections completed</p>
              </div>
              {allComplete && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30">
                  <Trophy size={18} className="text-violet-400" />
                  <span className="text-sm font-semibold text-violet-400">Guide Complete!</span>
                </div>
              )}
            </div>
            <div className="w-full h-3 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-right text-xs text-neutral-500 mt-1">{overallProgress}%</p>
          </div>

          {/* Certificate Banner */}
          {allComplete && (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-purple-500/10 p-6 mb-8 text-center">
              <Award size={48} className="mx-auto text-violet-400 mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">NotebookLM Guide Complete</h3>
              <p className="text-neutral-300 mb-1">You have completed all NotebookLM training sections.</p>
              <p className="text-sm text-neutral-400">You are ready to use NotebookLM to boost your productivity.</p>
            </div>
          )}

          {/* Section List */}
          <div className="space-y-3">
            {guideSections.map((section, idx) => {
              const Icon = section.icon;
              const isCompleted = completed.has(section.id);

              return (
                <button
                  key={section.id}
                  onClick={() => openSection(section.id)}
                  className={`w-full text-left rounded-xl border p-5 transition-all hover:scale-[1.01] ${
                    isCompleted
                      ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-green-500/20' : 'bg-violet-500/10'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 size={24} className="text-green-400" />
                      ) : (
                        <Icon size={24} className={section.color} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 font-medium">SECTION {idx + 1}</span>
                        {isCompleted && <span className="text-xs text-green-400 font-medium">Completed</span>}
                      </div>
                      <h3 className="text-white font-semibold">{section.title}</h3>
                      <p className="text-sm text-neutral-400 truncate">{section.description}</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2 text-neutral-500">
                      <BookOpen size={14} />
                      <span className="text-xs">{section.steps.length} steps</span>
                      <ChevronRight size={16} className="ml-2" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info Footer */}
          <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <div className="flex items-start gap-3">
              <Lightbulb size={18} className="text-violet-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Tips</p>
                <ul className="text-xs text-neutral-400 mt-1 space-y-1">
                  <li>- You can complete sections in any order.</li>
                  <li>- Click into each section to read the steps and try the links.</li>
                  <li>- Your progress is saved automatically.</li>
                  <li>- Complete all 8 sections to finish the NotebookLM guide.</li>
                  <li>- Use your @rcrsal.com Google account for all RCRS NotebookLM work.</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
