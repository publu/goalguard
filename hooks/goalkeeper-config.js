'use strict';

/**
 * goalkeeper-config.js
 *
 * Every piece of natural-language that goalkeeper injects back into the
 * agent lives here. The Stop reason is the load-bearing wall of the whole
 * project: it is the text the model is forced to read instead of stopping.
 */

const CLI = 'node "${CLAUDE_PLUGIN_ROOT}/hooks/goalkeeper-cli.js"';

const MODE_BLURB = {
  off: 'disarmed — goalkeeper will not block stopping',
  lite: 'one nudge — blocks once, then lets you stop',
  standard: 'blocks until every goal is marked done',
  strict: 'blocks until every goal is done AND independently verified',
};

/** Render the checklist with status boxes. */
function renderGoals(goals, mode) {
  if (!goals.length) return '  (no goals recorded)';
  return goals
    .map((g) => {
      let box = '[ ]';
      if (g.done && g.verified) box = '[x]';
      else if (g.done) box = mode === 'strict' ? '[~]' : '[x]';
      let tag = '';
      if (g.done && mode === 'strict' && !g.verified) tag = '   <-- needs verification';
      return `  ${box} ${g.id}: ${g.text}${tag}`;
    })
    .join('\n');
}

/** Context injected at SessionStart / on each prompt: keeps goals in view. */
function reminder(state) {
  const open = state.goals.filter((g) =>
    g.done !== true || (state.mode === 'strict' && g.verified !== true)
  );
  if (state.mode === 'off' || state.goals.length === 0) return '';
  return [
    `[goalkeeper:${state.mode}] ${open.length} of ${state.goals.length} goal(s) still open. goalkeeper will not let this session stop until they are resolved.`,
    renderGoals(state.goals, state.mode),
    `Update progress as you go: \`${CLI} done <id>\`` +
      (state.mode === 'strict' ? `, then \`${CLI} verify <id>\` once you have proof.` : '.'),
  ].join('\n');
}

/**
 * The one-time scope check, issued the first time every goal reads as done.
 * Self-marked goals are an honor-system checkbox: an agent can narrow "the
 * website" to one page, tick the box, and walk. This forces it to restate
 * each goal's ORIGINAL scope and reopen anything it quietly shrank — exactly
 * once. The Stop hook releases on the next attempt regardless, so this can
 * never loop.
 */
function scopeChallenge(goals, mode) {
  return [
    'SCOPE CHECK BEFORE GOALKEEPER RELEASES. Every goal is marked done — confirm you did the WHOLE thing, not a convenient slice of it.',
    '',
    'For each goal below, restate its original scope in one line, then answer honestly: did you complete that full scope, or did you narrow / reinterpret / sample it to make it finishable?',
    renderGoals(goals, mode),
    '',
    '  - If you silently shrank any goal (one page of many, the happy path only, a stub where real work was asked), REOPEN it now: `' + CLI + ' reopen <id>` and finish the real scope.',
    '  - If a goal is genuinely narrower than its words by an explicit earlier decision, say so in one sentence so the user can see the call you made.',
    '  - If every goal truly meets its full original scope, stop normally — goalkeeper will release you and will not ask again.',
  ].join('\n');
}

/** Shown (without blocking) when the loop budget is spent — the safety rail. */
function budgetExhausted(open, mode, max) {
  return [
    `[goalkeeper] Loop budget exhausted (${max} continuations without progress).`,
    `${open.length} goal(s) are still open but goalkeeper is standing down to avoid an infinite loop:`,
    renderGoals(open, mode),
    `Tell the user these are unfinished, or raise the budget with GOALKEEPER_MAX_LOOPS and try again.`,
  ].join('\n');
}

/**
 * THE continuation directive. Returned as the Stop hook's `reason`, which
 * Claude Code feeds back to the model in place of letting it stop.
 *
 * It does three things, in order: (1) refuse the stop, (2) re-state the
 * exact unfinished goals, (3) demand the next concrete action — and in
 * strict mode, demand independent verification with evidence.
 */
function stopReason(open, mode, iteration, max) {
  const lines = [];
  lines.push('STOP BLOCKED BY GOALKEEPER. You are not done.');
  lines.push('');
  lines.push(
    `You set out to complete these goals and ${open.length} remain open (${mode} mode, continuation ${iteration}/${max}):`
  );
  lines.push(renderGoals(open, mode));
  lines.push('');

  const notDone = open.filter((g) => g.done !== true);
  const unverified = open.filter((g) => g.done === true && g.verified !== true);

  if (notDone.length) {
    lines.push('For each goal that is NOT yet done:');
    lines.push('  1. Do the smallest next real action that moves it forward — edit code, run the command, write the test. Do not summarize, do not ask permission, just continue.');
    lines.push('  2. When (and only when) it is genuinely finished, record it: `' + CLI + ' done <id>`.');
  }

  if (mode === 'strict' && unverified.length) {
    lines.push('');
    lines.push('For each goal marked done but NOT yet verified, DOUBLE-CHECK it independently before it counts:');
    lines.push('  - Re-read the produced code/output with fresh eyes, or run the test/build/command that proves it works.');
    lines.push('  - Confirm it actually satisfies the goal as originally stated — not a near-miss, not a stub, not a TODO.');
    lines.push('  - Only after you have concrete evidence: `' + CLI + ' verify <id>`.');
    lines.push('  - If the double-check fails, reopen it: `' + CLI + ' reopen <id>` and fix it.');
  }

  lines.push('');
  lines.push('Rules: keep working until the checklist is empty. Do not stop to report progress — goalkeeper will release you automatically the moment every goal is resolved. If a goal is genuinely impossible or out of scope, drop it explicitly with `' + CLI + ' remove <id>` and say why; never silently abandon it.');
  return lines.join('\n');
}

module.exports = {
  CLI,
  MODE_BLURB,
  renderGoals,
  reminder,
  scopeChallenge,
  budgetExhausted,
  stopReason,
};
