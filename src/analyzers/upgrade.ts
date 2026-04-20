import * as semver from 'semver';

export interface UpgradeTarget {
  package: string;
  fromVersion: string | null;
  toVersion: string;
}

export interface UpgradeSafetyItem {
  item: string;
  risk: 'safe' | 'risky' | 'breaking';
  reason: string;
}

export interface UpgradeSafetyReport {
  target: UpgradeTarget;
  items: UpgradeSafetyItem[];
  safe: UpgradeSafetyItem[];
  risky: UpgradeSafetyItem[];
  breaking: UpgradeSafetyItem[];
  summary: string;
}

// ─── Expo SDK compat table ────────────────────────────────────────────

const EXPO_SDK_COMPAT: Record<number, {
  reactNative: string;
  nodeMin: string;
  deprecatedOptions?: string[];
  breakingPlugins?: string[];
}> = {
  52: { reactNative: '0.76', nodeMin: '18.0.0' },
  51: { reactNative: '0.74', nodeMin: '18.0.0', deprecatedOptions: ['android.adaptiveIcon.foregroundImage without backgroundColor'] },
  50: { reactNative: '0.73', nodeMin: '18.0.0' },
  49: { reactNative: '0.72', nodeMin: '16.0.0' },
  48: { reactNative: '0.71', nodeMin: '16.0.0' },
};

export type ExpoSdkCompat = {
  reactNative: string;
  nodeMin: string;
  deprecatedOptions?: string[];
  breakingPlugins?: string[];
};

export function getSupportedExpoSdks(): number[] {
  return Object.keys(EXPO_SDK_COMPAT).map(Number).sort((a, b) => a - b);
}

export function getExpoSdkCompat(sdk: number): ExpoSdkCompat | null {
  return EXPO_SDK_COMPAT[sdk] ?? null;
}

/**
 * Parse a package@version string into upgrade target info.
 * Supports: expo@51, expo@latest, eas-cli@latest, @expo/cli@51
 */
export function parseUpgradeTarget(input: string, currentDeps: Record<string, string>): UpgradeTarget {
  const atIdx = input.lastIndexOf('@');
  let pkg = input;
  let toVersion = 'latest';

  if (atIdx > 0) {
    pkg = input.slice(0, atIdx);
    toVersion = input.slice(atIdx + 1);
  }

  const fromVersion = currentDeps[pkg] ?? null;

  return { package: pkg, fromVersion, toVersion };
}

/**
 * Simulate an upgrade and produce a safety report.
 *
 * This is a rule-based simulation, not live npm resolution.
 * It uses the known compat table and project signals to classify
 * changes as safe, risky, or breaking.
 */
