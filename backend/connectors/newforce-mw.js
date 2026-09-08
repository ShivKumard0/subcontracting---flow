// Connector for the real NewForce middleware — the system behind the ADT website's forms.
//
// Same job as connectors/adt-solution.js, different protocol in every respect: form-encoded
// rather than JSON, a self-signed JWT alongside a static key rather than one bearer token, CRM
// column names rather than our field names, an integer id rather than a string one, and failure
// reported as `status:0` inside an HTTP 200 rather than as an HTTP status. That list is why this
// is a connector instead of a flag on the old push path.
//
// The contract is not guesswork: it is what ADT_Static_Web/submit_user.php and
// submit_book_a_demo.php send, verified live against staging (see
// NEWFORCE_MW_CLIENT_SYNC_PLAN.md §7).

const { signHs256 } = require('../lib/jwt');
const crypto = require('node:crypto');

const SUBMIT_PATH = '/addUser/v1';
const STATUS_PATH = '/updateClientStatus/v1';

// Our status vocabulary -> the CRM's. Ours is title-case and theirs is lower-case, and the
// endpoint whitelists exactly these three, so an unmapped status must be refused here rather than
// sent and rejected at the far end.
const STATUS_MAP = {
  Pending: 'pending',
  Active: 'active',
  Inactive: 'inactive'
};

// Constants the ADT website sends on every lead. Copied so an Executive Layer client lands in the
// CRM looking like any other lead — except LEAD_SOURCE, which is the point: these are ours.
const LEAD_DEFAULTS = {
  USER_STATUS: 'pending',
  USER_SUB_STATUS: 'interested',
  ADD_FROM: 'own',
  ENTITY_ID: '1',
  SALES_ORDER_TYPE: 'ADT Sales Process',
  SERVICE_GROUP: 'Sub Contracting',
  USER_TYPE: '0',
  INDUSTRY_SECTOR: '1'
};

const LEAD_SOURCE = 'Executive Layer';

// Digits only. The middleware validates USER_MOBILE with /^\d{7,15}$/, so a number typed as
// "99999 00001" is a rejection rather than a phone number unless it is cleaned first.
const digitsOnly = (v) => String(v == null ? '' : v).replace(/\D/g, '');

// "Priya Sharma" -> ["priya", "sharma"]. Split on the FIRST run of whitespace only, so a
// three-part name keeps its tail in the surname rather than losing it.
function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  const first = (parts.shift() || '').toLowerCase();
  return { first, last: parts.join(' ').toLowerCase() };
}

// Our intake fields -> the middleware's parameters. Pure, so the mapping can be tested without a
// network: this function is the whole of what we claim about the CRM's contract.
function buildLeadPayload(intake, opts) {
  const o = opts || {};
  const { first, last } = splitName(intake.full_name);
  const country = String(intake.country_hiring_in || '').trim();

  const payload = Object.assign({}, LEAD_DEFAULTS, {
    USER_FIRST_NAME: first,
    USER_LAST_NAME: last,
    USER_EMAIL: String(intake.work_email || '').trim().toLowerCase(),
    // The website mints a guessable password for every lead and the CRM expects the column to be
    // populated, so we match it rather than invent a second convention. Accepted as a known wart
    // (plan §6.5) — it is the website's behaviour, not something this connector introduced.
    USER_PASSWORD: first + '@123',
    USER_MOBILE: digitsOnly(intake.phone_number),
    MOBILE_CODE: '+' + digitsOnly(intake.phone_country_code),
    COMP_NAME: String(intake.company_name || '').trim().toLowerCase(),
    company_name: String(intake.company_name || '').trim(),
    // NOT lowercased, and this is the one place we knowingly diverge from submit_user.php (which
    // sends strtolower($country)). The admin console renders the Market dropdown with a
    // case-SENSITIVE PHP comparison — editUserView.php: `if ($user['MARKET'] == $country)` against
    // a title-case country list — so a lowercased value leaves the field showing "Select Market"
    // on a record that does have a market. Verified on user 27801. MySQL's default collation is
    // case-insensitive, so filters and GROUP BYs still fold these together with website leads.
    MARKET: country,
    HIRING_COUNTRIES: country ? [country] : [],
    looking_for: intake.looking_for || '',
    HEAR_ABOUT_US: intake.heard_about_us || '',
    LEAD_SOURCE: LEAD_SOURCE,
    // The CRM has no external-reference field, so our Client ID goes where a human reading the
    // record will see it. Without this there is nothing in the CRM tying the lead back to the
    // Executive Layer record an operator is looking at.
    LAST_ACTIVITY: 'client added via the Executive Layer'
      + (o.externalRef ? ' as ' + o.externalRef : '')
      + (o.actor ? ' by ' + o.actor : ''),
    CREATE_BY: String(o.createBy || '1'),
    // 0, not the website's 1: with duplicates allowed, add_post's reuse logic hands back an
    // EXISTING user_id for a repeat email, and two of our clients pointing at one CRM record
    // collide on the (source, source_record_id) unique index — the second would sit permanently
    // unmirrored. Rejecting the duplicate outright says so instead. See plan §6.2.
    ALLOW_DUPLICATE: String(o.allowDuplicate == null ? '0' : o.allowDuplicate)
  });

  return payload;
}

