/**
 * Diagnose the root cause of population crashes.
 * For each seed: finds the peak, then analyses the 30 ticks around it
 * to understand whether the crash is resource-driven, demographic, or illness-driven.
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
}

// Accumulators for aggregation across seeds
const crashWindowStats: TickDetail[] = [];  // ticks near crash (−10 to +10 around peak)
const preCrashStats: TickDetail[] = [];     // ticks 20–10 before peak
const peakPops: number[] = [];
const peakTicks: number[] = [];

// Death cause totals for whole run
let totalIllness = 0, totalSuicide = 0, totalMurder = 0, totalDisaster = 0;

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
