// Delivery AI Agent Service
// Provides smart assistance, coaching, reminders, and conversation for RCRS drivers
// during loading, transit, and delivery operations.

// ============================================
// TYPES
// ============================================

interface TicketSummary {
  ticketId: string;
  ticketType: 'delivery' | 'pickup' | 'return';
  jobName: string;
  jobAddress: string;
  city: string;
  customerName: string;
  customerPhone: string;
  materials: Array<{ productName: string; quantity: number; unit: string }>;
  priority: 'normal' | 'rush' | 'urgent';
  specialInstructions?: string;
  status: string;
}

interface AgentConfig {
  name: string;
  role: string;
  personality: string;
  company: string;
  warehouseAddress: string;
  serviceArea: string;
  companyPhone: string;
}

interface LoadingStep {
  stepNumber: number;
  action: string;
  detail: string;
  safetyNote?: string;
}

interface CoachingTip {
  category: 'customer_interaction' | 'weather' | 'route' | 'etiquette' | 'safety' | 'general';
  tip: string;
}

interface SmartReminder {
  phase: 'before_departure' | 'en_route' | 'at_site' | 'after_delivery';
  priority: 'info' | 'important' | 'critical';
  message: string;
}

interface QAEntry {
  question: string;
  answer: string;
  category: string;
}

interface DaySummary {
  totalDeliveries: number;
  rushOrders: number;
  urgentOrders: number;
  cities: string[];
}

type WeatherCondition = 'clear' | 'rain' | 'storm' | 'wind' | 'heat' | 'cold' | 'fog' | 'ice';
type TimeOfDay = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening';

// ============================================
// MATERIAL HANDLING KNOWLEDGE BASE
// ============================================

const MATERIAL_HANDLING: Record<string, { tips: string[]; weightWarning?: string; loadOrder: number }> = {
  'shingles': {
    tips: [
      'Stack bundles flat, no more than 4 high.',
      'Keep bundles away from direct sun if possible to prevent softening.',
      'Lift with your legs. Each bundle weighs 60 to 80 pounds.',
      'Place shingles low and centered in the truck bed for stability.',
    ],
    weightWarning: 'Heavy load. A full square of shingles is around 240 pounds across 3 bundles. Use proper lifting technique.',
    loadOrder: 1,
  },
  'underlayment': {
    tips: [
      'Store rolls upright to prevent crushing.',
      'Keep dry. Moisture compromises adhesion.',
      'Rolls can be awkward. Use a hand truck when possible.',
    ],
    loadOrder: 2,
  },
  'felt': {
    tips: [
      'Store rolls upright to maintain shape.',
      'Keep wrapped until ready to use.',
      'Felt paper tears easily. Handle with care.',
    ],
    loadOrder: 2,
  },
  'ridge cap': {
    tips: [
      'Load on top of other materials to prevent crushing.',
      'Keep bundles flat and aligned.',
    ],
    loadOrder: 5,
  },
  'flashing': {
    tips: [
      'Metal edges are sharp. Wear cut-resistant gloves.',
      'Stack flat and secure to prevent bending.',
      'Do not stack heavy items on top of flashing.',
    ],
    loadOrder: 4,
  },
  'drip edge': {
    tips: [
      'Long pieces can bend easily. Support the full length during transport.',
      'Watch for sharp edges. Wear gloves.',
      'Load last or on top to prevent damage.',
    ],
    loadOrder: 5,
  },
  'plywood': {
    tips: [
      'Each sheet of half-inch plywood weighs about 48 pounds.',
      'Stack flat on the truck bed. Secure with straps.',
      'Keep dry. Wet plywood warps and delaminates.',
      'Be careful of splinters. Wear gloves.',
    ],
    weightWarning: 'Heavy and awkward. A stack of 10 sheets weighs nearly 500 pounds. Use two people for loading.',
    loadOrder: 1,
  },
  'osb': {
    tips: [
      'Similar to plywood. Stack flat and keep dry.',
      'Each sheet weighs about 50 to 55 pounds.',
      'Secure with ratchet straps for transport.',
    ],
    weightWarning: 'Heavy sheets. Use team lifting for stacks.',
    loadOrder: 1,
  },
  'nails': {
    tips: [
      'Secure boxes so they do not shift during transport.',
      'Coil nails are heavy in bulk. Distribute weight evenly.',
      'Keep away from moisture to prevent rust.',
    ],
    loadOrder: 3,
  },
  'ice and water shield': {
    tips: [
      'Store rolls upright.',
      'Keep in shade. Heat activates the adhesive.',
      'Rolls are heavy, around 60 pounds each.',
    ],
    weightWarning: 'Rolls are heavy and can be slippery. Use caution.',
    loadOrder: 2,
  },
  'ventilation': {
    tips: [
      'Ridge vents and box vents are lightweight but fragile.',
      'Load on top to avoid crushing.',
      'Check that all hardware and screws are included.',
    ],
    loadOrder: 5,
  },
  'pipe boots': {
    tips: [
      'Small but important. Double-check quantities.',
      'Keep in a bin or bag so they do not roll around.',
    ],
    loadOrder: 4,
  },
  'sealant': {
    tips: [
      'Store upright to prevent leaks.',
      'Keep out of direct heat. Tubes can burst if overheated.',
      'Check expiration dates before loading.',
    ],
    loadOrder: 4,
  },
  'gutters': {
    tips: [
      'Long sections need full-length support. Do not let ends hang unsupported.',
      'Aluminum gutters dent easily. Handle with care.',
      'Stack inside each other when possible to save space.',
    ],
    loadOrder: 3,
  },
  'lumber': {
    tips: [
      'Check for warping before loading.',
      'Secure with multiple straps.',
      'Keep ends even to prevent shifting.',
    ],
    weightWarning: 'Pressure-treated lumber is heavier than standard. Account for extra weight.',
    loadOrder: 1,
  },
};

