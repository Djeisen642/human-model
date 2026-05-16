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
    const simulation = LooperSingleton.getInstance().start(10, 10, 1, () => {});
    writeReportHTML(simulation, 10, 10, 1, tmpDir);

    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^report-1-.+\.html$/);
  });

  it('creates a self-contained HTML file with Chart.js script tag and embedded data', () => {
    const simulation = LooperSingleton.getInstance().start(10, 10, 1, () => {});
    writeReportHTML(simulation, 10, 10, 1, tmpDir);

    const filename = fs.readdirSync(tmpDir)[0];
    const content = fs.readFileSync(path.join(tmpDir, filename), 'utf8');

    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('chart.js');
    expect(content).toContain('"seed":1');
    expect(content).toContain('<canvas');
  });

  it('creates the output directory if it does not exist', () => {
    const nestedDir = path.join(tmpDir, 'nested', 'output');
    const simulation = LooperSingleton.getInstance().start(10, 10, 2, () => {});
    writeReportHTML(simulation, 10, 10, 2, nestedDir);

    expect(fs.existsSync(nestedDir)).toBe(true);
  });
});
