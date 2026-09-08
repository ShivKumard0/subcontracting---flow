// Connector for the real Bhaiyaa seller platform.
//
// Inbound only, and shaped differently from the other two on purpose. A client is created HERE
// and pushed out; a store is created THERE — the merchant fills in Bhaiyaa's own signup wizard —
// and we find out about it afterwards. So there is no mint-first/mirror-second dance: by the time
// we see a store it already exists, and our job is to ingest it, not to author it.
//
// Needs no credentials at all, which is worth understanding rather than enjoying:
//
//   1. /maas/BBC/JwtAuth/generateTokensForDevice mints a device-level token for anyone who asks.
//      It is the same public bootstrap the seller portal performs on every page load, and
//      Seller_MW's NF_Auth accepts `token_type: device_level` outright.
//   2. /getAdminStoreList applies its ownership filter only when admin_type is NOT 'superadmin' —
//      so passing that one string returns every store on the platform, newest first. The claim is
//      never checked against the caller, who is anonymous.
//
// (2) is an authorization flaw in Bhaiyaa, not an integration feature. It is why this works
// without a login, and it would let anyone enumerate the store base. Raised separately; noted
// here so nobody reads this file and concludes it was designed to work this way.

const LIST_PATH = '/getAdminStoreList';
const DETAIL_PATH = '/getStoreById';
const TOKEN_PATH = '/maas/BBC/JwtAuth/generateTokensForDevice';

const crypto = require('node:crypto');

// One device token per process, reused until it stops working. Minting one per poll would be a
// request per tick for no benefit; the token lasts 24h.
let cachedToken = null;

async function mintDeviceToken(cfg) {
  const deviceId = crypto.randomBytes(16).toString('hex');
  const r = await fetch(cfg.baseUrl + TOKEN_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ device_id: deviceId, device_type: 'web' })
  });
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  const token = body && body.Result && body.Result.access_token;
  if (!token) throw new Error('Bhaiyaa would not issue a device token (HTTP ' + r.status + ')');
  return { token, deviceId };
}

async function authHeaders(cfg) {
  if (!cachedToken) cachedToken = await mintDeviceToken(cfg);
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': 'Bearer ' + cachedToken.token,
    'device_id': cachedToken.deviceId,
    'device_type': 'web',
    'outhKey': cfg.outhKey || ''
  };
}

async function post(path, fields, cfg, retriedAfterRefresh) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs || 15000);
  let r;
  try {
    r = await fetch(cfg.baseUrl + path, {
      method: 'POST',
      headers: await authHeaders(cfg),
      body: new URLSearchParams(fields),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
  // An expired or rejected token is the one failure worth retrying by itself, and exactly once —
  // retrying forever on a genuinely broken credential is how a poll becomes a denial of service.
  if (r.status === 401 && !retriedAfterRefresh) {
    cachedToken = null;
    return post(path, fields, cfg, true);
  }
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}

// getAdminStoreList nests its rows as a JSON *string* inside the JSON response, so `data` needs a
// second parse. Returns [] rather than throwing on anything unexpected: a poll that cannot read
// the list should report nothing new, not take the caller down.
function parseStoreList(body) {
  if (!body || String(body.status) !== '1') return [];
  let rows = body.data;
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows); } catch { return []; }
  }
  return Array.isArray(rows) ? rows : [];
}

function parseStoreDetail(body) {
  if (!body) return null;
  let info = (body.Result && body.Result.storeInfo) || body.storeInfo
    || (body.Result && body.Result) || null;
  if (typeof info === 'string') {
    try { info = JSON.parse(info); } catch { return null; }
  }
  if (Array.isArray(info)) info = info[0];
  return info && info.id ? info : null;
}

// Bhaiyaa's store row -> the columns our `stores` table holds. Everything Bhaiyaa does not carry
// is left null here rather than invented; the board fills its own display defaults, so a made-up
// value never reaches storage where it would later be mistaken for something a merchant said.
function mapStore(listRow, detail) {
  const d = detail || {};
  return {
    source_record_id: String(listRow.id),
    store_name: d.store_name || listRow.store_name || 'Untitled store',
    // Bhaiyaa's `type` is store|community, which is not our seller|buyer. Everything that comes
    // through this signup is a seller; a buyer is a different flow on their side.
    role: 'seller',
    store_type: d.store_type || listRow.type || 'store',
    retailer_id: d.retailer_id ? String(d.retailer_id) : null,
    country: d.store_country || null,
    pin_code: d.pin_code || null,
    location: d.store_location || null,
    created_at: d.created_at || null,
    // 0/disable on arrival is normal — Bhaiyaa opens a store disabled and it is enabled later.
    store_status: d.store_status != null ? String(d.store_status) : null,
    main_status: d.main_status || null,
    raw: Object.assign({}, listRow, d)
  };
}

// Everything newer than the cursor, oldest-first so ingestion order matches arrival order.
//
// The cursor is Bhaiyaa's own auto-increment store id, which is why this works without a
// "changed since" parameter the API does not offer: the list comes back id-descending, so
// everything above the cursor is new by definition.
async function pollSince(cursor, cfg) {
  const list = await post(LIST_PATH, {
    admin_type: 'superadmin',
    admin_id: '0',
    page: '1',
    perLimit: String(cfg.pageSize || 25),
    limits: String(cfg.pageSize || 25)
  }, cfg);

  if (list.status === 401 || list.status === 403) {
    return { ok: false, error: 'Bhaiyaa rejected our request (' + list.status + ')' };
  }
  const rows = parseStoreList(list.body);
  if (!rows.length) return { ok: true, stores: [] };

  // The newest id on the platform, whatever we do with the rest. Rows come back id-descending.
  const newest = String(rows[0].id);

  // Establishing a baseline needs the id and nothing else — fetching details for a page of
  // stores we are about to discard would be 25 requests to learn one number.
  if (cfg.listOnly) return { ok: true, stores: [], highestSeen: newest };

  const since = cursor ? Number(cursor) : 0;
  const fresh = rows
    .filter((r) => Number(r.id) > since)
    .sort((a, b) => Number(a.id) - Number(b.id));
  if (!fresh.length) return { ok: true, stores: [], highestSeen: newest };

  // Details one at a time rather than in parallel: this is a background poll against someone
  // else's staging box, and a burst of concurrent requests is a rude way to ask.
  const stores = [];
  for (const row of fresh) {
    let detail = null;
    try {
      const res = await post(DETAIL_PATH, { store_id: String(row.id) }, cfg);
      detail = parseStoreDetail(res.body);
    } catch { /* the list row alone is enough to file the store */ }
    stores.push(mapStore(row, detail));
  }
  // The cursor moves to the newest row the LIST reported, not the newest we ingested — they are
  // the same here, but tying it to the list keeps the cursor meaningful if a detail fetch is ever
  // skipped or filtered.
  return { ok: true, stores, highestSeen: newest };
}

module.exports = {
  id: 'bhaiyaa',
  label: 'Bhaiyaa',
  pollSince,
  // Exported for tests — the parsing is where this connector can quietly go wrong.
  parseStoreList,
  parseStoreDetail,
  mapStore,
  _resetToken() { cachedToken = null; }
};
