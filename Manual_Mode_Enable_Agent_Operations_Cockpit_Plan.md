# Manual Mode + Enable Agent + Operations Cockpit Implementation Plan

## 1. Product Direction

Build on top of the current AI Execution Layer mockup. Do not remove any existing AI/agentic workflow, automation wizard, dashboard, role, request flow, or journey screen. The product becomes journey-first:

- Journeys can be bought/activated independently.
- Activated journeys run in Manual Mode by default.
- Entity Admin can enable agents per journey and per step.
- Existing agentic workflows run when agent mode is enabled.
- Manual execution collects operational proof and recommends where agents should be enabled.
- AI Executive evolves into an operations cockpit for all manual, agentic, and hybrid journey runs.

## 2. Roles And Where Each Capability Lives

### Super Admin

Primary screens:

- Configure -> Context & Journey
- Configure -> Agents
- My Tasks
- AI Executive / Operations Cockpit

Responsibilities:

- Approves journey activation requests from Entity Admin.
- Configures platform-level journey templates, step owners, SLAs, modules, and agent recommendations.
- Reviews and manages agent governance.
- Runs simulation/dry run before making a journey available.
- Can inspect all journey runs and escalations.

### Entity Admin

Primary screens:

- Configure -> Context & Journey
- AI Executive / Operations Cockpit
- My Tasks
- Entity Admin Dashboard

Responsibilities:

- Requests journeys from Super Admin.
- Activates purchased journeys for the entity once approved.
- Controls `Enable Agent` per journey.
- Controls `Enable Agent` per step inside each journey.
- Reviews journey health, SLA risk, blocked steps, exceptions, escalations, ROI, and automation readiness.
- Runs simulation before enabling a journey or enabling agents.

### Entity User Roles

Primary screens:

- AI Executive / Operations Cockpit
- My Tasks
- Role-specific dashboards
- Manual module screens

Roles and responsibilities:

- Account Manager: deal creation, proposal drafting, client acceptance.
- Deal Manager: proposal approval and sales escalation.
- Compliance Officer: compliance checks, country rules, work permit/statutory review.
- Legal / Contracts Manager: contract generation, corrections, and signature tracking.
- Ops Manager: signed contract verification and operational readiness approval.
- HR: onboarding, document collection, payroll setup, benefits, leave policy, offboarding.
- HR Manager: HR deviations, policy approvals, escalations.
- IT / Systems Admin: access provisioning and revocation.
- Finance Approver: payroll approval, disbursement authorization, final settlement approval.

Entity Users execute assigned manual steps, handle approvals/exceptions, and view step evidence. They do not change journey/agent configuration unless they also have Entity Admin permission.

## 3. Core State Model

### Journey Configuration

Each journey should track:

- `journeyId`
- `name`
- `category`
- `activationStatus`: `locked | requested | pending_super_admin | activated`
- `agentEnabled`: boolean
- `steps[]`
- `roiMetrics`
- `simulationStatus`

Each step should track:

- `stepId`
- `name`
- `ownerRole`
- `modulePage`
- `manualAction`
- `agentCapable`
- `agentEnabled`
- `approvalRequired`
- `slaHours`
- `evidenceRequirements`
- `exceptionTypes`
- `nextStepRules`

### Journey Run

Each run should track:

- `runId`
- `journeyId`
- `entity/client/employee`
- `executionMode`: `manual | agent | hybrid`
- `currentStepId`
- `status`: `active | blocked | waiting_approval | completed | escalated`
- `ownerRole`
- `nextAction`
- `slaRisk`
- `blockedSteps`
- `exceptions`
- `auditEvents`
- `roiSnapshot`

## 4. Enable Agent Behavior

Implemented in Entity Admin -> Configure -> Context & Journey.

Journey card additions:

- Activation badge: `Locked`, `Requested`, `Pending`, `Activated`
- Mode badge: `Manual Mode`, `Agent Enabled`, `Hybrid`
- Toggle: `Enable Agent`
- Button: `Simulate`
- Button: `View Runs`

Journey detail additions:

- Top-level `Enable Agent` switch.
- Step table/timeline with per-step `Enable Agent` toggle.
- Columns: Step, Owner Role, Module, SLA, Mode, Agent Status, Risk, Action.

Runtime routing:

- Locked journey: existing request flow.
- Activated + agent disabled: start manual journey run.
- Activated + agent enabled: use existing agentic workflow.
- Mixed step settings: run in hybrid mode.
- Human approval steps always remain human.

## 5. Manual Execution Flow

Manual Mode uses full module screens where possible. Each manual step should show a journey task header:

- Journey name and run ID
- Current step
- Owner role
- SLA
- Required action
- Buttons: `Open Module`, `Evidence`, `Raise Exception`, `Mark Step Complete`, `Back to Cockpit`

### Contract Creation

- Deal/employee creation: Contracts / Employee module
- Compliance check: Compliance Hub
- Proposal drafting: Contract/proposal screen
- Proposal approval: My Tasks approval screen for Deal Manager
- Client acceptance: Contract status screen
- Contract generation/signature: Contracts module
- Signed contract approval: My Tasks approval screen for Ops Manager
- Onboarding: Employee/onboarding checklist
- Payroll readiness: Payroll readiness screen

