# Project Context — ADT Executive Layer Mockup

This file is meant to be dropped into a Claude Desktop **Project** as persistent context. It describes what this codebase is, why it exists, how it's built, and the conventions to follow when extending it. It reflects the state of the code as of **2026-07-08**.

---

## 1. What this project is

This is a **static, front-end-only mockup** of an HR/payroll/global-employment SaaS product (referred to internally as **ADT** / **Dhi Hyperlocal**, branded **Opendhi**). It's a click-through prototype used to demo product direction — there is **no backend, no database, no auth, no API calls**. Every "action" (approving a contract, running payroll, creating an employee) is simulated with in-memory JS state, `setTimeout`-based fake loaders, and hand-authored mock data arrays.

The flagship idea the mockup exists to sell is **AI Executive** — a layer where predefined business processes ("journeys" like *Contract Creation*, *Payroll Creation*, *Hire-to-Retire*) run mostly on AI agents, pausing only at defined human-approval checkpoints, with every step auditable. The rest of the app (Employees, Teams, Payroll, Leaves, Payments, Compliance Hub, Support, Configure) is the surrounding conventional SaaS product that AI Executive automates on top of.

**There is a companion design document** the user has (`journey-execution-model_v1.md`, not part of this repo) that describes the *intended production architecture* behind what this mockup visualizes: journeys as finite-state-machine/durable-workflow orchestration, per-step audit via event sourcing, agents governed by a versioned `skill.md` contract (shaped like an MCP tool schema), and three guardrail levels (`fully_automated`, `approves_next_step`, `approves_on_deviation`). The mockup's "Handled by Agent" badges, the Contract/Payroll/H2R journey timelines, and the Configure → Agents skill.md viewer are the **UI expression of that model** — treat that doc as the "why" when the mockup's UI seems to gesture at more than plain CRUD.

## 2. Tech stack & file structure

No build step, no framework, no package.json for the app itself. Open `index.html` directly in a browser (or serve statically) and it runs.

```
index.html          — page skeleton: 3 top-level "views" (v-adt, v-agent-empty, v-agent-active), all modals/overlays
js/core.js           (~1700 lines) — state, data models, sidebar, routing, RBAC guard, Agent Mode chat engine
js/pages.js          (~6800 lines) — every buildXxxHTML() page-body function, almost all interaction handlers
js/renderer.js        (~320 lines) — the page dispatch table + a few standalone widgets (cost calculator, search, clock)
css/main.css          (~1300+ lines) — design tokens + most component classes
css/leaves.css                     — split-drawer pattern, action-menu dropdown pattern (reused everywhere)
css/cost-calc.css / css/fonts.css  — narrowly scoped
assets/Opendhilogo.png
```

Everything is vanilla JS, string-concatenated HTML (`'<div>'+x+'</div>'`), assigned to `.innerHTML`. No JSX, no templates, no virtual DOM. `renderADTPage()` is the one "full re-render" entry point; most interactions instead surgically patch a specific `#id` element for snappier feel (see §5).

Other files in the repo root are **planning/change docs, not app code** — useful for archaeology:
- `RBAC Plan.md` — the plan that introduced the 3-portal role system (see §4).
- `groovy-watching-iverson.md` — the plan that introduced the whole AI Executive module (see §6).
- `CHANGE.md` — a dated changelog entry for a Contract Creation Journey UX pass.

## 3. Core architecture patterns

### 3.1 The view/mode/page state machine
Three globals in `core.js` drive everything:
- `view` — `'adt'` | `'agent-empty'` | `'agent-active'`. Maps to the three top-level `<div class="view">` blocks in `index.html`. `'agent-*'` is a separate full-screen "Agent Mode" chat console (WebGL background, agent picker, live form-building chat) — a distinct, older experiment layered under the same sidebar/page data.
- `mode` — `'agent'` marker used by `buildTopbar()` to pick which topbar markup to render.
- `page` — a string id (e.g. `'dashboard'`, `'contracts'`, `'ai-executive'`, `'ai-run-detail'`) that every dispatch table branches on.

