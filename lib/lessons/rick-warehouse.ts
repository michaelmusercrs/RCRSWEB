/**
 * Rick's Warehouse & Delivery lesson — written 2026-07-02 against the
 * verified production flow (the portal was fixed and E2E-tested the same
 * day). This is the FIRST module a driver sees.
 */
import type { Lesson } from './types';

export const rickWarehouseLesson: Lesson = {
  slug: 'rick-warehouse',
  moduleId: 'lesson-rick-warehouse-2026',
  title: 'Your Warehouse App — The Complete Guide',
  description:
    'Everything about your day: logging in, the 5-tap delivery flow, photos, returns, and what happens behind each button.',
  audience: 'Rick / Drivers',
  estimatedMinutes: 20,
  sections: [
    {
      title: 'Logging In (and your new password)',
      blocks: [
        { type: 'p', text: 'Your app lives at **rcrsal.com** — open it in the browser on your phone and it goes straight to the login page. Your login is your work email.' },
        {
          type: 'steps',
          items: [
            'Go to **rcrsal.com** on your phone',
            'Enter your email: **richard@rcrsal.com**',
            'Enter your password',
            'First time after July 2026: the app will make you **set a new password**. Pick something only you know — this is now required.',
            'After login, tap **Warehouse** (or go to rcrsal.com/portal/warehouse) — add it to your home screen so it opens like an app',
          ],
        },
        { type: 'callout', tone: 'tip', text: 'On iPhone: Share button → "Add to Home Screen". On Android: menu (⋮) → "Add to Home screen". Now it opens with one tap, full screen.' },
        { type: 'callout', tone: 'warn', text: 'If the app ever asks you to change your password, that is real — it means you are still on a starter password. Change it. Never share it, and the office will never ask you for it.' },
      ],
      keyPoints: [
        'App address: rcrsal.com → Warehouse',
        'First login now requires setting your own password',
        'Add it to your phone home screen',
      ],
      quiz: [
        {
          question: 'Where does the warehouse app live?',
          options: ['rivercityroofingsolutions.com', 'rcrsal.com', 'JobNimbus', 'A text message link'],
          correct: 1,
          explanation: 'rcrsal.com is the internal team portal. The other site is for customers.',
        },
      ],
    },
    {
      title: 'Your Dashboard — What You See',
      blocks: [
        { type: 'p', text: 'The dashboard shows **today\'s work at a glance** and refreshes itself every 30 seconds — you never need to reload the page.' },
        {
          type: 'bullets',
          items: [
            '**Greeting + weather** for Decatur — a quick "is today workable" check',
            '**Today\'s count** — how many active deliveries are on the board',
            '**Cities** — where today\'s jobs are, so you can plan the route in your head',
            '**Ticket cards** — one card per job, newest on top. Each card shows the job number (R-#####), customer, address, materials count, and ONE action button for the next step',
          ],
        },
        { type: 'p', text: 'New tickets show up on their own — when the office or a material-order email creates one, it appears on your board with a **Pull Materials** button. You never create delivery tickets yourself unless the office asks you to (the **New Ticket** quick action exists for that).' },
        { type: 'callout', tone: 'info', text: 'The **JN Job** button on each card opens that job in JobNimbus if you need the full job file.' },
      ],
      keyPoints: [
        'Dashboard auto-refreshes every 30 seconds',
        'One card per job, one button for the next step',
        'New tickets appear automatically',
      ],
    },
    {
      title: 'The Delivery Flow — 5 Taps Per Job',
      blocks: [
        { type: 'p', text: 'Every delivery is the same 5 taps, in order. The button on the card always tells you the next one.' },
        {
          type: 'table',
          headers: ['Tap', 'When', 'What it does'],
          rows: [
            ['**1. Pull Materials**', 'When you start staging the order in the warehouse', 'Marks the job as being pulled — the office can see you started'],
            ['**2. Mark Loaded**', 'AFTER everything is on the truck and you checked it against the order', 'THE BIG ONE — see below'],
            ['**3. Start Delivery**', 'When you pull out of the yard', 'Marks you en route; photo buttons appear'],
            ['**4. Arrived**', 'When you get to the job site', 'Timestamps your arrival'],
            ['**5. Delivered**', 'After materials are off the truck', 'Closes out the delivery'],
          ],
        },
        { type: 'h', text: 'Why "Mark Loaded" matters most' },
        { type: 'p', text: 'The moment you tap **Mark Loaded**, three things happen automatically: the office gets the **invoice** for the job, the **warehouse stock counts** go down by what\'s on your truck, and the job\'s cost record is created. This is how the company knows what left the building.' },
        { type: 'callout', tone: 'warn', text: 'Only tap **Mark Loaded** when the load is ACTUALLY on the truck and checked. Not before. If you tap it twice by accident, don\'t worry — the system ignores the second tap, nothing doubles.' },
        { type: 'callout', tone: 'tip', text: 'If you spot damage or something missing while loading, use the notes/damage flags on the loading screen — whatever you write shows up on the office\'s invoice copy.' },
      ],
      keyPoints: [
        'Same 5 taps every job: Pull → Loaded → Start → Arrived → Delivered',
        'Mark Loaded = instant invoice + stock deduction — tap it only when truly loaded',
        'Double-taps are safe — nothing ever doubles',
      ],
      quiz: [
        {
          question: 'What happens the moment you tap Mark Loaded?',
          options: [
            'Nothing — it just changes the card color',
            'The customer gets a text',
            'The office invoice is created and warehouse stock is deducted automatically',
            'JobNimbus closes the job',
          ],
          correct: 2,
          explanation: 'Mark Loaded is the trigger for the invoice and the stock deduction. That is why you only tap it when the truck is actually loaded and checked.',
        },
        {
          question: 'You accidentally tapped Mark Loaded twice. What happened?',
          options: [
            'The job got invoiced twice — call the office immediately',
            'Stock got deducted twice',
            'Nothing extra — the system ignores the second tap',
            'The ticket got deleted',
          ],
          correct: 2,
          explanation: 'The system checks whether a ticket was already finalized. A second tap does nothing.',
        },
        {
          question: 'When should you tap Pull Materials?',
          options: [
            'When you start staging the order in the warehouse',
            'When you leave the yard',
            'At the end of the day for all jobs at once',
            'Never — the office taps it',
          ],
          correct: 0,
          explanation: 'Pull Materials tells the office you have started putting the order together.',
        },
      ],
    },
    {
      title: 'Photos on the Road',
      blocks: [
        { type: 'p', text: 'Once you tap **Start Delivery**, two photo buttons appear on the card: **Pre-Photo** and **Post-Photo**.' },
        {
          type: 'steps',
          items: [
            '**Pre-Photo** — the loaded truck or the drop spot BEFORE you unload (proof of what arrived)',
            '**Post-Photo** — the materials staged at the job site AFTER unloading (proof of condition + placement)',
          ],
        },
        { type: 'p', text: 'Photos attach to the ticket and save to the job record. If a customer ever claims materials were short or damaged, your photos settle it in seconds.' },
        { type: 'callout', tone: 'tip', text: 'Get the house number or something recognizable in at least one photo. Two extra seconds, saves arguments later.' },
      ],
      keyPoints: [
        'Photo buttons appear after Start Delivery',
        'Pre-Photo before unloading, Post-Photo after staging',
        'Photos are your protection on disputes',
      ],
    },
    {
      title: 'Returns, Credit Memos & Vendor Returns',
      blocks: [
        { type: 'p', text: 'Materials come back sometimes — wrong size, extras, job change. There are two different buttons for two different situations:' },
        {
          type: 'table',
          headers: ['Button', 'Use when', 'Example'],
          rows: [
            ['**Credit Memo**', 'OUR stock comes back to OUR warehouse', 'Customer swapped 1½" boots for 2" — the four 1½" boots come back on your truck'],
            ['**Vendor Return**', 'Materials from an OUTSIDE supplier (SRS, ABC…) go BACK to that supplier', 'Extra bundles from an SRS order that need to go back for credit'],
          ],
        },
        { type: 'p', text: 'A **Credit Memo** does the money side automatically — the job gets credited for what came back. Fill in the job number and the exact items and counts. A **Vendor Return** notifies Sara so she can chase the supplier credit.' },
        { type: 'callout', tone: 'warn', text: 'Always log returns THE SAME DAY they come back. Untracked returns are how the stock counts drifted in the past — that problem was cleaned up in July 2026, let\'s keep it clean.' },
      ],
      keyPoints: [
        'Credit Memo = our stock coming back to us',
        'Vendor Return = outside-supplier material going back to the supplier',
        'Log returns the same day, every time',
      ],
      quiz: [
        {
          question: 'A customer\'s job used SRS-supplied shingles and 2 bundles are left over to send back to SRS. Which button?',
          options: ['Credit Memo', 'Vendor Return', 'Mark Loaded', 'New Ticket'],
          correct: 1,
          explanation: 'Outside-supplier material going back to the supplier = Vendor Return. Credit Memo is only for our own warehouse stock coming back to us.',
        },
      ],
    },
    {
      title: 'Restocking & The One Place You See Cost',
      blocks: [
        { type: 'p', text: 'When new stock arrives at the warehouse, you receive it through the **inventory entry** screen — that is the one place in the whole system where you can see and enter what we PAY for materials (the supplier cost).' },
        { type: 'p', text: 'Everywhere else — your ticket cards, work orders, delivery paperwork — you see the sell price or no price at all. That is on purpose: supplier cost never goes on anything that leaves the warehouse.' },
        { type: 'callout', tone: 'warn', text: 'Never write our supplier cost on anything a customer or crew might see. If a printout shows a cost column where it shouldn\'t, tell Michael — that\'s a bug.' },
      ],
      keyPoints: [
        'Enter supplier cost only on the restock/receiving screen',
        'Cost never appears on delivery paperwork — by design',
      ],
    },
    {
      title: 'When Something Looks Wrong',
      blocks: [
        {
          type: 'table',
          headers: ['Problem', 'What to do'],
          rows: [
            ['Tapped a button and the card didn\'t change', 'Wait a few seconds — the board refreshes every 30s. Still stuck? Pull down to reload the page once.'],
            ['A ticket you expected isn\'t on the board', 'Check with the office — the order email may not have arrived yet. Do NOT create a duplicate ticket.'],
            ['Wrong materials or quantities on a ticket', 'Do not "fix" it by tapping through — call the office so they correct the ticket first, THEN load.'],
            ['App won\'t log you in', 'Check email spelling first. Still locked out? The office can reset you to a starter password — you\'ll set a new one at next login.'],
          ],
        },
        { type: 'p', text: 'Safety net: if a delivery ticket ever sits untouched for 2 days, the system finalizes it automatically every morning so nothing ships uninvoiced. But that\'s the backup — **your taps are the real record**, and they\'re what keeps stock counts true.' },
        { type: 'callout', tone: 'info', text: 'Found a bug or something confusing? Tell Michael directly — the app gets fixed fast now.' },
      ],
      keyPoints: [
        'Never create duplicate tickets',
        'Wrong ticket data → office fixes first, then you load',
        'The auto-finalizer is a backup, not the plan — your taps are the record',
      ],
      quiz: [
        {
          question: 'A ticket shows 10 squares of shingles but the order sheet in your hand says 12. What do you do?',
          options: [
            'Load 12 and tap Mark Loaded — close enough',
            'Load 10 — the app is always right',
            'Call the office to fix the ticket first, then load and tap Mark Loaded',
            'Create a second ticket for the extra 2',
          ],
          correct: 2,
          explanation: 'Mark Loaded invoices exactly what the ticket says. If the ticket is wrong, the invoice and stock counts will be wrong — the office corrects the ticket first, then you load.',
        },
      ],
    },
  ],
};
