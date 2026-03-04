import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import Table from 'cli-table3';
import ora from 'ora';

export const icons = {
  success: chalk.green('✔'),
  warning: chalk.yellow('⚠'),
  error: chalk.red('✖'),
  info: chalk.blue('ℹ'),
};

export const colors = {
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.blue,
  dim: chalk.dim,
  bold: chalk.bold,
  cyan: chalk.cyan,
};

export const gradients: Record<string, any> = {
  primary: gradient(['#4c51bf', '#6b46c1', '#b83280']),
  success: gradient(['#047857', '#10b981']),
  warning: gradient(['#b45309', '#f59e0b']),
  error: gradient(['#be123c', '#f43f5e']),
  expo: gradient(['#000020', '#4630EB']),
};

export function createSpinner(text: string) {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
}

export function drawBox(title: string, content: string, style: 'info' | 'success' | 'warning' | 'error' = 'info') {
  const borderColor = 
    style === 'success' ? 'green' : 
    style === 'warning' ? 'yellow' : 
    style === 'error' ? 'red' : 
    'blue';

  return boxen(content, {
    title: chalk.bold(title),
    titleAlignment: 'center',
    padding: 1,
    margin: 1,
    borderColor,
    borderStyle: 'round',
  });
}

export function createTable(head: string[]) {
  return new Table({
    head: head.map(h => chalk.bold(h)),
    chars: { 
      'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
      'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
      'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
      'right': '║', 'right-mid': '╢', 'middle': '│' 
    },
    style: {
      head: ['cyan'],
      border: ['gray'],
    }
  });
}

export function printTitle(title: string) {
  console.log('\n' + gradients.primary.multiline(boxen(title, {
    padding: { top: 1, bottom: 1, left: 3, right: 3 },
    borderStyle: 'double',
    borderColor: 'magenta',
  })) + '\n');
}

export function printStep(message: string) {
  console.log(`${chalk.cyan('➜')} ${chalk.bold(message)}`);
}

export function printSuccess(message: string) {
  console.log(`${icons.success}  ${chalk.green(message)}`);
}

export function printWarning(message: string) {
  console.log(`${icons.warning}  ${chalk.yellow(message)}`);
}

export function printError(message: string) {
  console.log(`${icons.error}  ${chalk.red(message)}`);
}

export function printInfo(message: string) {
  console.log(`${icons.info}  ${chalk.blue(message)}`);
}
