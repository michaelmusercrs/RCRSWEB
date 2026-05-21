/**
 * RCRS Customer Review Management Service
 *
 * Manages customer reviews across platforms (Google, Facebook, Yelp, BBB, etc.),
 * review request workflows, response tracking, and rep performance analytics.
 *
 * Persistence (2026-04-09): Reviews and review requests live on the
 * SHEET_NAMES.CUSTOMER_REVIEWS tab, differentiated by a `source` column
 * (`primary` for customer reviews, `request` for review request records).
 * The `master` and `profile` sources are reserved for external builders
 * (data/reviews-master.json, data/profile-reviews.json) that may eventually
 * funnel data through this same tab.
 *
 * Local data/reviews.json and data/review-requests.json remain as
 * deprecated dev seeds.
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import crypto from 'crypto';
import emailService from './email-service';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Direct link for customers to leave a Google review for RCRS */
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CdVKlmRIhPZ-EBM/review';

/** Rate limit: max 1 review request per customer email per this many days */
const RATE_LIMIT_DAYS = 30;

// =============================================================================
// TYPES
// =============================================================================

export type ReviewPlatform = 'google' | 'facebook' | 'yelp' | 'bbb' | 'internal' | 'homeadvisor';
export type RequestMethod = 'sms' | 'email' | 'both';
export type RequestStatus = 'pending' | 'sent' | 'opened' | 'completed' | 'declined';

export interface CustomerReview {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  jobId?: string;

  platform: ReviewPlatform;
  rating: number; // 1-5
  title?: string;
  content: string;
  response?: string;
  respondedBy?: string;
  respondedAt?: string;

  repSlug?: string;
  repName?: string;

  isPublished: boolean;
  isFeatured: boolean;

  sentRequestAt?: string;
  requestMethod?: RequestMethod;

  photos?: string[];

  createdAt: string;
  updatedAt: string;
}

export interface ReviewRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  jobId: string;
  jobType?: string;
  completionDate?: string;
  repSlug: string;
  repName?: string;

  method: RequestMethod;
  sentAt: string;
  status: RequestStatus;

  reminderCount: number;
  lastReminderAt?: string;

  reviewId?: string;
  emailSent?: boolean;
  emailError?: string;
  sheetLogged?: boolean;

  createdAt: string;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  byPlatform: Record<string, { count: number; avgRating: number }>;
  byRep: Record<string, { count: number; avgRating: number }>;
  thisMonth: number;
  pendingRequests: number;
  responseRate: number;
}

// =============================================================================
// PLATFORM LABELS & COLORS
// =============================================================================

export const PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  google: 'Google',
  facebook: 'Facebook',
  yelp: 'Yelp',
  bbb: 'BBB',
  internal: 'Direct',
  homeadvisor: 'HomeAdvisor',
};

export const PLATFORM_COLORS: Record<ReviewPlatform, string> = {
  google: '#4285F4',
  facebook: '#1877F2',
  yelp: '#D32323',
  bbb: '#005A8B',
  internal: '#39FF14',
  homeadvisor: '#F68B1E',
};

// =============================================================================
// SHEET SCHEMA
// =============================================================================

/**
 * Unified reviews tab. Both `CustomerReview` and `ReviewRequest` rows live
 * here, differentiated by `source`.
 */
const REVIEW_ROW_HEADERS: string[] = [
  'id',
  'source', // 'primary' | 'master' | 'request' | 'profile'
  'customerId',
  'customerName',
  'address',
  'jobId',
  // CustomerReview fields
  'platform',
  'rating',
  'title',
  'content',
  'response',
  'respondedBy',
  'respondedAt',
  'repSlug',
  'repName',
  'isPublished',
  'isFeatured',
  'sentRequestAt',
  'requestMethod',
  'photos',
  // ReviewRequest-only fields
  'customerPhone',
  'customerEmail',
  'jobType',
  'completionDate',
  'method',
  'sentAt',
  'status',
  'reminderCount',
  'lastReminderAt',
  'reviewId',
  'emailSent',
  'emailError',
  'sheetLogged',
  // Timestamps
  'createdAt',
  'updatedAt',
];

