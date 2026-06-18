# goalguard — Specification

**Version:** 0.1.0
**Status:** Stable core, additive roadmap
**Type:** Claude Code plugin (Stop-hook continuation guard)

---

## 1. Summary

goalguard is the inverse of a "lazy developer" ruleset. Where a steering plugin
shapes *what* an agent writes, goalguard governs *when an agent is allowed to
stop*. It holds a session to an explicit, verifiable goal checklist and, on
every attempt to end the turn, re-injects the unfinished goals as the agent's
next instruction. The agent cannot quit early; it is released the instant — and
only the instant — the checklist is provably empty.

The design objective is **honest long-horizon autonomy**: keep a capable model
working until the job is actually done, while making it structurally hard to
fake completion and structurally impossible to loop forever.

### 1.1 The one-sentence mechanism

> A `Stop` hook returns `{"decision":"block","reason":<unfinished goals>}`; Claude
> Code feeds `reason` back to the model in place of stopping, so the agent
> resumes work on its own unfinished checklist.

Everything else in this spec is guardrails, ergonomics, and honesty mechanisms
around that one sentence.

---

## 2. Design principles

1. **Force continuation, not just steering.** Most agent tooling shapes *what*
   the model does each turn. goalguard governs *whether the turn is allowed to
   end* — it re-injects an *obligation* every time the agent tries to stop. The
   leverage point is the `Stop` event, not `UserPromptSubmit`.

2. **Goals must be verifiable, not vibes.** A goal is something you can point at
   and prove (a file exists, a test passes, a command exits 0). Fuzzy goals are
   rewritten before they are recorded.

3. **Completion must be earned, not asserted.** In strict mode, "done" is not
   enough; a goal stays open until a separate, evidence-based verification pass
   confirms it. This is the "double-check" that drives longer, more rigorous
   runs.

4. **Autonomous, not negligent.** A guard that can wedge a session is worse than
   no guard. Three independent rails (mode `off`, a no-progress loop budget, and
   explicit goal removal) guarantee a bounded, predictable exit.

5. **State is plain and inspectable.** Everything lives in one human-readable
   JSON file the user can read, edit, or delete. No hidden daemons, no network.

6. **Host-agnostic core, thin adapters.** The decision logic is pure functions
   over state. Claude Code is the first adapter; Codex and Copilot are
   roadmap adapters that reuse the same core (see §9).

---

## 3. Architecture

```
                 ┌─────────────────────────── Claude Code session ──────────────────────────┐
                 │                                                                            │
  SessionStart ──┼──▶ goalguard-activate.js ──▶ load state, surface carried-over goals       │
                 │                                                                            │
 UserPromptSubmit┼──▶ goalguard-prompt.js   ──▶ re-staple open checklist into context        │
                 │                                                                            │
      agent works├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
   marks goals ──┼──▶ goalguard-cli.js      ──▶ add / done / verify / reopen / remove         │
                 │                                                                            │
         Stop ───┼──▶ goalguard-stop.js     ──▶ open goals? ── yes ─▶ {"decision":"block",    │
                 │            │                                        "reason": checklist}    │
                 │            └───────────────── no ─▶ exit 0 (release)                        │
                 └────────────────────────────────────────────────────────────────────────────┘
                                              │
                                  <project>/.goalguard/state.json   (single source of truth)
```

**Components**

| File                     | Role                                                              |
| ------------------------ | ---------------------------------------------------------------- |
| `hooks/goalguard-runtime.js` | Shared state model + pure decision helpers. No side effects beyond file I/O. |
| `hooks/goalguard-config.js`  | Every injected string, incl. the load-bearing Stop `reason`.  |
| `hooks/goalguard-stop.js`    | The `Stop` hook — the continuation engine.                    |
| `hooks/goalguard-prompt.js`  | The `UserPromptSubmit` hook — keeps goals in view.            |
| `hooks/goalguard-activate.js`| The `SessionStart` hook — arms resumed sessions.             |
| `hooks/goalguard-cli.js`     | Control surface for commands and the agent.                  |
| `hooks/hooks.json`           | Wires the three events.                                       |
| `commands/*.md`              | Slash commands.                                               |
| `skills/goalguard/SKILL.md`  | Teaches the agent its half of the loop.                      |

