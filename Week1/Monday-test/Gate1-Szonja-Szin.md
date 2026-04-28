# FNOL Agentic Solution — CLAUDE.md

## 1. Purpose

This system exists to automate the ingestion, triage, and routing of **300 daily First Notice of Loss (FNOL) reports** arriving as unstructured text (email, phone transcript, web form) into a structured claims workflow.

**Objectives:**
- Reduce routing error rate from **18% → <2%**
- Eliminate the **31% SLA breach rate** by enforcing a **2-hour end-to-end processing window** (`SLA_WINDOW_SECONDS = 7200`)

The agent triages and routes claims. It does not adjudicate, approve, deny, or communicate claim outcomes to claimants.

---

## 2. Core Entities

### 2.1 `claim`

Represents a single FNOL submission from ingestion through acknowledgement.

| Field | Type | Notes |
|---|---|---|
| `claim_id` | `uuid` | Primary key; system-generated at ingestion |
| `source_type` | `enum SOURCE_TYPE` | Channel of ingestion |
| `raw_payload_url` | `string` | Immutable URL to raw transcript/email in DMS; write-once |
| `severity_score` | `integer` | 1–10 scale; computed by triage agent from NLP extraction |
| `policy_id` | `string` | Extracted from raw payload; used to query Policy system |
| `claim_value` | `decimal` | USD; extracted or estimated from raw payload |
| `loss_type` | `enum LOSS_TYPE` | Determines adjuster skill-group routing |
| `date_of_loss` | `date` | ISO 8601; extracted from raw payload |
| `validation_status` | `enum VALIDATION_STATUS` | Set by validation step |
| `routing_target` | `enum ROUTING_TARGET` | Set by routing step; null until VALIDATED |
| `sla_deadline` | `string` | ISO 8601 datetime; system-set as `ingested_at + SLA_WINDOW_SECONDS` |
| `status` | `enum CLAIM_STATUS` | Current lifecycle state |
| `policy_snapshot` | `jsonb` | Write-once copy of Policy response at validation time |
| `agent_reasoning` | `text` | Structured rationale; write-once after triage |
| `extraction_confidence` | `decimal` | 0.0–1.0; if below `EXTRACTION_CONFIDENCE_THRESHOLD`, flag for human |
| `retry_count` | `integer` | SOAP retry counter; must not exceed `MAX_SOAP_RETRIES` |
| `assigned_specialist_id` | `string \| null` | CRM adjuster ID; populated at ROUTED step |
| `human_review_reason` | `text \| null` | Required whenever `routing_target = HUMAN_REVIEW` or `SOAP_ESCALATION_QUEUE` |
| `acknowledged_at` | `timestamp` | ISO 8601 UTC; set only after `VALID` status confirmed and `status = ROUTED` |
| `created_at` | `timestamp` | System-set at ingestion; immutable |
| `updated_at` | `timestamp` | System-set on every mutation |

**Enum: `SOURCE_TYPE`**
```
EMAIL
PHONE
WEB
```

**Enum: `LOSS_TYPE`**
```
AUTO
PROPERTY
LIABILITY
MEDICAL
OTHER
```

**Enum: `VALIDATION_STATUS`**
```
PENDING      -- default at ingestion
VALID        -- policy confirmed active, date_of_loss within coverage window
INVALID      -- policy lapsed, date_of_loss out of range, policy not found, or loss type not covered
```

**Enum: `ROUTING_TARGET`**
```
AUTO_ADJUSTER_STANDARD
AUTO_ADJUSTER_HIGH_PRIORITY
PROPERTY_ADJUSTER_STANDARD
PROPERTY_ADJUSTER_HIGH_PRIORITY
LIABILITY_ADJUSTER_STANDARD
LIABILITY_ADJUSTER_HIGH_PRIORITY
MEDICAL_ADJUSTER_STANDARD
MEDICAL_ADJUSTER_HIGH_PRIORITY
HUMAN_ADJUSTER_HIGH_PRIORITY    -- mandatory for high-value or high-severity claims
HUMAN_REVIEW                    -- mandatory for invalid, unresolvable, or uncertain claims
SOAP_ESCALATION_QUEUE           -- SOAP timeout after MAX_SOAP_RETRIES exhausted
```

**Enum: `CLAIM_STATUS`**
```
RECEIVED
TRIAGED
VALIDATED
ROUTED
ACKNOWLEDGED
ESCALATED
```

---

### 2.2 `policy`

Not persisted as a standalone record — retrieved on-demand from the SOAP Legacy System and stored as an immutable snapshot in `claim.policy_snapshot` at validation time.

**Retrieved fields (from `GetPolicyDetails` response):**

| Field | Type | Notes |
|---|---|---|
| `policy_id` | `string` | Matches `claim.policy_id` |
| `status` | `enum POLICY_STATUS` | Must be `ACTIVE` for claim to reach `VALID` |
| `coverage_limit` | `decimal` | USD; upper bound on covered claim value |
| `policy_start_date` | `date` | ISO 8601 |
| `policy_end_date` | `date` | ISO 8601 |
| `covered_loss_types` | `LOSS_TYPE[]` | Subset of `LOSS_TYPE` enum |

**Enum: `POLICY_STATUS`**
```
ACTIVE
LAPSED
CANCELLED
PENDING
```

---

## 3. State Machine

### `CLAIM_STATUS` Transitions

```
RECEIVED
    │
    ▼
TRIAGED            ← agent extracts: severity_score, claim_value, loss_type,
    │                 date_of_loss, policy_id from raw_payload_url
    │                 agent writes agent_reasoning (write-once)
    │                 if extraction_confidence < EXTRACTION_CONFIDENCE_THRESHOLD:
    │                   → set routing_target = HUMAN_REVIEW
    │                   → populate human_review_reason = "LOW_EXTRACTION_CONFIDENCE: {score}"
    │                   → skip VALIDATED; notify human specialist queue
    │
    ▼
VALIDATED          ← agent queries GetPolicyDetails (SOAP) using claim.policy_id
    │                 on success:
    │                   → write policy_snapshot (write-once)
    │                   → evaluate all Validation Rules (Section 4)
    │                   → set validation_status = VALID or INVALID
    │                 on SOAP timeout or network error:
    │                   → increment retry_count
    │                   → if retry_count < MAX_SOAP_RETRIES:
    │                       retry after SOAP_RETRY_BACKOFF_SECONDS * (retry_count^2) seconds
    │                   → if retry_count >= MAX_SOAP_RETRIES:
    │                       set status = ESCALATED
    │                       set routing_target = SOAP_ESCALATION_QUEUE
    │                       notify human specialist queue synchronously
    │                       halt pipeline (do not advance to ROUTED)
    │                 if validation_status = INVALID:
    │                   → set routing_target = HUMAN_REVIEW
    │                   → populate human_review_reason with specific failed condition
    │                   → halt routing pipeline (do not advance to ROUTED)
    │
    ▼
ROUTED             ← agent sets routing_target per Routing Logic (Section 4.5)
    │                 agent updates CRM via PATCH /claims/{claim_id}
    │                 agent writes assigned_specialist_id from CRM response
    │                 on CRM error: route to HUMAN_REVIEW; populate human_review_reason
    │
    ▼
ACKNOWLEDGED       ← agent notifies claimant ONLY when ALL conditions are true:
                       (a) claim.validation_status = VALID
                       (b) claim.status = ROUTED
                       (c) claim.routing_target is set and non-null
                      agent sets acknowledged_at = current UTC timestamp
```

**`ESCALATED`** is a terminal exception state. An `ESCALATED` claim must be resolved by a human specialist before it may re-enter the pipeline at `VALIDATED`. The agent must not attempt to auto-resume an `ESCALATED` claim.

---

## 4. Validation Rules

All rules are evaluated after a successful `GetPolicyDetails` response and before `routing_target` is written. A rule failure must produce an actionable, specific error string in `human_review_reason`. Silent failures are not permitted.

### 4.1 High-Value / High-Severity Rule

```
IF severity_score > HIGH_SEVERITY_THRESHOLD          (default: 7)
   OR claim_value > HIGH_VALUE_THRESHOLD_USD         (default: 10000)
THEN
    routing_target = HUMAN_ADJUSTER_HIGH_PRIORITY
```

This rule is evaluated **first**, before skill-group matching. It takes precedence over all other `routing_target` assignments except `HUMAN_REVIEW` and `SOAP_ESCALATION_QUEUE`.

### 4.2 Policy Active Status Rule

```
IF policy.status != ACTIVE
THEN
    validation_status = INVALID
    routing_target    = HUMAN_REVIEW
    human_review_reason = "POLICY_INACTIVE: policy_id={policy_id} status={policy.status}"
```

### 4.3 Policy Coverage Date Rule

```
IF claim.date_of_loss < policy.policy_start_date
   OR claim.date_of_loss > policy.policy_end_date
THEN
    validation_status = INVALID
    routing_target    = HUMAN_REVIEW
    human_review_reason must cite:
      - the claim.date_of_loss value
      - the policy_start_date and policy_end_date values
      - which boundary was violated
```

### 4.4 Coverage Limit Rule

