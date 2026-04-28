# Permit Pre-Screening System — CLAUDE.md

## Project Overview

This project is an **agentic pre-screening system** for a city building department. It automates the triage of approximately **5,800 residential building permit applications per year** against IBC (International Building Code) and applicable local/state codes.

The agent assists human reviewers — it never replaces them. Every decision that leaves the system must have a **named human reviewer** attached.

---

## Core Entities

### 1. `permit_application`

Represents a single residential permit submission from intake through final disposition.

**Attributes:**

| Field | Type | Notes |
|---|---|---|
| `application_id` | `uuid` | Primary key |
| `submitted_at` | `timestamp` | UTC, immutable after creation |
| `applicant_name` | `string` | |
| `site_address` | `string` | |
| `project_type` | `string` | e.g., `new_construction`, `addition`, `remodel` |
| `square_footage` | `integer` | |
| `valuation_usd` | `decimal` | |
| `triage_category` | `enum TRIAGE_CATEGORY` | Set by agent; see Triage Logic |
| `status` | `enum APPLICATION_STATUS` | Current lifecycle state |
| `assigned_reviewer_id` | `uuid` | FK → `reviewer.reviewer_id`; **required before any decision is recorded** |
| `rule_set_ids` | `uuid[]` | FK → `rule_set`; all rule sets evaluated |
| `agent_recommendation` | `enum AGENT_RECOMMENDATION` | Agent output; not a final decision |
| `agent_reasoning` | `text` | Structured rationale from agent |
| `deficiencies` | `jsonb` | List of identified deficiencies with code citations |
| `reviewer_decision` | `enum REVIEWER_DECISION` | Set only by human reviewer |
| `reviewer_notes` | `text` | |
| `decided_at` | `timestamp` | UTC; set when reviewer_decision is recorded |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

**State Machine — `APPLICATION_STATUS`:**

```
SUBMITTED
    │
    ▼
INTAKE_REVIEW          ← agent performs completeness check
    │
    ├──[incomplete]──▶ RETURNED_INCOMPLETE   (kickback; reviewer named)
    │
    ▼
TRIAGE_PENDING         ← agent assigns TRIAGE_CATEGORY
    │
    ▼
UNDER_REVIEW           ← assigned reviewer examines application
    │
    ├──[approved]────▶ APPROVED              (reviewer decision; reviewer named)
    ├──[rejected]────▶ REJECTED              (reviewer decision; reviewer named)
    ├──[needs info]──▶ PENDING_APPLICANT_INFO
    │                       │
    │                       └──[info received]──▶ UNDER_REVIEW
    └──[escalate]────▶ ESCALATED_TO_SENIOR   (auto for COMPLEX category)
                            │
                            └──[decided]────▶ APPROVED | REJECTED
```

**Enum: `TRIAGE_CATEGORY`**
```
ROUTINE          -- ~65% of volume; standard residential, low complexity
DEFICIENT        -- ~25% of volume; missing docs, code conflicts, minor errors
COMPLEX_SENIOR   -- ~10% of volume; non-standard, high valuation, variances needed
```

**Enum: `APPLICATION_STATUS`**
```
SUBMITTED
INTAKE_REVIEW
RETURNED_INCOMPLETE
TRIAGE_PENDING
UNDER_REVIEW
PENDING_APPLICANT_INFO
ESCALATED_TO_SENIOR
APPROVED
REJECTED
WITHDRAWN
```

**Enum: `AGENT_RECOMMENDATION`**
```
RECOMMEND_APPROVAL
RECOMMEND_REJECTION
RECOMMEND_KICKBACK
RECOMMEND_ESCALATION
NEEDS_HUMAN_REVIEW      -- agent uncertainty; always routes to human
```

**Enum: `REVIEWER_DECISION`**
```
APPROVED
REJECTED
RETURNED_TO_APPLICANT
ESCALATED
```

---

### 2. `reviewer`

Represents a human building department staff member who is legally accountable for permit decisions.

**Attributes:**

| Field | Type | Notes |
|---|---|---|
| `reviewer_id` | `uuid` | Primary key |
| `employee_id` | `string` | HR system identifier |
| `full_name` | `string` | Used in all decision records for legal traceability |
| `role` | `enum REVIEWER_ROLE` | Determines which triage categories they may decide |
| `licensed_jurisdictions` | `string[]` | ISO 3166-2 subdivision codes |
| `active` | `boolean` | Inactive reviewers may not be assigned new cases |
| `current_workload` | `integer` | Count of open `UNDER_REVIEW` assignments |
| `max_workload` | `integer` | Cap enforced during assignment; default 40 |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

