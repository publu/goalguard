# benchmarks & conformance

## Conformance suite

`conformance.test.js` exercises every item in [SPEC.md §12](../SPEC.md#12-conformance-checklist)
against the real hooks — no mocks, no dependencies. It drives the actual
`goalkeeper-stop.js` and `goalkeeper-cli.js` over a throwaway state dir and
asserts the decision (`block` vs allow) for each mode and edge case.

```bash
node benchmarks/conformance.test.js
```

Expected: `14 passed, 0 failed`. Run it in CI with `--strict` plugin validation
to catch regressions in the decision core.

## Effect simulation

`simulate.js` quantifies what goalkeeper mechanically does — intercept premature
stops and (in strict mode) verify each claimed completion — with a transparent,
seeded Monte-Carlo model. No vendor model is invoked or implied; the point is a
reproducible measurement of the *mechanism*, with every assumption on the table.

```bash
node benchmarks/simulate.js          # human-readable
node benchmarks/simulate.js --json   # machine-readable
```

### Model

A task is **K = 5** independent, verifiable subgoals, worked one at a time:

| Parameter | Value | Meaning                                                              |
| --------- | ----- | ------------------------------------------------------------------- |
| `pStop`   | swept | chance the agent quits early at any checkpoint before the last goal |
| `pDefect` | 0.25  | chance a delivered subgoal is wrong but claimed done                |
| `pCatch`  | 0.80  | chance strict-mode verification catches a given defect (then fixed) |
| trials    | 20000 | per cell                                                            |
| seed      | fixed | `mulberry32(0xC0FFEE)` — runs reproduce byte-for-byte               |

**Conditions:** `bare` (no guard), `standard` (blocks early stops; all K
delivered), `strict` (all K delivered **plus** a verification pass).

The early-stop rate is swept across **20% (mild), 35% (typical), 50% (severe)**.

### Results (from the committed seed)

**Task completion** — all subgoals delivered with no human nudge:

| early-stop | bare | goalkeeper | lift  |
| ---------- | ---- | --------- | ----- |
| 20%        | 41%  | 100%      | 2.4×  |
| 35%        | 18%  | 100%      | 5.5×  |
| 50%        | 6%   | 100%      | 15.6× |

**Subgoals delivered** (of 5): bare **3.38 / 2.54 / 1.94** vs goalkeeper **5.00**.

**Defects shipped per task:** strict-mode verification cuts escaped defects by
**~80%** (1.24 → 0.25) across every early-stop rate.

### What this is and isn't

This is a measurement of the mechanism under a stated model — honest *because*
its assumptions are explicit and it reproduces exactly. It is **not** a claim
about any specific LLM. To measure your own model on your own tasks, run a real
multi-step task twice — guard `off`, then guard `strict` — and compare:

1. subgoals completed without human intervention,
2. defects/regressions found on review,
3. total tool calls per session.

That apples-to-apples local comparison is the benchmark that generalizes to your
repo; the simulation tells you the shape of the win to expect.
