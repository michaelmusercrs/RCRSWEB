/**
 * Lead Tracking and Management System
 * Track, score, and manage customer leads
 */

export interface Lead {
  id: string;
  timestamp: Date;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  preferredInspector: string;
  source: string; // web form, phone, email, referral
  status: 'new' | 'contacted' | 'scheduled' | 'completed' | 'lost';
  score: number; // Lead quality score 0-100
  assignedTo?: string;
  notes?: string[];
  contactAttempts?: number;
  lastContactDate?: Date;
  scheduledDate?: Date;
  completedDate?: Date;
  revenue?: number;
  tags?: string[];
}

export interface LeadMetrics {
  total: number;
  new: number;
  contacted: number;
  scheduled: number;
  completed: number;
  lost: number;
  conversionRate: number;
  avgResponseTime: number; // in hours
  avgScore: number;
  totalRevenue: number;
}

/**
 * Calculate lead quality score based on various factors
 */
export function calculateLeadScore(lead: Partial<Lead>): number {
  let score = 50; // Base score

  // Phone provided (+20)
  if (lead.phone && lead.phone.length >= 10) {
    score += 20;
  }

  // Message length indicates seriousness (+0-15)
  if (lead.message) {
    const wordCount = lead.message.split(/\s+/).length;
    if (wordCount > 50) score += 15;
    else if (wordCount > 20) score += 10;
    else if (wordCount > 10) score += 5;
  }

  // Inspector preference shows research (+10)
  if (lead.preferredInspector && lead.preferredInspector !== 'first-available') {
    score += 10;
  }

  // Subject indicates specific need (+5)
  const urgentKeywords = ['urgent', 'asap', 'emergency', 'leak', 'damage', 'storm'];
  if (lead.subject && urgentKeywords.some(kw => lead.subject!.toLowerCase().includes(kw))) {
    score += 10;
  }

  // Email domain quality (+5 for business email)
  if (lead.email) {
    const domain = lead.email.split('@')[1];
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
      score += 5;
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Categorize lead based on score
 */
export function getLeadPriority(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'warm';
  return 'cold';
}

/**
 * Calculate metrics from leads array
 */
export function calculateMetrics(leads: Lead[]): LeadMetrics {
  const total = leads.length;
  const new_ = leads.filter(l => l.status === 'new').length;
  const contacted = leads.filter(l => l.status === 'contacted').length;
  const scheduled = leads.filter(l => l.status === 'scheduled').length;
  const completed = leads.filter(l => l.status === 'completed').length;
  const lost = leads.filter(l => l.status === 'lost').length;

  const conversionRate = total > 0 ? (completed / total) * 100 : 0;

  // Calculate average response time (new to contacted)
  const contactedLeads = leads.filter(l => l.lastContactDate && l.status !== 'new');
  const avgResponseTime = contactedLeads.length > 0
    ? contactedLeads.reduce((sum, lead) => {
        const responseTime = lead.lastContactDate!.getTime() - lead.timestamp.getTime();
        return sum + (responseTime / (1000 * 60 * 60)); // Convert to hours
      }, 0) / contactedLeads.length
    : 0;

  const avgScore = total > 0
    ? leads.reduce((sum, lead) => sum + lead.score, 0) / total
    : 0;

  const totalRevenue = leads
    .filter(l => l.revenue)
    .reduce((sum, lead) => sum + (lead.revenue || 0), 0);

  return {
    total,
    new: new_,
    contacted,
    scheduled,
    completed,
    lost,
    conversionRate,
    avgResponseTime,
    avgScore,
    totalRevenue,
  };
}

/**
 * Get recommended next action for a lead
 */
export function getRecommendedAction(lead: Lead): string {
  const hoursSinceSubmission = (Date.now() - lead.timestamp.getTime()) / (1000 * 60 * 60);

  switch (lead.status) {
    case 'new':
      if (hoursSinceSubmission > 24) {
        return 'URGENT: Call immediately - lead is over 24 hours old';
      } else if (hoursSinceSubmission > 1) {
        return 'Call within 1 hour for 7x higher conversion';
      }
      return 'New lead - call as soon as possible';

    case 'contacted':
      if (!lead.scheduledDate) {
        return 'Schedule inspection appointment';
      }
      return 'Follow up on scheduling';

    case 'scheduled':
      if (lead.scheduledDate && lead.scheduledDate < new Date()) {
        return 'Complete inspection and provide quote';
      }
      return 'Send reminder 24 hours before appointment';

    case 'completed':
      return 'Follow up on quote acceptance';

    case 'lost':
      return 'Archive or mark for future follow-up';

    default:
      return 'Review lead status';
  }
}

/**
 * Suggest best inspector based on lead details and team availability
 */
export function suggestInspector(lead: Partial<Lead>, teamMembers: any[]): string {
  // If lead has preference, honor it
  if (lead.preferredInspector && lead.preferredInspector !== 'first-available') {
    return lead.preferredInspector;
  }

  // Filter to sales inspectors only
  const inspectors = teamMembers.filter(
    m => m.position.toLowerCase().includes('inspector') || m.position.toLowerCase().includes('sales')
  );

  if (inspectors.length === 0) {
    return 'first-available';
  }

  // Simple round-robin or random selection
  // In real implementation, consider: location, availability, workload, expertise
  const randomIndex = Math.floor(Math.random() * inspectors.length);
  return inspectors[randomIndex].slug;
}

/**
 * Format lead for email notification
 */
export function formatLeadForEmail(lead: Partial<Lead>): string {
  const score = lead.score || calculateLeadScore(lead);
  const priority = getLeadPriority(score);

  return `
NEW LEAD - ${priority.toUpperCase()} PRIORITY (Score: ${score}/100)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Received: ${lead.timestamp || new Date()}

👤 CONTACT:
Name:  ${lead.name}
Email: ${lead.email}
Phone: ${lead.phone || 'Not provided'}

📋 REQUEST:
Subject: ${lead.subject}
Inspector: ${lead.preferredInspector || 'First Available'}

💬 MESSAGE:
${lead.message}

⚡ PRIORITY: ${priority.toUpperCase()}
Lead Score: ${score}/100

🎯 RECOMMENDED ACTION:
${lead.status ? getRecommendedAction(lead as Lead) : 'Call within 1 hour'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}