```
IF claim_value > policy.coverage_limit
THEN
    routing_target    = HUMAN_REVIEW
    human_review_reason = "COVERAGE_EXCEEDED: claim_value={claim_value} > coverage_limit={policy.coverage_limit}"
```

Note: this does not set `validation_status = INVALID` on its own; it routes to `HUMAN_REVIEW` for a coverage determination.

### 4.5 Loss Type Coverage Rule

```
IF claim.loss_type NOT IN policy.covered_loss_types
THEN
    validation_status = INVALID
    routing_target    = HUMAN_REVIEW
    human_review_reason = "UNCOVERED_LOSS_TYPE: loss_type={loss_type} not in {policy.covered_loss_types}"
```

### 4.6 Routing Logic — Skill-Group Matching

Evaluated only when Rules 4.1–4.5 do not trigger `HUMAN_REVIEW` or `HUMAN_ADJUSTER_HIGH_PRIORITY`. Match `claim.loss_type` to the CRM adjuster skill-group:

| `loss_type` | Standard `routing_target` | High-Priority `routing_target` |
|---|---|---|
| `AUTO` | `AUTO_ADJUSTER_STANDARD` | `AUTO_ADJUSTER_HIGH_PRIORITY` |
| `PROPERTY` | `PROPERTY_ADJUSTER_STANDARD` | `PROPERTY_ADJUSTER_HIGH_PRIORITY` |
| `LIABILITY` | `LIABILITY_ADJUSTER_STANDARD` | `LIABILITY_ADJUSTER_HIGH_PRIORITY` |
| `MEDICAL` | `MEDICAL_ADJUSTER_STANDARD` | `MEDICAL_ADJUSTER_HIGH_PRIORITY` |
| `OTHER` | `HUMAN_REVIEW` | `HUMAN_ADJUSTER_HIGH_PRIORITY` |

High-priority row applies when Rule 4.1 triggers. Standard row applies otherwise.

### 4.7 SLA Deadline Enforcement

```
sla_deadline = created_at + SLA_WINDOW_SECONDS   (default: 7200)
```

If `current_utc_time > sla_deadline` at any pipeline step, the agent must:
1. Set `routing_target = HUMAN_REVIEW` (if not already routed to a higher-priority queue)
2. Set `human_review_reason = "SLA_BREACH: deadline={sla_deadline} exceeded at step={current_status}"`
3. Notify the supervisor queue synchronously before proceeding

---

## 5. Agent Guardrails — NEVER List

These are absolute constraints. Violating any of them is a system failure, not a configuration issue.

1. **NEVER auto-reject or auto-invalidate a claim as a terminal outcome.** When validation fails, the agent must set `routing_target = HUMAN_REVIEW` and populate `human_review_reason` with a specific, actionable explanation. A human reviewer must confirm any final invalidation.

2. **NEVER acknowledge a claim to a claimant before `validation_status = VALID` is confirmed and `claim.status = ROUTED` is set.** The agent must not call any claimant-facing notification channel until both conditions are true. Premature acknowledgement is a compliance violation.

3. **NEVER query the Legacy SOAP endpoint more than `MAX_SOAP_RETRIES` times for a single claim.** On exhaustion, the agent must set `status = ESCALATED`, `routing_target = SOAP_ESCALATION_QUEUE`, and synchronously notify the human specialist queue. The agent must not silently drop the claim or reset `retry_count`.

4. **NEVER use vague verbs.** The agent's code, logs, and `agent_reasoning` output must use precise operations only:
   - Replace ~~"handle"~~ → `query`, `update`, `notify`, `extract`, `validate`, `route`, `write`
   - Replace ~~"process"~~ → name the exact operation (e.g., `query_soap_policy`, `write_policy_snapshot`, `update_crm_routing`)

5. **NEVER suppress or omit a validation failure to improve routing metrics.** Every detected issue must be written to `human_review_reason` with the specific condition that failed, regardless of downstream routing impact.

6. **NEVER modify `agent_reasoning`, `raw_payload_url`, or `policy_snapshot` after initial write.** These are write-once fields. If re-triage is required, a new `claim` record must be created referencing the original `claim_id`.

7. **NEVER expose PII in logs, traces, monitoring outputs, or error messages.** Use `claim_id` and `policy_id` as identifiers in all system outputs. Claimant name, address, phone number, and raw policy details must not appear in structured logs.

8. **NEVER route a claim with `validation_status = INVALID` to any adjuster queue.** Claims with `INVALID` status route exclusively to `HUMAN_REVIEW`.

9. **NEVER escalate silently.** Every transition to `SOAP_ESCALATION_QUEUE` or `HUMAN_REVIEW` must generate an explicit, addressable notification to the designated specialist queue with a non-null, non-empty `human_review_reason`.

10. **NEVER act on unverified input.** Before the agent begins triage:
    - All raw payloads must pass integrity checks via DMS
    - All `policy_id` values must be queryable against the live SOAP system
    - All `date_of_loss` values must parse as valid ISO 8601 dates
    - All `source_type` values must match a defined `SOURCE_TYPE` enum member
    Unverifiable inputs must be routed to `HUMAN_REVIEW` with a specific `human_review_reason`.

---

## 6. Integration Contracts

### 6.1 CRM — REST API

**Endpoint:** `PATCH /claims/{claim_id}`
**Base URL:** `CRM_BASE_URL` environment variable
**Auth:** `Authorization: Bearer {CRM_API_TOKEN}`

**Request body (JSON):**
```json
{
  "claim_id": "<uuid>",
  "routing_target": "<ROUTING_TARGET enum value>",
  "assigned_specialist_id": "<string | null>",
  "status": "ROUTED",
  "sla_deadline": "<ISO 8601 datetime>"
}
```

**Success:** `200 OK` with updated claim record. Agent writes `assigned_specialist_id` from CRM response body.

**Failure:** On `4xx` or `5xx`, the agent must:
1. Log `claim_id` and HTTP status code (no PII in log)
2. Set `routing_target = HUMAN_REVIEW`
3. Set `human_review_reason = "CRM_UPDATE_FAILED: HTTP {status_code} at PATCH /claims/{claim_id}"`
4. Not silently continue to `ACKNOWLEDGED`

---

### 6.2 Policy System — SOAP

**Operation:** `GetPolicyDetails`
**WSDL:** `SOAP_WSDL_URL` environment variable
**Auth:** HTTP Basic — `SOAP_USERNAME` / `SOAP_PASSWORD` environment variables

**Request:**
```xml
<GetPolicyDetails>
  <PolicyId>{policy_id}</PolicyId>
</GetPolicyDetails>
```

**Response fields consumed:** `policy_id`, `status`, `coverage_limit`, `policy_start_date`, `policy_end_date`, `covered_loss_types`

**Retry behavior:**
- On `SOAP_TIMEOUT` or network error: wait `SOAP_RETRY_BACKOFF_SECONDS * (retry_count ^ 2)` seconds, then retry
- Maximum attempts: `MAX_SOAP_RETRIES` (default: `3`)
- On exhaustion: set `status = ESCALATED`, `routing_target = SOAP_ESCALATION_QUEUE`; notify human specialist queue synchronously

**Error cases:**
| SOAP fault | Agent action |
|---|---|
| `PolicyNotFound` | `validation_status = INVALID`, `human_review_reason = "POLICY_NOT_FOUND: policy_id={policy_id}"` |
| `ServiceUnavailable` | Retry up to `MAX_SOAP_RETRIES`; escalate on exhaustion |
| Malformed response | `routing_target = HUMAN_REVIEW`, `human_review_reason = "SOAP_PARSE_ERROR: {fault_string}"` |

---

### 6.3 Document Management System (DMS)

**Purpose:** Store raw transcript/email payload at ingestion; make available for human review.

**Upload (at ingestion):**
- `POST {DMS_BASE_URL}/documents` — multipart body containing raw payload
- Response contains `document_url` → write to `claim.raw_payload_url` (write-once)
- If upload fails, halt ingestion; do not create `claim` record; return error to ingestion caller

**Retrieval:**
- `GET {DMS_BASE_URL}/documents/{document_id}` — used by human reviewers only
- The agent does not re-fetch `raw_payload_url` after ingestion; it operates on extracted fields

**Auth:** `Authorization: Bearer {DMS_API_TOKEN}`

---

## 7. Configurable Constants

All values are environment-variable-driven. No hardcoded thresholds.

