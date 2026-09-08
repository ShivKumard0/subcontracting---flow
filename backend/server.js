// Storage backend for the Client store in the Executive Layer.
//
// Owns three things the browser used to own, and could not own correctly:
//   1. Identity  — the Client ID (employee_code) is minted here, inside the insert
//                  transaction, so it is unique across every operator rather than per
//                  browser (two tabs previously both minted the same code). The source
//                  system's own id for the client rides along in source_record_id; we
//                  record it, we do not mint it.
//   2. The ADT credential — the API key lives in this process, not in client-side JS.
//   3. The sync cursor — "what have we already ingested" is one row in sync_state, not a
//                  private localStorage value per browser.
//
// Run: node backend/server.js   (or `npm start` from inside backend/)
// Config: PORT (4000), ADT_BASE_URL, ADT_API_KEY, EXEC_API_TOKEN, ALLOWED_ORIGINS.
// Data persists in backend/data/employees.db.

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const connectors = require('./connectors');

const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'employees.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Points at backend/mock-adt-server.js by default. Repoint at the real ADT staging host once
// that contract is confirmed — the field mapping lives in one place (mapAdtSubmission below).
const ADT_BASE_URL = process.env.ADT_BASE_URL || 'http://localhost:4100';
const ADT_API_KEY = process.env.ADT_API_KEY || 'demo-adt-staging-key';
const ADT_LATEST_PATH = process.env.ADT_LATEST_PATH || '/api/employee-intake/latest';
const ADT_TIMEOUT_MS = 6000;

// Optional shared secret. Unset by default so the demo runs with no setup; set it for anything
// reachable beyond localhost, because these records hold names, emails and phone numbers.
const API_TOKEN = process.env.EXEC_API_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());

// Used only when ADT's /schema endpoint is unreachable — the Executive Layer's intake page has
// to render something. Mirrors the real form's fields.
const FALLBACK_INTAKE_FIELDS = [
  { name: 'full_name', label: 'Full name', type: 'text', required: true },
  { name: 'work_email', label: 'Work email', type: 'email', required: true },
  { name: 'phone_country_code', label: 'Phone number', type: 'select', options: ['+91', '+31', '+49', '+34', '+44', '+1', '+65'], placeholder: 'Select' },
  { name: 'phone_number', label: '', type: 'text' },
  { name: 'company_name', label: 'Company name', type: 'text' },
  { name: 'country_hiring_in', label: 'Country hiring in', type: 'select', options: ['India', 'Netherlands', 'Germany', 'Spain', 'United Kingdom', 'United States', 'Singapore'] },
  { name: 'looking_for', label: 'What are you looking for?', type: 'select', options: ['Employer of Record (EOR)', 'Contractor Management', 'Payroll Outsourcing', 'Entity Setup', 'PEO Services'] },
  { name: 'heard_about_us', label: 'How did you hear about us?', type: 'select', options: ['Google Search', 'LinkedIn', 'Referral', 'Conference / Event', 'Existing Customer', 'Other'] }
];

// The field list for the real CRM. Unlike the mock's, this one is not published by the system it
// describes — the middleware has no schema endpoint — so it is maintained here against
// Adtwebsite::_validateInputs('add'). `required` mirrors that validator exactly: the CRM rejects a
// lead missing any of these, and finding that out after a round trip rather than before is a worse
// experience for no gain. If the CRM's rules change, this list is what has to change with them.
const CRM_INTAKE_FIELDS = [
  { name: 'full_name', label: 'Full name', type: 'text', required: true },
  { name: 'work_email', label: 'Work email', type: 'email', required: true },
  { name: 'phone_country_code', label: 'Phone number', type: 'select', options: ['+91', '+31', '+49', '+34', '+44', '+1', '+65'], placeholder: 'Select', required: true },
  { name: 'phone_number', label: '', type: 'text', required: true },
  { name: 'company_name', label: 'Company name', type: 'text', required: true },
  { name: 'country_hiring_in', label: 'Country hiring in', type: 'select', options: ['India', 'Netherlands', 'Germany', 'Spain', 'United Kingdom', 'United States', 'Singapore'], required: true },
  { name: 'looking_for', label: 'What are you looking for?', type: 'select', options: ['Employer of Record (EOR)', 'Contractor Management', 'Payroll Outsourcing', 'Entity Setup', 'PEO Services'] },
  { name: 'heard_about_us', label: 'How did you hear about us?', type: 'select', options: ['Google Search', 'LinkedIn', 'Referral', 'Conference / Event', 'Existing Customer', 'Other'] }
];

const VALID_STATUSES = ['Pending', 'Active', 'Inactive'];
const VALID_SOURCES = ['manual', 'adt_solution', 'newforce_mw'];
// Columns a caller may edit through PATCH /employees/:code. Deliberately excludes identity and
// provenance (employee_code, source_record_id, source) — the first is set once by this server,
// the second is the source system's own id and ours to record rather than rewrite. An edit
// endpoint able to change either would defeat the point of minting them here.
// Also excludes status, which has its own endpoint so the audit log cannot be skipped.
const EDITABLE_FIELDS = [
  'name', 'email', 'phone_country_code', 'contact', 'company_name', 'country',
  'looking_for', 'heard_about_us', 'department', 'branch', 'job_title', 'join_date', 'description'
];

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

// `CREATE TABLE IF NOT EXISTS` silently does nothing against a database created by an older
// schema — and then schema.sql's own `CREATE INDEX ... (mirror_state)` crashes db.exec with a
// bare "no such column: mirror_state". So the currency check has to run BEFORE the schema is
// applied: it used to sit after, which meant the one situation it existed to explain was the
// one it never survived to see. mirror_state is in the required list for the same reason —
// it is the column the schema itself trips over first.
(function assertSchemaCurrent() {
  const hasTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='direct_employees'").get();
  if (!hasTable) return; // fresh database — schema.sql below creates everything
  const cols = db.prepare('PRAGMA table_info(direct_employees)').all().map((c) => c.name);
  const required = ['source_record_id', 'company_name', 'looking_for', 'heard_about_us', 'phone_country_code', 'mirror_state'];
  const missing = required.filter((c) => !cols.includes(c));
  if (missing.length) {
    console.error('Database at ' + DB_PATH + ' predates the current schema (missing: ' + missing.join(', ') + ').');
    console.error('To KEEP its records, run the migration:   node backend/migrate-client-ids.js');
    console.error('Or, if it is disposable demo data, delete it and restart:   rm -rf backend/data');
    process.exit(1);
  }
})();

db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/* ---------------------------------------------------------------- data access -- */

function hydrateEmployee(row) {
  if (!row) return row;
  // Stored as text; returned as an object so the client is not left double-parsing a JSON
  // string nested inside a JSON response.
  let payload = null;
  if (row.raw_source_payload) {
    try { payload = JSON.parse(row.raw_source_payload); } catch { payload = null; }
  }
  return Object.assign({}, row, { raw_source_payload: payload });
}

const findById = (id) => db.prepare('SELECT * FROM direct_employees WHERE id = ?').get(id);
const findByCode = (code) => db.prepare('SELECT * FROM direct_employees WHERE employee_code = ?').get(code);

/* ------------------------------------------------------------------------ stores -- */

