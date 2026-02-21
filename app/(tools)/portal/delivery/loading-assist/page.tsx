'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  CheckSquare,
  Square,
  Shield,
  ClipboardCheck,
  Camera,
  Send,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  Weight,
  HardHat,
  ArrowUpDown,
  Lightbulb,
  Timer,
  Sparkles,
  RotateCcw,
  X,
  FileText,
  Play,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MaterialItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  weightLbs: number;
  loadOrder: number;
  handlingTip: string;
  category: 'heavy' | 'medium' | 'light' | 'fragile';
}

interface DeliveryTicket {
  ticketId: string;
  jobName: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  scheduledDate: string;
  scheduledTime: string;
  priority: 'normal' | 'rush' | 'urgent';
  specialInstructions: string;
  materials: MaterialItem[];
  driverName: string;
  vehicle: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface LoadingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  detail: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_TICKETS: DeliveryTicket[] = [
  {
    ticketId: 'DT-2026-0041',
    jobName: 'Henderson Roof Replacement',
    customerName: 'Mark Henderson',
    customerPhone: '(256) 555-1234',
    address: '1482 Oak Valley Dr',
    city: 'Huntsville',
    state: 'AL',
    zip: '35801',
    scheduledDate: '2026-02-10',
    scheduledTime: '08:30 AM',
    priority: 'normal',
    specialInstructions: 'Gate code is #4429. Stack shingles on south side of driveway. Customer has dogs - keep gate closed.',
    driverName: 'Carlos Rivera',
    vehicle: 'Ford F-350 #12',
    materials: [
      { id: 'm1', productName: 'GAF Timberline HDZ Shingles (Charcoal)', quantity: 45, unit: 'bundles', weightLbs: 3150, loadOrder: 1, handlingTip: 'Heavy - lift with legs, max 3 bundles per trip. Load flat on truck bed first.', category: 'heavy' },
      { id: 'm2', productName: 'GAF FeltBuster Synthetic Underlayment', quantity: 6, unit: 'rolls', weightLbs: 264, loadOrder: 2, handlingTip: 'Store upright to prevent crushing. Keep dry.', category: 'medium' },
      { id: 'm3', productName: 'Drip Edge Flashing (10ft, White)', quantity: 30, unit: 'pieces', weightLbs: 90, loadOrder: 5, handlingTip: 'Bundle with straps. Edges are sharp - wear gloves.', category: 'light' },
      { id: 'm4', productName: 'Ice & Water Shield', quantity: 4, unit: 'rolls', weightLbs: 260, loadOrder: 3, handlingTip: 'Heavy rolls. Do not drop - can crack in cold weather.', category: 'heavy' },
      { id: 'm5', productName: '1.25" Galvanized Roofing Nails', quantity: 4, unit: 'boxes (5lb)', weightLbs: 20, loadOrder: 6, handlingTip: 'Secure in cab or toolbox to prevent spilling.', category: 'light' },
      { id: 'm6', productName: 'Ridge Cap Shingles', quantity: 6, unit: 'bundles', weightLbs: 210, loadOrder: 4, handlingTip: 'Load on top of field shingles. Do not stack more than 4 high.', category: 'medium' },
      { id: 'm7', productName: 'Pipe Boot Flashing (2")', quantity: 3, unit: 'pieces', weightLbs: 6, loadOrder: 7, handlingTip: 'Fragile rubber base - do not crush under heavy items. Load last.', category: 'fragile' },
    ],
  },
  {
    ticketId: 'DT-2026-0042',
    jobName: 'Whitfield Insurance Repair',
    customerName: 'Sarah Whitfield',
    customerPhone: '(256) 555-8877',
    address: '305 Monroe St SW',
    city: 'Decatur',
    state: 'AL',
    zip: '35601',
    scheduledDate: '2026-02-10',
    scheduledTime: '11:00 AM',
    priority: 'rush',
    specialInstructions: 'Insurance job - take before photos of existing damage. Inspector meeting crew at 11:30 AM. Use rear entrance for staging.',
    driverName: 'Carlos Rivera',
    vehicle: 'Ford F-350 #12',
    materials: [
      { id: 'n1', productName: 'CertainTeed Landmark Shingles (Moire Black)', quantity: 22, unit: 'bundles', weightLbs: 1540, loadOrder: 1, handlingTip: 'Heavy - lift with legs, max 3 bundles per trip. Load flat on truck bed first.', category: 'heavy' },
      { id: 'n2', productName: 'Synthetic Underlayment (4ft x 250ft)', quantity: 3, unit: 'rolls', weightLbs: 132, loadOrder: 2, handlingTip: 'Store upright. Keep plastic wrap intact.', category: 'medium' },
      { id: 'n3', productName: 'Step Flashing (Aluminum, 5x7)', quantity: 50, unit: 'pieces', weightLbs: 25, loadOrder: 5, handlingTip: 'Bundle flat. Edges are sharp - wear cut-resistant gloves.', category: 'light' },
      { id: 'n4', productName: 'Roof Cement (1 gal)', quantity: 2, unit: 'cans', weightLbs: 22, loadOrder: 6, handlingTip: 'Keep upright. Check lid is sealed tight. Can stain - protect truck bed.', category: 'medium' },
      { id: 'n5', productName: 'Plywood Decking Sheets (4x8 CDX)', quantity: 8, unit: 'sheets', weightLbs: 400, loadOrder: 3, handlingTip: 'Very heavy as a stack. Load flat and secure with ratchet straps. Keep dry.', category: 'heavy' },
      { id: 'n6', productName: 'Starter Strip Shingles', quantity: 4, unit: 'bundles', weightLbs: 120, loadOrder: 4, handlingTip: 'Load with other shingle bundles. Standard handling.', category: 'medium' },
    ],
  },
  {
    ticketId: 'DT-2026-0043',
    jobName: 'Thompson Gutter Install',
    customerName: 'David Thompson',
    customerPhone: '(256) 555-3301',
    address: '920 Bailey Cove Rd',
    city: 'Huntsville',
    state: 'AL',
    zip: '35802',
    scheduledDate: '2026-02-10',
    scheduledTime: '2:00 PM',
    priority: 'normal',
    specialInstructions: 'Gutter-only job. Customer prefers materials staged in garage. Ring doorbell on arrival - works from home.',
    driverName: 'Marcus Johnson',
    vehicle: 'Chevy 3500 #07',
    materials: [
      { id: 'g1', productName: '5" K-Style Aluminum Gutter (10ft, White)', quantity: 16, unit: 'pieces', weightLbs: 96, loadOrder: 1, handlingTip: 'Long pieces - secure with flag on overhang. Do not bend or dent.', category: 'medium' },
      { id: 'g2', productName: '3x4 Aluminum Downspout (10ft, White)', quantity: 8, unit: 'pieces', weightLbs: 32, loadOrder: 2, handlingTip: 'Nest together for transport. Protect open ends.', category: 'light' },
      { id: 'g3', productName: 'Gutter Hangers (Hidden, with screws)', quantity: 80, unit: 'pieces', weightLbs: 24, loadOrder: 5, handlingTip: 'Bag or box together. Small parts - keep contained.', category: 'light' },
      { id: 'g4', productName: 'Downspout Elbows (A-style)', quantity: 12, unit: 'pieces', weightLbs: 6, loadOrder: 6, handlingTip: 'Keep in original packaging. Do not crush.', category: 'fragile' },
      { id: 'g5', productName: 'Gutter End Caps (Left & Right)', quantity: 8, unit: 'pieces', weightLbs: 4, loadOrder: 7, handlingTip: 'Small items - bag together to avoid losing them.', category: 'light' },
      { id: 'g6', productName: 'Gutter Sealant Caulk', quantity: 6, unit: 'tubes', weightLbs: 6, loadOrder: 8, handlingTip: 'Store in cab. Temperature sensitive - do not freeze.', category: 'fragile' },
      { id: 'g7', productName: 'Splash Blocks', quantity: 4, unit: 'pieces', weightLbs: 28, loadOrder: 3, handlingTip: 'Bulky but light. Load where they fit after gutters.', category: 'medium' },
      { id: 'g8', productName: 'Gutter Outlet Drops', quantity: 4, unit: 'pieces', weightLbs: 4, loadOrder: 4, handlingTip: 'Pre-cut from shop. Handle carefully - custom fit.', category: 'fragile' },
    ],
  },
];

const LOADING_STEPS: LoadingStep[] = [
  {
    id: 1,
    title: 'PPE Check',
    description: 'Put on required safety gear',
    icon: <HardHat className="w-5 h-5" />,
    detail: 'Steel-toe boots, work gloves, safety glasses. High-vis vest if loading near active traffic areas. Hard hat if using forklift.',
  },
  {
    id: 2,
    title: 'Review Ticket',
    description: 'Read the full delivery ticket and special instructions',
    icon: <FileText className="w-5 h-5" />,
    detail: 'Check customer name, address, scheduled time, priority, and special instructions. Note any items that need special handling or specific placement.',
  },
  {
    id: 3,
    title: 'Pull Materials',
    description: 'Gather all materials from warehouse',
    icon: <Package className="w-5 h-5" />,
    detail: 'Use the material checklist below to pull each item. Check quantities carefully. Report any shortages to the warehouse manager before loading.',
  },
  {
    id: 4,
    title: 'Load Truck',
    description: 'Load materials in the correct order',
    icon: <Truck className="w-5 h-5" />,
    detail: 'Follow the load order numbers. Heaviest items go on the bottom and closest to the cab. Light and fragile items go on top and are loaded last. Distribute weight evenly side to side.',
  },
  {
    id: 5,
    title: 'Secure Load',
    description: 'Strap and secure all materials',
    icon: <Shield className="w-5 h-5" />,
    detail: 'Use ratchet straps every 4 feet. Check that nothing can shift or fall during transit. Confirm load height is under 13\'6". Flag any overhang past the tailgate.',
  },
  {
    id: 6,
    title: 'Verification Photo',
    description: 'Take a photo of the loaded truck',
    icon: <Camera className="w-5 h-5" />,
    detail: 'Take a clear photo showing all materials loaded and secured. Include a shot of the ticket next to the load for documentation. Upload to the delivery system.',
  },
  {
    id: 7,
    title: 'Confirm in System',
    description: 'Mark the delivery as loaded and ready',
    icon: <CheckCircle className="w-5 h-5" />,
    detail: 'Click "Confirm Load Complete" below. This notifies the office and customer that materials are on the way. Double-check the delivery address in your GPS.',
  },
];

const AI_RESPONSES: { keywords: string[]; response: string }[] = [
  { keywords: ['weight', 'heavy', 'lift', 'back'], response: 'Always lift with your legs, not your back. For shingle bundles (70+ lbs each), use a buddy system or mechanical lift when possible. OSHA recommends a 50 lb max for individual lifting. Take breaks every 20-30 minutes of heavy loading.' },
  { keywords: ['strap', 'secure', 'tie', 'ratchet'], response: 'Use ratchet straps rated for the load weight. Place straps every 4 feet along the load. Cross-strap in an X pattern for shingle stacks. Always use edge protectors on sharp materials to prevent strap damage. DOT requires loads be secured to withstand 0.8g deceleration.' },
  { keywords: ['order', 'first', 'last', 'sequence', 'load order'], response: 'Loading order matters! Heavy items (shingles, plywood) go in first, flat on the bed, closest to the cab for best weight distribution. Medium items (underlayment, flashing) go next. Light/fragile items (boots, nails, sealant) go last on top or in the cab.' },
  { keywords: ['rain', 'wet', 'weather', 'tarp', 'water'], response: 'If rain is expected, tarp all materials before leaving. Underlayment and ice shield can be water-damaged. Plywood will warp if soaked. Keep a 10x12 tarp behind the cab seat. Secure tarp with bungee cords - wind can tear it loose at highway speed.' },
  { keywords: ['plywood', 'sheet', 'sheets'], response: 'Plywood sheets are heavy as a stack (~50 lbs each). Load flat and centered. Use ratchet straps across the top. In wind, unsecured sheets can become airborne - always strap down, even for short trips. Stack no more than 20 sheets per stack.' },
  { keywords: ['shingle', 'bundle', 'shingles'], response: 'Shingle bundles weigh about 70 lbs each. Stack no more than 15 bundles high. Stagger stacks for stability. In hot weather, shingles can stick together - handle carefully. In cold weather, they become brittle and can crack if dropped.' },
  { keywords: ['nail', 'nails', 'fastener'], response: 'Nail boxes should be stored in the cab or a secured toolbox - loose nails on the road are a serious hazard. Check that boxes are sealed. Coil nails for the nailer should be kept dry and in original packaging.' },
  { keywords: ['gutter', 'gutters', 'downspout'], response: 'Gutter sections are long and unwieldy. Secure with red flags if they extend past the tailgate. Nest downspouts together to save space. Protect gutter edges from denting - even small dents affect water flow and appearance.' },
  { keywords: ['flash', 'flashing', 'drip'], response: 'Flashing pieces have sharp edges - always wear cut-resistant gloves. Bundle and strap flat sections together. Step flashing is small and easy to lose - keep it bagged. Drip edge should be loaded so it cannot bend.' },
  { keywords: ['safety', 'ppe', 'gear', 'protection'], response: 'Required PPE for loading: Steel-toe boots, work gloves, safety glasses. Add hard hat when forklift is operating nearby. High-vis vest near active roadways. Keep a first aid kit in the cab. Report all injuries, no matter how minor.' },
  { keywords: ['customer', 'site', 'deliver', 'arrival'], response: 'On arrival: Introduce yourself, confirm the delivery with the customer, and ask where they want materials staged. Take before photos of the property. Protect the driveway from staining. Be professional - you represent RCRS on-site.' },
  { keywords: ['forklift', 'machine', 'equipment'], response: 'Only certified operators may use the forklift. Keep forks low when traveling. Sound horn at intersections and blind corners. Never exceed the rated capacity. Ensure load is balanced and tilted back before moving.' },
  { keywords: ['shortage', 'missing', 'short', 'wrong', 'count'], response: 'If any materials are short or damaged, STOP and notify the warehouse manager immediately. Do not substitute materials without approval. Document shortages with photos. The office will contact the customer about any delays.' },
  { keywords: ['overtime', 'time', 'long', 'schedule'], response: 'Average load time targets: Small job (under 20 items) = 15-20 min. Medium job (20-40 items) = 25-35 min. Large job (40+ items) = 35-50 min. If you are running behind, notify dispatch so they can update the customer ETA.' },
  { keywords: ['hello', 'hi', 'hey', 'help', 'what can'], response: 'Hey there! I am the RCRS Loading Assistant. I can help with: loading order tips, material handling advice, safety reminders, securing loads, weight limits, weather prep, and general delivery questions. Just ask away!' },
];

const SUGGESTED_QUESTIONS = [
  'What is the correct loading order?',
  'How do I secure shingle bundles?',
  'What PPE do I need?',
  'Tips for loading in rain?',
  'How heavy are shingle bundles?',
  'What if materials are missing?',
];

const ROOFING_FACTS = [
  'The average American roof has over 5,000 individual shingles covering it.',
  'Architectural shingles can last 25-30 years, while 3-tab shingles last about 15-20 years.',
  'A single square of roofing (100 sq ft) requires about 3 bundles of shingles.',
  'The color of your roof can affect your home energy costs by up to 40%.',
  'Ancient Romans used concrete for their roofs - the Pantheon dome is still intact after 2,000 years.',
  'In Alabama, hail causes more roof damage claims than any other weather event.',
  'A properly ventilated attic can reduce cooling costs by up to 30% in summer.',
  'The steeper the roof pitch, the longer shingles typically last due to better water runoff.',
  'GAF is the largest shingle manufacturer in North America, producing enough to re-roof 5 million homes per year.',
  'The term "square" in roofing equals 100 square feet - a standard unit of measurement since the 1800s.',
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function LoadingAssistantPage() {
  // Ticket selection
  const [selectedTicketId, setSelectedTicketId] = useState<string>(MOCK_TICKETS[0].ticketId);
  const selectedTicket = MOCK_TICKETS.find(t => t.ticketId === selectedTicketId) || MOCK_TICKETS[0];

  // Material checklist
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Loading steps
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Welcome to the RCRS Loading Assistant! I can help with loading order, material handling, safety tips, and more. Pick a question below or type your own.',
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showChat, setShowChat] = useState(true);

  // Steps panel collapsed state
  const [stepsExpanded, setStepsExpanded] = useState(true);

  // ─── Timer Logic ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ─── Ticket Change Reset ────────────────────────────────────────────────

  const handleTicketChange = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setCheckedItems(new Set());
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setTimerRunning(false);
    setElapsedSeconds(0);
  };

