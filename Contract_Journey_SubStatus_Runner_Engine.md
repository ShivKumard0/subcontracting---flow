# Runner Engine — AI Contract Creation sub-status layer

Design only. No files edited. All 41 sub-statuses run visibly on top of the nine existing wizard
pages; every existing page, button and transition function survives.

---

## 0. The one mapping that makes this cheap

`aiJourneyEvents['contract-creation']` (core.js:1753) and `amPipelineStages` (core.js:135) are the
same nine stages in the same order. So the stage↔stage bridge is one line, not a table:

```js
function aiCtStageId(i){return (amPipelineStages[i]||{}).id;}   // core.js, after amSubSteps (243)
```

Everything else keys off `amSubSteps(aiCtStageId(stage))` — the existing accessor, the existing
store. No parallel step list is created.

---

## 1. Function surface

### core.js — state + data (beside the stores they extend)

| Function / const | Placed | Purpose |
|---|---|---|
| `let aiCtRun=null;` | beside core.js:14 wizard globals | the entire run state; transient, not persisted |
| `function aiCtStageId(i)` | after core.js:243 | stage index → amPipelineStages id |
| `const amSubEvidence={…}` | after `amSubStatuses` core.js:225 | 41 descriptors keyed `'<stageId>/<label>'` |
| `function amSubEvidenceFor(stageId,label)` | after `amSubEvidence` | accessor, mirrors `amSubSteps` (243) |
| `function amSubStopKind(stageId,step,ctx)` | after `amCanAdvance` core.js:246 | `'auto'｜'us'｜'them'｜'gate'｜'skip'` |
| `const AI_CT_RUN_CADENCE={full,brief,stamp}` | with the above | per-phase ms by weight |

`amSubEvidence` is additive, not a fork: `amSubStatuses` stays the sole source of label/owner/sla/
cond/decision/loop, and the evidence table only adds what the demo must *show*.

```js
const amSubEvidence={
  'quote-prep/Country data check':{
    weight:'full', agent:'AI Compliance Hub Sync',
    systemLabel:'Compliance Hub',            // named in copy, NOT a cfgSystems record — see §1a
    doing:'Resolving the statutory rule set for {country}',
    fetch:'Rates & Rules — {country}',
    rows:function(ctx){return supportPageMeta.compliance.rows;},   // the 7 real NL rows
    rule:'Every rule the country requires must be present, and each must be Active for {type}.',
    verdict:function(rows){/* 3 Active / 4 Inactive-not-applicable-to-EOR */},
    capture:{'Country Rules':'{country} statutory set resolved'}
  },
  'quote-approved/Client tenant provisioned':{
    weight:'brief', agent:null, systemId:'nfadmin',   // IS a cfgSystems record (core.js:1813)
    doing:'Provisioning the client tenant', fetch:'NFAdmin · tenant create',
    rule:'Tenant id must be unique and bound to the signed engagement.',
    capture:{'Tenant ID':'TN-{seq}','Bound To':'{proposalId}'}
  },
  …
};
```

**§1a — the two systems that are named but not records.** "Compliance Hub" and "Docuseal" are
quoted constantly in copy but are absent from `cfgSystems` (core.js:1813). The descriptor therefore
carries **either** `systemId` (a real record → the evidence row renders a clickable stamp that opens
`cfg-system-detail`, and may quote a real `apiList` entry) **or** `systemLabel` alone (a named
integration with no record → same stamp, not clickable). The stamp itself reuses the one existing
"this came from system X" component rather than a second one:

```js
// pages.js:8904 today: adtSourceBadgeHTML(refId) — hardcoded to NewForce Solutions
function adtSourceBadgeHTML(refId,systemName){ … (systemName||'NewForce Solutions') … }
```
Backward-compatible added parameter; the existing call site (pages.js:8912) is untouched.

### pages.js — the engine (one block, just above the `CONTRACT CREATION — THE STAGE RAIL` comment)

