/* ==========================================================================================
   SUB-CONTRACTING — the journey, its actors, its records and its screens
   ==========================================================================================
   Everything for the Sub-Contracting journey lives in this one file rather than being folded
   into core.js and pages.js. Those two are already ~5,000 and ~16,000 lines, and this journey
   is eighteen steps over eleven actors with its own persistence, its own master data and its
   own screens on two form factors. Kept apart it can be read, and it can be removed.

   WHAT IT OWNS
     SC_STEPS          the eighteen steps, their actors and phases — the spine everything reads
     SC_ACTORS         the eleven roles, which REPLACE the nine enterprise personas
     scMaster          the master data the forms select from (FRD Master Data tab, section A)
     scReasons         the reason-code sets (FRD Reason Codes tab) — filtered by set + stage
     scState           the live records, persisted to localStorage
     buildSc*HTML      the screens

   WHAT IT DOES NOT OWN
     The shell. It renders inside the existing chrome — sidebar, topbar, persona switcher — and
     hangs off dashboardTabsForRole and the Journeys launcher card. No new sidebar rows.

   PERSISTENCE IS ITS OWN KEY, deliberately. The app already persists to
   `opendhi_mockup_state_v1` (persistAppState, js/core.js) and that snapshot is rewritten on
   every render from a fixed list of arrays. Adding this journey to it would mean either
   extending that list — coupling two unrelated stores — or losing the journey whenever that
   snapshot is reset. A separate key means a Sub-Contracting run survives a reset of the rest,
   and vice versa. == */

const SC_STORE_KEY='opendhi_subcontracting_v1';

/* == THE ELEVEN ACTORS =====================================================================
   These REPLACE enterprisePersonas. Same shape as the nine they replace — the persona
   switcher, the topbar identity, requesterProfile and manualStepOwnerPersonaId all read those
   fields — plus `scSteps`, which is this journey's addition: the step numbers this role owns.

   `scSteps` is what greys the dashboard tiles. A tile whose step number is in the active
   role's list is live and clickable; every other tile is inert and shows how many of THIS
   role's own transactions are parked there. That is the whole mechanic, and keeping it as a
   list of numbers on the persona means adding a role is one entry, not a switch statement.

   Two roles own step 12 (Planner and PMG) and two own steps 8/16 (Stores) — the FRD names
   pairs on several steps and the tiles honour that rather than forcing one owner. == */
const SC_ACTORS=[
  {id:'planner',name:'Priya Sharma',label:'Planner',department:'Planning / PMG',function:'Executor',initials:'PS',email:'priya.sharma@adt.com',
   focus:'Raises sub-contracting requests, creates shipments and reserves material, and confirms despatch to the vendor.',
   // Step 3 is NOT here: FR3's product / BOM processing is run by the system on SCR approval
   // (FR2.5), so it is nobody's queue. It stays in SC_STEPS as a stage of the journey.
   journeys:['sub-contracting'],scSteps:[1,6],approvals:0,owned:4,
   kpis:[['Draft SCRs','2'],['Awaiting Approval','3'],['Shipments Open','1'],['Returned to Me','1']]},
  {id:'pmg-approver',name:'Anil Deshmukh',label:'PMG Approver',department:'Planning / PMG',function:'Approver',initials:'AD',email:'anil.deshmukh@adt.com',
   focus:'Approves, returns or rejects sub-contracting requests, and confirms shipment at the vendor.',
   journeys:['sub-contracting'],scSteps:[2,12],approvals:3,owned:3,
   kpis:[['Approval Queue','3'],['Returned','1'],['Rejected','0'],['SLA Risk','0']]},
  {id:'buyer',name:'Rahul Mehta',label:'Buyer',department:'Procurement',function:'Executor',initials:'RM',email:'rahul.mehta@adt.com',
   focus:'Completes the commercial terms on the sub-contracting PO and returns the SCR when it needs correction.',
   journeys:['sub-contracting'],scSteps:[4],approvals:0,owned:2,
   kpis:[['Draft POs','2'],['Awaiting Approval','1'],['Returned to Me','0'],['Rate Contracts','4']]},
  {id:'po-approver',name:'Neha Verma',label:'PO Approver',department:'Procurement',function:'Approver',initials:'NV',email:'neha.verma@adt.com',
   focus:'Approves or returns commercial purchase orders against the rate contract.',
   journeys:['sub-contracting'],scSteps:[5],approvals:1,owned:1,
   kpis:[['Approval Queue','1'],['Returned','0'],['Value Pending','INR 3.0L'],['RC Breaches','0']]},
  {id:'stores',name:'Vikram Singh',label:'Stores User',department:'Stores / Warehouse',function:'Executor',initials:'VS',email:'vikram.singh@adt.com',
   focus:'Picks and issues reserved material against the outbound key, and receives the processed material back.',
   journeys:['sub-contracting'],scSteps:[7,16],approvals:0,owned:3,
   kpis:[['To Issue','2'],['To Receive','1'],['Short Receipts','1'],['Returned','0']]},
  {id:'logistics',name:'Suresh Patel',label:'Logistics User',department:'Logistics',function:'Executor',initials:'SP',email:'suresh.patel@adt.com',
   focus:'Completes packing, transporter, vehicle and dispatch details on the shipment.',
   journeys:['sub-contracting'],scSteps:[8],approvals:0,owned:1,
   kpis:[['To Arrange','1'],['In Transit','2'],['Vehicles Booked','3'],['Pending LR','1']]},
  {id:'dn-approver',name:'Amit Kapoor',label:'Delivery Note Approver',department:'Stores / Dispatch',function:'Approver',initials:'AK',email:'amit.kapoor@adt.com',
   focus:'Approves or returns the delivery note before the challan can be raised.',
   journeys:['sub-contracting'],scSteps:[9],approvals:1,owned:1,
   kpis:[['To Approve','1'],['Returned','1'],['Approved Today','2'],['SLA Risk','0']]},
  {id:'finance',name:'Meera Iyer',label:'Finance / F&A',department:'Finance / F&A / IDT',function:'Approver',initials:'MI',email:'meera.iyer@adt.com',
   focus:'Generates the challan, reconciles issued against received material, and closes the transaction.',
   journeys:['sub-contracting'],scSteps:[10,17,18],approvals:2,owned:3,
   kpis:[['Challans Due','1'],['To Reconcile','1'],['To Close','0'],['Overdue','0']]},
  {id:'security',name:'Rajesh Singh',label:'Security User',department:'Security / Gate',function:'Executor',initials:'RS',email:'rajesh.singh@adt.com',
   focus:'Verifies documents and vehicles at the gate and records outward and inward movement.',
   journeys:['sub-contracting'],scSteps:[11,15],approvals:0,owned:2,
   kpis:[['Outward Pending','2'],['Inward Pending','1'],['Dispatched','28'],['Returned','5']]},
  {id:'qc',name:'Deepak Shah',label:'QC User',department:'Quality',function:'Approver',initials:'DS',email:'deepak.shah@adt.com',
   focus:'Reviews the vendor advance shipping notice and clears or returns it before inward.',
   journeys:['sub-contracting'],scSteps:[14],approvals:1,owned:1,
   kpis:[['To Clear','1'],['Returned','0'],['Cleared Today','3'],['Failed Inspection','0']]},
  /* `vendorCode` ties the external persona to a row in the vendor master. Without it FR13.1's
     "the Vendor shall only be able to view and act on its own applicable approved POs" had
     nothing to compare against, and an SCR naming any of the three external vendors landed in
     this one queue. The seed's vendor is V-1001, so this persona is that vendor. */
  {id:'vendor',name:'ABC Fabricators Pvt Ltd',label:'Vendor',department:'External — Subcontractor',function:'External',initials:'AF',email:'ops@abcfabricators.in',vendorCode:'V-1001',
   focus:'Raises the advance shipping notice for processed material ready to return.',
   journeys:['sub-contracting'],scSteps:[13],approvals:0,owned:1,
   kpis:[['Open POs','2'],['ASNs Raised','1'],['Returned to Me','0'],['Due This Week','1']]}
];

/* == THE EIGHTEEN STEPS ====================================================================
   FR1–FR18, in order, with the actor(s) the FRD names for each. This array is the single
   source for: the dashboard tiles, the "pending with" resolution, the Continue-as control and
   the journey progress on a record. Nothing else hard-codes a step number.

   `doc` is which document the step acts on — it decides which listing a tile drills into.
   `phase` groups the eighteen for colour only; the tiles scroll horizontally in one row, so
   the phase is a tint rather than a container. == */
const SC_PHASES={
  request:{label:'Request',color:'#6d5bd0'},
  procurement:{label:'Procurement',color:'#0d9488'},
  outbound:{label:'Outbound',color:'#2563eb'},
  dispatch:{label:'Dispatch',color:'#ea580c'},
  vendor:{label:'At Vendor',color:'#9333ea'},
  inbound:{label:'Inbound & Close',color:'#16a34a'}
};
const SC_STEPS=[
  {no:1, name:'Create Sub-Contracting Request (SCR)',           short:'Create SCR',        actors:['planner'],              phase:'request',     doc:'scr'},
  {no:2, name:'SCR Approval / Return / Reject',                 short:'SCR Approval',      actors:['pmg-approver'],         phase:'request',     doc:'scr'},
  // FR2.5 / FR3 — run by the system the moment the SCR is approved. No actor, no queue, no click.
  {no:3, name:'Receivable Product / WIP & BOM Processing',      short:'Product & BOM',     actors:[],system:true,           phase:'request',     doc:'scr'},
  {no:4, name:'Create & Complete Sub-Contracting PO',           short:'Complete PO',       actors:['buyer'],                phase:'procurement', doc:'po'},
  {no:5, name:'Approve / Return Commercial PO',                 short:'PO Approval',       actors:['po-approver'],          phase:'procurement', doc:'po'},
  {no:6, name:'Create Shipment & Reserve Material',             short:'Create Shipment',   actors:['planner'],              phase:'outbound',    doc:'shipment'},
  /* LOGISTICS COMES AFTER GOODS ISSUE. These two were the other way round, which had the
     Logistics User packing, weighing and booking a vehicle for material Stores had not yet
     picked. FR7.7 "Post-Stores Routing" is explicit — "After Stores completes Goods Issue:
     Logistics Required = Yes → Logistics User completes Logistics section" — as is FR7.6's
     "route the Shipment to Stores Outbound / Goods Issue" and the Final Simplified Flow at
     line 940: "… Submit Shipment → Outbound Key + Transfer Order Generated → Stores Outbound /
     Goods Issue → Logistics on same Shipment page, if required → Delivery Note Processing".
     Swapped rather than re-routed 6→8→7→9 so the tile numbers still read in flow order. */
  {no:7, name:'Stores Outbound / Goods Issue',                  short:'Goods Issue',       actors:['stores'],               phase:'outbound',    doc:'shipment'},
  // FR7.5 — the Planner may capture logistics during shipment prep (step 6); COMPLETING it is
  // the Logistics User's job, and shipment/issue data is read-only to them.
  {no:8, name:'Shipment Processing & Logistics Arrangement',    short:'Logistics',         actors:['logistics'],            phase:'outbound',    doc:'shipment'},
  {no:9, name:'Delivery Note Generation & Approval',            short:'Delivery Note',     actors:['dn-approver'],          phase:'dispatch',    doc:'dn'},
  {no:10,name:'Challan Generation',                             short:'Challan',           actors:['finance'],              phase:'dispatch',    doc:'challan'},
  {no:11,name:'Security Gate Outward',                          short:'Gate Outward',      actors:['security'],             phase:'dispatch',    doc:'challan'},
  // FR12 is titled "Planner / PMG Shipment Confirmation" and names both; the PMG Approver holds
  // it, which keeps the confirmation that material has left the plant with the approving role
  // rather than with the Planner who raised the shipment.
  {no:12,name:'Shipment Confirmation',                          short:'Confirm Shipment',  actors:['pmg-approver','planner'],phase:'dispatch',   doc:'shipment'},
  {no:13,name:'Vendor ASN Creation',                            short:'Vendor ASN',        actors:['vendor'],               phase:'vendor',      doc:'asn'},
  {no:14,name:'QC Clearance of ASN',                            short:'QC Clearance',      actors:['qc'],                   phase:'inbound',     doc:'asn'},
  {no:15,name:'Security Gate Inward',                           short:'Gate Inward',       actors:['security'],             phase:'inbound',     doc:'asn'},
  {no:16,name:'Stores Material Receipt / IMR',                  short:'Material Receipt',  actors:['stores'],               phase:'inbound',     doc:'imr'},
  {no:17,name:'Material Reconciliation & Full Receipt',         short:'Reconciliation',    actors:['finance'],              phase:'inbound',     doc:'recon'},
  {no:18,name:'Final Closure of Sub-Contracting Transaction',   short:'Closure',           actors:['finance'],              phase:'inbound',     doc:'recon'}
];
function scStep(no){return SC_STEPS.find(function(s){return s.no===no;})||SC_STEPS[0];}
/* THE STEPS A PERSON SEES. Step 3 is run by the system on SCR approval (FR2.5) — it has no
   actor, no screen and no action, so presenting it as a stop on the journey invited the reader
   to look for the click that isn't there. The FRD's numbering is kept intact everywhere (the
   step number IS the FR number, and the dashboards, the copilot and the log all quote it); this
   only governs what is DRAWN. */
const SC_SHOWN_STEPS=SC_STEPS.filter(function(s){return !s.system;});
function scShownCount(){return SC_SHOWN_STEPS.length;}
function scActor(id){return SC_ACTORS.find(function(a){return a.id===id;})||null;}
function scActorLabel(id){const a=scActor(id);return a?a.label:(id||'—');}
// -- "Pending with" is rendered as role + person, matching the mobile listing ("Buyer – R. Nair")
// and reading as "Planner – You" when it is the logged-in actor's own queue. --
function scPendingWithHTML(actorId){
  const a=scActor(actorId);
  if(!a)return '<span class="sc-dim">—</span>';
  const mine=(typeof activePersonaId!=='undefined'&&activePersonaId===actorId&&portalRole==='entity-user');
  const who=mine?'You':a.name.split(' ').map(function(w,i){return i===0?w[0]+'.':w;}).join(' ');
  return a.label+' – '+(mine?'<b>You</b>':who);
}
function scActorOwnsStep(actorId,no){
  const a=scActor(actorId);
  return !!a&&(a.scSteps||[]).indexOf(no)>-1;
}

/* == MASTER DATA ===========================================================================
   Section A of the FRD's Master Data tab, only as far as the screens actually select from it.
   These are lookups, not transactions: nothing here is created by the journey, and the FRD is
   explicit that transaction numbers, quantities and dates must NOT be modelled as masters
   (section E), so none of them are here. == */
const scMaster={
  locations:[
    {code:'PUNE-01',name:'Pune Plant',gstin:'27ABCDE1234F1Z5',address:'Plot 4, MIDC Chakan, Pune 410501'},
    {code:'HYD-01', name:'Hyderabad Unit',gstin:'36ABCDE1234F1Z9',address:'Survey 12, Medchal, Hyderabad 501401'},
    {code:'HAZ-04', name:'Hazira – Unit 4',gstin:'24ABCDE1234F1Z2',address:'Hazira Industrial Area, Surat 394510'}
  ],
  purchaseOffices:[
    {code:'PO-PUNE',name:'PO – Pune'},{code:'PO-HYD',name:'Hyderabad Purchase Office'},{code:'PO-HAZ',name:'Hazira Purchase Office'}
  ],
  vendors:[
    {code:'V-1001',name:'ABC Fabricators Pvt Ltd',type:'External',gstin:'27AACCA1234M1ZP',skills:['Machining','Fabrication'],
     addresses:[{code:'ADR-01',text:'Plot No. 12, MIDC, Pune - 411019'},{code:'ADR-02',text:'Unit 3, Bhosari, Pune - 411026'}]},
    {code:'V-1002',name:'Larsen Fabrication Works',type:'External',gstin:'24AABCL5678N1Z4',skills:['Plate edge machining','Fabrication'],
     addresses:[{code:'ADR-11',text:'Plot 88, GIDC Estate, Surat 394510'}]},
    {code:'V-1003',name:'Precision Works Ltd',type:'External',gstin:'27AAFCP9012Q1Z7',skills:['Machining','Grinding'],
     addresses:[{code:'ADR-21',text:'Gat 210, Chakan MIDC, Pune 410501'}]},
    {code:'BP-2001',name:'Unit 2 – Powai (Internal)',type:'Internal',gstin:'27AAACL1234A1ZK',skills:['Fabrication'],
     addresses:[{code:'ADR-31',text:'Powai Works, Mumbai 400072'}]}
  ],
  // Internal business partners, offered only when Inter-Unit = Yes (FR1.4).
  internalBPs:[
    {code:'IBP-01',name:'Unit 2 – Powai Works'},{code:'IBP-02',name:'Unit 5 – Hazira Fabrication'}
  ],
  skills:['Machining','Fabrication','Plate edge machining','Grinding','Heat treatment'],
  projects:[
    {code:'PRJ-001',name:'Hull Block Fabrication',elements:[
      {code:'PRJ-001-E1',name:'Hull Block A – Shell'},{code:'PRJ-001-E2',name:'Hull Block A – Deck'}],
     activities:['Fabrication Activity — COST-2041','Machining Activity — COST-2042']},
    {code:'PRJ-1001',name:'Metro Rail Project',elements:[
      {code:'PRJ-1001-E1',name:'Civil Works / Conveyor Support'}],
     activities:['Fabrication Activity — COST-3010']}
  ],
  productionOrders:[
    {no:'PO-4500123456',product:'SHAFT-001',description:'Drive Shaft',qty:1000,uom:'Nos',start:'18 Aug 2026',end:'30 Aug 2026',status:'Released',
     routing:[{op:'0010',desc:'Cutting'},{op:'0030',desc:'Edge preparation'},{op:'0050',desc:'Bevelling'},{op:'0070',desc:'Finish machining'}]},
    {no:'PO-4471288',product:'SHELL-C3',description:'Tank shell course 3',qty:12,uom:'Nos',start:'18 Aug 2026',end:'30 Aug 2026',status:'Released',
     routing:[{op:'0010',desc:'Rolling'},{op:'0030',desc:'Edge preparation'},{op:'0050',desc:'Bevelling'}]}
  ],
  // Item master. `kind` drives Item Type; receivables and issue items come from the same master,
  // which is why FR1.7's "a Receivable Item shall not be the same Product as its Issue Item" has
  // to be enforced in validation rather than by keeping two lists.
  items:[
    // `inspection` is Master Data section B's Inspection Requirement Configuration: it decides
    // whether FR13.3 demands inspection documents before the ASN, and FR14.4 before QC clearance.
    {code:'WIP-SHELL-C3-BEVEL',name:'Shell Course 3 – Bevelled',kind:'WIP',uom:'Nos',hsn:'7308',receivable:true,inspection:true},
    {code:'SHAFT-001-MC',name:'Drive Shaft – Machined',kind:'Semi Finished',uom:'Nos',hsn:'8483',receivable:true,inspection:true},
    {code:'CONV-ASSY-001',name:'Conveyor Support Assembly',kind:'Semi Finished',uom:'EA',hsn:'7308',receivable:true,inspection:false},
    {code:'PLT-SQ-2500-16MM',name:'MS Plate 2500x16mm',kind:'Plate',uom:'MT',hsn:'72085100',tax:'GST18-JW'},
    {code:'PLATE-001',name:'MS Plate 10mm',kind:'Raw Material',uom:'Kg',hsn:'720852',tax:'GST18'},
    {code:'PIPE-002',name:'MS Pipe 50mm',kind:'Raw Material',uom:'Nos',hsn:'730640',tax:'GST18'},
    {code:'CONS-BEVEL-TIP-08',name:'Bevelling Tip 08',kind:'BOM',uom:'Nos',hsn:'8207',tax:'GST18'},
    {code:'M12-FASTENER',name:'M12 Fasteners',kind:'Raw Material',uom:'EA',hsn:'7318',tax:'GST12'}
  ],
  warehouses:[
    {code:'RM-WH',name:'Raw Material Warehouse',locations:[
      {code:'SL-A14',name:'SL-A14 – Bay A'},{code:'SL-C03',name:'SL-C03 – Bay C'},{code:'A1-01',name:'A1-01 – Main Rack'}]},
    {code:'MAIN-WH',name:'Main Warehouse',locations:[
      {code:'A1-01',name:'A1-01 – Main Rack'},{code:'B2-03',name:'B2-03 – Bay B'}]},
    {code:'FG-WH',name:'Finished Goods Warehouse',locations:[{code:'FG-01',name:'FG-01 – Despatch Bay'}]},
    {code:'WH-04',name:'WH-04 Fabrication',locations:[{code:'FB-01',name:'FB-01 – Fab Bay'}]}
  ],
  zones:['Zone A','Zone B','Zone C'],
  /* FR6.3 — availability is checked against warehouse + storage location + product before a
     shipment may be submitted, and reserved stock belonging to another transaction is NOT
     available. Held as free/reserved per bin so the check has something real to fail against;
     without it "Available Quantity" is a label with no number behind it. */
  stock:[
    // Sized for the thirty-record seed: roughly nine of those hold stock at once (Reserved or
    // Staging), so the bin has to carry them all and still leave a demo something to draw on.
    {item:'PLATE-001',warehouse:'RM-WH',location:'A1-01',free:60000,reserved:0},
    {item:'PLATE-001',warehouse:'MAIN-WH',location:'A1-01',free:300,reserved:0},
    {item:'PIPE-002',warehouse:'MAIN-WH',location:'B2-03',free:30000,reserved:0},
    {item:'PIPE-002',warehouse:'RM-WH',location:'SL-C03',free:150,reserved:0},
    {item:'PLT-SQ-2500-16MM',warehouse:'RM-WH',location:'SL-A14',free:42,reserved:0},
    {item:'CONS-BEVEL-TIP-08',warehouse:'RM-WH',location:'SL-C03',free:500,reserved:0},
    {item:'M12-FASTENER',warehouse:'RM-WH',location:'A1-01',free:5000,reserved:200}
  ],
  rateContracts:[
    {no:'RC-2026-001',vendor:'V-1001',price:250,basis:'Per Piece',currency:'INR',validTill:'31 Dec 2026',status:'Active'},
    {no:'RC-2026-014',vendor:'V-1002',price:36000,basis:'Per Piece',currency:'INR',validTill:'31 Mar 2027',status:'Active'},
    {no:'RC-2025-088',vendor:'V-1003',price:180,basis:'Per KG',currency:'INR',validTill:'31 Dec 2025',status:'Expired'}
  ],
  taxCodes:['GST18','GST12','GST5','GST18-JW'],
  buyers:['buyer'],
  challanTypes:['Material Issue Challan','Job Work Challan','Returnable Gate Pass'],
  priceBasis:['Per Piece','Per KG','Per MT','Per Metre','Per Sq. Metre','Per Hour','Lumpsum'],
  currencies:['INR','USD','EUR'],
  paymentTerms:['30 Days Credit','45 Days Credit','60 Days Credit','Advance','Against Delivery']
};
function scItem(code){return scMaster.items.find(function(i){return i.code===code;})||null;}
function scVendor(code){return scMaster.vendors.find(function(v){return v.code===code;})||null;}
function scWarehouse(code){return scMaster.warehouses.find(function(w){return w.code===code;})||null;}
function scProdOrder(no){return scMaster.productionOrders.find(function(p){return p.no===no;})||null;}
function scProject(code){return scMaster.projects.find(function(p){return p.code===code;})||null;}
function scRateContract(no){return scMaster.rateContracts.find(function(r){return r.no===no;})||null;}

/* == ONE VENDOR PERSONA PER VENDOR =========================================================
   FR13.1 — "The Vendor shall only be able to view and act on its own applicable approved POs."
   That rule is only satisfiable if there is a login per vendor. There was one Vendor persona
   against three external vendors in the master, so an SCR naming Larsen or Precision Works
   routed to ABC Fabricators, who was then correctly refused by the FR13.1 check — and the
   transaction was stranded at step 13 with nobody able to raise the ASN and no return path.

   Generated from the vendor master rather than hand-written, so adding a vendor to the master
   cannot leave the journey without someone to act on it. == */
scMaster.vendors.filter(function(v){return v.type==='External';}).forEach(function(v){
  if(SC_ACTORS.some(function(a){return a.vendorCode===v.code;}))return;
  const initials=v.name.replace(/[^A-Za-z ]/g,'').split(/\s+/).filter(Boolean)
    .slice(0,2).map(function(w){return w.charAt(0);}).join('').toUpperCase();
  SC_ACTORS.push({id:'vendor-'+v.code.toLowerCase(),name:v.name,label:'Vendor',
    department:'External — Subcontractor',function:'External',initials:initials||'VN',
    email:'ops@'+v.code.toLowerCase()+'.example',vendorCode:v.code,
    focus:'Raises the advance shipping notice for processed material ready to return.',
    journeys:['sub-contracting'],scSteps:[13],approvals:0,owned:0,
    kpis:[['Open POs','0'],['ASNs Raised','0'],['Returned to Me','0'],['Due This Week','0']]});
});
/* Master Data section B item 5 — "Inspection Requirement Configuration … Determines when ASN
   Inspection Documents are mandatory". Held on the item master as `inspection`, so FR13.3's
   "where inspection is required" and FR14.4's pre-clearance check read the same flag. */
function scInspectionRequired(txn){
  const it=scItem(txn&&txn.scr&&txn.scr.recvItem);
  return !!(it&&it.inspection);
}
// Which Vendor login owns a transaction: the one whose vendorCode matches the SCR's vendor.
function scVendorPersona(code){
  const a=SC_ACTORS.find(function(x){return x.vendorCode&&x.vendorCode===code;});
  return a?a.id:'vendor';
}

/* == REASON CODES ==========================================================================
   The FRD's Reason Codes tab, verbatim. One master, filtered by Reason Set — which is what
   the FRD asks for ("The application should filter the Reason dropdown using Reason Set Code +
   current process stage") and why these are keyed by set rather than scattered across screens.

   `remarks` carries the per-set rule, because it genuinely differs: most sets need remarks only
   for Other, RC-BUYRET needs them for every value, and Reject needs them always. Encoding it per
   value rather than per screen is what stops the three rules drifting apart.
     'other'  → mandatory only when this value is the Other fallback
     'always' → mandatory whatever is chosen
   RC-REMOVAL is deliberately empty: the FRD says the approved legal values are client-supplied
   and explicitly recommends not inventing them. The dropdown renders its empty state. == */
const scReasons={
  'RC-NONBILL':{label:'Reason for Non-Billable',values:[
    {code:'NBL-01',text:'No Charge / Free of Cost'},{code:'NBL-02',text:'Warranty / Rework'},
    {code:'NBL-03',text:'Included in Existing Contract / Scope'},{code:'NBL-04',text:'Internal Cost Absorption'},
    {code:'NBL-99',text:'Other',other:true}],remarks:'other'},
  'RC-REMOVAL':{label:'Reason for Removal',values:[],remarks:'other',
    empty:'Reason for Removal values are maintained by the client and have not been supplied yet.'},
  'RC-SCRRET':{label:'Return SCR',values:[
    {code:'SCRR-01',text:'Incorrect Project / Production Order'},{code:'SCRR-02',text:'Incorrect Vendor / Internal Business Partner'},
    {code:'SCRR-03',text:'Incorrect Receivable Item'},{code:'SCRR-04',text:'Incorrect Issue Item'},
    {code:'SCRR-05',text:'Quantity / UOM Correction Required'},{code:'SCRR-06',text:'BOM / Operation Details Incorrect'},
    {code:'SCRR-07',text:'Warehouse / Storage Location Incorrect'},{code:'SCRR-08',text:'Mandatory Information / Attachment Missing'},
    {code:'SCRR-99',text:'Other',other:true}],remarks:'other'},
  'RC-SCRREJ':{label:'Reject SCR',values:[
    {code:'SCRJ-01',text:'Duplicate SCR'},{code:'SCRJ-02',text:'Requirement Withdrawn / No Longer Required'},
    {code:'SCRJ-03',text:'Invalid Sub-Contracting Requirement'},{code:'SCRJ-04',text:'Request Not Authorized'},
    /* 'other', not 'always'. The Reason Codes tab says so in three places — the Final Reason Set
       Mapping row ("RC-SCRREJ … Mandatory for Other"), the value table (SCRJ-01…05 = No, only
       SCRJ-99 = Yes) and FR2.8 itself. RC-BUYRET is the only set that requires remarks for every
       value. The mobile Reject sheet in the wireframes shows "Remarks *" unconditionally, which
       is the stricter of the two; the FRD is the source of truth here. */
    {code:'SCRJ-05',text:'Vendor / Scope Not Acceptable'},{code:'SCRJ-99',text:'Other',other:true}],remarks:'other'},
  'RC-BUYRET':{label:'Buyer Return SCR',values:[
    {code:'BUYR-01',text:'Incorrect Vendor / Business Partner'},{code:'BUYR-02',text:'Incorrect Receivable Item'},
    {code:'BUYR-03',text:'Incorrect Issue Item'},{code:'BUYR-04',text:'Incorrect Quantity / BOM Relationship'},
    {code:'BUYR-05',text:'Incorrect Project / Production Order / Operation'},{code:'BUYR-06',text:'Incorrect Warehouse / Storage Location'},
    {code:'BUYR-07',text:'Missing / Incorrect SCR Information'},{code:'BUYR-99',text:'Other',other:true}],remarks:'always'},
  'RC-PORET':{label:'Return PO',values:[
    {code:'POR-01',text:'Incorrect Tax Code'},{code:'POR-02',text:'Incorrect Purchase Office'},{code:'POR-03',text:'Incorrect PO Series'},
    {code:'POR-04',text:'Rate Contract Issue'},{code:'POR-05',text:'Incorrect Price / Price Basis'},{code:'POR-06',text:'Incorrect Currency'},
    {code:'POR-07',text:'Incorrect Payment Terms'},{code:'POR-08',text:'Incomplete / Incorrect Commercial Information'},
    {code:'POR-99',text:'Other',other:true}],remarks:'other'},
  'RC-STORERET':{label:'Stores Return Shipment',values:[
    {code:'STR-01',text:'Material Not Available'},{code:'STR-02',text:'Incorrect Product'},{code:'STR-03',text:'Quantity Mismatch'},
    {code:'STR-04',text:'Incorrect Lot / Serial'},{code:'STR-05',text:'Material Damaged'},{code:'STR-06',text:'Storage Location Mismatch'},
    {code:'STR-07',text:'Shipment / Material Details Incorrect'},{code:'STR-99',text:'Other',other:true}],remarks:'other'},
  'RC-DNRET':{label:'Return Delivery Note',values:[
    {code:'DNR-01',text:'Quantity Mismatch to Shipment'},{code:'DNR-02',text:'Wrong Consignee Address'},{code:'DNR-03',text:'Missing Logistics Detail'},
    {code:'DNR-04',text:'Packing Incorrect'},{code:'DNR-05',text:'Document Illegible'},{code:'DNR-06',text:'Material / Goods Issue Details Incorrect'},
    {code:'DNR-99',text:'Other',other:true}],remarks:'other'},
  'RC-CHRET':{label:'Return before Challan Generation',values:[
    {code:'CHR-01',text:'Tax Identifier Missing'},{code:'CHR-02',text:'Value Basis Incorrect'},{code:'CHR-03',text:'Document Mismatch'},
    {code:'CHR-04',text:'Mandatory Challan Information Missing'},{code:'CHR-99',text:'Other',other:true}],remarks:'other'},
  'RC-GATEVEH':{label:'Vehicle Change',values:[
    {code:'GVEH-01',text:'Vehicle Breakdown'},{code:'GVEH-02',text:'Vehicle Substituted by Transporter'},
    {code:'GVEH-03',text:'Capacity Change'}],remarks:'always'},
  'RC-GATEPKG':{label:'Package Count Difference',values:[
    {code:'GPKG-01',text:'Repacked'},{code:'GPKG-02',text:'Miscount at Dispatch'},{code:'GPKG-03',text:'Short Loaded'}],remarks:'always'},
  'RC-SECRET':{label:'Security Gate Outward Return',values:[
    {code:'SEC-01',text:'Material / Document Mismatch'},{code:'SEC-02',text:'Challan Details Incorrect'},{code:'SEC-03',text:'Quantity Mismatch'},
    {code:'SEC-04',text:'Dispatch Not Authorized'},{code:'SEC-05',text:'Vehicle / Package Details Incorrect'},
    {code:'SEC-06',text:'Mandatory Information Missing'},{code:'SEC-99',text:'Other',other:true}],remarks:'other'},
  'RC-QCRET':{label:'Return ASN',values:[
    {code:'QCR-01',text:'Documents Missing'},{code:'QCR-02',text:'Inspection Failed'},{code:'QCR-03',text:'Quantity Mismatch'},
    {code:'QCR-99',text:'Other',other:true}],remarks:'other'},
  'RC-BALRET':{label:'Returned / Unused Issue Material',values:[
    {code:'BAL-01',text:'Excess Material Issued'},{code:'BAL-02',text:'Job Completed with Less Material'},
    {code:'BAL-03',text:'Vendor Unable to Process Balance Material'},{code:'BAL-99',text:'Other',other:true}],remarks:'other'},
  'RC-SCRAP':{label:'Scrap / Process Loss',values:[
    {code:'SCRAP-01',text:'Process Scrap Within Norm'},{code:'SCRAP-02',text:'Process Scrap Above Norm'},
    {code:'SCRAP-03',text:'Damaged at Vendor'},{code:'SCRAP-04',text:'Rejected on Inspection'},
    {code:'SCRAP-99',text:'Other',other:true}],remarks:'other'},
  // -- Short receipt. The mobile IMR sheet demands a reason for a shortfall and the Master Data
  // tab defines a Short-Closed line status, but the FRD names no reason set for it. This is the
  // one set here that is not lifted from the document; it is marked so it can be replaced when
  // the client supplies the real values. --
  'RC-SHORT':{label:'Short Receipt / Short Close',proposed:true,values:[
    {code:'SHRT-01',text:'Vendor Supplied Short'},{code:'SHRT-02',text:'Process Loss at Vendor'},
    {code:'SHRT-03',text:'Balance No Longer Required'},{code:'SHRT-04',text:'Rejected on Receipt'},
    {code:'SHRT-99',text:'Other',other:true}],remarks:'always'}
};
function scReasonSet(id){return scReasons[id]||{label:'Reason',values:[],remarks:'other'};}
function scReasonText(setId,code){
  const v=scReasonSet(setId).values.find(function(x){return x.code===code;});
  return v?v.text:(code||'');
}
// -- Does this set + chosen value require remarks? Read by every action sheet, so the three
// different rules in the FRD stay in one place. --
function scRemarksRequired(setId,code){
  const set=scReasonSet(setId);
  if(set.remarks==='always')return true;
  const v=set.values.find(function(x){return x.code===code;});
  return !!(v&&v.other);
}