const STORE_ID_PREFIX = 'STR-';
const STORE_ID_DIGITS = 6;
const BHAIYAA_REF_PREFIX = 'BHA-STR-';
const BHAIYAA_REF_DIGITS = 4;
// Our id and Bhaiyaa's, from two sequences. Same reasoning as the client ids: they are two
// systems' names for one store and must never be derivable from each other.
function mintStoreCode() {
  return STORE_ID_PREFIX + String(nextSequenceValue('store')).padStart(STORE_ID_DIGITS, '0');
}
function mintBhaiyaaRef() {
  return BHAIYAA_REF_PREFIX + String(nextSequenceValue('bhaiyaa_store_ref')).padStart(BHAIYAA_REF_DIGITS, '0');
}
const VALID_STORE_ROLES = ['seller', 'buyer'];
const VALID_KYC = ['Pending', 'Verified', 'Failed'];

const findStoreByCode = (code) => db.prepare('SELECT * FROM stores WHERE store_code = ?').get(code);
// Scoped by source for the same reason the client lookup is: two platforms may each mint '3675'
// for different stores, and the unique index is on the pair.
const findStoreBySourceRecord = (source, sourceRecordId) =>
  db.prepare('SELECT * FROM stores WHERE source = ? AND source_record_id = ?').get(source, sourceRecordId);

// Files one store that Bhaiyaa already opened.
//
// No id is minted for Bhaiyaa here — theirs arrived with the record, which is the whole difference
// between this and the client flow. Ours is minted because a store has to be nameable in this
// system too, and it lands `mirrored` because there is nothing left to push: both systems already
// hold it.
//
// KYC is the exception, and the reason this integration exists. Bhaiyaa's signup captures an
// Aadhaar document, never a number, so nothing has been verified against UIDAI at this point —
// the store arrives kyc_status 'Pending' and an Ops Manager clears it.
function ingestBhaiyaaStore(mapped) {
  return transaction(() => {
    const ts = nowIso();
    const code = mintStoreCode();
    const info = db.prepare(
      `INSERT INTO stores
         (store_code, source_record_id, source, mirror_state, role, store_name, auto_named,
          handle, category, store_type, plan, first_name, last_name, email,
          phone_country_code, mobile, mobile_verified, kyc_status, status, raw_signup,
          created_at, updated_at)
       VALUES (?,?,'bhaiyaa','mirrored',?,?,0,NULL,NULL,?,NULL,?,NULL,?,NULL,NULL,0,'Pending','Pending',?,?,?)`
    ).run(
      code, mapped.source_record_id, mapped.role, mapped.store_name, mapped.store_type,
      // Bhaiyaa's list and detail calls return the store, not the person. The merchant's name and
      // email would need a further retailer lookup; until that exists the columns stay empty
      // rather than holding a guess.
      mapped.retailer_id ? ('Retailer ' + mapped.retailer_id) : 'Unknown',
      '',
      JSON.stringify(mapped.raw || {}), ts, ts
    );
    const id = info.lastInsertRowid;
    db.prepare(
      'INSERT INTO store_events (store_id, title, actor_user, description, occurred_at) VALUES (?,?,?,?,?)'
    ).run(id, 'Signup completed on Bhaiyaa', 'Bhaiyaa Sync',
      'The merchant finished Bhaiyaa\'s signup. Filed here as ' + code
      + ', Bhaiyaa store ' + mapped.source_record_id + '. KYC has not run yet.', ts);
    return db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  });
}
function getStoreConsents(storeId) {
  return db.prepare('SELECT document, accepted_at FROM store_consents WHERE store_id = ? ORDER BY id').all(storeId);
}
function getStoreEvents(storeId) {
  return db.prepare('SELECT title, actor_user, description, occurred_at FROM store_events WHERE store_id = ? ORDER BY id').all(storeId);
}
// Booleans come back out of SQLite as 0/1; the client should not have to remember that.
function hydrateStore(row) {
  if (!row) return row;
  let signup = null;
  if (row.raw_signup) { try { signup = JSON.parse(row.raw_signup); } catch { signup = null; } }
  return Object.assign({}, row, {
    auto_named: !!row.auto_named,
    mobile_verified: !!row.mobile_verified,
    raw_signup: signup,
    consents: getStoreConsents(row.id),
    events: getStoreEvents(row.id)
  });
}
/* Rejects what the store cannot be read without, and one thing it must never carry: the full
   Aadhaar number. The client masks it before sending and this is the backstop — a server that
   silently accepted a 12-digit id into a column meant for four would make the privacy promise
   the UI prints a matter of client-side good behaviour. */
function validateStoreInput(body) {
  const errs = [];
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Body must be a JSON object');
  if (!body.store_name || !String(body.store_name).trim()) errs.push('store_name is required');
  if (!body.first_name || !String(body.first_name).trim()) errs.push('first_name is required');
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email))) errs.push('a valid email is required');
  if (!VALID_STORE_ROLES.includes(body.role)) errs.push("role must be 'seller' or 'buyer'");
  if (!body.store_type || !String(body.store_type).trim()) errs.push('store_type is required');
  if (body.kyc_status && !VALID_KYC.includes(body.kyc_status)) errs.push('unknown kyc_status');
  if (body.status && !VALID_STATUSES.includes(body.status)) errs.push('unknown status');
  if (body.aadhaar_masked && /\d{7,}/.test(String(body.aadhaar_masked).replace(/\s/g, ''))) {
    errs.push('aadhaar_masked must be masked — send only the last four digits');
  }
  if (!Array.isArray(body.consents) || !body.consents.length) errs.push('consents are required');
  if (errs.length) throw new HttpError(400, errs.join('; '));
}
// Scoped by source, matching the uq_de_source_record index. Two connected systems may each mint
// the same record id for different clients, so a source record id only identifies a row when you
// say which system said it.
const findBySourceRecord = (source, id) =>
  db.prepare('SELECT * FROM direct_employees WHERE source = ? AND source_record_id = ?').get(source, id);
const getLogs = (empId) => db.prepare('SELECT * FROM direct_employee_logs WHERE employee_id = ? ORDER BY id DESC').all(empId);
const getWorkflow = (empId) => db.prepare('SELECT * FROM direct_employee_workflow WHERE employee_id = ? ORDER BY id DESC').all(empId);

// The Workflow tab is the process view of the record — which stage of the intake-to-active
// lifecycle it has reached — as opposed to the Logs tab's field-level audit trail. Both are
// written from the same places, so the two tabs can never tell different stories.
function insertWorkflow(employeeId, title, description, actorUser) {
  const info = db.prepare(
    'INSERT INTO direct_employee_workflow (employee_id, occurred_at, title, actor_user, description) VALUES (?, ?, ?, ?, ?)'
  ).run(employeeId, nowIso(), title, actorUser || 'System', description);
  return db.prepare('SELECT * FROM direct_employee_workflow WHERE id = ?').get(info.lastInsertRowid);
}

function insertLog(employeeId, statusLabel, actionNote, actorUser) {
  const info = db.prepare(
    'INSERT INTO direct_employee_logs (employee_id, occurred_at, actor_user, status_label, action_note) VALUES (?, ?, ?, ?, ?)'
  ).run(employeeId, nowIso(), actorUser || 'System', statusLabel, actionNote);
  return db.prepare('SELECT * FROM direct_employee_logs WHERE id = ?').get(info.lastInsertRowid);
}

