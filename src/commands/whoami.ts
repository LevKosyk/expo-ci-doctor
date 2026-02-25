import chalk from 'chalk';
import { getLicenseEntitlements, isCI } from '../core/license-entitlements.js';

export async function whoamiCommand(): Promise<void> {
  const state = await getLicenseEntitlements();
  const ci = isCI();

  console.log('');
  console.log(chalk.bold('  expo-ci-doctor') + chalk.dim(' · license status'));
  console.log('');

  // Tier
  if (state.tier === 'pro' || state.tier === 'lifetime') {
    console.log(`  Tier:     ${chalk.green.bold('Pro')} ${chalk.dim(`(${state.tier})`)}`);
  } else if (state.tier === 'starter') {
    console.log(`  Tier:     ${chalk.yellow.bold('Starter')}`);
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

  // Status
  const isOk = state.status === 'active';
  console.log(`  Status:   ${isOk ? chalk.green('active') : chalk.red(state.status)}`);

  // Last Verified
  if (state.lastVerifiedAt) {
    const verifiedDate = new Date(state.lastVerifiedAt).toLocaleString();
    console.log(`  Verified: ${chalk.dim(verifiedDate)}`);
  }

  // Key (masked)
  if (state.key && state.key.length >= 20) {
    const masked = state.key.substring(0, 12) + '…' + state.key.substring(state.key.length - 4);
    console.log(`  Key:      ${chalk.dim(masked)}`);
  } else if (state.key) {
    console.log(`  Key:      ${chalk.dim('***')}`);
  }

  console.log('');

  if (state.tier === 'free') {
    console.log(chalk.dim('  Upgrade to Pro for CI rules, log analysis, and SDK checks.'));
    console.log(chalk.dim('  Run: expo-ci-doctor login <LICENSE_KEY>'));
    console.log('');
  }
}
