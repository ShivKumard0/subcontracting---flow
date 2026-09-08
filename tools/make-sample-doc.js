/* Generates sample-docs/Shiv_Kumar_Contract_Data.pdf — the EMPLOYEE INFORMATION FORM that gets
   uploaded into the contract journey's "Upload document to auto-fill".

   THE FLOW IT BELONGS TO: we send this form to the candidate, they complete it and return it, and
   the parser reads their answers off it to fill the contract form. So it is written in that voice
   — issued by us, addressed to them, completed and declared by them — and not as anything we
   authored about them. That is also why it asks for every field: we only get one round-trip.

   It is laid out as the contract form is laid out — the same sections, in the same order — so a
   returned sheet maps onto the record one-to-one, and uploading it fills the form completely.

   It is GENERATED rather than hand-drawn, from CCJ_SAMPLE_DOC in js/contract-journey.js, because
   every row of the extraction card cites the section of this sheet its value came from. That
   citation is a promise the value is on the paper. A hand-made PDF and a hand-written extractor
   would break that promise the first time either was edited, so both read one constant.

   Run:  NODE_PATH=<where playwright lives> node tools/make-sample-doc.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'sample-docs');
const SRC = fs.readFileSync(path.join(ROOT, 'js/contract-journey.js'), 'utf8');

// Read both constants out of the journey itself rather than restating them here.
function grab(name, re) {
  const m = SRC.match(re);
  if (!m) throw new Error(name + ' not found in js/contract-journey.js');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext('var ' + m[0].replace(/^const\s+/, ''), ctx);
  return ctx[name];
}
const D = grab('CCJ_SAMPLE_DOC', /const CCJ_SAMPLE_DOC=\{[\s\S]*?\n\};/);
const FORM = grab('CCJ_FORM', /const CCJ_FORM=\[[\s\S]*?\n\];/);

const monthly = Math.round(D.annual / 12);
const money = (n) => D.currency + ' ' + Number(n).toLocaleString('en-US');
// What the paper prints for a field: its `p` if it has one, otherwise the value the form stores.
const shown = (k) => { const f = D.fields[k] || {}; return f.p || f.v || ''; };
const WIDE = { address: 1, jobDesc: 1, workPermit: 1 };

let captured = 0;
const section = (s) => {
  const rows = s.fields.map((f) => {
    const om = (D.omitted || []).find((o) => o.k === f.k);
    if (om) return `<div class="f wide om"><span>${f.label}</span><b>&mdash; ${om.why}</b></div>`;
    if (!D.fields[f.k]) return '';
    captured++;
    return `<div class="f${WIDE[f.k] ? ' wide' : ''}"><span>${f.label}</span><b>${shown(f.k)}</b></div>`;
  }).join('');
  return `<h2>${s.title}</h2><div class="grid">${rows}</div>`;
};
const body = FORM.map(section).join('');
const total = FORM.reduce((n, s) => n + s.fields.length, 0);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 15mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color:#1a2233; font-size: 9.5pt; line-height:1.45; margin:0; }
  .head { display:flex; justify-content:space-between; align-items:flex-start;
          border-bottom: 2px solid #0f172a; padding-bottom: 9px; margin-bottom: 14px; }
  .brand { font-size: 16pt; font-weight: 800; letter-spacing:-.4px; color:#0f172a; }
  .brandsub { font-size: 6.8pt; letter-spacing:.9px; text-transform:uppercase; color:#64748b; margin-top:2px; }
  .ref { text-align:right; font-size:7pt; color:#64748b; line-height:1.8; }
  .ref b { display:block; font-size:9pt; color:#0f172a; letter-spacing:.2px; }
  h1 { font-size: 11.5pt; letter-spacing:.3px; color:#0f172a; margin: 0 0 3px; }
  .lede { color:#475569; margin: 0 0 4px; font-size: 8.6pt; }
  .count { display:inline-block; margin-bottom:12px; padding:2px 8px; border-radius:20px;
           background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; font-size:7.6pt; font-weight:bold; }
  h2 { font-size: 7.4pt; letter-spacing:1px; text-transform:uppercase; color:#0f172a;
       margin: 13px 0 7px; padding-bottom:4px; border-bottom:1px solid #0f172a; }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 7px 14px; }
  .f { border:1px solid #d7dee7; border-radius:4px; padding:5px 8px 6px; background:#fbfcfd; min-height:34px; }
  .f.wide { grid-column: 1 / -1; }
  .f span { display:block; font-size:6.6pt; letter-spacing:.7px; text-transform:uppercase; color:#64748b; }
  .f b { display:block; font-size:10pt; color:#0f172a; margin-top:2px; word-break:break-word; }
  .f.om { background:#fff; border-style:dashed; }
  .f.om b { color:#94a3b8; font-weight:normal; font-size:8.6pt; }
  .pay { margin-top:9px; padding:8px 10px; border:1px solid #0f172a; border-radius:4px; background:#fff; }
  .pay-r { display:flex; justify-content:space-between; align-items:baseline; }
  .pay-r span { color:#475569; font-size:8.6pt; }
  .pay-r b { font-size:11pt; }
  .pay-n { margin-top:4px; padding-top:5px; border-top:1px dashed #cbd5e1; color:#64748b; font-size:7.6pt; }
  .decl { margin-top:10px; padding:7px 10px; border-radius:4px; background:#f8fafc;
          border:1px solid #e2e8f0; color:#475569; font-size:8pt; line-height:1.6; }
  .decl b { color:#0f172a; }
  .sig { margin-top: 14px; display:flex; gap: 24px; }
  .sig div { flex:1; }
  .sigline { border-bottom: 1px solid #94a3b8; height: 24px; }
  .siglabel { font-size: 7pt; color:#64748b; margin-top:4px; }
  .foot { margin-top: 12px; padding-top: 8px; border-top: 1px dashed #cbd5e1;
          color:#64748b; font-size: 7pt; line-height:1.7; }
</style></head><body>
  <div class="head">
    <div><div class="brand">ADT</div><div class="brandsub">Employer of Record Services</div></div>
    <div class="ref">Form reference<b>${D.ref}</b>Returned<b>${D.issued}</b></div>
  </div>

  <h1>Employee Information Form</h1>
  <p class="lede">Issued by ${D.entity} to <b>${shown('fname')} ${shown('lname')}</b>.
  Please complete every field and return this form &mdash; your employment contract is raised
  directly from the answers below, so anything left blank has to be asked for again.</p>
  <div class="count">Completed by the employee &middot; ${captured} of ${total} fields answered</div>

  ${body}

  <div class="pay">
    <div class="pay-r"><span>Annual gross salary</span><b>${money(D.annual)}</b></div>
    <div class="pay-n">Stated annually. The contract record holds the monthly figure:
      ${money(D.annual)} &divide; 12 = <b>${money(monthly)}</b> per month.</div>
  </div>

  <div class="decl">
    <b>Declaration</b> &mdash; I confirm that the information I have given on this form is accurate
    and complete, and I understand my employment contract will be raised from it.
  </div>
  <div class="sig">
    <div><div class="sigline"></div><div class="siglabel">Employee signature &mdash; ${shown('fname')} ${shown('lname')}</div></div>
    <div><div class="sigline"></div><div class="siglabel">Date</div></div>
    <div><div class="sigline"></div><div class="siglabel">Received by &mdash; ${D.entity}</div></div>
  </div>

  <div class="foot">
    Return this form to onboarding@adt.com quoting ${D.ref}. &mdash; Sample form for demonstration
    of the contract-creation journey; the figures and identifiers on it are illustrative and do not
    describe a real engagement. Generated from CCJ_SAMPLE_DOC by tools/make-sample-doc.js &mdash;
    edit the constant, not this file.
  </div>
</body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const htmlPath = path.join(OUT, 'Shiv_Kumar_Contract_Data.html');
  fs.writeFileSync(htmlPath, html);

  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext()).newPage();
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));
  await page.waitForTimeout(300);
  const pdfPath = path.join(OUT, 'Shiv_Kumar_Contract_Data.pdf');
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
  await browser.close();

  console.log('wrote ' + path.relative(ROOT, pdfPath)
    + '  (' + Math.round(fs.statSync(pdfPath).size / 1024) + ' KB)');
  console.log(captured + ' of ' + total + ' form fields captured on the sheet');
  const missing = FORM.flatMap((s) => s.fields)
    .filter((f) => !D.fields[f.k] && !(D.omitted || []).some((o) => o.k === f.k))
    .map((f) => f.k);
  console.log(missing.length ? 'NOT ON THE SHEET: ' + missing.join(', ') : 'nothing unaccounted for');
})();
