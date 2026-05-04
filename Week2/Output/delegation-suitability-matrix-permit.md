# Delegation Suitability Matrix — Permit Pre-Screening System

**Role:** Senior AI Solutions Architect — Agentic Transformation (ATX)
**System:** Residential Building Permit Pre-Screening Agent
**Volume:** ~5,800 applications/year (~22/day)
**Date:** 2026-04-29

---

## Scoring Guide

Each task is scored across four dimensions (1–5 scale):

| Dimension | 1 (Low) | 3 (Medium) | 5 (High) |
|-----------|---------|-----------|---------|
| **Determinism** | Single correct answer from hard rules | Rules exist but edge cases require judgment | Fully subjective, expert discretion |
| **Input Legibility** | Fully structured, machine-readable | Semi-structured, requires parsing | Unstructured visual/prose, requires interpretation |
| **Reasoning Depth** | Simple lookup or regex | Multi-step conditional logic | Expert synthesis across multiple knowledge sources |
| **Risk Tolerance** | Mistake is low-consequence, reversible | Mistake triggers rework or delay | Mistake has legal, safety, or compliance consequences |

**Complexity Score** = average of the four dimension scores (1.0–5.0).

**Delegation:**
- **System** — deterministic code, rules engine, or direct API call. No LLM.
- **Agent** — LLM-based reasoning with tool-use (RAG, structured output, confidence scoring).
- **Human** — licensed professional judgment; agent output is advisory only.

---

## Part 1 — Delegation Matrix Table

### Workstream A: Intake Review

| Task | Primary Zone | Determinism | Input Legibility | Reasoning Depth | Risk Tolerance | Complexity | Delegation | Technical Justification |
|------|-------------|-------------|-----------------|----------------|---------------|-----------|-----------|------------------------|
| A-01 Virus scan & file integrity | Action | 1 | 1 | 1 | 4 | **1.75** | **System** | Binary pass/fail via AV API; no reasoning required |
| A-02 Duplicate `application_id` detection | Retrieval | 1 | 1 | 1 | 3 | **1.50** | **System** | UUID uniqueness constraint enforced at DB ingestion layer |
| A-03 GIS parcel address resolution | Retrieval | 1 | 2 | 1 | 4 | **2.00** | **System** | REST call to jurisdictional parcel API; address string normalisation only |
| A-04 Parcel encumbrance history lookup | Retrieval + Diagnosis | 3 | 5 | 3 | 5 | **4.00** | **Agent** | Requires RAG over unstructured enforcement PDFs; agent flags hits, human confirms relevance |
| A-05 Legacy Billing valuation retrieval | Retrieval | 2 | 3 | 1 | 4 | **2.50** | **Agent** | Batch-file ingestion with staleness flag; agent surfaces data age and confidence interval |
| A-06 Valuation cross-check (near threshold) | Diagnosis | 3 | 3 | 3 | 5 | **3.50** | **Agent → Human** | Agent compares self-report vs. billing export; human decides if delta >5% or data is <24hr old |
| A-07 Required document checklist | Retrieval + Decision | 1 | 2 | 1 | 3 | **1.75** | **System** | Configurable checklist per `project_type`; presence/absence check only |
| A-08 Document legibility assessment | Diagnosis | 5 | 5 | 3 | 3 | **4.00** | **Human** | No machine-reliable definition of "sufficiently legible"; visual judgment by trained reviewer |
| A-09 Attachment content-type validation | Action | 1 | 1 | 1 | 2 | **1.25** | **System** | MIME type and file signature check; deterministic |
| A-10 `submitted_at` timestamp integrity | Action | 1 | 1 | 1 | 4 | **1.75** | **System** | System-set field; reject any client-supplied value at API layer |
| A-11 Intake decision: proceed or return | Decision | 3 | 3 | 3 | 4 | **3.25** | **Agent + Human backstop** | Agent aggregates A-01–A-10 signals; human required when any dimension flags Medium or above |

### Workstream B: Triage

