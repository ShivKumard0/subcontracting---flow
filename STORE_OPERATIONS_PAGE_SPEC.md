# Store Operations — Page Specification (Dev Handoff)

**Page id:** `store-ops` · **Persona:** Ops Manager (`ops-manager`, Sunita Kulkarni, SK)
**Journey:** Bhaiyaa Store Creation Journey (`bhaiyaa-store-creation`)
**Source of truth in the current build:** data model + state machine in [js/core.js:865-1060](js/core.js#L865-L1060), render + handlers in [js/pages.js:947-1454](js/pages.js#L947-L1454), styles in [css/am-pipeline.css](css/am-pipeline.css) (`.am-*`, `.so-halt`) and [css/leaves.css](css/leaves.css) (`.lp-*` split drawer, logs timeline, pagination).

> Statuses, sub-steps, log semantics and seed records in this document are **verbatim from the build** and must not be renamed, re-ordered or re-coloured. Everything is one journey rendered four ways: rail, row, drawer, log.

---

## 1. Purpose & placement

An Ops Manager's day on store openings is **not** a to-do list of their own steps. The journey is mostly automated — of the 9 always-on sub-steps, 6 run on agents and 2 belong to the merchant. Their real day is two exceptions: **a merchant who started a signup and stopped**, and **an agent run that halted**. The page is built to surface exactly those two and deliberately invents no ops sign-off steps to pad the human column.

- Reached via the persona tab strip: `Store Operations` | `Ops Dashboard` | `Ops Approvals` ([js/core.js:1867](js/core.js#L1867)). Store Operations is the default/first tab.
- **No stat tiles.** The rail counts the same 12 records by stage a few inches below where tiles would sit. One set of counts per page is the rule.
- Root: `<div class="am-page">` → header + rail + listing. Vertical gap `16px`, `flex-direction:column`, `min-width:0`.

---

## 2. Design tokens (do not introduce new hues)

```
--navy:#0f172a   --gray:#6a7282   --border:#e5e7eb   --card:#fff   --light:#f8f9fb
--orange:#1a1a1a  (near-black accent: pagination active, drawer active tab, save button)
--am-quiet-bg:#f8fafc    nothing to say — upcoming, empty, inert
--am-tint-bg:#f1f5f9     the default status ground
--am-tint-line:#e2e8f0   --am-tint-ink:#475569
--am-strong-bg:#e2e8f0   the one that wants you — late, gate, blocked
--am-strong-line:#cbd5e1
```

**Colour law:** the board body is monochrome. Emphasis is *weight and darkness*, never hue. A row must never show a green pill, an amber chip, a red age and a green button at once — that is four alarms and therefore none. The only saturated colour on the page lives inside the drawer (`.lp-status-badge`, log dots), and that is existing shared component styling.

Font: Inter. Numerals and labels per the CSS below — do not re-scale.

---

## 3. Band A — Header (`buildSoHeaderHTML`)

```
Sunita Kulkarni  [OPS MANAGER]                                    [ + New store ]
You are looking after 12 store openings. 2 have stopped.
```

| Element | Rule |
|---|---|
| `.am-head` | flex, `align-items:flex-end`, `justify-content:space-between`, gap 24, wraps |
| `.am-head-title` | persona name, 19px/800, `--navy`, letter-spacing −.3 |
| `.am-head-role` | persona label pill — 10.5px/700, uppercase, `--am-tint-bg`, 1px border, radius 20, pad 3/10 |
| `.am-head-sub` | 12px, `--gray`, margin-top 5 |
| `.am-head-new` | primary button, plus icon (SVG line-line, stroke 2.5) + "New store" |

**Copy rules — these are load-bearing:**
- Counts **store openings, not stores**. 6 of the 12 have no store in either system yet; calling them stores names something that does not exist.
- Second clause counts what has **stopped**, and must **not** say "needs you" — one of the two halts is a UIDAI mismatch, which the journey hands to Compliance, not to this role. Pluralisation: `1 has stopped` / `2 have stopped`; when zero → `Nothing has stopped.`

**Action:** `New store` → `startStoreIntake()` — the real store intake journey, which is stage 1 of this same rail. The page both watches the journey and starts one. It stores the return page (`storeIntakeBackPage`) then navigates to `create-store`.

---

## 4. Band B — Stage rail (`buildSoPipelineHTML`)

Card `.am-bar-card` (white, 1px border, radius 12, pad 16) containing `.am-bar` (flex, stretch).
**Four segments in two track groups, split by a dashed divider** (`.am-bar-div`, 17px, `border-left:1.5px dashed #cbd5e1`).

| Track | Segments | Meaning |
|---|---|---|
| `merchant` — "The merchant signs up" | Signup | Nothing here is yours to tick. You chase. |
| `ours` — "We open the store" | KYC · Creating · Live | Runs on agents. You step in only when one halts. |

The divider is the honest summary of this journey: *the first half is not ours to do, the second half is not ours to touch unless it breaks.*

### Stage definitions — verbatim, ordered (`soPipelineStages`)

| n | id | short (rail) | label (tooltip) | tone | track | waitingOn | flags |
|---|---|---|---|---|---|---|---|
| 1 | `store-details` | **Signup** | Store details | amber | merchant | Merchant | `merchantAction` |
| 2 | `kyc` | **KYC** | KYC verification | red | ours | KYC Agent | `gate` |
| 3 | `store-creation` | **Creating** | Store creation | blue | ours | Store Agent | — |
| 4 | `store-live` | **Live** | Store created | green | ours | Ops Manager | `terminal` |

Plain-language text (drawer + filtered list subtitle):
- **Signup** — "The merchant is filling in Bhaiyaa's signup — contact, store name, category and turnover band." *(internal: Signup in progress on the merchant's side)*
- **KYC** — "We are checking the owner's Aadhaar with UIDAI before any store is opened." *(internal: UIDAI demographic match and watchlist screen)*
- **Creating** — "We are registering the store on Bhaiyaa and switching on the storefront or the ledger." *(internal: StoreIntake registration, then provisioning)*
- **Live** — "The store exists in both systems. It stays Pending until its address, GST number and bank details are added." *(internal: Live in both systems, pending the remaining details)*

`kyc` is a **gate** in the strict sense: nothing downstream exists until it clears. A failed match halts the run *before* a store is created — which is the entire reason KYC sits at position 2 and not after provisioning.

### Segment rendering (`soSegmentHTML`)

- `.am-seg` — `flex:1 1 0; min-width:0` so all four always fit at any viewport by construction. No horizontal scroller. Border 1.5px, radius 9, white, pad 9/10/10, transition .15s.
- Contents, top to bottom: `.am-seg-bar` (3px accent strip, `--am-strong-line` for **all** stages — never colour-code by tone; a stage is only earlier or later, not good or bad) → `.am-seg-count` (19px/800 navy) → `.am-seg-label` (10.5px/600, ellipsised).
- `.empty` (count 0): background `--am-quiet-bg`, count in `--am-strong-line`, label `#9ca3af`.
- `.selected`: border `--navy`, bg `#f8fafc`, ring `0 0 0 2.5px rgba(15,23,42,.07)`, accent strip goes navy.
- Hover: border `#94a3b8`, bg `#fafbfc`.
- `title` attribute = `label` + flag + " — " + `internal`, where flag is `" · nothing exists until this clears"` for the gate, `" · waiting on the merchant"` for the merchant stage, else empty. Group `title` = track label + " — " + track plain text.
- Count = `soStageCount(id)` — live count of records whose `stage === id`. With seed data: **Signup 6 · KYC 1 · Creating 1 · Live 4 = 12**.

### Filter behaviour

`soSelectPipelineStage(id)` **toggles** — clicking the selected segment clears the filter. Every selection resets `soPage = 1` and `soSelectedId = null`, then re-renders. `soClearPipelineStage()` (the "Show all" pill) does the same with an empty stage.

---

## 5. Band C — Listing (`buildSoListingHTML`)

### Header row (`.am-list-head`)

| State | Title | Subtitle | Right side |
|---|---|---|---|
| No filter | `Every store opening` | `Everything you own, in one list. Click a step above to narrow it down.` | `12 of 12` pill |
| Filtered | stage `short` (e.g. `Signup`) | `<stage plain text> · Should take: <SLA>` | `6 of 12` pill + `Show all` reset pill |

**Stage SLAs (`soStageSla`)** — expressed in the merchant's terms, not a duration nobody can act on:

| Stage | Should take |
|---|---|
| Signup | 2 days, then chase |
| KYC | Seconds, unless it halts |
| Creating | Minutes, unless Bhaiyaa refuses |
| Live | 1 day to finish the details |

Styles: `.am-list-title` 15px/800 navy · `.am-list-sub` 11.5px gray · `.am-list-count` 11px/700 pill on `--am-tint-bg`.

### Table (`.lp-table.am-table`)

`table-layout:fixed`, driven by a generated `<colgroup>`; **no `min-width`** — the table is sized by its colgroup and never overflows. Cell padding `11px 14px`. `th` uppercase 10.5px/600 gray on `#fafbfc`, `overflow:hidden;text-overflow:ellipsis` (fixed layout alone does not stop a nowrap heading painting over its neighbour).

Six columns. One fewer than the deal board, because a store opening has no second party: the merchant **is** the customer, so "who this is for" and "who we are waiting on" collapse into one cell.

| # | Header | Width (normal / compact) | Content |
|---|---|---|---|
| 1 | STORE | 31% / 40% | `.cell-primary` store name · `.cell-sub` store ref (`STR-000112`) |
| 2 | MERCHANT | 24% / *hidden* | `.cell-primary` merchant name · `.cell-sub` `Seller` · category — see §13, role is always Seller |
| 3 | WHERE IT IS NOW | 29% / 44% | see below |
| 4 | DAYS | 8% / *hidden* | `12d`; `title` on header = "Days sitting on the current step" |
| 5 | *(blank)* | 8% / 16% | hamburger `.lp-action-btn` → opens drawer, `title="Open this record"` |

> **There is no "What to do next" column, and its absence is the design.** Acting on a run means
> opening it — reading the evidence, then deciding — and a one-click button in a row is the
> opposite of that: it completes a step for a record whose details you have not looked at. The
> action still exists, unchanged, at the top of the drawer's Logs tab, which is the one place
> that shows you what you are agreeing to before you agree to it. **The drawer is the single
> action surface; the listing is for finding the row you want.** `soNextActionCellHTML` was
> deleted with the column — do not reintroduce either.

Widths sum to 100 in both states and are emitted from one list, never written twice.

**"Where it is now" cell (`soWhereCellHTML`)** — three stacked lines, read-only, no popover, `title` = stage plain text:
1. `.am-sub-pill` — stage `short`, 9px/800 uppercase pill.
2. `.am-where-step` — the **current sub-step label**, 12.5px/700 navy; appends `⚡ auto` tag if the step is automated and a `halted` tag if the run has stopped.
3. `.am-where-prog` — `Step 2 of 3`, 10.5px gray.

A halted run says so **here**, not only in the drawer. That is the difference between a record moving slowly and one that has stopped, and the listing is where that gets triaged.

**Pill class map (`soBadgeClass`)**: green→`approved`, red→`inactive`, amber→`pending`, blue→`expired`. In the listing all of these resolve to the same tint ground except `inactive`, which is darkened (`--am-strong-bg`) — the one case where the pill itself is the thing to notice. Inside the drawer the same classes hit `.lp-status-badge` and *do* render in colour (approved green, inactive red, pending amber, expired slate); that is intentional and existing shared styling.

**Days cell**: `.am-c-age` 13px/700 gray. On `breach:true` → `.breach` (navy, 800) plus a `Too long` sub-line. Late is said in **weight, not red** — the words were always doing the work.

### Row interaction

- Whole row is clickable (`cursor:pointer`) → `openSoRunSidebar(id)`. Every in-cell button calls `event.stopPropagation()` first.
- Selected row: `.lp-row-selected` → bg `#f1f5f9`, 3px `--orange` left border on the first cell.
- **Compact mode** — the moment a row is selected the drawer overlays 68% of the width, so MERCHANT and DAYS are **dropped rather than clipped mid-word**. What survives is Store, Where it is now and What to do next: you can still pick the next record and still act on it from the strip the drawer leaves free.
- Empty state: single row, `colspan` = live column count, `padding:34px`, centred, 12.5px gray — **"Nothing here right now."**
- If the selected record is not on the current page, the selection is dropped.

### Pagination (`soListPaginationHTML`)

`SO_PAGE_SIZE = 10` → 12 seed records = 2 pages. `.lp-pagination` bar below the table, `border-top`, `12px 18px`.
- Left: `Showing 1–10 of 12 entries` (shows `0` when total is 0).
- Right: `‹` arrow, numbered buttons, `›` arrow. `.lp-pg-btn` 32×32, radius 7. Active = filled `--orange`, white text, 700. Arrows disabled at the ends (`opacity:.4`).
- `soGoToPage(n)` clamps to ≥1 and clears the selected row. Page index is clamped against `totalPages` on every render.

---

## 6. Record drawer (`renderSoRunSidebar`)

`.lp-split-sb` — absolutely positioned over the right of the listing, `width:0 → 68%` on `.open`, transition `width .28s cubic-bezier(.4,0,.2,1)` + opacity .2s, `min-height:500px`, radius 12, shadow `0 8px 32px rgba(15,23,42,.12)`.

Tab bar `.lp-isb-tabbar` (46px, bottom border) with **three tabs** — `Details` · `Logs` · `Workflow` — and a close `×` on the right. Active tab: `--orange` text + 1.5px border, 600. Default tab on open: `basic-details`. Body `.lp-isb-body` scrolls, pad `18px 20px`.

> Three tabs, not the deal board's four. There is no client-mirror tab because the merchant sees Bhaiyaa's own signup — which *is* stages 1 and 2 themselves, not a translation of them.

### Halt banner (`.so-halt`) — appears first on **every** tab of a stopped record

```
This run has stopped. <haltNote>
```
Border 1px `--am-strong-line`, **left rule 3px navy**, bg `--am-quiet-bg`, radius 8, 11.5px/1.6. Stays inside the monochrome law — a red callout would compete with the one thing it must not: the age column that says "late". Anything above it answers a question the reader does not have yet.

### Tab 1 — Details

Header: store name + `.lp-status-badge` with the stage `short`. Then stage plain text (`.am-sb-plain`), then the halt banner, then a **2-column card grid** (`.lp-sb-detail-grid`, `1fr 1fr`, gap 8; cards `#f8f9fb`, icon + label + value):

| Field | Value |
|---|---|
| Store ID | `d.ref` |
| Bhaiyaa ref | `d.bhaiyaaRef` or grey **"Not issued yet"** |
| Merchant | `d.merchant` |
| What this store does | `Sells to customers` — always, see §13 |
| Category | `d.category` |
| Where | `d.city` |
| Turnover band | `d.band` |
| Plan & GST | `<plan>` in accent · `<gst>` |
| Last touched | `d.updated` |
| Days on this step | `d.age day(s)` |

Plan and GST are **derived from the turnover band** by `bhaiyaaBandFor()` — the same table the journey's Store Creation step uses, so this drawer and that run can never quote different figures. Do not duplicate the mapping.

### Tab 2 — Logs (the only surface that moves a run forward)

Layout `.lp-logs-wrap` = CSS grid `1fr 1fr`, `align-items:start`: **timeline left, action panel right (sticky top)**. The action sits above/beside the trail it writes into — one step, one button, the **same next action the listing shows**, so the two can never disagree.

Header line: `<ref> · <store>` + `Internal` chip, then halt banner, then
`Everything that has happened — <n> entries, newest first`.

Timeline entry card (`.lp-log-card`, white, radius 10, 11/13 pad) with a 34px avatar column and a 2px connector between rows:
- **Status row:** dot + sub-step label + tags — `⚡ auto` · `reminder` · `happening now` (current) · `halted` (current + halted) · `took too long` (breach).
- **Meta row:** person · date · time. Automated steps are credited to **"AI Execution Layer"**, not to the role that answers for them.
- **Comment row:** `In: <stage n>. <stage short> · <note | "In progress." | "Finished.">`
- Avatar/dot/text skin: `current` and `note` entries → `default` (grey `#f1f5f9`/`#94a3b8`/`#64748b`); everything else → `active` (green `#dcfce7`/`#16a34a`).
- Empty: **"Nothing has happened yet."**

**Action panel** (`.lp-logs-form`) — two shapes:

*Automated step:* navy dot + header **"Runs automatically"**, sub-line `"<step>" is performed by the AI Execution Layer — <autoNote>. Nothing to do here.` No textarea, no button.

*Everything else:* amber dot + header `Next: <step label>`, sub-line varies by ownership —
- yours: `This step is yours to complete.` (or, on a halt step: `This run halted here. Clearing it releases the journey.`)
- merchant: `Waiting on the merchant. You cannot fill their signup in for them.`
- other role: `Owned by <person> (<role>).`

…followed by ` Step <i> of <n> in "<stage short>"` and ` · should take <sla>` when the step declares one. Then a **Comment** field (`.lp-logs-form-textarea`, 88px, placeholder "Add a note for this action...") — marked required with a red `*` **only when the step is yours** — and the primary button:
- yours → `step.act` (e.g. **Retry**, **Clear review**, **Complete details**) or `Mark "<label>" done` → `soCompleteStep(id)`
- not yours → `Simulate: <person> completes this` (or `…chooses` for a decision step) → `soSimulateStep(id)`
- merchant-owned additionally gets a text link: **"Send the merchant a reminder instead"** → `soRemindMerchant(id)`

### Tab 3 — Workflow (read-only)

Header `How far this has got` + `Internal` chip, halt banner, then the intro: *"The four steps of the Bhaiyaa Store Creation Journey, and what has already been done on this one. To change anything, use the Logs tab."*

Vertical stage list (`.am-cv-row`, states `done` / `current` / `upcoming`):
- Mark: ✓ for done, stage number otherwise. **done** = mid-grey filled (`#64748b`); **current** = navy filled with a `0 0 0 3px rgba(15,23,42,.1)` halo, label 800, sub-line navy/600; **upcoming** = grey label. Two greys read as a sequence; green-and-navy read as two unrelated states.
- Label carries a `gate` tag on KYC and an `⚡ N of M auto` tag where automation exists.
- Sub-line: `done` → `3 of 3 steps done · last by <person> on <date>` · `current` → `On step 2 of 3 · <step label> · runs automatically | waiting on <owner>` · `upcoming` → `Not started · 3 steps · <waitingOn>`.

Below it, **"Run by the agents"** (`.am-sb-steps`) lists automation that has **already** run, as facts rather than tasks — bolt icon, step label, `<autoNote> · by <owner> in "<stage>"`, and a plain `Done`. Upcoming automation is deliberately excluded: it would be a promise, not a record.

---

## 7. Sub-steps, ownership and "What to do next"

### Sub-step catalogue — verbatim (`soSubStatuses`)

| Stage | # | Step label | Owner | Auto | Note / SLA / act |
|---|---|---|---|---|---|
| Signup | 1 | Signup issued | Ops Manager | ⚡ | link sent to the merchant |
| Signup | 2 | Signup completed | Merchant | — | SLA 2 days |
| Signup | 3 | Mobile verified | Merchant | ⚡ | OTP callback |
| KYC | 1 | Aadhaar checked with UIDAI | KYC Agent | ⚡ | name and mobile match |
| KYC | 2 | Watchlist screened | KYC Agent | ⚡ | screening API |
| KYC | 3 | **Verification pending** | Ops Manager | — | SLA 1 day · `opensKyc` · button: **Verify KYC** → see §14 |
| KYC | 4 | **Mismatch review** | Compliance | — | `halt` · button: **Clear review** |
| Creating | 1 | Registered on Bhaiyaa | Store Agent | ⚡ | StoreIntake |
| Creating | 2 | Storefront or ledger opened | Store Agent | ⚡ | provisioning |
| Creating | 3 | **Registration retry** | Ops Manager | — | `halt` · button: **Retry** |
| Live | 1 | Store details completed | Ops Manager | — | SLA 1 day · button: **Complete details** |
| Live | 2 | Active on Bhaiyaa | Store Agent | ⚡ | once the details are complete |

9 always-on steps + 2 conditional halt steps. Minimal on purpose: the contract journey has 41 sub-steps; a store board that split this journey into forty operations would be describing a process that does not exist.

> `Signup issued` is a real event with a real timestamp even though it precedes anything the merchant does. Dropping it would leave the trail starting mid-conversation — the first thing in the log would be the merchant replying to something nobody sent.

**Halt steps** are *only present for a record whose run halted in that stage* (`soSteps` filters on `d.halted === stageId`) and are always authored **last** in their stage — that is what keeps the `sub` index stable whether the halt step is present or not. Modelling halts as ordinary steps would put every store through a compliance review it does not need; modelling them as nothing would leave the two records an Ops Manager actually works with nowhere to sit.

**`act` overrides the button wording** and is capped at two words: "Mark done" is right for a step you complete and wrong for one you clear, and the action column is where a user reads fastest.

### Owner directory (`amOwnerDirectory`)

| Role | Person | Can advance in-portal? |
|---|---|---|
| Ops Manager | Sunita Kulkarni (SK) | ✅ persona `ops-manager` |
| Compliance | Kavya Iyer (KI) | ✅ persona `compliance-officer` |
| Merchant | Merchant (MR) | ❌ external — chase only |
| KYC Agent | KYC Agent (KA) | ❌ agent |
| Store Agent | Store Agent (SA) | ❌ agent |

`Ops Manager` is deliberately a **separate key from `EOR Ops`** even though both resolve to Sunita: they are two queues, not one, and a store opening landing in the EOR Ops bucket would be unreadable to whoever works it. The agents are named rather than folded into `System` because the journey names them, and a trail that says "KYC Agent" is worth more than one that says "the system".

`amCanAdvance(role)`: false if the role has no persona; true for `entity-admin` / `super-admin`; otherwise true only when `portalRole === 'entity-user'` **and** the signed-in persona matches the step owner's persona.

### The four action kinds (`soNextAction`) — checked in this order

| Kind | Condition | Listing control | Handler |
|---|---|---|---|
| `auto` | `step.auto` | `⚡ Auto` static chip (`.am-act.auto`) | none |
| `do` | `amCanAdvance(owner)` | **solid navy** button, tick icon, label = `step.act` or `Mark done` | `soCompleteStep` |
| `chase` | owner is `Merchant` | **outlined** button, speech-bubble icon, `Send reminder` | `soRemindMerchant` |
| `wait` | anything else | plain grey text `Waiting on <role>` | none |

`auto` is checked **first** so an automated step can never grow a manual button just because the accountable role happens to be signed in. Solid black = "you can finish this"; outlined = "you can only nudge someone else". That hierarchy is carried by fill, never by green-vs-amber.

---

## 8. State machine — moving a run forward

`soAdvanceStep(runId, simulated)` is **the only writer.** Sequence:

1. Resolve the current step. If not simulated and `!amCanAdvance(owner)` → toast **"Not yours to complete"** / `"<step>" belongs to <role>.` and **abort**.
2. Read `#so-log-comment`. If not simulated and the field exists but is empty → toast **"A comment is required"** / "Add a note for this action before marking it done." focus the textarea, **abort**.
3. Capture `at = { stage, subNo }` **before anything moves** — notes belong to where the step happened, not to wherever the record lands.
4. Clear `breach`, stamp `updated` = today, reset `age = 0`.
5. If the step was a halt step, clear `halted` and `haltNote`. **Recompute the stage's step list afterwards** — dropping the halt removes a step, so the stage's last index is not what it was a line earlier.
6. If not the last step → `sub = idx + 1`. Else → advance to the next stage, `sub = 0`. **The stage is always a consequence of the steps underneath it and is never set directly.**
7. `soSkipAutoSteps(d)` — roll forward past any automated step, collecting labels. **Invariant: a record never rests on an automated step, because an automated step is not a task.** The sole exception is the terminal stage, where there is nothing after it to roll into. Guarded at 40 iterations.
8. Append log notes: the user's comment (`Note on "<step>"`), and — if a halt was cleared — a second entry `<step> cleared` / *"The run was halted here and has been released by \<actor\>."* A cleared halt earns its own line because the halt step vanishes from the derived trail the moment the flag drops; without it the record would carry no evidence it ever stopped, which is the one thing a reviewer wants to know.
9. Toast, then full re-render.

**Toasts:**
| Case | Title | Body |
|---|---|---|
| Stage changed | `Moved to "<stage short>"` | `<ref> · <store> is now at "<stage label>".` + automation suffix |
| Step advanced | `<step> — done` (or `Simulated — <step>`) | `<ref> · next up: <label>.` + automation suffix |
| Terminal | `All done` | `<store> is open on Bhaiyaa.` |

Automation suffix: `Automation ran: <labels joined by ", ">.`

**`soSimulateStep`** is the same call with `simulated = true`: it skips the permission check and the mandatory comment. The merchant and the two agents are the parties this portal cannot act as — simulating them is how a demo walks all four stages without a merchant on the other end of a signup link. Render it as a secondary/dashed control so it never competes with a real completion.

**`soRemindMerchant`** moves nothing. It writes a `reminder` log entry — owner Ops Manager, state `note`, note `Chased "<current step>".` — and toasts `Reminder sent` / `<merchant> · chased "<step>".` It is the evidence an Ops Manager needs when a signup has sat for a week.

**Seeding:** on load, `soRuns.forEach(soSkipAutoSteps)` so the invariant holds from the very first render. Halted records stop on their halt step and stay there — that is the point.

---

## 9. Logs — derivation model (do not persist a hand-kept trail)

`soRunLog(d)` returns `soExtraLog[d.id]` **concatenated in front of** a trail derived live from `stage + sub`. Nothing about the derived trail is stored. A hand-kept trail and a record position drift apart and then neither can be trusted.

Derivation:
- Walk stages up to and including the current one. For a past stage, take all its steps; for the current stage, take steps `0 … sub`.
- The last entry of the current stage is `state:'current'`; everything before is `state:'done'`. `breach` is set on the live entry only.
- Steps that do not apply to this record (an absent halt step) are simply not in `soSteps`, so they can never appear as things that happened.
- Timestamps are back-dated deterministically from `d.updated`: entry *i* of *n* is `amShiftDate(d.updated, (n-1-i) * 2)` — 2 days apart, hour `9 + (days % 8)`, minutes `(days * 7) % 60`.
- The derived list is then **reversed** → newest first.

`soExtraLog` entries (comments, halt-clears, reminders) are `unshift`ed, so they are always newest-first at the head. Their shape:

```js
{ stage, stageNo, subNo, sub:{label}, owner, ownerRole, state:'note',
  reminder?:true, date:'3 Aug 2026', time:'2:15 PM', note:'…' }
```

`soPushNote(d, label, note, at)` — `at` is where the note **belongs**, not where the record is standing when it is written, and the two are routinely different: a note on the last step of a stage is written by the same call that moves the record into the next one, so reading `d.stage` there would file it under a stage the step was never in. Callers that move nothing (a reminder) pass no `at` and get the current position, which for them is the same thing.

---

## 10. Seed data (12 records, `soRuns`)

| id | Ref | Store | Merchant | Role | Category | Band | City | Stage · sub | Days | Flags |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | STR-000112 | Sharma Kirana Mart | Ravi Sharma | seller | Grocery & Kirana | Micro — ₹20 lakh to ₹1 crore | Pune | Signup · 2 | 1 | |
| 2 | STR-000114 | Nandini Dairy Point | Meghana Rao | seller | Dairy & Bakery | Nano — under ₹20 lakh a year | Bengaluru | Signup · 2 | 2 | |
| 3 | STR-000108 | Green Leaf Vegetables | Imran Qureshi | seller | Fruits & Vegetables | Nano — under ₹20 lakh a year | Nagpur | Signup · 2 | 3 | |
| 4 | STR-000109 | Vasant Medico | Sneha Kulkarni | seller | Pharmacy & Wellness | Micro — ₹20 lakh to ₹1 crore | Pune | Signup · 2 | 6 | **breach** |
| 5 | STR-000110 | Bansal Hardware Depot | Naveen Bansal | seller ⚠️ | Hardware & Home Needs | Small — ₹1 crore to ₹5 crore | Indore | Signup · 2 | 2 | |
| 6 | STR-000111 | Anjali Stationers | Anjali Deshmukh | seller | Stationery & Books | Nano — under ₹20 lakh a year | Nashik | Signup · 2 | 4 | |
| 7 | STR-000104 | Rohit Mobile World | Rohit Kadam | seller | Electronics & Mobile | Small — ₹1 crore to ₹5 crore | Mumbai | KYC · 3 | 2 | **halted: kyc** |
| 8 | STR-000106 | Sagar Foods & Catering | Sagar Pawar | seller ⚠️ | Restaurant & Food Service | Medium — ₹5 crore to ₹50 crore | Pune | Creating · 3 | 1 | **halted: store-creation** |
| 9 | STR-000097 | Kaveri Textiles Outlet | Latha Menon | seller | Apparel & Footwear | Small — ₹1 crore to ₹5 crore | Coimbatore | Live · 1 | 3 | BHA-STR-0071 |
| 10 | STR-000099 | Mahalaxmi General Store | Prakash Jadhav | seller | General Store | Nano — under ₹20 lakh a year | Solapur | Live · 1 | 5 | BHA-STR-0073 |
| 11 | STR-000088 | Deccan Wholesale Buyers | Farhan Shaikh | seller ⚠️ | Grocery & Kirana | Medium — ₹5 crore to ₹50 crore | Hyderabad | Live · 2 | 12 | BHA-STR-0062 |
| 12 | STR-000091 | Sunrise Bakers | Neha Kulkarni | seller | Dairy & Bakery | Micro — ₹20 lakh to ₹1 crore | Thane | Live · 2 | 15 | BHA-STR-0065 |

*(Stage · sub shown as the position after the load-time auto-skip: records 1–6 are seeded at sub 0 on the automated "Signup issued" step and roll forward to "Signup completed"; records 9–10 are seeded at sub 0 and stay there because "Store details completed" is manual; 11–12 sit on the terminal automated step.)*

### The two halts — verbatim `haltNote`

- **STR-000104 · Rohit Mobile World** — *"UIDAI returned a different name for this Aadhaar. The owner name on the signup does not match the demographics on record."* → sits on **Mismatch review**, owned by **Compliance**. An Ops Manager sees it but **cannot** clear it.
- **STR-000106 · Sagar Foods & Catering** — *"Bhaiyaa rejected the registration. StoreIntake returned a duplicate GST number against this PAN, so no Bhaiyaa ref was issued."* → sits on **Registration retry**, owned by **Ops Manager**, button **Retry**. Note this record has **no `bhaiyaaRef`** — the drawer must show "Not issued yet".

`halted` stores the **stage id, not a boolean**. A boolean would make the retry step of Creating appear on a record that halted in KYC.

---

## 11. Responsive

| Breakpoint | Change |
|---|---|
| ≤1100px | `.am-seg-label` 10px · `.am-seg` pad 8/7/9 · `.am-seg-count` 17px |
| ≤880px | `.am-head` stacks (column, gap 14, stretch) · `.am-list-head` stacks (column, gap 10) |

The rail never scrolls horizontally at any width — `flex:1 1 0` + `min-width:0` guarantees fit by construction. A four-stage sequence whose last stage sits off-screen is not readable as a sequence, and no amount of scroll affordance fixes that.

---

## 12. Acceptance checklist

1. Rail reads **6 / 1 / 1 / 4** and the header reads **"12 store openings. 2 have stopped."**
2. Clicking a segment filters, re-titles the list, shows the SLA line and the **Show all** pill; clicking it again clears.
3. No record ever rests on an automated step except in the terminal stage.
4. A halted record shows the `halted` tag in the listing **and** the halt banner on all three drawer tabs.
5. On STR-000104 the Ops Manager sees **"Waiting on Compliance"** — no completion button and no way to clear it.
6. On STR-000106 the button reads **Retry**; completing it clears the halt, writes a `Registration retry cleared` log entry, rolls through the remaining automation and lands the record in **Live**.
7. Completing an owned step with an empty comment is blocked with the "A comment is required" toast.
8. `Send reminder` writes a `reminder` log entry and advances **nothing**.
9. Selecting a row hides MERCHANT and DAYS; column widths still sum to 100%.
10. Pagination shows `Showing 1–10 of 12 entries` and two pages.
11. Log order is newest-first, automated entries are credited to "AI Execution Layer", and the entry count in the header matches the rendered rows.
12. No hue on the board body outside the token set in §2.

---

## 13. Seller only — a buyer cannot create a store in our system

**Every store on this board is a seller.** The source is seller.bhaiyaa.com, which signs up sellers and nothing else. The role-picker screen that used to open the journey ("How will this store use Bhaiyaa?" — Seller or Buyer) has already been removed; `storeIntakeReset` hardcodes `storeIntakeRole = 'seller'` ([js/pages.js:7726](js/pages.js#L7726)) and creation stamps `role: 'seller'` ([js/pages.js:8133](js/pages.js#L8133)).

The board has **not** been brought in line with that yet. Outstanding, all of it pre-existing:

| Location | Currently | Should be |
|---|---|---|
| [js/core.js:946,950,954](js/core.js#L946) | seed records 5, 8 and 11 carry `role:'buyer'` (⚠️ in §10) | `role:'seller'` |
| [js/core.js:888](js/core.js#L888) | "switching on the storefront **or the ledger**" | "switching on the storefront" |
| [js/core.js:929](js/core.js#L929) | sub-step "**Storefront or ledger** opened" | "Storefront opened" |
| [js/pages.js:1036](js/pages.js#L1036) | `soRoleLabel` renders Buyer/Seller | a label with one possible value earns no space — drop it, or keep `Seller` as a constant |
| [js/pages.js:1256](js/pages.js#L1256) | "What this store does" branches on role | `Sells to customers`, unconditionally |
| [js/core.js:3781](js/core.js#L3781) | `bhaiyaaStoreRoles` defines a buyer option with purchase ledger and credit terms | dead config; still referenced at [js/pages.js:8264](js/pages.js#L8264), so remove together |

**Keep the `role` column and its `CHECK (role IN ('seller','buyer'))` constraint** in [backend/schema.sql:183](backend/schema.sql#L183). What was removed is the *question*, not the *column* — the field still reads correctly for anything already created, and dropping a column is the only part of this that is hard to undo. Retaining it costs one enum value and no UI.

Note record 8 (Sagar Foods & Catering) is one of the two **halted** records, so this is not cosmetic — it is a buyer sitting on a halt path that only sellers can reach.

---

## 14. KYC verification — the hand-off to the journey

The one flow that leaves this page. A record sitting on **Verification pending** is not completed
from the drawer: verification you can tick without reading the evidence is a rubber stamp with a
comment box. The button leaves for the journey's own KYC screen, where the details Bhaiyaa
returned are on screen and the four checks run in front of you.

### The loop

```
Board ─ row ─▶ Drawer ▸ Logs ─ [Verify KYC] ─▶ create-store · stage 2 (KYC)
                                                        │
                                    four checks run (~3.6s, storeRunKyc)
                                                        │
                                              [Accept the verification]
                                                        │
                                    "Details verified — this store is good to go"
                                                        │
                                              [Make this store live]
                                                        │
Board ◀── drawer reopens on Logs ──────────────── record now Live
```

### State

| Global | Meaning |
|---|---|
| `soKycRunId` | `null` = the KYC screen belongs to a **new signup**, CTA creates a store. An id = it belongs to **that board record**, CTA advances it. This flag is the entire difference between the two modes. |
| `soKycVerified` | Set by `soKycAccept`, swaps the CTA for the verified panel + go-live button. |

### Functions

| Function | Does |
|---|---|
| `soOpenKycVerification(runId)` | Loads `soBhaiyaaSignup[ref]` into `storeIntakeDraft`, sets `storeIntakeStep = 1`, navigates to `create-store`, runs `storeRunKyc()`. Sets `storeIntakeBackPage = 'dashboard'` — **the board is a dashboard tab, not a page**; `navigatePage('store-ops')` would 404 the router. |
| `soKycAccept()` | Writes the `KYC verified` log note with the evidence. **Moves nothing.** |
| `soKycMakeLive()` | Walks `soAdvanceStep(id, true, true)` until the record is in `store-live` **and** on its last step, mints a `bhaiyaaRef` if absent, writes `Store is live`, toasts once, returns. |
| `soKycReturnToBoard()` | Sets `soSelectedId` / `soRunTab='logs'` **before** the render, `dashboardTab='store-ops'`, then `navigatePage('dashboard')`. |

**Why `soKycAccept` must not advance:** completing the KYC step rolls straight through
store-creation's two automated steps and lands the record on `store-live`. If accept advanced,
the board would already say **Live** by the time the screen offered "Make this store live" — a
button reporting something that had already happened. Accept records, go-live moves.

**Why `soAdvanceStep` grew a third `quiet` parameter:** `soKycMakeLive` walks several steps in
one action. Without it the board repaints four times and stacks four toasts to report one thing.
`quiet` suppresses only the announcement — the writing is unchanged, and the caller toasts once
at the end.

### The verification is fictional; the data is real

The four checks (`bhaiyaaKycChecks`) always pass, and the UIDAI narration is invented — there is
no UIDAI integration. What is **not** invented is the subject: every field on that screen comes
from `soBhaiyaaSignup`, the table that stands in for the seller.bhaiyaa API response. Keep that
boundary. `soRuns` is our journey state — stage, step, halts — and none of it exists in Bhaiyaa;
`soBhaiyaaSignup` is the half we only ever read, and it is the table the real integration
replaces.

**Internal-only.** A fabricated "UIDAI returned…" is fine as demo narration on an internal board.
It must never be shown to a merchant or used to justify chasing one.

---

### Note on stale in-code comments
Comments in [js/core.js](js/core.js) around the store journey refer to **"five stages"** and **"twelve sub-steps"**. The shipped arrays contain **four stages and eleven sub-steps** (9 always-on + 2 conditional halts), and the rail in the current UI renders four segments. Build to the arrays, not the comments; the comments should be corrected in the same PR.
