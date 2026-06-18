#!/usr/bin/env node
'use strict';

/**
 * goalguard-activate.js  —  SessionStart hook.
 *
 * Loads (or initializes) project state and surfaces any goals carried over
 * from a previous session, so a resumed session is armed from turn one.
 */

const rt = require('./goalguard-runtime');
const cfg = require('./goalguard-config');

(async () => {
  const dir = rt.projectDir();
  const state = rt.readState(dir);

  // Reset the per-run loop counter at the start of a fresh session.
  state.iterations = 0;
  rt.writeState(dir, state);

  const open = rt.openGoals(state.goals, state.mode);
  let ctx;
  if (state.mode === 'off') {
    ctx = '[goalguard] installed, mode=off (disarmed). Run `/goalguard <objective>` to arm it.';
  } else if (open.length === 0) {
    ctx = `[goalguard] armed, mode=${state.mode} (${cfg.MODE_BLURB[state.mode]}). No open goals. Run \`/goalguard <objective>\` to set one.`;
  } else {
    ctx = cfg.reminder(state);
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: ctx,
      },
    })
  );
  process.exit(0);
})().catch(() => process.exit(0));
