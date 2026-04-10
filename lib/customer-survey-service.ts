/**
 * RCRS Customer Satisfaction Survey Service
 *
 * Manages survey creation, distribution, response collection, and analytics.
 * Supports rating, NPS, text, yes/no, and multiple choice question types.
 * Calculates sentiment, NPS scores, and per-rep breakdowns.
 *
 * Persistence (2026-04-09): Surveys and responses both live on the
 * SHEET_NAMES.SURVEY_RESPONSES tab, differentiated by a `type` column
 * (`survey` vs `response`). Invitations live on SHEET_NAMES.CUSTOMER_SURVEY_TOKENS.
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// =============================================================================
// TYPES
// =============================================================================

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'rating' | 'text' | 'yes_no' | 'multiple_choice' | 'nps';
  required: boolean;
  options?: string[];
  order: number;
}

export interface Survey {
  id: string;
  name: string;
  type: 'post_install' | 'annual_checkup' | 'service_call' | 'general';
  questions: SurveyQuestion[];
  isActive: boolean;
  createdAt: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  surveyName: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  jobId?: string;
  repSlug?: string;
  repName?: string;

  answers: { questionId: string; value: string | number }[];

  overallRating: number; // 1-5 calculated from rating questions
  npsScore?: number; // 0-10
  sentiment: 'positive' | 'neutral' | 'negative';

  submittedAt: string;
  token: string; // for public survey link

  followUpNeeded: boolean;
  followUpNote?: string;
  followUpCompletedAt?: string;
}

export interface SurveyAnalytics {
  totalResponses: number;
  avgRating: number;
  npsScore: number; // -100 to 100
  responseRate: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  byQuestion: { questionId: string; questionText: string; avgRating?: number; responses: number }[];
  byRep: { repSlug: string; repName: string; avgRating: number; count: number }[];
  trends: { month: string; avgRating: number; count: number }[];
}

// Represents a pending survey invitation
interface SurveyInvitation {
  token: string;
  surveyId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  repSlug?: string;
  repName?: string;
  jobId?: string;
  sentAt: string;
  method: 'email' | 'sms';
}

// =============================================================================
// SHEET SCHEMAS
// =============================================================================

/**
 * Unified survey/response tab. `type` discriminates between a survey definition
 * row (`survey`) and a customer response row (`response`). Irrelevant columns
 * for the other kind are simply blank.
 */
const SURVEY_ROW_HEADERS: string[] = [
  'id',
  'type',
  // survey columns
  'surveyName',
  'surveyType',
  'questions',
  'isActive',
  'createdAt',
  // response columns
  'surveyId',
  'customerId',
  'customerName',
  'customerEmail',
  'jobId',
  'repSlug',
  'repName',
  'answers',
  'overallRating',
  'npsScore',
  'sentiment',
  'submittedAt',
  'token',
  'followUpNeeded',
  'followUpNote',
  'followUpCompletedAt',
];

const INVITATION_HEADERS: string[] = [
  'token',
  'surveyId',
  'customerId',
  'customerName',
  'customerEmail',
  'repSlug',
  'repName',
  'jobId',
  'sentAt',
  'method',
];

// =============================================================================
// HELPERS
// =============================================================================

function generateId(): string {
  return crypto.randomBytes(6).toString('hex');
}

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

function parseJsonField<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function rowToSurvey(row: Record<string, string>): Survey {
  return {
    id: row.id || '',
    name: row.surveyName || '',
    type: (row.surveyType as Survey['type']) || 'general',
    questions: parseJsonField<SurveyQuestion[]>(row.questions, []),
    isActive: row.isActive === 'true',
    createdAt: row.createdAt || '',
  };
}

function surveyToRow(s: Survey): Record<string, unknown> {
  return {
    id: s.id,
    type: 'survey',
    surveyName: s.name,
    surveyType: s.type,
    questions: JSON.stringify(s.questions),
    isActive: s.isActive,
    createdAt: s.createdAt,
    surveyId: '',
    customerId: '',
    customerName: '',
    customerEmail: '',
    jobId: '',
    repSlug: '',
    repName: '',
    answers: '',
    overallRating: '',
    npsScore: '',
    sentiment: '',
    submittedAt: '',
    token: '',
    followUpNeeded: '',
    followUpNote: '',
    followUpCompletedAt: '',
  };
}

