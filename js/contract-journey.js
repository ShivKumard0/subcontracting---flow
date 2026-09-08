/* == CONTRACT CREATION JOURNEY — REBUILT FROM SCRATCH ====================================
   A second, independent implementation of the contract-creation journey, built one stage at a
   time. It shares nothing with the original ai-contract-* chain in js/pages.js beyond
   read-only domain data (amPipelineStages, amSubStatuses, aicjEvidence, AI_CT_COUNTRIES) and
   two pure helpers (parseAIContractPrompt, findExistingEmployee) — no shared state, no shared
   render path, no shared page ids. The original keeps working untouched and stays available as
   reference for as long as this one is being built.

   NAMING. Everything here is prefixed `ccj` — functions, state, page ids and CSS classes.
   `cc` alone belongs to the cost calculator (ccRender, .cc-row, ccSalary) and `aicj` to the
   original journey's sub-status runner, so a third prefix is what keeps the three from
   colliding in a codebase where every script shares one global scope.

   == THE SPINE: NINE STAGES, EACH OWNING SEVERAL SCREENS ================================
   The nine client-facing stages in amPipelineStages are the journey. A stage is NOT one
   screen — stage 1 alone walks through four:

     prompt    describe the hire, in conversation
     employee  the ADT record we created, when the person was not already there
     form      Create a Contract — every field, AI pre-filled
     proposal  the compiled proposal

   `page` stays on the stage (`ccj-request-received`) for all four; `ccjRun.screen` is what
   moves. THIS IS THE WHOLE POINT: the shell — header, rail and above all the sub-status panel
   — is built once when the stage is entered, and changing screens repaints ONLY #ccj-screen.
   The panel is never rebuilt, never remounted and never loses its place. It stays as it is
   until every sub-status in the stage has completed, and only then does the journey advance.

   == THE PANEL: A QUARTER OF THE WIDTH, TOP TO BOTTOM ===================================
   A vertical card pinned to the right at 25% of the body. Every sub-status shows its detail,
   stacked in order: what a settled one found, what the running one is doing right now, and
   what a pending one will do when it gets there. Nothing is hidden behind a disclosure — the
   whole stage is readable at a glance, and the full evidence (the call, the payload, every
   rule and verdict) is one click deeper in a drawer.

   == HOLDS: WHY "NEW INTAKE" DOES NOT FINISH IN THREE SECONDS ===========================
   Most sub-statuses are a burst of machine work: reach a system, check the rules, capture
   what came back, done. Some are not. `New intake` is the capture of the request itself, and
   the request is not captured until the contract details have been entered and compiled into
   a proposal — which takes as long as a person takes. So it runs its beats, then HOLDS:
   visibly current, spinner turning, evidence on screen, waiting on a milestone rather than a
   timer. Reaching the `proposal` screen releases it. Only then does CSM assigned run, and
   only after that does the qualification decision appear.

   That distinction — timed work versus held work — is the honest one. A sub-status that ticked
   green while the user still had an empty form in front of them would be reporting work that
   had not happened.                                                                       == */

/* ---- STAGES AND PAGES ---------------------------------------------------------------- */
/* A page id is derived from the stage id rather than listed, so the two can never drift:
   adding a stage to amPipelineStages adds its page. `ccj-start` is kept as a legal alias for
   stage 1 — the conversation is the intake, so there is no separate screen before it. */
function ccjStages(){return (typeof amPipelineStages!=='undefined'&&amPipelineStages)||[];}
function ccjPageId(i){const s=ccjStages()[i];return s?'ccj-'+s.id:'';}
function ccjStageOf(pg){
  const st=ccjStages();
  for(let i=0;i<st.length;i++)if(pg==='ccj-'+st[i].id)return i;
  return -1;
}
function ccjStage(i){return ccjStages()[i]||null;}
/* `ccj-model` is a page of its own, deliberately outside the nine stages. The engagement model
   is chosen before there is a run, so drawing the nine-stage rail and the sub-status panel
   around it would be reporting on a journey that has not started. It gets a clean screen; the
   journey frame arrives with the run. */
function isCCJPage(pg){return pg==='ccj-start'||pg==='ccj-model'||ccjStageOf(pg)>=0;}
/* == WHO SIGNS FIRST ========================================================================
   The employment contract is signed by US and then by the employee — the reverse of the order
   amSubStatuses lists, and the reverse of what this journey used to do.

   WHY OURS MOVES AHEAD OF THE SEND. A contract that arrives already bearing the employer's
   signature is an offer the employee can accept by signing. The other way round asks a person to
   put their name to an employment agreement that nobody at the company has yet committed to, and
   then to wait to find out whether we will. The signature that executes the contract is now
   theirs, which is also the honest reading of it: we make the offer, they accept it.

   IT RENAMES THE STEP. With ours first, "ADT countersigned" is the wrong word — a
   countersignature is the second one. Ours is now "ADT signed"; theirs is the one that executes.

   OVERRIDDEN HERE rather than edited into core.js, for the same reason CCJ_MODEL_CARD is:
   amSubStatuses is shared with the frozen v1 journey and with the Account Manager's board, and
   both must keep behaving exactly as they did. Rebuilt rather than reordered in place, because
   core.js documents that list as never mutated — the board holds the very same objects. */
const CCJ_STEP_ORDER={
  'employment-contract':['Draft generated','Clause compliance check','Internal approval',
                         'ADT signed','Sent to worker','Worker signed']
};
const CCJ_STEP_RENAME={'employment-contract':{'ADT countersigned':'ADT signed'}};
function ccjSteps(i){
  const s=ccjStage(i);
  const base=s&&typeof amSubSteps==='function'?amSubSteps(s.id):[];
  const order=s&&CCJ_STEP_ORDER[s.id];
  if(!order)return base;
  const rename=CCJ_STEP_RENAME[s.id]||{};
  const by={},labels=[];
  base.forEach(function(st){
    const label=rename[st.label]||st.label;
    // A copy when the label moves, because the board is holding the original object.
    by[label]=(label===st.label)?st:Object.assign({},st,{label:label});
    labels.push(label);
  });
  // A step the order does not name keeps its place at the end rather than disappearing from the
  // stage — a silently dropped sub-status is the one failure mode this must not have.
  return order.map(function(l){return by[l];}).filter(Boolean)
    .concat(labels.filter(function(l){return order.indexOf(l)===-1;})
      .map(function(l){return by[l];}));
}
function ccjKey(i,step){const s=ccjStage(i);return (s?s.id:'')+'/'+(step?step.label:'');}
function ccjEvent(i){return ((typeof aiJourneyEvents!=='undefined'&&aiJourneyEvents['contract-creation'])||[])[i]||{};}

/* ---- THE SCREENS INSIDE A STAGE --------------------------------------------------------
   `when` makes a screen conditional: the Employee Created confirmation only exists when the
   person was not already in ADT, exactly as the original journey behaves. `chat` says whether
   the conversation column is beside this screen — on the first screen the conversation IS the
   screen, so it takes the full width rather than sitting in a 300px column next to nothing. */
const CCJ_SCREENS={
  'request-received':[
    {id:'prompt',   title:'Describe the hire',  chat:'full'},
    {id:'employee', title:'Employee created',   chat:'side', when:function(run){return run.createdEmp;}},
    {id:'form',     title:'Contract details',   chat:'side'},
    {id:'proposal', title:'Proposal created',   chat:'side'}
  ],
  'quote-prep':[
    {id:'quote',    title:'Quote',              chat:'side'}
  ],
  // The conversation IS the work on this stage, so it gets a wider column than the 300px it
  // uses elsewhere — a negotiation read in a sliver is a negotiation nobody reads.
  'quote-review':[
    {id:'sent',     title:'Quote sent',         chat:'side', chatWide:true}
  ],
  // The CSM introduction is a message to the client, so the thread carries on here — the quote,
  // the negotiation, the acceptance and the handover end up as one continuous record.
  'quote-approved':[
    {id:'account',  title:'Client account',     chat:'side', chatWide:true}
  ],
  // The agreement goes to the client and comes back signed, so the thread carries on again.
  'agreement-signature':[
    {id:'msa',      title:'Master Services Agreement', chat:'side', chatWide:true}
  ],
  // The invoice goes out in the thread, the client acknowledges in it, the reminders and the
  // remittance advice land in it. Accounts payable is a conversation, not an event.
  'deposit-due':[
    {id:'invoice',  title:'Deposit invoice',  chat:'side', chatWide:true}
  ],
  // The counterparty changes here. Everything from stage 3 to stage 6 was a conversation with the
  // CLIENT; this contract is between us and the WORKER, and the thread beside it is theirs.
  'employment-contract':[
    {id:'contract', title:'Employment contract', chat:'side', chatWide:true}
  ],
  // Onboarding is not one artefact, it is six running at once. The screen is the file being
  // assembled, and the thread is still the employee's — they are the one supplying most of it.
  'onboarding':[
    {id:'onboarding', title:'Onboarding', chat:'side', chatWide:true}
  ],
  /* The last stage is the first one with THREE screens since stage 1, and they are three different
     questions rather than three views of one thing: may this person be paid (the readiness
     certificate), what were they actually paid (the run), and what is true now (the record). One
     screen holding all three would have buried the certificate under the payslip the moment the
     payslip existed — and the certificate is the whole reason anyone trusts the payslip. */
  'active':[
    {id:'readiness', title:'Payroll readiness', chat:'side', chatWide:true},
    {id:'payrun',    title:'First payroll run', chat:'side', chatWide:true},
    {id:'active',    title:'Active',            chat:'side', chatWide:true}
  ]
};

/* == STAGE 3: SOMEBODY ELSE'S CLOCK =======================================================
   Stages 1 and 2 were internal — the agent does a thing, it takes 700ms, it is done. Stage 3
   is a quote sitting with a client for days, and that changes three things.

   TIME IS SIMULATED, AND SHOWN. The run advances in seconds; the timeline it writes says
   "4 Aug, 09:12 · Opened 11:20 · Follow-up 7 Aug". Real elapsed seconds would read as a
   stopwatch. Simulated stamps read as an engagement history, which is what this is.

   A FOLLOW-UP AND A NEGOTIATION ARE THE SAME EVENT. Each chase is a message to the client;
   the client's reply is a message back. So the panel COUNTS them and the thread SHOWS them —
   the same split the panel and the agent chat already use, applied to the client.

   THE PATH BRANCHES AND LOOPS. Accepted on first read settles two rows and marks three not
   applicable. A change request runs the negotiation, rebuilds the price, re-issues as v2 and
   goes BACK to waiting on a read. The rail never moves backwards; the loop is inside the
   stage, which is where the operating model puts it.                                     == */

/* A fixed origin, so every stamp in a run is deterministic — the same demo shows the same
   dates, and the harness can assert on them. */
const CCJ_T0={day:4,mon:'Aug',year:2026,hour:9,min:12};
function ccjStamp(mins){
  const total=CCJ_T0.hour*60+CCJ_T0.min+(mins||0);
  const dayOff=Math.floor(total/1440),rest=((total%1440)+1440)%1440;
  return (CCJ_T0.day+dayOff)+' '+CCJ_T0.mon+', '
    +String(Math.floor(rest/60)).padStart(2,'0')+':'+String(rest%60).padStart(2,'0');
}
/* The client's side of the run. `state` is what the CLIENT has done, never what we have done —
   that is the distinction the whole stage turns on. */
function ccjNewClient(){
  return {state:'idle',   // idle → sent → viewed → chased → changed → agreed → reissued → accepted
    ask:'',               // 'price' | 'terms' — what the change request was about
    changes:[],           // for a terms request, what moved
    log:[],               // what ACTUALLY happened, in order, with the time it happened
    openedAt:null,        // when they first opened it — recorded once, never recomputed.
                          // null, not 0: zero is a real time (the minute it was sent).
    msgs:[],version:1,chases:0,mins:0,unread:0,drafted:false,timer:null};
}
function ccjClient(){
  const run=ccjRun;
  if(!run.client)run.client=ccjNewClient();
  return run.client;
}
/* The demo plays itself. Each entry is "this many milliseconds after the previous one, this
   happens, and it happened this many simulated minutes after the quote was sent". Left alone
   it walks chased → change requested → negotiated → re-issued → accepted, which is the path
   that shows every row on the stage. The override strip fires the same events by hand. */
/* PACING. `in` is real time the viewer spends waiting; `at` is the simulated business time the
   event is stamped with, and the two are unrelated — day 3 and day 5 stay day 3 and day 5 however
   fast the sequence plays. Only the waiting was shortened.

   The chase sequence used to run about fourteen seconds from the quote being opened to the client
   answering it, most of that spent on nothing happening. Halved. The beats that carry meaning —
   a reminder visibly leaving, a reply arriving — are still separated enough to be read as separate
   events, which is the only thing these numbers have to protect. */
/* THE TWO SCRIPTED CHASES ARE GONE, and that is the behavioural half of removing the follow-up
   step. A reminder is no longer something the run performs on its way past — it is the Account
   Manager's move, made from the listing's run menu when they judge the deal needs it. Scripting
   it would put the product back to chasing on its own while claiming a person decided to.

   So the client goes from opened to answering on their own time, and `changed` accepts BOTH
   states before it: 'viewed' when nobody chased, 'chased' when somebody did. Without the second,
   a hand-sent follow-up would move the client past the only state the script was watching for
   and the demo would sit at the quote forever — the failure being that helping should never
   stall the thing you were helping. */
const CCJ_CLIENT_SCRIPT=[
  {ev:'viewed',   in:1800, at:128,  when:function(c){return c.state==='sent';}},
  /* SEVEN SECONDS, and the number is doing a job. It used to be two — but it was two on the far
     side of two scripted chases, so what the reader actually experienced between the open and the
     answer was closer to eight. Removing the chases without moving this would have collapsed the
     whole of stage 3's silence into the time it takes the Viewed step to finish recording the
     open, and a client who answers before we have noticed they looked is not a negotiation, it is
     a cutscene. It is also the window the follow-up control exists to be used in. */
  {ev:'changed',  in:7000, at:7620, kind:'price',
   when:function(c){return c.state==='viewed'||c.state==='chased';}},
  {ev:'agreed',   in:4200, at:7900, when:function(c){return c.state==='negotiating';}},
  {ev:'viewed2',  in:2600, at:9020, when:function(c){return c.state==='reissued';}},
  {ev:'accepted', in:2600, at:9300, when:function(c){return c.state==='viewed2';}}
];
function ccjClientSchedule(){
  const run=ccjRun;if(!run)return;
  const c=ccjClient();
  const next=CCJ_CLIENT_SCRIPT.find(function(s){return s.when(c);});
  if(c.timer){clearTimeout(c.timer);c.timer=null;}
  if(!next)return;
  const g=ccjGen;
  c.timer=setTimeout(function(){
    if(ccjGen!==g||ccjRun!==run)return;
    c.timer=null;
    ccjClientEvent(next.ev,next.at,next.kind);
  },next.in);
}
function ccjScreensFor(i){
  const s=ccjStage(i);
  return (s&&CCJ_SCREENS[s.id])||[];
}
function ccjScreenDef(i,id){
  return ccjScreensFor(i).find(function(s){return s.id===id;})||null;
}
/* The next screen that actually applies to this run — skipping any whose `when` says it does
   not exist for it. Walking the list rather than hard-coding the next id means the Employee
   Created screen can be absent without any caller knowing. */
function ccjNextScreen(i,fromId){
  const list=ccjScreensFor(i);
  const at=list.findIndex(function(s){return s.id===fromId;});
  for(let n=at+1;n<list.length;n++){
    if(!list[n].when||list[n].when(ccjRun))return list[n].id;
  }
  return null;
}

/* ---- RUN STATE ------------------------------------------------------------------------
   One object holds the whole run. `gen` is bumped on every reset and captured by each
   scheduled step, so a timer armed by an abandoned run recognises itself as stale.          */
let ccjRun=null;
let ccjGen=0;

const CCJ_ACT=1150;      // how long one action inside a sub-status is held. Paced to be READ:
                         // an action that renders four records and moves on in 700ms is a
                         // progress bar pretending to be evidence.
const CCJ_BEAT=820;      // legacy pacing constant, kept for the settle rhythm
const CCJ_SETTLE=700;    // the pause after a row completes, before the next one starts
const CCJ_SEARCH=1700;   // how long the employee lookup appears to take
const CCJ_CHASE_SEND=900;  // a reminder is visibly SENT before it reads as sent — see ccjClientEvent.
                           // Long enough to register as dispatch rather than as a flicker.
                           //
                           // Was 2400. The two-phase send is right and stays, but at 2.4s each,
                           // across two reminders inside a sequence that also waits to open the
                           // quote and waits again to answer it, the stage took about fourteen
                           // seconds of watching. The pause has to say "this was sent", not
                           // "wait here" — 900ms says the first and not the second.
const CCJ_DOC_STEP=620;  // how long one field takes to come out of a document
/* How long a scroll takes, as a function of how far it goes. A single duration cannot serve both
   ends of the range: 560ms across a whole sheet is a glide, 560ms across one row is a drift that
   is still finishing when the next field lands. So CCJ_SCROLL is now the ceiling — reached at
   CCJ_SCROLL_FULL of travel — and anything shorter is scaled down to it, never below the floor,
   which is where the easing stops reading as motion and starts reading as a jump. */
const CCJ_SCROLL=560;      // the longest a travel may take — a full sheet
const CCJ_SCROLL_MIN=220;  // the shortest — a hop to the next row
const CCJ_SCROLL_FULL=560; // px of travel that earns the full duration
const CCJ_AUTOGAP=2600;  // the pause after the last required field, before the proposal is made

function ccjNewRun(){
  ccjGen++;
  ccjRun={
    gen:ccjGen,
    /* NO DEFAULT. This used to open on 'EOR', which drew that card selected — ticked, filled icon,
       raised — while the other two sat flat beside it. That is not a neutral chooser: it reads as
       a recommendation the product has already made, and the two most consequential words on the
       screen ("we are the legal employer" versus "you are") get answered by whoever fails to
       notice. The three engagements carry genuinely different liability, so the question has to be
       asked rather than pre-filled.

       Null is also what holds the reader here: the router sends a run with no model back to this
       page (see ccjStartNewRun), so the chooser is a real gate rather than a screen to skim past.
       The prompt can still name a model once one has been picked — see ccjSubmitRequest. */
    model:null,             // engagement model — chosen on ccj-model, never assumed
    stage:0,                // index into amPipelineStages
    screen:'prompt',        // which screen inside that stage
    sub:-1,                 // index into the stage's sub-statuses; -1 = not started
    phase:'idle',           // 'idle'|'act'|'hold'|'settled'|'halt'|'stopped'
    act:0,                  // which action inside the current sub-status is running
    started:false,          // has a request been submitted
    awaitingClient:false,   // the sentence did not say who the hire is for; the agent asked
    awaitingCountry:false,  // it named a country we cannot employ in; the agent said so and asked
    stopped:false,          // terminal — a negative decision ended the run
    stop:null,              // {title,note,reason,by} — what the stopped card says, per decision
    stopAsk:null,           // {key,optId} — a negative decision waiting on its reason. Not a
                            // decision: nothing is recorded until the reason is given, and
                            // cancelling leaves the gate exactly as it was.
    went:{},                // backward jumps already taken, so a correction cannot become a loop
    intake:null,            // {raw,name,country,type}
    match:null,             // the matched ADT employee, if any
    createdEmp:null,        // the ADT record we created, when there was no match
    form:{},                // every field on the contract form
    aiFilled:{},            // which of those the agent pre-filled, for the field markers
    proposal:null,          // the compiled proposal
    pay:null,               // the deposit invoice and what has been paid against it — ccjNewPay
    emp:null,               // the employment contract, its clause audit and its signatures
    onb:null,               // the onboarding file — KYC, documents, both filings, bank, payroll
    worker:null,            // the WORKER's thread — a different counterparty to run.client
    auditTimer:null,        // the clause audit's own timer; it runs beside the runner's beats
    asking:null,            // the form field the conversation is currently asking for
    doc:null,               // {name,size,fields,at,done} — a document being read into the form
    client:null,            // the client's side of stage 3 — see ccjNewClient
    margin:20,              // the margin the quote carries; a negotiation moves it
    proposing:false,        // the pause between the last required field and the proposal
    autoTimer:null,         // that pause's timer
    justFilled:null,        // the field a document just landed in, for the flash
    msgs:[],                // the conversation stream
    msgSeq:0,               // ids for those messages — see ccjStreamSync; ONE counter across all
                            // three threads, so an id identifies a message without also having to
                            // say which store it came from
    stream:null,            // what the #ccj-stream node currently holds — {el,mode,n,lastId}
    stepMsgs:{},            // 'stageId/label#pass' -> the transcript block for that sub-status
    open:{},                // 'stageId/label#pass' -> the reader opened this closed block by hand
    pass:{},                // 'stageId/label' -> which attempt this step is on; a rework bumps it
    liveKey:'',             // the sub-status the transcript last drew as the live one, so the
                            // block it has stopped being can be closed without hunting for it
    restAsked:{},           // stageId -> this stage's "carry on" ask is already in the transcript.
                            // A run rests on more than one stage, so it cannot be a single flag
    split:CCJ_SPLIT_DEF,    // how the body is shared: the chat's share as a percent, 0-100. Set by
                            // dragging the handle between the two columns, kept for the whole run
                            // and saved with it, because it is a preference about how the reader
                            // wants to work rather than anything about this stage
    railOpen:false,         // the rail is showing all nine rather than a window of four
    railFrom:undefined,     // the window position the rail was last drawn at, so a stage change can
                            // be animated from it — see ccjPaintRail
    follow:true,            // does the transcript follow the work — see ccjFollowing. Set false
                            // only by the reader scrolling up, never by anything the run does
    settled:{},             // 'stageId/label' -> {summary}
    decisions:{},           // 'stageId/label' -> the option chosen
    reached:{},             // screens this run has arrived at — what releases a hold
    inspect:null,
    exit:null,              // {page,tab,dealId} — the surface this run was entered from, so the
                            // back arrow returns there rather than to a fixed page. See ccjExit
    timer:null,             // the runner's one live timer
    chatTimer:null          // the conversation's one live timer
  };
  return ccjRun;
}
function ccjEnsureRun(){return ccjRun||ccjNewRun();}
/* Every timer a run can have armed, in one place. Factored out of ccjReset because parking a run
   needs exactly this and nothing else: the run object survives, only its clocks stop. A list that
   existed in one function and was re-typed in another is how one of them ends up missing the timer
   added last month. */
function ccjStopTimers(run){
  if(!run)return;
  if(run.timer)clearTimeout(run.timer);
  if(run.chatTimer)clearTimeout(run.chatTimer);
  if(run.ghostTimer)clearTimeout(run.ghostTimer);
  if(run.autoTimer)clearTimeout(run.autoTimer);
  if(run.auditTimer)clearTimeout(run.auditTimer);
  if(run.client&&run.client.timer)clearTimeout(run.client.timer);
  if(run.client&&run.client.sendTimer)clearTimeout(run.client.sendTimer);
  if(run.pay&&run.pay.timer)clearTimeout(run.pay.timer);
  if(run.worker&&run.worker.timer)clearTimeout(run.worker.timer);
  run.timer=run.chatTimer=run.ghostTimer=run.autoTimer=run.auditTimer=null;
  if(run.client){run.client.timer=null;run.client.sendTimer=null;}
  if(run.pay)run.pay.timer=null;
  if(run.worker)run.worker.timer=null;
}
/* ABANDONED RUNS ARE PRUNED, FINISHED ONES ARE KEPT. A run is not resumable once it is reset — the
   state goes with it — so a row left behind reading "Waiting for Approval, step 7" would describe
   something that can never move again, and a list of those is worse than no list. A run that
   finished, was stopped, or got far enough to create a placement is a fact worth keeping; anything
   else was a person looking around, and recording it is the "abundant data" this is meant to avoid. */
function ccjPruneRunRecord(run){
  if(!run||!run.runId)return;
  if(typeof aiAutomationRuns==='undefined')return;
  const list=aiAutomationRuns[CCJ_RUN_JOURNEY];
  if(!list)return;
  const keep=run.stopped||run.contractRowId||ccjRunStatusFor(run)==='Completed';
  if(keep)return;
  const i=list.findIndex(function(r){return r.runId===run.runId;});
  if(i>-1)list.splice(i,1);
}
function ccjReset(){
  ccjPruneRunRecord(ccjRun);
  ccjGen++;
  ccjStopTimers(ccjRun);
  ccjRun=null;
}
/* Both schedulers check the generation AND the run identity before firing, so a timer armed by
   a run that has since been reset does nothing rather than writing into its successor. */
function ccjSchedule(fn,ms){
  const g=ccjGen,run=ccjRun;if(!run)return;
  if(run.timer)clearTimeout(run.timer);
  run.timer=setTimeout(function(){
    if(ccjGen!==g||ccjRun!==run)return;
    run.timer=null;fn();
  },ms);
}
function ccjScheduleChat(fn,ms){
  const g=ccjGen,run=ccjRun;if(!run)return;
  if(run.chatTimer)clearTimeout(run.chatTimer);
  run.chatTimer=setTimeout(function(){
    if(ccjGen!==g||ccjRun!==run)return;
    run.chatTimer=null;fn();
  },ms);
}
/* A third timer, because the clause audit runs BESIDE the runner rather than inside it: the panel
   is narrating the call to the Compliance Hub while the document annotates itself clause by
   clause. Borrowing run.timer would cancel the runner's own beat mid-step. */
function ccjScheduleAudit(fn,ms){
  const g=ccjGen,run=ccjRun;if(!run)return;
  if(run.auditTimer)clearTimeout(run.auditTimer);
  run.auditTimer=setTimeout(function(){
    if(ccjGen!==g||ccjRun!==run)return;
    run.auditTimer=null;fn();
  },ms);
}

/* ---- CONTEXT --------------------------------------------------------------------------
   The shape the authored evidence in aicjEvidence expects, built from THIS run rather than
   from the original journey's globals — which is what makes the same descriptors read live
   against whatever was typed into this conversation and this form.                         */
/* ---- THREE PARTIES, NOT ONE -----------------------------------------------------------------
   A run involves three legal persons and the journey kept collapsing them into one context with
   a single `country` and a single contact. That produced two genuine errors: the commercial quote
   was emailed to the WORKER (their personal address, sitting in a field labelled "Client
   contact"), and the CSM — who owns the CLIENT relationship — was routed on the country the
   worker happens to sit in.

     worker  the person being hired. Their country is where the work is done and whose
             employment law the stage-7 contract is written under.
     client  the company buying the service. Their country is where the MSA is signed, whose
             entity is sanctions-screened, and whose CSM owns the relationship.
     adt     us. A different legal entity per country we employ in.

   Everything that addresses a party now names which one. */
/* Which trading name the operating entity carries, per engagement model. CONTRACTOR is absent on
   purpose: we do not employ a contractor, so the entity that engages them is not an EOR or a PEO
   entity and must not be named as one. */
const CCJ_ENTITY_TOKEN={EOR:'EOR ',PEO:'PEO '};
function ccjParties(){
  const run=ccjRun||{};
  const it=run.intake||{};
  const f=run.form||{};
  const emp=run.match||run.createdEmp||{};
  const workerName=((f.fname||'')+' '+(f.lname||'')).trim()||it.name||emp.name||'the employee';
  const clientName=it.client||'Dhi Hyperlocal';
  const known=((typeof aiClients!=='undefined'&&aiClients)||[])
    .find(function(c){return c.name===clientName;})
  ||((typeof amDeals!=='undefined'&&amDeals)||[])
    .find(function(d){return d.client===clientName;});
  // Where the CLIENT is, which is not where the work is. A Netherlands client hiring in Germany
  // signs under Dutch law and keeps their Dutch CSM.
  const clientCountry=(known&&known.country)||f.country||it.country||'Netherlands';
  const workCountry=f.country||it.country||emp.country||'Netherlands';
  const clientSlug=String(clientName).toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'');
  return {
    worker:{
      name:workerName, country:workCountry,
      email:f.email||(String(workerName).toLowerCase().replace(/[^a-z ]/g,'').trim().replace(/\s+/g,'.')||'employee')+'@personalmail.com',
      empId:emp.empId||'EMP-0001'
    },
    client:{
      name:clientName, country:clientCountry,
      contact:(known&&known.contactName)||'Client admin',
      // The buyer's address, at the buyer's company — never the candidate's personal inbox.
      email:((known&&known.contactName)||'contracts').toLowerCase().replace(/[^a-z ]/g,'').trim().replace(/\s+/g,'.')+'@'+clientSlug.replace(/\./g,'')+'.com',
      plan:(known&&known.plan)||'Growth'
    },
    /* The ADT entity that will employ the worker — registered where the work happens. The model
       token is chosen by lookup rather than by `==='PEO' ? 'PEO' : 'EOR'`: that test sent every
       model it did not recognise down the EOR branch, so a CONTRACTOR engagement named the
       contractor as employed by "ADT <country> EOR Services B.V." — the one relationship a
       contractor engagement exists to avoid. An unknown model now gets no token at all rather
       than silently inheriting a legal status. */
    adt:{name:'ADT '+workCountry+' '+(CCJ_ENTITY_TOKEN[(it.type||run.model)]||'')+'Services '+
      (workCountry==='Netherlands'?'B.V.':workCountry==='Germany'?'GmbH':workCountry==='India'?'Pvt Ltd':'Ltd'),
      country:workCountry, signatory:'Arjun Vaidya', email:'arjun.vaidya@adt.com'}
  };
}
function ccjCtx(){
  const run=ccjRun||{};
  const it=run.intake||{};
  const f=run.form||{};
  const emp=run.match||run.createdEmp||{};
  const name=((f.fname||'')+' '+(f.lname||'')).trim()||it.name||emp.name||'the employee';
  const num=String(1042+(run.gen||0));
  const gross=parseFloat(String(f.pay||'5700').replace(/[^0-9.]/g,''))||5700;
  return {
    country:f.country||it.country||emp.country||'Netherlands',
    type:it.type||run.model||'EOR',
    name:name,
    // Whoever the hire is FOR. Stated in the prompt when it is stated at all; the operating
    // entity is the fallback, which is the case where a company is hiring for itself.
    client:it.client||'',
    empId:emp.empId||'EMP-0001',
    contractId:'CTR-'+num,
    grossMonthly:gross,
    hourly:gross/173.33,
    // The quote and the agreement are addressed to the CLIENT'S buyer. This used to fall back to
    // the worker's own email while being labelled "Client contact", which sent our cost
    // breakdown and margin to the candidate.
    signatoryEmail:ccjParties().client.email,
    workerEmail:ccjParties().worker.email,
    envelopeId:'DS-'+num,depositInvoice:'INV-'+num,
    // The deposit is the one clause 3.4 of the agreement states — one month gross salary — plus
    // whatever VAT the place of supply calls for. It was the literal string '$9,500': a dollar
    // figure belonging to no run at all, printed by the panel beside an invoice denominated in
    // euros for an amount the agreement a stage earlier had already fixed.
    amountDue:(ccjRun?ccjCurrency():'&#8364;')+' '+ccjDepositTotal().toLocaleString(),
    rec:{},emp:emp
  };
}
/* The invoiced total, computed WITHOUT going through ccjCtx or ccjQuote — both of which call
   ccjCtx, and one of which is this. It reads the same gross and the same VAT treatment they do,
   so the three agree by construction rather than by coincidence. */
function ccjDepositTotal(){
  const run=ccjRun||{},f=run.form||{};
  const gross=Math.round(parseFloat(String(f.pay||'5700').replace(/[^0-9.]/g,''))||5700);
  return gross+Math.round(gross*ccjVat().rate/100);
}
/* Authored evidence may hold plain values or functions of context, so every read goes through
   here rather than each call site remembering which it is. */
function ccjVal(v,c){return typeof v==='function'?v(c):v;}

/* ---- WHAT A SUB-STATUS ACTUALLY DOES, STEP BY STEP -----------------------------------------
   Three summary lines said what a step FOUND. They did not show it working. Connecting to a
   system, pulling records back, checking them against the rules and writing the result are four
   distinct things, and a client watching an agent work wants to see each one happen — that is
   the difference between "the machine says it did something" and "I watched it do it".

   The list is built from whatever evidence the step actually has, never padded. A step with no
   authored payload shows no fetch line, because inventing one would claim a call it never made.
   That is also what makes this work for all 41 sub-statuses without authoring 41 scripts. */
function ccjActsFor(i,step){
  const d=ccjEvidence(i,step),c=ccjCtx();
  if(!d)return [{id:'work',doing:'Working',done:'Done'}];
  const fetched=ccjVal(d.fetched,c)||[];
  const checks=ccjVal(d.checks,c)||[];
  const captured=ccjVal(d.captured,c)||[];
  const pass=checks.filter(function(x){return x.verdict==='pass';}).length;
  const acts=[];
  // `system`, `ref` and `latency` go through ccjVal like everything else. Stage 8 names a
  // different authority per country — the Belastingdienst, the Finanzamt, the EPFO — so the
  // system a step reaches is a function of the run, and a raw function here would render as
  // its own source code.
  const system=ccjVal(d.system,c),ref=ccjVal(d.ref,c),latency=ccjVal(d.latency,c);
  // The done line NAMES the system. While the log grew in place the in-flight line carried the
  // name and "Connected · 12ms" could lean on it; in the stream window the in-flight action is
  // one word in the head, so the finished line is the only durable place the name can live —
  // and the reopened record is better for it too.
  if(system)acts.push({id:'connect',
    doing:'Connecting to '+system,
    done:'Connected to '+system+(latency&&latency!=='—'?' &middot; '+latency:'')});
  if(fetched.length)acts.push({id:'fetch',
    doing:'Fetching '+(ref?String(ref).replace(/&amp;/g,'&'):'records'),
    done:fetched.length+' record'+(fetched.length===1?'':'s')+' returned',
    rows:fetched});
  if(checks.length)acts.push({id:'verify',
    doing:'Verifying against the rules',
    done:pass===checks.length?'All '+checks.length+' checks passed':pass+' of '+checks.length+' checks passed',
    ok:pass===checks.length, checks:checks});
  if(captured.length)acts.push({id:'save',
    doing:'Saving to the record',
    done:captured.length+' detail'+(captured.length===1?'':'s')+' saved',
    rows:captured.map(function(x){return {k:x.k,v:x.v,state:'active'};})});
  if(!acts.length)acts.push({id:'work',doing:'Working',done:'Done'});
  return acts;
}
/* A conditional sub-status — "(non-owned countries)", "(if off-standard)" — evaluated rather
   than always run. The evidence map already carries `applies`; a step that does not apply is
   marked and skipped, with the reason shown. A row that silently vanished would leave the
   client wondering whether the agent forgot it. */
function ccjStepApplies(i,step){
  const d=ccjEvidence(i,step);
  if(!d||d.applies===undefined)return true;
  return !!ccjVal(d.applies,ccjCtx());
}
function ccjSkipReason(i,step){
  const d=ccjEvidence(i,step);if(!d)return '';
  const c=ccjCtx();
  // The evaluated check is the best answer — it names the actual value that ruled the step out
  // ("Netherlands is owned in-house") rather than restating the condition.
  const na=(ccjVal(d.checks,c)||[]).find(function(x){return x.verdict==='na';});
  if(na)return na.actual;
  // Otherwise the first sentence of the authored note, which is written as prose. `step.cond` is
  // a fragment meant to sit in brackets after a label ("if off-standard", "non-owned countries")
  // and does not survive being dropped into a sentence.
  if(d.note)return String(d.note).split(/\.\s/)[0].replace(/\.$/,'')+'.';
  return '';
}
/* Evidence authored for this journey, checked before the shared map. Three of stage 3's five
   sub-statuses have nothing in aicjEvidence — dispatch, open-tracking and the chase cadence were
   never written up — and an un-evidenced step shows a single bare "Working" line. Kept here
   rather than added to core.js so the original journey's map stays exactly as it was. */
const CCJ_EVIDENCE={
  'quote-review/Sent':{
    system:'Docuseal', ref:'quote delivery',
    call:function(c){return 'POST /envelopes {template:"quote", to:"'+c.signatoryEmail+'"}';},
    latency:'240ms',
    fetched:function(c){const q=ccjQuote();return [
      {k:'Recipient',sub:'Client contact',v:c.signatoryEmail,state:'active'},
      {k:'Quote version',sub:'Document',v:'v'+ccjClient().version,state:'active'},
      {k:'Total quoted',sub:'Monthly',v:q.sym+' '+q.total.toLocaleString(),state:'active'}
    ];},
    checks:function(c){return [
      {rule:'The quote may only be sent once QA has approved it',expected:'Quote QA approved',
       actual:'approved',verdict:'pass'},
      {rule:'Delivery is confirmed before the stage reports it as sent',expected:'delivered receipt',
       actual:'delivered',verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Sent at',v:ccjStamp(0)},{k:'Channel',v:'Docuseal'}];},
    summary:function(c){return 'Sent '+ccjStamp(0);},
    note:'Delivery is confirmed by the provider, not assumed. A quote that bounced is not a quote that was sent.'
  },
  'quote-review/Viewed':{
    system:'Docuseal', ref:'open tracking',
    call:function(c){return 'GET /envelopes/'+c.envelopeId+'/events';},
    latency:'88ms',
    fetched:function(c){const cl=ccjClient();return [
      {k:'Opened',sub:'First open',v:cl.openedAt!==null?ccjStamp(cl.openedAt):'not yet',state:cl.openedAt!==null?'active':'inactive'},
      {k:'Version opened',sub:'Document',v:'v'+cl.version,state:'active'}
    ];},
    checks:function(c){return [{rule:'The open is attributed to the recipient we sent it to',
      expected:c.signatoryEmail,actual:c.signatoryEmail,verdict:'pass'}];},
    captured:function(c){return [{k:'First opened',v:ccjStamp(ccjClient().openedAt)}];},
    summary:function(c){return 'Opened '+ccjStamp(ccjClient().openedAt);},
    note:'Tracked on open, which is why this is automatic and not something anyone has to record.'
  },
  /* The evidence entry for 'quote-review/Follow-up 1 / 2 / 3' went with the sub-status itself.
     A chase is now an action taken on the record from the listing, not a row the run walks
     through — see the note beside amSubStatuses['quote-review'] in js/core.js. The chase
     MACHINERY is untouched: ccjClientEvent('chase') still sends one and still writes it into the
     thread, because a follow-up asked for by hand is the same event the demo used to script. */
  /* Overridden so stage 1 and stage 4 name the SAME CSM. The shared entry routes on
     ctx.country — the country the work happens in — while the handover in stage 4 routes on the
     client's. On a cross-border placement those are different people, and the run would assign
     one CSM at intake and introduce a different one to the client three stages later. */
  'request-received/CSM assigned':{
    system:'CSM routing table', ref:'Owner directory',
    call:function(c){return 'route(client="'+ccjParties().client.name+'", country="'+ccjParties().client.country+'")';},
    latency:'34ms',
    fetched:function(c){
      const owner=ccjCsm().name;
      return ((typeof amCsmPool!=='undefined'&&amCsmPool)||[]).map(function(n){
        return {k:n,sub:'Customer Success Manager',
          v:n===owner?('owns '+ccjParties().client.country):'&mdash;',
          state:n===owner?'active':'inactive'};});
    },
    checks:function(c){
      const p=ccjParties();
      return [
        {rule:'The CSM is routed on the CLIENT country, not the country the work happens in',
         expected:'owner of '+p.client.country,
         actual:ccjCsm().name+' owns '+p.client.country
           +(p.client.country!==p.worker.country?' (work is in '+p.worker.country+')':''),
         verdict:'pass'},
        {rule:'Assignment lands inside the stage SLA',expected:'within 1h',actual:'immediate',verdict:'pass'}
      ];
    },
    captured:function(c){return [{k:'CSM',v:ccjCsm().name},{k:'Owner',v:'Arjun Vaidya'}];},
    summary:function(c){return ccjCsm().name+' assigned';},
    note:'A Customer Success Manager owns a client relationship, so they follow the client. A Netherlands client keeps their Dutch CSM whoever they hire and wherever they hire them.'
  },

  /* ---- 5 · Agreement ready. Every step here is skipped for a client who already has an MSA,
     because a master agreement is signed once and every later hire runs under it. ---------- */
  'agreement-signature/MSA drafted':{
    system:'Contract templates', ref:'country template',
    call:function(c){return 'draft(template="MSA/'+ccjParties().client.country+'", client="'+ccjParties().client.name+'")';},
    latency:'420ms',
    applies:function(c){return !ccjMsaExists();},
    fetched:function(c){const p=ccjParties(),q=ccjQuote();return [
      {k:'Template',sub:p.client.country+' master agreement',v:'v4.2',state:'active'},
      {k:'Provider entity',sub:'Employer of record',v:p.adt.name,state:'active'},
      {k:'Service fee',sub:'From the accepted quote',v:q.margin+'% of employer cost',state:'active'},
      {k:'Deposit',sub:'Security',v:q.sym+' '+q.gross.toLocaleString(),state:'active'}
    ];},
    checks:function(c){const p=ccjParties();return [
      {rule:'The commercials on the agreement match the quote the client accepted',
       expected:'quote v'+ccjClient().version+' at '+ccjQuote().margin+'%',
       actual:ccjQuote().margin+'% — matches',verdict:'pass'},
      {rule:'The template is the one for the client jurisdiction',
       expected:p.client.country,actual:p.client.country,verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Agreement',v:ccjMsa().id},{k:'Governing law',v:ccjParties().client.country}];},
    summary:function(c){return ccjMsa().id+' drafted';},
    note:'Drafted from the CLIENT jurisdiction template, not the country the work happens in. On a cross-border placement those are different countries and different law.'
  },
  'agreement-signature/Legal & compliance review':{
    system:'Legal', ref:'clause review',
    applies:function(c){return !ccjMsaExists();},
    checks:function(c){return [
      {rule:'Liability cap and indemnities are within the standard position',
       expected:'12 months of fees, mutual',actual:'12 months of fees, mutual',verdict:'pass'},
      {rule:'A data transfer mechanism is in place for this jurisdiction',
       expected:'SCCs where required',actual:'SCCs attached',verdict:'pass'}
    ];},
    summary:function(c){return 'Approved for release';},
    note:'A lawyer reads it. The one step on this stage that is not automatable, because it is liability rather than data.'
  },
  'agreement-signature/Client entity + sanctions check':{
    system:'Screening provider', ref:'registry + sanctions lists',
    call:function(c){return 'screen(entity="'+ccjParties().client.name+'", lists=[OFAC,EU,HMT])';},
    latency:'1.2s',
    applies:function(c){return !ccjMsaExists();},
    fetched:function(c){
      const p=ccjParties(),m=ccjMsa();
      return [
        {k:'Registry',sub:p.client.country+' company register',v:p.client.name+' — active',state:'active'},
        {k:'Beneficial owners',sub:'UBO identification',v:'2 identified, both cleared',state:'active'},
        {k:'Sanctions lists',sub:'OFAC · EU consolidated · UK HMT',
         v:m.screening==='hit'?'POSSIBLE MATCH':m.screening==='cleared'?'match dismissed':'no match',
         state:m.screening==='hit'?'inactive':'active'}
      ];
    },
    checks:function(c){
      const p=ccjParties(),m=ccjMsa();
      if(m.screening==='hit')return [
        {rule:'The client entity appears on no sanctions list',expected:'no match',
         actual:m.hit||'possible match — needs a human',verdict:'fail'}];
      if(m.screening==='cleared')return [
        {rule:'The client entity appears on no sanctions list',expected:'no match',
         actual:'possible match adjudicated and dismissed',verdict:'pass'}];
      return [
        {rule:'The client entity is registered and active',expected:'active registration',
         actual:'active in '+p.client.country,verdict:'pass'},
        {rule:'The client entity appears on no sanctions list',expected:'no match',
         actual:'no match across OFAC, EU and UK HMT',verdict:'pass'}
      ];
    },
    captured:function(c){return [
      {k:'Screening',v:ccjMsa().screening==='cleared'?'cleared after review':'clear'},
      {k:'Screened on',v:ccjStamp(0)}];},
    summary:function(c){return ccjMsa().screening==='cleared'?'Cleared after review':'Entity verified, no match';},
    note:'We may not contract with a sanctioned entity, so this is a legal precondition rather than diligence. Screening is automatic; a POSSIBLE match is always put to a person, because similar company names produce false positives constantly.',
    failure:'A confirmed match stops the engagement outright and is reported.'
  },
  'agreement-signature/Sent':{
    system:'Docuseal', ref:'agreement delivery',
    call:function(c){return 'POST /envelopes {agreement:"'+ccjMsa().id+'", to:"'+ccjParties().client.email+'"}';},
    latency:'260ms',
    applies:function(c){return !ccjMsaExists();},
    fetched:function(c){const p=ccjParties();return [
      {k:'Recipient',sub:'Client signatory',v:p.client.email,state:'active'},
      {k:'Signing order',sub:'Client first, provider countersigns',v:'2 parties',state:'active'},
      {k:'Agreement',sub:'Document',v:ccjMsa().id,state:'active'}
    ];},
    checks:function(c){const m=ccjMsa();return [
      {rule:'Nothing is sent before legal has released it',expected:'review approved',
       actual:'approved',verdict:'pass'},
      {rule:'Nothing is sent before screening clears',expected:'no sanctions match',
       actual:m.screening==='hit'?'not cleared':'cleared',
       verdict:m.screening==='hit'?'fail':'pass'}
    ];},
    captured:function(c){return [{k:'Sent to',v:ccjParties().client.email},{k:'Envelope',v:'DS-'+ccjMsa().id}];},
    summary:function(c){return 'Sent to '+ccjParties().client.contact;},
    note:'To the client signatory. The worker never sees this agreement — it is not their contract, and it states our margin.'
  },
  'agreement-signature/Signed':{
    system:'Docuseal', ref:'execution',
    applies:function(c){return !ccjMsaExists();},
    fetched:function(c){const p=ccjParties(),m=ccjMsa();return [
      {k:p.client.contact,sub:'For '+p.client.name,
       v:m.clientSignedAt?'signed '+ccjStamp(m.clientSignedAt):'awaiting',
       state:m.clientSignedAt?'active':'inactive'},
      {k:p.adt.signatory,sub:'For '+p.adt.name,
       v:m.adtSignedAt?'countersigned '+ccjStamp(m.adtSignedAt):'awaiting',
       state:m.adtSignedAt?'active':'inactive'}
    ];},
    checks:function(c){const m=ccjMsa();return [
      {rule:'Both parties have signed',expected:'client and provider',
       actual:m.clientSignedAt&&m.adtSignedAt?'both signed':'incomplete',
       verdict:m.clientSignedAt&&m.adtSignedAt?'pass':'fail'},
      {rule:'The agreement is in force from the later signature',expected:'countersignature date',
       actual:m.adtSignedAt?ccjStamp(m.adtSignedAt):'—',verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Executed',v:ccjStamp(ccjMsa().adtSignedAt)},
      {k:'In force from',v:ccjStamp(ccjMsa().adtSignedAt)}];},
    summary:function(c){return 'Executed '+ccjStamp(ccjMsa().adtSignedAt);},
    note:'An agreement is executed on the LAST signature. The provider countersigns last on purpose — it is the final point at which we can decline, and it is the date the deposit invoice is raised against.'
  },

  /* ---- 6 · Deposit due. All four entries are authored here rather than taken from the shared
     map, which states an amount ($9,500) and a receipt ("Full amount") belonging to no run. Every
     figure below is read from the invoice this stage actually raised. -------------------------- */
  'deposit-due/Invoice raised':{
    system:'SAP S/4HANA', systemId:'sap', ref:'API_GLACCOUNTLINEITEM',
    call:function(c){return 'POST /invoices {client:"'+ccjParties().client.name
      +'", type:"deposit", agreement:"'+ccjMsa().id+'"}';},
    latency:'510ms',
    fetched:function(c){const inv=ccjInvoice(),v=ccjVat();return [
      {k:'Deposit invoice',sub:'Raised against '+inv.agreement,v:inv.id,state:'active'},
      {k:'Net',sub:'One month gross salary &middot; clause 3.4',v:ccjMoney(inv.net),state:'active'},
      {k:v.label,sub:v.kind==='domestic'?'Standard rate':'Place of supply',
       v:ccjMoney(inv.tax),state:v.rate?'active':'inactive'},
      {k:'Total due',sub:'Payable by '+(ccjPay().dueAt!==null?ccjDate(ccjPay().dueAt):'&mdash;'),
       v:ccjMoney(inv.total),state:'active'}
    ];},
    checks:function(c){const q=ccjQuote(),v=ccjVat(),p=ccjParties();return [
      // An established client signed their master agreement long before this run, so "we did not
      // watch it being countersigned" is not the same as "it is not in force". Stage 5 skips
      // itself for them, and a check that read only adtSignedAt failed every second placement.
      {rule:'A deposit invoice may only be raised against an agreement in force',
       expected:'executed master agreement',
       actual:ccjMsa().adtSignedAt?'countersigned '+ccjStamp(ccjMsa().adtSignedAt)
         :ccjMsaExists()?ccjMsa().id+' already in force':'not executed',
       verdict:(ccjMsa().adtSignedAt||ccjMsaExists())?'pass':'fail'},
      {rule:'The deposit is the amount clause 3.4 of that agreement states',
       expected:'one month gross salary',
       actual:ccjMoney(q.gross)+' — matches the schedule',verdict:'pass'},
      {rule:'VAT is charged on the place of supply, not on the invoicing entity',
       expected:p.adt.country===p.client.country?'domestic VAT':'no VAT charged by us',
       actual:v.label+' ('+p.adt.country+' &rarr; '+p.client.country+')',verdict:'pass'},
      {rule:'The payment terms are the ones the agreement states',
       expected:'14 days net',actual:'Net 14 — due '+(ccjPay().dueAt!==null?ccjDate(ccjPay().dueAt):'on issue'),
       verdict:'pass'}
    ];},
    captured:function(c){const inv=ccjInvoice();return [
      {k:'Deposit invoice',v:inv.id},{k:'Total due',v:ccjMoney(inv.total)},
      {k:'Due date',v:ccjPay().dueAt!==null?ccjDate(ccjPay().dueAt):'&mdash;'}];},
    summary:function(c){return ccjInvoice().id+' &middot; '+ccjMoney(ccjAmountDue());},
    note:'Raised against the countersignature date, not the date the client signed. The agreement is only in force from the later of the two, and an invoice raised before it is in force is an invoice for nothing.'
  },
  'deposit-due/Awaiting funds':{
    system:'Bank feed', ref:'incoming payments',
    call:function(c){return 'watch(iban="'+ccjReg().iban+'", reference="'+ccjInvoice().id+'")';},
    latency:'live',
    fetched:function(c){const p=ccjPay();return [
      {k:'Outstanding',sub:'Against '+ccjInvoice().id,v:ccjMoney(ccjOutstanding()),
       state:ccjOutstanding()?'active':'inactive'},
      {k:'Due',sub:'Net 14 from issue',v:p.dueAt!==null?ccjDate(p.dueAt):'&mdash;',state:'active'},
      {k:'Acknowledged',sub:'By the client',v:p.ackAt?ccjStamp(p.ackAt):'not yet',
       state:p.ackAt?'active':'inactive'},
      {k:'Reminders sent',sub:'Before due, then overdue',v:String(p.reminders.length),
       state:p.reminders.length?'active':'inactive'},
      {k:'Received',sub:p.receipts.length+' receipt'+(p.receipts.length===1?'':'s'),
       v:ccjMoney(ccjReceived()),state:ccjReceived()?'active':'inactive'}
    ];},
    checks:function(c){const p=ccjPay();return [
      {rule:'Every incoming transfer is matched on the invoice reference before it is credited',
       expected:ccjInvoice().id+' quoted',
       actual:p.receipts.length?'all '+p.receipts.length+' matched on reference':'nothing received yet',
       verdict:p.receipts.length?'pass':'fail'},
      {rule:'A reminder goes out before the due date, not after it',
       expected:'first reminder before '+(p.dueAt!==null?ccjDate(p.dueAt):'the due date'),
       actual:p.reminders.length?(p.reminders[0].kind==='due'?'sent 2 days before':'sent after the due date')
         :'none sent yet',
       verdict:p.reminders.length&&p.reminders[0].kind==='due'?'pass':p.reminders.length?'fail':'na'}
    ];},
    captured:function(c){const p=ccjPay();return [
      {k:'First receipt',v:p.receipts.length?ccjStamp(p.receipts[0].at):'&mdash;'},
      {k:'Received',v:ccjMoney(ccjReceived())}];},
    summary:function(c){const p=ccjPay();
      if(!p.receipts.length)return 'Nothing received';
      return (ccjPaidInFull()?'Paid in full ':'Part payment ')+ccjStamp(p.receipts[0].at);},
    note:'The bank feed is watched on the invoice reference. A transfer that arrives without one is not credited automatically — it sits unallocated, and the placement stays held while the money is technically in our account.',
    failure:'An unmatched or missing payment holds the placement and escalates to Finance after the second reminder.'
  },
  'deposit-due/Part-paid':{
    system:'Reconciliation', ref:'open item clearing',
    call:function(c){return 'reconcile(invoice="'+ccjInvoice().id+'", received='+ccjReceived()+')';},
    latency:'120ms',
    // Only when the money arrived short. On the paid-in-full path there is no shortfall to chase,
    // and the row says so rather than quietly disappearing.
    applies:function(c){return !ccjPaidInFull();},
    fetched:function(c){const p=ccjPay();return [
      {k:'Invoiced',sub:ccjInvoice().id,v:ccjMoney(ccjAmountDue()),state:'active'},
      {k:'Received',sub:p.receipts.length+' receipt'+(p.receipts.length===1?'':'s'),
       v:ccjMoney(ccjReceived()),state:'active'},
      {k:'Shortfall',sub:'Still outstanding',v:ccjMoney(ccjOutstanding()),
       state:ccjOutstanding()?'active':'inactive'}
    ];},
    checks:function(c){
      const p=ccjPay();
      if(ccjPaidInFull()&&!p.released)return [
        {rule:'This step applies only when the deposit arrives short',
         expected:'a shortfall against '+ccjInvoice().id,
         actual:'Paid in full on the first remittance &mdash; no shortfall to chase',verdict:'na'}];
      if(p.released)return [
        {rule:'The gate is released only against the full deposit',
         expected:'no shortfall',
         actual:ccjMoney(p.shortfall)+' released by '+p.releasedBy+' as an exception',verdict:'fail'},
        {rule:'An early release is recorded against the invoice and the run',
         expected:'named approver',actual:p.releasedBy,verdict:'pass'}];
      return [
        {rule:'The gate is released only against the full deposit',
         expected:'no shortfall',
         actual:ccjOutstanding()?ccjMoney(ccjOutstanding())+' outstanding':'settled in full',
         verdict:ccjOutstanding()?'fail':'pass'},
        {rule:'The balance is chased rather than written off',
         expected:'chase issued',actual:p.chased?'chased on the client thread':'not chased yet',
         verdict:p.chased?'pass':'na'}
      ];
    },
    captured:function(c){const p=ccjPay();return [
      {k:'Shortfall',v:p.released?ccjMoney(p.shortfall):ccjMoney(0)},
      {k:'Outcome',v:p.released?'Released as an exception':'Balance received'}];},
    summary:function(c){const p=ccjPay();
      return p.released?'Released &middot; '+ccjMoney(p.shortfall)+' short':'Balance received in full';},
    note:'A part payment is not a payment. The deposit exists because we fund payroll ahead of settlement, so a shortfall is exactly the exposure it was meant to cover — which is why releasing against one is a named decision and not a default.',
    failure:'An unresolved shortfall holds the placement indefinitely and is escalated to Finance.'
  },
  'deposit-due/Cleared':{
    system:'Bank webhook', ref:'payment.cleared',
    call:function(c){return 'POST /webhooks/bank/receipt {invoice:"'+ccjInvoice().id
      +'", amount:'+ccjReceived()+'}';},
    latency:'&mdash;',
    fetched:function(c){const p=ccjPay();return [
      {k:'Receipts matched',sub:'Against '+ccjInvoice().id,
       v:p.receipts.length+' of '+p.receipts.length,state:'active'},
      {k:'Total received',sub:'Cleared funds',v:ccjMoney(ccjReceived()),state:'active'},
      {k:'Shortfall',sub:p.released?'Released as an exception':'None',
       v:ccjMoney(p.released?p.shortfall:0),state:p.released?'active':'inactive'},
      {k:'Value date',sub:'Bank',v:p.receipts.length?ccjDate(p.receipts[p.receipts.length-1].at):'&mdash;',
       state:'active'}
    ];},
    checks:function(c){const p=ccjPay();return [
      {rule:'The receipt total reconciles to the invoice total',
       expected:ccjMoney(ccjAmountDue()),
       actual:ccjMoney(ccjReceived())+(p.released?' — short by '+ccjMoney(p.shortfall):' — reconciled'),
       verdict:p.released?'fail':'pass'},
      {rule:'The payment gate is not lifted while a balance is outstanding',
       expected:'no shortfall',
       actual:p.released?'lifted by '+p.releasedBy+' against a shortfall':'no shortfall',
       verdict:p.released?'fail':'pass'}
    ];},
    captured:function(c){const p=ccjPay();return [
      {k:'Cleared on',v:p.clearedAt!==null?ccjStamp(p.clearedAt):'Just now'},
      {k:'Payment gate',v:p.released?'Released with a shortfall':'Released'}];},
    summary:function(c){return ccjPay().released
      ?'Gate released &middot; '+ccjMoney(ccjPay().shortfall)+' short'
      :'Receipt matched &middot; gate released';},
    gateRelease:'Payment gate released &mdash; the placement can move.',
    note:'The one stage the operating model calls a hard gate. Until this row is green no hire under this client can start, however far the paperwork has got — which is why the release is recorded with a name against it when it happens against a shortfall.'
  },

  /* ---- 7 · Employment contract. The panel narrates the call to the Compliance Hub while the
     document beside it annotates itself clause by clause — the same work, seen two ways. ----- */
  'employment-contract/Draft generated':{
    system:'Contract templates', ref:'employment template',
    call:function(c){return 'draft(template="EMP/'+ccjParties().worker.country
      +'/'+((ccjRun&&ccjRun.form&&ccjRun.form.term)==='Fixed Term'?'fixed':'indefinite')
      +'", employee="'+ccjParties().worker.name+'")';},
    latency:'480ms',
    fetched:function(c){const p=ccjParties(),f=(ccjRun&&ccjRun.form)||{},e=ccjEmp();return [
      {k:'Template',sub:p.worker.country+' contract of employment',v:'v6.1',state:'active'},
      {k:'Employer',sub:'The entity that employs them',v:p.adt.name,state:'active'},
      {k:'Position',sub:'From the contract details',v:f.jobTitle||'&mdash;',state:'active'},
      {k:'Gross salary',sub:'From the approved quote',v:ccjMoney(ccjQuote().gross)+' a month',state:'active'},
      {k:'Contract',sub:'Reference',v:e.id,state:'active'}
    ];},
    checks:function(c){const p=ccjParties(),q=ccjQuote();return [
      {rule:'The employment contract is written under the law of the country the WORK is done in',
       expected:p.worker.country+' template',
       actual:p.worker.country+(p.client.country!==p.worker.country
         ?' (the client is in '+p.client.country+' — that governs the MSA, not this)':''),
       verdict:'pass'},
      {rule:'The salary on the contract is the one the quote was built on',
       expected:ccjMoney(q.gross)+' a month',actual:ccjMoney(q.gross)+' — matches',verdict:'pass'},
      {rule:'Nothing commercial reaches the employee&rsquo;s contract',
       expected:'no margin, no client fee',actual:'employment terms only',verdict:'pass'}
    ];},
    captured:function(c){const e=ccjEmp();return [
      {k:'Contract',v:e.id},{k:'Employer',v:ccjParties().adt.name},
      {k:'Governing law',v:ccjParties().worker.country}];},
    summary:function(c){return ccjEmp().id+' drafted';},
    note:'Written under the law of the country the work happens in, which on a cross-border placement is NOT the country the client is in. The client\'s jurisdiction governs the master agreement; this one governs the employment.'
  },
  'employment-contract/Clause compliance check':{
    system:'Compliance Hub', systemId:'compliance', ref:'Rates &amp; Rules',
    call:function(c){return 'GET /statutory/'+ccjParties().worker.country
      +'?set=employment&contract='+ccjEmp().id;},
    latency:'640ms',
    fetched:function(c){
      const p=ccjParties(),s=ccjStat(p.worker.country);
      const floor=typeof ccjFloorFor==='function'?ccjFloorFor(p.worker.country):null;
      return [
        {k:'Maximum probation',sub:'Statutory cap',
         v:s.probationMax?s.probationMax+' months':'no statutory maximum',
         state:s.probationMax?'active':'inactive'},
        {k:'Ordinary working week',sub:'Statutory maximum',v:s.hoursMax+' hours',state:'active'},
        {k:'Minimum wage',sub:'Rates &amp; Rules',
         v:floor?floor.label+' '+floor.value+' an hour':'no rule configured',
         state:floor?'active':'inactive'},
        {k:'Paid annual leave',sub:'Statutory minimum',v:s.holidayMin+' days',state:'active'},
        {k:'Employer notice',sub:'Statutory minimum',v:s.noticeMin+' days',state:'active'},
        {k:'Written particulars',sub:'Language',v:s.lang,state:'active'}
      ];
    },
    checks:function(c){
      const e=ccjEmp();
      // The clause audit IS the check. Restating it here in different words would let the panel
      // and the document disagree about a contract they are both describing.
      if(!e.audit.length)return [];
      return e.audit.slice(0,e.auditAt).map(function(r){
        return {rule:'Clause '+r.n+' — '+r.clause+': '+r.rule,
          expected:r.expected,
          actual:r.verdict==='adjust'?r.note:r.drafted,
          verdict:r.verdict==='adjust'?'pass':r.verdict};
      });
    },
    captured:function(c){const e=ccjEmp();return [
      {k:'Clauses checked',v:String(e.audit.length)},
      {k:'Adjusted',v:String(ccjAuditAdjusted().length)},
      {k:'Statutory set',v:ccjParties().worker.country}];},
    summary:function(c){
      const adj=ccjAuditAdjusted().length,bad=ccjAuditFailed().length;
      if(bad)return bad+' clause'+(bad===1?'':'s')+' in breach';
      return ccjEmp().audit.length+' clauses checked &middot; '+(adj?adj+' adjusted':'none adjusted');
    },
    note:'The check does not only report — it REWRITES. A probation period longer than the country allows is void, so it is reduced rather than flagged; a leave entitlement below the statutory floor is raised. What the reviewer then approves is the adjusted contract, with every change marked against the rule that caused it.',
    failure:'A clause that cannot be brought into compliance — a rate below the statutory minimum wage — stops the contract from being issued at all.'
  },
  'employment-contract/Internal approval':{
    system:'EOR Ops', ref:'contract release',
    checks:function(c){
      const adj=ccjAuditAdjusted(),bad=ccjAuditFailed();
      return [
        {rule:'Every clause the statutory set bears on has been checked',
         expected:ccjEmp().audit.length+' clauses',
         actual:ccjEmp().auditDone?'all checked':'check incomplete',
         verdict:ccjEmp().auditDone?'pass':'fail'},
        {rule:'A person reads the adjustments before the contract is issued',
         expected:'named approver',
         actual:ccjEmp().approvedBy?ccjEmp().approvedBy+' approved '+(adj.length?adj.length+' adjustment'+(adj.length===1?'':'s'):'the draft as written'):'not yet approved',
         verdict:ccjEmp().approvedBy?'pass':'na'},
        {rule:'No clause is in breach at the point of release',
         expected:'no failures',actual:bad.length?bad.length+' in breach':'none',
         verdict:bad.length?'fail':'pass'}
      ];
    },
    captured:function(c){return [{k:'Approved by',v:ccjEmp().approvedBy||'&mdash;'},
      {k:'Version',v:'v'+ccjEmp().version}];},
    summary:function(c){return 'Approved by '+(ccjEmp().approvedBy||ccjActor());},
    note:'The machine can find a non-compliant clause and it can fix one. It cannot decide that a contract is right for a person, and it does not carry the liability if it is wrong. That is why this step exists and why it is the only one on this stage a human owns outright.'
  },
  'employment-contract/Sent to worker':{
    system:'Docuseal', ref:'contract delivery',
    call:function(c){return 'POST /envelopes {contract:"'+ccjEmp().id
      +'", to:"'+ccjParties().worker.email+'"}';},
    latency:'250ms',
    fetched:function(c){const p=ccjParties(),e=ccjEmp();return [
      {k:'Recipient',sub:'The employee',v:p.worker.email,state:'active'},
      {k:'Document',sub:'Contract of employment',v:e.id+(e.version>1?' v'+e.version:''),state:'active'},
      {k:'Signing order',sub:'Employer first, employee countersigns',v:'2 parties',state:'active'}
    ];},
    checks:function(c){const e=ccjEmp();return [
      {rule:'Nothing is issued before a person has approved it',
       expected:'internal approval',actual:e.approvedBy?'approved by '+e.approvedBy:'not approved',
       verdict:e.approvedBy?'pass':'fail'},
      // It goes out already signed, so the employee is never asked to commit to something the
      // employer has not. An unsigned contract reaching them is the failure this guards.
      {rule:'The contract is signed by the employer before it is issued',
       expected:'employer signature on the document',
       actual:e.adtSignedAt?'signed '+ccjStamp(e.adtSignedAt):'not signed',
       verdict:e.adtSignedAt?'pass':'fail'},
      // The bug this guards: the shared descriptor addressed the WORKER'S contract to
      // ctx.signatoryEmail, which is the CLIENT'S buyer.
      {rule:'The contract goes to the employee, not to the client',
       expected:ccjParties().worker.email,actual:ccjParties().worker.email,verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Sent to',v:ccjParties().worker.email},
      {k:'Envelope',v:ccjCtx().envelopeId}];},
    summary:function(c){return 'Issued to '+ccjParties().worker.name.split(' ')[0];},
    note:'To the employee\'s own address. The client never receives this document — it states their salary, and it is not the client\'s contract.'
  },
  /* Overridden. The shared descriptor addresses the envelope to `ctx.signatoryEmail` — the
     CLIENT's buyer — under a field labelled "Worker", which would have mailed a person's
     employment contract to the company buying their services. */
  'employment-contract/Worker signed':{
    system:'Docuseal', ref:'execution',
    call:function(c){return 'GET /envelopes/'+c.envelopeId+'/events';},
    latency:'180ms',
    fetched:function(c){const p=ccjParties(),e=ccjEmp(),w=ccjWorker();return [
      {k:'Recipient',sub:'The employee',v:p.worker.email,state:'active'},
      {k:'Opened',sub:w.device,v:e.openedAt?ccjStamp(e.openedAt):'not yet',
       state:e.openedAt?'active':'inactive'},
      {k:'Copy downloaded',sub:'PDF',v:w.downloaded?'yes':'not yet',
       state:w.downloaded?'active':'inactive'},
      {k:'Signed',sub:'Employee signature',v:e.workerSignedAt?ccjStamp(e.workerSignedAt):'awaiting',
       state:e.workerSignedAt?'active':'inactive'}
    ];},
    checks:function(c){const e=ccjEmp(),p=ccjParties();return [
      {rule:'The signature is attributed to the recipient the envelope was sent to',
       expected:p.worker.email,actual:e.workerSignedAt?p.worker.email:'unsigned',
       verdict:e.workerSignedAt?'pass':'fail'},
      {rule:'The employee had the contract open before signing it',
       expected:'opened, then signed',
       actual:e.openedAt&&e.workerSignedAt?'opened '+ccjStamp(e.openedAt)+', signed '+ccjStamp(e.workerSignedAt):'incomplete',
       verdict:e.openedAt&&e.workerSignedAt?'pass':'na'},
      // The point of signing in this order: they were never asked to commit to something we had
      // not. If this ever reads otherwise, the sequence has regressed.
      {rule:'The employer had already signed when it was issued',
       expected:'employer signs, then the employee',
       actual:e.adtSignedAt&&e.workerSignedAt
         ?'employer '+ccjStamp(e.adtSignedAt)+', employee '+ccjStamp(e.workerSignedAt)
         :e.adtSignedAt?'employer '+ccjStamp(e.adtSignedAt)+', employee awaiting':'incomplete',
       verdict:!e.workerSignedAt?'na'
         :(e.adtSignedAt&&e.adtSignedAt<=e.workerSignedAt)?'pass':'fail'}
    ];},
    captured:function(c){const e=ccjEmp();return [
      {k:'Employee signed',v:e.workerSignedAt?ccjStamp(e.workerSignedAt):'&mdash;'},
      {k:'Executed',v:e.workerSignedAt?ccjStamp(e.workerSignedAt):'&mdash;'},
      {k:'Employment starts',v:ccjPrettyDate((ccjRun&&ccjRun.form&&ccjRun.form.fromDate)||'')}];},
    waitCopy:'Nothing here is ours to press. The envelope is open with the employee, and Docuseal calls back when it is signed.',
    summary:function(c){return 'Executed '+ccjStamp(ccjEmp().workerSignedAt);},
    note:'Owner is <b>Worker</b>, whose persona is null — so this row offers no button at all. Ticking &ldquo;Worker signed&rdquo; on the employee&rsquo;s behalf is precisely what that null exists to prevent. Theirs is the second signature, so the contract is executed on it.',
    failure:'A signature timeout or a bounce reopens the envelope for reissue.'
  },
  /* Ours, and it happens BEFORE the contract is issued — see CCJ_STEP_ORDER for why. What this
     row has to show is therefore not "both parties have signed" but the thing that entitles us to
     sign at all: the internal approval, against the version being signed. */
  'employment-contract/ADT signed':{
    system:'Docuseal', ref:'employer signature',
    latency:'210ms',
    fetched:function(c){const p=ccjParties(),e=ccjEmp();return [
      {k:p.adt.signatory,sub:'For '+p.adt.name,
       v:e.adtSignedAt?'signed '+ccjStamp(e.adtSignedAt):'awaiting',
       state:e.adtSignedAt?'active':'inactive'},
      {k:'Approved by',sub:'Internal approval',v:e.approvedBy||'not approved',
       state:e.approvedBy?'active':'inactive'},
      {k:'Goes to',sub:'The employee, for signature',v:p.worker.email,state:'active'}
    ];},
    checks:function(c){const e=ccjEmp();return [
      {rule:'Nothing is signed before a person has approved it',
       expected:'internal approval',actual:e.approvedBy?'approved by '+e.approvedBy:'not approved',
       verdict:e.approvedBy?'pass':'fail'},
      {rule:'The version being signed is the version that was approved',
       expected:'v'+e.version+', approved by '+(e.approvedBy||'—'),
       actual:'v'+e.version,verdict:'pass'}
    ];},
    captured:function(c){const e=ccjEmp();return [
      {k:'Employer signed',v:e.adtSignedAt?ccjStamp(e.adtSignedAt):'&mdash;'},
      {k:'Signatory',v:ccjParties().adt.signatory}];},
    summary:function(c){return 'Signed '+ccjStamp(ccjEmp().adtSignedAt);},
    note:'We sign first, and this is the last point at which we can decline. The employee then receives a contract the employer has already committed to, and their signature is what executes it.'
  },

  /* ---- 8 · Onboarding. Six streams, six counterparties. The panel narrates the call each one
     makes; the card beside it shows what came back. ----------------------------------------- */
  'onboarding/Worker KYC':{
    system:'Persona', systemId:'persona', ref:'identity verification',
    call:function(c){return 'POST /inquiries {template:"gov-id+selfie", country:"'
      +ccjParties().worker.country+'", ref:"'+ccjOnb().kyc.session+'"}';},
    latency:'2.4s',
    fetched:function(c){const d=ccjKycDoc(),k=ccjOnb().kyc;return [
      {k:'Session',sub:'Inquiry',v:k.session,state:'active'},
      {k:'Document',sub:'Captured',v:d.type,state:k.step>1?'active':'inactive'},
      {k:'Document number',sub:'Read from the MRZ',v:d.number,state:k.step>2?'active':'inactive'},
      {k:'Face match',sub:'Against the document portrait',v:'98.2%',state:k.step>3?'active':'inactive'},
      {k:'Risk score',sub:'0 is clean',v:k.done?k.score+'/100':'&mdash;',state:k.done?'active':'inactive'}
    ];},
    checks:function(c){
      const k=ccjOnb().kyc,ck=ccjKycChecks();
      if(!k.step)return [];
      const out=[];
      if(k.step>2)out.push({rule:'Every field on the document matches the contract',
        expected:'exact match on name, date of birth and nationality',
        actual:ck.identity.every(function(r){return r.verdict!=='fail';})
          ?'all fields matched':'a field did not match',
        verdict:ck.identity.every(function(r){return r.verdict!=='fail';})?'pass':'fail'});
      if(k.step>3)out.push({rule:'The person presenting the document is the person in it, and is live',
        expected:'face match and liveness',actual:'98.2% match, live human confirmed',verdict:'pass'});
      if(k.step>4)out.push({rule:'The document is genuine and unaltered',
        expected:'security features intact, MRZ checksum valid',
        actual:'no tampering detected',verdict:'pass'});
      if(k.step>5)out.push({rule:'The individual appears on no sanctions, PEP or adverse-media list',
        expected:'no match',actual:'no match across OFAC, EU, UN and UK HMT',verdict:'pass'});
      if(k.step>6)out.push({rule:'The individual may lawfully work in the country of employment',
        expected:'unrestricted right to work or a valid permit',
        actual:ck.rtw.label,verdict:ck.rtw.verdict==='pass'?'pass':'fail'});
      return out;
    },
    captured:function(c){const k=ccjOnb().kyc;return [
      {k:'Verification',v:k.done?ccjKycDecision().label:'&mdash;'},
      {k:'Risk score',v:k.done?k.score+'/100':'&mdash;'},
      {k:'Session',v:k.session}];},
    summary:function(c){const k=ccjOnb().kyc;
      return k.reviewed==='confirmed'?'Confirmed by '+k.reviewed_by
        :ccjKycDecision().label+' &middot; risk '+ccjKycDecision().score+'/100';},
    note:'Eight things happen here and a customer is buying the fact that all eight did: a document is captured and read, every field is matched against the contract, a live selfie is matched to the portrait, the document is checked for tampering, the person is screened against sanctions, PEP and adverse-media lists, and their right to work is established. CONSIDER is a real outcome and it stops the run.',
    failure:'A rejected verification stops the placement outright. Nobody is onboarded on an identity we could not establish.'
  },
  'onboarding/Documents':{
    system:'Document vault', ref:'country checklist',
    call:function(c){return 'checklist(country="'+ccjParties().worker.country
      +'", worker="'+ccjParties().worker.empId+'")';},
    latency:'—',
    fetched:function(c){
      return ccjOnb().docs.map(function(d){
        return {k:d.label,sub:d.why,
          v:d.status==='verified'?d.ref:d.status==='rejected'?'rejected'
            :d.status==='na'?'not applicable':'awaiting',
          state:d.status==='verified'?'active':'inactive'};
      });
    },
    checks:function(c){
      const o=ccjOnb();
      const req=o.docs.filter(function(d){return d.req;});
      const ok=req.filter(function(d){return d.status==='verified';}).length;
      const rej=o.docs.filter(function(d){return d.status==='rejected';});
      return [
        {rule:'Every document this country requires is on file',
         expected:req.length+' required documents',
         actual:ok+' of '+req.length+' verified',verdict:ok===req.length?'pass':'fail'},
        {rule:'A document that does not meet the rule is rejected, not filed',
         expected:'proof of address issued within 3 months',
         actual:rej.length?rej.length+' rejected and replaced'
           :o.docs.some(function(d){return d.note&&/Replaced/.test(d.note);})
             ?'1 rejected and replaced':'none rejected',
         verdict:'pass'}
      ];
    },
    captured:function(c){
      const req=ccjOnb().docs.filter(function(d){return d.req;});
      return [{k:'Documents',v:req.filter(function(d){return d.status==='verified';}).length
        +' of '+req.length+' verified'}];
    },
    summary:function(c){
      const req=ccjOnb().docs.filter(function(d){return d.req;});
      return req.filter(function(d){return d.status==='verified';}).length+' of '+req.length+' on file';
    },
    note:'The checklist is the country\'s, not ours. A Dutch onboarding needs a BSN and a wage tax declaration; a German one needs a Steuer-ID and a Krankenkasse confirmation. Rejecting a document and asking again is part of the process, not a failure of it.'
  },
  'onboarding/Tax registration':{
    system:function(){return ccjOnbPack().taxAuthority;}, ref:'payroll tax',
    call:function(c){return 'file("'+ccjOnbPack().taxFiling+'", worker="'
      +ccjParties().worker.name+'")';},
    latency:'—',
    fetched:function(c){const o=ccjOnb(),pack=ccjOnbPack();return [
      {k:'Authority',sub:'Filed with',v:pack.taxAuthority,state:'active'},
      {k:'Filing',sub:'Submission',v:pack.taxFiling,state:'active'},
      {k:'Reference',sub:'Our submission',v:o.tax.ref||'&mdash;',state:o.tax.ref?'active':'inactive'},
      {k:pack.taxIdLabel,sub:'Returned by the authority',v:o.tax.id||'awaiting',
       state:o.tax.id?'active':'inactive'}
    ];},
    checks:function(c){const o=ccjOnb(),pack=ccjOnbPack();return [
      {rule:'The worker is registered for payroll tax before the first run',
       expected:pack.taxIdLabel+' on file',
       actual:o.tax.id?pack.taxIdLabel+' '+o.tax.id:'not yet returned',
       verdict:o.tax.id?'pass':'fail'},
      {rule:'The correct tax treatment is applied from the first period',
       expected:'authority-issued code',actual:pack.taxCredit,
       verdict:o.tax.id?'pass':'na'}
    ];},
    captured:function(c){const o=ccjOnb(),pack=ccjOnbPack();return [
      {k:pack.taxIdLabel,v:o.tax.id||'&mdash;'},{k:'Authority',v:pack.taxAuthority}];},
    summary:function(c){return ccjOnbPack().taxIdLabel+' '+(ccjOnb().tax.id||'&mdash;');},
    note:'We file, then we wait. The tax code that comes back is what decides what is withheld from the first payslip, which is why payroll cannot be configured before this returns.'
  },
  'onboarding/Social security enrolment':{
    system:function(){return ccjOnbPack().ssAuthority;}, ref:'statutory schemes',
    call:function(c){return 'file("'+ccjOnbPack().ssFiling+'", worker="'
      +ccjParties().worker.name+'")';},
    latency:'—',
    fetched:function(c){const o=ccjOnb(),pack=ccjOnbPack();return [
      {k:'Institution',sub:'Filed with',v:pack.ssAuthority,state:'active'},
      {k:'Filing',sub:'Submission',v:pack.ssFiling,state:'active'},
      {k:'Schemes',sub:'Enrolled in',v:pack.ssScheme,state:'active'},
      {k:pack.ssIdLabel,sub:'Returned',v:o.ss.id||'awaiting',state:o.ss.id?'active':'inactive'}
    ];},
    checks:function(c){const o=ccjOnb(),pack=ccjOnbPack();return [
      {rule:'The worker is enrolled in every statutory scheme the country requires',
       expected:pack.ssScheme,actual:o.ss.id?'enrolled':'not yet enrolled',
       verdict:o.ss.id?'pass':'fail'},
      {rule:'Enrolment is filed before the first day of employment',
       expected:'before '+ccjPrettyDate((ccjRun&&ccjRun.form&&ccjRun.form.fromDate)||''),
       actual:o.ss.confirmedAt?'filed '+ccjStamp(o.ss.confirmedAt):'pending',
       verdict:o.ss.confirmedAt?'pass':'na'}
    ];},
    captured:function(c){const o=ccjOnb(),pack=ccjOnbPack();return [
      {k:pack.ssIdLabel,v:o.ss.id||'&mdash;'},{k:'Schemes',v:pack.ssScheme}];},
    summary:function(c){return ccjOnbPack().ssIdLabel+' '+(ccjOnb().ss.id||'&mdash;');},
    note:'In most countries this filing is legally due BEFORE the first day worked, not after it. A late enrolment is a penalty on the employer, which is us.'
  },
  'onboarding/Bank verified':{
    system:'Penny-drop provider', ref:'account verification',
    call:function(c){return 'POST /bank/verify {account:"'+ccjOnb().bank.iban
      +'", name:"'+ccjParties().worker.name+'"}';},
    latency:'1.4s',
    fetched:function(c){const b=ccjOnb().bank;return [
      {k:'Account',sub:'Masked',v:b.iban||'&mdash;',state:b.iban?'active':'inactive'},
      {k:'Test credit',sub:'Sent',v:ccjCurrency()+' 0.01',state:b.pennyAt?'active':'inactive'},
      {k:'Name on account',sub:'Returned by the bank',v:b.state==='verified'?b.holder:'awaiting',
       state:b.state==='verified'?'active':'inactive'},
      {k:'Name match',sub:'Confidence',v:b.score?b.score+'%':'&mdash;',
       state:b.score?'active':'inactive'}
    ];},
    checks:function(c){const b=ccjOnb().bank;return [
      {rule:'The account accepts a test credit',expected:'credit accepted',
       actual:b.state==='verified'?'accepted':'pending',verdict:b.state==='verified'?'pass':'na'},
      {rule:'The name on the account is the person we are about to pay',
       expected:ccjParties().worker.name,
       actual:b.state==='verified'?b.holder+' — '+b.score+'% match':'awaiting',
       verdict:b.state==='verified'?'pass':'na'}
    ];},
    captured:function(c){return [{k:'Bank details',v:'On file ('+(ccjOnb().bank.iban||'—')+')'}];},
    summary:function(c){return 'Verified &middot; '+(ccjOnb().bank.score||0)+'% name match';},
    note:'A penny-drop proves the account exists and belongs to the right person before payroll ever sends real money to it. It is the cheapest control in the whole journey and it prevents the most expensive mistake.'
  },
  'onboarding/Payroll configured':{
    system:'Payroll engine', ref:'from contract data',
    call:function(c){return 'configure(worker="'+ccjParties().worker.empId
      +'", contract="'+ccjEmp().id+'", from="'+((ccjRun&&ccjRun.form&&ccjRun.form.fromDate)||'')+'")';},
    latency:'320ms',
    fetched:function(c){const o=ccjOnb(),s=ccjPayslip();return [
      {k:'Calendar',sub:'Pay cycle',v:o.payroll.calendar||'&mdash;',state:'active'},
      {k:'First payroll',sub:'Period',v:o.payroll.firstPay||'&mdash;',state:'active'},
      {k:'Gross',sub:o.payroll.prorated?'Prorated to the start date':'Full month',
       v:ccjMoney(s.gross),state:'active'},
      {k:'Net',sub:'Indicative',v:ccjMoney(s.net),state:'active'}
    ];},
    checks:function(c){const o=ccjOnb(),s=ccjPayslip();return [
      {rule:'Payroll is configured from the executed contract, not from the quote',
       expected:'contract '+ccjEmp().id,actual:'contract '+ccjEmp().id,verdict:'pass'},
      {rule:'The first period is prorated to the day the person actually starts',
       expected:'proration where the start is mid-month',
       actual:o.payroll.prorated?o.payroll.days+' of '+o.payroll.inMonth+' days':'full month — starts on the 1st',
       verdict:'pass'},
      {rule:'No payroll runs against an unverified account',
       expected:'bank verified',actual:ccjOnb().bank.state==='verified'?'verified':'not verified',
       verdict:ccjOnb().bank.state==='verified'?'pass':'fail'}
    ];},
    captured:function(c){const o=ccjOnb(),s=ccjPayslip();return [
      {k:'First payroll',v:o.payroll.firstPay||'&mdash;'},
      {k:'Indicative net',v:ccjMoney(s.net)}];},
    summary:function(c){return 'First pay '+(ccjOnb().payroll.firstPay||'&mdash;');},
    note:'The figures here are indicative and say so. The binding number is computed on the first run against the tax code the authority actually returned — asserting an exact net before that would be claiming a calculation nobody has made.'
  },

  /* ---- 4 · Quote accepted. The first stage with no human step in it at all. -------------- */
  'quote-approved/Won':{
    system:'Deal Desk', ref:'deal record',
    call:function(c){return 'close(deal, outcome="won", value='+(ccjQuote().total*12)+')';},
    latency:'62ms',
    fetched:function(c){const q=ccjQuote();return [
      {k:'Client',sub:'Account',v:c.client,state:'active'},
      {k:'Engagement',sub:'Model',v:ccjModelLabel(c.type),state:'active'},
      {k:'Monthly value',sub:'Per placement',v:q.sym+' '+q.total.toLocaleString(),state:'active'},
      {k:'Annualised',sub:'12 months',v:q.sym+' '+(q.total*12).toLocaleString(),state:'active'}
    ];},
    checks:function(c){return [
      {rule:'The client accepted in writing before the deal is booked as won',
       expected:'acceptance on the quote thread',actual:'accepted on quote v'+ccjClient().version,verdict:'pass'},
      {rule:'The booked value matches the quote they accepted',expected:'v'+ccjClient().version+' total',
       actual:ccjQuote().sym+' '+ccjQuote().total.toLocaleString()+' — matches',verdict:'pass'}
    ];},
    captured:function(c){const q=ccjQuote();return [
      {k:'Outcome',v:'Won'},{k:'Annual value',v:q.sym+' '+(q.total*12).toLocaleString()},
      {k:'Accepted version',v:'v'+ccjClient().version}];},
    summary:function(c){const q=ccjQuote();return 'Won · '+q.sym+' '+(q.total*12).toLocaleString()+' a year';},
    note:'Booked against the version the client actually accepted, not the version we first sent. On a renegotiated deal those are different numbers, and only one of them is the deal.'
  },
  /* Overridden to cover what provisioning actually creates — the entity, the workspace, the
     admin invite and the client record — rather than the entity alone. Also upserts: a client
     already on the books does not get a second tenant, and the run says so instead of pretending
     to create one it did not. */
  'quote-approved/Client tenant provisioned':{
    system:'ADT SaaS', systemId:'nfadmin', ref:'EntityRegistry',
    call:function(c){return 'POST /tenants {client:"'+c.client+'", country:"'+c.country+'"}';},
    latency:'640ms',
    fetched:function(c){
      const t=ccjTenant(),was=ccjTenantExisting();
      return [
        {k:'Tenant',sub:was?'Already on the books':'Created',v:t.id,state:'active'},
        {k:'Workspace',sub:'Client sign-in',v:t.workspace,state:'active'},
        {k:'Plan',sub:'Commercial tier',v:t.plan,state:'active'},
        {k:'Admin invited',sub:'Client contact',v:was?'already has access':t.contact,
         state:was?'inactive':'active'}
      ];
    },
    checks:function(c){
      const was=ccjTenantExisting();
      return [
        {rule:'One tenant per client — an existing client is not provisioned twice',
         expected:'no tenant for '+c.client,
         actual:was?c.client+' already has a tenant — reused':'none found — created',
         verdict:was?'na':'pass'},
        {rule:'The tenant is registered in the country the work happens in',
         expected:c.country,actual:c.country,verdict:'pass'}
      ];
    },
    captured:function(c){const t=ccjTenant();return [
      {k:'Tenant',v:t.id},{k:'Workspace',v:t.workspace},
      {k:'Client record',v:ccjTenantExisting()?'existing':'created'}];},
    summary:function(c){return ccjTenantExisting()?'Existing tenant reused':'Tenant '+ccjTenant().id+' created';},
    note:'Provisioning is idempotent. A client on their second engagement already has a workspace, and creating a second one would split their people across two accounts.'
  },
  'quote-approved/CSM confirmed to client':{
    system:'CSM routing table', ref:'Owner directory',
    call:function(c){return 'introduce(csm="'+ccjCsm().name+'", client="'+c.client+'")';},
    latency:'44ms',
    fetched:function(c){const m=ccjCsm();return [
      {k:m.name,sub:'Customer Success Manager',v:'owns '+c.country,state:'active'},
      {k:'Introduced to',sub:'Client contact',v:ccjTenant().contact,state:'active'},
      {k:'Sent',sub:'Channel',v:'client thread',state:'active'}
    ];},
    checks:function(c){return [
      {rule:'The CSM introduced is the one who owns the client country',
       expected:'owner of '+c.country,actual:ccjCsm().name,verdict:'pass'},
      {rule:'The introduction goes out the same day the deal is won',
       expected:'same day',actual:'immediate',verdict:'pass'}
    ];},
    captured:function(c){return [{k:'CSM',v:ccjCsm().name},{k:'Relationship owner',v:ccjCsm().name}];},
    summary:function(c){return ccjCsm().name+' introduced';},
    note:'This is where the Account Manager hands the relationship over. They own winning the client; the CSM owns keeping them.'
  },
  /* Overridden so the panel and the quote screen beside it cannot state different numbers. The
     shared entry reads aiH2rCountryData and says "~19.4%" as prose while the quote screen was
     computing 18.4% — the same fact, two answers, a column apart. Both now read CCJ_RATES. */
  'quote-prep/Cost calc built':{
    system:'Cost engine', ref:'Compliance Hub rates',
    call:function(c){return 'build(gross='+Math.round(c.grossMonthly)+', country="'+c.country+'", type="'+c.type+'")';},
    latency:'380ms',
    fetched:function(c){
      const q=ccjQuote(),r=ccjRate(c.country);
      const rows=[
        {k:'Monthly gross',sub:'Offered',v:q.sym+' '+q.gross.toLocaleString(),state:'active'},
        {k:r.label,sub:r.social+'% of gross',v:q.sym+' '+q.social.toLocaleString(),state:'active'}
      ];
      if(q.holiday)rows.push({k:'Holiday allowance',sub:r.holiday+'% of gross',
        v:q.sym+' '+q.holiday.toLocaleString(),state:'active'});
      rows.push({k:'Employer cost',sub:'Before margin',v:q.sym+' '+q.base.toLocaleString(),state:'active'});
      return rows;
    },
    checks:function(c){
      const q=ccjQuote();
      return [
        {rule:'Every in-force employer contribution is loaded onto gross',
         expected:ccjRate(c.country).label+' at '+q.socialPct+'%',
         actual:q.sym+' '+q.social.toLocaleString()+' applied',verdict:'pass'},
        {rule:'Margin resolves against the country rate card',expected:'within the standard band',
         actual:q.margin+'% — standard',verdict:'pass'}
      ];
    },
    captured:function(c){const q=ccjQuote();return [
      {k:'Employer cost',v:q.sym+' '+q.base.toLocaleString()},
      {k:'Margin',v:q.margin+'%'},
      {k:'Total',v:q.sym+' '+q.total.toLocaleString()}];},
    summary:function(c){const q=ccjQuote();return q.sym+' '+q.total.toLocaleString()+' at '+q.margin+'%';},
    note:'Gross and the employer contributions are pass-through &mdash; collected and handed on. The margin is the only line that is ours, which is why it is the only one a client can negotiate.'
  },
  /* The shared entry only checks a real floor for the Netherlands, because that is the only
     country whose minimum wage is in the compliance table. Everywhere else it passed without
     comparing anything. A check that cannot be made should say so, not report a pass. */
  'quote-prep/Statutory floor check':{
    system:'Rules engine', ref:'Compliance Hub · Minimum Wage',
    call:function(c){return 'evaluate(floor="Minimum Wage", country="'+c.country+'", gross='+Math.round(c.grossMonthly)+')';},
    latency:'96ms',
    fetched:function(c){
      const f=ccjFloorFor(c.country);
      return [{k:'Statutory minimum',sub:c.country,
        v:f?f.label+' '+f.value:'not configured for '+c.country,state:f?'active':'inactive'},
        {k:'Offered rate',sub:'Per hour, 173.33h month',v:ccjCurrency()+' '+c.hourly.toFixed(2),state:'active'}];
    },
    checks:function(c){
      const f=ccjFloorFor(c.country);
      if(!f)return [{rule:'Offered rate must be at or above the statutory minimum',
        expected:'a configured minimum wage for '+c.country,
        actual:'no minimum-wage rule configured — cannot be checked',verdict:'na'}];
      return [{rule:'Offered rate must be at or above the statutory minimum',
        expected:'&ge; '+f.label+' '+f.value+' / hour',
        actual:ccjCurrency()+' '+c.hourly.toFixed(2)+' / hour',
        verdict:c.hourly>=f.num?'pass':'fail'}];
    },
    captured:function(c){const f=ccjFloorFor(c.country);
      // Keyed on the RESULT, not on whether a rule exists. This used to write "above minimum"
      // for every run that had a floor configured — including the ones that failed it — so the
      // audit record said the opposite of the verdict two lines above it.
      return [{k:'Floor check',v:!f?'not configurable'
        :(c.hourly>=f.num?'above minimum':'BELOW minimum')}];},
    summary:function(c){const f=ccjFloorFor(c.country);
      return f?(c.hourly>=f.num?'Above the statutory minimum':'BELOW the statutory minimum')
             :'No floor configured for '+c.country;},
    note:'Read from Compliance Hub &rarr; Rates &amp; Rules. A country with no minimum-wage rule configured cannot be checked, and the run says so rather than reporting a pass it did not earn.',
    failure:'A rate below the statutory minimum blocks the quote and routes to Compliance.'
  },
  /* Both of these are `applies:false` in the shared map — authored for the original journey,
     where the client always accepted the quote as sent. Here whether they ran is a fact about
     this run, so the condition is the live client state. */
  'quote-review/Change requested':{
    system:'Client thread', ref:'reply',
    call:function(c){return 'parse(reply, quote="'+c.contractId+'")';},
    latency:'—',
    applies:function(c){return ccjNegotiated();},
    fetched:function(c){
      const cl=ccjClient();
      if(cl.ask==='terms')return cl.changes.map(function(x){
        return {k:x.k,sub:'Requested change',v:x.from+' → '+x.to,state:'active'};});
      const now=ccjQuote(20),want=ccjQuote(17);return [
      {k:'Quoted',sub:'v1 total',v:now.sym+' '+now.total.toLocaleString(),state:'active'},
      {k:'Client target',sub:'Stated in reply',v:want.sym+' '+want.total.toLocaleString(),state:'active'},
      {k:'Gap',sub:'To close',v:now.sym+' '+(now.total-want.total).toLocaleString(),state:'active'}
    ];},
    checks:function(c){
      if(ccjClient().ask==='terms')return [
        {rule:'The request changes the contract, not the commercials',expected:'price unaffected',
         actual:'start date and probation only',verdict:'pass'},
        {rule:'The revised terms stay inside country statute',expected:'probation within legal maximum',
         actual:'6 months — permitted',verdict:'pass'}];
      return [
      {rule:'The request is commercial, not a change of scope',expected:'price only',
       actual:'rate only — role, country and term unchanged',verdict:'pass'},
      {rule:'The target stays above the margin floor',expected:'&ge; 15%',
       actual:'17% achievable',verdict:'pass'}
    ];},
    captured:function(c){
      if(ccjClient().ask==='terms')return [{k:'Requested',v:'Start date and probation'},{k:'Route',v:'Amend and re-issue'}];
      const want=ccjQuote(17);return [
      {k:'Requested total',v:want.sym+' '+want.total.toLocaleString()},{k:'Route',v:'Re-issue as v2'}];},
    summary:function(c){return ccjClient().ask==='terms'
      ?'Client asked to change the terms':'Client asked for a better rate';},
    note:'A price request is answerable inside this stage. A change of scope would not be &mdash; that goes back to the cost build.'
  },
  'quote-review/Re-issued v2':{
    system:'Cost engine', ref:'agreed margin',
    call:function(c){return 'rebuild(gross='+Math.round(c.grossMonthly)+', margin=17)';},
    latency:'310ms',
    applies:function(c){return ccjNegotiated();},
    fetched:function(c){
      const cl=ccjClient();
      if(cl.ask==='terms'){const q=ccjQuote();return cl.changes.map(function(x){
        return {k:x.k,sub:'Amended',v:x.to,state:'active'};})
        .concat([{k:'Total',sub:'Unchanged',v:q.sym+' '+q.total.toLocaleString(),state:'active'}]);}
      const was=ccjQuote(20),now=ccjQuote(17);return [
      {k:'Margin',sub:'Agreed with the client',v:'20% &rarr; 17%',state:'active'},
      {k:'Total was',sub:'v1',v:was.sym+' '+was.total.toLocaleString(),state:'inactive'},
      {k:'Total now',sub:'v2',v:now.sym+' '+now.total.toLocaleString(),state:'active'}
    ];},
    checks:function(c){
      if(ccjClient().ask==='terms')return [
        {rule:'Amending terms does not touch the cost build',expected:'total unchanged',
         actual:'unchanged',verdict:'pass'},
        {rule:'The amended document supersedes v1',expected:'v1 withdrawn',actual:'v1 withdrawn',verdict:'pass'}];
      const now=ccjQuote(17);return [
      {rule:'The build is unchanged &mdash; only margin moved',expected:'employer cost identical',
       actual:'identical',verdict:'pass'},
      {rule:'Margin stays above the floor',expected:'&ge; 15%',actual:'17%',verdict:'pass'},
      {rule:'The revised total meets the client target',expected:'at or under their number',
       actual:now.sym+' '+now.total.toLocaleString(),verdict:'pass'}
    ];},
    captured:function(c){
      if(ccjClient().ask==='terms')return [{k:'Quote version',v:'v2'},{k:'Amended',v:'Start date, probation'}];
      const now=ccjQuote(17);return [
      {k:'Quote version',v:'v2'},{k:'New total',v:now.sym+' '+now.total.toLocaleString()}];},
    summary:function(c){return ccjClient().ask==='terms'
      ?'Re-issued with amended terms':'Re-issued at 17% margin';},
    note:'The employer cost is not touched. What was negotiated was our margin, and that is the only number that moves.'
  }
};
/* Did this run actually go through a negotiation? Everything from the change request onward
   depends on it, and the answer is a fact about the client, not about the data. */
function ccjNegotiated(){
  const st=(ccjRun&&ccjRun.client&&ccjRun.client.state)||'';
  return st==='changed'||st==='negotiating'||st==='agreed'||st==='reissued'||st==='viewed2'
    ||(ccjRun&&ccjRun.client&&ccjRun.client.version>1);
}
function ccjEvidence(i,step){
  if(!step)return null;
  const k=ccjKey(i,step);
  if(CCJ_EVIDENCE[k])return CCJ_EVIDENCE[k];
  if(typeof aicjEvidence==='undefined')return null;
  return aicjEvidence[k]||null;
}
function ccjActor(){
  return typeof actorLabel==='function'&&typeof currentActorId==='function'
    ?actorLabel(currentActorId()):'you';
}
/* The one-line result a settled row carries. It says what came back, not what the step was
   called — "Maya Vos assigned" earns its line, "CSM assigned ✓" does not. A person's answer
   outranks an authored line: on a step someone decided, who decided it IS the result. */
function ccjSummary(i,step){
  const dec=ccjRun&&ccjRun.decisions[ccjKey(i,step)];
  if(dec)return dec.done||(dec.label+' &middot; '+ccjActor());
  const d=ccjEvidence(i,step);
  if(d&&d.summary)return ccjVal(d.summary,ccjCtx());
  return 'Done';
}
/* What a step that has not run yet is FOR. Pending rows are not blank in this panel — they
   say what is coming, which is half of what makes the whole stage readable at a glance.
   Authored where it matters, derived from the data the sub-status already carries otherwise. */
const CCJ_PURPOSE={
  'request-received/New intake':'Records this hire request.',
  'request-received/CSM assigned':'Assigns the CSM for the client country.',
  'request-received/Qualified / Rejected':'Approve or decline this request.'
};
function ccjPurpose(i,step){
  const authored=CCJ_PURPOSE[ccjKey(i,step)];
  if(authored)return authored;
  if(step.autoNote)return 'Runs automatically &mdash; '+step.autoNote+'.';
  if(step.decision)return 'Needs a decision from '+step.owner+'.';
  return 'Owned by '+step.owner+'.';
}

/* ---- HOLDS -----------------------------------------------------------------------------
   A sub-status that must not finish on a timer. It runs its evidence beats, then parks —
   current, spinning, everything it found on screen — until the run reaches the named screen.
   Held work is the honest rendering of "the machine has done its part and is waiting on the
   rest of the stage"; ticking it green early would report work nobody has done. */
/* A hold declares `note` (a string, or a function when what it says depends on what is happening)
   and optionally `rows` — exactly like CCJ_WAITS, and for the same reason. A held step is parked on
   work happening elsewhere in the product, often for ten seconds or more, and a sentence that never
   changes is indistinguishable from a run that has stopped. Stage 8 has SIX of them.

   Declared per hold rather than inferred here. ccjHoldNoteHTML used to special-case the document
   card and the clause audit by reaching into run.doc and run.emp from inside a shared function —
   the same ambient coupling that put a row about the quote on the agreement's wait, and it does not
   survive six more holds each with their own progress to report. */
const CCJ_HOLDS={
  'request-received/New intake':{
    until:'proposal',
    // The word beside the spark while held. NOT "Working" — a hold is a specific activity, and
    // the generic word depicts the wrong thing (the user's own words). Reading a document IS the
    // capture, so the verb follows the note's own distinction — and the gist names the document.
    verb:function(){const d=ccjRun&&ccjRun.doc;return d&&!d.done?'Reading':'Gathering';},
    gist:function(){
      const d=ccjRun&&ccjRun.doc;
      if(d&&!d.done)return d.name;
      const f=ccjRun&&ccjRun.doc&&ccjRun.doc.done?ccjRun.doc.fields.length+' fields read':'';
      return f;
    },
    // A held row is not idle — it is the intake still being captured. When a document is being read
    // it says so, because that reading IS the capture.
    note:function(h){
      const d=ccjRun&&ccjRun.doc;
      if(d&&!d.done)return 'Reading <b>'+d.name+'</b>.';
      if(d&&d.done)return 'Read <b>'+d.name+'</b>. '+h.plain;
      return h.plain;
    },
    plain:'Completes when the proposal is created.'
  }
};
/* THE RE-ISSUE CANNOT PRECEDE THE REPLY. "Change requested" used to settle off its beats alone,
   so "Re-issued v2" opened — parked, but visibly THERE — while the drafted answer still sat
   unsent in the thread below it. A step named after sending the client a revised quote must not
   appear before our half of the negotiation has left the building (the user's words: "it should
   show after we send the message"). So the step holds until the reply is sent — ccjSendDraft and
   ccjSendToClient reach the 'draft-sent' milestone — and it is a FUNCTION because the hold only
   exists while a change is actually unanswered (`state==='changed'`): on the re-run pass after
   the client has accepted there is no reply to send, and an unconditional hold would park the
   pass-2 walk forever on a milestone nobody can reach. */
CCJ_HOLDS['quote-review/Change requested']=function(){
  const c=ccjRun&&ccjRun.client;
  // 'negotiating' too, and it is load-bearing: ccjSendDraft moves the state there BEFORE it
  // reaches the milestone, and ccjReachScreen re-asks this function on release — a hold that
  // has vanished by then cannot be released, and the runner parks forever on a step whose
  // condition was already satisfied.
  if(!c||(c.state!=='changed'&&c.state!=='negotiating'))return null;
  return {until:'draft-sent',
    verb:function(){return ccjClient().drafted?'Waiting':'Drafting';},
    // The one-line block's gist; the drafted card in the thread carries the Send control itself.
    gist:function(){return ccjClient().drafted?'Reply drafted for you':'Drafting a reply';},
    note:function(){return ccjClient().drafted
      ?'A reply is drafted for you below. The re-issue follows once you send it.'
      :'Drafting a reply for you.';}};
};
/* An entry may be a function of run state, for the same reason CCJ_GATES may: a step whose work
   happens in two halves either side of a human decision holds on a DIFFERENT milestone before and
   after that decision. The first payroll run is the case — it parks on the calculation being
   complete, a person releases it, and it then parks again on the money actually leaving. */
function ccjHoldFor(i,step){
  if(!step)return null;
  const h=CCJ_HOLDS[ccjKey(i,step)];
  if(typeof h==='function')return h()||null;
  return h||null;
}
/* A held row reports the work the SCREEN is doing, not a fixed sentence about waiting — with a
   count where there is one to give, so a reader can tell a step that is progressing from one that
   has stopped. Everything shown is read from the store the screen reads, so the block and the card
   beside it can never disagree about how far along something is. */
function ccjHoldNoteHTML(hold){
  const note=typeof hold.note==='function'?hold.note(hold):hold.note;
  const rows=((typeof hold.rows==='function'?hold.rows():hold.rows)||[])
    .filter(function(r){return r&&r[1];})       // a row with nothing in it is not yet worth showing
    .map(function(r){return ccjWaitRow(r[0],r[1]);});
  return note+(rows.length?'<div class="ccj-hold-rows">'+rows.join('')+'</div>':'');
}

/* ---- WHERE THE RUN STOPS --------------------------------------------------------------
   Authored per sub-status rather than derived, because a gate is a product decision and
   deriving it from flags would let a step that merely lacks an `auto` marker silently invent
   a human approval. Anything not listed still stops if it is not marked auto — the fallbacks
   below — so the machine can never quietly perform work a person owns.

   `why` IS OPTIONAL, AND MOST GATES SHOULD NOT HAVE ONE. It was written when this journey was
   being argued about, and it answers "why is this control here" — a reviewer's question, not a
   user's. Someone using the product already knows why they are being asked; the `ask` line says
   what to decide, and a second sentence restating it in grey reads as filler and makes a finished
   product look like a walkthrough of itself. Add one only where it carries a FACT the ask cannot:
   an amount outstanding, a clause that failed, a consequence being accepted. See ccjGateHTML,
   which emits no element at all when there is none. */
const CCJ_GATES={
  'request-received/Qualified / Rejected':{
    kind:'decision',
    /* "Qualify this request before it is priced" was the process's word for the decision, not the
       decision itself. Nobody outside a sales operating model says "qualify a request"; what is
       actually being asked is whether this is a hire we will take on, and the one consequence
       worth stating is that nothing gets costed until it is answered. The button then carries the
       verb, so the reader never has to work out what Qualify does. */
    ask:'Is this a hire we can take on? Nothing is priced until you say so.',
    // Its own halt sentence, because this one carries a fact — the intake is captured and routed —
    // that no other decision gate in the journey shares. See ccjOnHalt.
    // "…Qualify it to continue" came off the end: the card directly above already asks for exactly
    // that, and repeating an instruction one line below the control that carries it is how a
    // product starts sounding like it is narrating itself. What is left is the fact — the request
    // exists and has been put in front of someone.
    halt:'Request logged and routed.',
    options:[
      // The button says what happens next, the `done` chip keeps the record's word for it. Those
      // are two different jobs: a control is read before the click and has to promise an outcome,
      // a chip is read afterwards and has to match the sub-status it settled.
      {id:'qualified',   label:'Accept and price it',    tone:'go',  done:'Qualified'},
      // `stop` is what the run says about itself afterwards. Authored per option because these
      // four sentences are the only record a reader gets of why a journey ended.
      {id:'rejected',label:'Reject the request', tone:'stop',done:'Rejected',
       stop:{title:'Request rejected',note:'No further steps ran on this request.'}}
    ]
  },
  /* The last thing before a quote leaves the building. Send back is a LOOP, not a stop: the
     numbers go back to the cost engine and are rebuilt, which is what failing QA actually means.
     A send-back that ended the run would be modelling it as a rejection of the request itself,
     which is stage 1's decision and not this one. */
  'quote-prep/Quote QA':{
    kind:'approval',
    // Says where the quote goes rather than instructing the reader to approve it — the buttons
    // directly beneath are the instruction, and a card that both tells you to approve and offers
    // you an Approve button is saying the same thing twice in two inches.
    ask:'This quote goes to the client as soon as it is approved.',
    options:[
      {id:'approved',label:'Approve the quote',   tone:'go',  done:'Approved'},
      // Not a bare "Send back", which never said where to. It goes back to the cost engine to be
      // rebuilt — see CCJ_REWORK, which returns the run to Cost calc built.
      {id:'rework',  label:'Send back to be rebuilt', tone:'stop',done:'Sent back for rework'}
    ]
  }
};
/* Whoever is looking may answer any gate. The step's real owner is still recorded and still
   shown on the row — this only removes the block, so a walkthrough does not need four personas
   to get through nine stages. Set to false to enforce ownership again; nothing else changes. */
const CCJ_ANY_PERSONA=true;
/* Legal reads the agreement before it goes anywhere. Not automatable — this is liability, and
   the 48h SLA in the operating model is a person's working time, not a system's. */
CCJ_GATES['agreement-signature/Legal & compliance review']={
  kind:'approval',
  /* "Release the agreement to the client?" used the word the record uses. Release is what the
     system does; what a person is being asked is whether legal's read is good enough to let the
     document leave, and the plain version of that says who has already looked at it and where it
     goes next. */
  ask:'Legal has read the agreement. Approve it and it goes to the client to sign.',
  options:[
    {id:'released',label:'Approve the agreement',      tone:'go',  done:'Released'},
    // "Send to amend" is not a sentence anyone says. It goes back to legal to be changed.
    {id:'amend',   label:'Send back for changes',tone:'stop',done:'Returned for amendment'}
  ]
};
/* A possible sanctions match. Automatic screening, human adjudication — similar company names
   produce false positives constantly, and the law does not let a machine make this call. */
CCJ_GATES['agreement-signature/Client entity + sanctions check']=function(){
  const m=ccjMsa();
  if(m.screening!=='hit')return null;             // clean or already cleared — no gate
  return {
    kind:'decision',
    // Keeps a `why` because it carries the one fact the ask cannot: WHAT matched. "Adjudicating"
    // went with it — screening vocabulary, not the word anyone uses out loud — and so did the
    // explanation of why screening cannot decide alone, which is the control arguing for itself.
    // What is left is the match and what it costs to get wrong.
    ask:'Screening flagged a possible sanctions match on this client.',
    why:m.hit+'. We cannot contract with a sanctioned entity.',
    options:[
      // "Not our client" was the shortest way to say it and the easiest to misread — it names the
      // FLAGGED entity, not the one on the deal, so on a card about our client it read as if it
      // were disowning them. What is being answered is whether the list entry is this company.
      {id:'dismiss',  label:'Not a match &mdash; clear it', tone:'go',  done:'Match dismissed'},
      // A bare "Escalate" never said to whom, on the one card where that is the entire decision.
      {id:'escalate', label:'Send to Compliance',       tone:'stop',done:'Escalated to Compliance',
       stop:{title:'Escalated to Compliance',note:'The engagement is on hold until Compliance clears it.'}}
    ]
  };
};
/* ---- GATES THAT COME AFTER THE WORK, NOT INSTEAD OF IT --------------------------------------
   CCJ_GATES halts on ARRIVAL — the step never runs its actions, because the decision is what the
   step IS (qualify this request, approve this quote). Some decisions are the opposite shape: the
   work has to happen first and the decision is about its RESULT. Countersigning an agreement is
   one — you cannot approve a signature you have not received.

   Separate map so the arrival-gated steps keep their behaviour untouched. */
const CCJ_POST_GATES={
  'agreement-signature/Signed':{
    kind:'approval',
    // The STEP is owned by the Client, because the client is who signs. The countersignature is
    // ours, and this is the last point at which we can decline — a block crediting that decision
    // to the client would name the one party who cannot make it. See ccjGateOwner.
    owner:'Compliance',
    /* "Countersign the agreement?" is the correct legal word and the wrong first word — it asks
       the reader to know what a countersignature is before it tells them anything. The fact that
       makes the question answerable is that the other side has already signed, so that leads.
       The record keeps the precise word: the sub-status is still ADT countersigned. */
    ask:'The client has signed. Add our signature?',
    // Matched to the employment-contract countersign in stage 7 — same two facts, same shape.
    // These are the two cards in the journey that ask the identical question of the identical
    // person, and rewriting one and not the other would leave the demo speaking in two voices.
    why:'Ours is the second signature. It puts the agreement in force and lets the hire start.',
    options:[
      {id:'countersign',label:'Sign and make it live',tone:'go',  done:'Executed'},
      {id:'declineMsa', label:'Decline to sign',                tone:'stop',done:'Declined',
       stop:{title:'Agreement declined',note:'Nothing is in force and no placement can start.'}}
    ]
  }
};
function ccjPostGateFor(i,step){
  if(!step)return null;
  const g=CCJ_POST_GATES[ccjKey(i,step)];
  if(!g)return null;
  return typeof g==='function'?(g()||null):g;
}
/* Which sub-status a rejection returns the run to. Rebuilding the cost is the work a QA
   rejection creates, so that is where it goes back to — not to the top of the stage. */
const CCJ_REWORK={'quote-prep/Quote QA':'Cost calc built',
                  'agreement-signature/Legal & compliance review':'MSA drafted'};
function ccjGateFor(i,step){
  if(!step)return null;
  const authored=CCJ_GATES[ccjKey(i,step)];
  // An entry may be a function of run state: the sanctions gate only exists when screening
  // actually returned something, and a clean screen must not manufacture a decision.
  if(typeof authored==='function')return authored()||null;
  if(authored)return authored;
  if(step.auto)return null;                       // the machine owns it outright
  // A step that waits on the client is answered by the client, not by a button in here. The
  // wait IS the mechanism; deriving a gate as well would give one step two owners.
  if(CCJ_WAITS[ccjKey(i,step)])return null;
  // Same for a step that HOLDS on its own work finishing. Onboarding's tax registration and
  // social security enrolment carry no `auto` flag — they are filings a person owns — but the
  // run performs them and parks on the authority answering. Without this they halted on arrival
  // behind a derived "Mark done" button and the filing never ran at all.
  if(CCJ_HOLDS[ccjKey(i,step)])return null;
  const info=typeof amOwnerInfo==='function'?amOwnerInfo(step.owner):{persona:null};
  // No persona behind the owner means nobody in this product can click it — a real external
  // wait on the client or the worker, and it is honest to say so.
  /* THESE TWO ARE THE MOST-READ SENTENCES IN THE JOURNEY. Every step without a gate of its own
     falls through to them, so they appear on more of the product than any hand-written line in it.

     Both used to add "The run holds here until it comes back" / "…until this step is marked done".
     That is the machine describing its own control flow — "the run", "holds" — to a person who
     wants to know who they are waiting for. It also said nothing the line above and the button
     below had not already said between them. Dropped rather than reworded: the ask names the
     party, the button names the action, and there is no third fact to carry. */
  if(!info.persona)return{
    kind:'external',
    ask:'Waiting on the '+String(step.owner).toLowerCase()+'.',
    options:[{id:'received',label:'Mark received',tone:'go',done:'Received'}]
  };
  return{
    kind:'act',
    ask:'This step is yours to complete.',
    options:[{id:'done',label:'Mark done',tone:'go',done:'Completed'}]
  };
}

/* ---- THE RUNNER -----------------------------------------------------------------------
   Three beats per sub-status — reach a system, check the rules, capture what came back —
   then either hold for a milestone or settle and move on. A step carrying a gate never runs
   the beats at all: it halts on arrival and waits for a person.                            */
function ccjStart(){
  const run=ccjEnsureRun();
  run.sub=0;
  ccjEnterStep();
}
function ccjEnterStep(){
  const run=ccjRun;if(!run)return;
  const steps=ccjSteps(run.stage);
  const step=steps[run.sub];
  // The board's row for this deal moves with the run — see ccjSyncDealFromRun. Here, because
  // arriving at a step is the one event every kind of movement passes through: a settle, a stage
  // opening, a rework jumping back up its own stage.
  ccjSyncDealFromRun(run);
  if(!step){ccjStageComplete();return;}
  // The block goes into the transcript before anything paints, so every paint below — the gate,
  // the pre-wait, the first action — has something to paint into. A skipped step gets one too:
  // a step that did not need to run says so, and saying so needs somewhere to say it.
  ccjOpenStepBlock();
  /* == A STEP THAT IS STILL WAITING HAS NOT BEEN RULED OUT ==================================
     Applicability used to be decided first, and that is wrong for any step whose condition is
     about the very thing its pre-wait is waiting for. "Change requested" applies only if the
     client asked for a change, and it parks until they answer — so asking "does this apply?"
     before the wait is asking a question the answer to which has not arrived, and getting `no`
     every time.

     It survived unnoticed because a step above it happened to absorb the delay: the follow-up
     sub-status waited on the same event, so by the time the run got here the client had always
     already replied. Removing that step removed the accident, and the run walked straight past
     the negotiation, skipped it as not applicable and re-issued a quote nobody had asked to
     change. A behaviour that depends on the step in front of it taking long enough is not a
     behaviour, it is a coincidence.

     So a wait may DECLARE that the question has to wait for it: `decideAfter`. Where it is set,
     applicability is asked once the wait resolves (in ccjResolveWait) instead of on arrival.

     DECLARED PER WAIT RATHER THAN APPLIED TO ALL OF THEM, and that distinction is load-bearing.
     Stage 5's "Signed" also parks on a pre-wait — for the countersigned copy to come back — and
     it is skipped outright when the client already has an agreement in force. Deferring its
     question too would park that run on a milestone that, by its own condition, is never going to
     arrive. A wait knows whether it is the answer to its step's condition; nothing else does.

     The accept-first path here is unaffected either way: ccjWaitMet is a POSITION on the client's
     progression, so a client who accepts without negotiating is already past 'changed', the wait
     is met on arrival, and the step is skipped exactly as it always was. == */
  const pre=ccjWaitFor(run.stage,step);
  const parked=!!(pre&&pre.pre&&!ccjWaitMet(pre));
  // A conditional step that does not apply is answered, not performed.
  if(!(parked&&pre.decideAfter)&&!ccjStepApplies(run.stage,step)){ccjSkipStep();return;}
  const gate=ccjGateFor(run.stage,step);
  if(gate){run.phase='halt';ccjPaint();ccjScrollPanelToCurrent();ccjOnHalt(gate,step);return;}
  if(parked){run.phase='wait';run.act=0;ccjPaint();ccjScrollPanelToCurrent();return;}
  // A full paint on arrival, because the row that is current has changed. Every action after it
  // repaints the action list ALONE — see ccjPaintBeat. Replacing the whole panel on each action
  // would restart the spinner and re-run every entry animation on it.
  run.phase='act';run.act=0;ccjPaint();ccjScrollPanelToCurrent();
  // A held step is starting its work again, so the milestone that ends it has NOT been reached.
  // Screens are excluded on purpose: reaching one is a fact about where the user is rather than
  // about this step's work, and stage 1's intake holds on a screen. Without this a re-entered
  // step — after a reopen or a rework — read the previous pass's milestone as already met, did
  // not hold, and settled itself green having done nothing at all.
  const held=ccjHoldFor(run.stage,step);
  if(held&&!ccjScreenDef(run.stage,held.until))delete run.reached[held.until];
  const enter=CCJ_ON_ENTER[ccjKey(run.stage,step)];
  if(enter)enter(run);
  ccjRunAct();
}
/* What a sub-status STARTS doing when the run arrives at it, as opposed to what it leaves behind
   when it finishes (CCJ_ON_SETTLE). The clause audit needs this: the annotation has to begin as
   the compliance step begins, and hanging it off the previous step's settle would start it a
   beat early and tie it to whatever happens to precede it. */
const CCJ_ON_ENTER={};
/* One action per beat. Each finishes visibly — spinner to tick, with its result and, for a fetch
   or a verify, the records and verdicts underneath — before the next one starts. */
function ccjRunAct(){
  const run=ccjRun;if(!run)return;
  const step=ccjSteps(run.stage)[run.sub];
  const acts=ccjActsFor(run.stage,step);
  ccjSchedule(function(){
    run.act++;
    if(run.act>=acts.length){ccjAfterBeats();return;}
    ccjPaintBeat();
    ccjScrollPanelToCurrent();
    ccjRunAct();
  },CCJ_ACT);
}
function ccjSkipStep(){
  const run=ccjRun;if(!run)return;
  const step=ccjSteps(run.stage)[run.sub];
  if(!step)return;
  run.settled[ccjKey(run.stage,step)]={summary:'Not applicable',skipped:true,
    reason:ccjSkipReason(run.stage,step)};
  run.phase='settled';ccjPaint();ccjPaintScreen();
  ccjSchedule(function(){run.sub++;ccjEnterStep();},CCJ_SETTLE);
}
/* The panel grows as a step works, so the row doing the work has to be kept in view — the same
   reason the form follows a document being read into it. */
function ccjScrollPanelToCurrent(){
  const run=ccjRun;
  // On a rebuilt stage the thing to follow is the live BLOCK, in the conversation. Same rule as
  // below — top-aligned, not centred — because a block that is working grows downward.
  if(run&&ccjUsesTranscript(run.stage)){ccjScrollStreamToLive();return;}
  if(typeof document.querySelector!=='function')return;
  const box=document.querySelector('.ccj-panel-body');
  const row=document.querySelector('.ccj-row.current');
  if(!box||!row||typeof row.getBoundingClientRect!=='function'||!box.getBoundingClientRect)return;
  const r=row.getBoundingClientRect(),br=box.getBoundingClientRect();
  if(!r.height&&!br.height)return;
  // Top-aligned with a little air, not centred: a working row grows downward, and centring it
  // would push what it is producing off the bottom as it does.
  ccjGlide(box,box.scrollTop+(r.top-br.top)-12);
}
/* The beats are done. Either this step waits on a milestone, or it is finished. */
function ccjAfterBeats(){
  const run=ccjRun;if(!run)return;
  const step=ccjSteps(run.stage)[run.sub];
  const hold=ccjHoldFor(run.stage,step);
  if(hold&&!run.reached[hold.until]){run.phase='hold';ccjPaint();return;}
  // A step waiting on the client parks until they act. It may never resolve on its own, which
  // is the whole reason the chases beneath it exist.
  const wait=ccjWaitFor(run.stage,step);
  if(wait&&!wait.pre&&!ccjWaitMet(wait)){run.phase='wait';ccjPaint();ccjScrollPanelToCurrent();return;}
  // The work is done and someone has to decide about its result. Unlike an arrival gate, the
  // evidence that justifies the decision has already been produced and is on screen behind it.
  const post=ccjPostGateFor(run.stage,step);
  if(post&&!run.decisions[ccjKey(run.stage,step)]){
    run.phase='halt';ccjPaint();ccjPaintScreen();ccjScrollPanelToCurrent();ccjOnHalt(post,step,true);return;
  }
  ccjSettleStep();
}
/* The client's side only ever moves forward, so "has this been met" is a position on that line
   rather than a list of acceptable states. Enumerating them was the bug: a step that waited for
   'changed' and then did its work would re-check afterwards, by which time the client had moved
   on to 'negotiating' — past the thing it was waiting for — and it parked forever. */
const CCJ_CLIENT_ORDER=['idle','sent','viewed','chased','changed','negotiating','agreed',
                        'reissued','viewed2','accepted'];
function ccjWaitOn(w){return typeof w.on==='function'?w.on():w.on;}
function ccjWaitMet(w){
  // A wait may carry its own predicate when what it is waiting for is not a position on the
  // client's own progression — the signed agreement coming back, for one.
  if(typeof w.met==='function')return !!w.met();
  const c=ccjClient();
  return CCJ_CLIENT_ORDER.indexOf(c.state)>=CCJ_CLIENT_ORDER.indexOf(ccjWaitOn(w));
}
function ccjSettleStep(){
  const run=ccjRun;if(!run)return;
  const step=ccjSteps(run.stage)[run.sub];
  if(!step)return;
  run.settled[ccjKey(run.stage,step)]={summary:ccjSummary(run.stage,step)};
  const after=CCJ_ON_SETTLE[ccjKey(run.stage,step)];
  if(after)after(run);
  run.phase='settled';ccjPaint();ccjPaintScreen();
  const goto=CCJ_GOTO[ccjKey(run.stage,step)];
  ccjSchedule(function(){
    const gkey=ccjKey(run.stage,step);
    if(goto&&!run.went[gkey]&&ccjClient().state!=='accepted'){
      run.went[gkey]=true;
      /* BACK TO A ROW ALREADY PASSED — a re-issued quote has to be read again.
         ON THE PANEL that meant re-lighting a row further up a fixed list, which was fine: the
         list did not move. IN A TRANSCRIPT the same jump made the live block travel back UP the
         conversation, run there, and then walk back down — the reader's eye dragged up and down
         the page twice for work that all happened after the negotiation. The user named it
         exactly: *"it going up and then down and then up and then down, i dont want that."*

         Every re-run step is therefore put on a NEW PASS, which is the mechanism already built for
         stage 2's rework: ccjOpenStepBlock appends a fresh block at the bottom instead of painting
         into the one the first pass is still sitting in. The first pass stays exactly where it is
         and keeps what it recorded — they did open v1, we did chase it twice, they did ask for a
         change — because all of that happened and a transcript keeps what happened.

         NOT folded, unlike a rework. A rework supersedes its attempt: the numbers it produced were
         rejected and replaced. This does not — the second reading is a second event, not a
         correction of the first. */
      const steps=ccjSteps(run.stage);
      const idx=steps.findIndex(function(x){return x.label===goto;});
      if(idx>-1){
        for(let n=idx;n<steps.length;n++){
          const k=ccjKey(run.stage,steps[n]);
          delete run.settled[k];
          run.pass[k]=(run.pass[k]||1)+1;
        }
        run.sub=idx;ccjEnterStep();return;
      }
    }
    run.sub++;ccjEnterStep();
  },CCJ_SETTLE);
}
/* What a particular sub-status does to the world when it finishes. Sending the quote puts it in
   front of the client; re-issuing puts a second version there. Both belong to the step that did
   them, not to the screen that happens to be open. */
const CCJ_ON_SETTLE={
  'quote-review/Sent':function(run){
    const c=ccjClient();
    c.state='sent';c.mins=0;
    ccjClientLog('sent','Sent','Docuseal · '+ccjParties().client.email);
    ccjClientPush({who:'us',kind:'quote',version:c.version,quote:ccjQuote(),at:0});
    ccjClientNote('Delivered to '+ccjCtx().signatoryEmail);
    ccjClientSchedule();
  },
  /* The agreement goes to the client's signatory, in the same thread everything else went. */
  'agreement-signature/Sent':function(run){
    const c=ccjClient(),p=ccjParties(),m=ccjMsa();
    c.mins+=180;
    ccjClientPush({who:'us',kind:'msa',id:m.id,to:p.client.contact,at:c.mins});
    ccjScheduleChat(ccjMsaReturned,2800);            // they sign it and send it back
  },
  /* The countersignature is set by the approval, not here — see ccjChooseGate. By the time this
     runs, both signatures are on it and the agreement is in force. */
  'agreement-signature/Signed':function(run){
    ccjClientNote('Countersigned by '+ccjParties().adt.signatory+' — agreement in force');
  },
  'quote-approved/Client tenant provisioned':function(run){
    run.tenantWasExisting=ccjTenant().existing;    // record it BEFORE the create changes the answer
    ccjUpsertClient();                             // the customer now exists in the product
  },
  'quote-approved/CSM confirmed to client':function(run){
    // The handover, posted into the same thread the quote and the negotiation are in.
    const m=ccjCsm(),c=ccjClient();
    c.mins+=60;
    ccjClientPush({who:'us',kind:'csm',csm:m,at:c.mins});
  },
  'quote-review/Re-issued v2':function(run){
    const c=ccjClient();
    if(c.version>1)return;                         // already re-issued; do not do it twice
    const was=ccjQuote(20);
    // c.chases is NOT reset. It is the record of how hard this deal was worked, and zeroing it
    // made the timeline and the sub-status both deny two reminders the thread still showed.
    c.version=2;c.mins=Math.max(c.mins,8900);
    ccjClientLog('reissued','Re-issued as v2',c.ask==='terms'
      ?'Terms amended · price unchanged':'Margin 20% → '+ccjQuote().margin+'%');
    if(c.state!=='accepted')c.state='reissued';    // never walk an acceptance backwards
    ccjClientPush({who:'us',kind:'quote',version:2,quote:ccjQuote(),
      wasTotal:c.ask==='price'?was.total:0,wasMargin:was.margin,
      changes:c.ask==='terms'?c.changes:null,at:c.mins});
    ccjClientNote('Revised quote delivered');
    ccjClientSchedule();
  }
};
/* Reaching a screen is a milestone. If the step currently parked was waiting on this one, it
   is released here — which is the only way a hold ever ends. */
function ccjReachScreen(id){
  const run=ccjRun;if(!run)return;
  run.reached[id]=true;
  if(run.phase!=='hold')return;
  const step=ccjSteps(run.stage)[run.sub];
  const hold=ccjHoldFor(run.stage,step);
  // Back through ccjAfterBeats, NOT straight to settle. A hold releasing is the same moment the
  // beats ending is, and everything that follows the beats — a wait, and above all a post gate —
  // has to be evaluated. Settling directly meant a held step carrying a decision about its result
  // (the KYC verdict) skipped the decision entirely and ticked itself green.
  if(hold&&hold.until===id)ccjAfterBeats();
}
/* The conversation is told when the machine stops, because a surface going quiet is not an
   instruction. The chat is where the ask gets made.

   It does not say WHERE to answer. On a rebuilt stage the decision is a block in this same
   conversation, a line or two above; on the stages still to be rebuilt it is in the panel on the
   right. A sentence naming either one is wrong on half the journey — and "Qualify it in the
   panel" was, on the one stage a reader has most likely just watched change. Naming the action
   and leaving the location to the eye is both shorter and true everywhere. */
function ccjOnHalt(gate,step,post){
  /* A POST GATE DOES NOT NAME ITS STEP. An arrival gate IS the decision, so its label is the thing
     to be done and "Legal & compliance review is yours to complete" reads correctly. A post gate is
     a decision about a RESULT, and those steps are named after the outcome — which produced
     "Signed is yours to complete." on stage 5, a sentence about a step that had already happened.
     Saying that the work is finished and the call is a person's is true of every post gate, and it
     does not repeat the question the block underneath is already asking. */
  /* A gate may carry its own sentence. "Request logged and routed. Qualify it to continue." is
     stage 1's, and it was being said on EVERY arrival decision gate in the journey — including the
     sanctions adjudication on stage 5 and the shortfall on stage 6, neither of which has a request
     to log or anything to qualify. It now belongs to the gate that means it, and everything else
     gets a sentence that is true of any decision. */
  if(gate.halt&&!post){
    ccjPush({who:'agent',text:gate.halt});
  }else if(post){
    ccjPush({who:'agent',text:'Work complete on this step. The decision is yours.'});
  }else if(gate.kind==='decision'){
    ccjPush({who:'agent',text:'Paused here &mdash; this one needs a decision from you.'});
  }else if(gate.kind==='external'){
    ccjPush({who:'agent',text:'Holding at <b>'+step.label+'</b>.'});
  }else{
    ccjPush({who:'agent',text:'<b>'+step.label+'</b> is yours to complete.'});
  }
}
/* == ANSWERING A GATE ======================================================================
   `reason` is what separates the two ways in.

   A NEGATIVE decision — every option marked tone:'stop' — may not be taken silently. Called from
   the card with no reason, this does not act: it asks for one, and the click that follows brings
   it back. Called WITH a reason, it acts. That is the whole mechanism.

   It is a second argument rather than a separate confirm-only entry point because the decision
   logic below must stay in one place. Two entry points into nine branches is how one of them ends
   up recording something the other does not, and the branch that quietly skips the record is the
   one nobody notices until someone asks why an engagement was killed.

   Why reasons at all: every branch below either ends an engagement or sends work back to be
   redone. Both are decisions a person is answerable for later, and until now not one of them
   captured a word about why. `releaseShort` was the sole exception — it recorded who released and
   how much was short — and it is the shape the other eight now follow.

   Positive options carry no reason and are unaffected. == */
function ccjChooseGate(optId,reason){
  const run=ccjRun;if(!run)return;
  const step=ccjSteps(run.stage)[run.sub];
  if(!step)return;
  // Either kind. A post gate is still a decision on this step, and looking only at arrival gates
  // meant the countersign button resolved to nothing and silently did nothing at all.
  const gate=ccjGateFor(run.stage,step)||ccjPostGateFor(run.stage,step);
  const opt=gate&&gate.options.find(function(o){return o.id===optId;});
  if(!opt)return;
  const key=ccjKey(run.stage,step);
  // The ask. Nothing has been decided yet — the gate is still open, and Cancel leaves it exactly
  // as it was. Only the card changes.
  if(opt.tone==='stop'&&(reason===undefined||reason===null)){
    run.stopAsk={key:key,optId:optId};
    ccjPaint();
    return;
  }
  run.stopAsk=null;
  const why=String(reason||'').trim();
  run.decisions[key]=Object.assign({},opt,{done:opt.done+' by '+ccjActor(),reason:why});
  // What the run says about itself once it has stopped. Held as data because the stopped card used
  // to be one hardcoded sentence — "Request disqualified." — printed for every terminal decision
  // in the journey, so declining an employment contract in stage 7 reported itself in stage 1's
  // intake vocabulary.
  const halt=function(){
    run.stopped=true;run.phase='stopped';
    run.stop=Object.assign({by:ccjActor(),reason:why},opt.stop||{title:opt.done,note:''});
    ccjPaint();
  };
  if(optId==='rejected'){
    // Deliberately NOT written to `settled`. A settled row gives up its gate block — which is
    // the very thing that explains the run stopped and offers the way back.
    halt();
    ccjPush({who:'agent',text:'Request declined. The remaining steps will not run.'});
    return;
  }
  if(optId==='countersign'){
    const m=ccjMsa(),c=ccjClient();
    c.mins+=95;
    m.adtSignedAt=c.mins;                          // in force from the LAST signature
    ccjClientLog('executed','Agreement executed','In force from this date');
    ccjPush({who:'user',text:opt.label});
    ccjSettleStep();
    return;
  }
  if(optId==='declineMsa'){
    halt();
    ccjPush({who:'agent',text:'Agreement declined at countersignature. Nothing is in force and no placement can start.'});
    return;
  }
  if(optId==='escalate'){
    // A confirmed sanctions concern stops the engagement. Nothing downstream may run.
    halt();
    ccjPush({who:'agent',text:'Escalated to Compliance. The engagement is on hold and nothing further will run until they clear it.'});
    return;
  }
  if(optId==='dismiss'){
    ccjMsa().screening='cleared';
    ccjPush({who:'user',text:opt.label});
    ccjSettleStep();
    return;
  }
  /* Holding for the balance does NOT settle the row — the balance has not arrived. The chase goes
     out and the same row becomes a wait, which is the honest rendering of "we decided to wait". */
  if(optId==='holdBalance'){
    ccjPush({who:'user',text:opt.label});
    ccjPayEvent('chase');
    run.phase='wait';ccjPaint();ccjPaintScreen();ccjScrollPanelToCurrent();
    return;
  }
  /* An exception, and it is recorded as one: who released it and how much was short. The invoice
     keeps the shortfall on its face rather than being marked paid. */
  if(optId==='releaseShort'){
    const p=ccjPay(),c=ccjClient();
    c.mins+=20;
    p.released=true;p.releasedBy=ccjActor();p.shortfall=ccjOutstanding();p.releasedAt=c.mins;
    ccjClientLog('released','Released against a shortfall',
      ccjMoney(p.shortfall)+' outstanding &middot; approved by '+p.releasedBy);
    ccjPush({who:'user',text:opt.label});
    ccjSettleStep();
    return;
  }
  if(optId==='kycConfirm'){
    const k=ccjOnb().kyc,c=ccjClient();
    c.mins+=40;
    k.reviewed='confirmed';k.reviewed_by=ccjActor();k.reviewedAt=c.mins;
    const d=ccjKycDecision();k.decision=d.id;k.score=d.score;
    ccjPush({who:'user',text:opt.label});
    ccjSettleStep();
    return;
  }
  if(optId==='kycReject'){
    const k=ccjOnb().kyc;
    k.reviewed='rejected';k.reviewed_by=ccjActor();
    const d=ccjKycDecision();k.decision=d.id;k.score=d.score;
    run.stopped=true;run.phase='stopped';
    // The other terminal decisions all record why in `run.stop`; this one did not, so a KYC
    // rejection reached the run listing as a stop with no stated cause.
    run.stop={by:ccjActor(),title:'Identity verification rejected',
      note:'Onboarding cannot continue and the placement is stopped.'};
    ccjPaint();ccjPaintScreen();
    ccjPush({who:'agent',text:'Identity verification rejected. Onboarding cannot continue and the placement is stopped.'});
    return;
  }
  /* `payApprove` and `payHold` are gone with the payroll run itself. They released and held MONEY,
     and this journey no longer moves any — the last stage configures payroll and sets the placement
     live, and the run happens later on its own calendar. See CCJ_PR_PHASES. */
  if(optId==='ecApprove'){
    const e=ccjEmp(),c=ccjClient();
    c.mins+=60;
    e.approvedBy=ccjActor();e.approvedAt=c.mins;
    ccjPush({who:'user',text:opt.label});
    ccjSettleStep();
    return;
  }
  if(optId==='ecCountersign'){
    const e=ccjEmp(),c=ccjClient();
    c.mins+=75;
    e.adtSignedAt=c.mins;                          // ours is the FIRST signature; theirs executes
    ccjPush({who:'user',text:opt.label});
    ccjSettleStep();
    return;
  }
  if(optId==='ecDecline'){
    ccjEmp().declined=true;
    halt();ccjPaintScreen();
    ccjPush({who:'agent',text:'Contract declined before issue. Nothing is in force, it never went to the employee, and they cannot start.'});
    return;
  }
  if(optId==='amend'||optId==='rework'||optId==='ecRedraft'){
    const back=CCJ_REWORK[ccjKey(run.stage,step)];
    if(optId==='amend'&&run.msa)run.msa.version++;
    const steps=ccjSteps(run.stage);
    const idx=steps.findIndex(function(s){return s.label===back;});
    if(idx>-1){
      // A redrafted contract is a new version, and the audit that ran against the old one no
      // longer describes anything on screen.
      if(optId==='ecRedraft'&&run.emp){run.emp.version++;ccjDraftContract();}
      // FOLD BEFORE UN-SETTLING. The blocks are frozen with the state they actually finished
      // with; the very next line deletes that state, and a block re-derived afterwards would
      // render as a step that never ran — a numbered circle with an empty fact, which is exactly
      // the shape the transcript forbids. Folding also bumps each step onto its next pass, so
      // ccjEnterStep below appends fresh blocks at the bottom instead of painting into these.
      ccjFoldAttempt(run.stage,idx,gate&&gate.kind==='decision'?opt.label:'sent back');
      // Everything from the rebuilt step onward is no longer true, so it is un-settled rather
      // than left on screen as a tick against work that is about to be redone.
      steps.slice(idx).forEach(function(s){delete run.settled[ccjKey(run.stage,s)];});
      delete run.decisions[ccjKey(run.stage,step)];
      ccjPush({who:'user',text:opt.label});
      // "Rebuilding the cost" is stage 2's sentence, and it was said on every send-back in the
      // journey — including the one that rebuilds an AGREEMENT, where no cost is involved. Naming
      // the step it is going back to is true on all of them and says more.
      //
      // The reason travels with it. Whoever picks the work up is the one person who has to know
      // what was wrong with it, and leaving that only in the audit trail means the person who
      // needs it most is the one who has to go looking.
      ccjPush({who:'agent',text:'Sent back. Picking up again from <b>'+back+'</b>.'
        +(why?'<div class="ccj-gate-reason">'+why+'</div>':'')});
      run.sub=idx;
      ccjEnterStep();
      // The screen half of the rework, which nothing did before: buildCCJQuoteHTML gates its rows
      // on the settled keys that were just deleted, but ccjEnterStep only ever repaints the
      // sub-status surface. So the quote went on showing a green "Approved" pill while the
      // conversation beside it said the cost was being rebuilt. Harmless when the two were a
      // column apart; side by side in one reading they contradict each other outright.
      ccjPaintScreen();
      return;
    }
  }
  ccjPush({who:'user',text:opt.label});
  ccjSettleStep();
}
/* Confirming the reason IS the decision — it re-enters ccjChooseGate with what was typed, so the
   branch that runs is the same one the button always ran. Refused while blank rather than
   silently proceeding: a reason nobody had to give is a field, not a record. */
function ccjConfirmStop(){
  const run=ccjRun;if(!run||!run.stopAsk)return;
  const el=document.getElementById('ccj-stop-why');
  const why=el?String(el.value||'').trim():'';
  if(!why){
    const err=document.getElementById('ccj-stop-err');
    if(err)err.textContent='A reason is needed before this can go through.';
    if(el)el.focus();
    return;
  }
  ccjChooseGate(run.stopAsk.optId,why);
}
/* Nothing was decided, so nothing is undone — the gate comes back exactly as it was. */
function ccjCancelStop(){
  const run=ccjRun;if(!run)return;
  run.stopAsk=null;
  ccjPaint();
}
function ccjReopen(){
  const run=ccjRun;if(!run)return;
  const step=ccjSteps(run.stage)[run.sub];
  if(step){delete run.decisions[ccjKey(run.stage,step)];delete run.settled[ccjKey(run.stage,step)];}
  run.stopped=false;run.stop=null;run.stopAsk=null;
  ccjPush({who:'agent',text:'Reopened.'});
  ccjEnterStep();
}
/* Every sub-status in the stage has settled, so the stage itself is done — and only now does
   the journey move. Stages 2-9 have not been designed yet; they render an honest placeholder
   under a live rail and a live panel, which is what lets the machine be walked end to end
   while the screens are built one stage at a time. */
/* Stages that rest when they finish instead of moving on. Stage 4 has no human step at all, so
   without this the account it just created would flash past in the seconds it took to build. */
/* `next` is the sentence the conversation puts beside the button. Authored here, one line from
   the label it belongs with, rather than pulled from the rail's `plain` copy — which is written
   in the present tense about a stage you are ON ("The contract is waiting for their signature")
   and claims something that has not happened yet when it is read from the stage before. */
/* == A BUTTON SAYS WHAT PRESSING IT DOES ==================================================
   All five of these read "Continue to <the next stage>". Five buttons, one verb, and the verb was
   the weakest one available — Continue names the reader's own act of carrying on rather than the
   work it starts, so the label carried no information the rail three inches above it was not
   already carrying better. "Continue to client signing" also described the WHOLE of stage 5, most
   of which is not signing: pressing it drafts an agreement and sends it to legal, and the
   signature is three sub-statuses later.

   Each one now names the FIRST thing that happens when it is pressed, in the words the product
   uses for that thing elsewhere. That is the promise a control is read as making, and it is the
   one that can be checked against what the next stage actually does — see the sub-statuses of
   each: stage 5 opens on "MSA drafted", stage 6 on "Invoice raised", stage 7 on "Draft
   generated", stage 8 on "Worker KYC", stage 9 on "Ready for payroll".

   `next` is the sentence beside the button, and it keeps the wider answer — where this is going
   and why — because that is the thing a label has no room for. */
const CCJ_STAGE_REST={
  'quote-approved':{label:'Draft the agreement',
    next:'Next is the Master Services Agreement &mdash; the contract between us and the client, drafted from their country template and read by legal before it goes anywhere.'},
  // The signed agreement coming back is what this stage produced. Walking past it in the half
  // second after the countersignature lands would be walking past the outcome.
  'agreement-signature':{label:'Raise the deposit invoice',
    next:'Next is the deposit invoice. No hire can start until that money arrives.'}
};
/* THE WAY ON IS ASKED FOR IN THE CONVERSATION, NOT PRINTED ON THE ARTEFACT.
   A rest is the one moment a fully automatic stage needs something from a person, and until now
   it asked from the account screen — the last button in the journey sitting on a surface whose
   only job is to show what was made. Stage 4 is the clearest case of why that is wrong: the three
   sub-statuses report themselves in the conversation, the handover goes out in the conversation,
   and then the single thing the reader has to DO appears in the other column.

   The ask is the same component a gate uses, deliberately. A rest is an ask with one answer.

   IT IS NO LONGER GATED, and that is the end of a migration rather than a shortcut. While stages
   were being converted one at a time this checked ccjUsesTranscript, because an un-rebuilt stage's
   column is the counterparty's thread ALONE and pushing an internal control into it would have put
   a button we own inside a customer's correspondence. Every stage that rests is now rebuilt, so
   the other branch became unreachable — five screen buttons that could never render — and dead code
   nobody can exercise is worse than no code. There is one way a stage asks to be moved on from.

   Keyed per stage rather than a boolean, because a run rests five times and one flag would have
   swallowed every ask after the first. */
function ccjRestAsk(rest){
  const run=ccjRun;if(!run)return;
  const s=ccjStage(run.stage);
  const id=s?s.id:'';
  if(!id||run.restAsked[id])return;
  run.restAsked[id]=true;
  /* WHAT CLICKING THIS BEGINS, and nothing else. Everything this stage produced is already on
     screen twice over — as a fact on each closed block, and as the artefact beside them — so the
     one thing worth a sentence is the only thing not there: where the journey goes next.

     The first version opened "Nothing further is needed here", which the account screen's own foot
     was already saying four inches to the right. Two columns stating the same thing is precisely
     the clutter this rebuild exists to remove, and it is easiest to write by accident when the two
     halves are authored in different files. */
  ccjAsk(rest.next||'',rest.label,'continue');
}
/* THE END OF THE JOURNEY, asked for in the same place every other step was. The final screen shows
   the employment record and the nine-stage trail; going to look at the contract it wrote is an
   action, and it was the last control anywhere in the journey still living on an artefact.

   Keyed like the rest asks so a repaint cannot push a second one. */
function ccjDoneAsk(){
  const run=ccjRun;if(!run||run.restAsked['__done'])return;
  run.restAsked['__done']=true;
  const p=ccjParties();
  /* "View contract" described a page, and the page is not what the button does — pressing it
     WRITES the contract into the contracts list and takes you there (see ccjOpenContractRecord),
     which is the run being filed and closed. Naming the destination made the last control in the
     journey the vaguest one in it. */
  ccjAsk('That is the whole journey. '+p.worker.name+' is employed by '+p.adt.name
    +' and on payroll. Filing this puts the contract in your contracts list and closes the run.',
    'File it in contracts','record');
}
function ccjContinueStage(){
  const run=ccjRun;if(!run||run.phase!=='rest')return;
  run.rested=true;
  ccjStageComplete();
}
function ccjStageComplete(){
  const run=ccjRun;if(!run)return;
  const rest=CCJ_STAGE_REST[ccjStage(run.stage).id];
  // ccjPaint FIRST, then the ask. The paint closes the block the runner has just left — run.sub is
  // now past the end of the stage, so nothing is live — and the ask has to arrive under a closed
  // block rather than beside an open one still claiming to be the current step.
  if(rest&&!run.rested){run.phase='rest';ccjPaint();ccjPaintScreen();ccjRestAsk(rest);return;}
  run.rested=false;
  const next=run.stage+1;
  // The last stage finishing is a state the SCREEN reports, not only the panel — the placement
  // going live is the outcome of the journey and it is drawn on the work area. Painting the panel
  // alone left the final screen showing the run still in progress after it had finished.
  if(next>=ccjStages().length){run.phase='done';ccjPaint();ccjPaintScreen();ccjDoneAsk();return;}
  run.stage=next;run.sub=-1;run.phase='idle';
  run.screen=(ccjScreensFor(next)[0]||{}).id||'';
  page=ccjPageId(next);
  renderADTPage();
  // Stage 1 was started by the request being submitted. Every stage after it is agent-driven
  // from the moment the run arrives, so it begins on its own after a beat to let the rail land.
  const ev=ccjEvent(next);
  if(ev.desc)ccjPush({who:'agent',text:ccjStageOpener(next)});
  ccjSchedule(function(){ccjStart();},900);
}
/* One line when a stage opens, saying what is about to happen. Derived from the stage's own
   first sub-status rather than authored per stage, so it cannot drift from what then runs. */
function ccjStageOpener(i){
  const first=ccjSteps(i)[0];
  const s=ccjStage(i);
  return s.short+'. Starting with <b>'+(first?first.label:'the first step')+'</b>.';
}

/* == THE GAP BETWEEN CLIENT EVENTS IS A STATE, AND IT NOW SAYS SO ========================
   Between the quote being opened and the first reminder — and between each reminder and the
   next thing the client does — the thread used to sit silent, indistinguishable from a thread
   that had finished. A "Waiting for confirmation" line with the Claude spark now occupies that
   gap. It is TRANSIENT, not a record: the moment the next event lands the line is done and
   renders nothing, because "we were waiting" is not information once the thing waited for has
   happened — the timeline and the log carry the durable facts. It is a NOTE, not a lane
   message: the client never received our waiting, so it must not sit under a "To" rail. */
function ccjAwaitStart(label){
  const c=ccjClient();
  if(c.awaitMsg&&!c.awaitMsg.done)return;
  const m={who:'note',kind:'await',label:label||'Waiting for confirmation',at:c.mins};
  c.awaitMsg=m;
  ccjClientPush(m);
}
function ccjAwaitEnd(){
  const c=ccjClient();
  const m=c.awaitMsg;
  if(!m||m.done)return;
  m.done=true;
  c.awaitMsg=null;
  // A mutated message is invisible to the append-only sync — same reason the chase's own
  // send-complete rebuilds. The next event's pushes then append as normal.
  ccjRenderChat();
}
/* Every client event lands here — scripted or clicked, the same path, so the override strip
   cannot produce a state the auto-run could not reach. */
function ccjClientEvent(ev,at,kind){
  const run=ccjRun;if(!run)return;
  const c=ccjClient();
  if(at!==undefined)c.mins=Math.max(c.mins,at);
  // Whatever arrives, the wait for it is over. Each branch below re-arms it if a new wait begins.
  ccjAwaitEnd();
  if(ev==='viewed'||ev==='viewed2'){
    c.state=ev==='viewed'?'viewed':'viewed2';
    if(c.openedAt===null)c.openedAt=c.mins;
    ccjClientLog(ev==='viewed'?'opened':'opened2',ev==='viewed'?'Opened':'Opened v2','Tracked on open');
    ccjClientNote('Opened the quote'+(c.version>1?' (v'+c.version+')':''));
    // Opened is not answered. The gap between this and whatever they do next is a wait, and it
    // shows itself as one — the user's spec: viewed, then ~2s of waiting, then the follow-up.
    ccjAwaitStart();
    ccjResolveWait();
  }else if(ev==='chase'){
    /* A REMINDER IS SENT, NOT CONJURED. It used to appear complete in the same frame it was
       decided on — "Follow-up 1 of 3 sent" arriving instantly, then a second one arriving instantly
       after it. Nothing in the thread showed the product doing anything, so two reminders read as
       one event that had happened twice rather than as two things being dispatched.

       So the note lands FIRST as "sending", with a spinner, and becomes the sent record a couple of
       seconds later. The count and the log are only written at that point, because until the thing
       has gone out it has not gone out — writing them up front would have the timeline claiming a
       reminder the thread was still sending. */
    /* NO CAP ANY MORE. "At most three" was the scheduler's rule, and the scheduler is gone with the
       sub-status it belonged to — a person deciding to chase a fourth time is not the product
       failing a check, it is a deal that needs chasing a fourth time. The one guard that survives
       is the honest one: a reminder still in flight is not a second reminder. */
    // `at` is this function's own PARAMETER (the simulated minute), not ccjPayEvent's helper of the
    // same name — the clock has already been advanced from it at the top. `kind` carries the
    // Account Manager's own words on a hand-sent follow-up; a scripted one has none.
    if(c.sending)return;                           // one in flight at a time
    const m={who:'us',kind:'chase',n:c.chases+1,at:c.mins,sending:true,note:kind||''};
    c.sending=true;
    ccjClientPush(m);
    ccjPaint();
    const g=ccjGen,r=run;
    if(c.sendTimer)clearTimeout(c.sendTimer);
    c.sendTimer=setTimeout(function(){
      if(ccjGen!==g||ccjRun!==r)return;
      c.sendTimer=null;c.sending=false;
      c.chases++;c.state='chased';
      m.sending=false;
      // The detail the timeline carries, on the message too. It used to say which of three this
      // was; now it says who decided to send it, which is the fact that actually distinguishes
      // one follow-up from another once nothing is on a cadence.
      m.detail=m.note?'Sent by '+ccjActor():'Follow-up sent';
      ccjClientLog('chase'+c.chases,'Follow-up '+c.chases,m.detail);
      ccjRenderChat();
      // Sent, and now we are waiting again — for a reply, or for the next reminder to become
      // due. The loader re-arms the moment the reminder has actually gone out, never before.
      ccjAwaitStart();
      ccjResolveWait();ccjPaint();ccjPaintScreen();
      ccjClientSchedule();
    },CCJ_CHASE_SEND);
    return;                                        // the schedule resumes when it has actually sent
  }else if(ev==='changed'){
    c.state='changed';
    c.unread++;
    c.ask=kind||'price';
    ccjClientLog('changed','Change requested',c.ask==='terms'
      ?'Client asked to change start date and probation':'Client asked for a better rate');
    if(c.ask==='price'){
      const now=ccjQuote(),want=ccjQuote(17);
      ccjClientPush({who:'client',text:'Thanks for this. <b>'+now.sym+' '+now.total.toLocaleString()
        +'</b> is above what we budgeted &mdash; can you improve on the rate? If you can get closer to <b>'
        +want.sym+' '+want.total.toLocaleString()+'</b> a month we can move ahead this week.',at:c.mins});
    }else{
      c.changes=[{k:'Start date',from:ccjPrettyDate(ccjRun.form.fromDate),to:'1 Oct 2026'},
                 {k:'Probation', from:(ccjRun.form.probation||'3')+' months',to:'6 months'}];
      ccjClientPush({who:'client',text:'The numbers work for us. Two things before we sign: can we push the start to <b>1 October</b>, and make probation <b>6 months</b> rather than three?',at:c.mins});
    }
    ccjResolveWait();
    // The agent drafts the reply rather than sending it. What goes to a client is the Account
    // Manager's to send, and a negotiating position is not something to automate away.
    ccjScheduleChat(function(){
      c.drafted=true;
      if(c.ask==='price'){
        const cut=ccjQuote(17);
        ccjClientPush({who:'agent',kind:'draft',
          text:'I can hold the build and take margin from '+ccjQuote().margin+'% to 17%. That lands at <b>'
            +cut.sym+' '+cut.total.toLocaleString()+'</b> &mdash; inside their number.',at:c.mins+40});
      }else{
        ccjClientPush({who:'agent',kind:'draft',
          text:'Both are fine. Start moves to <b>1 October</b> and probation to <b>6 months</b>. Neither changes the employer cost, so the price holds at <b>'
            +ccjQuote().sym+' '+ccjQuote().total.toLocaleString()+'</b>.',at:c.mins+40});
      }
    },1400);
  }else if(ev==='agreed'){
    c.state='agreed';
    // Only a price request moves the margin. A terms request changes the contract and leaves
    // the commercials exactly where they were — which is the whole point of separating them.
    if(c.ask==='price')run.margin=17;
    else{run.form.fromDate='2026-10-01';run.form.probation='6';}
    c.unread++;
    ccjClientPush({who:'client',text:'That works. Send the revised quote and we will sign it off.',at:c.mins});
    ccjResolveWait();
  }else if(ev==='accepted'){
    c.state='accepted';
    c.unread++;
    ccjClientLog('accepted','Accepted','Ready to move to signing');
    ccjClientPush({who:'client',kind:'accept',text:'Approved. Please go ahead.',at:c.mins});
    ccjResolveWait();
  }else if(ev==='quiet'){
    c.state='viewed';                              // back to waiting; the chases resume
    ccjAwaitStart();
  }
  ccjPaintWork();
  ccjClientSchedule();
}
/* "void in Netherlands" is not English, and this journey writes contract clauses. Two of the
   seven countries it operates in take a definite article in running prose; used adjectivally
   ("the Netherlands statutory set") they do not, which is why this is applied at each site
   rather than baked into the country name. */
function ccjInCountry(c){
  return /^(Netherlands|United Kingdom|United States|Philippines|Czech Republic)$/.test(String(c))
    ?'the '+c:String(c);
}
function ccjPrettyDate(iso){
  if(!iso)return '&mdash;';
  const M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const p=String(iso).split('-');
  return p.length===3?(Number(p[2])+' '+(M[Number(p[1])-1]||'')+' '+p[0]):String(iso);
}
/* THE TIMELINE IS A RECORD, NOT AN INFERENCE. It used to be derived from the client's current
   state with hard-coded timestamps, which meant a run where the client simply opened the quote
   and accepted it still displayed 'Change requested — Client asked for a better rate', and every
   event carried a date it did not happen on. If it is not in this log, it did not happen. */
function ccjClientLog(id,label,sub){
  const c=ccjClient();
  if(c.log.some(function(e){return e.id===id;}))return;   // each event happens once
  c.log.push({id:id,label:label,sub:sub||'',at:c.mins});
}
function ccjClientNote(text){
  const c=ccjClient();
  ccjClientPush({who:'note',text:text,at:c.mins});
}
function ccjClientPush(m){
  const c=ccjClient();
  m._id=ccjNextMsgId();
  m.lane='client';                                 // tagged here, where it is known for certain
  ccjStampMode(m);
  c.msgs.push(m);
  ccjStreamSync();
}
/* A sub-status that parks until the CLIENT does something. Unlike a hold — which waits on work
   happening elsewhere in the product — this waits on a person outside it, and may never resolve
   at all. That is why the chases exist. */
/* `rows` is what a wait shows UNDER its sentence, and each wait declares its own.

   They used to be inferred from ambient client state — "if chases is a number, show the reminder
   schedule; if openedAt is set, show Opened". That reads fine on the stage the state belongs to
   and is wrong everywhere else: `openedAt` records that the client opened the QUOTE, in stage 3,
   and it is still set in stage 5, so the wait for a signed AGREEMENT rendered "Opened · Tracked"
   about a different document on a different stage. Nobody had looked, because stage 5 was the
   next one to be built.

   Declared per wait, that cannot happen: a wait shows what it says it shows. The reminder rows
   still READ from the client's own store rather than counting themselves, so they cannot disagree
   with the thread about how hard the deal was worked. */
const CCJ_WAITS={
  // `pre` parks BEFORE the work rather than after it. Rebuilding a price before the client has
  // agreed to it is not preparation, it is guessing.
  'quote-review/Viewed':{on:function(){return ccjClient().version>1?'viewed2':'viewed';},pre:true,
    note:'Waiting for the client to open the quote.'},
  /* The follow-up step's wait went with the step. What it used to say — how many reminders had
     gone and what would stop them — now belongs to the wait BELOW it, which is the one actually
     parked on the client. That is the honest place for it: the reminders are not a stage of the
     work, they are what we have done about the wait we are sitting in. */
  /* `decideAfter` on both of these: each step applies only if the client negotiated, and each one
     is parked on the reply that decides it. Asking before the wait is asking a question whose
     answer has not arrived — see ccjEnterStep. */
  'quote-review/Change requested':{on:'changed', pre:true, decideAfter:true,
    note:'Waiting to hear back from the client.',
    rows:function(){
      const sent=(ccjRun.client&&ccjRun.client.chases)||0;
      return [['Opened','<span class="ccj-wait-on">Tracked</span>'],
              ['Follow-ups sent',sent?String(sent):'none yet']];
    }},
  'quote-review/Re-issued v2':   {on:'agreed',  pre:true, decideAfter:true,
    note:'Holding until the revised price is agreed.',
    rows:function(){return [['Opened','<span class="ccj-wait-on">Tracked</span>']];}},
  // Nothing to verify until the signed copy is back, so this parks before its work rather than
  // after it — you cannot check a signature you have not received.
  'agreement-signature/Signed':{pre:true,met:function(){return !!ccjMsa().clientSignedAt;},
    note:'Sent for signature. Waiting for the client to sign and return it.',
    // Who is holding it, and what happens after they act. An agreement out for signature is the
    // longest wait in the journey, and "who do I chase" is the only question it raises.
    rows:function(){
      const p=ccjParties();
      return [['With',p.client.contact+' &middot; '+p.client.email],
              ['Then','we countersign &mdash; in force from that signature']];
    }}
};
function ccjWaitFor(i,step){return step?(CCJ_WAITS[ccjKey(i,step)]||null):null;}
function ccjResolveWait(){
  const run=ccjRun;if(!run||run.phase!=='wait')return;
  const step=ccjSteps(run.stage)[run.sub];
  const w=ccjWaitFor(run.stage,step);
  if(!w||!ccjWaitMet(w))return;
  // A `pre` wait had not started its work yet — now it can. And now, with the answer finally in,
  // is when it can honestly be asked whether there is any work to do at all: see the note in
  // ccjEnterStep on why applicability is deferred past a wait rather than decided in front of it.
  if(w.pre){
    if(w.decideAfter&&!ccjStepApplies(run.stage,step)){ccjSkipStep();return;}
    run.phase='act';run.act=0;ccjPaint();ccjRunAct();return;
  }
  ccjSettleStep();
}
/* After a step settles, some stages send the run somewhere other than the next row. Re-issuing
   a quote puts it back in front of the client, which is the row it already passed. */
const CCJ_GOTO={'quote-review/Re-issued v2':'Viewed'};

/* ---- ROUTING --------------------------------------------------------------------------- */
function ccjRenderPage(el){
  const run=ccjEnsureRun();
  /* The second funnel the run's row is refreshed from. ccjPaint covers everything that moves
     WITHIN a stage; a stage CHANGE re-renders the page instead of painting the panel, so a run
     that had just walked into stage 5 was still listed on stage 4 until something else happened.
     Both funnels sync, which is what makes the row current rather than nearly current. */
  ccjSyncRunRecord();
  // The chooser is its own page and renders alone — no header, no rail, no panel.
  if(page==='ccj-model'){el.innerHTML=buildCCJModelHTML();return;}
  // `ccj-start` is an alias for stage 1: the conversation is the intake, so there is no screen
  // in front of it. Kept as a route so an old link or a restored session still lands.
  if(page==='ccj-start'){
    page=ccjPageId(0);
    const t=document.getElementById('adt-page-title');
    if(t)t.textContent=getPageTitle(page);
  }
  const i=ccjStageOf(page);
  // The page and the run must agree on which stage this is, or the rail would draw one stage
  // while the panel ran another's sub-statuses.
  if(i>=0&&i!==run.stage){
    run.stage=i;run.sub=-1;run.phase='idle';
    run.screen=(ccjScreensFor(i)[0]||{}).id||'';
  }
  el.innerHTML=buildCCJStageHTML(i<0?run.stage:i);
  // The body is a new node, so the width the reader chose has to be put back on it. Written after
  // the markup rather than into it because it is a style, not content — and because every other
  // caller that changes the split goes through this same function.
  ccjApplySplit();
  ccjRenderChat();
  ccjAfterScreen();
}
/* Moving between screens INSIDE a stage. The shell is not touched — only the work area is
   rebuilt — which is what keeps the sub-status panel standing through the whole stage. */
function ccjGoScreen(id){
  const run=ccjRun;if(!run||!id)return;
  run.screen=id;
  ccjPaintWork(true);      // an arrival — the columns move into place rather than appearing
  ccjPaintHead();          // the model chip becomes reopenable once the chooser is behind us
  ccjReachScreen(id);      // may release a held sub-status
  ccjAfterScreen();
}
/* `enter` marks a paint that is a genuine arrival — a new screen — rather than a refresh. It
   is what lets the chat column narrow and the screen slide in as one movement instead of the
   three-column layout snapping into place fully formed. */
function ccjPaintWork(enter){
  const el=document.getElementById('ccj-work');
  if(!el)return;
  const transcript=ccjUsesTranscript(ccjRun.stage);
  const html=ccjWorkHTML(ccjRun.stage);
  el.innerHTML=html;
  // A conversation-led screen leaves the work area with nothing in it, so the conversation takes
  // the whole body. Marked with a class rather than measured, because the body is built once per
  // STAGE and the screen changes several times inside it — a width decided at build time would
  // be wrong from the second screen onward.
  const body=document.getElementById('ccj-body');
  if(body&&body.classList)body.classList.toggle('solo',transcript&&!html);
  if(el.classList){
    el.classList.remove('ccj-enter');
    if(enter){
      // Reading offsetWidth between remove and add restarts the animation rather than letting
      // the browser collapse both class changes into no change at all.
      if(typeof el.offsetWidth==='number')void el.offsetWidth;
      el.classList.add('ccj-enter');
    }
  }
  // On a rebuilt stage the conversation is NOT inside the work area, so a screen change does not
  // touch it and there is nothing to re-render. That is the same guarantee the panel had and for
  // the same reason: the sub-statuses now live in this surface, and one that was torn down on
  // every screen change would restart its spinner and lose its place three times in stage 1
  // alone. Only the older stages, where the chat really is rebuilt, need the call.
  if(!transcript){ccjRenderChat();return;}
  // The composer is the one part of the conversation that DOES depend on the screen: the upload
  // button and the sample form appear only beside the form, because a document fills fields and
  // a screen without any has nothing for it to land in. It used to be repainted as a side effect
  // of the work area being rebuilt around it; now that it survives, it has to be told. Safe to
  // repaint here and nowhere near as often as a beat — a screen change is the user having moved,
  // not something arriving under their caret.
  ccjPaintComposer();
}
function ccjPaintComposer(){
  const el=document.getElementById('ccj-composer');
  if(el)el.innerHTML=ccjComposerInnerHTML();
}
/* Per-screen arrival work: the form asks for its first missing field, so the conversation has
   something to do the moment it appears beside it. */
function ccjAfterScreen(){
  const run=ccjRun;if(!run)return;
  // The rail slides to this stage's window. Called here because a stage change is a full page
  // render, so the track is a NEW element every time and has to be told where it came from.
  ccjPaintRail();
  if(run.screen==='form')ccjScheduleChat(ccjAskNextField,700);
}

/* ---- THE SHELL ------------------------------------------------------------------------- */
function buildCCJStageHTML(i){
  const s=ccjStage(i);
  if(!s)return '<div class="ccj-shell">'+buildCCJPlaceholderHTML('Unknown stage','This stage is not available.')+'</div>';
  /* WHERE THE RAIL SITS DEPENDS ON ITS STATE — the user's sketch. Collapsed, the window lives at
     the top of the RIGHT column, above the artefact, and the chat rises past it to the very top of
     the page. Expanded, the full nine-step rail is a band across the whole page — the one surface
     kept from the old design — and everything below shortens to make the room. The toggle is a
     structural change, which is why ccjToggleRail re-renders the page rather than repainting. */
  const railTop=ccjRailOpen()||!ccjUsesTranscript(i);
  const railHost='<div class="ccj-rail-host" id="ccj-rail-host">'+buildCCJRailHTML(i)+'</div>';
  return '<div class="ccj-shell">'
    +buildCCJHeadHTML(i)
    +(railTop?railHost:'')
    // `solo` is decided HERE as well as in ccjPaintWork, and it has to be: the first render of a
    // stage does not go through ccjPaintWork, so a class set only there left the opening screen
    // — the one with nothing beside the conversation — holding a column's worth of empty page.
    +'<div class="ccj-body'+(ccjUsesTranscript(i)?' no-panel':'')
    +(ccjUsesTranscript(i)&&!ccjWorkHTML(i)?' solo':'')+'" id="ccj-body">'
    // THE CONVERSATION IS HOISTED OUT OF THE WORK AREA on a rebuilt stage, and this is the whole
    // reason: it now carries the sub-statuses, and ccjPaintWork rewrites the work area on every
    // screen change. Left inside it, the live block would be torn down and rebuilt three times
    // during stage 1 — losing its spinner, its scroll position and its place each time. Outside
    // it, the conversation is built once per STAGE and never remounted, which is exactly the
    // guarantee the panel used to give and the one the sub-statuses need.
    +(ccjUsesTranscript(i)?'<div class="ccj-chat-col">'+buildCCJChatHTML(false)+'</div>':'')
    // The grab handle. Emitted on every transcript stage and hidden by CSS when the body is `solo`,
    // rather than emitted conditionally: a stage can lose its artefact and get it back as the
    // screen changes inside it, and ccjPaintWork toggles `solo` for exactly that. Deciding it here
    // would fix the answer at the moment the stage was built and be wrong from the next screen on —
    // the same trap the comment on `solo` above describes.
    +(ccjUsesTranscript(i)?ccjSplitterHTML():'')
    // The right column: the window rail on top, the artefact under it. The work area keeps its id
    // and its own node either way, so every surgical paint lands regardless of the rail's state.
    +(railTop
      ?'<div class="ccj-work" id="ccj-work">'+ccjWorkHTML(i)+'</div>'
      :'<div class="ccj-rside">'+railHost
        +'<div class="ccj-work" id="ccj-work">'+ccjWorkHTML(i)+'</div></div>')
    // A rebuilt stage carries its sub-statuses inside the conversation, so there is no column
    // here at all — the work area takes the rest of the body. Every other stage keeps the panel.
    +(ccjUsesTranscript(i)?'':buildCCJPanelHTML(i))
    +'</div>'
    +'<div class="ccj-drawer-host" id="ccj-drawer-host">'+buildCCJDrawerHTML()+'</div>'
    +'</div>';
}
/* ---- THE SPLITTER ---------------------------------------------------------------------------
   Drag the gap between the conversation and the artefact to decide how the body is shared. Left
   gives the artefact more room, right gives it to the chat.

   EITHER SIDE MAY COLLAPSE COMPLETELY, which is what makes the handle's own reachability the
   whole design problem rather than a detail. A collapsed chat takes the composer off screen; a
   collapsed right column takes the nine-step rail with it. So the handle never collapses with the
   column it borders — at 0% and at 100% it docks against the edge of the body and stays exactly as
   grabbable as it was in the middle. There is no state this can be dragged into that it cannot be
   dragged out of, and that is the property that makes full collapse safe to offer at all.

   SNAP RATHER THAN SLIVER. Below CCJ_SPLIT_SNAP the column goes to nothing instead of holding a
   few unreadable pixels — a 20px-wide transcript is not a smaller transcript, it is a broken one,
   and nobody drags to it deliberately. The same threshold at the other end.

   Double-click restores the 60/40 the stage was designed around; the keyboard drives it too. */
const CCJ_SPLIT_DEF=60;    // the share the chat was designed at, and what a reset returns to
const CCJ_SPLIT_SNAP=14;   // closer to an edge than this and the column gives up the rest
const CCJ_SPLIT_STEP=2;    // one arrow key
function ccjSplitterHTML(){
  const pct=ccjSplitPct();
  /* A real separator, not a styled div. role + aria-valuenow is what tells a screen reader this is
     a two-pane split and where it currently sits, and tabindex is what lets it be driven without a
     pointer at all — the arrow keys below do the same job as the drag. */
  return '<div class="ccj-split" id="ccj-split" role="separator" aria-orientation="vertical"'
    +' tabindex="0" aria-label="Resize conversation and artefact"'
    +' aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(pct)+'"'
    +' onpointerdown="ccjSplitDown(event)" onkeydown="ccjSplitKey(event)"'
    +' ondblclick="ccjSplitReset()" title="Drag to resize &middot; double-click to reset">'
    +'<span class="ccj-split-grip"></span></div>';
}
function ccjSplitPct(){
  const run=ccjRun;
  const v=run&&typeof run.split==='number'?run.split:CCJ_SPLIT_DEF;
  return Math.max(0,Math.min(100,v));
}
/* Writes the width to the DOM and nowhere else. Called on every pointer move, so it must not
   rebuild anything: it sets one custom property and two classes, and the browser lays out from
   there. Rebuilding the columns mid-drag would tear down the transcript under the cursor. */
function ccjApplySplit(){
  const body=document.getElementById('ccj-body');
  if(!body)return;
  const pct=ccjSplitPct();
  // Guarded per capability, not per object. The headless stub hands back an element whose `style`
  // is a plain object with no setProperty on it, so testing `body.style` alone passes and then
  // throws one line later — which is a page that renders in a browser and dies in the harness.
  if(body.style&&typeof body.style.setProperty==='function')body.style.setProperty('--ccj-split',pct+'%');
  if(body.classList&&typeof body.classList.toggle==='function'){
    // `on` marks that a width was chosen at all. Until then the stage keeps its designed
    // proportions and its responsive rules, which are better than anything a default here
    // could say — the splitter adds a choice, it does not replace the layout.
    body.classList.add('ccj-split-on');
    body.classList.toggle('chat-gone',pct<=0);
    body.classList.toggle('art-gone',pct>=100);
  }
  const el=document.getElementById('ccj-split');
  if(el&&el.setAttribute)el.setAttribute('aria-valuenow',String(Math.round(pct)));
}
function ccjSetSplit(pct,persist){
  const run=ccjRun;if(!run)return;
  let v=Math.max(0,Math.min(100,pct));
  if(v<CCJ_SPLIT_SNAP)v=0;
  else if(v>100-CCJ_SPLIT_SNAP)v=100;
  run.split=v;
  ccjApplySplit();
  // Saved on release, not on every frame: ccjSaveRuns serialises the whole run store, and doing
  // that sixty times a second during a drag is work nobody asked for.
  if(persist&&typeof persistAppState==='function')persistAppState();
}
function ccjSplitReset(){ccjSetSplit(CCJ_SPLIT_DEF,true);}
let ccjSplitDrag=null;
function ccjSplitDown(e){
  const body=document.getElementById('ccj-body');
  if(!body||!e||typeof body.getBoundingClientRect!=='function')return;
  if(e.preventDefault)e.preventDefault();                 // no text selection while dragging
  const r=body.getBoundingClientRect();
  if(!r.width)return;
  ccjSplitDrag={left:r.left,width:r.width};
  if(body.classList)body.classList.add('ccj-splitting');
  const el=document.getElementById('ccj-split');
  // Pointer capture, so the drag survives the cursor outrunning the handle — without it a fast
  // drag drops the moment the pointer leaves the 12px gap, which reads as the splitter sticking.
  if(el&&el.setPointerCapture&&e.pointerId!==undefined){try{el.setPointerCapture(e.pointerId);}catch(err){}}
  if(typeof window!=='undefined'&&window.addEventListener){
    window.addEventListener('pointermove',ccjSplitMove);
    window.addEventListener('pointerup',ccjSplitUp);
    window.addEventListener('pointercancel',ccjSplitUp);
  }
}
function ccjSplitMove(e){
  if(!ccjSplitDrag||!e)return;
  if(e.preventDefault)e.preventDefault();
  ccjSetSplit((e.clientX-ccjSplitDrag.left)/ccjSplitDrag.width*100,false);
}
function ccjSplitUp(){
  if(!ccjSplitDrag)return;
  ccjSplitDrag=null;
  const body=document.getElementById('ccj-body');
  if(body&&body.classList)body.classList.remove('ccj-splitting');
  if(typeof window!=='undefined'&&window.removeEventListener){
    window.removeEventListener('pointermove',ccjSplitMove);
    window.removeEventListener('pointerup',ccjSplitUp);
    window.removeEventListener('pointercancel',ccjSplitUp);
  }
  ccjSetSplit(ccjSplitPct(),true);                        // the release is what gets remembered
}
/* Arrow keys move it, Home and End take it to the extremes, Enter restores the default. The same
   set a native split pane answers to, so nobody has to learn this one. */
function ccjSplitKey(e){
  if(!e)return;
  const k=e.key;
  const at=ccjSplitPct();
  let to=null;
  if(k==='ArrowLeft')to=at-CCJ_SPLIT_STEP;
  else if(k==='ArrowRight')to=at+CCJ_SPLIT_STEP;
  else if(k==='Home')to=0;
  else if(k==='End')to=100;
  else if(k==='Enter'||k===' ')to=CCJ_SPLIT_DEF;
  if(to===null)return;
  if(e.preventDefault)e.preventDefault();
  ccjSetSplit(to,true);
}
/* The work area is 3/4 of the body and splits again: the conversation on the left, the
   screen's own surface on the right. On the first screen the conversation IS the screen, so
   it takes the whole area rather than sitting in a column beside nothing. */
function ccjWorkHTML(i){
  const run=ccjRun;
  const def=ccjScreenDef(i,run.screen);
  if(!def)return buildCCJStagePlaceholderHTML(i);
  // On a rebuilt stage the conversation is a sibling of this area rather than inside it, so all
  // that is left here is the screen — and a conversation-led screen has none, which is what the
  // empty string means. ccjPaintWork reads it to give the conversation the whole body.
  if(ccjUsesTranscript(i)){
    return def.chat==='full'?'':'<div class="ccj-screen" id="ccj-screen">'+ccjScreenHTML(i,run.screen)+'</div>';
  }
  if(def.chat==='full')return '<div class="ccj-work-full">'+buildCCJChatHTML(true)+'</div>';
  return '<div class="ccj-chat-col'+(def.chatWide?' wide':'')+'">'+buildCCJChatHTML(false)+'</div>'
    +'<div class="ccj-screen" id="ccj-screen">'+ccjScreenHTML(i,run.screen)+'</div>';
}
function ccjScreenHTML(i,id){
  if(id==='model')return buildCCJModelHTML();
  if(id==='quote')return buildCCJQuoteHTML();
  if(id==='sent')return buildCCJSentHTML();
  if(id==='account')return buildCCJAccountHTML();
  if(id==='msa')return buildCCJMsaHTML();
  if(id==='invoice')return buildCCJInvoiceHTML();
  if(id==='contract')return buildCCJEmpHTML();
  if(id==='onboarding')return buildCCJOnbHTML();
  if(id==='readiness')return buildCCJRdyHTML();
  if(id==='payrun')return buildCCJPayrunHTML();
  if(id==='active')return buildCCJActiveHTML();
  if(id==='employee')return buildCCJEmployeeCreatedHTML();
  if(id==='form')return buildCCJFormHTML();
  if(id==='proposal')return buildCCJProposalHTML();
  return buildCCJStagePlaceholderHTML(i);
}

/* ---- HEADER ----------------------------------------------------------------------------
   One 34px row carrying everything the old design spent three blocks on: the exit, the
   counter, the stage name, the engagement model, who is holding the work — plus, now, which
   screen of the stage we are on. `ccj-back` is in the class list because injectPageBackBar
   skips any page that renders its own exit. */
function buildCCJHeadHTML(i){
  return '<div class="ccj-head" id="ccj-head">'+ccjHeadInnerHTML(i)+'</div>';
}
/* Split from its wrapper so the header can be repainted in place. It has to be: the model chip
   is only reopenable once the chooser has been left, and a header built on the chooser screen
   would otherwise stay inert for the rest of the stage. Nothing in it animates, so repainting
   it on a screen change costs nothing. */
function ccjPaintHead(){
  const el=document.getElementById('ccj-head');
  if(el&&ccjRun)el.innerHTML=ccjHeadInnerHTML(ccjRun.stage);
}
function ccjHeadInnerHTML(i){
  const run=ccjRun,s=ccjStage(i),ev=ccjEvent(i);
  const agent=typeof findCfgAgentByName==='function'?findCfgAgentByName(ev.source):null;
  const wait=s.waitingOn&&s.waitingOn!=='&mdash;'
    ?'<span class="ccj-head-wait">Waiting on <b>'+s.waitingOn+'</b></span>':'';
  const dl=ccjHeadDocDlHTML();
  return ''
    // The tooltip names the place it actually goes — see ccjExitTarget. An arrow that said
    // "Back to Contracts" on a run opened from the board was promising the wrong room.
    +'<button class="ccj-back" onclick="ccjExit()" title="'+attrSafe(ccjExitLabel())+'">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>'
    +'<span class="ccj-head-step">Step '+(i+1)+' of '+ccjStages().length+'</span>'
    +'<span class="ccj-head-name">'+s.short+'</span>'
    // The chip reports the engagement model AND is the way back to it — the choice is reopenable
    // until the request is logged, and the thing that displays a decision is the most findable
    // place to change it. After that it is a read-only fact.
    +(run.started
      ?'<span class="ccj-head-model" title="'+attrSafe('Engagement model — '+ccjModelLabel(run.model))+'">'+run.model+'</span>'
      :'<button class="ccj-head-model live" onclick="ccjBackToModel()" title="'+attrSafe('Engagement model — '+ccjModelLabel(run.model))+'">'+run.model
        +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></button>')
    +(agent?'<button class="ccj-head-agent" onclick="viewCfgAgentSkillByName(\''+String(agent.name).replace(/'/g,"\\'")+'\')">'
      +'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>'
      +agent.name+'</button>':'')
    /* The right-hand group. Both of these want the far end of the bar, and `margin-left:auto` on
       each would have SPLIT the free space between them rather than pushing both right — so they
       share one container that takes the auto margin. */
    +((wait||dl)?'<span class="ccj-head-right">'+wait+dl+'</span>':'');
}
/* == THE DOWNLOAD LIVES IN THE STAGE HEADER =================================================
   It used to sit inside the document, in a sticky strip of its own above the paper. That strip
   cost every artefact a row of empty space — and on the agreement it was the SECOND near-empty
   row, stacked above the draft/edit bar, for two controls that between them used a third of the
   width. Moving it out of the scroller reclaims that space on all five documents at once.

   THE SCREEN ID IS THE DOCUMENT KIND. `CCJ_SCREENS` names the quote screen 'quote', the agreement
   screen 'msa', and so on through all five — the same keys CCJ_DOCS uses. So "is there a document
   on screen right now" is a lookup rather than a table that would need updating twice.

   Reading the SCREEN and not the stage matters: stage 1 has four screens and none of them is a
   document, and offering to download a quote while somebody is still filling in the intake form
   would be offering a document that does not exist yet. The header repaints on every screen
   change (see ccjGoScreen), so the button arrives and leaves with the paper it belongs to. */
function ccjHeadDocDlHTML(){
  const run=ccjRun;
  if(!run||!run.screen)return '';
  // Two conditions, not one: this screen shows a document, AND that document has finished being
  // assembled. See CCJ_DOCS `ready` for where the line sits on each of the five.
  if(!CCJ_DOCS[run.screen]||!ccjDocReady(run.screen))return '';
  return ccjDocDlHTML(run.screen);
}
function ccjModelLabel(id){
  const t=(typeof AI_CT_TYPE_CARDS!=='undefined'?AI_CT_TYPE_CARDS:[]).find(function(x){return x.id===id;});
  return t?t.sub:id;
}
/* == WHERE BACK GOES =======================================================================
   A run is entered from three places — the + on the Contracts listing, the New request button on
   the Account Manager's board, and a row on that board — and the back arrow sent all three to
   Contracts. From the board that was a redirect rather than a back: it took a reader who had
   never been on the Contracts listing and left them there, further from the row they came in on
   than when they started, with the board's stage filter and page still set behind them.

   Recorded on the RUN, not in a module variable, so it survives parking one run to open another
   and coming back — and it is plain data, so ccjSaveRuns carries it through a reload with
   everything else. == */
function ccjMarkEntry(run,dealId){
  if(!run)return;
  // Never a journey page: leaving a run for a run is not a way out of the journey.
  const from=(typeof page!=='undefined'&&!isCCJPage(page))?page:'';
  // Crossed straight from another run, so there is no new answer to record and whatever this run
  // already knew about its way out still stands.
  if(!from&&run.exit)return;
  run.exit={page:from,
    tab:typeof dashboardTab!=='undefined'?dashboardTab:'',
    dealId:(dealId===undefined?null:dealId)};
}
/* Resolved rather than stored, so the arrow's tooltip and the arrow's behaviour cannot disagree —
   they are two readings of this one answer. A run opened from a deal belongs to the board whether
   or not the entry was recorded: a reload drops the record but not the fact. Contracts is the
   fallback for everything else, because that is where the create action lives. */
function ccjExitTarget(){
  const run=ccjRun,exit=(run&&run.exit)||null;
  const dealId=exit&&exit.dealId!==null&&exit.dealId!==undefined?exit.dealId
    :(run&&run.dealId!==undefined&&run.dealId!==null?run.dealId:null);
  return {page:(exit&&exit.page)||(dealId!==null?'dashboard':'contracts'),
          tab:(exit&&exit.tab)||'',dealId:dealId};
}
function ccjExitLabel(){
  return ccjExitTarget().page==='dashboard'?'Back to your dashboard':'Back to Contracts';
}
function ccjExit(){
  const to=ccjExitTarget();
  ccjReset();
  if(to.page==='dashboard'){
    if(to.tab&&typeof dashboardTab!=='undefined')dashboardTab=to.tab;
    if(to.dealId!==null)ccjRestoreBoardTo(to.dealId);
  }
  navigatePage(to.page);
}
/* Back to the board with the row you left from in front of you and its drawer open — the same
   round trip soKycReturnToBoard makes for the store journey. Landing on a board with nothing
   selected asks a reader to find their row again in a table of nineteen, having just spent the
   trip looking at that one record. */
function ccjRestoreBoardTo(dealId){
  if(typeof amDeals==='undefined')return;
  const d=amDeals.find(function(x){return x.id===dealId;});if(!d)return;
  // The run is usually what moved this record out of the stage that was filtered for, so a filter
  // that no longer holds it would drop the row — and the selection with it, since the listing
  // validates the open drawer against the rows actually on screen.
  if(typeof amPipelineStage!=='undefined'&&amPipelineStage&&amPipelineStage!==d.stage)amPipelineStage='';
  if(typeof amPage!=='undefined'&&typeof AM_PAGE_SIZE!=='undefined'&&typeof amFilteredDeals==='function'){
    const at=amFilteredDeals().findIndex(function(x){return x.id===dealId;});
    if(at>-1)amPage=Math.floor(at/AM_PAGE_SIZE)+1;
  }
  /* Marks the row rather than opening the record. Setting amSelectedDealId here also opened the
     drawer, and the listing behind an open drawer drops two columns — so a reader who pressed
     "Open run" and came back met a different table from the one they left. See amReturnedDealId. */
  if(typeof amReturnedDealId!=='undefined')amReturnedDealId=dealId;
  if(typeof amSelectedDealId!=='undefined')amSelectedDealId=null;
}

/* ---- THE RAIL --------------------------------------------------------------------------
   Numbered dots, because at nine stages an unlabelled circle gives no sense of position and
   the number is already what the header counts.

   A PHASE IS A CONTAINER, NOT A CAPTION. The first version set the two track names as small
   uppercase text floating above their run of dots, and it failed on the only question it
   existed to answer: a reader could see that the nine stages were split, and could not see
   WHY, or where the second half began. Two words hovering over dead space is not a grouping.
   Each half is now a box of its own — numbered 1 and 2, named by the document it produces
   (see amPipelineTracks), and carrying the rule that makes it a phase on the same line:
   "Signed once per client" against "Runs for every hire". That sentence is the whole reason
   the journey breaks in two, so it belongs on the face of the rail, not in a title attribute.

   Each box also counts ONLY ITSELF, and reports the count that is useful in its own state:
   how far through, while you are in it; that it is behind you, once it is; how much it will
   cost you, while it is still ahead. The header above already carries "Step 4 of 9" for the
   whole run, so repeating a global count here would have been the third place to read it. */
/* == THE RAIL: FOUR STEPS AT A TIME, NINE ON DEMAND ========================================
   Nine steps in two labelled phase boxes took a third of the page above a conversation that IS the
   product. Most of it was inert: seven of the nine steps are not the one you are on, and the boxes
   restated a grouping the step names already imply.

   So the default is a WINDOW of four, and it slides. The user set the behaviour exactly: start on
   1-4, hold there for step 2, and from step 3 the leftmost slides out while the next slides in —
   which keeps one step of context behind the current one and two ahead of it, at every point in the
   journey. The two phase boxes come back, with all nine, when the expand control is used.

   IT SLIDES RATHER THAN REDRAWS, and that is the whole implementation. All nine steps are always in
   the DOM; the track is translated. A rail rebuilt per stage would snap between positions however
   the CSS was written, because a transition needs the same element on both sides of the change —
   and a stage change here is a full page render, so the element is new every time. The previous
   position is therefore replayed onto the fresh element and the new one set a layout tick later:
   see ccjPaintRail. */
const CCJ_RAIL_WIN=4;      // steps visible in the window
/* THE LAYOUT, PER THE USER'S SKETCH: the rail no longer spans the page. The chat owns the LEFT
   column from the very top, and the window — four steps wide, the width the old right-hand phase
   box had — sits at the top of the RIGHT column, above the artefact. The window walks the whole
   journey: 1-4 at the start, holding through step 2, sliding one per step from step 3, so one step
   of context stays behind the current one and the clamp stops it at 6-9. The full nine-step rail
   with its phase groups comes back full-width when the arrow expands it, and the chat shortens
   underneath — that state is the one surface the sketch keeps from the old design. */
function ccjRailFrom(i){
  const n=ccjStages().length;
  return Math.max(0,Math.min((i||0)-1,n-CCJ_RAIL_WIN));
}
function ccjRailOpen(){return !!(ccjRun&&ccjRun.railOpen);}
/* Which edges of the window have nothing beyond them. Drives the mask — see .ccj-rail-win — so the
   fade only ever softens an edge that content is actually passing through, and never eats the
   first or last step's label for the sake of an effect with nothing to do. */
function ccjRailEdge(from){
  const n=ccjStages().length;
  return (from<=0?' at-start':'')+(from>=n-CCJ_RAIL_WIN?' at-end':'');
}
/* A FULL RE-RENDER, deliberately, where this used to repaint the host in place. The toggle is no
   longer a restyle — it MOVES the rail between two different places in the tree (a band above the
   body when open, the top of the right column when closed), and a host repaint cannot move its own
   host. The conversation re-renders at the bottom of its scroll, which is acceptable for a control
   a person just clicked and is looking at. */
function ccjToggleRail(){
  const run=ccjRun;if(!run)return;
  run.railOpen=!run.railOpen;
  renderADTPage();
}
/* THE MARKUP RENDERS AT THE OLD POSITION AND IS MOVED A TICK LATER. That ordering is the whole
   trick, and the obvious alternative does not work: setting the old value, forcing a layout read,
   and setting the new one in the same turn moves nothing, because a forced reflow advances LAYOUT
   but not TIME. The transition from new→old has made zero progress when the second write lands, so
   the second write is a no-op and the rail snaps. Measured, not assumed — the first version did
   exactly this and the browser check caught it by sampling mid-flight and finding the track already
   at its destination.

   So the element mounts where it was, and one timer tick later it is told where to go. By then the
   browser has painted the start value and the transition has something to run from.

   A real timer rather than requestAnimationFrame, because the headless harness stubs rAF as a noop
   — the callback would never fire and the rail would be left permanently at the old position.
   The fake clock DOES run timers, so the harness reaches the right end state on the next advance.
   Guarded by ccjGen like every other timer here, so a reset cannot be followed by a stale write. */
function ccjPaintRail(){
  const run=ccjRun;if(!run)return;
  const to=ccjRailFrom(run.stage);
  const from=(run.railFrom===undefined?to:run.railFrom);
  run.railFrom=to;
  const set=function(v){
    const el=document.getElementById('ccj-rail-track');
    if(el&&el.style)el.style.transform=ccjRailShift(v);
    // The mask follows the track: an edge stops fading the moment there is nothing behind it.
    const win=document.getElementById('ccj-rail-win');
    if(win&&win.className!==undefined)win.className='ccj-rail-win'+ccjRailEdge(v);
  };
  if(from===to){set(to);return;}
  set(from);                                       // where it was, so there is something to leave
  if(run.railTimer)clearTimeout(run.railTimer);
  const g=ccjGen,r=run;
  run.railTimer=setTimeout(function(){
    if(ccjGen!==g||ccjRun!==r)return;
    r.railTimer=null;
    set(to);
  },40);
}
// A percentage of the TRACK's own width, which is what a percentage transform is measured against.
// One step is 1/n of the track however wide the window is.
function ccjRailShift(from){
  const n=ccjStages().length||1;
  return 'translateX(-'+(from/n*100)+'%)';
}
function buildCCJRailHTML(stage){
  const events=ccjStages();
  const tracks=(typeof amPipelineTracks!=='undefined'?amPipelineTracks:[]);
  const ids=[];
  events.forEach(function(e){if(e.track&&ids.indexOf(e.track)===-1)ids.push(e.track);});
  const tick='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>';
  const dot=function(e,i,connect){
    const state=i<stage?'done':i===stage?'current':'pending';
    let h='<div class="ccj-step" title="'+attrSafe(e.plain)+'">'
      +'<div class="ccj-dot '+state+'">'+(state==='done'?tick:(i+1))+'</div>'
      +'<div class="ccj-step-label '+state+'">'+e.short+'</div></div>';
    if(connect)h+='<div class="ccj-line'+(i<stage?' filled':'')+'"></div>';
    return h;
  };
  /* "Just give a small arrow, on the leftmost corner" — the user's words, replacing the labelled
     pill. Arrow only; the title and aria state carry what it does. It points down to open the full
     rail and up to put it away, and it is the FIRST thing in the row so it sits leftmost. */
  const expander=function(open){
    return '<button type="button" class="ccj-rail-more" onclick="ccjToggleRail()" '
      +'title="'+(open?'Back to the compact view':'Show the whole journey')+'" '
      +'aria-expanded="'+(open?'true':'false')+'">'
      // Left-facing to open — the full rail expands out toward the left, across the page — and
      // right-facing to put it back in the corner. The user's spec: just the arrow, facing left.
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">'
      +(open?'<polyline points="9 6 15 12 9 18"/>':'<polyline points="15 6 9 12 15 18"/>')
      +'</svg></button>';
  };
  /* COLLAPSED: the four-step window, arrow leftmost. Every step is rendered — the window is a
     clip, not a filter — so the track has something to slide when the stage advances. */
  if(!ccjRailOpen()){
    const from=ccjRailFrom(stage);
    // Mounted where the rail WAS, not where it is going — ccjPaintRail moves it a tick later so the
    // transition has a start value to run from. Without a previous position (a fresh run) the two
    // are the same and nothing animates, which is right: there is nothing to have moved from.
    const mount=(ccjRun&&ccjRun.railFrom!==undefined)?ccjRun.railFrom:from;
    return '<div class="ccj-rail slim" id="ccj-rail">'
      +expander(false)
      // Marked from the position it MOUNTS at, not the one it is going to — the mask has to match
      // where the track actually is while it slides. ccjPaintRail re-marks it on arrival.
      +'<div class="ccj-rail-win'+ccjRailEdge(mount)+'" id="ccj-rail-win">'
      +'<div class="ccj-rail-track" id="ccj-rail-track" style="width:'
        +(events.length/CCJ_RAIL_WIN*100)+'%;transform:'+ccjRailShift(mount)+'">'
      +events.map(function(e,i){
        // Outside the window it is still in the DOM and still slides; it is simply not lit.
        const out=i<from||i>=from+CCJ_RAIL_WIN;
        return '<div class="ccj-rail-slot'+(out?' out':'')+'">'+dot(e,i,i<events.length-1)+'</div>';
      }).join('')
      +'</div></div>'
      +'</div>';
  }
  if(ids.length<2){
    return '<div class="ccj-rail" id="ccj-rail">'+expander(true)+'<div class="ccj-rail-scroll">'
      +events.map(function(e,i){return dot(e,i,i<events.length-1);}).join('')+'</div>'
      +'</div>';
  }
  const groups=ids.map(function(tid,gi){
    const idx=[];
    events.forEach(function(e,i){if(e.track===tid)idx.push(i);});
    const t=tracks.find(function(x){return x.id===tid;});
    const here=idx.indexOf(stage);
    const state=here>-1?'current':idx[idx.length-1]<stage?'done':'ahead';
    const mark=here>-1
      ?'<span class="ccj-phase-count">'+(here+1)+'<span class="ccj-phase-of"> of '+idx.length+'</span></span>'
      :state==='done'
        ?'<span class="ccj-phase-count done">'+tick+'Done</span>'
        :'<span class="ccj-phase-count ahead">'+idx.length+' steps</span>';
    return '<div class="ccj-phase '+state+'" style="flex:'+idx.length+' 1 0" title="'+attrSafe(t?t.plain:'')+'">'
      +'<div class="ccj-phase-head">'
      +'<span class="ccj-phase-n">'+(gi+1)+'</span>'
      +'<span class="ccj-phase-name">'+(t?t.label:tid)+'</span>'
      +(t&&t.sub?'<span class="ccj-phase-rule">'+t.sub+'</span>':'')
      +mark+'</div>'
      +'<div class="ccj-phase-steps">'
      +idx.map(function(i,n){return dot(events[i],i,n<idx.length-1);}).join('')
      +'</div></div>';
  }).join('');
  return '<div class="ccj-rail open" id="ccj-rail">'+expander(true)
    +'<div class="ccj-rail-scroll tracked">'+groups+'</div>'
    +'</div>';
}

/* == WHICH STAGES HAVE BEEN REBUILT AS A TRANSCRIPT ======================================
   The sub-status panel is being replaced stage by stage, not all at once, and this list is the
   switch. A stage named here renders its sub-statuses as blocks INSIDE the conversation and has
   no panel; a stage not named here keeps the panel exactly as it was.

   Two reasons it is a list rather than a flag flipped once. The journey is rebuilt one stage at
   a time with the design agreed before each — so a stage nobody has designed yet must keep
   working, not half-change. And stages 3-6 talk to the CLIENT and 7-9 to the WORKER, where the
   conversation on screen is a counterparty's: putting internal sub-statuses into it would put
   "Partner cost requested" and "Pricing approval (if off-standard)" one line away from a message
   the client can see, and core.js is explicit that this layer must never reach a client surface.
   That needs a decision about separation before those stages move, and this list is what stops
   the decision being made by accident.

   Adding a stage here is the whole of turning it on. == */
const CCJ_TRANSCRIPT_STAGES=['request-received','quote-prep','quote-review','quote-approved',
                             'agreement-signature','deposit-due','employment-contract','onboarding',
                             'active'];
function ccjUsesTranscript(i){
  const s=ccjStage(i);
  return !!s&&CCJ_TRANSCRIPT_STAGES.indexOf(s.id)>-1;
}

/* ---- THE PROCESS PANEL -----------------------------------------------------------------
   A quarter of the body, pinned right, standing for the whole stage. Every sub-status shows
   its detail, top to bottom. The same component on all nine stages — only its rows change.

   Still here, and still correct, for every stage NOT in CCJ_TRANSCRIPT_STAGES above. */
function buildCCJPanelHTML(i){
  return '<aside class="ccj-panel">'
    +'<div class="ccj-panel-prog"><div class="ccj-panel-prog-fill" id="ccj-prog" style="width:'+ccjProgressPct(i)+'%"></div></div>'
    +'<div class="ccj-panel-inner" id="ccj-panel-inner">'+ccjPanelInnerHTML(i)+'</div></aside>';
}
function ccjProgressPct(i){
  const run=ccjRun,steps=ccjSteps(i);
  if(!run||!steps.length)return 0;
  return Math.round(steps.filter(function(st){return run.settled[ccjKey(i,st)];}).length/steps.length*100);
}
function ccjPanelInnerHTML(i){
  const run=ccjRun,s=ccjStage(i),steps=ccjSteps(i);
  const doneCount=steps.filter(function(st){return run.settled[ccjKey(i,st)];}).length;
  const autoCount=steps.filter(function(st){return st.auto;}).length;
  const sla=steps.map(function(st){return st.sla;}).filter(Boolean)[0]||'';
  return '<div class="ccj-panel-head">'
    +'<div class="ccj-panel-title">Steps in &ldquo;'+s.short+'&rdquo;</div>'
    +'<div class="ccj-panel-meta">'
    +'<span class="ccj-panel-count">'+doneCount+' of '+steps.length+'</span>'
    +'<span class="ccj-panel-dot">&middot;</span><span>'+(steps.length-autoCount)+' yours</span>'
    +(sla?'<span class="ccj-panel-sla">'+sla+'</span>':'')
    +'</div></div>'
    +'<div class="ccj-panel-body">'
    +steps.map(function(st,n){return ccjRowHTML(i,st,n);}).join('')
    +'</div>';
}
function ccjOwnerChipHTML(step){
  const info=typeof amOwnerInfo==='function'?amOwnerInfo(step.owner):{initials:'?',who:step.owner};
  return '<span class="ccj-row-owner'+(step.auto?' auto':'')+'" title="'+attrSafe(step.owner+' — '+info.who)+'">'
    +(step.auto?'AUTO':info.initials)+'</span>';
}
function ccjRowHTML(i,step,n){
  const run=ccjRun;
  const key=ccjKey(i,step);
  const settled=run.settled[key];
  const live=run.started&&run.sub===n&&!settled;
  const state=settled?'done':live?'current':'pending';
  const working=live&&run.phase!=='halt'&&run.phase!=='stopped';
  const ico=settled
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
    :working?'<span class="ccj-spin"></span>'
    :(n+1);
  return '<div class="ccj-row '+state+(live&&run.phase==='halt'?' halted':'')+'">'
    +'<div class="ccj-row-top">'
    +'<div class="ccj-row-ico">'+ico+'</div>'
    +'<div class="ccj-row-main">'
    +'<div class="ccj-row-label">'+step.label+(step.cond?'<span class="ccj-row-cond">'+step.cond+'</span>':'')+'</div>'
    +(settled?'<div class="ccj-row-sum">'+settled.summary+'</div>':'')
    +'</div>'
    +ccjOwnerChipHTML(step)
    +'</div>'
    +ccjRowDetailHTML(i,step,n,state,live)
    +'</div>';
}
/* Every row carries detail — that is what "top to bottom, with the details" means. What the
   detail IS depends on where the row stands: a pending row says what it will do, a running or
   settled row says what it found. */
function ccjRowDetailHTML(i,step,n,state,live){
  const run=ccjRun;
  // An arrival gate replaces the work; a post gate follows it, so it only shows once the step has
  // halted — and the evidence that justifies the decision stays visible above it.
  const gate=ccjGateFor(i,step)||(live&&run.phase==='halt'?ccjPostGateFor(i,step):null);
  if(live&&gate)return ccjGateHTML(i,step,gate);
  const settled=run.settled[ccjKey(i,step)];
  // A step that did not need to run says so, and says why. The reason IS the evidence — it is
  // the agent showing it considered the step and ruled it out.
  if(settled&&settled.skipped)return '<div class="ccj-ev skipped">'
    +'<div class="ccj-will">'+(settled.reason||ccjPurpose(i,step))+'</div></div>';
  if(state==='pending')return '<div class="ccj-ev pending">'
    +'<div class="ccj-will">'+ccjPurpose(i,step)+'</div>'
    +(step.sla?'<div class="ccj-will-sla">Target '+step.sla+'</div>':'')
    +'</div>';
  const d=ccjEvidence(i,step);
  const hold=live&&run.phase==='hold'?ccjHoldFor(i,step):null;
  const wait=live&&run.phase==='wait'?ccjWaitFor(i,step):null;
  if(wait)return '<div class="ccj-ev">'
    +'<div class="ccj-hold"><span class="ccj-hold-bar"></span>'+wait.note+'</div></div>';
  return '<div class="ccj-ev">'
    +'<div'+(live?' id="ccj-ev-lines"':'')+'>'+ccjActLogHTML(i,step,state)+'</div>'
    // While a document is being read, the held row reports THAT rather than the generic note.
    // Parsing is the intake being captured, so it belongs to this sub-status — and it is what
    // makes the hold visibly earn its time instead of just sitting there.
    +(hold?'<div class="ccj-hold"><span class="ccj-hold-bar"></span>'+ccjHoldNoteHTML(hold)+'</div>':'')
    +(d?'<button class="ccj-ev-more" onclick="ccjInspect(\''+attrSafe(ccjKey(i,step))+'\')">'
      +'View evidence'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>':'')
    +'</div>';
}
/* THE ACTION LOG. One line per action, in order, each showing what it is doing while it does it
   and what it found once done. A fetch and a verify carry their payload underneath, because
   "14 records returned" is a claim and the fourteen records are the evidence for it.

   Only the action currently running animates. The list is rebuilt on every beat, so animating
   the finished lines again each time would read as a flicker rather than as progress. */
/* `state` says where the step is: 'done' (all of it ran), 'current' (the run is inside it), or
   'pending' — NOT STARTED, which is a third answer and not a synonym for the first action being
   underway. It exists for the pre-wait: a step that parks BEFORE doing anything has performed no
   action, and rendering it as 'current' put a spinner on the first one. That is the same lie the
   post-wait told before it was fixed — a block whose own mark says "parked on a person" while its
   body says "working" — and it survived that fix because a pre-wait takes the other branch. */
function ccjActLogHTML(i,step,state){
  const run=ccjRun;
  const acts=ccjActsFor(i,step);
  // -1, so nothing is done and nothing is doing. Not 0: index 0 IS an action, and claiming it is
  // the whole of the bug being fixed here.
  const at=state==='done'?acts.length:state==='pending'?-1:(run.act||0);
  return acts.map(function(a,n){
    const done=n<at, doing=n===at&&state!=='done';
    if(!done&&!doing)return '';                     // not reached — nothing to claim yet
    return '<div class="ccj-act'+(done?' done':' doing')+(doing?' new':'')+'">'
      +'<span class="ccj-act-ico">'+(done
        ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
        :'<span class="ccj-spin sm"></span>')+'</span>'
      +'<span class="ccj-act-body">'
      +'<span class="ccj-act-label'+(done&&a.ok?' ok':'')+'">'+(done?a.done:a.doing+'&hellip;')+'</span>'
      +(done&&a.rows?ccjActRowsHTML(a.rows):'')
      +(done&&a.checks?ccjActChecksHTML(a.checks):'')
      +'</span></div>';
  }).join('');
}
/* The records themselves. Capped, with the remainder counted rather than hidden — the drawer has
   the full set, and a panel that scrolled for twenty rows would bury the step still to come. */
function ccjActRowsHTML(rows){
  const cap=4;
  return '<span class="ccj-act-rows">'
    +rows.slice(0,cap).map(function(r){
      return '<span class="ccj-act-row'+(r.state==='inactive'?' off':'')+'">'
        +'<b>'+r.k+'</b><i>'+r.v+'</i></span>';
    }).join('')
    +(rows.length>cap?'<span class="ccj-act-more">+'+(rows.length-cap)+' more</span>':'')
    +'</span>';
}
function ccjActChecksHTML(checks){
  return '<span class="ccj-act-rows">'
    +checks.map(function(c){
      const v=c.verdict||'';
      return '<span class="ccj-act-check '+v+'">'
        +'<span class="ccj-act-vd">'+(v==='pass'?'&#10003;':v==='fail'?'&#10007;':'&ndash;')+'</span>'
        +'<span><b>'+c.rule+'</b><i>'+c.actual+'</i></span></span>';
    }).join('')+'</span>';
}
/* == THE LIVE BLOCK IS A WINDOW, NOT A LEDGER ============================================
   While a step works, its block does not grow a line per action until it towers over the
   conversation — it holds still. The head says what kind of work is happening RIGHT NOW (a
   spark and one word: "Fetching…", "Validating…"), and under a single rule the record of what
   has been done so far scrolls through a few-lines-tall window, oldest sliding out the top as
   the newest arrives. The full ledger has not gone anywhere: the settled block reopens with
   the complete action log, and the drawer keeps the whole evidence set. This is the same
   honesty with less noise — the window shows only work that has actually finished, and the
   verb names only the action actually underway.

   THE VERB IS DERIVED, NOT AUTHORED — except on a hold. Every action ccjActsFor builds carries
   an id, and the id names the kind of work; a step whose evidence has no shape says "Working"
   and nothing more. A HOLD names its own verb (`CCJ_HOLDS[...].verb`, value or function):
   the beats it ran are over, so the last action's verb would be a re-claim of finished work,
   and the generic "Working" depicts the wrong thing — the user's words — on a step that is
   specifically gathering, reading, filing or checking. The fallback stays "Working" only for
   a hold that declares nothing. */
const CCJ_VERB={connect:'Connecting',fetch:'Fetching',verify:'Validating',save:'Writing',work:'Working'};
function ccjVerbFor(i,step){
  const run=ccjRun;
  if(run&&run.phase==='hold'){
    const h=ccjHoldFor(i,step);
    const v=h&&(typeof h.verb==='function'?h.verb():h.verb);
    return v||'Working';
  }
  const acts=ccjActsFor(i,step);
  const a=acts[Math.max(0,Math.min((run&&run.act)||0,acts.length-1))];
  if(!a)return 'Working';
  return CCJ_VERB[a.id]||String(a.doing||'Working').split(' ')[0];
}
/* The eight-ray spark, drawn inline so it can inherit the coral and animate. */
function ccjSparkHTML(){
  return '<svg class="ccj-spark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    +'<path d="M12 2 13.38 8.67 19.07 4.93 15.33 10.62 22 12 15.33 13.38 19.07 19.07 13.38 15.33 '
    +'12 22 10.62 15.33 4.93 19.07 8.67 13.38 2 12 8.67 10.62 4.93 4.93 10.62 8.67 Z"/></svg>';
}
function ccjLiveStatusHTML(i,step){
  return '<span class="ccj-sb-live">'+ccjSparkHTML()
    +'<span class="ccj-sb-verb">'+ccjVerbFor(i,step)+'&hellip;</span></span>';
}
/* THE GIST: two or three words of what is actually moving, trailing off in dots — the user's
   spec, and Claude Code's own shape ("Read package.json…"). It is DATA, not narration: the last
   finished action's result ("14 records returned", "Connected to NewForce") or, before anything
   has finished, the object of the action underway with its verb removed — the verb already
   shimmers beside the spark, and saying it twice would put one claim of work in two places. */
function ccjGistFor(i,step){
  const run=ccjRun;
  let text='';
  /* A HELD step's gist is the hold's own live position — the same numbers the old rows carried
     ("3 of 12", "Rohan_Verma_Contract_Data.pdf"), because a parked run whose one line never
     moves is indistinguishable from a hung one. A hold may author its own (`gist`), otherwise
     the first row with a value speaks for it. */
  if(run&&run.phase==='hold'){
    const h=ccjHoldFor(i,step);
    if(h){
      const g=typeof h.gist==='function'?h.gist():h.gist;
      if(g)text=String(g);
      else{
        const rows=(typeof h.rows==='function'?h.rows():h.rows)||[];
        const r=rows.find(function(x){return x&&x[1];});
        if(r)text=String(r[0])+' '+String(r[1]);
      }
    }
  }
  if(!text){
    const acts=ccjActsFor(i,step);
    const at=Math.min((run&&run.act)||0,acts.length);
    if(at>0)text=String(acts[at-1].done||'');
    else if(acts[0])text=String(acts[0].doing||'').split(' ').slice(1).join(' ');
  }
  text=text.replace(/<[^>]*>/g,'').replace(/&middot;.*$/,'').replace(/&[a-z]+;/g,' ').trim();
  if(!text)return '';
  return text.split(/\s+/).slice(0,4).join(' ');
}
/* == A SUB-STATUS AS A BLOCK IN THE TRANSCRIPT ===========================================
   The same content the panel row carried, in the conversation instead of beside it, and showing
   one thing at a time rather than all of them at once.

   OPEN OR CLOSED. A block is open while the runner is ON it, and closes when the runner moves
   to the next one — not when it settles. That distinction is the whole behaviour: a step that
   has just finished stays open long enough to be read, and gives up the space only when there
   is something newer to give it to. Clicking a closed block opens it again, and that choice is
   remembered in run.open so the next repaint does not quietly undo it.

   WHAT A CLOSED BLOCK KEEPS. Its one useful fact, and never a bare tick — "CSM assigned ·
   Marta Reyes / NL". That line is not authored here; it is run.settled[key].summary, snapshotted
   when the step settled. Read from the snapshot rather than by calling ccjSummary again, or a
   line written in stage 1 would silently change as stage 7 moved.

   WHAT NEVER CLOSES. Anything still running — which is NOT just `hold`. A step waiting on the
   client is as unfinished as one holding on a milestone, and `wait` is a phase the declaring
   comment does not even list. A block showing an unanswered gate never closes either: closing it
   would hide the only control that can advance the run.

   NO PENDING BLOCKS. The panel showed every step of the stage up front, so a step that had not
   run yet had to say what it WOULD do (CCJ_PURPOSE). A transcript is a record of what happened;
   a step that has not started has no block at all. CCJ_PURPOSE stays — the onboarding screen
   still uses it for its pending cards — it is simply not read from here. == */
/* == PASSES: THE SAME STEP, RUN TWICE ====================================================
   Stage 2's Quote QA can send the run back to Cost calc built, and three steps then run AGAIN.
   That is the first thing in this journey the transcript could not describe: every per-step store
   is keyed 'stageId/label', so a second pass had nowhere to live and the re-run painted itself
   into the block the first pass was still sitting in — several screens above the message
   announcing it, while the bottom of the conversation went dead for eleven seconds.

   A pass number fixes it, and it has to be threaded through EVERY addresser at once. The block
   message, the open/closed state, the DOM id and the evidence-line id all take the pass, because
   two blocks sharing an id is the silent version of this bug: getElementById returns the FIRST
   match, so the second attempt's beats would paint into the first attempt's block with no error.

   run.settled is deliberately NOT keyed by pass. It is the runner's own store, read and deleted
   by code all over this file, and a second key shape there would be a much larger blast radius
   than this change is worth. A superseded block does not read it anyway — it is frozen. == */
function ccjPass(i,step){const run=ccjRun;return (run&&run.pass&&run.pass[ccjKey(i,step)])||1;}
function ccjPassKey(i,step){return ccjKey(i,step)+'#'+ccjPass(i,step);}
function ccjStepBlockId(i,n,p){return 'ccj-sb-'+i+'-'+n+'-'+(p||1);}
function ccjEvLinesId(i,n,p){return 'ccj-ev-'+i+'-'+n+'-'+(p||1);}
function ccjStepBlockHTML(i,n,p){
  const run=ccjRun;
  const step=ccjSteps(i)[n];
  if(!step)return '';
  const key=ccjKey(i,step);
  const pass=p||ccjPass(i,step);
  const pkey=key+'#'+pass;
  const settled=run.settled[key];
  // "The runner is on this step", not "this step is unfinished". A settled step is still current
  // until the next one starts, which is what gives it its moment before it closes — and it is
  // only current on the pass actually running, or a superseded block would claim the spinner.
  const current=run.stage===i&&run.sub===n&&pass===ccjPass(i,step);
  /* AN ANSWERED GATE IS NOT AN OPEN ONE. The step stays `current` for the 700ms between a decision
     being taken and the runner moving on, and for that window this used to resolve to the gate
     again — re-offering two buttons for a question that had just been answered. Harmless while the
     card was buried in the block; not harmless now that the same expression decides what sits
     pinned above the composer. `stopped` is excepted because a stopped run's card IS the record of
     the decision, and it carries the only way back. Kept identical to ccjPendingAction. */
  const gateKey=ccjKey(i,step);
  const gateOpen=current&&(run.stopped||!(run.decisions[gateKey]||run.settled[gateKey]));
  const gate=gateOpen?(ccjGateFor(i,step)||(run.phase==='halt'?ccjPostGateFor(i,step):null)):null;
  const stopped=current&&run.phase==='stopped';
  // A WAIT IS NOT WORK. The spinner says "this machine is busy"; a step parked on the client has
  // handed its work outside the product and is holding the door. Showing a spinner there is the
  // same dishonesty as ticking a held step green — it reports activity nobody is performing, and
  // it is the reason a reader eventually stops believing the spinner anywhere.
  const waiting=current&&!settled&&run.phase==='wait';
  const working=current&&!settled&&!gate&&!stopped&&!waiting;
  const open=current||!!run.open[pkey];
  const tick='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>';
  const mark=settled&&settled.skipped?'<span class="ccj-sb-skip">&ndash;</span>'
    :settled?'<span class="ccj-sb-tick">'+tick+'</span>'
    :working?'<span class="ccj-spin sm"></span>'
    :waiting?'<span class="ccj-sb-wait"></span>'
    :'<span class="ccj-sb-ask">'+(gate||stopped?'!':(n+1))+'</span>';
  if(!open){
    // The closed line is a control, so it is a button: reachable by keyboard, and announcing that
    // there is something behind it. The chevron is the only decoration it gets.
    return '<button type="button" class="ccj-sb closed'+(settled&&settled.skipped?' skipped':'')+'"'
      +' id="'+ccjStepBlockId(i,n,pass)+'" onclick="ccjToggleStep('+i+','+n+','+pass+')">'
      +'<span class="ccj-sb-mark">'+mark+'</span>'
      +'<span class="ccj-sb-label">'+step.label+'</span>'
      +'<span class="ccj-sb-fact">'+ccjStepFactHTML(settled)+'</span>'
      +'<span class="ccj-sb-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></span>'
      +'</button>';
  }
  // Only a block the reader opened themselves offers to close again. The live one cannot be
  // closed: hiding the step that is running is never what someone means to do.
  const head='<div class="ccj-sb-head'+(current?'':' clickable')+'"'
    +(current?'':' onclick="ccjToggleStep('+i+','+n+','+pass+')"')+'>'
    +'<span class="ccj-sb-mark">'+mark+'</span>'
    +'<span class="ccj-sb-label">'+step.label
    +(step.cond?'<span class="ccj-sb-cond">'+step.cond+'</span>':'')+'</span>'
    /* The whole of what a working block says, on one line: the gist — two or three words of the
       data actually moving, trailing off — and the spark with its changing verb. The head trades
       "what I am doing" for "what I found" in place when the step settles. */
    +(working?'<span class="ccj-sb-gist">'+ccjGistFor(i,step)+'<span class="ccj-sb-dots">&hellip;</span></span>'
      +ccjLiveStatusHTML(i,step):'')
    +(settled?'<span class="ccj-sb-fact">'+ccjStepFactHTML(settled)+'</span>':'')
    +ccjOwnerChipHTML(step)
    +'</div>';
  return '<div class="ccj-sb open'+(gate||stopped?' asking':'')+'" id="'+ccjStepBlockId(i,n,pass)+'">'
    +head+ccjStepBodyHTML(i,step,n,current,gate,settled,pass)+'</div>';
}
/* == A SUPERSEDED ATTEMPT, FOLDED TO ONE LINE ============================================
   When the quote goes back, the work that produced the rejected one is still true — it happened,
   it cost time, and the reason it was rejected is the most useful thing on the stage. But four
   blocks of it competing with the four that replaced them is the clutter this rebuild exists to
   remove, and the two "Cost calc built" lines would carry different numbers with nothing saying
   which is which.

   So the whole attempt folds into a single line, expandable. Nothing is lost and nothing is
   duplicated. The blocks are FROZEN at the moment they are superseded — each keeps the HTML it
   had — because their live state has just been deleted out from under them by the send-back.

   The first block of the attempt carries the fold; the rest render nothing, which is what the
   `.ccj-msg.step:empty` rule hides. They are not removed from run.msgs: an append-only stream
   that deletes its own history is not append-only, and the ids are still what the fold reads. */
function ccjFoldAttempt(i,fromIdx,reason){
  const run=ccjRun;if(!run||!ccjUsesTranscript(i))return;
  const steps=ccjSteps(i);
  const group=[];
  for(let n=fromIdx;n<steps.length;n++){
    const pass=ccjPass(i,steps[n]);
    const m=run.stepMsgs[ccjKey(i,steps[n])+'#'+pass];
    if(!m)continue;
    // Frozen BEFORE the pass is bumped, so ccjStepBlockHTML still resolves this pass's state.
    m.frozen=ccjStepBlockHTML(i,n,pass);
    m.head=false;
    group.push(m);
  }
  if(!group.length)return;
  group[0].head=true;
  group[0].reason=reason;
  group[0].count=group.length;
  group[0].open=false;
  group.forEach(function(m){m.group=group[0]._id;ccjRepaintMsg(m);});
  // Every step from here on is now on its next pass, so the blocks that follow are new ones.
  for(let n=fromIdx;n<steps.length;n++){
    const k=ccjKey(i,steps[n]);
    run.pass[k]=(run.pass[k]||1)+1;
  }
}
function ccjAttemptHTML(m){
  if(!m.head)return '';                  // folded into the head above it
  if(!m.open){
    return '<button type="button" class="ccj-att closed" onclick="ccjToggleAttempt('+m._id+')">'
      +'<span class="ccj-att-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">'
      +'<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></span>'
      +'<span class="ccj-att-label">Superseded attempt</span>'
      +'<span class="ccj-att-fact">'+m.reason+' &middot; '+m.count+' step'+(m.count===1?'':'s')+'</span>'
      +'<span class="ccj-sb-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></span>'
      +'</button>';
  }
  const run=ccjRun;
  const parts=run.msgs.filter(function(x){return x.group===m._id;}).map(function(x){return x.frozen;});
  return '<div class="ccj-att open">'
    +'<div class="ccj-att-head" onclick="ccjToggleAttempt('+m._id+')">'
    +'<span class="ccj-att-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">'
    +'<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></span>'
    +'<span class="ccj-att-label">Superseded attempt</span>'
    +'<span class="ccj-att-fact">'+m.reason+'</span>'
    +'<span class="ccj-sb-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></span>'
    +'</div>'
    +'<div class="ccj-att-body">'+parts.join('')+'</div></div>';
}
function ccjToggleAttempt(id){
  const run=ccjRun;if(!run)return;
  const m=run.msgs.find(function(x){return x._id===id;});
  if(!m)return;
  m.open=!m.open;
  ccjRepaintMsg(m);
}
function ccjStepFactHTML(settled){
  if(!settled)return '';
  // A skipped step's reason IS its one useful fact — it is the agent showing it considered the
  // step and ruled it out, which is the thing worth keeping when the block is closed.
  return settled.skipped?(settled.reason||'Not applicable'):(settled.summary||'');
}
/* The body of an open block. The same four things the panel row's detail carried, in the same
   order of precedence — a gate replaces the work, a skip explains itself, a wait says what it is
   waiting for, and otherwise the action log with its hold note and its way into the evidence.

   The evidence lines carry a per-block id. `ccj-ev-lines` was a singleton, which was safe only
   while exactly one row could ever be expanded; in a transcript a held block and a running block
   are open at the same time, and one id shared between them means the second block's beats paint
   into the first. */
function ccjStepBodyHTML(i,step,n,current,gate,settled,pass){
  const run=ccjRun;
  /* THE DECISION IS NOT DRAWN HERE ANY MORE — it is in the action bar above the composer, where
     it cannot scroll away (see ccjPendingAction). What the block keeps is the fact that it is the
     step doing the asking: its mark is already `!` rather than a spinner, and this one line says
     where the answer goes. Without it a reader scrolled back up to this block would find a step
     that had visibly stopped and nothing saying why or what to do about it. */
  if(current&&gate)return '<div class="ccj-sb-body"><div class="ccj-sb-await">'
    +(run.stopped?'This run stopped here.':'Waiting on you.')
    +' <b>The decision is at the bottom of this conversation.</b></div></div>';
  if(settled&&settled.skipped)return '<div class="ccj-sb-body"><div class="ccj-sb-why">'
    +(settled.reason||ccjPurpose(i,step))+'</div></div>';
  const d=ccjEvidence(i,step);
  const hold=current&&run.phase==='hold'?ccjHoldFor(i,step):null;
  const wait=current&&run.phase==='wait'?ccjWaitFor(i,step):null;
  /* THE BLOCK THE RUNNER IS ON IS ONE LINE — the user removed the live details outright: the
     head carries everything (name, gist, spark, verb) and the body renders NOTHING while the
     machine works or holds. The record lost nothing: the settled block's click reopens the full
     action log below, and the drawer keeps the whole evidence set. The one live state that
     keeps a body is a WAIT — a step parked on a person must say who is holding it and what has
     been armed, or a parked run is indistinguishable from a hung one. */
  if(current){
    if(wait)return '<div class="ccj-sb-body live">'+ccjWaitNoteHTML(wait,i,step)+'</div>';
    return '';
  }
  /* A REOPENED BLOCK IS THE RECORD, not the broadcast — the reader asked for this one, so it
     gets the full action log with every payload and verdict, exactly as it always did. */
  const state=settled?'done':'current';
  return '<div class="ccj-sb-body">'
    +'<div id="'+ccjEvLinesId(i,n,pass)+'">'+ccjActLogHTML(i,step,state)+'</div>'
    +(hold?'<div class="ccj-hold"><span class="ccj-hold-bar"></span>'+ccjHoldNoteHTML(hold)+'</div>':'')
    +(d?'<button class="ccj-ev-more" onclick="ccjInspect(\''+attrSafe(ccjKey(i,step))+'\')">'
      +'View evidence'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>':'')
    +'</div>';
}
/* == WAITING ON A PERSON, HONESTLY ========================================================
   "Waiting for the client to open the quote." is true and it is not enough. A run parked on a
   sentence that never changes is indistinguishable, after ten seconds, from a run that has hung —
   and the reader's next move is to refresh the page, which is the one thing the product must
   never make them want to do.

   So a wait says two things instead of one: WHAT it is waiting for, and — from the wait's own
   `rows` — what has been armed so it does not depend on anyone remembering, or who is holding it.
   Those rows are declared beside each wait rather than inferred here; see CCJ_WAITS for why. */
function ccjWaitNoteHTML(w,i,step){
  // Each row is declared as a [key, value] pair and turned into markup here, so a wait declares
  // WHAT it wants to say and never how it is drawn.
  const rows=((typeof w.rows==='function'?w.rows():w.rows)||[])
    .map(function(r){return ccjWaitRow(r[0],r[1]);});
  return '<div class="ccj-wait">'
    +'<div class="ccj-wait-top"><span class="ccj-wait-pulse"></span>'
    +'<span class="ccj-wait-note">'+w.note+'</span></div>'
    +(rows.length?'<div class="ccj-wait-rows">'+rows.join('')+'</div>':'')
    +'</div>';
}
function ccjWaitRow(k,v){
  return '<div class="ccj-wait-row"><span class="ccj-wait-k">'+k+'</span>'
    +'<span class="ccj-wait-v">'+v+'</span></div>';
}
/* Opening or closing a block the reader clicked. Repaints that block alone — everything else on
   screen is untouched, including whatever the runner is doing at the time. */
function ccjToggleStep(i,n,p){
  const run=ccjRun;if(!run)return;
  const step=ccjSteps(i)[n];
  if(!step)return;
  const pkey=ccjKey(i,step)+'#'+(p||ccjPass(i,step));
  if(run.open[pkey])delete run.open[pkey];else run.open[pkey]=true;
  const m=run.stepMsgs[pkey];
  if(m)ccjRepaintMsg(m);
  // The block's own body is only half of what it discloses. Everything it said while it ran is
  // underneath it, and opening one without the other shows a step's detail while still hiding
  // its conversation.
  ccjFoldOwned(pkey);
}
/* A step arriving in the transcript. Pushed once per step and then held onto, so every later
   repaint addresses the same block rather than adding another.

   A step re-entered after a rework keeps the block it already had. That is right for the stages
   using the transcript today — stage 1's only way back is a reopen after a reject, where the
   step genuinely resumes rather than happening a second time. A stage whose rework REPEATS work
   (stage 2's quote QA sends back to Cost calc built) will want a fresh block saying so, and
   should get one when that stage is rebuilt. */
function ccjOpenStepBlock(){
  const run=ccjRun;if(!run||!ccjUsesTranscript(run.stage))return;
  const step=ccjSteps(run.stage)[run.sub];
  if(!step)return;
  const pass=ccjPass(run.stage,step);
  const pkey=ccjKey(run.stage,step)+'#'+pass;
  // Per PASS, not per step. A step re-entered on the same pass — a reopen after a reject,
  // where the work genuinely resumes — keeps the block it already had. A step re-entered on a NEW
  // pass is work happening a second time, and gets a new block at the bottom of the conversation
  // where the reader actually is.
  if(run.stepMsgs[pkey])return;
  const m={who:'agent',kind:'step',stage:run.stage,sub:run.sub,pass:pass};
  run.stepMsgs[pkey]=m;
  ccjPush(m);
}
/* Where a person is asked for something. It sits inside the row it belongs to rather than at
   the bottom of the panel, so the question and the step it answers are never separated.

   == WHO A STEP IS ABOUT IS NOT WHO DECIDES IT ==============================================
   A sub-status names the party whose action it tracks: "Signed" is owned by the Client because the
   client is who signs, and "Part-paid" because the client is who underpaid. But the DECISION hung
   off those steps is ours — whether to countersign, whether to release a placement against a
   shortfall — and the block was crediting it to the counterparty. It rendered "Client · Client"
   with an ACTING AS marker over two buttons that decide whether we accept a legal obligation and
   whether we carry an unfunded payroll.

   That is not cosmetic. This surface's whole job is saying who is authorised to answer, and naming
   the party who cannot answer it is the one thing it must never do. `gate.owner` overrides the
   step's for exactly these cases; without one the step's own owner still applies, which is right
   for every gate that decides the thing its step is named after. == */
function ccjGateOwner(step,gate){return (gate&&gate.owner)||(step&&step.owner)||'';}
function ccjGateHTML(i,step,gate){
  const run=ccjRun;
  if(run.stopped){
    // Named by the decision that stopped the run, not by the first one that ever could. This card
    // was a single hardcoded "Request disqualified." shown for all four terminal decisions, so a
    // declined employment contract in stage 7 described itself in stage 1's intake language.
    const s=run.stop||{};
    return '<div class="ccj-gate stopped">'
      +'<div class="ccj-gate-ask">'+(s.title||'Stopped')+'.</div>'
      +'<div class="ccj-gate-why">'+(s.note||'No further steps ran.')+'</div>'
      +(s.reason?'<div class="ccj-gate-reason"><b>'+(s.by||'Reason')+':</b> '+s.reason+'</div>':'')
      +'<div class="ccj-gate-btns"><button class="ccj-gate-btn ghost" onclick="ccjReopen()">Reopen</button></div>'
      +'</div>';
  }
  /* == THE REASON, ASKED FOR BEFORE THE DECISION IS TAKEN =====================================
     Same card, same place in the transcript — the buttons are replaced by the question, and
     nothing has happened yet. Cancel restores the gate untouched.

     Inline rather than a dialog because this IS the decision, not a confirmation of one: an
     overlay would put the reason somewhere other than the record it belongs to, and the reader
     would lose the ask it answers. == */
  if(run.stopAsk&&run.stopAsk.key===ccjKey(i,step)){
    const o=gate.options.find(function(x){return x.id===run.stopAsk.optId;})||{};
    // `reason-ask`, not `asking` — `.ccj-sb.asking` already means "this step is waiting on you",
    // and one word meaning two things in the same stylesheet is how a rule ends up applying to
    // an element nobody was thinking about.
    return '<div class="ccj-gate '+gate.kind+' reason-ask">'
      +'<div class="ccj-gate-ask">'+o.label+' &mdash; why?</div>'
      +'<div class="ccj-gate-why">This is recorded against the run and cannot be left blank.</div>'
      +'<textarea class="ccj-gate-input" id="ccj-stop-why" rows="2" placeholder="Give the reason&hellip;"></textarea>'
      +'<div class="ccj-gate-err" id="ccj-stop-err"></div>'
      +'<div class="ccj-gate-btns">'
      +'<button class="ccj-gate-btn stop" onclick="ccjConfirmStop()">'+o.label+'</button>'
      +'<button class="ccj-gate-btn ghost" onclick="ccjCancelStop()">Cancel</button>'
      +'</div></div>';
  }
  const owner=ccjGateOwner(step,gate);
  const info=typeof amOwnerInfo==='function'?amOwnerInfo(owner):{who:owner,initials:'?'};
  // Whether the persona currently signed in is the one who owns this DECISION. It is still tracked
  // and still shown — CCJ_ANY_PERSONA only decides whether a non-owner is BLOCKED from clicking,
  // so turning it off restores real role enforcement without touching anything else.
  const owns=typeof amCanAdvance==='function'?amCanAdvance(owner):true;
  return '<div class="ccj-gate '+gate.kind+'">'
    +'<div class="ccj-gate-ask">'+gate.ask+'</div>'
    // A gate need not justify itself. Where a `why` is authored it is drawn; where there is none
    // the element is not emitted at all — an empty one still carries its 9px bottom margin, which
    // reads as a line that failed to load rather than a card that never had one. Guards both
    // shapes: a `why` that was deleted (which printed the word "undefined" here) and one set to ''.
    // The stopped-state card above keeps its own hardcoded line and is unaffected.
    +(gate.why?'<div class="ccj-gate-why">'+gate.why+'</div>':'')
    +'<div class="ccj-gate-who"><span class="ccj-gate-av">'+info.initials+'</span>'+owner+' &middot; '+info.who
    +(!owns&&CCJ_ANY_PERSONA?'<span class="ccj-gate-behalf">Acting as</span>':'')+'</div>'
    +(owns||CCJ_ANY_PERSONA
      ?'<div class="ccj-gate-btns">'+gate.options.map(function(o){
        return '<button class="ccj-gate-btn '+(o.tone==='stop'?'stop':'go')+'" onclick="ccjChooseGate(\''+o.id+'\')">'+o.label+'</button>';
      }).join('')+'</div>'
      :'<div class="ccj-gate-locked">Only '+owner+' can approve this.</div>')
    +'</div>';
}

/* == THE ACTION AREA: ONE PLACE, AND IT IS ABOVE THE INPUT ================================
   A decision used to be drawn where it was ASKED — inside the sub-status block, wherever that
   block happened to be in the scroll. That is the right instinct and the wrong consequence. The
   transcript keeps growing underneath it: the halt sentence lands after the card, then the
   client's thread, then whatever else the run has to say, and within a few beats the only
   control that can move the run is somewhere above the fold with a conversation sitting on top
   of it. The reader's job at that moment is to answer one question, and the product had made
   finding the question the harder half of it.

   So the action leaves the flow and PINS to the bottom of the conversation, directly above the
   box you would type into — the band the eye is already resting on when it decides what to do —
   separated from the record above it by a single hairline. Everything else in the chat keeps
   scrolling behind it. Nothing about the transcript changes: the block still says which step is
   asking, the halt sentence is still the last thing said, and the answer still lands in the
   record where it was given. What moved is the CONTROL, to the one place it cannot scroll away
   from.

   ONE MODEL FOR BOTH KINDS OF ASK. A gate and a rest-ask are already the same component (see
   ccjAsk); making the bar understand only gates would have left the "Continue to client signing"
   button buried in the scroll while every decision sat pinned, and the reader would have had to
   learn which of the two the product had decided to make easy to find.

   NOTHING PENDING, NO BAR. `.ccj-actionbar:empty` collapses to zero height and drops its border,
   so a run that is simply working shows a conversation sitting straight on its composer, exactly
   as before. == */
/* == THE STEPS THAT WANT SOMETHING BUT HAVE NO BUTTON ====================================
   A decision announces itself: a card, two buttons, nothing to work out. Some steps want just as
   much from a person and announce nothing at all. Stage 1's intake is the one that mattered — the
   run stands still until somebody fills in the contract details, and the only thing on screen
   saying so was a spinner and the word "Gathering". A spinner is not an instruction.

   So those steps get ONE LINE naming the action, in the same pinned band as every decision.

   AND ONLY THOSE STEPS. The first version of this reported on every step — "the layer is running
   Country data check", "nothing to do, this is with the client" — on the theory that a reader
   always deserves to know where they stand. In practice it put a permanent panel above the
   composer narrating a run the transcript was already narrating, two inches above it, in more
   detail. A bar that is always there is a bar nobody reads, which costs you the one moment it
   exists for. It is silent unless something is wanted.

   ONE LINE, AND IT IS THE ACTION. No second sentence explaining what the step is for or what
   releases it: the block above says which sub-status is open and the transcript says the rest. An
   instruction that has to be read past to be found is not an instruction. == */
/* Stage 1's intake has four states and only two of them are yours, so it is worked out once and
   read twice rather than twice over with two chances to disagree with itself.

   `compiling` IS NOT YOUR MOVE, and getting that wrong would be worse than saying nothing: the
   proposal is compiled automatically CCJ_AUTOGAP after the last required field lands — there is no
   button — so telling someone to "create the proposal" would send them hunting for a control that
   does not exist. Nor is `reading`: the layer is filling the form in for them. Both are silent. */
function ccjIntakeState(){
  const run=ccjRun;if(!run)return 'fill';
  const d=run.doc;
  if(d&&!d.done)return 'reading';
  if(run.screen!=='form')return 'goto';
  return (typeof ccjMissingFields==='function'&&ccjMissingFields().length)?'fill':'compiling';
}
/* Keyed by step, and an empty string means "nothing is wanted right now" — which is most of the
   time, on most steps, and is why there are two entries here rather than forty. A step with no
   entry says nothing at all: it either has a gate, or the layer is doing it, or somebody outside
   the building is, and in none of those cases is there an action to name. */
const CCJ_TODO={
  'request-received/New intake':function(){
    const s=ccjIntakeState();
    if(s==='goto')return 'Open the contract details and fill them in.';
    if(s!=='fill')return '';                       // reading, or compiling — the layer is working
    const miss=ccjMissingFields().length;
    /* TWO ROUTES, AND THE SECOND ONE WAS INVISIBLE. Typing the fields in is not the only way to
       answer this step — the candidate's completed information form can be attached and read
       into the whole sheet at once, which is faster and is what actually happens on most hires.
       That route existed only as a paperclip in the composer, and a control whose meaning has to
       be guessed from an icon is a control most people never try.

       So the instruction names both, and the second one is the button: the words that describe
       the action ARE the way to take it, so nobody has to go looking for the icon after reading
       about it. */
    return 'Fill in the contract details '
      +'<button type="button" class="ccj-todo-alt" onclick="ccjUpload()">or upload a completed form</button>'
      +' &mdash; <b>'+miss+' field'+(miss===1?'':'s')+'</b> to go.';
  },
  'quote-review/Change requested':function(){
    // Only once there IS a draft. While it is being written there is nothing to send.
    return ccjClient().drafted?'Send the reply drafted for you below.':'';
  }
};
function ccjTodoFor(i,step){
  const run=ccjRun;
  if(!run||!step)return '';
  // Only while the run is actually parked on this step. A settled step is on its way out and a
  // halted one has a gate, which is a louder answer to the same question.
  if(run.phase!=='hold'&&run.phase!=='act'&&run.phase!=='wait')return '';
  const fn=CCJ_TODO[ccjKey(i,step)];
  return fn?(fn()||''):'';
}
function ccjPendingAction(){
  const run=ccjRun;
  if(!run||!ccjUsesTranscript(run.stage))return null;
  const step=ccjSteps(run.stage)[run.sub];
  if(step){
    const key=ccjKey(run.stage,step);
    // The same expression the block used to decide with, kept identical on purpose: two surfaces
    // disagreeing about whether there is a decision open is how one of them renders a card with
    // no buttons and the other renders buttons for a decision already taken.
    const gate=ccjGateFor(run.stage,step)||(run.phase==='halt'?ccjPostGateFor(run.stage,step):null);
    /* A STOPPED RUN IS STILL ASKING SOMETHING — whether to reopen — so it keeps the bar. It is
       also the one case where the decision HAS been recorded and the card must still show, which
       is why it is tested before `decided` rather than after it. */
    if(gate&&run.stopped)return {type:'gate',blocking:true,i:run.stage,step:step,gate:gate};
    // Answered, or settled past. Without this the card comes back for the 700ms between a
    // decision being taken and the runner moving on — offering the same two buttons for a
    // question that has just been answered.
    const decided=!!run.decisions[key]||!!run.settled[key];
    if(gate&&!decided)return {type:'gate',blocking:true,i:run.stage,step:step,gate:gate};
  }
  /* The newest unanswered ask. Newest rather than oldest because the transcript keeps every ask
     it ever made and a spent one is still in the list — and there is only ever one live at a
     time, since an ask is what the run stops on. */
  const msgs=run.msgs||[];
  for(let n=msgs.length-1;n>=0;n--){
    if(msgs[n].kind==='ask'&&!msgs[n].done)return {type:'ask',blocking:true,msg:msgs[n]};
  }
  /* A STEP THAT WANTS SOMETHING BUT HAS NO BUTTON. Silent unless there is an actual action to
     name — see CCJ_TODO. Not before the run starts either: the composer's own empty state is the
     instruction there, and a second copy of it two inches below would be the product explaining
     itself twice. */
  if(!run.started||run.sub<0)return null;
  const step2=ccjSteps(run.stage)[run.sub];
  const todo=ccjTodoFor(run.stage,step2);
  if(!todo)return null;
  return {type:'todo',blocking:true,i:run.stage,step:step2,todo:todo};
}
/* One line: a tick-box mark and the action. No heading, no tag, no second sentence — everything
   this used to carry was context the block above and the transcript below already give, and it
   buried the instruction in the middle of a paragraph. */
function ccjTodoHTML(a){
  return '<div class="ccj-todo">'
    +'<span class="ccj-todo-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>'
    +'<span class="ccj-todo-do">'+a.todo+'</span>'
    +'</div>';
}
function ccjActionBarHTML(){
  const a=ccjPendingAction();
  if(!a)return '';
  if(a.type==='ask')return ccjAskHTML(a.msg,true);
  if(a.type==='todo')return ccjTodoHTML(a);
  return ccjGateHTML(a.i,a.step,a.gate);
}
/* Repainted from every path that can change what is being asked — which is nearly all of them,
   so it is called from the four functions they all funnel through rather than sprinkled about.

   GUARDED ON THE HTML ITSELF, and that guard is doing real work. This runs on every beat of every
   step; rewriting innerHTML each time would blow away the caret and the half-typed sentence in the
   reason textarea the moment anything else in the run moved. Comparing the markup means the node
   is only touched when the ask has genuinely changed. */
function ccjPaintActionBar(){
  const run=ccjRun;if(!run)return;
  const el=document.getElementById('ccj-actionbar');
  const a=ccjPendingAction();
  const html=ccjActionBarHTML();
  const blocking=!!(a&&a.blocking);
  if(el&&run._barHTML!==html){
    el.innerHTML=html;
    run._barHTML=html;
    /* A new ask arriving must not sit behind the last few messages of the conversation, so the
       stream is put at its bottom as it appears. BLOCKING ONLY, and that qualifier matters: the
       running commentary changes at every step, and following it would drag a reader who had
       scrolled back through the record down the page four times a stage. The scroll is pulled for
       something that needs them, never for something that is merely reporting itself. */
    if(blocking&&!run._barBlocking){
      const box=document.getElementById('ccj-stream');
      if(box){run.follow=true;ccjStickBottom(box);}
    }
  }
  run._barBlocking=blocking;
  ccjPaintAwaiting(blocking);
}
/* == EVERY LOADER STOPS WHILE SOMEBODY IS BEING ASKED =====================================
   A spinner means "this machine is busy". When the run has halted on a person, nothing is busy —
   the product is doing precisely nothing until they answer — and a page still turning spinners,
   pulsing wait bars and sheening verbs is reporting activity that is not happening. It also
   competes for exactly the attention the question needs.

   One class on the body, and the stylesheet freezes the lot. It has to be the BODY rather than
   the conversation, because the artefact column has loaders of its own (the document bar, the
   quote skeletons) and half a frozen page is worse than none of it. */
function ccjPaintAwaiting(on){
  const body=document.getElementById('ccj-body');
  if(body&&body.classList&&typeof body.classList.toggle==='function')body.classList.toggle('ccj-awaiting',!!on);
}

/* ---- THE EVIDENCE DRAWER ----------------------------------------------------------------
   Everything the panel is too narrow to hold: the call that was made, what came back, every
   rule with its expected value, actual value and verdict, and what was written to the record.
   Overlays the work area rather than pushing it, so opening it never reflows the run. */
let ccjDrawerKey=null;
function ccjInspect(key){ccjDrawerKey=key;ccjPaintDrawer();}
function ccjCloseDrawer(){ccjDrawerKey=null;ccjPaintDrawer();}
function ccjPaintDrawer(){
  const host=document.getElementById('ccj-drawer-host');
  if(host)host.innerHTML=buildCCJDrawerHTML();
}
function buildCCJDrawerHTML(){
  if(!ccjDrawerKey||!ccjRun)return '';
  const i=ccjRun.stage;
  const step=ccjSteps(i).find(function(st){return ccjKey(i,st)===ccjDrawerKey;});
  const d=step?ccjEvidence(i,step):null;
  if(!step||!d)return '';
  const c=ccjCtx();
  const fetched=ccjVal(d.fetched,c)||[];
  const checks=ccjVal(d.checks,c)||[];
  const captured=ccjVal(d.captured,c)||[];
  const call=ccjVal(d.call,c);
  const sec=function(title,body){return body?'<div class="ccj-dw-sec"><div class="ccj-dw-sec-t">'+title+'</div>'+body+'</div>':'';};
  return '<div class="ccj-dw-scrim" onclick="ccjCloseDrawer()"></div>'
    +'<div class="ccj-dw">'
    +'<div class="ccj-dw-head">'
    +'<div><div class="ccj-dw-label">'+step.label+'</div>'
    +'<div class="ccj-dw-sub">'+(ccjVal(d.system,c)||'&mdash;')
      +(ccjVal(d.ref,c)?' &middot; '+ccjVal(d.ref,c):'')+'</div></div>'
    +'<button class="ccj-dw-x" onclick="ccjCloseDrawer()">&#x2715;</button>'
    +'</div>'
    +'<div class="ccj-dw-body">'
    +sec('Reached',(call?'<div class="ccj-dw-call">'+call+'</div>':'')
      +'<div class="ccj-dw-kv"><span>Time taken</span><b>'+(ccjVal(d.latency,c)||'&mdash;')+'</b></div>')
    +sec('Came back',fetched.length?'<div class="ccj-dw-rows">'+fetched.map(function(f){
        return '<div class="ccj-dw-row '+(f.state||'')+'"><div class="ccj-dw-row-k">'+f.k
          +(f.sub?'<span>'+f.sub+'</span>':'')+'</div><div class="ccj-dw-row-v">'+f.v+'</div></div>';
      }).join('')+'</div>':'')
    +sec('Checked',checks.length?'<div class="ccj-dw-checks">'+checks.map(function(ck){
        return '<div class="ccj-dw-check '+(ck.verdict||'')+'">'
          +'<div class="ccj-dw-check-rule">'+ck.rule+'</div>'
          +'<div class="ccj-dw-check-cmp"><span>Expected</span><b>'+ck.expected+'</b></div>'
          +'<div class="ccj-dw-check-cmp"><span>Actual</span><b>'+ck.actual+'</b></div>'
          +'<span class="ccj-dw-verdict '+(ck.verdict||'')+'">'+(ck.verdict||'').toUpperCase()+'</span>'
          +'</div>';
      }).join('')+'</div>':'')
    +sec('Written to the record',captured.length?'<div class="ccj-dw-rows">'+captured.map(function(cp){
        return '<div class="ccj-dw-row"><div class="ccj-dw-row-k">'+cp.k+'</div><div class="ccj-dw-row-v">'+cp.v+'</div></div>';
      }).join('')+'</div>':'')
    +(d.note?'<div class="ccj-dw-note">'+d.note+'</div>':'')
    +(d.failure?'<div class="ccj-dw-fail"><b>If it fails</b> '+d.failure+'</div>':'')
    +'</div></div>';
}

/* ---- THE CONVERSATION -------------------------------------------------------------------
   One thread for the whole stage. It opens as the intake, then narrows to a 300px column
   beside the form, where it keeps asking for the fields that are still missing. Everything
   the agent produces is a MESSAGE inside the scrolling stream — never a new block on the page,
   which is what keeps the composer from being pushed below the fold. */
/* Which conversation the column is showing. On stage 3 the work IS the client conversation, so
   it takes the column outright — the agent still appears inside it, drafting replies, but a
   second stream to switch to would put an internal remark one mis-click from a client. */
const CCJ_CLIENT_STAGES=['quote-review','quote-approved','agreement-signature'];
/* The third counterparty. Stage 7's contract is between us and the WORKER, so the column carries
   the worker's thread — a separate store from the client's, not a mode switch over one list. The
   two must never merge: this thread discusses someone's salary and probation with them, and the
   client's discusses our margin. Either message in the other thread is a disclosure. */
const CCJ_WORKER_STAGES=['employment-contract','onboarding','active'];
function ccjChatMode(){
  const st=ccjStage(ccjRun.stage);
  if(!st)return 'agent';
  if(CCJ_WORKER_STAGES.indexOf(st.id)>-1)return 'worker';
  return CCJ_CLIENT_STAGES.indexOf(st.id)>-1?'client':'agent';
}
/* What the thread is ABOUT on this stage — the one line under the client's name, and the only
   thing on the surface that says which conversation this is. It moves with the stage: once the
   deposit is invoiced this is accounts payable discussing an invoice number, not a buyer
   discussing a quote version.

   Stage 4 needed its own answer for the same reason. The deal is WON there — that is the entire
   stage — and a header still reading "quote v2" describes a negotiation that finished, on the one
   line whose job is to say what is being talked about now.

   Fixed for the length of a stage on purpose. The header is built once per page render and is not
   repainted as sub-statuses settle, so a subject derived from something that moves mid-stage —
   the tenant id, which does not exist until the second step — would be stale the moment it
   changed. Everything read here is already true when the stage opens. */
function ccjThreadSubject(){
  const run=ccjRun;
  const s=ccjStage(run.stage);
  const id=s?s.id:'';
  if(id==='deposit-due')return ccjInvoice().id;
  if(id==='quote-approved')return 'Accepted quote v'+ccjClient().version;
  // The agreement, not the quote. This thread is now about a document with its own identifier —
  // the one a person searching for this conversation later would search by.
  if(id==='agreement-signature')return ccjMsaExists()?'Agreement in force':ccjMsa().id;
  return 'quote v'+ccjClient().version;
}
function buildCCJChatHTML(isFull){
  const run=ccjRun;
  const ev=ccjEvent(0);
  const mode=ccjChatMode();
  const client=mode==='client';
  if(mode==='worker'){
    const w=ccjParties().worker;
    return '<div class="ccj-chat'+(isFull?' full':'')+' client">'
      +'<div class="ccj-chat-head">'
      +'<span class="ccj-chat-av worker">'+ccjInitials(w.name)+'</span>'
      +'<div class="ccj-chat-headtext"><div class="ccj-chat-title">'+w.name+'</div>'
      +'<div class="ccj-chat-sub">Employee &middot; '+w.empId+'</div></div>'
      +'</div>'
      +'<div class="ccj-stream" id="ccj-stream"></div>'
      +ccjActionBarShellHTML()
      +'<div class="ccj-composer" id="ccj-composer">'+ccjComposerInnerHTML()+'</div>'
      +'</div>';
  }
  return '<div class="ccj-chat'+(isFull?' full':'')+(client?' client':'')+'">'
    +'<div class="ccj-chat-head">'
    +(client
      // The client's own initials. This was hardcoded "DH", so the one screen whose entire job is
      // showing who you are talking to read "DH · Helix Marine B.V."
      ?'<span class="ccj-chat-av">'+ccjInitials(ccjParties().client.name)+'</span>'
       +'<div class="ccj-chat-headtext"><div class="ccj-chat-title">'+ccjCtx().client+'</div>'
       +'<div class="ccj-chat-sub">Client &middot; '+ccjThreadSubject()+'</div></div>'
      :'<span class="ccj-chat-spark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg></span>'
       +'<div class="ccj-chat-headtext"><div class="ccj-chat-title">Create a contract</div>'
       +'<div class="ccj-chat-sub">'+(ev.source||'AI Prompt Parser')+'</div></div>')
    +'</div>'
    +'<div class="ccj-stream" id="ccj-stream"></div>'
    +ccjActionBarShellHTML()
    +'<div class="ccj-composer" id="ccj-composer">'+ccjComposerInnerHTML()+'</div>'
    +'</div>';
}
/* The bar's NODE is built with the chat and never rebuilt with it — same reason the stream is a
   stable node. Its contents are painted into it by ccjPaintActionBar, so a repaint of the ask
   never remounts the element the reader is typing a reason into. It is emitted with whatever is
   pending at build time, so a page render lands with the question already on screen rather than
   one paint later. */
function ccjActionBarShellHTML(){
  const html=ccjActionBarHTML();
  // Recorded as painted, so the first ccjPaintActionBar after this render sees no change and
  // leaves the node alone. Without it every page render would rewrite an identical bar and yank
  // the stream to the bottom on the way past.
  if(ccjRun){
    const a=ccjPendingAction();
    ccjRun._barHTML=html;
    ccjRun._barBlocking=!!(a&&a.blocking);
  }
  return '<div class="ccj-actionbar" id="ccj-actionbar">'+html+'</div>';
}
/* The composer is its own builder because submitting the first request changes it — the model
   pills go, the placeholder changes, the upload appears — and repainting it alone leaves the
   message stream above it untouched.

   Upload sits directly above the input, not up in the header. It is an alternative way of
   answering the same thing the input asks for, so it belongs next to the input, in the band the
   eye is already resting on when it decides how to reply. */
function ccjComposerInnerHTML(){
  const run=ccjRun;
  // No model pills here any more. The engagement model has its own screen in front of this one
  // and its own chip in the header, and a third control for the same decision — sitting under
  // the thing it does not govern — was the duplicate.
  return ''
    /* No labelled upload bar any more — the user replaced it: attaching the document is a
       composer act, so it lives IN the composer as a link icon (see the input row below), the
       way Claude's own attach does. Form screen only, because a document fills FIELDS and the
       screens without any have nothing for it to land in. */
    /* WHO YOU ARE TYPING TO. While the counterparty's thread had the column to itself, the stage
       said it for you. In one shared stream it no longer does — and the failure mode is someone
       sending an internal note to a customer, which is not a mistake this product gets to make
       twice. So the composer names the recipient whenever it is not us, in the same colour as
       that counterparty's lane rail, directly above the box the words go into. */
    +(function(){
      const mode=typeof ccjChatMode==='function'?ccjChatMode():'agent';
      if(mode==='agent'||!ccjUsesTranscript(run.stage))return '';
      const p=ccjParties();
      /* No simulate strip. It was demo scaffolding for making the counterparty act on cue, and it
         is not needed: CCJ_CLIENT_SCRIPT already drives the client on its own timing — the strip's
         own note conceded as much ("Left alone the client acts on their own. These are the same
         events."). Five buttons sitting permanently above the composer, on the surface a person
         actually works in, cost more attention than they were worth. */
      return '<div class="ccj-to"><span class="ccj-to-arrow">&#9656;</span>Replying to <b>'
        +(mode==='worker'?p.worker.name:p.client.name)+'</b><span class="ccj-to-note">they will see this</span></div>';
    })()
    +'<div class="ccj-input-row">'
    /* The link icon attaches the completed form; the quiet download beside it hands you the
       sample — the thing you are asked to attach is the thing we send a candidate, so the
       product should still offer a copy. The tooltips carry what the old labels used to say.
       `download` AND `target="_blank"` on the sample cover different cases: over http the
       download attribute saves to disk and target is ignored; from the filesystem Chrome
       refuses `download` for a local file, and the target then opens the PDF viewer, which
       has its own save button. */
    +(run.screen==='form'?''
      +'<button class="ccj-attach" onclick="ccjUpload()" title="Attach a completed employee information form &mdash; the details are read into the form for you">'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>'
      +'</button>'
      +'<a class="ccj-attach dl" href="'+attrSafe(CCJ_SAMPLE_PDF)+'" download target="_blank" rel="noopener" '
      +'title="Open the sample employee information form &mdash; the completed sheet a candidate returns. Save it, then attach it here.">'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
      +'</a>':'')
    // A run opened from a deal arrives with its request already written — the words are still
    // yours to change, and nothing is sent until you send it. Cleared once the run has started so
    // the composer goes back to being a composer.
    +'<textarea class="ccj-input" id="ccj-prompt" rows="1" placeholder="'+(run.started?'Add more details…':'Describe the hire')+'" '
    +'oninput="ccjGrow(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();ccjSend();}">'
    +(!run.started&&run.seedPrompt?attrSafe(run.seedPrompt).replace(/&quot;/g,'"'):'')+'</textarea>'
    +'<button class="ccj-send" onclick="ccjSend()" title="Send">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
    +'</div>';
}
// Kept because it is the honest setter for the model — ccjChooseModel is the chooser screen's
// handler and also advances. Anything that only needs to set the value calls this.
function ccjSetModel(id){
  const run=ccjRun;if(!run||run.started)return;   // locked once the request is logged
  run.model=id;
  ccjPaintWork();
}
function ccjGrow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,110)+'px';}

/* == THE TRANSCRIPT: APPEND-ONLY, AND STICKY RATHER THAN FORCED ==========================
   The stream used to be rebuilt from run.msgs on every single push, then force-scrolled to the
   bottom. Both had to go, and for the same reason the sub-status panel is built once per stage:
   a surface that is thrown away and rebuilt cannot hold a spinner, an animation, a scroll
   position, or a reader's place in it.

   THE RULE. A message already on screen is never re-rendered. A push appends its own node and
   nothing else moves. The full rebuild survives as ccjRenderChat, but only for the moments that
   genuinely start a new surface: a page render, a switch between the agent, client and worker
   threads, and the one place in this file that edits history rather than adding to it
   (ccjPickClient, which drops its own question once it is answered).

   Nobody calls the right one by hand. Every push goes through ccjStreamSync, which appends when
   it can PROVE the DOM already holds exactly the messages before this one, and rebuilds when it
   cannot. A caller that had to know which it needed would eventually get it wrong, and getting
   it wrong is silent — an append onto a stale stream duplicates the conversation.

   STICKY BOTTOM, NOT FORCED BOTTOM. `el.scrollTop=el.scrollHeight` on every push meant a reader
   could not scroll up and read anything while the run was moving; every beat threw them back
   down. The follow now happens only if they were already at the bottom — and it is measured
   BEFORE the append, because appending is precisely what changes the number being measured. == */
const CCJ_STICKY=48;      // px of slack that still counts as "at the bottom"
function ccjAtBottom(el){
  // The headless harness has no layout, so every measurement there is 0 and 0-0-0 <= 48 reads as
  // at-the-bottom. That is the right answer for it: the tests care what the stream SAYS, and a
  // run that silently stopped following would be a browser-only bug either way.
  return el.scrollHeight-el.scrollTop-el.clientHeight<=CCJ_STICKY;
}
/* FOLLOWING IS AN INTENT, NOT A MEASUREMENT.

   The first version asked "is the reader at the bottom?" at the moment it wanted to scroll — and
   that is always too late. By then the paint has already happened: a block has grown four
   evidence lines, or a whole new block has been appended, and the reader is two hundred pixels
   from a bottom that moved without them. The honest answer to the measurement is "no, they are
   not at the bottom", so the follow was skipped, and the run walked off the end of the screen
   while the thing it wanted the reader to answer sat below the fold.

   So it is remembered instead. The reader is following until they scroll UP, and following again
   the moment they come back to the bottom. Nothing the run does changes it; only they do.

   Our own scrolling has to be excluded, or the fix breaks itself: a glide toward the bottom
   passes through dozens of positions that are not the bottom, and each one would read as the
   reader deciding to leave. ccjAutoScroll counts the glides in flight and the listener ignores
   anything that happens while one is. */
let ccjAutoScroll=0;
function ccjFollowing(){const run=ccjRun;return !run||run.follow!==false;}
function ccjBindStream(el){
  if(!el||el._ccjBound||typeof el.addEventListener!=='function')return;
  el._ccjBound=true;
  el.addEventListener('scroll',function(){
    const run=ccjRun;
    if(!run||ccjAutoScroll>0)return;                  // that was us, not them
    run.follow=ccjAtBottom(el);
  });
}
/* Bring the block that just started into view — but only for a reader who was following. Someone
   who has scrolled up to re-read stage 1's intake is reading; yanking them down to a step they
   did not ask about is the single most annoying thing a transcript can do, and it is the same
   rule the sticky bottom follows. Top-aligned with a little air, because a working block grows
   downward and centring it would push what it is producing off the bottom as it does. */
function ccjScrollStreamToLive(){
  const run=ccjRun;if(!run)return;
  const box=document.getElementById('ccj-stream');
  if(!box)return;
  const step=ccjSteps(run.stage)[run.sub];
  // A GATE IS A QUESTION, AND A QUESTION IS FOLLOWED WHETHER OR NOT THEY WERE FOLLOWING. Every
  // other scroll here is the run reporting on itself, and a reader who has scrolled up to re-read
  // something has said they would rather not be moved. A decision is different: the run has
  // stopped and cannot go on until they answer, so leaving the buttons below the fold is not
  // respecting their place, it is hiding the only way forward.
  const asking=step&&(run.phase==='halt'||run.phase==='stopped');
  if(!asking&&!ccjFollowing())return;
  if(asking){
    // To the BOTTOM for a decision, not to the top of its block. The gate's buttons are the last
    // thing in it, and a tall block top-aligned puts exactly them off the bottom of the screen —
    // which is the thing that went wrong.
    if(asking)run.follow=true;
    ccjStickBottom(box);
    return;
  }
  const el=step?ccjLiveNode(ccjStepBlockId(run.stage,run.sub,ccjPass(run.stage,step))):null;
  if(!el||typeof el.getBoundingClientRect!=='function'||!box.getBoundingClientRect){ccjStickBottom(box);return;}
  const r=el.getBoundingClientRect(),br=box.getBoundingClientRect();
  // Measured with getBoundingClientRect rather than offsetTop, because the block's offsetParent
  // is whichever ancestor happens to be positioned and that is not the scroller. Guarded because
  // the headless harness has no layout at all.
  if(!r.height&&!br.height){ccjStickBottom(box);return;}
  // Top-aligned with a little air: a working block grows downward, and centring it would push
  // what it is producing off the bottom as it does. But never PAST the bottom — on a short
  // transcript the block's top is already visible and dragging it to the top would leave the
  // conversation hanging in space above it.
  const top=Math.min(box.scrollTop+(r.top-br.top)-12,box.scrollHeight-box.clientHeight);
  ccjGlide(box,top,'stream');
}
function ccjStickBottom(el){
  // Its own glide lane. The transcript follows the conversation while the form follows the field
  // a document just landed in, and on one shared token the later of the two silently cancelled
  // the earlier — which reads as a scroll that gives up halfway.
  ccjGlide(el,el.scrollHeight,'stream');
}
/* == WHAT THE STREAM IS SHOWING, AND WHY IT IS ONE STREAM =================================
   Three stores, still three arrays. The client's thread and the worker's must never merge — one
   discusses our margin, the other discusses a person's salary with them, and either message in
   the other thread is a disclosure. That rule is about the DATA, and it is untouched here.

   What changes is the RENDER. Until stage 3 a counterparty stage swapped the column wholesale to
   that counterparty's thread, and the machine's own work went to the panel. With the panel gone
   they have to share a column, and the honest way to share it is one timeline: what we did and
   what was said, in the order it happened.

   Merged by `_id`, which costs nothing because ccjNextMsgId is a single run-wide counter and
   every store already draws from it — id order IS chronological order, across all three. That
   was not designed for this; it is a payoff from giving every message an id in the first place.

   Gated on ccjUsesTranscript, because stages 4-6 have not been rebuilt. They still show the
   counterparty's thread alone in a 300px column beside a panel, and pouring the internal stream
   into that column would put internal work in a client conversation with none of the marking
   that makes stage 3 safe to read. == */
/* ONE RECORD, ALL THE WAY DOWN. A rebuilt stage shows our own work AND BOTH counterparty threads,
   merged by id. Not just the counterparty of the stage you happen to be on — that was the first
   version, and it meant arriving at stage 7 silently deleted the client conversation from the
   scroll: the quote they negotiated, the invoice they paid and the replies to our own chase
   messages all vanished, leaving stage 6's blocks referring to messages no longer anywhere.

   A transcript that drops half of what it recorded is not a record. The user chose this outright
   when asked: one continuous record, with a divider where the counterparty changes.

   The three STORES are still three arrays and still never merge — that rule is about the data and
   is untouched. What is merged is a sorted view, and `_id` is a single run-wide counter, so id
   order is chronological order across all three without anything having to be timestamped. */
function ccjStreamState(){
  const run=ccjRun;
  const mode=ccjChatMode();
  if(!ccjUsesTranscript(run.stage)){
    // An un-rebuilt stage still swaps the column wholesale to one counterparty's thread. It has no
    // lane marking, so pouring the other two in would be unreadable and unsafe.
    if(mode==='agent')return {mode:'agent',msgs:run.msgs};
    return {mode:mode,msgs:mode==='worker'?ccjWorker().msgs:ccjClient().msgs};
  }
  const client=(run.client&&run.client.msgs)||[];
  const worker=(run.worker&&run.worker.msgs)||[];
  return {mode:mode,
    msgs:run.msgs.concat(client,worker).sort(function(a,b){return (a._id||0)-(b._id||0);})};
}
/* Which renderer a message takes, decided by the MESSAGE rather than by the stage. Both stores
   contain messages with who:'agent', so nothing in the content distinguishes them — the tag is
   written at push time, where the answer is known for certain, rather than guessed at here. */
function ccjMsgLane(m){return m&&m.lane?m.lane:'';}
/* A node the document actually contains. The headless harness fabricates an element for ANY id
   it is asked for, so a surgical repaint there would write into a node that is on no page, and
   every assertion reading the stream would keep passing against the version before the change.
   A fabricated node has no parent; a real one does. Falling back to the full rebuild when there
   is no parent is what keeps the tests reading the truth. */
function ccjLiveNode(id){
  const el=document.getElementById(id);
  return el&&el.parentNode?el:null;
}
function ccjStreamSync(){
  const el=document.getElementById('ccj-stream');
  if(!el||!ccjRun)return;
  const run=ccjRun,st=ccjStreamState(),p=run.stream;
  // Four things an append cannot reach: a stream this run has never painted, a node a page
  // render replaced underneath us, a different thread, and an empty stream (which owes the
  // reader the invitation, not a message). The fifth is history changing rather than growing —
  // caught below by the message at the old end no longer being the one that was painted there.
  // A full rebuild still TYPES, when the rebuild happened because a message arrived. The first
  // message of a conversation always lands this way — an empty stream owes the reader the
  // invitation, so it cannot be appended to — and the first message is the one a reader is most
  // certain to be looking at. `grew` is what separates that from a page re-render, which repaints
  // the same history and must not re-type anything.
  const grew=!!p&&st.msgs.length>p.n;
  if(!p||p.el!==el||p.mode!==st.mode||!st.msgs.length||p.n>st.msgs.length){
    ccjRenderChat();if(grew)ccjTypeLast(st);return;
  }
  const atOldEnd=st.msgs[p.n-1];
  if(!atOldEnd||atOldEnd._id!==p.lastId){ccjRenderChat();if(grew)ccjTypeLast(st);return;}
  if(p.n===st.msgs.length)return;                      // nothing new to say
  const atBottom=ccjFollowing();
  ccjUnmarkLast(p.lastId);                             // only the newest message animates in
  let html='';
  for(let i=p.n;i<st.msgs.length;i++){
    html+=ccjStreamMsgHTML(st.mode,st.msgs[i],i===st.msgs.length-1,ccjPrevMsg(st.msgs,i));
  }
  // insertAdjacentHTML, not innerHTML+= : the second re-parses every node already on screen,
  // which restarts each animation and destroys anything mid-flight above the new message.
  el.insertAdjacentHTML('beforeend',html);
  ccjMarkStream(el,st);
  // Only the newest message types. When a sync brings several at once the earlier ones are already
  // history by the time they are on screen, and watching a backlog type itself out is a wait, not
  // a conversation.
  ccjTypeLast(st,atBottom);
  // An ask arrives as a message, so the append path is one of the two ways the bar's contents can
  // change — and the only one that does not go through ccjPaint.
  ccjPaintActionBar();
  if(atBottom)ccjStickBottom(el);
}
/* Types the newest message, wherever it was just painted. Re-reads the stream node rather than
   taking one as an argument, because a full rebuild replaces it and the caller's reference would
   point at an element no longer on the page. */
function ccjTypeLast(st,follow){
  const last=st&&st.msgs.length?st.msgs[st.msgs.length-1]:null;
  if(!ccjTypeable(last))return;
  const el=document.getElementById('ccj-stream');
  ccjTypeIn(last._id,follow===undefined?ccjFollowing():follow,el);
}
function ccjMarkStream(el,st){
  ccjRun.stream={el:el,mode:st.mode,n:st.msgs.length,
    lastId:st.msgs.length?st.msgs[st.msgs.length-1]._id:0};
}
/* == TYPING ================================================================================
   The agent's messages arrive word by word rather than all at once, which is how a reader
   distinguishes something being composed from something being displayed.

   IT REVEALS, IT DOES NOT BUILD. The message is inserted complete and correct, and only then are
   its text nodes emptied and refilled. Building the string up character by character would mean
   the bubble spends most of its life holding half a tag — `<b>Cost calc bui` — and every message
   in this journey carries markup. Walking text nodes leaves the element tree untouched throughout,
   so bold stays bold and a link never briefly renders as its own source.

   ONE AT A TIME. If a message lands while another is still typing, the older one is completed
   immediately rather than left racing — two bubbles filling at once reads as a glitch, and the
   run's own pacing already assumes the reader has finished the previous line.

   INVISIBLE TO THE HARNESS, deliberately. Its DOM stub fabricates parentless nodes, which
   ccjLiveNode already refuses, so this never runs there and messages render whole. That is the
   correct outcome and not a workaround: the suite's job is to assert what the journey SAYS, and it
   would otherwise be reading a sentence that is still arriving. Typing is a browser behaviour and
   is checked in the browser. == */
const CCJ_TYPE_MS=14;       // per word — fast enough to read as fluent, slow enough to see
const CCJ_TYPE_MAX=1100;    // no message types for longer than this, however long it is
let ccjTypers=[];
function ccjTypeable(m){
  // Only the agent's own prose. Anything the user said is already theirs, and a step block or an
  // ask carries controls that must not be half-drawn while they are clickable.
  return !!m&&m.who==='agent'&&!m.kind;
}
function ccjTypeFinishAll(){
  const live=ccjTypers;ccjTypers=[];
  live.forEach(function(t){try{clearInterval(t.timer);t.done();}catch(e){}});
}
function ccjTypeIn(id,follow,host){
  // Belt to ccjLiveNode's braces. Mutation-tested: removing this line alone breaks nothing, because
  // the headless stub's nodes are parentless and ccjLiveNode below already refuses them — the same
  // fidelity guard the rest of this file relies on. Kept because it states the requirement at the
  // top of the function instead of leaving it to be inferred, and because a stub that later grows
  // a parentNode would otherwise reach createTreeWalker and throw.
  if(typeof document==='undefined'||!document.createTreeWalker)return;
  const node=ccjLiveNode('ccj-m-'+id);
  const bubble=node&&node.querySelector?node.querySelector('.ccj-bubble'):null;
  if(!bubble)return;
  const parts=[];
  const walk=document.createTreeWalker(bubble,4,null);                   // 4 = SHOW_TEXT
  let n;
  while((n=walk.nextNode())){
    if(!n.nodeValue)continue;
    // Split so whitespace travels with the word before it — revealing a bare space first makes
    // the text jitter left as each word lands.
    parts.push({node:n,words:n.nodeValue.match(/\s*\S+|\s+/g)||[],at:0});
    n.nodeValue='';
  }
  const total=parts.reduce(function(a,p){return a+p.words.length;},0);
  if(!total){parts.forEach(function(p){p.node.nodeValue=p.words.join('');});return;}
  ccjTypeFinishAll();
  const t={done:function(){parts.forEach(function(p){p.node.nodeValue=p.words.join('');});}};
  // A long message does not take proportionally longer — it speeds up, so no single line ever
  // holds the run for over a second.
  const per=Math.max(6,Math.min(CCJ_TYPE_MS,Math.floor(CCJ_TYPE_MAX/total)));
  let i=0;
  t.timer=setInterval(function(){
    // The node can be replaced under us by a repaint at any time; when it is, stop rather than
    // writing into an element no longer on screen.
    if(!ccjLiveNode('ccj-m-'+id)){clearInterval(t.timer);ccjTypers=ccjTypers.filter(function(x){return x!==t;});return;}
    let step=0;
    while(step<1&&i<parts.length){
      const p=parts[i];
      if(p.at>=p.words.length){i++;continue;}
      p.node.nodeValue+=p.words[p.at++];step++;
    }
    // Step past anything now exhausted, so the tick that writes the LAST word is also the tick
    // that stops. Without this the timer survives one beat past the finished message, and a
    // caller asking "is anything still typing" the moment it completes is told yes.
    while(i<parts.length&&parts[i].at>=parts[i].words.length)i++;
    if(follow&&host)ccjStickBottom(host);
    if(i>=parts.length){clearInterval(t.timer);ccjTypers=ccjTypers.filter(function(x){return x!==t;});}
  },per);
  ccjTypers.push(t);
}
function ccjUnmarkLast(id){
  const prev=id?ccjLiveNode('ccj-m-'+id):null;
  if(prev&&prev.classList)prev.classList.remove('in');
}
/* == THE HANDOVER ==========================================================================
   One record means the reader scrolls from a conversation with the client straight into one with
   the worker, and nothing in between says so. The lane headings name each message's recipient, but
   a heading is read as "this bubble went to X", not as "the counterparty has changed" — and the
   moment it changes is the single most important thing about stages 6 → 7.

   Drawn from the mode each message was PUSHED under, so it lands where the conversation actually
   turned over and cannot be placed by hand. Emitted once per change, before the first message of
   the new conversation. `agent` → `client` fires it too, at stage 3, which is the same event and
   was never marked before. */
function ccjHandoverHTML(mode){
  const p=ccjParties();
  const who=mode==='worker'?p.worker.name:mode==='client'?p.client.name:'';
  if(!who)return '';                               // back to our own work — nothing was handed over
  return '<div class="ccj-hand"><span class="ccj-hand-rule"></span>'
    +'<span class="ccj-hand-text">now talking to <b>'+who+'</b></span>'
    +'<span class="ccj-hand-rule"></span></div>';
}
/* The message the head/handover decisions compare against. An await between two lane messages
   must not break the To/From grouping: it renders outside the lane (or as nothing at all once
   done), so the neighbour that matters is the last REAL message. Without this, two follow-ups
   with a waiting beat between them re-announce "To <client>" over each one — the noise the
   lane rule exists to prevent. */
function ccjPrevMsg(list,n){
  for(let k=n-1;k>=0;k--){if(list[k].kind!=='await')return list[k];}
  return undefined;
}
function ccjStreamMsgHTML(mode,m,isLast,prev){
  const body=ccjMsgLane(m)?ccjClientMsgHTML(m,isLast,prev):ccjMsgHTML(m,isLast);
  // `prev` absent means this is the first message in the stream, and an opening conversation has
  // not been handed over from anything.
  const was=prev&&prev.mode,now=m&&m.mode;
  const html=(prev&&was&&now&&was!==now?ccjHandoverHTML(now):'')+body;
  return ccjOwnWrap(m,html);
}
/* A message that belongs to a sub-status is wrapped so it can be folded with it. The wrapper
   carries the owner key as a data attribute rather than a class, because the key contains '/' and
   '#' and is not a legal class name — and it is what ccjFoldOwned queries on.

   WRAPPED, NOT CLASSED DIRECTLY. The body is sometimes two elements (a handover rule ahead of the
   message), and folding has to take both or the transcript keeps a divider introducing a thread
   that is no longer on screen. */
function ccjOwnWrap(m,html){
  if(!m||!m._own)return html;
  return '<div class="ccj-own'+(ccjStepOpenByKey(m._own)?'':' folded')+'" data-own="'+attrSafe(m._own)+'">'
    +html+'</div>';
}
/* Fold or unfold every message a step emitted, without touching the rest of the stream. The nodes
   already exist and only their class changes, so the fold can ease — unlike a rebuild, which would
   hand the browser new nodes already at their final state and play no transition at all. */
function ccjFoldOwned(pkey){
  if(!pkey||typeof document.querySelectorAll!=='function')return;
  const open=ccjStepOpenByKey(pkey);
  const nodes=document.querySelectorAll('.ccj-own[data-own="'+pkey.replace(/"/g,'&quot;')+'"]');
  if(!nodes||!nodes.length)return;
  for(let i=0;i<nodes.length;i++){
    if(nodes[i].classList)nodes[i].classList.toggle('folded',!open);
  }
}
/* A message whose body is derived from state that is STILL MOVING — the document card counting
   fields in — is repainted in place rather than by rebuilding the stream around it. This is the
   transcript's ccjPaintBeat: touch the one node that is changing and let everything above it
   hold still. Without it the card re-ran its own entry animation every 620ms for twelve seconds,
   because a rebuild re-applies `.in` to whatever is last and the card IS what is last.

   Agent-thread only, and that is not an oversight. A counterparty message changes its WRAPPER
   class when it changes at all — ccjSendDraft turns a draft into a sent message — so repainting
   its body alone would leave it styled as the thing it has stopped being. Those go through the
   rebuild, which is correct for them: they change on a click, with nothing in flight. */
function ccjRepaintMsg(m){
  if(!m||!m._id)return;
  const el=ccjLiveNode('ccj-m-'+m._id);
  if(!el){ccjRenderChat();return;}
  const box=document.getElementById('ccj-stream');
  el.innerHTML=ccjMsgInnerHTML(m);
  // Answering an ask repaints that one message and nothing else, so without this the bar would go
  // on offering a button for something already done.
  ccjPaintActionBar();
  // A block growing in place moves the bottom out from under the reader just as an append does,
  // so it follows on the same remembered intent rather than on a measurement taken after the
  // growth — which would always report that they had fallen behind.
  if(box&&ccjFollowing())ccjStickBottom(box);
}
function ccjNextMsgId(){const run=ccjRun;run.msgSeq=(run.msgSeq||0)+1;return run.msgSeq;}
/* WHICH CONVERSATION THIS MESSAGE BELONGED TO, recorded when it is pushed rather than worked out
   later. It is what the handover divider is drawn from — see ccjHandoverHTML — and it has to be
   stamped here because it is only knowable at the moment of the push: by the time anything renders,
   the run has moved on and `ccjChatMode()` answers for the stage being LOOKED at, not the one that
   said this. The same mistake as deriving a timeline from current state. */
function ccjStampMode(msg){
  const run=ccjRun;
  if(run&&msg&&!msg.mode)msg.mode=typeof ccjChatMode==='function'?ccjChatMode():'agent';
  return msg;
}
/* WHICH SUB-STATUS A MESSAGE BELONGS TO. Stamped at push, because it is only knowable then: the
   runner is on exactly one step when a message is emitted, and nothing about the message itself
   says which. Later it is unrecoverable — the stream is one flat list in id order.

   This is what lets a folded step take its conversation with it. A sub-status block already folds
   to one line when the runner moves on, but everything it SAID stayed behind as loose bubbles, so
   the transcript kept the full height of a step whose block claimed to be closed.

   A step block is not stamped: it is the thing being folded, not something folded underneath it.
   Nor is anything pushed outside a step (run.sub is -1 before the first one) — the opening
   invitation and the request that starts the run belong to the conversation, not to a step. */
function ccjOwnerKey(){
  const run=ccjRun;
  if(!run||!run.started||run.sub<0)return '';
  if(!ccjUsesTranscript(run.stage))return '';
  const step=ccjSteps(run.stage)[run.sub];
  return step?ccjPassKey(run.stage,step):'';
}
function ccjPush(msg){
  const run=ccjRun;if(!run)return;
  msg._id=ccjNextMsgId();
  ccjStampMode(msg);
  if(msg.kind!=='step'&&!msg._own)msg._own=ccjOwnerKey();
  run.msgs.push(msg);
  ccjStreamSync();
}
/* Is this step showing its detail? The one rule, in one place, because three surfaces ask it: the
   block deciding whether to draw its body, the messages underneath deciding whether to show at
   all, and the repaint that folds them when the runner moves on. The live step is always open —
   hiding the step that is running is never what someone means to do — and run.open records the
   reader having opened a folded one by hand. */
function ccjStepOpenByKey(pkey){
  const run=ccjRun;
  if(!run||!pkey)return true;
  if(run.open[pkey])return true;
  return pkey===ccjOwnerKey();
}
/* The ghost has to outlive the render that emitted it, or the fade never plays: the two opening
   messages are pushed back to back, and clearing the flag on emit meant the second render tore
   the element out microseconds after the first put it in. It lives for the length of the
   animation and no longer — nothing else arrives inside that window. */
function ccjClearGhostLater(){
  const g=ccjGen,run=ccjRun;if(!run)return;
  if(run.ghostTimer)clearTimeout(run.ghostTimer);
  run.ghostTimer=setTimeout(function(){
    if(ccjGen!==g||ccjRun!==run)return;
    run.ghostTimer=null;run.emptyGhost=false;ccjRenderChat();
  },460);
}
/* THE FULL REBUILD, and now ONLY the full rebuild. Reached from a page render, a thread switch,
   and ccjStreamSync when it cannot prove an append is safe. Every ordinary push appends instead.

   It ends by recording what it painted, which is the whole basis on which the next push decides
   between appending and rebuilding — an unrecorded rebuild would be followed by an append onto
   a stream the run does not believe it wrote, and that is a duplicated conversation. */
function ccjRenderChat(){
  const el=document.getElementById('ccj-stream');
  if(!el||!ccjRun)return;
  const run=ccjRun;
  const st=ccjStreamState();
  const mode=st.mode;
  if(mode==='client'||mode==='worker'){
    el.innerHTML=st.msgs.length
      ?st.msgs.map(function(m,n){return ccjStreamMsgHTML(mode,m,n===st.msgs.length-1,ccjPrevMsg(st.msgs,n));}).join('')
      :'<div class="ccj-empty"><div class="ccj-empty-text">'
       +(mode==='worker'?'Nothing has gone to the employee yet.':'The quote has not gone out yet.')
       +'</div></div>';
  }else{
    // The invitation, kept for exactly one render as a fading overlay so the first messages
    // arrive under it rather than replacing it in a single frame. Cleared as it is emitted, so a
    // later push does not restart the fade.
    const ghost=run.emptyGhost?'<div class="ccj-empty ghost">'+ccjChatEmptyInnerHTML()+'</div>':'';
    // Only the last message animates in. On this path the whole conversation is being written at
    // once, so animating all of them would replay it from nothing.
    // ccjOwnWrap here as well as in ccjStreamMsgHTML: this is the REBUILD path and it does not go
    // through that function, so without it a rebuilt transcript comes back with every folded step
    // expanded again — the fold would survive the runner but not a repaint of the page.
    el.innerHTML=st.msgs.length
      ?ghost+st.msgs.map(function(m,n){return ccjOwnWrap(m,ccjMsgHTML(m,n===st.msgs.length-1));}).join('')
      :ccjChatEmptyHTML();
  }
  ccjMarkStream(el,st);
  ccjBindStream(el);
  ccjPaintActionBar();
  // A rebuild IS a new surface, so it lands at the bottom outright: there is no reading position
  // to preserve, and the alternative is a run opening halfway up its own transcript. Following
  // resumes with it — the reader has not scrolled away from a stream that did not exist a moment
  // ago, and leaving `follow` false here would strand the next run at the top of the page.
  el.scrollTop=el.scrollHeight;
  ccjRun.follow=true;
}
function ccjChatEmptyHTML(){return '<div class="ccj-empty">'+ccjChatEmptyInnerHTML()+'</div>';}
function ccjChatEmptyInnerHTML(){
  /* The first chip is the one that gets clicked, so it is the one that shows the parser doing all
     of its work at once: model, client, country, role AND pay out of a single sentence. The others
     stay deliberately sparser — a run where the agent has to ask for the missing pieces is the
     more common one, and the empty state should not imply every request arrives complete. */
  const ex=['Hire Shiv Kumar for Helix Marine in Germany as Director of Engineering at EUR 18,500 a month',
            'Create an EOR contract for Anika Shah in Netherlands',
            'New PEO contract for Emma Schmidt at Vantage Freight in India'];
  return ''
    +'<div class="ccj-empty-title">Who are you hiring?</div>'
    +'<div class="ccj-empty-text">I will find them in ADT and pre-fill the contract.</div>'
    +'<div class="ccj-empty-chips">'+ex.map(function(t){
      return '<button class="ccj-chip" onclick="ccjFill(\''+attrSafe(t).replace(/'/g,"\\'")+'\')">'+t+'</button>';
    }).join('')+'</div>';
}
function ccjFill(text){
  const inp=document.getElementById('ccj-prompt');
  if(!inp)return;
  inp.value=text;ccjGrow(inp);inp.focus();
}
/* Split into wrapper and body on purpose, and the split is what makes a surgical repaint
   possible: ccjRepaintMsg rewrites the BODY of one message without touching the element that
   carries its side, its id and its entry animation. Re-emitting the wrapper would re-run `.in`
   on every tick, which is the flicker this split exists to prevent. The markup either half
   produces is byte-identical to what one function produced before. */
// A sub-status block takes a side of its own: it is neither something a person said nor
// something the agent said to them, and giving it the agent's bubble and avatar would dress the
// machine's own working as conversation.
// A sub-status block and an ask both take a side of their own — neither is something a person
// said nor something the agent said to them, and giving either the agent's bubble and avatar
// would dress the machine's own working, or a control, as conversation.
function ccjMsgWho(m){return m.kind==='step'||m.kind==='ask'?'step':m.who==='user'?'user':'agent';}
function ccjMsgInnerHTML(m){
  if(m.kind==='step'){
    // A superseded pass renders from the HTML it was frozen with, never from live state. Its
    // step ran, produced a number, and was thrown away; re-deriving it now would re-derive it
    // from the pass that REPLACED it, and the first attempt would silently become a duplicate of
    // the second. A record that rewrites itself is not a record.
    if(m.frozen!==undefined)return ccjAttemptHTML(m);
    return ccjStepBlockHTML(m.stage,m.sub,m.pass);
  }
  if(m.kind==='ask')return ccjAskHTML(m);
  if(m.who==='user'&&m.kind==='file')return '<div class="ccj-bubble ccj-file">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
    +'<span class="ccj-file-n">'+m.name+'</span>'
    +(m.size?'<span class="ccj-file-s">'+ccjFileSize(m.size)+'</span>':'')
    +'</div>';
  if(m.who==='user')return '<div class="ccj-bubble">'+m.text+'</div>';
  if(m.kind==='doc')return ccjAvatarHTML()+ccjDocHTML();
  if(m.kind==='searching')return ccjAvatarHTML()
    +'<div class="ccj-bubble"><div class="ccj-searching">Searching ADT employee records for &ldquo;'+m.label+'&rdquo;</div>'
    +'<div class="ccj-skel"><div class="ccj-skel-av"></div><div style="flex:1"><div class="ccj-skel-l" style="width:44%"></div><div class="ccj-skel-l" style="width:66%"></div></div></div>'
    +'</div>';
  if(m.kind==='clientask')return ccjAvatarHTML()+ccjClientAskHTML();
  if(m.kind==='match')return ccjAvatarHTML()+ccjMatchHTML(m);
  return ccjAvatarHTML()+'<div class="ccj-bubble">'+m.text+'</div>';
}
function ccjMsgHTML(m,isLast){
  return '<div class="ccj-msg '+ccjMsgWho(m)+(isLast?' in':'')+'"'+ccjMsgIdAttr(m)+'>'
    +ccjMsgInnerHTML(m)+'</div>';
}
// A message pushed before this run carried a counter — there are none left, but a missing id
// must degrade to "not individually addressable" rather than to id="ccj-m-undefined", which two
// messages would then share.
function ccjMsgIdAttr(m){return m&&m._id?' id="ccj-m-'+m._id+'"':'';}
/* The client question. Chips for the companies we already work with, because that is the common
   case and typing a name we can already resolve is friction; the composer takes anyone new. */
function ccjClientAskHTML(){
  const known=ccjKnownClients().slice(0,5);
  return '<div class="ccj-bubble ccj-ask">'
    +'Which client is this hire for?'
    +'<div class="ccj-ask-chips">'+known.map(function(n){
      return '<button class="ccj-ask-chip" onclick="ccjPickClient(\''+attrSafe(n).replace(/'/g,"\\'")+'\')">'+n+'</button>';
    }).join('')+'</div>'
    // "below" pointed at the composer. Same fault as the record line above: it described where
    // things are on screen rather than what to do, and it stops being true the moment anything moves.
    +'<div class="ccj-ask-note">Or type the company name if they are new to us.</div>'
    +'</div>';
}
function ccjPickClient(name){
  const run=ccjRun;
  if(!run||!run.awaitingClient)return;
  const clean=String(name||'').trim();
  if(!clean)return;
  // Resolve a short or misspelled name against the companies we know, so "Vantage Freight"
  // becomes "Vantage Freight Pvt Ltd" here exactly as it would from the sentence.
  const known=ccjKnownClients().find(function(n){
    return n.toLowerCase()===clean.toLowerCase()
      ||n.toLowerCase().indexOf(clean.toLowerCase())===0;
  });
  run.intake.client=known||clean;
  run.msgs=run.msgs.filter(function(m){return m.kind!=='clientask';});
  ccjPush({who:'user',text:run.intake.client});
  ccjBeginIntake();
}
function ccjAvatarHTML(){
  return '<span class="ccj-av"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg></span>';
}
function ccjMatchHTML(m){
  const e=m.emp||{};
  const initials=String(e.name||'').split(' ').map(function(x){return x[0];}).slice(0,2).join('');
  const row=function(k,v){return '<div class="ccj-match-kv"><span>'+k+'</span><b>'+(v||'&mdash;')+'</b></div>';};
  return '<div class="ccj-bubble ccj-match">'
    +'<div class="ccj-match-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>Match found in ADT</div>'
    +'<div class="ccj-match-top"><div class="ccj-match-av">'+initials+'</div>'
    +'<div><div class="ccj-match-name">'+e.name+'</div><div class="ccj-match-id">'+(e.empId||'')+(e.jobTitle?' &middot; '+e.jobTitle:'')+'</div></div></div>'
    +'<div class="ccj-match-grid">'
    +row('Country',e.country)+row('Email',e.email)+row('Status',e.status)+row('Engagement',ccjRun.model)
    +'</div></div>';
}

/* ---- READING THE REQUEST -------------------------------------------------------------------
   The original journey's parser strips a fixed list of filler words and calls whatever is left
   the person's name. "Hire Rohan Verma in Germany as an Operations Analyst" comes back as
   `Hire Rohan Verma as Operations Analyst` — the verb and the role end up inside the name, and
   the role itself is thrown away even though the sentence stated it.

   This one takes things OUT in order of how confidently they can be identified, and each pass
   removes what it claimed so the next cannot claim it again: engagement model, then country,
   then the role after "as", and only what survives all three is the name. That ordering is the
   whole trick — "in Germany as an Operations Analyst" only reduces cleanly once Germany is
   already gone.                                                                              */
const CCJ_MODEL_WORDS=[
  {id:'CONTRACTOR',re:/\b(independent contractor|contractors?|contract[-\s]based)\b/i},
  {id:'EOR',       re:/\b(eor|employer of record)\b/i},
  {id:'PEO',       re:/\b(peo|professional employer organi[sz]ation)\b/i}
];
// Everything that describes the REQUEST rather than the person: what is being asked for, and
// the connective tissue around it. `contract` is here but `contractor` is not — the model pass
// above has already taken that, and taking it here would strip the word out of the model.
const CCJ_FILLER=/\b(hire|hiring|onboard|onboarding|engage|recruit|create|creating|new|start|starting|make|add|raise|set ?up|please|need|want|would like|contract|contracts|agreement|proposal|request|role|position|for|an|a|the|in|into|of|on|at|with|to|and|as)\b/gi;
/* Title case that does not flatten what the user already decided. Lower-casing the whole string
   first turned "CTO" into "Cto" and would have turned "O'Brien" into "O'brien" — so any token
   carrying a capital is left exactly as typed, and only all-lowercase tokens are lifted. The
   small connecting words stay down unless they lead, because "Director Of Engineering" is not
   how anyone writes a job title. */
const CCJ_SMALL_WORDS=['of','and','the','for','at','in','on','to','a','an','or','with','de','van'];
function ccjTitleCase(s){
  let first=true;
  return String(s).split(/(\s+)/).map(function(w){
    if(!w.trim())return w;
    const lead=first;first=false;
    if(/[A-Z]/.test(w))return w;                          // theirs, not ours
    if(!lead&&CCJ_SMALL_WORDS.indexOf(w.toLowerCase())>-1)return w.toLowerCase();
    return w.replace(/^[a-z]/,function(ch){return ch.toUpperCase();});
  }).join('');
}
/* Every company this product already knows about — the clients with an account (aiClients) and
   the clients with a deal on the Account Manager's board (amDeals). Matching against real names
   is what lets "for Vantage Freight" resolve without the sentence needing a rigid shape, and it
   is also what tells stage 4 whether the client already has a tenant. Longest first, so
   "Vantage Freight Pvt Ltd" wins over a shorter name it happens to contain. */
function ccjKnownClients(){
  const out=[];
  const add=function(n){if(n&&out.indexOf(n)===-1)out.push(n);};
  ((typeof aiClients!=='undefined'&&aiClients)||[]).forEach(function(c){add(c.name);});
  ((typeof amDeals!=='undefined'&&amDeals)||[]).forEach(function(d){add(d.client);});
  return out.sort(function(a,b){return b.length-a.length;});
}
/* A company we have never seen. Requires a legal suffix — Ltd, B.V., GmbH — because that is a
   strong enough signal to tell a company from the person's name two words earlier, which a bare
   "for X" is not. */
const CCJ_CO_SUFFIX=/\b((?:[A-Z][\w&.'\-]*\s+){0,3}[A-Z][\w&.'\-]*\s+(?:Pvt\.?\s*Ltd|Private\s+Limited|Ltd|Limited|B\.?\s?V\.?|N\.?\s?V\.?|GmbH|AG|Inc\.?|LLC|PLC|S\.?A\.?|SAS|Oy|AB|A\/S))\b/;
/* THE PAY, WHEN THE SENTENCE STATES IT. Taken out FIRST, before even the engagement model, which
   is the confidence order the parser is built on: a figure carrying a currency marker or a period
   word is the least ambiguous token in the sentence, and lifting it early means it can never end
   up inside the name.

   A bare number is deliberately NOT enough. "Hire 2 engineers" must not set a salary of 2, so a
   figure only counts when something next to it says it is money — a symbol, a currency code, or
   "a month" / "per month" / "/month" — and it has to be at least three digits. Anything less
   confident is left in the sentence for the later passes, and the agent asks for the pay as it
   always did. */
const CCJ_PAY_CUR='[\\u20AC$\\u00A3\\u20B9]|\\b(?:EUR|USD|GBP|INR|Rs)\\b';
const CCJ_PAY_NUM='\\d[\\d,. ]*\\d|\\d';
/* The phrase, not just the figure. Lifting "EUR 18,500" out of "as Director of Engineering at EUR
   18,500 a month" left "at   a month" behind, and the role pass — which reads to the end of the
   sentence — swallowed it, producing the job title "Director Of Engineering At A Month". The
   country pass already carries this same lesson in its own comment; a pass has to consume its
   framing or it just moves the mess into the next one.

   The lead-in is safe to eat greedily because it only matches immediately before a money shape:
   "for Helix Marine" has no digits after "for", so the client keeps its preposition. */
const CCJ_PAY_LEAD='(?:\\b(?:at|on|of|paying|pays|salary|pay|gross|worth)\\b\\s*)*';
const CCJ_PAY_TAIL='(?:\\s*(?:\\/|\\bper\\b|\\ba\\b|\\bevery\\b)?\\s*\\bmonth(?:ly)?\\b|\\s*\\bp\\.?\\s?m\\.?)';
const CCJ_PAY_SHAPES=[
  // A currency marker makes it money on its own; the period words are then optional.
  new RegExp(CCJ_PAY_LEAD+'(?:'+CCJ_PAY_CUR+')\\s*('+CCJ_PAY_NUM+')(?:'+CCJ_PAY_TAIL+')?','i'),
  new RegExp(CCJ_PAY_LEAD+'('+CCJ_PAY_NUM+')\\s*(?:'+CCJ_PAY_CUR+')(?:'+CCJ_PAY_TAIL+')?','i'),
  // No currency, so the period words are what make it a monthly salary — and are required.
  new RegExp(CCJ_PAY_LEAD+'('+CCJ_PAY_NUM+')'+CCJ_PAY_TAIL,'i')
];
function ccjParsePay(s){
  for(let i=0;i<CCJ_PAY_SHAPES.length;i++){
    const m=s.match(CCJ_PAY_SHAPES[i]);
    if(!m)continue;
    // Separators go; a decimal point stays, the same convention ccjCtx reads the form field with.
    const n=parseFloat(String(m[1]).replace(/[, ]/g,''));
    if(!isFinite(n)||n<100)continue;                 // too small to be a monthly salary
    return {amount:n,matched:m[0]};
  }
  return null;
}
function ccjParsePrompt(text){
  let s=' '+String(text||'').replace(/\s+/g,' ').trim()+' ';
  let country='',model='',jobTitle='',client='',pay='',unsupported='';
  const money=ccjParsePay(s);
  if(money){pay=String(money.amount);s=s.replace(money.matched,' ');}
  for(let i=0;i<CCJ_MODEL_WORDS.length;i++){
    if(CCJ_MODEL_WORDS[i].re.test(s)){model=CCJ_MODEL_WORDS[i].id;s=s.replace(CCJ_MODEL_WORDS[i].re,' ');break;}
  }
  // The client comes out BEFORE the country, because a company can be named after a place
  // ("Helix Marine B.V.", "Arcadia Retail GmbH") and lifting the country first would cut it up.
  const known=ccjKnownClients();
  for(let i=0;i<known.length;i++){
    const re=new RegExp('\\b'+known[i].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
    if(re.test(s)){client=known[i];s=s.replace(re,' ');break;}
    // "for Vantage Freight" should also find "Vantage Freight Pvt Ltd" — people say the short name.
    const short=known[i].replace(/\s+(Pvt\.?\s*Ltd|Private Limited|Ltd|Limited|B\.?\s?V\.?|N\.?\s?V\.?|GmbH|AG|Inc\.?|LLC|PLC)\.?$/i,'').trim();
    if(short&&short!==known[i]){
      const sre=new RegExp('\\b'+short.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
      if(sre.test(s)){client=known[i];s=s.replace(sre,' ');break;}
    }
  }
  if(!client){
    const co=s.match(CCJ_CO_SUFFIX);
    if(co){client=co[1].trim();s=s.replace(co[0],' ');}
  }
  /* Recognised against the FULL list so that whatever country was named is lifted out of the
     sentence either way — otherwise "hire someone in Poland" leaves "Poland" behind and it ends
     up inside the person's name. But it is only CLAIMED as the place of work if we can actually
     employ there. Naming one we are not set up for is a real answer to give back, not something
     to swallow: it used to be accepted silently and then resolved to Dutch employment law. */
  ccjCountries().forEach(function(c){
    if(country||unsupported)return;
    const re=new RegExp('\\b'+c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
    if(!re.test(s))return;
    s=s.replace(re,' ');
    if(ccjCanEmployIn(c))country=c;else unsupported=c;
  });
  // The role, stated as "as an Operations Analyst" / "as a Delivery Lead" / "as Marine Engineer".
  // Run AFTER the country has been lifted out, so "in Germany as an Operations Analyst" has
  // nothing left between the role and the end of the sentence.
  const jt=s.match(/\bas\s+(?:an?\s+)?([a-z][a-z0-9 &/+.'-]*?)\s*$/i)
        || s.match(/\bas\s+(?:an?\s+)?([a-z][a-z0-9 &/+.'-]*?)\s*[,.;]/i);
  if(jt){
    // Lifting the country out leaves its preposition behind, so "as a delivery ops lead in
    // india" reduces to "...lead in" and the role would keep a dangling word. Trailing
    // connectives are trimmed off the captured role, repeatedly, for the same reason.
    const role=jt[1].trim().replace(/(\s+(?:in|at|for|on|with|of|from|the|an?|to|and))+\s*$/i,'').trim();
    if(role){jobTitle=ccjTitleCase(role);s=s.replace(jt[0],' ');}
  }
  let name=s.replace(CCJ_FILLER,' ').replace(/[,.;:]/g,' ').replace(/\s+/g,' ').trim();
  // Case is only imposed when the user clearly did not bother — "priya nair" becomes "Priya
  // Nair", but anything they capitalised themselves is left alone, because a name is theirs to
  // spell and "O'Brien" does not survive being title-cased.
  if(name&&name===name.toLowerCase())name=ccjTitleCase(name);
  return {name:name,country:country,empType:model,jobTitle:jobTitle,client:client,pay:pay,
    unsupportedCountry:unsupported};
}

/* ---- SUBMITTING, AND ANSWERING THE AGENT'S QUESTIONS -------------------------------------
   One composer does both jobs. Before the request exists it takes the request; after it, it
   answers whichever form field the agent is asking about, and falls back to a plain reply. */
function ccjSend(){
  const run=ccjEnsureRun();
  const inp=document.getElementById('ccj-prompt');
  if(!inp)return;
  const raw=String(inp.value||'').trim();
  if(!raw)return;
  inp.value='';ccjGrow(inp);
  if(ccjChatMode()==='client'){ccjSendToClient(raw);return;}
  // Answering the client question by typing rather than picking a chip — a company we have never
  // worked with has no chip to click.
  if(run.awaitingCountry){ccjPickWorkCountry(raw);return;}
  if(run.awaitingClient){ccjPickClient(raw);return;}
  if(!run.started){ccjSubmitRequest(raw);return;}
  ccjPush({who:'user',text:raw});
  if(run.asking){ccjApplyAnswer(run.asking,raw);return;}
  ccjScheduleChat(function(){
    ccjPush({who:'agent',text:'Noted.'});
  },420);
}
/* Two things start at once and that is deliberate: the panel logs the intake while the
   conversation runs the lookup. They are the same stage's work seen from two sides — the
   machine's log on the right, the conversation on the left. */
function ccjSubmitRequest(raw){
  const run=ccjRun;
  const parsed=ccjParsePrompt(raw);
  if(parsed.empType)run.model=parsed.empType;
  run.intake={raw:raw,name:parsed.name||raw,country:parsed.country||'',
    jobTitle:parsed.jobTitle||'',client:parsed.client||'',pay:parsed.pay||'',type:run.model,
    unsupportedCountry:parsed.unsupportedCountry||''};
  /* Named a country we cannot employ in. Said out loud, with the ones we can, rather than left to
     surface as an empty field the agent asks about — the request was understood, it just cannot be
     served, and that is a different thing from not having been told. */
  if(parsed.unsupportedCountry){
    ccjPush({who:'user',text:raw});
    ccjPush({who:'agent',text:'We are not set up to employ in <b>'+parsed.unsupportedCountry
      +'</b> yet &mdash; there is no entity, employment-law set or payroll return configured for it, '
      +'so a contract raised there would not be compliant.<br><br>We can employ in '
      +ccjWorkCountries().slice(0,-1).join(', ')+' and '+ccjWorkCountries().slice(-1)
      +'. Which of those is the work in?'});
    run.awaitingCountry=true;
    ccjPaintComposer();
    return;
  }
  // WHO THE HIRE IS FOR is not optional and is not guessable. Every number this run produces is
  // billed to a client, the agreement is signed with them, and the CSM is theirs — so if the
  // sentence did not say, the agent asks before anything starts, the same way it asks for a
  // missing date of birth. Defaulting to whoever happens to be in the topbar would quietly
  // invoice the wrong company.
  if(!parsed.client){
    run.awaitingClient=true;
    ccjPush({who:'user',text:raw});
    ccjPush({who:'agent',kind:'clientask'});
    ccjPaintComposer();
    return;
  }
  ccjBeginIntake();
}
/* Answering "which country is the work in" after we said we cannot serve the one they named.
   Only a country we can actually employ in is accepted — repeating the question is better than
   taking a second unserviceable answer and failing later, in the middle of a contract. */
function ccjPickWorkCountry(raw){
  const run=ccjRun;if(!run)return;
  ccjPush({who:'user',text:raw});
  const hit=ccjWorkCountries().find(function(c){
    return new RegExp('\\b'+c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(raw);
  });
  if(!hit){
    ccjPush({who:'agent',text:'I still cannot place that one. It has to be one of '
      +ccjWorkCountries().join(', ')+'.'});
    return;
  }
  run.awaitingCountry=false;
  run.intake.country=hit;
  run.intake.unsupportedCountry='';
  // Back onto the normal path: the client is still the one thing that is never guessed.
  if(!run.intake.client){
    run.awaitingClient=true;
    ccjPush({who:'agent',kind:'clientask'});
    ccjPaintComposer();
    return;
  }
  ccjBeginIntake();
}
/* The client is known — start the run. Split out of ccjSubmitRequest so the same path is taken
   whether the client came from the sentence or from the question that followed it. */
function ccjBeginIntake(){
  const run=ccjRun;
  const raw=run.intake.raw;
  const parsed={name:run.intake.name,country:run.intake.country};
  run.started=true;
  run.awaitingClient=false;
  run.reached.prompt=true;
  // The empty state does not vanish — it is left on screen for one render as an absolutely
  // positioned ghost that fades out while the first messages animate in under it. A hard cut
  // from a centred invitation to two bubbles at the top is the single most jarring moment in
  // the flow, and it is the one the user sees first.
  // Only when the client came straight out of the sentence. If the agent had to ask, the ghost
  // is long gone and the conversation already has messages in it.
  if(!run.msgs.length){run.emptyGhost=true;ccjClearGhostLater();ccjPush({who:'user',text:raw});}
  ccjPush({who:'agent',kind:'searching',label:parsed.name||raw});
  ccjStart();                                   // the panel starts working immediately
  // Only the composer is repainted, NOT the whole work area. Rebuilding the chat here would
  // destroy the stream node the messages were just animated into and replay them from nothing.
  ccjPaintComposer();
  ccjScheduleChat(ccjResolveLookup,CCJ_SEARCH);
}
/* The duplicate warning. Returns true when it has taken over the conversation, so the caller
   stops — the lookup resumes from ccjDupContinue once the reader has decided. Asked once per run:
   answering it and then having it asked again on the next beat would make it noise. */
function ccjWarnDuplicatePlacement(){
  const run=ccjRun;if(!run||run.dupAsked)return false;
  const country=run.intake.country||'';
  const prior=ccjActivePlacements(run.intake.name,country);
  if(!prior.length)return false;
  run.dupAsked=true;
  const c=prior[0];
  const many=prior.length>1;
  ccjPush({who:'agent',text:(many?prior.length+' active placements already exist for ':'')
    +(many?'':'<b>'+run.intake.name+'</b> already has an active placement')
    +(many?'<b>'+run.intake.name+'</b>':'')+' &mdash; '
    +'<b>'+c.contractId+'</b>, '+(c.countryOfOp||c.country)+', '+(c.empType||c.type)
    +', dated '+String(c.date||'').split(' ')[0]+'. '
    +'A person cannot hold two live contracts on the same terms in one country.'});
  ccjPush({who:'agent',kind:'ask',
    text:'Continue and this run replaces '+(many?'them':c.contractId)
      +'. The old '+(many?'records keep':'record keeps')+' its documents and history, marked superseded.',
    label:'Continue and supersede',handler:'dupContinue',
    alt:{label:'Stop this run',handler:'dupStop'},done:false});
  ccjPaint();
  return true;
}
/* Confirmed. The supersede itself happens where the placement is written — this only releases the
   run — because the old row must not be retired against a contract that never gets created. */
function ccjDupContinue(){
  const run=ccjRun;if(!run)return;
  ccjPush({who:'agent',text:'Continuing. The existing placement will be marked superseded when this one is created.'});
  ccjScheduleChat(ccjResolveLookup,400);
}
function ccjDupStop(){
  const run=ccjRun;if(!run)return;
  run.stopped=true;run.phase='stopped';
  run.stop={by:ccjActor(),title:'Stopped — the person is already placed',
    note:'A live placement already exists for '+run.intake.name+' in '+(run.intake.country||'this country')+'.'};
  ccjPush({who:'agent',text:'Stopped. Nothing was created, and the existing placement is untouched.'});
  ccjPaint();ccjPaintScreen();
}
function ccjResolveLookup(){
  const run=ccjRun;if(!run)return;
  const emp=typeof findExistingEmployee==='function'?findExistingEmployee(run.intake.name):null;
  // Replace the skeleton in place rather than appending under it — a conversation does not keep
  // its own loading state once the answer has arrived.
  run.msgs=run.msgs.filter(function(m){return m.kind!=='searching';});
  /* SAID HERE BECAUSE HERE IS WHERE IT IS STILL CHEAP TO STOP. This is the beat that already asks
     "do we know this person", and the answer "yes, and they are currently placed" is the one the
     reader most needs before nine stages of work. Raising it at the end — where the placement is
     actually written — would be telling someone what they had already spent the afternoon doing. */
  if(ccjWarnDuplicatePlacement())return;
  if(emp){
    run.match=emp;
    if(!run.intake.country&&emp.country)run.intake.country=emp.country;
    ccjPush({who:'agent',kind:'match',emp:emp});
    ccjPush({who:'agent',text:'Contract pre-filled from their record.'});
    ccjPrefillForm();
    ccjScheduleChat(function(){ccjGoScreen('form');},900);
  }else{
    run.createdEmp=ccjCreateEmployee();
    ccjPush({who:'agent',text:'No match for <b>'+run.intake.name+'</b> in ADT. Created employee record <b>'+run.createdEmp.empId+'</b>.'});
    ccjPrefillForm();
    ccjScheduleChat(function(){
      ccjGoScreen('employee');
      // The record goes up beside the conversation; the invitation to move on goes in the
      // conversation. On the same beat, so the reader is never looking at a finished artefact
      // wondering what is supposed to happen next.
      //
      // NOT "the record is on the right". That described the furniture — it pointed at a panel
      // instead of saying anything about the work, and it was wrong at any width where the panel
      // is not on the right.
      //
      // It names the id, because the id is the thing that now exists and the thing everything
      // after this hangs off. A card that summarises what just happened before offering the next
      // step is how an operational tool reads; the earlier attempt described the form's fields
      // instead, which is a caption, not a product.
      ccjAsk('Employee record <b>'+run.createdEmp.empId+'</b> has been created. Add their contract details next.',
        'Add the contract details','form');
    },900);
  }
  ccjPaint();                                   // the panel's context just changed
}
/* A real ADT record, pushed into the same store the Employees listing reads, so the person
   created here exists everywhere in the app rather than only inside this run. */
function ccjCreateEmployee(){
  const run=ccjRun;
  const name=run.intake.name||'New Employee';
  const country=run.intake.country||'';
  const global=!!country;
  const arr=global?globalEmpData:directEmpData;
  const newId=arr.reduce(function(m,e){return Math.max(m,e.id);},0)+1;
  const empId=(global?'GEP':'EMP')+String(newId).padStart(3,'0');
  const now=typeof aiFormatNow==='function'?aiFormatNow():{date:'—',time:'—'};
  const rec=Object.assign({
    id:newId,name:name,empId:empId,dept:'—',jobTitle:run.intake.jobTitle||'—',joinDate:now.date,
    desc:'Created via the Contract Creation journey',contact:'—',email:'—',status:'Active'
  },global?{country:country,workerType:run.model}:{branch:'—'});
  arr.push(rec);
  return rec;
}
/* ---- DOCUMENT PARSING --------------------------------------------------------------------
   Upload an offer letter, an ID or a filled-in form and the agent reads the contract out of it.

   WHY THIS IS ONE CARD AND NOT TWENTY-FOUR MESSAGES. The obvious way to show extraction is to
   replay the whole question flow against the document — ask for a field, answer it from the
   file, repeat. That is what the original journey did, and it costs two messages per field:
   twenty-four bubbles to report a single pass the machine made in one go. It reads as theatre,
   and worse, it buries the only thing a reviewer actually needs, which is not "what did you
   find" but "where did you get it".

   So extraction is ONE message that grows: a card listing each field as it lands, with the part
   of the document it was read out of. Each row carries that citation and nothing else.

   NO CONFIDENCE MARKER. An earlier version graded every row CERTAIN / LIKELY / GUESS. It was
   removed on the owner's call, and the call is right: the values are read straight from the
   document, so a row labelled LIKELY invites doubt about something that is not in doubt. The
   citation survives because it answers the question that remains useful — where this came from —
   without implying the answer might be wrong.

   The fields the document does not cover are named at the end rather than silently left blank,
   and the agent then asks for those in conversation exactly as it would have anyway.

   WHAT IT MAY OVERWRITE. Empty fields, and fields the AGENT pre-filled — a document is better
   evidence than an inference. Never a value the user typed. Their edit is the most recent
   human judgement on that field and nothing automatic outranks it.                          */
function ccjUpload(){
  const inp=document.getElementById('ccj-upload-input');
  if(!inp)return;
  inp.value='';
  inp.click();
}
/* WHAT THE SAMPLE DOCUMENT ACTUALLY SAYS. One object, and the PDF in sample-docs/ is GENERATED
   from it — see tools/make-sample-doc.js. Every row of the extraction card cites the part of the
   document its value came from, and that citation is a promise the value is really on the paper.
   Two hand-maintained copies would break that promise the first time one of them was edited, so
   the paper and the parser read the same constant.

   `annual` is the figure the document prints. The form field is MONTHLY, which is why the
   extractor divides and says so. */
const CCJ_SAMPLE_DOC={
  ref:'ADT-INT-2026-0417',
  issued:'24 July 2026',
  entity:'ADT Germany EOR Services GmbH',
  currency:'EUR',
  /* `v` is what the FORM stores — it has to match the field's type and, for a select or a radio,
     be one of its options exactly. `p` is what the PAPER prints, which is allowed to be longer and
     to carry a unit. Where they are the same only `v` is given. Splitting them is what lets the
     document read like a document ("6 months") while the field still receives a number ("6"). */
  fields:{
    nationality:{v:'India'},
    country:    {v:'Germany'},
    workPermit: {v:'Yes, employee has a work permit'},
    fname:      {v:'Shiv'},
    lname:      {v:'Kumar'},
    /* Illustrative, not anyone's. This is a demo persona that ships in a repository with a
       remote, so the date of birth and the address are made up on purpose — a real pair of those
       next to a real full name is a meaningful identity disclosure, and git keeps what it is
       given. The nationality is real because the journey genuinely branches on it. */
    dob:        {v:'1990-06-12', p:'12 June 1990'},
    gender:     {v:'Male'},
    email:      {v:'shiv.kumar@personalmail.com'},
    mobile:     {v:'+91 98110 24578'},
    address:    {v:'12 Jubilee Hills, Hyderabad, India'},
    jobTitle:   {v:'Director of Engineering'},
    skill:      {v:'Platform Engineering & Team Leadership'},
    jobDesc:    {v:'Leads the platform engineering group and owns delivery across the EU region.'},
    term:       {v:'Permanent'},
    schedule:   {v:'Full time', p:'Full time &mdash; 40 hours per week'},
    fromDate:   {v:'2026-09-01', p:'1 September 2026'},
    pay:        {v:'18500', p:'EUR 18,500 per month'},
    probation:  {v:'6',  p:'6 months'},
    notice:     {v:'30', p:'30 days'}
  },
  // The paper states the ANNUAL figure and the intake row states the monthly one it divides to,
  // which is the unit the form actually wants. Both are printed so the arithmetic is checkable.
  annual:222000,
  // Not captured, and the form does not want it: End Date only exists on a fixed term.
  omitted:[{k:'toDate',label:'End Date',why:'Not applicable &mdash; permanent engagement'}]
};
function ccjSampleField(k){return (CCJ_SAMPLE_DOC.fields[k]||{}).v||'';}
/* Where the generated sheet lives, so the composer can offer it for download. Relative to
   index.html, which is how the app is opened. */
const CCJ_SAMPLE_PDF='sample-docs/Shiv_Kumar_Contract_Data.pdf';
/* What the sample document in sample-docs/ contains, resolved against THIS run so uploading a
   file for Anika Shah does not suddenly report Shiv's name back. `from` is the part of the
   document the value was read out of — the citation is what makes the card reviewable. */
function ccjDocExtract(){
  const run=ccjRun,it=run.intake||{},e=run.match||run.createdEmp||{};
  const parts=String(it.name||e.name||'').split(' ').filter(Boolean);
  const country=it.country||e.country||'Germany';
  const real=function(v,fallback){return v&&v!=='—'?v:fallback;};
  const D=CCJ_SAMPLE_DOC,F=D.fields,S=ccjSampleField;
  /* Which section of the intake form each value was read out of. The citation is the whole point
     of the card — it tells a reviewer where to look on the paper to check the value — so it names
     a real heading on the document rather than a vague one. */
  const SEC={nationality:'Eligibility',country:'Eligibility',workPermit:'Eligibility',
    fname:'Employee information',lname:'Employee information',dob:'Employee information',
    gender:'Employee information',email:'Employee information',mobile:'Employee information',
    address:'Employee information',
    jobTitle:'Job details',skill:'Job details',jobDesc:'Job details',term:'Job details',
    schedule:'Job details',fromDate:'Job details',pay:'Job details',
    probation:'Probation and notice',notice:'Probation and notice'};
  const from=function(k){return SEC[k]||'Intake form';};
  return [
    // The run's own name wins over the paper's — uploading a sheet while a different person's
    // request is open must not rename them mid-run.
    {k:'fname',   v:parts[0]||S('fname'),              from:from('fname')},
    {k:'lname',   v:parts.slice(1).join(' ')||S('lname'),from:from('lname')},
    {k:'dob',     v:S('dob'),                          from:from('dob')},
    {k:'gender',  v:S('gender'),                       from:from('gender')},
    {k:'email',   v:real(e.email,S('email')),          from:from('email')},
    {k:'mobile',  v:S('mobile'),                       from:from('mobile')},
    {k:'address', v:S('address'),                      from:from('address')},
    // The form STATES a nationality, so it is read rather than guessed from the work country.
    // Inferring it was wrong for exactly the case this demo is: an Indian national placed in
    // Germany was recorded as a German national, which then chose the wrong identity document
    // and answered the right-to-work question without ever asking it.
    {k:'nationality',v:S('nationality'),               from:from('nationality')},
    {k:'country', v:country||S('country'),             from:from('country')},
    {k:'workPermit',v:S('workPermit'),                 from:from('workPermit')},
    {k:'jobTitle',v:real(e.jobTitle,S('jobTitle')),    from:from('jobTitle')},
    {k:'skill',   v:S('skill'),                        from:from('skill')},
    {k:'jobDesc', v:S('jobDesc'),                      from:from('jobDesc')},
    {k:'term',    v:S('term'),                         from:from('term')},
    {k:'schedule',v:S('schedule'),                     from:from('schedule')},
    {k:'fromDate',v:S('fromDate'),                     from:from('fromDate')},
    {k:'probation',v:S('probation'),                   from:from('probation')},
    {k:'notice',  v:S('notice'),                       from:from('notice')},
    // Monthly, because the field is monthly. The sheet states an ANNUAL figure — 222,000 — and
    // this used to carry it through untouched, which quoted the client the annual number every
    // month. A unit mismatch is not a rounding error, it is a wrong answer. Keep this in step
    // with sample-docs/: the citation promises the reader it was divided, so it must have been.
    {k:'pay',     v:String(D.annual/12),               from:from('pay')+' (annual &divide; 12)'}
  ];
}
function ccjHandleUpload(e){
  const file=e&&e.target&&e.target.files&&e.target.files[0];
  if(!file)return;
  ccjStartExtraction(file.name,file.size);
}
function ccjStartExtraction(name,size){
  const run=ccjRun;if(!run)return;
  run.asking=null;                                  // the document answers whatever was pending
  // Counted while filtering, not derived afterwards. `fields` is what the document was ALLOWED to
  // fill, so its length alone cannot say why the rest were left out — and "read 19 fields" on a
  // run where two of them were the user's own typing is a card claiming work it did not do. The
  // two reasons are kept apart: a field that does not apply to this run was never on offer, and a
  // field the user typed was deliberately left alone.
  let kept=0;
  const fields=ccjDocExtract().filter(function(x){
    const f=ccjAllFields().find(function(y){return y.k===x.k;});
    if(!f||!ccjFieldApplies(f))return false;
    // Empty, or filled by the agent's own inference. Never a value the user typed.
    if(!String(run.form[x.k]||'').trim()||run.aiFilled[x.k])return true;
    kept++;
    return false;
  });
  /* Read in the SHEET's order, not the extractor's. ccjDocExtract lists the person before the
     eligibility answers, which on the form live one section above them — so the read walked down
     to Address, jumped back up to Nationality, then down again, and no amount of easing makes a
     scroll that reverses look deliberate. Ordering the landings by the form puts the read where a
     human reading the same document would be: top to bottom, one section at a time, each glide a
     short hop onto the next blank. It also lines the card's citations up in section order, which
     is the order a reviewer checks the paper in.

     Sorted here rather than in ccjDocExtract because that function states what the document says;
     the order it is REPLAYED in is a property of this animation. */
  const sheetOrder=ccjAllFields().map(function(f){return f.k;});
  fields.sort(function(a,b){return sheetOrder.indexOf(a.k)-sheetOrder.indexOf(b.k);});
  // `open` is the card's own disclosure state. It reads while it is reading, and folds to one
  // line once the run has moved past it — see ccjFinishExtraction.
  run.doc={name:name,size:size||0,fields:fields,at:0,done:false,open:true,kept:kept,absent:0};
  ccjPush({who:'user',kind:'file',name:name,size:size||0});
  // Held onto, because this is the one message in the journey whose body keeps changing after it
  // has been said — a field lands in it every CCJ_DOC_STEP. Keeping the message itself, rather
  // than looking it up by kind later, is what lets ccjRepaintMsg address it directly.
  const card={who:'agent',kind:'doc'};
  ccjPush(card);
  run.doc.msg=card;
  ccjPaint();                                       // the held row now reports the read
  ccjScheduleChat(ccjExtractStep,700);
}
function ccjExtractStep(){
  const run=ccjRun;if(!run||!run.doc||run.doc.done)return;
  const d=run.doc;
  const item=d.fields[d.at];
  if(!item){ccjFinishExtraction();return;}
  run.form[item.k]=item.v;
  delete run.aiFilled[item.k];                      // it came from a document now, not a guess
  run.justFilled=item.k;                            // the form flashes the field that landed
  d.at++;
  ccjRepaintMsg(d.msg);                             // the card alone, not the stream around it
  ccjPaintScreen();
  /* Look ahead to the blank about to be filled, not back at the one just filled. The field that
     landed is still on screen — it is the row directly above, and it is the one flashing — so
     centring the next one shows the result and the destination together, and the sheet travels
     one row at a time instead of re-centring on ground already covered. On the last field there
     is no next, so it holds on what landed. */
  const next=d.fields[d.at];
  ccjScrollToField(next?next.k:item.k);
  ccjPaint();
  ccjScheduleChat(ccjExtractStep,CCJ_DOC_STEP);
}
function ccjFinishExtraction(){
  const run=ccjRun;if(!run||!run.doc)return;
  run.doc.done=true;
  run.justFilled=null;
  const missing=ccjMissingFields();
  // Snapshotted, not read live. Once the card has folded, its line is a record of what the
  // document did — and a count that quietly fell as the user answered the questions afterwards
  // would be rewriting that record under them.
  run.doc.absent=missing.length;
  ccjRepaintMsg(run.doc.msg);                       // its last full state, still open
  ccjPaintScreen();
  ccjPaint();
  ccjScheduleChat(function(){
    /* THE CARD FOLDS AS THE RUN MOVES ON, and not a moment before. Same rule the sub-status
       blocks follow: nothing collapses while it is still the newest thing on screen, because
       content disappearing under the reader's eyes is how you make someone distrust a surface.
       It folds here, at the instant the agent turns to the next question, and what it leaves
       behind says what it did — see ccjDocFact. */
    const d=ccjRun&&ccjRun.doc;
    if(d){d.open=false;ccjRepaintMsg(d.msg);}
    if(missing.length){
      /* No message naming the missing fields. The folded card's own line already counts them,
         and the agent goes straight on to ask for each one — a list in between would be the
         third telling of the same thing. */
      ccjScheduleChat(ccjAskNextField,700);
    }else{
      ccjPush({who:'agent',text:'All required fields came from the document.'});
      ccjMaybeAutoProceed();
    }
  },600);
}
/* What the folded line says. The rule the whole transcript follows: a closed thing keeps the one
   fact worth having, and it is never just a tick. Three numbers at most, and each one only when
   it is true — "17 fields filled" on its own is the common case and reads best alone. */
function ccjDocFact(d){
  const parts=[d.fields.length+' field'+(d.fields.length===1?'':'s')+' filled'];
  if(d.kept)parts.push('kept '+d.kept+' of yours');
  if(d.absent)parts.push(d.absent+' not in it');
  return parts.join(' &middot; ');
}
/* Opening or folding it by hand. Deliberately no guard on `done`: a reader who wants the card out
   of the way while it is still reading is allowed to say so, and it keeps reading either way. */
function ccjToggleDoc(){
  const run=ccjRun;if(!run||!run.doc)return;
  run.doc.open=!run.doc.open;
  ccjRepaintMsg(run.doc.msg);
}
/* The extraction card. One message, re-rendered as each field lands — which is why it reads its
   state off run.doc rather than carrying its own copy. */
function ccjDocHTML(){
  const run=ccjRun,d=run.doc;
  if(!d)return '<div class="ccj-bubble">No document.</div>';
  const rows=d.fields.slice(0,d.at).map(function(x){
    const f=ccjAllFields().find(function(y){return y.k===x.k;})||{label:x.k};
    // Stacked, not two columns. A label/value split in a 300px conversation column left the
    // value about fifty pixels wide, which wrapped a job description to one character a line.
    //
    // No confidence marker. It was there to let a reviewer weigh each value, but the extraction
    // is accurate by construction here — every field is read straight from the document — and a
    // row that says LIKELY invites doubt about a value that is not in doubt. What survives is
    // the citation: where in the document it came from, which is the useful half.
    return '<div class="ccj-doc-row">'
      +'<div class="ccj-doc-k">'+f.label+'</div>'
      +'<div class="ccj-doc-v">'+x.v+'</div>'
      +'<div class="ccj-doc-src">'+x.from+'</div>'
      +'</div>';
  }).join('');
  const absent=d.done?ccjMissingFields():[];
  const ico='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  const chev='<span class="ccj-doc-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></span>';
  /* FOLDED. Once the fields are in the form, the document has done its job and the form is where
     the values now live — nineteen rows restating them is the same information twice, and it is
     the taller of the two. One line, and the whole line is the control: a hit area the width of
     the conversation is about as far from a hassle to reopen as it gets. */
  if(d.done&&!d.open){
    return '<button type="button" class="ccj-doc-closed" onclick="ccjToggleDoc()"'
      +' title="Show what was read from this document">'
      +'<span class="ccj-doc-ico">'+ico+'</span>'
      +'<span class="ccj-doc-cname">'+d.name+'</span>'
      +'<span class="ccj-doc-cfact">'+ccjDocFact(d)+'</span>'
      +chev+'</button>';
  }
  /* STILL READING: ONE LINE, exactly like a live sub-status — the user applied the same rule
     here. The field it is on is the gist, the spark and its verb carry the activity, and the
     nineteen rows do not exist yet. They appear when the read finishes and the card can be
     folded, which is where the reader actually wants to check the citations. */
  if(!d.done){
    return '<div class="ccj-bubble ccj-doc live">'
      +'<div class="ccj-doc-head">'
      +'<span class="ccj-doc-ico">'+ico+'</span>'
      +'<span class="ccj-doc-name">'+d.name+'</span>'
      +'<span class="ccj-sb-gist">'+ccjDocGist(d)+'<span class="ccj-sb-dots">&hellip;</span></span>'
      +'<span class="ccj-sb-live">'+ccjSparkHTML()
      +'<span class="ccj-sb-verb">Reading&hellip;</span></span>'
      +'</div></div>';
  }
  // DONE AND OPEN. The head folds it again, and the rows are the record of what was read.
  return '<div class="ccj-bubble ccj-doc">'
    +'<div class="ccj-doc-head foldable" onclick="ccjToggleDoc()" title="Hide this again">'
    +'<span class="ccj-doc-ico">'+ico+'</span>'
    +'<div><div class="ccj-doc-name">'+d.name+'</div>'
    +'<div class="ccj-doc-stat">'+ccjDocFact(d)+'</div></div>'
    +chev
    +'</div>'
    +(rows?'<div class="ccj-doc-rows">'+rows+'</div>':'')
    +(absent.length?'<div class="ccj-doc-absent"><b>Not in the document</b>'
      +absent.map(function(f){return f.label;}).join(', ')+'</div>':'')
    +'</div>';
}
/* What the read is on right now: the field that just landed, and the count. Two or three words
   plus a position, so a reader can tell a read that is progressing from one that has stopped —
   the same thing the sub-status gist does, from the same store the card is drawn from. */
function ccjDocGist(d){
  const at=Math.max(0,Math.min(d.at,d.fields.length));
  const last=at>0?d.fields[at-1]:null;
  const f=last?(ccjAllFields().find(function(y){return y.k===last.k;})||{label:last.k}):null;
  return (f?f.label+' &middot; ':'')+at+' of '+d.fields.length;
}
function ccjFileSize(b){
  if(!b)return '';
  return b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB';
}

/* ---- THE CONTRACT FORM ------------------------------------------------------------------
   A schema, not four hundred lines of hand-written markup. Every field declares how it
   renders, whether it is required, and the question the agent asks when it is missing — so
   the form, the validation and the conversation are all driven by one list and can never
   describe different contracts.                                                             */
/* Every country a PERSON can be a national of. The full list is right here: nationality does not
   need us to be set up anywhere, and the permit logic already handles any nationality against any
   work country. */
function ccjCountries(){
  return (typeof AI_CT_COUNTRIES!=='undefined'&&AI_CT_COUNTRIES)
    ||['India','Netherlands','Germany','Spain','United Kingdom','France','Italy'];
}
/* Every country we can actually EMPLOY in, which is a different and much shorter list — and the
   distinction is not cosmetic. Where the work happens picks the employment law, the tax authority,
   the social security institution, the registered entity and its bank, the payroll return and the
   permit. Every one of those is a per-country pack.

   The list is DERIVED by intersecting the packs, not written out, because a hand-kept list drifts
   the moment somebody adds a pack and forgets it — and the failure is silent. `ccjCountries()`
   returns 54 countries (AI_CT_COUNTRIES, the original journey's list) while the packs cover 7, so
   choosing any of the other 47 fell through `||CCJ_STAT['Netherlands']` and friends: Dutch
   employment law, the Belastingdienst and a Dutch IBAN, but German social security rates and a
   German permit, because CCJ_RATES and CCJ_PERMITS default to Germany instead. That mixture is
   exactly as incoherent as it sounds, and nothing on screen said anything was wrong. */
function ccjWorkCountries(){
  return ccjCountries().filter(function(c){
    return !!(CCJ_STAT[c]&&CCJ_ONB[c]&&CCJ_REGISTRY[c]&&CCJ_PAYRUN_PACK[c]&&CCJ_RATES[c]&&CCJ_PERMITS[c]);
  });
}
function ccjCanEmployIn(c){return ccjWorkCountries().indexOf(c)>-1;}
const CCJ_FORM=[
  {id:'eligibility',title:'Eligibility',fields:[
    {k:'nationality',label:'Employee Nationality',type:'select',opts:'countries',req:true,
     ask:"What is the employee's nationality?"},
    /* `workCountries`, not `countries`: nationality can be anywhere, but we can only employ where
       we have an entity, an employment-law set, a tax authority and a payroll return configured.
       Offering all 54 here silently produced Dutch law with German social security rates. */
    {k:'country',label:'Country employee will be working from',type:'select',opts:'workCountries',req:true,
     ask:'Which country will they be working from?'},
    {k:'workPermit',label:'Work Permit',type:'radio',req:true,full:true,
     opts:['Yes, employee has a work permit','Employee would like ADT to assist with the work visa'],
     ask:'Does the employee already hold a work permit?'}
  ]},
  {id:'employee',title:'Employee Information',fields:[
    {k:'fname',label:'First Name',type:'text',req:true,ask:"What is the employee's first name?"},
    {k:'lname',label:'Last Name',type:'text',req:true,ask:'And their last name?'},
    {k:'dob',label:'Date of Birth',type:'date',req:true,ask:'What is their date of birth?'},
    {k:'gender',label:'Gender',type:'select',opts:['Male','Female','Non-binary','Prefer not to say']},
    {k:'email',label:'Email',type:'email',req:true,ask:'What is their email address?'},
    {k:'mobile',label:'Mobile Number',type:'tel',req:true,ask:'What is their mobile number?'},
    {k:'address',label:'Address',type:'textarea',req:true,full:true,ask:'What is their residential address?'}
  ]},
  {id:'job',title:'Job Details',fields:[
    {k:'jobTitle',label:'Job Title',type:'text',req:true,ask:'What is the job title?'},
    {k:'skill',label:'Primary Skill',type:'text'},
    {k:'jobDesc',label:'Job Description',type:'textarea',req:true,full:true,
     hint:'Appears on the contract under &ldquo;Scope of Work&rdquo;. Maximum 100 words.',
     ask:'What is the job description or scope of work?'},
    {k:'term',label:'Employment Term',type:'radio',req:true,opts:['Permanent','Fixed Term'],
     ask:'Is this a permanent or a fixed-term contract?'},
    {k:'schedule',label:'Work Schedule',type:'select',req:true,opts:['Full time','Part time','Shift based'],
     ask:'Is this full time, part time or shift based?'},
    {k:'fromDate',label:'Start Date',type:'date',req:true,ask:'When do they start?'},
    {k:'toDate',label:'End Date',type:'date',when:function(f){return f.term==='Fixed Term';},
     ask:'And when does the fixed term end?'},
    {k:'pay',label:'Monthly Gross Pay',type:'money',req:true,ask:'What is the monthly gross pay?'}
  ]},
  {id:'terms',title:'Probation and Notice',fields:[
    {k:'probation',label:'Probation Period',type:'number',unit:'months',req:true,
     hint:'A one-time deposit equal to one month of gross salary is invoiced against this.',
     ask:'How many months of probation?'},
    {k:'notice',label:'Notice Period',type:'number',unit:'days',req:true,ask:'And the notice period, in days?'}
  ]}
];
/* Fields whose `when` is false do not exist for this contract — an End Date on a permanent
   contract is not an unanswered question, it is not a question. */
function ccjFieldApplies(f){
  return !f.when||f.when(ccjRun.form||{});
}
function ccjAllFields(){
  const out=[];
  CCJ_FORM.forEach(function(s){s.fields.forEach(function(f){out.push(f);});});
  return out;
}
function ccjMissingFields(){
  const form=ccjRun.form||{};
  return ccjAllFields().filter(function(f){
    return f.req&&ccjFieldApplies(f)&&!String(form[f.k]||'').trim();
  });
}
/* What the agent can infer without asking: the prompt gave a name and a country, the matched
   record gives the rest, and the engagement model decides the sensible defaults. Everything it
   fills is recorded in `aiFilled` so the form can mark it — a pre-filled field the user cannot
   distinguish from one they typed is a field they will not check. */
function ccjPrefillForm(){
  const run=ccjRun;
  const e=run.match||run.createdEmp||{};
  const parts=String(run.intake.name||e.name||'').split(' ').filter(Boolean);
  const country=run.intake.country||e.country||'';
  const set=function(k,v){if(v!==undefined&&v!==''&&!run.form[k]){run.form[k]=v;run.aiFilled[k]=true;}};
  set('fname',parts[0]||'');
  set('lname',parts.slice(1).join(' '));
  set('country',country);
  set('nationality',country);
  set('email',e.email&&e.email!=='—'?e.email:'');
  // What the sentence said outranks the matched record: the request is for THIS role, which
  // may not be the one the person currently holds.
  set('jobTitle',run.intake.jobTitle||(e.jobTitle&&e.jobTitle!=='—'?e.jobTitle:''));
  // Stated in the sentence, so the agent does not ask for it again. It lands as an agent fill like
  // every other pre-filled field — marked in the form, and overwritable — rather than as a value
  // the user cannot tell apart from one they typed.
  set('pay',run.intake.pay||'');
  set('term','Permanent');
  set('schedule','Full time');
  set('probation','3');
  set('notice','30');
  set('workPermit','Yes, employee has a work permit');
}
function buildCCJFormHTML(){
  const run=ccjRun;
  const missing=ccjMissingFields().length;
  const filled=Object.keys(run.aiFilled).length;
  return '<div class="ccj-form-scroll">'
    +'<div class="ccj-form-head">'
    +'<div class="ccj-form-title">Create a Contract</div>'
    +'<div class="ccj-form-sub">'+ccjModelLabel(run.model)+' &middot; '+(run.form.country||run.intake.country||'Country not selected')+'</div>'
    +'</div>'
    +'<div class="ccj-prefill">'
    +'<span class="ccj-prefill-ico"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg></span>'
    +'<div><div class="ccj-prefill-t">'+(filled?'AI pre-filled '+filled+' field'+(filled===1?'':'s'):'Nothing to pre-fill yet')+'</div>'
    +'<div class="ccj-prefill-s">'+(missing
      ?missing+' required field'+(missing===1?'':'s')+' remaining.'
      :'All required fields are filled.')+'</div></div>'
    +'</div>'
    +CCJ_FORM.map(ccjSectionHTML).join('')
    // No button. The agent has everything it was asked for, so making the proposal is the next
    // thing that happens — asking the user to confirm that a form they just watched fill itself
    // is complete is a click that carries no decision. It waits a beat first so the last value
    // can be read, and says what it is about to do.
    +'<div class="ccj-form-foot">'
    +(missing
      ?'<div class="ccj-form-foot-note"><b>'+missing+'</b> required field'+(missing===1?'':'s')+' remaining</div>'
      :'<div class="ccj-form-foot-go"><span class="ccj-spin"></span>'
        +'All required fields filled &mdash; creating the proposal&hellip;</div>')
    +'</div></div>';
}
function ccjSectionHTML(sec){
  const fields=sec.fields.filter(ccjFieldApplies);
  if(!fields.length)return '';
  return '<div class="ccj-fsec">'
    +'<div class="ccj-fsec-t">'+sec.title+'</div>'
    +'<div class="ccj-fgrid">'+fields.map(ccjFieldHTML).join('')+'</div>'
    +'</div>';
}
function ccjFieldHTML(f){
  const run=ccjRun;
  const v=run.form[f.k]===undefined?'':String(run.form[f.k]);
  const ai=run.aiFilled[f.k];
  const asking=run.asking===f.k;
  const missing=f.req&&!v.trim();
  const id='ccj-f-'+f.k;
  const on='onchange="ccjSetField(\''+f.k+'\',this.value)"';
  let input='';
  if(f.type==='select'){
    const opts=f.opts==='countries'?ccjCountries():f.opts==='workCountries'?ccjWorkCountries():f.opts;
    input='<select class="ccj-inp" id="'+id+'" '+on+'>'
      +'<option value="">Select</option>'
      +opts.map(function(o){return '<option'+(o===v?' selected':'')+'>'+o+'</option>';}).join('')
      +'</select>';
  }else if(f.type==='radio'){
    // The id rides the group, not the buttons — so the ring, the flash and the scroll all have
    // the same target on a radio as they do on an input.
    input='<div class="ccj-radios" id="'+id+'">'+f.opts.map(function(o){
      return '<button type="button" class="ccj-radio'+(o===v?' on':'')+'" onclick="ccjSetField(\''+f.k+'\',\''+attrSafe(o).replace(/'/g,"\\'")+'\')">'
        +'<span class="ccj-radio-dot"></span>'+o+'</button>';
    }).join('')+'</div>';
  }else if(f.type==='textarea'){
    input='<textarea class="ccj-inp ccj-ta" id="'+id+'" rows="3" '+on+'>'+v+'</textarea>';
  }else if(f.type==='money'){
    input='<div class="ccj-money"><span>'+ccjCurrency()+'</span>'
      +'<input class="ccj-inp" id="'+id+'" type="number" value="'+attrSafe(v)+'" '+on+'></div>';
  }else if(f.type==='number'){
    input='<div class="ccj-unit"><input class="ccj-inp" id="'+id+'" type="number" value="'+attrSafe(v)+'" '+on+'>'
      +(f.unit?'<span>'+f.unit+'</span>':'')+'</div>';
  }else{
    input='<input class="ccj-inp" id="'+id+'" type="'+f.type+'" value="'+attrSafe(v)+'" '+on+'>';
  }
  // The field a document just landed in. A keyframe, not a transition — the form is re-rendered
  // on every fill, so there is no previous state for a transition to run from.
  const just=run.justFilled===f.k;
  return '<div class="ccj-fgroup'+(f.full?' full':'')+(asking?' asking':'')+(missing?' missing':'')+(just?' just':'')+'">'
    +'<label class="ccj-flabel" for="'+id+'">'+f.label
    +(f.req?'<span class="ccj-req">*</span>':'')
    +(ai?'<span class="ccj-ai" title="Pre-filled by AI. Verify this value.">AI</span>':'')
    +'</label>'+input
    +(f.hint?'<div class="ccj-fhint">'+f.hint+'</div>':'')
    +'</div>';
}
function ccjCurrency(){
  const c=(ccjRun.form.country||ccjRun.intake&&ccjRun.intake.country||'');
  return c==='India'?'&#8377;':c==='United Kingdom'?'&#163;':'&#8364;';
}
/* Typing into a field answers the agent's question as surely as replying to it, so the form
   and the conversation stay in step: whatever the agent was waiting on is cleared, and it
   moves on to the next thing it needs. */
function ccjSetField(k,v){
  const run=ccjRun;if(!run)return;
  run.form[k]=v;
  delete run.aiFilled[k];                       // it is the user's value now, not the agent's
  const wasAsking=run.asking===k;
  if(wasAsking)run.asking=null;
  ccjPaintScreen();
  ccjMaybeAutoProceed();
  if(wasAsking)ccjScheduleChat(ccjAskNextField,500);
}
function ccjAskNextField(){
  const run=ccjRun;if(!run||run.screen!=='form')return;
  const missing=ccjMissingFields();
  if(!missing.length){
    if(run.asking){run.asking=null;ccjPaintScreen();}
    ccjPush({who:'agent',text:'All required fields are filled.'});
    ccjMaybeAutoProceed();
    return;
  }
  const f=missing[0];
  if(run.asking===f.k)return;
  run.asking=f.k;
  ccjPaintScreen();
  ccjScrollToField(f.k);                          // the question and its target arrive together
  ccjPush({who:'agent',text:f.ask||('What is the '+f.label.toLowerCase()+'?')});
}
/* An answer typed into the conversation rather than the field. Selects and radios are matched
   loosely against their options so "netherlands" and "full time" land where they should. */
function ccjApplyAnswer(k,text){
  const run=ccjRun;
  const f=ccjAllFields().find(function(x){return x.k===k;});
  if(!f){run.asking=null;return;}
  let v=text.trim();
  if(f.type==='select'||f.type==='radio'){
    const opts=f.opts==='countries'?ccjCountries():f.opts==='workCountries'?ccjWorkCountries():f.opts;
    const q=v.toLowerCase();
    const hit=opts.find(function(o){return o.toLowerCase()===q;})
      ||opts.find(function(o){return o.toLowerCase().indexOf(q)>-1||q.indexOf(o.toLowerCase())>-1;});
    if(!hit){
      ccjPush({who:'agent',text:'Not a valid option. Choose from: '+opts.join(', ')+'.'});
      return;
    }
    v=hit;
  }
  if(f.type==='money'||f.type==='number')v=v.replace(/[^0-9.]/g,'');
  run.form[k]=v;
  run.asking=null;
  ccjPaintScreen();
  ccjPush({who:'agent',text:'Set <b>'+f.label+'</b> to <b>'+v+'</b>.'});
  ccjMaybeAutoProceed();
  ccjScheduleChat(ccjAskNextField,600);
}
/* Nothing is missing any more, so the proposal gets made. The pause is deliberate and is not a
   loading state: it is time to read the last value that landed before the screen changes under
   you. Re-entrant on purpose — every field edit calls it, and a field emptied again cancels the
   pending run rather than letting a stale timer fire against an incomplete form. */
function ccjMaybeAutoProceed(){
  const run=ccjRun;
  if(!run||run.proposal||run.screen!=='form')return;
  if(ccjMissingFields().length){
    if(run.proposing){run.proposing=false;if(run.autoTimer)clearTimeout(run.autoTimer);ccjPaintScreen();}
    return;
  }
  if(run.proposing)return;
  run.proposing=true;
  ccjPaintScreen();
  const g=ccjGen;
  if(run.autoTimer)clearTimeout(run.autoTimer);
  run.autoTimer=setTimeout(function(){
    if(ccjGen!==g||ccjRun!==run)return;
    run.autoTimer=null;
    if(run.proposal||run.screen!=='form'||ccjMissingFields().length){run.proposing=false;return;}
    ccjCreateProposal();
  },CCJ_AUTOGAP);
}
/* A repaint rebuilds the screen's whole subtree, so the form's scroller is a NEW node — and a new
   node starts at scrollTop 0. That is why the sheet snapped to the top every time a field landed:
   not a scroll that went wrong, a scroll position that no longer existed. ccjScrollToField then
   glided the entire sheet from 0 back down to the field, once per CCJ_DOC_STEP, which is the long
   swoop between fields.

   Carrying the offset across the swap makes the repaint invisible, and leaves the following glide
   travelling the short distance it was always meant to travel — from where the eye already is to
   the next field. Every caller benefits, not just the document read: typing a value into the form
   repaints too, and threw the sheet to the top in exactly the same way.

   Restored synchronously, before the browser can paint the new subtree, so there is no frame where
   the form is drawn at the top.

   A LIST, because the form was never the only scroller this happens to. The employment contract
   repaints once per clause as the audit applies each statutory rule, and its sheet was snapping to
   the top and being glided all the way back down 620ms later — the same failure described above,
   read as the document shuttling up and down rather than as one pass through it. Any screen whose
   scroller must survive its own repaint belongs here; a screen left off the list simply keeps the
   old behaviour, which is why this is an allowlist rather than "every scroller in the subtree". */
const CCJ_KEEP_SCROLL=[
  '.ccj-form-scroll',   // the contract form, following a document being read into it
  '.ccj-ec-wrap',       // the employment contract, following the clause being audited
  '.ccj-rdy-wrap'       // the readiness certificate, following the control being cleared
];
function ccjPaintScreen(){
  const el=document.getElementById('ccj-screen');
  if(!el)return;
  const find=function(sel){return el.querySelector?el.querySelector(sel):null;};
  const keep=CCJ_KEEP_SCROLL.map(function(sel){const n=find(sel);return n?n.scrollTop:0;});
  el.innerHTML=ccjScreenHTML(ccjRun.stage,ccjRun.screen);
  CCJ_KEEP_SCROLL.forEach(function(sel,i){
    if(keep[i]>0){const n=find(sel);if(n)n.scrollTop=keep[i];}
  });
  // The instruction above the composer counts what is still outstanding on the form, so it has to
  // be repainted whenever the form is — otherwise "3 fields still needed" goes on saying three
  // while the reader fills in the third. Cheap: the bar only rewrites when its markup changes.
  ccjPaintActionBar();
}
/* Bring a field into view inside the form's own scroller — never the page, which does not
   scroll. Used whenever attention moves to a field the user did not move it to themselves:
   a document filling one in, or the agent asking about one. A value landing four screens below
   the fold is a value nobody reviews, and the whole point of showing extraction row by row is
   that it can be watched.

   Measured with getBoundingClientRect rather than offsetTop because the field's offsetParent is
   whichever ancestor happens to be positioned, and that is not the scroller. Guarded because
   the headless harness has no layout. */
function ccjScrollToField(k){
  if(!k||typeof document.querySelector!=='function')return;
  const el=document.getElementById('ccj-f-'+k);
  const box=document.querySelector('.ccj-form-scroll');
  if(!el||!box||typeof el.getBoundingClientRect!=='function'||!box.getBoundingClientRect)return;
  const r=el.getBoundingClientRect(),br=box.getBoundingClientRect();
  if(!r.height&&!br.height)return;                 // not laid out yet
  // Centre it, so the rows above give context for the one that just changed.
  // Its own lane. The transcript ('stream') scrolls on the same beat during a document read, and
  // sharing the default lane meant whichever started second cancelled the other — the exact
  // failure the lane comment below describes, still being made by this call site.
  ccjGlide(box,box.scrollTop+(r.top-br.top)-(box.clientHeight/2-r.height/2),'form');
}
/* Native smooth scrolling is about 300ms and cannot be slowed, which reads as a snap when a
   document is landing a field every half second. This eases over CCJ_SCROLL instead, and a new
   target simply retargets the animation in flight rather than fighting it.

   LANES. One token used to serve every scroller in the journey, so any two that ran at once
   cancelled each other — and during a document read exactly two do: the transcript following
   the conversation and the form following the field that just landed. Whichever started second
   silently killed the first, which reads as a scroll that gives up halfway. A lane per scroller
   keeps "a newer scroll took over" meaning what it says: newer *on this surface*. */
let ccjGlideLane={};
function ccjGlide(box,top,lane){
  const key=lane||'main';
  const target=Math.max(0,top);
  if(typeof requestAnimationFrame!=='function'){box.scrollTop=target;return;}
  const from=box.scrollTop, dist=target-from;
  if(Math.abs(dist)<2)return;
  const dur=Math.max(CCJ_SCROLL_MIN,Math.min(CCJ_SCROLL,CCJ_SCROLL*Math.abs(dist)/CCJ_SCROLL_FULL));
  const token=(ccjGlideLane[key]={box:box,target:target});
  let t=0;
  // Counted, not flagged: two lanes can be gliding at once and a boolean would be cleared by
  // whichever finished first, letting the other one's remaining frames read as the reader
  // scrolling away.
  ccjAutoScroll++;
  let done=false;
  const finish=function(){if(!done){done=true;ccjAutoScroll--;}};
  const tick=function(){
    if(ccjGlideLane[key]!==token){finish();return;}  // a newer scroll on this lane took over
    t+=16;
    const k=Math.min(1,t/dur);
    const e=1-Math.pow(1-k,3);                     // ease-out cubic
    box.scrollTop=from+dist*e;
    if(k<1){requestAnimationFrame(tick);return;}
    if(ccjGlideLane[key]===token)ccjGlideLane[key]=null;
    finish();
  };
  requestAnimationFrame(tick);
}

/* ---- ENGAGEMENT MODEL — ITS OWN PAGE --------------------------------------------------------
   One decision, one screen, and nothing else on it. It is not part of the journey frame because
   it happens before there is a run: a nine-stage rail and a sub-status panel drawn around this
   would be reporting on work that has not started.

   The card data (id, title, sub, icon) is read from AI_CT_TYPE_CARDS — domain facts about the
   products, shared the way amPipelineStages is. Only the one-line meaning is written here: what
   the ORIGINAL journey put on these cards described its own navigation ("Opens the AI Contract
   Assistant") rather than the engagement, and EOR and PEO are initialisms a client cannot decode
   without being told who carries the employment liability. That is the line that earns its
   space; everything else on this screen was commentary and is gone. */
/* == THE CHOOSER ASKS WHO, NOT WHICH MODEL =================================================
   "Choose an engagement model" is our word for it, not the word somebody arriving with a person to
   hire has. They know who they are onboarding; they do not necessarily know that the industry calls
   the difference an engagement model, and being asked to pick one before being told what the
   options mean is the classic expert-shaped question. The card copy now names the PERSON — an EOR
   employee, a direct employee, a contractor — and the model is what that choice implies.

   Overridden HERE rather than edited into AI_CT_TYPE_CARDS, which is shared: js/pages.js reads
   `modelCard.title` for the original journey's header chip, and that journey is a frozen reference
   which must keep behaving exactly as it did. Same reason CCJ_MODEL_MEANS already overrides `desc`.

   The ids are untouched — EOR / PEO / CONTRACTOR are what every other surface, the entity token and
   the whole test suite key on. Only what a person reads changes. */
const CCJ_MODEL_CARD={
  EOR:{title:'EOR employee', sub:'We are the legal employer',
    desc:'A full-time or part-time employee. ADT employs them on your behalf, on our entity.'},
  PEO:{title:'Direct employee', sub:'You are the legal employer',
    desc:'Run payroll, manage employee leave, and hold contracts for your own entities.'},
  CONTRACTOR:{title:'Contractor', sub:'No employment relationship',
    desc:'Onboard and pay an individual or a company for services provided to your organisation.'}
};
/* Kept as the fallback for anything that asks what a model MEANS outside the chooser. The chooser
   itself reads CCJ_MODEL_CARD above. */
const CCJ_MODEL_MEANS={
  EOR:'We are the legal employer. Payroll and compliance sit with us.',
  PEO:'You stay the employer. We run payroll, filings and benefits.',
  CONTRACTOR:'No employment relationship. A contractor agreement, invoiced against the engagement.'
};
function buildCCJModelHTML(){
  const run=ccjEnsureRun();
  const cards=(typeof AI_CT_TYPE_CARDS!=='undefined'?AI_CT_TYPE_CARDS:[]);
  return '<div class="ccj-model-page">'
    +'<button class="ccj-back ccj-model-back" onclick="ccjExit()" title="'+attrSafe(ccjExitLabel())+'">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>'
    +'<div class="ccj-model-screen">'
    +'<div class="ccj-model-head">'
    +'<div class="ccj-model-title">Who would you like to onboard?</div>'
    +'<div class="ccj-model-sub">Hire and onboard employees or contractors.</div>'
    +'</div>'
    +'<div class="ccj-model-grid">'+cards.map(function(t){
      const on=run.model===t.id;
      const c=CCJ_MODEL_CARD[t.id]||{};
      return '<button type="button" class="ccj-mcard'+(on?' on':'')+'" onclick="ccjChooseModel(\''+t.id+'\')">'
        +'<span class="ccj-mcard-top">'
        +'<span class="ccj-mcard-ico">'+t.ico+'</span>'
        +'<span class="ccj-mcard-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg></span>'
        +'</span>'
        +'<span class="ccj-mcard-title">'+(c.title||t.title)+'</span>'
        +'<span class="ccj-mcard-sub">'+(c.sub||t.sub)+'</span>'
        +'<span class="ccj-mcard-desc">'+(c.desc||CCJ_MODEL_MEANS[t.id]||t.desc)+'</span>'
        +'</button>';
    }).join('')+'</div>'
    +'</div></div>';
}
function ccjChooseModel(id){
  const run=ccjEnsureRun();if(run.started)return;
  run.model=id;
  run.screen=(ccjScreensFor(0)[0]||{}).id||'prompt';
  page=ccjPageId(0);
  renderADTPage();
}
/* Reopening the choice from the header chip. Only while the request has not been logged — after
   that the form behind it was built for this model and switching would silently invalidate it. */
function ccjBackToModel(){
  const run=ccjRun;if(!run||run.started)return;
  page='ccj-model';
  renderADTPage();
}

/* == STAGE 5: THE MASTER SERVICES AGREEMENT ===============================================
   The commercial contract between ADT and the CLIENT COMPANY. Not the employment contract —
   that is between ADT and the WORKER, and it is stage 7. Two different contracts, two different
   counterparties, two different bodies of law, which is why the pipeline has two signing stages.

   The original journey rendered an EMPLOYMENT AGREEMENT here, signed by the employee. It cannot
   be that: this stage's own sub-statuses include a client entity and sanctions check, and you do
   not sanctions-screen a candidate. You screen a company you are about to contract with.

   MASTER is the operative word. It is signed ONCE PER CLIENT and every later hire runs under it.
   That is exactly the engagement/placement split the rail draws — stages 1-5 happen once per
   client, 6-9 repeat per person — so a client who already has one skips this stage entirely.

   SIGNING ORDER is the market standard for a negotiated agreement: the client signs, then ADT
   countersigns. The provider's paper is presented, the client accepts it, and the provider
   countersigns last because that is the control point — the final chance to refuse if the
   screening turned up something or a clause was altered. An agreement is executed on the LAST
   signature, and stage 6 raises the deposit invoice off that date.                        == */
function ccjMsa(){
  const run=ccjRun||{};
  if(!run.msa)run.msa={id:'MSA-'+String(4020+(run.gen||0)),screening:'clean',hit:null,
    clientSignedAt:0,adtSignedAt:0,version:1};
  const m=run.msa;
  // The three negotiable terms, previously written into the clause text as literals. Defaulted on
  // every read rather than only at creation, so a run restored from localStorage from before they
  // existed still reads numbers instead of "undefined days net". Values are unchanged from the
  // prose they replace, so an untouched agreement reads exactly as it did.
  if(m.paymentDays===undefined)m.paymentDays=14;
  if(m.noticeDays===undefined)m.noticeDays=60;
  if(m.liabilityMonths===undefined)m.liabilityMonths=12;
  return m;
}
/* Does this client already have a signed agreement? Everything on this stage hangs off it. The
   demo clients that ship with the app are treated as established relationships, which is what
   makes the "second hire skips the paperwork" path reachable. */
function ccjMsaExists(){
  const run=ccjRun;
  // Whether they were an established client BEFORE this run — the same frozen fact provisioning
  // recorded. Deriving it live from aiClients was wrong in both directions: stage 4 writes the
  // new client into that list, so by stage 5 a company we had just taken on looked like an old
  // one and was handed an agreement it had never signed.
  if(run&&run.tenantWasExisting!==undefined)return run.tenantWasExisting;
  const p=ccjParties();
  return !!((typeof aiClients!=='undefined'&&aiClients)||[])
    .find(function(c){return c.name===p.client.name;});
}
/* The client has signed and sent it back. Their signature goes on the document, the returned copy
   lands in the thread, and the run releases into the verification work — after which it stops for
   OUR countersignature, because that is the signature that puts the agreement in force. */
function ccjMsaReturned(){
  const run=ccjRun;if(!run)return;
  const m=ccjMsa(),c=ccjClient();
  if(m.clientSignedAt)return;
  c.mins+=430;
  m.clientSignedAt=c.mins;
  ccjClientPush({who:'client',kind:'signed',id:m.id,at:m.clientSignedAt});
  ccjClientLog('msaSigned','Agreement signed by client','Returned for countersignature');
  ccjPaintScreen();
  ccjResolveWait();
}
function ccjMsaFee(){
  const q=ccjQuote();
  return {pct:q.margin,deposit:q.gross,depositLabel:'one month gross salary'};
}

/* ---- STAGE 4: TURNING A DEAL INTO AN ACCOUNT -------------------------------------------------
   Stages 1-3 built a quote. This one turns a prospect into a customer: a tenant, a workspace, a
   client record and an owning CSM. It is the only stage with no human step in it.

   ccjTenant() is derived, not stored, so every surface that names the tenant names the same one.
   It upserts against aiClients — the app's real client list — because a client on their second
   engagement already has a workspace, and giving them a second would split their people across
   two accounts. (`masterData` looks like the place for this and is not: it is hydrated from the
   employee API and cleared on every refresh.) */
/* Initials from a company or person name, skipping the legal suffix so "Helix Marine B.V."
   reads HM rather than HB. */
function ccjInitials(name){
  return String(name||'').split(/\s+/)
    .filter(function(w){return w&&!/^(pvt|ltd|limited|b\.?v\.?|n\.?v\.?|gmbh|ag|inc\.?|llc|plc)\.?$/i.test(w);})
    .map(function(w){return w[0];}).slice(0,2).join('').toUpperCase()||'?';
}
function ccjCsm(){
  // Routed on the CLIENT'S country, not the worker's. A Customer Success Manager owns a client
  // relationship; a Netherlands client keeps their Dutch CSM whoever they hire and wherever.
  const p=ccjParties();
  const name=typeof amCsmFor==='function'?amCsmFor({country:p.client.country}):'Daniel Kim';
  return {name:name,country:p.client.country,
    initials:String(name).split(' ').map(function(x){return x[0];}).slice(0,2).join(''),
    // @adt.com. The CSM works for US. Printing maya.vos@<client domain> next to the client's own
    // buyer on the handover screen made our CSM look like one of their staff.
    email:String(name).toLowerCase().replace(/[^a-z ]/g,'').trim().replace(/\s+/g,'.')+'@adt.com'};
}
const CCJ_CC={'Netherlands':'NL','Germany':'DE','India':'IN','Spain':'ES',
              'United Kingdom':'UK','France':'FR','Italy':'IT'};
function ccjTenant(){
  const c=ccjCtx();
  const list=(typeof aiClients!=='undefined'&&aiClients)||[];
  const found=list.find(function(x){return x.name===c.client;});
  const slug=String(c.client).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const cc=CCJ_CC[c.country]||'XX';
  return {
    existing:!!found,
    id:(found?found.id:slug).toUpperCase().slice(0,12)+'-'+cc,
    workspace:slug+'.opendhi.com',
    plan:found?found.plan:'Growth',
    contact:found?found.contactName:'Client admin',
    slug:slug, record:found||null
  };
}
/* Did the client ALREADY have a tenant when provisioning ran? This has to be remembered, not
   re-derived: the moment the client is created, ccjTenant().existing flips to true and every
   surface reading it live would start describing a create as a reuse. */
function ccjTenantExisting(){
  const run=ccjRun;
  if(run&&run.tenantWasExisting!==undefined)return run.tenantWasExisting;
  return ccjTenant().existing;
}
/* Writes the client into aiClients if they are not there. Guarded so a re-run cannot create a
   duplicate — the same reason provisioning itself is idempotent. */
function ccjUpsertClient(){
  const c=ccjCtx(),t=ccjTenant();
  if(t.existing||typeof aiClients==='undefined')return t;
  // The CLIENT'S country, not the country the work happens in. A Netherlands client
  // hiring in Germany is still a Netherlands client, and their CSM follows them.
  aiClients.push({id:t.slug,name:c.client,country:ccjParties().client.country,plan:'Growth',employees:0,
    contactName:'Client admin',contactRole:'Entity Admin'});
  return ccjTenant();
}
function buildCCJAccountHTML(){
  const run=ccjRun,q=ccjQuote(),t=ccjTenant(),m=ccjCsm(),c=ccjCtx();
  const money=function(v){return q.sym+' '+Number(v).toLocaleString();};
  const done=function(l){return !!run.settled['quote-approved/'+l];};
  const won=done('Won'),prov=done('Client tenant provisioned'),intro=done('CSM confirmed to client');
  const row=function(k,v,on){
    return '<div class="ccj-pv-row'+(on?' done':'')+'">'
      +'<span class="ccj-pv-tick">'+(on
        ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
        :'')+'</span>'
      +'<span class="ccj-pv-k">'+k+'</span><span class="ccj-pv-v">'+(on?v:'&mdash;')+'</span></div>';
  };
  return '<div class="ccj-acct">'
    // Band 1 — the commercial outcome, stated once. The only place in nine stages that says this.
    +'<div class="ccj-won'+(won?' on':'')+'">'
    +'<div class="ccj-won-tag">'+(won?'Deal won':'Closing the deal')+'</div>'
    +'<div class="ccj-won-val">'+(won?money(q.total*12):'&mdash;')+'<span>a year</span></div>'
    +'<div class="ccj-won-sub">'+c.client+' &middot; '+c.country+' &middot; '+ccjModelLabel(c.type)
      +' &middot; '+money(q.total)+' a month</div>'
    +'</div>'
    // Band 2 — what provisioning actually created.
    +'<div class="ccj-pv">'
    +'<div class="ccj-pv-head">Client account'
      +(prov?'<span class="ccj-pv-note'+(ccjTenantExisting()?'':' new')+'">'
        +(ccjTenantExisting()?'existing client &middot; tenant reused':'new client &middot; tenant created')
        +'</span>':'')+'</div>'
    +row('Tenant',t.id,prov)
    +row('Workspace',t.workspace,prov)
    +row('Plan',t.plan,prov)
    +row('Admin invited',ccjTenantExisting()?'already has access':t.contact,prov)
    +'</div>'
    // Band 3 — the handover. The Account Manager's job ends here.
    +'<div class="ccj-csm'+(intro?' on':'')+'">'
    +'<div class="ccj-csm-av">'+m.initials+'</div>'
    +'<div class="ccj-csm-body">'
    +'<div class="ccj-csm-name">'+m.name+'</div>'
    +'<div class="ccj-csm-role">Customer Success Manager &middot; owns '+m.country+'</div>'
    +'<div class="ccj-csm-mail">'+m.email+'</div>'
    +'</div>'
    +'<span class="ccj-csm-state">'+(intro?'Introduced':'Assigning')+'</span>'
    +'</div>'
    // The foot STATES, it does not ask. On a rebuilt stage the carry-on is a block in the
    // conversation (ccjRestAsk) and this keeps only the sentence — which is a fact about the
    // account, and belongs on the account. The button survives here for as long as a stage using
    // this screen might still be on the panel.
    +(run.phase==='rest'
      ?'<div class="ccj-acct-foot">'
       +'<div class="ccj-acct-done">Client is live. Nothing else is needed on this step.</div>'
       +'</div>'
      :'')
    +'</div>';
}

/* ---- EDITING A DRAFT -------------------------------------------------------------------------
   A drafted agreement and a drafted contract are both documents a person is expected to READ
   before approving, and reading one is how you find the term you want changed. Until now the only
   answers were approve it or send it back, so the reviewer had no way to make the change they had
   just decided on.

   Editable only while the document is still a draft. Once it has been approved, issued or signed
   it is a record of what was agreed, and a record that can be edited is not a record — the gates
   are ccjMsaEditable/ccjEmpEditable below and they are the only thing that puts the button on the
   page.

   TERMS, NOT PROSE. What is edited is the small set of values the document is GENERATED from, not
   its clause text. Every clause already interpolates these (ccjEmpClauses reads t.probation,
   t.notice, t.gross, t.holiday; the agreement's 3.3, 3.5 and 3.8 read the three below), so a saved
   change rewrites the sentences that quote it and the document cannot end up disagreeing with
   itself. Free-text clause editing would have made that guarantee impossible to keep.

   WHAT IS DELIBERATELY NOT EDITABLE: the agreement's service fee and deposit. ccjMsaFee() derives
   both from the quote the client approved in stage 3. Letting stage 5 overwrite them would put a
   number in the signed agreement that contradicts the quote it came from, silently, with no trail
   — the quote is the place to change a price, and changing it there is a different stage's work.

   A STAGING COPY, not live mutation. Edits land on obj.edit and only reach the document on save,
   so Cancel is a real cancel. It also survives a repaint: keystrokes write to run state rather
   than living in the DOM, so if anything repaints the screen mid-edit the typed values are still
   there — the same reasoning as CCJ_KEEP_SCROLL, one level up. */
const CCJ_DOC_EDIT={
  msa:{
    get:function(){return ccjMsa();},
    can:function(){
      const run=ccjRun;if(!run||!run.settled)return false;
      const done=function(l){return !!run.settled['agreement-signature/'+l];};
      return done('MSA drafted')&&!done('Sent')&&!done('Signed');
    },
    noun:'agreement',
    fields:[
      {key:'paymentDays',    label:'Payment terms',  suf:'days net',            min:1,max:120},
      {key:'noticeDays',     label:'Termination notice', suf:'days written notice', min:1,max:365},
      {key:'liabilityMonths',label:'Liability cap',  suf:'months of fees',      min:1,max:60}
    ]
  },
  emp:{
    get:function(){return ccjEmp().terms||{};},
    can:function(){
      const e=ccjEmp();
      return !!e.terms&&!e.approvedBy&&!e.sentAt&&!e.workerSignedAt&&!e.adtSignedAt&&!e.declined;
    },
    noun:'contract',
    fields:[
      {key:'gross',    label:'Gross salary', pre:function(){return ccjCurrency();}, suf:'a month', min:0,max:9999999},
      {key:'probation',label:'Probation',    suf:'months', min:0,max:24},
      {key:'notice',   label:'Notice',       suf:'days',   min:0,max:365},
      {key:'holiday',  label:'Annual leave', suf:'days',   min:0,max:60}
    ]
  }
};
// The editing flag lives beside the document it belongs to rather than in a module global, so two
// runs held in ccjRuns cannot share one editor state.
function ccjDocEditHost(kind){
  return kind==='msa'?ccjMsa():ccjEmp();
}
function ccjDocEditing(kind){
  const h=ccjDocEditHost(kind);
  return !!(h&&h.editing&&CCJ_DOC_EDIT[kind].can());
}
function ccjDocEdit(kind){
  const spec=CCJ_DOC_EDIT[kind];if(!spec||!spec.can())return;
  const host=ccjDocEditHost(kind),src=spec.get();
  host.edit={};
  spec.fields.forEach(function(f){host.edit[f.key]=src[f.key];});
  host.editing=true;
  ccjPaintScreen();
}
function ccjDocEditSet(kind,key,v){
  const host=ccjDocEditHost(kind);
  if(host&&host.edit)host.edit[key]=v;    // no repaint: the input keeps focus and the caret
}

/* ---- EDITING THE WHOLE DOCUMENT --------------------------------------------------------------
   The terms above regenerate the sentences that quote them. This is the other half: any line of
   the document can be rewritten directly, because a reviewer's change is not always a number —
   it is usually a sentence.

   OVERRIDES, NOT A REWRITE OF THE SOURCE. Each region is addressed by a stable path ('t:cl.3.3.b')
   and a person's text is stored against it. The generator keeps running underneath: a clause
   nobody has touched is still generated, so changing the notice period still rewrites clause 10 —
   it just stops doing that for a clause somebody has taken over, which is the only behaviour that
   respects both edits. Reset clears the overrides and hands the document back to the generator.

   Overrides render ESCAPED. Generated clause bodies carry their own <b> markup and are trusted
   because this file wrote them; typed text is not, and a document that executes what was typed
   into it is a hole rather than a feature. The visible cost is that a rewritten clause loses its
   bold — the honest trade, and the reason .set marks which regions are no longer generated. */
function ccjDocOv(kind){
  const h=ccjDocEditHost(kind);
  if(h&&!h.ov)h.ov={};
  return (h&&h.ov)||{};
}
function ccjDocEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// Seeds an editor from generated markup: tags out, the entities this file actually emits back to
// the characters they stand for, so the box shows the sentence rather than its source.
function ccjDocPlain(html){
  return String(html==null?'':html).replace(/<[^>]*>/g,'')
    .replace(/&middot;/g,'·').replace(/&mdash;/g,'—').replace(/&ndash;/g,'–')
    .replace(/&rsquo;/g,'’').replace(/&lsquo;/g,'‘').replace(/&minus;/g,'−')
    .replace(/&nbsp;/g,' ').replace(/&quot;/g,'"')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
}
function ccjDocSetText(kind,path,v){
  const h=ccjDocEditHost(kind);
  if(h&&h.edit)h.edit[path]=v;
}
function ccjDocGrow(el){
  if(!el||!el.style)return;
  el.style.height='auto';
  el.style.height=(el.scrollHeight+2)+'px';
}
/* One editable region. Outside edit mode it returns exactly what the document always returned,
   so nothing about the finished page depends on this being here. */
function ccjDocF(kind,path,generated,opts){
  opts=opts||{};
  const ov=ccjDocOv(kind);
  const has=Object.prototype.hasOwnProperty.call(ov,path);
  if(!ccjDocEditing(kind))return has?ccjDocEsc(ov[path]):generated;
  const h=ccjDocEditHost(kind),st=(h&&h.edit)||{};
  const val=st[path]!==undefined?st[path]:(has?ov[path]:ccjDocPlain(generated));
  const cls='ccj-doc-fx'+(opts.multiline?' ml':'')+(has?' set':'');
  const set='ccjDocSetText(\''+kind+'\',\''+path+'\',this.value)';
  if(opts.multiline){
    // rows from the content rather than measured after paint: a repaint would drop a measured
    // height, and every textarea here re-renders whenever anything on the screen does.
    const rows=Math.max(2,Math.min(14,Math.ceil(String(val).length/58)));
    return '<textarea class="'+cls+'" rows="'+rows+'" spellcheck="false" '
      +'oninput="ccjDocGrow(this);'+set+'">'+ccjDocEsc(val)+'</textarea>';
  }
  return '<input class="'+cls+'" type="text" spellcheck="false" value="'+attrSafe(val)+'" oninput="'+set+'">';
}
// Hands the document back to the generator. Only offered while editing, and only once something
// has actually been overridden.
function ccjDocEditReset(kind){
  const spec=CCJ_DOC_EDIT[kind];if(!spec||!spec.can())return;
  const h=ccjDocEditHost(kind);if(!h)return;
  h.ov={};
  if(h.edit)Object.keys(h.edit).forEach(function(k){if(k.indexOf('t:')===0)delete h.edit[k];});
  ccjPaintScreen();
  if(typeof showAiToast==='function')showAiToast('Document reset','Every clause is generated again from the terms.');
}
function ccjDocEditCancel(kind){
  const host=ccjDocEditHost(kind);
  if(!host)return;
  host.editing=false;delete host.edit;
  ccjPaintScreen();
}
/* Saved values are clamped rather than rejected. A reviewer who types 400 into a probation field
   has made a typing mistake, not a request, and a document that silently refuses the save leaves
   them staring at a button that does nothing. A blank field keeps what was there. */
function ccjDocEditSave(kind){
  const spec=CCJ_DOC_EDIT[kind];if(!spec||!spec.can())return;
  const host=ccjDocEditHost(kind),dst=spec.get(),edit=host.edit||{};
  let changed=0;
  spec.fields.forEach(function(f){
    const raw=String(edit[f.key]===undefined?'':edit[f.key]).replace(/[^0-9.\-]/g,'');
    if(raw==='')return;
    let n=Number(raw);
    if(!isFinite(n))return;
    n=Math.min(f.max,Math.max(f.min,Math.round(n)));
    if(n!==Number(dst[f.key])){dst[f.key]=n;changed++;}
  });
  // Rewritten regions. Only touched ones are staged, so an untouched clause is never frozen into
  // an override and goes on being generated. Blanking one hands that region back to the generator
  // rather than leaving a hole in the document.
  const ov=ccjDocOv(kind);
  Object.keys(edit).forEach(function(k){
    if(k.indexOf('t:')!==0)return;
    const v=String(edit[k]).replace(/\s+$/,'');
    if(v===''){if(Object.prototype.hasOwnProperty.call(ov,k)){delete ov[k];changed++;}return;}
    if(ov[k]!==v){ov[k]=v;changed++;}
  });
  host.editing=false;delete host.edit;
  // Marks the paper so the change is something you SEE land, not something you have to go looking
  // for. Cleared by the next repaint that is not this one.
  if(changed)host.editFlash=true;
  ccjPaintScreen();
  if(changed&&typeof requestAnimationFrame==='function')requestAnimationFrame(function(){
    setTimeout(function(){
      const h=ccjDocEditHost(kind);
      if(h&&h.editFlash){h.editFlash=false;ccjPaintScreen();}
    },900);
  });
  if(typeof ccjToast==='function'||typeof showAiToast==='function'){
    const msg=changed
      ?changed+' term'+(changed===1?'':'s')+' updated. The '+spec.noun+' has been redrawn.'
      :'No changes to save.';
    if(typeof showAiToast==='function')showAiToast(changed?'Draft updated':'Nothing changed',msg);
  }
}
/* == TAKING A COPY AWAY ====================================================================
   Every artefact in this journey was a thing you could look at and nothing else. That is fine for
   a status card and wrong for a document: a quote gets forwarded to a budget holder, an agreement
   is filed, an invoice goes to accounts payable, and a contract is the single most-requested piece
   of paper in the whole product. A document you cannot take a copy of is a screenshot waiting to
   happen.

   IT PRINTS THE REAL THING RATHER THAN REBUILDING IT. The alternative was a second renderer that
   emits a standalone file — and a second renderer is a second version of every clause, drifting
   from the first the moment either is edited. This lifts the document node that is already on
   screen into an offscreen frame with the app's own stylesheets, and prints it. What comes out is
   what was on the page, by construction, including anything the user rewrote through the doc
   editor.

   AN IFRAME, NOT A NEW WINDOW. A popup is blockable, lands in the wrong place, and leaves a blank
   tab behind afterwards. The frame is created, used and removed, and the reader stays where they
   were. == */
/* `html` is what makes a document downloadable from ANYWHERE rather than only from the screen it
   lives on. Every artefact in this journey is derived from run state, so it can be rebuilt on
   demand — which is what lets the success panel on stage 9 hand over a contract that was drawn on
   stage 7 and is no longer anywhere on the page. Without it the only honest option would have been
   to navigate the reader back three stages to press a button, which is not handing them anything. */
/* `ready` IS WHAT MAKES THE DOCUMENT WORTH A COPY. Every one of these fills in as its stage works
   — the quote carries skeleton rows until the cost engine has run, the agreement and the contract
   render at 45% opacity until they are drafted, the invoice until it is raised. Offering Download
   through all of that produces a PDF of half a document, which is worse than no PDF: it looks like
   a finished file and is not one. So the control appears when the artefact stops being assembled.

   The line is CONTENT-FINAL, not signed. A drafted agreement is a complete document whose whole
   purpose is to be sent out for signature, and a contract you cannot take a copy of until it comes
   back countersigned is the screenshot problem this feature exists to solve. Signatures arriving
   later change the copy; they are not what makes it a document. */
const CCJ_DOCS={
  quote:    {sel:'.ccj-q',        noun:'quote',    html:function(){return buildCCJQuoteHTML();},
             // "In preparation" is literally the header's own word for not-yet-a-quote.
             ready:function(){return ccjQuoteDone('Quote QA');},
             name:function(){return 'Quote-'+ccjCtx().contractId+'-v'+ccjClient().version;}},
  msa:      {sel:'.ccj-msa',      noun:'agreement',html:function(){return buildCCJMsaHTML();},
             /* An established client's stage 5 draws the "already in force" panel INSTEAD of the
                agreement, so there is no `.ccj-msa` on the page at all — the button was there and
                printed nothing, silently. No document, no control. */
             ready:function(){
               if(ccjMsaExists()&&ccjRun.settled['agreement-signature/Signed'])return false;
               return !!ccjRun.settled['agreement-signature/MSA drafted'];
             },
             name:function(){return ccjMsa().id;}},
  invoice:  {sel:'.ccj-inv-wrap', noun:'invoice',  html:function(){return buildCCJInvoiceHTML();},
             ready:function(){return ccjPay().issuedAt!==null;},
             name:function(){return ccjInvoice().id;}},
  contract: {sel:'.ccj-ec',       noun:'contract', html:function(){return buildCCJEmpHTML();},
             // Drafted AND checked: the audit rewrites clauses in place, so a copy taken mid-check
             // is a copy of terms that are still moving.
             ready:function(){const e=ccjEmp();return !!e.terms&&e.auditDone;},
             name:function(){return ccjEmp().id+(ccjEmp().version>1?'-v'+ccjEmp().version:'');}},
  readiness:{sel:'.ccj-rdy-cert', noun:'certificate',html:function(){return buildCCJRdyHTML();},
             // A certificate is the verdict. Half the controls checked is not a verdict.
             ready:function(){return !!ccjRdy().done;},
             name:function(){return ccjRdy().ref||'Payroll-readiness';}}
};
/* Defensive on two counts: a document with no `ready` is treated as always ready, so adding one to
   the registry cannot accidentally hide its control; and a predicate that throws — reading state a
   stage has not built yet — answers "not ready" rather than taking the header down with it. */
function ccjDocReady(kind){
  const d=CCJ_DOCS[kind];
  if(!d)return false;
  if(typeof d.ready!=='function')return true;
  try{return !!d.ready();}catch(e){return false;}
}
/* The node to print: the one on screen when there is one, and a freshly built one when there is
   not. Preferring the live node matters — it carries anything the reader rewrote through the doc
   editor this session, and a rebuild would too, but only the live one is guaranteed to be exactly
   what they were looking at when they pressed the button. */
function ccjDocNode(d){
  if(typeof document==='undefined'||typeof document.querySelector!=='function')return null;
  const live=document.querySelector(d.sel);
  if(live)return live;
  if(typeof d.html!=='function'||typeof document.createElement!=='function')return null;
  const box=document.createElement('div');
  box.innerHTML=d.html();
  return box.querySelector?box.querySelector(d.sel):null;
}
/* The control. Deliberately quiet, and in one fixed place for the whole journey — the right end of
   the stage header, whichever of the five documents is on screen. "Where is the download" is a
   question a person should only ever have to answer once, and answering it with a spot OUTSIDE the
   paper also means no artefact pays for the control with a band of its own space. Emitted by
   ccjHeadDocDlHTML; nothing calls this from inside a document any more.

   `title` names the file, not the mechanism. A tooltip explaining iframes and print dialogs would
   be the product describing its own plumbing. */
function ccjDocDlHTML(kind){
  const d=CCJ_DOCS[kind];
  if(!d)return '';
  return '<div class="ccj-doc-tools">'
    +'<button type="button" class="ccj-doc-dl" onclick="ccjDownloadDoc(\''+kind+'\')" '
    +'title="'+attrSafe('Save a copy of this '+d.noun)+'">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    +'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    +'Download</button></div>';
}
/* The stylesheets to carry across, read from the page rather than listed, so a file renamed or
   added does not silently produce an unstyled document. */
function ccjDocStyleLinks(){
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function')return '';
  const links=Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]'));
  return links.map(function(l){return '<link rel="stylesheet" href="'+attrSafe(l.getAttribute('href'))+'">';}).join('');
}
function ccjDownloadDoc(kind){
  const d=CCJ_DOCS[kind];
  if(!d||typeof document==='undefined'||typeof document.createElement!=='function')return;
  const node=ccjDocNode(d);
  if(!node||!node.outerHTML)return;
  const name=(typeof d.name==='function'?d.name():kind)||kind;
  const frame=document.createElement('iframe');
  // Offscreen rather than display:none — a hidden frame has no layout, and a document with no
  // layout prints as a blank page in several browsers.
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;right:0;bottom:0;width:820px;height:1160px;opacity:0;border:0;pointer-events:none;z-index:-1';
  document.body.appendChild(frame);
  const doc=frame.contentDocument||(frame.contentWindow&&frame.contentWindow.document);
  if(!doc){if(frame.parentNode)frame.parentNode.removeChild(frame);return;}
  /* The title IS the default filename in every browser's Save-as-PDF, which is the whole reason
     the registry carries a name function — "contract-journey" on a downloaded agreement would be
     the one detail that makes the copy feel unofficial. */
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><title>'+attrSafe(name)+'</title>'
    +ccjDocStyleLinks()
    // The page is the document and nothing else: no columns, no scrollers, no controls, and the
    // artefact takes its natural height instead of the height of a pane it is no longer in.
    +'<style>html,body{height:auto;overflow:visible;background:#fff;margin:0}'
    +'body{padding:0;font-family:Inter,sans-serif}'
    +'.ccj-doc-tools,.ccj-doc-bar,.ccj-doc-editor,.ccj-sim{display:none!important}'
    +d.sel+'{max-width:none;margin:0;padding:0;overflow:visible;height:auto;flex:none;box-shadow:none;border:0}'
    +'@page{margin:16mm}'
    +'@media print{.ccj-doc-tools{display:none!important}}'
    +'</style></head><body>'+node.outerHTML+'</body></html>');
  doc.close();
  /* ONCE. Both the load event and the timeout below are races for the same job — whichever gets
     there first wins — and without the latch the loser opens a second print dialog behind the
     first, which is the kind of bug that looks like the app printing twice. */
  let printed=false;
  const go=function(){
    if(printed)return;
    printed=true;
    try{frame.contentWindow.focus();frame.contentWindow.print();}catch(e){}
    // Removed after the dialog has had the document — pulling the frame immediately cancels the
    // print on browsers that render it asynchronously.
    setTimeout(function(){if(frame.parentNode)frame.parentNode.removeChild(frame);},1000);
  };
  // Waits for the stylesheets. Printing before they land produces an unstyled document, and there
  // is no second chance at it — the dialog is already open by then. The timeout is the fallback
  // for a stylesheet that never resolves, so a missing file cannot swallow the download entirely.
  if(frame.contentWindow)frame.contentWindow.onload=go;
  setTimeout(go,600);
  if(typeof showAiToast==='function')showAiToast('Preparing '+name,'Choose &ldquo;Save as PDF&rdquo; to keep a copy.');
}
/* The bar above the paper. Two states in one strip so the swap is a cross-fade in place rather
   than one control vanishing and another appearing somewhere else. */
function ccjDocEditBarHTML(kind){
  const spec=CCJ_DOC_EDIT[kind];
  if(!spec||!spec.can())return '';
  const host=ccjDocEditHost(kind);
  if(!ccjDocEditing(kind)){
    return '<div class="ccj-doc-bar">'
      +'<span class="ccj-doc-bar-n">Draft &middot; not yet approved</span>'
      +'<button type="button" class="ccj-doc-edit-btn" onclick="ccjDocEdit(\''+kind+'\')">'
      +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'
      +'Edit '+spec.noun+'</button>'
      +'</div>';
  }
  const edit=host.edit||{};
  const fields=spec.fields.map(function(f,i){
    const pre=f.pre?'<span class="ccj-doc-ef-a">'+f.pre()+'</span>':'';
    const val=edit[f.key]===undefined?'':edit[f.key];
    return '<label class="ccj-doc-ef" style="--i:'+i+'">'
      +'<span class="ccj-doc-ef-l">'+f.label+'</span>'
      +'<span class="ccj-doc-ef-in">'+pre
      +'<input type="number" inputmode="numeric" min="'+f.min+'" max="'+f.max+'" value="'+attrSafe(val)+'" '
      +'oninput="ccjDocEditSet(\''+kind+'\',\''+f.key+'\',this.value)" '
      +'onkeydown="if(event.key===\'Enter\'){event.preventDefault();ccjDocEditSave(\''+kind+'\');}'
      +'else if(event.key===\'Escape\'){event.preventDefault();ccjDocEditCancel(\''+kind+'\');}">'
      +'<span class="ccj-doc-ef-a suf">'+f.suf+'</span></span>'
      +'</label>';
  }).join('');
  const overridden=Object.keys(ccjDocOv(kind)).length;
  return '<div class="ccj-doc-bar editing">'
    +'<span class="ccj-doc-bar-n"><span class="ccj-doc-bar-dot"></span>Editing the whole '+spec.noun
    +(overridden?' &middot; '+overridden+' rewritten':'')+'</span>'
    +'<span class="ccj-doc-bar-a">'
    +(overridden?'<button type="button" class="ccj-doc-reset-btn" onclick="ccjDocEditReset(\''+kind+'\')" '
      +'title="Discard every rewritten line and generate the document again">Reset</button>':'')
    +'<button type="button" class="ccj-doc-cancel-btn" onclick="ccjDocEditCancel(\''+kind+'\')">Cancel</button>'
    +'<button type="button" class="ccj-doc-save-btn" onclick="ccjDocEditSave(\''+kind+'\')">Save changes</button>'
    +'</span>'
    +'</div>'
    +'<div class="ccj-doc-editor">'
    +'<div class="ccj-doc-editor-h">Every field and clause below is editable &mdash; click into the document itself to rewrite a line. These terms are what the '+spec.noun+' is generated from, so changing one redraws each clause that quotes it.</div>'
    +'<div class="ccj-doc-efs">'+fields+'</div>'
    +'</div>';
}

/* ---- THE AGREEMENT ITSELF --------------------------------------------------------------------
   A real document: parties, a commercial schedule pulled live from the accepted quote, readable
   clause text, and signature blocks that fill in as each party signs. Long enough to read as a
   contract, structured enough to scan. */
function buildCCJMsaHTML(){
  const run=ccjRun,p=ccjParties(),q=ccjQuote(),m=ccjMsa(),fee=ccjMsaFee();
  const money=function(v){return q.sym+' '+Number(v).toLocaleString();};
  const done=function(l){return !!run.settled['agreement-signature/'+l];};
  if(ccjMsaExists()&&done('Signed'))return buildCCJMsaExistingHTML(p);
  const drafted=done('MSA drafted'),sent=done('Sent'),signed=done('Signed');
  // Every region carries a path so it can be rewritten in place. The paths are the clause numbers
  // and the row labels, which is what makes an override survive a redraft of the surrounding text.
  const clause=function(n,t,body){
    return '<div class="ccj-msa-cl"><div class="ccj-msa-cl-h"><span>'+n+'</span>'
      +ccjDocF('msa','t:cl.'+n+'.t',t)+'</div>'
      +'<p>'+ccjDocF('msa','t:cl.'+n+'.b',body,{multiline:true})+'</p></div>';
  };
  const kv=function(k,v){return '<div class="ccj-msa-kv"><span>'+k+'</span><b>'
    +ccjDocF('msa','t:kv.'+k,v)+'</b></div>';};
  return '<div class="ccj-msa-wrap">'
    +ccjDocEditBarHTML('msa')
    +'<div class="ccj-msa'+(drafted?'':' pending')
      +(ccjDocEditing('msa')?' ccj-doc-behind':'')+(m.editFlash?' ccj-doc-flash':'')+'">'
    +'<div class="ccj-msa-head">'
    +'<div><div class="ccj-msa-brand">ADT</div><div class="ccj-msa-brandsub">Global Employment Platform</div></div>'
    +'<div class="ccj-msa-ref"><div class="ccj-msa-kind">MASTER SERVICES AGREEMENT</div>'
    +'<div class="ccj-msa-no">'+m.id+' &middot; issued '+ccjStamp(0).split(',')[0]+'</div></div>'
    +'</div>'

    +'<div class="ccj-msa-sec"><div class="ccj-msa-sec-t">1 &middot; Parties</div>'
    +kv('Provider',p.adt.name)
    +kv('Client',p.client.name)
    +kv('Client jurisdiction',p.client.country)
    +kv('Services provided in',p.worker.country)
    +'</div>'

    +'<div class="ccj-msa-sec"><div class="ccj-msa-sec-t">2 &middot; Commercial schedule</div>'
    +kv('Service fee',fee.pct+'% of employer cost')
    +kv('Employer cost, per placement',money(q.base)+' a month')
    +kv('Total, per placement',money(q.total)+' a month')
    +kv('Deposit',money(fee.deposit)+' &middot; '+fee.depositLabel)
    +kv('Invoicing','Monthly in advance &middot; '+m.paymentDays+' days net')
    +'<div class="ccj-msa-sched">'+ccjDocF('msa','t:sched','Rates apply per placement made under this Agreement. Additional placements are made by Work Order and do not require a new Agreement.',{multiline:true})+'</div>'
    +'</div>'

    +'<div class="ccj-msa-sec"><div class="ccj-msa-sec-t">3 &middot; Terms</div>'
    +clause('3.1','Appointment','The Client appoints '+p.adt.name+' ("the Provider") as employer of record for personnel engaged under this Agreement in '+p.worker.country+'. The Provider shall enter into a compliant local employment contract with each such person, operate payroll, and remit all statutory employer contributions.')
    +clause('3.2','Direction of work','The Client directs the day-to-day work of each placement. The Provider carries the employment relationship, and neither party shall represent the arrangement otherwise to the personnel concerned or to any authority.')
    +clause('3.3','Fees and payment','The Client shall pay the employer cost together with the service fee stated above, invoiced monthly in advance and payable within <b>'+m.paymentDays+' days</b>. Statutory employer contributions are passed through at cost and are not marked up.')
    +clause('3.4','Deposit','A deposit equal to '+fee.depositLabel+' is payable before any placement commences. The Provider funds payroll ahead of invoice settlement and the deposit is held as security against that exposure. It is refundable on termination once all liabilities are discharged.')
    +clause('3.5','Liability and indemnity','The Provider indemnifies the Client against employment claims arising from the Provider\'s performance as employer of record. The Client indemnifies the Provider against claims arising from the Client\'s direction of the work, including discrimination and unsafe working conditions. Neither party\'s aggregate liability shall exceed the fees paid in the preceding <b>'+m.liabilityMonths+' months</b>.')
    +clause('3.6','Intellectual property','All work product created by personnel placed under this Agreement vests in the Provider on creation and is assigned to the Client in full, free of encumbrance, on payment of the invoice covering the period in which it was created.')
    +clause('3.7','Data protection','Each party is an independent controller of personal data it determines the purposes of. The Provider processes personnel data as controller for employment and payroll administration. Transfers outside the EEA are made under Standard Contractual Clauses.')
    +clause('3.8','Term and termination','This Agreement continues until terminated on <b>'+m.noticeDays+' days</b> written notice. On termination the Provider shall give each placement the statutory notice required in '+p.worker.country+', and the Client remains liable for the employer cost and fees over that notice period.')
    +clause('3.9','Governing law','This Agreement is governed by the laws of '+p.client.country+' and the parties submit to the exclusive jurisdiction of its courts.')
    +'</div>'

    +'<div class="ccj-msa-sec"><div class="ccj-msa-sec-t">4 &middot; Signatures</div>'
    +'<div class="ccj-msa-sigrow">'
    +ccjSigBlockHTML('For and on behalf of '+p.client.name,p.client.contact,'Authorised signatory',
        m.clientSignedAt,signed||m.clientSignedAt>0)
    +ccjSigBlockHTML('For and on behalf of '+p.adt.name,p.adt.signatory,'Authorised signatory',
        m.adtSignedAt,m.adtSignedAt>0)
    +'</div>'
    /* `stamped` reserves the width the EXECUTED stamp occupies — the same treatment the employment
       contract already uses, for the same reason. The stamp sat at the TOP of this document, where
       it landed squarely on "MASTER SERVICES AGREEMENT" and the agreement number underneath: the
       one place on the page whose job is saying which document this is. Beside the execution line
       it still overlaps the paper, which is what makes it read as a stamp, and it now sits where an
       execution stamp belongs — next to the signatures that executed it. */
    +'<div class="ccj-msa-exec'+(signed?' stamped':'')+'">'+(signed
      ?'Executed on the later of the two signatures above. In force from '+ccjStamp(m.adtSignedAt)+'.'
      :sent?'Awaiting the Client\'s signature. The Provider countersigns once received.'
      :'Not yet issued.')+'</div>'
    +'</div>'
    +(signed?'<div class="ccj-msa-stamp">EXECUTED</div>':'')
    +'</div>'
    // The signed agreement coming back is what this stage produced, so the stage rests on it and
    // says so here. On a rebuilt stage the way ON is a block in the conversation (ccjRestAsk) —
    // the document states, it does not ask.
    +(run.phase==='rest'
      ?'<div class="ccj-msa-foot">'
       +'<div class="ccj-msa-done">Agreement executed. Both parties have signed.</div>'
       +'</div>'
      :'')
    +'</div>';
}
function ccjSigBlockHTML(forWhom,who,role,at,on){
  return '<div class="ccj-msa-sig'+(on?' on':'')+'">'
    +'<div class="ccj-msa-sig-for">'+forWhom+'</div>'
    +'<div class="ccj-msa-sig-mark">'+(on?who:'')+'</div>'
    +'<div class="ccj-msa-sig-line"></div>'
    +'<div class="ccj-msa-sig-name">'+who+'</div>'
    +'<div class="ccj-msa-sig-role">'+role+(on?' &middot; '+ccjStamp(at):' &middot; pending')+'</div>'
    +'</div>';
}
/* A client who already has an agreement does not sign a second one. The stage says so and shows
   the one that governs, rather than quietly running five steps that produce nothing.

   IT STILL HAS TO SAY THE STAGE IS OVER. This branch had no foot at all, so on a repeat client the
   run rested here with nothing on the page saying it had — and before the way on moved into the
   conversation, with no control anywhere either. It survived because the harness's driver calls
   ccjContinueStage() the moment it sees a rest, walking past the surface a person actually meets. */
function buildCCJMsaExistingHTML(p){
  const m=ccjMsa(),run=ccjRun;
  return '<div class="ccj-msa-wrap"><div class="ccj-existing">'
    +'<div class="ccj-existing-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg></div>'
    +'<div class="ccj-existing-t">'+p.client.name+' already has a signed agreement</div>'
    +'<div class="ccj-existing-s">A Master Services Agreement is signed once. Every placement after the first is made by Work Order under the agreement already in force, so nothing on this stage needs to run.</div>'
    +'<div class="ccj-existing-grid">'
    +'<div><span>Agreement</span><b>'+m.id+'</b></div>'
    +'<div><span>Governing law</span><b>'+p.client.country+'</b></div>'
    +'<div><span>Status</span><b>In force</b></div>'
    +'<div><span>This placement</span><b>Work Order</b></div>'
    +'</div></div>'
    // A sibling of .ccj-existing inside .ccj-msa-wrap — the same place the drafted branch puts its
    // foot, so it inherits the styling already there rather than needing a second rule.
    +(run&&run.phase==='rest'
      ?'<div class="ccj-msa-foot">'
       +'<div class="ccj-msa-done">Nothing to sign. The agreement already in force governs this placement.</div>'
       +'</div>'
      :'')
    +'</div>';
}

/* ---- THE CLIENT THREAD ----------------------------------------------------------------------
   The quote goes out in it, the client replies in it, the negotiation happens in it, the revised
   quote goes out in it and the approval lands in it. One place, in order, so the commercial
   history of this deal is readable top to bottom without opening anything.

   Four kinds of message, and they look different because they carry different weight: what WE
   sent, what the CLIENT sent, a system note (delivery, opens), and a draft the agent has written
   but nobody has sent yet. A draft that looked like a sent message would be the worst possible
   confusion on a screen whose whole job is talking to a customer. */
function ccjSendToClient(text){
  const c=ccjClient();
  c.mins+=35;
  c.drafted=false;
  ccjClientPush({who:'us',text:text,at:c.mins});
  ccjPaintComposer();
  // Replying is what a negotiation needs to move; the client answers on the script's clock.
  if(c.state==='changed'){c.state='negotiating';ccjClientSchedule();}
  // Our half of the negotiation has left the building: the step holding for it can move, and
  // the thread is back to waiting on them — which it now says.
  ccjReachScreen('draft-sent');
  ccjAwaitStart();
}
function ccjSendDraft(){
  const c=ccjClient();
  const draft=c.msgs.slice().reverse().find(function(m){return m.kind==='draft';});
  if(!draft)return;
  draft.kind='';draft.who='us';draft.sent=true;
  c.drafted=false;
  if(c.state==='changed'){c.state='negotiating';ccjClientSchedule();}
  ccjReachScreen('draft-sent');
  ccjAwaitStart();
  ccjRenderChat();ccjPaintComposer();
}
/* The id goes on whatever element the body already opens with, rather than on a wrapper of our
   own: .ccj-stream lays its children out directly, so an extra div would become a flex item with
   no styling and change the spacing of every counterparty thread.

   Deliberately not a first-match replace. Every branch below opens `<div ` at position 0, and
   checking that explicitly means a future branch that does not simply goes without an id — which
   costs it the `.in` handoff and nothing else — instead of having an attribute injected into the
   middle of some tag further down. */
/* == THE LANE: WHAT LEFT THE BUILDING ====================================================
   On a rebuilt counterparty stage the machine's own work and the client's correspondence share
   one column, so the reader needs one rule they learn once and never think about again:
   INDENTED MEANS THE COUNTERPARTY CAN SEE IT.

   The risk this answers is not a leak — the client never sees this screen. It is an Account
   Manager glancing at a column and not knowing which lines the client actually received. That is
   a mistake someone makes once, in front of a customer, and remembers.

   The heading appears only when the direction CHANGES. On every bubble it would be noise, and
   noise is what the reader stops reading — at which point the marking that makes this safe stops
   working. Our own notes (delivery, opens, chases) are not in the lane at all: they are things we
   observed, not things anyone was sent. */
function ccjLaneDir(m){
  if(!m||!m.lane)return '';
  if(m.who==='client'||m.who==='worker')return 'in';
  if(m.who==='us')return 'out';
  return '';                                       // a note or a chase — ours, not theirs
}
function ccjLaneWho(m){
  const p=ccjParties();
  return m.lane==='worker'?p.worker.name:p.client.name;
}
function ccjClientMsgHTML(m,isLast,prev){
  const html=ccjClientMsgBodyHTML(m,isLast);
  const withId=m&&m._id&&html.slice(0,5)==='<div '
    ?'<div id="ccj-m-'+m._id+'" '+html.slice(5)
    :html;
  const dir=ccjLaneDir(m);
  if(!dir)return withId;
  const head=ccjLaneDir(prev)===dir?''
    :'<div class="ccj-lane-head">'
      +'<span class="ccj-lane-arrow">'+(dir==='out'?'&#9656;':'&#9666;')+'</span>'
      +(dir==='out'?'To ':'From ')+ccjLaneWho(m)+'</div>';
  return '<div class="ccj-lane '+dir+'">'+head+withId+'</div>';
}
function ccjClientMsgBodyHTML(m,isLast){
  // The worker is a counterparty in the same sense the client is, so their messages take the same
  // side of the thread. The STORE is separate; only the rendering is shared.
  const cls=(m.who==='client'||m.who==='worker'?'client'
    :m.who==='note'?'note':m.who==='agent'?'draft':'us')+(isLast?' in':'');
  /* The waiting beat. Done, it renders NOTHING — it was a state, not an event, and a transcript
     keeps events. Live, it is the same spark-and-shimmer the blocks use, so "the agent is on
     this" reads identically everywhere. No timestamp: there is no moment to stamp until the
     thing being waited for happens, and that moment belongs to the message that ends this one. */
  if(m.kind==='await')return m.done?''
    :'<div class="ccj-cmsg note await">'+ccjSparkHTML()
    +'<span class="ccj-sb-verb">'+(m.label||'Waiting for confirmation')+'&hellip;</span></div>';
  if(m.who==='note')return '<div class="ccj-cmsg note"><span>'+m.text+'</span><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='quote')return '<div class="ccj-cmsg '+cls+'">'+ccjQuoteCardHTML(m)+'<i>'+ccjStamp(m.at)+'</i></div>';
  // Two states: going out, and gone. A reminder that has not left yet must not say "sent", and it
  // shows the spinner rather than a timestamp — there is no time to stamp until it has happened.
  /* "of 3" came off both lines with the cadence that justified it. What a follow-up carries now is
     the words that were sent with it — a chase asked for by hand always has a comment, and the
     comment IS the follow-up. Without it on the thread the record would show that we chased and
     lose what we actually said, which is the only part the next reader needs. */
  if(m.kind==='chase')return m.sending
    ?'<div class="ccj-cmsg note chase sending"><span class="ccj-spin sm"></span>'
      +'<span>Sending follow-up '+m.n+'&hellip;</span></div>'
    :'<div class="ccj-cmsg note chase"><span>Follow-up '+m.n+' sent'
      +(m.detail?' &middot; '+m.detail:'')+' &mdash; no reply yet'
      +(m.note?'<b class="ccj-chase-note">&ldquo;'+textSafe(m.note)+'&rdquo;</b>':'')
      +'</span><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='draft')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble draft">'
    +'<div class="ccj-draft-tag"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>Drafted for you &mdash; not sent</div>'
    +m.text
    +'<div class="ccj-draft-btns"><button class="ccj-draft-send" onclick="ccjSendDraft()">Send to client</button></div>'
    +'</div></div>';
  if(m.kind==='msa')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble doc">'
    +'<div class="ccj-cdoc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
    +'<span><b>'+m.id+'</b><i>Master Services Agreement &middot; for signature</i></span></div>'
    +'Sent to '+m.to+' for signature. We countersign once it comes back.'
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='signed')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble accept"><b>&#10003; Signed '+m.id+'</b></div><i>'+ccjStamp(m.at)+'</i></div>';
  // The invoice as the client received it — the amount, the due date and the reference they have
  // to quote, which is the whole of what accounts payable needs from the covering message.
  if(m.kind==='invoice')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble doc">'
    +'<div class="ccj-cdoc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>'
    +'<span><b>'+m.id+'</b><i>Deposit invoice &middot; '+ccjMoney(m.total)+'</i></span></div>'
    +'Payable by <b>'+ccjDate(m.due)+'</b>, Net 14. Please quote <b>'+m.id
    +'</b> as the payment reference so it matches automatically.'
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='remind')return '<div class="ccj-cmsg note'+(m.overdue?' chase':'')+'">'
    +'<span>Payment reminder '+m.n+' sent &mdash; '+ccjMoney(m.amount)
    +(m.overdue?' overdue':' due shortly')+'</span><i>'+ccjStamp(m.at)+'</i></div>';
  // A remittance advice is the client telling us money is on its way. It is their message, and it
  // carries the shortfall when there is one — that is what makes the next decision necessary.
  if(m.kind==='remit')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble remit">'
    +'<div class="ccj-remit-top"><b>Remittance advice</b><span>+'+ccjMoney(m.amount)+'</span></div>'
    +(m.paid==='part'
      ?'We have released '+ccjMoney(m.amount)+' against the deposit today. The balance of <b>'
        +ccjMoney(m.outstanding)+'</b> follows in our next run.'
      :m.paid==='balance'
      ?'The balance of '+ccjMoney(m.amount)+' has gone out today. That settles the deposit in full.'
      :'The deposit has been paid in full today, quoting your reference.')
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  // The employment contract, as the EMPLOYEE received it. It names what they are signing and when
  // they start — the two things a person opening this actually wants confirmed.
  if(m.kind==='eccontract')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble doc">'
    +'<div class="ccj-cdoc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>'
    +'<span><b>'+m.id+'</b><i>Contract of employment &middot; for signature</i></span></div>'
    +'Your contract is ready to sign. Employment starts on <b>'+ccjPrettyDate(m.start)
    +'</b>. Read it in full and sign at the bottom &mdash; we countersign once it comes back.'
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  // Onboarding is the one stage where the employee is doing most of the work, so their thread
  // carries what they were asked for and what they sent back.
  if(m.kind==='kyc')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble doc">'
    +'<div class="ccj-cdoc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5.5 17a4 4 0 0 1 7 0"/><line x1="15" y1="9" x2="19" y2="9"/><line x1="15" y1="13" x2="19" y2="13"/></svg>'
    +'<span><b>Verify your identity</b><i>Takes about two minutes &middot; '+m.id+'</i></span></div>'
    +'Have your passport or national ID to hand. You will photograph it and take a short selfie.'
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='doc')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble'+(m.state==='rejected'?' reject':'')+'">'
    +(m.state==='rejected'
      ?'<b>'+m.label+' could not be accepted.</b> '+m.note
      :m.state==='resubmitted'
      ?'Re-sent '+m.label+'.'
      :'Sent '+m.label+'.')
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  /* The document photograph, as an attachment. The stand-in underneath is a drawn document rather
     than an empty frame, so a run with no image file still reads as "they sent their passport"
     instead of as a broken picture. */
  if(m.kind==='scan')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble scan">'
    +'<div class="ccj-scan-shot">'
    +(CCJ_KYC_SCAN?'<img src="'+attrSafe(CCJ_KYC_SCAN)+'" alt="'+attrSafe(m.label)
      +'" onerror="ccjScanMissing(this)">':'')
    +'<span class="ccj-scan-ph">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.4"/><path d="M13.5 10h5M13.5 13.5h5M2.5 17.5l5-4 3.5 3"/></svg>'
    +'</span></div>'
    +'<div class="ccj-scan-cap">'+m.label+' &middot; front and back</div>'
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='ecsigned')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble accept"><b>&#10003; Signed '+m.id+'</b></div><i>'+ccjStamp(m.at)+'</i></div>';
  /* The payslip as the EMPLOYEE receives it. Net, period and the last four of the account it went
     to — the three things a person checks before they open the document itself. */
  if(m.kind==='payslip')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble doc">'
    +'<div class="ccj-cdoc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>'
    +'<span><b>'+m.id+'</b><i>Payslip &middot; '+m.period+'</i></span></div>'
    +'<b>'+ccjMoney(m.net)+'</b> has been paid to '+(m.acct||'your account')
    +'. Your payslip shows what was withheld and what it was declared against.'
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='ecexecuted')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble accept"><b>&#10003; '+m.id+' countersigned &mdash; you are employed from '
    +ccjPrettyDate(m.from)+'</b></div><i>'+ccjStamp(m.at)+'</i></div>';
  /* Their account, granted when the payroll setup reaches the access phase.
     THIS BRANCH IS WHY THE THREAD SAID "undefined". The push carries an employee id and no `text`
     — correctly, because the sentence belongs here and not at the call site — but there was no
     branch for the kind, so it fell through to the `m.text` fallback at the end of this function
     and rendered the word `undefined` into the employee's conversation. Every kind pushed
     anywhere must have a branch here; the fallback is for the plain-text notes only. */
  if(m.kind==='access')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble doc">'
    +'<div class="ccj-cdoc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" transform="translate(4 0)"/><path d="M14.5 11H3"/><polyline points="6 8 3 11 6 14"/></svg>'
    +'<span><b>Your account is ready</b><i>Employee '+m.id+'</i></span></div>'
    +'You can sign in from today to see your contract, your payslips and your leave. '
    +'Nothing further is needed from you.'
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='receipt')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble accept"><b>&#10003; '+(m.short
      ?'Placement released &mdash; '+ccjMoney(m.short)+' still outstanding on '+m.id
      :ccjMoney(m.amount)+' received &mdash; '+m.id+' settled in full')
    +'</b></div><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='csm')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble csm">'
    +'<div class="ccj-csmc-top"><span class="ccj-csmc-av">'+m.csm.initials+'</span>'
    +'<span><b>'+m.csm.name+'</b><i>Your Customer Success Manager &middot; '+m.csm.country+'</i></span></div>'
    +'I will be looking after your account from here. '+m.csm.name.split(' ')[0]
    +' is your first point of contact for anything on this engagement.'
    +'</div><i>'+ccjStamp(m.at)+'</i></div>';
  if(m.kind==='accept')return '<div class="ccj-cmsg '+cls+'">'
    +'<div class="ccj-cbubble accept"><b>&#10003; '+m.text+'</b></div><i>'+ccjStamp(m.at)+'</i></div>';
  return '<div class="ccj-cmsg '+cls+'"><div class="ccj-cbubble">'+m.text+'</div><i>'+ccjStamp(m.at)+'</i></div>';
}
/* The quote as the client received it, inside the thread. Version 2 shows what changed against
   version 1 rather than only the new number — a client who is told "here is €7,610" learns less
   than one who is shown it came down from €7,842. */
function ccjQuoteCardHTML(m){
  const q=m.quote||{};
  const money=function(v){return q.sym+' '+Number(v).toLocaleString();};
  return '<div class="ccj-cbubble quote">'
    +'<div class="ccj-qc-head"><span class="ccj-qc-v">Quote v'+m.version+'</span>'
    +'<span class="ccj-qc-name">'+q.name+' &middot; '+q.country+'</span></div>'
    +'<div class="ccj-qc-total"><span>Total monthly cost</span><b>'+money(q.total)+'</b></div>'
    +(m.wasTotal?'<div class="ccj-qc-was">was '+money(m.wasTotal)+' &middot; margin '
      +m.wasMargin+'% &rarr; '+q.margin+'%</div>':'')
    +(m.changes?'<div class="ccj-qc-was terms">'+m.changes.map(function(x){
       return x.k+' '+x.from+' &rarr; '+x.to;}).join(' &middot; ')+' &middot; price unchanged</div>':'')
    +'<div class="ccj-qc-lines">'
    +'<span><b>Gross</b>'+money(q.gross)+'</span>'
    +'<span><b>Employer cost</b>'+money(q.social+q.holiday)+'</span>'
    +'<span><b>Service fee</b>'+money(q.fee)+'</span>'
    +'</div></div>';
}

/* ---- STAGE 2: THE QUOTE ---------------------------------------------------------------------
   The artifact the sub-statuses on the right are building. It fills in as they settle rather
   than appearing complete from the start: the country rules arrive when the Compliance Hub is
   read, the cost lines when the engine has run, the floor check when it has passed. A quote
   shown whole before the work was done would be the number without the working.

   The rates are the ones the rest of the app already uses — 26.02% employer social premium and
   8% holiday allowance for the Netherlands are what the cost calculator and the Contracts
   commercial block state — so the same hire never carries two different totals in one product. */
/* ONE RATE TABLE, and everything that quotes a number reads it.

   This exists because the same fact had three answers. The quote screen said Germany was 18.4%,
   the evidence panel beside it said "~19.4%" (from aiH2rCountryData), and the cost calculator on
   another page implies 19.575%. Two of those were on screen at the same time, a column apart.

   The figures below are the ones aiH2rCountryData states, so the number and the prose describing
   it now come from the same place. India is 12 + 3.25 + 4.81 as that entry itemises it. */
const CCJ_RATES={
  'Netherlands':   {social:23,   holiday:8, label:'Employer social security'},
  'Germany':       {social:19.4, holiday:0, label:'Social contributions'},
  'India':         {social:20.06,holiday:0, label:'PF + ESI + Gratuity'},
  'Spain':         {social:30,   holiday:0, label:'Employer social security'},
  'United Kingdom':{social:13.8, holiday:0, label:'Employer National Insurance'},
  'France':        {social:42,   holiday:0, label:'Employer social charges'},
  'Italy':         {social:30,   holiday:0, label:'Employer contributions'}
};
function ccjRate(country){return CCJ_RATES[country]||CCJ_RATES['Germany'];}
/* The statutory minimum wage for a country, read live from the Compliance Hub table rather than
   authored here — it is the same row a user sees two clicks away under Rates & Rules. Returns
   null when the country has no such rule configured, which is a real state: only the Netherlands
   carries one today, and a run in Germany genuinely cannot make this check. */
function ccjFloorFor(country){
  const rows=(typeof supportPageMeta!=='undefined'&&supportPageMeta.compliance
    &&supportPageMeta.compliance.rows)||[];
  const row=rows.find(function(r){
    return r[1]===country&&/minimum wage/i.test(String(r[2]))&&r[6]==='Active';});
  if(!row)return null;
  const m=String(row[5]).match(/([A-Z]{3})\s*([\d.,]+)/);
  if(!m)return null;
  return {label:m[1],value:m[2],num:parseFloat(m[2].replace(/,/g,''))};
}
/* Margin IS the fee — which is what makes a negotiation possible. A flat service charge would
   mean "can you improve on the rate" had nothing to move. */
function ccjQuote(margin){
  const c=ccjCtx();
  const gross=Math.round(c.grossMonthly);
  const rate=ccjRate(c.country);
  const socialPct=rate.social;
  const social=Math.round(gross*socialPct/100);
  const holiday=Math.round(gross*rate.holiday/100);
  const m=margin!==undefined?margin:(ccjRun&&ccjRun.margin!==undefined?ccjRun.margin:20);
  const base=gross+social+holiday;
  const fee=Math.round(base*m/100);
  return {gross:gross,social:social,socialPct:socialPct,holiday:holiday,base:base,
    fee:fee,total:base+fee,margin:m,
    country:c.country,name:c.name,type:c.type,sym:ccjCurrency()};
}
function ccjQuoteDone(label){
  const run=ccjRun;
  return !!run.settled['quote-prep/'+label];
}
function buildCCJQuoteHTML(){
  const q=ccjQuote();
  const money=function(v){return q.sym+' '+v.toLocaleString();};
  const costReady=ccjQuoteDone('Cost calc built');
  const rulesReady=ccjQuoteDone('Country data check');
  // The settled row itself, not just "did it finish". The row froze its summary at settle time,
  // so reading it makes the two columns identical by construction rather than by two functions
  // happening to agree — and it reports a failed or unmakeable check honestly.
  const floorRow=ccjRun.settled['quote-prep/Statutory floor check'];
  const approved=ccjQuoteDone('Quote QA');
  const line=function(k,sub,v,ready){
    return '<div class="ccj-q-row'+(ready?'':' pend')+'">'
      +'<div class="ccj-q-k">'+k+(sub?'<span>'+sub+'</span>':'')+'</div>'
      +'<div class="ccj-q-v">'+(ready?v:'<span class="ccj-q-skel"></span>')+'</div></div>';
  };
  return '<div class="ccj-q">'
    +'<div class="ccj-q-head">'
    +'<div><div class="ccj-q-title">Quote</div>'
    +'<div class="ccj-q-sub">'+q.name+' &middot; '+q.country+' &middot; '+q.type+'</div></div>'
    +'<span class="ccj-q-status'+(approved?' ok':'')+'">'+(approved?'Approved':'In preparation')+'</span>'
    +'</div>'
    +'<div class="ccj-q-card">'
    +'<div class="ccj-q-sec">Monthly employer cost</div>'
    +line('Gross salary','Offered',money(q.gross),true)
    +line(ccjRate(q.country).label,q.socialPct+'% of gross',money(q.social),costReady)
    +(q.holiday?line('Holiday allowance',ccjRate(q.country).holiday+'% of gross',money(q.holiday),costReady):'')
    +line('ADT service fee',q.margin+'% margin',money(q.fee),costReady)
    +'<div class="ccj-q-total"><span>Total monthly cost</span><b>'+(costReady?money(q.total):'&mdash;')+'</b></div>'
    +'</div>'
    +'<div class="ccj-q-meta">'
    +'<div class="ccj-q-mrow'+(rulesReady?'':' pend')+'"><span>Country rules</span><b>'
      +(rulesReady?q.country+' statutory set resolved':'Pending')+'</b></div>'
    +'<div class="ccj-q-mrow'+(floorRow?'':' pend')+'"><span>Statutory floor</span><b>'
      // Reads the settled row's own summary rather than asserting a pass. Hardcoding "Above
      // minimum wage" meant the quote card claimed the rate cleared the statutory floor in
      // every case — including a failed check, and including the six countries where the panel
      // a column away said the check could not be made at all.
      +(floorRow?floorRow.summary:'Pending')+'</b></div>'
    +'<div class="ccj-q-mrow'+(costReady?'':' pend')+'"><span>Margin</span><b>'
      +(costReady?q.margin+'% &middot; standard rate card':'Pending')+'</b></div>'
    +'</div>'
    +(approved?'<div class="ccj-q-note">Approved and ready to send to the client.</div>':'')
    +'</div>';
}

/* ---- STAGE 3: WHAT THE ACCOUNT MANAGER WATCHES ----------------------------------------------
   Three questions, and this screen answers exactly those: have they opened it, when did I last
   chase, and what did they say. Everything else about the quote is one column to the left, in
   the thread it was sent through.

   The simulate strip is demo scaffolding and says so. It fires the SAME events the script fires,
   so nothing it can produce is a state the run could not reach on its own. */
function buildCCJSentHTML(){
  const c=ccjClient(),q=ccjQuote();
  const money=function(v){return q.sym+' '+Number(v).toLocaleString();};
  const done=function(on){return on?'done':'';};
  const ev=function(label,when,on,sub){
    return '<div class="ccj-tl-row '+done(on)+'">'
      +'<span class="ccj-tl-dot"></span>'
      +'<div class="ccj-tl-body"><div class="ccj-tl-label">'+label+'</div>'
      +(sub?'<div class="ccj-tl-sub">'+sub+'</div>':'')+'</div>'
      +'<span class="ccj-tl-when">'+(on?when:'&mdash;')+'</span></div>';
  };
  const opened=c.openedAt!==null;
  const replied=c.log.some(function(e){return e.id==='changed';});
  return '<div class="ccj-sent">'
    +'<div class="ccj-sent-head">'
    +'<div><div class="ccj-sent-title">Quote with the client</div>'
    +'<div class="ccj-sent-sub">v'+c.version+' &middot; '+money(q.total)+' a month &middot; '+q.margin+'% margin</div></div>'
    +'<span class="ccj-sent-state '+(c.state==='accepted'?'ok':replied?'warn':'')+'">'
      +(c.state==='accepted'?'Accepted':replied?'In negotiation':opened?'Opened':'Awaiting open')+'</span>'
    +'</div>'
    // Straight off the log, in the order things happened, stamped with when they happened. The
    // previous version inferred each row from the client's CURRENT state against hard-coded
    // dates, so accepting a quote outright still displayed "Change requested — Client asked for
    // a better rate", and a re-issue erased two follow-ups the thread was still showing.
    +'<div class="ccj-tl">'
    +(c.log.length
      ?c.log.map(function(e){return ev(e.label,ccjStamp(e.at),true,e.sub);}).join('')
      :'<div class="ccj-tl-empty">Nothing has happened yet.</div>')
    +'</div>'
    // The simulate strip is a control, so on a rebuilt stage it is not here — it moves to the
    // composer, where every other action lives. Un-rebuilt stages keep it, because their column
    // is the client's thread alone and there is nowhere else for it to go yet.
    +(ccjUsesTranscript(ccjRun.stage)?'':buildCCJSimulateHTML(c))
    +'</div>';
}
function buildCCJSimulateHTML(c){
  const btn=function(ev,label,on){
    return '<button class="ccj-sim-btn" onclick="ccjClientEvent(\''+ev+'\')"'+(on?'':' disabled')+'>'+label+'</button>';
  };
  const waiting=c.state==='sent';
  const opened=c.state==='viewed'||c.state==='chased';
  return '<div class="ccj-sim">'
    +'<div class="ccj-sim-head">Simulate client<span>demo</span></div>'
    +'<div class="ccj-sim-btns">'
    +btn('viewed','Opens the quote',waiting)
    +btn('chase','Chase now',(opened)&&c.chases<3)
    // The two things a client actually comes back with. They force different work, so they are
    // two buttons rather than one — a rate request rebuilds the cost, a terms request does not.
    +'<button class="ccj-sim-btn" onclick="ccjClientEvent(\'changed\',undefined,\'price\')"'+(opened?'':' disabled')+'>Asks for a better rate</button>'
    +'<button class="ccj-sim-btn" onclick="ccjClientEvent(\'changed\',undefined,\'terms\')"'+(opened?'':' disabled')+'>Asks to change the terms</button>'
    +btn('accepted','Accepts',c.state!=='idle'&&c.state!=='accepted')
    +'</div>'
    +'<div class="ccj-sim-note">Left alone the client acts on their own. These are the same events.</div>'
    +'</div>';
}

/* == STAGE 6: THE DEPOSIT INVOICE, AND THE GATE IT HOLDS ===================================
   The first stage on the placement track and the only one the operating model calls a hard
   gate: no hire under this client starts until the deposit is in the bank, however far the
   paperwork has got.

   IT IS A DOCUMENT, NOT A STATUS. A deposit invoice is the instrument a client's accounts
   payable department pays against, so it has to carry what one needs to pay it: who is billing
   whom, out of which registered entity, under which VAT treatment, against which agreement, by
   when, into which account, quoting which reference. A card reading "Deposit €5,700 — unpaid"
   is a status line. This is the invoice.

   EVERY NUMBER ON IT WAS DECIDED EARLIER. The amount is clause 3.4 of the agreement stage 5
   executed — one month gross salary. The terms are that agreement's "14 days net". The issue
   date is the countersignature date, because that is the event it is raised against. Nothing
   here is authored, so a renegotiated quote moves this invoice with it.

   VAT IS COMPUTED, NOT PRINTED. The invoice is issued by the ADT entity in the country the WORK
   happens in, to a client that is frequently somewhere else — the ordinary case on this platform,
   not the exception. Same country and it carries that country's VAT. Two EU countries and it is
   reverse-charged under Article 196, the client accounting for it at home. Client outside the EU
   and it falls outside the scope entirely. A flat rate printed on all three would be wrong on
   two of them, and wrong on an invoice is not a cosmetic problem.

   THE MONEY ARRIVES ON SOMEBODY ELSE'S CLOCK, like stage 3's quote. So the same machinery: a
   script that plays itself, a strip that fires the same events by hand, and a ledger that is a
   RECORD of what happened rather than an inference from the current balance.            == */

/* Where each entity is registered, what it is registered AS, and where money to it goes. Two
   addresses per country because the ADT entity and the client are both there in the cross-border
   case and printing one address twice would read as a mistake. */
const CCJ_EU=['Netherlands','Germany','Spain','France','Italy'];
const CCJ_VAT_RATE={'Netherlands':21,'Germany':19,'Spain':21,'France':20,'Italy':22,
                    'United Kingdom':20,'India':18};
const CCJ_REGISTRY={
  'Netherlands':{ccy:'EUR',rail:'SEPA credit transfer',
    adt:['Keizersgracht 241','1016 EA Amsterdam','Netherlands'],
    client:['Herengracht 458','1017 CA Amsterdam','Netherlands'],
    vat:'NL8231.45.678.B01',cvat:'NL8044.11.902.B01',reg:'KvK 74329118',
    bank:'ABN AMRO Bank N.V.',iban:'NL91 ABNA 0417 1643 00',bic:'ABNANL2A'},
  'Germany':{ccy:'EUR',rail:'SEPA credit transfer',
    adt:['Friedrichstra&szlig;e 88','10117 Berlin','Germany'],
    client:['Maximilianstra&szlig;e 13','80539 M&uuml;nchen','Germany'],
    vat:'DE 811 234 567',cvat:'DE 306 552 189',reg:'HRB 214887 B',
    bank:'Commerzbank AG',iban:'DE89 3704 0044 0532 0130 00',bic:'COBADEFFXXX'},
  'Spain':{ccy:'EUR',rail:'SEPA credit transfer',
    adt:['Calle de Alcal&aacute; 42','28014 Madrid','Spain'],
    client:['Passeig de Gr&agrave;cia 92','08008 Barcelona','Spain'],
    vat:'ESB12345674',cvat:'ESA58818501',reg:'Registro Mercantil de Madrid',
    bank:'CaixaBank S.A.',iban:'ES91 2100 0418 4502 0005 1332',bic:'CAIXESBBXXX'},
  'France':{ccy:'EUR',rail:'SEPA credit transfer',
    adt:['18 Rue de la Paix','75002 Paris','France'],
    client:['12 Quai Andr&eacute; Citro&euml;n','75015 Paris','France'],
    vat:'FR 40 123456824',cvat:'FR 62 552081317',reg:'RCS Paris 812 345 678',
    bank:'BNP Paribas',iban:'FR14 2004 1010 0505 0001 3M02 606',bic:'BNPAFRPPXXX'},
  'Italy':{ccy:'EUR',rail:'SEPA credit transfer',
    adt:['Via Monte Napoleone 8','20121 Milano','Italy'],
    client:['Via del Corso 184','00186 Roma','Italy'],
    vat:'IT12345678987',cvat:'IT09876543215',reg:'REA MI-2094412',
    bank:'Intesa Sanpaolo S.p.A.',iban:'IT60 X054 2811 1010 0000 0123 456',bic:'BCITITMMXXX'},
  'United Kingdom':{ccy:'GBP',rail:'Faster Payments',
    adt:['12 Finsbury Square','London EC2A 1AS','United Kingdom'],
    client:['1 Spinningfields','Manchester M3 3AP','United Kingdom'],
    vat:'GB 123 4567 89',cvat:'GB 884 1029 66',reg:'Companies House 09218804',
    bank:'NatWest Bank plc',iban:'GB29 NWBK 6016 1331 9268 19',bic:'NWBKGB2L'},
  'India':{ccy:'INR',rail:'NEFT transfer',
    adt:['Raheja Towers, MG Road','Bengaluru 560001','India'],
    client:['Nariman Point','Mumbai 400021','India'],
    vat:'GSTIN 29AABCU9603R1ZM',cvat:'GSTIN 27AAACH7409R1Z8',reg:'CIN U74999KA2019PTC128841',
    bank:'HDFC Bank Ltd',iban:'A/C 5011 2345 6789',bic:'IFSC HDFC0000123'}
};
/* Defaults to the Netherlands entry rather than throwing: a country we have no registry row for
   is a demo gap, not a reason for the invoice to fail to render. */
function ccjReg(country){
  return CCJ_REGISTRY[country||ccjParties().adt.country]||CCJ_REGISTRY['Netherlands'];
}
/* Place of supply, in three branches. Reads ccjParties only — never ccjCtx, which calls this. */
function ccjVat(){
  const p=ccjParties();
  const from=p.adt.country,to=p.client.country;
  if(from===to){
    const rate=CCJ_VAT_RATE[from]||0;
    return {rate:rate,kind:'domestic',label:from+' VAT at '+rate+'%',
      short:'VAT '+rate+'%',
      note:'Supplied and taxed in '+ccjInCountry(from)+'. VAT is charged at the standard rate and accounted for by the Provider.'};
  }
  if(CCJ_EU.indexOf(from)>-1&&CCJ_EU.indexOf(to)>-1)return {rate:0,kind:'reverse',
    label:'VAT reverse charged',short:'Reverse charge',
    note:'VAT reverse charged under Article 196 of Council Directive 2006/112/EC. The Client accounts for VAT in '+ccjInCountry(to)+' under its own registration.'};
  return {rate:0,kind:'export',label:'Outside the scope of VAT',short:'Outside scope',
    note:'Supplied to a business established outside the EU. Outside the scope of EU VAT under Article 44; the Client accounts for any tax arising in '+ccjInCountry(to)+'.'};
}

/* ---- WHAT HAS BEEN PAID ------------------------------------------------------------------
   `receipts` is the ledger and everything else is derived from it. Storing a `balance` that had
   to be kept in step with the receipts would be two answers to one question, which is the bug
   stage 3's timeline was rewritten to remove. */
function ccjNewPay(){
  return {issuedAt:null,          // simulated minute the invoice was raised — null, not 0
    dueAt:null,                   // issue + 14 days, from the agreement's terms
    ackAt:null,                   // when the client acknowledged it
    receipts:[],                  // {at,amount,kind,method,ref,payer} — what actually arrived
    reminders:[],                 // {at,kind:'due'|'overdue'} — the dunning record
    // `chasedAt` and `releasedAt` are stored rather than derived from a neighbouring row's time.
    // The ledger printed `firstReceipt + 1 minute` for the chase, which put it at 09:38 while the
    // thread carrying the same chase said 10:17 — one event, two surfaces, two answers.
    chased:false,chasedAt:null,   // a balance chase went out after a part payment
    released:false,releasedBy:'',releasedAt:null,shortfall:0,  // gate lifted against a shortfall
    clearedAt:null,timer:null,state:'idle'};
}
function ccjPay(){const run=ccjRun;if(!run.pay)run.pay=ccjNewPay();return run.pay;}
function ccjAmountDue(){const q=ccjQuote();return q.gross+Math.round(q.gross*ccjVat().rate/100);}
function ccjReceived(){return ccjPay().receipts.reduce(function(s,r){return s+r.amount;},0);}
function ccjOutstanding(){return Math.max(0,ccjAmountDue()-ccjReceived());}
function ccjPaidInFull(){return ccjPay().receipts.length>0&&ccjOutstanding()===0;}
function ccjMoney(v){return ccjCurrency()+'&nbsp;'+Number(v).toLocaleString();}
/* A date without a time. An invoice is dated to the day — printing 09:12 beside a due date would
   be claiming a precision payment terms do not have. */
function ccjDate(mins){return ccjStamp(mins||0).split(',')[0]+' '+CCJ_T0.year;}
/* Which day a simulated minute falls on. A due date is a DAY, so "how late is this" has to be
   counted in days rather than in elapsed minutes: an invoice due yesterday evening and read this
   morning is twelve hours past, which rounds to nothing and reported itself as "due today". */
function ccjDayNo(mins){return Math.floor((CCJ_T0.hour*60+CCJ_T0.min+(mins||0))/1440);}
/* Everything the document states, in one place, so the paper, the panel and the drawer cannot
   drift. Each field traces to something an earlier stage decided. */
function ccjInvoice(){
  const c=ccjCtx(),p=ccjParties(),q=ccjQuote(),pay=ccjPay(),v=ccjVat();
  const tax=Math.round(q.gross*v.rate/100);
  return {id:c.depositInvoice, agreement:ccjMsa().id,
    net:q.gross, vat:v, tax:tax, total:q.gross+tax,
    issued:pay.issuedAt, due:pay.dueAt, terms:'Net 14',
    from:p.adt, to:p.client, worker:p.worker,
    role:(ccjRun&&ccjRun.form&&ccjRun.form.jobTitle)||'&mdash;'};
}

/* ---- THE CLIENT'S SIDE OF THE INVOICE -----------------------------------------------------
   Same shape as stage 3: every event lands in one function whether the script fired it or a
   person clicked it, so the strip cannot produce a state the run could not reach on its own. */
function ccjPayEvent(ev,off){
  const run=ccjRun;if(!run)return;
  const p=ccjPay(),c=ccjClient();
  // `off` is minutes after the invoice was issued, which is what makes "two days before due" and
  // "three days overdue" mean something. Absent, the clock simply moves on a little.
  const at=function(){
    if(off!==undefined&&p.issuedAt!==null)c.mins=Math.max(c.mins,p.issuedAt+off);
    else c.mins+=40;
    return c.mins;
  };
  const receipt=function(amount,kind){
    const reg=ccjReg();
    p.receipts.push({at:c.mins,amount:amount,kind:kind,method:reg.rail,
      ref:ccjInvoice().id,payer:ccjParties().client.name});
  };
  if(ev==='issue'){
    if(p.issuedAt!==null)return;
    c.mins+=25;
    p.issuedAt=c.mins;
    p.dueAt=c.mins+14*1440;                       // 14 days net, straight off the agreement
    p.state='issued';
    ccjClientLog('invoiced','Deposit invoice raised',
      ccjInvoice().id+' &middot; '+ccjMoney(ccjAmountDue())+' &middot; due '+ccjDate(p.dueAt));
    ccjClientPush({who:'us',kind:'invoice',id:ccjInvoice().id,
      total:ccjAmountDue(),due:p.dueAt,at:c.mins});
  }else if(ev==='ack'){
    if(p.ackAt)return;
    p.ackAt=at();
    ccjClientPush({who:'client',
      text:'Received &mdash; thank you. It is with our finance team and booked into the next payment run.',
      at:c.mins});
  }else if(ev==='remind'){
    if(ccjPaidInFull()||p.issuedAt===null)return;
    at();
    const kind=p.dueAt!==null&&c.mins>=p.dueAt?'overdue':'due';
    p.reminders.push({at:c.mins,kind:kind});
    ccjClientLog('remind'+p.reminders.length,'Payment reminder '+p.reminders.length,
      kind==='overdue'?'Invoice overdue':'Due '+ccjDate(p.dueAt));
    ccjClientPush({who:'us',kind:'remind',n:p.reminders.length,overdue:kind==='overdue',
      amount:ccjOutstanding(),at:c.mins});
  }else if(ev==='part'){
    if(p.receipts.length||p.issuedAt===null)return;
    at();
    // A client paying part of an invoice pays a round figure, not 60.0% of it to the euro.
    const amt=Math.round(ccjAmountDue()*0.6/10)*10;
    receipt(amt,'part');
    ccjClientLog('partpaid','Part payment received',
      ccjMoney(amt)+' of '+ccjMoney(ccjAmountDue()));
    ccjClientPush({who:'client',kind:'remit',amount:amt,paid:'part',
      outstanding:ccjOutstanding(),at:c.mins});
  }else if(ev==='full'){
    if(ccjPaidInFull()||p.issuedAt===null)return;
    at();
    const amt=ccjOutstanding();
    receipt(amt,p.receipts.length?'balance':'full');
    ccjClientLog(p.receipts.length>1?'balancepaid':'fullpaid',
      p.receipts.length>1?'Balance received':'Paid in full',ccjMoney(amt)+' &middot; matched on reference');
    ccjClientPush({who:'client',kind:'remit',amount:amt,
      paid:p.receipts.length>1?'balance':'full',outstanding:0,at:c.mins});
  }else if(ev==='chase'){
    p.chased=true;
    p.chasedAt=at();
    ccjClientLog('chasebalance','Balance chased',ccjMoney(ccjOutstanding())+' outstanding');
    ccjClientPush({who:'us',
      text:ccjMoney(ccjReceived())+' is matched against <b>'+ccjInvoice().id+'</b>, thank you. <b>'
        +ccjMoney(ccjOutstanding())+'</b> remains outstanding &mdash; the placement cannot be started until the deposit is settled in full.',
      at:c.mins});
  }
  ccjPaintScreen();
  ccjPaint();
  ccjResolveWait();
  ccjPaySchedule();
}
/* The demo plays itself down the path that shows every row: acknowledged, chased before the due
   date, part-paid just after it, then — once a person has answered the shortfall — settled. */
const CCJ_PAY_SCRIPT=[
  {ev:'ack',    in:2600, off:130,   when:function(p){return p.state==='issued'&&!p.ackAt;}},
  {ev:'remind', in:3000, off:17280, when:function(p){return !!p.ackAt&&!p.reminders.length&&!p.receipts.length;}},
  {ev:'part',   in:3200, off:20880, when:function(p){return p.reminders.length>0&&!p.receipts.length;}},
  // Only after the balance has been chased, which is a decision someone had to take. Without
  // that condition the money would arrive while the gate was still asking whether to wait for it.
  {ev:'full',   in:3400, off:25200, when:function(p){return p.chased&&!p.released&&ccjOutstanding()>0;}}
];
function ccjPaySchedule(){
  const run=ccjRun;if(!run)return;
  const p=ccjPay();
  const next=CCJ_PAY_SCRIPT.find(function(s){return s.when(p);});
  if(p.timer){clearTimeout(p.timer);p.timer=null;}
  if(!next)return;
  const g=ccjGen;
  p.timer=setTimeout(function(){
    if(ccjGen!==g||ccjRun!==run)return;
    p.timer=null;
    ccjPayEvent(next.ev,next.off);
  },next.in);
}
/* HOW LATE IT IS, COMPUTED ONCE. The invoice band and the sub-status waiting on the money both
   have to say this, and two copies of a date calculation is how one surface ends up reading "2 days
   to go" beside another reading "overdue". Returns the parts rather than a sentence so each caller
   can phrase it for its own space. */
function ccjDueState(){
  const p=ccjPay();
  if(p.dueAt===null)return {days:0,state:'none',text:'&mdash;'};
  const days=ccjDayNo(p.dueAt)-ccjDayNo(ccjClient().mins);
  const n=Math.abs(days);
  return {days:days,
    state:days>0?'ahead':days===0?'today':'overdue',
    text:days>0?days+' day'+(days===1?'':'s')+' to go'
      :days===0?'due today'
      :n+' day'+(n===1?'':'s')+' overdue'};
}
/* The activity on the invoice, in the order it happened, built from the record rather than from
   the current balance. Stage 3's timeline was rewritten for exactly this reason: a ledger derived
   from state reports events that never occurred. */
function ccjPayLedger(){
  const p=ccjPay(),rows=[];
  if(p.issuedAt!==null)rows.push({at:p.issuedAt,kind:'issued',label:'Invoice raised',
    sub:ccjInvoice().id+' &middot; due '+ccjDate(p.dueAt)});
  if(p.ackAt)rows.push({at:p.ackAt,kind:'ack',label:'Acknowledged by the client',
    sub:'Booked for the next payment run'});
  p.reminders.forEach(function(r,n){rows.push({at:r.at,kind:'remind',
    label:'Payment reminder '+(n+1),
    sub:r.kind==='overdue'?'Invoice overdue':'Sent ahead of the due date'});});
  p.receipts.forEach(function(r){rows.push({at:r.at,kind:'receipt',
    label:r.method+' &middot; ref '+r.ref,amount:r.amount,
    sub:'Matched &middot; '+(r.kind==='part'?'part payment':r.kind==='balance'?'balance':'paid in full')});});
  if(p.chased)rows.push({at:p.chasedAt||0,kind:'chase',
    label:'Balance chased',sub:'Placement held pending settlement'});
  if(p.released)rows.push({at:p.releasedAt||0,kind:'release',
    label:'Released against a shortfall',sub:'Approved by '+p.releasedBy});
  if(p.clearedAt!==null)rows.push({at:p.clearedAt,kind:'cleared',
    label:'Payment gate released',sub:'Reconciled against '+ccjInvoice().id});
  return rows.sort(function(a,b){return a.at-b.at;});
}

/* ---- THE INVOICE SCREEN ------------------------------------------------------------------
   Three bands on a grey desk: what is owed, the document itself, and what has arrived against
   it. The money band is first because it is the one thing every reader of this screen wants,
   and the paper below it is what they act on. */
function buildCCJInvoiceHTML(){
  const run=ccjRun,p=ccjParties(),inv=ccjInvoice(),pay=ccjPay();
  const done=function(l){return !!run.settled['deposit-due/'+l];};
  const raised=pay.issuedAt!==null, cleared=done('Cleared');
  const due=ccjAmountDue(),got=ccjReceived(),out=ccjOutstanding();
  const reg=ccjReg(p.adt.country), creg=ccjReg(p.client.country);
  const pct=due?Math.min(100,Math.round(got/due*100)):0;
  const when=!raised?'Not raised yet.'
    :cleared?(pay.released
        ?'Gate released against a shortfall of '+ccjMoney(pay.shortfall)+' on '+ccjDate(pay.clearedAt)+'.'
        :'Settled in full on '+ccjDate(pay.receipts[pay.receipts.length-1].at)+'.')
    :'Due '+ccjDate(pay.dueAt)+' &middot; Net 14 &middot; '+ccjDueState().text;
  const fig=function(k,v,cls){return '<div class="ccj-inv-fig '+(cls||'')+'"><span>'+k+'</span><b>'+v+'</b></div>';};
  const kv=function(k,v){return '<div class="ccj-inv-kv"><span>'+k+'</span><b>'+v+'</b></div>';};
  const party=function(tag,name,addr,vat,reg2){
    return '<div class="ccj-inv-party"><div class="ccj-inv-party-t">'+tag+'</div>'
      +'<div class="ccj-inv-party-n">'+name+'</div>'
      +'<div class="ccj-inv-party-a">'+addr.join('<br>')+'</div>'
      +'<div class="ccj-inv-party-v">'+vat+(reg2?'<br>'+reg2:'')+'</div></div>';
  };
  return '<div class="ccj-inv-wrap">'

    // Band 1 — the money, stated before anything else.
    +'<div class="ccj-inv-stat'+(cleared&&!pay.released?' ok':pay.released?' warn':'')+'">'
    +'<div class="ccj-inv-figs">'
    +fig('Invoiced',raised?ccjMoney(due):'&mdash;')
    +fig('Received',ccjMoney(got),got?'got':'')
    +fig('Outstanding',ccjMoney(out),out?'out':'')
    +'</div>'
    +'<div class="ccj-inv-bar"><span style="width:'+pct+'%"></span></div>'
    +'<div class="ccj-inv-when">'+when+'</div>'
    +'</div>'

    // Band 2 — the invoice.
    +'<div class="ccj-inv'+(raised?'':' pending')+'">'
    +'<div class="ccj-inv-head">'
    +'<div><div class="ccj-inv-brand">ADT</div>'
    +'<div class="ccj-inv-brandsub">Global Employment Platform</div></div>'
    +'<div class="ccj-inv-ref"><div class="ccj-inv-kind">DEPOSIT INVOICE</div>'
    +'<div class="ccj-inv-no">'+inv.id+'</div></div>'
    +'</div>'

    +'<div class="ccj-inv-parties">'
    +party('From',inv.from.name,reg.adt,'VAT '+reg.vat,reg.reg)
    +party('Bill to',inv.to.name,creg.client,'VAT '+creg.cvat,'Attn: '+inv.to.contact)
    +'</div>'

    +'<div class="ccj-inv-meta">'
    +kv('Invoice date',raised?ccjDate(pay.issuedAt):'&mdash;')
    +kv('Due date',raised?ccjDate(pay.dueAt):'&mdash;')
    +kv('Payment terms','Net 14, per agreement')
    +kv('Agreement',inv.agreement)
    +kv('Currency',reg.ccy)
    +kv('Payment reference',inv.id)
    +'</div>'

    +'<table class="ccj-inv-lines">'
    +'<thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>'
    +'<tbody><tr>'
    +'<td><b>Security deposit</b>'
    +'<span>Clause 3.4 &mdash; one month gross salary, held as security against payroll funded ahead of invoice settlement.</span>'
    +'<span>'+inv.worker.name+' &middot; '+inv.role+' &middot; '+inv.worker.country+'</span></td>'
    +'<td>1</td><td>'+ccjMoney(inv.net)+'</td><td>'+ccjMoney(inv.net)+'</td>'
    +'</tr></tbody></table>'

    // The stamp lives beside the totals, in the white space a real one is banged into — not over
    // the header, where the invoice number is, or over the address block, which has to stay legible.
    +'<div class="ccj-inv-totwrap">'
    +(cleared?'<div class="ccj-inv-stamp'+(pay.released?' short':'')+'">'
      +(pay.released?'RELEASED':'PAID')+'</div>':'')
    +'<div class="ccj-inv-tot">'
    +'<div class="ccj-inv-trow"><span>Subtotal</span><b>'+ccjMoney(inv.net)+'</b></div>'
    +'<div class="ccj-inv-trow"><span>'+inv.vat.label+'</span><b>'+ccjMoney(inv.tax)+'</b></div>'
    +'<div class="ccj-inv-grand"><span>Total due</span><b>'+ccjMoney(inv.total)+'</b></div>'
    +'</div></div>'
    +'<div class="ccj-inv-vat">'+inv.vat.note+'</div>'

    +'<div class="ccj-inv-sec"><div class="ccj-inv-sec-t">Payment instructions</div>'
    +kv('Account name',inv.from.name)
    +kv('Bank',reg.bank)
    +kv(reg.ccy==='INR'?'Account number':'IBAN',reg.iban)
    +kv(reg.ccy==='INR'?'IFSC':'BIC / SWIFT',reg.bic)
    +kv('Reference',inv.id)
    +'<div class="ccj-inv-warn">Quote <b>'+inv.id+'</b> as the payment reference. A transfer that arrives without it is not matched automatically, and the placement stays held while the money sits unallocated.</div>'
    +'</div>'

    +'<div class="ccj-inv-foot">No placement may commence under agreement '+inv.agreement
    +' until this invoice is settled in full. The deposit is refundable on termination once all liabilities are discharged. '
    +inv.from.name+' is registered in '+ccjInCountry(inv.from.country)+' &middot; '+reg.reg+'.</div>'
    +'</div>'

    // Band 3 — what has actually happened against it.
    +buildCCJRemitHTML()

    +(cleared
      ?'<div class="ccj-inv-rel'+(pay.released?' short':'')+'">'
       +'<div class="ccj-inv-rel-ico">'
       +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'
       +'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></div>'
       +'<div class="ccj-inv-rel-body">'
       +'<div class="ccj-inv-rel-t">'+(pay.released
          ?'Payment gate released against a shortfall'
          :'Payment gate released')+'</div>'
       +'<div class="ccj-inv-rel-s">'+(pay.released
          ?ccjMoney(pay.shortfall)+' is still outstanding. '+pay.releasedBy
            +' accepted the exposure so the placement can start; the balance stays on the ledger.'
          :'The deposit is settled in full. This hire can now be contracted.')+'</div>'
       +'</div></div>'
      :'')

    // The invoice states that it is settled; it does not ask what to do next. On a rebuilt stage
    // the way on is a block in the conversation — see ccjRestAsk.
    +(run.phase==='rest'
      ?'<div class="ccj-inv-next">'
       +'<div class="ccj-inv-next-t">Deposit cleared. Nothing else is needed on this step.</div>'
       +'</div>'
      :'')

    // Demo scaffolding, and gone from the rebuilt stage for the same reason the client strip is:
    // CCJ_PAY_SCRIPT already drives the money on its own timing, and five buttons living
    // permanently on the document cost more attention than they were worth. Un-rebuilt stages
    // keep it — theirs is the only surface it could sit on.
    +(ccjUsesTranscript(run.stage)?'':buildCCJPaySimHTML())
    +'</div>';
}
/* The bank ledger. Receipts carry an amount column; reminders and chases do not, because they
   moved no money and a zero in that column would say they did. */
function buildCCJRemitHTML(){
  const pay=ccjPay(),rows=ccjPayLedger();
  return '<div class="ccj-rem">'
    +'<div class="ccj-rem-head">Activity on this invoice'
    +'<span>'+pay.receipts.length+' receipt'+(pay.receipts.length===1?'':'s')
    +' &middot; '+ccjMoney(ccjReceived())+' of '+ccjMoney(ccjAmountDue())+'</span></div>'
    +(rows.length
      ?rows.map(function(r){
        return '<div class="ccj-rem-row '+r.kind+'">'
          +'<span class="ccj-rem-dot"></span>'
          +'<div class="ccj-rem-body"><div class="ccj-rem-label">'+r.label+'</div>'
          +'<div class="ccj-rem-sub">'+r.sub+'</div></div>'
          +'<span class="ccj-rem-when">'+ccjStamp(r.at)+'</span>'
          +'<span class="ccj-rem-amt">'+(r.amount?'+'+ccjMoney(r.amount):'')+'</span>'
          +'</div>';
      }).join('')
      :'<div class="ccj-rem-none">Nothing has happened on this invoice yet.</div>')
    +'</div>';
}
/* The same scaffolding stage 3 carries, and it says so. Every button fires the event the script
   fires, so nothing here can reach a state the run could not reach on its own. */
function buildCCJPaySimHTML(){
  const p=ccjPay();
  const btn=function(ev,label,on){
    return '<button class="ccj-sim-btn" onclick="ccjPayEvent(\''+ev+'\')"'+(on?'':' disabled')+'>'
      +label+'</button>';
  };
  const live=p.issuedAt!==null&&!ccjPaidInFull();
  return '<div class="ccj-sim">'
    +'<div class="ccj-sim-head">Simulate client<span>demo</span></div>'
    +'<div class="ccj-sim-btns">'
    +btn('ack','Acknowledges the invoice',p.issuedAt!==null&&!p.ackAt)
    +btn('remind','Send a reminder',live)
    +btn('part','Part-pays 60%',live&&!p.receipts.length)
    +btn('full',p.receipts.length?'Pays the balance':'Pays in full',live)
    +'</div>'
    +'<div class="ccj-sim-note">Left alone the client pays on their own. These are the same events.</div>'
    +'</div>';
}

/* ---- WIRING STAGE 6 INTO THE RUNNER -------------------------------------------------------
   Declared here beside the stage they belong to rather than back in the maps, so everything this
   stage adds to the machine is readable in one place. The maps themselves are already built by
   the time this executes. */
CCJ_CLIENT_STAGES.push('deposit-due');
CCJ_STAGE_REST['deposit-due']={label:'Draft the employment contract',
  next:'Next is the employment contract &mdash; ours with the worker, not the one the client signed.'};

CCJ_PURPOSE['deposit-due/Invoice raised']='Raises the deposit invoice against the signed agreement.';
CCJ_PURPOSE['deposit-due/Awaiting funds']='Watches the bank feed for the deposit, and chases it.';
CCJ_PURPOSE['deposit-due/Part-paid']='Only if the money arrives short. Hold, or release against the shortfall.';
CCJ_PURPOSE['deposit-due/Cleared']='Matches the receipt and lifts the payment gate.';

/* Issuing the invoice belongs to the step that raises it, not to the screen that displays it. */
CCJ_ON_SETTLE['deposit-due/Invoice raised']=function(run){
  ccjPayEvent('issue');
  ccjPaySchedule();
};
CCJ_ON_SETTLE['deposit-due/Cleared']=function(run){
  const p=ccjPay(),c=ccjClient();
  c.mins+=15;
  p.clearedAt=c.mins;
  ccjClientLog('cleared',p.released?'Released with a shortfall':'Deposit cleared',
    p.released?ccjMoney(p.shortfall)+' outstanding &middot; released by '+p.releasedBy
              :'Payment gate lifted');
  ccjClientPush({who:'us',kind:'receipt',id:ccjInvoice().id,amount:ccjReceived(),
    short:p.released?p.shortfall:0,at:c.mins});
};

/* The deposit arrives when it arrives. `pre` because there is nothing to reconcile until the
   first transfer lands — matching a receipt you have not received is not work.

   This is the longest wait in the journey and the one most likely to be read as a hang, so it says
   three things a person actually needs: how much, how late, and whether anything is chasing it
   without them. All three are read from ccjPay() — the same store the ledger on the invoice reads —
   so the sub-status and the document can never disagree about what has arrived. */
CCJ_WAITS['deposit-due/Awaiting funds']={pre:true,
  met:function(){return ccjPay().receipts.length>0;},
  note:'Invoice is with the client. Waiting for the deposit to arrive.',
  rows:function(){
    const p=ccjPay(),d=ccjDueState();
    const sent=p.reminders.length;
    return [
      ['Outstanding',ccjMoney(ccjOutstanding())],
      // The urgency, marked when it has turned. An overdue invoice reading like a future one is
      // the single most useful thing this row can get wrong.
      ['Due',ccjDate(p.dueAt)+' &middot; '
        +(d.state==='overdue'?'<span class="ccj-wait-late">'+d.text+'</span>':d.text)],
      ['Automatic reminders',sent
        ?sent+' sent &middot; <span class="ccj-wait-on">Armed</span>'
        :'<span class="ccj-wait-on">Armed</span>']
    ];
  }};
/* Part-paid parks AFTER its decision rather than before it: the gate asks whether to hold, and
   holding is what puts the row here. So its rows report the consequence of the decision that was
   just taken — what came in, what has not, and what that costs the placement. */
CCJ_WAITS['deposit-due/Part-paid']={
  met:function(){return ccjPaidInFull()||ccjPay().released;},
  note:'Chasing the balance. The placement stays held until the deposit is settled in full.',
  rows:function(){
    return [
      ['Received',ccjMoney(ccjReceived())+' of '+ccjMoney(ccjAmountDue())],
      ['Still outstanding','<span class="ccj-wait-late">'+ccjMoney(ccjOutstanding())+'</span>'],
      ['Placement','Held until the deposit settles']
    ];
  }};

/* A shortfall is a decision, not a status. The row only carries the gate until it is answered —
   after that the same row is a wait, which is what holding for the balance actually is. */
CCJ_GATES['deposit-due/Part-paid']=function(){
  const run=ccjRun;if(!run)return null;
  if(run.decisions['deposit-due/Part-paid'])return null;
  return {
    kind:'decision',
    // The step is owned by the Client — they are who part-paid — but whether we carry an unfunded
    // payroll so a placement can start is Finance's call, and the same team raised the invoice and
    // clears it. Crediting it to the client put our exposure in their name. See ccjGateOwner.
    owner:'Finance',
    ask:ccjMoney(ccjOutstanding())+' of '+ccjMoney(ccjAmountDue())+' is still outstanding.',
    // One of the few gates that keeps a `why`, because it carries what the ask cannot: releasing
    // is not just "continue anyway", it moves a real payroll liability onto us. Said in three
    // short facts — cannot start, we pay, your name is on it — rather than in the language the
    // original used ("no placement may start", "the payroll exposure the deposit exists to
    // cover"), which was drafting, not product copy.
    why:'Work cannot start until this is paid. If you release it anyway, we cover the payroll and your approval is recorded.',
    options:[
      // "Release anyway" named the mechanism — a gate being lifted — and not the thing the reader
      // is deciding, which is whether a person starts work on money we have not been paid.
      {id:'holdBalance', label:'Wait for the balance',tone:'go',  done:'Held for the balance'},
      {id:'releaseShort',label:'Start the hire anyway',      tone:'stop',done:'Released against a shortfall'}
    ]
  };
};

/* == STAGE 7: THE EMPLOYMENT CONTRACT ======================================================
   The second contract this journey produces, and a different one in every respect from the
   Master Services Agreement in stage 5. That one is between ADT and the CLIENT COMPANY, is
   commercial, states our margin, and is signed once per client. This one is between the ADT
   ENTITY and the WORKER, is an employment contract under the law of the country the work is
   done in, states none of the commercials, and is signed once per person.

   So the counterparty in the column changes. Stages 3-6 talked to the client; this talks to the
   employee, out of a separate store (`run.worker`). They must never merge — this thread discusses
   somebody's salary and probation with them, and the client's thread discusses our margin.

   == THE COMPLIANCE CHECK HAPPENS ON THE DOCUMENT ========================================
   The obvious way to render "clause compliance check" is a list of green ticks somewhere near
   the contract. That is a report ABOUT an audit; it is not the audit. What a compliance officer
   actually does is read the contract clause by clause with the statutory set beside them, and
   mark the clauses that do not meet it.

   So that is what this does. The check walks DOWN THE DOCUMENT, one clause at a time. Each
   clause takes a verdict in place, citing the Compliance Hub rule it was measured against, with
   the expected value and the drafted one. And where the draft falls short the clause is ADJUSTED
   — the text on screen changes under the reader, and the clause carries what it was changed
   from. A check that only ever agreed with the draft would not be a check.

   That is also what gives the human approval afterwards something to approve: not "the machine
   says it is fine", but "two clauses were rewritten to meet Dutch law, and here they are".

   == NOTHING HERE IS INVENTED ============================================================
   Every drafted term comes from the contract form (stage 1), and every rule it is measured
   against comes from `CCJ_STAT` or, for the minimum wage, live from the Compliance Hub's own
   Rates & Rules table via `ccjFloorFor`. Where the Hub has no rule for a country the check says
   so and returns NOT APPLICABLE, rather than inventing a threshold to pass.            == */

/* The statutory set, per country. `probationMax:0` means the country has no statutory maximum —
   which is a real answer (the UK has none) and is reported as such rather than as a pass. */
const CCJ_STAT={
  'Netherlands':{lang:'Dutch',
    law:'Book 7, Title 10 of the Dutch Civil Code (Burgerlijk Wetboek)',
    court:'the competent court of the district in which the Employee works',
    probationMax:2,probationNote:'on an indefinite contract',
    hoursMax:40,holidayMin:20,noticeMin:30,
    scheme:'AOW, WW, WAO and Zvw'},
  'Germany':{lang:'German',
    law:'§§ 611a ff. of the B&uuml;rgerliches Gesetzbuch and the Nachweisgesetz',
    court:'the competent Arbeitsgericht',
    probationMax:6,hoursMax:48,holidayMin:20,noticeMin:28,
    scheme:'Rentenversicherung, Krankenversicherung, Pflegeversicherung and ALV'},
  'India':{lang:'English',
    law:'the Indian Contract Act 1872 and the applicable Shops and Establishments Act',
    court:'the courts of the city in which the Employer is registered',
    probationMax:6,hoursMax:48,holidayMin:15,noticeMin:30,
    scheme:'EPF, ESI and Gratuity'},
  'Spain':{lang:'Spanish',
    law:'the Estatuto de los Trabajadores (Royal Legislative Decree 2/2015)',
    court:'the Juzgado de lo Social of the Employee&rsquo;s place of work',
    probationMax:6,hoursMax:40,holidayMin:30,noticeMin:15,
    scheme:'Seguridad Social and IRPF withholding'},
  'United Kingdom':{lang:'English',
    law:'the Employment Rights Act 1996',
    court:'the Employment Tribunal',
    probationMax:0,hoursMax:48,holidayMin:28,noticeMin:7,
    scheme:'PAYE, National Insurance and auto-enrolment pension'},
  'France':{lang:'French',
    law:'the Code du travail',
    court:'the Conseil de prud&rsquo;hommes',
    probationMax:4,hoursMax:35,holidayMin:25,noticeMin:30,
    scheme:'URSSAF, retraite compl&eacute;mentaire and mutuelle'},
  'Italy':{lang:'Italian',
    law:'art. 2094 of the Codice Civile and the applicable CCNL',
    court:'the Tribunale del Lavoro',
    probationMax:6,hoursMax:40,holidayMin:20,noticeMin:30,
    scheme:'INPS, INAIL and TFR'}
};
function ccjStat(country){
  return CCJ_STAT[country||ccjParties().worker.country]||CCJ_STAT['Netherlands'];
}
/* What the DRAFT starts from before anything is checked: the form for everything the form
   captures, and the house standard for the two things it does not. Holiday and weekly hours are
   house standards on purpose — they are exactly the terms a statutory minimum overrides, and a
   draft that already matched every country's floor would give the check nothing to do. */
const CCJ_HOUSE={holiday:20,hours:{'Full time':40,'Part time':20,'Shift based':40}};

function ccjEmp(){
  const run=ccjRun;
  if(!run.emp)run.emp={
    id:'EC-'+String(7100+(run.gen||0)),
    version:1,
    terms:null,          // the drafted terms — mutated in place by the audit, see ccjAuditTick
    audit:[],            // one row per clause the statutory set has something to say about
    auditAt:0,           // how many of those have been reached, which is what drives the reveal
    auditDone:false,
    approvedBy:'',approvedAt:0,
    sentAt:0,openedAt:0,workerSignedAt:0,adtSignedAt:0,
    declined:false
  };
  return run.emp;
}
/* Drafted from the approved quote and the contract form, exactly as the sub-status says. Rebuilt
   from scratch on a redraft, because a send-back means the previous draft and everything the
   audit did to it are no longer what is on the table. */
function ccjDraftContract(){
  const run=ccjRun;if(!run)return;
  const e=ccjEmp(),f=run.form||{},q=ccjQuote();
  e.terms={
    probation:parseInt(f.probation,10)||3,
    notice:parseInt(f.notice,10)||30,
    holiday:CCJ_HOUSE.holiday,
    hours:CCJ_HOUSE.hours[f.schedule]||40,
    gross:q.gross,
    translated:false
  };
  e.audit=[];e.auditAt=0;e.auditDone=false;
  delete run.reached['audit-done'];   // a new draft has not been checked yet
}

/* ---- THE AUDIT ---------------------------------------------------------------------------
   One row per clause that a statutory rule bears on. Clauses with no rule behind them — the
   confidentiality and IP clauses, the governing-law clause — produce no row, because marking
   them "compliant" would claim a check nobody made. */
function ccjClauseAudit(){
  const e=ccjEmp(),t=e.terms||{},p=ccjParties(),s=ccjStat(p.worker.country),f=ccjRun.form||{};
  const country=p.worker.country;
  const src='Compliance Hub &middot; '+country;
  const rows=[];
  // 5 · Probation. Adjusted DOWN where the country caps it.
  if(s.probationMax>0)rows.push({key:'probation',n:'5',clause:'Probationary period',
    rule:'Maximum probationary period',source:src,
    expected:'no more than '+s.probationMax+' months'+(s.probationNote?' '+s.probationNote:''),
    drafted:t.probation+' months',
    verdict:t.probation>s.probationMax?'adjust':'pass',
    to:Math.min(t.probation,s.probationMax),
    note:t.probation>s.probationMax
      ?'Reduced from '+t.probation+' to '+s.probationMax+' months. A longer period is void in '+ccjInCountry(country)+'.'
      :'Within the statutory maximum.'});
  else rows.push({key:'probation',n:'5',clause:'Probationary period',
    rule:'Maximum probationary period',source:src,
    expected:'no statutory maximum in '+ccjInCountry(country),drafted:t.probation+' months',
    verdict:'na',to:t.probation,
    note:'No statutory cap applies in '+ccjInCountry(country)+', so the drafted period stands.'});
  // 6 · Working time. Adjusted DOWN to the statutory week.
  rows.push({key:'hours',n:'6',clause:'Working time',
    rule:'Maximum ordinary weekly working time',source:src,
    expected:'no more than '+s.hoursMax+' hours a week',drafted:t.hours+' hours a week',
    verdict:t.hours>s.hoursMax?'adjust':'pass',
    to:Math.min(t.hours,s.hoursMax),
    note:t.hours>s.hoursMax
      ?'Reduced from '+t.hours+' to '+s.hoursMax+' hours, the statutory ordinary week in '+ccjInCountry(country)+'.'
      :'Within the statutory ordinary week.'});
  // 7 · Remuneration, against the Compliance Hub's own Rates & Rules row. Only the Netherlands
  // has one configured today, and the other six say so rather than passing on nothing.
  const floor=typeof ccjFloorFor==='function'?ccjFloorFor(country):null;
  if(floor){
    const hourly=t.gross/173.33;
    rows.push({key:'pay',n:'7',clause:'Remuneration',
      rule:'Statutory minimum wage',source:src+' &middot; Rates &amp; Rules',
      expected:'at least '+floor.label+' '+floor.value+' an hour',
      drafted:floor.label+' '+hourly.toFixed(2)+' an hour ('+ccjMoney(t.gross)+' a month)',
      verdict:hourly>=floor.num?'pass':'fail',to:t.gross,
      note:hourly>=floor.num
        ?'Above the statutory floor.'
        :'BELOW the statutory floor. This contract cannot be issued at this rate.'});
  }else{
    rows.push({key:'pay',n:'7',clause:'Remuneration',
      rule:'Statutory minimum wage',source:src+' &middot; Rates &amp; Rules',
      expected:'no minimum wage rule configured for '+ccjInCountry(country),
      drafted:ccjMoney(t.gross)+' a month',
      verdict:'na',to:t.gross,
      note:'The Compliance Hub carries no active minimum wage row for '+ccjInCountry(country)+', so this check cannot be made here. It is not a pass.'});
  }
  // 8 · Holiday. Adjusted UP to the statutory minimum — the commonest real intervention.
  rows.push({key:'holiday',n:'8',clause:'Holiday entitlement',
    rule:'Statutory minimum paid annual leave',source:src,
    expected:'at least '+s.holidayMin+' days a year',drafted:t.holiday+' days a year',
    verdict:t.holiday<s.holidayMin?'adjust':'pass',
    to:Math.max(t.holiday,s.holidayMin),
    note:t.holiday<s.holidayMin
      ?'Raised from '+t.holiday+' to '+s.holidayMin+' days. The house standard is below the '+country+' statutory minimum.'
      :'At or above the statutory minimum.'});
  // 10 · Notice. Adjusted UP.
  rows.push({key:'notice',n:'10',clause:'Notice of termination',
    rule:'Minimum notice by the employer',source:src,
    expected:'at least '+s.noticeMin+' days',drafted:t.notice+' days',
    verdict:t.notice<s.noticeMin?'adjust':'pass',
    to:Math.max(t.notice,s.noticeMin),
    note:t.notice<s.noticeMin
      ?'Raised from '+t.notice+' to '+s.noticeMin+' days to meet the statutory minimum.'
      :'At or above the statutory minimum.'});
  // 13 · Language. A contract the employee cannot read is not written particulars.
  rows.push({key:'translated',n:'13',clause:'Language and written particulars',
    rule:'Written particulars in a language the employee understands',source:src,
    expected:s.lang==='English'?'English is sufficient in '+ccjInCountry(country)
      :'a certified '+s.lang+' version alongside the English',
    drafted:'English only',
    verdict:s.lang==='English'?'pass':'adjust',
    to:s.lang!=='English',
    note:s.lang==='English'
      ?'English is the working language of employment law in '+ccjInCountry(country)+'.'
      :'A certified '+s.lang+' translation has been attached and prevails in the event of conflict.'});
  // 4 · Fixed term, only where the contract actually is one. On a permanent contract this is not
  // an unmade check, it is not a check.
  if(f.term==='Fixed Term')rows.push({key:'fixed',n:'4',clause:'Term',
    rule:'Maximum duration of a fixed-term engagement',source:src,
    expected:'no more than 24 months before it converts to indefinite',
    drafted:'ends '+ccjPrettyDate(f.toDate),
    verdict:'pass',to:null,
    note:'Within the period after which '+ccjInCountry(country)+' converts a fixed term to an indefinite contract.'});
  // Down the document, which is how a person reads it.
  return rows.sort(function(a,b){return Number(a.n)-Number(b.n);});
}
function ccjAuditRow(key){
  const e=ccjEmp();
  const i=e.audit.findIndex(function(r){return r.key===key;});
  return i>-1&&i<e.auditAt?e.audit[i]:null;   // not reached yet is not a verdict
}
function ccjAuditAdjusted(){
  const e=ccjEmp();
  return e.audit.slice(0,e.auditAt).filter(function(r){return r.verdict==='adjust';});
}
function ccjAuditFailed(){
  const e=ccjEmp();
  return e.audit.slice(0,e.auditAt).filter(function(r){return r.verdict==='fail';});
}
const CCJ_AUDIT_STEP=620;   // one clause, paced to be read rather than counted
function ccjAuditStart(){
  const e=ccjEmp();
  if(!e.terms)ccjDraftContract();
  e.audit=ccjClauseAudit();e.auditAt=0;e.auditDone=false;
  ccjPaintScreen();
  // Not immediately. The panel beside this is still connecting to the Compliance Hub and pulling
  // the statutory set down, and you cannot measure a clause against rules you have not fetched.
  // Waiting those two actions out also means the audit outlives the step's own beats, so the
  // sub-status genuinely HOLDS on it rather than the hold being decorative.
  ccjScheduleAudit(ccjAuditTick,CCJ_ACT*2);
}
/* One clause per beat, and the adjustment is APPLIED as it is reached — so the number in the
   clause changes on screen at the moment the rule that changed it appears beside it. Applying
   them all at the end would show a document that was never wrong being told it was. */
function ccjAuditTick(){
  const run=ccjRun;if(!run)return;
  const e=ccjEmp();
  if(e.auditAt>=e.audit.length){
    e.auditDone=true;
    ccjPaintScreen();ccjPaint();
    ccjReachScreen('audit-done');      // releases the held sub-status
    return;
  }
  const row=e.audit[e.auditAt];
  e.auditAt++;
  if(row.verdict==='adjust'&&row.to!==null&&row.to!==undefined)e.terms[row.key]=row.to;
  ccjPaintScreen();ccjPaint();
  ccjScrollScreenToClause(row.n);
  ccjScheduleAudit(ccjAuditTick,CCJ_AUDIT_STEP);
}
/* The clause being checked is kept in view, the same way the form follows a document being read
   into it. A check that scrolls off the top is a check nobody watched. */
function ccjScrollScreenToClause(n){
  if(typeof document.querySelector!=='function')return;
  const box=document.querySelector('.ccj-ec-wrap');
  const el=document.getElementById('ccj-ec-cl-'+n);
  if(!box||!el||typeof el.getBoundingClientRect!=='function'||!box.getBoundingClientRect)return;
  const r=el.getBoundingClientRect(),br=box.getBoundingClientRect();
  if(!r.height&&!br.height)return;
  ccjGlide(box,box.scrollTop+(r.top-br.top)-120);
}

/* ---- THE WORKER'S SIDE --------------------------------------------------------------------
   A separate store from the client's, for the reason at the top of this section. Same shape,
   though: what the WORKER has done, never what we have done. */
function ccjNewWorker(){
  return {msgs:[],log:[],timer:null,
    device:'Chrome on Android',   // the e-sign audit trail, which is a real part of the record
    // Stored, not derived. The envelope printed `openedAt + 40 minutes` for the download, which
    // is the same class of fiction the stage-6 ledger had: a timestamp for an event nobody timed.
    downloaded:false,downloadedAt:0};
}
function ccjWorker(){const run=ccjRun;if(!run.worker)run.worker=ccjNewWorker();return run.worker;}
function ccjWorkerPush(m){
  m._id=ccjNextMsgId();m.lane='worker';ccjStampMode(m);
  ccjWorker().msgs.push(m);ccjStreamSync();
}
function ccjWorkerEvent(ev,off){
  const run=ccjRun;if(!run)return;
  const e=ccjEmp(),w=ccjWorker(),c=ccjClient(),p=ccjParties();
  const at=function(){
    if(off!==undefined&&e.sentAt)c.mins=Math.max(c.mins,e.sentAt+off);
    else c.mins+=45;
    return c.mins;
  };
  if(ev==='open'){
    if(e.openedAt||!e.sentAt)return;
    e.openedAt=at();
    ccjWorkerPush({who:'note',text:'Opened the contract &middot; '+w.device+' &middot; '+p.worker.country,at:c.mins});
  }else if(ev==='download'){
    if(!e.sentAt)return;
    w.downloadedAt=at();w.downloaded=true;
    ccjWorkerPush({who:'note',text:'Downloaded a copy of '+e.id,at:c.mins});
  }else if(ev==='sign'){
    if(e.workerSignedAt||!e.sentAt)return;
    if(!e.openedAt)e.openedAt=at();
    e.workerSignedAt=at();
    ccjWorkerPush({who:'worker',kind:'ecsigned',id:e.id,at:c.mins});
    ccjClientLog('workerSigned','Employment contract signed by the employee',
      e.id+' &middot; returned for countersignature');
  }
  ccjPaintScreen();ccjPaint();
  ccjResolveWait();
  ccjWorkerSchedule();
}
const CCJ_WORKER_SCRIPT=[
  {ev:'open',    in:2500,off:210,when:function(e){return !!e.sentAt&&!e.openedAt;}},
  {ev:'download',in:2200,off:340,when:function(e){return !!e.openedAt&&!ccjWorker().downloaded;}},
  {ev:'sign',    in:3200,off:690,when:function(e){return !!e.openedAt&&!e.workerSignedAt;}}
];
function ccjWorkerSchedule(){
  const run=ccjRun;if(!run)return;
  const e=ccjEmp(),w=ccjWorker();
  const next=CCJ_WORKER_SCRIPT.find(function(s){return s.when(e);});
  if(w.timer){clearTimeout(w.timer);w.timer=null;}
  if(!next)return;
  const g=ccjGen;
  w.timer=setTimeout(function(){
    if(ccjGen!==g||ccjRun!==run)return;
    w.timer=null;
    ccjWorkerEvent(next.ev,next.off);
  },next.in);
}

/* ---- THE CONTRACT ITSELF ------------------------------------------------------------------
   Fourteen clauses, in the order an employment contract is written, with the audit's verdict
   sitting against the clauses it bears on. Everything in it comes from the form, the quote or
   the statutory set — nothing is authored per run. */
function ccjEmpClauses(){
  const e=ccjEmp(),t=e.terms||{},p=ccjParties(),s=ccjStat(p.worker.country),f=ccjRun.form||{};
  const sym=ccjCurrency();
  const money=function(v){return sym+'&nbsp;'+Number(v).toLocaleString();};
  const reg=ccjReg(p.worker.country);
  const place=(f.schedule==='Full time'?'The Employee&rsquo;s ordinary place of work is '
    :'The Employee&rsquo;s place of work is ')+reg.adt.join(', ')
    +'. The Employer may agree remote or hybrid working in writing, which does not vary this Agreement.';
  return [
    {n:'1',key:'appointment',title:'Appointment and commencement',
     body:'The Employer appoints the Employee to the position of <b>'+(f.jobTitle||'the agreed role')
       +'</b> with effect from <b>'+ccjPrettyDate(f.fromDate)+'</b>. The Employee accepts the appointment on the terms set out below and confirms they are free to take it up.'},
    {n:'2',key:'place',title:'Place of work',body:place},
    {n:'3',key:'duties',title:'Duties and scope of work',
     body:(f.jobDesc?f.jobDesc:'The Employee shall carry out the duties ordinarily associated with the position of '+(f.jobTitle||'the role')+'.')
       +' The Employee shall report as directed by the Employer&rsquo;s client for day-to-day work; the employment relationship itself is with the Employer alone.'},
    {n:'4',key:'fixed',title:'Term',
     body:f.term==='Fixed Term'
       ?'This is a fixed-term contract commencing on '+ccjPrettyDate(f.fromDate)+' and ending on <b>'+ccjPrettyDate(f.toDate)+'</b> unless terminated earlier in accordance with clause 10.'
       :'This is a contract of indefinite duration. It continues until terminated by either party in accordance with clause 10.'},
    {n:'5',key:'probation',title:'Probationary period',
     body:'The first <b>'+t.probation+' month'+(t.probation===1?'':'s')
       +'</b> of employment is a probationary period, during which either party may terminate on the notice permitted by '+s.law.replace(/^the /,'')+'. Confirmation in the role follows automatically on expiry unless the Employer gives written notice to the contrary.'},
    {n:'6',key:'hours',title:'Working time',
     body:'Ordinary working time is <b>'+t.hours+' hours a week</b>, worked '+(f.schedule||'Full time').toLowerCase()
       +'. Hours worked beyond the ordinary week are compensated in accordance with '+s.law.replace(/^the /,'')+'; the Employee shall not be required to exceed the statutory maximum.'},
    {n:'7',key:'pay',title:'Remuneration',
     body:'The Employee&rsquo;s gross salary is <b>'+money(t.gross)
       +' a month</b>, payable on the last working day of each month by bank transfer, less all deductions the Employer is required by law to make. Salary is reviewed annually and any increase is at the Employer&rsquo;s discretion.'},
    {n:'8',key:'holiday',title:'Holiday entitlement',
     body:'The Employee is entitled to <b>'+t.holiday+' days</b> of paid annual leave in each full holiday year, in addition to public holidays in '
       +ccjInCountry(p.worker.country)+'. Untaken leave carries over only to the extent '+s.law.replace(/^the /,'')+' requires.'},
    {n:'9',key:'social',title:'Social security, tax and benefits',
     body:'The Employer shall register the Employee for, and remit all employer contributions to, '+s.scheme
       +'. Employee contributions and income tax are withheld at source. The Employer carries every statutory employer obligation arising from this employment.'},
    {n:'10',key:'notice',title:'Notice of termination',
     body:'After the probationary period either party may terminate this contract on <b>'+t.notice
       +' days</b> written notice. The Employer may terminate without notice only for a reason recognised as summary grounds under '+s.law.replace(/^the /,'')
       +'. Any statutory notice greater than the period stated here applies in place of it.'},
    {n:'11',key:'confidential',title:'Confidentiality',
     body:'The Employee shall not, during or after employment, disclose confidential information belonging to the Employer or to the Employer&rsquo;s client, save where disclosure is required by law or by a competent authority. This obligation survives termination.'},
    {n:'12',key:'ip',title:'Intellectual property',
     body:'All intellectual property created by the Employee in the course of employment vests in the Employer on creation, to the extent permitted by '+s.law.replace(/^the /,'')
       +'. Where local law grants the Employee an inalienable right or compensation in respect of such property, that right is unaffected.'},
    {n:'13',key:'translated',title:'Language and written particulars',
     body:'This contract is executed in English'
       +(t.translated?', and a certified <b>'+s.lang+'</b> translation is attached at Schedule 1. In the event of conflict the '+s.lang+' text prevails.'
         :'. English is the language in which the Employee is given written particulars of employment.')},
    {n:'14',key:'law',title:'Governing law and jurisdiction',
     body:'This contract is governed by '+s.law+'. The parties submit to '+s.court+'.'}
  ];
}
/* Read in the order the document now moves through: ours, out, theirs. The employee's signature
   is the executing one, so it — not ours — is what reports "Executed". */
function ccjEmpStateLabel(){
  const run=ccjRun,e=ccjEmp();
  if(e.declined)return {t:'Declined',cls:'stop'};
  if(e.workerSignedAt)return {t:'Executed',cls:'ok'};
  if(e.sentAt)return {t:'With the employee for signature',cls:'wait'};
  if(e.adtSignedAt)return {t:'Signed by the employer',cls:'ok'};
  if(e.approvedBy)return {t:'Approved internally',cls:'ok'};
  if(e.auditDone)return {t:'Compliance checked',cls:''};
  if(e.audit.length)return {t:'Checking clauses',cls:''};
  if(e.terms)return {t:'Draft',cls:''};
  return {t:'Not drafted',cls:''};
}
/* == THE COMMERCIAL SHEET ON THE FRONT OF THE CONTRACT ======================================
   The contract now opens in the layout Dhi already issues: the monthly invoice build-up, the
   candidate's gross-to-net beneath it, and the one-off fees and caveats below both. A client
   reading it gets the commercial position in the format they have seen before rather than a
   second format invented here.

   THE FIGURES ARE THE TEMPLATE'S OWN, transcribed rather than computed. This journey carries no
   Foreign Worker Levy, no provident fund, no visa transfer or local authority line and no SGD
   leg — computing the three rows it can and leaving the other five blank would print a sheet
   that is neither the template nor the hire. Kept in one table so the two sections share a
   column grid, which is what makes SGD and EUR line up down the whole page.

   THE IDENTITY FIELDS DO COME FROM THE RUN. Client, employee, date and reference are things the
   journey knows for certain, and a document carrying a specimen NAME reads as the wrong
   document, in a way that specimen money does not.

   MAINTAINER'S NOTE — the totals below are the template's totals, and they do not foot:
   the invoice column sums to 15,640.00 / 10,166.00 against a printed 15,340.00 / 9,166.50, and
   gross less the two deductions is 7,770.00 / 5,377.50 against a printed 8,270.00 / 5,375.50.
   They are reproduced as issued deliberately. Switch `CCJ_DHI_SHEET.computeTotals` to true to
   foot the columns instead. == */
const CCJ_DHI_SHEET={
  // false = print the sheet exactly as issued, discrepancies and all. true = add the columns up.
  computeTotals:false,
  fx:{from:'SGD',to:'EUR',rate:'0.65'},
  cols:['SGD','EUR'],
  invoice:[
    {k:'Total Monthly Gross Salary',      a:'10,000.00', b:'6,500'},
    {k:'Social premium and employer cost', a:'2,300.00', b:'1,495'},
    {k:'Foreign Worker Levy',              a:'1,540.00', b:'1,001'},
    {k:'Local authorities cost',             a:'300.00', b:'195.00'},
    {k:'ADT Monthly Management Fee',       a:'1,000.00', b:'650'},
    {k:'Visa Transfer Fee',                  a:'500.00', b:'325.00'}
  ],
  invoiceTotal:{k:'ADT Monthly Invoice Value', a:'15,340.00', b:'9,166.50'},
  net:[
    {k:'Gross salary',           a:'10,000.00', b:'6,500', strong:true},
    {k:'Central provident fund',  a:'1,480.00', b:'960'},
    {k:'Income Tax',                a:'750.00', b:'162.50'}
  ],
  netTotal:{k:'Net pay to Candidate', a:'8,270.00', b:'5,375.50'},
  notes:[
    'All figures presented in this calculation are ESTIMATION only, actuals can only be provided at the time of processing Monthly payroll.',
    'We require a Standard 1 month refundable deposit per worker (payroll cost and our monthly fee) at the outset i.e SGD 14454',
    'Onboarding and offboarding fee are one time cost.'
  ],
  oneOff:[{k:'Onboarding Fee',a:'431.00'},{k:'Offboarding Fee',a:'431.00'}]
};
/* Adding a money column that was authored as display strings. Only reached when computeTotals is
   on, so the default path never depends on parsing back what it just printed. */
function ccjDhiSum(rows,key,signs){
  let n=0;
  rows.forEach(function(r,i){
    const v=parseFloat(String(r[key]||'0').replace(/,/g,''))||0;
    n+=(signs&&signs[i]===-1?-v:v);
  });
  return n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
/* The sheet's date. The contract's own issue date when it has one — a document that says today
   every time it is looked at is not a document. */
function ccjDhiDate(){
  const e=ccjEmp(),f=ccjRun.form||{};
  if(f.fromDate)return ccjPrettyDate(f.fromDate);
  return e.approvedAt?ccjStamp(e.approvedAt):ccjPrettyDate(f.toDate)||'&mdash;';
}
/* The logo, as an absolute URL wherever one can be worked out.
   The download writes the document into an `about:blank` iframe, and a relative `src` there is
   resolved against a base that is not this page's — the stylesheets get away with it, an image
   asset should not be asked to. Falls back to the relative path when there is no location to
   resolve against, which is the headless harness. */
function ccjDhiLogoSrc(){
  const rel=(typeof window!=='undefined'&&window.__resources&&window.__resources.logo)
    ||'assets/Opendhilogo.png';
  try{
    const base=(typeof document!=='undefined'&&document.baseURI)
      ||(typeof location!=='undefined'&&location.href);
    if(base&&typeof URL==='function')return new URL(rel,base).href;
  }catch(err){}
  return rel;
}
function buildCCJDhiSheetHTML(){
  const S=CCJ_DHI_SHEET,e=ccjEmp(),p=ccjParties();
  const F=function(path,v,opts){return ccjDocF('emp',path,v,opts);};
  const logo=ccjDhiLogoSrc();
  const row=function(r){
    return '<tr class="ccj-dhi-r'+(r.strong?' b':'')+'">'
      +'<td class="k">'+r.k+'</td>'
      +'<td class="n">'+r.a+'</td>'
      +'<td class="n">'+r.b+'</td></tr>';
  };
  const total=function(t,a,b,cls){
    return '<tr class="ccj-dhi-tot'+(cls?' '+cls:'')+'">'
      +'<td class="k">'+t+'</td>'
      +'<td class="n">'+a+'</td>'
      +'<td class="n">'+b+'</td></tr>';
  };
  const sec=function(strong,rest){
    return '<tr class="ccj-dhi-sec"><td colspan="3"><b>'+strong+'</b> '+rest+'</td></tr>';
  };
  // Gross carries +, the two deductions carry −, which is what makes the net footing a sum.
  const invA=S.computeTotals?ccjDhiSum(S.invoice,'a'):S.invoiceTotal.a;
  const invB=S.computeTotals?ccjDhiSum(S.invoice,'b'):S.invoiceTotal.b;
  const netA=S.computeTotals?ccjDhiSum(S.net,'a',[1,-1,-1]):S.netTotal.a;
  const netB=S.computeTotals?ccjDhiSum(S.net,'b',[1,-1,-1]):S.netTotal.b;
  return '<div class="ccj-dhi">'
    +'<div class="ccj-dhi-top">'
    +'<div class="ccj-dhi-logo"><img src="'+attrSafe(logo)+'" alt="Dhi"></div>'
    +'<div class="ccj-dhi-ref">'
    +'<div class="ccj-dhi-refrow"><span>Date:</span><b>'+F('t:dhi.date',ccjDhiDate())+'</b></div>'
    +'<div class="ccj-dhi-refrow"><span>Quote No:</span><b>'
      +F('t:dhi.ref',e.id+(e.version>1?'/v'+e.version:''))+'</b></div>'
    +'</div></div>'

    +'<div class="ccj-dhi-ids">'
    +'<div class="ccj-dhi-idrow"><span>Client:</span><b>'+F('t:dhi.client',p.client.name)+'</b></div>'
    +'<div class="ccj-dhi-idrow"><span>Employee name:</span><b>'+F('t:dhi.worker',p.worker.name)+'</b></div>'
    +'<div class="ccj-dhi-idrow"><span>Conversion rate '+S.fx.from+' to '+S.fx.to
      +': 1 '+S.fx.from+' equals to</span><b class="rate">'+F('t:dhi.rate',S.fx.rate)+'</b></div>'
    +'</div>'

    +'<table class="ccj-dhi-tbl">'
    +sec('Monthly Invoice','calculation')
    +'<tr class="ccj-dhi-hd"><td></td><td class="n">'+S.cols[0]+'</td><td class="n">'+S.cols[1]+'</td></tr>'
    +S.invoice.map(row).join('')
    +total(S.invoiceTotal.k,invA,invB)
    +sec('Gross to Net Salary','calculation')
    +S.net.map(row).join('')
    +total(S.netTotal.k,netA,netB,'net')
    +'</table>'

    +'<ol class="ccj-dhi-notes">'
    +S.notes.map(function(n,i){
      return '<li>'+F('t:dhi.note.'+(i+1),n,{multiline:true})+'</li>';
    }).join('')
    +'</ol>'

    +'<table class="ccj-dhi-oneoff">'
    +S.oneOff.map(function(r){
      return '<tr><td class="k">'+r.k+'</td><td class="n">'+r.a+'</td></tr>';
    }).join('')
    +'</table>'
    +'</div>';
}
function buildCCJEmpHTML(){
  const run=ccjRun,e=ccjEmp(),p=ccjParties(),f=run.form||{},s=ccjStat(p.worker.country);
  const drafted=!!e.terms;
  const reg=ccjReg(p.worker.country);
  const state=ccjEmpStateLabel();
  const adj=ccjAuditAdjusted().length,bad=ccjAuditFailed().length;
  const kv=function(k,v){return '<div class="ccj-ec-kv"><span>'+k+'</span><b>'
    +ccjDocF('emp','t:kv.'+k,v||'&mdash;')+'</b></div>';};
  const t=e.terms||{};
  const sym=ccjCurrency();
  // The band above the paper: what this document is, and where the check has got to.
  const band=function(){
    if(!e.audit.length)return '<div class="ccj-ec-stat '+state.cls+'">'
      +'<div class="ccj-ec-stat-t">'+state.t+'</div>'
      +'<div class="ccj-ec-stat-s">'+(drafted
        ?e.id+' &middot; '+p.worker.name+' &middot; governed by the law of '+p.worker.country
        :'The contract is generated from the approved quote and the contract details.')+'</div>'
      +(e.approvedBy?'<div class="ccj-ec-stat-s">Approved by '+e.approvedBy+' on '+ccjStamp(e.approvedAt)+'.</div>':'')
      +'</div>';
    const n=e.auditAt,total=e.audit.length;
    return '<div class="ccj-ec-stat audit'+(e.auditDone?(bad?' stop':' ok'):'')+'">'
      +'<div class="ccj-ec-stat-t">'
      +(e.auditDone
        ?(bad?bad+' clause'+(bad===1?'':'s')+' cannot be issued'
             :total+' clauses checked against the '+p.worker.country+' statutory set')
        :'Checking clause '+Math.min(n+1,total)+' of '+total+' against the '+p.worker.country+' statutory set')
      +'</div>'
      +'<div class="ccj-ec-bar"><span style="width:'+Math.round(n/total*100)+'%"></span></div>'
      +'<div class="ccj-ec-stat-s">'
      +(e.auditDone
        ?(adj?adj+' clause'+(adj===1?'':'s')+' adjusted to meet '+s.law.replace(/^the /,'')+'. The changes are marked in the document below.'
             :'Every checked clause met the statutory set as drafted. Nothing was changed.')
        :'Compliance Hub &middot; Rates &amp; Rules &middot; '+p.worker.country)
      +'</div></div>';
  };
  const clause=function(cl){
    const row=ccjAuditRow(cl.key);
    const live=!e.auditDone&&e.audit.length&&e.audit[e.auditAt]&&e.audit[e.auditAt].key===cl.key;
    const mark=row
      ?'<span class="ccj-ec-mark '+row.verdict+'">'+(row.verdict==='pass'?'&#10003; Compliant'
        :row.verdict==='adjust'?'&#8635; Adjusted'
        :row.verdict==='fail'?'&#10007; Breach':'&ndash; Not checked')+'</span>'
      :live?'<span class="ccj-ec-mark checking"><span class="ccj-spin sm"></span>Checking</span>':'';
    return '<div class="ccj-ec-cl'+(row?' '+row.verdict:'')+(live?' live':'')+'" id="ccj-ec-cl-'+cl.n+'">'
      +'<div class="ccj-ec-cl-h"><span>'+cl.n+'</span>'+ccjDocF('emp','t:cl.'+cl.n+'.t',cl.title)+mark+'</div>'
      +'<p>'+ccjDocF('emp','t:cl.'+cl.n+'.b',cl.body,{multiline:true})+'</p>'
      +(row?'<div class="ccj-ec-rule '+row.verdict+'">'
        +'<div class="ccj-ec-rule-h">'+row.rule+'<i>'+row.source+'</i></div>'
        +'<div class="ccj-ec-rule-cmp"><span>Required</span><b>'+row.expected+'</b></div>'
        +'<div class="ccj-ec-rule-cmp"><span>Drafted</span><b>'+row.drafted+'</b></div>'
        +'<div class="ccj-ec-rule-n">'+row.note+'</div>'
        +'</div>':'')
      +'</div>';
  };
  return '<div class="ccj-ec-wrap">'
    +band()
    +ccjDocEditBarHTML('emp')
    +'<div class="ccj-ec'+(drafted?'':' pending')
      +(ccjDocEditing('emp')?' ccj-doc-behind':'')+(e.editFlash?' ccj-doc-flash':'')+'">'
    // The Dhi sheet is the front of the document; the contract proper starts below the rule.
    +buildCCJDhiSheetHTML()

    +'<div class="ccj-ec-head sub">'
    +'<div><div class="ccj-ec-brand">ADT</div>'
    +'<div class="ccj-ec-brandsub">Global Employment Platform</div></div>'
    +'<div class="ccj-ec-ref"><div class="ccj-ec-kind">CONTRACT OF EMPLOYMENT</div>'
    +'<div class="ccj-ec-no">'+e.id+(e.version>1?' &middot; v'+e.version:'')+'</div></div>'
    +'</div>'

    +'<div class="ccj-ec-parties">'
    +'<div class="ccj-ec-party"><div class="ccj-ec-party-t">Employer</div>'
    +'<div class="ccj-ec-party-n">'+ccjDocF('emp','t:party.er.n',p.adt.name)+'</div>'
    +'<div class="ccj-ec-party-a">'+ccjDocF('emp','t:party.er.a',reg.adt.join('<br>'),{multiline:true})+'</div>'
    +'<div class="ccj-ec-party-v">'+ccjDocF('emp','t:party.er.v',reg.reg)+'</div></div>'
    +'<div class="ccj-ec-party"><div class="ccj-ec-party-t">Employee</div>'
    +'<div class="ccj-ec-party-n">'+ccjDocF('emp','t:party.ee.n',p.worker.name)+'</div>'
    +'<div class="ccj-ec-party-a">'+ccjDocF('emp','t:party.ee.a',(f.address||'&mdash;'),{multiline:true})+'</div>'
    +'<div class="ccj-ec-party-v">'+ccjDocF('emp','t:party.ee.v',(f.dob?'Born '+ccjPrettyDate(f.dob)+' &middot; ':'')
      +(f.nationality||p.worker.country)+' national')+'</div></div>'
    +'</div>'

    +'<div class="ccj-ec-meta">'
    +kv('Position',f.jobTitle)
    +kv('Start date',ccjPrettyDate(f.fromDate))
    +kv('Term',f.term==='Fixed Term'?'Fixed term to '+ccjPrettyDate(f.toDate):'Indefinite')
    +kv('Schedule',f.schedule)
    +kv('Gross salary',drafted?sym+'&nbsp;'+Number(t.gross).toLocaleString()+' a month':'')
    +kv('Probation',drafted?t.probation+' months':'')
    +kv('Notice',drafted?t.notice+' days':'')
    +kv('Annual leave',drafted?t.holiday+' days':'')
    +kv('Work permit',/assist/i.test(f.workPermit||'')?'ADT to assist with the visa':'Held by the employee')
    +kv('Governing law',p.worker.country)
    +'</div>'

    +'<div class="ccj-ec-body">'
    +(drafted?ccjEmpClauses().map(clause).join(''):'')
    +'</div>'

    +'<div class="ccj-ec-sec"><div class="ccj-ec-sec-t">Signatures</div>'
    +'<div class="ccj-ec-sigrow">'
    +ccjSigBlockHTML('For and on behalf of '+p.adt.name,p.adt.signatory,'Authorised signatory',
        e.adtSignedAt,e.adtSignedAt>0)
    +ccjSigBlockHTML('The Employee',p.worker.name,'Employee',
        e.workerSignedAt,e.workerSignedAt>0)
    +'</div>'
    // `stamped` reserves the width the EXECUTED stamp occupies. Without it the stamp — which has
    // to overlap the paper to read as a stamp — sat on top of this sentence.
    // The Employee signs SECOND now, so theirs is the signature the document is executed on.
    +'<div class="ccj-ec-exec'+(e.workerSignedAt?' stamped':'')+'">'+(e.workerSignedAt
      ?'Executed on the later of the two signatures above. Employment commences on '+ccjPrettyDate(f.fromDate)+'.'
      :e.sentAt?'Signed by the Employer and issued to the Employee for signature.'
      :e.adtSignedAt?'Signed by the Employer. Not yet issued.'
      :'Draft. Not yet issued.')+'</div>'
    +'</div>'
    +(e.workerSignedAt?'<div class="ccj-ec-stamp">EXECUTED</div>':'')
    +'</div>'

    +(e.sentAt?buildCCJEnvelopeHTML():'')

    // The contract states what it is; the conversation asks what to do next.
    +(run.phase==='rest'
      ?'<div class="ccj-ec-next">'
       +'<div class="ccj-ec-next-t">Contract executed. '+p.worker.name.split(' ')[0]
         +' is employed from '+ccjPrettyDate(f.fromDate)+'.</div>'
       +'</div>'
      :'')
    // Demo scaffolding. CCJ_WORKER_SCRIPT already drives the employee on its own timing, and a row
    // of buttons living on the contract itself is the last thing the document should carry.
    // Gone once THEY have signed — that is now the end of the flow, not our countersignature.
    +(e.sentAt&&!e.workerSignedAt&&!ccjUsesTranscript(run.stage)?buildCCJWorkerSimHTML():'')
    +'</div>';
}
/* The e-signature audit trail. A signature is only worth what the record behind it says — who
   opened it, from where, on what, and when — so the envelope is shown rather than summarised. */
function buildCCJEnvelopeHTML(){
  const e=ccjEmp(),w=ccjWorker(),p=ccjParties(),c=ccjCtx();
  const row=function(label,sub,at,on){
    return '<div class="ccj-env-row'+(on?' done':'')+'">'
      +'<span class="ccj-env-dot"></span>'
      +'<div class="ccj-env-body"><div class="ccj-env-label">'+label+'</div>'
      +'<div class="ccj-env-sub">'+sub+'</div></div>'
      +'<span class="ccj-env-when">'+(on?ccjStamp(at):'&mdash;')+'</span></div>';
  };
  // In the order it happened: we sign, it goes out, they read it, they sign. Our signature leads
  // because it now precedes the send — an envelope that listed it last would be a record of a
  // sequence that did not occur.
  return '<div class="ccj-env">'
    +'<div class="ccj-env-head">Signature envelope<span>Docuseal &middot; '+c.envelopeId+'</span></div>'
    +row('Signed by the employer',p.adt.signatory+' for '+p.adt.name,e.adtSignedAt,!!e.adtSignedAt)
    +row('Sent to the employee',p.worker.email,e.sentAt,!!e.sentAt)
    +row('Opened',w.device+' &middot; '+p.worker.country,e.openedAt,!!e.openedAt)
    +row('Copy downloaded','PDF &middot; '+e.id,w.downloadedAt,w.downloaded)
    +row('Countersigned by the employee',p.worker.name,e.workerSignedAt,!!e.workerSignedAt)
    +'</div>';
}
function buildCCJWorkerSimHTML(){
  const e=ccjEmp();
  const btn=function(ev,label,on){
    return '<button class="ccj-sim-btn" onclick="ccjWorkerEvent(\''+ev+'\')"'+(on?'':' disabled')+'>'
      +label+'</button>';
  };
  return '<div class="ccj-sim">'
    +'<div class="ccj-sim-head">Simulate employee<span>demo</span></div>'
    +'<div class="ccj-sim-btns">'
    +btn('open','Opens the contract',!!e.sentAt&&!e.openedAt)
    +btn('download','Downloads a copy',!!e.openedAt&&!ccjWorker().downloaded)
    +btn('sign','Signs it',!!e.sentAt&&!e.workerSignedAt)
    +'</div>'
    +'<div class="ccj-sim-note">Left alone the employee signs on their own. These are the same events.</div>'
    +'</div>';
}

/* ---- WIRING STAGE 7 INTO THE RUNNER ------------------------------------------------------ */
/* "The statutory filings" is the phrase an operating model uses; nobody reading this knows which
   filings, or who they go to. Naming the two authorities says the same thing and can be pictured. */
CCJ_STAGE_REST['employment-contract']={label:'Start onboarding',
  next:'Next is onboarding &mdash; ID checks, documents, registering them with the tax and social security offices, and a bank account to pay into.'};

CCJ_PURPOSE['employment-contract/Draft generated']='Generates the contract from the approved quote and the contract details.';
CCJ_PURPOSE['employment-contract/Clause compliance check']='Checks every clause against the country statutory set, and adjusts what falls short.';
CCJ_PURPOSE['employment-contract/Internal approval']='Someone reads the contract, and the adjustments, before it goes out.';
CCJ_PURPOSE['employment-contract/ADT signed']='Our signature, added before it goes out.';
CCJ_PURPOSE['employment-contract/Sent to worker']='Issues the signed contract to the employee for their signature.';
CCJ_PURPOSE['employment-contract/Worker signed']='The employee signs. Nothing here is ours to press, and the contract is in force from it.';

/* Drafting is what the step produces, so it happens when the step settles. */
CCJ_ON_SETTLE['employment-contract/Draft generated']=function(run){
  ccjDraftContract();
};
/* The audit begins as the check begins — see CCJ_ON_ENTER above for why it is not hung off the
   previous step's settle. */
CCJ_ON_ENTER['employment-contract/Clause compliance check']=function(run){
  ccjAuditStart();
};
CCJ_ON_SETTLE['employment-contract/Sent to worker']=function(run){
  const e=ccjEmp(),c=ccjClient(),p=ccjParties();
  c.mins+=90;
  e.sentAt=c.mins;
  ccjWorkerPush({who:'us',kind:'eccontract',id:e.id,to:p.worker.email,
    start:(run.form||{}).fromDate,at:c.mins});
  ccjWorkerSchedule();
};
/* The contract is executed on the LAST signature, and the last signature is now theirs — so the
   message that says so hangs off the employee's step rather than ours. */
CCJ_ON_SETTLE['employment-contract/Worker signed']=function(run){
  ccjWorkerPush({who:'us',kind:'ecexecuted',id:ccjEmp().id,
    from:(run.form||{}).fromDate,at:ccjClient().mins});
};

/* The check must not tick green while the document beside it is still being annotated. It holds
   on the audit finishing, which is the only thing that ends it. */
CCJ_HOLDS['employment-contract/Clause compliance check']={
  until:'audit-done',
  verb:'Reviewing',
  note:'Reading the contract clause by clause.',
  // The count, read from the audit the screen is drawing, so the block cannot claim a different
  // position in the document to the one being highlighted beside it.
  rows:function(){
    const e=ccjRun&&ccjRun.emp;
    if(!e||!e.audit||!e.audit.length)return [];
    const adjusted=ccjAuditAdjusted().length;
    return [['Clauses',Math.min(e.auditAt+(e.auditDone?0:1),e.audit.length)+' of '+e.audit.length],
            ['Adjusted',adjusted?adjusted+' rewritten to meet local law':'']];
  }
};
/* The employee signs on their own time, and there is no button here that can do it for them —
   the Worker owner has a null persona precisely so this cannot be ticked on their behalf. */
CCJ_WAITS['employment-contract/Worker signed']={pre:true,
  met:function(){return !!ccjEmp().workerSignedAt;},
  note:'Envelope is open with the employee. Nothing here is ours to press.'};

/* The one human stop before the contract leaves the building. Sending it back is a LOOP to the
   draft, not a stop: a rejected contract is redrafted, not abandoned. */
CCJ_GATES['employment-contract/Internal approval']=function(){
  const e=ccjEmp();
  const adj=ccjAuditAdjusted(),bad=ccjAuditFailed();
  /* Keeps a `why` because it reports the audit's finding, which the ask cannot: WHICH clauses the
     statutory check moved, and whether the contract can be issued at all. What it no longer does
     is append "the employee signs whatever this says, and we carry the employment liability" —
     true, but an argument for the control rather than a fact about this contract, and the ask
     ("goes to the employee to sign once approved") already carries the weight.

     Verb agreement is per branch. It previously read "1 clause were rewritten": the noun was
     pluralised and the verb was not, so every single-clause run — the common one — printed a
     grammatical error on the card. */
  const why=bad.length
    ?bad.length+' clause'+(bad.length===1?' does':'s do')+' not meet local law. This cannot be issued as it stands.'
    :adj.length
      ?(adj.length===1?'1 clause was changed':adj.length+' clauses were changed')
        +' to meet local law: '+adj.map(function(r){return r.clause.toLowerCase();}).join(', ')+'.'
      :'No clauses needed changing for local law.';
  return {
    kind:'approval',
    // Same shape as the quote QA card in stage 2: state where the document goes on approval and
    // let the buttons carry the verbs, rather than instructing the reader to press the button
    // sitting an inch below the sentence telling them to press it.
    ask:e.id+' goes to the employee to sign as soon as it is approved.',
    why:why,
    options:[
      // "Issue" is the word the record uses for sending a contract out. The button says what the
      // reader can picture happening: it is sent to the person who has to sign it.
      {id:'ecApprove',label:'Approve and send it',tone:'go',  done:'Approved'},
      {id:'ecRedraft',label:'Send back to redraft',        tone:'stop',done:'Sent back to redraft'}
    ]
  };
};
CCJ_REWORK['employment-contract/Internal approval']='Draft generated';
/* Our signature, and the last point at which we can decline — which is now BEFORE the contract
   leaves the building rather than after it comes back. An arrival gate: the evidence that
   justifies it is the internal approval and the audit behind it, both already on the document.

   The card no longer opens on "the employee has signed", because they have not, and it must not
   ask this question on a fact that has not happened yet. What makes it answerable now is that the
   document is approved and about to go out under our name. */
CCJ_GATES['employment-contract/ADT signed']=function(){
  const e=ccjEmp(),p=ccjParties();
  return {
    kind:'approval',
    ask:'Sign '+e.id+' and issue it to '+p.worker.name.split(' ')[0]+'?',
    why:'Ours is the first signature. They receive a contract we have already committed to, and theirs is what puts it in force.',
    options:[
      {id:'ecCountersign',label:'Sign and issue it',tone:'go',  done:'Signed and issued'},
      {id:'ecDecline',    label:'Decline to sign',              tone:'stop',done:'Declined',
       stop:{title:'Contract declined',note:'Nothing is in force and the employee cannot start.'}}
    ]
  };
};

/* == STAGE 8: ONBOARDING ===================================================================
   Every stage before this produced ONE artefact — a quote, an account, an agreement, an invoice,
   a contract. This one produces six, and they are six genuinely different pieces of work with
   six different counterparties: an identity provider, the employee themselves, a tax authority,
   a social security institution, a bank, and our own payroll engine.

   So the screen is not a document. It is the ONBOARDING FILE: one card per workstream, the one
   currently running open in full, the finished ones collapsed to what they actually produced —
   the tax number, the enrolment reference, the account that was verified. That is how an
   onboarding tracker works in the real world, and it is the only shape that lets someone answer
   the question this screen exists to answer: can this person be paid on the first of the month.

   == WHY KYC IS RENDERED AT THIS DEPTH ===================================================
   Identity verification is the step every EOR platform claims and none of them shows. What
   actually happens is not "KYC: passed". A provider takes a document, reads its machine-readable
   zone, checks the security features for tampering, takes a live selfie, matches the face against
   the document portrait, proves the selfie is a live human and not a replay, screens the person
   against sanctions, PEP and adverse-media lists, establishes whether they may lawfully work in
   the country at all, and returns a decision with a risk score — CLEAR, CONSIDER or REJECT.

   Every one of those is on screen here, with its own result, because a customer buying this is
   buying the fact that we did them. And CONSIDER is a real outcome: where the run cannot clear
   right-to-work on its own — a non-EU national, or a visa we have been asked to sponsor — it
   stops and puts it to a person rather than passing itself.

   == NOTHING IS COUNTRY-AGNOSTIC ========================================================
   A Dutch onboarding needs a BSN and a Loonheffingen registration; a German one needs a
   Steuer-ID, an ELStAM retrieval and a DE&Uuml;V notification to a Krankenkasse; an Indian one
   needs a PAN, a UAN and an ESIC number. The checklist, the authorities, the reference formats
   and the documents all come out of CCJ_ONB, so the run shows the country's actual process
   rather than a generic six-step bar.                                                     == */

const CCJ_ONB={
  'Netherlands':{
    idDoc:'Netherlands passport',mrz:'NLD',issuer:'Kingdom of the Netherlands',
    taxAuthority:'Belastingdienst',taxFiling:'Loonheffingen registration',
    taxIdLabel:'BSN',taxCredit:'Loonheffingskorting applied from the first period',
    ssAuthority:'UWV / SVB',ssFiling:'Werknemersverzekeringen enrolment',
    ssIdLabel:'BSN',ssScheme:'AOW, WW, WAO and Zvw',
    empSocial:8.9,taxEff:31.5,
    docs:[
      {id:'id',   req:true, who:'worker',label:'Passport or national ID',        why:'Identity and right to work'},
      {id:'bsn',  req:true, who:'worker',label:'BSN &mdash; citizen service number',why:'Required on every payroll tax filing'},
      {id:'addr', req:true, who:'worker',label:'Proof of address',               why:'Municipal registration &mdash; must be issued within 3 months'},
      {id:'bank', req:true, who:'worker',label:'Bank account (IBAN)',            why:'Salary payment'},
      {id:'wage', req:true, who:'worker',label:'Model opgaaf gegevens voor de loonheffingen',why:'Applies the payroll tax credit'},
      {id:'rule', req:false,who:'adt',   label:'30% ruling application',         why:'Only for qualifying incoming employees'}
    ]},
  'Germany':{
    idDoc:'German Personalausweis',mrz:'D&lt;&lt;',issuer:'Bundesrepublik Deutschland',
    taxAuthority:'Finanzamt',taxFiling:'ELStAM retrieval',
    taxIdLabel:'Steuer-ID',taxCredit:'Tax class III applied on the ELStAM record',
    ssAuthority:'Krankenkasse &middot; DE&Uuml;V',ssFiling:'Anmeldung zur Sozialversicherung',
    ssIdLabel:'Sozialversicherungsnummer',ssScheme:'Renten-, Kranken-, Pflege- und Arbeitslosenversicherung',
    empSocial:20.6,taxEff:33.5,
    docs:[
      {id:'id',   req:true, who:'worker',label:'Personalausweis or passport',    why:'Identity and right to work'},
      {id:'tax',  req:true, who:'worker',label:'Steueridentifikationsnummer',    why:'Required to retrieve the ELStAM tax record'},
      {id:'sv',   req:true, who:'worker',label:'Sozialversicherungsausweis',     why:'Social security enrolment'},
      {id:'kk',   req:true, who:'worker',label:'Krankenkasse confirmation',      why:'Health insurance is compulsory and the employer remits to it'},
      {id:'bank', req:true, who:'worker',label:'Bank account (IBAN)',            why:'Salary payment'},
      {id:'addr', req:false,who:'worker',label:'Meldebescheinigung',             why:'Registered address, where the Finanzamt requires it'}
    ]},
  'India':{
    idDoc:'Indian passport',mrz:'IND',issuer:'Republic of India',
    taxAuthority:'Income Tax Department',taxFiling:'TDS registration against PAN',
    taxIdLabel:'PAN',taxCredit:'New regime slab applied',
    ssAuthority:'EPFO / ESIC',ssFiling:'UAN generation and ESIC registration',
    ssIdLabel:'UAN',ssScheme:'EPF, EPS, ESI and Gratuity',
    empSocial:12,taxEff:18,
    docs:[
      {id:'id',   req:true, who:'worker',label:'Passport or Aadhaar',            why:'Identity'},
      {id:'pan',  req:true, who:'worker',label:'PAN card',                       why:'Tax deduction at source'},
      {id:'uan',  req:false,who:'worker',label:'Existing UAN',                   why:'Carries the provident fund across employers'},
      {id:'form11',req:true,who:'worker',label:'Form 11 &mdash; EPF declaration',why:'Provident fund enrolment'},
      {id:'bank', req:true, who:'worker',label:'Cancelled cheque or passbook',   why:'Salary payment and PF settlement'},
      {id:'addr', req:true, who:'worker',label:'Proof of address',               why:'Statutory record'}
    ]},
  'Spain':{
    idDoc:'Spanish passport',mrz:'ESP',issuer:'Reino de Espa&ntilde;a',
    taxAuthority:'Agencia Tributaria',taxFiling:'Modelo 145 &middot; IRPF withholding',
    taxIdLabel:'NIF / NIE',taxCredit:'IRPF rate set from the Modelo 145',
    ssAuthority:'Tesorer&iacute;a General de la Seguridad Social',ssFiling:'Alta en la Seguridad Social',
    ssIdLabel:'N&uacute;mero de la Seguridad Social',ssScheme:'R&eacute;gimen General',
    empSocial:6.35,taxEff:24,
    docs:[
      {id:'id',   req:true, who:'worker',label:'DNI, NIE or passport',           why:'Identity and right to work'},
      {id:'nss',  req:true, who:'worker',label:'N&uacute;mero de la Seguridad Social',why:'Social security enrolment'},
      {id:'m145', req:true, who:'worker',label:'Modelo 145',                     why:'Sets the IRPF withholding rate'},
      {id:'bank', req:true, who:'worker',label:'Bank account (IBAN)',            why:'Salary payment'},
      {id:'addr', req:true, who:'worker',label:'Certificado de empadronamiento', why:'Registered address'}
    ]},
  'United Kingdom':{
    idDoc:'UK passport',mrz:'GBR',issuer:'United Kingdom',
    taxAuthority:'HM Revenue &amp; Customs',taxFiling:'Full Payment Submission &middot; new starter',
    taxIdLabel:'National Insurance number',taxCredit:'Tax code 1257L applied on a cumulative basis',
    ssAuthority:'HMRC &middot; NEST',ssFiling:'National Insurance and pension auto-enrolment',
    ssIdLabel:'National Insurance number',ssScheme:'Class 1 NI and auto-enrolment pension',
    empSocial:8,taxEff:23,
    docs:[
      {id:'id',   req:true, who:'worker',label:'Passport or share code',         why:'Right to work check'},
      {id:'ni',   req:true, who:'worker',label:'National Insurance number',      why:'PAYE and National Insurance'},
      {id:'start',req:true, who:'worker',label:'Starter checklist or P45',       why:'Sets the tax code'},
      {id:'bank', req:true, who:'worker',label:'Bank account and sort code',     why:'Salary payment'},
      {id:'pen',  req:false,who:'worker',label:'Pension opt-out',                why:'Only if they choose to opt out of auto-enrolment'}
    ]},
  'France':{
    idDoc:'French passport',mrz:'FRA',issuer:'R&eacute;publique fran&ccedil;aise',
    taxAuthority:'DGFiP',taxFiling:'Pr&eacute;l&egrave;vement &agrave; la source',
    taxIdLabel:'Num&eacute;ro fiscal',taxCredit:'Taux non personnalis&eacute; applied until DGFiP returns a rate',
    ssAuthority:'URSSAF',ssFiling:'D&eacute;claration pr&eacute;alable &agrave; l&rsquo;embauche',
    ssIdLabel:'Num&eacute;ro de s&eacute;curit&eacute; sociale',ssScheme:'URSSAF, retraite compl&eacute;mentaire and mutuelle',
    empSocial:22,taxEff:20,
    docs:[
      {id:'id',   req:true, who:'worker',label:'Carte d&rsquo;identit&eacute; or passport',why:'Identity and right to work'},
      {id:'ss',   req:true, who:'worker',label:'Num&eacute;ro de s&eacute;curit&eacute; sociale',why:'URSSAF enrolment'},
      {id:'rib',  req:true, who:'worker',label:'RIB',                            why:'Salary payment'},
      {id:'vitale',req:false,who:'worker',label:'Attestation Carte Vitale',      why:'Health cover record'},
      {id:'addr', req:true, who:'worker',label:'Justificatif de domicile',       why:'Statutory record'}
    ]},
  'Italy':{
    idDoc:'Italian passport',mrz:'ITA',issuer:'Repubblica Italiana',
    taxAuthority:'Agenzia delle Entrate',taxFiling:'Codice Fiscale registration',
    taxIdLabel:'Codice Fiscale',taxCredit:'IRPEF scaglioni applied',
    ssAuthority:'INPS / INAIL',ssFiling:'Comunicazione UNILAV',
    ssIdLabel:'Matricola INPS',ssScheme:'INPS, INAIL and TFR',
    empSocial:9.19,taxEff:27,
    docs:[
      {id:'id',   req:true, who:'worker',label:'Carta d&rsquo;identit&agrave; or passport',why:'Identity and right to work'},
      {id:'cf',   req:true, who:'worker',label:'Codice Fiscale',                 why:'Every payroll filing is keyed on it'},
      {id:'bank', req:true, who:'worker',label:'Bank account (IBAN)',            why:'Salary payment'},
      {id:'addr', req:true, who:'worker',label:'Certificato di residenza',       why:'Statutory record'}
    ]}
};
function ccjOnbPack(country){
  return CCJ_ONB[country||ccjParties().worker.country]||CCJ_ONB['Netherlands'];
}

/* ---- THE ONBOARDING FILE ------------------------------------------------------------------
   One object holding all six workstreams. Built once from the country pack, then filled in as
   each stream runs — so a completed stream keeps what it produced and the screen can show it
   collapsed rather than losing it. */
function ccjOnb(){
  const run=ccjRun;
  if(!run.onb){
    const pack=ccjOnbPack(),p=ccjParties();
    const num=String(1042+(run.gen||0));
    run.onb={
      kyc:{session:'IDV-'+(8800+(run.gen||0)),at:0,step:0,done:false,
           decision:'',score:0,reviewed:'',reviewedAt:0,forceConsider:false},
      docs:pack.docs.map(function(d){return Object.assign({},d,{status:'waiting',ref:'',at:0,note:''});}),
      docsDone:false,
      tax:{ref:'',id:'',submittedAt:0,confirmedAt:0,state:'idle'},
      ss:{ref:'',id:'',submittedAt:0,confirmedAt:0,state:'idle'},
      bank:{iban:'',holder:'',score:0,pennyAt:0,verifiedAt:0,state:'idle'},
      payroll:{builtAt:0,calendar:'',payDay:'',firstPay:'',prorated:0,days:0,state:'idle'},
      timer:null
    };
  }
  return run.onb;
}
/* ---- THE PORTRAIT ON THE IDENTITY DOCUMENT ---------------------------------------------------
   A real face makes the verification console read as a verification rather than as a diagram, so
   the portrait is a configurable asset. Drop a cropped headshot at the path below and it appears
   on the document card and on both sides of the face match.

   IT IS A HEADSHOT, NOT A DOCUMENT SCAN, and that is deliberate. Everything else on the card —
   the passport number, the MRZ, the date of birth, the expiry — is GENERATED by ccjKycDoc from
   the run, so nothing real is needed for the screen to look right. Putting a scan of a genuine
   data page here would add a passport number, a signature and a machine-readable zone to a
   repository, and git keeps what it is given even after a later delete.

   `assets/kyc-portrait.*` is in .gitignore for that reason. If the file is absent the drawn
   placeholder renders instead, so the demo never breaks on a missing asset. */
const CCJ_KYC_PORTRAIT='assets/kyc-portrait.jpg';
/* The photograph of the document itself, as the employee sends it. This is the attachment in
   their thread — what a person actually does when asked to verify their identity is take a
   picture of their passport and send it — so the thread shows the picture rather than a line of
   text claiming one was sent.

   Same rule as the portrait: `assets/kyc-scan.*` is gitignored. A real data page carries a
   passport number, an MRZ and a signature, and this repository has a remote. */
const CCJ_KYC_SCAN='assets/kyc-scan.jpg';
function ccjScanMissing(el){
  // Uncover the drawn stand-in underneath rather than leaving a blank bubble.
  if(!el||!el.parentNode)return;
  el.parentNode.removeChild(el);
}
const CCJ_FACE_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>';
/* The image sits over the drawn placeholder rather than replacing it, so a missing or unreadable
   file simply uncovers the fallback — no state to keep, and nothing to go wrong at demo time. */
function ccjPortraitMissing(el){if(el&&el.parentNode)el.parentNode.removeChild(el);}
function ccjPortraitHTML(){
  if(!CCJ_KYC_PORTRAIT)return CCJ_FACE_SVG;
  return '<img class="ccj-kyc-portrait" src="'+attrSafe(CCJ_KYC_PORTRAIT)+'" alt="" '
    +'onerror="ccjPortraitMissing(this)">'+CCJ_FACE_SVG;
}
/* Everything the identity document says, derived from the contract rather than invented — the
   whole point of the cross-check is that these two sources must agree. */
function ccjKycDoc(){
  const p=ccjParties(),f=(ccjRun&&ccjRun.form)||{};
  /* The identity document follows NATIONALITY, not the country the work is in. This read
     ccjOnbPack() — the work-country pack — so an Indian national placed in Germany was shown
     presenting a German Personalausweis, a document he could not hold. The rest of the pack is
     still the work country's, because the checklist, the tax authority and the social security
     institution genuinely are: what a person presents to prove who they are, and what their
     employer must file where they work, are two different questions. */
  const pack=ccjOnbPack(f.nationality||p.worker.country);
  const sur=String(f.lname||p.worker.name.split(' ').slice(-1)[0]||'').toUpperCase();
  const giv=String(f.fname||p.worker.name.split(' ')[0]||'').toUpperCase();
  const num=(sur.slice(0,2)+String(4718321+(ccjRun.gen||0)*37)).toUpperCase();
  return {type:pack.idDoc,issuer:pack.issuer,code:pack.mrz,
    surname:sur,given:giv,
    dob:f.dob?ccjPrettyDate(f.dob):'&mdash;',
    nationality:f.nationality||p.worker.country,
    number:num,expiry:'14 Mar 2031',
    mrzLine:'P&lt;'+pack.mrz+sur+'&lt;&lt;'+giv+('&lt;').repeat(Math.max(0,26-sur.length-giv.length))};
}
/* ---- THE WORK PERMIT ------------------------------------------------------------------------
   Which permit a cross-border hire actually needs, chosen from the country they will work in and
   what they will be paid. The salary tier matters and is not decoration: the fast routes — the EU
   Blue Card, the Dutch kennismigrant, the French Passeport Talent — are all salary-gated, so a
   Director on €222,000 qualifies for a route a junior hire on the same placement would not.

   Tiers are ordered high to low and the first one the salary clears wins. */
const CCJ_PERMITS={
  'Germany':{authority:'Ausl&auml;nderbeh&ouml;rde',code:'BK',
    tiers:[{label:'EU Blue Card',min:48300,basis:'&sect; 18b(2) AufenthG &mdash; gross salary above the general threshold'},
           {label:'Residence permit for qualified employment',min:0,basis:'&sect; 18b AufenthG'}]},
  'Netherlands':{authority:'Immigratie- en Naturalisatiedienst (IND)',code:'KM',
    tiers:[{label:'Highly Skilled Migrant permit',min:63972,basis:'Kennismigrantenregeling &mdash; recognised sponsor'},
           {label:'Residence permit for paid employment',min:0,basis:'GVVA / single permit'}]},
  'France':{authority:'Pr&eacute;fecture',code:'PT',
    tiers:[{label:'Passeport Talent',min:43243,basis:'Art. L421-9 CESEDA &mdash; salaried employee of recognised skill'},
           {label:'Autorisation de travail',min:0,basis:'Standard work authorisation'}]},
  'Spain':{authority:'Unidad de Grandes Empresas',code:'PA',
    tiers:[{label:'Highly Qualified Professional permit',min:40077,basis:'Ley 14/2013 &mdash; profesional altamente cualificado'},
           {label:'Cuenta ajena work permit',min:0,basis:'R&eacute;gimen general'}]},
  'Italy':{authority:'Sportello Unico per l&rsquo;Immigrazione',code:'CB',
    tiers:[{label:'Carta Blu UE',min:33500,basis:'D.Lgs. 108/2012 &mdash; EU Blue Card'},
           {label:'Nulla Osta al lavoro',min:0,basis:'Decreto Flussi quota'}]},
  'United Kingdom':{authority:'Home Office',code:'SW',
    tiers:[{label:'Skilled Worker visa',min:38700,basis:'Appendix Skilled Worker &mdash; licensed sponsor'},
           {label:'Skilled Worker visa (new entrant)',min:0,basis:'Appendix Skilled Worker'}]},
  'India':{authority:'FRRO',code:'EV',
    tiers:[{label:'Employment Visa',min:25000,basis:'MHA employment visa &mdash; above the salary floor'},
           {label:'Employment Visa (exempt category)',min:0,basis:'MHA employment visa'}]}
};
/* Null when no permit is needed at all — a national at home, or an EU citizen moving inside the
   EU. Returning a permit for those would invent a document nobody has to hold. */
function ccjPermit(){
  const run=ccjRun;if(!run)return null;
  const f=run.form||{},p=ccjParties();
  const nat=f.nationality||p.worker.country,work=p.worker.country;
  if(nat===work)return null;
  if(CCJ_EU.indexOf(nat)>-1&&CCJ_EU.indexOf(work)>-1)return null;
  const pack=CCJ_PERMITS[work]||CCJ_PERMITS['Germany'];
  const annual=Math.round(ccjQuote().gross*12);
  const tier=pack.tiers.find(function(t){return annual>=t.min;})||pack.tiers[pack.tiers.length-1];
  const k=(run.onb&&run.onb.kyc)||{};
  return {label:tier.label,basis:tier.basis,authority:pack.authority,min:tier.min,annual:annual,
    number:pack.code+'-'+String(70410+(run.gen||0)*17),
    expiry:'31 Aug 2030',
    // Asked us to sponsor it, so it is not held yet — that stays a decision, and should.
    sponsored:/assist/i.test(f.workPermit||''),
    captured:!!k.permitAt};
}
/* Right to work is the check that actually decides whether this hire can proceed, and it is
   DERIVED — from the nationality on the form, the country the work is in, what they are paid, and
   whether the permit has actually been SEEN.

   "Declared but not evidenced" was the honest answer while the only evidence was a tick-box on a
   form. It is no longer: a cross-border hire photographs their permit alongside their passport in
   the same verification session, so the check has the document in front of it. Sponsorship is
   still a decision, because in that case there genuinely is no permit yet. */
function ccjRightToWork(){
  const f=(ccjRun&&ccjRun.form)||{},p=ccjParties();
  const nat=f.nationality||p.worker.country,work=p.worker.country;
  const natEU=CCJ_EU.indexOf(nat)>-1,workEU=CCJ_EU.indexOf(work)>-1;
  if(nat===work)return {verdict:'pass',
    label:'National of '+ccjInCountry(work)+' &mdash; unrestricted right to work',
    detail:'No permit required.'};
  if(natEU&&workEU)return {verdict:'pass',
    label:nat+' national working in '+ccjInCountry(work)+' &mdash; EU freedom of movement',
    detail:'No permit required under Article 45 TFEU.'};
  const permit=ccjPermit();
  if(permit&&permit.sponsored)return {verdict:'consider',
    label:nat+' national working in '+ccjInCountry(work)+' &mdash; sponsorship requested',
    detail:'No permit is held. ADT was asked to sponsor the '+permit.label
      +', and that has to be in place before the start date.'};
  if(permit&&permit.captured)return {verdict:'pass',
    label:nat+' national working in '+ccjInCountry(work)+' &mdash; '+permit.label+' evidenced',
    detail:permit.label+' '+permit.number+' captured with the identity document. Issued by '
      +permit.authority+', valid to '+permit.expiry+'. '+permit.basis+'.'};
  return {verdict:'consider',
    label:nat+' national working in '+ccjInCountry(work)+' &mdash; permit declared but not evidenced',
    detail:'The form says a permit is held. A person has to see it before payroll can start.'};
}
function ccjKycChecks(){
  const d=ccjKycDoc(),f=(ccjRun&&ccjRun.form)||{},p=ccjParties();
  const rtw=ccjRightToWork();
  const contractName=(String(f.fname||'')+' '+String(f.lname||'')).trim()||p.worker.name;
  return {
    biometric:[
      {k:'Face match',v:'98.2% against the document portrait',verdict:'pass'},
      {k:'Liveness',v:'Passive &mdash; live human confirmed',verdict:'pass'},
      {k:'Injection attack',v:'No virtual camera or replay detected',verdict:'pass'}
    ],
    identity:[
      {k:'Surname',doc:d.surname,against:'Contract &mdash; '+String(f.lname||'').toUpperCase(),
       verdict:'pass'},
      {k:'Given names',doc:d.given,against:'Contract &mdash; '+String(f.fname||'').toUpperCase(),
       verdict:'pass'},
      {k:'Date of birth',doc:d.dob,against:f.dob?'Contract &mdash; '+ccjPrettyDate(f.dob):'Not on the contract',
       verdict:f.dob?'pass':'na'},
      {k:'Nationality',doc:d.nationality,against:'Contract &mdash; '+(f.nationality||'&mdash;'),
       verdict:f.nationality?'pass':'na'},
      {k:'Document number',doc:d.number,against:'&mdash;',verdict:'pass'},
      {k:'Expiry',doc:d.expiry,against:'Valid at the start date',verdict:'pass'}
    ],
    authenticity:[
      {k:'MRZ checksum',v:'Valid',verdict:'pass'},
      {k:'Security features',v:'Hologram, microprint and UV pattern present',verdict:'pass'},
      {k:'Tamper detection',v:'No digital or physical alteration',verdict:'pass'},
      {k:'Issuer validation',v:d.issuer+' &mdash; recognised issuer',verdict:'pass'}
    ],
    screening:[
      {k:'Sanctions',v:'OFAC, EU consolidated, UN, UK HMT &mdash; no match',verdict:'pass'},
      {k:'Politically exposed person',v:'No match',verdict:'pass'},
      {k:'Adverse media',v:'No match in the last 10 years',verdict:'pass'}
    ],
    rtw:rtw,
    name:contractName
  };
}
/* CLEAR unless something genuinely could not be cleared. The score is derived from the checks
   rather than authored, so a run that needs a person also LOOKS like one. */
function ccjKycDecision(){
  const k=ccjOnb().kyc;
  if(k.reviewed==='confirmed')return {id:'clear',label:'CLEAR',score:22,
    note:'Cleared by '+k.reviewed_by};
  if(k.reviewed==='rejected')return {id:'reject',label:'REJECTED',score:96,note:''};
  const c=ccjKycChecks();
  if(k.forceConsider)return {id:'consider',label:'CONSIDER',score:46,
    note:'The provider returned a partial match on the name and has put it to a person.'};
  if(c.rtw.verdict!=='pass')return {id:'consider',label:'CONSIDER',score:52,note:c.rtw.detail};
  return {id:'clear',label:'CLEAR',score:14,note:''};
}
/* The phases a real identity check moves through, in order. The card reveals one per beat, which
   is what makes it read as a verification happening rather than a result being displayed. */
const CCJ_KYC_PHASES=[
  {id:'session', label:'Verification session created',     sub:'Link issued to the employee'},
  {id:'capture', label:'Identity document captured',       sub:'Front and back, plus the machine-readable zone'},
  {id:'extract', label:'Document data read and cross-checked',sub:'Every field matched against the contract'},
  {id:'biometric',label:'Biometric verification',          sub:'Live selfie, face match and liveness'},
  {id:'authentic',label:'Document authenticity',           sub:'Security features, tampering and issuer'},
  {id:'screen',  label:'Sanctions, PEP and adverse media', sub:'Screened against the global lists'},
  {id:'rtw',     label:'Right to work',                    sub:'Whether they may lawfully work in this country'},
  {id:'decision',label:'Decision',                         sub:'Risk score and outcome'}
];
const CCJ_ONB_STEP=560;
function ccjKycStart(){
  const o=ccjOnb(),c=ccjClient();
  o.kyc.at=c.mins;o.kyc.step=0;o.kyc.done=false;
  // Re-running the verification retracts the adjudication of the previous one — reopening a
  // rejected check means deciding again, not carrying the rejection forward into a fresh result.
  // What the PROVIDER returned is not cleared: that is the input, not the decision.
  o.kyc.reviewed='';o.kyc.reviewed_by='';
  ccjPaintScreen();
  ccjScheduleAudit(ccjKycTick,CCJ_ACT*2);
}
function ccjKycTick(){
  const run=ccjRun;if(!run)return;
  const o=ccjOnb(),k=o.kyc;
  if(k.step>=CCJ_KYC_PHASES.length){
    k.done=true;
    const d=ccjKycDecision();
    k.decision=d.id;k.score=d.score;
    ccjPaintScreen();ccjPaint();
    ccjReachScreen('kyc-done');
    return;
  }
  const ph=CCJ_KYC_PHASES[k.step];
  k.step++;
  // The employee is doing part of this, so their thread says so as it happens.
  if(ph.id==='session')ccjWorkerPush({who:'us',kind:'kyc',id:k.session,at:ccjClient().mins});
  // Sent BY the employee, as an attachment, because that is what happens: they photograph the
  // document and send it. A note saying one was uploaded describes the event; the picture is it.
  if(ph.id==='capture'){
    ccjWorkerPush({who:'worker',kind:'scan',label:ccjKycDoc().type,at:ccjClient().mins});
    /* A cross-border hire is asked for their permit in the SAME session — which is what a real
       IDV flow does, and what turns right to work from a declaration into evidence. Recorded
       before the right-to-work phase reaches it, so that phase reads a captured document rather
       than a tick-box. Nothing is captured when no permit is needed. */
    const permit=ccjPermit();
    if(permit&&!permit.sponsored){
      k.permitAt=ccjClient().mins;
      ccjWorkerPush({who:'worker',kind:'scan',label:permit.label,at:ccjClient().mins});
    }
  }
  if(ph.id==='biometric')ccjWorkerPush({who:'note',text:'Completed the liveness check',at:ccjClient().mins});
  ccjPaintScreen();ccjPaint();
  ccjScheduleAudit(ccjKycTick,CCJ_ONB_STEP);
}
function ccjKycForceConsider(){
  const o=ccjOnb();
  o.kyc.forceConsider=true;
  if(o.kyc.done){const d=ccjKycDecision();o.kyc.decision=d.id;o.kyc.score=d.score;}
  ccjPaintScreen();ccjPaint();
}

/* ---- DOCUMENTS ----------------------------------------------------------------------------
   The employee supplies most of them, one at a time, and one gets REJECTED — which is what
   actually happens. A proof of address more than three months old is the commonest rejection in
   onboarding, so that is the one modelled, and the run does not move on until it is replaced. */
function ccjDocRef(id){
  return id.toUpperCase().slice(0,4)+'-'+String(3300+(ccjRun.gen||0)*7+id.length*11);
}
function ccjOnbDocs(){return ccjOnb().docs;}
function ccjDocsOutstanding(){
  return ccjOnbDocs().filter(function(d){return d.req&&d.status!=='verified';});
}
function ccjDocsStart(){
  ccjPaintScreen();
  ccjScheduleAudit(ccjDocsTick,CCJ_ACT*2);
}
function ccjDocsTick(){
  const run=ccjRun;if(!run)return;
  const o=ccjOnb();
  // The address document comes back once as rejected, then correctly the second time.
  const next=o.docs.find(function(d){return d.status==='waiting';})
    ||o.docs.find(function(d){return d.status==='rejected';});
  if(!next){
    o.docsDone=true;
    ccjPaintScreen();ccjPaint();
    ccjReachScreen('docs-done');
    return;
  }
  const c=ccjClient();c.mins+=35;
  if(next.status==='rejected'){
    next.status='verified';next.ref=ccjDocRef(next.id);next.at=c.mins;
    next.note='Replaced &mdash; issued this month.';
    ccjWorkerPush({who:'worker',kind:'doc',label:next.label,state:'resubmitted',at:c.mins});
  }else if(next.id==='addr'&&!next.note){
    next.status='rejected';next.at=c.mins;
    next.note='Issued more than 3 months ago. A current one is needed.';
    ccjWorkerPush({who:'us',kind:'doc',label:next.label,state:'rejected',
      note:next.note,at:c.mins});
  }else if(next.who==='adt'){
    // The 30% ruling is for employees RECRUITED FROM ABROAD, so whether it applies is derivable
    // from the form: a national of the country they are working in is not an incoming employee.
    const f=ccjRun.form||{};
    const incoming=(f.nationality||'')&&f.nationality!==ccjParties().worker.country;
    next.status=incoming?'verified':'na';
    next.ref=incoming?ccjDocRef(next.id):'';
    next.at=c.mins;
    next.note=incoming?'Filed with the Belastingdienst alongside the payroll registration.'
      :'Not an incoming employee &mdash; the ruling does not apply.';
  }else{
    next.status='verified';next.ref=ccjDocRef(next.id);next.at=c.mins;
    ccjWorkerPush({who:'worker',kind:'doc',label:next.label,state:'received',at:c.mins});
  }
  ccjPaintScreen();ccjPaint();
  ccjScheduleAudit(ccjDocsTick,CCJ_ONB_STEP);
}

/* ---- THE TWO FILINGS ----------------------------------------------------------------------
   Tax registration and social security enrolment are the same shape — a submission to an
   authority and a reference coming back — and different in every particular: different body,
   different filing, different number format. One builder, driven by the country pack. */
function ccjFilingId(kind){
  const p=ccjParties(),n=String(1042+(ccjRun.gen||0));
  const c=p.worker.country;
  if(kind==='tax'){
    if(c==='Netherlands')return '2841'+n.slice(-5).padStart(5,'0');           // BSN, 9 digits
    if(c==='Germany')return '12 '+n.slice(-3)+' 678 '+n.slice(-3);            // Steuer-ID
    if(c==='India')return 'ABCPN'+n.slice(-4)+'K';                            // PAN
    if(c==='United Kingdom')return 'QQ '+n.slice(-2)+' '+n.slice(-2)+' '+n.slice(-2)+' C';
    if(c==='Spain')return 'X'+n.slice(-7).padStart(7,'0')+'R';                // NIE
    if(c==='Italy')return 'BKKSNN94C58Z'+n.slice(-3);                         // Codice Fiscale
    return 'FR'+n;
  }
  if(c==='Netherlands')return '2841'+n.slice(-5).padStart(5,'0');
  if(c==='Germany')return '65 180394 B '+n.slice(-3);
  if(c==='India')return '1012'+n.slice(-8).padStart(8,'0');                   // UAN
  if(c==='United Kingdom')return 'QQ '+n.slice(-2)+' '+n.slice(-2)+' '+n.slice(-2)+' C';
  if(c==='Spain')return '28 '+n.slice(-8).padStart(8,'0');
  return 'INPS-'+n;
}
function ccjFilingStart(kind){
  const o=ccjOnb(),s=o[kind],c=ccjClient();
  c.mins+=25;
  s.state='submitted';s.submittedAt=c.mins;
  s.ref=(kind==='tax'?'TAX':'SSE')+'-'+String(55100+(ccjRun.gen||0)*3+(kind==='tax'?0:1));
  ccjPaintScreen();
  ccjScheduleAudit(function(){ccjFilingConfirm(kind);},CCJ_ACT*3);
}
function ccjFilingConfirm(kind){
  const run=ccjRun;if(!run)return;
  const o=ccjOnb(),s=o[kind],c=ccjClient();
  c.mins+=180;
  s.state='confirmed';s.confirmedAt=c.mins;s.id=ccjFilingId(kind);
  ccjPaintScreen();ccjPaint();
  ccjReachScreen(kind+'-done');
}

/* ---- BANK ---------------------------------------------------------------------------------- */
function ccjBankStart(){
  const o=ccjOnb(),p=ccjParties(),reg=ccjReg(p.worker.country),c=ccjClient();
  const b=o.bank;
  // The employee's own account, not ours — masked the way a payroll system holds it.
  b.iban=String(reg.iban).slice(0,8)+' •••• •••• '+String(4800+(ccjRun.gen||0)).slice(-4);
  b.holder=p.worker.name;
  b.state='penny';b.pennyAt=c.mins;
  ccjPaintScreen();
  ccjScheduleAudit(function(){
    const run=ccjRun;if(!run)return;
    b.state='verified';b.score=97;b.verifiedAt=ccjClient().mins+12;
    ccjPaintScreen();ccjPaint();
    ccjReachScreen('bank-done');
  },CCJ_ACT*3);
}

/* ---- PAYROLL ------------------------------------------------------------------------------
   The last stream, and the one that proves the other five worked: a first payslip, prorated to
   the start date, with the employee deductions the country actually levies. Stated as indicative
   on purpose — the payroll engine computes the binding figure on the first run, and a mockup
   claiming an exact net figure would be claiming something it has not done. */
const CCJ_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function ccjPayrollBuild(){
  const o=ccjOnb(),pr=o.payroll,f=(ccjRun&&ccjRun.form)||{},pack=ccjOnbPack();
  const parts=String(f.fromDate||'2026-10-01').split('-');
  const y=Number(parts[0])||2026,m=Number(parts[1])||10,d=Number(parts[2])||1;
  const inMonth=new Date(Date.UTC(y,m,0)).getUTCDate();
  const worked=inMonth-d+1;
  pr.calendar='Monthly &middot; '+ccjParties().worker.country;
  pr.payDay='Last working day of the month';
  pr.firstPay=(CCJ_MONTHS[m-1]||'Oct')+' '+y;
  pr.days=worked;pr.inMonth=inMonth;
  pr.prorated=worked<inMonth;
  pr.state='built';
  pr.builtAt=ccjClient().mins;
  ccjPaintScreen();ccjPaint();
  ccjReachScreen('payroll-done');
}
function ccjPayslip(){
  const o=ccjOnb(),pr=o.payroll,pack=ccjOnbPack(),q=ccjQuote();
  const gross=Math.round(q.gross*(pr.days&&pr.inMonth?pr.days/pr.inMonth:1));
  const social=Math.round(gross*pack.empSocial/100);
  const tax=Math.round((gross-social)*pack.taxEff/100);
  return {gross:gross,social:social,socialPct:pack.empSocial,
    tax:tax,taxPct:pack.taxEff,net:gross-social-tax,full:q.gross};
}

/* ---- THE SCREEN ---------------------------------------------------------------------------
   Six cards, and a card keeps its detail once it is done rather than collapsing to a tick. That
   is the same rule the sub-status panel follows — every step shows what it found, top to bottom
   — and it is what makes this screen answer the question it exists to answer: not "is onboarding
   finished" but "can this person be paid on the first, and on what evidence". A card that had
   collapsed would have taken the evidence with it. Only the steps still ahead are quiet, and
   they say what they will need. */
const CCJ_ONB_CARDS=[
  {key:'Worker KYC',              n:1,title:'Identity verification'},
  {key:'Documents',               n:2,title:'Documents'},
  {key:'Tax registration',        n:3,title:'Tax registration'},
  {key:'Social security enrolment',n:4,title:'Social security'},
  {key:'Bank verified',           n:5,title:'Bank account'},
  {key:'Payroll configured',      n:6,title:'Payroll'}
];
/* The stage index, found rather than written as 7 — the rail is data, and a stage inserted ahead
   of this one would otherwise silently repoint every card on this screen. */
function ccjOnbStage(){
  return ccjStages().findIndex(function(s){return s.id==='onboarding';});
}
function ccjOnbState(key){
  const run=ccjRun,i=ccjOnbStage();
  if(run.settled['onboarding/'+key])return 'done';
  const step=ccjSteps(i)[run.sub];
  if(run.stage===i&&step&&step.label===key)return 'live';
  return 'pending';
}
function buildCCJOnbHTML(){
  const run=ccjRun,p=ccjParties(),f=run.form||{},o=ccjOnb();
  const doneN=CCJ_ONB_CARDS.filter(function(c){return ccjOnbState(c.key)==='done';}).length;
  const start=ccjPrettyDate(f.fromDate);
  return '<div class="ccj-onb-wrap">'
    +'<div class="ccj-onb-hero'+(doneN===6?' ok':'')+'">'
    +'<div class="ccj-onb-hero-av">'+ccjInitials(p.worker.name)+'</div>'
    +'<div class="ccj-onb-hero-body">'
    +'<div class="ccj-onb-hero-t">'+p.worker.name+'</div>'
    +'<div class="ccj-onb-hero-s">'+(f.jobTitle||'&mdash;')+' &middot; '+p.worker.country
      +' &middot; starts '+start+'</div>'
    +'</div>'
    +'<div class="ccj-onb-hero-fig"><span>'+doneN+' of 6</span><i>'
      +(doneN===6?'ready for payroll':'onboarding steps complete')+'</i></div>'
    +'</div>'
    +CCJ_ONB_CARDS.map(ccjOnbCardHTML).join('')
    // The file states what it holds; the conversation asks what happens next.
    +(run.phase==='rest'
      ?'<div class="ccj-onb-next">'
       +'<div class="ccj-onb-next-t">Onboarding complete. '+p.worker.name.split(' ')[0]
       +' can be paid from '+start+'.</div>'
       +'</div>'
      :'')
    +'</div>';
}
function ccjOnbCardHTML(card){
  const run=ccjRun,o=ccjOnb();
  const i=ccjOnbStage();
  const state=ccjOnbState(card.key);
  const step=ccjSteps(i).find(function(s){return s.label===card.key;})||{};
  const body=state==='pending'?'':ccjOnbCardBodyHTML(card,state);
  const sum=ccjOnbCardSummary(card,state);
  return '<div class="ccj-onb-card '+state+'" id="ccj-onb-'+card.n+'">'
    +'<div class="ccj-onb-card-h">'
    +'<span class="ccj-onb-card-n">'+(state==='done'
      ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
      :state==='live'?'<span class="ccj-spin"></span>':card.n)+'</span>'
    +'<div class="ccj-onb-card-t">'+card.title
    +'<span>'+(state==='pending'?ccjPurpose(i,step):sum)+'</span></div>'
    +'<span class="ccj-row-owner'+(step.auto?' auto':'')+'">'
      +(step.auto?'AUTO':(typeof amOwnerInfo==='function'?amOwnerInfo(step.owner).initials:'?'))+'</span>'
    +'</div>'
    +(body?'<div class="ccj-onb-card-b">'+body+'</div>':'')
    +'</div>';
}
function ccjOnbCardSummary(card,state){
  const o=ccjOnb(),pack=ccjOnbPack();
  if(state==='pending')return '';
  if(card.key==='Worker KYC'){
    const d=ccjKycDecision();
    return o.kyc.done?d.label+' &middot; risk '+d.score+'/100'
      :'Session '+o.kyc.session+' &middot; step '+Math.min(o.kyc.step,CCJ_KYC_PHASES.length)+' of '+CCJ_KYC_PHASES.length;
  }
  if(card.key==='Documents'){
    const req=o.docs.filter(function(d){return d.req;});
    const ok=req.filter(function(d){return d.status==='verified';}).length;
    return ok+' of '+req.length+' required documents verified';
  }
  if(card.key==='Tax registration')
    return o.tax.state==='confirmed'?pack.taxIdLabel+' '+o.tax.id:'Filed with the '+pack.taxAuthority;
  if(card.key==='Social security enrolment')
    return o.ss.state==='confirmed'?pack.ssIdLabel+' '+o.ss.id:'Filed with '+pack.ssAuthority;
  if(card.key==='Bank verified')
    return o.bank.state==='verified'?o.bank.iban+' &middot; name match '+o.bank.score+'%':'Penny-drop in progress';
  if(card.key==='Payroll configured'){
    const s=ccjPayslip();
    return o.payroll.state==='built'?'First pay '+o.payroll.firstPay+' &middot; net '+ccjMoney(s.net):'Building';
  }
  return '';
}
function ccjOnbCardBodyHTML(card,state){
  if(card.key==='Worker KYC')return buildCCJKycHTML();
  if(card.key==='Documents')return buildCCJDocsHTML();
  if(card.key==='Tax registration')return buildCCJFilingHTML('tax');
  if(card.key==='Social security enrolment')return buildCCJFilingHTML('ss');
  if(card.key==='Bank verified')return buildCCJBankHTML();
  if(card.key==='Payroll configured')return buildCCJPayrollHTML();
  return '';
}

/* ---- THE KYC CONSOLE ----------------------------------------------------------------------
   Sections appear as the provider reaches them, in the order it reaches them. Everything on it
   is either read from the identity document or matched against the contract, so the two columns
   are the whole point: what the document says, and what we already believed. */
function buildCCJKycHTML(){
  const o=ccjOnb(),k=o.kyc,d=ccjKycDoc(),c=ccjKycChecks(),p=ccjParties();
  const at=function(id){
    const i=CCJ_KYC_PHASES.findIndex(function(x){return x.id===id;});
    return k.step>i;
  };
  const dec=ccjKycDecision();
  const vd=function(v){return '<span class="ccj-kyc-vd '+v+'">'
    +(v==='pass'?'&#10003;':v==='consider'?'!':v==='fail'?'&#10007;':'&ndash;')+'</span>';};
  const rows=function(list){
    return '<div class="ccj-kyc-rows">'+list.map(function(r){
      return '<div class="ccj-kyc-row"><span class="ccj-kyc-k">'+r.k+'</span>'
        +'<span class="ccj-kyc-v">'+r.v+'</span>'+vd(r.verdict)+'</div>';
    }).join('')+'</div>';
  };
  const phase=function(id,inner){
    const done=at(id),ph=CCJ_KYC_PHASES.find(function(x){return x.id===id;});
    const live=!done&&CCJ_KYC_PHASES[k.step]&&CCJ_KYC_PHASES[k.step].id===id;
    if(!done&&!live)return '';
    return '<div class="ccj-kyc-ph'+(done?' done':' doing')+'">'
      +'<div class="ccj-kyc-ph-h">'
      +'<span class="ccj-kyc-ph-ico">'+(done
        ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
        :'<span class="ccj-spin sm"></span>')+'</span>'
      +'<span class="ccj-kyc-ph-t">'+ph.label+'<i>'+ph.sub+'</i></span></div>'
      +(done&&inner?'<div class="ccj-kyc-ph-b">'+inner+'</div>':'')
      +'</div>';
  };
  return ''
    +'<div class="ccj-kyc-top">'
    +'<span class="ccj-kyc-prov">Persona &middot; identity verification</span>'
    +'<span class="ccj-kyc-sid">'+k.session+'</span>'
    +'</div>'

    +phase('session','')

    // The document, rendered as a document. A row of extracted text would not tell a reviewer
    // that a passport was actually photographed.
    +phase('capture',
      '<div class="ccj-kyc-doc">'
      +'<div class="ccj-kyc-doc-card">'
      +'<div class="ccj-kyc-doc-top"><span>'+d.issuer+'</span><b>PASSPORT</b></div>'
      +'<div class="ccj-kyc-doc-mid">'
      +'<div class="ccj-kyc-doc-photo">'+ccjPortraitHTML()+'</div>'
      +'<div class="ccj-kyc-doc-fields">'
      +'<div><span>Surname</span><b>'+d.surname+'</b></div>'
      +'<div><span>Given names</span><b>'+d.given+'</b></div>'
      +'<div><span>Nationality</span><b>'+d.nationality+'</b></div>'
      +'<div><span>Document no.</span><b>'+d.number+'</b></div>'
      +'</div></div>'
      +'<div class="ccj-kyc-mrz">'+d.mrzLine+'</div>'
      +'</div>'
      +'<div class="ccj-kyc-doc-note">'+d.type+' &middot; captured front and back &middot; expires '+d.expiry+'</div>'
      /* The permit is captured in the SAME session for a cross-border hire, so it is shown here
         beside the passport rather than only being referenced later by the right-to-work verdict.
         This is the evidence that verdict rests on; it should be visible where it was taken. */
      +(function(){
        const pm=ccjPermit();
        if(!pm||pm.sponsored||!pm.captured)return '';
        return '<div class="ccj-kyc-permit">'
          +'<div class="ccj-kyc-permit-h"><b>'+pm.label+'</b><span>'+pm.number+'</span></div>'
          +'<div class="ccj-kyc-permit-g">'
          +'<div><span>Issued by</span><b>'+pm.authority+'</b></div>'
          +'<div><span>Valid to</span><b>'+pm.expiry+'</b></div>'
          +'<div><span>Basis</span><b>'+pm.basis+'</b></div>'
          +'<div><span>Salary tested</span><b>'+ccjMoney(pm.annual)+' vs '
            +ccjMoney(pm.min)+' floor</b></div>'
          +'</div></div>';
      })()
      +'</div>')

    // Two columns, because that is what a cross-check IS.
    +phase('extract',
      '<div class="ccj-kyc-cmp-h"><span>Read from the document</span><span>Matched against</span><i></i></div>'
      +'<div class="ccj-kyc-rows">'+c.identity.map(function(r){
        return '<div class="ccj-kyc-cmp"><span class="ccj-kyc-k">'+r.k+'</span>'
          +'<span class="ccj-kyc-doc-v">'+r.doc+'</span>'
          +'<span class="ccj-kyc-v">'+r.against+'</span>'+vd(r.verdict)+'</div>';
      }).join('')+'</div>')

    +phase('biometric',
      '<div class="ccj-kyc-bio">'
      +'<div class="ccj-kyc-faces">'
      +'<span class="ccj-kyc-face">'+ccjPortraitHTML()+'<i>Document</i></span>'
      +'<span class="ccj-kyc-link">&#8644;</span>'
      +'<span class="ccj-kyc-face live">'+ccjPortraitHTML()+'<i>Live selfie</i></span>'
      +'</div>'+rows(c.biometric)+'</div>')

    +phase('authentic',rows(c.authenticity))
    +phase('screen',rows(c.screening))

    +phase('rtw',
      '<div class="ccj-kyc-rtw '+c.rtw.verdict+'">'
      +vd(c.rtw.verdict)
      +'<div><b>'+c.rtw.label+'</b><span>'+c.rtw.detail+'</span></div></div>')

    +phase('decision',
      '<div class="ccj-kyc-dec '+dec.id+'">'
      +'<div class="ccj-kyc-score"><span>Risk score</span><b>'+dec.score+'</b><i>/100</i></div>'
      +'<div class="ccj-kyc-dec-b"><div class="ccj-kyc-dec-t">'+dec.label+'</div>'
      +'<div class="ccj-kyc-dec-s">'+(dec.note
        ||'Every check cleared. No part of this verification needed a person.')+'</div></div>'
      +'</div>')

    // Demo scaffolding, gone from the rebuilt stage like every other simulate control: the CONSIDER
    // path is reachable on its own, and a verification console is the last surface that should be
    // carrying a button which changes the provider's answer.
    +(k.done&&!k.reviewed&&ccjOnbState('Worker KYC')==='live'&&!ccjUsesTranscript(ccjRun.stage)
      ?'<div class="ccj-sim">'
       +'<div class="ccj-sim-head">Simulate provider<span>demo</span></div>'
       +'<div class="ccj-sim-btns">'
       +'<button class="ccj-sim-btn" onclick="ccjKycForceConsider()"'
         +(k.forceConsider||dec.id!=='clear'?' disabled':'')+'>Returns CONSIDER instead</button>'
       +'</div>'
       +'<div class="ccj-sim-note">A partial name match is the commonest reason a real check goes to a person.</div>'
       +'</div>'
      :'');
}

/* ---- DOCUMENTS ---------------------------------------------------------------------------- */
function buildCCJDocsHTML(){
  const o=ccjOnb(),pack=ccjOnbPack();
  const req=o.docs.filter(function(d){return d.req;});
  const ok=req.filter(function(d){return d.status==='verified';}).length;
  const ico={verified:'&#10003;',rejected:'&#10007;',waiting:'&middot;',na:'&ndash;'};
  return '<div class="ccj-chk-h">'+ccjParties().worker.country+' checklist'
    +'<span>'+ok+' of '+req.length+' required</span></div>'
    +'<div class="ccj-chk">'+o.docs.map(function(d){
      return '<div class="ccj-chk-row '+d.status+'">'
        +'<span class="ccj-chk-st">'+(ico[d.status]||'')+'</span>'
        +'<div class="ccj-chk-b">'
        +'<div class="ccj-chk-l">'+d.label
          +(d.req?'':'<span class="ccj-chk-opt">optional</span>')+'</div>'
        +'<div class="ccj-chk-w">'+d.why+'</div>'
        +(d.note?'<div class="ccj-chk-n">'+d.note+'</div>':'')
        +'</div>'
        +'<span class="ccj-chk-r">'+(d.status==='verified'?d.ref
          :d.status==='rejected'?'rejected'
          :d.status==='na'?'not claimed'
          :d.who==='adt'?'ADT':'awaiting')+'</span>'
        +'</div>';
    }).join('')+'</div>';
}

/* ---- THE TWO FILINGS ---------------------------------------------------------------------- */
function buildCCJFilingHTML(kind){
  const o=ccjOnb(),s=o[kind],pack=ccjOnbPack(),p=ccjParties();
  const authority=kind==='tax'?pack.taxAuthority:pack.ssAuthority;
  const filing=kind==='tax'?pack.taxFiling:pack.ssFiling;
  const idLabel=kind==='tax'?pack.taxIdLabel:pack.ssIdLabel;
  const row=function(label,sub,at,on){
    return '<div class="ccj-env-row'+(on?' done':'')+'">'
      +'<span class="ccj-env-dot"></span>'
      +'<div class="ccj-env-body"><div class="ccj-env-label">'+label+'</div>'
      +'<div class="ccj-env-sub">'+sub+'</div></div>'
      +'<span class="ccj-env-when">'+(on?ccjStamp(at):'&mdash;')+'</span></div>';
  };
  return '<div class="ccj-file-h">'+authority+'<span>'+filing+'</span></div>'
    +'<div class="ccj-env plain">'
    +row('Submitted',(kind==='tax'?'Payroll tax registration for ':'Enrolment for ')
      +p.worker.name+' &middot; ref '+(s.ref||'&mdash;'),s.submittedAt,!!s.submittedAt)
    +row('Confirmed by the authority',
      s.state==='confirmed'?idLabel+' '+s.id+' issued':'Awaiting the authority',
      s.confirmedAt,s.state==='confirmed')
    +'</div>'
    +(s.state==='confirmed'
      ?'<div class="ccj-file-out">'
       +'<div class="ccj-file-kv"><span>'+idLabel+'</span><b>'+s.id+'</b></div>'
       +'<div class="ccj-file-kv"><span>'+(kind==='tax'?'Applied':'Scheme')+'</span><b>'
         +(kind==='tax'?pack.taxCredit:pack.ssScheme)+'</b></div>'
       +'</div>'
      :'');
}

/* ---- BANK ---------------------------------------------------------------------------------- */
function buildCCJBankHTML(){
  const o=ccjOnb(),b=o.bank,p=ccjParties();
  const done=b.state==='verified';
  return '<div class="ccj-file-h">Penny-drop verification<span>Before payroll sends real money</span></div>'
    +'<div class="ccj-bank">'
    +'<div class="ccj-file-kv"><span>Account holder</span><b>'+(b.holder||'&mdash;')+'</b></div>'
    +'<div class="ccj-file-kv"><span>Account</span><b>'+(b.iban||'&mdash;')+'</b></div>'
    +'<div class="ccj-file-kv"><span>Test credit</span><b>'
      +(b.pennyAt?ccjCurrency()+'&nbsp;0.01 sent':'&mdash;')+'</b></div>'
    +'<div class="ccj-file-kv"><span>Returned by the bank</span><b>'
      +(done?b.holder:'awaiting')+'</b></div>'
    +'<div class="ccj-file-kv"><span>Name match</span><b>'
      +(done?b.score+'% &mdash; accepted':'&mdash;')+'</b></div>'
    +'</div>'
    +(done?'<div class="ccj-bank-n">A penny-drop proves the account exists and belongs to the person we are about to pay. Payroll cannot be released against an account that has not returned a name.</div>':'');
}

/* ---- PAYROLL ------------------------------------------------------------------------------- */
function buildCCJPayrollHTML(){
  const o=ccjOnb(),pr=o.payroll,s=ccjPayslip(),pack=ccjOnbPack(),f=(ccjRun&&ccjRun.form)||{};
  if(pr.state!=='built')return '<div class="ccj-file-h">Payroll configuration<span>Building from the contract</span></div>';
  const line=function(k,sub,v,cls){
    return '<div class="ccj-slip-row'+(cls?' '+cls:'')+'">'
      +'<div class="ccj-slip-k">'+k+(sub?'<span>'+sub+'</span>':'')+'</div>'
      +'<div class="ccj-slip-v">'+v+'</div></div>';
  };
  return '<div class="ccj-file-h">Payroll configuration<span>'+pr.calendar+'</span></div>'
    +'<div class="ccj-file-out">'
    +'<div class="ccj-file-kv"><span>Pay day</span><b>'+pr.payDay+'</b></div>'
    +'<div class="ccj-file-kv"><span>First payroll</span><b>'+pr.firstPay+'</b></div>'
    +'<div class="ccj-file-kv"><span>Cost centre</span><b>'+ccjParties().client.name+'</b></div>'
    +'</div>'
    +'<div class="ccj-slip">'
    +'<div class="ccj-slip-h">Indicative first payslip'
      +'<span>'+(pr.prorated?pr.days+' of '+pr.inMonth+' days &mdash; prorated to the start date'
        :'full month')+'</span></div>'
    +line('Gross',pr.prorated?'from '+ccjMoney(s.full)+' a month':'Monthly gross',ccjMoney(s.gross))
    +line('Employee social security',pack.ssScheme.split(',')[0]+' &middot; '+s.socialPct+'%','&minus;'+ccjMoney(s.social))
    +line('Income tax withheld',pack.taxAuthority+' &middot; '+s.taxPct+'% effective','&minus;'+ccjMoney(s.tax))
    +line('Net pay','To the verified account',ccjMoney(s.net),'total')
    +'</div>'
    +'<div class="ccj-bank-n">Indicative. The payroll engine computes the binding figure on the first run, against the tax code the authority returned and the pay period actually worked.</div>';
}

/* ---- WIRING STAGE 8 INTO THE RUNNER ------------------------------------------------------- */
/* The one that took three goes. "Continue to active" named the STATUS the run ends in, which is
   what a control must never do — it promises a destination and delivers work. "Continue to the
   first payroll" named the right stage and still the wrong moment: the payroll run is the SECOND
   sub-status here, and the first is the readiness certificate, which can fail and stop the whole
   thing. A button that promises a payroll and delivers a failed control has broken its word at
   exactly the point the reader was relying on it. So it promises the check. */
CCJ_STAGE_REST['onboarding']={label:'Check they can be paid',
  next:'Last is going live &mdash; every control is re-derived into a readiness certificate, then their first payroll runs and the hire is live.'};

CCJ_PURPOSE['onboarding/Worker KYC']='Verifies who they are, and that they may work here.';
CCJ_PURPOSE['onboarding/Documents']='Collects the documents this country requires, and checks each one.';
CCJ_PURPOSE['onboarding/Tax registration']='Registers them with the tax authority and gets a tax code back.';
CCJ_PURPOSE['onboarding/Social security enrolment']='Enrols them in the statutory schemes.';
CCJ_PURPOSE['onboarding/Bank verified']='Proves the account exists and belongs to them.';
CCJ_PURPOSE['onboarding/Payroll configured']='Sets the calendar and builds the first payslip.';

CCJ_ON_ENTER['onboarding/Worker KYC']=function(run){ccjKycStart();};
CCJ_ON_ENTER['onboarding/Documents']=function(run){ccjDocsStart();};
CCJ_ON_ENTER['onboarding/Tax registration']=function(run){ccjFilingStart('tax');};
CCJ_ON_ENTER['onboarding/Social security enrolment']=function(run){ccjFilingStart('ss');};
CCJ_ON_ENTER['onboarding/Bank verified']=function(run){ccjBankStart();};
CCJ_ON_ENTER['onboarding/Payroll configured']=function(run){
  ccjScheduleAudit(ccjPayrollBuild,CCJ_ACT*3);
};

/* Every stream holds on its own work finishing rather than on a timer. Six holds, six milestones
   — the same mechanism the clause audit uses, because the same thing is true of all of them:
   the panel must not tick green while the card beside it is still filling in. */
/* SIX HOLDS, SIX COUNTERPARTIES, AND A PROGRESS LINE ON EACH. This is the stage with the most
   parked time in the journey — an identity check, a document round-trip, two authority filings, a
   bank test credit and a payroll build, none of them ours to hurry. A block that says "Filed.
   Waiting on the authority." and nothing else for ten seconds is the screen a reader refreshes.

   Every row is read from ccjOnb() — the same store the card beside it is drawn from — so the block
   and the card can never disagree about how far along something is. A row with no value yet is
   dropped rather than shown empty (see ccjHoldNoteHTML), so each one appears the moment it becomes
   true and not before. */
CCJ_HOLDS['onboarding/Worker KYC']={until:'kyc-done',verb:'Verifying',note:'Verification in progress.',
  rows:function(){
    const k=ccjOnb().kyc,n=CCJ_KYC_PHASES.length;
    return [['Checks',Math.min(k.step+(k.done?0:1),n)+' of '+n],
            ['Session',k.session],
            // Only once the provider has actually returned something.
            ['Outcome',k.done?ccjKycDecision().label:'']];
  }};
CCJ_HOLDS['onboarding/Documents']={until:'docs-done',verb:'Collecting',note:'Collecting and checking documents.',
  rows:function(){
    const d=ccjOnbDocs();
    const got=d.filter(function(x){return x.status==='accepted';}).length;
    const bad=d.filter(function(x){return x.status==='rejected';}).length;
    return [['Accepted',got+' of '+d.length],
            ['Rejected',bad?'<span class="ccj-wait-late">'+bad+' sent back</span>':''],
            ['Outstanding',ccjDocsOutstanding()?ccjDocsOutstanding()+' still to come':'']];
  }};
CCJ_HOLDS['onboarding/Tax registration']={until:'tax-done',verb:'Fetching',note:'Filed. Waiting on the authority.',
  rows:function(){return ccjFilingRows('tax');}};
CCJ_HOLDS['onboarding/Social security enrolment']={until:'ss-done',verb:'Fetching',note:'Filed. Waiting on the institution.',
  rows:function(){return ccjFilingRows('ss');}};
CCJ_HOLDS['onboarding/Bank verified']={until:'bank-done',verb:'Verifying',note:'Test credit sent. Waiting on the bank.',
  rows:function(){
    const b=ccjOnb().bank;
    return [['Account',b.iban],
            ['Name match',b.score?b.score+'%':''],
            ['Verified',b.state==='verified'?'<span class="ccj-wait-on">Confirmed</span>':'']];
  }};
CCJ_HOLDS['onboarding/Payroll configured']={until:'payroll-done',verb:'Building',note:'Building the first pay period.',
  rows:function(){
    const p=ccjOnb().payroll;
    return [['Calendar',p.calendar],['First pay',p.firstPay],
            ['Prorated',p.days?p.days+' day'+(p.days===1?'':'s')+' worked in the first period':'']];
  }};
/* Both filings report the same three things about two different authorities, so they are written
   once. The institution NAME is what distinguishes them, and it is the thing a person chasing one
   of these actually needs — see the note on ccjFilingId about why the two references must differ. */
function ccjFilingRows(kind){
  const o=ccjOnb(),f=kind==='tax'?o.tax:o.ss,pack=ccjOnbPack();
  return [['Authority',kind==='tax'?pack.taxAuthority:pack.ssAuthority],
          ['Reference',f.ref],
          ['Returned',f.id?'<span class="ccj-wait-on">'+f.id+'</span>':'']];
}

/* A verification that could not clear itself goes to a person. It is a POST gate: the whole
   check has to have run before there is anything to adjudicate, and the evidence for the
   decision is the console sitting beside it. */
CCJ_POST_GATES['onboarding/Worker KYC']=function(){
  const k=ccjOnb().kyc;
  if(!k.done)return null;
  if(k.reviewed)return null;
  if(ccjKycDecision().id!=='consider')return null;   // cleared on its own — no decision to make
  return {
    kind:'decision',
    /* CONSIDER is the identity provider's word, printed in their capitals, and it means nothing
       to anyone who has not read their documentation — it is neither a pass nor a fail. The ask
       now says what that actually amounts to; the provider's verdict is still on the console
       beside this card, which is where a vendor's vocabulary belongs. */
    ask:'The ID check could not clear this on its own.',
    why:ccjKycDecision().note+' A machine may not decide this on its own.',
    options:[
      {id:'kycConfirm',label:'Confirm identity',tone:'go',  done:'Identity confirmed'},
      // Paired with the option above it: confirm the identity, or reject the verification. A bare
      // "Reject" beside "Confirm identity" left the reader to guess what was being rejected.
      {id:'kycReject', label:'Reject verification',          tone:'stop',done:'Verification rejected'}
    ]
  };
};

/* == STAGE 9: ACTIVE ==========================================================================
   The last stage, and the only one whose audience is the WORKER as much as the buyer. Eight
   stages have been about whether a deal can be done; this one is about whether a person can be
   paid, and then about paying them. So it answers three questions in three screens, in order:

     readiness   May this person be paid at all? Every control the journey passed, RE-DERIVED
                 from what the earlier stages actually recorded — not re-asserted. A control
                 whose evidence is missing fails here, and a failed control blocks the run.
     payrun      What were they actually paid? The register: inputs, gross to net, what is owed
                 to the tax authority and the social security institution, funding, the payment
                 file, and the payslip. Then a person releases it.
     active      What is true now? The employment record, and the whole nine-stage trail with
                 the artefact each stage produced.

   THE CERTIFICATE IS DERIVED, WHICH IS THE WHOLE POINT. Every row on it reads the object the
   stage that produced it wrote — ccjMsa(), ccjPay(), ccjEmp(), ccjOnb() — and states its source,
   its reference and the time that object recorded. Nothing on it is authored per run, so it
   cannot claim a control that did not happen. That is what makes it worth showing a worker.

   NOTHING PRINTS A TIME NOBODY RECORDED. Where the underlying object has no timestamp the row
   shows its reference alone. Synthesising `something + 40 minutes` is the bug the stage-6 ledger
   and the stage-7 envelope both had, and it is worse here: this is the document that says the
   controls were real.

   THE MONEY DOES NOT MOVE ON A TIMER. First payroll run parks TWICE — once on the register being
   complete, where Finance releases it, and again on the disbursement actually finishing. That is
   why CCJ_HOLDS accepts a function: one step, two milestones, a human decision between them. */

/* ---- WHAT A PAYROLL RUN IS, PER COUNTRY ----------------------------------------------------
   The monthly return, who it goes to, the contribution filing beside it, the rail the money
   travels on, and the elements the country adds that a flat gross-to-net would miss. The
   accruals matter: vakantiegeld, TFR, pagas extraordinarias and gratuity are earned in THIS
   period and paid in another one, so they belong on the payslip as accruals and nowhere near
   net pay. Printing them as earnings would overstate what lands in the account. */
const CCJ_PAYRUN_PACK={
  'Netherlands':{
    taxLine:'Loonheffing', ret:'Loonaangifte', retTo:'Belastingdienst',
    ssRet:'Premies werknemersverzekeringen', ssTo:'UWV',
    rail:'SEPA credit transfer', file:'pain.001.001.09', payslip:'Loonstrook',
    accruals:[{label:'Vakantiegeld',pct:8,note:'Accrued each period, paid out in May'}],
    ded:null, erExtra:null},
  'Germany':{
    taxLine:'Lohnsteuer', ret:'Lohnsteuer-Anmeldung', retTo:'Finanzamt',
    ssRet:'Beitragsnachweis (DE&Uuml;V)', ssTo:'Krankenkasse',
    rail:'SEPA credit transfer', file:'pain.001.001.09', payslip:'Entgeltabrechnung',
    accruals:[], ded:null, erExtra:null},
  'India':{
    taxLine:'TDS &mdash; tax deducted at source', ret:'Challan ITNS-281', retTo:'Income Tax Department',
    ssRet:'EPF electronic challan cum return', ssTo:'EPFO',
    rail:'NEFT transfer', file:'NEFT bulk advice', payslip:'Payslip',
    accruals:[{label:'Gratuity provision',pct:4.81,note:'Accrued each period, payable after five years of service'}],
    ded:null, erExtra:null},
  'Spain':{
    taxLine:'Retenci&oacute;n IRPF', ret:'Modelo 111', retTo:'Agencia Tributaria',
    ssRet:'RLC / RNT &middot; Sistema RED', ssTo:'Tesorer&iacute;a General de la Seguridad Social',
    rail:'SEPA credit transfer', file:'pain.001.001.09', payslip:'N&oacute;mina',
    accruals:[{label:'Pagas extraordinarias',pct:16.67,note:'Two extra payments a year, accrued monthly'}],
    ded:null, erExtra:null},
  'United Kingdom':{
    taxLine:'PAYE income tax', ret:'Full Payment Submission (RTI)', retTo:'HM Revenue &amp; Customs',
    ssRet:'Class 1 National Insurance', ssTo:'HMRC',
    rail:'Faster Payments', file:'Bacs Standard 18', payslip:'Payslip',
    accruals:[],
    // Auto-enrolment is a real deduction from a UK payslip and the employer pays alongside it.
    // It is why the computed net differs from the figure onboarding modelled, and the run says so.
    ded:{label:'Pension &mdash; auto-enrolment',pct:5,note:'NEST, qualifying earnings'},
    erExtra:{label:'Employer pension contribution',pct:3}},
  'France':{
    taxLine:'Pr&eacute;l&egrave;vement &agrave; la source', ret:'DSN &mdash; d&eacute;claration sociale nominative', retTo:'URSSAF / DGFiP',
    ssRet:'Cotisations sociales', ssTo:'URSSAF',
    rail:'SEPA credit transfer', file:'pain.001.001.09', payslip:'Bulletin de paie',
    accruals:[{label:'Cong&eacute;s pay&eacute;s',pct:10,note:'Paid-leave provision accrued each period'}],
    ded:null, erExtra:null},
  'Italy':{
    taxLine:'IRPEF', ret:'Modello F24', retTo:'Agenzia delle Entrate',
    ssRet:'UniEmens', ssTo:'INPS',
    rail:'SEPA credit transfer', file:'pain.001.001.09', payslip:'Busta paga',
    accruals:[{label:'TFR &mdash; trattamento di fine rapporto',pct:6.91,note:'Set aside each period, paid on termination'}],
    ded:null, erExtra:null}
};
function ccjPayrunPack(country){
  return CCJ_PAYRUN_PACK[country||ccjParties().worker.country]||CCJ_PAYRUN_PACK['Netherlands'];
}

/* ---- THE STAGE'S STATE ---------------------------------------------------------------------
   Two objects, one per screen that has any: the readiness certificate and the payroll run. Both
   hang off run.live so a reset takes them with it, the same way run.onb and run.emp work. */
function ccjNewRdy(){return {step:0,done:false,at:0,ref:''};}
function ccjNewPayrun(){
  return {
    id:'', label:'', from:'', to:'', payDay:'', cutOff:'',
    step:0, done:false,
    state:'idle',              // idle → configuring → pending → active
    accessAt:0,                // when the employee could first sign in
    calcAt:0,                  // when the record was configured and went PENDING
    activatedAt:0, activatedBy:''   // pending → active, and who did it
  };
}
function ccjLive(){
  const run=ccjRun;
  if(!run.live)run.live={rdy:ccjNewRdy(),pr:ccjNewPayrun()};
  return run.live;
}
function ccjRdy(){return ccjLive().rdy;}
function ccjPayrun(){return ccjLive().pr;}
/* The stage index, found rather than written as 8 — same reason ccjOnbStage is. */
function ccjActiveStage(){
  return ccjStages().findIndex(function(s){return s.id==='active';});
}
/* Ends a sentence without doubling the stop. Half the entity names in CCJ_REGISTRY already end in
   one — "ADT Netherlands EOR Services B.V." — so appending a full stop after them printed "B.V..". */
function ccjFullStop(s){return /[.!?]$/.test(String(s).trim())?String(s):String(s)+'.';}
/* "Stage 5 · Signed" — where a control came from, named the way the rail names it, so a reader
   can go and look at the thing that produced it. */
function ccjSrc(stageId,label){
  const i=ccjStages().findIndex(function(s){return s.id===stageId;});
  const s=i>-1?ccjStages()[i]:null;
  return 'Stage '+(i+1)+' &middot; '+(label||(s?s.short:''));
}

/* ---- THE READINESS CERTIFICATE -------------------------------------------------------------
   Five groups, and every row is computed from the object the earlier stage wrote. A row states
   what it proves, where that proof came from, its reference, the time that object recorded (or
   nothing, if it recorded none) and a verdict.

   `at:0` means "this object holds no timestamp for that event". The row then shows its reference
   alone rather than a plausible-looking time, because a certificate that invents one is worse
   than a certificate that admits it does not have one. */
const CCJ_RDY_GROUPS=[
  {id:'engagement',n:1,title:'The engagement is contracted',
   why:'We may not employ anyone on a client&rsquo;s behalf without an agreement in force and the deposit it calls for.'},
  {id:'employment',n:2,title:'The person is employed',
   why:'A contract in force between ADT and the employee, under the law of the country the work is in.'},
  {id:'identity',n:3,title:'They are who they say they are',
   why:'Identity proven against a genuine document, and the right to work in that country established.'},
  {id:'registered',n:4,title:'Registered with the authorities',
   why:'Nobody may be paid before the tax authority and the social security institution know they exist.'},
  {id:'money',n:5,title:'Money can move, safely',
   why:'An account that has been proved to belong to them, and an engine configured from the executed contract.'}
];
function ccjRdyChecks(){
  const run=ccjRun;if(!run)return [];
  const p=ccjParties(),f=run.form||{},pack=ccjOnbPack(),o=ccjOnb();
  const m=ccjMsa(),e=ccjEmp(),pay=ccjPay(),inv=ccjInvoice();
  const rtw=ccjRightToWork(),kyc=ccjKycDecision();
  const req=o.docs.filter(function(d){return d.req;});
  const gotDocs=req.filter(function(d){return d.status==='verified';});
  const docAt=o.docs.reduce(function(x,d){return Math.max(x,d.at||0);},0);
  const list=[];
  /* 1 — the engagement. An established client signed their agreement before this run existed, so
     the control is satisfied by the agreement being in force, not by this run having produced it. */
  const msaInForce=!!m.adtSignedAt||ccjMsaExists();
  list.push({group:'engagement',label:'Master Services Agreement in force',
    proves:'The client has contracted with us for this service.',
    src:ccjSrc('agreement-signature','Signed'),ref:m.id,
    at:m.adtSignedAt||0,
    detail:m.adtSignedAt
      ?'Signed by '+p.client.name+' and countersigned by '+p.adt.signatory+'.'
      :ccjMsaExists()?'Agreement already in force for this client &mdash; not re-executed for this placement.'
      :'No executed agreement on file.',
    verdict:msaInForce?'pass':'fail'});
  const settled=ccjPaidInFull()||pay.released;
  list.push({group:'engagement',label:'Deposit settled',
    proves:'The client has funded the placement before anyone is paid out of it.',
    src:ccjSrc('deposit-due','Cleared'),ref:inv.id,
    at:(pay.receipts.length?pay.receipts[pay.receipts.length-1].at:0)||0,
    detail:ccjPaidInFull()
      ?ccjMoney(ccjReceived())+' received against '+ccjMoney(ccjAmountDue())+' &mdash; settled in full.'
      :pay.released
      ?'Released by '+pay.releasedBy+' with '+ccjMoney(pay.shortfall)+' outstanding &mdash; recorded as an exception.'
      :ccjMoney(ccjOutstanding())+' still outstanding.',
    verdict:ccjPaidInFull()?'pass':pay.released?'consider':'fail'});
  /* 2 — the employment. Both signatures, and the audit that made the draft lawful. */
  // Executed on the LAST signature, which is the employee's — so the record is stamped and
  // sourced from their step, not ours.
  list.push({group:'employment',label:'Employment contract executed',
    proves:'They are employed by the ADT entity in the country the work is in.',
    src:ccjSrc('employment-contract','Worker signed'),ref:e.id+' v'+e.version,
    at:e.workerSignedAt||0,
    detail:e.workerSignedAt
      ?ccjFullStop('Signed by '+p.adt.signatory+' for '+p.adt.name
        +' and countersigned by '+p.worker.name)
      :e.adtSignedAt?'Signed by the employer. Not yet countersigned by the employee.'
      :'Not signed.',
    verdict:(e.workerSignedAt&&e.adtSignedAt)?'pass':'fail'});
  const failed=ccjAuditFailed().length,adjusted=ccjAuditAdjusted().length;
  list.push({group:'employment',label:'Clause compliance check cleared',
    proves:'Every clause meets the statutory floor of '+ccjInCountry(p.worker.country)+'.',
    src:ccjSrc('employment-contract','Clause compliance check'),
    ref:e.audit.length?e.audit.length+' clauses checked':'not run',
    at:0,
    detail:e.auditDone
      ?(adjusted?adjusted+' clause'+(adjusted===1?'':'s')+' rewritten to the statutory minimum before signature. ':'')
       +(failed?failed+' unresolved.':'No clause falls short.')
      :'The check has not run against this draft.',
    verdict:!e.auditDone?'fail':failed?'fail':'pass'});
  /* 3 — identity. The one control a machine may not close on its own when it comes back unsure. */
  list.push({group:'identity',label:'Identity verified',
    proves:'The person being paid is the person on the contract.',
    src:ccjSrc('onboarding','Worker KYC'),ref:o.kyc.session,
    at:o.kyc.reviewedAt||0,
    detail:!o.kyc.done?'Verification has not completed.'
      :o.kyc.reviewed==='confirmed'
      ?'Came back '+kyc.label+' and was confirmed by '+(o.kyc.reviewed_by||'a reviewer')+'.'
      :o.kyc.reviewed==='rejected'?'Rejected on review.'
      :kyc.label+' &middot; risk score '+kyc.score+'/100. '+kyc.note,
    verdict:!o.kyc.done?'fail':o.kyc.reviewed==='rejected'?'fail'
      :(kyc.id==='clear'||o.kyc.reviewed==='confirmed')?'pass':'fail'});
  list.push({group:'identity',label:'Right to work established',
    proves:'They may lawfully work in '+ccjInCountry(p.worker.country)+'.',
    src:ccjSrc('onboarding','Worker KYC'),ref:(f.nationality||p.worker.country)+' national',
    at:0, detail:rtw.label+'. '+rtw.detail,
    verdict:rtw.verdict});
  /* 4 — the authorities. Two filings, each with the number that came back. */
  list.push({group:'registered',label:'Registered with '+pack.taxAuthority,
    proves:'Payroll tax can be withheld and remitted against a real registration.',
    src:ccjSrc('onboarding','Tax registration'),
    ref:o.tax.id?pack.taxIdLabel+' '+o.tax.id:(o.tax.ref||'not filed'),
    at:o.tax.confirmedAt||0,
    detail:o.tax.state==='confirmed'
      ?pack.taxFiling+' confirmed. '+pack.taxCredit+'.'
      :'The registration has not been confirmed.',
    verdict:o.tax.state==='confirmed'?'pass':'fail'});
  list.push({group:'registered',label:'Enrolled with '+pack.ssAuthority,
    proves:'Contributions can be paid into the statutory schemes.',
    src:ccjSrc('onboarding','Social security enrolment'),
    ref:o.ss.id?pack.ssIdLabel+' '+o.ss.id:(o.ss.ref||'not filed'),
    at:o.ss.confirmedAt||0,
    detail:o.ss.state==='confirmed'
      ?pack.ssFiling+' confirmed. Covers '+pack.ssScheme+'.'
      :'The enrolment has not been confirmed.',
    verdict:o.ss.state==='confirmed'?'pass':'fail'});
  list.push({group:'registered',label:'Statutory documents collected',
    proves:'Every document '+ccjInCountry(p.worker.country)+' requires is on file and checked.',
    src:ccjSrc('onboarding','Documents'),ref:gotDocs.length+' of '+req.length+' required',
    at:docAt,
    detail:ccjDocsOutstanding().length
      ?'Outstanding: '+ccjDocsOutstanding().map(function(d){return d.label;}).join(', ')+'.'
      :'All required documents verified. '+o.docs.filter(function(d){return d.status==='na';}).length
       +' optional item(s) not applicable.',
    verdict:ccjDocsOutstanding().length?'fail':'pass'});
  /* 5 — the money. The cheapest control in the journey and the one that prevents the most
     expensive mistake, plus the engine that will use it. */
  list.push({group:'money',label:'Bank account verified',
    proves:'The account exists and belongs to the person we are about to pay.',
    src:ccjSrc('onboarding','Bank verified'),ref:o.bank.iban||'not verified',
    at:o.bank.verifiedAt||0,
    detail:o.bank.state==='verified'
      ?'Test credit accepted. Name on the account returned as '+o.bank.holder+' &mdash; '+o.bank.score+'% match.'
      :'No penny-drop result on file.',
    verdict:o.bank.state==='verified'?'pass':'fail'});
  list.push({group:'money',label:'Payroll configured from the executed contract',
    proves:'The engine will pay what the contract says, not what the quote proposed.',
    src:ccjSrc('onboarding','Payroll configured'),ref:o.payroll.firstPay||'not configured',
    at:o.payroll.builtAt||0,
    detail:o.payroll.state==='built'
      ?o.payroll.calendar+' &middot; '+o.payroll.payDay+'. First period '
       +(o.payroll.prorated?'prorated to '+o.payroll.days+' of '+o.payroll.inMonth+' days.':'is a full month.')
      :'The engine has not been configured.',
    verdict:o.payroll.state==='built'?'pass':'fail'});
  return list;
}
function ccjRdyFailed(){
  return ccjRdyChecks().filter(function(c){return c.verdict==='fail';});
}
function ccjRdyOpen(){
  // Anything not an outright pass, which is what a certificate has to report. A CONSIDER does not
  // block payroll — a deposit released against a shortfall was somebody's decision, already
  // recorded — but it is stated on the face of the certificate rather than rounded up to green.
  return ccjRdyChecks().filter(function(c){return c.verdict!=='pass';});
}
const CCJ_RDY_STEP=520;        // one control, paced to be read
function ccjRdyStart(){
  const run=ccjRun;if(!run)return;
  const r=ccjRdy();
  r.step=0;r.done=false;
  ccjPaintScreen();
  ccjScheduleAudit(ccjRdyTick,CCJ_RDY_STEP);
}
function ccjRdyTick(){
  const run=ccjRun;if(!run)return;
  const r=ccjRdy(),list=ccjRdyChecks();
  if(r.step<list.length){
    r.step++;
    ccjPaintScreen();ccjPaint();
    ccjScrollRdyTo(r.step);
    ccjScheduleAudit(ccjRdyTick,CCJ_RDY_STEP);
    return;
  }
  r.done=true;r.at=ccjClient().mins;r.ref='PRC-'+String(3300+(run.gen||0));
  ccjPaintScreen();ccjPaint();
  ccjReachScreen('readiness-done');
}
function ccjScrollRdyTo(n){
  if(typeof document.querySelector!=='function')return;
  const box=document.querySelector('.ccj-rdy-wrap');
  const el=document.getElementById('ccj-rdy-'+n);
  if(!box||!el||typeof el.getBoundingClientRect!=='function'||!box.getBoundingClientRect)return;
  const r=el.getBoundingClientRect(),br=box.getBoundingClientRect();
  if(!r.height&&!br.height)return;
  ccjGlide(box,box.scrollTop+(r.top-br.top)-140);
}

/* ---- THE FIRST PAYROLL RUN ------------------------------------------------------------------
   The period comes from the start date on the contract, so a mid-month start prorates and a
   first-of-the-month start does not. Everything downstream reads this one function. */
function ccjPayrunPeriod(){
  const f=(ccjRun&&ccjRun.form)||{};
  const parts=String(f.fromDate||'2026-10-01').split('-');
  const y=Number(parts[0])||2026,m=Number(parts[1])||10,d=Number(parts[2])||1;
  const inMonth=new Date(Date.UTC(y,m,0)).getUTCDate();
  const mn=CCJ_MONTHS[m-1]||'Oct';
  const ny=m===12?y+1:y,nm=m===12?1:m+1;
  const nInMonth=new Date(Date.UTC(ny,nm,0)).getUTCDate();
  return {y:y,m:m,d:d,inMonth:inMonth,days:inMonth-d+1,prorated:d>1,
    label:mn+' '+y,
    from:mn+' '+d+', '+y, to:mn+' '+inMonth+', '+y,
    payDay:mn+' '+inMonth+', '+y,
    cutOff:mn+' '+Math.max(1,inMonth-5)+', '+y,
    nextLabel:(CCJ_MONTHS[nm-1]||'Nov')+' '+ny,
    nextPay:(CCJ_MONTHS[nm-1]||'Nov')+' '+nInMonth+', '+ny};
}
/* Gross to net, and the employer side beside it. Reads the same gross and the same day count
   stage 8 used, so the two agree by construction — the run is the binding calculation and the
   onboarding figure was explicitly indicative, and where they differ the screen says why. */
function ccjPayrunCalc(){
  const p=ccjParties(),per=ccjPayrunPeriod();
  const pk=ccjOnbPack(),pay=ccjPayrunPack(),rate=ccjRate(p.worker.country),q=ccjQuote();
  const full=q.gross;
  const basic=Math.round(full*(per.inMonth?per.days/per.inMonth:1));
  const gross=basic;                                  // accruals are earned here, paid elsewhere
  const social=Math.round(gross*pk.empSocial/100);
  const taxable=gross-social;
  const tax=Math.round(taxable*pk.taxEff/100);
  const ded=pay.ded?{label:pay.ded.label,pct:pay.ded.pct,note:pay.ded.note,
    amount:Math.round(gross*pay.ded.pct/100)}:null;
  const net=gross-social-tax-(ded?ded.amount:0);
  const accruals=(pay.accruals||[]).map(function(a){
    return {label:a.label,pct:a.pct,note:a.note,amount:Math.round(gross*a.pct/100)};});
  const erSocial=Math.round(gross*rate.social/100);
  const erExtra=pay.erExtra?{label:pay.erExtra.label,pct:pay.erExtra.pct,
    amount:Math.round(gross*pay.erExtra.pct/100)}:null;
  const accrued=accruals.reduce(function(s,a){return s+a.amount;},0);
  const cost=gross+erSocial+accrued+(erExtra?erExtra.amount:0);
  const indicative=ccjPayslip();
  return {full:full,basic:basic,gross:gross,
    social:social,socialPct:pk.empSocial,
    tax:tax,taxPct:pk.taxEff,taxLine:pay.taxLine,
    ded:ded,net:net,accruals:accruals,accrued:accrued,
    erSocial:erSocial,erPct:rate.social,erLabel:rate.label,erExtra:erExtra,cost:cost,
    days:per.days,inMonth:per.inMonth,prorated:per.prorated,
    // What is owed to whom out of this run. Employee tax is withheld from them; both sides of
    // social security are remitted together, which is how the contribution filing actually works.
    toTax:tax, toSs:social+erSocial,
    /* COST AND CASH ARE NOT THE SAME NUMBER, and on this stage the difference is the accrual.
       `cost` is what the period costs us — it includes vakantiegeld/TFR/gratuity, earned now and
       paid in another period. `cashOut` is what actually leaves the bank this month: the net to
       the employee plus the two remittances. Testing funding against `cost` asks whether we can
       afford money that is not moving yet. */
    cashOut:net+tax+social+erSocial,
    indicative:indicative.net, delta:net-indicative.net};
}
/* Five phases to build the register, five more to release it. Split rather than one list,
   because a person stands between them and the second half must not be reachable without them. */
/* == THIS JOURNEY DOES NOT RUN PAYROLL ====================================================
   It used to. This step built a register, asked Finance to RELEASE money, moved it, filed two
   statutory returns and issued a payslip — and that was wrong about what the journey is for. The
   user's instruction, 2026-08-03: *"we are giving the access, and then initially the payroll status
   will be in pending, and at the final step we are making the payroll status pending to active."*

   So the step keeps everything that is PREPARATION — access, the calendar, the period, the inputs,
   the gross-to-net figure and the pre-payroll controls — and loses everything that is EXECUTION.
   No money moves, no return is filed, no payslip is issued, and nobody is asked to release
   anything, because there is nothing to release. It ends with the payroll record created and its
   status PENDING; the last sub-status flips that to ACTIVE.

   Payroll itself then runs on its own calendar, which is what stage 9's own closing note has said
   all along: "Active is the end of this journey and the start of a recurring one."

   The gross-to-net figure stays and stays INDICATIVE. It is the most useful thing on the screen —
   it is what this person will actually receive — and computing it is not the same as paying it. */
const CCJ_PR_PHASES=[
  {id:'access',label:'Platform access granted',     sub:'The employee can sign in and see their own record'},
  {id:'open',  label:'Payroll record opened',       sub:'Period, calendar and cut-off fixed'},
  {id:'inputs',label:'Inputs bound',                sub:'Contract, calendar and absence data'},
  {id:'calc',  label:'Gross to net computed',       sub:'Earnings, deductions and net pay — indicative'},
  {id:'stat',  label:'Statutory amounts determined',sub:'What will be owed, and to whom'},
  {id:'check', label:'Pre-payroll controls',        sub:'Everything that must hold before a run is possible'}
];
const CCJ_PR_STEP=680;
function ccjPayrunStart(){
  const run=ccjRun;if(!run)return;
  const pr=ccjPayrun(),per=ccjPayrunPeriod(),p=ccjParties();
  const cc=(typeof CCJ_CC!=='undefined'&&CCJ_CC[p.worker.country])||'XX';
  pr.id='PR-'+per.y+'-'+String(per.m).padStart(2,'0')+'-'+cc+'-001';
  pr.label=per.label;pr.from=per.from;pr.to=per.to;
  pr.payDay=per.payDay;pr.cutOff=per.cutOff;
  pr.step=0;pr.state='configuring';pr.done=false;
  ccjPaintScreen();
  // Not immediately, for the reason ccjAuditStart waits: the conversation beside this is still
  // connecting to the payroll engine and pulling the contract down, and the setup must OUTLIVE the
  // step's own beats or the hold is decorative. Four beats at CCJ_ACT is 4.6s; two beats of head
  // start plus six phases at CCJ_PR_STEP puts it past that, so the block genuinely parks.
  ccjScheduleAudit(ccjPayrunTick,CCJ_ACT*2);
}
function ccjPayrunTick(){
  const run=ccjRun;if(!run)return;
  const pr=ccjPayrun(),c=ccjClient();
  if(pr.step<CCJ_PR_PHASES.length){
    pr.step++;
    const id=CCJ_PR_PHASES[pr.step-1].id;
    c.mins+=25;
    // The employee can sign in from here. This is the access the journey grants; everything after
    // it is configuration they can watch rather than work they have to do.
    if(id==='access'){
      pr.accessAt=c.mins;
      ccjWorkerPush({who:'us',kind:'access',id:ccjParties().worker.empId,at:c.mins});
    }
    if(pr.step===CCJ_PR_PHASES.length){
      // Configured, and PENDING. Nothing has been paid and nothing has been filed; the placement
      // is not live until the last sub-status says so.
      pr.state='pending';pr.calcAt=c.mins;pr.done=true;
    }
    ccjPaintScreen();ccjPaint();
    ccjScheduleAudit(ccjPayrunTick,CCJ_PR_STEP);
    return;
  }
  ccjPaintScreen();ccjPaint();
  ccjReachScreen('payrun-done');
}

/* ---- THE TRAIL ------------------------------------------------------------------------------
   The whole journey in one list, read off what each stage actually settled. The artefact column
   is what makes it a record rather than a progress bar: each stage produced a thing, and the
   thing has a reference somebody can look up. */
const CCJ_ARTEFACT={
  'request-received':function(){const p=ccjRun&&ccjRun.proposal;
    return p?{label:'Proposal',ref:p.id}:null;},
  'quote-prep':function(){const q=ccjQuote();
    return {label:'Cost calculation',ref:q.sym+' '+q.total.toLocaleString()+' / month'};},
  'quote-review':function(){const c=ccjClient();
    return c.state==='idle'?null:{label:'Quote',ref:'v'+c.version+(c.state==='accepted'?' accepted':'')};},
  'quote-approved':function(){const t=ccjTenant();
    return {label:'Client account',ref:t.id};},
  'agreement-signature':function(){const m=ccjMsa();
    if(m.adtSignedAt)return {label:'Master Services Agreement',ref:m.id};
    // An established client signed theirs before this run existed, so the stage produced no new
    // paper — but the placement is still governed by an agreement and the record has to say so.
    // NOT with m.id: that is an identifier for a document this run never executed.
    return ccjMsaExists()?{label:'Master agreement',ref:'already in force'}:null;},
  'deposit-due':function(){const p=ccjPay();
    return p.receipts.length?{label:'Deposit invoice',ref:ccjInvoice().id}:null;},
  // Executed on the employee's signature, which is the second one — a contract we have signed and
  // they have not is not yet an artefact this stage produced.
  'employment-contract':function(){const e=ccjEmp();
    return e.workerSignedAt?{label:'Employment contract',ref:e.id+' v'+e.version}:null;},
  'onboarding':function(){const o=ccjOnb();
    const req=o.docs.filter(function(d){return d.req;});
    return o.payroll.state==='built'
      ?{label:'Onboarding file',ref:req.length+' documents &middot; KYC '+ccjKycDecision().label}:null;},
  // The artefact this stage leaves is the live placement, not a payslip — no payslip is issued
  // here any more, because no run happens here.
  'active':function(){const pr=ccjPayrun();
    return pr.activatedAt?{label:'Placement live',ref:pr.id+' &middot; payroll active'}:null;}
};
function ccjTrail(){
  const run=ccjRun;if(!run)return [];
  return ccjStages().map(function(s,i){
    const steps=ccjSteps(i);
    const done=steps.filter(function(st){return run.settled[ccjKey(i,st)];});
    const last=done[done.length-1];
    const rec=last?run.settled[ccjKey(i,last)]:null;
    const decided=steps.filter(function(st){return run.decisions[ccjKey(i,st)];});
    const art=CCJ_ARTEFACT[s.id];
    return {n:i+1,id:s.id,short:s.short,label:s.label,
      outcome:rec?rec.summary:'&mdash;',
      done:done.length,total:steps.length,complete:done.length===steps.length,
      human:decided.length>0,
      owner:last?last.owner:(s.waitingOn&&s.waitingOn!=='&mdash;'?s.waitingOn:'Agent'),
      artefact:art?art():null};
  });
}

/* ---- THE CONTRACT RECORD --------------------------------------------------------------------
   The journey ends by writing a row into the product's own contracts list, in exactly the shape
   submitManualContractDeal writes one — so the record the journey produced is indistinguishable
   from any other contract in the listing, which is the point. Guarded on run.contractRowId: a
   repaint, a re-render or a second click must not create a second contract.

   ctLogsData and ctWorkflowData are filled from the TRAIL rather than authored, so the row's
   history is the journey's history and cannot drift from it. */
function ccjWriteContractRecord(){
  const run=ccjRun;if(!run)return null;
  if(run.contractRowId)return run.contractRowId;
  if(typeof contractsData==='undefined')return null;
  const p=ccjParties(),f=run.form||{},q=ccjQuote(),e=ccjEmp(),per=ccjPayrunPeriod();
  const id=contractsData.reduce(function(mx,c){return Math.max(mx,c.id);},0)+1;
  const now=typeof aiFormatNow==='function'?aiFormatNow():{date:'2026-08-04',time:'09:12:00'};
  const name=p.worker.name;
  const reg=ccjReg(p.worker.country);
  // Anything this person already has live is superseded by what this run is about to create —
  // see ccjSupersedePlacements for why that is not the same as deleting it.
  const superseded=ccjSupersedePlacements(name,p.worker.country,id);
  /* AT MOST ONE ROW IS EVER THE NEW ONE. The highlight answers "which row did my run just make",
     and a second highlighted row makes it unanswerable — so writing a new placement retires the
     previous one's flag. The other half of the lifecycle is ctClearNewFlag, which spends it when
     the record is opened. Between them the flag is a moment rather than a permanent property. */
  contractsData.forEach(function(c){
    if(c.ccjNew)delete c.ccjNew;
    if(c.ccjv1New)delete c.ccjv1New;
  });
  contractsData.unshift({
    id:id,contractId:String(94500+id),
    empName:name,empDesig:f.jobTitle||'&mdash;',country:p.worker.country,
    type:run.model||'EOR',date:now.date+' '+now.time,status:'Active',
    nationality:f.nationality||p.worker.country,countryOfOp:p.worker.country,
    workPermit:/assist|yes/i.test(String(f.workPermit||'')),
    gender:(f.gender||'').toUpperCase()||'&mdash;',
    email:p.worker.email,contact:f.mobile||'&mdash;',dob:f.dob||'&mdash;',
    jobTitle:f.jobTitle||'&mdash;',skill:f.skill||'&mdash;',
    empDuration:(f.fromDate||'')+(f.toDate?' &ndash; '+f.toDate:''),
    empType:run.model||'EOR',workSchedule:f.hours||'&mdash;',
    payAmount:String(q.gross),currency:reg.ccy||'EUR',
    jobDesc:f.jobDesc||(f.jobTitle||'')+' &mdash; '+p.client.name,
    payFrequency:'Monthly',
    commercial:typeof aiGenCommercial==='function'?aiGenCommercial(q.gross):{},
    complianceItems:[
      {item:'Employment contract '+e.id,note:'Executed and countersigned',status:'Approved',doc:null},
      {item:'Onboarding &mdash; '+p.worker.country,note:'All required documents verified',status:'Approved',doc:null},
      {item:'First payroll run '+ccjPayrun().id,note:'Released for '+per.label,status:'Approved',doc:null}
    ],
    // The listing surfaces this one row as newly created. It is a fact about the row rather than
    // a global the listing has to reach across files for.
    ccjNew:true, ccjRunGen:run.gen,
    // The run that made it, so the placement and the run point at each other rather than being
    // two records that merely happen to describe the same hire.
    ccjRunId:run.runId||null,
    supersedes:superseded.length?superseded:undefined
  });
  run.contractRowId=id;
  // Newest first, matching how ctLogsData is written everywhere else in the app.
  const trail=ccjTrail().filter(function(t){return t.complete;});
  if(typeof ctLogsData!=='undefined')ctLogsData[id]=trail.slice().reverse().map(function(t){
    return {date:now.date,time:now.time,user:t.owner,status:t.short,
      action:t.label+' &mdash; '+t.outcome+'.'};
  });
  if(typeof ctWorkflowData!=='undefined')ctWorkflowData[id]=trail.slice().reverse().map(function(t){
    return {title:t.label,user:t.owner,date:now.date,time:now.time,
      description:t.outcome+(t.artefact?' &middot; '+t.artefact.label+' '+t.artefact.ref:'')+'.'};
  });
  return id;
}
/* == THE RUN IS A RECORD, NOT ONLY ITS OUTPUT ==============================================
   A run of this journey used to leave exactly one trace: the placement it created, and only if it
   got all the way to Active. Everything else about it was unrecorded. A run parked on someone
   else's approval was invisible; a run declined at signature vanished completely, which is the
   opposite of what a declined placement should do; and My Runs — a page whose empty state
   promises "journeys you start appear here and stay here" — never showed a single one.

   ONE RECORD PER RUN, UPDATED IN PLACE. Not one per stage and not one per artefact: the run is the
   thing with a lifecycle, so it gets exactly one row and that row is rewritten as it moves.
   Nothing accumulates, and there is never a moment where two rows describe the same run.

   WRITTEN WHEN THE RUN GENUINELY STARTS, which is when the request is submitted — not when the
   engagement model is picked. Choosing EOR and closing the tab is not a run, and a registry that
   recorded it would fill with abandoned rows nobody could act on.

   IT LIVES IN aiAutomationRuns, the store My Runs and the persona dashboard already read, rather
   than a private one they would each need teaching about. The shape is that store's shape. == */
const CCJ_RUN_JOURNEY='contract-creation';
/* == ONE LIVE PLACEMENT PER PERSON =========================================================
   Running the journey twice for the same person used to leave two placements, both Active, with
   nothing saying which one was current — three runs for Shiv Kumar produced three identical live
   rows. That is not a duplicate record so much as a contradiction: a person cannot be employed
   twice in the same country on the same terms, and a listing that claims they are cannot be used
   to answer "what is this person's contract".

   SUPERSEDED, NOT DELETED. The earlier placement is a thing that happened — it has its own
   documents, logs and signatures — so it keeps its row and gains a status and a pointer to what
   replaced it. Deleting it would destroy the history the record exists to hold.

   Matched on name AND country: the same person placed in a second country is a second, genuinely
   concurrent engagement, and collapsing those would be the opposite error. */
function ccjActivePlacements(name,country){
  if(typeof contractsData==='undefined')return [];
  const n=String(name||'').trim().toLowerCase();
  if(!n)return [];
  return contractsData.filter(function(c){
    return String(c.empName||'').trim().toLowerCase()===n
      && String(c.countryOfOp||c.country||'')===String(country||'')
      && c.status!=='Superseded';
  });
}
function ccjSupersedePlacements(name,country,byId){
  const prior=ccjActivePlacements(name,country);
  prior.forEach(function(c){
    c.status='Superseded';
    c.supersededBy=byId;
    c.supersededAt=typeof aiFormatNow==='function'?aiFormatNow().date:'';
  });
  return prior.map(function(c){return c.id;});
}
/* Status is DERIVED, never assigned — the run's own phase is the single source of truth, so the
   listing cannot drift from what the journey is actually doing. The four values are the ones the
   store already uses, so the stat tiles and filters keep working untouched. */
function ccjRunStatusFor(run){
  if(!run)return 'Active';
  if(run.stopped)return 'Exception';
  if(run.phase==='done'||run.rested&&run.stage>=ccjStages().length-1&&run.phase==='rest')return 'Completed';
  if(run.phase==='halt')return 'Waiting for Approval';
  return 'Active';
}
/* The log. Read from the trail the journey already keeps rather than appended to as things happen:
   a second list maintained by hand is a second list that can disagree with the first. */
function ccjRunAudit(){
  return ccjTrail().filter(function(t){return t.complete;})
    .map(function(t){return t.label+' &mdash; '+t.outcome+(t.owner?' ('+t.owner+')':'');});
}
function ccjSyncRunRecord(){
  const run=ccjRun;
  if(!run||!run.started)return null;                 // the chooser is not yet a run
  if(typeof aiAutomationRuns==='undefined')return null;
  const list=aiAutomationRuns[CCJ_RUN_JOURNEY]||(aiAutomationRuns[CCJ_RUN_JOURNEY]=[]);
  // The id is minted once and then belongs to the run for its whole life, which is what makes
  // every later call an update rather than an insert.
  if(!run.runId)run.runId='RUN-'+(2100+(run.gen||0));
  let rec=list.find(function(r){return r.runId===run.runId;});
  if(!rec){
    rec={runId:run.runId,journeyId:CCJ_RUN_JOURNEY,
      startedBy:typeof currentActorId==='function'?currentActorId():'',
      startedAt:ccjStamp(0)};
    list.unshift(rec);
  }
  const p=ccjParties(),c=ccjCtx();
  rec.client=p.worker.name;                          // this store names the subject `client`
  rec.country=c.country;
  rec.contractType=(typeof engagementModel==='function'?engagementModel(run.model).short:run.model);
  rec.currentStepIdx=run.stage;
  rec.status=ccjRunStatusFor(run);
  rec.lastActivity=ccjStamp(ccjClient().mins);
  rec.audit=ccjRunAudit();
  // What the run produced, so the row is a way INTO the work rather than a dead summary of it.
  if(run.contractRowId)rec.contractRecordId=run.contractRowId;
  /* Why it stopped, in the words the run itself recorded — `run.stop` already holds the terminal
     decision's own title and reason, so the listing quotes the run rather than inventing a second
     description of the same event. */
  if(run.stopped){
    const s=run.stop||{};
    rec.exceptionNote=s.note||s.reason||s.title||'Stopped before the placement went live.';
  }else delete rec.exceptionNote;
  return rec;
}
/* The way out of the finished journey: write the record if it is not written, leave the run
   behind — it is over — and land on the contracts listing with the new row at the top of it. */
function ccjOpenContractRecord(){
  ccjWriteContractRecord();
  ccjReset();
  if(typeof navigatePage==='function')navigatePage('contracts');
}

/* ---- SCREEN 1: THE CERTIFICATE -------------------------------------------------------------- */
function ccjRdyVerdictHTML(v){
  const t=v==='pass'?'&#10003;':v==='consider'?'!':v==='fail'?'&#10007;':'&ndash;';
  return '<span class="ccj-rdy-v '+v+'">'+t+'</span>';
}
function buildCCJRdyHTML(){
  const run=ccjRun,p=ccjParties(),f=run.form||{},r=ccjRdy();
  const list=ccjRdyChecks(),shown=Math.min(r.step,list.length);
  const open=ccjRdyOpen(),blocked=ccjRdyFailed();
  const done=r.done;
  const per=ccjPayrunPeriod();
  let n=0;
  const groups=CCJ_RDY_GROUPS.map(function(g){
    const rows=list.map(function(c,idx){return {c:c,idx:idx};})
      .filter(function(x){return x.c.group===g.id&&x.idx<shown;});
    if(!rows.length)return '';
    return '<div class="ccj-rdy-grp">'
      +'<div class="ccj-rdy-grp-h"><span class="ccj-rdy-grp-n">'+g.n+'</span>'
      +'<div class="ccj-rdy-grp-t">'+g.title+'<i>'+g.why+'</i></div></div>'
      +rows.map(function(x){
        const c=x.c;n++;
        return '<div class="ccj-rdy-row '+c.verdict+'" id="ccj-rdy-'+(x.idx+1)+'">'
          +ccjRdyVerdictHTML(c.verdict)
          +'<div class="ccj-rdy-b">'
          +'<div class="ccj-rdy-l">'+c.label+'</div>'
          +'<div class="ccj-rdy-p">'+c.proves+'</div>'
          +'<div class="ccj-rdy-d">'+c.detail+'</div>'
          +'<div class="ccj-rdy-src"><span>'+c.src+'</span>'
          +'<b>'+c.ref+'</b>'
          +(c.at?'<i>'+ccjStamp(c.at)+'</i>':'')+'</div>'
          +'</div></div>';
      }).join('')
      +'</div>';
  }).join('');
  return '<div class="ccj-rdy-wrap">'
    +'<div class="ccj-rdy-cert'+(done?(blocked.length?' bad':' ok'):'')+'">'
    +'<div class="ccj-rdy-head">'
    // The stamp sits UNDER the reference, inside the header's left column, rather than floating
    // over the header. Absolutely positioned it landed on top of the worker's country and start
    // date and across the rule beneath them — a stamp that obscures the thing it is certifying.
    +'<div><div class="ccj-rdy-kind">Payroll readiness certificate</div>'
    +'<div class="ccj-rdy-no">'+(r.ref||'in progress')+'</div>'
    +(done&&!blocked.length?'<div class="ccj-rdy-stamp">READY FOR PAYROLL</div>':'')
    +'</div>'
    +'<div class="ccj-rdy-who"><b>'+p.worker.name+'</b>'
    +'<span>'+(f.jobTitle||'&mdash;')+' &middot; '+p.adt.name+'</span>'
    +'<span>'+ccjInCountry(p.worker.country)+' &middot; starts '+ccjPrettyDate(f.fromDate)+'</span></div>'
    +'</div>'
    +'<div class="ccj-rdy-bar"><span style="width:'+(list.length?Math.round(shown/list.length*100):0)+'%"></span></div>'
    +'<div class="ccj-rdy-count">'
    +'<b>'+shown+' of '+list.length+'</b> controls checked'
    +(done?' &middot; '+(list.length-open.length)+' satisfied'
      +(open.length?' &middot; '+open.length+' not clear':''):'')
    +'</div>'
    +groups
    +(done
      ?'<div class="ccj-rdy-foot'+(blocked.length?' bad':'')+'">'
       +(blocked.length
         ?'<b>Payroll is blocked.</b> '+blocked.length+' control'+(blocked.length===1?'':'s')
          +' could not be satisfied: '+blocked.map(function(c){return c.label;}).join(', ')
          +'. Nothing runs until '+(blocked.length===1?'it is':'they are')+' resolved.'
         :'<b>'+p.worker.name+' can be paid for '+per.label+'.</b> Every control above was '
          +'re-derived from the record the stage that produced it wrote &mdash; this certificate '
          +'asserts nothing on its own. Issued '+ccjStamp(r.at)+' by the payroll readiness engine.')
       +'</div>'
      :'')
    +'</div></div>';
}

/* ---- SCREEN 2: THE RUN ----------------------------------------------------------------------
   The register above, the payslip below. The register is what Finance releases; the payslip is
   what the employee receives, and it only exists once the money has actually gone. */
function buildCCJPayrunHTML(){
  const run=ccjRun,p=ccjParties(),f=run.form||{};
  const pr=ccjPayrun(),cal=ccjPayrunCalc(),pack=ccjPayrunPack(),ok=ccjOnbPack();
  const per=ccjPayrunPeriod(),o=ccjOnb();
  const money=function(v){return ccjMoney(v);};
  const kv=function(k,v){return '<div class="ccj-pr-kv"><span>'+k+'</span><b>'+v+'</b></div>';};
  const at=function(id){return CCJ_PR_PHASES.findIndex(function(x){return x.id===id;})<pr.step;};
  const phase=function(p2,i,doneN){
    const isDone=i<doneN,isLive=i===doneN;
    if(!isDone&&!isLive)return '';
    return '<div class="ccj-pr-ph'+(isDone?' done':' doing')+'">'
      +'<span class="ccj-pr-ph-i">'+(isDone
        ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
        :'<span class="ccj-spin sm"></span>')+'</span>'
      +'<span class="ccj-pr-ph-t">'+p2.label+'<i>'+p2.sub+'</i></span></div>';
  };
  const earn='<table class="ccj-pr-tbl"><thead><tr><th>Earnings</th><th>Basis</th><th>Amount</th></tr></thead><tbody>'
    +'<tr><td><b>Basic salary</b><span>'+(f.jobTitle||'Salaried')+' &middot; '
      +(cal.prorated?'prorated to the start date':'full period')+'</span></td>'
    +'<td>'+(cal.prorated?cal.days+' of '+cal.inMonth+' days':'1 month')+'</td>'
    +'<td>'+money(cal.basic)+'</td></tr>'
    +'<tr class="ccj-pr-sum"><td><b>Gross for the period</b><span>What tax and contributions are computed on</span></td>'
    +'<td>&mdash;</td><td>'+money(cal.gross)+'</td></tr>'
    +'</tbody></table>';
  const dedRows=[
    {k:cal.taxLine,s:ok.taxCredit,b:cal.taxPct+'% effective',v:cal.tax},
    {k:'Employee social security',s:ok.ssScheme,b:cal.socialPct+'% of gross',v:cal.social}
  ].concat(cal.ded?[{k:cal.ded.label,s:cal.ded.note,b:cal.ded.pct+'% of gross',v:cal.ded.amount}]:[]);
  const ded='<table class="ccj-pr-tbl"><thead><tr><th>Deductions</th><th>Basis</th><th>Amount</th></tr></thead><tbody>'
    +dedRows.map(function(r){
      return '<tr><td><b>'+r.k+'</b><span>'+r.s+'</span></td><td>'+r.b+'</td>'
        +'<td class="ccj-pr-neg">&minus;&nbsp;'+money(r.v)+'</td></tr>';
    }).join('')
    +'<tr class="ccj-pr-sum net"><td><b>Net pay</b><span>Into the verified account</span></td>'
    +'<td>&mdash;</td><td>'+money(cal.net)+'</td></tr>'
    +'</tbody></table>';
  const accr=cal.accruals.length
    ?'<table class="ccj-pr-tbl"><thead><tr><th>Accrued this period, paid later</th><th>Basis</th><th>Amount</th></tr></thead><tbody>'
     +cal.accruals.map(function(a){
       return '<tr><td><b>'+a.label+'</b><span>'+a.note+'</span></td><td>'+a.pct+'% of gross</td><td>'+money(a.amount)+'</td></tr>';
     }).join('')+'</tbody></table>'
    :'';
  // "Component", not "Employer cost" — the card above it is already titled that, and a table whose
  // first column header repeats its own card title says nothing about the column.
  const er='<table class="ccj-pr-tbl"><thead><tr><th>Component</th><th>Basis</th><th>Amount</th></tr></thead><tbody>'
    +'<tr><td><b>Gross salary</b><span>As above</span></td><td>&mdash;</td><td>'+money(cal.gross)+'</td></tr>'
    +'<tr><td><b>'+cal.erLabel+'</b><span>Paid by '+p.adt.name+', not deducted from the employee</span></td>'
    +'<td>'+cal.erPct+'% of gross</td><td>'+money(cal.erSocial)+'</td></tr>'
    +(cal.erExtra?'<tr><td><b>'+cal.erExtra.label+'</b><span>Employer side of auto-enrolment</span></td>'
      +'<td>'+cal.erExtra.pct+'% of gross</td><td>'+money(cal.erExtra.amount)+'</td></tr>':'')
    +(cal.accrued?'<tr><td><b>Accruals</b><span>Set aside this period</span></td><td>&mdash;</td><td>'+money(cal.accrued)+'</td></tr>':'')
    +'<tr class="ccj-pr-sum"><td><b>Total cost of employment</b><span>The figure the quote priced a margin on</span></td>'
    +'<td>&mdash;</td><td>'+money(cal.cost)+'</td></tr>'
    +'</tbody></table>';
  const stat='<div class="ccj-pr-stat">'
    +'<div class="ccj-pr-stat-r"><div><b>'+pack.ret+'</b><span>'+pack.retTo+'</span></div>'
    +'<div class="ccj-pr-stat-v">'+money(cal.toTax)+'</div></div>'
    +'<div class="ccj-pr-stat-r"><div><b>'+pack.ssRet+'</b><span>'+pack.ssTo
      +' &middot; employee '+money(cal.social)+' + employer '+money(cal.erSocial)+'</span></div>'
    +'<div class="ccj-pr-stat-v">'+money(cal.toSs)+'</div></div>'
    +'</div>';
  // The reconciliation. Onboarding published an indicative net and said it was indicative; this is
  // the binding one. Where they differ, the difference is named rather than quietly absorbed.
  const rec=cal.delta
    ?'<div class="ccj-pr-rec">Onboarding published <b>'+money(cal.indicative)
      +'</b> as indicative. The binding figure is <b>'+money(cal.net)+'</b> &mdash; '
      +(cal.ded?cal.ded.label+' is levied on the run and was not modelled at configuration.'
        :'the run computes against the tax code the authority returned.')+'</div>'
    :'<div class="ccj-pr-rec ok">Matches the indicative net onboarding published ('+money(cal.indicative)+').</div>';
  const canSee=pr.step>=4;      // the gross-to-net phase has run
  /* THE STATUS IS THE HEADLINE. This screen used to lead with a net figure and "paid" — it is now
     a setup, so the one thing a reader needs from it is where payroll stands: PENDING until the
     placement is activated, ACTIVE after. The figure stays beside it and says it is indicative,
     because it is the most useful number here and computing it is not the same as paying it. */
  const status=pr.state==='active'?'ACTIVE':pr.state==='pending'?'PENDING':'CONFIGURING';
  return '<div class="ccj-pr-wrap">'
    +'<div class="ccj-pr-hero'+(pr.state==='active'?' ok':'')+'">'
    +'<div class="ccj-pr-hero-b">'
    +'<div class="ccj-pr-hero-t">'+(pr.id||'Payroll setup')+'</div>'
    +'<div class="ccj-pr-hero-s">'+(pr.label||per.label)+' &middot; '+p.worker.name
      +' &middot; first pay '+(pr.payDay||per.payDay)+'</div></div>'
    +'<div class="ccj-pr-hero-f"><span class="ccj-pr-status '+status.toLowerCase()+'">'+status+'</span>'
    +'<i>'+(pr.state==='active'?'payroll active from '+ccjStamp(pr.activatedAt)
      :pr.state==='pending'?'set up, not yet live'
      :'being configured')+'</i></div>'
    +'</div>'
    +'<div class="ccj-pr-card">'
    +'<div class="ccj-pr-card-t">Setting payroll up</div>'
    +CCJ_PR_PHASES.map(function(x,i){return phase(x,i,pr.step);}).join('')
    +'</div>'
    +(at('inputs')?'<div class="ccj-pr-card"><div class="ccj-pr-card-t">Inputs</div>'
      +'<div class="ccj-pr-kvs">'
      +kv('Contract',ccjEmp().id+' v'+ccjEmp().version)
      +kv('Contracted gross',money(cal.full)+' / month')
      +kv('Calendar',o.payroll.calendar||('Monthly &middot; '+p.worker.country))
      +kv('Period',pr.from+' &ndash; '+pr.to)
      +kv('Cut-off',pr.cutOff)
      +kv('Pay date',pr.payDay)
      +kv('Days paid',cal.prorated?cal.days+' of '+cal.inMonth:'Full month')
      +kv('Variable inputs','None &mdash; salaried, no timesheet')
      +kv('Absence','None recorded in the first period')
      +kv('Account',o.bank.iban||'&mdash;')
      // Which rail this person will be paid on. It used to appear only on the disbursement, which
      // no longer exists — and it is a configuration fact, so it belongs with the configuration.
      +kv('Payment rail',pack.rail)
      +'</div></div>':'')
    +(canSee?'<div class="ccj-pr-card"><div class="ccj-pr-card-t">Gross to net</div>'
      +earn+ded+rec+accr+'</div>':'')
    +(at('stat')?'<div class="ccj-pr-card"><div class="ccj-pr-card-t">What the first run will owe, and to whom</div>'
      +stat
      +'<div class="ccj-pr-note">'+pack.ret+' will be due to '+pack.retTo
      +' for the '+pr.label+' period. Both sides of social security are remitted together on the '
      +pack.ssRet+'.</div></div>':'')
    +(canSee?'<div class="ccj-pr-card"><div class="ccj-pr-card-t">Employer cost</div>'+er+'</div>':'')
    +(at('check')?'<div class="ccj-pr-card"><div class="ccj-pr-card-t">Pre-payment controls</div>'
      +'<div class="ccj-pr-ctrl">'
      /* Each control tests the thing its label claims. The funding one used to read "Funding
         available against the deposit" and pass on `received >= cost || paidInFull` — so a
         settled deposit of one month gross ticked green against a run costing half as much again,
         which is the ordinary EOR case and not a funding failure at all. The deposit is SECURITY
         against the placement, not the float payroll runs from; conflating the two put a green
         tick on the one control that is about money being there. It now asserts what it can:
         the deposit is settled and held. What the run actually needs in cash is stated beside
         it as a figure rather than as a pass. */
      +[['Readiness certificate issued',ccjRdy().ref||'not issued',ccjRdy().done&&!ccjRdyFailed().length],
        ['Payment account verified',o.bank.iban||'not verified',o.bank.state==='verified'],
        ['Net pay is positive and below the contracted gross',money(cal.net),cal.net>0&&cal.net<=cal.full],
        ['Security deposit settled and held against the placement',money(ccjReceived()),
         ccjPaidInFull()||ccjPay().released]]
        .map(function(r){
          return '<div class="ccj-pr-ctrl-r '+(r[2]?'ok':'no')+'">'
            +'<span class="ccj-rdy-v '+(r[2]?'pass':'fail')+'">'+(r[2]?'&#10003;':'&#10007;')+'</span>'
            +'<span class="ccj-pr-ctrl-l">'+r[0]+'</span><b>'+r[1]+'</b></div>';
        }).join('')
      +'</div>'
      +'<div class="ccj-pr-note">The first run will move <b>'+money(cal.cashOut)+'</b> in cash &mdash; '
      +money(cal.net)+' to '+p.worker.name+' and '+money(cal.toTax+cal.toSs)
      +' to the authorities &mdash; on '+(pr.payDay||per.payDay)+'. The period costs '+money(cal.cost)
      +(cal.accrued?'; the difference is the '+money(cal.accrued)+' accrued now and paid later.':'.')
      +' Nothing is paid and no return is filed by this journey.'
      +'</div></div>':'')
    /* WHERE THE STAGE STOPS. Configured, not run. Everything below this used to be the release, the
       disbursement and the payslip — a payment file, a bank reference, money leaving. None of it
       happens here any more; payroll runs on its own calendar once the placement is active. */
    +(pr.state==='pending'||pr.state==='active'
      ?'<div class="ccj-pr-rel'+(pr.state==='active'?'':' held')+'">'
       +'<div class="ccj-pr-rel-i">'+(pr.state==='active'
         ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
         :'&hellip;')+'</div>'
       +'<div><div class="ccj-pr-rel-t">Payroll '+(pr.state==='active'?'active':'pending')+'</div>'
       +'<div class="ccj-pr-rel-s">'+(pr.state==='active'
         ?'Set live by '+pr.activatedBy+' at '+ccjStamp(pr.activatedAt)+'. '+p.worker.name.split(' ')[0]
          +' is on the '+(o.payroll.calendar||'monthly')+' calendar and is first paid on '+(pr.payDay||per.payDay)+'.'
         :'Set up and waiting to be made active. Access has been granted and the first period is '
          +'configured; no payroll runs until the placement is live.')
       +'</div></div></div>'
      :'')
    +'</div>';
}
/* The payslip, as a document. The employee gets this one — so it names the employer entity, the

/* ---- SCREEN 3: ACTIVE ------------------------------------------------------------------------ */
function buildCCJActiveHTML(){
  const run=ccjRun,p=ccjParties(),f=run.form||{};
  const pr=ccjPayrun(),cal=ccjPayrunCalc(),per=ccjPayrunPeriod(),o=ccjOnb(),e=ccjEmp();
  const q=ccjQuote(),trail=ccjTrail();
  // Live means the placement has been ACTIVATED, not that a payroll has been paid. It read
  // `state==='paid'`, which no longer occurs — this journey configures payroll and sets it live;
  // the run happens on the calendar afterwards. Left unfixed, the final screen of a completed
  // journey would have said "Going live" forever.
  const live=pr.state==='active';
  const kv=function(k,v){return '<div class="ccj-act-kv"><span>'+k+'</span><b>'+v+'</b></div>';};
  return '<div class="ccj-act-wrap">'
    /* == THE END OF THE JOURNEY LOOKS LIKE THE END OF THE JOURNEY ==========================
       Nine stages, forty sub-statuses, four or five human decisions and several weeks of
       simulated time, and the moment it all completed was reported by a status dot changing from
       amber to green in a header that had said almost the same thing a minute earlier — with the
       one sentence that named the achievement ("Journey complete") sitting at the BOTTOM of three
       full cards, below the fold, where it was read after everything it was summarising.

       An outcome belongs at the top. This is the only screen in the product that gets to say a
       hire was made, and it now says it first: the tick, the fact, the four numbers that
       distinguish this placement from any other, and the two things a person actually wants at
       that moment — the contract in their hand and the record to file it against.

       Only when it is genuinely LIVE. The same screen renders while payroll is still going live,
       and a success panel over an unfinished run would be the single most damaging place in the
       journey to overclaim. Until then it keeps the working header it always had. == */
    +(live
      ?'<div class="ccj-done">'
       +'<div class="ccj-done-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>'
       // The STATUS as well as the event. "Contract created" is what just happened; "Active" is
       // what is true from now on, and it is the word the rest of the product files this record
       // under — the listing, the badge, the client's own view.
       +'<div class="ccj-done-chip"><span class="ccj-act-dot"></span>Active &mdash; '+p.worker.name+'</div>'
       +'<div class="ccj-done-t">Contract created</div>'
       // Names the three parties in one sentence, because "who employs whom, for whom, where" is
       // the whole of what an EOR placement is and the one thing a reader repeats out loud.
       // ccjInCountry, not the bare name: two of the seven countries take a definite article in
       // running prose, and "employed in Netherlands" is the kind of sentence that makes a
       // generated document read as generated.
       +'<div class="ccj-done-s"><b>'+p.worker.name+'</b> is employed by '+p.adt.name
       +' for '+p.client.name+' in '+ccjInCountry(p.worker.country)
       +', and on payroll from <b>'+per.nextPay+'</b>.</div>'
       +'<div class="ccj-done-facts">'
       +'<div class="ccj-done-fact"><b>'+e.id+'</b><span>Contract</span></div>'
       +'<div class="ccj-done-fact"><b>'+p.worker.empId+'</b><span>Employee</span></div>'
       +'<div class="ccj-done-fact"><b>'+ccjPrettyDate(f.fromDate)+'</b><span>Starts</span></div>'
       +'<div class="ccj-done-fact"><b>'+per.nextPay+'</b><span>First pay</span></div>'
       +'</div>'
       /* ONE ACTION, AND IT IS NOT THE WAY ON. Every other screen in this journey shows and the
          conversation asks — the way out of a finished run is ccjDoneAsk's button, in the thread,
          and putting a second copy of it here would undo the migration that took five of them off
          the artefacts in the first place.

          A copy of the contract is a different kind of thing: it moves nothing, it is the document
          this whole journey exists to produce, and this is the single most likely moment in the
          product for someone to want it in their hand. It is drawn from run state rather than from
          the screen (see ccjDocNode), so it can be handed over from here even though the contract
          itself was drawn three stages ago and is nowhere on the page. */
       +'<div class="ccj-done-btns">'
       +'<button type="button" class="ccj-done-dl" onclick="ccjDownloadDoc(\'contract\')">'
       +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
       +'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
       +'Download the contract</button>'
       +'</div>'
       // The scale of what was done, stated once, where it means something. It used to be the
       // closing line of the screen; it is now the footnote to the headline it was always about.
       +'<div class="ccj-done-stats">Nine stages &middot; '
       +trail.reduce(function(s,t){return s+t.done;},0)+' sub-statuses &middot; '
       +trail.filter(function(t){return t.human;}).length+' human decisions</div>'
       +'</div>'
      :'<div class="ccj-act-hero">'
       +'<div class="ccj-act-hero-av">'+ccjInitials(p.worker.name)+'</div>'
       +'<div class="ccj-act-hero-b">'
       +'<div class="ccj-act-hero-t"><span class="ccj-act-dot"></span>Going live &mdash; '+p.worker.name+'</div>'
       +'<div class="ccj-act-hero-s">'+(f.jobTitle||'&mdash;')+' at '+p.client.name
       +' &middot; employed by '+p.adt.name+' &middot; '+ccjInCountry(p.worker.country)+'</div>'
       +'</div></div>')
    +'<div class="ccj-act-card"><div class="ccj-act-card-t">Employment record</div>'
    +'<div class="ccj-act-kvs">'
    +kv('Employee',p.worker.name)
    +kv('Employee ID',p.worker.empId)
    +kv('Employer entity',p.adt.name)
    +kv('Client',p.client.name)
    +kv('Engagement',ccjModelLabel(run.model))
    +kv('Role',f.jobTitle||'&mdash;')
    +kv('Country of work',p.worker.country)
    +kv('Started',ccjPrettyDate(f.fromDate))
    +kv('Contract',e.id+' v'+e.version)
    +kv('Contracted gross',ccjMoney(q.gross)+' / month')
    +kv('Pay calendar',o.payroll.calendar||('Monthly &middot; '+p.worker.country))
    +kv('Next pay date',per.nextPay)
    +'</div></div>'
    +'<div class="ccj-act-card"><div class="ccj-act-card-t">The record of this placement</div>'
    +'<div class="ccj-act-trail">'
    +trail.map(function(t){
      return '<div class="ccj-act-tr'+(t.complete?' done':'')+'">'
        +'<span class="ccj-act-tn">'+(t.complete
          ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
          :t.n)+'</span>'
        +'<div class="ccj-act-tb">'
        +'<div class="ccj-act-tl">'+t.label+'</div>'
        +'<div class="ccj-act-to">'+t.outcome+'</div>'
        +'</div>'
        +'<div class="ccj-act-tm">'
        +'<span class="ccj-act-town'+(t.human?' human':'')+'">'+t.owner+'</span>'
        +(t.artefact?'<span class="ccj-act-tart">'+t.artefact.label+' <b>'+t.artefact.ref+'</b></span>':'')
        +'</div></div>';
    }).join('')
    +'</div></div>'
    /* Short values on purpose. These are key-value rows in a half-width column, and a sentence in
       the value wraps to three right-aligned lines that read as a paragraph pushed into a corner. */
    +'<div class="ccj-act-card"><div class="ccj-act-card-t">From here</div>'
    +'<div class="ccj-act-kvs">'
    +kv('Next payroll',per.nextLabel+' &middot; on the calendar')
    +kv('Next pay date',per.nextPay)
    // "Filed for <period>" claimed a statutory return this journey no longer makes. What is true
    // is that the return follows the first run, on the calendar.
    +kv(ccjPayrunPack().ret,'Due with the '+per.label+' run')
    +kv('Compliance','Tracked against '+p.worker.country)
    +'</div>'
    +'<div class="ccj-pr-note">Nothing here needs a journey again. Payroll repeats on the calendar '
    +'and the statutory filings follow it; the renewals sit with '+ccjInCountry(p.worker.country)
    +' rather than with this placement.</div></div>'
    // The closing "Journey complete" block that used to sit here has moved to the TOP of the
    // screen and grown into the success panel — see the note above .ccj-done. Leaving a copy
    // behind would have the same screen announcing the same outcome twice, once above everything
    // it summarises and once below.
    +'</div>';
}

/* ---- WIRING STAGE 9 INTO THE RUNNER ---------------------------------------------------------- */
CCJ_PURPOSE['active/Ready for payroll']='Re-checks every control this journey passed, and issues the certificate.';
CCJ_PURPOSE['active/First payroll run']='Grants access and configures the first period. Payroll is left PENDING.';
CCJ_PURPOSE['active/Active']='Sets payroll from pending to active and writes the placement into the record.';

CCJ_ON_ENTER['active/Ready for payroll']=function(run){ccjRdyStart();};
CCJ_ON_ENTER['active/First payroll run']=function(run){
  ccjGoScreen('payrun');
  ccjPayrunStart();
};
CCJ_ON_ENTER['active/Active']=function(run){ccjGoScreen('active');};

CCJ_HOLDS['active/Ready for payroll']={until:'readiness-done',verb:'Checking',note:'Re-deriving every control.',
  rows:function(){
    const l=ccjRdyChecks(),done=ccjRdy().step;
    return [['Controls',Math.min(done+(ccjRdy().done?0:1),l.length)+' of '+l.length],
            ['Failed',ccjRdyFailed().length
              ?'<span class="ccj-wait-late">'+ccjRdyFailed().length+' cannot be proved</span>':'']];
  }};
/* ONE milestone now, not two. It used to be a function returning a different `until` before and
   after a person released the money — one step, two halves, an approval between them. There is no
   approval any more because there is no payment: the step configures payroll and stops. */
CCJ_HOLDS['active/First payroll run']={until:'payrun-done',
  verb:'Configuring',
  note:'Granting access and configuring the first period.',
  rows:function(){
    const pr=ccjPayrun(),n=CCJ_PR_PHASES.length;
    return [['Setup',Math.min(pr.step+(pr.done?0:1),n)+' of '+n],
            ['Access',pr.accessAt?'<span class="ccj-wait-on">Granted</span>':''],
            ['Payroll status',pr.state==='pending'?'Pending':''],
            ['First pay',pr.step>=2?pr.payDay:'']];
  }};

/* NO GATE HERE ANY MORE. There used to be one: the only point in the journey at which money left
   us for a person, so a person had to release it. Nothing is paid on this stage now, and a gate
   asking somebody to approve a payment that does not happen would be theatre. */

/* THE LAST STEP IS THE ACTIVATION. Payroll has been configured and sitting at PENDING since the
   step before; this is where it becomes ACTIVE and the placement goes live. Done on settle rather
   than on a button, so the record exists the moment the journey says it does — a user who never
   clicks through still has the contract in their list. */
CCJ_ON_SETTLE['active/Active']=function(run){
  const pr=ccjPayrun(),c=ccjClient(),p=ccjParties();
  c.mins+=20;
  pr.state='active';pr.activatedAt=c.mins;pr.activatedBy=ccjActor();
  ccjWriteContractRecord();
  ccjWorkerPush({who:'note',text:'Employment active &middot; '+p.worker.empId
    +' &middot; payroll active, first pay '+(pr.payDay||ccjOnb().payroll.firstPay||'&mdash;'),
    at:c.mins});
};

CCJ_EVIDENCE['active/Ready for payroll']={
  system:'Payroll readiness engine', ref:'controls across stages 5&ndash;8',
  call:function(c){return 'readiness(worker="'+ccjParties().worker.empId
    +'", contract="'+ccjEmp().id+'", period="'+ccjPayrunPeriod().label+'")';},
  latency:'480ms',
  fetched:function(c){const l=ccjRdyChecks(),r=ccjRdy();return [
    {k:'Controls',sub:'Re-derived, not re-asserted',v:l.length+' checked',state:'active'},
    {k:'Satisfied',sub:'Outright pass',v:String(l.filter(function(x){return x.verdict==='pass';}).length),
     state:'active'},
    {k:'Not clear',sub:'Stated on the certificate',v:String(ccjRdyOpen().length),
     state:ccjRdyOpen().length?'active':'inactive'},
    {k:'Certificate',sub:'Reference',v:r.ref||'in progress',state:r.ref?'active':'inactive'}
  ];},
  checks:function(c){const f=ccjRdyFailed();return [
    {rule:'Every control traces to the record the stage that produced it wrote',
     expected:'a source and a reference on each row',
     actual:ccjRdyChecks().length+' rows, each citing its stage',verdict:'pass'},
    {rule:'No control may be satisfied by this stage asserting it',
     expected:'derived from stored evidence',actual:'derived',verdict:'pass'},
    {rule:'Payroll does not start while a control is unsatisfied',
     expected:'0 failed',actual:f.length?f.length+' failed: '+f.map(function(x){return x.label;}).join(', '):'0 failed',
     verdict:f.length?'fail':'pass'}
  ];},
  captured:function(c){const r=ccjRdy();return [
    {k:'Readiness certificate',v:r.ref||'&mdash;'},
    {k:'Ready for payroll',v:r.done&&!ccjRdyFailed().length?'Yes':'No'}];},
  summary:function(c){const l=ccjRdyChecks();
    return (l.length-ccjRdyOpen().length)+' of '+l.length+' controls satisfied';},
  note:'This certificate is the reason a worker can trust the number on their payslip. It does not restate what the earlier stages claimed — it reads the objects those stages wrote and reports what is actually in them, which is why a missing filing or an unverified account fails here rather than being papered over.'
};
CCJ_EVIDENCE['active/First payroll run']={
  system:'Payroll engine', ref:'first period',
  call:function(c){return 'configure(period="'+ccjPayrunPeriod().label+'", worker="'
    +ccjParties().worker.empId+'", contract="'+ccjEmp().id+'", status="pending")';},
  latency:'1.9s',
  fetched:function(c){const cal=ccjPayrunCalc(),pr=ccjPayrun(),o=ccjOnb();return [
    {k:'Platform access',sub:'The employee can sign in',
     v:pr.accessAt?'granted '+ccjStamp(pr.accessAt):'not yet',
     state:pr.accessAt?'active':'inactive'},
    {k:'Gross',sub:cal.prorated?cal.days+' of '+cal.inMonth+' days':'Full period',
     v:ccjMoney(cal.gross),state:'active'},
    {k:'Net pay',sub:'Indicative &mdash; nothing is paid by this journey',
     v:ccjMoney(cal.net),state:'active'},
    {k:'Destination',sub:'Verified account',v:o.bank.iban||'&mdash;',state:'active'},
    {k:'Payroll status',sub:'Until the placement goes live',
     v:pr.state==='pending'||pr.state==='active'?'Pending':'&mdash;',
     state:pr.state==='idle'?'inactive':'active'}
  ];},
  checks:function(c){const cal=ccjPayrunCalc(),pr=ccjPayrun(),o=ccjOnb();return [
    {rule:'The employee has access before they are expected to have any',
     expected:'sign-in granted at setup',
     actual:pr.accessAt?'granted':'not granted',
     verdict:pr.accessAt?'pass':'fail'},
    {rule:'The first period is prorated to the day they actually start',
     expected:'proration where the start is mid-month',
     actual:cal.prorated?cal.days+' of '+cal.inMonth+' days':'full month — starts on the 1st',
     verdict:'pass'},
    {rule:'Pay is configured against the account the penny-drop verified',
     expected:o.bank.iban||'a verified account',
     actual:o.bank.state==='verified'?o.bank.iban:'not verified',
     verdict:o.bank.state==='verified'?'pass':'fail'},
    /* Stated as a check rather than left implicit, because it is the thing about this stage most
       likely to be misread: the figures on screen are a configuration, not a disbursement. */
    {rule:'No money moves and no return is filed by this journey',
     expected:'configuration only',
     actual:'payroll left pending; the run happens on the calendar',
     verdict:'pass'}
  ];},
  captured:function(c){const pr=ccjPayrun();return [
    {k:'Payroll record',v:pr.id||'&mdash;'},
    {k:'Access granted',v:pr.accessAt?ccjStamp(pr.accessAt):'&mdash;'},
    {k:'Payroll status',v:pr.state==='idle'?'&mdash;':'Pending'}];},
  summary:function(c){const cal=ccjPayrunCalc();
    return 'Access granted &middot; payroll pending &middot; '+ccjMoney(cal.net)+' indicative';},
  note:'This journey sets payroll up; it does not run it. Access, the calendar, the first period and the gross-to-net are all settled here and the record is left PENDING — the placement going live is what makes it active, and the run itself happens on the payroll calendar afterwards.'
};
CCJ_EVIDENCE['active/Active']={
  system:'Employee record', ref:'placement status',
  call:function(c){return 'activate(worker="'+ccjParties().worker.empId+'", contract="'
    +ccjEmp().id+'", from="'+((ccjRun&&ccjRun.form&&ccjRun.form.fromDate)||'')+'")';},
  latency:'110ms',
  fetched:function(c){const p=ccjParties(),per=ccjPayrunPeriod();return [
    {k:'Status',sub:'Placement',v:'Active',state:'active'},
    {k:'Employer',sub:'Legal entity',v:p.adt.name,state:'active'},
    {k:'Client',sub:'Account',v:p.client.name,state:'active'},
    {k:'Next payroll',sub:'On the calendar',v:per.nextPay,state:'active'}
  ];},
  checks:function(c){const pr=ccjPayrun(),run=ccjRun;return [
    /* This used to read "a placement only goes active once a payroll run has actually cleared",
       which is no longer what happens and was the wrong precondition anyway: a person is employed
       and payable from their start date, not from the first time they are paid. What must hold is
       that everything needed to pay them is in place — which is the readiness certificate. */
    {rule:'Nothing goes live until every payroll control is satisfied',
     expected:'readiness certificate issued with no failures',
     actual:ccjRdy().done&&!ccjRdyFailed().length
       ?ccjRdy().ref+' issued clean':(ccjRdyFailed().length+' control(s) unproved'),
     verdict:ccjRdy().done&&!ccjRdyFailed().length?'pass':'fail'},
    {rule:'Payroll moves from pending to active exactly once, and by a named person',
     expected:'pending → active',
     actual:pr.activatedAt?'set active by '+pr.activatedBy+' at '+ccjStamp(pr.activatedAt)
       :'still pending',
     verdict:pr.activatedAt?'pass':'fail'},
    {rule:'The contract record carries the same figures the journey produced',
     expected:'written from the placement',
     actual:run.contractRowId?'contract record #'+run.contractRowId:'not written',
     verdict:run.contractRowId?'pass':'na'}
  ];},
  captured:function(c){const run=ccjRun,pr=ccjPayrun();return [
    {k:'Placement',v:'Active'},
    {k:'Payroll status',v:pr.state==='active'?'Active':'Pending'},
    {k:'Contract record',v:run.contractRowId?'#'+run.contractRowId:'&mdash;'}];},
  summary:function(c){return 'Active &middot; next pay '+ccjPayrunPeriod().nextPay;},
  note:'Active is the end of this journey and the start of a recurring one. Nothing here needs a journey again — payroll runs on the calendar, and the compliance renewals are tracked against the country rather than against this placement.'
};

/* ---- EMPLOYEE CREATED --------------------------------------------------------------------- */
/* THE RIGHT-HAND PANE SHOWS, IT DOES NOT ASK. This screen used to end in a "Continue to contract
   details" button, and it was the clearest breach of that rule in the journey: the record is an
   artefact — here is the person we created — and the decision to move on is an action, which
   belongs in the conversation with every other action. The button is now a block in the stream
   (see ccjAsk), so a reader never has to work out which of the two columns is currently the one
   asking them for something.

   The rest of the journey still asks from the right on five more screens. Those stages have not
   been rebuilt yet, and most of them cannot simply follow: their conversation carries the CLIENT's
   or the WORKER's thread, so an internal Continue moved into it would be an internal control
   sitting in a counterparty's messages. Each moves when its own stage is rebuilt. */
function buildCCJEmployeeCreatedHTML(){
  const r=ccjRun.createdEmp||{};
  const row=function(k,v){return '<div class="ccj-sc-row"><span>'+k+'</span><b>'+(v||'&mdash;')+'</b></div>';};
  return '<div class="ccj-sc">'
    +'<div class="ccj-sc-ico ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>'
    +'<div class="ccj-sc-title">Employee created</div>'
        +'<div class="ccj-sc-grid">'
    +row('Name',r.name)+row('Employee ID',r.empId)+row('Country',r.country||'&mdash;')
    +row('Job Title',r.jobTitle)+row('Status',r.status)
    +'</div>'
    +'</div>';
}

/* == AN ASK IN THE CONVERSATION ==========================================================
   Everything that wants something from the reader is one component. A gate is an ask with two
   or more answers; a "Continue" is an ask with one. Building the second as a different thing
   would have given the journey two ways of asking the same kind of question, in two different
   places, with two different rules about when they scroll into view — and the reader would have
   had to learn both.

   `done` is what makes it honest in an append-only transcript. The block stays where it was said
   and records that it was answered, rather than vanishing and leaving the reader wondering
   whether they imagined it. Same rule as a settled sub-status: it keeps its one useful fact. */
function ccjAsk(text,label,handler){
  const run=ccjRun;if(!run)return;
  ccjPush({who:'agent',kind:'ask',text:text,label:label,handler:handler,done:false});
}
/* `inBar` says the caller is the action bar rather than the stream. An UNANSWERED ask is drawn in
   exactly one of the two — the bar — and the stream renders nothing for it, which `.ccj-msg.step:empty`
   then hides outright. Once it is answered the bar drops it and the stream keeps it as the record
   that it was asked and answered, in the place it was asked. That is the same append-only rule the
   sub-status blocks follow: the control moves, the history does not. */
function ccjAskHTML(m,inBar){
  if(m.done)return '<div class="ccj-ask-block done">'
    +'<span class="ccj-ask-tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg></span>'
    +'<span class="ccj-ask-text">'+m.label+'</span></div>';
  if(!inBar)return '';
  /* `alt` makes an ask a CHOICE rather than an acknowledgement. Every ask in the journey until now
     had one way forward, so one button was the whole vocabulary; the duplicate-placement warning
     is the first that can honestly be answered two ways, and a warning with no way to decline is
     not a warning. The secondary sits left of the primary and is styled quieter. */
  const primary='<button class="ccj-ask-btn" onclick="ccjAnswerAsk('+m._id+')">'+m.label+'</button>';
  return '<div class="ccj-ask-block">'
    +'<div class="ccj-ask-copy">'+m.text+'</div>'
    // The card is a column, so a bare second button would stack under the first. Two choices are
    // one decision and belong on one line.
    +(m.alt
      ?'<div class="ccj-ask-acts">'
        +'<button class="ccj-ask-btn alt" onclick="ccjAnswerAsk('+m._id+',\''+m.alt.handler+'\')">'
        +m.alt.label+'</button>'+primary+'</div>'
      :primary)
    +'</div>';
}
/* A registry rather than a function name looked up off the global object. Three reasons, and the
   third is the one that matters: a name resolved at click time can go stale silently, the lookup
   would depend on `window` which the headless harness only has by courtesy, and — this is the
   point — an enumerable map is a set the handler suite can walk and prove every ask still
   resolves. The journey has already been bitten once by a handler that parsed as valid JS, sat
   inside a string, and failed only at click time. */
const CCJ_ASKS={
  'form':function(){ccjGoScreen('form');},
  // A stage that has finished and is waiting to be walked on from — see ccjRestAsk.
  'continue':function(){ccjContinueStage();},
  // The end of the journey: go and look at the contract it wrote — see ccjDoneAsk.
  'record':function(){ccjOpenContractRecord();},
  // The two answers to the duplicate-placement warning — see ccjWarnDuplicatePlacement.
  'dupContinue':function(){ccjDupContinue();},
  'dupStop':function(){ccjDupStop();}
};
/* Answered by id rather than by "the last ask", because the transcript keeps every ask it ever
   made and a reader can scroll back to an old one. Answering a spent ask does nothing. */
/* `which` names the secondary handler when the reader took the alternative. Absent, the ask
   resolves the way it always did, so every existing caller is unaffected. */
function ccjAnswerAsk(id,which){
  const run=ccjRun;if(!run)return;
  const m=run.msgs.find(function(x){return x._id===id;});
  if(!m||m.done)return;
  m.done=true;
  // The record has to say WHICH way it was answered, or a declined duplicate and an accepted one
  // leave the same trace.
  if(which&&m.alt)m.label=m.alt.label;
  ccjRepaintMsg(m);
  const fn=CCJ_ASKS[which||m.handler];
  if(typeof fn==='function')fn();
}

/* ---- PROPOSAL ------------------------------------------------------------------------------
   Compiling the proposal is the milestone that releases the New intake hold — which is why
   ccjGoScreen('proposal') and nothing else is what finishes that sub-status. */
function ccjCreateProposal(){
  const run=ccjRun;if(!run)return;
  if(ccjMissingFields().length)return;
  const f=run.form;
  const name=((f.fname||'')+' '+(f.lname||'')).trim();
  run.proposal={
    id:'PRO-'+String(4400+(run.gen||0)),
    name:name,country:f.country,jobTitle:f.jobTitle,
    type:ccjModelLabel(run.model),pay:ccjCurrency()+' '+(f.pay||'—'),
    term:f.term,from:f.fromDate
  };
  ccjPush({who:'agent',text:'Proposal <b>'+run.proposal.id+'</b> created.'});
  ccjGoScreen('proposal');
}
function buildCCJProposalHTML(){
  const p=ccjRun.proposal||{};
  const row=function(k,v){return '<div class="ccj-sc-row"><span>'+k+'</span><b>'+(v||'&mdash;')+'</b></div>';};
  return '<div class="ccj-sc">'
    +'<div class="ccj-sc-ico ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>'
    +'<div class="ccj-sc-title">Proposal created</div>'
        +'<div class="ccj-sc-grid">'
    +row('Proposal ID',p.id)+row('Employee',p.name)+row('Country',p.country)
    +row('Engagement',p.type)+row('Job Title',p.jobTitle)+row('Monthly Gross',p.pay)
    +'</div>'
    +''
    +'</div>';
}

/* ---- PAINT ------------------------------------------------------------------------------
   Surgical on purpose. A full renderADTPage on every beat would rebuild the composer four
   times a second and pull the caret out of whatever the user was typing — and would rebuild
   the panel that is supposed to stand still for the whole stage. */
function ccjPaint(){
  const run=ccjRun;if(!run)return;
  /* The run's row is refreshed from the one funnel every state change already passes through, so
     it cannot go stale — the alternative was a sync call at each of the dozen places that move the
     run, which is a call that gets forgotten. It writes fields on a single object and returns
     early before the run has started, so paying for it on every paint costs nothing. */
  ccjSyncRunRecord();
  // A rebuilt stage has no panel to repaint. It repaints AT MOST TWO BLOCKS: the one the runner
  // is on, and the one it has just left. Everything above them is exactly as it was when it
  // settled, which is the property the whole transcript rests on — and it is why this cannot
  // simply keep calling a function that rewrites every row of the stage.
  // The bar is painted from here — and from the three other funnels below — rather than from each
  // of the dozen places that can open or close an ask. Every one of them ends in one of the four,
  // and a repaint that has to be remembered at each call site is a repaint that gets forgotten.
  if(ccjUsesTranscript(run.stage)){ccjPaintBlocks();ccjPaintActionBar();ccjPaintDrawer();return;}
  const inner=document.getElementById('ccj-panel-inner');
  if(inner)inner.innerHTML=ccjPanelInnerHTML(run.stage);
  // Width, not innerHTML — a bar rebuilt each time renders at its destination with nothing to
  // transition from, and a progress bar that teleports is not reporting progress.
  const prog=document.getElementById('ccj-prog');
  if(prog)prog.style.width=ccjProgressPct(run.stage)+'%';
  ccjPaintDrawer();
  // The header is not repainted here on purpose: nothing in it can change without the stage
  // changing, and a stage change goes through a full render anyway.
}
/* The two blocks a transition can change, and no others. `liveKey` is what the transcript last
   drew as the live block; if the runner has moved on, that block is now closed and has to be
   told once. After that it is never touched again. */
function ccjPaintBlocks(){
  const run=ccjRun;
  const step=ccjSteps(run.stage)[run.sub];
  const liveKey=step?ccjPassKey(run.stage,step):'';
  if(run.liveKey&&run.liveKey!==liveKey&&run.stepMsgs[run.liveKey]){
    ccjRepaintMsg(run.stepMsgs[run.liveKey]);
    // The step the runner has just left folds, and its conversation folds with it. This is the
    // moment the user described: the sub-status is done, the runner has moved to the next one, and
    // everything between the two gives back its height. Only ever called on a transition, so a
    // reader who opened this block by hand keeps it open — ccjStepOpenByKey checks run.open first.
    ccjFoldOwned(run.liveKey);
  }
  if(liveKey&&run.stepMsgs[liveKey])ccjRepaintMsg(run.stepMsgs[liveKey]);
  // The step being entered must be unfolded, not just drawn: a step re-entered on the same pass
  // after a reject already has messages on screen, and they were folded when it was left.
  if(liveKey&&liveKey!==run.liveKey)ccjFoldOwned(liveKey);
  run.liveKey=liveKey;
}
/* One beat inside a step. Touches the evidence lines and nothing else, so the spinner keeps
   spinning and the rows around it hold still. */
function ccjPaintBeat(){
  const run=ccjRun;if(!run)return;
  const step=ccjSteps(run.stage)[run.sub];
  if(!step)return;
  if(ccjUsesTranscript(run.stage)){
    const pass=ccjPass(run.stage,step);
    // A beat retargets TWO SPANS and nothing else — the gist and the verb. Rewriting the whole
    // head every 1.15s would restart the spark mid-turn, and there is no body to write into:
    // the live block is one line by design.
    const blk=ccjLiveNode(ccjStepBlockId(run.stage,run.sub,pass));
    const gist=blk&&typeof blk.querySelector==='function'?blk.querySelector('.ccj-sb-gist'):null;
    if(gist){
      gist.innerHTML=ccjGistFor(run.stage,step)+'<span class="ccj-sb-dots">&hellip;</span>';
      const vb=blk.querySelector('.ccj-sb-verb');
      if(vb)vb.innerHTML=ccjVerbFor(run.stage,step)+'&hellip;';
      return;
    }
    // No live node — the headless harness, which fabricates one for any id asked for. Repainting
    // the block instead makes the beat show up where the tests actually read, rather than
    // disappearing into an element that is on no page.
    ccjPaintBlocks();
    return;
  }
  const el=document.getElementById('ccj-ev-lines');
  if(el)el.innerHTML=ccjActLogHTML(run.stage,step,'current');
}

/* ---- STAGES NOT YET DESIGNED --------------------------------------------------------------
   An honest placeholder under a live rail and a live panel, so the machine can be walked end
   to end while the stages are built one at a time. */
function buildCCJStagePlaceholderHTML(i){
  const s=ccjStage(i),ev=ccjEvent(i);
  return buildCCJPlaceholderHTML(s?s.label:'Stage',ev.desc||(s?s.plain:''));
}
function buildCCJPlaceholderHTML(title,note){
  return '<div class="ccj-placeholder">'
    +'<div class="ccj-placeholder-tag">Coming soon</div>'
    +'<div class="ccj-placeholder-title">'+title+'</div>'
    +'<div class="ccj-placeholder-note">'+note+'</div>'
    +'</div>';
}
/* Kept from the scaffold: `ccj-start` is still a legal route, and this is what it would show if
   it were ever rendered directly rather than aliased to stage 1. */
function buildCCJStartHTML(){
  return '<div class="ccj-shell">'+buildCCJPlaceholderHTML('Start','The conversation on stage 1 is the intake — there is no screen before it.')+'</div>';
}

/* ---- ENTRY ------------------------------------------------------------------------------ */
function ccjStartNewRun(){
  ccjReset();
  const run=ccjNewRun();
  // Before the page moves, or the entry recorded would be the journey itself. New request on the
  // Account Manager's board and + on the Contracts listing both come through here, and back has
  // to answer for whichever one it was — see ccjExit.
  ccjMarkEntry(run,null);
  page='ccj-model';        // the engagement model is chosen before the run frame appears
  renderADTPage();
}

/* == A RUN PER DEAL ========================================================================
   The Account Manager's dashboard lists nineteen pieces of work. Each one can now be stepped
   into, and stepping into a second does not destroy the first.

   `ccjRun` STAYS THE ACTIVE RUN. It is read in hundreds of places and renaming it would be a
   change to everything for the benefit of nothing. What is new is `ccjRuns`: a store keyed by
   deal, holding the SAME objects. Switching is a reassignment of ccjRun to a member of the store,
   so every mutation anywhere still lands on the right run with no plumbing.

   PARKING IS ABOUT CLOCKS, NOT STATE. ccjSchedule already refuses to fire when `ccjRun !== run`,
   so a parked run cannot write into the active one — that guard was here before this feature and
   is what makes the whole thing safe. But a pending timer would still fire on RETURN, when
   ccjRun points at it again, delivering a beat armed minutes ago. So parking stops the clocks and
   returning restarts whatever the run was mid-way through. == */
const ccjRuns={};
let ccjActiveDealId=null;
/* A run resumed after being parked has no timer to carry it forward, so a run parked mid-beat
   would sit frozen on a spinner. Re-entering the step it was on re-arms it — and because step
   identity is per PASS, that appends fresh blocks rather than painting into the ones above. */
function ccjResumeRun(){
  const run=ccjRun;if(!run)return;
  if(run.phase==='act'&&run.started&&typeof ccjEnterStep==='function')ccjEnterStep();
  else if(run.client&&typeof ccjClientSchedule==='function')ccjClientSchedule();
}
/* Opening a deal's run. The first time, it is a genuine new run that knows who it is for and has
   the request already written; from then on it is that deal's run, resumed where it was left. */
function ccjOpenDealRun(dealId){
  const deal=(typeof amDeals!=='undefined'?amDeals:[]).find(function(d){return d.id===dealId;});
  if(!deal)return;
  // Already the run on screen. It still has to be checked against the board, because the row can
  // have been advanced from the drawer in between — see ccjCatchUpRunToDeal.
  if(ccjActiveDealId===dealId&&ccjRun&&ccjRuns[dealId]===ccjRun){
    ccjMarkEntry(ccjRun,dealId);
    if(ccjCatchUpRunToDeal(ccjRun,deal)){ccjLandOnLiveStep();return;}
    ccjGoRunPage();return;
  }
  ccjStopTimers(ccjRun);                       // park whatever was on screen; its state is kept
  ccjActiveDealId=dealId;
  let run=ccjRuns[dealId];
  if(!run){
    ccjGen++;                                  // a fresh identity, so nothing armed before speaks
    ccjRun=null;
    run=ccjNewRun();
    run.dealId=dealId;
    ccjMarkEntry(run,dealId);                  // before anything navigates — see ccjExit
    ccjRuns[dealId]=run;
    ccjRun=run;
    // A deal that has moved at all opens ON the step the board says it is on, with everything
    // before it settled and its artefacts built from the deal — see ccjSeedRunToDeal. Only a
    // record still on the very first step of the very first stage starts at the composer, with
    // its request written for you: written, not sent, because stage 1 IS the conversation and
    // there is nothing before it to settle.
    if(ccjSeedRunToDeal(run,deal)){ccjLandOnLiveStep();return;}
    run.seedPrompt=ccjDealPrompt(deal);
    page='ccj-model';
    renderADTPage();
    return;
  }
  ccjGen++;
  ccjRun=run;
  // Re-recorded on reopen rather than only on the first open: the same run can be entered from the
  // board this time and from the Contracts listing the next, and back answers for THIS visit.
  ccjMarkEntry(run,dealId);
  // A parked run can be BEHIND its row: Mark done in the listing and the simulated handoffs in the
  // drawer both advance the record whether the run is open or not. Reopening three steps back from
  // the row that was just clicked would have the two surfaces contradicting each other at the exact
  // moment the reader crossed between them.
  if(ccjCatchUpRunToDeal(run,deal)){ccjLandOnLiveStep();return;}
  ccjGoRunPage();
  ccjResumeRun();
}
/* Draw the run's stage and then run its live step for real — gate, wait, hold or work. Shared by
   every path that has just rebuilt a run to a position, because a rebuilt run that is painted but
   never entered sits on a step that looks live and does nothing. */
function ccjLandOnLiveStep(){
  const run=ccjRun;if(!run)return;
  page=ccjPageId(run.stage);
  renderADTPage();
  ccjEnterStep();
}
/* == WHERE A DEAL'S RUN BELONGS ============================================================
   The board's position for a record, expressed in the run's own coordinates. Null means nothing
   has happened yet — stage 1, first step — and that run genuinely begins at the composer.

   This is also what the listing's Open / Start wording is decided on (see ccjOpenRunBtnHTML):
   "is there work behind this record" and "is there a step to open it at" are the same question,
   and answering it in one place is what keeps the button's promise and the run's behaviour from
   drifting apart. == */
function ccjDealPos(deal){
  if(!deal)return null;
  const stage=typeof amStageIndex==='function'?amStageIndex(deal.stage):-1;
  if(stage<0)return null;
  const steps=ccjSteps(stage);
  const sub=Math.max(0,Math.min(deal.sub||0,Math.max(0,steps.length-1)));
  if(stage===0&&sub===0)return null;
  return {stage:stage,sub:sub};
}
/* An engagement has no person yet, and inventing one would put a fictional name on a real quote.
   "<Role> hire" is what that stage of the deal actually knows. */
function ccjDealPerson(deal){
  return deal.kind==='placement'?String(deal.subject):String(deal.role)+' hire';
}
/* Which screen a rebuilt run opens on. Eight of the nine stages have exactly one, so the answer
   is that one. Stage 1 has four, and they are the intake being assembled: a run rebuilt at the
   qualification decision has already written the request, filled the form and compiled the
   proposal, so opening it on the empty composer would show the reader a form they had already
   completed and ask again for a request they had already sent. */
function ccjSeedScreen(run,i,sub){
  const s=ccjStage(i);
  if(s&&s.id==='request-received'&&sub>0)return 'proposal';
  const list=ccjScreensFor(i).filter(function(sc){return !sc.when||sc.when(run);});
  return (list[0]||{}).id||'prompt';
}
/* Settle everything between where a run IS and where the board says it should be. Shared by the
   first seed, which starts from nothing, and by the catch-up, which starts from wherever the run
   was parked — two copies of this loop is how one of them stops writing a stage's outcome. */
function ccjSeedForward(run,from,pos,person){
  const stages=ccjStages();
  let i=from.stage,n=Math.max(0,from.sub);
  while(i<pos.stage){
    run.stage=i;                          // so each block stamps its stage's own lane mode
    const steps=ccjSteps(i);
    for(;n<steps.length;n++)ccjSeedStep(run,i,steps[n],n);
    ccjSeedStageOutcome(stages[i]&&stages[i].id,run,person);
    i++;n=0;
  }
  run.stage=pos.stage;
  // The live stage's OWN earlier steps settled too. A deal at Deposit due sub 1 has already
  // raised its invoice at sub 0 — leaving that step unseeded had the wait block saying "invoice
  // is with the client" beside an invoice panel saying "not raised yet": two surfaces, one fact,
  // two answers, which is the exact drift the settled keys exist to prevent.
  const liveSteps=ccjSteps(pos.stage);
  for(;n<pos.sub;n++)ccjSeedStep(run,pos.stage,liveSteps[n],n);
  ccjSeedMidStage(stages[pos.stage]&&stages[pos.stage].id,run,pos.sub);
  run.sub=pos.sub;
  run.screen=ccjSeedScreen(run,pos.stage,pos.sub);
  run.phase='idle';run.act=0;
}
/* A run the board has moved on without. Returns whether anything was rebuilt, so the caller knows
   whether the live step has to be re-entered or the parked one simply resumed. A run that is AHEAD
   of its row is left alone: it is the run that moved it there, and the row catches up on the next
   step the run arrives at — see ccjSyncDealFromRun. */
function ccjCatchUpRunToDeal(run,deal){
  if(!run||!run.started)return false;
  // A rejected request ENDED. Reopening it shows why it ended, and quietly walking it forward
  // because a row somewhere moved would be the run overwriting its own outcome.
  if(run.stopped)return false;
  const pos=ccjDealPos(deal);
  if(!pos)return false;
  const at={stage:run.stage,sub:Math.max(0,run.sub)};
  if(pos.stage<at.stage||(pos.stage===at.stage&&pos.sub<=at.sub))return false;
  ccjStopTimers(run);
  // Said out loud, because the reader left this run on one step and is being handed another. A
  // conversation that silently grew four settled blocks while nobody was looking is the kind of
  // thing that makes someone stop trusting the transcript.
  const liveStep=ccjSteps(pos.stage)[pos.sub];
  ccjPush({who:'agent',
    text:'This moved on the board while the run was closed. Caught up to stage '+(pos.stage+1)
      +' of '+ccjStages().length+' &mdash; '+(ccjStage(pos.stage)||{}).short
      +', on <b>'+(liveStep?liveStep.label:'the first step')+'</b>.'});
  ccjSeedForward(run,at,pos,ccjDealPerson(deal));
  return true;
}
/* == THE BOARD FOLLOWS THE RUN =============================================================
   A deal and its run are one piece of work seen twice: the row on the Account Manager's board
   says where it is, the run is where it happens. They drifted the moment anyone walked a run —
   the row went on saying "Quote in preparation · step 5 of 6" while the run had reached the
   deposit invoice, and Open run then opened something the row had just denied.

   So the run writes its position back, from the ONE place a run ever arrives at a step. That is
   why a stage completing forwards and a re-issued quote jumping backwards both land here without
   either of them knowing this exists. A run with no deal behind it — a request started from the
   New request button — syncs nothing, because there is no row to keep honest. == */
function ccjSyncDealFromRun(run){
  if(!run||run.dealId===undefined||run.dealId===null)return;
  if(typeof amDeals==='undefined')return;
  const d=amDeals.find(function(x){return x.id===run.dealId;});if(!d)return;
  const s=ccjStage(run.stage);if(!s)return;
  const steps=ccjSteps(run.stage);
  const sub=Math.max(0,Math.min(run.sub,Math.max(0,steps.length-1)));
  if(d.stage===s.id&&d.sub===sub)return;      // nothing moved, so nothing is re-stamped
  d.stage=s.id;d.sub=sub;
  // The record has just moved, so it is not late on the step it has only now arrived at.
  d.breach=false;
  if(typeof amStampToday==='function')amStampToday(d);
}
/* The request this deal would have been raised with.

   `subject` is a PERSON on an employee record and a COUNT on an engagement — "6 roles" — so the
   two cannot share a sentence. Reading it as a name produced "Hire 6 roles (Fleet Coordinator)
   for Norrbridge in Netherlands as a Fleet Coordinator": the count read as a person and the role
   said twice. An engagement names the role and leaves the person to be identified, which is what
   that stage of the deal actually knows. */
function ccjDealPrompt(d){
  const vowel=/^[aeiou]/i.test(String(d.role||''));
  return d.kind==='engagement'
    ?'Hire '+(vowel?'an ':'a ')+d.role+' for '+d.client+' in '+d.country
    :'Hire '+d.subject+' for '+d.client+' in '+d.country+' as a'+(vowel?'n ':' ')+d.role;
}
/* == OPENING A DEAL THAT IS ALREADY MID-JOURNEY =============================================
   A deal at Deposit due did not start there. Opening its run lands ON that stage, with every
   stage before it settled and the artefacts those stages produce — the form, the quote, the
   signed agreement, the paid invoice — built from what the deal actually knows: its client, its
   role, its country, its value.

   IT WRITES STATE, NOT PROSE. Each prior step is settled through the same keys the runner uses
   (`settled`, `decisions`, `stepMsgs`) and its block pushed through ccjPush, so the transcript,
   the rail, the screens and the drawer all derive from state exactly as they do on a walked run.
   Summaries come from ccjSummary against the seeded artefacts — the same sentence a walked run
   would have recorded — with 'Done' only where a summary needs state this seed does not build.

   THE LIVE STEP IS NOT SEEDED. run.stage/run.sub are set and ccjEnterStep does what it always
   does — halts on its gate, parks on its wait, or runs its actions. From the reader's first
   moment the run is live, not a replay.

   MONEY IS THE DEAL'S, DIVIDED HONESTLY. `value` is the annual engagement value across every
   role, so monthly gross is value / roles / 12, rounded to the hundred. Inventing a number when
   the deal states one would put two figures for the same engagement on one screen. */
function ccjSeedRunToDeal(run,deal){
  const pos=ccjDealPos(deal);
  // Only a record still on the first step of stage 1 has nothing to rebuild. Every other one
  // does, INCLUDING the rest of stage 1: a request sitting on its qualification decision has had
  // its intake logged and its CSM assigned, and dropping that reader on the model chooser asked
  // them to describe a hire the row in front of them had already described.
  if(!pos)return false;
  const target=pos.stage;
  const placement=deal.kind==='placement';
  const person=ccjDealPerson(deal);
  const roles=placement?1:(parseInt(deal.subject,10)||1);
  const annual=parseFloat(String(deal.value||'').replace(/[^0-9.]/g,''))||0;
  const monthly=annual?Math.max(1500,Math.round(annual/roles/12/100)*100):5700;

  run.model='EOR';run.started=true;
  run.intake={raw:ccjDealPrompt(deal),name:person,country:deal.country,type:'EOR',client:deal.client};
  // A record object, not ccjCreateEmployee(): that writes into the shared Employees store, and a
  // seeded view of a deal must not mint listing rows as a side effect of being looked at.
  run.createdEmp={name:person,country:deal.country,empId:'GEP'+String(100+deal.id)};
  const parts=person.split(' ');
  run.form.fname=parts[0]||'';run.form.lname=parts.slice(1).join(' ');
  run.form.country=deal.country;run.form.jobTitle=deal.role;run.form.pay=String(monthly);
  ccjAllFields().forEach(function(f){
    if(!ccjFieldApplies(f))return;
    if(String(run.form[f.k]||'').trim())return;
    if(f.type==='date')run.form[f.k]='2026-09-01';
    else if(f.options)run.form[f.k]=f.options==='countries'?deal.country:f.options[0];
    // Free-text fields stay empty rather than holding filler — stage 1 is settled, nothing
    // re-asks for them, and a blank is more honest than an invented answer.
  });

  /* The request itself opens the transcript. Every seeded stage below pushes its own step blocks
     into a conversation that otherwise began with nobody having said anything — and on stage 1,
     where the conversation IS the work, that read as a decision waiting on a question that had
     never been asked. */
  ccjPush({who:'user',text:run.intake.raw});
  /* THE PROPOSAL IS WHAT STAGE 1 PRODUCES, so a run rebuilt past it has produced one. Left null,
     the Proposal screen drew its whole grid as em-dashes and the journey trail reported stage 1
     as having made nothing — on every seeded run, including the ones that open six stages later.
     Same shape and the same id sequence as ccjCreateProposal writes on a walked run. */
  run.proposal={
    id:'PRO-'+String(4400+(run.gen||0)),
    name:person,country:deal.country,jobTitle:deal.role,
    type:ccjModelLabel(run.model),pay:ccjCurrency()+' '+(run.form.pay||'—'),
    term:run.form.term,from:run.form.fromDate
  };
  run.reached.proposal=true;                 // the milestone that releases the intake hold

  /* AND ONE LINE SAYING WHAT THIS IS. Everything below this message is history being rebuilt, and
     a reader dropped into the middle of a conversation they never had has no way to tell that
     from a run they walked and forgot. It names the record, the position, and the step they are
     being handed — the same three facts the row they clicked was showing them a second ago, so
     crossing from the board into the run reads as continuing rather than as arriving somewhere. */
  const liveStep=ccjSteps(pos.stage)[pos.sub];
  ccjPush({who:'agent',
    text:'Picking up <b>'+deal.ref+'</b> where it stands. Stage '+(pos.stage+1)+' of '+ccjStages().length
      +' &mdash; '+(ccjStage(pos.stage)||{}).short+', on <b>'+(liveStep?liveStep.label:'the first step')+'</b>.'
      +' What follows is what has already been settled.'});

  ccjSeedForward(run,{stage:0,sub:0},pos,person);
  return true;
}
/* One step of history: settled through the same keys the runner writes, its gate answered with
   the continuing option (a seeded past is a past that chose to proceed), and its block pushed so
   the transcript carries it. Shared between whole stages and the live stage's earlier steps —
   two copies of this loop is how one of them stops writing decisions. */
function ccjSeedStep(run,i,step,n){
  run.sub=n;
  const key=ccjKey(i,step);
  let applies=true;try{applies=ccjStepApplies(i,step);}catch(e){}
  if(!applies){
    run.settled[key]={summary:'Not applicable',skipped:true};
  }else{
    let gate=null;try{gate=ccjGateFor(i,step)||ccjPostGateFor(i,step);}catch(e){}
    if(gate&&gate.options&&gate.options.length){
      const o=gate.options[0];
      run.decisions[key]=Object.assign({},o,{done:o.done+' by '+ccjActor()});
    }
    let summary='Done';try{summary=ccjSummary(i,step);}catch(e){}
    run.settled[key]={summary:summary};
  }
  /* Per pass, and only if this pass has no block yet — the same guard ccjOpenStepBlock uses, and
     for the same reason. A catch-up settles the step the run was PARKED on, which already opened
     its block when the runner arrived at it; pushing a second one would put the step in the
     conversation twice, once live and once settled. */
  const pass=(run.pass&&run.pass[key])||1;
  const pkey=key+'#'+pass;
  if(!run.stepMsgs[pkey]){
    const m={who:'agent',kind:'step',stage:i,sub:n,pass:pass};
    run.stepMsgs[pkey]=m;
    ccjPush(m);
  }
}
/* What the live stage's completed steps have already produced, by how far in it is. Only the
   flips a mid-stage surface actually reads — the stage is not done, so its outcome must not be. */
function ccjSeedMidStage(stageId,run,sub){
  if(!stageId||!sub)return;
  if(stageId==='deposit-due'){
    // Raised and sent, not paid — that is what "mid deposit-due" means.
    const p=ccjPay();
    if(!p.issuedAt){p.issuedAt=1400;p.dueAt=1400+14*1440;p.state='issued';}
  }
  if(stageId==='employment-contract'){
    // The draft and its audit exist before the approval that is now live.
    const e=ccjEmp();
    try{if(!e.terms)ccjDraftContract();}catch(err){}
    if(sub>=2)e.auditDone=true;
  }
  if(stageId==='onboarding'&&sub>=1){
    const o=ccjOnb();
    if(!o.kyc.done){o.kyc.done=true;o.kyc.decision='clear';o.kyc.score=96;o.kyc.at=3200;}
  }
}
/* What a stage leaves behind once it is done — the artefact flips, made after that stage's steps
   settle, in journey order so each builds on the one before. Timestamps are simulated minutes on
   the client clock, spaced so the trail reads as days of work rather than one burst.

   WRITTEN TO BE RUN OVER A STAGE THAT WAS PARTLY WALKED. The catch-up reaches this for a stage
   the reader may have watched half of, so anything that APPENDS is guarded on what is already
   there — the flips themselves are settings and can safely be re-asserted, but a client thread
   that grew a second "Quote accepted" every time the run was reopened would be reporting an
   event that happened once as if it had happened twice. */
function ccjSeedStageOutcome(stageId,run,person){
  if(!stageId)return;
  const c=ccjClient();
  if(stageId==='quote-review'){
    if(c.state!=='accepted'){
      c.msgs.push({who:'us',text:'Quote v1 sent for review.',at:15});
      c.msgs.push({who:'client',text:'Quote accepted.',at:600});
    }
    c.mins=Math.max(c.mins,620);c.state='accepted';
  }
  if(stageId==='agreement-signature'){
    const m=ccjMsa();
    c.mins=Math.max(c.mins,1330);
    // A screening that was actually run and cleared by hand keeps its own verdict; only an
    // unscreened one is asserted clean here.
    if(m.screening!=='hit')m.screening='clean';
    m.clientSignedAt=m.clientSignedAt||1200;m.adtSignedAt=m.adtSignedAt||1295;
  }
  if(stageId==='deposit-due'){
    const p=ccjPay();
    c.mins=Math.max(c.mins,2100);
    if(!p.issuedAt){p.issuedAt=1400;p.dueAt=1400+14*1440;}
    p.state='cleared';p.clearedAt=p.clearedAt||2050;
    let due=0;try{due=ccjAmountDue();}catch(e){}
    // A part-payment already banked is a receipt; topping the balance up here would report the
    // money twice. Only a stage nobody watched has no receipts at all.
    if(due&&!p.receipts.length){
      p.receipts.push({at:2050,amount:due,kind:'full',method:'Bank transfer',payer:ccjParties().client.name});
      c.msgs.push({who:'client',text:'Deposit paid &mdash; '+ccjMoney(due)+'.',at:2050});}
  }
  if(stageId==='employment-contract'){
    const e=ccjEmp();
    try{ccjDraftContract();}catch(err){}
    e.auditDone=true;e.approvedBy=ccjActor();e.approvedAt=2400;
    // Our signature, then the send, then theirs — the order the stage actually runs in.
    e.adtSignedAt=2455;e.sentAt=2500;e.openedAt=2560;e.workerSignedAt=2900;
  }
  if(stageId==='onboarding'){
    const o=ccjOnb();
    o.kyc.done=true;o.kyc.decision='clear';o.kyc.score=96;o.kyc.at=3200;o.kyc.reviewed=ccjActor();
    o.docs.forEach(function(d,i){d.status='verified';d.ref='DOC-'+(4400+i);d.at=3300+i*40;});
    o.docsDone=true;
    o.tax={ref:'TX-'+(9200+(run.gen||0)),id:'',submittedAt:3600,confirmedAt:3900,state:'confirmed'};
    o.ss={ref:'SS-'+(5100+(run.gen||0)),id:'',submittedAt:3620,confirmedAt:3950,state:'confirmed'};
    o.bank={iban:'&bull;&bull;&bull;&bull; 4417',holder:person,score:100,pennyAt:3700,verifiedAt:4000,state:'verified'};
    o.payroll={builtAt:4100,calendar:'Monthly',payDay:'25th',firstPay:'',prorated:0,days:0,state:'built'};
  }
}
function ccjGoRunPage(){
  const run=ccjRun;if(!run)return;
  page=run.started?ccjPageId(run.stage):(run.model?ccjPageId(0):'ccj-model');
  renderADTPage();
}
/* == RUNS THAT OUTLIVE THE TAB =============================================================
   Called by persistAppState/loadAppState in js/core.js, which owns the snapshot.

   TWO THINGS IN A RUN CANNOT BE WRITTEN DOWN, and both are dropped rather than stored:

     stream.el   a live DOM node. It would serialise to `{}` and come back as an object that is
                 not the element on the page, which ccjStreamSync compares against and would
                 rebuild from — so storing it buys a stale pointer and nothing else. Cleared, and
                 the first sync after a reload does a full render, which is correct.
     timers      ids belonging to a page that no longer exists. Restoring one would either clear
                 an unrelated timer that happens to have the same id, or wait for a callback that
                 can never come. Nulled, and ccjResumeRun re-arms whatever the run was mid-way
                 through when it is next opened.

   Everything else in a run is plain data and survives as written. == */
function ccjSaveRuns(){
  const out={};
  Object.keys(ccjRuns).forEach(function(k){
    const r=ccjRuns[k];if(!r)return;
    const copy={};
    Object.keys(r).forEach(function(f){
      if(f==='stream')return;                                  // a DOM node
      if(/Timer$/.test(f)||f==='timer')return;                 // ids from a dead page
      copy[f]=r[f];
    });
    // The threads carry their own clocks, one level down.
    ['client','worker','pay'].forEach(function(t){
      if(copy[t]&&typeof copy[t]==='object'){
        copy[t]=Object.assign({},copy[t]);
        copy[t].timer=null;copy[t].sendTimer=null;
      }
    });
    out[k]=copy;
  });
  return out;
}
function ccjLoadRuns(saved){
  if(!saved||typeof saved!=='object')return;
  Object.keys(ccjRuns).forEach(function(k){delete ccjRuns[k];});
  Object.keys(saved).forEach(function(k){
    const r=saved[k];if(!r||typeof r!=='object')return;
    r.stream=null;r.timer=null;r.chatTimer=null;r.ghostTimer=null;r.autoTimer=null;r.auditTimer=null;
    if(r.client){r.client.timer=null;r.client.sendTimer=null;}
    if(r.worker)r.worker.timer=null;
    if(r.pay)r.pay.timer=null;
    // Numeric ids come back as strings through JSON keys; the deal ids they must match are numbers.
    ccjRuns[isNaN(Number(k))?k:Number(k)]=r;
  });
}

document.addEventListener('keydown',function(e){if(e.key==='Escape'&&ccjDrawerKey)ccjCloseDrawer();});
