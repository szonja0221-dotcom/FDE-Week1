# FDE-Week1
# Permit Pre-Screening System (Agentic Triage)

This repository contains the architecture and core logic for an **agentic pre-screening system** designed to automate the triage of residential building permit applications (~5,800/year).

## 📋 The Scenario
City building departments are often overwhelmed by permit volumes. While many applications are routine (e.g., a simple fence or deck), others require intensive engineering review. 

**The Solution:** An AI Agent analyzes applications against the International Building Code (IBC) and local ordinances. It identifies deficiencies early and routes the application to the appropriate human expert, reducing wait times and manual data entry.

## 🤖 Triage Logic
The agent categorizes every submission into one of three lanes:

* **🟢 ROUTINE (~65%):** Standard projects (small additions, remodels). Fast-tracked to Permit Technicians.
* **🟡 DEFICIENT (~25%):** Missing documents or minor code conflicts. The agent generates an itemized deficiency list for the applicant.
* **🔴 COMPLEX (~10%):** High-valuation or structurally complex projects. Escalated immediately to Senior Plans Examiners.

## 🛡️ Governance & Safety
* **Human-in-the-Loop:** The agent produces *recommendations* only. Every final decision (Approved/Rejected) must be signed by a named human reviewer.
* **Conservative Triage:** If the agent's confidence score is below **95%** for a routine project, it is automatically escalated to a human to ensure zero safety oversights.
* **SLA Enforcement:** Automated tracking ensures routine permits are flagged if not reviewed within 2 business days.

## 🚀 Key Features
- **Multi-Rule Precedence:** Automatically resolves conflicts between Local, State, and IBC codes.
- **Complexity Leakage Protection:** Integrated metrics to track and alert if complex projects are accidentally misclassified.
- **Audit Traceability:** Immutable logs for every agent reasoning step and status transition.
