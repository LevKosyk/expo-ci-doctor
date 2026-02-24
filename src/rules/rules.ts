import * as semver from 'semver';
import type { Rule, RuleResult, ProjectInfo, RulePack } from '../core/types.js';
import { loadConfig, applyConfigOverride, type DoctorConfig } from '../core/config.js';

// ─── Rule 1: missing app config ────────────────────────────────────

const missingAppConfig: Rule = {
  id: 'missing-app-config',
  pack: 'core',
  category: 'Config',
  explain: 'Every Expo project needs app.json or app.config.js. Without it, Expo CLI and EAS Build cannot determine your app name, slug, SDK version, or native configuration. The build will fail at the very first step — before any code is even compiled. Real-world case: a developer deleted app.json thinking app.config.ts was enough, but forgot to install ts-node — CI could not parse the TS config and the build failed silently.',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.hasAppJson && !info.hasAppConfigJs && !info.hasAppConfigTs) {
      return [{
        id: this.id,
        level: 'error',
        title: 'Missing app.json / app.config.js',
        details:
          'No Expo app configuration found. EAS Build and Expo CLI require ' +
          'app.json or app.config.js to know how to build your project.',
        fix: 'Create app.json in the root:\n' +
          '  { "expo": { "name": "MyApp", "slug": "my-app", "version": "1.0.0" } }',
      }];
    }
    return [];
  },
};

// ─── Rule 2: missing eas.json ──────────────────────────────────────

const missingEasJson: Rule = {
  id: 'missing-eas-json',
  pack: 'eas',
  category: 'EAS',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.hasEasJson) {
      return [{
        id: this.id,
        level: 'warn',
        title: 'Missing eas.json',
        details:
          'No eas.json found. EAS Build will use defaults which may not match your needs.',
        fix: 'Run:  npx eas-cli build:configure',
        filePointer: 'eas.json (missing)',
      }];
    }
    return [];
  },
};

// ─── Rule 3: engines.node not set ──────────────────────────────────

const noEnginesNode: Rule = {
  id: 'no-engines-node',
  pack: 'core',
  category: 'Node',
  run(info: ProjectInfo): RuleResult[] {
    if (info.hasPackageJson && !info.enginesNode) {
      return [{
        id: this.id,
        level: 'warn',
        title: 'engines.node is not specified',
        details:
          'Without "engines.node" in package.json, CI may use a different Node ' +
          'version than your local machine, causing hard-to-debug build failures.',
        fix: 'Add to package.json:\n  "engines": { "node": ">=18.0.0" }',
        filePointer: 'package.json > engines.node',
      }];
    }
    return [];
  },
};

// ─── Rule 4: Expo detected ─────────────────────────────────────────

const expoDetected: Rule = {
  id: 'expo-detected',
  pack: 'core',
  category: 'Expo',
  run(info: ProjectInfo): RuleResult[] {
    if (info.expoVersion) {
      const cleaned = semver.coerce(info.expoVersion);
      const display = cleaned ? `${cleaned.major}.${cleaned.minor}.${cleaned.patch}` : info.expoVersion;
      return [{
        id: this.id,
        level: 'info',
        title: `Expo project detected — v${display}`,
        details: `Found "expo": "${info.expoVersion}" in dependencies.`,
      }];
    }
    return [];
  },
};

// ─── Rule 5: Expo without react-native ─────────────────────────────

const expoWithoutRN: Rule = {
  id: 'expo-without-rn',
  pack: 'core',
  category: 'Expo',
  run(info: ProjectInfo): RuleResult[] {
    if (info.expoVersion && !info.reactNativeVersion) {
      return [{
        id: this.id,
        level: 'warn',
        title: 'Expo is installed but react-native is missing',
        details:
          '"expo" is in dependencies, but "react-native" is not. ' +
          'Most Expo apps require react-native as a peer dependency.',
        fix: 'Run:  npx expo install react-native',
        filePointer: 'package.json > dependencies.react-native',
      }];
    }
    return [];
  },
};

// ─── Rule 6: Expo version not valid semver ─────────────────────────

