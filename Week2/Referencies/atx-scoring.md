# ATX Use Case Scoring Reference

## Purpose

This reference covers how to score, qualify, and prioritise agentic use cases — moving from a raw list of candidates to a sequenced implementation roadmap with economic justification.

---

## Step 1: Suitability gating

Before scoring volume or value, confirm the use case passes the suitability gate. A use case is unsuitable if:

- It can be fully solved with deterministic rules, scripts, or RPA → **don't build an agent**
- It requires tacit human judgment with no structure → **not yet delegatable**
- Critical data or system integrations are unavailable with no realistic path → **blocked**
- Compliance risk is extreme with no viable HITL or audit design → **escalate to governance first**

Pass criteria: at least Medium suitability on Input Structure, Decision Determinism, and Tool Coverage; no hard blocks on Risk/Compliance.

---

## Step 2: Volume × Value scoring

Score each candidate on two primary dimensions:

### Execution Frequency (Volume)

| Score | Description |
|-------|-------------|
| 5 | Very frequent: hundreds+ per day or continuous stream |
| 4 | Frequent: 50–200 per day |
| 3 | Regular: 10–50 per day, or high volume per week |
| 2 | Moderate: several per day or high volume per month |
| 1 | Infrequent: weekly or monthly |

### Non-Deterministic Decision Effort (Value driver)

| Score | Description |
|-------|-------------|
| 5 | High reasoning: requires synthesis of multiple data sources, policy interpretation, contextual judgment |
| 4 | Significant reasoning: follows patterns but requires contextual adaptation and exception handling |
| 3 | Mixed: core path is rule-based but exceptions and edge cases require reasoning |
| 2 | Mostly deterministic: small reasoning component around structured rules |
| 1 | Fully deterministic: pure rules/logic, no reasoning required |

**Agentic value score = Volume × Non-Determinism** (1–25 scale)

- Score ≥ 15: Strong agentic candidate
- Score 8–14: Consider agentic, validate with TCO
- Score < 8: Use rule-based automation or don't automate

---

## Step 3: Total Cost of Ownership assessment

TCO analysis determines whether a use case is economically viable. Run this for all candidates scoring ≥ 8.

### Baseline cost (what the human currently costs)

```
Baseline cost per case =
  (time per case in hours) × (fully loaded hourly cost)

Annual baseline =
  (cases per year) × (baseline cost per case)
```

Fully loaded cost includes: salary + benefits + management overhead + opportunity cost of skilled worker doing manual tasks.

### Agent cost model

```
Cost per case (agent) =
  Token cost + Tool call cost + Infrastructure cost + HITL cost

Token cost =
  (avg input tokens per case × input token price) +
  (avg output tokens per case × output token price)

Tool call cost =
  number of tool calls × average cost per call

HITL cost =
  (% cases requiring human review) × (time per review) × (hourly cost)
```

### Token economics levers

These affect both cost and reliability — they are design choices:

| Lever | Impact | Trade-off |
|-------|--------|-----------|
| **Context window size** | Larger = more accurate | More tokens = higher cost |
| **Model selection** | More capable = more reliable | More capable = more expensive |
| **Caching** | Repeated context costs once | Requires stable context patterns |
| **Retrieval precision** | Better retrieval = fewer tokens needed | Requires well-structured knowledge bases |
| **Prompt compression** | Shorter prompts = lower cost | Risk of losing critical instructions |
| **Reasoning strategy** | CoT/o1 = more accurate | Higher latency + token cost |

Calibrating these levers during mock testing is how you find the optimal operating point (accuracy vs. cost).

### ROI calculation

```
Annual saving = Annual baseline cost - Annual agent cost

Build cost = Development + integration + testing + platform overhead

Payback period = Build cost / Annual saving

Year 1 ROI = (Annual saving - Build cost) / Build cost × 100%

3-year ROI = ((Annual saving × 3) - Build cost) / Build cost × 100%
```

**Economic gate**: only proceed to production if:
- Year 1 ROI > 0% or payback period ≤ 18 months (adjust for organisation's hurdle rate)
- The accuracy/cost operating point is validated in mock testing
- The human-in-the-loop cost is accounted for at the expected exception rate

---

## Step 4: Strategic sequencing

Sequence use cases so that early wins finance later investments and platform assets compound.

### Sequencing criteria

| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| **Self-financing ROI** | High | First wave must pay for itself; funds wave 2 |
| **Integration reusability** | High | Use cases that build shared integrations amplify future agents |
| **Low compliance risk** | Medium | Start with lower-risk use cases to build governance confidence |
| **Data readiness** | Medium | Use cases with clean, accessible data move faster |
| **Organisational readiness** | Medium | Need stakeholder buy-in and HITL tolerance |
| **Strategic visibility** | Low | Some use cases are good for executive sponsorship even if not highest ROI |

### Wave structure

**Wave 1 (self-funding foundation)**:
- Highest ROI, lowest integration complexity
- Builds 2–3 foundational integrations that will be reused in Wave 2+
- Establishes governance, testing, and monitoring infrastructure
- Target payback: ≤ 12 months

**Wave 2 (compounding)**:
- Inherits Wave 1 integrations and platform assets
- Higher cognitive complexity or wider cross-system scope
- Lower marginal build cost due to reuse

**Wave 3+ (AI-native operations)**:
- Multi-agent workflows
- Agents that coordinate with each other
- Platform-level optimisation (model routing, cost management)

---

## Use case scoring template

```
Use Case: [Name]
Process: [Department / Process name]
Volume: [Cases/day or week]

Suitability gate:
  Input structure: [H/M/L]
  Decision determinism: [H/M/L]
  Tool coverage: [H/M/L]
  Exception rate: [H/M/L — lower is better]
  Compliance risk: [H/M/L — lower is better]
  Gate result: [Pass / Conditional / Fail]

Scoring:
  Execution frequency score: [1–5]
  Non-deterministic effort score: [1–5]
  Agentic value score: [product, 1–25]

Economics (preliminary):
  Avg time per case (human): [hours]
  Cases per year: [number]
  Fully loaded hourly cost: [£/$/€]
  Annual baseline cost: [calculated]

  Estimated tokens per case: [input / output]
  Model: [e.g. GPT-4o, Claude Sonnet]
  Estimated token cost per case: [calculated]
  HITL rate: [%]
  Estimated agent cost per case: [calculated]
  Annual agent cost: [calculated]

  Annual saving: [baseline - agent cost]
  Estimated build cost: [£/$/€]
  Payback period: [months]
  Year 1 ROI: [%]

Sequencing:
  Wave: [1 / 2 / 3]
  Key integrations built: [list shared assets]
  Dependencies: [list blockers or prerequisites]

Delegation archetype: [archetype name]
Recommended next step: [proceed to Agent Mapping / validate data / governance review]
```
