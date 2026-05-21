# General Lead-Routing Research (2026)

Research date: 2026-05-21. Scope: mature, non-roofing-specific lead-distribution patterns we can lift into our proximity/recency/referral/attendance/close-rate/response-time scoring engine.

---

## 1. Executive Summary

- **Scoring and routing are two separate engines.** Every mature stack (Salesforce, HubSpot, LeanData, LeadAngel) keeps the scoring model decoupled from the assignment graph. A score by itself is "useless without action" — pair it with a routing flow. We already do this; keep them separate.
- **Weighted round-robin is the floor, not the ceiling.** All serious tools (LeanData, LeadAngel, Chili Piper, Pipedrive Premium+) support per-rep weight multipliers. Pure equal-RR is treated as a beginner mode.
- **Capacity capping is the dominant fairness mechanism.** Hourly/daily/weekly caps per rep are how the industry prevents the "rich get richer" spiral — not by rebalancing weights, but by hard-stopping over-allocation.
- **No-show / cancel / vacation auto-adjust is now table stakes.** Chili Piper, LeanData, Calendly all credit/skip reps automatically. Reps don't get burned for legit unavailability and don't get rewarded for ghosting.
- **Self-tuning ML is mostly hype at the routing layer.** ML is real at the *scoring* layer (Einstein, HubSpot AI, Faraday). At the *routing* layer it's mostly rule-based with optional AI inference nodes (LeanData Q1 2026) for unstructured field classification. No mainstream product genuinely re-weights routing factors from closed-won feedback automatically — recalibration is a manual quarterly review.
- **Explainability via audit log is the standard pattern.** LeanData's "Audit Logs" show the exact path a record took, every decision node, and the inputs that drove each branch. Reps get a direct link to investigate. Salesforce equivalents log assignment-rule firing order.
- **Suggestion mode is rare.** Almost everything in this category auto-assigns. Closest to "top 3 with reasons" is Salesforce Omni-Channel's *pull* model (queue with prioritized work items reps can claim) and Distrobird's shared-pool/first-claim flow. Worth designing in for us.
- **Factor on/off vs. zero-weight is uncommon.** Most platforms only let you zero-weight or remove a node from the flow. LeanData's FlowBuilder is the cleanest: each node can be removed/disabled entirely without rebuilding the graph. HubSpot's branch-counter workaround can't toggle factors cleanly — you rewrite the workflow.
- **Salesforce-native dominance comes at a price.** LeanData runs $25K-$120K+/yr fully loaded; HubSpot integration is widely-flagged as weak; LeanData implementation needs a half-FTE admin. Don't underestimate the maintenance cost — we should keep our system lean and admin-editable in-app.
- **5-minute response SLA is the universally-cited number.** Responding in under 5 minutes makes a rep ~9x more likely to qualify a lead. Every mature router measures lead-create-to-first-touch and lead-create-to-assign separately.

---

## 2. Per-Product Findings

