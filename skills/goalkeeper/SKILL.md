---
name: goalkeeper
description: Use when the user wants an agent to keep working until a task is fully and verifiably complete, to run autonomously for a long time, or to stop quitting early. Explains how to arm goalkeeper, decompose objectives into verifiable goals, and check them off so the Stop guard releases.
---

# goalkeeper

goalkeeper is a continuation guard. It uses the Claude Code **Stop hook** to
refuse to let a session end while it is holding open goals, re-injecting the
unfinished checklist as the next instruction. The result: the agent keeps
working — often for far longer than it otherwise would — until the work is
provably done.

You (the agent) are one half of the loop. The hook can force you to keep going,
but only **you** can close goals out, and only honestly.

## The loop

1. **Arm** with goals. Either the user runs `/goalkeeper <objective>` (which asks
   you to decompose it), or you record goals yourself as you discover them:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/hooks/goalkeeper-cli.js" add "all tests in src/ pass"
   ```

2. **Work.** Do the smallest next real action toward an open goal. Don't pause to
   ask permission or to report progress — that just triggers the guard.

3. **Check off** each goal the moment it is genuinely finished:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/hooks/goalkeeper-cli.js" done g2
   ```

4. **Release** is automatic. When the last goal closes, the guard steps aside and
   you may stop. You never need to "turn it off" after success.

## Writing good goals

A goal must be **independently verifiable** — something you can point at and
prove. Rewrite fuzzy goals before recording them.

| Weak goal                | Strong goal                                       |
| ------------------------ | ------------------------------------------------- |
| "improve the API"        | "POST /users returns 201 and persists a row"      |
| "add tests"              | "npm test exits 0 with >0 new tests for auth.ts"  |
| "make it production ready"| "lint passes, README documents env vars, CI green"|

Keep the list short (2–6 goals). Big objectives become a few verifiable goals,
not twenty.

## Modes

| Mode       | Behavior                                                        |
| ---------- | -------------------------------------------------------------- |
| `off`      | Disarmed. Never blocks.                                         |
| `lite`     | Blocks once with a reminder, then lets you stop.                |
| `standard` | Blocks until every goal is marked `done`. (default)            |
| `strict`   | Blocks until every goal is `done` **and** independently `verify`-ed. |

Set with `goalkeeper-cli.js mode <name>` or the `GOALKEEPER_DEFAULT_MODE` env var.

## Strict mode: the double-check

In strict mode, marking a goal `done` is not enough — it stays open until you
`verify` it. Verification means a **separate, evidence-based pass**:

- Re-read the produced code with fresh eyes, or
- Run the test / build / command that proves the goal holds, and
- Confirm it satisfies the goal **as originally stated** — not a stub, not a
  near-miss, not a TODO.

Only then:

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/goalkeeper-cli.js" verify g2
```

If the double-check fails, reopen it and fix it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/goalkeeper-cli.js" reopen g2
```

This is how goalkeeper turns "the model said it's done" into "the model proved
it's done", and it is the single biggest reason an armed session runs longer:
every claim of completion buys a verification pass.

## Honesty rules

- **Never** mark a goal `done` to escape the guard. That defeats the entire
  point and ships broken work.
- If a goal turns out to be impossible or out of scope, drop it **explicitly**
  with `remove <id>` and tell the user why. Never silently abandon it.
- If you are truly stuck, the loop budget (`GOALKEEPER_MAX_LOOPS`, default 30
  continuations without progress) will eventually stand the guard down and
  surface the unfinished goals to the user — but reaching that is a failure
  signal, not a normal exit.

## Inspecting state

State is plain JSON at `<project>/.goalkeeper/state.json` — safe to read, edit,
or delete by hand. `goalkeeper-cli.js status` prints the current mode and
checklist.
