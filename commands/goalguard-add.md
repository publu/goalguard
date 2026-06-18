---
description: Add one verifiable goal to goalguard's checklist.
argument-hint: <goal text>
---

Add this goal to goalguard, rephrasing it first if needed so it is concrete and
independently verifiable:

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/goalguard-cli.js" add "$ARGUMENTS"
```

Report the new goal id, then continue working toward it.
