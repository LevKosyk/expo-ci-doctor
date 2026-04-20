import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { getCwd } from '../utils/context.js';

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

function getProjectHistoryDir(cwd = getCwd()): string {
  return path.join(cwd, '.expo-ci-doctor');
}

function getLocalHistoryDir(): string {
  return path.join(os.homedir(), '.expo-ci-doctor');
}

function getHistoryPath(cwd = getCwd()): string {
  return path.join(getProjectHistoryDir(cwd), 'history.json');
}

function getLocalHistoryPath(): string {
  return path.join(getLocalHistoryDir(), 'history.json');
}

function readHistoryFromPath(p: string): HistoryEntry[] {
  try {
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as HistoryEntry[];
  } catch {
    return [];
  }
}

function readHistory(cwd = getCwd()): HistoryEntry[] {
  const projectEntries = readHistoryFromPath(getHistoryPath(cwd));
  if (projectEntries.length > 0) return projectEntries;
  return readHistoryFromPath(getLocalHistoryPath());
}

function writeHistory(entries: HistoryEntry[], cwd = getCwd()): void {
  const dir = getProjectHistoryDir(cwd);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getHistoryPath(cwd), JSON.stringify(entries, null, 2), 'utf-8');
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Record the result of the current check/doctor run.
 * History is capped at 50 entries to keep the file small.
 */
export function recordRun(entry: HistoryEntry, cwd = getCwd()): void {
  const history = readHistory(cwd);
  history.push(entry);
  const trimmed = history.slice(-50);
  writeHistory(trimmed, cwd);
}

export function getHistoryEntries(limit = 50, cwd = getCwd()): HistoryEntry[] {
  return readHistory(cwd).slice(-Math.max(1, limit));
}

export function isFlaky(entries: HistoryEntry[]): boolean {
  if (entries.length < 4) return false;
  let flips = 0;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].outcome !== entries[i - 1].outcome) flips += 1;
  }
  return flips >= Math.floor(entries.length / 2);
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
export function computeTrend(cwd = getCwd()): StabilityTrend {
  const all = readHistory(cwd);
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
