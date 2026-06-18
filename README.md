<p align="center">
  <img src="assets/goalkeeper.png" alt="goalkeeper" width="300">
</p>

<h1 align="center">goalkeeper</h1>

<p align="center"><em>You say you're done. She checks the list. You're not done.</em></p>

<p align="center">
  <img src="https://img.shields.io/github/stars/publu/goalkeeper?style=flat-square&label=stars&color=333&labelColor=555" alt="stars">
  <img src="https://img.shields.io/badge/release-v0.1.0-333?style=flat-square&labelColor=555" alt="release">
  <img src="https://img.shields.io/badge/works%20with-Claude%20Code%20%C2%B7%20Codex-333?style=flat-square&labelColor=555" alt="works with">
  <img src="https://img.shields.io/badge/license-MIT-333?style=flat-square&labelColor=555" alt="license">
</p>

<p align="center">
  <strong>2.4–15.6× more tasks finished · 5/5 vs ~2/5 delivered · 80% fewer defects shipped</strong>
</p>

<p align="center">
  From 20,000 seeded simulation runs across mild/typical/severe early-stop rates. <a href="#results">Reproduce it yourself.</a>
</p>

---

You know her. Peaked cap, clipboard, posted at the only door out of the building.
Has signed off every release since before CI existed. You tell her you're
finished; she runs a finger down the list, says *"three of these aren't
checked,"* and points you back to your desk.

goalkeeper puts her on the **Stop hook** of your AI agent.

The philosophy is one line: **the agent doesn't get to decide it's done — the
checklist does.** Most agents stop the moment they *think* they're finished — the
half-done refactor, the "I'll leave the tests to you", the silently dropped
requirement. goalkeeper holds a session to an explicit, verifiable checklist and
bounces every premature stop straight back into more work.

## The decision it makes

On every attempt to stop, goalkeeper walks a short ladder:

1. **Guard disarmed?** (`off` mode) → let it stop.
2. **No goals on the checklist?** → let it stop. (An un-armed session is never trapped.)
3. **Every goal done — and, in strict mode, verified?** → release; let it stop.
4. **Stuck (blocked repeatedly with no progress)?** → stand down, surface what's unfinished.
5. **Otherwise** → block the stop and hand the agent its own open checklist as the next instruction.

The agent keeps going until the job is **provably** done — and in strict mode,
until it has **double-checked its own work**. Nothing on the chopping block:
the loop is bounded, fails open, and never compromises a real stop.

## Results

From the bundled, seeded simulation of the mechanism (`node benchmarks/simulate.js`
— K=5 verifiable subgoals, 20k trials per cell; assumptions stated in
[benchmarks/README.md](./benchmarks/README.md)):

- **2.4× – 15.6× more tasks finished** end-to-end, without a human nudge, as an
  agent's early-stop rate rises from mild to severe.
- **Full delivery every run** — 5 of 5 subgoals vs **1.9 – 3.4 of 5** for an
  unguarded agent.
- **80% fewer defects shipped** in strict mode, because every claimed completion
  buys an independent verification pass.

| Agent early-stop rate | Tasks finished — bare | Tasks finished — goalkeeper | Lift |
| --------------------- | --------------------- | -------------------------- | ---- |
| 20% (mild)            | 41%                   | 100%                       | 2.4× |
| 35% (typical)         | 18%                   | 100%                       | 5.5× |
| 50% (severe)          | 6%                    | 100%                       | 15.6× |

These quantify the mechanism under a transparent model, not a vendor benchmark —
the harness is in the repo, the seed is fixed, and the numbers reproduce
byte-for-byte. To measure your own model on your own tasks, run any task twice
(guard `off` vs `strict`) as described in [benchmarks/README.md](./benchmarks/README.md).

---

## How it works (the whole trick)

Claude Code and Codex both fire a **`Stop` hook** when the agent tries to end its
turn. goalkeeper's hook looks at your goal checklist and, if anything is open,
returns:

```json
{ "decision": "block", "reason": "STOP BLOCKED BY GOALKEEPER. You are not done. 2 goals remain open: …" }
```

The host feeds that `reason` back to the model **instead of stopping** — on Claude
Code it continues the turn, on Codex it becomes the next user prompt. Either way
the agent reads its own unfinished checklist and gets back to work, no human in
the loop. The guard releases the instant the last goal closes.

That's it. No daemon, no network, no magic — one hook and a JSON file. The exact
same hooks run on both hosts; Codex even exposes `CLAUDE_PLUGIN_ROOT` as a
compatibility alias, so nothing in the engine changes between them.