*Anchor updated 2026-07-31: this used to say "just above `buildAIContractJourneyBarHTML` 9804".
That function was deleted when Contract Creation moved to the shared dot rail; the comment block
that replaced it marks the same spot.*

**Lifecycle**
- `aiCtRunStartStage(stage, onStageDone)` — `token++`, `sub=0`, `phase='announce'`, kick.
- `aiCtRunEnsure(stage)` — **idempotent** arm called from the dispatcher; the only entry point.
- `aiCtRunSuspend()` — clears the timer, keeps the run.
- `aiCtRunSeed(stage, uptoIdx)` — retro-fill sub-statuses that are already true on arrival.

**Clock (the only `setTimeout` in the engine)**
- `aiCtRunSchedule(fn, ms)`
- `aiCtRunKick()` — re-arms only if `timer===null && !paused && phase not in {halted,done}`.

**Phase machine**
- `aiCtRunPhase(next)` — set phase, append to `log`, render, schedule the next beat.
- `aiCtRunStepDone()` — write the done row; `sub++` and kick, or `aiCtRunHandoff()`.
- `aiCtRunHandoff()` — the "last sub-step cleared" branch (§2).

**Halts and resumption**
- `aiCtRunHalt(kind, step)`
- `aiCtRunResume()` — "Mark X done"; enforces `amCanAdvance` exactly as `amAdvanceStep` does (637–646).
- `aiCtRunSimulate()` — "Simulate: <person> …"; bypasses the gate and says so in the toast, mirroring
  `amAdvanceStep(id,true)` (646/651).
- `aiCtRunResumeGate(stage)` — called by the two existing approve functions so a formal gate clears
  the runner's halt without a second button existing anywhere.

**Controls**
- `aiCtRunSpeed(mult)` · `aiCtRunPause()` · `aiCtRunSkipToHalt()`

**Renderers** (all reuse existing classes; no new CSS beyond one `.am-sb-step.skipped` rule)
- `aiCtRunRender()` — writes `#aicj-sub`; no-ops if absent (same defensive shape as
  `renderAgentRunPanel` 9663). **Never calls `renderADTPage()`.**
- `buildAICtRunStripHTML()` — header + live card + sub list + evidence.
- `aiCtRunLiveCardHTML(r,step)` — `.am-sb-next{.do|.wait}` (777), `.am-sb-owner` (772),
  `.am-sb-advance` / `.am-sb-simulate` (768–769), verbatim.
- `aiCtRunSubListHTML(r,steps)` — `.am-sb-steps` / `.am-sb-step{.done|.current|.upcoming}` (786–802),
  verbatim, plus `.skipped` for a not-applicable conditional.
- `aiCtRunEvidenceHTML(r,step)` — the four blocks, built from `.agrun-activity` +
  `.agrun-activity-dot` (css 1764) and `.agrun-kv-row` + `.just-filled` (css 1801–1806).
- `aiCtRunSystemRowHTML(ev)` — the source stamp.

**New stage-5 surface**
- `buildAICtDepositHTML()` · `aiCtDepositRelease()`

**Stage-7 changes** (detail in §5)
- `aiCtOnboardingSteps` (10835) 3 → 6 entries, each gaining a `sub` label key.
- `aiCtOnboardingStepDetailHTML(key,rec)` (10868) re-keyed by label; the three existing bodies kept.
- `aiCtRunOnboardingStep` (10848) **deleted**; `aiCtStartOnboarding` (10840) becomes a call to
  `aiCtRunStartStage(7)`.
- `aiCtOnboardingComplete()` — **new**, holding the tail currently inside `aiCtRunOnboardingStep`
  (10850–10857). This is what lets `AI_CT_STAGE_ADVANCE[7]` point at existing behaviour, not a timer.
- `buildAICtOnboardingTimelineHTML` (10900) kept; reads `aiCtRun.sub` instead of `aiCtOnboardingStep`.

### renderer.js + small edits elsewhere — wiring only

