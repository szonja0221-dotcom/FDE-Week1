
# ATX Cognitive Load Map — Permit Pre-Screening System

**Project:** Residential Building Permit Triage Agent
**Methodology:** ATX Phase 2 — Cognitive Load Mapping
**Volume:** ~5,800 applications/year (~110/week, ~22/day)
**Date:** 2026-04-28

---

## Section 1 — Process Topology Narrative (Lived Work)

### What the SOP says happens

Application arrives → system assigns SUBMITTED → intake check → triage → reviewer decision.

### What actually happens

A permit technician opens the queue at 8am. The first application is a residential addition. The SOP says "verify completeness." In practice, this means:

1. **Opening PDFs one by one** — the site plan is a 6MB scan at 72 DPI. The setback dimension in the northeast corner is blurry. The tech zooms in, compares it to the parcel dimensions from the GIS system (a different browser tab), does the mental arithmetic, and decides whether it's legible enough or whether to kick it back. This is not a checkbox — it is a **judgment call on evidentiary sufficiency**.

2. **Pulling valuation data** — the technician opens the Legacy Billing System to confirm project valuation. The system runs a nightly batch export. If the application came in this morning, the valuation in the system may be from yesterday's file, or from the applicant's self-report which hasn't been validated yet. Near the $150,000 threshold, the technician pauses and either accepts the number, flags it for manual confirmation, or makes a conservative call. This pause is **invisible in the SOP**.

3. **Checking parcel history** — the enforcement database is a separate legacy system. The technician manually searches by address. A stop-work order from 3 years ago may be buried in a 40-page PDF. Retrieval is manual; recognition of relevance requires domain knowledge.

4. **Resolving code conflicts** — the technician applies LOCAL, then STATE, then IBC. When LOCAL has a variance procedure and IBC has a prescriptive requirement, the technician must decide which governs. This is not a lookup; it is **synthesis with legal consequences**.

5. **Classifying project type** — the submitted form says "interior remodel." The drawings show a load-bearing wall removal. The technician reclassifies to "structural modification" — bumping valuation threshold eligibility and triage category. This classification is **not recoverable from the form alone**.

6. **Writing the deficiency list** — when kicking back, the technician drafts the itemized list. Each item must cite a code section. The technician chooses which deficiencies to include, how to describe them precisely enough to be actionable but not so specific as to pre-advise the applicant on how to game the system. This is **expert authorship under legal accountability**.

### Cognitive Hotspots

| ID | Hotspot | Why it matters |
|----|---------|---------------|
| H1 | Blurry site plan interpretation | No rule determines "sufficiently legible" — judgment call |
| H2 | Legacy Billing batch-export lag | Near-threshold valuations may be based on stale data |
| H3 | Enforcement history manual lookup | Pattern recognition across unstructured historical records |
| H4 | LOCAL/STATE/IBC conflict synthesis | Precedence rules are known but application is contextual |
| H5 | Project type reclassification from drawings | Requires reading intent from plans, not just form fields |
| H6 | Deficiency list authorship | Legal writing with code citations under professional accountability |
| H7 | Agent confidence boundary | Below 0.80, the agent routes to human — but the boundary itself requires calibration |

---

## Section 2 — Jobs to be Done (JtD) Table

| JtD ID | Job to be Done | Trigger | Cognitive Goal | Nature |
|--------|---------------|---------|---------------|--------|
| JtD-1 | Application Intake Verification | New application reaches INTAKE_REVIEW | Determine whether application is complete enough to begin triage | Decision-making + Exception-handling |
| JtD-2 | Parcel and Address Validation | Intake begins | Confirm site address resolves to a valid, encumbrance-free parcel | Execution + Retrieval |
| JtD-3 | Valuation Confirmation | Intake or Triage begins | Establish a reliable project valuation for threshold routing | Retrieval + Diagnosis |
| JtD-4 | Document Legibility Assessment | Document set arrives | Determine whether submitted plans are actionable by a reviewer | Diagnosis + Decision-making |
| JtD-5 | Project Type Classification | Drawings and description available | Assign the correct project type, overriding self-report if drawings conflict | Synthesis + Decision-making |
| JtD-6 | Rule Set Application and Conflict Resolution | Triage begins | Apply all active, in-scope rule sets; resolve conflicts by precedence | Synthesis + Execution |
| JtD-7 | Triage Category Assignment | Rule sets evaluated | Assign ROUTINE, DEFICIENT, or COMPLEX_SENIOR with supporting rationale | Decision-making |
| JtD-8 | Reviewer Assignment | Triage category set | Match application to eligible, available, jurisdiction-licensed reviewer | Execution + Exception-handling |
| JtD-9 | Deficiency Documentation | DEFICIENT or RETURNED_INCOMPLETE path | Produce a complete, code-cited, actionable deficiency list | Documentation + Synthesis |

