// Headless checks for the Contract Creation sub-status runner.
//
//   node test/runner-harness.js
//
// Loads the real app scripts into a vm context with a stubbed DOM and asserts on the HTML the
// builders produce. There is no browser here and no test framework — the app is plain scripts
// with lexical `let` bindings at top level, so the only honest way to exercise it is to run it
// as it actually runs and read the strings it emits.
//
// The first assertion is the important one. Everything the runner does rests on stage index i
// meaning the same stage in three separate stores; if that ever drifts, every sub-status in the
// journey silently attaches to the wrong stage and nothing else here would catch it.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const noop = function () {};
const el = () => ({
  innerHTML: '', style: {}, dataset: {}, children: [], firstChild: null,
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  appendChild: noop, insertBefore: noop, removeChild: noop, remove: noop,
  addEventListener: noop, removeEventListener: noop,
  setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
  querySelector: () => null, querySelectorAll: () => [],
  focus: noop, click: noop, scrollTo: noop, scrollIntoView: noop
});

const store = {};
const ctx = {
  console,
  setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
  requestAnimationFrame: noop,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }, clear: () => {}
  },
  location: { href: '', hash: '', search: '' },
  history: { pushState: noop, replaceState: noop },
  navigator: { userAgent: 'node' },
  matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }),
  document: {
    getElementById: () => el(), querySelector: () => null, querySelectorAll: () => [],
    createElement: () => el(), body: el(), documentElement: el(),
    addEventListener: noop, cookie: ''
  },
  // renderer.js is not loaded (it runs init against a real DOM), so the few functions pages.js
  // calls out to are stubbed. None of them affect the strings under test.
  renderADTPage: noop, navigatePage: noop, showAiToast: noop
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

for (const f of ['js/exec-config.js', 'js/execApi.js', 'js/core.js', 'js/pages.js']) {
  try {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  } catch (e) {
    console.error('FATAL: could not load ' + f + ' — ' + e.message);
    process.exit(1);
  }
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '\n          ' + detail : '')); }
}
function run(expr) { return vm.runInContext(expr, ctx); }
function section(t) { console.log('\n' + t); }

// An Account Manager is the persona this surface is built for, so modes resolve as they will
// for the person actually using it.
run("portalRole='entity-user';activePersonaId='account-manager';page='ai-contract-assistant';");

/* -------------------------------------------------------------------- 1. the join ---- */
section('1. The join invariant — everything rests on this');
const stages = run('amPipelineStages.length');
const events = run("aiJourneyEvents['contract-creation'].length");
const groups = run('Object.keys(amSubStatuses).length');
const total = run('Object.keys(amSubStatuses).reduce(function(s,k){return s+amSubStatuses[k].length;},0)');
check('9 stages, 9 journey events, 9 sub-status groups',
  stages === 9 && events === 9 && groups === 9,
  'stages=' + stages + ' events=' + events + ' groups=' + groups);
// 40 since the follow-up sub-status came out of quote-review: chasing a client moves nothing,
// so it is an action on the record rather than a position in the work. See amSubStatuses.
check('40 sub-statuses in total', total === 40, 'found ' + total);
check('every stage index resolves to its own sub-status group',
  run(`(function(){for(let i=0;i<9;i++){if(aicjStageId(i)!==amPipelineStages[i].id)return false;
        if(aicjSteps(i)!==amSubStatuses[amPipelineStages[i].id])return false;}return true;})()`));

/* ------------------------------------------------------------ 2. descriptor coverage ---- */
section('2. Descriptor coverage — all 41 render, authored or derived');
const cov = run(`(function(){
  const bad=[];let authored=0,derived=0;
  for(let i=0;i<9;i++){aicjSteps(i).forEach(function(s){
    const d=aicjDescriptorFor(i,s);
    if(!d||!d.note)bad.push(aicjStageId(i)+'/'+s.label);
    if(d.derived)derived++;else authored++;
  });}
  return {bad:bad,authored:authored,derived:derived};
})()`);
check('every sub-status has a descriptor with a note', cov.bad.length === 0, cov.bad.join(', '));
console.log('        authored ' + cov.authored + ' · derived ' + cov.derived
  + '  (derived is a progress metric, not a failure)');