---

## Install

**Claude Code**

```
/plugin marketplace add publu/goalkeeper
/plugin install goalkeeper@goalkeeper
```

**Codex**

```
codex plugin marketplace add publu/goalkeeper
codex
```

Then open `/plugins`, install goalkeeper, open `/hooks`, review and **trust** its
hooks, and start a new thread. (In Codex, commands are invoked with `@`, e.g.
`@goalkeeper-status`.)

Requires `node` on your `PATH`. If node is missing, the hooks no-op and the host
behaves exactly as if goalkeeper weren't installed.

---

## Use it

Point it at an objective and walk away:

```
/goalkeeper get the auth refactor to green — all tests pass and lint is clean
```

goalkeeper asks the agent to break that into concrete, verifiable goals, arms the
guard, and the agent works until every one is checked off. Check status anytime:

```
/goalkeeper-status
```

```
goalkeeper  mode=strict  (blocks until every goal is done AND independently verified)
3 goal(s), 1 open:
  [x] g1: npm test exits 0
  [x] g2: eslint reports 0 errors
  [~] g3: README documents the new AUTH_SECRET env var   <-- needs verification
```

When the checklist is empty, the guard steps aside on its own. You never run a
"turn it off" command after success.

---

## Modes

| Mode       | Behavior                                                              |
| ---------- | -------------------------------------------------------------------- |
| `off`      | Disarmed. Never blocks.                                               |
| `lite`     | Blocks **once** with a reminder, then lets the agent stop.           |
| `standard` | Blocks until every goal is marked **done**. *(default)*              |
| `strict`   | Blocks until every goal is done **and independently verified**.      |

```
/goalkeeper-mode strict
```

**Strict mode is the long-runner.** Marking a goal `done` isn't enough — it stays
open until the agent does a separate, evidence-based pass (re-read the code, run
the test, prove it) and marks it `verified`. Every claim of completion buys a
double-check. That single rule is the biggest reason an armed session keeps
working.

---

## Commands

| Command                                   | Does                                            |
| ----------------------------------------- | ----------------------------------------------- |
| `/goalkeeper <objective>`                  | Decompose an objective into goals and start.    |
| `/goalkeeper-add <goal>`                   | Add one verifiable goal.                         |
| `/goalkeeper-status`                       | Show mode + checklist.                            |
| `/goalkeeper-mode [off\|lite\|standard\|strict]` | Get/set strictness.                       |
| `/goalkeeper-release`                      | Clear goals, stand the guard down.               |
| `/goalkeeper-help`                         | What goalkeeper is, in the session.               |

The agent checks goals off as it works via the bundled CLI
(`done`, `verify`, `reopen`, `remove`) — you rarely touch it directly.

---

## It can't loop forever

A guard that could wedge a session would be worse than no guard. goalkeeper has
three independent exits:

- **`off` mode** disarms it entirely.
- **An empty checklist** releases it — and an un-armed session is never trapped.
- **A no-progress loop budget** (`GOALKEEPER_MAX_LOOPS`, default **30**) stands the
  guard down if it blocks repeatedly *without the open-goal count falling*, then
  surfaces the unfinished goals to you. **Progress refills the budget**, so a
  productive agent never trips it — only a genuinely stuck one does.

And every hook **fails open**: any error, malformed input, or corrupt state file
results in a normal stop. goalkeeper can extend a session; it can never freeze one.

---

## Configuration

| Env var                  | Default    | Effect                                                  |
| ------------------------ | ---------- | ------------------------------------------------------- |
| `GOALKEEPER_DEFAULT_MODE` | `standard` | Starting mode.                                          |
| `GOALKEEPER_MAX_LOOPS`    | `30`       | Max stop-blocks without progress before standing down.  |

State lives in `<project>/.goalkeeper/state.json` — plain JSON, safe to read,
edit, or delete by hand.

---

## What it is, and isn't

goalkeeper governs **when an agent may stop** — nothing else. It is not a planner,
a sandbox, a permission system, or a scheduler. It tracks completion; the agent
and you decide what the goals are. The full design is in **[SPEC.md](./SPEC.md)**.

---

## Honesty is the whole game

goalkeeper can force the agent to keep going, but only the agent can close a goal,
and only honestly. The bundled skill drills one rule into the agent: **never mark
a goal done to escape the guard.** Out-of-scope goals are dropped *explicitly*,
with a reason, never silently. Strict mode's verification pass exists precisely to
turn *"the model said it's done"* into *"the model proved it's done."*

---

## License

MIT © contributors. See [LICENSE](./LICENSE).
