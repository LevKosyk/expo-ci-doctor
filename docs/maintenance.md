# Maintenance status

## Archived as of July 19, 2026

Expo CI Doctor is no longer actively maintained.

The npm package and repository remain online to avoid breaking existing users and to preserve the work for reference. However:

- no new features are planned;
- Expo SDK and native-tooling compatibility updates are not planned;
- issues and pull requests may not receive a response;
- security fixes and dependency updates are not guaranteed;
- the custom documentation domain may be retired;
- the documentation in this repository is the permanent archived copy.

## Can I continue using it?

Yes, but at your own risk. Pin a known version, treat every result as a diagnostic hint, and verify recommendations against current official documentation. Rules may become inaccurate as Expo, EAS, Xcode, Android, CocoaPods, and Metro evolve.

```bash
npx expo-ci-doctor@1.1.0 analyze build.log
```

## Recommended maintained alternative

For project configuration and dependency health, use Expo's official Doctor:

```bash
npx expo-doctor@latest
```

Expo Doctor does not replace failed-build-log analysis, but it is the maintained choice for Expo project preflight checks.

## Package availability

The package is intentionally not being unpublished. Keeping the published versions available prevents existing installs and CI pipelines from failing solely because the project was discontinued.