// ============================================
// PRE-BUILT Q&A DATABASE
// ============================================

const DRIVER_QA: QAEntry[] = [
  {
    question: 'What PPE is required for deliveries?',
    answer: 'At minimum, you need steel-toe boots, work gloves, and a high-visibility vest. When handling metal flashing or drip edge, use cut-resistant gloves. For roof-level deliveries, a hard hat is required. Always keep safety glasses in the truck.',
    category: 'safety',
  },
  {
    question: 'What if the customer is not home?',
    answer: 'First, call the customer using the phone number on the ticket. If no answer, call the project manager. If neither responds within 15 minutes, take a photo of the delivery location, leave materials in a safe spot away from the driveway, and note the situation in your delivery app. Do not leave materials in the road or blocking access.',
    category: 'procedures',
  },
  {
    question: 'How do I handle damaged materials?',
    answer: 'If you notice damage during loading, set the item aside and notify the warehouse manager immediately. Do not load damaged materials. If damage is discovered at the job site, take photos of the damage, note it in the delivery app, and call the office at 256-274-8530. The customer should not accept damaged goods.',
    category: 'procedures',
  },
  {
    question: 'What is the return procedure?',
    answer: 'For returns, you need a return authorization from the project manager. At the job site, verify the materials match the return ticket. Take photos of material condition before loading. Bring everything back to the warehouse at 2710 Memorial Parkway Southwest. The warehouse team will inspect and process the return.',
    category: 'procedures',
  },
  {
    question: 'Where do I get fuel?',
    answer: 'Use the company fuel card at any Shell or Pilot station. Keep your receipts. If the fuel card is declined, pay out of pocket and submit the receipt for reimbursement. Always fuel up at the end of the day so the truck is ready for morning.',
    category: 'logistics',
  },
  {
    question: 'What if I have a flat tire or breakdown?',
    answer: 'Pull over safely and turn on hazards. Call the office at 256-274-8530 immediately. Do not attempt roadside repairs on busy roads. If you have a delivery that will be delayed, update the status in your driver app. The office will notify the customer and arrange a replacement vehicle if needed.',
    category: 'emergency',
  },
  {
    question: 'How do I handle a rush delivery?',
    answer: 'Rush deliveries should be loaded and departed as quickly as possible without skipping safety checks. Follow the normal checklist but prioritize this stop on your route. Call the customer to confirm they are expecting the delivery. If you have multiple stops, the rush delivery goes first unless the office says otherwise.',
    category: 'procedures',
  },
  {
    question: 'What photos do I need to take?',
    answer: 'You need four types of photos. First, a photo of the loaded truck showing all materials. Second, a photo of the materials after unloading at the job site. Third, a photo of the job site showing where materials were placed. Fourth, get a signature from whoever receives the delivery. If nobody is present, photograph the materials in place and the house number for proof of delivery.',
    category: 'procedures',
  },
  {
    question: 'Can I adjust material quantities on the ticket?',
    answer: 'Yes, if the actual count differs from the ticket, update the quantities in your driver app. This creates a stock adjustment that the office will review. Always note the reason for the adjustment. Common reasons include miscounts, damaged items removed, or last-minute additions by the project manager.',
    category: 'procedures',
  },
  {
    question: 'What is the weight limit for the truck?',
    answer: 'Check the door sticker for your specific vehicle GVWR. As a general rule, our box trucks handle up to 10,000 pounds, and flatbeds handle up to 14,000 pounds. If you think a load exceeds the limit, weigh it at the scale on South Memorial Parkway before departing. Overloading is a safety violation and can result in fines.',
    category: 'safety',
  },
  {
    question: 'How do I handle a customer complaint?',
    answer: 'Stay calm and professional. Listen to the customer and acknowledge their concern. Do not argue or make promises about credits or refunds. Note the complaint in your delivery app and call the office at 256-274-8530. Let the project manager or office handle the resolution. Your job is to be polite and document everything.',
    category: 'customer',
  },
  {
    question: 'What if the job site is not accessible?',
    answer: 'If you cannot access the delivery location due to blocked roads, construction, or other obstacles, call the customer first to see if there is an alternate entrance. If not, call the project manager. Take photos of the obstruction. Do not drive on lawns or through areas that could damage property. Return to the warehouse if delivery is not possible.',
    category: 'logistics',
  },
];

// ============================================
// CONVERSATION TOPICS
// ============================================

