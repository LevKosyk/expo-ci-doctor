import * as path from 'node:path';
import { readTextSafe, findFilesByExt, resolve } from '../utils/context.js';

// ─── Output shape ───────────────────────────────────────────────────

export interface CIInfo {
  hasWorkflow: boolean;
  workflows: WorkflowInfo[];
}

export interface WorkflowInfo {
  filename: string;
  usesSetupNode: boolean;
  nodeVersion?: string;
  usesCache: boolean;
  cacheKeyDependsOnLockfile: boolean;
  easBuildCommand?: string;
  easProfile?: string;
  hasExpoToken: boolean;
}

// ─── Detector ───────────────────────────────────────────────────────

export function detectCI(cwd: string): CIInfo {
  const workflowDir = resolve(cwd, '.github', 'workflows');
  const ymlFiles = [
    ...findFilesByExt(workflowDir, '.yml'),
    ...findFilesByExt(workflowDir, '.yaml'),
  ];

  if (ymlFiles.length === 0) {
    return { hasWorkflow: false, workflows: [] };
  }

  const workflows: WorkflowInfo[] = [];

  for (const file of ymlFiles) {
    const content = readTextSafe(file);
    if (!content) continue;

    const filename = path.basename(file);

    // ── setup-node ────────────────────────────────────────────────
    const usesSetupNode = content.includes('actions/setup-node');

    // ── Node version ──────────────────────────────────────────────
    let nodeVersion: string | undefined;
    const nodeMatch = content.match(/node-version['":\s]*['"]?(\d+[\d.x]*)/);
    if (nodeMatch) nodeVersion = nodeMatch[1];

    // ── Cache ─────────────────────────────────────────────────────
    const usesCache =
      content.includes('actions/cache') ||
      (usesSetupNode && /cache['":\s]*['"]?(npm|yarn|pnpm)/.test(content));

    const cacheKeyDependsOnLockfile =
      content.includes('package-lock.json') ||
      content.includes('yarn.lock') ||
      content.includes('pnpm-lock.yaml');

    // ── EAS build ─────────────────────────────────────────────────
    let easBuildCommand: string | undefined;
    let easProfile: string | undefined;

    const easMatch = content.match(/eas\s+build[^"'\n]*/);
    if (easMatch) {
      easBuildCommand = easMatch[0].trim();
      const profileMatch = easBuildCommand.match(/--profile\s+(\S+)/);
      if (profileMatch) easProfile = profileMatch[1];
    }

    // ── EXPO_TOKEN ────────────────────────────────────────────────
    const hasExpoToken = content.includes('EXPO_TOKEN');

    workflows.push({
      filename,
      usesSetupNode,
      nodeVersion,
      usesCache,
      cacheKeyDependsOnLockfile,
      easBuildCommand,
      easProfile,
      hasExpoToken,
    });
  }

  return { hasWorkflow: true, workflows };
}
