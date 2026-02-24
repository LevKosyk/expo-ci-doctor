import chalk from 'chalk';
import { getLicenseState, isCI } from '../core/license.js';

export async function whoamiCommand(): Promise<void> {
  const state = getLicenseState();
  const ci = isCI();

  console.log('');
  console.log(chalk.bold('  expo-ci-doctor') + chalk.dim(' · license status'));
  console.log('');

  // Tier
  if (state.mode === 'pro') {
    console.log(`  Tier:     ${chalk.green.bold('Pro')}`);
  } else {
    console.log(`  Tier:     ${chalk.yellow('Free')}`);
  }

  // Source
  const sourceLabel = {
    ci: 'CI environment (EXPO_CI_DOCTOR_KEY)',
    local: 'Local config (~/.expo-ci-doctor/config.json)',
    none: '—',
  } as const;
  console.log(`  Source:   ${chalk.dim(sourceLabel[state.source])}`);

  // Mode
  console.log(`  Mode:     ${ci ? chalk.cyan('CI') : chalk.dim('Local')}`);

  // Key (masked)
  if (state.key) {
    const masked = state.key.substring(0, 12) + '…' + state.key.substring(state.key.length - 4);
    console.log(`  Key:      ${chalk.dim(masked)}`);
  }

  console.log('');

  if (state.mode === 'free') {
    console.log(chalk.dim('  Upgrade to Pro for CI rules, log analysis, and SDK checks.'));
    console.log(chalk.dim('  Run: expo-ci-doctor login <LICENSE_KEY>'));
    console.log('');
  }
}
