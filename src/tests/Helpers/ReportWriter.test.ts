import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import LooperSingleton from '../../App/LooperSingleton';
import { writeReportHTML } from '../../Helpers/ReportWriter';

describe('writeReportHTML', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-model-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('writes an HTML file to the output directory', () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const simulation = LooperSingleton.getInstance().start(10, 10, 1, () => {});
      writeReportHTML(simulation, 10, 10, 1);

      const outputDir = path.join(tmpDir, 'output');
      expect(fs.existsSync(outputDir)).toBe(true);

      const files = fs.readdirSync(outputDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^report-1-.+\.html$/);
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('creates a self-contained HTML file with Chart.js script tag and embedded data', () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const simulation = LooperSingleton.getInstance().start(10, 10, 1, () => {});
      writeReportHTML(simulation, 10, 10, 1);

      const outputDir = path.join(tmpDir, 'output');
      const filename = fs.readdirSync(outputDir)[0];
      const content = fs.readFileSync(path.join(outputDir, filename), 'utf8');

      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('chart.js');
      expect(content).toContain('"seed":1');
      expect(content).toContain('<canvas');
    } finally {
      process.cwd = originalCwd;
    }
  });

  it('creates the output directory if it does not exist', () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const simulation = LooperSingleton.getInstance().start(10, 10, 2, () => {});
      writeReportHTML(simulation, 10, 10, 2);

      expect(fs.existsSync(path.join(tmpDir, 'output'))).toBe(true);
    } finally {
      process.cwd = originalCwd;
    }
  });
});
