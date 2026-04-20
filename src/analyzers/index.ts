import * as path from 'node:path';
import { fileExists } from '../utils/context.js';
import type { Rule, RuleResult, ProjectInfo, RulePack } from '../utils/types.js';
import { applyConfigOverride, type DoctorConfig } from '../utils/config-loader.js';

import { sdkRules } from './sdk-analyzer.js';
import { ciRules } from './ci-analyzer.js';
import { dependencyRules } from './dependency-analyzer.js';
import { pluginRules } from './plugin-analyzer.js';
import { nativeRules } from './native-analyzer.js';

export const allRules: Rule[] = [
  ...sdkRules,
  ...ciRules,
  ...dependencyRules,
  ...pluginRules,
  ...nativeRules,
];

export interface RunOptions {
  pack?: RulePack;
  ciStrict?: boolean;
  config?: DoctorConfig;
}

export function runRules(info: ProjectInfo, opts: RunOptions = {}): { results: RuleResult[] } {
  const results: RuleResult[] = [];
  const config: DoctorConfig = opts.config ?? { rules: {}, ignore: [], baselines: [], customRules: [], severityThresholds: {} };
  const baselineSet = new Set(config.baselines ?? []);

  for (const rule of allRules) {
    if (config.rules[rule.id] === 'off') continue;
    if (opts.pack && rule.pack !== opts.pack) continue;

    try {
      const ruleResults = rule.run(info);

      for (const r of ruleResults) {
        if (baselineSet.has(r.id)) continue;
        const overridden = applyConfigOverride(config, r.id, r.level);
        if (overridden === null) continue;
        r.level = overridden;

        if (opts.ciStrict && r.level === 'warn') {
          r.level = 'error';
        }

        results.push(r);
      }
    } catch (err) {
      results.push({
        id: rule.id,
        level: 'warn',
        title: `Rule "${rule.id}" threw an error`,
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const customRule of config.customRules ?? []) {
    try {
      const matched = evaluateCustomRule(customRule, info);
      if (!matched) continue;
      if (baselineSet.has(customRule.id)) continue;

      const overridden = applyConfigOverride(config, customRule.id, customRule.level ?? 'warn');
      if (overridden === null) continue;

      results.push({
        id: customRule.id,
        level: opts.ciStrict && overridden === 'warn' ? 'error' : overridden,
        title: customRule.title,
        details: customRule.details ?? 'Triggered by a custom rule in your local configuration.',
        fix: customRule.fix,
      });
    } catch {
      // Keep command output stable even if custom rule is malformed.
    }
  }

  return { results };
}

function evaluateCustomRule(
  customRule: DoctorConfig['customRules'][number],
  info: ProjectInfo,
): boolean {
  const when = customRule.when;
  const allDeps = { ...info.dependencies, ...info.devDependencies };

  if (when.fileExists) {
    return fileExists(path.join(info.cwd, when.fileExists));
  }
  if (when.fileMissing) {
    return !fileExists(path.join(info.cwd, when.fileMissing));
  }
  if (when.packagePresent) {
    return Boolean(allDeps[when.packagePresent]);
  }
  if (when.packageMissing) {
    return !allDeps[when.packageMissing];
  }

  return false;
}

export function exitCode(results: RuleResult[], threshold: 'info' | 'warn' | 'error' = 'error'): number {
  const levelOrder: Record<'info' | 'warn' | 'error', number> = { info: 0, warn: 1, error: 2 };
  const highest = results.reduce((max, result) => Math.max(max, levelOrder[result.level]), 0);
  return highest >= levelOrder[threshold] ? 2 : 0;
}

export function findRule(id: string): Rule | undefined {
  return allRules.find((r) => r.id === id);
}

export function ruleCategory(ruleId: string): string {
  const rule = findRule(ruleId);
  return rule?.category ?? 'Other';
}
