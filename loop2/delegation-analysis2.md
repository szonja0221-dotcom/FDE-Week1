# Delegation Analysis

Source: `critique-pool-OKTeamA-7-111.md` — Section 3: Delegation Boundaries
Version: 2 — Reasoning Added

---

## 3.1 Label Definitions

| Label | Meaning |
|---|---|
| **[Agent Alone]** | Agent executes without any human click required; result is logged but not gated on approval |
| **[Agent + Human Review]** | Agent drafts output; a named human reviewer must read, optionally edit, and explicitly submit before the action is recorded as final |
| **[Human Only]** | Agent has no role; action is initiated, composed, and submitted entirely by a human reviewer in an authenticated session |

**Design principle behind the three tiers:** The label assigned to each action reflects two risk dimensions — *legal consequence* (does this action bind or penalize the applicant?) and *agent reliability* (is the output fully deterministic against objective criteria, or does it require contextual judgment?). Actions that are deterministic and carry no direct legal consequence are safe for autonomous execution. Actions whose outputs are used as the basis for a binding decision, or that are communicated externally, require human confirmation. Actions that constitute the binding decision itself are reserved exclusively for humans.

---

## 3.2 Action Registry with Reasoning

---

### [Agent Alone] Actions

These actions are fully automated. Results are logged and visible to human reviewers but are not gated on human approval before taking effect.

---

**Completeness check at intake**
- **Label:** `[Agent Alone]`
- **What agent drafts:** List of missing/blocking items
- **What human clicks:** —
- **Reasoning:** This is a mechanical match between submitted documents and a known, configurable checklist per `project_type`. The output is binary (present / absent) with no discretion required. No legal consequence flows directly from this check — the result either gates progression to `TRIAGE_PENDING` or routes to `RETURNED_INCOMPLETE`, both of which are reviewed states. Requiring human approval here would introduce latency on every single intake without adding accountability value.

---

**Geocode site address**
- **Label:** `[Agent Alone]`
- **What agent drafts:** GIS lookup result
- **What human clicks:** —
- **Reasoning:** Geocoding is a deterministic lookup against the jurisdictional parcel database. The result is objective (`match_count = 0 / 1 / ≥2`) and the system's response to each outcome is fully specified (block, proceed, or request disambiguation). There is no judgment involved. Human intervention at this step would be redundant — the geocoder either finds a single valid parcel or it does not.

---

**Virus scan attachments**
- **Label:** `[Agent Alone]`
- **What agent drafts:** Scan result per file
- **What human clicks:** —
- **Reasoning:** Antivirus scanning is a binary security gate, not a substantive evaluation. Absolute Constraint 9 requires that all attachments pass integrity checks before the agent begins analysis — this action must therefore execute before any human involvement. Introducing a human approval step before a virus scan would create a window where unscanned files could be accessed, which inverts the security model.

---

**Assign triage category**
- **Label:** `[Agent Alone]`
- **What agent drafts:** `triage_category`, `agent_confidence_score`, `agent_reasoning`
- **What human clicks:** —
- **Reasoning:** Triage classification is driven by objective criteria (valuation thresholds, square footage, document presence, confidence score) defined in configurable rule sets. The agent's output is a *recommendation*, not a decision — `agent_recommendation` is explicitly not `reviewer_decision`. The assigned reviewer sees the triage category and full reasoning during `UNDER_REVIEW` and may override it. The write-once constraint on `agent_reasoning` and `deficiencies` ensures the agent's original output is preserved in the audit trail regardless of any subsequent human override. Autonomy here is safe because the downstream human review step is the actual accountability gate.

---

**Apply rule sets**
- **Label:** `[Agent Alone]`
- **What agent drafts:** List of matched/failed rules per rule set
- **What human clicks:** —
- **Reasoning:** Rule set evaluation is a deterministic pass/fail check per rule per application. Only rule sets satisfying `active = true AND effective_date <= submitted_at AND (sunset_date IS NULL OR sunset_date > submitted_at)` may be applied (Absolute Constraint 5). The output feeds the deficiency list and confidence score — both of which are reviewed before any binding action. Conflict resolution between rule sets is fully specified by the precedence order (LOCAL > STATE > IBC), so no human judgment is needed to select which rule governs.