const evalErrs = run(`(function(){
  const c=aicjCtx(),errs=[];
  for(let i=0;i<9;i++){aicjSteps(i).forEach(function(s){
    const d=aicjDescriptorFor(i,s);
    ['call','latency','fetched','checks','captured','summary','applies'].forEach(function(f){
      try{aicjVal(d[f],c);}catch(e){errs.push(aicjStageId(i)+'/'+s.label+'.'+f+': '+e.message);}
    });
  });}
  return errs;
})()`);
check('no descriptor function throws when evaluated', evalErrs.length === 0, evalErrs.join('\n          '));

/* --------------------------------------------------------------- 3. every label shows ---- */
section('3. Every one of the 41 labels reaches the screen');
const missing = run(`(function(){
  const out=[];
  for(let i=0;i<9;i++){const h=buildAICtRunnerHTML(i);
    aicjSteps(i).forEach(function(s){ if(h.indexOf(s.label)===-1)out.push(aicjStageId(i)+'/'+s.label); });}
  return out;
})()`);
check('all 41 labels present in their stage card', missing.length === 0, missing.join(', '));
check('exactly one rail card is .current per stage',
  run(`(function(){for(let i=0;i<9;i++){
        const m=buildAICtRunnerHTML(i).match(/class="aicj-scard current"/g);
        if(!m||m.length!==1)return false;}return true;})()`));
check('the rail shows one card per sub-status',
  run(`(function(){for(let i=0;i<9;i++){
        const m=buildAICtRunnerHTML(i).match(/class="aicj-scard /g)||[];
        if(m.length!==aicjSteps(i).length)return false;}return true;})()`));
check('exactly one evidence panel is rendered, whatever the sub-status count',
  run(`(function(){for(let i=0;i<9;i++){
        const m=buildAICtRunnerHTML(i).match(/aicj-runner-body/g)||[];
        if(m.length!==2)return false;}return true;})()`));

/* ------------------------------------------------------------------- 4. flags → UI ---- */
section('4. Authored flags reach the markup');
check('auto steps carry the auto tag',
  run(`(function(){const h=buildAICtRunnerHTML(0);
        return h.indexOf('am-sub-tag auto')>-1;})()`));
check('a skipped step shows its reason on the rail without a click',
  run(`(function(){const h=buildAICtRunnerHTML(1);
        return h.indexOf('aicj-scard skipped')>-1 && h.indexOf('non-owned countries')>-1;})()`));
check('persona:null (Worker) yields no button anywhere in its body',
  run(`(function(){const i=6,steps=aicjSteps(i),k=steps.findIndex(function(s){return s.label==='Worker signed';});
        const h=aicjEvidenceHTML(i,k);
        return h.indexOf('<button')===-1 && aicjStepMode(i,steps[k])==='external-wait';})()`));
check('an owned decision resolves to the actionable mode for this persona',
  run(`(function(){const i=0,steps=aicjSteps(i),k=steps.findIndex(function(s){return s.decision;});
        return aicjStepMode(i,steps[k])==='act';})()`));

/* ---------------------------------------------------------------- 5. the real data ---- */
section('5. Evidence is anchored to data the app already holds');
const s1 = run(`(function(){const steps=aicjSteps(1),k=steps.findIndex(function(s){return s.label==='Country data check';});
                return aicjEvidenceHTML(1,k);})()`);
check('Country data check shows the real Netherlands rules', ['EUR 14.71', '2.74%', '8.00%', '35.75%']
  .every((v) => s1.indexOf(v) > -1));
check('the Active/Inactive split is visible', s1.indexOf('inactive (excluded)') > -1 || s1.indexOf('4 inactive') > -1);
// A rule the country has on the books but is not applying is a fact, not a failure — it must
// render in the neutral tone, never the red one reserved for something being wrong.
check('an inactive rule is NOT rendered in error red',
  s1.indexOf('aicj-row-v off') > -1 && s1.indexOf('status-pill inactive') === -1);
const s1b = run(`(function(){const steps=aicjSteps(1),k=steps.findIndex(function(s){return s.label==='Statutory floor check';});
                 return aicjEvidenceHTML(1,k);})()`);
check('Statutory floor check compares against the EUR 14.71 floor',
  s1b.indexOf('14.71') > -1 && s1b.indexOf('aicj-check pass') > -1);

