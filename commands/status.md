---
description: Show goalkeeper's current mode and the open/closed goal checklist.
---

Run and report the result to the user verbatim:

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/goalkeeper-cli.js" status
```

Then, in one line, say whether the guard is currently armed (it blocks stopping
when mode is not `off` and at least one goal is open).
