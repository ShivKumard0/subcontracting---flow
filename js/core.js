
// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ STATE ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
let view='adt',mode='agent',page='dashboard',agent='contractor',adtSidebarCollapsed=false,agentSidebarCollapsed=true,notifOpen=false,notifShowUnread=true,agentMsgs=[{role:'bot',text:"Hi John! I'm your ADT Agent. What would you like to do today?"}],formStep=-1,returnToReview=false,cw=360,selectedAIJourneyId='contract-creation',aiEventDrawerIdx=-1;
// -- PORTAL ROLE (Super Admin / Entity Admin / Entity User) --
let portalRole='super-admin',userDDMode='main';
let activePersonaId='planner';
/* Empty rather than 'employee': buildDashboardPageHTML already falls back to the first tab the
   role actually has when the current one is not in its list, so starting empty makes every role
   land on its own first tab. Hardcoding 'employee' silently pinned Super Admin to the employee
   view, because 'employee' is a legitimate tab for that role too — the guard had nothing to
   catch. Any explicit choice the user makes is still restored per persona from session state. */
let dashboardTab='';
let salesOpenDealsOpen=false;
let salesTeamQueueOpen=false;
let complianceContractQueueOpen=false,complianceHubItemsOpen=false,complianceSupportItemsOpen=false;
let aiContractPrefill=null,aiAssistedFlow=false,aiCtNotFoundOpen=false,aiProposalDraft=null,aiCtChatMsgs=[],aiWizardFormData={},aiCreatedContractId=null;
const aiDealManager={name:'Karan Mehta',role:'Deal Manager',initials:'KM'};
const aiOpsManager={name:'Priya Nair',role:'Ops Manager',initials:'PN'};
let aiCtAnimatedStage=-1,aiCtPendingEmpType='',aiCtJourneyEmployee=null,aiCtJourneyIsSimulated=false;
// Which engagement model the run is being created under (EOR / PEO / CONTRACTOR). Chosen on the
// step-1 intake screen before the assistant opens, then carried as context on every later step.
let aiCtTypeChoice='';
let aiCtPendingField=null,aiCtQuestionsStarted=false;
const aiPayrollManager={name:'Meera Iyer',role:'Finance Approver',initials:'MI'};
const aiHrManager={name:'Pallavi Parate',role:'HR Manager',initials:'PP'};
let aiPayrollAnimatedStage=-1,aiPayrollData={};
// The Bhaiyaa store journey's rail animation state, kept apart from the others for the same
// reason they are kept apart from each other: the bar only animates a stage it has not drawn
// before, and a shared counter would make one journey's progress suppress another's.
let aiStoreAnimatedStage=-1;
let aiH2rAnimatedStage=-1,aiH2rData={},aiH2rOffboardStep=-1;
// -- Agent Mode: chat-driven journey run (typed prompt -> live journey execution in form-col) --
let pendingAgentAttachment=null,agentUploadTargetId=null,agentRunData=null;
/* == THE PERSONA LIST LIVES IN js/subcontracting.js ======================================
   Declared empty here and filled by that file, which owns the eleven Sub-Contracting roles
   that replaced the nine enterprise personas. Two reasons it is not simply defined here:
   the roles carry scSteps — the journey steps each one owns, which is what greys the
   dashboard tiles — and that field means nothing outside that journey; and keeping them
   together with the journey means the whole thing is removable in one file.

   let, not const, purely so subcontracting.js can assign it. Nothing reads this array
   at load time — getActivePersona and the switcher both run at render time, and
   renderer.js, which triggers the first render, loads after subcontracting.js. == */
let enterprisePersonas=[];
function getActivePersona(){return enterprisePersonas.find(function(p){return p.id===activePersonaId;})||enterprisePersonas[0];}
function personaByLabel(label){return enterprisePersonas.find(function(p){return p.label===label;});}
function manualStepOwnerPersonaId(ownerRole){const p=personaByLabel(ownerRole);return p?p.id:null;}
// -- Resolve a "requestedBy" string (e.g. "HR" or "Priya Nair (Entity Admin)") into a displayable profile --
function requesterProfile(requestedBy){
  const persona=personaByLabel(requestedBy);
  if(persona)return{initials:persona.initials,name:persona.name,role:persona.label};
  const m=/^(.+?)\s*\((.+)\)$/.exec(requestedBy||'');
  const name=m?m[1]:(requestedBy||'Unknown');
  const role=m?m[2]:'';
  const initials=name.split(/\s+/).filter(Boolean).map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()||'?';
  return{initials:initials,name:name,role:role};
}
function activePersonaJourneyIds(){return (getActivePersona().journeys||[]).slice();}
function activePersonaCanAccessJourney(journeyId){
  if(portalRole!=='entity-user')return true;
  return activePersonaJourneyIds().indexOf(journeyId)>=0;
}
function setActivePersona(id){
  if(!enterprisePersonas.some(function(p){return p.id===id;}))return;
  setPortalRole('entity-user',true,id);
}
const aiH2rOffboardSteps=[
  {label:'Access Revocation',running:'Revoking system access…',type:'ai'},
  {label:'Final Settlement Calculation',running:'Calculating final settlement…',type:'ai'},
  {label:'Exit Compliance Checks',running:'Running exit compliance checks…',type:'ai'}
];
// -- H2R: statutory/compliance reference per country, keyed to match parseAIRunPrompt's supported countries --
const aiH2rCountryData={
  'India':{rateRules:'PF 12% + ESI 3.25% + Gratuity 4.81% of basic salary',statutory:'PF Registration, ESI, Professional Tax, Gratuity',taxBand:'Slab-based, 0%–30% (old/new regime)'},
  'Netherlands':{rateRules:'Employer Social Security ~23% + Holiday Pay 8%',statutory:'AOW/WW/WAO, Pension Contribution, 30% Ruling (if eligible)',taxBand:'Box 1 income tax, 36.97%–49.5%'},
  'Germany':{rateRules:'Social contributions ~19.4% of gross salary',statutory:'Rentenversicherung, Krankenversicherung, Pflegeversicherung, ALV',taxBand:'Progressive, 14%–45%'},
  'Spain':{rateRules:'Employer Social Security ~30% of gross salary',statutory:'Seguridad Social, IRPF withholding, Workplace Accident Insurance',taxBand:'Progressive, 19%–47%'},
  'United Kingdom':{rateRules:'Employer National Insurance ~13.8% above threshold',statutory:'National Insurance, Auto-enrolment Pension, PAYE',taxBand:'Progressive, 20%–45%'},
  'France':{rateRules:'Employer social charges ~40%–45% of gross salary',statutory:'URSSAF, Retraite Complémentaire, Mutuelle',taxBand:'Progressive, 0%–45%'},
  'Italy':{rateRules:'Employer contributions ~29%–32% of gross salary',statutory:'INPS, INAIL, TFR (severance provision)',taxBand:'Progressive IRPEF, 23%–43%'}
};
let selectedAIRunId='RUN-2001';
let aiRunDetailBackTo=null;
let navStack=[];
let personaSessionState={};
function currentSessionKey(){return portalRole==='entity-user'?'entity-user:'+activePersonaId:portalRole;}
let mtReqSelectedId=null,mtReqTab='journeys';
let mtTaskSelectedRunId=null;
let aiClientSelectedId=null,aiClientTab='journeys';
/* Which of the client's journeys has its step configuration OPEN in the sidebar, or null for the
   list. The panel used to print every journey's nine steps and eighteen toggles inline, so a
   client with three journeys was a wall of controls with no way to see what they had — the list
   answered "how is step 4 of journey 2 set" at the cost of never answering "which journeys does
   this client have". Now the list summarises and this holds the one being edited. */
let aiClientConfigJourneyId=null;
let liveRunSeq=9000;
// -- NewForce Solutions live sync. The Client ID and the "what have we already seen" cursor are
// both minted by the backend now (see backend/server.js) rather than from counters kept here:
// two browsers running this page each had their own counter, so both issued the same id to
// different clients and each re-ingested submissions the other had already taken. The poll
// loop's on/off state (adtPollTimerId, js/pages.js) stays client-side and unpersisted, since a
// fresh page load always starts idle and must be re-armed. --
let aiJourneyDetailSelectedStage=-1;
let aiRunStatusFilter='';
const aiAutomationRuns={
  'user-master-data':[
    // -- currentStepIdx is an index into the three-step flow, so it tops out at 2. It read 2/3
    // back when the journey claimed four steps; leaving 3 here would point past the end. --
    {runId:'RUN-1001',client:'Meridian Retail Group',country:'India',contractType:'Enterprise',currentStepIdx:1,status:'Active',lastActivity:'25 minutes ago'},
    {runId:'RUN-1002',client:'Harbourline Freight',country:'Netherlands',contractType:'Growth',currentStepIdx:2,status:'Completed',lastActivity:'Yesterday'}
  ],
  'contract-creation':[
    {runId:'RUN-2001',client:'Rashi Singh',country:'Netherlands',contractType:'EOR',currentStepIdx:3,status:'Waiting for Approval',lastActivity:'3 hours ago'},
    {runId:'RUN-2002',client:'Rajdeep Singh',country:'Netherlands',contractType:'EOR',currentStepIdx:6,status:'Exception',lastActivity:'1 hour ago',exceptionNote:'Signed document could not be verified against the approved contract terms.'},
    {runId:'RUN-2003',client:'Emma Schmidt',country:'Germany',contractType:'EOR',currentStepIdx:7,status:'Completed',lastActivity:'2 days ago'}
  ],
  'payroll-creation':[
    {runId:'RUN-3001',client:'Testemp Antar',country:'India',contractType:'Direct Employee',currentStepIdx:3,status:'Waiting for Approval',lastActivity:'4 hours ago'},
    {runId:'RUN-3002',client:'Anika Shah',country:'India',contractType:'Direct Employee',currentStepIdx:2,status:'Exception',lastActivity:'45 minutes ago',exceptionNote:'Statutory rate mismatch detected during salary calculation — needs Finance review.'},
    {runId:'RUN-3003',client:'Pallavi Parate',country:'India',contractType:'Direct Employee',currentStepIdx:1,status:'Active',lastActivity:'20 minutes ago'}
  ],
  'h2r-lifecycle':[
    {runId:'RUN-4001',client:'Sofia Romano',country:'Italy',contractType:'Contractor',currentStepIdx:3,status:'Waiting for Approval',lastActivity:'6 hours ago'},
    {runId:'RUN-4002',client:'Lucas Dubois',country:'France',contractType:'EOR',currentStepIdx:3,status:'Exception',lastActivity:'2 hours ago',exceptionNote:'Compliance Hub could not return statutory requirements for France — missing country configuration.',contractRecordId:5},
    {runId:'RUN-4003',client:'James Wilson',country:'United Kingdom',contractType:'EOR',currentStepIdx:4,status:'Completed',lastActivity:'3 days ago'}
  ]
};

/* == ACCOUNT MANAGER — CLIENT-FACING PIPELINE ============================================
   The nine statuses the client actually sees, in the order they see them, split across the
   two tracks the work runs on: the engagement track happens once per client request, the
   placement track repeats for every hire made under a signed engagement. Stage 6 is a
   payment gate rather than a step — nothing downstream moves until the deposit clears — so
   it carries `gate` and renders differently from the eight stages that simply progress.

   Three labels per stage, because three audiences read this data. `label` is the client-
   facing wording, shown wherever the client's own view is being represented. `short` is the
   same state compressed to fit inside a status badge — the full sentences are far too long
   for a table cell. `internal` is what the Account Manager needs to know about the state,
   which the client is never shown. == */
/* Three names per stage, for three readers, and the reason they differ is the whole design:
     label  what the CLIENT is shown — verbatim from the operating model, never reworded here
     short  what WE call it in the app — plain English, no jargon, fits a narrow column
     plain  what it MEANS, in a sentence a new user can read without training
   The old short names failed the third test badly. "Requested / Quoting / In review /
   Approved / Signature / Contract / Active" gave a newcomer no way to tell which side was
   holding the work, and used two words ("Signature", "Contract") for two different signings
   by two different people. Naming the signer instead — "Client signing", "Worker signing" —
   removes that collision without a legend. */
const amPipelineStages=[
  {id:'request-received',   n:1,track:'engagement',tone:'blue', label:'Request received',                       short:'New request',    plain:'A client has asked us to find people. We are checking we can do it.',                    internal:'Intake logged, qualifying the requirement',       waitingOn:'Account Manager'},
  {id:'quote-prep',         n:2,track:'engagement',tone:'blue', label:'Quote in preparation',                   short:'Quote in preparation', plain:'We are working out the price, and checking the rules for that country.',                  internal:'Costing, margin and compliance check in progress',waitingOn:'Account Manager'},
  {id:'quote-review',       n:3,track:'engagement',tone:'amber',label:'Quote ready &mdash; your review',        short:'Quote sent',     plain:'The price is with the client. Nothing moves until they reply, so chase it.',              internal:'Quote sent, waiting on the client to review it',  waitingOn:'Client',clientAction:true},
  {id:'quote-approved',     n:4,track:'engagement',tone:'green',label:'Quote approved',                         short:'Quote accepted',plain:'The client agreed the price. We now set up their account.',                               internal:'Client accepted the commercials',                 waitingOn:'Account Manager'},
  {id:'agreement-signature',n:5,track:'engagement',tone:'amber',label:'Agreement ready &mdash; your signature', short:'Client signing', plain:'The contract between us and the client is waiting for their signature.',                 internal:'Agreement issued, waiting on client signature',   waitingOn:'Client',clientAction:true},
  {id:'deposit-due',        n:6,track:'placement', tone:'red',  label:'Deposit invoice due',                    short:'Deposit due',    plain:'We have invoiced the deposit. No hire can start until that money arrives.',              internal:'Placement is held until the deposit invoice clears',waitingOn:'Client',clientAction:true,gate:true},
  {id:'employment-contract',n:7,track:'placement', tone:'blue', label:'Employment contract in progress',        short:'Worker signing', plain:'The person being hired is signing their employment contract.',                           internal:'Contract generated and out for signature',        waitingOn:'Legal / Contracts'},
  {id:'onboarding',         n:8,track:'placement', tone:'blue', label:'Onboarding in progress',                 short:'Onboarding',     plain:'We are collecting their documents and setting them up to be paid.',                      internal:'Documents, compliance checks and payroll setup',   waitingOn:'HR'},
  {id:'active',             n:9,track:'placement', tone:'green',label:'Active',                                 short:'Working',        plain:'Done. They are employed and on payroll.',                                                internal:'Live and ready for payroll',                      waitingOn:'&mdash;',terminal:true}
];
/* "Engagement track" and "Placement track" are our words, not words a new user arrives with.
   Neither were "Winning the client" and "Placing each person", which named the ACTIVITY and
   left the reader to work out why the nine stages were split there at all. Each half is now
   named by the DOCUMENT it produces, because that is the fact that makes it a phase: the first
   half ends in one contract with the client and is never run again; the second ends in one
   employment contract per person and is run in full for every hire. `sub` states that rule and
   is rendered beside the name — the split stops needing a tooltip to be understood. */
const amPipelineTracks=[
  {id:'engagement',label:'Client contract',  sub:'Signed once per client',plain:'Pricing the request and signing the contract with the client. This happens once — no matter how many people they go on to hire under it.'},
  {id:'placement', label:'Worker onboarding',sub:'Runs for every hire',   plain:'Getting one named person contracted, onboarded and paid. This repeats in full for every single hire under that client.'}
];
/* == ADMIN SUB-STATUSES ==================================================================
   The operational steps inside each client-facing stage. These are INTERNAL and must never
   reach a client-visible surface — the sub-steps themselves are why. "Partner cost requested"
   discloses that we do not own the country and are sourcing through a partner. "Pricing
   approval (if off-standard)" discloses that the client was quoted off-book. "Client entity
   + sanctions check" discloses that they were screened. Each is commercially or legally
   sensitive on its own, so the client sees only the nine parent stages and never this layer.

   `owner` is per sub-step, not per stage, because that is what gates who may advance it. The
   source table gives compound owners for some stages ("EOR Ops · Pricing", "System · AM") and
   the split only makes sense at sub-step level: Pricing owns the pricing approval, EOR Ops
   owns the cost build. `cond` marks a step that only applies in some cases and renders muted,
   `decision` a branch point, `loop` a step that can legitimately repeat.

   `auto` marks a step the AI Execution Layer performs itself — `autoNote` says by what. The
   dividing line: lookups, generation from templates/data, dispatch, and webhook-confirmed
   facts automate; judgment, liability and signatures do not. So "CSM assigned" automates (a
   country-to-CSM routing table needs no human), but "Qualified / Rejected" never does —
   that is the one decision stage 1 exists to make. `owner` stays on auto steps on purpose:
   automation changes who does the work, not who answers for it. == */
/* == FEATURE SWITCHES =======================================================================
   Things that are built, work, and are deliberately not shown yet. A switch rather than a
   deletion, because deleting a feature to hide it means rebuilding it to show it again — and the
   thing that comes back is never quite the thing that went away.

   Everything behind a false flag stays whole: builders, handlers, styles and seeded data are all
   untouched and none of them are edited to hide it. Only the places that would PUT it in front of
   someone ask this question, so turning one back on is a single word here and nothing else. == */
const FEATURES={
  /* NOTES FROM ENTITY USER — the second-opinion escalation. An Entity User reviewing an approval
     can flag it for their Entity Admin, and the note surfaces on the admin's overview and My Tasks
     with a way back into the contract.

     Off at the owner's request, and off END TO END rather than just hidden on the page it is read:
     the button that raises a note goes too. Hiding only the inbox would have let people keep
     sending notes into a place nobody can see, which is worse than the feature being absent.

     To bring it back: set this to true. Nothing else. */
  notesModule:false
};
function featureOn(name){return !!(typeof FEATURES!=='undefined'&&FEATURES&&FEATURES[name]);}

/* == THE ENGAGEMENT MODEL, SAID ONCE ========================================================
   EOR, PEO and CONTRACTOR are three different legal relationships, and most of the paperwork this
   product generates has at least one sentence that is true for only one of them. Those sentences
   were written for EOR and then reused for all three, so a PEO placement printed "PEO — Employer
   of Record" on its own contract, and a contractor's proposal named us as their employer — the one
   thing a contractor engagement exists to avoid.

   The selection was never lost: the run carries it, and the record row stores it in `type` and
   `empType`. It was the RENDERING that assumed EOR. So this is one table, read by every surface
   that has to name the relationship, rather than a fourth copy of the same three-way branch.

   `{c}` in the prose is the country of operation, substituted by engagementProse. == */
const ENGAGEMENT_MODELS={
  EOR:{
    id:'EOR', short:'EOR', label:'Employer of Record',
    looking:'Employer of Record (EOR)',
    party:'Employee', personDesc:'EOR employee',
    employerKey:'Employer', employerVal:'OpenDhi Global Employment Services B.V.',
    contractTitle:'Employment Contract', proposalTitle:'Employer of Record Proposal',
    duties:'The Employee is engaged under the statutory employment framework of {c}. Payroll, tax withholding and social security contributions are administered by the Employer as Employer of Record on behalf of the Client.',
    scope:'OpenDhi will act as Employer of Record in {c}, issuing a compliant local employment contract, running payroll, withholding tax and social contributions, and filing all statutory returns for the duration of the engagement.'
  },
  PEO:{
    id:'PEO', short:'PEO', label:'Professional Employer Organization',
    looking:'PEO Services',
    party:'Employee', personDesc:'PEO employee',
    // The client keeps the employment relationship under a PEO — naming ourselves here would state
    // the opposite of what the model is.
    employerKey:'Employer', employerVal:'The Client &mdash; OpenDhi administers payroll and statutory filings under co-employment',
    contractTitle:'Employment Contract', proposalTitle:'PEO Services Proposal',
    duties:'The Employee is engaged under the statutory employment framework of {c}. The Client remains the legal employer; OpenDhi administers payroll, tax withholding, social security contributions and statutory filings under a co-employment arrangement.',
    scope:'OpenDhi will act as Professional Employer Organization in {c}, running payroll, withholding tax and social contributions and filing all statutory returns, while the Client remains the legal employer for the duration of the engagement.'
  },
  CONTRACTOR:{
    id:'CONTRACTOR', short:'Contractor', label:'Independent contractor',
    looking:'Contractor Management',
    // Not "Contractor employee" — the two words contradict each other, which is what gluing the
    // model id onto the word "employee" produced for this one.
    party:'Contractor', personDesc:'Independent contractor',
    employerKey:'Engaged by', employerVal:'OpenDhi Global Employment Services B.V. &mdash; no employment relationship arises',
    contractTitle:'Contractor Agreement', proposalTitle:'Contractor Engagement Proposal',
    duties:'The Contractor provides the services described above as an independent contractor in {c}. No employment relationship arises under this agreement, and the Contractor remains responsible for their own tax and social security obligations.',
    scope:'OpenDhi will engage the individual in {c} as an independent contractor, verifying their right to provide the services, holding the engagement agreement and processing their invoices for the duration of the engagement.'
  }
};
/* Unknown ids fall back to EOR because it is this platform's default engagement and every record
   predating the chooser is one — but the fallback is HERE, once, rather than as `||'EOR'` at each
   of the call sites, which is how three surfaces came to hardcode it in the first place. */
function engagementModel(id){
  return ENGAGEMENT_MODELS[String(id||'').toUpperCase()]||ENGAGEMENT_MODELS.EOR;
}
// "PEO — Professional Employer Organization". The expansion follows the id rather than being
// glued on after it.
function engagementLabel(id){
  const m=engagementModel(id);
  return m.short+' &mdash; '+m.label;
}
function engagementProse(id,key,country){
  return String(engagementModel(id)[key]||'').replace(/\{c\}/g,country||'the country of operation');
}

const amSubStatuses={
  'request-received':[
    {label:'New intake',owner:'Account Manager',auto:true,autoNote:'logged from intake form'},
    {label:'CSM assigned',owner:'Account Manager',sla:'1h',auto:true,autoNote:'by client country'},
    {label:'Qualified / Rejected',owner:'Account Manager',decision:true}
  ],
  'quote-prep':[
    {label:'Country data check',owner:'EOR Ops',auto:true,autoNote:'Compliance Hub lookup'},
    {label:'Partner cost requested',owner:'EOR Ops',cond:'non-owned countries',sla:'48h',auto:true,autoNote:'request auto-sent to partner'},
    {label:'Cost calc built',owner:'EOR Ops',sla:'24h',auto:true,autoNote:'drafted by cost engine'},
    {label:'Statutory floor check',owner:'Compliance',auto:true,autoNote:'rules engine'},
    {label:'Pricing approval',owner:'Pricing',cond:'if off-standard'},
    {label:'Quote QA',owner:'Pricing'}
  ],
  'quote-review':[
    {label:'Sent',owner:'Account Manager',auto:true,autoNote:'on QA pass'},
    {label:'Viewed',owner:'Client',auto:true,autoNote:'tracked on open'},
    /* "Follow-up 1 / 2 / 3" used to sit here, and it was the one sub-status that was not a
       position the work reaches — it was a thing the Account Manager DOES while the work stands
       still, on their own judgement, as many times as the deal deserves. Modelling it as a step
       meant the run had to walk through chasing before it could reach the client's answer, and a
       deal the client answered on first read still had to pass a row about reminders nobody sent.

       A chase moves nothing, so it is not a step. It is an action on the record, offered from the
       listing's run menu (see ccjRunMenuHTML) and written to the deal's log with the comment that
       was sent. The journey is what happened; a follow-up is something we did about it. */
    {label:'Change requested',owner:'Client',decision:true},
    {label:'Re-issued v2',owner:'Account Manager',loop:true}
  ],
  'quote-approved':[
    {label:'Won',owner:'Account Manager',auto:true,autoNote:'on client acceptance'},
    {label:'Client tenant provisioned',owner:'System',auto:true,autoNote:'provisioning'},
    {label:'CSM confirmed to client',owner:'Account Manager',sla:'Same day',auto:true,autoNote:'intro auto-sent'}
  ],
  'agreement-signature':[
    {label:'MSA drafted',owner:'Compliance',auto:true,autoNote:'from country template'},
    {label:'Legal & compliance review',owner:'Compliance',sla:'48h'},
    {label:'Client entity + sanctions check',owner:'Compliance',auto:true,autoNote:'screening API, human on hit'},
    {label:'Sent',owner:'Compliance',auto:true,autoNote:'e-sign dispatch'},
    {label:'Signed',owner:'Client'}
  ],
  'deposit-due':[
    {label:'Invoice raised',owner:'Finance',auto:true,autoNote:'on agreement signed'},
    {label:'Awaiting funds',owner:'Client'},
    {label:'Part-paid',owner:'Client',decision:true},
    {label:'Cleared',owner:'Finance',auto:true,autoNote:'bank webhook'}
  ],
  'employment-contract':[
    {label:'Draft generated',owner:'EOR Ops',sla:'24h to issue',auto:true,autoNote:'from approved quote'},
    {label:'Clause compliance check',owner:'Compliance',auto:true,autoNote:'AI clause check'},
    {label:'Internal approval',owner:'EOR Ops'},
    {label:'Sent to worker',owner:'EOR Ops',auto:true,autoNote:'via Docuseal'},
    {label:'Worker signed',owner:'Worker'},
    {label:'ADT countersigned',owner:'EOR Ops'}
  ],
  'onboarding':[
    {label:'Worker KYC',owner:'Onboarding Ops',auto:true,autoNote:'KYC provider'},
    {label:'Documents',owner:'Onboarding Ops',cond:'n/n per country'},
    {label:'Tax registration',owner:'Onboarding Ops'},
    {label:'Social security enrolment',owner:'Onboarding Ops'},
    {label:'Bank verified',owner:'Onboarding Ops',auto:true,autoNote:'penny-drop check'},
    {label:'Payroll configured',owner:'Payroll Ops',auto:true,autoNote:'from contract data'}
  ],
  'active':[
    {label:'Ready for payroll',owner:'Payroll Ops',auto:true,autoNote:'all onboarding gates green'},
    {label:'First payroll run',owner:'Payroll Ops',sla:'Per payroll calendar',auto:true,autoNote:'payroll engine'},
    {label:'Active',owner:'Payroll Ops',auto:true,autoNote:'after first run clears'}
  ]
};

/* == EVIDENCE FOR EACH SUB-STATUS ========================================================
   amSubStatuses says WHAT each step is and WHO owns it. This says what the machine actually
   did: which system it reached, what came back, which rule it checked, the verdict, and what
   it wrote to the record.

   It is a SEPARATE map keyed '<stageId>/<label>', never extra keys on amSubStatuses — the
   pipeline board, the deal drawer, the Workflow tab and the derived log all read those
   objects, and none of them should have to carry presentation data. The label is the key
   because the label is already a sub-step's identity everywhere else in the app.

   call / fetched / checks / captured may each be a function of ctx, so figures read live from
   the contract being built rather than being frozen at authoring time.

   WHAT IS REAL AND WHAT IS AUTHORED. The rule rows, rates, statuses, country data, agent
   names and people are all real values from elsewhere in this app — if a step names the
   Netherlands minimum wage it says EUR 14.71, because that is what Compliance Hub -> Rates &
   Rules says two clicks away, and a demo that shows two different numbers for one fact is
   worse than one that shows fewer. What IS authored is the shape of the work: endpoints,
   payload counts, latencies and the phrasing of each check. Those are invented, but never
   inventing a new system, agent or person — only ever describing a request to something the
   product already names. == */
const aicjEvidence={

  /* ---- 1 · New request ---------------------------------------------------------------- */
  'request-received/New intake':{
    system:'NewForce Solutions', systemId:'adt-solution', ref:'EmployeeIntake',
    call:function(c){return 'GET /api/employee-intake/latest?since=cursor';},
    latency:'210ms',
    fetched:function(c){return [
      {k:'Full name',sub:'Intake form',v:c.name,state:'active'},
      {k:'Company name',sub:'Intake form',v:c.client,state:'active'},
      {k:'Country hiring in',sub:'Intake form',v:c.country,state:'active'},
      // Was a two-way test, so a CONTRACTOR request reported itself as an EOR one. Reads the table.
      {k:'What are you looking for',sub:'Intake form',v:engagementModel(c.type).looking,state:'active'}
    ];},
    checks:function(c){return [
      {rule:'The submission resolves to a client, a country and an engagement type',
       expected:'all three present',actual:c.client+' · '+c.country+' · '+c.type,verdict:'pass'},
      {rule:'Ingest is idempotent on the source record id',
       expected:'no existing client for this submission',actual:'no match — new client',verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Client',v:c.client},{k:'Country',v:c.country},{k:'Contract Type',v:c.type}];},
    summary:'Intake resolved · new client',
    note:'This is the one genuinely wired system in the demo &mdash; the intake form is served by NewForce and polled over HTTP, not simulated in the browser.'
  },

  'request-received/CSM assigned':{
    system:'CSM routing table', ref:'Owner directory',
    call:function(c){return 'route(country="'+c.country+'")';},
    latency:'34ms',
    fetched:function(c){
      const owner=amCsmFor({country:c.country});
      return amCsmPool.map(function(n){return {k:n,sub:'Customer Success Manager',
        v:n===owner?('owns '+c.country):'&mdash;',state:n===owner?'active':'inactive'};});
    },
    checks:function(c){return [
      {rule:'Every country we sell in has exactly one owning CSM',expected:'one match',
       actual:amCsmFor({country:c.country})+' owns '+c.country,verdict:'pass'},
      {rule:'Assignment lands inside the stage SLA',expected:'within 1h',actual:'immediate',verdict:'pass'}
    ];},
    captured:function(c){return [{k:'CSM',v:amCsmFor({country:c.country})},{k:'Owner',v:'Arjun Vaidya'}];},
    summary:function(c){return amCsmFor({country:c.country})+' assigned';},
    note:'A country-to-CSM table needs no judgement, which is exactly why this automates while <b>Qualified / Rejected</b> one row down never will &mdash; that is the one decision this stage exists to make.'
  },

  /* ---- 2 · Quote in preparation -------------------------------------------------------- */
  'quote-prep/Country data check':{
    system:'Compliance Hub', ref:'Rates &amp; Rules',
    call:function(c){return 'GET /compliance/rules?country='+c.country+'&amp;applicableTo='+c.type;},
    latency:'142ms',
    fetched:function(c){
      const rows=(supportPageMeta.compliance.rows||[]).filter(function(r){return r[1]===c.country;});
      if(rows.length)return rows.map(function(r){return {k:r[2],sub:r[3]+' · '+r[4],v:r[5],
        state:r[6]==='Active'?'active':'inactive'};});
      // Countries the rule table does not itemise still resolve — aiH2rCountryData covers all seven.
      const h=aiH2rCountryData[c.country]||aiH2rCountryData['India'];
      return [{k:'Country Rate Rules',sub:'Compliance Hub',v:h.rateRules,state:'active'},
              {k:'Statutory Requirements',sub:'Compliance Hub',v:h.statutory,state:'active'},
              {k:'Tax Bands',sub:'Compliance Hub',v:h.taxBand,state:'active'}];
    },
    checks:function(c){
      const rows=(supportPageMeta.compliance.rows||[]).filter(function(r){return r[1]===c.country;});
      const on=rows.filter(function(r){return r[6]==='Active';}).length;
      const tot=rows.length||3;
      return [
        {rule:'Country is configured in the Compliance Hub',expected:'at least one rule',
         actual:tot+' rules found',verdict:'pass'},
        {rule:'Only rules currently in force enter the cost build',expected:'status Active',
         actual:(rows.length?on+' active, '+(tot-on)+' inactive (excluded)':'all active'),verdict:'pass'}
      ];
    },
    captured:function(c){return [{k:'Country Rules',v:c.country+' statutory set resolved'}];},
    summary:function(c){
      const rows=(supportPageMeta.compliance.rows||[]).filter(function(r){return r[1]===c.country;});
      const on=rows.filter(function(r){return r[6]==='Active';}).length;
      return rows.length?(rows.length+' rules · '+on+' active'):'statutory set resolved';
    },
    note:'Read live from the Compliance Hub, not from the quote. An <b>Inactive</b> rule is one the country has on the books but is not currently applying &mdash; and none of them may enter the cost build.',
    failure:'A country with no configuration raises an exception for the compliance team.'
  },

  'quote-prep/Partner cost requested':{
    system:'Partner network',
    call:function(c){return 'POST /partners/quote-request {country:"'+c.country+'"}';},
    latency:'—',
    // Owned countries are staffed by our own entity, so there is no partner to ask. The seven
    // countries aiH2rCountryData covers are the owned ones; anything else routes to a partner.
    applies:function(c){return !aiH2rCountryData[c.country];},
    checks:function(c){return [{rule:'Partner cost is only requested for non-owned countries',
      expected:'country not in the owned list',actual:c.country+' is owned in-house',verdict:'na'}];},
    summary:'Not applicable',
    note:'Skipped, and the reason is shown rather than the row silently vanishing &mdash; a step that did not need to run is itself evidence of the agent reasoning.'
  },

  'quote-prep/Cost calc built':{
    system:'Cost engine', ref:'Compliance Hub rates',
    call:function(c){return 'build(gross='+Math.round(c.grossMonthly)+', country="'+c.country+'", type="'+c.type+'")';},
    latency:'380ms',
    fetched:function(c){
      const h=aiH2rCountryData[c.country]||aiH2rCountryData['India'];
      return [
        {k:'Employer loading',sub:'Applied to gross',v:h.rateRules,state:'active'},
        {k:'Statutory set',sub:'Carried into the build',v:h.statutory,state:'active'},
        {k:'Monthly gross',sub:'Offered',v:'EUR '+Math.round(c.grossMonthly).toLocaleString(),state:'active'}
      ];
    },
    checks:function(c){return [
      {rule:'Every in-force employer contribution is loaded onto gross',
       expected:'employer social security + holiday pay',actual:'applied',verdict:'pass'},
      {rule:'Margin resolves against the country rate card',expected:'within the standard band',
       actual:'20% — standard',verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Cost Build',v:'Complete'},{k:'Margin %',v:'20%'}];},
    summary:'Margin 20% · standard band',
    note:'The build is derived from the rules the previous step resolved, so a country whose rates change is re-priced rather than re-typed.'
  },

  /* cond: 'if off-standard'. The quote is built on the standard rate card, so pricing has
     nothing to rule on — and a Pricing approval that fires on a standard quote would be asking
     Karan Mehta to sign off a decision nobody made. */
  'quote-prep/Pricing approval':{
    applies:function(c){return false;},
    note:'Only needed when the margin falls outside the standard band. This quote is on the standard rate card at 20%, so pricing has nothing to rule on.'
  },
  'quote-prep/Statutory floor check':{
    system:'Rules engine', ref:'Compliance Hub · Minimum Wage',
    call:function(c){return 'evaluate(floor="Minimum Wage", country="'+c.country+'", gross='+Math.round(c.grossMonthly)+')';},
    latency:'96ms',
    fetched:function(c){
      const rows=(supportPageMeta.compliance.rows||[]).filter(function(r){
        return r[1]===c.country&&r[6]==='Active';});
      if(rows.length)return rows.map(function(r){return {k:r[2],sub:r[3]+' · '+r[4],v:r[5],state:'active'};});
      const h=aiH2rCountryData[c.country]||aiH2rCountryData['India'];
      return [{k:'Statutory Requirements',sub:'Compliance Hub',v:h.statutory,state:'active'}];
    },
    checks:function(c){
      const nl=c.country==='Netherlands';
      const floor=14.71;   // Minimum Wage, General · EOR / PEO, Active — supportPageMeta.compliance row 1
      return nl
        ?[{rule:'Offered rate must be at or above the statutory minimum',
           expected:'&ge; EUR '+floor.toFixed(2)+' / hour',
           actual:'EUR '+c.hourly.toFixed(2)+' / hour',verdict:c.hourly>=floor?'pass':'fail'},
          {rule:'Holiday allowance is carried in the build',expected:'8.00% of gross',
           actual:'EUR '+Math.round(c.grossMonthly*0.08).toLocaleString()+' / month',verdict:'pass'}]
        :[{rule:'Offered rate must be at or above the statutory minimum',
           expected:(aiH2rCountryData[c.country]||{}).statutory||'country statutory set',
           actual:'within the statutory set',verdict:'pass'}];
    },
    captured:function(c){return [{k:'Statutory set',v:'resolved'},{k:'Floor result',v:'cleared'}];},
    summary:'Above the statutory floor',
    note:'The floor is the one number a quote cannot go under. It is checked against the live <b>Active</b> rule rather than a cached figure, because a wage floor that moved after the quote was built is the classic way a compliant quote quietly becomes non-compliant.',
    failure:'A rate below the statutory floor blocks the quote and routes it to Compliance.'
  },

  /* ---- 3 · Quote sent ------------------------------------------------------------------ */
  /* Two steps here exist for the path where the client pushes back, and must not run on the
     path where they do not. Without an `applies` they would fire on every single run and the
     journey would claim a change was requested when nothing of the sort happened — worse than
     omitting them, because it is a false statement about the client. */
  'quote-review/Change requested':{
    applies:function(c){return false;},
    note:'Only runs when the client comes back with changes. On this run they accepted the quote as sent.'
  },
  'quote-review/Re-issued v2':{
    applies:function(c){return false;},
    note:'A re-issue only exists if a change was requested. Nothing to re-issue here.'
  },

  /* ---- 4 · Quote accepted -------------------------------------------------------------- */
  'quote-approved/Client tenant provisioned':{
    system:'ADT SaaS', systemId:'nfadmin', ref:'EntityRegistry',
    call:function(c){return 'POST /tenants {client:"'+c.client+'", country:"'+c.country+'"}';},
    latency:'640ms',
    fetched:function(c){return [
      {k:'Tenant',sub:'Client workspace',v:c.client,state:'active'},
      {k:'Employing entity',sub:'In-country',v:'ADT '+c.country+(c.type==='PEO'?' PEO Services B.V.':' EOR Services B.V.'),state:'active'},
      {k:'Admin seats',sub:'Initial allocation',v:'2',state:'active'}
    ];},
    checks:function(c){return [
      {rule:'Tenant name is unique across the platform',expected:'no existing tenant',
       actual:'no collision',verdict:'pass'},
      {rule:'An employing entity exists in the hiring country',expected:'registered entity',
       actual:c.country+' entity on file',verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Tenant Status',v:'Provisioned'},{k:'Bound To',v:c.client}];},
    summary:'Tenant provisioned',
    note:'Owner is <b>System</b>, whose persona is null in the owner directory &mdash; nobody in this portal could tick this even if it were not automated. It reports itself done.'
  },

  /* ---- 5 · Client signing --------------------------------------------------------------- */
  'agreement-signature/Client entity + sanctions check':{
    system:'ADT SaaS', systemId:'nfadmin', ref:'EntityRegistry + ComplianceFiling',
    call:function(c){return 'POST /screening {entity:"'+c.client+'", country:"'+c.country+'"}';},
    latency:'820ms',
    fetched:function(c){return [
      {k:'Entity registry',sub:c.country,v:'Registered · in good standing',state:'active'},
      {k:'Sanctions lists',sub:'EU · UN · OFAC',v:'0 hits',state:'active'},
      {k:'Name match confidence',sub:'Against the registry record',v:'98.6%',state:'active'},
      {k:'Adverse media',sub:'Screening provider',v:'0 flags',state:'active'}
    ];},
    checks:function(c){return [
      {rule:'The client entity is registered and in good standing',expected:'active registration',
       actual:'registered in '+c.country,verdict:'pass'},
      {rule:'No sanctions hit on any screened list',expected:'0 hits',actual:'0 hits',verdict:'pass'},
      {rule:'A hit or a weak name match escalates to a human',expected:'&ge; 95% confidence to clear',
       actual:'98.6% — cleared without escalation',verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Screening',v:'Cleared'},{k:'Checked On',v:'Just now'}];},
    summary:'Cleared · 0 hits',
    note:'The confidence figure is what decides whether a person is involved at all: the sub-status is authored <i>screening API, human on hit</i>, so a hit or a weak match stops the run here instead of clearing it.'
  },

  /* ---- 6 · Deposit due ------------------------------------------------------------------ */
  'deposit-due/Invoice raised':{
    system:'SAP S/4HANA', systemId:'sap', ref:'API_GLACCOUNTLINEITEM',
    call:function(c){return 'POST /invoices {client:"'+c.client+'", type:"deposit"}';},
    latency:'510ms',
    fetched:function(c){return [
      {k:'Deposit invoice',sub:'Raised against the signed agreement',v:c.depositInvoice,state:'active'},
      {k:'Amount due',sub:'Deposit',v:c.amountDue,state:'active'},
      {k:'Payment terms',sub:'From the agreement',v:'Net 14',state:'active'}
    ];},
    checks:function(c){return [{rule:'A deposit invoice may only be raised once the agreement is signed',
      expected:'agreement signed',actual:'signed',verdict:'pass'}];},
    captured:function(c){return [{k:'Deposit Invoice',v:c.depositInvoice},{k:'Amount Due',v:c.amountDue}];},
    summary:function(c){return c.depositInvoice+' · '+c.amountDue;},
    note:'This stage is the one flagged as a payment gate. From here nothing moves until the money arrives.'
  },

  'deposit-due/Cleared':{
    system:'Bank webhook', ref:'payment.cleared',
    call:'POST /webhooks/bank/receipt',
    latency:'—',
    fetched:function(c){return [
      {k:'Receipt',sub:'Matched against '+c.depositInvoice,v:'Full amount',state:'active'},
      {k:'Amount received',sub:'Cleared funds',v:c.amountDue,state:'active'},
      {k:'Value date',sub:'Bank',v:'Today',state:'active'}
    ];},
    checks:function(c){return [
      {rule:'The deposit invoice is matched against a cleared receipt before the hold is released',
       expected:'full amount cleared',actual:'full amount',verdict:'pass'},
      {rule:'Part payment holds the gate',expected:'no shortfall',actual:'no shortfall',verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Cleared On',v:'Just now'}];},
    summary:'Receipt matched · hold lifted',
    gateRelease:'Payment gate released &mdash; the placement can move.',
    simulated:'Simulated bank webhook',
    note:'The one stage the operating model calls a hard gate. Until this row is green no hire under this client can start, however far the paperwork has got.'
  },

  /* ---- 7 · Worker signing ---------------------------------------------------------------- */
  'employment-contract/Worker signed':{
    system:'Docuseal',
    call:function(c){return 'GET /envelopes/'+c.envelopeId+'/status';},
    latency:'180ms',
    fetched:function(c){return [
      {k:'Envelope',sub:'Docuseal',v:c.envelopeId,state:'active'},
      {k:'Recipient',sub:'Worker',v:c.signatoryEmail,state:'active'},
      {k:'Status',sub:'Signature',v:'Sent &mdash; awaiting signature',state:'pending'}
    ];},
    checks:function(c){return [];},
    waitCopy:'Nothing here is ours to press. The envelope is open with the worker, and Docuseal will call back when it is signed.',
    summary:'Awaiting the worker',
    note:'Owner is <b>Worker</b>, whose persona is null &mdash; so this card offers no button at all. Ticking &ldquo;Worker signed&rdquo; on the worker&rsquo;s behalf is precisely what that null exists to prevent.',
    failure:'A signature timeout or bounce reopens the contract for resend from Client signing.'
  },

  /* ---- 8 · Onboarding -------------------------------------------------------------------- */
  'onboarding/Bank verified':{
    system:'Penny-drop provider',
    call:function(c){return 'POST /bank/verify {account:"••••4821", name:"'+c.name+'"}';},
    latency:'1.4s',
    fetched:function(c){return [
      {k:'Account',sub:'Masked',v:'••••4821',state:'active'},
      {k:'Name on account',sub:'Returned by the bank',v:c.name,state:'active'},
      {k:'Penny-drop',sub:'Test credit',v:'EUR 0.01 accepted',state:'active'}
    ];},
    checks:function(c){return [
      {rule:'The account accepts a test credit',expected:'credit accepted',actual:'accepted',verdict:'pass'},
      {rule:'The name on the account matches the worker',expected:'exact or close match',
       actual:'matched — '+c.name,verdict:'pass'}
    ];},
    captured:function(c){return [{k:'Bank Details',v:'On file (••••4821)'}];},
    summary:'Verified · ••••4821',
    note:'A penny-drop proves the account exists and belongs to the right person before payroll ever sends real money to it.'
  }
};

/* Every sub-status renders, whether or not it has an authored descriptor. The fallback is
   built from what amSubStatuses and the stage's own journey event already say, so an
   un-authored step still shows its owner, its automation note and the stage's real validation
   sentence rather than an empty panel. `derived` lets the card render it a shade quieter and
   lets the test harness count how many are still stubs. */
function aicjDescriptorFor(stageIdx,step){
  if(!step)return null;
  const authored=aicjEvidence[aicjStageId(stageIdx)+'/'+step.label];
  if(authored)return authored;
  const ev=((typeof aiJourneyEvents!=='undefined'&&aiJourneyEvents['contract-creation'])||[])[stageIdx]||{};
  return {
    derived:true,
    // No system. An un-authored step has no call to report, and naming the stage's agent here
    // would claim it "reached" something it did not — the agent already appears in the head,
    // where it belongs. An empty Reached column is the honest rendering of "not yet authored".
    system:null,
    fetched:[], captured:[],
    checks:[{rule:ev.validation||'&mdash;',expected:'&mdash;',
             actual:step.auto?('performed by '+(ev.source||'the execution layer'))
                             :('pending '+step.owner),
             verdict:step.auto?'pass':'na'}],
    summary:step.auto?'Completed':'Waiting',
    note:step.autoNote?('Automated &mdash; '+step.autoNote+'.')
                      :('Owned by '+step.owner+' ('+amOwnerInfo(step.owner).who+').'),
    failure:ev.failure
  };
}
/* Descriptor fields may be authored as either a value or a function of ctx. */
function aicjVal(v,c){return typeof v==='function'?v(c):v;}
/* Who each owner role actually is, and which persona may advance its sub-steps. `persona`
   null means nobody in this portal can advance it: Client and Worker steps land by webhook or
   e-signature callback, and System steps are provisioning. Marking them null is what stops the
   UI offering an Account Manager a button to tick "Worker signed" on the worker's behalf. */
const amOwnerDirectory={
  'Account Manager':{who:'Arjun Vaidya',   initials:'AV',persona:'account-manager'},
  'EOR Ops':        {who:'Sunita Kulkarni',initials:'SK',persona:'ops-manager'},
  'Pricing':        {who:'Karan Mehta',    initials:'KM',persona:'deal-manager'},
  'Compliance':     {who:'Kavya Iyer',     initials:'KI',persona:'compliance-officer'},
  'Finance':        {who:'Meera Iyer',     initials:'MI',persona:'finance-approver'},
  'Onboarding Ops': {who:'Priyanka Bhatt', initials:'PB',persona:'hr'},
  'Payroll Ops':    {who:'Priyanka Bhatt', initials:'PB',persona:'hr'},
  'System':         {who:'AI Execution Layer',initials:'AI',persona:null},
  'Client':         {who:'Client',         initials:'CL',persona:null},
  'Worker':         {who:'Worker',         initials:'WK',persona:null},
  /* -- Added by the Bhaiyaa store journey. 'Ops Manager' is the same person as 'EOR Ops' and
     deliberately a separate key: they are two queues, not one, and a store opening that lands
     in the EOR Ops bucket would be unreadable to whoever works it. 'Merchant' is external and
     gets persona null for the same reason 'Client' does — a merchant's own signup cannot be
     ticked on their behalf from inside this portal, only chased. The two agents are named
     rather than folded into 'System' because the journey names them, and a trail that says
     "KYC Agent" is worth more than one that says "the system". -- */
  'Ops Manager':    {who:'Sunita Kulkarni',initials:'SK',persona:'ops-manager'},
  'Merchant':       {who:'Merchant',       initials:'MR',persona:null},
  'KYC Agent':      {who:'KYC Agent',      initials:'KA',persona:null},
  'Store Agent':    {who:'Store Agent',    initials:'SA',persona:null}
};
function amOwnerInfo(role){return amOwnerDirectory[role]||{who:role,initials:'?',persona:null};}
function amSubSteps(stageId){return amSubStatuses[stageId]||[];}
// An Account Manager reads every sub-status but may only advance the ones their role owns.
// Entity Admin and Super Admin oversee the whole entity, so they may advance any owned step.
function amCanAdvance(ownerRole){
  const info=amOwnerInfo(ownerRole);
  if(!info.persona)return false;
  if(portalRole==='entity-admin'||portalRole==='super-admin')return true;
  return portalRole==='entity-user'&&activePersonaId===info.persona;
}

/* == THE SUB-STATUS RUNNER: JOIN, CONTEXT, MODE ==========================================
   The automated Contract Creation journey used to show its nine client-facing stages and
   nothing underneath them, advancing on bare timers — a spinner, then a new screen, with no
   evidence that anything had been done. The 41 admin sub-statuses that say what actually
   happens inside each stage were already here in amSubStatuses, but only the Account Manager
   board ever read them. These three functions are the bridge.

   The join costs one line because the alignment already exists and is documented where
   aiJourneyEvents is defined: stage index i is the same stage in all three stores.

       aiJourneyEvents['contract-creation'][i] === amPipelineStages[i]
                                              === amSubStatuses[amPipelineStages[i].id]

   So no parallel step list is created and no new ids are minted. amSubStatuses stays the sole
   source of label/owner/sla/cond/decision/loop, and is never mutated — the board reads the
   very same objects. == */
function aicjStageId(i){return (amPipelineStages[i]||{}).id||'';}
function aicjSteps(i){return amSubSteps(aicjStageId(i));}

/* The live values an evidence descriptor interpolates. Built fresh per render rather than
   cached, so a country or a pay figure edited mid-run shows the edited value — a descriptor
   that froze its strings at run start would quietly contradict the form beside it. Every
   fallback chain ends in something displayable, because a half-built run is the normal state
   at stage 0 and 'undefined' must never reach the screen. */
function aicjCtx(){
  const rec=(typeof contractsData!=='undefined'&&typeof aiCreatedContractId!=='undefined'
    ?contractsData.find(function(c){return c.id===aiCreatedContractId;}):null)||{};
  const d=(typeof aiWizardFormData!=='undefined'&&aiWizardFormData)||{};
  const pre=(typeof aiContractPrefill!=='undefined'&&aiContractPrefill)||{};
  const emp=(typeof aiCtJourneyEmployee!=='undefined'&&aiCtJourneyEmployee)||{};
  const name=rec.empName||((pre.fname||'')+' '+(pre.lname||'')).trim()||emp.name||'the employee';
  const contractId=rec.contractId?('CTR-'+String(rec.contractId).replace(/^CTR-/,'')):'CTR-000000';
  const num=String(contractId).replace(/^CTR-/,'');
  const gross=parseFloat(String(rec.payAmount||d.pay||pre.pay||'5700').replace(/[^0-9.]/g,''))||5700;
  return {
    country:rec.country||d.country||pre.country||emp.country||'Netherlands',
    type:rec.empType||rec.type||(typeof aiCtActiveType==='function'?aiCtActiveType():'')||'EOR',
    name:name, client:'Dhi Hyperlocal',
    empId:emp.empId||rec.empId||'EMP-0001',
    contractId:contractId, grossMonthly:gross,
    // Hourly is derived, not authored: 173.33 is the standard monthly-hours divisor, so the
    // floor check compares like with like against a per-hour statutory minimum.
    hourly:gross/173.33,
    signatoryEmail:(name.toLowerCase().replace(/[^a-z ]/g,'').trim().replace(/\s+/g,'.')||'employee')+'@dhihyperlocal-mock.com',
    envelopeId:'DS-'+num, depositInvoice:'INV-'+num, amountDue:'$9,500',
    rec:rec, emp:emp
  };
}

/* How a sub-status behaves when the runner reaches it. Derived entirely from flags that
   already exist — nothing new is added to amSubStatuses, because four unrelated surfaces read
   those objects and none of them should have to carry runner state.

     auto            -> runs itself and shows its work
     persona===null  -> nobody in this portal may complete it. Client can be chased; a Worker
                        or the System cannot, so those get no button at all. This is the same
                        null amCanAdvance already uses to stop the UI offering an Account
                        Manager a button to tick "Worker signed" on the worker's behalf.
     amCanAdvance    -> this user owns the decision, so the runner hosts it and the page's
                        duplicate Approve bar stands down
     otherwise       -> owned by someone else in the entity; offer to notify them */
function aicjStepMode(stageIdx,step){
  if(!step)return 'auto';
  if(step.auto)return 'auto';
  const info=amOwnerInfo(step.owner);
  if(info.persona===null)return step.owner==='Client'?'external-chase':'external-wait';
  if(amCanAdvance(step.owner))return 'act';
  return 'handoff';
}
/* An engagement-track row is the client request itself, so its `subject` is the headcount
   being quoted rather than a person. A placement-track row is one named hire under an
   already-signed engagement, which is why the same client legitimately appears on several
   rows below the gate — one per hire. `age` is days in the current stage, which is what
   makes a stalled record visible without a separate ageing report. */
const amDeals=[
  {id:1, ref:'DL-4021',kind:'engagement',client:'Vantage Freight Pvt Ltd',   subject:'4 roles',        role:'Warehouse Ops',        country:'India',         value:'INR 18,40,000',updated:'29 Jul 2026',age:2, stage:'request-received',    sub:0},
  {id:2, ref:'DL-4024',kind:'engagement',client:'Kaira Textiles Ltd',        subject:'2 roles',        role:'Production Supervisor',country:'India',         value:'INR 7,20,000', updated:'29 Jul 2026',age:1, stage:'request-received',    sub:1},
  {id:3, ref:'DL-4026',kind:'engagement',client:'Helix Marine B.V.',         subject:'1 role',         role:'Marine Engineer',      country:'Netherlands',   value:'EUR 96,000',   updated:'28 Jul 2026',age:3, stage:'request-received',    sub:2},
  {id:4, ref:'DL-4009',kind:'engagement',client:'Norrbridge Logistics B.V.', subject:'6 roles',        role:'Fleet Coordinator',    country:'Netherlands',   value:'EUR 3,12,000', updated:'28 Jul 2026',age:4, stage:'quote-prep',          sub:2},
  {id:5, ref:'DL-4013',kind:'engagement',client:'Arcadia Retail GmbH',       subject:'3 roles',        role:'Store Manager',        country:'Germany',       value:'EUR 1,74,000', updated:'27 Jul 2026',age:5, stage:'quote-prep',          sub:4},
  {id:6, ref:'DL-3998',kind:'engagement',client:'Dhi Hyperlocal',            subject:'5 roles',        role:'Delivery Ops Lead',    country:'India',         value:'INR 22,50,000',updated:'26 Jul 2026',age:6, stage:'quote-review',        sub:1},
  {id:7, ref:'DL-4002',kind:'engagement',client:'Meridian Analytics Ltd',    subject:'2 roles',        role:'Data Analyst',         country:'United Kingdom',value:'GBP 88,000',   updated:'22 Jul 2026',age:9, stage:'quote-review',        sub:2,breach:true},
  {id:8, ref:'DL-3981',kind:'engagement',client:'Vantage Freight Pvt Ltd',   subject:'3 roles',        role:'Customs Executive',    country:'India',         value:'INR 12,60,000',updated:'24 Jul 2026',age:7, stage:'quote-approved',      sub:1},
  {id:9, ref:'DL-3974',kind:'engagement',client:'Solvent Iberia S.L.',       subject:'2 roles',        role:'Process Chemist',      country:'Spain',         value:'EUR 1,08,000', updated:'21 Jul 2026',age:11,stage:'agreement-signature',sub:1},
  {id:10,ref:'DL-3969',kind:'engagement',client:'Kaira Textiles Ltd',        subject:'1 role',         role:'Quality Lead',         country:'India',         value:'INR 5,40,000', updated:'20 Jul 2026',age:12,stage:'agreement-signature',sub:3},
  {id:11,ref:'PL-2088',kind:'placement', client:'Dhi Hyperlocal',            subject:'Anika Shah',     role:'Delivery Ops Lead',    country:'India',         value:'INR 4,50,000', updated:'29 Jul 2026',age:3, stage:'deposit-due',         sub:1},
  {id:12,ref:'PL-2091',kind:'placement', client:'Norrbridge Logistics B.V.', subject:'Sanne de Vries', role:'Fleet Coordinator',    country:'Netherlands',   value:'EUR 52,000',   updated:'24 Jul 2026',age:8, stage:'deposit-due',         sub:2,breach:true},
  {id:13,ref:'PL-2079',kind:'placement', client:'Arcadia Retail GmbH',       subject:'Nora Kim',       role:'Store Manager',        country:'Germany',       value:'EUR 58,000',   updated:'28 Jul 2026',age:2, stage:'employment-contract', sub:1},
  {id:14,ref:'PL-2082',kind:'placement', client:'Meridian Analytics Ltd',    subject:'Owen Clark',     role:'Data Analyst',         country:'United Kingdom',value:'GBP 44,000',   updated:'27 Jul 2026',age:4, stage:'employment-contract', sub:4},
  {id:15,ref:'PL-2064',kind:'placement', client:'Dhi Hyperlocal',            subject:'Rahul Mehta',    role:'Delivery Ops Lead',    country:'India',         value:'INR 4,20,000', updated:'26 Jul 2026',age:5, stage:'onboarding',          sub:2},
  {id:16,ref:'PL-2071',kind:'placement', client:'Solvent Iberia S.L.',       subject:'Luis Martin',    role:'Process Chemist',      country:'Spain',         value:'EUR 54,000',   updated:'25 Jul 2026',age:6, stage:'onboarding',          sub:4},
  {id:17,ref:'PL-2043',kind:'placement', client:'Norrbridge Logistics B.V.', subject:'Emma Schmidt',   role:'Fleet Coordinator',    country:'Netherlands',   value:'EUR 51,000',   updated:'14 Jul 2026',age:18,stage:'active',              sub:2},
  {id:18,ref:'PL-2049',kind:'placement', client:'Vantage Freight Pvt Ltd',   subject:'Sofia Romano',   role:'Customs Executive',    country:'India',         value:'INR 3,90,000', updated:'10 Jul 2026',age:22,stage:'active',              sub:2},
  {id:19,ref:'PL-2052',kind:'placement', client:'Kaira Textiles Ltd',        subject:'James Wilson',   role:'Quality Lead',         country:'India',         value:'INR 4,05,000', updated:'08 Jul 2026',age:24,stage:'active',              sub:1}
];
function amCurrentSub(d){const steps=amSubSteps(d.stage);return steps[Math.min(d.sub||0,steps.length-1)]||null;}
function amSubIndex(d){const steps=amSubSteps(d.stage);return Math.min(d.sub||0,Math.max(0,steps.length-1));}
/* == HOW FAR IN, AGAINST THE WHOLE JOURNEY ================================================
   A record's position is two numbers, and the listing only ever printed the second one. "Step
   3 of 3" is true of the stage and a lie about the work: a request sitting on its qualification
   decision — the first stage of nine, nothing priced, nothing signed — read as a finished piece
   of work, and a placement genuinely finishing read exactly the same way.

   The stage count leads because nine stages is the unit the reader already has in front of them:
   the rail above the table IS those nine, in that order. `n` is the stage's own number from
   amPipelineStages rather than a derived index, so the rail, this line and the drawer's log all
   count the stages the same way. == */
function amJourneyPos(d){
  const st=amStageById(d.stage);
  const steps=amSubSteps(d.stage);
  return {
    stageNo:st?st.n:amStageIndex(d.stage)+1,
    stages:amPipelineStages.length,
    stepNo:amSubIndex(d)+1,
    steps:steps.length,
    terminal:!!(st&&st.terminal)
  };
}
/* One line, two facts, smaller word for the smaller unit — "Stage 2 of 9" is the journey and
   "step 5 of 6" is the stage, and the case difference is what stops the two numbers reading as
   one broken sentence. A stage with no sub-steps prints the journey position alone rather than
   "step 1 of 0". */
function amProgressText(d){
  const p=amJourneyPos(d);
  return 'Stage '+p.stageNo+' of '+p.stages
    +(p.steps?' &middot; step '+p.stepNo+' of '+p.steps:'');
}
/* == THE NEXT ACTION =====================================================================
   `d.sub` is the step IN PROGRESS, so the next action is always "finish the step you are on".
   That one sentence replaced a fiddlier model where the action was the step *after* the
   current one — which left a record sitting on the last step of a stage with no next step to
   click and no way forward.

   What the action IS depends on who owns that step, and only four cases matter to a user:
     auto  the AI Execution Layer performs it — nobody ticks it, it reports itself done
     do    the signed-in role owns it, so there is a button that completes it
     chase the client owns it, so the useful action is a reminder, not a tick
     wait  a worker, another team, or the system owns it — nothing for this user to do
   Auto is checked before ownership on purpose: an automated step must never grow a manual
   "Mark done" button just because the accountable role happens to be signed in — ticking it
   by hand is exactly what the automation removed. */
function amNextAction(d){
  const step=amCurrentSub(d);
  if(!step)return {kind:'wait',label:'Nothing to do',owner:'&mdash;',step:null};
  const owner=step.owner;
  if(step.auto)return {kind:'auto',label:'Runs automatically',owner:owner,step:step};
  if(amCanAdvance(owner))return {kind:'do',label:'Mark done',owner:owner,step:step};
  if(owner==='Client')return {kind:'chase',label:'Send reminder',owner:owner,step:step};
  if(owner==='System')return {kind:'wait',label:'Runs automatically',owner:owner,step:step};
  return {kind:'wait',label:'Waiting on '+owner,owner:owner,step:step};
}
/* == AUTO STEPS NEVER WAIT ===============================================================
   An automated sub-step is not a task — the system performs it the instant it is reached, so
   a record must never sit on one waiting for someone to press a button. Whenever a record
   lands on an auto step, this rolls it forward (across a stage boundary if needed) until it
   rests on a human step. The skipped steps still count as done, so the derived log records
   them — as history, performed by the execution layer — while the Logs tab only ever asks a
   person for the steps that are actually theirs. The one place a record may legitimately rest
   on an auto step is the terminal stage, where there is nothing after it to wait for. */
function amSkipAutoSteps(d){
  const skipped=[];let guard=0;
  while(guard++<60){
    const steps=amSubSteps(d.stage);
    const idx=Math.min(d.sub||0,Math.max(0,steps.length-1));
    const cur=steps[idx];
    if(!cur||!cur.auto)break;
    if(idx<steps.length-1){skipped.push(cur.label);d.sub=idx+1;continue;}
    const next=amPipelineStages[amStageIndex(d.stage)+1];
    if(!next)break;
    skipped.push(cur.label);
    d.stage=next.id;d.sub=0;
  }
  return skipped;
}
/* == CSM AUTO-ASSIGNMENT =================================================================
   The concrete automation behind stage 1's "CSM assigned": routed by the client's country.
   Held on the deal (d.csm) so it is a fact that can be revisited — the Workflow tab shows the
   assignment and offers reassignment, which is the whole reason it surfaces there rather than
   as a step someone ticks in the Logs. */
const amCsmByCountry={'India':'Ishita Rao','Netherlands':'Maya Vos','Germany':'Tomas Berg','Spain':'Luis Ortega','United Kingdom':'Daniel Kim'};
const amCsmPool=['Ishita Rao','Maya Vos','Tomas Berg','Luis Ortega','Daniel Kim'];
function amCsmFor(d){return d.csm||amCsmByCountry[d.country]||'Daniel Kim';}
function amReassignCsm(dealId,name){
  const d=amDeals.find(function(x){return x.id===dealId;});if(!d||!name||name===amCsmFor(d))return;
  const prev=amCsmFor(d);
  d.csm=name;
  amPushNote(d,'CSM reassigned','Reassigned from '+prev+' to '+name+' by '+actorLabel(currentActorId())+'.');
  showAiToast('CSM reassigned',d.ref+' &middot; '+name+' now owns this client relationship.');
  renderADTPage();
}
/* Shared "something happened without the record moving" entry — reminders, completion notes,
   reassignments. One writer, so every note carries the same shape and stamps. */
/* `flags` is merged over the entry, so a caller can mark WHAT KIND of non-moving event this was
   without a second writer appearing. Follow-ups use it to carry `reminder:true`, which is what
   gives them the trail's reminder tag — the tag exists precisely to say "this changed nothing",
   and a chase that did not wear it would read as a step somebody completed. */
function amPushNote(d,label,note,flags){
  const stage=amStageById(d.stage)||{};
  const now=new Date();const h=now.getHours();
  (amExtraLog[d.id]=amExtraLog[d.id]||[]).unshift(Object.assign({
    stage:stage,stageNo:stage.n,subNo:amSubIndex(d)+1,
    sub:{label:label},
    owner:amOwnerInfo('Account Manager'),ownerRole:'Account Manager',
    state:'note',
    date:now.getDate()+' '+amMonths[now.getMonth()]+' '+now.getFullYear(),
    time:(h%12||12)+':'+String(now.getMinutes()).padStart(2,'0')+' '+(h>=12?'PM':'AM'),
    note:note
  },flags||{}));
}
/* Reminders are the one event the derived log cannot infer, because they do not move the
   record — they are a thing the Account Manager did while standing still. Kept separately so
   the derived history stays derived. */
const amExtraLog={};
// Seed records may sit on an auto step (the table predates the auto flags); roll them forward
// once at load so the invariant above holds from the first render.
amDeals.forEach(function(d){amSkipAutoSteps(d);});
/* == SUB-STATUS LOG ======================================================================
   Derived, not stored. Every sub-status a record has already cleared — across every stage it
   has passed through, not just the one it sits in — becomes one log entry stamped with the
   owner who cleared it. Deriving it means the log can never drift out of agreement with the
   record's stage/sub position, which is the failure mode of a hand-kept audit trail: the two
   disagree and neither is trustworthy. Timestamps walk backwards from the record's own
   `updated` date so ordering is stable and no clock is read at render time. */
const amMonths=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function amShiftDate(dateStr,minusDays){
  const base=new Date(dateStr+' 00:00:00');
  if(isNaN(base.getTime()))return {date:dateStr,time:'09:00 AM'};
  base.setDate(base.getDate()-minusDays);
  const hour=9+(minusDays%8);
  return {date:base.getDate()+' '+amMonths[base.getMonth()]+' '+base.getFullYear(),
          time:(hour%12||12)+':'+(minusDays*7%60<10?'0':'')+(minusDays*7%60)+' '+(hour>=12?'PM':'AM')};
}
function amDealLog(d){
  const curStageIdx=amStageIndex(d.stage);
  const entries=[];
  amPipelineStages.forEach(function(st,si){
    if(si>curStageIdx)return;
    const steps=amSubSteps(st.id);
    // Every sub-step of a stage already passed; only the cleared ones of the live stage.
    const upto=si<curStageIdx?steps.length:Math.min(d.sub||0,steps.length-1)+1;
    steps.slice(0,upto).forEach(function(sub,i){
      const isLive=si===curStageIdx&&i===upto-1;
      const owner=amOwnerInfo(sub.owner);
      entries.push({stage:st,stageNo:st.n,sub:sub,subNo:i+1,owner:owner,ownerRole:sub.owner,
        state:isLive?'current':'done',
        breach:!!(isLive&&d.breach)});
    });
  });
  // Newest first, and the offset is derived from position so it is stable across renders.
  const total=entries.length;
  entries.forEach(function(e,i){
    const stamp=amShiftDate(d.updated,(total-1-i)*2);
    e.date=stamp.date;e.time=stamp.time;
  });
  entries.reverse();
  // Reminders sit at the top: they are the most recent thing that happened, and they happened
  // without the record moving, so they have no position in the derived sequence.
  return (amExtraLog[d.id]||[]).concat(entries);
}
// '' = no stage selected, in which case the listing shows every record.
let amPipelineStage='';
// Same page size as every other listing in the app (see LP_PAGE_SIZE), so a user who has
// learned the rhythm of one table does not have to relearn it here.
const AM_PAGE_SIZE=10;
let amPage=1;
let amSelectedDealId=null,amDealTab='basic-details';
/* THE ROW YOU CAME BACK TO, which is not the same as the record you opened. Returning from a run
   used to set amSelectedDealId so the reader would not have to find their row again in a table of
   nineteen — but that id also opens the drawer, and an open drawer takes 40% of the width and
   makes the table shed its "The hire" and "Days" columns. So the listing a person came back to had
   five columns where the one they left had seven, for a drawer they never asked for.

   Split in two: this marks a row, amSelectedDealId opens a record. The listing then looks the same
   every time it is the listing, and the drawer appears when — and only when — someone opens one.

   Deliberately NOT persisted: a highlight is about the trip you just made, and restoring one on a
   cold load would mark a row for a journey nobody remembers taking. */
let amReturnedDealId=null;
/* Stage is the only filter axis now. The quick-filter axis that used to sit beside it
   ("waiting on client", "running late", "waiting for payment") went with the KPI tiles that
   were its only trigger — nothing could set it, so every cut it offered was unreachable. */
function amFilteredDeals(){
  return amDealsForStage(amPipelineStage);
}
function amStageById(id){return amPipelineStages.find(function(s){return s.id===id;})||null;}
function amStageIndex(id){return amPipelineStages.findIndex(function(s){return s.id===id;});}
function amStageCount(id){return amDeals.filter(function(d){return d.stage===id;}).length;}
function amDealsForStage(id){return id?amDeals.filter(function(d){return d.stage===id;}):amDeals.slice();}

/* == OPS MANAGER — BHAIYAA STORE OPERATIONS ==============================================
   The same instrument as the Account Manager board above — header, rail, listing, drawer —
   pointed at a different journey. Everything it shows is the Bhaiyaa Store Creation Journey
   (aiJourneyEvents['bhaiyaa-store-creation']) and nothing else: five stages, in the order the
   journey declares them, with the same owners the journey names.

   WHY THIS SHAPE FOR THIS ROLE. An Ops Manager's day on store openings is not a to-do list of
   their own steps — the journey is 3 of 5 steps automated, and the two human steps belong to
   the merchant. Their day is the two exceptions the journey itself calls out: a merchant who
   started a signup and stopped, and an agent run that halted. So the board is built to make
   those two visible, and it deliberately does NOT invent ops sign-off steps to pad the human
   column. Padding would have made the automated journey look manual, which is the one thing
   this product should never do.

   MINIMAL ON PURPOSE. Twelve sub-steps across five stages, against the contract journey's 41.
   The store journey is short and mostly automated; a board that split it into forty operations
   would be describing a process that does not exist. == */
const soPipelineStages=[
  {id:'store-details', n:1,track:'merchant',tone:'amber',label:'Store details',   short:'Signup',       plain:'The merchant is filling in Bhaiyaa&rsquo;s signup &mdash; contact, store, KYC registration, documents, bank and address.',internal:'Signup in progress on the merchant&rsquo;s side',  waitingOn:'Merchant',merchantAction:true},
  /* A gate in the same sense as the deal board's deposit stage: nothing downstream exists until
     it clears. The journey is explicit that a failed match halts the run BEFORE a store is
     created, which is the whole reason KYC sits here rather than after provisioning. */
  {id:'kyc',           n:2,track:'ours',    tone:'red',  label:'KYC verification',short:'KYC',          plain:'We are checking the owner&rsquo;s Aadhaar with UIDAI before any store is opened.',      internal:'UIDAI demographic match and watchlist screen',     waitingOn:'KYC Agent',gate:true},
  {id:'store-creation',n:3,track:'ours',    tone:'blue', label:'Pending for activation',short:'Pending for activation',plain:'We are registering the store on Bhaiyaa and switching on the storefront or the ledger.',internal:'StoreIntake registration, then provisioning',      waitingOn:'Store Agent'},
  {id:'store-live',    n:4,track:'ours',    tone:'green',label:'Store created',   short:'Live',         plain:'The store exists in both systems. It stays Pending until its address, GST number and bank details are added.',internal:'Live in both systems, pending the remaining details',waitingOn:'Ops Manager',terminal:true}
];
/* Two tracks, and the divider between them is the honest summary of this journey: the first
   half is not ours to do, the second half is not ours to touch unless it breaks. */
const soPipelineTracks=[
  {id:'merchant',label:'The merchant signs up',sub:'Nothing here is yours to tick',plain:'Everything the merchant fills in themselves. You cannot complete these; you chase them.'},
  {id:'ours',    label:'We open the store',    sub:'Runs on agents',               plain:'KYC, registration on Bhaiyaa and provisioning. Agents do the work &mdash; you step in only when one halts.'}
];
/* == SUB-STEPS ===========================================================================
   Same contract as amSubStatuses: `auto` is performed by the execution layer, `owner` is who
   answers for it either way, `cond` marks a step that only applies in some cases.

   `halt` is new here, and it earns its place. The journey documents two failures that stop a
   run dead — a UIDAI mismatch and a rejected Bhaiyaa registration — and both are handed to a
   person to clear. Modelling them as ordinary steps would put every store through a compliance
   review it does not need; modelling them as nothing would leave the two records an Ops Manager
   actually works with nowhere to sit. So a halt step exists only for a record whose run halted
   in that stage (see soSteps), and it is the LAST step of its stage, which is what keeps `sub`
   indices stable whether it is present or not.

   `act` overrides the button wording. "Mark done" is right for a step you complete and wrong
   for one you clear, and the listing's action column is the place a user reads fastest — so
   these are kept to two words, which is what the column can hold without truncating. == */
const soSubStatuses={
  /* "Signup issued" moved here from the stage that used to sit in front of this one. The role
     question it shared that stage with is gone, but issuing the link is still a real event with
     a real timestamp, and dropping it would have left the trail starting mid-conversation — the
     first thing in the log would be the merchant replying to something nobody sent. */
  'store-details':[
    {label:'Signup issued',owner:'Ops Manager',auto:true,autoNote:'link sent to the merchant'},
    {label:'Signup completed',owner:'Merchant',sla:'2 days'},
    {label:'Mobile verified',owner:'Merchant',auto:true,autoNote:'OTP callback'}
  ],
  /* `Verification pending` is the one manual step in this stage, and it is why a record can rest
     here at all: the two checks above it are automated, so before it existed soSkipAutoSteps
     rolled every run straight through KYC into store creation and the stage was never anybody's
     queue. It is the Ops Manager signing off what the agent found — the agent gathers the
     evidence, a person accepts it — and it is what the Logs tab links out to the journey for. */
  'kyc':[
    {label:'Aadhaar checked with UIDAI',owner:'KYC Agent',auto:true,autoNote:'name and mobile match'},
    {label:'Watchlist screened',owner:'KYC Agent',auto:true,autoNote:'screening API'},
    {label:'Verification pending',owner:'Ops Manager',sla:'1 day',act:'Verify KYC',opensKyc:true},
    {label:'Mismatch review',owner:'Compliance',halt:true,act:'Clear review'}
  ],
  'store-creation':[
    {label:'Registered on Bhaiyaa',owner:'Store Agent',auto:true,autoNote:'StoreIntake'},
    {label:'Storefront or ledger opened',owner:'Store Agent',auto:true,autoNote:'provisioning'},
    {label:'Registration retry',owner:'Ops Manager',halt:true,act:'Retry'}
  ],
  'store-live':[
    {label:'Store details completed',owner:'Ops Manager',sla:'1 day',act:'Complete details'},
    {label:'Active on Bhaiyaa',owner:'Store Agent',auto:true,autoNote:'once the details are complete'}
  ]
};
/* `halted` holds the id of the stage the run stopped in, not a boolean — a boolean would make
   the retry step of stage 4 appear on a record that halted in stage 3. `haltNote` is what came
   back from the system that refused, which is the only thing that tells the reader what to do.
   `age` is days on the current step, same as the deal board. */
const soRuns=[
  {id:1, ref:'STR-000112',store:'Sharma Kirana Mart',      merchant:'Ravi Sharma',      role:'seller',category:'Grocery & Kirana',        band:'MSME: Micro, Small, and Medium Enterprises',  city:'Pune',      updated:'01 Aug 2026',age:1, stage:'store-details', sub:0},
  {id:2, ref:'STR-000114',store:'Nandini Dairy Point',     merchant:'Meghana Rao',      role:'seller',category:'Dairy & Bakery',          band:'MSME: Micro, Small, and Medium Enterprises',  city:'Bengaluru', updated:'31 Jul 2026',age:2, stage:'store-details', sub:0},
  {id:3, ref:'STR-000108',store:'Green Leaf Vegetables',   merchant:'Imran Qureshi',    role:'seller',category:'Fruits & Vegetables',     band:'MSME: Micro, Small, and Medium Enterprises',  city:'Nagpur',    updated:'30 Jul 2026',age:3, stage:'kyc',           sub:2},
  {id:4, ref:'STR-000109',store:'Vasant Medico',           merchant:'Sneha Kulkarni',   role:'seller',category:'Pharmacy & Wellness',     band:'MSME: Micro, Small, and Medium Enterprises',  city:'Pune',      updated:'27 Jul 2026',age:6, stage:'store-details', sub:0,breach:true},
  {id:5, ref:'STR-000110',store:'Bansal Hardware Depot',   merchant:'Naveen Bansal',    role:'buyer', category:'Hardware & Home Needs',   band:'SMB: Small and Medium-sized Business',  city:'Indore',    updated:'31 Jul 2026',age:2, stage:'store-details', sub:0},
  {id:6, ref:'STR-000111',store:'Anjali Stationers',       merchant:'Anjali Deshmukh',  role:'seller',category:'Stationery & Books',      band:'MSME: Micro, Small, and Medium Enterprises',  city:'Nashik',    updated:'29 Jul 2026',age:4, stage:'kyc',           sub:2},
  {id:7, ref:'STR-000104',store:'Rohit Mobile World',      merchant:'Rohit Kadam',      role:'seller',category:'Electronics & Mobile',    band:'SMB: Small and Medium-sized Business',  city:'Mumbai',    updated:'31 Jul 2026',age:2, stage:'kyc',           sub:3,halted:'kyc',
   // sub 3, not 2: `Verification pending` was inserted above the halt step, and a halted record
   // sits on its halt step. The halt is still authored last, so this is the only index that moved.
   haltNote:'UIDAI returned a different name for this Aadhaar. The owner name on the signup does not match the demographics on record.'},
  {id:8, ref:'STR-000106',store:'Sagar Foods &amp; Catering',merchant:'Sagar Pawar',    role:'buyer', category:'Restaurant & Food Service',band:'Corporate: Large businesses or companies',city:'Pune',      updated:'01 Aug 2026',age:1, stage:'store-creation',sub:2,halted:'store-creation',
   haltNote:'Bhaiyaa rejected the registration. StoreIntake returned a duplicate GST number against this PAN, so no Bhaiyaa ref was issued.'},
  {id:9, ref:'STR-000097',store:'Kaveri Textiles Outlet',  merchant:'Latha Menon',      role:'seller',category:'Apparel & Footwear',      band:'SMB: Small and Medium-sized Business',  city:'Coimbatore',updated:'30 Jul 2026',age:3, stage:'store-live',    sub:0,bhaiyaaRef:'BHA-STR-0071'},
  {id:10,ref:'STR-000099',store:'Mahalaxmi General Store', merchant:'Prakash Jadhav',   role:'seller',category:'General Store',           band:'MSME: Micro, Small, and Medium Enterprises',  city:'Solapur',   updated:'28 Jul 2026',age:5, stage:'store-live',    sub:0,bhaiyaaRef:'BHA-STR-0073'},
  {id:11,ref:'STR-000088',store:'Deccan Wholesale Buyers', merchant:'Farhan Shaikh',    role:'buyer', category:'Grocery & Kirana',        band:'Corporate: Large businesses or companies',city:'Hyderabad', updated:'21 Jul 2026',age:12,stage:'store-live',    sub:1,bhaiyaaRef:'BHA-STR-0062'},
  {id:12,ref:'STR-000091',store:'Sunrise Bakers',          merchant:'Neha Kulkarni',    role:'seller',category:'Dairy & Bakery',          band:'MSME: Micro, Small, and Medium Enterprises',  city:'Thane',     updated:'18 Jul 2026',age:15,stage:'store-live',    sub:1,bhaiyaaRef:'BHA-STR-0065'}
];
/* == WHAT BHAIYAA GAVE US ================================================================
   The signup fields as they come back from seller.bhaiyaa, keyed by our store ref. A separate
   table from soRuns above, and deliberately so: soRuns is OUR journey state — which stage, which
   step, whether it stopped — and none of that exists in Bhaiyaa. This is the other half, the
   half we only ever read. Keeping them apart is what makes the boundary visible, and it is the
   shape the real integration wants: this table is the one that gets replaced by an API response.

   These are the values the KYC screen verifies against. They are here rather than on the run
   because a run that has not reached KYC has no reason to carry an Aadhaar number around. == */
const soBhaiyaaSignup={
  'STR-000112':{owner:'Ravi Sharma',      email:'ravi.sharma@greenmart.in',      mobile:'+91 98220 41122',aadhaar:'541288903321',pan:'AKPRS3421L',gst:'27AKPRS3421L1ZP',entity:'Sole Proprietor / Self-employed',registered:'28 Jul 2026'},
  'STR-000114':{owner:'Meghana Rao',      email:'meghana@nandinidairy.co.in',    mobile:'+91 99012 77340',aadhaar:'773410026645',pan:'BQZPR8812M',gst:'',              entity:'Individual',                      registered:'29 Jul 2026'},
  'STR-000108':{owner:'Imran Qureshi',    email:'imran.q@greenleaf.in',          mobile:'+91 90283 11907',aadhaar:'640219938852',pan:'CJKPQ1190H',gst:'27CJKPQ1190H1Z4',entity:'Sole Proprietor / Self-employed',registered:'27 Jul 2026'},
  'STR-000109':{owner:'Sneha Kulkarni',   email:'sneha@vasantmedico.com',        mobile:'+91 97654 20881',aadhaar:'220876541190',pan:'DLMPK7743Q',gst:'27DLMPK7743Q1Z9',entity:'Private/Public Limited',          registered:'25 Jul 2026'},
  'STR-000110':{owner:'Naveen Bansal',    email:'naveen@bansalhardware.in',      mobile:'+91 93027 66512',aadhaar:'118834470092',pan:'EPQRB2298K',gst:'23EPQRB2298K1Z7',entity:'Partnership',                     registered:'29 Jul 2026'},
  'STR-000111':{owner:'Anjali Deshmukh',  email:'anjali@anjalistationers.in',    mobile:'+91 91456 30278',aadhaar:'905512330147',pan:'FRTPD6650N',gst:'',              entity:'Individual',                      registered:'26 Jul 2026'},
  'STR-000104':{owner:'Rohit Kadam',      email:'rohit@rohitmobileworld.in',     mobile:'+91 98765 12009',aadhaar:'330298871264',pan:'GHJPK4417R',gst:'27GHJPK4417R1Z2',entity:'Sole Proprietor / Self-employed',registered:'28 Jul 2026'},
  'STR-000106':{owner:'Sagar Pawar',      email:'sagar@sagarfoods.co.in',        mobile:'+91 90118 45523',aadhaar:'447790215538',pan:'HKLPS9903T',gst:'27HKLPS9903T1Z6',entity:'Private/Public Limited',          registered:'30 Jul 2026'},
  'STR-000097':{owner:'Latha Menon',      email:'latha@kaveritextiles.in',       mobile:'+91 94422 80016',aadhaar:'662104459930',pan:'JMNPL5528V',gst:'33JMNPL5528V1Z1',entity:'Partnership',                     registered:'22 Jul 2026'},
  'STR-000099':{owner:'Prakash Jadhav',   email:'prakash@mahalaxmistore.in',     mobile:'+91 95279 33408',aadhaar:'889903117746',pan:'KPQRJ3364W',gst:'',              entity:'Individual',                      registered:'20 Jul 2026'},
  'STR-000088':{owner:'Farhan Shaikh',    email:'farhan@deccanwholesale.in',     mobile:'+91 99490 12277',aadhaar:'214467790035',pan:'LRSTF7719X',gst:'36LRSTF7719X1Z8',entity:'Limited Liability Partnership (LLP)',registered:'14 Jul 2026'},
  'STR-000091':{owner:'Neha Kulkarni',    email:'neha@sunrisebakers.in',         mobile:'+91 98901 64432',aadhaar:'556621009984',pan:'MTUPN2205Y',gst:'27MTUPN2205Y1Z3',entity:'Sole Proprietor / Self-employed',registered:'12 Jul 2026'}
};
function soSignupFor(d){return (d&&soBhaiyaaSignup[d.ref])||null;}
/* The steps that apply to THIS record. A halt step belongs only to the record whose run halted
   in that stage; for everyone else the stage is the two or three automated steps and nothing
   more. Because every halt step is authored last, filtering it out never shifts an index that
   `sub` already points at — which is what lets one integer describe position in both cases. */
function soSteps(d,stageId){
  return (soSubStatuses[stageId]||[]).filter(function(s){return !s.halt||d.halted===stageId;});
}
function soStageById(id){return soPipelineStages.find(function(s){return s.id===id;})||null;}
function soStageIndex(id){return soPipelineStages.findIndex(function(s){return s.id===id;});}
/* == LIVE RUNS ============================================================================
   Stores that came from the real Bhaiyaa, sitting alongside the twelve seeded ones above.
   Kept in a separate array and concatenated rather than pushed into soRuns, so the two never
   get confused for each other: a seeded run is a story and a live one is a record, and only
   one of them survives a refresh. Every function that reads the board goes through
   soRunsAll(), which is the single place that decides the board is both. == */
let soLiveRuns=[];
// Live first, seeded after. A store that arrived minutes ago is the thing an Ops Manager came to
// this board for; the twelve fixtures are scenery and can wait below the fold.
function soRunsAll(){return soLiveRuns.concat(soRuns);}
function soStageCount(id){return soRunsAll().filter(function(d){return d.stage===id;}).length;}
function soRunsForStage(id){const all=soRunsAll();return id?all.filter(function(d){return d.stage===id;}):all;}
function soSubIndex(d){const steps=soSteps(d,d.stage);return Math.min(d.sub||0,Math.max(0,steps.length-1));}
function soCurrentSub(d){return soSteps(d,d.stage)[soSubIndex(d)]||null;}
function soIsHalted(d){return d.halted===d.stage;}
/* Same invariant as the deal board: a record never rests on an automated step, because an
   automated step is not a task. The one exception is the terminal stage, where there is
   nothing after it to roll into. */
function soSkipAutoSteps(d){
  const skipped=[];let guard=0;
  while(guard++<40){
    const steps=soSteps(d,d.stage);
    const idx=Math.min(d.sub||0,Math.max(0,steps.length-1));
    const cur=steps[idx];
    if(!cur||!cur.auto)break;
    if(idx<steps.length-1){skipped.push(cur.label);d.sub=idx+1;continue;}
    const next=soPipelineStages[soStageIndex(d.stage)+1];
    if(!next)break;
    skipped.push(cur.label);
    d.stage=next.id;d.sub=0;
  }
  return skipped;
}
/* Four kinds, same as the deal board, and the reasoning is identical: auto is checked first so
   an automated step can never grow a manual button just because the accountable role is signed
   in. 'Merchant' behaves the way 'Client' does over there — external, chase-able, never
   tickable on their behalf. */
function soNextAction(d){
  const step=soCurrentSub(d);
  if(!step)return {kind:'wait',label:'Nothing to do',owner:'&mdash;',step:null};
  const owner=step.owner;
  if(step.auto)return {kind:'auto',label:'Runs automatically',owner:owner,step:step};
  if(amCanAdvance(owner))return {kind:'do',label:step.act||'Mark done',owner:owner,step:step};
  if(owner==='Merchant')return {kind:'chase',label:'Send reminder',owner:owner,step:step};
  return {kind:'wait',label:'Waiting on '+owner,owner:owner,step:step};
}
const soExtraLog={};
/* `at` is where the note BELONGS, not where the record is standing when it is written, and the
   two are routinely different: a note on the last step of a stage is written by the same call
   that moves the record into the next one, so reading d.stage here would file it under a stage
   the step was never in. Callers that are not moving anything (a reminder) pass nothing and get
   the current position, which for them is the same thing. */
function soPushNote(d,label,note,at){
  const stage=(at&&at.stage)||soStageById(d.stage)||{};
  const now=new Date();const h=now.getHours();
  (soExtraLog[d.id]=soExtraLog[d.id]||[]).unshift({
    stage:stage,stageNo:stage.n,subNo:(at?at.subNo:soSubIndex(d)+1),
    sub:{label:label},
    owner:amOwnerInfo('Ops Manager'),ownerRole:'Ops Manager',
    state:'note',
    date:now.getDate()+' '+amMonths[now.getMonth()]+' '+now.getFullYear(),
    time:(h%12||12)+':'+String(now.getMinutes()).padStart(2,'0')+' '+(h>=12?'PM':'AM'),
    note:note
  });
}
/* Derived from stage + sub, never stored, for the same reason the deal board derives its own:
   a hand-kept trail and a record position drift apart and then neither can be trusted. Steps
   that do not apply to this record are absent from soSteps, so they cannot appear here as
   things that happened. */
function soRunLog(d){
  const curStageIdx=soStageIndex(d.stage);
  const entries=[];
  soPipelineStages.forEach(function(st,si){
    if(si>curStageIdx)return;
    const steps=soSteps(d,st.id);
    const upto=si<curStageIdx?steps.length:Math.min(d.sub||0,steps.length-1)+1;
    steps.slice(0,upto).forEach(function(sub,i){
      const isLive=si===curStageIdx&&i===upto-1;
      entries.push({stage:st,stageNo:st.n,sub:sub,subNo:i+1,
        owner:amOwnerInfo(sub.owner),ownerRole:sub.owner,
        state:isLive?'current':'done',
        breach:!!(isLive&&d.breach)});
    });
  });
  const total=entries.length;
  entries.forEach(function(e,i){
    const stamp=amShiftDate(d.updated,(total-1-i)*2);
    e.date=stamp.date;e.time=stamp.time;
  });
  entries.reverse();
  return (soExtraLog[d.id]||[]).concat(entries);
}
// Stage-level expectations, in the merchant's terms rather than a duration nobody can act on.
const soStageSla={'store-details':'2 days, then chase','kyc':'Seconds, unless it halts','store-creation':'Minutes, unless Bhaiyaa refuses','store-live':'1 day to finish the details'};
let soPipelineStage='';
/* Set while the journey's KYC screen is verifying an EXISTING board record rather than a signup
   being filled in right now. It is the whole difference between the two modes: null means the
   screen belongs to a new store and its CTA creates one, an id means it belongs to this run and
   its CTA advances that. */
let soKycRunId=null;
let soKycVerified=false;
const SO_PAGE_SIZE=10;
let soPage=1;
let soSelectedId=null,soRunTab='basic-details';
// Seeds may sit on an automated step; roll them forward once so the invariant above holds from
// the first render. Halted records stop on their halt step and stay there, which is the point.
soRuns.forEach(function(d){soSkipAutoSteps(d);});

/* -- A backend store row -> a board run.
   The stage is DERIVED, never stored twice: a store arrives from Bhaiyaa with its signup already
   finished (that is the only reason we know about it), so it lands on KYC, and clearing KYC is
   what moves it on. Storing "which stage" alongside kyc_status would give the badge and the
   timeline two sources to disagree about, which is the bug the client status form exists to
   avoid.
   Bhaiyaa's signup captures none of category, turnover band or city, so those are placeholders
   and say so — an em-dash reads as "not known", which is true, where an invented band would
   read as something the merchant chose. -- */
function soRunFromStore(s,idx){
  const verified=String(s.kyc_status||'').toLowerCase()==='verified';
  return {
    id:100000+idx,
    live:true,
    code:s.store_code,
    ref:s.store_code,
    bhaiyaaRef:s.source_record_id,
    store:s.store_name||'Untitled store',
    merchant:s.first_name||'—',
    role:s.role||'seller',
    category:s.store_type||'—',
    band:'—',
    city:'—',
    kycStatus:s.kyc_status||'Pending',
    updated:soFormatStoreDate(s.updated_at||s.created_at),
    age:soDaysSince(s.created_at),
    // Signup is done by definition; KYC is the outstanding gate. Once it clears, the store is
    // already registered on Bhaiyaa — that is where it came from — so it goes straight to the
    // terminal stage rather than pretending to run a creation it never performed.
    stage:verified?'store-live':'kyc',
    sub:0
  };
}
function soFormatStoreDate(iso){
  const d=new Date(iso);
  if(isNaN(d))return '—';
  return d.getDate()+' '+amMonths[d.getMonth()]+' '+d.getFullYear();
}
function soDaysSince(iso){
  const d=new Date(iso);
  if(isNaN(d))return 0;
  return Math.max(0,Math.floor((Date.now()-d.getTime())/86400000));
}
/* -- Fetches the synced stores and rebuilds the live half of the board. Called on entering the
   page and after a poll; never merges in place, because a rebuild from the server is the only
   version of this list anyone should trust. -- */
let soLiveLoaded=false;
function soLoadLiveRuns(){
  return execApiListStores({pageSize:200}).then(function(res){
    if(!res.ok||!res.data)return false;
    const rows=(res.data.stores||[]).filter(function(s){return s.source==='bhaiyaa'&&s.source_record_id;});
    // Newest first within the live block, so the store that just arrived is the top row of the
    // board rather than the bottom of its own group. Sorted here rather than relying on whatever
    // order the listing endpoint happened to return.
    rows.sort(function(a,b){return String(b.created_at||'').localeCompare(String(a.created_at||''));});
    soLiveRuns=rows.map(soRunFromStore);
    soLiveLoaded=true;
    return true;
  });
}

let openDropdowns=new Set();
let activeSidebarItem='dashboard';
/* == WHAT EACH PERSONA'S SIDEBAR HOLDS ====================================================
   Entity User is one portal role standing in for nine enterprise personas, and until now all
   nine saw the same twenty-four modules. A Deal Manager whose entire job is approving a price
   was given Payheads, Salary View, Leave Policies and Bhaiyaa store creation; an IT Systems
   Admin who provisions access was given Contract Templates and Payments. That is not a nav, it
   is a directory of everything the product can do, and it made the one question a sidebar
   exists to answer — what am I here to do — unanswerable from the sidebar.

   THREE TIERS, AND THE MIDDLE ONE IS THE ONE PEOPLE FORGET.

     the spine    Dashboard, AI Executive, My Runs, My Tasks, Support. Everyone, because
                  everyone runs journeys through this layer and everyone gets work handed back.
     self-service Leaves and Timesheet. Everyone, because everyone is ALSO an employee. This is
                  load-bearing, not a courtesy: dashboardTabsForRole drops the employee tab for
                  the Account Manager and the Ops Manager explicitly ON THE GROUNDS that these
                  rows stay one click away in the sidebar. Trimming them by ownership would
                  quietly take back what that decision spent.
     the work     Everything else, per persona, derived from the `focus` and `journeys` each
                  persona already declares in enterprisePersonas. Nothing here is invented; if
                  a module is not in a persona's list it is because that persona's own
                  description does not reach it.

   A TABLE, NOT `personas:` ON EVERY ENTRY. The per-entry gate that create-client and
   master-data used to carry is gone, folded in here. Two mechanisms answering "who sees this"
   is how one of them stops being updated — and more practically, a rule spread across twenty
   entries cannot be read, while this can be read top to bottom and checked against the persona
   list beside it. ccj-harness asserts both directions: every entity-user module is accounted
   for by some persona, and every id named here still exists in the sidebar.

   THIS IS CURATION, NOT AUTHORISATION, and canAccessPage is deliberately left alone. My Tasks,
   dashboard tiles and journey handoffs all legitimately land a persona on a record outside
   their own modules — a compliance officer opening the contract they just cleared, a finance
   approver opening the deal behind an invoice. Wiring this table into the router would break
   every one of those crossings, which are the operating model this app exists to show. == */
const PERSONA_SHARED_MODULES=[
  'dashboard','ai-executive','my-runs','my-tasks',      // the spine
  'all-leaves','timesheet',                             // everyone is also an employee
  'chats','support-tickets','ccjv1-journey',            // Support: belongs to nobody's daily work
  /* -- THE WORKSPACE TEN, shared rather than split across the nine personas. The zone was
     rebuilt around the seller platform's own modules and nothing behind those rows is persona-
     specific yet — a per-persona split now would be inventing an operating model the pages do
     not have. Narrow it here, one id at a time, once each module knows who works it; until
     then an unlisted id is invisible to all nine, which would empty the zone entirely. -- */
  'team-management','store-management','orders-billing','products-inventory','category',
  'community','staff-roles','pricing-discounts','reports-analytics','settings-support'
];
/* THE `journey-*` IDS ARE SIDEBAR ROWS, NOT PAGES. Each one is journey-<cfgJourneys id> and
   opens viewAIJourney. They are listed per persona from the SAME source the rest of this table
   is derived from — enterprisePersonas[].journeys — so a persona sees a journey row only if it
   owns that journey. Three personas (hr-manager, it-systems-admin, finance-approver) own only
   journeys with no row, and for them the whole Journeys zone drops out, which is why that zone
   is a `group` rather than a `section`. */
const personaModules={
  // Owns the client relationship and the commercial half of the journey: creates the record,
  // raises the request, carries the quote. No workforce, no payroll — a placement becomes an
  // employee under someone else's hands, and the deal board already names the person on each row.
  'account-manager':['create-client','master-data','contracts'],
  // An approver, not a browser. Two reads — the deal in front of them and the rules a price is
  // checked against — and nothing else. The queue arrives through My Tasks.
  'deal-manager':['master-data','contracts','rates-rules'],
  // Owns the Compliance Hub outright, plus what it is applied to: the client being screened, the
  // contract being checked, the template the MSA is drafted from, the people behind J3-S4.
  'compliance-officer':['master-data','contracts','contract-templates','compliance','rates-rules','employees'],
  // Generates contracts and tracks signature. Templates are this persona's instrument; Compliance
  // Items are what a legal correction is usually answering.
  'legal-contracts-manager':['master-data','contracts','contract-templates','compliance'],
  /* Two journeys, one persona. Signed-contract verification and operational readiness on the
     contract side; the whole Bhaiyaa store journey on the other — every stage of which names
     Ops Manager or an agent, and this is the only persona with the Store Operations board. */
  'ops-manager':['master-data','contracts','create-store','stores','employees','teams','compliance'],
  // The widest of the nine, and legitimately so: onboarding, payroll, benefits, attendance and
  // lifecycle are one persona's execution. Contracts because onboarding runs against one.
  'hr':['employees','teams','contracts','compliance','leave-policies','payroll','payheads','salary-view'],
  // The approver above HR. Same surfaces minus the contract: a policy deviation, a role change
  // and a salary revision are all decided against the employee record, not the client's paper.
  'hr-manager':['employees','teams','compliance','leave-policies','payroll','payheads','salary-view'],
  // Provisions and revokes access, so it needs to know who and which team — and nothing else in
  // this product. Integrations live under Configure, which is an admin role rather than a persona.
  'it-systems-admin':['employees','teams'],
  // Approves what is calculated and authorises what leaves. Payments is its own; the deal and the
  // client are what an invoice is raised against; Employees is who is being paid.
  'finance-approver':['master-data','contracts','employees','payroll','payheads','salary-view','payments']
};
/* == PAGE ACTIONS: CURATED, BUT NOT NAV ROWS =============================================
   Create Client and Create Store left the sidebar — a create action is something you do ON a
   page, not a place you go, so they are buttons on the listing each one fills.

   THEY STAY IN personaModules ANYWAY, and that is the point of this list. Who may open a
   store is a real permission (every stage of soPipelineStages waits on the Ops Manager or an
   agent), and moving the button onto a page every persona can read would have quietly handed
   that permission to all nine. The button asks personaSeesModule exactly as the nav row did.

   Declared here rather than inferred, because the harness's ghost check reads it: a module in
   personaModules with no sidebar row is normally a rename that rotted, and the only way to
   tell that apart from a deliberate page action is to write the deliberate ones down. == */
const PERSONA_PAGE_ACTIONS=['create-client','create-store'];
/* Mirrors sidebarRoleAllows for something that is not a sidebar entry: portal role first, then
   the persona narrowing that only applies inside Entity User. Super Admin is excluded by the
   `roles` argument at each call site — it configures what an object is, it does not fill one in. */
function canUsePageAction(id,roles){
  if(roles&&roles.indexOf(portalRole)===-1)return false;
  if(portalRole==='entity-user'&&!personaSeesModule(id))return false;
  return true;
}
function personaPageActions(){return PERSONA_PAGE_ACTIONS.filter(personaSeesModule);}
/* Unlisted means hidden, on purpose: a module added without a line in the table above disappears
   for every persona, which is loud, immediate and caught by the harness — where the old default
   silently showed it to all nine and nobody noticed for twenty-four modules. */
function personaSeesModule(id){
  if(PERSONA_SHARED_MODULES.indexOf(id)>-1)return true;
  const own=personaModules[activePersonaId];
  return !!own&&own.indexOf(id)>-1;
}
/* == THE SIDEBAR ==========================================================================
   Two zones, and the split is by WHAT A ROW IS, not by which department owns it.

     AI Execution Layer  The layer itself: the journey launcher, its analytics, the two
                         personal queues, and the four screens that define what it can run.
                         Boxed and dotted, because this block is the product.
     Workspace           The connected product's own records — what a run reads and writes,
                         and what a person browses between runs.

   NO GOVERN ZONE. Audit Trail, Approvals & Controls, Data Boundary, Access & Roles and
   Value & Usage were five new rows against nothing built, and a menu that lists five empty
   rooms reads as a menu of empty rooms. They belong here when there is something behind them.

   WHAT THIS SHAPE CORRECTS. An earlier pass folded Dashboard into the launcher and built a
   "Journeys" zone out of Leaves, Timesheet, Payroll and Compliance Items. Both were wrong,
   and the code says why:

     - Dashboard is not one page. dashboardTabsForRole resolves to THIRTEEN role boards plus
       employee self-service. The launcher lists journeys you can START. Different questions.
     - The product already HAS a journey called Hire to Retire, with its own runs, category
       and locked roadmap, inside cfgJourneys. Building a second thing with that name out of
       HR pages would have put two different Hire to Retires in one product. AI Executive was
       already the journey launcher; the only thing wrong with it was its name.

   BOTH ZONES ARE A `group`. A group whose children are all filtered out is dropped label and
   all (getSidebarItems), where a bare section heading would have survived and rendered an
   empty zone. Nothing hits that today — both zones hold shared modules — but it is the
   behaviour any new zone should inherit. == */
const sidebarItems=[
  {group:'AI Execution Layer',dot:true,box:true,roles:['super-admin','entity-admin','entity-user'],items:[
    /* -- FIRST ROW, and moved up out of Workspace. Dashboard is where a role starts the day —
       dashboardTabsForRole resolves it to thirteen role boards plus employee self-service — so it
       belongs at the head of the block that IS the product, above the launcher that runs journeys
       from it. Workspace below is now the connected product's own modules and nothing else. --   */
    {id:'dashboard',label:'Dashboard',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'},
    /* Was "AI Executive". This page IS the journey launcher — it lists Client Creation, Hire
       and Onboard, Store Creation, Payroll Creation and Hire to Retire, plus the six locked
       roadmap journeys, filtered by O2C / P2P / H2R / F2A. It already does everything a
       Journeys zone would do; it was only ever named after the layer instead of its contents. */
    {id:'ai-executive',label:'Journeys',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="9" y="15" width="6" height="6" rx="1.5"/><path d="M6 9v2a3 3 0 0 0 3 3M18 9v2a3 3 0 0 1-3 3"/></svg>'},
    /* Agent & Model Analytics. It measures how the agents and models are performing, so it
       belongs beside the launcher that runs them — and it is NOT renamed to "Ask": it is not
       a question box over business data.

       HIDDEN. Super Admin was the only role that ever had it, so withdrawing it there withdraws
       it everywhere — there is no other audience to fall back to. Kept as an entry with an empty
       role list rather than deleted: the page and its builder are intact, and putting a role back
       in this array is the whole of turning it on again. `roles:[]` denies everyone, because the
       sidebar filter tests `includes` rather than truthiness (see line ~1531), and the route is
       closed to match in pageRoleMap — a page hidden from the menu but reachable by a stale link
       is not hidden. */
    {id:'ai-analytics',label:'Analytics',roles:[],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/></svg>'},
    // -- What is waiting on you: the exception and approval cards a run hands back. --
    {id:'my-tasks',label:'My Tasks',roles:['entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M8 12l2.5 2.5L16 9"/></svg>'},
    /* Keeps its name. The list filters on WHO STARTED THE RUN — agent and manual alike — and
       holds it after it moves to someone else and after it completes. It really is yours;
       "Live Runs" would have promised a firehose this page does not show. */
    {id:'my-runs',label:'My Runs',roles:['entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5h16M4 12h16M4 18.5h9"/><circle cx="18.5" cy="18.5" r="3"/><path d="M18.5 17.2v1.5l1 .8"/></svg>'},
    /* Keeps its name too. The block heading above already says AI Execution Layer, which is
       where the branding belongs — renaming this dropdown would only repeat the heading. */
    {dropdown:'Configure',roles:['super-admin','entity-admin'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"/></svg>',children:[
    {id:'cfg-systems',label:'Systems',roles:['super-admin','entity-admin'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.2 10.8 15.8 7.2M8.2 13.2l7.6 3.6"/></svg>'},
      // -- Entity Admin sees this: the objects a journey reads and writes are context it needs
      // when wiring Context & Journey. Creating and destroying an object stays Super Admin
      // (cfg-model-add), the same split Systems draws with cfg-system-add.
      // Labelled "Data models" to match the Dashboard tile that links here (js/pages.js
      // buildDashboardHTML) — one destination was reading as two places under two names. The
      // page id stays cfg-data-foundation: it is wired into pageRoleMap, getSidebarActivePage
      // and every cfgBackBtn target, and none of that is user-visible. --
    {id:'cfg-data-foundation',label:'Data models',roles:['super-admin','entity-admin'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/></svg>'},
    {id:'cfg-context-journey',label:'Context & Journey',roles:['super-admin','entity-admin'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M6 8.2V15a3 3 0 0 0 3 3h6.8"/></svg>'},
    {id:'cfg-agents',label:'Agents',roles:['super-admin','entity-admin'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3c.3 3.6 1.4 4.7 5 5-3.6.3-4.7 1.4-5 5-.3-3.6-1.4-4.7-5-5 3.6-.3 4.7-1.4 5-5Z"/></svg>'}
    ]}
  ]},
  /* == WORKSPACE ============================================================================
     REBUILT AROUND THE SELLER PLATFORM. Every row that stood here — People, Clients & Stores,
     Contracts, Time & Pay, Policies & Rates, Compliance and Payments — is replaced by the ten
     modules below. Dashboard left too, upward: it now heads the AI Execution Layer block,
     because it is where a role starts the day rather than a record it browses between runs.

     THE PAGES BEHIND THE OLD ROWS ARE NOT DELETED. Employees, Teams, Contracts, Templates,
     Payroll, Salary view, Leaves, Timesheet, Clients, Stores, Leave policies, Payheads, Rates &
     rules, Compliance and Payments all still render, and are still reached from dashboard tiles,
     My Tasks and every journey handoff. Only their nav rows are gone. personaModules still names
     them for exactly that reason — it curates what a persona may open, and emptying it would
     break the crossings this app exists to show. Read its header before touching it.

     FLAT ROWS, NOT DROPDOWNS. Each of the ten is one destination, so each is an `id` row. A
     dropdown with no children is dropped label and all by sidebarEntryKept, which is the right
     behaviour and the reason none of these is one yet: what turns any of them into an
     expandable group is a `children` list, not a flag. == */
  {group:'Workspace',roles:['super-admin','entity-admin','entity-user'],items:[
    {id:'team-management',label:'Team Management',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'},
    {id:'store-management',label:'Store & Management',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9.5 4.8 4h14.4L21 9.5"/><path d="M3 9.5h18a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 11.8V20h14v-8.2"/></svg>'},
    {id:'orders-billing',label:'Orders and Billing',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h12a1 1 0 0 1 1 1v19l-3-2-3 2-3-2-3 2V3a1 1 0 0 1 1-1z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/></svg>'},
    {id:'products-inventory',label:'Products & Inventory',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>'},
    {id:'category',label:'Category',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><circle cx="17.5" cy="17.5" r="3.5"/></svg>'},
    {id:'community',label:'Community',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3"/><path d="M6.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="4.5" cy="10.5" r="2"/><circle cx="19.5" cy="10.5" r="2"/></svg>'},
    {id:'staff-roles',label:'Manage Staff and Roles',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>'},
    {id:'pricing-discounts',label:'Pricing & Discounts',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.4" cy="7.4" r="1.3"/><line x1="10.5" y1="16.5" x2="16.5" y2="10.5"/></svg>'},
    {id:'reports-analytics',label:'Reports & Analytics',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/></svg>'},
    {id:'settings-support',label:'Settings & Support',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"/></svg>'}
  ]},
  /* Below the line: things that belong to nobody's daily work. Support sat between Finance and
     Payroll and competed for attention with the work; a helpdesk is not a business module. */
  {divider:true},
  {dropdown:'Support',roles:['super-admin','entity-admin','entity-user'],color:'indigo',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',children:[
    {id:'chats',label:'Chats',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>'},
    {id:'support-tickets',label:'Tickets',roles:['super-admin','entity-admin','entity-user'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3z"/><path d="M13 5v14"/></svg>'},
    /* -- The frozen V1 snapshot of the contract-creation journey (js/contract-journey-v1.js).
       The live journey is being redesigned; this row is how the finished look it had before
       that stays reachable, unchanged, for as long as it is worth comparing against.

       An `action` rather than a page id, because what it opens is a run, not a route the
       router knows. The typeof guard means a missing contract-journey-v1.js degrades to a
       dead row rather than a console error on click. -- */
    {id:'ccjv1-journey',label:'Contract Journey V1',roles:['super-admin','entity-admin','entity-user'],color:'indigo',action:()=>{if(typeof ccjv1StartNewRun==='function')ccjv1StartNewRun();},icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8 16 10 18 13 14"/></svg>'}
  ]},
  {dropdown:'Administration',roles:['super-admin'],color:'slate',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"/></svg>',children:[
    {id:'settings',label:'Company Settings',roles:['super-admin'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1"/></svg>'},
    {id:'all-users',label:'Users',roles:['super-admin'],color:'orange',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>'}
  ]}
];


/* -- `roles` gates by portal role. Inside Entity User — one role standing in for nine enterprise
   personas — personaModules narrows it further, per module. Only entries with an `id` are gated:
   a group, a dropdown, a divider and a section heading are containers, and whether one survives
   is decided by whether any child did, which sidebarEntryKept already answers. -- */
function sidebarRoleAllows(it){
  if(it.roles&&!it.roles.includes(portalRole))return false;
  if(portalRole==='entity-user'&&it.id&&!personaSeesModule(it.id))return false;
  return true;
}
// -- Drops the children this role cannot see; a dropdown left with none is filtered out by the caller. --
function filterSidebarEntry(it){
  if(!it.dropdown)return it;
  return Object.assign({},it,{children:(it.children||[]).filter(sidebarRoleAllows)});
}
function sidebarEntryKept(it){return !it.dropdown||it.children.length>0;}
function getSidebarItems(){
  return sidebarItems
    .filter(sidebarRoleAllows)
    .map(it=>{
      // A group carries its own list of modules, each filtered exactly like a top-level entry.
      if(it.group)return Object.assign({},it,{items:(it.items||[]).filter(sidebarRoleAllows).map(filterSidebarEntry).filter(sidebarEntryKept)});
      return filterSidebarEntry(it);
    })
    .filter(it=>it.group?it.items.length>0:sidebarEntryKept(it));
}

const ctxMap={dashboard:'You\'re on the <b>Dashboard</b>. I can help you understand metrics, navigate sections, or start any workflow.',people:'You\'re viewing <b>People</b>. I can help search employees, filter by country, or explain statuses.',contracts:'You\'re on <b>Contracts</b>. I can help create, review, or modify contracts.',payroll:'You\'re viewing <b>Payroll</b>. I can help with salary calculations or running payroll.',compliance:'You\'re on the <b>Compliance Hub</b>. I can check requirements for specific countries.',settings:'You\'re in <b>Company Settings</b>. I can help configure account or manage permissions.',teams:'You\'re viewing <b>Teams</b>. I can help manage team structures.',leaves:'You\'re on <b>Leaves</b>. I can help with leave policies and applications.',payments:'You\'re viewing <b>Payments</b>. I can help track invoices and payment history.',support:'You\'re on <b>Support</b>. I\'m here to help with any questions.'};

const sidebarToggleSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="14" rx="2"/><line x1="15" y1="5" x2="15" y2="19"/></svg>';
const chevronSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg>';
const rowActionSvg='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
const supportPageMeta={
  dashboard:{title:'Dashboard',context:'Dashboard',filters:['Country','Team','Status'],columns:['S. No','Metric','Scope','Value','Trend','Status'],rows:[[1,'Headcount','All entities','247','+12 this month','Active'],[2,'Active Teams','6 countries','18','Stable','Active'],[3,'Open Tasks','Operations','24','Needs review','Pending'],[4,'Invoices','Finance','10','Generated','Active'],[5,'Compliance Checks','Global','14','3 due soon','Pending'],[6,'Contracts','Workforce','25','15 drafts','Active']]},
  people:{title:'People',context:'People',filters:['Country','Worker Type','Status'],columns:['S. No','Name','Country','Worker Type','Team','Status'],rows:[[1,'Anika Shah','Netherlands','EOR','Engineering','Active'],[2,'Rahul Mehta','India','Contractor','Product','Active'],[3,'Maya Vos','Netherlands','PEO','Finance','Inactive'],[4,'Luis Martin','Spain','EOR','Sales','Active'],[5,'Nora Kim','Germany','Contractor','Design','Pending'],[6,'Owen Clark','United Kingdom','EOR','Operations','Active']]},
  teams:{title:'Teams',context:'Teams',filters:['Country','Department','Status'],columns:['S. No','Team','Department','Country','Members','Status'],rows:[[1,'Core Payroll','Finance','Netherlands','18','Active'],[2,'People Ops','HR','India','12','Active'],[3,'Compliance Desk','Legal','Germany','7','Active'],[4,'Entity Setup','Operations','Spain','9','Pending'],[5,'Customer Success','Support','United Kingdom','21','Active'],[6,'Local Admin','Admin','Netherlands','4','Inactive']]},
  contracts:{title:'Contracts',context:'Contracts',filters:['Country','Type','Status'],columns:['S. No','Contract Name','Country','Worker Type','Start Date','Status'],rows:[[1,'Netherlands EOR - Anika','Netherlands','EOR','12 May 2026','Active'],[2,'India Contractor - Rahul','India','Contractor','18 Apr 2026','Active'],[3,'Germany PEO - Nora','Germany','PEO','Pending','Pending'],[4,'Spain EOR - Luis','Spain','EOR','01 May 2026','Active'],[5,'UK EOR - Owen','United Kingdom','EOR','15 Mar 2026','Active'],[6,'Netherlands PEO - Maya','Netherlands','PEO','Expired','Inactive']]},
  leaves:{title:'Leaves',context:'Leaves',filters:['Country','Leave Type','Status'],columns:['S. No','Employee','Country','Leave Type','Dates','Status'],rows:[[1,'Anika Shah','Netherlands','Annual Leave','20-24 May','Active'],[2,'Rahul Mehta','India','Sick Leave','09 May','Pending'],[3,'Luis Martin','Spain','Parental Leave','Jun-Jul','Active'],[4,'Nora Kim','Germany','Annual Leave','14-18 May','Pending'],[5,'Owen Clark','United Kingdom','Holiday','27 May','Active'],[6,'Maya Vos','Netherlands','Sick Leave','Closed','Inactive']]},
  payroll:{title:'Payroll',context:'Payroll',filters:['Country','Cycle','Status'],columns:['S. No','Cycle','Country','Employees','Gross Pay','Status'],rows:[[1,'May 2026','Netherlands','41','EUR 184,200','Active'],[2,'May 2026','India','83','INR 9,840,000','Pending'],[3,'April 2026','Germany','19','EUR 92,450','Active'],[4,'April 2026','Spain','22','EUR 78,110','Active'],[5,'March 2026','United Kingdom','28','GBP 116,700','Active'],[6,'March 2026','Netherlands','39','EUR 176,900','Inactive']]},
  payments:{title:'Payments',context:'Payments',filters:['Country','Category','Status'],columns:['S. No','Invoice','Country','Category','Amount','Status'],rows:[[1,'INV-2048','Netherlands','Payroll','EUR 184,200','Active'],[2,'INV-2047','India','Contractor','INR 2,410,000','Pending'],[3,'INV-2046','Germany','Compliance','EUR 4,250','Active'],[4,'INV-2045','Spain','Payroll','EUR 78,110','Active'],[5,'INV-2044','United Kingdom','Benefits','GBP 8,720','Inactive'],[6,'INV-2043','Netherlands','Entity Setup','EUR 12,600','Active']]},
  compliance:{title:'Rates & Rules',context:'Compliance Hub',filters:['Country','Category','Status'],columns:['S. No','Country','Rule Name','Category','Applicable To','Value / Rate','Status'],rows:[[1,'Netherlands','Minimum Wage','General','EOR / PEO','EUR 14.71','Active'],[2,'Netherlands','Income Tax Bracket 1','Income Tax','EOR','35.75%','Inactive'],[3,'Netherlands','Unemployment Insurance','Social Security','EOR','2.74%','Active'],[4,'Netherlands','Disability Insurance','Social Security','EOR','6.27%','Inactive'],[5,'Netherlands','Holiday Allowance','Benefits','EOR / PEO','8.00%','Active'],[6,'Netherlands','Health Insurance Levy','Health Ins.','PEO','6.10%','Inactive'],[7,'Netherlands','Childcare Levy','Social Security','PEO','0.50%','Inactive']]},
  settings:{title:'Company Settings',context:'Company Settings',filters:['Area','Owner','Status'],columns:['S. No','Setting','Area','Owner','Updated','Status'],rows:[[1,'Entity Profile','Company','Pallavi Parate','Today','Active'],[2,'Bank Details','Finance','Finance Ops','Yesterday','Pending'],[3,'Permissions','Access','Admin','06 May 2026','Active'],[4,'Notifications','Workspace','People Ops','02 May 2026','Active'],[5,'Billing Contacts','Finance','Admin','29 Apr 2026','Inactive'],[6,'Audit Logs','Security','System','Live','Active']]},
  support:{title:'Support',context:'Support',filters:['Topic','Priority','Status'],columns:['S. No','Ticket','Topic','Owner','Updated','Status'],rows:[[1,'SUP-1018','Payroll question','ADT Support','Today','Active'],[2,'SUP-1017','Contract review','Legal Desk','Yesterday','Pending'],[3,'SUP-1016','Compliance rates','Compliance Desk','06 May 2026','Active'],[4,'SUP-1015','Payment proof','Finance Ops','04 May 2026','Active'],[5,'SUP-1014','Account access','Admin','Closed','Inactive'],[6,'SUP-1013','Entity setup','Operations','01 May 2026','Active']]},
  // -- New page behind the Salary View row under Time & Payroll. It carries a full meta rather
  // than a title alone because buildListingHTML reads filters/columns/rows off it; a partial
  // entry would throw on the first render. --
  'salary-view':{title:'Salary View',context:'Salary View',filters:['Country','Cycle','Status'],columns:['S. No','Employee','Employee ID','Cycle','Gross Pay','Deductions','Net Pay','Status'],rows:[
    [1,'Anika Shah','EMP003','May 2026','EUR 6,200','EUR 1,410','EUR 4,790','Active'],
    [2,'Rahul Mehta','EMP004','May 2026','INR 210,000','INR 38,500','INR 171,500','Pending'],
    [3,'Pallavi Parate','EMP002','May 2026','INR 185,000','INR 33,900','INR 151,100','Active'],
    [4,'Luis Martin','EMP007','April 2026','EUR 5,400','EUR 1,620','EUR 3,780','Active'],
    [5,'Nora Kim','EMP009','April 2026','EUR 4,850','EUR 1,455','EUR 3,395','Inactive'],
    [6,'Owen Clark','EMP011','April 2026','GBP 4,700','GBP 1,128','GBP 3,572','Active']
  ]},
  'all-leaves':{title:'All Leaves',context:'All Leaves',filters:['Leave Type','Status'],columns:['S.No','Key Id','Full Name','Leave Hours','From Date','To Date','Status'],rows:[
    [1,'2014','Shaun J','Full Day','14-04-2026','16-04-2026','Approved'],
    [2,'2019','Pallavi P','Half Day','18-04-2026','18-04-2026','Pending'],
    [3,'2021','Anika Shah','Full Day','20-04-2026','22-04-2026','Approved'],
    [4,'2025','Rahul Mehta','Full Day','25-04-2026','27-04-2026','Unapproved'],
    [5,'2031','Nora Kim','Half Day','28-04-2026','28-04-2026','Pending'],
    [6,'2033','Luis Martin','Full Day','02-05-2026','04-05-2026','Approved']
  ]},
  /* == THE WORKSPACE TEN ====================================================================
     One meta per new module. These are not decoration: renderPageContentImpl has no branch for
     any of these ids, so each falls through to buildListingHTML, which reads its title, filters,
     columns and rows from here. WITHOUT AN ENTRY getPageMeta returns supportPageMeta.dashboard
     — so all ten would render the Dashboard listing under the title "Dashboard", which reads as
     ten broken rows rather than ten pages waiting for their real screen.

     Every one carries a Status column on purpose. buildListingHTML derives the Active / Pending
     / Inactive counts above the table from it, and a listing without one renders three zeroes. */
  'team-management':{title:'Team Management',context:'Team Management',filters:['Store','Role','Status'],columns:['S. No','Team','Owner','Members','Store Scope','Updated','Status'],rows:[
    [1,'Store Ops Core','Pallavi Parate','14','All stores','Today','Active'],
    [2,'Fulfilment Desk','Rahul Mehta','9','Pune North','Yesterday','Active'],
    [3,'Catalogue Team','Anika Shah','6','All stores','04 Sep 2026','Active'],
    [4,'Onboarding Squad','Owen Clark','4','Mumbai West','02 Sep 2026','Pending'],
    [5,'Support Rota','Nora Kim','11','All stores','28 Aug 2026','Active'],
    [6,'Night Shift','Luis Martin','5','Pune North','Archived','Inactive']
  ]},
  'store-management':{title:'Store & Management',context:'Store & Management',filters:['City','Category','Status'],columns:['S. No','Store','Store Code','City','Category','Onboarded','Status'],rows:[
    [1,'Bhaiyaa Kirana Hub','STR-000112','Pune','Grocery','01 Sep 2026','Active'],
    [2,'Green Cart Fresh','STR-000118','Mumbai','Fruits & Veg','03 Sep 2026','Active'],
    [3,'Daily Needs Mart','STR-000121','Nashik','Grocery','05 Sep 2026','Pending'],
    [4,'Sharma Provisions','STR-000124','Pune','General','06 Sep 2026','Pending'],
    [5,'City Pharmacy','STR-000127','Nagpur','Pharmacy','20 Aug 2026','Active'],
    [6,'Corner Store 24x7','STR-000131','Mumbai','Convenience','Closed','Inactive']
  ]},
  'orders-billing':{title:'Orders and Billing',context:'Orders and Billing',filters:['Store','Payment Mode','Status'],columns:['S. No','Order','Store','Items','Order Value','Invoice','Status'],rows:[
    [1,'ORD-48210','Bhaiyaa Kirana Hub','12','INR 2,480','INV-9921','Active'],
    [2,'ORD-48211','Green Cart Fresh','5','INR 690','INV-9922','Active'],
    [3,'ORD-48212','Daily Needs Mart','21','INR 4,150','Not raised','Pending'],
    [4,'ORD-48213','City Pharmacy','3','INR 1,120','INV-9924','Active'],
    [5,'ORD-48214','Sharma Provisions','8','INR 1,860','Draft','Pending'],
    [6,'ORD-48215','Corner Store 24x7','2','INR 310','Cancelled','Inactive']
  ]},
  'products-inventory':{title:'Products & Inventory',context:'Products & Inventory',filters:['Category','Store','Status'],columns:['S. No','Product','SKU','Category','Stock','Price','Status'],rows:[
    [1,'Toor Dal 1kg','SKU-10021','Staples','142','INR 165','Active'],
    [2,'Amul Butter 500g','SKU-10044','Dairy','38','INR 265','Active'],
    [3,'Basmati Rice 5kg','SKU-10077','Staples','0','INR 720','Pending'],
    [4,'Tata Salt 1kg','SKU-10092','Staples','210','INR 28','Active'],
    [5,'Fresh Tomato 1kg','SKU-10108','Fruits & Veg','16','INR 42','Pending'],
    [6,'Seasonal Hamper','SKU-10133','Gifting','0','INR 1,499','Inactive']
  ]},
  category:{title:'Category',context:'Category',filters:['Parent','Store','Status'],columns:['S. No','Category','Parent','Products','Stores Live','Updated','Status'],rows:[
    [1,'Staples','Grocery','412','38','Today','Active'],
    [2,'Dairy','Grocery','96','36','Today','Active'],
    [3,'Fruits & Veg','Fresh','188','24','Yesterday','Active'],
    [4,'Personal Care','Non-food','341','31','03 Sep 2026','Active'],
    [5,'Gifting','Seasonal','27','6','01 Sep 2026','Pending'],
    [6,'Frozen','Fresh','54','0','Not launched','Inactive']
  ]},
  community:{title:'Community',context:'Community',filters:['Type','Author','Status'],columns:['S. No','Topic','Type','Author','Replies','Last Activity','Status'],rows:[
    [1,'Festive stocking guidance','Announcement','Platform Team','24','2 hours ago','Active'],
    [2,'Delivery slot changes in Pune','Discussion','Pallavi Parate','11','Today','Active'],
    [3,'Ask me anything: pricing','Event','Rahul Mehta','48','Yesterday','Active'],
    [4,'Seller meetup - Mumbai','Event','Ops Desk','7','05 Sep 2026','Pending'],
    [5,'Report a catalogue error','Help thread','Anika Shah','19','04 Sep 2026','Active'],
    [6,'Old returns policy thread','Discussion','Ops Desk','63','Locked','Inactive']
  ]},
  'staff-roles':{title:'Manage Staff and Roles',context:'Manage Staff and Roles',filters:['Store','Role','Status'],columns:['S. No','Staff','Role','Store','Permissions','Added','Status'],rows:[
    [1,'Pallavi Parate','Store Manager','Bhaiyaa Kirana Hub','Full','01 Sep 2026','Active'],
    [2,'Rahul Mehta','Billing Staff','Green Cart Fresh','Orders, Billing','03 Sep 2026','Active'],
    [3,'Anika Shah','Catalogue Editor','All stores','Products, Category','03 Sep 2026','Active'],
    [4,'Owen Clark','Inventory Clerk','Daily Needs Mart','Inventory','06 Sep 2026','Pending'],
    [5,'Nora Kim','Support Agent','All stores','Community, Support','28 Aug 2026','Active'],
    [6,'Luis Martin','Billing Staff','Corner Store 24x7','Revoked','Removed','Inactive']
  ]},
  'pricing-discounts':{title:'Pricing & Discounts',context:'Pricing & Discounts',filters:['Type','Store','Status'],columns:['S. No','Offer','Type','Applies To','Value','Valid Till','Status'],rows:[
    [1,'Festive 15','Percentage','Staples','15%','30 Sep 2026','Active'],
    [2,'First Order Free Delivery','Delivery','All categories','INR 40','31 Dec 2026','Active'],
    [3,'Dairy Combo','Bundle','Dairy','Buy 2 get 1','20 Sep 2026','Active'],
    [4,'Bulk Rice Slab','Slab pricing','Staples','Tiered','Awaiting approval','Pending'],
    [5,'Pharmacy Flat 10','Percentage','Pharmacy','10%','Awaiting approval','Pending'],
    [6,'Monsoon Sale','Percentage','All categories','20%','Expired','Inactive']
  ]},
  'reports-analytics':{title:'Reports & Analytics',context:'Reports & Analytics',filters:['Scope','Frequency','Status'],columns:['S. No','Report','Scope','Frequency','Last Run','Owner','Status'],rows:[
    [1,'Daily Sales Summary','All stores','Daily','Today 06:00','Ops Desk','Active'],
    [2,'Stock-out Watchlist','All stores','Hourly','Today 09:00','Inventory','Active'],
    [3,'Category Performance','Grocery','Weekly','02 Sep 2026','Catalogue','Active'],
    [4,'Seller Payout Statement','All stores','Monthly','01 Sep 2026','Finance','Active'],
    [5,'Discount Effectiveness','Offers','Weekly','Scheduled','Pricing','Pending'],
    [6,'Legacy Order Export','All stores','On demand','Retired','Ops Desk','Inactive']
  ]},
  'settings-support':{title:'Settings & Support',context:'Settings & Support',filters:['Area','Owner','Status'],columns:['S. No','Setting','Area','Owner','Updated','Status'],rows:[
    [1,'Store Profile','Store','Pallavi Parate','Today','Active'],
    [2,'Payout Account','Billing','Finance Ops','Yesterday','Active'],
    [3,'Delivery Slots','Operations','Ops Desk','05 Sep 2026','Active'],
    [4,'Notification Preferences','Workspace','Platform Team','03 Sep 2026','Active'],
    [5,'GST & Tax Details','Billing','Finance Ops','Verification pending','Pending'],
    [6,'Legacy API Keys','Integrations','Platform Team','Revoked','Inactive']
  ]}
};

// -- Rebuilt contract-creation journey: one page per client-facing stage, titled from the
// stage itself so adding a stage needs no entry here. --
/* ONE TITLE FOR THE WHOLE JOURNEY. It used to echo the current stage — "Client signing", "Deposit
   due" — which the page's own header already says, in larger type, two lines below it, next to the
   step counter. Two places naming the same thing means the topbar tells you nothing you did not
   already know and changes under you nine times; naming the TASK instead gives it a job the stage
   header cannot do. */
function ccjPageMeta(pg){
  if(typeof isCCJPage==='function'&&!isCCJPage(pg))return null;
  const i=typeof ccjStageOf==='function'?ccjStageOf(pg):-1;
  if(pg!=='ccj-start'&&pg!=='ccj-model'&&i<0)return null;
  return{title:'Create Contract',context:'Contracts',filters:[],columns:[],rows:[]};
}
// -- The same, for the frozen V1 snapshot (js/contract-journey-v1.js). A copy rather than one
// function taught to answer for both prefixes: the snapshot is meant to be deletable in one
// move, and a shared function would leave a dangling branch behind when it goes. Its titles
// carry no "V1" marker because the point of the snapshot is to look exactly as it looked. --
function ccjv1PageMeta(pg){
  if(pg==='ccjv1-start'||pg==='ccjv1-model')return{title:'Create a Contract',context:'Contracts',filters:[],columns:[],rows:[]};
  const i=typeof ccjv1StageOf==='function'?ccjv1StageOf(pg):-1;
  if(i<0)return null;
  const s=amPipelineStages[i]||{};
  return{title:s.short||'Contract Creation',context:'Contracts',filters:[],columns:[],rows:[]};
}
function getPageMeta(pg){const ccjm=typeof ccjPageMeta==='function'?ccjPageMeta(pg):null;if(ccjm)return ccjm;const ccjv1m=typeof ccjv1PageMeta==='function'?ccjv1PageMeta(pg):null;if(ccjv1m)return ccjv1m;if(pg==='cfg-overview')return{title:'Overview',context:'Configure',filters:[],columns:[],rows:[]};if(pg==='cfg-systems')return{title:'Systems',context:'Configure',filters:[],columns:[],rows:[]};if(pg==='cfg-system-detail'){const s=cfgSystems.find(x=>x.id===selectedCfgSystemId);return{title:s?s.name:'System',context:'Configure',filters:[],columns:[],rows:[]};}if(pg==='cfg-system-add')return{title:'Add Custom System',context:'Configure',filters:[],columns:[],rows:[]};if(pg==='cfg-user-intake'){const m=cfgModels.find(x=>x.id===cfgUserIntakeModelId);return{title:m?m.name:'USER',context:'Configure',filters:[],columns:[],rows:[]};}if(pg==='sc-txn'){const t=typeof scOpenTxn==='function'?scOpenTxn():null;return{title:t?(t.no||'New SCR'):'Sub-Contracting',context:'Sub-Contracting',filters:[],columns:[],rows:[]};}if(pg==='cfg-data-foundation')return{title:'Data Foundation',context:'Configure',filters:[],columns:[],rows:[]};if(pg==='cfg-category-detail'){const c=typeof cfgDataCategories!=='undefined'&&cfgDataCategories.find(function(x){return x.id===selectedCfgCategoryId;});return{title:c?c.name:'Category',context:'Data Foundation',filters:[],columns:[],rows:[]};}if(pg==='cfg-model-detail'){const m=cfgModels.find(x=>x.id===selectedCfgModelId);return{title:m?m.name:'Model',context:'Configure',filters:[],columns:[],rows:[]};}if(pg==='cfg-model-add')return{title:'New Category',context:'Data Foundation',filters:[],columns:[],rows:[]};if(pg==='cfg-context-journey')return{title:'Context & Journey',context:'Configure',filters:[],columns:[],rows:[]};if(pg==='cfg-journey-detail'){const j=cfgJourneys.find(x=>x.id===selectedCfgJourneyId);return{title:j?j.name:'Journey',context:'Configure',filters:[],columns:[],rows:[]};}if(pg==='journey-simulation'){const j=cfgJourneys.find(x=>x.id===selectedSimulationJourneyId);return{title:j?j.name+' Simulation':'Journey Simulation',context:'Configure',filters:[],columns:[],rows:[]};}if(pg==='cfg-agents')return{title:'Agents',context:'Configure',filters:[],columns:[],rows:[]};if(pg==='ai-analytics')return{title:'Analytics',context:'AI Execution Layer',filters:[],columns:[],rows:[]};if(pg==='ai-executive')return{title:'AI Executive',context:'AI Executive',filters:[],columns:[],rows:[]};if(pg==='my-tasks')return{title:'My Tasks',context:'My Tasks',filters:[],columns:[],rows:[]};if(pg==='my-runs')return{title:'My Runs',context:'My Runs',filters:[],columns:[],rows:[]};if(pg==='manual-journey-run'){const r=getManualRun(selectedManualRunId);return{title:r?r.runId:'Manual Journey Run',context:'AI Executive',filters:[],columns:[],rows:[]};}if(pg==='ai-journey-detail'){const j=aiJourneys.find(x=>x.id===selectedAIJourneyId);return{title:j?j.name:'Journey Detail',context:'AI Executive',filters:[],columns:[],rows:[]};}if(pg==='ai-automate-form'){const j=aiJourneys.find(x=>x.id===selectedAIJourneyId);return{title:'Automate Journey',context:j?j.name:'AI Executive',filters:[],columns:[],rows:[]};}if(pg==='ai-contract-assistant')return{title:'AI Contract Assistant',context:'Contracts',filters:[],columns:[],rows:[]};if(pg==='ai-proposal-created')return{title:'Proposal Created',context:'Contracts',filters:[],columns:[],rows:[]};if(pg==='ai-proposal-waiting-approval')return{title:'Waiting for Approval',context:'Contracts',filters:[],columns:[],rows:[]};if(pg==='contract-eor'||pg==='contract-peo'||pg==='contract-type-select')return{title:'Create a Contract',context:'Contracts',filters:[],columns:[],rows:[]};if(pg==='ai-employee-created')return{title:'Employee Created',context:'Contracts',filters:[],columns:[],rows:[]};if(pg==='ai-contract-document')return{title:'Contract Document',context:'Contracts',filters:[],columns:[],rows:[]};if(pg==='ai-contract-waiting-approval')return{title:'Waiting for Approval',context:'Contracts',filters:[],columns:[],rows:[]};if(pg==='ai-onboarding-run')return{title:'Onboarding',context:'Contracts',filters:[],columns:[],rows:[]};if(pg==='ai-journey-complete')return{title:'Journey Complete',context:'Contracts',filters:[],columns:[],rows:[]};if(pg==='ai-active-automation'){const j=aiJourneys.find(x=>x.id===selectedAIJourneyId);return{title:j?j.name+' Automation':'Active Automation',context:'AI Executive',filters:[],columns:[],rows:[]};}if(pg==='ai-run-detail')return{title:'Run '+selectedAIRunId,context:'AI Executive',filters:[],columns:[],rows:[]};if(pg==='ai-journey-run'){const flow=aiRunFlows[aiRunFlowJourneyId];return{title:flow?flow.entryLabel:'AI Executive',context:'AI Executive',filters:[],columns:[],rows:[]};}if(pg==='cost-calculator')return{title:'Cost Calculator',context:'Cost Calculator',filters:[],columns:[],rows:[]};if(pg==='leave-policies')return{title:'Leave Policies',context:'Leave Policies',filters:[],columns:[],rows:[]};if(pg==='leave-policy-edit')return{title:'Edit Leave Policy',context:'Leave Policy',filters:[],columns:[],rows:[]};if(pg==='leave-policy-add')return{title:'Add Leave Policy',context:'Leave Policy',filters:[],columns:[],rows:[]};if(pg==='team-add')return{title:'Create New Team',context:'Teams',filters:[],columns:[],rows:[]};if(pg==='master-data')return{title:'Client',context:'Client',filters:[],columns:[],rows:[]};if(pg==='create-store')return{title:'Create Store',context:'Bhaiyaa',filters:[],columns:[],rows:[]};if(pg==='stores')return{title:'All Stores',context:'Stores',filters:[],columns:[],rows:[]};if(pg==='employees')return{title:'Employees',context:'Employees',filters:[],columns:[],rows:[]};if(pg==='timesheet')return{title:'Timesheet',context:'Timesheet',filters:[],columns:[],rows:[]};if(pg==='my-profile')return{title:'My Profile',context:'My Profile',filters:[],columns:[],rows:[]};if(pg==='support-tickets')return{title:'Tickets',context:'Tickets',filters:[],columns:[],rows:[]};if(pg==='chats')return{title:'Chats',context:'Chats',filters:[],columns:[],rows:[]};if(pg==='switch-entity')return{title:'Switch Entity',context:'Switch Entity',filters:[],columns:[],rows:[]};return supportPageMeta[pg]||supportPageMeta.dashboard;}
function getPageTitle(pg){return getPageMeta(pg).title;}
function statusClass(v){return String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-');}
function titleForAdd(pg){return pg==='dashboard'?'Dashboard':getPageTitle(pg);}
function getSidebarActivePage(pg){if(typeof isCCJPage==='function'&&isCCJPage(pg))return 'contracts';
  if(typeof isCCJV1Page==='function'&&isCCJV1Page(pg))return 'contracts';if(pg==='cfg-journey-detail'||pg==='journey-simulation')return 'cfg-context-journey';if(pg==='cfg-system-detail'||pg==='cfg-system-add')return 'cfg-systems';if(pg==='cfg-user-intake')return cfgUserIntakeBackPage;if(pg==='cfg-model-detail')return cfgModelBackPage==='cfg-system-detail'?'cfg-systems':'cfg-data-foundation';if(pg==='cfg-model-add')return 'cfg-data-foundation';if(pg==='cfg-category-detail')return 'cfg-data-foundation';if(pg==='sc-txn')return 'dashboard';if(pg==='team-add')return 'teams';if(pg==='leave-policy-add'||pg==='leave-policy-edit')return 'leave-policies';if(pg==='manual-journey-run')return manualJourneyBackPage==='cfg-context-journey'?'cfg-context-journey':'ai-executive';if(pg==='ai-journey-detail'||pg==='ai-automate-form'||pg==='ai-active-automation'||pg==='ai-run-detail'||pg==='ai-journey-run')return 'ai-executive';if(pg==='ai-contract-assistant'||pg==='ai-proposal-created'||pg==='ai-proposal-waiting-approval'||pg==='contract-type-select'||pg==='contract-eor'||pg==='contract-peo'||pg==='ai-employee-created'||pg==='ai-contract-document'||pg==='ai-contract-waiting-approval'||pg==='ai-onboarding-run'||pg==='ai-journey-complete')return 'contracts';return pg;}

function attrSafe(v){return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;');}
/* attrSafe is for an ATTRIBUTE and leaves angle brackets alone, which is correct there and wrong
   anywhere a user's own words are dropped into markup. Everything this app renders is authored
   copy except the handful of places somebody types free text — a follow-up comment, a stop
   reason — and those need the brackets closed too or a typed "<b>" changes the page. */
function textSafe(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
/* Copy authored for HTML, reused somewhere HTML entities do not resolve — a title attribute, a
   toast body. Only the entities this app actually authors are handled; anything else would be a
   half-built HTML decoder, and the fix for that case is to stop authoring the entity. */
function stripEnt(v){return String(v).replace(/&mdash;/g,'—').replace(/&ndash;/g,'–').replace(/&rsquo;/g,'’').replace(/&amp;/g,'&');}
function customSelect(id,selected,options,placeholder,variant){
  const safeId=String(id).replace(/[^a-zA-Z0-9_-]/g,'-');
  const opts=(options||[]).map(o=>String(o));
  const current=selected||placeholder||opts[0]||'Select';
  const optHtml=opts.map(o=>`<button type="button" class="custom-select-option ${o===current?'selected':''}" data-value="${attrSafe(o)}" onclick="selectCustomOption(event,this)"><span class="custom-select-text">${o}</span><span class="custom-select-check">&#10003;</span></button>`).join('');
  const muted=current===(placeholder||'');
  return `<div class="custom-select ${variant||''}" id="${safeId}" data-value="${attrSafe(current)}"><button type="button" class="custom-select-trigger" onclick="toggleCustomSelect(event,'${safeId}')"><span class="${muted?'placeholder':''}">${current}</span><svg class="custom-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg></button><div class="custom-select-menu">${optHtml}</div></div>`;
}
function closeCustomSelects(exceptId){document.querySelectorAll('.custom-select.open').forEach(s=>{if(!exceptId||s.id!==exceptId)s.classList.remove('open');});}
function toggleCustomSelect(event,id){event.stopPropagation();const root=document.getElementById(id);if(!root)return;const open=root.classList.contains('open');closeCustomSelects(id);root.classList.toggle('open',!open);}
function selectCustomOption(event,opt){event.stopPropagation();const root=opt.closest('.custom-select');if(!root)return;const label=opt.querySelector('.custom-select-text');const trigger=root.querySelector('.custom-select-trigger span');root.dataset.value=label?label.textContent.trim():opt.textContent.trim();if(trigger&&label){trigger.innerHTML=label.innerHTML;trigger.classList.remove('placeholder');}root.querySelectorAll('.custom-select-option').forEach(o=>o.classList.remove('selected'));opt.classList.add('selected');root.classList.remove('open');}
document.addEventListener('click',e=>{if(!e.target.closest('.custom-select'))closeCustomSelects();if(!e.target.closest('.cs-wrap')){document.querySelectorAll('.cs-dropdown.cs-open').forEach(d=>{d.classList.remove('cs-open');const t=d.previousElementSibling;if(t)t.classList.remove('cs-open');});}if(!e.target.closest('.ct-action-wrap'))document.querySelectorAll('.ct-action-menu.open').forEach(m=>m.classList.remove('open'));if(!e.target.closest('.se-dd-wrap')){const p=document.getElementById('se-dd-panel');if(p)p.classList.remove('open');}});
const filterOptionMap={Country:['Country','Netherlands','India','Germany','Spain','United Kingdom'],Status:['Status','Active','Pending','Inactive'],Team:['Team','Engineering','Product','Finance','Operations'],Department:['Department','Finance','HR','Legal','Operations','Support'],Area:['Area','Company','Finance','Access','Workspace','Security'],Owner:['Owner','Pallavi Parate','Finance Ops','Admin','System'],Topic:['Topic','Payroll question','Contract review','Compliance rates','Payment proof'],Priority:['Priority','High','Medium','Low'],Category:['Category','Payroll','Contractor','Compliance','Benefits'],Cycle:['Cycle','May 2026','April 2026','March 2026'],Type:['Type','EOR','PEO','Contractor'],'Worker Type':['Worker Type','EOR','PEO','Contractor'],'Leave Type':['Leave Type','Annual Leave','Sick Leave','Parental Leave','Holiday']};
function getFilterOptions(label){return filterOptionMap[label]||[label,'All','Active','Pending','Inactive'];}
function isCreateContractRequest(text){const q=String(text).toLowerCase();return q.includes('create')&&q.includes('contract');}
function isNetherlandsContractRequest(text){
  const q=String(text).toLowerCase();
  // Explicit: "create contract in netherlands"
  if(isCreateContractRequest(q)&&q.includes('netherland'))return true;
  // Shorthand: "create in netherlands", "create netherlands", "netherlands contract"
  if((q.includes('create')||q.includes('make')||q.includes('start')||q.includes('open')||q.includes('setup')||q.includes('set up')||q.includes('new'))&&q.includes('netherland'))return true;
  // Affirmative after suggestion: "yes netherlands", "ok netherlands", "proceed netherlands", "netherlands please", "netherlands" alone, "yes proceed", "proceed"
  if(q.includes('netherland'))return true;
  return false;
}
function showWorkspaceEmpty(){
  const col=document.getElementById('form-col');if(!col)return;
  col.style.display='flex';
  col.innerHTML=`<div class="workspace-empty"><div class="workspace-empty-inner"><svg class="workspace-mural" viewBox="0 0 180 180" fill="none"><circle cx="90" cy="90" r="4" fill="#6b7280"/><circle cx="57" cy="82" r="3" fill="#9ca3af"/><circle cx="126" cy="71" r="3" fill="#9ca3af"/><circle cx="139" cy="101" r="2" fill="#c3c8d1"/><circle cx="72" cy="134" r="2" fill="#c3c8d1"/><path d="M45 94c0-28 18-51 45-56" stroke="#d4d8df" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="26 18"/><path d="M133 126c-16 19-45 25-68 12" stroke="#d4d8df" stroke-width="1.5" stroke-linecap="round"/><path d="M118 49c23 10 38 32 38 58" stroke="#d4d8df" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="22 16"/><path d="M70 66c18-12 43-8 56 10" stroke="#c5cad3" stroke-width="1.5" stroke-linecap="round"/><path d="M118 117c-16 15-42 15-58 0" stroke="#c5cad3" stroke-width="1.5" stroke-linecap="round"/><circle cx="90" cy="90" r="36" stroke="#dde1e7" stroke-width="1.5"/><circle cx="90" cy="90" r="20" stroke="#cbd1db" stroke-width="1.5" stroke-dasharray="20 14"/><path d="M90 77l4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9z" stroke="#8d95a3" stroke-width="1.6" stroke-linejoin="round"/><path d="M83 100l14-20" stroke="#b5bbc6" stroke-width="1.3" stroke-linecap="round"/></svg><div class="workspace-title">Your workspace will appear here</div><div class="workspace-copy">As you chat, I'll show relevant data, templates and previews on this side.</div></div></div>`;
  const chatCol=document.getElementById('agent-chat-col');if(chatCol)chatCol.style.flex='0 0 380px';
}
function startNetherlandsContract(){returnToReview=false;formStep=0;const chatCol=document.getElementById('agent-chat-col');if(chatCol)chatCol.style.flex='0 0 380px';buildForm(0);}
function ensureAgentModuleContent(){
  let el=document.getElementById('agent-module-content');
  if(!el){
    el=document.createElement('div');
    el.id='agent-module-content';
    el.className='agent-module-content';
    const area=document.querySelector('#v-agent-active .content-area');
    if(area)area.appendChild(el);
  }
  return el;
}
function getAgentWorkspaceButton(){
  let btn=document.getElementById('agent-workspace-btn');
  if(!btn){
    btn=document.createElement('button');
    btn.id='agent-workspace-btn';
    btn.className='agent-workspace-btn';
    btn.title='Back to Agent workspace';
    btn.setAttribute('aria-label','Back to Agent workspace');
    btn.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>';
    btn.onclick=restoreAgentWorkspace;
    document.body.appendChild(btn);
  }
  return btn;
}
function setAgentWorkspaceButton(show){const btn=getAgentWorkspaceButton();btn.style.display=show?'flex':'none';}
function restoreAgentWorkspace(){
  const moduleEl=ensureAgentModuleContent();
  moduleEl.style.display='none';
  const chatCol=document.getElementById('agent-chat-col');
  const formCol=document.getElementById('form-col');
  if(chatCol)chatCol.style.display='flex';
  renderChat('agent-chat',agentMsgs);buildInput('inp-active');
  if(formStep>=0){if(formCol)formCol.style.display='flex';buildForm(formStep);}else{showWorkspaceEmpty();}
  setAgentWorkspaceButton(false);
}
function showAgentModule(pg){
  if(!canAccessPage(pg,portalRole))pg=defaultPageForRole(portalRole);
  buildSidebar('agent-sb',agentSidebarCollapsed,pg);
  const chatCol=document.getElementById('agent-chat-col');
  const formCol=document.getElementById('form-col');
  if(chatCol)chatCol.style.display='none';
  if(formCol)formCol.style.display='none';
  const moduleEl=ensureAgentModuleContent();
  moduleEl.style.display='block';
  moduleEl.innerHTML=pg==='dashboard'?buildDashboardPageHTML():buildListingHTML(pg);
  setAgentWorkspaceButton(true);
}
function hideAgentWorkspaceButton(){const btn=document.getElementById('agent-workspace-btn');if(btn)btn.style.display='none';}

const formSteps=[
  {title:'Eligibility',short:'Eligibility',sub:'Confirm where the employee will work and their authorization status.'},
  {title:'Employee Information',short:'Profile',sub:'Tell us a bit about the new hire so we can prepare the paperwork.'},
  {title:'Job Details',short:'Job',sub:'Define the role, schedule, and compensation for this contract.'},
  {title:'Other Details',short:'Leaves',sub:'Set leave entitlements, probation, and notice period pre-filled to local minimums.'},
  {title:'Review & Submit',short:'Review',sub:'Quick check before we draft the contract. You can edit anything below.'},
  {title:'Success',short:'Done',sub:''}
];

// -- SIDEBAR BUILDER --
function buildSidebar(id,collapsed,activePg){
  const el=document.getElementById(id);if(!el)return;
  el.className='sidebar'+(collapsed?' collapsed':'');el.innerHTML='';
  const scope=id==='adt-sidebar'?'adt':'agent';
  const top=document.createElement('div');top.className='sb-top';
  top.innerHTML=(collapsed?'':'<span class="sb-menu-label">Menu</span>')+'<button class="sidebar-toggle" onclick="toggleSidebar(\''+scope+'\')" title="Toggle sidebar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="14" rx="2"/><line x1="15" y1="5" x2="15" y2="19"/></svg></button>';
  el.appendChild(top);
  const items=getSidebarItems();
  // -- Groups render into their own container, so the AI layer reads as one block; everything
  // else renders straight into the sidebar. Dropdown open/close still queries `el`, which is the
  // sidebar root either way, so grouped and ungrouped dropdowns stay mutually exclusive. --
  items.forEach(item=>{
    if(item.group){
      /* -- `box` and `dot` are per zone. The AI Execution Layer keeps the tinted panel and the
         spinning dot because that block IS the product and should read as one object. Workspace
         is the connected product's own modules and takes neither: giving every zone the same
         treatment would have said they are the same kind of thing. Absent means plain, so a
         zone added without an opinion gets the quieter of the two. -- */
      const box=document.createElement('div');box.className='sb-group'+(item.box?'':' sb-group-plain');
      if(!collapsed){
        const lbl=document.createElement('div');lbl.className='sb-group-label';
        lbl.innerHTML=(item.dot?'<span class="sb-group-dot"></span>':'')+'<span>'+item.group+'</span>';
        box.appendChild(lbl);
      }
      el.appendChild(box);
      (item.items||[]).forEach(sub=>renderSidebarEntry(sub,box,el,id,collapsed,activePg,scope));
      return;
    }
    renderSidebarEntry(item,el,el,id,collapsed,activePg,scope);
  });
}
// -- `box` is where this entry's nodes go (a group container or the sidebar itself); `el` is
// always the sidebar root, used for the "close every other dropdown" sweep. --
function renderSidebarEntry(item,box,el,id,collapsed,activePg,scope){
  // -- The divider renders in both states: expanded it separates two labelled halves, collapsed
  // it is the only thing marking the seam, since the section label is hidden. --
  if(item.divider){const dv=document.createElement('div');dv.className='sb-divider';box.appendChild(dv);return;}
  if(item.section){if(!collapsed){const s=document.createElement('div');s.className='sb-section';s.textContent=item.section;box.appendChild(s);}return;}
  if(item.dropdown){
    const hasActiveChild=(item.children||[]).some(c=>c.id===activePg);
    const isOpen=openDropdowns.has(item.dropdown)||hasActiveChild;
    if(!collapsed){
      const parentBtn=document.createElement('button');parentBtn.type='button';
      parentBtn.className='sb-parent'+(isOpen?' open':'')+(hasActiveChild?' has-active':'');
      parentBtn.innerHTML='<div class="sb-ico-wrap">'+(item.icon||'')+'</div><span>'+item.dropdown+'</span><svg class="sb-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
      parentBtn.title=item.dropdown;
      const childrenDiv=document.createElement('div');childrenDiv.className='sb-children';childrenDiv.style.maxHeight=isOpen?'600px':'0';
      (item.children||[]).forEach(child=>{
        const cd=document.createElement('button');cd.type='button';
        cd.className='sb-item'+(child.id===activePg?' active':'');
        cd.innerHTML='<div class="sb-ico-wrap">'+(child.icon||'')+'</div><span>'+child.label+'</span>';
        cd.title=child.label;
        // -- Same rule as a top-level entry: a child with `action` runs it instead of routing,
        // because what it opens is a flow rather than a page id the router knows, and
        // `activeSidebarItem` is left pointing at wherever the user actually is. --
        cd.onclick=child.action?()=>child.action():()=>{activeSidebarItem=child.id;navigatePage(child.id);};
        childrenDiv.appendChild(cd);
      });
      parentBtn.onclick=()=>{
        if(collapsed){if(scope==='adt'){adtSidebarCollapsed=false;openDropdowns.clear();openDropdowns.add(item.dropdown);buildSidebar(id,false,activeSidebarItem);}return;}
        if(openDropdowns.has(item.dropdown)){openDropdowns.delete(item.dropdown);childrenDiv.style.maxHeight='0';parentBtn.classList.remove('open');}
        else{el.querySelectorAll('.sb-parent.open').forEach(b=>b.classList.remove('open'));el.querySelectorAll('.sb-children').forEach(c=>c.style.maxHeight='0');openDropdowns.clear();openDropdowns.add(item.dropdown);childrenDiv.style.maxHeight='600px';parentBtn.classList.add('open');}
      };
      box.appendChild(parentBtn);box.appendChild(childrenDiv);
    }else{
      const d=document.createElement('button');d.type='button';d.className='sb-parent'+(hasActiveChild?' has-active':'');
      d.innerHTML='<div class="sb-ico-wrap">'+(item.icon||'')+'</div>';
      d.title=item.dropdown;
      d.onclick=()=>{adtSidebarCollapsed=false;openDropdowns.clear();openDropdowns.add(item.dropdown);buildSidebar(id,false,activeSidebarItem);};
      box.appendChild(d);
    }
    return;
  }
  const d=document.createElement('button');
  d.type='button';
  d.className='sb-item'+(item.id===activePg?' active':'')+(item.id==='ai-executive'?' sb-item-ai':'');
  const badgeCount=item.id==='my-tasks'&&typeof myTasksPendingCount==='function'?myTasksPendingCount():0;
  d.innerHTML='<div class="sb-ico-wrap">'+(item.icon||'')+'</div><span>'+item.label+'</span>'+(badgeCount?'<span class="sb-item-badge">'+badgeCount+'</span>':'');
  d.title=item.label+(badgeCount?' ('+badgeCount+' pending)':'');
  // -- An entry with `action` runs it instead of routing: the thing it opens is a flow, not a
  // page id the router knows. `activeSidebarItem` is left alone so the sidebar keeps pointing at
  // wherever the user actually is. --
  d.onclick=item.placeholder?()=>{}:item.action?()=>item.action():()=>{activeSidebarItem=item.id;navigatePage(item.id);};
  box.appendChild(d);
}
const defaultChildIcon='<svg class="sb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/></svg>';

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ NOTIFICATION POPOVER ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
const notifData=[
  {name:'Your Invoice is ready for review',cid:'234',time:'22 sec ago',pending:true},
  {name:'Your contract is created',cid:'544',time:'1 min ago',pending:false},
  {name:'Your Invoice is ready for review',cid:'467',time:'2 min ago',pending:true},
  {name:'Your contract is created',cid:'321',time:'5 hrs ago',pending:false},
  {name:'Your Invoice is ready for review',cid:'675',time:'1 day ago',pending:true}
];
let notifBellSeenKeys={};
function notifRelevantList(){
  return notifData.filter(function(n){return !n.forPersona||(portalRole==='entity-user'&&activePersonaId===n.forPersona);});
}
function notifPendingCount(){return notifRelevantList().filter(function(n){return n.pending;}).length;}
function renderNotifBadge(){
  const btn=document.getElementById('notif-trigger');if(!btn)return;
  let badge=btn.querySelector('.tb-notif-badge');
  const count=notifBellSeenKeys[currentSessionKey()]?0:notifPendingCount();
  if(count>0){
    if(!badge){badge=document.createElement('span');badge.className='tb-notif-badge';btn.appendChild(badge);}
    badge.textContent=count>9?'9+':String(count);
  }else if(badge){badge.remove();}
}
function toggleNotif(e){
  if(e)e.stopPropagation();
  notifOpen=!notifOpen;
  if(notifOpen)notifBellSeenKeys[currentSessionKey()]=true;
  renderNotif();
  renderNotifBadge();
}
function markAllNotifsRead(){
  notifRelevantList().forEach(function(n){n.pending=false;});
  renderNotif();
  renderNotifBadge();
}
function renderNotif(){
  const el=document.getElementById('notif-pop');if(!el)return;
  if(!notifOpen){el.classList.add('hidden');return;}
  el.classList.remove('hidden');
  const list=notifData.filter(function(n){
    if(notifShowUnread&&!n.pending)return false;
    if(n.forPersona&&!(portalRole==='entity-user'&&activePersonaId===n.forPersona))return false;
    return true;
  });
  el.innerHTML=`<div class="np-head"><div class="np-title">Notifications</div><div class="np-actions"><button class="np-iconbtn" title="Refresh"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button><button class="np-iconbtn" onclick="toggleNotif()" title="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div></div>
  <div class="np-controls"><button class="np-mark" onclick="event.stopPropagation();markAllNotifsRead()">Mark all as read</button><div class="np-toggle-row"><span>Only Show Unread</span><button class="np-switch ${notifShowUnread?'on':''}" onclick="event.stopPropagation();notifShowUnread=!notifShowUnread;renderNotif()"></button></div></div>
  <div class="np-list">${list.map(n=>`<div class="np-item${n.runId?' np-item-clickable':''}"${n.runId?` onclick="toggleNotif();openNotifiedRun('${n.runId}')" style="cursor:pointer"`:''}><div class="np-avatar">N</div><div class="np-body"><div class="np-row1"><div class="np-text">${n.name}</div><div class="np-time">${n.time}</div></div><div class="np-row2">Contract ID - ${n.cid}${n.pending?'<span class="np-pending">Pending</span>':''}</div></div></div>`).join('')||'<div style="padding:24px;text-align:center;color:var(--gray);font-size:12px">No unread notifications</div>'}</div>`;
}
function pushRunNotification(runId,forPersonaId,message){
  notifData.unshift({name:message,cid:runId,time:'Just now',pending:true,forPersona:forPersonaId,runId:runId});
  if(forPersonaId)delete notifBellSeenKeys['entity-user:'+forPersonaId];
  if(notifOpen)renderNotif();
  renderNotifBadge();
}
document.getElementById('notif-pop')?.addEventListener('click',e=>e.stopPropagation());
document.addEventListener('click',e=>{if(notifOpen&&!e.target.closest('#notif-pop')&&!e.target.closest('#notif-trigger')){notifOpen=false;renderNotif();}});

// ── HEADER DROPDOWNS ──
function toggleHdrDD(id){
  const panel=document.getElementById(id);
  if(!panel)return;
  const isOpen=panel.classList.contains('open');
  closeAllHdrDD();
  if(!isOpen){
    panel.classList.add('open');
    const trigger=panel.previousElementSibling||panel.parentElement.querySelector('.company-sel,.user-sel');
    if(trigger){const chev=trigger.querySelector('.hdr-dd-chev');if(chev)chev.style.transform='rotate(180deg)';}
  }
}
function closeAllHdrDD(){
  document.querySelectorAll('.hdr-dd-panel.open').forEach(p=>{
    p.classList.remove('open');
    const wrap=p.closest('.hdr-dd-wrap');
    if(wrap){const chev=wrap.querySelector('.hdr-dd-chev');if(chev)chev.style.transform='';}
  });
  userDDMode='main';
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.hdr-dd-wrap'))closeAllHdrDD();
});

// -- USER / PORTAL SWITCHER DROPDOWN --
function openUserDD(){userDDMode='main';renderUserDD();toggleHdrDD('user-dd');}
function showSwitchUserMenu(e){if(e)e.stopPropagation();userDDMode='switch';renderUserDD();}
function renderUserDD(){
  const persona=getActivePersona();
  const nameEl=document.getElementById('user-trigger-label');if(nameEl)nameEl.textContent=portalRoleLabel(portalRole);
  const avEl=document.getElementById('user-trigger-avatar');if(avEl)avEl.textContent=portalRoleInitials(portalRole);
  const panel=document.getElementById('user-dd');if(!panel)return;
  const emailMap={'super-admin':'pallavi@adt.com','entity-admin':'entity.admin@adt.com','entity-user':'entity.user@adt.com'};
  if(userDDMode==='switch'){
    const platformRoles=['super-admin','entity-admin'];
    const platformItems=platformRoles.map(r=>`<button class="hdr-dd-item" onclick="closeAllHdrDD();setPortalRole('${r}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${portalRoleLabel(r)}
      </button>`).join('');
    const personaItems=enterprisePersonas.map(function(p){
      return `<button class="hdr-dd-item ${portalRole==='entity-user'&&activePersonaId===p.id?'active':''}" onclick="closeAllHdrDD();setActivePersona('${p.id}')">
        <span class="user-avatar-sm" style="width:24px;height:24px;font-size:9px;flex-shrink:0">${p.initials}</span>
        <span style="display:flex;flex-direction:column;gap:1px;min-width:0">
          <span style="font-size:12.5px;font-weight:650;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.label}</span>
          <span style="font-size:10.5px;color:var(--gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.department}</span>
        </span>
      </button>`;
    }).join('');
    panel.innerHTML=`<div class="hdr-dd-header">
        <button class="hdr-dd-item" style="width:auto;padding:6px;flex:0 0 auto" onclick="event.stopPropagation();userDDMode='main';renderUserDD();" title="Back"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="hdr-dd-title">Switch User</div>
      </div>
      <div class="hdr-dd-divider"></div>
      ${platformItems}
      <div class="hdr-dd-divider"></div>
      <div class="hdr-dd-subtitle" style="padding:7px 10px 4px;font-weight:700;text-transform:uppercase;letter-spacing:.35px">Entity User</div>
      <div class="persona-switch-list">${personaItems}</div>`;
    return;
  }
  const displayEmail=portalRole==='entity-user'?persona.email:emailMap[portalRole];
  const displaySub=portalRole==='entity-user'?persona.department:displayEmail;
  panel.innerHTML=`<div class="hdr-dd-header">
      <div class="user-avatar-sm" style="width:36px;height:36px;font-size:13px;flex-shrink:0">${portalRoleInitials(portalRole)}</div>
      <div>
        <div class="hdr-dd-title">${portalRoleLabel(portalRole)}</div>
        <div class="hdr-dd-subtitle">${displaySub}</div>
      </div>
    </div>
    <div class="hdr-dd-info-row"><span class="hdr-dd-info-label">Role</span><span class="hdr-dd-info-val">${portalRoleLabel(portalRole)}</span></div>
    ${portalRole==='entity-user'?'<div class="hdr-dd-info-row"><span class="hdr-dd-info-label">Department</span><span class="hdr-dd-info-val">'+persona.department+'</span></div>':''}
    <div class="hdr-dd-info-row"><span class="hdr-dd-info-label">Last login</span><span class="hdr-dd-info-val">Today, 9:41 AM</span></div>
    <div class="hdr-dd-divider"></div>
    <button class="hdr-dd-item" onclick="closeAllHdrDD();navigatePage('my-profile')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      My Profile
    </button>
    <button class="hdr-dd-item" onclick="closeAllHdrDD()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
      Account Settings
    </button>
    <button class="hdr-dd-item" onclick="closeAllHdrDD()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Help & Support
    </button>
    <div class="hdr-dd-divider"></div>
    <button class="hdr-dd-item" onclick="showSwitchUserMenu(event)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      Switch User
    </button>
    <div class="hdr-dd-divider"></div>
    <button class="hdr-dd-item hdr-dd-item-danger" onclick="closeAllHdrDD()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Sign Out
    </button>`;
}

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ TOPBAR BUILDER ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
function buildTopbar(id,m){
  const el=document.getElementById(id);
  const pageLeft=`<div class="adt-logo"><img src="${window.__resources?.logo||'assets/Opendhilogo.png'}" alt="Opendhi"></div><span class="topbar-page">${getPageTitle(page)}</span><button class="page-add-btn" title="Add ${titleForAdd(page)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`;
  const agentLeft=`<div class="adt-logo"><img src="${window.__resources?.logo||'assets/Opendhilogo.png'}" alt="Opendhi"></div><span style="font-size:13px;font-weight:600">Agent Mode</span><span class="badge">BETA</span>`;
  el.innerHTML=`<div class="topbar-left">${m==='agent'?agentLeft:pageLeft}</div>
  <div class="topbar-center"></div>
  <div class="topbar-right">
    <button class="tb-icon" onclick="openSearch()" title="Search (Ctrl+K)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
    <button class="tb-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></button>
    <div class="company-sel" style="font-size:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg> Dhi Hyperlocal <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></div>
    <div class="user-sel" style="font-size:12px"><div class="user-avatar-sm" style="width:24px;height:24px;font-size:9px">PP</div> Pallavi Parate</div>
    <button class="close-btn" onclick="closeAgent()" title="Exit Agent Mode"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close</button>
  </div>`;
}

// -- INPUT BAR BUILDER --
function buildInput(id,ph){
  const el=document.getElementById(id);
  const attachChip=pendingAgentAttachment?(`<div class="agrun-attach-chip">${pendingAgentAttachment.isImage?`<img src="${pendingAgentAttachment.dataUrl}" alt="">`:'<span class="agrun-attach-file-ic">&#128206;</span>'}<span class="agrun-attach-name">${pendingAgentAttachment.name}</span><button type="button" class="agrun-attach-remove" onclick="clearPendingAgentAttachment('${id}')" title="Remove attachment">&times;</button></div>`):'';
  el.innerHTML=attachChip+`<div class="input-row">
    <div class="icon-btn" onclick="togglePlus('${id}')" style="position:relative"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <div class="plus-dd" id="pdd-${id}">
        <div class="plus-dd-item" onclick="triggerAgentUpload('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload File</div>
        <div class="plus-dd-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Share Link</div>
        <div class="plus-dd-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Add URL</div>
      </div>
    </div>
    <input class="input-field" placeholder="${ph||'Ask anything or describe what you need...'}" onkeydown="if(event.key==='Enter')sendMsg('${id}')">
    <div style="position:relative">
      <div class="agent-sel" onclick="toggleAgent('${id}')"><svg class="agent-sp-icon" width="13" height="13" viewBox="0 0 24 24" fill="var(--orange)" stroke="none"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg><span class="agent-sel-dot" style="width:5px;height:5px;border-radius:50%;background:${agent==='contractor'?'var(--green)':'var(--gray)'};flex-shrink:0"></span><span class="agent-label">${agent==='contractor'?'Contractor Agent':'Payroll Agent'}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></div>
      <div class="agent-dd" id="add-${id}">
        <div class="agent-dd-hdr">Select Agent</div>
        <div class="agent-dd-item ${agent==='contractor'?'active':''}" onclick="pickAgent('contractor','${id}')"><span style="width:6px;height:6px;border-radius:50%;background:var(--green)"></span><div><div class="nm">Contractor Agent</div><div class="desc">Contracts, onboarding & compliance</div></div>${agent==='contractor'?'<span style="margin-left:auto;color:var(--orange);font-weight:700">&#10003;</span>':''}</div>
        <div class="agent-dd-item disabled"><span style="width:6px;height:6px;border-radius:50%;background:var(--gray)"></span><div><div class="nm">Payroll Agent</div><div class="desc">Salary, deductions & payslips</div></div><span class="coming-tag">Coming Soon</span></div>
      </div>
    </div>
    <button class="icon-btn" onclick="sendMsg('${id}')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
  </div>`;
}

function togglePlus(id){const d=document.getElementById('pdd-'+id);d.classList.toggle('open');setTimeout(()=>document.addEventListener('click',function h(){d.classList.remove('open');document.removeEventListener('click',h);}),10);}
function toggleAgent(id){const d=document.getElementById('add-'+id);d.classList.toggle('open');setTimeout(()=>document.addEventListener('click',function h(){d.classList.remove('open');document.removeEventListener('click',h);}),10);}
function pickAgent(a,id){agent=a;document.getElementById('add-'+id).classList.remove('open');rebuildInputs();}
function rebuildInputs(){if(view==='agent-empty')buildInput('inp-empty');if(view==='agent-active')buildInput('inp-active');}
// -- Agent Mode: file attach (shown as a chip in the input bar, then carried into the sent chat message) --
function triggerAgentUpload(id){agentUploadTargetId=id;const inp=document.getElementById('agent-upload-input');if(!inp)return;inp.value='';inp.click();}
function handleAgentUpload(e){
  const file=e.target.files&&e.target.files[0];if(!file)return;
  const isImage=file.type.indexOf('image/')===0;
  const reader=new FileReader();
  reader.onload=function(ev){
    pendingAgentAttachment={name:file.name,dataUrl:ev.target.result,isImage:isImage};
    if(agentUploadTargetId)buildInput(agentUploadTargetId);
  };
  reader.readAsDataURL(file);
}
function clearPendingAgentAttachment(id){pendingAgentAttachment=null;buildInput(id);}

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ RENDER CHAT ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ RENDER CHAT ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function renderChat(area,msgs){
  const el=document.getElementById(area);el.innerHTML='';
  msgs.forEach(m=>{const r=document.createElement('div');r.className='msg-row '+(m.role==='user'?'user':'');
    if(m.role==='bot')r.innerHTML=`<div class="bot-av"><svg width="12" height="12" viewBox="0 0 24 24" fill="var(--orange)" stroke="none"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg></div>`;
    const b=document.createElement('div');b.className='bubble '+(m.role==='user'?'user':'bot');
    let inner=m.attachment?(m.attachment.isImage?`<img class="msg-attachment-img" src="${m.attachment.dataUrl}" alt="${m.attachment.name}">`:`<div class="msg-attachment-file">&#128206; ${m.attachment.name}</div>`):'';
    inner+=m.text?`<div${m.attachment?' style="margin-top:6px"':''}>${m.text}</div>`:'';
    b.innerHTML=inner;r.appendChild(b);
    if(m.role==='user')r.innerHTML+=`<div class="user-av">PP</div>`;
    el.appendChild(r);
  });el.scrollTop=el.scrollHeight;
}
function showTyping(area){const el=document.getElementById(area);const r=document.createElement('div');r.className='msg-row';r.id='typing';r.innerHTML=`<div class="bot-av"><svg width="12" height="12" viewBox="0 0 24 24" fill="var(--orange)" stroke="none"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg></div><div class="bubble bot typing-dots"><span></span><span></span><span></span></div>`;el.appendChild(r);el.scrollTop=el.scrollHeight;}
function hideTyping(){const t=document.getElementById('typing');if(t)t.remove();}

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ FORM BUILDER ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
function buildStepper(active){
  const labels=['Eligibility','Profile','Job','Leaves','Review'];
  let html='<div class="stepper">';
  labels.forEach((l,i)=>{
    const cls=i<active?'done':(i===active?'active':'');
    const num=i<active?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':(i+1);
    html+=`<div class="step-dot ${cls}"><div class="sd-circle">${num}</div><div class="sd-label">${l}</div></div>`;
    if(i<labels.length-1)html+=`<div class="step-line ${i<active?'done':''}"></div>`;
  });
  html+='</div>';
  return html;
}
function selRadio(card){const grid=card.parentElement;[...grid.querySelectorAll('.choice-card')].forEach(c=>c.classList.remove('selected'));card.classList.add('selected');const inp=card.querySelector('input');if(inp)inp.checked=true;}
function selSeg(btn){const grp=btn.parentElement;[...grp.querySelectorAll('.seg-btn')].forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
function buildForm(step){
  const col=document.getElementById('form-col');col.style.display='flex';col.innerHTML='';
  const fp=document.createElement('div');fp.className='form-panel';
  const s=formSteps[step];
  if(step===5){fp.innerHTML=`<div class="success-card"><div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><div class="success-meta">&#10022; Created by Contractor Agent</div><h2 style="font-size:24px;font-weight:700;margin-bottom:8px;letter-spacing:-.3px">Contract Created Successfully!</h2><p style="font-size:13px;color:var(--gray);margin-bottom:8px;max-width:380px;line-height:1.55">Your contract is ready. We've sent it to the employee for signature and notified your team.</p><div style="font-size:12.5px;color:var(--navy);margin-bottom:24px;font-weight:500"><span style="color:var(--gray)">Contract ID</span> <span style=ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âfont-weight:700ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â>#342124</span> &middot; Netherlands &middot; EOR &mdash; Employee</div><div style=ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âdisplay:flex;gap:10px;justify-content:centerÃƒÂ¢Ã¢â€šÂ¬Ã‚Â><button class=ÃƒÂ¢Ã¢â€šÂ¬Ã‚Âbtn btn-primaryÃƒÂ¢Ã¢â€šÂ¬Ã‚Â>View Contract &#8594;</button><button class="btn btn-secondary">All Contracts</button></div></div>`;col.appendChild(fp);return;}
  let header=`<div class="fp-shell">${buildStepper(step)}<div class="fp-title-row"><div class="fp-eyebrow">Step ${step+1} of 5 &middot; ${s.short}</div><div class="fp-h1">${s.title}</div><div class="fp-sub">${s.sub}</div></div></div>`;
  let body='';
  if(step===0){body=`<div class="section-block"><div class="section-head">Country & Nationality</div><div class="form-grid"><div class="form-field"><label class="form-label">Employee Nationality <span class="req">*</span></label>${customSelect('employee-nationality','Select country',['Select country','Netherlands','India','Germany'],'Select country')}</div><div class="form-field"><label class="form-label">Working from <span class="req">*</span></label><input class="form-input readonly" value="&#127475;&#127473; Netherlands" readonly><span class="field-prefill">&#10022; Pre-filled by Agent</span></div></div></div><div class="section-block"><div class="section-head">Work Authorization</div><div class="choice-grid"><label class="choice-card selected" onclick="selRadio(this)"><input type="radio" name="auth" checked><div class="choice-radio"></div><div class="choice-body"><div class="choice-title">Yes, employee has a work permit</div><div class="choice-desc">They already hold a valid permit & BSN to work in Netherlands.</div></div></label><label class="choice-card" onclick="selRadio(this)"><input type="radio" name="auth"><div class="choice-radio"></div><div class="choice-body"><div class="choice-title">ADT to assist with work visa</div><div class="choice-desc">We'll handle visa sponsorship & onboarding paperwork on your behalf.</div></div></label></div></div><div class="info-box tip"><div class="ib-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div><div><strong>Netherlands compliance note</strong>All employees need a BSN (Citizen Service Number) and a valid work permit before their start date.</div></div>`;}
  else if(step===1){body=`<div class="section-block"><div class="section-head">Personal details</div><div class="form-grid"><div class="form-field"><label class="form-label">First name <span class="req">*</span></label><input class="form-input" placeholder="e.g. Anika"></div><div class="form-field"><label class="form-label">Last name <span class="req">*</span></label><input class="form-input" placeholder="e.g. Shah"></div><div class="form-field"><label class="form-label">Gender <span class="req">*</span></label>${customSelect('employee-gender','Select gender',['Select gender','Female','Male','Non-binary','Prefer not to say'],'Select gender')}</div><div class="form-field"><label class="form-label">Date of birth <span class="req">*</span></label><input class="form-input" placeholder="DD / MM / YYYY"></div></div></div><div class="section-block"><div class="section-head">Contact</div><div class="form-grid"><div class="form-field"><label class="form-label">Email address <span class="req">*</span></label><input class="form-input" placeholder="name@company.com"></div><div class="form-field"><label class="form-label">Mobile number <span class="req">*</span></label><input class="form-input" placeholder="+91  Enter mobile number"></div></div><div class="form-grid full" style="margin-top:16px"><div class="form-field"><label class="form-label">Address</label><input class="form-input" placeholder="Street, city, postal code, country"></div></div></div>`;}
  else if(step===2){body=`<div class="section-block"><div class="section-head">Role</div><div class="form-grid"><div class="form-field"><label class="form-label">Job title <span class="req">*</span></label><input class="form-input" placeholder="e.g. Senior Software Engineer"></div><div class="form-field"><label class="form-label">Primary skill <span class="req">*</span></label><input class="form-input" placeholder="e.g. Backend, Python"></div></div><div class="form-grid full" style="margin-top:16px"><div class="form-field"><label class="form-label">Job description</label><input class="form-input" placeholder="Briefly describe responsibilities (max 100 words)"><span class="field-hint">A short summary of duties and expectations.</span></div></div></div><div class="section-block"><div class="section-head">Employment type</div><div class="form-grid"><div class="form-field"><label class="form-label">Employment term</label><div class="segmented"><button class="seg-btn active" type="button" onclick="selSeg(this)">Permanent</button><button class="seg-btn" type="button" onclick="selSeg(this)">Fixed term</button></div></div><div class="form-field"><label class="form-label">Employee type</label><div class="segmented"><button class="seg-btn active" type="button" onclick="selSeg(this)">Full time</button><button class="seg-btn" type="button" onclick="selSeg(this)">Part time</button></div></div></div><div class="form-grid" style="margin-top:16px"><div class="form-field"><label class="form-label">From date <span class="req">*</span></label><input class="form-input" placeholder="DD / MM / YYYY"></div><div class="form-field"><label class="form-label">To date</label><input class="form-input" placeholder="Optional &middot; DD / MM / YYYY"></div></div></div><div class="section-block"><div class="section-head">Schedule & compensation</div><div class="form-grid"><div class="form-field"><label class="form-label">Work schedule</label><div class="input-suffix"><input value="40"><span class="sfx">hours / week</span></div></div><div class="form-field"><label class="form-label">Pay frequency <span class="req">*</span></label>${customSelect('pay-frequency','Monthly',['Monthly','Bi-weekly','Weekly'],'')}</div></div><div class="form-grid full" style="margin-top:16px"><div class="form-field"><label class="form-label">Pay amount <span class="req">*</span></label><div class="pay-group">${customSelect('pay-currency','INR &#8377;',['INR &#8377;','EUR &#8364;','USD $'],'','currency-select')}<input value="70,000"></div><span class="field-hint">Gross pay before taxes & deductions.</span></div></div></div>`;}
  else if(step===3){body=`<div class="section-block"><div class="section-head">Leave entitlement</div><p style="font-size:12px;color:var(--gray);margin-bottom:14px;line-height:1.5">Pre-filled to Netherlands statutory minimums. Add more days if you'd like to offer above the legal floor.</p><table class="leave-table"><thead><tr><th>Leave type</th><th>Mandatory</th><th>Additional</th><th style="text-align:right">Total</th></tr></thead><tbody><tr><td class="lt-name">Annual leaves</td><td>18 days</td><td class="lt-add">+ Add days</td><td class="lt-total" style="text-align:right">18 days</td></tr><tr><td class="lt-name">Sick leaves</td><td>12 days</td><td>06 days</td><td class="lt-total" style="text-align:right">18 days</td></tr><tr><td class="lt-name">Maternity leaves</td><td>36 weeks</td><td>02 weeks</td><td class="lt-total" style="text-align:right">38 weeks</td></tr></tbody></table><button class="add-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add another leave type</button></div><div class="section-block"><div class="section-head">Probation & notice</div><div class="form-grid"><div class="form-field"><label class="form-label">Probation period</label><div class="input-suffix"><input value="3"><span class="sfx">months</span></div><span class="field-hint">A 1-month gross salary deposit will be invoiced.</span></div><div class="form-field"><label class="form-label">Notice period</label><div class="input-suffix"><input value="3"><span class="sfx">months</span></div><span class="field-hint">Standard for Netherlands EOR contracts.</span></div></div></div>`;}
  else if(step===4){body=`<div class="review-section"><div class="review-title">Eligibility <button class="review-edit" onclick="editReviewStep(0)">Edit &#8599;</button></div><div class="review-grid"><div class="review-row"><div class="rr-label">Employee Nationality</div><div class="rr-val">Netherlands</div></div><div class="review-row"><div class="rr-label">Working from</div><div class="rr-val">Netherlands</div></div><div class="review-row"><div class="rr-label">Work authorization</div><div class="rr-val">Has work permit</div></div></div></div><div class="review-section"><div class="review-title">Employee Information <button class="review-edit" onclick="editReviewStep(1)">Edit &#8599;</button></div><div class="review-grid"><div class="review-row"><div class="rr-label">Full name</div><div class="rr-val empty">to be filled</div></div><div class="review-row"><div class="rr-label">Email</div><div class="rr-val empty">to be filled</div></div><div class="review-row"><div class="rr-label">Mobile</div><div class="rr-val empty">to be filled</div></div><div class="review-row"><div class="rr-label">Date of birth</div><div class="rr-val empty">to be filled</div></div></div></div><div class="review-section"><div class="review-title">Job Details <button class="review-edit" onclick="editReviewStep(2)">Edit &#8599;</button></div><div class="review-grid"><div class="review-row"><div class="rr-label">Employment</div><div class="rr-val">Permanent &middot; Full time</div></div><div class="review-row"><div class="rr-label">Pay amount</div><div class="rr-val">INR 70,000 / Monthly</div></div><div class="review-row"><div class="rr-label">Work schedule</div><div class="rr-val">40 hours / week</div></div><div class="review-row"><div class="rr-label">Job title</div><div class="rr-val empty">to be filled</div></div></div></div><div class="review-section"><div class="review-title">Other Details <button class="review-edit" onclick="editReviewStep(3)">Edit &#8599;</button></div><div class="review-grid"><div class="review-row"><div class="rr-label">Annual leaves</div><div class="rr-val">18 days</div></div><div class="review-row"><div class="rr-label">Sick leaves</div><div class="rr-val">18 days</div></div><div class="review-row"><div class="rr-label">Probation</div><div class="rr-val">3 months</div></div><div class="review-row"><div class="rr-label">Notice period</div><div class="rr-val">3 months</div></div></div></div><div class="info-box tip"><div class="ib-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg></div><div><strong>You're almost there</strong>Submit to draft this contract &mdash; we'll send it for signature &amp; notify your team.</div></div>`;}
  const isLast=step===4;
  const backBtn=step>0?'<button class="btn btn-secondary" onclick="prevStep()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="15 18 9 12 15 6"/></svg> Back</button>':'<span></span>';
  const nextLabel=isLast?'Submit Contract':'Continue';
  const nextCls=isLast?'btn btn-success':'btn btn-primary';
  const prefill=step===0?'<div class="prefill-text"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg> Agent pre-filled Netherlands for you</div>':'<div style="font-size:11.5px;color:var(--gray)">Step '+(step+1)+' of 5</div>';
  const _ck=String.fromCharCode(10003),_ar=String.fromCharCode(8594);const footer='<div class="fp-foot"><div class="form-footer">'+backBtn+prefill+'<button class="'+nextCls+'" onclick="nextStep()">'+nextLabel+(isLast?' '+_ck:' '+_ar)+'</button></div></div>';
  fp.innerHTML=header+'<div class="fp-body">'+body+'</div>'+footer;col.appendChild(fp);
}

function editReviewStep(step){returnToReview=true;formStep=step;buildForm(step);}
function nextStep(){if(returnToReview&&formStep<4){returnToReview=false;formStep=4;buildForm(4);return;}formStep++;if(formStep<=5){if(formStep===5){const col=document.getElementById('form-col');col.style.display='flex';col.innerHTML='<div class="contract-loader"><div class="cl-spinner"></div><div class="cl-title">Creating Contract...</div><div class="cl-sub">Setting up EOR agreement for Netherlands</div></div>';setTimeout(()=>{buildForm(5);agentMsgs.push({role:'bot',text:String.fromCodePoint(127881)+' Contract created successfully! Contract ID: <b>#342124</b> for Netherlands (EOR). You can view it anytime from the Contracts page.'});renderChat('agent-chat',agentMsgs);},2500);}else{buildForm(formStep);}}}
function prevStep(){if(formStep>0){formStep--;buildForm(formStep);}}

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ NAVIGATION ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
function showView(v){document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));document.getElementById('v-'+v).classList.add('active');view=v;}

function toggleSidebar(scope){
  if(scope==='adt'){adtSidebarCollapsed=!adtSidebarCollapsed;buildSidebar('adt-sidebar',adtSidebarCollapsed,getSidebarActivePage(page));return;}
  agentSidebarCollapsed=!agentSidebarCollapsed;buildSidebar('agent-sb',agentSidebarCollapsed,page);buildTopbar('agent-topbar-active','agent');
}

function openAgent(){hideAgentWorkspaceButton();showView('agent-empty');mode='agent';buildTopbar('agent-topbar-empty','agent');buildInput('inp-empty');buildQuickActions();setTimeout(initAmThreeJS,80);}
function closeAgent(){stopAmThreeJS();hideAgentWorkspaceButton();agentRunData=null;pendingAgentAttachment=null;showView('adt');renderADTPage();}

// -- ROLE ACCESS GUARD --
const pageRoleMap={
  'cfg-overview':['super-admin'],'cfg-system-add':['super-admin'],
  // -- Data Foundation and a model's detail are open to Entity Admin; minting a new model is not,
  // mirroring Systems (browse + open + edit, but cfg-system-add is Super Admin). cfg-model-detail
  // has to travel with the list — the cards on it are links, and a guard that bounced them would
  // make the page a dead end. --
  'cfg-data-foundation':['super-admin','entity-admin'],'cfg-model-detail':['super-admin','entity-admin'],'cfg-model-add':['super-admin'],
  /* FR3.5 opens the READING of a category to Entity Admin, same as the Data Foundation list it
     hangs off — "other authorized users shall use the configured data as applicable to their
     process and role", and they cannot use what the router bounces them off. What Entity Admin
     may not do is WRITE, and that is cfgCanEditDataFoundation's job inside the page, not this
     map's: guarding the route instead would take the reading away with the writing. */
  'cfg-category-detail':['super-admin','entity-admin'],
  // The Sub-Contracting transaction screen. Entity User only: every actor on the journey is a
  // persona, and Super Admin / Entity Admin configure the journey rather than run it.
  'sc-txn':['entity-user'],
  'cfg-systems':['super-admin','entity-admin'],'cfg-system-detail':['super-admin','entity-admin'],
  /* -- Entity User is allowed through so the Account Manager can run the User Master Data Creation
     Journey end to end: Create Client opens the intake form, and submitting it lands on All Clients.

     WHICH PERSONAS SEE A MODULE IS THE SIDEBAR'S QUESTION (personaModules), NOT THIS MAP'S. This
     map is the portal-role guard and stays that way. A persona routinely lands on a record
     outside its own modules by following something it was handed — a task, a dashboard tile, a
     journey handoff — and bouncing those crossings would break the operating model rather than
     enforce it. Read personaModules' header before wiring the two together. -- */
  'cfg-user-intake':['super-admin','entity-admin','entity-user'],
  // -- Super Admin cannot open a store: it configures what a store is, it does not open one.
  // Inside Entity User this is the Ops Manager's alone — see the sidebar entry. --
  'create-store':['entity-admin','entity-user'],
  'stores':['super-admin','entity-admin','entity-user'],
  'master-data':['super-admin','entity-admin','entity-user'],
  'cfg-context-journey':['super-admin','entity-admin'],'cfg-journey-detail':['super-admin','entity-admin'],
  'cfg-agents':['super-admin','entity-admin'],
  // -- Withdrawn from Super Admin, which was its only audience, so the route closes with the menu
  // entry. An empty list denies everyone: canAccessPage returns false once `allowed` exists. --
  'ai-analytics':[],
  'my-runs':['entity-admin','entity-user'],
  'all-users':['super-admin'],'settings':['super-admin']
};
function canAccessPage(pg,role){const allowed=pageRoleMap[pg];return !allowed||allowed.includes(role);}
function defaultPageForRole(role){return role==='entity-user'?'ai-executive':'dashboard';}

/* == MERGED PAGES: SCOPE STATE ============================================================
   Employees and Timesheet each replaced two sidebar rows and two page ids with one page and a
   switch inside it. The scope lives here rather than in `page` so that every page still maps to
   exactly one sidebar row to highlight — which is most of the reason the merge is worth doing.
   Defaults are the view a person lands on cold: their own timesheet, and direct employees. == */
let empScope='direct';   // 'direct' | 'global'
let tsScope='my';        // 'my' | 'all'
const TS_DEFAULT_EMP={name:'Shaun Test1',initials:'ST',role:'Entity Super Admin'};
/* Every retired id still resolves. Dashboard tiles, journey module links, the All Timesheet
   drill-down and the back buttons all pass ids like 'direct' or 'all-timesheet'; rewriting each
   call site would be a lot of edits for no behavioural gain, and any one missed would 404 into
   the role's default page with no clue why. Translating here — at the single funnel every
   navigation goes through — means one place has to be right instead of a dozen. */
function resolvePageAlias(pg){
  if(pg==='direct'||pg==='global'){empScope=pg;return 'employees';}
  if(pg==='my-timesheet'||pg==='all-timesheet'){tsScope=pg==='my-timesheet'?'my':'all';return 'timesheet';}
  return pg;
}

function navigatePage(pg){
  /* A plain trip to Timesheet is a trip to YOUR timesheet. Without this, drilling into a
     colleague's calendar from the All tab and then clicking Timesheet in the sidebar would
     re-open that colleague's month under a tab labelled "My" — the state survived the
     navigation because the page id no longer changes between the two views. */
  if(pg==='timesheet')tsEmp=Object.assign({},TS_DEFAULT_EMP);
  pg=resolvePageAlias(pg);
  const resolved=canAccessPage(pg,portalRole)?pg:defaultPageForRole(portalRole);
  // Any deliberate navigation ends the All Timesheet drill-down, including the back button itself.
  tsFromAllTimesheet=false;
  // -- The "Live NewForce Solutions Sync" listener (aiH2rStartAdtListening, js/pages.js) only makes sense while the operator is looking at the H2R live-run screen ('ai-journey-run'). Navigating anywhere else stops it, so a background poll can never silently pull the operator back into a run they've already left. --
  if(resolved!=='ai-journey-run'&&typeof adtPollTimerId!=='undefined'&&adtPollTimerId)aiH2rStopAdtListening();
  if(resolved!==page){
    if(view==='adt'&&navStack.length&&navStack[navStack.length-1]===resolved){
      navStack.pop();
    }else if(view==='adt'){
      navStack.push(page);
    }
  }
  page=resolved;
  if(view==='adt'){renderADTPage();return;}
  if(view==='agent-active'){showAgentModule(resolved);return;}
}
// -- No history-based "go back": the back bar navigates to a page's canonical parent instead
// (see injectPageBackBar, js/renderer.js). navStack is still maintained because navigatePage
// uses it to avoid pushing duplicate entries when stepping back through a drill-down. --

function portalRoleLabel(r){return r==='super-admin'?'Super Admin':r==='entity-admin'?'Entity Admin':getActivePersona().label;}
function portalRoleInitials(r){return r==='super-admin'?'SA':r==='entity-admin'?'EA':getActivePersona().initials;}
function setPortalRole(role,force,personaId){
  if(role==='entity-user'&&!activePersonaId)activePersonaId='planner';
  const sameRole=role===portalRole&&!force;
  const samePersona=role!=='entity-user'||personaId===undefined||personaId===activePersonaId;
  if(sameRole&&samePersona)return;
  personaSessionState[currentSessionKey()]={page:page,dashboardTab:dashboardTab,navStack:navStack.slice()};
  portalRole=role;
  if(role==='entity-user')activePersonaId=personaId||activePersonaId||'planner';
  userDDMode='main';
  closeAllHdrDD();
  if(view!=='adt'){stopAmThreeJS();showView('adt');}
  const saved=personaSessionState[currentSessionKey()];
  if(saved){
    page=saved.page;dashboardTab=saved.dashboardTab;navStack=saved.navStack.slice();
  }else{
    // Cleared, not pinned to 'employee' — see the note on the declaration.
    dashboardTab='';page=defaultPageForRole(portalRole);navStack=[];
  }
  renderADTPage();
  renderUserDD();
  showAiToast('Switched to '+portalRoleLabel(portalRole),'You are now viewing ADT as this role.');
}

// -- DASHBOARD TABS: every role now lands on the standard Employee Dashboard, with any
// role-specific dashboard sitting beside it as a second tab. Super Admin has no second tab —
// its platform oversight moved to AI Executive, where the rest of the AI layer already lives. --
function dashboardTabsForRole(role){
  const employeeTab={id:'employee',label:'Employee Dashboard'};
  if(role==='entity-user'){
    /* -- Sub-Contracting roles get one tab, and it is the journey board: the step tiles and
       the work table. They have no second dashboard to toggle against, so the strip renders a
       single pill rather than a chooser. Driven off the persona's own `journeys` list so a
       role added later needs nothing here. -- */
    const p=getActivePersona();
    if(p&&(p.journeys||[]).indexOf('sub-contracting')>-1)return [{id:'sc-journeys',label:'Journeys'}];
    const map={
      'account-manager':[{id:'sales',label:'Deal Desk Dashboard'}],
      'deal-manager':[{id:'sales-team',label:'Sales Team Dashboard'},{id:'sales-approvals',label:'Deal Approvals'}],
      'compliance-officer':[{id:'compliance',label:'Compliance Dashboard'}],
      'legal-contracts-manager':[{id:'contracts-admin',label:'Contracts Dashboard'}],
      'hr':[{id:'hr',label:'HR Dashboard'},{id:'manager',label:'Reporting Manager'}],
      'hr-manager':[{id:'hr',label:'HR Dashboard'},{id:'manager',label:'Reporting Manager'}],
      'it-systems-admin':[{id:'it-admin',label:'IT Systems Dashboard'}],
      'finance-approver':[{id:'finance-approval',label:'Finance Approval'},{id:'finance-admin',label:'Finance Admin'}]
    };
    // -- Account Manager is the exception: its Deal Desk view IS the dashboard, so it lands
    // straight on it with no tab bar at all (buildDashboardTabsHTML renders nothing below two
    // tabs). The employee self-service figures the standard dashboard carried stay reachable
    // through the sidebar — Leaves, My Timesheet, My Profile — so nothing is lost, only the
    // extra click and the tab strip above a page that already fills the viewport. --
    if(activePersonaId==='account-manager')return [{id:'sales',label:'Deal Desk'}];
    /* -- Ops Manager leads on Store Operations: the Bhaiyaa store board is a live pipeline over
       real records, and the two dashboards behind it are stat pages. It does not follow the
       Account Manager all the way to a single tab, because those two are not duplicates of it —
       they are a different domain (contracts and approvals) that this role still works. What
       does drop is the employee self-service tab, on the same reasoning the Account Manager
       used: Leaves, My Timesheet and My Profile all stay one click away in the sidebar, so the
       tab bought a pill and nothing else. -- */
    if(activePersonaId==='ops-manager')return [{id:'store-ops',label:'Store Operations'},{id:'ops',label:'Ops Dashboard'},{id:'ops-approvals',label:'Ops Approvals'}];
    // -- Personas with no dashboard of their own keep the role-scoped hero view under "My
    // Workspace", so moving the standard dashboard onto the `employee` id does not cost them it. --
    return [employeeTab].concat(map[activePersonaId]||[{id:'my-work',label:'My Workspace'}]);
  }
  /* -- Entity Admin follows the Account Manager pattern above: one dashboard, no tab strip.
     The entity view IS the dashboard for this role — systems, journeys, and the requests
     queue — and pairing it with the employee self-service view put a two-pill toggle above a
     page that only ever wanted one of them. The self-service figures stay reachable through
     the sidebar (Leaves, My Timesheet, My Profile), so only the toggle is gone. -- */
  if(role==='entity-admin')return [{id:'entity-admin',label:'Entity Admin'}];
  return [employeeTab];
}
function toggleSalesTeamQueuePanel(){
  salesTeamQueueOpen=!salesTeamQueueOpen;
  renderADTPage();
}
function toggleComplianceContractQueuePanel(){
  complianceContractQueueOpen=!complianceContractQueueOpen;
  renderADTPage();
}
function toggleComplianceHubItemsPanel(){
  complianceHubItemsOpen=!complianceHubItemsOpen;
  renderADTPage();
}
function toggleComplianceSupportItemsPanel(){
  complianceSupportItemsOpen=!complianceSupportItemsOpen;
  renderADTPage();
}
function switchDashboardTab(tab){
  dashboardTab=tab;
  if(view==='adt')renderPageContent('adt-content');
  else if(view==='agent-active')showAgentModule(page);
}

function buildQuickActions(){
  const g=document.getElementById('qa-grid');g.innerHTML='';
  [{l:'Cost Calculator',d:'Estimate costs across countries',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/></svg>'},{l:'Create Contract',display:'Onboard an Employee',d:'Create contract for employee',i:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'}].forEach(a=>{
    const c=document.createElement('div');c.className='action-card';
    c.innerHTML=`<div class="ac-icon">${a.i}</div><div><div class="ac-label">${a.display||a.l}</div><div class="ac-desc">${a.d}</div></div>`;
    c.onclick=()=>quickAction(a.l);g.appendChild(c);
  });
}

function quickAction(label){
  formStep=-1;
  const txt=label==='Create Contract'?'Create Contract':`I want to use ${label}`;
  agentMsgs.push({role:'user',text:txt});
  showView('agent-active');buildTopbar('agent-topbar-active','agent');buildSidebar('agent-sb',agentSidebarCollapsed,page);renderChat('agent-chat',agentMsgs);buildInput('inp-active');showWorkspaceEmpty();
  showTyping('agent-chat');
  setTimeout(()=>{hideTyping();
    if(label==='Create Contract'){
      agentMsgs.push({role:'bot',text:'Sure. Which country should I use for this contract? Type something like <b>create contract in Netherlands</b> and I will open the workspace.'});
    }else{agentMsgs.push({role:'bot',text:`Sure! Let me set up the ${label} for you. Which country would you like to start with?`});}
    renderChat('agent-chat',agentMsgs);
  },1200);
}
// == CONTEXT-AWARE RESPONSE ENGINE ==
function isDataQuery(t){const q=t.toLowerCase();return(q.includes('how many')||q.includes('count')||q.includes('total')||q.includes('show')||q.includes('list')||q.includes('pending')||q.includes('active')||q.includes('inactive')||q.includes('status'))&&!isCreateContractRequest(q);}

function getContextualAnswer(text,pg){
  const q=text.toLowerCase().trim();
  const meta=getPageMeta(pg);
  const rows=meta.rows||[];
  const cols=meta.columns||[];
  if(!rows.length)return 'I can help you with the <b>'+meta.title+'</b> page. What would you like to know?';
  const statusIdx=cols.findIndex(function(c){return c.toLowerCase()==='status';});
  const nameIdx=1;
  const countryIdx=cols.findIndex(function(c){return c.toLowerCase()==='country';});
  const byStatus=function(s){return statusIdx>=0?rows.filter(function(r){return String(r[statusIdx]||'').toLowerCase()===s.toLowerCase();}):[];};
  const fmtList=function(items,max){max=max||4;var ns=items.slice(0,max).map(function(r){return'<b>'+r[nameIdx]+'</b>';}).join(', ');return items.length>max?ns+' and <b>'+(items.length-max)+' more</b>':ns;};
  const pending=byStatus('pending');
  const active=byStatus('active');
  const inactive=byStatus('inactive');
  const isCount=q.includes('how many')||q.includes('count')||q.includes('total')||q.includes('number of');
  const isList=q.includes('list')||q.includes('show')||q.includes('which')||q.includes('all')||q.includes('what are');
  const nm=meta.title.toLowerCase();
  if(q.includes('pending')&&(isCount||isList)){
    if(pending.length===0)return 'There are <b>no pending</b> '+nm+' on this page right now.';
    return 'There '+(pending.length===1?'is':'are')+' <b>'+pending.length+' pending</b> '+nm+(pending.length>0?': '+fmtList(pending):'')+'.';}
  if(q.includes('active')&&!q.includes('inactive')&&(isCount||isList)){
    return 'There '+(active.length===1?'is':'are')+' <b>'+active.length+' active</b> '+nm+(active.length>0?': '+fmtList(active):'')+'.';}
  if((q.includes('inactive')||q.includes('closed'))&&(isCount||isList)){
    return 'There '+(inactive.length===1?'is':'are')+' <b>'+inactive.length+' inactive/closed</b> '+nm+(inactive.length>0?': '+fmtList(inactive):'')+'.';}
  if(isCount){
    var statStr=statusIdx>=0?' - <span style="color:var(--green)">'+active.length+' active</span>, <span style="color:#b45309">'+pending.length+' pending</span>, <span style="color:var(--gray)">'+inactive.length+' inactive</span>':'';
    return 'The <b>'+meta.title+'</b> page shows <b>'+rows.length+' total</b> records'+statStr+'.';}
  if(countryIdx>=0){
    var cmap={netherlands:'Netherlands',india:'India',germany:'Germany',spain:'Spain','united kingdom':'United Kingdom',uk:'United Kingdom'};
    var ckeys=Object.keys(cmap);
    for(var ci=0;ci<ckeys.length;ci++){var k=ckeys[ci];if(q.includes(k)){var v=cmap[k];var filt=rows.filter(function(r){return String(r[countryIdx]||'').toLowerCase().includes(k==='uk'?'kingdom':k);});if(filt.length===0)return 'No '+nm+' found for <b>'+v+'</b> on this page.';return 'Found <b>'+filt.length+' '+nm+'</b> for <b>'+v+'</b>: '+fmtList(filt,5)+'.';}}
  }
  var kws=q.split(/\s+/).filter(function(w){return w.length>3&&['what','which','when','where','does','have','this','that','there','from','with','about','many'].indexOf(w)<0;});
  if(kws.length>0){var matches=rows.filter(function(r){return kws.some(function(kw){return r.join(' ').toLowerCase().includes(kw);});});if(matches.length>0&&matches.length<rows.length)return 'Found <b>'+matches.length+' matching record'+(matches.length>1?'s':'')+'</b> on <b>'+meta.title+'</b>: '+fmtList(matches,4)+'.';}
  var defStat=statusIdx>=0?' - <span style="color:var(--green)">'+active.length+' active</span>, <span style="color:#b45309">'+pending.length+' pending</span>, <span style="color:var(--gray)">'+inactive.length+' inactive</span>. Try asking <i>"How many are pending?"</i> or <i>"Show active '+nm+'"</i>':'';
  return 'The <b>'+meta.title+'</b> page currently has <b>'+rows.length+' records</b>'+defStat+'.';}

function agentReply(t){
  var q=t.toLowerCase().trim();
  var unsupportedCountries=['russia','india','germany','spain','france','italy','usa','united states','uk','united kingdom','england','scotland','wales','ireland','northern ireland','china','australia','canada','brazil','mexico','japan','poland','portugal','sweden','norway','denmark','finland','austria','switzerland','belgium','singapore','dubai','uae','emirates','turkey','vietnam','thailand','malaysia','indonesia','philippines','south korea','korea','taiwan','hong kong','new zealand','south africa','nigeria','kenya','egypt','saudi arabia','saudi','qatar','bahrain','oman','kuwait','israel','greece','czech','hungary','romania','ukraine','croatia','serbia','slovakia','bulgaria','latvia','lithuania','estonia','iceland','luxembourg','malta','cyprus','bangladesh','pakistan','sri lanka','nepal','myanmar','cambodia','laos','mongolia','kazakhstan','uzbekistan','azerbaijan','georgia','armenia','ghana','ethiopia','tanzania','uganda','rwanda','senegal','cameroon','ivory coast','morocco','algeria','tunisia','libya','sudan','angola','mozambique','zimbabwe','zambia','botswana','namibia','madagascar','mauritius','colombia','argentina','chile','peru','venezuela','ecuador','bolivia','uruguay','paraguay','guatemala','cuba','dominican republic','costa rica','panama','jamaica'];
  var foundCountry=unsupportedCountries.find(function(c){return q.includes(c);});
  var capCountry=foundCountry?foundCountry.split(' ').map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(' '):'';
  // Check if last bot message was suggesting Netherlands - if user says yes/proceed, start form
  var lastBot=agentMsgs.filter(function(m){return m.role==='bot';});
  var lastBotText=lastBot.length>0?lastBot[lastBot.length-1].text.toLowerCase():'';
  var botSuggestedNetherlands=lastBotText.includes('netherland');
  var userAffirms=/^(yes|yeah|yep|yup|ok|okay|sure|proceed|go ahead|do it|alright|fine|sounds good|let'?s go|let'?s do it|create it|make it|start it)[\s!.]*$/.test(q);
  if(botSuggestedNetherlands&&userAffirms){setTimeout(function(){startNetherlandsContract();},100);return 'Great! Opening the Netherlands contract workspace now.';}
  // Greeting detection
  var isPureGreeting=/^(hi+|hello+|hey+|howdy|greetings|good morning|good afternoon|good evening)[\s!.]*$/i.test(q);
  var isHowAreYou=/how are you|how'?s it going|how do you do|what'?s up/i.test(q);
  if(isPureGreeting){return "Hello! I'm your ADT Agent. I can help you create contracts, manage employees, check payroll, and more. What would you like to do today?";}
  if(isHowAreYou){return "I'm doing great, thanks for asking! Ready to help. I can create contracts, look up employee data, assist with payroll, and more. What do you need?";}

  // Netherlands contract - start immediately
  if(isNetherlandsContractRequest(t)){return null;}
  // Create contract with unsupported country
  if(isCreateContractRequest(t)&&foundCountry){return 'Contracts for <b>'+capCountry+'</b> are not yet supported in this workspace. We currently support <b>Netherlands</b> contracts. Would you like me to <b>create a Netherlands contract</b> instead?';}
  // Create contract generic
  if(isCreateContractRequest(t)){return 'Got it! We currently support <b>Netherlands</b> contracts. Type <b>create contract in Netherlands</b> to get started right away.';}
  // Mentioned an unsupported country in any context
  if(foundCountry){return 'Contracts for <b>'+capCountry+'</b> are not yet available. Currently, we support <b>Netherlands</b> contracts. Say <b>create contract in Netherlands</b> if you want to proceed.';}
  // Data / page queries
  if(isDataQuery(t)){return getContextualAnswer(t,page);}
  // Wants to create or set something up generically
  if(q.includes('contract')||q.includes('create')||q.includes('new')||q.includes('add')||q.includes('hire')||q.includes('onboard')){return 'I can help with that! Currently I support creating <b>Netherlands contracts</b>. Just say <b>create contract in Netherlands</b> to open the workspace.';}
  // Fallback - helpful generic
  return 'I can help you with contracts, payroll, compliance, and more. Try <b>create contract in Netherlands</b>, or ask me about any data on this page like <i>"How many contracts are active?"</i>';}

function sendMsg(id){
  const inp=document.querySelector('#'+id+' .input-field');const t=inp.value.trim();
  if(!t&&!pendingAgentAttachment)return;
  inp.value='';
  if(view==='agent-empty'||view==='agent-active'){
    const contractReq=parseAgentContractPrompt(t);
    const attachment=pendingAgentAttachment;pendingAgentAttachment=null;
    const startsContract=!contractReq&&isNetherlandsContractRequest(t);
    const userMsg={role:'user',text:t};if(attachment)userMsg.attachment=attachment;
    agentMsgs.push(userMsg);
    if(view==='agent-empty'){stopAmThreeJS();showView('agent-active');buildTopbar('agent-topbar-active','agent');buildSidebar('agent-sb',agentSidebarCollapsed,page);buildInput('inp-active');if(formStep<0&&!agentRunData)showWorkspaceEmpty();}
    else{buildInput(id);if(formStep<0&&!agentRunData)showWorkspaceEmpty();}
    renderChat('agent-chat',agentMsgs);showTyping('agent-chat');
    setTimeout(()=>{hideTyping();
      if(contractReq){agentRunStart(contractReq.name,contractReq.country,attachment);}
      else if(startsContract){agentMsgs.push({role:'bot',text:"Great! I'll open the Netherlands contract workspace now."});startNetherlandsContract();}
      else{var reply=agentReply(t);if(reply){agentMsgs.push({role:'bot',text:reply});if(formStep<0&&!agentRunData)showWorkspaceEmpty();}}
      renderChat('agent-chat',agentMsgs);
    },1000);
  }
}

function buildListingCell(cell,column){
  if(column==='Status'||column==='status')return `<td><span class="lp-status-badge ${statusClass(cell)}">${cell}</span></td>`;
  if(column==='S.No'||column==='S. No')return `<td style="font-weight:700;color:var(--gray)">${cell}</td>`;
  return `<td>${cell}</td>`;
}

function buildListingHTML(pg){
  const meta=getPageMeta(pg);
  const allRows=meta.rows||[];
  const cols=meta.columns||[];
  const statusIdx=cols.findIndex(c=>c==='Status'||c==='status');
  const statusFilter=listStatusFilters[pg]||'';
  const rows=statusFilter&&statusIdx>=0?allRows.filter(r=>String(r[statusIdx]||'')===statusFilter):allRows;
  const isLeavePg=(pg==='all-leaves'||pg==='leaves');
  const s1Key=isLeavePg?'approved':'active';
  const s2Key=isLeavePg?'unapproved':'inactive';
  const s1Label=isLeavePg?'Approved':'Active';
  const s2Label=isLeavePg?'Unapproved':'Inactive';
  const s1Count=statusIdx>=0?allRows.filter(r=>String(r[statusIdx]||'').toLowerCase()===s1Key).length:0;
  const s2Count=statusIdx>=0?allRows.filter(r=>String(r[statusIdx]||'').toLowerCase()===s2Key).length:0;
  const s3Count=statusIdx>=0?allRows.filter(r=>String(r[statusIdx]||'').toLowerCase()==='pending').length:0;
  const pgSlug=pg.replace(/[^a-z0-9]/g,'-');
  const filters=meta.filters.map((f,i)=>apCS(`lst-${pgSlug}-f${i}`,getFilterOptions(f).slice(1),f==='Status'?statusFilter:'',f)).join('');
  const hamburger='<svg width="16" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="2" x2="17" y2="2"/><line x1="1" y1="7" x2="17" y2="7"/><line x1="1" y1="12" x2="17" y2="12"/></svg>';
  const headers=cols.map(c=>`<th>${c}</th>`).join('')+'<th>ACTION</th>';
  const tableRows=rows.length?rows.map(row=>`<tr>${row.map((cell,i)=>buildListingCell(cell,cols[i])).join('')}<td><button class="lp-action-btn" title="More actions">${hamburger}</button></td></tr>`).join(''):`<tr><td colspan="${cols.length+1}" style="padding:24px;text-align:center;color:var(--gray)">No records match this filter.</td></tr>`;
  return `<div class="listing-page">`
    +`<div class="listing-top">`
      +`<div class="lp-filter-bar" style="flex:1;min-width:0"><div class="lp-filter-bar-label">Select Filter</div><div class="lp-filter-bar-row">${filters}<button class="lp-pill-reset" onclick="resetListingFilters('${pg}')">Reset</button><button class="lp-pill-search" onclick="applyListingFilters('${pg}')">Search</button></div></div>`
      +`<div class="listing-stats">`
        +`<div class="listing-stat ${s1Key}${statusFilter===s1Label?' stat-selected':''}" onclick="toggleListingStatFilter('${pg}','${s1Label}')"><div class="listing-stat-count">${s1Count}</div><div class="listing-stat-label">${s1Label}</div></div>`
        +`<div class="listing-stat ${s2Key}${statusFilter===s2Label?' stat-selected':''}" onclick="toggleListingStatFilter('${pg}','${s2Label}')"><div class="listing-stat-count">${s2Count}</div><div class="listing-stat-label">${s2Label}</div></div>`
        +`<div class="listing-stat pending${statusFilter==='Pending'?' stat-selected':''}" onclick="toggleListingStatFilter('${pg}','Pending')"><div class="listing-stat-count">${s3Count}</div><div class="listing-stat-label">Pending</div></div>`
      +`</div>`
    +`</div>`
    +`<div class="listing-card"><table class="lp-table" style="min-width:700px"><thead><tr>${headers}</tr></thead><tbody>${tableRows}</tbody></table>`
    +`<div class="pagination"><button class="page-btn">&lt;</button><button class="page-btn">1</button><button class="page-btn active">2</button><button class="page-btn">3</button><button class="page-btn">4</button><button class="page-btn">...</button><button class="page-btn">86</button><button class="page-btn">&gt;</button></div>`
    +`</div></div>`;
}

function applyListingFilters(pg){
  const slug=pg.replace(/[^a-z0-9]/g,'-');
  const meta=getPageMeta(pg);
  const idx=(meta.filters||[]).findIndex(f=>f==='Status'||f==='status');
  const status=idx>=0?getCSValue('lst-'+slug+'-f'+idx):'';
  if(status&&status!=='Status')listStatusFilters[pg]=status;else delete listStatusFilters[pg];
  renderADTPage();
}
function resetListingFilters(pg){
  delete listStatusFilters[pg];
  renderADTPage();
}
function toggleListingStatFilter(pg,value){
  if(listStatusFilters[pg]===value)delete listStatusFilters[pg];
  else listStatusFilters[pg]=value;
  renderADTPage();
}

// -- LEAVE POLICIES DATA & PAGES --
const leavePoliciesData=[
  {id:1, type:'Casual Leave',        yearly:24, monthly:5,    carryForward:10,  probation:true,  prorate:false, status:'Active',   assignBy:'Department',  assignValue:'Engineering', employees:['Anika Shah','Shaun J']},
  {id:2, type:'Sick Leave',          yearly:12, monthly:2,    carryForward:5,   probation:true,  prorate:true,  status:'Active',   assignBy:'Designation', assignValue:'Developer',   employees:['Rahul Mehta','Pallavi P']},
  {id:3, type:'Earned Leave',        yearly:18, monthly:1,    carryForward:15,  probation:false, prorate:true,  status:'Active',   assignBy:'Branch',      assignValue:'Hyderabad',   employees:['Nora Kim']},
  {id:4, type:'Maternity Leave',     yearly:26, monthly:null, carryForward:null,probation:true,  prorate:false, status:'Inactive', assignBy:'Department',  assignValue:'HR',          employees:['Luis Martin']},
  {id:5, type:'Paternity Leave',     yearly:10, monthly:null, carryForward:null,probation:false, prorate:false, status:'Active',   assignBy:'Department',  assignValue:'Engineering', employees:['Shaun J','Rahul Mehta']},
  {id:6, type:'Bereavement Leave',   yearly:5,  monthly:null, carryForward:null,probation:true,  prorate:false, status:'Active',   assignBy:'Branch',      assignValue:'Mumbai',      employees:['Pallavi P']},
  {id:7, type:'Marriage Leave',      yearly:7,  monthly:null, carryForward:null,probation:false, prorate:false, status:'Active',   assignBy:'Department',  assignValue:'Sales',       employees:['Luis Martin']},
  {id:8, type:'Compensatory Leave',  yearly:12, monthly:3,    carryForward:6,   probation:true,  prorate:true,  status:'Active',   assignBy:'Designation', assignValue:'Developer',   employees:['Anika Shah','Nora Kim']},
  {id:9, type:'Privilege Leave',     yearly:15, monthly:2,    carryForward:10,  probation:false, prorate:true,  status:'Active',   assignBy:'Branch',      assignValue:'Delhi',       employees:['Rahul Mehta']},
  {id:10,type:'Unpaid Leave',        yearly:30, monthly:10,   carryForward:null,probation:true,  prorate:false, status:'Active',   assignBy:'Department',  assignValue:'Product',     employees:['Shaun J']},
  {id:11,type:'Study Leave',         yearly:10, monthly:null, carryForward:5,   probation:false, prorate:true,  status:'Inactive', assignBy:'Designation', assignValue:'HR Manager',  employees:[]},
  {id:12,type:'Sabbatical Leave',    yearly:90, monthly:null, carryForward:null,probation:false, prorate:false, status:'Inactive', assignBy:'Department',  assignValue:'Workforce',   employees:[]},
  {id:13,type:'Adoption Leave',      yearly:20, monthly:null, carryForward:null,probation:true,  prorate:false, status:'Active',   assignBy:'Branch',      assignValue:'Bangalore',   employees:['Pallavi P','Luis Martin']},
  {id:14,type:'Half Day Leave',      yearly:24, monthly:4,    carryForward:8,   probation:true,  prorate:true,  status:'Active',   assignBy:'Department',  assignValue:'Design',      employees:['Nora Kim']},
  {id:15,type:'Optional Holiday',    yearly:3,  monthly:1,    carryForward:null,probation:false, prorate:false, status:'Active',   assignBy:'Branch',      assignValue:'Chennai',     employees:['Anika Shah']},
  {id:16,type:'Work From Home Leave',yearly:20, monthly:5,    carryForward:null,probation:true,  prorate:true,  status:'Active',   assignBy:'Designation', assignValue:'Recruiter',   employees:['Rahul Mehta','Pallavi P']},
  {id:17,type:'Quarantine Leave',    yearly:14, monthly:null, carryForward:null,probation:true,  prorate:false, status:'Inactive', assignBy:'Department',  assignValue:'Operations',  employees:[]},
];
let leaveEditId=1;
const empPool=[
  {id:'EMP001',name:'Shaun J',key:'CLOCLO11755'},
  {id:'EMP002',name:'Pallavi P',key:'CLO0002'},
  {id:'EMP003',name:'Anika Shah',key:'CLO0003'},
  {id:'EMP004',name:'Rahul Mehta',key:'CLO0004'},
  {id:'EMP005',name:'Nora Kim',key:'CLO0005'},
  {id:'EMP006',name:'Luis Martin',key:'CLO0006'}
];
const empPoolExt={
  EMP001:{dept:'Workforce',desig:'HR Manager',branch:'Hyderabad'},
  EMP002:{dept:'HR',desig:'Recruiter',branch:'Hyderabad'},
  EMP003:{dept:'Engineering',desig:'Developer',branch:'Mumbai'},
  EMP004:{dept:'Product',desig:'Product Manager',branch:'Delhi'},
  EMP005:{dept:'Design',desig:'UX Designer',branch:'Hyderabad'},
  EMP006:{dept:'Sales',desig:'Sales Executive',branch:'Mumbai'}
};
const filterData={
  Department:['Engineering','Product','Finance','Sales','Design','Operations','HR','Workforce'],
  Designation:['Developer','Product Manager','Recruiter','UX Designer','HR Manager','Sales Executive'],
  Branch:['Hyderabad','Mumbai','Delhi','Bangalore','Chennai']
};
let selectedEmps=new Set();
let apFilterType='',apFilterValue='';
let lpSidebarPolicyId=null,lpSidebarTab='basic-details',lpSidebarEditMode=false,lpEmpEditMode=false;
let lpFilterField='',lpFilterStatus='',lpCurrentPage=1;
let listStatusFilters={},alStatusFilter='',pmInvoiceStatusFilter='';
let ctQuickStatusFilter='',atTsQuickFilter='',tkQuickStatusFilter='',chatQuickStatusFilter='';
const LP_PAGE_SIZE=10;
const lpLogsData={
  1:[
    {date:'22 Apr 2026',time:'05:44:07 PM',user:'Admin',status:'Active',action:'Policy reactivated after review'},
    {date:'01 Dec 2025',time:'10:32:19 AM',user:'Rahul M.',status:'Updated',action:'Yearly count updated to 24'},
    {date:'10 Nov 2025',time:'09:15:44 AM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  2:[
    {date:'05 Oct 2025',time:'11:28:08 AM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  3:[
    {date:'15 Nov 2025',time:'02:10:55 PM',user:'Anika S.',status:'Updated',action:'Carry forward limit updated to 15'},
    {date:'01 Sep 2025',time:'11:02:44 AM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  4:[
    {date:'10 Jan 2026',time:'03:45:32 PM',user:'Admin',status:'Inactive',action:'Status changed to Inactive ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â policy retired'},
    {date:'20 Aug 2025',time:'01:30:00 PM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  5:[
    {date:'15 Mar 2026',time:'10:10:00 AM',user:'Admin',status:'Active',action:'Policy activated for Engineering'},
    {date:'02 Jan 2026',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  6:[
    {date:'11 Feb 2026',time:'04:20:00 PM',user:'Shaun J',status:'Updated',action:'Eligible branches updated'},
    {date:'05 Dec 2025',time:'11:00:00 AM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  7:[{date:'20 Nov 2025',time:'02:00:00 PM',user:'Admin',status:'Created',action:'Policy created'}],
  8:[
    {date:'18 Apr 2026',time:'01:15:00 PM',user:'Rahul M.',status:'Updated',action:'Monthly limit revised to 3'},
    {date:'01 Jan 2026',time:'08:30:00 AM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  9:[{date:'22 Feb 2026',time:'03:45:00 PM',user:'Admin',status:'Created',action:'Policy created for Delhi branch'}],
  10:[{date:'10 Mar 2026',time:'09:20:00 AM',user:'Admin',status:'Created',action:'Policy created'}],
  11:[
    {date:'05 Apr 2026',time:'11:30:00 AM',user:'Admin',status:'Inactive',action:'Policy deactivated pending review'},
    {date:'14 Oct 2025',time:'10:00:00 AM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  12:[
    {date:'01 May 2026',time:'09:00:00 AM',user:'Admin',status:'Inactive',action:'Sabbatical policy suspended for this cycle'},
    {date:'30 Sep 2025',time:'03:00:00 PM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  13:[{date:'28 Jan 2026',time:'02:30:00 PM',user:'Admin',status:'Created',action:'Policy created for Bangalore branch'}],
  14:[
    {date:'12 Apr 2026',time:'10:45:00 AM',user:'Nora K.',status:'Updated',action:'Carry forward limit set to 8'},
    {date:'03 Nov 2025',time:'11:00:00 AM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  15:[{date:'07 Mar 2026',time:'08:00:00 AM',user:'Admin',status:'Created',action:'Optional holiday policy created for Chennai'}],
  16:[
    {date:'20 Apr 2026',time:'04:00:00 PM',user:'Pallavi P.',status:'Updated',action:'Monthly limit revised to 5'},
    {date:'15 Jan 2026',time:'10:30:00 AM',user:'Admin',status:'Created',action:'Policy created'}
  ],
  17:[
    {date:'01 Jun 2026',time:'01:00:00 PM',user:'Admin',status:'Inactive',action:'Policy deactivated ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no longer required'},
    {date:'20 Apr 2020',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Quarantine leave policy created during COVID period'}
  ]
};
const lpWorkflowData={
  1:[
    {title:'Policy Activated',user:'Admin',date:'22 Apr 2026',time:'05:44:07 PM',description:'Policy set to Active after review. Yearly count confirmed at 24 days.'},
    {title:'Approval Step Added',user:'Rahul M.',date:'01 Dec 2025',time:'10:32:19 AM',description:'Manager approval step added to the leave request workflow.'},
    {title:'Workflow Initialized',user:'Admin',date:'10 Nov 2025',time:'09:15:44 AM',description:'Default single-step workflow created for Casual Leave policy.'}
  ],
  2:[
    {title:'Workflow Initialized',user:'Admin',date:'05 Oct 2025',time:'11:28:08 AM',description:'HR approval workflow created for Sick Leave policy.'}
  ],
  3:[
    {title:'Final Approver Updated',user:'Anika S.',date:'15 Nov 2025',time:'02:10:55 PM',description:'HR Head added as final approver for escalated leave requests.'},
    {title:'Workflow Initialized',user:'Admin',date:'01 Sep 2025',time:'11:02:44 AM',description:'Two-step workflow created: Manager review followed by HR Head approval.'}
  ],
  4:[
    {title:'Workflow Suspended',user:'Admin',date:'10 Jan 2026',time:'03:45:32 PM',description:'Workflow suspended as Maternity Leave policy was set to Inactive status.'},
    {title:'Workflow Initialized',user:'Admin',date:'20 Aug 2025',time:'01:30:00 PM',description:'HR approval workflow created for Maternity Leave policy.'}
  ],
  5:[
    {title:'Workflow Initialized',user:'Admin',date:'02 Jan 2026',time:'09:00:00 AM',description:'Single-step Manager approval workflow created for Paternity Leave.'}
  ],
  6:[
    {title:'Approver Updated',user:'Shaun J',date:'11 Feb 2026',time:'04:20:00 PM',description:'HR Head set as approver for Bereavement Leave requests.'},
    {title:'Workflow Initialized',user:'Admin',date:'05 Dec 2025',time:'11:00:00 AM',description:'Workflow created for Bereavement Leave ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â auto-approve for up to 3 days.'}
  ],
  7:[{title:'Workflow Initialized',user:'Admin',date:'20 Nov 2025',time:'02:00:00 PM',description:'Single-step HR approval workflow created for Marriage Leave.'}],
  8:[
    {title:'Approval Rule Updated',user:'Rahul M.',date:'18 Apr 2026',time:'01:15:00 PM',description:'Monthly comp-off limit approval updated to require manager sign-off.'},
    {title:'Workflow Initialized',user:'Admin',date:'01 Jan 2026',time:'08:30:00 AM',description:'Two-step approval workflow created for Compensatory Leave.'}
  ],
  9:[{title:'Workflow Initialized',user:'Admin',date:'22 Feb 2026',time:'03:45:00 PM',description:'Manager approval workflow initialized for Privilege Leave ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Delhi branch.'}],
  10:[{title:'Workflow Initialized',user:'Admin',date:'10 Mar 2026',time:'09:20:00 AM',description:'Unpaid leave workflow created with mandatory HR approval for all requests.'}],
  11:[
    {title:'Workflow Paused',user:'Admin',date:'05 Apr 2026',time:'11:30:00 AM',description:'Workflow paused as Study Leave policy is under policy review.'},
    {title:'Workflow Initialized',user:'Admin',date:'14 Oct 2025',time:'10:00:00 AM',description:'Study Leave approval workflow initialized with L&D Head as approver.'}
  ],
  12:[
    {title:'Workflow Suspended',user:'Admin',date:'01 May 2026',time:'09:00:00 AM',description:'Sabbatical Leave workflow suspended for this financial year.'},
    {title:'Workflow Initialized',user:'Admin',date:'30 Sep 2025',time:'03:00:00 PM',description:'Long-leave workflow created requiring CEO approval for sabbatical requests.'}
  ],
  13:[{title:'Workflow Initialized',user:'Admin',date:'28 Jan 2026',time:'02:30:00 PM',description:'Adoption Leave workflow created ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â HR + Manager dual approval required.'}],
  14:[
    {title:'Step Updated',user:'Nora K.',date:'12 Apr 2026',time:'10:45:00 AM',description:'Half Day Leave workflow updated to allow self-approval for up to 2 instances/month.'},
    {title:'Workflow Initialized',user:'Admin',date:'03 Nov 2025',time:'11:00:00 AM',description:'Workflow initialized for Half Day Leave ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â single Manager approval.'}
  ],
  15:[{title:'Workflow Initialized',user:'Admin',date:'07 Mar 2026',time:'08:00:00 AM',description:'Optional Holiday workflow created ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â employee self-select with HR visibility.'}],
  16:[
    {title:'Approver Changed',user:'Pallavi P.',date:'20 Apr 2026',time:'04:00:00 PM',description:'Reporting Manager replaced HR as primary approver for WFH Leave requests.'},
    {title:'Workflow Initialized',user:'Admin',date:'15 Jan 2026',time:'10:30:00 AM',description:'Work From Home Leave workflow created with team-lead approval step.'}
  ],
  17:[
    {title:'Workflow Deactivated',user:'Admin',date:'01 Jun 2026',time:'01:00:00 PM',description:'Quarantine Leave workflow deactivated ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â policy retired post-COVID guidelines.'},
    {title:'Workflow Initialized',user:'Admin',date:'20 Apr 2020',time:'09:00:00 AM',description:'Emergency quarantine leave workflow created with auto-approval for first 7 days.'}
  ]
};
function yn(v){return '<option'+(v?' selected':'')+'>Yes</option><option'+(!v?' selected':'')+'>No</option>';}
function statusOpts(v){return '<option'+(v==='Active'?' selected':'')+'>Active</option><option'+(v==='Inactive'?' selected':'')+'>Inactive</option>';}
function apCS(id,opts,defVal,placeholder){
  const sel=opts.find(o=>o===defVal)||'';
  const isEmpty=!sel;
  const optStr=opts.map(o=>`<div class="cs-option${sel===o?' cs-selected':''}" onclick="csSelect(this,'${o}','${id}')"><span>${o}</span><svg class="cs-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>`).join('');
  return `<div class="cs-wrap" id="csw-${id}"><button type="button" class="cs-trigger${isEmpty?' cs-placeholder':''}" onclick="csToggle(this)" data-csid="${id}"><span class="cs-value">${sel||placeholder}</span><svg class="cs-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><div class="cs-dropdown" id="csd-${id}">${optStr}</div></div>`;
}
function csToggle(btn){
  document.querySelectorAll('.cs-dropdown.cs-open').forEach(d=>{if(d.id!==btn.dataset.csid+'__drop'){d.classList.remove('cs-open');const t=d.previousElementSibling;if(t)t.classList.remove('cs-open');}});
  const drop=document.getElementById('csd-'+btn.dataset.csid);if(!drop)return;
  const open=drop.classList.toggle('cs-open');btn.classList.toggle('cs-open',open);
}
function csSelect(opt,val,csid){
  const drop=document.getElementById('csd-'+csid);if(!drop)return;
  drop.querySelectorAll('.cs-option').forEach(o=>o.classList.remove('cs-selected'));
  opt.classList.add('cs-selected');
  const trigger=document.querySelector(`[data-csid="${csid}"]`);
  if(trigger){trigger.querySelector('.cs-value').textContent=val;trigger.classList.remove('cs-placeholder','cs-open');}
  drop.classList.remove('cs-open');
  if(csid==='ap-filter-type')setApFilterType(val);
  else if(csid==='ap-filter-value')apFilterValue=val;
  else if(csid==='lp-filter-field')lpFilterField=val;
  else if(csid==='lp-filter-status')lpFilterStatus=val;
  // -- Direct Employee status filter. Repaints immediately rather than waiting for the Search
  // button, matching how the other pill filters on this bar behave. --
  else if(csid==='de-f-status')setDeStatusFilter(val);
  // -- The Client source filter repaints on pick, same as de-f-status. Only the free-text box
  // waits for Search, which is what a search box next to a Search button is expected to do. --
  else if(csid==='md-f-source')setMdSourceFilter(val);
  else if(csid==='mr-f-journey')setMrFilter('journey',val);
  else if(csid==='mr-f-mode')setMrFilter('mode',val);
}
function markApFormDirty(){}
function cancelAddPolicy(){selectedEmps=new Set();apFilterType='';apFilterValue='';page='leave-policies';renderADTPage();}
function resetLpFilters(){lpFilterField='';lpFilterStatus='';lpCurrentPage=1;renderADTPage();}
function lpGoToPage(n){lpCurrentPage=n;renderADTPage();}
function addListingItem(pg){
  if(pg==='contracts'){
    // -- "Create Contract" always starts a fresh manual-step wizard under Contracts, even if this persona has an older in-progress deal — that in-progress deal stays reachable from Open Deals / My Tasks, it just doesn't hijack the create action. --
    // -- This is the canonical "Create Contract" action for the whole app: the topbar + on the
    // Contracts page, and the only route an Account Manager had into the journey. It now opens
    // the REBUILT journey (js/contract-journey.js). Since the rebuild finished all nine stages
    // the Contracts listing no longer offers a link to the original, so THIS LINE is the last
    // caller of openLegacyContractJourney — it is the fallback for contract-journey.js failing
    // to load, and dropping it would leave the create action doing nothing at all. --
    if(typeof ccjStartNewRun==='function'){ccjStartNewRun();return;}
    openLegacyContractJourney();
  }else if(pg==='teams'){page='team-add';renderADTPage();}else if(pg==='all-leaves'){page='leave-add';renderADTPage();}
}
// -- The original ai-contract-* journey, exactly as the create action used to start it. Kept
// whole: it is the reference the rebuild was measured against, and runner-harness.js still
// tests it. It is no longer offered as a choice on any surface — only addListingItem falls
// back to it — so do NOT delete it, and do NOT re-link it without being asked. --
function openLegacyContractJourney(){
  aiAssistedFlow=false;aiContractPrefill=null;aiCtAnimatedStage=-1;aiCtPendingEmpType='';aiCtTypeChoice='';aiCtJourneyEmployee=null;
  page=isJourneyAgentEnabled('contract-creation')?'ai-contract-assistant':'contract-type-select';
  renderADTPage();
}

// -- DIRECT EMPLOYEE PAGE --
const directEmpData=[
  {id:1,name:'Testemp Antar',empId:'EMP001',dept:'Engineering',branch:'Punjab',jobTitle:'Software Engineer',joinDate:'15 Jan 2025',desc:'Full time employee',contact:'+91 9999999996',email:'antar@testemp.com',status:'Active'},
  {id:2,name:'Pallavi Parate',empId:'EMP002',dept:'HR',branch:'Hyderabad',jobTitle:'HR Manager',joinDate:'20 Mar 2024',desc:'Full time employee',contact:'+91 8888888888',email:'pallavi@testemp.com',status:'Active'},
  {id:3,name:'Anika Shah',empId:'EMP003',dept:'Engineering',branch:'Mumbai',jobTitle:'Developer',joinDate:'05 Jun 2024',desc:'Contract employee',contact:'+91 7777777777',email:'anika@testemp.com',status:'Active'},
  {id:4,name:'Rahul Mehta',empId:'EMP004',dept:'Product',branch:'Delhi',jobTitle:'Product Manager',joinDate:'--',desc:'--',contact:'--',email:'rahul@testemp.com',status:'Inactive'},
];
// -- When a contract-creation run reaches Onboarding, the employee needs a real Direct Employee row for HR to work from — pulled from the linked contract, pinned to the top via onboardingRunId until HR marks the step complete. --
function ensureDirectEmpForOnboarding(run){
  if(directEmpData.some(function(e){return e.onboardingRunId===run.runId;}))return;
  const c=run.contractRecordId?contractsData.find(function(x){return x.id===run.contractRecordId;}):null;
  const nextId=directEmpData.reduce(function(m,e){return Math.max(m,e.id);},0)+1;
  directEmpData.unshift({
    id:nextId,name:run.subject,empId:'EMP0'+String(nextId).padStart(2,'0'),
    dept:(c&&c.jobTitle&&/java|engineer|developer/i.test(c.jobTitle))?'Engineering':'Operations',
    branch:(c&&c.countryOfOp)||'Hyderabad',jobTitle:(c&&c.jobTitle)||'—',joinDate:'--',
    desc:c?engagementModel(c.empType).personDesc:'New employee',contact:(c&&c.contact)||'--',email:(c&&c.email)||'--',
    status:'Active',onboardingRunId:run.runId
  });
}
// -- Appends a deLogsData entry only if an identical {status,action} pair isn't already present for this employee, so re-rendering the same H2R stage screen never duplicates a log line. Newest entry goes first (unshift), matching the existing seed data's ordering. --
function appendDeLogOnce(empRowId,statusLabel,actionText,actorUser){
  const logs=deLogsData[empRowId]=deLogsData[empRowId]||[];
  if(logs.some(function(l){return l.status===statusLabel&&l.action===actionText;}))return;
  const now=new Date();
  logs.unshift({
    date:now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),
    time:now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}),
    user:actorUser||'AI Executive',status:statusLabel,action:actionText
  });
}
// -- CLIENT (Executive Layer's own store) --
// Records the Executive Layer has ingested from connected systems. Deliberately separate from
// directEmpData: Direct Employee, Teams, Leaves and everything below them in the sidebar belong
// to the connected SaaS product this app mirrors, and are mock data. Client is ours, and
// is backed by the real backend. (Internal ids still read `master-data`/`masterData` — the page
// id is wired through routing, RBAC and the backend, so only the label changed.)
//
// Deliberately NOT persisted to localStorage, unlike every other array in this file. These three
// are a cache of server state, and a cached copy that outlives the server's copy is worse than
// no cache at all: clearing backend/data left the UI listing records the backend had never heard
// of, which then failed "Employee not found" on every write. Rebuilt from the backend on load
// (mdRefreshFromBackend) so what is on screen is always something the backend can act on.
const masterData=[];
const mdLogsData={},mdWorkflowData={};
let mdSelectedId=null,mdTab='basic-details',mdStatusFilter='';
// -- Client listing filters. Status is deliberately NOT among them: it is owned by the stat tiles,
// which carry live counts and so say strictly more than an "All Statuses" dropdown could. Source
// is the one dimension left worth a dropdown — which system sent the record — and mdSearchQuery
// matches name, both ids (ours and the source system's), company and email in one box. Empty
// string means "no filter on this dimension". --
let mdFilterSource='',mdSearchQuery='';
// 'loading' until the first fetch settles, then 'ok' or 'offline'. Lets the empty listing say
// which kind of empty it is instead of implying nothing has ever been ingested.
let mdBackendState='loading';
// Save-in-flight state for the Logs tab's status form: mdSaveState is null | 'saving' | 'done',
// mdSaveStep indexes the progress list, mdSaveDraft holds what was typed so a failed write can
// restore the form untouched, and mdLogEnter flags the newly written entry for its enter animation.
let mdSaveState=null,mdSaveStep=-1,mdSaveDraft=null,mdSaveError='',mdLogEnter=false;

// -- Mirrors one backend row into masterData, replacing its logs and workflow with the
// backend's. The backend is the source of truth for identity, status, logs and workflow; this
// list is only a render cache, so a matched row is overwritten wholesale rather than merged. --
function syncEmpFromBackend(row,logs,workflow){
  const existing=masterData.find(function(e){return e.empId===row.employee_code;});
  const localId=existing?existing.id:masterData.reduce(function(m,e){return Math.max(m,e.id);},0)+1;
  const mapped=execApiToDirectEmpRow(row,localId);
  if(existing)Object.assign(existing,mapped);
  else masterData.unshift(mapped);
  if(logs)mdLogsData[localId]=execApiToLogRows(logs);
  if(workflow)mdWorkflowData[localId]=execApiToWorkflowRows(workflow);
  persistAppState();
  return localId;
}
function manualLinkedRunForEmployee(empId){
  const emp=directEmpData.find(function(e){return e.id===empId;});
  if(!emp||!emp.onboardingRunId)return null;
  const run=getManualRun(emp.onboardingRunId);
  if(!run||run.status==='Completed')return null;
  const curStep=manualJourneySteps(run.journeyId)[run.currentStepIdx];
  return (curStep&&curStep.name==='Onboarding')?run:null;
}
// -- PAYROLL PAGE (per-employee readiness, separate from the generic payroll-cycle listing) --
const payrollEmpData=[
  {id:1,name:'Testemp Antar',empId:'EMP001',country:'India',jobTitle:'Software Engineer',payFrequency:'Monthly',currency:'INR',grossPay:'100000',bankStatus:'Verified',taxIdStatus:'Verified',status:'Active'},
  {id:2,name:'Anika Shah',empId:'EMP003',country:'Netherlands',jobTitle:'Developer',payFrequency:'Monthly',currency:'EUR',grossPay:'6200',bankStatus:'Verified',taxIdStatus:'Verified',status:'Active'}
];
const prLogsData={},prWorkflowData={};
let prSelectedId=null,prTab='basic-details';
// -- The "action needed" tab badge/banner should only appear when this sidebar was opened by following a journey/task link (dashboard queue, My Tasks, notification) — not on a plain row-open. Set only by those launchers, cleared on close. --
let prJourneyContextRunId=null;
// -- When a contract-creation run reaches Payroll Readiness (the final step), the employee needs a real Payroll row for HR to validate bank/tax/compensation — pulled from the linked contract, pinned to the top via readinessRunId until HR marks the step complete. --
function ensurePayrollEmpForReadiness(run){
  if(payrollEmpData.some(function(e){return e.readinessRunId===run.runId;}))return;
  const c=run.contractRecordId?contractsData.find(function(x){return x.id===run.contractRecordId;}):null;
  const nextId=payrollEmpData.reduce(function(m,e){return Math.max(m,e.id);},0)+1;
  payrollEmpData.unshift({
    id:nextId,name:run.subject,empId:'EMP0'+String(nextId).padStart(2,'0'),
    country:(c&&c.countryOfOp)||'—',jobTitle:(c&&c.jobTitle)||'—',
    payFrequency:(c&&c.payFrequency)||'Monthly',currency:(c&&c.currency)||'—',grossPay:(c&&c.payAmount)||'—',
    bankStatus:'Pending',taxIdStatus:'Pending',status:'Pending',readinessRunId:run.runId
  });
}
function manualLinkedRunForPayrollEmp(empId){
  const emp=payrollEmpData.find(function(e){return e.id===empId;});
  if(!emp||!emp.readinessRunId)return null;
  const run=getManualRun(emp.readinessRunId);
  if(!run||run.status==='Completed')return null;
  const curStep=manualJourneySteps(run.journeyId)[run.currentStepIdx];
  return (curStep&&curStep.name==='Payroll Readiness')?run:null;
}
const deLogsData={
  1:[
    {date:'10 Jun 2025',time:'03:30:00 PM',user:'Admin',status:'Updated',action:'Job title updated to Software Engineer'},
    {date:'15 Jan 2025',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Employee profile created'}
  ],
  2:[
    {date:'01 Jun 2025',time:'02:00:00 PM',user:'Pallavi P.',status:'Updated',action:'Department changed to HR'},
    {date:'20 Mar 2024',time:'10:15:00 AM',user:'Admin',status:'Created',action:'Employee profile created'}
  ],
  3:[
    {date:'05 Jun 2024',time:'11:30:00 AM',user:'Admin',status:'Created',action:'Employee profile created'}
  ],
  4:[
    {date:'12 Feb 2025',time:'02:00:00 PM',user:'Admin',status:'Inactive',action:'Employee status set to Inactive'},
    {date:'01 Feb 2024',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Employee profile created'}
  ]
};
const deWorkflowData={
  1:[
    {title:'Onboarding Complete',user:'HR',date:'15 Jan 2025',time:'09:00:00 AM',description:'Employee onboarding checklist completed and access provisioned.'},
    {title:'Background Verification Cleared',user:'Admin',date:'10 Jan 2025',time:'03:00:00 PM',description:'Background verification cleared. Employee cleared for joining.'}
  ],
  2:[
    {title:'Onboarding Complete',user:'Admin',date:'20 Mar 2024',time:'10:15:00 AM',description:'HR Manager onboarding completed. Access to HR systems granted.'}
  ],
  3:[
    {title:'Contract Signed',user:'HR',date:'05 Jun 2024',time:'11:30:00 AM',description:'Contract signed by employee. Contract type: Fixed term.'}
  ],
  4:[
    {title:'Exit Initiated',user:'Admin',date:'12 Feb 2025',time:'02:00:00 PM',description:'Offboarding workflow initiated. Final settlement pending review.'},
    {title:'Onboarding Complete',user:'Admin',date:'01 Feb 2024',time:'09:00:00 AM',description:'Employee onboarded. Role: Product Manager.'}
  ]
};
let deSelectedId=null,deTab='basic-details',deStatusFilter='';
const globalEmpData=[
  {id:1,name:'Emma Schmidt',empId:'GEP001',dept:'Engineering',country:'Germany',jobTitle:'Senior Developer',workerType:'EOR',joinDate:'10 Feb 2024',desc:'Full time employee',contact:'+49 152 0000 0001',email:'emma@testemp.com',status:'Active'},
  {id:2,name:'Lucas Dubois',empId:'GEP002',dept:'Finance',country:'France',jobTitle:'Finance Analyst',workerType:'EOR',joinDate:'15 Apr 2024',desc:'Full time employee',contact:'+33 6 12 34 56 78',email:'lucas@testemp.com',status:'Active'},
  {id:3,name:'Sofia Romano',empId:'GEP003',dept:'HR',country:'Italy',jobTitle:'HR Specialist',workerType:'Contractor',joinDate:'01 Mar 2024',desc:'Contract employee',contact:'+39 347 000 0001',email:'sofia@testemp.com',status:'Active'},
  {id:4,name:'James Wilson',empId:'GEP004',dept:'Operations',country:'United Kingdom',jobTitle:'Ops Manager',workerType:'EOR',joinDate:'--',desc:'--',contact:'+44 7000 000001',email:'james@testemp.com',status:'Inactive'},
];
let geStatusFilter='';
const geLogsData={
  1:[
    {date:'14 May 2025',time:'11:00:00 AM',user:'Admin',status:'Updated',action:'Job title updated to Senior Developer'},
    {date:'10 Feb 2024',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Employee profile created'}
  ],
  2:[
    {date:'15 Apr 2024',time:'10:30:00 AM',user:'Admin',status:'Created',action:'Employee profile created'}
  ],
  3:[
    {date:'20 Nov 2024',time:'02:15:00 PM',user:'Admin',status:'Updated',action:'Contract renewed for 12 months'},
    {date:'01 Mar 2024',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Employee profile created'}
  ],
  4:[
    {date:'05 Jan 2025',time:'03:00:00 PM',user:'Admin',status:'Inactive',action:'Employee status set to Inactive — contract ended'},
    {date:'01 Feb 2024',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Employee profile created'}
  ]
};
const geWorkflowData={
  1:[
    {title:'Onboarding Complete',user:'HR',date:'10 Feb 2024',time:'09:00:00 AM',description:'EOR onboarding via Dhi completed. Access provisioned for Germany entity.'},
    {title:'Contract Signed',user:'Admin',date:'05 Feb 2024',time:'04:00:00 PM',description:'EOR employment contract signed by employee and Dhi.'}
  ],
  2:[
    {title:'Onboarding Complete',user:'Admin',date:'15 Apr 2024',time:'10:30:00 AM',description:'EOR onboarding complete. France entity payroll activated.'}
  ],
  3:[
    {title:'Contract Renewed',user:'HR',date:'20 Nov 2024',time:'02:15:00 PM',description:'Contractor agreement renewed for 12 months.'},
    {title:'Contract Signed',user:'Admin',date:'01 Mar 2024',time:'09:00:00 AM',description:'Initial contractor agreement signed.'}
  ],
  4:[
    {title:'Offboarding Initiated',user:'Admin',date:'05 Jan 2025',time:'03:00:00 PM',description:'Offboarding workflow started. Final settlement and access revocation pending.'},
    {title:'Onboarding Complete',user:'Admin',date:'01 Feb 2024',time:'09:00:00 AM',description:'EOR onboarding complete. UK entity payroll activated.'}
  ]
};
let geSelectedId=null,geTab='basic-details';
const teamsData=[
  {id:1,teamId:'2881',name:'Core Payroll',dept:'Finance',country:'Netherlands',members:18,email:'corepayroll@testemp.com',createdBy:'Admin',joinDate:'From: 01 Jan 2025',status:'Active',
   membersList:[{name:'Emma Schmidt',role:'Reporting Manager',desig:'Finance Head'},{name:'Lucas Dubois',role:'Member',desig:'Payroll Analyst'},{name:'Sofia Romano',role:'Member',desig:'--'}]},
  {id:2,teamId:'2882',name:'People Ops',dept:'HR',country:'India',members:12,email:'peopleops@testemp.com',createdBy:'Pallavi Parate',joinDate:'From: 15 Feb 2025',status:'Active',
   membersList:[{name:'Pallavi Parate',role:'Reporting Manager',desig:'HR Manager'},{name:'Anika Shah',role:'Member',desig:'HR Specialist'}]},
  {id:3,teamId:'2883',name:'Compliance Desk',dept:'Legal',country:'Germany',members:7,email:'compliance@testemp.com',createdBy:'Tarak Swain',joinDate:'From: 01 Mar 2025',status:'Active',
   membersList:[{name:'James Wilson',role:'Reporting Manager',desig:'Legal Head'},{name:'Emma Schmidt',role:'Member',desig:'Compliance Analyst'}]},
  {id:4,teamId:'2884',name:'Entity Setup',dept:'Operations',country:'Spain',members:9,email:'entitysetup@testemp.com',createdBy:'Admin',joinDate:'From: 10 Apr 2025',status:'Pending',
   membersList:[{name:'Rahul Mehta',role:'Reporting Manager',desig:'Ops Manager'}]},
  {id:5,teamId:'2885',name:'Customer Success',dept:'Support',country:'United Kingdom',members:21,email:'customersuccess@testemp.com',createdBy:'Admin',joinDate:'From: 01 May 2025',status:'Active',
   membersList:[{name:'Nora Kim',role:'Reporting Manager',desig:'CS Lead'},{name:'Luis Martin',role:'Member',desig:'CS Specialist'},{name:'Testemp Antar',role:'Member',desig:'--'}]},
  {id:6,teamId:'2886',name:'Local Admin',dept:'Admin',country:'Netherlands',members:4,email:'localadmin@testemp.com',createdBy:'Admin',joinDate:'From: 01 Jun 2025',status:'Inactive',
   membersList:[]}
];
const tmLogsData={
  1:[{date:'10 Jun 2025',time:'11:00:00 AM',user:'Admin',status:'Updated',action:'Team members updated. Count changed to 18.'},{date:'01 Jan 2025',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Team Core Payroll created.'}],
  2:[{date:'15 Feb 2025',time:'10:00:00 AM',user:'Admin',status:'Created',action:'Team People Ops created.'}],
  3:[{date:'01 Mar 2025',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Team Compliance Desk created.'}],
  4:[{date:'10 Apr 2025',time:'02:00:00 PM',user:'Admin',status:'Updated',action:'Team status set to Pending — approval awaited.'},{date:'10 Apr 2025',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Team Entity Setup created.'}],
  5:[{date:'20 May 2025',time:'03:00:00 PM',user:'Admin',status:'Updated',action:'New members added to Customer Success team.'},{date:'01 May 2025',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Team Customer Success created.'}],
  6:[{date:'15 Jul 2025',time:'04:00:00 PM',user:'Admin',status:'Inactive',action:'Team status changed to Inactive.'},{date:'01 Jun 2025',time:'09:00:00 AM',user:'Admin',status:'Created',action:'Team Local Admin created.'}]
};
const tmWorkflowData={
  1:[{title:'Team Activated',user:'Admin',date:'01 Jan 2025',time:'09:00:00 AM',description:'Team setup complete. Finance payroll team activated with 18 members.'},{title:'Members Assigned',user:'Admin',date:'01 Jan 2025',time:'10:00:00 AM',description:'Initial member assignment completed for Core Payroll team.'}],
  2:[{title:'Team Activated',user:'Admin',date:'15 Feb 2025',time:'10:00:00 AM',description:'People Ops team set up. HR workflows initialised.'}],
  3:[{title:'Team Activated',user:'Tarak Swain',date:'01 Mar 2025',time:'09:00:00 AM',description:'Compliance Desk team activated for Germany entity.'}],
  4:[{title:'Approval Pending',user:'Admin',date:'10 Apr 2025',time:'02:00:00 PM',description:'Entity Setup team pending approval from regional head.'},{title:'Team Created',user:'Admin',date:'10 Apr 2025',time:'09:00:00 AM',description:'Entity Setup team created and submitted for approval.'}],
  5:[{title:'Team Activated',user:'Admin',date:'01 May 2025',time:'09:00:00 AM',description:'Customer Success team activated for UK entity.'}],
  6:[{title:'Team Deactivated',user:'Admin',date:'15 Jul 2025',time:'04:00:00 PM',description:'Local Admin team deactivated. Members reassigned.'},{title:'Team Activated',user:'Admin',date:'01 Jun 2025',time:'09:00:00 AM',description:'Local Admin team created for Netherlands entity.'}]
};
let tmSelectedId=null,tmTab='basic-details';
const ctFlow=['Submitted','Quotation Approved','Proposal Sent','Proposal Approved','Contract Sent','Contract Signed','Contract Approved','Onboarding','Ready for Payroll'];
const contractsData=[
  {id:1,contractId:'94135',empName:'TestEmp Antar',empDesig:'Business Analyst',country:'Netherlands',type:'EOR',date:'2026-06-11 15:17:26',status:'Submitted',
   nationality:'India',countryOfOp:'Netherlands',workPermit:false,gender:'MALE',email:'antar@testemp.com',contact:'+91 9999999996',dob:'2010-01-01',jobTitle:'Business Analyst',skill:'JIRA',empDuration:'2026-06-11 – 2026-12-15',empType:'EOR',workSchedule:'7',payAmount:'100000',currency:'INR',jobDesc:'job desc',payFrequency:'Monthly',
   commercial:{adtFee:'549',annualGross:'0.05',baseGross:'0.07',holidayBonus:'0.07',month13:'0.07',monthlyGrossNet:'0.02',monthlyInvoice:'0.03',monthlySalary12:'0.06',monthlySalary1392:'0.07',netPay:'0.13',socialPremAmt:'0.06',socialPremPct:'26.02',totalMonthlyGross:'0.06'},
   complianceItems:[{item:'EOR NL Proposal',note:'Optional',status:'Pending',doc:null}]},
  {id:2,contractId:'94134',empName:'Rashi Singh',empDesig:'java',country:'Netherlands',type:'EOR',date:'2026-06-06 15:05:48',status:'Proposal Sent',
   nationality:'India',countryOfOp:'Netherlands',workPermit:false,gender:'FEMALE',email:'rashi@testemp.com',contact:'+91 8888888888',dob:'1995-03-15',jobTitle:'Java Developer',skill:'Java, Spring Boot',empDuration:'2026-06-06 – 2026-12-06',empType:'EOR',workSchedule:'8',payAmount:'85000',currency:'INR',jobDesc:'Java backend development',payFrequency:'Monthly',
   commercial:{adtFee:'549',annualGross:'0.04',baseGross:'0.06',holidayBonus:'0.06',month13:'0.06',monthlyGrossNet:'0.02',monthlyInvoice:'0.02',monthlySalary12:'0.05',monthlySalary1392:'0.06',netPay:'0.10',socialPremAmt:'0.05',socialPremPct:'26.02',totalMonthlyGross:'0.05'},
   complianceItems:[{item:'EOR NL Proposal',note:'Optional',status:'Pending',doc:null}]},
  {id:3,contractId:'94133',empName:'Deepak Singh',empDesig:'java',country:'Netherlands',type:'EOR',date:'2026-06-06 14:07:35',status:'Inactive',
   nationality:'India',countryOfOp:'Netherlands',workPermit:false,gender:'MALE',email:'deepak@testemp.com',contact:'+91 7777777777',dob:'1993-07-22',jobTitle:'Java Developer',skill:'Java',empDuration:'2026-06-06 – 2026-12-06',empType:'EOR',workSchedule:'8',payAmount:'78000',currency:'INR',jobDesc:'Java development',payFrequency:'Monthly',
   commercial:{adtFee:'549',annualGross:'0.04',baseGross:'0.05',holidayBonus:'0.05',month13:'0.05',monthlyGrossNet:'0.01',monthlyInvoice:'0.02',monthlySalary12:'0.04',monthlySalary1392:'0.05',netPay:'0.09',socialPremAmt:'0.04',socialPremPct:'26.02',totalMonthlyGross:'0.04'},
   complianceItems:[{item:'EOR NL Proposal',note:'Optional',status:'Inactive',doc:null}]},
  {id:4,contractId:'94132',empName:'Rajdeep Singh',empDesig:'java developer',country:'Netherlands',type:'EOR',date:'2026-06-06 12:34:17',status:'Proposal Sent',
   nationality:'India',countryOfOp:'Netherlands',workPermit:false,gender:'MALE',email:'rajdeep@testemp.com',contact:'+91 6666666666',dob:'1990-11-10',jobTitle:'Java Developer',skill:'Java, Microservices',empDuration:'2026-06-06 – 2026-12-06',empType:'EOR',workSchedule:'8',payAmount:'90000',currency:'INR',jobDesc:'java developer',payFrequency:'Monthly',
   commercial:{adtFee:'549',annualGross:'0.05',baseGross:'0.06',holidayBonus:'0.06',month13:'0.06',monthlyGrossNet:'0.02',monthlyInvoice:'0.02',monthlySalary12:'0.05',monthlySalary1392:'0.06',netPay:'0.11',socialPremAmt:'0.05',socialPremPct:'26.02',totalMonthlyGross:'0.05'},
   complianceItems:[{item:'EOR NL Proposal',note:'Optional',status:'Pending',doc:null}]},
  {id:5,contractId:'94236',empName:'Lucas Dubois',empDesig:'Finance Analyst',country:'France',type:'EOR',date:'2026-07-20 09:30:00',status:'Submitted',
   nationality:'French',countryOfOp:'',workPermit:false,gender:'MALE',email:'lucas@testemp.com',contact:'+33 6 12 34 56 78',dob:'1990-04-15',jobTitle:'Finance Analyst',skill:'Financial Reporting',empDuration:'2026-07-20 – 2027-07-20',empType:'EOR',workSchedule:'8',payAmount:'52000',currency:'EUR',jobDesc:'Finance analyst role',payFrequency:'Monthly',
   commercial:{adtFee:'549',annualGross:'0.05',baseGross:'0.06',holidayBonus:'0.06',month13:'0.06',monthlyGrossNet:'0.02',monthlyInvoice:'0.03',monthlySalary12:'0.05',monthlySalary1392:'0.06',netPay:'0.11',socialPremAmt:'0.05',socialPremPct:'26.02',totalMonthlyGross:'0.05'},
   complianceItems:[{item:'Country Configuration — France',note:'Compliance Hub could not return statutory requirements for France.',status:'Missing',doc:null}],
   missingCountryConfig:true,manualRunId:'RUN-4002'}
];
const ctLogsData={
  1:[{date:'2026-06-11',time:'15:17:26',user:'Admin',status:'Submitted',action:'Contract submitted for review and quotation.'}],
  2:[{date:'2026-07-05',time:'11:40:00',user:'Entity User',status:'Second Opinion Requested',action:'Not sure about the margin on this one — can you take a look before I approve?'},{date:'2026-06-06',time:'15:05:48',user:'Admin',status:'Proposal Sent',action:'EOR proposal sent to employee for review.'},{date:'2026-06-06',time:'14:00:00',user:'Manager',status:'Quotation Approved',action:'Quotation approved by manager. Proceeding to proposal.'},{date:'2026-06-06',time:'13:00:00',user:'Admin',status:'Submitted',action:'Contract submitted for review.'}],
  3:[{date:'2026-06-06',time:'14:07:35',user:'Admin',status:'Inactive',action:'Contract set to Inactive.'}],
  4:[{date:'2026-06-06',time:'12:34:17',user:'Admin',status:'Proposal Sent',action:'EOR proposal sent to employee.'},{date:'2026-06-06',time:'11:00:00',user:'Admin',status:'Submitted',action:'Contract submitted for review.'}],
  5:[{date:'2026-07-20',time:'09:30:00',user:'AI Agent',status:'Submitted',action:'Contract submitted; Compliance Hub could not return statutory requirements for France — missing country configuration.'}]
};
const ctWorkflowData={
  1:[{title:'Contract Submitted',user:'Admin',date:'2026-06-11',time:'15:17:26',description:'EOR contract for TestEmp Antar submitted for quotation and review.'}],
  2:[{title:'Second Opinion Requested',user:'Entity User',date:'2026-07-05',time:'11:40:00',description:'Entity User flagged the proposal margin for a second opinion before approving.'},{title:'Proposal Sent',user:'Admin',date:'2026-06-06',time:'15:05:48',description:'EOR proposal dispatched to Rashi Singh for review and acceptance.'},{title:'Quotation Approved',user:'Manager',date:'2026-06-06',time:'14:00:00',description:'Quotation approved. Proposal stage initiated.'},{title:'Contract Submitted',user:'Admin',date:'2026-06-06',time:'13:00:00',description:'EOR contract submitted for review.'}],
  3:[{title:'Contract Inactive',user:'Admin',date:'2026-06-06',time:'14:07:35',description:'Contract for Deepak Singh set to Inactive.'}],
  4:[{title:'Proposal Sent',user:'Admin',date:'2026-06-06',time:'12:34:17',description:'EOR proposal sent to Rajdeep Singh.'},{title:'Contract Submitted',user:'Admin',date:'2026-06-06',time:'11:00:00',description:'EOR contract submitted for review.'}],
  5:[{title:'Compliance Exception Raised',user:'AI Agent',date:'2026-07-20',time:'09:30:00',description:'Compliance Hub could not return statutory requirements for France — missing country configuration.'}]
};
let ctSelectedId=null,ctTab='basic-details',ctCommercialEditMode=false;
// -- Same journey-context gate as prJourneyContextRunId, for the Contracts sidebar. --
let ctJourneyContextRunId=null;

// -- AI EXECUTIVE MODULE --
const aiJourneys=[
  // -- Sits first because it is first in the real sequence: a client's master record has to exist
  // before a deal can be raised against it. Its entry action is Create Client (the NewForce intake
  // form), the same action the sidebar's Client > Create Client opens. --
  // -- Three steps, no agents, because that is what Create Client actually does: fill the intake
  // form, submit it to NewForce, ingest the registered submission back as a client record
  // (cfgUserIntakeStages, js/pages.js). It used to claim four steps and three AI agents — a
  // matcher, a compliance sync and a publisher — none of which exist anywhere in the build. The
  // one journey wired to a real backend is the one that should not be describing imaginary work. --
  {id:'user-master-data',name:'User Master Data Creation Journey',category:'O2C',desc:'Captures a new client on the NewForce intake form, submits it to NewForce, and ingests the registered submission back as a client record.',modules:['Client','Master Data','NewForce Solutions'],coverage:0,humanSteps:3,aiSteps:0,status:'Active',risk:'Low',updated:'29 Jul 2026, 9:45 AM',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3"/><path d="M20 5.5v6"/><path d="M4 12c0 1.7 3.6 3 8 3"/><path d="M18 15v6M15 18h6"/></svg>'},
  {id:'contract-creation',name:'Hire and Onboard Journey',category:'H2R',desc:'Takes a client request from quote and client contract through the deposit, the employment contract, onboarding, and on to payroll.',modules:['Deal Desk','Employee Profile','Proposal','Contracts','Onboarding','Payroll'],coverage:72,humanSteps:2,aiSteps:5,status:'Active',risk:'Medium',updated:'02 Jul 2026, 10:20 AM',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>'},
  {id:'payroll-creation',name:'Payroll Creation Journey',category:'H2R',desc:'Automates payroll runs end-to-end from a prompt through attendance capture, salary calculation, approval, and salary slip creation.',modules:['Payroll','Timesheet','Payheads','Compliance Hub','Finance'],coverage:83,humanSteps:1,aiSteps:5,status:'Active',risk:'Medium',updated:'03 Jul 2026, 4:30 PM',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.6"/></svg>'},
  {id:'h2r-lifecycle',name:'Hire to Retire (H2R) Journey',category:'H2R',desc:'Automates the full employee lifecycle from creation through country-specific compliance and leave policy setup to eventual offboarding.',modules:['Employee Profile','Compliance Hub','Leave','Onboarding'],coverage:65,humanSteps:1,aiSteps:4,status:'Active',risk:'Medium',updated:'28 Jun 2026, 11:00 AM',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>'},
  // -- Two human stages (the role choice and the signup) and three the agents run: KYC, the
  // creation itself, and the confirmation. Coverage is the honest fraction of that. --
  {id:'bhaiyaa-store-creation',name:'Bhaiyaa Store Creation Journey',category:'O2C',desc:'Opens a Bhaiyaa store end to end — the merchant signup, Aadhaar KYC run by the agent, then registration on Bhaiyaa and provisioning.',modules:['Stores','Bhaiyaa','Compliance Hub'],coverage:75,humanSteps:1,aiSteps:3,status:'Active',risk:'Low',updated:'31 Jul 2026, 12:10 PM',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9.5 4.8 4h14.4L21 9.5"/><path d="M3 9.5h18a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 11.8V20h14v-8.2"/><path d="M10 20v-4.5h4V20"/></svg>'},
  /* -- FR4: the Sub-Contracting Journey on the launcher as well as in Configure. It reaches this
     list explicitly rather than through the lockedRoadmapJourneys concat in
     buildAIExecutiveDashboardHTML, because that concat is for journeys marked `locked` — and
     locking this one would have blocked the Configure detail screen FR4.2 asks for.

     `status:'Draft'`, which is the honest state and not a placeholder. Draft means, in this
     product's own vocabulary, that automation setup is not finished — and it is not: eighteen
     steps are defined, four of them are machine work, and no run mechanics exist behind any of
     them. Marking it Active would put a "View Active Automation" button on the card that opens a
     run flow with nothing behind it; Draft renders the timeline and says what is missing.

     coverage 22 is 4 of 18, not a target. -- */
  {id:'sub-contracting',name:'Sub-Contracting Journey',category:'P2P',desc:'Runs a sub-contracting transaction end to end — the request and its approval, the commercial PO, the outbound shipment on a delivery challan, the vendor return, and reconciliation to closure.',modules:['Material','Vendor','Project & Production','Inventory & Storage','Logistics & Dispatch'],coverage:22,humanSteps:14,aiSteps:4,status:'Draft',risk:'Medium',updated:'08 Sep 2026, 10:15 AM',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5"/><path d="M12 12v9"/></svg>'}
];

const aiJourneyEvents={
  /* == SUB-CONTRACTING: THE EIGHTEEN EVENTS ===============================================
     Third of the three lists that must stay eighteen long — see the note on the cfgJourneys
     entry. This one is what stops the journey detail page rendering as a shell: the stat grid
     (Total Events / AI Automated / Human Required) and the Responsibility Split band are both
     computed from these `chips`, and with no entry here they read 0 and 0 above an empty band
     on a journey that plainly has eighteen steps.

     FOUR AI, FOURTEEN PEOPLE, and the split is not flattering by accident. Only the four events
     that are genuinely machine work carry 'AI Automated' — the BOM explosion, the delivery note,
     the challan and the reconciliation. Everything else on this journey is somebody physically
     moving, checking or signing for material, and a chip claiming otherwise would show up as a
     coverage figure nobody can deliver.

     Event 9 carries BOTH 'AI Automated' and 'Approval Required', which is why the two counts sum
     to nineteen rather than eighteen. That is correct: the note is generated by the system and
     released by a person, and dropping either chip would misreport which half is automated.

     'Client Action' on the vendor ASN is the existing vocabulary for a step waiting on a party
     outside the organisation — the same chip the contract journey uses for client signature.
     It counts as human work, which it is; it is simply not OUR human. == */
  'sub-contracting':[
    {name:'Create Sub-Contracting Request (SCR)',chips:['Human Required','SAP S/4HANA'],source:'Planner',waitingOn:'Planner',
     desc:'The planner raises a sub-contracting request against a production order — material, quantity, vendor and required-by date.',
     validation:'Production order, material, quantity and vendor are mandatory. The material must exist on the order BOM.',
     human:'Required — the planner raises the request.',
     failure:'The request cannot be submitted until the mandatory fields resolve against the order.'},
    {name:'SCR Approval / Return / Reject',chips:['Approval Required','SAP S/4HANA'],source:'PMG Approver',waitingOn:'PMG Approver',
     desc:'The PMG approver reviews the request and approves it, returns it for correction, or rejects it outright.',
     validation:'An approval decision is mandatory. A return or a reject requires a reason code.',
     human:'Required — this is an approval gate and cannot be delegated to an agent.',
     failure:'A returned SCR goes back to the planner at step 1 with the reason attached.'},
    {name:'Receivable Product / WIP & BOM Processing',chips:['Human Required','SAP S/4HANA'],source:'Planner / System',waitingOn:'Planner',
     desc:'The BOM is exploded to resolve what is issued to the vendor and what comes back, and the WIP quantities are staged.',
     validation:'Every component on the BOM must carry a quantity and a unit of measure.',
     human:'Required — no agent is configured for this step, so the planner drives it against the source system.',
     failure:'An incomplete BOM halts the journey and is raised as an exception to the planner.'},
    {name:'Create & Complete Sub-Contracting PO',chips:['Human Required','SAP S/4HANA'],source:'Buyer',waitingOn:'Buyer',
     desc:'The buyer raises the sub-contracting purchase order from the approved request and completes its commercial terms.',
     validation:'Price, currency, tax code and payment terms are mandatory and are checked against the rate contract.',
     human:'Required — the buyer owns the commercial terms.',
     failure:'Terms that fall outside the rate contract are flagged before the PO can be completed.'},
    {name:'Approve / Return Commercial PO',chips:['Approval Required','SAP S/4HANA'],source:'PO / PMG Approver',waitingOn:'PO / PMG Approver',
     desc:'The approver checks price, tax and payment terms against the rate contract and approves or returns the PO.',
     validation:'An approval decision is mandatory. A return requires a reason code.',
     human:'Required — this is an approval gate.',
     failure:'A returned PO goes back to the buyer at step 4.'},
    {name:'Create Shipment & Reserve Material',chips:['Human Required','SAP S/4HANA'],source:'Planner',waitingOn:'Planner',
     desc:'A shipment is created against the approved PO and the issue material is reserved out of available stock.',
     validation:'Reserved quantity cannot exceed unrestricted stock at the issuing storage location.',
     human:'Required — the planner commits the stock.',
     failure:'Insufficient stock is raised as an exception rather than reserving a short quantity.'},
    {name:'Stores Outbound / Goods Issue',chips:['Human Required','SAP S/4HANA'],source:'Stores User',waitingOn:'Stores User',
     desc:'Stores pick the reserved material and post the goods issue out of the storage location.',
     validation:'Reserved quantity must equal the shipment quantity; goods issue is blocked when it is short.',
     human:'Required — stores physically pick and issue the material.',
     failure:'A quantity mismatch is held for the planner rather than posted.'},
    {name:'Shipment Processing & Logistics Arrangement',chips:['Human Required','SAP S/4HANA'],source:'Logistics User',waitingOn:'Logistics User',
     desc:'After goods issue, transporter, vehicle and packing are arranged and package count, weight and dispatch mode are captured.',
     validation:'Transporter, mode of dispatch, package count and weight are mandatory before a delivery note can be raised.',
     human:'Required — logistics arrange the physical movement.',
     failure:'A missing transport detail blocks the delivery note at step 9.'},
    {name:'Delivery Note Generation & Approval',chips:['Approval Required','SAP S/4HANA'],source:'System / Delivery Note Approver',waitingOn:'Delivery Note Approver',
     desc:'The delivery note is generated from the posted goods issue and routed to its approver for release.',
     validation:'The note must carry the challan type, transport details and the full issue line set.',
     human:'Required — the note is produced by the source system, and a person releases it.',
     failure:'A rejected note returns to logistics at step 7 with the reason attached.'},
    {name:'Challan Generation',chips:['Human Required','SAP S/4HANA'],source:'Finance / F&A / IDT',waitingOn:'Finance / F&A',
     desc:'The sub-contracting challan is generated against the approved delivery note, with the tax treatment applied.',
     validation:'Challan type, tax code and vendor GSTIN must all resolve.',
     human:'Required — no agent is configured for this step; Finance generate and check the challan.',
     failure:'A missing vendor GSTIN stops generation and is raised to Finance.'},
    {name:'Security Gate Outward',chips:['Human Required'],source:'Security User',waitingOn:'Security User',
     desc:'Security verify the challan and the vehicle at the gate and record the outward movement.',
     validation:'Challan number and vehicle number must match the delivery note.',
     human:'Required — the physical gate check.',
     failure:'A mismatch stops the vehicle and is raised to logistics.'},
    {name:'Shipment Confirmation',chips:['Human Required','SAP S/4HANA'],source:'Planner / PMG',waitingOn:'Planner',
     desc:'The shipment is confirmed as despatched and in transit to the vendor.',
     validation:'The outward gate entry must exist before the shipment can be confirmed.',
     human:'Required — the planner confirms despatch.',
     failure:'Confirmation is blocked until the gate entry is recorded.'},
    {name:'Vendor ASN Creation',chips:['Client Action'],source:'Vendor',waitingOn:'Vendor',
     desc:'The vendor raises an advance shipping notice for the processed material being returned.',
     validation:'The ASN must reference the challan and carry the returned quantity per item.',
     human:'Required — this step waits on the vendor, outside the organisation.',
     failure:'An ASN that does not arrive within the SLA is escalated to the buyer.'},
    {name:'QC Clearance of ASN',chips:['Human Required'],source:'QC User',waitingOn:'QC User',
     desc:'QC inspect the returned material against the ASN and clear, hold or reject it.',
     validation:'An inspection result is mandatory per line. A rejection requires a reason code.',
     human:'Required — the physical inspection.',
     failure:'Rejected material is held and raised to the buyer and the vendor.'},
    {name:'Security Gate Inward',chips:['Human Required'],source:'Security User',waitingOn:'Security User',
     desc:'Security verify the inbound vehicle and its documents at the gate and record the inward movement.',
     validation:'The inbound documents must reference the original challan.',
     human:'Required — the physical gate check.',
     failure:'A document mismatch stops receipt and is raised to stores.'},
    {name:'Stores Material Receipt / IMR',chips:['Human Required','SAP S/4HANA'],source:'Stores User',waitingOn:'Stores User',
     desc:'Stores receive the material and post the inward material receipt against the challan.',
     validation:'Received quantity is posted per line and cannot exceed the ASN quantity.',
     human:'Required — stores physically receive the material.',
     failure:'An over-receipt is held for reconciliation rather than posted.'},
    /* -- THE ONE STEP AN AGENT TOUCHES, and it carries both chips because both halves are true.
       The Reconciliation Explainer compares the quantities and recommends a reason code the
       moment the IMR is confirmed — that is the 'AI Automated' half. FR5.2 then requires a
       Stores or Finance user to review the recommendation, confirm the final reason code and
       continue — the 'Human Required' half, and the reason this step also carries
       approvalRequired in manualJourneyStepCatalog. Dropping either chip would misreport which
       half the agent is responsible for, on the one step where that question has an answer. -- */
    {name:'Material Reconciliation & Full Receipt Confirmation',chips:['AI Automated','Human Required','SAP S/4HANA'],source:'Reconciliation Explainer',waitingOn:'Finance / F&A',
     desc:'The Reconciliation Explainer compares issued, consumed, returned and received quantities against the BOM ratio and scrap tolerance, and recommends a reason code per sub-item. Stores or Finance confirm it.',
     validation:'Issued must equal returned plus scrap plus accounted loss, within the tolerance on the PO.',
     human:'Required — the recommendation is advisory. A Stores or Finance user selects or confirms the final reason code and continues the reconciliation.',
     failure:'A variance beyond tolerance is raised to Finance before closure can proceed. The agent never confirms receipt itself.'},
    {name:'Final Closure of Sub-Contracting Transaction',chips:['Human Required','SAP S/4HANA'],source:'Finance / F&A',waitingOn:'Finance / F&A',
     desc:'The challan is settled, the PO and the SCR are closed, and the transaction is posted to the ledger.',
     validation:'Reconciliation must be complete and the variance cleared before closure is allowed.',
     human:'Required — Finance close the transaction.',
     failure:'An open variance blocks closure and returns the run to step 17.'}
  ],
  /* == BHAIYAA STORE CREATION ============================================================
     Four stages, and the split between them is the design: each one is a different KIND of
     work, so each earns its own screen rather than being a line in one long feed.

       Store Details   data entry — the merchant's own signup
       KYC             an identity check the agent performs against UIDAI — not data entry,
                       not provisioning, and the one stage that can genuinely fail, so it is
                       shown on its own rather than buried mid-run where a failure would
                       scroll past
       Store Creation  the automation: fetch, derive, mint, register, provision
       Store Created   the record

     The rail carries all four from the first screen, so a merchant on step 1 can already see
     that an Aadhaar check is coming — which is the difference between asking for an Aadhaar
     number and springing it on them.

     WHAT WAS REMOVED. A fifth stage used to open this journey, asking whether the store sells
     to customers or buys from sellers. It is gone: the signup this mirrors is seller.bhaiyaa.com,
     which signs up sellers and nothing else, so it was a screen with one real answer standing
     between a merchant and the form they came to fill. The `role` field survives on the store
     record — anything already created, and anything arriving from Bhaiyaa carrying a buyer role,
     still reads correctly everywhere. What went is the question, not the column. == */
  'bhaiyaa-store-creation':[
    {name:'Store Details',chips:['Human Required','Bhaiyaa'],source:'Merchant',waitingOn:'Merchant',
     desc:'Bhaiyaa’s own signup — owner and contact details, the store, business and KYC registration, documents, bank details and store address — captured inside the Executive Layer rather than on Bhaiyaa’s site.',
     validation:'Owner name, email, category, store type, entity type, PAN, Aadhaar, the PAN and Aadhaar cards, bank details, address and all three consents are mandatory. PAN, GSTIN, IFSC and pin code are format-checked here; whether they are real is the KYC agent&rsquo;s job. A mobile number, if given, must be OTP-verified.',
     human:'Required — the merchant completes the signup.',
     failure:'Validation errors are reported per field; nothing is submitted until all clear.',
     next:'KYC Verification',fields:['Email Id','Mobile Number','Owner Name','Store Name','Store Category','Store Type','Business KYC','Aadhaar Number','PAN Number','GST Number','Documents','Bank Details','Store Address']},
    {name:'KYC Verification',chips:['AI Automated','Compliance'],source:'KYC Agent',waitingOn:'&mdash;',
     desc:'The KYC agent checks the Aadhaar number against UIDAI, matches the name and mobile on record against the returned demographics, and screens the merchant before any store is opened.',
     validation:'Verhoeff checksum, UIDAI demographic match on name and mobile, and a watchlist screen. All four must pass.',
     human:'None — fully automated. A failed match stops the journey and is handed to Compliance.',
     failure:'A mismatch or a failed screen halts the run before a store exists, which is the point of doing it here rather than after.',
     next:'Store Creation',fields:['Aadhaar Number','Name Match','Mobile Match','Screening Result']},
    {name:'Store Creation',chips:['AI Automated','Bhaiyaa'],source:'Store Agent',waitingOn:'&mdash;',
     desc:'The agent derives the plan and GST position from the business tier, mints the Store ID, registers the store on Bhaiyaa through StoreIntake, files the documents, attaches the payout account and address, and provisions the storefront or the purchase ledger.',
     validation:'Bhaiyaa must return its own store id before provisioning starts.',
     human:'None — fully automated.',
     failure:'A registration failure leaves the Store ID minted and the record unmirrored, so it can be retried rather than re-keyed.',
     next:'Store Created',fields:['Store ID','Bhaiyaa Ref ID','Plan','GST','Storefront / Ledger']},
    {name:'Store Created',chips:['AI Automated','Bhaiyaa'],source:'Store Agent',waitingOn:'&mdash;',
     desc:'The store exists in both systems and is readable in Stores. It stays Pending until the address, GST number and bank details are added.',
     validation:'The record carries both ids and is readable from the Stores listing.',
     human:'None — the merchant opens the record to confirm it landed.',
     failure:'None at this point; the work is done.',
     next:'Journey Complete',fields:['Store ID','Bhaiyaa Ref ID','Status']}
  ],
  'user-master-data':[
    // -- One event per stage of the real intake flow, in the order the operator sees them. Every
    // one is Human Required: the Account Manager fills the form and presses Submit, and what
    // happens after that is a plain REST round-trip to NewForce, not an agent deciding anything.
    // Calling ingestion "AI Automated" would put an agent badge on an HTTP call. --
    {name:'Master Data Intake',chips:['Human Required','Client'],source:'Account Manager',desc:"The Account Manager captures the client's legal, contact, and billing master data on the NewForce intake form.",validation:'Mandatory identity, contact, and billing fields are checked before the form can be submitted.',human:'Required — Account Manager completes the intake form.',failure:'Missing mandatory fields block the submit and stay flagged on the form.',next:'Submission & Ingestion',fields:['Client Legal Name','Country','Primary Contact','Billing Entity']},
    {name:'Submission & Ingestion',chips:['Human Required','NewForce Solutions'],source:'Account Manager',desc:'Submitting posts the form to NewForce Solutions, which registers it and returns its own submission id; the Executive Layer then reads that submission back through the intake API.',validation:'NewForce must accept the submission and return a submission id before ingestion starts.',human:'Required — Account Manager presses Submit.',failure:'An unreachable NewForce leaves the form filled and says why it could not be submitted, so nothing is lost.',next:'Client Record Created',fields:['Submission ID','Source System','Payload']},
    {name:'Client Record Created',chips:['Human Required','Client'],source:'Account Manager',desc:'The Executive Layer mints a Client ID, links it to the NewForce submission, and writes the record to Clients & Stores > Clients as Pending.',validation:'The new record is readable from Clients & Stores > Clients and carries both ids.',human:'Required — Account Manager opens the record to confirm it landed.',failure:'A write failure leaves the submission registered in NewForce and no local record, so it can be re-ingested.',next:'Journey Complete — Client Master Data Created',fields:['Client ID','Submission ID','Record Status']}
  ],
  /* Step names here are the nine amPipelineStages `short` labels, verbatim and in the same
     order, so the journey bar and the Account Manager pipeline read as one vocabulary. A user
     who learns "Quote sent" on the pipeline board meets the same word inside the run. The old
     names ("Proposal Sent", "Contract Sent", "Ready for Payroll") were a second vocabulary for
     the same states, and the two signings collided under one word — see the note on
     amPipelineStages. `track` mirrors amPipelineTracks so the bar can show the same
     engagement/placement split the board shows.

     Contract record statuses (ctFlow) are deliberately NOT renamed — those are the Contracts
     module's own lifecycle and are matched on by string in the listing filters. */
  'contract-creation':[
    {name:'New request',track:'engagement',waitingOn:'Account Manager',chips:['AI Automated','Deal Desk','Employee'],source:'AI Prompt Parser',desc:"AI parses a natural-language prompt to create the deal and, if the person doesn't already exist, creates or matches the Employee record in the same step.",validation:'Employee name and ID are matched or created against existing records.',human:'None — fully automated.',failure:'Ambiguous name matches are flagged for manual employee selection.',next:'Quote in preparation',fields:['Employee Name','Employee ID','Country','Client','Contract Type']},
    {name:'Quote in preparation',track:'engagement',waitingOn:'Account Manager',chips:['AI Automated','Pricing'],source:'AI Compliance Hub Sync',desc:'AI works out the price for the role and checks the statutory rules that apply in that country before anything is quoted.',validation:'Country rate rules and statutory obligations are resolved from the Compliance Hub.',human:'None — fully automated.',failure:'A country with no configuration raises an exception for the compliance team.',next:'Quote sent',fields:['Country Rules','Cost Build','Margin %']},
    {name:'Quote sent',track:'engagement',waitingOn:'Client',chips:['AI Automated','Proposal'],source:'AI Contract Assistant',desc:'AI drafts the commercial terms and compliance items, then sends the quote out for approval.',validation:'Commercial terms are validated against country rate rules.',human:'None — AI-supported drafting.',failure:'Missing rate data blocks the send and raises an exception.',next:'Quote accepted',fields:['Billing Rate','Pay Rate','Margin %','Compliance Checklist']},
    {name:'Quote accepted',track:'engagement',waitingOn:'Deal Manager',chips:['Human Required','Approval Required'],source:'Deal Manager',desc:'Deal Manager reviews the commercial terms and the compliance checklist, then accepts the quote.',validation:'Manual review sign-off is recorded.',human:'Required — Deal Manager approval.',failure:'Rejection routes back to Quote sent for correction.',next:'Client signing',fields:['Approver Name','Approval Timestamp']},
    {name:'Client signing',track:'engagement',waitingOn:'Client',chips:['Client Action','Docuseal'],source:'AI + Docuseal',desc:'AI generates the agreement from the accepted quote and sends it to the client for signature via Docuseal.',validation:'Contract fields are auto-filled from the quote and the signature request is tracked.',human:'External — the client signs; drafting is AI assisted.',failure:'A signature bounce or timeout raises an exception for resend.',next:'Deposit due',fields:['Contract Number','Signatory Email','Docuseal Status']},
    {name:'Deposit due',track:'placement',waitingOn:'Client',gate:true,chips:['Client Action','Finance'],source:'Finance',desc:'The deposit invoice is raised against the signed agreement. No hire can start until that money arrives, so this stage holds the placement.',validation:'The deposit invoice is matched against a cleared receipt before the hold is released.',human:'External — the client pays; Finance confirms receipt.',failure:'An unpaid deposit past terms holds the placement and escalates to the Account Manager.',next:'Worker signing',fields:['Deposit Invoice','Amount Due','Cleared On']},
    {name:'Worker signing',track:'placement',waitingOn:'Legal / Contracts',chips:['Client Action','Human Required','Approval Required'],source:'Employee (via Docuseal)',desc:'The person being hired signs their employment contract in Docuseal. Once received, the signed document routes to the Ops Manager for final approval.',validation:'Docuseal confirms the countersignature, and the Ops Manager verifies it against the agreed terms.',human:'External signature, then Ops Manager approval.',failure:'A signature timeout or bounce reopens the contract for resend from Client signing.',next:'Onboarding',fields:['Signature Status','Signed Timestamp','Docuseal Envelope ID']},
    {name:'Onboarding',track:'placement',waitingOn:'HR',chips:['AI Automated','Onboarding'],source:'AI Onboarding Engine',desc:'AI runs the onboarding checklist — documents, compliance checks, system access provisioning.',validation:'All onboarding checklist items are marked complete.',human:'None — fully automated.',failure:'A missing document flags an exception for HR follow-up.',next:'Working',fields:['Onboarding Checklist','Document Status','Compliance Status']},
    {name:'Working',track:'placement',waitingOn:'&mdash;',chips:['AI Automated','Payroll'],source:'AI Payroll Readiness Check',desc:'AI validates that all payroll-required fields are complete and marks the employee live and ready for the next payroll cycle.',validation:'Bank details, tax info, and compensation mapping are all present.',human:'None — fully automated.',failure:'Incomplete payroll data blocks readiness and raises an exception.',next:'Journey Complete — Working',fields:['Bank Details','Compensation Mapping','Tax Info']}
  ],
  'payroll-creation':[
    {name:'Prompt Given (Name, ID, etc.)',chips:['AI Automated','Prompt'],source:'AI Prompt Parser',desc:'AI parses a prompt containing the employee name/ID and the payroll period to initiate the run.',validation:'Employee identity is resolved against Employee records.',human:'None — AI assisted parsing.',failure:'An unresolved employee ID raises an exception for manual lookup.',next:'Attendance Capture',fields:['Employee Name','Employee ID','Pay Period']},
    {name:'Attendance Capture',chips:['AI Automated','Timesheet'],source:'AI Timesheet Sync',desc:'AI pulls attendance and timesheet records for the pay period.',validation:'Attendance days are reconciled against leave records.',human:'None — fully automated.',failure:'Missing attendance data raises an exception.',next:'Salary Calculation',fields:['Days Present','Days on Leave','Overtime Hours']},
    {name:'Salary Calculation',chips:['AI Automated','Calculation'],source:'AI Payroll Engine',desc:'AI calculates gross/net salary using payheads, statutory deductions, and country compliance rates.',validation:'The calculation is cross-checked against compliance rate rules.',human:'None — fully automated.',failure:'A rate mismatch raises an exception for finance review.',next:'Approval',fields:['Gross Pay','Deductions','Net Pay']},
    {name:'Approval',chips:['Human Required','Approval Required'],source:'Finance Approver',desc:'Finance reviews the calculated payroll and approves it for disbursement.',validation:'Manual sign-off is recorded.',human:'Required — Finance approval.',failure:'Rejection routes back to Salary Calculation.',next:'Salary Slip',fields:['Approver Name','Approval Timestamp']},
    {name:'Salary Slip Template',chips:['AI Automated','Payslip'],source:'AI Payslip Generator',desc:'AI creates a salary slip template and populates it with employee, attendance, and salary details.',validation:'Payslip totals match the approved calculation.',human:'None — fully automated.',failure:'A generation failure raises an exception for retry.',next:'Salary Slip Created',fields:['Payslip ID','Net Pay','Issue Date']},
    {name:'Salary Slip Created',chips:['AI Automated','Payroll'],source:'AI Payroll Archive',desc:'AI marks the salary slip as created and stores it against the employee record.',validation:'The generated salary slip is available in payroll documents.',human:'None — fully automated.',failure:'A storage failure raises an exception for retry.',next:'Journey Complete — Salary Slip Created',fields:['Payslip ID','Employee ID','Created Date']}
  ],
  'h2r-lifecycle':[
    {name:'Employee Creation',chips:['AI Automated','Employee'],source:'AI Prompt Parser',desc:'AI creates the employee record from a prompt with name, role, and country.',validation:'A duplicate check is run against existing employee records.',human:'None — AI assisted.',failure:'A duplicate match raises an exception for manual resolution.',next:'Fetch Country Details (Compliance Hub)',fields:['Employee Name','Role','Country','Employment Type']},
    {name:'Fetch Country Details (Compliance Hub)',chips:['AI Automated','Compliance Hub'],source:'AI Compliance Hub Sync',desc:"AI fetches statutory and compliance requirements for the employee's country from the Compliance Hub.",validation:'Country rate rules and statutory requirements are retrieved.',human:'None — fully automated.',failure:'A missing country config raises an exception for the compliance team.',next:'Show Leave Policies',fields:['Country Rate Rules','Statutory Requirements','Tax Bands']},
    {name:'Show Leave Policies',chips:['AI Automated','Leave'],source:'AI Leave Policy Engine',desc:"AI matches and displays the applicable leave policy for the employee's country and entity.",validation:"The leave policy is matched to the employee's country and entity.",human:'None — AI assisted display.',failure:'No matching policy raises an exception for HR to configure one.',next:'Ask for Approval if Required',fields:['Leave Policy Name','Leave Types','Annual Entitlement']},
    {name:'Ask for Approval if Required',chips:['Human Required','Approval Required'],source:'HR Manager',desc:'If the leave policy or compliance setup deviates from standard, HR reviews and approves before finalizing.',validation:'Manual sign-off is recorded when a deviation is detected.',human:'Required only on deviation — otherwise auto-skipped.',failure:'Rejection routes back to Show Leave Policies for reconfiguration.',next:'Offboarding',fields:['Approver Name','Deviation Reason']},
    {name:'Offboarding',chips:['AI Automated','Offboarding'],source:'AI Offboarding Engine',desc:"AI runs the offboarding checklist — access revocation, final settlement calculation, exit compliance checks — when the employee's exit is triggered.",validation:'All offboarding checklist items are marked complete.',human:'None — fully automated.',failure:'A pending final settlement raises an exception for finance.',next:'Journey Complete — Offboarding',fields:['Exit Date','Final Settlement Amount','Access Revocation Status']}
  ]
};

// -- AI EXECUTIVE — SUPER ADMIN: client roster + which journeys were built for each, with their own step config --
const aiClients=[
  {id:'dhi-hyperlocal',name:'Dhi Hyperlocal',country:'India',plan:'Enterprise',employees:142,contactName:'Priya Nair',contactRole:'Entity Admin'},
  {id:'vantage-freight',name:'Vantage Freight Pvt Ltd',country:'India',plan:'Growth',employees:64,contactName:'Karan Mehta',contactRole:'Entity Admin'},
  {id:'norrbridge-logistics',name:'Norrbridge Logistics B.V.',country:'Netherlands',plan:'Enterprise',employees:210,contactName:'Sanne de Vries',contactRole:'Entity Admin'},
  {id:'kaira-textiles',name:'Kaira Textiles Ltd',country:'India',plan:'Growth',employees:38,contactName:'Rohan Shah',contactRole:'Entity Admin'}
];
// scope[i] mirrors aiJourneyEvents[journeyId][i] by position — {mode:'ai'|'manual'}; only present where it deviates from that step's default.
const aiClientJourneys=[
  {id:'cj-1',clientId:'dhi-hyperlocal',journeyId:'contract-creation',status:'Active',builtOn:'01 Jul 2026',scope:[]},
  {id:'cj-2',clientId:'dhi-hyperlocal',journeyId:'payroll-creation',status:'Active',builtOn:'02 Jul 2026',scope:[]},
  {id:'cj-3',clientId:'vantage-freight',journeyId:'contract-creation',status:'Active',builtOn:'22 Jun 2026',scope:[null,null,null,null,null,null,null,{mode:'manual'}]},
  {id:'cj-4',clientId:'norrbridge-logistics',journeyId:'h2r-lifecycle',status:'Draft',builtOn:'28 Jun 2026',scope:[]},
  {id:'cj-5',clientId:'kaira-textiles',journeyId:'payroll-creation',status:'Active',builtOn:'15 Jun 2026',scope:[null,null,null,null,{mode:'manual'}]}
];
let aiClientJourneySeq=6;

// -- Configure: Systems (full parity with reference config console) --
// These client-side ERPs (SAP/Infor) treat Dhi ADT as their staffing *vendor*, so "Procure to
// Pay" reflects the client's own AP process for paying Dhi ADT (PO -> service confirmation ->
// invoice), alongside Order to Cash (client/workforce master data creation and the attendance
// feed that bills against it) and Finance & Payroll Postings (GL). Each API is tagged
// Transactional (business documents/events) vs Transformational (master/reference data consumed
// by Data Foundation).
// -- "Store Management" is Bhaiyaa's category, not a rename of Order to Cash everywhere. The
// list is shared across systems but a system only ever shows the categories its own APIs are
// tagged with (see buildCfgSystemDetailHTML, which groups off apiList), so adding one here costs
// nothing to SAP/Infor/ADT SaaS and keeps Bhaiyaa's grouping true to what Bhaiyaa is: a storefront
// platform whose objects are stores, not sales orders against a staffing contract. --
const cfgApiCategories=['Procure to Pay','Order to Cash','Store Management','Finance & Payroll Postings','Others'];
const cfgApiSubcats={
  'Procure to Pay':['Vendor & Service Master','Purchasing','Service Confirmation & Invoicing'],
  'Order to Cash':['Master Data Creation','Time & Attendance'],
  'Store Management':['Store Onboarding','Master Data Creation','Time & Attendance'],
  'Finance & Payroll Postings':['GL Postings'],
  'Others':['Compliance & Documentation','General']
};
const cfgApiTypes=['Transactional','Transformational'];
/* == SYSTEMS: SAP S/4HANA, AND ONLY SAP S/4HANA ===========================================
   Infor ERP, NewForce Solutions, Bhaiyaa and ADT SaaS were removed from this list. FR2 defines
   one configured system and the page now shows exactly that — a Systems list of five where four
   are undefined reads as an estate, and an estate is a claim this build cannot support.

   WHAT REMOVING A RECORD FROM HERE ACTUALLY DOES, so the next person can put one back knowing
   the cost. This array feeds three surfaces and nothing else:

     1. Configure > Systems (the list and the detail page). One row now.
     2. The Entity Admin dashboard's "Systems Activated" tile and its modal, which count
        isDefault records. Reads 1 of 1.
     3. The system stamp on a journey step (aicjEventHTML, js/pages.js). A step whose systemId
        no longer resolves here renders as plain unlinked text instead of a button through to
        the system page — the SAME fallback already used by Compliance Hub, Docuseal, Persona
        and the bank webhook, which never had records. So the H2R and contract journeys still
        name NewForce Solutions and ADT SaaS on their steps; those names just stop being links.

   NOT AFFECTED: the backend. NewForce and Bhaiyaa are wired in backend/connectors/*, and the
   client push and store poll run off backend/.env — not off this array. Removing the rows
   changes what Configure displays, not what the integrations do.

   NO cfgModels ORPHANED: not one model carries a systemId (see the Client object below), so the
   Data Foundation block on a system page was already empty for every system. == */
const cfgSystems=[
  /* -- FR2.1. `lastTested` is a date and time rather than the relative "3 hrs ago" it used to
     carry: the requirement asks when the connection was last tested, and "3 hrs ago" is only an
     answer for as long as the page is open. testCfgSystemConnection stamps the same format.

     `apiSpecPending` drives one line on the API block (FR2.2): the list below is provisional
     until the SAP API specifications arrive. It is a flag rather than prose in the list so that
     deleting it is the whole of marking the spec received. -- */
  {id:'sap',name:'SAP S/4HANA',type:'SAP',method:'REST / OData',endpoint:'https://lnt-s4.adt.local/sap/odata/',auth:'OAuth 2.0',apis:142,lastTested:'07 Sep 2026, 09:12 AM',status:'Connected',isDefault:true,activatedForEntity:true,apiSpecPending:true,
    apiList:[
      {name:'API_BUSINESS_PARTNER · Vendor Master',dir:'rw',cat:'Procure to Pay',sub:'Vendor & Service Master',type:'Transformational'},
      {name:'API_PRODUCT_SRV · Service Item Master',dir:'rw',cat:'Procure to Pay',sub:'Vendor & Service Master',type:'Transformational'},
      {name:'API_PURCHASEORDER_PROCESS · Staffing PO',dir:'r',cat:'Procure to Pay',sub:'Purchasing',type:'Transactional'},
      {name:'API_SRVENTRYSHEET_SRV · Service Confirmation',dir:'r',cat:'Procure to Pay',sub:'Service Confirmation & Invoicing',type:'Transactional'},
      {name:'API_SUPPLIERINVOICE · Vendor Invoice',dir:'r',cat:'Procure to Pay',sub:'Service Confirmation & Invoicing',type:'Transactional'},
      {name:'API_COSTCENTER · Cost Center Master',dir:'r',cat:'Order to Cash',sub:'Master Data Creation',type:'Transformational'},
      {name:'API_GLACCOUNTLINEITEM · GL Posting',dir:'r',cat:'Finance & Payroll Postings',sub:'GL Postings',type:'Transactional'}
    ]}
];

// -- Configure: Data models (full parity: Material + Vendor, each with mapping/enrichment/rules/test) --
const cfgModels=[
  {id:'material',name:'Material',source:'SAP',desc:'Standard fields from SAP, plus enrichment fields held in Data Foundation.',
    mapped:[['Material ID','Product','string'],['Description','ProductDescription','string'],['Base unit','BaseUnit','string'],['Base price','NetPriceAmount','decimal']],
    enrichment:[{name:'Site',type:'string'},{name:'Project code',type:'string'},{name:'Compliance',type:'string'},{name:'Preferred vendor',type:'string'},{name:'Lead time',type:'string'}],
    rules:{makerChecker:true,validation:'Base price must be greater than zero'},
    sample:[['Material ID','MAT-100482'],['Description','TMT Steel Grade X'],['Base unit','TON'],['Base price','₹52,000 / T'],['Site','Hyderabad Metro'],['Compliance','IS 1786']]},
  {id:'vendor',name:'Vendor',source:'SAP + Infor',desc:'Supplier master unified across SAP and Infor.',
    mapped:[['Vendor ID','SupplierID','string'],['Vendor Name','SupplierName','string'],['Country','Country','string'],['Payment Terms','PaymentTerms','string'],['Rating','VendorRating','decimal'],['Bank Details','BankInfo','object']],
    enrichment:[{name:'Risk Category',type:'string'},{name:'ESG Score',type:'string'},{name:'Preferred Status',type:'string'}],
    rules:{makerChecker:true,validation:'Vendor rating ≥ 3.0'},
    sample:[['Vendor ID','VEN-2044'],['Vendor Name','Bharat Steel Traders'],['Country','India'],['Payment Terms','Net 30'],['Rating','4.2'],['Bank Details','HDFC •••• 2210']]},
  // -- Client is the live one: its mapped fields are exactly what NewForce Solutions's intake form
  // submits, and its enrichment fields are exactly what that form does NOT capture — which is
  // why an ingested record sits in Pending until the account team supplies them. What the form
  // returns is a lead: someone typed a company name and booked a slot. What a client has to be,
  // before a deal can be raised against it, is an owned account with a tier, a stage and a
  // commercial shape. That gap is the enrichment set, and it is why the two lists below read as
  // two different vocabularies. intakeFormPage marks this as
  // the object Create Contract fills in, and names the page that renders its form
  // (startContractIntake, js/pages.js). No systemId: the card belongs on Data Foundation, where
  // objects are described, and the system page it used to also appear on is now just the
  // integration contract. --
  // The object id stays 'user': it is wired through routing, RBAC and the intake page's own
  // state. Only the label changed — what this object holds was always a client.
  {id:'user',name:'Client',source:'NewForce Solutions',intakeFormPage:'cfg-user-intake',
    desc:'Client captured by the NewForce Solutions intake form, unified into the Executive Layer Client store.',
    // -- NO `identity` array, so no Identity card. It carries the same two ids it always did:
    // Client ID is minted here (`employee_code`) and Source Record ID arrives with the
    // submission — the mapped row, the sample record and the validation rule below all still
    // name them. See the note on the Store object for the same decision. --
    mapped:[
      // Arrives with the submission as `id` — the source system's own reference for it, which is
      // why it is mapped rather than minted.
      ['Source Record ID','id','string'],
      ['Full Name','full_name','string'],
      ['Work Email','work_email','string'],
      ['Phone Country Code','phone_country_code','string'],
      ['Phone Number','phone_number','string'],
      ['Company Name','company_name','string'],
      ['Country Hiring In','country_hiring_in','string'],
      ['Looking For','looking_for','string'],
      ['Heard About Us','heard_about_us','string'],
      // The demo slot the lead picked. Typed string, not date: it carries a time and a zone, and
      // 'date' in this vocabulary means a calendar day with no time on it. Storing an instant
      // under a day type is the category error the logs table already had to be corrected for.
      ['Demo Slot','demo_datetime','string']
    ],
    // -- Due diligence and the named contact. Not one of these is on the intake form, and that is
    // the point: the form produces a lead, and these five are what a lead has to acquire before it
    // can be contracted against. KYB is the gate — a company we have not verified is a company we
    // cannot legally employ on behalf of — and the SPOC set is the answer to "who signs, and who
    // do we chase", which the form never asks because the person who books a demo is routinely
    // not the person who owns the account.
    //
    // Client Segment, not Client Tier: a tier ranks clients against each other, a segment says
    // what kind of client this is, and the second is what actually routes the work.
    //
    // The employee-shaped set this replaced (Department, Job Title, Branch, Joining Date) was a
    // leftover from when this object was called `user` and held a person. It holds a company.
    // Status went with them: a record's lifecycle state is set by the system, not supplied by an
    // operator, so it was never an enrichment field — it is still on the record and still what
    // Pending/Active reports.
    enrichment:[
      {name:'KYB Status',type:'string'},
      {name:'Client Segment',type:'string'},
      {name:'SPOC Name',type:'string'},
      {name:'SPOC Email',type:'string'},
      {name:'SPOC Contact',type:'string'}
    ],
    rules:{makerChecker:true,validation:'Full name and work email are required. Client ID is minted here and unique; Source Record ID must be unique too — a repeat resolves to the existing client instead of creating a second one. Record enters as Pending until enrichment fields are supplied'},
    sample:[['Client ID','CLI-000010'],['Source Record ID','ADT-SUB-0011'],['Full Name','Kavita Rao'],['Work Email','kavita@helioworks.com'],['Phone Number','+91 9765432100'],['Company Name','Helioworks'],['Country Hiring In','Netherlands'],['Looking For','Entity Setup'],['Heard About Us','Referral (Client/Partner)'],['Demo Slot','12 Aug 2026, 15:00 IST'],['KYB Status','Verified'],['Client Segment','Mid-market'],['SPOC Name','Daan Visser'],['SPOC Email','daan.visser@helioworks.com'],['SPOC Contact','+31 6 2244 8190']]},
  /* == STORE ===============================================================================
     The second live object, and the one Data Foundation was missing entirely: Bhaiyaa's store
     signup lands in a real `stores` table (sql/schema_direct_employees.sql), the Store
     Operations board works those records every day, and the object describing them existed
     nowhere. A page whose job is "here is every object the layer owns" was omitting one of the
     two it actually owns.

     EVERY FIELD BELOW IS A COLUMN. Mapped fields are the `stores` columns Bhaiyaa's signup
     fills; the enrichment set is the three the schema comments call out as arriving empty —
     which is exactly why a created store sits in Pending until an Ops Manager supplies them,
     the same contract the Client object has with its own intake form.

     NO `identity` SECTION — same as Client, and no model declares one now. This object still
     carries the same two ids: we mint Store Code, Bhaiyaa minted Source Record ID, and
     `uq_stores_source_record` deduplicates on theirs. They are read off the mapped column, the
     sample record and the validation rule rather than restated in a card of their own. The
     renderer still supports it (buildCfgModelDetailHTML, js/pages.js) — re-add an `identity`
     array to any model and the card comes back; nothing else needs changing.

     There is deliberately NO column for a full Aadhaar number anywhere in this object — the
     schema stores the masked form only, and an object description that listed the real one
     would be describing a field the database refuses to hold. == */
  {id:'store',name:'Store',source:'Bhaiyaa',
    desc:'Store opened on Bhaiyaa, mirrored into the Executive Layer store as the record the Store Operations board works.',
    mapped:[
      ['Source Record ID','source_record_id','string'],
      ['Store Name','store_name','string'],
      ['Role','role','string'],
      ['Category','category','string'],
      ['Business Tier','store_type','string'],
      ['Owner First Name','first_name','string'],
      ['Owner Last Name','last_name','string'],
      ['Email','email','string'],
      ['Mobile','mobile','string'],
      ['Mobile Verified','mobile_verified','boolean'],
      // Masked on arrival and stored masked. The full number never crosses into this store.
      ['Aadhaar (masked)','aadhaar_masked','string'],
      ['KYC Status','kyc_status','string'],
      ['KYC Verified By','kyc_verified_by','string'],
      ['KYC Verified At','kyc_verified_at','date'],
      // The whole submission, verbatim, so nothing the merchant entered is lost while dedicated
      // columns are still being added — bank, address, GST, PAN, MSME and the document list all
      // live in here today.
      ['Full Signup','raw_signup','object'],
      ['Mirror State','mirror_state','string']
    ],
    enrichment:[
      {name:'Plan',type:'string'},
      {name:'GST Position',type:'string'},
      {name:'Credit Line',type:'string'},
      {name:'Payment Terms',type:'string'}
    ],
    rules:{makerChecker:true,validation:'Store name, owner name and email are required. Store Code is minted here and unique; Source Record ID must be unique per source — a repeat resolves to the existing store instead of opening a second one. KYC must read Verified before the store leaves Pending, and the full Aadhaar number is never stored.'},
    sample:[['Store Code','STR-000112'],['Source Record ID','BHA-STR-0001'],['Store Name','Sharma Kirana Mart'],['Role','seller'],['Category','Grocery & Kirana'],['Business Tier','MSME: Micro, Small, and Medium Enterprises'],['Owner First Name','Ravi'],['Owner Last Name','Sharma'],['Email','ravi@sharmakirana.in'],['Mobile','+91 98220 41176'],['Mobile Verified','true'],['Aadhaar (masked)','XXXX XXXX 9012'],['KYC Status','Verified'],['KYC Verified By','KYC Agent'],['KYC Verified At','01 Aug 2026, 11:20'],['Full Signup','{ bank, address, GST, PAN, documents… }'],['Mirror State','mirrored'],['Plan','Standard'],['GST Position','Registered — Regular'],['Credit Line','₹50,000'],['Payment Terms','Net 15']]}
];
/* == FR3: DATA FOUNDATION CATEGORIES ======================================================
   The eight category cards the Data Foundation landing page shows, covering the master and
   reference data the Sub-Contracting process needs.

   WHY THIS IS A SECOND ARRAY AND NOT MORE cfgModels ENTRIES. A cfgModel is shaped around a
   decision FR3.4 has not made yet: it splits its fields into `mapped` (came from a source
   system) and `enrichment` (held here), and its whole detail page is built from that split.
   FR3.4 says the segregation into SAP S/4HANA mapped fields and AI Execution Layer enrichment
   fields is settled only once RICEFW is received and reviewed. Filing these 79 fields into
   mapped/enrichment now would be inventing that answer, in the one structure that cannot
   express "not yet decided" — so a category holds ONE flat `fields` list, which is exactly what
   FR3.1 describes and all FR3.3 asks the detail screen to render.

   cfgModels IS STILL THERE AND STILL LOAD-BEARING. Client (`user`) drives Create Contract's
   intake form through its `intakeFormPage`, and the enrichment section of the Clients drawer
   reads its `enrichment` list (mdClientEnrichFields, js/pages.js). Store does the same job for
   store records. Neither gets a card on this page any more — FR3.2 names eight and neither is
   among them — but deleting the records would take a live journey down with them.

   `src` IS AN EXPECTATION, NOT A MAPPING. Where a field has an unambiguous standard SAP name
   (MATNR, LIFNR, AUFNR, LGORT) it is written down, because a blank column teaches the reader
   nothing and the name is not in doubt. Where it does not, `src` is empty and renders as a
   pending marker. Either way the page states above the table that none of it is confirmed
   until RICEFW — see cfgCategoryPendingNote. == */
const cfgDataCategorySource='SAP S/4HANA';
const cfgDataCategories=[
  {id:'material',name:'Material',desc:'Material and product master, including BOM structure and the issue / receivable items a sub-contracting order moves.',fields:[
    {name:'Material / Product Code',src:'MATNR',type:'string',map:'Master key',status:'Active'},
    {name:'Description',src:'MAKTX',type:'string',map:'Master text',status:'Active'},
    {name:'Item Type',src:'MTART',type:'string',map:'Lookup — material type',status:'Active'},
    {name:'Base UOM',src:'MEINS',type:'string',map:'Lookup — unit of measure',status:'Active'},
    {name:'HSN',src:'STEUC',type:'string',map:'Tax classification',status:'Active'},
    {name:'Variant / Revision',src:'REVLV',type:'string',map:'Revision level',status:'Active'},
    {name:'BOM Parent Item',src:'STLNR',type:'string',map:'BOM header reference',status:'Active'},
    {name:'BOM Component',src:'IDNRK',type:'string',map:'BOM item reference',status:'Active'},
    {name:'Component Qty / Ratio',src:'MENGE',type:'decimal',map:'BOM quantity per parent',status:'Active'},
    {name:'Receivable Item',src:'',type:'string',map:'Derived from BOM — what the vendor returns',status:'Active'},
    {name:'Issue Item',src:'',type:'string',map:'Derived from BOM — what we send out',status:'Active'}
  ]},
  {id:'vendor',name:'Vendor',desc:'Business partner master for sub-contracting vendors, with tax registration, address and the services each is approved for.',fields:[
    {name:'Vendor / Business Partner Code',src:'LIFNR',type:'string',map:'Master key',status:'Active'},
    {name:'Vendor Name',src:'NAME1',type:'string',map:'Master text',status:'Active'},
    {name:'External / Internal Type',src:'',type:'string',map:'Lookup — partner type',status:'Active'},
    {name:'GSTIN / Tax ID',src:'STCD3',type:'string',map:'Tax registration number',status:'Active'},
    {name:'Vendor Address',src:'ADRNR',type:'object',map:'Address reference',status:'Active'},
    {name:'Address Code',src:'ADRNR',type:'string',map:'Address key',status:'Active'},
    {name:'Vendor Skill / Service',src:'',type:'string',map:'Approved service list',status:'Active'},
    {name:'Vendor Status',src:'LOEVM',type:'string',map:'Active / blocked flag',status:'Active'}
  ]},
  {id:'project-production',name:'Project & Production',desc:'The project and production order a sub-contracting requisition is raised against, down to the routing operation.',fields:[
    {name:'Project Code',src:'PSPID',type:'string',map:'Project definition',status:'Active'},
    {name:'Project Name',src:'POST1',type:'string',map:'Project text',status:'Active'},
    {name:'Project Element',src:'PSPNR',type:'string',map:'WBS element',status:'Active'},
    {name:'Activity / Cost Object',src:'AUFNR',type:'string',map:'Cost object reference',status:'Active'},
    {name:'Production Order No.',src:'AUFNR',type:'string',map:'Order key',status:'Active'},
    {name:'Product',src:'MATNR',type:'string',map:'Order material',status:'Active'},
    {name:'Production Quantity',src:'GAMNG',type:'decimal',map:'Order quantity',status:'Active'},
    {name:'UOM',src:'GMEIN',type:'string',map:'Lookup — unit of measure',status:'Active'},
    {name:'Start Date',src:'GSTRP',type:'date',map:'Scheduled start',status:'Active'},
    {name:'End Date',src:'GLTRP',type:'date',map:'Scheduled finish',status:'Active'},
    {name:'Status',src:'STTXT',type:'string',map:'Order status',status:'Active'},
    {name:'Routing Operation No.',src:'VORNR',type:'string',map:'Operation key',status:'Active'},
    {name:'Operation Description',src:'LTXA1',type:'string',map:'Operation text',status:'Active'},
    {name:'Sequence',src:'PLNFL',type:'string',map:'Routing sequence',status:'Active'}
  ]},
  {id:'inventory-storage',name:'Inventory & Storage',desc:'Where stock sits and what kind of place each location is — including the vendor location sub-contracted stock moves to.',fields:[
    {name:'Warehouse',src:'LGNUM',type:'string',map:'Warehouse number',status:'Active'},
    {name:'Storage Location',src:'LGORT',type:'string',map:'Storage location key',status:'Active'},
    {name:'Storage Zone',src:'LZONE',type:'string',map:'Zone within warehouse',status:'Active'},
    {name:'Location Type',src:'',type:'string',map:'Lookup — drives the five types below',status:'Active'},
    {name:'Lot / Serial',src:'CHARG',type:'string',map:'Batch / serial number',status:'Active'},
    {name:'Main',src:'',type:'string',map:'Location type mapping',status:'Active'},
    {name:'Reserved',src:'',type:'string',map:'Location type mapping',status:'Active'},
    {name:'Staging',src:'',type:'string',map:'Location type mapping',status:'Active'},
    {name:'At Vendor / Sub-Contracting',src:'',type:'string',map:'Special stock at vendor',status:'Active'},
    {name:'Receiving Locations',src:'',type:'string',map:'Location type mapping',status:'Active'}
  ]},
  {id:'procurement-commercial',name:'Procurement & Commercial',desc:'The rate contract a sub-contracting job is priced from, and the commercial terms that travel with it.',fields:[
    {name:'Purchase Office',src:'EKORG',type:'string',map:'Purchasing organisation',status:'Active'},
    {name:'Rate Contract',src:'EBELN',type:'string',map:'Outline agreement number',status:'Active'},
    {name:'Vendor',src:'LIFNR',type:'string',map:'Contract vendor',status:'Active'},
    {name:'Item / Service',src:'MATNR',type:'string',map:'Contract line item',status:'Active'},
    {name:'Price',src:'NETPR',type:'decimal',map:'Net price',status:'Active'},
    {name:'Price Basis',src:'PEINH',type:'string',map:'Price unit',status:'Active'},
    {name:'Currency',src:'WAERS',type:'string',map:'Lookup — currency',status:'Active'},
    {name:'Contract Validity',src:'KDATB / KDATE',type:'date',map:'Validity from / to',status:'Active'},
    {name:'Tax Code',src:'MWSKZ',type:'string',map:'Lookup — tax code',status:'Active'},
    {name:'Payment Terms',src:'ZTERM',type:'string',map:'Lookup — payment terms',status:'Active'}
  ]},
  {id:'logistics-dispatch',name:'Logistics & Dispatch',desc:'What physically leaves the gate on a delivery challan — packing, weight, transport and the people at each end.',fields:[
    {name:'Challan Type',src:'',type:'string',map:'Lookup — challan type',status:'Active'},
    {name:'Transporter',src:'',type:'string',map:'Lookup — transporter master',status:'Active'},
    {name:'Package Type / Details',src:'',type:'string',map:'Free text',status:'Active'},
    {name:'Number of Packages',src:'',type:'number',map:'Numeric entry',status:'Active'},
    {name:'Package Weight',src:'BRGEW',type:'decimal',map:'Gross weight',status:'Active'},
    {name:'Weight UOM',src:'GEWEI',type:'string',map:'Lookup — weight unit',status:'Active'},
    {name:'Mode of Dispatch',src:'',type:'string',map:'Lookup — dispatch mode',status:'Active'},
    {name:'Vehicle No.',src:'',type:'string',map:'Free text',status:'Active'},
    {name:'Driver Details',src:'',type:'string',map:'Name and contact',status:'Active'},
    {name:'LR / Transport Reference',src:'',type:'string',map:'Free text',status:'Active'},
    {name:'Insurance Details',src:'',type:'string',map:'Policy reference and cover',status:'Inactive'},
    {name:'Loading / Unloading Contact',src:'',type:'string',map:'Name and contact at each end',status:'Active'}
  ]},
  {id:'user-organization',name:'User & Organization',desc:'Who acts in the process and where they sit — the people and locations a sub-contracting document is raised and approved by.',fields:[
    {name:'User / Employee',src:'PERNR',type:'string',map:'Employee key',status:'Active'},
    {name:'Name',src:'ENAME',type:'string',map:'Employee name',status:'Active'},
    {name:'Role / Position',src:'PLANS',type:'string',map:'Position in org structure',status:'Active'},
    {name:'Location',src:'WERKS',type:'string',map:'Plant / location',status:'Active'},
    {name:'Location Address',src:'ADRNR',type:'object',map:'Address reference',status:'Active'},
    {name:'GSTIN / Tax ID',src:'STCD3',type:'string',map:'Tax registration number',status:'Active'},
    {name:'User Status',src:'',type:'string',map:'Active / inactive flag',status:'Active'},
    {name:'Role Status',src:'',type:'string',map:'Active / inactive flag',status:'Inactive'}
  ]},
  {id:'process-configuration',name:'Process Configuration',desc:'The lookups and rules the process runs on rather than data about any one order — reason codes, number series, approval routing.',fields:[
    {name:'Reason Codes',src:'',type:'string',map:'Config table',status:'Active'},
    {name:'Approval Workflow Mapping',src:'',type:'object',map:'Workflow routing config',status:'Active'},
    {name:'Number Series',src:'NRIV',type:'string',map:'Number range object',status:'Active'},
    {name:'Logistics Lookups',src:'',type:'object',map:'Config table — challan, transport, dispatch',status:'Active'},
    {name:'Inspection Requirement',src:'',type:'boolean',map:'Config flag per item / operation',status:'Active'},
    {name:'Storage Location Type Mapping',src:'',type:'object',map:'Config table — maps locations to types',status:'Active'}
  ]}
];
let selectedCfgCategoryId=null;
let cfgCategoryEditing=false;
let cfgCategoryDraft=null;
let cfgModelTested={};
let cfgModelEditing=false;
let cfgModelDraft=null;

// -- Configure: Context & Journey (ADT's real business journeys — same set as AI Executive) --
// -- `short` is what the category box shows: the stages of the process, in order, in one line
// that fits the box at any column width. `desc` is the full sentence, kept for the tooltip and
// anywhere with room for a sentence. The box previously rendered `desc` clamped to 34px behind
// a fade, which cut mid-sentence and read as broken. --
const cfgJourneyCategories=[
  {id:'O2C',name:'Order to Cash',short:'Order to fulfilment, invoice, payment',desc:"From customer order through fulfillment, invoicing, and payment collection."},
  {id:'P2P',name:'Procure to Pay',short:'Requisition to PO, receipt, payment',desc:'From requisitioning through purchase order, receipt, and invoice payment.'},
  /* Contract Creation lives here, not under Order to Cash. It was filed as O2C because it ends
     in a signed contract, but what it actually does is hire a named person and put them on
     payroll — the first half of this category's own sentence. Order to Cash is the client
     record and the store signup: opening an account. This is hiring into one. */
  {id:'H2R',name:'Hire to Retire',short:'Hiring to payroll, leave, offboarding',desc:'Full employee lifecycle: hiring, payroll, benefits, leave, offboarding.'},
  {id:'F2A',name:'Finance to Accounting',short:'Ledger to reconciliation, close, reporting',desc:'Financial transactions into the ledger — reconciliation, close, reporting.'}
];
let cfgJourneyCategoryFilter='';
// P2P and F2A have no journeys built out yet — locked for entity-facing roles until they do; Super Admin can still browse/author into them.
const entityLockedCategories=['P2P','F2A'];
// -- ENTITY ADMIN: journey activation + request queue (shared session-wide, not per-entity) --
// contract-creation ships pre-activated so Entity User lands on a working "Create Contract" action out of the box;
// payroll-creation/h2r-lifecycle start locked so the request -> approve -> unlock flow has something real to demo.
// user-master-data ships pre-activated alongside it: the client record it creates is what a deal is raised against, so locking it would strand Create Contract with nothing to point at.
// -- Which journeys this entity has switched on. Anything absent renders as a locked card with
// no run button, so a journey has to appear here to be reachable from AI Executive. Bhaiyaa's
// store journey is on because Bhaiyaa itself is activatedForEntity. --
// -- 'sub-contracting' is activated so the journey is reachable rather than wearing a Locked
// badge on both surfaces. Activation answers "may this entity use it", which is a different
// question from whether its automation is finished — that one is answered by status:'Draft' on
// the aiJourneys entry. Leaving it out would have locked the card for every role but Super
// Admin, and FR4 puts no such restriction on reading the journey. --
const entityJourneyActivation={'contract-creation':true,'user-master-data':true,'bhaiyaa-store-creation':true,'sub-contracting':true};
function formatEntityTimestamp(date){
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day=String(date.getDate()).padStart(2,'0');
  const month=months[date.getMonth()];
  const year=date.getFullYear();
  let hours=date.getHours();
  const minutes=String(date.getMinutes()).padStart(2,'0');
  const seconds=String(date.getSeconds()).padStart(2,'0');
  const ampm=hours>=12?'PM':'AM';
  hours=hours%12;if(hours===0)hours=12;
  return day+' '+month+' '+year+', '+hours+':'+minutes+':'+seconds+' '+ampm;
}
let entityRequestSeq=1;
const entityRequests=[
  {id:'REQ-'+(entityRequestSeq++),type:'journey-activation',refId:'h2r-lifecycle',label:'Activate Hire to Retire (H2R) Journey for Norrbridge Logistics',requestedBy:'Sanne de Vries (Entity Admin)',entity:'Norrbridge Logistics B.V.',clientId:'norrbridge-logistics',timestamp:'28 Jun 2026, 3:15:00 PM',status:'Pending',note:'Client wants the H2R journey live before their next hiring wave.'},
  {id:'REQ-'+(entityRequestSeq++),type:'journey-custom',refId:'custom-vendor-onboarding',label:'Custom journey request: Vendor Onboarding & Compliance',requestedBy:'Karan Mehta (Entity Admin)',entity:'Vantage Freight Pvt Ltd',clientId:'vantage-freight',timestamp:'20 Jun 2026, 10:05:00 AM',status:'Approved',note:'Approved and folded into their Contract Creation journey scope.'},
  {id:'REQ-'+(entityRequestSeq++),type:'journey-activation',refId:'payroll-creation',label:'Activate Payroll Creation Journey for Kaira Textiles',requestedBy:'Rohan Shah (Entity Admin)',entity:'Kaira Textiles Ltd',clientId:'kaira-textiles',timestamp:'12 Jun 2026, 5:40:00 PM',status:'Approved',note:''},
  {id:'REQ-'+(entityRequestSeq++),type:'manager-notify',refId:'PRO-5820',label:'Proposal approval — second opinion requested',requestedBy:'Entity User',entity:'Dhi Hyperlocal',clientId:'dhi-hyperlocal',timestamp:'05 Jul 2026, 11:40:00 AM',status:'Pending',note:"Not sure about the margin on this one — can you take a look before I approve?",contractRecordId:2}
];
function createEntityRequest(type,refId,label,note){
  const req={id:'REQ-'+(entityRequestSeq++),type,refId,label,requestedBy:portalRoleLabel(portalRole),entity:'Dhi Hyperlocal',clientId:'dhi-hyperlocal',timestamp:formatEntityTimestamp(new Date()),status:'Pending',note:note||''};
  entityRequests.unshift(req);
  return req;
}
function approveEntityRequest(id){
  const req=entityRequests.find(function(r){return r.id===id;});if(!req||req.status!=='Pending')return;
  req.status='Approved';
  if(req.type==='journey-activation')entityJourneyActivation[req.refId]=true;
  renderADTPage();
  showAiToast('Request Approved','"'+req.label+'" has been approved.');
}
function rejectEntityRequest(id){
  const req=entityRequests.find(function(r){return r.id===id;});if(!req||req.status!=='Pending')return;
  req.status='Rejected';
  renderADTPage();
  showAiToast('Request Rejected','"'+req.label+'" has been rejected.');
}
function acknowledgeManagerNotify(id){
  const req=entityRequests.find(function(r){return r.id===id&&r.type==='manager-notify';});if(!req||req.status!=='Pending')return;
  req.status='Approved';
  renderADTPage();
  showAiToast('Marked as reviewed','You\'ve acknowledged this note from your Entity User.');
}
// -- Notes flagged for a second opinion route into the linked deal's own Logs tab in Client & Contracts > Contracts, so the reviewer approves/rejects in the record itself rather than inline in the notes list. --
function resolveManagerNotify(id){
  const req=entityRequests.find(function(r){return r.id===id&&r.type==='manager-notify';});if(!req||req.status!=='Pending')return;
  if(!req.contractRecordId){acknowledgeManagerNotify(id);return;}
  navigatePage('contracts');
  openCtSidebar(req.contractRecordId,'logs');
}
let ctSecondOpinionRejectMode=false;
function ctApproveSecondOpinion(contractId){
  const req=entityRequests.find(function(r){return r.type==='manager-notify'&&r.contractRecordId===contractId&&r.status==='Pending';});if(!req)return;
  const c=contractsData.find(function(x){return x.id===contractId;});
  req.status='Approved';
  const now=new Date();
  const dateStr=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const timeStr=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
  (ctLogsData[contractId]=ctLogsData[contractId]||[]).unshift({date:dateStr,time:timeStr,user:'Entity Admin',status:'Proposal Approved',action:'Approved the proposal after reviewing the margin.'});
  (ctWorkflowData[contractId]=ctWorkflowData[contractId]||[]).unshift({title:'Proposal Approved',user:'Entity Admin',date:dateStr,time:timeStr,description:'Entity Admin approved the proposal flagged by '+req.requestedBy+'.'});
  if(c&&c.status==='Proposal Sent')c.status='Proposal Approved';
  ctSecondOpinionRejectMode=false;
  refreshCtSidebar();
  showAiToast('Proposal Approved','You approved the proposal for '+(c?c.empName:'this deal')+'.');
}
function ctRejectSecondOpinionOpen(contractId){
  ctSecondOpinionRejectMode=true;
  refreshCtSidebar();
  requestAnimationFrame(function(){const ta=document.getElementById('ct-reject-note-'+contractId);if(ta)ta.focus();});
}
function ctRejectSecondOpinionCancel(){
  ctSecondOpinionRejectMode=false;
  refreshCtSidebar();
}
function ctRejectSecondOpinionSubmit(contractId){
  const req=entityRequests.find(function(r){return r.type==='manager-notify'&&r.contractRecordId===contractId&&r.status==='Pending';});if(!req)return;
  const ta=document.getElementById('ct-reject-note-'+contractId);
  const note=ta?ta.value.trim():'';
  if(!note){showAiToast('Note required','Add a note explaining the rejection before submitting.');return;}
  const c=contractsData.find(function(x){return x.id===contractId;});
  req.status='Rejected';
  req.resolutionNote=note;
  const now=new Date();
  const dateStr=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const timeStr=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
  (ctLogsData[contractId]=ctLogsData[contractId]||[]).unshift({date:dateStr,time:timeStr,user:'Entity Admin',status:'Proposal Rejected',action:note});
  (ctWorkflowData[contractId]=ctWorkflowData[contractId]||[]).unshift({title:'Proposal Rejected',user:'Entity Admin',date:dateStr,time:timeStr,description:note});
  ctSecondOpinionRejectMode=false;
  refreshCtSidebar();
  showAiToast('Proposal Rejected','You rejected the proposal for '+(c?c.empName:'this deal')+'.');
}
// -- Journey activation: Entity User asks Entity Admin, and Entity Admin approves directly (no Super Admin hop) --
function approveJourneyRequestAsAdmin(id){
  const req=entityRequests.find(function(r){return r.id===id&&r.type==='journey-request-to-admin';});if(!req||req.status!=='Pending')return;
  req.status='Approved';
  entityJourneyActivation[req.refId]=true;
  renderADTPage();
  showAiToast('Journey Activated','"'+req.label+'" has been activated.');
}
// -- Entity Admin can also activate a locked journey directly from the AI Executive card, no request needed --
function activateJourneyAsAdmin(journeyId){
  const j=cfgJourneys.find(function(x){return x.id===journeyId;});if(!j)return;
  entityJourneyActivation[journeyId]=true;
  closeLockedJourneyModal();
  removeLockedToastsForJourney(journeyId);
  renderADTPage();
  showAiToast('Journey Activated','"'+j.name+'" is now active for your entity.');
}
function declineJourneyRequest(id){
  const req=entityRequests.find(function(r){return r.id===id&&r.type==='journey-request-to-admin';});if(!req||req.status!=='Pending')return;
  req.status='Rejected';
  renderADTPage();
  showAiToast('Request declined','"'+req.label+'" was not sent to Super Admin.');
}

/* == THE JOURNEY CATALOGUE: SUB-CONTRACTING, AND ONLY SUB-CONTRACTING ====================
   Order to Cash, Hire to Retire and Finance to Accounting hold no journeys here any more.
   Client Creation, Store Creation, Hire and Onboard, Payroll Creation, Hire to Retire and the
   three F2A roadmap entries were all removed from THIS catalogue, leaving Procure to Pay ->
   Sub-Contracting as the one configured journey. Their category boxes render empty and
   inactive (cfgCatBoxHTML), which is the honest reading of a catalogue with nothing filed
   under them.

   THE LIVE JOURNEYS ARE NOT DELETED — they are still in aiJourneys, still on the Journeys
   launcher, still runnable, and every run record still resolves its journey. That works
   because every lookup outside this page is written iJourneys.find(...) || cfgJourneys
   .find(...), so aiJourneys answers first and this array was only ever the fallback. My Runs,
   the manual run screens, the contract journey and the Store Operations board are all
   untouched. What changed is the Configure catalogue, not the product.

   cfgManualStep degrades safely for a journey no longer listed here: manualJourneyStepCatalog
   is consulted first and returns the real step, and the cfgJourneys.find fallback beneath it
   returns {} rather than throwing. == */
const cfgJourneys=[
  /* == FR4: PROCURE TO PAY -> SUB-CONTRACTING JOURNEY =====================================
     P2P holds exactly one journey now. Vendor Onboarding, PO to Goods Receipt and Supplier
     Invoice to Payment were removed: FR4.1 defines the hierarchy as Procure to Pay -> the
     configured Sub-Contracting Journey, and three empty roadmap placeholders standing beside it
     would make "select Procure to Pay and the journey is displayed" a list of four to choose
     from. Nothing was lost with them — all three carried `steps:[]`.

     `locked:false`, deliberately, and it is what makes FR4.2 work. A locked journey is opened by
     openLockedJourneyModal for Super Admin (see buildCfgContextJourneyHTML) rather than by
     viewCfgJourney, so marking this one locked would have put a configuration modal between the
     Super Admin and the eighteen steps they came to read. It is a CONFIGURED journey, not a
     roadmap one, so it is not locked — and it reaches the Journeys launcher through its
     aiJourneys entry instead of through the lockedRoadmapJourneys concat.

     EIGHTEEN STEPS, AND THE COUNT IS LOAD-BEARING. buildAIResponsibilitySplitHTML pairs these
     against aiJourneyEvents['sub-contracting'] POSITIONALLY and only when the two lengths match;
     at any other length the configured names are silently dropped and the split falls back to
     the event names. manualJourneyStepCatalog['sub-contracting'] is the third list that has to
     stay in step — it supplies the actor pill, the SLA and the agent flags. Change one, change
     all three. == */
  {id:'sub-contracting',name:'Sub-Contracting Journey',category:'P2P',desc:'Runs a sub-contracting transaction end to end — the request and its approval, the commercial PO, the outbound shipment on a delivery challan, the vendor return, and reconciliation to closure.',status:'Active',tags:['18 steps','Planning, Stores, Logistics, Finance'],
    steps:[
      {name:'Create Sub-Contracting Request (SCR)',src:'Planner',type:'rule'},
      {name:'SCR Approval / Return / Reject',src:'PMG Approver',type:'rule'},
      // -- 'rule', not 'eng'. FR5 configures two agents and neither runs this step, so calling it
      // an Engine step would put an Engine tag on work no engine performs. Same for steps 9 and
      // 10 below. Only step 17 has an agent behind it. --
      {name:'Receivable Product / WIP & BOM Processing',src:'Planner / System',type:'rule'},
      {name:'Create & Complete Sub-Contracting PO',src:'Buyer',type:'rule'},
      {name:'Approve / Return Commercial PO',src:'PO / PMG Approver',type:'rule'},
      {name:'Create Shipment & Reserve Material',src:'Planner',type:'rule'},
      {name:'Stores Outbound / Goods Issue',src:'Stores User',type:'rule'},
      {name:'Shipment Processing & Logistics Arrangement',src:'Logistics User',type:'rule'},
      {name:'Delivery Note Generation & Approval',src:'System / Delivery Note Approver',type:'rule'},
      {name:'Challan Generation',src:'Finance / F&A / IDT',type:'rule'},
      {name:'Security Gate Outward',src:'Security User',type:'rule'},
      {name:'Shipment Confirmation',src:'Planner / PMG',type:'rule'},
      {name:'Vendor ASN Creation',src:'Vendor',type:'rule'},
      {name:'QC Clearance of ASN',src:'QC User',type:'rule'},
      {name:'Security Gate Inward',src:'Security User',type:'rule'},
      {name:'Stores Material Receipt / IMR',src:'Stores User',type:'rule'},
      {name:'Material Reconciliation & Full Receipt Confirmation',src:'Finance / F&A',type:'eng'},
      {name:'Final Closure of Sub-Contracting Transaction',src:'Finance / F&A',type:'rule'}
    ]}
];

// -- Journey execution modes: additive layer. Agentic workflows stay intact and are used when enabled. --
const journeyAgentEnabled={};
const journeyStepAgentEnabled={};
let selectedManualRunId='MAN-1001';
let selectedSimulationJourneyId='contract-creation';
let manualJourneyBackPage='ai-executive';
let journeySimulationBackPage='cfg-context-journey';
let aiJourneyDetailBackPage=null;
let selectedEvidenceRunId='MAN-1001',selectedEvidenceStepIdx=1;
let selectedExceptionRunId='MAN-1002',selectedExceptionIdx=0;
let manualRunSeq=1004;
let notifiedRunIds=new Set();
// -- runId -> personaId of whoever a "Notify Owner" action targeted. Lets a notified persona see the run in their own My Tasks even when the event-source ownership heuristic in personaOwnedRunItems doesn't independently recognize them as the owner. --
let notifiedRunOwners={};
const cockpitDepartmentDirectory=[
  {id:'hr',name:'HR',summary:'Employee lifecycle, onboarding, attendance, payroll setup, and H2R approvals.',admin:{name:'Ananya Rao',email:'ananya.rao@dhi.com',title:'HR Team Lead',journeys:['Payroll Creation Journey','Hire to Retire (H2R) Journey']},associates:[{name:'Ramesh Patel',email:'ramesh.patel@dhi.com',title:'HR Associate',journeys:['Payroll Creation Journey']},{name:'Priya Sharma',email:'priya.sharma@dhi.com',title:'HR Associate',journeys:['Hire to Retire (H2R) Journey']},{name:'Aishi Verma',email:'aishi.verma@dhi.com',title:'HR Associate',journeys:['Hire and Onboard Journey','Payroll Creation Journey']}]},
  {id:'compliance',name:'Compliance',summary:'Compliance Hub checks, statutory rules, document readiness, and blockers.',admin:{name:'Kiran Iyer',email:'kiran.iyer@dhi.com',title:'Compliance Team Lead',journeys:['Hire and Onboard Journey','Hire to Retire (H2R) Journey']},associates:[{name:'Meera Nair',email:'meera.nair@dhi.com',title:'Compliance Associate',journeys:['Hire and Onboard Journey']},{name:'Devika Rao',email:'devika.rao@dhi.com',title:'Compliance Associate',journeys:['Hire to Retire (H2R) Journey']}]},
  {id:'finance',name:'Finance',summary:'Payroll approvals, disbursement authorization, payments, and GL posting.',admin:{name:'Nisha Kapoor',email:'nisha.kapoor@dhi.com',title:'Finance Team Lead',journeys:['Payroll Creation Journey','Payroll to GL Posting Journey']},associates:[{name:'Arun Menon',email:'arun.menon@dhi.com',title:'Finance Associate',journeys:['Payroll Creation Journey']},{name:'Fatima Khan',email:'fatima.khan@dhi.com',title:'Finance Associate',journeys:['Month-End Close & Reconciliation Journey']}]},
  {id:'operations',name:'Operations',summary:'Signed-contract readiness, onboarding handoff, payroll readiness, and escalations.',admin:{name:'Sanjay Kulkarni',email:'sanjay.kulkarni@dhi.com',title:'Ops Team Lead',journeys:['Hire and Onboard Journey','Hire to Retire (H2R) Journey']},associates:[{name:'Gojendra Singh',email:'gojendra.singh@dhi.com',title:'Ops Associate',journeys:['Hire and Onboard Journey']},{name:'Sneha Kulkarni',email:'sneha.kulkarni@dhi.com',title:'Ops Associate',journeys:['Hire to Retire (H2R) Journey']}]},
  {id:'legal',name:'Legal',summary:'Contract generation, clause review, signature readiness, and legal exceptions.',admin:{name:'Dev Rajan',email:'dev.rajan@dhi.com',title:'Legal / Contracts Team Lead',journeys:['Hire and Onboard Journey']},associates:[{name:'Neha Sharma',email:'neha.sharma@dhi.com',title:'Contracts Associate',journeys:['Hire and Onboard Journey']},{name:'Owen Brooks',email:'owen.brooks@dhi.com',title:'Legal Associate',journeys:['Vendor Onboarding Journey']}]},
  {id:'sales',name:'Sales',summary:'Deal desk, proposal drafting, client acceptance, and commercial approvals.',admin:{name:'Arjun Vaidya',email:'arjun.vaidya@dhi.com',title:'Sales Team Lead',journeys:['Hire and Onboard Journey']},associates:[{name:'Rajdeep Singh',email:'rajdeep.singh@dhi.com',title:'Account Manager',journeys:['Hire and Onboard Journey']},{name:'Anika Shah',email:'anika.shah@dhi.com',title:'Deal Desk Associate',journeys:['Hire and Onboard Journey']}]},
  {id:'admin',name:'Admin',summary:'Entity governance, activation requests, system setup, and operational ownership.',admin:{name:'Entity Admin',email:'entity.admin@dhi.com',title:'Entity Team Lead',journeys:['Hire and Onboard Journey','Payroll Creation Journey','Hire to Retire (H2R) Journey']},associates:[{name:'Rahul Mehta',email:'rahul.mehta@dhi.com',title:'Entity Coordinator',journeys:['Hire and Onboard Journey']},{name:'Deepak Joshi',email:'deepak.joshi@dhi.com',title:'Systems Coordinator',journeys:['Hire to Retire (H2R) Journey']}]}
];
const manualJourneyStepCatalog={
  /* == FR4.2 / FR4.3: THE ACTOR FOR EVERY STEP ============================================
     `ownerRole` is the Actor column of FR4.2, and it is what the step card renders in its owner
     pill (buildCfgJourneyDetailHTML). It is repeated here rather than read off the cfgJourneys
     `src` because these two lists answer different questions everywhere else in this file —
     `src` is who PERFORMS the step, ownerRole is who OWNS it — and for this journey they happen
     to be the same person. Kept in both so the pill does not go blank the first time a step is
     performed by a system on someone else's behalf.

     NO `modulePage` ON ANY STEP, so every card reads "Module: Not mapped". That is the truth,
     not an omission: none of the eighteen has a screen in this build yet, and pointing them at
     Orders and Billing or Products & Inventory to fill the line would be inventing a wiring that
     does not exist. Add the id here when the screen does.

     `agentCapable` is set only where the step is genuinely machine work — BOM explosion, the
     delivery note, the challan, the reconciliation. `approvalRequired` marks the three gates. A
     step with both reads Manual, because an approval is not something an agent may hold. == */
  'sub-contracting':[
    {name:'Create Sub-Contracting Request (SCR)',ownerRole:'Planner',manualAction:'Raise the SCR against the production order — material, quantity, vendor and required-by date.',sla:'4h',agentCapable:false},
    {name:'SCR Approval / Return / Reject',ownerRole:'PMG Approver',manualAction:'Review the SCR and approve, return for correction, or reject it.',sla:'8h',agentCapable:false,approvalRequired:true,exceptionType:'SCR returned'},
    // agentCapable:false on 3, 9 and 10 — FR5 configures no agent that can run any of them, and
    // the flag is what makes a step card claim "AI Agent" mode. Only step 17 keeps it.
    {name:'Receivable Product / WIP & BOM Processing',ownerRole:'Planner / System',manualAction:'Explode the BOM, resolve the receivable and issue items, and stage the WIP quantities.',sla:'2h',agentCapable:false,exceptionType:'BOM incomplete'},
    {name:'Create & Complete Sub-Contracting PO',ownerRole:'Buyer',manualAction:'Raise the sub-contracting PO from the approved SCR and complete its commercial terms.',sla:'8h',agentCapable:false},
    {name:'Approve / Return Commercial PO',ownerRole:'PO / PMG Approver',manualAction:'Check price, tax and payment terms against the rate contract, then approve or return.',sla:'8h',agentCapable:false,approvalRequired:true,exceptionType:'PO returned'},
    {name:'Create Shipment & Reserve Material',ownerRole:'Planner',manualAction:'Create the shipment against the PO and reserve the issue material from stock.',sla:'4h',agentCapable:false,exceptionType:'Insufficient stock'},
    {name:'Stores Outbound / Goods Issue',ownerRole:'Stores User',manualAction:'Pick the reserved material and post the goods issue out of the storage location.',sla:'4h',agentCapable:false},
    {name:'Shipment Processing & Logistics Arrangement',ownerRole:'Logistics User',manualAction:'Arrange transporter, vehicle and packing; capture weights, packages and the dispatch mode.',sla:'8h',agentCapable:false},
    {name:'Delivery Note Generation & Approval',ownerRole:'System / Delivery Note Approver',manualAction:'Generate the delivery note from the goods issue and route it for approval.',sla:'4h',agentCapable:false,approvalRequired:true,exceptionType:'Delivery note rejected'},
    {name:'Challan Generation',ownerRole:'Finance / F&A / IDT',manualAction:'Generate the sub-contracting challan against the delivery note, with tax treatment applied.',sla:'2h',agentCapable:false},
    {name:'Security Gate Outward',ownerRole:'Security User',manualAction:'Verify the challan and vehicle at the gate and record the outward movement.',sla:'1h',agentCapable:false},
    {name:'Shipment Confirmation',ownerRole:'Planner / PMG',manualAction:'Confirm the shipment has left and is in transit to the vendor.',sla:'2h',agentCapable:false},
    {name:'Vendor ASN Creation',ownerRole:'Vendor',manualAction:'Vendor raises the advance shipping notice for the processed material being returned.',sla:'24h',agentCapable:false,exceptionType:'ASN not received'},
    {name:'QC Clearance of ASN',ownerRole:'QC User',manualAction:'Inspect the returned material against the ASN and clear, hold or reject it.',sla:'8h',agentCapable:false,exceptionType:'QC rejection'},
    {name:'Security Gate Inward',ownerRole:'Security User',manualAction:'Verify the inbound vehicle and documents at the gate and record the inward movement.',sla:'1h',agentCapable:false},
    {name:'Stores Material Receipt / IMR',ownerRole:'Stores User',manualAction:'Receive the material into stores and post the inward material receipt.',sla:'4h',agentCapable:false},
    // -- The Reconciliation Explainer's step. `agentCapable` because an agent genuinely acts here;
    // `approvalRequired` because FR5.2 forbids it finishing the job — a Stores or Finance user
    // confirms the reason code. The pair is what renders this as human-gated agent work rather
    // than as automation. --
    {name:'Material Reconciliation & Full Receipt Confirmation',ownerRole:'Finance / F&A',manualAction:'Review the reconciliation note, confirm the reason code for any variance, and confirm full receipt.',sla:'8h',agentCapable:true,approvalRequired:true,exceptionType:'Quantity variance'},
    {name:'Final Closure of Sub-Contracting Transaction',ownerRole:'Finance / F&A',manualAction:'Settle the challan, close the PO and the SCR, and post the transaction to the ledger.',sla:'8h',agentCapable:false}
  ],
  // -- Every step agentCapable:true, so this journey reads Agent Enabled and carries the Agent
  // control like the others. It used to be all-false, which made it the one journey on the board
  // labelled Manual Mode — a description of the catalogue rather than of the journey, since the
  // client intake, the push to NewForce and the read-back of the created record are the same
  // agent work the store journey is credited for.
  //
  // `manualAction` stays on every step and is still the truth: it is what a person does when the
  // Agent toggle is off. Mode is DERIVED from these flags, never stated beside them — turn one
  // false and the badge drops to Hybrid on its own. --
  'user-master-data':[
    {name:'Master Data Intake',ownerRole:'Account Manager',modulePage:'master-data',manualAction:"Capture the client's legal, contact, and billing details on the NewForce intake form.",sla:'2h',agentCapable:true},
    {name:'Submission & Ingestion',ownerRole:'Account Manager',modulePage:'master-data',manualAction:'Submit the form to NewForce Solutions and wait for the submission to be read back.',sla:'2h',agentCapable:true,exceptionType:'Submission rejected'},
    {name:'Client Record Created',ownerRole:'Account Manager',modulePage:'master-data',manualAction:'Open the new client record in Clients & Stores > Clients and confirm it carries both ids.',sla:'2h',agentCapable:true}
  ],
  /* -- Without an entry here manualJourneySteps returns [], journeyModeLabel finds nothing
     agent-capable and the card reads "Manual Mode" — on a journey where three of the four stages
     are run by agents. The mode is always DERIVED from these steps, never stated beside them, so
     a journey with no catalogue entry does not read as unconfigured, it reads as manual. --
     Owners are the internal ones. Stage 1 is filled in by the merchant, but the Account Manager
     is who owns it inside the platform and whose board it lands on. -- */
  'bhaiyaa-store-creation':[
    {name:'Store Details',ownerRole:'Account Manager',modulePage:'stores',manualAction:"Capture the merchant's signup — owner and contact, store, business KYC, documents, bank details and address.",sla:'2h',agentCapable:false},
    {name:'KYC Verification',ownerRole:'Compliance Officer',modulePage:'compliance',manualAction:'Check the Aadhaar against UIDAI, match the name and mobile on record, and screen the merchant.',sla:'4h',agentCapable:true,exceptionType:'KYC mismatch'},
    {name:'Store Creation',ownerRole:'Account Manager',modulePage:'stores',manualAction:'Derive the plan and GST position from the turnover band, mint the Store ID, register on Bhaiyaa and provision.',sla:'4h',agentCapable:true,exceptionType:'Registration failure'},
    {name:'Store Created',ownerRole:'Account Manager',modulePage:'stores',manualAction:'Open the new store in All Stores and confirm it carries both ids.',sla:'2h',agentCapable:true}
  ],
  'contract-creation':[
    {name:'Deal & Employee Record',ownerRole:'Account Manager',modulePage:'contracts',manualAction:'Create or match the employee record and capture deal basics manually.',sla:'4h',agentCapable:true},
    {name:'Compliance Check',ownerRole:'Compliance Officer',modulePage:'compliance',manualAction:'Open Compliance Hub, check country rules, statutory obligations, tax rates, and work permit rules.',sla:'4h',agentCapable:true,exceptionType:'Missing compliance rule'},
    {name:'Proposal Drafted',ownerRole:'Account Manager',modulePage:'contracts',manualAction:'Draft commercial terms, pay rate, billing rate, margin, and compliance checklist manually.',sla:'4h',agentCapable:true},
    {name:'Proposal Approved',ownerRole:'Deal Manager',modulePage:'my-tasks',manualAction:'Approve or reject proposal terms with comments.',sla:'4h',agentCapable:false,approvalRequired:true},
    {name:'Client Acceptance',ownerRole:'Account Manager',modulePage:'contracts',manualAction:'Send proposal, track acceptance, and record client response.',sla:'8h',agentCapable:true},
    {name:'Contract Generated & Sent',ownerRole:'Legal / Contracts Manager',modulePage:'contracts',manualAction:'Generate contract, validate clauses, and send for signature.',sla:'4h',agentCapable:true},
    {name:'Signature Received',ownerRole:'Legal / Contracts Manager',modulePage:'contracts',manualAction:'Track the Docuseal countersignature request and confirm the employee has signed before routing for approval.',sla:'48h',agentCapable:true,exceptionType:'Signature timeout or bounce'},
    {name:'Signed Contract Approved',ownerRole:'Ops Manager',modulePage:'my-tasks',manualAction:'Verify signed contract against approved proposal and approve readiness.',sla:'4h',agentCapable:false,approvalRequired:true},
    {name:'Onboarding',ownerRole:'HR',modulePage:'direct',manualAction:'Run onboarding checklist, documents, reminders, and employee setup manually.',sla:'8h',agentCapable:true},
    {name:'Payroll Readiness',ownerRole:'HR',modulePage:'payroll',manualAction:'Validate bank details, tax ID, compensation mapping, and pay frequency manually.',sla:'4h',agentCapable:true,exceptionType:'Incomplete bank details'},
    /* The deposit gate had no manual counterpart, because this catalogue predates it. Appended at
       the END rather than inserted in journey order on purpose: run records carry currentStepIdx
       into this array, and inserting at position 6 would silently move every step after it under
       runs already in flight. Order here is not the journey's order — cfgToManualStepIndexMap is
       what states that — so the safe position and the correct one are the same position. */
    {name:'Deposit Invoice Cleared',ownerRole:'Finance Approver',modulePage:'payments',manualAction:'Raise the deposit invoice against the signed agreement and confirm the receipt has cleared before releasing the placement.',sla:'48h',agentCapable:false,exceptionType:'Deposit unpaid past terms'}
  ],
  'payroll-creation':[
    {name:'Payroll Run Initiated',ownerRole:'HR',modulePage:'payroll',manualAction:'Select payroll scope, employee list, and pay period manually.',sla:'2h',agentCapable:true},
    {name:'Attendance Capture',ownerRole:'HR',modulePage:'all-timesheet',manualAction:'Open timesheets, check attendance, leave, overtime, and enter payable days manually.',sla:'4h',agentCapable:true,exceptionType:'Timesheet discrepancy'},
    {name:'Salary Calculation',ownerRole:'HR',modulePage:'payroll',manualAction:'Calculate gross pay, deductions, statutory rates, and net pay manually.',sla:'4h',agentCapable:true,exceptionType:'Salary mismatch'},
    {name:'Payroll Approved',ownerRole:'Finance Approver',modulePage:'my-tasks',manualAction:'Review calculation and approve or reject payroll.',sla:'4h',agentCapable:false,approvalRequired:true},
    {name:'Salary Slip Generated',ownerRole:'HR',modulePage:'payroll',manualAction:'Create and store payslip manually for employee review.',sla:'4h',agentCapable:true},
    {name:'Disbursement Authorised',ownerRole:'Finance Approver',modulePage:'payments',manualAction:'Authorize fund release after reviewing payment summary.',sla:'4h',agentCapable:false,approvalRequired:true},
    {name:'Payment Disbursed',ownerRole:'Finance Approver',modulePage:'payments',manualAction:'Process bank transfer or card-load file and record confirmation.',sla:'4h',agentCapable:true,exceptionType:'Failed disbursement'},
    {name:'ERP Write-back',ownerRole:'Finance Approver',modulePage:'payments',manualAction:'Post payroll accounting entries and attach GL confirmation.',sla:'8h',agentCapable:true,exceptionType:'Failed ERP posting'}
  ],
  'h2r-lifecycle':[
    {name:'Employee Record Created',ownerRole:'HR',modulePage:'direct',manualAction:'Create employee profile and verify duplicate records.',sla:'4h',agentCapable:true},
    {name:'Document Collection',ownerRole:'HR',modulePage:'direct',manualAction:'Send country-specific document checklist and validate uploads manually.',sla:'8h',agentCapable:true,exceptionType:'Expired document'},
    {name:'Work Permit Check',ownerRole:'Compliance Officer',modulePage:'compliance',manualAction:'Check work authorization and immigration requirements in Compliance Hub.',sla:'4h',agentCapable:true,exceptionType:'Work permit issue'},
    {name:'Country Compliance Fetch',ownerRole:'Compliance Officer',modulePage:'compliance',manualAction:'Collect tax bands, social security rates, benefits, and notice-period rules.',sla:'4h',agentCapable:true},
    {name:'Benefits Enrollment',ownerRole:'HR',modulePage:'direct',manualAction:'Enroll employee in mandatory benefits and track provider confirmation.',sla:'8h',agentCapable:true},
    {name:'Payroll Setup',ownerRole:'HR',modulePage:'payheads',manualAction:'Configure payheads, deductions, allowances, and pay frequency manually.',sla:'4h',agentCapable:true},
    {name:'Leave Policy Setup',ownerRole:'HR',modulePage:'leave-policies',manualAction:'Assign applicable leave policy or create a missing policy.',sla:'4h',agentCapable:true},
    {name:'HR Approval',ownerRole:'HR Manager',modulePage:'my-tasks',manualAction:'Approve or reject any deviation from standard setup.',sla:'8h',agentCapable:false,approvalRequired:true},
    {name:'Active Employment',ownerRole:'HR',modulePage:'direct',manualAction:'Monitor active employment and trigger salary revision, extension, or role change.',sla:'Ongoing',agentCapable:true},
    {name:'Exit Trigger',ownerRole:'HR',modulePage:'direct',manualAction:'Capture resignation/contract end and start offboarding.',sla:'4h',agentCapable:true},
    {name:'Final Settlement',ownerRole:'Finance Approver',modulePage:'payments',manualAction:'Calculate and approve outstanding salary, leave encashment, gratuity, and deductions.',sla:'4h',agentCapable:true,exceptionType:'Salary mismatch'},
    {name:'Offboarding',ownerRole:'HR',modulePage:'direct',manualAction:'Complete offboarding checklist, letters, access revocation, and closure.',sla:'8h',agentCapable:true}
  ]
};
const cfgToManualStepIndexMap={
  'user-master-data':[0,1,2],
  // One catalogue step per journey step, in the same order — the store journey grew in one piece.
  'bhaiyaa-store-creation':[0,1,2,3],
  /* Nine config steps now, so nine entries. Not in ascending order, and it should not be: this
     maps journey position -> catalogue position, and the catalogue is stored in the order it grew
     in. Deposit due is the appended step 10; Client signing is 5 and lands before it. Catalogue
     step 7 (Signed Contract Approved) has no entry of its own because Worker signing covers the
     signature and the approval of it in one stage. */
  'contract-creation':[0,1,2,3,5,10,6,8,9],
  'payroll-creation':[0,1,2,3,4,7],
  'h2r-lifecycle':[0,3,6,7,11]
};
function cfgManualStepIndex(journeyId,cfgIdx){
  const map=cfgToManualStepIndexMap[journeyId];
  return map&&typeof map[cfgIdx]==='number'?map[cfgIdx]:cfgIdx;
}
function cfgManualStep(journeyId,cfgIdx){
  const catalogStep=manualJourneySteps(journeyId)[cfgManualStepIndex(journeyId,cfgIdx)];
  if(catalogStep)return catalogStep;
  const j=cfgJourneys.find(function(x){return x.id===journeyId;});
  const rawStep=j&&j.steps[cfgIdx];
  return rawStep?{ownerRole:rawStep.ownerRole,modulePage:rawStep.modulePage,sla:rawStep.sla,agentCapable:rawStep.agentCapable,approvalRequired:rawStep.approvalRequired}:{};
}
const manualJourneyRuns=[
  {runId:'MAN-1001',journeyId:'contract-creation',subject:'Rashi Singh',entity:'Dhi Hyperlocal',mode:'Manual',currentStepIdx:1,status:'Blocked',slaRisk:'High',blockedReason:'Netherlands work permit rule missing in Compliance Hub',escalation:'Entity Admin in 1h',startedAt:'Today 09:10 AM',manualHours:3.2,agentEstimateHours:.4,createdBy:'account-manager',contractRecordId:2,exceptions:[{type:'Missing compliance rule',ownerRole:'Compliance Officer',status:'Open',suggestedResolution:'Add Netherlands work permit rule or attach override evidence.'}],audit:['Deal record created by Account Manager','Compliance Hub opened 4 times','Exception raised for missing work permit rule']},
  {runId:'MAN-1002',journeyId:'payroll-creation',subject:'Anika Shah',entity:'Dhi Hyperlocal',mode:'Manual',currentStepIdx:2,status:'Active',slaRisk:'Medium',blockedReason:'Timesheet and leave totals need reconciliation',escalation:'None',startedAt:'Today 10:35 AM',manualHours:2.4,agentEstimateHours:.3,exceptions:[{type:'Timesheet discrepancy',ownerRole:'HR',status:'Open',suggestedResolution:'Reconcile 22 present days with 2 approved leave days before salary calculation.'}],audit:['Payroll run initiated manually','Timesheet module visited 3 times','Attendance days entered manually']},
  {runId:'MAN-1003',journeyId:'h2r-lifecycle',subject:'Sofia Romano',entity:'Dhi Hyperlocal',mode:'Hybrid',currentStepIdx:7,status:'Waiting Approval',slaRisk:'Low',blockedReason:'HR Manager approval required for leave-policy deviation',escalation:'None',startedAt:'Yesterday 04:20 PM',manualHours:5.1,agentEstimateHours:1.2,exceptions:[],audit:['Employee record created','Compliance profile attached','Leave policy deviation routed to HR Manager']}
];
// -- PERSISTENCE: contracts and their journeys are created live during a demo/simulation, so they need to survive a refresh instead of resetting to the seed data every time. Snapshot the mutable arrays to localStorage after every render and rehydrate them before the first render. --
const APP_STATE_KEY='opendhi_mockup_state_v1';
function persistAppState(){
  try{
    localStorage.setItem(APP_STATE_KEY,JSON.stringify({
      contractsData:contractsData,manualJourneyRuns:manualJourneyRuns,
      // aiAutomationRuns was the one live store left out, so every Payroll and H2R run a user
      // completed was lost on reload while the manual runs beside it survived.
      aiAutomationRuns:aiAutomationRuns,
      ctLogsData:ctLogsData,ctWorkflowData:ctWorkflowData,
      directEmpData:directEmpData,notifData:notifData,
      entityRequests:entityRequests,entityRequestSeq:entityRequestSeq,
      notifiedRunIds:Array.from(notifiedRunIds),notifiedRunOwners:notifiedRunOwners,
      manualRunSeq:manualRunSeq,liveRunSeq:liveRunSeq,
      // -- The Account Manager's own book of work. Two stores, and both are needed: amDeals is
      // where each engagement has reached, amExtraLog is what was typed and sent while getting it
      // there. Saving only the first would move a record to step 4 and lose the note that
      // justified it, which reads as data loss rather than a reset.
      //
      // (Not covered by the exclusion documented above masterData: that one is a cache of server
      // state, and a cached copy outliving the server's copy is worse than no cache. These two
      // have no server behind them, so nothing can go stale underneath them.)
      amDeals:amDeals,amExtraLog:amExtraLog,
      // Where the user was, not just what they had done. Coming back to a filtered list with the
      // right record open is what a person expects of a tool they work in daily.
      amPipelineStage:amPipelineStage,amSelectedDealId:amSelectedDealId,
      amDealTab:amDealTab,amPage:amPage,
      // -- Each deal's own run of the Hire and Onboard journey. The journey owns what can and
      // cannot be written down (a live DOM node and a page's timer ids cannot), so it does its own
      // stripping in ccjSaveRuns rather than this function guessing at the shape of a run. --
      ccjRuns:(typeof ccjSaveRuns==='function'?ccjSaveRuns():null)
    }));
  }catch(e){}
}
function loadAppState(){
  try{
    const raw=localStorage.getItem(APP_STATE_KEY);
    if(!raw)return;
    const s=JSON.parse(raw);
    const replaceArray=function(arr,saved){if(Array.isArray(saved)){arr.length=0;saved.forEach(function(x){arr.push(x);});}};
    const replaceObject=function(obj,saved){if(saved&&typeof saved==='object'){Object.keys(obj).forEach(function(k){delete obj[k];});Object.assign(obj,saved);}};
    replaceArray(contractsData,s.contractsData);
    replaceArray(manualJourneyRuns,s.manualJourneyRuns);
    replaceArray(directEmpData,s.directEmpData);
    replaceArray(notifData,s.notifData);
    replaceArray(entityRequests,s.entityRequests);
    replaceObject(ctLogsData,s.ctLogsData);
    replaceObject(ctWorkflowData,s.ctWorkflowData);
    replaceObject(aiAutomationRuns,s.aiAutomationRuns);
    replaceObject(notifiedRunOwners,s.notifiedRunOwners);
    if(Array.isArray(s.notifiedRunIds))notifiedRunIds=new Set(s.notifiedRunIds);
    if(typeof s.entityRequestSeq==='number')entityRequestSeq=s.entityRequestSeq;
    if(typeof s.manualRunSeq==='number')manualRunSeq=s.manualRunSeq;
    if(typeof s.liveRunSeq==='number')liveRunSeq=s.liveRunSeq;
    replaceArray(amDeals,s.amDeals);
    replaceObject(amExtraLog,s.amExtraLog);
    /* -- Restoring where the user was, which is the half that has to be defended.
       Saved data describes the session it was written in; the code, the seed records and the
       stage list all move underneath it between releases. So each of these is checked against
       what exists NOW rather than trusted, and a value that no longer resolves is dropped in
       favour of the default. The failure it prevents is not a crash — it is a screen that opens
       filtered to nothing, or with a drawer over a record that is gone, and gives the user no way
       to tell that from having lost their work. -- */
    if(typeof s.amPipelineStage==='string'
       &&(s.amPipelineStage===''||amStageById(s.amPipelineStage)))amPipelineStage=s.amPipelineStage;
    // A selection is only restorable while the record it names is still there.
    if(s.amSelectedDealId!=null
       &&amDeals.some(function(d){return d.id===s.amSelectedDealId;}))amSelectedDealId=s.amSelectedDealId;
    if(['basic-details','logs','workflow','client-view'].indexOf(s.amDealTab)>-1)amDealTab=s.amDealTab;
    // Clamped, not trusted: the filter above decides how many pages there are, and a stored page
    // beyond the end would open an empty table on a list that is not empty.
    if(typeof s.amPage==='number'&&isFinite(s.amPage)){
      const pages=Math.max(1,Math.ceil(amFilteredDeals().length/AM_PAGE_SIZE));
      amPage=Math.min(Math.max(1,Math.floor(s.amPage)),pages);
    }
    // Restored into the store, not made active: a reload lands on a page, not inside a run, and
    // ccjRun stays null until a deal is actually opened.
    if(typeof ccjLoadRuns==='function')ccjLoadRuns(s.ccjRuns);
    // -- Demo reset: contracts created via "Simulate: New/Existing Employee" (tagged record.simulated, or legacy runs from before that tag existed) are scratch data for re-running the walkthrough, so purge them on every load instead of letting them pile up as duplicates. --
    const legacySimulatedNames=['Rohan Verma','New Employee','Verma'];
    for(let i=contractsData.length-1;i>=0;i--){
      const c=contractsData[i];
      if(c.simulated||(!('simulated' in c)&&c.manualRunId&&legacySimulatedNames.indexOf(c.empName)>-1)){
        contractsData.splice(i,1);
        for(let j=manualJourneyRuns.length-1;j>=0;j--){if(manualJourneyRuns[j].contractRecordId===c.id)manualJourneyRuns.splice(j,1);}
        delete ctLogsData[c.id];delete ctWorkflowData[c.id];
      }
    }
    // -- Demo reset: the RUN-4002 / contract-5 "missing country configuration" walkthrough is meant to be re-demoable on every refresh, so force it back to its unresolved seed state regardless of what got persisted. --
    notifiedRunIds.delete('RUN-4002');
    delete notifiedRunOwners['RUN-4002'];
    // Now that aiAutomationRuns persists, the run itself has to be forced back too — otherwise
    // resolving the exception once would retire this walkthrough for good.
    const demoRun=(aiAutomationRuns['h2r-lifecycle']||[]).find(function(r){return r.runId==='RUN-4002';});
    if(demoRun){
      demoRun.currentStepIdx=3;demoRun.status='Exception';demoRun.lastActivity='2 hours ago';
      demoRun.exceptionNote='Compliance Hub could not return statutory requirements for France — missing country configuration.';
    }
    const demoContract=contractsData.find(function(c){return c.id===5;});
    if(demoContract){
      demoContract.countryOfOp='';
      demoContract.missingCountryConfig=true;
      demoContract.complianceItems=[{item:'Country Configuration — France',note:'Compliance Hub could not return statutory requirements for France.',status:'Missing',doc:null}];
    }
    ctLogsData[5]=[{date:'2026-07-20',time:'09:30:00',user:'AI Agent',status:'Submitted',action:'Contract submitted; Compliance Hub could not return statutory requirements for France — missing country configuration.'}];
    ctWorkflowData[5]=[{title:'Compliance Exception Raised',user:'AI Agent',date:'2026-07-20',time:'09:30:00',description:'Compliance Hub could not return statutory requirements for France — missing country configuration.'}];
    // -- Demo reset: the PRO-5820 "second opinion" note and its linked Rashi Singh deal (contract id 2) are meant to be re-demoable on every refresh, so force both back to their unresolved seed state regardless of what got persisted. --
    const demoNote=entityRequests.find(function(r){return r.type==='manager-notify'&&r.refId==='PRO-5820';});
    if(demoNote){demoNote.status='Pending';demoNote.contractRecordId=2;delete demoNote.resolutionNote;}
    const demoDeal=contractsData.find(function(c){return c.id===2;});
    if(demoDeal)demoDeal.status='Proposal Sent';
    ctLogsData[2]=[
      {date:'2026-07-05',time:'11:40:00',user:'Entity User',status:'Second Opinion Requested',action:'Not sure about the margin on this one — can you take a look before I approve?'},
      {date:'2026-06-06',time:'15:05:48',user:'Admin',status:'Proposal Sent',action:'EOR proposal sent to employee for review.'},
      {date:'2026-06-06',time:'14:00:00',user:'Manager',status:'Quotation Approved',action:'Quotation approved by manager. Proceeding to proposal.'},
      {date:'2026-06-06',time:'13:00:00',user:'Admin',status:'Submitted',action:'Contract submitted for review.'}
    ];
    ctWorkflowData[2]=[
      {title:'Second Opinion Requested',user:'Entity User',date:'2026-07-05',time:'11:40:00',description:'Entity User flagged the proposal margin for a second opinion before approving.'},
      {title:'Proposal Sent',user:'Admin',date:'2026-06-06',time:'15:05:48',description:'EOR proposal dispatched to Rashi Singh for review and acceptance.'},
      {title:'Quotation Approved',user:'Manager',date:'2026-06-06',time:'14:00:00',description:'Quotation approved. Proposal stage initiated.'},
      {title:'Contract Submitted',user:'Admin',date:'2026-06-06',time:'13:00:00',description:'EOR contract submitted for review.'}
    ];
  }catch(e){}
}
function manualJourneySteps(journeyId){return manualJourneyStepCatalog[journeyId]||[];}
// -- Keyed by the `modulePage` ids the journey definitions carry, which still name the retired
// pages; the labels name where those ids now land. resolvePageAlias does the routing half. --
const manualModulePageLabels={contracts:'Contracts',compliance:'Compliance Hub','my-tasks':'My Tasks',direct:'Employees',payroll:'Payroll','all-timesheet':'Timesheet',payments:'Payments',payheads:'Payheads','leave-policies':'Leave Policies'};
function manualModuleLabel(pageId){return manualModulePageLabels[pageId]||getPageTitle(pageId)||pageId;}
function manualStepOwnerDeptId(ownerRole){
  const role=ownerRole||'';
  if(/HR/i.test(role))return 'hr';
  if(/Compliance/i.test(role))return 'compliance';
  if(/Finance/i.test(role))return 'finance';
  if(/Ops/i.test(role))return 'operations';
  if(/Legal|Contract/i.test(role))return 'legal';
  if(/Account|Deal/i.test(role))return 'sales';
  return 'admin';
}
function manualStepOwnerName(ownerRole){
  if(!ownerRole)return 'the responsible owner';
  const dept=cockpitDepartmentDirectory.find(function(d){return d.id===manualStepOwnerDeptId(ownerRole);});
  if(!dept)return ownerRole;
  const people=[dept.admin].concat(dept.managers||[],dept.associates||[]);
  const exact=people.find(function(p){return p.title===ownerRole;});
  return (exact||dept.admin).name;
}
/* == RUN ATTRIBUTION ====================================================================
   Who started a run, in the one form every store agrees on. An Entity User is their persona
   (the id manual step ownership is already keyed on); Super Admin and Entity Admin are their
   role. Without this stamped at creation, "runs I started" is not a question the data can
   answer at all — which is why the run lists could only ever filter by pending action. == */
function currentActorId(){return portalRole==='entity-user'?activePersonaId:portalRole;}
// -- `startedBy` is deliberately separate from `createdBy`. createdBy is the persona a deal is
// booked to — it drives notification routing (pushRunNotification) and the Deal Desk's Open
// Deals count, and an admin-created deal is booked to Account Manager on purpose. startedBy is
// the human who actually clicked, which is the only thing "runs I started" can honestly mean. --
function runStartedBy(r){return r.startedBy||r.createdBy||'';}
// -- My Runs listing filters. Status is owned by the stat tiles, which carry counts, so it is
// kept out of the dropdowns; journey and mode are the two cuts the tiles cannot make. --
let mrJourneyFilter='',mrModeFilter='',mrStatusFilter='',mrSearchQuery='';
function actorLabel(id){
  if(!id)return 'Unknown';
  if(id==='super-admin')return 'Super Admin';
  if(id==='entity-admin')return 'Entity Admin';
  const p=enterprisePersonas.find(function(x){return x.id===id;});
  return p?p.label:id;
}
function getManualRun(runId){return manualJourneyRuns.find(function(r){return r.runId===runId;});}
// -- MANUAL MODE: which Contracts-sidebar tab a contract-creation step's "act on this" surface lives on, so My Tasks/queue "Open" actions land the owner on the right tab of the real record instead of a generic run page. --
const manualStepTabMap={'Deal & Employee Record':'basic-details','Compliance Check':'compliance','Proposal Drafted':'commercial-terms','Proposal Approved':'commercial-terms','Client Acceptance':'workflow','Contract Generated & Sent':'workflow','Signature Received':'workflow','Signed Contract Approved':'workflow'};
function ctTabForManualStep(step){return (step&&manualStepTabMap[step.name])||null;}
function manualLinkedRunForContract(contractId){return manualJourneyRuns.find(function(r){return r.contractRecordId===contractId&&r.status!=='Completed';});}
// -- Agent Mode is the default experience: a journey is agent-enabled unless the admin explicitly toggles it off. --
function isJourneyAgentEnabled(journeyId){return journeyAgentEnabled[journeyId]!==false;}
function isStepAgentEnabled(journeyId,idx){
  const step=manualJourneySteps(journeyId)[idx];
  if(!step||step.approvalRequired)return false;
  const overrides=journeyStepAgentEnabled[journeyId]||{};
  if(Object.prototype.hasOwnProperty.call(overrides,idx))return !!overrides[idx];
  return isJourneyAgentEnabled(journeyId)&&!!step.agentCapable;
}
function journeyModeLabel(journeyId){
  const steps=manualJourneySteps(journeyId);
  const capable=steps.map(function(s,i){return {step:s,idx:i};}).filter(function(x){return x.step.agentCapable&&!x.step.approvalRequired;});
  if(!capable.length)return 'Manual Mode';
  const enabled=capable.filter(function(x){return isStepAgentEnabled(journeyId,x.idx);}).length;
  if(enabled===0)return 'Manual Mode';
  if(enabled===capable.length)return 'Agent Enabled';
  return 'Hybrid';
}
function toggleJourneyAgent(journeyId){
  journeyAgentEnabled[journeyId]=!isJourneyAgentEnabled(journeyId);
  if(!journeyStepAgentEnabled[journeyId])journeyStepAgentEnabled[journeyId]={};
  manualJourneySteps(journeyId).forEach(function(st,i){if(st.agentCapable&&!st.approvalRequired)journeyStepAgentEnabled[journeyId][i]=journeyAgentEnabled[journeyId];});
  renderADTPage();
}
function toggleJourneyStepAgent(journeyId,idx){
  const st=manualJourneySteps(journeyId)[idx];if(!st||st.approvalRequired||!st.agentCapable)return;
  if(!journeyStepAgentEnabled[journeyId])journeyStepAgentEnabled[journeyId]={};
  journeyStepAgentEnabled[journeyId][idx]=!isStepAgentEnabled(journeyId,idx);
  renderADTPage();
}
function openJourneySimulation(journeyId){
  selectedSimulationJourneyId=journeyId;
  if(page!=='journey-simulation')journeySimulationBackPage=page||'cfg-context-journey';
  page='journey-simulation';
  renderADTPage();
}
function backFromJourneySimulation(){navigatePage(journeySimulationBackPage||'cfg-context-journey');}
function startManualJourneyRun(journeyId){
  const j=aiJourneys.find(function(x){return x.id===journeyId;})||cfgJourneys.find(function(x){return x.id===journeyId;});
  // createdBy: the only manual-run creator that was never stamped, which left every hand-started
  // run unattributable while the two contract paths recorded theirs.
  const run={runId:'MAN-'+(manualRunSeq++),journeyId:journeyId,subject:journeyId==='payroll-creation'?'Anika Shah':journeyId==='h2r-lifecycle'?'Sofia Romano':'Rashi Singh',entity:'Dhi Hyperlocal',mode:journeyModeLabel(journeyId),currentStepIdx:0,status:'Active',slaRisk:'Low',blockedReason:'None',escalation:'None',startedAt:'Just now',createdBy:currentActorId(),startedBy:currentActorId(),manualHours:0,agentEstimateHours:0,exceptions:[],audit:['Manual run started for '+(j?j.name:journeyId)+' by '+actorLabel(currentActorId())]};
  manualJourneyRuns.unshift(run);
  selectedManualRunId=run.runId;
  manualJourneyBackPage=page||'ai-executive';
  page='manual-journey-run';
  renderADTPage();
}
function backFromManualJourneyRun(){navigatePage(manualJourneyBackPage||'ai-executive');}
function completeManualStep(runId){
  const run=getManualRun(runId);if(!run)return;
  if((run.exceptions||[]).some(function(e){return e.status==='Open';})){
    run.status='Blocked';run.slaRisk='High';
    if(typeof showAiToast==='function')showAiToast('Resolve blocker first','This journey run has an open exception that must be cleared before the current step can be completed.');
    renderADTPage();
    return;
  }
  const steps=manualJourneySteps(run.journeyId);
  const st=steps[run.currentStepIdx];
  if(st)run.audit.unshift(st.name+' completed by '+st.ownerRole);
  run.manualHours+=(st&&st.sla==='Ongoing')?0:.8;
  if(run.currentStepIdx<steps.length-1){
    run.currentStepIdx++;run.status='Active';run.slaRisk=run.currentStepIdx%3===0?'Medium':'Low';
    const nextStep=steps[run.currentStepIdx];
    const nextPersonaId=nextStep&&manualStepOwnerPersonaId(nextStep.ownerRole);
    if(nextPersonaId)pushRunNotification(run.runId,nextPersonaId,'"'+nextStep.name+'" is waiting on you for '+run.subject+'.');
    if(run.journeyId==='contract-creation'&&nextStep&&nextStep.name==='Onboarding')ensureDirectEmpForOnboarding(run);
    if(run.journeyId==='contract-creation'&&nextStep&&nextStep.name==='Payroll Readiness')ensurePayrollEmpForReadiness(run);
  }
  else{run.status='Completed';run.slaRisk='Low';run.blockedReason='None';}
  if(st){
    const now=new Date();
    const dateStr=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    const timeStr=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
    if(run.contractRecordId){
      (ctLogsData[run.contractRecordId]=ctLogsData[run.contractRecordId]||[]).unshift({date:dateStr,time:timeStr,user:st.ownerRole,status:run.status,action:st.name+' completed by '+st.ownerRole+' for '+run.subject+'.'});
      (ctWorkflowData[run.contractRecordId]=ctWorkflowData[run.contractRecordId]||[]).unshift({title:st.name+' Completed',user:st.ownerRole,date:dateStr,time:timeStr,description:st.ownerRole+' completed "'+st.name+'" for '+run.subject+'.'});
    }
    const payrollEmp=payrollEmpData.find(function(e){return e.readinessRunId===run.runId;});
    if(payrollEmp){
      (prLogsData[payrollEmp.id]=prLogsData[payrollEmp.id]||[]).unshift({date:dateStr,time:timeStr,user:st.ownerRole,status:run.status,action:st.name+' completed by '+st.ownerRole+' for '+run.subject+'.'});
      (prWorkflowData[payrollEmp.id]=prWorkflowData[payrollEmp.id]||[]).unshift({title:st.name+' Completed',user:st.ownerRole,date:dateStr,time:timeStr,description:st.ownerRole+' completed "'+st.name+'" for '+run.subject+'.'});
    }
  }
  renderADTPage();
}
function raiseManualException(runId){
  const run=getManualRun(runId);if(!run)return;
  const st=manualJourneySteps(run.journeyId)[run.currentStepIdx]||{};
  const ex={type:st.exceptionType||'Approval breach',ownerRole:st.ownerRole||'Entity Admin',status:'Open',suggestedResolution:'Review evidence, add correction note, and re-run the step validation.'};
  run.exceptions.unshift(ex);
  run.status='Blocked';run.slaRisk='High';run.blockedReason=ex.type;run.escalation='Entity Admin in 2h';run.audit.unshift('Exception raised: '+ex.type);
  renderADTPage();
}
function resolveManualException(runId,idx,resolution){
  const run=getManualRun(runId);if(!run||!run.exceptions[idx])return;
  const title=typeof resolution==='string'?resolution:(resolution&&resolution.title)||'Manual resolution completed';
  run.exceptions[idx].status='Resolved';
  run.exceptions[idx].resolutionPath=title;
  if(resolution&&typeof resolution==='object'){
    run.exceptions[idx].resolutionNote=resolution.note||'';
    run.exceptions[idx].evidenceChecks=resolution.evidenceChecks||0;
    run.exceptions[idx].resolvedAt=new Date().toLocaleString();
  }
  run.audit.unshift('Exception resolved: '+run.exceptions[idx].type+' via '+title+((resolution&&resolution.note)?' - '+resolution.note:''));
  if(!run.exceptions.some(function(e){return e.status==='Open';})){run.status='Active';run.blockedReason='None';run.slaRisk='Low';run.escalation='None';}
  renderADTPage();
}
function resolveComplianceStepFromDashboard(runId,note){
  const run=getManualRun(runId);if(!run)return;
  const beforeIdx=run.currentStepIdx;
  if(note)run.audit.unshift('Compliance note: '+note);
  completeManualStep(runId);
  if(run.currentStepIdx!==beforeIdx){
    const stepName=(manualJourneySteps(run.journeyId)[run.currentStepIdx]||{}).name||'the next step';
    if(run.createdBy)pushRunNotification(run.runId,run.createdBy,'Compliance Check complete for '+run.subject+' — now at "'+stepName+'".');
    if(typeof showAiToast==='function')showAiToast('Compliance Check resolved',run.subject+' has moved to the next step.');
  }
}

// -- Configure: Agents — one per AI-driven step across Contract Creation / Payroll Creation / H2R Lifecycle --
/* == FR5: THE AGENT CATALOGUE — TWO AGENTS, BOTH SUB-CONTRACTING ==========================
   The fourteen agents that stood here are removed. What went with them, stated plainly because
   it is visible on screens that still work: Hire and Onboard, Payroll Creation, Hire to Retire
   and Store Creation are still on the Journeys launcher and still runnable, but no agent is
   wired into any of them now — their Responsibility Split bands read as fully manual, their
   step cards carry no agent chip, and cfgRecommendedAgentForStep finds nothing to suggest.
   findCfgAgentByName returns undefined for every name their steps still cite, which is handled
   (the callers all guard) but means a step whose `source` names an agent no longer resolves to
   a skill.md. Putting an agent back is an entry in this array with a matching name.

   BOTH AGENTS ARE ADVISORY OR READ-ONLY, and that is the whole shape of FR5. Neither writes to
   a source system. The Query bot cannot write at all; the Explainer may recommend and must not
   confirm. Their guardrails say so, and the guardrail is what the tile's pill is derived from —
   'Fully automated' renders Unattended, anything else renders Human in loop. == */
const cfgAgents=[
  /* -- FR5.1. `journeys:['sub-contracting']` is the screen-level link: this agent serves the
     journey without performing any of its eighteen steps, because it is triggered by a user
     typing a question on the Deal screen rather than by the flow reaching a step. Without it
     agentJourneyIds — which reads step sources — would find nothing and file a working query bot
     under "Not wired into any journey — configured, but nothing runs it".

     Guardrail 'Fully automated' is right even though the agent is read-only: the guardrail
     answers "may it act without a person", and a question that only ever returns an answer needs
     nobody's approval. Its restraint is enforced by being read-only, not by a human gate. -- */
  {name:'Ask the Deal',type:'Query agent',desc:'Answers questions about a Deal, Shipment, Lot or Challan from live transaction data, and returns the record IDs behind every answer.',model:'Bharat GPT',usedIn:'Sub-Contracting Journey',guardrail:'Fully automated',journeys:['sub-contracting'],
    skillMd:`# Ask the Deal — skill.md

Model: Bharat GPT
Type: Query agent
Used in: Sub-Contracting Journey
Guardrail: Fully automated — read-only, no human gate

## Purpose
Answer user questions about a Deal, Shipment, Lot or Challan using available live transaction data.

## Trigger
A user enters a question from the Deal screen, or from any applicable module screen.

## Reads
- Deal / SCR
- Parent and Sub-Items
- Shipments
- Documents
- Stock Positions
- Activity Log

## Behaviour
1. Interpret the user question.
2. Identify the relevant records.
3. Return a short answer with the applicable record IDs.
4. Respect the logged-in user's role and data access.
5. Log the question and the response in the Activity Log.

## Restrictions
- Read-only.
- Shall not update any record.
- Shall not answer using data outside the user's access.
- Shall not guess when required data is unavailable — it says the data is not available instead.

## Human in loop
Not required.

## Audit
Every question and every response is written to the Activity Log with timestamp, the records read, and the asking user.`},
  /* -- FR5.2. Guardrail is 'Human approves next step' so the tile reads Human in loop, and step
     17 of the journey carries approvalRequired to match — the requirement is explicit that a
     Stores or Finance user selects the final Reason Code and continues the reconciliation.

     No `journeys` link needed: this agent IS the source of step 17 in
     aiJourneyEvents['sub-contracting'], so agentJourneyIds files it under Sub-Contracting off
     the wiring itself, which is the stronger of the two signals. -- */
  {name:'Reconciliation Explainer',type:'Transaction agent',desc:'Explains material variance at reconciliation and recommends the applicable reason code — advisory only, a person confirms.',model:'Bharat GPT',usedIn:'Sub-Contracting Journey',guardrail:'Human approves next step',
    skillMd:`# Reconciliation Explainer — skill.md

Model: Bharat GPT
Type: Transaction agent
Used in: Sub-Contracting Journey
Guardrail: Human approves next step

## Purpose
Explain material variance during reconciliation and recommend the applicable reason or action.

## Trigger
The IMR is Confirmed.

## Reads
- Issued Quantity
- Received Quantity
- BOM Ratio
- Consumed Quantity
- Returned / Balance Quantity
- Vendor history for the applicable item
- Scrap tolerance, where configured

## Behaviour
1. Compare issued, consumed, returned and received quantities.
2. Assess whether the variance is within the expected range.
3. Display a reconciliation note for each applicable Sub-Item.
4. Recommend the applicable Reason Code, or a further review action.

## Restrictions
- Shall not Confirm Receipt.
- Shall not modify quantities.
- Shall not post or update data in the source system.
- The recommendation is advisory only.

## Human in loop
Required. The applicable Stores or Finance user reviews the recommendation, selects or confirms the final Reason Code, and continues the reconciliation.

## Audit
Every recommendation is logged with the quantities compared, the tolerance applied, the reason code suggested, and the reason code the user finally confirmed.`}
];
const cfgAgentsOriginalSkill=cfgAgents.map(function(a){return a.skillMd;});
let cfgAgentSkillModalIdx=-1;
// '' = every journey. Which journey's agents the catalogue is scoped to — see buildCfgAgentsHTML.
let cfgAgentJourneyFilter='';
let cfgAgentSkillEditing=false;
// -- Which agent's detail modal is open. Doubles as "did skill.md get opened from a detail
// modal", which is what decides whether skill.md offers Back or only Close. --
let cfgAgentDetailIdx=-1;

// -- Configure: Overview recent activity (copied from reference console) --
const cfgRecentActivity=[
  {title:'Material model updated',sub:'2 enrichment fields added',when:'12 min ago'},
  {title:'Procure-to-Pay journey activated',sub:'6 steps · live on sandbox',when:'1 hr ago'},
  {title:'SAP S/4HANA connection tested',sub:'142 released APIs available',when:'3 hrs ago'},
  {title:'Infor ERP connected',sub:'via Infor Web Network',when:'yesterday'}
];

// -- Configure: shared UI state --
let selectedCfgSystemId=null,selectedCfgModelId=null,selectedCfgJourneyId=null;
// -- Where the open model detail was entered from. It now has two doors — Data Foundation for
// models without an intake form, and a system's own page — so its back button and the sidebar
// highlight have to follow the one actually used rather than assume Data Foundation. --
let cfgModelBackPage='cfg-data-foundation';
// -- The intake form page, opened by Create Contract in the AI Execution Layer.
// cfgUserIntakeFields is fetched from NewForce's own /schema endpoint (via our backend) rather
// than hardcoded, so the form tracks whatever NewForce actually asks for. cfgUserIntakeResult holds the
// created Client record after a successful submit, which is what the success panel reports.
// cfgUserIntakeBackPage is whatever page the operator was on when they hit Create Contract:
// the form is a sidebar-less focused flow, so Exit has to be told where to put them back. --
let cfgUserIntakeModelId=null,cfgUserIntakeFields=null,cfgUserIntakeResult=null,cfgUserIntakeError='',cfgUserIntakeBusy=false,cfgUserIntakeOffline=false,cfgUserIntakeBackPage='ai-executive';
// -- Whether the field list came from the source system's own published definition (the mock
// site publishes one) or is a copy we maintain (the NewForce middleware publishes none). The
// form says which, because "rendered from its published field definition" is a claim, and it is
// only true in one of the two cases. --
let cfgUserIntakePublished=true;
// cfgUserIntakeStep is the stage of the three-part journey (0 form, 1 ingestion, 2 record);
// cfgUserIntakeProgress indexes the ingestion feed within stage 1. cfgUserIntakeDraft holds what
// has been typed, because re-rendering to show a validation error rebuilds the inputs and would
// otherwise wipe the form. Errors are keyed by field name so each message sits on its own control.
let cfgUserIntakeStep=0,cfgUserIntakeProgress=-1,cfgUserIntakeFieldErrors={},cfgUserIntakeDraft={};
// -- Used when NewForce's schema endpoint can't be reached — most often because the backend simply
// isn't running. The page renders these fields instead of sitting on "Loading…" forever, so the
// form is always visible and the reason it can't be submitted is stated rather than implied.
// Mirrors backend/server.js's FALLBACK_INTAKE_FIELDS. --
const cfgUserIntakeFallbackFields=[
  {name:'full_name',label:'Full name',type:'text',required:true},
  {name:'work_email',label:'Work email',type:'email',required:true},
  {name:'phone_country_code',label:'Phone number',type:'select',options:['+91','+31','+49','+34','+44','+1','+65'],placeholder:'Select'},
  {name:'phone_number',label:'',type:'text'},
  {name:'company_name',label:'Company name',type:'text'},
  {name:'country_hiring_in',label:'Country hiring in',type:'select',options:['India','Netherlands','Germany','Spain','United Kingdom','United States','Singapore']},
  {name:'looking_for',label:'What are you looking for?',type:'select',options:['Employer of Record (EOR)','Contractor Management','Payroll Outsourcing','Entity Setup','PEO Services']},
  {name:'heard_about_us',label:'How did you hear about us?',type:'select',options:['Google Search','LinkedIn','Referral','Conference / Event','Existing Customer','Other']}
];
/* == BHAIYAA — STORE CREATION JOURNEY ======================================================
   The signup Bhaiyaa asks a merchant for, rendered here so a store can be opened from inside the
   Executive Layer instead of on Bhaiyaa's own site. Same field-definition shape as the NewForce
   intake above, plus three things that form needs and NewForce's does not:

     hint     Bhaiyaa writes a line of help under three of its fields. They are not decoration —
              "you can change this later" and "this decides your annual turnover band" are the
              two facts that stop a merchant stalling on a choice, so they are part of the field.
     verify   The mobile number is the one field with a state machine behind it (send OTP, enter
              code, verified). Declaring it here keeps the renderer generic.
     consent  T&C and MSA are not checkboxes that gate a button, they are evidence. Both are
              recorded on the store record with the timestamp they were accepted at.

   Ordering follows Bhaiyaa's own form exactly: who you are, then how we reach you, then what the
   store is. A merchant filling this alongside Bhaiyaa's site should never have to hunt.

   SECTIONS. The live signup at seller.bhaiyaa.com/sign-up spreads these over seven screens —
   phone auth, account, KYC, bank, location, delivery, OTP. This flow keeps its own four stages
   (see bhaiyaaStoreStages) and folds all of the merchant-entered ones into stage 1, because a
   four-stage rail that suddenly grew to eleven would be describing the form's pagination rather
   than the journey. What it does NOT do is stack thirty controls in one column: each field
   declares a `section`, and the renderer draws a titled group per section. The grouping is
   Bhaiyaa's own — a merchant filling both should recognise every block. == */
const bhaiyaaStoreSections=[
  {id:'account',  title:'Your account',      sub:'How Bhaiyaa reaches the owner of this store.'},
  {id:'store',    title:'Your store',        sub:'What the store is and what it sells.'},
  {id:'kyc',      title:'Business & KYC',    sub:'The registration details Bhaiyaa verifies before opening a store.'},
  {id:'documents',title:'Documents',         sub:'Uploads Bhaiyaa keeps on file. Only PAN and Aadhaar are needed to open the store.'},
  {id:'bank',     title:'Bank details',      sub:'Where payouts are settled.'},
  {id:'location', title:'Store location',    sub:'The address customers see and deliveries go to.'},
  {id:'consent',  title:'Agreements',        sub:'Recorded with the moment each was accepted, not as a flag.'}
];
/* Bhaiyaa's own 24 categories, verbatim from the live signup. They are broader than a kirana
   list — Bhaiyaa carries diagnostics, logistics and ticketing on the same platform — so the
   taxonomy is theirs and is not translated on the way in. A category we renamed would not match
   the one on their record, and reconciling two spellings later costs more than it saves. */
const bhaiyaaStoreCategories=['Grocery','Retail','Dispensary','Manufacturing','Fashion','Beauty And Personal Care','Electronics','Appliances','Home And Kitchen','Health And Wellness','Restaurant','Spa','Diagnostic','Hospital','Logistic','Business Partner - Supplier','Grocery Wholesale','Health Services','Cards And Subscription','Tickets','Service','Rooms','Amentities','Others'];
/* Sub and grand category are the second and third levels of Bhaiyaa's hierarchy. The live form
   populates them from the category above; here they carry one generic set, because a three-level
   taxonomy mocked in full would be a thousand lines describing someone else's catalogue. */
const bhaiyaaSubCategories=['General','Packaged Goods','Fresh & Perishable','Prepared Food','Devices & Hardware','Apparel & Accessories','Personal Care','Clinical','Professional Services','Other'];
const bhaiyaaGrandCategories=['Essentials','Lifestyle','Healthcare','Industrial','Services'];
/* Business size, not turnover. The live form asks MSME / SMB / Corporate — a registration class
   rather than a rupee range — so that is what is asked here. The three of them still decide the
   plan, the GST position and the credit line, which is why the option text carries what each one
   means: "Corporate" tells a merchant nothing on its own. */
const bhaiyaaStoreTypes=['MSME: Micro, Small, and Medium Enterprises','SMB: Small and Medium-sized Business','Corporate: Large businesses or companies'];
/* The entity type behind the store. It is the field that decides which documents are actually
   required — a sole proprietor has no incorporation certificate and a trust has no GST by
   default — so it is asked before the uploads rather than after them. */
const bhaiyaaKycEntityTypes=['Individual','Sole Proprietor / Self-employed','Partnership','Limited Liability Partnership (LLP)','Private/Public Limited',"NGO's / Trust / Society / Association"];
const bhaiyaaCountries=['India','United Arab Emirates','Singapore','United Kingdom','United States'];
const bhaiyaaStoreFields=[
  /* ---- account ---- */
  {section:'account',name:'first_name',label:'First Name',type:'text',required:true,placeholder:'Enter Your First Name'},
  {section:'account',name:'last_name',label:'Last Name',type:'text',required:true,placeholder:'Enter Your Last Name'},
  {section:'account',name:'email_id',label:'Email Id',type:'email',required:true,placeholder:'Enter Your email address',full:true},
  {section:'account',name:'phone_country_code',label:'Mobile Number',type:'select',options:['+91','+971','+65','+44','+1'],verify:'otp'},
  {section:'account',name:'mobile_number',label:'',type:'text',placeholder:'Enter Mobile Number'},

  /* ---- store ---- */
  {section:'store',name:'store_name',label:'Enter Your Store Name',type:'text',placeholder:'Enter your store name',full:true,
   hint:'You can always change your Store name in Settings.'},
  {section:'store',name:'store_category',label:'Choose Your Store Category',type:'select',required:true,full:true,placeholder:'Select',options:bhaiyaaStoreCategories,
   hint:'Select a category that defines what your store offers to your customers.'},
  {section:'store',name:'sub_category',label:'Sub Category',type:'select',placeholder:'Select',options:bhaiyaaSubCategories},
  {section:'store',name:'grand_category',label:'Grand Category',type:'select',placeholder:'Select',options:bhaiyaaGrandCategories},
  {section:'store',name:'country',label:'Select Country',type:'select',placeholder:'Select',options:bhaiyaaCountries},
  {section:'store',name:'referral_code',label:'Referral Code',type:'text',optional:true,placeholder:'If someone referred you'},
  {section:'store',name:'store_type',label:'Choose Your Store Type',type:'select',required:true,full:true,placeholder:'Select',options:bhaiyaaStoreTypes,
   hint:'This decides your Bhaiyaa plan, your GST position and your credit line.'},

  /* ---- business & KYC ---- */
  {section:'kyc',name:'business_kyc',label:'Your Business KYC',type:'select',required:true,full:true,placeholder:'Select',options:bhaiyaaKycEntityTypes,
   hint:'The entity behind the store. It decides which of the documents below Bhaiyaa actually needs.'},
  /* Aadhaar is asked here and nowhere else. It is the only field on this form that exists for a
     third party's benefit rather than the merchant's, so it says why it is being asked — an
     unexplained government id on a signup form is the field people abandon a signup at. Twelve
     digits, grouped, and never shown in full again after this screen. */
  {section:'kyc',name:'aadhaar_number',label:'Aadhaar Number',type:'text',required:true,full:true,placeholder:'0000 0000 0000',
   hint:'Verified with UIDAI before your store is opened. Bhaiyaa needs a KYC-verified owner on every store.'},
  {section:'kyc',name:'pan_number',label:'Pan Number',type:'text',required:true,placeholder:'ABCDE1234F',mono:true},
  {section:'kyc',name:'pan_aadhaar_linked',label:'Is Pan & Aadhar linked?',type:'select',required:true,placeholder:'Select',options:['Yes','No'],
   hint:'A store cannot be opened until these are linked.'},
  {section:'kyc',name:'gst_number',label:'GST Number',type:'text',optional:true,placeholder:'22ABCDE1234F1Z5',mono:true},
  {section:'kyc',name:'tan_number',label:'TAN',type:'text',optional:true,placeholder:'ABCD12345E',mono:true},
  {section:'kyc',name:'msme_number',label:'MSME Registration Number',type:'text',optional:true,full:true,placeholder:'UDYAM-XX-00-0000000',mono:true},

  /* ---- documents ----
     Presence is the fact this journey needs, not contents: the KYC stage asks whether a document
     was supplied, and nothing downstream ever reads the file. So these store the name, size and
     type of what was picked and nothing else — a mockup that pretended to hold scans of people's
     PAN cards would be carrying a liability it has no use for. */
  {section:'documents',name:'doc_pan',label:'Pan Card',type:'file',required:true,accept:'.pdf,.jpg,.jpeg,.png'},
  {section:'documents',name:'doc_aadhaar',label:'Aadhar Card',type:'file',required:true,accept:'.pdf,.jpg,.jpeg,.png'},
  {section:'documents',name:'doc_gst',label:'GST Certificate',type:'file',optional:true,accept:'.pdf,.jpg,.jpeg,.png'},
  {section:'documents',name:'doc_cheque',label:'Cancelled Cheque',type:'file',optional:true,accept:'.pdf,.jpg,.jpeg,.png'},
  {section:'documents',name:'doc_fssai',label:'FSSAI',type:'file',optional:true,accept:'.pdf,.jpg,.jpeg,.png'},
  {section:'documents',name:'doc_shop_licence',label:'Shop & Establishment License',type:'file',optional:true,accept:'.pdf,.jpg,.jpeg,.png'},

  /* ---- bank ---- */
  {section:'bank',name:'bank_name',label:"Bank Name",type:'text',required:true,placeholder:'Enter your bank name'},
  {section:'bank',name:'bank_account_holder',label:"Bank Account Holder's Name",type:'text',required:true,placeholder:'As printed on the passbook'},
  {section:'bank',name:'bank_account_number',label:'Account Number',type:'text',required:true,placeholder:'Enter account number',mono:true,
   hint:'Stored masked. Only the last four digits are shown after this screen.'},
  {section:'bank',name:'bank_ifsc',label:"Bank's IFSC Code",type:'text',required:true,placeholder:'HDFC0001234',mono:true},
  {section:'bank',name:'bank_branch',label:'Branch Address',type:'text',required:true,full:true,placeholder:'Branch and city'},

  /* ---- location ---- */
  {section:'location',name:'address_line',label:'House / Flat / Floor Number',type:'text',placeholder:'Shop 12, Ground Floor'},
  {section:'location',name:'landmark',label:'Landmark',type:'text',optional:true,placeholder:'Near the bus depot'},
  {section:'location',name:'full_address',label:'Complete Address',type:'text',required:true,full:true,placeholder:'Street, area'},
  {section:'location',name:'city',label:'City',type:'text',required:true,placeholder:'Pune'},
  {section:'location',name:'state',label:'State',type:'text',required:true,placeholder:'Maharashtra'},
  {section:'location',name:'pin_code',label:'Pin Code',type:'text',required:true,placeholder:'411001',mono:true},

  /* ---- consents ---- */
  {section:'consent',name:'accept_terms',type:'consent',required:true,label:'I accept the ',linkText:'Terms & Conditions'},
  {section:'consent',name:'accept_msa',type:'consent',required:true,label:'I accept the ',linkText:'MSA'},
  {section:'consent',name:'accept_fssai',type:'consent',required:true,label:'I accept the ',linkText:'Consent and Authorization for FSSAI Registration'}
];
/* -- Seller or buyer is the first question because it is the only one whose answer changes what
   the other answers mean. A seller's category says what they put in front of customers; a
   buyer's says what they source. They also provision differently — a storefront and a payout
   account against a purchase ledger and a credit line — so asking it first is what lets the run
   afterwards be about this store rather than a generic one. -- */
const bhaiyaaStoreRoles=[
  {id:'seller',label:'Create store as a Seller',sub:'You sell to customers',
   blurb:'A storefront on Bhaiyaa with your catalogue, incoming orders and a payout account.',
   gets:['Storefront & catalogue','Order inbox','Payout account'],
   icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 9.5 4.8 4h14.4L21 9.5"/><path d="M3 9.5h18a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 11.8V20h14v-8.2"/><path d="M10 20v-4.5h4V20"/></svg>'},
  {id:'buyer',label:'Create store as a Buyer',sub:'You buy from sellers',
   blurb:'A buyer profile on Bhaiyaa with a purchase ledger, credit terms and supplier access.',
   gets:['Purchase ledger','Credit terms','Supplier catalogue'],
   icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h3l2.4 12.2a1.7 1.7 0 0 0 1.7 1.3h8.6a1.7 1.7 0 0 0 1.7-1.3L21 7H6"/></svg>'}
];
/* -- The KYC stage. Four checks, in the order a real UIDAI verification does them: the number
   has to be well-formed before it is worth sending, the demographics come back, the name and
   mobile on the signup are matched against them, and the merchant is screened. Each carries the
   value it compared, because "Name match ✓" alone is a claim, and "Asha Rane ≈ ASHA RANE ✓" is
   evidence. -- */
const bhaiyaaKycChecks=[
  {id:'format',label:'Checking the number',running:'Validating the Verhoeff checksum…',done:'Well-formed Aadhaar number'},
  {id:'uidai',label:'Querying UIDAI',running:'Requesting demographics for this Aadhaar…',done:'UIDAI responded'},
  {id:'name',label:'Matching the name',running:'Comparing the name on record with UIDAI…',done:'Name matches'},
  {id:'screen',label:'Screening the merchant',running:'Checking sanctions and watchlists…',done:'No adverse match'}
];
// Four stages — see the note on aiJourneyEvents['bhaiyaa-store-creation'] for why the role
// picker is gone. The rail and the journey definition are read from the same place, so they
// cannot disagree about how many steps there are.
const bhaiyaaStoreStages=[
  {label:'Store Details',sub:'Fill in the signup'},
  {label:'KYC',sub:'Aadhaar verified'},
  {label:'Creating',sub:'Writing to Bhaiyaa'},
  {label:'Store',sub:'Record created'}
];
function bhaiyaaMaskAadhaar(n){
  const digits=String(n||'').replace(/\D/g,'');
  if(digits.length<4)return 'XXXX XXXX XXXX';
  return 'XXXX XXXX '+digits.slice(-4);
}
/* Same rule as the Aadhaar above, for the one other field on this form nobody downstream has a
   reason to read in full. The last four are what a merchant identifies their own account by; the
   rest is a number an ops board has no business displaying. */
function bhaiyaaMaskAccount(n){
  const digits=String(n||'').replace(/\D/g,'');
  if(digits.length<4)return '';
  return '•••• '+digits.slice(-4);
}
/* A document field holds {name,size,type} or nothing — see the note on the `documents` section.
   These two are the only questions anything downstream asks of one. */
function bhaiyaaDocPresent(d,name){return !!(d&&d[name]&&d[name].name);}
function bhaiyaaDocSize(f){
  if(!f||!f.size)return '';
  return f.size<1024?f.size+' B'
    :f.size<1048576?Math.round(f.size/1024)+' KB'
    :(f.size/1048576).toFixed(1)+' MB';
}
/* -- Derived from the business tier, not asked separately. The tier a merchant picks already
   decides all three, so asking again would be asking them to do our arithmetic. The run shows
   each one as it is written, which is what makes the tier feel like it did something.
   Keyed on the three values Bhaiyaa's own form offers — see bhaiyaaStoreTypes. -- */
const bhaiyaaBandFacts={
  'MSME: Micro, Small, and Medium Enterprises':{gst:'Mandatory above ₹40 lakh',plan:'Growth',credit:'₹50,000 limit',terms:'Prepaid'},
  'SMB: Small and Medium-sized Business':{gst:'Mandatory',plan:'Business',credit:'₹2,50,000 limit',terms:'Net 15'},
  'Corporate: Large businesses or companies':{gst:'Mandatory · e-invoicing',plan:'Enterprise',credit:'₹10,00,000 limit',terms:'Net 30'}
};
function bhaiyaaBandFor(type){return bhaiyaaBandFacts[type]||{gst:'To be confirmed',plan:'Starter',credit:'Prepaid only',terms:'Prepaid'};}
function bhaiyaaHandle(name){return (name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'store';}
/* == THE RUN =============================================================================
   What the execution layer actually does with the signup, step by step, with the values it read
   and the values it wrote. Both halves matter: a feed that only says "Registering…" is a spinner
   with a caption, and the question anyone has watching a record get created is which of their
   answers went where. Reads come from the form, writes are what did not exist a moment ago. == */
function bhaiyaaStoreRunSteps(s){
  const band=bhaiyaaBandFor(s.storeType);
  const owner=[s.firstName,s.lastName].filter(Boolean).join(' ');
  const mobile=s.mobile?s.phoneCountryCode+' '+s.mobile+(s.mobileVerified?' (verified)':''):'Not given';
  const seller=s.role==='seller';
  return [
    {title:'Reading the signup',note:'Taking the details off the form and checking them against Bhaiyaa’s rules.',
     reads:[['Email id',s.email],['Mobile number',mobile],['Owner',owner]],writes:[]},
    // Carried forward rather than re-run: KYC happened on its own stage, and repeating it here
    // would show the same work twice. What this step does is attach the result to the record.
    {title:'Attaching the KYC result',note:'The verification from the previous stage, recorded against the store.',
     reads:[['Aadhaar',s.aadhaarMasked],['PAN',s.panNumber||'Not given'],['Verified at',s.kycVerifiedAt]],
     writes:[['KYC status','Verified'],['Verified by','KYC Agent']]},
    /* The document manifest. It is its own step rather than a line on the KYC one because the
       question it answers is different: KYC says whether the owner checks out, this says what
       Bhaiyaa is holding on file for them — and an audit asks the second one far more often. */
    {title:'Filing the documents',note:'What the merchant supplied, recorded by name and size. The files themselves stay with Bhaiyaa.',
     reads:(s.documents||[]).map(function(doc){return [doc.label,doc.name];}),
     writes:[['Documents on file',String((s.documents||[]).length)],
             ['Entity type',s.businessKyc||'Not given']]},
    {title:'Resolving the business tier',note:'One answer decides the plan, the GST position and the credit line.',
     reads:[['Store type',s.storeType],['GST number',s.gstNumber||'Not registered']],
     writes:seller?[['Plan',band.plan],['GST',band.gst]]:[['Plan',band.plan],['GST',band.gst],['Credit line',band.credit]]},
    {title:'Minting the Store ID',note:'The Executive Layer’s own identifier, issued before anything leaves this system.',
     reads:[],writes:[['Store ID',s.storeCode]]},
    {title:seller?'Registering the store on Bhaiyaa':'Registering the buyer profile on Bhaiyaa',
     note:'Posted to StoreIntake · Store Signup. Bhaiyaa mints its own id and returns it.',
     reads:[['Store name',s.storeName],['Category',s.category||'Not set'],['City',s.city||'Not set']],
     writes:[['Bhaiyaa Store ID',s.bhaiyaaCode]]},
    /* Settlement and address are written after registration, not before: both are attributes of
       a store that exists, and Bhaiyaa has nothing to attach them to until it has issued its id. */
    {title:'Attaching settlement and address',note:'Where payouts land and where the store trades. Recorded once Bhaiyaa has a store to hang them on.',
     reads:[['Bank',s.bankName||'Not given'],['IFSC',s.bankIfsc||'Not given']],
     writes:[['Payout account',s.bankAccountMasked||'Not given'],
             ['Address',[s.city,s.state,s.pinCode].filter(Boolean).join(', ')||'Not given']]},
    seller
      ?{title:'Opening the storefront',note:'The catalogue and order inbox a customer will see.',
        reads:[['Category',s.category||'Not set']],
        writes:[['Storefront',s.handle],['Catalogue','Empty — 0 items'],['Order inbox','Open']]}
      :{title:'Opening the purchase ledger',note:'Where this buyer’s orders and dues will be recorded.',
        reads:[['Credit line',band.credit]],
        writes:[['Ledger',s.handle],['Payment terms',band.terms],['Supplier catalogue','Enabled']]},
    {title:'Recording consent',note:'Stored as evidence with the moment each was accepted, not as a flag.',
     reads:[],writes:s.consents.map(function(c){return [c.name,c.acceptedAt];})},
    /* The milestone. Marked so the feed can draw it as an arrival rather than another line —
       this is the step where the thing the merchant came for starts existing, and a run where
       every step looks identical never says which one that was. */
    {title:seller?'Store created':'Buyer account created',milestone:true,
     note:'Live in both systems and readable in Stores. It stays Pending until Bhaiyaa has verified the documents on file.',
     reads:[],writes:[['Store',s.storeName],['Store ID',s.storeCode],['Bhaiyaa Ref ID',s.bhaiyaaCode],['Status',s.status]]}
  ];
}
// The demo code. A real integration would post the number to Bhaiyaa and never see the code at
// all; here it is fixed and stated on screen, because an OTP nobody can guess is a dead end in a
// mockup and a hidden one that accepts anything teaches the wrong thing about the control.
const BHAIYAA_DEMO_OTP='123456';
let bhaiyaaStores=[];
let bhaiyaaStoreSeq=1;
// Bhaiyaa's own counter, kept apart from ours on purpose: two systems minting ids for one store
// is the fact the success screen exists to show, and a shared counter would make them agree.
let bhaiyaaSourceSeq=1;
let storeIntakeStep=0,storeIntakeDraft={},storeIntakeFieldErrors={},storeIntakeResult=null,storeIntakeBusy=false;
let storeIntakeBackPage='dashboard';
let storeIntakeRole='';      // 'seller' | 'buyer' — picked on stage 0, stamped on the record
let storeIntakeProgress=-1;  // index into bhaiyaaStoreRunSteps while the run plays
let storeKycProgress=-1;     // index into bhaiyaaKycChecks while KYC plays
let storeKycDone=false;
// Which finished stage is being inspected, or -1 for none. Deliberately separate from
// storeIntakeStep: reviewing is not rewinding, and the run must not move because someone looked.
let storeReviewStage=-1;
// 'idle' -> 'sent' -> 'verified'. Held apart from the draft because it is not a value the
// merchant typed, it is a fact about the number they typed.
let storeIntakeOtpStage='idle';

let cfgSystemEditing=false;
let cfgSystemDraft=null;
let cfgStepAssignments={};
let cfgDrawerJourneyId=null,cfgDrawerStepIdx=-1;

// -- AI Executive: live run flows for activated journeys (Create Contract / Create Employee / Run Payroll) --
let aiRunFlowJourneyId=null,aiRunFlowStep=-1,aiRunFlowData={};
// -- NewForce Solutions live sync (H2R "Create Employee" entry only): aiH2rAdtFeedStep drives buildAIRunTimelineHTML's reuse for the ingestion feed (-1 idle, 0 listening, 1-4 ingesting). aiH2rAdtLastSubmission holds the raw form fields as NewForce sent them; aiH2rAdtLastEmployee holds the client record the backend created from them. adtPollTimerId is the setInterval handle (never persisted — a fresh page load always starts idle and requires re-arming). --
let aiH2rAdtFeedStep=-1,aiH2rAdtLastSubmission=null,aiH2rAdtLastEmployee=null,aiH2rAdtLastLocalId=null,aiH2rAdtError='',adtPollTimerId=null;
const aiH2rAdtIngestSteps=[
  {label:'Listening',running:'Connected to NewForce Solutions — waiting for a new intake form submission…',type:'ai'},
  {label:'Fetching Submission',running:'New submission detected — retrieving it from NewForce Solutions…',type:'ai'},
  {label:'Form Details Received',running:'Reading the submitted form fields…',type:'ai'},
  // Only one identifier is minted — ours. The source system's id arrived with the submission.
  {label:'Generating Client ID',running:'Minting the Client ID and linking it to the NewForce source record…',type:'ai'},
  {label:'Creating Client Record',running:'Creating the Client record — status Pending until HR completes it…',type:'ai'}
];
const aiRunFlows={
  'h2r-lifecycle':{
    entryLabel:'Create Employee',
    entryDesc:'Tell me who you\'re onboarding — I\'ll create the employee record and walk through country compliance and leave policy setup automatically.',
    promptPlaceholder:'e.g. Create an employee for Rahul Mehta in India as Product Manager',
    steps:[
      {label:'Employee Creation',running:'Creating employee record…',type:'ai'},
      {label:'Fetch Country Details',running:'Fetching compliance details from the Compliance Hub…',type:'ai'},
      {label:'Leave Policy Match',running:'Matching the applicable leave policy…',type:'ai'},
      {label:'HR Approval',running:'Checking for policy deviations…',type:'manual'},
      {label:'Offboarding',running:'Running offboarding checklist…',type:'checklist'}
    ]
  },
  'payroll-creation':{
    entryLabel:'Run Payroll',
    entryDesc:'Tell me who you\'re running payroll for — I\'ll gather their details, capture attendance, calculate salary, and generate the slip automatically.',
    promptPlaceholder:'e.g. Run payroll for Anika Shah for this month',
    steps:[
      {label:'Employee Fetch',running:'Fetching employee details…',type:'fetch'},
      {label:'Attendance Capture',running:'Capturing attendance records…',type:'ai'},
      {label:'Salary Calculation',running:'Calculating gross and net salary…',type:'ai'},
      {label:'Approval',running:'Waiting for Finance approval…',type:'manual'},
      {label:'Salary Slip Template',running:'Generating salary slip template…',type:'slip'},
      {label:'Salary Slip Created',running:'Creating salary slip…',type:'complete'}
    ]
  }
};
const allLeavesData=[
  {id:1,empId:'CLOCLO11755',name:'Shaun J',leaveId:'2014',leaveType:'Casual Leave',leaveFrom:'14-04-2026',leaveTo:'16-04-2026',leaveHours:'Full Day',description:'I need leave',email:'shaun.varghese1805@gmail.com',appliedDate:'14 Apr, 2026 23:40:25',createdBy:'Self',status:'Approved',subStatus:'Paid'},
  {id:2,empId:'CLOCLO11756',name:'Pallavi P',leaveId:'2019',leaveType:'Sick Leave',leaveFrom:'18-04-2026',leaveTo:'18-04-2026',leaveHours:'Half Day',description:'Not feeling well',email:'pallavi.p@maaserp.com',appliedDate:'17 Apr, 2026 10:15:00',createdBy:'Self',status:'Pending',subStatus:'Unpaid'},
  {id:3,empId:'CLOCLO11757',name:'Anika Shah',leaveId:'2021',leaveType:'Casual Leave',leaveFrom:'20-04-2026',leaveTo:'22-04-2026',leaveHours:'Full Day',description:'Personal work',email:'anika.shah@maaserp.com',appliedDate:'19 Apr, 2026 09:00:00',createdBy:'Self',status:'Approved',subStatus:'Paid'},
  {id:4,empId:'CLOCLO11758',name:'Rahul Mehta',leaveId:'2025',leaveType:'Earned Leave',leaveFrom:'25-04-2026',leaveTo:'27-04-2026',leaveHours:'Full Day',description:'Family function',email:'rahul.mehta@maaserp.com',appliedDate:'22 Apr, 2026 14:30:00',createdBy:'Self',status:'Unapproved',subStatus:'Unpaid'},
  {id:5,empId:'CLOCLO11759',name:'Nora Kim',leaveId:'2031',leaveType:'Sick Leave',leaveFrom:'28-04-2026',leaveTo:'28-04-2026',leaveHours:'Half Day',description:'Doctor appointment',email:'nora.kim@maaserp.com',appliedDate:'27 Apr, 2026 08:45:00',createdBy:'Self',status:'Pending',subStatus:'Unpaid'},
  {id:6,empId:'CLOCLO11760',name:'Luis Martin',leaveId:'2033',leaveType:'Casual Leave',leaveFrom:'02-05-2026',leaveTo:'04-05-2026',leaveHours:'Full Day',description:'Vacation trip',email:'luis.martin@maaserp.com',appliedDate:'30 Apr, 2026 11:20:00',createdBy:'Self',status:'Approved',subStatus:'Paid'}
];
const alLogsData={
  1:[{date:'14 Apr, 2026',time:'23:40:25',user:'Shaun J',status:'Approved',action:'Leave applied and approved by manager.'}],
  2:[{date:'17 Apr, 2026',time:'10:15:00',user:'Pallavi P',status:'Pending',action:'Leave application submitted, awaiting approval.'}],
  3:[{date:'19 Apr, 2026',time:'09:00:00',user:'Anika Shah',status:'Approved',action:'Leave applied and approved by manager.'}],
  4:[{date:'22 Apr, 2026',time:'14:30:00',user:'Rahul Mehta',status:'Unapproved',action:'Leave application rejected by manager.'}],
  5:[{date:'27 Apr, 2026',time:'08:45:00',user:'Nora Kim',status:'Pending',action:'Leave application submitted, awaiting approval.'}],
  6:[{date:'30 Apr, 2026',time:'11:20:00',user:'Luis Martin',status:'Approved',action:'Leave applied and approved by manager.'}]
};
let alSelectedId=null,alTab='basic-details';
const paymentsData=[
  {id:1,orderId:'1116',name:'TestEmp Antar',amountDue:'INR 0.00',type:'EOR - Employee',orderStatus:'Onboarding',invoiceStatus:'Unpaid',
   key:'1116',dealId:'94130',entityName:'Closedhi',addedFrom:'agency',createdTime:'02 Jun 2026 | 10:43 am',courseId:'2981',courseName:'JIRA',lastUpdated:'--',startFrom:'01 Jun 2026',endTo:'01 Aug 2026',workingCountry:'Belgium',orderCategory:'international',
   emp:{empId:'8691456',name:'TestEmp Antar',email:'antar@testemp.com',mobile:'+91 9999999996',status:'Pending Onboarding',createdOn:'01 Jun 2026 | 02:54 pm'},
   attachments:[]},
  {id:2,orderId:'1114',name:'Elon Musk',amountDue:'EUR 0.00',type:'EOR - Employee',orderStatus:'Onboarding',invoiceStatus:'Unpaid',
   key:'1114',dealId:'94128',entityName:'SpaceX EOR Ltd.',addedFrom:'agency',createdTime:'01 Jun 2026 | 09:00 am',courseId:'2975',courseName:'Python',lastUpdated:'--',startFrom:'01 Jun 2026',endTo:'31 Dec 2026',workingCountry:'USA',orderCategory:'international',
   emp:{empId:'8691455',name:'Elon Musk',email:'elon@spacex.com',mobile:'+1 555 000 0000',status:'Pending Onboarding',createdOn:'01 Jun 2026 | 09:30 am'},
   attachments:[]}
];
const pmWorkflowData={
  1:[{title:'Order Created',user:'Admin',date:'02 Jun 2026',time:'10:43 am',description:'EOR order created for TestEmp Antar in Belgium.'}],
  2:[{title:'Order Created',user:'Admin',date:'01 Jun 2026',time:'09:00 am',description:'EOR order created for Elon Musk in USA.'}]
};
const pmInvoiceFlow=['Unpaid','Pending','Paid','Closed'];
let pmSelectedId=null,pmTab='basic-details';

// ── SUPPORT: TICKETS & CHATS DATA ──
const ticketsData=[
  {id:1,ticketId:'TCK-1021',clientName:'John Doe',title:'Issue with compliance doc',category:'Compliance',createdAt:'Jun 12, 2026',status:'open',clientEmail:'john.doe@example.com',clientPhone:'+1 555-0101',country:'United States',assignedTo:'Pallavi Parate',description:'Client reported missing compliance documentation for Q2 audit. Follow-up required with legal team.'},
  {id:2,ticketId:'TCK-1025',clientName:'Thijs Verbeek',title:'Salary document missing',category:'Document',createdAt:'Jun 14, 2026',status:'blocked',clientEmail:'thijs.verbeek@example.com',clientPhone:'+31 20 000 0000',country:'Netherlands',assignedTo:'Rahul Mehta',description:'Monthly salary document not uploaded for May 2026. Awaiting finance team confirmation.'},
  {id:3,ticketId:'TCK-1019',clientName:'Alice Smith',title:'Contract renewal request',category:'Contract',createdAt:'Jun 10, 2026',status:'open',clientEmail:'alice.smith@example.com',clientPhone:'+44 20 0000 0000',country:'United Kingdom',assignedTo:'Aman Singh',description:'Client has requested renewal of EOR contract expiring July 2026.'},
  {id:4,ticketId:'TCK-1100',clientName:'Mark Lee',title:'Tax form not received',category:'Compliance',createdAt:'Jun 18, 2026',status:'in_progress',clientEmail:'mark.lee@example.com',clientPhone:'+49 30 000000',country:'Germany',assignedTo:'Pallavi Parate',description:'Client has not received the annual tax form for the 2025-26 fiscal year. Currently being processed.'},
  {id:5,ticketId:'TCK-1201',clientName:'Thijs Verbeek',title:'Contract draft review',category:'Contract',createdAt:'Jun 20, 2026',status:'open',clientEmail:'thijs.verbeek@example.com',clientPhone:'+31 20 000 0000',country:'Netherlands',assignedTo:'Neha Sharma',description:'New EOR contract draft sent for client review. Awaiting feedback.'},
  {id:6,ticketId:'TCK-1298',clientName:'Alice Smith',title:'Missing compliance certificate',category:'Compliance',createdAt:'Jun 22, 2026',status:'blocked',clientEmail:'alice.smith@example.com',clientPhone:'+44 20 0000 0000',country:'United Kingdom',assignedTo:'Rahul Mehta',description:'Certificate of compliance for UK operations not obtained. Blocked pending local authority approval.'},
  {id:7,ticketId:'TCK-1921',clientName:'Mark Lee',title:'Invoice document request',category:'Document',createdAt:'Jun 25, 2026',status:'closed',clientEmail:'mark.lee@example.com',clientPhone:'+49 30 000000',country:'Germany',assignedTo:'Aman Singh',description:'Client requested invoice copies for Q1 2026. All documents sent and acknowledged.'}
];
const chatsData=[
  {id:1,chatId:'CHAT-1045',clientName:'John Doe',assignedTo:'Pallavi Parate',lastActivity:'53 min ago',status:'waiting_csm',country:'United States',clientEmail:'john.doe@example.com',startedAt:'Jun 26, 2026 | 09:00 AM',linkedTickets:['TCK-1021']},
  {id:2,chatId:'CHAT-1044',clientName:'Priya Sharma',assignedTo:'Rahul Mehta',lastActivity:'2 days ago',status:'waiting_client',country:'India',clientEmail:'priya.sharma@example.com',startedAt:'Jun 24, 2026 | 02:30 PM',linkedTickets:[]},
  {id:3,chatId:'CHAT-1043',clientName:'Ramesh Patel',assignedTo:'Neha Sharma',lastActivity:'1 week ago',status:'active',country:'India',clientEmail:'ramesh.patel@example.com',startedAt:'Jun 19, 2026 | 11:15 AM',linkedTickets:['TCK-1019']},
  {id:4,chatId:'CHAT-1042',clientName:'Aisha Verma',assignedTo:'Olivia Clark',lastActivity:'2 months ago',status:'inactive',country:'Spain',clientEmail:'aisha.verma@example.com',startedAt:'Apr 26, 2026 | 04:00 PM',linkedTickets:[]},
  {id:5,chatId:'CHAT-1041',clientName:'Sophie Dubois',assignedTo:'Aman Singh',lastActivity:'3 months ago',status:'active',country:'France',clientEmail:'sophie.dubois@example.com',startedAt:'Mar 26, 2026 | 10:00 AM',linkedTickets:[]},
  {id:6,chatId:'CHAT-1040',clientName:'Luca Bianchi',assignedTo:'Pallavi Parate',lastActivity:'3 months ago',status:'waiting_client',country:'Italy',clientEmail:'luca.bianchi@example.com',startedAt:'Mar 12, 2026 | 03:45 PM',linkedTickets:['TCK-1100']},
  {id:7,chatId:'CHAT-1039',clientName:'Hannah Müller',assignedTo:'Rahul Mehta',lastActivity:'4 months ago',status:'waiting_csm',country:'Germany',clientEmail:'hannah.muller@example.com',startedAt:'Feb 26, 2026 | 09:30 AM',linkedTickets:['TCK-1298']}
];
let tkSelectedId=null,tkTab='basic-details';
let chatSelectedId=null,chatTab='basic-details';
let chatStatusFilter='all';
let profTab='basic-details';
let seSelectedEntity='dhi-hyperlocal';
const entitiesData=[
  {id:'dhi-hyperlocal',initials:'DH',name:'Dhi Hyperlocal',entityId:'ENT-00421',type:'EOR Entity',country:'India',plan:'Enterprise',employees:142,active:true},
  {id:'closedhi',initials:'CL',name:'Closedhi',entityId:'ENT-00293',type:'PEO Entity',country:'India',plan:'Professional',employees:38,active:false}
];

// ── TIMESHEET STATE & DATA ──
let tsSelectedDay=null;
let tsMonth={year:2026,month:5}; // 0-indexed (5=June)
let tsEmp=Object.assign({},TS_DEFAULT_EMP);
const tsAttendance={
  '2026-06-01':{in:'09:00 AM',out:'06:15 PM',loc:'Hyderabad',hours:'9.25h',src:'Auto',status:'present'},
  '2026-06-02':{in:'09:15 AM',out:'06:30 PM',loc:'Hyderabad',hours:'9.25h',src:'Manual',status:'present'},
  '2026-06-03':{in:'09:00 AM',out:'06:00 PM',loc:'Hyderabad',hours:'9.00h',src:'Auto',status:'present'},
  '2026-06-04':{in:'08:55 AM',out:'06:00 PM',loc:'Remote',hours:'9.08h',src:'Auto',status:'present'},
  '2026-06-05':{in:'09:30 AM',out:'07:00 PM',loc:'Hyderabad',hours:'9.50h',src:'Manual',status:'present'},
  '2026-06-09':{in:'09:10 AM',out:'06:20 PM',loc:'Hyderabad',hours:'9.17h',src:'Auto',status:'present'},
  '2026-06-10':{in:'09:00 AM',out:'06:00 PM',loc:'Hyderabad',hours:'9.00h',src:'Auto',status:'present'},
  '2026-06-11':{in:'09:45 AM',out:'06:30 PM',loc:'Hyderabad',hours:'8.75h',src:'Manual',status:'present'},
  '2026-06-12':{in:'09:00 AM',out:'06:00 PM',loc:'Hyderabad',hours:'9.00h',src:'Auto',status:'present'},
  '2026-06-13':{in:'10:00 AM',out:'04:00 PM',loc:'Hyderabad',hours:'6.00h',src:'Manual',status:'present'},
  '2026-06-16':{in:'09:15 AM',out:'06:30 PM',loc:'Hyderabad',hours:'9.25h',src:'Auto',status:'present'},
  '2026-06-17':{in:'09:00 AM',out:'06:00 PM',loc:'Remote',hours:'9.00h',src:'Auto',status:'present'},
  '2026-06-18':{in:'09:30 AM',out:'06:45 PM',loc:'Hyderabad',hours:'9.25h',src:'Manual',status:'present'},
  '2026-06-19':{in:'09:00 AM',out:'06:15 PM',loc:'Hyderabad',hours:'9.25h',src:'Auto',status:'present'},
  '2026-06-20':{in:'09:10 AM',out:'05:50 PM',loc:'Hyderabad',hours:'8.67h',src:'Auto',status:'present'},
  '2026-06-23':{in:'09:10 AM',out:'06:00 PM',loc:'Hyderabad',hours:'8.83h',src:'Auto',status:'present'},
  '2026-06-24':{in:'09:02 AM',out:'--',loc:'Hyderabad',hours:'--',src:'Manual',status:'inprog'}
};
function tsOpenDay(d){tsSelectedDay=d;renderADTPage();}
function tsCloseDay(){tsSelectedDay=null;renderADTPage();}

// ── ALL TIMESHEET DATA & ACTIONS ──
const allTsData=[
  {id:1,empId:'11803',name:'Antar Testemp',country:'-',empStatus:'Active',tsStatus:'Unfilled',role:'Employer of Record',initials:'AT'},
  {id:2,empId:'11755',name:'Shaun J',country:'-',empStatus:'Active',tsStatus:'Unfilled',role:'Direct Employee',initials:'SJ'},
  {id:3,empId:'11754',name:'Shaun Test1',country:'-',empStatus:'Active',tsStatus:'Unfilled',role:'Entity Super Admin',initials:'ST'}
];
// -- Set here and cleared in navigatePage, so it is true only while the user drilled in from the
// All tab and false the moment they reach the My tab any other way. atViewCalendar assigns the
// scope directly rather than going through navigatePage, which is what keeps the two paths
// distinguishable — and is now the only thing that does, since both tabs are one page id. --
let tsFromAllTimesheet=false;
function atViewCalendar(empId,name,initials,role){
  tsEmp={name:name,initials:initials,role:role||'Employee'};
  tsSelectedDay=null;
  tsFromAllTimesheet=true;
  tsScope='my';
  page='timesheet';
  renderADTPage();
}
// -- The tab strip on the Timesheet page. Switching tabs by hand is always a fresh start, so it
// drops the drill-down: the back button it draws points at a tab you are already looking at. --
function tsSetScope(s){
  tsScope=s;
  tsFromAllTimesheet=false;
  tsSelectedDay=null;
  if(s==='my')tsEmp=Object.assign({},TS_DEFAULT_EMP);
  renderADTPage();
}
// -- Employees: same idea, one axis simpler. There is no drill-down to unwind, only two lists. --
function empSetScope(s){
  empScope=s;
  // Both drawers close: each holds a record from a list the other scope does not show.
  deSelectedId=null;geSelectedId=null;
  renderADTPage();
}

// ── COMPANY SETTINGS STATE & DATA ──
let csTab='basic-details';
let csStructureTab='branch';
let csSelectedItem=null;
const csLogsData=[
  {date:'22 Apr 2026',time:'05:44:07 PM',user:'Shaun Test1',status:'Active',action:'Hvj'},
  {date:'14 Apr 2026',time:'11:28:08 PM',user:'Shaun Test1',status:'Pending',action:'Yes'},
  {date:'14 Apr 2026',time:'11:02:44 PM',user:'Shaun Test1',status:'Active',action:'Yes'}
];
function openCsSidebar(item){csSelectedItem=item;csTab='basic-details';renderADTPage();}
function closeCsSidebar(){csSelectedItem=null;renderADTPage();}
function refreshCsSidebar(){const inner=document.getElementById('cs-isb-inner');if(inner){inner.innerHTML=renderCsSidebar();requestAnimationFrame(function(){const nt=document.getElementById('cs-isb-tabs');if(nt){const a=nt.querySelector('.lp-isb-tab.active');if(a)a.scrollIntoView({inline:'start',block:'nearest'});}});}}
function csSetTab(tab){csTab=tab;refreshCsSidebar();}
function csSetStructureTab(tab){csStructureTab=tab;refreshCsSidebar();}
function csSaveLog(){
  const sel=document.getElementById('cs-log-status-sel');
  const inp=document.getElementById('cs-log-comment-inp');
  if(!sel||!inp)return;
  const status=sel.value;
  const comment=inp.value.trim();
  if(!status){sel.style.borderColor='#ef4444';setTimeout(()=>{sel.style.borderColor='';},1500);return;}
  if(!comment){inp.style.borderColor='#ef4444';setTimeout(()=>{inp.style.borderColor='';},1500);return;}
  const now=new Date();
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr=now.getDate()+' '+months[now.getMonth()]+' '+now.getFullYear();
  const h=now.getHours(),mm=now.getMinutes(),ss=now.getSeconds();
  const timeStr=(h%12||12)+':'+(mm<10?'0'+mm:mm)+':'+(ss<10?'0'+ss:ss)+' '+(h>=12?'PM':'AM');
  csLogsData.unshift({date:dateStr,time:timeStr,user:'Shaun Test1',status,action:comment});
  refreshCsSidebar();
}

renderUserDD();