/* ----------------------------------------------------------- 6. no link goes nowhere ---- */
section('6. Every click-through resolves to something real');
check('the agent badge names an agent that exists in the catalogue',
  run(`(function(){const ev=aiJourneyEvents['contract-creation'];
        for(let i=0;i<ev.length;i++){const h=aiAgentBadgeHTML(ev[i].source);
          if(h && !findCfgAgentByName(ev[i].source))return false;}
        return !!findCfgAgentByName('AI Compliance Hub Sync');})()`));
check('a systemId on a descriptor always matches a real cfgSystems record',
  run(`(function(){const bad=[];
        Object.keys(aicjEvidence).forEach(function(k){const d=aicjEvidence[k];
          if(d.systemId && !cfgSystems.find(function(s){return s.id===d.systemId;}))bad.push(k);});
        return bad.length===0;})()`));
check('a system with no record renders unlinked rather than as a dead button',
  run(`(function(){const steps=aicjSteps(1),k=steps.findIndex(function(s){return s.label==='Country data check';});
        const h=aicjEvidenceHTML(1,k);
        return h.indexOf('aicj-ev-sys unlinked')>-1 && h.indexOf('cfg-system-detail')===-1;})()`));

/* -------------------------------------------------------------- 7. purely additive ---- */
section('7. Purely additive — the pipeline board cannot regress');
const before = run('JSON.stringify(amSubStatuses)');
run(`(function(){for(let i=0;i<9;i++){buildAICtRunnerHTML(i);
      aicjSteps(i).forEach(function(s,k){aicjEvidenceHTML(i,k);});}})()`);
check('amSubStatuses is byte-identical after rendering every stage',
  run('JSON.stringify(amSubStatuses)') === before);
check('the pipeline board cell still renders',
  run(`(function(){const h=amSubCellHTML({stage:'quote-prep',sub:1});
        return typeof h==='string' && h.indexOf('Partner cost requested')>-1;})()`));

/* --------------------------------------------------------------- 8. non-regression ---- */
section('8. Nothing that already worked was removed');
check('onboarding keeps its three rich detail bodies',
  run(`(function(){aiCtOnboardingStep=1;const h=buildAIOnboardingRunHTML();
        return h.indexOf('Fetching from Compliance Hub')>-1;})()`));
check('the nine-card rail still renders nine cards',
  run(`(function(){aiCtAnimatedStage=-1;const h=buildAIContractJourneyBarHTML(4);
        return (h.match(/class="aicj-card /g)||[]).length===9;})()`));
check('both approval gates still reference their own handlers',
  run(`(function(){return buildAIProposalWaitingApprovalHTML().indexOf('aiSimulateApproval')>-1
        && buildAIContractAwaitingSignatureHTML().indexOf('aiSimulateContractApproval')>-1;})()`));
// The cards show AI_EXEC_CARD_COPY names, not the catalogue names. Asserting the absence of the
// catalogue name is the half that has teeth: it is what fails if the override map stops being
// consulted and j.name falls through to the card.
check('the AI Executive cards render the launcher copy, not the catalogue names',
  run(`(function(){portalRole='entity-user';activePersonaId='account-manager';
        const h=buildAIExecutiveDashboardHTML();
        return h.indexOf('Create Client')>-1 && h.indexOf('Hire and Onboard')>-1
          && h.indexOf('Client Creation Journey')===-1 && h.indexOf('Hire and Onboard Journey')===-1
          && h.indexOf('ai-journey-meta-chip')===-1;})()`));

/* ------------------------------------------------- 9. the stitch: one owner per hop ---- */
section('9. Timer reconciliation — a transition can never have two owners');

// Capture timers so handoff behaviour is observable rather than inferred.
run(`var __timers=[];var __realST=setTimeout;`);
run(`setTimeout=function(fn,ms){__timers.push({ms:ms});return __timers.length;};`);

check('with no run, a transition falls through to its original timer',
  run(`(function(){__timers=[];aicjRun=null;
        const r=aicjHandoff(3,function(){},2000);
        return __timers.length===1 && __timers[0].ms===2000 && r!==null;})()`));
