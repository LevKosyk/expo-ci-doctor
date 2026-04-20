# RELESE_NOTES - Version 1.0.3

Release date: 2026-04-20

## Overview
Version 1.0.3 adds workspace-level visibility, stronger package-manager drift detection, and a more actionable upgrade flow.

## What was added

### 1) Workspace dashboard
- Added a new `dashboard` command.
- Shows per-workspace score, risk, error count, warning count, package manager, lockfiles, and CI status.
- Useful for monorepo projects that want a quick health overview without reading every workspace report.

### 2) Package manager drift checks
- Added a rule that checks the `packageManager` field in `package.json`.
- Flags missing declarations when a lockfile exists.
- Flags conflicts between the declared package manager and the detected lockfile family.
- Warns when a package manager is declared but no lockfile is present.

### 3) Upgrade checklist
- Improved `upgrade-plan` with an ordered migration checklist.
- The checklist now covers:
	- Expo SDK upgrade order
	- Expo-managed package realignment
	- Node and CI runtime alignment
	- EAS CLI update guidance
	- Final verification steps

### 4) Validation coverage
- Added regression tests for the package manager drift rule.
- Kept the new feature set validated with the existing build and test flow.

## Related quality upgrades
- Better workspace-aware command structure for larger repos.
- Clearer upgrade guidance for teams moving between Expo SDK versions.
- Improved documentation so the new commands are discoverable.
