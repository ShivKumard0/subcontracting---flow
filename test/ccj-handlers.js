// Every button in the rebuilt Contract Creation journey must have valid JavaScript behind it.
//
//   node test/ccj-handlers.js
//
// WHY THIS EXISTS. A blanket find-and-replace over escape sequences in js/contract-journey.js
// once flattened `\'` to `'` inside eight unrelated HTML string builders — onclick attributes,
// a regex replacement, an event.key comparison. `node --check` found them, but one per run, so
// recovery took a dozen edit-and-recheck cycles.
//
// AND SYNTAX-CHECKING THE FILE IS NOT ENOUGH. A handler like
//     onclick="ccjChooseGate('qualified')"
// lives inside a string literal. The file parses perfectly while the button is dead. The break
// only shows up when somebody clicks it — in a browser, in front of someone.
//
// So this renders everything the journey can draw, pulls every inline handler out of the markup,
// and parses each one. That is the guarantee worth having — every control in this journey works —
// and it catches the whole class at once rather than one syntax error at a time.
//
// The lesson that goes with it: edit JS with the editor, not with shell pipelines. Escapes get
// mangled crossing shell → interpreter → file, and the damage is silent.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const noop = function () {};

const nodes = {};
function el(id) {
  const n = {
    id: id || '', _html: '', outerHTML: '', textContent: '', value: '',
    scrollTop: 0, scrollHeight: 0, style: {}, dataset: {}, children: [], firstChild: null,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    appendChild: noop, insertBefore: noop, removeChild: noop, remove: noop,
    addEventListener: noop, removeEventListener: noop,
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    querySelector: () => null, querySelectorAll: () => [],
    focus: noop, click: noop, scrollTo: noop, scrollIntoView: noop
  };
  Object.defineProperty(n, 'innerHTML', { get() { return n._html; }, set(v) { n._html = v; } });
  // The transcript appends rather than rebuilds (ccjStreamSync). This suite renders every
  // surface and checks every inline handler on it, so a stream it could not see written would
  // mean the messages' own controls — the client chips, the draft's Send — going unchecked.
  n.insertAdjacentHTML = function (pos, html) {
    if (pos === 'beforeend') n._html += html;
    else if (pos === 'afterbegin') n._html = html + n._html;
  };
  return n;
}
function byId(id) { if (!nodes[id]) nodes[id] = el(id); return nodes[id]; }

let now = 0, seq = 0, timers = [];
const ctx = {
  console,
  setTimeout: (fn, ms) => { const t = { id: ++seq, at: now + (ms || 0), fn }; timers.push(t); return t.id; },
  clearTimeout: (id) => { timers = timers.filter((t) => t.id !== id); },
  setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop, clear: noop },
  location: {}, history: { pushState: noop, replaceState: noop },
  navigator: { userAgent: 'node' },
  matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }),
  document: {
    getElementById: byId, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => el(), body: el(), documentElement: el(), addEventListener: noop
  },
  navigatePage: noop, showAiToast: noop, persistAppState: noop
};
ctx.renderADTPage = function () { ctx.ccjRenderPage(byId('adt-content')); };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/exec-config.js', 'js/execApi.js', 'js/core.js', 'js/pages.js', 'js/contract-journey.js']) {
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { console.error('FATAL: ' + f + ' — ' + e.message); process.exit(1); }
}
const run = (e) => vm.runInContext(e, ctx);
function advance(ms) {
  const target = now + ms;
  for (let g = 0; g < 9000; g++) {
    const due = timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at || a.id - b.id);
    if (!due.length) break;
    const t = due[0]; timers = timers.filter((x) => x !== t);
    now = Math.max(now, t.at); t.fn();
  }
  now = target;
}
// Walk the run forward the way a person would, so every screen has real state behind it.
function driveTo(stageIdx) {
  for (let i = 0; i < 1400; i++) {
    if (run('ccjRun.stage') >= stageIdx) return true;
    if (run("ccjRun.phase==='rest'")) run('ccjContinueStage()');
    if (run("!!(ccjRun.client&&ccjRun.client.drafted)")) run('ccjSendDraft()');
    if (run("ccjRun.screen==='employee'")) run("ccjGoScreen('form')");
    if (run("ccjRun.phase==='halt'")) {
      const o = run("(function(){var s=ccjSteps(ccjRun.stage)[ccjRun.sub];var g=s&&(ccjGateFor(ccjRun.stage,s)||ccjPostGateFor(ccjRun.stage,s));return g&&g.options?g.options[0].id:'';})()");
      if (o) run("ccjChooseGate('" + o + "')");
    }
    if (run("ccjRun.screen==='form'&&ccjMissingFields().length>0")) {
      run("ccjMissingFields().forEach(function(f){var v='x';"
        + "if(f.type==='select'||f.type==='radio'){var o=f.opts==='countries'?ccjCountries():f.opts;v=o[0];}"
        + "else if(f.type==='money'||f.type==='number'){v='4600';}"
        + "else if(f.type==='email'){v='a@b.com';}"
        + "ccjSetField(f.k,v);});");
    }
    advance(200);
  }
  return run('ccjRun.stage') >= stageIdx;
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '\n          ' + String(detail) : '')); }
}

