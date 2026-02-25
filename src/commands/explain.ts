import chalk from 'chalk';
import { getLicenseEntitlements } from '../core/license-entitlements.js';
import { findRule, allRules } from '../rules/rules.js';

/**
 * The `explain` command.
 * Shows a detailed explanation of a rule by id.
 */
export async function explainCommand(ruleId: string): Promise<void> {
  const license = await getLicenseEntitlements();

  const rule = findRule(ruleId);

  if (!rule) {
    console.log('');
    console.log(chalk.red(`  ✖  Unknown rule: "${ruleId}"`));
    console.log('');
    console.log(chalk.dim('  Available rules:'));
    for (const r of allRules) {
      const pro = r.requiresPro ? chalk.yellow(' PRO') : '';
      console.log(`    ${chalk.dim('•')} ${r.id}  ${chalk.dim(`[${r.pack}]`)}${pro}`);
    }
    console.log('');
    process.exit(1);
  }

  // Pro-only explain for pro rules
  if (rule.requiresPro && !license.canUseProRules) {
    console.log('');
    console.log(chalk.yellow(`  🔒  "${ruleId}" is a Pro rule.`));
    console.log(chalk.dim('     Run: expo-ci-doctor login <KEY> to unlock detailed explanations.'));
    console.log('');
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold(`  Rule: ${rule.id}`) + chalk.dim(`  [${rule.pack}]`));
  console.log('');

  if (rule.explain) {
    // Wrap explanation text
    const lines = rule.explain.split('. ');
    for (const line of lines) {
      console.log(`  ${chalk.white(line.trim() + (line.endsWith('.') ? '' : '.'))}`);
    }
  } else {
    console.log(chalk.dim('  No detailed explanation available for this rule.'));
  }

  const pro = rule.requiresPro ? chalk.green(' PRO') : chalk.dim(' FREE');
  console.log('');
  console.log(chalk.dim('  ───────────────────────────────────'));
  console.log(`  Pack: ${chalk.cyan(rule.pack)}  Tier:${pro}`);
  console.log('');
}