// Claims the next value of a named sequence. Callers must already be inside a transaction, so
// the claim and the INSERT that consumes it commit together — otherwise a crash between the
// two would burn an id, or two concurrent ingests could read the same next_value.
function nextSequenceValue(name) {
  const row = db.prepare('SELECT next_value FROM id_sequences WHERE name = ?').get(name);
  if (!row) throw new Error('Unknown id sequence: ' + name);
  db.prepare('UPDATE id_sequences SET next_value = next_value + 1 WHERE name = ?').run(name);
  return row.next_value;
}

// The Client ID, and the only place it is formed. Every client gets one from this single
// sequence whatever system it came from, because the id is OUR name for the record: an id whose
// prefix or counter varied by origin ('ADTEMP-' for NewForce, 'EMP001' for manual, as it once
// did) was answering "where did this come from" in the one field that must not depend on it.
// Provenance lives in `source`, which can be corrected; this id is issued once and never moves.
//
// Six digits, not four: the pad has to outlast the client base, and 'CLI-9999' followed by
// 'CLI-10000' would sort wrongly everywhere ids are compared as text.
const CLIENT_ID_PREFIX = 'CLI-';
const CLIENT_ID_DIGITS = 6;
function mintClientCode() {
  const seq = nextSequenceValue('client');
  return CLIENT_ID_PREFIX + String(seq).padStart(CLIENT_ID_DIGITS, '0');
}

function getSyncState(key) {
  const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSyncState(key, value) {
  db.prepare(
    'INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, nowIso());
}

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/* ------------------------------------------------------------------ http utils -- */

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes('*')
    ? '*'
    : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function sendJson(res, status, body, origin) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin));
  if (status === 204) { res.writeHead(204, corsHeaders(origin)); res.end(); return; }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let settled = false;
    const fail = (err) => { if (!settled) { settled = true; reject(err); } };
    req.on('data', (chunk) => {
      raw += chunk;
      // Reject explicitly rather than destroying the socket: a bare req.destroy() left the
      // caller with a connection reset and this promise pending forever.
      if (raw.length > 1e6) fail(new HttpError(413, 'Request body too large'));
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new HttpError(400, 'Invalid JSON body')); }
    });
    req.on('error', fail);
  });
}

function requireAuth(req) {
  if (!API_TOKEN) return;
  const auth = req.headers.authorization || '';
  if (auth !== 'Bearer ' + API_TOKEN) throw new HttpError(401, 'Unauthorized');
}

/* ------------------------------------------------------------------ validation -- */

// Validating here, before the INSERT, is what turns a bad status into a 400 the caller can act
// on. Relying on the table's CHECK constraint produced a generic 500, since only UNIQUE
// violations were being recognised.
function validateEmployeeInput(body, { partial } = {}) {
  const errors = [];
  if (!partial) {
    if (!body.name || !String(body.name).trim()) errors.push('name is required');
  } else if ('name' in body && !String(body.name || '').trim()) {
    errors.push('name cannot be blank');
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push('email is not a valid address');
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    errors.push('status must be one of: ' + VALID_STATUSES.join(', '));
  }
  if (body.source && !VALID_SOURCES.includes(body.source)) {
    errors.push('source must be one of: ' + VALID_SOURCES.join(', '));
  }
  if (errors.length) throw new HttpError(400, errors.join('; '));
}

/* --------------------------------------------------------------- ADT ingestion -- */

// The one place the ADT form's field names are mapped onto our columns. The names on the right
// come from the real intake form (Full name / Work email / Phone / Company name / Country
// hiring in / What are you looking for / How did you hear about us). Fallbacks are kept so a
// slightly different casing from the real API does not silently produce blank records.
function mapAdtSubmission(raw) {
  return {
    source_record_id: String(raw.id || raw.recordId || raw.reference || ''),
    name: raw.full_name || raw.fullName || raw.name || '',
    email: raw.work_email || raw.workEmail || raw.email || '',
    phone_country_code: raw.phone_country_code || raw.phoneCountryCode || '',
    contact: raw.phone_number || raw.phoneNumber || raw.contact || '',
    company_name: raw.company_name || raw.companyName || '',
    country: raw.country_hiring_in || raw.countryHiringIn || raw.country || '',
    looking_for: raw.looking_for || raw.lookingFor || '',
    heard_about_us: raw.heard_about_us || raw.heardAboutUs || ''
  };
}

async function fetchLatestAdtSubmission(sinceId) {
  const url = ADT_BASE_URL + ADT_LATEST_PATH + (sinceId ? '?since=' + encodeURIComponent(sinceId) : '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADT_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + ADT_API_KEY },
      signal: controller.signal
    });
  } catch (e) {
    throw new HttpError(502, 'Could not reach NewForce Solutions: ' + e.message);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return null;          // nothing newer than the cursor
  if (res.status === 401) throw new HttpError(502, 'NewForce Solutions rejected our credentials');
  if (!res.ok) throw new HttpError(502, 'NewForce Solutions returned ' + res.status + ' ' + res.statusText);
  let body;
  try { body = await res.json(); }
  catch { throw new HttpError(502, 'NewForce Solutions response was not valid JSON'); }
  return body && body.data ? body.data : body;
}

// Creates the client on our side and stops. Called before anything is sent anywhere, so the
// Client ID exists and is committed whether or not the source system can be reached. The intake
// body is kept verbatim in raw_source_payload, which is what makes a retry possible later: the
// exact payload to re-send is on the row rather than in the memory of a request that has ended.
function createMirrorPendingClient(body, sourceId) {
  const mapped = mapAdtSubmission(body);
  const source = sourceId || connectors.activeSourceId();
  return transaction(() => {
    const employeeCode = mintClientCode();
    const ts = nowIso();
    const info = db.prepare(
      `INSERT INTO direct_employees
         (employee_code, source_record_id, source, name, email, phone_country_code,
          contact, company_name, country, looking_for, heard_about_us, status, raw_source_payload,
          mirror_state, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, 'pending', ?, ?)`
    ).run(
      employeeCode, source,
      mapped.name, mapped.email, mapped.phone_country_code, mapped.contact,
      mapped.company_name, mapped.country, mapped.looking_for, mapped.heard_about_us,
      JSON.stringify(body), ts, ts
    );
    const row = db.prepare('SELECT * FROM direct_employees WHERE id = ?').get(info.lastInsertRowid);
    insertLog(row.id, 'Created',
      'Client created in the Executive Layer as ' + employeeCode + '. Awaiting confirmation from NewForce Solutions.',
      'Executive Layer');
    insertWorkflow(row.id, 'Client Created',
      'Client ID ' + employeeCode + ' minted by the Executive Layer'
      + (mapped.company_name ? (' for ' + mapped.company_name) : '') + '.', 'Executive Layer');
    return row;
  });
}

