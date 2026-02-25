import { readConfig } from './license-config.js';
import { verifyLicense } from './license-verifier.js';

export interface Entitlements {
  tier: 'free' | 'starter' | 'pro' | 'lifetime';
  status: 'active' | 'revoked' | 'not_found' | 'expired' | 'past_due' | 'canceled';
  canUseProRules: boolean;
  canUseDoctor: boolean;
  canUseAnalyze: boolean;
  source: 'ci' | 'local' | 'none';
  key: string | null;
  lastVerifiedAt: string | null;
}

export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.EXPO_CI_DOCTOR_KEY
  );
}

// Memoize the result so we don't spam verification during a single CLI run
let resolvedEntitlements: Entitlements | null = null;

export async function getLicenseEntitlements(): Promise<Entitlements> {
  if (resolvedEntitlements) {
    return resolvedEntitlements;
  }

  const envKey = process.env.EXPO_CI_DOCTOR_KEY;
  const config = readConfig();

  const keyToUse = envKey || config.key;
  const source = envKey ? 'ci' : (config.key ? 'local' : 'none');

  if (!keyToUse) {
    resolvedEntitlements = {
      tier: 'free',
      status: 'not_found',
      canUseProRules: false,
      canUseDoctor: false,
      canUseAnalyze: false,
      source: 'none',
      key: null,
      lastVerifiedAt: null,
    };
    return resolvedEntitlements;
  }

  const status = await verifyLicense(keyToUse);

  const isValidAndActive = status.valid && status.status === 'active';
  const tier = isValidAndActive ? status.plan : 'free';

  const canUsePro = isValidAndActive && (tier === 'pro' || tier === 'lifetime' || tier === 'starter');
  
  resolvedEntitlements = {
    tier: isValidAndActive ? status.plan : 'free',
    status: status.status,
    canUseProRules: isValidAndActive,
    canUseDoctor: canUsePro,
    canUseAnalyze: canUsePro,
    source,
    key: keyToUse,
    // When using env key, we don't necessarily have disk lastVerifiedAt if it wasn't saved locally
    lastVerifiedAt: source === 'local' ? (config.lastVerifiedAt || null) : new Date().toISOString(),
  };

  return resolvedEntitlements;
}

export function resetEntitlementsCache(): void {
  resolvedEntitlements = null;
}

export async function requireProFeature(featureName: string): Promise<void> {
  const entitlements = await getLicenseEntitlements();
  if (!entitlements.canUseProRules) {
    console.warn(`\n[PRO FEATURE] '${featureName}' is a Pro-only feature.`);
    console.warn(`Please upgrade and run \`expo-ci-doctor login <key>\` to unlock.`);
    console.warn(`Learn more at: https://expo-ci-doctor.com/pricing\n`);
    // Graceful exit instead of crash
    process.exit(0);
  }
}