run("portalRole='entity-user';activePersonaId='account-manager';");
run('ccjStartNewRun()');
run("ccjChooseModel('EOR')");
advance(400);
byId('ccj-prompt').value = 'Hire Rohan Verma for Arcadia Retail in Germany as an Operations Analyst';
run('ccjSend()');
const reached = driveTo(7);
// And then all the way through stage 8, because the executed stamp, the gate-release band, the
// rest footer and the KYC review strip only exist once the run has got there — and each of them
// carries a control.
// And then all the way to the END of the journey, because the certificate, the payroll register,
// the payslip and the record only exist once the run has got there — and each of them carries
// controls. Rests are continued through rather than stopped at.
for (let i = 0; i < 4000 && !run("ccjRun.phase==='done'"); i++) {
  if (run("ccjRun.phase==='halt'")) {
    const o = run("(function(){var s=ccjSteps(ccjRun.stage)[ccjRun.sub];var g=s&&(ccjGateFor(ccjRun.stage,s)||ccjPostGateFor(ccjRun.stage,s));return g&&g.options?g.options[0].id:'';})()");
    if (o) run("ccjChooseGate('" + o + "')");
  }
  if (run("ccjRun.phase==='rest'")) run('ccjContinueStage()');
  advance(200);
}

console.log('\nRENDERING EVERY SURFACE');
console.log('  run reached stage ' + (run('ccjRun.stage') + 1) + (reached ? '' : ' (did not reach 8)'));

const markup = [];
const threw = [];
const collect = (label, expr) => {
  try {
    const out = run(expr);
    if (typeof out === 'string') markup.push([label, out]);
    else threw.push(label + ' returned ' + typeof out);
  } catch (e) { threw.push(label + ' threw: ' + e.message); }
};

collect('model chooser', 'buildCCJModelHTML()');
collect('composer', 'ccjComposerInnerHTML()');
collect('chat column', 'buildCCJChatHTML(false)');
collect('chat full width', 'buildCCJChatHTML(true)');
collect('contract form', 'buildCCJFormHTML()');
collect('quote screen', 'buildCCJQuoteHTML()');
collect('quote sent screen', 'buildCCJSentHTML()');
collect('client account screen', 'buildCCJAccountHTML()');
collect('agreement', 'buildCCJMsaHTML()');
collect('deposit invoice', 'buildCCJInvoiceHTML()');
collect('invoice ledger', 'buildCCJRemitHTML()');
collect('payment simulate strip', 'buildCCJPaySimHTML()');
collect('employment contract', 'buildCCJEmpHTML()');
collect('signature envelope', 'buildCCJEnvelopeHTML()');
collect('employee simulate strip', 'buildCCJWorkerSimHTML()');
collect('worker thread', "ccjRun.worker?ccjRun.worker.msgs.map(function(m){return ccjClientMsgHTML(m,false);}).join(''):''");
collect('onboarding file', 'buildCCJOnbHTML()');
collect('kyc console', 'buildCCJKycHTML()');
collect('document checklist', 'buildCCJDocsHTML()');
collect('tax filing', "buildCCJFilingHTML('tax')");
collect('social security filing', "buildCCJFilingHTML('ss')");
collect('bank verification', 'buildCCJBankHTML()');
collect('payroll configuration', 'buildCCJPayrollHTML()');
// The KYC review strip only renders while the step is live and the check has not been reviewed.
collect('kyc simulate strip', "(function(){var k=ccjOnb().kyc,was=k.reviewed;k.reviewed='';"
  + "var h=buildCCJKycHTML();k.reviewed=was;return h;})()");
