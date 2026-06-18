# benchmarks & conformance

## Conformance suite

`conformance.test.js` exercises every item in [SPEC.md §12](../SPEC.md#12-conformance-checklist)
against the real hooks — no mocks, no dependencies. It drives the actual
`goalguard-stop.js` and `goalguard-cli.js` over a throwaway state dir and
asserts the decision (`block` vs allow) for each mode and edge case.

```bash
node benchmarks/conformance.test.js
```

Expected: `14 passed, 0 failed`. Run it in CI with `--strict` plugin validation
to catch regressions in the decision core.

## On the "10x longer" claim

goalguard's headline effect — sessions that run much longer and finish much more
— is a property of *your* tasks and model, not a fixed multiplier, so we don't
ship a fabricated number. The mechanism that produces it is concrete and
measurable on your own work:

1. **Every natural stop is intercepted** while goals remain open, so the agent
   resumes instead of handing a half-done task back to you.
2. **Strict mode buys a verification pass per goal**, converting "said it's done"
   into "proved it's done" — the single biggest driver of additional, useful
   work per session.

To measure it on a task of your own, run it twice (guard `off` vs `strict`) and
compare goals-completed-without-human-intervention and total tool calls per
session. That apples-to-apples local comparison is the honest benchmark; a
canned cross-model table would not generalize to your repo.
