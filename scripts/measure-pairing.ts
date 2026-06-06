/**
 * Measures pairing prevalence across ticks and seeds.
 * Drives the simulation loop directly (mirrors LooperSingleton) so we can
 * sample isInRelationshipWith counts each tick without modifying snapshots.
 *
 * Usage: npx ts-node scripts/measure-pairing.ts [--seeds N] [--ticks N] [--persons N]
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

// per-tick sample: {tick, population, pairedCount}
interface Sample { tick: number; population: number; paired: number; seed: number; }

const samples: Sample[] = [];

for (let seed = 1; seed <= NUM_SEEDS; seed++) {
  const rng = new SeededRandom(seed).asRNG();
  const simulation = new Simulation();
  simulation.seed(PERSONS, rng);
  const factory = new EventFactory(rng);
  const disaster = new DisasterEvent(rng);

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

    const afterLiving = simulation.getLiving();
    const paired = afterLiving.filter(p => p.isInRelationshipWith !== null).length;
    samples.push({ tick: t, population: afterLiving.length, paired, seed });
  }
}

// --- Analysis ---

// 1. Average pairing fraction by decade bucket (across all seeds)
const byDecade: Record<number, number[]> = {};
for (const s of samples) {
  const bucket = Math.floor(s.tick / 50) * 50;
  if (!byDecade[bucket]) byDecade[bucket] = [];
  if (s.population > 0) byDecade[bucket].push(s.paired / s.population);
}

console.log('\n=== Avg paired fraction by tick range (all seeds) ===');
console.log('Ticks   | AvgPaired% | N samples');
for (const [bucket, vals] of Object.entries(byDecade).sort((a, b) => +a[0] - +b[0])) {
  const avg = vals.reduce((a, v) => a + v, 0) / vals.length;
  console.log(`${String(bucket).padStart(4)}–${String(+bucket + 49).padEnd(4)} |   ${(avg * 100).toFixed(1).padStart(5)}%   | ${vals.length}`);
}

// 2. Overall average across all ticks
const allFracs = samples.filter(s => s.population > 0).map(s => s.paired / s.population);
const overallAvg = allFracs.reduce((a, v) => a + v, 0) / allFracs.length;
console.log(`\nOverall avg paired fraction: ${(overallAvg * 100).toFixed(1)}%`);

// 3. Pairing at low population (< 20 persons) — crash/recovery regime
const lowPop = samples.filter(s => s.population > 0 && s.population < 20);
if (lowPop.length > 0) {
  const lowAvg = lowPop.reduce((a, s) => a + s.paired / s.population, 0) / lowPop.length;
  console.log(`Avg paired fraction when population < 20: ${(lowAvg * 100).toFixed(1)}% (${lowPop.length} ticks)`);
}

// 4. How many seeds hit zero population?
const extinctSeeds = new Set(samples.filter(s => s.population === 0).map(s => s.seed)).size;
// seeds that ran at all
const activeSeeds = new Set(samples.map(s => s.seed)).size;
console.log(`\nExtinction: ${extinctSeeds}/${activeSeeds} seeds went extinct within ${TICKS} ticks`);
