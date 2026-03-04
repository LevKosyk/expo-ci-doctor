import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RuleLevel } from './types.js';

// ─── Config shape ───────────────────────────────────────────────────

export interface DoctorConfig {
  rules: Record<string, 'off' | 'warn' | 'error'>;
  ignore: string[];
}

const DEFAULT_CONFIG: DoctorConfig = {
  rules: {},
  ignore: [],
};

// ─── Load config ────────────────────────────────────────────────────

/**
 * Reads .expo-ci-doctorrc (JSON) or "expoCiDoctor" field from package.json.
 * Returns merged config with defaults.
 */
export function loadConfig(cwd: string): DoctorConfig {
  // 1. Try .expo-ci-doctorrc
  const rcPath = path.join(cwd, '.expo-ci-doctorrc');
  if (fs.existsSync(rcPath)) {
    try {
      const raw = fs.readFileSync(rcPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return mergeConfig(parsed);
    } catch {
      // Invalid JSON — use defaults
    }
  }

  // 2. Try package.json > expoCiDoctor
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      if (pkg.expoCiDoctor && typeof pkg.expoCiDoctor === 'object') {
        return mergeConfig(pkg.expoCiDoctor);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return DEFAULT_CONFIG;
}

function mergeConfig(raw: Record<string, unknown>): DoctorConfig {
  const rules: Record<string, 'off' | 'warn' | 'error'> = {};

  if (raw.rules && typeof raw.rules === 'object') {
    for (const [key, val] of Object.entries(raw.rules as Record<string, string>)) {
      if (val === 'off' || val === 'warn' || val === 'error') {
        rules[key] = val;
      }
    }
  }

  const ignore: string[] = [];
  if (Array.isArray(raw.ignore)) {
    for (const item of raw.ignore) {
      if (typeof item === 'string') ignore.push(item);
    }
  }

  return { rules, ignore };
}

/**
 * Apply config overrides to a rule result.
 * Returns null if the rule is disabled.
 */
export function applyConfigOverride(
  config: DoctorConfig,
  ruleId: string,
  level: RuleLevel,
): RuleLevel | null {
  const override = config.rules[ruleId];
  if (override === 'off') return null;
  if (override === 'warn') return 'warn';
  if (override === 'error') return 'error';
  return level;
}
