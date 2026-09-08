# Enterprise Multi-Department Workflow Design
**OpenDhi / ADT AI Execution Layer — Journeys 1–3**
Version 1.0 · Document deliverable — architecture & product design, no code changes in this pass

---

## 1. Executive Summary

### What this is

This document redesigns the three AI Execution Layer journeys — **Contract Creation (O2C)**, **Payroll Creation (H2R)**, and **H2R Lifecycle (Hire to Retire)**, including its three mid-employment sub-journeys — from single-actor-per-step flows into a proper **multi-department, role-based enterprise workflow**. Every step is owned by exactly one department and role. The same step graph runs in two execution modes without redesign: **Manual Mode** (every task done by a human today) and **AI Mode** (AI agents automate eligible tasks, humans approve/review/resolve exceptions).

### Relationship to existing source material

- **`journey-execution-model_v1.md`** is the user's own prior architecture sketch — `Agent`/`SkillContract`/`Journey`/`Step` (with `owner_type` and `guardrail`)/`JourneyInstance`/`StepEvent`/`ApprovalRequest`. This document is the **granular, department-grounded expansion** of that sketch: where the v1 model described the *shape* of a governed journey engine, this document supplies the *actual departments, roles, personas, and 47 real steps* that populate it. §12 (Database Entities) extends the v1 schema directly rather than replacing it.
- **`Journey_Product_Thinking_v3.docx`** is the authoritative step map for all three journeys (Part 1 of that document — its own table of contents promises Parts 2–4 covering personas/problems/solutions, but the document as it exists only contains Part 1).
- **`Journey_1_Complete.md`** is the deeper persona/problem-statement treatment that exists for Journey 1 only (7 department personas, each with named individuals). Where useful, this document borrows those named individuals for Journey 1's steps; Journeys 2 and 3 use role titles only, since no equivalent persona document exists for them.

### Conventions used throughout this document

**Priority scale** (applied to every step):
- **P0** — blocking. The journey cannot proceed to the next step without this one completing.
- **P1** — important. Should complete within its SLA; some downstream work may proceed on adjacent branches while this is pending, but the journey as a whole is gated on it eventually.
- **P2** — enrichment/optional. Does not block journey completion; can be resolved with an override note.

**SLA scale**:
- AI-automated steps: **Instant (< 1 minute, automated)**.
- AI-assisted steps with an optional human review window: **Instant generation + 4 business hours optional review**.
- Human approval steps marked "Always Required" in the source docs: **4 business hours**.
- Human approval steps marked "On Deviation Only" (rarer, more complex): **8 business hours**.
- Financial approval gates (Finance Approver): **4 business hours** (payroll/settlement is time-sensitive).

**Escalation chain** (referenced per step as "standard escalation" unless a step has a specific override): Account Manager → Deal Manager; HR → HR Manager; Deal Manager / HR Manager / Finance Approver / Compliance Officer / Legal-Contracts Manager / Ops Manager / IT-Systems Admin → **Entity Admin** (tenant governance) if unresolved past 2× the step's SLA. Entity Admin → **Super Admin** (platform ops) if still unresolved past a further SLA window. This mirrors the 3-tier `Super Admin / Entity Admin / Entity User` portal structure already built into the Executivelayer_mockup app — department personas are all within the Entity User tier; escalation past them lands on Entity Admin, then Super Admin.

### The 9-persona roster

| # | Persona | Department | Function | Named individual (Journey 1 only) |
|---|---|---|---|---|
| 1 | Account Manager / Deal Desk | Sales / Deal Desk | Executor | Arjun Vaidya |
| 2 | Deal Manager | Sales / Deal Desk | Approver | — |
| 3 | Compliance Officer | Compliance | Executor + Consultant | Kavya Iyer |
| 4 | Legal / Contracts Manager | Legal / Contracts | Executor | Devendra Rao |
| 5 | Ops Manager | Operations | Approver | Sunita Kulkarni |
| 6 | **HR** | HR | Executor (onboarding, benefits, payroll processing) | Rima Mohaty Dixit / Priyanka Bhatt |
| 7 | **HR Manager** | HR | Approver + escalation/exception owner | — |
| 8 | IT / Systems Admin | IT / Systems Admin | Executor | Rohit Menon |
| 9 | Finance Approver | Finance | Approver (financial control) | — |

HR and HR Manager are deliberately distinct: HR executes onboarding, benefits enrollment, and most payroll processing (attendance, calculation, slip generation, SAP reconciliation), jointly with Finance on the actual disbursement execution (J2-S7 — Finance moves the money, HR triggers/monitors the run); HR Manager holds the scheduled approval gates (deviation, role change, salary revision) **and** is the standing escalation/exception owner for anything HR executes — the same executor/approver split already used in Sales (Account Manager executes, Deal Manager approves).

---

## 2. End-to-End Workflow — All 3 Journeys

Every step below is one "unit of work." 29 primary steps across the 3 main journeys + 18 sub-steps across the 3 H2R sub-journeys = **47 units total**, none omitted or merged.

### Journey 1 — Contract Creation (O2C), 9 steps, 2 approvals

**J1-S1 — Deal Created & Employee Record Created**
- **Dept / Role / Persona:** Sales / Deal Desk · Account Manager · Arjun Vaidya
- **Inputs:** Natural-language deal prompt (client, country, contract type); existing employee records to match against
- **Outputs:** Deal record; Employee record (created or matched)
- **Entry Criteria:** Sales conversation confirms client intent to hire
- **Exit Criteria:** Deal record exists with an employee linked; no unresolved duplicate-match flags
- **Previous Step:** — (journey start) | **Next Step:** J1-S2
- **SLA:** Instant (automated); ambiguous-match resolution 4 business hours
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Ambiguous name match flagged to Account Manager for manual selection; unresolved past 4h → standard escalation to Deal Manager
- **Documents Required:** None mandatory
- **Notifications Required:** Compliance Officer (deal created, compliance check pending)

**J1-S2 — Compliance Check (Compliance Hub)**
- **Dept / Role / Persona:** Compliance · Compliance Officer · Kavya Iyer
- **Inputs:** Deal's country/contract type
- **Outputs:** Statutory requirements, EOR obligations, tax rates, work permit rules attached to the deal record
- **Entry Criteria:** J1-S1 complete
- **Exit Criteria:** Compliance Hub query result attached; no unresolved exception
- **Previous Step:** J1-S1 | **Next Step:** J1-S3
- **SLA:** Instant (automated); exception resolution 4 business hours
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Missing country configuration → exception flagged to Compliance Officer; unresolved past 4h → standard escalation to Entity Admin
- **Documents Required:** None
- **Notifications Required:** Account Manager (compliance data ready)

**J1-S3 — Proposal Drafted**
- **Dept / Role / Persona:** Sales / Deal Desk · Account Manager · Arjun Vaidya
- **Inputs:** Compliance data from J1-S2; rate rules
- **Outputs:** Structured proposal (billing rate, pay rate, margin, compliance checklist)
- **Entry Criteria:** J1-S2 complete
- **Exit Criteria:** Proposal generated, margin validated within policy
- **Previous Step:** J1-S2 | **Next Step:** J1-S4
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Missing rate data blocks send and raises an exception to Account Manager; unresolved 4h → Deal Manager
- **Documents Required:** Generated proposal document
- **Notifications Required:** Deal Manager (proposal ready for review)

**J1-S4 — Proposal Approved (Internal)**
- **Dept / Role / Persona:** Sales / Deal Desk · Deal Manager · —
- **Inputs:** Proposal from J1-S3, compliance checklist, rates
- **Outputs:** Approval decision + timestamp, or rejection with correction notes
- **Entry Criteria:** J1-S3 complete
- **Exit Criteria:** Deal Manager decision recorded
- **Previous Step:** J1-S3 | **Next Step:** J1-S5 (approve) or back to J1-S3 (reject)
- **SLA:** 4 business hours
- **Priority:** P0
- **Approval Required:** **Yes — Always Required**
- **Escalation Rules:** Standard escalation to Entity Admin if breached
- **Documents Required:** Proposal document
- **Notifications Required:** Account Manager (decision), Compliance Officer (if rejected)

