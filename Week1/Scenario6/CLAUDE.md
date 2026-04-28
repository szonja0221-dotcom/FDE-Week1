# Desk-Review Triage Agent — CLAUDE.md

## Project Overview

This project is an **agentic desk-review triage system** for an academic journal. It automates the initial screening of incoming manuscript submissions — checking scope fit, methodology adequacy, novelty, and integrity — before any editorial decision is made.

The agent assists human editors — it never replaces them. Every rejection or acceptance recommendation that leaves the system must carry a **named editor's sign-off**. The agent's role is to compress review time, surface risk factors, and ensure no submission is silently dropped.

---

## Core Entities

### 1. `manuscript`

Represents a single manuscript submission from intake through final editorial disposition.

**Attributes:**

| Field | Type | Notes |
|---|---|---|
| `manuscript_id` | `uuid` | Primary key |
| `submitted_at` | `timestamp` | UTC, system-set; immutable after creation |
| `corresponding_author` | `string` | Name only; email stored separately, never in logs |
| `title` | `string` | |
| `abstract` | `text` | |
| `word_count` | `integer` | |
| `subject_area` | `string[]` | Mapped to journal scope taxonomy |
| `declared_methodology` | `string` | Self-reported by author; validated against `methodology_flags` |
| `sample_size` | `integer \| null` | Required for empirical studies; null for theoretical work |
| `novelty_score` | `decimal(3,1)` | Agent-assigned 1.0–10.0; see Scoring Rubric |
| `methodology_flags` | `jsonb` | Structured list of detected methodology concerns with section refs |
| `scope_fit_result` | `enum SCOPE_FIT_RESULT` | Agent output |
| `triage_category` | `enum TRIAGE_CATEGORY` | Set by agent; see Triage Logic |
| `status` | `enum MANUSCRIPT_STATUS` | Current lifecycle state |
| `assigned_editor_id` | `uuid` | FK → `editor.editor_id`; **required before any recommendation is persisted** |
| `agent_recommendation` | `enum AGENT_RECOMMENDATION` | Agent output; not a final decision |
| `agent_reasoning` | `text` | Structured rationale; write-once |
| `integrity_check_passed` | `boolean` | Plagiarism + self-plagiarism; must be true before triage proceeds |
| `citation_issues` | `jsonb` | Formatting errors found; auto-correctable items flagged separately |
| `editor_decision` | `enum EDITOR_DECISION` | Set only by authenticated human editor |
| `editor_notes` | `text` | Required for all DESK_REJECT decisions |
| `decided_at` | `timestamp` | UTC; system-set when `editor_decision` is recorded |
| `triage_report_id` | `uuid` | FK → `triage_report` |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

**State Machine — `MANUSCRIPT_STATUS`:**

```
SUBMITTED
    │
    ▼
INTAKE_CHECK           ← agent runs integrity, format, and completeness checks
    │
    ├──[integrity fail]──▶ RETURNED_INTEGRITY     (auto; editor notified)
    ├──[incomplete]──────▶ RETURNED_INCOMPLETE    (auto; editor notified)
    │
    ▼
AGENT_REVIEWING        ← agent evaluates scope, methodology, novelty
    │
    ▼
PENDING_EDITOR_SIGN_OFF  ← agent has produced a recommendation; editor must act
    │
    ├──[editor rejects]────▶ DESK_REJECTED        (editor decision; editor named)
    ├──[editor approves]───▶ SENT_TO_PEER_REVIEW  (editor decision; editor named)
    ├──[needs clarification]▶ PENDING_AUTHOR_RESPONSE
    │                             │
    │                             └──[response received]──▶ AGENT_REVIEWING
    └──[breakthrough flag]──▶ ESCALATED_TO_EIC    (auto for POTENTIAL_BREAKTHROUGH)
                                  │
                                  └──[decided]──▶ DESK_REJECTED | SENT_TO_PEER_REVIEW
```

**Enum: `TRIAGE_CATEGORY`**
```
STANDARD_ACCEPT_TRACK    -- scope fit, sound methodology, novelty ≥ 5.0; route to peer review
STANDARD_REJECT_TRACK    -- out of scope or below methodology bar; recommend desk rejection
REVISE_BEFORE_TRIAGE     -- correctable issues (incomplete data, citation errors); return to author
POTENTIAL_BREAKTHROUGH   -- novelty ≥ 8.5 AND at least one methodology flag; escalate to EIC
NEEDS_HUMAN_TRIAGE       -- agent confidence below threshold; route directly to senior editor
```

