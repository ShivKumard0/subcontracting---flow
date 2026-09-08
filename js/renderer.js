function dispatchAIContractWizardPage(el){
  if(page==='ai-contract-assistant'){el.innerHTML=buildAIContractAssistantHTML();return;}
  if(page==='ai-employee-created'){el.innerHTML=buildAIEmployeeCreatedHTML();return;}
  if(page==='contract-type-select'){el.innerHTML=buildContractTypeSelectHTML();return;}
  if(page==='contract-eor'){if(aiAssistedFlow){el.innerHTML=buildAIAssistedContractSplitHTML('EOR');initAICtChatPanel();return;}el.innerHTML=buildEORContractHTML();return;}
  if(page==='contract-peo'){if(aiAssistedFlow){el.innerHTML=buildAIAssistedContractSplitHTML('PEO');initAICtChatPanel();return;}el.innerHTML=buildPEOContractHTML();return;}
  // T2 · stage 2 -> 3. The only fully automatic stage transition in the journey. The runner
  // plays quote-review's five sub-statuses across this dwell and releases it when they settle;
  // with no run it is the original 1300ms auto-advance, guard and all.
  if(page==='ai-proposal-created'){
    el.innerHTML=buildAIProposalCreatedHTML();
    if(!aicjHandoff(2,function(){if(page==='ai-proposal-created')aiSendProposalForApproval();},1300)){
      // handed to the runner — nothing else to arm
    }
    return;
  }
  if(page==='ai-proposal-waiting-approval'){el.innerHTML=buildAIProposalWaitingApprovalHTML();return;}
  if(page==='ai-contract-document'){el.innerHTML=buildAIContractDocumentHTML();return;}
  if(page==='ai-contract-awaiting-signature'){el.innerHTML=buildAIContractAwaitingSignatureHTML();return;}
  if(page==='ai-onboarding-run'){el.innerHTML=buildAIOnboardingRunHTML();return;}
  if(page==='ai-journey-complete'){el.innerHTML=buildAIJourneyCompleteHTML();return;}
}
// -- Back is a structural affordance, not a history control.
//
// This bar used to render "< whatever page you visited last" on any page with a non-empty
// nav stack, which meant every top-level destination carried one: opening Teams from Direct
// Employee showed "< Direct Employee", opening Contracts from Teams showed "< Teams". That is
// browser history leaking into app chrome, and it is noise on a page that is itself a
// navigation root — the sidebar is how you leave it.
//
// The rule now: a back control belongs on a page only when that page is a drill-down from
// another page, and it always points at that page's canonical parent — so the same screen
// always offers the same exit, however you arrived at it. getSidebarActivePage() already knows
// which sidebar destination each page belongs under, so it doubles as the parent map; a page
// that is its own parent is top-level and gets nothing.
function injectPageBackBar(id){
  const el=document.getElementById(id);
  if(!el)return;
  const parent=getSidebarActivePage(page);
  if(!parent||parent===page)return;              // top-level destination
  if(!canAccessPage(parent,portalRole))return;   // parent hidden for this role
  // Nearly every detail and wizard screen renders its own back control, pointing at the same
  // parent. Detecting that from the rendered content rather than keeping a hand-maintained
  // list of page ids means the two can never drift out of sync.
  if(el.querySelector('.ep-back,.ep-cancel-btn,.uif-exit,.ccj-back,.ccjv1-back'))return;
  const bar=document.createElement('div');
  bar.className='page-back-bar';
  bar.innerHTML='<button class="page-back-btn" onclick="navigatePage(\''+parent+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg> '+getPageTitle(parent)+'</button>';
  el.insertBefore(bar,el.firstChild);
}
function renderPageContent(id){
  renderPageContentImpl(id);
  injectPageBackBar(id);
}
function renderPageContentImpl(id){
  const el=document.getElementById(id);
  if(!el)return;
  // -- The rebuilt contract-creation journey (js/contract-journey.js). Checked before the
  // original chain because the two share no page ids and must never both claim a render.
  //
  // The host class is what makes its layout contract hold: #adt-content normally scrolls the
  // whole page, and the journey needs it to be a fixed-height flex column instead so the two
  // body columns can scroll independently. Toggled rather than added, so leaving the journey
  // for any other page restores the normal scrolling behaviour. --
  const onCCJ=typeof isCCJPage==='function'&&isCCJPage(page);
  el.classList.toggle('ccj-host',onCCJ);
  if(onCCJ){ccjRenderPage(el);return;}
  // -- The frozen V1 snapshot of that same journey (js/contract-journey-v1.js), reached only
  // from Support > Contract Journey V1. Its own host class, because the two stylesheets are
  // separate and .ccj-host is the live one's; toggled the same way so leaving either journey
  // restores normal page scrolling. The two page-id spaces (ccj-* / ccjv1-*) cannot overlap,
  // so the order of these two checks is arbitrary and neither can steal the other's render. --
  const onCCJV1=typeof isCCJV1Page==='function'&&isCCJV1Page(page);
  el.classList.toggle('ccjv1-host',onCCJV1);
  if(onCCJV1){ccjv1RenderPage(el);return;}
  if(isAIContractWizardPage(page)){
    // Screen one is the engagement-model choice and only that. Until a model is picked there is
    // no run, so there is nothing for the nine-stage rail to report — drawing it here would be
    // claiming "step 1 of 9" of a journey that has not started, above an empty page that says as
    // much. The rail arrives with the run, on the next render.
    if(page==='ai-contract-assistant'&&!aiCtActiveType()){
      el.innerHTML=buildAICtModelChooserHTML();
      return;
    }
    const cjStage=aiCtJourneyStage();
    if(cjStage>=0){
      aiCtSyncLinkedRun(cjStage);
      // No card row here. The engagement model is chosen on the screen before this one, so
      // repeating all three options above every step of the run re-asks a question that has
      // been answered — and spends ~150px doing it. Which model the run is under still has to
      // be visible, so it rides in the step header as a single chip (aiJourneyLabelHTML).
      //
      // The runner sits between the rail and the stage content: the rail says which of the nine
      // stages the run is on, the runner says what is happening inside it. It goes OUTSIDE
      // #aicj-inner deliberately — aiShowLoader() blows that node away on every stage
      // transition, so anything inside it would vanish exactly when the machine is busiest.
      // Outside, the runner keeps reporting through every loading state.
      el.innerHTML='<div class="aicj-wrap has-runner">'+buildAIContractJourneyBarHTML(cjStage)
        +buildAICtRunnerHTML(cjStage)+'<div id="aicj-inner"></div></div>';
      // Start or resume the run for this stage BEFORE the page content is dispatched, so a
      // transition the runner is about to own is already registered when the page's own
      // handoff call runs (stage 2 arms its auto-advance during dispatch).
      aicjOnStageRendered(cjStage);
      dispatchAIContractWizardPage(document.getElementById('aicj-inner'));
    }else{
      dispatchAIContractWizardPage(el);
    }
    return;
  }
  if(page==='cfg-overview'){el.innerHTML=buildCfgOverviewHTML();return;}
  if(page==='cfg-systems'){el.innerHTML=buildCfgSystemsHTML();return;}
  if(page==='cfg-system-detail'){el.innerHTML=buildCfgSystemDetailHTML();return;}
  if(page==='cfg-system-add'){el.innerHTML=buildCfgSystemAddHTML();return;}
  if(page==='cfg-user-intake'){el.innerHTML=buildCfgUserIntakeHTML();return;}
  if(page==='create-store'){el.innerHTML=buildCreateStoreHTML();return;}
  if(page==='stores'){storesEnsureLoaded();el.innerHTML=buildStoresListingHTML();return;}
  if(page==='cfg-data-foundation'){el.innerHTML=buildCfgDataFoundationHTML();return;}
  // FR3.3. Its own page id rather than reusing cfg-model-detail: the two render different shapes
  // (a flat field table vs the mapped/enrichment split) off different arrays, and one route
  // guessing which it was on from the selected id is how both eventually break.
  if(page==='cfg-category-detail'){el.innerHTML=buildCfgCategoryDetailHTML();return;}
  // The Sub-Contracting transaction — one page for all eighteen steps (js/subcontracting.js).
  if(page==='sc-txn'){el.innerHTML=buildScTxnHTML();return;}
  if(page==='cfg-model-detail'){el.innerHTML=buildCfgModelDetailHTML();return;}
  if(page==='cfg-model-add'){el.innerHTML=buildCfgModelAddHTML();return;}
  if(page==='cfg-context-journey'){el.innerHTML=buildCfgContextJourneyHTML();return;}
  if(page==='cfg-journey-detail'){el.innerHTML=buildCfgJourneyDetailHTML();initCfgFlowScroll();return;}
  if(page==='journey-simulation'){el.innerHTML=buildJourneySimulationHTML();return;}
  if(page==='ai-analytics'){el.innerHTML=buildAgentModelAnalyticsHTML();return;}
  if(page==='cfg-agents'){el.innerHTML=buildCfgAgentsHTML();return;}
  if(page==='ai-executive'){el.innerHTML=portalRole==='super-admin'?buildAIClientsListingHTML():buildAIExecutiveDashboardHTML();return;}
  if(page==='my-tasks'){el.innerHTML=buildMyTasksPageHTML();return;}
  if(page==='my-runs'){el.innerHTML=buildMyRunsPageHTML();return;}
  if(page==='ai-journey-detail'){el.innerHTML=buildAIJourneyDetailHTML();return;}
  if(page==='manual-journey-run'){el.innerHTML=buildManualJourneyRunHTML();return;}
  if(page==='ai-automate-form'){el.innerHTML=buildAutomateJourneyFormHTML();return;}
  if(page==='ai-active-automation'){el.innerHTML=buildAIActiveAutomationHTML();return;}
  if(page==='ai-run-detail'){el.innerHTML=buildAIRunDetailHTML();return;}
  if(page==='ai-journey-run'){el.innerHTML=buildAIJourneyRunHTML();return;}
  if(page==='cost-calculator'){el.innerHTML=buildCostCalculatorPageHTML();initCostCalcPage();return;}
  if(page==='leave-policies'){el.innerHTML=buildLeavePoliciesHTML();return;}
  if(page==='master-data'){mdEnsureLoaded();el.innerHTML=buildMasterDataHTML();return;}
  // -- Employees and Timesheet are single pages with a scope switch inside; the ids they
  // replaced ('direct', 'global', 'my-timesheet', 'all-timesheet') are translated to these two
  // by resolvePageAlias before they ever reach the router. --
  if(page==='employees'){el.innerHTML=buildEmployeesPageHTML();return;}
  if(page==='payroll'){el.innerHTML=buildPayrollListingHTML();return;}
  if(page==='teams'){el.innerHTML=buildTeamsListingHTML();return;}
  if(page==='contracts'){el.innerHTML=buildContractsListingHTML();return;}
  if(page==='all-leaves'){el.innerHTML=buildAllLeavesHTML();return;}
  if(page==='leave-policy-edit'){el.innerHTML=buildEditLeavePolicyHTML();return;}
  if(page==='leave-policy-add'){el.innerHTML=buildAddLeavePolicyHTML();return;}
  if(page==='leave-add'){el.innerHTML=buildAddLeaveHTML();return;}
  if(page==='team-add'){el.innerHTML=buildAddTeamHTML();return;}
  if(page==='payments'){el.innerHTML=buildPaymentsHTML();return;}
  if(page==='timesheet'){el.innerHTML=buildTimesheetPageHTML();return;}
  if(page==='settings'){el.innerHTML=buildCompanySettingsHTML();return;}
  if(page==='my-profile'){el.innerHTML=buildMyProfileHTML();return;}
  if(page==='switch-entity'){el.innerHTML=buildSwitchEntityHTML();return;}
  if(page==='support-tickets'){el.innerHTML=buildTicketsPageHTML();return;}
  if(page==='chats'){el.innerHTML=buildChatsPageHTML();return;}
  /* -- Dashboard stays its own page, and the merge that briefly folded it into the launcher is
     reversed. The reason is in the data, not in taste: dashboardTabsForRole resolves to
     THIRTEEN role-specific boards — Deal Desk, Sales Team, Deal Approvals, Compliance,
     Contracts, HR, Reporting Manager, IT Systems, Finance Approval, Finance Admin, Store
     Operations, Ops, Ops Approvals — plus employee self-service. That is where a role starts
     the day. The launcher lists journeys you can start. Two questions, two pages. -- */
  if(page==='dashboard'){el.innerHTML=buildDashboardPageHTML();return;}
  el.innerHTML=buildListingHTML(page);
}

