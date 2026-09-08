// Connector for backend/mock-adt-server.js — the stand-in NewForce Solutions site.
//
// This is the push that used to live inline in server.js's attemptMirror(). Lifting it out
// unchanged is what lets the real middleware connector sit beside it as a peer rather than as a
// special case bolted onto the mock's shape.

const SUBMIT_PATH = '/api/employee-intake/submit';

// The mock echoes back the record it filed, with its own id on it. Accept the few spellings a
// real API might use rather than only the one this mock happens to emit.
function extractRecordId(data) {
  if (!data) return '';
  return String(data.id || data.recordId || data.reference || '');
}

async function submit(intake, cfg) {
  // Our Client ID travels with the record so the source system stores OUR name for the client
  // alongside its own — that is what lets a human line the two up, and what lets us re-link a
  // record whose submit response we never received.
  const outbound = Object.assign({}, intake, { external_ref: cfg.externalRef || null });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs || 6000);
  let res;
  try {
    res = await fetch(cfg.baseUrl + SUBMIT_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify(outbound),
      signal: controller.signal
    });
  } catch (e) {
    return { ok: false, error: 'Could not reach NewForce Solutions: ' + e.message };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return { ok: false, error: 'NewForce Solutions rejected the submission (' + res.status + ')' };
  }

  let parsed = null;
  try { parsed = await res.json(); } catch { parsed = null; }
  const data = parsed && parsed.data ? parsed.data : parsed;
  const sourceRecordId = extractRecordId(data);
  if (!sourceRecordId) {
    return { ok: false, error: 'NewForce Solutions accepted the record but returned no id for it' };
  }
  return { ok: true, sourceRecordId, submission: data };
}

module.exports = { id: 'adt_solution', label: 'NewForce Solutions', submit, extractRecordId };
