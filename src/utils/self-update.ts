import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const CACHE_DIR  = path.join(os.homedir(), '.expo-ci-doctor');
const CACHE_FILE = path.join(CACHE_DIR, 'update-check.json');
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCache {
  lastCheckedAt: string;
  latestVersion: string | null;
}

function readCache(): UpdateCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function writeCache(data: UpdateCache): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Non-critical — ignore write failures silently
  }
}

function fetchLatestVersion(packageName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${packageName}/latest`;
    const req = https.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.version ?? null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Check for a newer version of expo-ci-doctor.
 *
 * - Checks are cached for 24 hours to avoid network overhead on every run.
 * - Non-blocking: the returned Promise resolves immediately from cache if valid.
 * - Never throws — network failures are silently swallowed.
 *
 * Returns the latest version string if a newer version exists, null otherwise.
 */
export async function checkForUpdate(currentVersion: string): Promise<string | null> {
  const cache = readCache();
  const now   = Date.now();

  // Use cached result if fresh
  if (cache && cache.lastCheckedAt) {
    const elapsed = now - new Date(cache.lastCheckedAt).getTime();
    if (elapsed < CHECK_INTERVAL_MS) {
      return isNewer(cache.latestVersion, currentVersion) ? cache.latestVersion : null;
    }
  }

  // Fetch from npm registry in background — non-blocking
  const latest = await fetchLatestVersion('expo-ci-doctor');
  writeCache({ lastCheckedAt: new Date().toISOString(), latestVersion: latest });

  return isNewer(latest, currentVersion) ? latest : null;
}

function isNewer(latest: string | null, current: string): boolean {
  if (!latest) return false;
  try {
    // Simple semver comparison: split on '.', compare numerically
    const latestParts  = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const l = latestParts[i] ?? 0;
      const c = currentParts[i] ?? 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  } catch {
    return false;
  }
}
