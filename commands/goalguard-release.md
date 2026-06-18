---
description: Release goalguard — clear all goals so the session can stop freely.
---

The user wants to stand the guard down. Clear every goal:

```
node "${CLAUDE_PLUGIN_ROOT}/hooks/goalguard-cli.js" release
```

Confirm that goalguard is now idle and will no longer block stopping. Note that
goals you have not finished will simply be dropped — mention any that were still
open so nothing is silently lost.
