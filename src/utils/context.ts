import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Reads and parses a JSON file. Returns null if file doesn't exist or can't be parsed.
 */
export function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Reads a text file and returns its trimmed content. Returns null if not found.
 */
export function readTextSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch {
    return null;
  }
}

/**
 * Finds files matching an extension in a directory (non-recursive).
 */
export function findFilesByExt(dir: string, ext: string): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(ext))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Checks if a file exists at the given path.
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Returns the current working directory context.
 */
export function getCwd(): string {
  return process.cwd();
}

/**
 * Resolves a path relative to the given root directory.
 */
export function resolve(root: string, ...segments: string[]): string {
  return path.resolve(root, ...segments);
}
