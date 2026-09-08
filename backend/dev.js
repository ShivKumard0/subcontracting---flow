// Starts everything the demo needs, so it is one command rather than several terminals and a
// chance to start only some of them:
//   - the mock NewForce Solutions site (the external system, port 4100)
//   - the Executive Layer storage backend (port 4000)
//   - the frontend (port 5500)
// Zero dependencies, same as everything else here. Ctrl-C stops all of them.
//
// Run: node backend/dev.js   (or `npm run dev` from inside backend/)

const { spawn } = require('node:child_process');
const path = require('node:path');

const services = [
  { name: 'adt ', file: 'mock-adt-server.js', color: '\x1b[36m' },  // cyan
  { name: 'exec', file: 'server.js', color: '\x1b[35m' },           // magenta
  { name: 'web ', file: 'static-server.js', color: '\x1b[32m' }     // green
];
const RESET = '\x1b[0m';

const children = services.map((svc) => {
  const child = spawn(process.execPath, [path.join(__dirname, svc.file)], { stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = svc.color + '[' + svc.name + ']' + RESET + ' ';
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach((line) => out.write(prefix + line + '\n'));
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  // If either service dies the demo is broken, so take the whole thing down rather than
  // leaving a half-running setup that fails in a confusing way later.
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(prefix + 'exited with code ' + code + ' — stopping the other service too.');
      shutdown();
    }
  });
  return child;
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach((c) => { try { c.kill(); } catch {} });
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Starting the Executive Layer demo:\n');
console.log('  >> OPEN THIS       http://localhost:5500/index.html');
console.log('     NewForce Sol.   http://localhost:4100');
console.log('     Backend API     http://localhost:4000/health');
console.log('\n  Ctrl-C stops all three.\n');