check('with the runner live on that stage, NO timer is armed and the callback is held',
  run(`(function(){__timers=[];
        aicjRun={gen:aicjGen,stage:3,idx:0,phase:'announce',shown:{fetched:0,checks:0,captured:0},
                 halted:false,haltKind:null,onDone:null,timer:null,done:[]};
        const f=function(){};
        const r=aicjHandoff(3,f,2000);
        return __timers.length===0 && aicjRun.onDone===f && r===null;})()`));
check('a stale generation falls through rather than hijacking the hop',
  run(`(function(){__timers=[];
        aicjRun={gen:aicjGen-99,stage:3,onDone:null,timer:null,done:[],shown:{}};
        aicjHandoff(3,function(){},2000);
        return __timers.length===1;})()`));
check('the runner on a DIFFERENT stage does not take the hop',
  run(`(function(){__timers=[];
        aicjRun={gen:aicjGen,stage:5,onDone:null,timer:null,done:[],shown:{}};
        aicjHandoff(3,function(){},2000);
        return __timers.length===1;})()`));
check('a held callback fires exactly once',
  run(`(function(){let n=0;
        aicjRun={gen:aicjGen,stage:2,idx:0,phase:'announce',shown:{fetched:0,checks:0,captured:0},
                 halted:false,haltKind:null,onDone:null,timer:null,done:[]};
        aicjHandoff(2,function(){n++;},1300);
        const f=aicjRun.onDone; aicjRun.onDone=null;
        if(typeof f==='function')f();
        if(typeof aicjRun.onDone==='function')aicjRun.onDone();
        return n===1;})()`));
run(`setTimeout=__realST;`);

section('10. Exactly one Approve button exists for one decision');
check('while the runner holds a gate, the page defers instead of drawing its own',
  run(`(function(){
        aicjRun={gen:aicjGen,stage:3,idx:0,phase:'announce',shown:{fetched:0,checks:0,captured:0},
                 halted:true,haltKind:'gate',onDone:null,timer:null,done:[]};
        const page3=buildAIProposalWaitingApprovalHTML();
        const runner=buildAICtRunnerHTML(3);
        return page3.indexOf('aicj-deferred')>-1
            && page3.indexOf('onclick="aiSimulateApproval()"')===-1
            && runner.indexOf('aicjApproveGate(3)')>-1;})()`));
check('stage 4 defers the same way',
  run(`(function(){
        aicjRun={gen:aicjGen,stage:4,idx:0,phase:'announce',shown:{fetched:0,checks:0,captured:0},
                 halted:true,haltKind:'gate',onDone:null,timer:null,done:[]};
        return aiContractDocActionBarHTML().indexOf('aicj-deferred')>-1;})()`));
check('with NO run, every gate page draws its own Approve exactly as before',
  run(`(function(){aicjRun=null;
        return buildAIProposalWaitingApprovalHTML().indexOf('onclick="aiSimulateApproval()"')>-1
            && buildAIContractAwaitingSignatureHTML().indexOf('onclick="aiSimulateContractApproval()"')>-1
            && aiContractDocActionBarHTML().indexOf('aicj-deferred')===-1;})()`));
check('a Worker-owned halt offers no button in any state',
  run(`(function(){const i=6,steps=aicjSteps(i),k=steps.findIndex(function(s){return s.label==='Worker signed';});
        aicjRun={gen:aicjGen,stage:i,idx:k,phase:'announce',shown:{fetched:9,checks:9,captured:9},
                 halted:true,haltKind:'external-wait',onDone:null,timer:null,done:[]};
        const h=aicjEvidenceHTML(i,k);
        aicjRun=null;
        return h.indexOf('<button')===-1 && h.indexOf('am-act wait')>-1;})()`));

section('11. The kill switch');
check('AICJ_ON is present and the engine is guarded by it',
  run(`typeof AICJ_ON==='boolean'`) &&
  run(`(function(){return aicjHandoff.toString().indexOf('AICJ_ON')>-1
        && aicjOwnsApproval.toString().indexOf('AICJ_ON')>-1;})()`));
check('the engine never triggers a full page render',
  run(`(function(){const src=[aicjTick,aicjRenderRunner,aicjStepSettle,aicjHalt,aicjSchedule]
          .map(function(f){return f.toString();}).join('\\n');
        return src.indexOf('renderADTPage(')===-1 && src.indexOf('navigatePage(')===-1;})()`));

