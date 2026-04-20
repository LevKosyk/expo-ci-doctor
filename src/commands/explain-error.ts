import inquirer from 'inquirer';
import chalk from 'chalk';
import { matchPatterns } from '../analyzers/matcher.js';
import { printTitle, icons } from '../utils/logger.js';

export async function explainErrorCommand(): Promise<void> {
  printTitle('Error Explainer');

  console.log(chalk.dim('  Paste your build error snippet below.'));
  console.log(chalk.dim('  (Your default editor will open if you press Enter)\n'));

  // Using the 'editor' type allows multi-line pasting comfortably in any OS
  const { errorLog } = await inquirer.prompt([
    {
      type: 'editor',
      name: 'errorLog',
      message: 'Paste your error log:',
    },
  ]);

  if (!errorLog || errorLog.trim() === '') {
    console.log(`\n  ${icons.warning} No error log provided.\n`);
    return;
  }

  const matches = matchPatterns(errorLog);

  if (matches.length === 0) {
    console.log(`\n  ${icons.info} No known issues detected in the provided log.`);
    console.log(chalk.dim('  Try pasting a larger snippet or checking Expo documentation.\n'));
    return;
  }

  // Display the top match as the primary explanation
  const topMatch = matches[0];
  const alternatives = matches.slice(1, 3);

  console.log('\n' + chalk.bold('Detected issue:'));
  console.log(chalk.red(`\n${topMatch.title}\n`));

  console.log(chalk.bold('Possible causes:'));
  console.log(`\n${topMatch.explanation}\n`);

  console.log(chalk.bold('Suggested fix:'));
  console.log(`\n${chalk.green(topMatch.fix)}\n`);

  if (alternatives.length > 0) {
    console.log(chalk.bold('Also check:'));
    for (const alt of alternatives) {
      console.log(`  ${icons.warning} ${alt.title}`);
    }
    console.log('');
  }

  console.log(chalk.bold('Next actions:'));
  console.log(`  1) Fix the primary issue first: ${topMatch.id}`);
  console.log('  2) Re-run your build in CI to confirm the error class changed');
  console.log('  3) If still failing, paste a longer log segment into this command');
  console.log('');
}