function rowToResponse(row: Record<string, string>): SurveyResponse {
  return {
    id: row.id || '',
    surveyId: row.surveyId || '',
    surveyName: row.surveyName || '',
    customerId: row.customerId || '',
    customerName: row.customerName || '',
    customerEmail: row.customerEmail || undefined,
    jobId: row.jobId || undefined,
    repSlug: row.repSlug || undefined,
    repName: row.repName || undefined,
    answers: parseJsonField<{ questionId: string; value: string | number }[]>(row.answers, []),
    overallRating: Number(row.overallRating) || 0,
    npsScore: parseNumber(row.npsScore),
    sentiment: (row.sentiment as SurveyResponse['sentiment']) || 'neutral',
    submittedAt: row.submittedAt || '',
    token: row.token || '',
    followUpNeeded: row.followUpNeeded === 'true',
    followUpNote: row.followUpNote || undefined,
    followUpCompletedAt: row.followUpCompletedAt || undefined,
  };
}

function responseToRow(r: SurveyResponse): Record<string, unknown> {
  return {
    id: r.id,
    type: 'response',
    surveyName: r.surveyName,
    surveyType: '',
    questions: '',
    isActive: '',
    createdAt: '',
    surveyId: r.surveyId,
    customerId: r.customerId,
    customerName: r.customerName,
    customerEmail: r.customerEmail ?? '',
    jobId: r.jobId ?? '',
    repSlug: r.repSlug ?? '',
    repName: r.repName ?? '',
    answers: JSON.stringify(r.answers),
    overallRating: r.overallRating,
    npsScore: r.npsScore ?? '',
    sentiment: r.sentiment,
    submittedAt: r.submittedAt,
    token: r.token,
    followUpNeeded: r.followUpNeeded,
    followUpNote: r.followUpNote ?? '',
    followUpCompletedAt: r.followUpCompletedAt ?? '',
  };
}

function rowToInvitation(row: Record<string, string>): SurveyInvitation {
  return {
    token: row.token || '',
    surveyId: row.surveyId || '',
    customerId: row.customerId || '',
    customerName: row.customerName || '',
    customerEmail: row.customerEmail || '',
    repSlug: row.repSlug || undefined,
    repName: row.repName || undefined,
    jobId: row.jobId || undefined,
    sentAt: row.sentAt || '',
    method: (row.method as 'email' | 'sms') || 'email',
  };
}

// =============================================================================
// SENTIMENT + NPS HELPERS
// =============================================================================

function determineSentiment(overallRating: number, npsScore?: number): 'positive' | 'neutral' | 'negative' {
  if (npsScore !== undefined) {
    const combined = (overallRating / 5) * 0.6 + (npsScore / 10) * 0.4;
    if (combined >= 0.7) return 'positive';
    if (combined >= 0.4) return 'neutral';
    return 'negative';
  }
  if (overallRating >= 4) return 'positive';
  if (overallRating >= 3) return 'neutral';
  return 'negative';
}

function calculateNPS(responses: SurveyResponse[]): number {
  const npsResponses = responses.filter((r) => r.npsScore !== undefined);
  if (npsResponses.length === 0) return 0;

  let promoters = 0;
  let detractors = 0;

  npsResponses.forEach((r) => {
    if (r.npsScore! >= 9) promoters++;
    else if (r.npsScore! <= 6) detractors++;
  });

  return Math.round(((promoters - detractors) / npsResponses.length) * 100);
}

// =============================================================================
// SERVICE
// =============================================================================

class CustomerSurveyService {
  private surveyCache: Survey[] | null = null;
  private responseCache: SurveyResponse[] | null = null;
  private invitationCache: SurveyInvitation[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  // ---------------------------------------------------------------------------
  // Sheet I/O
  // ---------------------------------------------------------------------------

  private async loadUnified(): Promise<void> {
    if (
      this.surveyCache !== null &&
      this.responseCache !== null &&
      Date.now() < this.cacheExpiresAt
    ) {
      return;
    }
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.SURVEY_RESPONSES,
      SURVEY_ROW_HEADERS,
    );
    const surveys: Survey[] = [];
    const responses: SurveyResponse[] = [];
    for (const row of rows) {
      if (row.type === 'survey') {
        surveys.push(rowToSurvey(row));
      } else if (row.type === 'response') {
        responses.push(rowToResponse(row));
      }
    }
    this.surveyCache = surveys;
    this.responseCache = responses;
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
  }

