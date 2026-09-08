# Third-Party System Integration — Complete Implementation Plan
**OpenDhi / ADT AI Execution Layer**
Version 1.0 | July 2026 | Internal Product & Engineering Reference

---

## Table of Contents

1. [Overview & Scope](#1-overview--scope)
2. [Roles & Responsibilities](#2-roles--responsibilities)
3. [Integration Lifecycle — State Machine](#3-integration-lifecycle--state-machine)
4. [Entity Admin — Complete Flow](#4-entity-admin--complete-flow)
   - 4.1 [Where It Starts: Configure → Systems](#41-where-it-starts-configure--systems)
   - 4.2 [Raising a New Integration Request](#42-raising-a-new-integration-request)
   - 4.3 [The Intake Form — Every Field Explained](#43-the-intake-form--every-field-explained)
   - 4.4 [Request Dashboard — Tracking Status](#44-request-dashboard--tracking-status)
   - 4.5 [After Approval — What the Entity Admin Sees](#45-after-approval--what-the-entity-admin-sees)
5. [Super Admin — Complete Flow](#5-super-admin--complete-flow)
   - 5.1 [Receiving the Request](#51-receiving-the-request)
   - 5.2 [Triage & Assessment](#52-triage--assessment)
   - 5.3 [Scoping Call Checklist](#53-scoping-call-checklist)
   - 5.4 [Connector Configuration](#54-connector-configuration)
   - 5.5 [Credential Management](#55-credential-management)
   - 5.6 [Journey Step Routing Configuration](#56-journey-step-routing-configuration)
   - 5.7 [Testing Before Approval](#57-testing-before-approval)
   - 5.8 [Approving & Provisioning](#58-approving--provisioning)
   - 5.9 [Rejection Handling](#59-rejection-handling)
6. [Data Models](#6-data-models)
   - 6.1 [IntegrationRequest](#61-integrationrequest)
   - 6.2 [SystemConnector](#62-systemconnector)
   - 6.3 [ConnectorCredential](#63-connectorcredential)
   - 6.4 [JourneyStepRouting](#64-journeysteprouting)
   - 6.5 [IntegrationEvent Log](#65-integrationevent-log)
7. [Auth Patterns by Protocol](#7-auth-patterns-by-protocol)
   - 7.1 [OAuth 2.0 Client Credentials](#71-oauth-20-client-credentials)
   - 7.2 [API Key / Bearer Token](#72-api-key--bearer-token)
   - 7.3 [Basic Auth (Service Account)](#73-basic-auth-service-account)
   - 7.4 [OAuth 2.0 Authorization Code](#74-oauth-20-authorization-code)
   - 7.5 [Mutual TLS (mTLS)](#75-mutual-tls-mtls)
   - 7.6 [File-Based / SFTP](#76-file-based--sftp)
8. [Connector Configuration — Per Vendor](#8-connector-configuration--per-vendor)
   - 8.1 [SAP S/4HANA (OData)](#81-sap-s4hana-odata)
   - 8.2 [SAP S/4HANA (RFC/BAPI)](#82-sap-s4hana-rfcbapi)
   - 8.3 [Infor CloudSuite (ION API Gateway)](#83-infor-cloudsuite-ion-api-gateway)
   - 8.4 [Infor On-Premise](#84-infor-on-premise)
   - 8.5 [Workday (SOAP / REST)](#85-workday-soap--rest)
   - 8.6 [Oracle Fusion Cloud](#86-oracle-fusion-cloud)
   - 8.7 [Generic REST / Custom System](#87-generic-rest--custom-system)
9. [Journey Step Routing — How It Works](#9-journey-step-routing--how-it-works)
10. [Error Handling & Retry Strategy](#10-error-handling--retry-strategy)
11. [Monitoring & Alerting](#11-monitoring--alerting)
12. [Credential Rotation Process](#12-credential-rotation-process)
13. [UI Specifications](#13-ui-specifications)
    - 13.1 [Entity Admin — UI Screens](#131-entity-admin--ui-screens)
    - 13.2 [Super Admin — UI Screens](#132-super-admin--ui-screens)
14. [Business Rules](#14-business-rules)
15. [Acceptance Criteria](#15-acceptance-criteria)
16. [Edge Cases](#16-edge-cases)
17. [Open Questions](#17-open-questions)

---

## 1. Overview & Scope

### What This Document Is

This is the complete implementation plan for the Third-Party System Integration feature in the OpenDhi / ADT AI Execution Layer. It covers everything from how an entity admin raises a request, through how the super admin processes and configures it, to how connected systems are used in live journey runs.

The goal is a repeatable, auditable, vendor-agnostic process. The same workflow handles a request for SAP, Infor, Workday, Oracle, or any custom system. Only the connector configuration (auth method, endpoint, protocol) varies per vendor.

### What This Enables

- An entity admin's company may already use multiple ERP or HR systems (e.g., SAP for finance, a custom payroll engine). They can request that the AI Execution Layer routes specific journey steps to those systems instead of running them in isolation.
- A super admin (OpenDhi ops/engineering) receives the request, validates it, configures the connector, and activates it for that entity's tenant.
- Journey steps are then able to call the connected system (read data from it, write data to it, or trigger operations in it) as part of automated runs.

### What This Does Not Cover

- Billing or commercial agreements with the external system vendor.
- Legal or compliance review of data-sharing with the external system. That must be handled by the entity's legal team before integration is approved.
- End-to-end production architecture (secrets manager vendor selection, orchestration engine specifics). Those are infrastructure decisions that go through engineering separately.

---

## 2. Roles & Responsibilities

| Role | Who | What They Own in This Feature |
|---|---|---|
| **Entity Admin** | Tenant admin at the client company | Raises integration request, provides technical details, confirms module scope, provides credentials, signs off on UAT |
| **Super Admin** | OpenDhi ops or engineering team | Receives request, triages, conducts scoping call, configures connector, tests, approves, monitors |
| **Entity User** | Day-to-day operator at the client | Does not configure anything. Benefits from connected journey steps being available |
| **Engineering** | OpenDhi dev team | Builds connector infrastructure, implements per-vendor adapters, builds monitoring |
| **Compliance / Legal** (client-side) | Entity's own team | Reviews whether third-party data sharing via API is permitted under their contracts with the system vendor |

### Decision Authority

| Decision | Who Decides |
|---|---|
| Which modules go to which system | Entity Admin (with their business/IT team) |
| Which system is master for each data domain | Entity Admin (with their IT team). OpenDhi advises, does not decide. |
| Whether to approve the integration | Super Admin |
| What fallback behavior applies if the external system is down | Product / Engineering define default. Entity Admin can request per-step override. |
| Credential rotation schedule | Entity Admin owns it. Super Admin ops team sends reminders. |

---

## 3. Integration Lifecycle — State Machine

Every integration request passes through these states in order. No state can be skipped.

```
DRAFT
  │
  ▼ (Entity Admin submits)
SUBMITTED
  │
  ▼ (Super Admin picks up and starts triage)
UNDER_REVIEW
  │
  ├──► NEEDS_MORE_INFO  ──► (Entity Admin provides info) ──► UNDER_REVIEW
  │
  ├──► REJECTED  (Super Admin rejects with reason)
  │
  ▼ (Scoping call done, configuration started)
CONFIGURING
  │
  ├──► BLOCKED  (waiting on client's IT team, e.g. credentials not ready)
  │      │
  │      └──► CONFIGURING (unblocked)
  │
  ▼ (Connector configured, testing started)
TESTING
  │
  ├──► TESTING_FAILED  ──► (Super Admin fixes issue) ──► TESTING
  │
  ▼ (All tests passed, UAT signed off)
PENDING_APPROVAL
  │
  ▼ (Super Admin approves)
APPROVED
  │
  ▼ (System provisioned for the entity's tenant)
ACTIVE
  │
  ├──► SUSPENDED  (credential expired, system unreachable, policy violation)
  │      │
  │      └──► ACTIVE (issue resolved)
  │
  └──► DEACTIVATED  (entity requests removal)
```

### Status Definitions

| Status | Visible To | Description |
|---|---|---|
| `DRAFT` | Entity Admin only | Request form started but not yet submitted |
| `SUBMITTED` | Both | Request submitted. Awaiting Super Admin pickup. |
| `UNDER_REVIEW` | Both | Super Admin has picked it up and is reviewing |
| `NEEDS_MORE_INFO` | Both | Super Admin needs additional information from Entity Admin |
| `REJECTED` | Both | Request rejected. Reason is mandatory. |
| `CONFIGURING` | Super Admin (summary to Entity Admin) | Connector being configured by Super Admin |
| `BLOCKED` | Both | Configuration blocked, waiting on the entity's side |
| `TESTING` | Super Admin | Connector under test. Entity Admin sees "Configuration in Progress" |
| `TESTING_FAILED` | Super Admin only | Tests failed. Entity Admin still sees "Configuration in Progress" |
| `PENDING_APPROVAL` | Both | Tests passed. Super Admin doing final review before activation. |
| `APPROVED` | Both | Approved. Provisioning in progress. |
| `ACTIVE` | Both | System is live and connected to the entity's journeys |
| `SUSPENDED` | Both | Temporarily disabled. Reason shown. |
| `DEACTIVATED` | Both | Permanently removed. |

---

## 4. Entity Admin — Complete Flow

### 4.1 Where It Starts: Configure → Systems

Entity Admin logs in and navigates to **Configure → Systems**.

**What they see:**

The Systems page shows two sections:

**Connected Systems** (currently active integrations for their entity)
- Each card shows: System name, vendor logo, connection status badge (Active / Suspended), modules it handles, last successful sync timestamp, quick actions: View Details / Request Change / Deactivate.

**Available Systems** (systems in the platform catalog but not yet connected for this entity)
- Each card shows: System name, vendor logo, brief description, "Add to your workspace" button.
- If the system is already in the platform catalog (pre-configured by Super Admin as a platform-level template), the Entity Admin sees a guided activation flow.
- If the system is not in the catalog at all (custom or new vendor), they see a "Request Custom Integration" path.

---

### 4.2 Raising a New Integration Request

**Trigger:** Entity Admin clicks "Add to your workspace" (catalog system) or "Request Custom Integration" (new system).

**Flow:**

1. A modal or dedicated page opens with the intake form (see 4.3).
2. Entity Admin fills the form. Fields can be saved as draft at any point.
3. Before final submission, Entity Admin sees a summary screen: "You are requesting to connect [System Name] for modules [HR, Payroll]. The following journeys will be affected: [Contract Creation, H2R Lifecycle]. Please confirm."
4. Entity Admin confirms and submits. Status moves to `SUBMITTED`.
5. Entity Admin sees a confirmation: "Your request has been received. Reference ID: [INT-20260708-001]. Our team will review it within 2 business days and reach out to your technical contact."

**Notification sent to:**
- Entity Admin (email + in-app): "Your integration request for [System Name] has been submitted successfully. Reference: [INT-20260708-001]."
- Super Admin (email + in-app notification): "New integration request received from [Entity Name] for [System Name]. Action required."

---

### 4.3 The Intake Form — Every Field Explained

The form is divided into four sections. All mandatory fields must be filled before submission. Optional fields are clearly marked.

---

#### Section A: System Identity

| Field | Mandatory | Input Type | Notes |
|---|---|---|---|
| **System / Vendor Name** | Yes | Text | e.g., "Infor CloudSuite HCM" |
| **Is this system in our catalog?** | Yes | Auto-detected | Shown as read-only if navigated from catalog |
| **Product variant or edition** | Yes | Text | e.g., Infor M3 vs Infor LN vs Infor CloudSuite. Different products, not just versions. |
| **Version / release number** | Yes | Text | As shown in their vendor contract or system settings page |
| **Hosting environment** | Yes | Dropdown | Cloud / On-premise / Hybrid |
| **Vendor's developer portal URL** | Optional | URL | If known. Helps Super Admin access vendor API docs directly. |
| **Does your team have an active API/developer account with this vendor?** | Yes | Radio: Yes / No / Not Sure | If No, Super Admin needs to flag this as a blocker early. |

---

#### Section B: Module & Journey Scope

This is the most critical section. It prevents master data conflicts and scope creep.

| Field | Mandatory | Input Type | Notes |
|---|---|---|---|
| **Which business modules should this system handle?** | Yes | Multi-select checkbox | Options: HR / Payroll / Finance / Procurement / Supply Chain / Document Management / Other (with text) |
| **For each selected module, describe what this system will do** | Yes | Text per module | e.g., "HR: employee master creation and updates. Payroll: salary calculation and payslip generation." |
| **Which journeys in the AI layer will be affected?** | Yes | Multi-select (from active journeys list) | Entity Admin selects from the list of journeys active on their tenant. |
| **For each affected journey, which steps should call this system?** | Yes | Per-journey step selector | Shows the step list of each selected journey. Entity Admin checks which steps route to the new system. |
| **Which modules stay on your existing connected systems?** | Yes | Text | e.g., "Finance stays on SAP S/4HANA. Only HR moves to Infor HCM." |
| **Who is the master (single source of truth) for employee data?** | Yes | Radio: New System / Existing System / Shared (describe) | Must be ONE system. If "Shared", Super Admin will flag this as a risk during review. |
| **Is there any data that needs to sync between this new system and your existing connected system?** | Yes | Radio: Yes / No. If Yes: describe | e.g., "Employee created in Infor must be reflected in SAP for finance reporting." Real-time sync requires additional architecture — must be flagged early. |
| **Expected data volume per day** | Optional | Dropdown: < 100 records / 100-1000 / 1000-10,000 / > 10,000 | Used to assess rate limit risk. |

---

#### Section C: Technical Details

| Field | Mandatory | Input Type | Notes |
|---|---|---|---|
| **API protocol this system uses** | Yes | Dropdown: REST / SOAP / OData / GraphQL / File-based (SFTP/FTP) / Proprietary / Don't Know | If "Don't Know", Super Admin will find out in scoping call. |
| **Authentication method** | Yes | Dropdown: OAuth 2.0 Client Credentials / OAuth 2.0 Authorization Code / API Key / Basic Auth (username + password) / Mutual TLS / Other / Don't Know | |
| **API base URL or endpoint** | Conditional | URL | Required if Entity Admin knows it. Can be filled by Super Admin if not known. |
| **Is there a sandbox or test environment available?** | Yes | Radio: Yes / No / Not Sure | If No, this is a blocker. Super Admin cannot test on production. |
| **If yes, what is the sandbox/test environment URL?** | Conditional | URL | Required if sandbox exists. |
| **Does this system support webhooks (push notifications on events)?** | Yes | Radio: Yes / No / Don't Know | Determines whether the AI layer can be event-driven or must poll. |
| **If yes, which events does it support webhooks for?** | Conditional | Text | e.g., "Employee created, employee updated, payroll approved." |
| **API documentation link** | Optional | URL | Link to vendor's API docs or developer portal. |
| **Rate limits (if known)** | Optional | Text | e.g., "100 requests per minute per API key." If unknown, Super Admin will check with vendor docs. |
| **Are there any known restrictions on third-party API access in your contract with this vendor?** | Yes | Radio: Yes / No / Not Sure | Critical for SAP users (see SAP API policy note). If Yes, must have legal sign-off before integration proceeds. |

---

#### Section D: Client Team & Contacts

| Field | Mandatory | Input Type | Notes |
|---|---|---|---|
| **Named technical contact (name + email)** | Yes | Text | The person who has admin access to the system and can generate API credentials. This is not always the Entity Admin themselves. |
| **Technical contact's role** | Yes | Text | e.g., "IT Manager", "SAP Basis Administrator", "Workday Integration Specialist" |
| **Business owner for this integration** | Yes | Text | The person accountable for the integration succeeding. May be the same as Entity Admin. |
| **Availability for a scoping call** | Yes | Text / Date picker | At least 2 available slots in the next 5 business days. |
| **Expected go-live date** | Optional | Date picker | Used for scheduling. Super Admin will confirm feasibility. |
| **Is there a vendor integration support contact?** | Optional | Text | Some enterprise vendors assign a technical account manager. Their contact helps if we need vendor-specific support. |

---

#### Section E: Declaration

Before submission, Entity Admin must confirm:

- [ ] I confirm that our company's contract with [Vendor Name] permits third-party API access of this nature.
- [ ] I confirm that I have the authority to request this integration on behalf of my organisation.
- [ ] I understand that credential management (rotation, renewal) is my organisation's responsibility, and OpenDhi will notify us 14 days before expiry.
- [ ] I confirm that no personally identifiable employee data will be transferred through this integration without appropriate data processing agreements being in place.

> **Note:** If the entity cannot check the vendor contract confirmation, the request is blocked at `SUBMITTED` until legal confirmation is provided.

---

### 4.4 Request Dashboard — Tracking Status

Entity Admin sees a "My Integration Requests" panel within Configure → Systems, and also in their dashboard under "Your Requests."

Each request card shows:
- Reference ID (e.g., INT-20260708-001)
- System name
- Current status (with colour-coded badge)
- Assigned Super Admin (name, visible once status moves to `UNDER_REVIEW`)
- Last activity timestamp
- Status-specific action or message:
  - `SUBMITTED` → "Awaiting review. Expected response within 2 business days."
  - `NEEDS_MORE_INFO` → "Action required: [Super Admin's specific question]. Please respond to continue."
  - `CONFIGURING` / `TESTING` → "Configuration in progress. No action needed from your side."
  - `BLOCKED` → "Blocked: [reason]. Action required from your team: [specific ask]."
  - `PENDING_APPROVAL` → "Final review in progress. You will be notified when it goes live."
  - `ACTIVE` → "Connected and active. [View integration details]"
  - `SUSPENDED` → "Integration suspended: [reason]. Action required: [e.g., renew credentials]."

**Entity Admin can:**
- View full timeline of every status change with timestamps and notes.
- Respond to "Needs More Info" requests directly in the portal (text input with file attach).
- Request deactivation of an active integration.
- Download the integration summary (for their records).

**Entity Admin cannot:**
- See internal testing notes or failure logs from Super Admin's side.
- Change any configuration themselves once the request is submitted.
- Move the status forward directly.

---

### 4.5 After Approval — What the Entity Admin Sees

Once `ACTIVE`:

In Configure → Systems → Connected Systems, the new system appears with:
- Status: Active (green badge)
- Modules it handles: listed
- Journeys it is wired into: listed with specific step names
- Last sync: timestamp of last successful API call from any journey step
- Credential expiry: date (shown prominently if within 30 days)
- Actions: View Details / Request Change / Request Deactivation

**View Details** shows:
- System information (vendor, version, environment)
- Auth method (shown as type only, never the actual credentials)
- Modules and journeys in scope
- Full event log: every API call made to this system by any journey step, with timestamp, journey name, step name, outcome (success / failure / retry), and response time. No raw data — just audit trail.
- Integration health: calls in last 24h, success rate, average response time.

---

## 5. Super Admin — Complete Flow

### 5.1 Receiving the Request

Super Admin is notified of new integration requests via:
- In-app notification badge on the Platform Console
- Email with reference ID, entity name, system name, and link to the request

**Platform Console → Integrations → Requests Queue**

The queue shows all pending requests across all entities. Columns:
- Reference ID
- Entity Name
- System / Vendor
- Submitted On
- Assigned To (Super Admin team member)
- Current Status
- Days in current status (highlighted if > 2 business days without action)

Super Admin picks up a request by clicking "Assign to Me." Status moves from `SUBMITTED` to `UNDER_REVIEW`.

---

### 5.2 Triage & Assessment

First action on a new request: **review the intake form completeness**, not the technical details.

**Completeness check:**

Go through every mandatory field. If any of the following are missing or unclear, move status to `NEEDS_MORE_INFO` with a specific message:

- Module scope is vague (e.g., "we want it for HR" without specifying which steps)
- Master data ownership not defined
- No technical contact specified (or technical contact has no admin access to the system)
- Vendor contract restriction checkbox not confirmed
- No sandbox environment indicated and no plan for how to test
- System name is ambiguous (e.g., "Infor" without specifying M3, LN, or CloudSuite — these are different codebases)

**Risk flags to identify at triage:**

| Risk | What to look for | Action |
|---|---|---|
| SAP vendor contract restriction | Entity uses SAP and did not confirm vendor contract check | Block until legal confirmation received |
| "Shared" master data ownership | Entity selected "Shared" for employee data ownership | Flag during scoping call — must define one master system |
| No sandbox | Entity selected "No" for sandbox availability | Flag as blocker — request will not proceed to TESTING without a test environment |
| Very high data volume + unknown rate limits | Entity selected > 10,000 records/day + rate limits unknown | Research vendor rate limits before scoping call |
| Real-time cross-system sync required | Entity selected "Yes" for sync between old and new system | Flag as architecture complexity — may need separate design session |
| On-premise system | Entity selected "On-premise" hosting | Flag: need to understand if vendor's on-premise integration agent is set up |

---

### 5.3 Scoping Call Checklist

Book a 30-minute call with the entity's technical contact. Use this checklist. Do not configure anything before the call.

**Questions to confirm verbally (beyond what the form says):**

**About their system:**
- Can you show us the system's API documentation or developer portal? We need the actual endpoint URLs, not just the vendor's marketing page.
- Do you have an active login to the vendor's developer/admin console where API credentials can be generated?
- Have you used this system's API before for any other integration? (Tells us how capable their team is)
- What version are you on, and when did you last upgrade? (Affects which API endpoints are available)

**About the module scope:**
- Walk us through what data needs to flow in each direction. What does the AI layer need to read from your system? What does it need to write back?
- For the employee master — if an employee is created in this new system, does your existing SAP also need to know about them immediately? How does that currently work without us?
- Are there any workflows in your system that the AI layer should trigger, or does the AI layer only need to read/write data?

**About the credentials:**
- Who in your team will generate the API credentials? Are they available during our testing window?
- Does your vendor's API key or OAuth secret expire? If so, after how long?
- Do you have IT firewall or IP allowlist policies that might block API calls from our systems? (Common in on-premise setups)

**About testing:**
- Can you give us access to your sandbox/test environment that contains realistic (but non-production) data?
- Who on your side will validate the test results? (This must be the technical contact, not a business user)
- What does your go-live process look like on your end? Do you need any change approvals from your IT team before live traffic flows?

**Output of scoping call:**
- Confirmed module routing matrix (saved as a document linked to the request)
- Confirmed data flow diagram (sketch is fine — just directional)
- Agreed test plan (what we'll test, with what data, signed off by whom)
- Credentials delivery method agreed (secure share — not email)
- Timeline agreed

---

### 5.4 Connector Configuration

After the scoping call, status moves to `CONFIGURING`. Super Admin opens the connector configuration screen in Platform Console → Integrations → Connectors.

**Creating a new connector:**

A connector is a platform-level entity that represents one connection to one external system. One entity can have multiple connectors (e.g., SAP connector + Infor connector). Multiple entities can share a connector template but have separate credential instances.

**Connector record fields (filled by Super Admin):**

```
connector_id:         [auto-generated]
entity_id:            [the requesting entity's ID]
display_name:         "Infor CloudSuite HCM — Dhi Hyperlocal"
vendor:               infor
product:              cloudsuite_hcm
version:              "2025.x"
environment:          cloud | on_premise | hybrid
hosting_url:          "https://dhi.inforcloudsuite.com"
api_protocol:         rest | soap | odata | graphql | sftp | proprietary
auth_method:          oauth2_client_credentials | api_key | basic_auth | oauth2_auth_code | mtls | sftp_key
credential_id:        [FK to ConnectorCredential — stored separately in secrets manager]
base_endpoint:        "https://dhi.inforcloudsuite.com/INFOR/api"
timeout_ms:           30000
retry_max:            3
retry_backoff:        exponential
rate_limit_rph:       [requests per hour limit — from vendor docs or scoping call]
modules_in_scope:     ["hr", "payroll"]
journey_step_ids:     [list of step IDs this connector serves]
sandbox_url:          "https://dhi-test.inforcloudsuite.com"
status:               draft | active | suspended | deactivated
created_by:           [Super Admin user ID]
created_at:           [timestamp]
last_modified_at:     [timestamp]
credential_expiry_at: [date — triggers rotation reminders]
notes:                [internal notes from scoping call, not visible to entity]
```

---

### 5.5 Credential Management

**Rule: Credentials are never stored in the connector record, in code, or in a database column. They go into the secrets manager only.**

**Process:**

1. Entity's technical contact shares credentials via a secure channel (a one-time secure link — NOT email, NOT Slack, NOT a form field that gets logged).
2. Super Admin receives credentials and immediately creates a `ConnectorCredential` record in the secrets manager:

```
credential_id:        [auto-generated, referenced in connector record]
connector_id:         [FK]
entity_id:            [FK]
auth_type:            oauth2_client_credentials
fields:
  token_url:          "https://dhi.inforcloudsuite.com/as/token.oauth2"
  client_id:          [stored in secrets manager]
  client_secret:      [stored in secrets manager]
  scope:              "HR Payroll"
  token_ttl_seconds:  7200
created_at:           [timestamp]
expires_at:           [date credential will expire — set from vendor policy]
rotation_reminder_at: [expires_at minus 14 days]
rotated_by:           null (filled when rotated)
last_rotation_at:     null
```

3. The credentials themselves are stored as encrypted secrets. The connector configuration references only the `credential_id`.
4. When a journey step calls the external system, the connector fetches the credential by `credential_id` at runtime. The credential is never cached beyond the current token's TTL.
5. Super Admin confirms credentials are working by running a connectivity test (see 5.7).

**Credential delivery options (in order of preference):**
- Secret sharing tool with one-time link (e.g., 1Password Share, Bitwarden Send)
- Encrypted email with the key shared via a separate channel
- Client uploads directly to a secure portal field that is encrypted at rest and does not appear in logs

---

### 5.6 Journey Step Routing Configuration

This is where you map specific journey steps to the connector. This is done in Platform Console → Integrations → Step Routing.

For each affected journey, Super Admin opens the journey's step configuration and for each step that should call the external system:

```
journey_id:           "contract-creation"
step_id:              "step-employee-created"
step_name:            "Employee Created"
routing:
  system:             connector_id (e.g., "conn-infor-hcm-dhi")
  action_type:        read | write | trigger | read_write
  endpoint:           "/INFOR/api/hcm/employees"
  method:             POST
  field_mapping:      [see below]
  response_mapping:   [see below]
  fallback:           pause_journey | use_cached_data | fail_step
  fallback_details:   "If Infor HCM unavailable, pause journey and alert ops team"
```

**Field Mapping — AI Layer to External System:**

```yaml
field_mapping:
  - source_field: "employee.first_name"
    target_field: "FirstName"
    transform: none

  - source_field: "employee.date_of_birth"
    target_field: "BirthDate"
    transform: "format_date: YYYY-MM-DD → DD/MM/YYYY"

  - source_field: "contract.country_code"
    target_field: "CountryCode"
    transform: "lookup: ISO3166_alpha2 → vendor_country_code_map"

  - source_field: "contract.employment_type"
    target_field: "EmploymentType"
    transform: "lookup: { EOR: '01', PEO: '02', CONTRACTOR: '03' }"
```

**Response Mapping — External System to AI Layer:**

```yaml
response_mapping:
  - source_field: "response.EmployeeId"
    target_field: "external_ids.infor_hcm_employee_id"

  - source_field: "response.Status"
    target_field: "employee.external_status"
    transform: "lookup: { 'ACTIVE': 'active', 'INACTIVE': 'inactive' }"
```

---

### 5.7 Testing Before Approval

Status moves to `TESTING`. All tests run against the sandbox environment, never production.

**Test Suite — Required:**

#### Test 1: Authentication

```
Action: Request a new OAuth token using the stored credentials.
Expected: HTTP 200, valid token returned, token TTL matches expected.
Fail condition: 400 (bad credentials), 401 (invalid client), 403 (forbidden scope).
What to check: token_url correct, client_id and client_secret correct,
               scope string matches what the vendor's admin configured.
```

#### Test 2: Basic Read (Happy Path)

```
Action: Call a simple read endpoint using the new token.
         e.g., GET /employees/{test_employee_id}
Expected: HTTP 200, response matches expected schema.
Fail condition: 403 (permission not granted for this endpoint),
                404 (test employee doesn't exist in sandbox),
                response schema doesn't match field mapping.
What to check: ISU/service account has permission for this domain,
               sandbox contains test data.
```

#### Test 3: Basic Write (Happy Path)

```
Action: Create a test record using the connector.
         e.g., POST /employees with test data.
Expected: HTTP 201 or 200, record created in sandbox,
          response contains the external ID.
Fail condition: 400 (field validation error — field mapping issue),
                403 (write permission not granted),
                422 (business rule violation in the external system).
What to check: mandatory fields in the external system that aren't
               in the AI layer's data model (must add defaults or ask entity).
```

#### Test 4: Token Expiry Handling

```
Action: Force-expire the current token (or wait for TTL to pass).
         Then make an API call.
Expected: Connector detects 401, requests new token, retries original call.
          Journey step succeeds transparently.
Fail condition: Journey step fails with 401 error exposed to the user.
                Connector does not auto-refresh.
```

#### Test 5: External System Down (Timeout)

```
Action: Set sandbox endpoint to an unreachable URL.
Expected: Connector times out after timeout_ms,
          applies retry logic (retry_max times with exponential backoff),
          after all retries exhausted, applies fallback action.
          Journey step moves to correct fallback state.
Fail condition: Journey run crashes ungracefully,
                no error logged, no fallback triggered.
```

#### Test 6: Rate Limit Handling

```
Action: Send requests at a rate that exceeds the vendor's rate limit.
Expected: Connector detects 429 (Too Many Requests),
          reads Retry-After header if present,
          backs off and retries after appropriate delay.
          Journey steps queue correctly, none fail.
Fail condition: 429 propagates as a journey step failure.
                No backoff, hammering the API after rate limit hit.
```

#### Test 7: Field Validation Failure

```
Action: Send a request with a deliberately invalid field
         (e.g., invalid date format, unknown country code).
Expected: External system returns 400 or 422 with validation error.
          AI layer captures the error, logs it with enough detail
          (which field, what value, what was rejected), surfaces it
          in the run detail as a human-readable message.
Fail condition: Raw HTTP error propagated with no explanation.
                No field-level detail in the log.
```

#### Test 8: Full Journey Run (End-to-End)

```
Action: Run the full affected journey in the AI layer against the sandbox.
         Use realistic test data (not "test1", "test2" — use names,
         dates, amounts that mirror production patterns).
Expected: Every step completes. Steps routing to the new system
          show correct data. Steps routing to existing systems
          are unaffected. Journey completes successfully.
Fail condition: Any step fails. Data mismatch between what was sent
                and what appears in the external system's sandbox.
                Existing system steps affected by the new routing.
```

#### Test 9: UAT Sign-Off

After all automated tests pass, the entity's technical contact must:
- Log into their sandbox system and verify the test records created by the integration.
- Confirm the data looks correct (field values, formats, associations).
- Sign off in the platform portal: "I confirm the data in the test environment matches expectations."

Without this sign-off, the request cannot move to `PENDING_APPROVAL`.

---

### 5.8 Approving & Provisioning

After all tests pass and UAT is signed off:

1. Super Admin reviews the complete request one final time:
   - All fields complete and accurate.
   - Credential expiry date noted and rotation reminder set.
   - Monitoring baseline documented (what error rate % and response time ms should trigger an alert).
   - Journey step routing confirmed correct.
   - Fallback behaviors confirmed appropriate.

2. Super Admin clicks "Approve & Activate." Status moves to `APPROVED` then immediately to `ACTIVE` once provisioning completes (typically < 1 minute).

3. **Provisioning actions (automated):**
   - Connector status updated to `ACTIVE` in the entity's tenant.
   - Journey steps updated to route to the connector in production.
   - Monitoring baseline recorded.
   - Credential rotation reminder scheduled.
   - Integration summary document generated and attached to the request.

4. **Notifications sent:**
   - Entity Admin (email + in-app): "[System Name] is now connected to your workspace. Affected journeys: [list]. Reference: [INT-ID]."
   - Super Admin team log: "INT-20260708-001 activated. Entity: Dhi Hyperlocal. System: Infor HCM. Activated by: [Super Admin name]."

5. **First live run must be manually supervised.** Super Admin watches the first production run of each affected journey. The first run is not automated — it runs step by step with a Super Admin monitoring in real time.

---

### 5.9 Rejection Handling

Super Admin can reject at any point before `APPROVED`. Rejection requires:
- A mandatory written reason (minimum 50 characters)
- Specific guidance on what would need to change for the request to be re-submitted
- If the rejection is due to something on OpenDhi's side (e.g., unsupported protocol), explain that honestly

Entity Admin sees the rejection reason in full and can re-submit a new request referencing the original.

Rejection reasons (logged for analytics):
- `INSUFFICIENT_INFO` — intake form too incomplete to assess
- `NO_SANDBOX` — testing not possible without test environment
- `UNSUPPORTED_PROTOCOL` — vendor uses a protocol we don't currently support
- `LEGAL_BLOCK` — vendor contract does not permit third-party API access
- `MASTER_DATA_CONFLICT` — entity cannot define a single master system per data domain
- `VENDOR_RESTRICTION` — vendor (e.g., SAP post-API-policy) restricts the use case
- `SECURITY_RISK` — credentials or configuration pose unacceptable security risk
- `ENTITY_WITHDRAWN` — entity withdrew the request themselves

---

## 6. Data Models

### 6.1 IntegrationRequest

```typescript
interface IntegrationRequest {
  id: string;                          // "INT-20260708-001"
  entity_id: string;
  entity_name: string;
  requested_by_user_id: string;
  status: IntegrationRequestStatus;
  
  // System Identity
  vendor_name: string;
  product_name: string;
  product_variant: string;
  version: string;
  hosting_environment: "cloud" | "on_premise" | "hybrid";
  vendor_developer_portal_url?: string;
  entity_has_api_account: boolean | null;
  
  // Module Scope
  modules_in_scope: string[];
  module_descriptions: Record<string, string>;
  affected_journey_ids: string[];
  step_routing_requests: StepRoutingRequest[];
  existing_system_scope: string;
  master_data_owner: "new_system" | "existing_system" | "shared";
  master_data_owner_notes?: string;
  cross_system_sync_required: boolean;
  cross_system_sync_description?: string;
  expected_daily_volume: "lt_100" | "100_1000" | "1000_10000" | "gt_10000";
  
  // Technical
  api_protocol: "rest" | "soap" | "odata" | "graphql" | "sftp" | "proprietary" | "unknown";
  auth_method: string;
  api_base_url?: string;
  sandbox_available: boolean | null;
  sandbox_url?: string;
  webhooks_supported: boolean | null;
  webhook_events?: string[];
  api_docs_url?: string;
  rate_limits?: string;
  vendor_contract_confirmed: boolean;
  
  // Contacts
  technical_contact_name: string;
  technical_contact_email: string;
  technical_contact_role: string;
  business_owner_name: string;
  scoping_call_slots: string[];
  expected_go_live_date?: string;
  vendor_support_contact?: string;
  
  // Declaration checkboxes
  declarations_confirmed: boolean;
  
  // Internal (Super Admin use only)
  assigned_to_user_id?: string;
  connector_id?: string;
  rejection_reason?: string;
  rejection_category?: RejectionCategory;
  internal_notes?: string;
  
  // Audit
  created_at: string;
  submitted_at?: string;
  last_status_changed_at: string;
  status_history: StatusHistoryEntry[];
}

interface StepRoutingRequest {
  journey_id: string;
  step_id: string;
  step_name: string;
  action_type: "read" | "write" | "trigger" | "read_write";
}

interface StatusHistoryEntry {
  status: IntegrationRequestStatus;
  changed_at: string;
  changed_by: string;
  note?: string;
}
```

---

### 6.2 SystemConnector

```typescript
interface SystemConnector {
  id: string;                          // "conn-infor-hcm-dhi-001"
  entity_id: string;
  integration_request_id: string;
  display_name: string;
  
  vendor: string;
  product: string;
  version: string;
  hosting_environment: "cloud" | "on_premise" | "hybrid";
  
  base_url: string;
  sandbox_url: string;
  api_protocol: string;
  auth_method: string;
  
  credential_id: string;               // FK to ConnectorCredential (secrets manager)
  
  timeout_ms: number;
  retry_max: number;
  retry_backoff: "linear" | "exponential";
  rate_limit_rph?: number;
  
  modules_in_scope: string[];
  
  status: "draft" | "active" | "suspended" | "deactivated";
  suspension_reason?: string;
  
  monitoring_config: MonitoringConfig;
  
  created_by: string;
  created_at: string;
  last_modified_at: string;
  credential_expiry_at?: string;
}

interface MonitoringConfig {
  alert_error_rate_pct: number;        // alert if error rate > this %
  alert_response_time_ms: number;      // alert if p95 response time > this
  alert_no_calls_after_minutes: number; // alert if no calls when expected
}
```

---

### 6.3 ConnectorCredential

```typescript
// This record lives in the secrets manager, not the application database.
// Only credential_id is stored in SystemConnector.

interface ConnectorCredential {
  id: string;
  connector_id: string;
  entity_id: string;
  auth_type: string;
  
  // Actual secret fields — encrypted at rest, never logged, never returned in API responses
  secrets: {
    // OAuth 2.0 Client Credentials:
    token_url?: string;
    client_id?: string;                // encrypted
    client_secret?: string;           // encrypted
    scope?: string;
    token_ttl_seconds?: number;
    
    // API Key:
    api_key?: string;                  // encrypted
    api_key_header?: string;           // e.g., "X-API-Key" or "Authorization"
    
    // Basic Auth:
    username?: string;
    password?: string;                 // encrypted
    
    // mTLS:
    client_cert?: string;              // encrypted PEM
    client_key?: string;               // encrypted PEM
    
    // SFTP:
    sftp_host?: string;
    sftp_port?: number;
    sftp_username?: string;
    sftp_private_key?: string;         // encrypted
    sftp_inbound_path?: string;
    sftp_outbound_path?: string;
  };
  
  created_at: string;
  expires_at?: string;
  rotation_reminder_at?: string;
  last_rotated_at?: string;
  rotated_by?: string;
}
```

---

### 6.4 JourneyStepRouting

```typescript
interface JourneyStepRouting {
  id: string;
  connector_id: string;
  entity_id: string;
  journey_id: string;
  step_id: string;
  
  action_type: "read" | "write" | "trigger" | "read_write";
  http_method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint_path: string;
  
  request_field_mappings: FieldMapping[];
  response_field_mappings: FieldMapping[];
  
  fallback_action: "pause_journey" | "use_cached_data" | "fail_step" | "skip_step";
  fallback_config?: Record<string, unknown>;
  
  is_active: boolean;
  created_at: string;
  last_modified_at: string;
}

interface FieldMapping {
  source_field: string;                // dot-notation path in source object
  target_field: string;               // dot-notation path in target object
  transform?: string;                  // "none" | "format_date:..." | "lookup:..."
  transform_config?: Record<string, string>; // lookup table if transform is "lookup"
  required: boolean;
  default_value?: unknown;             // if source_field is missing and required is false
}
```

---

### 6.5 IntegrationEvent Log

```typescript
// Append-only. Every external system call produces one record.

interface IntegrationEvent {
  id: string;
  connector_id: string;
  entity_id: string;
  journey_instance_id: string;
  step_id: string;
  
  timestamp: string;
  action_type: string;
  endpoint_called: string;
  http_method: string;
  
  request_ref: string;                 // pointer to request payload (stored separately, encrypted)
  response_ref: string;               // pointer to response payload (stored separately, encrypted)
  
  http_status: number;
  outcome: "success" | "failure" | "retry" | "fallback_triggered";
  error_code?: string;
  error_message?: string;             // vendor's error message, sanitised
  retry_attempt?: number;
  response_time_ms: number;
  
  // Request payload and response body are NOT stored inline here.
  // Only refs are stored. The actual payload is in encrypted blob storage
  // with access logged separately. This prevents PII appearing in the event log.
}
```

---

## 7. Auth Patterns by Protocol

### 7.1 OAuth 2.0 Client Credentials

**When used:** Infor ION, SAP BTP, Workday REST, Oracle Fusion, most modern cloud ERPs.

**How it works:**

```
1. At each API call, connector checks if a cached valid token exists.
   Valid = token was issued < (token_ttl_seconds - 60) seconds ago.

2. If no valid token:
   POST {token_url}
   Content-Type: application/x-www-form-urlencoded
   Body: grant_type=client_credentials
         &client_id={client_id}
         &client_secret={client_secret}
         &scope={scope}

3. Response: { "access_token": "...", "expires_in": 7200, "token_type": "Bearer" }

4. Token cached in-memory with expiry time = now + expires_in - 60 (60s buffer).

5. All API calls include: Authorization: Bearer {access_token}

6. If any API call returns 401:
   - Discard cached token immediately.
   - Request new token (step 2).
   - Retry original API call once with new token.
   - If still 401, escalate as authentication failure.
```

**Configuration fields needed from client:**
- `token_url`
- `client_id`
- `client_secret`
- `scope` (space-separated list of permission scopes)
- `token_ttl_seconds` (optional — can be read from the `expires_in` response field)

**Common failures:**
- Wrong scope — results in 403 on specific endpoints even though auth succeeds. Fix: request exact scope strings from the client's system admin.
- Token URL for sandbox differs from production — always confirm both.
- Client secret has special characters that break form-encoded body — URL-encode the secret before including in body.

---

### 7.2 API Key / Bearer Token

**When used:** Docuseal, some payroll SaaS, internal tools.

**How it works:**

```
All API calls include one of:
  Authorization: Bearer {api_key}
  X-API-Key: {api_key}
  (or other custom header — confirm with vendor docs)

No token exchange needed. Key is static until rotated.
```

**Configuration fields needed:**
- `api_key`
- `api_key_header` (which header the vendor expects)

**Common failures:**
- Client shares a "full admin" API key instead of a scoped one. If this key is compromised, the attacker has full system access. Always ask client to generate a scoped key for integration use only.
- Key has an expiry that nobody tracked. Set `credential_expiry_at` and rotation reminder.

---

### 7.3 Basic Auth (Service Account)

**When used:** Legacy systems, some on-premise ERPs, SOAP services.

**How it works:**

```
All API calls include:
  Authorization: Basic {base64(username:password)}

Or for SOAP:
  <wsse:UsernameToken>
    <wsse:Username>{username}</wsse:Username>
    <wsse:Password>{password}</wsse:Password>
  </wsse:UsernameToken>
```

**Configuration fields needed:**
- `username` (must be a service account, not a human account)
- `password`

**Common failures:**
- Client uses a human admin's personal account. When that person resets their password, integration breaks. Insist on a dedicated service account.
- Password contains characters that break base64 encoding in certain HTTP libraries. Test explicitly.
- Service account is subject to account lockout policies (too many failed attempts locks the account). If your retry logic retries aggressively on 401, you can lock the service account. Set maximum 3 retry attempts on auth failure, then stop and alert.

---

### 7.4 OAuth 2.0 Authorization Code

**When used:** Google Workspace, some HR/payroll SaaS tools, platforms where a human must consent.

**How it works:**

```
This flow requires a one-time human action:

1. Super Admin (or entity admin's technical contact) navigates to:
   {auth_url}?client_id={client_id}&redirect_uri={redirect_uri}&scope={scope}&response_type=code

2. User logs in and approves the integration in the vendor's portal.

3. Vendor redirects back to {redirect_uri}?code={auth_code}

4. Connector exchanges the code for tokens:
   POST {token_url}
   Body: grant_type=authorization_code
         &code={auth_code}
         &client_id={client_id}
         &client_secret={client_secret}
         &redirect_uri={redirect_uri}

5. Response: { "access_token": "...", "refresh_token": "...", "expires_in": 3600 }

6. Access token used for API calls. Refresh token stored (encrypted) for
   getting new access tokens without repeating the human consent step.

7. When access token expires:
   POST {token_url}
   Body: grant_type=refresh_token
         &refresh_token={refresh_token}
         &client_id={client_id}
         &client_secret={client_secret}

8. If refresh token itself expires (some vendors expire it after 30-90 days),
   the entire consent flow (steps 1-5) must be repeated.
```

**Key operational risk:** Refresh tokens expire. This creates a hard dependency on a human completing a browser-based flow periodically. Track refresh token expiry. Alert 14 days before.

---

### 7.5 Mutual TLS (mTLS)

**When used:** High-security enterprise systems, banking, some government-adjacent systems.

**How it works:**

```
Both sides present certificates during TLS handshake:
- Server presents its certificate (normal TLS).
- Client presents its certificate (the addition in mTLS).

The server validates the client certificate against a trusted CA.
If valid, connection is established with identity of both parties confirmed.
```

**Configuration fields needed:**
- `client_cert` (PEM format, issued by the vendor's CA or a shared CA)
- `client_key` (PEM format, private key for the client cert — never shared)
- `ca_cert` (optional — the CA cert for validating the server, if it's not a public CA)

**Common failures:**
- Client key and cert don't match (generated separately by mistake).
- Certificate CN/SAN doesn't match what the server expects.
- Certificate expired — zero grace period. Set expiry tracking and alert 30 days before for mTLS certs (they're harder to rotate than OAuth secrets).

---

### 7.6 File-Based / SFTP

**When used:** On-premise legacy systems, batch payroll, systems with no API at all.

**How it works:**

```
This is asynchronous. Not suitable for real-time journey steps.

Outbound (AI layer → external system):
1. AI layer generates a file (CSV, XML, fixed-width, or vendor-specific format).
2. File uploaded to SFTP server at a agreed path.
3. External system picks up file on its schedule (could be minutes, could be hours).
4. External system processes and places a response/acknowledgment file at an agreed path.
5. AI layer polls for the response file.
6. Journey step is in "waiting" state until response file is found or timeout reached.

Inbound (external system → AI layer):
1. External system places files at an agreed path on SFTP.
2. AI layer polls on a schedule (e.g., every 15 minutes).
3. When a new file is found, it's processed and the relevant journey instance is updated.
```

**Journey step design for file-based systems:** The step must be `async` type. It submits the file and enters a "waiting for response" state. A separate polling job checks for the response file. When found, it updates the journey step and advances the journey. Timeout must be defined (e.g., 24 hours for batch overnight processing).

**Configuration fields needed:**
- `sftp_host`, `sftp_port`
- `sftp_username`, `sftp_private_key`
- `sftp_inbound_path` (where AI layer drops files)
- `sftp_outbound_path` (where external system places response files)
- `file_format` (CSV, XML, fixed-width, JSON)
- `file_naming_convention` (e.g., `employees_YYYYMMDD_HHmmss.csv`)
- `polling_interval_minutes`
- `response_timeout_hours`

---

## 8. Connector Configuration — Per Vendor

### 8.1 SAP S/4HANA (OData)

**What you need from the client's SAP admin:**
- SAP system hostname and HTTPS port
- SAP client number (3-digit, e.g., 100)
- SAP system ID (3-letter, e.g., PRD)
- The name of the OData service to activate (find it at api.sap.com under S/4HANA Cloud)
- OAuth 2.0 credentials (if using SAP BTP as auth server) OR a Communication User (if using Basic Auth as a fallback for on-premise)

**Activation step required on SAP side:**
OData services must be explicitly activated in SAP before they can be called. The client's SAP admin must activate the specific service in transaction `/IWFND/MAINT_SERVICE`. If the service is not activated, the endpoint returns 404 regardless of credentials.

**Endpoint format:**
```
https://{sap_host}:{port}/sap/opu/odata/sap/{service_name}/{entity_set}?$filter=...&$format=json
```

**Critical warning — SAP API Policy:**
SAP's April 2026 API policy prohibits using SAP APIs for AI systems that sequence API calls. Before configuring any SAP integration, confirm with the client's legal/commercial team that their SAP contract permits this use case. Do not proceed without written confirmation.

**Known real-world issue:**
Successful OData calls are not logged on the SAP side. Only failures appear in SAP error logs. If a journey step calls SAP and the call succeeds but returns wrong data, the SAP admin has no server-side trace to help debug. All debugging must be done from the AI layer's integration event log.

---

### 8.2 SAP S/4HANA (RFC/BAPI)

**When to use this instead of OData:**
Only if the client is on SAP ECC (older system) or if the specific operation they need doesn't have an OData service. SAP is moving away from RFC on cloud versions. OData is the correct long-term path.

**What you need:**
- SAP host, system number (2-digit), client number (3-digit)
- SAP service user credentials (not OAuth — RFC uses a direct user login)
- The specific BAPI function name (e.g., `BAPI_EMPLOYEE_GETDATA`)
- SAP JCo library (Java) or SAP NCo library (.NET) or PyRFC (Python) installed in the connector runtime

**Port note:**
RFC connects on port `33{system_number}` (e.g., system number 00 → port 3300). This is not HTTP port 443. Firewalls frequently block this. If the client is on-premise, this is almost certainly blocked and requires explicit firewall rule from their IT team.

**Error handling specific to BAPI:**
BAPI calls return HTTP 200 (because the RFC call itself succeeded) even when the business operation failed. The actual success/failure is in the `RETURN` table in the response. The connector must parse the `RETURN` table and check for message type `E` (error) or `W` (warning) rows, not rely on HTTP status code.

---

### 8.3 Infor CloudSuite (ION API Gateway)

**What you need from the client's Infor admin:**
- Their Infor OS tenant URL (e.g., `https://mfg-dhi.inforcloudsuite.com`)
- An "Authorized App" created in Infor OS → ION API → Authorized Apps
  - App type: Backend Service
  - Grant type: Client Credentials
  - This generates a Client ID and Client Secret
- The ION API Gateway base URL (format: `https://{tenant}.inforcloudsuite.com/INFOR/api`)
- The specific API endpoint paths for the modules in scope

**Token URL format:**
```
https://{tenant}.inforcloudsuite.com/as/token.oauth2
```

**Token TTL:** 2 hours by default. Must implement proactive refresh.

**Scope:** Specific to the Infor modules being accessed. The client's Infor admin configures which scopes the Authorized App has. Common scopes: `"HR"`, `"Payroll"`, `"Finance"`. Scope mismatch is the most common auth failure.

**Developer resources:**
- developer.infor.com → Tutorials → Integration with ION
- GitHub: github.com/infor-cloud/ion-api-sdk (official SDKs)
- community.infor.com (real troubleshooting from practitioners)

---

### 8.4 Infor On-Premise

**Architecture difference:** You cannot call on-premise Infor directly. The client must have Infor's Enterprise Connector deployed in their network.

**How it works:**
1. Client's IT team installs the Enterprise Connector (a service that runs inside their network)
2. Enterprise Connector makes outbound HTTPS connections to Infor's cloud relay on port 443
3. Your API calls go to Infor's cloud relay → relay passes to Enterprise Connector → Enterprise Connector calls the on-premise system
4. Response flows back the same path

**What this means for you:**
- If the Enterprise Connector is not installed, integration is impossible without a custom VPN/tunnel.
- You have no visibility into the Enterprise Connector's health. If it goes down, your calls fail.
- Latency is higher (800ms - 2s per call is normal vs 200ms for cloud).
- The client's IT team must be involved. This is not a purely business-side request.

**First question to ask:** "Does your IT team have Infor's Enterprise Connector installed and running?" If the answer is "what's that?" — add this as a blocker and loop in their Infor technical contact or Infor's implementation partner.

---

### 8.5 Workday (SOAP / REST)

**What you need from the client's Workday admin:**

1. **Create an Integration System User (ISU):**
   - Workday Admin goes to: Create Integration System User (task)
   - Creates a dedicated user (not a person — it's a system account)
   - Sets username and password (or OAuth credentials)
   - Does NOT expire the ISU password (set "Password Never Expires" for machine accounts)

2. **Create an Integration System Security Group (ISSG):**
   - Workday Admin goes to: Create Security Group → Integration System Security Group
   - Adds the ISU to this group

3. **Grant domain security policies to the ISSG:**
   - For every Workday domain the integration needs access to, the admin must edit the domain security policy and add the ISSG to the "Integration and Staffing actions" permission.
   - Common domains: `Worker Data: Public Worker Reports`, `Worker Data: Business Title`, `Worker Data: Employment Information`, `Worker Data: Compensation`, `Payroll Data`
   - Missing even one domain results in that data returning empty with no error.

4. **Activate the security policy changes:**
   - After adding ISSG to domains, admin must run: Activate Pending Security Policy Changes

**Endpoint format (SOAP):**
```
https://{tenant}.workday.com/ccx/service/{tenant}/{module}/v{version}
e.g., https://impl.workday.com/ccx/service/acme/Human_Resources/v42.0
```

**The version number in the URL matters.** Workday deprecates older versions. Using a deprecated version works until Workday removes it. Pin to the latest version and test after each Workday biannual release (R1 spring, R2 fall).

**Workday response format (SOAP):**
Deep nested XML. A `Get_Workers` response has the actual worker data many levels deep. Build your response parsing defensively — assume any node can be absent.

---

### 8.6 Oracle Fusion Cloud

**Integration path:** Oracle Integration Cloud (OIC) is Oracle's recommended middleware, analogous to SAP BTP and Infor ION. Direct REST API calls to Oracle Fusion are possible but Oracle recommends OIC for production integrations.

**Auth:** OAuth 2.0 Client Credentials via Oracle IDCS (Identity Cloud Service) or Oracle Identity Domains (the newer version). The client's Oracle admin creates an application in IDCS, grants it API scopes, and generates credentials.

**Known issue:** Oracle Fusion's REST API rate limits are lower than SAP or Workday. High-volume operations (e.g., syncing thousands of employees) will hit limits quickly. Check rate limits from client's Oracle admin before designing the sync approach.

---

### 8.7 Generic REST / Custom System

For any system not covered above:

**Minimum information required before configuration:**
1. API documentation URL or document (not just "we have an API")
2. Base URL of the API
3. Auth method (ask them to describe it exactly, don't assume)
4. Sample request and response for the specific endpoints you'll call
5. Rate limit information
6. Error response format (what does a failure look like — HTTP status + body format)
7. Sandbox/test environment access

**Rule:** Do not design the field mapping from documentation alone. Make a real test call and map from the actual response. Documentation is frequently wrong or outdated.

**Vendor support contact:** For custom or less common systems, having the client's vendor's integration support contact (name, email, support portal) saves hours when you hit a vendor-specific quirk.

---

## 9. Journey Step Routing — How It Works

### Routing Decision at Runtime

When a journey instance reaches a step, the orchestrator checks:

```
1. Is there a JourneyStepRouting record for this step in this entity's tenant?
   YES → use the configured connector and endpoint
   NO  → use the AI layer's default behavior for this step (no external call)

2. Is the connector in ACTIVE status?
   YES → proceed
   NO  → apply the fallback action defined in JourneyStepRouting

3. Execute the API call with field mapping applied to input data.

4. On success: apply response mapping to extract output fields.
   Store output in the StepEvent output_data_ref.
   Advance journey to next step.

5. On failure:
   → If retryable error (5xx, timeout, 429): apply retry strategy.
   → If non-retryable error (4xx except 429): log and apply fallback.
   → After all retries exhausted: apply fallback action.
```

### Fallback Actions

| Fallback | What It Means | When to Use |
|---|---|---|
| `pause_journey` | Journey stops at this step. Appears as "Waiting - System Unavailable" to the operator. Ops team is notified. Journey can be resumed when the system is back. | For critical steps where the operation cannot proceed without the external system. |
| `use_cached_data` | Use the last successful response from this connector for this step type. | Only for read-only steps where slightly stale data is acceptable (e.g., fetching country compliance rules). |
| `fail_step` | Mark the step as failed. Journey moves to Exception state. Human review required. | For write operations where we cannot proceed without confirmation the write happened. |
| `skip_step` | Step is skipped entirely. Journey advances. The step is marked "Skipped - External System Unavailable". | For truly optional enrichment steps where the journey is valid without the external data. |

---

## 10. Error Handling & Retry Strategy

### Error Classification

| HTTP Status | Category | Retry? | Action |
|---|---|---|---|
| 200, 201, 204 | Success | No | Proceed |
| 400 | Client error (bad request) | No | Log with request details. Fail step. Human review. |
| 401 | Auth failure | Once (refresh token, retry) | If still 401 after refresh: suspend connector, alert ops. |
| 403 | Permission denied | No | Log. Fail step. Alert Super Admin — likely a scope/permission issue. |
| 404 | Not found | No | Log. Could be config issue (wrong endpoint) or missing data. |
| 422 | Validation error | No | Log with vendor's error body. Fail step. Human review. |
| 429 | Rate limited | Yes, after delay | Read `Retry-After` header. If not present, wait 60 seconds. Retry up to 3 times. |
| 500, 502, 503, 504 | Server error | Yes, with backoff | Exponential backoff: 5s, 15s, 45s. Max 3 retries. If all fail, apply fallback. |
| Timeout | Connection timeout | Yes, with backoff | Same as 5xx. |
| Connection refused | System unreachable | Yes, with backoff | Same as 5xx. Alert ops if 3 retries fail. |

### Retry Backoff Calculation

```
attempt 1: wait 5 seconds
attempt 2: wait 15 seconds
attempt 3: wait 45 seconds
After attempt 3 fails: apply fallback action. Log. Alert.
```

### What Gets Logged on Every Call

Regardless of outcome, every external API call produces an `IntegrationEvent` record with:
- Timestamp, connector ID, journey instance ID, step ID
- HTTP method, endpoint called
- HTTP status received
- Outcome (success / failure / retry / fallback)
- Response time in ms
- Error code and sanitised error message (if applicable)
- Retry attempt number (if applicable)

Raw request body and response body are stored separately in encrypted blob storage, referenced by a pointer. They are **not** stored inline in the event log. Accessing raw payloads requires separate permission and is itself logged (for audit of who accessed what data).

---

## 11. Monitoring & Alerting

### Metrics to Track Per Connector

| Metric | Description | Alert Threshold |
|---|---|---|
| Error rate % | Failed calls / total calls in last 1 hour | > 5% sustained for 15 minutes |
| P95 response time | 95th percentile response time over last 1 hour | > connector's `alert_response_time_ms` config |
| Consecutive failures | Count of consecutive failures on same step | > 3 consecutive |
| No calls when expected | Connector has active step routings but 0 calls in last X hours | Configurable per connector |
| Auth failure | Any 401 that is not resolved by token refresh | Immediately |
| Rate limit hit | Any 429 response | Immediately (indicates volume risk) |
| Credential expiry | Days until credential expires | 30 days, 14 days, 7 days, 1 day |

### Alert Recipients

| Alert Type | Who Gets Notified |
|---|---|
| Auth failure | Super Admin (immediate) + Entity Admin (summary) |
| Error rate > threshold | Super Admin (immediate) |
| Connector suspended | Super Admin (immediate) + Entity Admin (immediate) |
| Credential expiry warning | Entity Admin (primarily) + Super Admin (copy) |
| Test failure | Super Admin only |

### Dashboard (Super Admin view)

- All active connectors across all entities, with status and health indicators
- Error rate trend per connector (last 24h, 7d, 30d)
- Top 10 slowest connectors by P95 response time
- Credentials expiring in next 30 days (sorted by urgency)
- Connectors currently suspended and reason
- Recent test failures

### Dashboard (Entity Admin view)

- Their entity's connected systems: status, last call timestamp, call success rate (last 24h)
- Credentials expiring (their systems only)
- Recent failures affecting their journeys
- Integration health indicator per journey

---

## 12. Credential Rotation Process

### Rotation Trigger

Rotation happens when:
- Credential expiry is within 14 days (planned rotation)
- A credential is compromised or suspected compromised (emergency rotation)
- A service account person leaves the client organisation (immediate rotation)

### Planned Rotation Steps

```
Day -14: Alert sent to Entity Admin (email + in-app):
         "Your credentials for [System Name] expire on [date].
          Please rotate them before [date - 3 days] to avoid service interruption."

Day -7:  Second alert. Cc's Super Admin.

Day -3:  Third alert. Super Admin manually contacts Entity Admin's technical contact.

Day -1:  If no action: connector moved to SUSPENDED status proactively.
         Entity Admin notified: "Integration suspended to prevent auth failure.
         Please provide new credentials to reactivate."

Rotation (when client acts):
  1. Client's system admin generates new credentials in their system.
  2. Client shares new credentials via secure channel.
  3. Super Admin creates a new ConnectorCredential record in the secrets manager
     with the new values.
  4. Super Admin updates the SystemConnector to reference the new credential_id.
  5. Super Admin runs connectivity test (Test 1: Authentication + Test 2: Basic Read).
  6. If tests pass: old credential_id is retired (marked as rotated, not deleted).
     The old credential is NOT revoked in the external system until the test passes.
  7. Only after confirmation: Super Admin asks client's admin to revoke the old credential
     in their system.
  8. Connector status updated to ACTIVE (if it was suspended).
  9. New credential_expiry_at set in the connector record.
```

### Emergency Rotation (Suspected Compromise)

```
1. Super Admin immediately suspends the connector.
2. Client's system admin revokes the compromised credential immediately in their system.
3. Client's admin generates new credential.
4. Follow steps 2-9 of planned rotation, compressed to as fast as possible.
5. Post-incident: investigate how the credential may have been exposed.
   Common causes: sent via email, committed to a code repo, shared in a Slack message.
```

---

## 13. UI Specifications

### 13.1 Entity Admin — UI Screens

#### Screen: Configure → Systems (main page)

```
┌─────────────────────────────────────────────────────────────┐
│ Configure > Systems                                          │
├──────────────────────────────┬──────────────────────────────┤
│ Connected Systems (2)        │ [+ Add New System]           │
├──────────────────────────────┴──────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐                          │
│ │ SAP S/4HANA  │  │ Infor HCM    │                          │
│ │ ● Active     │  │ ● Active     │                          │
│ │ Finance      │  │ HR · Payroll │                          │
│ │ Last sync    │  │ Last sync    │                          │
│ │ 2 mins ago   │  │ 5 mins ago   │                          │
│ │ [Details]    │  │ [Details]    │                          │
│ └──────────────┘  └──────────────┘                          │
├─────────────────────────────────────────────────────────────┤
│ Available Systems                                            │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│ │ Workday      │  │ Oracle Fusion│  │ Custom System │       │
│ │ HCM / Payroll│  │ ERP Cloud    │  │ + Request     │       │
│ │ [Add]        │  │ [Add]        │  │   Integration │       │
│ └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│ My Integration Requests                                      │
│                                                              │
│ INT-20260708-001 │ Workday HCM │ ● Under Review │ 2d ago   │
│ INT-20260615-003 │ Custom ERP  │ ✓ Active        │ 23d ago  │
└─────────────────────────────────────────────────────────────┘
```

#### Screen: Intake Form

- Section tabs at top: A: System Identity | B: Module Scope | C: Technical | D: Contacts | E: Confirm
- Each section has a completion indicator (filled circle when all mandatory fields are done)
- "Save Draft" button always visible — form auto-saves every 30 seconds
- Mandatory fields marked with `*`
- Contextual help text under complex fields (e.g., "Product variant: Infor has multiple products (M3, LN, CloudSuite) that are not interchangeable. Check your vendor contract to confirm which product your company uses.")
- Summary screen before final submit shows all answers in read-only view

#### Screen: Request Detail (for Entity Admin)

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back   Integration Request — INT-20260708-001              │
├──────────────┬──────────────────────────────────────────────┤
│ Workday HCM  │ Status: ● Under Review                       │
│ Submitted    │ Assigned to: Priya M. (OpenDhi)              │
│ July 8, 2026 │ Last updated: 2 hours ago                    │
├──────────────┴──────────────────────────────────────────────┤
│ Timeline                                                     │
│                                                              │
│ ● SUBMITTED — Jul 8, 09:15                                   │
│   "Your request has been received."                          │
│                                                              │
│ ● UNDER REVIEW — Jul 8, 11:30                               │
│   "Assigned to Priya M. Scoping call scheduled."            │
│                                                              │
│ ○ Next: Scoping call — Jul 10, 15:00 IST                    │
├─────────────────────────────────────────────────────────────┤
│ [View Full Request Details]   [Withdraw Request]             │
└─────────────────────────────────────────────────────────────┘
```

---

### 13.2 Super Admin — UI Screens

#### Screen: Platform Console → Integrations → Requests Queue

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Integration Requests                                                     │
├────────┬────────────────┬───────────┬──────────────┬────────┬───────────┤
│ Ref ID │ Entity         │ System    │ Status       │ Age    │ Action    │
├────────┼────────────────┼───────────┼──────────────┼────────┼───────────┤
│ INT-001│ Dhi Hyperlocal │ Workday   │ ● Submitted  │ 4h     │ [Pick up] │
│ INT-002│ Acme Corp      │ Oracle    │ ● Configuring│ 3d     │ [Open]    │
│ INT-003│ GlobalEmp Ltd  │ SAP BTP   │ ◐ Blocked    │ 6d ⚠️  │ [Open]    │
│ INT-004│ Nexus HR       │ Custom    │ ✓ Testing    │ 8d     │ [Open]    │
└────────┴────────────────┴───────────┴──────────────┴────────┴───────────┘
```

#### Screen: Connector Configuration (Super Admin)

Tabbed interface:
1. **System Info** — vendor, product, version, hosting, URLs
2. **Authentication** — auth method selector, fields specific to selected method (reveals relevant fields dynamically based on selection)
3. **Step Routing** — per-journey step assignment, field mapping editor
4. **Test Console** — run individual tests, see request/response, mark tests as passed
5. **Monitoring Config** — thresholds for alerts
6. **Audit Log** — every change to this connector config with timestamp and actor

---

## 14. Business Rules

| Rule ID | Rule | Enforcement Point |
|---|---|---|
| BR-001 | A connector can only be `ACTIVE` if it has at least one passing connectivity test on record | System — cannot move to ACTIVE without test pass record |
| BR-002 | Super Admin cannot approve without Entity Admin UAT sign-off | System — approve button disabled until UAT confirmed |
| BR-003 | Credentials must never be stored in plain text in any system log, database column, or API response | Engineering — enforced at secrets manager layer |
| BR-004 | Each data domain (employee, contract, etc.) must have exactly one master system per entity | Validation on module scope section — "Shared" ownership triggers a warning and required justification |
| BR-005 | Rejection requires a mandatory reason of at least 50 characters | Form validation on rejection action |
| BR-006 | A connector cannot be moved from SUSPENDED to ACTIVE without a new connectivity test | System — test required to reactivate |
| BR-007 | The first live run of any newly activated connector must be manually supervised | Process rule — documented in SOP, not technically enforced in MVP |
| BR-008 | Credential rotation must complete the "new credential verified before old revoked" sequence | Process rule — documented in rotation SOP |
| BR-009 | An entity cannot have two ACTIVE connectors for the same vendor and same module scope | Validation during connector creation — warns if overlap detected |
| BR-010 | Request cannot be submitted without the declaration checkboxes confirmed | Form validation |

---

## 15. Acceptance Criteria

#### Entity Admin — Intake

- **Given** an Entity Admin navigates to Configure → Systems, **when** they click "Add New System", **then** the intake form opens with all sections and a "Save Draft" option.
- **Given** a mandatory field is left blank, **when** Entity Admin attempts to submit, **then** the form shows field-level validation errors and does not submit.
- **Given** Entity Admin completes all mandatory fields and confirms all declarations, **when** they submit, **then** status becomes `SUBMITTED` and a confirmation with Reference ID is shown.
- **Given** a request is in `NEEDS_MORE_INFO`, **when** Entity Admin responds to the query, **then** status automatically returns to `UNDER_REVIEW` and Super Admin is notified.

#### Super Admin — Processing

- **Given** a new request is submitted, **when** Super Admin opens the queue, **then** the request is visible and assignable.
- **Given** a request has incomplete information, **when** Super Admin moves it to `NEEDS_MORE_INFO`, **then** a mandatory reason field must be filled and Entity Admin is notified.
- **Given** a connector is configured and all 9 tests pass and UAT is signed off, **when** Super Admin approves, **then** the connector status becomes `ACTIVE` in the entity's tenant and affected journey steps route to the connector.

#### Runtime

- **Given** an `ACTIVE` connector is configured for journey step X, **when** a journey instance reaches step X, **then** the AI layer calls the external system using the configured connector instead of the default behavior.
- **Given** an external system returns 401, **when** the connector receives it, **then** it automatically refreshes the token and retries the call exactly once before escalating.
- **Given** an external system is unreachable after 3 retries, **when** the connector exhausts retries, **then** it applies the configured fallback action and logs an `IntegrationEvent` with outcome `fallback_triggered`.
- **Given** a credential is within 14 days of expiry, **when** the scheduled check runs, **then** an alert is sent to the Entity Admin and Super Admin.

---

## 16. Edge Cases

| Edge Case | Expected Behavior |
|---|---|
| Entity submits a request for a system already being integrated by another entity | No conflict — connectors are per-entity. Each entity has their own connector instance with their own credentials. |
| Entity submits a request for a system they already have connected | System shows a warning: "You already have [System Name] connected. Do you want to modify the existing integration or add a second connection?" They must choose explicitly. |
| External system is in maintenance and returns 503 for several hours | Retry strategy exhausts. Affected journey runs pause. Monitoring alert fires. Ops team checks vendor status page. No automated recovery needed — journeys resume when system is back and operator resumes them. |
| Entity Admin who submitted the request leaves the company | Super Admin is notified. Request is not automatically cancelled. A new Entity Admin must be designated. Credentials shared by the departing person must be rotated immediately (security risk). |
| Entity changes their system version mid-configuration | Super Admin must restart configuration from Phase 2. API endpoints, field names, and auth mechanisms can all change between major versions. |
| Two journey steps in the same journey route to different external systems, and the first succeeds but the second fails | The first step's write to the external system has already happened. Rollback depends on whether the external system supports delete/undo via API. This must be defined in the fallback config before go-live. There is no automatic cross-system rollback in MVP. |
| Client's rate limit is very low (< 10 requests/minute) and entity has high journey run volume | Super Admin must discuss with client before go-live. Options: increase rate limit with vendor (client must negotiate), batch requests, or accept that high-volume scenarios require queuing and longer journey step times. |
| External system requires IP allowlisting and our egress IPs change | Connector will immediately fail. Engineering must notify Super Admin and Entity Admin of egress IP changes in advance (minimum 7 days notice). Entity's IT team must update allowlist. |
| Entity requests deactivation of a connector while a journey run is in progress | System waits for the in-progress run to complete or reach a pause point before deactivating. Does not kill a live run mid-step. |

---

## 17. Open Questions

| # | Question | Owner | Priority |
|---|---|---|---|
| 1 | Which secrets manager is the production target for ConnectorCredential? (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault) | Engineering | High |
| 2 | What is the agreed egress IP range for the AI layer's production environment? This is needed for clients who need to IP-allowlist our calls. | Engineering / DevOps | High |
| 3 | For file-based (SFTP) integrations: who hosts the SFTP server — OpenDhi or the client? If OpenDhi, what's the infrastructure plan? | Engineering / Ops | Medium |
| 4 | What is the SLA for Super Admin responding to a new integration request? "2 business days" is mentioned above — needs to be formally agreed and reflected in entity contracts. | Product / Commercial | High |
| 5 | For the SAP API policy restriction — is there a legal sign-off template or checklist that the entity's legal team must complete? Or do we just accept their confirmation checkbox as sufficient? | Legal / Product | High |
| 6 | Cross-system sync (e.g., employee created in Infor must also appear in SAP): is this in scope for this feature at all, or is it explicitly out of scope and handled by the entity's own middleware? | Product | Medium |
| 7 | What is the raw payload retention period for IntegrationEvent request/response blobs? (Affects storage cost and privacy compliance) | Engineering / Legal | Medium |
| 8 | For Workday integrations: do we need to track and proactively test after each biannual Workday release (R1/R2) to catch deprecations before they break production? If yes, who owns this? | Product / Ops | Medium |
| 9 | Is there a maximum number of external system connectors per entity? (Affects UI design for the Connected Systems view) | Product | Low |
| 10 | Should the Entity Admin be able to self-serve deactivate a connector, or should deactivation require Super Admin confirmation? (Risk: Entity Admin accidentally deactivates live journeys) | Product | Medium |

---

*Document maintained by: ADT Product / OpenDhi Engineering*
*Review this document after every third integration completed, or every 6 months, whichever comes first.*
*Next scheduled review: January 2027*
