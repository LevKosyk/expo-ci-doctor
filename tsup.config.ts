import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  splitting: true,
  sourcemap: false,
  clean: true,
  minify: true,
  dts: false,
  outDir: 'dist',
  target: 'node18',
  external: [],
  noExternal: [
    'boxen',
    'chalk',
    'cli-table3',
    'commander',
    'gradient-string',
    'inquirer',
    'ora',
    'semver'
  ],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