function renderADTPage(){
  const title=document.getElementById('adt-page-title');
  if(title)title.textContent=getPageTitle(page);
  // Show/hide + button in topbar based on current page
  const addBtn=document.getElementById('tb-page-add-btn');
  if(addBtn){
    /* -- The ten Workspace modules are listed here because addListingItem has no branch for any
       of them: leaving the + visible would put a button on ten pages that does nothing when
       pressed, which is worse than no button. Each one comes off this list when its own create
       action exists — that is the single edit that turns the + back on. -- */
    const noAddPages=['team-management','store-management','orders-billing','products-inventory','category','community','staff-roles','pricing-discounts','reports-analytics','settings-support',
      'cfg-category-detail','sc-txn',
      'dashboard','cost-calculator','leave-policy-add','leave-policy-edit','team-add','leave-add','contract-type-select','contract-eor','contract-peo','timesheet','settings','my-profile','support-tickets','chats','switch-entity','ai-executive','my-tasks','my-runs','ai-journey-detail','ai-automate-form','ai-active-automation','ai-run-detail','ai-journey-run','ai-contract-assistant','ai-proposal-created','ai-proposal-waiting-approval','ai-employee-created','ai-contract-document','ai-contract-waiting-approval','ai-onboarding-run','ai-journey-complete','cfg-overview','cfg-systems','cfg-system-detail','cfg-system-add','cfg-user-intake','create-store','stores','cfg-data-foundation','cfg-model-detail','cfg-model-add','cfg-context-journey','cfg-journey-detail','cfg-agents','ai-analytics','journey-simulation','manual-journey-run','master-data'];
    /* The + is "add another row to this listing". The contract journey is not a listing — it is one
       run in progress, and the only thing a + could mean there is "start a second one over the top
       of this", which is not an action this page offers. Excluded by predicate rather than by adding
       nine ids to the list above, because the journey's page ids are derived from the stage list. */
    const show=!noAddPages.includes(page)
      && !(typeof isCCJPage==='function'&&isCCJPage(page));
    addBtn.style.display=show?'':'none';
    if(show){
      const specialHandlers={'leave-policies':()=>{selectedEmps=new Set();apFilterType='';apFilterValue='';page='leave-policy-add';renderADTPage();}};
      addBtn.onclick=specialHandlers[page]||(()=>addListingItem(page));
    }
  }
  const ccBtn=document.getElementById('tb-cost-calc-btn');
  if(ccBtn)ccBtn.style.display=page==='contracts'?'':'none';
  buildSidebar('adt-sidebar',adtSidebarCollapsed,getSidebarActivePage(page));
  renderNotifBadge();
  const sidebar=document.getElementById('adt-sidebar');
  if(sidebar)sidebar.style.display=isFocusedFlowPage(page)?'none':'';
  renderPageContent('adt-content');
  // Only when the screen actually changed — see adtScrollKey. Scrolling on every redraw threw
  // the reader to the top of a form each time they touched a control on it.
  adtMaybeScrollTop();
  focusFlowPrimaryField();
  persistAppState();
}

