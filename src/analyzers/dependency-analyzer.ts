import type { Rule, RuleResult, ProjectInfo } from '../utils/types.js';

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
            details: 'The lockfile will be ignored and dependencies will differ.',
            fix: `Change CI to use "${info.deps.packageManager}" commands.`,
          });
        }
      }
    }

    return results;
  },
};

export const dependencyRules = [lockfileIssues];
