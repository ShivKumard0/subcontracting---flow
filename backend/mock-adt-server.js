// Stand-in for the real NewForce Solutions website, so the Executive Layer demo has a genuine
// external system to connect to before the NewForce team hands over staging access.
//
// It runs on its OWN port and holds its OWN data deliberately: the Executive Layer backend
// reaches it over HTTP with a bearer token, exactly as it will reach the real thing. Swapping
// in the real ADT endpoint is then a config change (ADT_BASE_URL / ADT_API_KEY), not a code
// change.
//
// Serves:
//   GET  /                              the intake form (mirrors the real form's fields)
//   POST /submit                        form post; redirects back with a confirmation
//   GET  /api/employee-intake/latest    the polling endpoint the Executive Layer backend calls
//
// Run: node backend/mock-adt-server.js      Config: MOCK_ADT_PORT (4100), MOCK_ADT_API_KEY.
// Submissions are held in memory — restarting clears them, which is what you want for a demo.

const http = require('node:http');

const PORT = process.env.MOCK_ADT_PORT || 4100;
const API_KEY = process.env.MOCK_ADT_API_KEY || 'demo-adt-staging-key';

const submissions = [];
// The submission counter persists even though the submissions themselves do not. A real source
// system never reissues a record id, and this one restarting must not either: the Executive
// Layer's store outlives this process, so a counter that reset to 1 would offer 'ADT-SUB-0001'
// for a second, different client — which the Executive Layer correctly refuses, because it
// already has a client filed under that id. Only the id watermark is kept; the records are
// still cleared on restart, which is what you want for a demo.
const SEQ_FILE = require('node:path').join(__dirname, 'data', 'mock-adt-seq');
let submissionSeq = 1;
try {
  const saved = parseInt(require('node:fs').readFileSync(SEQ_FILE, 'utf8').trim(), 10);
  if (Number.isFinite(saved) && saved > 0) submissionSeq = saved;
} catch { /* first run, or the file was deleted to reset the demo */ }
function nextSubmissionId() {
  const id = 'ADT-SUB-' + String(submissionSeq++).padStart(4, '0');
  try {
    require('node:fs').mkdirSync(require('node:path').dirname(SEQ_FILE), { recursive: true });
    require('node:fs').writeFileSync(SEQ_FILE, String(submissionSeq));
  } catch { /* best effort — a demo that cannot persist the watermark still runs */ }
  return id;
}

