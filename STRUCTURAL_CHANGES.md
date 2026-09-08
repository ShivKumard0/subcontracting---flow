# Structural Changes — execution log

A running specification of changes to this repo. Nothing here is executed automatically.
Each item is written so it can be picked up and carried out later, on its own, without
needing the conversation it came from.

**Status legend** — `PENDING` not started · `IN PROGRESS` partially applied ·
`APPLIED` done and verified · `PARKED` deliberately deferred · `DROPPED` decided against.

**How items are written.** Every item carries the same seven headings. If a heading has
nothing under it, it says so rather than being omitted — an absent "Verification" reads as
"none needed", which is rarely true.

```
### SC-NN · <short title>
**Status:** …
**Ask:** the request, in the sender's own terms.
**Scope:** which files / surfaces are in, and which are explicitly out.
**Change:** what actually gets done, precisely enough to execute.
**Why:** the reasoning, so a future reader can disagree with it on the merits.
**Verification:** how we know it worked.
**Open questions:** anything that must be decided before this can be executed.
```

---

## 0 · Execution order

**The build order for SC-04 → SC-16.** Sequenced so that each task is unblocked when it is
reached, nothing is done twice, and the cheap certain work lands before the expensive open work.
Sections 2 and 3 hold the detail; this section holds the order and nothing else.

**Task type** — how much risk each carries:

| Type | Means | Risk |
|---|---|---|
| `COPY` | a string changes, no logic touched | none |
| `RENDER` | markup or CSS, no logic touched | visual only |
| `LOGIC` | changes what a click does | real — needs a decision first |
| `STORE` | changes data shape or what is saved | real — affects reload and other surfaces |

**Rule for every wave:** finish the wave, then run
`node test/run-all.js` **and** `sha256sum -c .ccjv1-lock` before starting the next.
Never carry a red suite into the following wave — the next wave's failures become
indistinguishable from this one's.

---