// Mid-audit is a state the finished run no longer holds, and it draws markers nothing else does.
collect('contract mid-compliance-check', "(function(){var e=ccjEmp();"
  + 'var wasAt=e.auditAt,wasDone=e.auditDone;'
  + 'e.auditAt=Math.max(1,Math.floor(e.audit.length/2));e.auditDone=false;'
  + 'var h=buildCCJEmpHTML();e.auditAt=wasAt;e.auditDone=wasDone;return h;})()');
collect('readiness certificate', 'buildCCJRdyHTML()');
// Part-way through the check, and blocked: both draw markers the issued certificate does not.
collect('readiness mid-check', "(function(){var r=ccjRdy(),wasS=r.step,wasD=r.done;"
  + 'r.step=Math.max(1,Math.floor(ccjRdyChecks().length/2));r.done=false;'
  + 'var h=buildCCJRdyHTML();r.step=wasS;r.done=wasD;return h;})()');
collect('readiness blocked', "(function(){var b=ccjOnb().bank,was=b.state;b.state='penny';"
  + 'var h=buildCCJRdyHTML();b.state=was;return h;})()');
collect('payroll register', 'buildCCJPayrunHTML()');
/* The two states the payroll SETUP passes through. It used to be three — awaiting release, held,
   and paid — and none of those exist now: this journey configures payroll and leaves it PENDING,
   and the last sub-status sets it ACTIVE. No money moves, so there is no payslip surface either. */
collect('payroll setup pending', "(function(){var pr=ccjPayrun();var w=pr.state;"
  + "pr.state='pending';var out=buildCCJPayrunHTML();pr.state=w;return out;})()");
collect('payroll setup active', "(function(){var pr=ccjPayrun();"
  + 'var w={s:pr.state,a:pr.activatedAt,b:pr.activatedBy};'
  + "pr.state='active';pr.activatedAt=pr.activatedAt||900;"
  + "pr.activatedBy=pr.activatedBy||'Priyanka Bhatt';"
  + 'var out=buildCCJPayrunHTML();'
  + 'pr.state=w.s;pr.activatedAt=w.a;pr.activatedBy=w.b;return out;})()');
collect('active record', 'buildCCJActiveHTML()');
collect('employee created', 'buildCCJEmployeeCreatedHTML()');
collect('proposal created', 'buildCCJProposalHTML()');
for (let i = 0; i < 9; i++) collect('stage ' + (i + 1) + ' shell', 'buildCCJStageHTML(' + i + ')');
for (let i = 0; i < 9; i++) collect('stage ' + (i + 1) + ' panel', 'ccjPanelInnerHTML(' + i + ')');
collect('evidence drawer', "(function(){ccjDrawerKey='request-received/CSM assigned';"
  + 'var h=buildCCJDrawerHTML();ccjDrawerKey=null;return h;})()');
collect('client thread', "ccjRun.client?ccjRun.client.msgs.map(function(m){return ccjClientMsgHTML(m,false);}).join(''):''");
collect('agent thread', "ccjRun.msgs.map(function(m){return ccjMsgHTML(m,false);}).join('')");

/* CONDITIONAL SURFACES HAVE TO BE FORCED. Rendering the journey in whatever state it happens to
   be in only covers the controls visible right then — which is how the first version of this
   guard passed while a gate button was provably broken. Every gate in the model is rendered
   here explicitly, whether or not the run is sitting on one. */
collect('every gate button', "(function(){var out='';"
  + 'for(var i=0;i<amPipelineStages.length;i++){'
  + '  var steps=ccjSteps(i);'
  + '  for(var n=0;n<steps.length;n++){'
  + '    var g=ccjGateFor(i,steps[n]);'
  + '    if(g)out+=ccjGateHTML(i,steps[n],g);'
  + '  }'
  + '}'
  + 'return out;})()');
