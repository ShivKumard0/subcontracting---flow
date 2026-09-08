// The NewForce middleware connector, in the parts that decide whether a lead is accepted.
//
// Everything checked here is pure — the mapping, the form encoding, the reading of a reply — so
// none of it needs the network, and all of it is what the CRM would otherwise reject us for at
// 1.4 seconds a try. The live proof that the contract itself is right is in
// NEWFORCE_MW_CLIENT_SYNC_PLAN.md §7; this suite is what keeps it right.

const path = require('path');
const mw = require(path.join(__dirname, '..', 'backend', 'connectors', 'newforce-mw'));
const { signHs256 } = require(path.join(__dirname, '..', 'backend', 'lib', 'jwt'));
const crypto = require('node:crypto');

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failed++;
  console.log('  FAIL ' + label + '\n       expected ' + e + '\n       actual   ' + a);
}
function ok(label, condition) {
  if (condition) { passed++; return; }
  failed++;
  console.log('  FAIL ' + label);
}

const INTAKE = {
  full_name: 'Priya Sharma Iyer',
  work_email: '  Priya.Sharma@Example.COM ',
  phone_country_code: '+91',
  phone_number: '99999 00001',
  company_name: '  Acme Global  ',
  country_hiring_in: 'Netherlands',
  looking_for: 'Employer of Record (EOR)',
  heard_about_us: 'LinkedIn'
};

/* -- the mapping ------------------------------------------------------------------------- */

const p = mw.buildLeadPayload(INTAKE, { externalRef: 'CLI-000042', actor: 'A. Manager' });

check('first name is the first token, lowercased', p.USER_FIRST_NAME, 'priya');
check('surname keeps every remaining token', p.USER_LAST_NAME, 'sharma iyer');
check('email is trimmed and lowercased', p.USER_EMAIL, 'priya.sharma@example.com');
// /^\d{7,15}$/ — a number typed with a space is a rejection unless it is cleaned first.
check('mobile is digits only', p.USER_MOBILE, '9999900001');
check('dial code keeps exactly one +', p.MOBILE_CODE, '+91');
check('company is trimmed', p.COMP_NAME, 'acme global');
// Deliberately NOT lowercased, unlike submit_user.php: the admin console matches MARKET against
// its country list with a case-sensitive ==, so 'netherlands' renders as an empty Market field.
check('MARKET keeps the country\'s display case', p.MARKET, 'Netherlands');
check('hiring country is a list', p.HIRING_COUNTRIES, ['Netherlands']);
check('lead source marks these as ours', p.LEAD_SOURCE, 'Executive Layer');
// The CRM has no external-reference field, so the Client ID has to ride in something a human reads.
ok('Client ID is carried into LAST_ACTIVITY', p.LAST_ACTIVITY.includes('CLI-000042'));
ok('the operator is named too', p.LAST_ACTIVITY.includes('A. Manager'));
// Everything below is what stops add_post's reuse logic handing back an existing user_id — see
// plan §6.2. If this ever flips to '1', two of our clients can collide on one CRM record.
check('duplicates are refused by default', p.ALLOW_DUPLICATE, '0');
check('CREATE_BY defaults to the website value', p.CREATE_BY, '1');
check('constants the CRM requires are present', [p.USER_STATUS, p.ENTITY_ID, p.USER_TYPE], ['pending', '1', '0']);

// A dial code typed without its + must not produce '++91' or '91'.
check('bare dial code gains a +', mw.buildLeadPayload({ phone_country_code: '91' }, {}).MOBILE_CODE, '+91');
// A single-word name must not leave USER_FIRST_NAME empty — the CRM requires it.
check('single-word name', mw.splitName('Madonna'), { first: 'madonna', last: '' });
check('empty name does not crash', mw.splitName(''), { first: '', last: '' });
// An unselected country must not send HIRING_COUNTRIES[0]='' — the CRM's _cleanHiringCountries()
// strips empties and then rejects the lead for having none, which reads as a server error.
check('no country sends no array entries', mw.buildLeadPayload({ country_hiring_in: '' }, {}).HIRING_COUNTRIES, []);
check('override of allowDuplicate is honoured', mw.buildLeadPayload(INTAKE, { allowDuplicate: '1' }).ALLOW_DUPLICATE, '1');

