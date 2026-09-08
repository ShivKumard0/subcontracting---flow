-- SQLite-dialect schema for the Direct Employee storage backend (backend/server.js).
-- MySQL-dialect twin: sql/schema_direct_employees.sql (repo root). Same design, different
-- DDL syntax — keep both in sync when the design changes.
--
-- Column set mirrors the REAL NewForce Solutions intake form, which captures a lead/enquiry:
-- Full name, Work email, Phone (country code + number), Company name, Country hiring in,
-- What are you looking for, How did you hear about us. Note what that form does NOT ask
-- for: job title, department, branch, join date. Those are completed by HR after ingest,
-- which is exactly why an ADT-sourced record lands in 'Pending' rather than 'Active'.
--
-- Foreign keys are off by default per-connection in SQLite — server.js turns them on with
-- `PRAGMA foreign_keys = ON` right after opening the database.

-- Every system a client can arrive from, as data. This replaced a
-- `CHECK (source IN ('manual','adt_solution'))` on direct_employees: that constraint had to be
-- rewritten, and the table rebuilt, for every new connector — which made "connect another
-- system" a schema migration rather than a configuration change. Adding SAP is now one INSERT.
CREATE TABLE IF NOT EXISTS source_systems (
  id           TEXT PRIMARY KEY,       -- 'adt_solution'
  label        TEXT NOT NULL,          -- 'NewForce Solutions' — what the UI prints
  console_url  TEXT,                   -- deep link out; null for systems with no console
  is_active    INTEGER NOT NULL DEFAULT 1
);
-- 'manual' is a source_systems row like any other so the FK holds for hand-created clients.
-- It has no console_url because there is no external system to open.
-- 'adt_solution' is the mock site (backend/mock-adt-server.js); 'newforce_mw' is the real CRM
-- reached through the NewForce middleware. Two rows rather than one repointed row, because a
-- client's source records where it actually went — repointing the backend must not rewrite the
-- history of clients that were pushed to the mock.
INSERT OR IGNORE INTO source_systems (id, label, console_url) VALUES
  ('manual',       'Manual',             NULL),
  ('adt_solution', 'NewForce Solutions', 'https://admin.newforceltd.com/login/authentication'),
  ('newforce_mw',  'NewForce Solutions', 'https://admin.newforceltd.com/login/authentication');

