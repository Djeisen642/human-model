/**
 * Diagnose the root cause of population crashes.
 * For each seed: finds the peak, then analyses the 30 ticks around it
 * to understand whether the crash is resource-driven, demographic, or illness-driven.
 * Also tracks age-stratified deaths and population composition to trace the next generation.
 *
 * Usage: npx ts-node scripts/diagnose-crash.ts [--seeds N] [--ticks N]
 */

import Simulation from '../src/App/Simulation';
import SeededRandom from '../src/Helpers/SeededRandom';
import EventFactory from '../src/Events/EventFactory';
import DisasterEvent from '../src/Events/DisasterEvent';
import Variables from '../src/Helpers/Variables';
import { RNG } from '../src/Helpers/Types';

const args = process.argv.slice(2);
const getArg = (flag: string, def: number): number => {
  const i = args.indexOf(flag);
  return i >= 0 ? parseInt(args[i + 1], 10) : def;
};
const NUM_SEEDS = getArg('--seeds', 16);
const TICKS = getArg('--ticks', 500);
const PERSONS = getArg('--persons', 100);

function shuffleInPlace<T>(arr: T[], rng: RNG): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Age bucket boundaries
const CHILD_MAX = Variables.RELATIONSHIP_MIN_AGE;  // 0–15
const YOUNG_MAX = 36;                               // 16–35
const MID_MAX = 56;                                 // 36–55
                                                    // 56+ = elder

interface AgeBuckets {
  child: number;   // 0 – RELATIONSHIP_MIN_AGE-1
  young: number;   // RELATIONSHIP_MIN_AGE – 35
  mid: number;     // 36–55
  elder: number;   // 56+
}

function bucket(age: number): keyof AgeBuckets {
  if (age < CHILD_MAX) return 'child';
  if (age < YOUNG_MAX) return 'young';
  if (age < MID_MAX)   return 'mid';
  return 'elder';
}

interface TickDetail {
  tick: number;
  population: number;
  births: number;
  deathsIllness: number;
  deathsSuicide: number;
  deathsMurder: number;
  deathsDisaster: number;
  avgAge: number;
  avgResources: number;
  naturalResources: number;
  naturalResourceCeiling: number;
  avgIllness: number;
  pairedFraction: number;
  poolFill: number;
  // age-stratified counts
  popByAge: AgeBuckets;
  deathsByAge: AgeBuckets;
}

// Accumulators for aggregation across seeds
const crashWindowStats: TickDetail[] = [];  // ticks near crash (−10 to +10 around peak)
const preCrashStats: TickDetail[] = [];     // ticks 20–10 before peak
const peakPops: number[] = [];
const peakTicks: number[] = [];

// Death cause totals for whole run
let totalIllness = 0, totalSuicide = 0, totalMurder = 0, totalDisaster = 0;

// Age-stratified totals for whole run
const totalDeathsByAge: AgeBuckets = { child: 0, young: 0, mid: 0, elder: 0 };

for (let seed = 1; seed <= NUM_SEEDS; seed++) {
  const rng = new SeededRandom(seed).asRNG();
  const simulation = new Simulation();
  simulation.seed(PERSONS, rng);
  const factory = new EventFactory(rng);
  const disaster = new DisasterEvent(rng);

  const ticks: TickDetail[] = [];

  for (let t = 0; t < TICKS; t++) {
    simulation.degradeCeiling();
    simulation.regenerate();
    disaster.execute(simulation);
    const living = simulation.getLiving();
    if (living.length === 0) break;
    shuffleInPlace(living, rng);
    simulation.collectTax(living);
    for (const person of living) {
      if (person.jailedTicksRemaining > 0) person.jailedTicksRemaining--;
      person.helpHappinessBoost = Math.max(0, person.helpHappinessBoost - Variables.HELP_HAPPINESS_DECAY);
      person.killHappinessBoost = Math.max(0, person.killHappinessBoost - Variables.KILL_HAPPINESS_DECAY);
    }
    for (const person of living) {
      for (const event of factory.getEventsFor(person)) {
        if (person.causeOfDeath !== null) break;
        event.execute(person, simulation);
      }
    }
    simulation.distributeWelfare(simulation.getLiving());
    simulation.snapshot();

    const snap = simulation.history[simulation.history.length - 1];
    const afterLiving = simulation.getLiving();
    const avgAge = afterLiving.length > 0
      ? afterLiving.reduce((s, p) => s + p.age, 0) / afterLiving.length : 0;
    const avgIllness = afterLiving.length > 0
      ? afterLiving.reduce((s, p) => s + p.illness, 0) / afterLiving.length : 0;
    const paired = afterLiving.filter(p => p.isInRelationshipWith !== null).length;
    const pairedFraction = afterLiving.length > 0 ? paired / afterLiving.length : 0;
    const poolFill = snap.naturalResourceCeiling > 0
      ? snap.naturalResources / snap.naturalResourceCeiling : 1;

    // Age-stratified population (post-tick)
    const popByAge: AgeBuckets = { child: 0, young: 0, mid: 0, elder: 0 };
    for (const p of afterLiving) popByAge[bucket(p.age)]++;

    // Age-stratified deaths: persons from pre-tick list who now have causeOfDeath
    const deathsByAge: AgeBuckets = { child: 0, young: 0, mid: 0, elder: 0 };
    for (const p of living) {
      if (p.causeOfDeath !== null) {
        const b = bucket(p.age);
        deathsByAge[b]++;
        totalDeathsByAge[b]++;
      }
    }

    ticks.push({
      tick: t,
      population: snap.population,
      births: snap.births,
      deathsIllness: snap.deathsByIllness,
      deathsSuicide: snap.deathsBySuicide,
      deathsMurder: snap.deathsByMurder,
      deathsDisaster: snap.deathsByDisaster,
      avgAge,
      avgResources: snap.averageResources,
      naturalResources: snap.naturalResources,
      naturalResourceCeiling: snap.naturalResourceCeiling,
      avgIllness,
      pairedFraction,
      poolFill,
      popByAge,
      deathsByAge,
    });

    totalIllness += snap.deathsByIllness;
    totalSuicide += snap.deathsBySuicide;
    totalMurder += snap.deathsByMurder;
    totalDisaster += snap.deathsByDisaster;
  }

  // Find peak population tick
  let peakIdx = 0;
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i].population > ticks[peakIdx].population) peakIdx = i;
  }
  peakPops.push(ticks[peakIdx].population);
  peakTicks.push(ticks[peakIdx].tick);

  // Collect ticks in window around peak
  for (let i = Math.max(0, peakIdx - 10); i <= Math.min(ticks.length - 1, peakIdx + 10); i++) {
    crashWindowStats.push(ticks[i]);
  }
  for (let i = Math.max(0, peakIdx - 20); i < Math.max(0, peakIdx - 10); i++) {
    preCrashStats.push(ticks[i]);
  }
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function fmt(n: number, d = 1): string { return n.toFixed(d); }
function pct(n: number, total: number): string {
  return total > 0 ? `${fmt(100 * n / total)}%` : '—';
}