/* -- the encoding ------------------------------------------------------------------------ */

const encoded = mw.encodeForm(p).toString();
// PHP's http_build_query renders arrays as name[0]=…; URLSearchParams would otherwise join the
// array with a comma and send one bogus country.
ok('hiring countries use PHP array syntax', encoded.includes('HIRING_COUNTRIES%5B0%5D=Netherlands'));
ok('no comma-joined array leaks through', !/HIRING_COUNTRIES=/.test(encoded));
ok('the + in the dial code survives encoding', encoded.includes('MOBILE_CODE=%2B91'));
const twoCountries = mw.encodeForm({ HIRING_COUNTRIES: ['India', 'Spain'] }).toString();
ok('a second country is indexed [1]', twoCountries.includes('HIRING_COUNTRIES%5B1%5D=Spain'));
check('empty values encode as empty, not "null"', mw.encodeForm({ a: null }).toString(), 'a=');

/* -- reading the reply -------------------------------------------------------------------- */

// The middleware answers HTTP 200 for everything and puts the outcome in `status`. Treating
// res.ok as success would file rejected leads as mirrored — the single most likely bug here.
check('status 1 with a user_id is success',
  mw.interpretResponse(200, { status: 1, user_id: 27800 }), { ok: true, sourceRecordId: '27800' });
check('a string status is success too',
  mw.interpretResponse(200, { status: '1', user_id: 27800 }), { ok: true, sourceRecordId: '27800' });
check('status 0 inside a 200 is a failure',
  mw.interpretResponse(200, { status: 0, error: 'The Email field must contain a unique value.\n' }),
  { ok: false, error: 'The Email field must contain a unique value.' });
check('the CRM message is passed through, minus its trailing newline',
  mw.interpretResponse(200, { status: 0, error: 'Country Hiring In is required.' }),
  { ok: false, error: 'Country Hiring In is required.' });
check('`msg` is read when `error` is absent',
  mw.interpretResponse(200, { status: '0', msg: 'access_key_not_found' }),
  { ok: false, error: 'access_key_not_found' });
ok('success without an id is a failure, not a mirrored record',
  mw.interpretResponse(200, { status: 1 }).ok === false);
ok('a 401 is reported as a credentials problem',
  /credentials/.test(mw.interpretResponse(401, { status: 0 }).error));
ok('an unreadable body is a failure', mw.interpretResponse(200, null).ok === false);
// user_id 0 would be falsy — it must not be mistaken for "no id".
check('user_id 0 is still an id',
  mw.interpretResponse(200, { status: 1, user_id: 0 }), { ok: true, sourceRecordId: '0' });

check('a duplicate lands on the email input', mw.fieldForError('The Email field must contain a unique value.'), 'work_email');
check('a mobile complaint lands on the phone input', mw.fieldForError('User Mobile is required'), 'phone_number');
check('an unrecognised message names no field', mw.fieldForError('Oops Something Went Wrong!.'), null);

/* -- the JWT ------------------------------------------------------------------------------ */

