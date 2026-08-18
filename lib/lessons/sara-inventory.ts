/**
 * Sara's Inventory & Warehouse-Flow lesson — written 2026-08-18 against
 * current production behavior (Fix status / Undo verify-load / ticket-chain
 * self-check scanner, all shipped 2026-08-18).
 */
import type { Lesson } from './types';

export const saraInventoryLesson: Lesson = {
  slug: 'sara-inventory',
  moduleId: 'lesson-sara-inventory-2026',
  title: 'Inventory & Warehouse Flow — Stock, Corrections & the Self-Check',
  description:
    'How warehouse stock moves automatically, how to fix a mis-click without breaking the books, and how the system watches its own math for you.',
  audience: 'Sara / Admin & Office',
  estimatedMinutes: 25,
  sections: [
    {
      title: 'The Warehouse\'s Real Stock — One Tab, One Truth',
      blocks: [
        {
          type: 'p',
          text: 'Our real, physical warehouse stock lives in exactly one place: the **Inventory_Products** tab. About 11 items today — nails, caps, felt, Ice & Water Shield, ridge vent, bullet boots by size (1½", 2", 3", 4"), sealant, zipper boot. That tab is the canonical answer to "how much do we have."',
        },
        {
          type: 'table',
          headers: ['Field', 'What it means'],
          rows: [
            ['**currentQty**', 'What\'s actually on the shelf right now'],
            ['**minStockLevel**', 'The floor — drop below this and the low-stock alert fires'],
            ['**reorderQty**', 'How much we typically reorder when restocking'],
            ['**unitCost**', 'What WE pay our supplier — internal only, never shown to reps or customers'],
            ['**unitPrice**', 'What we charge on the invoice'],
            ['**lastCountDate**', 'The last time a human physically verified this quantity'],
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'unitCost is supplier cost, not customer price. It stays visible to owner/admin/office/manager and Richard — it never reaches JobNimbus, reps, or customers.',
        },
      ],
      keyPoints: [
        'Inventory_Products = the canonical stock tab, ~11 items',
        'unitCost is internal (supplier price); unitPrice is what customers see',
        'lastCountDate tells you how stale a quantity might be',
      ],
    },
    {
      title: 'How Stock Moves — You Don\'t Touch It Directly',
      blocks: [
        {
          type: 'p',
          text: 'Stock deducts **automatically** the moment Rick taps **Mark Loaded** on a delivery ticket at the warehouse. You never manually subtract inventory for a normal delivery.',
        },
        {
          type: 'steps',
          items: [
            'A material order comes in → a delivery **Ticket** is created',
            'Rick stages the order → status moves to Materials Pulled',
            'Rick taps **Mark Loaded** (this is the "verify-load" action)',
            'One tap writes the **Invoice**, writes a **Job Breakdown** if the job doesn\'t have one yet, and deducts every material line from Inventory_Products — all in one shot',
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          text: 'It\'s idempotent — an accidental double-tap of Mark Loaded cannot double-deduct stock. Every deduction is checked against an Inventory_Deductions_Log before it\'s applied, so a repeat click is a safe no-op.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: '"Other vendor" orders (materials picked up from an outside supplier like SRS or ABC, not our warehouse) are tagged VENDOR on the warehouse board and skip the deduction entirely — that material was never our stock to begin with.',
        },
      ],
      keyPoints: [
        'Mark Loaded = instant invoice + breakdown + stock deduction, one action',
        'A double-tap can\'t double-deduct — the deductions log guards it',
        'VENDOR (other_vendor) tickets never touch Inventory_Products',
      ],
      quiz: [
        {
          question: 'What happens to warehouse stock when Rick taps "Mark Loaded"?',
          options: [
            'Nothing — Sara has to manually subtract it later',
            'It deducts automatically, along with writing the invoice and job breakdown, in one action',
            'It only deducts if the ticket is tagged VENDOR',
            'It waits until the delivery is marked "delivered"',
          ],
          correct: 1,
          explanation: 'Mark Loaded (verify-load) is the single trigger: invoice, job breakdown (if missing), and the Inventory_Products deduction all happen together, and it\'s safe to double-tap.',
        },
      ],
    },
    {
      title: 'Fixing Mistakes Safely — Fix Status & Undo Verify-Load',
      blocks: [
        {
          type: 'p',
          text: 'Because Mark Loaded has real financial side effects (it deducts stock and writes money), the warehouse board doesn\'t let anyone freely edit a ticket\'s status. Two dedicated tools handle corrections instead — both new as of 2026-08-18.',
        },
        { type: 'h', text: '"Fix status ▾" — for a plain mis-click' },
        {
          type: 'p',
          text: 'Every ticket card on /portal/warehouse has a **Fix status ▾** button. It only allows moves that do NOT change inventory — nudging a ticket between created/assigned/materials_pulled, or between load_verified/en_route/arrived/delivered, for example. If you try to use it to cross the line between "before stock leaves" and "stock committed," it refuses and points you to the right tool instead.',
        },
        { type: 'h', text: '"Undo verify-load — restore stock" — for an accidental Mark Loaded' },
        {
          type: 'p',
          text: 'Office/admin only, and it requires you to type a reason. It reverses the exact quantities that were deducted, adds them back to Inventory_Products, and moves the ticket back to Materials Pulled. The invoice is kept, not deleted — if the ticket is re-verified later, that same invoice is reused, so nothing gets double-counted in the books.',
        },
        {
          type: 'callout',
          tone: 'warn',
          text: 'If ticket data is wrong (bad quantities, wrong customer), the cleanest fix is still to correct it BEFORE Mark Loaded. Once stock is committed, use Undo verify-load to back it out first rather than editing around it.',
        },
      ],
      keyPoints: [
        'Fix status only allows moves with zero inventory impact — it refuses boundary crossings',
        'Undo verify-load is office/admin only, requires a reason, and restores exact quantities',
        'Re-verifying after an undo reuses the same invoice — no double-counting',
      ],
      quiz: [
        {
          question: 'You accidentally tapped Mark Loaded on the wrong ticket. What do you do?',
          options: [
            'Use "Fix status" to move it back to Materials Pulled',
            'Edit the Inventory_Products tab directly to add the stock back',
            'Use "Undo verify-load — restore stock," type a reason, and it restores the deducted quantities and moves the ticket back',
            'Nothing — it will fix itself overnight',
          ],
          correct: 2,
          explanation: '"Fix status" specifically refuses moves that would change inventory, so it can\'t undo a verify-load. That job belongs to "Undo verify-load," which restores the exact quantities and requires a reason for the audit trail.',
        },
      ],
    },
    {
      title: 'Staying Stocked — Alerts & Counts',
      blocks: [
        {
          type: 'p',
          text: 'You don\'t have to babysit Inventory_Products by eye — the system watches minStockLevel for you.',
        },
        {
          type: 'bullets',
          items: [
            '**Low-stock alert** — a cron runs once a day and emails office/admin/owner a digest listing every item at or below its minStockLevel, grouped by out-of-stock / critical / low.',
            '**Legacy Inventory tab** — a separate tab that feeds an older standalone warehouse app. It\'s a one-way, read-only mirror: a cron pushes current Inventory_Products state into it every 15 minutes. You never edit that tab directly — any edit there would just get overwritten on the next sync.',
            '**Physical counts** — when you (or whoever\'s counting) walk the warehouse, the counted quantity is compared against the system quantity; when a discrepancy is resolved as an adjustment, currentQty and lastCountDate update to reflect the real, counted number.',
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          text: 'If a number in Inventory_Products looks wrong and you\'re not sure why, check lastCountDate first — if it\'s old, the drift is probably just uncounted-for real-world usage, not a system bug.',
        },
      ],
      keyPoints: [
        'Low-stock digest emails office/admin/owner daily when an item hits minStockLevel',
        'The legacy Inventory tab is read-only from Sara\'s side — it\'s just a mirror for Richard\'s app',
        'A resolved physical count updates currentQty and lastCountDate together',
      ],
    },
    {
      title: 'The Self-Check Has Your Back',
      blocks: [
        {
          type: 'p',
          text: 'There\'s a scanner that quietly checks the system\'s own math so you don\'t have to trace it by hand. For every recent delivery ticket it verifies the whole chain agrees: the material order on the ticket → the invoice → the job breakdown → the inventory deduction.',
        },
        {
          type: 'p',
          text: 'It\'s owner/admin only, at /api/admin/ticket-chain-scan. When it finds something off, it FLAGS it — red for a real problem (like a missing invoice or a deduction that doesn\'t match the order), yellow for a smaller drift worth a look — and it can PROPOSE an inventory adjustment to fix a mismatch. It never applies that adjustment itself. A human always decides.',
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'You don\'t have to go looking for trouble: any red finding rides along in the daily office digest email, and the scan\'s latest counts also show up on the system-health dashboard.',
        },
      ],
      keyPoints: [
        'The scanner checks: order == ticket == invoice == job breakdown == inventory deduction',
        'It flags red/yellow and proposes fixes — it never auto-applies an adjustment',
        'Red findings show up in the daily digest email and on the system-health dashboard',
      ],
      quiz: [
        {
          question: 'The self-check scanner finds a ticket where the inventory deduction doesn\'t match the order. What happens next?',
          options: [
            'It automatically corrects Inventory_Products to fix the mismatch',
            'It flags the mismatch and proposes an adjustment, but a human has to apply it',
            'It deletes the ticket',
            'Nothing — it only reports totals, not specific mismatches',
          ],
          correct: 1,
          explanation: 'The scanner is read-only by design. It flags the finding (red or yellow) and can propose the exact adjustment needed to reconcile it, but applying that adjustment is always a human decision.',
        },
      ],
    },
  ],
};