/* == FOCUS MODE =========================================================================
   A journey is a task with a beginning and an end, not a place you browse from. While one is
   running the sidebar is hidden, so the run owns the viewport and the only ways forward are
   the step's own controls — you finish the step or you leave deliberately.

   Safe to hide because injectPageBackBar guarantees an exit on every one of these pages: it
   adds a back control unless the page already renders its own, so there is always exactly one
   and never zero. == */
function isJourneyFocusPage(pg){
  return pg==='ai-journey-run'          // an activated journey mid-run
    ||pg==='manual-journey-run'         // the same journey run by hand
    ||pg==='journey-simulation'         // a dry run of a configured journey
    ||pg==='ai-automate-form'           // the wizard that activates one
    ||isAIContractWizardPage(pg)        // the whole contract-creation chain
    ||(typeof isCCJPage==='function'&&isCCJPage(pg))  // and its rebuilt replacement
    ||(typeof isCCJV1Page==='function'&&isCCJV1Page(pg)); // and the frozen V1 snapshot of that
}
// Plus the two linear flows that already worked this way: the cost calculator and the USER
// intake form.
function isFocusedFlowPage(pg){
  return pg==='cost-calculator'||pg==='cfg-user-intake'||pg==='create-store'||isJourneyFocusPage(pg);
}

