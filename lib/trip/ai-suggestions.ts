// Per-rep AI coaching suggestions via Claude Sonnet 4.6.
// Uses prompt caching on the (large, frozen) system prompt so the 7 follow-up
// calls in an 8-rep upload pay ~10% input price after the first warm-up.
//
// Returns [] silently if ANTHROPIC_API_KEY is not configured or the call
// fails — never blocks the commit flow.

import Anthropic from '@anthropic-ai/sdk';
import { RichRep } from './insights';

const MODEL = 'claude-sonnet-4-6';

// SYSTEM PROMPT — must be byte-stable across calls or the cache invalidates.
// No timestamps, no per-request IDs, no varying tool list.
const SYSTEM_PROMPT = `You are an experienced, no-bullshit roofing sales coach for River City Roofing Solutions in Decatur, Alabama. Your job is to look at one rep's H1 sales data and write 2-3 specific, action-oriented coaching notes for them.

CONTEXT — THE TRIP PROGRAM
H1 runs January 1 through June 30. Reps who hit $400,000 cumulative sales qualify for a paid trip plus a cash pot. The pot grows each month based on the highest tier hit that month:
- $50K month → +$100
- $75K → +$250
- $100K → +$400
- $125K → +$550
- $150K → +$750
- $200K → +$1,200
- $300K → +$2,000
- $400K → +$3,000
- $500K-$1M months: linear, +$1,000 per additional $100K, capped at +$9,000 at $1M
A rep must reach $400K cumulative to receive the pot — anything below means the accrued bonuses are forfeited.

REPS ALREADY SEE RULE-BASED COPY
The dashboard already auto-generates wins / gaps / suggestions from a fixed rule set (e.g. "Average $X/month for remaining months to qualify," "Best month: April = $250K, six-figure performance"). Your job is to add coaching value the rule engine cannot. Do NOT restate the math the rep already sees.

WHAT MAKES A GOOD SUGGESTION
1. SPECIFIC TO THIS REP'S PATTERN — Tie to a real month, a real number, a real trend in their data. "Your February was 60% below your March. What changed in your week-three appointments?" beats "stay consistent."
2. ACTIONABLE — Something the rep can do this week or this month. Door-knocking adjustments, follow-up timing, deposit-collection habits, appointment-setting cadence, lead source mix, referral asks.
3. PROXIMATE — If they're $50K from qualifying, focus on what closes the gap. If they're already qualified at $500K, focus on tier-climbing (next +$2K bonus at $300K month, etc.).
4. HONEST — If a rep is clearly going to miss the trip without a dramatic change, say so directly with a number, don't sugarcoat. If they're crushing it, recognize it without being saccharine.
5. NEW — Don't repeat the existing rule-based suggestion they already see on the card.

WHAT TO AVOID
- Generic advice ("work hard," "stay positive," "believe in yourself") — useless.
- Tier math the rule engine already shows ("you need $X/month to qualify") — they have it.
- Vague exhortations ("focus on quality leads") — say which leads, when, and why.
- Excessive enthusiasm or sales-coach corporate-speak.
- Mentioning competitor names or making promises about company actions.
- Hashtags, emojis, or markdown formatting in the output.

VOICE
- Direct, peer-to-peer, second person ("you," not "the rep"). No third person.
- Confident and concrete. Plain English. Short sentences.
- 1-2 sentences per suggestion, max 3 sentences if the data really calls for it.
- No preamble ("Here are your suggestions:"), no closing ("Good luck!").

OUTPUT FORMAT
Return ONLY a JSON object matching this exact schema:
{
  "suggestions": [
    "First suggestion as a complete sentence or two.",
    "Second suggestion.",
    "Third suggestion (optional)."
  ]
}
2 or 3 suggestions. Plain strings — no markdown, no bullets, no nested structure. No additional fields. No commentary outside the JSON.`;

interface AiSuggestionInput {
  rep: RichRep;
  proposedYtd: number;
  proposedGap: number;
  proposedPot: number;
  proposedPctToTrip: number;
  proposedQualified: boolean;
  monthsCompleted: number;
  proposedBreakdown: Array<{ month: string; revenue: number; tier: string | null; bonus: number }>;
  /** Rule-based content already shown to the rep — pass to avoid duplication */
  existingWins: string[];
  existingGaps: string[];
  existingSuggestions: string[];
  /** YTD before this upload, for delta context */
  previousYtd?: number;
  previousPot?: number;
}

