# Parked Vercel Crons

These cron jobs are written + ready but NOT yet active. Move into
`vercel.json` under the `crons` array when ready to activate, then run
a deploy.

## Marketing Intel Sweep (DRAFT)

```json
{
  "path": "/api/cron/marketing-intel",
  "schedule": "0 8 * * *",
  "_note": "Daily 3am CT marketing intelligence sweep. PARKED — owner moves to crons[] after smoke-test."
}
```

Originally stored as `_disabledCrons` in vercel.json. Vercel now rejects
unknown top-level keys, so the parked config was moved here on 2026-05-20
to unblock deploys. Restore the entry in vercel.json `crons[]` when the
smoke test is complete.