/* == PRIMARY FIELD FOCUS ================================================================
   Every step of a flow has one field it is really asking for. Landing with the caret already
   in it removes a click the user makes every single time, and it answers "what does this
   screen want from me" before they have read anything.

   Deliberately keyed on page + step rather than fired on every render: renderADTPage runs on
   any state change — a timeline tick, a toggle, a filter — and re-focusing on each of those
   would yank the caret out of whatever the user had actually clicked into. == */
function flowPrimaryFieldId(pg){
  // The rebuilt journey's stage 1 is a conversation, and its one question is the composer.
  if(pg==='ccj-request-received')return 'ccj-prompt';
  if(pg==='ccjv1-request-received')return 'ccjv1-prompt';   // the same stage in the frozen V1 snapshot
  if(pg==='ai-journey-run')return 'ai-run-prompt';
  if(pg==='ai-contract-assistant')return 'ai-ct-prompt';
  if(pg==='contract-eor'||pg==='contract-peo'){
    // Assisted mode renders all three steps at once for review, so the form's own first field wins.
    if(typeof aiAssistedFlow!=='undefined'&&aiAssistedFlow)return 'peo-nationality';
    const step=pg==='contract-eor'?eorStep:peoStep;
    return step===1?'peo-jobtitle':step===2?'peo-prob':'peo-nationality';
  }
  if(pg==='cfg-user-intake')return 'cfg-ui-full_name';
  if(pg==='cfg-system-add')return 'cfg-sys-add-name';
  if(pg==='cfg-model-add')return 'cfg-model-add-name';
  if(pg==='team-add')return 'team-name';
  if(pg==='leave-add')return 'al-emp-search';
  if(pg==='leave-policy-add')return 'ap-yearly';
  return '';
}
// -- The step counters live outside `page`, so they have to be part of the key: moving from
// Basic Details to Job Details is a new question and deserves a new focus. --
function flowFocusKey(){
  const step=page==='contract-eor'?eorStep
    :page==='contract-peo'?peoStep
    :page==='cfg-user-intake'?cfgUserIntakeStep
    :'';
  return page+':'+step;
}
let lastFlowFocusKey='';
function focusFlowPrimaryField(){
  const key=flowFocusKey();
  if(key===lastFlowFocusKey)return;
  const id=flowPrimaryFieldId(page);
  // Nothing to focus here — record the key so this page stops being reconsidered every render.
  if(!id){lastFlowFocusKey=key;return;}
  const el=document.getElementById(id);
  // Not rendered yet. The USER intake form, for one, waits on ADT's field schema before it has
  // any inputs at all. Leaving the key unset means the next render tries again.
  if(!el)return;
  lastFlowFocusKey=key;
  // preventScroll because aiScrollContentToTop has just put the page where it wants it, and a
  // focus that scrolls would undo that on any step tall enough to matter.
  requestAnimationFrame(function(){
    try{el.focus({preventScroll:true});}catch(e){el.focus();}
  });
}

// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ INIT ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
const dashboardContentHTML=document.getElementById('adt-content').innerHTML;
loadAppState();
renderADTPage();

// -- Pull Client records from the backend once on load, so they survive a refresh and show up
// in every browser rather than only the one that ingested them. Deliberately after the first
// render and non-blocking: the backend may not be running (this page still opens as a static
// file), and everything except Client works without it. --
(function hydrateFromBackend(){
  if(typeof mdRefreshFromBackend!=='function')return;
  mdRefreshFromBackend().then(function(){renderADTPage();});
})();

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ COST CALCULATOR ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
const ccCountries=[
  {id:'nl',name:'Netherlands',flag:'NL',currency:'EUR',symbol:'ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬',salary:60000,
    items:[
      {label:'Base Salary',note:'Annual gross',val:60000,pct:null},
      {label:'Employer Social Security (AOW/WW/WAO)',note:'23% of gross',val:13800,pct:'23%'},
      {label:'Holiday Pay (Vakantiegeld)',note:'8% of gross',val:4800,pct:'8%'},
      {label:'Pension Contribution',note:'5% of gross',val:3000,pct:'5%'},
      {label:'Work-related Expenses Allowance',note:'Flat per employee per year',val:750,pct:null}
    ]},
  {id:'in',name:'India',flag:'IN',currency:'INR',symbol:'ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹',salary:1200000,
    items:[
      {label:'Base Salary (CTC)',note:'Annual gross',val:1200000,pct:null},
      {label:'Employer PF (Provident Fund)',note:'12% of basic salary',val:86400,pct:'12%'},
      {label:'Employer ESI',note:'3.25% on wages up to threshold',val:39000,pct:'3.25%'},
      {label:'Gratuity Provision',note:'4.81% of basic salary',val:34632,pct:'4.81%'},
      {label:'LWF & Professional Tax',note:'State levied, fixed amount',val:2400,pct:null}
    ]},
  {id:'de',name:'Germany',flag:'DE',currency:'EUR',symbol:'ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬',salary:55000,
    items:[
      {label:'Base Salary',note:'Annual gross',val:55000,pct:null},
      {label:'Pension Insurance (Rentenversicherung)',note:'9.3% of gross',val:5115,pct:'9.3%'},
      {label:'Unemployment Insurance',note:'1.2% of gross',val:660,pct:'1.2%'},
      {label:'Health Insurance (Krankenversicherung)',note:'7.3% of gross',val:4015,pct:'7.3%'},
      {label:'Long-term Care Insurance (Pflegeversicherung)',note:'1.775% of gross',val:976,pct:'1.775%'}
    ]}
];
let ccActive='nl';
let ccLoading=false;