---

**Assign reviewer to application**
- **Label:** `[Agent Alone]`
- **What agent drafts:** Selection of eligible reviewer based on role, workload, jurisdiction
- **What human clicks:** —
- **Reasoning:** Reviewer assignment is constrained by hard rules: role eligibility for `triage_category`, `active = true`, `current_workload < max_workload`, and valid jurisdiction license. Given these constraints the selection is deterministic. Human approval of the assignment would add no accountability value because the eligibility criteria are exhaustively specified. Absolute Constraint 2 prohibits assigning a synthetic identity, and the FK reference to the `reviewer` table with `employee_id NOT NULL UNIQUE` enforces this at the database layer without requiring a human gate.

---

**Generate audit log entry**
- **Label:** `[Agent Alone]` / `[System]`
- **What agent drafts:** Structured log record
- **What human clicks:** —
- **Reasoning:** Audit logging must be unconditional. Absolute Constraint 10 states that every state transition must be logged and that circumventing the audit trail for any reason is not acceptable. If log writes required human approval, a delayed or unavailable reviewer would create gaps in the audit sequence — exactly what the `server_sequence` monotonic counter is designed to detect. The audit log is append-only and INSERT-only for `app_role`, so no human action can modify or suppress entries after the fact.

---

**Notify supervisor of workload cap breach**
- **Label:** `[Agent Alone]`
- **What agent drafts:** Alert payload
- **What human clicks:** —
- **Reasoning:** Supervisor notification when all eligible reviewers are at capacity is mandated by Absolute Constraint 8 (never escalate silently). The alert is time-sensitive — the application is stalled and cannot proceed until a reviewer is assigned. Requiring human approval to send the notification would create a circular dependency: the supervisor needed to resolve the breach would not be aware of it without the alert.

---

### [Agent + Human Review] Actions

The agent produces a substantive draft. A named human reviewer must read, optionally edit, and explicitly submit before the output becomes final. The agent's draft is visible and editable; the human's submission is the record of action.

---

**Draft deficiency list**
- **Label:** `[Agent + Human Review]`
- **What agent drafts:** Itemized `DeficiencyRecord` list with code citations
- **What human clicks:** Reviewer confirms, adds, removes, or edits deficiencies; submits
- **Reasoning:** Deficiencies have direct legal consequence for the applicant — they determine whether an application is returned and what corrections are required. While the agent must list every deficiency it detects (Absolute Constraint 4), a human reviewer must confirm the list because: (1) the agent may lack contextual knowledge the reviewer holds about the parcel or applicant; (2) some deficiencies may be arguable based on local interpretation of code language; (3) the reviewer bears legal accountability for the kickback notice. Any reviewer removal of agent-drafted deficiencies is logged as `REVIEWER_OVERRODE_DEFICIENCIES` with mandatory non-empty `reviewer_notes`, preserving the audit trail without blocking the human's authority.

---

**Draft kickback notice to applicant**
- **Label:** `[Agent + Human Review]`
- **What agent drafts:** Plain-language notice referencing each deficiency
- **What human clicks:** Reviewer reviews text, signs off, submits
- **Reasoning:** This is an external communication to the applicant that has formal legal standing as a notice of deficiency. The agent produces a draft grounded in the confirmed deficiency list, but the text must be reviewed before transmission because: (1) the applicant will rely on it to prepare a resubmission; (2) errors or ambiguous language could delay resolution or expose the department to challenge; (3) the reviewing staff member's name is legally attached to the kickback record. The human review step is the department's quality gate on its own official communications.

---

**Draft approval recommendation memo**
- **Label:** `[Agent + Human Review]`
- **What agent drafts:** Structured checklist confirming all rules passed
- **What human clicks:** Reviewer reads and confirms before recording decision
- **Reasoning:** This action immediately precedes the `APPROVED` decision. The agent produces a structured checklist confirming that all applied rule sets passed, all documents were present, and no code conflicts were identified. The reviewer must read and confirm this checklist before they are permitted to record `reviewer_decision = APPROVED`. This ensures the reviewer has been explicitly presented with — and has acknowledged — the full basis for approval, preventing rubber-stamp approvals where the reviewer clicks without reading the supporting analysis.

