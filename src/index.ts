#!/usr/bin/env node

import { Command } from 'commander';
import { checkForUpdate } from './utils/self-update.js';
import { configureRuntime, getRuntime } from './utils/runtime.js';

const CURRENT_VERSION = '1.0.4';
const DOCS_URL = 'https://www.expocidoctor.dev/';
const TYPO_HELP_FLAG = '--hepl';

const program = new Command();

program
  .showSuggestionAfterError(true)
  .showHelpAfterError(`\nNeed help? Run: expo-ci-doctor --help\nDocs: ${DOCS_URL}\n`);

function formatOptionFlags(flags: string): string {
  return flags.replace(/,/g, ', ');
}

function generateCommandFlagDocs(cli: Command): string {
  const lines: string[] = ['\nCommand & Flag Reference:'];

  for (const cmd of cli.commands) {
    lines.push(`\n  ${cmd.name()}`);
    lines.push(`  ${cmd.description() || 'No description available.'}`);

    const options = cmd.options.filter(option => option.flags !== '-h, --help');
    if (!options.length) {
      lines.push('  Flags: none');
      continue;
    }

    lines.push('  Flags:');
    for (const option of options) {
      const defaultPart = option.defaultValue !== undefined
        ? ` (default: ${String(option.defaultValue)})`
        : '';
      lines.push(`    ${formatOptionFlags(option.flags)}  ${option.description || 'No description.'}${defaultPart}`);
    }
  }

  lines.push(`\nFull docs: ${DOCS_URL}`);
  return lines.join('\n');
}

program
  .name('expo-ci-doctor')
  .description('Predicts Expo / React Native CI and EAS Build problems before you run the build')
  .version(CURRENT_VERSION)
  .option('--verbose', 'Show extra debug information')
  .option('--silent', 'Only print final result lines (script-friendly)')
  .option('--version-check <mode>', 'Update check behavior: on | off', 'on')
  .option('--no-color', 'Disable ANSI colors in output')
  .option('--output <file>', 'Write command output to a file (supported by selected commands)')
  .option('--fail-on <level>', 'Fail on findings at or above this severity: info | warn | error')
  .option('--all-workspaces', 'Scan every workspace app individually')
  .option('--ci', 'Minimal output for CI environments')
  .option('--ci-summary', 'One-screen summary for CI')
  .option('--json', 'Machine-readable JSON output')
  .option('--json-full', 'Machine-readable JSON output with full payload')
  .option('--severity <level>', 'Minimum severity to print: error | warn | info')
  .option('--format <fmt>', 'Output format: md (GitHub-Flavored Markdown)')
  .hook('preAction', (_thisCommand, actionCommand) => {
    const globalOpts = actionCommand.optsWithGlobals ? actionCommand.optsWithGlobals() : program.opts();
    configureRuntime(globalOpts as Record<string, unknown>);

    // Self-update check — runs in background, non-blocking
    if (getRuntime().versionCheck === 'off') return;

    checkForUpdate(CURRENT_VERSION).then(latest => {
      if (latest) {
        process.stderr.write(`\n  Update available: ${CURRENT_VERSION} → ${latest}. Run: npm install -g expo-ci-doctor\n\n`);
      }
    }).catch(() => { /* ignore silently */ });
  });

program.addHelpText('after', `
Docs:
  ${DOCS_URL}

Examples:
  $ expo-ci-doctor doctor
  Run a full health audit of your Expo project.

  $ expo-ci-doctor doctor --fix
  Automatically repair detected issues.

  $ expo-ci-doctor check --summary --output check-summary.md --format md
  Produce one-screen summary and save markdown report to file.

  $ expo-ci-doctor check --json --silent --version-check off
  Script-friendly run with only machine output and no update lookup.

  $ expo-ci-doctor check --verbose --no-color
  Show debug steps and disable ANSI colors.

  $ expo-ci-doctor ci-template
  Generate CI configuration for Expo projects.

  $ expo-ci-doctor explain-error
  Explain a build error log.

  $ expo-ci-doctor tips
  Show quick CI best-practice tips.

  $ expo-ci-doctor init
  Generate a default .expo-ci-doctorrc config.

  $ expo-ci-doctor dashboard
  Show a workspace-by-workspace health summary for monorepos.
`);

program.addHelpText('after', generateCommandFlagDocs(program));

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
  .option('--summary', 'One-screen summary with top issues and first fix')
  .option('--annotations', 'Emit GitHub Actions annotations directly from check output')
  .option('--webhook <url>', 'Send a webhook notification for failures')
  .action(async (opts) => {
    const { checkCommand } = await import('./commands/check.js');
    await checkCommand({ ...opts, ...program.opts() });
  });

program
  .command('preflight')
  .description('Ultra-fast checks, CI-breaking issues only')
  .action(async () => {
    const { preflightCommand } = await import('./commands/preflight.js');
    await preflightCommand(program.opts() as { failOn?: string });
  });

