# Video Scripts — Lead Distro Training Set

Five short videos, each 2–4 minutes. Designed for screen-recording the actual portal with a voiceover. Scripts include the spoken VO, the on-screen action, and bullet points for any slide overlay.

These work well as standalone NotebookLM source documents (upload alongside the study guide) — NotebookLM can use them to answer "how do I do X" questions verbatim.

---

## Video 1: "Lead Distro in 90 Seconds" (overview)

**Length:** 90 sec
**Audience:** new sales reps, BNI presentations
**Where filmed:** screen recording of `/portal/admin/lead-distro` (admin scrubbing through)

### Script

> **[0:00 — Title card: "How RCRS Routes Leads"]**
>
> **VO:** When a new lead comes in, somebody has to decide which rep gets it — and they have about five minutes to make that decision before the customer's interest cools off.
>
> **[0:10 — Show the lead-distro admin panel scrolling slowly]**
>
> **VO:** River City Roofing Solutions doesn't do this manually. We don't do pure round-robin either. We score every rep on seven measurable factors, and the algorithm picks — or hands a short list of suggestions to a dispatcher.
>
> **[0:25 — Zoom in on weight sliders]**
>
> **VO:** The seven factors: install proximity — has this rep finished a roof nearby? Contact proximity. Door knock recency. Referral bonus. Meeting attendance. Office close rate. Response time. Each one is weighted, and the weights are tunable. Owners can dial them up or down anytime.
>
> **[0:50 — Show Live Preview with an address entered]**
>
> **VO:** Here's what it looks like. Type an address, see how every rep would score it right now. The top rep wins — unless they're within ten percent of the runner-up, in which case the rep who's been waiting longest gets the lead.
>
> **[1:10 — Show the routing mode toggle]**
>
> **VO:** And there's a switch — auto-assign for speed, or suggest mode where a dispatcher picks from the top three. For high-value leads, suggest mode lets human judgment beat the algorithm.
>
> **[1:25 — Title card: "Fast. Fair. Auditable."]**
>
> **VO:** Every decision is logged with a reason. No black box. That's how the system stays trusted.

### Slide bullets (if used)
- Speed-to-lead: ~9× qualification under 5min
- 7 weighted factors
- Algorithm or dispatcher
- Every decision logged with reason

---

## Video 2: "Why Did I Get This Lead?" (rep self-service)

**Length:** 3 min
**Audience:** sales reps
**Where filmed:** screen recording of a rep's view + Distribution History

### Script