/* == PERSISTED STATE =======================================================================
   Records live here and nowhere else. Every mutation goes through scSave() so a refresh, a
   persona switch and a Continue-as all resume against the same transaction — which is the
   whole point of the journey being persistent rather than a click-through.

   `seq` holds the running number per document type. The FRD's Number Series configuration is
   a master; the numbers themselves are transaction data (section E), so only the counter is
   stored and the formatted number is derived. == */
/* ONE TRANSACTION, NOT SEVEN RECORDS. A sub-contracting job is a single thing that grows
   documents as it moves: the SCR becomes a PO, which becomes a shipment, which produces a
   delivery note, a challan, an ASN, an IMR and a reconciliation. Modelling those as seven
   arrays would mean seven id lookups on every screen and seven places for a handoff to go
   wrong. One `txn` carries them all as sub-objects, plus the three fields that drive the whole
   journey — `step`, `pendingWith`, `pendingSince`. Every screen reads the same record. */
let scState={
  txns:[],
  seq:{scr:137,po:97,shipment:0,dn:0,challan:0,asn:0,imr:0},
  seeded:false
};
let scViewMode='web';               // 'web' | 'mobile' — checker screens only
let scOpenTxnId=null;               // the transaction open in a detail screen
let scDashStepFilter=0;             // which step tile is drilled into, 0 = all
let scDashClosed=false;             // board shows closed / rejected transactions instead of open
let scSheet=null;                   // the open action sheet: {action, txnId}
let scForm={};                      // live create/edit form buffer
let scFormErrors={};
let scLoadFailed=false;             // the store held bytes this version could not read
let scSaveFailed=false;             // the last write did not reach localStorage

/* Every transaction that comes back off disk is put through this before anything reads it.
   A stored record was written by whatever version of this file was loaded at the time, and the
   screens assume seven document sub-objects, two arrays and a step in range — assumptions that
   hold for a record this session created and not for one written a week ago. Normalising once,
   at the boundary, keeps the ~40 readers downstream free of `(t.scr||{})` defensiveness. */
const SC_DOC_KEYS=['scr','po','shipment','dn','challan','asn','imr','recon'];
function scNormalise(t){
  if(!t||typeof t!=='object')t={};
  SC_DOC_KEYS.forEach(function(k){if(!t[k]||typeof t[k]!=='object')t[k]={};});
  if(!t.docStatus||typeof t.docStatus!=='object')t.docStatus={};
  if(!Array.isArray(t.activity))t.activity=[];
  if(!Array.isArray(t.participants))t.participants=[];
  if(!Array.isArray(t.reservations))t.reservations=[];
  if(!Array.isArray(t.receipts))t.receipts=[];
  if(!Array.isArray(t.scr.issueItems))t.scr.issueItems=[];
  if(!Array.isArray(t.recon.lines))t.recon.lines=[];
  t.step=Number(t.step);
  if(!(t.step>=1&&t.step<=18))t.step=1;
  /* Migrations for records written by an earlier build. Step 3 is now system-run and has no
     actor, so a transaction persisted there would load with pendingWith undefined and disappear
     from every dashboard; steps 7 and 8 swapped meaning, so a record parked on either would land
     in front of the wrong role. Both are silent data-loss bugs without this. */
  if(t.step===3)t.step=4;
  if(t.__v!==2){
    if(t.step===7||t.step===8)t.step=t.step===7?8:7;
    if(t.docStatus.challan==='Draft'||t.docStatus.challan==='Generated')t.docStatus.challan='Created';
    t.__v=2;
  }
  t.closed=!!t.closed;
  if(SC_POSITIONS.indexOf(t.position)===-1)t.position='Main';
  if(!t.id)t.id='TXN-'+Math.random().toString(36).slice(2,8);
  // A closed transaction is pending with nobody; an open one must be pending with a real actor,
  // or it disappears from every dashboard and becomes unreachable.
  if(t.closed)t.pendingWith='';
  else if(!scActor(t.pendingWith))t.pendingWith=scStep(t.step).actors[0];
  return t;
}
function scSave(){
  /* A swallowed write is how a "persistent" journey silently stops persisting: the user keeps
     working, every screen looks right, and the next reload has lost the lot. The write can
     genuinely fail — a private window, or quota — so it still must not throw, but the failure
     is recorded and the board says so rather than pretending. */
  try{
    localStorage.setItem(SC_STORE_KEY,JSON.stringify(scState));
    scSaveFailed=false;return true;
  }catch(e){scSaveFailed=true;return false;}
}
function scLoad(){
  try{
    const raw=localStorage.getItem(SC_STORE_KEY);
    if(!raw)return false;
    const parsed=JSON.parse(raw);
    // Guards `txns`, which is the field this store actually holds. It read `parsed.scrs` — a
    // name from before the seven documents were folded into one transaction — so the guard
    // always failed and every reload silently started from the seed. Nothing errored; the
    // journey just forgot. Persistence is the requirement here, so this line is the feature.
    if(!parsed||!Array.isArray(parsed.txns)){
      /* A payload exists but is not the shape this version reads. Do NOT fall through to the
         seed: scSeed writes 12 records and saves, destroying whatever was there. Flagging it
         instead leaves the stored bytes untouched and lets the board say so. */
      scLoadFailed=true;
      return false;
    }
    scState.txns=parsed.txns.map(scNormalise);
    scState.seq=Object.assign({},scState.seq,parsed.seq||{});
    scState.seeded=parsed.seeded!==undefined?parsed.seeded:scState.seeded;
    return true;
  }catch(e){scLoadFailed=true;return false;}
}
function scReset(){
  // `txns`, not `scrs`. It wrote the pre-rename field name, so scSeed threw immediately on
  // scState.txns.length and left the store with no array at all — every later render crashed.
  scState={txns:[],seq:{scr:137,po:97,shipment:0,dn:0,challan:0,asn:0,imr:0,outbound:0},seeded:false};
  scLoadFailed=false;
  scSeed();
  scSave();
  if(typeof renderADTPage==='function')renderADTPage();
}
/* SUB-2026-00138. The FRD specifies the SUB number series for the SCR (FR1.2) and that is the
   format on the Review SCR screen; the shorter SCR-2026-001 on some listings and the slashed
   SCR/2026/00417 on mobile are the same number written three ways. One formatter, so every
   surface agrees. */
function scNextNo(kind){
  scState.seq[kind]=(scState.seq[kind]||0)+1;
  return scFormatNo(kind,scState.seq[kind]);
}
function scFormatNo(kind,n){
  const year=2026;
  const pad=function(v,w){v=String(v);while(v.length<w)v='0'+v;return v;};
  const prefix={scr:'SUB',po:'PO',shipment:'SHP',dn:'DN',challan:'CH',asn:'ASN',imr:'IMR'}[kind]||'DOC';
  return prefix+'-'+year+'-'+pad(n,kind==='scr'?5:4);
}
function scNow(){
  const d=new Date();
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad=function(v){return v<10?'0'+v:''+v;};
  return pad(d.getDate())+' '+months[d.getMonth()]+' '+d.getFullYear()+', '+pad(d.getHours())+':'+pad(d.getMinutes());
}
// -- Ageing, for the "Pending since" column. Stored as an ISO stamp alongside the display
// string so the column can compute rather than parse the pretty version back. --
function scSince(iso){
  if(!iso)return '—';
  const ms=Date.now()-new Date(iso).getTime();
  if(ms<0)return 'just now';
  const mins=Math.floor(ms/60000);
  if(mins<1)return 'just now';
  if(mins<60)return mins+' min';
  const hrs=Math.floor(mins/60);
  if(hrs<24)return hrs+' hr';
  const days=Math.floor(hrs/24);
  return days+(days===1?' day':' days');
}
/* Every state change writes one of these. FR20 requires an immutable log carrying the action,
   both statuses, who acted, their role, the reason code and the remarks — so the row is written
   once, in one place, and nothing else appends to `activity`. */
function scLog(rec,action,fromStatus,toStatus,opts){
  opts=opts||{};
  rec.activity=rec.activity||[];
  rec.activity.push({
    at:scNow(),iso:new Date().toISOString(),
    action:action,from:fromStatus||'',to:toStatus||'',
    byId:opts.byId||(typeof activePersonaId!=='undefined'?activePersonaId:'planner'),
    // FR20 wants Performed By and Role / Position as SEPARATE fields. Both were the role label,
    // so the log could never say WHICH user acted — the one thing an audit log is for.
    by:opts.by||(scActor(opts.byId||activePersonaId)||{}).name||'System',
    role:opts.role||scActorLabel(opts.byId||(typeof activePersonaId!=='undefined'?activePersonaId:'planner')),
    source:opts.source||(scViewMode==='mobile'?'Mobile Application':'Web Portal'),
    // The reason CODE is retained alongside its description. The Reason Codes tab is explicit:
    // "the same Reason Code must be stored in Mobile/Web transactions and Activity Logs", and
    // FR20 requires the code itself in the immutable log. Storing only the text lost it.
    reasonSet:opts.reasonSet||'',reasonCode:opts.reasonCode||'',reason:opts.reason||'',
    oldValue:opts.oldValue||'',newValue:opts.newValue||'',
    remarks:opts.remarks||''
  });
}

/* == THE ENGINE ============================================================================
   Four functions move the whole journey. Everything else is rendering.

   scAdvance is the handoff: it sets the step, resolves who the step is pending with from
   SC_STEPS, stamps the clock for the ageing column, records the actor as a participant so the
   transaction stays visible on their dashboard after they hand it on, and logs. Because
   pendingWith is DERIVED from the step rather than set per call site, a step's owner changes
   in one place. == */
function scTxn(id){return scState.txns.find(function(t){return t.id===id;})||null;}
function scOpenTxn(){return scTxn(scOpenTxnId);}

/* == MATERIAL POSITION =====================================================================
   The chain the whole FRD is written around, and the thing that makes this a material process
   rather than a document process:

     Main → Reserved      FR6.4  shipment submitted. Logical only; nothing physically moves.
     Reserved → Staging   FR8.5  goods issue. Picked and ready, still inside the plant.
     Staging → At Vendor  FR12.3 PMG confirmation — NOT gate outward. The FRD is explicit that
                                 security clearance happens first and the system move follows.
     At Vendor → consumed FR17.4 consumed = confirmed received × BOM ratio
     At Vendor → Returned FR17.5 unused issue material physically returned

   Held on the transaction rather than derived from the step, because a return sends the step
   backwards and the material does not follow it — reserved stock stays reserved through a
   delivery-note return, and only an explicit movement releases it. == */
const SC_POSITIONS=['Main','Reserved','Staging','At Vendor','Returned to Store'];

/* == PER-DOCUMENT STATUS ===================================================================
   Master Data section D lists nine independent status sets, and they genuinely diverge: at
   closure the Delivery Note stays Approved, the ASN stays QC Cleared and the IMR stays
   Confirmed while the SCR, PO, Shipment and Challan all become Closed. One `txn.status` field
   cannot express that, so it is now the status of the document IN PLAY — what the header shows
   — and `docStatus` keeps each document's own.

   Written from one place (scStampDoc) rather than at each call site, so a document's status and
   the step that changed it can never drift apart. == */
/* Transcribed from Master Data section D, verbatim. Where a status is NOT in the FRD's list it is
   not in this one: the PO had Returned and Rejected added (section D line 3373 gives only Draft,
   Created, Approved, Closed) and the challan had Draft and Generated invented for it in place of
   Created (line 3376). The guard in scConfirmSheet only stamps Returned when the document's own
   set contains it, so trimming these lists is what makes that guard mean anything. */
const SC_DOC_STATUSES={
  scr:['Created','Sent for Approval','Returned','Modified','Approved','Rejected','Closed'],
  po:['Draft','Created','Approved','Closed'],
  shipment:['Created','Freezed Outbound Release','Challan Generated','Closed'],
  dn:['Generated','Approved','Returned'],
  challan:['Created','Gate Cleared','Closed'],
  // FR14.5 defines Return ASN, so Returned is a real transition the FRD's own status list omits.
  asn:['Created','QC Cleared','Returned'],
  imr:['Created','Confirmed'],
  recon:['In Progress','Full Receipt Confirmed']
};
// Section D's Receivable Item statuses — the line-level status, distinct from the documents above.
const SC_LINE_STATUSES=['Open','Partially Received','Fully Received','Short-Closed','Returned'];
const SC_DOC_LABELS={scr:'SCR',po:'Purchase Order',shipment:'Shipment',dn:'Delivery Note',challan:'Challan',asn:'ASN',imr:'IMR',recon:'Reconciliation'};
function scDocStatus(txn,doc){return (txn.docStatus||{})[doc]||'';}
function scStampDoc(txn,doc,status){
  if(!doc||!status)return;
  txn.docStatus=txn.docStatus||{};
  txn.docStatus[doc]=status;
}
/* FR18.3 — closure cascades across four documents and deliberately leaves three alone. Written
   out rather than looped so the three that do NOT change are visible in the code, which is the
   part a reader is most likely to get wrong. */
function scCloseAll(txn){
  scStampDoc(txn,'challan','Closed');     // Gate Cleared → Closed
  scStampDoc(txn,'shipment','Closed');    // Challan Generated → Closed
  scStampDoc(txn,'po','Closed');          // Approved → Closed
  scStampDoc(txn,'scr','Closed');         // Approved → Closed
  // Unchanged by design: Delivery Note stays Approved, ASN stays QC Cleared, IMR stays Confirmed.
}
// FR18.4 — the overdue flag. Visibility only; it never blocks closure, which still requires
// complete receipt and reconciliation.
function scOverdue(txn){
  const d=txn.shipment&&txn.shipment.expectedReturn;
  if(!d||txn.closed)return false;
  const due=new Date(d);
  return !isNaN(due)&&due.getTime()<Date.now()&&txn.step>=12;
}
/* FR1.5 — the receivable line status, which the Master Data tab defines and nothing was
   setting beyond Short-Closed. Derived from what has actually been received. */
function scLineStatus(txn){
  if(txn.scr.lineStatus==='Short-Closed')return 'Short-Closed';
  const exp=Number(txn.scr.recvQty||0),got=Number(txn.imr.receivedQty||0);
  /* Section D's fifth value. "Returned" was the one Receivable Item status nothing could ever
     produce, even though FR17.5 records returned issue material and the reason master carries a
     "Returned Issue Material Reason" category for it. A line whose material came back unprocessed
     with nothing received is Returned, not Open. */
  const returned=(txn.scr.issueItems||[]).reduce(function(a,r){return a+Number(r.returnedQty||0);},0);
  if(!got&&returned>0)return 'Returned';
  if(!got)return 'Open';
  if(got>=exp)return 'Fully Received';
  return 'Partially Received';
}
function scMoveInventory(txn,to,note){
  const from=txn.position||'Main';
  if(from===to)return;
  txn.position=to;
  txn.positionAt=scNow();
  scLog(txn,'Material moved '+from+' → '+to,txn.status,txn.status,{remarks:note||''});
}
/* -- CONDITIONAL ROUTING. Two branches in the FRD skip a whole step, and both are decided by a
   flag captured back on the SCR:
     Billable = No  → FR4.4: the zero-value PO is system-approved, so step 5 never runs.
     Logistics = No → FR7.5: logistics is skipped and goods issue goes straight to the note.
   Resolved here so every caller — primary action, checker approve, seed — routes identically. -- */
// The shipment's Logistics Required (FR6.2) overrides the SCR's (FR1.2) once the Planner has set
// it; every routing decision reads this rather than txn.scr.logistics directly.
function scLogisticsRequired(txn){
  const v=txn.shipment&&txn.shipment.logistics;
  return v===undefined||v===''?(txn.scr.logistics||'Yes'):v;
}
function scNextStep(txn,from){
  let n=scSpec(from).next;
  /* FR3 IS THE SYSTEM'S WORK, NOT A PERSON'S. This routed to the Planner and asked them to press
     "Confirm Product & BOM" — a second Planner touch immediately after the PMG Approver had
     approved, confirming something they had already specified and the approver had already
     approved. FR2.5 settles it: on approval the SYSTEM shall "initiate applicable Product / WIP /
     BOM processing" and "create the linked Sub-Contracting Order / PO". Every FR3 field is
     auto-derived — Product Code auto-generated, Description / Base UOM taken from the approved
     SCR, Product Type derived from SCR Base, BOM components taken from the approved Issue Items,
     BOM Ratio a formula. There is nothing to decide, so there is no one to ask. The next human
     after approval is the Buyer. */
  if(n===3)n=4;
  if(n===5&&txn.scr.billable==='No')n=6;              // zero-value PO needs no manual approval
  /* FR7.7 — after goods issue: Logistics Required = No goes "directly to Delivery Note
     processing". The shipment's own flag wins over the SCR's, because FR6.2 lets the Planner
     change it when creating the shipment; it falls back to the SCR when never set. */
  if(n===8&&scLogisticsRequired(txn)==='No')n=9;
  return n;
}
/* == FR3 — RECEIVABLE PRODUCT / WIP AND BOM PROCESSING ======================================
   Runs automatically when the SCR is approved. Resolves the receivable product (FR3.1 reuse /
   FR3.2 create / FR3.3 duplicate check), builds the one-level BOM from the approved issue items
   (FR3.4), and creates the linked PO in Draft — the four things FR2.5 lists as consequences of
   approval. Recorded on the transaction so step 3's panel can show what the system did, and
   logged as a System action so the audit trail does not attribute it to whoever clicked last. */
function scRunFr3(txn){
  const s=txn.scr;
  const recvQty=Number(s.recvQty||0);
  /* FR3.3 — "Before creating a new Product, the system shall verify whether the Product already
     exists. The duplicate check shall consider: Product Name / Description, Base UOM, Product
     Type, applicable Variant / Revision." A lookup by product CODE alone satisfies none of that:
     a receivable described identically to an existing product under a different code minted a
     duplicate, which is the one outcome FR3.3 forbids. Code stays the fast path. */
  const wantType=s.base==='Project'?'Finished':'Semi-Finished / WIP';
  const wantName=String(s.title||s.recvItem||'').trim().toLowerCase();
  const existing=scItem(s.recvItem)||scMaster.items.find(function(i){
    return String(i.name||'').trim().toLowerCase()===wantName
      && String(i.uom||'')===String(s.recvUom||i.uom||'')
      && String(i.kind||'')===wantType
      && String(i.variant||'')===String(s.variant||i.variant||'');
  });
  // FR3.1 / FR3.2 — reuse the existing product untouched, or mint a Pending one.
  if(existing){
    txn.product={code:existing.code,name:existing.name,uom:existing.uom,
      type:existing.kind,status:'Active',created:false};
  }else{
    scState.seq.product=(scState.seq.product||0)+1;
    txn.product={code:'FG-'+String(10000+scState.seq.product),name:s.title||s.recvItem,
      uom:s.recvUom||'EA',
      // FR3.2 — Product Type is derived from SCR Base, not chosen.
      type:s.base==='Project'?'Finished':'Semi-Finished / WIP',
      // FR3.2 — Pending until the first confirmed receipt (FR16) activates it.
      status:'Pending',created:true,originatingScr:txn.no,
      prodOrder:s.base==='Project'?'':s.prodOrder,opFrom:s.opFrom,opTo:s.opTo};
  }
  // FR3.4 — one-level BOM. BOM Ratio = Issue Quantity ÷ Expected Receivable Quantity.
  scState.seq.bom=(scState.seq.bom||0)+1;
  txn.bomRef='BOM-2026-'+String(1000+scState.seq.bom);
  txn.bom=(s.issueItems||[]).map(function(r){
    const c=scItem(r.item);
    const ratio=recvQty>0?Math.round((Number(r.qty||0)/recvQty)*10000)/10000:0;
    return {parent:txn.product.code,component:r.item,qty:Number(r.qty||0),
      ratio:ratio,uom:c?c.uom:'',ref:txn.bomRef};
  });
  // The ratio also goes back onto the issue line — FR17.4 consumes against it at reconciliation.
  (s.issueItems||[]).forEach(function(r){
    const b=txn.bom.find(function(x){return x.component===r.item;});
    if(b)r.ratio=b.ratio;
  });
  scApplyStamps(txn,3);                                  // po → Draft
  // FR2.5 — approval creates the linked PO. FR4: "Initial PO Status = Draft". The Buyer COMPLETES
  // a PO that already exists; they were minting it themselves, so until they saved one the
  // transaction had an approved SCR and no order against it.
  if(!txn.po.no){
    txn.po.no=scNextNo('po');txn.po.createdOn=scNow();
    /* FR4.2/FR4.3 — the PO defaults from the approved SCR: Purchase Office "Default from SCR",
       and the Rate Contract is an AUTO-LINK ("Valid Rate Contract exists → Rate Contract shall be
       linked and applicable Price, Price Basis and Currency shall be auto-populated"). None of it
       was carried across, so the Buyer re-keyed values the system already held and the auto-fill
       only fired if they happened to re-pick the same contract by hand. */
    if(s.purchaseOffice)txn.po.purchaseOffice=s.purchaseOffice;
    if(s.rateContract&&s.rateContract!=='NONE'){
      const rc=scRateContract(s.rateContract);
      txn.po.rateContract=s.rateContract;
      if(rc){txn.po.price=rc.price;txn.po.basis=rc.basis;txn.po.currency=rc.currency;}
    }
    /* The SCR's estimate is NOT copied into the PO's price. FR1.5 calls it an "Estimated value
       for planning/reference" and FR4.3 puts the real one with the Buyer — "No valid Rate
       Contract exists → Buyer shall enter the applicable Price / Unit". Pre-filling it would
       quietly turn the Planner's estimate into the contracted rate without anyone agreeing to
       it. It is shown on the PO screen for reference instead, which is what an estimate is for. */
  }
  const sys={byId:'',by:'System',role:'Automated',source:'System'};
  scLog(txn,txn.product.created
      ? 'Receivable product '+txn.product.code+' created (Pending) and '+txn.bom.length+'-component BOM '+txn.bomRef+' built'
      : 'Existing receivable product '+txn.product.code+' reused and '+txn.bom.length+'-component BOM '+txn.bomRef+' built',
    'Approved','Approved',sys);
  scLog(txn,'Sub-Contracting PO '+txn.po.no+' created','','Draft',sys);
}
// -- FR2.4 / FR5.3 maker-checker: the same user shall not create and approve the same thing. --
function scMakerCheckerBlocked(txn){
  if(!scIsChecker(txn.step))return '';
  if(txn.step===2&&txn.createdBy===activePersonaId)
    return 'You raised this SCR. Maker-checker control blocks the same user from approving it.';
  if(txn.step===5&&txn.po&&txn.po.completedBy===activePersonaId)
    return 'You completed this PO. Maker-checker control blocks the same user from approving it.';
  return '';
}
/* Which document statuses an action changes. Declared per step because the FRD names them
   individually and they do not follow a pattern — releasing goods changes the SHIPMENT while
   the step's own document is the shipment too, but approving a delivery note changes the DN and
   leaves the shipment where it is. Applied on the forward path only; returns and rejects set
   their own. */
const SC_STAMPS={
  1:[['scr','Sent for Approval']],
  2:[['scr','Approved']],
  3:[['po','Draft']],
  4:[['po','Created']],
  5:[['po','Approved']],
  6:[['shipment','Created']],
  7:[['shipment','Freezed Outbound Release']],   // FR8.5 — goods issue freezes the outbound release
  // FR7.5 line 1076 — "Shipment Status shall remain Freezed Outbound Release while Logistics
  // information is being completed", so logistics re-affirms the status rather than changing it.
  8:[['shipment','Freezed Outbound Release']],
  // The DN is minted on ARRIVAL at step 9 (see scAdvance), not stamped on the way out of it.
  9:[['dn','Approved']],
  10:[['challan','Created'],['shipment','Challan Generated']],
  11:[['challan','Gate Cleared']],
  12:[['shipment','Challan Generated']],      // FR12.3 — shipment status does NOT change here
  13:[['asn','Created']],
  14:[['asn','QC Cleared']],
  15:[['asn','QC Cleared']],                  // FR15.4 — gate entry changes no status
  16:[['imr','Confirmed'],['recon','In Progress']],
  17:[['recon','Full Receipt Confirmed']],
  18:[]
};
function scApplyStamps(txn,fromStep){
  (SC_STAMPS[fromStep]||[]).forEach(function(p){scStampDoc(txn,p[0],p[1]);});
  txn.scr.lineStatus=txn.scr.lineStatus==='Short-Closed'?'Short-Closed':scLineStatus(txn);
}
function scAdvance(txn,step,opts){
  opts=opts||{};
  const from=txn.step,fromStatus=txn.status;
  if(!opts.noStamp)scApplyStamps(txn,from);
  // FR2.5 — crossing the (system-run) step 3 on the way out of approval does FR3's processing.
  if(from===2&&step===4&&!opts.noStamp)scRunFr3(txn);
  /* FR9.1 — the Delivery Note is generated when the shipment REACHES delivery-note processing,
     which FR7.7 places after goods issue and after logistics when logistics is required. Minting
     it in the goods-issue branch produced the DN before the logistics leg had run, so FR9.1's
     "Logistics Required = Yes but Logistics incomplete → Generation blocked" had nothing left to
     block. Arrival at step 9 is the one point both routes converge on. */
  /* FR16.1 — "IMR Status | Created", and FR16.5's transition is "Created → Confirmed". The only
     IMR stamp anywhere was Confirmed, so Created was dead vocabulary: while Stores was working on
     the receipt the document trail showed no IMR row at all, and a saved-but-unconfirmed IMR had
     no number and no identity. */
  if(step===16&&!opts.noStamp){
    if(!txn.imr.no)txn.imr.no=scNextNo('imr');
    if(!scDocStatus(txn,'imr'))scStampDoc(txn,'imr','Created');
  }
  if(step===9&&!opts.noStamp&&!txn.dn.no){
    txn.dn.no=scNextNo('dn');
    txn.dn.date=scNow();
    txn.dn.issuedBy=typeof activePersonaId!=='undefined'?activePersonaId:'stores';
    scStampDoc(txn,'dn','Generated');
  }
  // FR13.1 — the ASN belongs to the vendor named on the SCR, not to "the vendor role".
  if(step===13&&!opts.pendingWith)opts.pendingWith=scVendorPersona(txn.scr.vendor);
  const spec=SC_STEP_SPEC[step]||{};
  txn.step=step;
  txn.pendingWith=opts.pendingWith||scStep(step).actors[0];
  txn.pendingSince=new Date().toISOString();
  if(spec.status)txn.status=spec.status;
  if(opts.status)txn.status=opts.status;
  const me=typeof activePersonaId!=='undefined'?activePersonaId:'planner';
  txn.participants=txn.participants||[];
  if(txn.participants.indexOf(me)===-1)txn.participants.push(me);
  if(txn.participants.indexOf(txn.pendingWith)===-1)txn.participants.push(txn.pendingWith);
  scLog(txn,opts.action||('Moved to step '+step+' — '+scStep(step).short),fromStatus,txn.status,opts);
  /* Back to web on every handoff. scViewMode is a global toggle that only checker screens
     render, so a mobile approval left it set — and every later log on that transaction,
     including ones written by steps with no toggle at all, inherited "Mobile Application" as its
     Action Source. FR19.6 wants the source of the ACTION, not of the last screen visited. */
  scViewMode='web';
  scSave();
  return txn;
}
// -- Who sees a transaction on their dashboard: whoever it is waiting on, plus anyone who has
// already acted on it. Without the second half a Planner loses sight of their own SCR the
// moment they submit it, which is exactly what the greyed tiles are meant to show. --
function scVisibleTo(txn,actorId){
  return txn.pendingWith===actorId||(txn.participants||[]).indexOf(actorId)>-1;
}
function scMyTxns(actorId){return scState.txns.filter(function(t){return scVisibleTo(t,actorId);});}
function scMyAtStep(actorId,step){return scMyTxns(actorId).filter(function(t){return t.step===step&&!t.closed;});}
function scActionable(actorId){return scState.txns.filter(function(t){return t.pendingWith===actorId&&!t.closed;});}

/* == PER-STEP SPECIFICATION ================================================================
   Eighteen steps rendered by two builders, not eighteen page functions. Each entry says what
   kind of step it is, which document it acts on, what status it puts the transaction into, and
   what the actor can do. `kind` is the only branch that matters:

     maker   — a form. Fields are filled and a primary action moves it on.
     checker — read-only review plus an action sheet. THESE, and only these, get the
               web/mobile toggle, because a checker is the person approving, returning or
               rejecting and that is the audience FR19 puts on mobile.

   `next` is the step the primary action advances to. `back` is where a return sends it. == */
