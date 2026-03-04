import * as semver from 'semver';
import { getCwd } from '../utils/context.js';
import { detectProject } from '../detectors/project.js';
import { printTitle, createTable, icons, colors } from '../utils/logger.js';

const SDK_RN_COMPAT: Record<string, string> = {
  '52': '0.76',
  '51': '0.74',
  '50': '0.73',
  '49': '0.72',
  '48': '0.71',
};

export async function depsCommand(): Promise<void> {
  const cwd = getCwd();
  printTitle('expo-ci-doctor deps');
  
  const info = detectProject(cwd);
  
  if (!info.hasPackageJson) {
    console.log(colors.error(`  ${icons.error} No package.json found.`));
    process.exit(1);
  }

  const expoVersion = info.expoVersion;
  if (!expoVersion) {
    console.log(colors.error(`  ${icons.error} Expo is not installed in this project.`));
    process.exit(1);
  }

  const expoCoerced = semver.coerce(expoVersion);
  const sdkMajor = expoCoerced ? String(expoCoerced.major) : 'unknown';

  const table = createTable(['Package', 'Installed', 'Expected', 'Status']);

  // Check React Native
  const rnVersion = info.reactNativeVersion || 'missing';
  let rnExpected = SDK_RN_COMPAT[sdkMajor] ? `~${SDK_RN_COMPAT[sdkMajor]}.0` : 'unknown';
  let rnStatus = icons.success + ' compatible';
  
  if (rnVersion !== 'missing' && sdkMajor !== 'unknown' && SDK_RN_COMPAT[sdkMajor]) {
    const rnCoerced = semver.coerce(rnVersion);
    if (rnCoerced && `${rnCoerced.major}.${rnCoerced.minor}` !== SDK_RN_COMPAT[sdkMajor]) {
      rnStatus = icons.warning + ' mismatch';
    }
  } else if (rnVersion === 'missing') {
    rnStatus = icons.error + ' missing';
  }

  table.push(['react-native', rnVersion, rnExpected, rnStatus]);

  // Check Expo packages
  const allDeps = { ...info.dependencies, ...info.devDependencies };
  const expoPackages = Object.keys(allDeps).filter(pkg => pkg.startsWith('expo-') || pkg === 'expo');

  for (const pkg of expoPackages) {
    if (pkg === 'expo') continue; // already checked SDK
    
    const version = allDeps[pkg];
    let status = icons.success + ' compatible';
    let expected = 'Any (pinned)';
    
    // Simple heuristic: Expo packages should ideally be pinned with ~ for minor updates, or bundled via expo install.
    if (version.startsWith('^')) {
      status = icons.warning + ' update recommended (use ~)';
      expected = version.replace('^', '~');
    } else if (version === '*') {
      status = icons.error + ' highly discouraged';
      expected = 'pinned';
    }

    table.push([pkg, version, expected, status]);
  }

  console.log(colors.dim(`  Analyzing dependencies for Expo SDK ${sdkMajor}...\n`));
  console.log(table.toString());
  console.log('\n  ' + colors.dim('Tip: Use "npx expo install --check" for an exhaustive official check.'));
}