| Task | Primary Zone | Determinism | Input Legibility | Reasoning Depth | Risk Tolerance | Complexity | Delegation | Technical Justification |
|------|-------------|-------------|-----------------|----------------|---------------|-----------|-----------|------------------------|
| B-01 Project type classification from drawings | Diagnosis + Decision | 4 | 5 | 4 | 5 | **4.50** | **Agent → Human** | Multimodal agent reads plan drawings; confidence threshold gates human escalation; life-safety implications |
| B-02 Square footage calculation / verification | Retrieval + Diagnosis | 2 | 3 | 2 | 4 | **2.75** | **Agent** | Agent extracts dimensions from structured fields + drawing metadata; flags discrepancies >5% for human |
| B-03 Structural modification identification | Diagnosis | 5 | 5 | 5 | 5 | **5.00** | **Human** | Requires licensed structural engineering judgment; agent may flag candidate drawings but cannot confirm |
| B-04 Valuation threshold routing | Decision | 2 | 3 | 1 | 5 | **2.75** | **Agent (with staleness guard)** | Rule: `valuation_usd` vs. `ROUTINE_VALUATION_THRESHOLD`; agent applies staleness flag from A-05 before committing |
| B-05 Active rule set selection | Retrieval | 1 | 1 | 1 | 4 | **1.75** | **System** | SQL filter: `active=true AND effective_date <= submitted_at AND (sunset_date IS NULL OR sunset_date > submitted_at)` |
| B-06 IBC rule application | Action | 2 | 2 | 3 | 4 | **2.75** | **Agent** | RAG over structured IBC `rules` JSONB; agent maps project attributes to applicable sections |
| B-07 LOCAL rule application | Action + Synthesis | 3 | 3 | 3 | 5 | **3.50** | **Agent** | RAG over LOCAL amendments; LOCAL takes precedence — agent must surface conflicts before committing |
| B-08 Code conflict identification | Diagnosis | 3 | 3 | 4 | 5 | **3.75** | **Agent** | Agent cross-references LOCAL, STATE, IBC outputs; flags any section where two rule sets yield different outcomes |
| B-09 Conflict resolution by precedence | Decision + Synthesis | 3 | 3 | 4 | 5 | **3.75** | **Agent + Human** | Precedence rule (LOCAL > STATE > IBC) is known; agent applies it; human reviews for novel fact patterns |
| B-10 Code conflict resolution logging | Documentation | 1 | 1 | 1 | 4 | **1.75** | **System** | Structured audit log entry; triggered automatically after B-09 resolution is confirmed |
| B-11 Variance / special exception detection | Diagnosis | 4 | 4 | 5 | 5 | **4.50** | **Human** | Requires knowledge of local variance precedent; agent may surface candidate triggers but cannot qualify |
| B-12 Historic district / overlay zone check | Retrieval | 1 | 2 | 1 | 4 | **2.00** | **System** | GIS overlay polygon intersection query; deterministic given quality parcel data |
| B-13 Prior enforcement history (stop-work) | Retrieval + Diagnosis | 3 | 5 | 3 | 5 | **4.00** | **Agent** | Agent RAGs unstructured enforcement PDFs; surfaces hits with context; human confirms materiality |
| B-14 Agent confidence scoring | Decision | 2 | 2 | 2 | 5 | **2.75** | **Agent (internal)** | Model-native output; below 0.80 → `NEEDS_HUMAN_REVIEW` route; threshold is env-var `AGENT_CONFIDENCE_THRESHOLD` |
| B-15 `TRIAGE_CATEGORY` assignment | Decision | 3 | 3 | 4 | 5 | **3.75** | **Agent + Human backstop** | Agent synthesises B-01–B-14; routes to Human if any COMPLEX_SENIOR trigger fires or confidence < 0.80 |
| B-16 Deficiency list authorship | Documentation + Synthesis | 4 | 3 | 5 | 5 | **4.25** | **Agent + Human sign-off** | Agent generates draft with code citations; Plans Examiner reviews, amends, and legally signs off |
| B-17 Reviewer eligibility matching | Retrieval + Decision | 1 | 1 | 1 | 4 | **1.75** | **System** | Rule-based match on `role`, `current_workload < max_workload`, `licensed_jurisdictions` |
| B-18 Workload-cap exception handling | Exception-handling | 1 | 1 | 1 | 3 | **1.50** | **System** | Deterministic: if no eligible reviewer → escalate to SUPERVISOR with structured alert |
| B-19 Supervisor escalation notification | Action | 1 | 1 | 1 | 4 | **1.75** | **System** | Triggered notification; structured payload; no reasoning required |

---

