# Infographic Copy Specs — Lead Distro Set

Six infographic copy briefs, ready to hand to a designer. Each spec includes the headline, key data points, suggested visual treatment, and call-to-action / takeaway. The designer renders the actual graphic; this file is the editorial brief.

Save these in a shared design folder so the team can re-spin them as the system evolves.

---

## Infographic 1: "How RCRS Routes Every Lead"

**Format:** Vertical flowchart, half-page or social-square (1080×1350).
**Audience:** internal team, BNI partners, public marketing.

### Copy

**Headline:** *Every Lead. Every Reason. Logged.*

**Subhead:** *Seven measurable factors, weighted by Chris. Algorithm picks — or a dispatcher confirms. Speed-to-lead under 5 minutes.*

**Flow nodes (top to bottom):**

1. **Lead arrives** (web form / JN / referral / canvass / walk-in)
2. **Address geocoded** → lat/lng
3. **Score every rep on 7 factors:**
   - Install Proximity 30%
   - Contact Proximity 15%
   - Door Knock Recency 10%
   - Referral Bonus 25%
   - Meeting Attendance 10%
   - Office Close Rate 5%
   - Response Time 5%
4. **Sort by total score**
5. **Decision branch:**
   - Top rep > 10% ahead → **Auto-assign**
   - Within 10% → **Tiebreaker: longest-since-last**
   - In Suggest mode → **Top 3 → dispatcher picks**
6. **Log it:** winner, runner-up, reason, weight version
7. **Start SLA timer:** 5 / 20 / 45 / 60 min escalation
8. **Notify rep + manager**

**Footer line:** *Every decision is auditable. No black box.*