const SC_STEP_SPEC={
  1:{kind:'maker',doc:'scr',status:'Created',title:'Create Sub-Contracting Request',
     primary:{id:'submit',label:'Submit for Approval'},secondary:{id:'save',label:'Save as Draft'},next:2,submitStatus:'Sent for Approval'},
  2:{kind:'checker',doc:'scr',title:'Review SCR',status:'Sent for Approval',
     actions:[{id:'approve',label:'Approve',tone:'green'},{id:'return',label:'Return',tone:'amber',set:'RC-SCRRET'},{id:'reject',label:'Reject',tone:'red',set:'RC-SCRREJ'}],
     next:3,back:1,approveStatus:'Approved',returnStatus:'Returned',rejectStatus:'Rejected'},
  // Run by the system on SCR approval (scRunFr3). No actor, no form, no button — the `primary`
  // that used to be here described a click nobody makes. Kept in the map so scSpec(3) and
  // SC_STAMPS[3] still resolve for any record that has to be migrated through it.
  3:{kind:'system',doc:'scr',status:'Approved',title:'Receivable Product / WIP & BOM Processing',next:4},
  4:{kind:'maker',doc:'po',status:'Draft',title:'Complete Sub-Contracting PO',
     primary:{id:'generate',label:'Generate PO'},secondary:{id:'save',label:'Save'},
     extra:[{id:'return-scr',label:'Return SCR',tone:'amber',set:'RC-BUYRET',toStep:1}],next:5,submitStatus:'Created'},
  /* FR5.2 declares exactly two actions — Approve and Return — and FR5.5 makes Return the only
     correction path for a PO. The Reject that used to sit here closed the transaction terminally
     for a document the FRD always sends back to the Buyer, and it borrowed RC-PORET ("Return PO")
     because the FRD defines no PO reject reason set at all. */
  5:{kind:'checker',doc:'po',title:'Review Commercial PO',status:'Created',
     actions:[{id:'approve',label:'Approve PO',tone:'green'},{id:'return',label:'Return',tone:'amber',set:'RC-PORET'}],
     next:6,back:4,approveStatus:'Approved',returnStatus:'Returned'},
  6:{kind:'maker',doc:'shipment',status:'Created',title:'Create Shipment & Reserve Material',
     primary:{id:'submit',label:'Submit Shipment'},secondary:{id:'save',label:'Save'},next:7},
  7:{kind:'checker',doc:'shipment',title:'Stores Outbound / Goods Issue',status:'Created',
     // FR8.1/8.3 — lot or serial is captured HERE, at the moment of issue, and goods issue is
     // blocked without it. The wireframes put it in the release sheet ("Scan or select lot")
     // rather than on the record, which is where a storesperson actually reads a label.
     actions:[{id:'release',label:'Release / Goods Issue',tone:'green',
       fields:[{id:'lot',label:'Lot / Serial no.',type:'text',req:true,ph:'Scan or select lot'}]},
       {id:'return',label:'Return',tone:'amber',set:'RC-STORERET',toStep:6}],
     next:8,back:6,approveStatus:'Freezed Outbound Release'},
  // FR7.5 — "Shipment and Issue Item information shall remain read-only for the Logistics User",
  // so this step edits only the logistics block. FR7.7 routes it straight to the Delivery Note.
  8:{kind:'maker',doc:'shipment',status:'Freezed Outbound Release',title:'Shipment Processing & Logistics',
     primary:{id:'confirm',label:'Confirm Logistics'},secondary:{id:'save',label:'Save'},next:9},
  /* FR9.5 — "route Logistics / Dispatch corrections to the Logistics User; route material /
     Goods Issue corrections to Stores / Planner, as applicable." One unconditional toStep sent
     every return to Stores, including DNR-03 Missing Logistics Detail and DNR-04 Packing
     Incorrect, which Stores cannot fix. toStep is resolved per reason code below. */
  9:{kind:'checker',doc:'dn',title:'Delivery Note Approval',status:'Generated',
     actions:[{id:'approve',label:'Approve',tone:'green'},
       {id:'return',label:'Return',tone:'amber',set:'RC-DNRET',
        toStep:function(txn,sheet){
          const logisticsFix=['DNR-03','DNR-04'].indexOf(sheet&&sheet.reason)>-1;
          return logisticsFix&&scLogisticsRequired(txn)==='Yes'?8:7;}}],
     next:10,back:7,approveStatus:'Approved'},
  /* Master Data section D: "Challan | Created, Gate Cleared, Closed". Draft and Generated were
     invented here, so FR11.1's gate-outward entry condition ("Challan Status = Created") named a
     value this system could never produce, and every FR20 row read "Generated → Gate Cleared". */
  10:{kind:'checker',doc:'challan',title:'Challan Generation',
     actions:[{id:'generate',label:'Generate Challan',tone:'amber'},{id:'return',label:'Return',tone:'red',set:'RC-CHRET',toStep:9}],
     next:11,back:9,approveStatus:'Created'},
  11:{kind:'checker',doc:'challan',title:'Security Gate Outward',status:'Created',
     /* FR11.2/11.3 — the gate check, and the two conditional reason codes the wireframes never
        drew a home for. Security may correct the vehicle and the package count at the gate, and
        the FRD makes a reason MANDATORY whenever either differs from what was planned. Both
        reason fields appear only when the value actually changed, which is what `when` is for. */
     actions:[{id:'confirm',label:'Confirm Dispatch',tone:'green',fields:[
         {id:'gateVehicle',label:'Vehicle No. at gate',type:'text',req:true,
          was:'vehicle',wasDoc:'shipment',def:function(txn){return txn.shipment.vehicle||'';}},
         /* A CHANGE needs something to have changed FROM. Both predicates fired whenever the
            planned value was blank — the shipment had no vehicle recorded, security typed the
            one at the gate, and the sheet demanded a "Vehicle Change Reason" for a vehicle that
            was never planned. There is no change to explain when there was no plan; the value is
            simply being captured for the first time. */
         {id:'vehicleReason',label:'Vehicle Change Reason',type:'reason',set:'RC-GATEVEH',req:true,
          when:function(txn,sheet){
            const planned=txn.shipment.vehicle||'';
            return !!planned&&!!sheet.gateVehicle&&sheet.gateVehicle!==planned;},
          help:'Mandatory — the vehicle differs from the one planned'},
         {id:'gatePackages',label:'Packages verified at gate',type:'num',req:true,
          was:'packages',wasDoc:'shipment',def:function(txn){return txn.shipment.packages||'';}},
         {id:'packageReason',label:'Package Count Difference Reason',type:'reason',set:'RC-GATEPKG',req:true,
          when:function(txn,sheet){
            const planned=txn.shipment.packages;
            if(planned===undefined||planned===''||planned===null)return false;
            return sheet.gatePackages!==undefined&&sheet.gatePackages!==''&&String(sheet.gatePackages)!==String(planned);},
          help:'Mandatory — the count differs from the challan'},
         {id:'gateExitAt',label:'Gate exit time',type:'text',req:true,def:function(){return scNow();}},
         {id:'sealNo',label:'Seal / Lock No.',type:'text'}]},
       /* FR11.6 — "the transaction shall route to the applicable preceding stage for correction",
          and RC-SECRET's own values name different owners: SEC-02 is a challan problem (Finance),
          SEC-05 a vehicle/package problem (Logistics, or Stores when there is no logistics leg).
          A single toStep sent all seven to Stores, in front of a role that can fix neither. */
       {id:'return',label:'Return for Correction',tone:'amber',set:'RC-SECRET',
        toStep:function(txn,sheet){
          const r=sheet&&sheet.reason;
          if(r==='SEC-02')return 10;                                   // challan details — Finance
          if(r==='SEC-05')return scLogisticsRequired(txn)==='Yes'?8:7;  // vehicle / packages
          return 7;                                                    // material / documents — Stores
        }}],
     next:12,back:7,approveStatus:'Gate Cleared'},
  12:{kind:'checker',doc:'shipment',title:'Shipment Confirmation',status:'Gate Cleared',
     actions:[{id:'confirm',label:'Confirm Shipment',tone:'green'}],next:13,approveStatus:'At Vendor'},
  13:{kind:'maker',doc:'asn',status:'Created',title:'Raise Advance Shipping Notice',
     primary:{id:'raise',label:'Raise ASN'},secondary:{id:'save',label:'Save'},next:14},
  14:{kind:'checker',doc:'asn',title:'QC Clearance of ASN',status:'Created',
      // FR14.4 — Clear ASN is the QC APPROVAL. Green, not destructive.
      actions:[{id:'clear',label:'Clear ASN',tone:'green'},{id:'return',label:'Return ASN',tone:'amber',set:'RC-QCRET',toStep:13}],
      next:15,back:13,approveStatus:'QC Cleared'},
  15:{kind:'checker',doc:'asn',title:'Security Gate Inward',status:'QC Cleared',
      actions:[{id:'confirm',label:'Confirm Gate Entry',tone:'green'}],next:16,approveStatus:'QC Cleared'},
  16:{kind:'maker',doc:'imr',status:'Created',title:'Stores Material Receipt (IMR)',
      primary:{id:'confirm',label:'Confirm IMR'},secondary:{id:'save',label:'Save'},next:17,submitStatus:'Confirmed'},
  17:{kind:'checker',doc:'recon',title:'Material Reconciliation',status:'In Progress',
      actions:[{id:'full-receipt',label:'Confirm Full Receipt',tone:'green'}],next:18,approveStatus:'Full Receipt Confirmed'},
  18:{kind:'checker',doc:'recon',title:'Final Closure',status:'Full Receipt Confirmed',
      actions:[{id:'close',label:'Close Transaction',tone:'amber'}],next:0,approveStatus:'Closed'}
};
function scSpec(step){return SC_STEP_SPEC[step]||SC_STEP_SPEC[1];}
function scIsChecker(step){return scSpec(step).kind==='checker';}

/* == FORM SPECIFICATION ====================================================================
   Maker steps are declared as sections of fields rather than written as markup. One renderer
   (scRenderForm) turns these into inputs, applies the conditional rules, validates on submit
   and writes into the transaction. Adding a field is a line here.

   `when` is the conditional-display rule the FRD is full of — Reason for Non-Billable appears
   only when Billable = No, Internal BP only when Inter-Unit = Yes, the Project block only when
   SCR Base = Project. It takes the live form object and returns a boolean, so the rule sits
   beside the field it governs instead of in a render branch. == */
/* == FR7.5 — THE LOGISTICS BLOCK, DECLARED ONCE AND USED TWICE ==============================
   "The Shipment page shall contain a Logistics Arrangement section controlled by the Logistics
   Required flag … The Planner MAY enter available logistics information during Shipment
   preparation. AFTER Stores Outbound / Goods Issue, the authorized Logistics User shall COMPLETE
   / CONFIRM the required Logistics information." (lines 868–880)

   Two different things, and the FRD means both: the same fields appear on the shipment page at
   creation, where they are OPTIONAL and the Planner fills in whatever is known, and again at the
   logistics step after goods issue, where they are MANDATORY and the Logistics User completes
   them. Both write to txn.shipment, so whatever the Planner pre-filled is already sitting in the
   fields when the Logistics User opens it. One list, two levels of strictness. == */
const SC_LOGISTICS_FIELDS=[
  {id:'packageType',label:'Package Type / Details',type:'select',req:true,opts:[{v:'Wooden Box',t:'Wooden Box'},{v:'Pallet',t:'Pallet'},{v:'Crate',t:'Crate'},{v:'Loose',t:'Loose'}]},
  {id:'packages',label:'Number of Packages',type:'num',req:true},
  {id:'weight',label:'Package Weight',type:'num',req:true},
  {id:'weightUom',label:'Weight UOM',type:'select',req:true,opts:[{v:'Kg',t:'Kg'},{v:'MT',t:'MT'}],def:'Kg'},
  {id:'dispatchMode',label:'Mode of Dispatch',type:'select',req:true,opts:[{v:'Road',t:'Road'},{v:'Rail',t:'Rail'},{v:'Sea',t:'Sea'},{v:'Air',t:'Air'},{v:'Courier',t:'Courier'},{v:'Hand',t:'Hand'}]},
  {id:'transporter',label:'Transporter',type:'text',ph:'Transporter name'},
  /* FR7.5 — "Vehicle No. | Conditional | Required based on selected transport mode". It had
     no req and no when, so Confirm Logistics passed with the vehicle blank and FR11's gate
     check then compared the counted vehicle against an empty planned value. */
  {id:'vehicle',label:'Vehicle No.',type:'text',ph:'MH12 AB 1234',req:true,
   when:function(f){return ['Road','Rail'].indexOf(f.dispatchMode)>-1;},
   help:'Mandatory for Road and Rail dispatch'},
  {id:'driver',label:'Driver Details',type:'text',ph:'Name · contact'},
  {id:'lr',label:'LR / Transport Reference No.',type:'text'},
  {id:'lrDate',label:'LR / Transport Date',type:'date'},
  {id:'insurance',label:'Insurance Applicable',type:'yesno',def:'No'},
  {id:'insuredBy',label:'Insured By / Insurance Details',type:'text',when:function(f){return f.insurance==='Yes';},help:'Mandatory when Insurance Applicable = Yes',req:true},
  {id:'contact',label:'Loading / Unloading Contact',type:'text'}
];
function scLogisticsFields(mandatory){
  return SC_LOGISTICS_FIELDS.map(function(f){
    const c=Object.assign({},f);
    if(mandatory)return c;
    // FR7.5's Planner pass: nothing is required yet, and the whole block hides when the shipment
    // is not going through logistics at all (FR7.5 "Logistics Required = No → fields shall not be
    // required, logistics processing shall be skipped").
    delete c.req;
    const inner=f.when;
    c.when=function(fm,t){
      const on=(fm.logistics!==undefined&&fm.logistics!=='')?fm.logistics:(t?(t.scr.logistics||'Yes'):'Yes');
      if(on!=='Yes')return false;
      return inner?inner(fm,t):true;
    };
    c.help='Optional now — the Logistics User completes this after goods issue';
    return c;
  });
}
const SC_FORMS={
  1:[
    {section:'SCR Header Details',fields:[
      {id:'no',label:'SCR No.',type:'ro',val:function(){return 'Auto-generated on save';}},
      {id:'status',label:'SCR Status',type:'ro',val:function(){return 'Created';}},
      {id:'createdOn',label:'Created On',type:'ro',val:function(){return scNow();}},
      {id:'createdBy',label:'Created By',type:'ro',val:function(){const a=scActor(activePersonaId)||scActor('planner');return a.name+' ('+a.label+')';}},
      {id:'location',label:'Location',type:'select',req:true,opts:function(){return scMaster.locations.map(function(l){return{v:l.code,t:l.name};});}},
      {id:'title',label:'SCR Title',type:'text',req:true,ph:'Short description of the requirement'},
      {id:'base',label:'SCR Base',type:'select',req:true,opts:[{v:'Production Order',t:'Production Order'},{v:'Project',t:'Project'}]},
      {id:'nature',label:'Nature of SCR / Work Type',type:'select',req:true,opts:[{v:'Job',t:'Job'},{v:'Non-Job',t:'Non-Job'}]},
      {id:'unpeg',label:'SCR Unpeg',type:'yesno',req:true,def:'No'},
      {id:'interUnit',label:'Inter-Unit',type:'yesno',req:true,def:'No'},
      {id:'fim',label:'Partial Material as FIM',type:'yesno',req:true,def:'No'},
      {id:'billable',label:'Billable',type:'yesno',req:true,def:'Yes'},
      {id:'logistics',label:'Logistics Required',type:'yesno',req:true,def:'Yes'},
      {id:'nonBillReason',label:'Reason for Non-Billable',type:'reason',set:'RC-NONBILL',req:true,
       when:function(f){return f.billable==='No';},help:'Mandatory when Billable = No'},
      /* "None" is an explicit choice, not an empty dropdown. FR4.3 makes the rate contract
         conditional — "Applicable where valid Rate Contract exists" — so a vendor with no
         contract is a normal case, and the Planner then states the rate themselves. Leaving it
         blank read as "not filled in yet" and gave nowhere to put the price. */
      // FR1.5 lists this as a "Reference — Approved Rate Contract — Where applicable". It points
      // at the contract the PO will price against; it does not set a price here.
      {id:'rateContract',label:'Rate Contract',type:'select',opts:function(f){
        return [{v:'NONE',t:'None — no contract applies'}].concat(
          scMaster.rateContracts.filter(function(r){return r.status==='Active'&&(!f.vendor||r.vendor===f.vendor);})
            .map(function(r){return{v:r.no,t:r.no+' · ₹'+r.price+' '+r.basis};}));},
       help:'Reference only — the contract the Buyer will price the PO against'},
      /* FR1.5 calls this "Estimated Price / Unit — Numeric — Planner — Where applicable —
         Estimated value for planning/reference". It is NOT the PO's price. The binding rate is
         FR4.2's "Price / Unit — Buyer / Rate Contract — Billable only — Mandatory for Billable
         PO", and FR4.3 is explicit about who supplies it: "No valid Rate Contract exists → Buyer
         shall enter the applicable Price / Unit". Labelling this one "Price / Unit" and making it
         mandatory turned a planning estimate into a second commercial entry, which is why it read
         as keying the same number twice. Optional, always visible, and named for what it is. */
      {id:'price',label:'Estimated Price / Unit',type:'num',ph:'0.00',
       when:function(f){return f.billable!=='No';},
       help:'For planning and reference only. The binding rate is set by the Buyer on the PO.'},
      {id:'rcPrice',label:'Rate Contract Price',type:'ro',
       when:function(f){return !!f.rateContract&&f.rateContract!=='NONE'&&f.billable!=='No';},
       val:function(f){const rc=scRateContract(f.rateContract);
         return rc?rc.price+' '+rc.currency+' '+rc.basis+'  ·  '+rc.no:'';},
       help:'Carried to the PO, where it becomes the read-only rate (FR4.3)'},
      {id:'buyer',label:'Buyer',type:'select',opts:function(){return[{v:'buyer',t:scActor('buyer').name}];}},
      {id:'purchaseOffice',label:'Purchase Office',type:'select',req:true,opts:function(){return scMaster.purchaseOffices.map(function(p){return{v:p.code,t:p.name};});}},
      {id:'remarks',label:'Remarks',type:'textarea',ph:'Internal remarks',max:500},
      {id:'headerText',label:'Header Text',type:'textarea',ph:'Additional transaction information',max:500}
    ]},
    {section:'SCR Base Details',fields:[
      {id:'prodOrder',label:'Production Order',type:'select',req:true,when:function(f){return f.base!=='Project';},
       opts:function(){return scMaster.productionOrders.map(function(p){return{v:p.no,t:p.no+' · '+p.description};});}},
      {id:'poDesc',label:'Work / Process Description',type:'ro',when:function(f){return f.base!=='Project';},
       val:function(f){const p=scProdOrder(f.prodOrder);return p?p.description:'—';}},
      {id:'poQty',label:'Production Order Quantity',type:'ro',when:function(f){return f.base!=='Project';},
       val:function(f){const p=scProdOrder(f.prodOrder);return p?p.qty+' '+p.uom:'—';}},
      {id:'poDates',label:'Start → End',type:'ro',when:function(f){return f.base!=='Project';},
       val:function(f){const p=scProdOrder(f.prodOrder);return p?p.start+' → '+p.end:'—';}},
      {id:'poStatus',label:'Status',type:'ro',when:function(f){return f.base!=='Project';},
       val:function(f){const p=scProdOrder(f.prodOrder);return p?p.status:'—';}},
      // FR1.3 — the three operation fields the desktop wireframe omits and the mobile one has.
      {id:'opFrom',label:'Operation From',type:'select',req:true,when:function(f){return f.base!=='Project';},
       opts:function(f){const p=scProdOrder(f.prodOrder);return p?p.routing.map(function(r){return{v:r.op,t:r.op+' · '+r.desc};}):[];}},
      {id:'opTo',label:'Operation To',type:'select',req:true,when:function(f){return f.base!=='Project';},
       opts:function(f){const p=scProdOrder(f.prodOrder);if(!p)return[];
         return p.routing.filter(function(r){return !f.opFrom||r.op>=f.opFrom;}).map(function(r){return{v:r.op,t:r.op+' · '+r.desc};});},
       help:'Must be the same as or after Operation From'},
      {id:'opDesc',label:'Operation by Subcontractor',type:'text',req:true,when:function(f){return f.base!=='Project';},ph:'Describe the outsourced work'},
      {id:'project',label:'Project',type:'select',req:true,when:function(f){return f.base==='Project';},
       opts:function(){return scMaster.projects.map(function(p){return{v:p.code,t:p.code+' · '+p.name};});}},
      {id:'projectElement',label:'Project Element',type:'select',req:true,when:function(f){return f.base==='Project';},
       opts:function(f){const p=scProject(f.project);return p?p.elements.map(function(e){return{v:e.code,t:e.name};}):[];}},
      {id:'activity',label:'Activity / Cost Object',type:'select',when:function(f){return f.base==='Project';},
       opts:function(f){const p=scProject(f.project);return p?p.activities.map(function(a){return{v:a,t:a};}):[];}}
    ]},
    {section:'Vendor Details',fields:[
      {id:'vendor',label:'Vendor / Subcontractor',type:'select',req:true,when:function(f){return f.interUnit!=='Yes';},
       opts:function(){return scMaster.vendors.filter(function(v){return v.type==='External';}).map(function(v){return{v:v.code,t:v.name};});}},
      {id:'vendorAddress',label:'Vendor Address',type:'select',req:true,when:function(f){return f.interUnit!=='Yes';},
       opts:function(f){const v=scVendor(f.vendor);return v?v.addresses.map(function(a){return{v:a.code,t:a.text};}):[];}},
      {id:'internalBP',label:'Internal Business Partner',type:'select',req:true,when:function(f){return f.interUnit==='Yes';},
       opts:function(){return scMaster.internalBPs.map(function(b){return{v:b.code,t:b.name};});},help:'Mandatory when Inter-Unit = Yes'},
      {id:'skill',label:'Required Skill / Service',type:'select',opts:function(){return scMaster.skills.map(function(s){return{v:s,t:s};});}}
    ]}
  ],
  4:[{section:'PO Header',fields:[
      // The PO now exists before the Buyer opens it (FR2.5 creates it at approval), so these show
      // the record's real values instead of claiming a number will appear later.
      {id:'poNo',label:'PO No.',type:'ro',val:function(f,t){return (t&&t.po.no)||'Auto-generated on approval';}},
      {id:'orderType',label:'Order Type',type:'ro',val:function(){return 'SUB';}},
      {id:'lotType',label:'Lot Type',type:'ro',val:function(){return 'Specific';}},
      {id:'poStatus',label:'PO Status',type:'ro',val:function(f,t){return scDocStatus(t,'po')||'Draft';}}
    ]},
    {section:'Commercial Terms',fields:[
      {id:'taxCode',label:'Tax Code',type:'select',req:true,opts:function(){return scMaster.taxCodes.map(function(t){return{v:t,t:t};});}},
      // FR4.2 — "Default from SCR; Buyer may select applicable value". It was discarding a value
      // the SCR already holds and making the Buyer re-key it.
      {id:'purchaseOffice',label:'Purchase Office',type:'select',req:true,
       def:function(f,t){return t?t.scr.purchaseOffice:'';},
       opts:function(){return scMaster.purchaseOffices.map(function(p){return{v:p.code,t:p.name};});}},
      {id:'poSeries',label:'PO Series',type:'select',req:true,opts:[{v:'SUB-PO Series 2026',t:'SUB-PO Series 2026'}]},
      /* FR4.3 — the contract list must be filtered to the SCR's vendor. Without the predicate a
         PO for V-1001 could be priced off V-1002's contract at a completely different rate; the
         SCR form applies exactly this filter and the PO form had dropped it. */
      {id:'rateContract',label:'Rate Contract',type:'select',
       def:function(f,t){return t?t.scr.rateContract:'';},
       opts:function(f,t){
         const vendor=t&&t.scr.vendor;
         return [{v:'NONE',t:'None — enter price manually'}].concat(
           scMaster.rateContracts.filter(function(r){return r.status==='Active'&&(!vendor||r.vendor===vendor);})
             .map(function(r){return{v:r.no,t:r.no+' · ₹'+r.price+' '+r.basis};}));},
       help:'Active contracts for this vendor only — auto-fills price, basis and currency'},
      /* FR4.3 — "Where the Price is derived from an approved Rate Contract, it shall remain
         read-only unless an authorized override is specifically permitted." It stayed a free
         numeric input, so a Buyer could silently overwrite a contracted rate after linking it. */
      // A distinct id, not a second field called `price` — scLiveForm keys by id, so two entries
      // sharing one would overwrite each other in the form buffer. `price` stays the stored value
      // (scSetField auto-fills it from the contract); this is the read-only presentation of it.
      {id:'priceLocked',label:'Price / Unit',type:'ro',
       when:function(f,t){return (!t||t.scr.billable!=='No')&&!!f.rateContract&&f.rateContract!=='NONE';},
       val:function(f){const rc=scRateContract(f.rateContract);return rc?rc.price+'  ·  locked to '+rc.no:'';},
       help:'Read-only — derived from the approved rate contract (FR4.3)'},
      // Editable whenever no contract governs the rate, including an explicit "None".
      // FR4.3: "No valid Rate Contract exists → Buyer shall enter the applicable Price / Unit".
      {id:'price',label:'Price / Unit',type:'num',req:true,
       when:function(f,t){return (!t||t.scr.billable!=='No')&&(!f.rateContract||f.rateContract==='NONE');},ph:'0.00',
       help:'Mandatory for a billable PO — this is the contracted rate'},
      /* The Planner's estimate, shown beside the field the Buyer has to fill. It is reference,
         never a default: FR4.2 sources the PO price from "Buyer / Rate Contract", not from the
         SCR, so copying it in would commit a number nobody agreed. */
      {id:'scrEstimate',label:'Estimated Price / Unit (SCR)',type:'ro',
       when:function(f,t){return !!(t&&t.scr.price)&&t.scr.billable!=='No'&&(!f.rateContract||f.rateContract==='NONE');},
       val:function(f,t){return t&&t.scr.price?t.scr.price+'  ·  planning estimate, not binding':'';}},
      {id:'basis',label:'Price Basis',type:'select',req:true,when:function(f,t){return !t||t.scr.billable!=='No';},
       opts:function(){return scMaster.priceBasis.map(function(b){return{v:b,t:b};});}},
      {id:'currency',label:'Currency',type:'select',req:true,when:function(f,t){return !t||t.scr.billable!=='No';},
       opts:function(){return scMaster.currencies.map(function(c){return{v:c,t:c};});},def:'INR'},
      {id:'paymentTerms',label:'Payment Terms',type:'select',req:true,when:function(f,t){return !t||t.scr.billable!=='No';},
       opts:function(){return scMaster.paymentTerms.map(function(p){return{v:p,t:p};});}},
      {id:'expectedReceipt',label:'Expected Receipt Date',type:'date',req:true},
      {id:'poValue',label:'PO Value',type:'ro',val:function(f,t){
        if(t&&t.scr.billable==='No')return '0.00 — non-billable';
        const qty=t?Number(t.scr.recvQty||0):0,price=Number(f.price||0);
        return qty&&price?scMoney(qty*price)+' '+(f.currency||'INR')+'  ·  '+qty+' × '+price:'Enter price to calculate';}}
    ]}],
  6:[{section:'Shipment Header',fields:[
      {id:'challanType',label:'Challan Type',type:'select',req:true,opts:function(){return scMaster.challanTypes.map(function(c){return{v:c,t:c};});}},
      // FR6.2 — "Logistics Required | Yes / No | Default from SCR | Yes". It was un-editable
      // inheritance from the SCR, so the Planner could not decide logistics at shipment creation
      // even though the FRD makes it a mandatory field on this screen.
      {id:'logistics',label:'Logistics Required',type:'yesno',req:true,
       def:function(f,t){return t?(t.scr.logistics||'Yes'):'Yes';},
       help:'Defaults from the SCR — determines whether the shipment routes through Logistics after goods issue'},
      {id:'dnApprover',label:'Delivery Note Approver',type:'select',req:true,opts:function(){return[{v:'dn-approver',t:scActor('dn-approver').name}];}},
      {id:'expectedReturn',label:'Expected Date of Return',type:'date',req:true,future:true,help:'Must be a future date'},
      {id:'reference',label:'Your / Our Reference',type:'text',ph:'Optional'},
      {id:'remarks',label:'Remarks',type:'textarea',ph:'Optional',max:500},
      /* FR7.4 — the Outbound Key and the Transfer Order are system-generated on Submit Shipment
         and read-only ("be system-generated and read-only; not require separate manual creation").
         Shown here so the Planner can see they do not yet exist, and see them the moment they do
         — "View Outbound Key shall be enabled on the Shipment page" once generated. */
      {id:'outboundKey',label:'Outbound Key No.',type:'ro',
       val:function(f,t){return (t&&t.shipment.outboundKey)||'Not generated — created on Submit Shipment';}},
      {id:'transferOrder',label:'Transfer Order No.',type:'ro',
       val:function(f,t){return (t&&t.shipment.transferOrder)||'Not generated — created with the Outbound Key';}}
    ]},
    // FR7.5 lines 878–879 — the section lives on the SHIPMENT page, and the Planner may fill in
    // whatever is already known while preparing it. Optional here; completed after goods issue.
    {section:'Logistics Arrangement · optional at this stage',fields:scLogisticsFields(false)}],
  8:[{section:'Logistics Arrangement',fields:scLogisticsFields(true)}],
  13:[{section:'ASN Details',fields:[
      {id:'qtyReady',label:'Quantity Ready',type:'num',req:true,help:'Must be greater than zero and not exceed the open receivable quantity'},
      {id:'dispatchDate',label:'Expected Dispatch / Return Date',type:'date',req:true},
      // Inspection documents are attached below rather than typed here — see scAttachmentsHTML,
      // which is what FR13.3's "mandatory inspection documents are attached" actually checks.
      {id:'remarks',label:'Remarks',type:'textarea',ph:'Optional',max:500}
    ]}],
  16:[{section:'IMR Header',fields:[
      // Stamped on confirm (scPrimaryAction), not recomputed on render — a read-only field never
      // enters scForm, so calling scNow() here showed the time the IMR was being LOOKED at.
      {id:'receiptAt',label:'Receipt Date & Time',type:'ro',val:function(f,t){return (t&&t.imr.receiptAt)||'Stamped on confirmation';}},
      {id:'receivingLocation',label:'Receiving Location',type:'select',req:true,
       opts:function(){const out=[];scMaster.warehouses.forEach(function(w){w.locations.forEach(function(l){out.push({v:w.code+'/'+l.code,t:w.name+' — '+l.name});});});return out;}},
      {id:'receivedQty',label:'Received Quantity',type:'num',req:true,help:'Cannot exceed the expected receivable quantity'},
      {id:'lot',label:'Lot / Serial No.',type:'text',ph:'LOT12345'},
      /* SHORT RECEIPT. FR16.3 says the full expected quantity arrives in one IMR for the
         simplified journey, but the mobile wireframe deliberately models a shortfall and demands
         a reason for it — and that shortfall is where Reconciliation's pending balance comes
         from. Both fields appear only when what was counted is less than what was expected. */
      {id:'shortReason',label:'Shortfall Reason',type:'reason',set:'RC-SHORT',req:true,
       when:function(f,t){return t&&Number(f.receivedQty||0)>0&&Number(f.receivedQty)<Number(t.scr.recvQty||0);},
       help:'Required — less was received than expected. The balance stays open against the ASN.'},
      {id:'shortRemarks',label:'Explain the shortfall',type:'textarea',req:true,
       when:function(f,t){return t&&Number(f.receivedQty||0)>0&&Number(f.receivedQty)<Number(t.scr.recvQty||0);}},
      {id:'remarks',label:'Remarks',type:'textarea',ph:'Condition on receipt',max:500}
    ]}],
  // Steps 3, 12 and 15 capture nothing new — they confirm derived state, so they render the
  // review layout with a single primary action rather than a form.
  3:[],12:[],15:[]
};
function scMoney(n){
  n=Number(n||0);
  const s=n.toFixed(2),parts=s.split('.');
  let x=parts[0],last3=x.slice(-3),rest=x.slice(0,-3);
  if(rest)last3=','+last3;
  rest=rest.replace(/\B(?=(\d{2})+(?!\d))/g,',');
  return '₹ '+rest+last3+'.'+parts[1];
}

/* == SEED ==================================================================================
   Transactions parked at different steps so every one of the eleven roles has something
   actionable the moment they switch in — otherwise ten of them open an empty dashboard and the
   journey can only be seen by playing it from the start. Seeded once; after that the store is
   whatever the user has done to it. == */
