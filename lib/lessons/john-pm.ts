/**
 * John's Project Manager lesson — written 2026-07-02 against current
 * production behavior. Applies to Bart as well.
 */
import type { Lesson } from './types';

export const johnPmLesson: Lesson = {
  slug: 'john-pm',
  moduleId: 'lesson-john-pm-2026',
  title: 'Project Manager — Material Orders Done Right',
  description:
    'How to place material orders that flow cleanly to the warehouse, the invoice, and the job costing — and the two data rules that keep everything joinable.',
  audience: 'John & Bart / Project Managers',
  estimatedMinutes: 15,
  sections: [
    {
      title: 'Where Your Order Goes When You Hit Submit',
      blocks: [
        { type: 'p', text: 'Your material order at **/portal/pm** kicks off the whole delivery chain. One submit does all of this:' },
        {
          type: 'steps',
          items: [
            'Creates the delivery **Ticket** the warehouse sees on their board',
            'Notifies the warehouse (driver new-order email) — items only, no prices',
            'Creates the internal cost record for the job',
            'Adds the delivery to the schedule',
          ],
        },
        { type: 'p', text: 'From there it\'s the warehouse\'s 5-tap flow: Pull → **Mark Loaded** (that tap creates the office invoice and deducts stock) → Start → Arrived → Delivered.' },
        { type: 'callout', tone: 'warn', text: 'Because Mark Loaded invoices EXACTLY what the ticket says, your order accuracy IS the invoice accuracy. A wrong quantity on your order becomes a wrong invoice and wrong stock counts downstream.' },
      ],
      keyPoints: [
        'One submit → ticket + warehouse notice + cost record + schedule',
        'Your order data becomes the invoice — accuracy matters',
      ],
      quiz: [
        {
          question: 'Why does order accuracy matter so much?',
          options: [
            'The office retypes it anyway',
            'The invoice and stock deduction are generated automatically from your order data',
            'JobNimbus rejects bad orders',
            'It doesn\'t — the warehouse fixes it',
          ],
          correct: 1,
          explanation: 'Nothing downstream is retyped. Ticket data flows straight into the invoice and stock counts at Mark Loaded.',
        },
      ],
    },
    {
      title: 'The Two Data Rules',
      blocks: [
        { type: 'h', text: 'Rule 1 — Job numbers are always R-#####' },
        { type: 'p', text: 'Whatever you type — bare digits, "R-11071", even an M- material number by mistake — the system normalizes it to **R-#####** (the JobNimbus job number). Everything joins on that key: the ticket, the invoice, the breakdown, the schedule. Use the real JN job number, always.' },
        { type: 'h', text: 'Rule 2 — Watch your units (the Ridge Vent trap)' },
        { type: 'p', text: 'Some items are priced per **stick/piece** in our stock but measured in **linear feet** in the field. If you enter ridge vent as LF, the system auto-converts to sticks (4 LF = 1 stick) and notes the conversion on the ticket.' },
        {
          type: 'table',
          headers: ['You type', 'System stores', 'Why'],
          rows: [
            ['60 LF ridge vent', '15 sticks', 'Stock is counted in 4-ft sticks'],
            ['15 sticks ridge vent', '15 sticks', 'Already in stock units — untouched'],
          ],
        },
        { type: 'callout', tone: 'tip', text: 'If a converted quantity on the ticket looks off, say something before the load is verified — after that, the invoice already exists.' },
      ],
      keyPoints: [
        'Always the real R-##### job number',
        'LF-priced items auto-convert to stock units — sanity-check the result',
      ],
      quiz: [
        {
          question: 'You order 40 LF of ridge vent. What hits the warehouse ticket?',
          options: ['40 sticks', '10 sticks (auto-converted, noted on the ticket)', '40 LF', 'An error'],
          correct: 1,
          explanation: 'The system converts LF to 4-ft sticks and writes a conversion note on the ticket so everyone can see what happened.',
        },
      ],
    },
    {
      title: 'What You Can and Can\'t See (Cost vs Price)',
      blocks: [
        { type: 'p', text: 'You see **sell prices** everywhere you work. You do NOT see supplier **cost** — that\'s limited to owner/admin/office/manager by company rule (reconfirmed July 2026).' },
        { type: 'p', text: 'This is not about trust — it\'s so cost can never leak onto anything customer-facing through a screenshot, a printout, or a shared screen. If any screen you use ever shows a supplier-cost column, report it as a bug.' },
      ],
      keyPoints: [
        'PMs see price, not supplier cost — by rule',
        'Cost on your screen = bug, report it',
      ],
    },
    {
      title: 'Changes, Returns & Order History',
      blocks: [
        {
          type: 'bullets',
          items: [
            '**Order not loaded yet** → call the office to correct the ticket, then the warehouse loads the corrected version',
            '**Materials coming back** (swap, overage) → the driver logs a **Credit Memo** — the job is credited automatically; you\'ll see it in the job costing',
            '**Outside-supplier extras** (SRS, ABC) → driver logs a **Vendor Return**; Sara chases the supplier credit',
            '**Order history** → your PM screen lists your past orders and their live status, so "where\'s my delivery" is one look, not one phone call',
          ],
        },
        { type: 'callout', tone: 'info', text: 'Real example: R-11192 needed 2" boots instead of the 1½" ordered. Fix looked like: corrected invoice for 3× 2" + credit memo for the returned 4× 1½". Clean swap, clean books.' },
      ],
      keyPoints: [
        'Corrections happen at the ticket, before loading',
        'Returns are driver-logged, auto-credited — you verify in job costing',
      ],
    },
  ],
};
