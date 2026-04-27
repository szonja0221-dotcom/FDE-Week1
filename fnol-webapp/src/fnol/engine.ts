import type { AuditEvent, FnolClaim, LossType, PolicySnapshot, RoutingTarget } from './types'
import type { FnolConfig } from './config'

type SoapOutcome = 'SUCCESS' | 'TIMEOUT' | 'POLICY_NOT_FOUND' | 'SERVICE_UNAVAILABLE'
type CrmOutcome = 'SUCCESS' | 'FAIL_500' | 'FAIL_400'

export type SimulationInputs = {
  extraction_confidence: number
  extracted_fields: {
    severity_score: number
    claim_value: number
    loss_type: LossType
    date_of_loss: string
    policy_id: string
  }
  agent_reasoning: string

  soap_outcome: SoapOutcome
  policy_snapshot: PolicySnapshot

  crm_outcome: CrmOutcome
  assigned_specialist_id: string
}

const nowIso = () => new Date().toISOString()

const addSeconds = (iso: string, seconds: number) =>
  new Date(new Date(iso).getTime() + seconds * 1000).toISOString()

function audit(event: AuditEvent['event'], message: string): AuditEvent {
  return { at: nowIso(), event, message }
}

function transition(
  claim: FnolClaim,
  newStatus: FnolClaim['status'],
  reason: string,
): { claim: FnolClaim; events: AuditEvent[] } {
  if (claim.status === newStatus) return { claim, events: [] }
  const updated_at = nowIso()
  return {
    claim: { ...claim, status: newStatus, updated_at },
    events: [
      audit(
        'STATUS_TRANSITION',
        `status: ${claim.status} -> ${newStatus}; reason=${reason}; claim_id=${claim.claim_id}`,
      ),
    ],
  }
}

function slaBreachIfAny(claim: FnolClaim): AuditEvent[] {
  const now = Date.now()
  const deadline = new Date(claim.sla_deadline).getTime()
  if (!Number.isFinite(deadline)) return []
  if (now <= deadline) return []
  return [
    audit(
      'RULE_TRIGGERED',
      `SLA_BREACH: deadline=${claim.sla_deadline} exceeded at step=${claim.status}; claim_id=${claim.claim_id}`,
    ),
  ]
}

function setHumanReview(claim: FnolClaim, reason: string): FnolClaim {
  return {
    ...claim,
    routing_target: 'HUMAN_REVIEW',
    human_review_reason: reason,
    updated_at: nowIso(),
  }
}

function setEscalated(claim: FnolClaim, reason: string): FnolClaim {
  return {
    ...claim,
    status: 'ESCALATED',
    routing_target: 'SOAP_ESCALATION_QUEUE',
    human_review_reason: reason,
    updated_at: nowIso(),
  }
}

function withinPolicyWindow(date_of_loss: string, policy: PolicySnapshot): boolean {
  const loss = new Date(date_of_loss).getTime()
  const start = new Date(policy.policy_start_date).getTime()
  const end = new Date(policy.policy_end_date).getTime()
  return loss >= start && loss <= end
}

function mapLossTypeToRouting(loss_type: LossType, highPriority: boolean): RoutingTarget {
  if (highPriority) return loss_type === 'OTHER' ? 'HUMAN_ADJUSTER_HIGH_PRIORITY' : (`${loss_type}_ADJUSTER_HIGH_PRIORITY` as RoutingTarget)
  if (loss_type === 'OTHER') return 'HUMAN_REVIEW'
  return `${loss_type}_ADJUSTER_STANDARD` as RoutingTarget
}

export function createNewClaim(source_type: FnolClaim['source_type']): FnolClaim {
  const created_at = nowIso()
  return {
    claim_id: crypto.randomUUID(),
    source_type,
    raw_payload_url: 'dms://example/document/123',
    severity_score: null,
    claim_value: null,
    loss_type: null,
    date_of_loss: null,
    policy_id: null,
    validation_status: 'PENDING',
    routing_target: null,
    status: 'RECEIVED',
    policy_snapshot: null,
    agent_reasoning: null,
    extraction_confidence: null,
    retry_count: 0,
    assigned_specialist_id: null,
    human_review_reason: null,
    acknowledged_at: null,
    created_at,
    updated_at: created_at,
    sla_deadline: created_at, // filled by caller using config
  }
}

export function initializeSla(claim: FnolClaim, config: FnolConfig): FnolClaim {
  return {
    ...claim,
    sla_deadline: addSeconds(claim.created_at, config.SLA_WINDOW_SECONDS),
    updated_at: nowIso(),
  }
}