const expoVersionInvalid: Rule = {
  id: 'expo-version-invalid',
  pack: 'sdk-upgrade',
  category: 'Expo',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.expoVersion) return [];

    const coerced = semver.coerce(info.expoVersion);
    if (!coerced) {
      return [{
        id: this.id,
        level: 'warn',
        title: 'Expo version does not look like valid semver',
        details:
          `"expo": "${info.expoVersion}" cannot be parsed as a valid semver range. ` +
          'This may cause unexpected behavior with npm/yarn resolution.',
        fix: 'Pin to an exact version:  npx expo install expo',
      }];
    }
    return [];
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Day 2 — "Money" rules
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ─── Rule 7: Node version mismatch (local vs CI) ───────────────────

function extractMajor(ver: string): string | null {
  const cleaned = ver.replace(/^[~^>=<vV\s]+/, '');
  const m = cleaned.match(/^(\d+)/);
  return m ? m[1] : null;
}

const nodeVersionMismatch: Rule = {
  id: 'node-version-mismatch',
  pack: 'github-actions',
  category: 'CI',
  requiresPro: true,
  explain: 'Node version mismatch is the #1 cause of "works locally — fails in CI". When CI uses a different major Node version, native modules are compiled against different ABI, crypto APIs differ, and npm/yarn resolves different dependency trees. Real-world case: a team had Node 18 locally but CI defaulted to Node 16 — react-native-reanimated compiled against the wrong ABI and crashed at runtime with a cryptic "JSI" error. The fix took 3 days to find because the error message said nothing about Node versions.',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];

    // Determine the local Node version source
    const localRaw = info.nvmrcVersion ?? info.enginesNode;
    if (!localRaw) return results; // nothing to compare

    const localMajor = extractMajor(localRaw);
    if (!localMajor) return results;

    // Check each CI workflow
    if (!info.ci.hasWorkflow) return results;

    for (const wf of info.ci.workflows) {
      if (!wf.usesSetupNode) {
        results.push({
          id: this.id,
          level: 'error',
          title: `CI has no actions/setup-node (${wf.filename})`,
          details:
            `Workflow "${wf.filename}" does not use actions/setup-node. ` +
            'Without it, CI will use the runner\'s default Node version which is often ' +
            'different from your local version. This is the #1 cause of "works locally — fails in CI".',
          fix:
            `Add to ${wf.filename}:\n` +
            '  - uses: actions/setup-node@v4\n' +
            '    with:\n' +
            `      node-version: '${localRaw}'`,
          filePointer: `.github/workflows/${wf.filename} > setup-node`,
        });
        continue;
      }

      if (wf.nodeVersion) {
        const ciMajor = extractMajor(wf.nodeVersion);
        if (ciMajor && ciMajor !== localMajor) {
          results.push({
            id: this.id,
            level: 'error',
            title: `Node version mismatch: local ${localRaw} ≠ CI ${wf.nodeVersion} (${wf.filename})`,
            details:
              `Your project expects Node ${localRaw}, but CI workflow "${wf.filename}" ` +
              `uses Node ${wf.nodeVersion}. Different major versions cause native module ` +
              'ABI mismatch, crypto API differences, and silent dependency resolution changes.',
            fix:
              `Update node-version in ${wf.filename} to '${localRaw}', ` +
              'or update .nvmrc / engines.node to match CI.',
          });
        }
      }
    }

    return results;
  },
};

// ─── Rule 8: Missing / inconsistent lockfile ───────────────────────