**J1-S5 — Client Proposal Sent & Acceptance Tracked**
- **Dept / Role / Persona:** Sales / Deal Desk · Account Manager · Arjun Vaidya
- **Inputs:** Approved proposal
- **Outputs:** Client acceptance status
- **Entry Criteria:** J1-S4 approved
- **Exit Criteria:** Client acceptance recorded (accepted / rejected / verbally accepted)
- **Previous Step:** J1-S4 | **Next Step:** J1-S6
- **SLA:** Instant send (automated); acceptance window 5 business days
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** No response after SLA window → alert Account Manager; rejection → routes back to Deal Manager
- **Documents Required:** Sent proposal copy
- **Notifications Required:** Deal Manager (client response)

**J1-S6 — Contract Generated & Sent for Signature**
- **Dept / Role / Persona:** Legal / Contracts · Legal / Contracts Manager · Devendra Rao
- **Inputs:** Accepted proposal terms, Compliance Hub clause templates
- **Outputs:** Employment contract, Docuseal signature request
- **Entry Criteria:** J1-S5 accepted
- **Exit Criteria:** Contract generated, signature request sent, tracked
- **Previous Step:** J1-S5 | **Next Step:** J1-S7
- **SLA:** Instant generation (automated); signature window 5 business days
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Bounced/timed-out signature raises an exception to Legal/Contracts Manager for resend
- **Documents Required:** Generated employment contract
- **Notifications Required:** Ops Manager (contract sent)

**J1-S7 — Contract Signed & Approved (Internal)**
- **Dept / Role / Persona:** Operations · Ops Manager · Sunita Kulkarni
- **Inputs:** Countersigned contract, approved proposal terms
- **Outputs:** Approval decision + discrepancy notes if any
- **Entry Criteria:** Client countersignature received
- **Exit Criteria:** Ops Manager decision recorded
- **Previous Step:** J1-S6 | **Next Step:** J1-S8 (approve) or back to J1-S6 (discrepancy)
- **SLA:** 4 business hours
- **Priority:** P0
- **Approval Required:** **Yes — Always Required**
- **Escalation Rules:** Standard escalation to Entity Admin if breached
- **Documents Required:** Signed contract
- **Notifications Required:** HR (onboarding can start), Legal/Contracts Manager (if discrepancy)

**J1-S8 — Onboarding**
- **Dept / Role / Persona:** HR · HR (executor) · Rima Mohaty Dixit
- **Inputs:** Approved contract, employee record
- **Outputs:** Completed onboarding checklist (documents, compliance items, system access request)
- **Entry Criteria:** J1-S7 approved
- **Exit Criteria:** All onboarding checklist items complete or explicitly waived
- **Previous Step:** J1-S7 | **Next Step:** J1-S9
- **SLA:** Automated checklist run instant; document collection 5 business days
- **Priority:** P0
- **Approval Required:** No (exceptions escalate — see below)
- **Escalation Rules:** Missing document → exception to HR; unresolved past 5 business days → standard escalation to HR Manager
- **Documents Required:** Onboarding document set (per country checklist)
- **Notifications Required:** IT/Systems Admin (access provisioning needed), Payroll (readiness pending)

**J1-S9 — Ready for Payroll**
- **Dept / Role / Persona:** HR · HR (executor) · Priyanka Bhatt
- **Inputs:** Bank details, tax info, compensation mapping
- **Outputs:** Payroll-readiness confirmation
- **Entry Criteria:** J1-S8 complete
- **Exit Criteria:** All payroll-required fields validated complete
- **Previous Step:** J1-S8 | **Next Step:** Journey Complete → feeds Journey 2 (Payroll Creation)
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Incomplete fields raise exception to HR; unresolved 4h → HR Manager
- **Documents Required:** Bank details form, tax ID
- **Notifications Required:** Finance Approver (employee ready for next payroll cycle)

### Journey 2 — Payroll Creation (H2R), 8 steps, 2 approvals

**J2-S1 — Prompt Given / Payroll Run Initiated**
- **Dept / Role / Persona:** HR · HR (executor) · Priyanka Bhatt
- **Inputs:** Employee name/ID, pay period
- **Outputs:** Initiated payroll run scoped to employee(s)
- **Entry Criteria:** Pay cycle due, or ad hoc run requested
- **Exit Criteria:** Run scope resolved against Employee records
- **Previous Step:** — (journey start) | **Next Step:** J2-S2
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Unresolved employee ID → exception to HR; unresolved 4h → HR Manager
- **Documents Required:** None
- **Notifications Required:** Finance Approver (run initiated)

**J2-S2 — Attendance & Timesheet Capture**
- **Dept / Role / Persona:** HR · HR (executor) · Priyanka Bhatt
- **Inputs:** Attendance/timesheet records for the pay period, approved leave records
- **Outputs:** Reconciled attendance data
- **Entry Criteria:** J2-S1 complete
- **Exit Criteria:** Attendance reconciled against leave, no mismatch
- **Previous Step:** J2-S1 | **Next Step:** J2-S3
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Missing/mismatched data → exception to HR; unresolved 4h → HR Manager
- **Documents Required:** Attendance export
- **Notifications Required:** None routine

**J2-S3 — Salary Calculation**
- **Dept / Role / Persona:** HR · HR (executor) · Priyanka Bhatt
- **Inputs:** Reconciled attendance, payheads, statutory deduction rates from Compliance Hub
- **Outputs:** Gross pay, deductions, net pay per employee
- **Entry Criteria:** J2-S2 complete
- **Exit Criteria:** Calculation complete, no rate mismatch
- **Previous Step:** J2-S2 | **Next Step:** J2-S4
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Rate mismatch → exception to Finance Approver for review
- **Documents Required:** None
- **Notifications Required:** Finance Approver (calculation ready)

**J2-S4 — Payroll Calculation Approved**
- **Dept / Role / Persona:** Finance · Finance Approver · —
- **Inputs:** Full calculation breakdown, compliance check results
- **Outputs:** Approval decision + timestamp, or rejection with correction notes
- **Entry Criteria:** J2-S3 complete
- **Exit Criteria:** Finance Approver decision recorded
- **Previous Step:** J2-S3 | **Next Step:** J2-S5 (approve) or back to J2-S3 (reject)
- **SLA:** 4 business hours
- **Priority:** P0
- **Approval Required:** **Yes — Always Required**
- **Escalation Rules:** Standard escalation to Entity Admin if breached
- **Documents Required:** Payroll calculation summary
- **Notifications Required:** HR (decision)

**J2-S5 — Salary Slip Generated**
- **Dept / Role / Persona:** HR · HR (executor) · Priyanka Bhatt
- **Inputs:** Approved calculation
- **Outputs:** Formatted salary slips per employee, stored and distributed
- **Entry Criteria:** J2-S4 approved
- **Exit Criteria:** Slips generated for full batch
- **Previous Step:** J2-S4 | **Next Step:** J2-S6
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Generation failure → exception to HR for retry
- **Documents Required:** Generated salary slips
- **Notifications Required:** Finance Approver (slips ready, disbursement can be authorised)

**J2-S6 — Disbursement Authorised**
- **Dept / Role / Persona:** Finance · Finance Approver · —
- **Inputs:** Generated salary slips, fund availability
- **Outputs:** Explicit disbursement authorisation, a second distinct financial control from J2-S4
- **Entry Criteria:** J2-S5 complete
- **Exit Criteria:** Authorisation decision recorded (full / partial / held)
- **Previous Step:** J2-S5 | **Next Step:** J2-S7
- **SLA:** 4 business hours
- **Priority:** P0
- **Approval Required:** **Yes — Always Required**
- **Escalation Rules:** Standard escalation to Entity Admin if breached
- **Documents Required:** None additional
- **Notifications Required:** HR (authorisation status)