function reportAgePop(label: string, stats: TickDetail[]): void {
  const total = avg(stats.map(t => t.population));
  const child = avg(stats.map(t => t.popByAge.child));
  const young = avg(stats.map(t => t.popByAge.young));
  const mid   = avg(stats.map(t => t.popByAge.mid));
  const elder = avg(stats.map(t => t.popByAge.elder));
  console.log(`  ${label}`);
  console.log(`    children  (0–${CHILD_MAX - 1}):  ${fmt(child, 1)} (${pct(child, total)})`);
  console.log(`    young     (${CHILD_MAX}–${YOUNG_MAX - 1}): ${fmt(young, 1)} (${pct(young, total)})`);
  console.log(`    mid-age   (${YOUNG_MAX}–${MID_MAX - 1}): ${fmt(mid, 1)} (${pct(mid, total)})`);
  console.log(`    elder     (${MID_MAX}+):  ${fmt(elder, 1)} (${pct(elder, total)})`);
}

function reportAgeDeaths(label: string, stats: TickDetail[]): void {
  const totalD = avg(stats.map(t => t.deathsByAge.child + t.deathsByAge.young + t.deathsByAge.mid + t.deathsByAge.elder));
  const child = avg(stats.map(t => t.deathsByAge.child));
  const young = avg(stats.map(t => t.deathsByAge.young));
  const mid   = avg(stats.map(t => t.deathsByAge.mid));
  const elder = avg(stats.map(t => t.deathsByAge.elder));
  console.log(`  ${label} — ${fmt(totalD, 2)} deaths/tick`);
  console.log(`    children  (0–${CHILD_MAX - 1}):  ${fmt(child, 2)}/tick (${pct(child, totalD)})`);
  console.log(`    young     (${CHILD_MAX}–${YOUNG_MAX - 1}): ${fmt(young, 2)}/tick (${pct(young, totalD)})`);
  console.log(`    mid-age   (${YOUNG_MAX}–${MID_MAX - 1}): ${fmt(mid, 2)}/tick (${pct(mid, totalD)})`);
  console.log(`    elder     (${MID_MAX}+):  ${fmt(elder, 2)}/tick (${pct(elder, totalD)})`);
}

// --- Report ---
console.log('\n=== CRASH DIAGNOSIS ===');
console.log(`Seeds: ${NUM_SEEDS}, Ticks: ${TICKS}, Persons: ${PERSONS}`);
console.log(`\nAvg peak population: ${fmt(avg(peakPops), 0)} at tick ${fmt(avg(peakTicks), 0)}`);

const totalDeaths = totalIllness + totalSuicide + totalMurder + totalDisaster;
console.log('\n--- Death causes across all runs ---');
console.log(`  Illness:  ${totalIllness} (${fmt(100 * totalIllness / totalDeaths)}%)`);
console.log(`  Suicide:  ${totalSuicide} (${fmt(100 * totalSuicide / totalDeaths)}%)`);
console.log(`  Murder:   ${totalMurder} (${fmt(100 * totalMurder / totalDeaths)}%)`);
console.log(`  Disaster: ${totalDisaster} (${fmt(100 * totalDisaster / totalDeaths)}%)`);