const CONVERSATION_TOPICS = [
  // Roofing facts
  'Did you know? The average asphalt shingle roof lasts 20 to 25 years, but in the Tennessee Valley heat, some roofs need replacement sooner.',
  'Fun fact. The word roof comes from Old English. People have been building roofs for over 5,000 years, starting with thatched straw and clay.',
  'Roofing is one of the top 10 most physically demanding jobs in America. You are part of a tough crew. Stay hydrated out there.',
  'Metal roofs can last 50 years or more and reflect solar heat, which can cut cooling costs by 10 to 25 percent.',
  'The Huntsville area averages about 56 inches of rain per year. That is why proper flashing and underlayment matter so much.',
  'Architectural shingles now account for over 75 percent of the residential roofing market. They are thicker and more wind-resistant than 3-tab.',
  // Safety quizzes
  'Safety quiz. True or false: You should carry shingle bundles on your shoulder. Answer: True, but only if you have proper training and the bundle weighs under 80 pounds. Always lift with your legs first.',
  'Safety quiz. How often should you take a water break in summer heat? Answer: Every 15 to 20 minutes when temperatures are above 90 degrees.',
  'Safety quiz. What is the correct way to set up a ladder? Answer: The 4-to-1 rule. For every 4 feet of height, the base should be 1 foot from the wall.',
  // Company news style
  'Reminder: River City Roofing Solutions is the trusted choice for North Alabama homeowners. Every delivery you make represents our commitment to quality.',
  'Our team covers the greater Huntsville area including Madison, Decatur, Athens, and all of Madison County. You are making a difference for local families.',
  'Customer tip: A friendly greeting and a quick explanation of where you are placing materials goes a long way. Our top-rated reviews often mention how professional our delivery team is.',
  // Motivational
  'Every delivery is a chance to make a great impression. You are the face of River City Roofing on the job site.',
  'Great work today. Remember, safety first, quality second, speed third. In that order.',
  'Halfway through the day. Keep up the good work. Remember to stretch and take a water break.',
];

// ============================================
// SAFETY TIPS BY CONTEXT
// ============================================

const WEATHER_SAFETY: Record<WeatherCondition, string[]> = {
  clear: [
    'Clear skies today. Stay hydrated and wear sunscreen if you will be outdoors for extended periods.',
    'Good visibility on the roads. Keep a safe following distance anyway.',
  ],
  rain: [
    'Rain in the forecast. Drive slower and increase your following distance. Wet roads reduce stopping distance by up to 40 percent.',
    'Rain alert. Cover any exposed materials on the truck. Wet shingles are heavy and slippery.',
    'Use caution on wet surfaces. Non-slip boots are required today.',
  ],
  storm: [
    'Storm warning. If lightning is within 10 miles, stop unloading and take shelter in the truck. Wait 30 minutes after the last flash.',
    'Severe weather alert. Check with the office before departing. Deliveries may be delayed or rescheduled.',
    'High wind warning. Secure all loose materials. Plywood and flashing can become airborne in strong gusts.',
  ],
  wind: [
    'Windy conditions today. Be extra careful with large flat items like plywood and flashing. They can catch the wind.',
    'Wind advisory. Drive carefully, especially on bridges and overpasses. Keep both hands on the wheel.',
  ],
  heat: [
    'Heat advisory. Drink water every 15 minutes. Watch for signs of heat exhaustion: dizziness, nausea, and heavy sweating.',
    'Extreme heat today. Take breaks in the shade. Shingles will be softer and stickier. Handle with care.',
    'High temperature alert. Keep your truck cab cool. Sealants and adhesives can expand or burst in heat.',
  ],
  cold: [
    'Cold weather alert. Shingles become brittle below 40 degrees. Handle bundles carefully to avoid cracking.',
    'Freezing conditions. Watch for ice on loading docks and truck beds. Move slowly and deliberately.',
  ],
  fog: [
    'Fog advisory. Use low beams, not high beams. Reduce speed and increase following distance significantly.',
    'Limited visibility. Turn on all running lights. Use extra caution at intersections.',
  ],
  ice: [
    'Ice warning. Do not rush. Walk with short, flat steps on icy surfaces. Keep three points of contact on the truck.',
    'Road ice possible. If roads look wet but temperatures are at or below freezing, assume black ice. Reduce speed dramatically.',
    'Icy conditions. Salt or sand the loading dock area before pulling materials. Report any unsafe conditions.',
  ],
};

const TIME_SAFETY: Record<TimeOfDay, string[]> = {
  early_morning: [
    'Early start today. Make sure your headlights and taillights are working. Visibility is limited before dawn.',
    'Morning check. Did you do your pre-trip truck inspection? Tires, lights, brakes, fluid levels.',
  ],
  morning: [
    'Good morning. School zones are active. Watch your speed in residential areas.',
    'Morning traffic is heavy on Memorial Parkway. Plan your route to avoid the interchange bottlenecks.',
  ],
  midday: [
    'Midday sun is strongest between 10 AM and 2 PM. Stay hydrated and take shade breaks.',
    'Lunch reminder. Take your full break. Fatigue leads to mistakes.',
  ],
  afternoon: [
    'Afternoon hours. Watch for school buses and children in residential areas after 2 PM.',
    'If you have been working since early morning, fatigue may be setting in. Stay alert and take a break if needed.',
  ],
  evening: [
    'Getting dark earlier. Make sure all truck lights are on. Wear your reflective vest.',
    'End of day reminder. Fuel up before returning to the warehouse so the truck is ready for tomorrow.',
  ],
};

// ============================================
// DELIVERY AI AGENT CLASS
// ============================================

export class DeliveryAIAgent {
  private config: AgentConfig;

  constructor() {
    this.config = {
      name: 'RCRS Assistant',
      role: 'Delivery operations assistant for River City Roofing Solutions drivers and warehouse staff',
      personality: 'Friendly, professional, safety-conscious, and efficient. Speaks clearly and concisely for TTS playback.',
      company: 'River City Roofing Solutions',
      warehouseAddress: '2710 Memorial Pkwy SW, Huntsville, AL 35801',
      serviceArea: 'Greater Huntsville, Madison, Decatur, Athens, and North Alabama',
      companyPhone: '(256) 274-8530',
    };
  }

  // ============================================
  // WELCOME / GREETING
  // ============================================