### Wave 0 · The one prerequisite — do this first, alone — ✅ `APPLIED`

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 1 | Guard the `why` renderer so a missing or empty `why` emits **no element at all** | `RENDER` | [contract-journey.js:3250](js/contract-journey.js#L3250) | ✅ done |
| 1b | Hold the card's spacing when the `why` is gone | `RENDER` | [contract-journey.css:679](css/contract-journey.css#L679) | ✅ done |

Unblocks tasks 2, 3 and 4. **Tasks 2, 3 and 4 are now safe to run.**

**Task 1b was not in the original plan.** Measuring the card with its `why` removed showed the gap
between the bold question and the owner row collapsing from **30px to 5px** — the two lines read as
one. Added `.ccj-gate-ask+.ccj-gate-who{margin-top:11px}`, an adjacent-sibling rule that only
applies when nothing sits between them, so a gate that still has a `why` is untouched.

> **Note for anyone tuning that value.** It is the whole gap, not an addition to the question's
> existing 5px: adjacent siblings collapse their vertical margins to the larger of the two. Written
> as `6px` first, which measured 6px rather than 11px.

**Verified:** 10 browser checks — normal gate unchanged (30px), `why` deleted → no `undefined` and
no element (11px), `why:''` → byte-identical output to deleted, stopped-state card still draws its
own hardcoded line. Mutation-tested: restoring the unguarded line fails 4 of the 10, printing
`undefined` on the deleted path and leaving a 9px phantom gap on the blank path. Suites 950 + 8 +
46 green; `.ccjv1-lock` OK.

---

### Wave 1 · Copy only — no decisions, no behaviour, fastest wins

**Decided:** the slot is emptied, not refilled. The bold `ask` already says what to decide; a grey
line restating it is what made the card read as a walkthrough of itself.

| # | Task | Type | Where | SC | Status |
|---|---|---|---|---|---|
| 2 | Delete `why` — *"Nothing is costed or quoted…"* | `COPY` | [contract-journey.js:1565](js/contract-journey.js#L1565) | SC-04A | ✅ done |
| 3 | Delete `why` — *"The client sees these numbers…"* | `COPY` | [contract-journey.js:1580](js/contract-journey.js#L1580) | SC-05A | ✅ done |
| 4 | Delete `why` — *"Nothing is sent until legal has read it…"* | `COPY` | [contract-journey.js:1596](js/contract-journey.js#L1596) | SC-09A | ✅ done |

> **A rule was written into `CCJ_GATES` alongside these three**, so the next person adding a gate
> does not reintroduce the problem: `why` is optional and most gates should not have one. Add it
> only where it carries a **fact the `ask` cannot** — an amount outstanding, a clause that failed,
> a consequence being accepted. That is the line separating the three deleted here from the three
> rephrased in tasks 5-8, which all carry real facts.

**Verified (tasks 2-4):** 27 browser checks — for each of the three gates: property off the object,
sentence absent from the rendered card, no element emitted, no `undefined`, 11px spacing, both
buttons intact. Plus five checks that the gates *keeping* a `why` are untouched (Part-paid,
Internal approval, ADT countersign, the MSA post-gate, and the fallbacks). Plus the live stage-1
card driven end to end through a real run, not a fabricated one. Suites 950 + 8 + 46 green;
`.ccjv1-lock` OK.
| 5 | Rephrase Part-paid `why` in plain language | `COPY` | [contract-journey.js:6089](js/contract-journey.js#L6089) | SC-11 | ✅ done |
| 6 | **Fix the verb-agreement bug** — *"1 clause **were** rewritten"* | `COPY` | [contract-journey.js:6714](js/contract-journey.js#L6714) | SC-12A | ✅ done |
| 7 | Rephrase Internal approval `why` — **all three branches** | `COPY` | [contract-journey.js:6711-6717](js/contract-journey.js#L6711) | SC-12A | ✅ done |
| 8 | Rephrase ADT countersign `why` | `COPY` | [contract-journey.js:6737](js/contract-journey.js#L6737) | SC-13A | ✅ done |
| 8b | **Match the stage-5 countersign twin** — not in the original plan | `COPY` | [contract-journey.js:1637](js/contract-journey.js#L1637) | SC-10A | ✅ done |
| 9 | Rewrite the harness assertion to pin the new copy | `COPY` | [test/ccj-harness.js:2288](test/ccj-harness.js#L2288) | CC-4 | ✅ done |

**WAVE 1 COMPLETE.** Every sentence flagged is gone or rewritten, one real grammar bug is fixed,
and **no behaviour changed at all** — this is the whole of the "makes it look like a demo"
complaint, closed.

#### What each card says now

| Where | Was | Is |
|---|---|---|
| Part-paid | *"No placement may start until the deposit is settled. Releasing early accepts the payroll exposure the deposit exists to cover, and is recorded against this run."* | *"Work cannot start until this is paid. If you release it anyway, we cover the payroll and your approval is recorded."* |
| Internal approval · failed | *"2 clauses failed the statutory check and cannot be issued as drafted."* | *"2 clauses do not meet local law. This cannot be issued as it stands."* |
| Internal approval · adjusted | *"**1 clause were rewritten** to meet local law — … The employee signs whatever this says, and we carry the employment liability."* | *"1 clause was changed to meet local law: probationary period."* |
| Internal approval · clean | *"Nothing needed adjusting. The employee signs whatever this says…"* | *"No clauses needed changing for local law."* |
| ADT countersign (step 7) | *"The employee has signed and returned it. Ours is the second signature and the contract is in force from it — this is the last point at which we can decline."* | *"The employee has signed. Your signature makes the contract live."* |
| MSA countersign (step 5) | *"The client has signed and returned it. Ours is the second signature, and the agreement is in force…"* | *"The client has signed. Your signature makes the agreement live."* |

> **Task 8b was added during execution.** The two countersign cards ask the identical question of
> the identical person — one about the client agreement, one about the employment contract.
> Rewriting only the flagged one would have left the demo speaking in two voices on the same
> action. They are now the same sentence with the party and document swapped.

**Verified (tasks 5-9):** 50 browser checks across three scripts. All three Internal approval
branches forced and read back (singular *was*, plural *were*, failed, clean); the two countersign
cards proved identical in shape by substitution; a banned-phrase sweep over what the four cards
**say** — not their source, which names the retired phrases in comments explaining why they went.
Suites 952 + 8 + 46 (two new assertions added, none deleted); `.ccjv1-lock` OK.

---

### Wave 2 · Independent of everything else — ✅ `APPLIED`

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 10 | Add `amDeals` **and `amExtraLog`** to the `persistAppState()` payload | `STORE` | [core.js:3153](js/core.js#L3153) | ✅ done |
| 11 | Restore both in `loadAppState()` | `STORE` | [core.js:3181](js/core.js#L3181) | ✅ done |
| 12 | Comment why these are included where `masterData` is excluded | `COPY` | beside task 10 | ✅ done |
| 13 | Persist and **validate** the user's position — filter, open record, tab, page | `STORE` | [core.js:3183-3199](js/core.js#L3183) | ✅ done |

> **`amExtraLog` was missing from this plan and would have been missed.** Advancing a record writes
> to two stores, not one: `amDeals` holds where the engagement has reached, `amExtraLog`
> ([core.js:800](js/core.js#L800)) holds the comment typed to move it there and every reminder
> sent. Saving only the first moves a record to step 4 and loses the note that justified it —
> **mutation-tested and confirmed**: progress survives, the note and the reminder disappear.

**Restored position is validated, never trusted.** Saved state describes a session that has ended;
the records, the stage list and the tab names all move underneath it between releases. So an
unknown filter is dropped, a selection whose record no longer exists is discarded, an unrecognised
tab falls back, and a stored page is clamped to the range the current filter actually has.

> **Mutation-tested, and the result is the reason it is written this way.** With the guards
> replaced by naive assignment, a stale saved filter opens the dashboard on **0 of 19 rows** —
> under a header still reading "You are looking after 19 pieces of work". Not a crash. Just a
> screen that is indistinguishable from having lost every record.

**Verified:** 17 browser checks, every one across a genuine page reload — progress, typed note and
reminder all survive; filter, open record and tab all return; all four stale-state guards hold; the
dashboard still renders; and the other nine persisted stores are undisturbed.

---

### Wave 3 · The rename — ✅ `APPLIED` *(D1 = full rename, everywhere)*

**17 occurrences swept.** The product now says *Reject* on every surface a person can read, and
nothing anywhere still says *Disqualify* except two comments that quote the retired string while
explaining why it went — which is history, and correct.

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 13 | Button caption, `done:'Rejected'`, and the stop-card title | `COPY` | [contract-journey.js:1584](js/contract-journey.js#L1584) | ✅ done |
| 14 | Option id `disqualified` → `rejected`, and its branch | `LOGIC` | `:1584`, `:2002` | ✅ done |
| 15 | Sub-status name `'Qualified / Rejected'` | `COPY` | [core.js:190](js/core.js#L190) | ✅ done |
| 16 | The **compound key**, both sites, in lockstep | `STORE` | [contract-journey.js:1500](js/contract-journey.js#L1500), `:1574` | ✅ done |
| 17 | Prose naming the step, and three stale comments | `COPY` | [core.js:183](js/core.js#L183), `:309`, `contract-journey.js:1588`, `:3272`, `:3282` | ✅ done |
| 18 | Harness assertion, section title, driven call | `COPY` | [test/ccj-harness.js:1075](test/ccj-harness.js#L1075) | ✅ done |
| 19 | The runner plan doc | `COPY` | `Contract_Journey_SubStatus_Runner_Plan.md:108` | ✅ done |

> **The sub-status string was the reason this needed deciding.** It is simultaneously the card's
> own header, the "WHERE IT IS NOW" column on the Account Manager dashboard, **and** the compound
> key (`stage-id/sub-status`) that resolves the gate, its ask and its halt text. Renaming the
> button alone would have left the header one inch above it reading *Disqualified*, and the
> dashboard listing the step under a name the product no longer uses.

**A new assertion guards it.** [test/ccj-harness.js:1079](test/ccj-harness.js#L1079) now checks the
retired word appears **nowhere** on the card. A half-finished rename does not fail anything — it
just leaves the old word somewhere — so absence is the only thing worth asserting.

**Verified:** 12 browser checks — the AM dashboard lists *Qualified / Rejected* and still renders
its rows (proving the key resolves); the live card's button, header and transcript are clean; and
deciding it produces *"Request rejected"*, *"Rejected by …"*, with the reason recorded. Suites
953 + 8 + 46; `.ccjv1-lock` OK.

---

### Wave 4 · Negative decisions — ✅ `APPLIED` *(done ahead of wave 3, which is still blocked on D1)*

**Decided:** a reason is required on **every** negative decision · each terminal stop names its own
decision · everything reopens · a send-back carries its reason into the conversation.

**Scope grew from six buttons to nine.** The plan listed the six that had been seen on screen.
Sweeping `tone:'stop'` found three more, two of them behind conditional gates that only exist in
particular run states — a sanctions **Escalate** and a KYC **Reject**, which are arguably the two
you would least want unexplained. **Release anyway** was the ninth, and the only one that already
recorded anything (who released, how much was short); it is the shape the other eight now follow.

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 17 | `reason` as an optional 2nd argument to `ccjChooseGate` — no reason ⇒ ask, reason ⇒ act | `LOGIC` | [contract-journey.js:1948](js/contract-journey.js#L1948) | ✅ done |
| 18 | The ask, drawn in the card itself; blank refused; Cancel restores the gate untouched | `RENDER` | [contract-journey.js:3253](js/contract-journey.js#L3253) | ✅ done |
| 19 | `ccjConfirmStop` / `ccjCancelStop`; `run.stopAsk` state | `LOGIC` | [contract-journey.js:1975](js/contract-journey.js#L1975) | ✅ done |
| 20 | Reason stored on the decision **and** on the stop record | `STORE` | `:1981` | ✅ done |
| 21 | **Bug:** stopped card said *"Request disqualified"* for all four terminal decisions | `RENDER` | [contract-journey.js:3243](js/contract-journey.js#L3243) | ✅ done |
| 22 | `stop:{title,note}` authored per terminal option | `COPY` | 4 options | ✅ done |
| 23 | Send-back message carries the reason | `COPY` | `:2100` | ✅ done |
| 24 | `ccjReopen` clears `stop` and `stopAsk` | `LOGIC` | `:1993` | ✅ done |
| 25 | Reasons added at 7 harness call sites | `COPY` | [test/ccj-harness.js](test/ccj-harness.js) | ✅ done |

> **The bug in task 21 was real and shipping.** `ccjGateHTML`'s stopped branch held one hardcoded
> sentence — *"Request disqualified. No further steps ran."* — rendered for **every** terminal
> decision. Declining an employment contract in stage 7 therefore reported itself in stage 1's
> intake vocabulary. Each decision now carries its own: *Request disqualified* · *Escalated to
> Compliance* · *Agreement declined* · *Contract declined*.

> **One entry point, deliberately.** The reason is a second argument to the existing handler rather
> than a separate confirm-only path. Two entry points into nine branches is how one branch ends up
> skipping the record — and the branch that quietly skips it is the one nobody notices until
> someone asks why an engagement was killed. Asserted: the guard exists exactly once, and every
> negative option carries `tone:'stop'`, so none can route around it.

**Verified:** 24 browser checks driven through the real card — the ask appears and decides nothing;
a blank reason is refused; Cancel restores the gate byte-for-byte; a given reason reaches both the
card and the stored decision; reopen leaves no stale stop record; all four terminal wordings differ;
a send-back loops and carries its reason. Suites 952 + 8 + 46; `.ccjv1-lock` OK.

---

### Wave 5 · Layout — ✅ `APPLIED`

**The rule:** ordinary chat convention — *"whatever we are doing in usual chat, our side actions
come on the right side and the 2nd person everything comes on the left"*. Anything waiting on you
sits right at `--ccj-act-w` (62%); anything the journey reports stays left or full-width.

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 23 | `--ccj-act-w` — one width for both action surfaces | `RENDER` | [contract-journey.css:673](css/contract-journey.css#L673) | ✅ done |
| 24 | The waiting-on-you **step block** moves right | `RENDER` | [contract-journey.css:512](css/contract-journey.css#L512) | ✅ done |
| 25 | Ask blocks ("Continue to contract details") move right | `RENDER` | [contract-journey.css:606](css/contract-journey.css#L606) | ✅ done |
| 26 | Rename my `.ccj-gate.asking` → `.reason-ask` (name collision) | `RENDER` | [contract-journey.js:3331](js/contract-journey.js#L3331) | ✅ done |

> **Two mistakes on the way, both caught by measuring rather than reading.**
> 1. Setting `margin-left:auto` on `.ccj-gate` moved nothing. `.ccj-sb .ccj-gate` is more specific
>    and is where the margin actually comes from — a rule I had assumed was a sidebar context.
> 2. Moving the gate alone looked **worse**: the step block stayed full width, leaving a wide amber
>    panel mostly empty with a card in its corner. The unit a reader sees is the whole block, so
>    the whole block moves. `asking` was already on it, meaning exactly "this one is yours".

**The risk was checked before shipping:** narrowing to 62% could cramp a gate block that also
carries evidence rows. Drove the run through **every gate in the journey** — stages 1, 2, 6 and
both in 7 — and measured each. All 494px, **zero overflow**. Every waiting-on-you block holds only
a question.

---

### Wave 6a · Follow-up pacing — ✅ `APPLIED`

**Decided:** the sequence was too slow. Tighten it; keep the two-phase send, which is right.

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 27 | `CCJ_CHASE_SEND` 2400 → 900ms | `RENDER` | [contract-journey.js:222](js/contract-journey.js#L222) | ✅ done |
| 28 | Script gaps: viewed 2600→1800, both chases 3000→1600, reply 3200→2000 | `RENDER` | [contract-journey.js:180](js/contract-journey.js#L180) | ✅ done |

**Measured at real speed, not estimated** — quote sent → client replies: **16.6s → 8.9s.**
Viewed at 1.8s, reminder 1 at 4.3s, reminder 2 at 6.8s, reply at 8.9s.

> `in` is real time the viewer waits; `at` is the simulated business time stamped on the event.
> Only the waiting changed — day 3 / day 5 / day 8 are still day 3 / day 5 / day 8.

---

### Wave 6b · Streaming text — ✅ `APPLIED`

**Decided:** "Claude type" means the agent's messages type themselves out word by word.

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 29 | `ccjTypeIn` — reveal text nodes word by word | `RENDER` | [contract-journey.js:3800](js/contract-journey.js#L3800) | ✅ done |
| 30 | `ccjTypeLast` — types on the append path **and** on a rebuild caused by a new message | `RENDER` | [contract-journey.js:3775](js/contract-journey.js#L3775) | ✅ done |
| 31 | One at a time — a new message completes the one before it | `LOGIC` | `ccjTypeFinishAll` | ✅ done |

> **It reveals, it does not build.** The message is inserted complete and correct, then its text
> nodes are emptied and refilled. Appending character by character would leave the bubble holding
> half a tag — `<b>Cost calc bui` — and every message in this journey carries markup. Walking text
> nodes leaves the element tree untouched, so bold stays bold throughout. **Asserted:** across 40
> samples taken *while it is typing*, no half-written tag ever appears and the `<b>` element is
> present from the first paint, empty then filled.

> **The first message of a conversation is the one that nearly missed out.** An empty stream cannot
> be appended to — it owes the reader the invitation — so the first message always arrives via a
> full rebuild, which originally skipped typing entirely. `grew` distinguishes "rebuilt because a
> message arrived" from a page re-render, which repaints the same history and must not re-type it.

> **Mutation test corrected my own reasoning.** I documented the headless guard as
> `!document.createTreeWalker`. Removing that line broke nothing: the harness is actually protected
> by `ccjLiveNode`, which refuses the stub's parentless nodes — the same fidelity guard the rest of
> the file uses. The line is kept as defence-in-depth, and the comment now says what is true.

**Verified:** 14 browser checks, sampled mid-flight rather than after — it starts empty, grows,
finishes complete, never tears markup, completes an interrupted message at once, leaves your own
messages instant, caps a 612-character message at 1.3s, and leaves no timer running. Headless suite
unchanged at 953 — which is the point: it still reads whole sentences.

---

### Wave 7 · "Open full run" — ✅ `APPLIED` *(route (c): a real run per deal, persisted)*

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 32 | `ccjRuns` — a store keyed by deal, holding the same objects `ccjRun` points at | `STRUCTURAL` | [contract-journey.js:9166](js/contract-journey.js#L9166) | ✅ done |
| 33 | `ccjOpenDealRun` — park, switch or create, resume | `LOGIC` | `:9180` | ✅ done |
| 34 | `ccjStopTimers` factored out of `ccjReset` — parking stops clocks, keeps state | `LOGIC` | [contract-journey.js:311](js/contract-journey.js#L311) | ✅ done |
| 35 | `ccjResumeRun` — re-arm a run parked mid-beat | `LOGIC` | `:9174` | ✅ done |
| 36 | Seed the request from the deal, into the composer | `COPY` | `ccjDealPrompt` | ✅ done |
| 37 | The button, on **every** deal | `RENDER` | [pages.js:815](js/pages.js#L815), [am-pipeline.css:199](css/am-pipeline.css#L199) | ✅ done |
| 38 | `ccjSaveRuns` / `ccjLoadRuns` + wiring into the snapshot | `STORE` | `:9210`, [core.js:3160](js/core.js#L3160) | ✅ done |

> **`ccjRun` was not renamed, deliberately.** It is read in hundreds of places. `ccjRuns` holds the
> *same objects*, so switching is one reassignment and every mutation anywhere still lands on the
> right run with no plumbing threaded through the journey.

> **The safety was already there.** `ccjSchedule` refuses to fire when `ccjRun !== run` — written
> long before this feature — so a parked run cannot write into the active one. What parking adds is
> stopping the clocks, because a pending timer *would* fire on RETURN, delivering a beat armed
> minutes earlier.

> **Two things in a run cannot be written down**, and both are dropped rather than stored:
> `stream.el` (a live DOM node — it would come back as an object that is not the element on the
> page) and timer ids (belonging to a page that no longer exists; restoring one would clear an
> unrelated timer or wait for a callback that can never come). The journey strips them itself, so
> `persistAppState` never has to guess at the shape of a run.

**A content bug the test caught:** the seeded request read *"Hire 6 roles (Fleet Coordinator) for
Norrbridge in Netherlands as a Fleet Coordinator"*. `subject` is a person on an employee record but
a **count** on an engagement, so reading it as a name produced a count-as-person and the role said
twice. An engagement now names the role and leaves the person to be identified — which is what that
stage of the deal actually knows.

**Verified:** 27 browser checks — the button is on all eight deals sampled including the five whose
step is not yours; walk deal 4 to stage 1, open deal 13, and **deal 4 is untouched**; return and it
resumes with its conversation painted; parked runs hold no clocks; both runs survive a reload with
no DOM reference and no timer id stored; and the run reopens and repaints from storage afterwards.

---

### Wave 8 · The copy nobody had looked at — ✅ `APPLIED`

**The register, stated once:** say what happened and what to do next, in the words the business
uses. Not a caption describing the screen, not the machine narrating its own control flow, and
never an argument for why a control exists.

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 39 | Both **fallback** gates lose their `why` | `COPY` | [contract-journey.js:1716](js/contract-journey.js#L1716) | ✅ done |
| 40 | Sanctions gate: keeps the match, drops the argument; "adjudicating" → "checking" | `COPY` | [contract-journey.js:1649](js/contract-journey.js#L1649) | ✅ done |
| 41 | Stage-1 halt line stops repeating the card below it | `COPY` | [contract-journey.js:1603](js/contract-journey.js#L1603) | ✅ done |
| 42 | *"The record is on the right"* → names the record that was created | `COPY` | [contract-journey.js:4395](js/contract-journey.js#L4395) | ✅ done |
| 43 | *"type the company name below"* → drops the direction | `COPY` | [contract-journey.js:4079](js/contract-journey.js#L4079) | ✅ done |
| 44 | The ask card's button moves to the trailing edge | `RENDER` | [contract-journey.css:609](css/contract-journey.css#L609) | ✅ done |

> **The two fallback lines were the most-read copy in the product.** Every step without a gate of
> its own falls through to them, so *"The run holds here until this step is marked done"* appeared
> on more of the journey than any hand-written line in it — and it was the machine describing its
> own control flow to someone who only wanted to know who they were waiting for. Dropped rather
> than reworded: the ask names the party, the button names the action, there is no third fact.

> **Tasks 42-43 were found by looking at the screen, not by this sweep.** Both pointed at furniture
> — *"on the right"*, *"below"* — which says nothing about the work and stops being true the moment
> anything moves. Two layout changes had already shipped this session that would have falsified them.

**Verified:** 11 checks. The fallback gates are **built and inspected**, not read from source — the
source now carries a comment quoting the retired sentence, which is the trap the first version of
this check fell into. Then the whole journey driven to stage 9 and the entire 6,756-character
transcript swept for **twelve** retired phrases: none survives.

---

### Wave 7b · Open full run lands mid-journey, prepopulated — ✅ `APPLIED`

**Ask:** "when we open full run, it should open the hire and onboard and should open till that
phase and all the previous steps details prepopulate according to the details present." This
supersedes wave 7's open-at-the-composer behaviour for every deal past stage 1.
(In the same message: **SC-03 is cancelled** — no backend change was made, none was pending;
client creation and store creation untouched.)

| # | Task | Type | Where | Status |
|---|---|---|---|---|
| 45 | `ccjSeedRunToDeal` — settle every stage before the deal's, push their blocks | `STRUCTURAL` | [contract-journey.js](js/contract-journey.js) | ✅ done |
| 46 | `ccjSeedStep` — one shared step-of-history writer (settled + decision + block) | `LOGIC` | beside it | ✅ done |
| 47 | `ccjSeedStageOutcome` — the artefact each completed stage leaves behind | `LOGIC` | beside it | ✅ done |
| 48 | `ccjSeedMidStage` — what the live stage's own earlier steps already produced | `LOGIC` | beside it | ✅ done |
| 49 | Stage-1 deals keep the composer — nothing before them to settle | `LOGIC` | `ccjOpenDealRun` | ✅ done |

> **It writes state, not prose.** Prior steps settle through the same keys the runner writes
> (`settled`, `decisions`, `stepMsgs`), their blocks go through `ccjPush`, and summaries come from
> `ccjSummary` against the seeded artefacts — the same sentence a walked run would have recorded.
> The live step is NOT seeded: `ccjEnterStep` halts on its gate or parks on its wait, so from the
> first moment the run is live, not a replay.

> **The details are the deal's, divided honestly.** Client, role, country and person come from the
> deal. Monthly gross is `value / roles / 12` — Norrbridge's ₹3,12,000 across 6 roles seeds €4,300,
> not an invented figure. An engagement seeds no person (*"Fleet Coordinator hire"*), because
> inventing a name would put a fictional person on a real quote; a placement keeps its real one.

> **A screenshot caught the gap the first version had.** Steps before `deal.sub` *inside* the live
> stage were unseeded, so a deal at Deposit due sub 1 showed *"invoice is with the client"* beside
> an invoice panel reading *"not raised yet"* — one fact, two surfaces, two answers. The live
> stage's earlier steps now settle through the same shared writer, plus `ccjSeedMidStage` for the
> artefacts they imply (invoice issued; contract drafted; KYC cleared).

**Verified:** 46 checks in `browser-w7b` — one deal from **every** stage the dashboard holds, each
landing on its own stage with all earlier steps settled, blocks on screen, nothing rendering
`undefined`/`NaN`, and the live step genuinely live; the deal's own client/role/country/value on
the artefacts; a placement keeping its person with signed contract history; seeded runs surviving
a reload and reopening painted. `browser-w7` updated to the new contract (26 checks). Suites
953 + 8 + 46; `.ccjv1-lock` OK.

---

## The plan is complete

Waves 0-8, tasks 1-44. What remains in this file is **SC-03** only — the backend alignment left
over from the Client model work, which is not part of the journey.

---

### Decisions needed — answer these and waves 3-8 unblock in one pass

| # | Decision | Blocks | Recommendation |
|---|---|---|---|
| D1 | Rename depth: caption only, or `done` text and the sub-status key too? | 15, 16 | caption + `done`; leave the key |
| D2 | What Reject does beyond stopping — reason captured? undo? | 17 | keep terminal, capture a reason |
| D3 | Quote QA *Send back* — keep the loop to *Cost calc built*? Does Approve change? | 18 | keep as-is; Approve unchanged |
| D4 | *Send to amend* — capture what is to be amended? | 19 | keep the loop, add a note field |
| D5 | **Both Declines** — terminal, or recoverable? Must match. | 20, 22 | terminal, both |
| D6 | Employment *Send back* — keep the loop + auto-redraft? | 21 | keep as-is |
| D7 | What actually moves right — gate cards, ask chips, or both? | 23, 24 | both |
| D8 | What is wrong with the follow-up animation specifically? | 25 | — need your answer |
| D9 | What "Claude type" means concretely — a reference screenshot settles it | 26 | — need your answer |
| D10 | Does "Open full run" show on every deal, or only owned steps? | 27 | every deal |
| D11 | Route (a) seed at stage, (b) fresh run same people, or (c) per-deal persisted runs? | 28 | (b) first; (c) only if the demo needs it |
| D12 | Sweep the unflagged gate copy too? | 29 | yes |

**D8 and D9 have no recommendation** because nothing in the code tells me what you want; every
other decision has a defensible default I can proceed on if you say "use your judgement".

---

### What can start with zero further input

**Waves 0, 1 and 2 — tasks 1 to 12.** Twelve tasks, all `COPY`/`RENDER`/`STORE`, no behaviour
changes, no decisions outstanding. That is every sentence you objected to, the verb bug, and the
persistent dashboard. Everything from wave 3 on needs at least one answer above.

---

## 1 · Applied

### SC-01 · Restore the read-only Enrichment card in Data Foundation
**Status:** `APPLIED` — verified, uncommitted in the working tree.
**Ask:** "in super admin and in entity admin, in data foundation, in all the three cards,
you have removed enrichment which was present previously, redo it".
**Scope:** `js/pages.js` — `buildCfgModelDetailHTML()`. No other file.
**Change:** the read-only branch of `enrichSection` was `:''`; it now renders the orange
enrichment card via `cfgEnrichRow()`, which had been left in the file unused. Rules stays
edit-only, unchanged.
**Why:** enrichment is half of what a unified object holds. A detail page that shows only
the mapped half reads as though the source system supplied every field — the one thing the
page exists to disprove. Both portals render this same function, so one edit covers
Super Admin and Entity Admin, and all three objects.
**Verification:** 32 browser checks — card present and visible, exact field list in order,
rows contained within the card, no editor controls on the read-only view, editor still lists
its rows with the Add button, list badges read 5 / 3 / 7. Mutation-tested: restoring `:''`
fails 12 of them.
**Open questions:** none.

### SC-02 · Rebuild the Client model's fields
**Status:** `APPLIED` — verified, uncommitted in the working tree.
**Ask:** "for client give me options what all things we can keep in enrichment fields, as for
client you can check all the form data in https://www.adtsolution.com/ on opening book a demo
button". Selected: the Account & commercial set, and add both unmapped form fields.
**Scope:** `js/core.js` — the `user` entry in `cfgModels`. Model definition only; no backend.
**Change:**
- Mapped 9 → 11. Added `Heard About Us Detail ← heard_about_us_other` and
  `Demo Slot ← demo_datetime`, both present on the live form and previously dropped on ingest.
- Enrichment replaced with seven: Account Owner, Client Tier, Lead Stage, Expected Headcount,
  Service Line Confirmed, Contract Start Date, Billing Currency.
- Sample extended so every mapped and enrichment field has a real value.
**Why:** the object is a *client* — a company that booked a demo. Its enrichment was
Department / Job Title / Branch / Joining Date, employee fields left from when the object was
called `user` and held a person. Status went with them: a lifecycle state is set by the system,
not typed in by an operator, so it was never an enrichment field. `Demo Slot` is typed `string`
and not `date` because it carries a time and a zone, and `date` here means a calendar day.
**Verification:** covered by the same 32-check run as SC-01 — mapped count, both new fields
drawn, no employee-shaped leftovers, every enrichment field sampled.
**Open questions:** none outstanding. Note the consequence recorded as SC-03.

---

## 2 · Pending — Data Foundation

### SC-03 · Align the backend to the rebuilt Client model
**Status:** `PENDING` — identified, not scoped, not started. Raised by SC-02, not requested.
**Ask:** not yet requested. Recorded so the divergence is not discovered by surprise.
**Scope:** `backend/schema.sql`, `sql/schema_direct_employees.sql` (the MySQL twin — the two
must stay in step), `backend/server.js` ingest mapping, `backend/mock-adt-server.js` form and
field-list endpoint. Possibly the All Clients columns and the record drawer.
**Change:** not specified. At minimum: columns for `heard_about_us_other` and `demo_datetime`;
a decision on the four post-ingest columns (`department`, `branch`, `job_title`, `join_date`)
that the model no longer describes.
**Why:** after SC-02 the Data Foundation card describes the target shape, not what the tables
hold. The card is a mockup surface and the backend is real, so nothing is broken today — but
the two now disagree, and the card is the thing people read to learn the shape.
**Verification:** not defined.
**Open questions:**
1. Do the four employee columns get dropped, or kept and left unused? Dropping is a migration
   against existing rows.
2. Do the seven new enrichment fields become real columns, or stay descriptive for now?
3. Does the mock NewForce form start posting the two new fields, so the mapping is fed by
   something rather than merely declared?

---

## 3 · Pending — Contract Creation Journey (demo pass)

**SC-04 to SC-14 are one body of work.** Read the CC items first: they apply to every SC below,
and several of those are much smaller than they look once the CC items are understood.

The CC items are not tasks. They are conditions that hold across the whole batch, recorded once
so they are not rediscovered nine times.

### CC-1 · Deleting a `why` prints `undefined`
`ccjGateHTML` renders the justification line unconditionally
([js/contract-journey.js:3250](js/contract-journey.js#L3250)):

```js
+'<div class="ccj-gate-why">'+gate.why+'</div>'
```

Removing the `why:` property from a gate object prints the literal word **undefined** into the
card. Setting `why:''` leaves an empty styled div holding its own margin, so the card gains a gap
where the sentence was.

**Therefore:** before removing any `why`, guard the renderer so a missing or empty `why` emits no
element at all. That single change unblocks SC-04, SC-05 and SC-09 together. Do it once, first.

### CC-2 · The v1 journey is frozen and must not be touched
[js/contract-journey-v1.js](js/contract-journey-v1.js) and
[css/contract-journey-v1.css](css/contract-journey-v1.css) are a frozen snapshot. They carry
byte-identical copies of several gates below — the qualification gate at line 1550 is the same
text as the live one at 1562. **They stay wrong on purpose.** After any work in this area run
`sha256sum -c .ccjv1-lock`; both files must report OK.

### CC-3 · "Plan how this button will work" — every one of them already does something
None of the six buttons below are unimplemented. Each has real behaviour today in
`ccjChooseGate` ([js/contract-journey.js:1940](js/contract-journey.js#L1940)). The task is to
**review the existing behaviour and decide whether it is what the demo should show** — not to
build from zero. Whoever executes this must read the current branch before designing anything, or
they will rewrite working logic by accident. Each item below states what happens today.

Two shapes exist, and the distinction is deliberate:
- **Terminal stop** — sets `run.stopped=true; run.phase='stopped'`; nothing downstream runs.
- **Loop back** — folds the current attempt, un-settles the steps from a named point in
  `CCJ_REWORK`, bumps a document version, and re-enters. The run continues.

### CC-4 · Tests that will fail, by design, and must be updated with the change
| Assertion | File | Broken by |
|---|---|---|
| `'>Qualify<'` and `'>Disqualify<'` | [test/ccj-harness.js:1071](test/ccj-harness.js#L1071) | SC-04 rename |
| `'>Approve<'` and `'>Send back<'` | [test/ccj-harness.js:1217](test/ccj-harness.js#L1217) | SC-05, if labels move |
| `'Approve and countersign'`, `'>Decline<'` | [test/ccj-harness.js:1852](test/ccj-harness.js#L1852) | SC-10 |
| `'rewritten to meet local law'` | [test/ccj-harness.js:2289](test/ccj-harness.js#L2289) | SC-12 rephrase |
| `'Approve and countersign'`, `'>Decline<'` | [test/ccj-harness.js:2411](test/ccj-harness.js#L2411) | SC-13 |

A failing check here is the harness doing its job. Update the assertion to the new copy; do not
delete it.

### CC-5 · The copy problem is systemic, not five bad sentences
Every sentence flagged below is a `why` line, and they share one voice: they explain *why the
control exists* to someone reviewing the design. That was right when the journey was being
argued about. It is wrong in a product demo, where the audience is being shown software that
works, and a card that argues for its own existence breaks the illusion.

**Therefore:** treat this as one copy pass with a stated register, not nine independent edits.
Proposed register — *state the decision and what it does, never why the decision is allowed to
exist.* See SC-14 for the gates nobody has flagged yet but which have the same problem.

### CC-6 · Step numbering
The user's step numbers match the journey's stages except one: the **Part-paid** card (SC-11) was
described under "the 5th step" but lives in **stage 6, `deposit-due`**. Recorded so nobody hunts
for it in stage 5.

| Step | Stage id | Items |
|---|---|---|
| 1 | `request-received` | SC-04 |
| 2 | `quote-prep` | SC-05 |
| 3 | `quote-review` | SC-06 |
| 5 | `agreement-signature` | SC-09, SC-10 |
| 6 | `deposit-due` | SC-11 |
| 7 | `employment-contract` | SC-12, SC-13 |
| — | all stages | SC-07, SC-08, SC-14 |
| — | AM dashboard (outside the run) | SC-15, SC-16 |

### CC-7 · The journey has two live names
The launcher calls it **Hire and Onboard**; the catalogue and every internal identifier call it
**Contract Creation** (`contract-creation`, `ccj*`, `CCJ_*`). Both are current and deliberate —
[test/runner-harness.js:219](test/runner-harness.js#L219) asserts the cards render the launcher
copy and *not* the catalogue name. Do not "fix" the identifiers to match the label.

---

### SC-04 · Step 1 — Qualified / Disqualified gate
**Status:** `PENDING`
**Ask:** "rename the action like 'qualify' keep as it is, rename disqualify as 'reject'" ·
"'Nothing is costed or quoted until this is approved.' remove it as it makes it look like demo,
but i am making a demo of a real time final product application" · "on clicking on reject plan
what should happen".
**Scope:** [js/contract-journey.js:1562-1573](js/contract-journey.js#L1562) — the
`'request-received/Qualified / Disqualified'` gate; `:1496` (the ask map); `:1950` (the
`disqualified` branch); [js/core.js:190](js/core.js#L190) and `:309`;
[test/ccj-harness.js:1071](test/ccj-harness.js#L1071);
`Contract_Journey_SubStatus_Runner_Plan.md:108`. See CC-2 for what is out of scope.

**Change A — remove the justification line.** Delete
`why:'Nothing is costed or quoted until this is approved.'`. Requires CC-1 first.

**Change B — rename the reject action.** `Qualify` is unchanged. `Disqualify` → **`Reject`**.

> **This is not a one-word edit.** The visible label is `{id:'disqualified', label:'Disqualify',
> tone:'stop', done:'Disqualified'}`. Three separate things carry the old word, and they are not
> interchangeable:
> - **`label`** — the button caption. Safe to change alone; this is the only purely cosmetic part.
> - **`done`** — the resolved sub-status text ("Disqualified by …"), which appears in the
>   transcript block after the decision is answered.
> - **the sub-status name itself** — the string `'Qualified / Disqualified'`, which is used as a
>   **compound key** (`stage-id/sub-status`) in `CCJ_GATES`, the ask map at `:1496`, and the stage
>   definition in `js/core.js`. It is also printed in prose at `js/core.js:309`.
>
> Decide the depth before starting — see open question 1.

**Change C — decide what Reject does.**
*Today:* `optId==='disqualified'` sets `run.stopped=true; run.phase='stopped'`, repaints, and
pushes the agent line *"Request declined. The remaining steps will not run."* It is deliberately
**not** written to `settled`, with a comment explaining why: a settled row gives up its gate
block, which is the thing that explains the run stopped and offers the way back. The run is
terminal — there is no resume.

*To decide:* whether terminal-and-final is the right demo behaviour, or whether Reject should
capture a reason, offer an undo, or return to intake. See open question 2.

**Why:** the line is design-review voice in a product demo (CC-5). The rename aligns the button
with the word the business actually uses.
**Verification:** `node test/run-all.js`; `sha256sum -c .ccjv1-lock`; browser — stage 1 gate card
shows Qualify / Reject, no `undefined`, no empty block or gap where the sentence was, and the
resolved block after answering reads correctly.
**Open questions:**
1. How deep does the rename go — button caption only, or `done` text, or the sub-status name too?
   Caption-only is one line. The full rename touches seven places and changes what the transcript
   and the stage rail print.
2. What should Reject do beyond stopping? Options: keep terminal as-is · terminal but capture a
   reason first · terminal with an "undo" for the demo · return the run to intake for amendment.
3. Does `halt:'Request logged and routed. Qualify it to continue.'` on this same gate stay? It is
   separate copy in the same card's vicinity, in the same register CC-5 objects to.

---

### SC-05 · Step 2 — Quote QA gate
**Status:** `PENDING`
**Ask:** "in the second step, in the human intervention card 'The client sees these numbers.
Nothing is sent until they are signed off.' this makes it look like demo, not a real
application" · "there is 'approve', we need to plan for 'Send back', we need to plan how this
button will work".
**Scope:** [js/contract-journey.js:1577-1585](js/contract-journey.js#L1577) — the
`'quote-prep/Quote QA'` gate; `:1647` (`CCJ_REWORK`); `:2050` (the shared rework branch);
[test/ccj-harness.js:1217](test/ccj-harness.js#L1217).

**Change A — remove the justification line.** Delete
`why:'The client sees these numbers. Nothing is sent until they are signed off.'`. Requires CC-1.

**Change B — confirm or redesign Send back.**
*Today:* `Send back` (`id:'rework'`) is a **loop, not a stop**. `CCJ_REWORK['quote-prep/Quote QA']`
is `'Cost calc built'`, so the run folds the current attempt, un-settles every step from
*Cost calc built* onward, deletes the decision, pushes *"Sent back. Picking up again from
**Cost calc built**."*, re-enters that step and repaints the quote panel so the artefact stops
showing a green Approved pill while the conversation says the cost is being rebuilt. The original
design note is explicit that a QA rejection which ended the run would be modelling it as a
disqualification, which it is not.

*To decide:* whether that is the demo behaviour wanted, and whether Approve needs any change at
all — the ask lists Approve but does not say it is wrong. See open questions.

**Why:** CC-5.
**Verification:** `node test/run-all.js`; browser — approve path reaches Quote sent; send-back
path visibly returns to *Cost calc built*, appends fresh blocks below rather than repainting
above, and the quote panel loses its Approved pill.
**Open questions:**
1. Is Approve to change at all, or is it listed only for completeness? Nothing in the ask says it
   misbehaves.
2. Should Send back capture a reason or a comment before looping? Today it loops silently.
3. Should the loop target stay *Cost calc built*, or go further back?

---

### SC-06 · Step 3 — the follow-up animation
**Status:** `PENDING` — **least specified item in this batch. Do not start without answers.**
**Ask:** "in step 3 we need to work on (Follow up) its animation" · "through out follow up, we
need to work on".
**Scope:** [js/contract-journey.js:2209-2240](js/contract-journey.js#L2209) — the `chase` branch
of `ccjClientEvent`; `CCJ_CHASE_SEND` at `:225`; the client timeline at `:174-176`; the reminder
evidence rows at `:544-561`.

**Change:** not specified. What exists today, so a designer has a baseline:
- A reminder is **visibly sent before it reads as sent**. The message lands first as
  `sending:true` with a spinner, and becomes the sent record `CCJ_CHASE_SEND = 2400ms` later
  (`:2222-2240`). This two-phase behaviour was added deliberately in an earlier pass — a reminder
  that appeared instantly read as fake.
- One chase in flight at a time, capped at three (`if(c.chases>=3||c.sending)return`).
- Cadence day 3 / day 5 / day 8; the third is labelled *Final reminder*, the others *Scheduled
  reminder*.
- After chase 2 with no reply the client comes back with a **price change request**, which is
  what turns the follow-up into the stage-3 negotiation.

**Why:** stated as "we need to work on its animation" — the intent is polish, not a behaviour
change. Recorded as-is.
**Verification:** cannot be defined until the change is.
**Open questions:**
1. **What specifically is wrong with the animation now** — the 2.4s send delay, the spinner
   itself, the way the bubble enters, the scroll behaviour, or the pacing between the two
   follow-ups? Every one of those is a different fix.
2. "Throughout follow-up we need to work on" — does this mean the whole stage-3 negotiation
   sequence, or only the reminder animation repeated across all three chases?
3. Is this the same concern as SC-07 (chat feel), or separate? If the same, merge them — they
   would otherwise be worked twice.

---

### SC-07 · Chat UI feel — Claude-like, across the whole journey
**Status:** `PENDING` — **needs definition before any work.**
**Ask:** "UI CHAT FEEL Need to make good (Claude type)".
**Scope:** [css/contract-journey.css](css/contract-journey.css) — `.ccj-msg`, `.ccj-bubble`,
`.ccj-chip`, `.ccj-stream`; message rendering at
[js/contract-journey.js:3793-3831](js/contract-journey.js#L3793). Every stage, not one.
**Change:** not specified.
**Why:** stated as a quality bar, not a defect.
**Verification:** cannot be defined until the change is.
**Open questions:**
1. **What does "Claude type" mean concretely here** — message density and spacing, the streaming
   type-on effect, bubble shape and borders, the typography, the way the composer looks, or
   response pacing? A reference screenshot of the specific thing would settle this in one pass.
2. Does this replace the current bubble treatment, or refine it? The stream already uses a tinted
   canvas with white bubbles, chosen deliberately.
3. Priority relative to the copy fixes — those are small and certain; this is large and open.

---

### SC-08 · Our-side messages and action buttons to the right
**Status:** `PENDING` — **the diagnosis in the ask does not match the code; confirm the target.**
**Ask:** "all the chat whatever we need to send from our side all the action button show it from
the right side, now its on the left side, which is not looking good".
**Scope:** [css/contract-journey.css:293-306](css/contract-journey.css#L293);
`ccjMsgWho` at [js/contract-journey.js:3793](js/contract-journey.js#L3793); the ask/chip bubble at
`:3831`; the gate card at `:3248`.

> **Finding — user messages are already right-aligned.** `.ccj-msg.user{justify-content:flex-end}`
> already pushes them right, with a navy fill, and the screenshot confirms it: the uploaded file
> chip sits on the right. So the change being asked for is about something else on the left.
>
> **What is actually left-aligned, and is the likely target:**
> - **The gate card** (`Qualify` / `Reject`, `Approve` / `Send back` …). `ccjMsgWho` maps both
>   `kind:'step'` and `kind:'ask'` to `'step'`, and `.ccj-msg.step{display:block}` makes them
>   full-width blocks anchored left.
> - **The ask chips** (`Continue`, `View contract`) — `.ccj-bubble.ccj-ask` at `:3831`, same
>   full-width block treatment.
>
> Both are things *we* click, which fits "from our side". Confirm before building.

**Change:** right-align the elements identified above once the target is confirmed.
**Why:** as stated — the left-anchored controls read as belonging to the agent's side of the
conversation when they are the user's to press.
**Verification:** browser, every stage that has a gate — controls right-aligned, the transcript
still reads top-to-bottom, and nothing overlaps the artefact panel at narrow widths.
**Open questions:**
1. **Which elements?** Gate cards, ask chips, both, or something else in the screenshot I have
   not identified?
2. If the gate card moves right, does it keep full width or shrink to its content? Full-width
   right-aligned looks identical to full-width left-aligned.
3. Does the indented/coloured **lane** treatment (which marks what the counterparty can see)
   interact with this? A right-aligned block inside a lane may misread.

---

### SC-09 · Step 5 — Legal & compliance review gate
**Status:** `PENDING`
**Ask:** "in the legal and compliance card 'Nothing is sent until legal has read it. The
liability cap and the indemnities are what they are checking.' this is making it look like demo,
which we dont want" · "approve should work as it is, but need to plan for the 'Send to amend'
button".
**Scope:** [js/contract-journey.js:1593-1601](js/contract-journey.js#L1593) — the
`'agreement-signature/Legal & compliance review'` gate; `:1648` (`CCJ_REWORK`); `:2050-2052`.

**Change A — remove the justification line.** Requires CC-1.

**Change B — confirm or redesign "Send to amend".**
*Today:* `Send to amend` (`id:'amend'`) is a **loop**. `CCJ_REWORK` sends it back to
`'MSA drafted'`, and uniquely among the rework paths it **bumps `run.msa.version++`** — the
agreement comes back as a new version, not a re-run of the same one. Approve (`id:'released'`,
`done:'Released'`) continues the run.

**Why:** CC-5.
**Verification:** `node test/run-all.js`; browser — amend path returns to *MSA drafted*, the
agreement's version number increments visibly, and the artefact panel drops any released state.
**Open questions:**
1. Should the amendment capture what is to be amended — a note, or the specific clause? Today it
   loops with no reason recorded, which for a legal amendment is thin.
2. Is the version bump visible enough in the demo to read as "this is v2"?

---

### SC-10 · Step 5 — Signed / countersignature (post-gate)
**Status:** `PENDING`
**Ask:** "in the signed card approve and countersign should work as it is, we need to plan what
will happen when the user click on the decline button".
**Scope:** [js/contract-journey.js:1625-1637](js/contract-journey.js#L1625) — the
`'agreement-signature/Signed'` entry in **`CCJ_POST_GATES`**; the `countersign` branch at `:1958`;
the `declineMsa` branch at `:1967`; [test/ccj-harness.js:1852](test/ccj-harness.js#L1852).

> **Note — this is a post-gate, not an arrival gate.** `CCJ_GATES` halts on arrival, before the
> step runs. `CCJ_POST_GATES` lets the work happen first and gates its *result* — you cannot
> approve a signature you have not received. Anyone touching this must use the right map.
> Its `owner:'Compliance'` is also deliberate: the step is owned by the Client because the client
> signs, but the countersignature is ours.

**Change — decide what Decline does.**
*Today:* `declineMsa` sets `run.stopped=true; run.phase='stopped'` and pushes *"Agreement declined
at countersignature. Nothing is in force and no placement can start."* Terminal, no resume, no
reason captured.
*Approve and countersign* (`id:'countersign'`) advances the client clock by 95 minutes, stamps
`msa.adtSignedAt` (in force from the **last** signature), writes an *Agreement executed* log and
settles. **Unchanged per the ask.**
**Why:** as stated.
**Verification:** `node test/run-all.js`; browser — decline stops the run visibly, with the gate
block still on screen explaining why (the same principle as SC-04's terminal stop).
**Open questions:**
1. Terminal, or recoverable? This is the last point at which the agreement can be declined, so
   terminal is defensible — but a demo that dead-ends may not be wanted.
2. Should declining capture a reason, and should it appear on the client thread?
3. Is the message wording right, or does it fall under CC-5 too?

---

### SC-11 · Step 6 — Part-paid card *(note: stage 6, not stage 5 — see CC-6)*
**Status:** `PENDING`
**Ask:** "'No placement may start until the deposit is settled. Releasing early accepts the
payroll exposure the deposit exists to cover, and is recorded against this run.' we need to
rephrase it and make it simpler to make it user friendly."
**Scope:** [js/contract-journey.js:6069-6085](js/contract-journey.js#L6069) — the
`'deposit-due/Part-paid'` gate (a function, not a literal — it returns `null` once answered, so
the row becomes a wait); the `holdBalance` branch at `:1988`; `releaseShort` at `:1996`.

**Change:** rephrase `why` in plainer language. **Rephrase, not remove** — unlike SC-04/05/09 this
one carries a real consequence the user is agreeing to, so the sentence has a job.

What the sentence must still convey, in simpler words:
1. Work cannot start until the deposit is paid.
2. Releasing anyway means we carry the unpaid payroll risk.
3. That choice is recorded against this run, with who made it.

Draft for review: *"Work can't start until the deposit is paid. Release it anyway and we cover
the payroll ourselves — we'll record who approved it."*

**Why:** as stated. Note this gate is genuinely a decision with money behind it, which is why the
recommendation is to simplify rather than delete.
**Verification:** `node test/run-all.js`; browser — both buttons still work: *Hold for the
balance* must **not** settle the row (it issues a chase and the row becomes a wait — this is
deliberate and easy to break), *Release anyway* records the shortfall amount and approver on the
invoice rather than marking it paid.
**Open questions:**
1. Is the draft above the right register, or simpler still?
2. Do the button labels *Hold for the balance* / *Release anyway* change too? Not mentioned.

---

### SC-12 · Step 7 — Internal approval gate
**Status:** `PENDING`
**Ask:** "'1 clause were rewritten to meet local law — language and written particulars. The
employee signs whatever this says, and we carry the employment liability.' rephrase it and make
it in simpler term to make it user friendly" · "approve and issue button should work as it is, we
need to define for send back button, how that button function should work".
**Scope:** [js/contract-journey.js:6698-6718](js/contract-journey.js#L6698) — the
`'employment-contract/Internal approval'` gate (a function; `why` is **built at runtime** from the
audit result); `CCJ_REWORK` at `:6718`; the rework branch at `:2050-2058`;
[test/ccj-harness.js:2289](test/ccj-harness.js#L2289).

> **Bug, visible in the quoted text.** The sentence reads *"1 clause **were** rewritten"*. The
> noun is pluralised but the verb is not:
> ```js
> adj.length+' clause'+(adj.length===1?'':'s')+' were rewritten to meet local law — '
> ```
> Fix the verb agreement as part of the rephrase. The `bad` branch one line above handles this
> correctly, so the two are inconsistent as well as wrong.

**Change A — rephrase.** This `why` has **three** branches, and all three need the new register:
1. clauses **failed** the statutory check and cannot be issued as drafted;
2. clauses were **adjusted** to meet local law (the quoted one, with the verb bug);
3. **nothing** needed adjusting.
The tail *"The employee signs whatever this says, and we carry the employment liability"* appears
in branches 2 and 3 and is the part that reads as design-review voice.

**Change B — confirm or redesign Send back.**
*Today:* `Send back` (`id:'ecRedraft'`) is a **loop** to `'Draft generated'`. It bumps
`run.emp.version++` **and calls `ccjDraftContract()` to regenerate**, because a redrafted contract
is a new version and the audit that ran against the old one no longer describes anything on
screen. **Approve and issue** (`id:'ecApprove'`) is unchanged per the ask.
**Why:** as stated, plus the grammar bug.
**Verification:** `node test/run-all.js` — the harness asserts on `'rewritten to meet local law'`
and must be updated to the new copy, not deleted; browser — all three `why` branches inspected,
not just the one on the happy path; send-back regenerates the draft and increments the version.
**Open questions:**
1. Do all three branches get rewritten, or only the adjusted-clause one that was quoted?
2. Should the failed-check branch keep a firmer tone? It reports something that legally cannot be
   issued, which is not the same as a note.

---

### SC-13 · Step 7 — ADT countersigned gate
**Status:** `PENDING`
**Ask:** "'The employee has signed and returned it. Ours is the second signature and the contract
is in force from it — this is the last point at which we can decline.' need to rephrase it to
make it easy for the user experience" · "Approve and countersign button should work as it is and
we need to plan how the decline button should work".
**Scope:** [js/contract-journey.js:6722-6733](js/contract-journey.js#L6722) — the
`'employment-contract/ADT countersigned'` gate; the `ecDecline` branch at `:2043`;
[test/ccj-harness.js:2411-2414](test/ccj-harness.js#L2411).

> **Note.** This is an **arrival** gate, unlike its stage-5 twin (SC-10) which is a post-gate.
> The comment at `:6719` explains why: the evidence justifying the decision — the employee's
> signature and the audit trail — is already on the document, so there is no work to do first.
> The two countersign gates look identical on screen and are structurally different underneath.

**Change A — rephrase.** Simpler wording; keep the two facts that matter (the employee has
signed; ours is the signature that puts it in force) and drop the design-review clause.

**Change B — decide what Decline does.**
*Today:* `ecDecline` sets `ccjEmp().declined=true`, `run.stopped=true; run.phase='stopped'`,
repaints both transcript and screen, and pushes *"Contract declined at countersignature. Nothing
is in force and the employee cannot start."* Terminal.
**Why:** as stated.
**Verification:** `node test/run-all.js` — the harness exercises `ccjChooseGate('ecDecline')` at
`:2414`; browser — decline stops the run and the employment contract artefact shows the declined
state.
**Open questions:**
1. Same as SC-10 Q1 — terminal or recoverable? Whatever is decided, **SC-10 and SC-13 should
   behave the same way**, or the demo teaches two different meanings for the same word.
2. Should the wording differ from SC-10's decline message, given one voids an agreement with the
   client and the other an employment contract with the worker?

---

### SC-14 · Sweep the gate copy nobody has flagged yet
**Status:** `PENDING` — raised by CC-5, not requested. Recorded so the demo is not half-fixed.
**Ask:** not requested.
**Scope:** the remaining `why` lines in `js/contract-journey.js`:
- `'agreement-signature/Client entity + sanctions check'` at `:1610` — *"…screening cannot clear
  this on its own, and we may not contract with a sanctioned entity."*
- The **fallback** gates at `:1668-1679`, which every unlisted step falls through to:
  *"The run holds here until it comes back."* and *"The run holds here until this step is marked
  done."* These appear on more steps than any authored gate in the journey.
- `halt:` lines, of which SC-04 Q3 is one instance.

**Change:** apply the same register decided in CC-5.
**Why:** five gates were flagged from screenshots of steps 1, 2, 5 and 7. The gates above have the
identical voice and were simply not on screen. Fixing only what was photographed leaves the
inconsistency visible the moment the demo takes a different path — and the fallback lines are the
most-shown copy of the lot.
**Verification:** as the others.
**Open questions:**
1. Confirm this is wanted. It is inference from CC-5, not an instruction.

---

### SC-15 · Make the Account Manager dashboard persistent
**Status:** `PENDING` — **smaller than it looks. Read the finding.**
**Ask:** "in that hire and onboard journey (contract creation journey in the past), i want to make
the account manager dashboard also persistent".
**Scope:** [js/core.js:3140-3176](js/core.js#L3140) — `persistAppState()` / `loadAppState()`;
`amDeals` at [js/core.js:696](js/core.js#L696); the volatile UI state at `:848` and `:853`.

> **Finding — the machinery already exists and `amDeals` was simply left out of it.**
> There is a complete localStorage layer (`APP_STATE_KEY = 'opendhi_mockup_state_v1'`) that
> snapshots after every render and rehydrates before the first. It already persists
> `contractsData`, `manualJourneyRuns`, `aiAutomationRuns`, `ctLogsData`, `ctWorkflowData`,
> `directEmpData`, `notifData`, `entityRequests` and four sequence counters.
>
> **`amDeals` is not in the list.** So advancing a deal on this dashboard is lost on reload while
> every store around it survives — which is the inconsistency being reported.
>
> `amDeals` being declared `const` is not an obstacle: the loader's `replaceArray` helper mutates
> arrays in place, which is exactly how `contractsData` (also `const`) is already restored.

**Change:** add `amDeals` to the `persistAppState()` payload and to `loadAppState()` via
`replaceArray`. Then decide the volatile UI state separately — see open questions.

> **Check one thing first.** [js/core.js:2336](js/core.js#L2336) documents three arrays that are
> **deliberately** excluded from persistence, because they cache server state and a cached copy
> outliving the server's copy is worse than no cache. That reasoning covers `masterData`,
> `mdLogsData` and `mdWorkflowData` — it does **not** cover `amDeals`, which is self-contained mock
> data with no backend behind it. Including it is consistent with the existing design, not a
> violation of it. Confirm this before writing, and leave a comment saying so.

**Why:** as asked. The dashboard is the surface a demo returns to between runs, and resetting it
on reload undoes whatever was just demonstrated.
**Verification:** advance a deal, reload, confirm it is still advanced; confirm the seed-data reset
rules at `:3177` onward do not sweep it away; `node test/run-all.js`.
**Open questions:**
1. Should `amPipelineStage` (the step-card filter), `amSelectedDealId` and `amDealTab` persist too?
   They are UI position, not data. Persisting the filter means a reload can land the user on a
   filtered list with no memory of having filtered it — usually worse, not better. Recommend:
   persist `amDeals` only.
2. Should there be a demo-reset path, as `contractsData` has at `:3177`? Without one, a demo run
   cannot be put back to its opening state without clearing localStorage by hand.

---

### SC-16 · "Open full run" from the deal drawer
**Status:** `PENDING` — **the button is trivial; what it opens is not. Do not start on the button.**
**Ask:** "if we click on any of the journey step card, then on clicking action button on any of the
line item, a popup opens — in that popup, in the logs window, under mark 'Qualify / Disqualify'
done button i want to add one more button as open full run, and when we click on that then we
should be able to open a full interface of hire and onboard journey".
**Scope:** [js/pages.js:811](js/pages.js#L811) — the button's location; `renderAmDealSidebar()` at
`:752`; `openAmDealSidebar()` at `:720`; `ccjNewRun()` at
[js/contract-journey.js:232](js/contract-journey.js#L232); `ccjStartNewRun()` at `:8907`.

**Change A — the button.** Add a second button beneath
`Mark "<step>" done` in the Logs action panel. One line, in a known place.

> **Two notes on placement.**
> 1. **It is not a popup.** The thing that opens is `.lp-split-sb`, a split-pane drawer docked to
>    the right of the list — not a modal. Nobody should go hunting for a modal component.
> 2. **The `Mark done` button only renders on rows the signed-in role owns** (`a.kind==='do'`).
>    In the screenshot only three of the six visible rows have it; the rest show *Waiting on
>    Pricing* or *Send reminder*. A button added inside that branch would be **missing from most
>    deals**. Opening a run is not an ownership-gated action, so it almost certainly belongs
>    outside the `mine` branch — but that is a decision, not an assumption. See open question 1.

**Change B — what it opens.** Not specified, and this is the whole of the work.

> **Finding — there is no mapping from a deal to a run, and only one run can exist.**
> - `ccjRun` is a **single global**, `null` until `ccjNewRun()` builds a fresh one. Opening a run
>   for deal B therefore destroys deal A's. Nineteen deals with their own runs means `ccjRun`
>   becomes a keyed map — a structural change, not a feature toggle.
> - A run holds far more than a deal does: `intake`, `match`, `proposal`, `pay`, `emp`, `onb`,
>   `worker`, the client and worker threads, `form`, `aiFilled`. An `amDeal` has a client, a
>   reference, a subject, a role, a country and a stage. **The intermediate artefacts that a deal
>   at, say, Deposit due would have produced — quote, agreement, invoice — do not exist anywhere.**
> - A run also holds **live timers** (`auditTimer`, the client thread's `timer`). Those cannot be
>   serialised, so persisting runs (which SC-15 makes tempting) needs them rebuilt on load, not
>   stored.

Three ways this can go, and they differ enormously in cost:
- **(a) Seed a run at the deal's current stage.** Truest to the ask. Requires fabricating every
  upstream artefact so the transcript above the current step is not empty. Largest by far.
- **(b) Open the journey from the start, using the deal's client/worker/country.** Cheap and
  honest, but it does not "open *this* run" — it starts a new one that happens to be about the
  same people. May be enough for a demo.
- **(c) Give each deal a real run from the moment it is first opened, and persist it.** Most
  coherent long-term and it composes with SC-15, but it is the largest structural change: `ccjRun`
  becomes per-deal, and the timer problem above must be solved.

**Why:** as asked — the dashboard currently shows where work is without any way to step into it.
**Verification:** cannot be defined until B is chosen.
**Open questions:**
1. Does "Open full run" appear on **every** deal, or only where the current step is the signed-in
   role's? Recommend every deal, which means placing it outside the `mine` branch.
2. **Which of (a), (b) or (c)?** Nothing else about this item can be estimated until this is
   answered.
3. If (a) or (c): what should a run opened at stage 6 show for stages 1-5 — fabricated history, or
   an honest "this run was not walked from the start" marker?
4. Does the run open in place, or navigate away from the dashboard? If it navigates, is there a
   route back to the same filtered list and the same open drawer?

---

## 4 · Incoming

*Items land here as they are sent, then get written up into section 2 or 3.*

<!-- nothing yet -->