## Part 2 — The "Agentic Edge" Analysis

### What Is the Agentic Edge?

The **Agentic Edge** is the boundary where LLM-based reasoning becomes insufficient and human judgment becomes mandatory. It is not a single line — it is a set of **Cognitive Breakpoints** where the control plane shifts from Agent to Human.

---

### Breakpoint 1 — Document Legibility (A-08)

**Trigger:** Site plan, elevation drawing, or survey is scanned at low resolution or is partially obscured.

**Why agents fail here:** There is no codifiable rule for "sufficiently legible." A Plans Examiner makes a professional judgment about whether a dimension can be inferred from context. Computer vision models can detect blur or low DPI but cannot assess whether the *specific dimension needed for setback compliance* is determinable from what is visible.

**TRIAGE_CATEGORY implication:** An illegible document that passes agent intake creates a false-clean application — it may be triaged as ROUTINE when it should be DEFICIENT. The false-positive cost is a permit approved on incomplete evidence.

**Edge rule:** Agent may flag low-DPI attachments (< 150 DPI on structural drawings). Any flagged document requires human sign-off before intake proceeds.

---

### Breakpoint 2 — Legacy Billing Staleness (A-05 / A-06 / B-04)

**Trigger:** Application submitted after midnight; Legacy Billing batch export has not yet run; project valuation is near the $150,000 ROUTINE threshold.

**Why agents fail here:** The agent has no reliable way to determine whether the valuation in the billing export reflects today's costs or yesterday's. The applicant's self-reported figure may differ. Within ±15% of the threshold ($127,500–$172,500), a $10,000 discrepancy changes the routing from ROUTINE to COMPLEX_SENIOR.

**Why this is invisible in the SOP:** The SOP says "verify valuation." It does not say "check the data timestamp and apply a staleness buffer." This is **lived work** that experienced technicians perform intuitively.

**TRIAGE_CATEGORY implication:** A stale valuation that reads $148,000 when the true figure is $155,000 misclassifies a COMPLEX_SENIOR case as ROUTINE. A licensed Plans Examiner could miss a structural review requirement.

**Edge rule:** Agent applies `STALENESS_GUARD`: if `valuation_usd` is within ±15% of `ROUTINE_VALUATION_THRESHOLD` AND `billing_export_age_hours > 20`, agent must flag for human cross-check before committing triage category.

---

### Breakpoint 3 — Structural Engineering Judgment (B-03)

**Trigger:** Drawings show removal or modification of a load-bearing wall, foundation alteration, or lateral system change.

**Why agents fail here:** Structural identification requires reading both plan intent and engineering notation (beam schedules, load diagrams, connection details). A false negative — agent says "no structural modification" when there is one — creates a ROUTINE triage for a COMPLEX_SENIOR application. The false-positive cost is **life safety**.

**TRIAGE_CATEGORY implication:** This is the single highest-consequence Agentic Edge. B-03 is the only task in the entire matrix rated 5.00 complexity. It is Human-Only by design, not by technical limitation.

**Edge rule:** Agent may surface candidate structural drawings for human review (flag any mention of "shear wall," "moment frame," "load bearing," "foundation," "beam schedule"). The human reviewer confirms presence or absence of structural modification. Agent never confirms absence.

---

### Breakpoint 4 — Code Conflict Resolution in Novel Fact Patterns (B-09)

**Trigger:** LOCAL ordinance and IBC prescriptive requirement conflict; no prior city precedent exists for the specific combination.

**Why agents fail here:** The precedence rule (LOCAL > STATE > IBC) is known and the agent can apply it. The failure mode is **novel fact patterns** — a new LOCAL amendment not yet in the RAG corpus, or an ambiguous scope clause requiring legal interpretation.

**TRIAGE_CATEGORY implication:** Wrong conflict resolution yields either an invalid ROUTINE approval (if LOCAL restriction was overlooked) or an unnecessary COMPLEX_SENIOR escalation (if IBC exemption was not surfaced).

**Edge rule:** Agent logs all conflicts and their resolutions. Any conflict resolution involving a LOCAL amendment effective within the last 90 days, or any LOCAL section with no prior application history, is flagged for human review.

---

### Breakpoint 5 — Confidence Floor (B-14 / B-15)

**Trigger:** Agent confidence score falls below `AGENT_CONFIDENCE_THRESHOLD` (default: 0.80).