| Variable | Default | Description |
|---|---|---|
| `SLA_WINDOW_SECONDS` | `7200` | Seconds from `created_at` to `sla_deadline` |
| `HIGH_SEVERITY_THRESHOLD` | `7` | `severity_score` above which `HUMAN_ADJUSTER_HIGH_PRIORITY` is mandatory |
| `HIGH_VALUE_THRESHOLD_USD` | `10000` | `claim_value` above which `HUMAN_ADJUSTER_HIGH_PRIORITY` is mandatory |
| `MAX_SOAP_RETRIES` | `3` | Maximum SOAP query attempts per claim before `ESCALATED` |
| `SOAP_RETRY_BACKOFF_SECONDS` | `2` | Base for exponential backoff: `base * (retry_count ^ 2)` seconds |
| `EXTRACTION_CONFIDENCE_THRESHOLD` | `0.75` | Below this, NLP extraction routes to `HUMAN_REVIEW` |
| `SOAP_WSDL_URL` | _(required)_ | WSDL endpoint URL for `GetPolicyDetails` |
| `CRM_API_TOKEN` | _(required)_ | Bearer token for CRM REST API |
| `CRM_BASE_URL` | _(required)_ | Base URL for CRM REST API |
| `DMS_API_TOKEN` | _(required)_ | Bearer token for DMS |
| `DMS_BASE_URL` | _(required)_ | Base URL for DMS |
| `SOAP_USERNAME` | _(required)_ | Basic auth username for SOAP endpoint |
| `SOAP_PASSWORD` | _(required)_ | Basic auth password for SOAP endpoint |

---

## 8. Naming Conventions

