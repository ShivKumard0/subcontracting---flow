// Connection settings for the Executive Layer storage backend (backend/server.js).
//
// Note what is NOT here: the NewForce Solutions API key. It used to ship in client-side JS because
// the browser called ADT directly; the backend now holds that credential and proxies the poll,
// so this file contains nothing secret and is safe to commit.
window.EXEC_CONFIG = {
  baseUrl: 'http://localhost:4000',
  // How often the "Live NewForce Solutions Sync" panel asks the backend to poll NewForce Solutions.
  pollIntervalMs: 4000,
  // Set only if the backend was started with EXEC_API_TOKEN. Leave empty for local demos.
  apiToken: '',
  // Where the "Open the NewForce Solutions form" link on the sync panel points. Change to the real
  // NewForce Solutions website once the integration moves off backend/mock-adt-server.js.
  adtFormUrl: 'http://localhost:4100',
  // Where the "Source System" badge on a NewForce-sourced client points — the real NewForce
  // console, so an operator can go and look at the submission in the system that issued it.
  // Unlike adtFormUrl this is never the mock: the mock has no record the operator would recognise.
  adtConsoleUrl: 'https://admin.newforceltd.com/login/authentication'
};