  // ─── Material Checklist Logic ────────────────────────────────────────────

  const toggleMaterial = (materialId: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const sortedMaterials = [...selectedTicket.materials].sort((a, b) => a.loadOrder - b.loadOrder);
  const materialsLoaded = selectedTicket.materials.filter(m => checkedItems.has(m.id)).length;
  const totalMaterials = selectedTicket.materials.length;
  const materialProgress = totalMaterials > 0 ? (materialsLoaded / totalMaterials) * 100 : 0;

  // ─── Steps Logic ─────────────────────────────────────────────────────────

  const completeStep = (stepId: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      next.add(stepId);
      // Auto-advance to next incomplete step using the updated set
      const nextStep = LOADING_STEPS.find(s => s.id > stepId && !next.has(s.id));
      if (nextStep) {
        setCurrentStep(nextStep.id);
      }
      return next;
    });
  };

  const stepsCompleted = completedSteps.size;
  const totalSteps = LOADING_STEPS.length;
  const stepProgress = totalSteps > 0 ? (stepsCompleted / totalSteps) * 100 : 0;

  // Combined overall progress
  const overallProgress = (materialProgress + stepProgress) / 2;

  // ─── Chat Logic ──────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  const getAIResponse = (userMessage: string): string => {
    const lower = userMessage.toLowerCase();
    for (const entry of AI_RESPONSES) {
      if (entry.keywords.some(kw => lower.includes(kw))) {
        return entry.response;
      }
    }
    return 'Great question! For specific loading procedures, check the Loading Steps panel on the left. For material-specific tips, click on any item in the checklist to see handling instructions. If you need help with something else, try asking about safety, load securing, or material handling.';
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Simulate brief delay for AI response
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: getAIResponse(text),
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiMsg]);
    }, 400);
  };

  const showRandomFact = () => {
    const fact = ROOFING_FACTS[Math.floor(Math.random() * ROOFING_FACTS.length)];
    const factMsg: ChatMessage = {
      id: `fact-${Date.now()}`,
      sender: 'assistant',
      text: `Fun roofing fact: ${fact}`,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, factMsg]);
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'heavy': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'light': return 'bg-brand-green/20 text-blue-400 border-blue-500/30';
      case 'fragile': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-zinc-700 text-zinc-300 border-zinc-600';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'rush': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-zinc-700 text-zinc-400 border-zinc-600';
    }
  };

  const totalWeight = selectedTicket.materials.reduce((sum, m) => sum + m.weightLbs, 0);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/portal/delivery"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#39FF14]" />
                Loading Assistant
              </h1>
              <p className="text-sm text-zinc-400">
                Interactive loading walkthrough
              </p>
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2">
              <Timer className="w-4 h-4 text-[#39FF14]" />
              <span className="font-mono text-lg font-bold text-white tabular-nums">
                {formatTime(elapsedSeconds)}
              </span>
              {!timerRunning ? (
                <button
                  onClick={() => setTimerRunning(true)}
                  className="ml-2 p-1 rounded bg-[#39FF14]/20 text-[#39FF14] hover:bg-[#39FF14]/30 transition-colors"
                  title="Start timer"
                >
                  <Play className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setTimerRunning(false)}
                  className="ml-2 p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  title="Pause timer"
                >
                  <Clock className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => { setTimerRunning(false); setElapsedSeconds(0); }}
                className="p-1 rounded bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                title="Reset timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chat toggle for mobile */}
            <button
              onClick={() => setShowChat(!showChat)}
              className="lg:hidden p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors relative"
            >
              <MessageCircle className="w-5 h-5" />
              {showChat && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#39FF14] rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-zinc-400">Overall Progress</span>
            <span className="text-white font-semibold">{Math.round(overallProgress)}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${overallProgress}%`,
                background: overallProgress === 100
                  ? '#39FF14'
                  : `linear-gradient(90deg, #39FF14 0%, #22c55e ${100 - overallProgress}%)`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5 text-zinc-500">
            <span>Materials: {materialsLoaded}/{totalMaterials} loaded</span>
            <span>Steps: {stepsCompleted}/{totalSteps} complete</span>
          </div>
        </div>
      </header>

      {/* Ticket Selector */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 lg:px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-zinc-400">Delivery Ticket:</label>
          <select
            value={selectedTicketId}
            onChange={(e) => handleTicketChange(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#39FF14]/50 focus:border-[#39FF14]/50 outline-none flex-1 max-w-md"
          >
            {MOCK_TICKETS.map(ticket => (
              <option key={ticket.ticketId} value={ticket.ticketId}>
                {ticket.ticketId} - {ticket.jobName} ({ticket.scheduledTime})
              </option>
            ))}
          </select>
          <span className={`px-2 py-1 text-xs font-bold rounded border ${getPriorityBadge(selectedTicket.priority)}`}>
            {selectedTicket.priority.toUpperCase()}
          </span>
          <span className="text-xs text-zinc-500">
            {selectedTicket.driverName} / {selectedTicket.vehicle}
          </span>
        </div>
      </div>

      {/* Special Instructions */}
      {selectedTicket.specialInstructions && (
        <div className="mx-4 lg:mx-6 mt-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-400 mb-1">Special Instructions</h3>
                <p className="text-sm text-amber-300/90 leading-relaxed">
                  {selectedTicket.specialInstructions}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 lg:p-6">
        {/* Left Column: Steps + Materials */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Loading Steps Panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setStepsExpanded(!stepsExpanded)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <ArrowUpDown className="w-4 h-4 text-[#39FF14]" />
                </div>
                <div className="text-left">
                  <h2 className="text-base font-semibold text-white">Loading Steps</h2>
                  <p className="text-xs text-zinc-500">{stepsCompleted} of {totalSteps} steps complete</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform ${stepsExpanded ? 'rotate-180' : ''}`} />
            </button>

            {stepsExpanded && (
              <div className="border-t border-zinc-800">
                {LOADING_STEPS.map((step) => {
                  const isCompleted = completedSteps.has(step.id);
                  const isCurrent = currentStep === step.id;

                  return (
                    <div
                      key={step.id}
                      className={`border-b border-zinc-800/50 last:border-b-0 transition-colors ${
                        isCurrent ? 'bg-[#39FF14]/5' : isCompleted ? 'bg-zinc-800/20' : ''
                      }`}
                    >
                      <div
                        className="flex items-start gap-3 px-5 py-3.5 cursor-pointer"
                        onClick={() => setCurrentStep(isCurrent ? 0 : step.id)}
                      >
                        {/* Step indicator */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isCompleted
                            ? 'bg-[#39FF14] text-black'
                            : isCurrent
                              ? 'bg-[#39FF14]/20 text-[#39FF14] ring-2 ring-[#39FF14]/40'
                              : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <span className="text-sm font-bold">{step.id}</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${isCompleted ? 'text-[#39FF14] line-through' : isCurrent ? 'text-white' : 'text-zinc-400'}`}>
                              {step.title}
                            </span>
                            <span className={`text-xs ${isCompleted ? 'text-zinc-600' : 'text-zinc-500'}`}>
                              {step.description}
                            </span>
                          </div>

                          {/* Expanded detail for current step */}
                          {isCurrent && !isCompleted && (
                            <div className="mt-2">
                              <p className="text-sm text-zinc-300 leading-relaxed">
                                {step.detail}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  completeStep(step.id);
                                  if (!timerRunning && step.id === 1) {
                                    setTimerRunning(true);
                                  }
                                }}
                                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#39FF14] text-black font-semibold rounded-lg hover:bg-[#39FF14]/90 transition-colors text-sm"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Complete Step {step.id}
                              </button>
                            </div>
                          )}
                        </div>

                        {!isCompleted && !isCurrent && (
                          <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Material Checklist */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-[#39FF14]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Material Checklist</h2>
                  <p className="text-xs text-zinc-500">
                    {materialsLoaded}/{totalMaterials} loaded &middot; Total weight: {totalWeight.toLocaleString()} lbs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-zinc-800 rounded-full h-2">
                  <div
                    className="bg-[#39FF14] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${materialProgress}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-zinc-400">{Math.round(materialProgress)}%</span>
              </div>
            </div>

            <div className="divide-y divide-zinc-800/50">
              {sortedMaterials.map((material) => {
                const isChecked = checkedItems.has(material.id);

                return (
                  <div
                    key={material.id}
                    className={`transition-colors ${isChecked ? 'bg-[#39FF14]/5' : 'hover:bg-zinc-800/30'}`}
                  >
                    <div
                      className="flex items-start gap-3 px-5 py-3.5 cursor-pointer"
                      onClick={() => toggleMaterial(material.id)}
                    >
                      {/* Checkbox */}
                      <div className="flex-shrink-0 mt-0.5">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-[#39FF14]" />
                        ) : (
                          <Square className="w-5 h-5 text-zinc-600" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium text-sm ${isChecked ? 'text-[#39FF14] line-through' : 'text-white'}`}>
                                {material.productName}
                              </span>
                              <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border ${getCategoryColor(material.category)}`}>
                                {material.category}
                              </span>
                            </div>

                            {/* Handling tip */}
                            <div className="flex items-start gap-1.5 mt-1.5">
                              <Lightbulb className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-zinc-500 leading-relaxed">
                                {material.handlingTip}
                              </span>
                            </div>
                          </div>

                          {/* Quantity & Weight */}
                          <div className="text-right flex-shrink-0">
                            <div className={`text-lg font-bold tabular-nums ${isChecked ? 'text-[#39FF14]' : 'text-white'}`}>
                              {material.quantity}
                            </div>
                            <div className="text-[11px] text-zinc-500">{material.unit}</div>
                          </div>
                        </div>

                        {/* Load order & weight row */}
                        <div className="flex items-center gap-4 mt-2 text-[11px]">
                          <span className="flex items-center gap-1 text-zinc-500">
                            <ArrowUpDown className="w-3 h-3" />
                            Load order: <span className="text-zinc-300 font-semibold">#{material.loadOrder}</span>
                          </span>
                          <span className="flex items-center gap-1 text-zinc-500">
                            <Weight className="w-3 h-3" />
                            {material.weightLbs.toLocaleString()} lbs
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All loaded confirmation */}
            {materialsLoaded === totalMaterials && totalMaterials > 0 && (
              <div className="px-5 py-4 border-t border-zinc-800 bg-[#39FF14]/10">
                <div className="flex items-center gap-2 text-[#39FF14]">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-bold">All Materials Loaded</span>
                </div>
              </div>
            )}
          </div>

          {/* Delivery Info Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Delivery Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-500">Customer:</span>
                <span className="text-white ml-2">{selectedTicket.customerName}</span>
              </div>
              <div>
                <span className="text-zinc-500">Phone:</span>
                <a href={`tel:${selectedTicket.customerPhone}`} className="text-[#39FF14] ml-2 hover:underline">
                  {selectedTicket.customerPhone}
                </a>
              </div>
              <div className="sm:col-span-2">
                <span className="text-zinc-500">Address:</span>
                <span className="text-white ml-2">
                  {selectedTicket.address}, {selectedTicket.city}, {selectedTicket.state} {selectedTicket.zip}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Scheduled:</span>
                <span className="text-white ml-2">{selectedTicket.scheduledDate} at {selectedTicket.scheduledTime}</span>
              </div>
              <div>
                <span className="text-zinc-500">Total Weight:</span>
                <span className="text-white ml-2">{totalWeight.toLocaleString()} lbs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Chat */}
        <div className={`lg:w-96 flex-shrink-0 ${showChat ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col lg:sticky lg:top-4" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#39FF14]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Loading Assistant</h2>
                  <p className="text-[10px] text-zinc-500">Ask questions about loading &amp; safety</p>
                </div>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="lg:hidden p-1 rounded text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Suggested Questions */}
            <div className="px-3 py-2.5 border-b border-zinc-800/50 bg-zinc-800/30">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-medium">Quick Questions</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="px-2.5 py-1 text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-full hover:border-[#39FF14]/40 hover:text-[#39FF14] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[300px]">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/20'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Fun Fact Button */}
            <div className="px-3 py-2 border-t border-zinc-800/50">
              <button
                onClick={showRandomFact}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg hover:border-[#39FF14]/30 hover:text-[#39FF14] transition-colors"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Random Roofing Fact
              </button>
            </div>

            {/* Chat Input */}
            <div className="px-3 py-3 border-t border-zinc-800 bg-zinc-900">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(chatInput);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about loading, safety, materials..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2.5 placeholder:text-zinc-600 focus:ring-2 focus:ring-[#39FF14]/30 focus:border-[#39FF14]/30 outline-none"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2.5 rounded-lg bg-[#39FF14] text-black hover:bg-[#39FF14]/90 transition-colors disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Final Confirm Button (fixed at bottom when all done) */}
      {overallProgress === 100 && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-[#39FF14]/30 p-4 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-[#39FF14]" />
              <div>
                <p className="text-white font-semibold">All Steps and Materials Complete</p>
                <p className="text-xs text-zinc-400">
                  Loaded in {formatTime(elapsedSeconds)} &middot; {totalWeight.toLocaleString()} lbs total
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setTimerRunning(false);
                alert(`Load confirmed for ${selectedTicket.ticketId}!\n\nTime: ${formatTime(elapsedSeconds)}\nMaterials: ${totalMaterials} items\nWeight: ${totalWeight.toLocaleString()} lbs\n\nReady for delivery to ${selectedTicket.customerName}.`);
              }}
              className="px-6 py-3 bg-[#39FF14] text-black font-bold rounded-xl hover:bg-[#39FF14]/90 transition-colors text-sm"
            >
              Confirm Load Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
