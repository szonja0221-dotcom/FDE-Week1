# Discovery Questioning Patterns for FDE Client Assessments

## The FDE Discovery Mindset

Traditional business analysis discovers requirements to feed into a system design—you ask "what does the user need the system to do?" and capture functional and non-functional requirements. FDE discovery is different.

You are not gathering requirements for a system. You are mapping cognitive work to determine what can be delegated to AI agents.

The diagnostic question is not "what should we build?" It is "where is human attention, judgment, and pattern-matching being consumed by tasks that an AI agent could perform, decide, or coordinate?"

This requires a different mode of listening. You are listening for:
- Pause points (where humans stop to think, consult, or verify)
- Judgment calls (where the rule is complex, context-dependent, or has exceptions)
- Coordination work (where someone is shepherding information across tools, people, or systems)
- Pattern recognition (where someone is trained to spot anomalies or match cases to precedents)
- Async waits (where someone is blocked on input from another person or system)

## The Funnel Pattern

Structure discovery calls as a funnel: broad → narrow → probe.

### Level 1: The Broad Funnel (Opening, 5-10 minutes)

Start with open-ended questions about work patterns, not specific tasks.

**Sample questions:**
- "Walk me through how your team spends time on a typical day. What are the biggest time sinks?"
- "When you say you're 'busy,' what kinds of work are you actually doing? Can you give me an example from this week?"
- "If I were shadowing your team, what would I see consuming the most attention?"
- "What work feels repetitive vs. what feels genuinely new each time?"

**What you're listening for:**
- Categories of work (e.g., "scheduling," "compliance checks," "data entry," "stakeholder coordination")
- Frequency and scale (e.g., "we process 200 orders a day," "I spend 3 hours on email")
- Frustration points (e.g., "the system doesn't talk to that other system, so we have to manually")
- Context switching (e.g., "I'm jumping between five tools")

**What to avoid:**
- "Tell me about your current system" — you'll get a feature tour, not work patterns
- "What are your pain points?" — too vague; people revert to standard complaints
- Leading questions like "Do you spend a lot of time on data entry?" — yes/no kills exploration

### Level 2: The Narrow Funnel (Zooming in, 15-20 minutes)

Pick one category that showed cognitive load, pause points, or coordination work. Zoom in.

**Sample questions:**
- "You mentioned that scheduling is a headache. Walk me through an actual scheduling scenario from the past week. Not how it's supposed to work—how did it actually happen?"
- "When you process those orders, where do you have to stop and think? Where do you have to call someone or check something?"
- "You said you're copying data between tools. Why can't the system do that automatically?"
- "Tell me about the last time something went wrong in this process. What happened?"

**What you're listening for:**
- Specific pause points (e.g., "I have to check the vendor database because the order system doesn't know if we have it in stock")
- Judgment calls and their criteria (e.g., "I have to decide if this request is urgent, which depends on the client, the inventory level, and what else is in the queue")
- Exception handling (e.g., "Usually we follow the SOP, but if the client is a VIP, we expedite")
- Information sources (e.g., "I check three different systems to decide")

**What to avoid:**
- Accepting SOP answers — push back gently: "That's what the manual says, but in practice what actually happens?"
- Binary questions — "Do you have to verify credentials?" Expand: "How do you verify? What makes something verify vs. not verify? What's ambiguous?"

### Level 3: The Probe Funnel (Detecting Delegation Signals, 15-20 minutes)

Given what you've learned, probe for agentic patterns.

**Sample questions:**
- "When you make that decision [the judgment call you identified], is there a pattern? Like, if X is true and Y is true, you do A; if Z is true, you do B?"
- "How often are you actually thinking vs. executing a pattern you've already decided?"
- "What would it take to document the criteria you use to decide this? Could you articulate it right now?"
- "Are there any cases where you'd be comfortable with an AI agent making this decision if you could review it first?"
- "If something goes wrong—let's say the agent makes the wrong call—what's the consequence? How would you detect it?"
- "Is this something that happens in real-time (blocking), or could it happen asynchronously (agent queues it, you review it later)?"
- "What percentage of cases fit the standard pattern vs. exceptions?"

