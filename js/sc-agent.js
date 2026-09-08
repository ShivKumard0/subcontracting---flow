/* ============================================================================================
   SUB-CONTRACTING AI COPILOT
   ============================================================================================
   The two agents configured under FR5 — Ask the Deal and the Reconciliation Explainer — made
   real on the transaction and dashboard screens.

   TWO RULES GOVERN THIS ENTIRE FILE, AND THEY ARE WHY IT IS A SEPARATE FILE:

   1. IT NEVER WRITES. Nothing here calls scAdvance, scPrimaryAction, scConfirmSheet, scSetField
      or scSave, and nothing assigns to a live transaction. Where it needs a derived figure it
      computes it on a CLONE (see scAgentRecon below), because scComputeRecon writes its results
      onto txn.recon. A read-only agent cannot disrupt a workflow — that is a structural
      guarantee, and it is verified by diffing the whole store before and after a run of queries.

   2. IT IS NOT WIRED INTO THE JOURNEY. subcontracting.js does not know this file exists. The
      panel mounts itself onto document.body and re-reads context on a timer while open, so
      there is no hook in renderADTPage, no shared state and no load-order dependency. Deleting
      the <script> tag removes the feature and changes nothing else.

   The answers are not canned text. Every number, name, status and instruction below is computed
   from the live transaction, through the same scComputeRecon / scGateBlock / scDocStatus the
   screens use, so the copilot and the screen can never disagree. Only the phrasing is authored.
   That is what makes it read as real: it is real, just rule-based rather than model-backed.
   ============================================================================================ */

const SC_AGENTS=[
  {id:'ask-deal',name:'Ask the Deal',tag:'Transaction copilot',initials:'AD',
   blurb:'Ask about the open transaction — where the material is, what is blocking it, who has acted.',
   prompts:['Where is my material?','What is blocking this?','What happens next?','Show me the documents','Who has acted on this?']},
  {id:'recon',name:'Reconciliation Explainer',tag:'FR17 variance',initials:'RE',
   blurb:'Explains the reconciliation arithmetic and exactly what stands between this transaction and closure.',
   prompts:['Explain the reconciliation','Why can I not close this?','How is consumption calculated?','What is outstanding?']}
];

let scAgentState={open:false,agent:'ask-deal',threads:{},ctx:'',busy:false,tick:null};

/* -- CONTEXT. What the copilot is looking at right now. Read fresh every time, never cached
   across a render, so switching transaction or persona is picked up without a hook. -- */
function scAgentCtx(){
  const txn=(typeof scOpenTxnId!=='undefined'&&typeof scTxn==='function')?scTxn(scOpenTxnId):null;
  const me=typeof activePersonaId!=='undefined'?activePersonaId:'';
  const onTxnPage=typeof currentPage!=='undefined'?currentPage==='sc-txn':!!txn;
  return {txn:(onTxnPage?txn:null),me:me,actor:(typeof scActor==='function'?scActor(me):null)};
}
function scAgentCtxLabel(){
  const c=scAgentCtx();
  if(c.txn)return (c.txn.no||'Draft')+' · Step '+c.txn.step+' '+scStep(c.txn.step).short;
  if(c.actor)return c.actor.label+' · '+(typeof scActionable==='function'?scActionable(c.me).length:0)+' awaiting you';
  return 'No transaction open';
}

/* READING THROUGH A CLONE. scComputeRecon and scGateBlock are the right functions to call —
   they are the single implementation of the FR17.4 / FR17.6 arithmetic, and re-deriving it here
   would let the copilot's numbers drift from the screen's. But scComputeRecon WRITES its results
   onto txn.recon, so calling it from the copilot mutated the live record. Cloning first keeps one
   implementation of the maths and still leaves the transaction untouched. */
function scAgentClone(t){try{return JSON.parse(JSON.stringify(t));}catch(e){return t;}}
function scAgentRecon(t){try{return scComputeRecon(scAgentClone(t));}catch(e){return {};}}
function scAgentGate(t){try{return scGateBlock(scAgentClone(t));}catch(e){return '';}}

/* == THE ANSWERS ===========================================================================
   Intent matching is deliberately shallow — a handful of keyword groups — because the value is
   in the DERIVATION, not the parsing. Each branch reads the record and states what is actually
   true of it. == */
function scAgentMatch(q,words){q=' '+q.toLowerCase()+' ';return words.some(function(w){return q.indexOf(w)>-1;});}

