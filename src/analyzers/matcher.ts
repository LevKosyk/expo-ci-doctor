import * as fs from 'node:fs';
import * as readline from 'node:readline';
import type { RuleLevel } from '../utils/types.js';
import { allPatterns } from './patterns.js';
import type { Confidence } from './patterns.js';

// ─── Match result ───────────────────────────────────────────────────

export interface MatchResult {
  id: string;
  level: RuleLevel;
  confidence: Confidence;
  stage: string;
  title: string;
  explanation: string;
  fix: string;
  /** First line that matched */
  matchedLine: string;
  /** 1-indexed line number */
  lineNumber: number;
  /** Context: lines around the match */
  context: string[];
  /** Which line in `context` array is the highlighted match (0-indexed) */
  contextHighlight: number;
  /** Priority for root-cause ranking (lower = more likely root cause) */
  priority: number;
}

// ─── ANSI stripping ─────────────────────────────────────────────────

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

// ─── Matcher ────────────────────────────────────────────────────────

const CONTEXT_BEFORE = 3;
const CONTEXT_AFTER = 5;

/**
 * Scans every line of `logContent` against all known patterns.
 * Returns deduplicated results with context window, sorted by priority.
 */
export function matchPatterns(logContent: string): MatchResult[] {
  const clean = stripAnsi(logContent);
  const lines = clean.split('\n');
  const results: MatchResult[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of allPatterns) {
      if (seen.has(pattern.id)) continue;

      if (pattern.test(line)) {
        seen.add(pattern.id);

        // Extract context window
        const ctxStart = Math.max(0, i - CONTEXT_BEFORE);
        const ctxEnd = Math.min(lines.length - 1, i + CONTEXT_AFTER);
        const context: string[] = [];
        for (let j = ctxStart; j <= ctxEnd; j++) {
          context.push(lines[j]);
        }
        const contextHighlight = i - ctxStart;

        results.push({
          id: pattern.id,
          level: pattern.level,
          confidence: pattern.confidence,
          stage: pattern.stage,
          title: pattern.title,
          explanation: pattern.explanation,
          fix: pattern.fix,
          matchedLine: line.trim().substring(0, 200),
          lineNumber: i + 1,
          context,
          contextHighlight,
          priority: pattern.priority ?? 50,
        });
      }
    }
  }

  // Sort: errors first, then by priority (lower = root cause)
  const levelOrder = { error: 0, warn: 1, info: 2 };
  results.sort((a, b) => {
    const lDiff = levelOrder[a.level] - levelOrder[b.level];
    if (lDiff !== 0) return lDiff;
    return a.priority - b.priority;
  });

  return results;
}

/**
 * Stream-based matcher for large log files.
 * Uses line-by-line scanning and avoids loading the full file in memory.
 */
export async function matchPatternsFromFile(logFile: string): Promise<{ results: MatchResult[]; lineCount: number }> {
  const rl = readline.createInterface({
    input: fs.createReadStream(logFile, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  const results: MatchResult[] = [];
  const seen = new Set<string>();
  const ring: string[] = [];
  let lineNumber = 0;

  for await (const rawLine of rl) {
    lineNumber += 1;
    const line = stripAnsi(rawLine);

    ring.push(line);
    if (ring.length > CONTEXT_BEFORE + CONTEXT_AFTER + 1) {
      ring.shift();
    }

    for (const pattern of allPatterns) {
      if (seen.has(pattern.id)) continue;
      if (!pattern.test(line)) continue;

      seen.add(pattern.id);
      const context = ring.slice(Math.max(0, ring.length - (CONTEXT_BEFORE + 1)));
      const contextHighlight = Math.max(0, context.length - 1);

      results.push({
        id: pattern.id,
        level: pattern.level,
        confidence: pattern.confidence,
        stage: pattern.stage,
        title: pattern.title,
        explanation: pattern.explanation,
        fix: pattern.fix,
        matchedLine: line.trim().substring(0, 200),
        lineNumber,
        context,
        contextHighlight,
        priority: pattern.priority ?? 50,
      });
    }
  }

  const levelOrder = { error: 0, warn: 1, info: 2 };
  results.sort((a, b) => {
    const lDiff = levelOrder[a.level] - levelOrder[b.level];
    if (lDiff !== 0) return lDiff;
    return a.priority - b.priority;
  });

  return { results, lineCount: lineNumber };
}