### Salesforce — Einstein + Assignment Rules + Omni-Channel
- **Models:** rule-priority cascade (first match wins, up to 50 rules), round-robin via queues, Omni-Channel adds skill-based + capacity-based push routing for service/sales work items.
- **Weights:** Einstein scores 1-99 using historical conversion; not admin-editable directly (it's ML-derived), but you can segment models (Enterprise vs SMB). Assignment rules themselves are hard-coded if/then.
- **UX:** Pure auto-assign. Omni-Channel supports push (auto) and pull (rep claims from queue) — closest thing to suggestion mode in the SF ecosystem.
- **Outcome metrics:** SLA timer fields, lead aging, conversion attribution via campaign + opportunity link. No native "routing decision attribution."
- **Self-tuning:** Einstein model refreshes every 10 days, rescores within an hour on field change. Scoring self-tunes; routing does not.
- **Fairness:** Omni-Channel capacity-aware; assignment rules are not — they're deterministic.
- **Audit:** Setup Audit Trail shows rule changes; lead history shows owner changes. Less granular than LeanData.
- **Factor toggle:** Rules can be deactivated entirely (boolean). Einstein factors are auto-selected — can't turn one off, only retrain.
- **Pricing:** Einstein needs Sales Cloud Enterprise+ ($165/user/mo) plus Einstein add-on. Omni-Channel is Service Cloud.
- **Weaknesses:** Hard to debug rule order; Einstein is opaque ("black box" complaint is universal).

### HubSpot — Lead Rotation + Workflows
- **Models:** Native round-robin only. No native weighted distribution, no capacity awareness, no availability/timezone awareness.
- **Weights:** Workaround via counter property + if/then branches (e.g., modulo for 50/30/20 split). Brittle.
- **UX:** Auto-assign in workflow.
- **Outcome metrics:** Standard CRM funnel reporting. No routing-specific dashboards.
- **Self-tuning:** None at routing layer.
- **Fairness:** Round-robin only — no protection against rich-get-richer.
- **Audit:** Workflow execution history per record. Adequate, not exceptional.
- **Factor toggle:** Whole workflow branches can be disabled; individual factors are if/then, so "off" = remove the branch.
- **Pricing:** Sales Hub Professional ($90/seat) for workflows; Enterprise for advanced.
- **Weaknesses:** "Breaks as teams grow" is the most-cited phrase. Drives orgs to LeanData, Distributely, RouterJet, Chili Piper.

### LeanData — pure-play leader
- **Models:** Visual FlowBuilder (drag-drop nodes): round-robin, weighted RR (weight=2 gets 2x), territory, account-matched, capacity-capped, conditional. Q1 2026 added **AI Inference Nodes** for LLM classification of unstructured fields.
- **Weights:** Per-pool member weight values. Admin-editable in UI.
- **UX:** Auto-assign with visual flow trace.
- **Outcome metrics:** SLA monitoring, routing audit logs, "lost leads" report.
- **Self-tuning:** No automatic weight tuning. AI nodes only classify, they don't adjust routing weights.
- **Fairness:** **Capping** under Advanced Settings — Hourly/Daily/Weekly caps + Conditional caps. This is the industry-standard rich-get-richer guard.
- **Audit:** **Best-in-class.** Audit Logs show every node, every decision, every input that drove each branch. Reps can be given a direct link to investigate their own assignments. No Apex knowledge needed.
- **Factor toggle:** Each node in FlowBuilder can be removed/disabled without rebuilding. Cleanest "turn it off" UX in the category.
- **Pricing:** Custom, $25K-$120K+/yr. Four tiers; Advanced (Lead+Contact+Account) is mid-market sweet spot.
- **Weaknesses:** Salesforce-native — HubSpot integration weak (27 G2 complaints). Steep learning curve. Support reportedly rigid. Needs ~0.5 FTE admin.

### LeadAngel — L2A matching + routing
- **Models:** Round-robin, individual assignment, weighted, queue-based. Native Salesforce + Dynamics 365 + HubSpot.
- **Weights:** Admin-editable. **Notable: dynamically changes weight based on rep performance** (one of the few that claims real performance feedback into routing).
- **UX:** Auto-assign.
- **Outcome metrics:** Standard funnel + L2A match-rate dashboards.
- **Self-tuning:** Performance-weighted distribution is the closest thing to a real self-tuning loop in this list — though specifics on the algorithm are not publicly documented.
- **Fairness:** Performance weighting actually amplifies rich-get-richer unless capped; check capping options carefully.
- **Audit:** Standard logs.
- **Factor toggle:** Routing rules can be enabled/disabled per segment.
- **Pricing:** Mid-market, less expensive than LeanData.
- **Weaknesses:** Less ecosystem; smaller community.

### Distrobird (and Distribute.ai — appears defunct / not surfaced)
- **Models:** Rule-based routing tied to form submissions; real-time queue rebalancing (add reps to busy queues on the fly).
- **Weights:** Rule conditions on form-field values; weighting is implicit via rule priority.
- **UX:** Auto-assign + shared inbox / first-claim queue pattern.
- **Outcome metrics:** Speed-to-lead, call connect rates, sequence engagement.
- **Self-tuning:** None.
- **Fairness:** Manual queue management.
- **Audit:** Standard.
- **Factor toggle:** Rules disable cleanly.
- **Pricing:** Mid-market; HubSpot-native angle.
- **Weaknesses:** All-in-one means less depth in any one area.

### Calendly Routing
- **Models:** Form-based qualification → routing to event type → round-robin within event team. Equal distribution, availability, "team priorities."
- **Weights:** Limited — priorities, not true weighted RR.
- **UX:** Auto-assign to next available rep.
- **Outcome metrics:** Booking rate, no-show rate.
- **Self-tuning:** None.
- **Fairness:** Equal distribution with availability check.
- **Audit:** Booking history; thin.
- **Factor toggle:** Form rules toggle on/off.
- **Pricing:** Routing requires Teams/Enterprise.
- **Weaknesses:** "Too simplistic for sales teams at scale; relies on self-reported data."

### Pipedrive
- **Models:** Automatic Assignment — 50 rules per entity, 2 condition sets x 160 conditions each. Assignee types: User, Team (round-robin), Org owner, Person owner.
- **Weights:** Rule priority cascade; no native per-rep weight multiplier.
- **UX:** Auto-assign.
- **Outcome metrics:** Standard CRM dashboards.
- **Self-tuning:** None.
- **Fairness:** Round-robin within team.
- **Audit:** Activity log.
- **Factor toggle:** Rules toggle individually.
- **Pricing:** Premium ($49/user/mo) or Ultimate.
- **Weaknesses:** No capacity capping; no skill matching; no per-rep weighting in the GUI.

### Revenue.io (formerly RingDNA)
- **Models:** "Hot Leads" speed-to-lead routing; tightly coupled to dialer + real-time call guidance ("Moments").
- **Weights:** Rule-based.
- **UX:** Auto-route to dialer; live coaching overlay.
- **Outcome metrics:** Call connect, talk time, conversation intelligence scoring.
- **Self-tuning:** Conversation AI surfaces real-time suggestions; not routing weight tuning.
- **Fairness:** Standard.
- **Audit:** Conversation recordings + call logs.
- **Pricing:** Enterprise. Salesforce-native.
- **Weaknesses:** Heavy stack; overkill unless you're calling-driven.

### Drift / Qualified (Salesloft owns Drift)
- **Models:** Conversational AI qualifies in chat, then routes. Qualified ("Piper" agent) is Salesforce-native and uses live SF data to route to account owner; Drift is more multi-CRM.
- **Weights:** Rule-based within chat playbooks.
- **UX:** Real-time routing during conversation — closest thing to "human-in-the-loop" routing.
- **Outcome metrics:** Conversation-to-meeting conversion.
- **Self-tuning:** AI conversation tuning, not routing weights.
- **Fairness:** Account-owner-first routing biases to existing relationships.
- **Audit:** Conversation transcripts.
- **Pricing:** Drift Premium ~$2,500/mo starting; Qualified enterprise.
- **Weaknesses:** Only solves inbound chat; doesn't address outbound or non-web channels.

### Chili Piper
- **Models:** Multi Round-Robin, Distribution Groups (combines RR counters across multiple distributions so a rep in two queues isn't double-fed).
- **Weights:** Per-rep weights within distribution.
- **UX:** Auto-assign + meeting handoff.
- **Outcome metrics:** Meeting booked, show rate, no-show rate.
- **Self-tuning:** **Auto-adjusts for no-shows, cancellations, vacations, manager overrides.** Credit/skip system counters spam-lead disruption.
- **Fairness:** Cross-queue counter unification is unique — directly addresses "rep in many pools gets overloaded."
- **Audit:** Distribution log.
- **Factor toggle:** Per-distribution toggles.
- **Pricing:** Per-seat; mid-market+.
- **Weaknesses:** Strong at meeting routing; weaker on pre-meeting lead nurture.

---

## 3. Patterns We Should Adopt (Ranked)

1. **Cross-queue counter unification (Chili Piper pattern).** If a rep is in multiple pools (e.g., "Madison County" + "referrals" + "high-value"), don't count them N times. Maintain one global "leads received this week" counter per rep, used across every pool decision.
2. **Hourly/daily/weekly caps per rep (LeanData pattern).** Single best rich-get-richer guard. Admin-editable in our UI. Top closer hits their daily cap → next-best rep auto-eligible.
3. **Auto-credit/skip on no-show, cancel, sick day (Chili Piper pattern).** If a rep doesn't make first contact in the SLA window, don't count that lead against their RR counter — and skip them in the next rotation.
4. **Audit log per assignment decision (LeanData pattern).** Every assignment writes a row: `lead_id, rep_id, timestamp, each factor's contribution score, final score, runner-up rep, runner-up score, decision-flow version`. Reps and managers can open the row to see "why this rep."
5. **Admin-editable factor weights with a "disable" toggle, not just zero-weight (LeanData FlowBuilder).** Per-factor: slider 0-100 plus an on/off boolean. Disabling removes the factor from the trace entirely (cleaner explainability than weight=0).
6. **Suggestion mode for high-value leads (Salesforce Omni pull pattern + queue/claim pattern).** For leads above a value threshold, show top-3 reps with reasons in a manager queue. Manager picks; default after 60s = top-1. This is rare in the market and would be a differentiator.
7. **Segment your model (Salesforce Einstein pattern).** Don't use one weight set for storm jobs + insurance jobs + retail jobs + warranty calls. Segment.
8. **Quarterly recalibration ritual, not real-time ML.** Closed-won data review every quarter, manually adjust weights. This is what the mature playbook actually does despite the "AI" marketing.

---

## 4. The "Rich Get Richer" Problem

How each handles it:

| Product | Mechanism | Rating |
|---|---|---|
| Salesforce assignment rules | None (deterministic cascade) | Poor |
| Salesforce Omni-Channel | Capacity per agent | Good |
| HubSpot native | None | Poor |
| LeanData | Hourly/daily/weekly caps + conditional caps | **Best in class** |
| LeadAngel | Performance weighting (can *worsen* it without caps) | Mixed |
| Chili Piper | Cross-queue counter unification + no-show credit | Excellent |
| Calendly | Equal distribution + availability | OK for small teams |
| Pipedrive | Round-robin only | Poor |

**Recommendation for us:** Implement two layers.

1. **Hard caps** (LeanData model): per-rep daily and weekly cap, admin-editable. Once hit, rep is skipped until the window resets.
2. **Soft floor** (our addition — none of the surveyed products do this cleanly): per-rep *minimum* lead count per week. If a rep is below floor mid-week, give them a +N point boost on the next eligible lead. Prevents the bottom-quartile from starving when scoring pushes everything to top closers. Combine with attendance/close-rate as the gating eligibility — the floor only applies if they meet baseline performance.

This two-layer cap+floor is the single most important fairness lever and it's largely *missing* from the market.

---

## 5. Self-Tuning / ML Loops — Realistic Assessment

**What's possible today:**
- ML *scoring* of lead conversion likelihood (Einstein, HubSpot, Faraday). Mature.
- LLM classification of unstructured form fields (LeanData AI Inference Nodes, 2026). New, narrow.
- Conversation intelligence scoring post-call (Revenue.io, Gong). Mature but post-hoc.

**What's hype:**
- "Self-tuning routing weights." LeadAngel claims dynamic performance weighting but algorithm is undocumented; no other major vendor genuinely re-weights routing inputs from outcomes. The industry recommends *quarterly manual recalibration against closed-won data* — that's the actual best practice.

**Realistic for us:**
- **Logged outcomes per assignment.** Capture `assigned_rep, score_components, outcome (won/lost/no-contact), days_to_close, dollar_value`. Build this first; don't tune anything yet.
- **Quarterly recalibration script.** After 3 months of data, run a regression: which factor weights *would have* maximized close-rate? Present manager with recommended new weights (don't auto-apply). Manager approves or edits.
- **A/B routing.** Hold out 10% of leads for an alternate weight set; compare conversion after 60 days.
- **Skip real-time ML at the routing layer.** It's not where the value is and our volume probably can't support a trustworthy model.

---

## 6. Explainability — Making "Why This Rep" Auditable

Adopt the LeanData audit-log pattern. Per assignment, log:

```
{
  "lead_id": "...",
  "assigned_to": "rep_X",
  "decision_timestamp": "...",
  "flow_version": "v3.2",
  "candidate_reps": [
    {"rep": "rep_X", "score": 87.4, "factors": {"proximity": 22, "recency": 15, "referrals": 10, "attendance": 18, "close_rate": 14, "response_time": 8.4}, "caps_status": "under_cap"},
    {"rep": "rep_Y", "score": 84.1, "factors": {...}, "caps_status": "under_cap"},
    {"rep": "rep_Z", "score": 81.0, "factors": {...}, "caps_status": "AT_CAP_SKIPPED"}
  ],
  "winner_reason": "highest score under cap; tiebreak: longer since last assignment",
  "manager_override": null
}
```

Pair with:
- **Rep-facing view.** "You got this lead because: proximity 22/25, attendance 18/20, you were 3.1 points ahead of next rep." Builds trust, reduces "the system is rigged" complaints.
- **Manager-facing view.** Filterable by date, rep, outcome. Spot patterns (e.g., "rep Q always wins on proximity but loses on close-rate — should we re-weight?").
- **Disabled factor visibility.** If a factor is admin-disabled, the audit log says "referrals: DISABLED (admin)" not "referrals: 0." Different signals.
- **Version pinning.** Every assignment records which weight-set version drove it. When you change weights, old assignments still explain themselves.

---

## 7. Sources

- Salesforce: [nc-squared 2026 guide](https://nc-squared.com/blog/article/salesforce-lead-scoring-best-practices), [Einstein Lead Scoring help](https://help.salesforce.com/s/articleView?id=ai.einstein_sales_lead_insights.htm), [Sweep 2026 routing guide](https://www.sweep.io/blog/salesforce-lead-routing-2025-guide), [Clientell Omni-Channel](https://www.getclientell.com/salesforce-glossary/omni-channel)
- HubSpot: [Default HubSpot round-robin 2026](https://www.default.com/post/hubspot-round-robin), [Daeda HubSpot RR workflow](https://daeda.tech/blogs/hubspot-round-robin-workflow/), [Resonate scaling](https://www.resonatehq.com/blog/lead-routing-in-hubspot)
- LeanData: [Round Robin overview](https://leandatahelp.zendesk.com/hc/en-us/articles/360016462273-Routing-Round-Robin-Overview), [LeanData 2026 reviews G2](https://www.g2.com/products/leandata/reviews), [Plauti vs LeanData 2026](https://www.plauti.com/blog/plauti-vs-leandata-best-lead-routing-for-salesforce-2026), [Default LeanData pricing 2026](https://www.default.com/post/leandata-pricing), [Audit logs guide](https://support.leandata.com/s/article/RoutingAuditLogsGuide690207e51196a), [Building fairness](https://www.leandata.com/blog/building-fairness-into-your-lead-distribution-strategy/)
- LeadAngel: [Lead routing](https://www.leadangel.com/lead-routing/), [L2A matching](https://www.leadangel.com/lead-to-account-matching/), [Dynamics 365 routing](https://www.leadangel.com/microsoft-dynamics-365-lead-routing/)
- Chili Piper: [Round-robin scheduling](https://www.chilipiper.com/post/round-robin-scheduling), [Distro fairness video](https://www.chilipiper.com/video/calibrate-fairness-in-distro), [Multi Round-Robin](https://www.chilipiper.com/products/features/multi-round-robin), [Setup distributions](https://help.chilipiper.com/hc/en-us/articles/29260564275603-Setting-up-your-Distributions)
- Distrobird: [G2 reviews](https://www.g2.com/products/distobird-distrobird/reviews), [Lead routing blog](https://www.distrobird.com/blog/lead-routing-sending-qualified-leads-to-the-right-reps)
- Calendly: [Routing](https://calendly.com/scheduling/routing), [Default Calendly 2026 guide](https://www.default.com/post/calendly-routing)
- Pipedrive: [Automatic assignment](https://support.pipedrive.com/en/article/automatic-assignment), [Automatic assignment blog](https://www.pipedrive.com/en/blog/automatic-assignment)
- Revenue.io: [Revenue.io homepage](https://www.revenue.io/), [MarketBetter review 2026](https://www.marketbetter.ai/blog/revenue-io-review-2026/)
- Drift / Qualified: [Drift vs Qualified 2026](https://www.knock-ai.com/blog/drift-vs-qualified), [Jotform comparison](https://www.jotform.com/ai/qualified-vs-drift/)
- SLA / explainability / ML: [Rework SLA library](https://resources.rework.com/libraries/lead-management/lead-assignment-sla), [Faraday lead prioritization 2026](https://faraday.ai/blog/lead-prioritization-best-practices), [Cornell algorithm fairness 2026](https://news.cornell.edu/stories/2026/04/making-big-tech-algorithms-fair-harder-it-looks), [Yahoo "rich get richer"](https://finance.yahoo.com/news/among-sales-account-executives-rich-100000168.html)