### 3.2 Single routing choke point
```js
function navigatePage(pg){
  const resolved = canAccessPage(pg, portalRole) ? pg : defaultPageForRole(portalRole);
  page = resolved;
  if(view==='adt'){ renderADTPage(); return; }
  if(view==='agent-active'){ showAgentModule(resolved); return; }
}
```
**Always route through `navigatePage(pg)`**, never set `page=` directly and rebuild by hand, except inside a small number of established flows that intentionally set `page` then call `renderADTPage()` themselves right after (e.g. journey-run steps chaining forward). If you add a new page id, it flows through here for free — the RBAC guard is enforced at this one point (plus mirrored in `showAgentModule` for Agent Mode).

### 3.3 Content dispatch
`js/renderer.js` → `renderPageContent(id)` is an if/else chain on `page` that calls the matching `buildXxxHTML()` function from `pages.js` and assigns the result to `#adt-content`. `renderADTPage()` (in `renderer.js`) is the top-level refresh: rebuilds page title, the "+" add button, the sidebar, then calls `renderPageContent`.

A large sub-family of pages (`ai-contract-assistant`, `ai-proposal-*`, `ai-contract-document`, `ai-onboarding-run`, `contract-eor`, `contract-peo`, etc.) is routed through a nested dispatcher, `dispatchAIContractWizardPage()`, wrapped in a persistent animated journey progress bar (`buildAIJourneyBarHTML('contract-creation', …)`, the same rail every journey uses) — see §6.3.

### 3.4 Sidebar generation
`sidebarItems` (core.js) is a flat/nested array of `{id, label, icon, color, roles:[...]}` or `{dropdown, children:[...], roles:[...]}`. `getSidebarItems()` filters the whole tree by `portalRole` (dropping empty dropdowns). `buildSidebar(id, collapsed, activePg)` renders it to a DOM element imperatively (not re-diffed — cleared and rebuilt each time). Two sidebars exist (`#adt-sidebar`, `#agent-sb`) sharing this same data and builder.