// PHP's http_build_query() renders an array as name[0]=…&name[1]=…, and the middleware reads
// HIRING_COUNTRIES with $this->post() expecting exactly that. URLSearchParams would otherwise
// stringify the array into one comma-joined value, which arrives as a single bogus country.
function encodeForm(payload) {
  const body = new URLSearchParams();
  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (Array.isArray(value)) {
      value.forEach((item, i) => body.append(key + '[' + i + ']', String(item)));
    } else {
      body.append(key, value == null ? '' : String(value));
    }
  });
  return body;
}

// The middleware answers 200 for everything, including validation failures and auth failures, and
// puts the real outcome in `status`. Treating res.ok as success would file rejected leads as
// mirrored — so this is where that is decided, once, for both submit paths.
function interpretResponse(httpStatus, body) {
  if (httpStatus === 401 || httpStatus === 403) {
    return { ok: false, error: 'NewForce rejected our credentials (' + httpStatus + ')' };
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'NewForce returned a response we could not read (HTTP ' + httpStatus + ')' };
  }
  // `status` comes back as 1, "1" or 0 depending on the branch that answered.
  const ok = String(body.status) === '1';
  if (!ok) {
    // The CRM's own message is written for a person — "The Email field must contain a unique
    // value." — so it is shown as-is rather than replaced with something vaguer. It arrives with
    // a trailing newline from CodeIgniter's error_string().
    const raw = body.error || body.msg || body.message || '';
    return {
      ok: false,
      error: String(raw).trim() || 'NewForce did not accept the client (HTTP ' + httpStatus + ')'
    };
  }
  const userId = body.user_id;
  if (userId == null || String(userId) === '') {
    return { ok: false, error: 'NewForce accepted the client but returned no id for it' };
  }
  return { ok: true, sourceRecordId: String(userId) };
}

// Which field an error belongs against, so the operator sees it under the input they have to fix
// rather than as a banner over a form that looks fine.
function fieldForError(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('email')) return 'work_email';
  if (m.includes('mobile') || m.includes('phone')) return 'phone_number';
  if (m.includes('mobile code')) return 'phone_country_code';
  if (m.includes('company')) return 'company_name';
  if (m.includes('country')) return 'country_hiring_in';
  return null;
}

// Shared request plumbing for both calls below — same key, same headers. The token is optional
// for the same reason it is optional in submit(): see the note above submit(). These two are the
// duplicate checks, and the PHP client calls /adtUserExist/v1 with outhKey alone as well.
async function callMiddleware(pathname, body, cfg) {
  const deviceId = 'web_' + crypto.randomBytes(5).toString('hex');
  const jwt = cfg.jwtSecret
    ? signHs256({ data: { id: 1, role: 'web', device_id: deviceId, device_type: 'web' } }, cfg.jwtSecret)
    : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs || 30000);
  try {
    const headers = {
      'outhKey': cfg.outhKey,
      'auth_validate': '1',
      'device_id': deviceId,
      'device_type': 'web',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    const res = await fetch(cfg.baseUrl + pathname, {
      method: 'POST',
      headers: headers,
      body,
      signal: controller.signal
    });
    let parsed = null;
    try { parsed = await res.json(); } catch { parsed = null; }
    return { status: res.status, body: parsed };
  } finally {
    clearTimeout(timer);
  }
}