function openCostCalculator_popup(){
  const el=document.getElementById('cost-calc-overlay');
  if(!el)return;
  el.classList.remove('hidden');
  renderCCTabs();
  renderCCContent(ccActive,false);
}
function closeCostCalculator(){
  const el=document.getElementById('cost-calc-overlay');
  if(el)el.classList.add('hidden');
}
function renderCCTabs(){
  const el=document.getElementById('cc-tabs');
  if(!el)return;
  el.innerHTML=ccCountries.map(c=>`<button class="cc-tab${c.id===ccActive?' active':''}" onclick="selectCCCountry('${c.id}')">${c.flag === 'NL' ? '&#127475;&#127473;' : c.flag === 'IN' ? '&#127470;&#127475;' : '&#127465;&#127466;'} ${c.name}</button>`).join('');
}
function selectCCCountry(id){
  if(ccLoading||id===ccActive)return;
  ccActive=id;
  renderCCTabs();
  renderCCContent(id,true);
}
function renderCCContent(id,animated){
  const loader=document.getElementById('cc-loader');
  const body=document.getElementById('cc-content');
  if(!loader||!body)return;
  if(animated){
    ccLoading=true;
    loader.classList.remove('hidden');
    body.classList.add('hidden');
    setTimeout(()=>{
      loader.classList.add('hidden');
      body.classList.remove('hidden');
      buildCCBody(id,body);
      ccLoading=false;
    },1800);
  }else{
    loader.classList.add('hidden');
    body.classList.remove('hidden');
    buildCCBody(id,body);
  }
}
function buildCCBody(id,el){
  const c=ccCountries.find(x=>x.id===id);
  if(!c)return;
  const total=c.items.reduce((a,b)=>a+b.val,0);
  const overhead=c.items.filter(x=>x.val!==c.salary).reduce((a,b)=>a+b.val,0);
  const overheadPct=Math.round((overhead/c.salary)*100);
  const fmt=v=>c.symbol+v.toLocaleString();
  el.innerHTML=`<div class="cc-summary"><div><div class="cc-summary-label">Estimated Annual Employer Cost</div><div class="cc-summary-val">${fmt(total)}</div><div class="cc-summary-note">${c.currency} &bull; All figures are estimates</div></div><div style="text-align:right"><div class="cc-summary-label">Base Salary</div><div style="font-size:20px;font-weight:700">${fmt(c.salary)}</div><div class="cc-summary-note">Overhead: +${overheadPct}% above salary</div></div></div><div class="cc-breakdown"><div class="cc-breakdown-title">Cost Breakdown</div>${c.items.map(item=>`<div class="cc-row"><div><div class="cc-row-label">${item.label}</div><div class="cc-row-note">${item.note}</div></div><div style="text-align:right"><div class="cc-row-val">${fmt(item.val)}</div>${item.pct?`<div class="cc-row-pct">${item.pct}</div>`:''}</div></div>`).join('')}<div class="cc-total-row"><span class="cc-total-label">Total Annual Cost to Employer</span><span class="cc-total-val">${fmt(total)}</span></div></div><div class="cc-disclaimer">Estimates based on standard rates from ADT Compliance Hub. Actual costs vary by salary band, contract type, and local regulations. Last updated: May 2026.</div>`;
}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeCostCalculator();});function openCostCalculator(){ccActiveCountry='nl';navigatePage('cost-calculator');}

const ccPageData={
  nl:{name:'Netherlands',sym:'&#8364;',symT:'€',cur:'EUR',def:75000,min:10000,max:100000,socialLabel:'LE + SI + STW + WK + IA',benLabel:'Holiday Allowance (8%)',items:[{label:'Unemployment Insurance',rate:0.0274},{label:'Disability Insurance',rate:0.0627},{label:'Accident / Return-to-Work',rate:0.0152},{label:'Childcare Levy',rate:0.0050},{label:'Health Insurance',rate:0.0428}],benefits:[{label:'Holiday Allowance',rate:0.08}]},
  in:{name:'India',sym:'&#8377;',symT:'₹',cur:'INR',def:100000,min:20000,max:500000,socialLabel:'PF + ESI + Gratuity',benLabel:'LWF & Professional Tax',items:[{label:'Employer PF (Provident Fund)',rate:0.06},{label:'Employer ESI',rate:0.0325},{label:'Gratuity Provision',rate:0.0231}],benefits:[{label:'LWF & Professional Tax',flat:200}]},
  de:{name:'Germany',sym:'&#8364;',symT:'€',cur:'EUR',def:5000,min:1000,max:20000,socialLabel:'Rentenversicherung + KV + ALV',benLabel:'',items:[{label:'Pension Insurance (Rentenversicherung)',rate:0.093},{label:'Unemployment Insurance (ALV)',rate:0.012},{label:'Health Insurance (Krankenversicherung)',rate:0.073},{label:'Long-term Care Insurance (PV)',rate:0.01775}],benefits:[]}
};
let ccActiveCountry='nl';
let ccSalary=75000;function buildCostCalculatorPageHTML(){
  return `<div class="cc-page"><div class="cc-subhdr"><button class="cc-back-btn" onclick="navigatePage('contracts')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>Cost calculator as per country</button><button class="cc-export-btn">Export PDF</button></div><div class="cc-page-body"><div class="cc-left-panel"><div class="cc-inputs-card"><div class="cc-input-group"><label class="cc-input-label">Country</label><select class="cc-country-sel" id="cc-country-sel" onchange="ccChangeCountry(this.value)"><option value="nl">Netherlands</option><option value="in">India</option><option value="de">Germany</option></select></div><div class="cc-input-group" style="margin-top:14px"><label class="cc-input-label">Gross Monthly Salary</label><div class="cc-salary-inp-wrap"><span class="cc-salary-sym" id="cc-sym">&#8364;</span><input type="number" class="cc-salary-inp" id="cc-salary-input" value="75000" oninput="ccUpdateFromInput(this.value)"></div></div></div><div class="cc-summary-card"><div class="cc-summary-ttl">Cost Summary</div><div class="cc-sum-row"><div><div class="cc-sum-row-label">Gross Monthly Salary</div><div class="cc-sum-row-note">Employee gross</div></div><div class="cc-sum-row-val" id="cc-sum-salary"></div></div><div class="cc-sum-row"><div><div class="cc-sum-row-label">Employer Social Security</div><div class="cc-sum-row-note" id="cc-sum-social-note"></div></div><div class="cc-sum-row-val cc-sum-plus" id="cc-sum-social"></div></div><div class="cc-sum-row" id="cc-sum-ben-row"><div><div class="cc-sum-row-label">Mandatory Benefits</div><div class="cc-sum-row-note" id="cc-sum-ben-note"></div></div><div class="cc-sum-row-val cc-sum-plus" id="cc-sum-benefits"></div></div><div class="cc-sum-total-row"><span class="cc-sum-total-lbl">Total Employer Cost</span><span class="cc-sum-total-val" id="cc-sum-total"></span></div><div class="cc-compliance-note"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>All rates sourced live from the Compliance Hub database</div></div></div><div class="cc-right-panel"><div class="cc-salary-display"><div class="cc-salary-display-label">Gross Monthly Salary</div><div class="cc-salary-display-val" id="cc-display-salary"></div><input type="range" class="cc-slider" id="cc-salary-slider" oninput="ccUpdateFromSlider(this.value)"><div class="cc-slider-limits"><span id="cc-slider-min-lbl"></span><span id="cc-slider-max-lbl"></span></div></div><div class="cc-breakdown-card"><div class="cc-breakdown-card-title">Cost Breakdown</div><table class="cc-bd-table"><thead><tr><th class="cc-th-line">Cost Line</th><th class="cc-th-rate">Rate</th><th class="cc-th-amt">Amount</th></tr></thead><tbody id="cc-bd-body"></tbody><tfoot><tr class="cc-bd-total-row"><td colspan="2">Total Employer Cost</td><td id="cc-bd-total"></td></tr></tfoot></table></div></div></div></div>`;
}