**J2-S7 — Payment Disbursed**
- **Dept / Role / Persona:** HR + Finance (joint execution) · HR (executor, triggers/monitors the run) + Finance (executes the actual fund transfer/card load) · Priyanka Bhatt (HR) / Finance team
- **Inputs:** Disbursement authorisation
- **Outputs:** Bank transfer (EOR) or RBL/Paycraft card load (ADT blue-collar), per-employee status
- **Entry Criteria:** J2-S6 authorised
- **Exit Criteria:** All payments in the batch reach a terminal outcome (success or flagged failure)
- **Previous Step:** J2-S6 | **Next Step:** J2-S8
- **SLA:** Instant trigger (automated); settlement confirmation per banking rails
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Payment failure raises a per-employee exception to Finance (fund-movement issue) and HR (employee-facing follow-up); unresolved 4h → HR Manager
- **Documents Required:** Payment confirmation
- **Notifications Required:** Finance Approver (disbursement complete), affected employees (on failure)

**J2-S8 — ERP Write-back (SAP Reconciliation)**
- **Dept / Role / Persona:** HR · HR (executor) · Priyanka Bhatt
- **Inputs:** Disbursed payroll batch, cost-centre/account mapping from Data Foundation
- **Outputs:** Posted GL entries in SAP
- **Entry Criteria:** J2-S7 complete
- **Exit Criteria:** Posting confirmed
- **Previous Step:** J2-S7 | **Next Step:** Journey Complete
- **SLA:** Instant (automated)
- **Priority:** P1
- **Approval Required:** No
- **Escalation Rules:** Posting failure → exception to HR, flagged for Finance manual correction
- **Documents Required:** GL posting report
- **Notifications Required:** Finance Approver (posting complete)

### Journey 3 — H2R Lifecycle, 12 steps, approvals conditional + always-required

**J3-S1 — Employee Record Created**
- **Dept / Role / Persona:** HR · HR (executor) · Rima Mohaty Dixit
- **Inputs:** Prompt/intake form (name, role, country, employment type)
- **Outputs:** Employee record, duplicate-check result
- **Entry Criteria:** New hire confirmed
- **Exit Criteria:** Record created, no unresolved duplicate flag
- **Previous Step:** — (journey start) | **Next Step:** J3-S2
- **SLA:** Instant (automated); ambiguous-match resolution 4 business hours
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Ambiguous match → HR confirms; unresolved 4h → HR Manager
- **Documents Required:** Intake form
- **Notifications Required:** Compliance Officer (new record pending checks)

**J3-S2 — Document Collection & Verification**
- **Dept / Role / Persona:** HR · HR (executor) · Rima Mohaty Dixit
- **Inputs:** Country-specific document checklist
- **Outputs:** Verified document set
- **Entry Criteria:** J3-S1 complete
- **Exit Criteria:** All mandatory documents validated
- **Previous Step:** J3-S1 | **Next Step:** J3-S3
- **SLA:** Instant checklist generation; document collection 10 business days
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Missing document → automated reminder; failed validation → HR review; unresolved 10 days → HR Manager
- **Documents Required:** Passport, visa, work authorization, tax ID (per country)
- **Notifications Required:** Compliance Officer (documents ready for permit check)

**J3-S3 — Work Permit & Immigration Check**
- **Dept / Role / Persona:** Compliance · Compliance Officer · Kavya Iyer
- **Inputs:** Verified documents, country work-permit requirements
- **Outputs:** Eligibility result
- **Entry Criteria:** J3-S2 complete
- **Exit Criteria:** Eligibility confirmed or exception raised
- **Previous Step:** J3-S2 | **Next Step:** J3-S4 (eligible) or exception loop (ineligible)
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Work permit issue → exception to Compliance Officer with full context
- **Documents Required:** Work permit/visa documentation
- **Notifications Required:** HR (result)

**J3-S4 — Country Compliance Fetch**
- **Dept / Role / Persona:** Compliance · Compliance Officer · Kavya Iyer
- **Inputs:** Employee's country of operation
- **Outputs:** Statutory compliance profile (tax bands, social security, mandatory benefits, notice period rules)
- **Entry Criteria:** J3-S3 eligible
- **Exit Criteria:** Profile attached to employee record
- **Previous Step:** J3-S3 | **Next Step:** J3-S5
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Missing country config → exception to Compliance Officer
- **Documents Required:** None
- **Notifications Required:** HR (profile ready for benefits/payroll setup)

**J3-S5 — Benefits Enrollment**
- **Dept / Role / Persona:** HR · HR (executor) · Rima Mohaty Dixit
- **Inputs:** Country compliance profile
- **Outputs:** Enrollment confirmations with connected benefits providers
- **Entry Criteria:** J3-S4 complete
- **Exit Criteria:** Mandatory benefits enrolled, confirmations attached
- **Previous Step:** J3-S4 | **Next Step:** J3-S6
- **SLA:** Instant trigger (automated); provider confirmation 5 business days
- **Priority:** P1
- **Approval Required:** No
- **Escalation Rules:** Provider failure → exception to HR; unresolved 5 days → HR Manager
- **Documents Required:** Enrollment forms (provider-specific)
- **Notifications Required:** HR Manager (on provider failure only)

**J3-S6 — Payroll Setup & Salary Structuring**
- **Dept / Role / Persona:** HR · HR (executor) · Priyanka Bhatt
- **Inputs:** Contract terms (from Journey 1), country compliance profile
- **Outputs:** Salary structure (pay heads, statutory deductions, allowances, pay frequency)
- **Entry Criteria:** J3-S4 complete, contract terms available
- **Exit Criteria:** Structure attached to employee record
- **Previous Step:** J3-S4 | **Next Step:** J3-S7
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** Setup errors surface as a deviation at J3-S8
- **Documents Required:** Contract terms
- **Notifications Required:** Finance Approver (structure ready)

**J3-S7 — Leave Policy Setup**
- **Dept / Role / Persona:** HR · HR (executor) · Rima Mohaty Dixit
- **Inputs:** Employee country, entity, employment type
- **Outputs:** Assigned leave policy
- **Entry Criteria:** J3-S1 complete
- **Exit Criteria:** Policy assigned, employee notified
- **Previous Step:** J3-S4 | **Next Step:** J3-S8
- **SLA:** Instant (automated)
- **Priority:** P1
- **Approval Required:** No
- **Escalation Rules:** No matching policy → exception to HR to configure one
- **Documents Required:** None
- **Notifications Required:** Employee (policy assigned)

**J3-S8 — HR Approval (on Deviation)**
- **Dept / Role / Persona:** HR · HR Manager · —
- **Inputs:** Deviation detail (non-standard leave policy, benefit enrollment failure, custom payroll structure) + recommended resolution
- **Outputs:** Approval/override decision, or specific correction request
- **Entry Criteria:** AI detects a deviation from standard configuration in J3-S5/S6/S7
- **Exit Criteria:** Decision recorded; standard setups skip this step entirely
- **Previous Step:** J3-S5/S6/S7 (whichever deviated) | **Next Step:** J3-S9
- **SLA:** 8 business hours (on-deviation)
- **Priority:** P1
- **Approval Required:** **Yes — On Deviation Only**
- **Escalation Rules:** Standard escalation to Entity Admin if breached
- **Documents Required:** Deviation report
- **Notifications Required:** HR (decision)

**J3-S9 — Active Employment**
- **Dept / Role / Persona:** HR · HR (executor) · Rima Mohaty Dixit (monitoring), triggers sub-journeys
- **Inputs:** Ongoing employment events (contract expiry approaching, salary revision request, role change request)
- **Outputs:** Sub-journey initiation (A/B/C) when triggered
- **Entry Criteria:** J3-S8 complete or skipped
- **Exit Criteria:** N/A — ongoing state until exit trigger
- **Previous Step:** J3-S8 | **Next Step:** J3-S10 (on exit trigger) or a sub-journey (A/B/C, on mid-employment trigger)
- **SLA:** Continuous monitoring (automated)
- **Priority:** P2 (monitoring only; urgency inherits from whichever sub-journey it triggers)
- **Approval Required:** No
- **Escalation Rules:** N/A
- **Documents Required:** None
- **Notifications Required:** HR, Account Manager (on trigger)