// One existence question, asked until the far side actually answers it.
//
// Staging returns `401 Token is invalid` to a measured ~10-20% of calls with a token that is
// correct — the same token reused seconds later is accepted, so it is their auth layer, not ours
// (the two 401 mirror failures on CLI-000009 are the same fault seen from the submit side).
// Without this, that noise reads as "no such client", and the duplicate we are looking for slips
// through the gate one time in five.
//
// Retrying is safe HERE and nowhere else on this connector: /adtUserExist/v1 is a read. The submit
// POST creates a lead, so a retry there could file the same client twice and must not be added.
//
// Returns true only for a definite "exists". A question we could not get answered returns false —
// the deliberate fail-open of the caller below, just no longer triggered by ordinary flakiness.
const EXIST_ATTEMPTS = 3;
async function existsAtSource(params, cfg) {
  for (let attempt = 1; attempt <= EXIST_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await callMiddleware('/adtUserExist/v1', new URLSearchParams(params), cfg);
    } catch {
      continue;  // timeout or transport failure — worth one more ask
    }
    if (res.status === 401 || res.status === 403 || res.status >= 500) continue;
    if (!res.body) continue;
    // A clean answer either way: '1' exists, '0' does not. Both are final.
    return String(res.body.status) === '1';
  }
  return false;
}

// Is this email — or this mobile number — already a client over there?
//
// Asked BEFORE we mint a Client ID, because with ALLOW_DUPLICATE=0 a duplicate is a permanent
// rejection rather than a transient one: minting first and pushing second — right when the far
// side might merely be down — would leave a client here that can never mirror, no matter how
// often Retry is pressed. These are the refusals we can see coming, so we look.
//
// BOTH are checked because the CRM enforces uniqueness on both. Checking only the email let a
// fresh address with an already-registered mobile through the gate: the precheck passed, a Client
// ID was minted, and `add` then refused it forever with "Mobile number already exist." — exactly
// the stranded record this function exists to prevent. CLI-000009 and CLI-000010 are both that.
//
// Fails OPEN. If a check itself cannot be completed we say nothing and let the submission
// proceed: refusing a legitimate client because a lookup timed out would be worse than the
// duplicate we are guarding against, and the submit call decides the outcome either way.
async function precheck(intake, cfg) {
  // Digits only, and the same normalisation buildLeadPayload applies — the number we ask about
  // has to be the number we would actually send, or the check answers about something else.
  const checks = [
    {
      value: String(intake.work_email || '').trim().toLowerCase(),
      params: (v) => ({ work_email: v, type: 'work_email' }),
      field: 'work_email',
      // Written for the operator looking at the form: what is wrong, and both ways out of it.
      // "Already registered" rather than "duplicate" — the record it clashes with is a real
      // client someone can go and open, not an abstract constraint violation.
      error: 'This email address is already registered to a client in NewForce. '
        + 'Use a different address, or open that client instead of creating a second record.'
    },
    {
      value: digitsOnly(intake.phone_number),
      params: (v) => ({ mobile: v, type: 'mobile' }),
      field: 'phone_number',
      error: 'This mobile number is already registered to a client in NewForce. '
        + 'Use a different number, or open that client instead of creating a second record.'
    }
  ];

  for (const check of checks) {
    // An empty value is skipped rather than sent: the endpoint answers status:1 ("exists") for a
    // blank mobile, so asking about nothing would refuse every client who left the field empty.
    if (!check.value) continue;
    if (await existsAtSource(check.params(check.value), cfg)) {
      return { ok: false, field: check.field, error: check.error };
    }
  }
  return { ok: true };
}

/* == THE JWT IS OPTIONAL, AND THAT IS NOT AN ASSUMPTION ===================================
   This connector used to sign an HS256 JWT unconditionally, which made NF_MW_JWT_SECRET a hard
   requirement: with it unset, signHs256 threw "a secret is required" and the lead was never
   sent. The secret is not in this repository and the plan doc redacts it, so the integration
   simply could not run.

   The live PHP client says otherwise. htdocs/ADT_Static_Web/submit_user.php — the form behind
   the real adtsolution.com modal, and the implementation NEWFORCE_MW_CLIENT_SYNC_PLAN.md cites
   as the contract — builds exactly two auth headers:

       $headers = array('outhKey:'.$header, 'auth_validate:1');
       // $jwt=$autDetails['jwt_token'];
       // if ($jwt) { $headers[] = 'Authorization: Bearer ' . $jwt; }

   The Authorization line is commented out. Production has been creating leads with outhKey
   alone. The plan doc recorded the JWT because an older revision of that client sent one, and
   we copied the stricter shape.

   So: sign only when a secret is configured, and send the header only when we signed. With a
   secret this is byte-identical to what it sent before; without one it is byte-identical to
   the PHP client. Nothing about the request changes for an existing working deployment. == */
