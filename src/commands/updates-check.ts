import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { printTitle, printSuccess, printWarning, printError, printInfo, icons } from '../utils/logger.js';
import { getRuntime } from '../utils/runtime.js';

export async function updatesCheckCommand(): Promise<void> {
  const runtime = getRuntime();
  if (!runtime.silent) printTitle('expo-ci-doctor updates-check');

  const appJsonPath = path.join(process.cwd(), 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    console.log(`${icons.error} ${chalk.red('app.json not found in current directory.')}`);
    return;
  }

  const appData = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const expoData = appData.expo || {};

  const updatesUrl = expoData.updates?.url;
  const runtimeVersion = expoData.runtimeVersion;

  if (!updatesUrl) {
    if (!runtime.silent) printInfo('EAS Update is not configured (missing updates.url in app.json).');
    return;
  }

  if (!runtimeVersion) {
    console.log(`${icons.error} ${chalk.red('EAS Update is configured, but runtimeVersion is missing in app.json.')}`);
    console.log(chalk.dim('  This can lead to OTA updates crashing if native modules are changed.'));
    console.log(chalk.dim('  Recommendation: Add "runtimeVersion": { "policy": "appVersion" } or explicitly set it.'));
    return;
  }

  if (typeof runtimeVersion === 'string') {
    printWarning(`runtimeVersion is hardcoded to "${runtimeVersion}". Ensure you bump this version when native dependencies change.`);
  } else if (runtimeVersion.policy === 'sdkVersion') {
    printWarning(`runtimeVersion uses "sdkVersion" policy. It is highly recommended to use "appVersion" or "fingerprint" for safer OTA updates.`);
  } else {
    printSuccess(`runtimeVersion is configured correctly using policy: ${runtimeVersion.policy || JSON.stringify(runtimeVersion)}`);
  }
}
