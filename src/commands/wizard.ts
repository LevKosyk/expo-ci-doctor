import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';
import { getCwd } from '../utils/context.js';
import { printTitle, icons, colors } from '../utils/logger.js';

export async function wizardCommand(): Promise<void> {
  const cwd = getCwd();
  printTitle('expo-ci-doctor wizard');

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'strictCi',
      message: 'Treat warnings as CI failures?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'ignoreExpoDetected',
      message: 'Hide informational "expo-detected" rule?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'addCustomRule',
      message: 'Add a custom rule for required .env.example?',
      default: true,
    },
  ]);

  const config: Record<string, unknown> = {
    rules: {},
    ignore: [],
    customRules: [],
  };

  if (answers.strictCi) {
    (config.rules as Record<string, string>)['ci-cache-no-lockfile'] = 'error';
    (config.rules as Record<string, string>)['ci-missing-install'] = 'error';
  }

  if (answers.ignoreExpoDetected) {
    (config.rules as Record<string, string>)['expo-detected'] = 'off';
  }

  if (answers.addCustomRule) {
    (config.customRules as unknown[]).push({
      id: 'missing-env-example',
      title: 'Missing .env.example template',
      details: 'Create .env.example so contributors know required environment variables.',
      level: 'warn',
      fix: 'Create .env.example and include keys like EXPO_TOKEN.',
      when: { fileMissing: '.env.example' },
    });
  }

  const rcPath = path.join(cwd, '.expo-ci-doctorrc');
  fs.writeFileSync(rcPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  console.log(colors.success(`\n  ${icons.success} Config generated: ${rcPath}\n`));
}
