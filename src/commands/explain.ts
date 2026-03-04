import chalk from 'chalk';
import { findRule, allRules } from '../analyzers/index.js';

/**
 * The `explain` command.
 * Shows a detailed explanation of a rule by id.
 */
export async function explainCommand(ruleId: string): Promise<void> {
  const rule = findRule(ruleId);

  if (!rule) {
    console.log('');
    console.log(chalk.red(`  ✖  Unknown rule: "${ruleId}"`));
    console.log('');
    console.log(chalk.dim('  Available rules:'));
    for (const r of allRules) {
      console.log(`    ${chalk.dim('•')} ${r.id}  ${chalk.dim(`[${r.pack}]`)}`);
    }
    console.log('');
    process.exit(1);
  }

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

  console.log('');
  console.log(chalk.dim('  ───────────────────────────────────'));
  console.log(`  Pack: ${chalk.cyan(rule.pack)}`);
  console.log('');
}
