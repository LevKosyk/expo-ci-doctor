import * as semver from 'semver';

export interface PluginCompatRange {
  supported: string;
  recommended?: string;
  notes?: string;
}

/**
 * Static compatibility matrix for popular Expo config plugins.
 * Values are conservative ranges to reduce false positives while still flagging risky drifts.
 */
export const SDK_PLUGIN_COMPAT: Record<number, Record<string, PluginCompatRange>> = {
  52: {
    'expo-router': { supported: '>=4.0.0 <5.0.0', recommended: '^4.0.0' },
    'expo-build-properties': { supported: '>=0.13.0 <1.0.0', recommended: '^0.13.0' },
    'expo-dev-client': { supported: '>=5.0.0 <6.0.0', recommended: '^5.0.0' },
    'expo-notifications': { supported: '>=0.29.0 <0.30.0', recommended: '^0.29.0' },
    'expo-location': { supported: '>=18.0.0 <19.0.0', recommended: '^18.0.0' },
    'expo-splash-screen': { supported: '>=0.29.0 <0.30.0', recommended: '^0.29.0' },
  },
  51: {
    'expo-router': { supported: '>=3.0.0 <4.0.0', recommended: '^3.0.0' },
    'expo-build-properties': { supported: '>=0.12.0 <1.0.0', recommended: '^0.12.0' },
    'expo-dev-client': { supported: '>=4.0.0 <5.0.0', recommended: '^4.0.0' },
    'expo-notifications': { supported: '>=0.28.0 <0.29.0', recommended: '^0.28.0' },
    'expo-location': { supported: '>=17.0.0 <18.0.0', recommended: '^17.0.0' },
    'expo-splash-screen': { supported: '>=0.28.0 <0.29.0', recommended: '^0.28.0' },
  },
  50: {
    'expo-router': { supported: '>=3.0.0 <4.0.0', recommended: '^3.0.0' },
    'expo-build-properties': { supported: '>=0.11.0 <1.0.0', recommended: '^0.11.0' },
    'expo-dev-client': { supported: '>=3.0.0 <4.0.0', recommended: '^3.0.0' },
    'expo-notifications': { supported: '>=0.27.0 <0.28.0', recommended: '^0.27.0' },
    'expo-location': { supported: '>=16.0.0 <17.0.0', recommended: '^16.0.0' },
    'expo-splash-screen': { supported: '>=0.27.0 <0.28.0', recommended: '^0.27.0' },
  },
  49: {
    'expo-router': { supported: '>=2.0.0 <3.0.0', recommended: '^2.0.0' },
    'expo-build-properties': { supported: '>=0.10.0 <1.0.0', recommended: '^0.10.0' },
    'expo-dev-client': { supported: '>=2.0.0 <3.0.0', recommended: '^2.0.0' },
    'expo-notifications': { supported: '>=0.26.0 <0.27.0', recommended: '^0.26.0' },
    'expo-location': { supported: '>=15.0.0 <16.0.0', recommended: '^15.0.0' },
    'expo-splash-screen': { supported: '>=0.26.0 <0.27.0', recommended: '^0.26.0' },
  },
  48: {
    'expo-router': { supported: '>=2.0.0 <3.0.0', recommended: '^2.0.0' },
    'expo-build-properties': { supported: '>=0.8.0 <1.0.0', recommended: '^0.8.0' },
    'expo-dev-client': { supported: '>=2.0.0 <3.0.0', recommended: '^2.0.0' },
    'expo-notifications': { supported: '>=0.25.0 <0.26.0', recommended: '^0.25.0' },
    'expo-location': { supported: '>=15.0.0 <16.0.0', recommended: '^15.0.0' },
    'expo-splash-screen': { supported: '>=0.25.0 <0.26.0', recommended: '^0.25.0' },
  },
};

export function getCompatMatrixForSdk(sdk: number): {
  mappedSdk: number;
  matrix: Record<string, PluginCompatRange>;
  exact: boolean;
} | null {
  if (SDK_PLUGIN_COMPAT[sdk]) {
    return { mappedSdk: sdk, matrix: SDK_PLUGIN_COMPAT[sdk], exact: true };
  }

  const known = Object.keys(SDK_PLUGIN_COMPAT)
    .map((x) => Number(x))
    .sort((a, b) => a - b);
  if (known.length === 0) return null;

  const lowerOrEqual = known.filter((k) => k <= sdk);
  const mapped = lowerOrEqual.length > 0 ? lowerOrEqual[lowerOrEqual.length - 1] : known[0];
  return { mappedSdk: mapped, matrix: SDK_PLUGIN_COMPAT[mapped], exact: false };
}

export function coerceInstalledVersion(range: string): string | null {
  try {
    return semver.minVersion(range)?.version ?? semver.coerce(range)?.version ?? null;
  } catch {
    return semver.coerce(range)?.version ?? null;
  }
}