| File:line | Change |
|---|---|
| renderer.js:1–13 | append `aiCtRunEnsure(n)` to each wizard branch; add the `ai-ct-deposit` branch |
| renderer.js:55 | inject `<div id="aicj-sub"></div>` before `#aicj-inner`; call `aiCtRunRender()` after dispatch |
| renderer.js:114 | add `'ai-ct-deposit'` to `noAddPages` |
| core.js:984 `navigatePage` | `if(!isAIContractWizardPage(resolved))aiCtRunSuspend();` — same precedent as the poll stop at core.js:989 |
| core.js:502 / :506 | `ai-ct-deposit` → title `Deposit Invoice`, parent `contracts` |
| pages.js:9698 / :9711 / :9679 | stage 5 registration (§6) |

`pageRoleMap` (core.js:963) needs no change — unlisted pages are open to all roles (core.js:981).

---

## 2. State machine

### Run state — all of it, outside the DOM

```js
aiCtRun={
  token:1,        // generation counter; every scheduled timer captures it
  stage:1,        // 0..8
  sub:0,          // index into amSubSteps(aiCtStageId(stage))
  phase:'announce',
  halt:null,      // null | {kind:'us'|'them'|'gate', step, owner}
  log:[],         // append-only evidence rows — survives every re-render
  captured:{}, lastFilled:null, activity:null,
  speed:1, paused:false,
  timer:null,     // the ONE outstanding setTimeout id
  handoff:false,  // stage advance fired exactly once
  onStageDone:null
}
```

### The five phases of one auto sub-step

| Phase | What renders | Source |
|---|---|---|
| `announce` | `.agrun-activity` + pulsing dot: "Country data check — starting" | `amSubStatuses` label |
| `fetch` | "Reading **Rates & Rules** from **Compliance Hub**…" + the source stamp | `ev.systemId` / `ev.systemLabel`, `cfgSystems.apiList` |
| `return` | the payload: real rows (Compliance Hub table), or a `cfgModels` identity/mapped block | `supportPageMeta.compliance` (core.js:489), `cfgModels` (1874) |
| `validate` | the rule sentence + a PASS/FAIL `.ai-chip-validation` | `ev.rule` / `ev.verdict`, backed by `aiJourneyEvents[i].validation` |
| `capture` | fields revealed 380 ms apart, newest flashing `.just-filled` | `ev.capture`, seeded from `agentRunMockFields` (9351) |

The reveal cadence is the existing one — `agentRunRevealFields` (9303) sets `d.lastFilled` and ticks
420 ms; the runner does the same against `aiCtRun.lastFilled`. `agentRunTickActivities` (9288) is the
model for `announce`/`fetch`.

### Halting

`amSubStopKind(stageId, step, ctx)` derives the stop from the owner column exactly as the product
owner specified — no new flags on the data:

```
owner Client|Worker                                    -> 'them'
step.decision, or label in the four named approvals    -> 'us'
step.cond and !ctx.applies(step)                       -> 'skip'   (renders "not applicable, because…")
stage has a formal gate page at this sub-step          -> 'gate'
otherwise                                              -> 'auto'
```

- `'us'` → `.am-sb-next.do` + `.am-sb-advance` "Mark X done" when `amCanAdvance(owner)`, else
  `.am-sb-next.wait` + `.am-sb-simulate` "Simulate: Kavya Iyer completes this".
- `'them'` → always `.am-sb-simulate` "Simulate: Client views the quote".
- `'gate'` → **no runner button at all.** The runner halts and the page's own existing Approve
  button is the affordance. This is how the hard constraint is honoured.