---

### [Human Only] Actions

The agent has no role. The action is initiated, composed, and submitted entirely by a human reviewer operating in a verified, non-expired authenticated session. The session binding (§6.2) cryptographically links the decision to the reviewer's identity.

---

**Record `APPROVED` decision**
- **Label:** `[Human Only]`
- **What human clicks:** Reviewer types notes, clicks Approve in authenticated session
- **Reasoning:** Directly enforced by Absolute Constraint 1: the agent never makes a final permit decision. `reviewer_decision` is set exclusively by a human. The session binding protocol requires a valid, non-expired `auth_session` whose `reviewer_id` matches `assigned_reviewer_id`, and `decided_at` is server-set at the moment of write. This ensures the approval is legally attributable to a specific named individual at a specific verified time, satisfying non-repudiation requirements.

---

**Record `REJECTED` decision**
- **Label:** `[Human Only]`
- **What human clicks:** Reviewer types notes with code citations, clicks Reject in authenticated session
- **Reasoning:** Same basis as APPROVED (Absolute Constraint 1), with the additional requirement that `deficiencies` must contain at least one record citing a specific `code_section` from an applied rule set. A rejection without a code citation would give the applicant no specific standard to remedy and would be legally unchallengeable. The human-only label combined with the mandatory citation requirement ensures every rejection is both attributable to a named person and grounded in specific, auditable code authority.

---

**Record `RETURNED_TO_APPLICANT`**
- **Label:** `[Human Only]`
- **What human clicks:** Reviewer confirms deficiency list, clicks Return
- **Reasoning:** Returning an application resets the intake clock and formally notifies the applicant of deficiencies. This is a legally consequential external action. The reviewer's confirmation is the final check that the deficiency list is complete and correct before the applicant is notified — consistent with Absolute Constraint 3, which requires a named human reviewer to be attached before any application is returned.

---

**Request additional info from applicant**
- **Label:** `[Human Only]`
- **What human clicks:** Reviewer types request, clicks Send
- **Reasoning:** Requests for additional information are a discretionary mid-review action that pause the application in `PENDING_APPLICANT_INFO`. The content of the request — what information is needed and why — requires the reviewer's substantive judgment about what the application is missing, which may go beyond what the agent's rule evaluation can express. The reviewer composes and sends the request directly; `reviewer_notes` documents the specific information required in the audit record.

---

**Confirm applicant withdrawal**
- **Label:** `[Human Only]`
- **What human clicks:** Staff member confirms in authenticated session
- **Reasoning:** Withdrawal is applicant-initiated, but confirmation by staff in an authenticated session protects the applicant's rights. A withdrawal, once confirmed, terminates the application permanently. An agent confirming withdrawal autonomously on the basis of an unverified request — potentially spoofed or submitted in error — could result in a legitimate application being incorrectly closed with no legal recourse. Human confirmation with a session-bound audit entry is the safeguard.

---

**Escalate to senior examiner** *(dual label)*
- **Label:** `[Agent Alone]` (auto) / `[Human Only]` (manual)
- **What agent drafts (auto):** Escalation rationale and risk flags
- **What human clicks (manual):** Reviewer clicks Escalate button
- **Reasoning:** Auto-escalation fires when objective criteria are met: `triage_category = COMPLEX_SENIOR`, `agent_confidence_score < AGENT_CONFIDENCE_THRESHOLD`, or a CRE fallback condition. In these cases the decision to escalate is fully determined by rule — there is nothing for a human to add, and delay would breach Absolute Constraint 8 (never escalate silently). Manual escalation represents a reviewer's discretionary judgment that a case exceeds their authority even if it does not trigger automated thresholds. This requires human initiation because it overrides the agent's triage classification and must be attributable to a named person with a valid session. The dual label preserves both the speed of automated routing and the accountability of discretionary override.