function initCostCalcPage(){
  const d=ccPageData[ccActiveCountry];ccSalary=d.def;
  const inp=document.getElementById('cc-salary-input');if(inp){inp.value=d.def;inp.min=d.min;inp.max=d.max;}
  const sl=document.getElementById('cc-salary-slider');if(sl){sl.min=d.min;sl.max=d.max;sl.value=d.def;}
  const sel=document.getElementById('cc-country-sel');if(sel)sel.value=ccActiveCountry;
  document.getElementById('cc-sym').innerHTML=d.sym;
  const minLbl=document.getElementById('cc-slider-min-lbl');if(minLbl)minLbl.textContent=d.symT+' '+d.min.toLocaleString();
  const maxLbl=document.getElementById('cc-slider-max-lbl');if(maxLbl)maxLbl.textContent=d.symT+' '+d.max.toLocaleString();
  ccRender();
}
function ccChangeCountry(id){
  ccActiveCountry=id;const d=ccPageData[id];ccSalary=d.def;
  const inp=document.getElementById('cc-salary-input');if(inp){inp.value=d.def;inp.min=d.min;inp.max=d.max;}
  const sl=document.getElementById('cc-salary-slider');if(sl){sl.min=d.min;sl.max=d.max;sl.value=d.def;}
  document.getElementById('cc-sym').innerHTML=d.sym;
  const minLbl=document.getElementById('cc-slider-min-lbl');if(minLbl)minLbl.textContent=d.symT+' '+d.min.toLocaleString();
  const maxLbl=document.getElementById('cc-slider-max-lbl');if(maxLbl)maxLbl.textContent=d.symT+' '+d.max.toLocaleString();
  ccRender();
}
function ccUpdateFromSlider(v){ccSalary=parseInt(v);const inp=document.getElementById('cc-salary-input');if(inp)inp.value=ccSalary;ccRender();}
function ccUpdateFromInput(v){const d=ccPageData[ccActiveCountry];ccSalary=Math.max(d.min,Math.min(d.max,parseInt(v)||d.min));const sl=document.getElementById('cc-salary-slider');if(sl)sl.value=ccSalary;ccRender();}
function ccRender(){
  const d=ccPageData[ccActiveCountry];const s=ccSalary;const sym=d.symT;
  const fmt=v=>sym+' '+Math.round(v).toLocaleString();
  const socialItems=d.items.map(item=>({...item,amt:Math.round(s*item.rate)}));
  const socialTotal=socialItems.reduce((a,b)=>a+b.amt,0);
  const benItems=d.benefits.map(b=>({...b,amt:b.flat!=null?b.flat:Math.round(s*b.rate)}));
  const benTotal=benItems.reduce((a,b)=>a+b.amt,0);
  const grandTotal=s+socialTotal+benTotal;
  const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setText('cc-sum-salary',fmt(s));setText('cc-sum-social','+ '+fmt(socialTotal));setText('cc-sum-social-note',d.socialLabel);
  setText('cc-sum-benefits','+ '+fmt(benTotal));setText('cc-sum-ben-note',d.benLabel);setText('cc-sum-total',fmt(grandTotal));
  setText('cc-display-salary',fmt(s));setText('cc-bd-total',fmt(grandTotal));
  const benRow=document.getElementById('cc-sum-ben-row');if(benRow)benRow.style.display=benTotal>0?'flex':'none';
  const tbody=document.getElementById('cc-bd-body');
  if(tbody)tbody.innerHTML=[...socialItems,...benItems].map(item=>`<tr><td>${item.label}</td><td><span class="cc-bd-rate">${item.flat!=null?'Fixed':(item.rate*100).toFixed(2)+'%'}</span></td><td class="cc-bd-amount">${fmt(item.amt)}</td></tr>`).join('');
}
// == SEARCH OVERLAY ==
function openSearch(){
  var ov=document.getElementById('search-overlay');
  if(!ov)return;
  ov.classList.add('open');
  var inp=document.getElementById('search-input');
  if(inp){inp.value='';setTimeout(function(){inp.focus();},80);}
  var clr=document.getElementById('search-clear-btn');
  if(clr)clr.classList.remove('visible');
}
function closeSearch(){
  var ov=document.getElementById('search-overlay');
  if(ov)ov.classList.remove('open');
}
function clearSearch(){
  var inp=document.getElementById('search-input');
  if(inp){inp.value='';inp.focus();}
  var clr=document.getElementById('search-clear-btn');
  if(clr)clr.classList.remove('visible');
}
function onSearchInput(inp){
  var clr=document.getElementById('search-clear-btn');
  if(clr)clr.classList.toggle('visible',inp.value.length>0);
}
function fillSearch(text){
  var inp=document.getElementById('search-input');
  if(inp){inp.value=text;inp.focus();onSearchInput(inp);}
}
function executeSearch(text){
  var inp=document.getElementById('search-input');
  var q=String(text||(inp&&inp.value)||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!q)return;
  var target='';
  var status=q.includes('pending')?'Pending':q.includes('inactive')?'Inactive':q.includes('active')?'Active':'';
  if(q.includes('inactive employee')){geStatusFilter='Inactive';target='global';}
  else if(q.includes('active employee')){geStatusFilter='Active';target='global';}
  else if(q.includes('global employee')||q==='employees'||q==='employee listing'){geStatusFilter='';target='global';}
  else if(q.includes('contract')){target='contracts';}
  else if(q.includes('payroll')){if(status)listStatusFilters.payroll=status;else delete listStatusFilters.payroll;target='payroll';}
  else if(q.includes('compliance')){if(status)listStatusFilters.compliance=status;else delete listStatusFilters.compliance;target='compliance';}
  else if(q.includes('leave request')||q.includes('leave requests')){alStatusFilter=status||'';target='all-leaves';}
  else if(q.includes('payment')||q.includes('invoice')){pmInvoiceStatusFilter=status==='Active'?'Paid':status||'';target='payments';}
  if(target){closeSearch();navigatePage(target);}
}
function onSearchKeydown(e){
  if(e.key==='Enter'){e.preventDefault();executeSearch();}
}
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){closeSearch();}
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openSearch();}
});
// --- ATTENDANCE CLOCK ---
var _clockedIn=false,_clockTimer=null,_clockSecs=0;
function toggleClock(){_clockedIn?_doClockOut():_doClockIn();}
function _doClockIn(){
  _clockedIn=true;
  var now=new Date();
  var timeStr=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
  document.getElementById('att-clockin-time').textContent=timeStr;
  document.getElementById('att-status-row').style.display='block';
  _clockSecs=0;
  _clockTimer=setInterval(function(){
    _clockSecs++;
    var h=Math.floor(_clockSecs/3600),m=Math.floor((_clockSecs%3600)/60),s=_clockSecs%60;
    document.getElementById('att-logged-time').textContent='Logged Time - '+String(h).padStart(2,'0')+'h:'+String(m).padStart(2,'0')+'m:'+String(s).padStart(2,'0')+'s';
  },1000);
  var btn=document.getElementById('att-clock-btn');
  btn.textContent='Clock Out';btn.classList.add('out');
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(function(p){
      var lat=p.coords.latitude.toFixed(4),lng=p.coords.longitude.toFixed(4);
      document.getElementById('att-location').textContent=lat+', '+lng;
      document.getElementById('att-in-badge').style.display='inline-flex';
    },function(){
      document.getElementById('att-location').textContent='Hyderabad';
      document.getElementById('att-in-badge').style.display='inline-flex';
    });
  } else {
    document.getElementById('att-location').textContent='Hyderabad';
    document.getElementById('att-in-badge').style.display='inline-flex';
  }
}
function _doClockOut(){
  _clockedIn=false;
  clearInterval(_clockTimer);_clockTimer=null;
  document.getElementById('att-status-row').style.display='none';
  document.getElementById('att-clockin-time').textContent='--:-- --';
  document.getElementById('att-location').textContent='--';
  document.getElementById('att-in-badge').style.display='none';
  document.getElementById('att-logged-time').textContent='Logged Time - 00h:00m';
  var btn=document.getElementById('att-clock-btn');
  btn.textContent='Clock In';btn.classList.remove('out');
}
