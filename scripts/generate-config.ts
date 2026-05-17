import * as fs from 'fs';
import * as path from 'path';
import Variables from '../src/Helpers/Variables';

const variables: Record<string, number> = {};
for (const key of Object.keys(Variables)) {
  const value = (Variables as unknown as Record<string, unknown>)[key];
  if (typeof value === 'number') {
    variables[key] = value;
  }
}

const config = {
  simulation: { persons: 100, ticks: 100, seed: 42 },
  variables,
};

const outPath = path.resolve(__dirname, '..', 'config.default.json');
fs.writeFileSync(outPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
console.log(`Written: ${outPath}`);