---

## 4. State model

Project-scoped, at `<project>/.goalguard/state.json`. One project = one active
goal set; concurrent sessions on the same project share it.

```jsonc
{
  "version": "0.1.0",
  "mode": "standard",          // off | lite | standard | strict
  "iterations": 0,             // consecutive Stop-blocks since last progress
  "lastOpen": 2,               // open-goal count at the previous Stop
  "updated": "2026-06-17T…Z",
  "goals": [
    {
      "id": "g1",
      "text": "all tests in src/ pass",
      "done": false,           // agent asserts completion
      "verified": false,       // strict mode: completion proven
      "created": "2026-06-17T…Z"
    }
  ]
}
```

Writes are tmp-file + rename, so a crash mid-write cannot truncate state.
A missing or corrupt file is treated as blank state — never fatal.

### 4.1 Openness

A goal is **open** (blocks stopping) iff:

```
done !== true                              // standard + strict
  OR (mode === "strict" AND verified !== true)   // strict only
```

The guard releases when zero goals are open.

---

## 5. The Stop algorithm

`goalguard-stop.js`, on each `Stop` event:

```
input  ← JSON on stdin  (session_id, cwd, stop_hook_active, …)
state  ← readState(projectDir)

if mode == "off"            → exit 0                  # disarmed
if goals is empty           → exit 0                  # never trap an un-armed session

open ← goals filtered by §4.1
if open is empty            → reset counters; emit success banner; exit 0   # release

if open.length < lastOpen   → iterations ← 0          # progress refills the budget
lastOpen ← open.length

if mode == "lite" and iterations >= 1 → reset; exit 0 # one nudge only

if iterations >= MAX_LOOPS  → reset; emit stand-down banner; exit 0   # safety rail

iterations ← iterations + 1
persist state
emit {"decision":"block","reason": stopReason(open, mode, iterations, MAX_LOOPS)}
exit 0
```

Any unhandled error exits 0 (allow stop). **A broken guard must never wedge a
session.**

### 5.1 Why the loop is bounded

- **Progress refills, stagnation drains.** The budget only decrements while the
  open-goal count is *not* falling. A productive agent never trips it; a stuck
  agent trips it within `MAX_LOOPS` blocks.
- **`stop_hook_active` is informational, not a kill switch.** goalguard tracks
  its own progress-aware counter rather than bailing the first time it sees a
  re-entrant stop, because re-entry is the normal, desired case here.
- **Three independent exits:** `off`, empty checklist, and the budget rail.

---

## 6. The continuation directive (`reason`)

The text returned as `reason` is the product. It must, in order:

1. **Refuse the stop** unambiguously (`STOP BLOCKED BY GOALGUARD. You are not done.`).
2. **Re-state the exact open goals** with their ids and status boxes.
3. **Demand the next concrete action** — the smallest real step, not a summary,
   not a permission request.
4. **(strict)** Demand an independent, evidence-based verification pass for any
   goal marked done-but-unverified, with explicit `verify` / `reopen` paths.
5. **Forbid silent abandonment** — an out-of-scope goal must be `remove`-d with a
   stated reason, never quietly dropped.

See `goalguard-config.js :: stopReason()` for the canonical wording.

---

## 7. Modes

| Mode       | Blocks while…                                  | Use when                                   |
| ---------- | ---------------------------------------------- | ------------------------------------------ |
| `off`      | never                                           | temporarily disarmed                        |
| `lite`     | first stop only, then releases                  | a gentle "did you forget something?" nudge  |
| `standard` | any goal is not `done`                          | normal autonomous completion (default)      |
| `strict`   | any goal is not `done` **and** `verified`       | high-stakes work; forces a double-check pass |

Selected via `GOALGUARD_DEFAULT_MODE`, `goalguard-cli.js mode`, or
`/goalguard-mode`. Mode set in state wins over the env default.