**J3-S10 — Exit Trigger / Resignation Captured**
- **Dept / Role / Persona:** HR · HR (executor) · Rima Mohaty Dixit
- **Inputs:** Resignation submission, contract end date, or termination record
- **Outputs:** Offboarding journey initiated
- **Entry Criteria:** Exit trigger event occurs
- **Exit Criteria:** HR and relevant manager notified, offboarding started
- **Previous Step:** J3-S9 | **Next Step:** J3-S11
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No
- **Escalation Rules:** N/A
- **Documents Required:** Resignation letter / termination record
- **Notifications Required:** HR, relevant manager (Ops Manager or Account Manager depending on contract type)

**J3-S11 — Final Settlement Calculation**
- **Dept / Role / Persona:** HR · HR (executor) · Priyanka Bhatt
- **Inputs:** Last attendance data, outstanding leave balance, gratuity eligibility, pending reimbursements
- **Outputs:** Final settlement calculation
- **Entry Criteria:** J3-S10 complete
- **Exit Criteria:** Calculation complete, presented for Finance review
- **Previous Step:** J3-S10 | **Next Step:** J3-S12
- **SLA:** Instant (automated)
- **Priority:** P0
- **Approval Required:** No (feeds the approval at J3-S12/Final Settlement Review)
- **Escalation Rules:** N/A
- **Documents Required:** Settlement calculation breakdown
- **Notifications Required:** Finance Approver (review needed)

**J3-S12 — Offboarding (incl. Final Settlement Review)**
- **Dept / Role / Persona:** HR (executor, checklist) + **Finance Approver** (Final Settlement Review — Always Required)
- **Inputs:** Final settlement calculation, offboarding checklist
- **Outputs:** Access revoked, experience/relieving letters generated, final settlement disbursed, employee record closed
- **Entry Criteria:** J3-S11 complete
- **Exit Criteria:** All offboarding checklist items resolved, settlement disbursed
- **Previous Step:** J3-S11 | **Next Step:** Journey Complete
- **SLA:** Checklist instant (automated); Final Settlement Review 4 business hours
- **Priority:** P0
- **Approval Required:** **Yes — Always Required (Final Settlement Review only)**
- **Escalation Rules:** Pending final settlement → exception to Finance; standard escalation to Entity Admin if breached
- **Documents Required:** Experience letter, relieving letter, settlement statement
- **Notifications Required:** IT/Systems Admin (access revocation), HR Manager (checklist complete)

### Sub-Journey A — Salary Revision (6 sub-steps, triggered from J3-S9)

**J3-A1 — Revision Request Captured** — HR (executor) · Rima/Priyanka. Inputs: revision request (prompt or HR Manager-entered). Outputs: request linked to employee record. Entry: revision requested. Exit: request logged. Previous: J3-S9 | Next: J3-A2. SLA: instant. Priority: P1. Approval: No. Escalation: n/a. Documents: none. Notifications: HR Manager.

**J3-A2 — Updated Compliance Rules Fetched** — Compliance · Compliance Officer · Kavya Iyer. Inputs: new salary level. Outputs: updated tax/statutory rates. Entry: J3-A1 complete. Exit: rates attached. Previous: J3-A1 | Next: J3-A3. SLA: instant. Priority: P1. Approval: No. Escalation: missing rate data → Compliance Officer. Documents: none. Notifications: HR.

**J3-A3 — New Salary Calculated** — HR · HR (executor) · Priyanka Bhatt. Inputs: updated rates, current salary. Outputs: revised gross/net pay, comparison. Entry: J3-A2 complete. Exit: calculation complete. Previous: J3-A2 | Next: J3-A4. SLA: instant. Priority: P1. Approval: No. Escalation: n/a. Documents: none. Notifications: HR Manager, Finance Approver.

**J3-A4 — Revision Approved** — HR Manager (rationale) + Finance Approver (payroll impact), joint. Inputs: calculation from J3-A3. Outputs: two sign-offs recorded. Entry: J3-A3 complete. Exit: both approvals recorded. Previous: J3-A3 | Next: J3-A5 (approve) or back to J3-A1 (reject). SLA: 8 business hours. Priority: P1. **Approval Required: Yes — Always Required (joint).** Escalation: standard escalation to Entity Admin if breached. Documents: revision rationale. Notifications: HR (decision).

**J3-A5 — Contract Amendment Generated** — Legal / Contracts Manager · Devendra Rao (AI + Docuseal assisted). Inputs: approved revision terms. Outputs: contract amendment, signature request. Entry: J3-A4 approved. Exit: amendment sent for signature. Previous: J3-A4 | Next: J3-A6. SLA: instant generation; signature window 5 business days. Priority: P1. Approval: No. Escalation: bounced signature → Legal/Contracts Manager. Documents: contract amendment. Notifications: HR.

**J3-A6 — Payroll & HRMS Updated** — HR · HR (executor) · Priyanka Bhatt. Inputs: signed amendment. Outputs: updated salary structure, HRMS record, audit trail entry. Entry: J3-A5 signed. Exit: systems updated. Previous: J3-A5 | Next: Sub-journey complete → returns to J3-S9. SLA: instant. Priority: P1. Approval: No. Escalation: n/a. Documents: none. Notifications: Finance Approver, employee.

### Sub-Journey B — Contract Extension (7 sub-steps, triggered from J3-S9)

**J3-B1 — Extension Alert Triggered** — HR (executor) monitoring, notifies Account Manager. Inputs: contract end date. Outputs: extension sub-journey initiated. Entry: end date within alert window. Exit: AM and HR notified. Previous: J3-S9 | Next: J3-B2. SLA: instant. Priority: P1. Approval: No. Escalation: n/a. Documents: none. Notifications: Account Manager, HR.

**J3-B2 — Compliance Re-check** — Compliance Officer · Kavya Iyer. Inputs: extension period, country rules. Outputs: updated compliance/visa renewal check. Entry: J3-B1 complete. Exit: check result logged. Previous: J3-B1 | Next: J3-B3. SLA: instant. Priority: P1. Approval: No. Escalation: renewal issue → Compliance Officer. Documents: visa renewal docs if applicable. Notifications: Account Manager.

**J3-B3 — New Terms Drafted** — Account Manager · Arjun Vaidya. Inputs: existing contract, updated compliance rules, rate adjustments. Outputs: draft extension terms. Entry: J3-B2 complete. Exit: draft presented to Deal Manager. Previous: J3-B2 | Next: J3-B4. SLA: instant. Priority: P1. Approval: No. Escalation: n/a. Documents: draft terms. Notifications: Deal Manager.

**J3-B4 — Extension Approved** — Deal Manager. Inputs: draft terms (new end date, revised rates). Outputs: approval decision. Entry: J3-B3 complete. Exit: decision recorded. Previous: J3-B3 | Next: J3-B5 (approve) or back to J3-B3 (reject). SLA: 4 business hours. Priority: P1. **Approval Required: Yes — Always Required.** Escalation: standard escalation to Entity Admin if breached. Documents: draft terms. Notifications: Account Manager.

**J3-B5 — Extension Contract Sent & Signed** — Legal / Contracts Manager · Devendra Rao (AI + Docuseal assisted). Inputs: approved extension terms. Outputs: extension contract, tracked signature. Entry: J3-B4 approved. Exit: signature tracked. Previous: J3-B4 | Next: J3-B6. SLA: instant generation; signature window 5 business days. Priority: P1. Approval: No. Escalation: bounced signature → Legal/Contracts Manager. Documents: extension contract. Notifications: Ops Manager.

**J3-B6 — Contract Verified & Confirmed** — Ops Manager · Sunita Kulkarni. Inputs: signed extension contract. Outputs: verification decision. Entry: J3-B5 signed. Exit: decision recorded. Previous: J3-B5 | Next: J3-B7. SLA: 4 business hours. Priority: P1. **Approval Required: Yes — Always Required.** Escalation: standard escalation to Entity Admin if breached. Documents: signed contract. Notifications: HR.

**J3-B7 — HRMS & Payroll Updated** — HR · HR (executor) · Priyanka Bhatt. Inputs: verified extension. Outputs: updated end date, pay rates, compliance data. Entry: J3-B6 approved. Exit: systems updated. Previous: J3-B6 | Next: Sub-journey complete → returns to J3-S9. SLA: instant. Priority: P1. Approval: No. Escalation: n/a. Documents: none. Notifications: Finance Approver.