**What you're listening for:**
- Codifiability (can the decision rule be articulated, even roughly?)
- Exception rate (if > 20% of cases are exceptions, agent must handle them)
- Risk and reversibility (is a mistake high-stakes or easily corrected?)
- Latency requirements (does it need to happen immediately, or is there time for agent work + human review?)
- Human trust (is the person open to an agent handling this with oversight?)

**What to avoid:**
- Assuming complexity means "unbuildable" — some of the highest-value agentic work is in complex judgment calls
- Assuming simplicity means "ready to automate" — simple + high-exception-rate is harder than complex + consistent

## Question Categories Aligned with ATX Assessment

Use these question categories to conduct a structured ATX assessment during discovery.

### Volume & Time
Focus on understanding labor intensity and opportunity.

- "How many [cases/requests/orders/applications] does your team process per week/month?"
- "How much time does each one take, end-to-end?"
- "What's your team's total capacity, and what percentage is consumed by [the process in question]?"
- "Is volume predictable, or does it spike?"
- "What happens when volume exceeds capacity?"

### Cognitive Nature
Understand the type of work and where judgment lives.

- "Walk me through a real case. What are the steps, and at which steps do you have to think, decide, or check something?"
- "What would a junior person in your role not know how to do? What takes training?"
- "Are there cases that don't fit the normal pattern? How often? How do you recognize them?"
- "What rules or heuristics do you apply when the decision isn't obvious?"
- "How confident are you in your decisions? Do you ever second-guess yourself or ask someone to review?"

### Data & Systems
Map the information landscape.

- "Where does the input data come from? How does it get to you?"
- "How many systems do you need to access to complete this process?"
- "What data do you look at that's in a system vs. what's in email/documents/someone's head?"
- "Is the data you need always available, or do you sometimes have to wait or hunt for it?"
- "Are there data quality issues? What do you do if the data is incomplete or contradictory?"

### Risk & Compliance
Understand constraints, stakes, and governance.

- "What could go wrong if this process runs incorrectly?"
- "Are there compliance or regulatory requirements? What are the consequences of non-compliance?"
- "Is there an audit trail requirement? Who needs to know that this happened?"
- "If you made a mistake, how would you detect it? Who would notice?"
- "Is there a way to reverse a decision, or is it permanent?"
- "Who is accountable for the outcome of this decision?"

### Organisational
Understand handoffs, stakeholders, and coordination.

- "Who depends on the output of this process?"
- "Does this work require coordination across teams?"
- "Are there approval gates? Who approves, and what are they checking for?"
- "Do stakeholders ever push back or request changes after the work is 'done'?"
- "Is there a backlog of work, or is it handled in real-time?"

## The "Lived vs Documented" Probe

This is the most valuable diagnostic technique.

Every process has two versions:
1. **Documented**: The SOP, the process diagram, the training manual—what's supposed to happen
2. **Lived**: What actually happens, including workarounds, judgment calls, and exceptions

Documented processes are often missing the context-dependent judgment and the exceptions that make work hard. Lived processes reveal where complexity and cognitive load actually sit.

**How to probe:**

Start by asking them to walk through a real case:
- "I want to understand your process. Can you pick a case you handled this week and walk me through it step by step? Not the SOP—what actually happened."

Listen for differences from what they said before:
- "Earlier you said X always happens, but in this case it didn't. Why?"
- "You skipped a step from the SOP. Why?"
- "You checked this system, but the SOP didn't mention it. Why?"

Ask about the exception patterns:
- "How often does the process work exactly as written?"
- "What's the most common deviation from the SOP?"
- "What conditions cause you to deviate?"

Ask about judgment calls:
- "At this point, you made a decision. What was that decision based on?"
- "Would someone else make the same decision, or does it depend on your judgment?"
- "How do you know your decision was right?"

**What to do with the gap:**
- If documented and lived are vastly different, the documented process is not the real target for automation—the lived process is. Build agent specs against lived process.
- If people are working around the system, that's a signal: either the system doesn't match the real work, or the real work is more complex than the system was designed for.
- If judgment is mixed into a "simple" process, don't let people convince you it's automatable—interrogate the judgment rules.

## Detecting Evasion and Contradiction

Some stakeholders will give you SOP answers even when you ask for lived-process answers. Some will contradict themselves without realizing it.

**Evasion signals:**
- "We follow the process as documented" — not really what you asked
- "It depends on the situation" — true, but vague; push for actual situations
- "It's different every time" — maybe, but there are still patterns; ask for three real examples