function scAgentAnswerAskDeal(q){
  const c=scAgentCtx(),t=c.txn;
  if(!t){
    const mine=typeof scActionable==='function'?scActionable(c.me):[];
    if(!mine.length)return 'Nothing is waiting on you right now. Open a transaction from the board and I can tell you where it stands, what is blocking it and who touched it last.';
    return 'You have **'+mine.length+'** transaction'+(mine.length===1?'':'s')+' waiting on you:\n\n'
      +mine.slice(0,6).map(function(x){return '· **'+(x.no||'Draft')+'** — step '+x.step+' '+scStep(x.step).short+', waiting '+scSince(x.pendingSince);}).join('\n')
      +'\n\nOpen one and ask me again — I answer against whichever transaction is on screen.';
  }
  const s=t.scr,v=typeof scVendor==='function'?scVendor(s.vendor):null;

  // ---- where is the material
  if(scAgentMatch(q,['material','where','stock','inventory','reserved','position','warehouse'])){
    const held=(t.reservations||[]).filter(function(r){return Number(r.qty||0)>0;});
    let a='Material on **'+(t.no||'this SCR')+'** is at **'+(t.position||'Main')+'**';
    a+=t.positionAt?' since '+t.positionAt+'.':'.';
    if(held.length)a+='\n\nStill reserved against this shipment:\n'+held.map(function(r){
      return '· '+r.qty+' x **'+r.item+'** at '+r.warehouse+' / '+r.location+(r.consumed?'  ('+r.consumed+' already consumed)':'');}).join('\n');
    else if((t.reservations||[]).length)a+='\n\nThe reservation is fully consumed — nothing is held in the plant for this transaction any more.';
    if((t.receipts||[]).length)a+='\n\nReceived back:\n'+(t.receipts||[]).map(function(r){
      return '· '+r.qty+' x **'+r.item+'** booked into '+r.warehouse+(r.location?' / '+r.location:'')+' on '+r.at;}).join('\n');
    if(t.position==='At Vendor'&&t.shipment.expectedReturn)
      a+='\n\nExpected back by **'+t.shipment.expectedReturn+'**'+(scOverdue(t)?' — that date has passed, this is overdue.':'.');
    return a;
  }
  // ---- what is blocking
  if(scAgentMatch(q,['block','stuck','delay','late','why','hold','wrong','problem','issue','overdue'])){
    const gate=scAgentGate(t);
    const mc=typeof scMakerCheckerBlocked==='function'?scMakerCheckerBlocked(t):'';
    if(t.closed)return 'Nothing is blocking it — **'+(t.no||'this transaction')+'** is closed ('+t.status+')'
      +(t.closedBy?', closed by '+scActorLabel(t.closedBy)+' on '+t.closedAt+'.':'.');
    let a='**'+(t.no||'This transaction')+'** is at step **'+t.step+' — '+scStep(t.step).name+'**, waiting on **'
      +scActorLabel(t.pendingWith)+'** for '+scSince(t.pendingSince)+'.';
    if(gate)a+='\n\n**It cannot move forward yet.** '+gate;
    else if(mc)a+='\n\n**Maker-checker is blocking you.** '+mc;
    else a+='\n\nNothing is blocking the step itself — it simply needs '+scActorLabel(t.pendingWith)+' to act.';
    if(scOverdue(t))a+='\n\nReturn is overdue against the expected date of '+t.shipment.expectedReturn+'.';
    return a;
  }
  // ---- what happens next
  if(scAgentMatch(q,['next','after','then','forward','following','upcoming'])){
    if(t.closed)return 'Nothing further — this transaction is closed. Its record stays available for audit.';
    const nxt=typeof scNextStep==='function'?scNextStep(t,t.step):0;
    let a='Right now: **step '+t.step+' — '+scStep(t.step).name+'**, with '+scActorLabel(t.pendingWith)+'.';
    if(nxt)a+='\n\nOnce they act it goes to **step '+nxt+' — '+scStep(nxt).name+'** ('+scActorLabel(scStep(nxt).actors[0]||'')+').';
    else a+='\n\nThis is the final step — acting on it closes the transaction.';
    if(t.step===7&&scLogisticsRequired(t)==='No')a+='\n\nLogistics is not required on this shipment, so it skips straight to the delivery note.';
    if(t.step===4&&s.billable==='No')a+='\n\nThis is non-billable, so the zero-value PO is system-approved and PO approval is skipped.';
    return a;
  }
  // ---- documents
  if(scAgentMatch(q,['document','number','reference','ref','challan','delivery note','asn','imr','gate pass','po no','paperwork'])){
    const rows=[['SCR',t.no,'scr'],['Purchase Order',t.po.no,'po'],['Shipment',t.shipment.no,'shipment'],
      ['Outbound Key',t.shipment.outboundKey,''],['Transfer Order',t.shipment.transferOrder,''],
      ['Delivery Note',t.dn.no,'dn'],['Challan',t.challan.no,'challan'],['Gate Pass',t.challan.gatePassNo,''],
      ['ASN',t.asn.no,'asn'],['IMR',t.imr.no,'imr'],['BOM',t.bomRef,''],
      ['Receivable Product',(t.product||{}).code,'']].filter(function(r){return r[1];});
    return 'Documents raised on **'+(t.no||'this transaction')+'** so far:\n\n'
      +rows.map(function(r){
        const st=r[2]?scDocStatus(t,r[2]):'';
        return '· '+r[0]+' — **'+r[1]+'**'+(st?'  ('+st+')':'');}).join('\n')
      +'\n\nAnything not listed has not been raised yet.';
  }
  // ---- who acted
  if(scAgentMatch(q,['who','history','log','acted','trail','audit','touched','approved by'])){
    const acts=(t.activity||[]).slice(-8).reverse();
    if(!acts.length)return 'No activity recorded on this transaction yet.';
    return 'Most recent activity on **'+(t.no||'this transaction')+'**:\n\n'
      +acts.map(function(a){
        return '· **'+a.at+'** — '+a.action+'\n   '+(a.by||'—')+(a.role?' ('+a.role+')':'')
          +(a.from||a.to?'  ·  '+(a.from||'—')+' -> '+(a.to||'—'):'')
          +(a.reasonCode?'\n   Reason '+a.reasonCode+(a.reason?' — '+a.reason:''):'')
          +(a.remarks?'\n   "'+a.remarks+'"':'');}).join('\n')
      +'\n\n'+(t.activity||[]).length+' entries in total.';
  }
  // ---- value / commercial
  if(scAgentMatch(q,['value','cost','price','rate','commercial','money','amount','contract'])){
    if(s.billable==='No')return 'This is a **non-billable** transaction'
      +(s.nonBillReason?' ('+scReasonText('RC-NONBILL',s.nonBillReason)+')':'')
      +'. The PO carries zero value and is system-approved without manual PO approval.';
    const qty=Number(s.recvQty||0),price=Number(t.po.price||0);
    let a='Commercials on **'+(t.po.no||'the PO')+'**:\n\n'
      +'· Price / unit — **'+(price||'not set')+'** '+(t.po.currency||'')+(t.po.basis?' per '+t.po.basis:'')
      +'\n· Expected receivable — **'+qty+'** '+((scItem(s.recvItem)||{}).uom||'')
      +'\n· PO value — **'+(qty&&price?scMoney(qty*price):'not calculable yet')+'**';
    if(t.po.rateContract)a+='\n\nPriced off rate contract **'+t.po.rateContract+'**, so the rate is locked and the Buyer cannot overwrite it.';
    return a;
  }
  // ---- default: the whole picture
  return 'Here is where **'+(t.no||'this transaction')+'** stands:\n\n'
    +'· Step **'+t.step+' — '+scStep(t.step).name+'**\n'
    +'· Waiting on **'+scActorLabel(t.pendingWith||'—')+'** for '+scSince(t.pendingSince)+'\n'
    +'· Vendor — '+(v?v.name:(s.internalBP||'—'))+'\n'
    +'· Receivable — '+(s.recvQty||'—')+' x '+(s.recvItem||'—')+'\n'
    +'· Material position — **'+(t.position||'Main')+'**\n'
    +'· '+(s.billable==='No'?'Non-billable':'Billable')+', logistics '+(scLogisticsRequired(t)==='Yes'?'required':'not required')+'\n\n'
    +'Ask me where the material is, what is blocking it, what happens next, or who has acted on it.';
}

