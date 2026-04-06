/**
 * RCRS Customer Review Management Service
 *
 * Manages customer reviews across platforms (Google, Facebook, Yelp, BBB, etc.),
 * review request workflows, response tracking, and rep performance analytics.
 *
 * Data stored in data/reviews.json and data/review-requests.json
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import emailService from './email-service';

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
// DATA HELPERS
// =============================================================================

interface ReviewsData {
  reviews: CustomerReview[];
}

interface ReviewRequestsData {
  requests: ReviewRequest[];
}

const REVIEWS_FILE = path.join(process.cwd(), 'data', 'reviews.json');
const REQUESTS_FILE = path.join(process.cwd(), 'data', 'review-requests.json');

function readReviews(): ReviewsData {
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      const content = fs.readFileSync(REVIEWS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[ReviewService] Error reading reviews data:', error);
  }
  return { reviews: [] };
}

function writeReviews(data: ReviewsData): void {
  try {
    const dir = path.dirname(REVIEWS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[ReviewService] Error writing reviews data:', error);
    throw error;
  }
}

function readRequests(): ReviewRequestsData {
  try {
    if (fs.existsSync(REQUESTS_FILE)) {
      const content = fs.readFileSync(REQUESTS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[ReviewService] Error reading requests data:', error);
  }
  return { requests: [] };
}

function writeRequests(data: ReviewRequestsData): void {
  try {
    const dir = path.dirname(REQUESTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[ReviewService] Error writing requests data:', error);
    throw error;
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ReviewManagementService {

  /**
   * Add a new customer review.
   */
  addReview(data: {
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
  }): CustomerReview {
    const reviewsData = readReviews();
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

    reviewsData.reviews.push(review);
    writeReviews(reviewsData);

    // Link to any pending review request for this customer
    if (data.jobId) {
      const requestsData = readRequests();
      const matchingRequest = requestsData.requests.find(
        r => r.jobId === data.jobId && r.status !== 'completed' && r.status !== 'declined'
      );
      if (matchingRequest) {
        matchingRequest.status = 'completed';
        matchingRequest.reviewId = review.id;
        writeRequests(requestsData);
      }
    }

    return review;
  }

  /**
   * Get reviews with optional filtering.
   */
  getReviews(options?: {
    platform?: ReviewPlatform;
    repSlug?: string;
    rating?: number;
    limit?: number;
    featured?: boolean;
    published?: boolean;
  }): CustomerReview[] {
    const data = readReviews();
    let reviews = data.reviews;

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
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (options?.limit) {
      reviews = reviews.slice(0, options.limit);
    }

    return reviews;
  }

  /**
   * Get a single review by ID.
   */
  getReview(reviewId: string): CustomerReview | null {
    const data = readReviews();
    return data.reviews.find(r => r.id === reviewId) || null;
  }

  /**
   * Calculate review statistics.
   */
  getReviewStats(): ReviewStats {
    const reviewsData = readReviews();
    const requestsData = readRequests();
    const reviews = reviewsData.reviews;

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

    const pendingRequests = requestsData.requests.filter(
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
  respondToReview(reviewId: string, response: string, respondedBy: string): CustomerReview | null {
    const data = readReviews();
    const review = data.reviews.find(r => r.id === reviewId);
    if (!review) return null;

    review.response = response;
    review.respondedBy = respondedBy;
    review.respondedAt = new Date().toISOString();
    review.updatedAt = new Date().toISOString();

    writeReviews(data);
    return review;
  }

  /**
   * Check if a customer email has been sent a review request within the rate limit window.
   * Returns the existing request if rate-limited, null otherwise.
   */
  checkRateLimit(customerEmail: string): ReviewRequest | null {
    const requestsData = readRequests();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RATE_LIMIT_DAYS);

    const recentRequest = requestsData.requests.find(
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
    const requestsData = readRequests();
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

    // Log to Google Sheets (non-blocking - don't fail the request if Sheets is down)
    try {
      const { googleSheetsService } = await import('./google-sheets-service');
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

    requestsData.requests.push(request);
    writeRequests(requestsData);
    return request;
  }

  /**
   * Get review requests with optional filtering.
   */
  getReviewRequests(options?: {
    status?: RequestStatus;
    repSlug?: string;
    limit?: number;
  }): ReviewRequest[] {
    const data = readRequests();
    let requests = data.requests;

    if (options?.status) {
      requests = requests.filter(r => r.status === options.status);
    }

    if (options?.repSlug) {
      requests = requests.filter(r => r.repSlug === options.repSlug);
    }

    // Sort newest first
    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (options?.limit) {
      requests = requests.slice(0, options.limit);
    }

    return requests;
  }

  /**
   * Get pending review requests.
   */
  getPendingRequests(): ReviewRequest[] {
    return this.getReviewRequests().filter(
      r => r.status === 'pending' || r.status === 'sent' || r.status === 'opened'
    );
  }

  /**
   * Toggle featured status of a review.
   */
  featureReview(reviewId: string, featured: boolean): void {
    const data = readReviews();
    const review = data.reviews.find(r => r.id === reviewId);
    if (!review) throw new Error(`Review ${reviewId} not found`);

    review.isFeatured = featured;
    review.updatedAt = new Date().toISOString();
    writeReviews(data);
  }

  /**
   * Update review publish status.
   */
  publishReview(reviewId: string, published: boolean): void {
    const data = readReviews();
    const review = data.reviews.find(r => r.id === reviewId);
    if (!review) throw new Error(`Review ${reviewId} not found`);

    review.isPublished = published;
    review.updatedAt = new Date().toISOString();
    writeReviews(data);
  }

  /**
   * Get all reviews for a specific rep.
   */
  getRepReviews(repSlug: string): CustomerReview[] {
    return this.getReviews({ repSlug });
  }

  /**
   * Send a reminder for an existing review request.
   */
  sendReminder(requestId: string): ReviewRequest | null {
    const data = readRequests();
    const request = data.requests.find(r => r.id === requestId);
    if (!request) return null;

    request.reminderCount++;
    request.lastReminderAt = new Date().toISOString();
    writeRequests(data);
    return request;
  }

  /**
   * Update a review request status.
   */
  updateRequestStatus(requestId: string, status: RequestStatus): ReviewRequest | null {
    const data = readRequests();
    const request = data.requests.find(r => r.id === requestId);
    if (!request) return null;

    request.status = status;
    writeRequests(data);
    return request;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const reviewManagementService = new ReviewManagementService();