function scSeed(){
  /* `scLoadFailed` is a hard stop, not a hint. The store holds bytes this build could not read;
     seeding would call scSave and overwrite them, and whatever the user did in the older build
     would be gone with no way back. Better an empty board carrying an honest banner. */
  if(scState.seeded||scLoadFailed)return;
  const mk=function(step,over){
    const n=scNextNo('scr');
    const t={
      /* __v STAMPED AT BIRTH. scNormalise runs a one-shot migration for records that predate the
         step 7/8 swap, keyed on a missing __v — and the seed was minting records without it, so
         the FIRST reload after seeding treated all thirty as legacy and swapped goods issue with
         logistics. SUB-2026-00009 came back at step 8 still pending with Stores, and the whole
         board quietly rearranged itself the moment anyone refreshed. */
      id:'TXN-'+(scState.txns.length+1),no:n,step:1,status:'Created',closed:false,__v:2,
      createdAt:scNow(),createdIso:new Date().toISOString(),createdBy:'planner',
      pendingWith:'planner',pendingSince:new Date(Date.now()-(3+scState.txns.length*7)*3600000).toISOString(),
      participants:['planner'],activity:[],
      scr:{location:'PUNE-01',title:'Sub-contracting for shaft machining',base:'Production Order',nature:'Job',
        unpeg:'No',interUnit:'No',fim:'Yes',billable:'Yes',logistics:'Yes',rateContract:'RC-2026-001',
        buyer:'buyer',purchaseOffice:'PO-PUNE',prodOrder:'PO-4500123456',opFrom:'0030',opTo:'0050',
        opDesc:'Edge preparation & bevelling',vendor:'V-1001',vendorAddress:'ADR-01',skill:'Machining',
        recvItem:'SHAFT-001-MC',recvQty:1000,recvWarehouse:'FG-WH',recvDate:'30 Sep 2026',price:250,
        issueItems:[
          {item:'PLATE-001',qty:1200,warehouse:'RM-WH',location:'A1-01',zone:'Zone A',fim:'Yes',ratio:1.2},
          {item:'PIPE-002',qty:600,warehouse:'MAIN-WH',location:'B2-03',zone:'Zone B',fim:'No',ratio:0.6}]},
      po:{},shipment:{},dn:{},challan:{},asn:{},imr:{},recon:{}
    };
    over=over||{};
    /* `scrOver` merges into the SCR instead of replacing it, so a seeded record can differ by a
       vendor or an item without restating all twenty header fields. `age` sets how long it has
       been sitting, which is what makes some records read as overdue and gives the board a
       believable spread rather than thirty rows all created in the same minute. */
    if(over.scrOver){Object.assign(t.scr,over.scrOver);delete over.scrOver;}
    const aged=over.age!==undefined;
    if(aged){t.pendingSince=new Date(Date.now()-over.age*3600000).toISOString();
      t.createdAt=scNow();delete over.age;}
    const close=over.close,reject=over.reject;delete over.close;delete over.reject;
    Object.assign(t,over);
    /* Logged BEFORE the walk, because it happened before the walk. Pushing it afterwards left
       the array out of chronological order, and the seed runs fast enough that the timestamps
       collide — so sorting could not rescue it either, and "most recent activity" led with the
       SCR's creation. */
    t.activity.push({at:t.createdAt,iso:t.createdIso,action:'SCR Created',from:'',to:'Created',
      byId:'planner',by:'Planner',role:'Planner',source:'Web Portal',reasonSet:'',reason:'',remarks:''});
    // Walk it forward to its seeded step so pendingWith and participants are consistent.
    /* The seed WALKS the transaction rather than teleporting it: each step applies its document
       stamps, mints its document number and moves the material, exactly as a real run would.
       Without this the seeded records reached QC, Security, Stores and Finance with blank
       document statuses, no ASN or IMR number and the material still showing "Main" — so every
       FR13–FR18 precondition read as unmet on the very records those roles open first. */
    if(step>1){
      for(let s=1;s<step;s++){
        scApplyStamps(t,s);
        let nxt=s+1;
        /* Step 3 has no actor — the system runs it on approval (FR2.5). The seed has to route the
           same way the engine does, or a seeded record parks on a step nobody owns and vanishes
           from every dashboard. scRunFr3 also mints the PO, which is why the old `s===3` line
           that did it here is gone. */
        if(nxt===3){scRunFr3(t);nxt=4;s=3;}
        t.step=nxt;
        t.pendingWith=nxt===13?scVendorPersona(t.scr.vendor):scStep(nxt).actors[0];
        const sp=scSpec(nxt);
        if(sp.status)t.status=sp.status;
        if(t.participants.indexOf(t.pendingWith)===-1)t.participants.push(t.pendingWith);
        if(s===6&&!t.shipment.no){
          t.shipment.no=scNextNo('shipment');
          scState.seq.outbound=(scState.seq.outbound||0)+1;
          t.shipment.outboundKey='OUT-2026-'+String(scState.seq.outbound).padStart(4,'0');
          t.shipment.transferOrder='TO-2026-'+String(1000+scState.seq.outbound);
          t.shipment.challanType='Material Issue Challan';
          t.shipment.expectedReturn='2026-12-31';
          t.reservations=(t.scr.issueItems||[]).map(function(r){return{item:r.item,warehouse:r.warehouse,location:r.location,qty:Number(r.qty||0)};});
          t.position='Reserved';
        }
        // Step 7 is now the goods issue; the DN is generated on ARRIVAL at step 9, so it is minted
        // when the walk leaves step 8 (logistics) or step 7 (when there is no logistics leg).
        if(s===7){t.position='Staging';t.shipment.issuedBy='stores';t.shipment.issuedAt=scNow();}
        if(nxt===9&&!t.dn.no){t.dn.no=scNextNo('dn');t.dn.date=scNow();t.dn.issuedBy='stores';scStampDoc(t,'dn','Generated');}
        // Mirror scAdvance: the IMR exists as Created the moment Stores receives the transaction.
        if(nxt===16&&!t.imr.no){t.imr.no=scNextNo('imr');scStampDoc(t,'imr','Created');}
        if(s===8){t.shipment.logisticsBy='logistics';t.shipment.logisticsAt=scNow();}
        /* The challan is minted when Finance GENERATES it, i.e. on the way out of step 10. This
           fired at s===9, so a record seeded AT step 10 — the Finance demo record — already
           carried a challan number before anyone had pressed Generate Challan, and the runtime
           mint is guarded by `!txn.challan.no`, making that button a no-op on exactly the record
           a demo starts from. */
        if(s===10&&!t.challan.no){t.challan.no=scNextNo('challan');t.challan.date=scNow();t.challan.generatedBy='finance';}
        if(s===11){
          t.challan.gateOutAt=scNow();
          scState.seq.gatepass=(scState.seq.gatepass||0)+1;
          t.challan.gatePassNo='GP-2026-'+String(scState.seq.gatepass).padStart(5,'0');
          t.challan.dispatchConfirmedBy='security';t.challan.dispatchConfirmedAt=scNow();
        }
        if(s===12)t.position='At Vendor';
        if(s===13&&!t.asn.no){t.asn.no=scNextNo('asn');t.asn.qtyReady=t.scr.recvQty;
          t.asn.docs=[{name:'Inspection_Certificate.pdf',at:scNow(),by:'Vendor'}];}
        /* Guarded on the RECEIPT, not on the IMR number. The number is minted one step earlier
           (nxt===16, mirroring scAdvance), so `!t.imr.no` was already false by the time this ran
           and the receipt never happened — a seeded transaction could reach Closed while its
           reconciliation still read "Received 0, Pending 500". */
        if(s===16&&!t.imr.receivedQty){
          if(!t.imr.no)t.imr.no=scNextNo('imr');
          t.imr.receivedQty=t.scr.recvQty;
          t.imr.receivingLocation='FG-WH/FG-01';t.imr.receivedBy='stores';t.imr.receiptAt=scNow();
          // Mirror what a real confirmation does, so a seeded reconciliation has stock behind it.
          scReceiveMaterial(t,Number(t.scr.recvQty||0));}
      }
      // `age` was deleted from `over` above, so testing it here was always true and the seeded
      // ageing was overwritten with (2+step) hours on every record past step 1.
      if(!aged)t.pendingSince=new Date(Date.now()-(2+step)*3600000).toISOString();
    }
    /* Terminal records, so the board has history and not only work in progress. A rejected SCR
       and a closed transaction are the two things a person most often looks up after the fact,
       and until now neither existed to look up. */
    if(reject){
      t.status='Rejected';t.closed=true;t.pendingWith='';
      scStampDoc(t,'scr','Rejected');
      scLog(t,'Reject SCR','Sent for Approval','Rejected',
        {byId:'pmg-approver',reasonSet:'RC-SCRREJ',reasonCode:reject,
         reason:scReasonText('RC-SCRREJ',reject),remarks:'Rejected at approval.'});
    }else if(close){
      scApplyStamps(t,18);scCloseAll(t);
      t.closed=true;t.status='Closed';t.pendingWith='';
      t.closedBy='finance';t.closedAt=scNow();
      scLog(t,'Close Transaction — SCR, PO, Shipment and Challan closed','Full Receipt Confirmed','Closed',{byId:'finance'});
    }
    scState.txns.push(t);
    return t;
  };
  /* == THE SEEDED BOARD ======================================================================
     Thirty transactions rather than thirteen, because the copilot is only worth asking once
     there is a backlog to ask ABOUT. Spread across every step, all three vendors, both billable
     and non-billable, with and without logistics, and with a real tail of closed and rejected
     records — plus a few deliberately aged past their return date so "what is overdue" has
     something true to report. `age` is in hours. == */
  const V=['V-1001','V-1002','V-1003'],ADR=['ADR-01','ADR-11','ADR-21'];
  const TITLES=['Shaft machining','Shell course bevelling','Bracket fabrication','Flange facing',
    'Plate edge preparation','Pipe spool welding','Housing boring','Cover plate drilling',
    'Nozzle cutting','Base frame assembly'];
  const RECV=['SHAFT-001-MC','WIP-SHELL-C3-BEVEL','CONV-ASSY-001'];
  const seedRows=[
    // step, options
    [1,{draft:true}],                    [2,{age:5}],   [2,{v:1,age:31,qty:400}],
    [4,{age:9}],   [4,{v:2,billable:'No',age:52}],      [5,{age:14}],
    [6,{age:7}],   [6,{v:1,logistics:'No',age:26}],     [7,{age:4}],
    [7,{v:2,age:19}],                    [8,{age:11}],  [9,{age:6}],
    [9,{v:1,age:38}],                    [10,{age:12}], [10,{v:2,billable:'No',age:44}],
    [11,{age:13}], [12,{age:8}],         [13,{age:21}], [13,{v:1,age:63}],
    [14,{age:16}], [14,{v:2,age:47}],    [15,{age:9}],  [16,{age:18}],
    [16,{v:1,qty:600,age:35}],           [17,{age:19}], [17,{v:2,age:58}],
    [18,{age:24}],
    [18,{close:true,age:96}],            [18,{v:1,close:true,age:150}],
    [2,{reject:'SCRJ-01',age:120}]
  ];
  seedRows.forEach(function(row,i){
    const st=row[0],o=row[1]||{};
    const vi=o.v||0;
    const over={age:o.age};
    if(o.close)over.close=true;
    if(o.reject)over.reject=o.reject;
    over.scrOver={
      vendor:V[vi],vendorAddress:ADR[vi],
      title:TITLES[i%TITLES.length]+' — '+(vi===0?'ABC':vi===1?'Larsen':'Precision'),
      recvItem:RECV[i%RECV.length],
      recvQty:o.qty||[1000,750,500,1200,300][i%5],
      billable:o.billable||'Yes',
      logistics:o.logistics||'Yes',
      // A rate contract only where the vendor actually has one; the rest are priced manually.
      rateContract:vi===0?'RC-2026-001':(vi===1?'RC-2026-014':'NONE'),
      price:vi===0?250:(vi===1?36000:180),
      // Half of them are due back before today, so the overdue query has real answers.
      issueItems:[
        {item:'PLATE-001',qty:(o.qty||600)*1.2,warehouse:'RM-WH',location:'A1-01',zone:'Zone A',fim:'Yes',ratio:1.2},
        {item:'PIPE-002',qty:(o.qty||600)*0.6,warehouse:'MAIN-WH',location:'B2-03',zone:'Zone B',fim:'No',ratio:0.6}]
    };
    if(o.draft)over.scrOver=undefined;
    const t=mk(st,over);
    // Past-dated returns on the older records — that is what makes them overdue at FR18.4.
    if(t.shipment&&t.shipment.no&&(o.age||0)>30)t.shipment.expectedReturn='2026-08-15';
  });
  // The first one is a genuine empty draft, so the Planner has something to fill in.
  const draft=scState.txns[0];
  draft.scr={base:'Production Order',unpeg:'No',interUnit:'No',fim:'No',billable:'Yes',logistics:'Yes',issueItems:[]};
  draft.status='Created';
  scState.seeded=true;
  scSave();
}

/* == ACTIONS =============================================================================== */
function scStartNew(){
  /* A monotonic counter, not length + random. The old id drew from overlapping ranges — with 12
     seeded records the first new one landed in TXN-13…1012 and the second in TXN-14…1013 — and
     scTxn returns the FIRST match, so a collision made one transaction permanently unreachable
     while both rows rendered and both opened the same record. */
  scState.seq.txn=Math.max(scState.seq.txn||0,scState.txns.length)+1;
  const t={id:'TXN-'+scState.seq.txn,no:'',step:1,status:'Created',closed:false,__v:2,
    createdAt:scNow(),createdIso:new Date().toISOString(),createdBy:activePersonaId,
    pendingWith:'planner',pendingSince:new Date().toISOString(),participants:[activePersonaId],activity:[],
    scr:{base:'Production Order',unpeg:'No',interUnit:'No',fim:'No',billable:'Yes',logistics:'Yes',issueItems:[]},
    po:{},shipment:{},dn:{},challan:{},asn:{},imr:{},recon:{}};
  scState.txns.push(t);
  scOpenTxnId=t.id;scForm={};scFormErrors={};
  scSave();
  navigatePage('sc-txn');
}
function scOpen(id){scOpenTxnId=id;scForm={};scFormErrors={};scViewMode='web';navigatePage('sc-txn');}
// Back always lands on the journey board, not whatever dashboard tab was last open — a Planner
// who came straight from the Journeys card has never seen the board and would otherwise be
// dropped on an unrelated tab.
function scBackToDash(){
  scOpenTxnId=null;scSheet=null;
  if(typeof dashboardTab!=='undefined')dashboardTab='sc-journeys';
  navigatePage('dashboard');
}
// -- Which sub-object a step writes into. The form buffer is merged into it on save, so a
// half-filled form survives a re-render but only reaches the record on an explicit action. --
function scDocOf(txn,step){
  const d=scSpec(step).doc;
  txn[d]=txn[d]||{};
  return txn[d];
}
function scFieldVal(txn,step,id){
  if(Object.prototype.hasOwnProperty.call(scForm,id))return scForm[id];
  const doc=scDocOf(txn,step);
  if(Object.prototype.hasOwnProperty.call(doc,id))return doc[id];
  const spec=(SC_FORMS[step]||[]).reduce(function(acc,s){return acc.concat(s.fields);},[])
    .find(function(f){return f.id===id;});
  return spec&&spec.def!==undefined?spec.def:'';
}
/* FR2.7 — Returned → Modified. The FRD makes "Modified" a real state between a return and a
   resubmission, so the approver can tell a corrected SCR from one that was merely sent back.
   Triggered by the first edit rather than by the save, which is what "the Planner modifies a
   Returned SCR" describes. */
function scTouchScr(){
  const txn=scOpenTxn();
  if(!txn||txn.step!==1)return;
  if(scDocStatus(txn,'scr')==='Returned'){
    scStampDoc(txn,'scr','Modified');
    txn.status='Modified';
    scLog(txn,'SCR modified after return','Returned','Modified');
    scSave();
  }
}
function scSetField(id,v){
  scTouchScr();
  scForm[id]=v;
  delete scFormErrors[id];
  // Rate contract auto-fills the commercial terms (FR4.3).
  if(id==='rateContract'){
    const rc=v&&v!=='NONE'?scRateContract(v):null;
    if(rc){scForm.price=rc.price;scForm.basis=rc.basis;scForm.currency=rc.currency;}
    // Choosing None clears a rate carried over from a contract, so the manual box starts empty
    // rather than pre-filled with someone else's price.
    else if(v==='NONE'){scForm.price='';scForm.basis='';scForm.currency='INR';}
  }
  // Changing the production order clears the operations (FR1.3).
  if(id==='prodOrder'){scForm.opFrom='';scForm.opTo='';}
  renderADTPage();
}
function scVisibleFields(step,txn){
  const f=scLiveForm(txn,step);
  return (SC_FORMS[step]||[]).map(function(sec){
    return{section:sec.section,fields:sec.fields.filter(function(fl){return !fl.when||fl.when(f,txn);})};
  }).filter(function(sec){return sec.fields.length;});
}
function scLiveForm(txn,step){
  const doc=scDocOf(txn,step),out={};
  (SC_FORMS[step]||[]).forEach(function(sec){sec.fields.forEach(function(fl){
    out[fl.id]=scFieldVal(txn,step,fl.id);
  });});
  Object.keys(doc).forEach(function(k){if(!(k in out))out[k]=doc[k];});
  Object.keys(scForm).forEach(function(k){out[k]=scForm[k];});
  return out;
}
function scValidate(txn,step){
  scFormErrors={};
  const f=scLiveForm(txn,step);
  scVisibleFields(step,txn).forEach(function(sec){sec.fields.forEach(function(fl){
    if(fl.type==='ro')return;
    const v=f[fl.id];
    if(fl.req&&(v===''||v===undefined||v===null))scFormErrors[fl.id]='Required';
    if(fl.type==='num'&&v!==''&&v!==undefined&&Number(v)<=0)scFormErrors[fl.id]='Must be greater than zero';
    if(fl.future&&v){const d=new Date(v);if(!isNaN(d)&&d.getTime()<Date.now()-86400000)scFormErrors[fl.id]='Must be a future date';}
  });});
  // Step-specific rules the field list cannot express.
  /* The receivable line and the issue rows are not SC_FORMS fields — they are rows, edited by
     scSetRecv / scSetIssue — so the loop above never saw them and their asterisks were
     decoration. FR1.5 and FR1.6 make eight of these mandatory and FR1.7 requires every quantity
     to be greater than zero; without this block an SCR with a blank quantity, no warehouse and
     an empty issue row submitted cleanly to the approver. */
  if(step===1){
    const s=txn.scr;
    if(f.opFrom&&f.opTo&&f.opTo<f.opFrom)scFormErrors.opTo='Operation To cannot be before Operation From';
    if(!s.recvItem)scFormErrors.recvItem='A receivable item is required';
    if(!(Number(s.recvQty)>0))scFormErrors.recvQty='Expected receivable quantity must be greater than zero';
    if(!s.recvWarehouse)scFormErrors.recvWarehouse='Receiving warehouse is required';
    if(!s.recvDate)scFormErrors.recvDate='Expected receipt date is required';
    if(!(s.issueItems||[]).length)scFormErrors.issueItems='At least one issue item is required';
    (s.issueItems||[]).forEach(function(it,i){
      const n=i+1;
      if(!it.item)scFormErrors.issueItems='Issue item '+n+' has no product selected';
      else if(it.item===s.recvItem)scFormErrors.issueItems='An issue item cannot be the same product as the receivable item';
      if(!(Number(it.qty)>0))scFormErrors.issueItems='Issue item '+n+' needs a quantity greater than zero';
      if(!it.warehouse)scFormErrors.issueItems='Issue item '+n+' needs a warehouse';
      if(!it.location)scFormErrors.issueItems='Issue item '+n+' needs a storage location';
      // FR1.6 — "Adjustment Order Reference | Mandatory when WIP Adjustment Required = Yes".
      if(it.wipAdjust==='Yes'&&!String(it.adjustmentOrder||'').trim())
        scFormErrors.issueItems='Issue item '+n+' is WIP and needs an Adjustment Order Reference';
      /* Caught HERE because here is where it can still be fixed. FR6.3 blocks the shipment when
         no bin holds the required quantity, and FR6.3's simplified flow forbids partial
         shipments — so an SCR for more than exists anywhere can never ship, and step 6 has no
         return action. Left to be discovered at step 6 it becomes unrecoverable; asked for at
         step 1 it is one number to change. */
      if(it.item&&Number(it.qty)>0){
        const total=scMaster.stock.filter(function(st){return st.item===it.item;})
          .reduce(function(a,st){return a+Number(st.free||0);},0);
        if(total>0&&Number(it.qty)>total)
          scFormErrors.issueItems='Issue item '+n+' asks for '+it.qty+' of '+it.item
            +' but only '+total+' exists across all storage locations. The shipment could never be sourced.';
      }
    });
    // FR1.8 — Remarks become mandatory when the non-billable reason is Other.
    if(f.billable==='No'&&f.nonBillReason&&scRemarksRequired('RC-NONBILL',f.nonBillReason)&&!String(f.remarks||'').trim())
      scFormErrors.remarks='Remarks are required when the non-billable reason is Other';
  }
  if(step===16){
    const exp=Number(txn.scr.recvQty||0),got=Number(f.receivedQty||0);
    if(got>exp)scFormErrors.receivedQty='Cannot exceed the expected quantity of '+exp;
  }
  if(step===13){
    const open=Number(txn.scr.recvQty||0),got=Number(f.qtyReady||0);
    if(got>open)scFormErrors.qtyReady='Cannot exceed the open receivable quantity of '+open;
    /* FR13.1 — "The Vendor shall only be able to view and act on its own applicable approved POs",
       and FR13.3 validates that the "Vendor matches the applicable PO". Nothing tied the Vendor
       persona to a vendor code, so an SCR naming any vendor landed in the same queue and could be
       actioned by whoever held it. */
    /* Refuse only when SOMEONE ELSE can actually take it. A vendor code with no matching login —
       a vendor retired from the master, or data from an older build — resolved to the default
       vendor persona, who was then refused for not being that vendor. Nobody could raise the
       ASN and step 13 has no return, so the transaction was stranded. A rule that blocks the
       only available actor is not access control, it is a trap. */
    const me=scActor(activePersonaId);
    const ownerId=scVendorPersona(txn.scr.vendor);
    if(me&&me.vendorCode&&txn.scr.vendor&&txn.scr.vendor!==me.vendorCode&&ownerId!==me.id){
      // Say who CAN act, not just who cannot — routing now hands step 13 to the matching vendor
      // login, so reaching this means the persona was switched by hand.
      const owner=scActor(ownerId);
      // Its own key: sharing __asn with the inspection-document check meant whichever ran last
      // won, and the vendor message was silently overwritten.
      scFormErrors.__vendor='This transaction is for '+((scVendor(txn.scr.vendor)||{}).name||txn.scr.vendor)
        +'. You can only raise an ASN against your own purchase orders'
        +(owner?' — switch to the '+owner.name+' login to continue.':'.');
    }
    /* FR13.3 — "mandatory inspection documents are attached WHERE INSPECTION IS REQUIRED". It was
       enforced unconditionally, which blocked every ASN including items that need no inspection.
       Master Data section B item 5 is the governing config: "Inspection Requirement Configuration
       | Item/Service, Inspection Required Y/N | Determines when ASN Inspection Documents are
       mandatory". Read from the item master now, so it is a rule with data behind it. */
    if(scInspectionRequired(txn)&&!((txn.asn.docs||[]).length))
      scFormErrors.__asn='Inspection is required for '+(txn.scr.recvItem||'this item')
        +' — attach at least one inspection document before raising the ASN.';
  }
  // FR6.3 — the availability check is a hard block on submission, not a warning on a panel.
  if(step===6){
    const b=scShipmentBlocked(txn);
    if(b)scFormErrors.__shipment=b;
  }
  return Object.keys(scFormErrors).length===0;
}
function scCommit(txn,step){
  const doc=scDocOf(txn,step);
  Object.keys(scForm).forEach(function(k){doc[k]=scForm[k];});
  scForm={};
}
function scSecondaryAction(){
  const txn=scOpenTxn();if(!txn)return;
  if(scNotMine(txn))return;
  scCommit(txn,txn.step);
  if(!txn.no&&txn.step===1)txn.no=scNextNo('scr');
  scLog(txn,'Saved as Draft',txn.status,txn.status);
  scSave();renderADTPage();
}
/* FR19.7 — "show actions only to the authorized user / role currently responsible for the
   transaction". That was enforced only by not rendering the buttons; every action function was
   callable regardless. Checked in the functions now, which is where the maker-checker rule
   already lives, so both authorisation rules are enforced in the same place. */
function scNotMine(txn){
  if(!txn)return 'No transaction open.';
  if(txn.closed)return 'This transaction is closed.';
  if(txn.pendingWith!==activePersonaId){
    /* Name the person, not just the role. Several vendors share the label "Vendor", so
       "pending with Vendor" left the reader with no idea which login to switch to. */
    const a=scActor(txn.pendingWith);
    const who=a?(a.name+' ('+a.label+')'):scActorLabel(txn.pendingWith);
    return 'This step is pending with '+who+'. Only they can act on it.';
  }
  return '';
}
function scPrimaryAction(){
  const txn=scOpenTxn();if(!txn)return;
  if(scNotMine(txn))return;
  const step=txn.step,spec=scSpec(step);
  if(!scValidate(txn,step)){renderADTPage();return;}
  scCommit(txn,step);
  if(!txn.no)txn.no=scNextNo('scr');
  // Documents are minted as the journey reaches the step that creates them.
  if(step===4&&!txn.po.no)txn.po.no=scNextNo('po');
  /* The shipment number is minted once; the Outbound Key and Transfer Order are (re)generated
     whenever they are absent. They were guarded by the same `!shipment.no` test, so a Stores
     return — which cancels both, per FR8.6's outbound-key cancellation — left them permanently
     blank on resubmission, and the shipment reached Stores again with no pick list. */
  if(step===6){
    if(!txn.shipment.no)txn.shipment.no=scNextNo('shipment');
    if(!txn.shipment.outboundKey){
      scState.seq.outbound=(scState.seq.outbound||0)+1;
      txn.shipment.outboundKey='OUT-2026-'+String(scState.seq.outbound).padStart(4,'0');
      txn.shipment.transferOrder='TO-2026-'+String(1000+scState.seq.outbound);
    }
  }
  // FR13.2 — "record Created By and Created Date-Time" on the ASN.
  if(step===13&&!txn.asn.no){txn.asn.no=scNextNo('asn');txn.asn.createdBy=activePersonaId;txn.asn.createdOn=scNow();}
  if(step===16&&!txn.imr.no)txn.imr.no=scNextNo('imr');
  if(step===4)txn.po.completedBy=activePersonaId;              // FR5.3 maker-checker
  // FR7.5 — the Logistics User completed the logistics block.
  if(step===8){txn.shipment.logisticsBy=activePersonaId;txn.shipment.logisticsAt=scNow();}
  // FR6.4 — submitting the shipment reserves the material against this transaction.
  if(step===6)scReserveMaterial(txn);
  // FR16.4 — a confirmed IMR books the receivable into the selected receiving location.
  if(step===16){
    const exp=Number(txn.scr.recvQty||0),got=Number(txn.imr.receivedQty||0);
    txn.imr.short=Math.max(0,exp-got);
    // FR16.3 — "record Received By and Receipt Date-Time". The form field was type:'ro' calling
    // scNow() on every render, so it displayed whatever time it was being LOOKED at and was never
    // written on commit (read-only fields never enter scForm).
    txn.imr.receivedBy=activePersonaId;txn.imr.receiptAt=scNow();
    scReceiveMaterial(txn,got);
  }
  /* No status override on the maker path. scAdvance applies the TARGET step's own status, which
     is the status of the document that step is about — a PO reaching step 5 reads "Created",
     a shipment reaching step 8 reads "Created". Passing the source step's status forward instead
     left step 4 showing "Approved" (the SCR's status) on a PO that had only just been drafted.
     Checker actions still pass an explicit status, because an approval genuinely names one
     (Freezed Outbound Release, Gate Cleared, At Vendor) that the next step's spec does not. */
  const to=scNextStep(txn,step);
  scAdvance(txn,to,{action:spec.primary.label});
  /* FR4.4 — "Draft → Created → Approved. The zero-value PO shall be system-approved without
     manual PO approval." This has to run AFTER scAdvance, not before: scAdvance re-applies the
     SOURCE step's forward stamps, and SC_STAMPS[4] is [['po','Created']] — so stamping Approved
     first meant scAdvance immediately overwrote it back to Created, and a non-billable PO never
     reached Approved for the life of the transaction while the log claimed it had. */
  if(to===6&&step===4&&txn.scr.billable==='No'){
    scStampDoc(txn,'po','Approved');
    txn.po.approvedBy='';txn.po.approvedAt=scNow();
    scLog(txn,'PO system-approved (zero value — no manual approval)','Created','Approved',
      {by:'System',role:'Automated',source:'System'});
    scSave();
  }
  renderADTPage();
}

/* == ACTION SHEETS =========================================================================
   Every checker decision goes through one of these. The tone drives the colour block, the
   `set` drives the reason dropdown, and scRemarksRequired decides whether remarks are
   mandatory — so the three different remarks rules in the FRD are honoured without three
   different sheets. == */
function scOpenSheet(actionId){
  const txn=scOpenTxn();if(!txn)return;
  scSheet={action:actionId,reason:'',remarks:''};
  // Seed the action's own fields from their defaults, so the gate sheet opens showing what was
  // PLANNED — the security user edits it only if reality differs, which is what makes the
  // conditional reason fields fire on a real difference rather than on an empty box.
  const act=scSheetAction(txn);
  (act&&act.fields||[]).forEach(function(fd){
    scSheet[fd.id]=typeof fd.def==='function'?fd.def(txn):(fd.def!==undefined?fd.def:'');
  });
  renderADTPage();
}
function scCloseSheet(){scSheet=null;renderADTPage();}
function scSheetSet(k,v){if(scSheet){scSheet[k]=v;renderADTPage();}}
function scSheetAction(txn){
  const spec=scSpec(txn.step);
  return (spec.actions||[]).concat(spec.extra||[]).find(function(a){return a.id===(scSheet&&scSheet.action);});
}
function scConfirmSheet(){
  const txn=scOpenTxn();if(!txn||!scSheet)return;
  const spec=scSpec(txn.step),act=scSheetAction(txn);
  if(!act)return;
  /* The gate is enforced HERE, not only by disabling the button. Two callers reach this function
     — the web action bar and the mobile one — and a rule that lives in the markup is a rule that
     the next caller does not inherit. Return and Reject are exempt: a blocked approver still
     needs a way to send the work back. */
  const notMine=scNotMine(txn);
  if(notMine){scSheet.err=notMine;renderADTPage();return;}
  const forward=act.id!=='return'&&act.id!=='reject'&&act.id!=='return-scr';
  if(forward){
    const blocked=scMakerCheckerBlocked(txn)||scGateBlock(txn);
    if(blocked){scSheet.err=blocked;renderADTPage();return;}
  }
  if(act.set){
    if(!scSheet.reason){scSheet.err='Select a reason';renderADTPage();return;}
    if(scRemarksRequired(act.set,scSheet.reason)&&!String(scSheet.remarks||'').trim()){
      scSheet.err='Remarks are required for this reason';renderADTPage();return;}
  }
  // -- Extra fields the action itself demands: lot/serial at goods issue, the gate verification
  // set, the short-receipt reason. Declared on the action so the sheet stays generic. --
  const extra=act.fields||[];
  for(let i=0;i<extra.length;i++){
    const fd=extra[i];
    if(fd.when&&!fd.when(txn,scSheet))continue;
    const v=scSheet[fd.id];
    if(fd.req&&(v===''||v===undefined||v===null)){
      scSheet.err=fd.label+' is required';renderADTPage();return;}
  }
  const opts={reasonSet:act.set||'',reasonCode:scSheet.reason||'',
    reason:scSheet.reason?scReasonText(act.set,scSheet.reason):'',remarks:scSheet.remarks||'',action:act.label};
  /* Persist the action's own fields, capturing the BEFORE value first. FR11.3 requires the
     original value, the changed value, the reason, the user and the date-time to be recorded —
     and the write below was overwriting the planned vehicle and package count in place, so the
     original was gone before anything could log it. */
  const doc=scDocOf(txn,txn.step);
  const changes=[];
  extra.forEach(function(fd){
    if(scSheet[fd.id]===undefined)return;
    /* WHAT THE VALUE IS BEING COMPARED AGAINST HAS TO BE DECLARED. This looked for a stored field
       of the SAME NAME as the sheet field, so `gateVehicle` was compared to shipment.gateVehicle
       and challan.gateVehicle — neither of which exists. `before` was always undefined, the
       change was never detected, and FR11.3's "record the original value, the changed value, the
       reason, the user and the date-time" logged the reason and nothing else. The planned value
       lives under a different name (shipment.vehicle), which is exactly what `was` names. */
    const before=fd.was?(txn[fd.wasDoc||'shipment']||{})[fd.was]:doc[fd.id];
    if(before!==undefined&&before!==''&&String(before)!==String(scSheet[fd.id])&&fd.type!=='reason')
      changes.push({field:fd.label,from:before,to:scSheet[fd.id]});
    doc[fd.id]=scSheet[fd.id];
  });
  if(changes.length){
    opts.oldValue=changes.map(function(c){return c.field+': '+c.from;}).join(' · ');
    opts.newValue=changes.map(function(c){return c.field+': '+c.to;}).join(' · ');
    // The conditional reason fields carry their own sets, so surface them on the same row.
    const rs=extra.filter(function(fd){return fd.type==='reason'&&scSheet[fd.id];});
    if(rs.length&&!opts.reasonCode){
      opts.reasonSet=rs.map(function(fd){return fd.set;}).join(', ');
      opts.reasonCode=rs.map(function(fd){return scSheet[fd.id];}).join(', ');
      opts.reason=rs.map(function(fd){return scReasonText(fd.set,scSheet[fd.id]);}).join(' · ');
    }
  }
  const isReturn=act.id==='return'||act.id==='return-scr';
  const isReject=act.id==='reject';
  if(isReject){
    txn.status=spec.rejectStatus||'Rejected';txn.closed=true;txn.pendingWith='';
    scStampDoc(txn,spec.doc,'Rejected');
    scLog(txn,act.label,spec.status,txn.status,opts);
    scSave();
  }else if(isReturn){
    /* Stamp the document the return actually sends back, and only when that document HAS a
       Returned status. Two bugs lived here: `spec.doc` at step 4 is the PO, so a Buyer's
       "Return SCR" stamped the PO as Returned and left the SCR Approved — which then made
       FR2.7's Returned → Modified unreachable. And Shipment and Challan have no Returned status
       in Master Data section D, so returning at step 8 or 11 wrote a value that does not exist;
       FR11.6 is explicit that the Shipment stays Challan Generated on a Security return. */
    const backDoc=act.id==='return-scr'?'scr':spec.doc;
    const backDocReturns=(SC_DOC_STATUSES[backDoc]||[]).indexOf('Returned')>-1;
    if(backDocReturns)scStampDoc(txn,backDoc,'Returned');
    /* A document with no Returned status still has to go somewhere coherent. FR5.5 sends the PO
       back for the Buyer to "correct only the PO/commercial information", which is the editable
       state — and FR4.4 names that state Draft. Without this the header read Draft (from step 4's
       spec) while the document trail still read Created, so the same PO showed two statuses. */
    else if(backDoc==='po')scStampDoc(txn,'po','Draft');
    // toStep may be a function of (txn, sheet): FR9.5 and FR11.6 both route by reason code.
    const back=(typeof act.toStep==='function'?act.toStep(txn,scSheet):act.toStep)||spec.back||1;
    /* A return does NOT unwind the material. FR8.6 sends a shipment back to the Planner with the
       reservation intact; only an explicit movement releases it. The one exception is a Stores
       return, where the wireframe is explicit that the outbound key is cancelled and reserved
       stock goes back to free stock — so that one, and only that one, moves it. */
    if(txn.step===7){
      scReleaseMaterial(txn,'Reservation released — outbound key cancelled on Stores return');
      txn.shipment.outboundKey='';txn.shipment.transferOrder='';
    }
    /* `noStamp` matters here. scAdvance normally applies the step's FORWARD document stamps, and
       for step 2 that is scr → Approved. On a return that is exactly wrong: the SCR has just
       been sent back, and applying the forward stamp overwrote the Returned status set two lines
       above with Approved — which then made FR2.7's Returned → Modified transition impossible,
       because nothing was ever in Returned to move out of. */
    /* Only claim "Returned" as the TRANSACTION status when the document being sent back actually
       has that status. Shipment and Challan do not (Master Data section D), so a Stores or
       Security return was putting a value on the header chip that the FRD never defines for that
       document; FR8.6 and FR11.6 both name no status change on return. Falling through to
       scAdvance instead lets the destination step's own status apply, which is the truth: the
       shipment really is back at Created with the Planner. */
    const backStatus=backDocReturns?(spec.returnStatus||'Returned'):(SC_STEP_SPEC[back]||{}).status;
    scAdvance(txn,back,Object.assign({},opts,{status:backStatus,noStamp:true}));
  }else{
    /* Inventory movements and document minting that belong to a checker decision.
       The guard on the movement is not defensive noise: steps 9 and 11 both return to step 8, so
       Stores can legitimately release the same shipment twice, and an unguarded call wrote a
       second "Main → Staging" movement into the FR20 log claiming material had moved that had
       never gone back. The material is already staged; re-releasing re-confirms it. */
    if(txn.step===7){
      if(txn.position!=='Staging')
        scMoveInventory(txn,'Staging','Goods issued against '+(txn.shipment.outboundKey||'outbound key'));
      // FR8.5 — record who issued the goods and when. The DN itself is minted on arrival at step 9.
      txn.shipment.issuedBy=activePersonaId;txn.shipment.issuedAt=scNow();
    }
    // FR2.5 / FR5.4 / FR9.4 / FR12.3 / FR14.4 / FR15.3 all list "record <X> By" and "record <X>
    // Date-Time" as obligations SEPARATE from "update the Activity Log", so the log row does not
    // discharge them and each document needs its own stamp.
    if(txn.step===2){txn.scr.approvedBy=activePersonaId;txn.scr.approvedAt=scNow();}
    if(txn.step===5){txn.po.approvedBy=activePersonaId;txn.po.approvedAt=scNow();}
    if(txn.step===9){txn.dn.approvedBy=activePersonaId;txn.dn.approvedAt=scNow();}
    if(txn.step===12){txn.shipment.confirmedBy=activePersonaId;txn.shipment.confirmedAt=scNow();}
    if(txn.step===14){txn.asn.clearedBy=activePersonaId;txn.asn.clearedAt=scNow();}
    if(txn.step===15){txn.asn.gateEntryBy=activePersonaId;txn.asn.gateEntryAt=scNow();}
    if(txn.step===17){txn.recon.confirmedBy=activePersonaId;txn.recon.confirmedAt=scNow();}
    if(txn.step===11){
      txn.challan.gateOutAt=scNow();                         // FR11.5 — return monitoring starts here
      /* FR11.5 — the gate pass is the document the vehicle physically leaves with, and the one
         the security desk quotes on the return leg. Nothing was minting it. */
      if(!txn.challan.gatePassNo){
        scState.seq.gatepass=(scState.seq.gatepass||0)+1;
        txn.challan.gatePassNo='GP-2026-'+String(scState.seq.gatepass).padStart(5,'0');
      }
      // FR11.2 — the dispatch confirmation itself: who cleared it, when, and against what.
      txn.challan.dispatchConfirmedBy=activePersonaId;
      txn.challan.dispatchConfirmedAt=scNow();
    }
    if(txn.step===12)scMoveInventory(txn,'At Vendor','Confirmed at vendor after gate outward');
    // FR10.4 — "generate a unique Challan No.; record Generated By and Generated Date-Time".
    if(txn.step===10&&!txn.challan.no){
      txn.challan.no=scNextNo('challan');
      txn.challan.date=scNow();
      txn.challan.generatedBy=activePersonaId;
    }
    if(spec.next===0){
      // FR18.3 — closure cascades to four documents and deliberately leaves three alone.
      scApplyStamps(txn,txn.step);
      scCloseAll(txn);
      txn.closed=true;txn.status=spec.approveStatus||'Closed';txn.pendingWith='';
      txn.closedBy=activePersonaId;txn.closedAt=scNow();          // FR18.2 — Closed By / Closure Date-Time
      scLog(txn,act.label+' — SCR, PO, Shipment and Challan closed',spec.status,txn.status,opts);scSave();
    }
    else scAdvance(txn,scNextStep(txn,txn.step),Object.assign({status:spec.approveStatus},opts));
  }
  scSheet=null;
  renderADTPage();
}
/* -- SHORT CLOSE. The action the whole reconciliation gate waits on, and the one the wireframes
   name in copy but never draw. Master Data defines a Short-Closed line status; FR17.7 blocks
   full receipt until pending is nil. This formally closes the residual so closure can proceed,
   with a reason and mandatory remarks, and writes the line status the data model already has. -- */
