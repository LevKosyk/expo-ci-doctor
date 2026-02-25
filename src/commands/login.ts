import chalk from 'chalk';
import { saveKey, getConfigPath } from '../core/license-config.js';
import { verifyLicense } from '../core/license-verifier.js';

export async function loginCommand(key: string, options: { json?: boolean } = {}): Promise<void> {
  const result = saveKey(key);

  if (!result.ok) {
    if (options.json) {
      console.log(JSON.stringify({ ok: false, error: result.error }));
    } else {
      console.log('');
      console.log(`  ${chalk.red('✖')}  ${chalk.red(result.error!)}`);
      console.log('');
    }
    process.exit(1);
  }

  const verification = await verifyLicense(key);

  if (options.json) {
    console.log(JSON.stringify({
      ok: verification.valid && verification.status === 'active',
      ...verification
    }));
    if (verification.valid && verification.status === 'active') {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }

  console.log('');
  
  if (verification.valid && verification.status === 'active') {
    console.log(`  ${chalk.green('✔')}  License key saved and verified.`);
    console.log(chalk.dim(`     ${getConfigPath()}`));
    console.log(`  ${chalk.cyan('→')}  Pro features are now unlocked (Plan: ${chalk.bold(verification.plan)}).`);
  } else {
    console.log(`  ${chalk.red('✖')}  License key saved, but verification failed.`);
    console.log(`     Reason: ${verification.message || verification.status}`);
    console.log(chalk.dim(`     ${getConfigPath()}`));
    process.exit(1);
  }

  console.log('');
}
