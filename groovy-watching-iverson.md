# AI Executive Module — Implementation Plan

## Context

The ADT mockup (`index.html` + `js/core.js` + `js/pages.js` + `js/renderer.js` + `css/main.css` + `css/leaves.css`) is a static, vanilla-JS SPA-style prototype for an HR/payroll SaaS product. It already has a working sidebar, page router, listing tables, multi-step form wizard, a slide-in detail drawer, and an "Agent Mode" chat interface. The goal is to add a new sidebar module, **AI Executive**, that showcases predefined AI-automation "journeys" (starting with *Contract Generation to Ready for Payroll*) — without touching the existing product's UI language. This plan reuses existing components wherever a match exists and only introduces new CSS for things that genuinely don't exist yet (timeline, actor chips).

Confirmed with user:
- Build in **3 review phases** (see below).
- Mockup should be **fully interactive** (drawer opens on click, toggles flip state, "Approve and Continue" advances the run timeline with a simulated processing delay, mirroring the cost-calculator's existing 1800ms loader pattern).
- **All 6 journeys** get fully fabricated event timelines (not just Journey 1), matching the depth of the spec's Journey 1 example.

## Existing patterns being reused (confirmed via code read)

| Need | Existing pattern | Location |
|---|---|---|
| Page routing | `navigatePage(pg)` sets global `page`, calls `renderADTPage()` | js/core.js:373 |
| Content dispatch | if/else chain on `page` in `renderPageContent()` | js/renderer.js:1 |
| Sidebar nav item | `sidebarItems` array entries (`{id,label,color,icon}`) | js/core.js:7 |
| Page title/meta | `getPageMeta(pg)` / `supportPageMeta` map | js/core.js:49,70 |
| "+" add button per page | hardcoded branch in `addListingItem(pg)` | js/core.js:728 |
| Summary tiles | `.stat-grid` / `.stat-card` | css/main.css:187, used in dashboard |
| List + filters + status | `.listing-page/.listing-top/.listing-stats/.listing-card/.listing-table/.status-pill` | css/main.css:380-417 |
| Slide-in detail drawer | `.lp-split-wrap/.lp-split-main/.lp-split-sb` (opens via `width:0→68%`) + `.lp-isb/.lp-isb-tabbar/.lp-isb-tabs/.lp-isb-body` | css/leaves.css, used by contracts/teams/employees |
| Checklist w/ done state | `.setup-card/.setup-steps/.setup-step.done/.ss-ico/.ss-name/.ss-status` (dashboard's "Entity Setup Progress") | css/main.css:175-186 |
| Progress bar | `.setup-bar/.setup-fill` | css/main.css:178-179 |
| Real toggle switch | `.cs-toggle` (checkbox-based, Company Settings) | js/pages.js (buildCompanySettingsHTML) |
| Animated "fetching" loader | `.cc-loader/.cc-spinner` (Cost Calculator country switch, 1800ms) | js/renderer.js:107-125 |
| Multi-section form fields | `.ep-form-card/.ep-form-title/.ep-form-grid/.ep-form-group/.ep-form-label/.ep-form-input/.ep-form-select` | js/pages.js (buildContractFormHTML) |
| Buttons | `.btn.btn-primary` (navy), `.btn-secondary`, `.btn-success` (green) | css/main.css:373-379 |

Genuinely new (nothing to reuse):
- **Actor/type chips** (AI Automated, Human Required, System Action, Client Action, Validation Required, Approval Required, Exception Possible) — no `.chip`/`.tag` class exists anywhere. Will add `.ai-chip` + 7 modifier classes, styled as pill badges consistent with `.status-pill` (same border/radius/font conventions) using existing tokens (`--orange`, `--green`, `--red`, `--navy`, `--gray`) plus 2 new scoped hex vars for Human(blue)/Client(purple) so all 7 stay visually distinct without breaking the existing palette.
- **Vertical event timeline** (journey detail + run detail) — new `.ai-timeline/.ai-timeline-item/.ai-timeline-dot/.ai-timeline-line/.ai-timeline-card`, built from the same 14px-radius/1px-border/var(--card) card language as `.listing-card`.
- **Journey card** (dashboard) — new `.ai-journey-card`, composed from existing pieces: `.setup-bar/.setup-fill` for coverage %, `.status-pill`-style badge (2 new modifiers: `.available`, `.draft`), `.btn-secondary`/`.btn-primary` for the two CTAs.

## Data model (new, in js/core.js)

Add a new section near `sidebarItems`/`supportPageMeta`:
- `aiJourneys` — array of 6 journeys: `{id, name, description, connectedModules[], coveragePct, humanSteps, aiSteps, status, riskLevel, lastUpdated}`.
- `aiJourneyEvents` — object keyed by journey id → ordered array of event objects: `{id, name, type, actor, source, description, validation, humanIntervention, action, status, approvalRequired, failureHandling, fieldsFetched[], nextStep}`. All 6 journeys get full lists (Journey 1 uses the user's 14 events verbatim; journeys 2–6 get plausibly fabricated 8–12 step lists in the same shape).
- `aiJourneyRuns` — mock run records for the "Active Automation" table (Journey 1 only, since it's the flagship "Active" journey): `{runId, client, country, contractType, currentStep, aiCompleted, humanPending, status, lastActivity}`.
- `aiRunDetail` — the single expanded run used on the Run Detail screen (Client ABC Manufacturing GmbH / Germany / EOR, from the spec's mock data), with a `steps[]` timeline (done/current/pending) driving the ✓/⏳/○ display.

## Screens & phasing

**Phase 1 — Navigation, Dashboard, Journey Detail, Timeline, Event Drawer**
1. Sidebar: add `{id:'ai-executive', label:'AI Executive', color:'orange', icon:<flow svg>}` to `sidebarItems` (top-level item, not a dropdown — matches how `teams`/`all-users` work).
2. Wire `page==='ai-executive'` in `renderPageContent()` → `buildAIExecutiveDashboardHTML()`.
3. Dashboard: title + subtitle, grid of 6 `.ai-journey-card`s (reusing `.stat-grid`-style layout at 2-col or 3-col), each with View Journey / Automate Journey buttons.
4. `page==='ai-journey-detail'` (+ `selectedJourneyId` state var) → `buildAIJourneyDetailHTML(id)`: `.stat-grid` summary cards (Total Events, AI Automated, Human Required, Connected Modules, Status, Risk, Last Updated) + primary "Automate This Journey" button + `.ai-timeline` of that journey's events, each row showing actor/type chips.
5. Clicking an event opens the **event detail drawer** — reusing `.lp-split-wrap/.lp-split-sb` slide-in pattern — showing description, data sources, fields fetched, validation, human-intervention logic, failure condition, next step.
6. New CSS additions in css/main.css: `.ai-chip` + variants, `.ai-timeline*`, `.ai-journey-card`, `.status-pill.available/.draft`.

**Phase 2 — Automate Journey Form**
7. `page==='ai-automate-form'` → `buildAutomateJourneyFormHTML(journeyId)`: single scrolling page (not a stepper — spec describes sections A–G, not sequential steps) built from repeated `.ep-form-card` blocks: Basic Details, Trigger Configuration, Automation Scope (per-event row with 3 `.cs-toggle` toggles + exception-handling select), Approval Rules, Data Validation checklist, Connected Modules chips, Save Options footer (`Save as Draft` / `Activate Automation` / `Cancel` using `.btn-secondary`/`.btn-primary`/`.btn-success`).
8. Toggle state is live (JS object per event id), so it's a real interactive config screen.

**Phase 3 — Active Automation, Run Detail, Backend Activity**
9. `page==='ai-active-automation'` → status header (`.stat-grid`: Active, Trigger, Entity, Country, Created by, Last run, Total runs, Success rate, Exceptions pending) + `.listing-table` of recent runs (reusing `.listing-page/.listing-card/.status-pill`).
10. `page==='ai-run-detail'` (+ `selectedRunId`) → left: live timeline using the `.setup-steps`/`.ss-ico`/checkmark pattern (✓ done / ⏳ current / ○ pending) driven by `aiRunDetail.steps`; right panel: "Current Action Required" card with AI summary text + `Review Data` / `Approve and Continue` / `Reject` buttons.
11. **Backend Activity panel**: reuses `.cc-loader/.cc-spinner` animation — shows "Fetching X from Y" with status chip (Fetching/Validating/Completed/Failed/Waiting for Human Approval), updates as timeline advances.
12. Clicking "Approve and Continue" advances `aiRunDetail` state, re-renders the timeline (next step flips to done, following step becomes current) with the ~1.5–2s simulated delay, matching the existing loader UX.

## Files to change
- `js/core.js` — sidebar entry, `aiJourneys`/`aiJourneyEvents`/`aiJourneyRuns`/`aiRunDetail` data, `getPageMeta` entries for new page ids, state vars (`selectedJourneyId`, `selectedRunId`, event-drawer open state, automate-form toggle state).
- `js/renderer.js` — new `if(page===...)` branches in `renderPageContent()`.
- `js/pages.js` — new `buildAIExecutiveDashboardHTML`, `buildAIJourneyDetailHTML`, `buildAIEventDrawerHTML`, `buildAutomateJourneyFormHTML`, `buildAIActiveAutomationHTML`, `buildAIRunDetailHTML` functions, plus small interaction functions (`openAIEventDrawer`, `toggleAutomationScope`, `approveRunStep`, etc.) following the existing naming/style conventions in the file.
- `css/main.css` — new component classes listed above, appended near related existing sections (chips near `.status-pill`, timeline near `.listing-card`, journey card near `.action-card`).

## Verification
- After each phase, run via the `run` skill (open `index.html` in the browser) and click through: sidebar → AI Executive → dashboard cards → View Journey → timeline → click an event → drawer opens/closes → (Phase 2) Automate Journey → toggles flip → Save/Activate → (Phase 3) Active Automation table → open a run → Approve and Continue advances the timeline and backend activity panel updates.
- Confirm no existing pages/behaviors regressed (sidebar still collapses/expands, other pages still route correctly) since `sidebarItems`, `renderPageContent`, and `getPageMeta` are shared, edited files.
