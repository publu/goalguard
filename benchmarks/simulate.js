#!/usr/bin/env node
'use strict';

/**
 * goalkeeper effect simulation.
 *
 * goalkeeper's value is mechanical and measurable: it intercepts premature
 * stops, and (in strict mode) forces a verification pass over each claimed
 * completion. This harness quantifies both effects with a transparent,
 * seeded Monte-Carlo model so the numbers are exactly reproducible and the
 * assumptions are explicit — no vendor model is invoked or implied.
 *
 *   node benchmarks/simulate.js            # default sweep
 *   node benchmarks/simulate.js --json     # machine-readable
 *
 * MODEL (stated assumptions)
 * --------------------------
 * A task is K independent, verifiable subgoals worked one at a time.
 *   pStop   = chance the agent declares "done" at any checkpoint before the
 *             last subgoal (i.e. quits early).
 *   pDefect = chance a delivered subgoal is wrong but claimed done.
 *   pCatch  = chance strict-mode verification catches a given defect (then it
 *             is reopened and fixed).
 *
 * Conditions
 *   bare      : no guard. Early stops ship a partial task; defects ship.
 *   standard  : guard blocks every early stop while subgoals remain open, so
 *               all K are delivered. Defects still ship (no verify pass).
 *   strict    : as standard, plus a verification pass that removes a pCatch
 *               fraction of defects before they ship.
 */

// ---- seeded RNG (mulberry32) so runs are byte-for-byte reproducible -------
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate({ K, pStop, pDefect, pCatch, trials, seed }) {
  const rand = rng(seed);
  const acc = {
    bare: { completed: 0, delivered: 0, escaped: 0 },
    standard: { completed: 0, delivered: 0, escaped: 0 },
    strict: { completed: 0, delivered: 0, escaped: 0 },
  };

  for (let t = 0; t < trials; t++) {
    // How many subgoals a bare agent delivers before quitting early.
    let bareDelivered = K;
    for (let i = 1; i < K; i++) {
      if (rand() < pStop) {
        bareDelivered = i;
        break;
      }
    }

    // Defects among delivered subgoals (drawn per delivered subgoal, capped).
    const defectsIn = (n) => {
      let d = 0;
      for (let i = 0; i < n; i++) if (rand() < pDefect) d++;
      return d;
    };

    // bare: ships whatever it delivered, defects and all.
    const bareDefects = defectsIn(bareDelivered);
    acc.bare.delivered += bareDelivered;
    acc.bare.escaped += bareDefects;
    if (bareDelivered === K) acc.bare.completed++;

    // standard: guard forces all K; defects still ship.
    const stdDefects = defectsIn(K);
    acc.standard.delivered += K;
    acc.standard.escaped += stdDefects;
    acc.standard.completed++;

    // strict: all K delivered, verification removes a pCatch fraction.
    let strictEscaped = 0;
    for (let i = 0; i < K; i++) {
      if (rand() < pDefect && rand() >= pCatch) strictEscaped++;
    }
    acc.strict.delivered += K;
    acc.strict.escaped += strictEscaped;
    acc.strict.completed++;
  }

  const norm = (c) => ({
    completionRate: c.completed / trials,
    meanDelivered: c.delivered / trials,
    escapedPerTask: c.escaped / trials,
  });
  return { bare: norm(acc.bare), standard: norm(acc.standard), strict: norm(acc.strict) };
}

// ---- run the sweep --------------------------------------------------------
const BASE = { K: 5, pDefect: 0.25, pCatch: 0.8, trials: 20000, seed: 0xC0FFEE };
const SWEEP = [0.2, 0.35, 0.5]; // early-stop rates: mild, typical, severe

const rows = SWEEP.map((pStop) => ({ pStop, ...simulate({ ...BASE, pStop }) }));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ params: BASE, sweep: rows }, null, 2));
  process.exit(0);
}

const pct = (x) => (x * 100).toFixed(0) + '%';
const f2 = (x) => x.toFixed(2);

console.log(`goalkeeper effect simulation`);
console.log(
  `params: K=${BASE.K} subgoals, pDefect=${BASE.pDefect}, pCatch=${BASE.pCatch}, ` +
    `trials=${BASE.trials} per cell, seed=0x${BASE.seed.toString(16)}\n`
);

console.log('Task completion (all subgoals delivered, no human nudge)');
console.log('  early-stop |   bare  | goalkeeper | lift');
for (const r of rows) {
  const lift = (r.standard.completionRate / r.bare.completionRate).toFixed(1);
  console.log(
    `     ${pct(r.pStop).padStart(4)}    |  ${pct(r.bare.completionRate).padStart(4)}  ` +
      `|   ${pct(r.standard.completionRate).padStart(4)}    | ${lift}x`
  );
}

console.log('\nSubgoals delivered per task (of ' + BASE.K + ')');
console.log('  early-stop |  bare  | goalkeeper');
for (const r of rows) {
  console.log(
    `     ${pct(r.pStop).padStart(4)}    | ${f2(r.bare.meanDelivered)}  |   ${f2(r.standard.meanDelivered)}`
  );
}

console.log('\nDefects shipped per task   (bare/standard vs strict verification)');
console.log('  early-stop | no-verify | strict | reduction');
for (const r of rows) {
  const red = pct(1 - r.strict.escapedPerTask / r.standard.escapedPerTask);
  console.log(
    `     ${pct(r.pStop).padStart(4)}    |   ${f2(r.standard.escapedPerTask)}    | ` +
      ` ${f2(r.strict.escapedPerTask)}  |   ${red}`
  );
}

console.log(
  '\nReproduce: `node benchmarks/simulate.js`. These quantify the mechanism' +
    '\nunder the stated model; measure your own model/tasks per benchmarks/README.md.'
);