**Contradiction signals:**
- "This is a complex process with many variables" but earlier they said "it's pretty straightforward"
- "We don't make judgment calls; we just follow the rules" but then describes three different scenarios handled three different ways
- "There are no exceptions" but mentions three exceptions

**How to address it:**
- Gently point out the gap: "You said X, but when you walked through the case, you did Y. Can you help me understand?"
- Ask for specificity: "When you say 'it depends,' can you give me two examples where it went different ways?"
- Reframe: "It sounds like the process is more flexible than the SOP suggests. Is that right?"

## 60-Minute Discovery Call Structure

Plan for a single discovery call as follows:

**Minutes 0-5: Context Setting**
- Explain that you're not here to audit their current process or judge it
- You're trying to understand where AI could help
- You'll be asking them to walk through real work, not just talk about systems
- Roughly how much of their time does [the process] consume?

**Minutes 5-15: Broad Funnel**
- Open-ended question about work patterns
- Listen for categories and frustration points
- Pick the most promising area (high volume, high cognitive load, or clear coordination pain)

**Minutes 15-30: Narrow Funnel**
- Deep dive into one process
- "Walk me through a real case"
- Map the steps, pause points, judgment calls

**Minutes 30-45: Lived vs Documented**
- If there's a SOP, compare it to what they actually do
- Probe for judgment rules and exception patterns
- Quantify (what percentage of cases fit the standard pattern?)

**Minutes 45-55: Delegation Signals**
- Ask about codifiability and risk
- "Would you be comfortable with an agent handling this with human review?"
- Assess latency requirements

**Minutes 55-60: Close and Next Steps**
- Summarize what you've learned
- Confirm key facts
- Outline what you'll do with this information

## Using AI to Prepare and Debrief

### Pre-Call Preparation (use Claude Code)

1. **Domain Research**
   - "Search for industry standards in [domain]. What are the typical processes? What are common pain points?"
   - "What regulations or compliance frameworks apply to [this process]?"
   - Gather enough context to listen intelligently

2. **Hypothesis Questions**
   - "For a [role] in a [domain] company, what are typically the highest-leverage opportunities for agentic AI? Generate 10 hypothesis questions I should ask."
   - Use these as guardrails, not a script

3. **ATX Mapping**
   - "Given what I know about [the process], map it to the ATX Volume, Cognitive Nature, Data, Risk, and Organisational dimensions. What should I probe most deeply?"

### Post-Call Debrief (use Claude Code)

1. **Transcription Processing**
   - Share the call transcript or detailed notes
   - "Summarize this discovery call, identifying: (a) core processes discussed, (b) pause points and judgment calls, (c) exception rate and codifiability signals, (d) risk and latency constraints"

2. **Lived Process Documentation**
   - "Based on these notes, reconstruct the lived process for [process name] as a step-by-step flow. Flag where judgment calls occur and what criteria drive them."

3. **Agentic Opportunity Identification**
   - "For each step or judgment call, assess: could an agent handle this? What would it need to know? What are the failure modes? What would require human review?"

4. **ATX Scoring Draft**
   - "Based on this discovery, draft an ATX assessment score for this process area. Justify the score for Volume, Cognitive Nature, Data maturity, Risk, and Organisational alignment."

5. **Follow-Up Questions**
   - "What did I not ask that I should have? What gaps are there in my understanding?"

This post-call synthesis turns scattered notes into structured client context that informs spec writing and architecture decisions.

## Closing Principles

- **Listen for work patterns, not system features.** The system is a tool; the work is the target.
- **Lived process > documented process.** Real work has judgment, exceptions, and shortcuts that the SOP doesn't capture.
- **Codifiability is the key diagnostic question.** Can the decision rule be articulated? If yes, how many exceptions? If > 20%, the agent needs to handle them or escalate.
- **Risk assessment is non-negotiable.** What are the consequences of an agent getting this wrong? Can it be reversed? Who is liable?
- **Latency matters.** Real-time decisions vs. batch + review have different architecture and trust implications.
- **Contradiction is information.** When someone contradicts themselves, that gap is often where complexity lives.

Discovery is detective work. You're not taking testimony; you're piecing together how work actually happens so you can identify where AI can think and act on behalf of humans.
