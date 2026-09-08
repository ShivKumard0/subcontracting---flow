# Create Client → NewForce middleware sync — investigation & plan

**Goal.** An Account Manager fills *Client & Contracts → Create Client* in the Executive Layer, and
the lead lands in the NewForce CRM through the same middleware the ADT website's *Book a demo*
form uses (`nfmwstaging.maaserp.com` → `/addUser/v1`).

> **Status as of 7 Aug 2026: working against preprod.** Client creation mirrors again
> (`CLI-000019` ↔ CRM `27674`). A wrong `NF_MW_JWT_SECRET` in `backend/.env` had been failing every
> push with `Token is invalid`; the correct value is `c4f49…e33a`, per
> `ADT_Static_Web/submit_user.php:15` — see §2.1. Use `nfmwpreprod.maaserp.com`: staging rejects
> this secret. Still blocked: **client status push**, because `/updateClientStatus/v1` is deployed
> on no host (§2.2).

**Status: built and working against staging** (3 Aug 2026). `CLI-000002` ↔ CRM `27801`. Run it with
`node --env-file=backend/.env backend/dev.js`; see `backend/.env.example`. All open questions are
answered — §6.1 fixed and deployed, §6.2–§6.7 decided below. What is deliberately NOT built is the
reverse poll (§6.3): the middleware publishes no read-back endpoint.

---

## 1. What exists today, on both sides

### 1.1 The Executive Layer mockup (this repo)

