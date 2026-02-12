# RCRS Administration & System Architecture Guide

## Architecture Overview

The RCRS platform is built on a modern web stack designed for speed, reliability, and ease of maintenance:

- **Framework**: Next.js 14 with React 18 and TypeScript
- **Styling**: Tailwind CSS with custom brand configuration
- **Hosting**: Vercel (automatic deployments, serverless functions)
- **Data**: Google Sheets API as primary backend, JobNimbus CRM for customer data
- **Storage**: Vercel Blob for file uploads (photos, documents, certificates)
- **Auth**: JWT for admin portal, token-based for customer portal

### Scale
- 367+ pages across public site and portal
- 180+ API routes handling data operations and integrations
- 85+ React components
- 95+ library/utility files

## Security Model

Security is layered throughout the application:

### Authentication
- **Admin JWT**: Login issues a signed JWT stored in an httpOnly cookie. Every protected API route calls `validateSession()` to verify
- **Customer tokens**: Unique, non-guessable tokens linked to customer records. No username/password required
- **Session expiry**: JWT tokens expire after a configured period and require re-authentication

### API Security
- **HMAC webhook validation**: Incoming webhooks are verified using shared secrets to prevent spoofing
- **Rate limiting**: API endpoints restrict request frequency to prevent abuse and DDoS
- **Input validation**: All user inputs are sanitized before processing
- **CORS configuration**: Only authorized origins can make API requests

### Best Practices
- Never commit `.env.local` or credential files to git
- Rotate API keys periodically
- Use the principle of least privilege for access levels
- Monitor API usage for unusual patterns

## Google Sheets Data Structure

Google Sheets serves as the primary database. Understanding the structure is critical:

### Tab Layout
- **Contacts**: Customer records (name, phone, email, address, source, rep)
- **Jobs**: Job records linked to contacts (status, dates, amounts, materials)
- **Leads**: Incoming leads before they become contacts (source tracking, assignment)
- **Inventory**: Material catalog with SKU, description, quantity, min-level, unit cost
- **Commissions**: Rep commission calculations (job, amount, rate, status, payout date)
- **Deliveries**: Delivery tickets (job, materials, driver, status, dates)
- **Training**: Training completion records (user, module, score, date)

### API Access Pattern
1. API route receives a request
2. Validates authentication via `validateSession()`
3. Connects to Google Sheets via service account credentials
4. Reads or writes data to the appropriate tab
5. Returns formatted JSON response

### Data Integrity
- Use append operations for new records
- Use row updates (not deletes) for modifications
- Include timestamps on all write operations
- The Google Sheets API has rate limits -- batch operations when possible

## JobNimbus Integration

The JN sync engine (`lib/jn-sync-engine.ts`) handles bidirectional data flow:

### What Syncs
- **Contacts**: Name, phone, email, address
- **Jobs**: Status, dates, amounts
- **Notes**: Activity log entries
- **Statuses**: Pipeline stage changes push in both directions

### Sync Mechanics
- Portal-to-JN: Changes made in the RCRS portal push to JN via REST API
- JN-to-Portal: Webhooks from JN trigger updates in the portal
- Conflict resolution: Most recent timestamp wins
- Error handling: Failed syncs are logged and retried

### API Configuration
- JN API key stored in `.env.local`
- Base URL: Configured in environment variables
- Rate limits: Respect JN API limits (varies by plan)
- Webhook endpoint: `/api/webhooks/jobnimbus`

## API Route Architecture

API routes follow consistent patterns:

### Route Structure
```
/api/portal/[domain]/[action]
```
Examples:
- `/api/portal/sales/leads` -- CRUD for leads
- `/api/portal/delivery/status` -- Update delivery status
- `/api/portal/inventory/orders` -- Material order management
- `/api/portal/training/quiz-submit` -- Quiz score submission

### Standard Route Pattern
1. Parse the request method (GET, POST, PUT, DELETE)
2. Call `validateSession()` for authentication
3. Parse and validate request body
4. Perform the data operation (Sheets API, JN API, etc.)
5. Return JSON response with appropriate status code
6. Handle errors with consistent error format

### Error Response Format
- `400`: Bad request (invalid input)
- `401`: Unauthorized (invalid or missing token)
- `403`: Forbidden (valid token but insufficient permissions)
- `404`: Not found (resource doesn't exist)
- `429`: Too many requests (rate limited)
- `500`: Server error (unexpected failure)

## SEO & Structured Data

Public pages include structured data for search engine optimization:

### JSON-LD Implementation
- `StructuredData` component embeds JSON-LD in page `<head>`
- Business info: name, address, phone, hours, service areas
- Service pages: individual service schema with descriptions
- Location pages: local business schema with geo coordinates

### Key SEO Elements
- **Meta tags**: Title, description, and Open Graph tags on all public pages
- **Google Analytics**: GA4 tracking (ID: G-Y8PB85BZC5) on all public pages
- **Sitemap**: Auto-generated for search engine crawling
- **Canonical URLs**: Prevent duplicate content issues
- **Alt text**: All images include descriptive alt text

## Deployment & DevOps

### Deployment Flow
1. Developer pushes code to a git branch
2. Create a pull request to `main`
3. Vercel automatically creates a preview deployment
4. Review and test on the preview URL
5. Merge PR to `main`
6. Vercel auto-deploys to production (www.rivercityroofingsolutions.com)

### Environment Management
- `.env.local`: Local development secrets (never committed)
- `.env.local.configured`: Template with all required variables
- Vercel dashboard: Production environment variables
- Always sync local env with the configured template

### Build Verification
- `npm run build` must pass cleanly before merging
- Dynamic route warnings during build are normal and expected
- TypeScript compilation catches type errors at build time
- Check the Vercel deployment logs for production issues

## Troubleshooting Common Issues

### Data Not Showing in Portal
1. Check the Google Sheets API connection (service account credentials)
2. Verify the correct Sheets tab name matches the API route
3. Check for rate limiting from Google API
4. Review the browser console for API errors

### Authentication Issues
1. Check if JWT token has expired (clear cookies and re-login)
2. Verify `ADMIN_PASSWORD` environment variable is set
3. Check `validateSession()` is present on the API route
4. Review server logs for authentication errors

### JN Sync Failures
1. Check JN API key is valid and not expired
2. Verify webhook URL is correctly configured in JN
3. Review sync logs for specific error messages
4. Check for data conflicts (duplicate records)

### Deployment Failures
1. Run `npm run build` locally to check for errors
2. Review Vercel build logs for the specific failure
3. Check for missing environment variables in Vercel dashboard
4. Verify all dependencies are in `package.json`

## System Monitoring

### What to Monitor
- API response times (should be under 2 seconds)
- Error rates (should be under 1%)
- Google Sheets API usage (quota limits)
- JN sync success rate
- User authentication failures (potential security issue)

### Tools
- Vercel Analytics: Performance and traffic data
- Google Analytics: User behavior and conversion tracking
- Browser DevTools: Debug client-side issues
- Vercel Logs: Server-side error logging
