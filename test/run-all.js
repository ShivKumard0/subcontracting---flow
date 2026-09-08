// Everything, in one command:  node test/run-all.js
//
// Three suites, and they check different things — which the escape-flattening incident proved
// the hard way. The behaviour suite passed 352 checks while a gate button was dead, because a
// broken handler lives inside a string literal and never runs during a headless test.
//
//   ccj-harness    the rebuilt journey behaves correctly
//   ccj-handlers   every control it draws actually works
//   runner-harness the ORIGINAL journey still works — the regression guard
//   connector-newforce-mw  the CRM push maps, encodes and reads replies correctly
//   connector-bhaiyaa      the store poll parses Bhaiyaa's nested payloads correctly
const { execFileSync } = require('child_process');
const path = require('path');
const suites = ['ccj-harness.js', 'ccj-handlers.js', 'runner-harness.js',
                'connector-newforce-mw.js', 'connector-bhaiyaa.js'];
let failed = 0;
for (const s of suites) {
  process.stdout.write('\n══ ' + s + ' ' + '═'.repeat(Math.max(0, 56 - s.length)) + '\n');
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, s)], { encoding: 'utf8' });
    const tail = out.trim().split('\n').slice(-2).join('\n');
    console.log(tail);
  } catch (e) {
    failed++;
    console.log((e.stdout || '').split('\n').filter((l) => /FAIL|FATAL|failed/.test(l)).join('\n'));
    console.log('  ^^ ' + s + ' FAILED');
  }
}
console.log('\n' + (failed ? failed + ' suite(s) failed' : 'all suites passed') + '\n');
process.exit(failed ? 1 : 0);
