# Cron Concurrency Audit — 2026-05-21

## TL;DR

All 11 cron handlers under `app/api/cron/*` correctly require `CRON_SECRET` for auth. **None implement in-flight locking** — a manual hit + scheduled hit colliding (or a slow handler running past the next slot) could race on sheet writes. Risk is low because Vercel crons are at-most-once-per-slot, but mutating handlers (especially `sync-inventory-tab`, `backup-sheets`, `marketing-intel`, `auto-reassign`, `check-lead-timers`) should adopt `withCronLock` from `lib/cron-lock.ts` (new this commit) before going to production-grade.

## Inventory of crons

| Cron | Schedule | Mutates | Lock now? |
|---|---|---|---|
| `check-lead-timers` | `*/2 * * * *` | Lead_Distribution_Log + emails | NO |
| `auto-reassign` | `*/5 * * * *` | Leads + emails | NO |
| `publish-blog` | `0 6 * * *` | Blog_Posts + blog-posts mirror | NO |
| `meeting-reset` | `0 16 * * 1` | MeetingNumbers_2026 reset | NO |
| `backup-sheets` | `0 * * * *` | Backup tabs | NO |
| `sync-inventory-tab` | `*/10 * * * *` | Inventory tab | NO |

Crons parked in `_disabledCrons` (off until owner activates):
- `weekly-numbers-reminder` (×2 — was removed earlier today)
- `low-stock-alert` (was removed earlier today)
- `auto-review-request`
- `stalled-tickets-digest`
- `marketing-intel`
- `monday-prep-pregen`
- `review-request-queue`

## Why concurrent-runs CAN happen

1. **Manual + scheduled collide.** Owner hits `/api/cron/sync-inventory-tab` at HH:09 to test it; Vercel fires it again at HH:10. Two handlers write to `Inventory` simultaneously.
2. **Slow handler overruns next slot.** `marketing-intel` polls 6 external sources + writes 6 rows. If one source hangs near its timeout, the handler can run >10 min; the next `0 13 * * *` slot fires while the previous is still writing.
3. **Rolling deploy.** Vercel keeps old instances warm for ~10s after a deploy. If a cron fires at exactly that moment, both old + new instance can receive it.

## Mitigation shipped this commit — `lib/cron-lock.ts`

Best-effort sheet-backed lock. `withCronLock(cronName, { staleMinutes: 15 }, async () => { ... })`:
- If row `cron-lock:{name}` exists with status='running' and timestamp < staleMinutes old → return 423 Locked.
- Otherwise claim the lock, run handler, mark status='done' (or 'errored') with duration + last status.
- Sheet-backed (uses `SystemHealth` tab, lazy-create). Same pattern as `lib/email-log.ts` etc.
- Heartbeat side-effect: `/admin/system/health` can read these rows to show last-run status (already supported by the dashboard via the existing SystemHealth tab convention).

## Adoption recommendation

**Phase 1** (this commit) — ship `lib/cron-lock.ts`, document.

**Phase 2** — wrap the 6 production crons that mutate state:
- `app/api/cron/sync-inventory-tab/route.ts` — HIGH (deduplication critical)
- `app/api/cron/backup-sheets/route.ts` — MEDIUM (re-running just over-writes)
- `app/api/cron/marketing-intel/route.ts` — LOW (sheet rows are append-only with unique timestamps)
- `app/api/cron/check-lead-timers/route.ts` — MEDIUM (emails leaks if not de-duped)
- `app/api/cron/auto-reassign/route.ts` — HIGH (lead reassignment must not double-fire)
- `app/api/cron/publish-blog/route.ts` — MEDIUM (publish flag idempotent but emails not)

Pattern per route:
```ts
import { withCronLock } from '@/lib/cron-lock';

export async function GET(request: NextRequest) {
  // auth check unchanged...

  return withCronLock('sync-inventory-tab', { staleMinutes: 15 }, async () => {
    // existing handler body
    return NextResponse.json({ success: true, ... });
  });
}
```

**Phase 3** — adopt across the `_disabledCrons` set before they're moved live.

## Open questions for owner

- For `marketing-intel`, do we want a longer staleMinutes (e.g. 60) since some sources are slow? Default 15 is fine for the others.
- Should crons that fail be auto-retried after the lock is released, or do we treat one-failure-per-slot as final? Default behavior: failed handlers leave `status='errored'`; the next scheduled slot picks up cleanly (won't see a 'running' status).
