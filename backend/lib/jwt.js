// HS256 JWT signing, on node:crypto alone.
//
// The NewForce middleware authenticates every call with a Bearer token the caller signs itself
// (see ADT_Static_Web/submit_user.php, which does this with firebase/php-jwt). We need the same
// token from Node, and the rest of this backend runs with no dependencies at all — `node
// backend/dev.js` and the demo is up, no install step. Pulling in a JWT library for one HMAC
// would trade that for ~40 lines we can just write.
//
// Signing only. There is nothing here to verify tokens with, deliberately: we are the client in
// this exchange, and a verify function nobody calls is a thing that rots.

const crypto = require('node:crypto');

// JWT uses base64url, which is base64 with two characters swapped and the padding dropped.
function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Returns a signed compact-serialization JWT.
//
//   payload   claims object; `iat` and `exp` are filled in when absent
//   secret    the shared HMAC secret
//   ttlSec    lifetime, default 24h — what the PHP callers use
function signHs256(payload, secret, ttlSec) {
  if (!secret) throw new Error('signHs256: a secret is required');
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = Object.assign(
    { iat: issuedAt, exp: issuedAt + (ttlSec || 86400) },
    payload
  );
  const signingInput = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    + '.' + base64url(JSON.stringify(claims));
  const signature = base64url(crypto.createHmac('sha256', secret).update(signingInput).digest());
  return signingInput + '.' + signature;
}

module.exports = { signHs256, base64url };
