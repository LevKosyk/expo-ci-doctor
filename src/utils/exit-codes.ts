export const EXIT_CODES = {
  SUCCESS: 0,
  CONFIG_ERROR: 10,     // e.g. invalid arguments, missing config files
  ENV_ERROR: 20,        // e.g. missing environment variables, CI errors
  DEPENDENCY_ISSUE: 30, // e.g. broken node_modules, version mismatch
  UNKNOWN_FATAL: 40,    // unknown crash or fatal app error
} as const;

export type ExitCode = typeof EXIT_CODES[keyof typeof EXIT_CODES];

export function exitWithCode(code: ExitCode, message?: string): never {
  if (message) {
    if (code === EXIT_CODES.SUCCESS) {
      console.log(message);
    } else {
      console.error(message);
    }
  }
  process.exit(code);
}