---

## 8. Configuration

| Variable                 | Default    | Effect                                                |
| ------------------------ | ---------- | ----------------------------------------------------- |
| `GOALGUARD_DEFAULT_MODE` | `standard` | Starting mode when state has none.                    |
| `GOALGUARD_MAX_LOOPS`    | `30`       | Max consecutive Stop-blocks **without progress** before the guard stands down. |
| `CLAUDE_PROJECT_DIR`     | (host)     | Project root; falls back to the hook's `cwd`, then `GOALGUARD_DIR`, then `process.cwd()`. |
| `GOALGUARD_DIR`          | —          | Explicit override for the guarded directory (mainly for tests/CI). |

---

## 9. Contracts (host integration)

goalguard depends only on documented hook contracts that **Claude Code and Codex
share**:

- **Stop** receives `{session_id, transcript_path, cwd, stop_hook_active, …}` on
  stdin; returning `{"decision":"block","reason":string}` forces continuation
  with `reason` as the next instruction. (Exit code 2 + stderr is an equivalent
  block; goalguard uses the JSON form.) On Claude Code the turn continues; on
  Codex the `reason` is injected as the next user prompt — same effect.
- **UserPromptSubmit / SessionStart** accept
  `{"hookSpecificOutput":{"hookEventName":…,"additionalContext":string}}` to
  inject context without blocking.

### 9.1 Hosts

| Host        | Status     | Notes                                                                                   |
| ----------- | ---------- | --------------------------------------------------------------------------------------- |
| Claude Code | supported  | Manifest `.claude-plugin/{plugin,marketplace}.json`; `${CLAUDE_PLUGIN_ROOT}`.            |
| Codex CLI   | supported  | Manifest `.codex-plugin/plugin.json` + marketplace at `.agents/plugins/marketplace.json`. Identical `hooks/hooks.json`, identical Stop-veto, and Codex aliases `CLAUDE_PLUGIN_ROOT` — so the engine and command paths are byte-for-byte the same. |
| Copilot     | roadmap    | Copilot hooks inject context but the Stop-veto path is unverified; would degrade to a `lite`-style reminder until confirmed. |

The decision core (`runtime` + `config`) is pure and host-independent. Because
Claude Code and Codex use the same hook schema, the *only* per-host artifacts are
the plugin manifests; no JavaScript differs between them.

---

## 10. Security & safety

- **No network, no telemetry.** Pure local file I/O under the project dir.
- **No path traversal.** State is confined to `<project>/.goalguard/`.
- **Fail-open.** Every hook exits 0 on any error; goalguard can never deadlock a
  session.
- **Node optional.** If `node` is absent from `PATH`, the hooks no-op (`|| exit 0`)
  and Claude Code behaves exactly as if the plugin were not installed.
- **User-owned escape hatch.** `/goalguard-release`, `mode off`, deleting the
  state file, or uninstalling the plugin all stand the guard down immediately.

---

## 11. Non-goals

- Not a planner or a task queue. goalguard tracks completion; it does not decide
  *what* the goals should be (the agent/user does).
- Not a sandbox or permission system. It governs stopping, not what the agent is
  allowed to do.
- Not a scheduler. It extends a single session's working horizon; it does not
  start sessions or run on a cron.

---

## 12. Conformance checklist

An implementation conforms iff:

- [ ] `off` mode and an empty checklist both allow stopping (exit 0).
- [ ] A non-empty checklist with ≥1 open goal yields `decision:block` with the
      open goals quoted in `reason`.
- [ ] Releasing happens exactly when open-goal count reaches 0.
- [ ] strict mode keeps a `done` goal open until `verified`.
- [ ] `lite` mode blocks at most once per stop cycle.
- [ ] The no-progress budget stands the guard down within `MAX_LOOPS` blocks and
      resets on progress.
- [ ] Every hook exits 0 on malformed/empty stdin or a corrupt state file.

The shipped test in `benchmarks/` exercises all eight.
