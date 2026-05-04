# ATX Agent Mapping Reference

## Purpose

Agent mapping translates a prioritised use case into a fully specified agent design: purpose, scope, activity catalog, data/system map, autonomy levels, and a compounding implementation roadmap.

This is the bridge between "we know what cognitive work to delegate" and "we know what to build."

---

## The five elements of an enterprise agent

An agent that is missing any of these is not an enterprise agent — it is a model invocation.

| Element | Definition | Common failure mode |
|---------|------------|---------------------|
| **Purpose** | The Job to be Done the agent exists to fulfil | "Assist users" — too vague; no measurable outcome |
| **Scope** | The boundary of authority: what it may decide, act on, and escalate | Undefined scope = uncontrolled risk |
| **Context** | What the agent can see: data sources, memory, retrieval patterns, real-time signals | Insufficient context = poor accuracy; excessive context = high cost |
| **Tools** | The interfaces through which the agent acts on the world | Missing tools = agent can't complete the job; too many = safety risk |
| **Governance** | Logging, auditability, human override, compliance classification | Absent governance = production liability |

---

## Agent Purpose Document

Complete one per agent.

```
Agent Name: [descriptive name]
Job to be Done: [the cognitive contract — what outcome does this agent produce?]
Business context: [which department, process, customer journey step]

Primary objectives (what success looks like):
  1. [objective 1]
  2. [objective 2]

KPIs:
  - Accuracy: [target % correct decisions / outputs]
  - Coverage: [% of cases handled without human escalation]
  - Throughput: [cases per hour/day]
  - Cost per case: [target £/$ at expected token + tool cost]
  - HITL rate: [% requiring human review — target and acceptable ceiling]

Failure modes:
  - [What does a bad output look like?]
  - [What is the consequence of failure?]
  - [Recovery path?]

Delegation archetype: [archetype name + rationale]

Escalation triggers:
  - [Condition 1 → escalate to [human role]]
  - [Condition 2 → return to user for clarification]
  - [Condition 3 → flag for compliance review]
```

---

## Agent Activity Catalog

Enumerate every micro-task the agent performs. For each task, specify:

| Task | Type | Delegation level | Data required | Tool required | Risk level |
|------|------|-----------------|---------------|---------------|------------|
| Extract customer intent | Reasoning | Fully agentic | Conversation input | None | Low |
| Query customer record | Retrieval | Fully agentic | CRM access | CRM API | Low |
| Validate identity | Decision | Agent-led + HITL on anomaly | Auth system | Auth API | High |
| Diagnose issue | Reasoning | Agent-led + HITL on ambiguous | KB, CRM, service history | RAG, KB API | Medium |
| Propose resolution | Generation | Human-led + Agent support | Policy docs, KB | None | Medium |
| Execute resolution | Action | Agent-led + HITL approval | Case system | Case API, payment API | High |
| Document outcome | Generation | Fully agentic | Conversation, case data | CRM write API | Low |

Task types: **Reasoning** (model does the cognitive work), **Retrieval** (fetch and return data), **Decision** (choose between outcomes), **Action** (write to a system or trigger a process), **Generation** (produce text or structured output).

---

## Autonomy Matrix (Decision Authority Matrix)

Defines what the agent decides alone vs. what requires human approval. This is the operational contract between the agent and the organisation.

```
AGENT DECIDES ALONE (no HITL required):
  - [list of decisions / actions]
  Examples: intent classification, data retrieval, drafting responses,
            low-value standard resolutions (< £X), non-regulated document generation

AGENT ACTS, HUMAN NOTIFIED AFTER:
  - [list of decisions / actions]
  Examples: standard policy application within defined rules,
            resolutions within pre-approved parameters

AGENT PROPOSES, HUMAN APPROVES BEFORE ACTION:
  - [list of decisions / actions]
  Examples: resolutions above £X threshold,
            changes to sensitive customer data,
            exceptions to standard policy

HUMAN TAKES OVER (agent supports):
  - [list of triggers]
  Examples: customer escalation request, compliance flag,
            ambiguous edge case outside training distribution,
            agent confidence below threshold X
```

---

## System and Data Inventory

For each data source or system the agent needs to interact with:

| System | Data needed | Access type | Availability | Gap/Risk |
|--------|-------------|-------------|--------------|----------|
| CRM (Salesforce) | Customer record, case history | Read | API available | Rate limits |
| Core billing system | Invoice data, payment status | Read/Write | Legacy SOAP API | Integration effort: medium |
| Knowledge Base | Policy docs, FAQs, SOPs | Read (RAG) | Static PDFs | Needs chunking + indexing |
| Regulatory blacklist | Sanctioned entities | Read | External REST API | Latency: 200ms |
| Case management | Case creation, status updates | Read/Write | REST API | Auth: OAuth 2.0 |

Annotate shared sources: if another agent already uses the same integration, mark it as "shared" — this signals a compounding opportunity (build once, reuse across agents).

---

## Context Engineering Design

Context quality determines agent quality. For each agent, design:

### Memory architecture

| Memory type | Content | Storage | Lifecycle |
|-------------|---------|---------|-----------|
| **In-context** (short-term) | Current conversation, active case details | Prompt window | Per session |
| **Episodic** (medium-term) | Customer history, prior interactions | Vector DB / summary | Per customer |
| **Semantic** (long-term) | Policy docs, KB articles, product catalogue | RAG / vector search | Updated on change |
| **Procedural** (static) | Agent instructions, guardrails, decision rules | System prompt | Version-controlled |

### Retrieval strategy

- What triggers a retrieval call? (query keywords, intent classification, explicit tool call)
- What is the retrieval target? (top-K chunks, exact document, structured record)
- How is retrieval quality evaluated? (relevance scoring, user feedback, accuracy evals)
- How are retrieval costs managed? (chunking strategy, index structure, caching)

### Prompt / context engineering principles

1. **Role and purpose first**: always open the system prompt with a clear statement of the agent's role and the job it exists to do
2. **Explicit scope**: state what the agent may and may not do in the system prompt — this is part of the governance contract
3. **Few-shot examples**: include representative examples of good outputs, especially for complex reasoning or formatting tasks
4. **Guardrail instructions**: include explicit instructions for refusal, escalation, and handling uncertainty
5. **Structured output when needed**: for downstream processing, specify JSON schema or structured format in the prompt
6. **Chain of thought for complex reasoning**: instruct the agent to reason step-by-step before concluding, especially for high-stakes decisions
7. **Token discipline**: minimise verbose instructions; prefer concise, direct language; avoid repetition in system prompts

---

## Compounding Roadmap

The agent roadmap should be designed so that integrations and platform assets built for Wave 1 agents amplify Wave 2 and beyond.

### Roadmap structure

**Wave 1 — Foundation agents** (self-funding, build shared assets):
- Agent 1: [name, purpose, wave rationale]
  - Key integrations built: [list]
  - Shared assets created: [retrieval pipeline, auth pattern, etc.]
- Agent 2: [name, purpose]
  - Reuses: [what from Agent 1]

**Wave 2 — Compounding agents** (leverage Wave 1 assets):
- Agent 3: [name, purpose]
  - Reuses: [CRM integration, RAG pipeline, etc.]
  - New integrations: [list]

**Wave 3 — Multi-agent workflows**:
- Workflow: [name, agents involved, orchestration pattern]

### Integration reuse matrix

| Integration / Asset | Agent 1 | Agent 2 | Agent 3 | Notes |
|--------------------|---------|---------|---------|-------|
| CRM read API | ✓ Build | ✓ Reuse | ✓ Reuse | Shared client |
| RAG / KB pipeline | ✓ Build | ✓ Reuse | | Shared index |
| Auth / identity | ✓ Build | ✓ Reuse | ✓ Reuse | Platform-level |
| Payment API | | | ✓ Build | New in Wave 2 |

Maximising this matrix is the compounding strategy. Every shared asset reduces the marginal cost of future agents.

---

## Agent mapping deliverables summary

Complete these artefacts in order before beginning development:

1. ✅ Agent Purpose Document (one per agent)
2. ✅ Agent Activity Catalog (micro-tasks with delegation levels and tool requirements)
3. ✅ Autonomy Matrix (Decision Authority Matrix)
4. ✅ System and Data Inventory (required integrations, availability, gaps)
5. ✅ Context Engineering Design (memory, retrieval, prompt architecture)
6. ✅ Compounding Roadmap (wave sequencing, integration reuse matrix)

These artefacts are the input to development. A development team that begins without all six artefacts will scope-creep, miss integrations, and produce an agent that works in demos but fails in production.
