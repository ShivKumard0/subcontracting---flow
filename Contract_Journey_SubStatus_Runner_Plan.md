# Sub-status runner for the automated Contract Creation journey

> **Status: planned, not started.** Written 2026-07-30. Nothing in this plan has been built —
> `aiCtRun`, `amSubEvidence`, `aiCtStageId`, `amSubStopKind` and `ai-ct-deposit` do not yet exist
> in the codebase. Execution is deferred until other in-flight changes land.
>
> **Changed underneath this plan (2026-07-31):** the nine-stage rail was converted from cards to
> the shared numbered dot rail (`buildAIJourneyBarHTML`), and the `.aicj-cards*` / `.aicj-card*`
> classes were deleted. References here have been repointed at `.aicj-bar` / `.aicj-dot`; the
> superseded note in the **UI** section explains what to re-derive.
>
> **Open decision blocking Phase 1:** the drawer placement — this plan recommends a drawer docked
> inside the rail card (`.aicj-bar`) instead of the right-hand column originally chosen. See
> *One correction to ask about before building* below.
>
> Companion engine design (function-by-function surface): `Contract_Journey_SubStatus_Runner_Engine.md`

## Context

The Contract Creation wizard shows nine client-facing stages and nothing underneath them. The operating model defines **41 admin sub-statuses** beneath those nine — who owns each, what it validates, what it produces — and all 41 are already encoded in `amSubStatuses` ([core.js:165](js/core.js#L165)) and rendered faithfully on the Account Manager pipeline board. The automated journey never touches that layer: it moves stage to stage on bare `setTimeout` calls, so a viewer sees a spinner and a new screen, with no evidence that anything was done.

This change makes the agent's work visible. Inside each stage the sub-statuses run in sequence, and every automated one shows what it is doing, which system it reached into and what came back, which rule it checked and the verdict, and the values it captured. The run halts **only** where a human is genuinely required — an approval that is ours to give, or a signature/payment we are waiting on from a client or worker.

The nine existing wizard pages, their content and their buttons all survive. The runner drives progression *within* a stage and, when the last sub-status clears, calls that stage's existing advance function instead of a blind timer. Where a stage already has a formal approval gate, **the runner shows no button of its own** — it halts and the page's existing Approve button is the affordance. Afterwards the wizard stops being a slideshow of success cards and becomes a live account of what the agent did, and the stage the operating model calls a hard payment gate (Deposit due) exists for the first time.

---

## Decisions locked

| Decision | Choice |
|---|---|
| Runner role | Drives within-stage progression; existing pages, buttons and flows preserved |
| Stop rule | By owner — halts for us (approvals/decisions), halts on them (client/worker/partner) |
| Deposit due | Added as a real stage with four sub-statuses, invoice card, payment-gate warning |
| Detail per automated step | Agent + skill.md link · system reached and what returned · rule and verdict · values captured · time vs SLA · the person behind the role · artifact produced · audit line written |
| Pace | Brisk — tiered cadence averaging ~1.2s/sub-status, ~50s for the whole journey |
| Visibility | All portal roles, marked `Internal` |

### One correction to ask about before building

You chose a **right-hand column beside the stage content**. The code makes that fail on stage 1, and the reason is concrete: `.ai-ct-split` ([main.css:1713](css/main.css#L1713)) is `display:flex; margin:0 -32px -28px; height:calc(100vh - 56px - 120px)` — a full-bleed, viewport-height, two-column layout with a *fixed* `flex:0 0 380px` chat column. A third column can only take width from the already-squeezed form column, and it would live inside a container with negative margins and its own height calc, so it would scroll independently of the rail it annotates.

**Recommended instead — the same intent, cheaper and it works everywhere:** a drawer **docked inside the existing rail card** (`.aicj-bar`, directly under the nine stage circles), plus a **takeover** presentation that appears only in the seams where the code already shows a blocking loader. Nothing is behind a click, so the "feel the agent working" requirement is preserved.

| | Docked | Takeover |
|---|---|---|
| Where | inside `.aicj-bar`, under the nine circles | inside `#aicj-inner`, replacing `aiShowLoader` |
| Height | ≤190px | the space the spinner already owned |
| When | page content is usable | stage-1 submit, stage-2 auto-advance, stage-3/4/6 approve |
| Cost | 1px border + 12px padding | nothing — it replaces a spinner |

Docking inside the existing card rather than adding a card of its own saves ~55px of pure chrome and makes the sub-steps visibly hang off the stage they belong to. At a 900px viewport the chrome above totals 372px, the drawer adds ~190px, leaving ~338px of page content above the fold — and every page below already scrolls today. **The runner lives in the seams the loaders already occupy:** no new vertical cost when page content matters, maximum theatre where the page was going to show a spinner anyway.

Clicking a completed stage circle swaps the drawer to that stage read-only with a "Back to live" link — history for free, zero vertical cost.

---

## What the user sees

**Running** — one moving thing on the page:

```
┌─ Steps inside "Deposit due" ────── Step 4 of 4 · ●Running ─┐
│  ▪▪▪▪  Invoice raised · Awaiting funds · Part-paid · Cleared│
│                                                             │
│  ◉  Cleared                          Finance · Meera Iyer   │
│     ● Matching the receipt against INV-100482…              │
│     ← Bank webhook · payment.cleared → 1 receipt ·          │
│       USD 9,500 · ref TXN-88301                             │
│     ✓ Deposit invoice must match a cleared receipt before   │
│       the hold lifts — PASSED                               │
│       Deposit Invoice  Amount Due  ▸Cleared On              │
└─────────────────────────────────────────────────────────────┘
```

**Halted on us** — all motion stops, orange left rule, focus moves to the button:

```
│  ◉  Pricing approval        ⚑ NEEDS YOU    Pricing · Karan Mehta │
│     Step 5 of 6 in "Quote in preparation" · off-standard margin  │
│     ┌ Karan Mehta · Pricing ──────────────── Your step ┐         │
│     [ Approve pricing ]                                           │
```

**Halted on them** — motion stops, no accent, no stolen focus, dashed button:

```
│  ○  Awaiting funds        Waiting on Client   Finance · gate     │
│     Step 2 of 4 in "Deposit due" · clears automatically when paid │
│     ┌ Client ─────────────────────────── Not your step ┐         │
│     [ ⌁ Simulate: Client pays the deposit ]                       │
│     Send the client a reminder instead                            │
```

Stillness is the primary signal: the page has exactly one moving thing while the agent works, so when it stops, something wants a human. That reads faster than any badge. The accent and the focus move are reserved for *on us* — waiting on a client is not your emergency. This mirrors the fill-weight argument am-pipeline.css already makes at line 164: solid black is "you can finish this", outlined is "you can only nudge someone else".

---

## The classification — all 41 sub-statuses

`AUTO` runs and shows its work · `US` halts for this user · `THEM` halts on a third party with a Simulate button · `GATE` halts with **no runner button** because the page already has one.

### 1 · New request — `request-received` — AI Prompt Parser
| Sub-status | Owner | Kind | Reaches | Validates | Captures |
|---|---|---|---|---|---|
| New intake | Account Manager | AUTO | NewForce Solutions · `EmployeeIntake` | Prompt resolves to client + country + type | Client, Contract Type, Country |
| CSM assigned | Account Manager | AUTO · 1h | Executive Layer | Owner has capacity in this entity | Owner (Arjun Vaidya) |
| Qualified / Rejected | Account Manager | **US** | — | — | Qualification decision |

### 2 · Quote in preparation — `quote-prep` — AI Compliance Hub Sync
| Sub-status | Owner | Kind | Reaches | Validates | Captures |
|---|---|---|---|---|---|
| Country data check | EOR Ops | AUTO *full* | Compliance Hub · Rates & Rules | Country configured and owned | Country Rules |
| Partner cost requested | EOR Ops | **THEM** · cond, non-owned · 48h | partner | — | Partner cost |
| Cost calc built | EOR Ops | AUTO *full* · 24h | Executive Layer | Cost build resolves against country rates | Cost Build, Margin % |
| Statutory floor check | Compliance | AUTO *full* | Compliance Hub | Offered rate ≥ Minimum Wage EUR 14.71 (NL, Active) | Statutory set, floor result |
| Pricing approval | Pricing | **US** · cond, if off-standard | — | — | Approver, timestamp |
| Quote QA | Pricing | AUTO *brief* | Executive Layer | Quote complete and internally consistent | QA result |

### 3 · Quote sent — `quote-review` — AI Contract Assistant
| Sub-status | Owner | Kind | Notes |
|---|---|---|---|
| Sent | Account Manager | AUTO *brief* | Captures Billing Rate, Pay Rate, Margin %, Compliance Checklist |
| Viewed | Client | **THEM** | Viewed timestamp |
| Follow-up 1 / 2 / 3 | Account Manager | AUTO *stamp* · can repeat | Cadence not exhausted |
| Change requested | Client | **THEM** (decision) | Requested change |
| Re-issued v2 | Account Manager | AUTO *stamp* · can repeat | Quote version |

### 4 · Quote accepted — `quote-approved` — existing Deal Manager gate
| Sub-status | Owner | Kind | Notes |
|---|---|---|---|
| *(gate)* Deal Manager approval | Deal Manager | **GATE** | Existing screen, [pages.js:10660](js/pages.js#L10660), Karan Mehta |
| Won | Account Manager | AUTO *stamp* | Accepted terms match the sent quote |
| Client tenant provisioned | System | AUTO *brief* | NFAdmin — real `cfgSystems` record, stamp is clickable |
| CSM confirmed to client | Account Manager | AUTO *stamp* · Same day | Confirmation dispatched |

### 5 · Client signing — `agreement-signature` — AI + Docuseal
| Sub-status | Owner | Kind | Notes |
|---|---|---|---|
| MSA drafted | Compliance | AUTO *brief* | Fields auto-filled from the accepted quote |
| Legal & compliance review | Compliance | **US** · 48h | Reviewer, outcome |
| Client entity + sanctions check | Compliance | AUTO *full* | NFAdmin `EntityRegistry` + `ComplianceFiling` |
| Sent | Compliance | AUTO *brief* | Docuseal — envelope created |
| Signed | Client | **THEM** | Signed timestamp |

### 6 · Deposit due — `deposit-due` — **new stage** — Finance · payment gate
| Sub-status | Owner | Kind | Notes |
|---|---|---|---|
| Invoice raised | Finance | AUTO *full* | SAP `API_GLACCOUNTLINEITEM`; Deposit Invoice, Amount Due |
| Awaiting funds | Client | **THEM** | "Simulate: Client pays the deposit" |
| Part-paid | Client | **THEM** · decision, cond | Skips on the paid-in-full path, with the reason shown |
| Cleared | Finance | AUTO *full* · Auto on webhook | Receipt matched against the invoice; Cleared On |

### 7 · Worker signing — `employment-contract` — existing Ops Manager gate
The model puts **Internal approval before Sent to worker**; today the wizard sends first and approves last. Following the model is the better flow — nothing reaches the worker before we approve it.

| Sub-status | Owner | Kind | Notes |
|---|---|---|---|
| Draft generated | EOR Ops | AUTO *brief* · 24h to issue | Generated from the signed agreement |
| Clause compliance check | Compliance | AUTO *full* | Clauses match country requirements |
| Internal approval | EOR Ops | **GATE** | The existing Ops Manager screen, [pages.js:10680](js/pages.js#L10680) |
| Sent to worker | EOR Ops | AUTO *stamp* | Docuseal envelope delivered |
| Worker signed | Worker | **THEM** | `rec.signedAt` is really set at [pages.js:10823](js/pages.js#L10823) |
| ADT countersigned | EOR Ops | AUTO *brief* | Countersignature confirmed |

### 8 · Onboarding — `onboarding` — AI Onboarding Engine — all AUTO
The existing three-step timeline ([pages.js:10835](js/pages.js#L10835)) becomes six, and its three rich detail bodies ([pages.js:10868](js/pages.js#L10868)) are **kept verbatim and re-keyed by label** — deleting them would be a regression against this very ask.

| Sub-status | Body | Evidence |
|---|---|---|
| Worker KYC | new | ID + match confidence + sanctions screen, reusing `.ea-req-row` |
| Documents *(n/n)* | **existing `…StepDetailHTML(0)`** | its 5 doc rows drive the "4 / 5 verified" counter the `cond` asks for |
| Tax registration | new | `supportPageMeta.compliance` rows where Category = Income Tax — *Bracket 1 · 35.75% · **Inactive*** is a genuinely interesting verdict |
| Social security enrolment | **existing `…StepDetailHTML(1)`** | the `aiH2rCountryData` grid + three Social Security rows |
| Bank verified | new | masked `••••4821` from `agentRunMockFields(d,8)` + name-match |
| Payroll configured | **existing `…StepDetailHTML(2)`** | four provisioned systems |

### 9 · Working — `active` — AI Payroll Readiness Check — all AUTO
*Ready for payroll* (bank, tax and compensation mapping present) · *First payroll run* (per payroll calendar) · *Active*.

**Totals — 29 automated, 4 human decisions + 2 formal gates, 7 external waits** (2 of which skip on the default path). No new approval screens: both existing gates are absorbed.

---

## Data

Everything above is grounded in data that already exists:

- `aiH2rCountryData` ([core.js:64](js/core.js#L64)) — real `rateRules` / `statutory` / `taxBand` for all seven countries
- `supportPageMeta.compliance` ([core.js:489](js/core.js#L489)) — the seven real Netherlands rule rows, with Active/Inactive status
- `agentRunMockFields` ([pages.js:9351](js/pages.js#L9351)) — captured values already authored for stage indices 0, 1, 2, 4, 5, 7, 8
- `aiJourneyEvents['contract-creation'][i].validation` / `.source` / `.fields` ([core.js:1753](js/core.js#L1753))
- `amOwnerDirectory` ([core.js:230](js/core.js#L230)) — the person behind each role
- `amStageSla` ([pages.js:630](js/pages.js#L630)) plus per-sub-step `sla` on `amSubStatuses`
- Voice: match `AGENT_RUN_SETUP_ACTIVITIES` / `AGENT_RUN_JOURNEY_ACTIVITIES` ([pages.js:9243](js/pages.js#L9243)) exactly

**New in js/core.js**, additive — `amSubStatuses` stays the sole source of label/owner/sla/cond/decision/loop:

```js
function aiCtStageId(i){return (amPipelineStages[i]||{}).id;}   // after amSubSteps (243)

const amSubEvidence={                                            // after amSubStatuses (225)
  'quote-prep/Country data check':{
    weight:'full', agent:'AI Compliance Hub Sync',
    systemLabel:'Compliance Hub',          // named in copy, no cfgSystems record
    doing:'Resolving the statutory rule set for {country}',
    fetch:'Rates & Rules — {country}',
    rows:function(ctx){return supportPageMeta.compliance.rows;},
    rule:'Every rule the country requires must be present, and Active for {type}.',
    capture:{'Country Rules':'{country} statutory set resolved'}
  },
  'quote-approved/Client tenant provisioned':{
    weight:'brief', systemId:'nfadmin',    // IS a cfgSystems record — stamp is clickable
    capture:{'Tenant ID':'TN-{seq}','Bound To':'{proposalId}'}
  }, …
};
function amSubEvidenceFor(stageId,label){…}                      // mirrors amSubSteps (243)
function amSubStopKind(stageId,step,ctx){…}                      // after amCanAdvance (246)
```

`amSubStopKind` derives the halt from the owner column — no new flags on the operating-model data:

```
owner Client|Worker                              -> 'them'
step.decision, or one of the four named approvals -> 'us'
step.cond and !ctx.applies(step)                  -> 'skip'
stage has a formal gate page at this sub-step     -> 'gate'
otherwise                                         -> 'auto'
```

**Compliance Hub and Docuseal.** Both are named constantly and neither is a `cfgSystems` record ([core.js:1813](js/core.js#L1813)). **Do not invent records.** A descriptor carries either `systemId` (real record → clickable into `cfg-system-detail`, can quote a real `apiList` entry) or `systemLabel` alone → `.aicj-run-src.unlinked` renders the name without an endpoint and resolves through the agent instead: *"Compliance Hub — via **AI Compliance Hub Sync**"*, where the agent chip opens a real skill.md. The user always has somewhere true to go. Promoting the two to `cfgSystems` later would make them link like every other — worth doing, but not required by this change.

**Audit.** Each completed sub-status writes one line to `ctLogsData[contractId]` (`{date,time,user,status,action}`) and `ctWorkflowData[contractId]` (`{title,user,date,time,description}`) via `aiFormatNow()`, the shape used at [core.js:2412](js/core.js#L2412). Both persist ([core.js:2208](js/core.js#L2208)), so the trail survives reload, and the demo-reset purge ([core.js:2243](js/core.js#L2243)) already clears simulated runs.

**Run state** — one module-level object in js/core.js beside the other wizard-transient globals, deliberately **not** persisted:

```js
aiCtRun={
  token:1,                 // generation counter; every scheduled timer captures it
  stage:1, sub:0, phase:'announce',
  halt:null,               // null | {kind:'us'|'them'|'gate', step, owner}
  log:[],                  // append-only evidence rows — survives every re-render
  captured:{}, lastFilled:null, activity:null,
  speed:1, paused:false,
  timer:null,              // the ONE outstanding setTimeout
  handoff:false, onStageDone:null
}
```

---

## Engine

All in js/pages.js, one block above `buildAIContractJourneyBarHTML` ([pages.js:9793](js/pages.js#L9793)).

| Group | Functions |
|---|---|
| Lifecycle | `aiCtRunEnsure(stage)` *(the only entry point, idempotent)* · `aiCtRunStartStage(stage,onDone)` · `aiCtRunSuspend()` · `aiCtRunSeed(stage,uptoIdx)` |
| Clock | `aiCtRunSchedule(fn,ms)` *(the only setTimeout in the engine)* · `aiCtRunKick()` |
| Phases | `aiCtRunPhase(next)` · `aiCtRunStepDone()` · `aiCtRunHandoff()` |
| Halts | `aiCtRunHalt(kind,step)` · `aiCtRunResume()` · `aiCtRunSimulate()` · `aiCtRunResumeGate(stage)` |
| Controls | `aiCtRunSpeed(mult)` · `aiCtRunPause()` · `aiCtRunSkipToHalt()` |
| Render | `aiCtRunRender()` · `buildAICtRunDrawerHTML()` · `aiCtRunLiveCardHTML()` · `aiCtRunSubListHTML()` · `aiCtRunEvidenceHTML()` · `aiCtRunSystemRowHTML()` |
| New surfaces | `buildAICtDepositHTML()` · `aiCtDepositRelease()` · `aiCtOnboardingComplete()` |

**Five beats per automated sub-status**, each landing in space already reserved so nothing below moves. Timings are the existing vocabulary, not invented: 750ms is `agentRunTickActivities` ([pages.js:9296](js/pages.js#L9296)), 420ms is `agentRunRevealFields` ([pages.js:9317](js/pages.js#L9317)), 600ms is the inter-step gap ([pages.js:9401](js/pages.js#L9401)).

| Beat | At | Appears | Class |
|---|---|---|---|
| announce | 0 | step name, owner, agent chip, pulsing activity line | `.agrun-activity` + `.agrun-activity-dot` |
| fetch | +750 | the system reached and what came back | `.aicj-run-src` |
| validate | +750 | the rule and the verdict | `.aicj-run-rule` + `.ai-chip-validation` |
| capture | +750, then 420 each | values one at a time, newest flashing | `.agrun-kv-row` / `.just-filled` |
| done | +600 | collapses to `.aicj-sub.done` + one-line summary | |

**Beats 2 and 3 are skipped, not faked**, when a sub-status has no system call or no rule. A step that invents a fetch to look busy destroys the exact feeling this change exists to create.

**Tiered cadence** keeps the whole journey to ~50s: `full` (all five beats, ~3.0s) for the nine steps carrying the best evidence, `brief` (~1.4s) for ~14, `stamp` (one line, 0.6s) for the rest. Conditional skips render as a 400ms "not applicable, because…" row — itself evidence of the agent reasoning. `prefers-reduced-motion` drops everything to `stamp`; the codebase already honours it at [main.css:1740](css/main.css#L1740).

**Three controls in the drawer head, no more:** 1×/4× fast-forward, Pause/Resume (a viewer wants to *read* a verdict; a panel that cannot be stopped is hostile), and Skip to the next stop — which resolves the remaining auto steps synchronously and still writes every evidence row, so nothing is hidden. Deliberately **not** offered: a global "skip the journey" — the nine pages are the product.

### Re-entrancy

**R1 — zero run state in the DOM.** Every render is a pure function of `aiCtRun` + `page`.

**R2 — one scheduler, three guards, clears before it sets:**

```js
function aiCtRunSchedule(fn,ms){
  const r=aiCtRun;if(!r)return;
  if(r.timer)clearTimeout(r.timer);            // two calls can never leave two timers alive
  const token=r.token, expect=page;
  r.timer=setTimeout(function(){
    if(!aiCtRun||aiCtRun!==r||aiCtRun.token!==token)return;  // identity + generation
    if(page!==expect)return;                                 // location — as aiScheduleAutoAdvance 10451
    r.timer=null; fn();
  },Math.max(80,ms/(r.speed||1)));
}
```

**R3 — the dispatcher arms, it does not start.** `aiCtRunEnsure` re-renders and kicks if the run is already on this stage, else starts one. `aiCtRunKick()` re-arms only when `timer===null`, so a re-render mid-tick does nothing.

**R4 — the drawer re-renders itself, not the page.** `aiCtRunRender()` writes `innerHTML` on `#aicj-run` only and **never calls `renderADTPage()`**. This is load-bearing: a tick must not re-run `initAICtChatPanel` ([pages.js:10284](js/pages.js#L10284)) or `focusFlowPrimaryField`, or it would steal the caret from a form the user is typing in. `agentRunTickActivities` already works this way.

**R5 — leaving suspends, returning resumes, restarting invalidates.** `navigatePage` ([core.js:984](js/core.js#L984)) calls `aiCtRunSuspend()` — same precedent as the poll stop at core.js:989. Returning re-arms from the stored phase. Re-entering at a different stage bumps `token`, so stragglers fail the generation guard by construction. Reload discards the run; nothing of record is lost because its consequences are written by the existing advance functions it calls.

### Timer reconciliation

Rule: a `setTimeout` that exists only to pace a **stage transition** is replaced by the runner's completion callback; one pacing something else is kept. No transition ever gets two owners.

| Stage | Existing timer | Verdict |
|---|---|---|
| 0 New request | `aiCtRunSearch` 1700ms ([9981](js/pages.js#L9981)) | **KEPT** — paces the ADT lookup skeleton, not a transition |
| 1 Quote in prep | `aiSubmitAssistedContract` 2000ms ([10446](js/pages.js#L10446)) | **REPLACED** — body kept, the timeout becomes the runner's callback |
| 2 Quote sent | `aiScheduleAutoAdvance(…,1300)` ([renderer.js:7](js/renderer.js#L7)) | **REPLACED** by `aiCtRunEnsure(2)` |
| 2 Quote sent | `aiSendProposalForApproval` 2000ms ([10621](js/pages.js#L10621)) | **KEPT** — this *is* the advance function the runner calls |
| 3 Quote accepted | `aiSimulateApproval` 2000ms ([11471](js/pages.js#L11471)) | **WRAPPED** — `aiCtRunResumeGate(3)` at the top; the 2000ms becomes the runner's callback so *Won* / *tenant provisioned* / *CSM confirmed* are actually seen |
| 4 Client signing | `aiSendContractForApproval` 1500+2200ms ([10815](js/pages.js#L10815)) | **REPLACED** — this chain already *is* two sub-statuses (Sent, Signed); its inner `page=` at [10830](js/pages.js#L10830) now targets the deposit page |
| 5 Deposit due | none | **NEW** — runner-native; `aiCtDepositRelease` is the advance |
| 6 Worker signing | `aiSimulateContractApproval` 2000ms ([10706](js/pages.js#L10706)) | **WRAPPED** — `aiCtRunResumeGate(6)`; the tail is untouched |
| 7 Onboarding | `aiCtRunOnboardingStep` 3200ms/step ([10859](js/pages.js#L10859)) | **REPLACED** — loop deleted, along with its full page rebuild every 3.2s |
| 8 Working | none | — |

Stage handoff is a table beside `AI_CT_STAGE_TO_MANUAL_STEP` ([pages.js:9679](js/pages.js#L9679)): `{2:aiSendProposalForApproval, 5:aiCtDepositRelease, 7:aiCtOnboardingComplete}`, everything else `null` meaning "the stage ends on a human action that already exists — do not invent a second way to leave the page".

### Stage 1, in detail

The six `quote-prep` sub-statuses price a quote that does not exist until the form is complete, so they run **after Submit, not during**. While the form is being filled the drawer is `.aicj-run.compact` — one 44px line, "Quote in preparation · 6 steps queued" — because stage 1's page content *is already an agent narrating* (the chat slot-filling `AI_CT_FIELDS`) and two voices means neither is heard.

**One honest exception:** *Country data check* is resolvable the moment the country field lands, so `aiCtApplyFieldAnswer` ([pages.js:10159](js/pages.js#L10159)) fires it opportunistically — the drawer shows the Compliance Hub reach and the seven real Netherlands rows arriving *while the user keeps typing*. That is the best "the agent is doing it" moment in the journey and it is truthful.

On submit the runner takes over the space `aiShowLoader` owned and runs the six at full size — strictly more information for the same dwell.

---

## The Deposit due stage — checklist

| Hook | Change |
|---|---|
| Page id / builder | `ai-ct-deposit` · `buildAICtDepositHTML()` beside [pages.js:10796](js/pages.js#L10796) |
| [pages.js:9698](js/pages.js#L9698) | `if(page==='ai-ct-deposit')return 5;` |
| [pages.js:9711](js/pages.js#L9711) | add to `isAIContractWizardPage` |
| [renderer.js:1](js/renderer.js#L1) | dispatch branch + `aiCtRunEnsure(5)` |
| [pages.js:9679](js/pages.js#L9679) | `{1:1,2:2,3:3,4:5,5:5,6:6,7:8,8:9}`; the comment at [9677](js/pages.js#L9677) is now wrong and must be rewritten |
| **[pages.js:10830](js/pages.js#L10830)** | **`page='ai-contract-awaiting-signature'` → `page='ai-ct-deposit'`** — this is the line that currently jumps 4→6 |
| `aiCtDepositRelease()` | → `page='ai-contract-awaiting-signature'` — stage 6 is reached by exactly the line that used to fire early |
| [renderer.js:112](js/renderer.js#L112) | `'ai-ct-deposit'` into `noAddPages` |
| [core.js:502](js/core.js#L502) / [:506](js/core.js#L506) | title `Deposit Invoice`, parent `contracts` |

Content: invoice card (`INV-…` and $9,500 from `agentRunMockFields(d,5)`, already authored) plus the payment-gate warning drawn from the stage's own words — `deposit-due` already carries `gate:true` and *"No hire can start until that money arrives"* ([core.js:141](js/core.js#L141)).

---

## UI

**Reused verbatim, no new equivalents built** — `.am-sb-next{.do|.wait}` · `.am-sb-next-kicker/-step/-meta` · `.am-sb-owner{.mine}` · `.am-sb-advance` · `.am-sb-simulate` · `.am-sb-chase-link` · `.am-sb-steps` · `.am-sb-step{.done|.current|.upcoming}` · `.am-sub-cond` · `.am-sub-tag` · `.agrun-activity` + `-dot` · `.agrun-kv-row` + `.just-filled` · `.agrun-live-badge` · `.ai-chip*` via `aiChipsCompact` · `.aicj-agent-badge` via `aiAgentBadgeHTML` · `.ai-timeline*` and `.agrun-body/-timeline-col/-details-col` (takeover only). **am-pipeline.css is loaded globally** ([index.html:15](index.html#L15)), so `.am-sb-*` is already available on wizard pages and that file is never edited.

**New, `aicj-` family only** — `.aicj-run{.running|.halt-us|.halt-them|.exception|.compact}` · `-head/-head-title/-head-meta` · `.aicj-run-flag{.us|.them}` · `.aicj-run-speed` · `.aicj-subs` · `.aicj-sub{.done|.current|.upcoming|.failed}` · `-rule/-name/-owner` · `.aicj-run-live` · `.aicj-run-src{.unlinked}` · `.aicj-run-rule` + `-verdict{.pass|.fail}` · `.aicj-run-sum`.

`.aicj-subs / .aicj-sub / .aicj-sub-rule / .aicj-sub-name` are named as the exact parallel of the stage rail's `.aicj-bar-scroll / .aicj-step / .aicj-dot / .aicj-step-label` — **one shape, two scales**, so a user learns the rail once at stage level and reads it again at sub-status level without a legend.

> **Superseded (2026-07-31):** this section originally drew the parallel against the nine-stage *card* rail (`.aicj-cards-row / .aicj-card / …`). That rail has since been replaced by the shared numbered dot rail every other journey uses, and the card classes were deleted. The sub-status row should now echo the **dot** vocabulary — a small numbered/ticked circle plus a label, at sub-status scale — rather than a miniature card. Re-check this section against `.aicj-dot` ([main.css:1646](css/main.css#L1646)) before building Phase 1.

**Density** — default and current stage only: the pip row, the live row, and one-line summaries of completed steps. One click away: full evidence of a completed step, the "all n steps" list, a done stage's history. Never live: the raw rule table. The orange accent is allowed in exactly two places — the running pip's rule and the halted-on-us left rule. Everything else is monochrome.

**Accessibility** — the drawer is `role="region"` with `aria-live="polite"` while running; a halt-on-us switches to `assertive` once and moves focus to its button. A failed step turns the pip red, keeps its detail expanded and stops the run.

---

## Phases

Each leaves the app working and demoable.

1. **Data + skeleton.** `aiCtStageId`, `amSubEvidence` (all 41), `amSubEvidenceFor`, `amSubStopKind`, `aiCtRun`. Drawer renders the pip row and sub-list read-only from `amSubSteps`, no timers. *js/core.js, js/pages.js, css/main.css, js/renderer.js.* Check: every stage shows the right sub-statuses with the right owners; nothing moves.
2. **The engine.** Scheduler, phase machine, evidence rendering, halts, handoff table — wired for stages 2, 3, 8 only (the simplest). *js/pages.js, js/renderer.js.* Check: stage 2 runs and hands off; back-navigation mid-run suspends and resumes cleanly.
3. **The gates.** Stages 3, 4, 6 — `aiCtRunResumeGate`, timer reconciliation, no duplicate buttons. *js/pages.js.* Check: each gate's existing Approve button is still the only one, and clearing it runs the remaining sub-statuses.
4. **Deposit due.** The new stage and its ten call sites. *js/core.js, js/pages.js, js/renderer.js, css/main.css.* Check: 4 → 5 → 6 in order; the rail's sixth card is finally live.
5. **Stages 1 and 7.** Compact-then-takeover, the opportunistic country check; onboarding 3 → 6 keeping the three existing detail bodies. *js/pages.js.* Check: typing in the form is never interrupted; onboarding detail cards still render.
6. **Polish.** Audit lines, time-vs-SLA, artifact chips, controls, reduced motion, screen-reader pass. *js/pages.js, css/main.css.*

---

## Verification

Browser: Contracts → **+** → EOR → *Simulate: Existing Employee*, then walk all nine stages. At each, confirm the sub-statuses match the tables above; that automated steps show system, verdict and captures and **keep them after completing**; that the run halts at exactly the four decisions, two gates and seven waits and nowhere else; that gates show no runner button; and that typing during stage 1 is never interrupted. Then open the contract in Contracts and confirm Logs and Workflow carry the trail. Finally, hit Back mid-run and return — the run must resume, not restart or double-fire.

Markup without a browser: the harness proven in this session — load `js/exec-config.js`, `js/execApi.js`, `js/core.js`, `js/pages.js`, `js/renderer.js` into a `vm` context with a stubbed `document` / `localStorage` / `fetch`, poke state with `vm.runInContext` (the scripts' `let` bindings are lexical and cannot be set through the context object), then call the builders and assert on the HTML string.

---

## Risks

- **Two timers for one transition** — mitigated by the reconciliation table and by `aiCtRunSchedule` being the engine's only `setTimeout`, clearing before it sets.
- **Caret theft on stage 1** — mitigated by `aiCtRunRender()` writing only `#aicj-run` and never calling `renderADTPage()`.
- **AM board regression** — mitigated by `amSubEvidence` being a parallel map; `amSubStatuses` objects are never mutated.
- **Stage-index drift from inserting stage 5** — ten call sites listed above; `aiCtSyncLinkedRun` ([pages.js:9683](js/pages.js#L9683)) and `agentRunMockFields` both key off the same indices and must be re-checked together.
- **Audit volume** — a full run writes ~30 log lines per contract. Acceptable as a trail, but worth watching in the Logs tab; the demo-reset purge already stops it accumulating across runs.
- **41 evidence descriptors is the real cost** — the bulk of the work is authoring, not engineering. Phase 1 exists to get them all in and reviewable before any of the engine depends on them.
