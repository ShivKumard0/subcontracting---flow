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
   blurb:'Ask about any transaction, open or closed — quote an SCR, PO, challan, ASN or IMR number, or ask across the whole board.',
   prompts:['Show me everything open','What is overdue?','What is blocking this?','Where is my material?',
            'What is with Finance?','Show me the documents','Who has acted on this?','Closed transactions']},
  {id:'recon',name:'Reconciliation Explainer',tag:'FR17 variance',initials:'RE',
   blurb:'Explains the reconciliation arithmetic for any transaction and exactly what stands between it and closure.',
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
// Rejected is terminal but it is NOT "closed" in the FR18 sense: nothing was issued, received or
// reconciled. Several answers read very differently for the two, so they are told apart here.
function scAgentRejected(t){
  return !!t&&(t.status==='Rejected'||scDocStatus(t,'scr')==='Rejected');
}
function scAgentClone(t){try{return JSON.parse(JSON.stringify(t));}catch(e){return t;}}
function scAgentRecon(t){try{return scComputeRecon(scAgentClone(t));}catch(e){return {};}}
function scAgentGate(t){try{return scGateBlock(scAgentClone(t));}catch(e){return '';}}

/* == THE ANSWERS ===========================================================================
   Intent matching is deliberately shallow — a handful of keyword groups — because the value is
   in the DERIVATION, not the parsing. Each branch reads the record and states what is actually
   true of it. == */
function scAgentMatch(q,words){q=' '+q.toLowerCase()+' ';return words.some(function(w){return q.indexOf(w)>-1;});}

/* == ASKING ABOUT ANY TRANSACTION, NOT JUST THE OPEN ONE ====================================
   The copilot used to answer only about whatever was on screen, which made it a caption for the
   current page rather than something you could interrogate. A transaction is identifiable by any
   of the ELEVEN numbers it carries — SUB, PO, SHP, OUT, TO, DN, CH, GP, ASN, IMR, BOM — and a
   user quoting any of them means the same record, so all of them resolve. == */
const SC_AGENT_REF_RX=/\b(?:SUB|PO|SHP|OUT|TO|DN|CH|GP|ASN|IMR|BOM)[-\/ ]?\d{4}[-\/ ]?\d{2,6}\b/ig;
function scAgentNorm(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function scAgentDocNos(t){
  return [t.no,t.po.no,t.shipment.no,t.shipment.outboundKey,t.shipment.transferOrder,
    t.dn.no,t.challan.no,t.challan.gatePassNo,t.asn.no,t.imr.no,t.bomRef]
    .filter(Boolean).map(scAgentNorm);
}
function scAgentResolve(token){
  const want=scAgentNorm(token);
  if(!want)return null;
  let hit=scState.txns.find(function(t){return scAgentDocNos(t).indexOf(want)>-1;});
  if(hit)return hit;
  /* A bare tail ("00151", "151") is how people actually say these out loud. Matched on the END
     of the stored number rather than the whole of it, because the part a person repeats is the
     sequence, not the SUB-2026- prefix they share with every other record. */
  const digits=want.replace(/^[A-Z]+/,'');
  const tail=digits.replace(/^0+/,'');
  // Length checked on the DIGITS, not on the zero-stripped tail: "00009" is a five-digit
  // reference, and testing the stripped "9" skipped the whole branch as too short to be meant.
  if(digits.length>=2&&tail.length)hit=scState.txns.find(function(t){
    return scAgentDocNos(t).some(function(n){
      const nt=n.replace(/^[A-Z]+/,'');
      return nt.replace(/^0+/,'')===tail||nt.slice(-tail.length).replace(/^0+/,'')===tail;
    });
  });
  return hit||null;
}
/* WHO MAY ASK ABOUT WHAT. Internal roles all work for the same company and already see every
   transaction they have touched, so they may query across the portfolio. External vendors may
   not: FR13.1 confines a vendor to its own purchase orders, and it would be incoherent to
   enforce that on the screen and then let the copilot read another vendor's record aloud. */
function scAgentCanSee(txn){
  const me=typeof activePersonaId!=='undefined'?scActor(activePersonaId):null;
  if(!me||!txn)return true;
  if(!me.vendorCode)return true;                       // internal role
  return !txn.scr.vendor||txn.scr.vendor===me.vendorCode;
}
/* What the question is ABOUT: a transaction named by reference, else the one on screen. */
function scAgentSubject(q){
  const tokens=String(q||'').match(SC_AGENT_REF_RX);
  if(tokens&&tokens.length){
    for(let i=0;i<tokens.length;i++){
      const t=scAgentResolve(tokens[i]);
      if(t)return scAgentCanSee(t)?{txn:t,byRef:true,token:tokens[i]}
                                  :{txn:null,byRef:true,denied:t,token:tokens[i]};
    }
    return {txn:null,byRef:true,token:tokens[0]};
  }
  /* A standalone run of digits, tried only when no full reference was given — "status of 00151".
     Four digits minimum so ordinary numbers in a question ("100 units", "step 11") cannot hijack
     it, and only accepted when it actually resolves. */
  const bare=String(q||'').match(/\b\d{4,8}\b/g);
  if(bare)for(let i=0;i<bare.length;i++){
    const t=scAgentResolve(bare[i]);
    if(t)return scAgentCanSee(t)?{txn:t,byRef:true,token:bare[i]}
                                :{txn:null,byRef:true,denied:t,token:bare[i]};
  }
  return {txn:scAgentCtx().txn,byRef:false};
}
// Portfolio questions are about the set, not about one record.
function scAgentIsPortfolio(q){
  return scAgentMatch(q,['all ','list','how many','everything','portfolio','overdue','which ','anything',
    'open ','pending with','queue','summary of','across','total','count','stuck','waiting',
    // The terminal-state words too: "show me closed transactions" is a board question, and
    // without these it tripped the ambiguity check and got asked "which one?" back.
    'closed','rejected','finished','completed','history','show me','board']);
}
/* "What is the status of the SCR?" names no SCR. Answering it with the whole board buries the
   one record the person means, and answering it about whatever happens to be on screen answers
   a question they did not ask. Neither is useful, so the copilot asks back — with the range it
   can actually resolve, which is the one thing the person needs in order to ask properly. */
function scAgentIsAmbiguous(q){
  return scAgentMatch(q,['scr','status','transaction','request','order','job'])&&!scAgentIsPortfolio(q);
}
function scAgentRange(){
  const all=scAgentVisibleTxns().filter(function(t){return t.no;});
  const nums=all.map(function(t){return t.no;}).sort();
  return {all:all,first:nums[0],last:nums[nums.length-1],count:nums.length};
}
function scAgentRangePrompt(){
  const r=scAgentRange();
  if(!r.count)return 'There are no transactions on the board yet.';
  const open=r.all.filter(function(t){return !t.closed;});
  const closed=r.all.filter(function(t){return t.closed;});
  return 'Which one? I have **'+r.count+'** transactions, **'+r.first+'** through **'+r.last+'**.\n\n'
    +'· '+open.length+' open, '+closed.length+' closed or rejected\n'
    +'· Quote any reference — the SCR, or its PO, challan, ASN or IMR number\n'
    // The SEQUENCE, not everything after the first letter — "SUB-2026-00030" split on the dashes
    // gives "00030", which is the part a person actually repeats.
    +'· A bare number works too, so **'+String(r.last).split('-').pop()+'** is enough\n\n'
    +'Or ask across the board: *what is overdue*, *what is with Finance*, *show me everything open*.';
}

/* == WHAT TO ASK NEXT ======================================================================
   An answer that ends in silence puts the burden of knowing what is askable back on the user.
   These are computed from the SUBJECT and its actual state — a transaction at reconciliation
   gets offered the reconciliation questions, a blocked one gets offered the blocker — so the
   suggestions lead somewhere rather than being a fixed menu. == */
function scAgentFollowups(q,sub){
  const t=sub&&sub.txn;
  if(sub&&sub.byRef&&!t)
    return scAgentRange().all.slice(0,3).map(function(x){return {t:x.no,q:'Status of '+x.no};});
  if(!t){
    const r=scAgentRange();
    const picks=r.all.filter(function(x){return !x.closed;}).slice(0,2)
      .map(function(x){return {t:x.no,q:'Status of '+x.no};});
    return picks.concat([{t:'Overdue',q:'What is overdue?'},
      {t:'With Finance',q:'What is with Finance?'}]).slice(0,4);
  }
  /* Short LABEL, full QUESTION. The chips used to carry the whole sentence — "What happens next
     on SUB-2026-00138?" — so five of them stacked into five full-width rows and swamped the
     answer above. The reference is already established by the conversation, so the chip only has
     to name the move; the question sent is still the unambiguous one. */
  const no=t.no||'this one',out=[];
  const add=function(label,q){out.push({t:label,q:q});};
  if(scAgentRejected(t)){
    add('Rejection history','Who has acted on '+no+'?');
    add('Closed & rejected','Show me closed transactions');
    return out;
  }
  if(scAgentState.agent==='recon'){
    if(!t.closed)add('Why blocked?','Why can I not close '+no+'?');
    add('How is it calculated?','How is consumption calculated for '+no+'?');
    add('What is outstanding?','What is outstanding on '+no+'?');
    return out.slice(0,3);
  }
  if(!t.closed&&scAgentGate(t))add('Why blocked?','Why is '+no+' blocked?');
  else if(!t.closed)add('What happens next?','What happens next on '+no+'?');
  add('Where is the material?','Where is the material on '+no+'?');
  add('Documents','Show me the documents for '+no);
  if(t.step>=16)add('Reconciliation','Explain the reconciliation for '+no);
  else add('Who has acted?','Who has acted on '+no+'?');
  return out.slice(0,4);
}

/* == THE PORTFOLIO VIEW — the dashboard, answered in prose ================================== */
function scAgentVisibleTxns(){
  return scState.txns.filter(function(t){return scAgentCanSee(t);});
}
function scAgentLine(t){
  return '· **'+(t.no||'Draft')+'** — '+(t.closed?('**'+t.status+'**')
      :('step '+t.step+' '+scStep(t.step).short+', with '+scActorLabel(t.pendingWith)))
    +(t.closed?'':', waiting '+scSince(t.pendingSince))
    +(scOverdue(t)?'  ·  OVERDUE':'');
}
function scAgentPortfolio(q){
  const all=scAgentVisibleTxns();
  const open=all.filter(function(t){return !t.closed;});
  const closed=all.filter(function(t){return t.closed;});
  if(!all.length)return 'There are no transactions I can see yet.';

  if(scAgentMatch(q,['overdue','late','breach','sla'])){
    const od=open.filter(scOverdue);
    return od.length
      ? '**'+od.length+'** transaction'+(od.length===1?' is':'s are')+' overdue against the expected return date:\n\n'
        +od.map(scAgentLine).join('\n')
      : 'Nothing is overdue. '+open.length+' open transaction'+(open.length===1?'':'s')+', none past its expected return date.';
  }
  if(scAgentMatch(q,['closed','rejected','finished','completed','done','history'])){
    return closed.length
      ? '**'+closed.length+'** closed or rejected transaction'+(closed.length===1?'':'s')+', retained for audit:\n\n'
        +closed.slice(0,12).map(scAgentLine).join('\n')
      : 'Nothing has closed yet — all '+open.length+' transactions are still in flight.';
  }
  // "with finance", "at gate outward", "pending with stores"
  /* Match on the WORDS of a role, not the whole label. "what is with Finance" never contains the
     literal label "Finance / F&A", so a whole-label test silently fell through to the full board
     and the question looked like it had been ignored. Words of three letters or more only, so
     noise words in a label cannot match everything. */
  const ql=' '+q.toLowerCase()+' ';
  const actorHit=SC_ACTORS.find(function(a){
    const words=(a.label+' '+(a.name||'')).toLowerCase().split(/[^a-z]+/).filter(function(w){return w.length>=3;});
    return words.some(function(w){return ql.indexOf(' '+w)>-1;});});
  if(actorHit&&scAgentMatch(q,['with','at ','pending','waiting','queue','has ','holding'])){
    const his=open.filter(function(t){return t.pendingWith===actorHit.id;});
    return his.length
      ? '**'+his.length+'** transaction'+(his.length===1?'':'s')+' waiting on **'+actorHit.name+'** ('+actorHit.label+'):\n\n'
        +his.map(scAgentLine).join('\n')
      : 'Nothing is waiting on '+actorHit.name+' ('+actorHit.label+') right now.';
  }
  const stepHit=SC_STEPS.find(function(s){
    return s.short&&q.toLowerCase().indexOf(s.short.toLowerCase())>-1;});
  if(stepHit){
    const at=open.filter(function(t){return t.step===stepHit.no;});
    return at.length
      ? '**'+at.length+'** transaction'+(at.length===1?'':'s')+' at **step '+stepHit.no+' — '+stepHit.name+'**:\n\n'
        +at.map(scAgentLine).join('\n')
      : 'Nothing is sitting at step '+stepHit.no+' ('+stepHit.name+') right now.';
  }
  // default: the whole board, grouped by phase, the way the dashboard shows it
  const byStep={};
  open.forEach(function(t){(byStep[t.step]=byStep[t.step]||[]).push(t);});
  const od=open.filter(scOverdue).length;
  return '**'+open.length+'** open transaction'+(open.length===1?'':'s')+
      (closed.length?', **'+closed.length+'** closed':'')+
      (od?', **'+od+'** overdue':'')+'.\n\n'
    +Object.keys(byStep).sort(function(a,b){return a-b;}).map(function(k){
        return '· **Step '+k+' — '+scStep(Number(k)).short+'** ('+byStep[k].length+'): '
          +byStep[k].map(function(t){return t.no||'Draft';}).join(', ');
      }).join('\n')
    +'\n\nName any reference — an SCR, PO, challan, ASN, IMR — and I will tell you where that one stands.';
}

function scAgentAnswerAskDeal(q){
  const c=scAgentCtx();
  const sub=scAgentSubject(q);
  if(sub.denied)return 'I cannot open **'+(sub.denied.no||sub.token)+'** for you — it belongs to '
    +((scVendor(sub.denied.scr.vendor)||{}).name||'another vendor')
    +', and a vendor login only sees its own purchase orders.';
  if(sub.byRef&&!sub.txn)return 'I cannot find **'+sub.token+'**. I match on any reference a transaction carries — '
    +'SCR, PO, shipment, outbound key, delivery note, challan, gate pass, ASN, IMR or BOM. Check the number and ask again.';

  // Nothing named, nothing open, and the question is about "an SCR" — ask which one.
  if(!sub.byRef&&!sub.txn&&scAgentIsAmbiguous(q))return scAgentRangePrompt();
  // A reference always wins; otherwise a portfolio-shaped question is about the whole board.
  if(!sub.byRef&&(!sub.txn||scAgentIsPortfolio(q)))return scAgentPortfolio(q);

  const t=sub.txn;
  if(!t)return scAgentPortfolio(q);
  const s=t.scr,v=typeof scVendor==='function'?scVendor(s.vendor):null;
  // Answering about something the user is not looking at: say which record, so the reply is never
  // mistaken for the page in front of them.
  const lead=sub.byRef?'':'';

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
  const r=scAgentRecon(t);
  return 'Here is where **'+(t.no||'this transaction')+'** stands:\n\n'
    +(t.closed
      ? '· **'+t.status+'**'+(t.closedBy?' by '+scActorLabel(t.closedBy)+' on '+t.closedAt:'')+'\n'
        +'· Reached step '+t.step+' — '+scStep(t.step).name+'\n'
      : '· Step **'+t.step+' — '+scStep(t.step).name+'**\n'
        +'· Waiting on **'+scActorLabel(t.pendingWith||'—')+'** for '+scSince(t.pendingSince)+'\n')
    +'· Vendor — '+(v?v.name:(s.internalBP||'—'))+'\n'
    +'· Receivable — '+(s.recvQty||'—')+' x '+(s.recvItem||'—')
      +(r&&r.received!==undefined&&t.step>=16?'  ('+r.received+' received, '+r.pending+' pending)':'')+'\n'
    +'· Material position — **'+(t.position||'Main')+'**\n'
    +'· '+(s.billable==='No'?'Non-billable':'Billable')+', logistics '+(scLogisticsRequired(t)==='Yes'?'required':'not required')+'\n'
    +'· Documents — '+scAgentDocNos(t).length+' raised'
      +(scOverdue(t)?'\n· **OVERDUE** against '+t.shipment.expectedReturn:'')+'\n\n'
    +(sub.byRef?'Ask me about its material, blockers, documents or history — or name another reference.'
               :'Ask me where the material is, what is blocking it, what happens next, or who has acted on it.');
}

function scAgentAnswerRecon(q){
  const sub=scAgentSubject(q);
  if(sub.denied)return 'I cannot open **'+(sub.denied.no||sub.token)+'** — it belongs to another vendor.';
  if(sub.byRef&&!sub.txn)return 'I cannot find **'+sub.token+'**. Quote any reference the transaction carries and I will reconcile that one.';
  const t=sub.txn;
  if(!t){
    // Reconciliation across the board, so this agent is useful from the dashboard too.
    const live=scAgentVisibleTxns().filter(function(x){return x.step>=16&&!x.closed;});
    if(!live.length)return 'Nothing has reached reconciliation yet. It opens at step 16, once Stores confirms a material receipt.\n\nName any reference and I will reconcile that transaction, open or closed.';
    return '**'+live.length+'** transaction'+(live.length===1?' is':'s are')+' at or past material receipt:\n\n'
      +live.map(function(x){const r=scAgentRecon(x);
        /* Judged on the NUMBERS, not on scGateBlock. That gate only evaluates at step 17, so a
           transaction sitting at 16 with a thousand units pending came back "ready" — the one
           thing this line must never get wrong. */
        const clear=Number(r.pending||0)===0&&Number(r.outstanding||0)===0
          &&!r.scrapMissingReason&&!r.returnMissingReason&&!r.returnMissingLocation;
        return '· **'+(x.no||'Draft')+'** — '+r.received+' of '+r.expected+' received, '
          +r.pending+' pending, '+r.outstanding+' issue material outstanding'
          +(clear?'  ·  reconciles':'  ·  not yet reconciled');}).join('\n')
      +'\n\nName one and I will explain its arithmetic and what is blocking closure.';
  }
  /* A REJECTED transaction has no reconciliation, and saying otherwise invents one. FR2.9 stops
     a rejected SCR dead: "block Product / WIP / BOM processing; block Order / PO creation; block
     Shipment and material movement." Nothing was ever issued, so there is nothing to reconcile —
     but the terminal check below keyed on `closed`, and a rejection is closed, so it sailed past
     the not-started guard and reported an issue quantity that had never left the building. */
  if(scAgentRejected(t))
    return '**'+(t.no||'This transaction')+'** was **rejected** at approval'
      +(t.step?' (step '+t.step+' — '+scStep(t.step).short+')':'')+', so it has no reconciliation.\n\n'
      +'FR2.9 stops a rejected SCR before anything moves: no PO is created, no shipment is raised '
      +'and no material is ever issued. The record is retained for audit only.\n\n'
      +'Ask me *who has acted on '+(t.no||'it')+'* for the rejection reason and who recorded it.';
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
    if(t.closed)return '**'+(t.no||'This transaction')+'** is already closed'
      +(t.closedBy?' — '+scActorLabel(t.closedBy)+' closed it on '+t.closedAt:'')+'. '
      +'At closure the SCR, PO, Shipment and Challan all moved to Closed; the Delivery Note stayed Approved, the ASN QC Cleared and the IMR Confirmed — FR18.3 deliberately leaves those three alone.';
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
    ? thread.map(function(m,i){
        if(m.role==='user')
          return '<div class="sca-row sca-row-me"><div class="sca-bubble sca-me">'+scAgentMd(m.text)+'</div></div>';
        /* Suggestions belong to the LAST answer only. Left under every reply they pile up as the
           thread grows and it stops being obvious which ones still apply. */
        const last=i===thread.length-1&&!scAgentState.busy;
        const next=(last&&(m.next||[]).length)
          ? '<div class="sca-next">'
            +m.next.map(function(n){
                const label=typeof n==='string'?n:n.t,ask=typeof n==='string'?n:n.q;
                return '<button class="sca-chip sca-chip-next" onclick="scAgentAsk(this.dataset.q)" data-q="'
                  +String(ask).replace(/"/g,'&quot;')+'">'+scEsc(label)+'</button>';
              }).join('')+'</div>'
          : '';
        // The message being typed out gets a stable id so the stream can update it in place.
        const inner=m.streaming
          ? '<div id="sca-stream">'+scAgentMd(scAgentPartial(m.text,m.shown||0))+'<span class="sca-caret"></span></div>'
          : scAgentMd(m.text);
        return '<div class="sca-row"><div class="sca-av">'+a.initials+'</div>'
          +'<div class="sca-bubble-wrap"><div class="sca-bubble sca-bot">'+inner+'</div>'+next+'</div></div>';
      }).join('')
      /* The thinking row names what it is reading. A spinner says "wait"; this says what for,
         which is the difference between a loading state and an assistant. */
      +(scAgentState.busy&&!thread.some(function(m){return m.streaming;})
        ? '<div class="sca-row"><div class="sca-av sca-av-live">'+a.initials+'</div>'
          +'<div class="sca-think"><span id="sca-think">'+scEsc((scAgentState.think||['Thinking'])[0])+'</span>'
          +'<i></i><i></i><i></i></div></div>'
        : '')
    : '<div class="sca-empty"><div class="sca-empty-av">'+a.initials+'</div>'
      +'<div class="sca-empty-t">'+a.name+'</div><div class="sca-empty-b">'+a.blurb+'</div></div>';

  return '<div class="sca-head">'
      +'<div class="sca-head-l"><div class="sca-av sca-av-lg">'+a.initials+'</div>'
        +'<div><div class="sca-title">'+a.name+' <span class="sca-live"></span></div>'
        +'<div class="sca-ctx" id="sca-ctx">'+scAgentCtxLabel()+'</div></div></div>'
      +'<button class="sca-x" onclick="scAgentToggle()" aria-label="Close">&times;</button>'
    +'</div>'
    +'<div class="sca-tabs">'+SC_AGENTS.map(function(x){
        return '<button class="sca-tab'+(x.id===scAgentState.agent?' on':'')+'" onclick="scAgentSwitch(\''+x.id+'\')">'+x.name+'</button>';
      }).join('')+'</div>'
    +'<div class="sca-body" id="sca-body">'+body+'</div>'
    /* The starter prompts are an EMPTY-STATE affordance. Once the conversation has started the
       contextual "next" chips under the last answer do the same job better, and showing both left
       two competing chip areas stacked above the input — four rows of static suggestions pushing
       the actual answer off screen. */
    +(thread.length?''
      :'<div class="sca-chips">'+a.prompts.slice(0,5).map(function(p){
        return '<button class="sca-chip" onclick="scAgentAsk(this.dataset.q)" data-q="'+p.replace(/"/g,'&quot;')+'">'+p+'</button>';
      }).join('')+'</div>')
    +'<div class="sca-input">'
      +'<input id="sca-q" placeholder="Ask about any transaction, or quote a reference…" autocomplete="off" '
        +'onkeydown="if(event.key===\'Enter\'){event.preventDefault();scAgentSendInput();}">'
      +'<button class="sca-send" onclick="scAgentSendInput()" aria-label="Send">'
        +'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>'
      +'</button>'
    +'</div>'
    // One line. Two wrapped to three rows on a 404px panel and ate the space the answer needed.
    +'<div class="sca-foot">Read-only · generated from live data</div>';
}

function scAgentRender(){
  const host=document.getElementById('sc-agent-panel');
  if(!host)return;
  /* This rebuilds the whole panel, which destroys the input along with it. In a chat that is
     felt immediately: you send a message and the caret is gone, so the next one needs a click
     first. Carry the focus and any half-typed text across the rebuild. */
  const old=document.getElementById('sca-q');
  const hadFocus=!!(old&&document.activeElement===old);
  const draft=old?old.value:'';

  host.innerHTML=scAgentHTML();
  const b=document.getElementById('sca-body');
  if(b)b.scrollTop=b.scrollHeight;

  const now=document.getElementById('sca-q');
  if(now){
    if(draft)now.value=draft;
    if(hadFocus)now.focus();
  }
  const fab=document.getElementById('sc-agent-fab');
  if(fab)fab.classList.toggle('hidden',scAgentState.open);
  const scrim=document.getElementById('sc-agent-scrim');
  if(scrim)scrim.classList.toggle('on',scAgentState.open);
  host.classList.toggle('open',scAgentState.open);
}

function scAgentToggle(){
  scAgentState.open=!scAgentState.open;
  scAgentRender();
  if(scAgentState.open){
    /* Focus AFTER the browser has applied `.open`. The panel is visibility:hidden until that
       class lands, and an element inside a hidden subtree cannot take focus — calling focus()
       synchronously here silently did nothing, so the panel opened with the caret nowhere and
       you had to click the box before typing.
       A timeout rather than requestAnimationFrame: rAF is tied to frame production and does not
       fire dependably in a headless render, which made this fix untestable as well as unreliable. */
    setTimeout(function(){
      const i=document.getElementById('sca-q');
      if(i&&scAgentState.open)i.focus();
    },0);
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
    // Escape closes it, which is the other half of what people expect once a scrim is up.
    scAgentState.esc=function(e){if(e.key==='Escape'&&scAgentState.open)scAgentToggle();};
    document.addEventListener('keydown',scAgentState.esc);
  }else{
    if(scAgentState.tick){clearInterval(scAgentState.tick);scAgentState.tick=null;}
    if(scAgentState.esc){document.removeEventListener('keydown',scAgentState.esc);scAgentState.esc=null;}
    /* Closing mid-stream completes the message rather than abandoning it half-typed. Without
       this the thread keeps a truncated answer and `busy` stays true, so the panel reopens
       permanently unable to accept another question. */
    scAgentStopStream();
    scAgentThread().forEach(function(m){if(m.streaming){m.shown=m.text.length;m.streaming=false;}});
    scAgentState.busy=false;
  }
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
/* == THINKING, THEN STREAMING ===============================================================
   The answer is computed synchronously — there is nothing to wait for. But an assistant that
   returns a finished essay the instant you press Enter reads as a database lookup, and a demo
   audience reads it as canned. Two things fix that, and neither fakes the content:

     1. A THINKING phase that names what it is actually about to read — "Reading SUB-2026-00014",
        "Working through the FR17 arithmetic" — rather than a generic spinner.
     2. STREAMING the reply out. This is the single most recognisable behaviour of a real
        assistant, and it also lets a long answer be read as it arrives instead of landing as a
        wall of text.

   The stream updates ONE element rather than re-rendering the panel on every tick, so the input
   is not destroyed and re-created sixty times while the answer types out. == */
function scAgentThinkingLabels(q,sub){
  /* The label has to describe the answer that is actually coming. A board-wide question asked
     while a transaction happens to be open still resolves a subject, so keying only on that
     produced "Reading SUB-2026-00016" above a reply about all thirty — the routing rule from
     scAgentAnswerAskDeal has to be mirrored here or the two disagree. */
  const board=sub&&!sub.byRef&&(!sub.txn||scAgentIsPortfolio(q));
  const t=board?null:(sub&&sub.txn),who=t?(t.no||'this transaction'):null;
  if(sub&&sub.byRef&&!t)return ['Searching every reference','Checking the document numbers'];
  if(scAgentState.agent==='recon')
    return [who?'Reading '+who:'Reading the board','Working through the FR17 arithmetic','Checking what blocks closure'];
  if(!t)return ['Reading the board','Grouping by step and owner','Checking what is overdue'];
  if(scAgentMatch(q,['block','stuck','why','delay']))return ['Reading '+who,'Checking the gates on step '+t.step,'Looking at who holds it'];
  if(scAgentMatch(q,['material','where','stock']))return ['Reading '+who,'Tracing the material position','Checking reservations and receipts'];
  if(scAgentMatch(q,['who','history','log','acted']))return ['Reading '+who,'Walking the activity log'];
  return ['Reading '+who,'Checking its documents and status'];
}
function scAgentStopStream(){
  if(scAgentState.streamTick){clearInterval(scAgentState.streamTick);scAgentState.streamTick=null;}
  if(scAgentState.thinkTick){clearInterval(scAgentState.thinkTick);scAgentState.thinkTick=null;}
}
function scAgentAsk(q){
  if(scAgentState.busy)return;
  const thread=scAgentThread();
  thread.push({role:'user',text:q});
  const sub=scAgentSubject(q);
  scAgentState.busy=true;
  scAgentState.think=scAgentThinkingLabels(q,sub);
  scAgentState.thinkAt=0;
  scAgentRender();
  // Rotate the thinking line so a longer pause does not look frozen.
  scAgentState.thinkTick=setInterval(function(){
    scAgentState.thinkAt++;
    const el=document.getElementById('sca-think');
    if(el&&scAgentState.think[scAgentState.thinkAt])el.textContent=scAgentState.think[scAgentState.thinkAt];
  },700);

  setTimeout(function(){
    let answer,next=[];
    try{
      answer=scAgentAnswer(q);
      next=scAgentFollowups(q,sub);
    }catch(e){answer='I could not read that transaction cleanly just now. Reopen it from the board and ask me again.';}
    scAgentStopStream();
    const msg={role:'bot',text:answer,next:next,shown:0,streaming:true};
    thread.push(msg);
    scAgentRender();
    // Reveal in chunks. Larger steps for long answers so a board listing does not crawl.
    const step=Math.max(3,Math.round(answer.length/90));
    scAgentState.streamTick=setInterval(function(){
      msg.shown+=step;
      if(msg.shown>=answer.length){
        msg.shown=answer.length;msg.streaming=false;
        scAgentStopStream();
        scAgentState.busy=false;
        scAgentRender();                       // full render brings in the follow-up chips
        return;
      }
      const el=document.getElementById('sca-stream');
      if(el){
        el.innerHTML=scAgentMd(scAgentPartial(answer,msg.shown))+'<span class="sca-caret"></span>';
        const b=document.getElementById('sca-body');
        if(b)b.scrollTop=b.scrollHeight;
      }else{scAgentStopStream();scAgentState.busy=false;scAgentRender();}
    },16);
  },520+Math.min(900,q.length*10));
}
/* Half-streamed markdown must not render half a rule. An odd number of ** would leave the rest
   of the answer bolded as it types; the trailing marker is dropped until its partner arrives. */
function scAgentPartial(text,n){
  let s=text.slice(0,n);
  if((s.match(/\*\*/g)||[]).length%2)s=s.slice(0,s.lastIndexOf('**'));
  return s;
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
/* The scrim blurs the page BEHIND it rather than blurring the app's own DOM: backdrop-filter
   leaves the layout untouched, so nothing reflows and the panel above it stays perfectly sharp.
   Filtering .page-content instead would blur the panel too if it were ever nested, and would
   force a repaint of the whole board on every open. */
'#sc-agent-scrim{position:fixed;inset:0;z-index:895;background:rgba(15,23,42,.16);',
'  backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);',
'  opacity:0;pointer-events:none;transition:opacity .24s ease}',
'#sc-agent-scrim.on{opacity:1;pointer-events:auto}',
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
'.sca-title{font-size:14px;font-weight:700;line-height:1.2;display:flex;align-items:center;gap:6px}',
'.sca-live{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 2.5px rgba(34,197,94,.18);flex-shrink:0}',
'.sca-ctx{font-size:11.5px;color:var(--gray,#6a7282);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:270px}',
'.sca-x{border:0;background:transparent;font-size:24px;line-height:1;color:var(--gray,#6a7282);cursor:pointer;padding:0 4px;border-radius:6px}',
'.sca-x:hover{background:var(--ol,#f1f5f9);color:var(--navy,#0f172a)}',
'.sca-tabs{display:flex;gap:6px;padding:10px 16px;border-bottom:1px solid var(--border,#e5e7eb);flex-shrink:0}',
/* Every transition below names its properties. `transition:.15s` is shorthand for
   `transition:all`, and the panel toggles visibility on open — so an `all` transition on a child
   made the INHERITED visibility change animate rather than flip. The input stayed
   visibility:hidden for the first half of the transition, and an element with computed
   visibility hidden cannot take focus, so the caret never landed in the box. */
'.sca-tab{flex:1;border:1px solid var(--border,#e5e7eb);background:var(--card,#fff);border-radius:8px;padding:7px 8px;',
'  font-size:11.5px;font-weight:600;color:var(--gray,#6a7282);cursor:pointer;font-family:inherit;',
'  transition:border-color .15s,color .15s,background .15s;',
'  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.sca-tab:hover{border-color:#cbd5e1;color:var(--navy,#0f172a)}',
'.sca-tab.on{background:var(--navy,#0f172a);border-color:var(--navy,#0f172a);color:#fff}',
'.sca-body{flex:1;overflow-y:auto;padding:18px 16px;display:flex;flex-direction:column;gap:16px;background:var(--light,#f8f9fb)}',
'.sca-row{display:flex;gap:9px;align-items:flex-start;animation:fadeUp .22s ease}',
'.sca-row-me{justify-content:flex-end}',
'.sca-bubble-wrap{max-width:88%;min-width:0}',
'.sca-bubble{max-width:82%;padding:11px 13px;border-radius:14px;font-size:12.5px;line-height:1.68;word-break:break-word}',
'.sca-bubble-wrap .sca-bubble{max-width:100%}',
'.sca-next{margin-top:9px;display:flex;flex-wrap:wrap;gap:6px}',
'.sca-chip-next{background:transparent;border-color:#cbd5e1;color:var(--gray,#6a7282);font-size:11px;padding:5px 10px}',
'.sca-chip-next:hover{background:var(--card,#fff);border-color:var(--navy,#0f172a);color:var(--navy,#0f172a)}',
'.sca-bot{background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-top-left-radius:5px;',
'  box-shadow:0 1px 2px rgba(15,23,42,.04)}',
'.sca-bot b{font-weight:650}',
'.sca-me{background:var(--navy,#0f172a);color:#fff;border-top-right-radius:5px}',
'.sca-p{margin:0}',
'.sca-gap{height:7px}',
'.sca-li{position:relative;padding-left:13px;margin:1px 0}',
'.sca-li:before{content:"";position:absolute;left:3px;top:8px;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.42}',
'.sca-sub{padding-left:13px;color:var(--gray,#6a7282);font-size:11.5px}',
'.sca-me .sca-sub{color:rgba(255,255,255,.72)}',
/* THINKING. The label shimmers the way a real assistant's does — a highlight travelling across
   the text — rather than sitting static next to a spinner. */
'.sca-think{display:flex;align-items:center;gap:7px;padding:9px 2px;font-size:12.5px;font-weight:500}',
'.sca-think span{background:linear-gradient(90deg,#94a3b8 0%,#0f172a 42%,#94a3b8 84%);background-size:220% 100%;',
'  -webkit-background-clip:text;background-clip:text;color:transparent;animation:sca-shimmer 1.6s linear infinite}',
'@keyframes sca-shimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}',
'.sca-think i{width:4px;height:4px;border-radius:50%;background:var(--gray,#6a7282);animation:blink 1.3s infinite}',
'.sca-think i:nth-of-type(2){animation-delay:.18s}',
'.sca-think i:nth-of-type(3){animation-delay:.36s}',
'.sca-av-live{position:relative}',
'.sca-av-live:after{content:"";position:absolute;inset:-3px;border-radius:11px;border:1.5px solid var(--navy,#0f172a);opacity:.25;animation:sca-pulse 1.6s ease-out infinite}',
'@keyframes sca-pulse{0%{transform:scale(1);opacity:.3}100%{transform:scale(1.32);opacity:0}}',
/* The caret that trails the streaming text. */
'.sca-caret{display:inline-block;width:2px;height:13px;background:var(--navy,#0f172a);margin-left:2px;',
'  vertical-align:-2px;animation:blink .9s steps(1) infinite}',
'.sca-empty{text-align:center;padding:34px 18px;color:var(--gray,#6a7282)}',
'.sca-empty-av{width:44px;height:44px;border-radius:13px;background:var(--navy,#0f172a);color:#fff;display:flex;align-items:center;',
'  justify-content:center;font-size:15px;font-weight:700;margin:0 auto 12px}',
'.sca-empty-t{font-size:14px;font-weight:700;color:var(--navy,#0f172a);margin-bottom:6px}',
'.sca-empty-b{font-size:12.5px;line-height:1.6;max-width:280px;margin:0 auto}',
'.sca-chips{display:flex;gap:6px;padding:10px 16px 0;flex-wrap:wrap;flex-shrink:0}',
'.sca-chip{border:1px solid var(--border,#e5e7eb);background:var(--card,#fff);border-radius:16px;padding:6px 11px;',
'  font-size:11.5px;font-weight:500;color:var(--navy,#0f172a);cursor:pointer;font-family:inherit;',
'  transition:border-color .15s,background .15s}',
'.sca-chip:hover{border-color:var(--navy,#0f172a);background:var(--ol,#f1f5f9)}',
'.sca-input{display:flex;gap:8px;align-items:center;padding:12px 16px 8px;flex-shrink:0}',
'.sca-input input{flex:1;border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:10px 12px;font-size:12.5px;',
'  font-family:inherit;color:var(--navy,#0f172a);outline:none;',
'  transition:border-color .15s,box-shadow .15s;min-width:0}',
'.sca-input input:focus{border-color:var(--navy,#0f172a);box-shadow:0 0 0 3px rgba(15,23,42,.07)}',
'.sca-send{width:36px;height:36px;border-radius:10px;border:0;background:var(--navy,#0f172a);color:#fff;cursor:pointer;',
'  display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s}',
'.sca-send:hover{opacity:.86}',
'.sca-foot{padding:0 16px 11px;font-size:10px;line-height:1.4;color:var(--gray,#6a7282);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'@media (max-width:520px){#sc-agent-panel{width:100vw}}'
].join('\n');
  document.head.appendChild(css);

  // Clicking the dimmed area closes the panel — the gesture people already expect from a
  // slide-over, and the only way out other than the × once the background is not clickable.
  const scrim=document.createElement('div');
  scrim.id='sc-agent-scrim';
  scrim.onclick=function(){if(scAgentState.open)scAgentToggle();};
  document.body.appendChild(scrim);

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