// Pushes a mirror-pending client to the source system and records the outcome either way.
// Never throws for a transport or remote failure: the caller wants the record back with its
// state updated, not an exception that would imply nothing happened. Only genuine programming
// faults propagate.
async function attemptMirror(row) {
  let payload = {};
  try { payload = row.raw_source_payload ? JSON.parse(row.raw_source_payload) : {}; } catch { payload = {}; }
  // Our Client ID travels with the record, so the source system stores OUR name for the client
  // alongside its own. That is what lets a human on either side line the two records up, and what
  // a later reconciliation would match on. Where it lands is the connector's business: the mock
  // has an external_ref field for it, the CRM has none and carries it in LAST_ACTIVITY instead.
  //
  // Which system this row belongs to decides how it is pushed — the row's own `source`, not the
  // currently configured one, so a mock-sourced client still retries against the mock after the
  // backend has been repointed at the real middleware.
  const result = await connectors.submitTo(row.source, payload, {
    externalRef: row.employee_code,
    actor: 'Executive Layer'
  });
  const submitted = result.ok ? (result.submission || null) : null;
  const failure = result.ok ? null : result.error;

  const ts = nowIso();
  if (failure) {
    db.prepare(
      `UPDATE direct_employees
          SET mirror_state = 'failed', mirror_error = ?, mirror_attempts = mirror_attempts + 1,
              mirror_last_try_at = ?, updated_at = ?
        WHERE id = ?`
    ).run(failure, ts, ts, row.id);
    insertLog(row.id, 'Updated', 'Mirror to NewForce Solutions failed: ' + failure, 'Executive Layer');
    // `field` names the input the operator has to fix, when the source system's rejection was
    // specific enough to say. Carried out to the UI so the message lands under that input.
    return { ok: false, error: failure, field: result.field || null };
  }

  const sourceRecordId = result.sourceRecordId;
  // The source system can hand back an id we already hold — most plausibly because it was
  // restored from a backup, or (in this demo) restarted with its counter rewound. Storing it
  // would attach two different clients to one source record, so the composite unique index
  // refuses. That refusal is a mirror failure like any other, not a 500: the record stays, the
  // reason is recorded in plain words, and Retry is available once the collision is resolved.
  // Scoped to this row's own source, because the index is: two systems may both mint '27800'.
  const clash = findBySourceRecord(row.source, sourceRecordId);
  if (clash && clash.id !== row.id) {
    const msg = 'NewForce Solutions returned source record ' + sourceRecordId
      + ', which is already held by ' + clash.employee_code + '.';
    db.prepare(
      `UPDATE direct_employees
          SET mirror_state = 'failed', mirror_error = ?, mirror_attempts = mirror_attempts + 1,
              mirror_last_try_at = ?, updated_at = ?
        WHERE id = ?`
    ).run(msg, ts, ts, row.id);
    insertLog(row.id, 'Updated', 'Mirror to NewForce Solutions failed: ' + msg, 'Executive Layer');
    return { ok: false, error: msg };
  }

  transaction(() => {
    db.prepare(
      `UPDATE direct_employees
          SET source_record_id = ?, mirror_state = 'mirrored', mirror_error = NULL,
              mirror_attempts = mirror_attempts + 1, mirror_last_try_at = ?, updated_at = ?
        WHERE id = ?`
    ).run(sourceRecordId, ts, ts, row.id);
    insertLog(row.id, 'Updated',
      'Mirrored to NewForce Solutions, filed there as ' + sourceRecordId + '.', 'NewForce Solutions Sync');
    insertWorkflow(row.id, 'Mirrored to Source System',
      'NewForce Solutions accepted Client ID ' + row.employee_code + ' and filed it as ' + sourceRecordId + '.',
      'NewForce Solutions Sync');
    insertWorkflow(row.id, 'Pending HR Review',
      'Record held as Pending. HR must supply department, job title, branch and joining date before activation.',
      'Executive Layer');
  });
  // Move the cursor past this submission so the background poller does not re-ingest the record
  // we just pushed as though it were a new arrival. Only the mock is polled — the middleware
  // publishes no read-back endpoint, and writing a CRM user_id into the mock's cursor would
  // strand the poller on an id it will never be handed.
  if (row.source === 'adt_solution') setSyncState('adt_last_seen_source_id', sourceRecordId);
  return { ok: true, submission: submitted };
}

// Writes one ADT submission into master data. Everything the form does not ask for
// (department, job title, branch, join date) is left null, and the record lands in 'Pending'
// precisely because it is incomplete — HR fills the gaps and then activates it from the Logs tab.
function ingestAdtSubmission(raw) {
  const mapped = mapAdtSubmission(raw);
  if (!mapped.source_record_id) throw new HttpError(502, 'ADT submission has no id to deduplicate on');
  if (!mapped.name) throw new HttpError(502, 'ADT submission has no full name');

  // Idempotency: the same submission replayed (poll retry, backend restart, cursor reset)
  // resolves to the row it already created rather than a duplicate.
  const existing = findBySourceRecord('adt_solution', mapped.source_record_id);
  if (existing) return { employee: hydrateEmployee(existing), created: false };

  // A record we pushed out and then lost the response for comes back through the poller as a
  // brand-new arrival. It is not one: external_ref carries the Client ID we already minted, so
  // the submission is reconciled onto that row instead of creating a second client for the same
  // person. Without this, every failed mirror that actually landed would duplicate on next poll.
  const externalRef = raw && (raw.external_ref || raw.externalRef);
  if (externalRef) {
    const ours = findByCode(String(externalRef));
    if (ours && !ours.source_record_id) {
      const ts = nowIso();
      db.prepare(
        `UPDATE direct_employees
            SET source_record_id = ?, mirror_state = 'mirrored', mirror_error = NULL, updated_at = ?
          WHERE id = ?`
      ).run(mapped.source_record_id, ts, ours.id);
      insertLog(ours.id, 'Updated',
        'Reconciled with NewForce Solutions source record ' + mapped.source_record_id
        + ' — the mirror had in fact succeeded.', 'NewForce Solutions Sync');
      return { employee: hydrateEmployee(findById(ours.id)), created: false };
    }
  }

  const employee = transaction(() => {
    // The only id minted here is ours. The source system's id for this same client arrived with
    // the submission and is stored as-is — inventing a second id of our own on top of it is what
    // the retired reference_id did, and it only ever confused which system named what.
    //
    // mirror_state 'mirrored': this record came IN from the source system, so both ids exist and
    // agree from the first instant. Nothing is owed outbound. The 'pending'/'failed' states are
    // for the opposite direction, where we mint first and push second.
    const employeeCode = mintClientCode();
    const sourceRecordId = mapped.source_record_id;
    const ts = nowIso();
    const info = db.prepare(
      `INSERT INTO direct_employees
         (employee_code, source_record_id, source, name, email, phone_country_code,
          contact, company_name, country, looking_for, heard_about_us, status, raw_source_payload,
          mirror_state, created_at, updated_at)
       VALUES (?, ?, 'adt_solution', ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, 'mirrored', ?, ?)`
    ).run(
      employeeCode, sourceRecordId, mapped.name, mapped.email,
      mapped.phone_country_code, mapped.contact, mapped.company_name, mapped.country,
      mapped.looking_for, mapped.heard_about_us, JSON.stringify(raw), ts, ts
    );
    const row = db.prepare('SELECT * FROM direct_employees WHERE id = ?').get(info.lastInsertRowid);
    insertLog(row.id, 'Created',
      'Client received from the NewForce Solutions intake form — source record ' + sourceRecordId + '.', 'NewForce Solutions Sync');
    insertLog(row.id, 'Pending',
      'Awaiting HR review: department, job title, branch and joining date are not captured by the NewForce form.',
      'NewForce Solutions Sync');
    insertWorkflow(row.id, 'Intake Form Submitted',
      'Client intake form submitted on NewForce Solutions, filed there as ' + sourceRecordId
      + (mapped.company_name ? (' from ' + mapped.company_name) : '') + '.', 'NewForce Solutions');
    insertWorkflow(row.id, 'Record Ingested',
      'Executive Layer retrieved the submission and created Client ID ' + employeeCode
      + ', linked to NewForce Solutions source record ' + sourceRecordId + '.', 'NewForce Solutions Sync');
    insertWorkflow(row.id, 'Pending HR Review',
      'Record held as Pending. HR must supply department, job title, branch and joining date before activation.',
      'Executive Layer');
    return row;
  });

  return { employee: hydrateEmployee(employee), created: true };
}