program
  .command('fix')
  .description('Detect issues and propose automatic fixes in an interactive mode')
  .option('--pack <pack>', 'Auto-fix pack: safe | deps | all', 'safe')
  .option('--yes', 'Apply fixes without confirmation prompt')
  .option('--dry-run', 'Preview every change without writing anything')
  .action(async (opts) => {
    const { fixCommand } = await import('./commands/fix.js');
    await fixCommand(opts);
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
  .command('trends')
  .description('Show project health trend history and flaky build signals')
  .option('--days <n>', 'History window in days (1-90)', '14')
  .option('--webhook <url>', 'Send a webhook alert when the trend degrades or looks flaky')
  .action(async (opts) => {
    const { trendsCommand } = await import('./commands/trends.js');
    await trendsCommand(opts);
  });

program
  .command('compare <left> <right>')
  .description('Compare two snapshots or two git refs side by side')
  .action(async (left, right) => {
    const { compareCommand } = await import('./commands/compare.js');
    await compareCommand(left, right);
  });

program
  .command('dashboard')
  .description('Show a workspace-by-workspace health dashboard')
  .action(async () => {
    const { dashboardCommand } = await import('./commands/dashboard.js');
    await dashboardCommand();
  });

program
  .command('upgrade-plan [target]')
  .description('Generate a separate upgrade plan for Expo, React Native, Node, and EAS CLI')
  .option('--expo <version>', 'Override Expo SDK target version')
  .option('--react-native <version>', 'Override React Native target version')
  .option('--node <range>', 'Override Node target range')
  .option('--eas-cli <version>', 'Override EAS CLI target version')
  .action(async (target, opts) => {
    const { upgradePlanCommand } = await import('./commands/upgrade-plan.js');
    const finalOpts = { ...opts, ...program.opts() } as Record<string, unknown>;
    if (typeof target === 'string' && !finalOpts.expo) {
      finalOpts.expo = target.includes('@') ? target.split('@').pop() : target;
    }
    await upgradePlanCommand(finalOpts as { expo?: string; reactNative?: string; node?: string; easCli?: string });
  });

program
  .command('pr-comment')
  .description('Generate PR-ready markdown summary with blockers and fixes')
  .option('--out <file>', 'Output file path', 'expo-ci-pr-comment.md')
  .action(async (opts) => {
    const { prCommentCommand } = await import('./commands/pr-comment.js');
    await prCommentCommand(opts);
  });

program
  .command('wizard')
  .description('Interactive setup wizard for .expo-ci-doctorrc')
  .action(async () => {
    const { wizardCommand } = await import('./commands/wizard.js');
    await wizardCommand();
  });

program
  .command('explain <rule-id>')
  .description('Explain a specific rule in detail')
  .action(async (ruleId) => {
    const { explainCommand } = await import('./commands/explain.js');
    await explainCommand(ruleId);
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

program
  .command('tips')
  .description('Show 5 quick best-practice tips for Expo CI')
  .action(async () => {
    const { tipsCommand } = await import('./commands/tips.js');
    await tipsCommand();
  });

program
  .command('init')
  .description('Create a default .expo-ci-doctorrc config file')
  .option('--force', 'Overwrite existing config file')
  .action(async (opts) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand(opts);
  });

program
  .command('release-notes')
  .description('Turn current findings into a changelog-style release notes summary')
  .option('--out <file>', 'Output file path', 'release-notes-from-findings.md')
  .action(async (opts) => {
    const { releaseNotesCommand } = await import('./commands/release-notes.js');
    await releaseNotesCommand({ ...opts, ...program.opts() });
  });

program
  .command('updates-check')
  .description('Verify EAS Update safety and runtimeVersion configuration')
  .action(async () => {
    const { updatesCheckCommand } = await import('./commands/updates-check.js');
    await updatesCheckCommand();
  });

program
  .command('bundle-size')
  .description('Estimate and warn about large uncompressed asset sizes')
  .action(async () => {
    const { bundleSizeCommand } = await import('./commands/bundle-size.js');
    await bundleSizeCommand();
  });

program
  .command('check-envs')
  .description('Validate .env files against .env.example and eas.json')
  .action(async () => {
    const { checkEnvsCommand } = await import('./commands/check-envs.js');
    await checkEnvsCommand();
  });

program
  .command('validate-routes')
  .description('Validate Expo Router dynamic routes and deep linking')
  .action(async () => {
    const { validateRoutesCommand } = await import('./commands/validate-routes.js');
    await validateRoutesCommand();
  });

program
  .command('ai-explain <logfile>')
  .description('Use Gemini or OpenAI to explain a build log')
  .option('--api-key <key>', 'API Key for Gemini or OpenAI')
  .option('--provider <name>', 'Provider: gemini or openai')
  .action(async (logfile, opts) => {
    const { aiExplainCommand } = await import('./commands/ai-explain.js');
    await aiExplainCommand(logfile, opts);
  });

// ─── Interactive mode (no args) ──────────────────────────────────────

const argv = process.argv.map((arg: string) => arg === TYPO_HELP_FLAG ? '--help' : arg);
if (process.argv.includes(TYPO_HELP_FLAG)) {
  console.log(`\n  Detected ${TYPO_HELP_FLAG}. Showing help for expo-ci-doctor.\n`);
}

program.parse(argv);

if (process.argv.length === 2) {
  console.log(`\n  No command specified. Run: expo-ci-doctor --help\n  Docs: ${DOCS_URL}\n`);
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
