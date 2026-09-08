-- Reference schema for the real production backend (CodeIgniter 3 / MySQL, per the actual
-- product's stack). MySQL-dialect twin of backend/schema.sql, which the standalone Node demo
-- backend runs against. Same design — kept as two files because the engines need different
-- DDL, not because the design differs. Keep both in sync.
--
-- Column set mirrors the REAL NewForce Solutions intake form, which captures a lead/enquiry:
-- Full name, Work email, Phone (country code + number), Company name, Country hiring in,
-- What are you looking for, How did you hear about us. That form does NOT ask for job title,
-- department, branch, or join date — HR completes those after ingest, which is why an
-- ADT-sourced record lands in 'Pending' rather than 'Active'.

-- Every system a client can arrive from, as data. This replaced an inline value list on
-- direct_employees.source, which had to be rewritten — and the table rebuilt — for every new
-- connector, making "connect another system" a schema migration rather than a configuration
-- change. Adding SAP is now one INSERT.
CREATE TABLE source_systems (
  id           VARCHAR(30)  PRIMARY KEY,   -- 'adt_solution'
  label        VARCHAR(100) NOT NULL,      -- 'NewForce Solutions' — what the UI prints
  console_url  VARCHAR(255) NULL,          -- deep link out; null for systems with no console
  is_active    TINYINT(1)   NOT NULL DEFAULT 1
);
-- 'manual' is a source_systems row like any other so the FK holds for hand-created clients.
-- It has no console_url because there is no external system to open.
INSERT IGNORE INTO source_systems (id, label, console_url) VALUES
  ('manual',       'Manual',             NULL),
  ('adt_solution', 'NewForce Solutions', 'https://admin.newforceltd.com/login/authentication');

CREATE TABLE direct_employees (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

  -- A client carries exactly two ids, and they are two because two different systems minted
  -- them. Anything beyond these would be an id nobody outside this table can resolve.
  --
  --   employee_code    OUR id for the client, minted server-side inside the insert transaction
  --                    so it is unique across every operator and browser session. Surfaced in
  --                    the UI as "Client ID".
  --   source_record_id THEIR id — the id the source system gave this same client in its own
  --                    store ('ADT-SUB-0001' from NewForce Solutions). Surfaced as "Source
  --                    Record ID", and the idempotency key that makes replaying a submission
  --                    resolve to the row it already created.
  --
  -- The two never match, and are not meant to: they are two systems' names for one client.
  -- (A third id, reference_id — 'ADT-REF-0001' — used to sit here. We minted it but displayed
  -- it as though it were the source system's, which made it employee_code in a different prefix.
  -- Dropped. Pre-existing MySQL installs can leave the column in place; nothing reads or writes
  -- it, but it must be nullable.)
  -- 'CLI-000010', for every client, however it arrived. One prefix and one sequence: the id is
  -- OUR name for the record, so letting it vary by origin ('ADTEMP-' for NewForce, 'EMP001' for
  -- manual, as it once did) put provenance in the one field that must not carry it. Where a
  -- client came from is the `source` column's job, and it can change; this id never does.
  employee_code       VARCHAR(30)  NOT NULL UNIQUE,
  -- THEIR id, null until the source system has confirmed it. Null is a real, visible state, not
  -- an absence: we mint our id first and mirror the record out second, so between those two
  -- steps the row legitimately has no source record id (see mirror_state).
  source_record_id    VARCHAR(64)  NULL,

  -- Which system the client came from; FK into source_systems rather than an inline value list,
  -- so connecting SAP is an INSERT and not a schema migration.
  source              VARCHAR(30)  NOT NULL DEFAULT 'manual',

  -- Where the outbound mirror got to. 'not_required' for manually created clients that were
  -- never meant to leave; 'pending'/'failed' are retryable and surfaced in the UI so a failed
  -- push can never sit silently; 'mirrored' means source_record_id is populated and agreed.
  mirror_state        VARCHAR(20)  NOT NULL DEFAULT 'not_required',
  mirror_error        VARCHAR(500) NULL,
  mirror_attempts     INT          NOT NULL DEFAULT 0,
  mirror_last_try_at  DATETIME     NULL,

  -- ---- Fields the NewForce Solutions intake form actually submits ----
  name                VARCHAR(150) NOT NULL,        -- "Full name"
  email               VARCHAR(150) NULL,            -- "Work email"
  phone_country_code  VARCHAR(10)  NULL,            -- "Phone number" — the country dropdown
  contact             VARCHAR(30)  NULL,            -- "Phone number" — the number itself
  company_name        VARCHAR(150) NULL,            -- "Company name"
  country             VARCHAR(100) NULL,            -- "Country hiring in"
  looking_for         VARCHAR(150) NULL,            -- "What are you looking for?"
  heard_about_us      VARCHAR(150) NULL,            -- "How did you hear about us?"

  -- ---- Not on the form; filled in by HR before the record can go Active ----
  department          VARCHAR(100) NULL,
  branch              VARCHAR(100) NULL,
  job_title           VARCHAR(150) NULL,
  join_date           DATE         NULL,
  description         VARCHAR(255) NULL,

  status              ENUM('Pending','Active','Inactive') NOT NULL DEFAULT 'Pending',

  -- The submission exactly as received, so the UI's "Form Details" tab can show every field
  -- the form sent — including any the columns above do not model yet.
  raw_source_payload  JSON         NULL,

  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_de_status (status),
  INDEX idx_de_source_record (source_record_id),
  INDEX idx_de_mirror_state (mirror_state),
  -- Scoped per source, not global. Two systems can legitimately both mint '12345' for different
  -- clients; a global UNIQUE on source_record_id made the second connector's first collision an
  -- insert failure. MySQL treats NULLs as distinct in a UNIQUE index, so any number of rows may
  -- sit mirror-pending with no source record id at all.
  UNIQUE KEY uq_de_source_record (source, source_record_id),
  FOREIGN KEY (source) REFERENCES source_systems(id)
);

-- Backs the drawer's Logs tab. occurred_at is one UTC instant rather than the separate
-- date/time columns this table used to carry — the Node backend was writing locale display
-- strings ('28 Jul 2026' / '04:24:17 PM') into what this file declared as DATE/TIME, which
-- MySQL would have rejected. Formatting is the UI's job.
CREATE TABLE direct_employee_logs (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id  INT UNSIGNED NOT NULL,
  occurred_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user   VARCHAR(100) NOT NULL,   -- 'Admin', 'NewForce Solutions Sync'
  status_label VARCHAR(50)  NOT NULL,   -- 'Created' | 'Pending' | 'Active' | 'Inactive' | 'Updated'
  action_note  VARCHAR(255) NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES direct_employees(id) ON DELETE CASCADE,
  INDEX idx_de_logs_employee (employee_id, id DESC)
);

CREATE TABLE direct_employee_workflow (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id  INT UNSIGNED NOT NULL,
  occurred_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title        VARCHAR(150) NOT NULL,
  actor_user   VARCHAR(100) NOT NULL,
  description  VARCHAR(500) NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES direct_employees(id) ON DELETE CASCADE,
  INDEX idx_de_workflow_employee (employee_id, id DESC)
);

-- Server-side id minting, held in the database rather than in process memory so a restart
-- never re-issues an id that is already on a record.
CREATE TABLE id_sequences (
  name        VARCHAR(50)  PRIMARY KEY,
  next_value  INT UNSIGNED NOT NULL
);
-- One sequence for every client, whatever system it came from. There were two ('adt_employee',
-- 'manual_employee'), which is what forced two prefixes to keep the ids apart — and the prefix
-- was then telling you the origin. One counter means one prefix can serve everything.
INSERT IGNORE INTO id_sequences (name, next_value) VALUES ('client', 1);

-- The ADT polling cursor. Previously per-browser localStorage, so each operator kept a private
-- idea of "what have we already seen" and one submission could be ingested once per browser.
CREATE TABLE sync_state (
  `key`      VARCHAR(50) PRIMARY KEY,
  value      TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================================ stores --
-- MySQL twin of the `stores` block in backend/schema.sql. Same design; see that file for the
-- reasoning behind each decision (why stores are their own table rather than a `source` on
-- direct_employees, why consent is rows, and why the full Aadhaar number has no column here).
CREATE TABLE stores (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  store_code         VARCHAR(20)  NOT NULL UNIQUE,          -- ours:  'STR-000001'
  source_record_id   VARCHAR(64)  NULL,                     -- theirs: 'BHA-STR-0001'
  source             VARCHAR(50)  NOT NULL DEFAULT 'bhaiyaa',
  mirror_state       ENUM('not_required','pending','failed','mirrored') NOT NULL DEFAULT 'pending',
  mirror_error       TEXT         NULL,
  role               ENUM('seller','buyer') NOT NULL,
  store_name         VARCHAR(200) NOT NULL,
  auto_named         TINYINT(1)   NOT NULL DEFAULT 0,
  handle             VARCHAR(64)  NULL,
  category           VARCHAR(100) NULL,
  store_type         VARCHAR(120) NOT NULL,
  plan               VARCHAR(50)  NULL,
  gst_position       VARCHAR(80)  NULL,
  credit_line        VARCHAR(80)  NULL,
  payment_terms      VARCHAR(50)  NULL,
  first_name         VARCHAR(100) NOT NULL,
  last_name          VARCHAR(100) NULL,
  email              VARCHAR(180) NOT NULL,
  phone_country_code VARCHAR(8)   NULL,
  mobile             VARCHAR(20)  NULL,
  mobile_verified    TINYINT(1)   NOT NULL DEFAULT 0,
  -- Masked only: 'XXXX XXXX 9012'. There is deliberately no column for the full number.
  aadhaar_masked     VARCHAR(20)  NULL,
  kyc_status         ENUM('Pending','Verified','Failed') NOT NULL DEFAULT 'Pending',
  kyc_verified_by    VARCHAR(80)  NULL,
  kyc_verified_at    DATETIME     NULL,
  status             ENUM('Pending','Active','Inactive') NOT NULL DEFAULT 'Pending',
  raw_signup         JSON         NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (source) REFERENCES source_systems(id),
  -- Per source, not global: two platforms may legitimately mint the same reference.
  UNIQUE KEY uq_stores_source_record (source, source_record_id),
  INDEX idx_stores_status (status),
  INDEX idx_stores_role (role),
  INDEX idx_stores_mirror_state (mirror_state)
);

CREATE TABLE store_consents (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  store_id     INT UNSIGNED NOT NULL,
  document     VARCHAR(100) NOT NULL,
  accepted_at  DATETIME     NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  INDEX idx_store_consents_store (store_id, id)
);

CREATE TABLE store_events (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  store_id     INT UNSIGNED NOT NULL,
  occurred_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title        VARCHAR(200) NOT NULL,
  actor_user   VARCHAR(80)  NOT NULL,
  description  TEXT         NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  INDEX idx_store_events_store (store_id, id DESC)
);

INSERT IGNORE INTO source_systems (id, label, console_url) VALUES ('bhaiyaa', 'Bhaiyaa', NULL);
-- Two counters because two systems mint two ids; sharing one would make them agree.
INSERT IGNORE INTO id_sequences (name, next_value) VALUES ('store', 1);
INSERT IGNORE INTO id_sequences (name, next_value) VALUES ('bhaiyaa_store_ref', 1);