> **[0:00 — Title: "Why Did I Get This Lead?"]**
>
> **VO:** You just got a lead notification. Maybe you're surprised. Maybe you wanted to know why. Here's how to find out.
>
> **[0:15 — Show /portal/admin/lead-distro → Distribution History]**
>
> **VO:** Open the lead-distro admin panel — Chris or Sara can pull this up for you if you don't have access. Scroll down to Distribution History. Every assignment in the last 20 is here.
>
> **[0:35 — Zoom in on a specific row]**
>
> **VO:** Find your lead by address. You'll see the timestamp, who was assigned (you), how the algorithm picked you (auto, round-robin tiebreaker, or manual), and your factor breakdown.
>
> **[0:55 — Highlight the reason string]**
>
> **VO:** The reason field tells the story. For example, "Hunter Rivers: install proximity 16.8 — Harold Brown 0.18 miles away, recent install — plus contact proximity 6.3." That's it. That's why you got this lead.
>
> **[1:25 — Show factor breakdown chips]**
>
> **VO:** The chips next to the assignment show each factor's contribution. Big numbers on install proximity mean you finished a roof nearby. Big numbers on contact proximity mean you have customer relationships in the area. Referral bonus shows up as a flat 25 if you brought the lead in.
>
> **[1:55 — Pull up the same view filtered to a rep who didn't win]**
>
> **VO:** Want to know why someone *else* got a lead? Same view. The runner-up rep field shows who came in second. If it's you, look at the gap percentage. Within ten percent? The tiebreaker — longest time since last lead — decided it. Bigger gap? The other rep just scored higher.
>
> **[2:25 — Back to title]**
>
> **VO:** No mystery, no favoritism. Just data, reasons, and a system you can audit. If something looks wrong, screenshot the row and tell Chris. That's how we make the algorithm better.

### Slide bullets
- Distribution History = full audit log
- Reason field = the one-liner answer
- Factor chips = the contribution breakdown
- Runner-up + gap = the close-call story

---

## Video 3: "Tuning Weights" (for Chris / admins)

**Length:** 4 min
**Audience:** Chris, Michael, owners
**Where filmed:** admin panel deep-dive

### Script

> **[0:00 — Title: "Tuning the Lead Distro Weights"]**
>
> **VO:** The algorithm has seven factors with weights that must total 100. When the team's behavior changes — a new sales push, a market shift, hiring new reps — you'll probably want to adjust. Here's how.
>
> **[0:20 — Show the weight section with sliders]**
>
> **VO:** Each factor has a green or grey toggle, a number input, and a slider. The toggle is new in version 2. If you turn it off, that factor is fully dismissed — its weight doesn't count, and the audit log shows "DISABLED" instead of "weight zero." That distinction matters when you're auditing decisions later.
>
> **[0:50 — Demonstrate dismissing a factor]**
>
> **VO:** Watch what happens when I disable door knock recency. The slider greys out, the running sum recalculates from six factors instead of seven, and now those six need to total 100. If they don't, the save button stays grey.
>
> **[1:20 — Show the Live Preview]**
>
> **VO:** Before you save, always use Live Preview. Type a known address — somewhere a lead has actually come from. See how the algorithm scores it with your new weights. If the top rep doesn't make sense, your weights need more work.
>
> **[1:50 — Walk through 3-4 tuning scenarios]**
>
> **VO:** A few patterns to know. If leads are going to far-away reps, bump install and contact proximity. If new reps are starving — say Joseph or Alijah are at zero leads this week — lower the clear-winner gap percentage, which forces more ties into the longest-since-last tiebreaker. If reps are gaming response time, drop that weight or dismiss it until we ship the phone-log verification.
>
> **[2:40 — Save and confirm]**
>
> **VO:** Click save. You'll get a green toast on success. Changes take effect on the very next inbound lead — no restart needed. Best practice: screenshot the prior weights before saving, in case you want to revert.
>
> **[3:20 — Title: "What Not to Do"]**
>
> **VO:** Don't change weights mid-day to favor a specific rep. The algorithm is fair because it's consistent — one-off tweaks erode that. If you need a one-time override, use manual assignment instead. And don't disable a factor without telling the team — disabled factors visibly affect everyone's queue.

### Slide bullets
- Toggle ≠ weight 0
- Live Preview before saving
- 4 common tuning scenarios
- One-off override ≠ weight change

---

## Video 4: "Dispatcher SOP — Suggest Mode" (for office staff)

**Length:** 3 min
**Audience:** Sara, Destin, anyone manually picking
**Where filmed:** dispatch queue page (note: v2.5 — UI to be built; this script is forward-looking)

### Script

> **[0:00 — Title: "Picking from Suggestions"]**
>
> **VO:** When the system is in Suggest mode, the algorithm hands you the top three candidates instead of auto-assigning. You're the dispatcher. Here's the flow.
>
> **[0:20 — Show pending-pick queue]**
>
> **VO:** Open the dispatch queue. Pending picks are at the top — anything labeled "pending-manager-pick" is waiting on you. Each card shows the lead address, the three candidate reps ranked, their scores, and a one-sentence reason for each.
>
> **[0:45 — Walk through picking]**
>
> **VO:** Read each reason. The top rep is the algorithm's pick — they probably have proximity, recency, or a referral connection. Number two and three are usually within ten or fifteen points. Pick the right one.
>
> **[1:10 — When to override the algorithm]**
>
> **VO:** You can pick anyone — not just the top three. Use the "Other rep" dropdown for special cases: returning customer who asked for a specific rep, new rep who needs a coaching opportunity, top three all swamped. When you override, always add a reason. It goes in the audit log and helps Chris tune the weights later.
>
> **[1:40 — The five-minute rule]**
>
> **VO:** Don't sit on a pending pick longer than five minutes during business hours. The customer is waiting; the SLA timer doesn't start until you confirm. If you can't decide, default to the top candidate. The algorithm is usually right.
>
> **[2:10 — Closing]**
>
> **VO:** Picking from suggestions is a judgment call. The system gives you the data; you bring the context. It's the highest-leverage human touch in the entire pipeline.

### Slide bullets
- Pending-pick queue waits on you
- Read the reason, pick the right rep
- "Other rep" for special cases
- 5-min decision rule
- Always log override reasons

---

## Video 5: "Onboarding a New Rep" (for HR / Chris)

**Length:** 2.5 min
**Audience:** Chris, Michael, HR-adjacent
**Where filmed:** mix of code editor view, admin panel, and sheet

### Script

> **[0:00 — Title: "Adding a New Sales Rep"]**
>
> **VO:** New rep starts Monday. Here's how to get them into the lead distro system.
>
> **[0:15 — Show team-roles.ts]**
>
> **VO:** Add them to lib/team-roles.ts. Role is "sales." Active is true. Set their createdAt to today's date — that triggers the 30-day new-rep boost so they don't structurally starve while building their book.
>
> **[0:45 — Show Rep_Preferences sheet]**
>
> **VO:** In the master sheet, find the Rep_Preferences tab. Add their slug. Set countiesEnabled to the counties they'll work, or leave it blank for all counties. This is also where their per-rep boost will eventually live when capacity caps ship.
>
> **[1:15 — Show Rep_Availability sheet]**
>
> **VO:** Same sheet, Rep_Availability tab. Add them with isReceivingLeads true. AdminOverride false. They show up immediately in the admin panel's rep availability toggle.
>
> **[1:45 — Test in the admin Live Preview]**
>
> **VO:** Open admin lead-distro. Hit Live Preview with a real address. Confirm the new rep appears in the ranked list. They'll usually score at the floor — 10 points — for the first 30 days, then the boost expires and they're scored normally.
>
> **[2:15 — Closing]**
>
> **VO:** Total time: about three minutes. Tell the rep to expect a slow first week — the new-rep boost helps but they still need real install proximity records to start winning real leads. Set the expectation up front.

### Slide bullets
- team-roles.ts: add, role=sales, createdAt=today
- Rep_Preferences: counties
- Rep_Availability: isReceivingLeads=true
- Verify via Live Preview
- First 30 days = boost; week 1 = slow
