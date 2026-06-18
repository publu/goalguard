---
description: Explain what goalguard is and how to use it.
---

Explain goalguard to the user, concisely:

**goalguard** is a Stop-hook guard for Claude Code. It won't let this session
end until the goals it is holding are provably complete. Every time the agent
tries to stop, goalguard re-injects the unfinished checklist as the next
instruction — so the agent keeps working instead of quitting early.

**Commands**
- `/goalguard <objective>` — decompose an objective into goals and start working
- `/goalguard-add <goal>` — add one verifiable goal
- `/goalguard-status` — show mode and checklist
- `/goalguard-mode [off|lite|standard|strict]` — get/set strictness
- `/goalguard-release` — clear all goals and stand the guard down
- `/goalguard-help` — this message

**Modes:** off (disarmed) · lite (one nudge) · standard (until done) ·
strict (until done **and** independently verified).

**Config (env):** `GOALGUARD_DEFAULT_MODE` sets the starting mode;
`GOALGUARD_MAX_LOOPS` (default 30) caps continuations without progress so it
can never loop forever.

**The agent keeps the loop honest** by checking goals off as it finishes them:
`done <id>`, and in strict mode `verify <id>` once there's proof.