---

## Section 3 — Micro-Task Inventory

### Workstream A: Intake Review

| Task ID | Task Name | Cognitive Zone | Cognitive Load | Input Structure | Decision Determinism | Risk / Compliance |
|---------|-----------|---------------|---------------|----------------|---------------------|------------------|
| A-01 | Virus scan and file integrity check | Action | Low | High (binary pass/fail) | High (deterministic) | High (security boundary) |
| A-02 | Duplicate application_id detection | Retrieval | Low | High (UUID lookup) | High (deterministic) | Medium (data integrity) |
| A-03 | GIS parcel address resolution | Retrieval | Low | Medium (address string parsing) | High (deterministic API) | High (jurisdiction validity) |
| A-04 | Parcel encumbrance and history lookup | Retrieval + Diagnosis | High | Low (unstructured legacy records) | Medium (pattern recognition) | High (enforcement history) |
| A-05 | Legacy Billing valuation retrieval | Retrieval | Medium | Medium (batch export, may be stale) | Medium (near-threshold staleness) | High (routing threshold) |
| A-06 | Valuation cross-check against self-report | Diagnosis | High | Low (requires judgment on data currency) | Low (discretionary acceptance) | High (triage category gating) |
| A-07 | Required document checklist verification | Retrieval + Decision | Medium | Medium (per project_type configurable list) | High (checklist-driven) | Medium (completeness gate) |
| A-08 | Document legibility assessment | Diagnosis | High | Low (human visual judgment) | Low (no rule for "sufficiently legible") | Medium (downstream analysis quality) |
| A-09 | Attachment content type validation | Action | Low | High (MIME type, file structure) | High (deterministic) | Low (integrity check) |
| A-10 | submitted_at timestamp integrity | Action | Low | High (system-set field) | High (deterministic, immutable) | High (audit trail) |
| A-11 | Intake decision: proceed or return | Decision | High | Medium (aggregates A-01–A-10) | Low (judgment on totality) | High (legal kickback record) |

### Workstream B: Triage

| Task ID | Task Name | Cognitive Zone | Cognitive Load | Input Structure | Decision Determinism | Risk / Compliance |
|---------|-----------|---------------|---------------|----------------|---------------------|------------------|
| B-01 | Project type classification from drawings | Diagnosis + Decision | High | Low (visual/spatial interpretation) | Low (drawings can contradict form) | High (determines triage path) |
| B-02 | Square footage calculation / verification | Retrieval + Diagnosis | Medium | Medium (plan dimensions, math) | Medium (measurement ambiguity) | High (COMPLEX_SQFT_THRESHOLD gate) |
| B-03 | Structural modification identification | Diagnosis | High | Low (requires reading structural drawings) | Low (judgment from plans) | High (life safety) |
| B-04 | Valuation threshold check | Decision | Medium | Medium (see A-05/A-06 staleness risk) | Medium (degraded by batch lag) | High (ROUTINE vs. COMPLEX routing) |
| B-05 | Active rule set selection | Retrieval | Low | High (active=true, date range query) | High (deterministic query) | High (compliance validity) |
| B-06 | IBC rule application | Action | Medium | High (structured rule definitions) | High (rule-driven) | High (code compliance) |
| B-07 | LOCAL rule application | Action + Synthesis | Medium | Medium (may include amendments, variances) | Medium (local amendments vary) | High (LOCAL takes precedence) |
| B-08 | LOCAL/STATE/IBC conflict identification | Diagnosis | High | Low (cross-referencing three rule bodies) | Low (conflict recognition is contextual) | High (legal compliance) |
| B-09 | Conflict resolution by precedence | Decision + Synthesis | High | Low (precedence rule known; application is not) | Medium (rule exists; edge cases remain) | High (legal consequence of wrong resolution) |
| B-10 | Code conflict resolution logging | Documentation | Low | High (structured log entry) | High (deterministic once resolved) | High (audit requirement) |
| B-11 | Variance / special exception detection | Diagnosis | High | Low (requires domain knowledge of exceptions) | Low (case-specific judgment) | High (COMPLEX_SENIOR trigger) |
| B-12 | Historic district / overlay zone check | Retrieval | Medium | Medium (GIS overlay query) | High (if data available) | High (COMPLEX_SENIOR trigger) |
| B-13 | Prior enforcement check (stop-work orders) | Retrieval + Diagnosis | High | Low (unstructured enforcement records) | Medium (presence is deterministic; relevance is not) | High (COMPLEX_SENIOR trigger) |
| B-14 | Agent confidence scoring | Decision | High | Medium (model output) | Low (statistical; threshold = 0.80) | High (NEEDS_HUMAN_REVIEW gate) |
| B-15 | TRIAGE_CATEGORY assignment | Decision | High | Medium (aggregates B-01–B-14) | Medium (rules exist; edge cases are frequent) | High (routes all subsequent work) |
| B-16 | Deficiency list authorship | Documentation + Synthesis | High | Low (requires legal prose with code citations) | Low (expert authorship) | High (legal accountability, kickback record) |
| B-17 | Reviewer eligibility matching | Retrieval + Decision | Medium | High (role, workload, jurisdiction query) | High (rule-driven matching) | High (assignment validity) |
| B-18 | Workload-cap exception handling | Exception-handling | Medium | High (current_workload vs. max_workload) | High (deterministic; escalate to SUPERVISOR) | Medium (SLA risk) |
| B-19 | Supervisor escalation notification | Action | Low | High (structured alert) | High (deterministic trigger) | High (audit and oversight) |