**Enum: `REVIEWER_ROLE`**
```
PERMIT_TECHNICIAN    -- handles ROUTINE only
PLANS_EXAMINER       -- handles ROUTINE and DEFICIENT
SENIOR_EXAMINER      -- handles all categories including COMPLEX_SENIOR
SUPERVISOR           -- override authority; not assigned regular workload
```

**Assignment Rules:**
- `ROUTINE` → assign to any `PERMIT_TECHNICIAN` or `PLANS_EXAMINER` under workload cap
- `DEFICIENT` → assign to `PLANS_EXAMINER` or higher
- `COMPLEX_SENIOR` → assign to `SENIOR_EXAMINER` only
- If no eligible reviewer is under cap, escalate to `SUPERVISOR` with a flag

---

### 3. `rule_set`

Represents a versioned body of code or regulation that governs permit evaluation.

**Attributes:**

| Field | Type | Notes |
|---|---|---|
| `rule_set_id` | `uuid` | Primary key |
| `jurisdiction` | `string` | ISO 3166-2 or local jurisdiction code |
| `rule_set_type` | `enum RULE_SET_TYPE` | |
| `title` | `string` | e.g., "2021 IBC", "City of Springfield Local Amendments" |
| `version` | `string` | Semantic or edition string, e.g., `"2021"`, `"2024-rev2"` |
| `effective_date` | `date` | |
| `sunset_date` | `date \| null` | Null if still in force |
| `rules` | `jsonb` | Structured rule definitions with section references |
| `active` | `boolean` | Inactive rule sets not applied to new submissions |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

**Enum: `RULE_SET_TYPE`**
```
IBC              -- International Building Code
STATE            -- State-level amendments and statutes
LOCAL            -- Municipal ordinances and local amendments
FIRE             -- Fire code (IFC or local equivalent)
ENERGY           -- Energy code (IECC or local equivalent)
ACCESSIBILITY    -- ADA / local accessibility requirements
```

**Rule Set Precedence (highest to lowest for conflict resolution):**
1. `LOCAL`
2. `STATE`
3. `IBC` / other model codes

---

## Automation Triage Logic

The agent evaluates each `permit_application` against active `rule_set` records and assigns a `TRIAGE_CATEGORY`. The agent may only *recommend* — a human reviewer owns every final disposition.

### ROUTINE (~65%)
**Criteria (all must be true):**
- All required documents present and legible
- Project type is in the pre-approved routine list (e.g., standard single-family addition ≤ 500 sq ft, interior remodel with no structural change)
- No identified code conflicts across all active rule sets
- Valuation ≤ configurable threshold (default: $150,000)
- No active variance, appeal, or prior violation on the parcel

**Agent Action:** `RECOMMEND_APPROVAL` with structured checklist. Route to `PERMIT_TECHNICIAN` or `PLANS_EXAMINER`.

### DEFICIENT (~25%)
**Criteria (any triggers DEFICIENT):**
- Missing or illegible required documents
- Minor code conflict that is correctable (e.g., missing setback dimension, incomplete site plan)
- Inconsistency between submitted drawings and project description
- Prior kickback on same application

**Agent Action:** `RECOMMEND_KICKBACK` with itemized deficiency list citing specific code sections. Route to `PLANS_EXAMINER`. Agent must list every deficiency found — partial deficiency lists are not permitted.

### COMPLEX / SENIOR (~10%)
**Criteria (any triggers COMPLEX_SENIOR):**
- Structural modifications or additions > 500 sq ft
- Valuation > configurable threshold (default: $150,000)
- Non-standard construction methods or materials
- Variance or special exception required
- Historic district or environmental overlay zone
- Prior enforcement action or stop-work order on parcel
- Agent confidence score below threshold (default: 0.80)

**Agent Action:** `RECOMMEND_ESCALATION`. Route to `SENIOR_EXAMINER`. Include full reasoning and flagged risk factors.

---

## Validation Rules

These rules are enforced before the agent produces any recommendation. Violations must surface as actionable errors, not silent failures.

### Application Intake
- `application_id` must be unique; reject duplicates at ingestion
- `submitted_at` is system-set; never accept a client-supplied timestamp
- `site_address` must resolve to a valid parcel in the jurisdictional GIS/parcel database
- All file attachments must pass virus scan before processing
- Minimum required documents must be present before triage begins (configurable per `project_type`)

### Reviewer Assignment
- **A reviewer must be assigned before any `agent_recommendation` is persisted to the outbound record.** The agent may complete internal analysis without an assignment, but no decision-bearing output leaves the system without `assigned_reviewer_id` populated.
- Reviewer must be `active = true`
- Reviewer `role` must be eligible for the application's `triage_category`
- Reviewer `current_workload` must be < `max_workload`
- Reviewer must hold a license/certification valid for the application's jurisdiction