**Enum: `MANUSCRIPT_STATUS`**
```
SUBMITTED
INTAKE_CHECK
RETURNED_INTEGRITY
RETURNED_INCOMPLETE
AGENT_REVIEWING
PENDING_EDITOR_SIGN_OFF
PENDING_AUTHOR_RESPONSE
ESCALATED_TO_EIC
SENT_TO_PEER_REVIEW
DESK_REJECTED
WITHDRAWN
```

**Enum: `AGENT_RECOMMENDATION`**
```
RECOMMEND_PEER_REVIEW
RECOMMEND_DESK_REJECTION
RECOMMEND_RETURN_TO_AUTHOR
RECOMMEND_ESCALATION_TO_EIC
NEEDS_HUMAN_TRIAGE           -- agent uncertainty; always routes to a human
```

**Enum: `EDITOR_DECISION`**
```
SENT_TO_PEER_REVIEW
DESK_REJECTED
RETURNED_TO_AUTHOR
ESCALATED_TO_EIC
```

**Enum: `SCOPE_FIT_RESULT`**
```
IN_SCOPE
BORDERLINE_SCOPE       -- requires editor judgment
OUT_OF_SCOPE
```

---

### 2. `triage_report`

Immutable artifact produced by the agent for each review cycle. If re-evaluation is triggered, a new `triage_report` is created — existing reports are never modified.

**Attributes:**

| Field | Type | Notes |
|---|---|---|
| `triage_report_id` | `uuid` | Primary key |
| `manuscript_id` | `uuid` | FK → `manuscript` |
| `generated_at` | `timestamp` | UTC; system-set |
| `agent_version` | `string` | Semantic version of the agent that produced this report |
| `scope_fit_result` | `enum SCOPE_FIT_RESULT` | |
| `scope_reasoning` | `text` | Structured explanation citing journal scope criteria |
| `novelty_score` | `decimal(3,1)` | 1.0–10.0; see Scoring Rubric |
| `novelty_reasoning` | `text` | Evidence for score; must cite specific manuscript passages |
| `methodology_flags` | `jsonb` | Each flag: `{section, flag_type, severity, code_ref, correctable}` |
| `methodology_verdict` | `enum METHODOLOGY_VERDICT` | |
| `integrity_check_result` | `jsonb` | `{plagiarism_score, self_plagiarism_score, tool_used, passed}` |
| `citation_issues` | `jsonb` | `{count, auto_correctable_count, issues[]}` |
| `triage_category` | `enum TRIAGE_CATEGORY` | |
| `recommendation` | `enum AGENT_RECOMMENDATION` | |
| `confidence_score` | `decimal(3,2)` | 0.00–1.00; below threshold triggers NEEDS_HUMAN_TRIAGE |
| `risk_factors` | `text[]` | Enumerated factors driving any escalation or flag |

**Enum: `METHODOLOGY_VERDICT`**
```
ADEQUATE          -- meets minimum bar for the declared methodology type
CORRECTABLE       -- issues present but addressable without full re-study
INADEQUATE        -- fundamental flaws; recommend desk rejection
UNVERIFIABLE      -- agent cannot assess; escalate
```

---

## Validation Rules

These rules are enforced before the agent produces any recommendation. Violations must surface as actionable errors with specific field references — not silent failures.

### Intake Checks (must pass before `AGENT_REVIEWING` begins)

- `manuscript_id` must be unique; reject duplicate submissions at ingestion
- `submitted_at` is system-set; never accept a client-supplied timestamp
- Word count must fall within journal-configured bounds (`MIN_WORD_COUNT` – `MAX_WORD_COUNT`)
- All file attachments must pass virus scan before processing
- Integrity check (plagiarism + self-plagiarism) must complete with `passed = true` before triage proceeds; a score above `PLAGIARISM_THRESHOLD` (default: 0.20) halts the pipeline
- Minimum required sections must be present and non-empty before triage begins (configurable per submission type: empirical, review, theoretical, case study)

### Scope Fit Criteria

The agent evaluates scope fit against the journal's declared scope taxonomy. The following rules are absolute:

- **IN_SCOPE** requires the manuscript's primary subject area to match at least one entry in `JOURNAL_SCOPE_TAXONOMY` at depth ≥ 2 (not just top-level domain)
- **BORDERLINE_SCOPE** is assigned when the primary subject area is a first-level match only, or when ≥ 2 subject areas are listed and only one matches — this category always routes to human judgment; the agent may not resolve it alone
- **OUT_OF_SCOPE** is assigned when no declared subject area matches any entry in `JOURNAL_SCOPE_TAXONOMY`; agent issues `RECOMMEND_DESK_REJECTION` with scope reasoning

### Methodology Adequacy Criteria

