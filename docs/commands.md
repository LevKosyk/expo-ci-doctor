# Commands and output formats

## Analyze a build log

```bash
expo-ci-doctor analyze <build.log> [--json | --markdown]
```

`logs` is an alias for `analyze`:

```bash
expo-ci-doctor logs <build.log> [--json | --markdown]
```

## Terminal output

```bash
expo-ci-doctor analyze build.log
```

The terminal report shows the highest-confidence primary diagnosis, its evidence line, explanation, recommended fixes, and the number of matched diagnostics.

## Structured JSON

```bash
expo-ci-doctor analyze build.log --json
```

The JSON document contains:

- `source`: analyzed file path;
- `matchCount`: number of matched rules;
- `primary`: the first diagnosis or `null`;
- `results`: every matched diagnosis.

Each diagnosis includes its rule ID, title, platform, stage, severity, confidence, explanation, fix list, evidence, and source line number.

## Pull-request Markdown

```bash
expo-ci-doctor analyze build.log --markdown
```

The Markdown report contains the primary failure, evidence, explanation, recommended fixes, and a collapsed list of every match. It can be appended directly to GitHub Actions' step summary.

## Project preflight

```bash
expo-ci-doctor check
```

Project preflight is intentionally handled by the official Expo Doctor. This command prints the current recommended workflow:

```bash
npx expo-doctor@latest
npx expo-ci-doctor analyze build.log
```

## General options

```text
--json       Print structured JSON
--markdown   Print a PR-ready Markdown report
--help       Show command help
--version    Show the installed version
```

## Exit codes

| Code | Meaning | CI implication |
| --- | --- | --- |
| `0` | No known pattern found | The analyzer itself did not identify a known failure |
| `1` | One or more diagnoses found | Expected when analyzing a failed build |
| `2` | Invalid command, missing path, or unreadable file | Fix the invocation or file access |

Because a successful diagnosis returns `1`, add `|| true` to a reporting step when later CI steps must continue.

Next: [CI integration](ci-integration.md) · [Privacy](privacy.md)
