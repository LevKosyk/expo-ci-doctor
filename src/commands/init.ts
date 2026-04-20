import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCwd } from '../utils/context.js';
import { colors, icons, printTitle } from '../utils/logger.js';
import { getRuntime } from '../utils/runtime.js';

export async function initCommand(options: { force?: boolean } = {}): Promise<void> {
  const cwd = getCwd();
  const runtime = getRuntime();
  const rcPath = path.join(cwd, '.expo-ci-doctorrc');

  if (!runtime.silent) {
    printTitle('expo-ci-doctor init');
  }

  if (fs.existsSync(rcPath) && !options.force) {
    if (!runtime.silent) {
      console.log(colors.warning(`  ${icons.warning} Config already exists: ${rcPath}`));
      console.log(colors.dim('  Use --force to overwrite.'));
      console.log('');
    } else {
      process.stdout.write(`INIT SKIP ${rcPath} exists\n`);
    }
    return;
  }

  const config = {
    rules: {
      'ci-missing-install': 'error',
      'ci-cache-no-lockfile': 'warn',
    },
    ignore: [],
    customRules: [
      {
        id: 'missing-env-example',
        title: 'Missing .env.example template',
        details: 'Create .env.example so contributors know required environment variables.',
        level: 'warn',
        fix: 'Create .env.example and include EXPO_TOKEN and other required keys.',
        when: { fileMissing: '.env.example' },
      },
    ],
  };

  fs.writeFileSync(rcPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  if (!runtime.silent) {
    console.log(colors.success(`  ${icons.success} Created: ${rcPath}`));
    console.log(colors.dim('  Run `expo-ci-doctor check --summary` to verify baseline health.'));
    console.log('');
  } else {
    process.stdout.write(`INIT OK ${rcPath}\n`);
  }
}