function scAgentAnswerRecon(q){
  const c=scAgentCtx(),t=c.txn;
  if(!t)return 'Open a transaction and I will walk you through its reconciliation. I explain the FR17 arithmetic — what was issued, what the vendor consumed against the BOM, what came back, and exactly what stands between the transaction and closure.';
  if(t.step<16&&!t.closed)
    return 'Reconciliation has not started on **'+(t.no||'this transaction')+'** yet — it opens once Stores confirms the material receipt at step 16. This is at step '+t.step+' ('+scStep(t.step).short+').\n\nWhat I can tell you now: **'+(t.scr.recvQty||0)+'** units are expected back, against **'
      +(t.scr.issueItems||[]).reduce(function(a,r){return a+Number(r.qty||0);},0)+'** issued to the vendor.';

  const r=scAgentRecon(t);
  const gate=scAgentGate(t);

  if(scAgentMatch(q,['how','calculat','formula','ratio','consumption','bom','maths','math'])){
    const lines=(t.scr.issueItems||[]).map(function(x){
      const ratio=Number(x.ratio||0),used=+(Number(r.received||0)*ratio).toFixed(3);
      return '· **'+x.item+'** — BOM ratio '+ratio+', so '+r.received+' x '+ratio+' = **'+used+'** consumed of '+x.qty+' issued';});
    return 'Consumption is derived, never typed. FR17.4:\n\n**Consumed = Confirmed Received Qty x BOM Ratio**\n\n'
      +'The BOM ratio itself came from FR3.4 when the SCR was approved — issue quantity divided by expected receivable quantity.\n\n'
      +lines.join('\n')
      +'\n\nThen FR17.6:\n\n**Outstanding = Issued - Consumed - Returned - Scrap**\n= '
      +r.issued+' - '+r.consumed+' - '+r.returned+' - '+r.scrap+' = **'+r.outstanding+'**';
  }
  if(scAgentMatch(q,['close','closure','blocked','cannot','can not','why','stop','prevent'])){
    if(t.closed)return '**'+(t.no||'This transaction')+'** is already closed. At closure the SCR, PO, Shipment and Challan all moved to Closed; the Delivery Note stayed Approved, the ASN QC Cleared and the IMR Confirmed — FR18.3 deliberately leaves those three alone.';
    if(!gate)return 'Nothing is blocking closure. Pending receivable is nil and all issue material is accounted for, so **Confirm Full Receipt** is available to '+scActorLabel(t.pendingWith)+'.';
    let a='**Closure is blocked.** '+gate+'\n\nFR17.7 requires all of these before full receipt can be confirmed:\n\n'
      +'· Pending receivable = 0 — currently **'+r.pending+'**'+(r.pending?'  NOT MET':'  met')+'\n'
      +'· Outstanding issue qty = 0 — currently **'+r.outstanding+'**'+(r.outstanding?'  NOT MET':'  met')+'\n'
      +'· Every scrap quantity has a reason'+(r.scrapMissingReason?'  NOT MET':'  met')+'\n'
      +'· Every returned quantity has a reason'+(r.returnMissingReason?'  NOT MET':'  met')+' and a receiving location'+(r.returnMissingLocation?'  NOT MET':'  met');
    if(r.pending>0)a+='\n\nTo clear the pending receivable you either receive the balance, or **short-close** it with a reason and remarks.';
    if(r.outstanding!==0)a+='\n\nTo clear the outstanding issue material, book the '+r.outstanding+' remaining units on the reconciliation lines as **returned** (with a reason and a receiving storage location) or as **scrap** (with a reason).';
    return a;
  }
  if(scAgentMatch(q,['outstanding','balance','left','remaining','unaccounted'])){
    if(r.outstanding===0)return 'Nothing outstanding — all **'+r.issued+'** units issued are accounted for: '
      +r.consumed+' consumed against the BOM, '+r.returned+' returned and '+r.scrap+' scrapped.';
    return '**'+r.outstanding+'** units of issue material are unaccounted for.\n\n'
      +'· Issued to vendor — '+r.issued+'\n· Consumed against BOM — '+r.consumed+'\n· Returned unused — '+r.returned+'\n· Scrap / process loss — '+r.scrap+'\n\n'
      +'FR17.6 requires that to reach zero. Book the difference as returned or scrap on the reconciliation lines.';
  }
  // ---- default narrative
  let a='Reconciliation for **'+(t.no||'this transaction')+'**\n\n'
    +'**Receivable side**\n· Expected — '+r.expected+'\n· Received — '+r.received
    +(r.shortClosed?'\n· Short-closed — '+r.shortClosed:'')
    +'\n· Pending — **'+r.pending+'**\n\n'
    +'**Issue side**\n· Issued to vendor — '+r.issued+'\n· Consumed against BOM — '+r.consumed
    +'\n· Returned unused — '+r.returned+'\n· Scrap / process loss — '+r.scrap+'\n· Outstanding — **'+r.outstanding+'**\n\n';
  a+=gate?('**Blocked:** '+gate+'\n\nAsk me *why can I not close this* and I will list every FR17.7 condition against its current value.')
        :'Everything reconciles. Full receipt can be confirmed.';
  return a;
}