- `'skip'` → 400 ms row, `.am-sb-step.skipped`, with the reason ("We own the entity in Netherlands,
  so no partner cost is needed" / "Margin is 20%, standard — no pricing approval needed").

### Resumption and stage handoff

```js
const AI_CT_STAGE_ADVANCE={           // pages.js, beside AI_CT_STAGE_TO_MANUAL_STEP (9679)
  0:null,                             // aiCtUseEmployee / aiCtUseManualEntry already route
  1:null,                             // the user's Submit is the advance
  2:aiSendProposalForApproval,        // existing fn, unchanged (10608)
  3:null,                             // aiSimulateApproval is the gate button (11471)
  4:null,                             // aiContractDocApprove -> aiSendContractForApproval (10752/10804)
  5:aiCtDepositRelease,               // NEW
  6:null,                             // aiSimulateContractApproval is the gate button (10706)
  7:aiCtOnboardingComplete,           // NEW name for the existing tail at 10850-10857
  8:null                              // terminal
};
```

`aiCtRunHandoff()`: if `handoff` already true, return. Set it. If the table holds a function, call it
— that function owns the page transition, as it does today. If `null`, halt: the stage ends on a
human action that already exists, and the runner must not invent a second way to leave the page.

---

## 3. Re-entrancy across `renderADTPage()`

Five rules, and together they are the whole answer.

**R1 — zero run state in the DOM.** Every render is a pure function of `aiCtRun` + `page`.
`renderADTPage()` (renderer.js:108) can fire at any moment and the strip comes back byte-identical.

**R2 — one scheduler, three guards, and it clears before it sets.**

```js
function aiCtRunSchedule(fn,ms){
  const r=aiCtRun;if(!r)return;
  if(r.timer)clearTimeout(r.timer);          // two calls can never leave two timers alive
  const token=r.token, expect=page;
  r.timer=setTimeout(function(){
    if(!aiCtRun||aiCtRun!==r||aiCtRun.token!==token)return;  // run replaced or torn down
    if(page!==expect)return;                                 // prior art: aiScheduleAutoAdvance 10451
    r.timer=null;
    fn();
  },Math.max(80,ms/(r.speed||1)));
}
```

Identity guard, generation guard, location guard. The third is lifted verbatim from
`aiScheduleAutoAdvance` (pages.js:10449–10452).

**R3 — the dispatcher arms, it does not start.** One added line per wizard branch in
`dispatchAIContractWizardPage` (renderer.js:1):

```js
function aiCtRunEnsure(stage){
  if(aiCtRun&&aiCtRun.stage===stage){aiCtRunRender();aiCtRunKick();return;}
  aiCtRunStartStage(stage);
}
```
`aiCtRunKick()` re-arms **only** when `timer===null`. So a re-render landing mid-tick does nothing
at all; a re-render landing after a dropped timer resumes from the recorded phase. This is the same
shape as the existing `aiScheduleAutoAdvance` call at renderer.js:7, which is also re-issued on
every render of its page and is safe for the same reason.

**R4 — the strip re-renders itself, not the page.** `aiCtRunRender()` writes `innerHTML` on
`#aicj-sub` only. A phase tick therefore does **not** re-run `initAICtChatPanel` (10284), does not
re-run `focusFlowPrimaryField` (renderer.js:190), and does not steal the caret from a form the user
is typing in — which a `renderADTPage()`-per-tick runner absolutely would. `agentRunTickActivities`
already works this way (it writes `#form-col`, 9294); this is the same principle.
`renderPageContentImpl` rebuilds `.aicj-wrap` and so destroys `#aicj-sub`, which is why
`aiCtRunRender()` is called immediately after the dispatch at renderer.js:56.

**R5 — leaving suspends, returning resumes, restarting invalidates.**
- Back / sidebar / any navigation → `navigatePage` (core.js:984) calls `aiCtRunSuspend()`, which
  clears the timer and sets `timer=null` but keeps the run. Precedent: the poll stop at core.js:989.
- Returning → `aiCtRunEnsure(sameStage)` → `aiCtRunKick()` re-arms from the stored phase. Nothing
  is lost and nothing double-fires, because the only timer was already cleared.
- Re-entering at a *different* stage → `aiCtRunStartStage` bumps `token`, so any straggler callback
  fails the generation guard by construction.
- Reload → `aiCtRun` is deliberately **not** added to `persistAppState` (core.js:2208); it joins the
  other wizard-transient globals (core.js:11–18). A half-run must not resume against a rebuilt DOM.
  Nothing of record is lost, because the run's consequences (contract status, `ctLogsData`,
  `manualJourneyRuns`) are written by the existing advance functions the runner *calls*.

