import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';
import { getCwd } from '../utils/context.js';
import { detectProject } from '../detectors/project.js';
import { printTitle, createSpinner, drawBox, icons, colors } from '../utils/logger.js';
import { runRules } from '../analyzers/index.js';
import { loadConfig } from '../utils/config-loader.js';

type FixPack = 'safe' | 'deps' | 'all';

export async function fixCommand(options: { pack?: string; yes?: boolean; dryRun?: boolean } = {}): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);
  const pack: FixPack = options.pack === 'deps' || options.pack === 'all' ? options.pack : 'safe';
  
  printTitle('expo-ci-doctor fix');
  
  const spinner = createSpinner('Scanning for fixable issues…').start();
  
  const info = detectProject(cwd);
  
  if (!info.hasPackageJson) {
    spinner.fail('No package.json found');
    process.exit(1);
  }

  const { results } = runRules(info, { config });
  const fixPlan = buildFixPlan(results, info, cwd, pack, info.deps.packageManager);
  
  spinner.stop();

  if (fixPlan.length === 0) {
    console.log(colors.success(`\n  ${icons.success} No auto-fixable issues detected.`));
    return;
  }

  console.log(colors.warning(`\n  ${icons.warning} Detected ${fixPlan.length} auto-fixable issue(s) in ${pack} pack:`));
  
  for (let i = 0; i < fixPlan.length; i++) {
    console.log(`\n  ${colors.bold(i + 1 + ')')} ${colors.bold(fixPlan[i].title)}`);
    console.log(`     ${colors.dim(fixPlan[i].description)}`);
  }

  console.log('');

  if (options.dryRun) {
    console.log(colors.dim('  Dry run mode: no files will be changed.'));
    for (const item of fixPlan) {
      console.log(`  ${icons.info} ${item.title}`);
      console.log(`     ${colors.dim(item.description)}`);
      if (item.type === 'shell') {
        console.log(`     ${colors.bold('Command:')} ${item.command}`);
      } else if (item.type === 'write-file') {
        console.log(`     ${colors.bold('Write:')} ${item.filePath}`);
      } else if (item.type === 'append-line') {
        console.log(`     ${colors.bold('Append:')} ${item.filePath}`);
      } else if (item.type === 'update-package-json') {
        console.log(`     ${colors.bold('Update:')} package.json engines.node = ${item.nodeVersion}`);
      }
      console.log('');
    }
    return;
  }
  
  let applyCommand = Boolean(options.yes);
  if (!options.yes) {
    const ans = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'applyCommand',
        message: 'Fix automatically? (y/n)',
        default: true,
      }
    ]);
    applyCommand = Boolean(ans.applyCommand);
  }

  if (!applyCommand) {
    console.log(colors.dim('\n  Aborted auto-fix.'));
    return;
  }

  const execSpinner = createSpinner('Applying fixes…').start();
  
  try {
    const { execSync } = await import('node:child_process');

    for (const item of fixPlan) {
      execSpinner.text = `Applying: ${item.title}`;
      if (item.type === 'shell') {
        execSync(item.command, { stdio: 'ignore', cwd });
      } else if (item.type === 'write-file') {
        fs.writeFileSync(item.filePath, item.content, 'utf-8');
      } else if (item.type === 'append-line') {
        const existing = fs.existsSync(item.filePath) ? fs.readFileSync(item.filePath, 'utf-8') : '';
        if (!existing.includes(item.line)) {
          const joined = existing.endsWith('\n') || existing.length === 0
            ? `${existing}${item.line}\n`
            : `${existing}\n${item.line}\n`;
          fs.writeFileSync(item.filePath, joined, 'utf-8');
        }
      } else if (item.type === 'update-package-json') {
        const pkgPath = path.join(cwd, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
        const engines = (pkg.engines && typeof pkg.engines === 'object')
          ? pkg.engines as Record<string, unknown>
          : {};
        engines.node = item.nodeVersion;
        pkg.engines = engines;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      }
    }
    
    execSpinner.succeed('Fixes applied successfully!');
    console.log(colors.success(`\n  ${icons.success} Project updated.`));
  } catch (err: any) {
    execSpinner.fail(`Failed to apply fixes: ${err.message}`);
  }
}

type FixAction =
  | { type: 'shell'; title: string; description: string; command: string }
  | { type: 'write-file'; title: string; description: string; filePath: string; content: string }
  | { type: 'append-line'; title: string; description: string; filePath: string; line: string }
  | { type: 'update-package-json'; title: string; description: string; nodeVersion: string };