/* --------------------------------------------- 12. the stitch actually completes ---- */
section('12. Simulated run — every stage finishes and releases its transition');

// A driven clock: the engine's scheduler pushes here, and we pump it. Without this the beat
// machine is unobservable, and "does the journey still reach the end" is the one question that
// matters most — a runner that stalls silently mid-stage is worse than no runner at all.
run(`var __q=[];var __realST2=setTimeout;
     setTimeout=function(fn,ms){__q.push(fn);return __q.length;};
     clearTimeout=function(){};`);

const sim = run(`(function(){
  const out=[];
  for(let stage=0;stage<9;stage++){
    if(aicjStageGate(stage))continue;              // gate stages are driven by a human click
    aicjGen++; aicjRun=null; __q=[];
    aicjOnStageRendered(stage);
    let released=false;
    aicjHandoff(stage,function(){released=true;},9999);
    // pump the queue; bounded so a stall shows up as a failure rather than an infinite loop
    let pumps=0;
    while(__q.length&&pumps<400){ const fn=__q.shift(); pumps++; try{fn();}catch(e){} }
    const steps=aicjSteps(stage);
    // A skipped step never becomes 'done' — it resolves with its reason instead — so the bar
    // for "ran to completion" is every APPLICABLE step, not every step.
    const applicable=steps.filter(function(st){return aicjApplies(stage,st);}).length;
    const halted=!!(aicjRun&&aicjRun.halted);
    out.push({stage:stage, n:applicable, skipped:steps.length-applicable, released:released, halted:halted,
              haltKind:aicjRun?aicjRun.haltKind:null,
              done:aicjRun?aicjRun.done.length:0, pumps:pumps});
  }
  return out;
})()`);

sim.forEach((r) => {
  const label = 'stage ' + r.stage + ' (' + r.n + ' subs'
    + (r.skipped ? ', ' + r.skipped + ' skipped' : '') + ')';
  if (r.halted) {
    // Halting is a correct outcome — it means a human is genuinely required there.
    check(label + ' halts for a human (' + r.haltKind + ') instead of running past them',
      r.released === false, 'released early despite needing a human');
  } else {
    check(label + ' runs to completion and releases its transition',
      r.released === true && r.done === r.n,
      'released=' + r.released + ' done=' + r.done + '/' + r.n);
  }
});

check('no stage stalls — every one resolved inside the pump budget',
  sim.every((r) => r.pumps < 400), JSON.stringify(sim.filter((r) => r.pumps >= 400)));

// A gate stage: halts on arrival, then approving runs its sub-statuses and releases.
const gateSim = run(`(function(){
  aicjGen++; aicjRun=null; __q=[];
  aicjOnStageRendered(3);
  const haltedOnArrival=!!(aicjRun&&aicjRun.halted&&aicjRun.haltKind==='gate');
  let released=false;
  aicjHandoff(3,function(){released=true;},9999);
  const releasedBefore=released;
  // approve, without invoking the page handler (not loaded here)
  aicjRun.halted=false;aicjRun.haltKind=null;aicjRun.phase='announce';
  aicjSchedule(aicjTick,1);
  let pumps=0; while(__q.length&&pumps<400){ const fn=__q.shift(); pumps++; try{fn();}catch(e){} }
  return {haltedOnArrival:haltedOnArrival, releasedBefore:releasedBefore, releasedAfter:released,
          done:aicjRun?aicjRun.done.length:0, n:aicjSteps(3).length};
})()`);
check('a gate stage halts on arrival and does NOT release early',
  gateSim.haltedOnArrival === true && gateSim.releasedBefore === false);
check('approving a gate runs its sub-statuses, then releases the transition',
  gateSim.releasedAfter === true && gateSim.done === gateSim.n,
  'released=' + gateSim.releasedAfter + ' done=' + gateSim.done + '/' + gateSim.n);

run(`setTimeout=__realST2;`);
run(`aicjRun=null;`);

/* ------------------------------------------------------------------------ summary ---- */
console.log('\n' + '-'.repeat(58));
console.log(fail === 0 ? `ALL ${pass} CHECKS PASSED` : `${pass} passed, ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