// =============================================================================
// PARSING HELPERS
// =============================================================================

function parseJsonField<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseBool(value: string | undefined): boolean {
  return value === 'true';
}

function rowToReview(row: Record<string, string>): CustomerReview {
  return {
    id: row.id || '',
    customerId: row.customerId || '',
    customerName: row.customerName || '',
    address: row.address || '',
    jobId: row.jobId || undefined,
    platform: (row.platform as ReviewPlatform) || 'internal',
    rating: Number(row.rating) || 0,
    title: row.title || undefined,
    content: row.content || '',
    response: row.response || undefined,
    respondedBy: row.respondedBy || undefined,
    respondedAt: row.respondedAt || undefined,
    repSlug: row.repSlug || undefined,
    repName: row.repName || undefined,
    isPublished: parseBool(row.isPublished),
    isFeatured: parseBool(row.isFeatured),
    sentRequestAt: row.sentRequestAt || undefined,
    requestMethod: (row.requestMethod as RequestMethod) || undefined,
    photos: row.photos ? parseJsonField<string[]>(row.photos, []) : undefined,
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  };
}

function reviewToRow(r: CustomerReview): Record<string, unknown> {
  return {
    id: r.id,
    source: 'primary',
    customerId: r.customerId,
    customerName: r.customerName,
    address: r.address,
    jobId: r.jobId ?? '',
    platform: r.platform,
    rating: r.rating,
    title: r.title ?? '',
    content: r.content,
    response: r.response ?? '',
    respondedBy: r.respondedBy ?? '',
    respondedAt: r.respondedAt ?? '',
    repSlug: r.repSlug ?? '',
    repName: r.repName ?? '',
    isPublished: r.isPublished,
    isFeatured: r.isFeatured,
    sentRequestAt: r.sentRequestAt ?? '',
    requestMethod: r.requestMethod ?? '',
    photos: r.photos ? JSON.stringify(r.photos) : '',
    customerPhone: '',
    customerEmail: '',
    jobType: '',
    completionDate: '',
    method: '',
    sentAt: '',
    status: '',
    reminderCount: '',
    lastReminderAt: '',
    reviewId: '',
    emailSent: '',
    emailError: '',
    sheetLogged: '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function rowToRequest(row: Record<string, string>): ReviewRequest {
  return {
    id: row.id || '',
    customerId: row.customerId || '',
    customerName: row.customerName || '',
    customerPhone: row.customerPhone || '',
    customerEmail: row.customerEmail || '',
    jobId: row.jobId || '',
    jobType: row.jobType || undefined,
    completionDate: row.completionDate || undefined,
    repSlug: row.repSlug || '',
    repName: row.repName || undefined,
    method: (row.method as RequestMethod) || 'email',
    sentAt: row.sentAt || '',
    status: (row.status as RequestStatus) || 'pending',
    reminderCount: Number(row.reminderCount) || 0,
    lastReminderAt: row.lastReminderAt || undefined,
    reviewId: row.reviewId || undefined,
    emailSent: row.emailSent ? parseBool(row.emailSent) : undefined,
    emailError: row.emailError || undefined,
    sheetLogged: row.sheetLogged ? parseBool(row.sheetLogged) : undefined,
    createdAt: row.createdAt || '',
  };
}

function requestToRow(r: ReviewRequest): Record<string, unknown> {
  return {
    id: r.id,
    source: 'request',
    customerId: r.customerId,
    customerName: r.customerName,
    address: '',
    jobId: r.jobId,
    platform: '',
    rating: '',
    title: '',
    content: '',
    response: '',
    respondedBy: '',
    respondedAt: '',
    repSlug: r.repSlug,
    repName: r.repName ?? '',
    isPublished: '',
    isFeatured: '',
    sentRequestAt: '',
    requestMethod: '',
    photos: '',
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail,
    jobType: r.jobType ?? '',
    completionDate: r.completionDate ?? '',
    method: r.method,
    sentAt: r.sentAt,
    status: r.status,
    reminderCount: r.reminderCount,
    lastReminderAt: r.lastReminderAt ?? '',
    reviewId: r.reviewId ?? '',
    emailSent: r.emailSent ?? '',
    emailError: r.emailError ?? '',
    sheetLogged: r.sheetLogged ?? '',
    createdAt: r.createdAt,
    updatedAt: '',
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ReviewManagementService {
  private reviewCache: CustomerReview[] | null = null;
  private requestCache: ReviewRequest[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  // ---------------------------------------------------------------------------
  // Sheet I/O
  // ---------------------------------------------------------------------------

  private async loadUnified(): Promise<void> {
    if (
      this.reviewCache !== null &&
      this.requestCache !== null &&
      Date.now() < this.cacheExpiresAt
    ) {
      return;
    }
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.CUSTOMER_REVIEWS,
      REVIEW_ROW_HEADERS,
    );
    const reviews: CustomerReview[] = [];
    const requests: ReviewRequest[] = [];
    for (const row of rows) {
      const source = row.source || 'primary';
      if (source === 'request') {
        requests.push(rowToRequest(row));
      } else {
        // Treat primary, master, profile all as CustomerReviews
        reviews.push(rowToReview(row));
      }
    }
    this.reviewCache = reviews;
    this.requestCache = requests;
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
  }

  private async loadReviews(): Promise<CustomerReview[]> {
    await this.loadUnified();
    return this.reviewCache!;
  }

  private async loadRequests(): Promise<ReviewRequest[]> {
    await this.loadUnified();
    return this.requestCache!;
  }

  private invalidateCaches(): void {
    this.reviewCache = null;
    this.requestCache = null;
    this.cacheExpiresAt = 0;
  }

  private async upsertReview(review: CustomerReview): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.CUSTOMER_REVIEWS,
      REVIEW_ROW_HEADERS,
      'id',
      reviewToRow(review),
    );
    this.invalidateCaches();
  }

  private async upsertRequest(request: ReviewRequest): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.CUSTOMER_REVIEWS,
      REVIEW_ROW_HEADERS,
      'id',
      requestToRow(request),
    );
    this.invalidateCaches();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Add a new customer review.
   */
  async addReview(data: {
    customerId?: string;
    customerName: string;
    address: string;
    jobId?: string;
    platform: ReviewPlatform;
    rating: number;
    title?: string;
    content: string;
    repSlug?: string;
    repName?: string;
    isPublished?: boolean;
    isFeatured?: boolean;
    photos?: string[];
    requestMethod?: RequestMethod;
  }): Promise<CustomerReview> {
    const now = new Date().toISOString();

    const review: CustomerReview = {
      id: generateId('RVW'),
      customerId: data.customerId || `CUST-${crypto.randomBytes(4).toString('hex')}`,
      customerName: data.customerName,
      address: data.address,
      jobId: data.jobId,
      platform: data.platform,
      rating: Math.min(5, Math.max(1, data.rating)),
      title: data.title,
      content: data.content,
      repSlug: data.repSlug,
      repName: data.repName,
      isPublished: data.isPublished ?? true,
      isFeatured: data.isFeatured ?? false,
      photos: data.photos,
      requestMethod: data.requestMethod,
      createdAt: now,
      updatedAt: now,
    };

    await this.upsertReview(review);

    // Link to any pending review request for this customer
    if (data.jobId) {
      const requests = await this.loadRequests();
      const matchingRequest = requests.find(
        r => r.jobId === data.jobId && r.status !== 'completed' && r.status !== 'declined'
      );
      if (matchingRequest) {
        matchingRequest.status = 'completed';
        matchingRequest.reviewId = review.id;
        await this.upsertRequest(matchingRequest);
      }
    }

    return review;
  }

  /**
   * Get reviews with optional filtering.
   */
  async getReviews(options?: {
    platform?: ReviewPlatform;
    repSlug?: string;
    rating?: number;
    limit?: number;
    featured?: boolean;
    published?: boolean;
  }): Promise<CustomerReview[]> {
    let reviews = await this.loadReviews();

    if (options?.platform) {
      reviews = reviews.filter(r => r.platform === options.platform);
    }

    if (options?.repSlug) {
      reviews = reviews.filter(r => r.repSlug === options.repSlug);
    }

    if (options?.rating !== undefined) {
      reviews = reviews.filter(r => r.rating === options.rating);
    }

    if (options?.featured !== undefined) {
      reviews = reviews.filter(r => r.isFeatured === options.featured);
    }

    if (options?.published !== undefined) {
      reviews = reviews.filter(r => r.isPublished === options.published);
    }

    // Sort by newest first
    reviews = [...reviews].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (options?.limit) {
      reviews = reviews.slice(0, options.limit);
    }

    return reviews;
  }

  /**
   * Get a single review by ID.
   */
  async getReview(reviewId: string): Promise<CustomerReview | null> {
    const reviews = await this.loadReviews();
    return reviews.find(r => r.id === reviewId) || null;
  }

  /**
   * Calculate review statistics.
   */
  async getReviewStats(): Promise<ReviewStats> {
    const reviews = await this.loadReviews();
    const requests = await this.loadRequests();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    // By platform
    const byPlatform: Record<string, { count: number; totalRating: number }> = {};
    // By rep
    const byRep: Record<string, { count: number; totalRating: number }> = {};

    let thisMonth = 0;
    let reviewsWithResponse = 0;

    for (const review of reviews) {
      // Rating
      totalRating += review.rating;
      ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;

      // Platform
      if (!byPlatform[review.platform]) {
        byPlatform[review.platform] = { count: 0, totalRating: 0 };
      }
      byPlatform[review.platform].count++;
      byPlatform[review.platform].totalRating += review.rating;

      // Rep
      if (review.repSlug) {
        if (!byRep[review.repSlug]) {
          byRep[review.repSlug] = { count: 0, totalRating: 0 };
        }
        byRep[review.repSlug].count++;
        byRep[review.repSlug].totalRating += review.rating;
      }

      // This month
      if (new Date(review.createdAt) >= monthStart) {
        thisMonth++;
      }

      // Responded
      if (review.response) {
        reviewsWithResponse++;
      }
    }

    // Convert platform/rep totals to averages
    const byPlatformResult: Record<string, { count: number; avgRating: number }> = {};
    for (const [platform, stats] of Object.entries(byPlatform)) {
      byPlatformResult[platform] = {
        count: stats.count,
        avgRating: stats.count > 0 ? Math.round((stats.totalRating / stats.count) * 10) / 10 : 0,
      };
    }

    const byRepResult: Record<string, { count: number; avgRating: number }> = {};
    for (const [rep, stats] of Object.entries(byRep)) {
      byRepResult[rep] = {
        count: stats.count,
        avgRating: stats.count > 0 ? Math.round((stats.totalRating / stats.count) * 10) / 10 : 0,
      };
    }

    const pendingRequests = requests.filter(
      r => r.status === 'pending' || r.status === 'sent' || r.status === 'opened'
    ).length;

    return {
      totalReviews: reviews.length,
      averageRating: reviews.length > 0 ? Math.round((totalRating / reviews.length) * 10) / 10 : 0,
      ratingDistribution,
      byPlatform: byPlatformResult,
      byRep: byRepResult,
      thisMonth,
      pendingRequests,
      responseRate: reviews.length > 0 ? Math.round((reviewsWithResponse / reviews.length) * 100) : 0,
    };
  }

  /**
   * Respond to a review.
   */
  async respondToReview(reviewId: string, response: string, respondedBy: string): Promise<CustomerReview | null> {
    const review = await this.getReview(reviewId);
    if (!review) return null;

    review.response = response;
    review.respondedBy = respondedBy;
    review.respondedAt = new Date().toISOString();
    review.updatedAt = new Date().toISOString();

    await this.upsertReview(review);
    return review;
  }

  /**
   * Check if a customer email has been sent a review request within the rate limit window.
   * Returns the existing request if rate-limited, null otherwise.
   */
  async checkRateLimit(customerEmail: string): Promise<ReviewRequest | null> {
    const requests = await this.loadRequests();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RATE_LIMIT_DAYS);

    const recentRequest = requests.find(
      r => r.customerEmail.toLowerCase() === customerEmail.toLowerCase()
        && new Date(r.createdAt) >= cutoff
    );

    return recentRequest || null;
  }

  /**
   * Build the branded review request email HTML.
   */
  buildReviewEmailBody(data: {
    customerName: string;
    jobType?: string;
    repName?: string;
  }): string {
    const firstName = data.customerName.split(' ')[0];
    const jobMention = data.jobType
      ? ` on your ${data.jobType.toLowerCase()}`
      : '';
    const repMention = data.repName
      ? `<p style="color: #555; font-size: 14px;">Your project was handled by <strong>${data.repName}</strong>. If you had a great experience with them, please mention it in your review!</p>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: #000000; padding: 24px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0; font-size: 22px;">River City Roofing Solutions</h1>
        </div>
        <div style="padding: 32px 28px;">
          <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 0;">
            Hi ${firstName},
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Thank you for choosing River City Roofing Solutions${jobMention}! We truly appreciate your business and hope the finished result exceeded your expectations.
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Would you take a moment to share your experience with a Google review? It only takes about 60 seconds, and your feedback helps other homeowners make informed decisions.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${GOOGLE_REVIEW_URL}" style="display: inline-block; background: #39FF14; color: #000000; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; letter-spacing: 0.5px;">
              Leave a Google Review
            </a>
          </div>
          ${repMention}
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            If there is anything about your experience that did not meet your expectations, please call us first at <a href="tel:+12562748530" style="color: #0066CC; text-decoration: none;">(256) 274-8530</a>. We want to make it right before you leave a review.
          </p>
        </div>
        <div style="background: #f5f5f5; padding: 20px; text-align: center;">
          <p style="margin: 0; color: #888; font-size: 12px;">
            River City Roofing Solutions | (256) 274-8530 | rivercityroofingsolutions.com
          </p>
          <p style="margin: 8px 0 0 0; color: #aaa; font-size: 11px;">
            You received this email because you are a valued customer of River City Roofing Solutions.
            If you do not wish to receive future emails, please reply with "unsubscribe".
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Send a review request to a customer.
   * Sends a personalized email and logs to Google Sheets.
   */
  async sendReviewRequest(data: {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    jobId: string;
    jobType?: string;
    completionDate?: string;
    repSlug: string;
    repName?: string;
    method: RequestMethod;
  }): Promise<ReviewRequest> {
    const now = new Date().toISOString();

    const request: ReviewRequest = {
      id: generateId('RRQ'),
      customerId: data.customerId || `CUST-${crypto.randomBytes(4).toString('hex')}`,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      jobId: data.jobId,
      jobType: data.jobType,
      completionDate: data.completionDate,
      repSlug: data.repSlug,
      repName: data.repName,
      method: data.method,
      sentAt: now,
      status: 'sent',
      reminderCount: 0,
      emailSent: false,
      sheetLogged: false,
      createdAt: now,
    };

    // Send email if method includes email
    if (data.method === 'email' || data.method === 'both') {
      const emailBody = this.buildReviewEmailBody({
        customerName: data.customerName,
        jobType: data.jobType,
        repName: data.repName,
      });

      const emailResult = await emailService.send({
        template: 'review-request',
        to: data.customerEmail,
        subject: 'How was your experience with River City Roofing?',
        body: emailBody,
        fromName: 'River City Roofing Solutions',
        replyTo: 'rcrs@rivercityroofingsolutions.com',
      });

      request.emailSent = emailResult.success;
      if (!emailResult.success) {
        request.emailError = emailResult.error;
        console.error(`[ReviewRequest] Email failed for ${data.customerEmail}:`, emailResult.error);
      }
    }

    // Log to the legacy typed Reviews sheet (separate from our unified tab).
    // Non-blocking — don't fail the request if Sheets is down.
    try {
      await googleSheetsService.addReview({
        id: request.id,
        name: data.customerName,
        date: now,
        rating: '',
        text: `Review request sent via ${data.method} | Job: ${data.jobType || 'N/A'}`,
        salesRep: data.repName || data.repSlug,
        repSlug: data.repSlug,
        source: 'review_request',
        visible: 'false',
        featured: 'false',
        approved: 'false',
        createdAt: now,
      });
      request.sheetLogged = true;
    } catch (sheetError) {
      console.error('[ReviewRequest] Google Sheets logging failed:', sheetError);
    }

    await this.upsertRequest(request);
    return request;
  }

  /**
   * Get review requests with optional filtering.
   */
  async getReviewRequests(options?: {
    status?: RequestStatus;
    repSlug?: string;
    limit?: number;
  }): Promise<ReviewRequest[]> {
    let requests = await this.loadRequests();

    if (options?.status) {
      requests = requests.filter(r => r.status === options.status);
    }

    if (options?.repSlug) {
      requests = requests.filter(r => r.repSlug === options.repSlug);
    }

    // Sort newest first
    requests = [...requests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (options?.limit) {
      requests = requests.slice(0, options.limit);
    }

    return requests;
  }

  /**
   * Get pending review requests.
   */
  async getPendingRequests(): Promise<ReviewRequest[]> {
    const all = await this.getReviewRequests();
    return all.filter(
      r => r.status === 'pending' || r.status === 'sent' || r.status === 'opened'
    );
  }

  /**
   * Toggle featured status of a review.
   */
  async featureReview(reviewId: string, featured: boolean): Promise<void> {
    const review = await this.getReview(reviewId);
    if (!review) throw new Error(`Review ${reviewId} not found`);

    review.isFeatured = featured;
    review.updatedAt = new Date().toISOString();
    await this.upsertReview(review);
  }

  /**
   * Update review publish status.
   */
  async publishReview(reviewId: string, published: boolean): Promise<void> {
    const review = await this.getReview(reviewId);
    if (!review) throw new Error(`Review ${reviewId} not found`);

    review.isPublished = published;
    review.updatedAt = new Date().toISOString();
    await this.upsertReview(review);
  }

  /**
   * Get all reviews for a specific rep.
   */
  async getRepReviews(repSlug: string): Promise<CustomerReview[]> {
    return this.getReviews({ repSlug });
  }

  /**
   * Send a reminder for an existing review request.
   */
  async sendReminder(requestId: string): Promise<ReviewRequest | null> {
    const requests = await this.loadRequests();
    const request = requests.find(r => r.id === requestId);
    if (!request) return null;

    request.reminderCount++;
    request.lastReminderAt = new Date().toISOString();
    await this.upsertRequest(request);
    return request;
  }

  /**
   * Update a review request status.
   */
  async updateRequestStatus(requestId: string, status: RequestStatus): Promise<ReviewRequest | null> {
    const requests = await this.loadRequests();
    const request = requests.find(r => r.id === requestId);
    if (!request) return null;

    request.status = status;
    await this.upsertRequest(request);
    return request;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const reviewManagementService = new ReviewManagementService();
