---
description: Get or set goalkeeper's mode (off | lite | standard | strict).
argument-hint: [off|lite|standard|strict]
---

Run the following. With no argument it prints the current mode; with an argument
it sets it.

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/goalkeeper-cli.js" mode $ARGUMENTS
```

Modes:
- **off** — disarmed; goalkeeper never blocks stopping.
- **lite** — blocks once with a reminder, then lets you stop.
- **standard** — blocks until every goal is marked done.
- **strict** — blocks until every goal is done AND independently verified.

Report the result.
