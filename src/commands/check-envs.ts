import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { printTitle, printSuccess, printWarning, printInfo, icons } from '../utils/logger.js';
import { getRuntime } from '../utils/runtime.js';

export async function checkEnvsCommand(): Promise<void> {
  const runtime = getRuntime();
  if (!runtime.silent) printTitle('expo-ci-doctor check-envs');

  const envExamplePath = path.join(process.cwd(), '.env.example');
  const envPath = path.join(process.cwd(), '.env');
  const easJsonPath = path.join(process.cwd(), 'eas.json');

  const getEnvKeys = (filePath: string) => {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split('=')[0]);
  };

  const exampleKeys = getEnvKeys(envExamplePath);
  const localKeys = getEnvKeys(envPath);

  if (exampleKeys.length === 0) {
    if (!runtime.silent) printInfo('No .env.example found or it is empty.');
  } else {
    const missingInLocal = exampleKeys.filter(k => !localKeys.includes(k));
    if (missingInLocal.length > 0 && fs.existsSync(envPath)) {
      printWarning(`Your local .env is missing keys defined in .env.example: ${missingInLocal.join(', ')}`);
    } else {
      printSuccess('.env matches .env.example structure.');
    }
  }

  if (fs.existsSync(easJsonPath)) {
    const easData = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    const easEnvKeys = new Set<string>();
    
    if (easData.build) {
      Object.keys(easData.build).forEach(profile => {
        if (easData.build[profile].env) {
          Object.keys(easData.build[profile].env).forEach(k => easEnvKeys.add(k));
        }
      });
    }

    if (easEnvKeys.size > 0 && exampleKeys.length > 0) {
      const missingFromExample = Array.from(easEnvKeys).filter(k => !exampleKeys.includes(k));
      if (missingFromExample.length > 0) {
        printWarning(`eas.json uses env vars not documented in .env.example: ${missingFromExample.join(', ')}`);
      } else {
        printSuccess('All eas.json env vars are documented in .env.example.');
      }
    }
  }
}