  generateGreeting(driverName: string, daySummary: DaySummary): string {
    const hour = new Date().getHours();
    let timeGreeting: string;
    if (hour < 12) {
      timeGreeting = 'Good morning';
    } else if (hour < 17) {
      timeGreeting = 'Good afternoon';
    } else {
      timeGreeting = 'Good evening';
    }

    const parts: string[] = [
      `${timeGreeting}, ${driverName}. This is your ${this.config.name}.`,
    ];

    if (daySummary.totalDeliveries === 0) {
      parts.push('No deliveries are scheduled for you today. Check with the office for any updates.');
      return parts.join(' ');
    }

    parts.push(
      `You have ${daySummary.totalDeliveries} ${daySummary.totalDeliveries === 1 ? 'delivery' : 'deliveries'} on the schedule today.`
    );

    if (daySummary.urgentOrders > 0) {
      parts.push(
        `${daySummary.urgentOrders} ${daySummary.urgentOrders === 1 ? 'is' : 'are'} marked urgent. Handle ${daySummary.urgentOrders === 1 ? 'it' : 'those'} first.`
      );
    }

    if (daySummary.rushOrders > 0) {
      parts.push(
        `${daySummary.rushOrders} rush ${daySummary.rushOrders === 1 ? 'order' : 'orders'} as well.`
      );
    }

    if (daySummary.cities.length > 0) {
      const uniqueCities = [...new Set(daySummary.cities)];
      if (uniqueCities.length === 1) {
        parts.push(`All stops are in ${uniqueCities[0]}.`);
      } else {
        const lastCity = uniqueCities.pop();
        parts.push(`You will be covering ${uniqueCities.join(', ')} and ${lastCity}.`);
      }
    }

    parts.push('Let us get started. Stay safe out there.');

    return parts.join(' ');
  }

  // ============================================
  // LOADING ASSISTANCE
  // ============================================

  generateLoadingWalkthrough(ticket: TicketSummary): { script: string; steps: LoadingStep[] } {
    const steps: LoadingStep[] = [];
    let stepNum = 0;

    // Step 1: Safety gear
    stepNum++;
    steps.push({
      stepNumber: stepNum,
      action: 'Put on your PPE',
      detail: 'Steel-toe boots, work gloves, and high-visibility vest. If handling metal materials, switch to cut-resistant gloves.',
      safetyNote: 'Never load without proper protective equipment.',
    });

    // Step 2: Verify ticket
    stepNum++;
    steps.push({
      stepNumber: stepNum,
      action: 'Review the ticket',
      detail: `Ticket ${ticket.ticketId} for ${ticket.customerName} at ${ticket.jobAddress}, ${ticket.city}. ${ticket.materials.length} items to load.`,
    });

    // Check for special instructions
    if (ticket.specialInstructions) {
      stepNum++;
      steps.push({
        stepNumber: stepNum,
        action: 'Special instructions',
        detail: ticket.specialInstructions,
        safetyNote: 'Read special instructions carefully before loading.',
      });
    }

    // Priority warning
    if (ticket.priority === 'urgent') {
      stepNum++;
      steps.push({
        stepNumber: stepNum,
        action: 'Urgent delivery',
        detail: 'This ticket is marked urgent. Load and depart as quickly as possible without skipping safety checks.',
        safetyNote: 'Do not rush to the point of injury. Urgent does not mean unsafe.',
      });
    } else if (ticket.priority === 'rush') {
      stepNum++;
      steps.push({
        stepNumber: stepNum,
        action: 'Rush delivery',
        detail: 'This is a rush order. Prioritize loading but follow all normal procedures.',
      });
    }

    // Sort materials by load order (heavy/flat items first)
    const sortedMaterials = [...ticket.materials].sort((a, b) => {
      const orderA = this.getMaterialLoadOrder(a.productName);
      const orderB = this.getMaterialLoadOrder(b.productName);
      return orderA - orderB;
    });

    // Step for each material
    for (const material of sortedMaterials) {
      stepNum++;
      const handling = this.getMaterialHandling(material.productName);
      const step: LoadingStep = {
        stepNumber: stepNum,
        action: `Load ${material.quantity} ${material.unit} of ${material.productName}`,
        detail: handling.tips.length > 0
          ? handling.tips[0]
          : `Load ${material.quantity} ${material.unit} carefully.`,
      };
      if (handling.weightWarning) {
        step.safetyNote = handling.weightWarning;
      }
      steps.push(step);
    }

    // Secure load
    stepNum++;
    steps.push({
      stepNumber: stepNum,
      action: 'Secure the load',
      detail: 'Use ratchet straps to secure all materials. Check that nothing can shift during transport. Walk around the truck to inspect from all sides.',
      safetyNote: 'An unsecured load is a hazard to you and other drivers. Double-check all straps.',
    });

    // Take photo
    stepNum++;
    steps.push({
      stepNumber: stepNum,
      action: 'Take a load photo',
      detail: 'Photograph the loaded truck from the rear showing all materials. This is your proof that the correct items were loaded.',
    });

    // Verify and confirm
    stepNum++;
    steps.push({
      stepNumber: stepNum,
      action: 'Confirm load in the app',
      detail: 'Mark the load as verified in your driver portal. This notifies the office that you are ready to depart.',
    });

    // Build the TTS script
    const scriptLines: string[] = [
      `Loading walkthrough for ticket ${ticket.ticketId}.`,
      `This is a ${ticket.ticketType} to ${ticket.jobName} at ${ticket.jobAddress}, ${ticket.city}.`,
      `${ticket.materials.length} items to load.`,
      '',
    ];

    for (const step of steps) {
      scriptLines.push(`Step ${step.stepNumber}. ${step.action}. ${step.detail}`);
      if (step.safetyNote) {
        scriptLines.push(`Safety note: ${step.safetyNote}`);
      }
    }

    scriptLines.push('');
    scriptLines.push('Loading complete. Verify everything in the app before departing. Safe travels.');

    return {
      script: scriptLines.join(' '),
      steps,
    };
  }

