export type SourceType = 'EMAIL' | 'PHONE' | 'WEB'

export type LossType = 'AUTO' | 'PROPERTY' | 'LIABILITY' | 'MEDICAL' | 'OTHER'

export type ValidationStatus = 'PENDING' | 'VALID' | 'INVALID'

export type RoutingTarget =
  | 'AUTO_ADJUSTER_STANDARD'
  | 'AUTO_ADJUSTER_HIGH_PRIORITY'
  | 'PROPERTY_ADJUSTER_STANDARD'
  | 'PROPERTY_ADJUSTER_HIGH_PRIORITY'
  | 'LIABILITY_ADJUSTER_STANDARD'
  | 'LIABILITY_ADJUSTER_HIGH_PRIORITY'
  | 'MEDICAL_ADJUSTER_STANDARD'
  | 'MEDICAL_ADJUSTER_HIGH_PRIORITY'
  | 'HUMAN_ADJUSTER_HIGH_PRIORITY'
  | 'HUMAN_REVIEW'
  | 'SOAP_ESCALATION_QUEUE'

export type ClaimStatus =
  | 'RECEIVED'
  | 'TRIAGED'
  | 'VALIDATED'
  | 'ROUTED'
  | 'ACKNOWLEDGED'
  | 'ESCALATED'

export type PolicyStatus = 'ACTIVE' | 'LAPSED' | 'CANCELLED' | 'PENDING'

export type PolicySnapshot = {
  policy_id: string
  status: PolicyStatus
  coverage_limit: number
  policy_start_date: string // ISO date
  policy_end_date: string // ISO date
  covered_loss_types: LossType[]
}

export type FnolClaim = {
  claim_id: string
  source_type: SourceType

  // Write-once in real system; editable in this simulator.
  raw_payload_url: string

  severity_score: number | null // 1–10
  claim_value: number | null // USD
  loss_type: LossType | null
  date_of_loss: string | null // ISO date
  policy_id: string | null

  validation_status: ValidationStatus
  routing_target: RoutingTarget | null

  status: ClaimStatus

  policy_snapshot: PolicySnapshot | null
  agent_reasoning: string | null
  extraction_confidence: number | null // 0–1
  retry_count: number

  assigned_specialist_id: string | null
  human_review_reason: string | null

  acknowledged_at: string | null // ISO timestamp

  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
  sla_deadline: string // ISO timestamp
}

export type AuditEvent = {
  at: string // ISO timestamp
  event:
    | 'STATUS_TRANSITION'
    | 'RULE_TRIGGERED'
    | 'SOAP_ATTEMPT'
    | 'CRM_ATTEMPT'
    | 'WRITE_ONCE_GUARD'
  message: string
}