---

## 4. Timer reconciliation

**Governing rule:** a `setTimeout` that exists only to pace a **stage transition** is replaced by the
runner's completion callback. A `setTimeout` that paces something which is *not* a stage transition
(a lookup skeleton, a chat typing indicator) is kept. Applied uniformly, no transition ever has two
owners.

| Stage | Existing timer | Verdict | Note |
|---|---|---|---|
| 0 New request | `aiCtRunSearch` 1700 ms (9981) | **KEPT** | Paces the ADT lookup skeleton, not a transition. The runner walks *New intake* + *CSM assigned* beside it, writing a different subtree and different state. Two timers, but never for the same transition. |
| 1 Quote in prep | `aiSubmitAssistedContract` 2000 ms (10446) | **REPLACED** | Everything up to `aiShowLoader` kept; the `setTimeout` becomes `aiCtRunStartStage(1, …)`'s callback, which then does the existing `page='ai-proposal-created';renderADTPage()`. |
| 2 Quote sent | `aiScheduleAutoAdvance(…,1300)` renderer.js:7 | **REPLACED** | Becomes `aiCtRunEnsure(2)` on the same line. |
| 2 Quote sent | `aiSendProposalForApproval` 2000 ms (10621) | **KEPT** | This is the stage-2 advance function the runner *calls*; its internal timer is the transition, and there is exactly one. |
| 3 Quote accepted | `aiSimulateApproval` 2000 ms (11471) | **WRAPPED / REPLACED** | Add `aiCtRunResumeGate(3)` at the top; the 2000 ms becomes the runner's callback so *Client tenant provisioned* and *CSM confirmed to client* are actually seen. Body and page transition untouched. |
| 4 Client signing | `aiSendContractForApproval` 1500 + 2200 ms (10815/10817) | **REPLACED** | This chain already *is* two sub-statuses: the 1500 ms "Sending for Signature" = **Sent**, the 2200 ms "Awaiting Client Signature… simulating the Docuseal link" = **Signed**. The runner gives each evidence and makes the second a halt. Its inner `page=` (10830) now targets `ai-ct-deposit`. |
| 5 Deposit due | none | **NEW** | Runner-native; `aiCtDepositRelease` is the advance. |
| 6 Worker signing | `aiSimulateContractApproval` 2000 ms (10706) | **WRAPPED / REPLACED** | `aiCtRunResumeGate(6)` at the top; the 2000 ms becomes the runner's callback so *Sent to worker*, *Worker signed*, *ADT countersigned* clear inside it. The existing `page='ai-onboarding-run'` + `aiCtStartOnboarding()` (10721) is untouched. |
| 7 Onboarding | `aiCtRunOnboardingStep` 3200 ms/step (10859) | **REPLACED** | Whole loop deleted; the generic runner drives six sub-statuses. Its `navigatePage('ai-onboarding-run')` per step (10861) — a full page rebuild every 3.2 s — goes away with it. |
| 8 Working | none | — | Runner walks three sub-statuses, then stops. `ai-journey-complete` stays terminal. |

Never two timers racing: stage 0's two timers drive disjoint state; every other stage has exactly
one owner of its transition.

---

## 5. The two awkward stages

### Stage 1 — a human-driven form whose six sub-statuses are back-office pricing

**When they run.** After Submit, not during. Five of the six price a quote that does not exist until
the form is complete; running them earlier would be theatre.

**One honest exception.** `Country data check` is resolvable the moment the *country* field lands.
So `aiCtApplyFieldAnswer` (10159) fires it opportunistically when `field.key==='country'` — the
strip shows the Compliance Hub reach and the seven real Netherlands rows arriving *while the user
keeps typing*, which is the single best "the agent is doing it" moment in the journey and it is
truthful. Everything else waits.