  private getMaterialHandling(productName: string): { tips: string[]; weightWarning?: string; loadOrder: number } {
    const lower = productName.toLowerCase();
    for (const [key, value] of Object.entries(MATERIAL_HANDLING)) {
      if (lower.includes(key)) {
        return value;
      }
    }
    return { tips: ['Handle with care. Verify quantity matches the ticket.'], loadOrder: 3 };
  }

  private getMaterialLoadOrder(productName: string): number {
    const lower = productName.toLowerCase();
    for (const [key, value] of Object.entries(MATERIAL_HANDLING)) {
      if (lower.includes(key)) {
        return value.loadOrder;
      }
    }
    return 3;
  }

  // ============================================
  // DELIVERY COACHING
  // ============================================

  generateDeliveryCoaching(ticket: TicketSummary, weather?: WeatherCondition): CoachingTip[] {
    const tips: CoachingTip[] = [];

    // Customer interaction tips
    tips.push({
      category: 'customer_interaction',
      tip: `When you arrive, introduce yourself. Say: Hi, I am from River City Roofing Solutions. I have a delivery for ${ticket.customerName}. Where would you like the materials placed?`,
    });

    tips.push({
      category: 'customer_interaction',
      tip: 'Make eye contact, smile, and be friendly. First impressions matter. You represent the entire company at the job site.',
    });

    if (ticket.customerPhone) {
      tips.push({
        category: 'customer_interaction',
        tip: `If the customer is not outside, call them at ${ticket.customerPhone} when you arrive. Give them a minute to come out before unloading.`,
      });
    }

    // Etiquette
    tips.push({
      category: 'etiquette',
      tip: 'Do not park on the lawn. Use the driveway or street. If you must drive on the property, check with the customer first.',
    });

    tips.push({
      category: 'etiquette',
      tip: 'After unloading, do a quick cleanup. Pick up any packaging, straps, or debris. Leave the area cleaner than you found it.',
    });

    tips.push({
      category: 'etiquette',
      tip: `Before leaving, ask the customer: Is there anything else I can help with? Then hand them an RCRS business card if you have one.`,
    });

    // Route notes
    tips.push({
      category: 'route',
      tip: `Your destination is ${ticket.jobAddress}, ${ticket.city}. Check your GPS before departing. If the address seems off, call the project manager.`,
    });

    tips.push({
      category: 'route',
      tip: 'Memorial Parkway and Highway 72 are the main arteries. I-565 is faster for east-west routes. Avoid University Drive during lunch hour if possible.',
    });

    // Weather awareness
    if (weather) {
      const weatherTips = WEATHER_SAFETY[weather];
      if (weatherTips && weatherTips.length > 0) {
        tips.push({
          category: 'weather',
          tip: weatherTips[0],
        });
      }
    }

    // Safety
    tips.push({
      category: 'safety',
      tip: 'When backing up at the job site, use a spotter if available. If alone, get out and check behind the truck before reversing.',
    });

    return tips;
  }

  generateCoachingScript(ticket: TicketSummary, weather?: WeatherCondition): string {
    const tips = this.generateDeliveryCoaching(ticket, weather);
    const lines: string[] = [
      `Delivery coaching for your trip to ${ticket.jobAddress}, ${ticket.city}.`,
      '',
    ];

    for (const tip of tips) {
      lines.push(tip.tip);
    }

    return lines.join(' ');
  }

  // ============================================
  // SMART REMINDERS
  // ============================================

