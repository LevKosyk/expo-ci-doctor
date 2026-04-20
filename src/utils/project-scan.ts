import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectProject } from '../detectors/project.js';
import { loadConfig } from './config-loader.js';
import { fileExists, readJsonSafe, readTextSafe, resolve } from './context.js';
import type { ProjectInfo } from './types.js';

export interface ProjectTarget {
  cwd: string;
  label: string;
  info: ProjectInfo;
  config: ReturnType<typeof loadConfig>;
}

export function loadProjectTargets(rootCwd: string, includeWorkspaces = false): ProjectTarget[] {
  if (!includeWorkspaces) {
    return [makeTarget(rootCwd, rootCwd)];
  }

  const workspaceRoots = discoverWorkspaceRoots(rootCwd);
  const orderedRoots = unique([rootCwd, ...workspaceRoots]);
  return orderedRoots.map((cwd) => makeTarget(rootCwd, cwd));
}

export function discoverWorkspaceRoots(rootCwd: string): string[] {
  const packageJson = readJsonSafe(resolve(rootCwd, 'package.json'));
  const patterns = new Set<string>([
    ...extractWorkspacePatterns(packageJson),
    ...extractPnpmPatterns(rootCwd),
    ...extractLernaPatterns(rootCwd),
  ].filter(Boolean));

  const candidates = new Set<string>();
  for (const pattern of patterns) {
    for (const candidate of expandWorkspacePattern(rootCwd, pattern)) {
      candidates.add(candidate);
    }
  }

  if (candidates.size === 0) {
    for (const candidate of scanCandidateDirs(rootCwd, 4)) {
      candidates.add(candidate);
    }
  }

  const roots = [...candidates].filter((cwd) => looksLikeExpoApp(cwd));
  return unique(roots);
}

function makeTarget(rootCwd: string, cwd: string): ProjectTarget {
  return {
    cwd,
    label: path.relative(rootCwd, cwd) || '.',
    info: detectProject(cwd),
    config: loadConfig(cwd),
  };
}

function extractWorkspacePatterns(pkg: Record<string, unknown> | null): string[] {
  const patterns: string[] = [];
  if (!pkg?.workspaces) return patterns;

  if (Array.isArray(pkg.workspaces)) {
    for (const item of pkg.workspaces) {
      if (typeof item === 'string') patterns.push(item);
    }
    return patterns;
  }

  if (typeof pkg.workspaces === 'object') {
    const workspaces = pkg.workspaces as Record<string, unknown>;
    const packages = workspaces.packages;
    if (Array.isArray(packages)) {
      for (const item of packages) {
        if (typeof item === 'string') patterns.push(item);
      }
    }
  }

  return patterns;
}

function extractPnpmPatterns(rootCwd: string): string[] {
  const filePath = resolve(rootCwd, 'pnpm-workspace.yaml');
  const text = readTextSafe(filePath);
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) => line.replace(/^[-\s]+/, '').replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function extractLernaPatterns(rootCwd: string): string[] {
  const filePath = resolve(rootCwd, 'lerna.json');
  const data = readJsonSafe(filePath);
  const patterns: string[] = [];
  if (!data) return patterns;

  if (Array.isArray(data.packages)) {
    for (const item of data.packages) {
      if (typeof item === 'string') patterns.push(item);
    }
  }

  return patterns;
}

function expandWorkspacePattern(rootCwd: string, pattern: string): string[] {
  const normalized = pattern.replace(/\\/g, '/').replace(/^\.\//, '');
  const regex = globToRegex(normalized);
  const roots: string[] = [];

  for (const candidate of scanCandidateDirs(rootCwd, 4)) {
    const relative = path.relative(rootCwd, candidate).replace(/\\/g, '/');
    if (regex.test(relative)) {
      roots.push(candidate);
    }
  }

  return roots;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*')
    .replace(/\\\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function scanCandidateDirs(rootCwd: string, maxDepth: number, currentDir = rootCwd, depth = 0, out: string[] = []): string[] {
  if (depth > maxDepth) return out;

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name.startsWith('.git') || entry.name === 'dist' || entry.name === 'build' || entry.name === 'coverage') {
      continue;
    }

    const nextDir = path.join(currentDir, entry.name);
    if (fileExists(resolve(nextDir, 'package.json'))) {
      out.push(nextDir);
    }

    scanCandidateDirs(rootCwd, maxDepth, nextDir, depth + 1, out);
  }

  return out;
}

function looksLikeExpoApp(cwd: string): boolean {
  const pkg = readJsonSafe(resolve(cwd, 'package.json'));
  if (!pkg) return false;

  const deps = {
    ...((pkg.dependencies ?? {}) as Record<string, string>),
    ...((pkg.devDependencies ?? {}) as Record<string, string>),
  };

  return Boolean(
    deps.expo
    || fileExists(resolve(cwd, 'app.json'))
    || fileExists(resolve(cwd, 'app.config.js'))
    || fileExists(resolve(cwd, 'app.config.ts'))
    || fileExists(resolve(cwd, 'eas.json')),
  );
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