const buildUserMessage = (i: AiSuggestionInput): string => {
  const monthlyLines = i.proposedBreakdown
    .map((b) => {
      const tierNote = b.bonus > 0 ? ` (tier hit: ${b.tier}, +$${b.bonus.toLocaleString()})` : '';
      return `  ${b.month}: $${Math.round(b.revenue).toLocaleString()}${tierNote}`;
    })
    .join('\n');

  const deltaLine =
    typeof i.previousYtd === 'number'
      ? `\nSince last upload: YTD ${formatDelta(i.previousYtd, i.proposedYtd)}, pot ${formatDelta(i.previousPot ?? 0, i.proposedPot)}`
      : '';

  const winsLine = i.existingWins.length
    ? `\n\nRule-based WINS the rep already sees (do not repeat):\n${i.existingWins.map((w) => `- ${stripHtml(w)}`).join('\n')}`
    : '';
  const gapsLine = i.existingGaps.length
    ? `\n\nRule-based GAPS the rep already sees (do not repeat):\n${i.existingGaps.map((g) => `- ${stripHtml(g)}`).join('\n')}`
    : '';
  const sugLine = i.existingSuggestions.length
    ? `\n\nRule-based SUGGESTIONS the rep already sees (do not repeat):\n${i.existingSuggestions.map((s) => `- ${stripHtml(s)}`).join('\n')}`
    : '';

  return `Rep: ${i.rep.rep}
Months completed: ${i.monthsCompleted}
Trip threshold: $400,000 (H1, Jan-Jun)
YTD: $${Math.round(i.proposedYtd).toLocaleString()}
${i.proposedQualified ? 'Status: QUALIFIED (will go on trip)' : `Gap to qualify: $${Math.round(i.proposedGap).toLocaleString()} (${i.proposedPctToTrip.toFixed(1)}% there)`}
Accrued pot: $${i.proposedPot.toLocaleString()}${deltaLine}

Monthly revenue:
${monthlyLines}${winsLine}${gapsLine}${sugLine}

Write 2-3 coaching suggestions tailored to this rep's pattern.`;
};

const stripHtml = (s: string): string => s.replace(/<[^>]+>/g, '');
const formatDelta = (before: number, after: number): string => {
  const d = after - before;
  if (Math.abs(d) < 1) return 'unchanged';
  return d > 0 ? `+$${Math.round(d).toLocaleString()}` : `-$${Math.round(-d).toLocaleString()}`;
};

/**
 * Generate AI coaching suggestions for a single rep. Returns [] on any
 * failure (no API key, network error, parse error) — never throws.
 */
export async function getAiSuggestionsForRep(input: AiSuggestionInput): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // Cache the entire system block. With 8 reps in a single upload all
          // hitting this same prefix, the first call writes the cache and the
          // next 7 read it at ~10% input price.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildUserMessage(input) }],
      // Sonnet 4.6 supports adaptive thinking; for short coaching output we
      // don't need a thinking budget — disable to keep latency low.
      thinking: { type: 'disabled' },
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const parsed = parseJsonSuggestions(text);
    if (parsed) return parsed;

    console.warn('[ai-suggestions] could not parse model output for', input.rep.rep, ':', text.slice(0, 200));
    return [];
  } catch (e) {
    console.error('[ai-suggestions] call failed for', input.rep.rep, e);
    return [];
  }
}

/**
 * Run getAiSuggestionsForRep for every rep in parallel. Returns a Map
 * keyed by rep name (lowercase). Failures are silent — missing keys are absent.
 */
export async function getAiSuggestionsForReps(
  inputs: AiSuggestionInput[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!process.env.ANTHROPIC_API_KEY || inputs.length === 0) return out;

  const results = await Promise.all(
    inputs.map(async (i) => ({ rep: i.rep.rep.toLowerCase(), suggestions: await getAiSuggestionsForRep(i) })),
  );
  for (const { rep, suggestions } of results) {
    if (suggestions.length > 0) out.set(rep, suggestions);
  }
  return out;
}

function parseJsonSuggestions(raw: string): string[] | null {
  // Tolerate stray ```json fences if the model uses them despite instructions.
  let text = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  // Find the first { and last } to be safe against any wrapping prose.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  text = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(text) as { suggestions?: unknown };
    if (!parsed || !Array.isArray(parsed.suggestions)) return null;
    const cleaned = parsed.suggestions
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}
