#!/usr/bin/env node

import { Command } from 'commander';
import { checkForUpdate } from './utils/self-update.js';

const CURRENT_VERSION = '1.0.1';

const program = new Command();

program
  .name('expo-ci-doctor')
  .description('Predicts Expo / React Native CI and EAS Build problems before you run the build')
  .version(CURRENT_VERSION)
  .option('--ci', 'Minimal output for CI environments')
  .option('--ci-summary', 'One-screen summary for CI')
  .option('--json', 'Machine-readable JSON output')
  .option('--json-full', 'Machine-readable JSON output with full payload')
  .option('--severity <level>', 'Minimum severity to print: error | warn | info')
  .option('--format <fmt>', 'Output format: md (GitHub-Flavored Markdown)')
  .hook('preAction', () => {
    // Self-update check — runs in background, non-blocking
    checkForUpdate(CURRENT_VERSION).then(latest => {
      if (latest) {
        process.stderr.write(`\n  Update available: ${CURRENT_VERSION} → ${latest}. Run: npm install -g expo-ci-doctor\n\n`);
      }
    }).catch(() => { /* ignore silently */ });
  });

program.addHelpText('after', `
Examples:
  $ expo-ci-doctor doctor
  Run a full health audit of your Expo project.

  $ expo-ci-doctor doctor --fix
  Automatically repair detected issues.

  $ expo-ci-doctor ci-template
  Generate CI configuration for Expo projects.

  $ expo-ci-doctor explain-error
  Explain a build error log.
`);

// ─── Commands (all lazy-loaded) ──────────────────────────────────────

program
  .command('doctor')
  .description('Run a full health audit of your Expo project.')
  .option('--fix', 'Automatically repair detected issues.')
  .action(async (opts) => {
    const { doctorCommand } = await import('./commands/doctor.js');
    await doctorCommand({ ...opts, ...program.opts() });
  });

program
  .command('check')
  .description('Scan current project for CI / EAS build issues')
  .option('--ci-strict', 'Treat warnings as errors (for CI pipelines)')
  .option('--pack <pack>', 'Run only rules from a specific pack (core, github-actions, eas, sdk-upgrade)')
  .option('--upgrade <pkg>', 'Simulate an upgrade and show safety report, e.g. expo@51')
  .action(async (opts) => {
    const { checkCommand } = await import('./commands/check.js');
    await checkCommand({ ...opts, ...program.opts() });
  });

program
  .command('preflight')
  .description('Ultra-fast checks, CI-breaking issues only')
  .action(async () => {
    const { preflightCommand } = await import('./commands/preflight.js');
    await preflightCommand();
  });

program
  .command('fix')
  .description('Detect issues and propose automatic fixes in an interactive mode')
  .action(async () => {
    const { fixCommand } = await import('./commands/fix.js');
    await fixCommand();
  });

program
  .command('deps')
  .description('Show compatibility between Expo SDK, React Native, and installed Expo packages')
  .action(async () => {
    const { depsCommand } = await import('./commands/deps.js');
    await depsCommand();
  });

program
  .command('upgrade [version]')
  .description('Simulate upgrading Expo SDK and list potential breaking changes')
  .action(async (version) => {
    const { upgradeCommand } = await import('./commands/upgrade.js');
    await upgradeCommand(version);
  });

program
  .command('ci')
  .description('Output GitHub Actions compatible errors')
  .action(async () => {
    const { ciCommand } = await import('./commands/ci.js');
    await ciCommand();
  });

program
  .command('ci-template')
  .description('Generate CI configuration for Expo projects.')
  .action(async () => {
    const { ciTemplateCommand } = await import('./commands/ci-template.js');
    await ciTemplateCommand();
  });

program
  .command('badge')
  .description('Generate a README badge showing your Expo project health score')
  .option('--markdown', 'Output only the markdown snippet without extra text')
  .action(async (opts) => {
    const { badgeCommand } = await import('./commands/badge.js');
    await badgeCommand(opts);
  });

program
  .command('watch')
  .description('Watch config files and re-run checks automatically')
  .action(async (opts) => {
    const { watchCommand } = await import('./commands/watch.js');
    await watchCommand({ ...opts, ...program.opts() });
  });

program
  .command('motivate')
  .description('Get an encouraging message to boost CI morale.')
  .action(async () => {
    const { motivateCommand } = await import('./commands/motivate.js');
    await motivateCommand();
  });

program
  .command('report')
  .description('Generate expo-ci-report.md with issues, recommendations, and risk score')
  .action(async () => {
    const { reportCommand } = await import('./commands/report.js');
    await reportCommand();
  });

program
  .command('logs <logfile>')
  .description('Analyze a CI / EAS build log for known failure patterns')
  .option('--noise <level>', 'Noise filter level: full | medium | low (default: full)')
  .action(async (logfile, opts) => {
    const { logsCommand } = await import('./commands/logs.js');
    await logsCommand(logfile, { ...opts, ...program.opts() });
  });

program
  .command('explain-error')
  .description('Explain a build error log via interactive prompt.')
  .action(async () => {
    const { explainErrorCommand } = await import('./commands/explain-error.js');
    await explainErrorCommand();
  });

program
  .command('snapshot')
  .description('Save project state to JSON for later comparison')
  .action(async () => {
    const { snapshotCommand } = await import('./commands/snapshot.js');
    await snapshotCommand();
  });

program
  .command('diff <snapshot-file>')
  .description('Compare current project state against a snapshot')
  .action(async (snapshotFile) => {
    const { diffCommand } = await import('./commands/diff.js');
    await diffCommand(snapshotFile);
  });

// ─── Interactive mode (no args) ──────────────────────────────────────

program.parse();

if (process.argv.length === 2) {
  const { runInteractiveMode } = await import('./reporters/interactive.js');
  runInteractiveMode().then(async (chosen) => {
    if (!chosen) process.exit(0);
    switch (chosen) {
      case 'check': {
        const { checkCommand } = await import('./commands/check.js');
        await checkCommand();
        break;
      }
      case 'doctor': {
        const { doctorCommand } = await import('./commands/doctor.js');
        await doctorCommand();
        break;
      }
      case 'preflight': {
        const { preflightCommand } = await import('./commands/preflight.js');
        await preflightCommand();
        break;
      }
      default:
        console.log(`  Run: expo-ci-doctor ${chosen}`);
        break;
    }
  }).catch(() => process.exit(0));
}