const lockfileIssues: Rule = {
  id: 'lockfile-issues',
  pack: 'core',
  category: 'Dependencies',
  requiresPro: true,
  explain: 'Missing or inconsistent lockfiles cause non-deterministic dependency resolution. Every CI run can install different versions than local. Multiple lockfiles (yarn.lock + package-lock.json) confuse CI — it picks one arbitrarily. Real-world case: a project had both lockfiles. Locally yarn was used, but GitHub Actions ran npm ci, ignoring yarn.lock entirely. A transitive dependency updated with a breaking change and only CI builds broke.',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];

    // No lockfile at all
    if (info.deps.lockfiles.length === 0 && info.hasPackageJson) {
      results.push({
        id: this.id,
        level: 'error',
        title: 'No lockfile found',
        details:
          'No yarn.lock, package-lock.json, or pnpm-lock.yaml found. ' +
          'Without a lockfile, every "npm install" in CI resolves dependencies from scratch — ' +
          'you WILL get different versions than local, and builds WILL fail randomly.',
        fix:
          'Run your package manager to generate a lockfile, then commit it:\n' +
          '  npm install   →  package-lock.json\n' +
          '  yarn install  →  yarn.lock\n' +
          '  pnpm install  →  pnpm-lock.yaml',
      });
      return results;
    }

    // Multiple lockfiles
    if (info.deps.lockfiles.length > 1) {
      results.push({
        id: this.id,
        level: 'error',
        title: `Multiple lockfiles: ${info.deps.lockfiles.join(' + ')}`,
        details:
          'Having multiple lockfiles means different package managers will install ' +
          'different dependency trees. CI often picks a different PM than you use locally.',
        fix:
          `Pick one package manager and delete the others:\n` +
          `  Keep: ${info.deps.lockfiles[0]}\n` +
          `  Delete: ${info.deps.lockfiles.slice(1).join(', ')}`,
      });
    }

    // CI uses different PM than local lockfile
    if (info.deps.packageManager !== 'unknown' && info.ci.hasWorkflow) {
      for (const wf of info.ci.workflows) {
        const content = JSON.stringify(wf);
        let ciPm: string | null = null;

        if (content.includes('npm ci') || content.includes('npm install')) ciPm = 'npm';
        else if (content.includes('yarn install') || content.includes('yarn --frozen')) ciPm = 'yarn';
        else if (content.includes('pnpm install') || content.includes('pnpm i')) ciPm = 'pnpm';

        if (ciPm && ciPm !== info.deps.packageManager) {
          results.push({
            id: this.id,
            level: 'error',
            title: `CI uses ${ciPm} but project uses ${info.deps.packageManager} (${wf.filename})`,
            details:
              `Your lockfile is ${info.deps.lockfiles[0]} (${info.deps.packageManager}), ` +
              `but CI workflow "${wf.filename}" runs ${ciPm} commands. ` +
              'The lockfile will be ignored and dependencies will differ.',
            fix:
              `Change CI to use "${info.deps.packageManager}" commands, ` +
              `or switch your local project to ${ciPm}.`,
          });
        }
      }
    }

    return results;
  },
};

// ─── Rule 9: Missing EAS env vars in CI ────────────────────────────

const missingEasEnvVars: Rule = {
  id: 'missing-eas-env-vars',
  pack: 'eas',
  category: 'EAS',
  requiresPro: true,
  explain: 'EAS Build requires EXPO_TOKEN to authenticate. Without it, the build queues on EAS servers, waits 10-15 minutes for a builder, starts installing dependencies, and THEN fails with "Not authenticated". This wastes CI minutes and frustrates developers. Real-world case: a team forgot to add EXPO_TOKEN after rotating secrets. They burned through 45 minutes of EAS build queue time across 3 retry attempts before realizing the token was missing.',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];
    if (!info.ci.hasWorkflow || !info.eas.hasEasJson) return results;

    for (const wf of info.ci.workflows) {
      if (!wf.easBuildCommand) continue;

      if (!wf.hasExpoToken) {
        results.push({
          id: this.id,
          level: 'error',
          title: `Missing EXPO_TOKEN in CI (${wf.filename})`,
          details:
            `Workflow "${wf.filename}" runs "${wf.easBuildCommand}" but ` +
            'does not reference EXPO_TOKEN in the environment. EAS Build will ' +
            'fail with "Not authenticated" after queueing for 10-15 minutes.',
          fix:
            `Add to the eas build step in ${wf.filename}:\n` +
            '  env:\n' +
            '    EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}\n\n' +
            'Then add the secret in:\n' +
            '  GitHub repo → Settings → Secrets → Actions',
          filePointer: `.github/workflows/${wf.filename} > env.EXPO_TOKEN`,
        });
      }
    }

    return results;
  },
};

// ─── Rule 10: EAS profile mismatch ─────────────────────────────────