| Context | Convention | Example |
|---|---|---|
| Database tables and columns | `snake_case` | `claim`, `routing_target`, `policy_snapshot` |
| Enum values | `SCREAMING_SNAKE_CASE` | `HUMAN_ADJUSTER_HIGH_PRIORITY`, `SOAP_ESCALATION_QUEUE` |
| Python variables and functions | `snake_case` | `validate_policy_coverage()`, `query_soap_policy()`, `write_policy_snapshot()` |
| Python classes | `PascalCase` | `FnolClaim`, `PolicyValidator`, `RoutingEngine`, `SoapClient` |
| API endpoints | `kebab-case` | `/claims/{id}/triage`, `/claims/{id}/route` |
| Environment variables | `SCREAMING_SNAKE_CASE` | `HIGH_VALUE_THRESHOLD_USD`, `MAX_SOAP_RETRIES` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_SLA_WINDOW_SECONDS = 7200` |

---

## 9. Out of Scope

- Claims adjudication or final coverage determination (human adjuster responsibility)
- Reserve-setting or payment authorization
- Fraud scoring or detection (separate downstream system)
- Subrogation workflows
- Claimant self-service portal or status notifications beyond the single `ACKNOWLEDGED` event
- Policy endorsement or rider retrieval beyond `GetPolicyDetails`
- Inspection scheduling or field assignment


# FNOL Agentic Solution — Production-Grade Specification

**Document Status:** Draft v1.0
**Prepared by:** Senior Foundations Development Engineer
**Date:** 2026-04-27
**Applies to:** `fnol-agent` system; 300 daily FNOL ingestions

---

## Deliverable 1: Problem Statement & Success Metrics

### 1.1 Problem Statement

#### Business Perspective

The claims intake team ingests approximately 300 FNOL reports per day across three channels (email, phone transcript, web form). Each report arrives as unstructured text. A human analyst currently extracts structured fields, validates policy coverage against the Legacy SOAP system, and routes the claim to an adjuster skill group in the CRM. This manual pipeline produces two measurable failures:

- **18% routing error rate:** Claims assigned to the wrong adjuster skill group, requiring re-assignment. Each re-assignment adds an estimated 2–4 hours of delay, triggers a second adjuster onboarding the claim, and creates a duplicate CRM audit trail that compliance teams must reconcile.
- **31% SLA breach rate:** Claims not acknowledged within the 2-hour contractual window. SLA breaches expose the organization to regulatory penalties under state insurance codes, erode claimant trust scores (measured by post-claim NPS), and require manual breach reporting to the compliance officer.

At 300 claims/day, a 31% breach rate equals ~93 SLA violations per day. The current staffing model cannot absorb peak load (estimated 40–60 claims in a 2-hour morning window) without compressing analyst review time below the threshold needed for routing accuracy.

#### Claimant Perspective

A claimant filing an FNOL expects three outcomes within the SLA window:

1. **Confirmation** that their claim has been received and is under review.
2. **Assignment** to an adjuster qualified for their specific loss type.
3. **No re-contact burden** — they should not need to re-explain their loss because of an internal routing error.

A routing error forces the claimant to repeat their loss description to a second adjuster, extending time-to-first-contact by 2–4 hours. A SLA breach means the claimant receives no acknowledgement within the contracted window — the claim appears to have disappeared. Both failures are disproportionately felt on high-severity claims (e.g., total vehicle loss, house fire) where the claimant is in acute distress.

---

### 1.2 Defined Terms

All ambiguous terms from the source specification are resolved below. These definitions govern interpretation throughout this document.

| Term | Precise Definition |
|---|---|
| **High-Value Claim** | A claim where `claim_value > HIGH_VALUE_THRESHOLD_USD` (default: `$10,000 USD`) **OR** `severity_score > HIGH_SEVERITY_THRESHOLD` (default: `7` on a 1–10 scale). Both thresholds are environment-variable-driven. Either condition alone is sufficient to trigger high-priority routing. A claim valued at $9,999 with severity_score=8 is High-Value. A claim valued at $15,000 with severity_score=3 is also High-Value. |
| **SLA Breach** | Any claim where `acknowledged_at > sla_deadline`, where `sla_deadline = created_at + SLA_WINDOW_SECONDS` (default: 7200). If `acknowledged_at` is null because the claim did not reach `ACKNOWLEDGED` state, it is counted as a breach at the moment `current_utc_time > sla_deadline`. |
| **Routing Error** | A claim assigned to a `routing_target` that does not match the correct adjuster skill group for its `loss_type` and `severity_score`, as confirmed by post-routing audit. Operationally: a CRM transfer initiated by an adjuster within 24 hours of initial assignment is treated as a routing error. |
| **FNOL** | First Notice of Loss. The initial report submitted by a claimant or their representative immediately following an insured loss event. Not a coverage determination; not a proof of loss. |
| **Acknowledgement** | A system-generated notification to the claimant confirming that: (a) their claim has been received, (b) their policy has been validated as active and in-scope, and (c) their claim has been assigned to an adjuster. Acknowledgement is not a coverage determination, approval, or promise of payment. |
| **Policy Active** | `policy.status = ACTIVE` **AND** `claim.date_of_loss >= policy.policy_start_date` **AND** `claim.date_of_loss <= policy.policy_end_date`. All three conditions must be true simultaneously. A policy with `status = ACTIVE` but a `date_of_loss` outside the effective window is not considered active for that claim. |
| **Human Specialist** | A licensed claims adjuster or senior claims examiner with authority to override agent routing, confirm or reverse `INVALID` determinations, and resolve `ESCALATED` claims. Not a general support agent. Not a supervisor unless designated. |
| **Extraction Confidence** | A `0.000–1.000` score produced by the NLP extraction step at triage, representing the agent's certainty that each extracted field (`severity_score`, `claim_value`, `loss_type`, `date_of_loss`, `policy_id`) is accurate. Computed as the mean confidence across all five fields. A score of `0.91` means the NLP model is 91% confident across all extracted fields collectively. Below `EXTRACTION_CONFIDENCE_THRESHOLD` (default: `0.75`), the agent must not proceed autonomously. |
| **Duplicate Claim** | A new payload where an existing `claim` record with identical `policy_id`, `date_of_loss`, and `loss_type` is already present in the system at state `TRIAGED` or later. A claim that was `WITHDRAWN` or `RETURNED` is excluded from duplicate matching. |
| **Severity Score** | An integer 1–10 produced by NLP extraction from the raw payload. The scale is: 1–3 = minor damage/inconvenience; 4–6 = moderate loss with repair required; 7–8 = significant loss requiring replacement; 9–10 = total loss or life-safety impact. The NLP model maps textual descriptors to this scale. |

---

### 1.3 Success Metrics

Each metric is independently testable, maps to a specific system field or timestamp delta, and has a defined measurement method.

| ID | Metric | Target | Measurement Method | Failure Signal |
|---|---|---|---|---|
| SM-01 | End-to-end SLA compliance | p95 latency < 7,200s | `acknowledged_at - created_at` per claim; report daily p50, p95, p99 | p95 > 7,200s on any rolling 7-day window |
| SM-02 | Routing accuracy on first assignment | > 98% correct | Post-routing audit: flag any CRM adjuster transfer within 24h of initial assignment as a routing error; `(total_claims - transfer_count) / total_claims` | Routing error rate > 2% on any 7-day rolling window |
| SM-03 | SLA breach rate | < 2% of daily volume | `COUNT(claims WHERE acknowledged_at > sla_deadline OR acknowledged_at IS NULL AND CURRENT_TIME > sla_deadline) / COUNT(all_claims_that_day)` | Breach rate > 2% on any single day |
| SM-04 | SOAP resolution rate (no escalation) | > 97% | `COUNT(claims reaching VALIDATED without ESCALATED) / COUNT(all_claims)` | Rate < 97% on any 7-day rolling window |
| SM-05 | Human escalation rate (non-SOAP) | < 8% of daily volume | `COUNT(claims routed to HUMAN_REVIEW for reasons other than SOAP_EXHAUSTED) / COUNT(all_claims)` | Rate > 8% on any 7-day rolling window |
| SM-06 | Extraction confidence pass rate | > 92% | `COUNT(claims with extraction_confidence >= 0.75) / COUNT(all_claims)` | Rate < 92% on any 7-day rolling window |
| SM-07 | Duplicate suppression accuracy | 0 duplicates reaching ROUTED | `COUNT(claims in ROUTED state matching a prior claim on policy_id + date_of_loss + loss_type)` | Any non-zero count |
| SM-08 | Zero premature acknowledgements | 0 | `COUNT(claims where acknowledged_at IS NOT NULL AND (validation_status != 'VALID' OR status != 'ROUTED'))` | Any non-zero count |
| SM-09 | Agent reasoning completeness | 100% of TRIAGED claims | `COUNT(TRIAGED claims where agent_reasoning IS NULL OR agent_reasoning = '')` | Any non-zero count |
| SM-10 | PII exposure in logs | 0 incidents | Automated log scanner: flag any log line containing claimant_name, address, raw phone numbers, or full policy details | Any flagged log line |

---

## Deliverable 2: Delegation Matrix

### 2.1 Delegation Matrix

| Function | Level | Agent Actions | Human Actions | Escalation Trigger |
|---|---|---|---|---|
| **Payload Ingestion & Dedup** | Agent Alone | Upload to DMS, query duplicate index, create `claim` record, set `sla_deadline`, write `raw_payload_url` | None (normal path) | Duplicate detected; DMS upload fails |
| **NLP Triage & Field Extraction** | Agent Alone | Extract `severity_score`, `claim_value`, `loss_type`, `date_of_loss`, `policy_id`; compute `extraction_confidence`; write `agent_reasoning` | None (normal path) | `extraction_confidence < EXTRACTION_CONFIDENCE_THRESHOLD` |
| **Policy Validation (SOAP)** | Agent + Human Oversight | Query `GetPolicyDetails`; evaluate Rules 4.1–4.5; set `validation_status`; write `policy_snapshot` | Confirm `INVALID` determinations; resolve `ESCALATED` claims | SOAP exhaustion; `PolicyNotFound`; any `INVALID` outcome |
| **Routing Decision** | Agent + Human Oversight | Apply routing rules; select `routing_target`; update CRM via PATCH; write `assigned_specialist_id` | Override `routing_target`; manually route `HUMAN_REVIEW` claims; assign specialist for high-priority claims | High-value/severity trigger; `INVALID` policy; CRM failure; `loss_type = OTHER` |
| **Claimant Acknowledgement** | Agent Alone | Notify claimant; set `acknowledged_at` | None | Any condition preventing `VALID + ROUTED` confirmation |
| **Escalation Resolution** | Human Only | None | Resolve `ESCALATED` claims; confirm or reverse `INVALID`; override routing; update CRM manually | — |

**Delegation Levels defined:**
- **Agent Alone:** Agent executes without human approval; outcome is logged for audit but not pended for review.
- **Agent + Human Oversight:** Agent executes and writes output; any exception or Redline condition blocks the pipeline and routes to a human specialist. Agent output for this function is always auditable and reversible.
- **Human Only:** The agent produces no output for this function. It provides context (claim_id, sla_deadline, human_review_reason) to the specialist queue and waits.

---

### 2.2 Redline Conditions

The **Redline** is the exact set of conditions at which the agent must immediately halt autonomous pipeline progression, write a populated `human_review_reason`, route to the appropriate exception queue, and synchronously notify the human specialist queue. The agent must not proceed past any Redline condition without an explicit human action.

| ID | Condition | Exact Check | Agent Action | Human Required Action |
|---|---|---|---|---|
| RL-01 | Low extraction confidence | `extraction_confidence < EXTRACTION_CONFIDENCE_THRESHOLD` | Set `routing_target = HUMAN_REVIEW`; populate `human_review_reason = "LOW_EXTRACTION_CONFIDENCE: score={score} below threshold={threshold}"`; do not write extracted fields; notify specialist queue | Manually extract fields; re-submit claim for triage |
| RL-02 | SOAP retry exhaustion | `retry_count >= MAX_SOAP_RETRIES` | Set `status = ESCALATED`; set `routing_target = SOAP_ESCALATION_QUEUE`; populate `human_review_reason = "SOAP_EXHAUSTED: {retry_count} timeouts for policy_id={policy_id}"`; notify specialist queue synchronously | Validate policy manually; update `validation_status` and `policy_snapshot` via admin interface |
| RL-03 | Policy validation failed | `validation_status = INVALID` for any reason | Set `routing_target = HUMAN_REVIEW`; populate `human_review_reason` with the specific failed rule ID and values; do not route to any adjuster queue; notify specialist queue | Confirm or reverse the `INVALID` determination; document decision in `reviewer_notes` |
| RL-04 | High-value or high-severity | `severity_score > HIGH_SEVERITY_THRESHOLD` OR `claim_value > HIGH_VALUE_THRESHOLD_USD` | Set `routing_target = HUMAN_ADJUSTER_HIGH_PRIORITY`; notify priority adjuster queue immediately | Senior adjuster must acknowledge assignment within 30 minutes |
| RL-05 | CRM update failure | CRM PATCH returns 4xx or 5xx on all attempts | Set `routing_target = HUMAN_REVIEW`; populate `human_review_reason = "CRM_UPDATE_FAILED: HTTP {status_code}"`; include intended routing_target in reason; notify specialist queue | Manually update CRM with the intended routing_target |
| RL-06 | Duplicate claim detected | Existing claim found on `(policy_id, date_of_loss, loss_type)` with status not in `{RECEIVED, WITHDRAWN}` | Do not create second claim record; log `DUPLICATE_DETECTED: new_payload matches claim_id={existing_id}`; notify specialist queue | Confirm merge, reject duplicate, or authorize new claim |
| RL-07 | Unclassified loss type | `loss_type = OTHER` | Set `routing_target = HUMAN_REVIEW`; populate `human_review_reason = "UNCLASSIFIED_LOSS_TYPE: loss_type=OTHER requires manual classification"` | Reclassify `loss_type`; re-trigger routing step |
| RL-08 | SLA deadline exceeded | `current_utc_time > sla_deadline` at any pipeline step | Set `routing_target = HUMAN_REVIEW` if not already routed to a higher queue; populate `human_review_reason = "SLA_BREACH: deadline={sla_deadline} exceeded at step={current_status}"`; notify supervisor queue synchronously | Acknowledge breach; expedite claim disposition |
| RL-09 | Payload integrity failure | DMS upload returns non-201; virus scan fails; payload is empty | Halt ingestion; do not create claim record; return structured error to ingestion caller; log `INGESTION_FAILURE: source_type={source_type}, error={error_code}` | Re-submit clean payload |
| RL-10 | SOAP `AuthenticationFailed` | SOAP fault code = `AuthenticationFailed` | Set `routing_target = HUMAN_REVIEW`; notify operations team (not specialist queue); log `SOAP_AUTH_FAILURE: claim_id={claim_id}` (no credentials in log) | Operations team to rotate/verify SOAP credentials; re-trigger validation |

---

## Deliverable 3: Agent Specification (System Design)

### 3.1 Entity Definitions

#### 3.1.1 `claim`

Primary entity. Represents one FNOL submission from ingestion through acknowledgement.

```
claim_id                  UUID              PK; UUIDv4; system-generated at ingestion; immutable
source_type               SOURCE_TYPE       Channel of ingestion; set at creation; immutable
raw_payload_url           VARCHAR(2048)     DMS document URL; write-once at ingestion; immutable
severity_score            SMALLINT          1–10; null until TRIAGED; extracted by NLP
policy_id                 VARCHAR(64)       Extracted by NLP; SOAP query key; null until TRIAGED
claim_value               NUMERIC(12,2)     USD; null until TRIAGED; extracted or estimated by NLP
loss_type                 LOSS_TYPE         null until TRIAGED; extracted by NLP
date_of_loss              DATE              ISO 8601; null until TRIAGED; extracted by NLP
validation_status         VALIDATION_STATUS default PENDING; set to VALID or INVALID at VALIDATED step
routing_target            ROUTING_TARGET    null until validation step completes
sla_deadline              TIMESTAMPTZ       created_at + INTERVAL SLA_WINDOW_SECONDS; computed at creation
status                    CLAIM_STATUS      State machine position; default RECEIVED
policy_snapshot           JSONB             Write-once; copy of SOAP response at validation time; null until VALIDATED
agent_reasoning           TEXT              Write-once; NLP extraction rationale; null until TRIAGED
extraction_confidence     NUMERIC(4,3)      0.000–1.000; null until TRIAGED; computed by NLP step
retry_count               SMALLINT          SOAP retry counter; default 0; ceiling: MAX_SOAP_RETRIES
assigned_specialist_id    VARCHAR(64)       CRM adjuster ID; null until ROUTED; from CRM PATCH response
human_review_reason       TEXT              Required when routing_target IN (HUMAN_REVIEW, SOAP_ESCALATION_QUEUE)
acknowledged_at           TIMESTAMPTZ       System-set after VALID + ROUTED confirmed; null until then
created_at                TIMESTAMPTZ       System-set at ingestion; immutable; never client-supplied
updated_at                TIMESTAMPTZ       System-set on every write; never client-supplied
```

**Constraints:**
- `claim_id` must be unique across all records.
- `agent_reasoning`, `raw_payload_url`, `policy_snapshot` are write-once; any update attempt must be rejected with a constraint violation, not silently ignored.
- `acknowledged_at` may not be set unless `validation_status = VALID` AND `status = ROUTED`.
- `human_review_reason` must be non-null and non-empty whenever `routing_target IN (HUMAN_REVIEW, SOAP_ESCALATION_QUEUE)`.

---

**Enum: `SOURCE_TYPE`**
```
EMAIL    -- Parsed from structured email; sender address and subject extracted
PHONE    -- Transcribed from call recording or IVR transcript
WEB      -- Submitted via web form; semi-structured JSON input expected
```

**Enum: `LOSS_TYPE`**
```
AUTO         -- Motor vehicle loss (collision, theft, weather damage)
PROPERTY     -- Residential or commercial property damage
LIABILITY    -- Third-party liability claim
MEDICAL      -- Personal injury / medical payments claim
OTHER        -- Unclassified; always routes to HUMAN_REVIEW
```

**Enum: `VALIDATION_STATUS`**
```
PENDING    -- Default at claim creation; no SOAP query completed yet
VALID      -- All Rules 4.1–4.5 passed; claim is eligible for adjuster routing
INVALID    -- One or more coverage rules failed; requires human confirmation before final determination
```

**Enum: `ROUTING_TARGET`**
```
AUTO_ADJUSTER_STANDARD               -- Standard AUTO loss; claim_value <= 10000 AND severity_score <= 7
AUTO_ADJUSTER_HIGH_PRIORITY          -- HIGH-VALUE AUTO loss
PROPERTY_ADJUSTER_STANDARD           -- Standard PROPERTY loss
PROPERTY_ADJUSTER_HIGH_PRIORITY      -- HIGH-VALUE PROPERTY loss
LIABILITY_ADJUSTER_STANDARD          -- Standard LIABILITY loss
LIABILITY_ADJUSTER_HIGH_PRIORITY     -- HIGH-VALUE LIABILITY loss
MEDICAL_ADJUSTER_STANDARD            -- Standard MEDICAL loss
MEDICAL_ADJUSTER_HIGH_PRIORITY       -- HIGH-VALUE MEDICAL loss
HUMAN_ADJUSTER_HIGH_PRIORITY         -- High-value/severity; any loss_type; mandatory escalation
HUMAN_REVIEW                         -- INVALID policy, low confidence, CRM failure, unclassified loss_type
SOAP_ESCALATION_QUEUE                -- SOAP retry budget exhausted; policy unvalidated
```

**Enum: `CLAIM_STATUS`**
```
RECEIVED       -- Payload ingested; claim record created; sla_deadline set
TRIAGED        -- NLP extraction complete; agent_reasoning written
VALIDATED      -- SOAP query complete; policy_snapshot written; validation_status set
ROUTED         -- routing_target set; CRM updated; assigned_specialist_id written
ACKNOWLEDGED   -- Claimant notified; acknowledged_at set
ESCALATED      -- SOAP retry budget exhausted; requires human specialist resolution
```

---

#### 3.1.2 `policy` (SOAP Response Snapshot)

Not stored as a standalone table. Persisted exclusively as a JSONB snapshot in `claim.policy_snapshot` at validation time. The snapshot is write-once and immutable.

```json
{
  "policy_id":           "string — matches claim.policy_id",
  "status":              "ACTIVE | LAPSED | CANCELLED | PENDING",
  "coverage_limit":      "decimal — USD; maximum covered claim value",
  "policy_start_date":   "string — ISO 8601 date (YYYY-MM-DD)",
  "policy_end_date":     "string — ISO 8601 date (YYYY-MM-DD)",
  "covered_loss_types":  ["AUTO", "PROPERTY", ...],
  "soap_retrieved_at":   "string — ISO 8601 datetime UTC; when the SOAP call returned"
}
```

**Enum: `POLICY_STATUS`**
```
ACTIVE      -- Policy is in force; coverage is current
LAPSED      -- Policy expired without renewal; claims against it are INVALID
CANCELLED   -- Policy terminated mid-term; claims against it are INVALID
PENDING     -- Policy issued but not yet effective; claims against it are INVALID
```

**Validation Notes:**
- Only `ACTIVE` policies satisfy Rule 4.2. All other `POLICY_STATUS` values result in `validation_status = INVALID`.
- `soap_retrieved_at` is system-set at snapshot write time and is used to detect stale snapshots in any re-evaluation workflow.

---

#### 3.1.3 `adjuster`

Not stored locally. Retrieved from CRM during the routing step to confirm the target specialist is active and under workload cap. The sole field written to the claim record is `assigned_specialist_id`.

```
specialist_id             VARCHAR(64)     CRM identifier; written to claim.assigned_specialist_id on ROUTED
full_name                 VARCHAR(256)    Used in audit log entries only; excluded from all aggregated logs
skill_group               ROUTING_TARGET  The queue this adjuster belongs to in CRM
active                    BOOLEAN         Agent must not assign to an adjuster where active = false
current_load              INTEGER         Open claim count; sourced from CRM response
max_load                  INTEGER         Agent must not assign if current_load >= max_load
licensed_jurisdictions    VARCHAR[]       ISO 3166-2 codes; agent must verify jurisdiction match before assignment
```

**Assignment Rules:**
- Agent queries CRM for available adjusters in the target `skill_group`.
- Agent selects the adjuster with the lowest `current_load` that is `active = true` and `current_load < max_load`.
- If no eligible adjuster is available in the target `skill_group`, agent sets `routing_target = HUMAN_ADJUSTER_HIGH_PRIORITY` and notifies the supervisor queue.
- Jurisdiction match is required: the adjuster's `licensed_jurisdictions` must include the jurisdiction inferred from the claim's originating address or policy metadata.

---

### 3.2 State Machine

#### State Transition Table

| From | To | Trigger | Pre-Conditions | Agent Actions | Definition of Done |
|---|---|---|---|---|---|
| — | `RECEIVED` | Payload arrives at ingestion endpoint | DMS upload returns 201; no duplicate detected on `(policy_id, date_of_loss, loss_type)`; payload passes integrity check | Create claim record; compute `sla_deadline`; write `raw_payload_url`; set `status = RECEIVED` | `claim_id` non-null; `created_at` set; `raw_payload_url` non-null; `sla_deadline` computed and non-null; `status = RECEIVED` |
| `RECEIVED` | `TRIAGED` | Agent completes NLP extraction above confidence threshold | `extraction_confidence >= EXTRACTION_CONFIDENCE_THRESHOLD` | Write `severity_score`, `claim_value`, `loss_type`, `date_of_loss`, `policy_id`, `agent_reasoning`, `extraction_confidence`; set `status = TRIAGED` | All five extracted fields non-null; `agent_reasoning` written; `extraction_confidence` recorded; all fields written atomically (all-or-nothing) |
| `RECEIVED` | Blocked at `TRIAGED` | `extraction_confidence < EXTRACTION_CONFIDENCE_THRESHOLD` | — | Set `routing_target = HUMAN_REVIEW`; write `human_review_reason`; notify specialist queue; set `status = TRIAGED` | `routing_target = HUMAN_REVIEW`; `human_review_reason` non-null; specialist queue notified; no NLP fields written |
| `TRIAGED` | `VALIDATED` | SOAP `GetPolicyDetails` returns successfully | SOAP response received within `MAX_SOAP_RETRIES` attempts | Evaluate Rules 4.2–4.5; set `validation_status`; write `policy_snapshot`; set `status = VALIDATED` | `policy_snapshot` non-null; `validation_status` in {VALID, INVALID}; all five rules evaluated and logged |
| `TRIAGED` | `ESCALATED` | `retry_count >= MAX_SOAP_RETRIES` | — | Set `status = ESCALATED`; set `routing_target = SOAP_ESCALATION_QUEUE`; write `human_review_reason`; notify specialist queue synchronously | `status = ESCALATED`; `routing_target = SOAP_ESCALATION_QUEUE`; specialist queue notified; `human_review_reason` non-null |
| `VALIDATED` | `ROUTED` | `validation_status = VALID`; routing rules applied; CRM PATCH returns 200 | No Redline conditions active | Set `routing_target`; send `PATCH /claims/{claim_id}` to CRM; write `assigned_specialist_id` from CRM response; set `status = ROUTED` | `routing_target` non-null; CRM confirmed 200; `assigned_specialist_id` non-null; `status = ROUTED` |
| `VALIDATED` | Blocked at `VALIDATED` | `validation_status = INVALID` | — | Set `routing_target = HUMAN_REVIEW`; write `human_review_reason`; notify specialist queue; do not advance `status` | `routing_target = HUMAN_REVIEW`; `human_review_reason` cites specific failed rule; no adjuster assigned |
| `ROUTED` | `ACKNOWLEDGED` | `validation_status = VALID` AND `status = ROUTED` confirmed | `routing_target` non-null; `assigned_specialist_id` non-null | Notify claimant via notification service; set `acknowledged_at = current_utc_time`; set `status = ACKNOWLEDGED` | `acknowledged_at` non-null; `acknowledged_at <= sla_deadline`; claimant notification sent and confirmed |

---

### 3.3 Integration Contracts

#### 3.3.1 CRM — REST API

**Endpoint:** `PATCH {CRM_BASE_URL}/claims/{claim_id}`
**Auth:** `Authorization: Bearer {CRM_API_TOKEN}`
**Content-Type:** `application/json`
**Timeout per attempt:** `CRM_REQUEST_TIMEOUT_SECONDS` (default: 10)

**Request Body:**
```json
{
  "claim_id":                "string (UUID)",
  "routing_target":          "string (ROUTING_TARGET enum value)",
  "assigned_specialist_id":  "string | null",
  "status":                  "ROUTED",
  "sla_deadline":            "string (ISO 8601 datetime with UTC offset)"
}
```

**Success Response: `200 OK`**
```json
{
  "claim_id":                "string (UUID)",
  "assigned_specialist_id":  "string",
  "updated_at":              "string (ISO 8601 datetime)"
}
```

Agent writes `assigned_specialist_id` from response body to `claim.assigned_specialist_id`. If `assigned_specialist_id` is absent from the response, agent sets `routing_target = HUMAN_REVIEW` with `human_review_reason = "CRM_RESPONSE_MISSING_SPECIALIST_ID"`.

**Failure Handling:**

| HTTP Status | Retry | Agent Action |
|---|---|---|
| `400 Bad Request` | No | Log `claim_id` + `400`; set `routing_target = HUMAN_REVIEW`; `human_review_reason = "CRM_UPDATE_FAILED: HTTP 400 — malformed payload"`; notify specialist queue |
| `401 Unauthorized` | No | Log `claim_id` + `401`; notify operations team; set `routing_target = HUMAN_REVIEW`; `human_review_reason = "CRM_UPDATE_FAILED: HTTP 401 — auth failure"` |
| `404 Not Found` | No | Log `claim_id` + `404`; set `routing_target = HUMAN_REVIEW`; `human_review_reason = "CRM_UPDATE_FAILED: HTTP 404 — claim_id not found in CRM"` |
| `429 Rate Limited` | Yes — wait `Retry-After` header value, then retry once | If second attempt fails, set `routing_target = HUMAN_REVIEW`; `human_review_reason = "CRM_UPDATE_FAILED: HTTP 429 after retry"` |
| `500 Internal Server Error` | Yes — wait `CRM_RETRY_BACKOFF_SECONDS`, then retry once | If second attempt fails, set `routing_target = HUMAN_REVIEW`; `human_review_reason = "CRM_UPDATE_FAILED: HTTP 500 after retry"`; include intended `routing_target` in reason |
| Connection timeout | Treat as 500 | Same retry-then-escalate behavior |

---

#### 3.3.2 Policy System — SOAP

**Operation:** `GetPolicyDetails`
**WSDL:** `{SOAP_WSDL_URL}`
**Auth:** HTTP Basic — `SOAP_USERNAME` / `SOAP_PASSWORD`
**Timeout per attempt:** `SOAP_REQUEST_TIMEOUT_SECONDS` (default: 8)

**Request Envelope:**
```xml
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:pol="http://legacy.insurer.internal/policy">
  <soapenv:Body>
    <pol:GetPolicyDetails>
      <pol:PolicyId>{policy_id}</pol:PolicyId>
    </pol:GetPolicyDetails>
  </soapenv:Body>