function buildFixPlan(
  results: Array<{ id: string; title: string; fix?: string }>,
  info: ReturnType<typeof detectProject>,
  cwd: string,
  pack: FixPack,
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown',
): FixAction[] {
  const actions: FixAction[] = [];
  const byId = new Set(results.map((r) => r.id));

  if (byId.has('missing-eas-json')) {
    actions.push({
      type: 'write-file',
      title: 'Create eas.json',
      description: 'Adds a minimal EAS config with development/preview/production profiles.',
      filePath: path.join(cwd, 'eas.json'),
      content: JSON.stringify({
        cli: { version: '>= 7.0.0' },
        build: {
          development: { developmentClient: true, distribution: 'internal' },
          preview: { distribution: 'internal' },
          production: {},
        },
      }, null, 2) + '\n',
    });
  }

  if (byId.has('no-engines-node')) {
    actions.push({
      type: 'update-package-json',
      title: 'Set engines.node in package.json',
      description: 'Adds a stable Node engine constraint for local and CI consistency.',
      nodeVersion: '>=18.0.0',
    });
    actions.push({
      type: 'write-file',
      title: 'Create .nvmrc',
      description: 'Pins local shell Node version to match CI baseline.',
      filePath: path.join(cwd, '.nvmrc'),
      content: '18\n',
    });
  }

  if (byId.has('missing-eas-env-vars')) {
    actions.push({
      type: 'append-line',
      title: 'Add EXPO_TOKEN placeholder to .env.example',
      description: 'Documents required CI credential in environment template.',
      filePath: path.join(cwd, '.env.example'),
      line: 'EXPO_TOKEN=""',
    });
  }

  actions.push(...buildCiWorkflowFixes(info));

  if (pack === 'deps' || pack === 'all') {
    const installFixes = results.filter((r) => r.fix && (r.fix.includes('npm install') || r.fix.includes('npx expo install')));
    for (const issue of installFixes) {
      if (!issue.fix) continue;
      const lines = issue.fix.split('\n').map((x) => x.trim());
      const cmd = lines.find((line) => line.startsWith('npx expo install'))
        ?? lines.find((line) => line.startsWith('npm install'))
        ?? lines.find((line) => line.startsWith('yarn add'))
        ?? lines.find((line) => line.startsWith('pnpm add'));
      if (!cmd) continue;
      actions.push({
        type: 'shell',
        title: issue.title,
        description: 'Runs suggested dependency command from detected issue.',
        command: cmd,
      });
    }
  }

  if (byId.has('lockfile-issues') && packageManager !== 'unknown') {
    if (packageManager === 'npm') {
      actions.push({
        type: 'shell',
        title: 'Generate package-lock.json',
        description: 'Creates lockfile for deterministic CI installs.',
        command: 'npm install --package-lock-only',
      });
    } else if (packageManager === 'yarn') {
      actions.push({
        type: 'shell',
        title: 'Generate yarn.lock',
        description: 'Creates lockfile for deterministic CI installs.',
        command: 'yarn install --mode=skip-build',
      });
    } else if (packageManager === 'pnpm') {
      actions.push({
        type: 'shell',
        title: 'Generate pnpm-lock.yaml',
        description: 'Creates lockfile for deterministic CI installs.',
        command: 'pnpm install --lockfile-only',
      });
    }
  }

  return uniqueByTitle(actions);
}

function buildCiWorkflowFixes(info: ReturnType<typeof detectProject>): FixAction[] {
  const actions: FixAction[] = [];
  const targetNode = normalizeNodeVersion(info.nvmrcVersion ?? info.enginesNode ?? '18');
  const installByPm: Record<'npm' | 'yarn' | 'pnpm', string> = {
    npm: 'npm ci',
    yarn: 'yarn install --frozen-lockfile',
    pnpm: 'pnpm install --frozen-lockfile',
  };
  const installCommand = installByPm[info.deps.packageManager === 'unknown' ? 'npm' : info.deps.packageManager];

  for (const workflow of info.ci.workflows) {
    if (!workflow.filePath || !fs.existsSync(workflow.filePath)) continue;

    const original = fs.readFileSync(workflow.filePath, 'utf-8');
    let updated = original;
    let changed = false;

    if (workflow.usesSetupNode || workflow.provider === 'gitlab-ci' || workflow.provider === 'circleci') {
      const nodeReplaced = replaceNodeVersion(updated, targetNode, workflow.provider);
      if (nodeReplaced !== updated) {
        updated = nodeReplaced;
        changed = true;
      }
    }

    if (workflow.easBuildCommand && !workflow.hasInstallStep) {
      const installInjected = injectInstallBeforeEasBuild(updated, installCommand, workflow.provider);
      if (installInjected !== updated) {
        updated = installInjected;
        changed = true;
      }
    }

    if (changed) {
      actions.push({
        type: 'write-file',
        title: `Autofix CI workflow: ${workflow.filename}`,
        description: `Applies common CI fixes for ${workflow.provider}.`,
        filePath: workflow.filePath,
        content: updated,
      });
    }
  }

  return actions;
}

function replaceNodeVersion(content: string, targetNode: string, provider: 'github-actions' | 'gitlab-ci' | 'circleci'): string {
  let updated = content;
  updated = updated.replace(/(node-version\s*:\s*['"]?)[^'"\n]+(['"]?)/i, `$1${targetNode}$2`);
  updated = updated.replace(/(image\s*:\s*node:)[^\s'"#]+/i, `$1${targetNode}`);
  if (provider !== 'github-actions') {
    updated = updated.replace(/(node\s*:\s*['"]?)[^'"\n]+(['"]?)/i, `$1${targetNode}$2`);
  }
  return updated;
}

function injectInstallBeforeEasBuild(content: string, installCommand: string, provider: 'github-actions' | 'gitlab-ci' | 'circleci'): string {
  if (content.includes(installCommand)) return content;

  const injection = `${installCommand} && eas build`;
  if (provider === 'github-actions') {
    return content.replace(/\beas\s+build\b/i, injection);
  }
  if (provider === 'gitlab-ci') {
    return content.replace(/\beas\s+build\b/i, injection);
  }
  return content.replace(/\beas\s+build\b/i, injection);
}

function normalizeNodeVersion(raw: string): string {
  const majorMatch = raw.match(/(\d+)/);
  return majorMatch ? majorMatch[1] : '18';
}

function uniqueByTitle(actions: FixAction[]): FixAction[] {
  const seen = new Set<string>();
  const out: FixAction[] = [];
  for (const action of actions) {
    if (seen.has(action.title)) continue;
    seen.add(action.title);
    out.push(action);
  }
  return out;
}