const easProfileMismatch: Rule = {
  id: 'eas-profile-mismatch',
  pack: 'eas',
  category: 'EAS',
  requiresPro: true,
  explain: 'When CI calls `eas build --profile X` but profile X doesn\'t exist in eas.json, the build fails immediately. This often happens when someone renames a profile in eas.json but forgets to update the CI workflow. Real-world case: a team renamed "staging" to "preview" in eas.json but the GitHub Action still used --profile staging. Every PR build failed for 2 days before someone noticed.',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];
    if (!info.ci.hasWorkflow || !info.eas.hasEasJson) return results;

    for (const wf of info.ci.workflows) {
      if (!wf.easProfile) continue;

      const profileName = wf.easProfile;

      // Profile doesn't exist in eas.json
      if (!info.eas.profiles.includes(profileName)) {
        results.push({
          id: this.id,
          level: 'error',
          title: `EAS profile "${profileName}" not found in eas.json (${wf.filename})`,
          details:
            `CI runs "eas build --profile ${profileName}" but eas.json ` +
            `only has profiles: [${info.eas.profiles.join(', ') || 'none'}]. ` +
            'The build will fail immediately.',
          fix:
            `Either:\n` +
            `  • Add profile "${profileName}" to eas.json under "build"\n` +
            `  • Or change CI to use an existing profile: ${info.eas.profiles.join(', ')}`,
        });
        continue;
      }

      // Profile exists but is empty
      const profileData = info.eas.profileData[profileName];
      if (profileData && Object.keys(profileData).length === 0) {
        results.push({
          id: this.id,
          level: 'error',
          title: `EAS profile "${profileName}" is empty (${wf.filename})`,
          details:
            `Build profile "${profileName}" in eas.json has no configuration. ` +
            'EAS will use full defaults which often causes unexpected behavior.',
          fix:
            `Add at least a distribution type to eas.json:\n` +
            `  "${profileName}": { "distribution": "store" }`,
        });
      }
    }

    return results;
  },
};

// ─── Rule 11: Expo SDK ↔ React Native mismatch ────────────────────

/** Known-good SDK → RN compatibility */
const SDK_RN_COMPAT: Record<number, string> = {
  52: '0.76',
  51: '0.74',
  50: '0.73',
  49: '0.72',
  48: '0.71',
};

const sdkRnMismatch: Rule = {
  id: 'sdk-rn-mismatch',
  pack: 'sdk-upgrade',
  category: 'Expo',
  requiresPro: true,
  explain: 'Each Expo SDK version is designed for a specific React Native version. Mixing them causes native build failures, Hermes crashes, and metro resolution errors. The Expo team publishes a compatibility table. Real-world case: after upgrading Expo SDK from 50 to 51, the developer forgot to update react-native from 0.73 to 0.74. Android builds passed but iOS crashed on launch with an Objective-C bridge error that was impossible to debug without knowing the root cause.',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.expoVersion || !info.reactNativeVersion) return [];

    const expoCoerced = semver.coerce(info.expoVersion);
    if (!expoCoerced) return [];
    const sdkMajor = expoCoerced.major;

    const rnCoerced = semver.coerce(info.reactNativeVersion);
    if (!rnCoerced) return [];
    const rnMinor = `${rnCoerced.major}.${rnCoerced.minor}`;

    const expected = SDK_RN_COMPAT[sdkMajor];
    if (!expected) return []; // unknown SDK, skip

    if (rnMinor !== expected) {
      return [{
        id: this.id,
        level: 'warn',
        title: `Expo SDK ${sdkMajor} expects RN ${expected}.x — found ${rnMinor}`,
        details:
          `Expo SDK ${sdkMajor} is designed for react-native ${expected}.x, ` +
          `but you have react-native@${info.reactNativeVersion}. ` +
          'This mismatch causes native build failures, Hermes crashes, and random metro errors in CI.',
        fix: 'Run:  npx expo install react-native\n' +
          'This will install the correct RN version for your SDK.',
      }];
    }

    return [];
  },
};

// ─── Rule 12: CI cache without lockfile ────────────────────────────

const ciCacheNoLockfile: Rule = {
  id: 'ci-cache-no-lockfile',
  pack: 'github-actions',
  category: 'CI',
  requiresPro: true,
  explain: 'GitHub Actions cache uses a hash of the lockfile as the cache key. If there is no lockfile, the cache key is undefined and the cache is never restored. This means every CI run does a full install from scratch — slow and non-deterministic. Real-world case: a team had cache enabled but no lockfile committed; CI runs took 8 minutes instead of 2, and they never noticed because the cache step said "cache not found" without erroring.',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.ci.hasWorkflow) return [];

    for (const wf of info.ci.workflows) {
      if (wf.usesCache && !wf.cacheKeyDependsOnLockfile && info.deps.lockfiles.length === 0) {
        return [{
          id: this.id,
          level: 'warn',
          title: `CI cache enabled but no lockfile to hash (${wf.filename})`,
          details:
            `Workflow "${wf.filename}" uses caching, but there is no lockfile in the project. ` +
            'Without a lockfile hash, the cache key is unstable — the cache is never restored, ' +
            'and every install runs from scratch.',
          fix:
            '1. Commit your lockfile: npm install && git add package-lock.json\n' +
            '2. Or if using yarn: git add yarn.lock\n' +
            '3. The cache will then use the lockfile hash as key',
        }];
      }
    }
    return [];
  },
};