  getSmartReminders(
    ticket: TicketSummary,
    phase: SmartReminder['phase'],
    options?: { weather?: WeatherCondition; timeOfDay?: TimeOfDay; totalWeight?: number }
  ): SmartReminder[] {
    const reminders: SmartReminder[] = [];

    switch (phase) {
      case 'before_departure':
        reminders.push(
          { phase, priority: 'important', message: 'Check that your phone is fully charged or plugged into the truck charger.' },
          { phase, priority: 'important', message: 'Confirm your loading checklist is complete and marked in the app.' },
          { phase, priority: 'info', message: 'Check your fuel level. Fill up if below half a tank.' },
          { phase, priority: 'important', message: 'PPE check: steel-toe boots, gloves, safety vest. All on?' },
          { phase, priority: 'info', message: 'Check your mirrors and adjust your seat before pulling out.' },
        );

        if (options?.totalWeight && options.totalWeight > 8000) {
          reminders.push({
            phase,
            priority: 'critical',
            message: `Heavy load alert. Estimated weight is over ${Math.round(options.totalWeight)} pounds. Drive extra cautiously and brake earlier than normal.`,
          });
        }

        if (ticket.priority === 'urgent') {
          reminders.push({
            phase,
            priority: 'critical',
            message: 'Urgent delivery. Depart as soon as loading is confirmed. This customer is expecting priority service.',
          });
        }
        break;

      case 'en_route':
        reminders.push(
          { phase, priority: 'info', message: 'Obey all speed limits. RCRS trucks are tracked and represent the company on the road.' },
          { phase, priority: 'info', message: `Your destination is ${ticket.jobAddress}, ${ticket.city}. Estimated arrival depends on traffic conditions.` },
        );

        if (options?.weather) {
          const weatherTips = WEATHER_SAFETY[options.weather];
          if (weatherTips && weatherTips.length > 0) {
            reminders.push({
              phase,
              priority: options.weather === 'storm' || options.weather === 'ice' ? 'critical' : 'important',
              message: weatherTips[0],
            });
          }
        }

        if (options?.timeOfDay) {
          const timeTips = TIME_SAFETY[options.timeOfDay];
          if (timeTips && timeTips.length > 0) {
            reminders.push({ phase, priority: 'info', message: timeTips[0] });
          }
        }
        break;

      case 'at_site':
        reminders.push(
          { phase, priority: 'important', message: `Customer name: ${ticket.customerName}. Greet them by name when possible.` },
          { phase, priority: 'important', message: 'Take a delivery photo showing the materials in place at the job site.' },
          { phase, priority: 'important', message: 'Get a customer signature before leaving. If nobody is available, photograph the house number with the materials.' },
        );

        if (ticket.specialInstructions) {
          reminders.push({
            phase,
            priority: 'critical',
            message: `Special instructions for this delivery: ${ticket.specialInstructions}`,
          });
        }

        if (ticket.customerPhone) {
          reminders.push({
            phase,
            priority: 'info',
            message: `Customer phone number: ${ticket.customerPhone}. Call if you need access or directions on site.`,
          });
        }
        break;

      case 'after_delivery':
        reminders.push(
          { phase, priority: 'important', message: 'Did you get a customer signature? Mark it in the app.' },
          { phase, priority: 'important', message: 'Upload all delivery photos before leaving the site.' },
          { phase, priority: 'info', message: 'Clean up any packaging or debris from the delivery area.' },
          { phase, priority: 'info', message: 'Update your delivery status to complete in the app.' },
        );
        break;
    }

    return reminders;
  }

  generateReminderScript(
    ticket: TicketSummary,
    phase: SmartReminder['phase'],
    options?: { weather?: WeatherCondition; timeOfDay?: TimeOfDay; totalWeight?: number }
  ): string {
    const reminders = this.getSmartReminders(ticket, phase, options);

    const phaseLabel: Record<SmartReminder['phase'], string> = {
      before_departure: 'Pre-departure',
      en_route: 'En route',
      at_site: 'On site',
      after_delivery: 'Post-delivery',
    };

    const lines: string[] = [
      `${phaseLabel[phase]} reminders for ticket ${ticket.ticketId}.`,
    ];

    const criticalReminders = reminders.filter(r => r.priority === 'critical');
    const importantReminders = reminders.filter(r => r.priority === 'important');
    const infoReminders = reminders.filter(r => r.priority === 'info');

    if (criticalReminders.length > 0) {
      lines.push('Critical items first.');
      for (const r of criticalReminders) {
        lines.push(r.message);
      }
    }

    for (const r of importantReminders) {
      lines.push(r.message);
    }

    for (const r of infoReminders) {
      lines.push(r.message);
    }

    return lines.join(' ');
  }

  // ============================================
  // QUESTION ANSWERING
  // ============================================

  answerQuestion(query: string): { answer: string; confidence: 'high' | 'medium' | 'low' } {
    const lowerQuery = query.toLowerCase();

    // Search the Q&A database for best match
    let bestMatch: QAEntry | null = null;
    let bestScore = 0;

    for (const qa of DRIVER_QA) {
      const score = this.calculateMatchScore(lowerQuery, qa.question.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        bestMatch = qa;
      }
    }

    // Also check for keyword-based matches
    const keywordMatches = this.keywordSearch(lowerQuery);
    if (keywordMatches && (!bestMatch || bestScore < 0.3)) {
      return { answer: keywordMatches, confidence: 'medium' };
    }

    if (bestMatch && bestScore >= 0.3) {
      return {
        answer: bestMatch.answer,
        confidence: bestScore >= 0.6 ? 'high' : 'medium',
      };
    }

    return {
      answer: `I am not sure about that. Please call the office at ${this.config.companyPhone} for help. They can answer any question about procedures, materials, or routes.`,
      confidence: 'low',
    };
  }

  private calculateMatchScore(query: string, reference: string): number {
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    const refWords = reference.split(/\s+/).filter(w => w.length > 2);

    if (queryWords.length === 0 || refWords.length === 0) return 0;

    let matches = 0;
    for (const qw of queryWords) {
      for (const rw of refWords) {
        if (rw.includes(qw) || qw.includes(rw)) {
          matches++;
          break;
        }
      }
    }

    return matches / Math.max(queryWords.length, refWords.length);
  }

  private keywordSearch(query: string): string | null {
    const keywords: Record<string, string> = {
      'ppe|safety gear|protective': DRIVER_QA.find(q => q.category === 'safety' && q.question.includes('PPE'))?.answer || '',
      'not home|nobody home|no one home|absent': DRIVER_QA.find(q => q.question.includes('not home'))?.answer || '',
      'damaged|damage|broken': DRIVER_QA.find(q => q.question.includes('damaged'))?.answer || '',
      'return|bring back': DRIVER_QA.find(q => q.question.includes('return procedure'))?.answer || '',
      'fuel|gas|fill up': DRIVER_QA.find(q => q.question.includes('fuel'))?.answer || '',
      'flat tire|breakdown|stuck': DRIVER_QA.find(q => q.question.includes('flat tire'))?.answer || '',
      'rush|urgent|hurry': DRIVER_QA.find(q => q.question.includes('rush'))?.answer || '',
      'photo|picture|camera': DRIVER_QA.find(q => q.question.includes('photos'))?.answer || '',
      'adjust|quantity|count wrong': DRIVER_QA.find(q => q.question.includes('adjust'))?.answer || '',
      'weight|heavy|overload|limit': DRIVER_QA.find(q => q.question.includes('weight'))?.answer || '',
      'complaint|angry|upset customer': DRIVER_QA.find(q => q.question.includes('complaint'))?.answer || '',
      'access|blocked|can not get in': DRIVER_QA.find(q => q.question.includes('accessible'))?.answer || '',
      'warehouse address|home base|office address': `The RCRS warehouse is at ${this.config.warehouseAddress}. Head back there after your last delivery or if you need to reload.`,
      'phone number|office number|call office': `The RCRS office number is ${this.config.companyPhone}. Call anytime you need help.`,
    };

    for (const [pattern, answer] of Object.entries(keywords)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(query) && answer) {
        return answer;
      }
    }