**What the user sees while typing.** The strip under the rail lists all six as `.upcoming` with the
head caption "Runs when you submit", `Country data check` flipping to done mid-form. When the last
field lands, `aiCtAskNextField` (10142) adds one line to its existing "All the required details are
filled in" message: *"When you submit I'll price it — partner cost, cost build, statutory floor,
pricing approval and QA."* Promise, then delivery. The chat panel, the form, `AI_CT_FIELDS`, the
upload-to-autofill path and `aiSubmitAssistedContract`'s record-writing body are all untouched.

**After Submit.** `aiShowLoader` (10445) is replaced by the runner strip — strictly more information
for roughly the same dwell — and the six run: *Country data check* (already done, shown as such),
*Partner cost requested* (`skip`: we own the entity in Netherlands/Germany/India), *Cost calc built*
(full), *Statutory floor check* (full, against `supportPageMeta.compliance` Minimum Wage EUR 14.71),
*Pricing approval* (`skip`: margin is 20%, standard — the condition is `if off-standard`, so the
skip **is** the decision, and off-standard data makes it a real halt), *Quote QA* (brief).

### Stage 7 — three rich steps vs six sub-statuses: **EXTEND**

Replacing `aiCtOnboardingStepDetailHTML` (10868) would delete the best "show me the detail" content
already in the repo — a regression against the very ask. So the three existing bodies are kept
verbatim and three are added; the function is re-keyed by sub-status label so the mapping is
explicit rather than positional.

| Sub-status (core.js:212) | Body | Evidence source |
|---|---|---|
| Worker KYC | **new** | ID + match confidence + sanctions/PEP screen; reuses `.ea-req-row` from the existing docs body |
| Documents `n/n per country` | **existing `aiCtOnboardingStepDetailHTML(0)` verbatim** | its 5 doc rows also drive the live "4 / 5 verified" counter the `cond` asks for |
| Tax registration | **new** | `supportPageMeta.compliance` rows where Category = `Income Tax` — *Income Tax Bracket 1 · 35.75% · **Inactive*** is a genuinely interesting validation result |
| Social security enrolment | **existing `aiCtOnboardingStepDetailHTML(1)` verbatim** | the `aiH2rCountryData` grid, plus the three `Social Security` rows (2.74% Active / 6.27% Inactive / 0.50% Inactive) |
| Bank verified | **new** | masked account `••••4821` from `agentRunMockFields(d,8)` 'Bank Details' + a name-match result |
| Payroll configured | **existing `aiCtOnboardingStepDetailHTML(2)` verbatim** | the four provisioned systems |

`buildAICtOnboardingTimelineHTML` (10900) is kept — it is already the `.ai-timeline` +
`run-done/run-current/run-pending` renderer the runner wants; it just reads `aiCtRun.sub`. The six
steps now get announce/fetch/validate/capture phases instead of one flat spinner each.

### Stage 6, worth stating

`ai-contract-awaiting-signature`'s copy asserts the worker has already signed. Operating-model order
is preserved without touching that copy: *Draft generated* and *Clause compliance check* run inside
`aiCtDepositRelease`'s loader; the runner then halts on *Internal approval*, whose affordance is the
page's own existing Approve button; on approve, *Sent to worker* and *Worker signed* clear
instantly with evidence phrased as **received facts** ("Docuseal envelope DS-… delivered",
"countersigned {rec.signedAt}" — `rec.signedAt` is really set at 10823), then *ADT countersigned*
runs. Uses the same `aiCtRunSeed` mechanism as stage 0's intake. Zero copy changes.

---

## 6. The new Deposit due stage