---

## Section 4 — Cognitive Breakpoints

### Control Plane Map

```
SUBMITTED
    │
    ▼ [System] ──── Assigns application_id, sets submitted_at, queues for intake
    │
    ▼ [System → Agent] ────────────────────────── BP-1: INTAKE HANDOFF
    │
INTAKE_REVIEW
    │  [Agent] ── A-01 Virus scan
    │  [Agent] ── A-02 Duplicate detection
    │  [Agent] ── A-03 GIS parcel resolution
    │  [Agent] ── A-05 Legacy Billing retrieval     ◄── RETRIEVAL COMPLEXITY (batch lag)
    │  [Agent] ── A-07 Required doc checklist
    │  [Agent] ── A-09 Attachment type validation
    │  [Agent] ── A-10 Timestamp integrity
    │
    │  [Agent → Human] ──────────────────────────── BP-2: LEGIBILITY / STALENESS JUDGMENT
    │  (H1: blurry plan) ── A-08 Doc legibility
    │  (H2: batch lag)   ── A-06 Valuation cross-check
    │
    ├──[incomplete]──▶ RETURNED_INCOMPLETE
    │                  [Human] assigns reviewer_id ─ BP-3: KICKBACK REQUIRES NAMED HUMAN
    │
    ▼ [Agent] ── Proceeds to triage
    │
TRIAGE_PENDING
    │  [Agent] ── B-05 Rule set selection
    │  [Agent] ── B-06 IBC application
    │  [Agent] ── B-07 LOCAL application
    │  [Agent] ── B-12 Historic/overlay check
    │
    │  [Agent → Human] ──────────────────────────── BP-4: SYNTHESIS BREAKPOINT
    │  (H4: code conflict)   ── B-08 / B-09 Conflict resolution
    │  (H5: project reclassification) ── B-01 / B-03
    │  (H3: enforcement history) ── B-13
    │
    │  [Agent] ── B-14 Confidence scoring
    │
    │  [Statistical floor] ─────────────────────── BP-5: CONFIDENCE THRESHOLD (0.80)
    │  Confidence < 0.80 → NEEDS_HUMAN_REVIEW → SUPERVISOR alert
    │
    ▼ [Agent assigns TRIAGE_CATEGORY]
    │
    │  [Agent → Human] ──────────────────────────── BP-6: TRIAGE CATEGORY GATE
    │  ROUTINE        → Agent: RECOMMEND_APPROVAL  → PERMIT_TECHNICIAN / PLANS_EXAMINER
    │  DEFICIENT      → Agent: RECOMMEND_KICKBACK  → PLANS_EXAMINER + deficiency list (H6)
    │  COMPLEX_SENIOR → Agent: RECOMMEND_ESCALATION → SENIOR_EXAMINER + SUPERVISOR alert
    │
UNDER_REVIEW
    │
    │  [Human ONLY] ─────────────────────────────── BP-7: FINAL DECISION
    │  reviewer_decision set exclusively by authenticated human reviewer
    │  agent_recommendation is advisory; reviewer_decision is legal record
    │
    ├──▶ APPROVED | REJECTED | RETURNED_TO_APPLICANT | ESCALATED
```