function scShortClose(){
  const txn=scOpenTxn();if(!txn)return;
  scSheet={action:'short-close',reason:'',remarks:''};
  renderADTPage();
}
function scConfirmShortClose(){
  const txn=scOpenTxn();if(!txn||!scSheet)return;
  if(!scSheet.reason){scSheet.err='Select a reason';renderADTPage();return;}
  if(!String(scSheet.remarks||'').trim()){scSheet.err='Remarks are required to short-close a balance';renderADTPage();return;}
  const pending=Number(txn.recon.pending||0);
  txn.recon.shortClosed=pending;
  txn.scr.lineStatus='Short-Closed';
  scLog(txn,'Receivable line short-closed — '+pending+' written off',txn.status,txn.status,
    {reasonSet:'RC-SHORT',reason:scReasonText('RC-SHORT',scSheet.reason),remarks:scSheet.remarks});
  scSheet=null;scSave();renderADTPage();
}
// -- FR17.5 / FR17.6 — the Stores entries that close out the issue side: what came back unused,
// and what was lost as scrap. Scrap carries its own reason, which is the gap the FRD flags. --
function scSetReconLine(i,k,v){
  const txn=scOpenTxn();if(!txn)return;
  const row=(txn.scr.issueItems||[])[i];if(!row)return;
  const prev=row[k];
  /* FR17.5 — "The system shall validate that the Return Quantity does not exceed the available
     unconsumed Issue Item balance." Nothing checked it, so a return larger than what was ever
     issued drove `outstanding` negative and the FR17.7 gate could never be satisfied. */
  if(k==='returnedQty'){
    const consumed=+(Number(txn.recon.received||txn.imr.receivedQty||0)*Number(row.ratio||0)).toFixed(3);
    const free=+Math.max(0,Number(row.qty||0)-consumed-Number(row.scrapQty||0)).toFixed(3);
    if(Number(v||0)>free){
      txn.recon.lineErr='Return quantity for '+row.item+' cannot exceed the unconsumed balance of '+free+'.';
      renderADTPage();return;
    }
  }
  delete txn.recon.lineErr;
  row[k]=v;
  // FR17.5 closes its on-receipt list with "the Activity Log shall be updated". These entries
  // move `outstanding`, which is what the closure gate reads, so they cannot go unrecorded.
  if(String(prev||'')!==String(v||''))
    scLog(txn,'Reconciliation updated — '+row.item+' · '+k,txn.status,txn.status,
      {oldValue:String(prev||0),newValue:String(v||0),
       reasonSet:k==='returnedQty'?'RC-BALRET':(k==='scrapQty'?'RC-SCRAP':''),
       reasonCode:(k==='returnedQty'?row.returnReason:row.scrapReason)||''});
  scSave();renderADTPage();
}
// -- Continue as: step into whoever the transaction is now pending with, without going through
// the persona menu. The persona switch is real — setActivePersona rebuilds the whole shell — so
// this is a shortcut into the same mechanism, not a second one. --
function scContinueAs(){
  const txn=scOpenTxn();if(!txn||!txn.pendingWith)return;
  const target=txn.pendingWith,keep=txn.id;
  setActivePersona(target);
  scOpenTxnId=keep;scForm={};scFormErrors={};scViewMode='web';
  navigatePage('sc-txn');
}
function scSetViewMode(m){scViewMode=m;renderADTPage();}
// -- The Journeys card's way in: the dashboard's Journeys tab, which is the actor's board. --
function scGoToJourneys(){
  if(typeof dashboardTab!=='undefined')dashboardTab='sc-journeys';
  scDashStepFilter=0;
  navigatePage('dashboard');
}

/* == SCR LINE ITEMS ======================================================================== */
function scSetRecv(k,v){
  const txn=scOpenTxn();if(!txn)return;
  scTouchScr();
  txn.scr[k]=v;
  if(k==='recvItem'){const it=scItem(v);if(it)txn.scr.recvUom=it.uom;}
  /* FR3.4 — BOM Ratio = Issue Qty ÷ Expected Receivable Qty. It was computed only when an issue
     row changed, so correcting the receivable quantity afterwards left every ratio stale — and
     that stale ratio is what drives consumption at reconciliation. Recompute the whole set. */
  if(k==='recvQty'){
    const recv=Number(v||0);
    (txn.scr.issueItems||[]).forEach(function(r){
      r.ratio=(recv>0&&Number(r.qty)>0)?(Number(r.qty)/recv).toFixed(3):'';
    });
  }
  scSave();renderADTPage();
}
function scAddIssueItem(){
  const txn=scOpenTxn();if(!txn)return;
  scTouchScr();
  txn.scr.issueItems=txn.scr.issueItems||[];
  txn.scr.issueItems.push({item:'',qty:'',warehouse:'',location:'',zone:'',fim:txn.scr.fim||'No',ratio:''});
  scSave();renderADTPage();
}
function scSetIssue(i,k,v){
  const txn=scOpenTxn();if(!txn)return;
  scTouchScr();          // FR2.7 — fixing the issue item is the commonest correction after a return
  const row=(txn.scr.issueItems||[])[i];if(!row)return;
  row[k]=v;
  if(k==='warehouse')row.location='';
  /* FR1.6 — three columns the FRD marks as system-derived and that nothing was deriving:
       Tax Code               "Read-only / Auto-populated … Derived from applicable configuration"
       WIP Adjustment Required "Read-only Yes / No | System | Indicates whether WIP stock
                                adjustment is required"
       Storage Zone            "Default from Sub-Contracting configuration"
     The masters for all three already existed and simply had no consumer. */
  if(k==='item'){
    const it=scItem(v);
    row.tax=it?(it.tax||''):'';
    row.wipAdjust=(txn.scr.base==='Production Order'&&it&&/WIP/i.test(it.kind||''))?'Yes':'No';
    if(row.wipAdjust==='No')row.adjustmentOrder='';
  }
  if((k==='warehouse'||k==='location')&&!row.zone){
    const z=(scMaster.zones||[]).find(function(x){return x.warehouse===row.warehouse;});
    if(z)row.zone=z.code||z.name||'';
  }
  // BOM ratio = issue qty ÷ expected receivable qty (FR3.4).
  const recv=Number(txn.scr.recvQty||0);
  if(recv>0&&Number(row.qty)>0)row.ratio=(Number(row.qty)/recv).toFixed(3);
  scSave();renderADTPage();
}
function scRemoveIssue(i){
  const txn=scOpenTxn();if(!txn)return;
  scSheet={action:'remove-issue',idx:i,reason:'',remarks:''};
  renderADTPage();
}
function scConfirmRemoveIssue(){
  const txn=scOpenTxn();if(!txn||!scSheet)return;
  if(!scSheet.reason&&scReasonSet('RC-REMOVAL').values.length){scSheet.err='Select a reason';renderADTPage();return;}
  const row=(txn.scr.issueItems||[])[scSheet.idx];
  txn.scr.issueItems.splice(scSheet.idx,1);
  scLog(txn,'Issue item removed'+(row?' — '+(scItem(row.item)||{name:row.item}).name:''),txn.status,txn.status,
    {reasonSet:'RC-REMOVAL',reason:scSheet.reason,remarks:scSheet.remarks});
  scSheet=null;scSave();renderADTPage();
}

/* ==========================================================================================
   SCREENS
   ========================================================================================== */
function scEsc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function scStatusTone(s){
  s=String(s||'').toLowerCase();
  if(/approved|cleared|confirmed|closed|released/.test(s))return 'green';
  if(/sent for approval|generated|in progress|created|draft/.test(s))return 'blue';
  if(/returned|modified|pending/.test(s))return 'amber';
  if(/rejected/.test(s))return 'red';
  return 'grey';
}
function scChip(text,tone){return '<span class="sc-chip sc-'+(tone||'grey')+'">'+scEsc(text)+'</span>';}

/* -- THE TILE ROW. Eighteen steps in one horizontally scrolling row, as chosen. A tile the
   active role owns is live and clickable; every other tile is inert and shows how many of THIS
   role's own transactions are sitting there — which is what makes the row a progress map of
   your own work rather than a diagram of the process. -- */
function buildScTilesHTML(){
  const me=activePersonaId;
  return '<div class="sc-tiles-wrap"><div class="sc-tiles">'
    +SC_SHOWN_STEPS.map(function(st){
      const mine=scActorOwnsStep(me,st.no);
      const count=scMyAtStep(me,st.no).length;
      const actionable=mine?scActionable(me).filter(function(t){return t.step===st.no;}).length:0;
      const on=scDashStepFilter===st.no;
      const ph=SC_PHASES[st.phase];
      return '<button type="button" class="sc-tile'+(mine?'':' sc-tile-off')+(on?' sc-tile-on':'')+'"'
        +(mine?' onclick="scDashFilter('+st.no+')"':'')
        +' title="'+scEsc(st.no+'. '+st.name+' — '+scActorLabel(st.actors[0])+(mine?'':' (not your step)'))+'">'
        +'<span class="sc-tile-no" style="color:'+ph.color+'">'+st.no+'</span>'
        +'<span class="sc-tile-val">'+(mine?actionable:count)+'</span>'
        +'<span class="sc-tile-lbl">'+scEsc(st.short)+'</span>'
        +(mine?'':'<span class="sc-tile-owner">'+scEsc(scActorLabel(st.actors[0]))+'</span>')
        +'</button>';
    }).join('')
    +'</div></div>';
}
function scDashFilter(no){scDashStepFilter=(scDashStepFilter===no?0:no);renderADTPage();}
function scDashClear(){scDashStepFilter=0;renderADTPage();}
function scDashToggleClosed(){scDashClosed=!scDashClosed;scDashStepFilter=0;renderADTPage();}

function buildScDashboardHTML(){
  scSeed();
  const me=activePersonaId,actor=scActor(me);
  if(!actor)return '<div class="ai-exec-page"><div class="ep-form-card" style="padding:28px;text-align:center;color:var(--gray)">Switch to a Sub-Contracting role to see this board.</div></div>';
  /* NEWEST AND MOST URGENT AT THE TOP. Array order is creation order, so a transaction you just
     raised appeared at the BOTTOM of a twelve-row table — the one place you would not look for
     it. Two keys: what is waiting on you comes first, then most recently touched, so a request
     you have only just created is the first row on the board. */
  const stamp=function(t){
    const a=t.pendingSince?new Date(t.pendingSince).getTime():0;
    const b=t.createdIso?new Date(t.createdIso).getTime():0;
    return Math.max(a,b);
  };
  /* FR2.9 requires a rejected SCR to be "retained for audit and reporting", and FR18 closes
     transactions rather than deleting them — but this board was the only way into a transaction
     and it hard-filtered every closed record out, so a rejected or closed SCR became unreachable
     the moment it terminated. The data was always there; nothing could open it. */
  const all=scMyTxns(me).filter(function(t){return scDashClosed?!!t.closed:!t.closed;}).slice().sort(function(x,y){
    const mineX=x.pendingWith===me?0:1,mineY=y.pendingWith===me?0:1;
    if(mineX!==mineY)return mineX-mineY;
    return stamp(y)-stamp(x);
  });
  const list=scDashStepFilter?all.filter(function(t){return t.step===scDashStepFilter;}):all;
  const mine=scActionable(me);
  /* THE TABLE CHANGES SHAPE WITH THE FILTER. Unfiltered it is the cross-journey view the
     reference dashboard shows — Reference / Vendor / Material / Stage / Value / Pending since.
     Filtered to a step it becomes that step's own document listing, with the columns the FRD
     specifies for it, because a Stores user filtered to Goods Issue wants the outbound key and
     the warehouse, not the PO value. One table, two jobs, no second page to maintain. */
  const doc=scDashStepFilter?scStep(scDashStepFilter).doc:'';
  const COLS={
    scr:['SCR No.','Title','Vendor','Nature','SCR Status','Pending with','Pending since'],
    po:['PO No.','Against SCR','Vendor','Buyer','PO Value','PO Status','Pending with','Pending since'],
    shipment:['Shipment No.','SCR / PO','Outbound Key','Material position','Shipment Status','Pending with','Pending since'],
    dn:['DN No.','Shipment','Vendor','DN Status','Approver','Pending since'],
    challan:['Challan No.','DN / Shipment','Vendor','Vehicle','Challan Status','Pending with','Pending since'],
    asn:['ASN No.','Against PO','Vendor','Qty Ready','Docs','ASN Status','Pending since'],
    imr:['IMR No.','Against ASN','Receivable Item','Expected','Received','IMR Status','Pending since'],
    recon:['SCR No.','Vendor','Pending Receivable','Outstanding Issue','Status','Pending since']
  };
  const headers=doc&&COLS[doc]?COLS[doc]:['Reference','Vendor','Material','Stage','Value','Pending since'];
  const cell=function(t){
    const st=scStep(t.step),v=scVendor(t.scr.vendor),item=scItem(t.scr.recvItem);
    const vend=scEsc(v?v.name:(t.scr.internalBP?'Internal BP':'—'));
    const value=t.po.price&&t.scr.recvQty?scMoney(Number(t.po.price)*Number(t.scr.recvQty)):(t.scr.billable==='No'?'Non-billable':'—');
    const stat=function(d){const s=scDocStatus(t,d);return s?scChip(s,scStatusTone(s)):'<span class="sc-dim">—</span>';};
    const pend='<td>'+scPendingWithHTML(t.pendingWith)+'</td>';
    const since='<td>'+scSince(t.pendingSince)+(scOverdue(t)?'<div class="sc-sub" style="color:#b91c1c">Overdue</div>':'')+'</td>';
    if(doc==='scr')return '<td><div class="sc-ref">'+scEsc(t.no||'Draft')+'</div></td><td>'+scEsc(t.scr.title||'—')+'</td><td>'+vend+'</td><td>'+scEsc(t.scr.nature||'—')+'</td><td>'+stat('scr')+'</td>'+pend+since;
    if(doc==='po')return '<td><div class="sc-ref">'+scEsc(t.po.no||'—')+'</div></td><td>'+scEsc(t.no)+'</td><td>'+vend+'</td><td>'+scEsc(scActorLabel('buyer'))+'</td><td>'+value+'</td><td>'+stat('po')+'</td>'+pend+since;
    if(doc==='shipment')return '<td><div class="sc-ref">'+scEsc(t.shipment.no||'—')+'</div></td><td>'+scEsc(t.no)+'<div class="sc-sub">'+scEsc(t.po.no||'')+'</div></td><td>'+scEsc(t.shipment.outboundKey||'—')+'</td><td>'+scChip(t.position||'Main','blue')+'</td><td>'+stat('shipment')+'</td>'+pend+since;
    if(doc==='dn')return '<td><div class="sc-ref">'+scEsc(t.dn.no||'—')+'</div></td><td>'+scEsc(t.shipment.no||'—')+'</td><td>'+vend+'</td><td>'+stat('dn')+'</td><td>'+scEsc(scActorLabel('dn-approver'))+'</td>'+since;
    if(doc==='challan')return '<td><div class="sc-ref">'+scEsc(t.challan.no||'—')+'</div></td><td>'+scEsc(t.dn.no||'—')+'<div class="sc-sub">'+scEsc(t.shipment.no||'')+'</div></td><td>'+vend+'</td><td>'+scEsc(t.shipment.vehicle||'—')+'</td><td>'+stat('challan')+'</td>'+pend+since;
    if(doc==='asn')return '<td><div class="sc-ref">'+scEsc(t.asn.no||'—')+'</div></td><td>'+scEsc(t.po.no||'—')+'</td><td>'+vend+'</td><td>'+scEsc(t.asn.qtyReady||'—')+'</td><td>'+((t.asn.docs||[]).length||0)+'</td><td>'+stat('asn')+'</td>'+since;
    if(doc==='imr')return '<td><div class="sc-ref">'+scEsc(t.imr.no||'—')+'</div></td><td>'+scEsc(t.asn.no||'—')+'</td><td>'+scEsc(item?item.name:'—')+'</td><td>'+scEsc(t.scr.recvQty||'—')+'</td><td>'+scEsc(t.imr.receivedQty||'—')+'</td><td>'+stat('imr')+'</td>'+since;
    if(doc==='recon'){const r=scComputeRecon(t);return '<td><div class="sc-ref">'+scEsc(t.no)+'</div></td><td>'+vend+'</td><td>'+scChip(r.pending+' pending',r.pending?'amber':'green')+'</td><td>'+scChip(r.outstanding+' outstanding',r.outstanding?'amber':'green')+'</td><td>'+stat('recon')+'</td>'+since;}
    return '<td><div class="sc-ref">'+scEsc(t.no||'Draft')+'</div><div class="sc-sub">'+scEsc(t.scr.title||'Untitled request')+'</div></td>'
      +'<td>'+vend+'</td><td>'+scEsc(item?item.name:'—')+'</td>'
      +'<td>'+scChip(st.no+'. '+st.short,t.pendingWith===me?scStatusTone(t.status):'grey')
        +'<div class="sc-sub">'+scPendingWithHTML(t.pendingWith)+'</div></td>'
      +'<td>'+value+'</td>'+since;
  };
  /* JUST ARRIVED. Sorting a new item to the top is half the job — you still have to spot it
     among eleven similar rows. Anything that landed in this actor's queue within the last ten
     minutes is marked, so switching personas and finding the request you just raised is a
     glance rather than a read. Ten minutes because that is about the span of a demo handoff. */
  const isNew=function(t){
    const ms=Date.now()-new Date(t.pendingSince||t.createdIso||0).getTime();
    return ms>=0&&ms<600000;
  };
  const rows=list.length?list.map(function(t){
    const fresh=isNew(t)&&t.pendingWith===me;
    return '<tr class="'+(t.pendingWith===me?'sc-row-mine':'')+(fresh?' sc-row-new':'')+'" onclick="scOpen(\''+t.id+'\')">'
      +cell(t).replace('<td>','<td>'+(fresh?'<span class="sc-new">New</span>':''))+'</tr>';
  }).join('')
   :'<tr><td colspan="'+headers.length+'" style="text-align:center;color:var(--gray);padding:26px">'
     +(scDashStepFilter?'Nothing of yours is sitting at this step.':'Nothing assigned to you yet.')+'</td></tr>';
  const stepName=scDashStepFilter?scStep(scDashStepFilter).name:'';
  /* A silent storage failure is the worst outcome for a journey sold as persistent: the user
     keeps working and loses everything at the next reload. Both failure modes say so here, and
     the unreadable-payload one offers the only safe way out — a deliberate reset. */
  const banner=scLoadFailed
    ? '<div class="sc-store-warn"><b>Saved work could not be read.</b> The browser is holding data from a different '
      +'version of this journey. It has been left untouched — nothing has been overwritten. '
      +'<button class="cfg-cat-clear" onclick="scReset()">Start fresh</button></div>'
    : (scSaveFailed
      ? '<div class="sc-store-warn"><b>Changes are not being saved.</b> This browser is blocking local storage '
        +'(a private window, or storage is full). The journey will work, but it will not survive a reload.</div>'
      : '');
  return '<div class="ai-exec-page sc-page">'
    +banner
    +'<div class="sc-dash-head">'
      +'<div><p class="sc-h1">'+scEsc(actor.name)+' <span class="sc-role">'+scEsc(actor.label.toUpperCase())+'</span></p>'
      +'<p class="sc-h2">'+(scDashClosed
        ?all.length+' closed or rejected transaction'+(all.length===1?'':'s')+', retained for audit. Open one to read its record and activity log.'
        :'You are looking after '+all.length+' piece'+(all.length===1?'':'s')+' of work'
          +(mine.length?', '+mine.length+' waiting on you.':'. Nothing is waiting on you right now.'))+'</p></div>'
      +'<div style="display:flex;gap:8px;align-items:center">'
      +'<button class="btn btn-secondary btn-sm" onclick="scDashToggleClosed()">'
        +(scDashClosed?'← Open transactions':'Closed / Rejected')+'</button>'
      +(scActorOwnsStep(me,1)&&!scDashClosed?'<button class="btn btn-primary btn-sm" onclick="scStartNew()">+ New SCR</button>':'')
      +'</div>'
    +'</div>'
    +buildScTilesHTML()
    +(scDashStepFilter?'<div class="sc-filter-note">Showing <b>'+scEsc(stepName)+'</b> only <button class="cfg-cat-clear" onclick="scDashClear()">Clear</button></div>'
      :'<div class="sc-filter-note sc-dim">Your steps are live — click one to filter. Grey steps belong to another role and show where your work is parked.</div>')
    +'<div class="listing-card"><table class="lp-table sc-table" style="min-width:'+(headers.length>6?940:820)+'px"><thead><tr>'
      +headers.map(function(h){return '<th>'+scEsc(h)+'</th>';}).join('')
      +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'</div>';
}

/* -- FIELD RENDERER. One function for every input type the forms use. Errors render under the
   field they belong to; `help` renders as the conditional-rule hint the wireframes carry. -- */
function scRenderField(f,txn,step){
  const val=scFieldVal(txn,step,f.id);
  const err=scFormErrors[f.id];
  const lbl='<label class="ep-form-label">'+scEsc(f.label)+(f.req?' <span class="req">*</span>':'')+'</label>';
  const set=function(expr){return 'scSetField(\''+f.id+'\','+expr+')';};
  let ctl='';
  if(f.type==='ro'){
    const v=typeof f.val==='function'?f.val(scLiveForm(txn,step),txn):val;
    ctl='<div class="sc-ro">'+scEsc(v)+'</div>';
  }else if(f.type==='select'||f.type==='reason'){
    const opts=f.type==='reason'?scReasonSet(f.set).values.map(function(v){return{v:v.code,t:v.code+' · '+v.text};})
      :(typeof f.opts==='function'?f.opts(scLiveForm(txn,step),txn):(f.opts||[]));
    ctl='<select class="ep-form-select'+(err?' sc-err':'')+'" onchange="'+set('this.value')+'">'
      +'<option value="">'+(opts.length?'Select…':'No values available')+'</option>'
      +opts.map(function(o){return '<option value="'+scEsc(o.v)+'"'+(String(val)===String(o.v)?' selected':'')+'>'+scEsc(o.t)+'</option>';}).join('')
      +'</select>';
  }else if(f.type==='yesno'){
    ctl='<div class="sc-yesno">'
      +['Yes','No'].map(function(o){
        return '<label class="sc-radio'+(String(val)===o?' on':'')+'"><input type="radio" '+(String(val)===o?'checked':'')
          +' onchange="'+set('\''+o+'\'')+'"><span>'+o+'</span></label>';}).join('')
      +'</div>';
  }else if(f.type==='textarea'){
    // `onchange`, routed through scSetField like every other control — writing straight into
    // scForm on `oninput` skipped scTouchScr (so editing Remarks on a returned SCR never marked
    // it Modified) and skipped the error clear, leaving the red state after a fix.
    ctl='<textarea class="ep-form-input'+(err?' sc-err':'')+'" rows="3" placeholder="'+scEsc(f.ph||'')+'"'
      +' oninput="scForm[\''+f.id+'\']=this.value" onchange="'+set('this.value')+'">'+scEsc(val)+'</textarea>';
  }else{
    const t=f.type==='num'?'number':f.type==='date'?'date':'text';
    ctl='<input class="ep-form-input'+(err?' sc-err':'')+'" type="'+t+'" value="'+scEsc(val)+'" placeholder="'+scEsc(f.ph||'')+'"'
      +' onchange="'+set('this.value')+'">';
  }
  return '<div class="ep-form-group sc-field">'+lbl+ctl
    +(err?'<div class="sc-err-msg">'+scEsc(err)+'</div>':(f.help?'<div class="sc-help">'+scEsc(f.help)+'</div>':''))
    +'</div>';
}
function scFormHTML(txn,step){
  return scVisibleFields(step,txn).map(function(sec){
    return '<div class="sc-sec"><div class="sc-sec-h">'+scEsc(sec.section)+'</div>'
      +'<div class="sc-grid">'+sec.fields.map(function(f){return scRenderField(f,txn,step);}).join('')+'</div></div>';
  }).join('');
}

/* -- SCR ITEM EDITORS. The receivable line and the issue-item table, which are the only parts
   of the SCR that are not flat fields. Kept out of SC_FORMS because they are rows, not
   fields, and the BOM ratio is derived on every change rather than typed. -- */
function scItemsHTML(txn){
  const s=txn.scr,recvOpts=scMaster.items.filter(function(i){return i.receivable;});
  const recvIt=scItem(s.recvItem);
  const warehouses=scMaster.warehouses;
  const err=scFormErrors;
  const recv='<div class="sc-sec"><div class="sc-sec-h">Receivable Item</div><div class="sc-grid">'
    +'<div class="ep-form-group sc-field"><label class="ep-form-label">Receivable Item <span class="req">*</span></label>'
      +'<select class="ep-form-select'+(err.recvItem?' sc-err':'')+'" onchange="scSetRecv(\'recvItem\',this.value)"><option value="">Select…</option>'
      +recvOpts.map(function(i){return '<option value="'+i.code+'"'+(s.recvItem===i.code?' selected':'')+'>'+scEsc(i.code+' · '+i.name)+'</option>';}).join('')
      +'</select>'+(err.recvItem?'<div class="sc-err-msg">'+err.recvItem+'</div>':'')+'</div>'
    +'<div class="ep-form-group sc-field"><label class="ep-form-label">Item Type</label><div class="sc-ro">'+scEsc(recvIt?recvIt.kind:'—')+'</div></div>'
    +'<div class="ep-form-group sc-field"><label class="ep-form-label">Expected Receivable Qty <span class="req">*</span></label>'
      +'<input class="ep-form-input" type="number" value="'+scEsc(s.recvQty||'')+'" onchange="scSetRecv(\'recvQty\',this.value)"></div>'
    +'<div class="ep-form-group sc-field"><label class="ep-form-label">Receivable UOM</label><div class="sc-ro">'+scEsc(recvIt?recvIt.uom:'—')+'</div></div>'
    +'<div class="ep-form-group sc-field"><label class="ep-form-label">Receiving Warehouse <span class="req">*</span></label>'
      +'<select class="ep-form-select" onchange="scSetRecv(\'recvWarehouse\',this.value)"><option value="">Select…</option>'
      +warehouses.map(function(w){return '<option value="'+w.code+'"'+(s.recvWarehouse===w.code?' selected':'')+'>'+scEsc(w.name)+'</option>';}).join('')+'</select></div>'
    +'<div class="ep-form-group sc-field"><label class="ep-form-label">HSN Code</label><div class="sc-ro">'+scEsc(recvIt?recvIt.hsn:'—')+'</div></div>'
    +'<div class="ep-form-group sc-field"><label class="ep-form-label">Expected Receipt Date <span class="req">*</span></label>'
      +'<input class="ep-form-input" type="date" value="'+scEsc(s.recvDate||'')+'" onchange="scSetRecv(\'recvDate\',this.value)"></div>'
    +'<div class="ep-form-group sc-field"><label class="ep-form-label">Line Status</label><div class="sc-ro">'+scEsc(s.lineStatus||'Open')+'</div></div>'
    +'</div></div>';
  const rows=(s.issueItems||[]).map(function(r,i){
    const it=scItem(r.item),wh=scWarehouse(r.warehouse);
    return '<tr>'+'<td>'+(i+1)+'</td>'
      +'<td><select class="ep-form-select" onchange="scSetIssue('+i+',\'item\',this.value)"><option value="">Select…</option>'
        +scMaster.items.filter(function(x){return !x.receivable;}).map(function(x){return '<option value="'+x.code+'"'+(r.item===x.code?' selected':'')+'>'+scEsc(x.code)+'</option>';}).join('')+'</select>'
        +'<div class="sc-sub">'+scEsc(it?it.name:'')+'</div></td>'
      +'<td>'+scEsc(it?it.kind:'—')+'</td>'
      +'<td><input class="ep-form-input" type="number" style="width:88px" value="'+scEsc(r.qty)+'" onchange="scSetIssue('+i+',\'qty\',this.value)"></td>'
      +'<td>'+scEsc(it?it.uom:'—')+'</td>'
      +'<td><select class="ep-form-select" onchange="scSetIssue('+i+',\'warehouse\',this.value)"><option value="">…</option>'
        +scMaster.warehouses.map(function(w){return '<option value="'+w.code+'"'+(r.warehouse===w.code?' selected':'')+'>'+scEsc(w.code)+'</option>';}).join('')+'</select></td>'
      +'<td><select class="ep-form-select" onchange="scSetIssue('+i+',\'location\',this.value)"><option value="">…</option>'
        +((wh&&wh.locations)||[]).map(function(l){return '<option value="'+l.code+'"'+(r.location===l.code?' selected':'')+'>'+scEsc(l.code)+'</option>';}).join('')+'</select></td>'
      +'<td>'+scEsc(r.zone||'—')+'</td>'
      +'<td>'+scEsc(r.ratio||'—')+'</td>'
      +'<td>'+scEsc(r.tax||(it?it.tax:'')||'—')+'</td>'
      // FR1.6 — WIP Adjustment Required is system-derived; the Adjustment Order Reference beside
      // it is mandatory whenever it reads Yes, which is what blocks FR7.3's shipment submission.
      +'<td>'+(r.wipAdjust==='Yes'?scChip('Yes','amber'):'<span class="sc-dim">No</span>')+'</td>'
      +'<td>'+(r.wipAdjust==='Yes'
        ?'<input class="ep-form-input" style="width:120px" placeholder="Adj. order ref." value="'+scEsc(r.adjustmentOrder||'')+'" onchange="scSetIssue('+i+',\'adjustmentOrder\',this.value)">'
        :'<span class="sc-dim">—</span>')+'</td>'
      +'<td>'+scEsc(it?it.hsn:'—')+'</td>'
      +'<td><button class="ep-cancel-btn" style="padding:3px 8px" onclick="scRemoveIssue('+i+')">Remove</button></td></tr>';
  }).join('');
  const issue='<div class="sc-sec"><div class="sc-sec-h">Issue Item Details</div>'
    +(err.issueItems?'<div class="sc-err-msg" style="margin-bottom:8px">'+scEsc(err.issueItems)+'</div>':'')
    +'<div class="listing-card" style="margin-bottom:10px"><table class="lp-table sc-table" style="min-width:1180px"><thead><tr>'
    +'<th>#</th><th>Issue Item</th><th>Type</th><th>Qty</th><th>UOM</th><th>Warehouse</th><th>Storage Loc.</th><th>Zone</th>'
    +'<th>BOM Ratio</th><th>Tax Code</th><th>WIP Adj.</th><th>Adj. Order Ref.</th><th>HSN</th><th></th>'
    +'</tr></thead><tbody>'+(rows||'<tr><td colspan="14" style="color:var(--gray);text-align:center;padding:16px">No issue items yet.</td></tr>')+'</tbody></table></div>'
    +'<button class="btn btn-secondary btn-sm" onclick="scAddIssueItem()">+ Add Issue Item</button>'
    +'<div class="sc-help" style="margin-top:8px">BOM ratio is derived as issue quantity ÷ expected receivable quantity.</div>'
    +'</div>';
  return recv+issue;
}

/* -- READ-ONLY SUMMARY. What a checker sees. Built from whatever the transaction actually has,
   so the same function serves step 2 (SCR only) and step 17 (every document) without a branch
   per step: a section renders when its document has been created and stays silent before. -- */
function scRow(l,v){return '<div class="sc-kv"><span>'+scEsc(l)+'</span><b>'+(v==null||v===''?'—':v)+'</b></div>';}
/* -- THE DOCUMENT TRAIL. Every document the transaction has produced, each with its OWN status,
   which is the thing a single `status` field could never show: at closure this reads SCR Closed,
   PO Closed, Shipment Closed, Challan Closed — while the Delivery Note is still Approved, the
   ASN still QC Cleared and the IMR still Confirmed, exactly as FR18.3 requires. -- */
