import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';
import { getCwd } from '../utils/context.js';
import { detectProject } from '../detectors/project.js';
import { printTitle, createSpinner, drawBox, icons, colors } from '../utils/logger.js';
import { runRules } from '../analyzers/index.js';
import { loadConfig } from '../utils/config-loader.js';

export async function fixCommand(): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);
  
  printTitle('expo-ci-doctor fix');
  
  const spinner = createSpinner('Scanning for fixable issues…').start();
  await new Promise(r => setTimeout(r, 400));
  
  const info = detectProject(cwd);
  
  if (!info.hasPackageJson) {
    spinner.fail('No package.json found');
    process.exit(1);
  }

  const { results } = runRules(info, { config });
  
  // Filter for errors and warnings that have a clear, recognizable fix.
  // We'll define simple heuristics for now.
  const fixable = results.filter(r => r.fix && (r.fix.includes('npm install') || r.fix.includes('npx expo install')));
  
  spinner.stop();

  if (fixable.length === 0) {
    console.log(colors.success(`\n  ${icons.success} No auto-fixable issues detected.`));
    return;
  }

  console.log(colors.warning(`\n  ${icons.warning} Detected ${fixable.length} auto-fixable issue(s):`));
  
  for (let i = 0; i < fixable.length; i++) {
    console.log(`\n  ${colors.bold(i + 1 + ')')} ${colors.bold(fixable[i].title)}`);
    console.log(`     ${colors.dim(fixable[i].details)}`);
  }

  console.log('');
  
  const { applyCommand } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'applyCommand',
      message: 'Fix automatically? (y/n)',
      default: true,
    }
  ]);

  if (!applyCommand) {
    console.log(colors.dim('\n  Aborted auto-fix.'));
    return;
  }

  const execSpinner = createSpinner('Applying fixes…').start();
  
  try {
    const { execSync } = await import('node:child_process');
    
    for (const issue of fixable) {
      if (issue.fix) {
        // Very basic extraction of the run command if provided in the fix text
        let cmd = '';
        if (issue.fix.includes('npx expo install')) {
          cmd = issue.fix.split('\\n').find(line => line.includes('npx expo install'))?.trim() || '';
        } else if (issue.fix.includes('npm install')) {
          cmd = issue.fix.split('\\n').find(line => line.includes('npm install'))?.trim() || '';
        }
        
        if (cmd) {
           execSpinner.text = `Running: ${cmd}`;
           execSync(cmd, { stdio: 'ignore', cwd });
        }
      }
    }
    
    execSpinner.succeed('Fixes applied successfully!');
    console.log(colors.success(`\n  ${icons.success} Project updated.`));
  } catch (err: any) {
    execSpinner.fail(`Failed to apply fixes: ${err.message}`);
  }
}
