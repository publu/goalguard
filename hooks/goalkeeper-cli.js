#!/usr/bin/env node
'use strict';

/**
 * goalkeeper-cli.js  —  the control surface.
 *
 * Slash commands shell out to this, and the agent calls it directly to
 * check goals off as it works. It is a thin, dependency-free wrapper over
 * the shared state in goalkeeper-runtime.js.
 *
 * Usage:
 *   goalkeeper-cli.js mode [off|lite|standard|strict]
 *   goalkeeper-cli.js add   "<goal text>"        # repeatable
 *   goalkeeper-cli.js list
 *   goalkeeper-cli.js status
 *   goalkeeper-cli.js done   <id>
 *   goalkeeper-cli.js verify <id>
 *   goalkeeper-cli.js reopen <id>
 *   goalkeeper-cli.js remove <id>
 *   goalkeeper-cli.js release            # clear all goals (disarm this project)
 */

const rt = require('./goalkeeper-runtime');
const cfg = require('./goalkeeper-config');

function out(s) {
  process.stdout.write(s + '\n');
}

function printStatus(state) {
  const open = rt.openGoals(state.goals, state.mode);
  out(`goalkeeper  mode=${state.mode}  (${cfg.MODE_BLURB[state.mode]})`);
  out(`${state.goals.length} goal(s), ${open.length} open:`);
  out(cfg.renderGoals(state.goals, state.mode));
}

function main(argv) {
  const dir = rt.projectDir();
  const state = rt.readState(dir);
  const cmd = (argv[0] || 'status').toLowerCase();
  const arg = argv.slice(1).join(' ').trim();

  switch (cmd) {
    case 'mode': {
      if (!arg) {
        out(`mode=${state.mode}`);
        return 0;
      }
      const m = arg.toLowerCase();
      if (!rt.VALID_MODES.includes(m)) {
        out(`error: invalid mode "${m}". Valid: ${rt.VALID_MODES.join(', ')}`);
        return 1;
      }
      state.mode = m;
      rt.writeState(dir, state);
      out(`mode set to ${m} (${cfg.MODE_BLURB[m]})`);
      return 0;
    }

    case 'add': {
      if (!arg) {
        out('error: add requires goal text');
        return 1;
      }
      const id = rt.nextId(state.goals);
      state.goals.push({
        id,
        text: arg,
        done: false,
        verified: false,
        created: new Date().toISOString(),
      });
      // Arm the guard automatically if it was idle but not explicitly off.
      if (state.mode === 'off') {
        out('note: mode is off — guard will not block. Run `mode standard` to arm.');
      }
      rt.writeState(dir, state);
      out(`added ${id}: ${arg}`);
      return 0;
    }

    case 'done':
    case 'verify':
    case 'reopen':
    case 'remove': {
      const g = rt.findGoal(state.goals, arg);
      if (!g) {
        out(`error: no goal matching "${arg}"`);
        return 1;
      }
      if (cmd === 'done') {
        g.done = true;
        out(`marked ${g.id} done${state.mode === 'strict' ? ' — now verify it with proof' : ''}`);
      } else if (cmd === 'verify') {
        if (!g.done) g.done = true;
        g.verified = true;
        out(`verified ${g.id}`);
      } else if (cmd === 'reopen') {
        g.done = false;
        g.verified = false;
        out(`reopened ${g.id}`);
      } else {
        state.goals = state.goals.filter((x) => x !== g);
        out(`removed ${g.id}: ${g.text}`);
      }
      rt.writeState(dir, state);
      return 0;
    }

    case 'release':
    case 'clear': {
      const n = state.goals.length;
      state.goals = [];
      state.iterations = 0;
      state.lastOpen = 0;
      rt.writeState(dir, state);
      out(`released — cleared ${n} goal(s). Guard is idle.`);
      return 0;
    }

    case 'list':
    case 'status':
      printStatus(state);
      return 0;

    default:
      out(`unknown command "${cmd}". See goalkeeper-cli.js for usage.`);
      return 1;
  }
}

process.exit(main(process.argv.slice(2)));