**Why this is a designed breakpoint, not a failure:** The 0.80 threshold is a governance instrument. Below it, the agent's statistical uncertainty exceeds the acceptable risk tolerance for a permit routing decision. This is not a bug — it is the system correctly refusing to act when its own epistemic confidence is insufficient.

**TRIAGE_CATEGORY implication:** Any application where confidence < 0.80 is routed as `NEEDS_HUMAN_REVIEW` regardless of what the underlying signals suggest. This is the catch-all backstop for the entire matrix.

---

### Why Current "Manual Review" Items Are Unsuitable for Agents

| Task | Current Status | Unsuitability Reason |
|------|---------------|---------------------|
| A-08 Document legibility | Manual | No computable definition of "actionable legibility"; professional visual judgment |
| B-03 Structural modification ID | Manual | Life-safety consequence of false negative; requires licensed structural review |
| B-11 Variance / exception detection | Manual | Requires knowledge of local variance precedent; not fully captured in structured rule sets |
| B-16 Deficiency list (sign-off) | Agent drafts, human signs | Legal accountability for kickback record; agent draft reduces authorship time, not responsibility |
| Final `reviewer_decision` | Human-only | Regulatory requirement; agent may never set this field under any condition |

---

## Part 3 — Implementation Roadmap

### Automation ROI Ranking

**ROI Score** = (Volume Impact × Determinism) / (Implementation Effort × Risk)
- High volume + high determinism + low effort = highest ROI
- Low volume + low determinism + high risk = lowest ROI

---

### Wave 1 — Quick Wins (Deploy in Months 1–3)

*Low risk. High determinism. Minimal integration effort. Deliver immediate throughput relief.*

| Rank | Task | Complexity | Current State | ROI Driver |
|------|------|-----------|--------------|-----------|
| 1 | A-01 Virus scan | 1.75 | Manual queue | Eliminates security processing bottleneck; fully automatable |
| 2 | A-02 Duplicate detection | 1.50 | Manual check | DB constraint; zero agent cost |
| 3 | A-09 Attachment validation | 1.25 | Manual | MIME check; trivial to implement |
| 4 | A-10 Timestamp integrity | 1.75 | Partially enforced | API-layer rejection; one-time fix |
| 5 | A-03 GIS parcel resolution | 2.00 | Manual address lookup | Single REST call; removes ~5 min/application |
| 6 | A-07 Document checklist | 1.75 | Manual checklist | Configurable rules engine; ~15 min/application saved |
| 7 | B-05 Rule set selection | 1.75 | Manual | SQL query; immediate |
| 8 | B-10 Conflict resolution logging | 1.75 | Manual | Structured audit log; triggered automatically |
| 9 | B-12 Historic/overlay check | 2.00 | Manual GIS lookup | GIS polygon intersection; deterministic |
| 10 | B-17 Reviewer eligibility matching | 1.75 | Manual | Rules engine; removes assignment bottleneck |
| 11 | B-18 Workload cap exception | 1.50 | Manual escalation | Deterministic; automated SUPERVISOR alert |
| 12 | B-19 Supervisor escalation notification | 1.75 | Manual | Triggered structured alert; zero reasoning cost |

**Wave 1 impact:** Removes ~35–40 minutes of manual processing per ROUTINE application (65% of volume = ~3,770 applications/year). At a conservative 30 min/application saved, this is ~1,885 person-hours/year recovered for skilled review work.

---

### Wave 2 — Strategic Bets (Deploy in Months 4–9)

*High reasoning. High volume. Requires agentic orchestration, RAG, and confidence-gated human backstop.*

