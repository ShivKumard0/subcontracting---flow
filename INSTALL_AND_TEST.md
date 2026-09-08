# Executive Layer — install and test

Everything needed to get this running and to prove it works, including the two live integrations
(NewForce CRM and Bhaiyaa).

---

## 1. Requirements

| | |
|---|---|
| **Node.js** | **22 or newer.** Tested on v26.5.0. `node:sqlite` arrived in Node 22 and `--env-file` in 20.6 — on Node 22.x you may need `--experimental-sqlite`; from Node 24 it just works. |
| **npm install** | **Not needed.** No dependencies, deliberately — the whole backend runs on Node's built-in `http` and `node:sqlite`. |
| **Ports** | 4000 (backend), 4100 (mock NewForce site), 5500 (frontend). All localhost. |
| **Network** | Only for the live integrations: `nfmwstaging.maaserp.com` and `bhaiyaastaging.maaserp.com`. Without it everything still runs against the built-in mock. |
| **Browser** | Anything current. No build step, no bundler — the frontend is plain JS served as files. |

Check your Node before anything else:

```
node --version          # want v22.x or higher
```

---

## 2. Install

```
# 1. Unzip anywhere. No install step follows.
cd Executivelayer_mockup

# 2. Start everything — backend, mock site and frontend, one command
node --env-file=backend/.env backend/dev.js

# 3. Open
http://localhost:5500/index.html
```

`Ctrl-C` stops all three.

You should see:

```
  New clients:   newforce_mw -> https://nfmwstaging.maaserp.com
  Poll source:   none — newforce_mw is push-only (no read-back endpoint)
```

If a `CONFIG ERROR` line appears instead, a credential is missing — see §3.

### If there is no `backend/.env`

```
cp backend/.env.example backend/.env      # then fill in the two keys
```

`backend/.env` is gitignored on purpose: it holds live CRM credentials. `backend/.env.example`
carries every variable name and what it does.

### Running with no configuration at all

```
node backend/dev.js
```

Works, and is the right way to demo the UI without touching anyone's staging systems. Clients are
created against `backend/mock-adt-server.js` on :4100 instead of the real CRM, and the store board
shows its seeded rows only. Nothing else changes.

---

## 3. Configuration

All of it lives in `backend/.env`. The two that decide behaviour:

| Variable | Effect |
|---|---|
| `CLIENT_SOURCE` | `newforce_mw` = new clients go to the real CRM. `adt_solution` = they go to the local mock. |
| `BHAIYAA_MW_URL` | Set = the store board can sync from Bhaiyaa. Unset = the Sync button reports it cannot reach Bhaiyaa. |

The rest (`NF_MW_OUTH_KEY`, `NF_MW_JWT_SECRET`, `BHAIYAA_OUTH_KEY`, timeouts, `NF_MW_CREATE_BY`,
`NF_MW_ALLOW_DUPLICATE`) are documented inline in `backend/.env.example`.

**Do not point `NF_MW_URL` at `https://mw.newforceltd.com`.** That is production: every submission
is a real lead, and the middleware emails the real recipients rather than redirecting to the test
inbox.

---

## 4. Automated tests

```
node test/run-all.js
```

Expected — five suites, all passing:

```
══ ccj-harness.js ══            950 passed, 0 failed
══ ccj-handlers.js ══             8 passed, 0 failed
══ runner-harness.js ══     ALL 46 CHECKS PASSED
══ connector-newforce-mw.js ══   57 passed, 0 failed
══ connector-bhaiyaa.js ══       21 passed, 0 failed

all suites passed
```

Exit code is 0 on success, 1 if any suite fails. Nothing here touches the network or the database —
the connector suites cover the mapping, the form encoding, the reply parsing and the JWT signing,
which is where an integration goes wrong silently.

Individual suites:

```
node test/connector-newforce-mw.js     # the CRM push
node test/connector-bhaiyaa.js         # the store poll
```

---

## 5. Testing the client flow (Account Manager → NewForce CRM)

**Switch persona:** top-right user menu → **Switch User** → **Account Manager**.

1. **Client & Contracts → Create Client.**
2. Fill the form. All of full name, work email, phone + dial code, company and country are
   required — the CRM rejects a lead missing any of them, so the form enforces the same rules
   rather than spending a round trip to find out.
3. **Submit.** You should land on a success screen showing two ids: our **Client ID** (`CLI-000123`)
   and the CRM's **Source Record ID** (a number like `27801`).
4. **Client & Contracts → All Clients** — the record is there, status Pending.
5. Open it → **Logs** tab → pick a status, add a comment, **Save**. The status is pushed to the CRM
   and the response carries a `statusSync` block.

**Expected failures, both worth testing:**

| Try this | Expect |
|---|---|
| Submit the same email twice | HTTP 409, the message lands on the Work email field, **and no client record is created** |
| Stop the backend, then submit | The form says the backend is unreachable; nothing is lost |

### Verifying in the CRM

`https://nfadminstaging.maaserp.com` → **Change Entity → Open Dhi Private Limited** (leads carry
`ENTITY_ID=1`, and under any other entity the listing correctly shows nothing) → **Users → All
Users** → set Status and press **Search**. Filter **Lead Source = `Executive Layer`** to see only
records this app created.

Faster: `https://nfadminstaging.maaserp.com/edit-user/<source record id>` opens the record directly
and is not entity-scoped.

