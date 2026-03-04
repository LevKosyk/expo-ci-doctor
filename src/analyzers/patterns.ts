import type { RuleLevel } from '../utils/types.js';

// ─── Pattern type ───────────────────────────────────────────────────

export type Confidence = 'high' | 'likely' | 'possible';

export interface ErrorPattern {
  id: string;
  level: RuleLevel;
  confidence: Confidence;
  /** Build stage where this failure typically occurs */
  stage: string;
  /** Root-cause priority: lower = more likely to be the root cause (1-100) */
  priority: number;
  test: (line: string) => boolean;
  title: string;
  explanation: string;
  fix: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function regex(re: RegExp): (line: string) => boolean {
  return (line) => re.test(line);
}

function includes(...needles: string[]): (line: string) => boolean {
  return (line) => {
    const lower = line.toLowerCase();
    return needles.some((n) => lower.includes(n.toLowerCase()));
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Expo / EAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const missingExpoToken: ErrorPattern = {
  id: 'log-missing-expo-token',
  level: 'error',
  confidence: 'high',
  stage: 'Auth',
  priority: 5,
  test: includes(
    'not authenticated',
    'EXPO_TOKEN',
    'expo: not logged in',
    'login to eas',
    'set expo_token',
    'not logged in to eas',
  ),
  title: 'Missing or invalid EXPO_TOKEN',
  explanation:
    'EAS CLI cannot authenticate against expo.dev servers. Without a valid EXPO_TOKEN, ' +
    'the build is rejected at the queue stage — before any code is compiled. You lose ' +
    '10-15 min of CI waiting time per attempt.',
  fix:
    '1. Generate a robot token: https://expo.dev/settings/access-tokens\n' +
    '2. Add EXPO_TOKEN as a GitHub Actions secret\n' +
    '3. Reference it in the workflow:\n' +
    '     env:\n' +
    '       EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}',
};

const invalidExpoCredentials: ErrorPattern = {
  id: 'log-invalid-credentials',
  level: 'error',
  confidence: 'high',
  stage: 'Auth',
  priority: 5,
  test: includes(
    'invalid credentials',
    'authentication failed',
    'unauthorized request',
    'invalid access token',
    'token is expired',
    'token has been revoked',
    '401 unauthorized',
    'forbidden',
  ),
  title: 'Invalid Expo credentials',
  explanation:
    'The EXPO_TOKEN is present in the environment but the server rejected it. ' +
    'Common causes: token was revoked after a team member left, token expired, ' +
    'or the token was copy-pasted with extra whitespace.',
  fix:
    '1. Go to https://expo.dev/settings/access-tokens\n' +
    '2. Revoke the old token and create a new robot token\n' +
    '3. Update the EXPO_TOKEN secret in CI — paste carefully, no trailing spaces',
};

const easProjectNotLinked: ErrorPattern = {
  id: 'log-eas-not-linked',
  level: 'error',
  confidence: 'high',
  stage: 'Auth',
  priority: 5,
  test: includes(
    'not configured for eas',
    'run eas init',
    'project is not linked',
    'owner field is not',
    'could not find project',
    'eas project id',
    'missing "extra.eas.projectid"',
  ),
  title: 'EAS project not linked',
  explanation:
    'EAS Build needs to know which expo.dev project to build for. Without the EAS project ID ' +
    'in app.json (extra.eas.projectId) and a matching slug/owner, the build is rejected immediately.',
  fix:
    '1. Run: npx eas init\n' +
    '2. Verify app.json has "owner", "slug", and "extra.eas.projectId"\n' +
    '3. Commit the updated app.json and eas.json',
};

const unsupportedSdkVersion: ErrorPattern = {
  id: 'log-unsupported-sdk',
  level: 'error',
  confidence: 'high',
  stage: 'Prebuild',
  priority: 10,
  test: regex(/sdk ?\d+.*(?:not supported|deprecated|end.of.life|no longer|has been removed)/i),
  title: 'Unsupported Expo SDK version',
  explanation:
    'The EAS Build server has dropped support for this SDK version. Expo deprecates SDKs ' +
    '~6 months after release. Once deprecated, the server images no longer include compatible ' +
    'NDK/JDK versions and the build fails at the native layer.',
  fix:
    '1. Check supported versions: https://docs.expo.dev/versions/latest/\n' +
    '2. Upgrade guide: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/\n' +
    '3. Run: npx expo install expo@latest\n' +
    '4. After upgrade: npx expo install --fix',
};

const configPluginFailure: ErrorPattern = {
  id: 'log-config-plugin-fail',
  level: 'error',
  confidence: 'likely',
  stage: 'Prebuild',
  priority: 15,
  test: includes(
    'config plugin',
    'withandroidmanifest',
    'withinfoplist',
    'withappdelegate',
    'plugin evaluation error',
    'cannot read properties of undefined',
    'expo-module',
    'expo-build-properties',
  ),
  title: 'Expo config plugin failure',
  explanation:
    'A config plugin crashed during `expo prebuild`. Config plugins are JS functions that ' +
    'modify native files (AndroidManifest.xml, Info.plist) before compilation. When a plugin ' +
    'throws, no native project is generated and the build stops. This usually means the plugin ' +
    'version is incompatible with the current SDK or receives unexpected input.',
  fix:
    '1. Identify the failing plugin from the stack trace\n' +
    '2. Check that plugin version matches your Expo SDK\n' +
    '3. Run locally: npx expo prebuild --clean\n' +
    '4. If custom plugin: check your withXxx() function inputs\n' +
    '5. Clear cache: npx expo prebuild --clean --no-install',
};

const metroError: ErrorPattern = {
  id: 'log-metro-error',
  level: 'error',
  confidence: 'likely',
  stage: 'Metro / JS',
  priority: 30,
  test: includes(
    'unable to resolve module',
    'metro has encountered an error',
    'error: unable to resolve',
    'bundling failed',
    'syntaxerror:',
    'unexpected token',
  ),
  title: 'Metro bundler error',
  explanation:
    'Metro failed to bundle the JavaScript code. This happens at the final JS compilation step — ' +
    'all native code compiled successfully, but the JS bundle could not be created. ' +
    'Common causes: missing module, syntax error, circular dependency.',
  fix:
    '1. Run the bundler locally: npx expo export --platform <platform>\n' +
    '2. Check the import path in the error — module may be missing or misspelled\n' +
    '3. Clear Metro cache: npx expo start --clear\n' +
    '4. Check for case-sensitive import mismatches (macOS is case-insensitive, Linux is not)',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// iOS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const noProvisioningProfile: ErrorPattern = {
  id: 'log-no-provisioning',
  level: 'error',
  confidence: 'high',
  stage: 'iOS',
  priority: 25,
  test: includes(
    'no matching provisioning profiles',
    'no provisioning profile',
    'provisioning profile.*not found',
    'no profiles for',
    'no signing certificate',
    'automatic signing is unable',
    'provisioning profile doesn\'t include',
  ),
  title: 'No matching provisioning profile (iOS)',
  explanation:
    'Xcode could not find a provisioning profile for this app\'s bundle identifier during the ' +
    'code signing step. The native code compiled successfully, but the final IPA cannot be ' +
    'signed. This usually means the bundle ID in app.json doesn\'t match Apple Developer, or ' +
    'the profile/cert was revoked.',
  fix:
    '1. Run: npx eas credentials  → iOS → set up provisioning\n' +
    '2. Verify "ios.bundleIdentifier" in app.json matches Apple Developer portal\n' +
    '3. For EAS Build: eas build --clear-credentials  (regenerates all)',
};

const codeSigningFailed: ErrorPattern = {
  id: 'log-code-signing',
  level: 'error',
  confidence: 'high',
  stage: 'iOS',
  priority: 25,
  test: regex(
    /code ?sign(ing)?.*(?:fail|error)|signing certificate.*(?:not found|expired|invalid)|no identity found|no valid signing identit/i,
  ),
  title: 'Code signing failed (iOS)',
  explanation:
    'The iOS binary was compiled but cannot be signed. The signing certificate is either ' +
    'missing from the build keychain, expired, or revoked. EAS Build normally manages this ' +
    'automatically — if it fails, the credentials stored on expo.dev are likely stale.',
  fix:
    '1. Run: npx eas credentials  → iOS → manage certificates\n' +
    '2. If expired: create a new cert in Apple Developer and re-upload\n' +
    '3. Force refresh: eas build --clear-credentials\n' +
    '4. Verify Apple Developer membership is active',
};

const bundleIdMismatch: ErrorPattern = {
  id: 'log-bundle-id-mismatch',
  level: 'error',
  confidence: 'likely',
  stage: 'iOS',
  priority: 20,
  test: includes(
    'bundle identifier',
    'does not match',
    'product bundle identifier',
    'PRODUCT_BUNDLE_IDENTIFIER',
    'doesn\'t match the bundle identifier',
  ),
  title: 'Bundle identifier mismatch (iOS)',
  explanation:
    'The iOS bundle identifier in the Xcode project doesn\'t match app.json or the ' +
    'provisioning profile. This commonly happens after manually editing the native project ' +
    'or using a plugin that overwrites the bundle ID.',
  fix:
    '1. Check "ios.bundleIdentifier" in app.json\n' +
    '2. Run: npx expo prebuild --clean  (regenerates native project)\n' +
    '3. Ensure the ID matches your Apple Developer portal and provisioning profile',
};

const podInstallFailed: ErrorPattern = {
  id: 'log-pod-install',
  level: 'error',
  confidence: 'likely',
  stage: 'Install',
  priority: 10,
  test: includes(
    'pod install failed',
    'cocoapods could not find',
    'no podspec found',
    'incompatible pod',
    '`pod install` failed',
    'error installing',
    'spec repo is too out-of-date',
  ),
  title: 'CocoaPods installation failed (iOS)',
  explanation:
    'CocoaPods failed to resolve or install native iOS dependencies. This happens before ' +
    'Xcode compilation — if pods fail, no iOS build is attempted. Usually caused by ' +
    'outdated pod specs, SDK version mismatch, or a native module with no podspec.',
  fix:
    '1. Update pod repo: cd ios && pod repo update\n' +
    '2. Reinstall: cd ios && pod install --repo-update\n' +
    '3. For managed Expo: npx expo prebuild --clean\n' +
    '4. Check that all native modules have matching Expo SDK versions',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Android
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const mergeDexFailed: ErrorPattern = {
  id: 'log-mergedex-fail',
  level: 'error',
  confidence: 'high',
  stage: 'Android',
  priority: 20,
  test: includes(
    'execution failed for task \':app:mergedex\'',
    'mergedexdebug',
    'mergedexrelease',
    'cannot fit requested classes in a single dex file',
    'too many classes',
    'cannot merge dex',
    'd8: cannot fit',
  ),
  title: 'Android MergeDex failure (64k method limit)',
  explanation:
    'The Android build hit the 64k method limit. Every Java/Kotlin class and method counts — ' +
    'large RN apps with many native modules easily exceed this. The DEX merge step combines ' +
    'all compiled classes into DEX files, and fails when they don\'t fit.',
  fix:
    '1. Enable multidex in android/app/build.gradle:\n' +
    '     defaultConfig {\n' +
    '       multiDexEnabled true\n' +
    '     }\n' +
    '2. For Expo managed: npx expo prebuild --clean  (multidex is auto-enabled)\n' +
    '3. Audit dependencies: remove unused native modules\n' +
    '4. Use: npx react-native-clean-project  to reset native dirs',
};

const keystoreNotFound: ErrorPattern = {
  id: 'log-keystore-missing',
  level: 'error',
  confidence: 'high',
  stage: 'Android',
  priority: 25,
  test: includes(
    'keystore.*not found',
    'keystore file does not exist',
    'jarsigner.*error',
    'failed to read key',
    'keystore was tampered with',
    'no key with alias',
    'keystore password was incorrect',
  ),
  title: 'Android keystore not found or invalid',
  explanation:
    'The APK/AAB signing step failed because the keystore file is missing, the password is wrong, ' +
    'or the key alias doesn\'t exist. The app binary was compiled successfully but cannot be ' +
    'signed for distribution.',
  fix:
    '1. Run: npx eas credentials  → Android → manage keystore\n' +
    '2. For local build: verify KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS env vars\n' +
    '3. Force refresh: eas build --clear-credentials\n' +
    '4. To create new: keytool -genkeypair -v -keystore release.jks -alias release',
};

const gradleDaemonCrash: ErrorPattern = {
  id: 'log-gradle-crash',
  level: 'error',
  confidence: 'high',
  stage: 'Android',
  priority: 20,
  test: includes(
    'gradle daemon disappeared',
    'gradle daemon.*crash',
    'gc overhead limit exceeded',
    'java.lang.outofmemoryerror',
    'metaspace',
    'unable to start the daemon',
    'could not create the java virtual machine',
    'insufficient memory',
  ),
  title: 'Gradle daemon crash / out of memory',
  explanation:
    'The Gradle JVM ran out of heap memory and the daemon process was killed by the OS. ' +
    'This aborts the entire build mid-compilation. Common in CI where memory is limited ' +
    'and multiple Gradle workers run in parallel.',
  fix:
    '1. Increase heap in android/gradle.properties:\n' +
    '     org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m\n' +
    '2. Reduce parallelism:\n' +
    '     org.gradle.workers.max=2\n' +
    '3. For EAS: use a larger image in eas.json\n' +
    '4. Disable daemon in CI: org.gradle.daemon=false',
};

const gradlePluginError: ErrorPattern = {
  id: 'log-gradle-plugin',
  level: 'error',
  confidence: 'likely',
  stage: 'Android',
  priority: 15,
  test: includes(
    'plugin with id',
    'was not found',
    'unsupported class file major version',
    'classpath could not be resolved',
    'gradle version',
    'agp version',
    'android gradle plugin',
  ),
  title: 'Android Gradle plugin / version error',
  explanation:
    'Gradle failed during project configuration — before any code is compiled. ' +
    'A plugin or the Android Gradle Plugin (AGP) version is incompatible with the JDK/Gradle ' +
    'version on the build server. This is especially common after SDK upgrades.',
  fix:
    '1. Check android/build.gradle for AGP version compatibility\n' +
    '2. Verify JDK version matches (AGP 8.x requires JDK 17)\n' +
    '3. Run: npx expo prebuild --clean  to regenerate\n' +
    '4. See: https://developer.android.com/build/releases/gradle-plugin',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CI / Node
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const nodeVersionIssue: ErrorPattern = {
  id: 'log-node-version',
  level: 'error',
  confidence: 'high',
  stage: 'CI / Environment',
  priority: 5,
  test: regex(
    /engine "node" is incompatible|unsupported (?:node|engine)|expected version.*node|node.*(?:not supported|version mismatch)|the current node version .* is not supported/i,
  ),
  title: 'Node.js version mismatch',
  explanation:
    'A package in the dependency tree requires a Node.js version that doesn\'t match the ' +
    'CI environment. npm/yarn checks engines during install and either warns or errors. ' +
    'Even if install succeeds, native modules compiled against wrong Node ABI will crash.',
  fix:
    '1. Read the error to find which package needs which Node\n' +
    '2. Pin Node in CI:\n' +
    '     - uses: actions/setup-node@v4\n' +
    '       with:\n' +
    '         node-version: 18\n' +
    '3. Match engines.node in package.json\n' +
    '4. Use .nvmrc for consistency',
};

const npmInstallFailed: ErrorPattern = {
  id: 'log-npm-install',
  level: 'error',
  confidence: 'likely',
  stage: 'Install',
  priority: 10,
  test: includes(
    'npm err!',
    'npm error',
    'eresolveerror',
    'eresolve',
    'could not resolve dependency',
    'peer dep',
    'conflicting peer',
    'unable to resolve dependency tree',
  ),
  title: 'npm/yarn dependency resolution failed',
  explanation:
    'npm or yarn could not resolve the dependency tree. This typically happens when peer ' +
    'dependencies conflict, a package was unpublished, or the registry is unreachable. ' +
    'This stops the build before any code is compiled.',
  fix:
    '1. Run npm install locally to see the full error\n' +
    '2. For peer dep conflicts: npm install --legacy-peer-deps\n' +
    '3. Add "overrides" in package.json for conflicting packages\n' +
    '4. Delete node_modules + lockfile and reinstall',
};

const diskSpaceFull: ErrorPattern = {
  id: 'log-disk-space',
  level: 'error',
  confidence: 'likely',
  stage: 'CI / Environment',
  priority: 40,
  test: includes(
    'no space left on device',
    'enospc',
    'disk quota exceeded',
    'not enough disk space',
    'write error: no space',
  ),
  title: 'Disk space exhausted on build server',
  explanation:
    'The build server ran out of disk space. This can happen at any build phase — ' +
    'npm install, Gradle cache, or Xcode derived data. Large node_modules trees and ' +
    'Android build caches are the usual culprits.',
  fix:
    '1. Clear CI cache: delete cached node_modules and Gradle dirs\n' +
    '2. Add cleanup step: rm -rf ~/.gradle/caches\n' +
    '3. For EAS: use a larger build image\n' +
    '4. Audit dependencies: remove unused packages',
};

const timeoutError: ErrorPattern = {
  id: 'log-timeout',
  level: 'warn',
  confidence: 'possible',
  stage: 'CI / Environment',
  priority: 80,
  test: includes(
    'timed out',
    'timeout of',
    'etimedout',
    'econnreset',
    'socket hang up',
    'network error',
    'fetch failed',
    'request to.*failed',
  ),
  title: 'Network timeout during build',
  explanation:
    'A network request timed out — likely during npm install, pod install, or Gradle dependency ' +
    'download. This is often transient (registry overload, CI network issues).',
  fix:
    '1. Retry the build — this is often transient\n' +
    '2. Add retry logic to CI for `npm ci` step\n' +
    '3. Use a package registry mirror\n' +
    '4. Increase timeout: npm config set fetch-timeout 600000',
};

// ─── Export all patterns ────────────────────────────────────────────

export const allPatterns: ErrorPattern[] = [
  // Expo / EAS
  missingExpoToken,
  invalidExpoCredentials,
  easProjectNotLinked,
  unsupportedSdkVersion,
  configPluginFailure,
  metroError,
  // iOS
  noProvisioningProfile,
  codeSigningFailed,
  bundleIdMismatch,
  podInstallFailed,
  // Android
  mergeDexFailed,
  keystoreNotFound,
  gradleDaemonCrash,
  gradlePluginError,
  // CI / Node
  nodeVersionIssue,
  npmInstallFailed,
  diskSpaceFull,
  timeoutError,
];
