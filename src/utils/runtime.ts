import chalk from 'chalk';

export interface RuntimeOptions {
  verbose: boolean;
  silent: boolean;
  noColor: boolean;
  versionCheck: 'on' | 'off';
}

const runtime: RuntimeOptions = {
  verbose: false,
  silent: false,
  noColor: false,
  versionCheck: 'on',
};

export function configureRuntime(raw: Record<string, unknown>): RuntimeOptions {
  runtime.verbose = Boolean(raw.verbose);
  runtime.silent = Boolean(raw.silent);
  runtime.noColor = Boolean(raw.noColor);
  runtime.versionCheck = raw.versionCheck === 'off' ? 'off' : 'on';

  if (runtime.noColor) {
    // chalk v5 exposes mutable level on default instance.
    (chalk as { level: number }).level = 0;
  }

  return { ...runtime };
}

export function getRuntime(): RuntimeOptions {
  return { ...runtime };
}

export function verboseLog(message: string): void {
  if (!runtime.verbose || runtime.silent) return;
  process.stderr.write(`[verbose] ${message}\n`);
}

export function finalLine(message: string): void {
  process.stdout.write(`${message}\n`);
}
