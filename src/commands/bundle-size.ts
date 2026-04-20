import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { printTitle, printSuccess, printWarning, printInfo } from '../utils/logger.js';
import { getRuntime } from '../utils/runtime.js';

function getFolderSize(dir: string): { totalSize: number; largeFiles: { path: string; size: number }[] } {
  let totalSize = 0;
  const largeFiles: { path: string; size: number }[] = [];
  
  if (!fs.existsSync(dir)) return { totalSize, largeFiles };

  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      const res = getFolderSize(fullPath);
      totalSize += res.totalSize;
      largeFiles.push(...res.largeFiles);
    } else {
      const sizeList = fs.statSync(fullPath).size;
      totalSize += sizeList;
      if (sizeList > 1024 * 1024) { // > 1MB
        largeFiles.push({ path: fullPath, size: sizeList });
      }
    }
  }
  return { totalSize, largeFiles };
}

export async function bundleSizeCommand(): Promise<void> {
  const runtime = getRuntime();
  if (!runtime.silent) printTitle('expo-ci-doctor bundle-size');

  const assetsDir = path.join(process.cwd(), 'assets');
  if (!fs.existsSync(assetsDir)) {
    printInfo('No "assets" directory found. Bundle size looks clean.');
    return;
  }

  const { totalSize, largeFiles } = getFolderSize(assetsDir);
  const totalMB = (totalSize / (1024 * 1024)).toFixed(2);

  if (largeFiles.length > 0) {
    printWarning(`Found ${largeFiles.length} large uncompressed asset(s) (>1MB):`);
    largeFiles.forEach(f => {
      const mb = (f.size / (1024 * 1024)).toFixed(2);
      console.log(chalk.dim(`  - ${path.relative(process.cwd(), f.path)} (${mb} MB)`));
    });
  }

  if (totalSize > 20 * 1024 * 1024) { // > 20MB
    printWarning(`Total assets size is large: ${totalMB} MB. This will bloat the IPA/APK.`);
  } else {
    printSuccess(`Total assets size is well-optimized: ${totalMB} MB.`);
  }
}
