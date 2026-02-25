import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface CachedLicenseStatus {
  valid: boolean;
  status: 'active' | 'revoked' | 'not_found' | 'expired' | 'past_due' | 'canceled';
  plan: 'lifetime' | 'starter' | 'pro' | 'free';
  message: string | null;
  expiresAt: string | null;
}

export interface LicenseConfig {
  key?: string;
  lastVerifiedAt?: string;
  cachedStatus?: CachedLicenseStatus;
}

export function getConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'expo-ci-doctor');
  }
  return path.join(os.homedir(), '.config', 'expo-ci-doctor');
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

export function readConfig(): LicenseConfig {
  const configPath = getConfigPath();
  try {
    if (!fs.existsSync(configPath)) return {};
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as LicenseConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: LicenseConfig): void {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Best effort permissions
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

export function removeConfig(): void {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

export function saveKey(key: string): { ok: boolean; error?: string } {
  // We don't strictly validate format here other than non-empty,
  // let the backend decide if it's valid.
  if (!key || key.trim() === '') {
    return { ok: false, error: 'Key cannot be empty.' };
  }
  
  const existingConfig = readConfig();
  writeConfig({
    ...existingConfig,
    key: key.trim(),
    // Clear out cached stuff so a new verify happens cleanly
    lastVerifiedAt: undefined,
    cachedStatus: undefined,
  });
  
  return { ok: true };
}
