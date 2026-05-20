# RCRS Sweep — Action Log

Single-line per action, in reverse-chronological order (newest at top). Each entry: `YYYY-MM-DD HH:MM` · actor · component · what · why · commit-or-link.

The scheduled routine appends an entry per action.

---

## 2026-05-20

- `12:15` · claude · lib/spam-filter.ts + data/lead-distro-config.json + app/api/forms/contact/route.ts · Hard-block customBlockedDomains + seed 4 known spam domains + apply spam check to contact form route · stop bot pitches at the door before they reach email · commit pending
- `12:00` · claude · lib/email-service.ts · Migrated from Google Apps Script to Resend SDK with per-template allowlist (default = contact-form, load-verified-invoice, driver-new-order) · finishes Phase 1.6 transport migration; awaits owner Resend env vars · commit pending
- `11:45` · claude · routine `rcrs-sweep` · Disabled all routine-side email (success + failure) per owner directive · zero-noise mode; ops failures surface via LOG.md instead · trigger trig_01VkrK3zux6G11GxgGjxYEJ9
- `11:05` · claude · docs/ · Added email-transport-comparison.md, email-callsite-audit.md, form-hardening-plan.md from parallel research agents · Phase 1.1, 1.2, 2 spec items done · commit f292368
- `10:35` · claude · repo · AGENDA.md + LOG.md created · canonical plan + action log for the multi-day sweep · commit 6fa9a3f
- `10:30` · claude · lib/email-service.ts · hard-disabled emailService.send() pending transport migration · GAS endpoint server-side amplifies every payload to owner gmail as malformed "NEW CONTACT FORM SUBMISSION" · commit 7787779
- `10:20` · claude · lib/form-service.ts · disabled GAS fetch in sendEmailNotification · stops "[Contact Page] New Lead:" amplifier path · commit 232fddd
- `10:18` · claude · lib/email-service.ts + lib/form-service.ts · per-recipient rate cap + removed gmail CC · first-pass safeguard; later proven insufficient (GAS injects gmail server-side, bypasses JS-side cap) · commit 3325653

---

## Format notes

- Use 24h local time.
- One action per line. Multiple related edits in one commit = one entry referencing the commit.
- For deploys: include the Vercel deployment URL or "auto-deploy on push".
- For owner-blocking decisions: use `actor=owner` and link the prompt/answer if possible.