/* POST gates were not covered at all, and they are the harder half: CCJ_GATES halts on arrival, so
   its buttons are on screen for seconds; a post gate only exists once a step's work is done and
   some of them only in one outcome. The payroll release is the most consequential control in the
   whole journey and it lives here. */
collect('every post-gate button', "(function(){var out='';"
  + 'for(var i=0;i<amPipelineStages.length;i++){'
  + '  var steps=ccjSteps(i);'
  + '  for(var n=0;n<steps.length;n++){'
  + '    var g=ccjPostGateFor(i,steps[n]);'
  + '    if(g)out+=ccjGateHTML(i,steps[n],g);'
  + '  }'
  + '}'
  + 'return out;})()');
// The conditional ones, forced. On a finished run all three of these return null — which is how a
// broken button on the single control that releases real money would have shipped unnoticed.
const forceGate = (stageId, label, setup, restore) =>
  "(function(){" + setup
  + "var i=ccjStages().findIndex(function(s){return s.id==='" + stageId + "';});"
  + "var st=ccjSteps(i).find(function(s){return s.label==='" + label + "';});"
  + "var g=ccjPostGateFor(i,st);var h=g?ccjGateHTML(i,st,g):'';"
  + restore + 'return h;})()';
// The payroll release and hold gates are gone with the payroll run itself: nothing is paid on this
// stage, so there is no payment to release and nobody to ask about one.
collect('kyc consider gate', forceGate('onboarding', 'Worker KYC',
  "var k=ccjOnb().kyc,w={r:k.reviewed,f:k.forceConsider,d:k.done};"
  + 'k.reviewed=\'\';k.forceConsider=true;k.done=true;',
  'k.reviewed=w.r;k.forceConsider=w.f;k.done=w.d;'));
// The stopped variant renders different buttons (Reopen) than the live one.
collect('stopped gate', "(function(){var was=ccjRun.stopped;ccjRun.stopped=true;"
  + "var s=ccjSteps(0)[2],g=ccjGateFor(0,s),h=g?ccjGateHTML(0,s,g):'';"
  + 'ccjRun.stopped=was;return h;})()');
collect('simulate client strip', 'buildCCJSimulateHTML(ccjClient())');
collect('document extraction card', "(function(){var was=ccjRun.doc;"
  + "ccjRun.doc={name:'x.pdf',size:100,fields:ccjDocExtract(),at:2,done:false};"
  + 'var h=ccjDocHTML();ccjRun.doc=was;return h;})()');
collect('every row detail state', "(function(){var out='';"
  + 'for(var i=0;i<amPipelineStages.length;i++){var steps=ccjSteps(i);'
  + "for(var n=0;n<steps.length;n++){out+=ccjRowHTML(i,steps[n],n);}}return out;})()");

check('every builder renders without throwing', threw.length === 0, threw.join('\n          '));
check('surfaces were actually collected', markup.length >= 25, markup.length + ' surfaces');

/* A doubled full stop is invisible to every behaviour assertion and obvious the moment anyone
   looks at the page. It happens because half the entity names in CCJ_REGISTRY already end in one
   — "ADT Netherlands EOR Services B.V." — and a builder appends a stop to end its sentence. */
const doubled = [];
markup.forEach(function (pair) {
  const m = String(pair[1]).replace(/<[^>]*>/g, ' ').match(/[A-Za-z]\.\.(?!\.)/g);
  if (m) doubled.push(pair[0] + ' -> ' + m.slice(0, 3).join(', '));
});
check('no surface prints a doubled full stop', doubled.length === 0, doubled.slice(0, 6).join('\n          '));

console.log('\nCHECKING EVERY INLINE HANDLER');

/* Parsing is not enough, and finding that out was the point of the exercise.
   `ccjChooseGate(qualified)` — which is what a flattened quote actually emits — parses
   perfectly. `qualified` is a valid identifier expression; it only fails at RUNTIME, with a
   ReferenceError, when somebody clicks the button.

   So each handler is checked twice: does it parse, and does every name it reaches for actually
   exist. The second is what catches the real failure. String literals are stripped first, or
   the argument INSIDE ccjChooseGate('qualified') would look like an undefined name itself. */
