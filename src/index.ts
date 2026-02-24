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

const program = new Command();

program
  .name('expo-ci-doctor')
  .description('Predicts Expo / React Native CI and EAS Build problems before you run the build')
  .version('0.2.0');

// ─── Core commands ──────────────────────────────────────────────────

program
  .command('check')
  .description('Scan current project for CI / EAS build issues')
  .option('--ci-strict', 'Treat warnings as errors (for CI pipelines)')
  .option('--pack <pack>', 'Run only rules from a specific pack (core, github-actions, eas, sdk-upgrade)')
  .action(async (opts) => {
    await checkCommand({ ciStrict: opts.ciStrict, pack: opts.pack });
  });

program
  .command('analyze <logfile>')
  .description('Analyze a CI / EAS build log for known failure patterns (Pro)')
  .action(async (logfile) => {
    await analyzeCommand(logfile);
  });

program
  .command('doctor')
  .description('Full diagnostic: check + log analysis + verdict')
  .action(async () => {
    await doctorCommand();
  });

program
  .command('explain <rule-id>')
  .description('Show detailed explanation for a rule')
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
  .description('Compare current project state against a snapshot')
  .action(async (snapshotFile) => {
    await diffCommand(snapshotFile);
  });

// ─── License commands ───────────────────────────────────────────────

program
  .command('login <license-key>')
  .description('Activate Pro with a license key')
  .action(async (key) => {
    await loginCommand(key);
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

program.parse();
