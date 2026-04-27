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