The agent checks methodology against the following explicit acceptance thresholds. All conditions within a declared methodology type must be satisfied for a verdict of `ADEQUATE`.

**Frequentist (quantitative empirical):**
- Sample size `n > FREQUENTIST_MIN_SAMPLE_SIZE` (default: 30 for between-subjects; configurable per design type)
- Statistical tests must be appropriate to the data type (categorical → chi-square/Fisher; continuous → t-test/ANOVA/regression; time-series → appropriate temporal models)
- Effect sizes must be reported alongside p-values; p-values alone are insufficient
- Multiple comparisons must be corrected (Bonferroni, FDR, or equivalent) when the number of comparisons ≥ `MULTIPLE_COMPARISON_THRESHOLD` (default: 5)
- Confidence intervals must be reported for all primary outcomes

**Bayesian (quantitative empirical):**
- Prior specification must be documented and justified; uninformative priors must be explicitly declared
- Posterior predictive checks or convergence diagnostics must be reported
- Sample size guidance: minimum effective sample size (ESS) > `BAYESIAN_MIN_ESS` (default: 400 per parameter) for MCMC-based methods
- Bayes factors or credible intervals must be reported for all primary outcomes

**Qualitative:**
- Sampling strategy (purposive, theoretical, snowball) must be declared and justified
- Saturation criteria or sample size rationale must be stated
- Reflexivity statement required
- Minimum of two independent coders for thematic analysis, or equivalent inter-rater reliability measure ≥ `QUALITATIVE_IRR_THRESHOLD` (default: 0.70 Cohen's κ)

**Theoretical / Conceptual (no empirical component):**
- Sample size checks: not applicable; `sample_size` field must be null
- Logical consistency check applied: claims must not contradict established foundational literature without explicit rebuttal
- Scope of contribution must be clearly bounded; overclaims are flagged as `methodology_flags` with `severity: MODERATE`

**Mixed Methods:**
- Both relevant sub-frameworks above apply to their respective components
- Integration rationale must be stated; sequential or concurrent design must be declared

**Unrecognized methodology declaration:** If `declared_methodology` does not map to any supported framework, the agent must set `methodology_verdict = UNVERIFIABLE` and route to `NEEDS_HUMAN_TRIAGE`.

### Novelty Scoring Rubric (1.0 – 10.0)

| Score Range | Interpretation |
|---|---|
| 1.0 – 3.0 | Replication or marginal extension; no new contribution claimed or found |
| 3.1 – 5.0 | Incremental contribution; builds on prior work with modest novelty |
| 5.1 – 7.0 | Meaningful contribution; clear advancement on a known problem |
| 7.1 – 8.4 | Significant contribution; likely of broad interest to the field |
| 8.5 – 10.0 | Potential breakthrough; triggers `POTENTIAL_BREAKTHROUGH` triage category |

Scoring evidence must cite specific manuscript passages (section + paragraph). Scores ≥ 8.5 paired with any `methodology_flags` of `severity: HIGH` trigger mandatory escalation regardless of other criteria.

### Reviewer Assignment

- **An editor must be assigned before any `agent_recommendation` is persisted to the outbound record.** The agent may complete internal analysis, but no recommendation leaves the system without `assigned_editor_id` populated.
- Editor must be `active = true`
- Editor `role` must be eligible for the manuscript's `triage_category` (see Delegation Boundaries)
- Editor `current_workload` must be `< max_workload`
- For `ESCALATED_TO_EIC` cases, assignment must route to the Editor-in-Chief role only

### Decision Recording

- `editor_decision` may only be set by an authenticated human editor
- `decided_at` is system-set at the moment `editor_decision` is persisted; it is not editable
- Every `DESK_REJECTED` decision must include non-empty `editor_notes` citing at least one specific criterion from this specification
- `SENT_TO_PEER_REVIEW` decisions must carry the assigned reviewer pool selection or a delegation flag to the managing editor

---

## Delegation Boundaries

### Production Spec Checklist

The following matrix defines which actions the agent may take autonomously and which require human sign-off before an outcome is persisted to the outbound record.

#### Agent Decides Alone (no human sign-off required)

| Action | Trigger Condition | Output |
|---|---|---|
| Plagiarism / integrity check | All submissions at intake | `integrity_check_result`; halts pipeline on fail |
| Self-plagiarism check | All submissions at intake | Included in `integrity_check_result` |
| Citation format audit | All submissions | `citation_issues` with auto-correctable items flagged |
| Auto-correct citation formatting | Only items flagged `auto_correctable: true` with no ambiguity | Corrected file; correction logged with before/after diff |
| Word count and section completeness check | All submissions at intake | `RETURNED_INCOMPLETE` if fails |
| Subject area taxonomy mapping | All submissions | `scope_fit_result`; `BORDERLINE` always escalates |
| Methodology type detection | All submissions | Used to select the correct adequacy checklist |
| Sample size threshold check | Empirical submissions | `methodology_flags` entry if below threshold |
| Statistical test appropriateness check | Frequentist submissions | `methodology_flags` entry if mismatch detected |
| Novelty scoring | All submissions | `novelty_score` with evidence citations |
| `TRIAGE_CATEGORY` assignment | All submissions | Routes to appropriate editor tier |
| Escalation notification to EIC | `POTENTIAL_BREAKTHROUGH` or workload cap exceeded | Addressable alert; never silent |
| Audit log entry for every state transition | All state changes | Immutable entry; never skipped |

#### Agent + Human Review Required (agent recommends; human must sign off)

| Action | Why Human Required |
|---|---|
| `RECOMMEND_DESK_REJECTION` → `DESK_REJECTED` | Journal reputation; legal exposure; author rights |
| `RECOMMEND_PEER_REVIEW` → `SENT_TO_PEER_REVIEW` | Editorial judgment on fit, reviewer pool, and scope nuance |
| `BORDERLINE_SCOPE` resolution | Agent cannot resolve ambiguous scope without editorial policy context |
| `POTENTIAL_BREAKTHROUGH` routing decision | Non-standard methodology with high novelty requires EIC judgment |
| `NEEDS_HUMAN_TRIAGE` resolution | Agent confidence insufficient; human must own the analysis |
| Any waiver of methodology adequacy thresholds | Policy decision; cannot be automated |
| Returning a manuscript to an author more than once | Pattern may indicate bad-faith submission; editorial oversight required |

---

## What the Agent Should NOT Do

These are absolute constraints. Violating any of them is a system failure, not a configuration issue.

1. **Never make a final editorial decision.** The agent produces recommendations only (`agent_recommendation`). Setting `editor_decision` is exclusively a human action. The agent must not set, infer, or default this field.

2. **Never desk-reject a manuscript without human sign-off.** Issuing a rejection to an author without an authenticated editor's `editor_decision` is prohibited regardless of how clear the grounds appear. This protects both journal reputation and author rights.

3. **Never assign itself or a synthetic identity as the reviewing editor.** `assigned_editor_id` must reference a real, active `editor` record with a verified institutional identity.

4. **Never suppress a methodology flag to improve the triage outcome.** If a methodology concern is detected, it must appear in `methodology_flags` regardless of how many other flags exist or how it affects routing. Partial deficiency lists are a compliance failure.

5. **Never apply scope criteria outside the active `JOURNAL_SCOPE_TAXONOMY` version.** Using a superseded scope definition is a policy violation.

6. **Never modify agent-produced reasoning after the fact.** `agent_reasoning`, `novelty_reasoning`, `scope_reasoning`, and `methodology_flags` in a `triage_report` are write-once. If re-evaluation is needed, a new `triage_report` must be created; the original is preserved.

7. **Never expose author PII in logs, traces, monitoring outputs, or error messages.** Use `manuscript_id` and `editor_id` as identifiers in all system outputs. Author names and email addresses must not appear in any aggregation, dashboard, or alert.

8. **Never escalate silently.** Any `POTENTIAL_BREAKTHROUGH` classification, workload-cap exception, or `NEEDS_HUMAN_TRIAGE` routing must generate an explicit, addressable notification to the appropriate human role. A notification with no named recipient is not acceptable.

9. **Never act on unverified input.** Integrity checks, file format validation, and subject area mapping must complete successfully before analysis begins. Partial results must not proceed through the pipeline.

10. **Never bypass the audit log.** Every `MANUSCRIPT_STATUS` state transition must produce an immutable audit entry containing: `manuscript_id`, `old_status`, `new_status`, `actor` (agent version or `editor_id`), `timestamp`, `reason`. Circumventing the audit trail for performance reasons is not acceptable.

11. **Never auto-correct anything other than unambiguous citation formatting.** The agent must not rewrite abstract text, modify reported statistics, alter author-declared methodology, or change any substantive content — only mechanical citation format errors flagged `auto_correctable: true`.

---

## Escalation Patterns

### Standard Escalation: `COMPLEX_SENIOR` → Senior Editor
Triggered by: `triage_category = NEEDS_HUMAN_TRIAGE` or `BORDERLINE_SCOPE`.
Action: Route to a `SENIOR_EDITOR` with full `triage_report`. No recommendation is surfaced to the author until the senior editor acts.

### Workload Cap Exception
Triggered by: All editors at or above `max_workload`.
Action: Halt assignment, flag the manuscript as `NEEDS_HUMAN_TRIAGE`, and alert the Editor-in-Chief with current workload snapshot. Do not assign a placeholder.

### Potential Breakthrough Protocol
**Trigger:** `novelty_score ≥ 8.5` AND `methodology_flags` contains at least one entry with `severity: HIGH` or `severity: MODERATE`.

This pattern captures the highest-risk editorial scenario: work that may be genuinely important but whose methods cannot be straightforwardly validated by standard criteria.

**Agent Actions (in order):**
1. Set `triage_category = POTENTIAL_BREAKTHROUGH`.
2. Set `agent_recommendation = RECOMMEND_ESCALATION_TO_EIC`.
3. Populate `risk_factors` with an enumerated list: novelty evidence, specific methodology concerns, confidence score, and any prior submission history on this manuscript.
4. Generate a structured `triage_report` with a dedicated `breakthrough_summary` section covering: (a) the specific novelty claim, (b) the methodology concern and why it could not be resolved, (c) recommended specialist reviewer profiles if the EIC elects to send to peer review.
5. Dispatch a named, addressable escalation notification to the Editor-in-Chief role — not a generic queue entry.
6. Set `status = ESCALATED_TO_EIC`.
7. Await EIC decision; no further automated action.

**What the agent must NOT do in this path:**
- Must not recommend desk rejection based on methodology concerns alone when `novelty_score ≥ 8.5`.
- Must not route to a standard `PLANS_EXAMINER`-equivalent editor; EIC escalation is mandatory.
- Must not disclose the `novelty_score` or `breakthrough_summary` to the corresponding author at any point before a human decision is made.

---

## Audit & Traceability

- Every `MANUSCRIPT_STATUS` transition must produce an immutable audit log entry: `manuscript_id`, `old_status`, `new_status`, `actor`, `timestamp`, `reason`.
- `triage_report` records are write-once and retained indefinitely; they may not be deleted even after a final editorial decision.
- All auto-corrections applied by the agent must be logged with a before/after diff and attributed to the agent version that applied them.
- No PII (author name, email, institutional affiliation) may appear in log aggregation, monitoring dashboards, or alert payloads.

---

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Database tables and columns | `snake_case` | `manuscript`, `novelty_score`, `assigned_editor_id` |
| Enum values | `SCREAMING_SNAKE_CASE` | `POTENTIAL_BREAKTHROUGH`, `RECOMMEND_DESK_REJECTION` |
| Python variables and functions | `snake_case` | `evaluate_methodology_adequacy()` |
| Python classes | `PascalCase` | `TriageReport`, `MethodologyEvaluator` |
| API endpoints | `kebab-case` | `/manuscripts/{id}/triage`, `/triage-reports/{id}` |
| Environment variables | `SCREAMING_SNAKE_CASE` | `PLAGIARISM_THRESHOLD`, `BAYESIAN_MIN_ESS` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_CONFIDENCE_THRESHOLD = 0.80` |

---

## Key Configurable Thresholds

All thresholds must be environment-variable-driven, not hardcoded.

| Variable | Default | Description |
|---|---|---|
| `PLAGIARISM_THRESHOLD` | `0.20` | Similarity score above which intake is halted |
| `FREQUENTIST_MIN_SAMPLE_SIZE` | `30` | Minimum n for between-subjects designs |
| `BAYESIAN_MIN_ESS` | `400` | Minimum effective sample size per parameter (MCMC) |
| `QUALITATIVE_IRR_THRESHOLD` | `0.70` | Minimum Cohen's κ for thematic analysis |
| `MULTIPLE_COMPARISON_THRESHOLD` | `5` | Number of comparisons above which correction is required |
| `AGENT_CONFIDENCE_THRESHOLD` | `0.80` | Below this, agent routes to NEEDS_HUMAN_TRIAGE |
| `NOVELTY_BREAKTHROUGH_THRESHOLD` | `8.5` | novelty_score at or above which POTENTIAL_BREAKTHROUGH is triggered |
| `MAX_EDITOR_WORKLOAD` | `40` | Default per-editor open manuscript cap |
| `MIN_WORD_COUNT` | `3000` | Minimum word count for any submission type |
| `MAX_WORD_COUNT` | `12000` | Maximum word count; configurable per submission type |

---

## Out of Scope

- Peer reviewer assignment and management (downstream workflow)
- Reviewer invitation and response tracking
- Final acceptance after peer review
- Production typesetting and DOI assignment
- Fee and article processing charge (APC) calculation
- Author identity verification beyond integrity checks