function scDocsHTML(txn){
  // Which of these can be opened as an actual document rather than just a row in a list.
  const viewable={dn:'dn',challan:'challan',imr:'imr'};
  const rows=[['scr',txn.no],['po',txn.po.no],['shipment',txn.shipment.no],['dn',txn.dn.no],
    ['challan',txn.challan.no],['asn',txn.asn.no],['imr',txn.imr.no]]
    .filter(function(p){return p[1];})
    .map(function(p){
      const st=scDocStatus(txn,p[0]);
      return '<tr><td>'+scEsc(SC_DOC_LABELS[p[0]])+'</td><td><b>'+scEsc(p[1])+'</b></td>'
        +'<td>'+(st?scChip(st,scStatusTone(st)):'<span class="sc-dim">—</span>')+'</td>'
        +'<td>'+(viewable[p[0]]?'<button class="sc-doc-view" onclick="scOpenDoc(\''+viewable[p[0]]+'\')">View</button>':'')+'</td></tr>';
    }).join('');
  if(!rows)return '';
  const ok=txn.shipment.outboundKey
    ?'<tr><td>Outbound Key</td><td><b>'+scEsc(txn.shipment.outboundKey)+'</b></td>'
      +'<td>'+scChip('Generated','green')+'</td>'
      +'<td><button class="sc-doc-view" onclick="scOpenDoc(\'outbound\')">View</button></td></tr>':'';
  return '<div class="sc-sec"><div class="sc-sec-h">Documents</div>'
    +scPanelTable(['Document','Number','Status',''],rows+ok,420)
    +'<div class="sc-kv-grid">'+scRow('Material position',scChip(txn.position||'Main','blue'))
      +scRow('Receivable line status',scChip(scLineStatus(txn),scStatusTone(scLineStatus(txn))))
      +(txn.shipment.expectedReturn?scRow('Expected date of return',scEsc(txn.shipment.expectedReturn)+(scOverdue(txn)?' '+scChip('Overdue','red'):'')):'')
    +'</div></div>';
}
function scSummaryHTML(txn){
  const s=txn.scr,v=scVendor(s.vendor),recvIt=scItem(s.recvItem),po=scProdOrder(s.prodOrder),pr=scProject(s.project);
  let h=scDocsHTML(txn);
  h+='<div class="sc-sec"><div class="sc-sec-h">SCR Header</div><div class="sc-kv-grid">'
    +scRow('SCR No.',scEsc(txn.no||'—'))+scRow('SCR Status',scChip(txn.status,scStatusTone(txn.status)))
    +scRow('Created On',scEsc(txn.createdAt))+scRow('Created By',scEsc(scActorLabel(txn.createdBy)))
    +scRow('Location',scEsc((scMaster.locations.find(function(l){return l.code===s.location;})||{}).name))
    +scRow('SCR Title',scEsc(s.title))+scRow('SCR Base',scEsc(s.base))+scRow('Nature of SCR',scEsc(s.nature))
    +scRow('Purchase Office',scEsc((scMaster.purchaseOffices.find(function(p){return p.code===s.purchaseOffice;})||{}).name))
    +scRow('Buyer',scEsc(s.buyer?scActor(s.buyer).name:''))
    +'</div>'
    +'<div class="sc-flags">'+[['Inter-Unit',s.interUnit],['Partial Material as FIM',s.fim],['Billable',s.billable],
      ['Logistics Required',s.logistics],['Rate Contract',s.rateContract?'Yes':'No'],['SCR Unpeg',s.unpeg]]
      .map(function(f){return '<div class="sc-flag"><span>'+f[0]+'</span><b>'+scEsc(f[1]||'No')+'</b></div>';}).join('')+'</div>'
    +(s.billable==='No'?'<div class="sc-kv-grid">'+scRow('Reason for Non-Billable',scEsc(scReasonText('RC-NONBILL',s.nonBillReason)))+'</div>':'')
    +(s.remarks?'<div class="sc-kv-grid">'+scRow('Remarks',scEsc(s.remarks))+'</div>':'')
    +'</div>';
  h+='<div class="sc-sec"><div class="sc-sec-h">'+(s.base==='Project'?'Project':'Production Order')+'</div><div class="sc-kv-grid">'
    +(s.base==='Project'
      ?scRow('Project',scEsc(pr?pr.code+' · '+pr.name:''))+scRow('Project Element',scEsc(s.projectElement))+scRow('Activity / Cost Object',scEsc(s.activity))
      :scRow('Production Order',scEsc(s.prodOrder))+scRow('Work Description',scEsc(po?po.description:''))
       +scRow('Order Quantity',scEsc(po?po.qty+' '+po.uom:''))+scRow('Start → End',scEsc(po?po.start+' → '+po.end:''))
       +scRow('Status',scEsc(po?po.status:''))
       +scRow('Operation From → To',scEsc((s.opFrom||'—')+' → '+(s.opTo||'—')))
       +scRow('Operation by Subcontractor',scEsc(s.opDesc)))
    +'</div></div>';
  h+='<div class="sc-sec"><div class="sc-sec-h">Vendor</div><div class="sc-kv-grid">'
    +(s.interUnit==='Yes'
      ?scRow('Internal Business Partner',scEsc((scMaster.internalBPs.find(function(b){return b.code===s.internalBP;})||{}).name))
      :scRow('Vendor / Subcontractor',scEsc(v?v.name:''))
       +scRow('Vendor Address',scEsc(v&&(v.addresses.find(function(a){return a.code===s.vendorAddress;})||{}).text)))
    +scRow('Required Skill / Service',scEsc(s.skill))+'</div></div>';
  h+='<div class="sc-sec"><div class="sc-sec-h">Items</div>'
    /* Quantities are summed PER UOM, never across them. FR1.7: "The Issue Item quantity and
       Receivable Item quantity shall not be directly compared where their UOMs are different."
       The panel used to add 1200 Kg to 600 Nos and print 1800 against a receivable of 1000 Nos —
       the one comparison the FRD forbids, on the screen an approver decides from. */
    +'<div class="sc-compare"><div class="sc-panel"><span>Issue to vendor</span>'
      +'<b>'+(function(){
        const byUom={};
        (s.issueItems||[]).forEach(function(r){const it=scItem(r.item),u=it?it.uom:'—';byUom[u]=(byUom[u]||0)+Number(r.qty||0);});
        const keys=Object.keys(byUom);
        return keys.length?keys.map(function(u){return byUom[u]+' '+scEsc(u);}).join('  ·  '):'—';
      })()+'</b>'
      +'<em>'+(s.issueItems||[]).length+' line'+((s.issueItems||[]).length===1?'':'s')+'</em></div>'
    +'<div class="sc-panel"><span>Expected receivable</span><b>'+scEsc(s.recvQty||'—')+' '+scEsc(recvIt?recvIt.uom:'')+'</b>'
      +'<em>'+scEsc(recvIt?recvIt.name:'—')+'</em></div></div>'
    +'<div class="listing-card"><table class="lp-table sc-table" style="min-width:640px"><thead><tr>'
    +'<th>#</th><th>Issue Item</th><th>Qty</th><th>UOM</th><th>Warehouse</th><th>Storage Loc.</th><th>BOM Ratio</th></tr></thead><tbody>'
    +((s.issueItems||[]).map(function(r,i){const it=scItem(r.item);
      return '<tr><td>'+(i+1)+'</td><td><b>'+scEsc(r.item)+'</b><div class="sc-sub">'+scEsc(it?it.name:'')+'</div></td>'
        +'<td>'+scEsc(r.qty)+'</td><td>'+scEsc(it?it.uom:'')+'</td><td>'+scEsc(r.warehouse)+'</td><td>'+scEsc(r.location)+'</td><td>'+scEsc(r.ratio||'—')+'</td></tr>';
    }).join('')||'<tr><td colspan="7" style="color:var(--gray);text-align:center;padding:14px">No issue items.</td></tr>')
    +'</tbody></table></div></div>';
  if(txn.po&&txn.po.no){
    h+='<div class="sc-sec"><div class="sc-sec-h">Purchase Order</div><div class="sc-kv-grid">'
      +scRow('PO No.',scEsc(txn.po.no))+scRow('Order Type','SUB')+scRow('Tax Code',scEsc(txn.po.taxCode))
      +scRow('Rate Contract',scEsc(txn.po.rateContract))+scRow('Price / Unit',scEsc(txn.po.price))
      +scRow('Price Basis',scEsc(txn.po.basis))+scRow('Currency',scEsc(txn.po.currency))
      +scRow('Payment Terms',scEsc(txn.po.paymentTerms))
      // FR5.1 requires the approver to see "the complete PO information captured under FR4"; these
      // three are mandatory on the PO and were absent from the screen the approver decides on.
      +scRow('Purchase Office',scEsc((scMaster.purchaseOffices.find(function(p){return p.code===txn.po.purchaseOffice;})||{}).name||txn.po.purchaseOffice))
      +scRow('PO Series',scEsc(txn.po.poSeries))
      +scRow('Expected Receipt Date',scEsc(txn.po.expectedReceipt))
      +scRow('PO Value',s.billable==='No'?'0.00 — non-billable':scMoney(Number(txn.po.price||0)*Number(s.recvQty||0)))
      +scRow('Approved By',scEsc(txn.po.approvedBy?scActorLabel(txn.po.approvedBy)+' · '+(txn.po.approvedAt||''):(scDocStatus(txn,'po')==='Approved'?'System (zero value)':'Not yet approved')))
      +'</div></div>';
  }
  if(txn.shipment&&txn.shipment.no){
    h+='<div class="sc-sec"><div class="sc-sec-h">Shipment</div><div class="sc-kv-grid">'
      +scRow('Shipment No.',scEsc(txn.shipment.no))+scRow('Outbound Key',scEsc(txn.shipment.outboundKey))
      +scRow('Transfer Order',scEsc(txn.shipment.transferOrder))+scRow('Challan Type',scEsc(txn.shipment.challanType))
      +scRow('Expected Date of Return',scEsc(txn.shipment.expectedReturn))
      +scRow('Transporter',scEsc(txn.shipment.transporter))+scRow('Vehicle No.',scEsc(txn.shipment.vehicle))
      +scRow('Packages',scEsc(txn.shipment.packages))+'</div></div>';
  }
  if(txn.asn&&txn.asn.no){
    h+='<div class="sc-sec"><div class="sc-sec-h">Advance Shipping Notice</div><div class="sc-kv-grid">'
      +scRow('ASN No.',scEsc(txn.asn.no))+scRow('Quantity Ready',scEsc(txn.asn.qtyReady))
      +scRow('Expected Dispatch',scEsc(txn.asn.dispatchDate))
      // Bound to the real attachment store. `asn.inspectionDoc` was written nowhere in the file,
      // so this row rendered an em-dash for every transaction that ever existed.
      +scRow('Inspection Documents',(txn.asn.docs||[]).length
        ?scEsc((txn.asn.docs||[]).map(function(d){return d.name;}).join(', ')):'')
      +scRow('QC Cleared By',scEsc(txn.asn.clearedBy?scActorLabel(txn.asn.clearedBy)+' · '+(txn.asn.clearedAt||''):''))
      +'</div></div>';
  }
  if(txn.imr&&txn.imr.no){
    h+='<div class="sc-sec"><div class="sc-sec-h">Material Receipt</div><div class="sc-kv-grid">'
      +scRow('IMR No.',scEsc(txn.imr.no))+scRow('Received Quantity',scEsc(txn.imr.receivedQty))
      +scRow('Lot / Serial',scEsc(txn.imr.lot))+scRow('Receiving Location',scEsc(txn.imr.receivingLocation))
      +scRow('Received By',scEsc(txn.imr.receivedBy?scActorLabel(txn.imr.receivedBy):''))
      +scRow('Receipt Date-Time',scEsc(txn.imr.receiptAt))
      +scRow('Receivable Line Status',scChip(scLineStatus(txn),scStatusTone(scLineStatus(txn))))
      +'</div></div>';
  }
  if(txn.step>=17)h+=scReconHTML(txn);
  return h;
}
/* -- Reconciliation. The arithmetic is FR17.4 and FR17.6 verbatim: consumed = received × BOM
   ratio, outstanding = issued − consumed − returned − scrap. The gate under it is FR17.7 — and
   the mobile wireframe's own words for it: full receipt cannot be confirmed until pending is
   nil or short-closed. -- */
function scReconHTML(txn){
  // One implementation of the FR17.4/17.6 arithmetic. This function used to recompute it with
  // slightly different rounding to scComputeRecon, so the button (gated on one) and the warning
  // under it (rendered from the other) could disagree about whether the balance was clear.
  scComputeRecon(txn);
  const s=txn.scr,recvIt=scItem(s.recvItem);
  /* Fallback ZERO, not `expected`. Defaulting an unconfirmed IMR to the expected quantity made
     the reconciliation compute as though the full quantity had arrived: pending fell to 0,
     consumption netted out, and the FR17.7 gate passed — so Full Receipt and then Closure could
     both be confirmed on a transaction that had no IMR at all. Nothing received means nothing
     received, and the gate then does its job. */
  const expected=Number(s.recvQty||0),received=Number(txn.imr.receivedQty||0);
  txn.recon=txn.recon||{};
  const shortClosed=Number(txn.recon.shortClosed||0);
  const pending=Math.max(0,expected-received-shortClosed);
  // Editable only by the actor whose step this is, and only while it is still open.
  const edit=txn.step===17&&txn.pendingWith===activePersonaId&&!txn.closed;
  let issued=0,consumed=0,returned=0,scrap=0,scrapMissingReason=false;
  const rows=(s.issueItems||[]).map(function(r,i){
    const it=scItem(r.item),iq=Number(r.qty||0),ratio=Number(r.ratio||0);
    const cons=+(received*ratio).toFixed(3);
    const ret=Number(r.returnedQty||0),scr=Number(r.scrapQty||0);
    const out=+(iq-cons-ret-scr).toFixed(3);
    issued+=iq;consumed+=cons;returned+=ret;scrap+=scr;
    if(scr>0&&!r.scrapReason)scrapMissingReason=true;
    const num=function(k,v){
      return edit?'<input class="ep-form-input" type="number" style="width:86px" value="'+scEsc(v)+'" onchange="scSetReconLine('+i+',\''+k+'\',this.value)">':String(v);
    };
    // FR17.5 asks for a reason on returned material; the FRD's own review flags the missing
    // Scrap Reason and recommends RC-SCRAP whenever scrap > 0. Both are captured per line.
    const reasonCell=(edit&&(ret>0||scr>0))
      ?'<div class="sc-recon-reasons">'
        // FR17.5 marks Return Reason mandatory (a table row, not a review note), so it carries the
        // same error styling as the scrap reason, and the receiving storage location beside it is
        // mandatory too — returned material has to be booked back into somewhere.
        +(ret>0?'<select class="ep-form-select'+(r.returnReason?'':' sc-err')+'" onchange="scSetReconLine('+i+',\'returnReason\',this.value)"><option value="">Return reason…</option>'
          +scReasonSet('RC-BALRET').values.map(function(o){return '<option value="'+o.code+'"'+(r.returnReason===o.code?' selected':'')+'>'+scEsc(o.text)+'</option>';}).join('')+'</select>'
          +'<select class="ep-form-select'+(r.returnLocation?'':' sc-err')+'" onchange="scSetReconLine('+i+',\'returnLocation\',this.value)"><option value="">Receiving storage location…</option>'
          +(function(){const out=[];scMaster.warehouses.forEach(function(w){(w.locations||[]).forEach(function(l){
             out.push('<option value="'+w.code+'/'+l.code+'"'+(r.returnLocation===w.code+'/'+l.code?' selected':'')+'>'+scEsc(w.code+' / '+l.code)+'</option>');});});return out.join('');})()
          +'</select>':'')
        +(scr>0?'<select class="ep-form-select'+(r.scrapReason?'':' sc-err')+'" onchange="scSetReconLine('+i+',\'scrapReason\',this.value)"><option value="">Scrap reason…</option>'
          +scReasonSet('RC-SCRAP').values.map(function(o){return '<option value="'+o.code+'"'+(r.scrapReason===o.code?' selected':'')+'>'+scEsc(o.text)+'</option>';}).join('')+'</select>':'')
        +'</div>'
      :((r.returnReason||r.scrapReason)?'<div class="sc-sub">'
        +(r.returnReason?scEsc(scReasonText('RC-BALRET',r.returnReason)):'')
        +(r.scrapReason?'<br>'+scEsc(scReasonText('RC-SCRAP',r.scrapReason)):'')+'</div>':'—');
    return '<tr><td><b>'+scEsc(r.item)+'</b><div class="sc-sub">'+scEsc(it?it.name:'')+'</div></td>'
      +'<td>'+iq+'</td><td>'+(ratio||'—')+'</td><td>'+cons+'</td>'
      +'<td>'+num('returnedQty',ret)+'</td><td>'+num('scrapQty',scr)+'</td>'
      +'<td>'+reasonCell+'</td>'
      +'<td>'+scChip(out+' outstanding',out===0?'green':'amber')+'</td></tr>';
  }).join('');
  txn.recon.pending=pending;
  txn.recon.outstanding=+(issued-consumed-returned-scrap).toFixed(3);
  txn.recon.scrapMissingReason=scrapMissingReason;
  return '<div class="sc-sec"><div class="sc-sec-h">Reconciliation</div>'
    +'<div class="listing-card" style="margin-bottom:10px"><table class="lp-table sc-table"><thead><tr>'
      +'<th>Receivable Item</th><th>Expected (SCR)</th><th>Received (IMR)</th><th>Pending</th></tr></thead><tbody>'
      +'<tr><td><b>'+scEsc(s.recvItem)+'</b><div class="sc-sub">'+scEsc(recvIt?recvIt.name:'')+'</div></td>'
      +'<td>'+expected+'</td><td>'+received+'</td><td>'+scChip(pending+' pending',pending?'amber':'green')+'</td></tr>'
      +'</tbody></table></div>'
    +'<div class="listing-card" style="margin-bottom:10px"><table class="lp-table sc-table" style="min-width:860px"><thead><tr>'
      +'<th>Issue Item</th><th>Issued (GI)</th><th>BOM Ratio</th><th>Consumed</th><th>Returned</th><th>Scrap</th><th>Reason</th><th>Outstanding</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="sc-kv-grid">'+scRow('Total Issued',issued)+scRow('Total Consumed',consumed)
      +scRow('Total Pending Receivable',pending+(shortClosed?' <span class="sc-sub">('+shortClosed+' short-closed)</span>':''))
      +scRow('Total Outstanding Issue',txn.recon.outstanding)+'</div>'
    +'<div class="sc-help">Consumed is derived from confirmed received quantity at the BOM ratio. Outstanding = Issued − Consumed − Returned − Scrap.</div>'
    +(pending>0
      ?'<div class="sc-warn amber" style="margin-top:12px"><b>'+pending+' still pending receivable.</b> Full receipt cannot be confirmed until this is nil or short-closed with a reason.'
        +(edit?'<div style="margin-top:10px"><button class="sc-act sc-act-amber" onclick="scShortClose()">Short-close '+pending+' →</button></div>':'')
        +'</div>'
      :(shortClosed?'<div class="sc-warn blue" style="margin-top:12px"><b>'+shortClosed+' short-closed.</b> The receivable line is Short-Closed and full receipt can be confirmed.</div>':''))
    +(scrapMissingReason?'<div class="sc-warn red" style="margin-top:10px"><b>A scrap quantity has no reason.</b> FR18 requires scrap and process loss to be accounted for before closure — select a scrap reason on each line that has one.</div>':'')
    +(txn.recon.outstanding!==0?'<div class="sc-warn amber" style="margin-top:10px"><b>'+txn.recon.outstanding+' issue material outstanding.</b> Account for it as returned or scrap before confirming full receipt.</div>':'')
    +'</div>';
}
/* -- FR17.7 / FR18.1 — the closure gate, in one place so the button and the warning can never
   disagree. Returns an empty string when the step may proceed, or the reason it may not. -- */
/* The reconciliation figures, computed rather than read off the last render. scReconHTML used to
   be the only thing that set them, which made the gate depend on the summary having already been
   built — true by luck in the web layout and false on first paint. Both call this now. */
function scComputeRecon(txn){
  const s=txn.scr;
  txn.recon=txn.recon||{};
  /* Fallback ZERO, not `expected`. Defaulting an unconfirmed IMR to the expected quantity made
     the reconciliation compute as though the full quantity had arrived: pending fell to 0,
     consumption netted out, and the FR17.7 gate passed — so Full Receipt and then Closure could
     both be confirmed on a transaction that had no IMR at all. Nothing received means nothing
     received, and the gate then does its job. */
  const expected=Number(s.recvQty||0),received=Number(txn.imr.receivedQty||0);
  const shortClosed=Number(txn.recon.shortClosed||0);
  let issued=0,consumed=0,returned=0,scrap=0,missing=false,returnMissing=false,returnMissingLoc=false;
  (s.issueItems||[]).forEach(function(r){
    const iq=Number(r.qty||0),ratio=Number(r.ratio||0);
    issued+=iq;consumed+=+(received*ratio).toFixed(3);
    returned+=Number(r.returnedQty||0);scrap+=Number(r.scrapQty||0);
    if(Number(r.scrapQty||0)>0&&!r.scrapReason)missing=true;
    // FR17.5 — Return Quantity, Receiving Storage Location and Return Reason are all Mandatory.
    if(Number(r.returnedQty||0)>0){
      if(!r.returnReason)returnMissing=true;
      if(!r.returnLocation)returnMissingLoc=true;
    }
  });
  txn.recon.expected=expected;txn.recon.received=received;
  txn.recon.pending=Math.max(0,expected-received-shortClosed);
  txn.recon.issued=issued;txn.recon.consumed=+consumed.toFixed(3);
  txn.recon.returned=returned;txn.recon.scrap=scrap;
  txn.recon.outstanding=+(issued-consumed-returned-scrap).toFixed(3);
  txn.recon.scrapMissingReason=missing;
  txn.recon.returnMissingReason=returnMissing;
  txn.recon.returnMissingLocation=returnMissingLoc;
  return txn.recon;
}
function scGateBlock(txn){
  /* FR8.3 — "Reserved Quantity < Shipment Quantity → Goods Issue blocked". This was rendered as
     a chip and never enforced, so the release button could not fail the one check the FRD makes
     its gate. Enforced here, which is where scConfirmSheet consults before any forward action. */
  if(txn.step===7){
    const short=scShipLines(txn).filter(function(r){return scReservedFor(txn,r)<Number(r.qty||0);});
    if(short.length)return 'Reserved quantity is short for '+short.map(function(r){return r.item;}).join(', ')
      +'. FR8.3 blocks goods issue until reserved quantity equals shipment quantity.';
  }
  // FR14.4 — "Before clearance, the system shall validate: required inspection documents are
  // available". The screen already SAID this in red; nothing stopped Clear ASN.
  if(txn.step===14&&scInspectionRequired(txn)&&!((txn.asn.docs||[]).length))
    return 'Inspection is required for this item and no document is attached. Return the ASN to the vendor.';
  if(txn.step===17){
    scComputeRecon(txn);
    if(Number(txn.recon.pending||0)>0)return 'Pending receivable must be nil or short-closed before full receipt can be confirmed.';
    if(Number(txn.recon.outstanding||0)!==0)return 'All issue material must be accounted for — outstanding is '+txn.recon.outstanding+'.';
    if(txn.recon.scrapMissingReason)return 'Every scrap quantity needs a reason before full receipt can be confirmed.';
    // FR17.5 marks Return Reason and Receiving Storage Location mandatory in its field table —
    // only the scrap reason was ever checked, so a return could be booked with neither.
    if(txn.recon.returnMissingReason)return 'Every returned issue quantity needs a return reason before full receipt can be confirmed.';
    if(txn.recon.returnMissingLocation)return 'Every returned issue quantity needs a receiving storage location.';
  }
  return '';
}
/* ==========================================================================================
   STEP PANELS — the FRD content each step owns
   ==========================================================================================
   The generic renderer gives every step a form or a review. These add what the document
   specifies for one step and nowhere else: the availability check, the pick list, the two
   printed documents, the gate verification table. One function per step, dispatched by number,
   so a step's own rules read in one place instead of as branches inside the shared builders. */
/* == AVAILABILITY AND RESERVATION ==========================================================
   FR6.4 requires a reservation to actually "reduce the material quantity available for other
   transactions" and "prevent the same stock from being allocated to another SCR / Shipment".
   Moving a position string did neither: two shipments drawing on the same bin both saw the full
   free quantity and both reserved it.

   Reservations are held ON THE TRANSACTION rather than by mutating scMaster.stock, for two
   reasons: master data is not persisted (a reload would restore the stock and lose the holds),
   and a reservation belongs to the shipment that made it — which is what lets it be released
   again when Stores returns the shipment.

   Availability is therefore computed: the bin's free quantity minus every OTHER transaction's
   live holds on it. `exceptTxn` is what stops a shipment being told its own reservation makes
   the material unavailable to itself. == */
/* A hold is live only while the material is still IN the plant and committed to a shipment —
   Reserved (allocated, not yet picked) or Staging (picked, not yet through the gate). Once the
   material is At Vendor it has physically left and stopped competing for the bin; once it is
   back it is a receivable, not an issue hold. Counting every historical reservation forever
   made a warehouse look permanently empty after a handful of completed jobs. */
const SC_HOLDING_POSITIONS=['Reserved','Staging'];
function scHolds(item,warehouse,location,exceptTxn){
  let held=0;
  scState.txns.forEach(function(t){
    if(exceptTxn&&t.id===exceptTxn)return;
    if(t.closed||SC_HOLDING_POSITIONS.indexOf(t.position||'Main')===-1)return;
    (t.reservations||[]).forEach(function(r){
      if(r.item===item&&r.warehouse===warehouse&&(!location||r.location===location))held+=Number(r.qty||0);
    });
  });
  return held;
}
/* Receipts ADD to a bin the way holds subtract from one. FR16 requires the confirmed receivable
   quantity to land in the selected receiving location — "the applicable inventory quantity shall
   be updated" — and nothing was doing it: the IMR moved a position string and scMaster.stock was
   read but never written, so the receivable never existed as stock anywhere. Held on the
   transaction for the same reason reservations are: master data is not persisted, and a receipt
   belongs to the transaction that booked it. */
function scReceipts(item,warehouse,location){
  let got=0;
  scState.txns.forEach(function(t){
    (t.receipts||[]).forEach(function(r){
      if(r.item===item&&r.warehouse===warehouse&&(!location||r.location===location))got+=Number(r.qty||0);
    });
  });
  return got;
}
function scAvail(item,warehouse,location,exceptTxn){
  const r=scMaster.stock.find(function(x){return x.item===item&&x.warehouse===warehouse&&(!location||x.location===location);});
  const base=r?r.free:0;
  return Math.max(0,base+scReceipts(item,warehouse,location)-scHolds(item,warehouse,location,exceptTxn));
}
/* == FR6.2 — THE SHIPMENT'S OWN SOURCE LOCATION =============================================
   "| Warehouse | Dropdown | Approved SCR | Yes | Source Warehouse |" and "| Storage Location |
   Dropdown | Applicable Warehouse | Yes | Source location from which material is reserved |" —
   both are DROPDOWNS the Planner works with on the shipment, defaulted from the approved SCR.
   The only thing FR6.2 locks is the product itself: "The Planner shall not be allowed to change
   the Product or approved Issue-to-Receivable/BOM relationship from the Shipment."

   This mattered more than it looks. The availability check (FR6.3) blocks submission when the
   named bin is empty — and with the source location fixed at whatever the SCR said, a Planner
   whose SCR named an empty bin could neither submit nor correct it, and step 6 has no return
   action. The transaction was stranded with no way forward. Picking a different source bin is
   the remedy the FRD intends, and it is why these are dropdowns rather than read-only text.

   Overrides live on the SHIPMENT, never on the approved SCR — FR5.4 makes the approved SCR
   read-only, and the SCR's warehouse stays the record of what was approved. == */
function scShipLine(txn,i){
  const src=(txn.scr.issueItems||[])[i]||{};
  const ov=((txn.shipment&&txn.shipment.lines)||[])[i]||{};
  return {item:src.item,qty:Number(src.qty||0),ratio:src.ratio,
    warehouse:ov.warehouse||src.warehouse||'',
    location:ov.location||src.location||'',
    wipAdjust:src.wipAdjust||'No',
    // FR7.3 blocks shipment submission when a WIP adjustment reference is missing, which means
    // the FRD expects it to be capturable AT the shipment — it is not always known when the SCR
    // is raised. The shipment's value wins; the approved SCR keeps whatever it was approved with.
    adjustmentOrder:ov.adjustmentOrder||src.adjustmentOrder||'',
    moved:!!(ov.warehouse||ov.location)};
}
function scShipLines(txn){return (txn.scr.issueItems||[]).map(function(_,i){return scShipLine(txn,i);});}
function scSetShipLine(i,k,v){
  const txn=scOpenTxn();if(!txn)return;
  if(scNotMine(txn))return;
  txn.shipment.lines=txn.shipment.lines||[];
  while(txn.shipment.lines.length<(txn.scr.issueItems||[]).length)txn.shipment.lines.push({});
  const before=scShipLine(txn,i);
  txn.shipment.lines[i][k]=v;
  if(k==='warehouse')txn.shipment.lines[i].location='';   // locations belong to a warehouse
  const after=scShipLine(txn,i);
  scLog(txn,'Shipment source location changed — '+before.item,txn.status,txn.status,
    {oldValue:before.warehouse+' / '+before.location,newValue:after.warehouse+' / '+after.location});
  scSave();renderADTPage();
}
function scReserveMaterial(txn){
  txn.reservations=scShipLines(txn).map(function(r){
    return {item:r.item,warehouse:r.warehouse,location:r.location,qty:Number(r.qty||0)};
  });
  scMoveInventory(txn,'Reserved','Reserved '+txn.reservations.reduce(function(a,r){return a+r.qty;},0)+' against '+(txn.shipment.no||'shipment'));
}
function scReleaseMaterial(txn,note){
  txn.reservations=[];
  scMoveInventory(txn,'Main',note||'Reservation released');
}
/* == FR16.4 / FR17.4 — WHAT A CONFIRMED RECEIPT ACTUALLY DOES TO INVENTORY ==================
   Three obligations the FRD states as system behaviour and that nothing was performing:
     FR16   "the confirmed Receivable Quantity shall be added to the selected Receiving / Store
             Location; the applicable inventory quantity shall be updated"
     FR16   "where the Receivable Product / WIP was newly created and pending, it shall become
             Active" after the first confirmed receipt
     FR17.4 "reduce / consume the corresponding Issue Item quantity from the Sub-Contracting /
             At Vendor inventory position", Consumed = Received × BOM Ratio
   The consumption figure was being computed for display and for the FR17.7 gate, but the issue
   material it describes was never actually drawn down. == */
function scReceiveMaterial(txn,receivedQty){
  const qty=Number(receivedQty||0);
  const loc=String(txn.imr.receivingLocation||txn.scr.recvWarehouse||'');
  const parts=loc.split('/');
  const wh=(parts[0]||txn.scr.recvWarehouse||'').trim(),bin=(parts[1]||'').trim();
  txn.receipts=txn.receipts||[];
  if(qty>0){
    txn.receipts.push({item:txn.scr.recvItem,warehouse:wh,location:bin,qty:qty,at:scNow()});
    scLog(txn,'Inventory updated — '+qty+' '+scEsc(txn.scr.recvItem)+' booked into '+(loc||wh),
      txn.status,txn.status,{by:'System',role:'Automated',source:'System',newValue:String(qty)});
  }
  // FR3.2 / FR16 — a system-created product is Pending until the first confirmed receipt.
  if(txn.product&&txn.product.created&&txn.product.status==='Pending'&&qty>0){
    txn.product.status='Active';
    scLog(txn,'Receivable product '+txn.product.code+' activated on first confirmed receipt',
      'Pending','Active',{by:'System',role:'Automated',source:'System'});
  }
  // FR17.4 — draw the issue material down against the BOM ratio.
  (txn.reservations||[]).forEach(function(r){
    const line=(txn.scr.issueItems||[]).find(function(i){return i.item===r.item;});
    const ratio=Number((line&&line.ratio)||0);
    if(!ratio)return;
    const used=Math.min(Number(r.qty||0),+(qty*ratio).toFixed(3));
    r.consumed=+((Number(r.consumed||0))+used).toFixed(3);
    r.qty=+Math.max(0,Number(r.qty||0)-used).toFixed(3);
    scLog(txn,'Issue material consumed — '+used+' '+r.item+' against BOM ratio '+ratio,
      txn.status,txn.status,{by:'System',role:'Automated',source:'System',
        oldValue:String(+(r.qty+used).toFixed(3)),newValue:String(r.qty)});
  });
  scMoveInventory(txn,'Returned to Store','Receivable booked into '+(loc||'store'));
}
function scPanelTable(head,rows,minW){
  return '<div class="listing-card" style="margin-bottom:10px"><table class="lp-table sc-table"'
    +(minW?' style="min-width:'+minW+'px"':'')+'><thead><tr>'+head.map(function(h){return '<th>'+h+'</th>';}).join('')
    +'</tr></thead><tbody>'+(rows||'<tr><td colspan="'+head.length+'" style="text-align:center;color:var(--gray);padding:14px">Nothing to show.</td></tr>')+'</tbody></table></div>';
}
/* FR3 — Receivable Product / WIP and BOM. The FRD's rules made visible: an existing product is
   reused and never duplicated, a new one is created only after approval and stays Pending until
   the first confirmed receipt, and the one-level BOM is built from the approved issue items with
   BOM Ratio = Issue Qty ÷ Expected Receivable Qty. */
/* FR3's RESULT, not its form. This used to be an editable-looking step the Planner had to
   confirm; it is now a record of what the system did on approval, shown to whoever holds the
   transaction next (the Buyer) so they can see the product and BOM they are ordering against. */