/* ---------------------------------------------------------------------- routes -- */

async function handle(req, res, url, segments) {
  const origin = req.headers.origin;

  // GET /health — unauthenticated on purpose, so it is usable as a liveness probe.
  if (req.method === 'GET' && segments[0] === 'health' && segments.length === 1) {
    sendJson(res, 200, {
      status: 'ok',
      adtBaseUrl: ADT_BASE_URL,
      authRequired: Boolean(API_TOKEN),
      employees: db.prepare('SELECT COUNT(*) AS n FROM direct_employees').get().n,
      stores: db.prepare('SELECT COUNT(*) AS n FROM stores').get().n
    }, origin);
    return;
  }

  requireAuth(req);

  // GET /employees?status=&q=&page=&pageSize=
  if (req.method === 'GET' && segments[0] === 'employees' && segments.length === 1) {
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10) || 50));

    if (status && !VALID_STATUSES.includes(status)) throw new HttpError(400, 'Unknown status filter: ' + status);

    const where = [];
    const params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (q) {
      // Both ids are searchable: an operator holding a NewForce ticket knows the source record
      // id, one working inside the Executive Layer knows the client id, and neither should have
      // to translate before they can find the row.
      where.push('(name LIKE ? OR employee_code LIKE ? OR source_record_id LIKE ? OR email LIKE ? OR company_name LIKE ?)');
      const like = '%' + q + '%';
      params.push(like, like, like, like, like);
    }
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const total = db.prepare('SELECT COUNT(*) AS n FROM direct_employees' + clause).get(...params).n;
    const rows = db.prepare(
      'SELECT * FROM direct_employees' + clause + ' ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(...params, pageSize, (page - 1) * pageSize);

    sendJson(res, 200, {
      employees: rows.map(hydrateEmployee),
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize))
    }, origin);
    return;
  }

  // GET /employees/:code — everything the drawer renders, in one round trip.
  if (req.method === 'GET' && segments[0] === 'employees' && segments.length === 2) {
    const employee = findByCode(decodeURIComponent(segments[1]));
    if (!employee) throw new HttpError(404, 'Employee not found');
    sendJson(res, 200, {
      employee: hydrateEmployee(employee),
      logs: getLogs(employee.id),
      workflow: getWorkflow(employee.id)
    }, origin);
    return;
  }

  // POST /employees — manual creation. ADT-sourced records come in through /adt/poll instead.
  if (req.method === 'POST' && segments[0] === 'employees' && segments.length === 1) {
    const body = await readJsonBody(req);
    validateEmployeeInput(body);
    const employee = transaction(() => {
      // The same mint as every other path. A hand-typed client is still a client, so it draws
      // from the one sequence and wears the one prefix; that it was typed rather than ingested
      // is shown by `source`, which is where that fact belongs. (This used to be 'EMP001' from
      // a separate counter, which meant the id told you how the record was created.)
      const code = body.employee_code || mintClientCode();
      // Nothing is owed outbound for a client created here — 'not_required' rather than
      // 'pending', so the retry sweep never picks up a record that was never meant to leave.
      const mirrorState = body.source_record_id ? 'mirrored' : 'not_required';
      const ts = nowIso();
      const info = db.prepare(
        `INSERT INTO direct_employees
           (employee_code, source_record_id, source, name, email, phone_country_code,
            contact, company_name, country, looking_for, heard_about_us, department, branch,
            job_title, join_date, description, status, raw_source_payload, mirror_state,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        // A manually created client has no source system, so it has no source record id —
        // null, not a stand-in. The column stays available for rows keyed into an external
        // system by hand.
        code, body.source_record_id || null, body.source || 'manual',
        body.name, body.email || null, body.phone_country_code || null, body.contact || null,
        body.company_name || null, body.country || null, body.looking_for || null,
        body.heard_about_us || null, body.department || null, body.branch || null,
        body.job_title || null, body.join_date || null, body.description || null,
        body.status || 'Pending',
        body.raw_source_payload ? JSON.stringify(body.raw_source_payload) : null, mirrorState, ts, ts
      );
      const row = db.prepare('SELECT * FROM direct_employees WHERE id = ?').get(info.lastInsertRowid);
      insertLog(row.id, 'Created', body.creation_note || 'Employee record created', body.actor_user || 'System');
      return row;
    });
    sendJson(res, 201, { employee: hydrateEmployee(employee), logs: getLogs(employee.id) }, origin);
    return;
  }

  // PATCH /employees/:code — HR completing the details the ADT form does not capture.
  if (req.method === 'PATCH' && segments[0] === 'employees' && segments.length === 2) {
    const employee = findByCode(decodeURIComponent(segments[1]));
    if (!employee) throw new HttpError(404, 'Employee not found');
    const body = await readJsonBody(req);
    validateEmployeeInput(body, { partial: true });

    const updates = EDITABLE_FIELDS.filter((f) => f in body);
    if (!updates.length) throw new HttpError(400, 'No editable fields supplied');

    const changed = updates.filter((f) => (body[f] || null) !== (employee[f] || null));
    const updated = transaction(() => {
      db.prepare(
        'UPDATE direct_employees SET ' + updates.map((f) => f + ' = ?').join(', ') +
        ', updated_at = ? WHERE id = ?'
      ).run(...updates.map((f) => (body[f] === '' ? null : body[f])), nowIso(), employee.id);
      if (changed.length) {
        insertLog(employee.id, 'Updated',
          body.comment || ('Updated ' + changed.join(', ') + '.'), body.user || 'Admin');
        insertWorkflow(employee.id, 'Details Completed',
          'HR supplied ' + changed.join(', ') + '.', body.user || 'Admin');
      }
      return db.prepare('SELECT * FROM direct_employees WHERE id = ?').get(employee.id);
    });
    sendJson(res, 200, {
      employee: hydrateEmployee(updated), logs: getLogs(employee.id), workflow: getWorkflow(employee.id)
    }, origin);
    return;
  }

  // PATCH /employees/:code/status — the Logs tab's status form.
  // The row update and its log entry are one transaction: previously status could only be
  // changed by POSTing a log, which left the log saying "Inactive" while the row still said
  // "Active". Here they cannot diverge.
  if (req.method === 'PATCH' && segments[0] === 'employees' && segments[2] === 'status' && segments.length === 3) {
    const employee = findByCode(decodeURIComponent(segments[1]));
    if (!employee) throw new HttpError(404, 'Employee not found');
    const body = await readJsonBody(req);

    if (!body.status) throw new HttpError(400, 'status is required');
    if (!VALID_STATUSES.includes(body.status)) {
      throw new HttpError(400, 'status must be one of: ' + VALID_STATUSES.join(', '));
    }
    // The UI marks Comment required; enforce it here too, so the audit trail cannot be
    // sidestepped by calling the API directly.
    if (!body.comment || !String(body.comment).trim()) throw new HttpError(400, 'comment is required');
    if (body.status === employee.status) {
      throw new HttpError(409, 'Employee is already ' + employee.status);
    }

    const result = transaction(() => {
      db.prepare('UPDATE direct_employees SET status = ?, updated_at = ? WHERE id = ?')
        .run(body.status, nowIso(), employee.id);
      const log = insertLog(employee.id, body.status, String(body.comment).trim(), body.user || 'Admin');
      insertWorkflow(employee.id, 'Status changed to ' + body.status,
        employee.status + ' → ' + body.status + '. ' + String(body.comment).trim(), body.user || 'Admin');
      return { row: db.prepare('SELECT * FROM direct_employees WHERE id = ?').get(employee.id), log };
    });

    // Ours first, theirs second — the same order as creation, and for the same reason: the
    // operator's decision and its audit entry are committed before anything is sent anywhere, so
    // an outage at the source system cannot lose them. A push that fails is recorded as a further
    // log entry rather than rolled back, because the status here really did change.
    //
    // Only for a client the source system actually holds. A record that never mirrored has no
    // counterpart to update, and one created here manually has no source system at all.
    let statusPush = null;
    if (result.row.source_record_id && result.row.mirror_state === 'mirrored') {
      statusPush = await connectors.pushStatusTo(result.row.source, result.row.source_record_id, body.status, {
        externalRef: result.row.employee_code,
        actor: body.user || 'Admin'
      });
      if (statusPush.supported === false) {
        statusPush = null;                       // nowhere to send it; not a failure to report
      } else if (statusPush.ok) {
        // Only worth a line in the trail when something actually moved over there. Re-stating a
        // status the CRM already held is not news.
        if (statusPush.changed) {
          insertLog(employee.id, 'Updated',
            'Status ' + body.status + ' pushed to NewForce Solutions (record '
            + result.row.source_record_id + ').', 'NewForce Solutions Sync');
        }
      } else {
        insertLog(employee.id, 'Updated',
          'Status ' + body.status + ' could NOT be pushed to NewForce Solutions: ' + statusPush.error
          + ' The two systems now disagree until this is retried.', 'NewForce Solutions Sync');
      }
    }

    sendJson(res, 200, {
      employee: hydrateEmployee(findById(employee.id)), log: result.log,
      // What happened to the onward push, said plainly rather than left for the caller to infer
      // from the log text: null when there was nowhere to send it.
      statusSync: statusPush ? {
        ok: statusPush.ok,
        changed: statusPush.ok ? statusPush.changed : false,
        error: statusPush.ok ? null : statusPush.error
      } : null,
      logs: getLogs(employee.id), workflow: getWorkflow(employee.id)
    }, origin);
    return;
  }

  // POST /employees/:code/logs — free-standing comment, no status change.
  if (req.method === 'POST' && segments[0] === 'employees' && segments[2] === 'logs' && segments.length === 3) {
    const employee = findByCode(decodeURIComponent(segments[1]));
    if (!employee) throw new HttpError(404, 'Employee not found');
    const body = await readJsonBody(req);
    if (!body.status || !body.action) throw new HttpError(400, 'status and action are required');
    sendJson(res, 201, { log: insertLog(employee.id, body.status, body.action, body.user) }, origin);
    return;
  }

  // POST /employees/:code/workflow — the drawer's Workflow tab.
  if (req.method === 'POST' && segments[0] === 'employees' && segments[2] === 'workflow' && segments.length === 3) {
    const employee = findByCode(decodeURIComponent(segments[1]));
    if (!employee) throw new HttpError(404, 'Employee not found');
    const body = await readJsonBody(req);
    if (!body.title || !body.description) throw new HttpError(400, 'title and description are required');
    const info = db.prepare(
      'INSERT INTO direct_employee_workflow (employee_id, occurred_at, title, actor_user, description) VALUES (?, ?, ?, ?, ?)'
    ).run(employee.id, nowIso(), body.title, body.user || 'System', body.description);
    sendJson(res, 201, {
      entry: db.prepare('SELECT * FROM direct_employee_workflow WHERE id = ?').get(info.lastInsertRowid)
    }, origin);
    return;
  }

  // GET /adt/status — what the "Live NewForce Solutions Sync" panel shows before anything arrives.
  if (req.method === 'GET' && segments[0] === 'adt' && segments[1] === 'status' && segments.length === 2) {
    sendJson(res, 200, {
      baseUrl: ADT_BASE_URL,
      lastSeenSourceId: getSyncState('adt_last_seen_source_id'),
      lastPolledAt: getSyncState('adt_last_polled_at'),
      ingestedCount: db.prepare("SELECT COUNT(*) AS n FROM direct_employees WHERE source = 'adt_solution'").get().n
    }, origin);
    return;
  }

  // POST /adt/poll — one poll of NewForce Solutions. The frontend calls this on an interval; the
  // credential and the cursor both stay on this side of the wire.
  if (req.method === 'POST' && segments[0] === 'adt' && segments[1] === 'poll' && segments.length === 2) {
    const since = getSyncState('adt_last_seen_source_id');
    const raw = await fetchLatestAdtSubmission(since);
    setSyncState('adt_last_polled_at', nowIso());
    if (!raw) { sendJson(res, 200, { status: 'idle' }, origin); return; }

    const { employee, created } = ingestAdtSubmission(raw);
    setSyncState('adt_last_seen_source_id', employee.source_record_id);
    sendJson(res, 200, {
      status: created ? 'ingested' : 'duplicate',
      employee,
      logs: getLogs(employee.id),
      workflow: getWorkflow(employee.id),
      submission: raw
    }, origin);
    return;
  }

  // GET /adt/form-schema — ADT's own definition of its intake form, proxied so the Executive
  // Layer renders the real field list instead of a hardcoded copy that drifts when ADT changes
  // the form. Falls back to the known field set if ADT is unreachable, since the page has to
  // render something.
  if (req.method === 'GET' && segments[0] === 'adt' && segments[1] === 'form-schema' && segments.length === 2) {
    // The middleware publishes no schema endpoint, so against the real CRM the field list is ours
    // and is maintained here — including which fields are mandatory, which the CRM enforces on
    // submit and the form should therefore enforce before spending a round trip on it.
    if (connectors.activeSourceId() === 'newforce_mw') {
      sendJson(res, 200, { fields: CRM_INTAKE_FIELDS, source: 'newforce_mw', published: false }, origin);
      return;
    }
    let schema = null;
    try {
      const r = await fetch(ADT_BASE_URL + '/api/employee-intake/schema', { headers: { Accept: 'application/json' } });
      if (r.ok) schema = await r.json();
    } catch { /* fall through to the built-in default below */ }
    sendJson(res, 200, schema || { fields: FALLBACK_INTAKE_FIELDS, fallback: true }, origin);
    return;
  }

  // POST /adt/submit — create a client here and mirror it out to NewForce Solutions.
  //
  // Ours first, theirs second. The Client ID is minted and committed locally before anything is
  // sent, and only then is the record pushed to the source system, whose own id comes back and
  // is stored as source_record_id. That order is what makes the two ids mean what they say: ours
  // names the record in our store from the instant it exists, theirs names the same client in
  // theirs from the instant they accept it.
  //
  // The push is therefore allowed to fail without destroying anything. The record stays, marked
  // mirror_state='failed' with the reason, and is retryable from the UI — an operator's work is
  // never discarded because a third-party endpoint was down for ten seconds.
  if (req.method === 'POST' && segments[0] === 'adt' && segments[1] === 'submit' && segments.length === 2) {
    const body = await readJsonBody(req);
    if (!body.full_name || !String(body.full_name).trim()) throw new HttpError(400, 'Full name is required');
    if (body.work_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.work_email)) {
      throw new HttpError(400, 'Work email is not a valid address');
    }

    // Refusals we can see coming are settled before a Client ID is minted, so a client the source
    // system will never accept does not become a record here that can never mirror. Everything
    // else still follows the ours-first order below.
    const source = connectors.activeSourceId();
    const pre = await connectors.precheckAt(source, body);
    if (!pre.ok) {
      sendJson(res, 409, { status: 'rejected', error: pre.error, field: pre.field || null }, origin);
      return;
    }

    const employeeRow = createMirrorPendingClient(body, source);
    const result = await attemptMirror(employeeRow);
    const employee = hydrateEmployee(findById(employeeRow.id));

    // 201 when the round trip completed, 202 when the record is real but not yet mirrored —
    // a different outcome deserves a different code, and the UI branches on it.
    sendJson(res, result.ok ? 201 : 202, {
      status: result.ok ? 'ingested' : 'mirror_failed',
      mirrorState: employee.mirror_state,
      mirrorError: employee.mirror_error || null,
      mirrorField: result.field || null,
      employee,
      logs: getLogs(employee.id),
      workflow: getWorkflow(employee.id),
      submission: result.submission || null
    }, origin);
    return;
  }

  // POST /employees/:code/mirror-retry — push a failed or pending client out again.
  if (req.method === 'POST' && segments[0] === 'employees' && segments[2] === 'mirror-retry' && segments.length === 3) {
    const row = findByCode(decodeURIComponent(segments[1]));
    if (!row) throw new HttpError(404, 'Client not found');
    if (row.mirror_state === 'mirrored') throw new HttpError(409, 'This client is already mirrored to ' + row.source);
    if (row.mirror_state === 'not_required') throw new HttpError(409, 'This client was created here and is not mirrored anywhere');
    const result = await attemptMirror(row);
    const employee = hydrateEmployee(findById(row.id));
    sendJson(res, result.ok ? 200 : 202, {
      status: result.ok ? 'mirrored' : 'mirror_failed',
      mirrorState: employee.mirror_state,
      mirrorError: employee.mirror_error || null,
      employee,
      logs: getLogs(employee.id),
      workflow: getWorkflow(employee.id)
    }, origin);
    return;
  }

  /* ---------------------------------------------------------------- stores -- */

  // GET /stores?status=&role=&q=&page=&pageSize=
  if (req.method === 'GET' && segments[0] === 'stores' && segments.length === 1) {
    const status = url.searchParams.get('status');
    const role = url.searchParams.get('role');
    const q = (url.searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10) || 50));
    if (status && !VALID_STATUSES.includes(status)) throw new HttpError(400, 'Unknown status filter: ' + status);
    if (role && !VALID_STORE_ROLES.includes(role)) throw new HttpError(400, 'Unknown role filter: ' + role);

    const where = [];
    const params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (role) { where.push('role = ?'); params.push(role); }
    if (q) {
      // Both ids searchable, same reasoning as the client listing: whoever is holding a Bhaiyaa
      // reference should not have to translate it into ours before they can find the row.
      where.push('(store_name LIKE ? OR store_code LIKE ? OR source_record_id LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR category LIKE ?)');
      const like = '%' + q + '%';
      params.push(like, like, like, like, like, like, like);
    }
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const total = db.prepare('SELECT COUNT(*) AS n FROM stores' + clause).get(...params).n;
    const rows = db.prepare('SELECT * FROM stores' + clause + ' ORDER BY id DESC LIMIT ? OFFSET ?')
      .all(...params, pageSize, (page - 1) * pageSize);
    // Counts over the whole table, not the filtered slice — the stat tiles are how you change
    // the filter, so counting them against the current filter would make them self-referential.
    const counts = { Pending: 0, Active: 0, Inactive: 0 };
    db.prepare('SELECT status, COUNT(*) AS n FROM stores GROUP BY status').all()
      .forEach((r) => { if (r.status in counts) counts[r.status] = r.n; });
    sendJson(res, 200, {
      stores: rows.map(hydrateStore), counts,
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize))
    }, origin);
    return;
  }

  // GET /stores/:code — the whole drawer in one round trip.
  if (req.method === 'GET' && segments[0] === 'stores' && segments.length === 2) {
    const store = findStoreByCode(decodeURIComponent(segments[1]));
    if (!store) throw new HttpError(404, 'Store not found');
    sendJson(res, 200, { store: hydrateStore(store) }, origin);
    return;
  }

  /* POST /stores — the store creation journey's write.
     One transaction covers the id mint, the row, the consents and the trail, so a crash halfway
     cannot leave a store with no record of what was agreed or how it got here. */
  if (req.method === 'POST' && segments[0] === 'stores' && segments.length === 1) {
    const body = await readJsonBody(req);
    validateStoreInput(body);
    const store = transaction(() => {
      const ts = nowIso();
      const code = mintStoreCode();
      // Bhaiyaa is a mock in this environment, so its id is minted here on its own counter. When
      // a real Bhaiyaa stands behind this, the ref comes back from that call and this line goes:
      // the column, the mirror_state machine and the per-source unique index are already shaped
      // for an id that arrives late or not at all.
      const ref = mintBhaiyaaRef();
      const info = db.prepare(
        `INSERT INTO stores
           (store_code, source_record_id, source, mirror_state, role, store_name, auto_named,
            handle, category, store_type, plan, gst_position, credit_line, payment_terms,
            first_name, last_name, email, phone_country_code, mobile, mobile_verified,
            aadhaar_masked, kyc_status, kyc_verified_by, kyc_verified_at,
            status, raw_signup, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        code, ref, 'bhaiyaa', 'mirrored', body.role, String(body.store_name).trim(),
        body.auto_named ? 1 : 0, body.handle || null, body.category || null, body.store_type,
        body.plan || null, body.gst_position || null, body.credit_line || null, body.payment_terms || null,
        String(body.first_name).trim(), body.last_name || null, String(body.email).trim(),
        body.phone_country_code || null, body.mobile || null, body.mobile_verified ? 1 : 0,
        body.aadhaar_masked || null, body.kyc_status || 'Pending',
        body.kyc_verified_by || null, body.kyc_verified_at || null,
        body.status || 'Pending',
        body.raw_signup ? JSON.stringify(body.raw_signup) : null, ts, ts
      );
      const id = info.lastInsertRowid;
      const insC = db.prepare('INSERT INTO store_consents (store_id, document, accepted_at) VALUES (?,?,?)');
      (body.consents || []).forEach((c) => insC.run(id, c.document || c.name, c.accepted_at || c.acceptedAt || ts));
      const insE = db.prepare('INSERT INTO store_events (store_id, title, actor_user, description, occurred_at) VALUES (?,?,?,?,?)');
      // The trail the client just animated, recorded as fact. Sent by the client because it is
      // the client that ran the journey; the server records rather than re-derives it.
      const events = Array.isArray(body.events) && body.events.length ? body.events : [
        { title: 'Store created', actor_user: 'Store Agent', description: 'Store opened from the Bhaiyaa Store Creation Journey.' }
      ];
      events.forEach((e) => insE.run(id, e.title, e.actor_user || 'Store Agent', e.description || '', e.occurred_at || ts));
      return db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
    });
    sendJson(res, 201, { store: hydrateStore(store) }, origin);
    return;
  }

  // POST /stores/poll — ask Bhaiyaa what has been opened since we last looked, and file it.
  //
  // Inbound, unlike everything on the client side: the merchant filled in Bhaiyaa's own signup,
  // so the store exists there before it exists here. We are recording it, not authoring it —
  // which is why the row lands `mirrored` with Bhaiyaa's id already on it, and why nothing is
  // ever pushed back out.
  if (req.method === 'POST' && segments[0] === 'stores' && segments[1] === 'poll' && segments.length === 2) {
    const cursor = getSyncState('bhaiyaa_last_seen_store_id');
    const result = await connectors.pollStoresSince('bhaiyaa', cursor, { listOnly: !cursor });
    setSyncState('bhaiyaa_last_polled_at', nowIso());
    if (!result.ok) throw new HttpError(502, result.error);

    // First poll ever: take the platform as it stands and watch from here. Without this the
    // board would fill with a page of stores that were opened long before anyone connected the
    // two systems, which is not "what has been signed up" — it is just history.
    if (!cursor) {
      if (result.highestSeen) setSyncState('bhaiyaa_last_seen_store_id', String(result.highestSeen));
      sendJson(res, 200, {
        status: 'baseline', count: 0, stores: [],
        cursor: getSyncState('bhaiyaa_last_seen_store_id'),
        note: 'Cursor set to the newest store on Bhaiyaa. Sign-ups from now on will appear here.'
      }, origin);
      return;
    }

    const ingested = [];
    (result.stores || []).forEach((s) => {
      // Idempotency, same rule as client ingestion: the same store seen twice — a cursor reset,
      // a restart, an overlapping poll — resolves to the row it already made.
      const existing = findStoreBySourceRecord('bhaiyaa', s.source_record_id);
      if (existing) return;
      ingested.push(hydrateStore(ingestBhaiyaaStore(s)));
    });
    if (result.highestSeen) setSyncState('bhaiyaa_last_seen_store_id', String(result.highestSeen));

    sendJson(res, 200, {
      status: ingested.length ? 'ingested' : 'idle',
      count: ingested.length,
      stores: ingested,
      cursor: getSyncState('bhaiyaa_last_seen_store_id')
    }, origin);
    return;
  }

  // POST /stores/:code/kyc — the Ops Manager has run the owner check from the Logs drawer.
  //
  // Writes the outcome and moves the run on in one transaction, for the reason the client status
  // form exists: a badge that says Verified beside a timeline that never mentions it is worse
  // than either alone.
  if (req.method === 'POST' && segments[0] === 'stores' && segments[2] === 'kyc' && segments.length === 3) {
    const store = findStoreByCode(decodeURIComponent(segments[1]));
    if (!store) throw new HttpError(404, 'Store not found');
    if (store.kyc_status === 'Verified') throw new HttpError(409, 'KYC is already verified for this store');
    const body = await readJsonBody(req);
    const actor = body.user || 'Ops Manager';
    const ts = nowIso();

    const updated = transaction(() => {
      db.prepare(
        `UPDATE stores SET kyc_status = 'Verified', kyc_verified_by = ?, kyc_verified_at = ?,
                           aadhaar_masked = COALESCE(?, aadhaar_masked), updated_at = ?
          WHERE id = ?`
      ).run(actor, ts, body.aadhaar_masked || null, ts, store.id);
      db.prepare(
        'INSERT INTO store_events (store_id, title, actor_user, description, occurred_at) VALUES (?,?,?,?,?)'
      ).run(store.id, 'KYC verified', actor,
        'Owner checked against UIDAI and screened. '
        + (body.aadhaar_masked ? 'Aadhaar ' + body.aadhaar_masked + '. ' : '')
        + 'The store can now be opened.', ts);
      return db.prepare('SELECT * FROM stores WHERE id = ?').get(store.id);
    });
    sendJson(res, 200, { store: hydrateStore(updated) }, origin);
    return;
  }

  // PATCH /stores/:code/status — the only mutation a store has so far.
  if (req.method === 'PATCH' && segments[0] === 'stores' && segments[2] === 'status' && segments.length === 3) {
    const store = findStoreByCode(decodeURIComponent(segments[1]));
    if (!store) throw new HttpError(404, 'Store not found');
    const body = await readJsonBody(req);
    if (!VALID_STATUSES.includes(body.status)) throw new HttpError(400, 'Unknown status: ' + body.status);
    const updated = transaction(() => {
      const ts = nowIso();
      db.prepare('UPDATE stores SET status = ?, updated_at = ? WHERE id = ?').run(body.status, ts, store.id);
      db.prepare('INSERT INTO store_events (store_id, title, actor_user, description, occurred_at) VALUES (?,?,?,?,?)')
        .run(store.id, 'Status changed to ' + body.status, body.actor_user || 'Admin', body.note || '', ts);
      return db.prepare('SELECT * FROM stores WHERE id = ?').get(store.id);
    });
    sendJson(res, 200, { store: hydrateStore(updated) }, origin);
    return;
  }

  throw new HttpError(404, 'Not found');
}

