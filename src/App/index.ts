import LooperSingleton from './LooperSingleton';
import { formatEndReport } from '../Helpers/Reporters';
import { writeReportHTML } from '../Helpers/ReportWriter';

const N = 100;
const TICKS = 100;
const SEED = 42;

const looper = LooperSingleton.getInstance();
const simulation = looper.start(N, TICKS, SEED);

// eslint-disable-next-line no-console
console.log(formatEndReport(
  simulation.decadeHistory,
  TICKS,
  SEED,
  N,
  simulation.naturalResources,
  simulation.naturalResourceCeiling,
));

writeReportHTML(simulation, N, TICKS, SEED);