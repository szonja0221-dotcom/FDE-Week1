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




# Building Permit AI Triage System — Technical Specification

**Version:** 1.0.0
**Status:** Draft for Review
**Last Updated:** 2026-04-22

---

## Table of Contents

1. [Entity Data Models](#1-entity-data-models)
2. [State Machine & Lifecycle](#2-state-machine--lifecycle)
3. [Delegation Boundaries](#3-delegation-boundaries)
4. [Integration Contracts](#4-integration-contracts)
5. [Validation & Failure Modes](#5-validation--failure-modes)
6. [Non-Repudiation & Governance](#6-non-repudiation--governance)

---

## 1. Entity Data Models

### 1.1 `permit_application`

**Primary Key:** `application_id UUID`

```sql
CREATE TABLE permit_application (
    application_id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    applicant_name          VARCHAR(255)    NOT NULL,
    applicant_email         VARCHAR(255)    NOT NULL CHECK (applicant_email ~* '^[^@]+@[^@]+\.[^@]+$'),
    applicant_phone         VARCHAR(20),
    site_address            VARCHAR(500)    NOT NULL,
    parcel_id               VARCHAR(100)    NOT NULL,          -- FK to GIS parcel registry
    geocode_result          JSONB,                             -- raw geocoder response; see §4.2
    project_type            VARCHAR(100)    NOT NULL,          -- must match ROUTINE_PROJECT_TYPES config
    project_description     TEXT            NOT NULL CHECK (char_length(project_description) >= 50),
    square_footage          INTEGER         NOT NULL CHECK (square_footage > 0),
    valuation_usd           DECIMAL(12, 2)  NOT NULL CHECK (valuation_usd > 0),
    triage_category         VARCHAR(30)     CHECK (triage_category IN (
                                'ROUTINE','DEFICIENT','COMPLEX_SENIOR'
                            )),
    status                  VARCHAR(40)     NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
                                'SUBMITTED','INTAKE_REVIEW','RETURNED_INCOMPLETE',
                                'TRIAGE_PENDING','UNDER_REVIEW','PENDING_APPLICANT_INFO',
                                'ESCALATED_TO_SENIOR','APPROVED','REJECTED','WITHDRAWN'
                            )),
    assigned_reviewer_id    UUID            REFERENCES reviewer(reviewer_id),
    rule_set_ids            UUID[]          NOT NULL DEFAULT '{}',
    agent_recommendation    VARCHAR(40)     CHECK (agent_recommendation IN (
                                'RECOMMEND_APPROVAL','RECOMMEND_REJECTION',
                                'RECOMMEND_KICKBACK','RECOMMEND_ESCALATION','NEEDS_HUMAN_REVIEW'
                            )),
    agent_reasoning         TEXT,                             -- write-once; see §6.3
    agent_confidence_score  DECIMAL(4, 3)   CHECK (agent_confidence_score BETWEEN 0 AND 1),
    deficiencies            JSONB,                            -- write-once; array of DeficiencyRecord
    reviewer_decision       VARCHAR(30)     CHECK (reviewer_decision IN (
                                'APPROVED','REJECTED','RETURNED_TO_APPLICANT','ESCALATED'
                            )),
    reviewer_notes          TEXT,
    decided_at              TIMESTAMPTZ,
    decision_session_id     UUID,                             -- FK to auth_session; set at decision time
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_reviewer_required_for_decision
        CHECK (reviewer_decision IS NULL OR assigned_reviewer_id IS NOT NULL),
    CONSTRAINT chk_notes_required_for_terminal
        CHECK (reviewer_decision NOT IN ('APPROVED','REJECTED') OR (reviewer_notes IS NOT NULL AND char_length(reviewer_notes) > 0)),
    CONSTRAINT chk_decided_at_set_with_decision
        CHECK ((reviewer_decision IS NULL) = (decided_at IS NULL))
);
```

**`deficiencies` JSONB schema (array of `DeficiencyRecord`):**

```json
{
  "deficiency_id": "uuid",
  "code_section": "IBC 2021 §1004.1",
  "rule_set_id": "uuid",
  "description": "Occupant load calculation missing from sheet A-2.",
  "severity": "BLOCKING | WARNING",
  "auto_correctable": false
}
```

---

### 1.2 `reviewer`

**Primary Key:** `reviewer_id UUID`

```sql
CREATE TABLE reviewer (
    reviewer_id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id             VARCHAR(50)     NOT NULL UNIQUE,   -- HR system identifier; never synthetic
    full_name               VARCHAR(255)    NOT NULL,
    role                    VARCHAR(30)     NOT NULL CHECK (role IN (
                                'PERMIT_TECHNICIAN','PLANS_EXAMINER',
                                'SENIOR_EXAMINER','SUPERVISOR'
                            )),
    licensed_jurisdictions  VARCHAR(20)[]   NOT NULL DEFAULT '{}', -- ISO 3166-2 codes
    active                  BOOLEAN         NOT NULL DEFAULT TRUE,
    current_workload        INTEGER         NOT NULL DEFAULT 0 CHECK (current_workload >= 0),
    max_workload            INTEGER         NOT NULL DEFAULT 40 CHECK (max_workload > 0),
    email                   VARCHAR(255)    NOT NULL UNIQUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_workload_within_cap
        CHECK (current_workload <= max_workload)
);
```

**Role → Triage Category Eligibility:**

| `reviewer.role`       | `ROUTINE` | `DEFICIENT` | `COMPLEX_SENIOR` | Override Authority |
|---|:---:|:---:|:---:|:---:|
| `PERMIT_TECHNICIAN`   | Yes | No  | No  | No  |
| `PLANS_EXAMINER`      | Yes | Yes | No  | No  |
| `SENIOR_EXAMINER`     | Yes | Yes | Yes | No  |
| `SUPERVISOR`          | Yes | Yes | Yes | Yes |

---

### 1.3 `rule_set`

**Primary Key:** `rule_set_id UUID`

```sql
CREATE TABLE rule_set (
    rule_set_id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction            VARCHAR(20)     NOT NULL,           -- ISO 3166-2 or local code
    rule_set_type           VARCHAR(20)     NOT NULL CHECK (rule_set_type IN (
                                'IBC','STATE','LOCAL','FIRE','ENERGY','ACCESSIBILITY'
                            )),
    title                   VARCHAR(255)    NOT NULL,
    version                 VARCHAR(50)     NOT NULL,
    effective_date          DATE            NOT NULL,
    sunset_date             DATE,
    active                  BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sunset_after_effective
        CHECK (sunset_date IS NULL OR sunset_date > effective_date),
    CONSTRAINT uq_rule_set_version UNIQUE (jurisdiction, rule_set_type, version)
);
```

**Conflict Precedence (highest wins):** `LOCAL` > `STATE` > `IBC` > `FIRE` > `ENERGY` > `ACCESSIBILITY`

---

### 1.4 `audit_log`

Every state transition, agent action, and human decision produces an immutable audit record.

**Primary Key:** `log_id UUID`

```sql
CREATE TABLE audit_log (
    log_id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id          UUID            NOT NULL REFERENCES permit_application(application_id),
    event_type              VARCHAR(50)     NOT NULL CHECK (event_type IN (
                                'STATUS_TRANSITION','AGENT_RECOMMENDATION','REVIEWER_ASSIGNMENT',
                                'REVIEWER_DECISION','DEFICIENCY_ADDED','RULE_SET_APPLIED',
                                'ESCALATION','KICKBACK','SYSTEM_ERROR'
                            )),
    old_value               TEXT,
    new_value               TEXT,
    actor_type              VARCHAR(10)     NOT NULL CHECK (actor_type IN ('AGENT','HUMAN','SYSTEM')),
    actor_id                VARCHAR(255)    NOT NULL,           -- reviewer_id (UUID) or 'AGENT' or 'SYSTEM'
    session_id              UUID,                               -- NULL only for SYSTEM actor_type
    auth_token_hash         VARCHAR(64),                        -- SHA-256 of bearer token; NULL for SYSTEM
    reason                  TEXT,
    occurred_at             TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    server_sequence         BIGSERIAL       NOT NULL            -- monotonic; gaps indicate tampering
);

-- Audit log is append-only; enforce via row-level security:
-- REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
-- GRANT INSERT, SELECT ON audit_log TO app_role;
```

---

### 1.5 `auth_session`

Links a human decision to a verified authentication context.

```sql
CREATE TABLE auth_session (
    session_id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id             UUID            NOT NULL REFERENCES reviewer(reviewer_id),
    auth_token_hash         VARCHAR(64)     NOT NULL UNIQUE,    -- SHA-256; raw token never stored
    issued_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ     NOT NULL,
    invalidated_at          TIMESTAMPTZ,                        -- set on logout or forced expiry
    ip_address              INET            NOT NULL,
    user_agent              TEXT,

    CONSTRAINT chk_expires_after_issued
        CHECK (expires_at > issued_at)
);
```

---

## 2. State Machine & Lifecycle

### 2.1 Status Diagram

```
SUBMITTED
    │
    └──[Agent: completeness check]──▶ INTAKE_REVIEW
                                            │
                        ┌───────────────────┴────────────────────┐
                        │ [incomplete]                           │ [complete]
                        ▼                                        ▼
              RETURNED_INCOMPLETE                        TRIAGE_PENDING
                   (terminal*)                                   │
                                          [Agent: code eval]────┘
                                                   │
                                          UNDER_REVIEW ◀────────────────────┐
                                                   │                        │
                    ┌──────────────────────────────┼───────────────────┐   │
                    │                              │                   │   │
                    ▼                              ▼                   ▼   │
             APPROVED                        REJECTED        PENDING_APPLICANT_INFO
          (terminal*)                     (terminal*)                  │
                                                                [info received]
                                                                       │
                                                               UNDER_REVIEW ─┘
                    │
                    └──[COMPLEX_SENIOR]──▶ ESCALATED_TO_SENIOR
                                                   │
                                         ┌─────────┴──────────┐
                                         ▼                     ▼
                                     APPROVED              REJECTED
                                  (terminal*)           (terminal*)

  WITHDRAWN  ◀──── [applicant action; any non-terminal status]
```

`*` Terminal statuses may not transition further except to `WITHDRAWN` if the applicant formally retracts.

---

### 2.2 Transition Table

Each row specifies prerequisites (fields that must be non-null/valid) and the actor who triggers the transition.

| # | From | To | Prerequisites | Actor |
|---|---|---|---|---|
| T-01 | `SUBMITTED` | `INTAKE_REVIEW` | `site_address` geocodes to exactly one parcel; all mandatory attachments uploaded; virus scan passed for all files | **Agent Alone** |
| T-02 | `INTAKE_REVIEW` | `RETURNED_INCOMPLETE` | At least one `DeficiencyRecord` with `severity = BLOCKING` in `deficiencies`; `assigned_reviewer_id` NOT NULL | **Agent + Human Review** |
| T-03 | `INTAKE_REVIEW` | `TRIAGE_PENDING` | Zero `BLOCKING` deficiencies; minimum required docs present per `project_type` config | **Agent Alone** |
| T-04 | `TRIAGE_PENDING` | `UNDER_REVIEW` | `triage_category` NOT NULL; `agent_recommendation` NOT NULL; `agent_confidence_score` >= 0.80; `assigned_reviewer_id` NOT NULL; assigned reviewer `active = true` and eligible for `triage_category` and `current_workload < max_workload` | **Agent Alone** (assignment) then **Human** (acknowledgment) |
| T-05 | `UNDER_REVIEW` | `APPROVED` | `reviewer_decision = APPROVED`; `reviewer_notes` NOT NULL; `decision_session_id` references a valid, non-expired `auth_session` for `assigned_reviewer_id`; `decided_at` NOT NULL | **Human Only** |
| T-06 | `UNDER_REVIEW` | `REJECTED` | `reviewer_decision = REJECTED`; `reviewer_notes` NOT NULL; `deficiencies` contains at least one record citing a specific `code_section`; `decision_session_id` valid; `decided_at` NOT NULL | **Human Only** |
| T-07 | `UNDER_REVIEW` | `PENDING_APPLICANT_INFO` | `reviewer_notes` NOT NULL (describes what information is needed); `decision_session_id` valid | **Human Only** |
| T-08 | `PENDING_APPLICANT_INFO` | `UNDER_REVIEW` | New attachment uploaded by applicant; `submitted_at` of new attachment > previous `decided_at`; virus scan passed | **System** (on attachment receipt) |
| T-09 | `UNDER_REVIEW` | `ESCALATED_TO_SENIOR` | `triage_category = COMPLEX_SENIOR` OR `agent_confidence_score < AGENT_CONFIDENCE_THRESHOLD` OR explicit human escalation; new `assigned_reviewer_id` references a `SENIOR_EXAMINER` or `SUPERVISOR` with capacity | **Agent Alone** (auto) or **Human Only** (manual) |
| T-10 | `ESCALATED_TO_SENIOR` | `APPROVED` | Same as T-05; actor must be `SENIOR_EXAMINER` or `SUPERVISOR` | **Human Only** |
| T-11 | `ESCALATED_TO_SENIOR` | `REJECTED` | Same as T-06; actor must be `SENIOR_EXAMINER` or `SUPERVISOR` | **Human Only** |
| T-12 | any non-terminal | `WITHDRAWN` | Authenticated applicant withdrawal request received; `reviewer_notes` records reason | **Human Only** (staff confirms) |

---

## 3. Delegation Boundaries

Every system action is labeled with one of three authority levels.

### 3.1 Label Definitions

| Label | Meaning |
|---|---|
| **[Agent Alone]** | Agent executes without any human click required; result is logged but not gated on approval |
| **[Agent + Human Review]** | Agent drafts output; a named human reviewer must read, optionally edit, and explicitly submit before the action is recorded as final |
| **[Human Only]** | Agent has no role; action is initiated, composed, and submitted entirely by a human reviewer in an authenticated session |

---

### 3.2 Action Registry

| Action | Label | What Agent Drafts | What Human Clicks |
|---|---|---|---|
| Completeness check at intake | **[Agent Alone]** | List of missing/blocking items | — |
| Geocode site address | **[Agent Alone]** | GIS lookup result | — |
| Virus scan attachments | **[Agent Alone]** | Scan result per file | — |
| Assign triage category | **[Agent Alone]** | `triage_category`, `agent_confidence_score`, `agent_reasoning` | — |
| Apply rule sets | **[Agent Alone]** | List of matched/failed rules per rule set | — |
| Draft deficiency list | **[Agent + Human Review]** | Itemized `DeficiencyRecord` list with code citations | Reviewer confirms, adds, removes, or edits deficiencies; submits |
| Draft kickback notice to applicant | **[Agent + Human Review]** | Plain-language notice referencing each deficiency | Reviewer reviews text, signs off, submits |
| Draft approval recommendation memo | **[Agent + Human Review]** | Structured checklist confirming all rules passed | Reviewer reads and confirms before recording decision |
| Assign reviewer to application | **[Agent Alone]** | Selection of eligible reviewer based on role, workload, jurisdiction | — |
| Escalate to senior examiner | **[Agent Alone]** (auto) / **[Human Only]** (manual) | Escalation rationale and risk flags | If manual: reviewer clicks Escalate button |
| Record `APPROVED` decision | **[Human Only]** | — | Reviewer types notes, clicks Approve in authenticated session |
| Record `REJECTED` decision | **[Human Only]** | — | Reviewer types notes with code citations, clicks Reject in authenticated session |
| Record `RETURNED_TO_APPLICANT` | **[Human Only]** | — | Reviewer confirms deficiency list, clicks Return |
| Request additional info from applicant | **[Human Only]** | — | Reviewer types request, clicks Send |
| Confirm applicant withdrawal | **[Human Only]** | — | Staff member confirms in authenticated session |
| Generate audit log entry | **[Agent Alone]** / **[System]** | Structured log record | — |
| Notify supervisor of workload cap breach | **[Agent Alone]** | Alert payload | — |

---

## 4. Integration Contracts

### 4.1 Code Reference Engine

The Code Reference Engine (CRE) provides rule-based lookup across the 40-page local amendment corpus, IBC, and applicable state statutes. It is accessed as an internal HTTP service.

#### Request Format

```
POST /v1/code-reference/evaluate
Content-Type: application/json
Authorization: Bearer <service-token>
X-Request-ID: <uuid>           -- echoed in response for correlation
X-Timeout-Ms: 5000
```

```json
{
  "request_id": "uuid",
  "application_id": "uuid",
  "project_type": "string",
  "square_footage": 450,
  "valuation_usd": 148000.00,
  "parcel_id": "string",
  "jurisdiction": "US-OR-PDX",
  "rule_set_ids": ["uuid", "uuid"],
  "attributes": {
    "structural_modification": false,
    "historic_district": false,
    "environmental_overlay": false,
    "prior_violation": false
  },
  "document_index": [
    {
      "document_id": "uuid",
      "document_type": "SITE_PLAN",
      "page_count": 4
    }
  ]
}
```

#### Response Format

```json
{
  "request_id": "uuid",
  "application_id": "uuid",
  "evaluation_id": "uuid",
  "evaluated_at": "2026-04-22T14:32:00Z",
  "confidence_score": 0.91,
  "overall_result": "PASS | FAIL | INCONCLUSIVE",
  "rule_results": [
    {
      "rule_set_id": "uuid",
      "code_section": "IBC 2021 §1004.1",
      "rule_title": "Occupant Load",
      "result": "PASS | FAIL | NOT_APPLICABLE",
      "severity": "BLOCKING | WARNING | INFO",
      "evidence": "Occupant load table present on sheet A-2, line 14.",
      "auto_correctable": false
    }
  ],
  "conflicting_rules": [
    {
      "higher_precedence_rule_set_id": "uuid",
      "lower_precedence_rule_set_id": "uuid",
      "resolution": "LOCAL amendment §3.4.2 supersedes IBC §705.8"
    }
  ],
  "processing_time_ms": 312
}
```

#### SLA & Timeout

| Parameter | Value |
|---|---|
| Timeout | 5,000 ms (hard cutoff; client aborts after 5,000 ms) |
| Retry policy | 1 automatic retry after 500 ms if HTTP 5xx or connection timeout; no retry on HTTP 4xx |
| Expected p99 latency | ≤ 3,000 ms under normal load |
| Circuit breaker | Open after 5 consecutive failures within 60 seconds; half-open probe every 30 seconds |

#### Fallback Logic

The system must handle CRE unavailability without silently degrading triage quality.

```
CRE Request Outcome
        │
        ├── [HTTP 200, confidence >= threshold]
        │       └── Proceed normally
        │
        ├── [HTTP 200, confidence < threshold]
        │       └── Set triage_category = COMPLEX_SENIOR
        │           Set agent_recommendation = NEEDS_HUMAN_REVIEW
        │           Log SYSTEM_ERROR audit event with reason = "CRE_LOW_CONFIDENCE"
        │           Notify SUPERVISOR
        │
        ├── [HTTP 4xx — bad request]
        │       └── Reject transition; return validation error to caller
        │           Do NOT proceed to TRIAGE_PENDING
        │
        ├── [HTTP 5xx or timeout — first attempt]
        │       └── Retry once after 500 ms
        │
        ├── [HTTP 5xx or timeout — retry exhausted]
        │       └── Set status = TRIAGE_PENDING (held)
        │           Set agent_recommendation = NEEDS_HUMAN_REVIEW
        │           Log SYSTEM_ERROR audit event with reason = "CRE_UNAVAILABLE"
        │           Alert SUPERVISOR with application_id and failure timestamp
        │           Application remains in TRIAGE_PENDING until CRE recovers
        │           Do NOT auto-approve, auto-reject, or auto-route
        │
        └── [Circuit breaker OPEN]
                └── Immediately skip CRE call
                    Apply same fallback as timeout-exhausted above
                    Log reason = "CRE_CIRCUIT_OPEN"
```

**Guarantee:** If the CRE is unavailable for any reason, no application is automatically classified as `ROUTINE` or `DEFICIENT`. All CRE-failure applications receive `NEEDS_HUMAN_REVIEW` and are held until a human resolves them.

---

### 4.2 GIS / Parcel Geocoding Service

#### Request

```
GET /v1/parcels/geocode?address=<url-encoded-address>&jurisdiction=<ISO-3166-2>
Authorization: Bearer <service-token>
X-Timeout-Ms: 3000
```

#### Response

```json
{
  "request_id": "uuid",
  "query_address": "string",
  "match_count": 1,
  "matches": [
    {
      "parcel_id": "string",
      "canonical_address": "string",
      "latitude": 45.523064,
      "longitude": -122.676483,
      "confidence": 0.98,
      "zoning_code": "R1",
      "overlays": ["HISTORIC_DISTRICT", "FLOOD_ZONE_AE"]
    }
  ]
}
```

#### Ambiguity Rule

| `match_count` | System Behavior |
|---|---|
| 0 | Block transition to `INTAKE_REVIEW`; return error `GEO_NO_MATCH` to applicant portal |
| 1 | Proceed; store `parcel_id` and `geocode_result` |
| ≥ 2 | Block transition; return error `GEO_AMBIGUOUS_ADDRESS`; require applicant to select or clarify parcel |
| Timeout (> 3,000 ms) | Block transition; return error `GEO_TIMEOUT`; log `SYSTEM_ERROR` |

---

## 5. Validation & Failure Modes

### 5.1 ROUTINE Triage

**Happy Path:**
- Project: single-family interior remodel, no structural change
- `square_footage = 420`, `valuation_usd = 82000.00`
- All documents present; geocoder returns `match_count = 1`
- CRE returns `overall_result = PASS`, `confidence_score = 0.95`
- No prior violations on parcel; no overlays
- **Result:** `triage_category = ROUTINE`, `agent_recommendation = RECOMMEND_APPROVAL`, routed to available `PERMIT_TECHNICIAN`

**Edge Cases:**

| ID | Condition | Expected Behavior |
|---|---|---|
| EC-R-01 | `valuation_usd = 150000.00` (exactly at threshold) | `ROUTINE_VALUATION_THRESHOLD` comparison is `<=`; at exactly $150,000.00 the application is ROUTINE. Document this boundary explicitly in config. |
| EC-R-02 | All docs present but one attachment is a 0-byte file | Intake check must detect `file_size_bytes = 0` as a BLOCKING deficiency (`MISSING_CONTENT`), not a passed document. Transition to `RETURNED_INCOMPLETE`. |
| EC-R-03 | Geocoder returns `match_count = 1` but the matched parcel's `zoning_code` is `C1` (commercial) | Block intake; return error `PARCEL_ZONING_INELIGIBLE`; do not proceed. Residential triage system does not process commercial-zoned parcels. |

**Failure Modes:**

| ID | Condition | Expected Behavior |
|---|---|---|
| FM-R-01 | `agent_confidence_score = 0.79` (below 0.80 threshold) | Override `triage_category` to `COMPLEX_SENIOR`; set `agent_recommendation = NEEDS_HUMAN_REVIEW`; do not route as ROUTINE regardless of other signals. Log with reason `LOW_CONFIDENCE`. |
| FM-R-02 | Assigned `PERMIT_TECHNICIAN` is deactivated (`active = false`) between assignment and acknowledgment | Detect on acknowledgment attempt; invalidate assignment; re-run reviewer selection; log `REVIEWER_ASSIGNMENT` event with reason `REVIEWER_DEACTIVATED`; notify supervisor. |

---

### 5.2 DEFICIENT Triage

**Happy Path:**
- Project: single-family addition, 380 sq ft
- `valuation_usd = 95000.00`
- CRE returns `overall_result = FAIL` on two rules: missing setback dimension (BLOCKING) and incomplete site plan note (WARNING)
- Geocoder returns `match_count = 1`; no overlays
- **Result:** `triage_category = DEFICIENT`, `agent_recommendation = RECOMMEND_KICKBACK`, agent drafts deficiency list with both items; `PLANS_EXAMINER` assigned; reviewer confirms and sends kickback notice to applicant

**Edge Cases:**

| ID | Condition | Expected Behavior |
|---|---|---|
| EC-D-01 | Geocoder returns `match_count = 2` (two parcels match address string) | Block at intake; return `GEO_AMBIGUOUS_ADDRESS`; application stays in `SUBMITTED` status; agent does not begin triage until applicant disambiguates. |
| EC-D-02 | CRE returns 10 BLOCKING deficiencies but the application was previously returned for the same 3 deficiencies | Detect prior `RETURNED_INCOMPLETE` event in `audit_log` for same `application_id`; flag as `REPEAT_KICKBACK`; escalate to `PLANS_EXAMINER` (not technician); add `REPEAT_KICKBACK` field to deficiency payload. |
| EC-D-03 | Agent drafts deficiency list; reviewer removes all deficiencies and approves | Permitted (human authority supersedes draft); `audit_log` must record `REVIEWER_OVERRODE_DEFICIENCIES` event with `old_value = <deficiency count>` and `reviewer_notes` must be non-empty explaining the override. |

**Failure Modes:**

| ID | Condition | Expected Behavior |
|---|---|---|
| FM-D-01 | CRE returns `FAIL` on one rule but `evidence` field is null or empty string | Agent must not persist a `DeficiencyRecord` with a null `evidence` field. Log `SYSTEM_ERROR` with reason `CRE_EMPTY_EVIDENCE`; escalate to `SENIOR_EXAMINER` with flag for manual code lookup. |
| FM-D-02 | No `PLANS_EXAMINER` is available (all at `max_workload`) and no `SENIOR_EXAMINER` is available either | Escalate to `SUPERVISOR` with alert payload; log `SYSTEM_ERROR` with reason `NO_ELIGIBLE_REVIEWER`; application stays in `TRIAGE_PENDING`; do not assign a placeholder reviewer. |

---

### 5.3 COMPLEX / SENIOR Triage

**Happy Path:**
- Project: two-story addition, 650 sq ft, structural modification
- `valuation_usd = 285000.00`; parcel in historic district overlay
- CRE returns `overall_result = INCONCLUSIVE`, `confidence_score = 0.72`
- **Result:** `triage_category = COMPLEX_SENIOR`, `agent_recommendation = RECOMMEND_ESCALATION`, agent flags: `structural_modification`, `historic_district`, `high_valuation`, `low_confidence`; routed to available `SENIOR_EXAMINER`

**Edge Cases:**

| ID | Condition | Expected Behavior |
|---|---|---|
| EC-C-01 | `valuation_usd = 150001.00` (one cent above ROUTINE threshold) | `triage_category = COMPLEX_SENIOR`. Agent must apply the threshold as a strict upper bound: `valuation_usd > ROUTINE_VALUATION_THRESHOLD` triggers escalation. No rounding. |
| EC-C-02 | Application has `prior_violation = true` on parcel but `valuation_usd = 30000.00` and `square_footage = 100` | `prior_violation` alone is sufficient to trigger `COMPLEX_SENIOR` regardless of other low-complexity indicators. Route to `SENIOR_EXAMINER`. |
| EC-C-03 | CRE is down (circuit breaker OPEN) during evaluation of an application that would otherwise be ROUTINE | Per §4.1 fallback: set `COMPLEX_SENIOR` + `NEEDS_HUMAN_REVIEW`; hold in `TRIAGE_PENDING`; notify supervisor. Do not auto-classify as ROUTINE. |

**Failure Modes:**

| ID | Condition | Expected Behavior |
|---|---|---|
| FM-C-01 | No `SENIOR_EXAMINER` and no `SUPERVISOR` is available (all at cap or inactive) | Log `SYSTEM_ERROR` with reason `NO_SENIOR_REVIEWER`; send out-of-band alert (email + webhook) to department head contact defined in `DEPT_HEAD_ALERT_ENDPOINT` env variable; application stays in `ESCALATED_TO_SENIOR`; do not assign and do not auto-decide. |
| FM-C-02 | `SENIOR_EXAMINER` completes review and records `APPROVED` but their `auth_session` expired between page load and form submit | Submission is rejected at the API layer with HTTP 401; `auth_session.expires_at < NOW()` check enforced server-side before writing any `reviewer_decision`; reviewer must re-authenticate; original draft is preserved in the UI; no partial write occurs. |

---

## 6. Non-Repudiation & Governance

### 6.1 Definition

Non-repudiation is the system's ability to prove, to an auditor or court, that a specific named human made a specific decision at a specific time using a verified identity — and that this record cannot be altered retroactively.

### 6.2 Session Binding at Decision Time

When a reviewer submits any `reviewer_decision`, the system executes the following sequence atomically within a database transaction:

```
1. Validate auth_session:
   - session_id must exist in auth_session table
   - auth_session.reviewer_id must equal permit_application.assigned_reviewer_id
   - auth_session.expires_at must be > NOW()
   - auth_session.invalidated_at must be NULL

2. Compute auth_token_hash:
   - SHA-256(raw bearer token from Authorization header)
   - Store hash only; never store raw token

3. Write to permit_application:
   - reviewer_decision  = <submitted value>
   - reviewer_notes     = <submitted value>
   - decided_at         = NOW()  -- server-set; client value ignored
   - decision_session_id = <session_id>

4. Write to audit_log:
   - event_type         = 'REVIEWER_DECISION'
   - actor_type         = 'HUMAN'
   - actor_id           = reviewer_id (UUID string)
   - session_id         = <session_id>
   - auth_token_hash    = <SHA-256 hash>
   - old_value          = previous status
   - new_value          = new status
   - occurred_at        = NOW()  -- same transaction timestamp as step 3

5. If any step fails, roll back the entire transaction.
   No partial writes.
```

### 6.3 Write-Once Fields

The following fields may be written exactly once. Any attempt to update them after initial write must be rejected with HTTP 409 and logged as `SYSTEM_ERROR`:

| Field | Table | Write Window |
|---|---|---|
| `agent_recommendation` | `permit_application` | Set during TRIAGE_PENDING → UNDER_REVIEW |
| `agent_reasoning` | `permit_application` | Set during TRIAGE_PENDING → UNDER_REVIEW |
| `agent_confidence_score` | `permit_application` | Set during TRIAGE_PENDING → UNDER_REVIEW |
| `deficiencies` | `permit_application` | Set during INTAKE_REVIEW or TRIAGE; reviewer edits are stored in `audit_log` as diffs, not overwrites |
| `submitted_at` | `permit_application` | Set at creation; never updated |
| `decided_at` | `permit_application` | Set at decision; never updated |
| All columns | `audit_log` | Write-once; updates and deletes revoked at DB level |

If re-evaluation is needed (e.g., applicant resubmits after kickback), a new recommendation is appended via a new `audit_log` row; the original fields on `permit_application` are not overwritten.

### 6.4 What Constitutes Proof of Human Decision

To satisfy an audit challenge, the system must be able to produce all of the following for any terminal decision:

| Evidence Item | Source |
|---|---|
| Reviewer full name | `reviewer.full_name` at `decided_at` |
| Reviewer employee ID | `reviewer.employee_id` |
| Reviewer role at time of decision | `audit_log` entry for `REVIEWER_ASSIGNMENT` |
| Session ID | `permit_application.decision_session_id` |
| Token hash | `audit_log.auth_token_hash` for `REVIEWER_DECISION` event |
| IP address at login | `auth_session.ip_address` |
| Session issue and expiry | `auth_session.issued_at`, `auth_session.expires_at` |
| Decision timestamp (server-set) | `permit_application.decided_at` |
| Reviewer notes | `permit_application.reviewer_notes` |
| Code citations (for rejections) | `deficiencies[*].code_section` |
| Audit sequence number | `audit_log.server_sequence` (gap = tampering indicator) |

### 6.5 PII Controls

| Rule | Enforcement |
|---|---|
| `applicant_name`, `applicant_email`, `applicant_phone`, `site_address` must not appear in log aggregation, APM traces, or error messages | Scrubbed at the application logging layer before emit; use `application_id` as the identifier in all system outputs |
| `auth_token_hash` stores only SHA-256 hash | Raw token must not be logged at any level, including DEBUG |
| `audit_log` is readable only by `audit_role` and `supervisor_role` database roles | Enforced via row-level security; `app_role` has INSERT-only access |
| Applicant PII fields are encrypted at rest using AES-256 | Column-level encryption; key managed via KMS; `application_id` used for all inter-service references |

### 6.6 Retention & Tamper Detection

| Item | Retention | Tamper Detection |
|---|---|---|
| `audit_log` | 7 years minimum (building department statutory requirement) | Monotonic `server_sequence`; gap detection alert fires if `MAX(server_sequence) - COUNT(*) > 0` for any `application_id` |
| `permit_application` | 10 years minimum | Periodic hash digest of decided records stored in append-only object storage |
| `auth_session` | 2 years | Included in audit hash digest for all sessions linked to a decision |

---

## Appendix A: Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `ROUTINE_VALUATION_THRESHOLD` | `DECIMAL` | `150000.00` | USD; applications with `valuation_usd > this value` floor to COMPLEX_SENIOR |
| `COMPLEX_SQFT_THRESHOLD` | `INTEGER` | `500` | sq ft addition threshold for COMPLEX_SENIOR |
| `AGENT_CONFIDENCE_THRESHOLD` | `DECIMAL` | `0.80` | Below this score, agent always sets NEEDS_HUMAN_REVIEW |
| `MAX_REVIEWER_WORKLOAD` | `INTEGER` | `40` | Default per-reviewer open-case cap (overridable per reviewer row) |
| `CRE_TIMEOUT_MS` | `INTEGER` | `5000` | Hard timeout for Code Reference Engine calls |
| `CRE_RETRY_DELAY_MS` | `INTEGER` | `500` | Delay before single retry on CRE 5xx |
| `CRE_CIRCUIT_BREAKER_THRESHOLD` | `INTEGER` | `5` | Consecutive failures before circuit opens |
| `GEO_TIMEOUT_MS` | `INTEGER` | `3000` | Hard timeout for geocoding calls |
| `DEPT_HEAD_ALERT_ENDPOINT` | `STRING` | — | Webhook URL for out-of-band supervisor alerts |
| `ROUTINE_PROJECT_TYPES` | `STRING[]` | _(config file)_ | Allowlist of project type codes eligible for ROUTINE triage |
| `AUDIT_RETENTION_YEARS` | `INTEGER` | `7` | Minimum retention period for audit_log records |

---

## Appendix B: Testability Checklist

Every requirement in this specification must satisfy all four criteria:

1. **Observable** — the outcome can be read from the database or API response
2. **Binary** — the test either passes or fails with no subjective judgment
3. **Reproducible** — the same input always produces the same output
4. **Automated** — the test can be run without human observation

Words explicitly prohibited in requirements: *fast*, *efficient*, *appropriate*, *reasonable*, *adequate*, *timely*, *user-friendly*.

All latency requirements are expressed in milliseconds. All threshold comparisons specify the operator (`>`, `>=`, `<`, `<=`). All boundary conditions are explicitly documented (see EC-R-01, EC-C-01).