### 3.5 Listing-page pattern (generic CRUD tables)
Many simple modules (Dashboard's legacy table view, generic fallback pages) go through one shared generator: `getPageMeta(pg)` returns `{title, context, filters[], columns[], rows[]}` from a static `supportPageMeta` map, and `buildListingHTML(pg)` turns that into a full filterable/paginated table using `.listing-page/.listing-top/.listing-stats/.listing-card/.lp-table`. This is the *oldest, simplest* pattern — later modules (Contracts, Employees, Teams, Payments, Tickets, Chats, Leave Policies) each grew their **own bespoke builder** with a real per-record data array and a slide-in detail drawer instead, because they needed richer per-record state (see §3.6). Don't route a new "real" module through `buildListingHTML` — it's a placeholder-grade pattern now.

### 3.6 Slide-in detail drawer pattern
The dominant pattern for "click a row → see/edit full detail" across Contracts, Teams, Employees (Direct/Global), Payments, Leave Policies, Tickets, Chats, Company Settings: a two-pane layout, `.lp-split-wrap > .lp-split-main + .lp-split-sb` where the drawer's width animates `0 → 68%` via a `.open` class toggle. Inside the drawer: `.lp-isb-tabbar/.lp-isb-tabs` (tab strip) + `.lp-isb-body` (tab content). Each module has its own `openXxSidebar(id)/closeXxSidebar()/renderXxSidebar()` triple and its own `xxSelectedId`/`xxTab` state vars (module prefixes below).

### 3.7 Row action dropdown menu
A second reusable pattern, distinct from the drawer: `.ct-action-wrap > .ct-action-btn (or .lp-action-btn icon-only) + .ct-action-menu` — a `position:fixed` dropdown positioned via `getBoundingClientRect()` in JS (flips above the trigger if there's no room below), populated with `.ct-act-item` rows. A single global `document` click-listener in `core.js` (`if(!e.target.closest('.ct-action-wrap')) …remove('open')`) closes any open menu automatically — new menus of this shape get that behavior for free, no extra wiring needed. Each module that uses it has its own `toggleXxAction(id, event)` copy (by convention, not shared code — see `togglePmAction`, `toggleCtAction`, `toggleMtAction`).

### 3.8 Fake async / loaders
Nothing is really async. The standard idiom is: render a spinner/skeleton state → `setTimeout(fn, 1500–2500ms)` → mutate state → re-render. Reusable pieces: `.cl-spinner`/`.contract-loader` (orange brand spinner), `aiShowLoader(title, sub)` (full-panel loader used throughout AI Executive), `showAiToast(title, sub)` (bottom-right auto-dismissing toast fired at background-style events — proposal sent, approved, etc.).

### 3.9 Custom dropdown/select widgets
Native `<select>` is avoided for anything visually styled — two parallel custom-select implementations exist: `customSelect()`/`toggleCustomSelect()` (core.js, used in the manual contract wizard) and `apCS()`/`csToggle()`/`csSelect()` (core.js, used almost everywhere else — filters, forms). Both close on outside click via the same global listener as §3.7. New filter/select UI should use `apCS()`.

## 4. Three-portal RBAC model

The product is deliberately split into **three decision scopes**, not one app with a permission toggle (see `RBAC Plan.md` for the full rationale and build history):

| `portalRole` value | Who | Lands on | Sees |
|---|---|---|---|
| `'super-admin'` | Platform admin | Dashboard | Everything — full Configure (Overview, Systems, Data Foundation, Context & Journey, Agents incl. skill.md editing), All Users, Company Settings, every journey unlocked |
| `'entity-admin'` | Tenant admin | Dashboard (entity-scoped stat cards + "Your Requests" panel) | Configure minus Overview (Data Foundation is visible — browse + edit, but no **+ New Model** and no **Remove model**); self-serve **Activate** on default systems/journeys; **Request** anything not yet unlocked (feeds a Super-Admin approval queue) |
| `'entity-user'` | Day-to-day operator | **AI Executive** directly | No Configure at all; only unlocked journeys (locked ones show a lock badge, non-interactive); every operational module (Employee, Teams, Payroll, Leaves, Payments, Compliance Hub read-only, Support) |

Mechanics:
- Switching role is a **header dev-dropdown** (`showSwitchUserMenu()` → `setPortalRole(role)`), not a real login — this is a mockup convenience, not a target-state pattern.
- `sidebarItems` entries carry a `roles:[...]` array; `getSidebarItems()` filters by it.
- `pageRoleMap` (core.js) is a **deny-by-exception allowlist** — most page ids are unrestricted; only `cfg-*`, `all-users`, `settings` are gated. `canAccessPage(pg, role)` checks it; `navigatePage()` is the single enforcement point (mirrored in `showAgentModule` for Agent Mode).
- `entityJourneyActivation{}` (keyed by journey id) and `entityRequests[]` (`{id, type: 'system-activation'|'journey-activation'|'journey-custom', refId, label, requestedBy, entity, timestamp, status: 'Pending'|'Approved'|'Rejected', note}`) back the request/approval flow. `createEntityRequest()` / `approveEntityRequest()` / `rejectEntityRequest()` drive it.
- Activation/requests are **session-wide globals, not per-tenant** — a deliberate mockup simplification (there's only ever one demo tenant, "Dhi Hyperlocal").
- An approved custom journey becomes **globally available** in the catalog, not entity-locked (another deliberate simplification).

## 5. AI Executive — the flagship module

Sidebar entry `ai-executive` (top-level, not a dropdown). Entry point `buildAIExecutiveDashboardHTML()`.

### 5.1 Core vocabulary
- **Journey** — an ordered chain of steps, each with a `chips[]` describing its actor/type (`AI Automated`, `Human Required`, `Approval Required`, `System Action`, etc.), a `source` (which agent or human role owns it), `desc`, `validation`, `human` (intervention rule), `failure` (what happens on error), and `next`. Defined per-journey in `aiJourneyEvents{journeyId: [...]}` (core.js).
- **The 3 built journeys** (`aiJourneys[]`, core.js), all `status:'Active'`:
  1. `contract-creation` — *Contract Creation Journey* (category O2C). 7 steps: Deal Created (Employee Created) → Proposal Sent → Proposal Approved (human) → Contract Sent → Contract Approved (human) → Onboarding → Ready for Payroll. **The most fully built-out journey** — has a real multi-page interactive run (§5.4).
  2. `payroll-creation` — *Payroll Creation Journey* (category H2R). 6 steps: Prompt Given → Attendance Capture → Salary Calculation → Approval (human) → Salary Slip Template → Salary Slip Created.
  3. `h2r-lifecycle` — *Hire to Retire (H2R) Journey* (category H2R). 5 steps: Employee Creation → Fetch Country Details (Compliance Hub) → Show Leave Policies → Ask for Approval if Required (human, only on deviation) → Offboarding.
- **Agents** are named, reusable actors (`AI Prompt Parser`, `AI Contract Assistant`, `AI + Docuseal`, `AI Onboarding Engine`, `AI Payroll Engine`, etc.) — the same agent is wired into multiple journeys. Configure → Agents (`buildCfgAgentsHTML`) is the Super-Admin/Entity-Admin catalog of them, each with a viewable/editable `skill.md` contract (role, input fields, validation, failure behavior — see the vision doc in §1).
- **Guardrail** — per-step autonomy: fully automated (auto-advances), human-approves-next-step (pauses, needs explicit approve/reject), or human-approves-on-deviation (auto-advances unless output is out of bounds). In the mockup this shows up as which steps have a manual "Approve" action vs. which just auto-run through a loader.

### 5.2 Dashboard → Journey Detail → Automate Journey → Active Automation → Run Detail
Standard drill-down, all in `pages.js`:
- `buildAIExecutiveDashboardHTML()` — grid of `.ai-journey-card`s per journey (locked ones show `.ai-journey-card-locked` + lock badge for non-super-admin roles without activation).
- `buildAIJourneyDetailHTML()` (`page='ai-journey-detail'`, `selectedAIJourneyId`) — stat cards + full event timeline (`.ai-timeline`) for that journey; clicking an event opens the **event detail drawer** (`openAIEventDrawer`, reuses §3.6's slide-in pattern) showing description/validation/failure/fields.
- `buildAutomateJourneyFormHTML()` (`page='ai-automate-form'`) — the config wizard: trigger, per-event automation-scope toggles, approval rules, connected modules, Save-as-Draft/Activate.
- `buildAIActiveAutomationHTML()` (`page='ai-active-automation'`) — stat header (Total Runs, Success Rate, Exceptions Pending) + table of `aiAutomationRuns[journeyId]` runs.
- `buildAIRunDetailHTML()` (`page='ai-run-detail'`, `selectedAIRunId`) — **the shared run-viewer used by all three journeys** regardless of role or entry point (My Tasks, Active Automation, direct link). Left: step timeline + Backend Activity panel. Right: status-dependent action panel — Completed (success summary), Exception (Resolve/View Event), Waiting for Approval (Review Data / Approve and Continue / Reject), In Progress (no action). Back button reads "Back to `<journey name>`" and returns to that journey's detail page (`viewAIJourney`) — this is shared code, so changing it once changes it for every journey/role.

### 5.3 My Tasks (`page='my-tasks'`)
`buildMyTasksPageHTML()` — cross-journey inbox of every run across all three journeys that is `Waiting for Approval` or `Exception` (`aiAllPendingRuns()`, exceptions sorted first). Table fits one viewport width without horizontal scroll (fixed column widths + text wrap, class `mt-table` layered on `.ai-run-table`). Each row's Action column is a compact 3-line hamburger icon button (`.lp-action-btn`) opening a `.ct-action-menu` dropdown (§3.7, `toggleMtAction`) with three destinations: **View & Act** (→ that run's detail/approval), **View All Runs** (→ that journey's Active Automation list), **View Journey** (→ that journey's detail page).

### 5.4 Contract Creation Journey — the deep-built one
This journey has a real multi-step interactive "run", distinct from the simpler prompt-driven runs of the other two:
1. **AI Contract Assistant** (`ai-contract-assistant`) — chat-style intake that pre-fills a proposal from a natural-language ask.
2. **Employee Created** → **Proposal Created** (`ai-proposal-created`, auto-advances via `aiScheduleAutoAdvance`) → **Waiting for Approval** (`ai-proposal-waiting-approval`, human step — Deal Manager, or the Entity User themself with a "Notify Entity Admin" escape hatch) → on approve, `aiSimulateApproval()`.
3. **Contract Document** (`ai-contract-document`, step "Contract Sent") — generates and displays the full employment agreement (`buildAIContractDocumentHTML`). This step **pauses** (does not auto-advance) and shows **Edit** / **Approve** buttons (`aiContractDocActionBarHTML`). Edit makes the document `contenteditable` in place with a **Save** bar pinned above it (`aiContractDocEdit`/`aiContractDocSave`); Approve (`aiContractDocApprove`) calls `aiSendContractForApproval()`, which sends it for signature and continues the journey.
4. **Contract Waiting Approval** (`ai-contract-waiting-approval`, step "Contract Approved" — Ops Manager) → `aiSimulateContractApproval()` → **Onboarding** (`ai-onboarding-run`, automated checklist) → **Journey Complete** (`ai-journey-complete`).

Every stage of this flow is wrapped by a persistent animated progress bar (`buildAIJourneyBarHTML`) showing "Handled by `<Agent>`" — clickable through to that agent's skill.md viewer without leaving the journey.

### 5.5 Live run flows (Payroll & H2R)
Simpler than Contract Creation: a single prompt box (`aiRunFlows[journeyId]`, core.js) drives a linear sequence of auto/manual steps rendered by `buildAIPayrollJourneyHTML`/`buildAIH2rJourneyHTML`, each with a "Simulate: X" button to fake the prompt. Payroll's "Create Salary Slip" and H2R's HR-approval step are the manual pause points; everything else auto-advances through `aiRunFlowRunCurrentStep()`.

### 5.6 Mock run data
`aiAutomationRuns{journeyId: [...]}` (core.js) seeds 3 runs per journey (one Waiting for Approval, one Exception with a note, one Completed/Active) — this is what populates My Tasks, Active Automation, and Run Detail across all three journeys. `aiUpsertRun(journeyId, runId, patch)` is the one write path into it as live runs progress.

## 6. Configure module (Super Admin / Entity Admin only)

Dropdown `Configure` in the sidebar, children gated per §4:
- **Overview** (`cfg-overview`, super-admin only) — landing summary.
- **Systems** (`cfg-systems`) — connected external systems (`cfgSystems[]`: SAP S/4HANA, Infor ERP, Vendor Portal — each `isDefault:true`, `activatedForEntity:false`). Super Admin gets full CRUD + API list + test; Entity Admin gets a self-serve Activate/Request variant.
- **Data Foundation** (`cfg-data-foundation`, super-admin + entity-admin) — the two canonical data models (`cfgModels[]`: Material, Vendor) with field mapping, enrichment fields, validation rules, sample data. Same split as Systems: both roles browse, open (`cfg-model-detail`) and edit a model; only Super Admin mints one (`cfg-model-add`) or removes one, since a model is platform-level and shared by every entity.
- **Context & Journey** (`cfg-context-journey`) — the *authoring* side of the same journeys AI Executive *runs*. Organized by `cfgJourneyCategories` (O2C, P2P, H2R, F2A — only O2C/H2R have real journeys built; P2P/F2A are `entityLockedCategories`, browsable by Super Admin only). `cfgJourneys[]` mirrors `aiJourneys[]` by id/name/category but is a **separate array, not synced** — a known pre-existing gap noted in `RBAC Plan.md`; don't assume editing one updates the other.
- **Agents** (`cfg-agents`) — the agent catalog + skill.md viewer/editor (Super Admin only sees the edit button; Entity Admin sees the same functional card details read-only).

## 7. Operational modules (standard product surface)

These are the conventional SaaS pages AI Executive automates on top of, all using the slide-in-drawer pattern (§3.6) with their own state/data:

| Module | Page id(s) | State prefix | Data array(s) |
|---|---|---|---|
| Direct Employee | `direct` | `de` | `directEmpData`, `deLogsData`, `deWorkflowData` |
| Global Employee | `global` | `ge` | `globalEmpData`, `geLogsData`, `geWorkflowData` |
| Teams | `teams`, `team-add` | `tm` | `teamsData`, `tmLogsData`, `tmWorkflowData` |
| Contracts | `contracts` (+ the whole AI journey wizard) | `ct` | `contractsData`, `ctLogsData`, `ctWorkflowData`, `ctFlow` (status sequence) |
| Leave Policies | `leave-policies`, `leave-policy-add/edit` | `lp` | `leavePoliciesData`, `lpLogsData`, `lpWorkflowData` |
| All Leaves | `all-leaves`, `leave-add` | `al` | `allLeavesData`, `alLogsData` |
| Payments | `payments` | `pm` | `paymentsData`, `pmWorkflowData`, `pmInvoiceFlow` |
| Support Tickets | `support-tickets` | `tk` | `ticketsData` |
| Chats | `chats` | `chat` | `chatsData` |
| My/All Timesheet | `my-timesheet`, `all-timesheet` | `ts`/`atTs` | `tsAttendance`, `allTsData` |
| Company Settings | `settings` | `cs` | `csLogsData` |
| Switch Entity | `switch-entity` | `se` | `entitiesData` |
| Compliance Hub | `compliance`, `rates-rules`, `contract-templates` | — | goes through the generic `buildListingHTML` (§3.5) via `supportPageMeta` |

Every module follows the same shape: `xxData[]` (records), optional `xxLogsData{}`/`xxWorkflowData{}` (per-record audit trail shown in drawer tabs), `xxSelectedId`/`xxTab` state, `openXxSidebar()`/`closeXxSidebar()`/`renderXxSidebar()`. Copy the nearest existing module rather than inventing a new pattern.

## 8. Design tokens & CSS conventions

`css/main.css:2` — root palette:
```css
--orange:#de7909   /* brand accent, primary CTAs, active states */
--navy:#0f172a     /* primary text / headings */
--gray:#6a7282     /* secondary text */
--green:#22c55e    /* success / active status */
--red:#ef4444      /* error / inactive status */
--card:#fff  --border:#e5e7eb  --light:#f8f9fb  --ol:#fef3e2 (orange-light bg)
```
- Buttons: `.btn.btn-primary` (navy/black), `.btn-secondary` (bordered neutral), `.btn-success` (green), modifier `.btn-sm` for compact.
- Status pills: `.status-pill.active/.pending/.inactive/.approved/.rejected/.draft/.available` (and the older `.lp-status-badge` variant used by the generic listing pattern).
- Actor/type chips (AI Executive-specific): `.ai-chip` + modifiers (`.ai-chip-ai`, `.ai-chip-human`, `.ai-chip-system`, `.ai-chip-approval`, etc.) — 7 distinct visual types layered on the `.status-pill` border/radius/font language.
- Timeline: `.ai-timeline/.ai-timeline-item/.ai-timeline-dot/.ai-timeline-card` — vertical step list used by journey detail and run detail.
- Card/table language reused everywhere: 14px border-radius, 1px `var(--border)`, `var(--card)` background — `.listing-card`, `.ep-form-card`, `.setup-card`, `.ai-timeline-card` all share this.
- Formal document look (contracts, payroll summaries): `.adt-doc-page` + `.adt-doc-header/.adt-doc-section/.adt-doc-clause/.adt-doc-sig-row` — a letterhead-style printable-looking card. `.adt-doc-editing` modifier adds a dashed orange outline when the document is in inline-edit mode (§5.4 step 3).

## 9. Conventions to follow when extending this codebase

- **Route through `navigatePage()`**, not raw `page=` assignment, unless you're mid-chain in an already-established flow.
- **Reuse before inventing.** For any new interactive surface, check: does a drawer pattern (§3.6), action-menu (§3.7), custom-select (§3.9), or loader/toast (§3.8) already do this? The whole codebase is built by copying the nearest sibling pattern, not by introducing new primitives.
- **New page = new `buildXxxHTML()` in `pages.js` + one `if(page==='...')` branch in `renderPageContent()` (`renderer.js`) + a `getPageMeta`/`getSidebarActivePage` entry in `core.js` if it needs a title or sidebar highlight.**
- **State/data naming is per-module-prefixed** (see the table in §7) — follow the existing prefix when touching a module, don't introduce a generic name that collides.
- **RBAC changes**: gate a new page via `pageRoleMap` (deny-by-exception — most pages need no entry), gate sidebar visibility via `roles:[...]` on the `sidebarItems` entry.
- **No comments explaining what code does** — the existing style is dense, uncommented, string-built HTML; match it rather than introducing verbose JSDoc blocks.
- **This is a mockup**: don't add real persistence, real auth, or real API calls unless explicitly asked — the entire value of the codebase is that it's a fast, dependency-free click-through demo.

## 10. Where to look first for common tasks

- **"Add a field/button to journey X's page"** → find the matching `buildAIxxxHTML` in `pages.js` (search the journey's step name or page id).
- **"Change what happens on approve/reject"** → search for the step's name in `aiJourneyEvents`, then find the `aiSimulateXxxApproval()`/`aiXxxRunXxx()` function it calls.
- **"Add a new operational module page"** → copy the nearest sibling in §7's table wholesale (data array shape, drawer functions, CSS classes) rather than building from `buildListingHTML`.
- **"Something about roles/locking"** → `core.js` §"ROLE ACCESS GUARD" block, plus `RBAC Plan.md` for the full reasoning.
- **"Why does the UI show agents/skill.md/guardrails this way"** → the user's separate `journey-execution-model_v1.md` design doc (§1) — the mockup is the front-end sales pitch for that backend model, not the model itself.