</soapenv:Envelope>
```

**Success Response — Fields Consumed:**
```xml
<PolicyId>string</PolicyId>
<Status>ACTIVE | LAPSED | CANCELLED | PENDING</Status>
<CoverageLimit>decimal</CoverageLimit>
<PolicyStartDate>YYYY-MM-DD</PolicyStartDate>
<PolicyEndDate>YYYY-MM-DD</PolicyEndDate>
<CoveredLossTypes>
  <LossType>AUTO | PROPERTY | LIABILITY | MEDICAL | OTHER</LossType>
</CoveredLossTypes>
```

**Retry Algorithm (pseudocode):**
```python
retry_count = 0

while retry_count < MAX_SOAP_RETRIES:
    response = soap_client.call(
        operation="GetPolicyDetails",
        policy_id=claim.policy_id,
        timeout=SOAP_REQUEST_TIMEOUT_SECONDS
    )

    if response.success:
        write_policy_snapshot(claim, response)   # write-once
        evaluate_validation_rules(claim)
        break

    if response.fault_code == "PolicyNotFound":
        # Not a transient error; do not retry
        claim.validation_status = INVALID
        claim.human_review_reason = f"POLICY_NOT_FOUND: policy_id={claim.policy_id}"
        claim.routing_target = HUMAN_REVIEW
        notify_specialist_queue(claim.claim_id)
        break

    if response.fault_code == "AuthenticationFailed":
        # Credential issue; retrying will not help
        claim.routing_target = HUMAN_REVIEW
        claim.human_review_reason = f"SOAP_AUTH_FAILURE: claim_id={claim.claim_id}"
        notify_operations_team(claim.claim_id)   # not specialist queue
        break

    # Transient error (timeout, ServiceUnavailable, malformed response)
    retry_count += 1
    claim.retry_count = retry_count

    if retry_count >= MAX_SOAP_RETRIES:
        claim.status = ESCALATED
        claim.routing_target = SOAP_ESCALATION_QUEUE
        claim.human_review_reason = f"SOAP_EXHAUSTED: {retry_count} failures for policy_id={claim.policy_id}"
        notify_specialist_queue(claim.claim_id)  # synchronous
        break

    backoff_seconds = SOAP_RETRY_BACKOFF_SECONDS * (retry_count ** 2)
    wait(backoff_seconds)
