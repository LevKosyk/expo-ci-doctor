# Quickstart

> [!WARNING]
> Expo CI Doctor is archived and no longer actively maintained. Its rules may become stale as Expo and native build tooling evolve.

## 1. Save the failed build log

Save or download the output from EAS Build, Xcode, Gradle, CocoaPods, Metro, or your CI provider as a text file such as `build.log`.

The most useful input includes the first real error and enough surrounding lines to identify the failing build stage.

## 2. Analyze it

```bash
npx expo-ci-doctor@latest analyze build.log
```

`logs` is available as an alias:

```bash
npx expo-ci-doctor@latest logs build.log
```

When a rule matches, the CLI reports:

- the primary diagnosis and confidence;
- the exact evidence line;
- an explanation of the likely root cause;
- ordered remediation steps;
- the affected platform and build stage.

## 3. Verify the recommendation

The tool uses deterministic regular-expression rules. It does not understand your entire project and cannot guarantee that a recommendation is correct. Confirm the proposed fix against current Expo, Apple, Android, or package documentation before changing production projects.

## Expo Doctor vs Expo CI Doctor

Use the official Expo Doctor before a build:

```bash
npx expo-doctor@latest
```

Use Expo CI Doctor after a build has failed:

```bash
npx expo-ci-doctor@latest analyze build.log
```

Running `expo-ci-doctor check` only directs you to the official Expo Doctor; it does not duplicate Expo's project-health checks.

## No diagnosis found

If no rule matches, the log may be truncated, the failure may be project-specific, or the error wording may have changed since the last package release. Search for the earliest meaningful error and consult the current official documentation for the failing tool.

Next: [Commands and output formats](commands.md) · [Error library](error-library.md)