const totalDeathsAllAges = totalDeathsByAge.child + totalDeathsByAge.young + totalDeathsByAge.mid + totalDeathsByAge.elder;
console.log('\n--- Age at death across all runs ---');
console.log(`  Children  (0–${CHILD_MAX - 1}):  ${totalDeathsByAge.child} (${pct(totalDeathsByAge.child, totalDeathsAllAges)})`);
console.log(`  Young     (${CHILD_MAX}–${YOUNG_MAX - 1}): ${totalDeathsByAge.young} (${pct(totalDeathsByAge.young, totalDeathsAllAges)})`);
console.log(`  Mid-age   (${YOUNG_MAX}–${MID_MAX - 1}): ${totalDeathsByAge.mid} (${pct(totalDeathsByAge.mid, totalDeathsAllAges)})`);
console.log(`  Elder     (${MID_MAX}+):  ${totalDeathsByAge.elder} (${pct(totalDeathsByAge.elder, totalDeathsAllAges)})`);

console.log('\n--- Pre-crash window (ticks 20–10 before peak) ---');
if (preCrashStats.length > 0) {
  console.log(`  Avg population:     ${fmt(avg(preCrashStats.map(t => t.population)), 0)}`);
  console.log(`  Avg births/tick:    ${fmt(avg(preCrashStats.map(t => t.births)), 2)}`);
  console.log(`  Avg deaths/tick:    ${fmt(avg(preCrashStats.map(t => t.deathsIllness + t.deathsSuicide + t.deathsMurder + t.deathsDisaster)), 2)}`);
  console.log(`    illness:  ${fmt(avg(preCrashStats.map(t => t.deathsIllness)), 2)}`);
  console.log(`    suicide:  ${fmt(avg(preCrashStats.map(t => t.deathsSuicide)), 2)}`);
  console.log(`    murder:   ${fmt(avg(preCrashStats.map(t => t.deathsMurder)), 2)}`);
  console.log(`    disaster: ${fmt(avg(preCrashStats.map(t => t.deathsDisaster)), 2)}`);
  console.log(`  Avg age:            ${fmt(avg(preCrashStats.map(t => t.avgAge)))}`);
  console.log(`  Avg illness:        ${fmt(avg(preCrashStats.map(t => t.avgIllness)), 3)}`);
  console.log(`  Avg resources:      ${fmt(avg(preCrashStats.map(t => t.avgResources)))}`);
  console.log(`  Pool fill:          ${fmt(100 * avg(preCrashStats.map(t => t.poolFill)))}%`);
  console.log(`  Paired fraction:    ${fmt(100 * avg(preCrashStats.map(t => t.pairedFraction)))}%`);
  reportAgePop('Population composition', preCrashStats);
  reportAgeDeaths('Deaths by age', preCrashStats);
}

console.log('\n--- Crash window (±10 ticks around peak) ---');
console.log(`  Avg population:     ${fmt(avg(crashWindowStats.map(t => t.population)), 0)}`);
console.log(`  Avg births/tick:    ${fmt(avg(crashWindowStats.map(t => t.births)), 2)}`);
console.log(`  Avg deaths/tick:    ${fmt(avg(crashWindowStats.map(t => t.deathsIllness + t.deathsSuicide + t.deathsMurder + t.deathsDisaster)), 2)}`);
console.log(`    illness:  ${fmt(avg(crashWindowStats.map(t => t.deathsIllness)), 2)}`);
console.log(`    suicide:  ${fmt(avg(crashWindowStats.map(t => t.deathsSuicide)), 2)}`);
console.log(`    murder:   ${fmt(avg(crashWindowStats.map(t => t.deathsMurder)), 2)}`);
console.log(`    disaster: ${fmt(avg(crashWindowStats.map(t => t.deathsDisaster)), 2)}`);
console.log(`  Avg age:            ${fmt(avg(crashWindowStats.map(t => t.avgAge)))}`);
console.log(`  Avg illness:        ${fmt(avg(crashWindowStats.map(t => t.avgIllness)), 3)}`);
console.log(`  Avg resources:      ${fmt(avg(crashWindowStats.map(t => t.avgResources)))}`);
console.log(`  Pool fill:          ${fmt(100 * avg(crashWindowStats.map(t => t.poolFill)))}%`);
console.log(`  Paired fraction:    ${fmt(100 * avg(crashWindowStats.map(t => t.pairedFraction)))}%`);
reportAgePop('Population composition', crashWindowStats);
reportAgeDeaths('Deaths by age', crashWindowStats);

// Birth deficit analysis
const birthDeficitTicks = crashWindowStats.filter(t => {
  const deaths = t.deathsIllness + t.deathsSuicide + t.deathsMurder + t.deathsDisaster;
  return deaths > t.births;
});
console.log(`\n  Ticks where deaths > births: ${birthDeficitTicks.length} / ${crashWindowStats.length}`);
console.log(`  Avg birth deficit when negative: ${fmt(avg(birthDeficitTicks.map(t => {
  const deaths = t.deathsIllness + t.deathsSuicide + t.deathsMurder + t.deathsDisaster;
  return deaths - t.births;
})), 2)} per tick`);
