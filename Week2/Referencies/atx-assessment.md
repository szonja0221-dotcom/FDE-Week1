# ATX Business Assessment Reference

## Overview

The ATX assessment converts a client's real operations into a prioritised agentic opportunity map. It runs in four phases: discovery, cognitive mapping, delegation qualification, and candidate prioritisation.

**Critical principle**: start from lived work, not documented processes. Ask to shadow people, review transcripts, walk through real cases — not SOPs.

---

## Phase 1: Discovery — Understanding Points of Pain

### Goal
Identify the cognitive workloads that consume the most skilled human time, carry the most operational friction, or represent the highest cost-per-task.

### Interview guide

Ask process owners and frontline workers, not just IT and project managers:

**Volume & time:**
- What tasks do your best people spend the most time on every day?
- Which processes require the most back-and-forth, clarification, or exception handling?
- How many cases/requests/decisions does your team handle per day, week, month?
- Where do queues build up? What are your SLA breach patterns?

**Cognitive nature:**
- What decisions do you make dozens of times a day that "mostly follow a pattern"?
- Where do you spend time gathering information before you can act on something?
- What would you automate if you could — not the whole job, but the exhausting parts of it?
- What knowledge lives in your head (or in colleagues' heads) that isn't written down anywhere?

**Data and systems:**
- Which systems do you touch in a typical workday?
- Where do you manually copy data between systems?
- Which systems have good APIs? Which are black boxes?
- Where is data messy, incomplete, or inconsistent?

**Risk and compliance:**
- Which decisions have the highest consequence if wrong?
- Which processes are regulated, audited, or subject to strict SLAs?
- Are there approval workflows that feel excessive for the risk involved?

**Organisational:**
- Where do you rely heavily on outsourcing or contractors?
- What tasks are hardest to onboard new staff into?
- What do people complain about most?

### Output
- A **Points of Pain inventory**: a list of candidate processes with rough volume, pain level, and data/system context.

---

## Phase 2: Cognitive Load Mapping

### Goal
For each candidate process, decompose the cognitive work into Jobs to be Done, Cognitive Zones, and micro-tasks.

### Step-by-step

**Step 1: Map the lived process**
- Walk through a real case (not an SOP) with the person who does the work
- Capture: triggers, inputs, intermediate decisions, outputs, escalations
- Document where the worker pauses, checks a reference, calls someone, or makes a judgment call — these are the cognitive hotspots

**Step 2: Decompose into Jobs to be Done**
- Break the process into JtDs: cognitive contracts between actor and outcome
- Each JtD should have: trigger, actor, goal, key decisions, key systems, expected output
- Flag whether the JtD is primarily decision-making, execution, synthesis, communication, or exception-handling

**Step 3: Map Cognitive Zones and Breakpoints**
- Group micro-tasks into zones (e.g. intent understanding, data retrieval, diagnosis, decision, action, documentation)
- Mark breakpoints where control shifts: human → system, system → human, rule → judgment

**Step 4: Build the micro-task inventory**

For each micro-task, capture:

| Dimension | Description | Score (H/M/L) |
|-----------|-------------|---------------|
| **Cognitive Load** | How much reasoning, tacit knowledge, or disambiguation required | |
| **Input Structure** | Are inputs structured, semi-structured, or unstructured? | |
| **Decision Determinism** | Are outcomes predictable given inputs, or judgment-dependent? | |
| **Exception Frequency** | How often do edge cases occur that break the standard path? | |
| **Turn-Taking Degree** | How much back-and-forth with humans, systems, or both? | |
| **Latency Constraint** | Is real-time response required, or is batch acceptable? | |
| **Compliance/Risk Sensitivity** | What is the cost of an error? Regulated? Audited? | |
| **Tool/API Availability** | Can the agent access the required data and systems? | |

### Output
- **Cognitive Load Map**: table of micro-tasks with dimension scores
- **Process topology diagram**: zones, breakpoints, and handoffs (textual or visual)
- **Lived process narrative**: 1-page description of what really happens vs. what the SOP says

---

## Phase 3: Delegation Qualification

### Goal
Determine how far each task or JtD can be safely delegated to an agent.

### Suitability scoring

Score each candidate on the delegation suitability dimensions:

| Dimension | High suitability | Low suitability |
|-----------|-----------------|-----------------|
| Input structure | Structured, machine-readable | Unstructured, ambiguous, requires interpretation |
| Decision determinism | Clear rules, predictable outputs | Judgment-dependent, contextual, implicit |
| Tool coverage | APIs available or buildable | Systems inaccessible, black-box, or manual |
| Context complexity | State can be made explicit | Requires institutional knowledge or relationship history |
| Exception rate | Rare, predictable exceptions | Frequent, unpredictable edge cases |
| Latency constraint | Batch or async acceptable | Real-time, sub-second response required |
| Risk/compliance | Reversible, low consequence | Irreversible, regulated, high-consequence |

### Delegation archetype assignment

Based on suitability scores, assign each JtD/task to an archetype:

- **Human Only**: ≥3 dimensions at Low suitability, especially risk/compliance and decision determinism
- **Human-led + Automation Support**: deterministic sub-tasks can be automated; judgment stays human
- **Human-led + Agent Support**: agent provides synthesis, research, recommendations; human decides
- **Agent-led + Human Oversight**: agent acts autonomously; human reviews or approves high-stakes outputs
- **Fully Agentic**: all dimensions at Medium or High; volume justifies full delegation

**Anti-pattern check**: If a task could be solved with static rules, RPA, or a simple script — do not build an agent. Agents are for non-determinism, not for engineering overhead.

### Output
- **Delegation Suitability Matrix**: tasks × dimensions × archetype assignment with rationale

---

## Phase 4: Candidate Prioritisation

### Volume × Value grid

Plot each qualified candidate on:
- **Y-axis**: Execution frequency / volume (cases per day/week)
- **X-axis**: Non-deterministic decision effort (how much does this task require reasoning beyond rules?)

Priority zones:
- **Top right** (high volume, high non-determinism): primary agentic targets
- **Top left** (high volume, low non-determinism): rules/RPA, not agents
- **Bottom right** (low volume, high non-determinism): consider agents in select use cases
- **Bottom left**: not worth automating

### Feasibility scoring

For each prioritised candidate, score:

| Factor | Score (1-5) | Notes |
|--------|-------------|-------|
| Data availability | | Is required data accessible and clean? |
| System integration feasibility | | APIs, connectors, or reasonable build effort |
| Compliance risk | | Red flags for EU AI Act, GDPR, sector regulation |
| Context stability | | Does the domain change frequently? |
| Organisational readiness | | Change management, HITL tolerance, leadership buy-in |
| TCO viability | | Preliminary sense-check: does economics likely close? |

### Output
- **Prioritised candidate shortlist**: ranked with feasibility scores and recommended waves
- **Implementation sequencing logic**: which use cases fund the next wave

---

## Assessment delivery format

For a formal client engagement, deliver these artefacts in sequence:

1. Points of Pain workshop output (sticky notes / affinity map → structured list)
2. Cognitive Load Map (spreadsheet or structured document, one per process)
3. Delegation Suitability Matrix (one per process, with archetype assignments)
4. Volume × Value grid (visual, 2×2 quadrant)
5. Prioritised candidate shortlist (with feasibility scores and wave sequencing)

These five artefacts constitute the "Discovery and Assessment" phase of the ATX Blueprint and are the input to Agent Mapping and Business Case development.
