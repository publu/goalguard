#!/usr/bin/env node
'use strict';

/**
 * goalguard-prompt.js  —  UserPromptSubmit hook.
 *
 * Re-staples the open checklist into context on every user turn. As the
 * conversation grows the model drifts; this keeps the goals (and how to close
 * them) in view so the Stop guard rarely has to fire.
 */

const rt = require('./goalguard-runtime');
const cfg = require('./goalguard-config');

(async () => {
  const dir = rt.projectDir();
  const state = rt.readState(dir);
  const text = cfg.reminder(state);
  if (!text) process.exit(0); // off, or no goals: stay silent
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: text,
      },
    })
  );
  process.exit(0);
})().catch(() => process.exit(0));