const RESERVED = new Set(('if else return var let const function new typeof delete void in of do while for '
  + 'switch case break continue this true false null undefined try catch finally throw instanceof '
  + 'event window document console').split(' '));
function unknownNames(code) {
  const stripped = code
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")      // single-quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')      // double-quoted strings
    .replace(/\.\s*[A-Za-z_$][\w$]*/g, '.p'); // property accesses — not globals
  const names = stripped.match(/[A-Za-z_$][\w$]*/g) || [];
  return names.filter(function (n) {
    if (RESERVED.has(n)) return false;
    if (n === 'p') return false;              // the property placeholder above
    return run('typeof ' + n) === 'undefined';
  });
}

const HANDLER = /\son(?:click|change|input|keydown|submit)\s*=\s*"([^"]*)"/g;
let total = 0;
const unparseable = [], dangling = [];
const seen = new Set();
markup.forEach(function (pair) {
  const label = pair[0], html = pair[1];
  let m; HANDLER.lastIndex = 0;
  while ((m = HANDLER.exec(html))) {
    total++;
    const code = m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (seen.has(code)) continue;
    seen.add(code);
    try { new Function('event', code); }
    catch (e) {
      unparseable.push(label + '\n            ' + code.slice(0, 110) + '\n            -> ' + e.message);
      continue;
    }
    const missing = unknownNames(code);
    if (missing.length) dangling.push(label + '\n            ' + code.slice(0, 110)
      + '\n            -> not defined: ' + missing.join(', '));
  }
});
console.log('  ' + total + ' handlers, ' + seen.size + ' distinct');
check('handlers were found to check', total > 40, total + ' found');
check('every inline handler parses as JavaScript', unparseable.length === 0,
  unparseable.length + ' broken:\n          ' + unparseable.slice(0, 8).join('\n          '));
check('every name a handler reaches for actually exists', dangling.length === 0,
  dangling.length + ' broken:\n          ' + dangling.slice(0, 8).join('\n          '));

// The exact shape the incident produced — fn('' where fn(\' was meant. Cheap, and it names the
// failure mode directly, which the generic parse above does not.
const src = fs.readFileSync(path.join(ROOT, 'js/contract-journey.js'), 'utf8');
const flat = src.match(/on(?:click|change|input|keydown)="[A-Za-z]+\('{2}/g) || [];
check('no flattened quote escapes in any handler builder', flat.length === 0,
  flat.length + ' sites: ' + flat.join(', '));

/* ---- NO TWO COMPONENTS SHARE A CLASS NAME -------------------------------------------------
   This has now gone wrong three times: ccj-will / ccj-will-sla, ccj-gate-as / ccj-gate-ask, and
   ccj-doc used by BOTH the document-extraction card in the chat and the Master Services
   Agreement — which put a 720px page with 44px padding inside a 300px bubble and wrapped a job
   description to one character per line.

   Two checks. A class defined twice in the stylesheet is nearly always two components fighting
   over a name. And a class name that is a strict prefix of another is the trap that produced the
   first two, because `indexOf` and careless selectors both match the wrong one. */
console.log('\nCSS CLASS HYGIENE');
const css = fs.readFileSync(path.join(ROOT, 'css/contract-journey.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');            // comments mention class names in prose

/* Only the BARE root definition — `.ccj-doc{` — counts. `.ccj-row.done{`, `.ccj-row:hover{` and
   `.ccj-row svg{` are the same component describing its own states and children, and counting
   those made the first version of this check report a hundred false positives.

   A bare root defined twice is two different components fighting over one name, which is what
   put a 720px agreement page inside a 300px chat bubble. */
const roots = {};
(css.match(/^\.([a-z][\w-]*)\s*\{/gm) || []).forEach(function (sel) {
  const n = sel.replace(/^\./, '').replace(/\s*\{$/, '');
  roots[n] = (roots[n] || 0) + 1;
});
const dup = Object.keys(roots).filter(function (n) { return roots[n] > 1; });
check('no component shares a class root with another', dup.length === 0,
  dup.map(function (n) { return '.' + n + ' defined ' + roots[n] + ' times'; }).join(', '));
console.log('  ' + Object.keys(roots).length + ' class roots, all distinct');

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