    return null;
  }

  getAvailableQuestions(): string[] {
    return DRIVER_QA.map(qa => qa.question);
  }

  // ============================================
  // STATUS NARRATION
  // ============================================

  narrateStatusChange(
    ticket: TicketSummary,
    previousStatus: string,
    newStatus: string,
    driverName?: string
  ): string {
    const name = driverName || 'Driver';

    const narrations: Record<string, string> = {
      'created': `New ${ticket.ticketType} ticket created. Ticket ${ticket.ticketId} for ${ticket.customerName} at ${ticket.jobAddress}. Waiting for driver assignment.`,

      'assigned': `${name}, you have been assigned to ticket ${ticket.ticketId}. This is a ${ticket.ticketType} for ${ticket.customerName} at ${ticket.jobAddress}, ${ticket.city}. ${ticket.materials.length} items to handle. Check your driver portal for full details.`,

      'materials_pulled': `Materials for ticket ${ticket.ticketId} have been pulled from the warehouse. ${ticket.materials.length} items are staged and ready for loading. Head to the loading dock.`,

      'load_verified': `Load verified for ticket ${ticket.ticketId}. All ${ticket.materials.length} items confirmed on the truck. You are clear to depart when ready.`,

      'en_route': `${name} is now en route to ${ticket.jobAddress}, ${ticket.city}. Delivery for ${ticket.customerName} is on the way. Drive safe.`,

      'arrived': `You have arrived at ${ticket.jobAddress}. Customer is ${ticket.customerName}. ${ticket.specialInstructions ? 'Special instructions: ' + ticket.specialInstructions + '.' : 'No special instructions.'} Begin unloading when ready.`,

      'delivered': `Delivery complete at ${ticket.jobAddress}. ${ticket.materials.length} items delivered to ${ticket.customerName}. Please capture proof of delivery photos and get a customer signature.`,

      'picked_up': `Pickup complete at ${ticket.jobAddress}. Materials collected from ${ticket.customerName}. Head back to the warehouse at ${this.config.warehouseAddress}.`,

      'proof_captured': `Proof of delivery captured for ticket ${ticket.ticketId}. Signature and photos are saved. You can proceed to your next stop.`,

      'qc_photos': `Quality control photos uploaded for ticket ${ticket.ticketId}. Nice work documenting the job site.`,

      'completed': `Ticket ${ticket.ticketId} is now complete. Great job, ${name}. ${ticket.customerName} at ${ticket.jobAddress} is all set. On to the next one.`,

      'cancelled': `Ticket ${ticket.ticketId} has been cancelled. If you were already loading, return all materials to warehouse storage. Contact the office for details.`,
    };

    return narrations[newStatus] || `Status updated from ${previousStatus} to ${newStatus} for ticket ${ticket.ticketId}.`;
  }

  // ============================================
  // SAFETY TIPS
  // ============================================

  getSafetyTips(options: {
    weather?: WeatherCondition;
    timeOfDay?: TimeOfDay;
    loadWeight?: number;
    materials?: Array<{ productName: string; quantity: number; unit: string }>;
  }): string[] {
    const tips: string[] = [];

    // Weather-based tips
    if (options.weather) {
      const weatherTips = WEATHER_SAFETY[options.weather];
      if (weatherTips) {
        tips.push(...weatherTips);
      }
    }

    // Time-based tips
    if (options.timeOfDay) {
      const timeTips = TIME_SAFETY[options.timeOfDay];
      if (timeTips) {
        tips.push(...timeTips);
      }
    }

    // Weight-based tips
    if (options.loadWeight) {
      if (options.loadWeight > 10000) {
        tips.push('Very heavy load. Drive with extra caution. Braking distance will be significantly longer. Avoid sudden stops.');
      } else if (options.loadWeight > 5000) {
        tips.push('Moderate to heavy load. Allow extra stopping distance and take turns slowly.');
      }
    }

    // Material-specific tips
    if (options.materials) {
      for (const material of options.materials) {
        const handling = this.getMaterialHandling(material.productName);
        if (handling.weightWarning) {
          tips.push(handling.weightWarning);
        }
      }
    }

    // Always include a general safety tip
    if (tips.length === 0) {
      tips.push('General safety reminder: Stay hydrated, wear your PPE, and follow proper lifting technique. If something feels unsafe, stop and call the office.');
    }

    return tips;
  }

  generateSafetyScript(options: {
    weather?: WeatherCondition;
    timeOfDay?: TimeOfDay;
    loadWeight?: number;
    materials?: Array<{ productName: string; quantity: number; unit: string }>;
  }): string {
    const tips = this.getSafetyTips(options);
    const lines = ['Safety briefing from your RCRS Assistant.'];
    for (const tip of tips) {
      lines.push(tip);
    }
    lines.push('Stay safe out there.');
    return lines.join(' ');
  }

  // ============================================
  // CONVERSATION TOPICS
  // ============================================

  getConversationTopic(): string {
    const index = Math.floor(Math.random() * CONVERSATION_TOPICS.length);
    return CONVERSATION_TOPICS[index];
  }

  getConversationTopics(count: number = 3): string[] {
    const shuffled = [...CONVERSATION_TOPICS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  generateConversationScript(): string {
    const topic = this.getConversationTopic();
    return `Here is something interesting. ${topic}`;
  }

  // ============================================
  // UTILITY: TIME OF DAY DETECTION
  // ============================================

  getCurrentTimeOfDay(): TimeOfDay {
    const hour = new Date().getHours();
    if (hour < 6) return 'early_morning';
    if (hour < 10) return 'morning';
    if (hour < 14) return 'midday';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  // ============================================
  // UTILITY: ESTIMATE LOAD WEIGHT
  // ============================================

  estimateLoadWeight(materials: Array<{ productName: string; quantity: number; unit: string }>): {
    estimatedPounds: number;
    isHeavy: boolean;
    warning?: string;
  } {
    // Rough weight estimates per unit for common roofing materials
    const weightPerUnit: Record<string, number> = {
      'shingles': 70,        // per bundle
      'underlayment': 60,    // per roll
      'felt': 50,            // per roll
      'plywood': 48,         // per sheet
      'osb': 52,             // per sheet
      'ridge cap': 30,       // per bundle
      'flashing': 15,        // per piece
      'drip edge': 8,        // per piece (10 ft)
      'nails': 50,           // per box
      'ice and water': 60,   // per roll
      'ventilation': 10,     // per piece
      'pipe boots': 2,       // per piece
      'sealant': 1,          // per tube
      'gutters': 12,         // per 10 ft section
      'lumber': 35,          // per board (2x4x8)
    };

    let totalWeight = 0;

    for (const material of materials) {
      const lower = material.productName.toLowerCase();
      let unitWeight = 30; // default estimate

      for (const [key, weight] of Object.entries(weightPerUnit)) {
        if (lower.includes(key)) {
          unitWeight = weight;
          break;
        }
      }

      totalWeight += unitWeight * material.quantity;
    }

    const isHeavy = totalWeight > 5000;
    let warning: string | undefined;

    if (totalWeight > 12000) {
      warning = `Estimated load weight is approximately ${Math.round(totalWeight)} pounds. This may approach the vehicle limit. Check the truck GVWR sticker and consider splitting the load.`;
    } else if (totalWeight > 8000) {
      warning = `Estimated load weight is approximately ${Math.round(totalWeight)} pounds. This is a heavy load. Drive carefully and allow extra braking distance.`;
    }

    return {
      estimatedPounds: Math.round(totalWeight),
      isHeavy,
      warning,
    };
  }

  // ============================================
  // COMPREHENSIVE BRIEFING
  // ============================================

  generateFullBriefing(
    ticket: TicketSummary,
    driverName: string,
    options?: { weather?: WeatherCondition }
  ): string {
    const timeOfDay = this.getCurrentTimeOfDay();
    const weightEstimate = this.estimateLoadWeight(ticket.materials);
    const lines: string[] = [];

    // Header
    lines.push(`${this.config.name} briefing for ${driverName}.`);
    lines.push(`Ticket ${ticket.ticketId}. ${ticket.ticketType} to ${ticket.jobName}.`);
    lines.push('');

    // Destination
    lines.push(`Destination: ${ticket.jobAddress}, ${ticket.city}.`);
    lines.push(`Customer: ${ticket.customerName}, phone ${ticket.customerPhone}.`);
    lines.push('');

    // Materials summary
    lines.push(`${ticket.materials.length} items to ${ticket.ticketType === 'delivery' ? 'deliver' : ticket.ticketType === 'pickup' ? 'pick up' : 'return'}.`);
    for (const m of ticket.materials) {
      lines.push(`${m.quantity} ${m.unit} of ${m.productName}.`);
    }
    lines.push('');

    // Weight
    lines.push(`Estimated total load weight: approximately ${weightEstimate.estimatedPounds} pounds.`);
    if (weightEstimate.warning) {
      lines.push(weightEstimate.warning);
    }
    lines.push('');

    // Priority
    if (ticket.priority !== 'normal') {
      lines.push(`Priority: ${ticket.priority.toUpperCase()}. Handle accordingly.`);
    }

    // Special instructions
    if (ticket.specialInstructions) {
      lines.push(`Special instructions: ${ticket.specialInstructions}`);
    }

    // Safety
    const safetyTips = this.getSafetyTips({
      weather: options?.weather,
      timeOfDay,
      loadWeight: weightEstimate.estimatedPounds,
      materials: ticket.materials,
    });
    if (safetyTips.length > 0) {
      lines.push('');
      lines.push('Safety notes:');
      // Include up to 3 safety tips in the briefing
      for (const tip of safetyTips.slice(0, 3)) {
        lines.push(tip);
      }
    }

    lines.push('');
    lines.push('That is your briefing. Questions? Ask me anytime or call the office at ' + this.config.companyPhone + '. Stay safe.');

    return lines.join(' ');
  }

  // ============================================
  // AGENT METADATA
  // ============================================

  getAgentInfo(): AgentConfig {
    return { ...this.config };
  }

  getAgentName(): string {
    return this.config.name;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const deliveryAIAgent = new DeliveryAIAgent();
