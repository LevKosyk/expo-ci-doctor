import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ─── Types ──────────────────────────────────────────────────────────

export interface LicenseState {
  mode: 'free' | 'pro';
  source: 'local' | 'ci' | 'none';
  key?: string;
}

// ─── Config file location ───────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.expo-ci-doctor');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface ConfigFile {
  licenseKey?: string;
}

// ─── Read / write config ────────────────────────────────────────────

function readConfig(): ConfigFile {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as ConfigFile;
  } catch {
    return {};
  }
}

function writeConfig(config: ConfigFile): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ─── License key validation (stub — no server) ─────────────────────

/**
 * Basic offline validation.
 * Keys must start with "ecd_pro_" and be at least 20 chars.
 * In the future this can call a license server.
 */
function isValidKey(key: string): boolean {
  return key.startsWith('ecd_pro_') && key.length >= 20;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Resolve the current license state from env → local config → free.
 */
export function getLicenseState(): LicenseState {
  // 1. Check env (CI mode)
  const envKey = process.env.EXPO_CI_DOCTOR_KEY;
  if (envKey && isValidKey(envKey)) {
    return { mode: 'pro', source: 'ci', key: envKey };
  }

  // 2. Check local config
  const config = readConfig();
  if (config.licenseKey && isValidKey(config.licenseKey)) {
    return { mode: 'pro', source: 'local', key: config.licenseKey };
  }

  // 3. Free
  return { mode: 'free', source: 'none' };
}

/**
 * Is the CLI running in a CI environment?
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.EXPO_CI_DOCTOR_KEY
  );
}

/**
 * Save a license key locally.
 */
export function saveKey(key: string): { ok: boolean; error?: string } {
  if (!isValidKey(key)) {
    return { ok: false, error: 'Invalid key format. Keys start with "ecd_pro_" and are at least 20 characters.' };
  }
  writeConfig({ licenseKey: key });
  return { ok: true };
}

/**
 * Remove the local license key.
 */
export function removeKey(): void {
  writeConfig({});
}

/**
 * Get the config file path (for display).
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}
