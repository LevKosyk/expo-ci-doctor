import { getCwd } from '../utils/context.js';
import { loadConfig } from '../utils/config-loader.js';
import { detectProject } from '../detectors/project.js';
import { runRules } from '../analyzers/index.js';

export async function ciCommand(): Promise<void> {
  const cwd = getCwd();
  const config = loadConfig(cwd);
  const info = detectProject(cwd);

  if (!info.hasPackageJson) {
    process.exit(2);
  }

  const { results } = runRules(info, {
    ciStrict: true,
    config,
  });

  for (const result of results) {
    const level = result.level === 'error' ? 'error'
      : result.level === 'warn' ? 'warning'
      : 'notice';

    const raw = result.hints?.where || result.filePointer || '';
    const filePart = raw.split('>')[0].trim() || 'unknown';
    const lineMatch = filePart.match(/:(\d+)/);
    const file = filePart.replace(/:\d+.*$/, '').trim();
    const line = lineMatch ? lineMatch[1] : '1';

    const msg = [result.title, result.details].join(' — ').replace(/\n/g, '%0A');

    process.stdout.write(`::${level} file=${file},line=${line}::${msg}\n`);
  }

  const errors = results.filter(r => r.level === 'error').length;
  if (errors > 0) {
    process.exit(2);
  }
}
