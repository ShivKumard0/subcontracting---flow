// One-time migration to the universal Client ID.
//
//   node backend/migrate-client-ids.js
//
// Brings a database created before the change up to backend/schema.sql. Four things move:
//
//   1. employee_code becomes 'CLI-000001' for every client, whatever system it came from.
//      'ADTEMP-####' said NewForce and 'EMP###' said hand-typed, so the id — the one field
//      that is purely ours — was reporting provenance. That is the `source` column's job.
//   2. The two id sequences ('adt_employee', 'manual_employee') collapse into one ('client'),
//      because two counters were what forced two prefixes to keep ids apart.
//   3. source stops being a CHECK list and becomes a FK into source_systems, so connecting
//      another system is an INSERT rather than a table rebuild.
//   4. source_record_id loses its global UNIQUE for a per-source one, and gains the mirror_*
//      columns that let a client exist here before the source system has confirmed it.
//
// SQLite cannot drop a CHECK or a column-level UNIQUE in place, so 3 and 4 need the table
// rebuilt. Row ids are carried across unchanged, which is what keeps the logs and workflow
// foreign keys pointing at the right clients.
//
// Safe to run twice: it detects an already-migrated database and stops. The database is copied
// to employees.db.bak-<timestamp> before anything is written.

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.argv[2] || path.join(__dirname, 'data', 'employees.db');
const PREFIX = 'CLI-';
const DIGITS = 6;
const code = (n) => PREFIX + String(n).padStart(DIGITS, '0');

if (!fs.existsSync(DB_PATH)) {
  console.error('No database at ' + DB_PATH + ' — nothing to migrate.');
  console.error('A fresh database is created from schema.sql on first run and needs no migration.');
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
const cols = db.prepare('PRAGMA table_info(direct_employees)').all().map((c) => c.name);
if (cols.includes('mirror_state')) {
  console.log('Already migrated (mirror_state exists). Nothing to do.');
  process.exit(0);
}

const backup = DB_PATH + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
fs.copyFileSync(DB_PATH, backup);
console.log('Backup written to ' + path.basename(backup));

const before = db.prepare('SELECT id, employee_code, source FROM direct_employees ORDER BY id').all();
console.log('Migrating ' + before.length + ' client record(s).');

db.exec('PRAGMA foreign_keys = OFF');
db.exec('BEGIN');
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS source_systems (
      id           TEXT PRIMARY KEY,
      label        TEXT NOT NULL,
      console_url  TEXT,
      is_active    INTEGER NOT NULL DEFAULT 1
    );
  `);
  db.prepare(
    `INSERT OR IGNORE INTO source_systems (id, label, console_url) VALUES
       ('manual', 'Manual', NULL),
       ('adt_solution', 'NewForce Solutions', 'https://admin.newforceltd.com/login/authentication')`
  ).run();

  // Any source value already on a row but not yet in the lookup gets a row, so the new FK holds
  // for data that predates it rather than failing the migration on an unrecognised system.
  for (const r of db.prepare('SELECT DISTINCT source FROM direct_employees').all()) {
    db.prepare('INSERT OR IGNORE INTO source_systems (id, label) VALUES (?, ?)').run(r.source, r.source);
  }

  db.exec(`
    CREATE TABLE direct_employees_new (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code       TEXT    NOT NULL UNIQUE,
      source_record_id    TEXT,
      source              TEXT    NOT NULL DEFAULT 'manual' REFERENCES source_systems(id),
      mirror_state        TEXT    NOT NULL DEFAULT 'not_required'
                            CHECK (mirror_state IN ('not_required','pending','failed','mirrored')),
      mirror_error        TEXT,
      mirror_attempts     INTEGER NOT NULL DEFAULT 0,
      mirror_last_try_at  TEXT,
      name                TEXT    NOT NULL,
      email               TEXT,
      phone_country_code  TEXT,
      contact             TEXT,
      company_name        TEXT,
      country             TEXT,
      looking_for         TEXT,
      heard_about_us      TEXT,
      department          TEXT,
      branch              TEXT,
      job_title           TEXT,
      join_date           TEXT,
      description         TEXT,
      status              TEXT    NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Active','Inactive')),
      raw_source_payload  TEXT,
      created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
      updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );
  `);

  // Renumbered by id, so the new numbering follows the order the clients were actually created
  // and the oldest client is CLI-000001. reference_id is deliberately not carried over — it is
  // the retired third id, and this is the natural moment to stop copying it forward.
  //
  // An existing row already has both ids, so it is 'mirrored'; one with no source record id was
  // created by hand and owes nothing outbound, so it is 'not_required'.
  const insert = db.prepare(
    `INSERT INTO direct_employees_new
       (id, employee_code, source_record_id, source, mirror_state,
        name, email, phone_country_code, contact, company_name, country, looking_for,
        heard_about_us, department, branch, job_title, join_date, description, status,
        raw_source_payload, created_at, updated_at)
     SELECT id, ?, source_record_id, source,
            CASE WHEN source_record_id IS NOT NULL THEN 'mirrored' ELSE 'not_required' END,
            name, email, phone_country_code, contact, company_name, country, looking_for,
            heard_about_us, department, branch, job_title, join_date, description, status,
            raw_source_payload, created_at, updated_at
       FROM direct_employees WHERE id = ?`
  );
  before.forEach((row, i) => insert.run(code(i + 1), row.id));

  db.exec('DROP TABLE direct_employees');
  db.exec('ALTER TABLE direct_employees_new RENAME TO direct_employees');

  db.exec('CREATE INDEX IF NOT EXISTS idx_de_status ON direct_employees (status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_de_source_record ON direct_employees (source_record_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_de_mirror_state ON direct_employees (mirror_state)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_de_source_record ON direct_employees (source, source_record_id)');

  // The one counter, positioned past the highest id just issued so nothing is ever reused.
  db.prepare('INSERT OR REPLACE INTO id_sequences (name, next_value) VALUES (?, ?)')
    .run('client', before.length + 1);
  db.prepare("DELETE FROM id_sequences WHERE name IN ('adt_employee','manual_employee')").run();

  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Migration failed, database left untouched: ' + e.message);
  console.error('Backup remains at ' + backup);
  process.exit(1);
}
db.exec('PRAGMA foreign_keys = ON');

const check = db.prepare('PRAGMA foreign_key_check').all();
if (check.length) {
  console.error('Foreign key check failed after migration: ' + JSON.stringify(check));
  process.exit(1);
}

console.log('\nDone. Client IDs now:');
for (const r of db.prepare('SELECT employee_code, source, source_record_id, mirror_state FROM direct_employees ORDER BY id').all()) {
  console.log('  ' + r.employee_code.padEnd(12) + (r.source || '').padEnd(15)
    + (r.source_record_id || '--').padEnd(15) + r.mirror_state);
}
const seq = db.prepare("SELECT next_value FROM id_sequences WHERE name = 'client'").get();
console.log('\nNext client will be ' + code(seq.next_value) + '.');