const COUNTRIES = ['India', 'Netherlands', 'Germany', 'Spain', 'United Kingdom', 'United States', 'Singapore'];
const DIAL_CODES = ['+91', '+31', '+49', '+34', '+44', '+1', '+65'];
const LOOKING_FOR = ['Employer of Record (EOR)', 'Contractor Management', 'Payroll Outsourcing', 'Entity Setup', 'PEO Services'];
const HEARD_ABOUT = ['Google Search', 'LinkedIn', 'Referral', 'Conference / Event', 'Existing Customer', 'Other'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function opts(list, placeholder) {
  return '<option value="">' + esc(placeholder) + '</option>'
    + list.map((o) => '<option value="' + esc(o) + '">' + esc(o) + '</option>').join('');
}

function formPage(justSubmitted) {
  const banner = justSubmitted
    ? '<div class="ok">Thank you — submission <strong>' + esc(justSubmitted) + '</strong> received.'
      + ' The Executive Layer will pick this up on its next poll.</div>'
    : '';
  return '<!doctype html><html><head><meta charset="utf-8">'
    + '<title>NewForce Solutions — Get Started</title>'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>'
    + 'body{font-family:Inter,system-ui,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:40px 20px;color:#0f172a}'
    + '.card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:32px 34px}'
    + 'h1{font-size:20px;margin:0 0 4px}.sub{font-size:13px;color:#64748b;margin:0 0 26px}'
    + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 20px}'
    + '.full{grid-column:1/-1}'
    + 'label{display:block;font-size:12px;color:#64748b;margin-bottom:6px}'
    + 'input,select{width:100%;box-sizing:border-box;padding:11px 12px;font-size:14px;font-family:inherit;'
    + 'border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a}'
    + 'input:focus,select:focus{outline:none;border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.12)}'
    + '.phone{display:grid;grid-template-columns:120px 1fr;gap:10px}'
    + 'button{margin-top:26px;padding:12px 26px;font-size:14px;font-weight:600;font-family:inherit;'
    + 'background:#0d9488;color:#fff;border:none;border-radius:8px;cursor:pointer}'
    + 'button:hover{background:#0f766e}'
    + '.ok{background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;padding:12px 14px;border-radius:8px;'
    + 'font-size:13px;margin-bottom:22px}'
    + '.tag{display:inline-block;background:#f1f5f9;color:#475569;font-size:11px;font-weight:600;'
    + 'padding:3px 9px;border-radius:20px;margin-bottom:14px}'
    + '</style></head><body><div class="card">'
    + '<div class="tag">NEWFORCE SOLUTIONS</div>'
    + '<h1>Get started</h1>'
    + '<p class="sub">Tell us what you need and our team will get in touch.</p>'
    + banner
    + '<form method="POST" action="/submit"><div class="grid">'
    + '<div><label>Full name</label><input name="full_name" placeholder="Full name" required></div>'
    + '<div><label>Work email</label><input name="work_email" type="email" placeholder="Work email" required></div>'
    + '<div class="full"><label>Phone number</label><div class="phone">'
    + '<select name="phone_country_code">' + opts(DIAL_CODES, 'Select') + '</select>'
    + '<input name="phone_number" placeholder="Phone number"></div></div>'
    + '<div><label>Company name</label><input name="company_name" placeholder="Company name"></div>'
    + '<div><label>Country hiring in</label><select name="country_hiring_in">' + opts(COUNTRIES, 'Country hiring in') + '</select></div>'
    + '<div><label>What are you looking for?</label><select name="looking_for">' + opts(LOOKING_FOR, 'What are you looking for?') + '</select></div>'
    + '<div><label>How did you hear about us?</label><select name="heard_about_us">' + opts(HEARD_ABOUT, 'How did you hear about us?') + '</select></div>'
    + '</div><button type="submit">Submit</button></form>'
    + '</div></body></html>';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e5) { req.destroy(); reject(new Error('Body too large')); }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(formPage(url.searchParams.get('submitted')));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/submit') {
    let fields;
    try {
      fields = new URLSearchParams(await readBody(req));
    } catch {
      res.writeHead(413, { 'Content-Type': 'text/plain' });
      res.end('Payload too large');
      return;
    }
    const record = {
      id: nextSubmissionId(),
      submitted_at: new Date().toISOString(),
      full_name: fields.get('full_name') || '',
      work_email: fields.get('work_email') || '',
      phone_country_code: fields.get('phone_country_code') || '',
      phone_number: fields.get('phone_number') || '',
      company_name: fields.get('company_name') || '',
      country_hiring_in: fields.get('country_hiring_in') || '',
      looking_for: fields.get('looking_for') || '',
      heard_about_us: fields.get('heard_about_us') || ''
    };
    submissions.push(record);
    console.log('[mock-adt] submission ' + record.id + ' — ' + record.full_name);
    res.writeHead(303, { Location: '/?submitted=' + encodeURIComponent(record.id) });
    res.end();
    return;
  }

  // Programmatic submission — the same intake the HTML form above posts to, in JSON.
  // Used when the form is filled from inside the Executive Layer (Configure > Systems >
  // NewForce Solutions > USER), so that path still goes through ADT rather than shortcutting to
  // our own database. Requires the same bearer token as the polling endpoint.
  if (req.method === 'POST' && url.pathname === '/api/employee-intake/submit') {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer ' + API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    let body;
    try { body = JSON.parse((await readBody(req)) || '{}'); }
    catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
    if (!body.full_name || !String(body.full_name).trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'full_name is required' }));
      return;
    }
    const record = {
      id: nextSubmissionId(),
      submitted_at: new Date().toISOString(),
      // The Executive Layer's own id for this client, stored here and echoed back. A real source
      // system would hold it in an "external reference" field for exactly this reason: it is how
      // a human on this side knows which Executive Layer client this row is, and how the
      // Executive Layer re-links a record whose submit response it never received.
      external_ref: body.external_ref || null,
      full_name: body.full_name || '',
      work_email: body.work_email || '',
      phone_country_code: body.phone_country_code || '',
      phone_number: body.phone_number || '',
      company_name: body.company_name || '',
      country_hiring_in: body.country_hiring_in || '',
      looking_for: body.looking_for || '',
      heard_about_us: body.heard_about_us || ''
    };
    submissions.push(record);
    console.log('[mock-adt] submission ' + record.id + ' — ' + record.full_name + ' (api)');
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: record }));
    return;
  }

  // Field metadata for the intake form, so the Executive Layer can render ADT's form from
  // ADT's own definition rather than hardcoding a copy of it that silently drifts.
  if (req.method === 'GET' && url.pathname === '/api/employee-intake/schema') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      fields: [
        { name: 'full_name', label: 'Full name', type: 'text', required: true },
        { name: 'work_email', label: 'Work email', type: 'email', required: true },
        { name: 'phone_country_code', label: 'Phone number', type: 'select', options: DIAL_CODES, placeholder: 'Select' },
        { name: 'phone_number', label: '', type: 'text' },
        { name: 'company_name', label: 'Company name', type: 'text' },
        { name: 'country_hiring_in', label: 'Country hiring in', type: 'select', options: COUNTRIES },
        { name: 'looking_for', label: 'What are you looking for?', type: 'select', options: LOOKING_FOR },
        { name: 'heard_about_us', label: 'How did you hear about us?', type: 'select', options: HEARD_ABOUT }
      ]
    }));
    return;
  }

  // The polling endpoint. Returns the newest submission, or 204 when the caller's cursor is
  // already current — the same "nothing new" signal the real integration is expected to give.
  if (req.method === 'GET' && url.pathname === '/api/employee-intake/latest') {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer ' + API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    const since = url.searchParams.get('since');
    const latest = submissions[submissions.length - 1];
    if (!latest || (since && latest.id === since)) {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: latest }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.on('error', (err) => {
  console.error('[mock-adt] server error: ' + err.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('Mock NewForce Solutions site listening on http://localhost:' + PORT);
  console.log('  Form:  http://localhost:' + PORT + '/');
  console.log('  API:   GET /api/employee-intake/latest  (Bearer ' + API_KEY + ')');
});