### Sub-Journey C — Role Change (5 sub-steps, triggered from J3-S9)

**J3-C1 — Role Change Request Captured** — HR or Account Manager. Inputs: new job title, department, effective date. Outputs: request logged. Entry: role change requested. Exit: request captured with initiator. Previous: J3-S9 | Next: J3-C2. SLA: instant. Priority: P1. Approval: No. Escalation: n/a. Documents: none. Notifications: HR Manager.

**J3-C2 — Compliance Check for New Role** — Compliance Officer · Kavya Iyer. Inputs: new role details. Outputs: compliance treatment check (work permit category, tax classification, statutory obligations). Entry: J3-C1 complete. Exit: check result logged. Previous: J3-C1 | Next: J3-C3. SLA: instant. Priority: P1. Approval: No. Escalation: compliance issue → Compliance Officer. Documents: none. Notifications: HR.

**J3-C3 — Updated Terms & Pay Drafted** — Account Manager or HR (context-dependent) · draft via AI Contract Assistant. Inputs: new role, compliance result. Outputs: draft updated terms, salary adjustment, benefit changes. Entry: J3-C2 complete. Exit: draft version logged. Previous: J3-C2 | Next: J3-C4. SLA: instant. Priority: P1. Approval: No. Escalation: n/a. Documents: draft terms. Notifications: HR Manager.

**J3-C4 — Role Change Approved** — HR Manager. Inputs: draft terms, effective date. Outputs: approval decision. Entry: J3-C3 complete. Exit: decision recorded. Previous: J3-C3 | Next: J3-C5 (approve) or back to J3-C3 (reject). SLA: 8 business hours. Priority: P1. **Approval Required: Yes — Always Required.** Escalation: standard escalation to Entity Admin if breached. Documents: draft terms. Notifications: HR (decision).

**J3-C5 — Contract Amendment & System Update** — Legal/Contracts Manager (amendment) + HR (system update). Inputs: approved role change. Outputs: contract amendment (via Docuseal if required), updated HRMS/payroll structure. Entry: J3-C4 approved. Exit: all systems updated, audit trail entry logged. Previous: J3-C4 | Next: Sub-journey complete → returns to J3-S9. SLA: instant generation; signature window 5 business days if amendment required. Priority: P1. Approval: No. Escalation: bounced signature → Legal/Contracts Manager. Documents: contract amendment. Notifications: Finance Approver, employee.

---

## 3. Department Ownership Matrix

| Department | J1 (Contract Creation) | J2 (Payroll Creation) | J3 (H2R Lifecycle) | Sub-J A | Sub-J B | Sub-J C |
|---|---|---|---|---|---|---|
| Sales / Deal Desk | S1, S3, S4, S5 | — | — | — | B1, B3, B4 | — |
| Compliance | S2 (+ consulted throughout) | consulted (S3) | S3, S4 | A2 | B2 | C2 |
| Legal / Contracts | S6 | — | — | A5 | B5 | C5 (amendment) |
| Operations | S7 | — | — | — | B6 | — |
| HR | S8, S9 | S1, S2, S3, S5, S7 (joint w/ Finance), S8 | S1, S2, S5, S6, S7, S9, S10, S11, S12 (checklist) | A1, A3, A6 | B1, B7 | C1, C3, C5 (system update) |
| HR Manager | — | — | S8 | A4 (joint) | — | C4 |
| IT / Systems Admin | S8 (access) | — | S12 (access revocation) | — | — | — |
| Finance | (implicit sign-off) | S4, S6, S7 (joint w/ HR — executes the fund transfer/card load) | S12 (Final Settlement Review) | A4 (joint) | — | — |
| Super Admin | Cross-cutting — platform administration, escalation backstop for every department above | | | | | |

## 4. Task Ownership Matrix

Every one of the 47 units has exactly one primary owner (Department · Role · Persona), listed in full in §2. In summary, by owning persona:

| Persona | Step count | Step IDs |
|---|---|---|
| Account Manager / Deal Desk | 6 | J1-S1, J1-S3, J1-S5, J3-B1, J3-B3, (J3-C1/C3 shared with HR) |
| Deal Manager | 2 | J1-S4, J3-B4 |
| Compliance Officer | 6 | J1-S2, J3-S3, J3-S4, J3-A2, J3-B2, J3-C2 |
| Legal / Contracts Manager | 4 | J1-S6, J3-A5, J3-B5, J3-C5 |
| Ops Manager | 2 | J1-S7, J3-B6 |
| **HR** (executor) | **22** | J1-S8, J1-S9, J2-S1, J2-S2, J2-S3, J2-S5, J2-S7 (joint w/ Finance), J2-S8, J3-S1, J3-S2, J3-S5, J3-S6, J3-S7, J3-S9, J3-S10, J3-S11, J3-S12 (checklist), J3-A1, J3-A3, J3-A6, J3-B7, J3-C1/C3/C5 (shared) |
| **HR Manager** | **4** | J3-S8, J3-A4 (joint), J3-C4 — plus standing escalation ownership across every HR-executed step |
| IT / Systems Admin | 2 | J1-S8 (access), J3-S12 (access revocation) |
| Finance Approver | 6 | J2-S4, J2-S6, J2-S7 (joint w/ HR — fund transfer/card load execution), J3-S12 (Final Settlement Review), J3-A4 (joint) |

No step is shared as a primary owner except the two explicitly joint approvals (J3-A4: HR Manager + Finance Approver) — every other step has exactly one Responsible party, consistent with the "no task without an owner, no shared ownership" requirement.

## 5. RACI Matrix

RACI is derived directly from §2: **R** (Responsible) = the owning persona; **A** (Accountable) = the approving persona for gated steps, or the owning persona's manager-equivalent for non-gated steps; **C** (Consulted) = departments whose data feeds the step without owning it; **I** (Informed) = departments notified per §2's "Notifications Required" field.

| Step | R | A | C | I |
|---|---|---|---|---|
| J1-S1 | Account Manager | Deal Manager | — | Compliance |
| J1-S2 | Compliance Officer | Entity Admin (escalation only) | — | Account Manager |
| J1-S3 | Account Manager | Deal Manager | Compliance | Deal Manager |
| J1-S4 | Deal Manager | Deal Manager (self) | — | Account Manager, Compliance |
| J1-S5 | Account Manager | Deal Manager | — | Deal Manager |
| J1-S6 | Legal/Contracts Manager | Ops Manager | — | Ops Manager |
| J1-S7 | Ops Manager | Ops Manager (self) | Legal/Contracts | HR, Legal/Contracts |
| J1-S8 | HR | HR Manager | IT/Systems Admin | IT/Systems Admin, Payroll (HR) |
| J1-S9 | HR | HR Manager | — | Finance Approver |
| J2-S1 | HR | HR Manager | — | Finance Approver |
| J2-S2 | HR | HR Manager | — | — |
| J2-S3 | HR | Finance Approver | Compliance | Finance Approver |
| J2-S4 | Finance Approver | Finance Approver (self) | — | HR |
| J2-S5 | HR | HR Manager | — | Finance Approver |
| J2-S6 | Finance Approver | Finance Approver (self) | — | HR |
| J2-S7 | HR + Finance (joint) | HR Manager | — | Finance Approver, employees (on failure) |
| J2-S8 | HR | HR Manager | Finance | Finance Approver |
| J3-S1 | HR | HR Manager | — | Compliance |
| J3-S2 | HR | HR Manager | — | Compliance |
| J3-S3 | Compliance Officer | Entity Admin (escalation only) | — | HR |
| J3-S4 | Compliance Officer | Entity Admin (escalation only) | — | HR |
| J3-S5 | HR | HR Manager | Compliance | HR Manager (on failure) |
| J3-S6 | HR | HR Manager | Compliance, Legal (contract terms) | Finance Approver |
| J3-S7 | HR | HR Manager | — | Employee |
| J3-S8 | HR Manager | HR Manager (self) | HR | HR |
| J3-S9 | HR | HR Manager | — | Account Manager (on trigger) |
| J3-S10 | HR | HR Manager | — | HR, Ops/Account Manager |
| J3-S11 | HR | Finance Approver | — | Finance Approver |
| J3-S12 | HR (checklist), Finance Approver (settlement) | Finance Approver | IT/Systems Admin | IT/Systems Admin, HR Manager |
| J3-A1–A3 | HR / Compliance (per step) | HR Manager | — | HR Manager, Finance Approver |
| J3-A4 | HR Manager + Finance Approver | (joint self) | — | HR |
| J3-A5–A6 | Legal/Contracts, HR | HR Manager | — | Finance Approver, employee |
| J3-B1–B3 | HR, Compliance, Account Manager | Deal Manager | — | Account Manager, Deal Manager |
| J3-B4 | Deal Manager | Deal Manager (self) | — | Account Manager |
| J3-B5–B6 | Legal/Contracts, Ops Manager | Ops Manager (self) | — | HR |
| J3-B7 | HR | HR Manager | — | Finance Approver |
| J3-C1–C3 | HR, Compliance | HR Manager | — | HR Manager |
| J3-C4 | HR Manager | HR Manager (self) | — | HR |
| J3-C5 | Legal/Contracts, HR | HR Manager | — | Finance Approver, employee |

