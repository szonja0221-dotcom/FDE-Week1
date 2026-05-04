# Week 2 — Cognitive Work Assessment & Agent Design

## Where you are

Week 1 tested whether you can design an agentic solution to a business problem and write a buildable spec. Week 2 takes the same skill and turns it outward: given a real business process with people doing messy, inconsistent, partially-documented work, can you figure out what the agents should actually *do*?

Week 2 introduces **ATX — Agentic Transformation** — the methodology the program uses for decomposing cognitive work, scoring delegation suitability, and designing agents that fit real business reality. There is no lecture on ATX. You read the reference pack yourself (5 short documents), you apply the methodology under time pressure on Friday's gate, and you use AI to accelerate every phase of the assessment.

## Your goal this week

Assess a business process as it is actually lived (not as it is documented), map its cognitive work using ATX, determine the delegation architecture, and produce an agent design precise enough to begin development.

## By Friday, you must demonstrate that you can:

- **Elicit how work actually happens** — not what the SOP says
- Decompose cognitive work into **Jobs to be Done, Cognitive Zones, and Breakpoints**
- Score tasks on **delegation suitability** dimensions and assign delegation archetypes (fully agentic, agent-led with oversight, human-led with agent support, human-only)
- Design an agent with purpose, scope, activity catalog, autonomy matrix, and system/data requirements
- Identify where an agent creates **value** versus where it creates **risk**
- Use AI to accelerate every phase of this assessment

## Week 2 calendar

The standing weekly rhythm applies. Week 2 starts on a **physical Tuesday**. Specific physical dates for Week 2's virtual days are confirmed by your coach team in the **Teams General channel** at the start of the week (the exact physical Tuesday depends on the Week 1 wrap and any holiday adjustments).

| Virtual day, Week 2 | Main event |
|---|---|
| **Monday, Week 2** | Coach-led week orientation (1h); self-directed ATX practice begins on this week's scenario |
| **Tuesday, Week 2** | Self-directed work — cognitive load mapping, delegation matrix, agent purpose document |
| **Wednesday, Week 2** | **Morning:** continue practice. **Afternoon:** per-squad mid-week coach checkpoint (~30–45 min per squad) on your in-progress agent designs |
| **Thursday, Week 2** | **Morning:** finish required closed build loop. **14:15 CET:** peer review submission deadline. **14:30–16:00:** peer cross-review session. **16:00–17:00:** feedback incorporation. **17:00 onward:** self-directed refinement and gate prep |
| **Friday, Week 2** | **09:00–12:00 CET:** Gate 2 timed exercise (3 hours). **15:30–17:30 CET:** ~10-minute live clarification round with a coach (your specific slot is confirmed by your coach team). Between 12:00 and 15:30, coaches review submissions — use the time for lunch, decompression, and live-round preparation |
| **Following Monday (Week 3)** | Gate 2 results |

Throughout the week, check the Teams General channel for the **physical date** each virtual day maps to. Week 2's physical calendar is affected by the **Friday 1 May** public holiday — your coach team will have adjusted the schedule accordingly.

## The closed build loop — same principle, different artefact

Same as Week 1, with one key difference: this week, the artefact you hand to Claude Code is your **Agent Purpose Document** (not a traditional capability spec). Use a build prompt along the lines of:

> *"Begin building the agent described in this document. First, tell me what you can build confidently without asking questions. Second, tell me what you need to clarify before building the rest. Third, build the parts you are confident about."*

Then review three outputs from Claude Code:
1. **What it built** — is it faithful to your Agent Purpose Document, or did it drift?
2. **What questions it asked** — each question is a gap in your document
3. **What it said it couldn't build** — each is a buildability gap, usually at a delegation boundary

Diagnose each gap against the Week 1 taxonomy plus one new Week 2-specific category: **delegation boundary gaps** — where Claude Code can't tell from your document whether a step should be fully agentic, agent-led, or human-led, and defaults to whichever is cheapest to implement.

Revise your Agent Purpose Document on the basis of the diagnosis. A good revision usually touches the **autonomy matrix** or the **escalation triggers**, not just the purpose statement. Re-run and verify.

