#!/usr/bin/env node

import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { analyzeCommand } from './commands/analyze.js';
import { doctorCommand } from './commands/doctor.js';
import { explainCommand } from './commands/explain.js';
import { snapshotCommand } from './commands/snapshot.js';
import { diffCommand } from './commands/diff.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { whoamiCommand } from './commands/whoami.js';
import { preflightCommand } from './commands/preflight.js';
import { runInteractiveMode } from './output/interactive.js';
import { checkForUpdate } from './core/self-update.js';

const CURRENT_VERSION = '0.3.0';

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
  .hook('preAction', async () => {
    // Self-update check — runs in background, non-blocking
    checkForUpdate(CURRENT_VERSION).then(latest => {
      if (latest) {
        process.stderr.write(`\n  Update available: ${CURRENT_VERSION} → ${latest}. Run: npm install -g expo-ci-doctor\n\n`);
      }
    }).catch(() => { /* ignore silently */ });
  });

// ─── Core commands ───────────────────────────────────────────────────

program
  .command('check')
  .description('Scan current project for CI / EAS build issues')
  .option('--ci-strict', 'Treat warnings as errors (for CI pipelines)')
  .option('--pack <pack>', 'Run only rules from a specific pack (core, github-actions, eas, sdk-upgrade)')
  .option('--upgrade <pkg>', 'Simulate an upgrade and show safety report, e.g. expo@51 (Pro)')
  .action(async (opts) => {
    const globalOpts = program.opts();
    await checkCommand({ ...opts, ...globalOpts });
  });

program
  .command('preflight')
  .description('Ultra-fast checks, CI-breaking issues only (Pro)')
  .action(async () => {
    await preflightCommand();
  });

program
  .command('analyze <logfile>')
  .description('Analyze a CI / EAS build log for known failure patterns (Pro)')
  .option('--noise <level>', 'Noise filter level: full | medium | low (Pro, default: full)')
  .action(async (logfile, opts) => {
    const globalOpts = program.opts();
    await analyzeCommand(logfile, { ...opts, ...globalOpts });
  });

program
  .command('doctor')
  .description('Full diagnostic: check + log analysis + verdict + fix recipes')
  .option('--copy', 'Copy the top fix snippet to your clipboard (Pro, macOS)')
  .option('--open-docs', 'Open relevant Expo documentation in browser (Pro, macOS)')
  .action(async (opts) => {
    const globalOpts = program.opts();
    await doctorCommand({ ...opts, ...globalOpts });
  });

program
  .command('explain <rule-id>')
  .description('Show detailed explanation for a rule (Starter + Pro)')
  .action(async (ruleId) => {
    await explainCommand(ruleId);
  });

program
  .command('snapshot')
  .description('Save project state to JSON for later comparison')
  .action(async () => {
    await snapshotCommand();
  });

program
  .command('diff <snapshot-file>')
  .description('Compare current project state against a snapshot (Pro)')
  .action(async (snapshotFile) => {
    await diffCommand(snapshotFile);
  });

// ─── License commands ────────────────────────────────────────────────

program
  .command('login <license-key>')
  .description('Activate Pro with a license key')
  .option('--json', 'Output results in JSON format')
  .action(async (key, options) => {
    await loginCommand(key, options);
  });

program
  .command('logout')
  .description('Remove saved license key')
  .action(async () => {
    await logoutCommand();
  });

program
  .command('whoami')
  .description('Show current license status')
  .action(async () => {
    await whoamiCommand();
  });

// ─── Interactive mode (no args) ──────────────────────────────────────

program.parse();

// If no command was given → interactive mode
if (process.argv.length === 2) {
  runInteractiveMode().then(async (chosen) => {
    if (!chosen) process.exit(0);
    // Re-invoke the selected command programmatically
    switch (chosen) {
      case 'check':     await checkCommand(); break;
      case 'doctor':    await doctorCommand(); break;
      case 'preflight': await preflightCommand(); break;
      case 'whoami':    await whoamiCommand(); break;
      default:
        console.log(`  Run: expo-ci-doctor ${chosen}`);
        break;
    }
  }).catch(() => process.exit(0));
}