---

## 6. Testing the store flow (Ops Manager → Bhaiyaa)

**Switch persona:** user menu → **Switch User** → **Ops Manager**. Land on **Dashboard → Store
Operations**.

1. **Press "Sync from Bhaiyaa" once.** First run reports
   *"Bhaiyaa has N stores already. Sign-ups from now on will appear here."* — it records where the
   platform stands and watches from there, rather than importing a page of history.
2. **Complete the signup wizard** at
   `https://bhaiyaastaging.maaserp.com/Dhihyperlocal_Seller_Web_Portal/sign-up`, including the store
   step. A signup that stops at the account step creates no store, so nothing will appear.
   *Mobile OTP:* read it from `TEMP_RETAILER_SIGNUP_OTP` (columns `OTP`, `code`, `mobile`,
   `Created_AT`; valid 5 minutes), or use the static OTP if staging has `STATICOTP` set.
3. **Press Sync again.** The store appears at the **top** of the board, tagged with Bhaiyaa's own
   id, sitting on **KYC**.
4. **Run KYC** — from the row's action button, or the record's **Logs** tab. Enter a 12-digit
   Aadhaar number, run the check, watch the four steps.
5. The run advances to **Live**, the store's KYC badge reads Verified, and the trail records who
   did it.

**Note:** the KYC checks are a local animation. Nothing is sent to UIDAI and no external identity
check happens — the record simply moves to Verified.

---

## 7. Testing the backend directly

Useful when a UI problem needs isolating from an API problem.

```
# is it up?
curl http://localhost:4000/health

# create a client (goes to whatever CLIENT_SOURCE points at)
curl -X POST http://localhost:4000/adt/submit -H "Content-Type: application/json" -d "{\"full_name\":\"Test Person\",\"work_email\":\"test-1@example.com\",\"phone_country_code\":\"+91\",\"phone_number\":\"9999900001\",\"company_name\":\"TEST - ignore\",\"country_hiring_in\":\"India\"}"

# change its status — pushes to the CRM
curl -X PATCH http://localhost:4000/employees/CLI-000001/status -H "Content-Type: application/json" -d "{\"status\":\"Active\",\"comment\":\"testing\",\"user\":\"Tester\"}"

# poll Bhaiyaa for new stores
curl -X POST http://localhost:4000/stores/poll

# run KYC on a store
curl -X POST http://localhost:4000/stores/STR-000001/kyc -H "Content-Type: application/json" -d "{\"user\":\"Ops Manager\",\"aadhaar_masked\":\"XXXX XXXX 3444\"}"

# what is in the store?
curl "http://localhost:4000/employees?pageSize=50"
curl "http://localhost:4000/stores?pageSize=50"
```

Reading the responses:

- `POST /adt/submit` → **201** created and mirrored, **202** created here but not accepted by the
  CRM (`mirrorError` says why, and Retry is available in All Clients), **409** refused before
  anything was created — a duplicate.
- `PATCH /employees/:code/status` → `statusSync: {ok, changed, error}`. `null` means there was
  nowhere to send it (a mock-sourced client), which is not a failure.
- `POST /stores/poll` → `baseline` on the first ever call, then `ingested` with a count, or `idle`.

---

## 8. Resetting

```
# wipe all local records and start clean (the schema rebuilds on next start)
rm -rf backend/data
```

That also clears the Bhaiyaa sync cursor, so the next Sync re-baselines rather than importing
history.

To re-import stores you have already seen, rewind the cursor instead of wiping everything:

```
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('backend/data/employees.db');db.prepare(\"UPDATE sync_state SET value='3670' WHERE key='bhaiyaa_last_seen_store_id'\").run();db.close()"
```

Ingestion is idempotent — a store already filed is skipped rather than duplicated, so rewinding too
far is harmless.

---

## 9. When something does not work

| Symptom | Cause |
|---|---|
| `Cannot find module 'node:sqlite'` | Node older than 22, or 22.x needing `--experimental-sqlite` |
| Backend exits saying the database predates the schema | An old `backend/data`. Delete it, or run `node backend/migrate-client-ids.js` to keep the records |
| `EADDRINUSE` | 4000, 4100 or 5500 already taken — usually a previous run still going |
| Form shows "Not connected" | The backend is not running. `node --env-file=backend/.env backend/dev.js` |
| `CONFIG ERROR` at startup | `CLIENT_SOURCE=newforce_mw` with a key missing from `.env` |
| Client submits but never reaches the CRM | Check the startup banner names `newforce_mw`, not `adt_solution` |
| Sync says the endpoint is not deployed | The middleware answering you predates `updateClientStatus` — redeploy the middleware branch |
| Nothing appears after a Bhaiyaa signup | The wizard's store step was not completed; a retailer account alone creates no store |
| Leads missing from the CRM console | Wrong entity selected — they live under **Open Dhi Private Limited** |

---

## 10. What is real and what is not

Worth knowing before demonstrating this to anyone:

**Real.** Client creation against the NewForce CRM, the duplicate check, client status push, the
Bhaiyaa store sync, and every id in both directions. These are live HTTP calls to staging systems
and the records they create are real records.

**Not real.** The KYC checks (a local animation — nothing reaches UIDAI). The twelve seeded store
openings on the Ops board, which are fixtures and do not survive a refresh. The mock NewForce site
on :4100, which exists so the demo runs with no network at all.
