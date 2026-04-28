# Loop 1 — Fix Summary

## Fix 1: Missing SLA and Spot-Check Columns in `permit_application` DDL

**What:** Added `target_review_date`, `sla_status`, and `spot_check_required` columns to the `permit_application` table, along with three enforcing constraints (`chk_sla_routine_only`, `chk_target_review_date_routine_only`, `chk_spot_check_pending_requires_flag`).

**Why:** The SLA Performance Rules require a `target_review_date` to be system-set at ROUTINE assignment and a `sla_status` field that a scheduled job writes to every 15 minutes. The Spot Check Audit requires a `spot_check_required` boolean to gate the `SPOT_CHECK_PENDING` transition. Without these columns the entire SLA tracking subsystem and spot-check mechanism were unrepresentable in the schema — any attempt to write to them would fail silently or with a runtime error.

---

## Fix 2: `SPOT_CHECK_PENDING` Missing from `status` CHECK Constraint

**What:** Added `'SPOT_CHECK_PENDING'` to the `status` column CHECK constraint in the `permit_application` DDL.

**Why:** The state machine defines `SPOT_CHECK_PENDING` as a valid lifecycle status for ~5% of ROUTINE approvals. The original CHECK constraint enumerated only ten statuses and excluded it. Any attempt by the system to set `status = 'SPOT_CHECK_PENDING'` would have been rejected at the database layer, making the spot-check flow entirely non-functional despite being correctly described in prose.

---

## Fix 3: Missing Event Types in `audit_log` CHECK Constraint

**What:** Added `SPOT_CHECK_CONFIRMED`, `SPOT_CHECK_OVERRIDE`, `TRIAGE_CATEGORY_OVERRIDE`, `REVIEWER_OVERRODE_DEFICIENCIES`, and `SLA_STATUS_CHANGE` to the `event_type` CHECK constraint on `audit_log`.

**Why:** These event types are referenced throughout §5 (Validation & Failure Modes) and are required by the Complexity Leakage and Triage Accuracy metric queries, which filter on `SPOT_CHECK_OVERRIDE` and `TRIAGE_CATEGORY_OVERRIDE`. The audit log is also the enforcement point for Absolute Constraint 4 (never suppress a deficiency) — `REVIEWER_OVERRODE_DEFICIENCIES` is the only mechanism that makes a reviewer's removal of agent-drafted deficiencies traceable. Without these event types, the CHECK constraint would reject every one of these audit writes, meaning the audit trail would be incomplete and the metrics queries would always return zero regardless of actual events.

---

## Fix 4: State Machine and Transition Table Missing `SPOT_CHECK_PENDING` Flow

**What:** Updated the §2.1 status diagram to include the `SPOT_CHECK_PENDING` node with confirm and override branches. Added transitions T-13 (`UNDER_REVIEW → SPOT_CHECK_PENDING`), T-14 (`SPOT_CHECK_PENDING → APPROVED`), and T-15 (`SPOT_CHECK_PENDING → TRIAGE_PENDING`) to the §2.2 transition table.

**Why:** The original diagram showed `UNDER_REVIEW → APPROVED` as a direct unconditional edge, which contradicts the Spot Check Audit rule that ~5% of ROUTINE approvals must be held for senior examiner review before reaching `APPROVED`. Without T-13/T-14/T-15, implementers had no specified prerequisites, actors, or audit obligations for the spot-check path. T-05 was also corrected to add `spot_check_required = false` as an explicit prerequisite, making the conditional branch machine-readable.

---

## Fix 5: T-04 Prerequisite Missing `ROUTINE_CONFIDENCE_THRESHOLD` and Rule Set Date Check

**What:** Revised T-04 (`TRIAGE_PENDING → UNDER_REVIEW`) to require that if `triage_category = ROUTINE` then `agent_confidence_score >= ROUTINE_CONFIDENCE_THRESHOLD (0.95)`, and to require all applied rule sets satisfy `active = true AND effective_date <= submitted_at AND (sunset_date IS NULL OR sunset_date > submitted_at)`.

**Why:** The Conservative Triage Policy forbids classifying any application as ROUTINE if `agent_confidence_score` is below 0.95, even when all other ROUTINE criteria pass. The original T-04 only checked the 0.80 floor, leaving applications scoring 0.80–0.94 free to enter `UNDER_REVIEW` as ROUTINE — a direct policy violation. The rule set date check addresses Absolute Constraint 5 (never apply a rule set outside its effective date range), which was stated in prose but had no enforcement point in the transition table.

---

## Fix 6: FM-R-01 Incorrect Threshold Reference; Conservative Triage Band Unaddressed

**What:** Corrected FM-R-01 to reference `LOW_CONFIDENCE_GENERAL` (score below 0.80). Added FM-R-03 to explicitly cover the 0.80–0.94 band under the Conservative Triage Policy, specifying the DEFICIENT or COMPLEX_SENIOR fallback and the `LOW_CONFIDENCE_ROUTINE` log reason.

**Why:** FM-R-01 documented only the sub-0.80 case. The confidence band between 0.80 and 0.94 — where an application would otherwise appear to pass ROUTINE criteria — had no documented failure mode. This was the primary Conservative Triage Policy gap: an implementer reading only §5 would correctly handle 0.79 but have no specification for 0.88, and would likely default to routing it as ROUTINE.

---

## Fix 7: Appendix A Missing Four Environment Variables

**What:** Added `ROUTINE_CONFIDENCE_THRESHOLD` (0.95), `SPOT_CHECK_RATE` (0.05), `SLA_AT_RISK_HOURS` (24), and `SLA_BREACH_BUSINESS_DAYS` (2) to the environment variable table.

**Why:** The project documentation requires all configurable thresholds to be environment-variable-driven and not hardcoded. These four variables govern the Conservative Triage Policy, spot-check sampling, and both SLA alert thresholds. Their absence from Appendix A meant they had no canonical default, no documented type, and no description — leaving implementers to embed magic numbers in code with no configuration path.
