# Bhaiyaa signup → Store Operations board → KYC in the Logs drawer

**Goal.** A merchant signs up at
`https://bhaiyaastaging.maaserp.com/Dhihyperlocal_Seller_Web_Portal/sign-up`, the store opening
appears on the Ops Manager's **Store Operations** board, and the Ops Manager completes KYC from
the row's **Logs** drawer using the verification panel that today only exists inside *New store*.

**Status:** investigation complete, decisions taken, nothing built yet.

**Decisions (4 Aug 2026).** The twelve demo rows **stay hardcoded**; only new arrivals are dynamic
— which removes the largest piece of the original plan. Columns the Bhaiyaa signup does not
capture get **dummy values**. KYC stays a **dummy animation**, pending → done. And the inbound
sync needs **no Seller_MW change** — existing APIs are enough, verified live against staging
(§3.2).

---

## 1. What I found before planning anything

### 1.1 The board on that screen is not backed by anything

The twelve store openings are a hardcoded array: `soRuns` at [js/core.js:941](js/core.js#L941).
Every count and filter reads it — `soStageCount`, `soRunsForStage` ([core.js:966](js/core.js#L966))
— and the page never calls the backend. The "Simulate: Merchant completes this" button in the Logs
drawer moves an in-memory object; a refresh puts it back.

Meanwhile a **real** store store exists and is used by different screens: the `stores` table
([backend/schema.sql:173](backend/schema.sql#L173)) with `store_code` / `source_record_id` /
`mirror_state` and KYC columns already on it, `GET|POST /stores`, and the *New store* flow
(`startStoreIntake()`), which writes through `execApiCreateStore` ([pages.js:7853](js/pages.js#L7853)).

So there are two parallel worlds: a demo board and a real store table, and they have never met.
**Syncing signups "to this page" means first making that page read the backend** — that is the
prerequisite nobody has costed, and it is the largest single piece of this work.

### 1.2 There is no Bhaiyaa connector at all

`POST /stores` mints *both* ids locally — ours and Bhaiyaa's — via `mintBhaiyaaRef()`
([backend/server.js:975](backend/server.js#L975)), with a comment that says exactly what is
missing: *"Bhaiyaa is a mock in this environment… When a real Bhaiyaa stands behind this, the ref
comes back from that call and this line goes."* Nothing in this repo has ever spoken to Bhaiyaa.

The good news is the same as it was for NewForce: the schema is already shaped for it
(`source`, `source_record_id`, `mirror_state`, per-source unique index), and the connector seam
built for `newforce_mw` takes a third implementation without redesign.

### 1.3 The real signup collects much less than the board shows — and no Aadhaar number

`RetailerSignUpForm` posts exactly this to `retailer_sign_up_register`
([RetailerSignUp.php:55](../Dhihyperlocal_Seller_Web_Portal/application/controllers/maas/BBC/RetailerSignUp.php#L55)):

```
firstname, lastname, email, password, country_code, mobilenumber,
termsconditionstatus, msastatus, fssaistatus, device
```

Everything else in that controller — store name, vertical, address, GST, PAN — is **commented
out**. The board's columns are store name, merchant, role (seller/buyer), category, turnover band
and city. **Not one of those is captured at signup.**

Two further facts that matter more than they look:

- **Signup creates a retailer, not a store.** It returns `{"status":1,"Result":{"retailer_id":N}}`
  (`RetailerOnboarding.php:645`). The store row comes from a later wizard step. So a freshly
  synced signup is a *merchant account with no store yet* — which is, to be fair, exactly what the
  board's first stage ("Signup") is supposed to mean.
- **Bhaiyaa asks for an Aadhaar *image*, not an Aadhaar *number*.** The signup wizard has
  `fileInputAadharCard` (a document upload). Our KYC stage wants a 12-digit number to send to
  UIDAI. These are not the same input and one cannot be derived from the other.

### 1.4 The KYC panel is an animation

`storeRunKyc()` ([pages.js:8562](js/pages.js#L8562)) walks `bhaiyaaKycChecks` on a 720ms
`setTimeout` and marks each one done. The evidence strings are built from the form draft — the
name match is literally `owner + ' ≈ ' + owner.toUpperCase()`
([pages.js:8586](js/pages.js#L8586)). There is no UIDAI call, no screening call, and **no failure
path**: `storeKycDone` is set unconditionally at the end.

Moving that panel into the Logs drawer is a modest UI job. Making it *mean* something is a
different project, and the board already tells a story about it — run #7 in `soRuns` is halted
with "UIDAI returned a different name for this Aadhaar", a state the real panel cannot produce.

### 1.5 No read-back endpoint on Bhaiyaa either

Seller_MW's `maasRoutes.php` has plenty of per-id reads — `getStoreById`, `getAdminStore`,
`checkRetailerExist`, `getStoreDetailsWithStoreNew` — but nothing that answers *"which signups
have happened since X"*. Same wall as NewForce, and the same three ways through it (§3.2).

Auth is also **not** the NewForce pattern: `RetailerOnboarding extends NF_Auth` and calls
`$this->auth()`, and the portal first mints a device token through `generateTokensForDevice` /
`validateAccessToken`. That handshake has to be replicated or bypassed with a purpose-built
endpoint.

---

## 2. What the request actually decomposes into

| # | Piece | Where | Rough size |
|---|---|---|---|
| A | Make the Store Operations board read the backend instead of `soRuns` | this repo | **largest** |
| B | Inbound sync: a Bhaiyaa signup becomes a store row here | this repo + Seller_MW | medium |
| C | KYC panel moved into the Logs drawer and wired to a real step | this repo | medium |

They are separable and A gates the other two: until the board is real, there is nowhere for a
synced signup to land and nothing for the Logs drawer to persist against.

---

## 3. The plan

### 3.1 Part A — keep the twelve, append the real ones

Per the decision, `soRuns` stays exactly as it is and synced stores are **appended** to it. That
removes the migration, the seeding question and the risk of breaking a board that currently works.

1. On page load, fetch synced stores (`GET /stores?source=bhaiyaa`) and map each into the shape
   `soRuns` uses — `ref`, `store`, `merchant`, `role`, `category`, `band`, `city`, `age`, `stage`,
   `sub` — with dummy values where Bhaiyaa gives us nothing.
2. Concatenate rather than replace: `soRunsAll() = soRuns.concat(syncedRuns)`. `soStageCount` and
   `soRunsForStage` read that function instead of the array. Roughly a dozen call sites.
3. Real rows carry a flag (`live:true`) so the drawer knows which ones persist. A hardcoded row's
   "Simulate" button keeps its current in-memory behaviour; a live row's actions write to the
   backend. **The two must be visibly distinguishable** — a board where some rows survive a
   refresh and others silently do not is the kind of thing that erodes trust in a demo.
4. Stage and sub for a live row derive from the store's own columns (`kyc_status`, `status`),
   never stored twice.

### 3.1b (superseded) — making the whole board real

Replace `soRuns` with the `stores` table. Concretely:

1. Add the journey columns the board needs and the table lacks — `stage` (which of the four
   stages) and `sub` (which step inside it) — or derive them from `kyc_status` / `mirror_state` /
   `status`. **Deriving is better**: two sources for "where is this store" is how the badge and
   the timeline end up disagreeing, which is the bug the client status form was built to avoid.
2. `GET /stores` gains the fields the board reads (merchant name, category, band, city, age).
3. `soRunsForStage` / `soStageCount` read a store list fetched once per page load, exactly as
   `mdEnsureLoaded` already does for All Clients.
4. The step machine (`soSteps`, halt handling) stays as it is — it is good, and it is the part
   worth keeping.
5. "Simulate: Merchant completes this" becomes a real `POST /stores/:code/advance` that writes a
   `store_events` row. The table for that already exists.

**The honest cost:** the 12 demo rows disappear. A real board starts empty and fills as signups
arrive. If the demo needs to keep showing a populated pipeline, the rows have to be seeded into
the database instead of living in JS — worth deciding before this starts (§4.1).

### 3.2 Part B — inbound sync, using Bhaiyaa's existing APIs

**No Seller_MW change is needed.** Verified live against
`https://bhaiyaastaging.maaserp.com/Dhihyperlocal_Seller_MW/v18` — three calls, all read-only:

**1. Mint a device token** — `POST /maas/BBC/JwtAuth/generateTokensForDevice` with
`device_id` + `device_type=web`. No credentials at all; it is the same public bootstrap the seller
portal performs on every page load (`RetailerSignUp.php:150`). Returns an access token whose
payload carries `token_type: device_level`, which `NF_Auth::auth()` accepts outright
(`Dhihyperlocal_Seller_MW/application/core/NF_Auth.php:78`).

**2. List stores newest-first** — `POST /getAdminStoreList` with `admin_type=superadmin`. The
model drops its ownership filter for that admin type and orders by id descending:

```php
// CommonStoreModel::getAdminStoreList
if (strtolower($dataArray['admin_type']) != 'superadmin') {
    $this->db->where('RETAILER_STORE.retailer_id', $dataArray['admin_id']);
}
$this->db->order_by('RETAILER_STORE.id', 'DESC');
```

Live result: `{"status":1,"data":"[{\"id\":\"3675\",\"store_name\":\"Treutel PLC\",\"type\":\"community\"}, …]"}`.
Thin — id, name, type — but that is all a cursor needs. **Highest `id` seen becomes the cursor**,
exactly like `adt_last_seen_source_id` today. Note `data` is a JSON *string* inside the JSON, so it
needs a second parse.

**3. Fetch details per new id** — `POST /getStoreById` returns 26 fields:
`id, retailer_id, store_name, store_image, store_type, store_payment_type, store_status,
store_location, store_lat_points, store_long_points, created_at, main_status, pin_code,
store_base_currency, store_country, type, services, orderTypes, …`

So the board's columns come from: **store name**, **store type**, **created_at** (age), **country /
pin code** (city), **type** (store vs community). Missing and therefore dummied per the decision:
merchant display name (only `retailer_id` is returned — a retailer lookup could fill it later),
category, and turnover band, which is an Executive Layer concept Bhaiyaa has no equivalent for.

`source_record_id` = the `RETAILER_STORE.id`. The store genuinely exists on Bhaiyaa before we ever
see it, so unlike the client flow there is no mint-first/mirror-second dance here — this is pure
inbound ingestion, the same shape as `/adt/poll`, and `mirror_state` is `mirrored` on arrival.

**Security note, because we are relying on it.** `admin_type=superadmin` is **client-asserted**.
A device-level token carries no user identity (`user_id: null`), yet passing that one parameter
returns every store on the platform. Nothing about the caller is checked. That is an authorization
flaw in Bhaiyaa, not a feature — it is what makes this integration possible without credentials,
and it would let anyone enumerate the store base. Worth raising separately; it matches the
client-asserted-role pattern already flagged in the LBP work.

### 3.3 Part C — KYC in the Logs drawer

The panel itself lifts cleanly: `storeKycListHTML()` is already a pure function of a draft object,
and `bhaiyaaKycChecks` is a plain list. Rendering it in the drawer against a store row instead of
the intake draft is small.

What is not small is what it should *do*:

- It needs an **Aadhaar number**, which Bhaiyaa never captured. So the drawer needs an input for
  the Ops Manager to enter it — which fits the request ("the ops manager will complete the KYC
  process") and is probably what you meant.
- Where the result is written: `stores.kyc_status`, `kyc_verified_by`, `kyc_verified_at`,
  `aadhaar_masked` **already exist** on the table. Nothing new needed.
- Whether it stays a simulation. If it does, say so on screen — an Ops Manager who believes a
  government identity check happened, when nothing left the building, is the worst outcome
  available here (§4.4).

---

## 4. Settled, and what is left open

**Settled 4 Aug 2026.** Twelve demo rows stay hardcoded, new arrivals append (§3.1). Missing
columns get dummy values. KYC is a dummy animation, pending → done. No Seller_MW change — existing
APIs verified live (§3.2).

### Still open

**4.1 — an account-only signup produces nothing to poll.** `retailer_sign_up_register` creates an
`ADMIN` row; the `RETAILER_STORE` row comes later from `addRetailerStore`. A merchant who stops
after the account step therefore never appears on a board polling stores. Two readings, and they
give different demos:
(a) that is correct — no store, nothing to show;
(b) the board's first stage is literally "the merchant is filling in the signup", so an
account-with-no-store is exactly what stage 1 means and should appear.
For (b) the cursor would be `max(ADMIN_ID)` from `getAllRetailer` — which works (auto-increment,
newest highest) but returns only `ADMIN_ID, ADMIN_FULL_NAME, POSITION`, with no created-at and no
email. Which behaviour do you want when you submit the form?

**4.2 — poll cadence and trigger.** The client sync polls only while its panel is open. Should the
store board poll on load, on a timer while open, or behind a Refresh button? A timer against
staging is real traffic every few seconds.

**4.3 — what "complete the KYC" writes.** The animation ends and then what: `kyc_status` moves
`Pending → Verified` on the store row and the run advances from stage 2 to stage 3, with a
`store_events` entry naming the Ops Manager? That is what I would build. Confirm the run should
advance, rather than only the badge changing.

**4.4 — entity scoping.** The board sits under *Dhi Hyperlocal* while clients sit under *ADT*, but
the backend has no notion of entity — `stores` and `direct_employees` are global. Leaving the
switcher presentational is fine for now; it stops being fine the moment two entities hold stores
that must not see each other. Flagging rather than asking.