This loop is the move that exposes the "everything is fully agentic" anti-pattern in your own work. **Doing it by Thursday early afternoon is required** — your refined artefact then feeds into the 14:30 peer review session.

## Virtual Thursday afternoon peer cross-review

The Week 2 peer cross-review follows the same pattern as Week 1's, applied against **ATX-shaped artefacts** instead of capability specs. It happens **before** Friday's timed Gate 2 exercise, so you go into the gate with cross-squad feedback already absorbed.

### What to submit (Thursday 14:15 CET cutoff)

Your strongest ATX-shaped practice artefact from Monday–Thursday — typically a **cognitive load map + delegation suitability matrix + agent purpose document** for the practice domain you worked on this week. Your coach introduces the specific practice-domain options at the Virtual Monday orientation; the submission must be for that practice domain (not for the sealed Gate 2 scenario, which you will not have seen yet).

The submission should exercise the **ATX methodology** — not the Week 1 spec-writing skill set. Reviewers will score against the Gate 2 rubric.

### How the 90 minutes are spent

| Phase | Duration | Activity |
|---|---|---|
| Read | 15 min | Each reviewer reads both assigned submissions end-to-end, including any `CLAUDE.md` the participant submitted with their artefact |
| Review 1 | 25 min | Score against the Gate 2 rubric; write returned feedback (see minimum bar below) |
| Review 2 | 25 min | Same pattern for the second assigned submission |
| Feedback return + logistics | 25 min | Post returned feedback to the shared doc; squad leads confirm every participant received their 2 reviews before 16:00 |

**Cross-squad assignment:** You review 2 submissions from **different squads** and receive reviews from 2 reviewers **from different squads**. No one reviews a submission from their own squad. Week 2's assignments are freshly randomised (no reviewer pair repeats from Week 1).

### Minimum feedback bar (Gate 2 rubric focus)

Your returned feedback on each submission must include:

- **At least 3 specific gaps** named against specific elements of the cognitive load map, delegation matrix, or agent purpose document — each gap with a proposed minimum-change fix
- **A delegation-archetype calibration comment:** does the submission justify why each task cluster gets the delegation level it gets, or does it default everything to "fully agentic"? This is the Week 2 anti-pattern peer review must catch
- **A lived-work vs documented-process comment:** does the cognitive load map reflect what the humans actually do, or only what the SOP claims they do?
- **At least 1 strength** the participant should preserve and why
- **A one-sentence calibration note:** is this submission tracking toward a Gate 2 pass as currently drafted?

"Everything is fine" reviews are not acceptable — the bar is higher in Week 2 than in Week 1 because you've had one full week of practice giving peer feedback already.

### What happens between Thursday 17:00 and Friday's Gate 2 timed exercise

You have Thursday evening and Friday morning (before 09:00 CET) to internalise the feedback you received and refine your understanding before the timed exercise begins. Use the time deliberately — re-read the feedback once cold, identify the two or three patterns you'd take into the gate, and prepare. You **cannot** reuse your peer-reviewed artefact as your Gate 2 submission — the gate is a previously unseen scenario released at the start of the timed window.

## Gate 2 — what you'll hand in

On Virtual Friday afternoon you receive a sealed scenario you'll have to work with.

You have **3 hours** to produce **7 deliverables**:

1. **Cognitive Load Map** — decompose at least 2 of the 4 work streams into Jobs to be Done, micro-tasks, and cognitive dimensions. Map zones and breakpoints.
2. **Delegation Suitability Matrix** — score each major task cluster on delegation dimensions; assign archetypes with rationale
3. **Volume × Value Analysis** — plot the 4 work streams; identify the primary agentic target and justify why it wins
4. **Agent Purpose Document** — for the highest-value opportunity: purpose, scope, KPIs, autonomy matrix, escalation triggers, failure modes
5. **System/Data Inventory** — what the agent needs to access, what's available, what's missing, what's risky (the scenario includes a legacy billing system with batch-file-only exports — address it, don't hand-wave)
6. **Discovery questions for the Main Stakeholder** — questions whose answers would *actually* change your design, not generic discovery questions
7. **`CLAUDE.md` for the project** — demonstrates workflow discipline