  private async loadSurveys(): Promise<Survey[]> {
    await this.loadUnified();
    return this.surveyCache!;
  }

  private async loadResponses(): Promise<SurveyResponse[]> {
    await this.loadUnified();
    return this.responseCache!;
  }

  private async loadInvitations(): Promise<SurveyInvitation[]> {
    if (this.invitationCache && Date.now() < this.cacheExpiresAt) {
      return this.invitationCache;
    }
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.CUSTOMER_SURVEY_TOKENS,
      INVITATION_HEADERS,
    );
    this.invitationCache = rows.map(rowToInvitation);
    return this.invitationCache;
  }

  private invalidateCaches(): void {
    this.surveyCache = null;
    this.responseCache = null;
    this.invitationCache = null;
    this.cacheExpiresAt = 0;
  }

  private async upsertSurvey(survey: Survey): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.SURVEY_RESPONSES,
      SURVEY_ROW_HEADERS,
      'id',
      surveyToRow(survey),
    );
    this.invalidateCaches();
  }

  private async upsertResponse(response: SurveyResponse): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.SURVEY_RESPONSES,
      SURVEY_ROW_HEADERS,
      'id',
      responseToRow(response),
    );
    this.invalidateCaches();
  }

  private async appendInvitation(invitation: SurveyInvitation): Promise<void> {
    await googleSheetsService.appendGenericRow(
      SHEET_NAMES.CUSTOMER_SURVEY_TOKENS,
      INVITATION_HEADERS,
      invitation as unknown as Record<string, unknown>,
    );
    this.invitationCache = null;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Create a new survey template.
   */
  async createSurvey(data: {
    name: string;
    type: Survey['type'];
    questions: Omit<SurveyQuestion, 'id'>[];
  }): Promise<Survey> {
    const survey: Survey = {
      id: `survey-${generateId()}`,
      name: data.name,
      type: data.type,
      isActive: true,
      createdAt: new Date().toISOString(),
      questions: data.questions.map((q, idx) => ({
        ...q,
        id: `q-${generateId()}`,
        order: q.order || idx + 1,
      })),
    };

    await this.upsertSurvey(survey);
    return survey;
  }

  /**
   * Get all surveys.
   */
  async getSurveys(): Promise<Survey[]> {
    return this.loadSurveys();
  }

  /**
   * Get a single survey by ID.
   */
  async getSurvey(surveyId: string): Promise<Survey | null> {
    const surveys = await this.loadSurveys();
    return surveys.find((s) => s.id === surveyId) || null;
  }

  /**
   * Send a survey to a customer. Creates an invitation token.
   */
  async sendSurvey(
    surveyId: string,
    customerId: string,
    customerName: string,
    customerEmail: string,
    method: 'email' | 'sms' = 'email',
    repSlug?: string,
    repName?: string,
    jobId?: string
  ): Promise<{ token: string; surveyUrl: string }> {
    const survey = await this.getSurvey(surveyId);
    if (!survey) throw new Error(`Survey ${surveyId} not found`);
    if (!survey.isActive) throw new Error('Survey is not active');

    const token = generateToken();

    await this.appendInvitation({
      token,
      surveyId,
      customerId,
      customerName,
      customerEmail,
      repSlug,
      repName,
      jobId,
      sentAt: new Date().toISOString(),
      method,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.rivercityroofingsolutions.com';
    const surveyUrl = `${baseUrl}/survey/${token}`;

    return { token, surveyUrl };
  }

  /**
   * Get the survey associated with a token (for the public survey page).
   */
  async getSurveyByToken(token: string): Promise<{ survey: Survey; invitation: SurveyInvitation } | null> {
    const invitations = await this.loadInvitations();
    const invitation = invitations.find((i) => i.token === token);
    if (!invitation) return null;

    // Check if already submitted
    const responses = await this.loadResponses();
    const existing = responses.find((r) => r.token === token);
    if (existing) return null; // Already submitted

    const survey = await this.getSurvey(invitation.surveyId);
    if (!survey) return null;

    return { survey, invitation };
  }

  /**
   * Submit a survey response from a customer.
   */
  async submitResponse(
    token: string,
    answers: { questionId: string; value: string | number }[]
  ): Promise<SurveyResponse> {
    const invitations = await this.loadInvitations();
    const invitation = invitations.find((i) => i.token === token);
    if (!invitation) throw new Error('Invalid survey token');

    // Check for duplicate submission
    const responses = await this.loadResponses();
    const existing = responses.find((r) => r.token === token);
    if (existing) throw new Error('Survey already submitted');

    const survey = await this.getSurvey(invitation.surveyId);
    if (!survey) throw new Error('Survey not found');

    // Validate required questions
    const requiredIds = survey.questions.filter((q) => q.required).map((q) => q.id);
    const answeredIds = answers.map((a) => a.questionId);
    const missing = requiredIds.filter((id) => !answeredIds.includes(id));
    if (missing.length > 0) {
      const missingTexts = missing.map((id) => {
        const q = survey.questions.find((q) => q.id === id);
        return q?.text || id;
      });
      throw new Error(`Missing required answers: ${missingTexts.join(', ')}`);
    }

    // Calculate overall rating from rating-type questions
    const ratingAnswers = answers.filter((a) => {
      const q = survey.questions.find((q) => q.id === a.questionId);
      return q?.type === 'rating';
    });
    const overallRating = ratingAnswers.length > 0
      ? Math.round((ratingAnswers.reduce((sum, a) => sum + Number(a.value), 0) / ratingAnswers.length) * 100) / 100
      : 3; // default neutral

    // Extract NPS score
    const npsAnswer = answers.find((a) => {
      const q = survey.questions.find((q) => q.id === a.questionId);
      return q?.type === 'nps';
    });
    const npsScore = npsAnswer ? Number(npsAnswer.value) : undefined;

    const sentiment = determineSentiment(overallRating, npsScore);

    // Flag for follow-up if negative
    const followUpNeeded = sentiment === 'negative' || overallRating <= 2 || (npsScore !== undefined && npsScore <= 4);

    const response: SurveyResponse = {
      id: generateId(),
      surveyId: invitation.surveyId,
      surveyName: survey.name,
      customerId: invitation.customerId,
      customerName: invitation.customerName,
      customerEmail: invitation.customerEmail,
      jobId: invitation.jobId,
      repSlug: invitation.repSlug,
      repName: invitation.repName,
      answers,
      overallRating,
      npsScore,
      sentiment,
      submittedAt: new Date().toISOString(),
      token,
      followUpNeeded,
    };

    await this.upsertResponse(response);
    return response;
  }

  /**
   * Get responses, optionally filtered.
   */
  async getResponses(options?: {
    surveyId?: string;
    repSlug?: string;
    startDate?: string;
    endDate?: string;
    sentiment?: string;
    followUpNeeded?: boolean;
  }): Promise<SurveyResponse[]> {
    let responses = await this.loadResponses();

    if (options?.surveyId) {
      responses = responses.filter((r) => r.surveyId === options.surveyId);
    }
    if (options?.repSlug) {
      responses = responses.filter((r) => r.repSlug === options.repSlug);
    }
    if (options?.startDate) {
      responses = responses.filter((r) => r.submittedAt >= options.startDate!);
    }
    if (options?.endDate) {
      responses = responses.filter((r) => r.submittedAt <= options.endDate! + 'T23:59:59Z');
    }
    if (options?.sentiment) {
      responses = responses.filter((r) => r.sentiment === options.sentiment);
    }
    if (options?.followUpNeeded !== undefined) {
      responses = responses.filter((r) => r.followUpNeeded === options.followUpNeeded);
    }

    // Sort newest first
    return [...responses].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  /**
   * Get analytics for surveys.
   */
  async getAnalytics(surveyId?: string, dateRange?: { start: string; end: string }): Promise<SurveyAnalytics> {
    const responses = await this.getResponses({
      surveyId,
      startDate: dateRange?.start,
      endDate: dateRange?.end,
    });

    const totalResponses = responses.length;

    // Average rating
    const avgRating = totalResponses > 0
      ? Math.round((responses.reduce((s, r) => s + r.overallRating, 0) / totalResponses) * 100) / 100
      : 0;

    // NPS
    const npsScore = calculateNPS(responses);

    // Response rate (invitations sent vs responses)
    const invitations = await this.loadInvitations();
    let relevantInvitations = invitations;
    if (surveyId) {
      relevantInvitations = relevantInvitations.filter((i) => i.surveyId === surveyId);
    }
    const responseRate = relevantInvitations.length > 0
      ? Math.round((totalResponses / relevantInvitations.length) * 100)
      : 0;

    // Sentiment breakdown
    const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
    responses.forEach((r) => sentimentBreakdown[r.sentiment]++);

    // By question
    const allSurveys = await this.loadSurveys();
    const questionMap = new Map<string, { text: string; type: string; ratings: number[]; count: number }>();
    allSurveys.forEach((s) => {
      if (surveyId && s.id !== surveyId) return;
      s.questions.forEach((q) => {
        questionMap.set(q.id, { text: q.text, type: q.type, ratings: [], count: 0 });
      });
    });

    responses.forEach((r) => {
      r.answers.forEach((a) => {
        const qInfo = questionMap.get(a.questionId);
        if (qInfo) {
          qInfo.count++;
          if (qInfo.type === 'rating' || qInfo.type === 'nps') {
            qInfo.ratings.push(Number(a.value));
          }
        }
      });
    });

    const byQuestion = Array.from(questionMap.entries()).map(([qId, info]) => ({
      questionId: qId,
      questionText: info.text,
      avgRating: info.ratings.length > 0
        ? Math.round((info.ratings.reduce((s, v) => s + v, 0) / info.ratings.length) * 100) / 100
        : undefined,
      responses: info.count,
    }));

    // By rep
    const repMap = new Map<string, { repName: string; ratings: number[]; count: number }>();
    responses.forEach((r) => {
      if (!r.repSlug) return;
      if (!repMap.has(r.repSlug)) {
        repMap.set(r.repSlug, { repName: r.repName || r.repSlug, ratings: [], count: 0 });
      }
      const rep = repMap.get(r.repSlug)!;
      rep.ratings.push(r.overallRating);
      rep.count++;
    });

    const byRep = Array.from(repMap.entries()).map(([slug, info]) => ({
      repSlug: slug,
      repName: info.repName,
      avgRating: Math.round((info.ratings.reduce((s, v) => s + v, 0) / info.ratings.length) * 100) / 100,
      count: info.count,
    }));
    byRep.sort((a, b) => b.avgRating - a.avgRating);

    // Monthly trends
    const monthMap = new Map<string, { ratings: number[]; count: number }>();
    responses.forEach((r) => {
      const month = r.submittedAt.slice(0, 7); // YYYY-MM
      if (!monthMap.has(month)) monthMap.set(month, { ratings: [], count: 0 });
      const m = monthMap.get(month)!;
      m.ratings.push(r.overallRating);
      m.count++;
    });

    const trends = Array.from(monthMap.entries())
      .map(([month, info]) => ({
        month,
        avgRating: Math.round((info.ratings.reduce((s, v) => s + v, 0) / info.ratings.length) * 100) / 100,
        count: info.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalResponses,
      avgRating,
      npsScore,
      responseRate,
      sentimentBreakdown,
      byQuestion,
      byRep,
      trends,
    };
  }

  /**
   * Mark a response for follow-up or complete follow-up.
   */
  async markFollowUp(responseId: string, note: string, completed?: boolean): Promise<SurveyResponse> {
    const responses = await this.loadResponses();
    const response = responses.find((r) => r.id === responseId);
    if (!response) throw new Error(`Response ${responseId} not found`);

    response.followUpNote = note;
    if (completed) {
      response.followUpCompletedAt = new Date().toISOString();
      response.followUpNeeded = false;
    } else {
      response.followUpNeeded = true;
    }

    await this.upsertResponse(response);
    return response;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const customerSurveyService = new CustomerSurveyService();