// ─── Rule 13: CI missing install step ──────────────────────────────

const ciMissingInstall: Rule = {
  id: 'ci-missing-install',
  pack: 'github-actions',
  category: 'CI',
  requiresPro: true,
  explain: 'If a CI workflow runs `eas build` but does not run `npm ci` / `yarn install` first, node_modules may be missing or stale. EAS Build itself installs dependencies on the server, but local plugins, scripts, and expo prebuild may fail. Real-world case: a team cached node_modules but removed the install step. When a new dependency was added, CI used the stale cache and the expo config plugin could not find the new module.',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.ci.hasWorkflow) return [];

    for (const wf of info.ci.workflows) {
      if (!wf.easBuildCommand) continue;

      // Check if any known install command exists in the workflow content
      const content = JSON.stringify(wf);
      const hasInstall =
        content.includes('npm ci') ||
        content.includes('npm install') ||
        content.includes('yarn install') ||
        content.includes('yarn --frozen') ||
        content.includes('pnpm install') ||
        content.includes('pnpm i');

      if (!hasInstall) {
        return [{
          id: this.id,
          level: 'warn',
          title: `CI runs eas build without install step (${wf.filename})`,
          details:
            `Workflow "${wf.filename}" runs "${wf.easBuildCommand}" but does not have an ` +
            'npm ci / yarn install step. While EAS Build installs deps on the server, ' +
            'local config plugins and scripts may fail without node_modules.',
          fix:
            `Add before the eas build step in ${wf.filename}:\n` +
            `  - run: ${info.deps.packageManager === 'yarn' ? 'yarn install --frozen-lockfile' : info.deps.packageManager === 'pnpm' ? 'pnpm install --frozen-lockfile' : 'npm ci'}`,
        }];
      }
    }
    return [];
  },
};

// ─── Export ─────────────────────────────────────────────────────────

export const allRules: Rule[] = [
  // Day 1
  missingAppConfig,
  missingEasJson,
  noEnginesNode,
  expoDetected,
  expoWithoutRN,
  expoVersionInvalid,
  // Day 2
  nodeVersionMismatch,
  lockfileIssues,
  missingEasEnvVars,
  easProfileMismatch,
  sdkRnMismatch,
  // Edge cases
  ciCacheNoLockfile,
  ciMissingInstall,
];

// ─── Run options ────────────────────────────────────────────────────

export interface RunOptions {
  isPro?: boolean;
  pack?: RulePack;
  ciStrict?: boolean;
  config?: DoctorConfig;
}

/**
 * Run rules against collected project info.
 * Filters by pack, pro status, and config overrides.
 */
export function runRules(info: ProjectInfo, opts: RunOptions = {}): { results: RuleResult[]; skippedPro: number } {
  const results: RuleResult[] = [];
  let skippedPro = 0;
  const config = opts.config ?? { rules: {}, ignore: [] };

  for (const rule of allRules) {
    // Config: rule disabled
    if (config.rules[rule.id] === 'off') continue;

    // Filter by pack
    if (opts.pack && rule.pack !== opts.pack) continue;

    // Filter by pro
    if (rule.requiresPro && !opts.isPro) {
      skippedPro++;
      continue;
    }

    try {
      const ruleResults = rule.run(info);

      for (const r of ruleResults) {
        // Config: override level
        const overridden = applyConfigOverride(config, r.id, r.level);
        if (overridden === null) continue;
        r.level = overridden;

        // ci-strict: promote warnings to errors
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
  return { results, skippedPro };
}

/**
 * Compute CLI exit code from results.
 *   0 — info only
 *   1 — warnings present
 *   2 — errors present
 */
export function exitCode(results: RuleResult[]): number {
  if (results.some((r) => r.level === 'error')) return 2;
  if (results.some((r) => r.level === 'warn')) return 1;
  return 0;
}

/**
 * Find a rule by id.
 */
export function findRule(id: string): Rule | undefined {
  return allRules.find((r) => r.id === id);
}

/**
 * Get category for a rule.
 */
export function ruleCategory(ruleId: string): string {
  const rule = findRule(ruleId);
  return rule?.category ?? 'Other';
}