---

## 6. Dashboard Planning — Per Department

Every department dashboard is scoped strictly to that department's own tasks — none exposes another department's queue. Super Admin is the sole cross-department rollup. Design details and reference-file mapping are in §14; this section defines the KPI/widget/queue **content** per department, independent of the UI mechanism.

Each department dashboard includes: **Pending Queue**, **Completed Queue**, **Today's Work**, **Upcoming Work**, **Overdue Tasks** (past SLA), **Escalated Tasks**, **Personal Queue** vs **Team Queue**, a **Notifications** feed, department-specific **KPIs**, **Filters** (by journey, by status, by SLA state), **Search**, and **Quick Actions** (the department's own primary verbs — Approve/Reject, Send, Verify, Provision, etc.).

| Department | KPIs | Primary queue content | Quick Actions |
|---|---|---|---|
| Sales / Deal Desk | Deals created this month, proposals pending approval, client acceptance rate, average time-to-signature | J1-S1/S3/S5 tasks, Sub-J B extension alerts | Draft Proposal, Resend Proposal, Extend Acceptance Window |
| Compliance | Compliance checks run, exceptions raised, average check turnaround, countries with stale config | J1-S2, J3-S3/S4, all sub-journey compliance re-checks | Resolve Exception, Override Rate (audit-noted), Escalate |
| Legal / Contracts | Contracts generated, signature turnaround, bounced signatures, amendments in flight | J1-S6, J3-A5/B5/C5 | Regenerate Contract, Resend for Signature, Raise Exception |
| Operations | Contracts verified, discrepancies flagged, average verification time | J1-S7, J3-B6 | Approve, Reject with Discrepancy Note |
| **HR** | Onboarding in progress, documents pending, payroll runs in flight, benefits enrollments pending, offboarding in progress | J1-S8/S9, all of J2 execution, J3 execution steps, sub-journey execution steps | Send Reminder, Run Calculation, Generate Slips, Trigger Disbursement, Mark Resolved |
| **HR Manager** | Deviation approvals pending, role-change approvals pending, **escalations/exceptions open** (own separate queue), average resolution time | J3-S8, J3-A4, J3-C4 **+ every open exception from HR's execution queue** | Approve, Reject, Resolve Escalation |
| IT / Systems Admin | Access provisioning pending, access revocations pending, average provisioning time | J1-S8 (access), J3-S12 (revocation) | Provision Access, Revoke Access, Confirm Complete |
| Finance | Approvals pending (calculation, disbursement, final settlement), disbursement success rate, GL posting failures | J2-S4/S6, **J2-S7 (fund transfer/card load execution)**, J3-S11/S12, J3-A4 | Approve, Reject, Authorise Disbursement, **Execute/Retry Disbursement** |
| Super Admin | Cross-department SLA breach count, escalations awaiting platform-level action, journeys by status across all departments | Every department's Overdue + Escalated queues, rolled up | Reassign, Override, View Audit Trail |

---

## 7. Manual Workflow Architecture (Mode 1)

In Manual Mode, no AI is assumed anywhere — every one of the 47 units is executed by a human in its owning department.