export function runTriageStep(
  claim: FnolClaim,
  config: FnolConfig,
  input: SimulationInputs,
): { claim: FnolClaim; events: AuditEvent[] } {
  const events: AuditEvent[] = []
  events.push(...slaBreachIfAny(claim))

  // RL-01: Low extraction confidence gate; do not write extracted fields / agent_reasoning.
  if (input.extraction_confidence < config.EXTRACTION_CONFIDENCE_THRESHOLD) {
    const next = setHumanReview(
      claim,
      `LOW_EXTRACTION_CONFIDENCE: score=${input.extraction_confidence} below threshold=${config.EXTRACTION_CONFIDENCE_THRESHOLD}`,
    )
    events.push(
      audit(
        'RULE_TRIGGERED',
        `RL-01 triggered; routing_target=HUMAN_REVIEW; claim_id=${claim.claim_id}`,
      ),
    )
    const t = transition(next, 'TRIAGED', 'triage blocked by RL-01')
    return { claim: t.claim, events: [...events, ...t.events] }
  }

  const next: FnolClaim = {
    ...claim,
    severity_score: input.extracted_fields.severity_score,
    claim_value: input.extracted_fields.claim_value,
    loss_type: input.extracted_fields.loss_type,
    date_of_loss: input.extracted_fields.date_of_loss,
    policy_id: input.extracted_fields.policy_id,
    agent_reasoning: input.agent_reasoning,
    extraction_confidence: input.extraction_confidence,
    updated_at: nowIso(),
  }

  const t = transition(next, 'TRIAGED', 'extraction confidence passed')
  return { claim: t.claim, events: [...events, ...t.events] }
}

