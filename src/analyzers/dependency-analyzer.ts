import type { Rule, RuleResult, ProjectInfo } from '../utils/types.js';

const HEAVY_PACKAGES = [
  '@aws-amplify',
  'firebase',
  'lodash',
  'moment',
  'moment-timezone',
  'graphql',
  'react-native-reanimated',
  'react-native-gesture-handler',
  'react-native-svg',
  'expo-av',
  'expo-camera',
  'expo-image-picker',
  'expo-notifications',
];

const STALE_PACKAGE_MIN_MAJOR: Record<string, number> = {
  expo: 50,
  'expo-router': 3,
  'expo-dev-client': 4,
  'expo-build-properties': 0,
  'expo-notifications': 0,
  'expo-location': 0,
  'react-native': 0,
};

export const lockfileIssues: Rule = {
  id: 'lockfile-issues',
  pack: 'core',
  category: 'Dependencies',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];

    if (info.deps.lockfiles.length === 0 && info.hasPackageJson) {
      results.push({
        id: this.id,
        level: 'error',
        title: 'No lockfile found',
        details: 'Without a lockfile, every "npm install" in CI resolves dependencies from scratch.',
        fix: 'Run your package manager to generate a lockfile, then commit it',
      });
      return results;
    }

    if (info.deps.lockfiles.length > 1) {
      results.push({
        id: this.id,
        level: 'error',
        title: `Multiple lockfiles: ${info.deps.lockfiles.join(' + ')}`,
        details: 'Different package managers will install different dependency trees.',
        fix: `Pick one package manager and delete the others.`,
      });
    }

    if (info.deps.packageManager !== 'unknown' && info.ci.hasWorkflow) {
      for (const wf of info.ci.workflows) {
        const ciPm = wf.packageManagerHint ?? null;

        if (ciPm && ciPm !== info.deps.packageManager) {
          results.push({
            id: this.id,
            level: 'error',
            title: `CI uses ${ciPm} but project uses ${info.deps.packageManager} (${wf.filename})`,
            details: 'The lockfile will be ignored and dependencies will differ.',
            fix: `Change CI to use "${info.deps.packageManager}" commands.`,
          });
        }
      }
    }

    return results;
  },
};

export const dependencyRiskScore: Rule = {
  id: 'dependency-risk-score',
  pack: 'sdk-upgrade',
  category: 'Dependencies',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];
    const allDeps = { ...info.dependencies, ...info.devDependencies };

    const riskyRanges: string[] = [];
    const expoMajors = new Set<number>();

    for (const [name, version] of Object.entries(allDeps)) {
      const raw = String(version).trim();
      if (raw === 'latest' || raw === '*' || raw.includes('x')) {
        riskyRanges.push(`${name}@${raw}`);
      }
      if (name.startsWith('expo-')) {
        const m = raw.match(/(\d+)\./);
        if (m) expoMajors.add(Number(m[1]));
      }
    }

    if (riskyRanges.length > 0) {
      results.push({
        id: this.id,
        level: 'warn',
        title: `Unpinned dependency ranges detected (${riskyRanges.length})`,
        details: 'Using latest/*/x ranges increases drift and non-reproducible CI installs.',
        fix: `Pin exact or caret versions for: ${riskyRanges.slice(0, 8).join(', ')}${riskyRanges.length > 8 ? ' …' : ''}`,
      });
    }

    if (expoMajors.size > 2) {
      results.push({
        id: this.id,
        level: 'warn',
        title: 'Expo package major versions look inconsistent',
        details: `Detected ${expoMajors.size} different expo-* major version groups. This often causes native plugin and runtime mismatch.`,
        fix: 'Align expo-* package versions with your Expo SDK via: npx expo install --fix',
      });
    }

    return results;
  },
};

