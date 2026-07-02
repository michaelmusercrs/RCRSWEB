/**
 * Chris's Owner lesson — written 2026-07-02 against current production
 * behavior. Focus: the screens that answer owner questions without asking
 * anyone, and the controls that matter.
 */
import type { Lesson } from './types';

export const chrisOwnerLesson: Lesson = {
  slug: 'chris-owner',
  moduleId: 'lesson-chris-owner-2026',
  title: 'Owner\'s Map — Your Screens, Your Numbers, Your Controls',
  description:
    'The five screens that answer 90% of owner questions, how the three leaderboards differ (and why they never combine), and the safety systems running underneath.',
  audience: 'Chris / Owners & Managers',
  estimatedMinutes: 15,
  sections: [
    {
      title: 'The Five Screens That Answer Most Questions',
      blocks: [
        {
          type: 'table',
          headers: ['Question', 'Screen'],
          rows: [
            ['How is the business doing today?', '**/command-center** — the main dashboard'],
            ['How are sales/analytics trending?', '**/chrisview** — your analytics hub'],
            ['Did the system send that email? Why not?', '**/admin/email-log**'],
            ['Is everything technically healthy?', '**/admin/system/health** — one traffic-light screen for email, forms, sheets, crons'],
            ['What material money moved this week?', 'Invoices + Job_Breakdowns tabs on the master sheet — every delivery auto-invoices at load'],
          ],
        },
        { type: 'callout', tone: 'tip', text: 'All of these are behind your login at rcrsal.com. The customer-facing site (rivercityroofingsolutions.com) never shows any of this.' },
      ],
      keyPoints: [
        'command-center for today, chrisview for trends',
        'email-log and system/health answer "is it working" questions',
      ],
    },
    {
      title: 'The Three Leaderboards — Never Combine Them',
      blocks: [
        { type: 'p', text: 'There are three leaderboards, on purpose, with three different sources. They will show different numbers for the same rep — that is CORRECT, not a bug:' },
        {
          type: 'table',
          headers: ['Board', 'Source', 'What it measures'],
          rows: [
            ['**Commission**', 'QuickBooks 1099 payouts', 'What reps were actually PAID'],
            ['**Sales**', 'Monday accrual sheet', 'What reps SOLD (booked revenue)'],
            ['**Weekly**', 'Self-reported numbers', 'Activity — doors, inspections, contingencies'],
          ],
        },
        { type: 'callout', tone: 'warn', text: 'A payout lags a sale by weeks and self-reports lag reality — comparing across boards creates arguments based on timing, not performance. Compare within one board only. Michael, Chris, Sara, and Boston never appear on rep boards, by rule.' },
      ],
      keyPoints: [
        'Commission = paid, Sales = sold, Weekly = activity',
        'Different numbers across boards are correct — compare within one board',
      ],
      quiz: [
        {
          question: 'A rep tops the Sales board but is mid-pack on Commission. What does that mean?',
          options: [
            'The data is broken',
            'Someone is skimming',
            'Normal — sales book now, payouts follow weeks later from a different source',
            'The rep is lying',
          ],
          correct: 2,
          explanation: 'The boards measure different stages with different sources. Booked revenue leads paid commission by weeks.',
        },
      ],
    },
    {
      title: 'What Runs Itself Now (July 2026)',
      blocks: [
        {
          type: 'bullets',
          items: [
            '**Delivery invoicing** — every verified load instantly writes the invoice, job breakdown, and stock deduction. A 8:17 AM daily sweep finalizes anything stuck 48+ hours, so nothing ships uninvoiced.',
            '**Email** — rebuilt on Resend after the May flood. Only approved email types send; every attempt is logged; per-inbox rate caps make a repeat flood impossible.',
            '**Form spam** — three gates (honeypot, spam filter, rate limits) with a full block log.',
            '**Passwords** — anyone still on a starter password is forced to set their own at next login.',
            '**Backups** — the master sheet snapshots hourly.',
          ],
        },
        { type: 'callout', tone: 'info', text: 'The public site scored 97.2/100 (A+) on the July 2026 SEO audit. Its one weak spot is review count vs competitors — the review-request automation is built and waiting for the go-ahead.' },
      ],
      keyPoints: [
        'Invoicing, email safety, spam gates, and backups are automatic',
        'SEO is A+ — reviews are the remaining gap',
      ],
    },
    {
      title: 'The Standing Rules the System Enforces',
      blocks: [
        {
          type: 'table',
          headers: ['Rule', 'Enforced how'],
          rows: [
            ['Supplier cost never reaches reps, customers, or JobNimbus', 'Stripped server-side by role on every screen and sync'],
            ['rcrsal.com = internal only; public site = customers only', 'Separate domains, checked in middleware'],
            ['No customer-facing email without owner approval', 'Email allowlist — unapproved types drop and log'],
            ['Owners/admin/marketing never on rep leaderboards', 'Filtered at the data layer'],
          ],
        },
        { type: 'p', text: 'If you ever see one of these rules broken on a live screen, that is a bug worth interrupting Michael for.' },
      ],
      keyPoints: [
        'The big four rules are enforced in code, not by memory',
        'A broken rule on screen = report immediately',
      ],
    },
  ],
};
