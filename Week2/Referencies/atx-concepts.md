# ATX Concepts Reference

## The three production factors

Enterprises have historically scaled through two mechanisms:

1. **Traditional software** — deterministic, rules-based, limited to structured inputs. Productivity gains from software plateau once all rule-expressible work is automated.

2. **Human labour scaling** — hiring, contracting, outsourcing. Throughput scales linearly with headcount, but cost and coordination overhead scale with it.

3. **Digital labour (GenAI agents)** — the third mechanism. Agents absorb cognitive load, reason over unstructured inputs, and act with a degree of autonomy. They scale like software but must be governed like a workforce.

The key distinction: agents are **statistical** (not deterministic), requiring reliability to be engineered through design, testing, and guardrails — not assumed from code.

---

## Why digital labour must be owned, not rented

Pre-built agents from SaaS platforms or hyperscaler "agent products" create **hidden outsourcing**:

- **Sourcing risk**: vendor's commercial model dictates your agent's evolution
- **Lock-in**: concentration with a hyperscaler or product company
- **Limited control**: enterprise cannot adapt agents to their operating model
- **No compounding**: each vendor's agents are siloed; they don't accumulate shared assets

Enterprises cap human outsourcing (typically at 30%) to preserve control, resilience, and competitiveness. The same logic applies to digital labour. Agents must be **hired and trained, not rented**.

Ownership means:
- The orchestration logic that coordinates agents and tools
- The delegation boundaries that define what agents may and may not do
- The prompts, guardrails, validation rules, and policies that shape behaviour
- The tool interfaces through which agents act on enterprise systems
- The evaluation and testing harnesses that establish reliability
- The operational controls that enable supervision, intervention, and auditability

---

## Why "Spray and Pray" AI fails

**95% of AI projects fail** to meet their objectives (MIT). **46% of PoCs** are abandoned before production. **80%+ of organisations** see no tangible EBIT impact (McKinsey 2025).

The six structural causes:

1. **No clear business problem** — misidentified or miscommunicated goals
2. **Poor data quality** — fragmented, inconsistent, concentrated in individuals
3. **Pilot paralysis** — no clear path from PoC to production (88% fail: Capgemini)
4. **Resource underestimation** — especially data preparation and token economics
5. **Organisational disconnect** — technical teams and business leaders misaligned; 45% of workers burned out by change
6. **Technology-first approach** — model fetishism; optimising technical metrics while integration sits in backlog

ATX addresses all six structurally: it starts with business rationale, grounds every decision in economics, and builds a platform that compounds rather than stacks isolated projects.

---

## The compounding thesis

Companies that build platform assets — system integrations, tool interfaces, retrieval patterns, evaluation harnesses, governance controls — make every new agent cheaper and faster:

- **Backward compounding**: new integrations improve existing agents automatically
- **Forward compounding**: existing infrastructure reduces the cost of future agents

This is the divergence between AI leaders and laggards. By 2030, companies that compound effectively are projected to be 10× ahead of those that run isolated pilots.

---

## Cognitive work vs. processes

Traditional automation (ERP, RPA, BPM) targets **processes** — sequences of activities with stable inputs and outputs. This is not sufficient for cognitive work.

**Cognitive work lives in the spaces between processes**: in interpretation, judgment, exception handling, reconciliation of partial truths, and translation between what systems record and what humans mean.

ATX changes the unit of analysis: we don't automate processes, we decompose and recompose **cognitive work**.

### Lived work vs. documented work

Every enterprise has two versions of operations:
- **Documented**: SOPs, swimlane diagrams, compliance manuals
- **Lived**: how work actually gets done when systems are slow, data is missing, customers behave unexpectedly

Agentic value is found in the gap between these. Agents built from documentation will be built for an imaginary organisation. ATX requires explicit elicitation of lived processes through interviews, shadowing, and case walk-throughs.

---

## Jobs to be Done as cognitive contracts

A **Job to be Done** is not a task. It is a cognitive contract between an actor and an outcome. "Resolve a billing dispute" is not "update an invoice" — it includes understanding intent, validating identity, reconciling data, applying policy, choosing a resolution path, and communicating a decision.

JtDs decompose work into:
- What must be **decided** vs. what must be **executed**
- Which parts are **knowledge-bound**, **rule-bound**, or **exception-bound**
- Which systems and data sources participate in the cognitive act

JtDs are the atomic units of delegation — they define purpose, context, and acceptable outcomes.

---

## Cognitive Zones and Breakpoints

Within a single JtD, cognitive effort is not uniform:

**Cognitive Zones**: clusters of similar cognitive activity (intent recognition, authentication, diagnosis, resolution, documentation). Each zone has its own data dependencies, error tolerance, and latency constraints.

**Cognitive Breakpoints**: points where control must be handed off — from customer to agent, system to human, rule to judgment. These are where agents create disproportionate value **or** disproportionate risk.

Mapping zones and breakpoints turns vague "complexity" into a precise cognitive topology: where probabilistic reasoning is required, where deterministic execution suffices, and where human sense-making is indispensable.

---

## Delegation archetypes

Five stable operating modes — these are not maturity levels, they are design choices:

| Archetype | Description | When |
|-----------|-------------|------|
| **Human Only** | Tacit knowledge, ethics, irreversibility | No suitable structure or automation path |
| **Human-led + Automation Support** | Tools accelerate execution, judgment stays human | Rule-bound tasks with human control preferred |
| **Human-led + Agent Support** | Agent provides synthesis and recommendations | Complex analysis, research, decision support |
| **Agent-led + Human Oversight** | Execution delegated, supervision mandatory | High-volume structured decisions with human backstop |
| **Fully Agentic** | Autonomous within defined bounds | High-volume, structured, reversible, well-governed |

---

## Control planes — who controls the agent controls the value

Every agent runs on a control plane. Three categories:

| Type | Examples | Use when |
|------|----------|----------|
| **SaaS ecosystem** | Salesforce, ServiceNow, SAP | Work is fully contained within one platform |
| **Hyperscaler platform** | Azure AI Foundry, AWS AgentCore, Google AgentSpace | Need cloud infra + model access + data services |
| **Independent agentic platform** | AI/Run.Transform, Clarity | Cross-system, cross-channel work requiring owned orchestration |

Rule of thumb: if the cognitive work spans more than one system, the agent belongs to the enterprise, not the vendor.

---

## Economics of digital labour

The agent cost model has four variables:
- **Token consumption** (input + output tokens per case, shaped by context engineering)
- **Tool calls** (API calls, database queries, system writes)
- **Infrastructure** (compute, storage, networking)
- **Residual human oversight** (HITL, exception handling, audit)

The economic thesis: agentic transformation is justified where it replaces expensive cognitive time with a **controlled variable cost** at the required volume and reliability. Economics must close **before** production.

Token economics is not just a cost measure — it is a **governance instrument**. Model selection, context window management, caching strategy, and retrieval precision all affect cost and risk simultaneously.

---

## The AI-native enterprise (end state)

An AI-native enterprise is not one that uses many models. It is one whose **operating model assumes the existence of digital labour**.

Key characteristics:
- Agents continuously produced, upgraded, and retired on a shared platform
- New roles: Agent Product Manager (defines purpose), Agent Operations (supervises), Risk/Compliance (governs autonomy)
- Institutional learning compounds faster than any single team
- Competitive advantage: lower marginal cost of cognition, faster response, greater scale

The end state is a **hybrid organisation** where humans and agents collaborate under a single operating model. Humans are placed where judgment is actually required, not where process friction has historically placed them.
