import type { Rule, RuleResult, ProjectInfo } from '../utils/types.js';

export const missingEasJson: Rule = {
  id: 'missing-eas-json',
  pack: 'eas',
  category: 'EAS',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.hasEasJson) {
      return [{
        id: this.id,
        level: 'warn',
        title: 'Missing eas.json',
        details: 'No eas.json found. EAS Build will use defaults.',
        fix: 'Run:  npx eas-cli build:configure',
      }];
    }
    return [];
  },
};

export const noEnginesNode: Rule = {
  id: 'no-engines-node',
  pack: 'core',
  category: 'Node',
  run(info: ProjectInfo): RuleResult[] {
    if (info.hasPackageJson && !info.enginesNode) {
      return [{
        id: this.id,
        level: 'warn',
        title: 'engines.node is not specified',
        details: 'Without "engines.node" in package.json, CI may use a different Node version.',
        fix: 'Add to package.json: "engines": { "node": ">=18.0.0" }',
      }];
    }
    return [];
  },
};

function extractMajor(ver: string): string | null {
  const cleaned = ver.replace(/^[~^>=<vV\s]+/, '');
  const m = cleaned.match(/^(\d+)/);
  return m ? m[1] : null;
}

export const nodeVersionMismatch: Rule = {
  id: 'node-version-mismatch',
  pack: 'github-actions',
  category: 'CI',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];
    const localRaw = info.nvmrcVersion ?? info.enginesNode;
    if (!localRaw) return results;

    const localMajor = extractMajor(localRaw);
    if (!localMajor) return results;

    if (!info.ci.hasWorkflow) return results;

    for (const wf of info.ci.workflows) {
      if (!wf.usesSetupNode) {
        results.push({
          id: this.id,
          level: 'error',
          title: `CI has no explicit Node setup (${wf.filename})`,
          details: 'Without it, CI uses default Node version causing mismatches.',
          fix: wf.provider === 'github-actions'
            ? 'Add uses: actions/setup-node@v4'
            : 'Pin a Node image/version in your CI config.',
        });
        continue;
      }

      if (wf.nodeVersion) {
        const ciMajor = extractMajor(wf.nodeVersion);
        if (ciMajor && ciMajor !== localMajor) {
          results.push({
            id: this.id,
            level: 'error',
            title: `Node version mismatch: local ${localRaw} ≠ CI ${wf.nodeVersion}`,
            details: 'Different major versions cause native module mismatch.',
            fix: `Update node-version in ${wf.filename} to '${localRaw}'`,
          });
        }
      }
    }
    return results;
  },
};

export const missingEasEnvVars: Rule = {
  id: 'missing-eas-env-vars',
  pack: 'eas',
  category: 'EAS',
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
          details: 'EAS Build will fail with "Not authenticated".',
          fix: 'Add EXPO_TOKEN to the environment.',
        });
      }
    }
    return results;
  },
};

export const easProfileMismatch: Rule = {
  id: 'eas-profile-mismatch',
  pack: 'eas',
  category: 'EAS',
  run(info: ProjectInfo): RuleResult[] {
    const results: RuleResult[] = [];
    if (!info.ci.hasWorkflow || !info.eas.hasEasJson) return results;

    for (const wf of info.ci.workflows) {
      if (!wf.easProfile) continue;
      const profileName = wf.easProfile;

      if (!info.eas.profiles.includes(profileName)) {
        results.push({
          id: this.id,
          level: 'error',
          title: `EAS profile "${profileName}" not found in eas.json`,
          details: 'The build will fail immediately.',
          fix: `Add profile "${profileName}" to eas.json`,
        });
        continue;
      }

      const profileData = info.eas.profileData[profileName];
      if (profileData && Object.keys(profileData).length === 0) {
        results.push({
          id: this.id,
          level: 'error',
          title: `EAS profile "${profileName}" is empty (${wf.filename})`,
          details: 'EAS will use full defaults.',
          fix: `Add configuration to the profile in eas.json`,
        });
      }
    }
    return results;
  },
};

export const ciCacheNoLockfile: Rule = {
  id: 'ci-cache-no-lockfile',
  pack: 'github-actions',
  category: 'CI',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.ci.hasWorkflow) return [];

    for (const wf of info.ci.workflows) {
      if (wf.usesCache && !wf.cacheKeyDependsOnLockfile && info.deps.lockfiles.length === 0) {
        return [{
          id: this.id,
          level: 'warn',
          title: `CI cache enabled but no lockfile to hash (${wf.filename})`,
          details: 'Without a lockfile hash, the cache key is unstable.',
          fix: 'Commit your lockfile',
        }];
      }
    }
    return [];
  },
};

export const ciMissingInstall: Rule = {
  id: 'ci-missing-install',
  pack: 'github-actions',
  category: 'CI',
  run(info: ProjectInfo): RuleResult[] {
    if (!info.ci.hasWorkflow) return [];

    for (const wf of info.ci.workflows) {
      if (!wf.easBuildCommand) continue;

      if (!wf.hasInstallStep) {
        return [{
          id: this.id,
          level: 'warn',
          title: `CI runs eas build without install step (${wf.filename})`,
          details: 'Local config plugins and scripts may fail without node_modules.',
          fix: `Add an install step before EAS build (npm ci / yarn install --frozen-lockfile / pnpm install --frozen-lockfile).`,
        }];
      }
    }
    return [];
  },
};

export const ciRules = [
  missingEasJson, noEnginesNode, nodeVersionMismatch, missingEasEnvVars, 
  easProfileMismatch, ciCacheNoLockfile, ciMissingInstall
];
