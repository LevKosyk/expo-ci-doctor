# Expo CI Doctor

A powerful CLI tool that helps Expo and React Native developers detect, analyze, and prevent CI and EAS build failures before they waste time.

Official docs: https://www.expocidoctor.dev/

No telemetry.  
No cloud processing.  
Runs locally and in CI.

---

## ✨ Why Expo CI Doctor?

CI failures are expensive.

You push → GitHub Actions runs → EAS builds → 10 minutes later… ❌ failed.

Expo CI Doctor analyzes your project before CI does and gives you:

- Clear root-cause diagnostics  
- File-level pointers  
- Dependency compatibility warnings  
- Upgrade safety checks  
- Build readiness scoring  
- Noise filtering for CI logs  

It also provides trend tracking, PR-ready summaries, safer auto-fixes, and script-friendly output for automation.

## 📚 Documentation

Full documentation, guides, and release notes live at [expocidoctor.dev](https://www.expocidoctor.dev/).

## 🆕 What's New in 1.0.3

- Added dependency bloat and risk detection for stale, duplicated, and oversized package sets.
- Added packageManager field drift checks to catch lockfile and Corepack mismatches.
- Added workflow autofix support for common GitHub Actions, GitLab CI, and CircleCI issues.
- Added custom fail thresholds per command/repo via `--fail-on` and config thresholds.
- Added workspace-aware scanning with `--all-workspaces` for monorepo projects.
- Added a workspace dashboard command for faster monorepo health reviews.
- Added `release-notes` command to generate changelog-style summaries from findings.
- Added richer CI/reporting flows: webhook hooks, direct annotations, compare, and upgrade-plan support.

Release files:
- See `CHANGELOG.md` for version history.
- See `RELESE_NOTES.md` for the detailed 1.0.3 summary.

---

## 🚀 Installation

### Global install

```bash
npm install -g expo-ci-doctor
```

### Or run directly

```bash
npx expo-ci-doctor@latest check
```

---

## ⚡ Quick Start (5 minutes)

1. Install the CLI
2. Run:

```bash
expo-ci-doctor check
```

3. Review actionable output before pushing to CI

---

## 🧪 Example Output

### ❌ Before

```
EAS Build failed.
```

### ✅ After Expo CI Doctor

```
✔ Dependency compatibility: OK
⚠ Expo SDK mismatch detected

Root cause:
- expo-updates is incompatible with SDK 51

Location:
- app.config.ts:42

Suggested fix:
- Upgrade expo-updates to ^0.20.0

Build Readiness Score: 72 / 100 (Medium Risk)
```

---

## 📦 Core Commands

These are the most useful commands for day-to-day work.

### Check project configuration

```bash
expo-ci-doctor check
```

Validates:
- app.json / app.config.js
- SDK compatibility
- Dependency alignment
- Known CI pitfalls

Useful options:
- `--summary` for a one-screen health summary
- `--json` or `--format md` for machine-friendly output
- `--output <file>` to write the report to a file
- `--verbose`, `--silent`, `--no-color`, and `--version-check off` for scripting

---

### Doctor view

```bash
expo-ci-doctor doctor
```

Performs:
- Root cause grouping
- Category-by-category health checks
- Suggested fixes
- Overall health score

---

### CI preflight

```bash
expo-ci-doctor preflight
```

Fast CI-blocker check for pipelines and pull requests.

### Generate PR comment markdown

```bash
expo-ci-doctor pr-comment --out expo-ci-pr-comment.md
```

Creates a ready-to-post PR comment with blockers, fixes, and health summary.

---

### Log analysis

```bash
expo-ci-doctor logs ./build.log
```

Reads a CI/EAS log, detects known failure patterns, and explains the most likely root cause.

---

### Upgrade safety check

```bash
expo-ci-doctor check --upgrade expo@51
```

Simulates upgrade risk before bumping Expo SDK or dependencies.

### Auto-fix pack

```bash
expo-ci-doctor fix --pack safe
expo-ci-doctor fix --pack deps
expo-ci-doctor fix --pack all --yes
```

Applies safe configuration fixes or dependency-related commands.

---

### Trend history

```bash
expo-ci-doctor trends --days 30
```

Shows whether your CI health is improving, stable, or degrading over time.

### Tips

```bash
expo-ci-doctor tips
```

Prints a short list of Expo CI best practices.

### Config wizard

```bash
expo-ci-doctor wizard
```

Interactive setup for `.expo-ci-doctorrc`, including custom rules.

### Explain a rule

```bash
expo-ci-doctor explain <rule-id>
```

Shows detailed context for a specific rule and why it matters.

### Explain build errors

```bash
expo-ci-doctor explain-error
```

Interactive log explainer for a pasted failure snippet.

### Readiness badge

```bash
expo-ci-doctor badge --markdown
```

Generates a README badge snippet for your current score.

### CI template

```bash
expo-ci-doctor ci-template
```

Generates a starter GitHub Actions workflow for Expo projects.

### Help and setup

```bash
expo-ci-doctor init
expo-ci-doctor watch
```

- `init` creates a default `.expo-ci-doctorrc`
- `watch` reruns checks automatically when config files change

---

## ⚙️ Output Modes

The CLI is designed to be script-friendly.

- `--summary` prints one screen with score, top issues, and first fix
- `--json` prints a compact JSON payload
- `--json-full` prints results plus readiness data
- `--format md` prints GitHub-Flavored Markdown
- `--output <file>` writes the chosen output to disk
- `--silent` keeps output to a single final status line
- `--verbose` prints debug details to stderr
- `--no-color` disables ANSI colors

Example:

```bash
expo-ci-doctor check --summary --output report.md --version-check off
```

---

## 🛠 Configuration

Create `.expo-ci-doctorrc` in your project root:

```json
{
  "rules": {
    "ci-missing-install": "error",
    "expo-detected": "off"
  },
  "ignore": ["node_modules/**"],
  "customRules": [
    {
      "id": "missing-env-example",
      "title": "Missing .env.example template",
      "level": "warn",
      "fix": "Create .env.example and include EXPO_TOKEN.",
      "when": { "fileMissing": ".env.example" }
    }
  ]
}
```

You can also generate this file with `expo-ci-doctor init`.

---

## What It Analyzes

- Expo SDK compatibility
- EAS build config 
- app.json / app.config.ts
- Native dependency mismatches
- Version alignment
- Known breaking changes
- CI environment patterns
- Plugin version compatibility
- Native Android/iOS readiness
- Trend history and flaky CI behavior
- Multi-CI workflows

---

## How It Works

Expo CI Doctor uses deterministic rule-based analysis:

- Static configuration validation
- Dependency compatibility graph checks
- Heuristic CI failure pattern detection
- Risk scoring based on known failure signals

No source code is uploaded.  
Everything runs locally unless you run it inside CI.

---

## Security & Privacy

- No telemetry
- No analytics tracking inside CLI
- No source code uploads
- No cloud dependency required

Safe for local development and CI environments.

---

## Typical Use Cases

- Before pushing to GitHub
- Before upgrading Expo SDK
- Debugging EAS failures
- Adding CI safety checks to pipelines
- Preventing repetitive build crashes
- Generating PR summaries for review
- Catching native build issues earlier in the pipeline

---

## Contributing

Pull requests are welcome.

If you find a CI pattern that should be detected, open an issue with:
- Expo SDK version
- Relevant config
- Error output (sanitized)

---

## License

MIT

---

## If This Saves You Time

Star the repository and share it with other Expo developers.

---

## Links

- Docs: https://www.expocidoctor.dev/
- Repository: this project
