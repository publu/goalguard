#!/usr/bin/env node
'use strict';

/**
 * goalguard conformance test — exercises every item in SPEC.md §12.
 * No dependencies. Run: `node benchmarks/conformance.test.js`
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOKS = path.join(__dirname, '..', 'hooks');
const STOP = path.join(HOOKS, 'goalguard-stop.js');
const CLI = path.join(HOOKS, 'goalguard-cli.js');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    fail++;
    console.log('  FAIL ' + name);
  }
}

function freshDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'goalguard-'));
}

function cli(dir, args) {
  return execFileSync('node', [CLI, ...args], {
    env: { ...process.env, GOALGUARD_DIR: dir },
    encoding: 'utf8',
  });
}

/** Run the Stop hook; returns {block, reason, out, code}. */
function stop(dir, stdin) {
  let out = '';
  let code = 0;
  try {
    out = execFileSync('node', [STOP], {
      env: { ...process.env, GOALGUARD_DIR: dir },
      input: stdin === undefined ? '{"hook_event_name":"Stop"}' : stdin,
      encoding: 'utf8',
    });
  } catch (e) {
    code = e.status || 1;
    out = (e.stdout || '').toString();
  }
  let parsed = {};
  try {
    parsed = out.trim() ? JSON.parse(out) : {};
  } catch {
    /* non-JSON output */
  }
  return { block: parsed.decision === 'block', reason: parsed.reason || '', out, code };
}

console.log('goalguard conformance (SPEC.md §12)\n');

// 1. off mode and empty checklist both allow stopping.
{
  const d = freshDir();
  check('empty checklist allows stop', !stop(d).block);
  cli(d, ['add', 'x']);
  cli(d, ['mode', 'off']);
  check('off mode allows stop', !stop(d).block);
}

// 2. open goal -> block, with the goal text quoted in reason.
{
  const d = freshDir();
  cli(d, ['mode', 'standard']);
  cli(d, ['add', 'ship the feature']);
  const r = stop(d);
  check('open goal blocks', r.block);
  check('reason quotes the goal', r.reason.includes('ship the feature'));
}

// 3. release happens exactly when open count hits 0.
{
  const d = freshDir();
  cli(d, ['mode', 'standard']);
  cli(d, ['add', 'a']);
  check('blocks while open', stop(d).block);
  cli(d, ['done', 'g1']);
  check('releases when done', !stop(d).block);
}

// 4. strict keeps a done goal open until verified.
{
  const d = freshDir();
  cli(d, ['mode', 'strict']);
  cli(d, ['add', 'a']);
  cli(d, ['done', 'g1']);
  check('strict still blocks after done', stop(d).block);
  cli(d, ['verify', 'g1']);
  check('strict releases after verify', !stop(d).block);
}

// 5. lite mode blocks at most once per cycle.
{
  const d = freshDir();
  cli(d, ['mode', 'lite']);
  cli(d, ['add', 'a']);
  check('lite blocks first stop', stop(d).block);
  check('lite allows second stop', !stop(d).block);
}

// 6. no-progress budget stands down within MAX_LOOPS; progress refills it.
{
  const d = freshDir();
  cli(d, ['mode', 'standard']);
  cli(d, ['add', 'a']);
  cli(d, ['add', 'b']);
  const env = { ...process.env, GOALGUARD_DIR: d, GOALGUARD_MAX_LOOPS: '3' };
  const stopEnv = () => {
    try {
      const out = execFileSync('node', [STOP], { env, input: '{}', encoding: 'utf8' });
      return out.includes('"decision":"block"');
    } catch {
      return false;
    }
  };
  // 3 blocks then a stand-down on the 4th, with no progress.
  const seq = [stopEnv(), stopEnv(), stopEnv(), stopEnv()];
  check('budget stands down after MAX_LOOPS no-progress blocks',
    seq[0] && seq[1] && seq[2] && !seq[3]);
  // Make real progress (open 2 -> 1): the budget should refill and block again,
  // proving a productive agent never trips the rail.
  cli(d, ['done', 'g1']);
  check('progress refills budget', stopEnv());
}

// 7 & 8. malformed stdin and a corrupt state file both exit 0 (never crash).
{
  // Empty checklist + garbage stdin -> graceful allow.
  const d1 = freshDir();
  const r1 = stop(d1, 'not json at all');
  check('malformed stdin exits 0 and allows (no goals)', !r1.block && r1.code === 0);

  // Corrupt state file is treated as blank state -> allow, no crash.
  const d2 = freshDir();
  fs.mkdirSync(path.join(d2, '.goalguard'), { recursive: true });
  fs.writeFileSync(path.join(d2, '.goalguard', 'state.json'), '{ broken json');
  const r2 = stop(d2);
  check('corrupt state file fails open', !r2.block && r2.code === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
