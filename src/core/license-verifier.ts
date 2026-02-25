import { readConfig, writeConfig, CachedLicenseStatus } from './license-config.js';

const DEFAULT_BASE_URL = 'https://expocidoctor.dev';

let memoryCache: { key: string; status: CachedLicenseStatus; at: number } | null = null;

export async function verifyLicense(key: string): Promise<CachedLicenseStatus> {
  const baseUrl = process.env.EXPO_CI_DOCTOR_API_URL || DEFAULT_BASE_URL;
  const forceVerify = process.env.EXPO_CI_DOCTOR_FORCE_VERIFY === '1';

  const config = readConfig();
  const now = Date.now();

  if (!forceVerify) {
    // 1. Check in-memory cache
    if (memoryCache && memoryCache.key === key) {
      const ageMs = now - memoryCache.at;
      const isCacheActive = memoryCache.status.status === 'active';
      const ttlMs = isCacheActive ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
      if (ageMs < ttlMs) {
        return memoryCache.status;
      }
    }
    
    // 2. Check disk cache
    if (config.key === key && config.cachedStatus && config.lastVerifiedAt) {
      const lastAt = new Date(config.lastVerifiedAt).getTime();
      const ageMs = now - lastAt;
      const isCacheActive = config.cachedStatus.status === 'active';
      const ttlMs = isCacheActive ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
      if (ageMs < ttlMs) {
        memoryCache = { key, status: config.cachedStatus, at: lastAt };
        return config.cachedStatus;
      }
    }
  }

  // Fetch from backend
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const url = new URL('/api/license/verify', baseUrl);
    url.searchParams.set('key', key);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json() as CachedLicenseStatus;
    
    memoryCache = { key, status: data, at: now };
    
    // Cache to disk only if this key is the saved one
    if (config.key === key) {
        writeConfig({
           ...config,
           lastVerifiedAt: new Date(now).toISOString(),
           cachedStatus: data,
        });
    }
    
    return data;
  } catch (err: unknown) {
    // Check grace period (7 days) for disk cache
    if (config.key === key && config.cachedStatus?.status === 'active' && config.lastVerifiedAt) {
       const lastAt = new Date(config.lastVerifiedAt).getTime();
       const ageMs = now - lastAt;
       if (ageMs < 7 * 24 * 60 * 60 * 1000) {
           return config.cachedStatus;
       }
    }
    
    // Check grace period for memory cache
    if (memoryCache?.key === key && memoryCache.status.status === 'active') {
        const ageMs = now - memoryCache.at;
        if (ageMs < 7 * 24 * 60 * 60 * 1000) {
           return memoryCache.status;
        }
    }

    const message = err instanceof Error ? err.message : 'Unknown network error';

    // Fallback if no grace period applies or wasn't active
    return {
       valid: false,
       status: 'not_found',
       plan: 'free',
       message: `Could not verify license: ${message}`,
       expiresAt: null
    };
  }
}