function scPanel3(txn){
  const p=txn.product;
  if(!p)return '';                                  // not approved yet — nothing has been derived
  const rows=(txn.bom||[]).map(function(b){
    const c=scItem(b.component);
    return '<tr><td><b>'+scEsc(b.parent)+'</b></td><td><b>'+scEsc(b.component)+'</b><div class="sc-sub">'+scEsc(c?c.name:'')+'</div></td>'
      +'<td>'+scEsc(b.qty)+'</td><td>'+scEsc(b.ratio)+' '+scEsc(b.uom)+' / '+scEsc(txn.scr.recvUom||'unit')+'</td>'
      +'<td>'+scEsc(b.ref)+'</td></tr>';
  }).join('');
  return '<div class="sc-sec"><div class="sc-sec-h">Receivable Product / WIP <span class="sc-chip sc-grey">System-generated</span></div>'
    +'<div class="sc-warn '+(p.created?'amber':'blue')+'">'
      +(p.created
        ?'<b>Product '+scEsc(p.code)+' was created automatically on SCR approval.</b><br>Type <b>'+scEsc(p.type)+'</b> derived from SCR Base, linked to this SCR, and left <b>Pending</b> until the first confirmed receipt (FR16) activates it.'
        :'<b>Existing product reused — no duplicate created.</b><br>'+scEsc(p.code+' · '+p.name)+' was already in the product master, so its code, type and base UOM are retained and the type is unchanged.')
    +'</div>'
    +'<div class="sc-kv-grid">'
      +scRow('Product Code',scEsc(p.code))
      +scRow('Description',scEsc(p.name))
      +scRow('Base UOM',scEsc(p.uom))
      +scRow('Product Type',scEsc(p.type))
      +scRow('Originating SCR',scEsc(txn.no))
      +scRow('Status',p.status==='Active'?scChip('Active','green'):scChip('Pending','amber'))
    +'</div></div>'
    +'<div class="sc-sec"><div class="sc-sec-h">One-level BOM · '+scEsc(txn.bomRef||'')+'</div>'
    +scPanelTable(['Parent / Receivable','Component / Issue Item','Issue Qty','BOM Ratio','BOM Reference'],rows,620)
    +'<div class="sc-help">BOM Ratio = Issue Quantity ÷ Expected Receivable Quantity. Reconciliation consumes against this ratio at FR17.4.</div></div>';
}
/* == THE PRINTED DOCUMENTS =================================================================
   The Outbound Key, Delivery Note, Challan and IMR are things a person physically carries,
   scans or files. Rendering them as another key-value grid made them look like screens; the
   FRD calls the Outbound Key a pick list that "may be viewed digitally or printed", and the
   challan travels with the vehicle. These render as documents — a masthead with the number and
   status, party blocks, a line table and a footer — so what is on screen is recognisably the
   piece of paper it stands for. == */
let scDocSheet=null;                 // which document is open in the slide-over, or null
function scOpenDoc(kind){scDocSheet=kind;renderADTPage();}
function scCloseDoc(){scDocSheet=null;renderADTPage();}
function scDocRow(l,v){
  return '<div class="sc-doc-r"><span>'+scEsc(l)+'</span><b>'+(v==null||v===''?'—':v)+'</b></div>';
}
function scDocHead(title,no,status,tone,sub){
  return '<div class="sc-doc-head"><div class="sc-doc-title">'+scEsc(title)+'</div>'
    +'<div class="sc-doc-no">'+scEsc(no||'Not generated')+'</div>'
    +(status?'<div>'+scChip(status,tone||'blue')+'</div>':'')
    +(sub?'<div class="sc-doc-sub">'+scEsc(sub)+'</div>':'')+'</div>';
}
// A drawn barcode block — the Outbound Key is scanned at the gate, so it looks scannable.
function scDocBarcode(seed){
  const s=String(seed||'');let bars='';
  for(let i=0;i<44;i++){
    const w=1+((s.charCodeAt(i%(s.length||1))+i*7)%3);
    bars+='<i style="width:'+w+'px'+((i%2)?';background:transparent':'')+'"></i>';
  }
  return '<div class="sc-doc-bar">'+bars+'</div><div class="sc-doc-barno">'+scEsc(seed||'')+'</div>';
}
function scOutboundKeyHTML(txn){
  const sh=txn.shipment,s=txn.scr,v=scVendor(s.vendor);
  const rows=scShipLines(txn).map(function(r,i){
    const it=scItem(r.item);
    return '<tr><td>'+(i+1)+'</td><td><b>'+scEsc(r.item)+'</b><div class="sc-sub">'+scEsc(it?it.name:'')+'</div></td>'
      +'<td>'+scEsc(r.qty)+' '+scEsc(it?it.uom:'')+'</td><td>'+scEsc(r.warehouse)+'</td><td>'+scEsc(r.location)+'</td>'
      +'<td>'+scEsc(sh.lot||'—')+'</td></tr>';
  }).join('');
  return scDocHead('Outbound Key',sh.outboundKey,sh.outboundKey?'Generated':'',
      'green','Generated '+(sh.issuedAt||txn.pendingSince?scSince(txn.pendingSince):''))
    +(sh.outboundKey?scDocBarcode(sh.outboundKey):'')
    +'<div class="sc-doc-sec">Basic details</div><div class="sc-doc-grid">'
      +scDocRow('Shipment No.',scEsc(sh.no))+scDocRow('SCR No.',scEsc(txn.no))
      +scDocRow('PO No.',scEsc(txn.po.no))+scDocRow('Transfer Order No.',scEsc(sh.transferOrder))
      +scDocRow('Vendor',scEsc(v?v.name:s.internalBP))
      +scDocRow('Project / Order',scEsc(s.prodOrder||s.project))
    +'</div>'
    +'<div class="sc-doc-sec">Material to pick</div>'
    +scPanelTable(['#','Issue Item','Quantity','Warehouse','Storage Loc.','Lot / Serial'],rows,0)
    +'<div class="sc-doc-sec">Logistics</div><div class="sc-doc-grid">'
      +scDocRow('Package Type',scEsc(sh.packageType))+scDocRow('No. of Packages',scEsc(sh.packages))
      +scDocRow('Package Weight',scEsc(sh.weight?sh.weight+' '+(sh.weightUom||''):''))
      +scDocRow('Mode of Dispatch',scEsc(sh.dispatchMode))
      +scDocRow('Transporter',scEsc(sh.transporter))+scDocRow('Vehicle No.',scEsc(sh.vehicle))
      +scDocRow('Driver',scEsc(sh.driver))+scDocRow('LR / Transport Ref.',scEsc(sh.lr))
      +scDocRow('Insurance',scEsc(sh.insurance==='Yes'?(sh.insuredBy||'Yes'):'No'))
      +scDocRow('Loading Contact',scEsc(sh.contact))
    +'</div>'
    +'<div class="sc-warn blue" style="margin-top:12px">This key must accompany the material at the security gate. '
    +'Quantities cannot be changed once the key is generated.</div>';
}
function scImrDocHTML(txn){
  const s=txn.scr,it=scItem(s.recvItem),r=scComputeRecon(txn);
  return scDocHead('Inward Material Receipt',txn.imr.no,scDocStatus(txn,'imr'),'green',
      txn.imr.receiptAt||'')
    +'<div class="sc-doc-sec">Receipt</div><div class="sc-doc-grid">'
      +scDocRow('IMR No.',scEsc(txn.imr.no))+scDocRow('Against ASN',scEsc(txn.asn.no))
      +scDocRow('SCR No.',scEsc(txn.no))+scDocRow('PO No.',scEsc(txn.po.no))
      +scDocRow('Received By',scEsc(txn.imr.receivedBy?scActorLabel(txn.imr.receivedBy):''))
      +scDocRow('Receipt Date-Time',scEsc(txn.imr.receiptAt))
      +scDocRow('Receiving Location',scEsc(txn.imr.receivingLocation))
      +scDocRow('Lot / Serial',scEsc(txn.imr.lot))
    +'</div>'
    +'<div class="sc-doc-sec">Receivable</div>'
    +scPanelTable(['Receivable Item','Expected','Received','Short','Line Status'],
      '<tr><td><b>'+scEsc(s.recvItem)+'</b><div class="sc-sub">'+scEsc(it?it.name:'')+'</div></td>'
      +'<td>'+scEsc(s.recvQty)+' '+scEsc(it?it.uom:'')+'</td><td>'+scEsc(txn.imr.receivedQty||0)+'</td>'
      +'<td>'+scEsc(txn.imr.short||0)+'</td><td>'+scChip(scLineStatus(txn),scStatusTone(scLineStatus(txn)))+'</td></tr>',0)
    +'<div class="sc-doc-sec">Against the material issued</div><div class="sc-doc-grid">'
      +scDocRow('Issued to vendor',r.issued)+scDocRow('Consumed against BOM',r.consumed)
      +scDocRow('Returned unused',r.returned)+scDocRow('Outstanding',r.outstanding)
    +'</div>';
}
function scDocSheetHTML(txn){
  if(!scDocSheet)return '';
  const map={outbound:['Outbound Key',scOutboundKeyHTML],
    dn:['Delivery Note',function(t){return scPanelDoc(t,'dn');}],
    challan:['Challan',function(t){return scPanelDoc(t,'challan');}],
    imr:['Inward Material Receipt',scImrDocHTML]};
  const spec=map[scDocSheet];if(!spec)return '';
  let body='';
  try{body=spec[1](txn);}catch(e){body='<div class="sc-warn red">This document is not available yet.</div>';}
  return '<div class="sc-doc-back" onclick="scCloseDoc()"></div>'
    +'<div class="sc-doc-panel"><div class="sc-doc-bar-top">'
      +'<div class="sc-doc-bar-t">'+scEsc(spec[0])+'</div>'
      +'<button class="sc-doc-x" onclick="scCloseDoc()" aria-label="Close">&times;</button></div>'
    +'<div class="sc-doc-body">'+body+'</div>'
    +'<div class="sc-doc-foot">'
      +'<button class="btn btn-secondary btn-sm" onclick="window.print()">Print</button>'
      +'<button class="btn btn-primary btn-sm" onclick="scCloseDoc()">Close</button></div></div>';
}
/* FR6.2–6.4 — the availability check. Submission is blocked unless every line has enough free
   stock, and stock reserved for another transaction does not count as available. */
function scPanel6(txn){
  // FR6.2 — Warehouse and Storage Location are the Planner's to choose while the shipment is
  // theirs; the product and quantity are not. Read-only once it has left step 6.
  const edit=txn.step===6&&txn.pendingWith===activePersonaId&&!txn.closed;
  const rows=scShipLines(txn).map(function(r,i){
    const it=scItem(r.item),need=Number(r.qty||0),have=scAvail(r.item,r.warehouse,r.location,txn.id);
    const ok=have>=need&&need>0;
    const wh=scWarehouse(r.warehouse);
    const whCell=edit
      ? '<select class="ep-form-select'+(ok?'':' sc-err')+'" onchange="scSetShipLine('+i+',\'warehouse\',this.value)">'
        +'<option value="">Select…</option>'
        +scMaster.warehouses.map(function(w){return '<option value="'+w.code+'"'+(r.warehouse===w.code?' selected':'')+'>'+scEsc(w.code)+'</option>';}).join('')
        +'</select>'
      : scEsc(r.warehouse);
    const locCell=edit
      ? '<select class="ep-form-select'+(ok?'':' sc-err')+'" onchange="scSetShipLine('+i+',\'location\',this.value)">'
        +'<option value="">Select…</option>'
        +(((wh&&wh.locations)||[]).map(function(l){
            // Show what each bin actually holds, so choosing a source is an informed choice
            // rather than trial and error against a red banner.
            const a=scAvail(r.item,r.warehouse,l.code,txn.id);
            return '<option value="'+l.code+'"'+(r.location===l.code?' selected':'')+'>'+scEsc(l.code)+' — '+a+' available</option>';
          }).join(''))
        +'</select>'
      : scEsc(r.location);
    /* FR6.2 / FR7.3 — the WIP adjustment reference. It is only enterable on the SCR screen, and
       step 6 has no return action, so a shipment that reached here without one could neither be
       submitted nor corrected. Capturable in place, which is what FR7.3's "submission blocked"
       row presumes. */
    const wipCell=r.wipAdjust==='Yes'
      ? (edit
          ? '<input class="ep-form-input'+(String(r.adjustmentOrder||'').trim()?'':' sc-err')+'" style="width:150px" '
            +'placeholder="Adjustment order ref." value="'+scEsc(r.adjustmentOrder||'')+'" '
            +'onchange="scSetShipLine('+i+',\'adjustmentOrder\',this.value)">'
          : scEsc(r.adjustmentOrder||'—'))
      : '<span class="sc-dim">Not required</span>';
    return '<tr><td>'+(i+1)+'</td><td><b>'+scEsc(r.item)+'</b><div class="sc-sub">'+scEsc(it?it.name:'')+'</div></td>'
      +'<td>'+need+'</td><td>'+scEsc(it?it.uom:'')+'</td><td>'+whCell+'</td><td>'+locCell+'</td>'
      +'<td>'+have+'</td><td>'+scChip(ok?'Available':(have===0?'No stock':'Short by '+(need-have)),ok?'green':'red')+'</td>'
      +'<td>'+wipCell+'</td></tr>';
  }).join('');
  const blocked=scShipmentBlocked(txn);
  /* When a bin is empty, say WHERE the material actually is. A red "no stock" banner with no
     onward move is what stranded this step: the Planner cannot edit the approved SCR and step 6
     has no return action, so without this they had nothing to act on. */
  let hint='';
  if(blocked&&edit){
    const alts=[];
    scShipLines(txn).forEach(function(r){
      const need=Number(r.qty||0);
      if(scAvail(r.item,r.warehouse,r.location,txn.id)>=need&&need>0)return;
      scMaster.stock.forEach(function(st){
        if(st.item!==r.item)return;
        const a=scAvail(st.item,st.warehouse,st.location,txn.id);
        if(a>=need&&need>0)alts.push('<b>'+scEsc(r.item)+'</b> has '+a+' available at <b>'+scEsc(st.warehouse)+' / '+scEsc(st.location)+'</b>');
      });
    });
    hint=alts.length
      ? '<div class="sc-warn amber" style="margin-top:10px"><b>Where this material is in stock</b><br>'
        +alts.join('<br>')+'<br><br>Change the Warehouse or Storage Location above to draw from one of these. '
        +'FR6.2 lets you choose the source location on the shipment — the approved SCR itself is not changed.</div>'
      : '<div class="sc-warn amber" style="margin-top:10px"><b>No location holds enough of this material.</b><br>'
        +'Nothing in the warehouse master has the required quantity free, so this shipment cannot be sourced as it stands. '
        +'The SCR needs correcting — ask the Buyer to raise a Return SCR from the PO step.</div>';
  }
  /* FR7.4 — "After generation: View Outbound Key shall be enabled on the Shipment page. On click,
     the complete Outbound Key shall open in read-only mode." Before generation the button says so
     rather than disappearing, so the Planner knows what Submit will produce. */
  /* FR7.4 — "After generation: View Outbound Key shall be ENABLED on the Shipment page." Enabled,
     not created: the control belongs on the page throughout and changes state, which is also how
     the wireframe draws it. Hiding it until the key existed meant the Planner never saw it at
     all — the key is minted by Submit Shipment, and submitting hands the transaction to Stores,
     so step 6 is only ever visited BEFORE the key exists. A disabled button that says why is
     honest and discoverable; an absent one just looks missing. */
  const hasKey=!!txn.shipment.outboundKey;
  const okBtn='<div class="sc-sec"><div class="sc-sec-h">Outbound Key</div><div class="sc-kv-grid">'
    +scRow('Outbound Key No.',scEsc(txn.shipment.outboundKey||'Not generated'))
    +scRow('Transfer Order No.',scEsc(txn.shipment.transferOrder||'Not generated'))
    +'</div>'
    +'<button class="btn btn-secondary btn-sm'+(hasKey?'':' sc-btn-off')+'" style="margin-top:10px"'
      +(hasKey?' onclick="scOpenDoc(\'outbound\')"'
              :' disabled title="Generated when you submit the shipment"')
      +'>View Outbound Key</button>'
    +'<div class="sc-help" style="margin-top:8px">'
      +(hasKey
        ? 'The pick list Stores works from. It must accompany the material at the security gate, and quantities cannot be changed once it is generated.'
        : 'Generated together with the Transfer Order when you submit the shipment. It becomes the pick list Stores works from and travels with the material to the gate.')
    +'</div></div>';
  return okBtn
    +'<div class="sc-sec"><div class="sc-sec-h">Issue Items &amp; Availability</div>'
    +scPanelTable(['#','Issue Item','Shipment Qty','UOM','Warehouse','Storage Loc.','Available','Check','WIP Adj. Ref.'],rows,960)
    +(blocked?'<div class="sc-warn red"><b>Shipment cannot be submitted.</b><br>'+scEsc(blocked)+'</div>'
      :'<div class="sc-warn green"><b>Material is available.</b><br>Submitting reserves these quantities against this shipment and moves them to the Reserved location. No physical movement happens at this stage.</div>')
    +hint
    +'<div class="sc-help">Stock reserved for another transaction is not counted as available. '
    +(edit?'Warehouse and storage location are yours to choose (FR6.2); the product and quantity come from the approved SCR and cannot be changed here.':'')
    +'</div></div>';
}
/* FR7.3's block table has six rows; five were enforced and this one had neither a field nor a
   check behind it: "WIP Adjustment required but Adjustment Order Reference missing → Submission
   blocked". The flag is derived on the issue line in scSetIssue. */
function scWipBlocked(txn){
  // Reads the shipment line, so a reference entered on the shipment clears the block.
  const bad=scShipLines(txn).filter(function(r){
    return r.wipAdjust==='Yes'&&!String(r.adjustmentOrder||'').trim();});
  return bad.length?('WIP adjustment is required for '+bad.map(function(r){return r.item;}).join(', ')
    +' — an Adjustment Order Reference is mandatory before the shipment can be submitted.'):'';
}
function scShipmentBlocked(txn){
  const wip=scWipBlocked(txn);
  if(wip)return wip;
  // Checked against the SHIPMENT's source location (FR6.2), which is what the reservation will
  // actually draw from — not the SCR's, which the Planner may have moved away from.
  const rows=scShipLines(txn);
  if(!rows.length)return 'No issue items on the SCR.';
  for(let i=0;i<rows.length;i++){
    const r=rows[i],need=Number(r.qty||0);
    if(!need)return r.item+' has no quantity.';
    if(!r.warehouse||!r.location)return r.item+' needs a source warehouse and storage location.';
    const have=scAvail(r.item,r.warehouse,r.location,txn.id);
    if(have===0)return 'No stock available for '+r.item+' at '+r.warehouse+' / '+r.location+'.';
    if(have<need)return r.item+' is short by '+(need-have)+' at '+r.warehouse+' / '+r.location+'.';
  }
  return '';
}
/* FR7.4 / FR8.2 — the Outbound Key is the Stores pick list, and FR8.3's core validation is
   reserved quantity = shipment quantity. Both are shown as the storesperson sees them. */
/* FR8.3's core validation is Reserved Quantity = Shipment Quantity, with Goods Issue BLOCKED when
   reserved is short. The Reserved column used to re-print the shipment quantity and the verdict
   was the literal string "Matched", so the one check that gates goods issue could never fail —
   and a record whose reservations had been released on a Stores return still showed every line
   fully reserved. Both the column and the chip now read the real hold. */
function scReservedFor(txn,row){
  return (txn.reservations||[]).filter(function(r){
    return r.item===row.item&&r.warehouse===row.warehouse&&r.location===row.location;
  }).reduce(function(a,r){return a+Number(r.qty||0);},0);
}
function scPanel8(txn){
  const sh=txn.shipment;
  // Stores picks from the shipment's source location, so the pick list must show that one.
  const rows=scShipLines(txn).map(function(r){
    const it=scItem(r.item),need=Number(r.qty||0),res=scReservedFor(txn,r);
    return '<tr><td><b>'+scEsc(r.item)+'</b><div class="sc-sub">'+scEsc(it?it.name:'')+'</div></td>'
      +'<td>'+scEsc(r.qty)+' '+scEsc(it?it.uom:'')+'</td><td>'+scEsc(r.warehouse)+'</td><td>'+scEsc(r.location)+'</td>'
      +'<td>'+res+'</td><td>'+(res>=need?scChip('Matched','green')
        :scChip(res?'Short by '+(need-res):'Not reserved','red'))+'</td></tr>';
  }).join('');
  return '<div class="sc-sec"><div class="sc-sec-h">Outbound Key · pick list</div>'
    +'<div class="sc-kv-grid" style="margin-bottom:12px">'
      +scRow('Outbound Key No.',scEsc(sh.outboundKey||'Not generated'))
      +scRow('Transfer Order No.',scEsc(sh.transferOrder||'Not generated'))
      +scRow('Shipment',scEsc(sh.no))+scRow('Project / Order',scEsc(txn.scr.prodOrder||txn.scr.project))
    +'</div>'
    +scPanelTable(['Issue Item','Quantity to Issue','Warehouse','Storage Location','Reserved','Reserved vs Shipment'],rows,640)
    +'<div class="sc-help">The Outbound Key is a pick list, not a delivery note or challan. Quantities cannot be changed once it is generated.</div></div>';
}
// FR9.2 / FR10.2 — the two printed documents, built entirely from what already exists upstream.
function scPanelDoc(txn,kind){
  const s=txn.scr,sh=txn.shipment,v=scVendor(s.vendor),loc=scMaster.locations.find(function(l){return l.code===s.location;});
  const isCh=kind==='challan';
  const rows=(s.issueItems||[]).map(function(r,i){
    const it=scItem(r.item);
    return '<tr><td>'+(i+1)+'</td><td><b>'+scEsc(r.item)+'</b><div class="sc-sub">'+scEsc(it?it.name:'')+'</div></td>'
      +'<td>'+scEsc(r.qty)+'</td><td>'+scEsc(it?it.uom:'')+'</td>'
      +(isCh?'<td>'+scEsc(it?it.hsn:'')+'</td><td>'+scMoney(Number(txn.po.price||0))+' / '+scEsc(it?it.uom:'')+'</td>'
            :'<td>'+scEsc(sh.lot||'—')+'</td>')+'</tr>';
  }).join('');
  /* Laid out as the document itself — masthead, the two parties, the goods, the transport — rather
     than as another key-value panel. These are things a person carries: the challan travels in the
     vehicle and is produced at the gate, so what is on screen should be recognisably that paper. */
  const no=isCh?txn.challan.no:txn.dn.no;
  const st=scDocStatus(txn,isCh?'challan':'dn');
  /* The date OF THE DOCUMENT, not the date it is being looked at. This read scNow() on every
     render, so a delivery note printed on the 3rd showed the 9th when reopened on the 9th — and
     two people opening the same challan on different days saw different dates on what is supposed
     to be one immutable document. Stamped once, where the number is minted. */
  const dt=String((isCh?txn.challan.date:txn.dn.date)||'').split(',')[0];
  return scDocHead(isCh?'Delivery Challan':'Delivery Note',no||'Not yet generated',st,scStatusTone(st),
      (isCh?'Challan type: '+(sh.challanType||'—'):'For approval by '+scActorLabel(sh.dnApprover||'dn-approver'))
      +(dt?'   ·   Dated '+dt:''))
    +'<div class="sc-doc-sec">Consignor</div><div class="sc-doc-grid">'
      +scDocRow('Dispatching Unit',scEsc(loc?loc.name:''))
      +scDocRow('Address',scEsc(loc?loc.address:''))
      +(isCh?scDocRow('GSTIN / Tax Identifier',scEsc(loc?loc.gstin:'')):'')
    +'</div>'
    +'<div class="sc-doc-sec">Consignee</div><div class="sc-doc-grid">'
      +scDocRow('Vendor / Subcontractor',scEsc(v?v.name:s.internalBP))
      +scDocRow('Address',scEsc(v&&(v.addresses.find(function(a){return a.code===s.vendorAddress;})||{}).text))
      +(isCh&&v?scDocRow('GSTIN',scEsc(v.gstin)):'')
      +(isCh?scDocRow('Nature of Work / Reason for Removal',scEsc(s.opDesc||s.title)):'')
    +'</div>'
    +'<div class="sc-doc-sec">References</div><div class="sc-doc-grid">'
      +scDocRow('SCR No.',scEsc(txn.no))+scDocRow('PO No.',scEsc(txn.po.no))
      +scDocRow('Shipment No.',scEsc(sh.no))
      +(isCh?scDocRow('Delivery Note No.',scEsc(txn.dn.no)):scDocRow('Outbound Key',scEsc(sh.outboundKey)))
      +scDocRow('Expected Date of Return',scEsc(sh.expectedReturn))
      +(isCh?scDocRow('Generated By',scEsc(txn.challan.generatedBy?scActorLabel(txn.challan.generatedBy):''))
            :scDocRow('Approved By',scEsc(txn.dn.approvedBy?scActorLabel(txn.dn.approvedBy)+' · '+(txn.dn.approvedAt||''):'Not yet approved')))
    +'</div>'
    +'<div class="sc-doc-sec">Goods</div>'
    +scPanelTable(isCh?['#','Issue Item','Quantity','UOM','HSN Code','Material Value']:['#','Issue Item','Quantity','UOM','Lot / Serial'],rows,0)
    +'<div class="sc-doc-sec">Transport</div><div class="sc-doc-grid">'
      +scDocRow('Packages',scEsc(sh.packages))
      +scDocRow('Weight',scEsc(sh.weight?sh.weight+' '+(sh.weightUom||''):''))
      +scDocRow('Mode of Dispatch',scEsc(sh.dispatchMode))+scDocRow('Vehicle No.',scEsc(sh.vehicle))
      +scDocRow('Transporter',scEsc(sh.transporter))+scDocRow('Driver',scEsc(sh.driver))
      +scDocRow('LR / Transport Ref.',scEsc(sh.lr))
      +(isCh?scDocRow('Gate Pass No.',scEsc(txn.challan.gatePassNo))
            +scDocRow('Gate Outward',scEsc(txn.challan.gateOutAt)):'')
    +'</div>'
    +(isCh?'<div class="sc-warn amber" style="margin-top:14px"><b>POINT OF NO RETURN</b><br>Once the challan is generated the shipment can no longer be cancelled. Return monitoring against '+scEsc(sh.expectedReturn||'the expected return date')+' starts at Gate Outward, not now.</div>':'')
    +'<div class="sc-doc-sign"><div><span>Prepared by</span><i></i></div>'
      +'<div><span>Authorised signatory</span><i></i></div>'
      +'<div><span>Received by (vendor)</span><i></i></div></div>';
}
// FR11.2 — the gate check: challan quantity against what security actually counted.
function scPanel11(txn){
  const sh=txn.shipment,ch=txn.challan;
  const rows=(txn.scr.issueItems||[]).map(function(r){
    const it=scItem(r.item);
    return '<tr><td><b>'+scEsc(r.item)+'</b><div class="sc-sub">'+scEsc(it?it.name:'')+'</div></td>'
      +'<td>'+scEsc(r.qty)+'</td><td>'+scEsc(it?it.uom:'')+'</td><td>'+scEsc(r.qty)+'</td><td>'+scChip('0','green')+'</td></tr>';
  }).join('');
  return '<div class="sc-sec"><div class="sc-sec-h">Gate verification</div>'
    +'<div class="sc-kv-grid" style="margin-bottom:12px">'
      +scRow('Challan No.',scEsc(ch.no))+scRow('Delivery Note No.',scEsc(txn.dn.no))
      +scRow('Vehicle No. (planned)',scEsc(sh.vehicle))+scRow('Package Count (challan)',scEsc(sh.packages))
      +scRow('Driver',scEsc(sh.driver))+scRow('Transporter',scEsc(sh.transporter))
      /* FR11.5 — the gate pass is what the vehicle physically carries out and what the return leg
         is quoted against. It is minted on Confirm Dispatch, so before that it reads as pending
         rather than blank, which is the difference between "not yet" and "missing". */
      +scRow('Gate Pass No.',scEsc(ch.gatePassNo||'Issued on dispatch confirmation'))
      +scRow('Gate Outward Date-Time',scEsc(ch.gateOutAt||'Not cleared'))
    +'</div>'
    +scPanelTable(['Issue Item','Challan Qty','UOM','Verified Qty','Variance'],rows,520)
    +'<div class="sc-warn blue"><b>Material dispatch confirmation is mandatory.</b><br>Vehicle number and package count are confirmed on the next screen; a reason is required if either differs from the challan. Material stays in Staging until the Planner / PMG confirms the shipment.</div></div>';
}
// FR12.2 / FR15.2 — read-only confirmation blocks.
function scPanel12(txn){
  return '<div class="sc-sec"><div class="sc-sec-h">Shipment confirmation</div><div class="sc-kv-grid">'
    +scRow('Challan No.',scEsc(txn.challan.no))+scRow('Gate Outward Date-Time',scEsc(txn.challan.gateOutAt||'—'))
    +scRow('Gate Pass No.',scEsc(txn.challan.gatePassNo||'—'))
    +scRow('Dispatch Confirmed By',scEsc(txn.challan.dispatchConfirmedBy?scActorLabel(txn.challan.dispatchConfirmedBy)+' · '+txn.challan.dispatchConfirmedAt:'—'))
    +scRow('Current Material Location',scChip(txn.position||'Staging','amber'))
    +scRow('Destination Material Location',scChip('At Vendor','blue'))
    +'</div><div class="sc-warn blue"><b>This confirmation performs the inventory movement.</b><br>Material moves Staging → Sub-Contracting / At Vendor. Security clearance has already recorded the physical exit; this records the system position.</div></div>';
}
// FR14.2 — what QC reviews before clearing. Read-only: FR14.3 forbids QC changing the receivable
// item, the quantity, the vendor or the PO line; corrections go back through Return ASN.
function scPanelAsnReview(txn){
  const it=scItem(txn.scr.recvItem),docs=(txn.asn.docs||[]).length;
  return '<div class="sc-sec"><div class="sc-sec-h">QC review</div><div class="sc-kv-grid">'
    +scRow('ASN No.',scEsc(txn.asn.no))+scRow('Receivable Item',scEsc(txn.scr.recvItem)+(it?' · '+scEsc(it.name):''))
    +scRow('Quantity Ready',scEsc(txn.asn.qtyReady)+' '+scEsc(it?it.uom:''))
    +scRow('Open Receivable Qty',scEsc(txn.scr.recvQty))
    +scRow('Inspection Documents',docs?scChip(docs+' attached','green'):scChip('None attached','red'))
    +scRow('Vendor Remarks',scEsc(txn.asn.remarks))
    +'</div>'
    +(docs?'<div class="sc-warn blue"><b>Clearing admits the material for inward.</b><br>The ASN moves Created → QC Cleared and Security may then record gate entry. No inventory movement happens at clearance.</div>'
      :'<div class="sc-warn red"><b>No inspection document is attached.</b><br>FR14.1 requires the mandatory documents before clearance. Return the ASN to the vendor.</div>')
    +'</div>';
}
function scPanel15(txn){
  return '<div class="sc-sec"><div class="sc-sec-h">Gate inward</div><div class="sc-kv-grid">'
    +scRow('ASN No.',scEsc(txn.asn.no))+scRow('ASN Status',scChip(txn.status,'green'))
    +scRow('Quantity Ready',scEsc(txn.asn.qtyReady))+scRow('Challan No.',scEsc(txn.challan.no))
    // FR15.2 sources these two "from QC Clearance" — Security decides on them, so they cannot be
    // left to the activity log.
    +scRow('QC Cleared By',scEsc(txn.asn.clearedBy?scActorLabel(txn.asn.clearedBy):'—'))
    +scRow('QC Cleared Date-Time',scEsc(txn.asn.clearedAt||'—'))
    +scRow('Gate Entry Date-Time',scEsc(txn.asn.gateEntryAt||'Recorded on confirmation'))
    +scRow('Security User',scEsc(txn.asn.gateEntryBy?scActorLabel(txn.asn.gateEntryBy):'—'))
    +'</div><div class="sc-warn blue"><b>Gate entry records physical inward only.</b><br>No inventory movement happens here — stock updates when Stores confirms the receipt.</div></div>';
}
/* FR1.2 / FR13.2 — attachments on the SCR and inspection documents on the ASN. A mockup cannot
   take a real upload, so a name is captured and the entry is logged; what matters downstream is
   that the document EXISTS, because FR13.3 blocks ASN submission when inspection is required and
   nothing is attached, and FR14.1 makes QC clearance depend on it. */
