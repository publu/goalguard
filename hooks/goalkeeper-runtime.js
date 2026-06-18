'use strict';

/**
 * goalkeeper-runtime.js
 *
 * Shared state + helpers for every goalkeeper hook and the CLI.
 *
 * State is project-scoped and lives in `<project>/.goalkeeper/state.json`.
 * One project = one active goal set. Concurrent sessions on the same
 * project share the same goals, which is exactly what you want: "don't
 * stop working on THIS project until these goals are done."
 *
 * The file is plain JSON and safe to read, edit, or delete by hand.
 */

const fs = require('fs');
const path = require('path');

const VERSION = '0.1.0';
const VALID_MODES = ['off', 'lite', 'standard', 'strict'];
const DEFAULT_MODE = 'standard';
const DEFAULT_MAX_LOOPS = 30;

/** Resolve the project directory goalkeeper is guarding. */
function projectDir(input) {
  return (
    process.env.CLAUDE_PROJECT_DIR ||
    (input && input.cwd) ||
    process.env.GOALKEEPER_DIR ||
    process.cwd()
  );
}

function stateDir(dir) {
  return path.join(dir || projectDir(), '.goalkeeper');
}

function statePath(dir) {
  return path.join(stateDir(dir), 'state.json');
}

function envMode() {
  const m = String(process.env.GOALKEEPER_DEFAULT_MODE || '').toLowerCase();
  return VALID_MODES.includes(m) ? m : DEFAULT_MODE;
}

function maxLoops() {
  const n = parseInt(process.env.GOALKEEPER_MAX_LOOPS || '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_LOOPS;
}

/** Fresh, valid, empty state. */
function blankState() {
  return {
    version: VERSION,
    mode: envMode(),
    goals: [],
    iterations: 0,
    lastOpen: 0,
    updated: new Date().toISOString(),
  };
}

/** Read state, tolerating a missing or corrupt file. Never throws. */
function readState(dir) {
  try {
    const data = JSON.parse(fs.readFileSync(statePath(dir), 'utf8'));
    if (!Array.isArray(data.goals)) data.goals = [];
    if (!VALID_MODES.includes(data.mode)) data.mode = envMode();
    if (typeof data.iterations !== 'number') data.iterations = 0;
    if (typeof data.lastOpen !== 'number') data.lastOpen = 0;
    return data;
  } catch {
    return blankState();
  }
}

/** Write state atomically-ish (tmp + rename) so a crash can't truncate it. */
function writeState(dir, state) {
  const d = stateDir(dir);
  fs.mkdirSync(d, { recursive: true });
  state.updated = new Date().toISOString();
  const target = statePath(dir);
  const tmp = target + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, target);
}

/** Next goal id, monotonic: g1, g2, ... */
function nextId(goals) {
  let max = 0;
  for (const g of goals) {
    const n = parseInt(String(g.id).replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return 'g' + (max + 1);
}

/** Find a goal by id, accepting "g3" or "3". */
function findGoal(goals, id) {
  const norm = (x) => String(x).replace(/[^0-9]/g, '');
  return goals.find((g) => norm(g.id) === norm(id));
}

/**
 * A goal is "open" (blocks stopping) when it is not done, or — in strict
 * mode — done but not yet independently verified.
 */
function isOpen(goal, mode) {
  if (goal.done !== true) return true;
  if (mode === 'strict' && goal.verified !== true) return true;
  return false;
}

function openGoals(goals, mode) {
  return goals.filter((g) => isOpen(g, mode));
}

module.exports = {
  VERSION,
  VALID_MODES,
  DEFAULT_MODE,
  DEFAULT_MAX_LOOPS,
  projectDir,
  stateDir,
  statePath,
  envMode,
  maxLoops,
  blankState,
  readState,
  writeState,
  nextId,
  findGoal,
  isOpen,
  openGoals,
};
