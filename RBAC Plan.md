# 3-Portal Role System: Super Admin / Entity Admin / Entity User

## Context

Today the app (`index.html` + `js/core.js` + `js/pages.js` + `js/renderer.js` + CSS) is a single implicit "Super Admin" portal — everyone sees every sidebar item, every Configure sub-page, and every AI Executive journey unlocked. The user wants to demo a realistic multi-tenant hierarchy on top of the same mock data:

- **Super Admin** (today's experience, unchanged) — full CRUD on Systems, Data Foundation, Context & Journey, Agents (incl. skill.md); approves requests from entities.
- **Entity Admin** — a scoped-down Configure experience (no Data Foundation, no skill.md), self-serve activation of already-connected "default" systems, request-and-wait for anything else (a new system, activating a predefined journey, or an entirely new custom journey). Sees the full AI Executive journey catalog but journeys they haven't had approved are visibly **locked**.
- **Entity User** — the day-to-day operator. Lands straight on AI Executive with a working "Create Contract" action, uses the operational modules (Employees, Teams, Leaves, Payroll, Payments, Compliance Hub read-only, Support), never sees Configure at all, and can't request/administer anything — only use what's already unlocked.

This is a mockup with no backend, so per the user's own decisions: portal switching is a **header dev-dropdown** (not a login), activation state is **one shared session-wide context** (not truly per-entity), and an approved custom journey becomes **globally available** in the catalog (not entity-locked).

The goal is to reuse existing patterns as much as possible — the `openAgent()`/`closeAgent()` view-switch pattern, the `hdr-dd-wrap` header-dropdown markup, the existing `Draft`/`Active` status fields, `showAiToast`, and the disabled/draft CSS precedents — rather than building a parallel auth system.

## Key existing pieces being reused

| Need | Existing pattern | Location |
|---|---|---|
| Full-screen mode switch that rebuilds its own chrome | `openAgent()`/`closeAgent()` + `view` global | `js/core.js:400,407-408` |
| Header dropdown widget | `.hdr-dd-wrap`/`toggleHdrDD`/`closeAllHdrDD` (used by Entity + User dropdowns) | `index.html:26-99`, `js/core.js:278-295` |
| Sidebar data → DOM | `sidebarItems` array + `getSidebarItems()` + `buildSidebar()` | `js/core.js:34-74,77,203-253` |
| Single routing choke point | `navigatePage(pg)` | `js/core.js:410-414` |
| Draft vs Active journey state | `aiJourneys[].status`, flipped by `saveAIAutomation()` | `js/core.js:921-925`, `js/pages.js:4832-4851` |
| "Something happened" notification | `showAiToast(title,sub)` | `js/pages.js:5578-5589` |
| Disabled/locked visual precedent | `.agent-dd-item.disabled`, `.status-pill.draft`, `.ai-journey-draft-banner` | `css/main.css:275,1019,1098-1104` |
| Journey-authoring machinery | `startAutomateJourneyPicker()` / `buildAutomateJourneyFormHTML()` (7-step wizard) | `js/pages.js:3549,4563-4571,4734` |
| One-not-two-status-pill precedent for "connected" systems | `cfgSystems[].status` Connected/Disconnected + `submitCfgSystemAdd` | `js/core.js:955-975`, `js/pages.js:3998-4024` |

Notable pre-existing gap this plan works *around* rather than fixing: `cfgJourneys[].status` and `aiJourneys[].status` are separate arrays never synced by any code path today. Rather than deepen that, new entity-activation state lives in its own map (see below), keyed by journey `id`, read by both.

## Implementation approach

### 1. Role state & portal switcher
- Add `let portalRole='super-admin';` to the state block in `js/core.js` (near `view`/`mode`/`page`).
- Add `function setPortalRole(role){...}` (near `openAgent`) that: sets `portalRole`, exits Agent Mode back to `'adt'` view if active, resolves `page` through a new `canAccessPage` guard (falls back to a role-appropriate default page), then calls `renderADTPage()` — the same single call `closeAgent()` already uses to fully rebuild topbar/sidebar/content. Fire a `showAiToast` confirming the switch.
- Add a third `hdr-dd-wrap` in `index.html`, copy-pasted from the existing user/entity dropdown markup, listing the 3 roles as buttons calling `setPortalRole('...')`.

### 2. Role-aware sidebar
- Add a `roles:['super-admin','entity-admin','entity-user']`-style array to every item **and** every dropdown-child in `sidebarItems` (`js/core.js:34-74`). Configure's own dropdown gets `roles:['super-admin','entity-admin']`; its children get per-child roles so Entity Admin sees Systems / Context & Journey / Agents but not Overview or Data Foundation.
- Change `getSidebarItems()` (`js/core.js:77`) to filter the array (and each dropdown's `children`) by `portalRole`, dropping a dropdown entirely if it has no visible children left. `buildSidebar()` already calls this for the `'adt'` scope — no other change needed there.
- **Fix while here**: `buildSidebar` also uses the raw unfiltered `sidebarItems` for the `'agent'` (Agent Mode) scope (`js/core.js:210`) — switch that to go through the same filtered `getSidebarItems()` so Agent Mode's sidebar can't leak Configure to a restricted role.

### 3. Page-level guard
- Add a small `pageRoleMap` allowlist (deny-by-exception — most pages are unrestricted) and `canAccessPage(pg,role)`/`defaultPageForRole(role)` helpers near `navigatePage`. Restricted entries: all `cfg-*` pages (split between `['super-admin']`-only like Data Foundation/Overview/system-add, and `['super-admin','entity-admin']` like Systems/Context&Journey/Agents), plus the new Requests inbox (`['super-admin']`), `all-users`, `settings`.
- Wire the guard into `navigatePage(pg)` as the single choke point: if the target page isn't allowed for `portalRole`, redirect to `defaultPageForRole(portalRole)` instead (`'dashboard'` for super-admin/entity-admin, `'ai-executive'` for entity-user — satisfies "lands directly on AI Executive").
- Apply the same guard inside `showAgentModule(pg)` so Agent Mode can't be used to route around it either.

### 4. Request/approval data model
- New array `entityRequests` (near `notifData`, `js/core.js:257`) + `createEntityRequest(type, refId, label, note)` helper. Shape: `{id, type:'system-activation'|'journey-activation'|'journey-custom', refId, label, requestedBy, entity, timestamp, status:'Pending'|'Approved'|'Rejected', note}`.
- New Super-Admin-only sidebar page **Requests** (`entity-requests`) — justified because `notifData` is static/never mutated anywhere today and has no click-through to an actionable record; a dedicated inbox keeps the whole request lifecycle (list → detail → approve/reject → wizard hand-off for journeys) in one place. New `buildEntityRequestsHTML()` in `js/pages.js`, dispatched from `js/renderer.js`.
- `approveEntityRequest(id)` branches on `req.type`:
  - `system-activation` → flips `activatedForEntity` on the matching `cfgSystems` entry (adding it via the existing `submitCfgSystemAdd`-style flow first if it doesn't exist yet), toasts the outcome.
  - `journey-activation` → routes Super Admin into the existing `startAutomateJourneyPicker()`/wizard pre-selected on that journey; completing it via the existing `saveAIAutomation('active')` sets `entityJourneyActivation[journeyId]=true` and marks the request Approved.
  - `journey-custom` → routes into the same wizard's step 0, extended with a "+ New Journey" option (name/category/desc) that pushes new entries into both `aiJourneys` and `cfgJourneys` (using the existing `cfgSlug()` id generator), then proceeds through the normal steps to `saveAIAutomation('active')` — satisfying "added to the global catalog" per the user's decision. This also requires implementing the currently-dead "+ Add step" button (`js/pages.js:4389`) so the new journey isn't stuck with zero steps.
- `rejectEntityRequest(id)` sets status + toasts.
- Notifying the requester back is done via `showAiToast` at approve/reject time — matching every other state-transition in the app; `notifData` is deliberately left untouched (extending an array nothing else reads/writes would be new unused scaffolding).

### 5. Systems — Entity Admin variant
- Add `activatedForEntity:false` + `isDefault:true` (on the 3 existing seed systems) to `cfgSystems` (`js/core.js:955-975`); anything added later defaults `isDefault:false`.
- New `buildEntityAdminSystemsHTML()` (`js/pages.js`, alongside `buildCfgSystemsHTML`): lists only `isDefault` systems, **one button per row** — `Activate` (self-serve, no approval — matches the user's own wording) or an `Activated` pill if already on. Below the list, one `+ Request a System` button → a trimmed request form → `createEntityRequest('system-activation', ...)`.
- `renderPageContent` branches `cfg-systems` on `portalRole` to pick the right builder.

### 6. Context & Journey — Entity Admin variant
- New map `entityJourneyActivation={}` (near `cfgJourneys`), keyed by journey id, independent of both `status` fields per the drift note above.
- New `buildEntityAdminContextJourneyHTML()` (`js/pages.js`, alongside `buildCfgContextJourneyHTML`): same O2C/P2P/H2R/F2A category grid, but each journey card's single action is `Activate this journey` (→ `createEntityRequest('journey-activation', ...)`), or a disabled `Requested — pending` pill if already asked, or an `Activated` pill once approved. Below the grid, one `+ Request a Custom Journey` button feeding `createEntityRequest('journey-custom', ...)`.
- `renderPageContent` branches `cfg-context-journey` on `portalRole` the same way.

### 7. Agents — Entity Admin variant
- No new builder needed. `buildCfgAgentsHTML()` (`js/pages.js:4510-4532`) already only surfaces the functional `desc`/`model`/`usedIn`/`guardrail` fields in the card body — the only change is making the `Agent Skill` button conditional on `portalRole==='super-admin'`. Everything else (including for Entity User, who never reaches this page per its sidebar scope) stays as-is.

### 8. AI Executive locking
- New CSS (`css/main.css`, near the existing `.ai-journey-card` rules and `.agent-dd-item.disabled` precedent): `.ai-journey-card-locked` (dimmed, non-interactive) + `.ai-journey-lock-badge` (pill with a lock icon, sized like `.status-pill`).
- In `buildAIExecutiveDashboardHTML()`: compute `locked = portalRole!=='super-admin' && !entityJourneyActivation[j.id]` per card; when locked, apply the locked class, show the lock badge instead of any status/CTA, and make the card non-clickable.
- Guard `startAIJourneyRun()` and the entity-lock branch of `addListingItem('contracts')` (`js/core.js:771`) with the same check as defense-in-depth against stale buttons.
- Hide the `+ Create Your Journey` header button (`js/pages.js:3585`) entirely for non-super-admin roles — keeps exactly one action per card (the single-action-button rule).
- **Seed data fix**: `contract-creation`'s `aiJourneys` status defaults to `'Inactive'` today, and `addListingItem('contracts')` only routes to the AI-assisted flow when `status==='Active'`. Since Entity User must land on a *working* "Create Contract" action out of the box, set this journey's default `status:'Active'` and default `entityJourneyActivation['contract-creation']=true`, so the flagship flow isn't accidentally locked behind a demo setup step.

### 9. Entity User portal
- Almost entirely reuse of the above — just `roles` tags on the sidebar (`dashboard`, `ai-executive`, Employee, Teams, Workforce Operations, Leaves, Finance, Compliance Hub, Support — no Configure, no `all-users`/`settings`), `defaultPageForRole('entity-user')` → `'ai-executive'`, and the same locking rules as Entity Admin **minus** every request/activate/administer affordance (Entity User never sees `Activate this journey`, `+ Request a System`, `+ Request a Custom Journey`, or `+ Create Your Journey` — pure consumer view).

### 10. Single-action-button pass
Apply as a rule while building the above, not a separate refactor: every new/adapted Entity Admin or Entity User screen shows exactly one primary button per card/row (Activate, or a status pill with no button). Super Admin's existing multi-button screens (system detail Test/Edit, the wizard's Save-as-Draft/Activate pair) stay untouched — those roles never reach them directly.

## Build order
1. Role state + switcher + role-aware sidebar + `canAccessPage` guard (demoable: switching roles changes what you see).
2. Systems (self-serve activate + request) + `entityRequests`/Requests inbox.
3. Context & Journey (activate-request + custom-journey-request) + Super Admin fulfillment via the extended wizard (incl. the "+ Add step" implementation).
4. Agents (conditional skill.md button).
5. AI Executive locking + seed-data fix for `contract-creation`.
6. Entity User portal wiring (mostly `roles` tags + hiding admin-only buttons).
7. Single-action-button audit pass across everything built above.

## Files touched
- `js/core.js` — `portalRole`/`setPortalRole`, `sidebarItems` roles tags, `getSidebarItems()`, `canAccessPage`/`pageRoleMap`/`defaultPageForRole`, `navigatePage`/`showAgentModule` guard, `cfgSystems` new fields, `entityJourneyActivation`, `entityRequests`/`createEntityRequest`, `addListingItem` lock check, `aiJourneys` seed fix for `contract-creation`.
- `js/pages.js` — new `buildEntityAdminSystemsHTML`, `buildEntityAdminContextJourneyHTML`, `buildEntityRequestsHTML`, `approveEntityRequest`/`rejectEntityRequest`; conditional button in `buildCfgAgentsHTML`; locking logic + hidden header button in `buildAIExecutiveDashboardHTML`; guard in `startAIJourneyRun`; wizard extension (new-journey option + "+ Add step" handler) in `buildAutomateJourneyFormHTML`/`aiWizardSelectJourneyHTML`.
- `js/renderer.js` — role-branching for `cfg-systems`/`cfg-context-journey`, new `entity-requests` dispatch.
- `index.html` — new role-switcher header dropdown.
- `css/main.css` — `.ai-journey-card-locked`, `.ai-journey-lock-badge`.

## Verification (via the `run` skill, click-through in browser)
1. **Baseline**: confirm app loads as Super Admin, all 4 Configure children + all journeys unlocked.
2. **Entity Admin**: switch role → confirm Data Foundation/Overview gone, Configure shows 3 children.
   - Activate a default system → pill flips instantly, no request created.
   - Request a non-default system → appears in Super Admin's Requests inbox → approve → toast fires.
   - Activate a predefined Inactive journey (e.g. `h2r-lifecycle`) → request appears → approve as Super Admin → routes into wizard → complete → switch back → journey now unlocked on AI Executive with its CTA.
   - Request a custom journey → approve → lands in wizard's "new journey" mode → complete → confirm it's now a normal entry in the catalog.
   - Open Agents → confirm no `Agent Skill` button anywhere, `desc` text still shows.
3. **Entity User**: switch role → confirm landing page is AI Executive directly, Configure entirely unreachable (including via stale `navigatePage('cfg-systems')`), `Create Contract` works immediately without a setup detour, locked journeys show only a lock badge with zero admin affordances, all listed operational modules render normally.
4. **Regression**: confirm Super Admin's existing flows (system Test/Edit, full Automate Journey wizard, skill.md viewer/editor) are completely unchanged.

---

## Addendum: Entity Admin Dashboard (built ahead of the Systems/Context&Journey phases)

### Context
Phase 1 (role state, switcher, sidebar/page gating) is done and verified — Super Admin is untouched, Entity Admin and Entity User can be switched into and see correctly filtered sidebars. Today `page==='dashboard'` renders the exact same cached `dashboardContentHTML` snapshot (`js/renderer.js:91`, taken once from `index.html`'s static markup at boot) for every role. Before building the full Systems/Context & Journey pages (Phase 2/3), we're pulling the Entity Admin **Dashboard** forward as its own increment, since it's the first thing an Entity Admin sees after switching and should reflect their actual governance state (systems/journeys activated, requests pending) rather than Super Admin's generic view.

Decisions confirmed with the user:
- Keep the existing generic sections (Welcome banner, Attendance card, Quick Links row, Entity Setup Progress checklist) exactly as-is for Entity Admin — they're not admin-specific and cost nothing to keep.
- Only the bottom stat-grid changes, plus a new "Your Requests" panel is added below it.
- Build the real underlying data model now (not placeholder numbers), so this becomes the foundation Phase 2 (Systems) and Phase 3 (Context & Journey) plug into rather than a throwaway stub.

### Data model additions (`js/core.js`, near `cfgSystems`/`cfgJourneys`)
- `cfgSystems[]`: add `activatedForEntity:false` and `isDefault:true` to each of the 3 seed entries (SAP, Infor, Vendor Portal) — `isDefault` marks the "commonly-used default systems" set Entity Admin can self-serve activate; anything added later (custom system, approved request) defaults `isDefault:false`.
- `const entityJourneyActivation={};` — empty map keyed by journey `id`. Genuinely empty today (no Activate-journey UI exists yet) — this is the same map already specified in the main RBAC plan's Context & Journey section, just declared now so the dashboard can read it.
- `let entityRequestSeq=1; const entityRequests=[];` — empty array, same shape as the main plan's §4: `{id,type:'system-activation'|'journey-activation'|'journey-custom',refId,label,requestedBy,entity,timestamp,status:'Pending'|'Approved'|'Rejected',note}`. Left genuinely empty (no Request buttons exist yet to populate it) rather than seeded with fake demo rows — it'll fill up naturally once Phase 2/3 build the actual request actions.
- No changes to `aiJourneys` — `aiJourneys.length` (currently 3) is the denominator for "Journeys Activated".

### New builder: `buildEntityAdminDashboardHTML()` (`js/pages.js`, near the top-level dashboard/init code)
Reuses the Welcome banner / Attendance card / Quick Links / Entity Setup Progress markup verbatim (copy from the current static block), then replaces the stat section:

- **Stat row** (`.stat-grid`/`.stat-card`, same classes as today — visual parity, not a new component):
  1. `Systems Activated` — `cfgSystems.filter(s=>s.isDefault&&s.activatedForEntity).length` / `cfgSystems.filter(s=>s.isDefault).length`
  2. `Journeys Activated` — `Object.values(entityJourneyActivation).filter(Boolean).length` / `aiJourneys.length`
  3. `Pending Requests` — `entityRequests.filter(r=>r.status==='Pending').length`
  4. `Total Employees` — kept verbatim from today's card (same hardcoded `247` / `+12 this month`, consistent with the rest of this mockup's non-computed stat cards)
- **"Your Requests" panel** — new small card (same 14px-radius/1px-border/`var(--card)` language as `.listing-card`/`.setup-card`), title "Your Requests", listing up to the 5 most recent `entityRequests` (type icon + label + relative timestamp + status pill using the existing `status-pill`/`statusClass()` helper). Empty state (today, since the array starts empty): "No requests yet — activate a system or journey to see status here."
- No quick-links/CTA duplication here — Systems/Context & Journey/Agents/AI Executive are already one click away via the sidebar, so this page doesn't need its own nav shortcuts (keeps to the single-purpose-per-element rule already used elsewhere in this plan).

### Wiring
- `js/renderer.js:62` — change `if(page==='dashboard'){el.innerHTML=dashboardContentHTML;return;}` to branch on `portalRole==='entity-admin' ? buildEntityAdminDashboardHTML() : dashboardContentHTML`. Super Admin and Entity User both keep the untouched shared snapshot.
- `js/core.js:200` (`showAgentModule`) — same branch for the Agent Mode dashboard shortcut, for consistency.

### CSS
- `.status-pill.approved` already exists (`css/main.css:461`, green). Add `.status-pill.rejected{background:#fff0f0;color:#dc2626;border-color:#fca5a5}` (same red as `.inactive`) next to it — the only new CSS needed, everything else reuses existing `.stat-grid`/`.stat-card`/`.listing-card` styling.

### Verification
- As Super Admin: confirm Dashboard is pixel-identical to before (still the cached snapshot).
- Switch to Entity Admin: confirm stat row shows `Systems Activated 0/3`, `Journeys Activated 0/3`, `Pending Requests 0`, `Total Employees 247`, and the Requests panel shows the empty state. Confirm Welcome banner/Attendance/Quick Links/Setup checklist render unchanged.
- Switch to Entity User: confirm Dashboard (if visited via sidebar) is still the original shared snapshot, unaffected by this change.
- Confirm no console errors and that switching roles back and forth keeps re-rendering correctly (reuses the existing `renderADTPage()` refresh path from Phase 1).
