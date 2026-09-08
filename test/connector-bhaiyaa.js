// The Bhaiyaa connector, in the parts that can silently go wrong: parsing.
//
// Bhaiyaa nests its store rows as a JSON *string* inside the JSON response, and its detail call
// wraps the row in `Result.storeInfo`. Both are easy to half-handle in a way that yields an empty
// board and no error — which is exactly the failure a poll must not have.

const path = require('path');
const b = require(path.join(__dirname, '..', 'backend', 'connectors', 'bhaiyaa'));

let passed = 0, failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; return; }
  failed++;
  console.log('  FAIL ' + label + '\n       expected ' + e + '\n       actual   ' + a);
}
function ok(label, cond) { if (cond) { passed++; return; } failed++; console.log('  FAIL ' + label); }

/* -- the list ------------------------------------------------------------------------------ */

// Exactly what staging returns: rows as a string inside the JSON.
const LIVE_LIST = {
  status: 1,
  data: '[{"id":"3675","store_name":"Treutel PLC","type":"community"},'
      + '{"id":"3674","store_name":"p8sFVFqsX5\'T5zBhqYk","type":"community"}]'
};
check('rows are parsed out of the nested JSON string',
  b.parseStoreList(LIVE_LIST).map((r) => r.id), ['3675', '3674']);
// Same shape, already decoded — a middleware fix or a different version must not break the poll.
check('an already-decoded array works too',
  b.parseStoreList({ status: 1, data: [{ id: '9' }] }).map((r) => r.id), ['9']);
check('status 0 yields nothing', b.parseStoreList({ status: 0, data: '[]' }), []);
check('unparseable data yields nothing, not a throw', b.parseStoreList({ status: 1, data: '{oops' }), []);
check('a null body yields nothing', b.parseStoreList(null), []);

/* -- the detail ---------------------------------------------------------------------------- */

const DETAIL = {
  status: 1,
  Result: { storeInfo: { id: '3675', retailer_id: '47850', store_name: 'Treutel PLC',
                         store_type: 'external_service_provider', store_country: 'India',
                         created_at: '2026-07-31 10:10:28', store_status: '0', main_status: 'disable' } }
};
ok('storeInfo is unwrapped from Result', b.parseStoreDetail(DETAIL).retailer_id === '47850');
ok('a storeInfo array takes its first row',
  b.parseStoreDetail({ Result: { storeInfo: [{ id: '1', store_name: 'A' }] } }).store_name === 'A');
ok('a detail with no id is rejected', b.parseStoreDetail({ Result: { storeInfo: { store_name: 'x' } } }) === null);
ok('a null detail is null', b.parseStoreDetail(null) === null);

/* -- the mapping --------------------------------------------------------------------------- */

const m = b.mapStore({ id: '3675', store_name: 'Treutel PLC', type: 'community' },
                     b.parseStoreDetail(DETAIL));
check('their id becomes source_record_id', m.source_record_id, '3675');
check('the detail name wins over the list name', m.store_name, 'Treutel PLC');
// Bhaiyaa's `type` is store|community, which is NOT our seller|buyer. Mapping one onto the other
// would put "community" in a column the whole listing reads as a role.
check('role is seller, not Bhaiyaa\'s type', m.role, 'seller');
check('their type is kept as the store type', m.store_type, 'external_service_provider');
check('created_at is carried for the age column', m.created_at, '2026-07-31 10:10:28');
// store_status 0 / main_status disable is how Bhaiyaa opens every store — normal, not a fault.
check('the disabled-on-arrival status is recorded', [m.store_status, m.main_status], ['0', 'disable']);
ok('the raw payload is kept for the record', m.raw && m.raw.retailer_id === '47850');

// A store the detail call failed for must still be filable — the list row alone identifies it.
const bare = b.mapStore({ id: '4000', store_name: 'Only From The List', type: 'store' }, null);
check('a detail-less store still maps', [bare.source_record_id, bare.store_name, bare.store_type],
  ['4000', 'Only From The List', 'store']);
check('a nameless store gets a placeholder, not empty', b.mapStore({ id: '1' }, null).store_name, 'Untitled store');

/* -- the registry -------------------------------------------------------------------------- */

const registry = require(path.join(__dirname, '..', 'backend', 'connectors'));
check('bhaiyaa resolves to its own connector', registry.connectorFor('bhaiyaa').id, 'bhaiyaa');
registry.pollStoresSince('newforce_mw', null).then((r) => {
  ok('polling a push-only connector is refused, not attempted',
    r.ok === false && /cannot be polled/.test(r.error));
  ok('missing BHAIYAA_MW_URL is reported at startup',
    /BHAIYAA_MW_URL/.test(registry.describeMisconfiguration('bhaiyaa') || '') || !!process.env.BHAIYAA_MW_URL);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
});