CREATE TABLE IF NOT EXISTS direct_employees (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,

  -- A client carries exactly two ids, and they are two because they are minted by two different
  -- systems. Anything beyond these would be an id nobody outside this table can resolve.
  --
  --   employee_code    OUR id for the client. Minted server-side inside the insert transaction
  --                    so it is unique across every browser and operator, not per-session.
  --                    Surfaced in the UI as "Client ID".
  --   source_record_id THEIR id — the id the source system gave this same client in its own
  --                    store ('ADT-SUB-0001' from NewForce Solutions). Surfaced as "Source
  --                    Record ID". Also what makes ingest idempotent: replaying a submission
  --                    resolves to the row it already created instead of duplicating it.
  --
  -- The two never match, and are not meant to: they are two systems' names for one client.
  -- (A third id, reference_id, used to sit here — 'ADT-REF-0001', minted by US but displayed as
  -- though it were the source system's. It was the same id as employee_code wearing a different
  -- prefix, so it is gone. Databases created before this still carry the column; it is nullable,
  -- nothing writes it, and nothing reads it.)
  -- 'CLI-000010', for every client, however it arrived. One prefix and one sequence: the id is
  -- OUR name for the record, so letting it vary by origin ('ADTEMP-' for NewForce, 'EMP001' for
  -- manual, as it once did) put provenance in the one field that must not carry it. Where a
  -- client came from is the `source` column's job, and it can change; this id never does.
  employee_code       TEXT    NOT NULL UNIQUE,
  -- THEIR id, null until the source system has confirmed it. Null is a real, visible state, not
  -- an absence: we mint our id first and mirror the record out second, so between those two
  -- steps the row legitimately has no source record id (see mirror_state).
  source_record_id    TEXT,
  -- Which system the client came from; FK into source_systems rather than a CHECK list, so
  -- connecting SAP is an INSERT and not a schema migration.
  source              TEXT    NOT NULL DEFAULT 'manual' REFERENCES source_systems(id),

  -- Where the outbound mirror got to. 'not_required' for manually created clients that were
  -- never meant to leave; 'pending'/'failed' are retryable and surfaced in the UI so a failed
  -- push can never sit silently; 'mirrored' means source_record_id is populated and agreed.
  mirror_state        TEXT    NOT NULL DEFAULT 'not_required'
                        CHECK (mirror_state IN ('not_required','pending','failed','mirrored')),
  mirror_error        TEXT,
  mirror_attempts     INTEGER NOT NULL DEFAULT 0,
  mirror_last_try_at  TEXT,

  -- ---- Fields the NewForce Solutions intake form actually submits ----
  name                TEXT    NOT NULL,          -- "Full name"
  email               TEXT,                      -- "Work email"
  phone_country_code  TEXT,                      -- "Phone number" — the country dropdown
  contact             TEXT,                      -- "Phone number" — the number itself
  company_name        TEXT,                      -- "Company name"
  country             TEXT,                      -- "Country hiring in"
  looking_for         TEXT,                      -- "What are you looking for?"
  heard_about_us      TEXT,                      -- "How did you hear about us?"

  -- ---- Not on the form; filled in by HR before the record can go Active ----
  department          TEXT,
  branch              TEXT,
  job_title           TEXT,
  join_date           TEXT,
  description         TEXT,

  status              TEXT    NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Active','Inactive')),

  -- The submission exactly as received, so the UI's "Form Details" tab can show every field
  -- the form sent — including any the columns above do not model yet.
  raw_source_payload  TEXT,

  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Backs the drawer's Logs tab. occurred_at is a single ISO-8601 UTC instant rather than the
-- separate display-formatted date/time columns this table used to carry: those were locale
-- strings ('28 Jul 2026' / '04:24:17 PM') that could not be inserted into the MySQL twin's
-- DATE/TIME columns and disagreed with created_at's timezone. Formatting is the UI's job.
CREATE TABLE IF NOT EXISTS direct_employee_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL,
  occurred_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  actor_user   TEXT    NOT NULL,   -- 'Admin', 'NewForce Solutions Sync'
  status_label TEXT    NOT NULL,   -- 'Created' | 'Pending' | 'Active' | 'Inactive' | 'Updated'
  action_note  TEXT    NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES direct_employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS direct_employee_workflow (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL,
  occurred_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  title        TEXT    NOT NULL,
  actor_user   TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES direct_employees(id) ON DELETE CASCADE
);

-- SQLite does not create indexes for foreign keys (InnoDB does), and every drawer open runs
-- "logs for this employee, newest first".
CREATE INDEX IF NOT EXISTS idx_de_logs_employee     ON direct_employee_logs (employee_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_de_workflow_employee ON direct_employee_workflow (employee_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_de_status            ON direct_employees (status);
CREATE INDEX IF NOT EXISTS idx_de_source_record     ON direct_employees (source_record_id);
-- Scoped per source, not global. Two systems can legitimately both mint '12345' for different
-- clients; a global UNIQUE on source_record_id made the second connector's first collision an
-- insert failure. NULLs compare distinct in SQLite, so any number of rows may sit mirror-pending
-- with no source record id at all.
CREATE UNIQUE INDEX IF NOT EXISTS uq_de_source_record
  ON direct_employees (source, source_record_id);
-- "What still needs mirroring out" — the retry sweep's query.
CREATE INDEX IF NOT EXISTS idx_de_mirror_state      ON direct_employees (mirror_state);

-- Server-side id minting. Kept in the database (not a process variable) so restarting the
-- backend never re-issues an id that is already on a record.
CREATE TABLE IF NOT EXISTS id_sequences (
  name        TEXT    PRIMARY KEY,
  next_value  INTEGER NOT NULL
);
-- One sequence for every client, whatever system it came from. There were two ('adt_employee',
-- 'manual_employee'), which is what forced two prefixes to keep the ids apart — and the prefix
-- was then telling you the origin. One counter means one prefix can serve everything.
INSERT OR IGNORE INTO id_sequences (name, next_value) VALUES ('client', 1);

-- The ADT polling cursor. Previously this lived in each browser's localStorage, so every
-- operator kept a private idea of "what have we already seen" and the same submission could
-- be ingested once per browser. One row here makes it a property of the system.
CREATE TABLE IF NOT EXISTS sync_state (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ============================================================================ stores --
-- Bhaiyaa stores. A separate table from direct_employees rather than another `source` on it:
-- a store and a client answer different questions and share almost no columns — turnover band,
-- plan, GST position, storefront handle and credit terms have no meaning for a client, and
-- department/job title/join date have none for a store. Forcing both into one table would mean
-- a row where half the columns are structurally NULL, which is how a schema stops describing
-- anything.
--
-- What IS shared is the id pattern, deliberately: our code, their code, and the source system
-- that issued the second one. Every integrated platform gets the same three, so the listing's
-- columns hold for any of them.
CREATE TABLE IF NOT EXISTS stores (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,

  -- OUR id, minted here inside the insert transaction. 'STR-000001'.
  store_code        TEXT    NOT NULL UNIQUE,
  -- THEIR id. Null until Bhaiyaa has confirmed the store, exactly like source_record_id on
  -- direct_employees — we mint first and mirror second, so the gap between is a real state.
  source_record_id  TEXT,
  source            TEXT    NOT NULL DEFAULT 'bhaiyaa' REFERENCES source_systems(id),
  mirror_state      TEXT    NOT NULL DEFAULT 'pending'
                      CHECK (mirror_state IN ('not_required','pending','failed','mirrored')),
  mirror_error      TEXT,

  -- Seller or buyer. Not a free string: it decides what was provisioned and what the credit
  -- columns mean, so an unknown value here would make the rest of the row unreadable.
  role              TEXT    NOT NULL CHECK (role IN ('seller','buyer')),

  store_name        TEXT    NOT NULL,
  -- Set when the merchant left the name blank and we opened the store as "<first name>'s Store".
  -- Kept because "did they choose this name" is a different fact from what the name is.
  auto_named        INTEGER NOT NULL DEFAULT 0,
  handle            TEXT,               -- storefront slug (seller) or ledger slug (buyer)
  category          TEXT,
  store_type        TEXT    NOT NULL,   -- the turnover band, verbatim as offered

  -- Derived from store_type at creation time, stored rather than recomputed: the bands can be
  -- repriced, and a store's plan must not silently change under it when they are.
  plan              TEXT,
  gst_position      TEXT,
  credit_line       TEXT,
  payment_terms     TEXT,

  first_name        TEXT    NOT NULL,
  last_name         TEXT,
  email             TEXT    NOT NULL,
  phone_country_code TEXT,
  mobile            TEXT,
  mobile_verified   INTEGER NOT NULL DEFAULT 0,

  -- KYC. The full Aadhaar number is NEVER sent to this server and has no column here — it is
  -- needed to verify an owner and for nothing afterwards. What is kept is the masked form, who
  -- verified it and when, which is everything an auditor asking "was this owner checked" needs.
  aadhaar_masked    TEXT,
  kyc_status        TEXT    NOT NULL DEFAULT 'Pending'
                      CHECK (kyc_status IN ('Pending','Verified','Failed')),
  kyc_verified_by   TEXT,
  kyc_verified_at   TEXT,

  status            TEXT    NOT NULL DEFAULT 'Pending'
                      CHECK (status IN ('Pending','Active','Inactive')),
  raw_signup        TEXT,               -- the signup exactly as submitted, for provenance
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Consent is evidence, so it is rows and not a boolean column. One row per document accepted,
-- carrying the moment it was accepted — a flag cannot answer "when did they agree to the MSA",
-- which is the only question ever asked of an acceptance record.
CREATE TABLE IF NOT EXISTS store_consents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id     INTEGER NOT NULL,
  document     TEXT    NOT NULL,   -- 'Terms & Conditions' | 'MSA'
  accepted_at  TEXT    NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- The journey trail: what the run did, step by step, kept so the drawer's Workflow tab reads
-- from the record rather than replaying a client-side definition.
CREATE TABLE IF NOT EXISTS store_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id     INTEGER NOT NULL,
  occurred_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  title        TEXT    NOT NULL,
  actor_user   TEXT    NOT NULL,   -- 'Merchant' | 'KYC Agent' | 'Store Agent'
  description  TEXT    NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stores_status        ON stores (status);
CREATE INDEX IF NOT EXISTS idx_stores_role          ON stores (role);
CREATE INDEX IF NOT EXISTS idx_stores_mirror_state  ON stores (mirror_state);
CREATE INDEX IF NOT EXISTS idx_store_consents_store ON store_consents (store_id, id);
CREATE INDEX IF NOT EXISTS idx_store_events_store   ON store_events (store_id, id DESC);
-- Per source, matching the clients rule: two platforms may legitimately mint the same ref.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stores_source_record
  ON stores (source, source_record_id);

-- Bhaiyaa as a source system, so the FK above holds and the UI can print a label for it.
INSERT OR IGNORE INTO source_systems (id, label, console_url) VALUES
  ('bhaiyaa', 'Bhaiyaa', NULL);

-- Our store id counter, and Bhaiyaa's own. Two counters because two systems mint two ids; a
-- shared one would make them agree, and that they never agree is the point.
INSERT OR IGNORE INTO id_sequences (name, next_value) VALUES ('store', 1);
INSERT OR IGNORE INTO id_sequences (name, next_value) VALUES ('bhaiyaa_store_ref', 1);