export function runValidateAndRoute(
  claim: FnolClaim,
  config: FnolConfig,
  input: SimulationInputs,
): { claim: FnolClaim; events: AuditEvent[] } {
  const events: AuditEvent[] = []
  events.push(...slaBreachIfAny(claim))

  if (claim.status !== 'TRIAGED') {
    return {
      claim,
      events: [audit('WRITE_ONCE_GUARD', `blocked: VALIDATE requires status=TRIAGED; got=${claim.status}`)],
    }
  }

  // SOAP phase (simulated). We model retry_count and terminal escalation.
  events.push(audit('SOAP_ATTEMPT', `SOAP attempt=${claim.retry_count + 1}; outcome=${input.soap_outcome}; claim_id=${claim.claim_id}`))

  if (input.soap_outcome === 'TIMEOUT' || input.soap_outcome === 'SERVICE_UNAVAILABLE') {
    const retry_count = claim.retry_count + 1
    const wait = config.SOAP_RETRY_BACKOFF_SECONDS * retry_count ** 2
    if (retry_count >= config.MAX_SOAP_RETRIES) {
      const escalated = setEscalated(
        { ...claim, retry_count },
        `SOAP_EXHAUSTED: ${retry_count} timeouts for policy_id=${claim.policy_id ?? 'UNKNOWN'}`,
      )
      events.push(audit('RULE_TRIGGERED', `RL-02 triggered; status=ESCALATED; routing_target=SOAP_ESCALATION_QUEUE; wait_seconds=${wait}`))
      return { claim: escalated, events }
    }
    const bumped: FnolClaim = { ...claim, retry_count, updated_at: nowIso() }
    events.push(audit('RULE_TRIGGERED', `SOAP_RETRY: retry_count=${retry_count}; computed_wait_seconds=${wait}`))
    return { claim: bumped, events }
  }

  if (input.soap_outcome === 'POLICY_NOT_FOUND') {
    const next = setHumanReview(
      claim,
      `POLICY_NOT_FOUND: policy_id=${claim.policy_id ?? 'UNKNOWN'}`,
    )
    const updated: FnolClaim = {
      ...next,
      validation_status: 'INVALID',
      policy_snapshot: null,
      updated_at: nowIso(),
    }
    const t = transition(updated, 'VALIDATED', 'policy not found')
    events.push(audit('RULE_TRIGGERED', `RL-03 triggered; validation_status=INVALID; claim_id=${claim.claim_id}`))
    return { claim: t.claim, events: [...events, ...t.events] }
  }

  // SUCCESS: write policy_snapshot and evaluate Rules 4.2–4.5
  let validated: FnolClaim = { ...claim, policy_snapshot: input.policy_snapshot, updated_at: nowIso() }

  const policy = input.policy_snapshot
  const date_of_loss = claim.date_of_loss
  const claim_value = claim.claim_value
  const loss_type = claim.loss_type
  const severity = claim.severity_score

  if (!date_of_loss || claim_value == null || !loss_type || severity == null || !claim.policy_id) {
    const next = setHumanReview(validated, 'MISSING_REQUIRED_FIELDS: TRIAGED fields incomplete')
    validated = { ...next, validation_status: 'INVALID', updated_at: nowIso() }
    events.push(audit('RULE_TRIGGERED', `RL-03 triggered; missing required triage fields; claim_id=${claim.claim_id}`))
  } else if (policy.status !== 'ACTIVE') {
    const next = setHumanReview(validated, `POLICY_INACTIVE: policy_id=${policy.policy_id} status=${policy.status}`)
    validated = { ...next, validation_status: 'INVALID', updated_at: nowIso() }
    events.push(audit('RULE_TRIGGERED', `Rule 4.2 triggered; claim_id=${claim.claim_id}`))
  } else if (!withinPolicyWindow(date_of_loss, policy)) {
    const next = setHumanReview(
      validated,
      `POLICY_DATE_OUT_OF_RANGE: date_of_loss=${date_of_loss} not within [${policy.policy_start_date}, ${policy.policy_end_date}]`,
    )
    validated = { ...next, validation_status: 'INVALID', updated_at: nowIso() }
    events.push(audit('RULE_TRIGGERED', `Rule 4.3 triggered; claim_id=${claim.claim_id}`))
  } else if (claim_value > policy.coverage_limit) {
    const next = setHumanReview(
      validated,
      `COVERAGE_EXCEEDED: claim_value=${claim_value} > coverage_limit=${policy.coverage_limit}`,
    )
    // Note: spec says this routes to HUMAN_REVIEW without setting INVALID.
    validated = { ...next, validation_status: 'VALID', updated_at: nowIso() }
    events.push(audit('RULE_TRIGGERED', `Rule 4.4 triggered (route to human); claim_id=${claim.claim_id}`))
  } else if (!policy.covered_loss_types.includes(loss_type)) {
    const next = setHumanReview(
      validated,
      `UNCOVERED_LOSS_TYPE: loss_type=${loss_type} not in ${JSON.stringify(policy.covered_loss_types)}`,
    )
    validated = { ...next, validation_status: 'INVALID', updated_at: nowIso() }
    events.push(audit('RULE_TRIGGERED', `Rule 4.5 triggered; claim_id=${claim.claim_id}`))
  } else {
    validated = { ...validated, validation_status: 'VALID', updated_at: nowIso() }
  }

  const tv = transition(validated, 'VALIDATED', 'soap success + validation rules evaluated')
  let routed = tv.claim
  events.push(...tv.events)

  // Stop routing pipeline if HUMAN_REVIEW or SOAP_ESCALATION_QUEUE
  if (routed.routing_target === 'HUMAN_REVIEW' || routed.routing_target === 'SOAP_ESCALATION_QUEUE') {
    return { claim: routed, events }
  }

  // Rule 4.1 high value/severity takes precedence over skill-group matching.
  const highPriority =
    (severity ?? 0) > config.HIGH_SEVERITY_THRESHOLD ||
    (claim_value ?? 0) > config.HIGH_VALUE_THRESHOLD_USD

  const intendedTarget: RoutingTarget = highPriority
    ? 'HUMAN_ADJUSTER_HIGH_PRIORITY'
    : mapLossTypeToRouting(loss_type ?? 'OTHER', false)

  const routing_target = intendedTarget

  // CRM PATCH simulation.
  events.push(audit('CRM_ATTEMPT', `CRM PATCH intended_routing_target=${routing_target}; outcome=${input.crm_outcome}; claim_id=${claim.claim_id}`))
  if (input.crm_outcome !== 'SUCCESS') {
    const httpStatus = input.crm_outcome === 'FAIL_500' ? 500 : 400
    const next = setHumanReview(
      routed,
      `CRM_UPDATE_FAILED: HTTP ${httpStatus}; intended_routing_target=${routing_target}`,
    )
    events.push(audit('RULE_TRIGGERED', `RL-05 triggered; claim_id=${claim.claim_id}`))
    return { claim: next, events }
  }

  routed = {
    ...routed,
    routing_target,
    assigned_specialist_id: input.assigned_specialist_id,
    human_review_reason: null,
    updated_at: nowIso(),
  }

  const tr = transition(routed, 'ROUTED', 'routing_target assigned and CRM updated')
  return { claim: tr.claim, events: [...events, ...tr.events] }
}