| Piece | Where |
|---|---|
| Sidebar item, persona-gated to `account-manager` | [js/core.js:1137](js/core.js#L1137) |
| Opens the intake flow | `startContractIntake()` — [js/pages.js:8642](js/pages.js#L8642) |
| Renders fields from the source system's own schema | `GET /adt/form-schema` — [js/pages.js:8657](js/pages.js#L8657) |
| Submits | `POST /adt/submit` — [js/pages.js:8756](js/pages.js#L8756) |
| Mints `CLI-####` locally **first**, then pushes out | `createMirrorPendingClient()` / `attemptMirror()` — [backend/server.js:363](backend/server.js#L363), [backend/server.js:394](backend/server.js#L394) |
| The "source system" it currently pushes to | `backend/mock-adt-server.js` on :4100 — JSON + `Authorization: Bearer demo-adt-staging-key`, returns `{data:{id:"ADT-SUB-0001"}}` |
| Retry after a failed push | `POST /employees/:code/mirror-retry` — [backend/server.js:836](backend/server.js#L836) |

The important thing: **the mirror architecture is already right.** Our ID is committed before
anything leaves the box, the outbound payload is kept verbatim in `raw_source_payload` so a retry
has something to re-send, failure is a recorded state rather than a lost record, and
[backend/schema.sql:18](backend/schema.sql#L18) already models source systems as a table with a
per-source unique index (`uq_de_source_record`) rather than a hardcoded enum. Adding NewForce as a
second source is a row in `source_systems` plus one new connector — not a migration.

### 1.2 How the ADT website actually talks to the middleware

Two independent implementations agree, so the contract is not in doubt:
[ADT_Static_Web/submit_user.php:83](../ADT_Static_Web/submit_user.php#L83) (the modal in your
screenshot), [ADT_Static_Web/submit_book_a_demo.php:96](../ADT_Static_Web/submit_book_a_demo.php#L96),
and `adtsolution_larawal/app/Http/Controllers/HomeController.php:644`.

```
POST {MIDDLEWARE_URL}/addUser/v1
Headers:  outhKey: <REDACTED — see backend/.env, not tracked>
          auth_validate: 1
          Authorization: Bearer <HS256 JWT>
          device_id: web_<10 hex>
          device_type: web
Body:     application/x-www-form-urlencoded   (http_build_query — NOT JSON)
JWT:      HS256, secret c4f49…e33a, {iat, exp: iat+86400,
          data:{id:1, role:"web", device_id, device_type:"web"}}
Response: {"status":1, "message":"User added successfully", "user_id":<int>, "data":"{…}"}
     or   {"status":0, "error":"…"}   ← note: always HTTP 200, status is in the body
```

Server side is `Newforce_Middelware/application/controllers/v1/admin/Adtwebsite.php` →
`add_post()` (routed at `application/config/routes.php:772`). Auth is `_authoriseWebsiteCall()`
at line 173: `hash_equals(OuthValue, header outhKey)` then JWT verify, with `role` restricted to
`web`/`anonymous`. `OuthValue` is `<REDACTED>` in `application/config/constants.php:21`.

**Mandatory fields** (`_validateInputs('add')`, line 212, plus the `HIRING_COUNTRIES` gate at 251):

- `USER_EMAIL` — valid email, `max_length[100]`; **unique against `USERS.USER_EMAIL` unless `ALLOW_DUPLICATE=1`**
- `USER_FIRST_NAME` — required, ≤100
- `COMP_NAME` — required, ≤200
- `USER_MOBILE` — `regex_match[/^\d{7,15}$/]`
- `MOBILE_CODE` — `regex_match[/^\+?\d{1,4}$/]`
- `HIRING_COUNTRIES` — non-empty array; rejected when `ADT_REQUIRE_HIRING_COUNTRY` is TRUE (it is, `constants.php:32`)

Our form makes only *full name* and *work email* required
([js/pages.js:8732](js/pages.js#L8732)) — company, phone, dial code and country are all optional.
**Four of the middleware's six mandatory fields are optional in our UI**, so a perfectly valid
Executive Layer submission would be rejected by the CRM. That is a UI change, not just a mapping.

---

## 2. Live probe results (read-only endpoint, nothing created)

Reproduced the exact ADT header set in Node against `/adtUserExist/v1` (an existence check — it
writes nothing) with a throwaway address:

| Host | Headers | Result |
|---|---|---|
| `mw.newforceltd.com` (prod) | full ADT set | **HTTP 200** `{"status":"0","msg":"Data not found!"}` — key accepted, lookup ran |
| `mw.newforceltd.com` | no `outhKey` | HTTP 200 `{"status":0,"error":"Authentication Failed"}` |
| `nfmwstaging.maaserp.com` | full ADT set | **HTTP 401** `{"msg":"access_key_not_found"}` |
| `nfmwstaging.maaserp.com` | no JWT | HTTP 401 `{"msg":"JWT Authorization header missing"}` |

Also tried `access_key`, `accessKey`, `oauthKey`, lowercase `outhkey`, and `outhKey`+`access_key`
together against staging — all identical `access_key_not_found`.

**Reading:** the key value and header name are correct (prod proves it). Staging rejects *before*
reaching `Adtwebsite`, in the global `NF_Auth::auth()` layer — and it fails on a Redis-backed
`access_key`, which the ADT website has never sent. On current middleware master
(`master_29_07_26`, `application/core/NF_Auth.php:478`) that path is only entered when an
`access_key` is actually present, so this call would pass. The unconditional
`if (empty($headerData['access_key'])) return "Access key not found";` exists only in the
**commented-out legacy block** at `NF_Auth.php:245`. Staging appears to be running that older
build.

Staging does reach the key check *after* the JWT check, which suggests the shared JWT secret is
accepted there. I could not prove that conclusively — the follow-up probe that would have
confirmed it (deliberately bad signature vs. good) was blocked by a permission prompt, so treat
"staging accepts the JWT secret" as likely, not established.

### 2.1 Re-probe, 7 Aug 2026 — RESOLVED: `.env` held the wrong secret

**Outcome first: fixed.** `backend/.env` had been edited to a JWT secret (`ac8ad…bf4bf`) that no
host accepts. Restoring the real one — `c4f49…e33a`, the value in
`ADT_Static_Web/submit_user.php:15` — makes preprod work. `CLI-000019`, which had failed with
`NewForce rejected our credentials (401)`, re-mirrored on retry and now carries CRM record
`27674`. The investigation that led there is kept below because two of its conclusions were wrong
and worth not repeating.

**Also settled: preprod is the host to use.** The corrected secret is accepted by
`nfmwpreprod.maaserp.com` and *still rejected* by `nfmwstaging.maaserp.com`, so staging has since
been rotated to something else. `NF_MW_URL=https://nfmwpreprod.maaserp.com` is correct and should
stay.

The rest of §2.1 records the state before the cause was found.

Re-ran the same read-only `/adtUserExist/v1` check against all three hosts with the credentials
then in `backend/.env` (`outhKey <REDACTED>`, JWT secret `ac8ad…bf4bf`):

| Host | `/adtUserExist/v1` | `/updateClientStatus/v1` |
|---|---|---|
| `nfmwpreprod.maaserp.com` | **HTTP 401** `{"msg":"Token is invalid"}` | HTTP 200, CodeIgniter HTML error page — route not deployed |
| `nfmwstaging.maaserp.com` | **HTTP 401** `{"msg":"Token is invalid"}` | same — route not deployed |
| `mw.newforceltd.com` (prod) | **HTTP 401** `{"msg":"Token is invalid"}` | same — route not deployed |

**It is the signature, not the claim shape.** The probe that §2 above could not run has now run:
the configured secret, a deliberately wrong secret (`definitely-not-the-secret`), and the literal
string `not.a.jwt` all produce *byte-identical* `Token is invalid`. Varying the claims against the
configured secret (`role=anonymous`, flat claims without the `data` wrapper) changes nothing
either. The middleware is failing us at JWT verification, before any claim is read — so
`NF_MW_JWT_SECRET` in `backend/.env` is not the secret the middleware holds. Either it was never
the shared one, or it has since been rotated.

Dropping the `Authorization` header changes the error to `JWT Authorization header missing` /
`JWT Authorization header is required`. So the header-optional path described under §4 below no
longer exists on any of these three hosts: **a valid JWT is now mandatory**, and the commented-out
`Authorization` line in `submit_user.php` no longer reflects what the middleware accepts.

Two consequences for the status-push feature: the credential must be reissued before anything
mirrors, and `/updateClientStatus/v1` is still undeployed on all three hosts — so §6.1's "verified
on staging" no longer holds, and the top-of-file status line is stale.

**Everything fixable on our side has been ruled out.** Each of these was probed against preprod and
returns the same `Token is invalid`:

| Hypothesis | Test | Result |
|---|---|---|
| Clock skew (php-jwt reports `iat` future / `exp` past as invalid) | compared our clock to the middleware's `Date` header | **0s skew** — not the cause |
| `iat`/`exp` shape | backdated 300s; backdated 1h; omitted entirely; `nbf` added | no change |
| 64-hex secret needs decoding before use as the HMAC key | signed with hex-decoded 32 raw bytes, base64-decoded, uppercased | no change |
| Claim shape | `role=anonymous`; flat claims without the `data` wrapper | no change |
| Header set | with/without `outhKey`, with/without `auth_validate` | no change |

So there is no signing change on our side that makes this pass — `backend/lib/jwt.js` is producing a
well-formed HS256 token and the middleware simply does not accept it.

**Two conclusions drawn here were WRONG — recorded so the reasoning is not reused.**

*Wrong 1: "the credential must be reissued."* It did not need reissuing. The working secret was
never lost — it is hardcoded in `ADT_Static_Web/submit_user.php:15`, the very file §1.2 cites as
the contract, and it was also still sitting in the editor's local history of `.env`. **Before
asking a third party to rotate a credential, check the reference implementation for it.** That is
where this one had been the whole time.

*Wrong 2: the Redis token-lookup theory.* The reasoning was that a correctly-signed token and the
literal string `not.a.jwt` are rejected identically, which signature verification "would not" do —
so `NF_Auth::auth()` must be doing a token lookup rather than a verification. That inference was
unsound: `firebase/php-jwt` raises for a malformed token and for a bad signature alike, and this
middleware flattens every such throw into one `Token is invalid` string. Identical errors carried
no information about the mechanism. The token was being verified normally; the secret was simply
wrong. **A single generic error message is not evidence about what produced it.**

### 2.2 What still is not deployed

`/updateClientStatus/v1` returns the CodeIgniter "page no longer There" HTML on preprod, staging
and prod alike, so the branch carrying it (`ADT_Website_Auth_Fix_Newforce_Middelware`, commit
`80071d61`) is not deployed anywhere. That is unaffected by the secret fix: **client status push
stays blocked**, and `pushStatus` will keep returning "the updateClientStatus endpoint is most
likely not deployed on that middleware yet" until the branch ships. Client *creation* is unaffected
and works.

### 2.3 The role claim: `web` vs `anonymous`

`submit_user.php:110` now signs `role='anonymous'`, with a comment saying the auth gate "only
waives the access_key/auth_token requirement for role=anonymous JWTs" — which reads as though our
`role='web'` connector would be refused. Probed both against preprod with the correct secret:
**`web` and `anonymous` are both accepted (HTTP 200).** Preprod therefore carries §6.1's
per-controller waiver rather than the per-role one, so `backend/connectors/newforce-mw.js` needs no
change. Left as-is deliberately — matching the PHP client here would be a change with no evidence
behind it.

---

## 3. The design decision this forces

The mock ADT server and the NewForce middleware are not the same shape of thing:

| | mock-adt-server | NewForce middleware |
|---|---|---|
| Transport | JSON | form-urlencoded |
| Auth | one static bearer | static key + per-request signed JWT + device headers |
| Field names | our form's names | CRM column names (`USER_FIRST_NAME`, `COMP_NAME`, …) |
| Their ID | `ADT-SUB-0001` | integer `user_id` |
| Failure | HTTP status | **always HTTP 200**, `status:0` in the body |
| Read-back | `GET /api/employee-intake/latest` | **does not exist** (see §6.3) |

So don't bend `attemptMirror()` to cover both. Introduce a **connector** seam: keep
`createMirrorPendingClient` → `attemptMirror` → record-outcome exactly as it is, and move the
"how do I actually talk to system X" part behind a small interface with two implementations.
That preserves everything the current design gets right and makes the mock a peer of the real
thing rather than something to be replaced.

---

## 4. Field mapping

Our form field → `/addUser/v1` parameter. Constants follow `submit_user.php` so an Executive
Layer lead is indistinguishable in the CRM from a website lead except for `LEAD_SOURCE`.

| Our field | MW field | Note |
|---|---|---|
| `full_name` | `USER_FIRST_NAME` / `USER_LAST_NAME` | split on first whitespace, `strtolower` — same as the website |
| `work_email` | `USER_EMAIL` | lowercased |
| — | `USER_PASSWORD` | `strtolower(first_name) . '@123'` (website behaviour; see §6.5) |
| `phone_number` | `USER_MOBILE` | must be 7–15 digits |
| `phone_country_code` | `MOBILE_CODE` | `+` + digits, ≤4 |
| `company_name` | `COMP_NAME` + `company_name` | both, as the website sends both |
| `country_hiring_in` | `MARKET` + `HIRING_COUNTRIES[0]` | array — encode as `HIRING_COUNTRIES[0]=…`. `MARKET` keeps its display case (§7.2) |
| `looking_for` | `looking_for` | |
| `heard_about_us` | `HEAR_ABOUT_US` | |
| — | `LEAD_SOURCE` | **`'Executive Layer'`** — the one deliberate difference, so these leads are attributable |
| — | `LAST_ACTIVITY` | `'client added via Executive Layer by <account manager>'` |
| — | `USER_STATUS` / `USER_SUB_STATUS` | `pending` / `interested` |
| — | `ADD_FROM`, `ENTITY_ID`, `SALES_ORDER_TYPE`, `SERVICE_GROUP`, `USER_TYPE`, `INDUSTRY_SECTOR` | `own`, `1`, `ADT Sales Process`, `Sub Contracting`, `0`, `1` |
| — | `CREATE_BY` | see §6.4 — needs a decision |
| — | `ALLOW_DUPLICATE` | see §6.2 |

---

## 5. Build plan — done

Built as described. What landed:

| File | What it is |
|---|---|
| `backend/lib/jwt.js` | HS256 signing on `node:crypto`. Keeps the zero-dependency promise. |
| `backend/connectors/newforce-mw.js` | The CRM push: mapping, PHP-style form encoding, `status:0`-in-a-200 handling, and the pre-submit duplicate check. |
| `backend/connectors/adt-solution.js` | The mock push, lifted out of `attemptMirror()` unchanged so the two are peers. |
| `backend/connectors/index.js` | Registry, per-source config, startup credential check. |
| `backend/.env.example` | Variable names and warnings. `backend/.env` is gitignored. |
| `test/connector-newforce-mw.js` | 48 checks over the pure parts, wired into `test/run-all.js`. |

Three things worth knowing about the shape of it:

**A client is pushed by its own `source`, not the configured one.** `attemptMirror()` dispatches on
`row.source`, so Retry on a mock-created client still goes to the mock after the backend has been
repointed at the CRM. Repointing changes where *new* clients go, nothing else.

**The duplicate check runs before a Client ID is minted.** Mint-first-push-second is right when
failure is transient — an outage must not cost an operator their work. A duplicate is not
transient: with `ALLOW_DUPLICATE=0` the CRM will refuse that payload forever, so minting first
would leave a client here that can never mirror however often Retry is pressed. `/adtUserExist/v1`
is asked first, and it **fails open** — a lookup that times out must not block a legitimate client.

**A failed push no longer claims success.** The final screen used to say "Submitted to NewForce
Solutions" whatever happened, with a blank Source Record ID. It now names what actually happened,
quotes the CRM's own reason, and points at Retry in All Clients.

### The original plan, for reference

Ordered so each step is independently verifiable and nothing is blocked on §6.1 until step 6.

**1. `backend/lib/jwt.js` — sign the JWT with no dependencies.**
HS256 over `base64url(header).base64url(payload)` via `node:crypto` `createHmac`. ~15 lines. Keeps
the repo's zero-dependency promise (this matters: it is the reason the demo runs with no
`npm install`). Verified in the probe script — the tokens it produced were accepted by prod.

**2. `backend/connectors/newforce-mw.js` — the connector.**
`submit(payload, opts)` → maps per §4, encodes with `URLSearchParams` (with the literal
`HIRING_COUNTRIES[0]` key), sends the five headers, 30s timeout to match the PHP client.
Normalises the reply into the shape `attemptMirror` already expects:
`{ok:true, sourceRecordId:String(user_id)}` or `{ok:false, error}`.
**`status:0` on HTTP 200 must be treated as failure** — the single most likely bug in this work.
Also treat HTTP 200 + missing `user_id` as failure.

**3. Connector registry + `source_systems` row.**
`newforce_mw` alongside `adt_solution`, chosen per source. Console URL → the NF admin console
already referenced in [js/exec-config.js:18](js/exec-config.js#L18).

**4. Config.** `NF_MW_URL`, `NF_MW_OUTH_KEY`, `NF_MW_JWT_SECRET`, `NF_MW_ENABLED`, read from
`process.env` with the mock as the default so the demo still runs standalone. Node 26 supports
`--env-file`, so a **gitignored** `backend/.env` and `node --env-file=backend/.env backend/dev.js`.
These are live CRM credentials — they must not be committed. (`ADT_API_KEY` is hardcoded as a
default at [backend/server.js:30](backend/server.js#L30); do not follow that precedent here.)

**5. Form + validation.** Make company name, phone, dial code and country required in
`submitCfgUserIntake()` and mark them in the schema, so our validation and the CRM's agree and the
Account Manager is told what is wrong *before* the round trip. Surface the middleware's own
`error` string verbatim on rejection — it is written for humans.

**6. Point it at staging and run one real lead end-to-end.** ✅ Done ahead of the build — see §7.
The whole contract is proven, so steps 1–2 are now transcription rather than discovery.

**7. Retry path.** `mirror-retry` already re-sends `raw_source_payload`; confirm it routes through
the connector for the row's own source. No new UI.

**Not in scope:** the reverse "Listen for submissions" poll (§6.3), Bhaiyaa/NFAdmin, and — see §8 —
**pushing later status changes**. Only creation is synced. The connector seam is what makes those
cheap later, and building them now would be speculative.

---

## 6. Doubts — I need answers on these

**6.1 — STILL RESOLVED.** Briefly reopened on 7 Aug when every call returned `Token is invalid`,
but that was a wrong secret in `backend/.env`, not a regression in this auth layer (§2.1). The
`access_key` waiver is deployed on preprod and works for both `role=web` and `role=anonymous`
(§2.3). The account below stands.

**6.1 — RESOLVED (3 Aug). Staging rejected the ADT credentials; fix committed, awaiting deploy.**
Staging runs `DA_Staging_Sprint_11_Newforce_Middelware`, which adds a Redis
`access_key`/`auth_token` requirement to `NF_Auth::auth()` and waives it for `role='anonymous'`
only. The website signs its own JWT with `role='web'`, so every lead was rejected before its
controller ran. Not a stale build — a hardening that did not account for the public forms.
Fixed on branch **`ADT_Website_Auth_Fix_Newforce_Middelware`** (commit `80071d61`), waived per
controller rather than per role so authenticated routes keep the requirement.
**Deployed to staging on 3 Aug 2026 and verified there:** `/adtUserExist/v1` with the ADT header
set now returns HTTP 200 (was 401), while a `role='web'` JWT on any other controller is still
rejected with `access_key_not_found`. Staging and production now behave identically, and step 6
of §5 is unblocked. Note this also un-broke *Book a demo* on adtstatic.newforceltd.com, which had
been failing for the same reason — leads submitted there while the sprint branch was live were
rejected and are worth checking for.

**6.2 — DECIDED: send `ALLOW_DUPLICATE=0`.** The website sends `1`, which skips
`is_unique[USERS.USER_EMAIL]`. But `add_post` *also* has reuse logic — same email + same company
(Case 1), or a new contact at an existing company (Case 4) — that **returns an existing `user_id`
rather than creating one**. Our `uq_de_source_record` index is `(source, source_record_id)`, so a
second Executive Layer client resolving to the same `user_id` would fail its mirror with "already
held by CLI-000X" and sit unmirrored forever.

Sending `0` makes that unreachable: `is_unique` fails during `_validateInputs('add')`, which runs
*before* the reuse logic, so one CRM user can never end up behind two Client IDs. It also fits an
internal tool, where the same client submitted twice is an Account Manager's mistake worth
telling them about, not a marketing lead worth capturing twice. Confirmed live (§7): the replay
came back `{"status":0,"error":"The Email field must contain a unique value.\n"}` with nothing
created.

Two consequences for the build: the connector must **`trim()` the error** (it carries a trailing
newline) and should map "must contain a unique value" onto the `work_email` field so the AM sees
it under the right input rather than as a banner. And a client legitimately re-submitted after a
CRM-side deletion will now be refused — acceptable, and visible, which the silent-reuse
alternative was not.

**6.3 — one-way or two-way?** The middleware has exactly five ADT endpoints
(`getChildUserEmail`, `adtUserExist`, `add`, `addConsultation`, `sendSubscribeEmail`) and **none
of them reads a lead back**. So the "Listen for NewForce Submissions" poll that exists for the
mock has no counterpart here, and a client created directly in the CRM cannot flow into the
Executive Layer. Is push-only acceptable for now, or do we need a read endpoint built on the
middleware side?

**6.4 — what should `CREATE_BY` be?** The website sends `'1'`; Book-a-Demo sends the literal
`'System'` with a comment doubting it. For Executive Layer leads the honest answer is the Account
Manager's own CRM user id — which means we need a mapping from Executive Layer user → CRM
`USERS.USER_ID`, and that mapping does not exist in this repo. Fall back to `1`, or is there a
dedicated service account?

**6.5 — `USER_PASSWORD`.** The website mints `firstname@123` for every lead. Replicating that from
an internal tool means creating CRM logins with a guessable password. Do we send it because the
field is expected, or omit it? (I have not checked whether `add_post` requires it — it is not in
`_validateInputs`.)

**6.6 — staging or production for the demo?** Everything above assumes staging. Staging is the
right answer, but note it is currently the broken one, and per an earlier finding on this estate a
pre-prod restore from live data means "test" leads can reach real people. If the demo has to work
this week, the choice is: fix staging, or point at prod and accept that every demo submission is a
real CRM lead. **I would not point a demo at prod** — but if that call gets made, `LEAD_SOURCE:
'Executive Layer'` at least makes them filterable.

**6.7 — does the Account Manager keep seeing NewForce's field list, or ours?**

Today the form renders from the *source system's* published schema, which is the honest part of the
demo. The middleware publishes no schema endpoint, so against NewForce the field list becomes ours,
maintained here — and the "rendered from its published field definition" line under the form
heading stops being true. Accept that (and reword the subtitle), or ask for a schema endpoint?

---

## 7. End-to-end proof against staging (3 Aug 2026)

Ran the exact payload the connector will send — form-urlencoded, `HIRING_COUNTRIES[0]` array
encoding, `MOBILE_CODE` with `+`, `role='web'` self-signed JWT, `outhKey` — at
`https://nfmwstaging.maaserp.com/addUser/v1`:

```
call 1  new lead, ALLOW_DUPLICATE=0        HTTP 200, 1447ms
        {"status":1,"message":"User added successfully","user_id":27800,
         "data":"{\"msg\":\"…\",\"sectorid\":19169,\"contactperson\":null}"}

call 2  same email replayed, ALLOW_DUPLICATE=0   HTTP 200, 194ms
        {"status":0,"error":"The Email field must contain a unique value.\n"}
```

**The contract in §1.2 and the mapping in §4 are confirmed end to end.** `user_id` is what
`source_record_id` will hold (`27800` here — an integer, so store it as text and never arithmetic
on it). Round trip is ~1.4s including the notification email, so the PHP client's 30s timeout is
right and the existing 8s frontend timeout in `execApi.js` is not.

The record created is `exec-layer-integration-test-20260803160243@example.com`, first name
`testlead`, company `TEST - Executive Layer integration (ignore)`, `LEAD_SOURCE: 'Executive
Layer'`. **Delete it from the staging CRM when convenient** — call 2 created nothing.

### 7.1 The built connector, same day

Through the real code path this time (`POST /adt/submit` with `CLIENT_SOURCE=newforce_mw`):

- **Created** `CLI-000002` ↔ `source_record_id 27801`, `mirror_state: mirrored`. The phone was
  submitted as `99999 00003` and the connector cleaned it to digits, which the CRM accepted.
- **Replayed the same email** → HTTP 409, `field: work_email`, and the store still held exactly two
  clients. The duplicate cost nothing and stranded nothing.
- **The mock is unaffected**: `CLI-000001` ↔ `ADT-SUB-0001` still mirrors as before.

Second record to delete from staging: `exec-layer-connector-test-1@example.com` (`user_id 27801`).

### 7.2 Where the leads actually appear — Users → All Users, **under entity "Open Dhi Private Limited"**

The **All Users** listing is scoped to the entity selected in the console header:
`Users.php:675` passes `'ENTITY_ID' => selected_entity_id()`, which is `$_SESSION['ENTITY']['ID']`
(`common_helper.php:1511`), and `userSearchBYAttr()` turns that into
`WHERE USERS.ENTITY_ID = …`. Our leads carry `ENTITY_ID = 1`, copied from `submit_user.php`, and
**entity 1 is "Open Dhi Private Limited"** — not "MaaS ERP Solutions", which is what a session
tends to have selected. Under the wrong entity the listing correctly reports *No Data Found*, and
no combination of the other filters will bring the row back.

Proven both ways on staging: searching `sts[]=pending` under MaaS ERP Solutions returned seven
users, none of them ours (highest id 27623, though 27800/27801 sort first by `USER_ID DESC`).
Switching the entity to Open Dhi Private Limited and repeating the identical search returned both.

So: **Change Entity → Open Dhi Private Limited → Users → All Users**, set Status to Pending (a
listing with no status filter returns nothing), clear Sales Order Type and the assigned-admin
filter, and Search. `LEAD_SOURCE = 'Executive Layer'` isolates ours from website leads.
`edit-user/<id>` opens a record directly and is *not* entity-scoped, which is why it worked while
the listing did not.

Every ADT website lead lands under the same entity for the same reason. Worth confirming with the
business that `ENTITY_ID = 1` is where ADT leads are meant to live — the entity list includes
`6 ADT Technologies Ltd`, `3 Newforce Global Services Ltd` and others, so 1 looks like a default
rather than a decision. Changing it is a one-line change in the connector, but it should follow
whatever the website does, not diverge from it.

### 7.3 Confirmed in the CRM console

Opened `https://nfadminstaging.maaserp.com/edit-user/27801` and read the rendered record:

- **`HIRING_COUNTRIES` → India is `selected`.** The view marks an option selected only from the
  `gethiring_country` API, i.e. from the `USER_HIRING_COUNTRY` table
  (`editUserView.php:380`). **The `HIRING_COUNTRIES[0]` array encoding is confirmed end to end** —
  this was the one part of the contract inferred from reading PHP rather than proven, and the CRM
  accepting the lead would not have shown it.
- Name, email, mobile, company and `LEAD_SOURCE: Executive Layer` all render as sent.
- **`MARKET` rendered empty** — the dropdown showed only its disabled "Select Market" placeholder.
  Cause: `editUserView.php:408` matches with a case-sensitive `$user['MARKET'] == $country` against
  a title-case country list, and we were sending `strtolower($country)` in imitation of
  `submit_user.php`. Fixed by keeping the display case; MySQL's default collation is
  case-insensitive so filters and GROUP BYs still fold ours together with website leads.

**This affects the ADT website too.** `submit_user.php:209` lowercases `MARKET` the same way, so
every website lead should also show an empty Market field on its record. Not caused by this work,
and not fixed by it — worth raising with whoever owns the website forms.

**Test leads do NOT email the real ADT inbox.** An earlier draft of this section said they did.
`add_post` does name `experts@adtsolution.com` with no environment check
([Adtwebsite.php:640](../newforce/Newforce_Middelware/application/controllers/v1/admin/Adtwebsite.php#L640)),
but the recipient list never reaches SES as written: `AwsMailer::sendMailByAws()` replaces to/cc/bcc
with `TEST_EMAIL_REDIRECT` whenever `platform != 'production'`
([AwsMailer.php:110](../newforce/Newforce_Middelware/application/models/v1/AwsMailer.php#L110)), and
staging sets `platform = 'staging'` (`constants.php:107`). Every staging lead notification therefore
goes to `events.newforceltd@gmail.com` alone. The guard is central rather than per-controller,
which is why the hardcoded array in `add_post` looks worse than it is — though it would become
real the moment that controller is copied somewhere that mails directly.

**Production is a different matter.** There `platform = 'production'`, the redirect does not apply,
and the hardcoded recipients are used as written. That is the reason not to point a demo at
`mw.newforceltd.com`.

---

## 8. Status sync — built and verified (3 Aug 2026)

`PATCH /employees/:code/status` now pushes the new status onward after its local transaction
commits. Ours first, theirs second, exactly as creation does and for the same reason: the
operator's decision and its audit entry are committed before anything is sent, so an outage at the
CRM cannot lose them. A failed push is recorded as a further log entry rather than rolled back —
the status here really did change — and the response carries a `statusSync` block so the caller
does not have to infer the outcome from log text.

It fires only for a client the CRM actually holds (`mirror_state = 'mirrored'` with a
`source_record_id`). Against the mock, which has no notion of a client's status, the connector
reports `supported:false` and the change simply stays local — `statusSync: null`, not an error.

**Verified end to end against staging.** Through the app: `CLI-000002` (CRM `27801`)
Active → Inactive → Active, both transitions `{"ok":true,"changed":true}`; `CLI-000001` on the mock
returned `statusSync: null`. In the console under Open Dhi Private Limited, filtering by status:
`27801` and `27804` are now **active**, while `27800` — which was never pushed — is still
`pending`. That untouched record is the control.

Endpoint behaviour on the deployed build: a website lead claimed as ours is refused
(`"User 27791 was not created by Executive Layer."`); re-sending a status the CRM already holds
answers `{"status":1,...,"changed":false}`; an unknown id is refused; `USER_ID` must be numeric
(`1 OR 1=1` rejected); the status whitelist and the `LEAD_SOURCE` requirement both hold; and
without `outhKey` the call is `Authentication Failed`.

Two deliberate limits: **`USER_SUB_STATUS` is left alone** (it reads `Interested`; moving it could
trip CRM workflows that have not been traced), and **there is no retry for a failed status push** —
the divergence is logged, but re-pushing means changing the status again.

### Why it needed a middleware change

The CRM's own `admin/users/updateUser` (`v1/admin/Users.php:2352`) is what the admin console calls,
and it is unreachable with the credentials the Executive Layer holds. Tested against staging,
sending no `USER_ID` so the call could not modify anything:

```
role=web        -> 401 access_key_not_found                       (blocked by NF_Auth)
role=anonymous  -> 200 {"status":0,"error":{"USER_ID":"required"}} (gate passed)
```

The `web` rejection is correct and is the scoping decision from the auth fix: only `Adtwebsite`
waives the Redis `access_key`/`auth_token` pair, and `updateUser` lives on the admin controller.

### What was built instead: a scoped endpoint on Adtwebsite

`POST /updateClientStatus/v1` (commit `8cd9f6c1` on `ADT_Website_Auth_Fix_Newforce_Middelware`),
behind the same `_authoriseWebsiteCall()` gate as `addUser`. Deliberately narrow:

- **`USER_STATUS` only**, whitelisted to `pending`/`active`/`inactive`. A status endpoint that can
  rewrite a lead is not a status endpoint.
- **Only leads whose `LEAD_SOURCE` names the caller** — matched entry-by-entry, since
  `_appendLeadSource` comma-concatenates that column on reuse. Without this it could move any user
  in the CRM, which is the property that makes `updateUser` worth protecting in the first place.
- **Re-sending the current status is success with `changed:false`.** `UserModel::updateUser`
  reports `affected_rows()==0` as failure, so the no-op would otherwise return an error and a
  caller would retry it forever.

Note also: CodeIgniter serves an HTML "page no longer there" under **HTTP 200** for a route it does
not have, so before the deploy the connector reported "could not read the response". It now names
the likely cause — the endpoint not being deployed — with a test pinning that wording.

Still push-only: last writer wins, with no reconciliation if the CRM copy is changed independently.

### Security finding — raise this regardless

The `anonymous` result above is not specific to `updateUser`. `NF_Auth::auth()` waives the
Redis check for `role='anonymous'` **globally**, not per controller
(`$isAnonymous`, `NF_Auth.php:475`); `updateUser_post` has no `outhKey` check of its own; and it is
absent from `auth_roles.php`, so no role requirement applies either. Anyone holding the shared JWT
secret can therefore call it — and the secret is embedded in `ADT_Static_Web/submit_user.php`,
`submit_book_a_demo.php` and the Laravel `HomeController`.

This predates the auth fix on `ADT_Website_Auth_Fix_Newforce_Middelware` — that branch narrowed the
`web` role, it did not widen `anonymous`. But it undercuts the hardening the sprint branch was
added for, and it is the shortcut a status-sync implementation would otherwise reach for. It should
be closed before that branch is promoted: scope the `anonymous` waiver the same way the `web` one
now is, and give `updateUser` a gate of its own.

Not exploited to build anything, and not tested beyond the validation-error probe above — nothing
was modified.