### Rule Set Application
- Only `rule_set` records where `active = true` and `effective_date <= submitted_at` and (`sunset_date IS NULL` OR `sunset_date > submitted_at`) may be applied
- At minimum one `IBC` rule set and one `LOCAL` rule set must be evaluated per application
- Conflicts between rule sets must be resolved using the defined precedence order (LOCAL > STATE > IBC); the resolution must be logged

### Decision Recording
- `reviewer_decision` may only be set by an authenticated human reviewer (not the agent)
- `decided_at` is system-set at the moment `reviewer_decision` is persisted; it is not editable
- Every `APPROVED` or `REJECTED` decision must include non-empty `reviewer_notes`
- A `REJECTED` decision must cite at least one specific code section from an applied `rule_set`

### Audit & Traceability
- Every state transition of `APPLICATION_STATUS` must produce an immutable audit log entry containing: `application_id`, `old_status`, `new_status`, `actor` (agent or `reviewer_id`), `timestamp`, `reason`
- Agent reasoning (`agent_reasoning`, `deficiencies`) is write-once; it may not be modified after the recommendation is produced
- No PII fields (applicant name, address) may appear in log aggregation or monitoring dashboards

---

## What the Agent Should NOT Do

These are absolute constraints. Violating any of them is a system failure, not a configuration issue.

1. **Never make a final permit decision.** The agent produces recommendations only (`agent_recommendation`). Setting `reviewer_decision` is exclusively a human action.

2. **Never assign a reviewer to itself or any synthetic identity.** `assigned_reviewer_id` must reference a real, active `reviewer` record with a human `employee_id`.

3. **Never approve, reject, or return an application without a named human reviewer attached.** If no eligible reviewer is available, the agent must halt, flag the application as `NEEDS_HUMAN_REVIEW`, and alert the supervisor — it must not substitute a default or placeholder reviewer.

4. **Never suppress a deficiency to influence a triage outcome.** If a deficiency is detected, it must appear in `deficiencies` regardless of how many other issues exist or how it affects routing.

5. **Never apply a rule set outside its effective date range or jurisdiction.** Applying an expired or inapplicable rule set is a compliance failure.

6. **Never modify agent-produced reasoning after the fact.** `agent_reasoning` and `deficiencies` are write-once fields. If re-evaluation is needed, a new recommendation record must be created.

7. **Never expose PII in logs, traces, monitoring outputs, or error messages.** Use `application_id` and `reviewer_id` as identifiers in all system outputs.

8. **Never escalate silently.** Any escalation to `COMPLEX_SENIOR` or workload-cap exception must generate an explicit, addressable notification to the `SUPERVISOR` role.

9. **Never act on unverified input.** All attachments must pass virus/integrity checks; all addresses must resolve to valid parcels; all rule set references must be active — before the agent begins analysis.

10. **Never bypass the audit log.** Every state transition must be logged. Circumventing the audit trail for performance or simplicity reasons is not acceptable.

---

## Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Database tables and columns | `snake_case` | `permit_application`, `assigned_reviewer_id` |
| Enum values | `SCREAMING_SNAKE_CASE` | `COMPLEX_SENIOR`, `RECOMMEND_KICKBACK` |
| Python variables and functions | `snake_case` | `get_active_rule_sets()` |
| Python classes | `PascalCase` | `PermitApplication`, `ReviewerAssigner` |
| API endpoints | `kebab-case` | `/permit-applications/{id}/triage` |
| Environment variables | `SCREAMING_SNAKE_CASE` | `MAX_REVIEWER_WORKLOAD`, `ROUTINE_VALUATION_THRESHOLD` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_CONFIDENCE_THRESHOLD = 0.80` |

---

## Key Configurable Thresholds

These values must be environment-variable-driven, not hardcoded.

| Variable | Default | Description |
|---|---|---|
| `ROUTINE_VALUATION_THRESHOLD` | `150000` | USD; applications above this floor to COMPLEX_SENIOR |
| `COMPLEX_SQFT_THRESHOLD` | `500` | sq ft addition threshold for COMPLEX_SENIOR |
| `AGENT_CONFIDENCE_THRESHOLD` | `0.80` | Below this, agent always recommends NEEDS_HUMAN_REVIEW |
| `MAX_REVIEWER_WORKLOAD` | `40` | Default per-reviewer open case cap |
| `ROUTINE_PROJECT_TYPES` | _(list)_ | Allowlist of project types eligible for ROUTINE triage |

---

## Out of Scope

- Commercial permits (separate system)
- Permit fee calculation (finance system integration only)
- Inspection scheduling (downstream workflow, not part of this agent)
- Final certificate of occupancy issuance