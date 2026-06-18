---
description: Explain what goalkeeper is and how to use it.
---

Explain goalkeeper to the user, concisely:

**goalkeeper** is a Stop-hook guard for Claude Code. It won't let this session
end until the goals it is holding are provably complete. Every time the agent
tries to stop, goalkeeper re-injects the unfinished checklist as the next
instruction — so the agent keeps working instead of quitting early.

**Commands**
- `/goalkeeper <objective>` — decompose an objective into goals and start working
- `/goalkeeper-add <goal>` — add one verifiable goal
- `/goalkeeper-status` — show mode and checklist
- `/goalkeeper-mode [off|lite|standard|strict]` — get/set strictness
- `/goalkeeper-release` — clear all goals and stand the guard down
- `/goalkeeper-help` — this message

**Modes:** off (disarmed) · lite (one nudge) · standard (until done) ·
strict (until done **and** independently verified).

**Config (env):** `GOALKEEPER_DEFAULT_MODE` sets the starting mode;
`GOALKEEPER_MAX_LOOPS` (default 30) caps continuations without progress so it
can never loop forever.

**The agent keeps the loop honest** by checking goals off as it finishes them:
`done <id>`, and in strict mode `verify <id>` once there's proof.
