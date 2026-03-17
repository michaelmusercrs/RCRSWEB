/**
 * RCRS Customer Satisfaction Survey Service
 *
 * Manages survey creation, distribution, response collection, and analytics.
 * Supports rating, NPS, text, yes/no, and multiple choice question types.
 * Calculates sentiment, NPS scores, and per-rep breakdowns.
 *
 * Data stored in data/surveys.json, data/survey-responses.json
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

interface SurveyData {
  surveys: Survey[];
}

interface ResponseData {
  responses: SurveyResponse[];
}

// Represents a pending survey invitation (stored in responses file with no answers yet)
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
// DATA HELPERS
// =============================================================================

const SURVEYS_FILE = path.join(process.cwd(), 'data', 'surveys.json');
const RESPONSES_FILE = path.join(process.cwd(), 'data', 'survey-responses.json');
const INVITATIONS_FILE = path.join(process.cwd(), 'data', 'survey-invitations.json');

function readSurveys(): SurveyData {
  try {
    if (fs.existsSync(SURVEYS_FILE)) {
      const content = fs.readFileSync(SURVEYS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[SurveyService] Error reading surveys:', error);
  }
  return { surveys: [] };
}

function writeSurveys(data: SurveyData): void {
  try {
    const dir = path.dirname(SURVEYS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SURVEYS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[SurveyService] Error writing surveys:', error);
    throw new Error('Failed to save survey data');
  }
}

function readResponses(): ResponseData {
  try {
    if (fs.existsSync(RESPONSES_FILE)) {
      const content = fs.readFileSync(RESPONSES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[SurveyService] Error reading responses:', error);
  }
  return { responses: [] };
}

function writeResponses(data: ResponseData): void {
  try {
    const dir = path.dirname(RESPONSES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RESPONSES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[SurveyService] Error writing responses:', error);
    throw new Error('Failed to save response data');
  }
}

function readInvitations(): { invitations: SurveyInvitation[] } {
  try {
    if (fs.existsSync(INVITATIONS_FILE)) {
      const content = fs.readFileSync(INVITATIONS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[SurveyService] Error reading invitations:', error);
  }
  return { invitations: [] };
}

function writeInvitations(data: { invitations: SurveyInvitation[] }): void {
  try {
    const dir = path.dirname(INVITATIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(INVITATIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[SurveyService] Error writing invitations:', error);
    throw new Error('Failed to save invitation data');
  }
}

function generateId(): string {
  return crypto.randomBytes(6).toString('hex');
}

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// =============================================================================
// SENTIMENT + NPS HELPERS
// =============================================================================

function determineSentiment(overallRating: number, npsScore?: number): 'positive' | 'neutral' | 'negative' {
  // Weighted: overall rating is primary, NPS adjusts
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

  /**
   * Create a new survey template.
   */
  createSurvey(data: {
    name: string;
    type: Survey['type'];
    questions: Omit<SurveyQuestion, 'id'>[];
  }): Survey {
    const surveyData = readSurveys();

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

    surveyData.surveys.push(survey);
    writeSurveys(surveyData);
    return survey;
  }

  /**
   * Get all surveys.
   */
  getSurveys(): Survey[] {
    return readSurveys().surveys;
  }

  /**
   * Get a single survey by ID.
   */
  getSurvey(surveyId: string): Survey | null {
    const surveys = readSurveys().surveys;
    return surveys.find((s) => s.id === surveyId) || null;
  }

  /**
   * Send a survey to a customer. Creates an invitation token.
   */
  sendSurvey(
    surveyId: string,
    customerId: string,
    customerName: string,
    customerEmail: string,
    method: 'email' | 'sms' = 'email',
    repSlug?: string,
    repName?: string,
    jobId?: string
  ): { token: string; surveyUrl: string } {
    const survey = this.getSurvey(surveyId);
    if (!survey) throw new Error(`Survey ${surveyId} not found`);
    if (!survey.isActive) throw new Error('Survey is not active');

    const token = generateToken();

    const invData = readInvitations();
    invData.invitations.push({
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
    writeInvitations(invData);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.rivercityroofingsolutions.com';
    const surveyUrl = `${baseUrl}/survey/${token}`;

    // In production, this would trigger an email/SMS via the email service
    console.log(`[SurveyService] Survey sent to ${customerEmail} via ${method}: ${surveyUrl}`);

    return { token, surveyUrl };
  }

  /**
   * Get the survey associated with a token (for the public survey page).
   */
  getSurveyByToken(token: string): { survey: Survey; invitation: SurveyInvitation } | null {
    const invData = readInvitations();
    const invitation = invData.invitations.find((i) => i.token === token);
    if (!invitation) return null;

    // Check if already submitted
    const responses = readResponses();
    const existing = responses.responses.find((r) => r.token === token);
    if (existing) return null; // Already submitted

    const survey = this.getSurvey(invitation.surveyId);
    if (!survey) return null;

    return { survey, invitation };
  }

  /**
   * Submit a survey response from a customer.
   */
  submitResponse(
    token: string,
    answers: { questionId: string; value: string | number }[]
  ): SurveyResponse {
    const invData = readInvitations();
    const invitation = invData.invitations.find((i) => i.token === token);
    if (!invitation) throw new Error('Invalid survey token');

    // Check for duplicate submission
    const responseData = readResponses();
    const existing = responseData.responses.find((r) => r.token === token);
    if (existing) throw new Error('Survey already submitted');

    const survey = this.getSurvey(invitation.surveyId);
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

    responseData.responses.push(response);
    writeResponses(responseData);

    return response;
  }

  /**
   * Get responses, optionally filtered.
   */
  getResponses(options?: {
    surveyId?: string;
    repSlug?: string;
    startDate?: string;
    endDate?: string;
    sentiment?: string;
    followUpNeeded?: boolean;
  }): SurveyResponse[] {
    let responses = readResponses().responses;

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
    responses.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return responses;
  }

  /**
   * Get analytics for surveys.
   */
  getAnalytics(surveyId?: string, dateRange?: { start: string; end: string }): SurveyAnalytics {
    let responses = this.getResponses({
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
    const invData = readInvitations();
    let relevantInvitations = invData.invitations;
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
    const allSurveys = readSurveys().surveys;
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
  markFollowUp(responseId: string, note: string, completed?: boolean): SurveyResponse {
    const data = readResponses();
    const response = data.responses.find((r) => r.id === responseId);
    if (!response) throw new Error(`Response ${responseId} not found`);

    response.followUpNote = note;
    if (completed) {
      response.followUpCompletedAt = new Date().toISOString();
      response.followUpNeeded = false;
    } else {
      response.followUpNeeded = true;
    }

    writeResponses(data);
    return response;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const customerSurveyService = new CustomerSurveyService();