### Breakpoint Summary Table

| BP ID | Breakpoint | From | To | Trigger | Archetype |
|-------|-----------|------|-----|---------|-----------|
| BP-1 | Intake handoff | System | Agent | Application reaches INTAKE_REVIEW | Agent-led + Human Oversight |
| BP-2 | Legibility / staleness judgment | Agent | Human | Blurry document OR near-threshold stale valuation | Human-led + Agent Support |
| BP-3 | Kickback requires named human | Agent | Human | RETURNED_INCOMPLETE path requires reviewer_id | Human Only (legal record) |
| BP-4 | Synthesis breakpoint | Agent | Human | Code conflict, project reclassification, enforcement history | Human-led + Agent Support |
| BP-5 | Confidence threshold floor | Agent | Human | agent confidence score < 0.80 | Agent-led + Human Oversight |
| BP-6 | Triage category gate | Agent | Human | TRIAGE_CATEGORY assigned; reviewer matched by role/workload | Agent-led + Human Oversight |
| BP-7 | Final decision | Human | — | reviewer_decision is exclusively a human legal act | Human Only |

### TRIAGE_CATEGORY — Delegation Archetype Assignment

| Category | Volume | Agent Role | Human Role | Archetype |
|----------|--------|-----------|-----------|-----------|
| ROUTINE (~65%) | ~3,770/yr | RECOMMEND_APPROVAL with structured checklist | Verify and countersign | Agent-led + Human Oversight |
| DEFICIENT (~25%) | ~1,450/yr | RECOMMEND_KICKBACK with itemized code-cited deficiency list | Review list, confirm, release | Agent-led + Human Oversight |
| COMPLEX_SENIOR (~10%) | ~580/yr | RECOMMEND_ESCALATION with full reasoning and risk flags | Full independent analysis; agent output is reference only | Human-led + Agent Support |
| NEEDS_HUMAN_REVIEW (exception) | Variable | Halt; flag; alert SUPERVISOR | Take full control; no agent output persisted | Human Only |

### Legacy Billing System — Retrieval Complexity Note

The Legacy Billing System exports valuation data via nightly batch file. This creates a structural retrieval breakpoint (BP-2) that is **invisible in the documented SOP** but materially affects decision quality:

- Applications submitted between midnight and the next batch export carry **unvalidated self-reported valuations**.
- Applications with valuation in the range **$130,000–$170,000** (±$20K of the $150,000 ROUTINE threshold) are at risk of misclassification if the batch data has not yet been ingested.
- The agent must treat near-threshold valuations with stale data as **Medium Decision Determinism**, not High.
- Mitigation: flag any valuation within ±15% of `ROUTINE_VALUATION_THRESHOLD` for human confirmation before triage category assignment is persisted.
- This is an example of ATX principle: **determinism is a property of the data pipeline, not just the decision rule**.

---

## Summary

| Workstream | Total Tasks | High Cognitive Load | Low Decision Determinism | High Risk/Compliance |
|-----------|-------------|--------------------|--------------------------|--------------------|
| Intake Review | 11 | 4 (A-04, A-06, A-08, A-11) | 3 (A-06, A-08, A-11) | 8 |
| Triage | 19 | 10 (B-01, B-03, B-08, B-09, B-11, B-13, B-14, B-15, B-16, B-18) | 8 (B-01, B-03, B-08, B-09, B-11, B-14, B-15, B-16) | 16 |

**Key finding:** The highest-value agentic targets are the High-volume, Low-determinism tasks in Triage (B-01 through B-16) — exactly the ATX "top-right quadrant" (high volume, high non-determinism). These tasks currently consume the most skilled human time and are the primary candidates for Agent-led + Human Oversight delegation.

**Irreducible human tasks:** BP-3, BP-7 — legal record-keeping and final permit decisions — are Human Only by system design and regulatory requirement, not by technical limitation.