| Rank | Task | Complexity | Agent Architecture | Human Backstop Required |
|------|------|-----------|-------------------|------------------------|
| 1 | B-06 IBC rule application | 2.75 | RAG over IBC `rules` JSONB; structured output with section citations | When novel section not in corpus |
| 2 | B-07 LOCAL rule application | 3.50 | RAG over LOCAL amendments; precedence-aware retrieval | Any LOCAL amendment <90 days old |
| 3 | B-08 Code conflict identification | 3.75 | Cross-reference agent output from B-06/B-07; surface delta | All identified conflicts |
| 4 | B-04 Valuation threshold routing | 2.75 | Rule application with Legacy Billing staleness guard | Valuation within ±15% of threshold + stale data |
| 5 | B-02 Square footage verification | 2.75 | Extract from structured fields + drawing metadata; flag discrepancies | Discrepancy > 5% between self-report and drawing |
| 6 | B-15 TRIAGE_CATEGORY assignment | 3.75 | Synthesises all B-01–B-14 signals; structured TRIAGE_CATEGORY output | Confidence < 0.80 OR any COMPLEX_SENIOR trigger |
| 7 | A-04 Parcel encumbrance history | 4.00 | RAG over enforcement PDF archive; named-entity extraction for stop-work orders | All positive hits |
| 8 | B-13 Prior enforcement check | 4.00 | Same RAG pipeline as A-04; share corpus | All positive hits |
| 9 | A-05 Legacy Billing retrieval | 2.50 | Batch file ingestion pipeline; staleness metadata attached to every record | Near-threshold + stale |
| 10 | B-09 Conflict resolution | 3.75 | Apply LOCAL > STATE > IBC precedence; log resolution | Novel fact patterns; recently amended LOCAL sections |

**Wave 2 impact:** ROUTINE triage becomes near-fully automated (agent handles ~90% of the 3,770 ROUTINE cases end-to-end; human reviews exception queue only). DEFICIENT detection accuracy improves — agent catches deficiency patterns human reviewers miss under load. Estimated: 2,200–2,500 person-hours/year recovered.

---

### Wave 3 — Human-Augmentation Layer (Deploy in Months 10–18)

*High complexity, irreducible human judgment — but agents can dramatically reduce preparation time.*

| Rank | Task | Complexity | Agent Role | Human Role |
|------|------|-----------|-----------|-----------|
| 1 | B-16 Deficiency list authorship | 4.25 | Draft complete list with code citations, section quotes, correction guidance | Plans Examiner reviews, amends, signs |
| 2 | A-06 Valuation cross-check | 3.50 | Surface delta, data age, confidence interval; recommend accept/escalate | Final call on near-threshold cases |
| 3 | B-01 Project type classification | 4.50 | Multimodal analysis of drawings; output candidate classification with confidence | Human confirms or overrides |
| 4 | A-11 Intake decision | 3.25 | Aggregate all intake signals into go/no-go recommendation with reasoning | Human reviews any flagged application |
| 5 | B-09 Conflict resolution (novel) | 3.75 | Pre-surface relevant LOCAL sections, prior rulings, IBC exemptions | Senior Examiner resolves with agent as research assistant |

**Wave 3 impact:** Reduces skilled reviewer time per DEFICIENT application from ~45 min to ~15 min (agent drafts, human reviews). Reduces COMPLEX_SENIOR preparation time from ~90 min to ~30 min. These are the highest-value human hours to reclaim.

---

### Human-Irreducible (Never Automate)

| Task | Reason |
|------|--------|
| A-08 Document legibility final call | No computable threshold; professional judgment |
| B-03 Structural modification confirmation | Life-safety; licensed engineer accountability |
| B-11 Variance / exception qualification | Local legal precedent; not fully machine-representable |
| `reviewer_decision` (APPROVED/REJECTED) | Regulatory requirement; agent may never set this field |

---

## Summary Dashboard

| Wave | Tasks | Avg Complexity | Delegation Mode | Estimated Hours Recovered/Year |
|------|-------|---------------|----------------|-------------------------------|
| Wave 1 — Quick Wins | 12 | 1.68 | System | ~1,885 |
| Wave 2 — Strategic Bets | 10 | 3.38 | Agent + Human backstop | ~2,300 |
| Wave 3 — Human Augmentation | 5 | 3.85 | Agent draft + Human sign-off | ~1,100 |
| Never Automate | 4 | 4.38 | Human Only | 0 (protected) |
| **Total recoverable** | | | | **~5,285 hrs/year** |

At ~5,285 recoverable hours/year across ~5,800 applications, the system moves from an average of ~55 minutes of manual processing per application to an estimated **~12–15 minutes of skilled human review per application** — concentrated on the judgment tasks where licensed expertise is genuinely required.

---

*Reference: CLAUDE.md (Permit Pre-Screening System), ATX Assessment Methodology (atx-assessment.md), ATX Concepts (atx-concepts.md), Cognitive Load Map (cognitive-load-map-permit-pre-screening.md)*