export function generateUpgradeSafetyReport(
  target: UpgradeTarget,
  currentDeps: Record<string, string>,
  enginesNode?: string,
): UpgradeSafetyReport {
  const items: UpgradeSafetyItem[] = [];

  const pkg = target.package;
  const toVer = target.toVersion === 'latest' ? null : semver.coerce(target.toVersion);

  // ─── Expo SDK upgrade analysis ──────────────────────────────────
  if (pkg === 'expo' && toVer) {
    const toSdk = toVer.major;
    const fromCoerced = target.fromVersion ? semver.coerce(target.fromVersion) : null;
    const fromSdk = fromCoerced?.major ?? 0;

    const compat = EXPO_SDK_COMPAT[toSdk];
    const fromCompat = fromSdk ? EXPO_SDK_COMPAT[fromSdk] : null;

    if (compat) {
      // Check react-native compatibility
      const currentRN = currentDeps['react-native'];
      const expectedRN = compat.reactNative;
      const currentRNCoerced = currentRN ? semver.coerce(currentRN) : null;
      const expectedRNCoerced = semver.coerce(expectedRN);

      if (currentRNCoerced && expectedRNCoerced) {
        const rnMatch =
          currentRNCoerced.major === expectedRNCoerced.major &&
          currentRNCoerced.minor === expectedRNCoerced.minor;

        items.push({
          item: `React Native version (expected ${expectedRN}.x)`,
          risk: rnMatch ? 'safe' : 'risky',
          reason: rnMatch
            ? `Current react-native@${currentRN} is compatible with Expo SDK ${toSdk}.`
            : `Expo SDK ${toSdk} requires react-native@${expectedRN}.x but you have ${currentRN}. Run: npx expo install react-native`,
        });
      } else {
        items.push({
          item: 'React Native version compatibility',
          risk: 'risky',
          reason: `Could not determine react-native version. Verify it matches the expected ${expectedRN}.x for SDK ${toSdk}.`,
        });
      }

      // Node version minimum
      const nodeOk = enginesNode
        ? (semver.satisfies(semver.coerce(compat.nodeMin)?.version ?? '18.0.0', `>=${semver.coerce(enginesNode)?.version ?? '0'}`) ||
           semver.gte(semver.coerce(enginesNode)?.version ?? '0.0.0', compat.nodeMin))
        : false;

      items.push({
        item: `Node.js minimum (${compat.nodeMin}+)`,
        risk: nodeOk ? 'safe' : 'risky',
        reason: nodeOk
          ? `Your engines.node (${enginesNode}) satisfies SDK ${toSdk}'s minimum of ${compat.nodeMin}.`
          : `SDK ${toSdk} requires Node.js ${compat.nodeMin}+. Update engines.node in package.json and your CI setup-node version.`,
      });

      // Deprecated options
      if (compat.deprecatedOptions) {
        for (const opt of compat.deprecatedOptions) {
          items.push({
            item: `Deprecated config option: ${opt}`,
            risk: 'risky',
            reason: `This EAS/Expo config option is deprecated in SDK ${toSdk} and may be removed in the next release.`,
          });
        }
      }

      // Major version jump check
      if (fromSdk && toSdk - fromSdk > 1) {
        items.push({
          item: `Major version jump: SDK ${fromSdk} → ${toSdk} (+${toSdk - fromSdk} versions)`,
          risk: 'breaking',
          reason: `Jumping more than one major SDK version is not officially supported. Upgrade one version at a time to isolate breaking changes.`,
        });
      }
    } else {
      items.push({
        item: `Expo SDK ${toSdk} compatibility data`,
        risk: 'risky',
        reason: `No compatibility data available for SDK ${toSdk}. Verify release notes and upgrade guide manually.`,
      });
    }
  }

  // ─── EAS CLI upgrade ─────────────────────────────────────────────
  if (pkg === 'eas-cli' || pkg === '@expo/eas-cli') {
    items.push({
      item: 'EAS CLI version upgrade',
      risk: 'safe',
      reason: 'EAS CLI upgrades are generally backwards compatible. Verify release notes for any profile or config schema changes.',
    });
    items.push({
      item: 'EAS config format compatibility',
      risk: 'risky',
      reason: 'Check eas.json for any fields that were renamed or removed in the new CLI version.',
    });
  }

  // ─── Generic package ─────────────────────────────────────────────
  if (items.length === 0) {
    items.push({
      item: `Package: ${pkg}`,
      risk: 'safe',
      reason: `No specific compatibility rules for ${pkg}. Verify package changelog before upgrading.`,
    });
  }

  const safe     = items.filter(i => i.risk === 'safe');
  const risky    = items.filter(i => i.risk === 'risky');
  const breaking = items.filter(i => i.risk === 'breaking');

  const summary = breaking.length > 0
    ? `Upgrade blocked by ${breaking.length} breaking change(s). Address these before proceeding.`
    : risky.length > 0
    ? `Upgrade possible with caution. Review ${risky.length} risky item(s) before merging.`
    : 'Upgrade appears safe based on static analysis. Verify in a branch before merging.';

  return { target, items, safe, risky, breaking, summary };
}
