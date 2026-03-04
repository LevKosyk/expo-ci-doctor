import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export type RunOutcome = 'pass' | 'fail';

export interface HistoryEntry {
  timestamp: string;
  outcome: RunOutcome;
  score: number;
  errorCount: number;
  warnCount: number;
  primaryFailureCategory?: string;
}

export interface StabilityTrend {
  direction: 'Improving' | 'Stable' | 'Degrading' | 'Insufficient data';
  entries: HistoryEntry[];
  recentSymbols: string[];   // e.g. ['✔', '✔', '✖', '✔']
}

// ─── Storage path ────────────────────────────────────────────────────

function getHistoryDir(): string {
  return path.join(os.homedir(), '.expo-ci-doctor');
}

function getHistoryPath(): string {
  return path.join(getHistoryDir(), 'history.json');
}

function readHistory(): HistoryEntry[] {
  const p = getHistoryPath();
  try {
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as HistoryEntry[];
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]): void {
  const dir = getHistoryDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getHistoryPath(), JSON.stringify(entries, null, 2), 'utf-8');
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Record the result of the current check/doctor run.
 * History is capped at 50 entries to keep the file small.
 */
export function recordRun(entry: HistoryEntry): void {
  const history = readHistory();
  history.push(entry);
  const trimmed = history.slice(-50);
  writeHistory(trimmed);
}

/**
 * Compute the stability trend from local history.
 *
 * Trend logic:
 *   Compare pass rate of last 3 runs vs previous 3 runs.
 *   - Improving: pass rate increased by >= 1 run
 *   - Degrading: pass rate decreased by >= 1 run
 *   - Stable: no change
 */
export function computeTrend(): StabilityTrend {
  const all = readHistory();
  const entries = all.slice(-6); // last 6 runs

  if (entries.length < 2) {
    return {
      direction: 'Insufficient data',
      entries,
      recentSymbols: entries.map(e => e.outcome === 'pass' ? '✔' : '✖'),
    };
  }

  const recentSymbols = entries.map(e => e.outcome === 'pass' ? '✔' : '✖');

  // Compare last 3 vs previous 3
  const recent = entries.slice(-3);
  const previous = entries.slice(0, 3);

  const recentPasses = recent.filter(e => e.outcome === 'pass').length;
  const previousPasses = previous.filter(e => e.outcome === 'pass').length;

  let direction: StabilityTrend['direction'] = 'Stable';
  if (previous.length >= 2) {
    if (recentPasses > previousPasses) direction = 'Improving';
    else if (recentPasses < previousPasses) direction = 'Degrading';
  }

  return { direction, entries, recentSymbols };
}