async function submit(intake, cfg) {
  const payload = buildLeadPayload(intake, cfg);
  const deviceId = 'web_' + crypto.randomBytes(5).toString('hex');
  const jwt = cfg.jwtSecret
    ? signHs256({ data: { id: 1, role: 'web', device_id: deviceId, device_type: 'web' } }, cfg.jwtSecret)
    : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs || 30000);
  let res;
  try {
    const headers = {
      'outhKey': cfg.outhKey,
      'auth_validate': '1',
      'device_id': deviceId,
      'device_type': 'web',
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    res = await fetch(cfg.baseUrl + SUBMIT_PATH, {
      method: 'POST',
      headers: headers,
      body: encodeForm(payload),
      signal: controller.signal
    });
  } catch (e) {
    // Includes the abort. A timeout is ambiguous by nature — the lead may well have been created
    // — so it must not be reported as a clean failure, or a retry silently duplicates it.
    const timedOut = e.name === 'AbortError';
    return {
      ok: false,
      error: timedOut
        ? 'NewForce did not answer within ' + Math.round((cfg.timeoutMs || 30000) / 1000)
          + 's. The client may or may not have been created there — check before retrying.'
        : 'Could not reach NewForce: ' + e.message
    };
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try { body = await res.json(); } catch { body = null; }
  const result = interpretResponse(res.status, body);
  if (!result.ok) result.field = fieldForError(result.error);
  return result;
}

// Reads the reply from /updateClientStatus/v1. Same rule as interpretResponse: HTTP 200 says
// nothing, `status` says everything. `changed:false` means the CRM already held that status —
// a success, not a failure, and worth reporting differently so the audit trail can say so.
function interpretStatusResponse(httpStatus, body) {
  if (httpStatus === 401 || httpStatus === 403) {
    return { ok: false, error: 'NewForce rejected our credentials (' + httpStatus + ')' };
  }
  if (!body || typeof body !== 'object') {
    // CodeIgniter serves an HTML "page no longer there" — under HTTP 200 — for a route it does not
    // have, so a non-JSON reply here almost always means one thing: the middleware answering us
    // predates updateClientStatus. Say that, rather than "could not read the response", which
    // sends whoever reads the log looking in the wrong place.
    return {
      ok: false,
      error: 'NewForce did not return a usable answer (HTTP ' + httpStatus + '). '
        + 'The updateClientStatus endpoint is most likely not deployed on that middleware yet.'
    };
  }
  if (String(body.status) !== '1') {
    const raw = body.error || body.msg || body.message || '';
    return { ok: false, error: String(raw).trim() || 'NewForce did not accept the status change' };
  }
  return { ok: true, changed: body.changed !== false, status: body.USER_STATUS || null };
}

// Pushes one status change for a client the CRM already holds.
//
// `sourceRecordId` is the CRM's user_id, so this can only run for a client that mirrored
// successfully — there is nothing to update otherwise, which the caller checks before calling.
async function pushStatus(sourceRecordId, status, cfg) {
  const mapped = STATUS_MAP[status];
  if (!mapped) return { ok: false, error: 'No NewForce equivalent for the status "' + status + '"' };
  if (!sourceRecordId) return { ok: false, error: 'This client has no NewForce record to update' };

  const body = new URLSearchParams({
    USER_ID: String(sourceRecordId),
    USER_STATUS: mapped,
    // Proves to the endpoint that this lead is ours to move. It refuses any user whose
    // LEAD_SOURCE does not name us, which is what keeps a public endpoint from being a way to
    // edit arbitrary CRM records.
    LEAD_SOURCE: LEAD_SOURCE,
    LAST_ACTIVITY: 'status set to ' + status + ' in the Executive Layer'
      + (cfg.externalRef ? ' (' + cfg.externalRef + ')' : '')
      + (cfg.actor ? ' by ' + cfg.actor : '')
  });

  let res;
  try {
    res = await callMiddleware(STATUS_PATH, body, cfg);
  } catch (e) {
    const timedOut = e.name === 'AbortError';
    return {
      ok: false,
      error: timedOut
        ? 'NewForce did not answer in time; the status may or may not have changed there.'
        : 'Could not reach NewForce: ' + e.message
    };
  }
  return interpretStatusResponse(res.status, res.body);
}

module.exports = {
  id: 'newforce_mw',
  label: 'NewForce Solutions',
  submit,
  precheck,
  pushStatus,
  interpretStatusResponse,
  STATUS_MAP,
  // Exported for the tests — these are the parts worth pinning down, and they are pure.
  buildLeadPayload,
  encodeForm,
  interpretResponse,
  fieldForError,
  splitName,
  LEAD_SOURCE
};
