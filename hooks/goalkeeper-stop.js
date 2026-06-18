#!/usr/bin/env node
'use strict';

/**
 * goalkeeper-stop.js  —  the continuation engine.
 *
 * Fires on the Claude Code `Stop` event (when the agent tries to end its
 * turn). If goals remain open, it returns {"decision":"block","reason":...}
 * which Claude Code feeds back to the model instead of stopping. That is
 * the entire trick: every natural stopping point is bounced back with the
 * still-unfinished work until the checklist is provably empty.
 *
 * Guardrails so it never loops forever:
 *   - `off` mode never blocks.
 *   - A session with no recorded goals is never trapped.
 *   - `lite` mode blocks exactly once.
 *   - A per-project loop budget (GOALKEEPER_MAX_LOOPS, default 30) stands
 *     the guard down if it blocks repeatedly WITHOUT progress.
 *   - Any real progress (open-goal count drops) refills the budget, so the
 *     rail only trips when the agent is genuinely stuck.
 */

const rt = require('./goalkeeper-runtime');
const cfg = require('./goalkeeper-config');

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      try {
        resolve(buf.trim() ? JSON.parse(buf) : {});
      } catch {
        resolve({});
      }
    };
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => (buf += c));
      process.stdin.on('end', done);
      process.stdin.on('error', done);
    } catch {
      done();
    }
    // Never hang a hook: bail after 2s if stdin never closes.
    setTimeout(done, 2000).unref?.();
  });
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

(async () => {
  const input = await readStdin();
  const dir = rt.projectDir(input);
  const state = rt.readState(dir);
  const mode = state.mode;

  // Disarmed, or nothing to guard: let the agent stop.
  if (mode === 'off' || !state.goals.length) process.exit(0);

  const open = rt.openGoals(state.goals, mode);

  // Everything resolved: release the guard with a quiet banner.
  if (open.length === 0) {
    state.iterations = 0;
    state.lastOpen = 0;
    rt.writeState(dir, state);
    emit({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: cfg.successBanner(state.goals.length, mode),
      },
    });
    process.exit(0);
  }

  // Progress since the last block refills the loop budget.
  if (open.length < state.lastOpen) state.iterations = 0;
  state.lastOpen = open.length;

  // lite mode: a single nudge, then get out of the way.
  if (mode === 'lite' && state.iterations >= 1) {
    state.iterations = 0;
    rt.writeState(dir, state);
    process.exit(0);
  }

  const max = rt.maxLoops();
  if (state.iterations >= max) {
    state.iterations = 0;
    rt.writeState(dir, state);
    emit({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: cfg.budgetExhausted(open, mode, max),
      },
    });
    process.exit(0);
  }

  // Block the stop and hand the model its unfinished work.
  state.iterations += 1;
  rt.writeState(dir, state);
  emit({ decision: 'block', reason: cfg.stopReason(open, mode, state.iterations, max) });
  process.exit(0);
})().catch(() => process.exit(0)); // a broken guard must never wedge a session
