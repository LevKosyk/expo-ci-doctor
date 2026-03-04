import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCwd } from '../utils/context.js';
import { printTitle, createSpinner, colors } from '../utils/logger.js';
import { checkCommand } from './check.js';

export async function watchCommand(options: any = {}): Promise<void> {
  const cwd = getCwd();
  
  printTitle('expo-ci-doctor watch');
  console.log(colors.dim(`  Watching for changes in ${cwd}\n`));

  // Run initial check
  await runCheckSafely(options);

  const watchFiles = [
    'package.json',
    'app.config.js',
    'app.config.ts',
    'app.json',
    'eas.json',
  ];

  let timeout: NodeJS.Timeout | null = null;

  for (const file of watchFiles) {
    const fullPath = path.join(cwd, file);
    if (fs.existsSync(fullPath)) {
      console.log(colors.dim(`  Watching: ${file}`));
      fs.watch(fullPath, (eventType) => {
        if (eventType === 'change') {
          // Debounce to prevent multiple runs for a single save
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(async () => {
             console.log(colors.cyan(`\n  ↻ Detected change in ${file}... Re-running checks.\n`));
             await runCheckSafely(options);
          }, 300);
        }
      });
    }
  }

  console.log(colors.dim(`\n  Waiting for changes... (Press Ctrl+C to exit)`));
}

async function runCheckSafely(options: any) {
  try {
     // We do a simple preflight or standard check, wrapping to catch exits
     const originalExit = process.exit;
     // @ts-ignore
     process.exit = (code?: number) => {
        // Intercept exit to keep watcher alive
        if (code && code > 0) {
           console.log(colors.dim(`\n  Checks completed with issues.`));
        } else {
           console.log(colors.dim(`\n  Checks completed successfully.`));
        }
     };

     await checkCommand(options);

     process.exit = originalExit;
  } catch (err: any) {
     console.log(colors.error(`  Watcher error: ${err.message}`));
  }
}
