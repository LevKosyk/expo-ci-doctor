import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { printTitle, printSuccess, printWarning, printInfo } from '../utils/logger.js';
import { getRuntime } from '../utils/runtime.js';

export async function validateRoutesCommand(): Promise<void> {
  const runtime = getRuntime();
  if (!runtime.silent) printTitle('expo-ci-doctor validate-routes');

  const appDirPath = path.join(process.cwd(), 'app');
  if (!fs.existsSync(appDirPath)) {
    printInfo('No "app" directory found. Skipping Expo Router validation.');
    return;
  }

  // Very basic check for scheme in app.json
  const appJsonPath = path.join(process.cwd(), 'app.json');
  let schemeFound = false;
  if (fs.existsSync(appJsonPath)) {
    const appData = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    if (!appData.expo?.scheme) {
      printWarning('Expo Router is used but no "scheme" is defined in app.json. Deep linking may not work.');
    } else {
      schemeFound = true;
      printSuccess(`Deep linking scheme is defined: ${appData.expo.scheme}`);
    }
  }

  // Scan for duplicate dynamic routes e.g., app/[id].tsx and app/[user].tsx in same folder
  let conflicts = 0;
  const checkFolder = (dir: string) => {
    let dynamicRoutes = 0;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      if (file.isDirectory()) {
        checkFolder(path.join(dir, file.name));
      } else {
        if (file.name.match(/^\[.*\]\.[tj]sx?$/)) {
          dynamicRoutes++;
        }
      }
    }

    if (dynamicRoutes > 1) {
      conflicts++;
      printWarning(`Multiple dynamic routes found in ${path.relative(process.cwd(), dir)}. This can cause routing conflicts in Expo Router.`);
    }
  };

  checkFolder(appDirPath);
  
  if (conflicts === 0) {
    printSuccess('Expo Router folder structure looks good.');
  }
}
