# ATX Economics Reference

## Purpose

This reference covers how to build the economic model for agentic transformation: token economics, cost modelling, ROI business case, and the self-financing roadmap. Economics is not a post-hoc justification — it is a design constraint that shapes every architectural decision.

---

## The economic logic of digital labour

### Why economics is different from traditional automation

Traditional automation (RPA, BPM): high upfront build cost, near-zero marginal cost, applies only to deterministic work.

Human labour: marginal cost = time × headcount, scales linearly.

Digital labour (GenAI agents): **variable cost per cognitive act**. Each case consumes tokens, tool calls, and infrastructure. This cost is measurable, forecastable, and optimisable.

The strategic implication: as token prices fall and model capabilities rise, the substitution curve accelerates. Enterprises that have already built the platform compound this advantage. Those starting later face a steeper ramp.

---

## Step 1: Baseline cost model

Quantify what the current cognitive work costs.

```
Baseline unit cost:
  Time per case (hours) = [measured or estimated from interviews]
  Fully loaded hourly cost = salary + benefits + management overhead + facilities
  [Typical knowledge worker: £50–120/hr fully loaded]

  Baseline cost per case = time × hourly cost

Annual baseline:
  Cases per year = [volume × working days]
  Annual baseline cost = cases per year × cost per case

Example:
  Claims triage: 15 min per case × £80/hr = £20 per case
  Volume: 500 cases/day × 250 working days = 125,000 cases/year
  Annual baseline: 125,000 × £20 = £2.5M
```

Include indirect costs where material:
- **Queue cost**: delayed cases cause SLA breaches, penalties, or customer churn
- **Error cost**: rework, exceptions, compliance failures from manual processing
- **Opportunity cost**: skilled workers doing low-value tasks instead of high-value work

---

## Step 2: Token economics model

Model the cost of each agent interaction.

### Token consumption per case

Estimate the average tokens consumed per case by the agent:

```
Input tokens per case:
  System prompt tokens: [stable, amortised across sessions if cached]
  Retrieved context tokens: [KB chunks, CRM data, documents]
  Conversation / case input tokens: [user messages, data payloads]

Output tokens per case:
  Agent reasoning (CoT, intermediate steps): [if using extended thinking]
  Final response / action payload: [structured output or user-facing text]

Total tokens per case = input + output (or input + reasoning + output for extended thinking models)
```

### Token pricing reference (approximate, verify with current provider pricing)

| Model tier | Input (per 1M tokens) | Output (per 1M tokens) | Use when |
|------------|----------------------|------------------------|----------|
| Frontier (Claude Opus, GPT-4o) | $15–25 | $75–100 | Complex reasoning, high-stakes decisions |
| Mid-tier (Claude Sonnet, GPT-4o-mini) | $3–5 | $15–20 | Balanced cost/capability |
| Fast/cheap (Claude Haiku, GPT-3.5) | $0.25–1 | $1.25–5 | High-volume, simple tasks |
| Reasoning models (o1, o3) | $15–60 | $60–240 | Multi-step planning, math, complex logic |

Note: prices change frequently. Model the sensitivity to price changes (±50%) in your business case.

### Tool call costs

```
Tool call cost per case:
  API calls × average cost per call
  Database queries × cost per query
  Storage reads/writes × cost
  Third-party service fees (if applicable)

Example:
  3 CRM API calls × £0.001 = £0.003
  1 RAG retrieval × £0.002 = £0.002
  1 case system write × £0.001 = £0.001
  Tool calls total: £0.006/case
```

### Infrastructure cost

Allocate platform infrastructure costs across agents:

```
Monthly platform cost: [compute, storage, networking, monitoring]
Cases per month: [volume]
Infrastructure cost per case: monthly platform cost / cases per month

For early use cases: often negligible vs. token costs
For high-volume agents: can become material — model explicitly
```

### Human-in-the-loop (HITL) cost

```
HITL rate: [% of cases that require human review or approval]
Time per HITL review: [minutes]
Reviewer hourly cost: [£]
HITL cost per case = HITL rate × (time / 60) × hourly cost

Example:
  HITL rate: 15% (agent handles 85% autonomously)
  Time per review: 5 minutes
  Reviewer cost: £60/hr
  HITL cost: 0.15 × (5/60) × 60 = £0.75/case
```

### Total agent cost per case