/* ---------------------------------------------------------------------- server -- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const segments = url.pathname.split('/').filter(Boolean);
  const origin = req.headers.origin;

  if (req.method === 'OPTIONS') { sendJson(res, 204, null, origin); return; }

  try {
    await handle(req, res, url, segments);
  } catch (e) {
    if (e instanceof HttpError) { sendJson(res, e.status, { error: e.message }, origin); return; }
    console.error('[error] ' + req.method + ' ' + url.pathname, e);
    sendJson(res, 500, { error: 'Internal error' }, origin);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error('Port ' + PORT + ' is already in use. Set PORT to something else.');
  else console.error('Server error: ' + err.message);
  process.exit(1);
});

// Close the database on the way out so SQLite is never left with a hot journal file.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n' + signal + ' received — shutting down.');
  server.close(() => {
    try { db.close(); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(PORT, () => {
  const source = connectors.activeSourceId();
  console.log('Executive Layer storage backend listening on http://localhost:' + PORT);
  console.log('  Data file:     ' + DB_PATH);
  console.log('  New clients:   ' + source + ' -> ' + (connectors.configFor(source).baseUrl || '(unset)'));
  if (source === 'adt_solution') console.log('  Poll source:   ' + ADT_BASE_URL + ADT_LATEST_PATH);
  else console.log('  Poll source:   none — ' + source + ' is push-only (no read-back endpoint)');
  // Said here rather than at the first submission: a missing credential is a setup mistake, and
  // the moment to hear about it is startup, not when an Account Manager presses Submit.
  const problem = connectors.describeMisconfiguration(source);
  if (problem) console.error('  CONFIG ERROR:  ' + problem + ' — client creation will fail until this is set.');
  if (!API_TOKEN) console.log('  Auth:          DISABLED (set EXEC_API_TOKEN before exposing this beyond localhost)');
  if (ALLOWED_ORIGINS.includes('*')) console.log('  CORS:          open to all origins (set ALLOWED_ORIGINS to restrict)');
});
