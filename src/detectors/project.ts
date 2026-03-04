import { readJsonSafe, readTextSafe, fileExists, resolve } from '../utils/context.js';
import { detectCI } from './ci.js';
import { detectLockfile } from './lockfile.js';
import { detectEas } from './eas.js';
import type { ProjectInfo } from '../utils/types.js';

/**
 * Scans the working directory and collects all project information
 * needed by the rule engine.
 */
export function detectProject(cwd: string): ProjectInfo {
  // ── package.json ──────────────────────────────────────────────────
  const pkgPath = resolve(cwd, 'package.json');
  const pkg = readJsonSafe(pkgPath);

  const deps = (pkg?.dependencies ?? {}) as Record<string, string>;
  const devDeps = (pkg?.devDependencies ?? {}) as Record<string, string>;
  const allDeps = { ...deps, ...devDeps };
  const engines = pkg?.engines as { node?: string } | undefined;

  // ── App config ────────────────────────────────────────────────────
  const hasAppJson = fileExists(resolve(cwd, 'app.json'));
  const hasAppConfigJs = fileExists(resolve(cwd, 'app.config.js'));
  const hasAppConfigTs = fileExists(resolve(cwd, 'app.config.ts'));

  // ── EAS ───────────────────────────────────────────────────────────
  const hasEasJson = fileExists(resolve(cwd, 'eas.json'));

  // ── .nvmrc ────────────────────────────────────────────────────────
  const nvmrc = readTextSafe(resolve(cwd, '.nvmrc'));
  const nodeVersionFile = readTextSafe(resolve(cwd, '.node-version'));
  const nvmrcVersion = nvmrc ?? nodeVersionFile ?? undefined;

  // ── Monorepo detection ────────────────────────────────────────────
  const hasPnpmWorkspace = fileExists(resolve(cwd, 'pnpm-workspace.yaml'));
  const hasYarnWorkspaces = !!(pkg?.workspaces);
  const hasLernaJson = fileExists(resolve(cwd, 'lerna.json'));
  const isMonorepo = hasPnpmWorkspace || hasYarnWorkspaces || hasLernaJson;

  // ── Day 2 detectors ───────────────────────────────────────────────
  const ci = detectCI(cwd);
  const depsInfo = detectLockfile(cwd);
  const eas = detectEas(cwd);

  return {
    cwd,
    hasPackageJson: pkg !== null,
    packageJson: pkg,
    dependencies: deps,
    devDependencies: devDeps,
    enginesNode: engines?.node,
    expoVersion: allDeps['expo'] ?? undefined,
    reactNativeVersion: allDeps['react-native'] ?? undefined,
    hasAppJson,
    hasAppConfigJs,
    hasAppConfigTs,
    hasEasJson,
    nvmrcVersion,
    ci,
    deps: depsInfo,
    eas,
    isMonorepo,
    monorepoRoot: isMonorepo ? cwd : undefined,
  };
}