function scAddAttachment(kind){
  const txn=scOpenTxn();if(!txn)return;
  const el=document.getElementById('sc-att-'+kind);
  const name=el&&el.value.trim();
  if(!name)return;
  const bag=kind==='asn'?(txn.asn.docs=txn.asn.docs||[]):(txn.scr.attachments=txn.scr.attachments||[]);
  bag.push({name:name,at:scNow(),by:scActorLabel(activePersonaId)});
  scTouchScr();
  scLog(txn,(kind==='asn'?'Inspection document attached — ':'Attachment added — ')+name,txn.status,txn.status);
  if(el)el.value='';
  scSave();renderADTPage();
}
function scRemoveAttachment(kind,i){
  const txn=scOpenTxn();if(!txn)return;
  const bag=kind==='asn'?(txn.asn.docs||[]):(txn.scr.attachments||[]);
  const gone=bag.splice(i,1)[0];
  if(gone)scLog(txn,'Attachment removed — '+gone.name,txn.status,txn.status);
  scSave();renderADTPage();
}
function scAttachmentsHTML(txn,kind,editable){
  const bag=(kind==='asn'?txn.asn.docs:txn.scr.attachments)||[];
  const title=kind==='asn'?'Inspection Documents':'Attachments';
  const rows=bag.map(function(a,i){
    return '<tr><td><b>'+scEsc(a.name)+'</b></td><td>'+scEsc(a.at)+'</td><td>'+scEsc(a.by)+'</td>'
      +'<td>'+(editable?'<button class="ep-cancel-btn" style="padding:3px 8px" onclick="scRemoveAttachment(\''+kind+'\','+i+')">Remove</button>':'<span class="sc-dim">—</span>')+'</td></tr>';
  }).join('');
  return '<div class="sc-sec"><div class="sc-sec-h">'+title+' · '+bag.length+'</div>'
    +scPanelTable(['File','Uploaded','By',''],rows,420)
    +(editable?'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +'<input class="ep-form-input" id="sc-att-'+kind+'" style="flex:1;min-width:220px" placeholder="'+(kind==='asn'?'e.g. Inspection_Certificate.pdf':'e.g. Technical_Drawing.pdf')+'">'
      +'<button class="btn btn-secondary btn-sm" onclick="scAddAttachment(\''+kind+'\')">+ Attach</button></div>'
      +'<div class="sc-help">PDF, DOC, XLS, JPG or PNG. '+(kind==='asn'?'Required before the ASN can be raised where inspection applies.':'Optional supporting documents.')+'</div>':'')
    +'</div>';
}
function scStepPanel(txn){
  const mine=txn.pendingWith===activePersonaId&&!txn.closed;
  if(txn.step===1)return scAttachmentsHTML(txn,'scr',mine);
  if(txn.step===13)return scAttachmentsHTML(txn,'asn',mine);
  if(txn.step===14)return scAttachmentsHTML(txn,'asn',false)+scPanelAsnReview(txn);
  /* FR2.1 lists Attachments in the read-only bundle the approver must see, and RC-SCRRET's
     SCRR-08 is literally "Mandatory Information / Attachment Missing" — a reason the approver
     could not check, because the attachments were rendered at step 1 and nowhere else. They are
     part of the SCR's permanent record, so every downstream step shows them read-only. */
  const scrAtt=(txn.scr.attachments||[]).length?scAttachmentsHTML(txn,'scr',false):'';
  if(txn.step===2)return scrAtt;
  // The Buyer completes a PO against a product and BOM the system derived — show them both.
  if(txn.step===4)return scPanel3(txn);
  // 7 is the goods issue (outbound key / pick list); 8 is logistics, which needs no extra panel.
  const p={6:scPanel6,7:scPanel8,11:scPanel11,12:scPanel12,15:scPanel15}[txn.step];
  if(p)return p(txn);
  if(txn.step===9)return scPanelDoc(txn,'dn');
  if(txn.step===10)return scPanelDoc(txn,'challan');
  return '';
}
function scActivityHTML(txn){
  // FR20's ten fields, all of them: date-time, action, old and new status, performed by, role,
  // reason code, remarks, old value and new value.
  const rows=(txn.activity||[]).slice().reverse().map(function(a){
    return '<tr><td>'+scEsc(a.at)+'</td><td><b>'+scEsc(a.action)+'</b>'
      +(a.from||a.to?'<div class="sc-sub">'+scEsc(a.from||'—')+' → '+scEsc(a.to||'—')+'</div>':'')
      +(a.oldValue?'<div class="sc-sub">was — '+scEsc(a.oldValue)+'</div><div class="sc-sub">now — '+scEsc(a.newValue)+'</div>':'')+'</td>'
      +'<td>'+scEsc(a.by)+'<div class="sc-sub">'+scEsc(a.role||'')+'</div></td>'
      +'<td>'+scEsc(a.source)+'</td>'
      +'<td>'+(a.reasonCode?'<b>'+scEsc(a.reasonCode)+'</b> '+scEsc(a.reason||''):scEsc(a.reason||'—'))
      +(a.remarks?'<div class="sc-sub">'+scEsc(a.remarks)+'</div>':'')+'</td></tr>';
  }).join('');
  return '<div class="sc-sec"><div class="sc-sec-h">Activity Log</div><div class="listing-card">'
    +'<table class="lp-table sc-table" style="min-width:760px"><thead><tr><th>Date &amp; Time</th><th>Action / Values</th><th>Performed by · Role</th><th>Source</th><th>Reason / Remarks</th></tr></thead>'
    +'<tbody>'+(rows||'<tr><td colspan="5" style="color:var(--gray);text-align:center;padding:14px">No activity yet.</td></tr>')+'</tbody></table></div></div>';
}

/* == THE TRANSACTION SCREEN ================================================================
   One page for all eighteen steps. It resolves three things and renders accordingly:

     whose step is it   — if the transaction is not pending with you, the page is read-only and
                          offers Continue as … instead of actions. That is what makes the
                          handoff real rather than a label.
     maker or checker   — a form, or a review plus action sheets.
     web or mobile      — the toggle, and ONLY on checker steps, because the checker is the
                          person approving, returning or rejecting.                        == */
function buildScTxnHTML(){
  const txn=scOpenTxn();
  if(!txn)return '<div class="ai-exec-page sc-page"><div class="ep-form-card" style="padding:30px;text-align:center;color:var(--gray)">No transaction open. <button class="btn btn-secondary btn-sm" onclick="scBackToDash()">Back to dashboard</button></div></div>';
  const step=txn.step,spec=scSpec(step),st=scStep(step);
  const me=activePersonaId,mine=txn.pendingWith===me&&!txn.closed;
  const checker=spec.kind==='checker';
  const head='<div class="sc-txn-head">'
    +'<button class="ep-cancel-btn" onclick="scBackToDash()">‹ Dashboard</button>'
    +'<div class="sc-txn-title"><p class="sc-h1">'+scEsc(spec.title)+'</p>'
      /* "of 18" with seventeen dots below it invites the reader to hunt for the missing one.
         The step keeps its FRD number — which is what every other surface quotes — and the total
         is simply not claimed. */
      +'<p class="sc-h2">'+scEsc(txn.no||'New request')+' · Step '+st.no+' · '+scEsc(st.name)+'</p></div>'
    +'<div class="sc-txn-right">'+scChip(txn.status,scStatusTone(txn.status))
      +(scOverdue(txn)?scChip('Overdue','red'):'')
      +(txn.closed?'':'<span class="sc-pending">Pending with '+scPendingWithHTML(txn.pendingWith)+'</span>')+'</div>'
    +'</div>';
  // Progress rail — the steps a person acts on, current highlighted, done ticked. The system
  // step is not drawn: it has no screen to reach and no action to take.
  const rail='<div class="sc-rail">'+SC_SHOWN_STEPS.map(function(s){
    const cls=s.no<step?'done':s.no===step?'now':'todo';
    return '<span class="sc-rail-dot '+cls+'" title="'+scEsc(s.no+'. '+s.name)+'">'+(s.no<step?'✓':s.no)+'</span>';
  }).join('')+'</div>';
  if(!mine){
    return '<div class="ai-exec-page sc-page">'+head+rail
      +'<div class="sc-warn blue"><b>This step belongs to '+scEsc(scActorLabel(txn.pendingWith))+'.</b> '
      +(txn.closed?'The transaction is closed and is shown for audit.':'You can read the transaction, but only '+scEsc(scActorLabel(txn.pendingWith))+' can act on it.')+'</div>'
      +(txn.closed?'':'<div class="sc-continue"><button class="btn btn-primary btn-sm" onclick="scContinueAs()">Continue as '+scEsc(scActorLabel(txn.pendingWith))+' →</button>'
        +'<span class="sc-help">Switches your role to '+scEsc(scActorLabel(txn.pendingWith))+' and reopens this transaction.</span></div>')
      +scSummaryHTML(txn)+scActivityHTML(txn)+'</div>';
  }
  if(!checker){
    const form=(SC_FORMS[step]||[]).length?scFormHTML(txn,step):'';
    const items=step===1?scItemsHTML(txn):'';
    /* Form-level errors belong to no single field — the availability block, the missing
       inspection document. Rendered by convention: any error key starting `__` is a whole-form
       problem and prints as a callout above the form rather than under an input. */
    const formLevel=Object.keys(scFormErrors).filter(function(k){return k.indexOf('__')===0;})
      .map(function(k){return '<div class="sc-warn red"><b>Cannot submit.</b><br>'+scEsc(scFormErrors[k])+'</div>';}).join('');
    const note=(!form&&!items&&!scStepPanel(txn)?'<div class="sc-warn blue">Nothing to capture at this step — confirm to move the transaction on.</div>':'')+formLevel;
    return '<div class="ai-exec-page sc-page">'+head+rail+note+form+items+scStepPanel(txn)
      +(step>1?scSummaryHTML(txn):'')+scActivityHTML(txn)
      +'<div class="sc-actions">'
        +(spec.extra||[]).map(function(a){return '<button class="btn btn-secondary btn-sm" onclick="scOpenSheet(\''+a.id+'\')">'+scEsc(a.label)+'</button>';}).join('')
        +(spec.secondary?'<button class="ep-cancel-btn" onclick="scSecondaryAction()">'+scEsc(spec.secondary.label)+'</button>':'')
        +'<button class="ep-save-btn" onclick="scPrimaryAction()">'+scEsc(spec.primary.label)+'</button>'
      +'</div>'+scSheetHTML(txn)+scDocSheetHTML(txn)+'</div>';
  }
  // Checker: web / mobile toggle, then the same content in the chosen frame.
  const toggle='<div class="sc-toggle"><span>View as</span>'
    +'<button class="'+(scViewMode==='web'?'on':'')+'" onclick="scSetViewMode(\'web\')">Web</button>'
    +'<button class="'+(scViewMode==='mobile'?'on':'')+'" onclick="scSetViewMode(\'mobile\')">Mobile</button></div>';
  /* Two things can stop a checker acting, and both are the FRD's rules rather than UI polish:
     maker-checker (FR2.4 / FR5.3) blocks the person who raised it, and the closure gate
     (FR17.7 / FR18.1) blocks full receipt while material is unaccounted for. Only the forward
     action is disabled — Return and Reject stay available, because a blocked approver still
     needs a way to send it back. */
  const mcBlock=scMakerCheckerBlocked(txn),gateBlock=scGateBlock(txn);
  const block=mcBlock||gateBlock;
  const actionBar='<div class="sc-actions">'+(spec.actions||[]).map(function(a){
    const forward=a.id!=='return'&&a.id!=='reject'&&a.id!=='return-scr';
    const off=forward&&block;
    return '<button class="sc-act sc-act-'+a.tone+(off?' sc-act-off':'')+'"'
      +(off?' disabled title="'+scEsc(block)+'"':' onclick="scOpenSheet(\''+a.id+'\')"')+'>'+scEsc(a.label)+'</button>';
  }).join('')+'</div>';
  const blockNote=block?'<div class="sc-warn '+(mcBlock?'red':'amber')+'"><b>'+(mcBlock?'Blocked by maker-checker.':'Cannot proceed yet.')+'</b><br>'+scEsc(block)+'</div>':'';
  if(scViewMode==='mobile'){
    return '<div class="ai-exec-page sc-page">'+head+toggle
      +'<div class="sc-phone-wrap"><div class="sc-phone">'
        +'<div class="sc-phone-bar">'+scEsc(spec.title)+'</div>'
        +'<div class="sc-phone-ctx">● Pending your approval · '+scEsc(scActorLabel(me))+'</div>'
        +'<div class="sc-phone-body">'+blockNote+scStepPanel(txn)+scSummaryHTML(txn)+scActivityHTML(txn)+'</div>'
        +'<div class="sc-phone-actions">'+(spec.actions||[]).map(function(a){
          const forward=a.id!=='return'&&a.id!=='reject'&&a.id!=='return-scr';
          const off=forward&&block;
          return '<button class="sc-act sc-act-'+a.tone+(off?' sc-act-off':'')+'"'
            +(off?' disabled':' onclick="scOpenSheet(\''+a.id+'\')"')+'>'+scEsc(a.label)+'</button>';}).join('')+'</div>'
      +'</div></div>'+scSheetHTML(txn)+scDocSheetHTML(txn)+'</div>';
  }
  return '<div class="ai-exec-page sc-page">'+head+rail+toggle
    +(block?blockNote:'<div class="sc-warn amber">Read only · pending your decision. Verify the details before acting.</div>')
    +scStepPanel(txn)+scSummaryHTML(txn)+scActivityHTML(txn)+actionBar+scSheetHTML(txn)+scDocSheetHTML(txn)+'</div>';
}

/* -- ACTION SHEET. Green / amber / red by tone, a consequence sentence, a mini-summary so the
   decision is made against the numbers, then reason and remarks where the action needs them.
   The cancel label is contextual, as the wireframes have it. -- */
const SC_SHEET_COPY={
  approve:{h:'THIS MOVES IT FORWARD',t:'Approved and passed to the next actor. It cannot be edited after this.'},
  clear:{h:'QC HAS ACCEPTED THE MATERIAL',t:'The ASN is cleared and the material can be admitted at the gate.'},
  release:{h:'MATERIAL MOVES RESERVED → STAGING',t:'Stock leaves reserved status and stages for dispatch. It stays inside the plant until Gate Outward.'},
  generate:{h:'POINT OF NO RETURN',t:'The challan number is issued and the shipment can no longer be cancelled. Return monitoring starts at Gate Outward.'},
  confirm:{h:'THIS IS RECORDED AS DONE',t:'The step is confirmed and the transaction moves to the next actor.'},
  'full-receipt':{h:'RECONCILIATION IS FINALISED',t:'Full receipt is confirmed and the transaction becomes eligible for closure.'},
  close:{h:'THE TRANSACTION IS CLOSED',t:'SCR, PO, Shipment and Challan are all closed. No further processing is possible.'},
  return:{h:'IT GOES BACK FOR CORRECTION',t:'The previous actor corrects and resubmits. Approval restarts from the beginning.'},
  'return-scr':{h:'THIS REVERSES AN APPROVED SCR',t:'The PO draft is discarded, the SCR returns to the Planner, and fresh approval is required before a PO can be raised again.'},
  reject:{h:'REJECTION IS FINAL',t:'The transaction is closed and cannot be resubmitted. A new one must be raised to proceed.'}
};
function scSheetHTML(txn){
  if(!scSheet)return '';
  if(scSheet.action==='remove-issue'){
    const set=scReasonSet('RC-REMOVAL');
    return '<div class="sc-scrim" onclick="scCloseSheet()"></div><div class="sc-sheet"><div class="sc-sheet-h">Remove Issue Item</div>'
      +(set.values.length?'<div class="ep-form-group"><label class="ep-form-label">Reason for removal <span class="req">*</span></label>'
        +'<select class="ep-form-select" onchange="scSheetSet(\'reason\',this.value)"><option value="">Select a reason</option>'
        +set.values.map(function(v){return '<option value="'+v.code+'">'+scEsc(v.text)+'</option>';}).join('')+'</select></div>'
        :'<div class="sc-warn blue">'+scEsc(set.empty)+' The item can still be removed and the removal is logged.</div>')
      +'<div class="ep-form-group"><label class="ep-form-label">Remarks</label><textarea class="ep-form-input" rows="2" oninput="scSheet.remarks=this.value"></textarea></div>'
      +(scSheet.err?'<div class="sc-err-msg">'+scEsc(scSheet.err)+'</div>':'')
      +'<div class="sc-sheet-f"><button class="ep-cancel-btn" onclick="scCloseSheet()">Cancel</button>'
      +'<button class="sc-act sc-act-red" onclick="scConfirmRemoveIssue()">Remove item</button></div></div>';
  }
  if(scSheet.action==='short-close'){
    const set=scReasonSet('RC-SHORT'),pending=Number((txn.recon||{}).pending||0);
    return '<div class="sc-scrim" onclick="scCloseSheet()"></div><div class="sc-sheet">'
      +'<div class="sc-sheet-h">Short-close the balance?</div>'
      +'<div class="sc-warn amber"><b>'+pending+' WILL BE WRITTEN OFF</b><br>The remaining receivable quantity is formally closed and the line becomes Short-Closed. Full receipt can then be confirmed. This cannot be undone.</div>'
      +'<div class="sc-mini">'+scRow('Receivable item',scEsc(txn.scr.recvItem))
        +scRow('Expected',scEsc(txn.scr.recvQty))+scRow('Received',scEsc(txn.imr.receivedQty||0))
        +scRow('Being short-closed',pending)+'</div>'
      +'<div class="ep-form-group"><label class="ep-form-label">Reason <span class="req">*</span></label>'
      +'<select class="ep-form-select" onchange="scSheetSet(\'reason\',this.value)"><option value="">Select a reason</option>'
      +set.values.map(function(v){return '<option value="'+v.code+'"'+(scSheet.reason===v.code?' selected':'')+'>'+scEsc(v.code+' · '+v.text)+'</option>';}).join('')+'</select>'
      +'<div class="sc-help">Proposed values — the FRD names a Short-Closed status but supplies no reason set.</div></div>'
      +'<div class="ep-form-group"><label class="ep-form-label">Remarks <span class="req">*</span></label>'
      +'<textarea class="ep-form-input" rows="3" placeholder="Explain why the balance is being written off" oninput="scSheet.remarks=this.value">'+scEsc(scSheet.remarks||'')+'</textarea></div>'
      +(scSheet.err?'<div class="sc-err-msg">'+scEsc(scSheet.err)+'</div>':'')
      +'<div class="sc-sheet-f"><button class="ep-cancel-btn" onclick="scCloseSheet()">Keep it open</button>'
      +'<button class="sc-act sc-act-amber" onclick="scConfirmShortClose()">Short-close '+pending+'</button></div></div>';
  }
  const act=scSheetAction(txn);if(!act)return '';
  const copy=SC_SHEET_COPY[act.id]||{h:act.label.toUpperCase(),t:''};
  const set=act.set?scReasonSet(act.set):null;
  const needRemarks=set&&scRemarksRequired(act.set,scSheet.reason);
  const s=txn.scr,recvIt=scItem(s.recvItem);
  const cancelLabel=act.id==='return-scr'?'Keep PO':act.id==='generate'?'Keep draft':'Cancel';
  return '<div class="sc-scrim" onclick="scCloseSheet()"></div><div class="sc-sheet">'
    +'<div class="sc-sheet-h">'+scEsc(act.label)+'?</div>'
    +'<div class="sc-warn '+act.tone+'"><b>'+scEsc(copy.h)+'</b><br>'+scEsc(copy.t)+'</div>'
    +'<div class="sc-mini">'+scRow('Reference',scEsc(txn.no))
      +scRow('Vendor',scEsc((scVendor(s.vendor)||{name:s.internalBP||'—'}).name))
      // Per UOM, for the same reason as the comparison panel — see FR1.7.
      +scRow('Issue → Receivable',(function(){
        const byUom={};
        (s.issueItems||[]).forEach(function(r){const i2=scItem(r.item),u=i2?i2.uom:'—';byUom[u]=(byUom[u]||0)+Number(r.qty||0);});
        const left=Object.keys(byUom).map(function(u){return byUom[u]+' '+scEsc(u);}).join(' + ')||'—';
        return left+' → '+scEsc(s.recvQty||'—')+' '+scEsc(recvIt?recvIt.uom:'');
      })())
      +(txn.po&&txn.po.no?scRow('PO value',s.billable==='No'?'0.00':scMoney(Number(txn.po.price||0)*Number(s.recvQty||0))):'')
    +'</div>'
    // The action's own fields, before the reason. Conditional ones appear the moment the value
    // they watch actually differs from what was planned.
    +(act.fields||[]).map(function(fd){
      if(fd.when&&!fd.when(txn,scSheet))return '';
      const v=scSheet[fd.id]===undefined?'':scSheet[fd.id];
      let ctl;
      if(fd.type==='reason'){
        const rs=scReasonSet(fd.set);
        ctl='<select class="ep-form-select" onchange="scSheetSet(\''+fd.id+'\',this.value)"><option value="">Select a reason</option>'
          +rs.values.map(function(o){return '<option value="'+o.code+'"'+(v===o.code?' selected':'')+'>'+scEsc(o.code+' · '+o.text)+'</option>';}).join('')+'</select>';
      }else{
        ctl='<input class="ep-form-input" type="'+(fd.type==='num'?'number':'text')+'" value="'+scEsc(v)+'"'
          +' placeholder="'+scEsc(fd.ph||'')+'" onchange="scSheetSet(\''+fd.id+'\',this.value)">';
      }
      return '<div class="ep-form-group"><label class="ep-form-label">'+scEsc(fd.label)+(fd.req?' <span class="req">*</span>':'')+'</label>'
        +ctl+(fd.help?'<div class="sc-help">'+scEsc(fd.help)+'</div>':'')+'</div>';
    }).join('')
    +(set?'<div class="ep-form-group"><label class="ep-form-label">'+scEsc(set.label)+' <span class="req">*</span></label>'
      +'<select class="ep-form-select" onchange="scSheetSet(\'reason\',this.value)"><option value="">Select a reason</option>'
      +set.values.map(function(v){return '<option value="'+v.code+'"'+(scSheet.reason===v.code?' selected':'')+'>'+scEsc(v.code+' · '+v.text)+'</option>';}).join('')
      +'</select>'+(set.proposed?'<div class="sc-help">Proposed values — not yet confirmed by the client.</div>':'')+'</div>':'')
    +'<div class="ep-form-group"><label class="ep-form-label">'+(set?'Remarks':'Remarks (optional)')
      +(needRemarks?' <span class="req">*</span>':'')+'</label>'
      +'<textarea class="ep-form-input" rows="3" placeholder="'+(needRemarks?'Required for this reason':'Add a note')+'" oninput="scSheet.remarks=this.value">'+scEsc(scSheet.remarks||'')+'</textarea>'
      +(set&&set.remarks==='other'?'<div class="sc-help">Mandatory when Reason = Other</div>':'')+'</div>'
    +(scSheet.err?'<div class="sc-err-msg">'+scEsc(scSheet.err)+'</div>':'')
    +'<div class="sc-sheet-f"><button class="ep-cancel-btn" onclick="scCloseSheet()">'+cancelLabel+'</button>'
    +'<button class="sc-act sc-act-'+act.tone+'" onclick="scConfirmSheet()">'+scEsc(act.label)+'</button></div></div>';
}

/* -- Styles injected once. Kept here rather than in main.css so the journey stays removable in
   one file, and scoped under .sc-page so nothing leaks into the rest of the app. -- */
function scInjectCss(){
  if(document.getElementById('sc-css'))return;
  const el=document.createElement('style');el.id='sc-css';
  el.textContent=`
.sc-page{padding-bottom:40px}
.sc-h1{font-size:19px;font-weight:700;color:var(--navy);margin:0 0 3px}
.sc-role{font-size:10.5px;font-weight:700;letter-spacing:.5px;color:#6d5bd0;background:#efeafc;border-radius:5px;padding:2px 7px;vertical-align:middle;margin-left:6px}
.sc-h2{font-size:12.5px;color:var(--gray);margin:0}
.sc-dim{color:var(--gray)}
.sc-sub{font-size:11px;color:var(--gray);margin-top:2px}
.sc-dash-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px;flex-wrap:wrap}
.sc-tiles-wrap{overflow-x:auto;padding-bottom:8px;margin-bottom:12px}
.sc-tiles{display:flex;gap:10px;min-width:max-content}
.sc-tile{flex:0 0 118px;background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:11px 12px;text-align:left;cursor:pointer;transition:.15s;display:flex;flex-direction:column;gap:3px}
.sc-tile:hover{border-color:#cbd5e1;box-shadow:0 2px 8px rgba(15,23,42,.07)}
.sc-tile-no{font-size:10.5px;font-weight:700}
.sc-tile-val{font-size:21px;font-weight:700;color:var(--navy);line-height:1.1}
.sc-tile-lbl{font-size:11px;font-weight:600;color:var(--navy);line-height:1.3}
.sc-tile-owner{font-size:10px;color:#94a3b8}
.sc-tile-off{background:#f8fafc;border-style:dashed;cursor:default;opacity:.72}
.sc-tile-off .sc-tile-val{color:#94a3b8;font-size:17px}
.sc-tile-off:hover{border-color:var(--border);box-shadow:none}
.sc-tile-on{border-color:#6d5bd0;background:#f5f2ff;box-shadow:0 2px 10px rgba(109,91,208,.16)}
.sc-filter-note{font-size:12px;color:var(--gray);margin:2px 0 14px;display:flex;align-items:center;gap:10px}
.sc-table td{vertical-align:top}
.sc-table tbody tr{cursor:pointer}
.sc-table tbody tr:hover{background:#f8fafc}
.sc-row-mine{background:#fbfaff}
.sc-row-new{box-shadow:inset 3px 0 0 #6d5bd0}
.sc-store-warn{background:#fef3c7;border:1px solid #fcd34d;color:#78350f;border-radius:8px;padding:11px 14px;font-size:12.5px;line-height:1.55;margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
/* -- PRINTED DOCUMENT SLIDE-OVER -- */
.sc-btn-off{opacity:.45;cursor:not-allowed;pointer-events:none}
.sc-doc-view{border:1px solid var(--border);background:var(--card);border-radius:6px;padding:4px 11px;font-size:11.5px;font-weight:600;color:var(--navy);cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s}
.sc-doc-view:hover{border-color:var(--navy);background:var(--ol)}
.sc-doc-back{position:fixed;inset:0;background:rgba(15,23,42,.32);z-index:940;animation:fadeIn .18s ease}
.sc-doc-panel{position:fixed;top:0;right:0;bottom:0;width:560px;max-width:100vw;z-index:950;background:var(--card);
  border-left:1px solid var(--border);box-shadow:-18px 0 44px rgba(15,23,42,.16);display:flex;flex-direction:column;animation:sc-doc-in .24s cubic-bezier(.4,0,.2,1)}
@keyframes sc-doc-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
.sc-doc-bar-top{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);flex-shrink:0}
.sc-doc-bar-t{font-size:14px;font-weight:700;color:var(--navy)}
.sc-doc-x{border:0;background:transparent;font-size:24px;line-height:1;color:var(--gray);cursor:pointer;padding:0 4px;border-radius:6px}
.sc-doc-x:hover{background:var(--ol);color:var(--navy)}
.sc-doc-body{flex:1;overflow-y:auto;padding:18px}
.sc-doc-foot{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px;border-top:1px solid var(--border);flex-shrink:0}
.sc-doc-head{border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px;background:linear-gradient(180deg,var(--ol),var(--card))}
.sc-doc-title{font-size:11px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--gray)}
.sc-doc-no{font-size:22px;font-weight:800;color:var(--navy);letter-spacing:-.4px;margin:4px 0 8px}
.sc-doc-sub{font-size:11.5px;color:var(--gray);margin-top:8px}
.sc-doc-sec{font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--gray);margin:18px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.sc-doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}
.sc-doc-r{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed var(--border);font-size:12.5px}
.sc-doc-r span{color:var(--gray);flex-shrink:0}
.sc-doc-r b{color:var(--navy);text-align:right;font-weight:600;word-break:break-word}
.sc-doc-bar{display:flex;align-items:flex-end;gap:1px;height:44px;margin:4px 0 6px}
.sc-doc-bar i{display:block;height:100%;background:var(--navy);border-radius:1px}
.sc-doc-barno{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;letter-spacing:2px;color:var(--gray);margin-bottom:6px}
.sc-doc-sign{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:26px;padding-top:6px}
.sc-doc-sign div{display:flex;flex-direction:column-reverse;gap:8px}
.sc-doc-sign span{font-size:10.5px;color:var(--gray)}
.sc-doc-sign i{display:block;border-top:1px solid var(--navy);height:26px}
@media print{.sidebar,.topbar,.sc-doc-back,.sc-doc-bar-top,.sc-doc-foot,#sc-agent-fab,#sc-agent-panel,#sc-agent-scrim{display:none!important}
  .sc-doc-panel{position:static;width:100%;box-shadow:none;border:0}}
.sc-store-warn b{color:#78350f}
.sc-new{display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:.4px;color:#fff;background:#6d5bd0;border-radius:4px;padding:1px 6px;margin-right:7px;vertical-align:1px}
.sc-ref{font-weight:700;color:var(--navy);font-size:12.5px}
.sc-chip{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;border:1.5px solid;white-space:nowrap}
.sc-chip.sc-green{background:#f0fdf4;color:#16a34a;border-color:#86efac}
.sc-chip.sc-blue{background:#eff6ff;color:#2563eb;border-color:#93c5fd}
.sc-chip.sc-amber{background:#fff7ed;color:#c2410c;border-color:#fed7aa}
.sc-chip.sc-red{background:#fef2f2;color:#b91c1c;border-color:#fca5a5}
.sc-chip.sc-grey{background:#f1f5f9;color:#64748b;border-color:#cbd5e1}
.sc-txn-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:12px;flex-wrap:wrap}
.sc-txn-title{flex:1;min-width:220px}
.sc-txn-right{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.sc-pending{font-size:11.5px;color:var(--gray)}
.sc-rail{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:16px}
.sc-rail-dot{width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700;border:1.5px solid var(--border);background:#fff;color:#94a3b8}
.sc-rail-dot.done{background:#f0fdf4;border-color:#86efac;color:#16a34a}
.sc-rail-dot.now{background:#6d5bd0;border-color:#6d5bd0;color:#fff;box-shadow:0 0 0 3px rgba(109,91,208,.18)}
.sc-sec{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:14px}
.sc-sec-h{font-size:13px;font-weight:700;color:#6d5bd0;border-left:3px solid #6d5bd0;padding-left:9px;margin-bottom:14px}
.sc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px 18px}
.sc-field{margin:0}
.sc-ro{font-size:13px;color:#64748b;background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:9px 11px;min-height:38px}
.sc-help{font-size:11px;color:var(--gray);margin-top:4px;line-height:1.5}
.sc-err{border-color:#fca5a5!important;background:#fef2f2}
.sc-err-msg{font-size:11px;color:#dc2626;margin-top:4px;font-weight:600}
.sc-yesno{display:flex;gap:8px}
.sc-radio{display:inline-flex;align-items:center;gap:6px;border:1.5px solid var(--border);border-radius:8px;padding:7px 13px;cursor:pointer;font-size:12.5px}
.sc-radio.on{border-color:#6d5bd0;background:#f5f2ff;color:#6d5bd0;font-weight:600}
.sc-radio input{accent-color:#6d5bd0}
.sc-kv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px 18px}
.sc-kv{display:flex;flex-direction:column;gap:2px}
.sc-kv span{font-size:11px;color:var(--gray)}
.sc-kv b{font-size:13px;color:var(--navy);font-weight:600}
.sc-flags{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:14px}
.sc-flag{display:flex;flex-direction:column;gap:1px}
.sc-flag span{font-size:10.5px;color:var(--gray)}
.sc-flag b{font-size:12.5px;color:var(--navy)}
.sc-compare{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.sc-panel{background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:2px}
.sc-panel span{font-size:11px;color:var(--gray)}
.sc-panel b{font-size:19px;color:var(--navy)}
.sc-panel em{font-size:11.5px;color:var(--gray);font-style:normal}
.sc-warn{border-radius:10px;padding:12px 15px;font-size:12.5px;line-height:1.6;margin-bottom:14px}
.sc-warn.green{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d}
.sc-warn.amber{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}
.sc-warn.red{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}
.sc-warn.blue{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}
.sc-continue{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.sc-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:6px}
.sc-act{border-radius:9px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid transparent}
.sc-act-green{background:#16a34a;color:#fff}
.sc-act-off{opacity:.42;cursor:not-allowed}
.sc-recon-reasons{display:flex;flex-direction:column;gap:5px;min-width:170px}
.sc-recon-reasons select{font-size:11.5px;padding:5px 8px}
.sc-act-amber{background:#fff;color:#c2410c;border-color:#fed7aa}
.sc-act-red{background:#fff;color:#b91c1c;border-color:#fca5a5}
.sc-toggle{display:inline-flex;align-items:center;gap:6px;margin-bottom:14px;font-size:12px;color:var(--gray)}
.sc-toggle button{border:1.5px solid var(--border);background:#fff;border-radius:8px;padding:5px 14px;font-size:12px;font-weight:600;cursor:pointer;color:var(--gray)}
.sc-toggle button.on{border-color:#6d5bd0;background:#f5f2ff;color:#6d5bd0}
.sc-phone-wrap{display:flex;justify-content:center;margin-bottom:16px}
.sc-phone{width:390px;max-width:100%;border:10px solid #1e1b2e;border-radius:34px;overflow:hidden;background:#f5f6fa;box-shadow:0 18px 40px rgba(15,23,42,.22)}
.sc-phone-bar{background:#6d5bd0;color:#fff;font-size:15px;font-weight:700;padding:16px 18px}
.sc-phone-ctx{background:#fff7ed;color:#9a3412;font-size:11.5px;font-weight:600;padding:8px 18px;border-bottom:1px solid #fed7aa}
.sc-phone-body{max-height:520px;overflow-y:auto;padding:12px}
.sc-phone-body .sc-sec{padding:13px 14px}
.sc-phone-body .sc-kv-grid,.sc-phone-body .sc-grid{grid-template-columns:1fr 1fr}
.sc-phone-body .sc-compare{grid-template-columns:1fr}
.sc-phone-actions{display:flex;flex-direction:column;gap:8px;padding:12px 14px;background:#fff;border-top:1px solid var(--border)}
.sc-phone-actions .sc-act{width:100%}
.sc-scrim{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:900}
.sc-sheet{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(460px,92vw);max-height:88vh;overflow-y:auto;background:#fff;border-radius:16px;padding:22px 24px;z-index:901;box-shadow:0 24px 60px rgba(15,23,42,.3)}
.sc-sheet-h{font-size:16px;font-weight:700;color:var(--navy);margin-bottom:14px}
.sc-sheet-f{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
.sc-mini{background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:14px;display:grid;gap:9px}
`;
  document.head.appendChild(el);
}
/* -- THE PERSONA LIST IS THIS FILE'S. core.js declares `enterprisePersonas` as an empty `let`
   and this line fills it, rather than core.js carrying eleven Sub-Contracting roles it knows
   nothing about. Load order makes it safe: core.js only reads the array at render time, and
   renderer.js — which triggers the first render — loads after this file. -- */
if(typeof enterprisePersonas!=='undefined')enterprisePersonas=SC_ACTORS;
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){scInjectCss();scLoad();scSeed();});
  else{scInjectCss();scLoad();scSeed();}
}