```

**Backoff Schedule (with defaults `MAX_SOAP_RETRIES=3`, `SOAP_RETRY_BACKOFF_SECONDS=2`):**

| Attempt | Wait Before Next Attempt |
|---|---|
| 1 fails | `2 * (1^2)` = 2 seconds |
| 2 fails | `2 * (2^2)` = 8 seconds |
| 3 fails | Escalate — no further wait |

**Total time before escalation:** ~26 seconds (8s × 3 timeouts + 10s backoff). This is within the 7,200s SLA window.

---

#### 3.3.3 Document Management System (DMS)

**Upload (at ingestion):**
- **Endpoint:** `POST {DMS_BASE_URL}/documents`
- **Auth:** `Authorization: Bearer {DMS_API_TOKEN}`
- **Content-Type:** `multipart/form-data`
- **Body fields:**
  - `file`: raw payload (email body, phone transcript text, or web form submission)
  - `metadata`: `{ "source_type": "EMAIL|PHONE|WEB", "ingested_at": "<ISO 8601 UTC>" }`
  - Note: `claim_id` is NOT included — the claim record does not yet exist at upload time
- **Success:** `201 Created` → extract `document_url` from response body → write to `claim.raw_payload_url` (write-once)
- **Failure:** Halt ingestion; do not create claim record; return structured error to ingestion caller: `{ "error": "DMS_UPLOAD_FAILED", "status_code": N, "source_type": "...", "received_at": "<ISO 8601>" }`

**Retrieval (human reviewers only):**
- **Endpoint:** `GET {DMS_BASE_URL}/documents/{document_id}`
- **Auth:** Same bearer token
- The agent does not call this endpoint after ingestion. `raw_payload_url` is stored for human review access only. The agent operates exclusively on extracted fields written to the `claim` record.

---

## Deliverable 4: Validation Design (The Anti-Hallucination Layer)

### 4.1 Happy Path — End-to-End Trace

**Scenario:**
- Channel: email
- Loss type: AUTO
- Claim value: $4,500
- Severity score: 5
- Policy: ACTIVE; coverage_limit = $50,000; covers AUTO; effective 2026-01-01 to 2026-12-31
- Date of loss: 2026-04-20
- Ingestion time: 09:00:00 UTC

| Timestamp (UTC) | Step | Agent Action | Resulting State |
|---|---|---|---|
| 09:00:00 | Email arrives at ingestion endpoint | — | — |
| 09:00:01 | DMS upload | Agent sends `POST /documents` with raw email; DMS returns `201` with `document_url="dms://docs/abc123"` | — |
| 09:00:01 | Claim creation | Agent creates claim: `status=RECEIVED`, `source_type=EMAIL`, `raw_payload_url="dms://docs/abc123"`, `sla_deadline=11:00:00 UTC` | `RECEIVED` |
| 09:00:01 | Duplicate check | Agent queries: no match on `(policy_id=null, date_of_loss=null, loss_type=null)` — fields not yet extracted; check deferred to post-TRIAGED step | — |
| 09:00:02 | NLP extraction | Agent extracts: `severity_score=5`, `claim_value=4500.00`, `loss_type=AUTO`, `date_of_loss=2026-04-20`, `policy_id="POL-12345"`, `extraction_confidence=0.91` | — |
| 09:00:02 | Duplicate check (post-extraction) | Agent queries: no existing claim on `(POL-12345, 2026-04-20, AUTO)` | — |
| 09:00:02 | Write triage output | Agent writes `agent_reasoning` (write-once); sets `status=TRIAGED` | `TRIAGED` |
| 09:00:02 | SOAP query initiated | Agent sends `GetPolicyDetails(PolicyId="POL-12345")` | — |
| 09:00:03 | SOAP response received | Agent receives policy: `status=ACTIVE`, `coverage_limit=50000`, `start=2026-01-01`, `end=2026-12-31`, `covered=[AUTO, PROPERTY]` | — |
| 09:00:03 | Rule 4.1 evaluation | `severity_score=5 <= 7` AND `claim_value=4500 <= 10000` → high-priority rule does NOT trigger | — |
| 09:00:03 | Rule 4.2 evaluation | `policy.status=ACTIVE` → pass | — |
| 09:00:03 | Rule 4.3 evaluation | `date_of_loss=2026-04-20` is within `[2026-01-01, 2026-12-31]` → pass | — |
| 09:00:03 | Rule 4.4 evaluation | `claim_value=4500 < coverage_limit=50000` → pass | — |
| 09:00:03 | Rule 4.5 evaluation | `loss_type=AUTO` IN `[AUTO, PROPERTY]` → pass | — |
| 09:00:03 | Write validation output | Agent sets `validation_status=VALID`; writes `policy_snapshot` (write-once); sets `status=VALIDATED` | `VALIDATED` |
| 09:00:03 | Routing decision | All rules passed; `severity_score=5 <= 7`, `claim_value=4500 <= 10000` → standard routing; `loss_type=AUTO` → `routing_target=AUTO_ADJUSTER_STANDARD` | — |
| 09:00:04 | CRM update | Agent sends `PATCH /claims/{claim_id}` with `routing_target=AUTO_ADJUSTER_STANDARD`, `status=ROUTED`, `sla_deadline=11:00:00 UTC` | — |
| 09:00:04 | CRM response | CRM returns `200 OK` with `assigned_specialist_id="ADJ-9981"` | — |
| 09:00:04 | Write routing output | Agent writes `assigned_specialist_id="ADJ-9981"`; sets `status=ROUTED` | `ROUTED` |
| 09:00:05 | Acknowledgement gate | Check: `validation_status=VALID` ✓ AND `status=ROUTED` ✓ AND `routing_target` non-null ✓ → gate passes | — |
| 09:00:05 | Claimant notification | Agent notifies claimant via notification service; sets `acknowledged_at=09:00:05 UTC`; sets `status=ACKNOWLEDGED` | `ACKNOWLEDGED` |
| **Outcome** | `acknowledged_at=09:00:05` vs `sla_deadline=11:00:00` | **SLA met. Delta: 5 seconds. ✓** | |

---

### 4.2 Edge Cases

#### EC-01: Policy Expired 1 Day Before Loss

**Setup:** `policy.policy_end_date = 2026-04-19`; `claim.date_of_loss = 2026-04-20`

| Step | Agent Action | Value Written |
|---|---|---|
| SOAP query | Agent receives `status=ACTIVE`, `policy_end_date=2026-04-19` | `policy_snapshot` written (write-once) |
| Rule 4.2 | `policy.status=ACTIVE` → pass | — |
| Rule 4.3 | `date_of_loss=2026-04-20 > policy_end_date=2026-04-19` → **VIOLATION** | — |
| Rule 4.3 action | Set `validation_status=INVALID`; set `routing_target=HUMAN_REVIEW`; set `human_review_reason="COVERAGE_DATE_VIOLATION: date_of_loss=2026-04-20 exceeds policy_end_date=2026-04-19 for policy_id=POL-XXXXX"` | `validation_status=INVALID` |
| Halt | Agent does NOT set `status=ROUTED`; does NOT notify claimant | `status=VALIDATED` (blocked) |
| Notify | Agent notifies specialist queue with `claim_id` and `human_review_reason` | Specialist queue receives event |
| **Outcome** | Claim blocked at `VALIDATED`; `routing_target=HUMAN_REVIEW`; no premature acknowledgement; `human_review_reason` cites exact date boundary ✓ | |

**Important:** The agent sets `validation_status=INVALID` as a flag — it does not finalize the claim as rejected. The human specialist must confirm or reverse the determination. A 1-day expiry discrepancy may involve a retroactive renewal; the agent must not foreclose that resolution path.

---

#### EC-02: Incomplete Claim Data (Low Extraction Confidence)

**Setup:** Phone transcript is partially inaudible. NLP extracts `severity_score=null`, `loss_type=null`. `extraction_confidence=0.61`.

| Step | Agent Action | Value Written |
|---|---|---|
| NLP extraction | Agent computes `extraction_confidence=0.61` | — |
| Threshold check | `0.61 < EXTRACTION_CONFIDENCE_THRESHOLD (0.75)` → Redline RL-01 triggered | — |
| RL-01 action | Set `routing_target=HUMAN_REVIEW`; set `human_review_reason="LOW_EXTRACTION_CONFIDENCE: score=0.61 below threshold=0.75; null fields: severity_score, loss_type"` | `routing_target=HUMAN_REVIEW` |
| RL-01 action | Do NOT write `agent_reasoning`; do NOT write any extracted fields (they are unreliable) | No NLP fields written |
| RL-01 action | Set `status=TRIAGED` | `status=TRIAGED` (blocked) |
| Notify | Agent notifies specialist queue; includes `claim_id`, `raw_payload_url`, `sla_deadline` | Specialist queue receives event |
| **Outcome** | No SOAP query attempted; no policy snapshot; no adjuster assigned; specialist receives `raw_payload_url` for manual extraction; `sla_deadline` is visible so specialist can prioritize ✓ | |

---

#### EC-03: Duplicate Claim Detection

**Setup:** New payload arrives at 10:30:00 UTC. Existing claim `ORIG-001` has `policy_id="POL-12345"`, `date_of_loss=2026-04-20`, `loss_type=AUTO`, and `status=ROUTED`.

| Step | Agent Action | Value Written |
|---|---|---|
| Ingestion | New payload uploaded to DMS successfully; `document_url` returned | — |
| Dedup query (post-extraction) | Agent extracts `policy_id="POL-12345"`, `date_of_loss=2026-04-20`, `loss_type=AUTO`; queries: `SELECT claim_id FROM claim WHERE policy_id='POL-12345' AND date_of_loss='2026-04-20' AND loss_type='AUTO' AND status NOT IN ('RECEIVED', 'WITHDRAWN')` | Match found: `ORIG-001` |
| Duplicate detected | Agent does NOT create a new claim record | No claim record written |
| Log | Agent logs: `DUPLICATE_DETECTED: incoming_payload matches claim_id=ORIG-001` (no claimant PII in log) | Log entry |
| Notify | Agent notifies specialist queue: `"DUPLICATE_CLAIM: incoming payload references claim_id=ORIG-001 which is already in ROUTED state"` | Specialist queue event |
| Return | Agent returns structured error to ingestion caller: `{ "error": "DUPLICATE_DETECTED", "existing_claim_id": "ORIG-001", "status": "ROUTED" }` | Error response |
| **Outcome** | No second claim record created; `ORIG-001` unaffected; specialist decides whether to merge, reject, or authorize a new claim ✓ | |

---

### 4.3 Failure Modes

#### FM-01: SOAP Endpoint Timeout (All 3 Attempts)

**Setup:** `MAX_SOAP_RETRIES=3`, `SOAP_REQUEST_TIMEOUT_SECONDS=8`, `SOAP_RETRY_BACKOFF_SECONDS=2`

| Event | Timestamp Offset | Agent Action |
|---|---|---|
| Attempt 1 initiated | t=0s | `GetPolicyDetails` query sent |
| Attempt 1 timeout | t=8s | Timeout; `retry_count=1`; calculate backoff: `2 * (1^2) = 2s` |
| Wait | t=8–10s | Agent waits 2 seconds |
| Attempt 2 initiated | t=10s | `GetPolicyDetails` query sent |
| Attempt 2 timeout | t=18s | Timeout; `retry_count=2`; calculate backoff: `2 * (2^2) = 8s` |
| Wait | t=18–26s | Agent waits 8 seconds |
| Attempt 3 initiated | t=26s | `GetPolicyDetails` query sent |
| Attempt 3 timeout | t=34s | Timeout; `retry_count=3`; `retry_count >= MAX_SOAP_RETRIES` |
| Redline RL-02 triggered | t=34s | Set `status=ESCALATED`; set `routing_target=SOAP_ESCALATION_QUEUE` |
| — | t=34s | Set `human_review_reason="SOAP_EXHAUSTED: 3 timeouts for policy_id={policy_id}"` |
| — | t=34s | Synchronously notify specialist queue with `claim_id`, `sla_deadline`, `human_review_reason` |
| — | t=34s | No 4th SOAP attempt; no `validation_status` set; no adjuster assigned |
| **Outcome** | Claim in `ESCALATED` state 34 seconds after first attempt; 7,166 seconds remain in SLA window for human resolution ✓ | |

---

#### FM-02: NLP Confidence Score Below Threshold

**Setup:** `extraction_confidence=0.68` (below `EXTRACTION_CONFIDENCE_THRESHOLD=0.75`)

The threshold is a binary gate. There are no confidence bands or graduated responses. Any score below the threshold triggers identical behavior regardless of whether the score is `0.74` (just under) or `0.40` (far under).

| Step | Agent Action |
|---|---|
| Confidence computed | `extraction_confidence=0.68` |
| Gate evaluation | `0.68 < 0.75` → threshold not met |
| RL-01 triggered | Set `routing_target=HUMAN_REVIEW`; set `human_review_reason="LOW_EXTRACTION_CONFIDENCE: score=0.68 below threshold=0.75"`; identify null or low-confidence fields and list them in `human_review_reason` |
| Pipeline halted | No SOAP query; no `policy_snapshot`; no `routing_target` other than `HUMAN_REVIEW`; no claimant notification |
| Notification | Specialist queue notified synchronously with `claim_id`, `raw_payload_url`, `sla_deadline` |
| **Outcome** | Claim in `TRIAGED` state; `routing_target=HUMAN_REVIEW`; specialist receives the raw payload URL to perform manual extraction ✓ |

---

#### FM-03: CRM API Returns 500 Internal Server Error

**Setup:** CRM returns `500` on first PATCH attempt.

| Step | Agent Action |
|---|---|
| First PATCH attempt | `PATCH /claims/{claim_id}` → `500 Internal Server Error` |
| Log | `CRM_FAILURE: claim_id={claim_id}, attempt=1, http_status=500` (no PII) |
| Wait | Agent waits `CRM_RETRY_BACKOFF_SECONDS` |
| Second PATCH attempt | `PATCH /claims/{claim_id}` → `500 Internal Server Error` |
| Log | `CRM_FAILURE: claim_id={claim_id}, attempt=2, http_status=500` |
| Redline RL-05 triggered | Set `routing_target=HUMAN_REVIEW` |
| — | Set `human_review_reason="CRM_UPDATE_FAILED: HTTP 500 on both attempts; intended routing_target={intended_target}; claim_id={claim_id}"` |
| — | Note: the intended `routing_target` is embedded in `human_review_reason` so the specialist can manually perform the CRM update with the correct value |
| — | Notify specialist queue synchronously with `claim_id`, intended `routing_target`, `sla_deadline` |
| — | Do NOT set `status=ROUTED`; do NOT send claimant acknowledgement |
| **Outcome** | Claim remains in `VALIDATED` state; specialist can manually PATCH CRM with the intended `routing_target` and then trigger the acknowledgement step ✓ |

---

## Deliverable 5: Assumptions & Validation Plan

| # | Assumption | Risk If False | Validation Question for IT Lead |
|---|---|---|---|
| A-01 | The SOAP `GetPolicyDetails` endpoint is reachable from the agent's runtime network without VPN or IP allowlist requirements that are not already provisioned. | Every claim will exhaust `MAX_SOAP_RETRIES` and `ESCALATED`; the system is functionally non-operational from day one. | "Does `GetPolicyDetails` require the calling system's IP to appear on a firewall allowlist or require VPN tunnel? If so, who owns that allowlist and what is the provisioning lead time?" |
| A-02 | `GetPolicyDetails` has a p95 response time < 8 seconds under the expected query rate (300 queries/day, peak ~60/hour). | SOAP queries will timeout at the `SOAP_REQUEST_TIMEOUT_SECONDS` threshold under normal load; escalation rate will exceed SM-04 target; specialist queue will be overwhelmed. | "What is the observed p95 response time for `GetPolicyDetails` under today's query load? Is there a published SLA for the endpoint? Can you share a 30-day latency histogram?" |
| A-03 | `policy_id` is present and correctly formatted in all three source channel payloads (email, phone transcript, web form) in ≥ 95% of submissions. | NLP extraction will fail to identify the policy key; every such claim routes to `HUMAN_REVIEW` at RL-01; SM-06 extraction confidence pass rate will degrade below target. | "In the last 90 days of raw FNOL submissions, what percentage of phone transcripts and emails contained a readable, correctly formatted policy number? Do you have a sample dataset we can analyze?" |
| A-04 | The CRM `PATCH /claims/{id}` endpoint is part of a versioned, stable API contract; the response body includes `assigned_specialist_id`; and the queue names (e.g., `AUTO_ADJUSTER_STANDARD`) in the payload correspond exactly to valid CRM routing queue identifiers. | Agent will PATCH valid HTTP requests to CRM with invalid queue names → CRM returns 400 → all claims for affected loss types route to `HUMAN_REVIEW`; SM-02 routing accuracy collapses. | "Can you provide the current canonical list of adjuster queue identifiers from the CRM API? Are these stable across CRM releases, or are they subject to change during the project timeline?" |
| A-05 | Labeled historical routing data (≥ 90 days; ≥ 10,000 claims) is available to empirically calibrate `EXTRACTION_CONFIDENCE_THRESHOLD` and validate NLP field extraction accuracy. | The 0.75 default threshold is unvalidated; it may be too aggressive (routing too many claims to HUMAN_REVIEW) or too lenient (passing low-quality extractions through to routing). SM-02 and SM-06 targets cannot be set with confidence. | "Do you have a labeled dataset of historical FNOL submissions with ground-truth values for loss_type, severity_score, claim_value, and date_of_loss? If so, in what format and how many records?" |
| A-06 | The DMS write endpoint supports ≥ 60 concurrent document uploads per hour without degradation, contention, or rate limiting. | Ingestion will fail at peak load; claims will not be created; SLA timers will not start; the morning batch will backlog into the afternoon SLA window. | "Has the DMS been load-tested at 60 concurrent uploads per hour? What is its published write throughput SLA? Is it a shared system with other tenants who could cause write contention?" |
| A-07 | `claim_value` is explicitly stated (in dollar or currency terms) in ≥ 80% of FNOL payloads, making it extractable by NLP rather than requiring estimation from loss description. | The high-value routing rule (Rule 4.1) cannot be reliably applied; high-value claims may reach standard adjuster queues instead of `HUMAN_ADJUSTER_HIGH_PRIORITY`; SM-02 accuracy degrades for this critical segment. | "Of your historical high-value claims (> $10,000), what percentage explicitly stated a claim amount in the original FNOL submission text? Do claimants typically quote a damage estimate at first notice?" |
| A-08 | The SOAP response for `CoveredLossTypes` returns a structured, machine-readable array (e.g., a repeating XML element with controlled vocabulary), not a free-text description field. | Rule 4.5 (loss type coverage) cannot be evaluated programmatically; the agent cannot parse free-text coverage descriptions; every claim will require human validation of coverage eligibility. | "In the WSDL schema, is `CoveredLossTypes` defined as a repeating structured element with an enumerated type, or is it a free-text narrative field? Can you share the WSDL or a sample response?" |
| A-09 | The claimant notification channel used in the `ACKNOWLEDGED` step is a pre-provisioned, documented service (e.g., SMTP relay, SMS gateway, or vendor notification API) with a known contract and < 5s response time. | The `ACKNOWLEDGED` step cannot be completed; `acknowledged_at` cannot be set; end-to-end SLA compliance (SM-01) cannot be measured or guaranteed. | "What outbound notification service should the agent call to send claimant acknowledgement (email, SMS, or in-app)? Is it already provisioned and does it have a documented API contract we can integrate against?" |
| A-10 | Duplicate detection on composite key `(policy_id, date_of_loss, loss_type)` correctly identifies all true duplicates without producing false positives — i.e., a single policy cannot generate two distinct legitimate FNOL claims for the same loss type on the same date. | Legitimate re-submissions (e.g., after a system error or claimant correction) will be suppressed; valid claims will be blocked at ingestion; claimants will experience invisible failures. | "Is there any operational scenario where a single policy legitimately generates two separate FNOL submissions for the same loss type on the same date? If so, what field distinguishes them (e.g., a unique claimant reference number)?" |
| A-11 | The agent runtime environment has stable network connectivity to the SOAP endpoint, CRM, and DMS simultaneously. Partial connectivity failures (e.g., only SOAP is unreachable) are detectable and do not produce silent data corruption. | A partial network failure may cause the agent to proceed through some pipeline steps while failing others, producing claims in inconsistent states (e.g., `ROUTED` in CRM but not in the local claim record). | "Are the SOAP endpoint, CRM, and DMS hosted in the same network zone as the agent runtime? What network monitoring is in place to detect partial connectivity failures? Is there a circuit-breaker or health-check endpoint for each dependency?" |
| A-12 | Peak daily volume does not exceed 3× the 300-claim baseline (i.e., ≤ 900 claims/day) under storm, disaster, or seasonal spike conditions. The agent has no built-in load-shedding or queue management for volumes above this. | Under a major event (e.g., regional storm producing 1,500 claims in one day), SOAP query rates will exceed the endpoint's capacity; CRM PATCH rates will breach rate limits; SLA breach rate will spike above SM-03 target. | "What is the maximum single-day FNOL volume observed in the past 5 years? Does it follow a predictable seasonal pattern? Is there a documented peak-capacity plan (e.g., overflow to a secondary SOAP endpoint or manual intake team)?" |
