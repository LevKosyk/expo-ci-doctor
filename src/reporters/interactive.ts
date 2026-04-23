import * as readline from 'node:readline';
import chalk from 'chalk';

interface InteractiveChoice {
  label: string;
  command: string;
  description: string;
}

const CHOICES: InteractiveChoice[] = [
  { label: 'check',     command: 'check',     description: 'Scan project for CI/EAS build issues' },
  { label: 'doctor',    command: 'doctor',    description: 'Full diagnostic with verdict and fix recipes' },
  { label: 'logs',      command: 'logs',      description: 'Analyze a CI/EAS build log file for failures' },
  { label: 'preflight', command: 'preflight', description: 'Ultra-fast CI-breaking check' },
  { label: 'diff',      command: 'diff',      description: 'Compare project against a saved snapshot' },
  { label: 'exit',      command: 'exit',      description: 'Exit' },
];

const DOCS_URL = 'https://www.expocidoctor.dev/';

/**
 * Interactive mode — launched when the CLI is run with no arguments.
 *
 * Design principles:
 *   - Fast: responds to a single keypress, not full line input
 *   - Skippable: user can Ctrl+C or type 'exit' at any time
 *   - Honest: does not hide command complexity, just surfaces common options
 *
 * Returns the command string the user selected, or null if they exited.
 */
export async function runInteractiveMode(): Promise<string | null> {
  console.log('');
  console.log(chalk.bold('  expo-ci-doctor'));
  console.log(chalk.dim('  CI and EAS Build diagnostics for Expo / React Native'));
  console.log('');
  console.log(chalk.dim('  What would you like to do?'));
  console.log('');

  CHOICES.forEach((c, i) => {
    const idx = chalk.dim(`  [${i + 1}]`);
    const label = chalk.bold(c.label.padEnd(12));
    const desc  = chalk.dim(c.description);
    console.log(`${idx} ${label}  ${desc}`);
  });

  console.log('');

  const answer = await promptChoice(`  Select (1–${CHOICES.length}): `);

  if (answer === null) return null;

  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= CHOICES.length) {
    console.log(chalk.yellow(`  Unrecognized choice. Run: expo-ci-doctor --help`));
    console.log(chalk.dim(`  Docs: ${DOCS_URL}`));
    return null;
  }

  const chosen = CHOICES[idx];
  if (chosen.command === 'exit') return null;

  console.log('');
  console.log(chalk.dim(`  Running: expo-ci-doctor ${chosen.command}`));
  console.log('');

  return chosen.command;
}

function promptChoice(prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    // TTY check: skip interactive prompt in non-interactive environments
    if (!process.stdin.isTTY) {
      console.log(chalk.dim('  Not a TTY - skipping interactive mode. Use expo-ci-doctor --help.'));
      console.log(chalk.dim(`  Docs: ${DOCS_URL}`));
      resolve(null);
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(chalk.cyan(prompt), (answer) => {
      rl.close();
      resolve(answer.trim());
    });

    rl.on('close', () => resolve(null));
    rl.on('SIGINT', () => {
      console.log('');
      resolve(null);
    });
  });
}
