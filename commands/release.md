---
description: Release goalkeeper — clear all goals so the session can stop freely.
---

The user wants to stand the guard down. Clear every goal:

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/goalkeeper-cli.js" release
```

Confirm that goalkeeper is now idle and will no longer block stopping. Note that
goals you have not finished will simply be dropped — mention any that were still
open so nothing is silently lost.
