/**
 * Sara's Office Operations lesson — written 2026-07-02 against current
 * production behavior (post email-rebuild, post inventory-recovery).
 */
import type { Lesson } from './types';

export const saraOfficeLesson: Lesson = {
  slug: 'sara-office',
  moduleId: 'lesson-sara-office-2026',
  title: 'Office Operations — Invoices, Email & Oversight',
  description:
    'How money and paperwork flow through the system now: automatic invoices, the email pipeline, credit memos, and the screens that show you everything.',
  audience: 'Sara / Admin & Office',
  estimatedMinutes: 25,
  sections: [
    {
      title: 'How Invoices Happen Now (You Don\'t Type Them)',
      blocks: [
        { type: 'p', text: 'Delivery invoices are created **automatically** the moment a load is verified. You review; the system writes.' },
        {
          type: 'steps',
          items: [
            'A material order arrives (email to stock@ or entered in the portal) → a **Ticket** is created',
            'Rick stages and loads the truck → taps **Mark Loaded**',
            'That tap instantly writes the **Invoice** (INV-YYYYMMDD-#### in the Invoices tab), a **Job Breakdown** if the job has none, and deducts warehouse stock',
            'You get the office email copy with the price-only breakdown (never supplier cost)',
          ],
        },
        { type: 'callout', tone: 'info', text: 'Safety net: any delivery ticket that sits untouched for 48 hours is auto-finalized every morning at 8:17 AM — same invoice, same deduction, tagged "Auto-finalized by cron" in the notes. So nothing ships uninvoiced even if a tap is missed.' },
        { type: 'callout', tone: 'tip', text: 'Invoice numbering is date-based and collision-proof. If you see two invoices for one ticket, that\'s a bug — tell Michael. (The system dedupes by ticketId, so this should be impossible.)' },
      ],
      keyPoints: [
        'Mark Loaded = instant invoice + breakdown + stock deduction',
        'The 8:17 AM auto-finalizer catches anything stuck >48h',
        'Invoices live in the Invoices tab of the master sheet',
      ],
      quiz: [
        {
          question: 'Where does a delivery invoice come from?',
          options: [
            'Sara types it in QuickBooks',
            'It is written automatically when the load is verified (or by the 48h auto-finalizer)',
            'JobNimbus generates it',
            'The customer portal',
          ],
          correct: 1,
          explanation: 'Verify-load (or the daily auto-finalizer as backup) writes the invoice, the breakdown, and the stock deduction in one shot.',
        },
      ],
    },
    {
      title: 'The Email System — What Sends and What Doesn\'t',
      blocks: [
        { type: 'p', text: 'After the May 2026 email flood, the whole pipeline was rebuilt. Emails now send through **Resend** from **noreply@rcrsal.com**, with three protection layers:' },
        {
          type: 'bullets',
          items: [
            '**Allowlist** — only approved email types send at all. Right now: contact-form lead alerts, load-verified invoices, and driver new-order notices. Everything else is silently dropped and logged.',
            '**Rate caps** — no single inbox can receive more than a set number per hour/day. A flood is mechanically impossible.',
            '**Full audit log** — every send attempt (sent OR dropped, with the reason) lands in the Email Log.',
          ],
        },
        { type: 'h', text: 'Your two screens' },
        {
          type: 'table',
          headers: ['Screen', 'What it shows'],
          rows: [
            ['**/admin/email-log**', 'Every email attempt: template, recipient, subject, and outcome (sent / dropped + why). Filter by status, template, recipient, date.'],
            ['**/admin/spam-log**', 'Every blocked form submission and which gate caught it (honeypot, spam filter, rate limit).'],
          ],
        },
        { type: 'callout', tone: 'warn', text: 'If someone says "the system didn\'t email me" — check the Email Log FIRST. It always has the answer: either it sent, or the row tells you exactly why it dropped (template not allowed, rate cap, etc.).' },
      ],
      keyPoints: [
        'Sender is noreply@rcrsal.com via Resend',
        'Only allowlisted email types send; everything is logged',
        '/admin/email-log answers every "where\'s my email" question',
      ],
      quiz: [
        {
          question: 'A rep says they never got a reminder email. What is your first move?',
          options: [
            'Resend it from your Gmail',
            'Check /admin/email-log — it shows whether it sent or exactly why it was dropped',
            'Restart the portal',
            'Ask IT to check the server',
          ],
          correct: 1,
          explanation: 'Every send attempt is logged with its outcome. Most likely answer: that email type is not on the allowlist yet.',
        },
      ],
    },
    {
      title: 'Tickets Oversight — Reading the Board',
      blocks: [
        { type: 'p', text: 'Every delivery lives in the **Tickets** tab and moves through statuses you can read at a glance:' },
        {
          type: 'table',
          headers: ['Status', 'Meaning'],
          rows: [
            ['created', 'Ticket exists, nothing physical happened yet'],
            ['materials_pulled', 'Rick is staging the order'],
            ['load_verified', 'On the truck — invoice + deduction already done'],
            ['en_route / arrived / delivered', 'The delivery itself'],
            ['completed / cancelled', 'Closed out'],
          ],
        },
        { type: 'p', text: 'Things to watch weekly: tickets sitting in **created** for more than a day (call the warehouse — did the order actually exist?), and the **stalled-tickets digest** which arrives daily at 7 AM once its email type is switched on.' },
        { type: 'callout', tone: 'tip', text: 'If ticket data is wrong (bad quantities, wrong customer), fix the ticket BEFORE the load is verified. After verify-load the invoice already exists — corrections then need a credit memo or an invoice edit, not a ticket edit.' },
      ],
      keyPoints: [
        'Tickets tab = source of truth for delivery status',
        'Fix bad ticket data BEFORE verify-load, not after',
      ],
    },
    {
      title: 'Credit Memos & Vendor Returns — Your Side',
      blocks: [
        { type: 'p', text: 'When drivers log returns, paperwork lands on your desk two different ways:' },
        {
          type: 'bullets',
          items: [
            '**Credit memos** (our stock came back): a CM record appears in Job_Material_Costs — verify the job got credited and the returned items make sense.',
            '**Vendor returns** (outside-supplier material went back): you get the notification — chase the supplier credit and mark it credited in the portal when it lands.',
          ],
        },
        { type: 'callout', tone: 'info', text: 'Real example from July 2026: job R-11192 swapped four 1½" pipe boots for three 2" boots. The corrected invoice (INV-20260702-0001, $67.62) plus credit memo CM11192-1 ($83.56) is exactly what a clean swap should look like in the books.' },
      ],
      keyPoints: [
        'CM records land in Job_Material_Costs — verify job credit',
        'Vendor returns need YOU to chase the supplier credit',
      ],
    },
    {
      title: 'User Accounts & Passwords',
      blocks: [
        { type: 'p', text: 'Since July 2026, anyone logging in with their original starter password is **forced to set their own password** before they can work. People who already set their own are never bothered.' },
        {
          type: 'steps',
          items: [
            'Someone locked out? Reset them to their starter password from the admin users screen',
            'Tell them the starter password — at next login the system forces them to set a fresh one',
            'You never need to know anyone\'s real password, and never ask for one',
          ],
        },
      ],
      keyPoints: [
        'Starter password = automatic forced change at next login',
        'Resets are self-serving — no password sharing needed',
      ],
      quiz: [
        {
          question: 'Rick forgot his password. What is the process?',
          options: [
            'Tell him the master password',
            'Reset him to his starter password; his next login forces him to set a new one',
            'Create him a brand new account',
            'He has to text Michael',
          ],
          correct: 1,
          explanation: 'The starter password acts as a reset funnel — it works exactly once as a login and immediately demands a new personal password.',
        },
      ],
    },
  ],
};
