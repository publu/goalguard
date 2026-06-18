---
description: Arm goalkeeper with an objective — decompose it into verifiable goals, then work until done.
argument-hint: <objective to complete>
---

The user wants goalkeeper to hold this session to an objective:

> $ARGUMENTS

Do the following, in order:

1. **Decompose** the objective into a short list of concrete, independently
   verifiable goals — each one a thing you can point at and prove is finished
   (a file exists, a test passes, a command exits 0). Prefer 2–6 goals. Avoid
   vague goals like "make it good"; prefer "all unit tests pass".

2. **Record** each goal:
   `node "${CLAUDE_PLUGIN_ROOT}/hooks/goalkeeper-cli.js" add "<goal text>"`

3. **Confirm the mode is armed.** If `goalkeeper-cli.js status` reports
   `mode=off`, set it: `goalkeeper-cli.js mode standard` (or `strict` if the
   user wants every goal double-checked before it counts).

4. **Start working immediately.** Do not stop to ask permission. As each goal
   is genuinely finished, mark it `done <id>` (and in strict mode, `verify <id>`
   once you have concrete proof). goalkeeper will block any attempt to stop
   while goals remain open, and will release you automatically the moment the
   checklist is empty.

Begin now.