| Hook | Value |
|---|---|
| Page id | `ai-ct-deposit` |
| Builder | `buildAICtDepositHTML()` (pages.js, beside `buildAIContractDocumentHTML` 10796) |
| `aiCtJourneyStage()` 9698 | `if(page==='ai-ct-deposit')return 5;` — inserted between the `ai-contract-document` and `ai-contract-awaiting-signature` lines |
| `isAIContractWizardPage()` 9711 | `||pg==='ai-ct-deposit'` |
| `dispatchAIContractWizardPage` renderer.js:1 | `if(page==='ai-ct-deposit'){el.innerHTML=buildAICtDepositHTML();aiCtRunEnsure(5);return;}` between lines 9 and 10 |
| `AI_CT_STAGE_TO_MANUAL_STEP` 9679 | `{1:1,2:2,3:3,4:5,5:5,6:6,7:8,8:9}` — 5 maps to 5. The manual catalog has no deposit step and the map is explicitly monotonic "at least this far" (comment at 9673–9678), so this holds the linked run rather than jumping it. The comment at 9677 ("Stage 5 has no page of its own") is now wrong and must be rewritten. |
| Routes to it | **`aiSendContractForApproval` (pages.js:10804)** — its inner `page='ai-contract-awaiting-signature'` at **line 10830** becomes `page='ai-ct-deposit'`. This is the function that currently jumps 4 → 6. |
| Leaves it | `aiCtDepositRelease()` → `page='ai-contract-awaiting-signature';renderADTPage()` — i.e. stage 6 is reached by exactly the line that used to fire early |
| Also | `noAddPages` renderer.js:114; `getPageMeta` core.js:502 (`Deposit Invoice` / `Contracts`); `getSidebarActivePage` core.js:506 (→ `contracts`) |

**Page content.** Finance-owned, four sub-statuses. An invoice card (`INV-…` from
`agentRunMockFields(d,5)`, Amount Due $9,500) and a payment-gate warning drawn from the stage's own
words — `amPipelineStages` `deposit-due` carries `gate:true` and *"No hire can start until that
money arrives"* (core.js:141). Run: *Invoice raised* (auto, full), *Awaiting funds* (halt, Client,
"Simulate: Client pays the deposit"), *Part-paid* (decision, `skip` on the paid-in-full path with
the reason shown), *Cleared* (auto, `sla:'Auto on webhook'` — rendered as a webhook receipt).

---

## 7. Speed and control

**Budget.** 41 sub-statuses = 30 auto, 4 named approvals + 2 formal gates = 6 stops for us, 7 waits
on them (2 of which skip on the default path). At a flat five-phase cadence that is ~90 s of
automated motion — too long. Three levers bring it to **~50 s across the whole journey, ~6 s per
stage**:

- **Tiered cadence.** Each descriptor carries `weight`. `full` (all five phases, ~3.0 s) for the 9
  that carry the best evidence — Country data check, Cost calc built, Statutory floor check, Client
  entity + sanctions check, Invoice raised, Clause compliance check, Worker KYC, Tax registration,
  Payroll configured. `brief` (announce + validate + capture, ~1.4 s) for ~14. `stamp` (one line,
  0.6 s) for the rest. → 9×3.0 + 14×1.4 + 7×0.6 ≈ **51 s**.
- **Conditional skips** remove two steps on the default path, each as a 400 ms "not applicable,
  because…" row — which is itself evidence of the agent reasoning, not a shortcut.
- **`prefers-reduced-motion`** drops everything to `stamp` and disables the pulse. The codebase
  already honours this at css/main.css:1740.

**Controls — three, in the strip header, no more.**

- **1× / 4× fast-forward** (`aiCtRunSpeed`). Divides every delay; skips nothing. The one a demo
  actually uses on the second run-through.
- **Pause / Resume** (`aiCtRunPause`). The whole point is that a viewer wants to *read* a validation
  result; a panel that cannot be stopped is hostile.
- **Skip to the next stop** (`aiCtRunSkipToHalt`). Resolves the stage's remaining auto sub-steps
  synchronously, writing every evidence row to `aiCtRun.log`, and lands on the next halt. Nothing is
  hidden — the completed rows are all there to expand.

**Deliberately not offered:** a global "skip the journey". The nine pages are the product; a global
skip would make them unreachable. Skipping *forward through work* is what the halts' existing
Simulate buttons already do, one decision at a time, with a name attached.