### Payroll Creation

- Payroll initiation: Payroll run form
- Attendance capture: Timesheet module
- Salary calculation: Payroll / Payheads screen
- Payroll approval: My Tasks approval screen for Finance Approver
- Payslip generation: Payroll document screen
- Disbursement authorization: Finance approval screen
- Payment disbursal: Payments screen
- ERP write-back: Finance/GL mock screen

### H2R Lifecycle

- Employee creation: Employee module
- Document collection: Employee documents checklist
- Work permit check: Compliance Hub
- Country compliance fetch: Compliance Hub
- Benefits enrollment: Employee benefits screen
- Payroll setup: Payroll / Payheads
- Leave policy setup: Leave Policies
- HR approval: My Tasks approval screen for HR Manager
- Active employment: H2R lifecycle detail
- Offboarding: HR offboarding checklist
- Final settlement: Finance approval screen

## 6. Operations Cockpit

AI Executive should evolve into a cockpit while keeping the journey marketplace cards.

Cockpit sections:

- Active journey runs
- Manual vs Agent mode per run
- SLA risk
- Blocked steps
- Owner role
- Next action
- Escalations
- Audit trail
- Cost/time saved if agent enabled
- Exceptions
- ROI summary

Run table columns:

- Run ID
- Journey
- Entity / Employee / Client
- Mode
- Current Step
- Owner Role
- SLA Risk
- Blocked Reason
- Next Action
- Escalation Status
- Estimated Time Saved if Agent Enabled

## 7. Manual-To-Agent Upgrade Path

Manual mode should collect proof automatically:

- Step duration
- Number of fields manually entered
- Number of repeated fields
- Number of module screens visited
- Approval waiting time
- Exception frequency
- Rework count
- Manual calculation time
- Document upload/review time

Show upgrade prompt:

- `Enable Agent for this step`
- Manual average time
- Agent estimated time
- Expected time saved
- Risk reduction
- Required integration
- Required data

This recommendation should feel operational, not salesy.

## 8. Step-Level Evidence Pack

Every important step should expose an evidence drawer:

- Source data
- Documents used
- Rules/checks applied
- Owner role
- User/agent who changed data
- Timestamp
- Before/after values
- Approval notes
- Exception notes
- System logs
- Linked module record
- Download/export audit option

Priority evidence packs:

- Compliance Check
- Payroll Calculation
- Contract Approval
- Signed Contract Verification
- Final Settlement
- Disbursement Authorization
- Work Permit / Immigration Check

## 9. Exception-First Design

Initial exception types:

- Missing compliance rule
- Salary mismatch
- Expired document
- Unsigned contract
- Incomplete bank details
- Timesheet discrepancy
- Approval breach
- Missing tax ID
- Work permit issue
- Failed disbursement
- Failed ERP posting

Each exception should have:

- Owner role
- SLA
- Escalation target
- Suggested resolution
- Audit trail
- Resolve/escalate actions

## 10. Journey ROI Layer

Show ROI at journey and step level:

- Manual hours saved
- Average cycle time
- Approval delay
- Automation readiness score
- Compliance risk reduced
- Payroll errors prevented
- Cost leakage identified
- Rework avoided
- Exception reduction
- Agent eligibility percentage

Locations:

- Journey cards
- Journey detail header
- Operations Cockpit summary cards
- Manual-to-agent upgrade panel
- Simulation result screen

## 11. Simulation / Dry Run Mode

Implemented in:

- Entity Admin -> Configure -> Context & Journey
- Super Admin -> Configure -> Context & Journey

Simulation should show:

- Manual execution path
- Agent-enabled execution path
- Step owners
- Human approvals that remain mandatory
- Required integrations
- Missing configs
- Potential blockers
- SLA projection
- Estimated time/cost difference
- Readiness score

Output states:

- `Can run manually now`
- `Agent mode blocked by missing integration`
- `Approval steps unchanged`
- `Compliance Hub data missing`
- `Payroll rules incomplete`
- `Recommended next action`

## 12. Implementation Phases

1. Documentation file.
2. Configuration state and toggles.
3. Mode-aware CTA routing.
4. Manual journey runner.
5. Operations cockpit.
6. Evidence and exceptions.
7. ROI and upgrade recommendations.
8. Simulation mode.

## 13. Acceptance Criteria

- Existing AI Contract Assistant still works.
- Existing Payroll agentic run still works.
- Existing H2R agentic run still works.
- Existing automation wizard still works.
- Existing journey request/activation flow still works.
- Agent off starts manual mode.
- Agent on starts current agentic mode.
- Step-level override creates hybrid journey.
- Cockpit shows all active journey runs.
- Evidence drawer opens for every critical step.
- Exceptions can be created, escalated, and resolved.
- ROI and upgrade prompts appear after manual work is simulated.
- No current feature is removed or regressed.

## 14. Product Inputs Still Needed

- Compliance Hub screen fields and design.
- Payroll manual calculation fields.
- Final settlement calculation fields.
- Onboarding checklist fields.
- Work permit/compliance rule examples.
- Preferred cockpit visual style, if different from current dashboard cards.
