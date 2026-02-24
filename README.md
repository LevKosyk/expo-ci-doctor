# expo-ci-doctor

> Predict and explain Expo / React Native CI & EAS build failures **before** you waste 20 minutes on a broken build.

`expo-ci-doctor` is a CLI tool for **Expo / React Native developers** that helps you:
- detect CI / EAS build issues **before running a build**
- understand **why a build failed** after it breaks
- run the same checks locally and in CI
- avoid endless debugging, retries, and guesswork

No macOS build servers.  
No IDE plugins.  
Just a fast, focused CLI.

---

## Why this exists

If you work with Expo or React Native, you’ve seen this:

- works locally → fails in CI  
- build fails after 15–30 minutes  
- error message is unclear  
- Google + StackOverflow = chaos  

`expo-ci-doctor` solves this by answering two questions:

> **Will my build fail?**  
> **If it failed, why exactly did it fail and how do I fix it?**

---

## Installation

### Run instantly (recommended)

```bash
npx expo-ci-doctor check
```

### Global install

```bash
npm install -g expo-ci-doctor
expo-ci-doctor check
```

---

## Commands

### `check` — predict CI / EAS failures

```bash
expo-ci-doctor check
```

Scans your project and detects common Expo / RN CI issues:
- Node version mismatch (local vs CI)
- missing or inconsistent lockfiles
- Expo SDK ↔ React Native incompatibilities
- EAS profile and configuration errors
- missing CI environment variables
- CI workflow misconfiguration

#### JSON output (for CI)

```bash
expo-ci-doctor check --json
```

#### CI strict mode (PRO)

```bash
expo-ci-doctor check --ci-strict
```

In strict mode, warnings are treated as errors and will fail the CI job.

---

### `analyze` — explain build failures

```bash
expo-ci-doctor analyze build.log
```

Analyzes Expo / EAS / CI logs and explains:
- what went wrong
- why the build failed
- how to fix the issue

Supported categories include:
- Expo / EAS authentication errors
- iOS code signing & provisioning
- Android keystore / Gradle failures
- Node / environment mismatches

---

### `doctor` (PRO)

```bash
expo-ci-doctor doctor
```

Runs a full diagnostic:
- project preflight check
- optional log analysis
- final verdict:

- ✅ SAFE TO BUILD  
- ⚠ HIGH RISK  
- ❌ WILL FAIL  

Designed as a “last check” before running a CI build.

---

### `explain` (PRO)

```bash
expo-ci-doctor explain <rule-id>
```

Explains a specific rule in detail:
- why it causes CI failures
- real-world scenarios
- step-by-step fixes

Think of it as StackOverflow, directly in your terminal.

---

### `snapshot` (PRO)

```bash
expo-ci-doctor snapshot
```

Creates a snapshot of your project configuration:
- dependencies
- versions
- Expo / EAS config
- CI setup

Useful for debugging “it worked yesterday” issues.

---

### `diff` (PRO)

```bash
expo-ci-doctor diff snapshot.json
```

Compares the current project state with a previous snapshot and highlights:
- configuration changes
- dependency changes
- potential CI breakpoints

---

## Using in GitHub Actions

Example GitHub Actions workflow:

```yaml
- name: Expo CI Doctor
  run: npx expo-ci-doctor check --ci-strict
```

### With Pro license

```yaml
- name: Expo CI Doctor
  run: npx expo-ci-doctor check --ci-strict
  env:
    EXPO_CI_DOCTOR_KEY: ${{ secrets.EXPO_CI_DOCTOR_KEY }}
```

Exit codes:
- `0` — no issues
- `1` — warnings
- `2` — errors (fail CI)

---

## Free vs Pro

### Free
- basic project checks
- limited rules
- basic log analysis
- local usage

### Pro
- all CI-specific rules
- `doctor` command
- strict CI mode
- advanced log analysis
- rule explanations
- project snapshots & diff
- monorepo support
- rule packs (EAS, GitHub Actions, SDK upgrades)

---

## License activation (Pro)

```bash
expo-ci-doctor login <LICENSE_KEY>
```

For CI:

```bash
export EXPO_CI_DOCTOR_KEY=your_key_here
```

To remove local license:

```bash
expo-ci-doctor logout
```

---

## Philosophy

`expo-ci-doctor` does **not** build your app.  
It tells you **why your build will fail** — or already failed.

> Less guessing.  
> Fewer retries.  
> More predictable releases.

---

## Status

This project is under active development.  
Feedback and real-world CI failures are highly appreciated.