export const dependencyBloatRisk: Rule = {
  id: 'dependency-bloat-risk',
  pack: 'core',
  category: 'Dependencies',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];
    const combined = new Map<string, { dep?: string; dev?: string }>();

    for (const [name, version] of Object.entries(info.dependencies)) {
      combined.set(name, { ...(combined.get(name) ?? {}), dep: version });
    }
    for (const [name, version] of Object.entries(info.devDependencies)) {
      combined.set(name, { ...(combined.get(name) ?? {}), dev: version });
    }

    const duplicated = [...combined.entries()].filter(([, value]) => value.dep && value.dev);
    const conflicting = duplicated.filter(([, value]) => value.dep !== value.dev);
    if (conflicting.length > 0) {
      results.push({
        id: this.id,
        level: 'error',
        title: `Packages declared in both dependencies and devDependencies (${conflicting.length})`,
        details: 'Duplicated declarations increase install churn and can mask version drift.',
        fix: `Move these packages into one section or align versions: ${conflicting.slice(0, 8).map(([name, value]) => `${name}@${value.dep} / ${value.dev}`).join(', ')}${conflicting.length > 8 ? ' …' : ''}`,
      });
    } else if (duplicated.length > 0) {
      results.push({
        id: this.id,
        level: 'warn',
        title: `Packages duplicated across dependencies and devDependencies (${duplicated.length})`,
        details: 'This can bloat installs and make dependency intent harder to read.',
        fix: `Keep duplicates in a single section: ${duplicated.slice(0, 8).map(([name]) => name).join(', ')}${duplicated.length > 8 ? ' …' : ''}`,
      });
    }

    const allDeps = { ...info.dependencies, ...info.devDependencies };
    const heavy = Object.keys(allDeps).filter((name) => HEAVY_PACKAGES.some((pkg) => name === pkg || name.startsWith(`${pkg}/`)));
    if (heavy.length >= 4) {
      results.push({
        id: this.id,
        level: 'warn',
        title: `Large dependency surface detected (${heavy.length} known heavy packages)`,
        details: 'These packages often increase install time, bundle size, and CI memory pressure.',
        fix: `Review whether all of these are necessary: ${heavy.slice(0, 10).join(', ')}${heavy.length > 10 ? ' …' : ''}`,
      });
    }

    const stale: string[] = [];
    for (const [name, version] of Object.entries(allDeps)) {
      const minMajor = STALE_PACKAGE_MIN_MAJOR[name];
      if (typeof minMajor !== 'number') continue;
      const majorMatch = String(version).match(/(\d+)/);
      if (!majorMatch) continue;
      const installedMajor = Number(majorMatch[1]);
      if (installedMajor < minMajor) {
        stale.push(`${name}@${version}`);
      }
    }

    if (stale.length > 0) {
      results.push({
        id: this.id,
        level: 'warn',
        title: `Potentially stale package versions detected (${stale.length})`,
        details: 'Older package majors are common sources of native build drift and large upgrade jumps.',
        fix: `Review these packages for upgrade: ${stale.slice(0, 8).join(', ')}${stale.length > 8 ? ' …' : ''}`,
      });
    }

    return results;
  },
};

export const packageManagerFieldRule: Rule = {
  id: 'package-manager-field',
  pack: 'core',
  category: 'Dependencies',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];
    const declared = getDeclaredPackageManager(info.packageJson);
    const detected = info.deps.packageManager;

    if (!declared) {
      if (detected !== 'unknown') {
        results.push({
          id: this.id,
          level: 'info',
          title: 'packageManager field is missing',
          details: `package.json does not declare a packageManager field, so Corepack and CI may drift from the detected ${detected} workflow.`,
          fix: `Add \"packageManager\": \"${detected}@<version>\" to package.json and regenerate the lockfile.`,
        });
      }
      return results;
    }

    if (detected !== 'unknown' && declared !== detected) {
      results.push({
        id: this.id,
        level: 'error',
        title: `packageManager field conflicts with detected ${detected} lockfile`,
        details: `package.json declares ${declared}, but the repository lockfile layout points to ${detected}. This can make local installs and CI use different dependency trees.`,
        fix: `Align package.json packageManager with ${detected}, then regenerate the lockfile and commit the result.`,
      });
      return results;
    }

    if (detected === 'unknown') {
      results.push({
        id: this.id,
        level: 'warn',
        title: 'packageManager field is present but no lockfile was detected',
        details: 'A declared package manager is helpful, but the repo still needs a committed lockfile for reproducible CI installs.',
        fix: 'Generate and commit the matching lockfile for your declared package manager.',
      });
    }

    return results;
  },
};

function getDeclaredPackageManager(pkg: Record<string, unknown> | null): 'npm' | 'yarn' | 'pnpm' | null {
  const raw = pkg?.packageManager;
  if (typeof raw !== 'string') return null;

  const normalized = raw.toLowerCase();
  if (normalized.startsWith('npm@')) return 'npm';
  if (normalized.startsWith('yarn@')) return 'yarn';
  if (normalized.startsWith('pnpm@')) return 'pnpm';
  return null;
}

export const dependencyRules = [lockfileIssues, packageManagerFieldRule, dependencyRiskScore, dependencyBloatRisk];