// firebase/php-jwt on the middleware side will reject anything that is not exactly this shape.
const token = signHs256({ data: { id: 1, role: 'web' } }, 'secret', 60);
const [h, body, sig] = token.split('.');
const decode = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
check('header is HS256', decode(h), { alg: 'HS256', typ: 'JWT' });
ok('role travels in data, where the middleware reads it', decode(body).data.role === 'web');
ok('iat and exp are set', typeof decode(body).iat === 'number' && decode(body).exp === decode(body).iat + 60);
ok('base64url leaves no padding or + /', !/[+/=]/.test(token));
const expected = crypto.createHmac('sha256', 'secret').update(h + '.' + body).digest('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
check('signature is HMAC-SHA256 over header.payload', sig, expected);
ok('signing without a secret throws rather than sending an unsigned token', (() => {
  try { signHs256({}, ''); return false; } catch { return true; }
})());

/* -- the status push ------------------------------------------------------------------------ */

// Our vocabulary is title-case, the CRM's is lower-case, and the endpoint whitelists exactly
// three values — so an unmapped status has to be refused here, not discovered at the far end.
check('the three statuses map to the CRM\'s', mw.STATUS_MAP,
  { Pending: 'pending', Active: 'active', Inactive: 'inactive' });

check('status 1 with changed:true is a real change',
  mw.interpretStatusResponse(200, { status: 1, USER_STATUS: 'active', changed: true }),
  { ok: true, changed: true, status: 'active' });
// The CRM already holding that status is a SUCCESS. UserModel::updateUser reports
// affected_rows()==0 as failure, which is why the endpoint answers changed:false instead.
check('already-at-that-status is success, not failure',
  mw.interpretStatusResponse(200, { status: 1, USER_STATUS: 'active', changed: false }),
  { ok: true, changed: false, status: 'active' });
check('a refusal carries the CRM\'s reason',
  mw.interpretStatusResponse(200, { status: 0, error: 'User 27804 was not created by Executive Layer.' }),
  { ok: false, error: 'User 27804 was not created by Executive Layer.' });
ok('a 401 on the status push is a credentials problem',
  /credentials/.test(mw.interpretStatusResponse(401, {}).error));
// CI answers an unknown route with an HTML page under HTTP 200. Observed against staging before
// the endpoint was deployed — the message has to name that cause or the log sends people hunting.
ok('a non-JSON reply blames the undeployed endpoint',
  /not deployed/i.test(mw.interpretStatusResponse(200, null).error));

/* -- the registry -------------------------------------------------------------------------- */

const registry = require(path.join(__dirname, '..', 'backend', 'connectors'));

// A client is pushed by ITS OWN source, not the currently configured one — otherwise repointing
// the backend at the CRM would make Retry on a mock-sourced client send it somewhere it never
// came from, under a protocol that system does not speak.
check('each source resolves to its own connector',
  [registry.connectorFor('adt_solution').id, registry.connectorFor('newforce_mw').id],
  ['adt_solution', 'newforce_mw']);
ok('an unknown source is an error, not a silent default', (() => {
  try { registry.connectorFor('nope'); return false; } catch { return true; }
})());

// The mock cannot answer "do you already have this?", and must not be made to fake an answer.
// Wrapped in an async run so the exit below cannot fire before this resolves — an earlier draft
// exited first and quietly reported only the synchronous checks.
(async function run() {
  const r = await registry.precheckAt('adt_solution', { work_email: 'x@example.com' });
  ok('a connector with no precheck passes straight through', r.ok === true);

  // pushStatus refuses before it sends, so a bad call costs no round trip and cannot half-happen.
  const unmapped = await mw.pushStatus('27804', 'Archived', {});
  ok('an unmapped status is refused without a request', unmapped.ok === false && /Archived/.test(unmapped.error));
  const noRecord = await mw.pushStatus(null, 'Active', {});
  ok('a client with no CRM record is refused', noRecord.ok === false && /no NewForce record/i.test(noRecord.error));

  // The mock has no notion of a client's status, so a status change against it stays local —
  // reported as supported:false rather than as a failure, which the route relies on.
  const mockPush = await registry.pushStatusTo('adt_solution', 'ADT-SUB-0001', 'Active', {});
  ok('the mock reports the push as unsupported, not failed', mockPush.ok === true && mockPush.supported === false);

  const saved = { CLIENT_SOURCE: process.env.CLIENT_SOURCE, NF_MW_URL: process.env.NF_MW_URL,
                  NF_MW_OUTH_KEY: process.env.NF_MW_OUTH_KEY, NF_MW_JWT_SECRET: process.env.NF_MW_JWT_SECRET };
  delete process.env.NF_MW_URL; delete process.env.NF_MW_OUTH_KEY; delete process.env.NF_MW_JWT_SECRET;
  // Missing credentials must be named at startup, not discovered when an operator presses Submit.
  ok('missing CRM credentials are reported', /NF_MW_URL/.test(registry.describeMisconfiguration('newforce_mw') || ''));
  ok('the mock needs no credentials', registry.describeMisconfiguration('adt_solution') === null);
  process.env.NF_MW_URL = 'not-a-url'; process.env.NF_MW_OUTH_KEY = 'k'; process.env.NF_MW_JWT_SECRET = 's';
  ok('a non-absolute NF_MW_URL is caught', /absolute URL/.test(registry.describeMisconfiguration('newforce_mw') || ''));
  Object.keys(saved).forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
