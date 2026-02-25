import chalk from 'chalk';
import { removeConfig, getConfigPath } from '../core/license-config.js';
import { resetEntitlementsCache } from '../core/license-entitlements.js';

export async function logoutCommand(): Promise<void> {
  console.log('');
  removeConfig();
  resetEntitlementsCache();
  console.log(`  ${chalk.green('✔')}  License key removed.`);
  console.log(chalk.dim(`     ${getConfigPath()}`));
  console.log(`  ${chalk.dim('→')}  Downgraded to Free tier.`);
  console.log('');
}