After submission, you do a **10-minute live clarification round** where a coach plays the Main Stakeholder. She's impatient, sceptical, and answers some questions precisely and others vaguely or contradictorily. You must ask focused discovery questions, detect evasion, and adapt.

**The full Gate 2 rubric (criteria, weights, and pass threshold) will not be shared this time**

## Operating in a domain you don't yet know

Most participants will not have prior expertise in the domain the Gate 2 scenario covers. That's intentional — a working FDE walks into client domains they don't know, every engagement. Gate 2 is partly testing whether you can produce thoughtful, honest work without bluffing the parts you don't know.

Three things change for the domain-naïve participant:

- **Spend the first ~25 minutes on AI-accelerated domain orientation.** Use Claude / Dial / Cursor to build working models of the workflows, decision points, and failure modes typical to the domain you're given. This is a budgeted activity, not procrastination.
- **Discovery Questions (Deliverable #6) carry more weight than they look.** They are the most direct signal of FDE judgment when domain knowledge is shallow. Generic questions ("walk me through your process") are read as bluffing; questions whose answers would actually change your design are read as expertise.
- **The Assumptions log is your honesty register.** Anything you are inferring about the client's tooling, system behaviour, or stakeholder priorities — name it as an assumption with a confidence level and a way to test it. Quiet inference dressed as fact is the failure mode.

The Gate 2 scenario brief includes sample artefacts (snippets of how the work actually happens — calls, emails, partial SOPs, system fragments). They exist to give you something concrete to ground your "lived work" claims against. Use them.

## What coaches are looking for

- Your **Cognitive Load Map reflects lived work**, not the documented SOP. Zones, breakpoints, and micro-tasks are specific and defensible.
- Your **delegation archetypes are justified** — **not everything is "fully agentic".** If every box in your matrix is agentic, you haven't done the real thinking yet. The Week 2 anti-pattern that peer reviewers and coaches watch for most is delegation boundary drift.
- In the **live clarification round**, you ask questions that would materially change the design if answered differently. "Tell me about your process" won't land; "If your standard delivery-exception call takes 4 minutes but your system/billing dispute takes 25, are those the same job or two jobs?" will.
- Your **Discovery Questions show real FDE judgment.** Generic questions are read as bluffing. Questions tied to specific tensions in your brief — friction between work streams, system constraints named in the scenario, stakeholder concerns expressed in the brief — are read as thinking under uncertainty.
- You **don't bluff domain knowledge.** Stating client behaviour or system internals as fact when the brief did not give it to you is the most common Week 2 failure mode. Marked assumptions with confidence levels are the alternative.

## Week 2 Suggested Resource Library

These are starting points, not assignments. Navigate them based on what you need to achieve the week's objective.

**ATX Framework (read this this week):**
- ATX Concepts Reference — `references/atx-concepts.md` — the three production factors, lived vs documented work, compounding thesis
- ATX Business Assessment Reference — `references/atx-assessment.md` — the four-phase ATX assessment methodology
- ATX Agent Mapping Reference — `references/atx-agent-mapping.md` — mapping cognitive work to agent designs
- ATX Use Case Scoring Reference — `references/atx-scoring.md` — volume × value, delegation suitability scoring
- ATX Economics Reference — `references/atx-economics.md` — economics of digital labour (you'll use this more in Week 4)

**Domain-Driven Design (as it applies to agent design):**
- DDD Crew: Free Learning Resources — https://github.com/ddd-crew/free-ddd-learning-resources
- Event Storming Complete Guide — https://www.qlerify.com/post/event-storming-the-complete-guide
- Statecharts: concepts and specification-level modeling — https://statecharts.dev/

**Systems Thinking:**
- Donella Meadows: Leverage Points — https://donellameadows.org/archives/leverage-points-places-to-intervene-in-a-system/

**Agent Design:**
- Anthropic: Writing Tools for Agents — https://www.anthropic.com/engineering/writing-tools-for-agents
- Simon Willison: Agentic Engineering Patterns — https://simonwillison.net/guides/agentic-engineering-patterns/

**Discovery & Questioning:**
- Discovery questioning patterns — `discovery-questioning-patterns.md`

**Carried forward from Week 1:**
- Build-loop diagnostic taxonomy — `spec-ambiguity-vs-builder-mistakes.md`