1. **Task creation**: when a journey instance reaches a step, a `Task` record is created and assigned to the owning department/role (per §2's Dept/Role/Persona field) — assignment is by role, not by named individual, so any qualified person in that department/role can pick it up (mirrors the "Team Queue" vs "Personal Queue" distinction in §6).
2. **Manual completion**: the assigned person completes the task using the Inputs listed in §2, producing the Outputs listed in §2. There is no AI drafting, pre-fill, or validation — every field is entered by hand.
3. **Automatic handoff**: on completion, the workflow engine automatically creates the next step's `Task` in the next owning department — the human does not need to know or contact the next department; the engine routes it per the Next Step field in §2.
4. **Entry/exit criteria as gates**: a step's `Task` cannot be marked complete until its Exit Criteria (§2) are met — this is enforced by the engine as a checklist, not left to individual diligence.
5. **Approvals stay identical in both modes**: every step marked "Approval Required: Yes" in §2 requires the same human sign-off in Manual Mode as in AI Mode — approvals are never automated.
6. **SLA and escalation are enforced identically in both modes** — the SLA clock starts the moment a `Task` is assigned, regardless of whether a human or an AI agent is meant to act on it.

## 8. AI Workflow Architecture (Mode 2)

The same step graph, same `Task`/routing/approval/escalation mechanics as Mode 1 — only the *executor* of non-approval steps changes. Every one of the 47 units is classified below.

**Classification key**: **Fully AI Automated** = an AI agent completes the step with no human action required (source docs' "AI Agent" owner rows with no approval gate and no human-override affordance called out). **AI Assisted** = an AI agent completes the step, but a human retains an explicit override/edit/regenerate affordance before the step is considered final (source docs' "AI Agent" rows whose "Available Actions" table includes edit/regenerate/override entries). **Manual Only** = no AI agent is assigned to this step in the source docs.

**Finding, stated explicitly rather than glossed over**: per the source docs, **every non-approval step across all 3 journeys already has an AI agent assigned** — there is no step in the current design that is "Manual Only" in AI Mode. The distinction that actually matters is Fully Automated vs. AI Assisted, based on whether the source doc's "Available Actions" table gives the owning human an edit/override affordance on that step's output.

| Step | AI Tier | Reasoning |
|---|---|---|
| J1-S1 | AI Assisted | "Available Actions" includes Edit details, manually select ambiguous matches |
| J1-S2 | Fully AI Automated | No edit affordance; only override-with-audit-note on exception |
| J1-S3 | AI Assisted | Edit commercial terms, regenerate with different rate rules |
| J1-S4 | Human (approval) | N/A |
| J1-S5 | AI Assisted | Resend, extend window, mark verbally accepted |
| J1-S6 | AI Assisted | Edit contract inline, resend to signatory |
| J1-S7 | Human (approval) | N/A |
| J1-S8 | AI Assisted | Send reminder, mark item resolved, raise ticket |
| J1-S9 | AI Assisted | Fill missing field, mark ready manually with override note |
| J2-S1 | AI Assisted | Select scope, set pay period, preview list |
| J2-S2 | AI Assisted | Flag discrepancy, override record, exclude employee |
| J2-S3 | AI Assisted | Flag for review, exclude employee, recalculate |
| J2-S4 | Human (approval) | N/A |
| J2-S5 | AI Assisted | Preview, hold distribution |
| J2-S6 | Human (approval) | N/A |
| J2-S7 | AI Assisted | Retry failed disbursements |
| J2-S8 | AI Assisted | Retry failed postings, flag for manual correction |
| J3-S1 | AI Assisted | Edit fields, merge with existing record |
| J3-S2 | AI Assisted | Upload on behalf, waive optional document |
| J3-S3 | AI Assisted | Escalate, mark resolved, raise exception |
| J3-S4 | AI Assisted | Override a specific rate with approval note |
| J3-S5 | AI Assisted | Retry failed enrollment, skip optional benefit |
| J3-S6 | AI Assisted | Edit a pay head with override note |
| J3-S7 | AI Assisted | Change policy, create new policy |
| J3-S8 | Human (approval) | N/A |
| J3-S9 | Fully AI Automated | Continuous monitoring, no routine human action |
| J3-S10 | AI Assisted | Initiate offboarding early, put on hold |
| J3-S11 | AI Assisted | Override a settlement component with note |
| J3-S12 | AI Assisted (checklist) + Human (Final Settlement Review) | Checklist has mark-resolved/raise-ticket affordance; settlement approval is human |
| Sub-J A (A1–A3, A5–A6) | AI Assisted | Same override pattern as their parent-journey analogs |
| Sub-J A (A4) | Human (approval) | N/A |
| Sub-J B (B1–B3, B5, B7) | AI Assisted | Same override pattern |
| Sub-J B (B4, B6) | Human (approval) | N/A |
| Sub-J C (C1–C3, C5) | AI Assisted | Same override pattern |
| Sub-J C (C4) | Human (approval) | N/A |

**Reconciling with `journey-execution-model_v1.md`'s guardrail enum**: that model defines 3 guardrail values per step — `fully_automated`, `approves_next_step`, `approves_on_deviation`. This document's 3-tier classification maps onto it directly:
- **Fully AI Automated** (this doc) = `fully_automated` (v1 model) — journey auto-advances on success.
- **AI Assisted** (this doc) = also `fully_automated` at the guardrail level (the step *does* auto-advance), but the step's UI surfaces an edit/override affordance — i.e., "AI Assisted" is a **UI-layer distinction within `fully_automated`**, not a 4th guardrail value. The guardrail enum stays exactly 3 values; this document does not introduce a conflicting vocabulary.
- **Human (approval)** (this doc) = `approves_next_step` (Always Required) or `approves_on_deviation` (On Deviation Only, i.e. J3-S8) in the v1 model, matching exactly.

## 9. Workflow Engine Design

- **Task routing**: on step entry, the engine reads the step's `owner_type`/`owner_ref` (department + role, per §2) and creates a `Task` assigned to that role's queue — not to a named individual, so anyone with that role can claim it (mirrors §6's Personal/Team queue split).
- **Department/role routing**: routing is purely data-driven off the `Step` record's department/role fields (§3/§4) — the engine has no hardcoded per-journey logic, satisfying the "reusable for future journeys" requirement (§13).
- **Approval routing**: steps with `guardrail != fully_automated` create an `ApprovalRequest` instead of auto-advancing; the request is routed to the approving role from §2/§5's Accountable column.
- **Rejections / rework loops**: every rejection in §2 specifies an explicit "back to" step (e.g., J1-S4 rejection → back to J1-S3) — the engine re-opens that step's `Task` with the rejection note attached, rather than restarting the journey.
- **Escalations**: the SLA clock (§1's SLA scale) starts at `Task` creation; on breach, the engine auto-escalates per the standard escalation chain (§1) — Account Manager → Deal Manager → Entity Admin → Super Admin, HR → HR Manager → Entity Admin → Super Admin, and so on for every department.
- **Notifications**: every step's "Notifications Required" field (§2) is a list of roles that receive an in-app + email notification on that step's completion — this is data on the `Step` record, not per-step custom code.
- **Audit logs**: every `Task` state change, `ApprovalRequest` decision, and escalation event appends a `StepEvent` (per the v1 model's event-sourcing pattern) — nothing is ever mutated in place; current status is always a derived view over the event log.
- **Version history**: `Journey`/`Step` definitions are versioned; a running `JourneyInstance` records which `Journey` version it started against, so mid-flight journeys aren't silently affected by a later edit to the step graph (this is flagged as an open question in the v1 model and remains one here — see §13).
- **Comments / attachments**: first-class entities attached to a `Task` or `JourneyInstance` (not embedded in free-text fields), enabling the "Documents Required" field (§2) to be a real, queryable attachment list rather than a description.
- **Manual ↔ AI mode switch**: a single per-tenant (or per-journey) configuration flag. When AI Mode is on, `fully_automated` and the AI-Assisted-flagged steps execute via their assigned AI agent automatically; when off, the identical `Task` is created but left unassigned to any agent, so a human in the owning role must act — **the step graph, routing, approval, and escalation logic are completely unchanged between modes**, exactly matching the "no redesign required" requirement.

## 10. Role Hierarchy

```
Super Admin (platform)
  └─ Entity Admin (tenant governance — escalation backstop for every department below)
       ├─ Sales / Deal Desk
       │    └─ Account Manager  →  reports to  →  Deal Manager
       ├─ Compliance
       │    └─ Compliance Officer
       ├─ Legal / Contracts
       │    └─ Legal / Contracts Manager
       ├─ Operations
       │    └─ Ops Manager
       ├─ HR
       │    └─ HR (executor)  →  reports to  →  HR Manager
       ├─ IT / Systems Admin
       │    └─ IT / Systems Administrator
       ├─ Finance
       │    └─ Finance Approver
       └─ Customer Success (reserved, no active steps — see §3)
```

Reporting lines are derived directly from the approval chain already present in the source docs (e.g. Account Manager's proposal is approved by Deal Manager; HR's deviations are approved by HR Manager) — not invented separately from the workflow itself.

## 11. Permission Matrix (RBAC)

| Role | View | Create | Edit | Approve | Reject | Assign | Reassign | Delete | Export | Audit |
|---|---|---|---|---|---|---|---|---|---|---|
| Account Manager | Own dept's tasks | Deals, proposals | Own drafts | No | No | No | No | No | Own records | No |
| Deal Manager | Own dept's tasks | — | — | Yes (J1-S4, Sub-J B) | Yes | No | Within dept | No | Own records | No |
| Compliance Officer | Own dept's tasks | Compliance overrides | Compliance data | No | No | No | No | No | Own records | No |
| Legal / Contracts Manager | Own dept's tasks | Contracts, amendments | Draft contracts | No | No | No | No | No | Own records | No |
| Ops Manager | Own dept's tasks | — | — | Yes (J1-S7, Sub-J B) | Yes | No | Within dept | No | Own records | No |
| HR | Own dept's tasks (own + team queue) | Employee records, onboarding, payroll runs | Own drafts | No | No | No | No | No | Own records | No |
| HR Manager | Own dept's tasks + escalations queue | — | — | Yes (J3-S8, A4, C4) | Yes | Yes (HR tasks) | Within dept | No | Own records | Own dept |
| IT / Systems Admin | Own dept's tasks | Access grants/revocations | — | No | No | No | No | No | Own records | No |
| Finance Approver | Own dept's tasks | — | — | Yes (J2-S4/S6, J3-S12, A4) | Yes | No | Within dept | No | Own records | No |
| Entity Admin | All departments (this tenant) | Journey configuration | Journey configuration | Escalation override | Escalation override | Yes (any dept) | Yes | No | All tenant records | Tenant-wide |
| Super Admin | All tenants, all departments | Journey/agent definitions, `skill.md` | Everything | Platform override | Platform override | Yes | Yes | Yes (config only) | All records | Platform-wide |

## 12. Database Entities

Extends `journey-execution-model_v1.md`'s sketch (`Agent`, `SkillContract`, `Journey`, `Step`, `JourneyInstance`, `StepEvent`, `ApprovalRequest`) with the department/role/task layer this document requires:

```
Department
  id, name, description

Role
  id, department_id, name (e.g. "HR", "HR Manager"), is_approver_role (bool)

User
  id, role_id, tenant_id, name, email

Task  (new — the department/role-routing layer the v1 sketch didn't need)
  id, journey_instance_id, step_id, assigned_role_id, assigned_user_id (nullable — team queue vs personal)
  status (enum: pending | in_progress | completed | blocked)
  sla_due_at, created_at, completed_at

TaskAssignment  (new — supports reassignment audit trail)
  id, task_id, from_role_id, to_role_id, reassigned_by, reassigned_at, reason

Notification  (new)
  id, task_id, recipient_role_id, type, sent_at, read_at

Comment  (new)
  id, task_id, author_user_id, body, created_at

Attachment  (new)
  id, task_id, file_ref, uploaded_by, uploaded_at, document_type

AuditLog  (new — config-change history; distinct from StepEvent's runtime event log)
  id, entity_type, entity_id, actor, action, timestamp

DashboardWidget / DashboardConfig  (new — per §6/§14)
  id, role_id, widget_type, config_json, position
```

Existing v1 entities gain minimal additions to support this document's granularity:
- `Step` gains `department_id`, `role_id` (the owner, per §2's Dept/Role/Persona field), `sla_hours`, `priority` (P0/P1/P2), `ai_tier` (fully_automated | ai_assisted | human) — `ai_tier` is the UI-layer distinction from §8, stored separately from the existing `guardrail` field so the 3-value guardrail enum stays untouched.
- `JourneyInstance` gains `execution_mode` (manual | ai) — the single config flag from §9's Manual↔AI switch.

## 13. Reusable Architecture Recommendations

For a 4th, 5th, or Nth future journey to plug into this same engine with zero redesign:

1. **Step ownership is data, not code.** A new journey's steps are rows referencing existing `Department`/`Role` records (or new ones, added the same way) — the routing/escalation/notification engine (§9) never needs a journey-specific branch.
2. **The department/role roster is an extensible registry**, not a fixed enum. **Customer Success** is formally reserved here with zero active steps (§3) specifically so a future journey (e.g. a post-onboarding client-success touchpoint journey) can assign it real steps without a schema change.
3. **`ai_tier` and `guardrail` are per-step config fields**, not per-journey code — a new journey author picks Fully Automated / AI Assisted / Human per step exactly as this document did for the 47 existing steps, and the Manual↔AI mode switch (§9) applies to it automatically.
4. **Dashboards are role-scoped by construction** (§6) — a new department automatically gets a dashboard shaped like the others (Pending/Completed/Today/Upcoming/Overdue/Escalated queues + KPIs), no bespoke dashboard code required, since `DashboardConfig` (§12) is keyed by `role_id`, not hardcoded per department.
5. **RBAC (§11) extends by adding rows, not rules** — a new role's permission matrix row follows the same View/Create/Edit/Approve/Reject/Assign/Reassign/Delete/Export/Audit shape as every existing role.

---

## 14. Persona → Switch User Design (follow-up implementation target — not built in this pass)

This section is a build-ready spec for a **later** implementation pass. **No `js/core.js` / `js/pages.js` changes happen as part of this document.**

### Switch User integration

The 9-persona roster (§1) nests under the existing `Entity User` tier in the Executivelayer_mockup app's current `Switch User` dropdown (`showSwitchUserMenu()` / `setPortalRole()` in `js/core.js`) — **not** as separate dashboard tabs. Super Admin and Entity Admin stay exactly as they are today; the 9 personas become additional selectable identities *within* the Entity User tier.

When a persona is active, the app should present a **task-scoped view**: only the journey steps that persona owns (per §3/§4) surface as actionable. This composes with the two execution modes:
- **Manual Mode** (§7): the active persona must act on every step from §2 where they are Responsible — nothing is pre-filled or skipped.
- **AI Mode** (§8): the active persona only sees the subset of their owned steps that are `Human (approval)` in §8's classification — Fully Automated and AI Assisted steps no longer require their action, since the AI agent has already completed them (AI Assisted steps still show an override affordance if the persona wants to intervene, per §8's tier definition).

### Dashboard content design, informed by the user's reference file

The user shared a 10-role dashboard reference (Employee, HR, Reporting Manager, Opendhi Super Admin, OpenDhi Finance Admin, Finance Admin (basic), CSM, Opendhi Compliance Admin, Opendhi Ops Admin, Entity Owner), each with its own stat-card row, action queues, and tables, switched via a `.dashboard-tabs` tab strip. **Confirmed with the user**: reuse this reference's *dashboard content patterns*, not its tab-strip switching mechanism. In this app there is **one** Dashboard page whose content is a function of whichever persona is currently active via Switch User — the same way `dashboardTabsForRole`/`buildEntityAdminDashboardHTML` already branch dashboard content on `portalRole` today.

Reference role → our persona mapping (content template reuse, not a literal 1:1 role match — the reference's roles don't line up with our journey-derived roster):

- Reference's **Employee Dashboard** (leave balance, latest payslip, attendance, "Action Required" table, upcoming dates) → the **baseline block every one of our 9 personas gets**, since every persona is a person with their own leave/attendance/profile regardless of which journey tasks they own.
- Reference's **HR Dashboard** (headcount stats, leave requests, onboarding/document-verification pending counts, holidays, birthdays) **combined with** reference's Finance-style stat cards (pending/paid amounts, disbursement status) → template for our **HR** (executor) persona, since it now owns onboarding *and* the full Payroll Creation journey's execution steps *and* benefits. Its dashboard is the richest execution-side dashboard of the 9: HR Dashboard's queues (leave requests, onboarding pending, document verification) stacked with a payroll-run section (attendance capture status, calculation/disbursement-in-progress queue, styled like the reference's invoice/payment stat cards).
- Reference's **Reporting Manager** (team stats, pending-approvals count, a generic approve/reject queue table) → the **generic "my approval queue" pattern reused by every approval-holding persona**: Deal Manager, HR Manager, Finance Approver, Ops Manager — the queue table itself is populated from §4's Task Ownership Matrix filtered to that persona, styled like the reference's `manager-leave-table`/approve-reject row pattern. **HR Manager's dashboard uses this template directly** (a lean approver role like Deal Manager/Ops Manager, distinct from the execution-heavy HR persona above) — plus a second, equally prominent **"Escalations / Exceptions"** queue for issues raised by anything HR executes, styled on this app's existing `Exception` status treatment (`aiRunStatusPillClass`) rather than the reference file (which has no exception-queue precedent of its own).
- Reference's **OpenDhi Finance Admin / Finance Admin (basic)** (invoice/payment stats, pending approvals) → template for our **Finance Approver** persona.
- Reference's **Opendhi Compliance Admin** (contract compliance queue, compliance hub items, payroll-blocking counts) → template for our **Compliance Officer** persona.
- Reference's **Opendhi Ops Admin** (contract pipeline funnel, active contracts, compliance items, payroll readiness) → template for our **Ops Manager** persona.
- Reference's **Opendhi Super Admin** / **Entity Owner** → these map to this app's *existing* `portalRole` tiers (`super-admin`/`entity-admin`), which stay exactly as they are — not journey personas, no change.
- Reference's **CSM** → not owned by any step in these 3 journeys (per the Customer Success note in §3) — reserved as a future persona template, not built now.
- Personas with no direct reference analog (**Account Manager/Deal Desk, Deal Manager, Legal/Contracts Manager, IT/Systems Admin**) get the baseline Employee block + the generic approval-queue/task-queue pattern above, populated from their specific owned steps — no bespoke layout needed since the reference's own patterns already cover "personal stats + task queue" generically enough.

---

## Verification (this is a document, not code)

- Every one of the 47 step/sub-step units from the source docs appears exactly once across §2–§5 — confirmed: 9 (J1) + 8 (J2) + 12 (J3) + 6 (Sub-J A) + 7 (Sub-J B) + 5 (Sub-J C) = 47.
- Every department in the roster owns at least one step (§3) and has a dashboard spec (§6).
- §8's AI-tier classification is cross-checked against the source docs' own "AI Agent" vs "Human Approval Required" owner column and "Available Actions" tables — every Human (approval) row in §8 corresponds exactly to an "Approval Required: Yes" row in §2.
- §12's DB schema is additive to `journey-execution-model_v1.md`'s existing sketch — no existing v1 field (including the 3-value `guardrail` enum) was renamed, removed, or redefined.
- §14's 9-persona roster is cross-checked against §3/§4 — every persona maps to real owned steps; the HR vs. HR Manager executor/approver split is applied consistently in §1, §3, §4, §6, and §14.

### Source documents referenced
- `Journey_Product_Thinking_v3.docx` (journey step maps, Part 1)
- `Journey_1_Complete.md` (Journey 1 persona depth)
- `journey-execution-model_v1.md` (architecture foundation)
- User-provided 10-role dashboard reference HTML (dashboard content patterns, §14)
