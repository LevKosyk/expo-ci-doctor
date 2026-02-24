import { readJsonSafe, resolve } from '../core/context.js';

// ─── Output shape ───────────────────────────────────────────────────

export interface EasInfo {
  hasEasJson: boolean;
  profiles: string[];
  profileData: Record<string, Record<string, unknown>>;
}

// ─── Detector ───────────────────────────────────────────────────────

export function detectEas(cwd: string): EasInfo {
  const raw = readJsonSafe(resolve(cwd, 'eas.json'));

  if (!raw) {
    return { hasEasJson: false, profiles: [], profileData: {} };
  }

  const build = raw.build as Record<string, Record<string, unknown>> | undefined;
  if (!build) {
    return { hasEasJson: true, profiles: [], profileData: {} };
  }

  return {
    hasEasJson: true,
    profiles: Object.keys(build),
    profileData: build,
  };
}
