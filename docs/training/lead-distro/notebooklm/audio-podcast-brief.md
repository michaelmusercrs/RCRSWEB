# Audio Podcast Brief — Lead Distro Deep Dive

**Format:** 5–7 minute conversational deep-dive, two-host style.
**For NotebookLM:** Use NotebookLM's "Audio Overview" generator after uploading the study guide + four core training docs. The prompts and structure below are designed to give NotebookLM's hosts the right conversational arc.

---

## 1. Recommended NotebookLM customization prompt

When generating the Audio Overview, paste this as the customization:

> "Two hosts having a relaxed, slightly technical conversation about River City Roofing Solutions' in-house lead distribution algorithm. The audience is the sales team, dispatchers, and Chris (the owner who tunes weights). Focus on (a) why the algorithm exists and what problem it solves, (b) the seven factors in plain language with a worked example, (c) the difference between Auto and Suggest mode, (d) the smooth recency decay (and why the old step-function cliff was a problem), (e) anti-gaming risks honestly acknowledged, (f) the quarterly recalibration ritual instead of fake 'self-tuning AI.' Keep it conversational; one host can play the curious newcomer who asks 'wait, why does that matter?' a few times. End with a one-sentence takeaway."

---

## 2. Conversation arc (for human reviewers / editors)

### Cold open (~30 sec)
- Hook: "Did you know roofing companies that respond to a lead in under 5 minutes are 9x more likely to qualify them?"
- Tension: "So how do you decide, in seconds, which rep gets each new lead?"

### Act 1 — The problem (~60 sec)
- Manual dispatch is too slow.
- Pure round-robin is fair but ignores who's actually best positioned.
- ServiceTitan's Dispatch Pro does this — but it's $400–$2,000/mo, enterprise-tier.
- RCRS built their own. It's been ahead of every roofing CRM they surveyed.

### Act 2 — The seven factors (~90 sec)
- Walk through the seven: install proximity (the killer pitch), contact proximity, door knocks, referrals, attendance, close rate, response time.
- Weights total 100. Chris can dial them up or down.
- New: any factor can be **dismissed** entirely. Off means off — not just zero.
- Story beat: "Imagine three reps are within a mile of a new lead. One finished a roof two doors down last week. Another has a stale contact from 2022. The third was knocking the neighborhood yesterday. The algorithm sees all of that and ranks them in milliseconds."

### Act 3 — Recency, the clever bit (~60 sec)
- Old algorithm had cliffs: day 90 was worth 1.0×, day 91 was worth 0.7×. A 30% drop overnight.
- New algorithm: exponential decay, smooth. Today is 1.0, three months is 0.55, a year is 0.18, anything past two years floors at 0.10.
- Why it matters: real life doesn't have cliffs. Decisions should reflect that.

### Act 4 — Auto vs Suggest (~45 sec)
- Auto: algorithm decides, lead is assigned in milliseconds, SLA timer starts.
- Suggest: top 3 candidates surface with reasons; dispatcher picks. Slower but better judgment on high-value leads.
- Most companies don't offer Suggest mode. It's rare in the market.

### Act 5 — The self-improvement loop (~60 sec)
- Every assignment is logged with reason + runner-up + score breakdown.
- Every outcome is logged: first contact, estimate, sold, lost, ghosted.
- Quarterly, Chris (or Claude) looks at outcome data and asks: "Which weights *would have* maximized closing rate?" Recalibrate.
- Honest disclaimer: real-time AI auto-tuning is mostly hype. LeadAngel claims it; their algorithm is undocumented. Manual quarterly recalibration is what the mature playbook actually does.

### Act 6 — The honest disclaimer about gaming (~45 sec)
- Every reward in any algorithm can be gamed if people are motivated.
- RCRS knows the gaming methods (response-time flip, close-rate via decline, attendance without check-out, GPS spoof, reassignment shopping, referral self-deal).
- Each has a planned defense.
- Being upfront about it is part of why the team trusts the system.

### Close (~20 sec)
- Takeaway: "It's not the most sophisticated routing engine on the market. But it's the one the team can see, understand, and trust — and that's what actually moves the close-rate needle."

---

## 3. Talking points the hosts should hit

- "Every assignment is auditable. There's no black box."
- "Disabling a factor is different from setting its weight to zero. The audit log shows DISABLED (admin) — clearer intent."
- "New reps get a 30-day boost so they don't structurally starve."
- "When two reps are within 10% of each other, the longest-waiting rep wins. That's the fairness rail."
- "The outcome log is what makes the system capable of improving over time."

---

## 4. Sample dialogue snippets for the hosts

> **Host A:** So when a new lead comes in, the system has to decide in like a second which of the eight active sales reps gets it. How does it do that?
>
> **Host B:** It scores everyone. Seven factors, each weighted. The big one is install proximity — has this rep finished a roof near here in the last six months? That's worth thirty points by default.
>
> **Host A:** Why does that matter so much?
>
> **Host B:** Because the killer pitch in roofing is "we just did your neighbor's house." It closes deals. So a rep who can walk into a lead's house and say that has a huge advantage. The algorithm reflects that.

> **Host A:** What happens when two reps are tied?
>
> **Host B:** Old version, it just picked first-in-list, which honestly wasn't fair. New version, when scores are within ten percent of each other, it goes to whoever's been waiting longest for a lead. The longest-since-last rule. So if Adam got two leads this morning and Brendon hasn't gotten one in a week, Brendon wins the tie.

> **Host A:** What's stopping a rep from gaming this?
>
> **Host B:** Honestly? Right now, a lot of it. If you flip "contacted" in the mobile app without making a real call, the system counts it. That's a known gap. The next version requires the phone log to actually have an outbound call. They're being upfront about it.

---

## 5. NotebookLM regeneration tips

- If the first audio overview is too dry, regenerate with: "Make it more conversational, slightly playful. The hosts can disagree mildly on whether 'AI self-tuning' is real or hype."
- If too marketing-heavy: "Keep it sharper. Don't pitch the product, explain how it works. The audience is internal — they already use it."
- If too long: "Tighten to 5 minutes. Cut the anti-gaming section to 30 seconds; reference 'a separate FAQ on gaming risks' instead."

---

## 6. Distribution suggestion

Once generated, the audio file can:
- Live in the portal's training section (`/portal/training`) as the lead-in for new sales rep onboarding.
- Be embedded in the BNI presentation deck as a 90-second clip ("here's how we route leads").
- Be shared with insurance partners as a 2-minute trust signal.
