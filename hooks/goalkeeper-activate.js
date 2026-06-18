#!/usr/bin/env node
'use strict';

/**
 * goalkeeper-activate.js  —  SessionStart hook.
 *
 * Loads (or initializes) project state and surfaces any goals carried over
 * from a previous session, so a resumed session is armed from turn one.
 */

const rt = require('./goalkeeper-runtime');
const cfg = require('./goalkeeper-config');

(async () => {
  const dir = rt.projectDir();
  const state = rt.readState(dir);

  // Reset the per-run loop counter at the start of a fresh session.
  state.iterations = 0;
  rt.writeState(dir, state);

  const open = rt.openGoals(state.goals, state.mode);
  let ctx;
  if (state.mode === 'off') {
    ctx = '[goalkeeper] installed, mode=off (disarmed). Run `/goalkeeper <objective>` to arm it.';
  } else if (open.length === 0) {
    ctx = `[goalkeeper] armed, mode=${state.mode} (${cfg.MODE_BLURB[state.mode]}). No open goals. Run \`/goalkeeper <objective>\` to set one.`;
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
