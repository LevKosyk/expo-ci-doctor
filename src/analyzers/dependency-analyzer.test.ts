import test from 'node:test';
import assert from 'node:assert/strict';
import { packageManagerFieldRule } from './dependency-analyzer.js';
import type { ProjectInfo } from '../utils/types.js';

function makeProjectInfo(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return {
    cwd: '/tmp/project',
    hasPackageJson: true,
    packageJson: null,
    dependencies: {},
    devDependencies: {},
    enginesNode: undefined,
    expoVersion: undefined,
    reactNativeVersion: undefined,
    hasAppJson: false,
    hasAppConfigJs: false,
    hasAppConfigTs: false,
    hasEasJson: false,
    nvmrcVersion: undefined,
    ci: { hasWorkflow: false, workflows: [] },
    deps: { packageManager: 'npm', lockfiles: ['package-lock.json'] },
    eas: { hasEasJson: false, profiles: [], profileData: {} },
    isMonorepo: false,
    monorepoRoot: undefined,
    ...overrides,
  };
}

test('flags mismatched packageManager field and detected lockfile manager', () => {
  const info = makeProjectInfo({
    packageJson: { packageManager: 'yarn@4.1.0' },
    deps: { packageManager: 'npm', lockfiles: ['package-lock.json'] },
  });

  const results = packageManagerFieldRule.run(info);

  assert.equal(results.length, 1);
  assert.equal(results[0].level, 'error');
  assert.match(results[0].title, /conflicts with detected npm lockfile/);
});

test('nudges projects to declare packageManager when a lockfile exists', () => {
  const info = makeProjectInfo({
    packageJson: {},
    deps: { packageManager: 'pnpm', lockfiles: ['pnpm-lock.yaml'] },
  });

  const results = packageManagerFieldRule.run(info);

  assert.equal(results.length, 1);
  assert.equal(results[0].level, 'info');
  assert.match(results[0].title, /packageManager field is missing/);
});