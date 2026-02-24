import chalk from 'chalk';
import { saveKey, getConfigPath } from '../core/license.js';

export async function loginCommand(key: string): Promise<void> {
  console.log('');
  const result = saveKey(key);

  if (!result.ok) {
    console.log(`  ${chalk.red('✖')}  ${chalk.red(result.error!)}`);
    console.log('');
    process.exit(1);
  }

  console.log(`  ${chalk.green('✔')}  License key saved.`);
  console.log(chalk.dim(`     ${getConfigPath()}`));
  console.log(`  ${chalk.cyan('→')}  Pro features are now unlocked.`);
  console.log('');
}