```
Agent cost per case =
  Token cost + Tool call cost + Infrastructure cost + HITL cost

Example:
  Token cost: £0.08
  Tool calls: £0.006
  Infrastructure: £0.01
  HITL: £0.75
  Total: £0.85/case

vs. Baseline: £20/case
Saving: £19.15/case (96% reduction)
```

---

## Step 3: ROI and business case

### Standard business case model

```
Annual volume: [cases/year]
Annual baseline cost: [volume × cost/case]
Annual agent cost: [volume × agent cost/case]
Annual saving: [baseline - agent cost]

Build cost:
  Assessment and design: [£]
  Development: [£]
  Integration: [£]
  Testing and calibration: [£]
  Platform infrastructure setup: [£]
  Change management / training: [£]
  Total build cost: [sum]

Year 1 net: Annual saving - Build cost
Payback period: Build cost / Annual saving (months)

3-year ROI:
  Total saving over 3 years: Annual saving × 3
  Total investment: Build cost + (Annual maintenance × 3)
  Net 3-year value: Total saving - Total investment
  ROI %: Net 3-year value / Total investment × 100
```

### Financial sensitivity table

Always model scenarios:

| Scenario | Token cost assumption | HITL rate | Annual saving | Payback |
|----------|-----------------------|-----------|---------------|---------|
| Conservative | +50% current price | 25% | £X | X months |
| Base case | Current price | 15% | £X | X months |
| Optimistic | -30% current price | 5% | £X | X months |

This demonstrates to clients that the business case holds even under adverse assumptions.

---

## Step 4: Self-financing roadmap

Structure the use case sequence so early ROI funds subsequent waves.

```
Wave 1 use cases (months 0–6):
  Use case A: build cost £X, annual saving £Y, payback Z months
  Use case B: build cost £X, annual saving £Y, payback Z months
  Wave 1 cumulative saving by month 12: £[sum]

Platform assets built in Wave 1 (reused in Wave 2):
  - CRM integration (saves £X in Wave 2 build)
  - RAG pipeline (saves £X)
  - Auth + governance layer (saves £X)
  Estimated Wave 2 build cost reduction: £[sum]

Wave 2 use cases (months 6–12):
  Funded by: Wave 1 savings + reduced build cost
  [repeat]

Cumulative 3-year picture:
  Total investment: £[sum]
  Total saving: £[sum]
  Net value: £[sum]
  Portfolio ROI: [%]
```

The self-financing model is the key sales argument: each wave pays for the next. The client is not betting a large budget on a single outcome.

---

## Step 5: Calibration — making economics survive reality

Business case assumptions must be validated before production.

### Mock environment testing

Before production release:
- Set up a mock environment with realistic data volumes and realistic edge cases
- Run the agent against test cases and measure: accuracy rate, token consumption per case, tool call patterns, HITL trigger rate
- Compare measured costs to business case assumptions
- Adjust model selection, context engineering, or HITL thresholds until operating point matches the business case

### Key calibration metrics

| Metric | Target | Impact if missed |
|--------|--------|-----------------|
| Task accuracy | ≥[threshold from business case] | HITL rate rises, cost increases |
| Tokens per case | ≤[budget from business case] | Cost per case rises, ROI erodes |
| HITL rate | ≤[threshold from business case] | Human cost rises, eliminates saving |
| Latency | ≤[SLA requirement] | User experience fails, adoption drops |
| Exception rate | ≤[expected from suitability scoring] | Operational chaos, trust loss |

### Sigma (variance) as an operational concept

Agents produce a **distribution of outputs**, not a single deterministic result. Calibration is the process of tuning this distribution:

- **Wide sigma**: creative, variable output — acceptable for low-stakes generation tasks
- **Narrow sigma**: consistent, predictable output — required for regulated decisions, high-volume structured tasks

Tuning levers: model selection, temperature, retrieval precision, prompt constraints, output validation, post-processing rules.

Only release to production when the measured operating point (accuracy at cost) matches the business case assumptions.

---

## Economic governance — ongoing

Once in production, treat economics as a live governance instrument:

- **Monthly**: review cost per case vs. budget; token consumption trends
- **Quarterly**: re-evaluate HITL rate; is the agent handling more autonomously as it matures?
- **On model release**: re-evaluate model selection — new models may offer better accuracy at lower cost
- **On volume change**: re-forecast annual saving and infrastructure costs

Economic visibility is what allows the organisation to tune autonomy over time: higher-risk tasks can be migrated from HITL-gated to autonomous as the agent proves reliability. This is how digital labour compounds operationally as well as economically.
