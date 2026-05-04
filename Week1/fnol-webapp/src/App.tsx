import { useMemo, useState } from 'react'
import './App.css'
import { getFnolConfig } from './fnol/config'
import { createNewClaim, initializeSla, runTriageStep, runValidateAndRoute } from './fnol/engine'
import type { AuditEvent, FnolClaim, LossType, PolicySnapshot } from './fnol/types'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function numberFromInput(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const DEFAULT_POLICY: PolicySnapshot = {
  policy_id: 'POL-12345',
  status: 'ACTIVE',
  coverage_limit: 20000,
  policy_start_date: '2026-01-01',
  policy_end_date: '2026-12-31',
  covered_loss_types: ['AUTO', 'PROPERTY'],
}

type SoapOutcome = 'SUCCESS' | 'TIMEOUT' | 'POLICY_NOT_FOUND' | 'SERVICE_UNAVAILABLE'
type CrmOutcome = 'SUCCESS' | 'FAIL_500' | 'FAIL_400'

export default function App() {
  const config = useMemo(() => getFnolConfig(), [])

  const [claim, setClaim] = useState<FnolClaim>(() =>
    initializeSla(createNewClaim('WEB'), config),
  )
  const [events, setEvents] = useState<AuditEvent[]>([])

  // Simulator inputs (user-controlled)
  const [extractionConfidence, setExtractionConfidence] = useState(0.91)
  const [severityScore, setSeverityScore] = useState(5)
  const [claimValue, setClaimValue] = useState(4500)
  const [lossType, setLossType] = useState<LossType>('AUTO')
  const [dateOfLoss, setDateOfLoss] = useState('2026-04-20')
  const [policyId, setPolicyId] = useState('POL-12345')
  const [agentReasoning, setAgentReasoning] = useState(
    'Extracted structured fields from raw payload; confidence is mean across required fields.',
  )
  const [soapOutcome, setSoapOutcome] = useState<SoapOutcome>('SUCCESS')
  const [policySnapshot, setPolicySnapshot] = useState<PolicySnapshot>(DEFAULT_POLICY)
  const [crmOutcome, setCrmOutcome] = useState<CrmOutcome>('SUCCESS')
  const [assignedSpecialistId, setAssignedSpecialistId] = useState('ADJ-001')

  const lowConfidence =
    extractionConfidence < config.EXTRACTION_CONFIDENCE_THRESHOLD

  const input = useMemo(
    () => ({
      extraction_confidence: extractionConfidence,
      extracted_fields: {
        severity_score: clamp(severityScore, 1, 10),
        claim_value: Math.max(0, claimValue),
        loss_type: lossType,
        date_of_loss: dateOfLoss,
        policy_id: policyId,
      },
      agent_reasoning: agentReasoning,
      soap_outcome: soapOutcome,
      policy_snapshot: policySnapshot,
      crm_outcome: crmOutcome,
      assigned_specialist_id: assignedSpecialistId,
    }),
    [
      extractionConfidence,
      severityScore,
      claimValue,
      lossType,
      dateOfLoss,
      policyId,
      agentReasoning,
      soapOutcome,
      policySnapshot,
      crmOutcome,
      assignedSpecialistId,
    ],
  )

  const reset = () => {
    setClaim(initializeSla(createNewClaim('WEB'), config))
    setEvents([])
  }

  const runTriage = () => {
    const r = runTriageStep(claim, config, input)
    setClaim(r.claim)
    setEvents((e) => [...r.events, ...e])
  }

  const runValidateRoute = () => {
    const r = runValidateAndRoute(claim, config, input)
    setClaim(r.claim)
    setEvents((e) => [...r.events, ...e])
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="kicker">Spec-driven simulator</div>
          <h1>FNOL Triage + Routing Webapp</h1>
          <p className="sub">
            Local demo that follows <code>Monday-test/PRODUCTION_SPEC.md</code>.
            Don’t enter real claimant PII.
          </p>
        </div>
        <div className="headerActions">
          <button className="btn secondary" onClick={reset} type="button">
            New claim
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Claim (simulated inputs)</h2>
          <div className="twoCol">
            <label>
              <span>Extraction confidence</span>
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={extractionConfidence}
                onChange={(e) =>
                  setExtractionConfidence(
                    clamp(numberFromInput(e.target.value), 0, 1),
                  )
                }
              />
              {lowConfidence ? (
                <div className="hint warn">
                  Below threshold ({config.EXTRACTION_CONFIDENCE_THRESHOLD}) → RL-01 routes to HUMAN_REVIEW and blocks field writes.
                </div>
              ) : (
                <div className="hint ok">
                  Meets threshold ({config.EXTRACTION_CONFIDENCE_THRESHOLD}) → fields may be written at TRIAGED.
                </div>
              )}
            </label>

            <label>
              <span>Severity score (1–10)</span>
              <input
                type="number"
                min={1}
                max={10}
                value={severityScore}
                onChange={(e) => setSeverityScore(numberFromInput(e.target.value))}
              />
            </label>

            <label>
              <span>Claim value (USD)</span>
              <input
                type="number"
                min={0}
                value={claimValue}
                onChange={(e) => setClaimValue(numberFromInput(e.target.value))}
              />
            </label>

            <label>
              <span>Loss type</span>
              <select value={lossType} onChange={(e) => setLossType(e.target.value as LossType)}>
                <option value="AUTO">AUTO</option>
                <option value="PROPERTY">PROPERTY</option>
                <option value="LIABILITY">LIABILITY</option>
                <option value="MEDICAL">MEDICAL</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>

            <label>
              <span>Date of loss (ISO date)</span>
              <input
                type="date"
                value={dateOfLoss}
                onChange={(e) => setDateOfLoss(e.target.value)}
              />
            </label>

            <label>
              <span>Policy ID</span>
              <input value={policyId} onChange={(e) => setPolicyId(e.target.value)} />
            </label>
          </div>

          <label>
            <span>Agent reasoning (write-once in real system)</span>
            <textarea
              value={agentReasoning}
              onChange={(e) => setAgentReasoning(e.target.value)}
              rows={3}
            />
          </label>

          <div className="actions">
            <button className="btn" type="button" onClick={runTriage}>
              Run TRIAGE
            </button>
            <button className="btn" type="button" onClick={runValidateRoute}>
              Run VALIDATE + ROUTE
            </button>
          </div>
        </section>

        <section className="card">
          <h2>External calls (simulated)</h2>
          <div className="twoCol">
            <label>
              <span>SOAP outcome</span>
              <select value={soapOutcome} onChange={(e) => setSoapOutcome(e.target.value as SoapOutcome)}>
                <option value="SUCCESS">SUCCESS</option>
                <option value="TIMEOUT">TIMEOUT</option>
                <option value="SERVICE_UNAVAILABLE">SERVICE_UNAVAILABLE</option>
                <option value="POLICY_NOT_FOUND">POLICY_NOT_FOUND</option>
              </select>
              <div className="hint">
                Retries up to <code>{config.MAX_SOAP_RETRIES}</code> with backoff base{' '}
                <code>{config.SOAP_RETRY_BACKOFF_SECONDS}</code>.
              </div>
            </label>

            <label>
              <span>CRM outcome</span>
              <select value={crmOutcome} onChange={(e) => setCrmOutcome(e.target.value as CrmOutcome)}>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAIL_500">FAIL_500</option>
                <option value="FAIL_400">FAIL_400</option>
              </select>
            </label>

            <label>
              <span>Assigned specialist id (on CRM success)</span>
              <input
                value={assignedSpecialistId}
                onChange={(e) => setAssignedSpecialistId(e.target.value)}
              />
            </label>
          </div>

          <details className="policy">
            <summary>Policy snapshot (editable)</summary>
            <div className="twoCol">
              <label>
                <span>Status</span>
                <select
                  value={policySnapshot.status}
                  onChange={(e) =>
                    setPolicySnapshot((p) => ({ ...p, status: e.target.value as PolicySnapshot['status'] }))
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="LAPSED">LAPSED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </label>
              <label>
                <span>Coverage limit</span>
                <input
                  type="number"
                  min={0}
                  value={policySnapshot.coverage_limit}
                  onChange={(e) =>
                    setPolicySnapshot((p) => ({ ...p, coverage_limit: numberFromInput(e.target.value) }))
                  }
                />
              </label>
              <label>
                <span>Policy start date</span>
                <input
                  type="date"
                  value={policySnapshot.policy_start_date}
                  onChange={(e) =>
                    setPolicySnapshot((p) => ({ ...p, policy_start_date: e.target.value }))
                  }
                />
              </label>
              <label>
                <span>Policy end date</span>
                <input
                  type="date"
                  value={policySnapshot.policy_end_date}
                  onChange={(e) =>
                    setPolicySnapshot((p) => ({ ...p, policy_end_date: e.target.value }))
                  }
                />
              </label>
            </div>
          </details>
        </section>

        <section className="card">
          <h2>Output</h2>
          <div className="kv">
            <div>
              <div className="k">claim_id</div>
              <div className="v mono">{claim.claim_id}</div>
            </div>
            <div>
              <div className="k">status</div>
              <div className="v">
                <span className="pill">{claim.status}</span>
              </div>
            </div>
            <div>
              <div className="k">validation_status</div>
              <div className="v">{claim.validation_status}</div>
            </div>
            <div>
              <div className="k">routing_target</div>
              <div className="v">{claim.routing_target ?? '—'}</div>
            </div>
            <div>
              <div className="k">human_review_reason</div>
              <div className="v">{claim.human_review_reason ?? '—'}</div>
            </div>
            <div>
              <div className="k">retry_count</div>
              <div className="v">{claim.retry_count}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Audit log (no PII)</h2>
          <div className="audit">
            {events.length === 0 ? (
              <div className="empty">Run TRIAGE or VALIDATE + ROUTE to generate audit events.</div>
            ) : (
              <ul>
                {events.map((e, idx) => (
                  <li key={`${e.at}-${idx}`}>
                    <div className="auditRow">
                      <span className="pill subtle">{e.event}</span>
                      <span className="mono dim">{e.at}</span>
                    </div>
                    <div className="msg mono">{e.message}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="mono">
          Config: SLA={config.SLA_WINDOW_SECONDS}s, highSeverity&gt;{config.HIGH_SEVERITY_THRESHOLD}, highValue&gt;{config.HIGH_VALUE_THRESHOLD_USD}, maxSoapRetries={config.MAX_SOAP_RETRIES}, extractionThreshold={config.EXTRACTION_CONFIDENCE_THRESHOLD}
        </div>
      </footer>
    </div>
  )
}
