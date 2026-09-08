# Executive Layer — Direct Employee master data backend

Storage and integration layer behind the Direct Employee screens. Dependency-free: Node's
built-in `http` and `node:sqlite` only, no `npm install`.

Two processes live here:

| File | Port | What it is |
|---|---|---|
| `server.js` | 4000 | The Executive Layer backend — master data, audit logs, ADT ingestion |
| `mock-adt-server.js` | 4100 | A stand-in for the ADT Solution website, with the real intake form |

## Run the demo

```
node dev.js          # both services, one command  (or: npm run dev)
npx http-server -p 5500    # the frontend, from the repo root, in another terminal
```

Then open <http://localhost:5500/index.html>.

Data persists in `data/employees.db`, created on first run from `schema.sql`. That file is
gitignored — it is runtime data, not source. Delete `data/` to start clean.

## The demo flow

There are two ways in. Both end at the same master data record, because both go through ADT.

### A — from Configure (the connected-systems story)

1. **Configure → Systems.** ADT Solution, Bhaiyaa and NFAdmin show as **Connected** alongside
   SAP and Infor. ADT Solution is the one that is genuinely wired up rather than described.
2. **Configure → Data Foundation.** One card describes the object this flow fills in: **Client**.
3. **AI Execution Layer → Create Contract.** It renders ADT Solution's intake form — fetched from
   ADT's own `/api/employee-intake/schema`, not a hardcoded copy.
4. **Submit.** The Executive Layer posts it to ADT Solution, ADT assigns its own record id, and
   the Executive Layer ingests it back. Success shows the two ids the client now has — our
   **Client ID** `CLI-####` and ADT's **Source Record ID** `ADT-SUB-####` — plus every submitted
   field.
5. **Open client record** jumps to it in Client.

### B — from AI Executive (the live-sync story)

1. **AI Executive → Hire to Retire → Create Employee.** Press **Listen for ADT Solution
   Submissions**.
2. **Fill in the form** at <http://localhost:4100>.
3. The Executive Layer polls, detects it, mints the identifiers, creates the record and opens it.

### Either way, the record

- Arrives as **Pending**. Not decoration — the intake form does not capture department, job
  title, branch or joining date, so the record genuinely is incomplete until HR fills them in.
- **Form Details** tab shows the submission exactly as ADT sent it.
- **Logs** tab carries the field-level audit trail plus the status form: pick a status, add a
  comment, Save. The row update and the log entry are one transaction, so the badge and the
  timeline can never disagree.
- **Workflow** tab carries the process view — Intake Form Submitted → Record Ingested →
  Pending HR Review → Details Completed → Status changed to Active — written from the same
  places as the logs.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness; unauthenticated |
| `GET` | `/employees` | List. `?status=&q=&page=&pageSize=` |
| `GET` | `/employees/:code` | One record plus its logs and workflow entries |
| `POST` | `/employees` | Manual creation |
| `PATCH` | `/employees/:code` | Edit the fields the ADT form does not capture |
| `PATCH` | `/employees/:code/status` | Status change + audit entry, transactionally |
| `POST` | `/employees/:code/logs` | Free-standing comment, no status change |
| `POST` | `/employees/:code/workflow` | Workflow tab entry |
| `GET` | `/adt/status` | Sync cursor and ingest count |
| `GET` | `/adt/form-schema` | ADT's intake-form field definition, proxied |
| `POST` | `/adt/poll` | Poll ADT once; ingest anything new |
| `POST` | `/adt/submit` | Submit the intake form *to ADT*, then ingest what ADT returns |

`POST /adt/poll` returns `status: 'idle' | 'ingested' | 'duplicate'`.

## Why identity, credentials and the cursor live here

The browser used to own all three, and could not own any of them correctly:

- **Identity.** The Client ID came from a counter in `localStorage`, so two operators with the
  page open both issued the same code to different clients. It is now minted inside the insert
  transaction, from `id_sequences`.
- **The ADT credential.** It shipped in client-side JS because the browser called ADT directly.
  It is now an env var in this process; the browser talks only to us.
- **The sync cursor.** "What have we already ingested" was per-browser, so one submission could
  be ingested once per browser. It is one row in `sync_state`.

Ingest is idempotent on `source_record_id` — ADT's own id for the submission — so a retry,
restart or cursor reset resolves to the existing record instead of duplicating it.

A client therefore carries two ids and only two: `employee_code` is **our** name for it (the
Client ID), `source_record_id` is the **source system's** name for the same client (the Source
Record ID). They differ because two different systems minted them, and neither can be derived
from the other. A third id, `reference_id` (`ADT-REF-####`), used to sit between them — we minted
it but presented it as ADT's, which made it the Client ID in a different prefix. It is gone.

## Config

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `ADT_BASE_URL` | `http://localhost:4100` | Point at real ADT staging when available |
| `ADT_API_KEY` | `demo-adt-staging-key` | |
| `ADT_LATEST_PATH` | `/api/employee-intake/latest` | |
| `EXEC_API_TOKEN` | *(unset)* | When set, all endpoints except `/health` require `Bearer` |
| `ALLOWED_ORIGINS` | `*` | Comma-separated allowlist |

**Auth is off by default** so the demo runs with no setup. These records hold names, emails and
phone numbers, and Node binds `0.0.0.0` — set `EXEC_API_TOKEN` and `ALLOWED_ORIGINS` before
running this anywhere but localhost.

## Moving to the real ADT API

The field mapping is in one function, `mapAdtSubmission()` in `server.js`. Point `ADT_BASE_URL`
and `ADT_API_KEY` at the real host and reconcile the names there; nothing else should need to
change. `mock-adt-server.js` can then be deleted.

## Why Node rather than the product's CodeIgniter 3 / PHP stack

CI3 was considered first since it matches the real product, and rejected as heavier than this
layer needs — it would mean vendoring a PHP framework and running PHP + MySQL. Node's built-in
`http` and `node:sqlite` cover everything with zero install. Note that `node:sqlite` is still
marked experimental by Node and requires Node 22+; fine here, worth knowing before depending on
it elsewhere.

`sql/schema_direct_employees.sql` (repo root) is the MySQL-dialect twin of `schema.sql`, kept
for whenever the real CI3/MySQL backend is built. Keep the two in sync.