### Visual treatment
- Brand green (#... — Chris/designer fills in) for the algorithm path
- Violet for the suggest-mode branch
- Amber for the SLA timer escalation
- Small clock icons next to each timer stage
- Logo + URL bottom-right

---

## Infographic 2: "The 7 Factors (Plain English)"

**Format:** Grid of 7 cards (3-2-2 layout) or horizontal scroll for social.
**Audience:** sales reps, new hires.

### Copy per card

#### Card 1: Install Proximity (×30)
**Headline:** Closest Completed Roof Wins
**Body:** Finished a job near the lead within the last six months? You score high. The "we just did your neighbor's roof" pitch is the highest-closing line in roofing.

#### Card 2: Contact Proximity (×15)
**Headline:** Relationships Compound
**Body:** Even if you didn't close the last conversation, having customers and leads in the area means you know the territory.

#### Card 3: Door Knock Recency (×10)
**Headline:** Boots on the Ground
**Body:** Canvassing the neighborhood in the last 90 days? You get credit. Activity rewards activity.

#### Card 4: Referral Bonus (×25)
**Headline:** Bring 'Em In, Keep 'Em
**Body:** If your network brought the lead to us, the bonus is yours. Full 25 points, every time.

#### Card 5: Meeting Attendance (×10)
**Headline:** Show Up. Engage.
**Body:** Monday meetings matter. Engagement matters. Reps who respond to their assigned leads score higher here.

#### Card 6: Office Close Rate (×5)
**Headline:** Could You Close a Stranger?
**Body:** Specifically measures your close rate on office-sourced leads (Sara / Destin's). Excludes referrals and self-gen so the score is comparable.

#### Card 7: Response Time (×5)
**Headline:** Speed Wins
**Body:** Under 5 min → 9× more likely to qualify. Under 30 → still great. Past 4 hours → the customer's already on a competitor's line.

### Visual treatment
- Color-coded by category: greens for proximity (1-3), amber for human factors (4-7)
- Big % weight at top of each card
- Icons: roof, contact, boot, handshake, calendar, percent, clock

---

## Infographic 3: "The Smooth Recency Decay"

**Format:** Two-curve graph (old vs new), landscape.
**Audience:** Chris, sales reps who care about why old jobs still count.

### Copy

**Headline:** *We Stopped Punishing Reps for Aging Records*

**Subhead:** *Old algorithm: a contact crossed day 90 and lost 30% of its value overnight. New algorithm: smooth exponential decay that matches reality.*

**Graph axes:**
- X: Days since interaction (0 to 730)
- Y: Recency multiplier (0 to 1.0)
- Two lines:
  - **OLD** (red, with cliff drops): 1.0 → 0.7 at day 90, → 0.4 at day 365, → 0.1 at day 730
  - **NEW** (green, smooth curve): exp decay `0.1 + 0.9 × exp(-days/180)` with floor at 0.10

**Data callouts:**
- Day 90: OLD 1.0, NEW 0.55
- Day 91: OLD 0.7 (cliff!), NEW 0.55 (continuous)
- Day 365: OLD 0.7, NEW 0.18

**Footer line:** *No more cliffs. No more 30%-overnight drops. Decisions match real life.*

---

## Infographic 4: "Auto vs Suggest Mode"

**Format:** Side-by-side comparison, two-column.
**Audience:** owners + dispatchers deciding which mode to run.

### Copy

**Headline:** *Two Routing Modes. Same Algorithm.*

#### Left column: AUTO

**Subhead:** *Speed.*
- Algorithm picks the winner.
- Lead assigned in milliseconds.
- SLA timer starts.
- Notifications fire.
- Dispatcher is a backstop, not the primary actor.

**Best for:** high-volume, repeatable lead sources.

#### Right column: SUGGEST

**Subhead:** *Judgment.*
- Algorithm surfaces top 3 with reasons.
- Lead held as `pending-manager-pick`.
- Dispatcher reviews and confirms.
- 5-minute decision rule.
- SLA timer starts on confirmation.

**Best for:** high-value leads, insurance, complex jobs.

**Bottom strip:** *Switchable anytime. Same audit log, same factor scoring. Different decision-maker.*

---

## Infographic 5: "What We Log on Every Lead"

**Format:** Two-panel split — left is "Distribution Log," right is "Outcome Log."
**Audience:** Chris, anyone who audits.

### Copy

**Headline:** *Every Lead, Two Stories.*

#### Left panel: DISTRIBUTION LOG (the assignment moment)
- Who got the lead + why (reason string)
- Every rep's score (top + runner-up + everyone else)
- Tiebreaker applied (if any)
- Weight-set version (so old decisions stay explainable when weights change)
- Override reason (if a human picked)

#### Right panel: OUTCOME LOG (what happened after)
- First contact attempt time + method (call / SMS / email)
- First customer connection (did they actually reach the customer?)
- Estimate created + dollar amount
- Job sold + amount
- Job lost + reason
- Reassignments (if any)
- Final disposition: closed-won / closed-lost / ghosted / reassigned-out

**Bottom strip:** *Together: a complete audit trail and the data we need to make the algorithm better every quarter.*

---

## Infographic 6: "Anti-Gaming Honesty"

**Format:** Two-column table, dark theme.
**Audience:** internal — sales team, dispatchers, owners.

### Copy

**Headline:** *We Know How You'd Game This. Here's How We Stop You.*

**Subhead:** *Every reward in any algorithm is gameable. We're upfront about the risks and the defenses.*

**Two-column table:**

| Gaming method | Defense |
|---------------|---------|
| Flip "contacted" without a real call | Phone-system log entry required (Twilio / CallRail / FreePBX) |
| Refuse junk leads to inflate close rate | Auto-declines count as losses |
| Show up at meeting, leave early | Geofenced check-in **and** check-out |
| Fake tasks / notes to look busy | Only verifiable activity counts (call >30s, SMS reply, EXIF photo, signed doc) |
| Sit on a lead → auto-reassigns to buddy | Reassignment skips prior assignee + their referral cluster |
| GPS spoof to fake nearby presence | Requires real customer address visit in last 14 days |
| Self-refer through a buddy | Referrer must be a distinct verified contact with prior history |

**Bottom strip:** *Some defenses are live today. Others ship in v2.1. The risks are tracked publicly in `docs/lead-distro-gap-analysis.md`.*

**Visual treatment:** dark background, danger-amber for gaming column, brand-green for defense column. Subtle warning icons for live defenses, padlock icons for planned defenses.

---

## Design system notes (apply to all 6)

- Use the RCRS brand palette: brand-green primary, amber secondary, violet for human-pick / suggestion mode, red for warnings / cliffs / gaming.
- Source the visual icons from Lucide (already used in the portal — keeps consistency).
- Every infographic must have the RCRS logo + a short URL footer (`rcrsal.com/training` or wherever the public docs go).
- Body text minimum 16pt for legibility on mobile. Headlines 36-48pt.
- File outputs: SVG master, PNG @2x for web, PDF for print, square + portrait variants for social.
