import { readFileSync } from 'fs';
import path from 'path';

// --- Types ---

export interface SpamFilterConfig {
  enabled: boolean;
  threshold: number;
  customBlockedDomains: string[];
  customBlockedPhrases: string[];
  allowList: string[];
}

export interface SpamCheckResult {
  isSpam: boolean;
  spamScore: number;
  reasons: string[];
  passedFilter: boolean; // true = not spam (or filter disabled)
}

// --- Constants ---

const DEFAULT_CONFIG: SpamFilterConfig = {
  enabled: true,
  threshold: 70,
  customBlockedDomains: [],
  customBlockedPhrases: [],
  allowList: [],
};

const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'grr.la',
  'discard.email',
  'fakeinbox.com',
  'mailnesia.com',
];

const SPAM_PHRASES = [
  'buy now',
  'click here',
  'bitcoin',
  'cryptocurrency',
  'seo services',
  'web traffic',
  'backlinks',
];

// --- Config loader ---

export async function getSpamFilterConfig(): Promise<SpamFilterConfig> {
  try {
    const configPath = path.join(process.cwd(), 'data', 'lead-distro-config.json');
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);

    if (config.spamFilter) {
      return {
        enabled: config.spamFilter.enabled ?? DEFAULT_CONFIG.enabled,
        threshold: config.spamFilter.threshold ?? DEFAULT_CONFIG.threshold,
        customBlockedDomains: config.spamFilter.customBlockedDomains ?? DEFAULT_CONFIG.customBlockedDomains,
        customBlockedPhrases: config.spamFilter.customBlockedPhrases ?? DEFAULT_CONFIG.customBlockedPhrases,
        allowList: config.spamFilter.allowList ?? DEFAULT_CONFIG.allowList,
      };
    }
  } catch {
    // Config file missing or malformed — use defaults
  }

  return { ...DEFAULT_CONFIG };
}

// --- Individual checks ---

function checkGibberishName(name: string): { score: number; reason: string } | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { score: 30, reason: 'Name is too short (fewer than 2 characters)' };
  }

  const lower = trimmed.toLowerCase();
  const vowels = /[aeiou]/;
  if (!vowels.test(lower)) {
    return { score: 30, reason: 'Name contains no vowels (likely gibberish)' };
  }

  // All same character (e.g. "aaaa")
  if (new Set(lower.replace(/\s/g, '')).size === 1) {
    return { score: 30, reason: 'Name is all the same character' };
  }

  return null;
}

function checkDisposableEmail(
  email: string,
  customBlockedDomains: string[]
): { score: number; reason: string } | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  const allBlocked = [...DISPOSABLE_EMAIL_DOMAINS, ...customBlockedDomains.map(d => d.toLowerCase())];
  if (allBlocked.includes(domain)) {
    return { score: 25, reason: `Disposable email domain: ${domain}` };
  }

  return null;
}

function checkSuspiciousEmailPattern(email: string): { score: number; reason: string } | null {
  const lower = email.toLowerCase();
  const localPart = lower.split('@')[0];
  if (!localPart) return null;

  const suspiciousPrefixes = ['test', 'noreply', 'asdf'];
  for (const prefix of suspiciousPrefixes) {
    if (localPart === prefix) {
      return { score: 15, reason: `Suspicious email prefix: ${prefix}@` };
    }
  }

  // All numbers before @
  if (/^\d+$/.test(localPart)) {
    return { score: 15, reason: 'Email local part is all numbers' };
  }

  return null;
}

function checkInvalidPhone(phone: string): { score: number; reason: string } | null {
  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.length < 7) {
    return { score: 20, reason: `Phone has fewer than 7 digits (${digitsOnly.length})` };
  }

  // All same digit
  if (new Set(digitsOnly).size === 1) {
    return { score: 20, reason: 'Phone number is all the same digit' };
  }

  return null;
}

function checkSuspiciousMessage(
  message: string,
  customBlockedPhrases: string[]
): { score: number; reason: string } | null {
  const lower = message.toLowerCase();
  const allPhrases = [...SPAM_PHRASES, ...customBlockedPhrases.map(p => p.toLowerCase())];

  const found = allPhrases.filter(phrase => lower.includes(phrase));
  if (found.length > 0) {
    return { score: 15, reason: `Message contains spam phrases: ${found.join(', ')}` };
  }

  return null;
}

function checkUrlInName(name: string): { score: number; reason: string } | null {
  const lower = name.toLowerCase();
  if (lower.includes('http') || lower.includes('www') || lower.includes('.com')) {
    return { score: 35, reason: 'Name contains a URL' };
  }
  return null;
}

function checkFastSubmission(timingMs: number): { score: number; reason: string } | null {
  if (timingMs < 2000) {
    return { score: 10, reason: `Form submitted very quickly (${timingMs}ms — likely bot)` };
  }
  return null;
}

function checkAllCapsName(name: string): { score: number; reason: string } | null {
  const trimmed = name.trim();
  if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return { score: 10, reason: 'Name is entirely uppercase' };
  }
  return null;
}

// --- Main entry point ---

export async function checkForSpam(data: {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  address?: string;
  submissionTimingMs?: number;
}): Promise<SpamCheckResult> {
  const config = await getSpamFilterConfig();

  // Filter disabled — always pass
  if (!config.enabled) {
    return { isSpam: false, spamScore: 0, reasons: [], passedFilter: true };
  }

  // Allow-listed emails always pass
  if (config.allowList.map(e => e.toLowerCase()).includes(data.email.toLowerCase())) {
    return { isSpam: false, spamScore: 0, reasons: ['Email is on allow list'], passedFilter: true };
  }

  // Hard block: customBlockedDomains short-circuit regardless of threshold.
  // Disposable-email domains still go through the scoring path (25 pts) since
  // a real customer might be using one legitimately. Custom block list is for
  // known outreach-spam tools where every submission is bot pitch.
  const senderDomain = data.email.split('@')[1]?.toLowerCase();
  if (senderDomain && config.customBlockedDomains.map(d => d.toLowerCase()).includes(senderDomain)) {
    return {
      isSpam: true,
      spamScore: 100,
      reasons: [`Hard-blocked domain: ${senderDomain}`],
      passedFilter: false,
    };
  }

  let score = 0;
  const reasons: string[] = [];

  function addResult(result: { score: number; reason: string } | null) {
    if (result) {
      score += result.score;
      reasons.push(result.reason);
    }
  }

  // 1. Gibberish name
  addResult(checkGibberishName(data.name));

  // 2. Disposable email domain
  addResult(checkDisposableEmail(data.email, config.customBlockedDomains));

  // 3. Suspicious email pattern
  addResult(checkSuspiciousEmailPattern(data.email));

  // 4. Invalid phone
  if (data.phone) {
    addResult(checkInvalidPhone(data.phone));
  }

  // 5. Suspicious message content
  if (data.message) {
    addResult(checkSuspiciousMessage(data.message, config.customBlockedPhrases));
  }

  // 6. URL in name
  addResult(checkUrlInName(data.name));

  // 7. Fast submission
  if (data.submissionTimingMs !== undefined) {
    addResult(checkFastSubmission(data.submissionTimingMs));
  }

  // 8. All-caps name
  addResult(checkAllCapsName(data.name));

  // Cap score at 100
  score = Math.min(score, 100);

  const isSpam = score >= config.threshold;

  return {
    isSpam,
    spamScore: score,
    reasons,
    passedFilter: !isSpam,
  };
}
