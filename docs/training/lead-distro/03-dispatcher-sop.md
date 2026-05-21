# Dispatcher SOP — Handling Inbound Leads

**Audience:** Office staff (Sara, Destin), Chris, anyone who actively dispatches leads or manages the queue.
**Read time:** ~8 minutes.

---

## 1. Two modes, one rule

There are two ways a lead can be handled in our system:

- **Auto mode** — the algorithm assigns immediately. You're a backstop, not the primary actor. Your job is to watch the queue for problems (no-touch, slow response, complaints) and intervene only when needed.
- **Suggest mode** — the algorithm surfaces top 3 candidates. **You're the primary actor.** Every lead needs an explicit pick.

The Routing Mode is set in the admin panel. Check it (top of `/portal/admin/lead-distro`) so you know which game you're playing.

**The one rule across both modes:** every lead has a known owner within 5 minutes of arrival during business hours. Speed beats clever routing every time.

---

## 2. Auto mode — your daily flow

### Morning (first 15 min of the day)
1. Open the Distribution History panel. Scan the last 20 assignments.
2. Look for red flags:
   - Same rep winning 5+ in a row (might mean availability is wrong elsewhere)
   - Round-robin fallback on every assignment (might mean weights are too flat — escalate to Chris)
   - High-value lead going to a new rep (might be correct, but worth a sanity check)
3. Check rep availability toggles. Anyone marked unavailable who shouldn't be? Anyone available who's actually on vacation?

### Throughout the day
- **SLA breach watch.** When a lead crosses the warning (20 min) or urgent (45 min) timer without a contact attempt, the system pings the manager. You're cc'd. Decide: pull the lead and reassign manually, or chase the rep?
- **Reassignment escalations.** If the system auto-reassigns at 60 min, you'll see it in the Distribution History with method=round_robin and overrideReason flagged. Verify the new rep is going to get on it; if not, call them yourself.
- **Manual override.** If you know better than the algorithm — e.g., a returning customer who specifically asked for a particular rep — use the manual-assign dropdown on the dispatch page. The override is logged with your name and reason.

### End of day
- Check the response log. Any leads with no `firstContactAt` after 8 hours? Those are tomorrow's reassignments.

---

## 3. Suggest mode — your daily flow

You'll see a pending-pick queue (coming in v2.5 — for now, watch the Distribution History for entries marked `pending-manager-pick`). Each entry will show:

- The address + customer
- 3 candidate reps ranked
- Each rep's score breakdown and one-line reason
- An "Assign to" button per rep

Your job: pick the right one within **5 minutes**.

### How to pick when scores are close

When the top 2 candidates are within 5 points of each other, the algorithm essentially tied them. Use these tiebreakers in order:

1. **Who's on the road right now?** A rep already in the area should get the lead.
2. **Who hasn't gotten one in a while?** Soft-floor logic — keep everyone fed.
3. **Who has the right vibe for this customer?** Read the lead notes. Insurance jobs need a calm, insurance-savvy rep. Storm jobs need someone who can show up tomorrow. Retail needs a closer.
4. **Default to #1.** Don't over-think it. The algorithm is usually right.

### When to skip the top 3 entirely

You can manually assign to anyone via the "Other rep" option. Reasons to skip the top 3:

- Customer specifically requested someone not in the top 3 (relationship beats algorithm)
- A new rep needs a coaching opportunity and this is a low-stakes lead
- The top 3 are all swamped (capacity caps will help here when they ship)

**Always add a reason when you override.** It goes in the audit log and helps Chris tune the algorithm later.

---

## 4. SLA escalations — your action menu

The system fires 4 escalations:

| Stage | At | Auto action | Your action |
|-------|-----|------------|-------------|
| 1. Reminder | 5 min | Notify the rep | None — give them a chance |
| 2. Warning | 20 min | Notify manager | Watch — message the rep if it's been a known issue |
| 3. Urgent | 45 min | Final warning | Call the rep. If they don't pick up, prepare to pull. |
| 4. Reassign | 60 min | Auto-reassign | Verify the new rep is on it. Call the customer to set expectations. |

**For high-value or insurance leads**, compress the timeline mentally. If a $40k storm lead has no contact attempt after 15 minutes, don't wait for the system — pull it manually and reassign to someone you know is available.

---

## 5. Handling complaints from reps

The most common complaints:

> "Why didn't I get that lead? I was right there."

**Action:** open the Distribution Log row for that lead. Walk them through:
- Their score (which factor pulled them down)
- The winner's score (which factor pulled them up)
- The runner-up status (were they actually #2 or further down?)

90% of the time, the rep didn't have a recent install nearby, or the algorithm correctly weighted someone with a fresh referral. The log makes it indisputable.

> "The system never gives me leads."

**Action:** filter Distribution History by their rep slug. Count their assignments over the last 7/14/30 days. If it's actually low, check:
- Are they marked unavailable? (Reps sometimes flip themselves off accidentally)
- Are they outside the county/territory for most recent leads?
- Is their close rate / response time dragging them down on the new-rep boost?
- Are their geo-tagged contacts up to date? (Sales reps' addresses go stale)

> "I should have gotten the referral bonus on that one."

**Action:** check the `Geocoded_Contacts` source field on the referring contact. If it's blank or wrong, the referral chain breaks. Fix the source, re-run the assignment.

---

## 6. Working with the Geocode Sync

Every couple of weeks, click **Geocode All** in the admin panel. It pulls new JN contacts and adds them to the proximity index. Takes a couple minutes.

If reps are complaining their close-by jobs aren't being counted, the most likely cause is the proximity index hasn't been refreshed recently.

---

## 7. End-of-week ritual (Friday afternoon)

1. Pull the Distribution History for the week. Sort by assigned rep.
2. Eyeball the spread. Is everyone in the active sales pool getting something? Joseph and Alijah (new reps) should be getting **at least 2 leads per week** — if they're at 0, the new-rep boost isn't enough; tell Chris.
3. Spot-check 3 random assignments. Walk through the reason string. Does it make sense? If something feels off, flag it.
4. Open the Outcome Log (when it's surfaced in v2.1 UI). Look for high "ghosted" rates — those are anti-gaming signals.

---

## 8. When to escalate to Michael / Chris

- Weights look wrong (lots of round-robin on what should be obvious wins)
- A rep is being repeatedly disadvantaged for no clear reason
- A pattern emerges: same customer getting reassigned 3+ times
- High-value lead lost because of slow first contact
- The algorithm and dispatcher (you) disagree consistently — that's a tuning issue

Don't suffer in silence. The system gets better when you flag what doesn't work.

---

## 9. Things you should never do

- **Don't dismiss factors in production without warning Chris.** Disabled factors visibly affect routing for everyone. Coordinate first.
- **Don't manually assign to bypass the SLA timer.** If you do, you're hiding a problem instead of fixing it.
- **Don't change weights on the live config in the middle of the day** to favor one rep. The algorithm is fair because it's consistent. One-off tweaks erode trust.
- **Don't skip logging override reasons.** Future-you (and future-Chris) will need to know why.
