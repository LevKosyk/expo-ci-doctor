# Changelog

All notable changes to this project are documented in this file.

## 1.0.3 - 2026-04-20

### Added
- Workspace dashboard command for monorepo health summaries.
- Package manager drift detection for `packageManager` vs detected lockfile family.
- Ordered upgrade checklist in `upgrade-plan`.
- New `dashboard` command in the CLI entrypoint.
- Regression test coverage for package manager drift checks.
- `dev` script for watch-mode development with tsup.
- `test` script using Node's native test runner (`node --test`).

### Improved
- Build system migrated from tsc to tsup for faster, minified ESM bundles.
- `check` and `doctor` now support cleaner workspace-aware reporting and threshold handling.
- `upgrade-plan` now shows a step-by-step migration path instead of only per-section output.
- Documentation updated to reflect the newer command set and workspace flow.
- All CLI dependencies moved to devDependencies (better practice for a CLI tool).

### Changed
- Removed manual TypeScript compiler setup in favor of tsup.
- Package.json now includes tsup and removes the `postbuild` hook.

### Notes
- This release builds on the 1.0.2 dependency and CI workflow improvements.
- Package version metadata is now `1.0.3`.
- Build output is now minified by default, reducing distribution size.

## 1.0.2 - 2026-04-16

### Added
- Dependency bloat/risk detector for stale, duplicated, and oversized package footprints.
- CI workflow autofix support for common issues in:
	- GitHub Actions
	- GitLab CI
	- CircleCI
- Custom severity threshold controls:
	- Global `--fail-on <level>` support
	- Repo-level `severityThresholds` config support
- Monorepo workspace scan mode via `--all-workspaces`.
- `release-notes` command that turns findings into changelog-style release summaries.
- Project-aware scanning helpers for multi-app workspace discovery.

### Improved
- `check` command can evaluate findings across workspace apps in a single run.
- `preflight` and `doctor` now honor configurable failure thresholds.
- `fix` command can apply CI workflow file rewrites for common Node/install issues.
- Dependency analysis now flags package duplication and stale major versions more aggressively.

### Notes
- Version metadata in `package.json` is now `1.0.2`.

