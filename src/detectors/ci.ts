import * as path from 'node:path';
import { readTextSafe, findFilesByExt, resolve } from '../utils/context.js';

// ─── Output shape ───────────────────────────────────────────────────

export interface CIInfo {
  hasWorkflow: boolean;
  workflows: WorkflowInfo[];
}

export type CIProvider = 'github-actions' | 'gitlab-ci' | 'circleci';

export interface WorkflowInfo {
  filePath: string;
  filename: string;
  provider: CIProvider;
  usesSetupNode: boolean;
  nodeVersion?: string;
  usesCache: boolean;
  cacheKeyDependsOnLockfile: boolean;
  easBuildCommand?: string;
  easProfile?: string;
  hasExpoToken: boolean;
  hasInstallStep: boolean;
  packageManagerHint?: 'npm' | 'yarn' | 'pnpm';
}

// ─── Detector ───────────────────────────────────────────────────────

export function detectCI(cwd: string): CIInfo {
  const workflows: WorkflowInfo[] = [];

  const ghDir = resolve(cwd, '.github', 'workflows');
  const ghFiles = [
    ...findFilesByExt(ghDir, '.yml'),
    ...findFilesByExt(ghDir, '.yaml'),
  ];
  for (const file of ghFiles) {
    const content = readTextSafe(file);
    if (!content) continue;
    workflows.push(parseWorkflow(file, path.basename(file), content, 'github-actions'));
  }

  const gitlabFile = resolve(cwd, '.gitlab-ci.yml');
  const gitlabContent = readTextSafe(gitlabFile);
  if (gitlabContent) {
    workflows.push(parseWorkflow(gitlabFile, '.gitlab-ci.yml', gitlabContent, 'gitlab-ci'));
  }

  const circleFile = resolve(cwd, '.circleci', 'config.yml');
  const circleContent = readTextSafe(circleFile);
  if (circleContent) {
    workflows.push(parseWorkflow(circleFile, '.circleci/config.yml', circleContent, 'circleci'));
  }

  return { hasWorkflow: workflows.length > 0, workflows };
}

function parseWorkflow(filePath: string, filename: string, content: string, provider: CIProvider): WorkflowInfo {
  const usesSetupNode = content.includes('actions/setup-node') || content.includes('node:');

  let nodeVersion: string | undefined;
  const nodeMatch = content.match(/node-version['":\s]*['"]?([\d.]+x?|\d+)/i)
    ?? content.match(/node:\s*['"]?([\d.]+x?|\d+)/i)
    ?? content.match(/image:\s*node:([\d.]+)/i);
  if (nodeMatch) nodeVersion = nodeMatch[1];

  const usesCache =
    content.includes('actions/cache')
    || content.includes('cache:')
    || content.includes('restore_cache')
    || content.includes('save_cache');

  const cacheKeyDependsOnLockfile =
    content.includes('package-lock.json')
    || content.includes('yarn.lock')
    || content.includes('pnpm-lock.yaml');

  let easBuildCommand: string | undefined;
  let easProfile: string | undefined;
  const easMatch = content.match(/eas\s+build[^"'\n]*/i);
  if (easMatch) {
    easBuildCommand = easMatch[0].trim();
    const profileMatch = easBuildCommand.match(/--profile\s+(\S+)/i);
    if (profileMatch) easProfile = profileMatch[1];
  }

  const hasExpoToken = content.includes('EXPO_TOKEN');

  const hasInstallStep =
    /\bnpm\s+ci\b/i.test(content)
    || /\bnpm\s+install\b/i.test(content)
    || /\byarn\s+install\b/i.test(content)
    || /\byarn\s+--frozen-lockfile\b/i.test(content)
    || /\bpnpm\s+(install|i)\b/i.test(content);

  let packageManagerHint: WorkflowInfo['packageManagerHint'];
  if (/\bpnpm\b/i.test(content)) packageManagerHint = 'pnpm';
  else if (/\byarn\b/i.test(content)) packageManagerHint = 'yarn';
  else if (/\bnpm\b/i.test(content)) packageManagerHint = 'npm';

  return {
    filePath,
    filename,
    provider,
    usesSetupNode,
    nodeVersion,
    usesCache,
    cacheKeyDependsOnLockfile,
    easBuildCommand,
    easProfile,
    hasExpoToken,
    hasInstallStep,
    packageManagerHint,
  };
}
