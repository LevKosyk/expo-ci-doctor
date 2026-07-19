# Expo CI Doctor

> [!IMPORTANT]
> **Archived / no longer maintained.** As of July 19, 2026, Expo CI Doctor is no longer actively supported. The npm package remains available so existing users and builds do not break, but no new features, compatibility updates, or guaranteed security fixes are planned. See [Maintenance status](docs/maintenance.md).

Expo CI Doctor is a deterministic, local CLI that reads failed Expo and React Native build logs, finds a matching failure signal, and suggests the most likely root cause and next steps.

```bash
npx expo-ci-doctor@latest analyze build.log
```

It complements the official Expo Doctor:

- `npx expo-doctor@latest` checks project health before a build.
- `npx expo-ci-doctor analyze build.log` explains a build after it has failed.

The analyzer runs locally, uploads no logs or source code, includes no telemetry SDK, and can produce terminal, JSON, or pull-request-ready Markdown output.

## Documentation

The documentation formerly hosted at `expocidoctor.dev` is preserved in this repository:

- [Quickstart](docs/quickstart.md)
- [Commands and output formats](docs/commands.md)
- [CI integration](docs/ci-integration.md)
- [Error library](docs/error-library.md)
- [Privacy and local processing](docs/privacy.md)
- [Maintenance status](docs/maintenance.md)
- [Version history](CHANGELOG.md)

## Installation

Run without installing:

```bash
npx expo-ci-doctor@latest analyze build.log
```

Or install globally:

```bash
npm install --global expo-ci-doctor
expo-ci-doctor analyze build.log
```

## Output formats

```bash
# Human-readable terminal output
expo-ci-doctor analyze build.log

# Structured automation output
expo-ci-doctor analyze build.log --json

# Markdown suitable for a pull-request summary
expo-ci-doctor analyze build.log --markdown
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | No known failure pattern found |
| `1` | One or more diagnoses found |
| `2` | Invalid arguments or unreadable log |

## Important limitations

- Results are pattern-based diagnostics, not guarantees.
- A log may be incomplete or a failure may be project-specific.
- Expo, EAS, Xcode, Gradle, CocoaPods, Metro, and their error messages continue to evolve, while this package is no longer receiving rule updates.
- Verify suggested changes against current official documentation before applying them.

For actively maintained project-health checks, use the official [`expo-doctor`](https://docs.expo.dev/develop/tools/#expo-doctor).

## License

[MIT](LICENSE) © Lev Kosyk
