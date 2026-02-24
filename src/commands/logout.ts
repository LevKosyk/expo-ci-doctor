import chalk from 'chalk';
import { removeKey, getConfigPath } from '../core/license.js';

export async function logoutCommand(): Promise<void> {
  console.log('');
  removeKey();
  console.log(`  ${chalk.green('✔')}  License key removed.`);
  console.log(chalk.dim(`     ${getConfigPath()}`));
  console.log(`  ${chalk.dim('→')}  Downgraded to Free tier.`);
  console.log('');
}