function scAgentAnswer(q){
  return scAgentState.agent==='recon'?scAgentAnswerRecon(q):scAgentAnswerAskDeal(q);
}

/* == PRESENTATION ==========================================================================
   A light markdown pass — **bold**, bullet lines and newlines — so answers can be authored as
   readable text rather than as HTML string soup. Escaped FIRST, so nothing a transaction holds
   (a vendor name, a remark someone typed) can inject markup. == */
function scAgentMd(s){
  let h=String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/\*(.+?)\*/g,'<i>$1</i>');
  return h.split('\n').map(function(l){
    if(/^·\s/.test(l))return '<div class="sca-li">'+l.replace(/^·\s/,'')+'</div>';
    if(/^\s{3}/.test(l))return '<div class="sca-sub">'+l.trim()+'</div>';
    return l.trim()?'<div class="sca-p">'+l+'</div>':'<div class="sca-gap"></div>';
  }).join('');
}

function scAgentThread(){
  const id=scAgentState.agent;
  if(!scAgentState.threads[id])scAgentState.threads[id]=[];
  return scAgentState.threads[id];
}

function scAgentHTML(){
  const a=SC_AGENTS.find(function(x){return x.id===scAgentState.agent;})||SC_AGENTS[0];
  const thread=scAgentThread();
  const body=thread.length
    ? thread.map(function(m){
        return m.role==='user'
          ? '<div class="sca-row sca-row-me"><div class="sca-bubble sca-me">'+scAgentMd(m.text)+'</div></div>'
          : '<div class="sca-row"><div class="sca-av">'+a.initials+'</div><div class="sca-bubble sca-bot">'+scAgentMd(m.text)+'</div></div>';
      }).join('')
      +(scAgentState.busy?'<div class="sca-row"><div class="sca-av">'+a.initials+'</div>'
        +'<div class="sca-bubble sca-bot sca-typing"><span></span><span></span><span></span></div></div>':'')
    : '<div class="sca-empty"><div class="sca-empty-av">'+a.initials+'</div>'
      +'<div class="sca-empty-t">'+a.name+'</div><div class="sca-empty-b">'+a.blurb+'</div></div>';

  return '<div class="sca-head">'
      +'<div class="sca-head-l"><div class="sca-av sca-av-lg">'+a.initials+'</div>'
        +'<div><div class="sca-title">'+a.name+'</div><div class="sca-ctx" id="sca-ctx">'+scAgentCtxLabel()+'</div></div></div>'
      +'<button class="sca-x" onclick="scAgentToggle()" aria-label="Close">&times;</button>'
    +'</div>'
    +'<div class="sca-tabs">'+SC_AGENTS.map(function(x){
        return '<button class="sca-tab'+(x.id===scAgentState.agent?' on':'')+'" onclick="scAgentSwitch(\''+x.id+'\')">'+x.name+'</button>';
      }).join('')+'</div>'
    +'<div class="sca-body" id="sca-body">'+body+'</div>'
    +'<div class="sca-chips">'+a.prompts.map(function(p){
        return '<button class="sca-chip" onclick="scAgentAsk(this.dataset.q)" data-q="'+p.replace(/"/g,'&quot;')+'">'+p+'</button>';
      }).join('')+'</div>'
    +'<div class="sca-input">'
      +'<input id="sca-q" placeholder="Ask about this transaction..." autocomplete="off" '
        +'onkeydown="if(event.key===\'Enter\'){event.preventDefault();scAgentSendInput();}">'
      +'<button class="sca-send" onclick="scAgentSendInput()" aria-label="Send">'
        +'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>'
      +'</button>'
    +'</div>'
    +'<div class="sca-foot">Generated from this transaction’s live data. Read-only — the copilot never changes the workflow.</div>';
}

function scAgentRender(){
  const host=document.getElementById('sc-agent-panel');
  if(!host)return;
  host.innerHTML=scAgentHTML();
  const b=document.getElementById('sca-body');
  if(b)b.scrollTop=b.scrollHeight;
  const fab=document.getElementById('sc-agent-fab');
  if(fab)fab.classList.toggle('hidden',scAgentState.open);
  host.classList.toggle('open',scAgentState.open);
}

function scAgentToggle(){
  scAgentState.open=!scAgentState.open;
  scAgentRender();
  if(scAgentState.open){
    const i=document.getElementById('sca-q');if(i)i.focus();
    /* Context can change under an open panel — the user navigates, or switches persona. Polled
       rather than hooked, so the journey code has no idea this panel exists. */
    scAgentState.ctx=scAgentCtxLabel();
    scAgentState.tick=setInterval(function(){
      const now=scAgentCtxLabel();
      if(now!==scAgentState.ctx){
        scAgentState.ctx=now;
        const el=document.getElementById('sca-ctx');
        if(el)el.textContent=now;
      }
    },1200);
  }else if(scAgentState.tick){clearInterval(scAgentState.tick);scAgentState.tick=null;}
}
function scAgentSwitch(id){scAgentState.agent=id;scAgentRender();}
function scAgentSendInput(){
  const i=document.getElementById('sca-q');
  if(!i)return;
  const v=i.value.trim();
  if(!v)return;
  i.value='';
  scAgentAsk(v);
}
function scAgentAsk(q){
  if(scAgentState.busy)return;
  const thread=scAgentThread();
  thread.push({role:'user',text:q});
  scAgentState.busy=true;
  scAgentRender();
  /* A short pause before the reply. Nothing is being fetched — the answer is computed
     synchronously — but an instant response reads as a lookup rather than as an assistant. */
  setTimeout(function(){
    let answer;
    try{answer=scAgentAnswer(q);}
    catch(e){answer='I could not read that transaction cleanly just now. Reopen it from the board and ask me again.';}
    thread.push({role:'bot',text:answer});
    scAgentState.busy=false;
    scAgentRender();
  },420+Math.min(600,q.length*8));
}

function scAgentMount(){
  if(document.getElementById('sc-agent-panel'))return;
  const css=document.createElement('style');
  css.textContent=[
'#sc-agent-fab{position:fixed;right:24px;bottom:24px;z-index:890;width:52px;height:52px;border-radius:50%;',
'  border:0;background:var(--navy,#0f172a);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;',
'  box-shadow:0 6px 20px rgba(15,23,42,.28);transition:transform .18s,box-shadow .18s,opacity .15s;font-family:Inter,sans-serif}',
'#sc-agent-fab:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(15,23,42,.34)}',
'#sc-agent-fab.hidden{opacity:0;pointer-events:none;transform:scale(.85)}',
'#sc-agent-fab .sca-dot{position:absolute;top:9px;right:9px;width:8px;height:8px;border-radius:50%;background:#22c55e;border:2px solid var(--navy,#0f172a)}',
'#sc-agent-panel{position:fixed;right:0;top:0;bottom:0;width:404px;max-width:100vw;z-index:900;background:var(--card,#fff);',
'  border-left:1px solid var(--border,#e5e7eb);box-shadow:-14px 0 38px rgba(15,23,42,.10);',
'  display:flex;flex-direction:column;font-family:Inter,sans-serif;color:var(--navy,#0f172a);',
'  transform:translateX(100%);transition:transform .26s cubic-bezier(.4,0,.2,1);visibility:hidden}',
'#sc-agent-panel.open{transform:translateX(0);visibility:visible}',
'.sca-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border,#e5e7eb);flex-shrink:0}',
'.sca-head-l{display:flex;align-items:center;gap:10px;min-width:0}',
'.sca-av{width:28px;height:28px;border-radius:8px;background:var(--navy,#0f172a);color:#fff;display:flex;align-items:center;',
'  justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;letter-spacing:.3px}',
'.sca-av-lg{width:34px;height:34px;border-radius:10px;font-size:12px}',
'.sca-title{font-size:14px;font-weight:700;line-height:1.2}',
'.sca-ctx{font-size:11.5px;color:var(--gray,#6a7282);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:270px}',
'.sca-x{border:0;background:transparent;font-size:24px;line-height:1;color:var(--gray,#6a7282);cursor:pointer;padding:0 4px;border-radius:6px}',
'.sca-x:hover{background:var(--ol,#f1f5f9);color:var(--navy,#0f172a)}',
'.sca-tabs{display:flex;gap:6px;padding:10px 16px;border-bottom:1px solid var(--border,#e5e7eb);flex-shrink:0}',
'.sca-tab{flex:1;border:1px solid var(--border,#e5e7eb);background:var(--card,#fff);border-radius:8px;padding:7px 8px;',
'  font-size:11.5px;font-weight:600;color:var(--gray,#6a7282);cursor:pointer;font-family:inherit;transition:.15s;',
'  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.sca-tab:hover{border-color:#cbd5e1;color:var(--navy,#0f172a)}',
'.sca-tab.on{background:var(--navy,#0f172a);border-color:var(--navy,#0f172a);color:#fff}',
'.sca-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--light,#f8f9fb)}',
'.sca-row{display:flex;gap:8px;align-items:flex-start}',
'.sca-row-me{justify-content:flex-end}',
'.sca-bubble{max-width:82%;padding:10px 12px;border-radius:12px;font-size:12.5px;line-height:1.62;word-break:break-word}',
'.sca-bot{background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-top-left-radius:4px}',
'.sca-me{background:var(--navy,#0f172a);color:#fff;border-top-right-radius:4px}',
'.sca-p{margin:0}',
'.sca-gap{height:7px}',
'.sca-li{position:relative;padding-left:13px;margin:1px 0}',
'.sca-li:before{content:"";position:absolute;left:3px;top:8px;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.42}',
'.sca-sub{padding-left:13px;color:var(--gray,#6a7282);font-size:11.5px}',
'.sca-me .sca-sub{color:rgba(255,255,255,.72)}',
'.sca-typing{display:flex;gap:4px;align-items:center;padding:13px 14px}',
'.sca-typing span{width:6px;height:6px;border-radius:50%;background:var(--gray,#6a7282);animation:blink 1.3s infinite}',
'.sca-typing span:nth-child(2){animation-delay:.18s}',
'.sca-typing span:nth-child(3){animation-delay:.36s}',
'.sca-empty{text-align:center;padding:34px 18px;color:var(--gray,#6a7282)}',
'.sca-empty-av{width:44px;height:44px;border-radius:13px;background:var(--navy,#0f172a);color:#fff;display:flex;align-items:center;',
'  justify-content:center;font-size:15px;font-weight:700;margin:0 auto 12px}',
'.sca-empty-t{font-size:14px;font-weight:700;color:var(--navy,#0f172a);margin-bottom:6px}',
'.sca-empty-b{font-size:12.5px;line-height:1.6;max-width:280px;margin:0 auto}',
'.sca-chips{display:flex;gap:6px;padding:10px 16px 0;flex-wrap:wrap;flex-shrink:0}',
'.sca-chip{border:1px solid var(--border,#e5e7eb);background:var(--card,#fff);border-radius:16px;padding:6px 11px;',
'  font-size:11.5px;font-weight:500;color:var(--navy,#0f172a);cursor:pointer;font-family:inherit;transition:.15s}',
'.sca-chip:hover{border-color:var(--navy,#0f172a);background:var(--ol,#f1f5f9)}',
'.sca-input{display:flex;gap:8px;align-items:center;padding:12px 16px 8px;flex-shrink:0}',
'.sca-input input{flex:1;border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 12px;font-size:12.5px;',
'  font-family:inherit;color:var(--navy,#0f172a);outline:none;transition:.15s;min-width:0}',
'.sca-input input:focus{border-color:var(--navy,#0f172a);box-shadow:0 0 0 3px rgba(15,23,42,.07)}',
'.sca-send{width:36px;height:36px;border-radius:10px;border:0;background:var(--navy,#0f172a);color:#fff;cursor:pointer;',
'  display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.15s}',
'.sca-send:hover{opacity:.86}',
'.sca-foot{padding:0 16px 12px;font-size:10.5px;line-height:1.5;color:var(--gray,#6a7282)}',
'@media (max-width:520px){#sc-agent-panel{width:100vw}}'
].join('\n');
  document.head.appendChild(css);

  const fab=document.createElement('button');
  fab.id='sc-agent-fab';
  fab.title='Sub-Contracting copilot';
  fab.onclick=scAgentToggle;
  fab.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" '
    +'stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'
    +'<span class="sca-dot"></span>';
  document.body.appendChild(fab);

  const panel=document.createElement('div');
  panel.id='sc-agent-panel';
  document.body.appendChild(panel);
  scAgentRender();
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scAgentMount);
  else scAgentMount();
}
